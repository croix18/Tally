# Round 4 findings — the Seating surface (27 Sep 2026, evening)

Full reports: `review/round4-engineer-1-hig.md`, `review/round4-teacher.md`, `review/round4-administrator.md`,
`review/round4-wozniak.md`. Tags: A = Administrator, T = Teacher, H = HIG engineer, W = Wozniak.
**Status: every P0 and P1 fixed** (commit "Seating hardening"); P2 items marked. `tests/seating.js` grew from 32 to
42 checks and covers the regressions.

## P0 — fixed
1. [W,H] Fit collapsed to 0 the moment a chart was saved (the saved chart was scored against itself as "previous
   partners"). → `buildModel(…, withFresh)`: the fresh-partners term is used only when generating.
2. [W] Options, selection and the last move were global — period 1's options showed on period 2 and could be seated
   there. → `seatCandsBy[sec.key]`; `seatUiFor()` clears selection/hover/last/pending on a class change.
3. [W] Room → Clear desks → Chart threw and blanked the view. → `seatBaseline`/`scoreSeats` guard m = 0; the chart
   view renders its notice.
4. [W] A solve finishing after you left painted the chart over the Overview; the worker wasn't terminated. →
   generation ids + `seatAbort()` from `render()` when the view is no longer Seating; results only render in place.
5. [A] Stored XSS through numeric/id fields of both imports (desk ids, coordinates, level, photo). → `cleanId`,
   `numOr`, `cleanSeatInfo` (PHOTO_RE data-URL whitelist ≤ 20 KB) on load, restore and import; weights clamped.

## P1 — fixed
6. [T,W,A] A withdrawn/renamed student stayed seated as a ghost that blocked the desk. → `pruneSeats` frees such seats
   in the saved chart (with a toast) and the working chart.
7. [T,W,A] The weekly per-section IXL re-import rebuilt the class without `grades`, `gradeHistory`, `seating`,
   `seatInfo`, `period`. → carried over in `importFiles`.
8. [A,T] Names off leaked: last-move text, import toast, sheet nickname/placeholder, plan tags, dots, accommodations.
   → the move report stores ids and names are resolved at render; the toast masks; the sheet hides name/plan/
   accommodation/notes fields; the chart, list, legend and why-here show initials only.
9. [A] Photo fields could be URLs → network requests. → only `data:image/…` is accepted anywhere (`shrinkPhoto`,
   `cleanSeatInfo`); the page still makes no requests.
10. [A] Quota failure on save was masked by the success toast. → `save()` returns a result; the seating Save only
    reports success on success; the quota message names the cause.
11. [W] Backups loaded before a pool class existed were parked forever. → `askNewClass` consumes `pendingCfg[key]`.
12. [T] Issues and why-here ignored the Priorities sliders. → a factor at 0 raises no issues.
13. [T] Fit's caption over-promised ("100 = every priority satisfied"). → honest wording: "N% less priority cost than
    a random seating; 100 isn't reachable".
14. [T] Standing shown without its parts. → "Focus 68% (rank 15 in class) · IXL 40% (rank 52) → standing 31" and the
    legend says it's relative to the class.
15. [T] More students than desks was a dead end. → "Seat by hand", tap-a-name-then-a-desk; the not-seated notice says
    how many desks short.
16. [H] Behaviour dot was the same colour as FAST level 2. → an ink "H" badge; legend and teacher print updated.
17. [H] Bar went stale after room/chart changes; Print stayed disabled after Generate. → `renderSeating`/`renderRoom`
    re-render the bar.
18. [H] Hover highlight never drew. → class toggled on the target desk.
19. [H,T] why-here/consequences far from the tap on tablets. → the move panel is first in the side column; on narrow
    screens the chart comes first; chart/stage heights follow the viewport minus chrome.
20. [H] Room `.ib` controls, chips, summaries under 44 px on touch; `seatAsk` had no focus/Enter; Grid… pre-checked
    "remove the desks"; Clear desks/saved used a checkbox as a confirm. → touch sizes, focus + Enter, unchecked by
    default, `seatConfirm` dialogs; template previews follow the Desks field, default = roster size.
21. [W] v8 re-import overwrote teacher edits; a failed photo nulled a good one. → FAST/photo overwrite, teacher fields
    only fill blanks, relations merge, photo kept on decode failure; malformed records skipped.
22. [H] Sheet inputs unstyled/monospace; `.on.hot`; range accent. → `.txt`, `.seg button.on.hot`, `accent-color`.
23. [T,H] Print: sub copy printed initials under Names off; no teacher legend. → prints use full names/photos (the
    teacher asked for the page); teacher copy carries a legend.

## P2 — open (noted for later)
- [W] Template id reuse for the horseshoe changes which numbered desk a student keeps; Grid (replace) and smaller
  templates unseat silently; Room Undo after a delete restores the desk but not its student.
- [A] No retention policy for seatInfo of departed students (kept until the class is removed); backup toast doesn't
  list photos/plan flags; a corrupt localStorage parse boots fresh without a `.broken` copy.
- [T] Lost from v8: roster search box, one-tap L/M/H + Front toggles on the list, "no FAST score" alert, restore of
  missing-since students, teacher-desk name and course/room on the print header.
- [H] Room desks aren't keyboard-focusable; nudge/✕ buttons unlabeled; chart names are still small on the panel.
- [T] Random baseline drifts fit by a few points between renders (30 random samples).

## Solid (all four)
Tap → why → swap-with-consequences works and is accurate; touch drag/pan/pinch on the stage; stable desk ids across
templates; dialog manners from round 3 hold; no prompt()/confirm(); the projected Race/Data Lab and the Overview carry
no seating data and force initials; sub copy has no markers; Clear everything and Remove class purge storage; no
prototype pollution; 91 photos ≈ 140 KB; a 5.7 MB v8 file imports in under a second; no page errors.
