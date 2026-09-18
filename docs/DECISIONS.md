# Decisions

Register of settled choices so nobody re-litigates them. Add or update rows; never delete a row, mark it Superseded. No length cap: search the relevant section, do not read in full. Not shipped in the npm tarball.

Status: Accepted | Implemented | Open (needs owner) | Deferred (valid later) | Rejected (do not revive without new evidence and owner approval) | Superseded (by row/date)

Rows dated before 2026-09-18 index choices already written in this repository (commit messages, README, CONTRIBUTING.md, SECURITY.md, PRODUCT.md); the source is named in each row. Where no commit dates a choice, the date is the 0.1.0 release.

## Library scope and behaviour

| Date | Decision | Status | Reason / evidence |
|---|---|---|---|
| 2026-08-21 | Group the scene into a handful of areas with real headings and spoken summaries, rewritten only on meaning-change, instead of one hidden DOM node per object updated every frame. | Implemented | README; PRODUCT.md "What this is"; the rejected approach is slow before it is unusable. |
| 2026-08-22 | Descriptors are written with `textContent`/`setAttribute`, never `innerHTML`. | Implemented | SECURITY.md "Scope". |
| 2026-08-22 | `state()` and `detail()` are called on a cadence, not sandboxed; a slow or throwing callback is the caller's responsibility. | Accepted | SECURITY.md "Scope". |
| 2026-08-22 | Descriptors live on `object.userData.a11y`, so glTF `extras` can carry them; an untrusted scene's descriptors are not validated by the library. | Accepted | SECURITY.md "Scope"; callers must validate untrusted-asset descriptors before mounting. |
| 2026-08-22 | Zero runtime dependencies; `three` a required peer, `react`/`@react-three/fiber` optional peers. | Implemented | package.json; CONTRIBUTING.md "Do not add a runtime dependency". |

## Measurement, phrasing and accessibility

| Date | Decision | Status | Reason / evidence |
|---|---|---|---|
| 2026-08-21 | No number in the README, the site or any document unless a committed script produced it; negative results stay in. | Implemented | CONTRIBUTING.md "The measurement rule". |
| 2026-08-21 | Live and recorded figures are kept visibly apart (separate headings, a counterfactual column). | Implemented | CONTRIBUTING.md "The measurement rule". |
| 2026-08-22 | A change to what reaches the accessibility tree needs a test that reads the tree, not the code that writes it. | Implemented | CONTRIBUTING.md "The accessibility rule"; `test/narrator.test.ts`, `demo/tests/site.spec.ts`. |
| 2026-08-22 | New phrasing needs a boundary test in `test/phrasing.test.ts`; read every string aloud, out of context, before changing it. | Implemented | CONTRIBUTING.md "The phrasing rule". |
| 2026-08-22 | The real NVDA pass is manual, Windows-only, and not part of `npm test` or CI; its transcript is committed to NVDA.md instead of being faked in CI. | Accepted | CONTRIBUTING.md "The screen reader rule". |
| 2026-08-22 | The demo is held to the library's own accessibility bar; a demo that fails an audit is a liability, not a demonstration. | Implemented | PRODUCT.md "Strategic design principles"; browser suite gates every pull request. |

## Design and brand

| Date | Decision | Status | Reason / evidence |
|---|---|---|---|
| 2026-08-22 | Light theme, restrained colour with one committed accent moment; a hue may appear only if it appears in a legend. | Implemented | DESIGN.md "Theme", "Colour". |
| 2026-08-22 | Three type registers (Commit Mono chrome, Atkinson Hyperlegible Next body, Literata display), self-hosted and subset under a 150 kB budget. | Implemented | DESIGN.md "Typography"; `scripts/check-font-budget.mjs`. |
| 2026-08-22 | Site header, footer, brand, install command, code card, tab picker, buttons, tables and the accessibility floor are shared byte-identical with two sibling sites; structure (not hue) is what differs between the three. | Deferred | DESIGN.md "Components"; PRODUCT.md "Strategic design principles" point 5; revisit if a fourth sibling appears. |
| 2026-08-22 | No centred hero, drop caps, italic display face, eyebrow headings, stock illustration, icon-and-heading grid, or SaaS landing-page furniture. | Accepted | PRODUCT.md "Anti-references". |

## Release and repository

| Date | Decision | Status | Reason / evidence |
|---|---|---|---|
| 2026-08-22 | Publish over npm trusted publishing (OIDC) with provenance, triggered by a published GitHub release; no stored or long-lived npm token. | Implemented | `.github/workflows/publish.yml`; trust registered as organisation OskarasM, repository scene-narrator, workflow publish.yml, no environment. |
| 2026-08-22 | Refuse `Co-Authored-By` trailers with a commit-msg hook (`core.hooksPath .githooks`), after seven reached history and required a rewrite. | Implemented | `.githooks/commit-msg`. |
| 2026-08-25 | Documentation and code comments use British English and plain ASCII, enforced by `scripts/check-prose.mjs`. | Implemented | `npm run check:prose`; CI `prose` job. |
| 2026-09-14 | An earlier local history rewrite (22 unpushed commits, a `backup-before-rewrite` branch and stray refs) was found to have already reached GitHub cleanly; the local leftovers were bundled to an archive and deleted rather than re-pushed. | Implemented | Owner-verified 2026-09-14; GitHub history for this repository carries no attribution trailers. |

## Agent setup

| Date | Decision | Status | Reason / evidence |
|---|---|---|---|
| 2026-09-18 | AGENTS.md is the shared agent contract (seven sections, checked in CI by a vendored checker in `.github/agent-setup/`); docs/STATE.md, docs/ROADMAP.md and this file hold current state, plan and decisions; CHANGELOG.md stays the release history. | Accepted (owner) | Owner-approved setup pattern (decision #3, 2026-09-14); checker source and hashes in `.github/agent-setup/SOURCE.md`. |
| 2026-09-18 | CLAUDE.md is local-only in this public repository (excluded via `.git/info/exclude`); CI does not require it. | Accepted (owner) | Owner decision #3, 2026-09-14, for public repositories. |
| 2026-09-18 | The vendored `repo-policies.json` holds only this repository's own entry, filtered from the owner's private mapping. | Accepted (owner) | Owner decision, 2026-09-17; the source file otherwise names private repositories. |
| 2026-09-18 | The contract check runs as a step in the existing `test` CI job instead of a new job. | Accepted (agent proposal) | This repository has no branch-protection required checks configured today; the `test` job (typecheck, build, unit tests) is the one that gates every push and pull request without a headed browser or a schedule. |
| 2026-09-18 | `scripts/check-prose.mjs` skips the `agent-setup` directory. | Accepted (agent proposal) | The vendored checker must stay byte-identical to its source hash and contains an American spelling that this repository's prose rule would otherwise flag. |
| 2026-09-18 | docs/STATE.md, docs/ROADMAP.md and docs/DECISIONS.md need no `package.json` "files" exclusion. | Accepted (agent proposal) | `files` is already an allowlist of `dist`, `README.md` and `LICENSE` with no `docs` entry, so `npm pack` cannot include the new `docs/` directory; verified with `npm pack --dry-run`. |
