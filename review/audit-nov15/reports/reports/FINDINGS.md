# RPT findings: what goes home on paper, and Home (auditor RPT, 15 Nov 2026)

Scope: grades.js 633-1097 (weekly report, print layout, Reports page), students.js 83-351 (notes, practice, family,
returns, Remove a print), home.js (all). Probes in /home/claude/work/audit/reports/probes/ (shared setup: probes/h.js).
Run any probe as `TALLY_REPO=<clean copy> node probes/NN-slug.js`.

### RPT-01  "Remove a print" of a mid-week reprint also erases that week's earlier print (and its "back, signed" tick)
- Class: DATA-LOSS
- Severity: Medium
- Where: students.js: removePrint (line 288), printsOf (line 287); grades.js: logReport (line 883, the one-entry-per-week replace at 891-893)
- Trigger: the class is printed Monday; on Wednesday one or two reports are printed again (a lost copy, a corrected
  grade, the student page's single report). logReport keeps one entry per student per school week, so the reprint
  REPLACES the Monday entry with a Wednesday-dated one (carrying the Monday "back" tick). Remove a print then lists
  "Printed Nov 16 · 21 reports" (23 were printed) and "Printed Nov 18 · 2 reports · 1 back signed" (the tick belongs to
  Monday's sheet). Removing the Wednesday reprint deletes those students' Monday report too, tick included. Undo exists
  only for the 8-second toast. Reprinting a report mid-week is ordinary; removing a print is the 14 Nov flow for an
  "experiment" print, which is exactly what a quick reprint can be.
- Observed: after Mon print (23) + Wed reprint of 2 + remove Wed: `2026-11-16:21`, and student 0 has no report at all
  (`[]`), although the Monday report was handed out and marked back signed.
- Expected: `2026-11-16:23` and student 0 keeps `2026-11-16 back`. NOTES "Remove a print (14 Nov 2026)": it "deletes
  that day's entry ... as if it had never been printed"; the dialog says "Nothing else changes". Monday's print is
  another day's print and must survive.
- Repro: probes/01-remove-print-reprint.js
```
Monday print on record: 2026-11-16:23 | after the Wednesday reprint: 2026-11-18:2 2026-11-16:21
OBSERVED: after removing the Wednesday print: 2026-11-16:21 | student 0 reports: []
EXPECTED: 2026-11-16:23 | student 0 reports: ["2026-11-16 back"]
FAIL Monday's print keeps all 23 reports
FAIL student 0 keeps the Monday report and its back-signed tick
```
- Suggested fix: when logReport replaces a same-week entry, keep the earlier print day on the entry
  (`entry.printed = [...new Set([...(old.printed || [old.date]), entry.date])]`), have printsOf count an entry under every
  day in `printed`, and have removePrint drop only that day from `printed` (deleting the entry only when none is
  left, and then restoring `date` to the remaining latest day). cleanReportLog must keep `printed` (an array of ISO
  days). Could break: tests/family.js section 4 counts; the "since the last report" log reader uses `date` only, so it is
  unaffected. Smaller alternative: in openRemovePrint, warn when a listed day's entries replaced an earlier same-week
  print ("2 of these replaced Monday's reports: removing them removes those too").
- Confidence: High. Would change my mind: a recorded decision that a reprint supersedes the week's earlier print for
  Remove as well (I found none; NOTES 795 only covers the "back" tick and the since-box).

### RPT-02  The report says "every assessment at full marks" over IXL assessments (and over no assessments at all)
- Class: WRONG-INFO
- Severity: Medium
- Where: grades.js: studentReportSection (line 649): `belowFull` (line 712) reads `tests`, which drops IXL columns
  (line 680 `!isIxl(a)`), and `steady` (line 722) prints "Nothing missing and every assessment at full marks"
- Trigger: a student with nothing missing and no step on the plan: typically a student Tally can't see in IXL (7 of
  the 23 in the fixture class are unmatched), or one whose remaining IXL can't move the rounded grade. Also any student
  with no test or quiz graded yet (early in a quarter: `tests` is empty, so the claim is vacuously "true"). The
  randomized oracle hit it in 5 of 9,246 reports; the probe builds it directly.
- Observed: Do this week: "Nothing missing and every assessment at full marks: keep going." The Assessments box
  directly below on the same page: "Unit 2 IXL 5/17 29%", "Unit 1 IXL 5/15 33%".
- Expected: no full-marks claim while any Assessments item (NOTES 8 Nov 2026: "In Focus the IXL columns sit in
  Assessments with the tests and quizzes ... Every graded item of the category is listed now, IXL included") is below
  full or none is graded. NOTES 679 shows the phrase is meant to be literally true ("no longer says 'every assessment
  at full marks' when a retake is on the table"). The retake tile's "None" (NOTES 945) is about retakes and may keep
  using `tests`; the sentence is about assessments.
- Repro: probes/02-full-marks-false.js
```
OBSERVED: Do this week says "Nothing missing and every assessment at full marks: keep going." | the Assessments box on the same page lists ["Unit 2 IXL 5/17 29%","Unit 1 IXL 5/15 33%"]
EXPECTED: no "every assessment at full marks" while an Assessments item is below full (here the IXL columns at a third)
FAIL the report does not claim full marks over IXL assessments at a third
OBSERVED (no assessment graded): {"doThis":"Nothing missing and every assessment at full marks: keep going.","tests":"None graded yet."}
FAIL no full-marks claim when no assessment is graded
```
- Suggested fix: in `steady`, say the full-marks clause only when `asmts.length && asmts.every(a => a.status[i] ===
  'score' && Number(a.values[i]) >= a.max)` (asmts, line 780, is the Assessments box's own list; move its declaration
  above `steady`). Leave `belowFull`/`noRetake` alone for the retake tile. Breaks nothing else; tests that assert the
  phrase for a student with full tests and a full IXL column still pass.
- Confidence: High.

### RPT-03  Home's "Focus gradebook is N days old" ignores the file's own date; the print check uses it
- Class: WRONG-INFO
- Severity: Low
- Where: home.js: attentionItems (line 59) uses `sec.grades.importedAt`; grades.js: staleExports (line 1001) and the
  report header (line 688) use `gb.exportedAt || gb.importedAt`
- Trigger: an export imported days after Focus wrote it (a file from Downloads after a week off, or re-dropping last
  week's file). Uncommon; harmless except that the reminder Croix asked for stays silent.
- Observed: export written 10 days ago, imported today, remind after 7 days: Home says nothing; the print check on the
  same class says "the Focus gradebook in Tally is from Nov 5, 10 days ago".
- Expected: one age for one file. NOTES ("Focus is dated by the file": `gb.exportedAt` before `importedAt`, "in the
  report header, the reminder before printing and 'unchanged since then'") and README's reminder wording.
- Repro: probes/03-home-focus-age.js
```
OBSERVED: Home reminders about the gradebook: [] | print check: ["the Focus gradebook in Tally is from Nov 5, 10 days ago","the IXL export is from Sep 26, 50 days ago"]
EXPECTED: Home also says the Focus gradebook is 10 days old (remind after 7), as the print check does
FAIL Home dates the gradebook by the file, like the print check
```
- Suggested fix: in attentionItems line 59 use `const gd = localDayOf(sec.grades.exportedAt || sec.grades.importedAt)`
  for the age, the text and the detail. Safe: exportedAt is absent on old saves and falls back.
- Confidence: Medium-High (it is a reminder; Croix may prefer import age here, but nothing records that).

### RPT-04  Reports page labels promise what the prints no longer hold ("what moved", "since the last report", "()")
- Class: WRONG-INFO
- Severity: Low
- Where: grades.js: renderReportsPage (line 1084, the Weekly button's subtitle; line 1071, the digest button;
  line 1087 `whoWord`)
- Trigger: every visit to the Reports tab (labels); the "()" title when "By grade" has only "No grade yet" picked.
- Observed: Weekly button: "23 students · grade, what moved, this week's list, pledge", but the "Since the last
  report" strip was removed at Croix's word on 7 Nov 2026 (grades.js line 690 `const since = ''`) and no report says
  what moved. Digest button: "grades, missing work and IXL since the last report", but digestFor compares the newest
  import with the one before it (home.js 168, 181-182), not with the last printed report. Print title with only "No
  grade yet" chosen: "Student reports: 1st Period · Accelerated ()".
- Expected: labels that describe the output: e.g. "grade, this week's steps, missing work and IXL, pledge"; "grades,
  missing work and IXL since the previous import"; and `whoWord` naming "no grade yet" (or omitting the brackets when
  the list is empty).
- Repro: probes/04-reports-page-labels.js
```
OBSERVED: {"weeklyButton":"23 students · grade, what moved, this week's list, pledge","digestButton":"grades, missing work and IXL since the last report","reportSaysWhatMoved":false,"printTitle":"Student reports: 1st Period · Accelerated ()"}
FAIL the weekly button does not promise "what moved"
FAIL the digest button does not say "since the last report"
FAIL the print title is not "...()": Student reports: 1st Period · Accelerated ()
```
- Suggested fix: change the two strings; in whoWord map '—' to 'no grade yet' instead of filtering it out. Text only;
  check tests/command-center.js and print-duplex.js for asserted strings (print-duplex matches `^46 students, 2 classes`
  only).
- Confidence: High.

### RPT-06  A long IXL list repeats the "Start here" box on every continued page
- Class: WRONG-INFO (layout)
- Severity: Low
- Where: grades.js: PAGER_JS `split` (line 920-926, `cp = el.cloneNode(true)` keeps every `[data-keep]` child) with
  the Start here box marked `data-keep` (studentReportSection line 770)
- Trigger: a student whose owed IXL list does not fit the back (well over ~60 owed skills in the open units: an
  accelerated quarter with three or four big units, a student who has started little). Rare today; the 7 Nov
  three-column back makes it rarer.
- Observed: with 150 extra owed skills, each such report prints the same "Start here: closest to goal" box 3 times,
  once on each page of the IXL list (each repeat also takes room from the list).
- Expected: once, at the top of the list (NOTES 948: "at the top of the IXL list (`data-keep`, so it stays with the
  header)"; the header is carried over as "(continued)", the box is content).
- Repro: probes/06-start-here-repeats.js (runs probes/layout.js "many": opens the real print window, waits for the
  layout, reads every section's pages; also checks clipping, odd-page starts, PDF page count, owed items printed)
```
MODE many fallback false sections 24 pages 4,2,4,4,2,4,4,4,2,4,4,4,4,4,4,2,2,2,4,2,4,4,4,1
OBSERVED: section 0 prints Start here 3 times | section 2 prints Start here 3 times | section 5 prints Start here 3 times | ...
```
- Suggested fix: in `split`, after cloning, drop the keep-children from the part that continues:
  `[].forEach.call(el.querySelectorAll(':scope > .pbody > [data-keep], :scope [data-items] > [data-keep]'), function(x){x.remove()})`
  when the split succeeds (`n > 0` and items remain), or mark Start here `data-once` and remove it from `el` on
  continuation. Could break: tests/print-duplex.js "continued" checks (they assert the header, not the box).
- Confidence: High that it repeats; Medium that Croix would call it a defect (it is harmless repetition).

### RPT-07  A modified-list student who finished every own skill still "owes" the IXL column, and the back points at an empty list
- Class: WRONG-INFO
- Severity: Medium
- Where: grades.js: owedWork (line 642, `points(s0, unit, ixlIdx) >= a.max`); studentReportSection `ixlTodo`
  (line 839, "N of M points so far: the rest are below")
- Trigger: a student with skills skipped for them alone (README: "Skills can be skipped ... for one student (tap the
  cell)"; the ESE / modified-assignment case) whose Focus IXL column is still NHI or below its points. Their own list
  is shorter than the column's points, so `points >= a.max` can never be true. Uncommon, but it is exactly the student
  whose family most needs a clear page.
- Observed: 12 of the unit's 17 skills on the student's list, all 12 at goal, Focus column NHI. Front: Missing work
  counts it; back: "Unit 2 IXL 17 points ... 12 of 17 points so far: the rest are below", while the IXL list says
  "Unit 2 ... 12 / 12 All 12 skills at goal". The "Owe work" filter on the Reports page selects the student for it.
- Expected: the column is done in IXL ("done in IXL, not in Focus yet", the `earned` row) when every skill on the
  student's own list is at goal, i.e. `points >= Math.min(a.max, totalFor(s0, unit, ixlIdx))`; and `ixlTodo` never says
  "the rest are below" when the unit has nothing below goal. The page's own rule (owedWork's comment: "an IXL column
  whose skills are all at goal in IXL: that one is done").
- Repro: probes/07-modified-list-never-done.js
```
OBSERVED: {"own":12,"colMax":17,"pts":12,"owed":["Unit 2 IXL"],"unitLine":"Unit 2 Rational and Irrational Numbers12 / 12 All 12 skills at goal","backRow":"Unit 2 IXL 17 points09/2212 of 17 points so far: the rest are below"}
FAIL the column is not owed work
FAIL the back does not point at an empty list
```
- Suggested fix: owedWork `done`: compare with `Math.min(a.max, totalFor(s0, unit, ixlIdx))` (and `totalFor > 0`). Then
  the earned/"done in IXL" wording follows by itself. How many points such a student should get in Focus (12 of 17,
  or a scaled 17) is Croix's call and belongs to the copy engine; this finding is only about the page. Could break:
  the retake rule reads Focus NHI separately (retakeStatus) and is unaffected; check tests/report-redesign.js.
- Confidence: Medium. Would change my mind: a decision that a modified-list student's column stays "owed" until the
  teacher adjusts it in Focus (I found none).

### RPT-08  "This quarter's IXL finished → X%" fills every IXL column to full points, beyond what a modified-list student can earn
- Class: WRONG-NUMBER
- Severity: High (a projected grade printed for the family that cannot be reached; only for students with skills
  skipped for them, so not every week)
- Where: grades.js: studentReportSection `ixlCols` (line 668) and totalsHtml (line 743: `ixlCols.forEach(a => both[a.name] = a.max)`)
- Trigger: a student with a per-student skip in a unit whose Focus IXL column is below its points (e.g. 12/17 after
  the copy, all 12 own skills at goal), and some IXL still owed in another open unit, so the totals row prints.
- Observed: "This quarter's IXL finished (33 skills in Units 1 and 3) → 93% A". 93% is the grade with Unit 2 IXL at
  17/17; the student has 12 skills in Unit 2 and has finished them, so finishing every skill gives 90%. The row also
  silently fills a unit (Unit 2) it does not name.
- Expected: 90% A: each IXL column at `Math.min(a.max, totalFor(s0, unit, ixlIdx))` (what pendingCopies would copy
  once every own skill is at goal; NOTES 8 Nov: "Its grade counts the IXL columns Focus has today", "this quarter's IXL
  finished"). A column whose unit has nothing below goal should not be raised by this row at all.
- Repro: probes/08-modified-list-totals.js
```
OBSERVED: This quarter's IXL finished (33 skills in Units 1 and 3)→ 93% A | every column filled to its points gives 93% A
EXPECTED: the row claims what finishing the student's own skills gives: 90% A {"Unit 2 IXL":12,"Unit 1 IXL":15}
FAIL the IXL total is reachable
```
- Suggested fix: in totalsHtml set `both[a.name] = Math.min(a.max, totalFor(s0, unitOf(a), ixlIdx))` (unitOf via
  gbUnitFor as in owedWork) and skip columns with no unit. For students without skips nothing changes (totalFor >=
  max, or the column is already in `pend` at max). The same cap probably belongs in quickestPath's IXL steps
  (students.js 552, another auditor's scope): worth a check there.
- Confidence: High on the arithmetic; Medium on severity (depends on how often Croix uses per-student skips).

### RPT-09  The retake notice dates HOWL on the coming Wednesday/Thursday even in a break week (Thanksgiving Day this month)
- Class: DECISION (the decided "coming Wednesday and Thursday" produces a false date)
- Severity: Medium
- Where: grades.js: studentReportSection `howlDays` (line 828-829), used by `howl` (line 830)
- Trigger: any weekly report for an eligible student printed in the days before a break. Concretely next week:
  printed Thursday 19 Nov (Wednesday gone, so next week), Friday 20 Nov or the weekend, it names Wednesday 25 Nov
  and Thursday 26 Nov 2026. Lake County Schools' 2026-27 calendar gives "a full week off for Thanksgiving"
  (lake.k12.fl.us, "School Board approves 2025-26 and 2026-27 student calendars"), and 26 Nov 2026 is Thanksgiving
  Day itself. The same happens before winter break and spring break (about four times a year).
- Observed (page clock Fri 20 Nov 2026): "Retakes: you are eligible (...). Come to your math teacher's room during
  HOWL on Wednesday, Nov 25 or Thursday, Nov 26."
- Expected: no school-closed day printed as a retake day for families. NOTES 861 decided "the dates of the coming
  Wednesday and Thursday (next week's once Wednesday has passed)"; Tally has no school calendar, so the decision
  silently assumes every week is a school week.
- Repro: probes/09-howl-thanksgiving.js
```
today in the page: Fri Nov 20 2026 | eligible: true
OBSERVED: Retakes: you are eligible (nothing missing and Units 1 and 2 IXL at goal). Come to your math teacher's room during HOWL on Wednesday, Nov 25 or Thursday, Nov 26. Tell the
EXPECTED: no HOWL day inside Thanksgiving week (Nov 23-27, 2026); at least never Thanksgiving Day, Thursday Nov 26
FAIL the HOWL days are school days
```
- Suggested fix (Croix's choice): a "No school" date list in Settings → Course beside Test dates (the 2026-27 breaks
  entered once), and `howlDays` skipping to the next week whose Wednesday and Thursday are both school days. Cheaper
  stopgap: a hard-coded list for 2026-27 next to Q_ENDS (it rolls over with them anyway, AUDIT item 10). Breaks
  nothing: the boxes "I plan to come Wednesday / Thursday" stay.
- Confidence: High on the dates printed; the remedy needs his decision.

## Suspicions (unproven)

- **A front with only the header.** With ~40 missing assignments (probes/layout.js heavy), "Do this week" does not
  fit under the grade box, is not splittable (no `data-items`), and moves whole to page 2; page 1 then holds the
  title, the grade box, the Next test box and the signatures, and the student's plan is on a back. Nothing is clipped
  or lost (checked), and every student still starts on a front; whether that page order is acceptable is a layout
  judgment, not a defect I can prove.
- **Pop-up blocked.** printWeekly writes the report log before openPrint; when the pop-up is blocked the page is
  downloaded instead, so the log (and the returns list) says "printed" for a file that may never be opened. The
  comment at grades.js 969 says "the log is written only for a report that opens". Not probed (Playwright does not
  block pop-ups); low stakes.
- **"check 13 categories: the gradebook has no Grade column"** (home.js 54) counts assignments whose category is an
  unchecked guess, in a course that has three categories. The wording was approved (NOTES 923, "check 2 categories"),
  so not reported; it reads as false when the count exceeds 3. Seen on the scrubbed Q2 gradebook.
- **Same-name pair** shares one report log, notes, family record (keyed by `norm(name)`): recorded as known in NOTES
  1382, not re-reported. Consequence in my area: logReport for the second of the pair replaces the first's week entry,
  and ticking "back" for one ticks the other.
- **owedWork's `done` test reads only the name** (`/\bixl\b/i`), while gbUnitFor also accepts `category === 'IXL'` and
  a manual `gbUnitMap`. A column mapped by hand that is not named "IXL" is never "done" and reads "Turn in <name>".
  Not probed: it needs a manual mapping (Settings), which I did not exercise.

## Cleanup and hardening

- **CLEANUP-1 Dead work in studentReportSection** (grades.js 649-881): computed and never printed: `sizes`/`nextMax`/
  `na = nextAssessment(...)`/`nextLine` (669-674), `thisWeek`/`log`/`last` (687, for the removed "since" strip), `since`
  (690), `copyLine` (705), `copyPts` (706), `first` (707), `withIxl` (662), `arrow` (676), `ids` (771), `rtUnits`/
  `rtWork`/`ixlNeed`/`rtNeed`/`rtShort` (796-804), `unitWords` (807), `lastPlan` (851), `workingPanel` (865). About 60
  lines of logic that can drift from the printed text and mislead the next reader (e.g. `nextLine` still builds the
  removed next-assessment sentence). Remove them; probes/05-dead-code-cost.js shows nextAssessment runs for no output
  (cost is small: ~1 ms per class). Safe: none is referenced in the returned template (checked by grep counts).
- **CLEANUP-2 One "owes" definition.** renderReportsPage's `owes` (1047) re-derives "has missing work or IXL below
  goal" with `totalFor` and `unitClosed(sec, …)` while the report uses `activeFor` and `unitClosed(openSec(sec), …)`. They
  agreed in all 553 randomized trials (oracle), but two formulas for the filter that picks who gets a report can
  drift. Export the report's own `owedWork(...).owed.length || ixlSkillsOwed` as one helper and use it in both.
- **CLEANUP-3 One column-to-unit lookup.** `gbUnitFor(s0, a)` then `unitsOf(s0).find(x => x.name === u.name)` is
  repeated in owedWork, unitNumOf, listed and pendingCopies. A single `colUnit(sec, a)` would make RPT-07/08's
  `Math.min(a.max, totalFor(...))` cap a one-place change.
- **CLEANUP-4** `minsWord(0)` prints "<1 min" (students.js 216): a student with no time at all reads "<1 min". Use
  `m === 0 ? '0 min'` unless the Quickview itself said "<1 min" (parseMins maps both to 0; keep a flag if it matters).
- **CLEANUP-5** home.js attentionItems line 43 redeclares `H` inside the block (shadows line 25's identical value):
  harmless; drop the inner one.
