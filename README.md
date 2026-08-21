# @oskarasm/scene-narrator

An accessibility layer for moving 3D scenes.

A `<canvas>` contributes nothing to the browser's accessibility tree, so an interactive
WebGL scene fails WCAG 4.1.2 outright. The usual fix, a hidden DOM node per object updated
every frame, works for a static scene and falls apart for a moving one: it is slow, and
before it is slow it is unusable, because a flat list of a thousand items destroys the
heading navigation that 71.6% of screen reader users rely on.

This library groups the scene into a handful of areas, gives each one a real heading and a
spoken summary, and rewrites that summary only when the meaning of the area changes rather
than when a pixel does.

- **Live demo**: DEMO_URL_PLACEHOLDER
- **The measurements**: [SPIKE.md](SPIKE.md)
- **The full write-up**: [GUIDE.md](GUIDE.md)
- **NVDA transcripts**: [NVDA.md](NVDA.md)
- **API design and the alternatives considered**: [API.md](API.md)

Verified with NVDA on Windows. **VoiceOver and JAWS are untested.**

---

## Install

```bash
npm install @oskarasm/scene-narrator
```

`three` is a peer dependency. `react` and `@react-three/fiber` are optional peers, needed
only for the React entry point. There are no runtime dependencies.

## Use it with React Three Fiber

```tsx
import { Canvas } from '@react-three/fiber'
import { SceneNarrator, useDescribe } from '@oskarasm/scene-narrator/react'

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
import { createNarrator, describe } from '@oskarasm/scene-narrator'

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

MEASURED_TRANSCRIPT_PLACEHOLDER

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
one-node-per-object mirror of a moving scene crosses the 16.7ms frame budget between 500 and
1000 objects, and at 500 objects one frame in a hundred already takes 44ms.

PERFORMANCE_TABLE_PLACEHOLDER

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
```

MIT.
