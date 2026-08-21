// Turns a raw results file into the tables that appear in SPIKE.md.
//
// This exists so that no number in SPIKE.md is typed by hand. Every table in that
// document is the stdout of this script against a committed results file, which means
// anyone can rerun it and get the same figures, or catch me getting them wrong.
//
// Usage: node bench/analyse.mjs bench/results/full-<stamp>.json

import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('usage: node bench/analyse.mjs <results.json>')
  process.exit(1)
}

const data = JSON.parse(readFileSync(file, 'utf8'))
const { environment, config, runs } = data

const ARM_LABEL = {
  A: 'A baseline',
  B: 'B sibling',
  C: 'C sibling+aria',
  D: 'D fallback',
  E: 'E scene-narrator',
}

// 60fps and 30fps budgets. A frame that takes longer than these has missed its slot.
const BUDGET_60 = 16.7
const BUDGET_30 = 33.3

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const stdev = (xs) => {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}

// Runs the runner flagged as stopped rather than slow. Excluded from every figure below
// and counted separately, because quietly averaging them in would invent a cost.
const suspect = runs.filter((r) => r.suspect)

function cellsFor(browser, a11y) {
  const out = new Map()
  for (const r of runs) {
    if (r.suspect) continue
    if (r.browser !== browser) continue
    if ((r.forcedAccessibility ? 'forced' : 'off') !== a11y) continue
    const key = arm_key(r.arm, r.n)
    if (!out.has(key)) out.set(key, [])
    out.get(key).push(r)
  }
  return out
}

function arm_key(arm, n) {
  return arm + '|' + n
}

function stat(cell, pick) {
  if (!cell || cell.length === 0) return null
  return mean(cell.map(pick))
}

function fmt(x, dp = 1) {
  return x === null || x === undefined ? '-' : x.toFixed(dp)
}

// Where does this arm first miss the budget, and can we say anything about between?
// The measured points are the only evidence, so the bracket is reported literally. The
// interpolated figure is log-linear between the two bracketing points and is labelled as
// an estimate everywhere it is used.
function crossing(points, budget) {
  const sorted = points.slice().sort((a, b) => a.n - b.n)
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].value < budget) continue
    if (i === 0) return { below: null, above: sorted[0].n, estimate: null }
    const lo = sorted[i - 1]
    const hi = sorted[i]
    const t = (budget - lo.value) / (hi.value - lo.value)
    const estimate = Math.exp(Math.log(lo.n) + t * (Math.log(hi.n) - Math.log(lo.n)))
    return { below: lo.n, above: hi.n, estimate }
  }
  return { below: sorted[sorted.length - 1].n, above: null, estimate: null }
}

function header(arms) {
  return (
    '| N | ' +
    arms.map((a) => ARM_LABEL[a]).join(' | ') +
    ' |\n|---|' +
    arms.map(() => '---').join('|') +
    '|'
  )
}

function table(browser, a11y) {
  const cells = cellsFor(browser, a11y)
  const arms = config.ARMS.filter((arm) => config.NS.some((n) => cells.has(arm_key(arm, n))))
  if (arms.length === 0) return

  console.log('\n### ' + browser + ', accessibility ' + a11y)
  console.log('\np95 / p99 frame time in ms, mean of ' + config.RUNS + ' runs\n')
  console.log(header(arms))
  for (const n of config.NS) {
    const cols = arms.map((arm) => {
      const cell = cells.get(arm_key(arm, n))
      const p95 = stat(cell, (r) => r.frameTimeMs.p95)
      const p99 = stat(cell, (r) => r.frameTimeMs.p99)
      return fmt(p95) + ' / ' + fmt(p99)
    })
    console.log('| ' + n + ' | ' + cols.join(' | ') + ' |')
  }

  console.log('\nfps mean +/- stdev across runs\n')
  console.log(header(arms))
  for (const n of config.NS) {
    const cols = arms.map((arm) => {
      const cell = cells.get(arm_key(arm, n))
      if (!cell) return '-'
      const fps = cell.map((r) => r.fps)
      return fmt(mean(fps)) + ' +/- ' + fmt(stdev(fps))
    })
    console.log('| ' + n + ' | ' + cols.join(' | ') + ' |')
  }

  // Run to run spread on the headline metric, so nobody has to take the means on trust.
  console.log('\np95 spread across runs, (max - min) as a percentage of the mean\n')
  console.log(header(arms))
  for (const n of config.NS) {
    const cols = arms.map((arm) => {
      const cell = cells.get(arm_key(arm, n))
      if (!cell) return '-'
      const p95 = cell.map((r) => r.frameTimeMs.p95)
      const m = mean(p95)
      if (m === 0) return '0'
      return fmt(((Math.max(...p95) - Math.min(...p95)) / m) * 100, 0) + '%'
    })
    console.log('| ' + n + ' | ' + cols.join(' | ') + ' |')
  }

  console.log('\nbudget crossings, p95\n')
  for (const arm of arms) {
    const points = config.NS.map((n) => ({
      n,
      value: stat(cells.get(arm_key(arm, n)), (r) => r.frameTimeMs.p95) ?? 0,
    }))
    const lines = []
    for (const [budget, label] of [
      [BUDGET_60, '16.7ms (60fps)'],
      [BUDGET_30, '33.3ms (30fps)'],
    ]) {
      const c = crossing(points, budget)
      if (c.above === null) lines.push('never crosses ' + label + ' up to N=' + c.below)
      else if (c.below === null)
        lines.push('already over ' + label + ' at the smallest N tested (' + c.above + ')')
      else
        lines.push(
          'crosses ' +
            label +
            ' between N=' +
            c.below +
            ' and N=' +
            c.above +
            ' (interpolated N~' +
            Math.round(c.estimate) +
            ')',
        )
    }
    console.log('- ' + ARM_LABEL[arm] + ': ' + lines.join('; '))
  }

  if (browser === 'chromium') {
    console.log('\nrenderer cost over the ' + config.DURATION / 1000 + 's window, mean of runs\n')
    // The node column is Chromium's Nodes gauge, which counts nodes still held by the
    // renderer including detached ones the collector has not got to yet. Rewriting
    // textContent every frame replaces a text node every frame, so this reads as churn
    // awaiting collection, not as the size of the mirror. Reported because it was
    // measured, not because it is a good measure of mirror size.
    // Cumulative seconds are not comparable across arms, because a fast arm runs far more
    // frames in the same window and accumulates more of everything. Per frame is the only
    // fair comparison, so both are shown and the per frame figure is the one to read.
    console.log('| N | arm | layout s | layout ms/frame | recalc ms/frame | nodes held |')
    console.log('|---|---|---|---|---|---|')
    for (const n of config.NS) {
      for (const arm of arms) {
        const cell = cells.get(arm_key(arm, n))
        if (!cell) continue
        const perFrame = (pick) => mean(cell.map((r) => (pick(r) * 1000) / r.frames))
        console.log(
          '| ' +
            n +
            ' | ' +
            arm +
            ' | ' +
            fmt(stat(cell, (r) => r.rendererMetrics.layoutSeconds), 3) +
            ' | ' +
            fmt(perFrame((r) => r.rendererMetrics.layoutSeconds), 3) +
            ' | ' +
            fmt(perFrame((r) => r.rendererMetrics.recalcStyleSeconds), 3) +
            ' | ' +
            fmt(stat(cell, (r) => r.rendererMetrics.nodesAtEnd), 0) +
            ' |',
        )
      }
    }
  }
}

function forcedVsOff(browser) {
  const off = cellsFor(browser, 'off')
  const forced = cellsFor(browser, 'forced')
  console.log('\n### ' + browser + ': what forcing renderer accessibility changes')
  console.log('\np95 forced divided by p95 unforced. 1.0 means the flag made no difference.\n')
  console.log(header(config.ARMS))
  for (const n of config.NS) {
    const cols = config.ARMS.map((arm) => {
      const o = stat(off.get(arm_key(arm, n)), (r) => r.frameTimeMs.p95)
      const f = stat(forced.get(arm_key(arm, n)), (r) => r.frameTimeMs.p95)
      if (o === null || f === null || o === 0) return '-'
      return fmt(f / o, 2) + 'x'
    })
    console.log('| ' + n + ' | ' + cols.join(' | ') + ' |')
  }
}

console.log('# Analysis of ' + file)
console.log(
  '\nEnvironment: ' +
    environment.cpu.trim() +
    ', ' +
    environment.cores +
    ' cores, ' +
    environment.totalMemoryGb +
    'GB, ' +
    environment.os +
    ', Node ' +
    environment.node +
    '.',
)
const versions = [...new Set(runs.map((r) => r.browser + ' ' + r.browserVersion))]
console.log('Browsers: ' + versions.join(', ') + '.')
console.log(
  'Config: ' +
    config.RUNS +
    ' runs per cell, ' +
    config.DURATION +
    'ms measured after ' +
    config.WARMUP +
    'ms warm-up, seed ' +
    config.SEED +
    ', ' +
    runs.length +
    ' runs total.',
)
if (suspect.length > 0) {
  console.log(
    '\n**' +
      suspect.length +
      ' of ' +
      runs.length +
      ' runs were flagged as stopped rather than slow and are excluded from every figure ' +
      'below.** They are still in the results file. Affected cells: ' +
      [...new Set(suspect.map((r) => r.browser + ' arm ' + r.arm + ' n=' + r.n))].join(', ') +
      '.',
  )
} else {
  console.log('\nNo run was flagged as stopped rather than slow.')
}

for (const browser of config.BROWSERS) {
  for (const a11y of config.A11Y_MODES) table(browser, a11y)
  forcedVsOff(browser)
}

// Firefox reports no long task entries, so the two browsers are not comparable on that
// metric and it is reported per browser rather than side by side.
console.log('\n### long tasks over the measurement window, mean count')
for (const browser of config.BROWSERS) {
  const sample = runs.find((r) => r.browser === browser)
  if (!sample || !sample.longTasks) {
    console.log('\n' + browser + ': longtask entries not implemented, absent rather than zero.')
    continue
  }
  console.log('\n' + browser + ', forced accessibility\n')
  const cells = cellsFor(browser, 'forced')
  console.log(header(config.ARMS))
  for (const n of config.NS) {
    const cols = config.ARMS.map((arm) => {
      const cell = cells.get(arm_key(arm, n))
      if (!cell || !cell[0].longTasks) return '-'
      return fmt(mean(cell.map((r) => r.longTasks.count)), 0)
    })
    console.log('| ' + n + ' | ' + cols.join(' | ') + ' |')
  }
}
