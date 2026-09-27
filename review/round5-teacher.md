# Round 5 — teacher / department data lead walkthrough (28 Sep 2026)

Walked the weekly routine on the test build with the pool fixtures: both course exports → `focus_gradebook_pool_p1.csv`
(1st Period · Accelerated) and `p2.csv` (2nd Period · On-level) → fixer for QUILL, DAKOTA → Working in (acc Unit 1,
on-level Unit 2) → Focus check on Unit 1 with the skip offer (8 skills) → Copy → unit view + per-student skip → Grades,
three student cards, two student reports, Still owed, Student reports chooser → fabricated a Sep 19 week the way
`tests/command-center.js` does → Overview, both digests → Race → Data Lab (every graph type × Points/% × unit, all units,
two Focus assignments, both courses) → Seating with every Place by × Partners combination, why-here, sheet, print.
Every number below was recomputed by hand from the fixture files (Python, JS-style rounding); every screen's sentences were
read as a teacher and as a 7th grader on the panel. Laptop 1400×900, panel 1920×1080, tablet 1280×800.

Findings are ranked; the hand-checked numbers that agree are listed at the end.

---

## P1

### 1. Data Lab in % mode with "All assigned units" projects percents above 100
- **Repro:** Race → Data Lab → Accelerated → data set *All assigned units · skills at goal* → **%** → Box plot, Histogram,
  Bar graph, Stem-and-leaf.
- **Saw:** box-plot axis `0 … 100 110`; histogram has a `100–110` bin holding the 7 students at 100 %; **bar graph x-axis
  runs `0 6 12 … 108 114`** in steps of 6 (screenshot: the 100 % students sit under the "96–102" tick); stem-and-leaf
  gets an empty `11 |` stem. None of the axis labels carry a % sign, so the class reads "114" on a "% of skills at goal"
  chart.
- **Expected:** a percent axis stops at 100 and says `%`; a histogram of whole percents ends at `90–100`.
- **Responsible:** `app.js` `labMarkup` — the `unit:__all__` branch adds headroom (`scale = ceil((top+1)/step)*step`) even
  when `series[0].pct` is set, so `scale` becomes 110; `chartFreq` then bins 111 values into `ceil(110/20)=6`-wide bins and
  `chartHist` opens a `100–110` bin. (`labSeries` already sets `max = 100` in % mode; the headroom should be skipped when
  `pct`.)

### 2. "Working in" offers the review unit; picking it un-assigns everything and the copy says "Units 2–1 count"
- **Repro:** 2nd Period · On-level (default: first unit is a review unit) → Working in → **Unit 1**.
- **Saw:** toast "On-level classes are working in Unit 1 — Units 2–1 count; later units are upcoming." Every unit becomes
  *upcoming*, Race reads `0 of 0 skill-points`, the Focus check disappears, and a **"Just Unit 1"** toggle appears that
  shows the hidden review unit as the only column, tagged *now*. The same list lets accelerated pick Unit 1 and reads
  "Units 1–1 count".
- **Expected:** review units (`num ≤ skipFirst[prep]`) are not offered as a Working in choice, or picking one says so;
  the toast reads "Unit 1 counts" when the range is one unit.
- **Responsible:** `app.js` `renderBar` — `<select id="curUnit">` lists `units.filter(u => u.num > 0)`; the `cuSel.onchange`
  toast builds `Units ${skipFirst+1}–${cur}`; `unitsOf` marks `current` on a hidden unit; `renderGrid` `onlyCur` filters
  on `u.current` without `!u.hidden`.

## P2

### 3. "Bar graph" in % mode is silently a histogram with 5- or 6-point bins
- **Repro:** Data Lab → Unit 1 (acc) → **%** → Bar graph.
- **Saw:** legend still says "Bar graph · bar height = how many students got that value", but the bars are ranges
  (tooltips `10–14: 11 students`, `95–100: 7 students`); with *All units* the bins are `0–6, 6–12 …` (see #1).
- **Expected:** either draw the bar-per-value graph (with the 101 columns it can't) or switch the label and the "Show as"
  selector to *Histogram* and expose the bin chooser; never bins of 6 on a percent axis.
- **Responsible:** `charts.js` `chartFreq` — `if (items.length > 26) return chartHist(values, max, Math.ceil(max / 20))`;
  `labMarkup` legend text keyed on `kind === 'bar'`.

### 4. The shape sentence contradicts itself on two-cluster data
- **Repro:** Data Lab → Unit 1 (acc), Show more (stats level 2); also On-level Unit 2.
- **Saw:** "skewed right (mean above median; **the picture's longer tail is to the left**) · a big cluster at 2 · a gap
  between 2 and 8 (two clusters)" — for 13 students near 0 and 9 at 15. On-level: "skewed left (mean below median; the
  picture's longer tail is to the right) · a gap between 3 and 5 (two clusters)". A 7th grader is told "skewed right"
  and "longer tail to the left" in one breath, on data that has no single peak.
- **Expected:** when the gap/two-clusters test fires, lead with "two clusters" and drop the skew claim (or say "the
  mean–median rule says right, but the picture is two groups — no single skew"). The mean-vs-median rule is a
  single-peak rule.
- **Responsible:** `app.js` `stats` shape builder (`rule`/`tail`/`gap` parts joined with ` · `).

### 5. Seating "standing" reads "rank 72 in class" for a class of 23
- **Repro:** Seating → tap a seated student, or open a student sheet, with Place by = Blend / Focus grade / IXL.
- **Saw:** "Focus 65% (rank 72 in class) · IXL 13% (rank 33) → standing 53". Every teacher reads "rank 72" as 72nd of
  23. It is a percentile rank; the number badge in the list is the same percentile.
- **Expected:** "Focus 65% (72nd percentile in class)" / "IXL 13% (33rd pct)", or "top 28 %".
- **Responsible:** `seating.js` `standingText` (and `rankPct`); the legend "number = standing by Blend (…relative to the
  class)" doesn't say percentile either.

### 6. Place by "FAST only" with no FAST data gives a nonsense chart and a false note
- **Repro:** No Seating Chart v8 backup imported (the common case until the yearly import). Priorities → Place by →
  **FAST only** → Generate.
- **Saw:** fit **4** (Tutor pairs: fit **1** with 11 issues "similar standing (50 / 50), not a tutor pair" for every
  partner pair); every student "No scores yet — treated as mid-level"; the list note says "**23 students with no scores
  yet**" — they have Focus grades and IXL, only FAST is missing. Nothing warns before or after choosing it.
- **Expected:** the FAST only choice is disabled (or flagged "no FAST scores loaded — import the Seating Chart backup")
  when no student has `pct`; the note names the missing source.
- **Responsible:** `seating.js` `openSeatWeights` (basis buttons), `seatStudents` (`parts` for `fast`), `renderSeating`
  `noScore` sentence.

### 7. The student report that goes home carries teacher-only wording
- **Repro:** 2nd Period → ⋯ → Student reports (print) → Everyone; read QUILL88, DAKOTA87 (not matched to IXL). Also
  COBB, SAGE (71 % C).
- **Saw:** "IXL still owed — **Not matched to an IXL account — check the roster in Tally.**" on a page whose chooser says
  "Full names — these go home." Cobb's page: "Next assessment (out of 21): 14.5/21 keeps the C" and nothing about a B
  (a B is out of reach on one 21-point assessment, so the line is silently dropped) — a parent reads it as "the C is all
  that's on offer".
- **Expected:** on the home page, "IXL: not on file for this student — ask your teacher" or omit the section; when a
  higher letter can't be reached on one assessment, say so ("a B would take more than one assessment").
- **Responsible:** `grades.js` `studentReportSection` — the `else if (s.students.length)` branch and the `need`/`keep`
  line that filters out `null` results of `neededOn`.

### 8. The printed Guide describes the per-class era
- **Repro:** Guide button → print page.
- **Saw:** "Export from IXL … (**one file per class**)"; "Once per class: **Paste the roster from Focus (Settings)**";
  "Data Lab: **box plots** of any unit". Nothing about the course-wide export becoming a pool, the period/course picker
  when a gradebook arrives, the roster filling itself from the gradebook, or the seven graph types.
- **Expected:** the co-teacher's one-pager matches the weekly routine in `NOTES.md` (drop two course exports + five
  gradebooks; pick period and course once; roster comes from the gradebook).
- **Responsible:** `app.js` `openGuide` template.

### 9. Assignment "Class avg" leaves missing work out while the grade counts it as 0 — and the column doesn't say so
- **Repro:** 1st Period → Grades → Assignments table, `2.01 Worksheet`; Overview → What changed → "New assignments".
- **Saw:** "2.01 Worksheet · Class avg **67%** · Missing 8". Eight of 23 didn't hand it in; counted as zeros (as the
  grade does) it is 43 %. The digest's "New assignments: Whiteboard Practice (avg 70%)" and the Data Lab line graph for
  a Focus assignment use the same basis. Focus's own Average row is what teachers compare against.
- **Expected:** header "Avg (handed in)" or a second number "43% with NHI as 0"; the digest line likewise.
- **Responsible:** `grades.js` `renderGrades` (`asg` → `avg` over non-null values), `gradeSnapshot` (`assignments[].avg`),
  `home.js` `digestMarkup` newAsg line.

### 10. Focus check shows a per-student "22 differ" table while points possible disagree
- **Repro:** 1st Period → Unit 1 Focus badge ("Focus: points differ") before accepting the skip offer.
- **Saw:** under the skip offer: "1 match · 22 differ" and a table "ABBOTT, BLAKE — Focus 7 — Tally 3 — Focus differs from
  Tally". Tally's 3 is out of 23, Focus's 7 is out of 15; the comparison is meaningless until the skips are accepted, and
  the red "22 differ" invites copying corrections.
- **Expected:** while `!rc.maxOK`, hide the per-student table and the Copy corrections button, or caption them "on
  different bases until the points match".
- **Responsible:** `app.js` `openFocusCheck` — `bad`/`checkSummary`/`copyFix` are rendered regardless of `rc.maxOK`.

## P3

### 11. Fixer offers every unclaimed pool student, and same-name pairs are told apart only by "#1 / #2"
- **Repro:** 1st Period → flag on QUILL, DAKOTA.
- **Saw:** 69 chips (the whole rest of the course); "DAKOTA QUILL #1" and "DAKOTA87 QUILL88 #2" with nothing else to
  tell two real same-named students apart.
- **Expected:** the chips that share the roster name first, each with a hint (skills started, or the pool's student
  number), the other 60-odd behind "Show everyone".
- **Responsible:** `app.js` `openFixer` (`free = poolLeftovers(sec)…`).

### 12. Import toast says "22 students" and nothing about the 23rd
- **Saw:** "Imported 1st Period · Accelerated (goal 67, 22 students)" for a 23-name gradebook; the mismatch is folded
  into the calm status line ("2 things to look at").
- **Expected:** "22 of 23 gradebook names matched — 1 to fix".
- **Responsible:** `app.js` `importFiles` final toast.

### 13. Four seating options, all "fit 63", nothing says how they differ
- **Saw:** Option 1–4, each "fit 63" (every basis/pairs combination produced four identical fits); by state they differ
  in 22–23 of 23 seats.
- **Expected:** "Option 2 · fit 63 · 22 students moved" or a one-line difference ("front row: …").
- **Responsible:** `seating.js` `seatGenerate` / `renderSeating` cand buttons.

### 14. "Effect" is computed on rounded grades, so small assignments show rounding noise
- **Saw:** Unit 1 Assessment +0.4, Unit 1 IXL −0.5. On unrounded grades they are +0.57 and −0.43; the ±0.2 is the
  mean-of-rounded artefact, shown to a tenth.
- **Expected:** compute the effect on unrounded grades (or show it to the half point).
- **Responsible:** `grades.js` `classAverage` (mean of `rounded`) used for `cost` in `renderGrades`.

### 15. Signs and glyphs disagree across screens
- Home card "**+0** since Sep 19" vs Grades bar and digest "**±0**"; digest "Sliding: PRYOR, GREER **-6**" (hyphen) vs
  "−6" elsewhere and "**+4**" for climbers.
- **Responsible:** `home.js` `renderHome` card (`>= 0 ? '+' : '−'`), `digestMarkup` (`${r.d}` for slid).

### 16. Quartiles shown to one decimal when the data is in halves and quarters
- **Saw:** On-level Unit 1 Assessment (n = 24): "Q1 8.8 · Q3 18.3"; by hand Q1 = 8.75, Q3 = 18.25; the Values chips say
  "lower half · median = Q1 = 8.8". IQR 9.5 happens to survive.
- **Expected:** exact quartiles (`8.75`), since students compute them by hand.
- **Responsible:** `app.js` `fmtN` (`toFixed(1)`).

### 17. Chart axes without units / with fractional counts
- Data Lab % histogram and box-plot ticks read `0 10 20 … 100` with no `%` (only the subtitle says percent); Overview
  "Missing assignments by import" y-axis `0 2.5 5 7.5 10` for a count.
- **Responsible:** `boxSVG` ticks, `chartHist` tick labels, `home.js` `missLines` (`chartLines` without an integer step).

### 18. Default room puts the Teacher desk at the back
- **Saw:** FRONT along the top, Teacher desk bottom-right (`freshRoom` → `{x:740,y:500}` in 900×600). "Near teacher"
  then pulls a student to the back row.
- **Responsible:** `seating.js` `freshRoom`.

### 19. "No issues · Every priority is satisfied." next to "Fit 63"
- The fit box explains that 100 is unreachable, but "every priority is satisfied" and a 63 read as a contradiction.
- **Responsible:** `seating.js` `renderSeating` issues `<details>` text.

### 20. A toast from one class lingers over the next class's dialog
- **Saw:** "On-level classes are working in Unit 2 …" still showing on top of 1st Period's Focus check.
- **Responsible:** `app.js` `toast` (not cleared on tab switch).

---

## Solid — hand-checked and agreeing

- **Grade formula**: every student in both gradebooks reproduces the Focus Grade column (23/23, 24/24); class averages
  57 % (56.57) and 64 % (64.29) as mean of rounded grades; letters A0 B2 C3 D3 F15 and A0 B1 C8 D4 F11; category
  averages 60/43/70 and 64/66/61; effects +0.4 / −0.5 / −4.4 / +0.6 (with JS `Math.round`); "Matches the Focus Grade
  column for all 23 students" with every category proved (no asker).
- **What-ifs**: Greer 35 F → worksheet in 60 D, retake 70/80/90/100 → 42/46/50/55, IXL 15/15 → 53, next 17/21 → 44,
  "no single assessment reaches a C"; Zeller 75 C → 19/21 for a B, 11/21 keeps the C (least half point, checked either
  side); Easton 82 B → 15.5/21 keeps the B; report "all missing + IXL → 78 % C".
- **IXL**: Unit 1 out of 15 after the skip offer; Greer 8/15 = 53 %; class average row 7.0 = 161/23; unit-view
  "% of class at goal" 91 % = 21/23; copy = 23 rows, Focus order, points only, toast title "IXL Unit 1 · Sep 26 · /15";
  receipt rows; per-student skip toast "out of 14" with Undo; Still owed and student reports list below-goal skills with
  SmartScores and not-started skills; "Only students who owe something: 17 pages" (6 have 15/15 and nothing missing).
- **Race / Overview**: 161/345 = 47 %, 99/230 = 43 %; movement +27 = 15 of 23 = 65 %, +1.2 skills/student; on-level
  +31, +1.3; Sliding 6 (grade −6 for i%4==0) and "1 still at zero" (Lowell); biggest movers, dropped-a-letter and
  climbing lists all match the fabricated history; attention list names the guessed units when no Working in is picked.
- **Data Lab**: quartiles by the middle-school method (Q1 2, median 2, Q3 15, IQR 13; on-level 2/5/6), mean 7.0, MAD
  5.9, on-level 4.3 / 1.7; histogram bins `0–4 / 5–9 / 10–15` closed at the max; circle quarters `0–3 / 4–7 / 8–11 /
  12–15 of 15` and letter slices for Focus data; stem-and-leaf rows; Pearson r = −0.01 with the honest "no clear
  relationship … treat as a hint" sentence; the "Needs at least two imports" line-graph message.
- **Seating**: standing = mean of percentile ranks (Greer 7 & 59 → 33; Cobb 80 & 85 → 83); Place by / Partners
  combinations all generate, why-here lines agree with the chosen mode; Names off masks chart, list, sheet and why-here;
  teacher print carries level/behavior legend and full names.
- No page errors or console errors on any flow above.
