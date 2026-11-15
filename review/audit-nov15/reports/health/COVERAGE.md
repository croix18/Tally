# HLT coverage: what was verified, how, and what was not reached (15 Nov 2026)

All probes: `TALLY_REPO=<repo> node probes/<file>.js` (they share `probes/_load.js`; copy the whole `probes/` folder).
Findings 02-06 rerun on `/home/claude/work/audit/base`: each fails there as on my copy (exit 1).

## 1. Lint
- eslint 9.x, installed in this directory. Input: `lint/concat.py` concatenates parser.js (module line stripped) and
  app.js with all seven splices, exactly as build.py does, and writes `lint/map.json` (combined line -> source file:line).
  Benchmarks JSON and image data URIs replaced by stubs. Config `lint/eslint.config.js` (the 21 required rules).
- Run twice: with the hooks (`combined.js`, 86 hits) and without the `__tally`/`__all` lines (`nohook.js`, which is
  what finds the 7 dead top-level functions, since the hooks reference every name). Every hit triaged in
  FINDINGS.md "Cleanup" (CLEANUP-1..6). No lint hit was a live bug.
- Dead-code proof: `for n in printStudentCard openReturns openStudentReports shuffleArr skillPractice assignedIdx sectionWarn; do grep -o -w $n repo/{parser,grades,charts,home,seating,quarters,students,conference}.js repo/app.html; sed '3178,3179d' repo/app.js | grep -o -w $n; grep -o -w $n repo/tests/*.js; done`
  -> only the definitions (and test calls for openReturns, openStudentReports, skillPractice, sectionWarn).

## 2. Hazards swept (grep via tools/ctx.js over all nine sources)
- `.sort()` without comparator: 13 sites, all on ISO date strings or quarter keys '1'-'4': safe.
- `|| default` on numeric fields: ~25 sites read. Safe: Lab `a.max || Math.max(...)` (max 0 = extra credit is then
  shown as "score", app.js 978); quartile `x.max || 1`; chart option defaults; `str(v, n || 200)`. Unsafe: renderGrades
  `(n || 1)` -> HLT-05.
- `parseInt`/`parseFloat`: clampThr (goal box is `type=number`; "67.5" -> 67), seating template sizes: no wrong number reachable.
- `new Date(string)`: every site parses ISO or `YYYY-MM-DD + 'T12:00:00'` (local noon). Weak validator okDay -> Suspicions.
- `JSON.parse`: all on files are in try/catch; load() and the storage handler are inside the boot / handler try.
- Unit regexes: "Unit 1" vs "Unit 10" checked in every unit regex (`\d+` captures, `(?![\d.])`, `\b`): safe.
- Division to screen: `avg - null` -> HLT-04; `x / max` guarded everywhere else I read (avgPct, ixlFor, completion).
- Negative zero: signedPts prints "±0" for -0 (fine); toFixed(1) prints "-0.0" for tiny negatives (folded into HLT-03's fix).

## 3. One quantity, several implementations (checked pairs)
| Quantity | Implementations | Can they disagree? |
|---|---|---|
| Course grade % | computeGrade (grades.js 45), withNext (150), neededOn's inner `grade` (140) | No: oracle fuzz below, 2,400 cases, 0 mismatches |
| Letter | letterOf (grades.js 7), letterOfPct (648), gradeFill (charts.js 19) | letterOf = letterOfPct on all inputs; gradeFill rounds without slack (HLT-06, no boundary case exists) |
| Rounding of a grade | roundPct (grades.js 67), confRound (conference.js 9), pct1 (444), bare Math.round | roundPct = confRound; pct1/Math.round differ at 57.5 etc. -> HLT-06 |
| Class average | classAverage (grades.js 251, mean of rounded), Lab `grade:course` (app.js 984, mean of rounded via gradeAll), Overview (home.js 10 = classAverage) | Same value; shown as integer (Overview, Grades) vs one decimal (Lab, decided in NOTES "Class averages in the Data Lab"); the one-decimal form rounds ties down -> HLT-03 |
| Previous class average | grades.js 521, 551; home.js 10, 118, 185 | Yes -> HLT-05 |
| Kept-quarter final | `qArchive[n].final` (studentSummary, gradeSummary) vs computeGrade(qSec(n)) (Grades tab, profile heading) | Yes -> HLT-02 |
| IXL at goal | points (app.js 478), snapshot (728), summaries (773), labSeries ixl:quarter (972), grid cell (2252/2256), ixlFor (students.js 37) | Same predicate `v != null && v >= t` on activeFor/eff everywhere. Basis differs by design: Overview/Race = all assigned units; Students/Lab quarter/report = open-quarter units (NOTES "The quarter's IXL on the board") |
| Missing count | a.missing (parse/cleanGB/applyCodes), owedWork, gradeSummary, studentSummary, gradeSnapshot | All count `status === 'missing'`; a.missing is recomputed in applyCodes and on load: consistent |
| Sliding | grades.js 531, home.js 13, students.js 71 | Differ only for a student with a null grade (Suspicions) |
| Local day / today | localDayOf, localDay, todayISO, inline strings | Same except localDay(null) (CLEANUP-4) |

## 4. Rounding and formatting table
| Helper | Rule | At .5 | Where used (count) |
|---|---|---|---|
| roundPct (grades.js 67) | Math.round(p + 1e-9) | half up, float-safe | course grade everywhere (16 calls) |
| confRound (conference.js 9) | same as roundPct | half up | conference form (18) |
| pct1 (grades.js 444) | Math.round(v) + '%' | half up on the binary value: 57.4999… -> 57 | Grades class/category/assignment averages, profile (18) |
| bare Math.round(x.pct) | same as pct1 | as pct1 | report category bars, profile, conference category line, IXL % |
| fmtV (charts.js 27) | Math.round(v*10)/10 | half up (exact on every s/n tested) | chart value labels (12) |
| fmtN (app.js 988) | integer as is, else toFixed(1) | toFixed: ties go by binary, ~half down | Lab stats, quartiles, IQR, outliers, Students and Grades text (61 calls) |
| fmtAvg (app.js 1069) | toFixed(1) | as fmtN -> HLT-03 | Lab class average, avg chart |
| toFixed(2) r | pearson r | n/a | Grades scatter caption |
- Verified exhaustively: means s/n for n = 2..35, sums 0..100n: Math.round(mean) never differs from roundPct
  (so the Overview/Grades integer average is safe); fmtV vs toFixed(1) differ in 400 cases (n <= 35), all exact ties.
- Every half-point score e/p, p = 1..1000: no letter boundary (59.5/69.5/79.5/89.5) lands below its tie in floating
  point, so no letter can be wrong from rounding alone.

## 5. Performance (probes/_perf.js, probes/_perf2.js; synthetic 6 x 30 x 300 skills, 12 IXL days, 60 columns)
- One render: Overview 72-93 ms, class grid 30 ms, Grades 76-105 ms, Reports 30 ms, Seating 29 ms, **Students 3.4-3.8 s** (HLT-01).
- Engines on the same load: gradeAll x 6 classes 7 ms, classAverage x 6 8 ms, population x 6 2 ms, unitsOf 21 us
  per call, ixlFor 0.2 ms per student. Nothing else super-linear found. Profile of the Students render: quickestPath
  3,130 ms, computeGrade 2,801, catOf 1,711, catGuess 871, gradingFor 598, unitsOf 292, retakeStatus 260.
- Not timed: the Data Lab (opened as a modal, not a view mode), printing, the conference form.

## 6. Independent oracle (probes/_fuzz-grade.js)
- My own grade formula from GRADES_SPEC / README ("weighted categories on points earned over points possible, NHI as
  zero, NG left out, empty categories re-weight", 0-point columns as extra credit per the 14 Nov decision), with exact
  half-up rounding. 400 random gradebooks x 6 students (1-12 columns, maxes 0-100, missing / excused / blank / half
  points, random categories): computeGrade 2,400/2,400 equal; withNext vs a real appended column 2,400/2,400;
  neededOn vs brute force on the half-point grid 2,400/2,400.

## 7. Tests
- Functions never named in any suite (INVENTORY.txt x grep of tests/*.js): 408 of 592. The engine ones that matter
  most and have no direct assertion: roundPct, pct1, letterOfPct, isExtraCredit, catGuess, catIn, prevGradeSnap,
  snapBasis, pearson, ixlTrend, studentBooks, quarterOf, aDate, unitQuarter, unitColumnQuarters, unitQuarterOf,
  gbQuarter, qSec, mergeArchive, mergeArchives, cleanGB, cleanArchive, keepOutgoing, quarterAfterImport, isDay,
  parseIxlGrid, asScore, readZip, inflateRaw, xlsxToRows, fmtV, chartBars/chartLines/chartHist/chartStem, confRound,
  fastGainFloor, nextSchoolYear. (Many are exercised through the UI; none has a check on its own output.)
- Clock/zone dependence: see CLEANUP-7 (grades.js fails east of UTC+12; students-quarters fails with a clock inside Q1).
  No suite pins the clock; two set a zone (lab-board, lab-hardening).
- A permanent property suite should hold: (1) the grade oracle above (computeGrade, withNext, neededOn, plus
  quickestPath's claimed result re-checked with computeGrade); (2) for every screen that shows a grade, the shown
  number = computeGrade().rounded, and for kept quarters = final; (3) every rounding helper against exact rational
  half-up on s/n grids; (4) stats() against a hand oracle (median, Q1/Q3 middle-school method, MAD, IQR fences) on
  random integer lists incl. n = 1, 2, all-equal; (5) mdToISO/quarterOf on every day of the school year and the
  Q-end days under New York time with a pinned clock at 11:30 pm; (6) parse -> clean -> save -> load round-trip is
  the identity on random gradebooks (cleanGB/cleanArchive); (7) no "NaN|undefined|Infinity|-0" in any rendered view
  on random states.

## Not covered
- I did not read every line of all ten sources (about 1 MB of long lines); I read the grade engine (grades.js 1-290,
  519-581, 642-648), quarters.js 1-160 and 197-233, the IXL counting core (app.js 430-480, 700-790, 900-990), parts of
  students.js (30-80) and home.js (3-16), plus every lint and hazard hit in context. Other auditors own each engine.
- Data Lab, print, conference and seating render times; scrub.src.html; build.py beyond the splice logic (read in full:
  no defect; its asserts guard the markers and `</script` in vendor files).
- Behaviour under a real 2027-28 rollover (parked).
