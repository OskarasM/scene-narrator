# API design

Written before the implementation, per the plan. The README usage section was drafted
alongside it, and where the README read badly the API changed rather than the prose.

## Prior art, read in source rather than taken from a table

Three packages exist in this space. None of them handles a moving scene, and understanding
why is most of the design.

**`@react-three/a11y` v3.0.0** (published 2022-05-15, nothing since; depends on `zustand@^3`
where the current major is 5). `A11ySection` appends a `<section>` to
`gl.domElement.parentNode`, so a canvas sibling. `A11yAnnouncer` is a single visually hidden
`aria-live="polite"` div fed by a one-slot store. Grepping its entire source for
`useFrame|requestAnimationFrame|setInterval|throttle|debounce` returns zero matches: it does
no per-frame work at all, by design. It maps discrete interactive elements onto DOM
equivalents and does that well. It is not a competitor and this project does not treat it as
one.

**`@babylonjs/accessibility` v9.22.1**, the HTML twin, is the most interesting of the three.
Its entry point is one line:

```js
const root = createRoot(scene.getEngine().getRenderingCanvas())
root.render(htmlTwinHost)
```

It mounts a React root **directly into the rendering canvas element**, which is to say it
ships canvas fallback content in production, in the accessibility layer of a major engine.
That is independent evidence that arm D of the spike is a real mechanism and not a trick of
the measurement. Its updates are driven by `onNewMeshAddedObservable` coalesced through
`onBeforeRenderObservable.addOnce`, so it rebuilds when the scene's *structure* changes and
never when an object merely *moves*. A twin of the scene graph, not of the scene's state.

**`a3`** (npm `a3model` v1.0.6, `HilarieSit/a3`, last pushed 2025-02-12, no licence file at
the time of reading). Keyboard navigation for hover and click on meshes. It wraps the canvas
in a `<div>` and positions focus boxes over it, projecting 3D to 2D, which requires
`updateBoxes(camera)` on every camera change and a `render` call in the animation loop. So
it does do per-frame work, but for focus rectangles rather than for descriptions, and the
descriptions themselves are static strings supplied per mesh.

The gap all three leave is the same one: **nothing describes a scene whose state changes
every frame.** That is what this library is for, and it is a small enough gap to close
properly.

## Three shapes considered

### Shape 1: `userData` convention, one entry point

```js
van.userData.a11y = { label: 'Delivery van', role: 'vehicle' }
const narrator = attachNarrator(scene, { camera, canvas })
```

The appeal is real: glTF `extras` load straight into `Object3D.userData`, so a scene could
be annotated in Blender and arrive already described, with no import at the object site.

Rejected as the only shape because it is stringly typed. A typo in `a11y` or in `label` fails
silently, and silent failure in an accessibility library is the specific thing this project
exists to argue against. Kept as the underlying storage, see the decision below.

### Shape 2: declarative regions only

```js
createNarrator({ camera, mount: canvas, regions: [
  { id: 'yard', heading: 'Loading yard', bounds: new Box3(...) },
] })
```

This matches the central design principle exactly, that grouping is the point and 1:1 is
wrong. The author names the semantic structure, which is the one thing a library genuinely
cannot infer.

Rejected as the only shape because it makes the first five minutes hostile. Somebody with an
existing scene and a failing audit has to author a spatial partition by hand before they see
anything work at all. Kept as an option, because for a scene with real semantic structure it
is the better input, and `regions: 'auto'` is a default rather than the only path.

### Shape 3: imperative narrator plus a typed describe helper

Chosen.

```js
import { createNarrator, describe } from '@oskarasm/scene-narrator'

describe(van, { label: 'Delivery van', role: 'vehicle' })

const narrator = createNarrator(scene, { camera, mount: canvas })
narrator.update()   // once per frame, from the existing render loop
```

`describe(object, descriptor)` writes `object.userData.a11y` and returns the object. It is a
one-line typed front door onto shape 1's storage, so glTF-authored `extras` still work and a
TypeScript user still gets autocomplete and a compile error for a typo. Two functions, one
storage mechanism, no second system.

`narrator.update()` is called by the author from their own loop rather than the library
installing its own `requestAnimationFrame`. A library that starts its own render loop is a
library that keeps running after the scene is torn down, and it hides its own cost from the
profiler by attributing it to a callback nobody wrote.

## The API

```ts
function describe<T extends Object3D>(object: T, descriptor: Descriptor): T

interface Descriptor {
  label: string
  role?: string              // free text, spoken, not an ARIA role
  state?: () => string       // evaluated at cadence, never per frame
  detail?: () => string      // only evaluated when the region has focus
  importance?: 'normal' | 'landmark'
}

function createNarrator(scene: Object3D, options: NarratorOptions): Narrator

interface NarratorOptions {
  camera: Camera
  mount: HTMLElement                 // canvas, or any element; see mount point below
  label?: string                     // accessible name of the scene as a whole
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6   // default 2
  regions?: 'auto' | RegionDefinition[]  // default 'auto'
  autoRegions?: number               // target region count for 'auto', default 6
  cadence?: number                   // minimum ms between DOM writes, default 250
  units?: string                     // spoken distance unit, default 'metres'
  onFocusRegion?: (region: RegionSnapshot | null) => void
}

interface Narrator {
  update(): void                     // call once per frame
  announce(message: string, options?: { assertive?: boolean }): void
  focusRegion(id: string): void
  snapshot(): NarratorSnapshot       // what would be spoken right now, for tests
  stats(): { domWrites: number; digestChanges: number; frames: number }
  dispose(): void
}
```

`stats()` exists because the library's central performance claim is that DOM mutation count
is O(regions) and independent of N. That claim needs to be checkable by the person reading
the README, not just by me, so the counter is public API rather than a private field.

`snapshot()` exists so the unit tests can assert on what would be spoken without a browser.

## Decisions that follow from the spike and the research

**Mount point defaults to the canvas element**, using canvas fallback content, because arm D
of the spike removes layout cost entirely and because Babylon ships that mechanism in
production. It is an option and not a hardcoded choice, and the default is provisional until
NVDA has been run against it on this machine. If NVDA cannot reach fallback content, the
default becomes the canvas's parent and the spike's arm D result becomes a finding about
Chromium rather than a recommendation.

**Regions are the unit, never objects.** A region is one DOM node with one heading until the
user engages with it. Per-object nodes materialise on focus and are removed on blur, which
bounds both DOM size and how much a user has to listen to.

**Headings carry the structure.** WebAIM's tenth screen reader survey (n=1,539) found 71.6%
of respondents navigate primarily by headings and 3.7% by landmarks. So each region emits a
real `<h2>`, or whatever `headingLevel` says, and `role="region"` is a supplement rather than
the mechanism.

**The digest decides when to write.** Each region keeps a cheap summary: member count,
dominant state, quantised centroid, quantised bearing from the camera, quantised distance
band. The DOM is touched only when that summary changes. An object drifting three pixels is
not an event, and the quantisation is what turns continuous motion into discrete meaning.

**Bearing is camera-relative and quantised to eight sectors** ("ahead", "ahead and to your
left", and so on), because "ahead and to your left" is usable and "x: 12.4, y: -3.1" is not.
Quantisation is also what stops a slowly turning camera from rewriting every region every
frame.

**One polite live region with replace-not-queue semantics**, plus a separate assertive
channel that only `announce({ assertive: true })` writes to. Fifty objects spawning produces
one announcement, not fifty. Nothing the library infers is ever assertive; interrupting a
screen reader user is a decision only the author can make.

## Explicitly out of scope for v1

Engines other than Three.js. Inferring semantics from geometry. WebXR. Raycasting from
keyboard focus, which stays application-level and is served by `onFocusRegion`. Anything
with a running cost.
