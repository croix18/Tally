# Wozniak — round 5: whole-project debug pass (source read + Playwright)

28 Sep 2026. Test build `python3 build.py --test`; Chromium via `tests/lib`; probes `q1.js`–`q15.js` in my scratchpad
(`…/scratchpad/w5/`, setup = both course exports → `focus_gradebook_pool_p1/p2.csv` → period 1 acc / period 2 on).
Viewports: 1400×900, 1920×1080 touch, 1280×800 and 800×1280 (`hasTouch`, `isMobile`). Nothing in the repo was edited.
Every item was reproduced in the browser unless marked "by reading". Line numbers are `app.js` unless another file is
named. The existing suites (`pool`, `hardening`, `command-center`, `grades`, `seating`) pass at HEAD: 201/201.

## P0 — a page error on an ordinary path

### 1. Switching a class's course in Settings while a unit is open throws and leaves the old unit on screen
**Where:** `renderBar` l.1060–1061 — `const u = units.find(u => u.name === view.unit); const ex = u.idx.length - …` has no
guard; `renderGrid` l.1153 has one (`if (!u) { view = units; … }`) but `render()` (l.994) calls `renderBar` first.
`openSettings` → `#mSave` l.1614–1618 changes `s.prep`, `materialize(s)` swaps in the other pool's skills (177 vs 219, other
unit names), then `close()` → `render()`.
**Repro (q10.js):** period 1 (acc) → tap Unit 1 → Settings → Course: On-level → Save.
**Saw:** page error `Cannot read properties of undefined (reading 'idx')`; `#bar` still reads "‹ 1st Period · Accelerated
Unit 1 … 23 skills", grid unchanged, no "Saved" toast, `state` already changed (prep `on`, label "1st Period · On-level",
goal 60). Overview / a tab click recovers.
**Expected:** any render with a stale `view.unit` falls back to the units grid (the guard in `renderGrid` belongs in
`render()` or `renderBar`), or Settings resets `view` when the prep changes. Same hole for any future path that changes a
class's skills while a unit is open.

## P1 — wrong numbers, silent data loss, or a documented path that doesn't work

### 2. A student can be carved into two classes of the same course; the new-class warning says they'd move, they don't
**Where:** `poolRows`/`poolIdx` l.909–910 match a class's roster against the whole pool with no exclusion of names other
classes already hold (`poolLeftovers` l.911 knows, but only the fixer uses it). `askNewClass` l.932 warns "a student can
be in only one class per course, so they'd move to this one" — nothing moves anyone. NOTES ("pools carve each name into
one class") and the one-class-per-course rule are not what the code does.
**Repro (q9.js):** make period 1 acc from `focus_gradebook_pool_p1.csv`, then period 3 acc from a copy of the same file.
**Saw:** period-1 22 students, period-3 22 students — the same 22; both in the accelerated Race, Data Lab rows, Overview
cards, both "IXL work at goal" bars. Real-life version: a student who moved from 2nd to 4th period stays on the old class's
roster until it is re-pasted (or a wrong period is picked for a re-exported gradebook) and is counted twice everywhere.
**Expected:** either enforce the rule (`materialize` claims names not already held, in `state.order` order, and the
warning's "they'd move" is made true) or drop the claim and flag the overlap on the Overview.

### 3. A storage failure on import is hidden behind the "Imported …" toast (and behind "Saved", skip toasts, …)
**Where:** `save()` l.72 toasts its own failure and returns `false`; nothing but the seating Save (round 4 #10) reads the
result. `importFiles` l.314–318 does `save(); render(); toast('Imported …')` — `toast()` replaces the previous toast.
Same pattern: `#mSave` l.1621 ("Saved"), skill/student skips l.1176/1188, roster panel l.1109, `[data-gbroster]`,
`openSeatSheet` close, `#curUnit`, the seating-backup import l.231–232.
**Repro (q11.js):** make `localStorage.setItem` throw `QuotaExceededError`, import the accelerated export.
**Saw:** toast sequence `["Could not save — …"]` → visible: "IXL course export — Accelerated: 91 students … Imported 1st
Period · Accelerated (goal 67, 22 students)". Settings → Save: "Could not save…" then "Saved". A skip: only "Skipped …".
**Why it matters:** this is exactly the tablet case in NOTES (`content://` origin → storage blocked): the weekly import
looks fine and is gone on the next open. **Expected:** a failed `save()` wins the toast (or the success toast is
suppressed when `save()` returned false), at least on import, Settings save and backup restore.

### 4. An IXL-looking file with no date in its name silently replaces a course pool — and every class carved from it
**Where:** `importFiles` l.246–253: a grid with students and no section code becomes `state.pools[prep]` outright; the
only guard is `prevPool.date && meta.date && meta.date < prevPool.date` (l.248), so an undated file (or one with the same
date) replaces without a word, then `materialize` rewrites every class of that prep and `snapshot`s them.
**Repro (q12.js):** a CSV whose header row is `Skill name, S0…S299` with one skill row, named `wide.csv`.
**Saw:** "IXL course export — On-level: 300 students, 1 skill → 1 class updated · Imported 2nd Period · On-level (goal 60,
**0 students**)". The real on-level pool (91 × 177) is gone; period 2 has 0 students, 1 skill; no undo. A renamed export,
an IXL export of another course/plan with no section code, or a "Skill plan" grid all take this path.
**Expected:** replacing a pool that has classes hanging off it asks when the incoming file is undated, has a different
skill set, or would drop the classes' matches to (near) zero; the import should never leave a class at 0 students without
saying so.

### 5. Typing in "Find a student" on the Overview replaces the Overview with the grid
**Where:** `#search` oninput l.1717 → `renderGrid()` regardless of `view.mode`; with `view.mode === 'home'` `renderGrid`
reaches the unit branch (l.1153), finds no unit, sets `view = { mode: 'units' }` and draws the active class's grid into
`#gridwrap`. `#search` is visible on the Overview (`render` l.975 only hides it when there are no classes).
**Repro (q1.js A):** Overview → type "a" in the search box.
**Saw:** `#gridwrap` holds `table.grid`, `#bar` still says "Overview", `body.home` still set, `#btnHome` pressed, no tab
marked active — a hybrid screen. **Expected:** search is hidden on the Overview (or filters the cards), and `renderGrid`
never runs for `view.mode === 'home'`.

### 6. Dragging the Seating Chart's JSON backup onto Tally is refused
**Where:** the `drop` handler l.1722 filters `/\.(xlsx|csv|xls|txt|tsv|html?)$/` before `importFiles`, which handles
`.json` (l.227). NOTES and the toast on the Import button say "drop its JSON backup on Tally".
**Repro (q1.js B):** dispatch a drop with `seating-backup.json`. **Saw:** "Drop an IXL Score Grid or a gradebook export
(.xlsx, .csv, .xls)." The Import button path works. **Expected:** `.json` in the drop filter.

### 7. Loading a backup onto an existing pool class restores its roster but doesn't re-carve the class
**Where:** `#cfgFile` l.1675 `Object.assign(state.sections[k], cl)` (roster, aliases, ignored…) then `migrate(); save();
render()` — no `materialize()`, so `students/scores` stay as they were carved from the old roster.
**Repro (q2.js):** backup with period-1's roster cut to 10 names → load it on a Tally where period 1 has 22.
**Saw:** roster 10, students still 22, 12 rows flagged "NOT ON ROSTER — FIX", the bar still says 22 students; the same
after reload (only the next pool import or a roster Save in Settings fixes it). **Expected:** restore re-materializes pool
classes whose roster/aliases/ignored changed (the tab-switch already re-renders; the carve is the missing step).

### 8. The backup can't be loaded on a fresh device first, and course skips for a prep with no class yet are lost
**Where:** (a) `render` l.977 hides `#btnSettings` (the only way to Load backup) until a class exists — the Backup text
in Settings says "Load it on another computer before or after importing exports"; round 4 #7(c) noted this and it wasn't
part of the fix. (b) a section held in `pendingCfg` carries `excluded`, but `askNewClass` l.938 copies only
`threshold, roster, …, seatInfo` and `migrate` merges `excluded` only for sections that exist.
**Repro (q2.js, q3.js):** Clear everything → import both pools → Settings is still hidden. Then: backup made with an
on-level skip → remove the only on-level class → load the backup → make period 2 on-level.
**Saw:** (a) `settingsHidden: true` after the pools; (b) `pendingCfg['period-2'].excluded = ['ON-SKIP-KEY']` before the
class is made, `state.skips.on = []` and `period-2.excluded = []` after. `assigned.on` and `currentUnit` survive (they
are top-level). **Expected:** a Load-backup control on the landing page (or Settings visible when pools exist), and
`askNewClass`/restore folding held `excluded` into `state.skips[prep]`.

## P2 — misleading state, wrong-but-recoverable, or rough on the tablet

### 9. Per-section classes never get `period`, so their colour collides with a pool class and the period picker doesn't know them
**Where:** `parseIxlFilename` returns `period`; `importFiles` l.283 stores `period: keep.period` (never set for a
per-section file). `classColor` (charts.js l.13) then uses the order index, `askNewClass` l.918 builds `used` from
`.period`, and `seatingTargetFor` falls back to key matching.
**Repro (q1.js F):** pools + period 1/2, then `ixl_7T1A_scrubbed_*.csv`. **Saw:** `period: undefined`; tab colours
`#2a78d6, #eb6834, #eb6834` — 7T1A (orange, index 1) and "2nd Period · On-level" (orange, period 2) share a colour on
every chart; the picker offered two "1st Period · Accelerated" chips. **Expected:** `period: meta.period ?? keep.period`.

### 10. After accepting an older-dated file, the Race and digest read the newer snapshot as "now"
**Where:** `snapshot` l.342 keeps every other date; `leaderboardData` l.387 and `digestFor` (home.js l.83) take
`history[history.length - 1]` as the current snapshot — the newest *date*, not the data on screen.
**Repro (q3.js D):** accelerated pool of 09-26 → import a copy dated 09-01 and accept the confirm.
**Saw:** `pool.date 2026-09-01`, `history ['2026-09-01','2026-09-26']`, Race card date "Sep 1" with movement computed
09-01 → 09-26 (the file that is no longer loaded); the tab says "4 weeks ago". **Expected:** history entries newer than
the loaded export are dropped (or the Race compares on `dataDate(s)`), or the confirm says the newer week's snapshot stays.

### 11. Partners "Tutor pairs" / "Similar level" with no standing data turns every pair into an issue
**Where:** `pairCost` (seating.js l.56) uses `standingOf` = 50 for a null standing; with basis "FAST only" and no v8
backup (or blend with nothing loaded) every pair has diff 0 → tutor cost 1 for all; `explainSeats` l.192 reports each.
**Repro (q7.js):** Place by "FAST only" (no FAST data), Partners "Tutor pairs", Generate. **Saw:** Fit **1**, "11 issues"
all "… partners — similar standing (50 / 50), not a tutor pair"; the legend line says "number = standing by FAST only".
**Expected:** a pair with no standing on either side costs 0 and raises nothing (the sheet already says "no FAST data
yet — treated as mid-level"); the Priorities dialog could say the basis has no data.

### 12. Touch targets under 44 px on the tablet (`(pointer: coarse)` confirmed true)
**Saw (q14.js, 1280×800):** `.flag` "NOT IN IXL — FIX" 36 px, `.fcheck` Focus badge 36 px, `#back` 38 px, the
Chart/Room segment 38 px, the Overview "What changed ›" chip 32 px, the sheet's "Grades card" link 20 px, `.ulink` 41 px,
`#nToggle` 40 px. The round-3 fix covered the others. The flags and Focus badges are the weekly taps.

### 13. Deleting the desk of a locked student keeps the lock; the next Generate pins them wherever the solver put them
**Where:** `roomDropDesks` (seating.js l.487) drops seats, not `locks`; `pruneSeats` l.231 removes locks only for
students off the roster; `seatGenerate` l.240 fixes a lock only when the desk exists, so the student is placed freely,
then shows 🔒 at the new desk and is fixed on the following Generate. **Repro (q7.js 4):** lock a student → Room → delete
their desk → Chart → Generate. **Saw:** `locks: ["UNDERHILL, ELLIS"]` after Generate with the student seated somewhere new.

### 14. Tapping an occupied desk with a "seat them" pick pending silently drops the pick
`bindSeating` `act` (seating.js l.389): `if (!w.seats[id]) {…} seatPending = null; renderSeating(s)`. **Saw (q7.js 5):**
hint back to the default, the student still unseated, no toast. Expected: keep the pick (or swap into the desk) and say so.

### 15. The history-freshness cost of a skip (design note, by reading)
`resnapshotPrep` replaces today's snapshot with new `ua`; `movement` l.357 then reports `basis` against last week's until
the next import, so the projected Race shows "skills counted changed — fresh start this week" for every class of the prep
between a skip and the next export. Documented intent, but a tick in the Focus check's skip offer on a Tuesday blanks the
Race for the week; comparing on the intersection of unchanged units would keep it.

## P3 — code health (by reading; `all.js` = the spliced sources)

- **Dead code:** `whatIfScores` (grades.js l.100), `shuffleArr` (seating.js l.130), `sec.team` (always `''`, still
  written/exported), `hiddenUnits` (migrated once, kept `{}` and exported), `unitColumn` twice in `window.__tally`
  (l.1742), `#toggleAll` and `#mToggleAll` are the same control twice on the bar (l.1048/1053), `.lbFoot/.lbStat/
  .lbLeagueMover` CSS in both copies.
- **Duplicated logic that has already drifted:** `LB_CSS`/`LAB_CSS` (l.463–718) are copied by hand into `app.html`
  (l.396–454); the app copy has a mangled edit at app.html l.402–403 — `.lbLeagues.seg.wrap{flex-wrap:wrap}` (matches
  nothing) followed by a global `.two{display:grid;grid-template-columns:1fr 1fr…}` — which only works because `.seg.wrap`
  is re-declared at l.495 and the sheet's `<div class="two">` wants a grid anyway. One source (inject `LB_CSS`/`LAB_CSS`
  at boot like `CHART_CSS`) removes the class. Also: `PERIOD_ORD` (l.897) = parser.js `ord` (l.280); `resnapshotPrep`
  l.347 vs the inline loop at l.1085; the still-owed block in `printStillOwed` l.1315–1322 vs
  `studentReportSection` (grades.js l.305–308); the clipboard `put` in `openFocusCheck` l.1520 vs `copyUnit`
  l.1284–1285; the `['box','hist','circle','line']` gb-kinds list three times (l.623, 730, 737); `gradeSummary` (home.js)
  re-derives letters/sliding from `renderGrades`, and `fitCategories` runs twice per class per Overview render
  (`gradeSummary` + `attentionItems`) — 34 ms for five classes with gradebooks, so not a problem yet.
- **Error paths:** the deferred-gradebook loop in `importFiles` (l.293–311) sits outside the per-file `try`; anything
  thrown there (a category asker or `materialize` surprise) is an unhandled rejection with no `save()`/`render()` and no
  toast (no repro found; noted as the one uncaught path). Handled import failures are logged with `console.error(e)`
  (l.291) — every garbage drop in q12.js printed a stack to the console, which the "console errors are P0" rule will
  keep tripping on. `confirm()` is used in 9 places in app.js (older files, copy zeros, discard roster, remove class,
  wipe, delete data set, course settings, drop gradebook) although seating went to `seatConfirm` ("never confirm()").
- **Leaks:** `runSolver` (seating.js l.174) still creates a blob URL per Generate and never revokes it (round-4 P3, open).
  `state.settings.labDots` grows one key per data set ever toggled (trivial). `.seatStu[data-n]` (seating.js l.349) holds
  every full name, lower-cased, as a DOM attribute while Names is off (not rendered, but it is the only surface where
  the sweep found names in the DOM).
- **TDZ / ordering:** none found. The spliced files define only functions and consts; the two top-level side effects
  (`document.head.appendChild` of `CHART_CSS` / `SEAT_SVG_CSS`) need nothing from `app.js`; `roomOK()` is first called
  from `migrate()` at l.130, after `SEAT_FACTORS` exists; `toast()`/`toastT` are only reached after boot.
- **Migration:** `gradeHistory` filtering (l.58, l.1672) checks `date`/`grade` but `renderGrades`/`gradeSummary`/
  `digestFor` also read `students` and `missing`; every shipped version wrote them, so only a hand-edited backup could
  trip it. Receipts have always had `[display, points, own]`.

## What's solid (exercised, no fault found)
- Data Lab: 350 combinations (every non-skill data set + two skills × 7 graph types × Points/% with stats 2, outliers,
  values, bins of 1) rendered without a throw, `NaN`, `undefined` or `null` in the text (q6.js).
- Race: movement survives Working-in changes (2 → 5 → none) with `basisChanged` false; a goal change on one class marks
  only that class `thrChanged`; per-section old → new import gives the expected gain and share (q6.js).
- Names off: a sweep of 22 surfaces (grid calm/details, notices open, unit view, per-student skip toast, Grades, student
  card, Settings, digest, fixer, not-on-roster, Focus check, copy toast, receipt, Seating chart/list/sheet/why-here,
  desk aria-labels, Overview, Race, Data Lab) found no roster surname in text, `title`, `aria-label` or `data-*` (except
  `data-n`, above). "Shown as" with `<b>Bo</b>` is escaped everywhere (q4.js, q5.js, q7.js).
- Roster edits after everything exists: rename + drop + add → seats of the departed freed with a toast, locks dropped,
  the renamed student listed under "Not on the roster" with their info stamped `gone`, gradebook-vs-roster notice lists
  both directions (q4.js).
- Garbage drops (empty, PNG-as-CSV, junk .xlsx, roster .txt, HTML, headerless CSV, a Tally backup) each fail with a
  named toast and change nothing; a mixed drop with one good file imports it and reports the rest (q12.js).
- Import while the solver is running aborts it cleanly; import from Grades or Seating lands on the grid; re-importing the
  same gradebook the same day keeps one history entry; 23 student reports print; six student cards with `nextMax` 0/7
  raise no error (q15.js).
- Tablet 800×1280 and 1280×800: no horizontal overflow on any surface; the hold-to-exit works with a touch pointer;
  Escape clears a pending seat pick (q8.js, q14.js). Promethean 1920×1080: both leagues side by side (q13.js).
- Five pool classes with gradebooks: 651 KB in localStorage, Overview render 34 ms, grid 14 ms, `save()` 5 ms (q9.js).
- Backup round trip: room, weights, basis/pairs mode, custom data, grading, currentUnit, seating, seatInfo, history all
  return for classes that exist; a class made after the restore consumes its held entry (q2.js).
