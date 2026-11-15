# Auditor IXL: coverage (Tally deep audit, 15 Nov 2026)

## Read, line by line
- app.js: norm, ixlDisplay, ixlList, parseRosterText (179-230); buildRows and the computations (393-483: skillKey,
  startedShare, unitsOf, openUnits, activeFor, totalFor, eff, ixlKeyAt, mergeBest, points); the IXL import's section build
  (560-600); history (711-898: population, assignedIdx, snapshot, resnapshotPrep, snapTotals, movement, assignedUnitsForPrep,
  leaderboardData, fmtDate, localDay, ageDays, ageText, dataDate, overdue, lbMarkup); render, rail, class header, notices,
  renderBar, renderRosterPanel, renderGrid (1922-2284); match fixer, copy, Still owed, Guide, Receipt, Focus check, matchReport
  (2285-2703); materialize (1783-1797); the Settings save (2905-2917); uniqueNames (172).
- students.js: findStudent, classStudents, ixlFor, ixlTrend, studentBooks (15-60); ixlColOf, focusPts, pendingCopies, the start of
  quickestPath (535-560); retakeStatus (352-371).
- home.js: digestFor, digestMarkup (165-228).
- quarters.js: unitClosed, qSec, aQuarter / unitQuarter / unitColumnQuarters, gbQuarter (as far as they decide what is checked).

## The oracle (probes/fuzz-oracle.js)
Written from README "How it counts" and NOTES, not from the code: my own CSV reader; units in first-appearance order; "Unit N"
numbering; assigned = course mark, else not a review unit and `num <= Working in`; a student's list = unit skills minus course skips
minus their own skips; score = max(current, best) when best is on; a point = score >= goal (0 never counts, blank never counts);
students keyed by name + occurrence; copy rows = the Focus gradebook's students in its order, blank for one not in IXL; without a
gradebook the pasted roster's order; without a roster every IXL student by last name, with names; Focus-check status from the
written rule (blank or NHI or excused against 0, a number within 0.01).

Compared, all inside one page session:
- (a) the scrubbed real class (fixtures/ixl_7T1A_scrubbed…csv, goal 67, 17 units): every unit's skill count and every student's
  points equal my CSV oracle (after learning that the parser merges a skill listed twice in one unit, GSB in Unit 10, by the best
  of the two rows: intended, parser.js 268).
- (b) 6,500+ randomized synthetic classes over five seeds (1-28 students, 1-5 units of 0-8 skills, ~30% blanks, 0s and 100s,
  scores planted at the goal and one below, goals 1/59/60/61/66/67/68/100, best scores on/off with random earlier bests, ~12%
  course skips, per-student skip lists, review units 0-1, Working in anywhere incl. none and past the last unit, random
  Assigned / Not assigned marks, gradebooks with 90% of the students in a shuffled order plus Focus-only students, IXL columns with
  wrong maxes, blanks, NHI, excused, decimals, values over the max). About 250,000 student-unit cells. Checked per case:
  points(), totalFor(), unitsOf() totals and assigned flags, ixlFor done/poss, snapshot per / pu / ua, unitColumn in points,
  names and ID modes (rows in the gradebook's order; pasted-roster order with no gradebook; last-name order with names and the
  "/own" suffix with no roster), reconcile's status for every row, `maxOK`, no reconcile for an unassigned unit, and (every 25th
  case) every grid cell's "p/own" text in the DOM and the row count. **0 disagreements** apart from IXL-01 (blank IDs), which the
  harness then tolerates.
- Clean copy: the harness and all 13 probes rerun against /home/claude/work/audit/base: the probes all exit 1, the harness 0 (one
  unexplained failure in five runs, not reproducible with the same seed; see FINDINGS Suspicions).

## Verified correct (beyond the oracle)
- 0 versus blank: a SmartScore of 0 never earns a point, is shown as 0 (not "not started"), and Still owed lists it under "Below
  goal (0)"; blank is "Not started". The goal is clamped to an integer 1-100 (clampThr), so "goal 0" and "67.5" cannot reach the
  engine.
- Best score: a lower newer score keeps the point (eff max); an older export asks before replacing, keeps the newer best; best off
  shows the current score; the grid's "Best score N from an earlier export" tooltip matches eff.
- Two imports on one day replace that day's snapshot (no duplicate dates); history capped at 60.
- A unit whose counted list is empty: Copy refuses with a message, grid shows 0/0 with no NaN, the footer 0.0, the Focus check
  goes to setup ("N skills fewer than Focus"), Still owed, ixlFor and openUnits drop it (`u.total` filters). No division by zero
  or "NaN%" reached the screen in the fuzz or the fixture.
- Copy order with a gradebook: rows follow the gradebook after a student leaves (they are dropped) or joins in the gradebook
  (they get their row), with same-name pairs marked by uniqueNames (ambiguous → blank row until picked), with a gradebook shorter
  or longer than the IXL list, and for all three copy modes (order verified in the fuzz; IDs are IXL-01). Exceptions found:
  IXL-06 (an unreadable gradebook name) and IXL-11 (a roster pasted after the gradebook).
- Focus check arithmetic: "N off" = differ + missing (+ setup when the max differs), "N up since copy" = stale, "kept" =
  accepted; blank/NHI/excused against Tally 0; decimals and values over the max are "differ". Matches the oracle on every row.
- Ahead column: sums only units past Working in that are not hidden; "nobody yet" when none; counts students correctly.
- Pooled course exports: read materialize / poolRows / poolLeftovers; a pool class's keys are section-local and its best scores
  survive a switch to its own export when names are unique (same mechanism as IXL-05 for a same-name pair). Not fuzzed.

## Not covered / partly covered
- The pooled path was not fuzzed (only read and reasoned about); tests/pool.js covers its happy path.
- Closed and kept quarters: I relied on unitClosed / openUnits as written; with nothing closed in my cases, the "Q1 closed" tags,
  the qArchive merge and closed-unit exclusion from the Focus check were not exercised by the oracle.
- ixlTrend and the student page's IXL charts: read, not compared numerically (they read the same snapshots; IXL-02, IXL-05, IXL-13
  feed them wrong values in those cases).
- The Race itself (leaderboardData ranking, lbMarkup) belongs to the charts auditor; I compared only its movers/measured with the
  digest (IXL-12).
- Still owed and the Guide were read but their printed pages were not rendered (openPrint); findings there are from code (C-7).
- copyUnit's clipboard path (legacyCopy / navigator.clipboard / showCopyBox) was exercised only through headless Chromium.
- owedWork() (NOTES 3 Nov) for the IXL-08 gap was not traced.
