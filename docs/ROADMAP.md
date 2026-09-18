# Roadmap

Updated: 2026-09-18

Forward plan only. Shipped work leaves this file (CHANGELOG.md + git). Rejected ideas live in docs/DECISIONS.md. Max 250 lines. Not shipped in the npm tarball.

Drafted from repository evidence (README, CONTRIBUTING.md, PRODUCT.md, SECURITY.md, build output). Items are agent proposals until the owner orders them.

## Next

Ordered. Top item moves to STATE Now when started.

1. Merge the agent setup pull request - done when CI (the `test` job, including the vendored contract check) passes and the owner merges.

## Later

- Decide the success metric named in docs/STATE.md open questions (owner decision).
- Decide whether NVDA.md needs a recheck cadence beyond "rerun when narrator output changes" (owner decision, docs/STATE.md open questions).

## Parked

- Demo build warns one chunk (`SceneCanvas`, about 911 kB before gzip) exceeds the default 500 kB threshold - not a measured problem today - revisit if initial load time becomes one.

## Out of scope for now

- Automating the real NVDA pass in CI - it needs Windows and a dedicated machine not stolen by other focus (CONTRIBUTING.md "The screen reader rule"); it stays manual, recorded in NVDA.md.
- Providing a security boundary around untrusted WebGL content or glTF-carried descriptors - SECURITY.md "Scope" documents this as accepted, not defended.
