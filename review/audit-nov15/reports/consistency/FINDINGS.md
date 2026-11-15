# CON findings: one number, every screen (audit of 15 Nov 2026, copy at 8f973ed)

Harness: `probes/h.js` (scenario setup, a scrape of every surface in one page session, an independent recount from raw
state) and `probes/cmp.js` (compares every surface with the recount and lists every disagreement). Each finding below
has its own probe that exits 1 while the defect exists.

### CON-01  Two students with one name: Show student, the conference form and the quarter book show the other one's grade
- Class: WRONG-NUMBER (and PRIVACY: one student's grade on another's student-facing screen)
- Severity: Critical
- Where: students.js: openShow (line 704) `findIndex(n => norm(n) === norm(name))`; students.js: studentBooks (line 57/59,
  both branches) and studentSummary finals (line 76) the same `norm(x) === norm(name)`; conference.js: conferenceData
  (line 26) takes its grade from studentBooks; students.js: findStudent (line 21) IXL fallback
  `cachedRows(sec,'all').find(r => norm(r.display) === nn)`.
- Trigger: two students of one name in one class (review item 3, marked DONE 14 Nov). Rare, but when it happens it
  happens on every visit to the second student. `uniqueNames` marks them "SUTTER, HAYDEN SKYLER (ID …0421)" /
  "(ID …5712)", and `norm()` strips that mark, so every lookup above lands on the FIRST of the pair.
- Observed (scrubbed class, the Q1 gradebook with Tolliver's row renamed to a second "SUTTER, HAYDEN SKYLER"):
  second Sutter, own grade 97 %: page tile 97 % A (right), but the quarter heading "Quarter 1 · 79% C", Show student
  "Your grade now 79% C" (with the first Sutter's categories, sliders and missing work), conference panel and the
  printed conference form "Current Grade: 79%". His IXL (he has no IXL row) is shown as the first Sutter's: Students
  list and page "17% 10/59".
- Expected: each of the pair sees only their own numbers: 97 % on every surface, IXL "not matched". NOTES "Review items
  3, 5…" says `findStudent` tries the exact name first so that "each student's own numbers show"; only notes, report log
  and conference text were listed as still shared.
- Repro: probes/01-twin-books.js
  ```
  OBSERVED: {"name":"SUTTER, HAYDEN SKYLER (ID …5712)","own":97,"tile":"97%A","head":"QUARTER 1 · 79% C · 13 ASSIGNMENTS","show":79,"conf":79,"ixlShown":0,"ixlOwnRow":null}
  FAIL quarter heading is the student's own grade · FAIL Show student · FAIL conference form · FAIL IXL shown
  4 FAILED (7 passed)
  ```
- Suggested fix: one helper `gbIndex(gb, name)` = exact `indexOf(name)` first, `norm` only as the fallback (what
  findStudent already does), used by openShow, both branches of studentBooks and studentSummary's finals; in
  findStudent, skip the `norm(display)` IXL fallback when the gradebook has more than one student of that norm name.
  Safe: for every class without a same-name pair the exact match is the same row the norm match finds today.
- Confidence: High.

### CON-02  Student page IXL tile: "2 of 36 skills · class average 33.1 skills": the average is over other units
- Class: WRONG-NUMBER
- Severity: High
- Where: students.js: renderProfile (line 519, the "IXL at goal" tile) with ixlTrend (line 48):
  `units = unitsOf(sec).filter(u => u.assigned)` (every assigned unit, the closed quarter's included) while the tile's
  own "X of Y skills" is ixlFor's open-quarter basis. The tile's sparkline and "±N since the last export" (`itD`) are
  on the all-units basis too.
- Trigger: any class in Quarter 2 once its Q2 gradebook is in (the state today, 15 Nov): every student page.
- Observed: scrubbed class + Q2 gradebook: "IXL AT GOAL 6% · 2 of 36 skills · class average 33.1 skills" (Units 2-3
  counted for the student; 33.1 is the class mean over Units 1-3, 59 skills). Every student reads as far below the
  class; a strong student's "27 of 36 · class average 33.1" says he is under average when he is above it.
- Expected: the class average on the same 36 skills: 19.6 skills (recount over population(), activeFor, eff ≥ goal on
  the units ixlFor counts). README/NOTES: the Students page's IXL is "this quarter's IXL" (open units).
- Repro: probes/02-ixl-tile-class-average.js
  ```
  OBSERVED: IXL AT GOAL 6% 2 of 36 skills · class average 33.1 skills | units counted for the student: Unit 2, Unit 3
  EXPECTED: class average on the same 36 skills (Unit 2, Unit 3): 19.6 skills
  FAIL the class average is on the same units as the student's count
  ```
- Suggested fix: give ixlTrend the units ixlFor counts (`ixlFor(sec, si).open`, or all when `basisClosed`) and sum
  `h.pu[u.name]` over those only; the trend then also matches the tile. History entries without `pu` cannot be split by
  unit: drop the class-average clause for them rather than mix bases.
- Confidence: High.

### CON-03  One student, two missing counts: "Missing 3" and "2 missing" in the same Students row
- Class: WRONG-INFO
- Severity: Medium
- Where: students.js: studentSummary (line 68, `out.missing` = every NHI) feeds the Students list "Missing" column and
  the page's "Missing now" tile (renderProfile line 519); grades.js renderGrades and home.js gradeSummary count every
  NHI too. grades.js: owedWork (line 642) feeds the weekly report and conference.js its "Missing: N"; retakeStatus
  (students.js line 411) drops every IXL column.
- Trigger: a student whose IXL column is NHI in Focus while the unit's skills are all at goal in IXL (the points wait
  to be copied). Common in the days between IXL work and the teacher's copy: Q2 scrubbed fixture has one such student.
- Observed (scrubbed class, Q2 gradebook, TOLLIVER, PARKER; NHI: Unit 2 IXL Review, Unit 2 Notebook Check, Worksheet
  3.4; Unit 2 IXL all at goal): Students list "Missing 3" and, in the same row, Retake "2 missing"; page tile "MISSING
  NOW 3 · not handed in (counts as 0)" beside the Retake tile "2 missing"; weekly report "Missing work 2"; conference
  panel "Missing: 2".
- Expected: one count, or the difference said. AUDIT_PLAN.md (24 Oct item 15): "IXL columns are judged by the skills,
  one meaning of 'missing' everywhere"; (3 Nov, weekly report item 2): "one count everywhere… An IXL column done in IXL
  is noted, not counted." The teacher's surfaces never got that rule.
- Repro: probes/03-missing-two-counts.js
  ```
  OBSERVED: {"n":"TOLLIVER, PARKER",…,"list":{"missing":"3","retake":"2 missing"},"tile":"MISSING NOW 3 not handed in (counts as 0)","retakeTile":"RETAKE Not yet 2 missing","report":"Missing work2","conf":"Missing: 2"}
  counts {"list":3,"tile":3,"listRetake":2,"report":2,"conf":2}
  FAIL every surface gives the same missing count
  ```
- Suggested fix: the smallest is on the student surfaces: count with owedWork in studentSummary (Students list, tile,
  "Most missing" sort) and say the rest on the tile ("+1 IXL column to copy"). Keep Grades/Home on Focus's NHI count if
  he wants Focus's view there, but then label it "NHI in Focus". Could break: tests that expect the raw NHI count on
  the list (grep `Missing` in tests/students*.js).
- Confidence: High that the counts differ; Medium on which is "right" for the teacher's list (a DECISION for Croix).

### CON-04  Grades → Categories "Avg (turned in)" counts work not turned in as 0 (Classwork 80 %, turned in 99 %)
- Class: WRONG-INFO
- Severity: Medium
- Where: grades.js: renderGrades (line 508), `catRows` = mean of `computeGrade(...).cats[c].pct` (NHI = 0 earned over full
  possible), printed under the header "Avg (turned in)" whose tooltip says "Average of the scores turned in: work not
  handed in is left out here (it counts as 0 in the grade)". The Assignments table's column of the same name does
  leave NHIs out (`a.values` of NHI cells are null), so the two "Avg (turned in)" columns on one screen use two rules.
- Trigger: every Grades screen with any NHI (always).
- Observed (scrubbed class, Q1): Assessments 81 %, Classwork 80 %, Participation 100 %. Every Classwork assignment
  shows 97-100 % turned in in the table below; the category says 80 %.
- Expected: either the turned-in average (Assessments 82 %, Classwork 99 %), matching the header, the tooltip and the
  assignments table; or keep the number (it is the class's category average as graded) and rename the column
  "Avg (as graded)" with a tooltip "NHI counts as 0". GRADES_SPEC §4.1 says only "class average … per category".
- Repro: probes/04-category-avg-turned-in.js
  ```
  OBSERVED: {"Assessments":"81%","Classwork":"80%","Participation":"100%"} | tooltip: Average of the scores turned in: work not handed in is left out here (it counts as 0 in the grade)
  EXPECTED: the turned-in average {"Assessments":"82%","Classwork":"99%","Participation":"100%"} (what is shown equals NHI-as-zero: …)
  FAIL Assessments · FAIL Classwork
  ```
- Suggested fix: relabel the category column ("Avg (graded)", tooltip "each student's category percent, NHI as 0"):
  one string, no number changes. The as-graded number is the more useful one for a category.
- Confidence: High.

### CON-05  Nothing graded yet: the conference panel says "Quarter 1: null%", the printed form "Current Grade: %"
- Class: WRONG-INFO
- Severity: Low
- Where: conference.js: openConference (line 474), the "From the gradebook" list at line 505:
  `d.r ? \`${Q_NAMES[d.q - 1]}: ${d.r.rounded}% ${d.r.letter}\` : ''` (computeGrade returns an object whose `rounded` is
  null when nothing counts); the form's `current` (line 479) is '' and the template prints "%" after it.
- Trigger: a student every cell of whose open gradebook is NG / excused / blank (a new student, a long absence) in
  the first weeks of a quarter. Uncommon.
- Observed: page tile "QUARTER 1 GRADE — nothing graded yet (all excused or blank)"; conference panel "Quarter 1: null%";
  printed form "Current Grade:%". The panel also says "Retake: eligible" (the report says "Retake a test? —").
- Expected: "Quarter 1: nothing graded yet" (the tile's words) and an empty Current Grade box without a "%".
- Repro: probes/05-conference-null-grade.js
  ```
  OBSERVED: {"tile":"QUARTER 1 GRADE — nothing graded yet (all excused or blank)","facts":"Quarter 1: null% IXL: 33 of 59 skills at goal Missing: 0 Retake: eligible","printed":"Current Grade:% "}
  FAIL conference panel has no "null" · FAIL printed form does not print a bare "%"
  ```
- Suggested fix: line 505 `d.r && d.r.rounded != null ? … : \`${Q_NAMES[d.q - 1]}: nothing graded yet\``; print the "%" only
  when `current` is set. No number changes.
- Confidence: High.

### CON-06  Moving a category (or a weight) makes students "slide": the earlier import keeps the old categories
- Class: WRONG-NUMBER
- Severity: Medium
- Where: grades.js: catRefresh (line 128), the Weights dialog's save (line 1132), regradeCourse (line 289): each calls
  `gradeSnapshot(s)`, which rewrites only the CURRENT gradebook's snapshot. Earlier entries of `sec.gradeHistory` keep
  grades computed under the old map/weights (raw scores aren't kept for them, GRADES_SPEC §3). prevGradeSnap /
  digestFor / the Students list / the trend then subtract across two different rules.
- Trigger: the teacher moves an assignment to another category (the Grades table's selector, "Let Tally decide",
  "Use Focus's categories", a See-why fix), changes a weight, or decides a text grade, in a week that has an earlier
  import. Category moves are a normal flow (NOTES 23 and 25 Oct: he set several by hand).
- Observed: the same Q1 gradebook imported on Nov 8 and Nov 15 (no score changed): before the move every student is
  ±0. After moving "Unit 1 Notebook Check" Assessments → Classwork: 19 of 23 students show a change "since Nov 8"
  (−3, −1, +1, −1, −1, −2 …), Grades "SLIDING 1 since Nov 8", the digest lists 1 student as sliding and the class
  average falling 82.6 → 81.9; the Students list's "Sliding" sort and the student pages' "−3 since the last import"
  say the same.
- Expected: no student moved, so every change is ±0 and Sliding 0. The digest already refuses to compare IXL across a
  changed goal or skill basis ("the goal changed between … so movement isn't comparable"); grades need the same.
- Repro: probes/06-category-move-fakes-slide.js
  ```
  before the move: students with a change since last import = 0
  OBSERVED: {"since":19,"sample":["−3","−1","+1","−1","−1","−2"],"slide":"SLIDING 1 since Nov 8","digestSlid":1,"digestAvg":[82.6,81.9]}
  FAIL no student shows a change (19 do) · FAIL Sliding is 0 · FAIL the digest lists nobody as sliding (1)
  ```
- Suggested fix: store a fingerprint of the grading rule in each snapshot (`rule: hash(cats weights + map of its
  assignments + codes + ec)`), and have prevGradeSnap / digestFor treat a snapshot with another rule as "not
  comparable" (say "categories or weights changed since Nov 8" instead of a Δ), exactly as `movement()` does for IXL.
  Cheaper alternative: on a rule change, regrade earlier snapshots whose gradebook is still the current one (same
  assignments) — not possible in general, so the fingerprint is the safe route.
- Confidence: High.

### CON-07  The plan counts a copy as 15 points, the Copy column pastes 17: the quickest way and the report are off
- Class: WRONG-NUMBER
- Severity: Medium
- Where: students.js: pendingCopies (line 652) `to = Math.min(a.max, points(...))` (used by quickestPath, the weekly
  report's baseline, Show student, retakeStatus's "full credit"); app.js: unitColumn (line 2328) and reconcile (line 2592)
  paste / compare `points(sec, unit, r.ixl)` uncapped.
- Trigger: a unit whose Focus IXL column is worth fewer points than the unit's counted skills (the Focus check says
  "Focus: points differ"; the scrubbed real class has it: Unit 1 IXL = 15 points, 23 skills) and a student past the
  column's points. Happens whenever the column was made before the unit's skill list was final.
- Observed: COBB, TAYLOR JORDAN, Unit 1: Focus 3/15, 17 skills at goal. Plan: "Copy Unit 1 IXL into Focus · IXL has
  15, Focus shows 3 → 58%", then "Turn in 2.03 Worksheet → 63% D" (Students list "copy IXL + 1 missing → D"; the report
  says the same to the family). The Copy column for Unit 1 has "17" for him and the Focus check's Tally column 17;
  pasting it gives 60% D on its own.
- Expected: one number for one copy. Either Copy pastes min(points, column points) (what the plan, report and retake
  rule assume), or the plan counts what Copy pastes. The Focus check's "points differ" warning says the column's
  points should equal the unit's skills, so capping the paste at the column's points is the safer of the two (Focus
  then reads it as 100 %, not as 113 %).
- Repro: probes/07-copy-vs-plan-cap.js
  ```
  OBSERVED: {"n":"COBB, TAYLOR JORDAN","col":"Unit 1 IXL","colMax":15,"unitSkills":23,"plan":15,"copyText":"17","focusCheckTally":17,"gradeIfPlan":58,"gradeIfCopied":60}
  FAIL 1 students whose Copy number differs from the plan's
  ```
- Suggested fix: decide which (DECISION for Croix: is a 17 in a 15-point column extra credit he wants?), then use one
  helper `copyValue(sec, unit, si, a)` in unitColumn, reconcile and pendingCopies.
- Confidence: High on the disagreement; Medium on which side is intended.

### CON-08  Overview card of a class with no IXL yet: "IXL WORK AT GOAL — first import"
- Class: WRONG-INFO
- Severity: Low
- Where: home.js: renderHome (line 75), the IXL tile's line: `sub(r && r.gain != null ? … : r && r.thrChanged ? … :
  r && r.basisChanged ? … : 'first import', !r)`. When the class is not in leaderboardData at all (`r` undefined: no
  IXL students), the "reason" shown for the dash is 'first import'.
- Trigger: a class made from its Focus gradebook before its IXL export (the pool flow, "waiting for the accelerated IXL
  export"); also a class whose IXL export had no names. Happens once per such class, at the start of a year or term.
- Observed: "IXL WORK AT GOAL — first import" for a class with 0 IXL imports (its Needs attention line says "waiting
  for the accelerated IXL export").
- Expected: "no IXL export yet" (or the attention item's words) under the dash.
- Repro: probes/08-home-ixl-dash-first-import.js
  ```
  OBSERVED: {"key":"period-2","ixlStudents":0,"history":0,"tile":"IXL WORK AT GOAL — first import"}
  FAIL no "first import" under a class with no IXL import
  ```
- Suggested fix: `!r ? 'no IXL export yet' : …` first in that chain. Text only.
- Confidence: High.

### CON-09  "IXL work at goal" on the Overview counts last quarter's units; the student surfaces count this quarter's
- Class: DECISION (WRONG-INFO if he reads the card as "this quarter")
- Severity: Medium
- Where: home.js: renderHome card (line 75) and the "IXL work at goal by class" chart read app.js: leaderboardData
  (line 756) `completion` over `assignedUnitsForPrep` (every assigned unit up to Working in, closed quarters included).
  students.js ixlFor, the weekly report, Still owed, the Lab's "Quarter N IXL" use openUnits / `!unitClosed`.
- Trigger: every class from the first Quarter 2 gradebook on (now), and more so as the year goes on: Quarter 1's units
  are mostly finished, so the all-year share rises above the quarter's.
- Observed (scrubbed class + Q2 gradebook): Overview "IXL WORK AT GOAL 56%" (Units 1-3); the same class on this
  quarter's units (Units 2-3) is 55 %, the basis of every student's "IXL at goal" on the Students list and page.
  Small here (the fixture's Q1 unit is as unfinished as the rest); with a real class that finished Unit 1 in Q1 the
  gap is the whole of Unit 1.
- Expected: the card is the teacher's summary beside "Focus average · Q2"; NOTES (15 Nov, the quarter pie) defines
  "this quarter's IXL" as `openUnits` and says the Students page, report and still-owed list use it. Either the card
  uses openUnits, or its label says what it counts ("all units so far", as the Race's "Counting Units 1–3" does).
- Repro: probes/09-home-ixl-basis.js
  ```
  OBSERVED: {"tile":"IXL WORK AT GOAL 56%","quarter":2,"open":["Unit 2","Unit 3"],"openPct":55}
  FAIL Overview IXL at goal is on this quarter's units
  ```
- Suggested fix: (Croix's call) compute the card's percent from `openUnits(s)` (the Race can keep its own basis: it
  says "Counting Units 1–3"), or add "· Units 1–3" under the number.
- Confidence: Medium (a basis choice; no decision about the card's basis found in NOTES).

### CON-10  A closed quarter shows two "final" grades: the kept Focus final (95 %) and Tally's recount (90 %)
- Class: WRONG-NUMBER
- Severity: High
- Where: quarters.js: mergeArchive / closeQuarter keep `qArchive[n].final` = the export's Grade column (GRADES_SPEC §7);
  but the closed quarter's screens recompute: students.js renderProfile's quarter book heading
  (`computeGrade(b.s, b.i)` with "· final"), grades.js renderGrades on the Q1 tab ("Final class average" =
  classAverage of the recomputed grades; the Students table's grade column), while studentSummary's finals (the
  "Quarter 1 final" tile, the Students list "Q1 97 A", the conference report card) and home.js gradeSummary's
  `qFinal` (mean of `final`) show the kept column.
- Trigger: closing a quarter while Tally's grade differs from Focus's for any student: the case the "Tally's grade
  differs from Focus's for N of M students" notice exists for. NOTES (13-14 Nov): his real class has such a mismatch
  that is still unexplained. Also any cell changed after the Grade column was computed.
- Observed (scrubbed Q1 gradebook with one cell of INGRAM, SHILOH PHOENIX turned to NHI, the Grade column unchanged;
  then the Q2 gradebook; Quarter 1 closed): her page has the tile "QUARTER 1 FINAL 95% A" and, below it, the book
  "QUARTER 1 · FINAL · 90% A · 1 missing". Grades → Q1 · final: her row 90 A; "FINAL CLASS AVERAGE 82%", while the kept
  finals average 82.6 (83 % on the Overview card when the class waits for its Q2 gradebook).
- Expected: one final per student per quarter. The final of record is Focus's (README: "the final grades"; the
  conference form's report card uses it), so the closed screens should show `final[i]` as the grade (and may show
  Tally's recount beside it, labelled, when it differs).
- Repro: probes/10-q1-final-two-numbers.js
  ```
  OBSERVED: {"gradesQ1Avg":"FINAL CLASS AVERAGE 82% Quarter 1, as closed","gradesQ1Row":"90A","meanOfKeptFinals":82.6,"kept":95,"finalTile":"QUARTER 1 FINAL 95% A closed · kept in Tally","q1Book":"QUARTER 1 · FINAL · 90% A · 13 ASSIGNMENTS · 1 MISSING","focusCol":95}
  FAIL the Q1 final tile and the Q1 book agree
  ```
- Suggested fix: in qSec's archived view expose `final`; the closed book heading, the Q1 tab's grade column, letters and
  "Final class average" read it (fall back to the recount only where `final[i]` is null). Could break: tests that
  compare the Q1 tab with computeGrade on the archive (they agree whenever Tally matched Focus, as in the fixtures).
- Confidence: High.

## Suspicions (unproven)

- **Retake what-if cells can show a score below the column's percent.** Student page, Hayden Sutter (scenario A):
  "Unit 2 Vocabulary Quiz 5/7 · 80% column: 5.5/7 → 79 C no change" (5.5/7 = 78.6 %); 90 %: 6.5/7. The points are rounded
  to the nearest half point, so a cell headed 80 % may hold 78.6 % and its grade. GRADES_SPEC §4.2b says the cells
  "show the points that percent means"; whether half-point rounding (down as well as up) is intended I could not find.
  Engine auditor for what-ifs should rule. Not given a probe.
- **Digest "Sliding:" vs the Overview/Grades "Sliding".** home.js digestFor counts `slid` = grade down ≥ 3 only
  (labelled "slid 3+ points", correct), but its list is headed "Sliding:", the word the Overview and Grades use for
  "down 3+ OR more missing work". A student who only gained missing work is "sliding" on the card and absent from the
  digest's "Sliding:" list (he appears under "Newly missing work"). Wording; not probed.
- **Nothing graded yet but "Retake: eligible".** Students list chip and conference panel say eligible for a student
  with nothing graded; the weekly report says "Retake a test? —" (seen in scenario C, MERCER). Retake of what is moot;
  folded into CON-05's observation, not a separate finding.
- **The class average on the student page's IXL tile with skills skipped.** After skipping a unit's skills for the
  course the tile still read "class average 33.1 skills" over a 40-skill basis (scenario E); probably the same root
  as CON-02 (history `pu` summed over every assigned unit), possibly also a snapshot not redone by my state edit. Not
  separated.

## Cleanup and hardening

- **CLEANUP: the letter scale is written four times.** grades.js `LETTERS` / `letterOf` (line 6-7), `letterOfPct`
  (line 648, used once, at grades.js:702, always with a rounded value), `nextAssessment`'s `[[90,'an A'],…]` and its
  `floor` ternary (line 633), students.js `NEXT_UP` (line 646). Replace letterOfPct with letterOf and derive the other
  two from LETTERS; safe (same thresholds today), removes a drift risk if a cut changes.
- **CLEANUP: "missing" is counted in six places with three rules** (gradeSummary, renderGrades, studentSummary,
  gradeSnapshot: every NHI; owedWork: NHI minus IXL columns done; retakeStatus: NHI minus every IXL column). One
  helper with a named rule per use would have prevented CON-03.
- **CLEANUP: gradebook row lookups by `norm(name)`.** openShow, studentBooks (two branches), studentSummary's finals,
  conferenceData via studentBooks: after uniqueNames these must try the exact name first (CON-01). `findStudent`
  already has the right pattern; reuse it.
- **FRAGILE: the Data Lab's letter buckets for an assignment** (app.js:1052) use `Math.round(v / max * 100)`, not
  `roundPct` (the +1e-9 slack). With tenth-point scores some x.5 percents round down (e.g. 8.7/20 = 43.5 → 43); none of
  the 50 cases found for max ≤ 60 sits on a letter line, so no wrong letter today. Use roundPct for one rule.
- **Doc drift: README "Retakes"** says eligible when "every IXL skill in the unit the course is working in is at goal";
  the code (24 Oct decision) checks only units that have an open Focus IXL column not at full credit, so a student is
  "eligible" with the working unit at 1/19 when Focus has no column for it yet. Update the README sentence.
