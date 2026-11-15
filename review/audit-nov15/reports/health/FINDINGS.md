# HLT findings: code health across Tally (auditor HLT, 15 Nov 2026, repo at 8f973ed)

Scope: the whole codebase as code (lint, hazards, one quantity in several places, rounding, performance, tests,
structure). Probes are in `probes/`; `probes/_load.js` is the shared loader (fixture class + a synthetic full load of
6 classes x 30 students x 300 skills, 12 history days, 60-assignment gradebooks). Run any probe with
`TALLY_REPO=/home/claude/work/audit/base node probes/NN-slug.js`.

### HLT-01  The Students screen takes 3.5 s per render on a full teaching load
- Class: FRAGILE
- Severity: Medium
- Where: students.js: renderStudentsView -> quickestPath (line 552) -> computeGrade (grades.js line 45) -> catOf (grades.js line 29) -> gradingFor (grades.js line 9) / catGuess (grades.js line 20)
- Trigger: six classes of about 30 students with a quarter's gradebook (60 columns) loaded; every open of the Students
  screen and every sort or filter click on it (each calls render()). Weekly, and it grows through the quarter as columns are added.
- Observed: one render of the Students screen = 3,604 ms (Overview 72 ms, Grades 76 ms on the same data). A CPU
  profile (probes/_perf2.js students) puts 3,130 ms of 3,845 in quickestPath, 2,801 in computeGrade, and inside it
  1,711 ms in catOf, of which 871 in catGuess (four regexes per column per call) and 598 in gradingFor (which
  re-filters and re-maps the category list and re-validates map/how/codes/ec on every call).
- Expected: a render well under a second, like the other screens. Nothing in the result depends on recomputing the
  category of the same column hundreds of times per student.
- Repro: probes/01-students-render-slow.js
  ```
  OBSERVED: one render, ms: {"home":72,"grades":76,"students":3604}
  EXPECTED: the Students screen renders in under 1000 ms (the Overview and Grades screens take ~100 ms on the same data)
  FAIL Students screen renders in under a second on a full load
  ```
- Suggested fix: resolve each column's category once per section and pass it in: build `{name: catIn(sec, a)}` once at
  the top of quickestPath (and studentSummary/renderStudentsView) and hand it to computeGrade as `mapOverride`, which
  computeGrade already consults first. Separately let gradingFor skip its normalization when the stored object is
  already clean (a non-enumerable `_ok` flag). Risk: a stale map after a category edit if the map outlives one render;
  keep it local to one render. Suites grades, quickest, whatif-audit cover the numbers.
- Confidence: High on the measurement (rerun three times, 3.4-3.8 s); Medium on the laptop figure (this is a shared
  2-core VM; a fast laptop may be 3-4x quicker, still about a second per click).

### HLT-02  A kept quarter has two different "final" grades: the stored one and a recomputed one
- Class: WRONG-NUMBER
- Severity: High
- Where: quarters.js: mergeArchive (line 133, stores `final` = Focus's Grade column when the export has it) vs
  quarters.js: qSec (line 106) + grades.js: computeGrade (line 45), which every reader of a kept quarter recomputes from.
  Readers of the stored final: students.js: studentSummary (line 67, the Students list "Q1 final" and the profile tile),
  home.js: gradeSummary (line 3, the Overview card's "Q1 final" average). Readers of the recomputation: grades.js:
  renderGrades (the "Q1 · final" tab: each student's grade, letters, "Final class average", line 521/566),
  students.js: renderProfile's per-quarter heading (line 503). Also grades.js: regradeCourse (line 289) re-applies text-code
  rules to the live gradebook only, never to `qArchive[n].gb`.
- Trigger: any class whose Quarter 1 export Tally did not reproduce exactly at close (the Focus check's "N students off":
  a text code with no rule yet, a category guess Focus disagrees with). Once per quarter per affected class; the Focus
  check exists because this happens.
- Observed (fixture class, one Q1 cell reading "INC", Q1 then kept and closed): stored final 79 (= Focus), Students list
  79, Grades "Q1 · final" tab 78; Overview Q1 average 82.57 vs Grades "Final class average" 82.52. Deciding INC = zero
  afterwards (regradeCourse) leaves the kept cell `unread`, so the recomputed Q1 never changes, and gbQuestions (live
  gradebook only) never asks about it again.
- Expected: one Quarter 1 final per student everywhere. GRADES_SPEC sec. 7: the kept record holds "the final grade per
  student (equal to the Focus Grade column when the export was single-quarter)", so a screen labelled "final" should show
  `qArchive[n].final`, and the class average of a closed quarter should be the mean of those finals.
- Repro: probes/02-kept-quarter-two-finals.js
  ```
  staged: {"i":0,"name":"SUTTER, HAYDEN SKYLER","focus":79,"tally":78}
  OBSERVED: {"q1Closed":true,"storedFinal":79,"studentsListFinal":79,"gradesTabFinal":78,"overviewQ1Avg":82.57,"gradesTabAvg":82.52,"gradesTabFinalAfterInczero":78,"archivedCellStatus":"unread"}
  FAIL Students list Q1 final = Grades "Q1 · final" tab grade
  FAIL Overview Q1 final average = Grades "Final class average"
  ```
  (scrubbed fixture name; synthetic INC code.)
- Suggested fix: in the Grades screen's kept-quarter tab and the profile's quarter heading, show `a.final[i]` as the
  grade (and its letter), and compute "Final class average" as the mean of `final`; keep computeGrade for the category
  breakdown and flag a student whose recomputation differs ("Focus: 79, Tally reads 78"). Optionally run applyCodes on
  each `qArchive[n].gb` in regradeCourse. Could break: suites quarter-pie, quarters-related checks that read the tab.
- Confidence: Medium-High. What would change my mind: a NOTES decision that the kept tab must show Tally's own
  recomputation (I found none; grep "final" in NOTES/GRADES_SPEC).

### HLT-03  The Data Lab rounds a mean that is exactly halfway between tenths DOWN about half the time (toFixed)
- Class: WRONG-NUMBER
- Severity: Medium
- Where: app.js: fmtAvg (line 1069, `x.st.mean.toFixed(1)`), the stats table in labMarkup (line 1238: `mean` and `MAD`
  via `toFixed(1)`), the class-averages chart's `fmt: v => v.toFixed(1)` (line 1231), fmtN (line 988, used 60+ times for
  quartiles, IQR, outlier values, ranges). The charts' own helper fmtV (charts.js line 27) rounds half up
  (`Math.round(v * 10) / 10`), so the two helpers disagree on the same number.
- Trigger: any class of 20 or 40 counted values (the only common sizes where a mean can end in exactly 5 hundredths)
  whose sum makes the mean x.x5: about 1 in 10 such data sets, half of which round down. Projected to 7th graders
  learning to compute a mean and round to the nearest tenth. Also: n = 4, 8 for small data sets typed in by hand.
- Observed: 20 scores (19 x 60, one 61), exact mean 1201/20 = 60.05: Lab average "60.0", stats table mean "60.0",
  fmtV "60.1". Further: 0.15 -> "0.1", 72.35 -> "72.3", 88.05 -> "88.0", but 2.45 -> "2.5" (binary representation decides).
- Expected: "60.1". The mean is exactly 60.05; rounding to the nearest tenth with half up (what the class is taught, and
  what Tally itself does for grades: roundPct, "Focus rounds the grade half up") gives 60.1. A student checking the board
  by hand gets a different answer from the board.
- Repro: probes/03-lab-mean-half-down.js
  ```
  OBSERVED: {"n":20,"exact":"1201/20","mean":60.05,"labAverage":"60.0","statsTableMean":"60.0","chartValue":"60.1","more":["0.15->0.1","2.45->2.5","72.35->72.3","88.05->88.0"]}
  FAIL Data Lab class average beside the name (fmtAvg) shows 60.1
  FAIL stats table mean cell shows 60.1
  ```
- Suggested fix: one helper `tenth = x => { const r = Math.round(x * 10 + 1e-9) / 10; return (Object.is(r, -0) ? 0 : r).toFixed(1); }`
  and use it in fmtAvg, fmtN, the stats table and the class-averages chart (fmtV can become `v == null ? '—' : String(Math.round(v * 10 + 1e-9) / 10)`).
  The 1e-9 slack matches roundPct and guards a product such as 1.005 * 10 = 10.049999999999999. Checked: on every mean s/n for n = 4, 8, 20, 40 the helper matches exact half-up rounding (0 mismatches); toFixed(1) misses 160 of them for n = 20 alone in the 60-100 range. Safe: it only changes
  the last digit at exact ties. Check suites lab-average, race-and-lab, lab-board for hard-coded strings.
- Confidence: High (pure arithmetic; JavaScript's toFixed rounds the binary value, not the decimal one).

### HLT-04  Grades screen "cost" of the only graded column shows the class average itself ("+60.1")
- Class: WRONG-INFO
- Severity: Low
- Where: grades.js: renderGrades, the assignment rows (line 539: `cost: avg != null ? avg - classAverage(s, null, a.name) : null`), shown at line 579
- Trigger: the first export of a quarter (one graded column), or any column that is the only one with grades in it
  for every student. Once a quarter per class, for a week or so.
- Observed: one-column gradebook (fixture class, only "Unit 1 Assessment"): class average 60.14, average without the
  column `null`, so `avg - null` = 60.14 and the cost cell reads "+60.1".
- Expected: blank (GRADES_SPEC sec. 4: cost = class average now minus class average with this assignment removed;
  with nothing left there is no average to subtract, so there is no cost). A signed number is a false statement.
- Repro: probes/04-cost-only-column.js
  ```
  OBSERVED: {"avg":60.13636363636363,"without":null,"costCell":"+60.1",...}
  FAIL no cost number for the only graded column
  ```
- Suggested fix: `cost: (() => { if (avg == null) return null; const w = classAverage(s, null, a.name); return w == null ? null : avg - w; })()`.
  Nothing else reads `cost`.
- Confidence: High.

### HLT-05  "Previous class average" is computed twice; the Grades card reads an ungraded import as 0 ("+83 since Nov 8")
- Class: WRONG-NUMBER
- Severity: Medium
- Where: grades.js: renderGrades (line 521: `prev.grade.filter(v => v != null).reduce(...) / (prev.grade.filter(v => v != null).length || 1)`)
  vs home.js: gradeSummary (line 10: `pv.length ? ... : null`). The mean of a snapshot's grades is written out five times
  (also grades.js line 551 trend, home.js line 118 Overview chart, home.js line 185 digest `avg`); four return null for
  no grades, renderGrades alone uses `|| 1` and turns "no grades" into an average of 0.
- Trigger: an export taken when the quarter's columns exist in Focus but none is graded yet (every grade null), followed
  by a later export in the same quarter. Plausible in the first week of a quarter; once per quarter at most.
- Observed: snapshots 2026-11-08 (0 graded) and 2026-11-15 (23 graded). Grades card: "Class average 83% +83 since
  Nov 8". Overview for the same class: prevAvg null (no change shown).
- Expected: no change line (or "first import"), as the Overview does: an average of no grades does not exist, and
  "+83 since Nov 8" says the class average rose 83 points in a week.
- Repro: probes/05-prev-average-zero.js
  ```
  OBSERVED: {"history":["2026-11-08:0 graded","2026-11-15:23 graded"],"gradesCard":"Class average83%+83 since Nov 8","overviewPrevAvg":null}
  FAIL Grades card shows no "+N since" against an import that had no grades
  ```
- Suggested fix: one helper next to classAverage, `const snapAverage = h => { const v = (h && h.grade || []).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };`,
  used by renderGrades and gradeSummary (and the digest, home.js line 165 onward, if it averages a snapshot too).
- Confidence: High.

### HLT-06  Category percents round 57.5 down to 57 (bare Math.round), while the course grade rounds it up
- Class: WRONG-NUMBER
- Severity: Low
- Where: grades.js: pct1 (line 444) and the report's category bars (studentReportSection, line 873 `Math.round(x.pct)`);
  students.js: renderProfile (lines 495-501, 739); conference.js: the conference form's category line (line 505); charts.js:
  gradeFill (line 19, `letterOf(Math.round(pct))`, the bar colour). Versus grades.js: roundPct (line 67, `Math.round(p + 1e-9)`).
- Trigger: a category whose points are exactly x.5 % but land just under it in floating point. Exhaustive search over
  every half-point score out of 1-400 points: 32 cases, all at 57.5 % (23/40, 46/80, 69/120 ...) or 14.5 / 28.5 / 56.5 %
  (out of 100). No letter boundary is affected (searched 59.5, 69.5, 79.5, 89.5: none). Rare.
- Observed: 23 of 40 in Assessments: category 57.49999999999999 -> "57%"; the course grade of the same student (one
  category) -> "58%". Report card and profile show "Assessments 57%" next to a grade of 58%.
- Expected: 58% on both: Tally's own rule (grades.js line 66 comment: "Focus rounds the grade half up ... with a hair of
  slack so a grade that is 59.5 in decimal arithmetic but 59.49999… in floating point still rounds the way Focus shows it").
- Repro: probes/06-category-pct-half.js
  ```
  OBSERVED: {"catPct":57.49999999999999,"shownByPct1":"57%","shownByMathRound":"57%","courseGrade":"58%"}
  FAIL category percent rounds 57.5 up
  FAIL category percent = course grade when the grade has one category
  ```
- Suggested fix: `const pct1 = v => v == null ? '—' : roundPct(v) + '%';` and replace the bare `Math.round(x.pct)` /
  `Math.round(r.cats[..].pct)` in the four places above with roundPct (gradeFill too). Only exact-tie outputs change.
- Confidence: High on the arithmetic; Low on impact (no letter changes).

## Suspicions (unproven)

- **"Sliding" is implemented three times with different guards.** grades.js renderGrades (line 531): `(d <= -3) || (pm != null && missing > pm)`;
  home.js gradeSummary (line 13): `(d <= -3) || miss > (prev.missing[j] || 0)`; students.js studentSummary (line 71):
  computes `dMissing` only when the current grade is not null. A student with no current grade but more missing work
  is "sliding" on the Grades screen and the Overview count, not on the Students list. Reaching a null grade with a
  missing cell needs a missing mark only in a no-points / extra-credit column or a 0-weight category, so I did not
  build the probe. Fix: one `slidingOf(r, prevSnap, j, missingNow)` used by all three.
- **Quarter-1 text codes stay unread forever after Q1 is kept** (part of HLT-02's evidence): regradeCourse never
  re-applies the course's code rules to `qArchive[n].gb`, and gbQuestions only reads the live gradebook. Whether a
  kept quarter should follow a later rule is a decision for Croix (a kept quarter is meant to be read-only), so I file
  it here and not as its own finding.
- **Overview chart of class averages by import (home.js line 118)** takes `gradeHistory.filter(h => h.date === d).pop()`,
  i.e. the later-quarter snapshot when the last Q1 export and the first Q2 export share a day (gradeSnapshot keeps both
  by design). The point on the break day mixes quarters. Not probed.
- **ixlVsTests (grades.js line 248)** counts a test cell only when `a.status` exists; computeGrade and cellOf treat a
  missing status array as score/blank. Every parsed and cleaned gradebook has `status` (cleanGB), so this only bites a
  hand-built state. Not probed.
- **app.js okDay (line 60, and line 124)** validates a day with `!isNaN(new Date(v + 'T12:00:00'))`, which accepts
  "2026-02-31" (Date rolls it to March 3); quarters.js isDay (line 212) rejects it. Only a hand-edited save reaches it.

## Cleanup and hardening

Lint: eslint 9 on the browser's script (parser.js + app.js with every splice, as build.py does; line map back to the
sources in `lint/map.json`; config `lint/eslint.config.js`; raw hits `lint/hits.txt`). 86 hits; triage:

- **CLEANUP-1 Dead top-level functions (no caller in any source; a few only in tests via `__tally`).** Linting with
  the two test hooks removed (`lint/nohook.js`): `printStudentCard` (grades.js 1016), `openReturns` (grades.js 1035,
  tests only), `openStudentReports` (grades.js 1092, tests only), `shuffleArr` (seating.js 130), `skillPractice`
  (students.js 215, tests only), `assignedIdx` (app.js 719), `sectionWarn` (app.js 1991, tests only). Proof: the
  `grep -w` count in every source except the hook lines is 0 (command in COVERAGE.md). Delete the four with no test
  caller; for the three a suite calls, either delete with the checks or keep and note "test entry".
- **CLEANUP-2 Dead work in studentReportSection (grades.js 649-882).** 12 locals computed on every report and never
  used: `withIxl` 662, `nextLine` 672, `arrow` 676, `last` 687, `copyLine` 705, `copyPts` 706, `first` 707, `ids` 771,
  `rtNeed` 799, `rtShort` 804, `unitWords` 807, `onFront` 845. `rtNeed`/`rtShort` build retake-need sentences that no
  longer reach the page: confirm with Croix that the retake sentence is meant to be gone, then delete. Other unused
  locals: ixlVsTests `units`, `t`, `g` (grades.js 242), renderGrades `cell` (553), staleExports arg `indices` (998),
  renderHome `H` (home.js 78), digestMarkup `sec` (198), seatStudents `t` (seating.js 61), renderProfile `nm`
  (students.js 450), conferenceWork `ixlLeft` (conference.js 93), unitsOf `t` (app.js 441), labMarkup `course` (1173),
  parseGradebook `j` (1769), workPrint's five destructured fields (2731), finderItems `inClass` (3105).
- **CLEANUP-3 Duplicate keys in `window.__tally`** (app.js 3178): `attentionGroups`, `labSeries`, `parseGradebook`
  appear twice. Harmless (same value) but the hook is hand-maintained; generate it.
- **CLEANUP-4 One helper per rule, where two exist:** `letterOf` / `letterOfPct` (grades.js 7, 648: equal on every
  input incl. NaN and negatives, checked); `roundPct` / `confRound` (grades.js 67, conference.js 9: identical);
  `localDay` / `localDayOf` (app.js 807, quarters.js 120: differ only at `null`, where localDay gives "1969-12-31";
  no current caller passes null); today's date written three ways (`todayISO`, `localDay(new Date().toISOString())` at
  grades.js 687/828/887, a hand-built string in quarterDue, quarters.js 232); the at-goal test `v != null && v >= t`
  inlined six times (app.js 480, 728, 773, 972, 2256, plus points()). Merge each pair; no output changes.
- **CLEANUP-5 Shadowing that invites a slip:** grades.js 1051 declares a local `LETTERS = ['A','B','C','D','F','—']`
  inside a function while the top-level `LETTERS` (grades.js 6) is the cut-score table letterOf reads; app.js 908
  local `mean` shadows students.js's `mean` helper; app.js 2977 local `safeObj` shadows the top-level one. Rename the
  locals. The other 35 no-shadow hits are short loop names (`u`, `a`, `k`): noise.
- **CLEANUP-6 Noise, no action:** no-undef `FormData`, `sessionStorage` (browser globals missing from my config) and
  `keep` (only inside the audit-only `__all` hook, which lists a name that is not top-level); 7 no-useless-escape `\/`
  in regexes. No hits at all for no-dupe-args, no-dupe-else-if, no-self-assign, no-self-compare, no-unreachable,
  no-fallthrough, no-cond-assign, no-constant-condition, no-unsafe-negation, use-isnan, valid-typeof, no-redeclare,
  array-callback-return, no-loss-of-precision, no-sparse-arrays, no-prototype-builtins.
- **CLEANUP-7 Suites that depend on the clock or zone** (run with `probes/clock/shift.js`, a `--require` hook that
  shifts Date in node and the page, and sets the context zone):
  `TZ=Pacific/Kiritimati SHIFT_TZ=Pacific/Kiritimati NODE_OPTIONS="--require probes/clock/shift.js" node tests/grades.js`
  -> 2 FAILED ("two history entries by date", "trend card and Δ"): the suite stamps `importedAt='2026-09-19T12:00:00.000Z'`
  and expects the local day 2026-09-19, false east of UTC+12. Not an app bug (Croix is in New York); write the stamp
  as local noon (`new Date(2026, 8, 19, 12).toISOString()`).
  `SHIFT_TO=2026-10-05T15:00:00Z ... node tests/students-quarters.js` -> 3 FAILED: the suite closes Q1 and imports a
  Q2 gradebook, which only makes sense after Q1's end; it passes today only because today is in Q2. Pin the suite's
  clock (Playwright `page.clock.setFixedTime`) so it keeps testing the same day. Passed under every shift:
  grades (2027-01-20, 2026-12-19T04:30Z = 11:30 pm 18 Dec in New York), test-dates, quarter-units, students-quarters
  (2027-01-20, 2026-12-19T04:30Z, UTC+14).
- **CLEANUP-8 gradingFor normalizes on every call** (grades.js 9): it re-filters and re-maps `cats`, re-validates
  `map`, `how`, `codes`, `ec` and allocates new arrays each time; computeGrade calls it once per call and catOf once per
  column. 598 ms of the Students render in HLT-01. Cache-clean it (normalize on load / on edit only).
- **CLEANUP-9 Structural proposals, ranked by risk removed per line changed** (house style kept):
  1. *One reader per kept-quarter figure* (fixes HLT-02): `qFinalOf(sec, n, i)` = `qArchive[n].final[i]`, used by the
     Grades kept tab, the profile heading, the Students list, the Overview; computeGrade only for the breakdown. ~5 lines.
  2. *One snapshot average* `snapAverage(h)` (fixes HLT-05) for the five places that average `h.grade`. ~6 lines.
  3. *One number-to-text module*: `roundHalf(x, places)` with the 1e-9 slack and -0 folded to 0, then
     `pct0 = v => roundHalf(v, 0) + '%'`, `tenth = v => roundHalf(v, 1).toFixed(1)`; route pct1, fmtAvg, fmtN, fmtV,
     confRound, roundPct, the bare `Math.round(x.pct)` calls through it (fixes HLT-03, HLT-06). ~10 lines plus call sites.
  4. *Invariant checks in the test build only* (build.py already strips the `__tally` line; add a sibling
     `__check` line): after each render assert that classAverage(sec) equals the mean of the rows' grades on the
     Grades screen, that every shown grade equals computeGrade().rounded, that ixlFor(sec,i).done equals the Race's
     value for the same units, and that no "NaN", "undefined", "Infinity" or "-0" text is in `#gridwrap`.
  5. *A render-scoped memo* for catIn / gradingFor / unitsOf (fixes HLT-01): a `Map` created at the top of render() and
     dropped at its end, so no cache can go stale across edits.
  6. *One date module*: `todayISO`, `localDayOf`, `isDay`, `mdToISO` only; delete `localDay`, `okDay` and the inline
     day strings (CLEANUP-4).
