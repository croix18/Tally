# GRD findings (auditor's report, condensed by the orchestrator from its final message; probes are in probes/)

### GRD-01  The category fit gets stuck before finding an exact fit that exists
- Class: WRONG-NUMBER · Severity: High · Where: grades.js fitCategories, `descend` (line 86) and its starting points (100-102)
- Claim: with one wrong stored category, right weights and an exact Focus Grade column, the search moves one assignment at a time in column order, takes the first move that lowers the error, and often stalls (90 of 400 random classes; 174 of 399 when the wrong one is the last column). Then nothing is "proved", 23 of 27 students are flagged, and See why has nothing class-wide to say.
- Expected: GRADES_SPEC 2.2 "until stable"; one move reproduces every grade, so the fit should reach 0.
- Repro: probes/01-fit-stalls.js · Suggested fix: steepest descent (try every assignment-and-category move each round, apply the best), or try every single move from the stored map first.

### GRD-02  "See why" states a cause that only holds with the fit's categories
- Class: WRONG-INFO · Severity: Medium · Where: gradeDiff test (d) (line 356) via errOf (line 341: the lower of the error with the categories in use and with fit.map)
- Claim: it says "Every grade matches when Item 5 isn't counted" though with Tally's categories 15 of 20 are still off; the moved category is never named or offered. Same flaw in the "empty cells as zeros", "NHIs on X", "every blank / no NHI" sentences.
- Repro: probes/02-seewhy-notcounted-other-map.js · Suggested fix: test with the map in use (errOne(..., map)); when only fit.map gives 0, name the moved assignments and offer "Use these categories".

### GRD-03  The weight search skips Tally's own weights, so it offers wrong weights
- Class: WRONG-INFO · Severity: High · Where: gradeDiff (e), combos.forEach (line 387)
- Claim: the combination equal to Tally's weights is skipped entirely, including "Tally's weights plus one assignment moved". It then lists other weights (40/50/10 + a move) with a one-click fix that changes the whole course, and says the setups "can't be told apart".
- Repro: probes/03-seewhy-skips-own-weights.js · Suggested fix: for the base weights skip only the no-move case.

### GRD-04  "Since the last import" compares grades worked out under different settings
- Class: WRONG-INFO · Severity: Medium · Where: gradeSnapshot (line 168) regrades only the current snapshot; prevGradeSnap and renderGrades compare with the old one
- Claim: after a weights / category / text-grade change with no score changed, 20 of 23 students show a change, 2 are "sliding", the class average shows -1.
- Repro: probes/04-sliding-after-settings-change.js · Suggested fix: store a hash of gradingSnap(prep) in each snapshot; when it differs show no change and say the settings changed.

### GRD-05  A closed quarter shows two different finals
- Class: WRONG-NUMBER · Severity: Medium · Where: qSec (quarters.js 106) feeds renderGrades and the student page's computeGrade (students.js 503); mergeArchive keeps Focus's Grade column as `final` (tiles, Home)
- Claim: kept final 73, but the Q1 tab row and the student page header show 79 C; "Final class average" 83% against 82.48.
- Repro: probes/05-closed-quarter-two-finals.js · Suggested fix: in a closed quarter show a.final[i], or label the recomputed figure and show both.

### GRD-06  A new assignment that two categories fit gets its name guess even when the guess does not fit
- Class: WRONG-NUMBER · Severity: Medium · Where: applyCategories (line 120)
- Claim: stored as the name guess (Assessments) although only Participation and Classwork give zero error; 1 of 23 differs; the screen shows "Matches the Focus Grade column for all 23" beside "differs for 1 of 23".
- Repro: probes/06-ambiguous-new-gets-wrong-guess.js · Suggested fix: use the guess only if it is a zero-error category, else fit.map; show "Matches" only when gradeOff is empty.

### GRD-07  The Categories table's "Avg (turned in)" counts NHIs as zeros
- Class: WRONG-INFO · Severity: Medium · Where: renderGrades catRows (line 541)
- Claim: Classwork shows 80%; the mean of scores turned in is 99%; the tooltip says NHIs are left out.
- Repro: probes/07-category-avg-label.js · Suggested fix: relabel "Class avg" with a tooltip "mean of students' category grades, NHI = 0".

### GRD-08  Some number forms in CSV gradebooks are not read
- Class: FRAGILE · Severity: Low · Where: app.js parseGradebook
- Claim: a Grade column of bare numbers ("79") reads as no Grade column; ".5" becomes a text code; "1,000" and "C (79%)" are not read.
- Repro: probes/08-parser-number-forms.js · Suggested fix: accept ^-?\d*\.?\d+$ and strip thousands commas.

## Suspicions (unproven)
- Extra credit in a category with nothing else graded is dropped (Focus's behavior unknown).
- `determined` tests single moves only: two swapped assignments could show a false "proved".
- fitCategories.err and gbQuestions.E count an empty Tally grade as 0 error; gradeDiff counts it as 1.

## Cleanup and hardening
- Unify the empty-grade error rule. Kept quarters do not carry `_ec`, so later extra-credit decisions change recomputed Q1 grades. neededOn falls back to live g.cats, not sec._cats. Grammar: "the NHI on X weren't counted".
