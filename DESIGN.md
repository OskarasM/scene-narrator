# DESIGN

The visual system for `demo/`. Values live in `demo/src/tokens.css`, the shared
pieces in `demo/src/chrome.css`, and everything specific to this site in
`demo/src/index.css`.

## Theme

**Light.** The physical scene: somebody at a desk, in daylight, reading several
hundred words and a scrolling transcript to decide whether a library is worth
their afternoon. That sentence forces the answer. Its two sibling sites are
dark because one is an instrument panel and the other is a room you stand in;
this one is a document you read, and a document is read in daylight.

## Colour

Strategy: **restrained**, with one committed moment. Tinted neutrals plus a
single accent, and one full-bleed accent strip used exactly once on the page.

| Token | Value | Role |
|---|---|---|
| `--ground` | `#faf8f4` | Page |
| `--panel` | `#f2eee6` | Anything with a border round it |
| `--panel-raised` | `#eae4d8` | One step up, rarely |
| `--line` | `#ddd6c8` | Every division on the page, at 1px |
| `--ink` | `#14120e` | Body. 17.6:1 on ground |
| `--muted` | `#5f5a4f` | Ledes, secondary prose. 6.5:1 |
| `--dim` | `#6e6759` | Chrome labels. 5.3:1 |
| `--accent` | `#a4531c` | The library speaking. 5.2:1 |
| `--accent-ink` | `#faf8f4` | On the accent. 5.2:1 |
| `--accent-wash` | `rgba(164, 83, 28, 0.07)` | Announcement rows, tab hover |
| `--warn` | `#a81f14` | The silence it replaces. 6.9:1 |
| `--series-a/b/c` | `#a4531c` / `#2f5d50` / `#4a3f8f` | Named comparison series only |

Every pair above is computed, not eyeballed, and every one clears WCAG AA for
normal text. **A hue may appear only if it appears in a legend**, and no
encoding is ever carried by colour alone: the announcement rows in the
transcript are also labelled in words, and the support matrix says PASS and
UNVERIFIED rather than showing green and grey.

`#a4531c` rather than the `#b4622a` originally chosen: the lighter ochre
computes to 4.49:1 and fails AA for normal text, so it could not carry the mono
chrome on the accent strip.

## Typography

Three registers, never anything between them. Self-hosted, subset, with
metric-matched fallbacks computed from the font binaries; 103.9 kB against a
150 kB ceiling checked in CI.

| Register | Family | Used for |
|---|---|---|
| Chrome | Commit Mono | Labels, units, timestamps, table headers, buttons, code |
| Body | Atkinson Hyperlegible Next | Every sentence |
| Display | Literata | h1 to h3, and the sentence the library wrote |

**Atkinson Hyperlegible Next** is the Braille Institute's legibility-research
face, drawn so that characters which usually collide stay distinct. On this
site of the three that is an argument rather than a decoration.

**Literata** is a reading serif commissioned for long-form screen reading, used
at reading size for most of the page. It is not a display serif and there is no
italic file in the repository, so nothing can accidentally set one and get a
synthesised slant. The pairing works on a contrast axis: serif display against
a humanist sans body against a monospace chrome.

Scale is fluid `clamp()`, `--step--1` (11px) through `--step-5`. Nothing on the
page sets a size outside the scale. Display tracking is `-0.014em`; a serif
needs less negative tracking than a grotesque because its serifs already close
the gaps. Body copy is capped at 68ch. `text-wrap: balance` on headings,
`pretty` on prose.

## Structure

**The transcript rail.** A fixed 92px timestamp column on the left and a 250px
annotation margin on the right, both ruled with one hairline that runs the
whole page rather than restarting at each section. The stamp is sticky within
its own section, so the rail reads as a timeline rather than a list of labels.
There are deliberately no horizontal dividers between sections.

Sections are marked `00:00 / 00:04 / 00:11 / 00:19 / 00:26 / 00:33 / 00:38`,
because a timestamp is the currency this library is measured in. This is the
one deliberate numbered sequence on the page, and its siblings use different
markers entirely (`01 /` and `t+120ms`), so it is voice rather than scaffolding.

At 1080px the annotation margin folds under the body; at 760px the rail
collapses and the stamp becomes the first line of its section rather than
disappearing.

## Spacing

Two scales, never mixed. The test is whether the block contains a number.

- `--gutter: 12px` for anything with a number in it.
- `--gap-prose: clamp(40px, 5vw, 100px)` and `--pad-section: clamp(76px, 9vw, 132px)` for anything with a sentence in it.

Fixed row heights on everything that repeats or updates, so a live table holds
its grid instead of reflowing every tick. Every fixed-height row has a
`min-width: 0` child with an ellipsis.

## Components

Shared with both sibling sites, byte-identical apart from the brand mark
geometry: site header, site footer, brand, install command with copy states,
code card, tab picker as a real `fieldset` with a `legend`, buttons, tables,
and the accessibility floor.

Specific to this site: the rail section (`ui/Line.tsx`), the instrument strip
under the scene, the scrolling transcript, the live readout grid, the
sparkline with its table alternative, and the closing band.

## Motion

One duration (`--t: 180ms`), one curve (`cubic-bezier(.2, .8, .2, 1)`), one
gesture (`translateY(-2px)` on hover). There is no entrance motion and no
scroll reveal, deliberately: the page's own content is already in motion
continuously, and a fade-in on a page whose subject is a scene that moves would
be decoration competing with content.

Motion is content here, so `prefers-reduced-motion` does not remove the scene.
It starts paused and the strip says why, which is the only honest answer for a
demo whose entire subject is a scene that moves.

## What this system does not do

No border radius anywhere. No gradients. No backdrop filters. No drop shadows;
the single `box-shadow` in the shared chrome has zero blur and zero offset, so
it is a ring rather than a shadow and fakes no depth. No side-stripe borders.
No texture beyond one 2% wash on panel interiors, never on prose.
