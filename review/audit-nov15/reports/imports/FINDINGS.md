# IMP findings (auditor's report, condensed by the orchestrator; probes are in probes/)

### IMP-01  Two students sharing an IXL name in one course export, in different classes: the roster fixer cannot link the second
- Class: WRONG-NUMBER · Severity: High · Where: app.js openFixer (line 2322) stores the pool's key ("JORDAN LEE#1"); buildRows (396) checks it against the class's own key ("#0")
- Claim: the student stays "not found in IXL" and out of the count, even after a reload; no workaround in the UI.
- Repro: probes/01-pool-twin-alias.js · Suggested fix: materialize keeps each carved column's pool key and the alias check accepts that key too.

### IMP-06  The weekly "any order" drop depends on file order
- Class: WRONG-NUMBER · Severity: High · Where: importFiles / materialize
- Claim: a student moves between classes and Focus spells the name differently from IXL (Alex / Alexander). The course export carves every class from last week's rosters and each gradebook re-carves only its own class: with p1 before p2 the student is "not found in IXL" in the new class until the next export.
- Repro: probes/06-carve-order.js · Suggested fix: after the gradebook loop, re-carve every pool class of each course touched.

### IMP-02  An IXL export with no student names shifts scores after a skill that is listed twice
- Class: WRONG-NUMBER · Severity: Medium · Where: importFiles (app.js about 554) rebuilds the scores without merging the duplicate skill
- Claim: every later skill shows the next skill's scores (S5 read 40 instead of 90). The real accelerated export lists one skill twice.
- Repro: probes/02-placeholder-dup-shift.js

### IMP-03  A file named "Last-School-Year" silently replaces this year's course data
- Class: DATA-LOSS · Severity: Medium · Claim: nothing reads that part of the file name.
- Repro: probes/03-last-school-year.js

### IMP-05  The HTML-table .xls reader flattens line breaks inside cells
- Class: WRONG-INFO · Severity: Medium · Where: fileToRows
- Claim: assignment names pick up "Assigned ... Due" and every due date is lost; the same file as .csv reads right. Whether Focus's .xls export has such headers is unverified.
- Repro: probes/05-html-xls-multiline-header.js

### IMP-04  A class made from its own export plus a course export of the same date: the `pool` flag depends on drop order
- Class: WRONG-INFO · Severity: Low · Claim: one order's import card says "no class uses it yet: import a Focus gradebook" though the class has its gradebook.
- Repro: probes/04-same-day-class-and-course.js

## Cleanup and hardening
- asScore accepts 101-999 and negatives. Pasted roster header or title lines ("Student\tStudent ID", "Last, First", "Period 3") become fake students. xlsxToRows reads the first sheet even if hidden. Names with o-slash, sharp s, ae, l-stroke do not match their plain spelling. A typed alias starting with an accented letter is not recognized. A roster pasted with bare CR line breaks reads as one line. A semicolon-separated file makes an empty class and still reports "Imported 1 file."
