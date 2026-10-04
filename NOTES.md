# Tally — working notes

Read this first in a new session. It holds everything that isn't obvious from the code: Croix's setup, the
decisions behind the design (including the ones we reversed), the weekly routine, what's open, and how a
Claude session pushes to this repo. `README.md` says what Tally does; `GRADES_SPEC.md` is the Grades design;
`REVIEW_CONTEXT.md` and `ROUND2_FINDINGS.md` are the two earlier review rounds (historical — they describe the
per-section-file era and many items in them are now done).

## Croix's setup (as of 27 Sep 2026)

- Windy Hill Middle School (Lake County, FL). Five periods: **1st and 3rd accelerated** (MA.7 + MA.8),
  **2nd, 4th, 5th on-level** (MA.7). About 91 students in all (23 / 20 accelerated, 13 / 16 / 19 on-level).
- IXL is exported **course-wide**: one Score Grid per course (accelerated plan, on-level plan) with every
  student in it and no section code in the file name. Both files list all 91 students. Tally keeps each as a
  *pool* and carves classes out of it (see Decisions).
- Focus gradebook exports are one CSV per period, columns as multi-line headers ("Unit 1 IXL / 17 Points /
  Assigned 09/04 / Due 09/22"), cells like `16.5 - 79 % - C`, `NHI Not Handed In`, `NG`, a `Grade` column
  (`79% C`) and an `Average` row. Student names are `LAST, FIRST MIDDLE`; IXL names are `FIRST LAST`.
- Focus categories and weights: **Assessments 70 · Classwork 25 · Participation 5**. Quizzes, unit
  assessments, vocabulary quizzes, notebook checks and the IXL unit columns are Assessments; worksheets are
  Classwork; whiteboard practice is Participation. Proved exactly against the Grade column.
- Goals: SmartScore 67 accelerated, 60 on-level. One point per skill at goal, one Focus column per unit.
- Units: accelerated assigns Unit 1 but only **15 of its 23 skills**; on-level's **Unit 1 is a review unit
  and never counts**, Unit 2 is assigned with a subset of skills. Which skills are skipped is chosen in the
  Focus check's tick-list (course-wide).
- Devices: laptop, a Samsung tablet, and the classroom Promethean panel (Chromebox, touch, projected).
  The tablet opens the file from the Files app (`content://` address), which breaks storage and the
  clipboard API — Tally works around the clipboard; storage needs GitHub Pages (below).
- Backups go in his school Google Drive. The laptop and tablet are separate Tallys; the backup is the bridge.

## Decisions (and reversals)

- **Classes come from Focus gradebooks, periods from a picker.** With course-wide IXL exports the period
  can't come from IXL. A gradebook that matches no class offers "+ New class"; Croix picks period 1–7 and
  course once; the class (`sec.pool = true`, key `period-N`) is carved from `state.pools[prep]` by matching
  the gradebook's names. Re-importing a pool refreshes its classes; a class made before its pool waits.
  Per-section IXL files (`1205050-7T1A-…`) still work and label by period ("1st Period · Accelerated").
- **Gradebooks place themselves** (4 Oct, Croix's ask — it reverses round 6's "the confirming tap stays", which was
  kept because the old suggestion called a half-match a match). `matchSection(gb, taken)` in `app.js` compares the
  file's students with each class's own Focus list (its last gradebook, else its roster) by student ID and by name;
  a class with neither is compared through the IXL name matcher. It places the file without asking only when at
  least 80 % of its students are in the class, at least 60 % of the class is in the file and no other class holds
  more than 40 % of them (60 % / 20 % through the IXL matcher, which leaves double surnames for the fixer). Otherwise
  "Which class is this gradebook?" opens and says why ("split between…", "only 14 of its 23…", "only 5 of the 23
  students in…", "another file in this drop already went to…"). A file whose students are in no class (fewer than 3
  or under 15 %) goes straight to "New class" — period and course can't be read from a Focus file, and both course
  exports list every student, so the course can't be read from IXL either — with "It belongs to a class I already
  have" as the way back. The import card says "placed by its names (23 of 23)". There is no override when a file is
  plainly one class; if that is ever wrong, the fix is to make the dialog reachable from the import card.
  `tests/auto-place.js`.
- **The header is three places and one action** (4 Oct, Croix chose it from a mockup — `review/mockups/`). `#nav` holds
  **Classes** (`#btnHome`: the Overview, and "on" for everything inside a class), **Students** (`#btnStudents`) and
  **Board** (`#btnLb`: Race + Data Lab). Then search, the names switch (`#btnHide`, an eye; filled = names showing,
  crossed out = initials — kept one tap away because the grid gets projected), a ⋯ menu (`#btnMore` / `#topMenu`:
  Details view as a switch, Settings, Guide, Save backup with "3 days ago") and Import, the only filled button. The
  ids are the old ones, so handlers and tests kept working; tests reach the menu items through `more(p, sel)` in
  `tests/lib.js`. `wireMenu(button, menu)` is the one menu behaviour (overlay, Escape, arrows, focus back to the
  button) for this menu and the class bar's. Before the first import the header is just Guide (`#btnGuide0`) and
  Import. One row from 700 px up (the search field gives way first); below that it wraps. `tests/header.js`.
- **Roster = the gradebook's student column** (Focus order, with IDs). Filled in automatically when a class
  has no roster and at least half the names match its IXL students; offered when a pasted roster differs.
- **"Working in" unit per course** (`settings.currentUnit[prep]`): everything up to it is assigned and is a column
  on the class grid; review units (`settings.skipFirst[prep]`, default acc 0 / on-level 1) leave the grid.
- **One "Ahead" column instead of the upcoming units** (4 Oct, Croix chose it from a mockup — `review/mockups/`).
  Later units are no longer columns: the last column, **Ahead**, shows a student's skills at goal past the current
  unit ("5 skills · Unit 8"), only for students who have some; its header opens a floating list of the later units
  (`#aheadMenu`, appended to `body` because the sticky table header is its own stacking layer), and a cell opens the
  first later unit that student has work in. Opening a later unit and tapping **Not assigned → Assigned** makes it a
  column early. `renderGrid` only — `unitsOf` still returns every unit with `upcoming: true` for the later ones, so
  points, copying, the Race and the Focus check are untouched. **"Just Unit N" is gone**; instead the grid lands
  scrolled to the current unit and Ahead (`landOnCurrent`). **The 25 % rule is gone for numbered units**: it used to
  assign whatever a quarter of the class had started when no unit was picked, which gave scattered units (2, 3, 8
  and 10). Now a course always has a "Working in": `defaultWorkingIn()` sets it at import *and at start-up* (older
  saves) to the latest unit Focus has an IXL column for, else the last unit of the unbroken run a quarter of the
  course has started, else the first counted unit — and says which (`WI_WHY`). A pick is never changed, and the
  selector has no "— pick —" once set. Only a skill plan whose sections aren't "Unit N" keeps the old rule
  (`startedShare`), because it can't be put in order. `settings.onlyCurrent` and `curUnitTouched` are still read by
  `migrate()` but no longer used. `tests/ahead.js`.
- **Skill skips are course-wide** (`state.skips[prep]`, shared as `sec.excluded` by every class of the
  course). Per-student skips (tap a cell) stay per student.
- **Race ranks on movement**: share of the class that reached ≥1 more skill since the league's shared
  baseline (earliest "previous snapshot" date across the prep), gain as tiebreak, completion after.
  Headline hides a 1–2 student remainder ("nearly all"). "Furthest along" tag for the completion leader.
- **Grades** (`grades.js`, `GRADES_SPEC.md`): weighted categories on points earned ÷ possible, NHI = 0, NG
  out, rounded; categories proved by coordinate descent against the Grade column, asked only when the data
  can't decide; what-ifs (turn in, retake, next assessment, IXL), per-student print page, history per
  import, IXL-vs-assessments scatter. Weights editable per prep from the Grades bar.
- **Storage**: everything in localStorage, gradebook included. (Session-only gradebook storage was tried
  for a few hours and reversed when trends needed history; a leftover sessionStorage copy is folded in once.)
  `gradeHistory` keeps computed grades and aggregates, never raw scores. Backup JSON carries rosters,
  goals, skips, matches, category weights/map, weekly skill counts and computed grades per import.
- **Privacy**: projected mode forces initials; the one-student card has a near-opaque blurred backdrop and
  dismisses toasts; the shipped build has no `window.__tally` (test build keeps it); DM Sans is embedded so
  the page makes no network requests.
- **Command center** (26 Sep, evening): opens on an Overview of all classes; calm grid with a Details toggle (`settings.details`); Data Lab "Show as" graph types (`settings.labKind`, `labBin`); charts in `charts.js` use the validated categorical order for class-vs-class and the house teal for single series; each class has one fixed colour (`classColor`, by period) that follows it through tabs, Overview cards, Race cards, Data Lab rows and every chart; letter grades use one teal ramp with F in coral. See `COMMAND_CENTER.md`.
- **What changed digest** (home.js `digestFor` / `openDigest`): per class, from the two histories — IXL total and per-student gain, share moved up, biggest movers, drops, units everyone finished, new/gone students; Focus average change, missing change, sliding/climbing, letter changes, newly missing / turned in, new assignments. From the Overview card and the class ⋯ menu; printable; private backdrop.
- **Visual system** (26 Sep, evening): paper-and-ink — warm paper `#F6F5F0`, no graph-paper grid, white cards on hairlines with soft shadows, ink `#16213A`, accent teal `#0F766E` / bright `#2DD4BF`, warning wash `#FBDAD2` with ink `#D9442F`. Old token names kept (`--cream`, `--turq`, …) with new values so every rule resolves. Overview and Grades float on the paper (`body.home`, `body.grades`).
- **Round 3 hardening** (27 Sep): four reviewers (`review/`, ranked in `ROUND3_FINDINGS.md`) → every P0/P1 fixed.
  Snapshots carry per-unit counts so movement is read on today's assigned units (`movement()`, `snapTotals()`);
  skips re-snapshot; class average = mean of rounded grades; `neededOn` on the half-point grid; fixer uses pool
  keys; empty roster → empty class; old backups can't drag `skipFirst` back; one focus manager for `#modal`;
  ⋯ menu overlay; 44 px touch targets under `(pointer:coarse)`; Still-owed chooser (slips / initials / names)
  with unmatched students listed; histogram/circle/stem/line-label fixes; shape sentence by the mean-vs-median rule.
- **Seating** (27 Sep): the standalone Seating Chart v8 ported into Tally as a class surface (`seating.js`,
  `SEATING_SPEC.md`) — one shared room, solver, moves with consequences, prints. v8 stays the yearly importer of
  photos + FAST: drop its JSON backup on Tally. Placement uses a live "standing" (FAST pct blended with the class
  percentile ranks of the Focus grade and IXL completion). Decision: no pdf.js in Tally (would quadruple the file).
- **Round 4 hardening** (27 Sep, late): four reviewers on Seating (`review/round4-*.md`, `ROUND4_FINDINGS.md`) →
  every P0/P1 fixed: fit no longer collapses on save, options/selection are per class, zero desks can't crash,
  leaving mid-solve aborts it, ghosts of departed students are freed, per-section re-import keeps
  grades/seating, Names off hides every seating detail, imports are coerced (ids, numbers, data-URL photos
  only), save() reports quota failures, Seat by hand, honest fit caption, standing shows its ranks. The P2s followed
  (28 Sep): keep-by-desk-number templates, room undo with seats, 45-day retention for departed students, list
  search + quick toggles, keyboard room editor, seeded fit baseline, room name on prints, "Shown as" names. **Place by** (Priorities): standing from the blend, FAST only, Focus grade, assessments
  only, or IXL progress. **Partners**: keep lows apart / tutor pairs / similar level.
- **Round 5** (28 Sep): whole-project debug/harden (`review/round5-*.md`, `ROUND5_FINDINGS.md`) — every P0/P1
  fixed: projected Data Lab keeps Focus scores aggregate whatever was toggled before; prototype pollution and XSS
  through backups closed (`SAFE_KEY`); course change with a unit open; save failures no longer masked by success
  toasts; pool replacement asks when a file is undated or barely overlaps; Overview search; view scroll reset and
  focus restore in `render()`; Working in never offers review units; percent axes end at 100; CSV formula guard.
  Open P2s are listed at the end of the findings file.
- **Focus-check overrides** (3 Oct): "Keep Focus" on a differing row stores `sec.overrides[unit][student] = {focus,
  tally, at, why}`; the row counts as *accepted* (no badge/notice/attention) as long as Focus still holds that number,
  Copy carries Focus's number for kept students, "Flag again" undoes it, and a Focus change re-flags it with a note.
  In backups and per-section re-imports. The student card's what-ifs were rewritten as plain conditions with deltas.
- **Not-on-roster flag** asks "new student? re-paste roster" vs "gone? skip"; copies report students left
  out. The Focus check ignores columns that map to unassigned units.

- **Students + Quarters** (30 Sep – 1 Oct): Croix wanted the grades in a teacher-only place where he can see everything
  about one student fast — for conferences, trends, and what-ifs shown to the student — because Tally had only been
  telling him IXL. And Q1 ends 9 Oct: its assignments should "go dark" (no alerts) but stay tracked and viewable; he
  doesn't change grades after a quarter ends. His answers: Focus exports **only the new quarter** after a quarter ends;
  he shows what-ifs on **his laptop or tablet** turned toward the student (not projected); **nothing extra** on the page
  (no notes/contact log/goals). Built: `students.js` (Students list, student page, Show student) and `quarters.js`
  (close/reopen, `sec.qArchive[n]` with scores + categories + weights + finals, `state.quarters.units` for IXL units,
  `openSec()` = the open part of the gradebook that every alerting screen now reads). Grade snapshots carry `q` and
  `cats`; "since last import" and sliding compare within a quarter only. A review subagent found 10 issues (Q2 export
  before closing wiped Q1; one-column merge; backup reopening; archive XSS; digest; open column for a closed unit;
  null grades; all-closed crash; drops under Show; weights drift) — all fixed and covered in `tests/students-quarters.js`.
- **Quickest way to the next letter** (1 Oct): asked for after Students — fewest steps to F→D, D→C, …, missing work (NHI)
  and IXL first because that's what failing students lack; retakes only if needed. `quickestPath` in students.js, §8.1 of GRADES_SPEC.
- **Find a student** on the Overview now opens the Students list (every class) instead of the active class grid.
- **Round 6 — the Apple review** (3–4 Oct): four reviewers with opposed lenses (visual, interaction/accessibility,
  product, engineering) each wrote `review/round6-*.md`, then read each other and traded in a crit (each file's
  `## Crit response`). `ROUND6_FINDINGS.md` is the consensus and the running build log. **Build 1 shipped:** the false
  "can't get you to a C" sentence on Show student; `.warnline` as a block; focus rings that can be seen (`#top .pill`,
  dialog ×) and a keyboard exit from the Race; four CSS specificity bugs (F chip, Race chip, unit-view Copy, dead header
  rule); the Overview chip reads "Focus: N up since copy" instead of ✓ over a stale unit; the shell has a floor
  (`--board-min`) and a one-row header to ~1,070 px so the Chromebox and 150–200 % zoom show rows; an import's result
  is a card on the Overview (`state.lastImport`, drops within 15 min merge) and multi-class drops land there; the
  landing is hidden until boot decides; Show student pins name + grade and lost the trend card; `--test` builds
  `Tally.test.html` (git-ignored) so a test run can never ship `window.__tally`; `tests/contract.js` measures layout
  (one-row header, rows visible, sticky header, ring contrast, chip colours, font applied, no overflow, no debug handle).
  Build 2 and the items that are Croix's call are listed in the findings file.
- **Round 6, Build 2** (4 Oct, seven commits + one of fixes after an independent verifier's pass —
  `review/round6-build2-verify.md`). What changed and where to look:
  *Alerts* — "No IXL account" is a row status (`noAccount`, alias `'#none'`), so the fixer really clears the flag, the
  notice and the tab dot; Needs attention is one line per cause (`attentionGroups` in `home.js`, per-class chips when
  the cause is per class), warnings first, notes folded; the class page's notice band is a count chip in the bar
  (`noticeChip`), open by default only when the class has nothing to show. *Quarter close* — waiting cards read "Focus
  · Q1 final 84%" and "Q2 gradebook not in yet", no dashes or zeros; "Quarters" opens on the dates until the quarter
  has ended, with closing early behind a fold (`#qEarly`). *Backup* — `state.lastBackup`, "backed up 3 days ago" on
  the Overview and in Settings, a nudge when imports are newer than the backup. *Working in* — set at import from the
  latest unit that has a Focus IXL column (`defaultWorkingIn`), never a review unit, never over a choice Croix made
  (`settings.curUnitTouched`, which `migrate()` must keep in its whitelist). *Headers* — unit headers have fixed slots
  (title, status, action) so Copy lines up across units; skill names stand vertically on up to four lines
  (`fitSkillHeads`, cached per unit) so none is cut and three or four more students fit. *Board* — one unit (`--bu`)
  sizes the Race and Data Lab for the room, `LB_CSS` is the single source for the app and the saved page, the Race
  card is one line, and the Data Lab's data-set list no longer carries 219 single skills (a second select appears
  for "A single skill…"). *Student page and report* — tiles with sparklines, the answer first, numeric columns
  right-aligned; the printed report is one page; `nextAssessment` in `grades.js` is the one source for "what score
  on the next assessment". *Glyphs* — the font is re-subset with arrows and ≤ ≥ ≈ (recipe in `fonts/README.md`), and
  check/warning/lock/trash are inline SVG (`ICO`, `ico()`), so nothing falls back to a system face; every printed
  page embeds DM Sans via `printFontCss()` (the `@font-face` block only). *Storage* — a pool's classes no longer
  save a second copy of the course's skills (`stateForSave`, `poolSkills: true`, **`skills: []` not `null`** so an
  older Tally.html opening a newer save can't drop the class), and Settings shows how full the browser's storage is.
  Two lessons worth keeping: a `//` comment inside a one-line function swallows its closing brace (use `/* */`; the
  ship script now parse-checks), and `${...}` only works inside back-ticks — both broke a build this round.

## Weekly routine

1. Export both IXL Score Grids (accelerated, on-level) and the five Focus gradebooks.
2. Drop all seven on Tally in any order (and, once a year, the Seating Chart's JSON backup for photos and FAST). Pools refresh their classes; each gradebook lands on its class by
   its students' names and IDs, with no question (see "Gradebooks place themselves" below). Accept the category asker if it appears.
3. Check the roster-mismatch notice (new or withdrawn students), then copy each unit into Focus. The Focus
   check badge on each unit says whether Focus agrees.
4. Save backup to Drive.

At a quarter's end: import the last exports of the quarter, then Overview → **Close Quarter N** (the button turns
primary once the end date has passed). Tick the IXL units that were that quarter's work (pre-ticked from Focus due dates).

## Open items

- **Enable GitHub Pages** (Settings → Pages → Deploy from branch → `main`, root). `index.html` is already
  the app. Then use `https://croix18.github.io/Tally/` on the tablet and Chromebox — storage persists, the
  clipboard works, "Add to Home screen" gives an icon. Only Croix can do this (API writes are refused).
- **Rotate the fine-grained PAT** that was pasted into chat on 26 Sep once pushing is done.
- First week of history: Race movement, trends, "since last import" and sliding need a second import.
- **Student report** (27 Sep): one page per student — Focus grade, what would move it, IXL still owed — from the
  student card's Print or the class ⋯ menu (everyone / only those who owe). See `GRADES_SPEC.md` §4.2.
- Not yet built: plain-language parent version of the student report; Race naming pass; a way to mark a
  student's modified assignment list once for every unit (per-student skips are per cell today).
- Known rough edges: a student in two classes of the same course can't be — pools carve each name into one
  class; the IXL-only "not on roster" flag for a pool class means the name matched no roster line anywhere;
  the calm grid is still a dense table (Just Unit N is the relief); category asker fires for every new
  assignment when a gradebook has no Grade column.
- `tests/seating.js` "why-here explains the pairing" is occasionally flaky (the first desk's student may have no partner line, depending on the solver run); it passes on rerun.
- `Scrub.html` still exposes `window.__scrub` (test-only data, left on purpose).

## Working on the code

- Source: `app.html` (markup + CSS), `parser.js`, `grades.js`, `charts.js`, `home.js`, `seating.js`, `app.js` (an IIFE; the
  four are spliced into it at `/*__GRADES__*/`, `/*__CHARTS__*/`, `/*__HOME__*/`, `/*__SEATING__*/` so they share state), `scrub.src.html`. `python3 build.py` writes
  `Tally.html`, `index.html` and `Scrub.html`; `--test` builds `Tally.test.html` / `Scrub.test.html` (git-ignored) with the debug handle instead.
- Tests: `npm test` (builds the test build, runs every `tests/*.js`, restores the shipped build). Suites
  write only to a temp dir. Fixtures are synthetic or scrubbed; never commit unscrubbed exports.
  `tests/lib.js` has `unskip(p)` (every unit counts + Details view) and `dense(p)` (Details view) for suites written before calm mode.
- Fixtures worth knowing: `ixl_7T1A_scrubbed_*.csv` + `focus_gradebook_scrubbed.csv` +
  `focus_roster_scrubbed.txt` are one real class; `course_acc_*` / `course_on_*` are the real course-wide
  exports; `focus_gradebook_pool_p1/p2.csv` are synthetic gradebooks of pool names (7 names in the real
  class and one in the pool are scrubber artifacts that legitimately don't match).
- Commit as `Croix Shaffer <268190892+croix18@users.noreply.github.com>` (the gmail address is rejected by
  email privacy). Trailers: `Co-Authored-By` and `Claude-Session` lines.

## Pushing from a Claude session

The sandbox proxy answers git's first unauthenticated request with 403, so git never offers credentials.
Send Basic auth up front, per command; never put the token in the remote URL or commit it:

```sh
T=$(tr -d '[:space:]' < .github-token)          # fine-grained PAT, this repo only, Contents: read/write; git-ignored, chmod 600
B=$(printf 'x-access-token:%s' "$T" | base64 -w0)
git -c "http.https://github.com/.extraheader=Authorization: Basic $B" push origin main
git -c "http.https://github.com/.extraheader=Authorization: Basic $B" ls-remote origin main | cut -f1   # trust this, not the push output
```

If a push fails: `curl -s -o /dev/null -w "%{http_code}\n" -u "x-access-token:$T" https://github.com/croix18/Tally.git/info/refs?service=git-receive-pack` — 200 means the token can push, 401 means ask for a new one.
GitHub Releases and other API writes are refused from a session; Croix does those in the browser.

## Windmill and the room (3 Oct 2026)

Croix's tools now coordinate through **Windmill** (`croix18/Windmill`): the spine (the year's plan as one
JSON — every school day, both courses, lesson, benchmarks, IXL due dates, the bell and week colour from
Deckhand's own schedule), the **room** (one small object the tools exchange: `plan` · `tally` · `panel` ·
`roster` · `log`, one owner per part, newest copy per part, data tiers so counts ride every road, first
names ride Drive or encrypted, and grades never leave Tally), the reader every tool embeds, two room-code
forms, and a conformance test each repo runs. The design — alternatives, the contract, three transports
(room code · Drive file · Apps Script), per-tool changes, the spiral rule, the build order — is the
*Room Coordination Plan*, a Claude doc of Croix's: https://claude.ai/code/artifact/9db84d04-9444-48c4-adad-9c68905eefd8 (open it with the docs tool). Croix's standing
instruction: "Keep it over engineered. I want everything." Read Windmill's `README.md` and `HANDOFF.md`
before building this tool's part.

**Tally's part (plan phase 2; next to build).** Tally is the source of "where are we": `settings.currentUnit[prep]`
(the "Working in" selector) is the unit per course, and IXL skills at goal, mapped to benchmarks through
Windmill's `spine.skills`, are the benchmark heat (share of the course's students at goal per benchmark,
with the count). Tally gets a **Publish** button: it writes `room.js` (`window.ROOM = {…}`, the `tally`
part, open tier only) into the Drive folder the panel's tools open from, through a File System Access
handle picked once (test 4 in `Windmill/tests/room-test/`), posts the same to the Apps Script if a link
is set, and shows both room codes (the readable line and the compact one) for typing on the panel. The
roster part (first names per period, seating) can ride the Drive file; nothing from Grades, Students or
Quarters ever goes in the room — the reader and the schema refuse it. Later: exit-ticket results from
Cadence into the heat map, a heat map over time on the Overview, the nightly digest. Storage keys stay
as they are; the room is written beside Tally's own store, never read from `tally.v1` by any other tool.
