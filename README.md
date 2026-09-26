# Tally

IXL Score Grid → one grade per unit in Focus. A single HTML file: no server, no sign-in, nothing leaves the browser.

- **Tally.html** — the app (built). Open it in any browser; drop IXL Score Grid exports (`.xlsx`/`.csv`) and Focus gradebook exports onto it.
- **Scrub.html** — anonymizes exports locally (consistent fake names/IDs) so test data can be shared without student names.

## How it counts

One point per skill whose SmartScore reaches the class goal (60 on-level, 67 accelerated; set from the file name, editable). Best score across imports is kept. Skills can be skipped for a class (tap the skill) or one student (tap the cell); units can be marked *Not assigned* per course. Copy a unit and paste straight into the Focus column — rows come out in Focus order once a roster is pasted.

After a Focus gradebook export is loaded, every mapped unit gets a Focus check badge: ✓, "N up since copy", or "N off", with a corrections list to copy back. Receipts record exactly what was copied and when.

Student-facing screens (Race and Data Lab) never show names and lock behind a hold-to-exit button.

## Source

| file | what |
|---|---|
| `app.html` | markup + CSS |
| `app.js` | all logic |
| `parser.js` | zip/inflate/xlsx/csv readers and the IXL grid + file-name parsers |
| `scrub.src.html` | the anonymizer's markup, CSS and logic |
| `build.py` | assembles `Tally.html` (app.html + parser.js + app.js) and `Scrub.html` (scrub.src.html + parser.js) |
| `tests/` | Playwright end-to-end suites, one file per area, run by `tests/run.js` |
| `fixtures/` | synthetic IXL/Focus exports and rosters, plus one scrubbed real Focus gradebook export (`focus_gradebook_scrubbed.csv`) |

```
python3 build.py      # shipped files (no debug handle)
npm install
npm test              # test build → every suite → shipped build restored
node tests/run.js grid scrub   # just those suites
```

The shipped `Tally.html` carries no `window.__tally`; `python3 build.py --test` keeps it for the suites (`npm test` does this for you). Suites write screenshots and scrub output to a temp folder, never into the repo.

`real-ixl-and-focus` and `real-focus-check` use scrubbed exports of real classes (`fixtures/real_*`, `fixtures/real2_*`), which are not committed; they skip when those files are absent.
