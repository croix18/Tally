# Round 5 findings — whole-project debug and harden (28 Sep 2026)

Full reports: `review/round5-wozniak.md`, `review/round5-teacher.md`, `review/round5-administrator.md`,
`review/round5-engineer-1-hig.md`. Tags: A = Administrator, T = Teacher, H = HIG engineer, W = Wozniak.
**Status: every P0 and P1 fixed** (commit "Round 5 hardening"); `tests/round5.js` (20 checks) covers them; 17 suites,
475 checks. Open P2/P3 items are listed at the end.

## P0 — fixed
1. [A] Projected Data Lab could list every student's exact Focus score: Values toggled on an IXL set stayed on when the
   dataset switched to a Focus assignment (a regression of round 3 #1). → `labMarkup` forces Values off, outliers off,
   bins ≥ 5 and no excused counts for any `gb:` set; the bin picker offers 5/10 only for Focus sets.
2. [W] Settings → change Course while a unit view was open threw in `renderBar` and left the screen stale. → the bar
   falls back to the class grid when the unit no longer exists. (Also found: switching a class's course carried the
   *other* course's review-unit count across — now only an explicit tap changes it.)
3. [A] Prototype pollution through a Tally backup (`sections.__proto__`, `assigned.acc.__proto__`, `grading.map`) and
   through an IXL file named `__proto__.csv`. → `SAFE_KEY` on every file-derived key in restore, migrate and import;
   `Object.assign` replaced by filtered spreads.

## P1 — fixed
4. [A] Stored XSS via backup `custom[].values` strings into the data-set editor. → values are coerced to numbers on
   load; the editor escapes.
5. [A,W] A failed `save()` was hidden by the success toast that followed (quota on the tablet's `content://` case). →
   a save failure suppresses non-error toasts for 1.5 s and names the cause.
6. [W] An undated or barely-overlapping "course" file silently replaced a whole pool. → asks when the file has no date
   or fewer than half its students are already in the course.
7. [W,H] Typing in the header search on the Overview swapped in an unlabeled grid. → search switches to the active
   class's grid properly (also from Grades/Seating).
8. [W] Drag-and-drop refused `.json` seating backups; a backup restored onto a pool class didn't re-carve it; a backup
   without a roster field would have emptied a pool class. → accepted; pool classes re-materialise after a restore;
   the roster falls back to the class's current one.
9. [H] `#gridwrap` kept its scroll offset across views (Grades/Seating opened mid-page); every re-render dropped focus
   to `<body>`. → a view change resets the scroll; `render()` restores focus to the control by id.
10. [H] Unit-view sticky footer's Points cell painted over by body rows. → z-index and border fixed.
11. [T] "Working in" listed the review unit (on-level Unit 1 → "Units 2–1 count", everything un-assigned). → review
    units are never offered; one counting unit reads "Unit 2 counts".
12. [T] Data Lab % mode drew axes past 100 (110, "100–110" bin). → percent mode tops at 100.
13. [W] Per-section classes never got a `period` (colour collision); an accepted older-dated import left the newer
    snapshot as "now". → period from the section code; history newer than the accepted file is dropped.
14. [W] Deferred gradebooks ran outside the try/catch — one bad file stopped the rest. → each in its own try.
15. [A] CSV formula injection via a roster name starting with `=`. → quoted.
16. [T] Seating: "rank 72 in class" for 23 students (it is a percentile); FAST-only / Tutor / Similar with no data
    produced bogus issues and fit. → wording; no pair issues or costs when neither student has a standing; the
    legend says when a class has no data for the chosen basis.
17. [H] Seating chart/stage heights and the stage owning single-finger scroll. → heights relative to the viewport
    chrome; the stage allows vertical page pans (`touch-action: pan-y`) while desks stay draggable.
18. [T] Two-cluster data described as "skewed"; the histogram fallback for a bar graph unexplained; "Class avg"
    excluding NHI unlabelled; the student report's IXL note and the missing "for a B" line; stale Guide copy. → all
    reworded (`stats`, lab legend, Grades table header, `studentReportSection`, `openGuide`).
19. [H] `--bad` on the coral wash was 3.3:1. → `#B8321F` (4.6:1 on coral, 6:1 on white).
20. [W] Lingering blob URL for the solver worker; locks left behind when a locked desk was deleted; a pending seat
    pick silently dropped on an occupied desk; dead `whatIfScores`; duplicate `unitColumn` export; the `.lbLeagues.two`
    rule mangled by an earlier CSS insert. → fixed.

## Open (P2/P3)
- [W] Pool exclusivity is by roster, not enforced: the same student in two classes of one course appears in both
  (Race/Overview would count them twice). The new-class picker now says so plainly.
- [H] Tablet density: the unit view shows only a few rows under its skill header; Grades bar tall in portrait; a few
  targets still under 44 px (status line, crumb, Hold to exit); Data Lab tool cluster wraps at ≤1400.
- [H] Nine native `confirm()` dialogs remain (imports and Settings); three print typefaces; seatAsk's "OK".
- [A] Search resolves initials to names while Names is off; full names in `data-*` attributes; backup disclosure
  line doesn't list photos/plans; a corrupt-storage boot doesn't keep a `.broken` copy on parse failure.
- [T] Fixer offers all pool chips at once; import toast says "22 students" not "22 of 23"; ±0.2 rounding noise in the
  Effect column; quartile display 8.75 → 8.8.
