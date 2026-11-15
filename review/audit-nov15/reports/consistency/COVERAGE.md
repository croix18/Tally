# CON coverage: one number, every screen (15 Nov 2026, copy at 8f973ed)

## Method

- `probes/h.js`: opens the test build (America/New_York), replaces `window.open` so every print document is captured,
  and provides `scrapeAll()`: one in-page pass per scenario that, for every class and every gradebook student,
  (1) recounts from raw state with code written from GRADES_SPEC §1 / README "How it counts" (grade = Σw·earned/possible
  over categories with points, NHI = 0, NG/blank/unread out, 0-point columns extra credit, half-up rounding; missing =
  NHI cells; IXL = own skills at goal on the open units, all units when none is open; class average = mean of the
  rounded grades; letter counts), and (2) drives the real screens (Overview card, Grades cards/category table/
  assignments table/students table, Students list for the class, each student's page via `openProfile`, Show student,
  the conference panel and its printed form, the weekly report section of every student) and reads what they say.
- `probes/cmp.js`: compares every surface with the recount and with each other; prints each disagreement.
- Scenarios run through the scrape (counts are students compared on every surface):
  - **A** scrubbed class as imported, Q1 gradebook (23 students, 16 matched to IXL).
  - **B** A + the Q2 gradebook (Q1 kept, not closed). **B2** B + a later Q2 export with one student withdrawn and one new.
  - **D1** B with Quarter 1 closed through the Quarters dialog (its pre-ticked units).
  - **C** A's gradebook re-exported with EX, an undecided "Late", an extra NHI, a student with every cell NG, a 0-point
    extra-credit column; plus clones: a class whose roster has four students, an on-level copy, a class with IXL and no
    gradebook (four classes, 69 gradebook students).
  - **E** A + a class made from a gradebook alone (no IXL), and a unit with every skill skipped.
  - **twin** A's gradebook with a second "SUTTER, HAYDEN SKYLER" (another student's row and ID).
  - **9:30 pm** A imported at 21:30 Eastern (02:30Z next day) with `page.clock`: every date label checked.
- Two-import states (Nov 8 / Nov 15) built as tests/grades.js does (re-dating the first gradebook) for the
  since-last-import, Sliding, digest and trend checks (probe 06).
- Every finding probe ran twice on my copy (exit 1 both times). I did not run them against
  `/home/claude/work/audit/base`: tests/lib.js rewrites the fixtures' mtimes in whatever repo it loads, which is a write
  under base. `TALLY_REPO=/path node probes/NN-*.js` works on any built copy (h.js reads `TALLY_REPO`).

## What agreed (verified correct)

With the recount, on every student of every scenario above (about 200 student-surface sets):
grade %, letter, missing (NHI) count, IXL done/possible and %, across Grades table, Students list, student page tile,
quarter-book heading (except CON-01, CON-10), Show student, conference panel, printed conference form, weekly report;
class average, letter counts (add up to the graded n), missing total and "N students with something missing", the
Assignments table's missing column summing to the card's total, on Grades and the Overview card; quickest-way step
counts (Students list "N missing / N IXL skills" = page "N steps for the student" = Show student); retake eligibility
and its reason (list chip = page tile = report = conference, except a student with nothing graded); the Q1 finals
(tile = Students list = conference report card, Q1 kept and closed); the Data Lab course-grade box plot (n = 23,
mean 73.9 % = Overview 74 %, quartiles, IQR, range arithmetic); the Race's "56 % complete" = the Overview card;
report "This quarter's IXL finished (N skills…)" = possible − done; conference "IXL in Focus x of y" = the Focus IXL
cells; Reports page "Everyone N" = gradebook students; import summary counts ("13 assignments, 23 students", "22 of
23 placed"); every date label at 9:30 pm Eastern (gradebook "of Nov 15", report "November 15, 2026 · Focus as of Nov
15", history dated Nov 15, Quarter 1 by the gradebook); the Grades "Tally's grade differs … for N of M" count = gradeOff.

## Quantity × surface

✓ = compared and agrees; ✗ = disagreement (finding); · = not shown on that surface; – = not compared.

| quantity | Overview card | Grades | Students list | Student page | Show student | Weekly report | Conference panel / form | Board (Race/Lab) | Digest | Still owed | Copy / Focus check |
|---|---|---|---|---|---|---|---|---|---|---|---|
| grade % and letter | · | ✓ | ✓ | ✓ tile; ✗ book (CON-01 twin, CON-10 closed Q) | ✓; ✗ twin (CON-01) | ✓ | ✓; ✗ twin (CON-01); "null%" (CON-05) | ✓ Lab mean | ✗ after a category move (CON-06) | · | · |
| class average | ✓ | ✓; ✗ closed Q (CON-10) | · | ✗ IXL class avg basis (CON-02) | · | · | · | ✓ | ✗ (CON-06) | · | · |
| letter counts (sum = n) | ✓ | ✓ | · | · | · | · | · | – | · | · | · |
| missing count | ✓ (all NHI) | ✓ (all NHI) | ✗ vs retake/report (CON-03) | ✗ tile vs retake tile (CON-03) | – | ✗ (CON-03) | ✗ (CON-03) | – | – | · | · |
| students with missing | ✓ | ✓ | · | · | · | · | · | · | · | · | · |
| IXL at goal (open units) | ✗ basis (CON-09) | ✓ | ✓ | ✓ x of y; ✗ class avg (CON-02) | · | ✓ | ✓ | – pies (quarter-pie.js covers) | – | – | · |
| points per unit | · | · | · | – | · | – | · | · | · | – | ✗ copy vs plan cap (CON-07) |
| since last import / sliding | – | ✗ after category move (CON-06) | ✗ (CON-06) | – | · | · | · | · | ✗ (CON-06) | · | · |
| retake eligible / reason | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · |
| quickest steps | · | · | ✓ | ✓ | ✓ | by design differs (copies counted in) | · | · | · | · | ✗ grade after copy (CON-07) |
| closed-quarter final | ✓ mean | ✗ recount (CON-10) | ✓ | ✓ tile; ✗ book (CON-10) | · | · | ✓ report card | · | · | · | · |
| "as of" / import dates | ✓ | ✓ | · | ✓ | ✓ | ✓ | – | ✓ | – | – | – |
| quarter name | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | · | · |
| counts in headlines | ✓ | ✓ | ✓ "23 students" = 23 rows | ✓ "N of M" | · | · | · | ✓ n = | – | read ("16 students (7 not matched)") | – |
| reason under a dash | ✗ (CON-08) | · | · | ✓ | · | · | ✗ (CON-05) | · | · | · | · |

## Not covered (or only lightly)

- The Board file / Board save on another browser (quarter-pie.js recounts its IXL pies; I did not compare its course
  grades `boardGrades` with the Grades screen).
- The digest beyond CON-06 (IXL movers, units everyone finished), the Home trend charts' points.
- The Guide (checked only that its goal line reads the live thresholds), the finder, toasts other than the import summary.
- Hide names (parked), the printed Still owed beyond its headline, slips and the initials list.
- The class grid's own cells against the recount (the Copy column was compared, the grid DOM was not scraped).
- Seating's standing (uses grade and IXL), FAST report, Quickview practice lines.
- The Students list for "All classes" with a mixed-quarter state (backlog item 11, known).
- Two real tabs, phone layout, printing to PDF (pagination).
