# Round 6 findings — the Apple review (3–4 Oct 2026)

Four reviewers, each with a different Apple lens and a deliberately opposed starting position, then a crit in which each
read the other three and had to trade. Full reports with screenshots cited: `review/round6-visual.md` (type, spacing,
colour, hierarchy — "under-designed, polish is worth the time"), `review/round6-interaction.md` (feedback, focus,
keyboard, touch, semantics — "correctness before polish"), `review/round6-product.md` (jobs, taps, words, naming —
"remove before polishing"), `review/round6-engineering.md` (performance, CSS architecture, cost/risk of every ask —
"ship outcome-per-risk"). Each file ends with a `## Crit response` section: its first-build picks, what it opposed with
evidence, what it withdrew, and what all four would sign.

**Status: see "Build log" at the end** — kept current so a new session can pick up mid-way.

## What all four signed

1. The quarter-hour fixes land first: the false "One test alone can't get you to a C" sentence shown to B and C
   students on Show student (`students.js` `recompute` fallback); `.warnline` painting over the line above it in the
   Focus check and Close Quarter dialogs (`app.html`, inline → block); the header focus ring that can never match
   (`header .pill:focus-visible` while `#top` is a `<div>`) and the Race's `#lbExit` with pointer handlers only (a
   keyboard trap, and a reload reopens Race).
2. The Overview must not show "Focus ✓" while a unit is stale ("2 up since copy" on the class grid, a tick on the home
   card). `home.js` `focusChip` / `attentionItems`, `app.js` notice chain. Wrong feedback outranks missing feedback.
3. The board stays the scroller (document scroll breaks the sticky table header — prototyped). Shell rules A + B: a
   floor under `#board` and a one-row header down to ~1,070 px, so the Chromebox and 150–200 % zoom show rows again.
   Rule C (a 120 px skill header) is withdrawn: it clips 19 of 23 skill names; the skill header needs a redesign instead.
4. An import's result stays on screen — one line on the Overview (not a sixth dialog, not a pre-commit sheet), the
   import lands on the Overview rather than the last class's grid, and the first-run toast stops saying "import a
   Focus gradebook for each period" about gradebooks it just imported.
5. Four CSS rules are bugs, not design: `.gcard b em.lt` out-specifying `em.lt.F` (an F chip in the "fine" colour),
   `.lbCard.r3 .lbChip` vs `.lbChip.gain` (1.62:1 chip), the dead `header .pill` selector, `#bar.detail .pill.onbar`
   (white-on-white Copy in the unit view); plus `var(--t-m,16px)`-style fallbacks in Show student that never apply.
6. Show student: the result must stay beside every switch (sticky `.shGrade`, compacted), and the trend card goes —
   sticky alone pins 37 % of the tablet; cutting alone leaves the plan below the fold. Both, as one change.
7. A layout-contract test suite before any type-ramp, spacing or component refactor: the engineer ran the 548 checks
   against a build with 14 deliberate visual regressions (magenta ink, no sticky header, no font…) and all passed.
8. `--test` builds to its own file (`Tally.test.html`) so a reviewer's rebuild can never ship `window.__tally`.
9. Remove before polishing — but only what isn't a recorded decision. Upcoming unit columns, Just Unit N and the
   seating row toggles are Croix's calls (NOTES records why); the notice band → a count, and "assigned by guess" out
   of Needs attention, are not.

## Opposed and settled

- Document scroll (interaction) — withdrawn for shell A + B.
- Pre-commit import sheet (interaction, 10–14 h) and auto-routing gradebooks when "names match" (product) — both
  withdrawn: `pickSection` calls a half-match a match, and a one-level checkpoint undo is overwritten by any save.
  The confirming tap stays. (Reversed 4 Oct at Croix's request, with a stricter match — see the build log.)
- Removing the two student-page charts (product) — withdrawn: only the chart carries the class average and NOTES records
  "trends" as the ask. They become small sparklines inside the tiles later.
- Tabular figures (visual) — DM Sans has no `tnum` upstream either; a digits-only face reads letterspaced. Fix is
  `min-width: 2ch` + right-aligned numeric columns, and deleting the eleven dead `tabular-nums` declarations.
- Undo on skill-header taps (interaction) — the tap is its own inverse (verified byte-for-byte); hold the toast longer
  and spend checkpoint-undo on Close Quarter and category changes instead.
- Toast at the top (visual) — it would cover the class tabs; stays at the bottom, clear of the footer, never over a dialog.
- "Copy" buttons on Overview rows (product) — the roster-mismatch notice lives on the class page and the routine says
  to check it first; the row opens the class at that unit instead.

## Build 1 (this week, ~10 h, one series of commits)

| # | change | where | status |
|---|---|---|---|
| 1 | False "can't get you to a C" sentence for B/C students | `students.js` `recompute` | done |
| 2 | `.warnline` as a block; the quarter caution said once | `app.html`, `quarters.js` `openQuarters` | done |
| 3 | Focus rings on header pills, dialog ×, Race/Lab pills; keys on `#lbExit`; `touch-action:none` on `#shExit` | `app.html`, `app.js`, `students.js` | done |
| 4 | Specificity leftovers and the `--t-m` fallbacks | `app.html`, `students.js` `STU_CSS` | done |
| 5 | Stale units in `focusChip`, `attentionItems`, the notice chain — no "Focus ✓" over a stale unit | `home.js`, `app.js` | done |
| 6 | Shell A + B: board floor, one-row header to ~1,070 px | `app.html` | done (floor 460 px so a 7-class tab strip still fits a 900 px laptop) |
| 7 | Import: one result line on the Overview that stays; land on `home`; fix the stale first-run sentence | `app.js` | done — one card, merges drops within 15 min, a single file for one class still lands on that class; the landing also reports course exports |
| 8 | `#empty` hidden at start (no landing flash on slow devices) | `app.html` | done (+ `font-display:block` so the embedded face never paints the fallback) |
| 9 | `--test` builds `Tally.test.html`; tests load it | `build.py`, `tests/lib.js`, `tests/run.js` | done |
| 10 | Show student: sticky compact result, trend card out | `students.js` | done — the sticky band is name + grade (~190 px on the tablet); category bars moved below the switches |
| 11 | Layout-contract suite (`tests/contract.js`): one-row header; ≥ 9 grid / ≥ 5 unit rows at 1366×768; sticky header + name column; ring ≥ 3:1; F chip coral; DM Sans applied; no horizontal overflow; shipped build has no `__tally` | `tests/` | done — `tests/contract.js`, 39 checks; tablet unit view floor is 4 rows until the skill header is redesigned |

## Build 2 (shipped 4 Oct)

| change | commit | what it is now |
|---|---|---|
| Quarter close goes quiet | `78e3092` | Waiting cards show "Focus · Q1 final NN%" and "Q2 gradebook not in yet" — no dashes, zeros or letters; the alert list gets shorter after a close |
| Alerts that can be cleared | `c203316` | `noAccount` row status ("No IXL account" in the fixer clears flag, notice and tab dot); Needs attention is one line per cause (`attentionGroups`), no dot without an action; the notice band is a count chip in the bar |
| Backup line | `c203316` | `state.lastBackup`; "backed up N days ago" on the Overview and in Settings; a nudge when imports are newer than the backup; the Guide's weekly list mentions it |
| Working in from Focus | `c203316` | `defaultWorkingIn()` at import: latest unit with a Focus IXL column, never a review unit, never over Croix's own choice (`curUnitTouched`) |
| Column headers | `425b18e` | Unit headers in fixed slots (title / status / action); skill names vertical on up to four lines, none clipped; laptop grid 13 rows, unit view 11 (was 9 / 5) |
| The board | `45b0603` | One unit `--bu` sizes Race and Data Lab for the room; `LB_CSS` single source for app and saved page; Race card one line; Data Lab list without 219 single skills |
| Student page and report | `6052267` | Tiles with sparklines, answer first, right-aligned numerals, dead `tabular-nums` gone; printed report is one page per student |
| Glyphs | `d37fc55` | Font re-subset (+ ← → ↔ ≤ ≥ ≈ ≠ ∞, recipe in `fonts/README.md`); check / warning / lock / trash etc. as inline SVG (`ico()`); every print page embeds DM Sans |
| Storage | `3725bec` | Pool classes don't save a second copy of `skills` (`stateForSave`); gauge in Settings; warning on the Overview when nearly full |
| Verifier fixes | `2ab0946` | See below |

### The independent verifier (`review/round6-build2-verify.md`) — 2 P0, 7 P1, 17 P2

Fixed:

- **P0-1** The report told F students one test from a D that "one assessment alone won't change the letter". Now
  `nextAssessment()` in `grades.js` feeds the report, the student page and Show student; `tests/round6.js` checks the
  sentence against the grade maths for every synthetic student.
- **P0-2** A Build 2 save opened by an older Tally.html deleted every pool class (`skills: null`). Saved as
  `skills: []` with `poolSkills: true`; an old build shows the class empty instead of dropping it, and the new build
  rehydrates.
- **P1-3** Overview: class cards are back on the first screen (notes folded into "N notes", import card collapsed
  unless something failed). **P1-4** Data Lab rows fit the 1920×1080 panel with three classes. **P1-5** A "No IXL
  account" student is still a link to their page. **P1-6/7** "copied ‹date›" is back in the unit header beside the
  Focus badge and Copy lines up across units on touch. **P1-8** "— pick —" for Working in survives the next import
  (`curUnitTouched`). **P1-9** "Quarters" opens on the dates; closing before the end date is a fold.
- **P2** 10 (verb agreement, "older" only when it's news, "kept from an earlier export"), 11 (ticked units survive a
  date change), 12 (44 px chips), 13 (two tiles per row ≤ 900 px), 14 (`fitSkillHeads` cached per unit), 15 (legend
  announced, `aria-pressed` on seat flags), 16 (board sizes; single league fills the board; one completion figure per
  card), 17 (the name column drops the "· On-level" the subtitle already says), 18 (`printFontCss()` returns only `@font-face`), 19
  (subtitles use the column's full width, full text in a tooltip), 20 (class average over the roster-matched students, with a unit), 21 (one
  wording: "No IXL account"), 22 (Guide text), 23 (storage advice names the real cause), 24 (dead code; the seating
  test counts `.lockmark`), 25 (local date), 26 ("every quarter is closed").

Still open (small, none blocks use):

- The Guide prints on three pages (retitled "Tally — guide"; it was three pages before this round too).
- `lastBackup` is stamped when Backup is tapped; a browser doesn't report whether the file was written.

### Build 3 candidates (behind the contract suite, and Croix's decision)

Four components (button, segmented, card, table); one weight scale (900 is used 97 times); spacing/radius tokens
(17 radii, 8 control heights); the toolbar/IA redesign (Classes / Students / Board + Import); Focus check split into
setup vs weekly diff; Settings by scope; the engineering memo cache.

## Croix's calls (recorded decisions the reviewers would revisit — not changed without him)

- Upcoming unit columns / Just Unit N / the 25 % rule vs a single "Ahead" column (product 5; 8–12 h, high risk).
- The 92 per-row seating toggles (built on request in round 4).
- Android/browser Back handling (a naive version lets Back exit Show student or Race).
- The nine-pill header → a four-item one.

## Build log

- 4 Oct: reviews and crit complete; this file and `ROUND6_CONTEXT.md` committed with the four reports.
- 4 Oct: Build 1 shipped (all eleven rows above). 20 suites, 587 checks. Also fixed on the way: the Close Quarter caution
  now says "hasn't ended yet" before the end date instead of "exported before it ended"; the landing after a course-only
  drop says what landed and asks for the gradebooks instead of "Drop your IXL Score Grid here" again.
- 4 Oct: Build 2 shipped in seven commits (`78e3092` … `3725bec`), model switched to Opus part-way. 21 suites, 632
  checks at `3725bec`. New suite `tests/round6.js`; `tests/contract.js` raised its floors (laptop 13 / 11 rows).
- 4 Oct: independent verifier run against Build 2 — 26 findings, report in `review/round6-build2-verify.md`. Both
  P0s and all seven P1s fixed, 17 P2s fixed or noted above. Full suite green after the fixes: 21 suites, 640 checks.
- 4 Oct: gradebooks place themselves on import (Croix asked; reverses "the confirming tap stays" under "Opposed and
  settled" — the strict bar in `matchSection` answers the half-match objection). Details in NOTES.md, tests in
  `tests/auto-place.js`. Same commit: the Data Lab tool bar is a rounded panel when it wraps (portrait tablet), the
  stem-and-leaf key is 26 px at 1080p, and `[hidden]{display:none!important}` — `.warnline` as a block had been
  showing the New-class dialog's empty warning as a beige bar since Build 1.
- 4 Oct: Croix picked "Simplify the header" as the next build and asked for a mockup of the single "Ahead" column
  before deciding on it; both mockups are in `review/mockups/` with what each would take. The Focus export's file
  name is generic, so a new class still asks period and course once.
- Next: build the header once Croix says go on the mockup; the Ahead column only if he chooses it. Build 3 candidates and "Croix's calls" wait for him.

## Handoff for the next session (any model)

1. `git clone https://github.com/croix18/Tally.git` into `/home/claude/Tally`, `npm install`, read `NOTES.md` then this file.
2. Croix pastes a GitHub token; store it as described in `GITHUB_FROM_A_CLAUDE_SESSION.md` (never in a URL, commit or
   message) and push with the `extraheader` recipe there. Commit as Croix with the two trailers NOTES.md shows.
3. Work order (Build 2 is done — Build 3 only on Croix's word): one commit per change, `npm test` green (21 suites; `tests/contract.js` is the visual net, `tests/round6.js` covers Build 2),
   `python3 build.py` before every commit (`grep -c window.__tally Tally.html` → 0), push, verify `ls-remote` equals
   `git rev-parse HEAD`, update this build log, deliver `Tally.html` into the chat.
4. Don't change anything under "Croix's calls" without asking him. Test with the scrubbed fixtures only; he can't upload
   real student data.
