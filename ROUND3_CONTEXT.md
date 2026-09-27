# Tally — review round 3 context (27 Sep 2026)

Read `NOTES.md` first (Croix's setup, decisions, routine), then `README.md`, `GRADES_SPEC.md`, `COMMAND_CENTER.md`.
Round 1–2 findings are in `REVIEW_CONTEXT.md` / `ROUND2_FINDINGS.md` (historical; most fixed).

## Ground rules for reviewers
- Repo: `/home/claude/Tally`. **Do not edit files in the repo.** Copy harnesses to your scratchpad.
- Build the test build (keeps `window.__tally`): `cd /home/claude/Tally && python3 build.py --test` → `Tally.html`.
  (Someone else may rebuild the shipped build between your runs — rerun `--test` if `window.__tally` is undefined.)
- Playwright + Chromium are installed. Working harnesses to copy: `tests/*.js` (see `tests/lib.js` for the
  preamble; `tests/command-center.js`, `tests/pool.js`, `tests/grades.js` cover the newest surfaces).
  Launch with `executablePath` from `require('/home/claude/Tally/tests/lib').exe`.
- Fixtures (`fixtures/`): `course_acc_*.csv` / `course_on_*.csv` — real scrubbed course-wide IXL exports (91
  students each); `focus_gradebook_pool_p1.csv` / `_p2.csv` — synthetic Focus gradebooks of pool names (23 / 24
  students); `ixl_7T1A_scrubbed_*.csv` + `focus_gradebook_scrubbed.csv` + `focus_roster_scrubbed.txt` — one real
  scrubbed class; `f1473588-*.xlsx`, `gb_focus*.csv/xls`, `gb_messy.*`, `roster.txt` — synthetic.
- The fastest way to a full state: import both course exports, then each pool gradebook → "+ New class" → pick a
  period (1 acc, 2 on) → Make. `tests/command-center.js` lines 8–9 do exactly that.
- Viewports that matter: laptop 1400×900; Promethean panel 1920×1080 touch; Samsung tablet 1280×800 and
  800×1280 touch (`hasTouch: true, isMobile: true`). The panel is projected to students.
- Output: a ranked list, most severe first, each with **repro steps, what you saw, what you expected, and the
  file/function you believe is responsible**. Say what's solid too, briefly. Write it to
  `/home/claude/Tally/review/<your-role>.md` (create the folder). No fixes — findings only.

## What Tally is now (surfaces to review)
1. **Overview** (home.js) — opens here. One card per class, needs-attention list, four charts.
2. **Class grid** (app.js renderGrid/renderBar/renderNotices) — calm by default (notices folded into a status
   line, ⋯ menu, Details toggle in the header). "Working in" unit selector per course; "Just Unit N" toggle;
   upcoming units listed; review units (first N per course) hidden. Copy per unit; Focus check badges; flags
   for roster mismatches with a new-or-gone chooser; per-class → course-wide skill skips; per-student cell skips.
3. **Grades** (grades.js) — Focus course grade (70/25/5 on points earned ÷ possible, NHI = 0, NG out), category
   fit against the Grade column, assignments/students tables, IXL-vs-assessments scatter, student card with
   what-ifs and a print page, category asker at import, weights editor.
4. **What changed** digest (home.js digestFor/openDigest) — per class, from IXL + gradebook histories.
5. **Race** (lbMarkup) — projected; ranks on share of class that moved up since a per-league baseline.
6. **Data Lab** (labMarkup/labPlot + charts.js) — projected; Show as: box, dots, histogram (bin size),
   stem-and-leaf, bar, circle, line (all classes, one chart); Points / % toggle; stats reveal levels; Values.
7. **Import** (importFiles) — per-section IXL files → classes; course-wide IXL files → pools (`state.pools`);
   Focus gradebooks → pickSection (name-match suggestion, "+ New class" → askNewClass), roster auto-fill,
   category fit/asker, grade snapshot. Any file order.
8. **Storage** — everything in localStorage under `tally.v1`; backup JSON (Settings); `state.skips[prep]`
   shared as `sec.excluded`; `state.grading[prep]`; `sec.history` / `sec.gradeHistory`.
9. **Privacy** — Names toggle masks; projected mode forces initials; student card/digest use a private blurred
   backdrop and dismiss toasts; shipped build has no `window.__tally`; no network requests (font embedded).
10. **Touch** — hold-to-exit on the exit pill; copy via execCommand first, clipboard API in secure contexts,
    "copy by hand" box as a last resort; no `accept` on the file input.

## Known and accepted (don't re-report)
- A student belongs to at most one class per course in pool mode.
- The calm grid is still a table; "Just Unit N" is the intended relief.
- Race/trends/sliding/digest need two imports; first week says so.
- `Scrub.html` exposes `window.__scrub` (test-only data).
- GitHub Pages isn't on yet; `content://` on Android has throwaway storage (documented).
