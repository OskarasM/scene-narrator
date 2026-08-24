/**
 * How the evaluation cost scales with the number of described objects.
 *
 * The library is O(1) per frame and O(N) per evaluation, and the demo makes a
 * claim about the second half of that: that a scene of four thousand objects
 * still costs well under a millisecond at the cadence it actually runs at. The
 * numbers on the site come from here rather than from a memory of running it
 * once, and demo/src/site.ts links back to this file.
 *
 * This measures the pure path only: grouping, digesting and phrasing. It does
 * not measure the Three.js traversal in narrator.ts, because that needs a
 * scene graph, and it does not measure DOM writes, because the whole point of
 * the digest is that they do not happen. The demo measures both of those live,
 * in a browser, where they are real.
 *
 * Run: npm run build && node bench/partition.mjs
 */

import { boundsOf, partitionAuto } from '../dist/grouping.js'
import { computeDigest } from '../dist/digest.js'
import { summariseRegion } from '../dist/phrasing.js'

const COUNTS = [24, 400, 4000]
const ITERATIONS = 200
const TARGET_REGIONS = 9

// Fixed arithmetic rather than Math.random, so two runs of this file are
// comparable and a number quoted from it can be checked.
const makeMembers = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: String(i),
    descriptor: {
      label: `object ${i}`,
      role: 'particle',
      state: () => (i % 3 === 0 ? 'settled' : 'drifting'),
    },
    position: { x: ((i * 37) % 200) - 100, y: 0, z: ((i * 53) % 200) - 100 },
  }))

const eye = { x: 0, y: 40, z: 90 }
const forward = { x: 0, y: -0.4, z: -0.9 }

console.log('objects   ms per evaluation   regions')

for (const count of COUNTS) {
  const members = makeMembers(count)
  const bounds = boundsOf(members)

  // Warm the JIT, or the first size measured carries the compilation of every
  // function the other two then get for free.
  for (let i = 0; i < 20; i++) partitionAuto(members, bounds, TARGET_REGIONS)

  const started = performance.now()
  for (let i = 0; i < ITERATIONS; i++) {
    const regions = partitionAuto(members, bounds, TARGET_REGIONS)
    for (const region of regions) {
      summariseRegion(computeDigest(region, eye, forward), { units: 'metres' })
    }
  }
  const perEvaluation = (performance.now() - started) / ITERATIONS
  const regions = partitionAuto(members, bounds, TARGET_REGIONS).length

  console.log(
    `${String(count).padStart(7)}   ${perEvaluation.toFixed(3).padStart(17)}   ${String(regions).padStart(7)}`,
  )
}
