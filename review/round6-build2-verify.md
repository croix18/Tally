# Round 6 · Build 2 — independent verification (4 Oct 2026)

Scope: the seven commits `16019cb..3725bec`. Driven with Playwright against `Tally.test.html` (built with
`build.py --test`), compared where needed with a worktree build of `16019cb` ("base"; worktree removed afterwards).
States used: `state-pool5s.json` (five pool classes, two courses, two imports), `state-real.json` (one scrubbed real
class), fresh imports of the fixtures, and synthetic Q2 gradebooks generated from the fixture names. No repo file was
edited; this report is the only file added. Scripts and 350 screenshots are in
`/tmp/claude-0/-home-claude/b89b0f3d-86a2-5e43-8a51-10fb416b8565/scratchpad/verify/` (screenshots in `shots/`).

Viewports: laptop 1400×900 · prom 1920×1080 touch · tabL 1280×800 touch · tabP 800×1280 touch · cbox 1366×768 ·
xga 1024×768 · zoom 700×450.

Two findings are P0, seven P1, the rest P2. The shipped `Tally.html` / `index.html` / `Scrub.html` are byte-identical
to a build of the HEAD sources and contain no `__tally`.

---

## P0

### 1. The student report prints a false sentence about the next assessment
`grades.js` `studentReportSection`, lines 292–294 and 312–313.

Repro: any class with a gradebook → More → Student reports → Everyone. Read the "Next assessment" row.

Seen (script `rep2.js`, `rep3.js`): the new single sentence **"One assessment alone won't change the letter — the work
above will."** is printed whenever no A/B/C is reachable. It is wrong in two directions.

- F students who can reach a D. The `reach` list only tests 90/80/70, so a D is never considered. Synthetic set:
  22 of 91 reports. Example `period-1` student 7: 53% F, report says the letter won't change; 14.5/21 on the next
  assessment makes it a D, 21/21 makes it 68% D.
- C and B students who can't reach the next letter. The `!can.length && cant.length` branch runs before `keep`, so the
  "N/M keeps the C" figure base printed is dropped and replaced by a claim that the letter can't move. Real class:
  3 of 23 (72% C: 0/27 → 62% D; 87% B: 0/27 → 76% C). Synthetic set: 21 of 91 (71% C: 0/21 → 52% F).

Base printed, for the same students, "an A isn't reachable on one assessment · a B isn't reachable on one assessment ·
15.5/27 keeps the C" — verbose but true. The second variant ("…; it will take more than one.") does not say more than
one what.

Expected: say only what was computed. "One assessment alone won't reach a C" (or the next letter actually tested,
including D), and keep the `keep` clause whenever `cur >= 70`.

This page goes home. It is the same class of error as Build 1's first fix.

### 2. Any earlier Tally.html deletes every pool class when it opens a Build 2 save
`app.js` `stateForSave` line 108 (`skills: null, poolSkills: true`), against `migrate` in every earlier build
(`16019cb` app.js line 57; HEAD line 81): `!Array.isArray(s.skills)` → `delete state.sections[k]`.

Repro (`s2-storage.js` part D, `s3-downgrade.js`): save once with HEAD, then open the 16019cb build on the same
browser storage (an older download of the file, a rollback, a stale copy on the same origin).

Seen: the old build loads with `order: []` and shows the landing "Both course exports are in. Now drop a Focus
gradebook for each period" (`shots/s2-D-base-opens-head-state.png`). No error, no `.broken` copy. Following that
instruction (one gradebook → + New class) saves: storage goes from 517,341 to 341,377 characters and holds one class.
Rosters, gradebooks, grade history, seating, quarter archives and overrides of all five classes are gone.

Precondition is an older copy being opened, so this is not a path inside Build 2 itself — but Croix receives a new
`Tally.html` each build, `file://` pages share one storage, and it also makes Build 2 impossible to roll back safely.

Expected: a save an older build can survive. Verified alternative (`s4-fixidea.js`): write `skills: []` instead of
`null` with the same `poolSkills: true`. The old build keeps all five classes (empty grid there, nothing deleted,
gradebooks intact), re-saves them with the flag, and HEAD restores 219/177 skills on the next load. Same size saving.

Inside HEAD itself I could not produce `skills: null` or an empty grid: see "Verified working".

---

## P1

### 3. The Overview no longer shows the class cards without scrolling
`home.js` `renderHome` lines 90–91 (Needs attention above `.hcards`).

Measured on `state-pool5s.json`, 4 Oct (`bshots.js`, `shots/cmp-*-home.png`), cards fully visible / top of the card row:

| viewport | base | HEAD |
|---|---|---|
| laptop 1400×900 | 4 of 5 · 244 px | 0 of 5 · 514 px |
| cbox 1366×768 | 4 of 5 · 244 px | 0 of 5 · 514 px (182 px of card showing) |
| tabL 1280×800 | 3 of 5 · 258 px | 0 of 5 · 553 px |
| xga 1024×768 | 3 of 5 · 346 px | 0 of 5 · 616 px |
| prom 1920×1080 | 5 of 5 | 5 of 5 |

That is with five attention lines. Right after an import on the tablet the "Last import" card stacks on top and the
cards start at 683 px of a 728 px board — titles only (`shots/ho1-tabL-home-after-import.png`). With the Q1 line and
ten lines (reopened quarter) it is worse. Missing work and Sliding are cut on every card at 1366×768
(`shots/cmp-cbox-HEAD-home.png` vs `cmp-cbox-BASE-home.png`).

Placing the list above the cards was the brief; the consequence is that the at-a-glance numbers left the first screen
on every device except the panel. Expected: cap the list (warnings shown, notes folded to one "N notes" line), or put
notes below the cards.

### 4. Data Lab on the 1920×1080 panel: the third on-level class falls off the board
`app.js` `LAB_ONLY_CSS` line 786: `.labPlot .chart{max-height:32vh}` (base: `min(32vh,260px)`).

Repro: Race → Data Lab → On-level (three classes), 1920×1080 (`lab2.js`, `shots/lab2-prom-HEAD-on-box.png`).

| graph | base | HEAD |
|---|---|---|
| box plot | 3 of 3 rows in view, 44 px scroll | 2 of 3, 222 px scroll |
| histogram / bar / circle | 3 of 3 in view, 75 px scroll | 2 of 3, 334 px scroll |

5th Period's dots and axis are under the tool bar. Three rows at 32vh cannot fit in 100vh. At 1400×900 and 1366×768
HEAD is equal or better than base, so this is specific to the room's panel. The default accelerated box plot also
overflows by 11 px there. Expected: divide the height by the number of rows.

### 5. A student marked "No IXL account" loses the link to their page
`app.js` `renderGrid` `nameCell` line 1235: only `ok` and `rosterOnly` get `data-prof`.

Repro: flag → No IXL account. Before: `<button class="nm nmbtn" data-prof=…>`. After: `<span class="nm">`
(`a1.js`, `shots/a1-more-menu.png` row 14, name not underlined). Their grades, what-ifs and report are still valid and
were one tap away in base, where `#none` stayed `rosterOnly`. Expected: add `noAccount` to that condition.

### 6. "copied ‹date›" disappears from the unit header as soon as the unit has a Focus badge
`app.js` `renderGrid` lines 1250–1254: the status slot shows the Focus badge *or* the receipt; the receipt otherwise
lives only in `.usub.det`.

Repro: calm view, a unit with a Focus IXL column, tap Copy. `th.unit .rlink` visible count = 0; the header still reads
"Focus: points differ" (`a2.js`, `shots/a1-more-menu.png`). Base showed the receipt link in both views. After the
toast fades there is no sign in the grid that the column was copied, and "who moved since I copied" is only reachable
by opening the unit. The Guide still says "The unit header then shows *copied ‹date›*" (`app.js` line 1518).
"out of N" also left the calm header (it is in every cell, so no loss).

### 7. Touch: the fixed header slots break when a unit has a Focus badge
`app.html` lines 342–349 against the touch rule line 458 (`.fcheck{min-height:36px;padding:6px 12px}`).

tabL and tabP (`h2.js`, `shots/h2-tabL-units.png`): Unit 1's badge is 154×36 in a column capped at 150
(`th.scrollWidth > clientWidth`), and its Copy button sits at 87 px from the header top while Units 2 and 3 are at
73 px. The `.ustat` slot is 22 px; the touch badge is 36. Every real class has a badge on at least one unit, so on the
tablet and the panel the row the redesign set out to align is misaligned by 14 px.

### 8. Choosing "— pick —" for Working in does not survive the next import
`app.js` `defaultWorkingIn` lines 383–388 (`if (state.settings.currentUnit[p]) return`).

Repro (`w1.js` A4–A6): pick "— pick —" on the class bar → `{acc:null}`. Import anything, even only the IXL export →
`{acc:1}` again. An explicit Unit 3 is respected (A3). "Unset" cannot tell "never chosen" from "cleared on purpose",
so once Focus has an IXL column past the review units the 25 % rule — listed under Croix's calls — is unreachable.

Also: within the 15-minute merge the "Last import" card keeps a stale line. After picking Unit 3 and re-importing, the
card still says "Accelerated — Working in set to Unit 1 …" while Working in is Unit 3 (A3).

When the default does fire on a state with history (B): Race movement is preserved (no "fresh start"; `moved` and
ranks unchanged) but both courses were set by one on-level gradebook import, and "IXL work at goal" moved 22 % → 43 %
(2nd), 29 % → 35 % (3rd) because the counted units changed. The import card says so; nothing on the cards does.

### 9. After closing Q1, "Quarters" opens a dialog titled "Close Quarter 2" with no end date
`quarters.js` `openQuarters` lines 178–181.

Repro (`q3.js`, `shots/q3-HEAD-after-close-dialog.png`): close Q1, tap the Quarters pill. HEAD: title "Close Quarter
2", primary button "Close Quarter 2", no caution (nothing is stale because no gradebook has Q2 work), and "Dec 18"
appears nowhere unless "Quarter dates…" is unfolded. Base: title "Quarters", heading "Close Quarter 2 (ends Dec 18)".
One tap closes Q2 on 12 Oct ("No gradebook had work from it"), the Overview becomes "Quarter 3". Reversible with
Reopen, but the screen a teacher opens to reopen Q1 or change a date now leads with closing the next one.

---

## P2

10. **Quarter dialog copy** (`quarters.js` 169–181, `shots/q2-dialog-ended.png`). "4 gradebooks here **was**
    exported" (any count from 2 to n−1). `allStale` compares with every class, so one class without a gradebook puts a
    red "older" on every row beside a caution that already says it. Before the end date a gradebook exported today is
    tagged "older" (base said "frozen at this export"). After a reopen: "4 assignments (kept from an earlier export)
    exported Oct 12" — the date is the Q2 file's.
11. **Changing a date drops hand-ticked units.** Tick Unit 2, change a date: the tick is gone and the summary reverts
    (`q1.js`). The fold state is kept, the picks are not. Present in base, but the ticks are now behind a fold.
12. **New touch targets under 44 px** (`ho1.js`). `.hatt li .hgo` (0,2,1) beats the touch rule `.hatt .hgo` (0,2,0):
    the per-class chips are 30 px on tablet and panel. "Dismiss" is 47×18. `#back` is 36 px (38 in base).
13. **Student tiles at ≤ 900 px** (`students.js` 418–419). The `1fr 1fr` media query is declared before the
    `auto-fit` rule of equal specificity and never applies: 800 px gives three tiles and an orphan
    (`shots/st1-real-F-800.png`).
14. **Unit view render cost** (`app.js` `fitSkillHeads` 1221). 5.6 → 41 ms per render on the laptop; 96 → 183–222 ms
    at 4× CPU throttle, 102–138 ms of it the measuring loop, re-run from 84 px on every cell tap and search keystroke.
    Units grid 6.5 → 11.8 ms (every tab now runs `reconcile` and `fitCategories` for its dot).
15. **Accessibility.** `.ukey` is `aria-hidden`, so the legend and "Tap a skill to skip it for the course…" are no
    longer announced (the bar legend was). Seat flag buttons: the tick is `aria-hidden` and there is no
    `aria-pressed`, so on and off read the same. Under 1100 px the student page's visual order differs from DOM order.
16. **Race** (`r1.js`). At 1920×1080: tags 18.2 px, league and basis 22.1 px, card lines 25.9 px — under the 31 px in
    the findings file and, for tags and league, under the 25 px the CSS comment states. "31% complete" and "nearly
    all" sit 16–21 px apart on one baseline and read as one phrase. First-week and goal-changed cards state completion
    twice. One league or one class: cards stay 173 px and more than half of the board is empty (`.lbLeague` is not
    stretched outside `.two`).
17. **Data Lab.** "4th Period · On-level" breaks at the hyphen in the name column while the subtitle already says
    "on-level classes". `.labStats span` 15.4 px and the stem key 20 px at 1080p. On tabP with a skill selected the
    tool bar is three rows (172 px) inside a 999 px-radius pill over the last row (`shots/lab-tabP-skill.png`).
18. **Print pages now carry app CSS.** `printFontCss()` returns all of `#tallyFont`, which is the font plus 77 lines
    of app rules (`app.html` 7–84). The five popups get `.cats{display:flex;min-width:260px;flex:1}` (the report's
    category table computes to `display:flex`), `.dstat{padding:10px 12px}`, `body:not(.details) .det{display:none
    !important}` and five undefined `--t-*` variables. Nothing visibly breaks today; any future `.det`, `.cats`,
    `.bar` in a print page will. Saved Race page: cards don't fill the height (163 px vs 250 in-app).
19. **Unit subtitles truncated more often**: 22 of 30 ellipsized (base 13 of 30 cut), tooltip only. In "Just Unit 3"
    the column is 1,070 px wide and the title is still "Exponents and Sci…" (`shots/h2-laptop-just-unit.png`).
20. **IXL tile** (`students.js` 153–158): "17% · 10 of 59 skills · class average 33.5" has no unit, and the average
    is over every IXL account in the snapshot (33.5) rather than the roster-matched population used elsewhere (33.1).
21. **"No IXL account" wording is inconsistent**: Still owed says "No IXL account."; the report says "IXL progress
    isn't available for this student yet."; the student tile says "not matched to IXL".
22. **Guide is stale**: "notices under the class chips", "header then shows copied ‹date›", Working in described as
    a manual pick only. It is also three printed pages under the title "one-page guide" (three in base too).
23. **Storage warning advice**: with 3.9 M characters from another page on the origin the Overview says "remove an
    old class or gradebook" while Tally holds 0.5 MB.
24. **Dead code and a hollow test.** `.lbLeagueMover` (no markup); `toFixed(n < … ? 1 : 1)` in `storageUse`;
    `tests/seating.js:66` still greps for 🔒, which can no longer occur — it should count `.lockmark`.
25. **Backup date**: `lb.slice(0,10)` is the UTC date, so a backup saved after 8 pm reads "today" the next day.
    `lastBackup` is set when the button is tapped, not when a file is written (not testable here on `content://`).
26. Every quarter closed: cards read "Q4 gradebook not in yet" (wording as in base).

---

## Verified working

Quarter close
- Dialog 556 px tall at 1400×900, no inner scroll; units and dates folded; summary line updates on tick.
- Before the end date: "doesn't end until Oct 9". After: stale caution. Class without a gradebook: "nothing to keep".
- After closing: cards show "Focus · Q1 final NN%" and "Q2 gradebook not in yet", no letters, no zeros, no per-class
  waiting lines; bar says "no gradebooks yet", then "3 of 4 gradebooks still to come" after one Q2 import.
- Reopen restores alerts; all four closed shows "Every quarter is closed" with dates and Reopen Quarter 4.

Alerts
- "No IXL account": status `noAccount`, flag and count clear, re-flag works. Clipboard copy is 23 lines with a blank at
  the student's position in all three copy modes. Still owed prints "No IXL account."; seating keeps the student;
  Race numbers and population unchanged.
- Tab dot equals `attentionItems` warnings for all five classes.
- Calm view: chip in the bar opens and closes the list in grid and unit views; absent on Grades; Details shows the
  full list. Waiting class: no "not in IXL" flags, notice shown unprompted.
- Names off: no roster name in the grid, notices, fixer, toast or Overview (text, titles and aria-labels checked).

Backup, Working in
- Backup line after an import, clears on save, survives reload (suite `round6.js` re-run: 31 pass).
- Default sets accelerated to Unit 1, leaves on-level when its only Focus column is the review unit, and writes the
  line. An explicit unit is never overwritten. Manual Assigned marks still win (read in `unitsOf`, not driven).

Headers
- No skill name clipped in any of the 30 units of both courses at all seven viewports (base clipped up to 5 per unit).
- Rows visible, base → HEAD: units grid 12 → 14 (laptop), 8 → 10 (cbox), 7 → 9 (tabL); unit view 8 → 12, 5 → 8,
  4 → 8, and 0 → 2 at 700×450.
- Sticky header, name column, Points column and footer hold while scrolled both ways. Focus ring 3 px on skill and
  header buttons. Header handlers all fire (open unit, Focus check, receipt, Copy, skip skill, skip cell, CSV, Esc).

Board
- No text overflow or overlap in any Race variant (both leagues, one league, one class, tie, first week, goal
  changed, nearly all, 100 %) at 1920×1080, 1400×900, 1366×768, 1024×768, 800×1280.
- Data set select has 25 options; "A single skill…" opens the current unit's skills in a second select.
- Focus data sets: 0 dots, 0 value chips, no Dots or Values button, even with both forced on in settings; only box,
  histogram, circle and line offered; SVG titles are aggregates. Same in the saved page.
- Saved Race and Data Lab pages: DM Sans loads, no script, no network request, no student name, no `__tally`.

Student page and report
- Tiles and sparklines for a student with nothing missing, an A student, an unmatched student, and closed-quarter
  states. Under 1100 px the plan and what-ifs come first. "Not started" folds above four skills.
- Show student: band stays at the top while scrolled, "Show me on the sliders" moves 47 % F to 62 % D, a short press
  does not exit, a 1.9 s hold does.
- Report: 23 pages for 23 students in both states (the real class was 28 pages in base), DM Sans loaded.

Glyphs
- No character outside the font on 17 screens and dialogs, including pseudo-elements; no literal `<svg` or `${`.
- Font is the same DM Sans 4.004 with eight added code points and identical metrics. CSV and clipboard carry no markup.
- All five popup pages load DM Sans.

Storage
- Old-shape save loads, slims 688,967 → 517,341 characters, reloads identically.
- Course switch in Settings, removing a class, a pool re-import with ten fewer skills, backup → Clear all → re-import
  → restore, and a deleted pool: every class kept an array of skills and its rows. Backup JSON carries no `skills`
  or `poolSkills`. Suite `migration-and-history.js` re-run: 13 pass.
- Gauge reads 0.5 of 5.0 MB; at 84 % the Overview line appears and Settings names the other pages' share.
