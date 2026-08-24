# PRODUCT

## Register

**Brand.** The deliverable at `demo/` is the design itself: it is the page an
employer or a prospective user opens to decide whether this library is worth
their afternoon. The library it demonstrates is a product; the page is not.

## What this is

`scene-narrator` gives a moving Three.js scene a navigable accessibility tree
without spending the frame budget on it. A `<canvas>` contributes nothing to
the browser's accessibility tree, so an interactive WebGL scene fails WCAG
4.1.2 outright, and the usual fix, one hidden DOM node per object rewritten
every frame, is slow before it is unusable and unusable before that.

The site exists to make one argument in the order somebody will accept it:
hear it, understand why the obvious answer fails, watch every sentence it
writes, check what it costs, read what a real screen reader said, and then see
what it cannot do.

## Who it is for

Two audiences, and they arrive with different questions.

- **A developer with a WebGL scene and an accessibility requirement.** They
  want to know whether this works, what it costs, and how much of their
  afternoon the integration takes. They will not read a paragraph before they
  have seen the thing run.
- **Somebody deciding whether to hire the author.** They are reading the work
  as evidence of judgement. Measurements, stated limits and published negative
  results are the thing they are actually assessing.

Both are served by the same page, which is why every measured claim links to
the file that produced it and why the honest limits get their own section
rather than a footnote.

## Brand personality

**Measured. Plain-spoken. Unflattering to itself.**

The voice is a laboratory notebook rather than a pitch. It states what was
measured, on what machine, over how many runs; it publishes the results that
do not flatter it, including three screen readers that have never been tested
and a Firefox result that undercuts one of its own design decisions.

The one moment of showmanship is the sentence set at display size under the
canvas, and it is showmanship precisely because it is not written by a human:
it is the string the library last put into the accessibility tree, verbatim.
The loudest text on the page being machine output is the whole argument in one
line.

## Anti-references

Carried from the design plan for the three-site set, and enforced rather than
remembered.

- **No centred hero.** Everything hangs off the left rail.
- **No drop caps, no italic display face, no three-column broadsheet grid, no
  ruled masthead.** Cream ground plus a reading serif plus a terracotta accent
  is one of the most template-like combinations in circulation, and the
  distance from it has to be structural rather than a matter of taste.
- **No eyebrow above a section heading.** Sections are marked by the timestamp
  on the rail, which is the unit this library is actually measured in. Eyebrows
  appear only as figure captions and as the titles of margin panels.
- **No stock illustration, no icon-and-heading card grid, no hero metric.**
- **Nothing that reads as a SaaS landing page.** No pricing tiers, no logo
  wall, no testimonial, no "trusted by".

## Strategic design principles

1. **The page has to work with no WebGL context at all.** A machine with
   hardware acceleration off, or a headless CI runner, still gets the whole
   argument: both tables of recorded measurements, the NVDA transcripts, and
   the limits. There is a test asserting exactly that.
2. **Live figures and recorded figures are visibly told apart**, by heading and
   by wording. Presenting a recorded number as a live one is the easiest way to
   make a measurements page dishonest, and it is usually done by accident.
3. **Every number links to the file that produced it.** No figure appears
   anywhere without a committed script behind it.
4. **The demo is held to the library's own standard.** An accessibility project
   whose demo fails an audit is a liability rather than a demonstration. The
   browser suite gates every pull request.
5. **The three sites share a contract and differ structurally, not by hue.**
   The greyscale test is the acceptance test: this one has to read as a ruled
   column of text with a hard left rail where its siblings read as a grid and
   as a horizontal axis.

## Accessibility

Non-negotiable and asserted, not claimed.

- axe clean at WCAG 2 A and AA, in Chromium, on every pull request.
- Skip link first in the document; visible 2px accent focus ring at 4px offset
  on everything focusable, never removed.
- 44px minimum target height at 375px for every control that is not inline in
  a sentence.
- No horizontal overflow at 375, 768, 1024 or 1440.
- Every scrollable region reachable by keyboard, with a name.
- Never colour alone: every encoding is also carried by a word.
- Motion is content here, so a reduced-motion preference turns autoplay into a
  play button rather than removing the scene, and the page says so.
- Focus is indicated on something a sighted user can see, because the element
  that actually holds focus lives inside the canvas and is visually hidden.

## Tech

Vite, React 19, TypeScript, React Three Fiber 9, Three.js 0.185. No runtime
dependencies in the library. Deployed on Vercel from `demo/`.
