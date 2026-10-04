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
  The confirming tap stays.
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

## Build 2 (next, needs a design pass each)

- Alerts that cannot be cleared: "No IXL account" as a `buildRows` status so the fixer actually clears the flag, band
  and tab dot (4–5 h). Needs attention: one line per cause, no dot without an action.
- Quarter close: the alert list must get shorter, not longer, and cards show the Q1 final rather than dashes (3 h,
  before 9 Oct if possible).
- Skill-header redesign (the 138 px `th.unit` and the clipped skill names) (3–4 h).
- `lastBackup` date and a "backed up N days ago" line; Guide's weekly list mentions backup (1 h).
- Default Working in from Focus's IXL columns (1.5 h).
- Race card to one line; Data Lab data-set select without 219 single-skill entries (3 h).
- Student page order and a one-page report (3–4 h).
- Font re-subset with `→ ← ≥ ≤` (fixes 73 of 130 missing-glyph uses), then four inline SVGs (check, warning, lock, trash).
- `min-width: 2ch` numerals; delete dead `tabular-nums`.
- Storage gauge (13 % of quota today, ~50–65 % by year end; a quarter of it a duplicated `skills` array).
- Board type ramp (≥ 31 px floor at 4 m) after the Race card cut.
- Then, behind the contract suite and Croix's decision: four components (button, segmented, card, table), one weight
  scale (900 used 97 times), spacing/radius tokens (17 radii, 8 control heights), the toolbar/IA redesign (Classes /
  Students / Board + Import), Focus check split into setup vs weekly diff, Settings by scope.

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
- Next: Build 2, starting with the quarter-close alert list and cards (before 9 Oct), then clearable alerts.
