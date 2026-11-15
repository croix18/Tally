# Auditor GRD: the grade engine   (tag GRD, directory /home/claude/work/audit/grades/)

## Scope (read all of it)
- grades.js lines 1-632 (letterOf, gradingFor, the cat* functions, isExtraCredit, computeGrade, roundPct, gradeAll,
  fitCategories, applyCategories, neededOn, withNext, the snap* functions, gradeSnapshot, pearson, asgUnitNums,
  isUnitAssessment, isPretest, ixlTestPairs, ixlVsTests, classAverage, codeKey, applyCodes, gbQuestions,
  regradeCourse, gradingRestore, gradeOff, gradeDiff, openGradeDiff, pct1, the chips, sparkline, scatterSVG,
  renderGrades, openStudentCard) and 1098-1133 (askCategories, openWeights).
- app.js parseGradebook (line 1675) as far as it decides max, scores, status and codes.
- GRADES_SPEC.md sections 1-3 and 7; NOTES.md sections of 13 and 14 Nov 2026 (the reader asks instead of guessing;
  extra credit; "See why").

## Oracle
Your own Focus grade from the spec: weighted categories on points earned over points possible; NHI (missing) counts as
zero; NG / excused is left out; what happens to a category with nothing graded; extra credit as decided on 14 Nov;
rounding and the letter cut-offs. Fuzz at least 5,000 random gradebooks times random weights and compare
computeGrade's percent, letter and per-category figures. Then:
- fitCategories: when it returns a fit, does that fit really reproduce every Focus grade in the export? Can it return
  a fit that is wrong but plausible? What happens when several fits reproduce the grades?
- gradeDiff / "See why": every statement it makes ("would match if ...") must be literally true. Apply the stated
  change and recompute. Try noise: Focus grades off by a random point.
- neededOn / withNext: the score it says is needed must reach the letter after rounding, and one step less must not.
  Check by brute force over every possible score. Impossible cases (needs over 100 %, already there) must say so.
- classAverage: which students count (withdrawn, no grade, excluded); mean of what, rounded when?
- gradeSnapshot and the "sliding since the last import" deltas.
- pearson: compare with your own to 1e-12; n < 2; zero variance; ties.
- asgUnitNums / isUnitAssessment / ixlTestPairs / ixlVsTests: fuzz assignment names ("Unit 10 Test" against Unit 1,
  "Unit 3-4", "Unit 3/4", a date like "10/3 Quiz", "Quiz 3.2", "U3 Assessment", "Unit 2 Re-Assessment").
- scatterSVG geometry: every dot at the position its two values say, against the axis ticks; overlapping dots; the
  popup names the right student, including with two students of one name and after a sort.
- parseGradebook: header forms for points, percent cells, text codes, negative and over-max scores, decimals ("8.5",
  ".5"), "1,000", trailing spaces, "100%", due dates, duplicate assignment names, a row of blanks, the Grade column's
  formats.

## Edges to attack
Everyone excused on an item; max 0; a category with weight 0; weights that do not sum to 100; a category holding only
extra credit; extra credit pushing a category over 100 %; a student with nothing graded (what is shown: NaN, 0, a
dash?); a grade of exactly 89.5, 79.5, 69.5, 59.5 built from floats (0.895 * 100); is the letter taken from the rounded
or the unrounded percent, and is that what Focus does per the spec; kept quarters graded with their own categories and
weights (qSec, openSec); the sec._cats, sec._map and sec._ec overrides; gradingFor returning fresh objects (a mutation
that is silently lost); fitCache going stale after a weights edit, a Decide answer, or a new import (a stale grade on
screen is Critical); regradeCourse and its Undo restoring everything.
