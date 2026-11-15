# Auditor WIF: what-ifs, plans and retakes   (tag WIF, directory /home/claude/work/audit/whatif/)

What a student is told to do, and what they are promised it will get them.

## Scope (read all of it)
- students.js 1-82 (findStudent, classStudents, ixlFor, ixlTrend, studentBooks, cellOf, avgPct, isAssess,
  studentSummary), 352-390 (retakeStatus, retakeOkWhy, retakeWhy, retakeChip), 391-703 (renderStudentsView,
  openProfile, renderProfile, tileSpark, ixlColOf, focusPts, pendingCopies, quickestPath, quickestShort, quickestList,
  quickestCard, nextSize, whatIfArrow, whatIfMarkup, needText, wireWhatIf, gradeWith), 704-836 (openShow, closeShow).
- grades.js: neededOn, withNext, nextAssessment, owedWork, openStudentCard.
- GRADES_SPEC.md sections 4.2, 4.2b, 8 and 8.1; tests/whatif-audit.js and tests/quickest.js (borrow their setup).

## Oracle
1. What-ifs: for any combination of switches and sliders (each missing item turned in, each assessment retaken at
   70 / 80 / 90 / 100, the IXL finished, the next assessment at x %), the grade shown must equal the grade of a
   gradebook with exactly those edits, recomputed by your own grade function. Drive the real controls and read the
   real screen, hundreds of random students and combinations.
2. "The exact score needed for an A / B / C": it must reach the letter after rounding, and one step less must not.
   Brute force every possible score. Impossible and already-there cases must say so truthfully.
3. The quickest way to the next letter: brute-force the true minimum number of pieces of work under the documented
   rules (missing work and IXL first; a retake only if all of that falls short, and only when a retake is allowed) for
   hundreds of random students. Compare: the number of steps, that applying the plan really reaches the letter, that a
   stated count ("3 steps") equals the steps listed, and that the IXL skills it names are that student's own skills
   below goal, closest to goal first.
4. Retake eligibility: nothing missing AND every IXL skill at goal in the units that count (see the rule of 24 Oct in
   AUDIT_PLAN.md: every unit with an IXL column in the open gradebook), with student skips and closed quarters.
   Recompute independently; the Students list chip, the student page, the what-ifs, Show student, the report and the
   conference form must all give the same answer and the same reason.

## Edges to attack
A student already at an A (no next letter); an F far from a D; a grade exactly on a cut-off; extra credit; excused
items; a category with one item; a retake score below the current score (which one counts, per the spec?); a missing
item with max 0; a gradebook with no IXL column; Focus behind Tally (the "Copy Unit N IXL into Focus" step); a student
with no IXL link; a modified list; two students of one name; a kept (closed) quarter being viewed; a quarter with no
assessment yet (nextSize's estimate: what does it assume, and does the screen say so?); slider ends; Show student
isolation (only this student's name and numbers anywhere in the DOM, titles, aria or data attributes); Prev / Next
order; the trend tiles' deltas and "since the last import"; percent formatting at .5.
