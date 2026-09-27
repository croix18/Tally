# Round 3 findings — consolidated and ranked (27 Sep 2026)

Full reports: `review/engineer-1-hig.md`, `review/teacher.md`, `review/administrator.md`, `review/wozniak.md`.
Tags: A = Administrator, T = Teacher, H = HIG engineer, W = Wozniak.

**Status (27 Sep, evening): every P0 and P1 item below is fixed** (commit "Round 3 hardening"); P2 items 45–47 and 49 are
partly done (tokens, radii on the surfaces that mattered, digest separators), 48 and 50 are open. `tests/hardening.js`
covers the number, pool/storage and dialog fixes; the chart and wording fixes are covered in the suites they touch.

How the big ones were fixed, for the record:
- Snapshots now store per-unit counts (`pu`) and each unit's counted-skill total (`ua`); `movement()` reads two
  snapshots on the units assigned *today*, so advancing "Working in" never resets the race, and a skip made between two
  snapshots is reported as "skills counted changed" instead of a phantom drop. Skips (course-wide and per-student)
  re-snapshot every class of the course. Race/Overview/digest/Data Lab "All assigned units" all use assigned units only.
- `classAverage` is the mean of rounded grades everywhere (Focus's Average row).
- `neededOn` walks the half-point grid from 0; the student card only lists letters above the current one and says
  what keeps the current letter ("even a 0 keeps the B").
- The fixer offers pool entries under their pool keys (two same-named students are `#1` and `#2`).
- `#modal` has one focus manager (MutationObserver): focus in on open, Tab trapped, named by its heading, focus back to
  the opener on close. The ⋯ menu uses an invisible overlay so the dismissing tap fires nothing underneath.
- Touch sizes live in one `@media (hover:none),(pointer:coarse)` block at the end of `app.html`.

## P0 — privacy or wrong numbers on a screen someone trusts
1. [A1] Focus assignment scores project on the Data Lab: dot plot, stem-and-leaf, bar graph, Values and the stats
   strip expose every student's exact quiz score; dataset/graph controls are live on the student screen.
2. [A2,H] Hold-to-exit lands on whatever teacher view was open (Grades table with initials, grades, "sliding").
3. [A3] "Clear everything" leaves `tally.v1.broken` (full prior state) behind.
4. [A4] Stored XSS via file name in the import-failure toast (`fails.push(f.name + …)` → innerHTML).
5. [T1] Skill skips don't re-snapshot → identical re-import shows "−0.1 skills/student", digest names false "drops".
6. [T5,A] Race movement, "All units", Overview gain and digest count review + upcoming units; "% complete" counts
   assigned only; Settings copy promises review units leave the Data Lab.
7. [T2] Class average differs across Overview/Grades (unrounded) vs digest and Focus (mean of rounded).
8. [W1] Fixer stores alias `name#0`; the second of two same-named pool students can never be matched.
9. [W2] Emptying a pool class's roster hands it all 91 pool students.
10. [W3] Loading a backup restores an old `skipFirst` and defeats the one-time migration.
11. [W4,T S2] `neededOn` overstates by 0.5 in ~9% of cases, never tests 0, prints "0.5/27 for a C" to a C student.
12. [T3,H22] Histogram phantom top bin (100–110, "15–15"), range labels for integer data.
13. [T4,H13] Circle-graph quarter ranges overlap ("3–5" and "5–7" both claim 5); hard-coded old palette.
14. [W6] Tests hard-code dates (grades.js:74; reminder notices in grid/reminders suites fail after 2–3 Oct).
15. [W5] "classs" — `plural()` on words ending in s (5 sites).
16. [A5,T S9] Still-owed print: "safe to hand to students" is one page of everyone; unmatched roster students omitted.
17. [A,W] Old-save shapes blank the app (grades without students, assignment without values, null section entry
    read before the guard).
18. [W] Duplicate skill ID within a unit (GSB in Unit 10, real export) counts twice.

## P1 — misleading or fragile
19. [A,W] "nearly all moved up" shown with 0 movers when measured ≤ 2.
20. [T S1] Shape sentence contradicts the mean-vs-median rule 7th graders learn.
21. [T S3] Parser drops an all-NHI column (Focus counts it as zeros); blank-row students dropped from the roster.
22. [T S4] Nothing nudges the teacher to pick "Working in"; auto-assign picks Units 8/10 on real data first.
23. [T S5] Stem-and-leaf with max ≤ 30 is a sideways dot plot (use tens stems always).
24. [T S8] "students doing more IXL score higher" asserted at r = 0.33, n = 16.
25. [T S10,A] "no IXL columns in Focus" chip when the only IXL column maps to an unassigned unit.
26. [W] Race baseline: a class whose history starts after the baseline shows "first week" while its digest moves.
27. [W] Course toggle on a pool class doesn't re-materialize (skills of the other prep, label, goal).
28. [W] Two classes can be carved from the same names — no warning in the new-class picker.
29. [A] Copy-by-hand box not private; loose-match tooltip leaks the full IXL name with Names off.
30. [H1] Data Lab doesn't fit the panel with 3 classes + stats (charts scale with width; tools float over row 3).
31. [H2] Overview line chart: end labels overprint and clip; full-width chart text renders 2× the neighbours.
32. [H3] ⋯ menu: outside tap fires whatever is under it; Escape doesn't close it.
33. [H4] Touch targets under 44 px (bar toggles, ⋯, Copy 32; Working-in select 28; Focus badge 21; flags 24).
34. [H5] `focus-visible` outline is white → invisible on white; unit-view cells not keyboard reachable.
35. [H6] Dialogs don't take focus; `#modal` has a static aria-label.
36. [H7] Settings/roster auto-focus the textarea → soft keyboard on the tablet.
37. [H8] One tap on a unit-view cell silently toggles a per-student skip; no undo.
38. [H9] Calm grid shows Copy on upcoming units; Focus badge too small to tap.
39. [H10] Tab warning dot uses the coral *wash* → invisible.
40. [H11] Stacked letter bars: white counts on light C/D segments; F uses the old coral.
41. [H12] Projected type too small (10 px stats labels, 11 px ticks).
42. [H14] Native confirm() for Still-owed with Cancel = "full names".
43. [H15] Copy toast carries consequential facts for 3.2 s.
44. [H18] "What changed ›" is a span inside a button (invalid, unreachable by keyboard).

## P2 — polish
45. [H] 13 distinct radii; leftover bright turquoise on Race rank-1 card, pass cells, seg/chip .on; hard-coded
    off-token colours (#B3412B, #FBF8EF, old-navy modal backdrop); warning notices carry the popover shadow.
46. [H] Uppercase run-on dialog headers; digest name lists separated by commas ("LAST, FIRST" ambiguity).
47. [H] Overview clips the last card; Details bar wraps untidily; Just-Unit-N stretches one column.
48. [W] 50,000-value custom data draws 5,000 ticks; negative custom values dropped/off-canvas.
49. [T] "+0.0 skills per student"; hyphen vs minus; digest date span vs Race baseline wording.
50. [A] Backup toast omits student ID numbers; "Remove this class" leaves pool scores (pool is course data — by design).

## Accepted / not fixing now
- No access control on a shared Chromebox (A6): out of scope for a single-file tool; GitHub Pages + "Clear
  everything" + Names off are the mitigations, documented.
- Category fit "proved" is a single-swap test (W): documented limitation; user can always override.
- Per-section file after a pool class makes a second "1st Period" tab (W): unlikely mixed use; documented.
- "sliding" fires after category/weight changes (A): history stores computed grades; documented.

## Solid (all four)
Formula matches Focus for all 23 real students; what-ifs and quartiles hand-check; projected lock holds against
Escape / quick tap / Enter / reload; private backdrop opaque; shipped build has no debug handle and makes no
network requests; XSS escaping holds everywhere but the file-name toast; parser survives CRLF/CR/BOM/UTF-16/quoted
header newlines/5,000 columns; 5-class performance fine (renderHome 125 ms, save 6 ms, 671 KB); build idempotent.
