# Spike: what does mirroring a moving 3D scene into the accessibility tree actually cost?

A `<canvas>` element contributes nothing to the browser's accessibility tree. The accepted
fix is a parallel DOM that mirrors the scene, which works for a static scene. This spike
asks what it costs when the scene moves, and whether that cost is large enough to justify a
library.

**Answer: the problem is real on Chromium, it arrives earlier than expected, and where the
mirror is mounted matters more than what is in it.**

Every number in this document is the output of `node bench/analyse.mjs` against a committed
results file. Nothing here was typed by hand or estimated, and the two things this spike
could not measure are named in "What this does not tell you" rather than glossed over.

---

## Method

`bench/harness.html` renders N moving objects and, depending on the arm, mirrors them into
the DOM once per frame.

| Arm | What it does |
|---|---|
| A | Baseline. Canvas only, no accessibility layer at all. |
| B | Naive 1:1 mirror in a sibling `<div>`. One visually hidden `<li>` per object, its text rewritten every frame. |
| C | Arm B plus an `aria-label` rewritten every frame. |
| D | Arm B, but mounted inside the `<canvas>` element as fallback content. |

Arm D is not a variation for completeness. DOM children of `<canvas>` are the mechanism the
HTML specification actually provides for describing a canvas, and they are what the
`html-in-canvas` proposal builds its accessibility story on, but nobody appears to have
published what they cost when they change every frame.

Five decisions do most of the work here, and the numbers are meaningless without them.

**The scene renders through a single `InstancedMesh`.** Rendering cost is therefore flat
regardless of N. The N objects are plain JavaScript records that the accessibility arms
mirror. Any frame time difference between arms is attributable to the accessibility work
rather than to draw calls. With N separate meshes, 5000 draw calls would drown the signal.

**Half the matrix runs with `--force-renderer-accessibility`.** Chromium does not build a
full accessibility tree unless assistive technology is attached to the process. A benchmark
taken without either a screen reader running or that flag set measures a renderer that is
quietly skipping most of the work. The size of that trap is quantified below. The forced
condition is the one that represents a real screen reader user, and it is the one the
headline numbers come from.

**Every run is headed.** Headless Chromium does not expose the accessibility tree the way a
real session does. Headed runs are slower to collect and are the only version of this
measurement that means anything.

**Percentiles, not means.** Accessibility stalls are spiky. A mean hides exactly the jank a
user feels, so p95 and p99 are reported and the mean frame time is not reported at all.

**Vsync and the frame rate cap are disabled**, so the figures are frame times rather than
monitor intervals. Baseline Chromium runs at several thousand frames per second here, which
is not a claim about a real application, it is what makes sub-millisecond costs visible.

Motion advances by a fixed timestep, so the objects follow the same path whether the page
runs at 60fps or 6fps. Only the cost varies between arms, never the work being described.

### Environment

AMD Ryzen 7 5800H, 16 cores, 15GB, Windows 11 (10.0.26200), Node v24.14.1.
Chromium 151.0.7922.34, Firefox 153.0.
3 runs per cell, 6000ms measured after a 1000ms warm-up window that is discarded, seed 42.

This is one laptop. The shape of the curves should generalise; the absolute figures are for
this machine and the guide will say so wherever it quotes them.

---

## Result 1: the naive mirror falls over, and sooner than the brief assumed

Chromium, `--force-renderer-accessibility`, p95 / p99 frame time in milliseconds:

| N | A baseline | B sibling | C sibling+aria | D fallback |
|---|---|---|---|---|
| 10 | 0.3 / 0.4 | 0.7 / 1.1 | 0.7 / 1.1 | 0.4 / 0.6 |
| 50 | 0.4 / 0.5 | 1.9 / 6.2 | 2.1 / 6.7 | 0.5 / 0.8 |
| 100 | 0.4 / 0.6 | 3.7 / 11.0 | 3.4 / 12.1 | 1.0 / 1.6 |
| 200 | 0.5 / 0.7 | 6.3 / 20.3 | 7.1 / 21.1 | 1.4 / 5.3 |
| 500 | 0.6 / 0.8 | 13.8 / 44.2 | 14.6 / 44.9 | 2.7 / 8.4 |
| 1000 | 0.9 / 1.1 | 56.7 / 138.5 | 36.1 / 103.2 | 5.2 / 12.5 |
| 2000 | 1.5 / 1.9 | 90.0 / 185.5 | 128.9 / 185.0 | 9.6 / 15.3 |
| 5000 | 3.3 / 4.2 | 112.0 / 415.0 | 203.5 / 445.4 | 16.7 / 31.5 |

Budget crossings on p95, with the bracketing measurements stated because those are the
evidence and the interpolated figure is only an estimate between them:

- **B sibling** crosses the 16.7ms 60fps budget between N=500 and N=1000 (interpolated
  N~524), and the 33.3ms 30fps budget between N=500 and N=1000 (interpolated N~685).
- **C sibling+aria** crosses 16.7ms between N=500 and N=1000 (interpolated N~535), and
  33.3ms between N=500 and N=1000 (interpolated N~913).
- **A baseline** and **D fallback** never cross either budget on p95 up to N=5000, though
  arm D reaches 16.7ms exactly at N=5000, so it is at the 60fps line rather than clear of it.

The p99 column is the one worth reading. At **N=500, one frame in a hundred takes 44ms** in
the sibling arms. That is a visible hitch on a scene with fewer objects than a modest
particle system, and the p95 at that same point is still inside budget, which is precisely
why a benchmark reporting means or medians would have called this fine.

Long tasks over the 6s window tell the same story in a different currency. Chromium, forced:

| N | A baseline | B sibling | C sibling+aria | D fallback |
|---|---|---|---|---|
| 500 | 0 | 1 | 2 | 0 |
| 1000 | 0 | 10 | 13 | 0 |
| 2000 | 0 | 10 | 20 | 1 |
| 5000 | 0 | 64 | 59 | 2 |

Arm C is consistently at or slightly worse than arm B, so rewriting `aria-label` alongside
the text costs something, but it is a rounding error next to the cost of the mutation
itself. The interesting difference is not B versus C. It is B versus D.

### Run to run spread

The means above are over 3 runs. The spread, as (max - min) over the mean of p95:

| N | A baseline | B sibling | C sibling+aria | D fallback |
|---|---|---|---|---|
| 10 | 30% | 14% | 15% | 23% |
| 100 | 23% | 5% | 20% | 30% |
| 500 | 0% | 12% | 5% | 30% |
| 1000 | 0% | 95% | 2% | 27% |
| 2000 | 7% | 111% | 98% | 0% |
| 5000 | 6% | 8% | 117% | 5% |

Three runs is not many, and at the top of the range the sibling arms swing by more than
100%. This is stated rather than smoothed away: the ordering of the arms is stable across
every run, the exact millisecond figures at N>=1000 are not. Where this spike claims a
number above N=1000 it claims an order of magnitude, not a decimal place. The percentages
at small N are large fractions of very small numbers, where the timer resolution itself is
a meaningful part of the value.

---

## Result 2: the forced-accessibility trap

The same matrix, run without the flag, understates the cost badly. p95 forced divided by p95
unforced, where 1.0 would mean the flag changed nothing:

| N | A baseline | B sibling | C sibling+aria | D fallback |
|---|---|---|---|---|
| 10 | 0.83x | 1.29x | 1.33x | 1.08x |
| 100 | 1.08x | 2.06x | 1.94x | 2.00x |
| 500 | 1.20x | 1.98x | 2.00x | 2.25x |
| 1000 | 1.17x | 4.35x | 2.50x | 2.04x |
| 2000 | 1.21x | 3.63x | 4.70x | 2.18x |
| 5000 | 1.46x | 1.64x | 2.93x | 1.53x |

The baseline arm moves by up to 1.46x, which is the cost of the browser maintaining a tree
for a page that has almost nothing in it, plus noise. The mirror arms move by 2x to 4.7x.

The practical consequence: measured without the flag, the naive sibling mirror looks like it
holds 60fps to somewhere between N=1000 and N=2000 (interpolated N~1240). With the flag it
gives out between N=500 and N=1000. **A benchmark run the easy way would have reported the
cliff at roughly twice the object count where it actually is**, and would have done so on
every arm at once, so the arms would still have ranked correctly and nothing would have
looked wrong.

---

## Result 3: where the time goes, and why arm D is different

Chromium, forced. Cumulative seconds are not comparable across arms, because a faster arm
runs more frames in the same window and accumulates more of everything, so the per-frame
column is the one to read:

| N | arm | layout ms/frame | recalc style ms/frame |
|---|---|---|---|
| 10 | B | 0.128 | 0.029 |
| 10 | D | 0.000 | 0.018 |
| 100 | B | 0.910 | 0.172 |
| 100 | D | 0.000 | 0.109 |
| 500 | B | 3.717 | 0.672 |
| 500 | D | 0.000 | 0.403 |
| 1000 | B | 9.982 | 1.946 |
| 1000 | D | 0.000 | 0.727 |
| 2000 | B | 16.127 | 3.208 |
| 2000 | D | 0.000 | 1.329 |
| 5000 | B | 39.213 | 7.083 |
| 5000 | D | 0.000 | 2.010 |

**Layout time in arm D is exactly zero in every cell of the matrix**, forced and unforced,
at every N. Canvas fallback content is not rendered, so it never participates in layout.
Arm B spends 39ms per frame in layout alone at N=5000, and blows the entire 30fps budget on
layout by itself at N=2000.

Arm D is not free. It still pays style recalculation, at roughly a third of the sibling
cost, and it still pays for the DOM writes themselves. It is 6x to 12x cheaper across the
range, not free.

### Is arm D cheap because it does nothing?

That was the obvious explanation and it needed ruling out before anything was built on it.
`bench/axtree-check.mjs` asks Chromium directly, over CDP, with forced accessibility, at
N=10. Arm D produced 10 `listitem` nodes and 10 nodes whose accessible name described an
object, the first being `"Object 0 at 10.57, -7.23, 28.59"` with role `StaticText` and
`ignored: false`.

So the nodes exist in Chromium's accessibility tree and carry their text. The cost is lower
because layout is skipped, not because the content is absent.

**This is where the spike stops and a caveat starts.** Chromium's internal accessibility
tree, read over CDP, is not what NVDA receives through UI Automation. Canvas fallback
content has historically had patchy real-world screen reader support, in some engines
limited to focusable elements. Until it has been tested against NVDA on this machine, arm D
is a promising measurement and not a recommendation. The library will keep the mount point
configurable for exactly this reason, and the default will be chosen by that test rather
than by these numbers.

---

## Result 4: Firefox

FIREFOX_SECTION_PLACEHOLDER

---

## What this does not tell you

1. **Nothing here has been near a screen reader.** `--force-renderer-accessibility` is a
   proxy for assistive technology being attached. It is a good proxy, but a proxy. A run
   with NVDA actually attached is outstanding and is the next thing on the list.
2. **One machine, one GPU, one OS.** A 16-core Ryzen laptop. Lower-powered hardware will hit
   these cliffs at lower N, and no figure here should be read as a general threshold.
3. **Three runs per cell**, with the variance published above. Enough to establish the shape
   and the ordering, not enough to defend a specific millisecond at high N.
4. **The mirror is deliberately the worst reasonable implementation.** Every object, every
   frame, no diffing, no throttling. That is the strawman the library exists to beat, and it
   is a strawman I wrote, not anyone else's package. No third-party library was benchmarked
   here and none will be.
5. **The Chromium node-count metric is not a measure of mirror size.** It counts nodes the
   renderer still holds, including detached ones awaiting collection, and rewriting
   `textContent` every frame replaces a text node every frame. It is in the results file
   because it was measured, and it is not used to support any claim.
6. **No claim is made about what a real application does.** The scene here does nothing but
   move boxes. A real scene competes for the same main thread.

---

## What this means for the library

1. **The problem justifies the library.** A naive 1:1 mirror of a moving scene is below
   60fps on Chromium somewhere around 500 objects with a screen reader attached, and below
   30fps not far after. That is well inside the range of an ordinary R3F scene.
2. **Cost tracks mutations per frame, near enough linearly in N.** The design target
   follows directly: DOM mutation count must be O(regions) and bounded by a cadence,
   independent of N. That claim will be measured as a fifth arm before it appears anywhere
   public.
3. **Mount point is a real design variable, not a detail.** Canvas fallback content removes
   layout cost entirely on Chromium. Whether it is usable depends on NVDA, so the mount
   point is configurable and the default is pending that test.
4. **p99 is the metric that matters**, so the regression gate in CI will be built on it.

---

## Reproducing this

```
npm install
node bench/run.mjs --browsers chromium,firefox --n 10,50,100,200,500,1000,2000,5000 --runs 3 --duration 6000
node bench/analyse.mjs bench/results/<the file it wrote>.json
node bench/axtree-check.mjs
```

Expect roughly 25 minutes for the full matrix, and expect browser windows to open and close
several hundred times, because headed is the only honest way to run it.

Results this document draws on:

- `bench/results/full-2026-08-21T20-37-55-057Z.json`, 384 runs, Chromium and Firefox.
- FIREFOX_RESULTS_PLACEHOLDER
