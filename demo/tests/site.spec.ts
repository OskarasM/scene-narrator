import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * The accessibility floor, asserted rather than claimed.
 *
 * This is the same suite the two sibling sites run, held to the same bar, and
 * on this repository it carries more weight than on either of them: a library
 * that exists to make WebGL scenes reachable cannot ship a demo page that is
 * not. Everything here has to hold in all three engines, and everything except
 * the scene itself has to hold with no WebGL context at all, because that is
 * what a work laptop with hardware acceleration switched off looks like.
 */

const SECTIONS = ['scene', 'silence', 'transcript', 'cost', 'nvda', 'use', 'limits'] as const

test('@smoke the page loads and every section is present', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  const response = await page.goto('/')
  expect(response?.ok()).toBe(true)

  await expect(page.getByRole('heading', { level: 1 })).toContainText('screen reader')

  for (const id of SECTIONS) {
    await expect(page.locator(`#${id}`)).toBeVisible()
  }

  expect(errors).toEqual([])
})

/**
 * The scene either draws or explains itself.
 *
 * Headless Firefox on a CI runner has no WebGL. Before the guard existed, that
 * visitor got an uncaught Three.js error and a blank rectangle. One of these
 * two branches has to be true in every browser.
 */
test('the scene renders, or says why it cannot', async ({ page }) => {
  await page.goto('/')
  await settleViewport(page)

  const canvas = page.locator('.viewport canvas')
  const refused = page.getByRole('heading', { name: /will not give up a WebGL context/i })

  if (await canvas.count()) {
    await expect(canvas).toBeVisible()
    await expect(refused).toHaveCount(0)
  } else {
    await expect(refused).toBeVisible()
    // The point of the notice is that the rest of the page is still worth
    // reading, so the rest of the page had better still be there.
    await expect(page.locator('#cost')).toBeVisible()
    await expect(page.locator('#nvda')).toBeVisible()
  }
})

test('has no serious WCAG 2 A or AA violations', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The full accessibility scan runs in Chromium.')

  await page.goto('/')
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )

  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
})

test('the skip link is the first thing a keyboard reaches and it works', async ({
  page,
  browserName,
}) => {
  await page.goto('/')
  const skip = page.getByRole('link', { name: /skip to main content/i })

  // WebKit leaves links out of the tab order until the reader turns on "press
  // Tab to highlight each item on a webpage", which is off by default and is a
  // browser preference rather than anything this page decides. It lands on the
  // first button instead. Everywhere else the very first Tab has to arrive
  // here, and it is the first element in the document in all three.
  if (browserName !== 'webkit') {
    await page.keyboard.press('Tab')
    await expect(skip).toBeFocused()
  }

  await skip.focus()
  await expect(skip).toBeFocused()
  await skip.press('Enter')
  await expect(page.locator('#main')).toBeInViewport()
})

/**
 * This site named two font families and fetched neither for its first three
 * months. document.fonts.check() is no good for catching that: it returns true
 * for a family with no @font-face rule at all, because the text renders
 * perfectly well in a fallback. Read the FontFaceSet instead.
 */
test('the three faces are actually fetched and loaded, not just named', async ({ page }) => {
  const fontResponses: { url: string; status: number }[] = []
  page.on('response', (response) => {
    if (response.url().endsWith('.woff2')) {
      fontResponses.push({ url: response.url(), status: response.status() })
    }
  })

  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)

  const faces = await page.evaluate(() =>
    [...document.fonts].map((face) => ({ family: face.family, status: face.status })),
  )
  // Firefox reports the family with the quotes from the @font-face descriptor
  // still attached, so it answers "Literata" where Chromium and WebKit answer
  // Literata. Strip them before comparing, or this passes in two browsers and
  // fails in the third for no reason to do with fonts.
  const present = faces
    .filter((face) => face.status === 'loaded')
    .map((face) => face.family.replace(/^["']|["']$/g, ''))
  const loaded = (family: string) => present.includes(family)

  expect(loaded('Literata'), `display face missing. Present: ${present.join(', ')}`).toBe(true)
  expect(loaded('Commit Mono'), `chrome face missing. Present: ${present.join(', ')}`).toBe(true)
  expect(loaded('Atkinson Next'), `body face missing. Present: ${present.join(', ')}`).toBe(true)

  expect(fontResponses.length).toBeGreaterThan(0)
  for (const response of fontResponses) {
    expect(response.status, `${response.url} did not return 200`).toBe(200)
    // A font CDN would put visitor IP addresses on a third party, which is a
    // strange position for an accessibility project to take.
    expect(new URL(response.url).origin).toBe(new URL(page.url()).origin)
  }
})

/** Every link posted to LinkedIn or an application form unfurled blank until
 *  these existed, which is an expensive defect for work whose purpose is to be
 *  shared with employers. */
test('the social preview metadata is present and absolute', async ({ page }) => {
  await page.goto('/')

  const content = async (selector: string) =>
    page.locator(selector).first().getAttribute('content')

  expect(await content('meta[property="og:title"]')).toContain('scene-narrator')
  expect(await content('meta[property="og:description"]')).toBeTruthy()
  expect(await content('meta[property="og:image"]')).toMatch(/^https:\/\/.+\/og\.png$/)
  expect(await content('meta[name="twitter:card"]')).toBe('summary_large_image')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\//)
})

test('pinch zoom is not blocked', async ({ page }) => {
  await page.goto('/')
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
  expect(viewport).not.toMatch(/user-scalable\s*=\s*no/)
  expect(viewport).not.toMatch(/maximum-scale/)
})

for (const width of [375, 768, 1024, 1440]) {
  test(`nothing overflows the page horizontally at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })
}

test('every interactive target clears 44px at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto('/')

  const small = await page.evaluate(() => {
    const bad: string[] = []
    for (const el of document.querySelectorAll('button, a[href], input, [role="button"]')) {
      const rect = el.getBoundingClientRect()
      // Skip anything not rendered, and the skip link, which is off screen
      // until it takes focus.
      if (rect.width === 0 || rect.height === 0) continue
      if (el.classList.contains('skip-link')) continue
      // WCAG 2.5.8 exempts a target that is inline in a sentence, because
      // making it 44px tall would break the line it sits in. Everything that
      // is its own control still has to clear the floor.
      if (el.matches('p a, li a, dd a, caption a, figcaption a')) continue
      if (rect.height < 44) {
        bad.push(`${el.tagName}.${el.className} is ${Math.round(rect.height)}px tall`)
      }
    }
    return bad
  })

  expect(small).toEqual([])
})

/** The rail is this site's structural device. If it stops being one
 *  continuous vertical line, the page is a different page. */
test('the transcript rail lines up across every section', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)

  const edges = await page.evaluate(() =>
    [...document.querySelectorAll('.stamp')].map((node) =>
      Math.round(node.getBoundingClientRect().right),
    ),
  )

  expect(edges.length).toBeGreaterThan(5)
  expect(new Set(edges).size, `rail edges disagree: ${edges.join(', ')}`).toBe(1)
})

/** The three scenes are the argument. A picker that silently keeps showing the
 *  first one would leave two thirds of it unmade. */
test('the scene picker offers three scenes and switching changes the narrator', async ({
  page,
}) => {
  await page.goto('/')

  const tabs = page.locator('.scene-tab')
  await expect(tabs).toHaveCount(3)
  await expect(tabs.first()).toHaveAttribute('aria-pressed', 'true')

  const configurator = page.getByRole('button', { name: /product configurator/i })
  await configurator.click()
  await expect(configurator).toHaveAttribute('aria-pressed', 'true')

  // The configurator names its own regions, so there is no grid to size and
  // the region dial has nothing to do.
  await expect(page.locator('#regions')).toBeDisabled()

  await expect(page.locator('.transcript-head')).toContainText('Task lamp configurator')
})

test('the cadence dial is a real control with a hint a screen reader can reach', async ({
  page,
}) => {
  await page.goto('/')

  const cadence = page.locator('#cadence')
  await expect(cadence).toHaveAttribute('aria-describedby', 'cadence-hint')
  await expect(page.locator('#cadence-hint')).toBeVisible()
  await expect(page.locator('output[for="cadence"]')).toContainText('250ms')
})

/** Every measured claim on this page has to survive the scene not running,
 *  because CI has no WebGL and an employer might have none either. */
test('the recorded measurements are on the page whether or not the scene runs', async ({
  page,
}) => {
  await page.goto('/')

  const tables = page.locator('#cost .data-table')
  await expect(tables).toHaveCount(3)
  await expect(page.locator('#cost')).toContainText('4,000')
  await expect(page.locator('#cost')).toContainText('bench/partition.mjs')

  await expect(page.locator('#nvda pre')).toHaveCount(2)
  await expect(page.locator('#nvda .verdict.is-unverified').first()).toBeVisible()
})

test('the page ends on a call to action', async ({ page }) => {
  await page.goto('/')
  const cta = page.locator('.cta')
  await expect(cta.getByRole('heading', { level: 2 })).toBeVisible()
  await expect(cta.getByRole('link', { name: /read the full guide/i })).toHaveAttribute(
    'href',
    /github\.com/,
  )
})

test('the footer links to both sibling projects', async ({ page }) => {
  await page.goto('/')
  const footer = page.locator('.site-footer')

  await expect(footer.getByRole('link', { name: 'three-dispose-guard' })).toHaveAttribute(
    'href',
    /three-dispose-guard/,
  )
  await expect(footer.getByRole('link', { name: 'realtime-3d-room' })).toHaveAttribute(
    'href',
    /realtime-3d-room/,
  )
})

/**
 * The same page on a machine that will not give up a WebGL context.
 *
 * Worth its own test rather than leaving it to whichever CI browser happens to
 * lack one: the sibling site had a layout bug on exactly this path that
 * reached CI because the only browser exercising it was the one nobody was
 * looking at.
 */
test('the page still holds its layout when WebGL is refused', async ({ page }) => {
  await refuseWebgl(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)

  await expect(
    page.getByRole('heading', { name: /will not give up a WebGL context/i }),
  ).toBeVisible()
  await expect(page.locator('.viewport canvas')).toHaveCount(0)

  const edges = await page.evaluate(() =>
    [...document.querySelectorAll('.stamp')].map((node) =>
      Math.round(node.getBoundingClientRect().right),
    ),
  )
  expect(new Set(edges).size, `rail edges disagree: ${edges.join(', ')}`).toBe(1)

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
})

/**
 * Wait for the viewport to resolve one way or the other.
 *
 * The canvas is in a lazily imported chunk, so between first paint and the
 * chunk arriving the viewport holds neither a canvas nor the refusal notice.
 * Without this, a test that asks "is there a canvas?" straight after goto gets
 * "no" in every browser and quietly skips itself, which is worse than failing.
 */
async function settleViewport(page: Page) {
  await page
    .locator('.viewport canvas, .viewport-refused')
    .first()
    .waitFor({ state: 'attached', timeout: 15_000 })
}

async function refuseWebgl(page: Page) {
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (typeof type === 'string' && type.includes('webgl')) return null
      return (real as (...args: unknown[]) => unknown).call(this, type, ...rest)
    } as typeof real
  })
}

/**
 * The one thing this page claims that no other page in the set can.
 *
 * If the scene runs, the library has to actually write sentences into the
 * accessibility tree, and they have to be reachable as headings. This asserts
 * against the real tree, inside the canvas, not against the mirror shown in
 * the margin.
 */
test('the narrator puts real headings and sentences inside the canvas', async ({ page }) => {
  await page.goto('/')

  await settleViewport(page)
  const canvas = page.locator('.viewport canvas')
  test.skip((await canvas.count()) === 0, 'No WebGL context in this browser.')

  // Two cadences, so the first evaluation has certainly happened.
  await page.waitForTimeout(1200)

  const tree = await page.evaluate(() => {
    const node = document.querySelector('.viewport canvas')
    if (!node) return null
    return {
      headings: [...node.querySelectorAll('h2, h3')].map((h) => h.textContent?.trim() ?? ''),
      live: node.querySelector('[aria-live]') !== null,
    }
  })

  expect(tree).not.toBeNull()
  expect(tree!.headings.length, 'the narrator wrote no headings').toBeGreaterThan(1)
  expect(tree!.live, 'no live region for announcements').toBe(true)

  // And the same sentences reach the page, which is what the transcript claims.
  await expect(page.locator('.spoken-line')).not.toHaveText(/Nothing yet/)
  await expect(page.locator('.transcript-body li').first()).toBeVisible()
})
