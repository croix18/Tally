# Grades — Focus gradebook analysis in Tally

Written 2026-09-26 before building. Tally already holds each class's IXL scores and (per import) its Focus
gradebook. This adds a teacher-facing **Grades** view per class: the real course grade, trends across imports,
what-ifs for one student, a printable per-student summary, and the one thing a gradebook alone can't show —
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

### 4.2 Student card (modal)
Only that student's data on screen. Grade, letter, category bars, grade per import (sparkline), missing list.

What-ifs, each rendered as "→ 84 (B)":
- **Turn in** each missing assignment at full credit, and *all* missing at full credit.
- **Retake** each assessment at 70 / 80 / 90 / 100 %.
- **Next assessment**: points possible (defaults to the most common assessment size) and a score slider →
  resulting grade; plus "needs ≥ N/P for a B, ≥ M/P for an A" computed exactly.
- **IXL**: for each IXL column below full, "at N/N →".
Print button opens a print window with the card only (dated, class name, no other students).

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
