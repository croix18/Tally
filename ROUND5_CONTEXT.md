# Tally — review round 5 (28 Sep 2026): whole-project debug and harden

Read `NOTES.md` first, then `README.md`, `GRADES_SPEC.md`, `COMMAND_CENTER.md`, `SEATING_SPEC.md`. Rounds 3 and 4
(`ROUND3_FINDINGS.md`, `ROUND4_FINDINGS.md`, `review/`) are closed — re-report only regressions.

## Ground rules
- Repo `/home/claude/Tally`. **Do not edit repo files.** Work from your scratchpad. Build the test build with
  `python3 build.py --test` (keeps `window.__tally`; rerun if it comes back undefined — others rebuild too).
- Playwright + Chromium: `executablePath` from `require('/home/claude/Tally/tests/lib').exe`. `tests/*.js` are working
  harnesses for every surface (`tests/lib.js` has the preamble; `tests/seating.js`, `tests/hardening.js`,
  `tests/command-center.js`, `tests/pool.js`, `tests/grades.js` cover the newest parts).
- Fixtures in `fixtures/` (real scrubbed course-wide IXL `course_acc_*`/`course_on_*`, synthetic pool gradebooks
  `focus_gradebook_pool_p1/p2.csv`, one real scrubbed class `ixl_7T1A_scrubbed_*` + `focus_gradebook_scrubbed.csv` +
  `focus_roster_scrubbed.txt`, older synthetic `f1473588-*.xlsx`, `gb_*`, `old_*`, `roster.txt`).
- Viewports: laptop 1400×900; Promethean 1920×1080 touch; Samsung tablet 1280×800 / 800×1280 (`hasTouch`, `isMobile`).
- Output: ranked findings, most severe first, each with repro, saw, expected, responsible file/function; then what's
  solid. Write to `/home/claude/Tally/review/round5-<role>.md`. Findings only, no fixes.

## The whole project, end to end
1. Import (`importFiles`): per-section IXL xlsx/csv, course-wide IXL → pools, Focus gradebooks → pickSection /
   askNewClass, the Seating Chart JSON backup, a Tally backup dropped here, mixed drops in any order, re-imports,
   older-dated files, files with no names, garbage.
2. Overview (home.js), the class grid (calm/details, Working in, Just Unit N, unit view, skips, per-student skips,
   Copy, Focus check + skip offer, receipts, CSV, Still owed, Student reports), Grades (formula, fit, asker, weights,
   student card what-ifs), What changed digest, Race, Data Lab (7 graph types, Points/%, stats levels, custom data),
   Seating (room, chart, Place by, Partners, Shown as, sheet, prints, v8 import), Settings (roster, goal, course,
   reminders, backup export/restore, course settings file, custom data, Clear everything), Guide.
3. Storage and migration: old save shapes (`tests/migration-and-history.js` shows some), `.broken`, quota, backups
   from every earlier version of this repo (git history has them: `git log --oneline`).
4. Privacy: Names toggle everywhere; the projected screens; prints; toasts; data-* attributes; network (none).
5. Numbers: snapshots/movement across skips, unit changes, thresholds; class averages; neededOn; standing/ranks;
   solver fit; percent rounding on the Data Lab.
6. Touch and keyboard on every surface; dialogs; focus; overlays.
7. Code health (read the source): dead code, duplicated logic, TDZ/ordering hazards in the spliced IIFE
   (`app.js` splices `grades.js`, `charts.js`, `home.js`, `seating.js`), error paths that swallow, `save()` results
   ignored, event handlers rebound twice, memory growth (workers, blobs, listeners), console errors on any flow.

## Known and accepted
No pdf.js in Tally; one room for all classes; one class per course per student in pool mode; the chart isn't projected;
GitHub Pages not on yet; `Scrub.html` exposes `window.__scrub`.
