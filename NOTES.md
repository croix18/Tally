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
- **Roster = the gradebook's student column** (Focus order, with IDs). Filled in automatically when a class
  has no roster and at least half the names match its IXL students; offered when a pasted roster differs.
- **"Working in" unit per course** (`settings.currentUnit[prep]`): everything up to it is assigned; later
  units stay listed as *upcoming*; review units (`settings.skipFirst[prep]`, default acc 0 / on-level 1)
  leave the grid. A "Just Unit N" toggle (`settings.onlyCurrent[prep]`) shows only the current unit.
  Without a current unit, a unit auto-assigns when ≥25% of the class has any score in it (was "any student
  at goal", which let one kid working ahead assign Units 9–17 for everyone).
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
- **Find a student** on the Overview now opens the Students list (every class) instead of the active class grid.

## Weekly routine

1. Export both IXL Score Grids (accelerated, on-level) and the five Focus gradebooks.
2. Drop all seven on Tally in any order (and, once a year, the Seating Chart's JSON backup for photos and FAST). Pools refresh their classes; each gradebook lands on its class via
   the name-match suggestion (confirm with a tap). Accept the category asker if it appears.
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
- `Scrub.html` still exposes `window.__scrub` (test-only data, left on purpose).

## Working on the code

- Source: `app.html` (markup + CSS), `parser.js`, `grades.js`, `charts.js`, `home.js`, `seating.js`, `app.js` (an IIFE; the
  four are spliced into it at `/*__GRADES__*/`, `/*__CHARTS__*/`, `/*__HOME__*/`, `/*__SEATING__*/` so they share state), `scrub.src.html`. `python3 build.py` writes
  `Tally.html`, `index.html` and `Scrub.html`; `--test` keeps the debug handle.
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
