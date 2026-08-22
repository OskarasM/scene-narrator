// Does the built demo actually produce an accessibility tree in a real browser?
//
// The unit tests run in jsdom, which is a model of a browser rather than one. This loads
// the real built demo in a real headed Chromium with forced accessibility, reads Chromium's
// own accessibility tree over CDP, and checks that the scene is in it with headings and
// summaries. It also runs axe.
//
// axe is included with the caveat stated rather than buried: automated tooling catches
// somewhere around a third to a half of real accessibility problems and cannot hear a
// screen reader at all. A clean axe run is a floor, not a result.
//
// Run: cd demo && npm run build && cd .. && node bench/demo-check.mjs
// Or against the deployed demo: node bench/demo-check.mjs https://oskarasm.github.io/scene-narrator/

import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DIST = resolve(ROOT, 'demo/dist')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

function serveDist() {
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    let filePath = join(DIST, pathname === '/' ? 'index.html' : pathname)
    try {
      const info = await stat(filePath)
      if (info.isDirectory()) filePath = join(filePath, 'index.html')
    } catch {
      filePath = join(DIST, 'index.html')
    }
    try {
      res.writeHead(200, { 'content-type': TYPES[extname(filePath)] || 'application/octet-stream' })
      createReadStream(filePath).pipe(res)
    } catch {
      res.writeHead(404).end('Not found')
    }
  })
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })))
}

// With no argument, serve and check the local build. With a URL, check whatever is
// deployed there. The plan called for Playwright and axe against the deployed demo, and a
// green deployment workflow is not the same claim as a working page: the build can succeed
// and the site still 404 its assets under a base path, which is exactly the failure a
// static host introduces and a local preview cannot show you.
const target = process.argv[2]
const { server, port } = target ? { server: null, port: null } : await serveDist()
const url = target ?? `http://127.0.0.1:${port}/`

const browser = await chromium.launch({
  headless: false,
  args: ['--force-renderer-accessibility'],
})
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await context.newPage()
const session = await context.newCDPSession(page)
await session.send('Accessibility.enable')

const errors = []
page.on('pageerror', (err) => errors.push(String(err)))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})

await page.goto(url)
// Long enough for WebGL to come up and several cadence windows to elapse, so the summaries
// have been written at least once and probably rewritten.
await page.waitForTimeout(target ? 8000 : 4000)

// Did anything actually render? The accessibility tree can be perfect while the canvas is
// blank, which is precisely the failure this library shipped once: a useFrame priority
// above 0 switches R3F into manual rendering mode and nothing calls gl.render() any more.
// Every DOM assertion below still passed while the 3D scene was completely invisible.
const pixels = await page.evaluate(() => {
  const canvas = document.querySelector('canvas')
  if (!canvas) return { error: 'no canvas' }
  // The WebGL drawing buffer is cleared after presentation unless preserveDrawingBuffer is
  // set, so copy through a 2D context instead of reading the GL buffer.
  const off = document.createElement('canvas')
  off.width = canvas.width
  off.height = canvas.height
  off.getContext('2d').drawImage(canvas, 0, 0)
  const data = off.getContext('2d').getImageData(0, 0, off.width, off.height).data
  const seen = new Set()
  for (let i = 0; i < data.length; i += 4 * 97) {
    seen.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`)
  }
  return { distinctColours: seen.size, size: [canvas.width, canvas.height] }
})

// Does the keyboard model actually work in a real browser? The unit tests dispatch
// synthetic KeyboardEvents in jsdom, which proves the handlers are wired but not that a
// real key press reaches them, that focus lands where it should, or that a focus ring is
// visible. Same lesson as the blank canvas: assert the observable behaviour, not the
// markup that is supposed to produce it.
const keyboard = await (async () => {
  const region = () =>
    page.evaluate(() => {
      const active = document.activeElement
      const section = active && active.closest && active.closest('[data-narrator-region]')
      return section ? section.dataset.narratorRegion : null
    })

  // Tab until focus lands inside the scene, giving up rather than looping forever.
  let entered = null
  for (let i = 0; i < 12 && !entered; i++) {
    await page.keyboard.press('Tab')
    entered = await region()
  }
  if (!entered) return { entered: false }

  // The focused element itself is visually hidden, because the accessibility tree is canvas
  // fallback content. So the focus indicator cannot be on it, and checking it would be
  // checking the wrong thing. What matters is that *something a sighted user can see*
  // indicates focus: here the viewport containing the canvas.
  const outlineVisible = await page.evaluate(() => {
    const shows = (el) => {
      if (!el) return false
      const style = getComputedStyle(el)
      return (
        (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
        style.boxShadow !== 'none'
      )
    }
    const active = document.activeElement
    return shows(active) || shows(document.querySelector('.viewport')) || shows(document.querySelector('canvas'))
  })

  await page.keyboard.press('ArrowDown')
  const afterArrow = await region()

  await page.keyboard.press('Enter')
  const itemsWhenOpen = await page.evaluate(
    () => document.querySelectorAll('.scene-narrator li').length,
  )

  await page.keyboard.press('Escape')
  const itemsWhenClosed = await page.evaluate(
    () => document.querySelectorAll('.scene-narrator li').length,
  )

  return {
    entered: true,
    firstRegion: entered,
    movedWithArrow: afterArrow !== null && afterArrow !== entered,
    outlineVisible,
    itemsWhenOpen,
    itemsWhenClosed,
  }
})()

const { nodes } = await session.send('Accessibility.getFullAXTree')

const headings = nodes
  .filter((n) => n.role?.value === 'heading' && !n.ignored)
  .map((n) => n.name?.value)
  .filter(Boolean)

const canvasNodes = nodes.filter((n) => n.role?.value === 'Canvas')
const liveRegions = nodes.filter((n) =>
  n.properties?.some((p) => p.name === 'live' && p.value?.value),
)

// The summaries are the paragraphs the library rewrites. Find them by their vocabulary.
const summaries = nodes
  .map((n) => n.name?.value ?? n.value?.value ?? '')
  .filter((t) => typeof t === 'string' && /van|ahead|to your (left|right)|behind you/.test(t))

// axe, injected from the installed package rather than a CDN, because the demo has no
// network access assumptions and a CDN would make this check depend on the internet.
let axeResults = null
try {
  const axeSource = await readFile(resolve(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8')
  await page.evaluate(axeSource)
  axeResults = await page.evaluate(async () => {
    // @ts-expect-error injected
    const results = await window.axe.run(document, { resultTypes: ['violations'] })
    return results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
    }))
  })
} catch (err) {
  axeResults = { error: String(err && err.message) }
}

const report = {
  recordedAt: new Date().toISOString(),
  url,
  browserVersion: browser.version(),
  pageErrors: errors,
  headings,
  canvasNodeCount: canvasNodes.length,
  canvasChildCount: canvasNodes[0]?.childIds?.length ?? 0,
  liveRegionCount: liveRegions.length,
  pixels,
  keyboard,
  summarySamples: summaries.slice(0, 8),
  axeViolations: axeResults,
}

await writeFile(resolve(ROOT, target ? 'bench/results/demo-check-deployed.json' : 'bench/results/demo-check.json'), JSON.stringify(report, null, 2), 'utf8')

console.log(JSON.stringify(report, null, 2))

await browser.close()
server?.close()

// Fail loudly. A demo that silently stopped producing an accessibility tree would otherwise
// keep passing this check forever.
const failures = []
if (headings.length < 2) failures.push('fewer than 2 headings in the accessibility tree')
if (summaries.length === 0) failures.push('no region summary found in the accessibility tree')
if (liveRegions.length === 0) failures.push('no live region found')
// A scene that rendered has a sky, a ground and some geometry, so several distinct colours.
// One colour means a blank canvas, whatever the accessibility tree says.
if (!pixels.distinctColours || pixels.distinctColours < 3) {
  failures.push(`canvas rendered ${pixels.distinctColours ?? 0} distinct colour(s): the 3D scene is blank`)
}
if (!keyboard.entered) failures.push('Tab never reached the scene')
if (!keyboard.movedWithArrow) failures.push('arrow key did not move between areas')
if (!keyboard.outlineVisible) failures.push('focused area has no visible focus indicator')
if (!(keyboard.itemsWhenOpen > 0)) failures.push('Enter did not list the objects in an area')
if (keyboard.itemsWhenClosed !== 0) failures.push('Escape did not close the area')
if (errors.length > 0) failures.push(`${errors.length} page error(s)`)
if (Array.isArray(axeResults) && axeResults.length > 0) {
  failures.push(`${axeResults.length} axe violation(s)`)
}

if (failures.length > 0) {
  console.error('\nFAILED:\n- ' + failures.join('\n- '))
  process.exit(1)
}
console.log('\nDemo accessibility check passed.')
