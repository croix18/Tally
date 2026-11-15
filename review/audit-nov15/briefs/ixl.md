# Auditor IXL: the IXL engine and everything that goes to Focus   (tag IXL, directory /home/claude/work/audit/ixl/)

These are the numbers he pastes into the gradebook of record. Nothing in Tally matters more.

## Scope (read all of it)
- app.js "computations" (about lines 393-483): buildRows, startedShare, unitsOf, assignedIdx, openUnits, activeFor,
  eff, mergeBest, points, totalFor, unitColumn.
- app.js "history snapshots" (711-898): population, snapshot, movement, ageDays, ageText, overdue, and what feeds
  "What changed" and the trends. (leaderboardData and the Race belong to the charts auditor.)
- app.js "render", "rail and class header" (1922-2284): the grid's cells, row and column totals, the class bar's
  figures, the Ahead column, Not assigned, the review unit.
- app.js "match fixer" (2285-2326), "copy" (2327-2381: every copy mode, copyRows, the order of rows), "Still owed"
  (2382-2448), "Guide" (2449-2538), "Receipt" (2539-2562), "Focus check" (2563-2685: gbRows, reconcile, the
  corrections list), "settings" (2686-2703).
- students.js: ixlFor, ixlTrend, ixlColOf, focusPts, pendingCopies (how other screens state the same IXL figures).

## Oracle
Parse the IXL Score Grid fixtures yourself in node with your own CSV reader. From the rules in README "How it counts"
and NOTES.md (goal, best score kept, course skips, student skips and modified lists, Not assigned units, the unit the
course is working in, the Ahead column, the on-level review unit), compute every student's points for every unit.
Compare with: points(), the grid cells and totals in the DOM, the Copy text in every mode, Still owed, the receipt,
the Focus check's verdicts and corrections list, the history snapshot (per, pu, ua), movement, and ixlFor. Then
randomize: synthetic grids with random scores, skips, goals and rosters, thousands of cases.

## Edges to attack
- A score exactly at the goal, one below, 0 versus blank (a SmartScore of 0 and "not started" are different), 100.
  Goal edited to 0, 100, a non-integer; a class whose goal differs from its course's default.
- Best score: a newer export with a lower score (SmartScores can drop); best-score kept on, then turned off; an older
  export imported after a newer one; two imports on one day.
- Skills renamed, removed or added between exports; duplicate skill names or codes in one grid; a skill listed in two
  units; a unit whose counted list is empty (everything skipped): any division by zero or "NaN%" on screen?
- Student skips that empty one student's list for a unit: what is copied for that student (blank? 0?), what does the
  Focus check say, what does Still owed print?
- Students: excluded, ignored, withdrawn, new mid-year, in the roster but not in IXL (is a blank or a 0 copied, and is
  that right?), in IXL but not on the roster, typed aliases ("LAST, FIRST = IXL name"), two students with the same
  name (uniqueNames, 14 Nov).
- Copy order: the rows must come out in the open Focus gradebook's own order (the Critical fix of 22 Oct). Prove it
  still holds after a student leaves or joins, with same-name students, with a gradebook longer or shorter than the
  grid, with a pasted roster and no gradebook, and for every copy mode. What exactly does the toast claim, and is it
  true (how many were copied, which column)?
- "Working in" changes, the Ahead column, the review unit on-level, a unit marked Not assigned, hidden units.
- The Focus check: Focus cell blank, 0, NHI, excused, over the column's max, a decimal; a Focus IXL column whose max
  is not the unit's number of skills; "N up since copy" and "N off" badge arithmetic; receipts after skips change.
- Pooled course exports versus a class's own export: the same student must get the same points either way.
