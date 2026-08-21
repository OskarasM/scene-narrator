# NVDA verification

Shipping an accessibility library that has never been tested with a screen reader would be
absurd, so this file exists and is a precondition of publishing rather than a nice-to-have.

Two separate things are recorded here:

1. **The mount point probe.** Does NVDA reach canvas fallback content at all? The library's
   default depends on the answer, and Chromium's internal accessibility tree cannot answer
   it, because NVDA reads through UI Automation and that is a different thing.
2. **The manual pass**, in browse mode and focus mode separately, with the transcript
   written down. A component can work in one mode and be broken in the other, so untested in
   both means untested.

**Scope: NVDA on Windows only.** VoiceOver, JAWS, Narrator and TalkBack are untested. That
is stated as a limit everywhere it is relevant, and never softened into "should work".

---

## Environment

NVDA_ENV_PLACEHOLDER

---

## 1. Mount point probe

The question: canvas fallback content costs zero layout time on Chromium
(see [SPIKE.md](SPIKE.md)), but is it actually reachable by a real screen reader?

`bench/nvda-probe.mjs` serves one page with the same content in two places, inside the
`<canvas>` as fallback content and beside it as an ordinary sibling, and reads through it
with NVDA driving a real Chromium.

PROBE_RESULT_PLACEHOLDER

---

## 2. Browse mode

Browse mode is NVDA's default on a web page. The arrow keys belong to NVDA for reading the
document, H jumps between headings, and the page's own key handlers mostly do not fire.
This is how a screen reader user meets a page they have not seen before.

BROWSE_TRANSCRIPT_PLACEHOLDER

---

## 3. Focus mode

Focus mode is what NVDA switches into when the user tabs to a control, or presses
NVDA+space. Keystrokes now reach the page, so the library's arrow key handling is live. This
is a completely different code path from browse mode and a component can pass one and fail
the other.

FOCUS_TRANSCRIPT_PLACEHOLDER

---

## 4. Keyboard only, screen reader off

KEYBOARD_PLACEHOLDER

---

## What this does not cover

- **VoiceOver and JAWS.** Untested. Not "expected to work".
- **NVDA on other browsers.** Tested against Chromium only.
- **Braille output.** Not tested at all.
- **Real users.** Everything here is one developer testing their own library. That is
  necessary and it is not sufficient, and the difference matters. Feedback from people who
  actually use a screen reader daily would be worth more than all of it.
