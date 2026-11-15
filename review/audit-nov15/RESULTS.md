# Deep audit, 15 Nov 2026: results

Snapshot audited: `8f973ed`. **No Tally code was changed.** Croix stopped the run at the point below ("Finish, push,
and stop"), so this file is the hand-over: what was found, what the counter agent ruled, and what is left.

- 12 auditors (Opus 5.5), one per engine. Every finding has a reproduction in `probes/<auditor>/` that exits 1 while
  the defect exists. Reports: `reports/<auditor>/FINDINGS.md` (four are condensed: grades, charts, seating,
  conference; imports and data came back as text and are only in section D here).
- 8 of the 12 reports were attacked by a counter agent (IXL, grades, what-ifs, charts, time, consistency, seating,
  conference). **Reports, imports, data and code health have NOT been countered**: by Croix's rule nothing in
  section D may be decided on yet.
- To rerun a probe: `tools/make_audit_copy.sh <repo> <dir>` builds a test copy with the `window.__all` hook the
  probes use, then `TALLY_REPO=<dir> node probes/<auditor>/NN-*.js`. `counter-probes/` holds the counter agents' own
  probes and, for the grade fit, a tested fix (`counter-probes/grades/grades.fix-GRD01-03.js.txt`).

## A. Confirmed by the counter agent: fix (one right answer, contained fix)

Critical and High
- **WIF-01 = CON-01 = CNF-01 (Critical, rare): two students of one name.** The second student's what-ifs, plan,
  tables, Show student screen and conference form show the first student's numbers (`norm()` strips the "(ID …)" mark
  of the 14 Nov fix; students.js 56-74, 453, 705). Fix: look up by `gb.ids` first, then the exact name, then `norm`
  only when it is unique; kept quarters (`qArchive`) are not marked, so `mergeArchive` needs the same.
- **TIM-04 (High): `unitClosed` assumes units are taught in number order.** From the first export of a new quarter
  until a unit's own Focus IXL column exists, units still being taught count as past (on-level Q3: Units 5-7;
  accelerated Q3: Units 7-10): they drop out of the weekly report, still owed, the digest, the quarter pie and the
  student page. Fix (a variant passed 130 tests): before quarters.js line 99, a unit whose test date falls in the
  live quarter is not past. Check first: "Working in" follows unit numbers too (on-level on Unit 9: are Units 5-8
  owed before they are taught?).
- **WIF-02 (High, the real class every week):** a student is told "finish 15 IXL skills" when 4 open the retake
  (Unit 1: 23 skills, Focus column out of 15). Fix: `need` in retakeStatus and retakeWhy, and grades.js `ixlNeed`.
- **WIF-10 = CON-02 (High, every student page in Q2):** the IXL tile reads "2 of 36 skills · class average 33.1": the
  average, the sparkline and "± since the last export" count closed units too (19.6 is right). Fix: `ixlTrend` takes
  `ixlFor`'s units.
- **CON-03 (High): the parent conference form drops every IXL column from "missing".** A student with Unit 3 IXL NHI
  and 7 of 17 skills gets "Missing: 0 · Every assignment turned in · No concerns right now". Fix (tried, suites
  pass): conference.js 34 `(!ixlCol(a) || owedWork(...).owed.includes(a))`. The Students tile's count is his call.
- **CHT-01 (High): a histogram in bins of 1 folds the top value into the bar below** ("9: 9 students" = 5 tens +
  4 nines; no 10 bar). Any unit of 10 skills or fewer. Fix (tried, suites pass): `nb = floor(max) + 1` when the bin
  is 1 and the values are whole, in chartHist and histTop.
- **SEA-04 (High, data loss): room Undo puts back every class's chart from before the room edit**, deleting charts
  saved since. Fix: keep `savedAt` in roomPush; restore a class only if it still matches.
- **IXL-01 (High if he uses "ID + points"):** that copy mode, the unit CSV and the corrections list have blank IDs
  whenever a gradebook is loaded (`gbRows` strips them). Fix (tried): drop the strip.

Medium
- **GRD-01:** the category fit stalls before an exact fit that exists (313 of 998 random classes; never on the real
  class). Tested fix in `counter-probes/grades/`. **GRD-02 / GRD-03:** "See why" states a cause that only holds
  with other categories, and never offers "Tally's weights plus one move". **GRD-06:** a new column two categories
  fit gets a name guess that does not fit; "Matches … for all 23" shows beside "differs for 1".
- **GRD-04 = CON-06:** after a weights / category / text-grade change, "since the last import", Sliding and the
  digest report it as students moving. Fix: compare snapshots only when the weights, rules and the categories of
  the shared assignments are the same (do not hash the whole map: it changes every week).
- **GRD-07 = CON-04:** the Categories table's "Avg (turned in)" counts NHI as 0 (80 % against 99 %): relabel.
- **IXL-02:** the import snapshot uses the last export's student keys when the class size is unchanged (history
  only; `_keys: null` at app.js 568). **IXL-03:** points that fell after a copy read "up -1 since" (`&& tally >
  focus`). **IXL-06:** a gradebook name the roster reader cannot read shifts every copy row below it (guard: refuse
  to copy when the row counts differ). **IXL-08:** an NHI IXL column with no unit ("IXL Diagnostic") does not block
  a retake. **IXL-12 / IXL-13:** "What changed" counts skipped accounts; skipping a skill for one student reads as
  that student dropping.
- **TIM-01:** 14 places show the UTC day of a stamp (after 7 pm: "copied Dec 19"). **TIM-02 / TIM-09:** the
  Quarters dialog saves a half-typed date on the first keystroke and accepts dates out of order. **TIM-03:** the
  Close-quarter dialog dates a gradebook by its import, not its export.
- **CHT-03:** in the % view an extra-credit score is drawn past the axis and counted in "95-100". **CHT-06:** "Our
  own data" with decimals or negatives is misdrawn (false stem-and-leaf key; negatives off the axis and dropped
  from the circle graph). **CHT-12:** a bar graph with a maximum of exactly 26 draws rows on different scales.
  **CHT-13:** the Board's "as of" is the newest class's date even when another class is weeks behind.
- **SEA-01:** Seating's IXL % counts closed units (17 against 6 on Students) and feeds standing (standings will
  move). **SEA-02:** an empty chart shows fit 100 beside "23 hard". **SEA-12:** a one-sided keep-apart is silently
  not enforced.
- **CNF-02:** FAST scores are also read by name, so a same-name student shows the other's PM3. **CNF-03:** an
  August FAST report misfiles last spring's PM3 (gain target 263 for 254). **CNF-06:** a missing notebook check is
  told to parents as a test "not taken yet" (4 of 23 forms). **CNF-07:** the score-report PDF matches near-names
  with no FLEID check.
- **WIF-04:** Show student's "Show me on the sliders" keeps earlier picks.

Low (all confirmed): IXL-04, IXL-07, IXL-09 · TIM-08, TIM-10 · WIF-05, WIF-06 · CHT-14, CHT-15 · CON-05, CON-08 ·
CNF-05 · SEA-03, SEA-06, SEA-07 ("22th"), SEA-09, SEA-11.

## B. Confirmed, but Croix's call (the fix changes what he sees or decides)

- **GRD-05 = CON-10 = HLT-02: a closed quarter shows two finals** (Focus's kept grade on the tile; Tally's recount on
  the Q1 tab and the page heading). Show the kept final, both, or leave it? (The two counter agents disagreed.)
- **CON-07:** Copy pastes 17 into a 15-point IXL column while the plan and report count 15. Cap the paste, or count
  what is pasted?
- **IXL-11:** "New student? Re-paste the roster" does not change what Copy pastes (it follows the gradebook, by
  decision). Reword to "export a new gradebook", and have Copy ask when a roster student is missing from it?
- **IXL-05:** two IXL students of one name: when one leaves, the other inherits the best scores. Reset on change, or
  wait until such a pair exists? **IXL-10:** the grid's footer average includes "not on roster" rows.
- **WIF-03:** an NHI on a 0-point extra-credit column blocks a retake. **WIF-07:** an excused IXL column blocks a
  retake and is called "not in Focus yet". **WIF-08:** Focus holding more IXL points than Tally makes the plan
  promise what one skill cannot deliver. **WIF-11:** a student on a modified list is offered "every skill, 17/17".
- **TIM-05:** one assignment due after the quarter's end moves the class to the next quarter. Does he ever date
  work past the quarter?
- **CHT-02:** circle-graph percents can add to 99 or 101 (each is rounded correctly). A "may not add to 100" note
  (the counter's pick), largest-remainder rounding, or one decimal? **CHT-09:** the Race calls a class that joined
  after the baseline "first week in the race" and ranks it last. **CHT-05:** line graphs space imports evenly.
- **CON-09:** the Overview's "IXL work at goal" counts every assigned unit; the label does not say. **SEA-10:**
  FAST level 1 counts as "low" under every "Place by".

## C. Refuted, intended, or logged

CHT-07 refuted (Tally's quartiles are the standard middle-school method). SEA-05 refuted as written (a real import
keeps twins apart). CNF-04 intended (his "the threes need a four" rule is recorded in NOTES). CHT-10 intended.
Logged: GRD-08, TIM-07, WIF-09, SEA-08, CNF-08 (goes with the 2027-28 rollover).

## D. NOT YET COUNTERED (auditor's claims only: counter these before deciding anything)

- **Printed reports (RPT)**, `reports/reports/FINDINGS.md`: RPT-08 High, "This quarter's IXL finished → X %"
  overstates for a student with skipped skills (93 % for 90 %); RPT-01 "Remove a print" on a reprint also deletes
  that week's first print and its signed tick; RPT-09 the retake notice names "Wednesday and Thursday" with no
  school calendar (Thanksgiving); RPT-02 "every assessment at full marks" over IXL assessments at a third; RPT-07 a
  student who finished their own list still "owes" the column; RPT-03, 04, 06 Low.
- **Imports (IMP)**, probes only: IMP-01 High, two students sharing an IXL name in one course export stay "not found
  in IXL" (`01-pool-twin-alias.js`); IMP-06 High, the weekly "any order" drop depends on file order when a student
  changed classes and Focus spells the name differently (`06-carve-order.js`); IMP-02 an export with no names
  shifts scores after a skill listed twice; IMP-03 a "Last-School-Year" file replaces this year's data silently;
  IMP-05 an HTML .xls with multi-line headers loses due dates; IMP-04 Low.
- **Saves and privacy (DAT)**, probes only: DAT-02 High, printing while the PIN screen is up prints Tally unblurred;
  DAT-06 High, a full school year may not fit in browser storage (5.47 M characters against about 5.08 M; a lighter
  year 67 %); DAT-05 "Forgot the PIN?" accepts any Full save (a decision); DAT-01 another tab's save wipes an
  unsaved pasted roster; DAT-04 a file dropped on the PIN screen is imported; DAT-08 an old-style backup overwrites
  newer goals, overrides and seating though the dialog says nothing is removed; DAT-09 "Clear all" is undone by a
  second open tab; DAT-03, DAT-07 Low.
- **Code health (HLT)**, `reports/health/FINDINGS.md`: HLT-01 the Students screen takes 3.4-3.8 s per render on a
  full load; HLT-03 a Data Lab mean exactly halfway between tenths rounds down about half the time; HLT-05 the
  Grades card shows "+83 since Nov 8" after an import with no grades; HLT-04, HLT-06 Low; 7 unused functions.

## E. Verified correct (independent recounts)

The Focus grade on 5,000 random gradebooks (34,689 grades, 755 exactly on .5) · the score needed for a letter,
6,668 checks by brute force · IXL points, totals, copy order in every mode and Focus-check verdicts on 6,500 random
classes · what-ifs, the quickest way and the retake rule on about 24,000 students · the Data Lab's statistics on
3,000 sets and 6,966 screens (no name, nothing under 5 drawn) · the Race on 300 histories · date math on 183,360
cases in four time zones (quarter ends inclusive, no off-by-one across daylight saving) · 12,719 weekly reports
recounted · every FAST cut score against FLDOE's tables · the CSV reader on 20,000 files · drop order across 24
permutations · a Board save with 152 planted tokens (none leaked) · escaping of every imported string.

## To resume

1. Counter section D (briefs: `BRIEF_COMMON.md`, `BRIEF_COUNTER.md`).
2. Fix section A, each with its probe as the failing-first check, then the full suite.
3. Put section B to Croix.
