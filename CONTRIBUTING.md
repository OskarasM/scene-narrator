# Contributing

## Set up

```bash
npm ci
npm run typecheck && npm test && npm run build
```

The demo is a separate package with its own lockfile, and the browser suite
lives with it:

```bash
cd demo
npm ci
npx playwright install chromium firefox webkit
npm run test:browser
```

## The accessibility rule

This is the one that is not negotiable. A change that alters what reaches the
accessibility tree must come with a test that reads the tree, not a test that
reads the code that writes it. `test/narrator.test.ts` runs against a real DOM
and `demo/tests/site.spec.ts` runs against a real browser; both are cheap and
both have caught things that looked correct in review.

The demo page is held to the same bar as the library. It is an accessibility
project, so a demo that fails an audit is not a demo, it is a liability. The
browser suite asserts axe at WCAG 2 A and AA, the skip link, a visible focus
ring, 44px targets at 375px, and no horizontal overflow at four widths. If a
change makes any of those fail, the change is wrong, not the test.

## The measurement rule

Do not put a number in the README, the site or any document unless it came out
of a committed script that anybody can run. Say which script, on what machine,
over how many iterations. `bench/partition.mjs` and `bench/run.mjs` both print
what they measured and both are quoted from rather than remembered.

Keep live figures and recorded figures visibly apart. The demo does this with
two headings, "Live, this second" and "Recorded", and a counterfactual column
that says in words that it is arithmetic rather than a second run. Presenting a
recorded number as a live one is the easiest way to make a measurements page
dishonest, and it is usually done by accident.

Negative results stay in. The spike found that mounting into canvas fallback
content helps on Chromium and barely helps on Firefox, and both halves of that
are published. A project that only reports the flattering half of its own
measurements has not measured anything.

## The phrasing rule

Every string this library speaks is read out to somebody who cannot see the
scene. Before changing one, read it aloud, out of context, with no neighbouring
sentence for comparison, which is how a heading is actually met.

New phrasing needs a test in `test/phrasing.test.ts` covering the boundary
either side of it. Quantisation is the whole trick: a bearing is one of eight
sectors and a distance one of five bands, so the interesting cases are always
the ones on the line between two of them.

## The screen reader rule

`nvda/` is deliberately not part of `npm test` and does not run in CI. It needs
Windows, an NVDA install and a machine nothing else is going to steal focus
from. Its output is committed to `NVDA.md` so the result is reviewable without
rerunning it.

If you change what the tree contains and you can run NVDA, re-record and commit
the transcript. If you cannot, say so in the pull request. An out of date
transcript that is labelled out of date is fine; one that is quietly left to
imply it still holds is not.

## Before opening a pull request

```bash
npm run typecheck
npm test
npm run build
npm run check:prose
npm run check:fonts
npm pack --dry-run

cd demo && npm run typecheck && npm run build && npm run test:browser
```

Do not add a runtime dependency. There are none, and `three` stays a peer along
with the optional React ones.

Prose is British English and plain ASCII, checked by `scripts/check-prose.mjs`
rather than remembered. Fonts are self-hosted and subset, under the ceiling in
`scripts/check-font-budget.mjs`.
