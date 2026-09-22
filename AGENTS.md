# scene-narrator

Shared project instructions for contributors and coding tools. Current user instructions override these repository defaults. Observed code, configuration and verified live state override stale descriptions; reconcile the documents when they disagree.

## Product

- Audience: developers with a WebGL scene and an accessibility requirement, and people reading the demo site as evidence of the author's judgement (PRODUCT.md "Who it is for").
- Primary goal: give a moving Three.js scene a navigable accessibility tree without spending the frame budget on it, by grouping the scene into areas with headings and summaries that update on meaning-change rather than every frame (README; PRODUCT.md).
- Success metric: not documented in the repository (owner question in docs/STATE.md). Evidence in use today: axe clean at WCAG 2 A and AA on every pull request, every claim backed by a committed script, and npm 0.1.0 published with provenance.
- Non-goals: providing a security boundary around untrusted WebGL content (SECURITY.md "Scope"); automating the real NVDA pass in CI - it needs Windows and a dedicated machine, so it stays manual and is recorded in NVDA.md instead (CONTRIBUTING.md "The screen reader rule").
- Detail: `PRODUCT.md`

## Stack

- TypeScript library, ES modules, built by `tsc` to `dist/` with two entry points: `scene-narrator` and `scene-narrator/react`. Node `>=18` (engines).
- No runtime dependencies. `three` is a required peer; `react` and `@react-three/fiber` are optional peers used only by the React entry point.
- Tests: Vitest (jsdom) for unit tests, including virtual-screen-reader assertions (`@guidepup/virtual-screen-reader`); Playwright (Chromium, Firefox, WebKit) against the demo, run from `demo/` which has its own `package.json` and lockfile.
- Demo: React + Vite in `demo/`, deployed to Vercel from `demo/` on every push to `main`.
- npm publishing: `.github/workflows/publish.yml`, triggered by a published GitHub release, trusted publishing over OIDC with provenance. No stored npm token; do not add one and do not touch the package version or the publish trigger.
- Real screen reader verification (NVDA, Windows only) is manual and not part of CI; its transcripts are committed to `NVDA.md`.

## Commands

Run from the repository root; package.json scripts are the source of truth.

- Install: `npm ci`
- Demo install: `cd demo && npm ci`
- Lint: none
- Typecheck: `npm run typecheck`
- Test: `npm test`
- Build: `npm run build`
- Prose check (plain ASCII, British spelling): `npm run check:prose`
- Font budget: `npm run check:fonts`
- Demo typecheck: `cd demo && npm run typecheck`
- Demo build: `cd demo && npm run build`
- Browser tests (install once: `npx playwright install chromium firefox webkit` inside `demo/`): `cd demo && npm run test:browser`
- Benchmark (not run per pull request; see `.github/workflows/bench.yml`): `npm run bench`, `npm run bench:analyse`, `npm run bench:partition`
- Package smoke: `npm pack --dry-run`
- Project contract check (vendored, see `.github/project-check/SOURCE.md`): `node .github/project-check/check.mjs --ci --repo-id scene-narrator .`

## Conventions

- Default branch `main` is production; the demo deploys from it on every push, and a published GitHub release publishes the npm package. Work on a branch; merge by pull request only.
- This repository is public. Never commit tokens, registry credentials, private paths or personal details.
- No co-author trailers. Enable the hook once per clone: `git config core.hooksPath .githooks` (refuses a `Co-Authored-By` trailer at commit time).
- Do not add a runtime dependency; `three` stays a peer alongside the optional React ones (CONTRIBUTING.md).
- A change that alters what reaches the accessibility tree needs a test that reads the tree (`test/narrator.test.ts`, `demo/tests/site.spec.ts`), not a test that reads the code that writes it (CONTRIBUTING.md "The accessibility rule").
- No number in the README, the site or any document unless a committed script produced it; keep live and recorded figures visibly apart, and keep negative results in (CONTRIBUTING.md "The measurement rule").
- New user-facing phrasing needs a boundary test in `test/phrasing.test.ts`; read the string aloud, out of context, before changing it (CONTRIBUTING.md "The phrasing rule").
- Documentation and code comments use British English and plain ASCII (no smart quotes, en or em dashes, or the ellipsis character); `node scripts/check-prose.mjs` enforces it.
- Never edit: `dist/`, `demo/dist/`, `node_modules/`.

## Project docs

Read the smallest set the task needs. Files marked "search only" are never read in full.

| file | holds | read |
|---|---|---|
| `docs/STATE.md` | stage, Now (max 3), blockers, last verified checks | start of substantive work |
| `docs/ROADMAP.md` | Next, Later, Parked, Out of scope for now | before feature or scope work |
| `docs/DECISIONS.md` | decision register: status and reason | search the relevant section before changing direction |
| `CHANGELOG.md` | release history | search only |
| `PRODUCT.md`, `DESIGN.md` | brand, voice, audience; the visual system for `demo/` | before any UI, copy or brand-facing change |
| `CONTRIBUTING.md`, `SECURITY.md` | the accessibility, measurement, phrasing and screen-reader rules; security policy and scope | before code, phrasing or security work |
| `API.md`, `GUIDE.md`, `SPIKE.md`, `NVDA.md` | published API reference, full write-up, measurement methodology, real screen-reader transcripts | before changing the matching behaviour or claim |

A current explicit user request authorises its scope even if absent from these docs. Ask before expanding that scope materially. Revisit rejected decisions only with new evidence; explain the tradeoff.

## Done = verified

Work is done only when these pass, run in this order, output read.

1. `npm run typecheck`
2. `npm test`
3. `npm run build`

- Prose or self-hosted font change: also `npm run check:prose`, `npm run check:fonts`.
- Demo, browser-visible or accessibility-tree change: also `cd demo && npm run typecheck`, `cd demo && npm run build`, then `cd demo && npm run test:browser`.
- Before opening a pull request (CONTRIBUTING.md): all of the above plus `npm pack --dry-run`.
- Docs-only change: prose check, links, consistency with package.json scripts and CI, `git diff --check`, and the project contract check.
- Update only project docs whose facts changed: `docs/STATE.md` (Now, blockers, Last verified, Updated date), `docs/DECISIONS.md` (new or changed decisions with reason), `docs/ROADMAP.md` (items moved or added), a `CHANGELOG.md` entry for user-visible changes in a release.
- Report which checks ran and their result. Never skip, weaken, or delete a check to make it pass.

## Design

Visual design: `DESIGN.md`. Read it, and `PRODUCT.md`'s anti-references, before any UI, token or copy change in `demo/`.
