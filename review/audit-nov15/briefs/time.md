# Auditor TIM: quarters, dates and time   (tag TIM, directory /home/claude/work/audit/time/)

## Scope (read all of it)
- quarters.js, all of it; GRADES_SPEC.md section 7.
- Every date or time computation anywhere else. Grep all sources for: `new Date`, `Date.now`, `toISOString`,
  `getTimezoneOffset`, `86400000`, `864e5`, `slice(0, 10)`, `localDayOf`, `todayISO`, `ageDays`, `ageText`, `overdue`,
  `weekOf`, `daysBetween`, `mdToISO`, `aDate`, `remindDays`, `lastModified`, `toLocale`. List every site and classify
  it: local day or UTC day, and whether that is right there.

## Method
Playwright contexts with `timezoneId` (America/New_York is his; also UTC, Pacific/Honolulu and Asia/Tokyo, to expose a
UTC / local mix-up) and a controlled clock (`page.clock.install` / `setFixedTime`; Playwright here is 1.63). Put the
clock at: 11:59 pm and 12:01 am around each quarter end (9 Oct, 18 Dec, 4 Mar, 28 May); the daylight-saving changes
(Sun 14 Mar 2027 and Sun 7 Nov 2027; 1 Nov 2026 is just past); New Year; 29 Feb 2028; the first day of a quarter; a
weekend; July; and August 2027 (the rollover itself is known: report only new, concrete consequences). Write your own
date oracle and compare.

## What to prove
- Which quarter a date belongs to: is the end date inclusive, everywhere, the same way? `<` versus `<=` at each site.
- Ages ("3 days ago", "N days old", overdue reminders) across a 23-hour and a 25-hour day: any off-by-one?
- `new Date('YYYY-MM-DD')` is UTC midnight, which is the previous local day in US time zones. Find every instance and
  prove whether it bites.
- Due dates and day strings without a year (mdToISO): an assignment due 01/08 in a Quarter 2 gradebook; a Quarter 3
  gradebook holding late work due 12/15; sorting and comparing such strings.
- Unit to quarter (unitQuarter, unitQuarterOf, unitColumnQuarters, unitClosed, unitsDueIn): a unit that spans two
  quarters; a unit with a column in both quarters' gradebooks; no IXL column at all; a hand-set mapping; classes in
  different quarters (one class's gradebook an export behind); the two courses on different pacing.
- closeQuarter, reopenQuarter, archiveQuarter, keepOutgoing, quarterAfterImport, mergeArchive(s): closing twice;
  reopening; a Quarter 1 file arriving after Quarter 2 (fixed 22 Oct: any regression?); an early Quarter 2 export
  before Quarter 1 is closed; end dates edited in Settings (invalid, out of order, typed as 10/9/26).
- liveQuarter against currentQuarter: every place a quarter's name is shown must name the quarter of the data under
  it.
- History: two imports on one day; an export whose file name is dated before existing history; a computer whose clock
  is wrong (a future date in history): what do the trends, "since the last import" and the reminders then say?
- Test dates (testDatesOf, nextTest, testDays, quarterDue, closedEarly): the count of days it states, weekends,
  a test dated today, yesterday, in a closed quarter.
