# CNF findings (auditor's report, condensed by the orchestrator from its final message; probes are in probes/, shared setup probes/_h.js)

### CNF-01  Two students of one name: the second one's conference form shows the first one's numbers
- Class: WRONG-NUMBER · Severity: Critical (rare) · Where: students.js studentBooks (line 56) and the `finals` loop in studentSummary (67) match with norm(), which strips the "(ID ...1234)" mark of the 14 Nov fix
- Claim: the second student's form shows the first one's grade (63% instead of 72%), missing work, tests and report card; the retake line is right (4 missing) while the list shows the other student's 3.
- Repro: probes/01-* · Suggested fix: try the exact name first, as findStudent does.

### CNF-02  FAST results are also read by name, so a student with no PM3 shows a same-name student's PM3
- Class: DATA on the wrong student · Severity: Medium · Where: conference.js testHistory reads the `n:<name>` key after the ID key
- Repro: probes/02-* · Suggested fix: skip `n:` entries when the student has an ID key.

### CNF-03  An August Focus FAST report (only last spring's PM3) loses PM3TestLevel and puts TestedAboveGrade on last year's PM3
- Class: WRONG-NUMBER · Severity: Medium · Where: parser.js parseFastReport; conference.js mergeTests never clears an old "(above grade)"
- Claim: the gain target lands on the wrong grade's table (263 instead of 254), and "(above grade)" stays on the form after later imports.
- Repro: probes/03-*

### CNF-05  With Hide names on, the conference form's FAST box still shows levels, scale scores and percentiles
- Class: PRIVACY · Severity: Medium · Claim: the student page and the dialog's own side panel hide them.
- Repro: probes/05-*

### CNF-06  A missing notebook check is drafted for parents as "not taken yet" and counted as a test or quiz
- Class: WRONG-INFO · Severity: Medium · Claim: 4 of 23 students in the real class.
- Repro: probes/06-*

### CNF-07  The score-report PDF matches near-names with no FLEID check
- Class: DATA on the wrong student · Severity: Medium (rare) · Claim: "SUTTER, HAY" goes to "HAYDEN": a student gets another FLEID's PM2 and loses her own FLEID. The Focus report path has this guard (22 Oct); the PDF path does not.
- Repro: probes/07-*

### CNF-08  fastYearNow picks "this year" from the data kept, not from the calendar
- Class: WRONG-INFO · Severity: Medium · Claim: next August a rising student's 6th-grade PM3 shows as "PM3 this year" with no gain target (a new, concrete effect of the parked rollover).
- Repro: probes/08-*

### CNF-04  DECISION: the gain rule "the threes need a four" is stricter than the state's
- Class: DECISION · Severity: Medium · Claim: Florida also counts staying at Level 3 or 4 with a scale score at least 1 point higher; the student-facing report says "7 more points are needed for a gain" when holding 240 on PM3 already is one. Source: FLDOE learning-gains subcategory chart (Palm Beach County copy) and the FLDOE 2026-27 FAST fact sheet.
- Repro: probes/04-*

## Suspicions (unproven)
- Which window the Focus Percentile column belongs to once this year's PM3 exists. Quickview rows with no time and no start score. flagOn reads "False" as on. Suffix order ("SMITH JR, JOHN" vs "SMITH, JOHN JR") goes unmatched. mergeArchive also matches students with norm().

## Cleanup and hardening
- ifDone (conference.js 43) and ixlLeft (93) are computed and never used.
