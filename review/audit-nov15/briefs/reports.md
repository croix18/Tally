# Auditor RPT: what goes home on paper, and Home   (tag RPT, directory /home/claude/work/audit/reports/)

## Scope (read all of it)
- grades.js 633-1097: nextAssessment, owedWork, andList, letterOfPct, studentReportSection, logReport, the two-sided
  print layout (duplexOn, mk, over, box, items, split, layout, next, run, printBar, printDoc), safeSection,
  printStudentReports, printWeekly, reportGaps, staleAcross, staleExports, returnChecklist, printStudentCard,
  printClasses, openPrintMenu, openReturns, renderReportsPage.
- students.js 83-351: notes, practice display (skillPractice, practiceIdle, minsWord, practiceSection), family
  (familyOf, setFamily, reportsOf, markReportBack, familySection, familyFormHtml), weekOf, printsOf, removePrint,
  the returns screens.
- home.js, all of it: gradeSummary, attentionItems, attentionGroups, fixCount, renderHome, digestFor, digestMarkup.
- tests/weekly-layout.js, report-redesign.js, print-duplex.js, print-hygiene.js, family.js, command-center.js.

## What to prove
- Every figure and sentence on every printed student page (grade, letter, what would move it, the missing list, the
  IXL owed by unit with the skill names, dates, "as of", the quarter) equals your own recount for THAT student. And
  the page belongs to that student: page k is student k under two-sided layout, odd and even padding, every sort
  order, the "only those who owe" filter, same-name students, a class of one, a class of 35.
- Open the print windows and read their documents; do not trust the function's return value alone.
- Text that overflows its box: is anything cut off or pushed to another student's page (long names, long assignment
  titles, 40 owed skills)?
- Returns tracking: printed, returned, still out. Counts; the week a print belongs to (`weekOf` across New Year, a
  daylight-saving change, Sunday versus Monday starts); "Remove a print" (14 Nov) leaves every other print intact and
  its Undo restores exactly; a student who joined after the print; a student who left.
- Home: every "needs attention" count equals the list it opens; the digest's numbers; a dismissed item returns when
  its data changes and stays away when it does not (hashStr collisions?); the ages of stale exports (local day or
  UTC?); gradeSummary's letter counts add up to n; fixCount equals what is listed.

## Edges to attack
A class with no gradebook; a gradebook with no IXL column; a closed quarter (it must raise nothing anywhere); a student
who owes nothing; zero / one / many wording; a report printed while names are hidden; a blocked pop-up; a class whose
gradebook is a quarter behind the others; a student with a modified list; extra credit and excused work on the page.
