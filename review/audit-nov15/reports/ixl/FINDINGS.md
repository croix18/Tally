# Auditor IXL: findings (Tally deep audit, 15 Nov 2026)

Scope: the IXL engine and everything that goes to Focus (app.js computations, history snapshots, grid render, match fixer,
copy, Still owed, receipt, Focus check, students.js ixlFor / ixlTrend / pendingCopies). Repo copy at commit 8f973ed.
Every probe runs with `TALLY_REPO=<clean copy> node probes/NN-slug.js` and exits 1 while the defect exists.

### IXL-01  "ID + points" copy and the unit CSV carry no student IDs once a Focus gradebook is loaded
- Class: WRONG-INFO
- Severity: High
- Where: app.js: gbRows (line 2586; `copyRows` line 2576 uses it whenever a gradebook is open)
- Trigger: Settings → Copy puts on the clipboard → **ID + points**, with a Focus gradebook imported (the normal state of every
  class since the gradebook became the copy order on 22 Oct). Every copy, every week. Also the unit's **CSV** button ("keyed by
  student ID") and Focus check → **Copy corrections** in ID mode.
- Observed: `gbRows` rebuilds the roster from the gradebook (`rosterFromGradebook` writes `ID<tab>Name`) and then strips the ID
  (`l.replace(/^[^\t]*\t/, '')`) before `buildRows`, so every row's `id` is `''`. On the scrubbed real class (23 IDs in the
  gradebook) all 23 lines of an ID + points copy are `"\t<points>"`; the CSV's Student ID column is empty and its toast blames
  "some rows have no ID in the pasted roster"; Copy corrections in ID mode falls back to names.
- Expected: each line `ID<tab>points` with the student's Focus Student ID (Settings labels the mode "ID + points"; the CSV
  says "keyed by student ID"). `gb.ids` holds the IDs (uniqueNames, parseGradebook) and the 22 Oct rule makes the gradebook
  the copy's row source, so its IDs are the right ones.
- Repro: probes/01-ids-copy-blank.js
  ```
  OBSERVED: 0 of 23 "ID + points" lines start with the student's Focus ID (gradebook has 23 IDs); copyRows rows with an id: 0; Focus-check rows with an id: 0; first lines ["\t1","\t","\t17"]
  EXPECTED: every line of an "ID + points" copy (and every row of the CSV "keyed by student ID") carries that student's Focus ID: 23 of 23
  FAIL ID + points copy carries the IDs the gradebook has
  FAIL copyRows (CSV, corrections) carry the IDs
  ```
- Suggested fix: in `gbRows`, after `buildRows`, give each row its gradebook ID by position (the rows are the gradebook's
  students in order): `rows.forEach((r, i) => { if (!r.id && sec.grades.ids && sec.grades.ids[i]) r.id = String(sec.grades.ids[i]); })`.
  Only the `id` field changes; order, matching and points are untouched. (tests/assigned-and-skips.js covers ID mode only with a
  pasted roster, which is why this passed.)
- Confidence: High. It would change my mind only if ID mode is documented as roster-only, which I did not find.

### IXL-02  The import's history snapshot reads best scores and student skips through the previous export's key cache
- Class: WRONG-NUMBER
- Severity: Medium
- Where: app.js: the IXL import (line 568: `state.sections[meta.key] = { ...(prev || {}), ... }`, line 584 `snapshot(...)` before
  line 585 sets `_keys = null`); `ixlKeyAt` (line 473) only rebuilds `_keys` when the student COUNT changes.
- Trigger: a weekly IXL import where the class has the same number of students as last time but a different line-up (one
  withdraws and one enrolls the same week, or IXL lists a renamed student elsewhere). In-session (the cache is not saved), which is
  the normal import flow. Uncommon but realistic mid-year.
- Observed: the new section object inherits `prev._keys`; `snapshot()` runs before line 585 clears it, so `eff()` and
  `activeFor()` look up best scores and per-student skips under the OLD student at each index. Synthetic class: week 1 Alex has
  2 skills at goal; week 2 Alex is gone and Andy (no scores) is listed first. The 9 Nov snapshot says `ANDY ADAMS#0: 2`, while
  `points()` is 0. The snapshot feeds the Race's movement (Andy measured next week as "down 2"), ixlTrend on Andy's page, and
  What changed. When the line-up shifts by one, every student below the change takes a neighbour's best scores and skips.
- Expected: the snapshot equals what the grid shows for each student (the comment on `snapshot`: "the newest one always
  reflects the grid"; NOTES: snapshots keep per-student totals on each student's own list).
- Repro: probes/02-snapshot-stale-keys.js
  ```
  OBSERVED: snapshot of 2026-11-09: {"ANDY ADAMS#0":2,"BLAKE BRISCOE#0":0,"CASEY CARVER#0":0}; points() now: ANDY ADAMS=0, BLAKE BRISCOE=0, CASEY CARVER=0
  EXPECTED: the snapshot of 2026-11-09 equals points() for each student: ANDY ADAMS#0 = 0 (he has no scores; the 2 at goal were Alex's)
  FAIL the new student's snapshot doesn't carry the withdrawn student's best scores
  ```
- Suggested fix: add `_keys: null` to the object literal at line 568 (or move `snapshot()` after line 585's reset and
  `mergeBest`). Safer still: make `ixlKeyAt` validate its cache by identity (`sec._keysFor !== sec.students`) rather than by length.
  Nothing else reads the stale cache on purpose.
- Confidence: High (deterministic, engine-level).

### IXL-03  A student whose Tally points FELL since the copy is reported as "up since copy" ("up -1 since")
- Class: WRONG-INFO
- Severity: Medium
- Where: app.js: reconcile (line 2592, `else if (rcv != null && Math.abs(focus - rcv) < 0.01) status = 'stale'`); openFocusCheck
  (line 2620, "up ${fmtN(r.tally - r.focus)} since"); the grid header badge (renderGrid, "Focus: N up since copy").
- Trigger: after copying a unit, anything that lowers Tally's count for a student whose Focus cell still holds the copy: a skill
  skipped for that student (modified list), the goal raised, "best score" turned off, a skill re-counted that the student hasn't
  done is NOT this (total changes, so maxOK catches it). Occasional.
- Observed: scrubbed real class, Unit 2 copied, Focus holds the copied 17; one skill is then skipped for that student
  (Tally 16/16). reconcile marks the row `stale`; the header reads "Focus: 1 up since copy"; the dialog says "matches what you
  copied; up -1 since". `stale` is the quiet state (not counted in "N off"), so an over-credited Focus cell is shown as benign.
- Expected: `stale` only when Tally is above what was copied (README: badge "N up since copy" = students who moved up since);
  a drop below the Focus value means Focus is too high and needs a correction, i.e. `differ` (counted in "N off", listed in
  Copy corrections), or a separate "down since copy" state. openReceipt already distinguishes up and down for the same data.
- Repro: probes/03-drop-called-up.js
  ```
  OBSERVED: Focus 17 = copied 17, Tally now 16: status "stale"; header "Unit 2 Rational and Irrational Numbers Focus: 1 up since copy copied Nov 15 Copy"; dialog "up -1 since"
  EXPECTED: a student whose Tally points fell below what Focus holds is not "up since copy": Focus is now too HIGH (status differ, or a "down since copy" wording), never "up -1 since"
  FAIL a drop is not reported as "up since copy"
  FAIL the dialog never says "up -N since"
  ```
- Suggested fix: in reconcile, `else if (rcv != null && Math.abs(focus - rcv) < 0.01 && tally > focus) status = 'stale';`
  (a drop falls through to `differ`). Everything that counts `stale` (badge, Overview chip, attention items) then sees it as off,
  which is the truth. Check tests/focus-check.js for a case that expects the old wording.
- Confidence: High.

### IXL-04  The receipt of a copy records Tally's points for a row that was copied as Focus's kept number
- Class: WRONG-INFO
- Severity: Low
- Where: app.js: copyUnit (line 2363, `sec.receipts[unit.name] = { ... rows: rowsAll.map(r => [r.display, points(...), ...]) }`)
  versus unitColumn (line 2328, which pastes the kept Focus value for an `accepted` row).
- Trigger: a student marked **Keep Focus** in the Focus check (late penalty, paper retake), then the unit copied again. Occasional.
- Observed: scrubbed class, Unit 2: a student with Focus 17 / Tally 16 is kept; Copy pastes 17 on their row; the receipt stores
  16 and its "Copied" column shows 16. A receipt is the record used later to tell "up since copy" from "off".
- Expected: README "Receipts record exactly what was copied and when": the receipt row holds the value that went on the
  clipboard (17).
- Repro: probes/04-receipt-kept-row.js
  ```
  OBSERVED: the copy pasted 17 for the kept student (Focus 17, Tally 16); the receipt records 16 and its "Copied" column shows "16"
  EXPECTED: the receipt ("exactly what was copied", README) records and shows 17
  FAIL the receipt records what was pasted
  ```
- Suggested fix: build the receipt rows from the same values `unitColumn` emits (have unitColumn return `{ text, value }` per
  row, or recompute `kept` once in copyUnit and use it for both). Today the honoured override hides the effect in reconcile, so
  the risk is limited to what the receipt says; once the override is removed ("Flag again") both paths agree again.
- Confidence: High.

### IXL-05  When one of two same-name IXL students leaves, the other inherits the leaver's best scores and skips
- Class: WRONG-NUMBER
- Severity: High (the consequence is a wrong point copied to Focus; the trigger is rare)
- Where: app.js: ixlList (line 193: `key: name + '#' + (k - 1)`, k = the occurrence of that normalized name in this export);
  eff (line 467) / mergeBest (line 474) / activeFor (line 461) look best scores and per-student skips up by that key.
- Trigger: a class with two students IXL lists under the same name, and one of them withdraws (or IXL lists the pair in the
  other order in a later export). Rare, but it is exactly the pair the 14 Nov uniqueNames work was for, and it is silent.
- Observed: synthetic class, week 1: SAM LEE #1 has 90 and 85 (both at goal), SAM LEE #2 has 20 and blank. Week 2: the first Sam
  Lee is gone. The remaining Sam Lee is now key `SAM LEE#0`, eff() returns the leaver's 90 and 85, points() = 2, and the copy
  pastes "LEE, SAM 2". His own SmartScores never reached the goal. His (or the leaver's) per-student skips and `ignored` /
  alias picks keyed `#0`/`#1` move the same way.
- Expected: 0 points: a point is earned by that student's own SmartScore (README: "Best score across imports is kept" is
  per student). When Tally cannot tell two same-name accounts apart across exports, it should not carry best scores for them.
- Repro: probes/05-samename-best-inherited.js
  ```
  OBSERVED: the remaining SAM LEE (SmartScores 20 and blank in every export) is counted 2 point(s); scores used [90,85]; copy: CARVER, CASEY	1 | LEE, SAM	2
  EXPECTED: SAM LEE = 0 points: neither of his own scores ever reached the goal (67); the 90 and 85 were the other Sam Lee's
  FAIL a same-name student doesn't inherit the leaver's best scores
  ```
- Suggested fix (smallest): at import, if the previous export had a name more times than the new one (or the pair's
  occurrence counts differ), drop `best`, `studentSkips` and `ignored` entries for every key of that name and say so in the
  import summary ("best scores reset for the two SAM LEE accounts"). The real fix is a stable IXL key; the Score Grid export
  carries no account ID, so the name-plus-occurrence key cannot be made safe in general.
- Confidence: High that it happens as shown; Medium on how often IXL exports same-name pairs.

### IXL-06  A gradebook name the roster reader can't read shifts every copy row (and every Focus-check row) below it
- Class: WRONG-NUMBER
- Severity: High (the consequence is points pasted on the wrong students in Focus; the trigger is rare)
- Where: app.js: gbRows (line 2586) turns `gb.students` into roster TEXT and re-parses it with parseRosterText (line 205), then
  joins the result to the gradebook BY POSITION (`.slice(0, sec.grades.students.length)`; reconcile reads `a.values[i]` for
  `rows[i]`). parseRosterText silently skips a line it can't read: a name with no Latin letter (`[A-Za-zÀ-ɏ]`: Cyrillic, Greek,
  CJK, Arabic script), a digits-only name, or a one-word name in HEADER_WORDS ("Student", "Name", "Last"). buildRows then appends
  the now-unmatched IXL student as an `ixlOnly` row at the END, and the slice keeps it.
- Trigger: one student whose name Focus holds in a non-Latin script (or any of the other unreadable forms). Rare in a Lake
  County gradebook, but nothing warns: the toast still says "in Focus order".
- Observed: the scrubbed Q1 gradebook with row 4's name replaced by a synthetic Cyrillic name, imported normally. The Unit 2
  copy has 23 lines, but rows 4-23 each belong to the next student down (20 rows on the wrong student, 14 of them with a
  different number), and the last line is the IXL-only student. Pasted into Focus, 14 students get a classmate's points; the
  Focus check compares each Focus cell with the wrong student too.
- Expected: row 4 blank (not matched: "Roster students missing from IXL get a blank line so the column stays aligned",
  Settings), every other row its own student's points. This is the 22 Oct Critical (NOTES / AUDIT_PLAN: "a student who left or
  joined can never shift everyone below by a row") reached by another door.
- Repro: probes/06-unreadable-name-shifts-copy.js
  ```
  OBSERVED: gradebook has 23 students (row 4 renamed); copy has 23 lines; 20 rows are a different student than Focus's row (rows 4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23); 14 students would get another student's points; last copy row is "DORSEY88, CASEY"
  EXPECTED: row 4 blank (not matched to IXL), every other row the points of that row's own student (0 rows shifted)
  FAIL copy rows stay on their Focus rows
  ```
- Suggested fix: make gbRows one row per gradebook student by construction: parse each gradebook name on its own and, when
  parseRosterText returns nothing, use a placeholder roster entry `{ display: name, last: name, first: '', alias: '', id }` that
  matches no one (a blank row). Then drop the ixlOnly rows instead of slicing: `buildRows(...).filter(r => r.status !== 'ixlOnly')`
  and assert `rows.length === gb.students.length` (refuse to copy, with a message, if not). Also teach parseRosterText's name
  tests `\p{L}` (with the `u` flag) instead of `A-Za-zÀ-ɏ`, so such a name is read and can be matched by alias.
- Confidence: High on the mechanism; the realism of a non-Latin name in Focus is the open question.

### IXL-07  Turning "best score" off or on re-counts every grid, but no history snapshot is re-taken
- Class: WRONG-NUMBER
- Severity: Low
- Where: app.js: the Settings save (line 2908 and 2912: `state.settings.useBest = $('#useBest').checked;` with no
  `resnapshotPrep` / `snapshot`); snapshot (line 724) does not record the useBest basis, so movement() cannot detect it either.
- Trigger: the teacher flips Settings → "Grade on each student's best score across imports" (rare; a one-time decision).
- Observed: synthetic class whose SmartScores fell between two exports. After unticking the box, the grid shows Alex 1,
  Blake 0; the newest snapshot (what the Race, the IXL trend line on the student page and What changed read) still says 2 and 2.
  The next import then reads the change of basis as both students dropping, so the Race's "moved up" share and "skills per
  student since" are wrong for a week.
- Expected: the snapshot comment (line 723: "Snapshots are re-taken whenever the basis changes (skips, goal), so the newest one
  always reflects the grid"); best-score on/off is such a basis change.
- Repro: probes/07-usebest-no-resnapshot.js
  ```
  OBSERVED: useBest=false; newest snapshot {"ALEX ABBOTT#0":2,"BLAKE BRISCOE#0":2,"CASEY CARVER#0":0}; grid now {"ALEX ABBOTT#0":1,"BLAKE BRISCOE#0":0,"CASEY CARVER#0":0}
  EXPECTED: the newest snapshot equals the grid once the basis changes (snapshot comment: "re-taken whenever the basis changes (skips, goal), so the newest one always reflects the grid")
  FAIL newest snapshot = grid after the best-score switch
  ```
- Suggested fix: when the saved value differs from the old one, `state.order.forEach(k => snapshot(state.sections[k]))`; and
  store `best: !!state.settings.useBest` in each snapshot so movement() returns `{ reason: 'basis' }` across a switch (as it does for
  a goal change). Both are additive.
- Confidence: High.

### IXL-08  An NHI in a Focus column named "IXL" that no unit claims is neither missing work nor IXL to finish: retake "eligible"
- Class: WRONG-INFO
- Severity: High (the consequence is a wrong retake answer to a student; the trigger needs an IXL column without "Unit N")
- Where: students.js: retakeStatus (line 352: `missing` drops every column whose NAME matches `/\bixl\b/i`; line 363 then checks
  only IXL columns that `gbUnitFor` maps to a unit). Two definitions of "an IXL column" (name regex vs gbUnitFor, which also uses
  the manual map and the IXL category) leave a gap: a column named IXL with no unit (`gbUnitFor` null, e.g. "IXL Diagnostic",
  "IXL Week 10/19", or one the teacher set to "— not an IXL unit —" under Wrong column?) is judged by neither rule.
- Trigger: a Focus assignment with "IXL" in its name and no unit number, Not Handed In for the student. Plausible (a diagnostic,
  a weekly IXL goal, a co-teacher's naming); every student with it NHI is affected.
- Observed: the scrubbed Q1 gradebook plus one synthetic column "IXL Diagnostic" (10 points, NHI for all 23 students). The 6
  students Tally called retake-eligible before are still all eligible, with an NHI assignment on their record.
- Expected: README "Retakes: a student may retake an assessment when nothing is missing and every IXL skill in the unit the course
  is working in is at goal"; the code comment's own rule is "an IXL column is judged by the skills below" — a column with no
  skills below it can only be judged by its Focus cell, i.e. as missing.
- Repro: probes/08-ixl-column-no-unit-retake.js
  ```
  OBSERVED: Focus column "IXL Diagnostic" imported: true (NHI for 23 students, mapped to unit: null); students called retake-eligible: 6 before, 6 after
  EXPECTED: 0 eligible after: each now has a Not Handed In assignment (README "Retakes": a student may retake when nothing is missing)
  PASS the column was read
  FAIL an NHI in an IXL-named column with no unit still blocks a retake
  ```
- Suggested fix: one predicate for "this Focus column is a unit's IXL": `const ixlUnitCol = (sec, a) => gbUnitFor(sec, a)`; use it
  in retakeStatus's `missing` filter (`!gbUnitFor(sec, a)` instead of the name regex), and in ixlColOf / pendingCopies / the
  other `/\bixl\b/i.test(a.name)` sites listed under Cleanup (C-1). A column with no unit then counts as ordinary missing work.
  Check owedWork() (NOTES 3 Nov, item 2) for the same gap; I did not trace it.
- Confidence: High on retakeStatus; Medium on how often such columns exist in his gradebooks (his own are all "Unit N IXL").

### IXL-09  The receipt matches its rows by the pasted roster's spelling while the copy wrote the gradebook's: "23 no longer on the roster"
- Class: WRONG-INFO
- Severity: Medium
- Where: app.js: openReceipt (line 2540: `const rows = buildRows(sec)...; const now = new Map(rows.map(r => [r.display, ...]))`),
  versus copyUnit, whose receipt rows come from copyRows → gbRows (the gradebook's names). rosterVsGradebook (line 1842) keeps a
  pasted roster when it equals the gradebook under norm(), so the two spellings can differ in case, accents or punctuation.
- Trigger: a roster pasted or typed in another case or with accents ("Sutter, Hayden Skyler" / "José") and a Focus gradebook
  export in its own spelling ("SUTTER, HAYDEN SKYLER" / "JOSE"). Then every receipt.
- Observed: scrubbed class with the roster pasted in title case, then the gradebook imported, then Unit 2 copied: seconds
  later the receipt says "Nobody has moved up since · 23 no longer on the roster", every row "not on the roster now", and it can
  never show who moved up since the copy.
- Expected: 0 rows gone (README: "Receipts record exactly what was copied and when"; the Guide: "Copied: a receipt of what went
  to Focus, and when. Tap it to see who has moved since").
- Repro: probes/09-receipt-roster-spelling.js
  ```
  OBSERVED: roster line 1 "Sutter, Hayden Skyler", gradebook "SUTTER, HAYDEN SKYLER"; right after the copy the receipt marks 23 of 23 rows "not on the roster now" (Nobody has moved up since · 23 no longer on the roster)
  EXPECTED: 0 rows "not on the roster now": every copied student is still in the class, seconds after the copy
  FAIL a fresh receipt finds every student it copied
  ```
- Suggested fix: in openReceipt use the copy's own row source: `const rows = copyRows(sec);` (it already excludes ixlOnly), so
  receipt, Focus check and copy all key by the same display. Optionally fall back to `norm(display)` for receipts saved under the
  other spelling.
- Confidence: High on the mechanism; Medium on how often the two spellings differ in his files.

### IXL-10  The grid's "Class average" (and a unit's "% of class at goal") counts IXL accounts flagged NOT ON ROSTER
- Class: WRONG-NUMBER
- Severity: Low
- Where: app.js: renderGrid, footer (line 2216: `allRows.forEach(r => { if (r.ixl != null) ... })`, and line 2256 for the unit
  view's "% of class at goal"): every row with an IXL index, including `ixlOnly`.
- Trigger: an IXL account not on the roster that hasn't been skipped yet: a withdrawn student still in the IXL class, a new
  student not yet in Focus, a duplicate account. Common for a week or two at a time.
- Observed: scrubbed class (16 matched, 7 ixlOnly): footer Unit 2 = 13.2, the counted class's mean = 12.8. The Race, Data Lab,
  ixlTrend's class line and copies all use population() (roster-matched only), so the same class has two "class averages".
- Expected: population()'s mean (the comment on population: "The students a class is measured on: roster-matched students when a
  roster exists"); the Not-on-roster dialog says such accounts are left out of copies and the race.
- Repro: probes/10-grid-average-includes-ixlonly.js
  ```
  OBSERVED: rows: {"ok":16,"rosterOnly":7,"ixlOnly":7}; grid footer "Class average" per unit: 13.5, 13.2, 6.9
  EXPECTED: the counted class (population(): the 16 roster-matched students, as the Race and Data Lab use): 13.5, 12.8, 6.9
  FAIL the grid class average is the counted class average
  ```
  (The 7 ixlOnly rows here are scrubbing artefacts; in real use they are the not-yet-resolved accounts above.)
- Suggested fix: in both footers skip `r.status === 'ixlOnly'` (or iterate `population(s)`). Display-only change.
- Confidence: High on the arithmetic; it is a judgment that the footer should mean the counted class (it may be meant as "the rows
  on screen"). If so, label it "Average of the rows shown".

### IXL-11  "New student? Re-paste the roster ... so they get a row in Focus order": done that way, Copy still leaves them out
- Class: WRONG-INFO (leads to a misaligned paste)
- Severity: High
- Where: app.js: openNotOnRoster (line 2288, the dialog text and its "Re-paste roster" button) versus copyRows (line 2576),
  which uses the gradebook export's list whenever one is loaded and ignores a roster pasted after it; copyUnit's toast (line 2373)
  counts only `ixlOnly` rows as "left out".
- Trigger: a student joins; the teacher sees NOT ON ROSTER: FIX on the IXL account, takes the dialog's "New student?" path, re-pastes
  the Focus roster, and copies before exporting a new gradebook. Each new enrolment, unless a fresh gradebook happens to come first.
- Observed: scrubbed class; the dialog says "New student? Re-paste the roster from Focus so they get a row in Focus order."
  After re-pasting (24 names, the new one in alphabetical place) the grid shows the student matched ("ok"), but the copy has 23
  rows (the old gradebook's), the new student is not in it, and the toast still says "23 rows in Focus order" with no word about
  them. The Focus page now has 24 rows, so a paste puts every student from the new one down on the wrong row (the 22 Oct
  Critical, by the path the dialog recommends).
- Expected: what the dialog promises (a row in Focus order), or a dialog and a copy that tell the truth: with a gradebook loaded,
  "export a new Focus gradebook so they get a row", and a copy that warns or refuses when the roster holds a matched student the
  gradebook lacks (AUDIT_PLAN Fixed-Critical 1: "a student who left or joined can never shift everyone below by a row").
- Repro: probes/11-repasted-roster-left-out.js
  ```
  OBSERVED: dialog: "New student?Re-paste the roster from Focus so they get a row in Focus order."; after re-pasting, the new student is "ok" on the grid, in the copy: false; copy has 23 rows for a Focus roster of 24; toast: "Unit 2 copied: 23 rows in Focus order · Focus title: IXL Unit 2 · Sep 26 · /17 · 7 blank rows (not in IXL) · 6 IXL students not on the roster: left out (tap the"
  EXPECTED: the copy has a row for the new student in Focus order (24 rows), as the dialog promises; or, if Copy must follow the gradebook export, the dialog says to export a new gradebook and Copy says a roster student is missing from it
  FAIL the re-pasted student gets a copy row, or the copy says why not
  ```
- Suggested fix (smallest, no order change): when `sec.grades` is loaded, (1) the dialog's New-student choice says "Export a new
  Focus gradebook and import it: Copy follows the gradebook's rows"; (2) copyUnit computes `extra = buildRows(sec).filter(r =>
  r.status === 'ok' && !copyRows(sec).some(c => norm(c.display) === norm(r.display)))` and, if any, asks before copying ("1
  student on your roster isn't in the Focus gradebook of <date>: the paste would be a row short below them"). Taking the roster's
  order when `rosterAt > grades.importedAt` is the other option, but it reopens the 22 Oct question, so it is a decision.
- Confidence: High on what happens; the remedy is a DECISION for Croix.

### IXL-12  "What changed this week" counts skipped and not-on-roster IXL accounts; the Race for the same class doesn't
- Class: WRONG-NUMBER
- Severity: Medium
- Where: home.js: digestFor (line 165: `const keys = Object.keys(cur.per)`; `cur.per` holds every IXL account, because snapshot()
  writes all of ixlList); leaderboardData (app.js line 757) filters by population(), so the two disagree.
- Trigger: any class with an IXL account the teacher skipped (withdrawn, duplicate account) or one not on the roster yet. Common;
  every weekly digest for such a class.
- Observed: synthetic class, roster of 2, a duplicate IXL account skipped. The duplicate gains 3 skills. What changed: "1 of 3
  moved up", "+3 skills at goal", Biggest movers "ACCOUNT, DUPE". The Race for the same class: 0 of 2. Withdrawn students
  also keep appearing in "Dropped" / "still at zero" and the per-student average.
- Expected: the counted class (population(): "The students a class is measured on"; openNotOnRoster's Skip: "they leave the
  grid, copies, and the race"). "% of the class moved up" should agree with the Race's figure for the same class and dates.
- Repro: probes/12-digest-counts-skipped-accounts.js
  ```
  OBSERVED: What changed: 1 of 3 moved up, +3 skills, movers ["ACCOUNT, DUPE"]; the Race for the same class: 0 of 2; counted class 2
  EXPECTED: the counted class only (2 students): 0 of 2 moved up, +0 skills, no movers; the skipped duplicate account is out ("Skip them: they leave the grid, copies, and the race")
  FAIL What changed measures the counted class
  ```
- Suggested fix: in digestFor, `const pop = new Set(population(sec).map(x => x.key)); const keys = Object.keys(cur.per).filter(k =>
  pop.has(k));` and filter `newNames` / `gone` the same way (or keep "New in IXL" over all accounts on purpose, since it is
  how a new account is noticed). The numbers then match the Race.
- Confidence: High.

### IXL-13  A skill skipped for one student between two imports is read as that student dropping (Race, What changed)
- Class: WRONG-NUMBER
- Severity: Medium
- Where: app.js: snapshot (line 724: `ua[u.name] = u.active.length`, the COURSE count only) and movement (line 742, compares `ua`
  per unit); a per-student skip changes that student's basis without changing `ua`. home.js digestFor labels every negative delta
  "Dropped (SmartScores fell below goal)".
- Trigger: the teacher modifies one student's list (taps a cell to skip a skill they already had at goal: an ESE / 504
  accommodation, a skill done on paper) after an import. Then that week's Race and What changed. Recurring for modified lists.
- Observed: synthetic class, two imports a week apart, nobody practiced. Alex's AA2 (at goal) is skipped for him alone. What
  changed: "Dropped (SmartScores fell below goal): ABBOTT, ALEX −1"; the Race's gain for the class: −0.25 skills per student.
  No SmartScore fell; with best scores on, a SmartScore falling cannot remove a point at all.
- Expected: snapshot's own comment (line 720-722): "`ua` = how many skills each unit counted, so a skip made between two
  snapshots is detected instead of read as a drop". A course skip is detected (`reason: 'basis'`); a student skip should be too,
  at least for that student (leave them out of the comparison).
- Repro: probes/13-student-skip-read-as-drop.js
  ```
  OBSERVED: student skips {"ALEX ABBOTT#0":{"AA2":true}}; What changed "Dropped (SmartScores fell below goal): ABBOTT, ALEX -1"; Race gain per student -0.25
  EXPECTED: nobody practiced and no SmartScore fell: no one "Dropped", Race gain 0 (or Alex left out of the comparison as a changed basis, as a course skip is)
  FAIL no student is reported as dropped
  FAIL the Race does not read the skip as a loss
  ```
- Suggested fix: store each student's own counted total per unit in the snapshot (`own[u.name][key] = activeFor(...).length`, only
  where it differs from `ua`, to keep it small) and in movement() skip a student whose own total changed in any compared unit
  (they are "not measured" this week). Also change the "Dropped" label to "Fewer skills at goal" unless useBest is off.
- Confidence: High.

## Suspicions (unproven)

- **S-1 A student whose own list for a unit is empty** (every counted skill skipped for them): Copy pastes `0` (names / ID modes
  `0\t/0`), the Focus check compares Focus with 0, Still owed prints "0 / 0" and "All 0 skills at goal". Whether Focus should get
  a blank (excused) or a 0 out of a hand-set max is Croix's call; nothing in NOTES decides it. Not a proven defect.
- **S-2 pendingCopies ignores a BLANK Focus IXL cell** (`ixlColOf` needs status score or missing), while reconcile calls the same
  cell "nothing in Focus yet". So the student page / report plan never lists "your IXL points go into Focus" for a column the
  teacher hasn't filled for that student. May be deliberate (a blank is out of the grade); belongs with the grades auditor.
- **S-3 Same-name IXL pair listed in the other order by a later export**: would swap their best scores and skips exactly as in
  IXL-05. I could not establish how IXL orders two identical names, so only the "one leaves" case is proven.
- **S-4 `unitColumnQuarters` cache signature** (quarters.js) is gradebook importedAt + assignment COUNT + skill COUNT; an IXL
  re-import that renames a unit with the same skill count, or a gradebook edited in place, would read a stale map. No realistic
  path found.
- **S-5 "Unit 2 IXL Review" (Q2 fixture) is checked against Unit 2** (NOTES 13 Nov counts it as Unit 2's column), so its 15 points
  vs Unit 2's 17 skills puts Unit 2 into "Set up Unit 2 for Focus: which 2 don't count?", whose button skips skills for every
  accelerated class and would break the Q1 "Unit 2 IXL" (17) match. Possibly a DECISION; not reported as a bug because the Q2
  fixture is synthetic.
- **S-6 Copy toast "N blank rows (not in IXL)"** counts ambiguous ("two matches") and No-IXL-account rows as "not in IXL".
- One run of the fuzz harness on the clean copy reported a failure I could not reproduce in four reruns with the same seed (most
  likely the fixture import's UI timing under load); every engine comparison has been 0-disagreement since.

## Cleanup and hardening

- **C-1 One predicate for "a unit's IXL column".** `gbUnitFor` (name or category IXL, unit number, manual map) drives the Focus
  check and unit quarters; about 14 other sites decide with `/\bixl\b/i.test(a.name)` alone (students.js ixlColOf, retakeStatus,
  isAssess, the report lines 644-709; grades.js 218, 243, 644, 652, 668; conference.js 31; app.js 1307). They disagree for a
  column named IXL with no unit (IXL-08), a manually mapped column without "IXL" in its name, and a column the teacher set to
  "not an IXL unit". Replace with `gbUnitFor(sec, a)` (plus `a.max > 0` where needed).
- **C-2 Dead handlers in renderBar**: `$('#toggleAll')` and `$('#printOwed')` (app.js 2121, 2123) match no element (the button is
  `#mToggleAll`; Still owed moved to Reports). Delete both lines.
- **C-3 `ixlKeyAt` validates its cache by length** (app.js 473), the root of IXL-02. Store the array it was built from
  (`sec._keysOf = sec.students`) and rebuild when `sec._keysOf !== sec.students`; then no caller has to remember `_keys = null`.
- **C-4 `gbRows` round-trips the gradebook through roster text** (rosterFromGradebook → split → strip ID → parseRosterText): the
  root of IXL-01 and IXL-06. Build the roster entries from `gb.students` / `gb.ids` directly, one per student, and give
  buildRows an entry point that takes parsed entries.
- **C-5 Rows are keyed by display string in three places that use different row sources**: receipts and overrides (gbRows),
  openReceipt's "now" (buildRows: IXL-09), Still owed and the receipt "gone" check. Use copyRows everywhere a copy is described.
- **C-6 Import order**: app.js 584 snapshots before 585 resets `_keys` and merges best (IXL-02). Reset first, merge, then snapshot,
  as materialize (1792) already does.
- **C-7 Dates**: printStillOwed's meta and copyUnit's Focus-title hint use `sec.date` ("IXL export of ?", "· today") where the grid
  uses `dataDate(s)` (export date, else import day). Use dataDate in both.
- **C-8 reconcile's `excused` local** (app.js 2600) is subsumed by the `a.status[i] === 'excused'` test beside it; harmless, but
  it reads `sec.grades.raw` for nothing.
