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
| `build.py` | assembles `Tally.html` from the three above |
| `scrub.html` | the anonymizer (standalone) |
| `test3.js … test12.js` | Playwright end-to-end tests against `Tally.html` |
| `fixtures/` | synthetic IXL/Focus exports and rosters |

```
python3 build.py
npm install
for t in test3 test4 test5 test6 test7 test8 test9 test10 test11 test12; do node $t.js; done
```

Tests 10 and 11 use scrubbed exports of real classes (`fixtures/real2_*`), which are not committed.
