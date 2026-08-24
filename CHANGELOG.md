# Changelog

All notable changes are documented here.

The demo under `demo/` is not part of the published package, so its changes are
recorded but do not move the version.

## Unreleased

### Added

- The demo is now a full site: eight sections on a transcript rail, stamped in
  timestamps rather than numbered, with a continuous left rail and an
  annotation margin.
- Two further scenes beside the delivery yard. A six-part product configurator
  using author-defined regions, and a four thousand object particle field
  described imperatively with `describe()` rather than one React component per
  object.
- Live controls that pass the same arguments an application passes: scene,
  cadence, target region count, and `focusRegion()`.
- A running transcript of every line written to the accessibility tree, taken
  from `narrator.snapshot()` rather than generated for display.
- Live cost readouts against the arithmetic counterfactual of a one node per
  object mirror, with the sixty second series downloadable as JSON and CSV.
- `bench/partition.mjs`, measuring grouping, digesting and phrasing at 24, 400
  and 4,000 objects: 0.033ms, 0.085ms and 0.521ms per evaluation, the last of
  which is 0.21 per cent of one core at the default cadence.
- Self-hosted, subset Literata, Atkinson Hyperlegible Next and Commit Mono with
  metric-matched fallbacks computed from the font binaries. A 150 kB ceiling is
  enforced by `scripts/check-font-budget.mjs` in CI.
- A generated icon set and an Open Graph image, all from one `favicon.svg`.
- Social preview and canonical metadata, which did not exist. Every link to the
  demo unfurled blank.
- `demo/vercel.json` with a content security policy, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy`.
- A twenty test browser suite across Chromium, Firefox and WebKit, gating every
  pull request: axe at WCAG 2 A and AA, the skip link, 44px targets at 375px,
  no horizontal overflow at four widths, the typefaces actually loading rather
  than merely being named, and the whole page holding its layout with no WebGL
  context at all.
- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue and pull
  request templates, and a commit-msg hook.

### Fixed

- `role="region"` on the transcript list replaced its implicit list role,
  leaving its own list items with a parent that is not a list. A serious
  WCAG 1.3.1 failure, found by axe.
- The demo raised an uncaught Three.js error and showed a blank rectangle on a
  machine that refuses a WebGL context. It now says what happened, and the rest
  of the page, which needs no context, is unaffected.
- A transcript identifier counter that restarted with each narrator handed
  React duplicate keys when the scene changed mid-interval, so React silently
  dropped rows.
- `min-height` combined with `aspect-ratio` on the scene viewport forced a
  minimum width rather than a minimum height, pushing the whole document
  sideways on a 360px screen.
- Selection in the configurator scene is carried by `importance` rather than by
  `state()`. State is summarised as the dominant state of a group, so a
  property belonging to one object came out of the digest as a property of all
  of them.

## 0.1.0 - 2026-08-22

### Added

- Grouping of a moving 3D scene into a handful of named areas, each with a real
  heading and a spoken summary, rewritten only when the meaning of the area
  changes rather than when a pixel does.
- Quantised digests of count, dominant role, dominant state, bearing and
  distance band, which is what makes continuous motion cost nothing until it
  crosses a boundary.
- Automatic partitioning over a uniform grid, and author-defined regions for
  scenes that have real semantic structure to name.
- Phrasing exported separately, so a scene that is not a space you move through
  can replace the words without replacing the library.
- A React Three Fiber binding holding no semantics of its own: `SceneNarrator`,
  `useNarrator` and `useDescribe`.
- Descriptors stored on `object.userData.a11y`, so a scene authored in Blender
  can carry its descriptions in glTF `extras` and arrive already described.
- A live region for announcements the library cannot infer, with coalescing.
- Roving tabindex over the areas, so a keyboard user passing through the page
  gets one tab stop for the whole scene rather than one per area.
- A benchmark harness measuring four arms against object counts from 10 to
  5,000, in Chromium and Firefox, with the results and the method committed.
- NVDA verification against a real installation, both browse and focus mode,
  with the transcripts and the imperfections in them committed.
- Zero runtime dependencies. `three` is the only required peer.
