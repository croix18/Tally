# TIM findings: quarters, dates and time (15 Nov 2026)

Every probe runs with `TALLY_REPO=<repo> node probes/NN-slug.js` (default: this auditor's `repo/`). Shared helper:
`probes/_tim.js` (opens the test build in a chosen time zone at a fixed clock with `page.clock.setFixedTime`;
`importGb` answers the class picker and the category check). There is no TIM-06: that hypothesis was disproved
(`probes/c06-keep-outgoing-same-name.js` passes and is kept as a regression check). `probes/00-oracle-fuzz.js` is the
coverage harness (see COVERAGE.md).

### TIM-01  Stamps from toISOString() are shown and compared by their UTC day: after 7 pm Eastern, Tally names tomorrow
- Class: WRONG-INFO
- Severity: Medium
- Where: the `(x.at || '').slice(0, 10)` / `x.at.slice(0, 10)` pattern on an ISO instant, at 14 sites: home.js:105
  (Overview "closed early on"), quarters.js:249 and :260 `openQuarters` ("closed <day>" and the `soon` test that tags an
  early close), grades.js:502 and :552 (Grades header / notice "closed <day>"), students.js:504 (student page),
  app.js:2039, :2113, :2196, :2624, :2651 (receipts: "copied <day>", the Focus check's "matches what you copied <day>"),
  app.js:2624 and :2634 (kept-Focus overrides "on <day>"), app.js:2701 ("Roster pasted <day>"), home.js:60 (roster-age
  reminder: compares the UTC day of `rosterAt` with the export day), app.js:1985 (Board save day), seating.js:313
  ("saved <day>"), app.js:1625 (download file name fallback).
- Trigger: any of these actions done after 7 pm EST / 8 pm EDT (Copy to Focus, closing a quarter, pasting a roster,
  saving a seating chart). Evening grading at home is routine; seen every such evening until midnight.
- Observed (Fri 18 Dec 2026, 8:30 pm New York, Quarter 2 closed early that evening, a unit copied to Focus that
  evening): the unit link reads "copied Dec 19"; the Overview reads "Quarter 2 was closed early on Dec 19. It runs until
  Dec 18" (a close dated after the end it was early for); the Quarters dialog reads "Quarter 2 closed Dec 19" and has no
  "early, it ends Dec 18" tag, although `closedEarly()` (local day) returns 2 and the Overview calls it early.
- Expected: the local day, Dec 18, everywhere, and the dialog's early tag agreeing with `closedEarly()`. The repo has
  already decided this twice: `localDayOf` exists for it ("a 9 pm import is today, not tomorrow's UTC date",
  quarters.js:127), seating.js:325 was fixed for the same bug ("it was the UTC day: tomorrow, after 7 pm Eastern"),
  AUDIT_PLAN.md Phase 2 item 7 fixed the gradebook-age reminder, NOTES.md:1322 fixed a test for it. These sites were missed.
- Repro: probes/01-utc-day-stamps.js
  ```
  OBSERVED: today 2026-12-18 | unit link: "copied Dec 19" | Overview: "Quarter 2 was closed early on Dec 19. It runs until Dec 18, so its missing work " | Quarters dialog: "Quarter 1 closed Oct 12reopen Quarter 2 firstQuarter 2 closed Dec 19Reopen"
  EXPECTED: every date says Dec 18 (the local day); the dialog tags Quarter 2 "early, it ends Dec 18", as closedEarly() = 2 and the Overview notice do
  FAIL the "copied" link names the local day
  FAIL the Overview "closed early on" names the local day
  FAIL the Quarters dialog says "closed Dec 18"
  FAIL the Quarters dialog tags the early close, as closedEarly() does
  ```
- Suggested fix: replace each `(v || '').slice(0, 10)` on an ISO instant with `localDayOf(v)` (it returns '' for empty
  or bad input, as the slice does; `localDayOf` is a hoisted declaration, safe everywhere). Do not touch `slice(0, 10)`
  on values that are already day strings (`sec.date`, `h.date`, `ageDays`' own slice). Nothing else reads these strings,
  so nothing can break; stored data is unchanged.
- Confidence: High. Only a decision that "UTC day is fine for stamps" would change it, and the repo decided the opposite.

### TIM-02  Typing a quarter end date commits the first keystroke, redraws the dialog, and accepts any order
- Class: FRAGILE
- Severity: Medium
- Where: quarters.js: `openQuarters` (line 254), the `[data-qend]` change handler (line 309): `if (!ISO_RE.test(inp.value)) return; q.ends[...] = inp.value; ...; save(); again();`
- Trigger: the teacher edits a quarter's end in the Quarters dialog (or Settings → Quarters) by typing rather than with
  the calendar pop-up, e.g. the district moves a day. Chrome's date box fires `change` as soon as the segments form a
  whole date, i.e. on the first keystroke. Uncommon (dates change rarely), but every typed edit hits it.
- Observed: clicking Quarter 2's end and typing 1 2 1 7 2 0 2 6 from the month segment: the first "1" turns the box into
  01/18/2026, the handler saves `ends[1] = '2026-01-18'`, recomputes every grade snapshot and redraws the dialog; focus
  goes to the page, so the other seven keys do nothing. Quarter 2 now "ends" before Quarter 1 does: an assignment due
  12/10 is filed in Quarter 3, `quarterDue()` says Quarter 2 has ended, the open gradebook becomes "Quarter 3"
  (`gbQuarter`/`liveQuarter`), and `unitClosed` treats this quarter's units as a past quarter's (no "still owed", no
  retake hold) until he notices the date. The handler also accepts any order outright (1 Sep 2026 for Quarter 2's end).
  Putting the date back does not undo it: each change re-runs `gradeSnapshot` for every class, and the snapshot taken
  while the dates were wrong is filed under the wrong quarter ("2026-11-15:Q3" beside "2026-11-15:Q2") and stays in
  `gradeHistory` (it is only replaced by a snapshot of the same day *and* quarter), so the student page's grade chart
  draws a quarter mark there and the Data Lab's grade lines carry a stray point.
- Expected: a half-typed date is not committed, and an end date before the previous quarter's end (or after the next
  one's) is refused with a message. `quarterOf` (quarters.js:71) takes the first end that is >= the day, so it is only
  correct when the four ends are in order; nothing enforces that. GRADES_SPEC §7 says the dates are "editable in the
  Quarters dialog": an edit should not be able to put them out of order.
- Repro: probes/02-quarter-date-typing.js
  ```
  OBSERVED: Quarter 2 end after each keystroke: 2026-01-18 2026-01-18 2026-01-18 2026-01-18 2026-01-18 2026-01-18 2026-01-18 2026-01-18 | ends ["2026-10-09","2026-01-18","2027-03-04","2027-05-28"] | an assignment due 12/10 is in Quarter 3 | focus on BODY
  EXPECTED: Quarter 2 ends 2026-12-17 (or is unchanged while the date is half typed); never a day before Quarter 1 ends; 12/10 stays Quarter 2
  FAIL the typed date (or the old one) is what is kept
  FAIL no half-typed date before Quarter 1's end is ever committed
  OBSERVED: after choosing 1 Sep 2026 for Quarter 2 end: ["2026-10-09","2026-09-01","2027-03-04","2027-05-28"]
  EXPECTED: refused (Quarter 1 ends 9 Oct): the four ends must be in order
  FAIL quarter ends stay in order
  OBSERVED: grade history before "2026-11-15:Q1 2026-11-15:Q2" | after the dates are put back {"ends":"2026-10-09,2026-12-18,2027-03-04,2027-05-28","h":"2026-11-15:Q1 2026-11-15:Q2 2026-11-15:Q3"}
  EXPECTED: the history is as before (one Quarter 2 snapshot for today); no Quarter 3 snapshot dated 15 Nov
  FAIL no stray Quarter 3 snapshot is left in the grade history
  ```
- Suggested fix: listen on `blur` (or `change` plus a check that the input no longer has focus) instead of committing
  on every `change`; and refuse a value that is not strictly between its neighbours (`i > 0 && v <= ends[i-1]` or
  `i < 3 && v >= ends[i+1]`), resetting the box and showing a one-line warning. Also reject a year outside 2000–2099
  (verified: typing 10/09/26 in a Chrome date box gives the value "0026-10-09", which `ISO_RE` accepts). Also make `quarters()` (line 15) fall back to `Q_ENDS` when the stored
  ends are out of order, so a bad save from before the fix cannot persist. A snapshot written for today's import under a quarter other than
  `gbQuarter` should be dropped when the dates change (filter `h.date === today && h.q !== q`). Breaks nothing: valid edits are unchanged.
- Confidence: High for the out-of-order acceptance; High that Chrome fires `change` per keystroke (seen in Playwright's
  Chromium 1.63; the real Chrome on his laptop uses the same date control).

### TIM-03  Close-quarter dialog dates a gradebook by its import, not its export: a pre-end export reads as final
- Class: WRONG-INFO
- Severity: Medium
- Where: quarters.js: `openQuarters` (line 254): `isStale = s => liveN(s) > 0 && localDayOf(s.grades.importedAt) < q.ends[n - 1]`
  (line 262) and the row label `'exported ' + esc(fmtDate(localDayOf(gb.importedAt)))` (line 266).
- Trigger: he exports from Focus before the quarter's last day and imports after it (NOTES.md:799 names the habit:
  "Friday's export brought in on Monday"). Once per quarter per class whenever the export predates the end.
- Observed: a gradebook Focus wrote Thu 8 Oct (file time on disk, kept as `gb.exportedAt`), imported Mon 12 Oct, Quarter 1
  ending Fri 9 Oct: the Close Quarter 1 dialog's row says "exported Oct 12" and there is no "exported before Quarter 1
  ended … export Quarter 1 from Focus and import it first" warning. Closing then freezes Thursday's grades as the Quarter 1
  finals (shown on student pages, conference forms, the Students list) with no prompt.
- Expected: "exported Oct 8" and the warning. NOTES.md:799 (decided): "Focus is dated by the file: `gb.exportedAt` (the
  file's time on disk) before `importedAt` … Friday's export brought in on Monday is Friday's numbers." The warning's own
  text is about when the file was exported; the import day cannot answer it.
- Repro: probes/03-close-stale-by-import-day.js
  ```
  OBSERVED: {"exportedAt":"2026-10-08T19:00:00.000Z","importedAt":"2026-10-12T12:30:00.000Z","title":"Close Quarter 1","row":"1st Period · Accelerated13 assignmentsexported Oct 12","warn":false,"warnText":""}
  EXPECTED: the row says "exported Oct 8" and the dialog warns the gradebook was exported before Quarter 1 ended (Oct 9)
  FAIL the row names the day Focus wrote the file
  FAIL the dialog warns the export predates the end of the quarter
  ```
- Suggested fix: in `openQuarters` use `const gbDay = g => localDayOf(g.exportedAt || g.importedAt)` for both `isStale` and
  the row label (the same rule `weeklyReport` uses at grades.js:688 and :1001). Related, same rule not applied: the
  Overview's "Focus gradebook is N days old" reminder (home.js:59) and the "Focus of <day>" lines (app.js:2048,
  grades.js:502, students.js:721) still use `importedAt`; decide whether they should follow NOTES.md:799 too. Also
  consider `<=`: an export made during the quarter's last day may still miss that day's grading.
- Confidence: High on the mismatch with NOTES.md:799; Medium on severity (the Focus gradebook itself stays right).

### TIM-04  In Quarter 3 the unit being taught counts as a past quarter's unit: unitClosed assumes number-order pacing
- Class: WRONG-INFO (contradicts a recorded decision; see also DECISION note in Suggested fix)
- Severity: High
- Where: quarters.js: `unitClosed` (line 102), its last line (108):
  `return u.num > 0 && unitsOf(sec).some(v => { const qv = unitQuarter(sec, v) || qs[v.name]; return v.num > u.num && qv && qv < live; });`
- Trigger: every class, every week of a quarter until the current unit's Focus IXL column exists. Tally's own 2026-27
  test dates (quarters.js:215, `TEST_DATES`) show neither course runs in number order: accelerated tests Unit 11 on
  11 Dec (Q2), then Units 7, 10, 12, 8-9 in Q3; on-level tests Units 9, 10, 8 in Q2, then 5, 7, 11 in Q3 and 6 in Q4.
  From the first Quarter 3 export (early January 2027) every lower-numbered unit without a column yet is "past".
- Observed: accelerated class; Quarter 1 and Quarter 2 closed the normal way (Q2 ticked Units 2, 3 and 11, pre-ticked by
  `unitsDueIn`); first Q3 export on 12 Jan with no IXL column yet; Units 7 and 11 marked assigned. `unitClosed` is true
  for Units 7, 8 and 10, `openUnits` is empty. Every reader that filters with `!unitClosed` drops them: the still-owed
  print (`printStillOwed`, app.js:2406), the weekly report's IXL tile and lines (grades.js:689, :726, :885), the digest
  (home.js:176), the grid's quarter tag (app.js:2191 tags Unit 7 as an earlier quarter's), the class's open units
  (app.js:459), retake "IXL at goal" (students.js:363).
- Expected: Unit 7 (test 14 Jan) is owed and open. The code's own comment (quarters.js:98-101) and NOTES.md:1241 say a
  quarter closed in Tally "settled its units when it closed: one left unticked then stays owed": Unit 7 was not ticked
  for Q2, yet it is past. The fallback was meant for a Q2 export arriving before Q1 is closed (NOTES.md:1239), and even
  there its premise (a later unit number means later teaching) is false for both courses.
- Repro: probes/04-unit-order-fallback.js
  ```
  OBSERVED: Q2 closed with ["Unit 2","Unit 3","Unit 11"] | Q3: {"live":3,"cq":3,"u7closed":true,"u7q":null,"u11q":2,"open":[],"u8closed":true,"u10closed":true,"u12closed":false}
  EXPECTED: Unit 7 (taught now, test 14 Jan) is not closed and is among the open units; Units 8-10 are not closed either
  FAIL Unit 7 is not treated as a past quarter's unit
  FAIL Unit 7 is an open unit
  FAIL Units 8 and 10 (taught in Q3) are not closed
  ```
- Suggested fix: smallest: require the later unit's quarter to be still open, `qv && qv < live && !qClosed(qv)` (a closed
  quarter settled its units, as the line above already does for `q`). Better (a DECISION for Croix): order units by the
  course's test dates (`testDatesOf(prep)`, `testUnitNums`) instead of by number, or drop the fallback and let a unit
  without a column stay owed. The first change cannot make anything that was owed disappear; it can only bring back
  units hidden by the fallback after a proper close.
- Confidence: High that the rule fires as shown; Medium on severity until checked when the Unit 7 IXL column usually
  appears in Focus (the Q2 fixture's Unit 3 IXL column is assigned 10/30, due 11/08: about a week before the unit ends).

### TIM-05  One assignment due after the quarter's end moves the whole class into the next quarter mid-quarter
- Class: WRONG-INFO
- Severity: Medium
- Where: quarters.js: `gbQuarter` (line 111) takes the latest quarter of any assignment; `liveQuarter` (line 133),
  `unitClosed` (line 102), `qSec` (line 115), `classQuarters` (line 138) all follow it.
- Trigger: an assignment in the open Focus gradebook whose due date falls after the quarter's end, e.g. a winter-break
  packet assigned 12/14 and due 01/05, or a due-date slip in Focus. Whether Focus lists such an assignment in the
  Quarter 2 export depends on how Focus files it (I could not verify Focus's rule); if it does, it is seasonal and
  certain (every break). A typo in a due date gives the same result at any time.
- Observed (15 Dec 2026, Quarter 1 closed, the Quarter 2 fixture gradebook plus one blank "Winter Break Packet",
  assigned 12/14, due 01/05): `liveQuarter` goes 2 to 3, so the class's screens say "Quarter 3"; `classQuarters` loses
  Quarter 2 ([1, 3]); `unitClosed(Unit 3)` goes false to true (Unit 3's IXL column is in Q2, now "an earlier, still-open
  quarter"), so Unit 3 leaves the open units, the still-owed print, the weekly report's IXL lines and the retake check,
  while Unit 3 is being taught and graded.
- Expected: Quarter 2 until Quarter 2 ends. A gradebook cannot be in a quarter that has not started yet; a single
  future-dated column says when one assignment is due, not where the class is.
- Repro: probes/05-one-late-due-date-flips-quarter.js
  ```
  OBSERVED: {"before":{"live":2,"u3":false,"q2tab":true,"owed":["Unit 2","Unit 3"]},"after":{"live":3,"u3":true,"classQuarters":[1,3],"owed":["Unit 2"],"header":"Quarter 3"}}
  EXPECTED: still Quarter 2 after the break packet is added: Unit 3 open and owed, the class listed in Quarter 2
  FAIL the class is still in Quarter 2
  FAIL Unit 3 (Quarter 2 work) is still owed
  FAIL the class still has a Quarter 2
  ```
- Suggested fix: in `gbQuarter`, ignore assignments dated after today when at least one assignment is dated today or
  earlier (`const today = todayISO(); const past = gb.assignments.filter(a => (aDate(a, gb) || '') <= today);` then take
  the max over `past.length ? past : gb.assignments`). A real early Q3 export still reads Q3 (its graded work is dated in
  Q3), a Q1 file stays Q1 (TIM's oracle runs pass unchanged). Same idea for the `lastDue` "older gradebook" test
  (app.js:610), which already looks only at graded columns.
- Confidence: Medium. High that the code does this; what Focus exports for a break assignment would change the severity.

### TIM-07  A grade snapshot dated in the future (one import under a wrong clock) blinds "What changed this week" for a year
- Class: WRONG-INFO
- Severity: Low
- Where: home.js: `digestFor` (line 165), `const gc0 = gh[gh.length - 1]` (line 181): the digest's "now" is the last
  snapshot by date, not the current gradebook's; grades.js: `gradeSnapshot` (line 168) dates a snapshot by
  `localDayOf(gb.importedAt)` with no check against today.
- Trigger: one gradebook import while the computer's clock is wrong (a laptop whose clock reset, a panel never synced).
  Rare; the brief asked for it. The same shape follows a Full save from another device whose clock ran ahead.
- Observed: imported under a clock reading 10 Nov 2027, then with the clock right on 10 Nov and 13 Nov 2026: history
  `2026-11-10:Q2, 2026-11-13:Q2, 2027-11-10:Q1`; the digest reads "Focus: needs two gradebook imports on different days"
  after two imports on different days, and will until Nov 2027. (`prevGradeSnap`, used by Sliding, is right: it filters
  `x.date < cur`.)
- Expected: the digest compares the latest import (13 Nov) with the one before it in the same quarter, as Sliding does.
- Repro: probes/07-future-snapshot-sticks.js
  ```
  OBSERVED: {"gh":["2026-11-10:Q2","2026-11-13:Q2","2027-11-10:Q1"],"digestBase":"2027-11-10","digestGrades":null,"digest":" IXL IXL: needs two imports on different days. Focus Focus: needs two gradebook imports on different days. ","prev":"2026-11-10"}
  EXPECTED: the digest compares the 13 Nov snapshot with the 10 Nov one; no snapshot is dated after today (2026-11-13)
  FAIL the digest's "now" is the latest import, not a future-dated snapshot
  ```
- Suggested fix: in `digestFor`, take `gc0` as the snapshot of the live gradebook (`gh.filter(h => h.at === sec.grades.importedAt).pop()`,
  falling back to the last) instead of the last by date; optionally drop snapshots dated after `todayISO()` on load.
  Safe: with a sane clock the live gradebook's snapshot is the last one.
- Confidence: High that it happens; the trigger is rare.

### TIM-08  Overview header says "Quarter 1" over Quarter 2 grades until Quarter 1 is closed
- Class: WRONG-INFO
- Severity: Low
- Where: home.js: the Overview's meta line, `${esc(Q_NAMES[cq - 1])}` with `cq = currentQuarter()` (line 76; the meta line
  is built further down in the same render).
- Trigger: the days between a quarter's end and the teacher closing it in Tally, once a new-quarter export is in (every
  quarter change; NOTES.md:523 explains why closing waits for him).
- Observed: 20 Oct 2026, Quarter 1 ended and not closed, the class's Q2 export imported (Q1 kept): `liveQuarter` and
  `liveQ()` are 2, the cards show Q2 grades, the header reads "IXL as of Sep 26 · Quarter 1".
- Expected: "Quarter 2". Decided 22 Oct 2026 (quarters.js:131 comment, AUDIT_PLAN Phase 2 item 6): "a Q2 export that
  arrived before Q1 was closed is Quarter 2, not 'Quarter 1'"; `liveQ()` exists for the across-classes name and the Data
  Lab already uses it (NOTES.md:1408). The Students header's wording in a *mixed* state is known backlog (NOTES.md:1496);
  this is the Overview, in the uniform state.
- Repro: probes/08-overview-quarter-label.js
  ```
  OBSERVED: {"live":2,"liveQ":2,"cq":1,"metas":["IXL as of Sep 26 · Quarter 1"]}
  EXPECTED: the Overview names Quarter 2, the quarter of the grades under it (liveQ() = 2)
  FAIL the Overview header names Quarter 2
  ```
- Suggested fix: use `liveQ()` for the header's name (keep `currentQuarter()` for the close prompt, which is about
  Tally's open quarter). Also grades.js:1053 (Reports page "No Quarter N grades in Tally yet") uses `currentQuarter()`.
- Confidence: High; Low severity because the "close Quarter 1" prompt above it explains the state.

### TIM-09  Test dates: typing a new last day for a two-day test erases the last day
- Class: FRAGILE
- Severity: Low
- Where: quarters.js: `openTestDates` (line 295), the input change handler (line 367): `list[i] = testRow({ ...list[i], [f]: inp.value }); if (f === 'from' || f === 'to') inp.closest('.tdrow').querySelector('[data-f="to"]').value = list[i].to; save(); mark();`
  with `testRow` (line 213) keeping `to` only when `to > from`.
- Trigger: changing a two-day test's last day by typing (Chrome fires `change` per keystroke, see TIM-02). Typing the
  day "21" over "20" first makes "11/02", which is before the first day (11/19): `testRow` clears it and the handler
  writes '' into the box under the cursor, so the second keystroke has nothing to complete. The same happens typing a
  new first day whose intermediate value passes the last day. Typing a two-digit year (10/09/26) leaves "0026-10-09",
  which `isDay` rejects (JavaScript reads year 26 as 1926), so the row silently loses its day while the box still shows it. Uncommon (test dates move a few times a year).
- Observed: on-level Unit 10 (19-20 Nov), typed "21" in the last day's day segment, then Done: `to` is '' (saved); the
  weekly report prints "Thursday, Nov 19" only, and on Fri 20 Nov (the second test day) `nextTest` already names the
  next unit.
- Expected: the last day is 21 Nov (or stays 20 Nov). The rule "a last day not after the day is cleared" (comment at
  line 368) is for a finished entry, not a half-typed one.
- Repro: probes/09-test-last-day-typing.js
  ```
  OBSERVED: {"row":{"unit":"Unit 10","title":"Equations and Inequalities","from":"2026-11-19","to":""},"says":"Thursday, Nov 19","nextOnFri20":"Unit 8"}
  EXPECTED: Unit 10 runs 2026-11-19 to 2026-11-21 (or keeps 11-20): "Thursday, Nov 19 to Saturday, Nov 21", and on Fri 20 Nov the next test is still Unit 10
  FAIL the last day survives typing
  FAIL on the second test day the weekly report still names Unit 10
  ```
- Suggested fix: do the `testRow` clean-up and the write-back on `blur` (or in `tidy()` when the list closes) instead of
  on each `change`; keep the raw value in `list[i]` while the box has focus. Safe: `tidy()` already runs `testRow` on close.
- Confidence: High (Chromium's date box, as on his laptop).

### TIM-10  "Reopen" says a quarter's missing work and Focus checks are back when, after the next export, nothing comes back
- Class: WRONG-INFO
- Severity: Low
- Where: quarters.js: `openQuarters` (line 254): the reopen toast (line 326) and the closed-box hint (line 293,
  "Reopening brings back its missing work, Focus checks and still-owed lines"); behaviour in `unitClosed` (line 102:
  a reopened quarter's units are still "past" when `live` is later) and `qSec` (line 115: the quarter's columns live
  only in the kept copy once the next export replaced the gradebook).
- Trigger: reopening a quarter after the next quarter's export is in (to correct a kept record, or by mistake). The
  accidental-early-close case the message was written for (NOTES.md:523) still works: there the work is in the live gradebook.
- Observed: Q1 and Q2 fixtures imported, Q1 closed, then reopened: Unit 1 is still closed (not owed), no Quarter 1
  column is in the open gradebook, the 22 missing marks stay in the kept record only; the toast reads "Quarter 1 is open
  again. Its missing work and Focus checks are back."
- Expected: the message matches the state, e.g. "Quarter 1 is open again; its record stays as kept: the class's
  gradebook is already on Quarter 2" when `gbQuarter(sec.grades) > n` for every class.
- Repro: probes/10-reopen-brings-nothing-back.js
  ```
  OBSERVED: closed {"closed1":true,"u1closed":true,"q1MissingInRecord":22,"q1ColumnsInOpenGradebook":0} | reopened {"closed1":false,"u1closed":true,"q1MissingInRecord":22,"q1ColumnsInOpenGradebook":0} | toast: "Quarter 1 is open again. Its missing work and Focus checks are back. Close it again whenever you're ready."
  EXPECTED: either reopening brings Quarter 1's 22 missing marks and Unit 1 back, or the toast does not say it does
  FAIL the reopen message matches what came back
  ```
- Suggested fix: word the toast and hint by state (as above). Text only; behaviour unchanged.
- Confidence: High on the text; this follows the "a past quarter is quiet" decision (NOTES.md:1239), which I do not dispute.

## Suspicions (unproven)

- **Late work dated in a closed quarter rewrites that quarter's record.** A Quarter 3 gradebook holding an assignment
  due 12/15 files it in Quarter 2 (`aQuarter` by due date); with Q2 closed it is hidden from Q3 and
  `quarterAfterImport` merges it into the Q2 record, recomputing Q2 finals. Per the recorded rule (quarters.js:180,
  GRADES_SPEC §7) this is intended; whether it is right depends on whether Focus ever lists such an assignment in a Q3
  export (I could not check Focus). Not reported as a finding.
- **Undated columns take the import day.** `aDate` falls back to `localDayOf(gb.importedAt)`. A file whose columns
  lack "Due"/"Assigned" (only the synthetic fixtures `gb_focus.csv` and `gb_messy.csv`; every scrubbed real export dates
  every column) changes quarter when re-imported after a quarter ends, and an undated column in a Quarter 1 file dropped
  during Quarter 2 is stamped "now" by `stampGb`, so `mergeArchive` leaves it out of the Q1 record and recomputes the
  finals without it. Tried by reading only; no real Focus file reaches it.
- **An older IXL export accepted over a newer one** ("Replace the newer data with this older file?", app.js:563):
  `sec.history` keeps the newer snapshot last, and the digest (home.js:168, `cur = hist[hist.length - 1]`) then compares
  snapshots that are not the data on screen. Same shape as TIM-07; not probed.
- **IXL Quickview "today/yesterday"** (students.js:125) are counted back from the report's date-range end, not the day
  the PDF was made; if IXL means the generation day, a report whose range ends earlier dates practice too early. Needs a
  real Quickview made on a later day than its range end.
- **`isStale` uses `<`**: a gradebook exported during the quarter's last day counts as final (TIM-03 mentions it).

## Cleanup and hardening

- **CL-1 dead code with a wrong date rule**: conference.js:102 `conferenceChecks` defines `const old = a => …` (MM/DD
  read with the current calendar year, a future due date pushed back a year) and never uses it (`grep -o old` on the
  line finds only the definition). Delete it so no one reuses its year logic (`mdToISO` is the school-year rule).
- **CL-2 one local-day helper**: `localDay` (app.js:807) and `localDayOf` (quarters.js:120) are the same function;
  `todayISO` (quarters.js:197), `quarterDue`'s inline copy (quarters.js:232) and seating.js:325's inline formatter
  re-implement "local day of now". Keep `localDayOf` and `todayISO()`; the duplicates are where TIM-01's UTC slices hide.
- **CL-3 one school-year rule**: `mdToISO` (quarters.js:58) and the Quickview date range (students.js:121) each infer the
  year from `ends[0]`; the rollover fix (NOTES backlog 10) has to change both. Share one `schoolYearOf(month)` helper.
- **CL-4 quarter ends not validated**: `quarters()` (quarters.js:15) checks only the shape `\d{4}-\d{2}-\d{2}`; add
  "real day, years 2000-2099, strictly increasing", else fall back to `Q_ENDS` (see TIM-02). `quarterOf` silently
  depends on the order.
- **CL-5 epoch fallback reads "Dec 31"**: `cleanGB` (quarters.js:42) replaces a bad `importedAt` with
  `new Date(0).toISOString()`; in any US time zone `localDayOf` of that is 1969-12-31, which then dates every undated
  column into Quarter 1 and prints "Focus gradebook of Dec 31". Prefer `null` plus the existing `|| ''` guards, or the
  archive's own `at`.
- **CL-6 `closedList`'s `soon`** (quarters.js:260) re-derives "closed early" from the UTC slice; compute it with the
  same rule as `closedEarly()` (local day of `closed.at` vs the end), which is TIM-01's fix.
