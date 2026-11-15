# Auditor CON: one number, every screen   (tag CON, directory /home/claude/work/audit/consistency/)

The engine auditors go deep into one engine each. You go wide: no two screens may tell different stories. This is the
audit for "the information absolutely correct at all times".

## Scope
Every screen and output that states a student's or a class's numbers: the class grid and its header; Grades (class
overview, the assignments table, the scatter, the trend); the Students list; the student page (tiles, charts, tables,
what would move the grade); Show student; Home (needs attention, the digest); the Reports page and the printed weekly
/ student report; the conference form; the Still owed print; the Guide; the Copy text and receipts; the Focus check;
the Board (Race, Data Lab); the finder; and every toast or notice that states a count.

## Task
Build five scenario states:
- A: the scrubbed class as imported, Quarter 1 (the probe template).
- B: the same after the Quarter 2 gradebook (`fixtures/focus_gradebook_scrubbed_q2.csv`).
- C: five synthetic classes across both courses (see tests/quarter-pie.js for the cloning trick) with course skips, a
  modified list, a withdrawn student, a new student, two students of one name, excused / NHI / extra-credit / unread
  codes, and a class of four.
- D: Quarter 1 closed and kept, Quarter 2 open, one class an export behind.
- E: degenerate: a class with a gradebook and no IXL, one with IXL and no gradebook, an empty unit, a student with
  nothing graded.

For each scenario, drive the real UI (the rail, the tabs, the dialogs; open the print windows and read their
documents) and collect every quantity per student and per class into one table: grade %, letter, missing count, IXL
at goal (per unit, for the quarter, overall), points per unit, class average, letter counts, the number of counted
students, retake eligibility and its reason, the quickest-way step count, the "as of" and import dates, the quarter's
name. Then assert that all surfaces agree with each other AND with your own recount from raw state. Every
disagreement is a finding: name both surfaces and both values.

Also assert the arithmetic of what is said: letter counts add up to n; weights shown add up to 100 where they should;
a count in a headline equals the length of the list it introduces ("3 students" over 3 rows); singular and plural;
the same quantity rounded the same way everywhere (89.5 must not be 89 % on one screen and 90 % on another); a
percent and the fraction beside it agree.

Keep a table in COVERAGE.md of quantity x surface, marking what was compared. That table is itself a deliverable.
