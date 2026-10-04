# Tally — review round 6 (3 Oct 2026): the Apple review

Read `NOTES.md` first, then `README.md`, `GRADES_SPEC.md`, `COMMAND_CENTER.md`, `SEATING_SPEC.md`. Rounds 3–5
(`ROUND3_FINDINGS.md`, `ROUND4_FINDINGS.md`, `ROUND5_FINDINGS.md`, `review/`) are closed — re-report only regressions,
and the open P2/P3 list at the end of `ROUND5_FINDINGS.md` is fair game if you think it matters now.

## The ask
Croix: "Run an Apple review. Make sure it's visually up to Apple standards. Run multiple reviewers who are contrarian to
each other but also want to work together to build the best product."

So the bar is: would this pass a design crit at Apple — a product used daily, on a teacher's laptop, a Promethean board
in front of 25 seventh-graders, and a Samsung tablet turned toward one student? Not "is it functional" (rounds 3–5 did
that) but: hierarchy, rhythm, typography, spacing, colour, motion, copy, affordance, consistency, restraint, delight,
and the feeling that every pixel was decided. Judge against the Human Interface Guidelines' *principles* (clarity,
deference, depth; consistency; direct manipulation; feedback; forgiveness) rather than iOS widget mimicry — this is a
web app with its own voice (DM Sans, navy/teal/turquoise/coral/sand tokens in `app.html` `:root`). The voice can stay;
the execution has to be impeccable.

## Ground rules
- Repo `/home/claude/Tally`. **Do not edit repo files.** Work from your scratchpad. Build the test build with
  `python3 build.py --test` (keeps `window.__tally`; rerun if it comes back undefined — other reviewers rebuild too).
- Playwright + Chromium: `const { chromium, exe } = require('/home/claude/Tally/tests/lib')` →
  `chromium.launch({executablePath: exe})`. `tests/*.js` are working harnesses for every surface (`tests/lib.js` has
  the preamble; `tests/command-center.js`, `tests/seating.js`, `tests/students-quarters.js`, `tests/overrides.js`,
  `tests/grades.js` cover the newest parts). Build a realistic state the `tests/round5.js` way: both course-wide IXL
  exports → pool gradebooks p1/p2 → period 1 accelerated, period 2 on-level; for a "real" single class use
  `ixl_7T1A_scrubbed_*` + `focus_roster_scrubbed.txt` (paste into `#rpText`) + `focus_gradebook_scrubbed.csv`.
- **Look at your screenshots.** Take them at every surface and state, then open the PNGs with the Read tool and
  judge them as a designer would. Measure in CSS px (`getBoundingClientRect`, `getComputedStyle`); compute WCAG
  contrast from the actual tokens. Report what you saw, with the screenshot's file name.
- Viewports: laptop 1400×900 (mouse); Promethean 1920×1080 (`hasTouch`, viewed from 4 m — projected-screen legibility);
  Samsung tablet 1280×800 and 800×1280 (`hasTouch`, `isMobile`, held at arm's length, one student looking on).
  Also one pass at 1024×768 and 1366×768 (the school Chromebox) — nothing should fall apart.
- Output: `/home/claude/Tally/review/round6-<role>.md`. Ranked findings, most severe first, each with: repro, what you
  saw (screenshot name), what Apple would ship instead (be concrete — px, weights, copy), and the responsible
  file/selector/function. Then "what's already at the bar" — be specific there too; the other reviewers will push
  back on anything vague. Findings only, no fixes to the repo.
- Severity: **P0** = a daily-use surface looks broken, amateurish, or misleads; **P1** = visibly below the bar on a
  surface used every week; **P2** = polish; **P3** = taste.

## What's new since round 5 (look hardest here)
- **Students** (`students.js`): Overview search → Students list (every class); a student page (`.profile`) with
  headline grade, trends charts, IXL by unit, "What would move the grade" what-ifs (one change per line, with a
  `→ 69 D +5` delta chip), "Quickest way to the next letter", Print report, and **Show student** (the page turned
  toward a student: grade and what-ifs only).
- **Quarters** (`quarters.js`): Overview → Close Quarter N; closed quarters go quiet (no alerts) but stay viewable.
- **Focus-check overrides**: "Keep Focus" inline note form on a differing row, "kept on purpose" details, badge
  `Focus ✓ · 2 kept`, "Flag again".
- Round-5 fixes on every surface (scroll reset, focus restore, `--bad` contrast, Working-in wording, lab privacy).

## Surfaces, end to end
Overview (home.js) · class grid calm/details · Working in · Just Unit N · unit view · Focus check dialog · Grades ·
Students list · student page · Show student · What changed digest · Race · Data Lab (7 graph types) · Seating (chart,
room editor, sheet, priorities, Place by, Partners, prints, templates) · Settings · Guide · every dialog, toast, empty
state, loading state, confirm, and print page.

## Known and accepted
No pdf.js in Tally; one room for all classes; one class per course per student in pool mode; the chart isn't projected;
GitHub Pages not on yet; `Scrub.html` exposes `window.__scrub`; DM Sans is embedded (no Google Fonts call); file://
usage on the Chromebox and tablet.
