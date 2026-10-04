# Tally

New here (or a new Claude session)? Read **`NOTES.md`** first — Croix's setup, the decisions and their reasons, the weekly routine, open items, and how to push from a session.

IXL Score Grid → one grade per unit in Focus. A single HTML file: no server, no sign-in, no network requests at all (the font is embedded), nothing leaves the browser.

- **Tally.html** — the app (built). Open it in any browser; drop IXL Score Grid exports (`.xlsx`/`.csv`) and Focus gradebook exports onto it. `index.html` is the same file so GitHub Pages serves it at the repo root — on a tablet use the Pages address, not the file from a file manager (Android gives a locally opened file a throwaway storage origin, so nothing would persist).
- **Scrub.html** — anonymizes exports locally (consistent fake names/IDs) so test data can be shared without student names.

## Command center

Tally opens on an **Overview**: one card per class (IXL work at goal with change since the last import, Focus average, missing work, sliding students, Focus check, letter counts), a *needs attention* list that jumps to the class, and charts across classes — IXL work at goal, Focus class average by import, letter grades, missing assignments by import. The grid is **calm by default**: notices fold into one status line, secondary controls sit behind a ⋯ menu, and **Details view** in the header's ⋯ menu brings everything back. The Data Lab draws each class as a **box plot, dot plot, histogram, stem-and-leaf, bar graph, circle graph, or line graph** (class average by import, all classes on one chart). See `COMMAND_CENTER.md`.

## Two ways to get classes

- **Per-period IXL exports** (file name carries the section code, e.g. `1205050-7T1A-…`): each file becomes a class, labelled by period.
- **Course-wide IXL exports** (one file per course with every student in it, no section code): the file is kept as that course's *pool*. Each Focus gradebook you drop then makes a period's class — you pick the period and course once — and the class's grid is carved out of the pool by matching the gradebook's names. Re-importing the pool refreshes every class made from it; a class made before its pool arrives waits for it.

## How it counts

One point per skill whose SmartScore reaches the class goal (60 on-level, 67 accelerated; set from the file name, editable). Best score across imports is kept. Skills can be skipped for the whole course (tap the skill) or one student (tap the cell); units can be marked *Not assigned* per course. Each course has a unit it is **working in** (selector on the class bar; the first import sets it): every unit up to it is a column and counts toward the Race and the Focus check, work in later units is gathered in one **Ahead** column, and the first on-level unit is a review unit that never counts (Settings). Copy a unit and paste straight into the Focus column — rows come out in Focus order once a roster is in place (a Focus gradebook export fills it in automatically; you can also paste one).

After a Focus gradebook export is loaded, every mapped unit gets a Focus check badge: ✓, "N up since copy", or "N off", with a corrections list to copy back. Receipts record exactly what was copied and when.

**Grades** (teacher-only, per class, once a gradebook is loaded) computes the real Focus course grade — weighted categories on points earned over points possible, NHI as zero, NG left out — and proves each assignment's category against the export's Grade column (see `GRADES_SPEC.md`; the fit reproduces the column exactly for the scrubbed real class). It shows class average and letter counts, missing work, students sliding since the previous import, an assignments table with each one's effect on the class average and a category selector, an IXL-vs-assessments scatter with r, and a class-average trend across imports. Tapping a student opens what-ifs — turn in each missing item, retake each assessment at 70/80/90/100, a next-assessment slider with the exact score needed for an A/B/C — and a printable one-student summary for conferences. Weights are editable per prep.

**Students** (header button, teacher only) lists every student of every class — grade this quarter, change since the last import, missing work, IXL at goal, closed-quarter finals — sortable by class, name, lowest grade, most missing or sliding, and searchable from *Find a student*. Tapping a student (here, in a class grid, in Grades, or in Seating) opens **their page**: the grade now and each closed quarter's final; trend charts across the year (grade against the class average with quarter breaks, each category, missing work, IXL skills at goal); every assessment against the class average; every assignment per quarter; IXL by unit with what's below goal or not started; and what would move the grade — led by the **quickest way to the next letter** (F→D, D→C, …): the fewest pieces of work that get there, missing work and IXL skills first (naming the skills closest to goal), retakes only if those can't. The same plan shows in the Students list, on the printed report, and on Show student, where *Show me on the sliders* sets it up. ‹ Prev / Next › walks the class for back-to-back conferences. **Show student** turns the screen toward the student: only their own name and numbers, switches and sliders for turning in missing work, retakes, IXL and the next assessment, the grade following live; Escape and taps do nothing, the teacher holds the exit for 1½ s.

**Quarters** (Overview, or Grades → Quarters): Lake County's 2026–27 end dates (Oct 9, Dec 18, Mar 4, May 28; editable). Focus exports only the current quarter, so closing a quarter keeps each class's gradebook for it inside Tally (`sec.qArchive[n]`: every score, its categories and weights, the final grades) and marks the course's IXL units for it. From then on that quarter raises nothing — no missing counts, sliding, Focus checks, still-owed lines, report lines or digest entries — but stays open to read under Grades → Q1 and on every student's page. A next-quarter export that arrives before the close keeps the old quarter automatically; a closed-quarter column in a later file merges into the record; backups carry the records and never reopen a quarter. See `GRADES_SPEC.md` §7.

**Student reports** (class ⋯ menu, or the Print button on a student card) print one page per student: the Focus grade, what would move it (missing work turned in, IXL finished, what the next assessment needs) and the IXL skills still owed by unit — for the student and the people at home.

**Seating** (class bar) draws your room once — templates, drag, rotate, shared by every class — and generates seating charts: talkers apart, front-seat and near-teacher flags, keep-apart (hard) and seat-near links, and each student's standing (FAST percentile from the Seating Chart backup, blended with their live Focus grade and IXL completion) pulled toward the front. Tap a student to see why they're there, lock them, or swap them — every move reports what it fixes and breaks. Print a teacher copy or a student/sub copy. See `SEATING_SPEC.md`.

Student-facing screens (Race and Data Lab) never show names and lock behind a hold-to-exit button. The Race ranks classes by the share of students who moved up since the league's shared baseline import (average gain breaks ties), so a class that starts behind can win and one student can't swing it; the furthest-along class is tagged. In the Data Lab, an IQR of 0 or 1 switches the 1.5 × IQR outlier rule off with a note.

## Source

| file | what |
|---|---|
| `app.html` | markup + CSS |
| `app.js` | all logic |
| `grades.js` | the Grades model and screens (spliced into app.js's closure by the build) |
| `charts.js` | SVG graph primitives — bars, stacked bars, lines, dot plot, histogram, stem-and-leaf, circle |
| `home.js` | the Overview: class cards, needs-attention list, teacher charts |
| `quarters.js` | grading periods: quarter of each assignment, closing a quarter, the kept records, what goes quiet |
| `students.js` | the Students list, a student's page, Show student |
| `parser.js` | zip/inflate/xlsx/csv readers and the IXL grid + file-name parsers |
| `scrub.src.html` | the anonymizer's markup, CSS and logic |
| `fonts/` | DM Sans (SIL OFL), embedded into both pages at build time |
| `build.py` | assembles `Tally.html` (app.html + parser.js + app.js + grades.js + charts.js + home.js + seating.js + quarters.js + students.js + font) and `Scrub.html` (scrub.src.html + parser.js + font) |
| `tests/` | Playwright end-to-end suites, one file per area, run by `tests/run.js` |
| `fixtures/` | synthetic IXL/Focus exports and rosters; scrubbed exports of one real class (`ixl_7T1A_scrubbed_*.csv`, `focus_gradebook_scrubbed.csv`, `focus_roster_scrubbed.txt`); scrubbed course-wide exports (`course_acc_*`, `course_on_*`) with two synthetic gradebooks of their names (`focus_gradebook_pool_p1/p2.csv`) |

```
python3 build.py      # shipped files (no debug handle)
npm install
npm test              # test build → every suite → shipped build restored
node tests/run.js grid scrub   # just those suites
```

The shipped `Tally.html` carries no `window.__tally`; `python3 build.py --test` writes `Tally.test.html` / `Scrub.test.html` (git-ignored) with it for the suites (`npm test` does this for you). Suites write screenshots and scrub output to a temp folder, never into the repo.

`real-class`, `focus-export` and `focus-check` run against the scrubbed real-class exports. Seven of that roster's names are scrubber artifacts (IXL and Focus were given different fake names), so a 16-of-23 match is the expected result there.
