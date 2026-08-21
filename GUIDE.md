# Making a moving WebGL scene usable with a screen reader

A `<canvas>` element is a black box. It has no internal structure, no semantics, and it
contributes nothing to the browser's accessibility tree. Whatever you have drawn in it, a
screen reader gets one node with a role of `img` and whatever you put in `aria-label`.

That is a WCAG 4.1.2 failure the moment anything in the canvas is interactive: a control has
to expose a name, a role and its value, and a canvas exposes none of them. The Web Content
Accessibility Guidelines do not have an exemption for "it is 3D".

The usual fix is to build a parallel DOM that mirrors the scene, one hidden element per
object. That works for a static scene. This guide is about what happens when the scene
moves, why the obvious version of the fix fails for reasons that have nothing to do with
frame rate, and what to do instead.

Everything numeric here was measured on hardware named in the text, with a harness in the
repository that you can run yourself. Nothing is estimated.

---

## 1. What this is

[`@oskarasm/scene-narrator`](https://github.com/OskarasM/scene-narrator) is a small library
that gives a moving Three.js scene a navigable accessibility tree without spending the frame
budget on it.

- Live demo: DEMO_URL_PLACEHOLDER
- `npm install @oskarasm/scene-narrator`
- MIT, no runtime dependencies, `three` as a peer dependency, `react` and
  `@react-three/fiber` as optional peers for the React entry point.

It is verified against NVDA on Windows. VoiceOver and JAWS are untested, and section 8 says
exactly what that means.

---

## 2. Canvas is a black box

Every other element on a page carries semantics the browser can expose. A `<button>` is a
button; a heading is a heading at a level; a checked checkbox reports that it is checked.
The browser builds an accessibility tree from that structure and hands it to the operating
system's accessibility API: UI Automation on Windows, NSAccessibility on macOS, AT-SPI on
Linux. A screen reader reads that tree.

A canvas has no structure to expose. It is a bitmap. The browser can tell the accessibility
API that a graphic exists and what its `alt` text is, and that is the end of the
conversation.

For a decorative canvas that is fine, and `aria-hidden="true"` is the honest answer. For a
canvas containing anything a user is meant to perceive or operate, it is a failure of:

- **1.1.1 Non-text Content (A)**: no text alternative for the content.
- **4.1.2 Name, Role, Value (A)**: interactive components expose none of the three.
- **2.1.1 Keyboard (A)**, in practice, because pointer-driven 3D interaction usually has no
  keyboard path at all.

These are level A, the floor. And the legal position around them has moved: the European
Accessibility Act has been enforceable since 28 June 2025 with all 27 member states having
transposed it, with full compliance for pre-existing services required by 28 June 2030. In
the United States, the Department of Justice's ADA Title II web rule was extended by a year
and now falls due on 26 April 2027 for large public entities and 26 April 2028 for smaller
ones.

### The standards-blessed escape hatch

HTML does provide a mechanism, and it is older than most of the discussion around it: **the
children of a `<canvas>` element are its fallback content**, and they are exposed to the
accessibility tree.

```html
<canvas id="scene">
  <h2>Delivery yard</h2>
  <p>Six vans, four of them moving.</p>
</canvas>
```

Nothing there is rendered. It exists purely to describe what the canvas is drawing. This
turns out to matter a great deal for performance, for reasons in section 3, and it is the
same mechanism the `html-in-canvas` proposal builds on.

---

## 3. The measurement

### The naive approach

One hidden DOM node per object, its text rewritten every frame:

```js
for (let i = 0; i < objects.length; i++) {
  nodes[i].textContent = describe(objects[i])
}
```

This is the approach that gets written first, and it is not stupid. It is exactly correct in
its intent. It is just extremely expensive, and expensive in a way that does not show up
until you measure with the right things switched on.

### What the mutation actually costs

Writing to a node in the accessibility tree is not one operation. In Chromium it triggers,
roughly: style recalculation, layout, then the node being flagged dirty in `AXObjectCache`,
then serialisation of the changed properties, then a cross-process IPC hop to the browser
process, because a sandboxed renderer cannot talk to the operating system's accessibility
API directly. Do that per object per frame and you are on the browser's most expensive path,
deliberately.

### The trap that makes most benchmarks of this wrong

**Chromium does not build a full accessibility tree unless assistive technology is attached
to the process.** If you profile a page with no screen reader running and no
`--force-renderer-accessibility` flag, you are measuring a renderer that is quietly skipping
most of the work.

That trap was quantified rather than assumed. Same matrix, same hardware, with and without
the flag, p95 frame time forced divided by p95 unforced:

| N | baseline | naive sibling mirror | mirror + aria | canvas fallback |
|---|---|---|---|---|
| 100 | 1.08x | 2.06x | 1.94x | 2.00x |
| 500 | 1.20x | 1.98x | 2.00x | 2.25x |
| 1000 | 1.17x | 4.35x | 2.50x | 2.04x |
| 2000 | 1.21x | 3.63x | 4.70x | 2.18x |

The baseline moves a little, which is the cost of maintaining a tree for a nearly empty
page. The mirroring arms move by 2x to 4.7x.

The consequence is concrete. Measured without the flag, the naive mirror looks like it holds
60fps up to somewhere between 1000 and 2000 objects. Measured with it, it gives out between
500 and 1000. A careless benchmark reports the cliff at about twice the object count where
it really is, and nothing looks wrong while it does so, because every arm moves together and
the ranking stays correct.

Everything below is measured with the flag on, and one pass was run with NVDA genuinely
attached to check that the flag is a fair proxy.

### The numbers

AMD Ryzen 7 5800H, 16 cores, 15GB, Windows 11 (10.0.26200), Chromium 151.0.7922.34. Three
runs per cell, six seconds measured after a one second warm-up, vsync and the frame rate cap
disabled so these are frame times rather than monitor intervals. Percentiles rather than
means, because these stalls are spiky and a mean hides the exact jank a user feels.

p95 / p99 frame time in milliseconds:

| N | baseline | naive sibling | sibling + aria | canvas fallback |
|---|---|---|---|---|
| 10 | 0.3 / 0.4 | 0.7 / 1.1 | 0.7 / 1.1 | 0.4 / 0.6 |
| 100 | 0.4 / 0.6 | 3.7 / 11.0 | 3.4 / 12.1 | 1.0 / 1.6 |
| 500 | 0.6 / 0.8 | 13.8 / 44.2 | 14.6 / 44.9 | 2.7 / 8.4 |
| 1000 | 0.9 / 1.1 | 56.7 / 138.5 | 36.1 / 103.2 | 5.2 / 12.5 |
| 2000 | 1.5 / 1.9 | 90.0 / 185.5 | 128.9 / 185.0 | 9.6 / 15.3 |
| 5000 | 3.3 / 4.2 | 112.0 / 415.0 | 203.5 / 445.4 | 16.7 / 31.5 |

Read the p99 column. **At 500 objects, one frame in a hundred takes 44 milliseconds.** The
p95 at that point is still inside the 16.7ms budget, which is precisely why a benchmark
reporting means or medians would have called this fine.

### Where the time goes

Chromium's own counters, normalised per frame because a faster arm accumulates more of
everything over the same window:

| N | naive sibling, layout ms/frame | canvas fallback, layout ms/frame |
|---|---|---|
| 100 | 0.910 | 0.000 |
| 500 | 3.717 | 0.000 |
| 1000 | 9.982 | 0.000 |
| 2000 | 16.127 | 0.000 |
| 5000 | 39.213 | 0.000 |

**Layout time for canvas fallback content is exactly zero, in every cell of the matrix.**
Canvas fallback content is never rendered, so it never participates in layout. The sibling
mirror spends 39ms per frame in layout alone at 5000 objects, and blows the whole 30fps
budget on layout by itself at 2000.

That was checked for the obvious alternative explanation, that the fallback content is cheap
because it is not there. Chromium's `Accessibility.getFullAXTree` over CDP, at 10 objects
with forced accessibility, reports 10 `listitem` nodes and 10 nodes carrying an accessible
name, the first being `"Object 0 at 10.57, -7.23, 28.59"`, role `StaticText`, `ignored:
false`. The nodes are in the tree with their text. The cost is lower because layout is
skipped.

### What this library costs

ARM_E_SECTION_PLACEHOLDER

---

## 4. The browser is not going to fix this

Two things get raised whenever this comes up, and neither of them rescues you.

**The Accessibility Object Model, Phase 3.** Virtual accessibility nodes would let you build
an accessibility tree in JavaScript with no DOM behind it at all, which is precisely what a
canvas wants. It is **Blocked** in Chromium, WebKit and Gecko, on
[w3ctag/design-principles#293](https://github.com/w3ctag/design-principles/issues/293). Not
in progress, not behind a flag: blocked in all three engines. Building on it today is
building on nothing.

**`html-in-canvas`.** Real, moving, and further along: a developer trial in Chromium 147 and
later behind `chrome://flags/#canvas-draw-element`, adding `layoutsubtree`,
`drawElementImage()`, `texElementImage2D()` and friends, so you can render live DOM into a
canvas texture.

It genuinely helps, for the case where you want real HTML controls inside a 3D surface. It
does **not** solve this problem, because its accessibility story is canvas fallback content,
that is to say real DOM nodes, that is to say exactly the mutation cost measured above. It
changes where the pixels come from. It does not change what a mutation to an accessible node
costs.

---

## 5. Why one-to-one mirroring is wrong for users, not just for frame rate

This is the section that matters, and the performance argument above is the less important
half of the case.

WebAIM's tenth Screen Reader User Survey (n=1,539, December 2023 to January 2024) asked how
respondents find information on a long page:

| Method | Share |
|---|---|
| Navigate by headings | 71.6% |
| Use the find command | 13.6% |
| **Read through the page** | **6.4%** |
| Navigate by links | 4.8% |
| Navigate by landmarks | 3.7% |

**Only 6.4% read linearly.** Everybody else navigates by structure, and the overwhelming
majority of those navigate by heading.

Now consider what a 1:1 mirror of a thousand meshes gives that person. One flat list of a
thousand items, no headings, no structure, every entry a variation on the same sentence, all
of it changing continuously underneath them. Pressing H does nothing because there are no
headings. Skimming is impossible because there is nothing to skim. The find command is
useless because they do not know what any of the objects are called.

It is not a slow accessible experience. It is a fast inaccessible one, and making it faster
would not fix it.

So the design follows from the survey rather than from the profiler:

1. **Group, never mirror.** Objects cluster into a handful of areas. An area is one node
   until somebody engages with it.
2. **Headings carry the structure**, because that is what 71.6% of people navigate by. A
   real `<h3>` per area, at a level the author chooses so it fits their page. `role="region"`
   is a supplement, not the mechanism, and six landmarks would bury a page's real ones.
3. **Describe, do not enumerate.** "Five vans, mostly moving, ahead and to your left,
   nearby" rather than five sentences of coordinates.
4. **Speak in the user's frame of reference.** "Ahead and to your left" is usable. "x: 12.4,
   y: -3.1, z: 8.8" is three numbers a person has to project into a mental image, which is
   not a reasonable thing to ask.
5. **Detail on demand.** Individual objects appear when an area is opened and disappear when
   it closes. That bounds the size of the tree and, more importantly, bounds how much
   somebody has to sit through.
6. **Update on meaning, not on motion.** An object drifting three pixels is not an event.

Notice that every one of those decisions makes the library faster, and that not one of them
was made for that reason. The quantisation that stops a slowly turning camera from rewriting
the DOM sixty times a second is the same quantisation that stops a screen reader from
narrating an imperceptible change. The right design for the user and the right design for
the frame budget are the same design, which is a much happier situation than it usually is.

---

## 6. How the library works

Four moving parts.

**Grouping.** Described objects are collected from the scene graph and partitioned, either
into author-defined regions with world-space bounds, or automatically into a uniform grid
over the two widest horizontal axes. Empty cells are dropped. Each region gets a heading that
means something read on its own, "The north-west of the scene", rather than "Region 3-1",
because a heading is read out of context and has to stand up alone.

**The digest.** Each region keeps a small, entirely quantised summary: member count, dominant
role, dominant state, bearing from the camera as one of eight sectors, and a distance band.
Continuous motion becomes a DOM write only when it crosses a quantisation boundary, which is
close to the point at which a person would say something new about the scene.

**The cadence.** `narrator.update()` is called from the author's own render loop. On most
calls it compares one number and returns. When the cadence elapses, typically four times a
second, it walks the scene, regroups, redigests, and writes only for regions whose digest
changed. So the cost model is:

| | cost |
|---|---|
| per frame | one number comparison |
| per evaluation | O(N) traversal, N described objects |
| per DOM write | O(regions whose meaning changed) |

The middle row is the honest caveat. This is not O(1) in object count. It is O(1) per frame,
and it moves the O(N) work off the frame budget onto a cadence the author picks. What is
independent of N is the DOM mutation count, which the measurements above show to be the
expensive part.

**The keyboard and focus model.** One tab stop for the whole scene, then arrows between
areas, Enter to open one, Escape to close. Focus changes fire a callback so the application
can move its camera or highlight an object, which keeps sighted and non-sighted navigation
pointing at the same thing.

The library does not install its own `requestAnimationFrame`. A library that starts its own
render loop keeps running after the scene is torn down, and hides its own cost from the
profiler by attributing it to a callback nobody wrote.

---

## 7. What NVDA actually says

NVDA_SECTION_PLACEHOLDER

---

## 8. Honest limits

**Tested with NVDA on Windows only.** Not VoiceOver, not JAWS, not Narrator, not TalkBack.
Not "should work" with them: untested. Screen readers differ from each other more than
browsers do, and claiming coverage that has not been verified is the specific failure this
whole project is arguing against. If you use this with VoiceOver and it goes wrong, that is
expected and an issue would be genuinely useful.

**One machine.** Every millisecond in this guide came off a 16-core Ryzen laptop running
Windows 11. Lower-powered hardware hits these cliffs at lower object counts. The shape of
the curves should generalise; the thresholds should not be quoted as universal.

**Three runs per cell**, with run-to-run variance published in `SPIKE.md`. Enough to
establish the shape and the ordering, not enough to defend a specific millisecond at high
object counts.

**The naive mirror is a strawman I wrote.** No third-party library was benchmarked here and
none will be. The comparison is against the obvious implementation, not against anybody
else's work.

**The library cannot invent semantics.** It has no idea what your meshes are. If you do not
supply labels, you get "5 objects" and that is genuinely all the information available. The
hard part of this problem is deciding what a thing is called and which things belong
together, and that is a human judgement.

**Automated checks catch a minority of real issues.** axe and its equivalents find somewhere
around a third to a half of the problems a manual audit would, and they cannot hear a screen
reader at all. This library passing an automated check means very little on its own. That is
why section 7 exists.

**Auto-region bounds are computed once and kept.** A scene that expands a long way over its
lifetime will end up with objects clamped into edge regions. Supply explicit regions if that
is you.

---

## 9. How this relates to `@react-three/a11y`

[`@react-three/a11y`](https://github.com/pmndrs/react-three-a11y) is the package most people
find first, and it deserves a fair description rather than a competitive one.

It solves a different problem, and solves it well: taking discrete interactive elements in a
3D scene, buttons, links, content regions, and giving them real DOM equivalents with focus,
hover and click, plus an announcer for messages. Reading its source, it does **no per-frame
work whatsoever**, by design. A grep across the whole package for `useFrame`,
`requestAnimationFrame`, `setInterval`, `throttle` and `debounce` returns nothing. It maps
static structure onto static structure.

That is the correct architecture for what it does, and it is why it does not overlap with
this library. If your scene is a configurator with eight clickable hotspots, that package is
what you want and this one is not.

As a factual matter for anyone choosing dependencies: version 3.0.0 was published on
2022-05-15 and nothing has been published since, and it depends on `zustand@^3` where the
current major version is 5, which can cause a duplicate-instance problem in a modern app.
Its peer ranges are permissive enough that it still installs.

**Using both together is reasonable and expected.** They mount into different places and
neither one polls. Use `@react-three/a11y` for the things a user clicks, and this library for
describing the scene those things sit in.

Also worth knowing about:

- **`@babylonjs/accessibility`**, Babylon's HTML twin, which mounts a React root directly
  into the rendering canvas as fallback content. It rebuilds when the scene's structure
  changes and never when an object merely moves, so it is a twin of the scene graph rather
  than of the scene's state. Its choice of mount point is independent evidence that canvas
  fallback content is a real mechanism.
- **`a3`** (published as `a3model`), which provides keyboard navigation for hover and click
  on meshes by projecting focus rectangles over the canvas.

---

## Reproducing everything here

```
git clone https://github.com/OskarasM/scene-narrator
cd scene-narrator
npm install
npm test                      # unit tests plus virtual screen reader assertions
npm run bench                 # the full matrix, headed, about 25 minutes
npm run bench:analyse -- bench/results/<file>.json
node bench/axtree-check.mjs   # does the mirror reach the accessibility tree
node bench/nvda-probe.mjs     # requires: npx @guidepup/setup install nvda
```

Every number in this guide traces to a file in `bench/results/`. If it is not in there, it
is not in here.
