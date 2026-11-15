# Auditor CNF: the conference form, FAST and the PDF imports   (tag CNF, directory /home/claude/work/audit/conference/)

The 14 Nov review listed these as NOT covered: FAST / Quickview / PDF imports and conference printing. Cover them.

## Scope (read all of it)
- conference.js, all of it.
- parser.js: parseFastReport. students.js 113-235: parseIxlQuickviewPdf, cleanPractice, practiceOf, importQuickview.
  app.js: pdfTextPages (1643).
- fixtures: fast_items_g7 / g8 (.json, .pdf), ixl_quickview*.json / .pdf, make_fast_items_pdf.py,
  make_ixl_quickview_pdf.py (they generate the PDFs: use them to make edge-case PDFs).
- tests/conference.js, fast-pdf.js, quickview.js, audit-oct25.js. NOTES.md: grep FAST, conference, Quickview, L30.

## What to prove
- The Parent Conference form: the current grade; report-card grades of closed quarters; "a semester is the average of
  its two quarters" (which numbers are averaged, rounded when, and the letter from what?); FAST history; missing work;
  assessments under 70 % (exactly 70? rounding?); whether a retake is allowed. Every figure against your own recount.
- The drafted Strengths and Concerns: list every sentence template in conferenceDraft and try to make each one false
  for the numbers it is printed beside.
- FAST: the achievement-level cut scores by grade, subject and year (fastBucket, fastLevelFloor, fastGainFloor,
  fastTargets, fastBandWidths, fastPos, fastScaleHtml). Verify every constant against the Florida Department of
  Education's published FAST Mathematics (and whatever other subjects are coded) scale-score ranges for the grades in
  the code. Find the official table on the web and cite it. Verify the geometry of the scale graphic: a marker's
  position is proportional to its score, and the bands start and end at the cut scores.
- Learning gains and targets: the rule the code applies against the rule NOTES.md says it applies; where NOTES cites a
  Florida rule, check the citation.
- School years: fastYearNow, nextSchoolYear, prevSchoolYear, syShort: where is the boundary (July? August?), and what
  happens on that day; the PM1 / PM2 / PM3 windows.
- Matching a score to a student: ID first, then name; a near-name carrying another student's ID must be rejected (the
  fix of 22 Oct); two students of one name; a student in two classes; a student not in Tally.
- mergeTests / cleanTests / testKeys: the same report twice; a corrected score; a test renamed.
- PDF reading: feed the fixture PDFs and edge PDFs you generate (a missing column, several pages, names with commas,
  hyphens and suffixes, an absent student, a score of 0, a blank). Every value read must equal the value printed.
- The L30 flag, and anything else carried from the FAST report onto a teacher screen: is it on the right student?
- Printing the form: nothing of another student's; names hidden; the saved text of a form survives a reload.
