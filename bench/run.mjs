// Benchmark runner for the scene-narrator spike.
//
// Usage:
//   node bench/run.mjs                            full matrix, as documented in SPIKE.md
//   node bench/run.mjs --pilot                    quick signal check
//   node bench/run.mjs --arms A,B --n 1000 --runs 3 --browsers chromium
//
// The single most important thing this file does is run half the matrix with
// --force-renderer-accessibility. Chromium does not build a full accessibility tree
// unless assistive technology is attached to the process. A benchmark taken without
// either a screen reader running or that flag set measures a renderer that is quietly
// skipping most of the work, and will understate the cost dramatically. Both conditions
// are reported separately, never averaged together.

import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { chromium, firefox } from 'playwright'
import { startServer } from './serve.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const RESULTS_DIR = resolve(ROOT, 'bench/results')

// --- arguments ------------------------------------------------------------------------

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`)
  return idx === -1 ? fallback : process.argv[idx + 1]
}
const has = (name) => process.argv.includes(`--${name}`)

const PILOT = has('pilot')

const ARMS = arg('arms', 'A,B,C,D').split(',')
const NS = arg('n', PILOT ? '100,1000,5000' : '10,50,100,500,1000,5000')
  .split(',')
  .map(Number)
const RUNS = Number(arg('runs', PILOT ? 1 : 5))
const DURATION = Number(arg('duration', PILOT ? 5000 : 10000))
const WARMUP = Number(arg('warmup', 1000))
const BROWSERS = arg('browsers', PILOT ? 'chromium' : 'chromium,firefox').split(',')
const A11Y_MODES = arg('a11y', 'off,forced').split(',')
const SEED = Number(arg('seed', 42))

// --- environment, recorded with every result -------------------------------------------

const ENVIRONMENT = {
  os: `${os.type()} ${os.release()}`,
  platform: os.platform(),
  arch: os.arch(),
  cpu: os.cpus()[0]?.model ?? 'unknown',
  cores: os.cpus().length,
  totalMemoryGb: Math.round(os.totalmem() / 1024 ** 3),
  node: process.version,
  recordedAt: new Date().toISOString(),
}

// --- one run --------------------------------------------------------------------------

async function launch(browserName, forceAccessibility) {
  if (browserName === 'chromium') {
    const args = [
      // Headless Chromium does not expose the accessibility tree the way a real browser
      // session does, so every run here is headed. Slower, but it is the only version of
      // this measurement that means anything.
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
    ]
    if (forceAccessibility) args.push('--force-renderer-accessibility')
    return chromium.launch({ headless: false, args })
  }
  if (browserName === 'firefox') {
    // Firefox activates accessibility on demand. -1 forces it on, 1 forces it off.
    const firefoxUserPrefs = forceAccessibility ? { 'accessibility.force_disabled': -1 } : {}
    return firefox.launch({ headless: false, firefoxUserPrefs })
  }
  throw new Error(`Unsupported browser: ${browserName}`)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function readChromiumMetrics(session) {
  if (!session) return null
  const { metrics } = await session.send('Performance.getMetrics')
  const byName = Object.fromEntries(metrics.map((m) => [m.name, m.value]))
  return {
    // Chromium reports these cumulatively, in seconds.
    recalcStyleSeconds: byName.RecalcStyleDuration ?? null,
    layoutSeconds: byName.LayoutDuration ?? null,
    scriptSeconds: byName.ScriptDuration ?? null,
    jsHeapUsedBytes: byName.JSHeapUsedSize ?? null,
    nodes: byName.Nodes ?? null,
  }
}

function subtractMetrics(after, before) {
  if (!after || !before) return null
  const delta = {}
  for (const key of Object.keys(after)) {
    delta[key] = after[key] === null || before[key] === null ? null : after[key] - before[key]
  }
  return delta
}

async function runOnce({ browserName, forceAccessibility, arm, n, run, port }) {
  const browser = await launch(browserName, forceAccessibility)
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()

  let session = null
  if (browserName === 'chromium') {
    session = await context.newCDPSession(page)
    await session.send('Performance.enable')
  }

  const url =
    `http://127.0.0.1:${port}/bench/harness.html` +
    `?arm=${arm}&n=${n}&seed=${SEED}&duration=${DURATION}&warmup=${WARMUP}`

  await page.goto(url)

  // Snapshot after the warm-up window so the deltas cover the same span the harness
  // measures. Alignment is accurate to roughly one frame, which is stated rather than
  // pretended away.
  await sleep(WARMUP + 100)
  const before = await readChromiumMetrics(session)

  await page.waitForFunction('window.__benchResult !== undefined', null, {
    timeout: DURATION + 60000,
  })

  const after = await readChromiumMetrics(session)
  const result = await page.evaluate('window.__benchResult')
  const browserVersion = browser.version()

  await browser.close()

  return {
    ...result,
    run,
    browser: browserName,
    browserVersion,
    forcedAccessibility: forceAccessibility,
    rendererMetrics: subtractMetrics(after, before),
  }
}

// --- aggregation ----------------------------------------------------------------------

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function stdev(xs) {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}

function summarise(runs) {
  const fps = runs.map((r) => r.fps)
  const p95 = runs.map((r) => r.frameTimeMs.p95)
  const p99 = runs.map((r) => r.frameTimeMs.p99)
  return {
    runCount: runs.length,
    fps: { mean: mean(fps), stdev: stdev(fps), min: Math.min(...fps), max: Math.max(...fps) },
    frameTimeP50Mean: mean(runs.map((r) => r.frameTimeMs.p50)),
    frameTimeP95Mean: mean(p95),
    frameTimeP99Mean: mean(p99),
    frameTimeP95Stdev: stdev(p95),
  }
}

// --- matrix ---------------------------------------------------------------------------

const { server, port } = await startServer(0)
await mkdir(RESULTS_DIR, { recursive: true })

const rows = []
const total = BROWSERS.length * A11Y_MODES.length * ARMS.length * NS.length * RUNS
let done = 0

console.log(`environment: ${ENVIRONMENT.cpu}, ${ENVIRONMENT.cores} cores, ${ENVIRONMENT.os}`)
console.log(`matrix: ${total} runs of ${(DURATION + WARMUP) / 1000}s each\n`)

for (const browserName of BROWSERS) {
  for (const mode of A11Y_MODES) {
    const forceAccessibility = mode === 'forced'
    for (const arm of ARMS) {
      for (const n of NS) {
        const runs = []
        for (let run = 1; run <= RUNS; run++) {
          const result = await runOnce({ browserName, forceAccessibility, arm, n, run, port })
          runs.push(result)
          rows.push(result)
          done++
          process.stdout.write(
            `[${String(done).padStart(3)}/${total}] ${browserName} a11y:${mode} arm:${arm} ` +
              `n:${String(n).padStart(4)} run:${run} ` +
              `fps:${result.fps.toFixed(1)} p95:${result.frameTimeMs.p95.toFixed(1)}ms\n`,
          )
        }
        const s = summarise(runs)
        console.log(
          `        -> ${browserName} a11y:${mode} arm:${arm} n:${n} ` +
            `fps ${s.fps.mean.toFixed(1)} +/- ${s.fps.stdev.toFixed(1)}, ` +
            `p95 ${s.frameTimeP95Mean.toFixed(1)}ms\n`,
        )
      }
    }
  }
}

server.close()

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const outfile = resolve(RESULTS_DIR, `${PILOT ? 'pilot' : 'full'}-${stamp}.json`)

// Group the raw runs into one summary row per cell of the matrix.
const cells = {}
for (const row of rows) {
  const cellKey = `${row.browser}|${row.forcedAccessibility ? 'forced' : 'off'}|${row.arm}|${row.n}`
  ;(cells[cellKey] ??= []).push(row)
}

await writeFile(
  outfile,
  JSON.stringify(
    {
      environment: ENVIRONMENT,
      config: { ARMS, NS, RUNS, DURATION, WARMUP, BROWSERS, A11Y_MODES, SEED, pilot: PILOT },
      summary: Object.entries(cells).map(([cellKey, runs]) => {
        const [browser, a11y, arm, n] = cellKey.split('|')
        return { browser, a11y, arm, n: Number(n), ...summarise(runs) }
      }),
      runs: rows,
    },
    null,
    2,
  ),
  'utf8',
)

console.log(`\nwrote ${outfile}`)
