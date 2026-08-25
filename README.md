<img src="demo/public/favicon.svg" alt="" width="52" height="52" />

# scene-narrator

An accessibility layer for moving 3D scenes.

[![CI](https://github.com/OskarasM/scene-narrator/actions/workflows/ci.yml/badge.svg)](https://github.com/OskarasM/scene-narrator/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/scene-narrator)](https://www.npmjs.com/package/scene-narrator)
[![licence](https://img.shields.io/badge/licence-MIT-a4531c)](LICENSE)

A `<canvas>` contributes nothing to the browser's accessibility tree, so an interactive
WebGL scene fails WCAG 4.1.2 outright. The usual fix, a hidden DOM node per object updated
every frame, works for a static scene and falls apart for a moving one: it is slow, and
before it is slow it is unusable, because a flat list of a thousand items destroys the
heading navigation that 71.6% of screen reader users rely on.

This library groups the scene into a handful of areas, gives each one a real heading and a
spoken summary, and rewrites that summary only when the meaning of the area changes rather
than when a pixel does.

- **Live demo**: <https://scene-narrator-demo.vercel.app/>. Three scenes, live controls, and
  a running transcript of every sentence the library writes. Built from `demo/` on every
  push to main, so it is always the commit above.
- **The measurements**: [SPIKE.md](SPIKE.md)
- **The full write-up**: [GUIDE.md](GUIDE.md)
- **NVDA transcripts**: [NVDA.md](NVDA.md)
- **API design and the alternatives considered**: [API.md](API.md)

Verified with NVDA on Windows. **VoiceOver and JAWS are untested.**

### What the demo is for

Three scenes, because one scene only makes one argument.

| Scene | Objects | Regions | What it shows |
|---|---|---|---|
| Delivery yard | 24 | automatic | Continuous motion with real structure to group by. The shape this was designed against. |
| Product configurator | 6 | author-defined | The case an audit turns up, where speed is not the problem and telling the user what they selected is. |
| Particle field | 4,000 | automatic | Eight times the object count at which the spike measured a per-object mirror crossing the frame budget. |

Cadence, target region count and the scene are live controls passing the same arguments an
application passes to `createNarrator`. The cost readouts are counted off the running
narrator once a second, and the sixty-second series downloads as JSON or CSV.

---

## Install

```bash
npm install scene-narrator
```

`three` is a peer dependency. `react` and `@react-three/fiber` are optional peers, needed
only for the React entry point. There are no runtime dependencies.

## Use it with React Three Fiber

```tsx
import { Canvas } from '@react-three/fiber'
import { SceneNarrator, useDescribe } from 'scene-narrator/react'

function Van({ van }) {
  const ref = useRef<Mesh>(null)
  useDescribe(ref, {
    label: van.name,
    role: 'van',
    state: () => (van.moving ? 'moving' : 'parked'),
  })
  return <mesh ref={ref} position={van.position}>{/* ... */}</mesh>
}

export default function App() {
  return (
    <Canvas>
      <SceneNarrator label="Delivery yard" />
      {vans.map((van) => <Van key={van.id} van={van} />)}
    </Canvas>
  )
}
```

That is the whole integration. `<SceneNarrator>` reads the scene, camera and canvas out of
R3F's store, and drives itself from `useFrame`.

## Use it with plain Three.js

```js
import { createNarrator, describe } from 'scene-narrator'

describe(van, { label: 'Delivery van', role: 'vehicle' })

const narrator = createNarrator(scene, {
  camera,
  mount: renderer.domElement,
  label: 'Delivery yard',
})

function animate() {
  requestAnimationFrame(animate)
  // ... your own updates ...
  narrator.update()
  renderer.render(scene, camera)
}
```

`narrator.update()` is called from your loop rather than the library installing its own
`requestAnimationFrame`. A library that starts its own render loop keeps running after your
scene is torn down, and hides its cost from the profiler by attributing it to a callback
nobody wrote.

## Announcing things the library cannot infer

```js
narrator.announce('Van 3 has been dispatched')
narrator.announce('Collision', { assertive: true })
```

Polite messages coalesce: fifty of them in one frame produce one announcement, not fifty.
Assertive messages interrupt whatever the user is listening to, so nothing the library
infers by itself is ever assertive. That is a decision only you can make.

## Author your own regions

Automatic grouping is a spatial grid. It is a reasonable default and it knows nothing about
what your scene means. If your scene has real structure, say so:

```js
createNarrator(scene, {
  camera,
  mount: canvas,
  regions: [
    { id: 'yard', heading: 'Loading yard', min: {x:-20,y:-5,z:-20}, max: {x:20,y:15,z:0} },
    { id: 'road', heading: 'Access road',  min: {x:-20,y:-5,z:0},   max: {x:20,y:15,z:40} },
  ],
})
```

Objects outside every region are collected into a trailing "Elsewhere in the scene" region
rather than dropped, because an object silently missing from the accessibility tree is the
failure this library exists to prevent.

## Options

| Option | Default | What it does |
|---|---|---|
| `camera` | required | Bearings and distances are relative to this. |
| `mount` | required | Where the accessibility DOM goes. Pass the canvas itself to use canvas fallback content. |
| `label` | `'3D scene'` | Accessible name for the scene as a whole. |
| `headingLevel` | `2` | Scene heading level. Areas use one below. Pick what fits your page. |
| `regions` | `'auto'` | `'auto'` for a spatial grid, or an array of definitions. |
| `autoRegions` | `6` | Target number of automatic areas. Empty cells are dropped, so it is a target. |
| `cadence` | `250` | Minimum milliseconds between evaluations. |
| `onFocusRegion` | none | Fires when the user focuses an area, so your camera can follow. |

## What the user gets

NVDA 2026.1.1 reading the demo, copied out of `bench/results/nvda-demo.json`:

```
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
```

Areas are real headings, so the H key works. Contents are summarised rather than enumerated.
Direction is in words somebody can act on, never coordinates. Events go through a polite live
region that coalesces, so fifty things happening at once is one announcement.

**One thing to handle yourself:** the element holding focus is inside the canvas and visually
hidden, so it cannot carry a focus ring. Use `onFocusRegion` to show focus somewhere a
sighted keyboard user can see it. [NVDA.md](NVDA.md) explains why.

## Keyboard

| Key | Action |
|---|---|
| Tab | Enter the scene |
| Arrow keys | Move between areas |
| Enter or Space | Open an area and list the objects in it |
| Escape | Close it |

Nothing essential is arrow-key-only. In a screen reader's browse mode the arrow keys belong
to the screen reader, so the areas are real headings and heading navigation works there
without the library being involved at all.

---

## Performance

The problem is real and it arrives early. On Chromium with a screen reader attached, a naive
one-node-per-object mirror of a moving scene crosses the 16.7ms frame budget somewhere
between 300 and 500 objects, and by 500 objects one frame in a hundred takes 59ms.

(Two full matrices were run on this machine, and they put that crossing at an interpolated
300 and 520 objects respectively. Both are in `bench/results/`. The range is the honest
answer; a single number would not be.)

Chromium with a screen reader attached, p95 / p99 frame time in milliseconds. The naive
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
seconds each, headed, with `--force-renderer-accessibility`.

Full method, hardware, variance and the trap that makes most benchmarks of this wrong are in
[SPIKE.md](SPIKE.md). Every figure traces to a committed file in `bench/results/`.

## Limits

- **NVDA on Windows only.** VoiceOver and JAWS are untested, not "should work".
- Measured on one machine. Lower-powered hardware hits these thresholds sooner.
- The library cannot invent semantics. Without labels you get "5 objects", because that is
  genuinely all the information available.
- Automatic region bounds are computed once and kept, so a scene that expands a long way
  over its lifetime should supply explicit regions.

## Relationship to `@react-three/a11y`

Different problem, and worth using together. `@react-three/a11y` maps discrete interactive
elements onto real DOM equivalents with focus, hover and click, and does no per-frame work
at all by design. If your scene is a configurator with eight clickable hotspots, that is the
package you want. This one describes the scene those hotspots sit in.
[GUIDE.md](GUIDE.md) has the detail.

## Development

```bash
npm install
npm test              # unit tests plus virtual screen reader assertions
npm run typecheck
npm run build
npm run check:prose
npm run bench         # headed, about 25 minutes

npm run check:fonts   # the demo's self-hosted faces, against a 150 kB ceiling
npm run bench:partition  # grouping and phrasing cost at 24, 400 and 4,000 objects

# Real browser, real accessibility tree, real key presses, plus axe.
cd demo && npm install && npm run build && cd ..
node bench/demo-check.mjs                                        # the local build
node bench/demo-check.mjs https://scene-narrator-demo.vercel.app/    # what is deployed

# The site suite: axe at WCAG 2 A and AA, the skip link, 44px targets at 375px,
# no horizontal overflow at four widths, the typefaces actually loading, and the
# page holding its layout with no WebGL context at all. Three engines.
cd demo && npx playwright install chromium firefox webkit && npm run test:browser
```

[CONTRIBUTING.md](CONTRIBUTING.md) has the rules that matter: what a change to the
accessibility tree has to prove, and why no number goes in a document without a committed
script behind it.

MIT.
