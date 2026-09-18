# State

Updated: 2026-09-18

Overwritten, not appended. History goes to CHANGELOG.md and git. Max 150 lines. Not shipped in the npm tarball (package.json `files` does not list `docs`).

## Stage

Maintained library. Version 0.1.0 published on npm with provenance; the demo is deployed to Vercel from `demo/` on every push to `main`. Working tree was clean and history-clean on GitHub before this setup branch; no open issues or pull requests.

## Now

Max 3 items.

- [ ] Review the agent setup pull request (AGENTS.md contract, vendored contract checker in CI, project docs) - gives every agent the same rules and a checked definition of done - branch `chore/agent-setup`, draft PR.

## Blockers

- none

## Open questions for the owner

- Success metric: the repository documents accessibility and measurement gates but no adoption or usage target (npm downloads, integrations, or "every claim measured and every audit clean" as the goal itself)?
- The `nvda/` real screen-reader transcripts in NVDA.md are manual and Windows-only; no rerun cadence is documented. Is there an expected recheck interval, or is "rerun and re-record when narrator output changes" (CONTRIBUTING.md) the whole policy?

## Last verified

2026-09-18T11:45Z: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check:prose`, `npm run check:fonts`, `npm pack --dry-run`, `cd demo && npm ci && npm run typecheck && npm run build` - all pass (79 unit tests; prose clean; fonts 103.9/150 kB; tarball 27 files, 33.4 kB; demo build has a pre-existing >500 kB chunk warning, unrelated to this change).

- Revision: c372a75 (clean worktree of origin/main), repeated on the setup branch.
- Working directory: repository root. `cd demo && npm run test:browser` (Playwright) verified via CI, not repeated locally in this pass (see EVIDENCE limitations).
- Evidence: pull request CI run for the setup branch.
