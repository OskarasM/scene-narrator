# Vendored agent contract checker

Copied from the owner's private agent-setup repository, revision f825239bd3955220fdb7a4101af9048483ba20ad.
check.mjs is byte-identical to the source. repo-policies.json is filtered: the source file maps every repository the owner maintains, and this public repository vendors only its own entry. The checker reads one repository's policy at a time, so the filtered file behaves identically here.
Both files are required: check.mjs reads repo-policies.json beside it. It reads files and Git metadata only and never runs commands found in documents.
It validates the AGENTS.md contract and the docs/STATE.md, docs/ROADMAP.md and docs/DECISIONS.md structure. CI runs it with `--ci`, which does not require the local-only CLAUDE.md.

| file | sha256 (LF bytes as committed) | source |
|---|---|---|
| check.mjs | 36b3c798ad33f60421c2fcb9802938e72e82ef02d046b6515396f99121f35ab1 | identical |
| repo-policies.json | 996440d27de1908cc91cb8d3cd31c248307508c7756d77152e8df46ffe0c8c3f | filtered to this repository |

This directory is skipped by `scripts/check-prose.mjs`, because the vendored bytes must stay identical to the source and use American spelling.

To update: copy both files from a newer agent-setup revision together, re-apply the filter to repo-policies.json, then update this revision and the hashes.
