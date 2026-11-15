# RPT coverage: what was verified, how, and what was not reached (15 Nov 2026)

Sources were identical to base (diff -rq, sources only). Every probe uses only `__tally` / `__all`, the fixtures and
synthetic data. Shared setup: `probes/h.js` (fixture class 1205050-7T1A: IXL grid, roster, Q1 gradebook; options:
Q2 gradebook, Q1 closed, a mocked clock, a time zone).

## Read in full
- grades.js 633-1097: nextAssessment, owedWork, andList, letterOfPct, studentReportSection (every line), logReport,
  PAGED_CSS / DUPLEX_CSS / PAGER_JS (mk, over, box, items, split, layout, next, run), printBar, printDoc, safeSection,
  printStudentReports, printWeekly, reportGaps, staleAcross, staleExports, returnChecklist, printStudentCard,
  printClasses, openPrintMenu, openReturns, renderReportsPage.
- students.js 83-351: notes, the Quickview parser and cleanPractice, practice display, family (contacts, log,
  reports), weekOf, printsOf, removePrint, openRemovePrint, returnsRows/Html, wireReturns, returnsAllHtml.
- home.js 1-237 all. Helpers read where my code depends on them: cleanReportLog, eff/points/totalFor/activeFor,
  gbUnitFor, ixlColOf, focusPts, pendingCopies, unitClosed, qSec/openSec, liveQuarter, snapBasis/prevGradeSnap,
  classAverage, movement, localDay/localDayOf/ageDays/fmtDate, openPrint.
- Intent: NOTES.md grep hits for weekOf, Remove a print, HOWL, full marks, same name, exportedAt, data-keep, Start
  here, modified list, what moved; the 14 Nov sections ("Review items 3-8", "Remove a print", "Review: item 4 parked",
  "Hostile review"); README "How it counts" line 21.

## Independent oracle: probes/oracle.js (one page session, DOMParser over each report's HTML)
Recounted from the raw state (scores, best, threshold, useBest, per-student skips, statuses), not from Tally's
helpers, for EVERY student's weekly report:
- the name in the header is that student's (page belongs to the student); the quarter in the header;
- the big grade equals computeGrade on the open quarter (the grade formula itself is the GRADES auditor's);
- "Missing work" tile = every NHI in the open quarter less IXL columns whose unit is fully at goal (my own point
  count); the back's missing list has exactly those names; its header "N assignments · P points", P recounted with my
  own pending-copy amounts;
- per open unit: "p / n" header, the owed skills (names and SmartScores in parentheses, 0 when not begun), their
  order (started first by score, then IXL order), the "All n skills at goal" line;
- the IXL tile "at goal / total"; every "N (IXL) skills in Units ..." sentence equals the owed total;
- "Start here": the three started skills within 15 of goal, closest first, with the right distance;
- the Assessments table: every Assessments item (IXL included), score/max and percent, NHI as 0%;
- "Still missing: ..." counts; the work-total row "All N missing assignments turned in → X%" equals the last cell
  of the back's cumulative "Grade after, in this order" (1,278 comparisons in one 100-trial run);
- no "undefined", "NaN", "Infinity", "null%", "[object" anywhere on the page;
- the Reports page's "Owe work N" equals the number of reports that show owed work or owed IXL.
Runs: fixture as is + 300 random trials (seed 11): 6,923 reports, 14,448 unit blocks, 206,011 skill rows, 13,647
owed assignments; Q2 gradebook in, Q1 open: 100 trials, 2,323 reports; Q1 closed then Q2 in: 150 trials, 3,473
reports. Randomized: threshold 60/67/70/80/100, useBest on/off, scores clustered at threshold, threshold-1, 15/16
below goal, 0 and null, random best-score history, per-student skips (modified lists), every gradebook cell
missing/excused/score (full marks 30%). Result: all agree, except RPT-02 (5 reports).

## Print windows (probes/layout.js; the real pop-up, after the pager's layout; PDF read back)
- Modes: normal fixture; "heavy" (40 extra assignments with long titles, all missing for half the class, low scores);
  "start" (Start here present); "many" (150 extra owed skills); "long" (a 100-character name).
- Checked: every report and the checklist start on a front (odd page) two-sided; no page box overflows
  (`scrollHeight`) and no row's bottom falls past the printable box; every owed skill and missing row is in the
  printed document; the PDF has exactly as many pages as laid-out boxes; the page sequence names the right student.
  All held, except the repeated Start here (RPT-06). A 60-letter unbroken name overflows its line (not reported:
  no real name is like that).
- Suites in my scope run green on my copy: family (25), command-center (41), print-hygiene (17), weekly-layout (23),
  report-redesign (23), print-duplex (24).

## Dates and weeks
- weekOf (probes/weekof-fuzz.js): every day 2026-2029 (1,461 days) in New York, Los Angeles, Kiritimati (+14),
  Pago Pago (-11) and London, as a day and as a late-UTC stamp: always the school week's Monday, weekend → next Monday,
  across New Year and both DST changes. Correct.
- HOWL days read on a mocked clock: right weekday arithmetic; the break-week consequence is RPT-09.
- staleExports ages: local days, "yesterday" at 1, exportedAt before importedAt (and Home's inconsistency, RPT-03).

## Home
- gradeSummary on the fixture (Q1), after closing Q1 (waiting, zeros, nothing raised for Q1), and with the Q2 gradebook:
  letter counts sum to the graded students (23/23), missing = recount of NHI statuses (22, 52), students with
  missing work = recount (9, 18); fixCount = warning groups + quarter due (+ storage) = what renderHome lists.
- Closing Q1: attention drops the Focus mismatch and quarter-due lines, gradeSummary waits; Reports page says "No
  Quarter 2 grades"; report units drop closed units (oracle "closed" runs).
- Dismissed Quickview reminder (probes/dismiss-check.js): gone after Dismiss; stays gone for the same Quickview;
  returns for a newer Quickview; changes wording when the idle set changes. hashStr is 32-bit djb2 over sorted names:
  a collision would need two different idle sets in the same class and Quickview date; not a practical risk.
- classAverage and the snapshot average both use rounded grades, so "±N since" has no rounding drift.
- Digest: read line by line (IXL movement via movement(), Focus via two same-quarter snapshots); no numeric probe.

## Returns / Remove a print / family
- Remove a print with a mid-week reprint: RPT-01. Undo restores through cleanReportLog, which keeps every field
  logReport writes (date, back, cleared, q, gb, gbAt, ix, grade, missing, ixl): exact for entries Tally wrote.
- A student who left: still counted in Remove a print, not in "still out" (by design). A student who joined: no row.

## Not covered
- The digest's numbers on synthetic history (read only), the Home charts (charts.js belongs to another auditor),
  the FAST report (printFast) and the IXL still-owed slips (printStillOwed), the Quickview PDF parser beyond reading,
  quickestPath's own plan (another auditor; I only checked the totals against the back), retakeStatus's rule,
  one-sided printing in a real PDF, a manual gbUnitMap column (suspicion), an actually blocked pop-up.
