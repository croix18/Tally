# Tally

IXL Score Grid → one grade per unit in Focus. A single HTML file: no server, no sign-in, no network requests at all (the font is embedded), nothing leaves the browser.

- **Tally.html** — the app (built). Open it in any browser; drop IXL Score Grid exports (`.xlsx`/`.csv`) and Focus gradebook exports onto it.
- **Scrub.html** — anonymizes exports locally (consistent fake names/IDs) so test data can be shared without student names.

## How it counts

One point per skill whose SmartScore reaches the class goal (60 on-level, 67 accelerated; set from the file name, editable). Best score across imports is kept. Skills can be skipped for a class (tap the skill) or one student (tap the cell); units can be marked *Not assigned* per course. Copy a unit and paste straight into the Focus column — rows come out in Focus order once a roster is pasted.

After a Focus gradebook export is loaded (kept only while the tab is open — scores never touch localStorage), every mapped unit gets a Focus check badge: ✓, "N up since copy", or "N off", with a corrections list to copy back. Receipts record exactly what was copied and when.

Student-facing screens (Race and Data Lab) never show names and lock behind a hold-to-exit button. The Race ranks classes by the share of students who moved up since the league's shared baseline import (average gain breaks ties), so a class that starts behind can win and one student can't swing it; the furthest-along class is tagged. In the Data Lab, an IQR of 0 or 1 switches the 1.5 × IQR outlier rule off with a note.

## Source

| file | what |
|---|---|
| `app.html` | markup + CSS |
| `app.js` | all logic |
| `parser.js` | zip/inflate/xlsx/csv readers and the IXL grid + file-name parsers |
| `scrub.src.html` | the anonymizer's markup, CSS and logic |
| `fonts/` | DM Sans (SIL OFL), embedded into both pages at build time |
| `build.py` | assembles `Tally.html` (app.html + parser.js + app.js + font) and `Scrub.html` (scrub.src.html + parser.js + font) |
| `tests/` | Playwright end-to-end suites, one file per area, run by `tests/run.js` |
| `fixtures/` | synthetic IXL/Focus exports and rosters, plus scrubbed exports of one real class: `ixl_7T1A_scrubbed_*.csv`, `focus_gradebook_scrubbed.csv`, `focus_roster_scrubbed.txt` |

```
python3 build.py      # shipped files (no debug handle)
npm install
npm test              # test build → every suite → shipped build restored
node tests/run.js grid scrub   # just those suites
```

The shipped `Tally.html` carries no `window.__tally`; `python3 build.py --test` keeps it for the suites (`npm test` does this for you). Suites write screenshots and scrub output to a temp folder, never into the repo.

`real-class`, `focus-export` and `focus-check` run against the scrubbed real-class exports. Seven of that roster's names are scrubber artifacts (IXL and Focus were given different fake names), so a 16-of-23 match is the expected result there.
