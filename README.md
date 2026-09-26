# Tally

IXL Score Grid → one grade per unit in Focus. A single HTML file: no server, no sign-in, no network requests at all (the font is embedded), nothing leaves the browser.

- **Tally.html** — the app (built). Open it in any browser; drop IXL Score Grid exports (`.xlsx`/`.csv`) and Focus gradebook exports onto it. `index.html` is the same file so GitHub Pages serves it at the repo root — on a tablet use the Pages address, not the file from a file manager (Android gives a locally opened file a throwaway storage origin, so nothing would persist).
- **Scrub.html** — anonymizes exports locally (consistent fake names/IDs) so test data can be shared without student names.

## Two ways to get classes

- **Per-period IXL exports** (file name carries the section code, e.g. `1205050-7T1A-…`): each file becomes a class, labelled by period.
- **Course-wide IXL exports** (one file per course with every student in it, no section code): the file is kept as that course's *pool*. Each Focus gradebook you drop then makes a period's class — you pick the period and course once — and the class's grid is carved out of the pool by matching the gradebook's names. Re-importing the pool refreshes every class made from it; a class made before its pool arrives waits for it.

## How it counts

One point per skill whose SmartScore reaches the class goal (60 on-level, 67 accelerated; set from the file name, editable). Best score across imports is kept. Skills can be skipped for a class (tap the skill) or one student (tap the cell); units can be marked *Not assigned* per course. Copy a unit and paste straight into the Focus column — rows come out in Focus order once a roster is in place (a Focus gradebook export fills it in automatically; you can also paste one).

After a Focus gradebook export is loaded, every mapped unit gets a Focus check badge: ✓, "N up since copy", or "N off", with a corrections list to copy back. Receipts record exactly what was copied and when.

**Grades** (teacher-only, per class, once a gradebook is loaded) computes the real Focus course grade — weighted categories on points earned over points possible, NHI as zero, NG left out — and proves each assignment's category against the export's Grade column (see `GRADES_SPEC.md`; the fit reproduces the column exactly for the scrubbed real class). It shows class average and letter counts, missing work, students sliding since the previous import, an assignments table with each one's effect on the class average and a category selector, an IXL-vs-assessments scatter with r, and a class-average trend across imports. Tapping a student opens what-ifs — turn in each missing item, retake each assessment at 70/80/90/100, a next-assessment slider with the exact score needed for an A/B/C — and a printable one-student summary for conferences. Weights are editable per prep.

Student-facing screens (Race and Data Lab) never show names and lock behind a hold-to-exit button. The Race ranks classes by the share of students who moved up since the league's shared baseline import (average gain breaks ties), so a class that starts behind can win and one student can't swing it; the furthest-along class is tagged. In the Data Lab, an IQR of 0 or 1 switches the 1.5 × IQR outlier rule off with a note.

## Source

| file | what |
|---|---|
| `app.html` | markup + CSS |
| `app.js` | all logic |
| `grades.js` | the Grades model and screens (spliced into app.js's closure by the build) |
| `parser.js` | zip/inflate/xlsx/csv readers and the IXL grid + file-name parsers |
| `scrub.src.html` | the anonymizer's markup, CSS and logic |
| `fonts/` | DM Sans (SIL OFL), embedded into both pages at build time |
| `build.py` | assembles `Tally.html` (app.html + parser.js + app.js + grades.js + font) and `Scrub.html` (scrub.src.html + parser.js + font) |
| `tests/` | Playwright end-to-end suites, one file per area, run by `tests/run.js` |
| `fixtures/` | synthetic IXL/Focus exports and rosters; scrubbed exports of one real class (`ixl_7T1A_scrubbed_*.csv`, `focus_gradebook_scrubbed.csv`, `focus_roster_scrubbed.txt`); scrubbed course-wide exports (`course_acc_*`, `course_on_*`) with two synthetic gradebooks of their names (`focus_gradebook_pool_p1/p2.csv`) |

```
python3 build.py      # shipped files (no debug handle)
npm install
npm test              # test build → every suite → shipped build restored
node tests/run.js grid scrub   # just those suites
```

The shipped `Tally.html` carries no `window.__tally`; `python3 build.py --test` keeps it for the suites (`npm test` does this for you). Suites write screenshots and scrub output to a temp folder, never into the repo.

`real-class`, `focus-export` and `focus-check` run against the scrubbed real-class exports. Seven of that roster's names are scrubber artifacts (IXL and Focus were given different fake names), so a 16-of-23 match is the expected result there.
