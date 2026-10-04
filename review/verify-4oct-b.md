# Independent verification — 48f8845 (Focus check / Settings / Guide) and 8907634 (tokens / layout)

4 Oct 2026. A second reviewer, told the Windows laptop is the screen that matters (1536×864, 1280×720, and the
browser as a window: about 1536×735 and 1280×595). Verdict as delivered: neither commit produces a wrong number —
`reconcile()`, the points, the clipboard lines and the printed pages were identical before and after, and no flow
threw an error — but the new interaction code had real defects, and two older defects surfaced, one of which could
paste a wrong value into Focus.

| # | Sev | Finding | Now |
|---|---|---|---|
| 1 | P0 (older) | "Keep Focus" on a **blank** cell: "Copy the whole column" pasted Tally's number over it, against the dialog's own promise | a kept blank copies as blank (`unitColumn`); `tests/overrides.js` |
| 2 | P1 (new) | The Settings class picker silently discarded every unsaved field except the roster | asks before dropping any unsaved field; nothing is carried to the other class |
| 3 | P1 (new) | The picker changed the active class behind the dialog at once, so Cancel left a different class on screen (and, from Grades, a half-drawn page) | the page behind does not move (`openSettings(key)`) |
| 4 | P1 (new) | The Focus check's folds broke keyboard use: Shift+Tab dead, the copy buttons unreachable once a row was kept | the dialog focus trap counts `<summary>` and skips closed folds |
| 5 | P1 (older, now better hidden) | "Wrong column?" applied on change with no confirmation and no way back | asks first; the toast and Settings → This class → Focus gradebook give the way back (Reset) |
| 6 | P2 | Setup wording "tap a hatched skill" when nothing is skipped | says what is true (change the points in Focus, or Wrong column?) |
| 7 | P2 | "Skip the ticked skills" with nothing ticked | the button is off |
| 8 | P2 | Course flipped in Settings: "This course" still named the old course | heading and review-unit count follow the course chosen |
| 9 | P2 (older) | The toast covered Cancel / Save in Settings | while a dialog is open the toast goes to the top |
| 10 | P2 | Arrow keys on the picker switched class and threw focus into the roster | focus stays on the picker |
| 11 | P2 (older) | Focus dropped to the page after a row action or after closing the check | focus goes to the panel / back to the badge |
| 12 | P2 | "At most 2 px" was not true everywhere (Generate seating 52 → 48, fixer chips 40 → 38, three corners) | accepted as the scale; NOTES.md says so exactly |
| 13 | P2 | The style contract missed `height:44px` and `min-height:46px` | those use tokens; the check is wider and says what it does not cover |
| 14 | P2 | Row counts were for the full screen, not a browser window: at about 1280×595 the page scrolled 27 px | a shorter-window layout; 7 rows and no page scroll at 1280×595, 10 at 1536×735; both are in `tests/contract.js` |
| 15 | P2 | Toasts now sit on the last row of Overview / Grades / Students (as on the class grid) | accepted |
| 16 | P2 | Four facts the shorter Guide had dropped | restored; still two pages |
| 17 | P2 | Corrections in ID mode for a student with no ID were a bare number; an empty "own data" box saved as `[0]` | the name is used; an empty box is no numbers |

Verified working by the reviewer: setup and check modes end to end (ticks, counts, exact clipboard lines in Focus
order, Keep → kept list → Flag again, names hidden); folds keep their state across row actions; Settings' other
actions from their new places; saved Race / Data Lab pages; printed pages byte-identical; no undefined token.

Not tested by anyone: real Chrome or Edge on Windows (everything ran in headless Chromium on Linux), Windows font
rendering, real print dialogs, and Croix's real files. The "Still owed — one list" print ran to 18 pages for a
22-student synthetic class in both builds (each student lists every owed skill); not investigated.
