# Tally — round 3 review: The Teacher (27 Sep 2026)

Lens: does this tell the truth, and does it help on a Friday afternoon? I drove the pool flow with Playwright
(both course exports → `focus_gradebook_pool_p1/p2` → 1st acc / 2nd on-level → Working in → Focus-check skip → copy →
identical re-import dated a week later → Race, digest, Data Lab in every graph type at 1920×1080) and the real
scrubbed class for Grades (student card, what-ifs, print pages, fabricated second import). Hand-checked the 70/25/5
formula in Python against `fixtures/focus_gradebook_scrubbed.csv` (all 23 match, 22 NHI, 12 NG), the quartiles, the
needed-score solver, the circle-graph bins, and the histogram bins. Harnesses live in my scratchpad, not the repo.

Findings are ranked MUST / SHOULD / NICE, most severe first. Nothing was fixed.

---

## MUST

### M1. The Race, the digest and the Overview report a drop that never happened after skills are skipped
**Repro.** Import both course exports, make 1st-period acc from `focus_gradebook_pool_p1.csv`, set Working in = Unit 1,
open the Unit 1 Focus badge and accept "Skip 8 skills to match Focus". Copy the two course files renamed to
`…2026-10-03…` (identical scores) and import them.
**Saw.** Race card: "−0.1 skills per student since Sep 26 · 0% moved up". Overview: "−0.1 skills/student since
Sep 26". Digest: "−2 skills at goal since Sep 26 … **Dropped (SmartScores fell below goal): ABBOTT, BLAKE −1,
STODDARD, LOGAN −1**". Nobody's SmartScore changed.
**Expected.** No movement at all — or at least no named students accused of sliding.
**Why.** `snapshot()` (app.js ~315) writes each student's count over *every non-excluded skill at that moment*. The
skill-skip toggle (renderGrid `[data-x]` handler ~1107) and the Focus-check "Skip the ticked skills" button
(openFocusCheck ~1436) never re-snapshot, so the week-1 snapshot keeps the 8 skills while `leaderboardData()`'s
`totalNow` (~350) and the next snapshot exclude them. With `useBest` on (the default) a student's total can *never*
fall except through a skip, so "Dropped (SmartScores fell below goal)" in `digestFor` (home.js ~119) is essentially
always a lie. This is exactly Croix's week-2 workflow (acc Unit 1 keeps 15 of 23), and it is projected to students.

### M2. "Class average" disagrees with itself across screens, and with Focus's own Average row
**Repro.** Real scrubbed class → Grades. Fabricate a Sep 19 gradebook snapshot (as `tests/grades.js` §6 does), open
Overview and the What-changed digest.
**Saw.** Grades screen and Overview card: **82% · −3 since Sep 19**. Digest for the same class, same minute:
**83% · −2 since Sep 19**. The export's own `Average` row says **83%**, right under the sentence "Matches the Focus
Grade column for all 23 students."
**Why.** `classAverage()` (grades.js ~145) averages the *unrounded* percents (82.43); `gradeHistory[].grade` holds
*rounded* grades, so `prevAvg` in `renderGrades`/`gradeSummary` and both numbers in `digestFor` are means of rounded
values (82.57 → 83). Focus evidently averages the rounded grades too. Pick one convention (the one Focus uses) and
show Focus's Average row when the export has one (`parseGradebook` currently skips that row at ~799). A teacher who
sees 82 in Tally and 83 in Focus stops trusting the rest.

### M3. Histogram in % mode hides every 100% in a phantom "100–110" bar and shows 90–100 as empty
**Repro.** Data Lab → 1st Period acc → Unit 1 → % → Histogram (auto bins). Also Points mode on a 15-skill unit.
**Saw (% mode).** Bars titled `90–100: 0 students` and `100–100: 7 students`; the x-axis runs 0…110 with the seven
full-credit students in a bar past 100. A 7th-grader reads "nobody scored 90–100". Points mode: bar `15–15: 7
students` and the axis ends at 20 for a 15-point unit; every boundary is ambiguous (`0–5`, `5–10` — where does a 5 go?).
**Why.** `chartHist` (charts.js ~63): `nb = ceil(max/bin)` puts `max` itself in an extra bin, the last label is
`Math.max(max, nb*bin)`, and titles are printed as closed ranges. Whole-number data wants bins like 0–4, 5–9, …, with
the maximum folded into the last bin.

### M4. Circle-graph slice labels overlap on units with 10, 14, 18… skills
**Repro.** Data Lab → 2nd Period on-level → Unit 2 (10 skills) → Points → Circle graph.
**Saw.** Legend: `A quarter to half (3–5 of 10) 3` and `Half to three quarters (5–7 of 10) 13`. Five students have
exactly 5 points; they are counted in the third slice, but the legend says both. The correct second label is 3–4.
**Why.** `labPlot` circle branch (app.js ~591): `rng(i)` subtracts 1 only when `m/4` is an integer; for m ≡ 2 (mod 4)
the upper bound `floor(m(i+1)/4)` lands on the next slice's first value. Hand-checked m = 6, 10, 14, 18, 22 all
overlap; 15, 16, 23 are fine.

### M5. "All units · skills at goal" (and the Race's movement) count review and upcoming units — Settings promises the opposite
**Repro.** On-level with Unit 1 as the review unit and Working in = Unit 2. Data Lab → All units → Points, then %.
**Saw.** Points scale to 30 for a class with only Unit 2 (10 skills) assigned; in % mode the class median is **8%**
and the circle graph is 100% "Under 25%". The Settings text says review units "leave the Race, Data Lab, Focus check
and copies". The Race's `gain`/`active`, the Overview's "+1.6 skills/student" and the digest's "+32 skills at goal"
are all over *every* skill in the course (`activeIdx`), while the Race's "% complete" and the Overview's "IXL work at
goal" are over *assigned* units only — two denominators on one card.
**Why.** `labSeries` `unit:__all__` uses `activeIdx(s)` and `max = act.length` (app.js ~524); `snapshot()` and
`totalNow` in `leaderboardData` also use `activeIdx`. A student grinding Unit 9 for fun moves the Race; a student
finishing the review unit moves it too. Projected to students as "8% of skills at goal" this is demoralising and untrue.

---

## SHOULD

### S1. The shape sentence contradicts the mean-vs-median rule students are taught
**Repro.** Data Lab → stats level 2 on either fixture unit.
**Saw.** Acc Unit 1 (0, 1, 2×9, 8, 12, 13, 15×7): mean 7.2 > median 2 → every 7th-grade textbook says *skewed right*;
Tally says "longer tail to the left (skewed left)". On-level Unit 2: mean 4.3 < median 5 → *skewed left*; Tally says
"skewed right". Both fixtures, both wrong by the rule the class will apply.
**Why.** `stats()` (app.js ~497) judges skew by `Q1 − min` vs `max − Q3`, which breaks whenever a quartile sits on the
ceiling/floor (Q3 = max here). When the data is bimodal ("two clusters" is already detected) or the two rules
disagree, say "two clusters — not skewed one way" rather than pick a side.

### S2. Needed-score solver reports "0.5/27 for a C" to a student who already has a C
**Repro.** Real class → Grades → SUTTER, HAYDEN (79 C) → Next assessment.
**Saw.** "Needs 20/27 for a B · 0.5/27 for a C". 20/27 is right (hand-checked: 19.5 → 79, 20 → 80). The C line is
noise: 0/27 keeps the C. `neededOn` (grades.js ~102) bisects from (0, max] and never tests 0, and `needLine`
(~250) prints every target that is reachable, including ones already held. Show only targets *above* the current
letter, and return 0 when 0 suffices.

### S3. Gradebook parser drops an all-NHI column and counts blank cells as "missing" in some places but not others
**Repro.** `window.__tally.parseGradebook` on a header + rows where "New IXL" is NHI for everyone and "Quiz 2" has two
blank cells, one NHI, one NG, one score.
**Saw.** "New IXL" vanishes (`.filter(a => a.values.some(v => v != null))`, app.js ~841) — Focus counts it as 0/15 in
Assessments for everyone, so Tally's grades run high and the fit reports a mismatch nobody can fix. "Quiz 2" gets
`missing: 3` (blanks + NHI, ~839) — that number feeds the Overview "Missing work" card, the Grades headline, the
assignments-table Missing column and the digest's "(3 missing)", while the student rows, student card, sliding rule
and per-student history count `status === 'missing'` (NHI only). The headline and the sum of the rows will disagree
the first time an assignment is half-graded.

### S4. Before "Working in" is picked, the quarter-of-the-class rule assigns units the course hasn't reached
**Repro.** Fresh import of the real on-level pool + `pool_p2`, look at the Overview before touching Working in.
**Saw.** On-level auto-assigns Units 2, 3, **8 and 10** (≥25% of the class has *any* score there — placement/diagnostic
work). Overview says 22% at goal; after Working in = Unit 2 it says 43%. Nothing on the Overview or in Needs
attention says "pick the unit you're working in". `unitsOf` (app.js ~181) `auto = share >= 0.25` has no contiguity
requirement; `attentionItems` (home.js) has no item for a missing current unit.

### S5. "Stem-and-leaf" in Points mode is a sideways dot plot, not a stem-and-leaf plot
**Repro.** Data Lab → any unit → Points → Stem-and-leaf.
**Saw.** Stems are the raw values, leaves are "•" ("Stem = the value, each • is one student"). That is not the
representation the standard teaches; in % mode it is a real stem-and-leaf. `chartStem` (charts.js ~74) switches at
`max > 30`. Either hide the option for small-range data or say "dot plot" honestly.

### S6. Circle graph is unreadable from the back of the room
**Repro.** Data Lab → Circle graph at 1920×1080 (`out/30-lab-on-0-circle.png`).
**Saw.** An 84-px-radius pie with an 11-px legend inside a `max-width:460px` SVG; the two lowest slices are
near-identical beige (`#D8C5A0` vs `#E6D5B8`). `chartCircle` + `.chart.circle` in `CHART_CSS`. Every other Data Lab
graph fills the row; this one doesn't.

### S7. Print pages ignore the Names toggle, and the parent-facing page drops "at full credit"
**Repro.** Names off (initials showing) → Grades → student card → Print this page.
**Saw.** Card header reads "M. D."; the printed page opens in a new window with **DORSEY, MICAH FLYNN-WINTER** in
full — on the projector if that is what's connected. `printStudentCard` (grades.js ~275) never calls `mask`. Same
page: on screen the what-if reads "turn in at full credit → 52 F"; on paper it reads "if turned in → 52%". A parent
will hear that as a promise that late work earns full credit. The digest print (`openDigest`) likewise prints names
regardless of the toggle (it is teacher-only, but the same projector risk applies).

### S8. "Students doing more IXL score higher on assessments" is asserted at r = 0.33, n = 16
**Repro.** Real class → Grades → IXL vs assessments.
**Saw.** "r = 0.33 — students doing more IXL score higher on assessments — a weak link." With 16 students that r is
not distinguishable from zero, and the sentence is causal in shape. `rWord` in `renderGrades` (grades.js ~208). Lead
with "a weak link" or say "no clear relationship yet" below |r| ≈ 0.4 / n < 20.

### S9. "Still owed" silently leaves out roster students with no IXL match
**Repro.** Real class (7 scrubber-artifact mismatches) → ⋯ → Still owed → initials.
**Saw.** "16 students" for a 23-student class; the seven unmatched names appear nowhere. `openStillOwed` (app.js
~1224) filters `status === 'ok'`. A co-teacher handing these out has no way to know seven kids are missing.

### S10. Overview says "no IXL columns in Focus" when the only IXL column maps to the review unit
**Repro.** `pool_p2` has "Unit 1 IXL"; on-level Unit 1 is the review unit.
**Saw.** Card chip "no IXL columns in Focus". `focusChip` in `renderHome` (home.js ~33) tests `checks.length`, and
`reconcile` skips unassigned units. Say "IXL column is for an unassigned unit" or hide the chip.

---

## NICE

- **N1.** Race chip "+0.0 skills per student since Sep 26" — say "no change" (`signed` in `lbMarkup`).
- **N2.** In % mode the Values row labels read "Q1 = 13" / "Q3 = 100" without %, while the chips and stats say 13% (`valuesMarkup`). Digest "Sliding: … -27" uses a hyphen where every other screen uses "−".
- **N3.** Digest header uses the IXL date span (Sep 19 → Sep 26) while the Focus section is Sep 19 → Sep 27; the digest's IXL numbers are since the *class's* previous import while the Race's are since the *league* baseline — two "since" numbers can differ when classes are imported on different days (`digestFor` vs `leaderboardData`).
- **N4.** "nearly all moved up" hides a remainder of 1–2 whatever the class size: 3 of 5 measured reads "nearly all" (`headline` in `lbMarkup`). Fine at Croix's sizes; fragile for a small pull-out group.
- **N5.** Per-section era only: a class whose previous snapshot is dated *after* the league baseline gets "first week in the race" despite two imports (`leaderboardData` baseline = earliest previous date).
- **N6.** Student print page says "Focus gradebook as of Sep 27" — that is the import date (`gb.importedAt`), not the export date; a parent reads it as the date of record.
- **N7.** A student whose only cells are NG (new enrolee) prints "null% " on the student page (`printStudentCard` uses `${r.rounded}%`; the on-screen chip handles null with "—"). Read-verified, not run.
- **N8.** Histogram/bar/dots have no axis title ("points" / "% of points") — the subtitle carries it, but the projected graph alone doesn't.

---

## What is solid

- The Focus formula. 70/25/5 on points-earned ÷ points-possible, NHI = 0, NG out, empty categories re-weighted, rounded
  once — reproduces the Grade column for all 23 real students; my independent Python check agrees to the student.
  The category fit lands notebook checks and IXL in Assessments without being told.
- What-ifs. "Everything turned in → 72 C" for Micah, the retake table, the 20/27-for-a-B solver — all hand-verified.
  The "already" cells and "the missing work is the lever" line are the right things to say to a kid.
- Quartiles use the middle-school method (median excluded from the halves for odd n; n = 4 → 1.5/2.5/3.5, n = 7 →
  4/5/7), the Values row shows exactly the hand procedure, and the IQR ≤ 1 rule for switching outliers off is a
  genuinely good classroom call with an honest note.
- The Focus check's "Skip 8 skills to match Focus?" pre-tick of the least-touched skills is the single most
  Friday-saving feature in the tool; the copy column comes out in Focus order with blank rows for unmatched students
  and a toast that says so.
- Privacy on the projected screens holds: no names in the Race or Data Lab text, initials forced on entry, private
  blurred backdrop on the card and digest, hold-to-exit.
- The sliding rule (down ≥ 3 or more missing) surfaces the right student first; the Newly-missing / Turned-in lines in
  the digest are exactly what a Friday check-in needs.
- The "% moved up" headline with the 1–2-student remainder hidden is a thoughtful way to keep a ranking from pointing
  at a child.
