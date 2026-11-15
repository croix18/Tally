# TIM coverage: quarters, dates and time (15 Nov 2026)

Scope read in full: quarters.js (every line, folded), GRADES_SPEC.md §7, the import path that decides a gradebook's
quarter (app.js:596-662), `gradeSnapshot`/`snapBasis`/`prevGradeSnap` (grades.js:160-181), `digestFor`'s history picks
(home.js:165-183), and every date/time site found by `tools/sites.js` (472 lines of context over app.js, grades.js,
charts.js, home.js, seating.js, students.js, conference.js, parser.js, scrub.src.html). The pattern list in sites.js
covers the brief's list plus getDay/setDate/getTime/T12:00/getFullYear/60000/quarterOf/ends/Q_ENDS/importedAt/exportedAt;
it misses `fmtDate`, `getMonth` and `Date.parse`, which I grepped separately (no further sites).

## Verified correct (with how)

**Independent oracle, `probes/00-oracle-fuzz.js` (183,360 comparisons, 0 disagreements).** My own civil-date
arithmetic (UTC day numbers, `Intl.DateTimeFormat` with `timeZone` for "today") against Tally in four time zones
(America/New_York, UTC, Pacific/Honolulu, Asia/Tokyo) at 24 clock instants each: 11:59 pm and 12:01 am around every
quarter end (9 Oct, 18 Dec, 4 Mar, 28 May), both 2027 daylight-saving changes (14 Mar 1:30 and 3:30, 15 Mar 0:30;
7 Nov 0:30 and 1:30, 8 Nov 23:30), 1 Nov 2026, New Year 23:59/00:01, 29 Feb 2028 evening, the first school day of
Quarter 2, a Saturday 8 pm, a Sunday 7:30 pm and 11:30 pm, July and August 2027. Functions and inputs: `todayISO`;
`ageDays`, `weekOf`, `daysBetween`, `quarterOf` on 312 random days Jul 2026-Sep 2028 plus each end and its neighbours;
`localDayOf` on instants 0-2,100 hours back; `mdToISO` on 307 random and edge strings (M/D, M/D/YY, M/D/YYYY, 13/1,
0/10, 7/1, 6/30, padded); `testDays` weekday names; `quarterDue`; `isDay` on 29 Feb 2027/2028 and 31 Nov.
Result: all agree, so these are right in every zone, across 23- and 25-hour days, New Year and leap day:
- the end date is inclusive in `quarterOf` (`<=`), and the same in `quarterDue` (`>` end), `closedEarly` (`<=` end),
  `nextTest` (`>=` day), the Data Lab's quarter filter (`d > previous end`, app.js:1186). One rule everywhere.
- `ageDays` (local midnights, rounded) and `daysBetween` (noon to noon) have no off-by-one across DST; `weekOf` puts a
  weekend in the week ahead, as NOTES.md:795 decides; `testDays` builds at local noon (no UTC-midnight slip).
- `new Date('YYYY-MM-DD')` (UTC midnight): no live instance with a bare day string. Every day-string parse uses
  `'T12:00:00'` or `new Date(y, m - 1, d)`; `localDayOf`/`localDay` receive only full ISO instants (no code writes a
  bare day into `importedAt`, `at`, `rosterAt`, `savedAt`). It would bite only on a hand-edited file.

**Quarter engine, by scenario (scrubbed fixtures, synthetic edits; probes in probes/):**
- A Q2 export before Q1 is closed: `keepOutgoing` keeps Q1 (all 13 columns, finals equal to Focus's Grade column),
  `liveQuarter` 2, Unit 1 past, Unit 2 owed through its Q2 "Unit 2 IXL Review" column (unit with columns in both quarters).
- Same, with an assignment title repeated in both quarters ("Notebook Check"): kept correctly (`probes/c06-…`, passes;
  my hypothesis that the name filter drops it was wrong: the filter picks quarters, `mergeArchive` takes every column).
- Q1 closed then the Q2 export; reopen (only the latest closes); closing with the dialog's pre-ticks (`unitsDueIn`);
  closing Q1 and Q2 in sequence; a hand-set unit tick for a unit whose column is in the next quarter stays owed.
- A Q1 file arriving after Q2 (22 Oct fix): no regression. Suites run green on this copy: `quarter-units` (12),
  `audit-oct22` (22), `students-quarters` (63), `test-dates` (33).
- History: two imports on one day replace that day's snapshot per quarter; `prevGradeSnap` ignores future-dated
  snapshots (Sliding stays right under a wrong clock; the digest does not: TIM-07).
- Every place a UTC day is shown or compared is listed in TIM-01 (14 sites); all other day displays use the local day.

## Found (see FINDINGS.md)
TIM-01 UTC-day stamps (Medium) · TIM-02 quarter-date typing/order (Medium) · TIM-03 close dialog uses import day
(Medium) · TIM-04 unit-number pacing assumption in `unitClosed` (High) · TIM-05 one future-dated column flips the
quarter (Medium) · TIM-07 future snapshot blinds the digest (Low) · TIM-08 Overview quarter label (Low) · TIM-09 test
last-day typing (Low) · TIM-10 reopen message (Low). Plus 5 suspicions and 6 cleanup items.

## Not covered
- The rollover itself (parked); mdToISO's summer-school July dates belong to it.
- Printed pages' dates (weekly report header, conference form, What-changed print) were read in code, not printed.
- `mergeArchives` on backup restore with conflicting copies, and Sync, were read but not exercised.
- The Data Lab/Race "as of" lines and the grade-line charts across a quarter break (charts auditor's area) were only read.
- The suites were not rerun under other time zones (the probes cover the engine in four).
- Whether Focus puts break assignments or late work in the quarter Tally files them in (TIM-05, suspicion 1): needs Croix.
