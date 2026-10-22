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
24. The page now carries a Content Security Policy: nothing can be sent anywhere but its own site (Sync), even if a
    file's contents ever got to run. (No script injection was found: names, titles, notes, FAST columns, labels were
    all tried.)
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
