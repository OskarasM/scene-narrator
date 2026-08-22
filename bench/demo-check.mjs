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

const { server, port } = await serveDist()

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

await page.goto(`http://127.0.0.1:${port}/`)
// Long enough for WebGL to come up and several cadence windows to elapse, so the summaries
// have been written at least once and probably rewritten.
await page.waitForTimeout(4000)

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
  browserVersion: browser.version(),
  pageErrors: errors,
  headings,
  canvasNodeCount: canvasNodes.length,
  canvasChildCount: canvasNodes[0]?.childIds?.length ?? 0,
  liveRegionCount: liveRegions.length,
  pixels,
  summarySamples: summaries.slice(0, 8),
  axeViolations: axeResults,
}

await writeFile(resolve(ROOT, 'bench/results/demo-check.json'), JSON.stringify(report, null, 2), 'utf8')

console.log(JSON.stringify(report, null, 2))

await browser.close()
server.close()

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
if (errors.length > 0) failures.push(`${errors.length} page error(s)`)
if (Array.isArray(axeResults) && axeResults.length > 0) {
  failures.push(`${axeResults.length} axe violation(s)`)
}

if (failures.length > 0) {
  console.error('\nFAILED:\n- ' + failures.join('\n- '))
  process.exit(1)
}
console.log('\nDemo accessibility check passed.')
