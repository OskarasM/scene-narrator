## What changed

Describe what this changes about what reaches the accessibility tree, or why it
changes nothing there.

## Verification

- [ ] `npm run typecheck && npm test && npm run build`
- [ ] `npm run check:prose`
- [ ] `cd demo && npm run typecheck && npm run build`
- [ ] `cd demo && npm run test:browser` when anything on the page changed
- [ ] No number was added to a document or the site without a committed script
      behind it
- [ ] Live figures and recorded figures are still visibly told apart

## Accessibility review

- [ ] Every area still has a heading that means something read on its own
- [ ] Descriptor callbacks are still called on the cadence, not per frame
- [ ] Focus is still indicated on something a sighted user can see
- [ ] `NVDA.md` is either re-recorded or labelled as covering the previous state
