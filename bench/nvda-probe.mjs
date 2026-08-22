// Does NVDA actually reach canvas fallback content?
//
// This is the single question the library's default mount point depends on, and it cannot
// be answered from Chromium's internal accessibility tree. Chromium builds an AXObject tree
// that CDP will happily show you; NVDA reads a different thing, through UI Automation, and
// the two are not the same. Canvas fallback content has historically had patchy screen
// reader support, in places limited to focusable elements.
//
// So this asks NVDA. It loads a page with the same content in two places, one inside the
// <canvas> as fallback content and one as an ordinary sibling, reads through the whole
// page, and prints what NVDA said. If the canvas half is absent from the transcript, the
// library's default mount point changes and the spike's arm D becomes a finding about
// Chromium rather than a recommendation to anybody.
//
// Run: node bench/nvda-probe.mjs [--headed-only]
// Requires: npx @guidepup/setup install nvda
//
// NVDA will speak out loud while this runs. That is not a bug, it is the point.

import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { nvda } from '@guidepup/guidepup'
import { startServer } from './serve.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT_DIR = resolve(ROOT, 'bench/results')

// Two sentinel phrases, distinct enough that neither can be mistaken for page furniture or
// for the other. If NVDA says one, it reached that mount point.
const CANVAS_SENTINEL = 'Canvas fallback content is reachable'
const SIBLING_SENTINEL = 'Sibling content is reachable'

const PAGE = `<!doctype html>
<html lang="en-GB">
<head><meta charset="utf-8"><title>NVDA mount point probe</title>
<style>
.sr-only { position:absolute; width:1px; height:1px; overflow:hidden;
           clip:rect(0 0 0 0); clip-path:inset(50%); white-space:nowrap; }
</style>
</head>
<body>
<h1>NVDA mount point probe</h1>

<canvas id="scene" width="320" height="200">
  <div id="in-canvas">
    <h2>Inside the canvas</h2>
    <p>${CANVAS_SENTINEL}</p>
    <div tabindex="0" id="canvas-focusable">A focusable element inside the canvas</div>
  </div>
</canvas>

<div id="beside-canvas" class="sr-only">
  <h2>Beside the canvas</h2>
  <p>${SIBLING_SENTINEL}</p>
  <div tabindex="0" id="sibling-focusable">A focusable element beside the canvas</div>
</div>

<p>End of probe.</p>
</body>
</html>`

async function main() {
  const { server, port } = await startServer(0)
  await mkdir(OUT_DIR, { recursive: true })

  // Chromium is launched with the flag the whole spike hinges on, plus a real NVDA process
  // attached. This run is also the check that the flag is a fair proxy for the real thing.
  const browser = await chromium.launch({
    headless: false,
    args: ['--force-renderer-accessibility'],
  })
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } })
  const page = await context.newPage()

  await page.route('**/probe.html', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE }),
  )

  console.log('Starting NVDA. It will speak out loud.')
  await nvda.start()

  try {
    await page.goto(`http://127.0.0.1:${port}/probe.html`)
    await page.bringToFront()
    // NVDA reads whatever window has focus, so the browser has to be genuinely focused and
    // not merely on top.
    await page.locator('h1').focus().catch(() => {})
    await new Promise((r) => setTimeout(r, 2000))

    await nvda.clearSpokenPhraseLog()

    // Read the whole page top to bottom in browse mode, which is how a screen reader user
    // meets a page they have not seen before.
    for (let i = 0; i < 40; i++) {
      await nvda.next()
    }
    const browseLog = await nvda.spokenPhraseLog()

    // Then tab through it, which is focus mode and a completely different code path. A
    // component can work in one and be broken in the other.
    await nvda.clearSpokenPhraseLog()
    for (let i = 0; i < 8; i++) {
      await nvda.press('Tab')
    }
    const focusLog = await nvda.spokenPhraseLog()

    const joined = [...browseLog, ...focusLog].join(' | ')
    const result = {
      recordedAt: new Date().toISOString(),
      nvdaVersion: typeof nvda.version === 'function' ? await nvda.version() : nvda.version,
      browserVersion: browser.version(),
      canvasFallbackReachedInBrowseMode: browseLog.join(' | ').includes(CANVAS_SENTINEL),
      siblingReachedInBrowseMode: browseLog.join(' | ').includes(SIBLING_SENTINEL),
      canvasFocusableReached: joined.includes('focusable element inside the canvas'),
      siblingFocusableReached: joined.includes('focusable element beside the canvas'),
      browseLog,
      focusLog,
    }

    const outfile = resolve(OUT_DIR, 'nvda-mount-probe.json')
    await writeFile(outfile, JSON.stringify(result, null, 2), 'utf8')

    console.log('\n--- browse mode transcript ---')
    for (const line of browseLog) console.log(line)
    console.log('\n--- focus mode transcript ---')
    for (const line of focusLog) console.log(line)
    console.log('\n--- verdict ---')
    console.log('canvas fallback reached in browse mode:', result.canvasFallbackReachedInBrowseMode)
    console.log('sibling reached in browse mode:        ', result.siblingReachedInBrowseMode)
    console.log('canvas focusable reached by Tab:       ', result.canvasFocusableReached)
    console.log('sibling focusable reached by Tab:      ', result.siblingFocusableReached)
    console.log('\nwrote', outfile)
  } finally {
    await nvda.stop().catch(() => {})
    await browser.close()
    server.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
