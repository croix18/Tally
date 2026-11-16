# Deep audit, 15 Nov 2026: results

Audited snapshot: `8f973ed`. Croix: *"I need all of the math and the information absolutely correct at all times ...
Don't make any decisions before running it against a counter agent."* Then: *"Look carefully over the results and make
the changes you think are best."*

How it ran (agents on Opus 5.5):
1. **12 auditors**, one per engine, each with its own recount of the math and a reproduction for every finding
   (`probes/<auditor>/`, reports in `reports/<auditor>/`).
2. **12 counter agents**, one per report, tried to refute every finding (`counter-probes/`).
3. **10 fixers**, one file or region each, fixed what survived. Every fix has a check that fails on the old code:
   `tests/audit-nov15-*.js` (10 suites).
4. **4 counter-reviewers** attacked the merged fixes (`review-probes/`); they found 24 more problems, including two
   regressions, and a second round fixed them.
5. Full suite on the result: 70 suites · 2,228 passed · 0 failed.

To rerun a reproduction: `python3 build.py --test`, then `TALLY_REPO=$PWD node review/audit-nov15/probes/<auditor>/NN-*.js`
(the test build now exposes every engine function as `window.__all`). Several old probes now exit 1 by design: they
assert the old wording, the old engine value under a screen that is now right, or a behavior a decision below changed.

## Fixed

**Critical (rare triggers)**
- **Two students of one name in a class.** The second one's what-ifs, plan, tables, Show student and conference form
  showed the first one's numbers, and (found by the reviewer) both shared one set of notes, family contacts, signed
  ticks and conference text. A student's gradebook row is now found by Focus ID, then the exact name, then a plain
  name only one row has (`gbIndex`, `gbIdKey`, `gbRowMatcher`); per-student records use `stuKey` (the plain name
  unless two students share it, then the Focus ID). An entry saved earlier under a name two students now share is
  shown to neither and left in the data.
- **Two students with one IXL name in one course export** (IMP-01): in one class their scores could swap with status
  "ok"; across classes the second stayed "not found in IXL". A carved class now keeps the course export's keys
  (`sec.poolKeys`).
- **A student who changes classes** lost his kept best scores, and the lower points would be copied (CTR-01, found
  by a counter agent). His bests now move with him, only when the same Focus Student ID is on his roster line in
  both classes (`sec.bestIds`).

**High**
- TIM-04: at the start of a new quarter, units still being taught dropped out of the weekly report, still owed, the
  digest and the student page (the code assumed units are taught in number order). A unit whose test date is in the
  live quarter or later is not past.
- WIF-02: "finish 15 IXL skills" when 4 open the retake: the count is now what fills the Focus column, on every
  screen and on the conference form.
- WIF-10: the IXL tile's class average, sparkline and change counted closed quarters' units.
- CON-03: the parent form dropped every IXL column from "missing".
- CHT-01: a histogram in bins of 1 folded the top value into the bar below. One bar per value; rows share one axis.
- SEA-04: room Undo deleted charts saved (or hand seating started) after the room edit.
- IXL-01: "ID + points" copies lost the Student IDs.
- DAT-02: printing while hidden behind the PIN printed Tally unblurred.
- RPT-08 / RPT-07: the weekly report promised a grade a student with skipped skills cannot reach, and called a
  finished list "owed".
- GRD-04: a change of weights, categories or text-grade rules read as students moving. Imports are compared only
  when their rules match; otherwise the screens say the grading settings changed.

**Medium**
- Grades: the category fit no longer stalls before an exact fit (GRD-01); "See why" says only causes that hold with
  the categories it names, offers "Tally's weights plus one move" first, and no longer marks its own moves as proved
  (GRD-02, GRD-03); a new column two categories fit is not stored as a guess that does not fit (GRD-06); "Class avg"
  label (GRD-07); "+83 since" after an empty import (HLT-05).
- IXL and copy: a drop after a copy is not "up -1 since" (IXL-03); an unreadable gradebook name keeps its own blank
  row (IXL-06); an NHI IXL column with no unit blocks a retake as work to turn in (IXL-08); "What changed" counts
  the counted class (IXL-12); a skill skipped for one student, or a switch of "best score", is not read as students
  dropping (IXL-13, IXL-07); snapshots after a same-size roster swap (IXL-02).
- Imports: the weekly drop gives the same classes in any order (IMP-06); a "Last-School-Year" file asks first
  (IMP-03); an export with no names no longer shifts scores (IMP-02).
- Time: 14 dates showed the UTC day after 7 pm (TIM-01); quarter and test dates are kept when the box is left, and
  out-of-order ends are refused (TIM-02, TIM-09); Close Quarter dates a gradebook by its export (TIM-03).
- Charts: extra credit in the % view (CHT-03); decimals and negatives in "Our own data" (CHT-06); a maximum of 26
  (CHT-12); "as of" both ends when classes differ, on the Board and the Overview (CHT-13); means at exactly .05
  round half up (HLT-03).
- Seating: IXL % follows the open quarter (SEA-01: standings move); no fit of 100 with students unseated (SEA-02);
  a one-sided keep-apart is enforced (SEA-12).
- Conference and FAST: same-name FAST rows (CNF-02); an August report (CNF-03); a notebook check is "turn in", not
  a test "not taken" (CNF-06); the score-report PDF checks the FLEID (CNF-07).
- Reports: a reprint no longer overwrites Monday's print, and removing it leaves Monday (RPT-01); "every
  assessment at full marks" is true (RPT-02).
- Saves: an unsaved Settings edit survives another tab's save (DAT-01); "Clear all" is not undone by another tab
  (DAT-09); a file dropped on the PIN screen is not imported (DAT-04).
- Speed: the Students screen is about four times faster on a full load (HLT-01).

**Low**: IXL-04, IXL-09 · TIM-08, TIM-10 · WIF-04, WIF-05, WIF-06 · CHT-14, CHT-15 (ticks) · CON-05, CON-08 ·
CNF-05 · SEA-03, SEA-06, SEA-07, SEA-09, SEA-11 · RPT-03, RPT-04, RPT-06 · HLT-04, HLT-06 · DAT-07 · small ones
(escaped names in two toasts, bare CR rosters, a grid with no skills is refused, SmartScores 0 to 100 only).

## Calls made for Croix (each is easy to reverse)

1. **A closed quarter shows one final: Focus's kept grade.** Tally's recount is shown beside it, labelled, when it
   differs (Grades tab and the student page).
2. **Extra credit (a 0-point column) is never missing work**: not for retakes, what-ifs, the plan, the weekly
   report or the parent form. (The Students list's NHI count is unchanged.)
3. **An excused IXL column does not block a retake.**
4. **Copy asks first** when a roster student matched in IXL is not in the gradebook Tally has (rows would be off by
   one), and "New student?" now says to export a new gradebook.
5. The grid's footer average counts the counted students only.
6. Circle graphs: a short note when the rounded percents do not add to 100. The labels stay correctly rounded.
7. The Race: "joined the race after <date>" for a class that started after the baseline. Ranking unchanged.
8. The Overview's IXL card names the units it counts.
9. **The retake notice skips weeks with no school.** A built-in 2026-27 list sits beside `Q_ENDS` (`NO_SCHOOL`,
   `LAST_SCHOOL_DAY`): Veterans Day, Thanksgiving 23-27 Nov, winter break 21 Dec to 5 Jan, spring break 22-26 Mar,
   last day 28 May. **Spring break came from calendar sites, not the district's PDF: confirm it.** It joins `Q_ENDS`
   on the 2027-28 rollover list.
10. True wording only: the old-backup dialog, the storage-full message, the Reports page labels, "Clear every desk".

## Left for Croix (nothing changed)

- CON-07: Copy pastes 17 into a 15-point IXL column while plans count 15. WIF-08, WIF-11: Focus above Tally, and
  modified lists. TIM-05: one assignment dated past the quarter moves the class a quarter on.
- DAT-05 (+ DAT-03): "Forgot the PIN?" accepts any Full save, and autosave leaves one in Downloads.
- The Students list / tile missing count includes an NHI IXL column whose skills are done (CON-03's other half).
- CHT-05 (imports evenly spaced on line graphs) · SEA-10 · IXL-05 · the mode when every value is equally frequent
  · the Race has no minimum class size.
- "Working in" follows unit numbers: with on-level on Unit 9, Units 5-8 count as assigned unless marked Not assigned.
- **Same-name students stay the weak spot.** IXL accounts are still matched by name and position: if one of two
  namesakes leaves the course, or their class imports its own export, a pick can dangle ("not found in IXL") and a
  kept best can be lost; with a stale roster a pick can even land on the other namesake (`review-probes/app/r02`,
  `r03`). He has no such pair now. The real fix is an ID key for IXL students: a project, to do before a pair shows up.

## Logged (Low, not done)

- A score over 100 % sits in a circle graph's "75-100 %" slice; the box plot draws negative own data left of its
  axis; a histogram's end tick can read 26 for a maximum of 25.
- "Proved" checks single moves only (about 4 % of proved columns fit elsewhere in a two-move fit; same before).
  "Use these weights and categories" still marks its categories proved.
- After one of a same-name pair leaves, the other is shown the old shared-name entry again.
- The Students list's retake sort ranks by skills below goal, not skills needed. Dead code: the `rtNeed` chain in
  the report, seven unused functions (`reports/health/FINDINGS.md`).
- Storage: his realistic year is about 59 % of the browser's limit (DAT-06). TIM-07, GRD-08, IMP-04, IMP-05, CNF-08,
  SEA-08 as reported. CHT-07 and SEA-05 were refuted; CNF-04 and CHT-10 are his recorded rules.

## Verified correct (independent recounts, before any fix)

The Focus grade on 5,000 random gradebooks (34,689 grades, 755 exactly on .5) · the score needed for a letter,
6,668 checks by brute force · IXL points, totals, copy order in every mode and Focus-check verdicts on 6,500 random
classes · what-ifs, the quickest way and the retake rule on about 24,000 students · the Data Lab's statistics on
3,000 sets and 6,966 screens (no name, nothing under 5 drawn) · the Race on 300 histories · date math on 183,360
cases in four time zones · 12,719 weekly reports recounted · every FAST cut score against FLDOE's tables · the CSV
reader on 20,000 files · drop order across 24 permutations · a Board save with 152 planted tokens (none leaked) ·
escaping of every imported string.
