# WIF findings: what-ifs, plans and retakes (audit of 15 Nov 2026, copy at 8f973ed)

Probes are in `/home/claude/work/audit/whatif/probes/`. Each runs as `TALLY_REPO=<repo> node probes/NN-slug.js` and
exits 1 while the defect is present. `probes/fuzz.js` is the oracle harness (not a finding probe; see COVERAGE.md).

### WIF-01  Two students with one name: the second one's what-ifs, plan, assignment table and Show student are the first one's
- Class: WRONG-NUMBER (and PRIVACY: Show student turns one student's grade toward another)
- Severity: Critical (rare trigger)
- Where: students.js: studentBooks (line 56), openShow (line 704), renderProfile (line 453, `at = list.findIndex(n => norm(n) === norm(name))`), studentSummary finals (line 74)
- Trigger: a class with two students of the same full name (the case the 14 Nov fix, NOTES "Hostile review" item 3, was for). Rare, but when it happens it happens on every visit to the second student.
- Observed: the 14 Nov fix marks the names ("SUTTER, HAYDEN SKYLER (ID …0000)" / "(ID …0037)") and `findStudent` tries the exact name first, so the big tile is right (78%). But `studentBooks`, `openShow` and the Prev/Next position look the student up with `norm(x) === norm(name)`, and `norm()` turns both marked names into the same string ("sutter hayden skyler id"). So on the second student's page: "What would move the grade" says Now 79 (the first student's), the quickest-way card, the assignment table (Quarter 1 · 79% C) and the assessments chart are the first student's, Show student opens on the first student's 79% and sliders, and the header reads "24 of 25" (the first one's place), so Next from the second student lands back on the second student. The closed-quarter finals tile (`studentSummary`, line 74) uses the same norm lookup on `qArchive[n].gb.students`.
  Side effect seen in the probe: the class list has 25 entries for 23 students (the unmarked roster row plus both marked names).
- Expected: every figure on the second student's page and on their Show student screen is theirs (78%), and the position is their own place in `classStudents` (25 of 25). NOTES "Hostile review, 14 Nov 2026" item 3 marks this DONE ("each student's own numbers show"); `tests/review-nov14.js` checks only the tile.
- Repro: probes/01-same-name-page.js
```
names: SUTTER, HAYDEN SKYLER (ID …0000) / SUTTER, HAYDEN SKYLER (ID …0037)  row of the second: 1
OBSERVED: second student's page: tile 78%, what-ifs "Now" 79%, assignment table head 79%, Show student 79%, position "24 of 25"
EXPECTED: every figure is the second student's own grade 78% (the first student has 79%), position "25 of 25" (its own place in classStudents)
PASS tile shows the second student
FAIL what-ifs ("Now") are the second student's
FAIL the assignment table is the second student's
FAIL Show student shows the second student
FAIL Prev/Next position is the second student's
```
- Suggested fix: one lookup, exact name first, then norm, as `findStudent` does: a helper `idxIn(names, name) = names.indexOf(name) >= 0 ? names.indexOf(name) : names.findIndex(n => norm(n) === norm(name))`, used in studentBooks (both loops), openShow, studentSummary's finals and renderProfile's `at` (with `list.indexOf(name)` first). Safe: for unique names the exact match and the norm match are the same row. The phantom unmarked roster row is a separate question (the roster still holds the unmarked name).
- Confidence: High. The probe stages the pair exactly as tests/review-nov14.js does.

### WIF-02  "To retake: finish 15 IXL skills in Unit 1" when 7 open the retake (a unit with more skills than its Focus column has points)
- Class: WRONG-INFO
- Severity: High
- Where: students.js: retakeStatus (line 352, `shortIn` returns every own skill below goal) and every reader of `short.length`: retakeWhy (line 381), the what-if heading tag, Show student's retake line, grades.js studentReportSection (`ixlNeed`, line 798), conference.js (lines 92-94, "Finish on IXL: Unit 1: 15 skills left")
- Trigger: every week, in the real class: Unit 1 has 23 skills and its Focus column "Unit 1 IXL" is out of 15. Four of the 16 linked students in the scrubbed class (rows 0, 9, 18, 21) have Unit 1 as a blocker; row 18 is told 9 skills where 1 is enough.
- Observed: the decision of 24 Oct / 3 Nov (AUDIT_PLAN "For Croix": "IXL points enough for full credit in a unit's Focus column now count as full credit … it matters only for a unit with more skills than the column counts") makes the column the requirement, and `retakeStatus` applies it to decide `ok`. But the count it reports is every skill below goal in the unit. The probe's student (8 of 23 at goal, column out of 15) is told "finish 15 IXL skills in Unit 1"; after 7 more skills Tally itself says the retake is open ("nothing missing and Units 1 and 2 IXL at goal"). The quickest-way plan on the same page plans 7 (`need = min(short, cap − now)`), so the page says 7 in the plan and 15 in the retake tag.
- Expected: the number to finish is what opens the retake: `min(short.length, a.max − points)` per blocking column (7 here), the same figure the plan uses. The list of skills can stay (closest to goal first), but the count and the words "finish N" must match the rule.
- Repro: probes/02-retake-skill-count.js
```
Unit 1: Focus column out of 15 · the student's own skills 23
OBSERVED: retake chip "15 IXL skills in Unit 1"; to the student: "finish 15 IXL skills in Unit 1"; after 7 more skills the retake is open ("nothing missing and Units 1 and 2 IXL at goal")
EXPECTED: the line asks for 7 more skill(s) in Unit 1 (enough for the column's 15 points), since that alone opens the retake
FAIL the chip names the skills that open the retake (7), not every skill below goal
```
- Suggested fix: in retakeStatus, give each blocking unit `need = a.max > 0 ? Math.min(sh.length, a.max - points(sec, u, f.ixl)) : sh.length` and have retakeWhy, the report's `ixlNeed`, the conference form and quickestPath's `needUnits` read `need` instead of `short.length` (keep `short` as the skill list). Nothing changes for a unit whose column has as many points as skills. Also "Units 1 and 2 IXL at goal" in retakeOkWhy is then slightly false for a capped unit (8 skills still below goal); "Unit 1 IXL at full credit" would be exact.
- Confidence: High that the screens disagree with the rule and with the plan beside them. If Croix wants every skill of the unit done before a retake, then `ok` (not the count) is the wrong half; either way the two halves disagree today.

### WIF-03  An NHI on an extra-credit (0-point) column closes the retake and is listed as missing work "turned in, 0/0"
- Class: WRONG-INFO (a wrong retake answer)
- Severity: Medium (the retake answer is Critical-class, but the trigger needs an NHI typed on an extra-credit column)
- Where: students.js: retakeStatus (line 352, `missing` = every NHI but IXL), studentSummary (line 67, `missing`), whatIfMarkup (line 662, `missing` list), openShow (line 704, "not handed in · worth 0 points"); quickestPath (line 552) skips them (`a.max > 0`), so it disagrees.
- Trigger: since 14 Nov a 0-point column counts as extra credit (NOTES "Review items 1 and 2 built"). A teacher who marks NHI on an extra-credit assignment for the students who did not do it (Focus accepts the code on any column) gets this for each of them. Uncommon; new since 14 Nov.
- Observed (probe, a real student made eligible, then one 0-point column with NHI for them): the grade is unchanged (86% before and after, correctly), but the retake goes from eligible to "1 missing", the Missing now tile and the Students list count 1, the what-ifs offer "Puzzle Extra Credit · turned in, 0/0 → 86 B no change", and the quickest-way card on the same page still plans "Retake Squares and Cubes Quiz … allowed once everything above is done" while the retake tag beside it says "not yet: 1 missing".
- Expected: a 0-point column owes nothing (Focus: extra credit adds to earned and nothing to possible, so an NHI there is 0 of 0): it should not count as missing, not close a retake, and not be offered as "turned in, 0/0". At minimum the plan and the chip must agree.
- Repro: probes/03-extra-credit-nhi.js
```
OBSERVED: grade 86% before and 86% after the 0-point column (no effect); retake eligible before: true · after: false ("1 missing"); what-if row: "Puzzle Extra CreditClasswork · due 09/24turned in, 0/0→ 86 B no change"; Missing now tile: 1 ; quickest plan lists a retake: true (Squares and Cubes Quiz)
EXPECTED: a 0-point (extra-credit) column owes nothing: retake still eligible, no "turned in, 0/0" row, not counted as missing; the plan and the chip agree
FAIL an NHI on an extra-credit column does not close the retake
FAIL no "turned in, 0/0" what-if row
FAIL not counted as missing work
```
- Suggested fix: one predicate `owes(a, i) = a.status && a.status[i] === 'missing' && a.max > 0` used by retakeStatus, studentSummary, whatIfMarkup, openShow and grades.js owedWork (which has the same filter, line 642). Could break nothing that is counted today, since a 0-point NHI changes no grade. If Croix does want "no NHIs at all" literally, say so and quickestPath should then require it too.
- Confidence: Medium. Certain about the disagreement between the plan and the chip; whether an NHI on extra credit "owes" anything is his call.

### WIF-04  Show student: "Show me on the sliders" keeps the student's earlier picks, so the big grade is not the plan's
- Class: WRONG-NUMBER (on the student-facing screen)
- Severity: Medium
- Where: students.js: openShow, the `#shPlan` handler (line 761): it sets the missing-work switches and only the IXL / retake sliders that are in `plan.over`; the next-assessment switch and any other retake or IXL slider keep what the student set.
- Trigger: the natural use of the screen: the student plays with the sliders, then taps "Show me on the sliders". Every time anything outside the plan was touched first.
- Observed: a real student (79% C, plan "79% → 80% B"): the student switches on the next test and drags it to 0 (70%), taps "Show me on the sliders", and the top still reads 70% C, under a card that says 80% B. In a 70-student fuzz (probes/showfuzz.js) 63 of 70 plan taps after random picks did not show the plan's grade; from a fresh screen all 70 did.
- Expected: the button shows the plan: every control the plan does not use returns to now (next test off, other sliders at their current scores), so the top reads the plan's 80% B. Spec §8: "'Show me on the sliders' applies it".
- Repro: probes/04-show-plan-keeps-picks.js
```
OBSERVED: after trying a 0 on the next test (70%), "Show me on the sliders" shows 70% C (next test still counted: true), under a plan card that reads "79% → 80% B"
EXPECTED: the sliders show the plan alone: 80% B
FAIL applying the plan shows the plan's grade
```
- Suggested fix: in the `#shPlan` handler, reset first (for 're' and 'ix' rows not in `plan.over`, set the slider back to the row's `min`, the current score; uncheck `#shNextOn` and hide its slider), then apply the plan. Or simply call the Start over path and then apply. Breaks nothing: the plan never uses the next assessment.
- Confidence: High.

### WIF-05  Show student: an NHI IXL column is two controls (a "Turn it in" switch and a "Finish IXL" slider) for one cell
- Class: WRONG-INFO (student-facing)
- Severity: Low
- Where: students.js: openShow (line 704): `missing` is every NHI and `ixlCols` includes an NHI IXL column; `recompute` lets the IXL slider overwrite the switch silently.
- Trigger: any linked student whose unit IXL column is NHI in Focus (Croix's 31 Oct rule makes these common: "an IXL column with skills still to do is a missing assignment").
- Observed: Unit 2 IXL NHI: the screen has a "Turn it in … worth 17 points" switch and a "Finish IXL" slider. Switch on → 89%; then slider to 2 → 80% while the switch still reads on at "17 / 17". The teacher page's what-ifs list the same column in both tables as well (each row's own number is right there).
- Expected: one row per assignment; for a linked student the IXL slider alone (it covers 0 to full), as quickestPath already treats it (an NHI IXL column with an IXL link is planned as skills, not as one piece of work).
- Repro: probes/05-show-ixl-twice.js
```
OBSERVED: Unit 2 IXL rows on Show student: miss + ix · "Turn it in" on → 89%; then Finish IXL slider at 2 → 80% while "Turn it in" still reads on at 17 / 17
EXPECTED: one control per assignment (the column once), so the screen never shows two answers for one cell (full credit would be 89%, 2 points 80%)
FAIL the NHI IXL column is one row on Show student
```
- Suggested fix: in openShow, `missing = … .filter(a => !(ixlCols.includes(a)))` when the student is linked (keep it under missing work when not linked, as quickestPath does). "Show me on the sliders" already sets the IXL slider from `plan.over`, so it keeps working.
- Confidence: High on the behavior; Low severity because each number shown is the formula's answer for the control last touched.

### WIF-06  Show student's next-test slider can start above the test's points ("27.5 / 27") and counts that score
- Class: WRONG-NUMBER (small)
- Severity: Low
- Where: students.js: openShow (line 704): `ownAvg = base.cats.Assessments.pct / 100` (no cap), `nxStart = Math.round(nx * ownAvg * 2) / 2`; the output label and `st.next.pts` take nxStart, the range input clamps itself to its max.
- Trigger: a student whose Assessments category is over 100% (a bonus point on a quiz, or extra credit filed under Assessments, which Tally counts since 14 Nov). Top students, now and then.
- Observed: Assessments 102.7%, next test out of 27: the label reads "27.5 / 27", the slider thumb sits at 27, and "Count it" computes the grade from 27.5 of 27 (101.76% instead of 101.51%).
- Expected: the start is clamped to the test's points (`Math.min(nx, …)`), so the label, the thumb and the grade agree. Spec §8: "the next assessment (starts at the student's own assessment average)".
- Repro: probes/06-show-next-over-max.js
```
OBSERVED: Assessments 102.7%; next test out of 27 · label "27.5 / 27", slider at 27 · the grade counts 101.76% (from the label's score), not 101.51% (the slider's)
EXPECTED: the start never exceeds the test's points: label 27 / 27 at most, and the grade is the slider's
FAIL the starting score is within the test's points
```
- Suggested fix: `const nxStart = Math.min(nx, Math.round(nx * ownAvg * 2) / 2)`. While there: the "own assessment average" includes the IXL columns (they sit in Assessments), unlike the page's "Tests & quizzes" tile, which leaves them out; using the same figure as the tile would be the student's test average.
- Confidence: High.

### WIF-07  An IXL column excused for one student still closes their retake, and the plan says it "isn't in Focus yet"
- Class: WRONG-INFO (one half), DECISION (the other)
- Severity: Medium
- Where: students.js: retakeStatus (line 352: every IXL column counts whatever this student's cell is); quickestPath phase 2 (line 552 ff.: `col = … ixlCol(a)` needs a score or NHI cell, so an excused cell gives `needUnits … full: false`); quickestList (the `ixlreq` line: "Unit 2 IXL isn't in Focus yet").
- Trigger: a student excused from a unit's IXL in Focus (NG: joined late, modified plan). Uncommon, but every week for that student.
- Observed: Unit 2 IXL excused for the student, nothing missing, tests low. Retake: "16 IXL skills in Unit 2". The plan: "no change · Finish 16 IXL skills in Unit 2 · Unit 2 IXL isn't in Focus yet · needed before a retake", then "Retake Squares and Cubes Quiz".
- Expected: (a) the plan's reason is false: the column is in Focus, excused for this student. (b) DECISION for Croix: the 24 Oct rule is "a unit's IXL counts only while the open gradebook has an IXL column for it and that cell isn't already at full credit" ("everything Focus grades"); a cell Focus excuses is not graded for this student, so by that rule it should not be required. If he wants it required, the line should say "excused in Focus".
- Repro: probes/07-excused-ixl-column.js
```
OBSERVED: Unit 2 IXL is excused for the student; retake: "16 IXL skills in Unit 2" ; plan line: "no changeFinish 16 IXL skills in Unit 2 Unit 2 IXL isn't in Focus yet · needed before a retake"; then Squares and Cubes Quiz
FAIL no "isn't in Focus yet" for a column that is in Focus
FAIL an IXL column excused for the student does not close the retake (the 24 Oct rule)
```
- Suggested fix: in retakeStatus's column loop, `if (a.status && (a.status[f.gi] === 'excused' || a.status[f.gi] === 'blank')) return;` before the `seen` check (so another column of the same unit can still count). The `ixlreq` text then only appears for units with no column. If the decision goes the other way, give `needUnits` a third reason ("excused in Focus").
- Confidence: High on (a); (b) is his call.

### WIF-08  Focus's IXL cell ahead of Tally's points: the plan says one skill fills the column and opens the retake; it does neither
- Class: WRONG-INFO
- Severity: Medium
- Where: students.js: quickestPath (line 552): `ixlInfo.cap = min(a.max, max(n, focus))` and each IXL step is `nowOf(a) + 1` on top of the Focus cell; phase 2's `need = min(short, cap − nowOf(col))`. retakeStatus (line 352) judges the same column by Tally's points.
- Trigger: the Focus check's "N off" state for a student: Focus holds more IXL points than Tally (points typed by hand, a skill skipped for the student after the copy, a goal raised, or IXL data from a smaller export). Uncommon, but Tally already detects it.
- Observed: Unit 2: Tally 1 point, Focus 16/17. The plan: "Pass 1 more IXL skill … → 86%", then "Retake Squares and Cubes Quiz … allowed once everything above is done". The retake line on the same page: "16 IXL skills in Unit 2". After the student does that one skill Tally has 2 points, no copy to Focus (2 < 16), and the retake is still closed ("15 IXL skills in Unit 2").
- Expected: a plan step is work that does what it says. With Focus ahead, a skill moves Focus only once Tally's points pass the Focus cell, so either plan from Tally's points (cap and steps measured from `points`, with a note that Focus is ahead) or leave the column out of the plan and say "Focus has more than IXL shows: check Unit 2 IXL". The retake requirement must be the same number in both places.
- Repro: probes/08-focus-ahead-ixl.js
```
OBSERVED: Unit 2: Tally 1 points, Focus 16/17 · plan step "Pass 1 more → 86%", then retake Squares and Cubes Quiz · retake line "16 IXL skills in Unit 2" · after doing that step: copy to Focus none , retake "15 IXL skills in Unit 2"
EXPECTED: a step the plan lists moves the grade it says once done: with Focus ahead of Tally, one skill moves nothing; the plan should count from Tally's points (or say the Focus cell is ahead)
FAIL doing the plan's IXL step changes what Focus gets
```
- Suggested fix: when `focusPts(a, i) > points(...)` for a column, skip it in phase 1 (no step can move it until Tally catches up) and in phase 2 require `min(short, a.max − points)` skills with no grade change (an `ixlreq`-style line, "Focus already has 16 of 17"), matching retakeStatus. Unchanged for every student whose Focus cell is at or below Tally's points.
- Confidence: Medium-High: what Croix types into Focus in this state is his call, but the plan and the retake line cannot both be right.

### WIF-09  Retake table: the "70%" column can show a score below 70% (14.5 / 21 = 69.0%)
- Class: WRONG-INFO
- Severity: Low
- Where: students.js: whatIfMarkup (line 662): `pts = Math.round(a.max * p / 100 * 2) / 2` (nearest half point).
- Trigger: every assessment whose points times the percent is not on the half-point grid; in the real class "Unit 1 Assessment" (21) at 70% and "Unit 2 Vocabulary Quiz" (7) at 80% (5.5 / 7 = 78.6%). The fuzz found 2,950 such cells in 3,000 random students.
- Observed: "70%" column: 14.5/21 (69.0%). The arrow is computed from 14.5 (fixed 19 Oct, NOTES "The 1 % slip"), so the grade is right for that score; the header is not.
- Expected: the column's score is the least half point at or above the percent (`Math.ceil(a.max * p / 100 * 2 - 1e-9) / 2`: 15/21), so "a 70% retake" and the score shown agree. That is also what "Below 70% (can be retaken)" on the conference form means by 70%.
- Repro: probes/09-retake-cell-below-percent.js
```
OBSERVED: Unit 1 Assessment out of 21: 70% column → 14.5/21 (69.0%) · 80% column → 17/21 (81.0%) · 90% column → 19/21 (90.5%) · 100% column → 21/21 (100.0%)
EXPECTED: each column's score is at least that percent: the least half point at or above it (70% of 21 = 14.7 → 15, 90% → 19)
FAIL no column shows a score below its own percent (70%)
```
- Suggested fix: ceil instead of round, as above; keep the dash test (`a.values[i] >= a.max * p / 100`). Changes some cells by half a point upward, never the arrow's agreement with the score shown.
- Confidence: High on the arithmetic; Low severity (the prediction matches the score shown).

### WIF-10  After a quarter closes, the "IXL at goal" tile compares the student's open units with a class average over every unit
- Class: WRONG-INFO
- Severity: Medium
- Where: students.js: renderProfile tiles (line 447 ff.: `clsNow = it.cls[last]`, `itD` from `it.mine`); ixlTrend (line 49: `units = unitsOf(sec).filter(u => u.assigned)`, closed units included) against ixlFor (line 38: `basis = open units`).
- Trigger: every student page, every week, once a quarter is closed with units ticked (Quarter 2 now: Quarter 1 ended 9 Oct).
- Observed: Q2 gradebook imported, Q1 closed with Units 1 and 2 ticked (Unit 2 stays open because the Q2 gradebook has "Unit 2 IXL Review"). Tile: "IXL AT GOAL 6% · 2 of 36 skills · class average 33.1 skills". 33.1 is the class mean over Units 1, 2 and 3 (59 skills, Unit 1 closed); on the tile's own basis (Units 2 and 3) it is 19.6. The sparkline in the same tile ends at 10 skills (all units) while the tile says 2, and "+N since the last export" is taken from that all-units line.
- Expected: one basis in one tile (NOTES 14 Nov item 7 made "IXL at goal" one figure on Grades and Students; the comparison beside it was left on the old basis): the class average, the sparkline and the change counted on the same units as "2 of 36", or the tile says which units each covers.
- Repro: probes/10-ixl-tile-class-average.js
```
units: Unit 1 (closed) 8/23, Unit 2 1/17, Unit 3 1/19
OBSERVED: tile "IXL AT GOAL 6% 2 of 36 skills · class average 33.1 skills" (the sparkline's last point is 10 skills, the tile's own count 2)
EXPECTED: the class average counted like the student's figure (open units only): 19.6 skills; and the sparkline / "since the last export" on the same basis
FAIL class average on the tile's basis
FAIL the sparkline counts what the tile counts
```
- Suggested fix: give ixlTrend a unit list argument and pass the tile's basis (`ix.basisClosed ? closed units : open units`), so `val(h, k)` sums `h.pu` over those units only (snapshots carry `pu` for every unit). The "IXL skills at goal" chart on the page (spec §8: "from the IXL snapshots on today's assigned units") can keep all assigned units if that is the intent, but then its label should say so.
- Confidence: High.

### WIF-11  A student on a modified IXL list is offered "every skill, 17/17" though finishing their list puts 12/17 in Focus
- Class: WRONG-INFO
- Severity: Medium (Low if Croix scales such students' columns in Focus by hand)
- Where: students.js: whatIfMarkup (line 662, the "If IXL were finished" rows use `a.max`), openShow (line 704, the IXL slider runs to `a.max`); compare quickestPath's `cap = min(a.max, max(own, focus))` and pendingCopies' `to = min(a.max, points)`.
- Trigger: any student with per-student skips in a unit (README: "Skills can be skipped … for one student (tap the cell)", the modified-list case), every week.
- Observed: own list 12 of the unit's 17 skills, column out of 17: the teacher page offers "Unit 2 IXL · now 1/17 · every skill, 17/17 → 89 B +10"; finishing every one of the student's 12 skills makes Tally's copy 12/17. Show student's slider for the same column runs to 17. The plan on the same page stops at 12.
- Expected: "If IXL were finished" is what finishing the student's own list gives (12/17 here, and its grade), the slider's top is the same, matching the plan and the copy Tally will tell the teacher to make. If the intent is that a modified student's column is scored out of their list, then the copy (pendingCopies) is the half that needs to change; today the screens disagree with each other.
- Repro: probes/11-whatif-ixl-modified-list.js
```
OBSERVED: own list 12 skills, column 17 points; what-if row "Unit 2 IXLnow 1/17every skill, 17/17→ 89 B +10"; finishing every own skill copies 12/17 into Focus
EXPECTED: "every skill" offers what finishing the student's own list gives: 12/17 (or the list is scaled to the column, and the copy says so)
FAIL the IXL what-if is reachable by finishing the student's own list
```
- Suggested fix: compute the reachable top per column once (`Math.min(a.max, Math.max(activeFor(...).length, focusPts(a, i)))`, the plan's `cap`) and use it in whatIfMarkup's IXL rows ("every skill, 12/17") and as the IXL slider's max in openShow. No change for students without skips.
- Confidence: Medium: certain that the screens disagree; which side is right depends on how Croix scores a modified student in Focus.

## Suspicions (unproven)

- **Two open IXL columns for one unit** (e.g. "Unit 2 IXL" and "Unit 2 IXL Review" both in one quarter's gradebook): pendingCopies copies `min(max, points)` into each, and quickestPath counts a skill once per column (one skill would move both), so the plan's step count would be low and its grade high. Not staged: the scrubbed Q2 gradebook has the Review column only after Unit 2's own column is closed. Worth one test with both columns open.
- **"Since the last export" on the IXL tile** (`itD`) takes the last two non-null points of the student's line, so a student missing from the newest IXL export is shown an older change as if it were the latest. Seen in the code only (the fixture has one IXL import).
- **A quarter with no assessment yet**: nextSize falls back to 20 points and Show student's start to 80%; neither screen says the 20 is assumed (the field is editable, so this is a hypothesis, not a false statement). Low; mention to Croix rather than fix.
- **Renamed categories**: withNext / gradeWith / nextAssessment hard-code the category name 'Assessments'. A prep whose weights name it otherwise ("Tests") gets weight 0 for the next assessment, so every "needs N/P" line says no single test reaches anything. Not probed (Croix's three categories are fixed today).

## Cleanup and hardening

- **C1. One "owes" predicate.** "Missing" is computed five ways: studentSummary (every NHI), retakeStatus (every NHI but IXL), owedWork (every NHI but an IXL column done in IXL), quickestPath (`a.max > 0`, and IXL columns only without a link), whatIfMarkup / openShow (every NHI). WIF-03 and WIF-05 are two consequences; the page's "Missing now" tile and the Students list still count a done IXL column that the printed report (owedWork, "One missing count", 3 Nov) no longer counts. One helper `owes(s0, s, i, ixlIdx)` returning `{ work, ixlCols, earned }` would let every screen say the same number. Safe: each caller keeps its own filter on top if it needs one.
- **C2. quickestShort ignores `retakeBlocked`** (students.js line 635): for a student with no IXL link the Students list says "D needs more than missing work, IXL and retakes" although retakes were never tried (the card says so correctly, quickestCard line 651). Change to `q.retakeBlocked ? 'needs more than missing work and IXL' : …`.
- **C3. The Students list "Retake" sort** (renderStudentsView line 391) orders by `missing.length + short.length` and ignores `behind`, so a student blocked by an earlier unit sorts as if nearly eligible. Add `+ r.retake.behind.reduce((n, x) => n + x.short.length, 0)` (or WIF-02's `need`).
- **C4. README "Retakes" paragraph** still states the 19 Oct rule ("every IXL skill in the unit the course is working in is at goal"); the code and NOTES follow the 24 Oct rule (every unit with an IXL column in the open gradebook whose cell is not at full credit). Update the README so the next reader does not "fix" the code back.
- **C5. Retake table uses `a.values[i] / a.max` without a guard** (whatIfMarkup) and Show student's `ownAvg` (line 704) has no cap (WIF-06); both are safe today only because `tests` filters `a.max > 0`. Keep the filter next to the division.
- **C6. Show student's next-test max is 200, the teacher page's 500** (`#shNextMax` vs `.wiMax`): pick one constant.
