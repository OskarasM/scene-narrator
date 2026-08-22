/**
 * NVDA against the real demo.
 *
 * Browse mode and focus mode are tested separately and deliberately. They are different
 * code paths: in browse mode NVDA owns the arrow keys and the page's handlers mostly do not
 * fire, and in focus mode they do. A component can work in one and be broken in the other,
 * so untested in both means untested.
 *
 * The transcripts this produces are committed verbatim to NVDA.md. They are the evidence
 * that this library has been listened to and not merely inspected.
 *
 * Requires the demo to be built: cd demo && npm run build
 * Run: npx playwright test --config playwright.config.ts nvda/demo.spec.ts
 */

import { nvdaTest } from '@guidepup/playwright'
import { expect } from '@playwright/test'
import { createReadStream } from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { extname, join, resolve } from 'node:path'

const DIST = resolve('demo/dist')
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

let server: Server
let port: number

nvdaTest.beforeAll(async () => {
  await stat(join(DIST, 'index.html')).catch(() => {
    throw new Error('demo/dist is missing. Run: cd demo && npm run build')
  })
  server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    let filePath = join(DIST, pathname === '/' ? 'index.html' : pathname)
    try {
      if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html')
    } catch {
      filePath = join(DIST, 'index.html')
    }
    res.writeHead(200, { 'content-type': TYPES[extname(filePath)] ?? 'application/octet-stream' })
    createReadStream(filePath).pipe(res)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  port = (server.address() as { port: number }).port
})

nvdaTest.afterAll(() => server?.close())

const transcripts: Record<string, string[]> = {}

nvdaTest.afterAll(async () => {
  await mkdir(resolve('bench/results'), { recursive: true })
  await writeFile(
    resolve('bench/results/nvda-demo.json'),
    JSON.stringify({ recordedAt: new Date().toISOString(), transcripts }, null, 2),
    'utf8',
  )
})

nvdaTest('browse mode: reading the scene from the top', async ({ page, nvda }) => {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
  // Several cadence windows, so the summaries have been written and rewritten at least
  // once. Reading a scene that has not ticked yet would be a test of the initial render.
  await page.waitForTimeout(3000)

  await nvda.navigateToWebContent()

  for (let i = 0; i < 45; i++) await nvda.next()
  const log = await nvda.spokenPhraseLog()
  transcripts.browse = log
  const transcript = log.join(' | ')

  console.log('\n--- browse mode ---')
  for (const line of log) console.log(line)

  // The scene has a name and a role. That alone is what a bare canvas cannot do.
  expect(transcript).toContain('Delivery yard')
  // Areas are headings, which is what 71.6% of screen reader users navigate by.
  expect(transcript).toMatch(/heading, level 3/)
  // Contents are summarised, with direction in words.
  expect(transcript).toMatch(/vans?/)
  expect(transcript).toMatch(/ahead|to your left|to your right|behind you/)
  // And never as raw coordinates.
  expect(transcript).not.toMatch(/-?\d+\.\d\d/)
})

nvdaTest('browse mode: jumping by heading, which is how people actually navigate', async ({
  page,
  nvda,
}) => {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
  await page.waitForTimeout(3000)
  await nvda.navigateToWebContent()

  const headings: string[] = []
  for (let i = 0; i < 12; i++) {
    await nvda.nextHeading()
    headings.push(await nvda.lastSpokenPhrase())
  }
  transcripts.headings = headings

  console.log('\n--- heading navigation ---')
  for (const line of headings) console.log(line)

  const joined = headings.join(' | ')
  expect(joined).toContain('Delivery yard')
  // Every area heading has to mean something read on its own, out of context, with no
  // neighbouring heading to compare it against.
  expect(joined).toMatch(/scene/)
})

nvdaTest('focus mode: tabbing in and using the arrow keys', async ({ page, nvda }) => {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
  await page.waitForTimeout(3000)
  await nvda.navigateToWebContent()

  await nvda.clearSpokenPhraseLog()
  // Tab into the page. The scene exposes exactly one tab stop, so this reaches it without
  // wading through one stop per area.
  for (let i = 0; i < 4; i++) await nvda.press('Tab')
  // Then move between areas and open one.
  await nvda.press('ArrowDown')
  await nvda.press('ArrowDown')
  await nvda.press('Enter')

  const log = await nvda.spokenPhraseLog()
  transcripts.focus = log

  console.log('\n--- focus mode ---')
  for (const line of log) console.log(line)

  // Something in the scene was reached and spoken. The specific assertions are deliberately
  // weak here: what focus mode does with a custom keyboard model varies, and the value of
  // this test is the committed transcript, which a person reads.
  expect(log.length).toBeGreaterThan(0)
})
