// Does the mirror actually reach the accessibility tree?
//
// Arm D mounts its mirror inside the <canvas> element as fallback content, and the pilot
// run showed it costing near zero layout time. That is either the finding of the spike or
// it is a measurement of nothing at all, and there is no way to tell from frame times.
// This asks Chromium directly, via Accessibility.getFullAXTree, whether the nodes exist
// in the tree and carry their text.
//
// Run: node bench/axtree-check.mjs

import { chromium } from 'playwright'
import { startServer } from './serve.mjs'

const N = 10
const ARMS = ['A', 'B', 'C', 'D']

const { server, port } = await startServer(0)

for (const arm of ARMS) {
  // Forced accessibility, because without it Chromium may not populate the tree at all.
  const browser = await chromium.launch({
    headless: false,
    args: ['--force-renderer-accessibility'],
  })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  const session = await context.newCDPSession(page)
  await session.send('Accessibility.enable')

  await page.goto(
    `http://127.0.0.1:${port}/bench/harness.html?arm=${arm}&n=${N}&duration=500&warmup=200`,
  )
  await page.waitForFunction('window.__benchResult !== undefined', null, { timeout: 30000 })

  const { nodes } = await session.send('Accessibility.getFullAXTree')

  const named = nodes.filter((node) => {
    const name = node.name?.value ?? ''
    return typeof name === 'string' && name.includes('Object ')
  })

  const listItems = nodes.filter((node) => node.role?.value === 'listitem')
  const canvasNodes = nodes.filter((node) => node.role?.value === 'Canvas')

  console.log(`\n--- arm ${arm} ---`)
  console.log(`total AX nodes:        ${nodes.length}`)
  console.log(`listitem nodes:        ${listItems.length}  (expected ${arm === 'A' ? 0 : N})`)
  console.log(`nodes naming an object:${String(named.length).padStart(3)}`)
  if (named.length > 0) {
    console.log(`first name:            "${named[0].name.value}"`)
    console.log(`first role:            ${named[0].role?.value}`)
    console.log(`ignored:               ${named[0].ignored}`)
  }
  if (canvasNodes.length > 0) {
    const canvasNode = canvasNodes[0]
    console.log(`canvas child count:    ${canvasNode.childIds?.length ?? 0}`)
  }

  await browser.close()
}

server.close()
