/**
 * Does NVDA reach canvas fallback content?
 *
 * This is the one question the library's default mount point depends on, and Chromium's
 * internal accessibility tree cannot answer it. CDP will happily show you an AXObject tree
 * containing the fallback nodes; NVDA reads through UI Automation, which is a different
 * thing, and canvas fallback content has historically had patchy support there, in places
 * limited to focusable elements.
 *
 * The page below puts identical content in two places, inside the canvas and beside it,
 * with distinct sentinel phrases. If NVDA speaks a sentinel, it reached that mount point.
 *
 * Run: npx playwright test --config playwright.config.ts
 * Requires: Windows, and `npx @guidepup/setup install nvda`.
 *
 * NVDA speaks out loud throughout. Do not touch the keyboard while it runs: NVDA reads
 * whichever window has focus, and stealing focus produces a transcript of your email.
 */

import { nvdaTest } from '@guidepup/playwright'
import { expect } from '@playwright/test'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

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
    <button id="canvas-focusable" type="button">Button inside the canvas</button>
  </div>
</canvas>
<div id="beside-canvas" class="sr-only">
  <h2>Beside the canvas</h2>
  <p>${SIBLING_SENTINEL}</p>
  <button id="sibling-focusable" type="button">Button beside the canvas</button>
</div>
<p>End of probe.</p>
</body>
</html>`

nvdaTest('canvas fallback content versus a sibling div', async ({ page, nvda }) => {
  await page.route('**/probe', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE }),
  )
  await page.goto('http://localhost/probe', { waitUntil: 'domcontentloaded' })

  // Puts NVDA in browse mode, brings the browser genuinely to the front at the OS level,
  // and moves the reading cursor to the top of the document.
  await nvda.navigateToWebContent()

  // Read the whole document top to bottom, which is how somebody meets a page for the
  // first time.
  for (let i = 0; i < 25; i++) await nvda.next()
  const browseLog = await nvda.spokenPhraseLog()

  // Then tab through it. Focus mode is a completely different code path and a component can
  // pass one and fail the other.
  await nvda.clearSpokenPhraseLog()
  for (let i = 0; i < 6; i++) await nvda.press('Tab')
  const focusLog = await nvda.spokenPhraseLog()

  const browse = browseLog.join(' | ')
  const everything = [...browseLog, ...focusLog].join(' | ')

  const result = {
    recordedAt: new Date().toISOString(),
    canvasFallbackReachedInBrowseMode: browse.includes(CANVAS_SENTINEL),
    siblingReachedInBrowseMode: browse.includes(SIBLING_SENTINEL),
    canvasButtonReached: everything.includes('Button inside the canvas'),
    siblingButtonReached: everything.includes('Button beside the canvas'),
    browseLog,
    focusLog,
  }

  await mkdir(resolve('bench/results'), { recursive: true })
  await writeFile(
    resolve('bench/results/nvda-mount-probe.json'),
    JSON.stringify(result, null, 2),
    'utf8',
  )

  console.log('\n--- browse mode ---')
  for (const line of browseLog) console.log(line)
  console.log('\n--- focus mode ---')
  for (const line of focusLog) console.log(line)
  console.log('\n--- verdict ---')
  console.log(JSON.stringify(result, null, 2).split('\n').slice(1, 7).join('\n'))

  // The sibling case is the control. If this fails, the harness is broken and the canvas
  // result means nothing either way, so it is asserted first and separately.
  expect(
    result.siblingReachedInBrowseMode,
    'control failed: NVDA did not reach ordinary sibling content, so this run says nothing about the canvas',
  ).toBe(true)
})
