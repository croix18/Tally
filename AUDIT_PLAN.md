# Full audit — plan (22 Oct 2026)

Croix: "Set up a plan to run a full audit looking for any other critical bugs and strengthening and hardening the
things Tally does. Make sure it all works flawlessly and effortlessly."

The bug that prompted it (a class's own IXL export started a second class; weekly class exports silently dropped
notes, conference text and Focus links) is the pattern to hunt: **data that quietly goes missing or lands in the
wrong place**, and **flows that need the teacher to know Tally's internals**.

## Severity

- **Critical** — student data lost or attached to the wrong student/class; a wrong grade, point or retake answer shown
  or copied into Focus; names or grades leaking onto the Board, Show student or a Board save; Tally failing to open.
- **High** — a common weekly flow breaks, needs a workaround, or misleads (wrong count, stale data shown as current).
- **Medium** — an uncommon flow breaks; confusing wording; a recoverable surprise.
- **Low** — polish.

Only Critical and High are fixed in this pass without asking; Medium are fixed when cheap and safe; Low are logged.

## Phase 1 — six independent audits (read-only, in parallel)

Each auditor works in a scratch copy, may run the test build and write throwaway scripts, edits nothing in the repo,
and returns findings as: severity · where (file:function) · how to reproduce · why it matters · the fix.

1. **Imports** — IXL Score Grids (csv/xlsx/xls, course-wide pools, class exports, renamed files, older/newer dates,
   duplicate drops, mixed drops), Focus gradebooks (matching to a class, new class, IDs, renamed/added/removed
   assignments, quarter rollover), rosters, Seating Chart backups, FAST reports, Tally files. Everything that decides
   which class a file belongs to.
2. **Grades and plans** — the grade engine against Focus, what-ifs, quickest path, retake eligibility, Focus check /
   copy columns, IXL points per unit, skips (course, student), best scores, modified lists. Rounding and edge cases
   (excused, blank, extra credit, max 0, over max, a student with no IXL, a dropped student).
3. **Keeping data** — every place a class, student or the whole state is rebuilt from a list of fields (the bug class
   just found), `migrate()` whitelists, save/load, Full save / Board save / old backups round trips, Sync interplay,
   storage limits, the Google Site mode (autosave, leave guard), undo-less destructive actions.
4. **Time** — quarters (close, reopen, archives, Q2 export arriving early), history and trends, "since last import",
   reminders, dates across the year boundary, time zones, a computer whose clock is wrong.
5. **Privacy and safety** — names, IDs, notes, FAST fields and grades reaching the Board, Show student, a Board save,
   printed student pages, the copy-to-clipboard text; hide-names mode everywhere; HTML/script injection through file
   contents (names, assignment titles, skill names, notes); hostile JSON (`__proto__`); Sync.
6. **Flows and screens** — the weekly routine end to end on a new computer and on the panel, every button and dialog,
   empty and half-set-up states, error messages, the student page, conference form, seating, Board, Guide; laptop
   (1366–1920 wide), Promethean (touch), tablet; what a teacher would trip on.

## Phase 2 — verify and fix

Every Critical/High finding is reproduced first (a failing check in a test), then fixed, then the check passes. Fixes
that change what Croix sees or decides are listed for him instead of made silently.

## Phase 3 — prove it

Full suite, the sandboxed-frame run (Google Site mode), Sync tests, a plain build with no debug handle; NOTES.md and
ROUND6_FINDINGS.md updated; pushed; Tally.html delivered with a short list of what was found and fixed.

## Results (22 Oct 2026)

Six auditors ran in parallel on a snapshot, each with its own copy and probe scripts. Every Critical finding and most
High ones have a check in `tests/audit-oct22.js` (or an existing suite) that fails on the code before the fix.

### Fixed — Critical
1. **Copy put points on the wrong rows after a student left or joined** (imports, grades). Copy now pastes in the
   open gradebook's own order (`copyRows`), and every new gradebook updates the roster to Focus's list (keeping any
   "= IXL name" on a line). Before: 16 of 22 students would have received someone else's points.
2. **An old Q1 gradebook dropped after Q2 was in rewrote the closed Q1 finals and threw the Q2 columns away** (time,
   imports). An earlier quarter's file never replaces the live gradebook: a closed quarter asks first and names whose
   final changed; an open one is kept as that quarter's record.
3. **A class's newer IXL export was undone by the next gradebook import** (imports). `materialize` keeps a class's own
   newer export.
4. **A stale second tab overwrote newer work, and Sync could spread it** (data). A tab now takes up the other tab's
   saves the moment they happen.
5. **FAST scores could go to the wrong student when a near-name had another student's ID** (imports). A name match
   with a clashing ID is rejected.

### Fixed — High
6. An older copy of the current gradebook replaced the newer one silently → asks (newest graded work compared).
7. Saved data Tally couldn't read was overwritten by the first save while the message said it was kept → downloaded
   as `tally-unreadable-….json` first.
8. An old-style backup replaced histories, skips, ignores and aliases → asks, then adds (histories join by date).
9. The duplicate-class fold dropped Focus copy receipts and per-student skips → kept.
10. A backup held for a class not yet made dropped notes, conference text and overrides → kept.
11. "Unsaved work" was raised by just looking (cached `_keys` saved; normalisation on reload) → caches aren't saved,
    and a reload keeps the saved fingerprint (Google Site mode no longer autosaves or warns for nothing).
12. Q2 grades labelled "Quarter 1" while Q1 wasn't closed → labelled by the open gradebook's own quarter.
13. The Focus check called a blank Focus cell a match when Tally had 0 → flagged (a blank is left out of the grade).
14. The quickest plan asked students for IXL skills they had already done (Focus behind Tally) → a "Copy Unit N IXL into
    Focus" step comes first; work is capped at the student's own remaining skills.
15. An NHI in an IXL column counted as missing work for retakes while the conference form said nothing was missing →
    IXL columns are judged by the skills, one meaning of "missing" everywhere.
16. The student page and reports crashed for an eligible student when no unit was in progress → guarded.
17. The Students list's quickest line left out the "finish the unit's IXL before a retake" step → same steps as the page.
18. Data Lab rows were drawn to different scales (a taller dot stack squeezed a row) → one scale for every row.
19. A renamed course export could be filed under the wrong course → read from its skills when the name doesn't say.
20. A class first made from its own class export never took course exports → takes a newer one.
21. Carving a course export: a loose roster name could take a student another class matched exactly → it can't.
22. Removing a class, clearing everything or removing a gradebook had no way back → a Full save downloads first when
    there is unsaved work, and the question says what goes.
23. One bad date in a save left Tally blank for good → dates are checked on load, and a screen that can't be drawn
    shows a way out instead of nothing.

### Fixed — privacy and safety
24. The page now carries a Content Security Policy that blocks fetches, beacons, images and frames to other hosts.
    (It does not block a navigation: `location.href` could still carry data out. What actually protects Tally is
    that every imported value is escaped: names, titles, notes, FAST columns, labels and file names were all tried,
    across every screen, print page and saved page, and none ran. Corrected 24 Oct.)
25. The Sync passphrase is hidden as it's typed (Show reveals it; the hint says never to type it while projecting).
26. Printing one student's report or conference form while names are hidden asks first.
27. A Board save's grade history no longer keeps a pseudonymous student's grade, missing count and category scores on
    one row.

### Fixed — Medium
Older IXL export accepted no longer deletes the newer weeks' history; closing a quarter again keeps Focus's own final
grades (not today's weights); import days use the local date (a 9 pm import is today); on-level cards no longer call a
closed unit "not counted"; an empty note says to type first.

### For Croix to decide (not changed)
- **The panel with Sync holds the whole gradebook.** Hiding names is the only wall; a student at the board can hold
  "exit", open Students, and tap the eye. Option: a per-device "Board only" mode that stays on the Board while synced,
  with the teacher screens behind a PIN.
- **New school year.** Nothing starts 2027–28: in August the dates read as last year's closed Q1. A "Start 2027–28" step
  (Full save first, file the year away, new end dates, clear Working in) is needed before then.
- **Extra credit** (0-point columns) is left out of the grade. One real Focus export with extra credit would settle how
  Focus counts it.
- **Retakeable work:** notebook checks and vocabulary quizzes count as assessments, so they appear in retake lists.
- **Em dashes** remain in about 230 places of on-screen text (import lines, notices, toasts).
- **Tally on its own subdomain** (tally.mrshaffer.org) would keep other pages on the site from reaching its storage.

### Logged (Low)
Duplicates from before the period fix that also got a gradebook don't fold; a Full or Board save dropped with other
files ends the drop silently; toasts can sit over a dialog's ×; "FOCUS" vs "Focus" capitalisation; the copy toast's
suggested column title differs from Focus's "Unit N IXL"; the Race and "What changed" count different units without
saying so; a gradebook before any IXL export gives several screens slightly wrong wording; Needs attention's "1 on the roster
not in IXL: 1st 2nd 3rd 5th" reads as a total.

## Second audit (24 Oct 2026): "a high level approach"

Croix: "look for any kind of bugs, weak spots, vulnerabilities, everything else important that I'm not mentioning. Also
look for ways to improve the UI." Three auditors in parallel (security and data safety; correctness and robustness; UI
clarity), each on a snapshot with its own probes; findings fixed with a failing-first check in `tests/audit-oct24.js`.

### Fixed: correctness
1. **Retakes waited only for the unit being worked in** (High). A Unit 1 IXL column marked NHI with Unit 1 skills unfinished
   still read "Eligible", while the Students list said "Missing 1". Every unit with an IXL column in the open gradebook
   now counts (`retakeStatus().behind`), on every screen, in the quickest plan and on the conference form.
2. **A typed roster alias ("LAST, FIRST = IXL name") matched on the grid but Copy pasted a blank** (High): the rows Copy
   and the Focus check use are built from the gradebook's names and now carry the aliases.
3. **"Missing work" counted blank (not yet graded) cells** (High): Overview card, Grades headline and digest. NHI only now,
   on import and for gradebooks already saved.
4. The quickest plan listed a retake with nothing above it when Focus already gave full IXL credit; the required IXL
   step is listed. A student with no IXL link is no longer planned IXL skills it can't name.
5. "Update the kept record" left the archive undated ("Focus gradebook of Dec 31" after a reload): stamped.
6. The Students list labelled every row with the latest quarter any class had reached: the grade column says each
   row's quarter when classes differ, and a kept-but-open quarter's chip says "kept".
7. The Focus-gradebook age reminder used the UTC day (a day late after an evening import).

### Fixed: security and privacy
8. **Sync's conflict question could appear on the projected Board, and either answer put a Full save (every name and
   grade) in the panel's Downloads** (Medium). The Board and Show student count as busy (asked after Hold to exit), and no
   flow downloads a Full save when Sync already holds the work: Clear all, Remove class, Remove gradebook, opening a save.
9. The passphrase rule accepted four words ("windy hill middle school"): five different words now, or a long varied phrase.
10. A Full save opened on a hidden or empty Tally (the panel) keeps names hidden.
11. A state that can't be migrated never replaces the one in use half-done (`adopt()`).
12. Downloads no longer carry a student's name (Student-report.html, Conference-form.html).
13. Own `__proto__` keys in a save's receipts, column links, pools, grading and pending settings are dropped on load;
    a seating backup with a hostile period id can't throw.

### For Croix
- Two students with the same full name in one gradebook share one page, notes and conference text (the second is read as
  the first). Rare; say if it ever happens and Tally will key them by Focus ID.
- The GitHub Pages address (croix18.github.io) shares one origin with every other project there: anything on it could
  read Tally's storage. Tally should stay on mrshaffer.org, ideally tally.mrshaffer.org.

### UI (round 8)
One control vocabulary (primary, secondary, quiet, segment); the class screen is one bar with its notices folded under
"N to fix" and its duplicates behind ⋯; one primary action per screen; one stat tile; attention said once; Settings as
four tabs with a line per control; the Board's toggles behind Options at every width; em dashes and "FOCUS" gone from
on-screen text; the Data Lab compares any two data sets, one picked per course.

## Third audit (25 Oct 2026): the day's work

Croix: "Can you run an audit and debugging and hardening on everything that we've done today. It's been a lot and might be
messy." Three reviewers in parallel (the weekly report, signed reports and family; the FAST report; the two PDF imports),
each on its own snapshot with probes, then a pass of my own. Every finding below has a check that fails on the code before
the fix: `tests/audit-oct25.js` (39 checks), with more in `tests/quickview.js` and `tests/grades.js`.

### Fixed: the weekly report, signed reports, family
1. "Nothing missing and every assessment at full marks" printed for a student with missing work whenever the IXL copy
   alone reached the next letter, or with no IXL link (High). The report now says only what is true.
2. The tests-and-quizzes tile left NHI out (a 77% where the student page said 51%) and read "5 gradeds".
3. A reprint, or only opening the report, wiped that week's "back, signed" tick (High): one log entry per school week,
   the tick kept. "Since the last report" moves from the last report of an earlier week.
4. Focus was dated by the import, not the file: Friday's export brought in on Monday passed the Monday-morning reminder
   and "unchanged since then" compared days. Dated by the file now (`exportedAt`, `gbAt`).
5. "Eligible: … Unit 3 IXL at goal" named the unit being worked in even when Focus had no column for it, so nothing had
   been checked. The words name the checked units; the conference strength uses the unit's own skills.
6. Two-sided printing puts the next student on the back of a sheet that goes home: a batch's Print bar says to print
   one-sided (question for Croix below).
7. An NHI IXL column was listed twice in "What would move the grade".
8. An eleventh family contact vanished at the next load (cap 10, no word): 20, and Add contact hides at the cap.
9. Signed reports said "no reports have been printed" once the gradebook was removed; Remove class didn't mention
   family, weekly reports or practice; the hidden-names question said "a weekly report wants today's numbers" with
   today's exports in; a class made by its IXL export from held backup settings dropped notes, family and practice.
10. One student's bad record blanked a whole batch (weekly or FAST): that page says so, the rest print, a toast names it.
11. A report log from a file kept impossible dates ("2026-13-45", which would then throw) and NaN grades.

### Fixed: the FAST report
12. A category table continuing onto a page without its header lost its category for those students (the score report
    splits long tables).
13. Re-importing the Focus FAST report dropped the FLEID the score report had stored, so the next PDF matched by name only.
14. Last year's PM3 from the Seating Chart disappeared as soon as this year's PM1 was imported, and with it the gain target.
15. A Focus report holding only last spring's PM3 (pulled before PM1) made that year "this year".
16. The test grade came from the first window that named one, not the newest; an accelerated class with GradeLevel 8
    asked for a grade-9 table and the report threw.
17. Level pills ended at the next level's floor (Level 4 on grade 6 read 239–254; 254 is Level 5).
18. Three windows a few points apart printed on top of each other; a mark near either end ran off its bar.
19. "1 more points are needed"; the chart's "gain" label sat on the last point; a skipped PM2 read "Dec 8" after PM3.
20. With every window and four topics the page ran to two sheets and the goal box could split: one sheet, kept whole.

### Fixed: the PDFs
21. IXL Quickview: a name or a time wrapped onto a second line inside its cell lost the row or misread the time ("1 hr" for
    1 hr 23 min): the likely cause of Croix's "the time spent is extremely hit or miss" (High). Rows are rebuilt from
    their pieces by column; `fixtures/ixl_quickview_hard.pdf` draws a browser-printed table (the old parser lost most rows
    of it and misread every wrapped time).
22. A student header that didn't read put that student's rows on the student above; the same header repeated on the next
    page made a second student; "Practiced Oct 3" and "2 weeks ago" were not read; an accented name ("José") never matched.
23. Unmatched names showed in the toast with names hidden.
24. A PDF dropped on the window was refused ("Drop an IXL Score Grid…"); a PDF-only import jumped to the class's units and
    left no line on the Overview.
25. Every PDF started its own pdf.js worker (over http, three PDFs started three); a failed load wasn't cleaned up.
26. Practice data took most of the space (a skill's name on every student's every skill): four numbers per skill, names
    once per class, numbers clamped on import and load.
27. pdf.js (320 KB) was parsed at every start-up though only a PDF needs it: inert like its worker now. Its element id
    `pdfjsWorker` shadowed pdf.js's own global; renamed. The build's `</script` check is case-insensitive.
28. "Not practiced in a week" was counted to today, so an old Quickview made everyone idle; a missing last-practiced day
    read "null days ago".

### For Croix
- Does he print two-sided? Yes (25 Oct): two-sided printing is built and on by default (Print → Two-sided printing):
  every student starts on a new sheet, with a blank back where a report ends on a front. NOTES.md has the details.
- The FAST window dates (PM2 on Dec 8, PM3 in May) are written into the code; they could be a setting he updates each year.
- Test dates (25 Oct): his 2026-27 lists are in, and Settings → Course → Test dates edits them. They are a copy: when
  the plan moves a test on mrshaffer.org, the date here needs the same change (or, later, Tally reads them from the plan).
- A short text sample of one Quickview block (names removed) would confirm the wrapped-cell cause of the time misses;
  the parser now handles every layout the fixture draws.
