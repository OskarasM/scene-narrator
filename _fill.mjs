// One-shot: replace the deliberate PLACEHOLDER tokens in the documents with figures read
// from the committed results. Deleted immediately after running.
import { readFileSync, writeFileSync } from 'node:fs'

const ARM_E = `The strawman is one thing. What does this library actually cost?

Arm E is \`@oskarasm/scene-narrator\` at its default 250ms cadence, mounted as canvas fallback
content, measured on the same harness, the same hardware and the same run as the naive
mirror it is being compared against. Chromium, \`--force-renderer-accessibility\`, p95 / p99
frame time in milliseconds:

| N | baseline | naive mirror | scene-narrator |
|---|---|---|---|
| 10 | 0.3 / 0.4 | 0.9 / 1.7 | 0.3 / 0.4 |
| 100 | 0.4 / 0.5 | 3.1 / 8.5 | 0.4 / 0.5 |
| 500 | 0.6 / 0.8 | 27.9 / 59.1 | 0.7 / 1.0 |
| 1000 | 0.8 / 1.1 | 40.6 / 87.3 | 1.2 / 1.5 |
| 2000 | 1.3 / 1.7 | 138.4 / 168.6 | 2.1 / 2.6 |
| 5000 | 2.0 / 2.4 | 404.9 / 489.6 | 5.0 / 9.2 |

The naive mirror crosses the 16.7ms budget between N=200 and N=500 (interpolated N~304) in
this run. The library never crosses it up to N=5000, and neither does the empty-canvas
baseline.

At 5000 objects the library sits at 5.0ms p95 against a 2.0ms baseline that is drawing the
same scene with no accessibility layer at all. So the accessibility work costs about 3ms per
frame at 5000 described objects: 81 times less than the naive mirror on p95, and still
inside a 60fps budget by a factor of three.

Chromium's own counters say why:

| N | naive layout ms/frame | scene-narrator layout ms/frame | naive recalc ms/frame | scene-narrator recalc ms/frame |
|---|---|---|---|---|
| 500 | 4.726 | 0.000 | 0.890 | 0.000 |
| 1000 | 6.681 | 0.000 | 1.280 | 0.000 |
| 2000 | 13.856 | 0.000 | 2.659 | 0.000 |
| 5000 | 39.148 | 0.000 | 7.048 | 0.000 |

Zero layout and zero style recalculation per frame, at every object count measured. Not
small: zero, to the resolution of Chromium's counters. The library is not doing cheap DOM
work, it is mostly not doing DOM work at all.

The node count tells the same story from the other end. Chromium's count of nodes the
renderer is holding at the end of the measurement window:

| N | naive mirror | scene-narrator |
|---|---|---|
| 100 | 5,008 | 96 |
| 500 | 8,243 | 86 |
| 1000 | 14,500 | 86 |
| 2000 | 30,908 | 87 |
| 5000 | 33,132 | 92 |

**Between 85 and 129 nodes, flat, from 10 objects to 5,000.** That is the design claim made
concrete: the accessibility tree is a function of how many areas the scene has, not of how
many objects are in it. Individual objects appear only when a user opens an area.

Long tasks over the six second window: **zero at every object count**, against 60 for the
naive mirror at N=5000.

One more figure, taken from \`test/narrator.test.ts\` rather than the browser because it can be
counted exactly there. Over 300 frames of continuous motion, DOM mutations:

| N | naive equivalent | scene-narrator |
|---|---|---|
| 50 | 15,000 | 113 |
| 500 | 150,000 | 143 |
| 5000 | 1,500,000 | 143 |

Identical at 500 and at 5,000. That is what "O(regions), not O(objects)" means, and it is
asserted in the test suite so that it cannot regress quietly.`

const NVDA_SECTION = `Everything above is about milliseconds. This section is about whether the thing works, which
is a different question and the one that matters.

NVDA 2026.1.1 on Windows 11, driving Chrome for Testing 151. Reading the demo from the top,
verbatim from \`bench/results/nvda-demo.json\`:

\`\`\`
main landmark, clickable, region, heading, level 2, Delivery yard
Areas of the scene are listed as headings. Move to an area and press Enter to hear what is
  in it.
grouping, heading, level 3, The north-west of the scene
6 vans, mostly parked, ahead, far away, including Van 1
out of grouping, grouping, heading, level 3, The south-west of the scene
7 vans, mostly moving, ahead and to your left, some distance away
out of grouping, grouping, heading, level 3, The north-east of the scene
5 vans, mostly moving, ahead, far away
out of grouping, grouping, heading, level 3, The south-east of the scene
5 vans, mostly moving, ahead and to your right, some distance away
out of grouping, Van 1 has been dispatched
\`\`\`

A canvas that would otherwise be one unlabelled graphic is a named region containing four
named areas, each summarised by what is in it, roughly where it is, and what it is doing.
\`Van 1 has been dispatched\` is the live region firing while the user reads, without
interrupting them.

Pressing H, which is what 71.6% of screen reader users do:

\`\`\`
Delivery yard, region, Delivery yard, heading, level 2
The north-west of the scene, grouping, The north-west of the scene, heading, level 3
The south-west of the scene, grouping, The south-west of the scene, heading, level 3
The north-east of the scene, grouping, The north-east of the scene, heading, level 3
The south-east of the scene, grouping, The south-east of the scene, heading, level 3
no next heading
\`\`\`

### NVDA does reach canvas fallback content

The mount point decision rested on this, and Chromium's internal accessibility tree could not
answer it: CDP will show you an AXObject tree containing fallback nodes, but NVDA reads
through UI Automation, which is a different thing.

A probe page with identical content inside a \`<canvas>\` and beside it, read with NVDA:

| | Browse mode | Reached by Tab |
|---|---|---|
| Inside the \`<canvas>\` | yes | yes |
| Beside the \`<canvas>\` (control) | yes | yes |

The sibling half is a control, so a broken harness fails loudly rather than producing a
misleading negative. The canvas half is slightly noisier: extra \`blank\` announcements, and a
button announced as \`, button, Button inside the canvas,\` where the sibling gave the clean
\`button, Button beside the canvas\`.

### A consequence of the canvas mount point that is easy to miss

The element holding keyboard focus is inside the canvas and visually hidden, so it can never
show a focus ring. CSS \`:has(:focus-visible)\` does not rescue it either, because canvas
fallback content is not rendered and so never matches. **A sighted keyboard user gets no
focus indication at all**, which is a WCAG 2.4.7 failure hiding inside an accessibility fix.

That is what \`onFocusRegion\` is for. The demo outlines the viewport from it, and a real
application should also highlight the focused region in the 3D scene. This was found by a
Playwright check that presses real keys, after unit tests dispatching synthetic events in
jsdom had passed happily.

Full transcripts, including focus mode and what is imperfect in each, are in
[NVDA.md](NVDA.md).`

const DEMO = 'not deployed yet. Clone the repo, then `cd demo && npm install && npm run build && npx vite preview`'

const PERF = `Chromium with a screen reader attached, p95 / p99 frame time in milliseconds. The naive
mirror is one hidden node per object rewritten every frame; scene-narrator is this library at
its default 250ms cadence. Both measured on the same harness, hardware and run.

| Objects | empty canvas | naive mirror | scene-narrator |
|---|---|---|---|
| 500 | 0.6 / 0.8 | 27.9 / 59.1 | **0.7 / 1.0** |
| 1000 | 0.8 / 1.1 | 40.6 / 87.3 | **1.2 / 1.5** |
| 2000 | 1.3 / 1.7 | 138.4 / 168.6 | **2.1 / 2.6** |
| 5000 | 2.0 / 2.4 | 404.9 / 489.6 | **5.0 / 9.2** |

The naive mirror crosses the 60fps budget at around 300 objects. This library does not cross
it at 5,000, and Chromium reports **zero layout time and zero style recalculation per frame**
at every object count measured, with zero long tasks.

The accessibility tree stays between 85 and 129 DOM nodes whether the scene holds 10 objects
or 5,000, because areas are the unit and individual objects appear only when a user opens
one.

AMD Ryzen 7 5800H, 16 cores, Windows 11, Chromium 151.0.7922.34. Three runs per cell, six
seconds each, headed, with \`--force-renderer-accessibility\`.`

const TRANSCRIPT = `NVDA 2026.1.1 reading the demo, copied out of \`bench/results/nvda-demo.json\`:

\`\`\`
main landmark, clickable, region, heading, level 2, Delivery yard
Areas of the scene are listed as headings. Move to an area and press Enter to hear what is
  in it.
grouping, heading, level 3, The north-west of the scene
6 vans, mostly parked, ahead, far away, including Van 1
out of grouping, grouping, heading, level 3, The south-west of the scene
7 vans, mostly moving, ahead and to your left, some distance away
out of grouping, grouping, heading, level 3, The north-east of the scene
5 vans, mostly moving, ahead, far away
out of grouping, Van 1 has been dispatched
\`\`\`

Areas are real headings, so the H key works. Contents are summarised rather than enumerated.
Direction is in words somebody can act on, never coordinates. Events go through a polite live
region that coalesces, so fifty things happening at once is one announcement.

**One thing to handle yourself:** the element holding focus is inside the canvas and visually
hidden, so it cannot carry a focus ring. Use \`onFocusRegion\` to show focus somewhere a
sighted keyboard user can see it. [NVDA.md](NVDA.md) explains why.`

const SPIKE_E = `

---

## Result 5: what the library built from this actually costs

The spike above justified building something. A fifth arm, added after the library existed,
measures it on the same harness so the comparison is a measurement rather than a story.

Chromium, forced accessibility, p95 / p99 frame time in milliseconds, from
\`bench/results/full-2026-08-22T00-34-52-693Z.json\`:

| N | A baseline | B sibling | D fallback | E scene-narrator |
|---|---|---|---|---|
| 100 | 0.4 / 0.5 | 3.1 / 8.5 | 0.6 / 0.9 | 0.4 / 0.5 |
| 500 | 0.6 / 0.8 | 27.9 / 59.1 | 1.7 / 6.5 | 0.7 / 1.0 |
| 1000 | 0.8 / 1.1 | 40.6 / 87.3 | 3.2 / 13.6 | 1.2 / 1.5 |
| 2000 | 1.3 / 1.7 | 138.4 / 168.6 | 8.5 / 37.8 | 2.1 / 2.6 |
| 5000 | 2.0 / 2.4 | 404.9 / 489.6 | 14.9 / 47.2 | 5.0 / 9.2 |

Arm E never crosses the 60fps budget up to N=5000. Its layout time and style recalculation
time are 0.000 ms/frame in every cell, it produces zero long tasks at every N, and the
renderer holds between 85 and 129 DOM nodes for it regardless of object count.

One incidental confirmation: the forced-accessibility flag changes arm E's p95 by 0.75x to
1.10x, which is noise, where it changes the naive mirror's by up to 5.91x. A layer that
barely touches the accessibility tree is barely affected by whether the browser is
maintaining one. That is the mechanism working exactly as designed, seen from a third angle.

Note on provenance: this matrix was run after the library was written, so it is a separate
file from the four-arm spike above and its arm A, B and D figures differ slightly from the
earlier run. That is run-to-run variation on the same machine, and it is why arm E is
compared against the arms measured beside it rather than against the earlier numbers.`

function fill(path, pairs) {
  let s = readFileSync(path, 'utf8')
  for (const [token, value] of pairs) {
    if (!s.includes(token)) throw new Error(`${path}: token ${token} not found`)
    s = s.split(token).join(value)
  }
  writeFileSync(path, s, 'utf8')
  console.log('filled', path)
}

fill('GUIDE.md', [
  ['ARM_E_SECTION_PLACEHOLDER', ARM_E],
  ['NVDA_SECTION_PLACEHOLDER', NVDA_SECTION],
  ['DEMO_URL_PLACEHOLDER', DEMO],
])

fill('README.md', [
  ['PERFORMANCE_TABLE_PLACEHOLDER', PERF],
  ['MEASURED_TRANSCRIPT_PLACEHOLDER', TRANSCRIPT],
  ['DEMO_URL_PLACEHOLDER', DEMO],
])

// SPIKE.md has no tokens left; arm E is appended as a new result section.
{
  let s = readFileSync('SPIKE.md', 'utf8')
  const anchor = '\n---\n\n## What this does not tell you'
  if (!s.includes(anchor)) throw new Error('SPIKE.md: anchor not found')
  s = s.replace(anchor, SPIKE_E + anchor)
  writeFileSync('SPIKE.md', s, 'utf8')
  console.log('filled SPIKE.md')
}
