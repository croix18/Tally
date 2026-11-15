# WIF coverage: what-ifs, plans and retakes (15 Nov 2026, copy at 8f973ed)

## Read, every line
students.js 1-82 (findStudent … studentSummary), 352-836 (retakeStatus … closeShow, STU_CSS); grades.js gradingFor,
catGuess/catOf/catIn, isExtraCredit, computeGrade, roundPct, neededOn, withNext, openStudentCard, nextAssessment,
owedWork, the head of studentReportSection (the copy baseline); app.js uniqueNames, norm, activeFor, eff, points,
population; quarters.js unitClosed. Intent: GRADES_SPEC §1, 4.2, 4.2b, 7, 8, 8.1; README "How it counts" and Retakes;
NOTES (quickest way 1 and 7 Oct, what-if audit 19 Oct, retakes 21 and 24 Oct, "One baseline" / "One missing count"
3 Nov, extra credit and text grades 14 Nov, Hostile review 14 Nov); AUDIT_PLAN "For Croix".

## The oracle (probes/fuzz.js) and what agreed
My own grade function written from GRADES_SPEC §1 (+ the 14 Nov extra-credit rule), my own brute force for the next
assessment and for the quickest way, my own retake rule (24 Oct), compared with Tally inside one page session.
Data: the scrubbed real class (23 students, 16 linked to IXL), each trial one student's whole row randomized (scores on
the half-point grid, NHI, excused, bonus scores over the max, 0-point extra-credit columns scored or NHI, "struggling",
"middle", "strong" and "near-perfect" profiles), in two states: Quarter 1 open (Q1 gradebook) and Quarter 2 open with
Quarter 1 closed (Units 1 and 2 ticked). Runs: seeds 1-5, 9, 11, 13 at 3,000 trials each, both states (about 24,000
students). In every run, zero disagreements on:
- computeGrade (pct to 1e-9 and the rounded grade), including extra credit and bonus scores;
- every what-if cell read back from whatIfMarkup's own markup: each missing row, "All N turned in", every retake cell
  (computed from the score shown), every "If IXL were finished" row;
- nextAssessment / neededOn against every half point from 0 to max, at nextSize and at a random 1-60: each letter's
  minimum, the "can't" letters, the "keeps the …" score; withNext and gradeWith at a random slider point;
- quickestPath: phase 1 brute-forced over every subset of missing work × every IXL point count per column (true minimum
  number of pieces); phase 2 (all missing work and IXL, then the fewest retakes by subset search, only with an IXL link):
  same step count, reached/not reached, the plan's `over` really reaching the letter, `result` = applying it, the last
  line's "→ N%" = the heading, the stated step count = the steps listed, the last retake at the least half point; the
  IXL skills it names are the student's own below goal, closest first; the report's `fromCopies` variant (target from
  the copied grade, no copy line, minimal);
- retakeStatus: eligible or not, the blocking units and their counts, the missing count.
Plus: probes/showfuzz.js drove Show student's own switches and sliders for 80 random students (random picks, read
`#shIfV`): every grade matched the oracle; "Show me on the sliders" from a fresh screen matched the plan in 70 of 70.
probes/sweep.js rendered the student page, the Students list and Show student for 70 edge students per state (all
excused, no assessments, no IXL columns, all missing, perfect, all zeros, random), plus slider ends (0, 500, empty):
no NaN, undefined, Infinity, "null" or page error in text, titles or aria labels.
Show student isolation: with Show open (from Students and from Grades), the whole body (scripts and styles removed) and
the title hold no other student's surname; Escape and Tab trapping read correct in code.

## Edges attacked (result)
At an A (top card, "You have an A"): right. F far from D: right ("needs more than…"). Exactly on a cut-off (half-up with
slack): right, brute-forced. Extra credit: grade right; NHI on it → WIF-03. Excused: right; an excused IXL column →
WIF-07. One-item category (Participation): right. Retake below current: sliders start at the current score, dashes in
the table: right. Missing item with max 0 → WIF-03. No IXL column: retake = nothing missing (linked students only, as
decided). Focus behind Tally (copy step): right, and the report's from-copies plan right. Focus ahead of Tally → WIF-08.
No IXL link: plan skips IXL and retakes and says why: right (Students list wording: C2). Modified list → WIF-11.
Two students of one name → WIF-01. Closed quarter: what-ifs only for the open one: right; IXL tile → WIF-10.
nextSize with no assessment: falls back to 20 (Suspicions). Retake percent columns → WIF-09. Unit with more skills than
its column → WIF-02.

## Not covered
- The printed report's and the conference form's own wording beyond the retake count (they call the same retakeStatus
  and nextAssessment, so the numbers are covered; their layout and sentences are another auditor's).
- ixlTrend across several IXL imports (the fixture has one IXL export): the trend lines' history and `itD` are read in
  code only.
- Hide names on Show student (parked by Croix).
- Two open IXL columns for one unit (Suspicions).
