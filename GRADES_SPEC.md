# Grades — Focus gradebook analysis in Tally

Written 2026-09-26 before building. Tally already holds each class's IXL scores and (per import) its Focus
gradebook. This adds a teacher-facing **Grades** view per class: the real course grade, trends across imports,
what-ifs for one student, a printable one-page student report, and the one thing a gradebook alone can't show —
whether IXL work is paying off on assessments.

## 1. The grade formula (verified)

Croix's Focus categories: **Assessments 70 · Classwork 25 · Participation 5**. Reverse-engineered from the
scrubbed export and confirmed against its "Grade" column for all 23 students, exactly:

- Each category = points earned ÷ points possible over its assignments (not a mean of percentages).
- `NHI` (not handed in) counts as 0 earned over the full possible. `NG` (excused) is left out of both sums.
  A blank cell is treated like NG.
- Course grade = Σ weight × category% ÷ Σ weight, over categories that have any possible points.
  (Empty categories re-weight the others.) Rounded to a whole percent for display.
- Letters: A 90–100 · B 80–89 · C 70–79 · D 60–69 · F < 60 (Florida scale; Focus's letters agree).

Weights are editable per prep in Settings (Grades section); the defaults are the three above.

## 2. Categories per assignment

The Focus export carries no category, so Tally assigns one per assignment and keeps it per prep in
`state.grading[prep].map[name]`, with a provenance tag: `fit` (proved by the Grade column), `user`, or `guess`.

1. **Guess by name.** whiteboard / participation / bell → Participation; test / exam / assessment / quiz / IXL /
   notebook / vocabulary → Assessments; everything else → Classwork. A name already in the map keeps its category.
2. **Fit to the Grade column.** If the export has an overall grade per student, run coordinate descent from the
   guess: for each assignment try every category with the others fixed, keep the one that minimises
   Σ|computed − Focus| over students, repeat until stable. If the error reaches 0, the mapping reproduces Focus.
3. **Decide what's determined.** For each assignment at error 0, test each alternative category: if any
   alternative also gives 0 (the assignment is all-identical scores, say), that assignment is *ambiguous*.
4. **Ask only when needed.** After import, if any assignment is new (not in the map) and not determined by the
   fit, a "Which category?" panel lists just those, pre-filled with the guess. Assignments the fit proved are
   applied silently and shown with a ✓. If the export has no Grade column, nothing can be proved: new
   assignments are applied as guesses and the Grades view says "categories are guesses — check them".
5. **Move any time.** The assignments table has a category selector per row; changing it marks `user` and
   re-computes. A `user` choice is never overridden by a later fit; if it contradicts the Grade column the row
   shows "Focus disagrees" so the mistake is visible either way.

## 3. Data kept

- `sec.grades` — the current gradebook (as now), back in **localStorage** with the IXL data, plus per-cell
  `status` (`score` / `missing` / `excused` / `blank` / `unread`) and `overall` (the Grade column, when present).
- `sec.gradeHistory[]` — one entry per import date: `{ date, at, file, students[], grade[] (computed %),
  missing[] (count), assignments: [{ name, max, avg, missing }] }`. Computed grades and aggregates only — raw
  scores live only in the current gradebook. Same date replaces; capped at 60 entries.
- `state.grading[prep]` — `{ cats: [{ name, w }], map: { assignment: category }, how: { assignment: fit|user|guess } }`.
- Backup JSON gains `grading` and each class's `gradeHistory`. Its description changes to say so.

## 4. Screens

**Grades button** on the class bar (next to *Still owed*), shown once a gradebook is loaded. Teacher-only; never
reachable from projected mode; the Names toggle masks names here as everywhere.

### 4.1 Class overview (`view.mode = 'grades'`)
- Headline chips: class average and letter counts (A/B/C/D/F), total missing assignments, change in class
  average since the previous import, gradebook date.
- Categories: weight, class average, assignment count per category.
- Assignments table: name · category (selector, with ✓ proved / edited / guess) · due · points · class average ·
  missing · excused · **cost** = class average now minus class average with this assignment removed. Sorted by
  due date, newest first.
- Students table: name · grade · letter · Δ since last import · missing · weakest category · IXL % (assigned
  work at goal). Default sort puts *sliding* students first: grade down ≥ 3 points since last import, or missing
  count up. Tap a row for the student card.
- IXL vs assessments: one dot per student, x = IXL assigned work at goal (%), y = average on non-IXL
  assessments (%). Pearson r and a plain sentence ("students doing more IXL score higher on tests; r = 0.6").
  Shown when ≥ 8 students have both. y excludes the IXL columns so the comparison isn't circular.
- Trend: class average per import date (small line), when there are ≥ 2 imports.

### 4.2 Student card (modal) — superseded by the student page (§8)
Only that student's data on screen. Grade, letter, category bars, grade per import (sparkline), missing list.

What-ifs, each rendered as "→ 84 (B)":
- **Turn in** each missing assignment at full credit, and *all* missing at full credit.
- **Retake** each assessment at 70 / 80 / 90 / 100 %.
- **Next assessment**: points possible (defaults to the most common assessment size) and a score slider →
  resulting grade; plus "needs ≥ N/P for a B, ≥ M/P for an A" computed exactly.
- **IXL**: for each IXL column below full, "at N/N →".
Print button opens the **student report**: one printed page — the grade with its category lines, "what would move
the grade" (each missing assignment turned in, all of it, IXL columns at full, all of it plus IXL, and what the next
assessment needs), then "IXL still owed" (per assigned unit: points, skills below goal with their SmartScore, skills
not started), and the formula footer. Dated, class named, no other students. The class ⋯ menu's **Student reports
(print)** prints the same page for everyone or only students who owe something (missing work or IXL below goal),
one page each — full names, since these go home. `studentReportSection` / `printStudentReports` in `grades.js`.

### 4.3 Category asker (modal, at import)
Listed assignments with a radio per category and the guess selected; Apply. Skip keeps the guesses.

## 5. Privacy and copy
Grades view and card are behind the teacher UI, hidden in projected mode like the grid. The Names toggle masks
student names in both. The storage sentence in Settings changes back to "saved in this browser", and the
backup toast says it contains names, skill counts and computed grades.

## 6. Tests (`tests/grades.js`, against the scrubbed real export)
- Formula reproduces the Grade column for all 23 students; the fit finds the unique mapping (notebook check in
  Assessments) and marks every assignment determined.
- With the Grade column removed, every assignment is a guess and the view says so.
- Moving an assignment to another category marks it `user` and shows "Focus disagrees".
- What-if maths: turning in a missing worksheet, retaking an assessment, and the needed-score solver agree with
  hand-computed values.
- Import twice (different dates) → two history entries; class trend and Δ column render.
- Student card shows only that student's name; print page contains no other names.
- Gradebook survives a reload and rides in a backup/restore.

## 7. Quarters (added 30 Sep 2026)

Focus starts a fresh gradebook each grading period, so after Q1 a class's export holds only Q2 work. Croix doesn't
change grades after a quarter ends and wants its work to stop raising anything while staying viewable.

- **Dates**: `state.quarters.ends` = Lake County 2026–27 (Oct 9, Dec 18, Mar 4, May 28), editable in the Quarters dialog.
  An assignment's quarter = its Focus due date (then assigned date, then the import day). `mdToISO` reads MM/DD into the
  school year (July–December = the first calendar year).
- **Close** (`closeQuarter(n, unitPicks)`): per class, `mergeArchive` keeps quarter n's columns in `sec.qArchive[n]`
  = `{ gb, map, cats, final, at, file }` — the gradebook (every score), each assignment's category, the weights at close,
  and the final grade per student (equal to the Focus Grade column when the export was single-quarter). Course IXL units
  ticked in the dialog get `state.quarters.units[prep][unit] = n` (pre-ticked: units whose Focus IXL column is due in n).
- **Quiet**: every alerting reader uses `openSec(sec)` — the live gradebook minus closed-quarter columns: Overview cards
  and needs-attention, the Grades screen's current tab, sliding, student reports, the digest (which also skips a
  closed quarter's last snapshot and closed units' IXL movement). `reconcile` skips closed-quarter Focus columns;
  still-owed and reports skip closed units — unless the class's open gradebook has a column for that unit (`unitClosed`).
- **Kept, not lost**: a gradebook import first runs `keepOutgoing` — columns of an earlier (or closed) quarter that the new
  file lacks are merged into that quarter's record, so a Q2 export that arrives before Q1 is closed can't take Q1 with it.
  Closed-quarter columns in a later file merge by name (students lined up by name; a file holding every kept column
  replaces the record). Backups carry `quarters` and each class's `qArchive`; loading one unions closed quarters and keeps
  the fuller copy of each record (`mergeArchives`); `cleanArchive`/`cleanGB` coerce every field.
- **History**: grade snapshots carry `q` (and per-student category percents `cats`); one snapshot per day *and* quarter;
  `prevGradeSnap` and the digest compare within a quarter, so nobody "slides" across the break.
- **Reading**: Grades has a tab per quarter (`Q1 · final` read-only with a notice; the open quarter; an empty state until
  the first export of a new quarter). Reopen (Quarters dialog) brings alerts back; the record stays.

## 8. Students (added 30 Sep 2026)

Teacher-only (`view.mode` `students` / `student`; never reachable from projected mode; Names off → initials everywhere).
- **Students list**: every class's students (roster/gradebook order), grade this quarter, change, missing, IXL at goal
  (open units; closed units when nothing else is assigned), closed-quarter finals. Sorts: by class, A–Z, lowest grade,
  most missing, sliding. *Find a student* searches it from the Overview.
- **A student's page**: tiles (grade now, each kept quarter's final, missing now, IXL at goal with change since the last
  export, assessments this quarter); charts — grade by import against the class average with dashed quarter marks, each
  category, missing work, IXL skills at goal (from the IXL snapshots on today's assigned units), every assessment against
  the class average across quarters; every assignment per quarter (kept quarters collapsed); IXL by unit; what-ifs for the
  open quarter (missing turned in, retakes at 70–100%, IXL columns at full, next-assessment slider and the score needed for
  each letter). Prev/Next in Focus order; Print report; Escape/‹ back to wherever it was opened from.
- **Show student** (`#show`): full screen, only that student's first name and numbers; switches for each missing
  assignment (with a score slider), retake sliders (up from the current score), IXL sliders, the next assessment (starts at
  the student's own assessment average); the grade and category bars follow live (`gradeWith` = `computeGrade` with
  overrides plus an optional extra Assessments item); "on its own: N of P gets you a B". Escape, Tab out and file drops are
  swallowed; the teacher holds the exit for 1.5 s.

### 8.1 Quickest way to the next letter (added 1 Oct 2026)
Croix: "a kid that's failing, the quickest way to a D — use NHIs or IXL first; the kids that are failing are all lacking in
this stuff anyway." `quickestPath(sec, s, i, ixlIdx)`: target = the next letter's floor (60/70/80/90). Phase 1 adds, one at
a time, whichever step lifts the grade most: a missing (NHI) assignment at full credit, or one more IXL skill (one point in
that unit's Focus IXL column; ties go to the assignment). Then it prunes any step the plan reaches the letter without.
Phase 2 (only if phase 1 can't reach it): retakes at full, best first, the last one lowered to the least half-point score
that still works. IXL steps name the unit's skills closest to goal first. Shown on the student page (first card), the
Students list ("3 missing → D"), the printed report, and Show student ("Show me on the sliders" applies it).
