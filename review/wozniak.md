# Wozniak — round 3 review (correctness, robustness, performance)

27 Sep 2026. Test build `python3 build.py --test`; Playwright 1.63 / Chromium; harnesses in my scratchpad
(`w1.js`–`w11.js`, a clock-faking copy of `tests/lib.js`). Nothing in the repo was edited. Every BROKEN item
below has a repro that fails today; RISKY items either need an unusual input or degrade rather than break.

## BROKEN

### B1. The fixer can never match the second of two same-named pool students
**Where:** `app.js` `openFixer` — pool leftovers are offered as `'@pool:' + name` and stored as
`s.aliases[display] = name + '#0'`; but `ixlList()` numbers keys by *occurrence among identical normalised
names* in the pool, so the second "DAKOTA QUILL" is `DAKOTA87 QUILL88#1`, never `#0`. `buildRows`'s alias pass
compares `s.key === a` exactly, so the alias resolves to nothing and the row stays `rosterOnly` forever
("an alias that didn't resolve stays unmatched" — the exact-name passes are skipped once an alias exists).
**Repro (w2.js B1):** import both course exports, make period 1 accelerated from `focus_gradebook_pool_p1.csv`,
tap the flag on `QUILL, DAKOTA`, pick the chip **DAKOTA87 QUILL88** (the second duplicate).
**Saw:** toast "QUILL, DAKOTA → DAKOTA87 QUILL88", class still 22 students, row still "NOT IN IXL — FIX",
`s.aliases = {"QUILL, DAKOTA":"DAKOTA87 QUILL88#0"}` while the pool key is `DAKOTA87 QUILL88#1`.
**Expected:** 23 students, row matched. `tests/pool.js` passes only because it picks the *first* duplicate.
Real data has same-name students across a 91-student course; the second one is unreachable.

### B2. Emptying a pool class's roster silently gives it the whole course (91 students)
**Where:** `app.js` `openSettings` `#mSave` → `if (s.pool) materialize(s)`; `materialize` → `buildRows(tmp)`
with an empty roster takes the no-roster branch that returns **every** pool student as `ok`.
**Repro (w10.js F1):** period 1 class from the pool (22 students) → Settings → clear the roster textarea → Save.
**Saw:** toast "Saved"; `sec.students.length === 91`; grid shows the "paste roster" panel (so it *looks* empty),
but Overview card, Race (`period-1:91`), Data Lab, `population()`, and the day's history snapshot (`per` has
91 keys) all use the entire course. The same thing happens through `renderRosterPanel` if `parseRosterText`
finds nothing, and "Skip roster" (`skipRoster`) on a pool class has the same effect.
**Expected:** a pool class with no roster should have no students (or refuse the save), never the pool.

### B3. Loading a backup re-applies the pre-V2 review-unit defaults and defeats the one-time migration
**Where:** `app.js` `#cfgFile.onchange` copies `cfg.settings.skipFirst` straight into `state.settings`;
`migrate()` then runs but `skipFirstV2` is already true, so `{acc:1, on:2}` (the defaults Tally shipped
before 163fc94) stick.
**Repro (w11.js):** on-level pool class; load a backup JSON whose `settings.skipFirst` is `{acc:1,on:2}`.
**Saw:** before: unassigned `["Unit 1", …]`; after load and after reload: `["Unit 1","Unit 2", …]` —
on-level Unit 2 (and accelerated Unit 1) are review units again, silently. The laptop/tablet "backup is the
bridge" routine makes this the normal path for any backup saved before 26 Sep.
Also: the toast says "Loaded settings for 0 **classs**" (see B5).

### B4. `neededOn` overstates the minimum score by 0.5 (and says 0.5 when 0 is enough)
**Where:** `grades.js` `neededOn`: the bisection stops at `hi - lo ≤ 0.5` then returns `ceil(hi*2)/2`, which
is the smallest half-point ≥ *hi*, not the smallest half-point that reaches the target; and `lo` starts at 0
without ever testing 0.
**Repro (w4.js):** 12 000 random (student, max, target) cases compared with a scan of `withNext` over
half-points: **1 111 disagree**, every one 0.5 too high; 211 of them are "needs 0.5/20 for a C" for a
student who already has it. Example: Test 86/64, Worksheet 35/29, Whiteboard 5/5, next max 50, target 80:
`neededOn` → 41, `withNext(…, 40.5).rounded` → 80. Shows on the student card and its print page.

### B5. "classs" — `plural(n, 'class')`
`app.js:237` (the weekly pool-import toast: "→ 2 classs updated"), `:1533` (wipe confirm), `:1549`/`:1552`
(course settings), `:1581` (backup load). `home.js` handles it by hand; these don't.

### B6. Test suite has a hard-coded date and three time bombs
- `tests/grades.js:74` expects the second gradebook snapshot on `2026-09-26`, but `gradeSnapshot` dates it
  `importedAt` = today. **Fails now** (ran from a scratch copy: `FAIL two history entries by date`, 33 pass).
- With the clock faked to 2026-10-10 (scratch `lib.js` with `addInitScript` Date shim; everything else
  identical): `grid.js:50` "skip roster shows info notice" (expects exactly one `.notice.info`; the 7-day
  "export is N days old" note joins it once the 2026-09-25 fixture is >7 days old — from **3 Oct**),
  `reminders-lab-guide.js:23` "30-day reminder does not fire for a 25-day-old export" (fixture 2026-09-01 —
  from **2 Oct**), `:28` "importing a fresh export clears the reminder" (2026-09-25 fixture — from **3 Oct**).
  All other suites pass at the faked date. No order dependence found: each suite launches its own browser and
  temp dir; `run.js` sorts and isolates them. The 278 fixed `waitForTimeout`s have ~5× margin on this box
  (pool import 106 ms, class creation ~150 ms of app time) — not flaky here, but they are the only sync.

## RISKY

### R1. Race baseline drops a class that *has* history — and the code contradicts its own comment
`app.js` `leaderboardData`: baseline per prep = `min` of each class's previous-snapshot date, then a class is
measured only if it has a snapshot ≤ that date. Comment says "the latest date on which every class already
had one" (that would be a max). **Repro (w5.js lb2):** a: snapshots 09-01, 09-20; b: 09-08, 09-20; c: 09-20.
Baseline = 09-01 → b gets `active:null`, "first week in the race", ranks below a on completion only — while
"What changed" for b reports Sep 8 → Sep 20 movement. Bites whenever one class's history starts after
another's previous import (per-section files skipped a week; a class made mid-year in per-section mode).

### R2. Two classes can be carved from the same students
`materialize` never excludes names already claimed by another class of the prep; `poolLeftovers` only
filters the fixer's chip list. **Repro (w1.js A1):** import `focus_gradebook_pool_p1.csv` a second time, take
"+ New class" (the picker does suggest period 1, so this needs a deliberate tap) → period 3 accelerated:
both classes hold the same 22 students, both in the Race and Overview. NOTES' "pools carve each name into one
class" is not enforced. A student whose old period's gradebook still lists them with scores lands in both.

### R3. A per-section IXL file after a pool class gives two "1st Period · Accelerated" tabs
**Repro (w9.js E1):** with `period-1` made from the pool, import `ixl_7T1A_scrubbed_….csv` → tabs
`["1st Period · Accelerated","1st Period · Accelerated","2nd Period · On-level"]`, both in the accelerated
league (23 + 22 students, mostly the same people). Keys differ (`period-1` vs `1205050-7T1A`), labels don't;
`askNewClass`'s "already a class" check only sees `sec.period`, which per-section imports never set.

### R4. Settings → Course toggle on a pool class leaves it half-moved
**Repro (w1.js A4):** period 1 (acc, from the pool) → Settings → On-level → Save. `prep` is `on`,
`excluded` now the on-level skips, but `skills` are still the 220 accelerated skills, `students` the
accelerated carve, `threshold` 67, label "1st Period · Accelerated"; the Race puts it in the on-level league
with 220 acc skills against 177. Survives reload. Nothing re-materialises until the *on-level* pool is
re-imported, at which point the roster names match nobody. `askNewClass` chose the course once; Settings
offers to change it with no re-carve and no warning.

### R5. Negative values in "Our own data" are dropped or drawn off-canvas
`charts.js` `chartHist` (`c[floor(x/bin)]` with x<0 writes to `c[-1]`), `labPlot` circle buckets
(`q[floor(v/max*4)]`), `boxSVG`/`chartDots` (`X(v)` < 0, `overflow:visible` → dots over the class name), and
% mode (`-5/4` → "−125%"). **Repro (w5b.js):** custom set `[-5,-3,0,2,4,4,4]`: histogram titles sum to 5
students of n=7; circle graph "20% / 20% / 60%" of 5; box dots for −5/−3 at negative x. A 7th-grade
number-line/temperature data set is exactly what this feature is for.

### R6. Category fit: "✓ proved" is a single-swap test, and the descent stalls with misleading names
`grades.js` `fitCategories`: `determined` checks each assignment alone. **Repro (w8.js):** 600 random
gradebooks with a known exact map (names lie half the time): 379 exact fits, of which **8 marked a wrong
category as proved** (a pair of assignments jointly swappable — both maps reproduce the Grade column); 221
ended in a local minimum (err > 0 → the "grades don't all match Focus" warning and name guesses, i.e. the
designed fallback). Croix's real gradebook has honest names and fits exactly, so this is a caveat on the
"proved by the Focus Grade column" wording, not his weekly path.

### R7. The same IXL skill listed twice in one unit is counted twice
`skillKey = sk.id`. The real accelerated export lists **GSB "Find the slope from a table"** under Lesson 10.2
*and* 10.3 (`course_acc_…csv`, skill rows 113 and 115, identical score columns). Unit 10 is "out of 27" for 26
distinct skills; a student at goal on GSB earns 2 points; the Focus column is copied as /27; skipping it in
either lesson skips both (same key) and drops the unit to 25. `mergeBest` and `studentSkips` share the key too.

### R8. `migrate()` reads `s.label` before the null guard; loose validation of saved shapes
`app.js:45` `typeof s.label` runs before `:46` `if (!s || …) { delete; continue }`, so a `null` section entry
throws → `bootError` → the **entire** saved state is set aside as `.broken` and the app opens empty. Similar
gaps (all reproduced in w2.js with hand-edited `tally.v1`): a `null` in `grades.assignments`, a gradeHistory
entry without `students`/`missing`/`assignments`, `state.grading[prep].cats` containing `null`, a receipt with
`rows:null`, a `null` in `scores`/`skills` — each throws inside `renderHome`/`renderGrid` and leaves the page
blank (no notice). None arise from Tally's own writes (shapes have been stable since 96e7b7f); backup import
(`clean()`) validates history only by `date`/`grade`. Everything else I threw at `load()`/`migrate()` was
handled: missing/typed-wrong `settings`, `skips`, `assigned`, `grading`, `pools`, `custom`, threshold `"abc"`
→ 60, label `{}`, prep `"zzz"` → on, roster `12345`, aliases `[1,2]`, old-style `ignored` keys, duplicate
`order` entries (kept — two tabs), 500-entry histories, `skipFirst {acc:'1', on:-5}`.

### R9. Race headline "nearly all moved up" has no lower bound
`lbMarkup` `headline`: `rest = measured − movers; if (rest < 3) "nearly all"`. With `measured` 1–2 and 0
movers it still says "nearly all moved up"; with 4 measured and 2 movers, "nearly all". `measured` counts
students present in the *previous* snapshot, so a week after a roster mistake (B2/F2 shrank the class to 3)
this is reachable even for a 20-student class.

### R10. Data Lab axes scale by one tick per 10 units
`boxSVG` (`step` caps at 10) and `chartDots` draw a tick and label every 10: a custom value of 50 000 (a typo
in "minutes to school") renders 5 005 `<line>`s and a 686 KB SVG (w5b.js `hugeBox`). Not fatal (68 ms) but
the axis is a black bar. `chartFreq` handles it (bins).

### R11. Stem-and-leaf rounds before stemming
`chartStem` does `Math.round(x)`: a 16.5 shows as 17 in the one plot whose point is exact values ("6 | 3 5
means 63 and 65"). Histogram bin titles read "0–10" but are right-open (10 counts in "10–20") — the plot is
right, the tooltip wording invites the off-by-one argument in class.

### R12. Confirmed older pool import keeps the newer snapshot as "current"
**Repro (w1.js A2d):** pool 09-27 imported, then the 09-26 file with the confirm accepted → `sec.date`
09-26 but `history` = `[09-26, 09-27]`; `leaderboardData` and `digestFor` treat the 09-27 snapshot as `cur`
while the grid shows 09-26 data. User asked for it, but the Race is then comparing data nobody can see.

### R13. `snapshot()` on a class still waiting for its pool *(code read, not executed)*
`curUnit` change and Settings goal save call `snapshot()` for every class of the prep, including one with
`awaitingPool` (students `[]`, `placeholder` false) → an empty `per` snapshot dated today lands in history
before the pool's; the first digest then lists everyone as "New in IXL" and the Race measures 0.

### R14. Parser: formats not recognised (by design, noted for completeness)
Semicolon-delimited CSV (Excel in a European locale re-saving an export) → one column → "not an IXL grid";
UTF-16 **without** BOM → garbage; a TSV whose header cells contain newlines is split on them
(`fileToRows` tab branch uses `split(/\r?\n/)`). An IXL grid with no "Skill name" header would be parsed as a
*gradebook* (218 "students") since `parseGradebook` accepts it — the header check is the only guard.

## CLEAN (checked, no finding)

- **build.py**: idempotent (identical md5 across two `--test` builds); the shipped build strips exactly one
  `window.__tally` line and asserts none remain; `index.html` is byte-identical to `Tally.html`.
- **Parser**: CRLF, CR-only, UTF-8 BOM, UTF-16LE with BOM, quoted newlines in a student header (name keeps the
  newline; `norm()` collapses it so matching works), no Skill-ID column, 5 000-column grid (51 ms), header-only
  file (0 skills, no throw), empty file (clear error), `asScore` on "99.5%", " 80 ", "1e2"→null, "abc"→null.
  Focus gradebooks: `Local ID` empty, one assignment, two students, Grade column with letters only (→ no
  `overall`, categories asked), percent cells (max 100, `percent:true`), "0 Points" (max 0 → `computeGrade`
  skips it, Focus check says "points differ"), no points line (max null), 5 000 columns (81 ms), HTML table.
  A one-**student** gradebook returns null (`students.length < 2`) — intentional.
- **Pool path**: re-import with a renamed/added/removed student flags exactly those rows; history dedupes by
  date; `sec.excluded === state.skips[prep]` identity holds for every class after JSON round-trip and after a
  prep change; class made before its pool waits and fills; roster re-paste re-carves; "Use the gradebook's
  list" restores the carve; Escape on the picker cancels cleanly ("Nothing imported.").
- **computeGrade**: empty categories → `pct null`; weights not summing to 100 re-weight correctly; all-zero
  weights → null; max 0/null assignments ignored; a category with only excused work drops out; `over` with
  null excuses. **withNext** agrees with a direct recompute everywhere `neededOn` was tested.
- **stats()**: n=0 → null; n=1, n=2, all-identical (IQR 0 → "bunched", whiskers min–max, shape "every value is
  the same"), NaN/null/"3" filtered or coerced, 5 000 values in 3 ms; quartiles follow the middle-school
  split (odd n excludes the median). Mode null when every value is unique.
- **Charts**: 112 (dataset × kind × %/points) combinations render with no throw and no NaN/undefined in the
  markup; empty arrays and max 0 are guarded in every primitive; 200-student dot/box plots shrink the radius;
  a 120-character class name clamps to 3 lines; the % toggle rounds each value first and the subtitle says so.
- **Digest**: missing previous snapshot → "needs two imports"; threshold change → "goal changed" note;
  renamed student → listed as new + gone (no crash, no double count).
- **Export pages**: Race and Data Lab pages open standalone with the embedded DM Sans (109 CSS rules), no
  names, no page errors, 100 KB each.
- **Performance at Croix's scale** (5 pool classes carved from the real 91-student exports, 25-assignment
  gradebooks with an exact Grade column, two import dates): pools import 106 ms; re-import re-carving 5
  classes 256 ms; `save()` 6 ms; localStorage 671 KB; `renderHome()` 125 ms (it runs `fitCategories` and
  `reconcile` twice per class — still fine); `leaderboardData()` 3 ms; class grid 12 ms; unit view 30 ms;
  Grades 23 ms; `fitCategories` 6 ms; Race 10 ms; Data Lab line chart 12 ms; student card 27 ms; reload +
  boot 233 ms. No pageerrors in any harness run.
- **Escaping**: every user-derived string I traced into innerHTML goes through `esc()` (labels, names, skill
  and assignment names, file names in modals, chips, options, titles). The only raw path is the import
  failure toast (`f.name + e.message`), which is self-XSS on a local-only page.
