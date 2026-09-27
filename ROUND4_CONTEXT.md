# Tally — review round 4 context (27 Sep 2026, evening): the Seating surface

Read `NOTES.md` first, then `SEATING_SPEC.md` (the thing under review), `README.md`, `GRADES_SPEC.md`,
`COMMAND_CENTER.md`. Round 3 (`ROUND3_CONTEXT.md`, `ROUND3_FINDINGS.md`, `review/*.md`) is done — every P0/P1 fixed;
don't re-report those unless you see a regression.

## Ground rules for reviewers
- Repo: `/home/claude/Tally`. **Do not edit files in the repo.** Copy harnesses to your scratchpad.
- Build the test build (keeps `window.__tally`): `cd /home/claude/Tally && python3 build.py --test` → `Tally.html`.
  (Someone else may rebuild between your runs — rerun `--test` if `window.__tally` is undefined.)
- Playwright + Chromium: launch with `executablePath` from `require('/home/claude/Tally/tests/lib').exe`.
  `tests/seating.js` is the working harness for this surface — copy its setup (two course exports + two pool
  gradebooks → "+ New class" → period 1 acc / period 2 on → Seating). It also builds a synthetic v8 backup JSON
  (`v8` object) for the import path; reuse it.
- Fixtures (`fixtures/`): `course_acc_*` / `course_on_*` (real scrubbed course-wide IXL, 91 students each),
  `focus_gradebook_pool_p1/p2.csv` (synthetic gradebooks of pool names), `ixl_7T1A_scrubbed_*` +
  `focus_gradebook_scrubbed.csv` + `focus_roster_scrubbed.txt` (one real scrubbed class).
- The original standalone tool is at
  `/root/.claude/uploads/b89b0f3d-86a2-5e43-8a51-10fb416b8565/26dcd78f-Seating_Chart_v8-1.html` (read-only; its
  app script is lines 256–1213) — compare behaviour where useful; the port should not have lost anything it did well.
- `window.__tally` exposes `state`, `seatStudents(sec)`, `geometry()`, `importSeatingBackup(obj)`,
  `explainSeats(seats, stu, G)`, `seatWork` (unsaved charts per class), `save`, `render`, `buildRows`, `computeGrade`.
- Viewports: laptop 1400×900; Promethean 1920×1080 touch; Samsung tablet 1280×800 and 800×1280 (`hasTouch`, `isMobile`).
- Output: a ranked list, most severe first, each with **repro steps, what you saw, what you expected, and the
  file/function responsible**. Say what's solid too, briefly. Write to `/home/claude/Tally/review/round4-<role>.md`.
  No fixes — findings only.

## What to look at (seating.js, the Seating CSS block in app.html, the hooks in app.js)
1. **Room editor** (`renderRoom`, `bindStage`, `openRoomTemplates`, `seatAsk`): templates, + Desk / + Row… / Grid…,
   drag/pan/pinch/wheel, select → rotate/duplicate/nudge/delete, undo, front side, room size, teacher desk, door.
   Desk ids are meant to be stable so saved charts follow desks.
2. **Chart** (`renderSeating`, `seatGenerate`, `seatMove`, `bindSeating`, `movePanelHTML`, `whyHere`,
   `explainSeats`): generate → options → fit; tap-to-swap with consequences; hover preview; locks; unseat / reseat;
   undo; save / back to saved / clear; the Students list; unseated students.
3. **Model** (`seatStudents`, `buildModel`, `scoreSeats`, `SEAT_WORKER`): students = roster rows; standing =
   mean of FAST pct + class percentile ranks of Focus grade and IXL completion; band rule; weights.
4. **Student sheet** (`openSeatSheet`): nick, behavior, flags, plan/accommodations, keep-apart / seat-near
   (symmetric, mutually exclusive), notes; link to the Grades card.
5. **Print** (`openSeatPrint`, `printSeating`, `svgChart`): teacher copy vs student/sub copy; all classes.
6. **Import** (`importSeatingBackup`, `seatingTargetFor`, `shrinkPhoto`): the v8 JSON backup → classes, names,
   photos, FAST, flags, links, room, charts, weights. What happens with a real-shaped backup (91 students, 7 periods,
   photos as 300×400 JPEG data URLs)? Size in localStorage after import?
7. **Privacy**: Names off must mask the chart, list, sheet, why-here and hide photos; the projected Race/Data Lab
   must not leak seating info; toasts; print copies.
8. **Persistence**: `state.room`, `state.seatWeights`, `sec.seating`, `sec.seatInfo` through reload, Tally backup
   export/restore, class removal, roster changes (a student leaves / renames), re-import of gradebooks.
9. **Touch/HIG**: 44 px targets, focus, dialogs, the stage's `touch-action`, the two-column layout at 800 px.

## Known and accepted (don't re-report)
- No pdf.js in Tally; photos and FAST come only from the v8 backup.
- One room for every class (Croix's decision).
- A student can be in only one class per course (pool mode).
- The chart is a teacher surface; it isn't shown on the projected screen.
