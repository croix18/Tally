# Round 4 — teacher review of the Seating surface (27 Sep 2026)

Lens: a 7th-grade math teacher / department tech lead. Does Seating do what I need on a Sunday night, do the numbers and
words mean what they say, and does my work survive the weekly re-import? Exercised with Playwright on the test build
(harness copied from `tests/seating.js`; two course pools + two pool gradebooks → period 1 acc, period 2 on; synthetic
`seatInfo` set through `window.__tally.state`), and by reading `seating.js` against the original v8 tool
(`Seating_Chart_v8.html`, lines 256–1213). Scratch scripts: `scratchpad/e1.js` (standing, options, fit), `e2.js`
(persistence, roster changes, desk counts), `e3.js` (print, sheet, why-here, pods, per-section re-import).

Ranked, most severe first. Round-3 items are not repeated.

---

## 1. A withdrawn (or renamed) student leaves a ghost in the saved chart: the desk looks empty but can't be used

**Repro.** Generate and save a chart for period 1. Remove one roster line (Settings → roster, or "Use the gradebook's
list" after a student withdraws). Reload, open Seating.
**Saw.** The student's desk is drawn as an empty desk with its number (`aria-label` "Desk 4 (empty)"), but
`seatWork[K].seats` still maps that desk to the old name. Tapping it "selects" the invisible occupant (hint flips to
"Tap another desk to swap or move", the why-here panel is blank). Add a new student to the roster: they appear under
"Not seated", but tapping them and then the ghost desk does nothing — the desk still belongs to the departed name.
The issues list never mentions it; the bar still says "saved".
**Expected.** A roster change should drop names that are no longer on the roster from `sec.seating.seats` (and
`seatWork`) — or at least draw the desk as occupied by "(left the class)" so I understand why it's blocked. The same
ghost appears when a name is corrected (see #2).
**Responsible.** `workFor` / `renderSeating` (no reconciliation of `seats` against `seatStudents`); `svgChart` (an
unknown id renders as empty); `bindSeating` → `act` (`if (!w.seats[id])` guards placement, `if (sid)` selects the
ghost). `roomDropDesks` handles desks that disappear; nothing handles students that disappear.

## 2. Fixing a name typo on the roster silently throws away that student's plan, accommodations, flags and links

**Repro.** Give a student `plan: 504`, `accom`, `front`, `behavior: high`, a keep-apart. Edit the roster line
(`ABBOTT, BLAKE` → `ABBOTTX, BLAKE`, i.e. the kind of fix you make when Focus had it wrong). Reload.
**Saw.** The student reappears with everything blank (`plan ''`, `front false`, `apart []`, no tags in the list).
The old `seatInfo` entry is still in storage under the old name, invisible. The *other* student's `apart` still
contains the old name, so their list shows "1 apart" with no visible partner and the hard rule no longer applies
between the two. The saved chart keeps a ghost desk for the old name (#1).
**Expected.** ESE/504 and accommodations are the one thing on this surface I cannot afford to lose silently. A
rename should carry `seatInfo` (and the seat, and both directions of `apart`/`together`) to the new key, or the
roster editor should warn "1 student's seating info no longer matches a roster line". The gradebook/IXL
re-imports are fine (see Solid) — this is specifically the roster-text edit path.
**Responsible.** `seatInfoOf` keys by the raw Focus display string; `rpSave` / the Settings roster save and
`[data-gbroster]` (app.js ~1033, ~1105, ~1613) rewrite `sec.roster` with no hook into `seatInfo` / `seating`.

## 3. Re-importing a per-section IXL file wipes that class's seating chart and every student's seating info

**Repro.** Import `ixl_7T1A_scrubbed_*.csv` (a per-section class). Set `seatInfo` and a saved chart on it. Drop the
same file again.
**Saw.** `sec.seating` is gone and `sec.seatInfo` is `{}` (plan, accommodations, links, photos, FAST all gone).
**Expected.** The pool path keeps everything; the per-section path is still documented as supported ("Per-section
IXL files still work"), and `seatingTargetFor` prefers a per-section class by section code — so the yearly v8
import lands there and is then erased by the next weekly export.
**Responsible.** app.js import block ~272–286: the rebuilt section object lists `roster`, `history`, `aliases`… but
not `seating` or `seatInfo` (nor `grades`/`gradeHistory`, which I did not test but are absent from the same list).

## 4. Names off does not mask the last-move / hover panel

**Repro.** Swap two students (panel shows "Swapped Greer Pryor and Blake Abbott … Greer Pryor needs a front seat"),
then tap Names to hide names.
**Saw.** Chart, list, sheet and why-here go to initials; the "Swapped …" consequences panel still shows both full
names and the issue lines with full names. Same for the "If dropped here" preview if it was on screen.
**Expected.** Names off masks everything on the surface — that's the rule the rest of Tally follows.
**Responsible.** `seatMove` bakes `seatName()` into `what`, `added`, `removed` strings at move time; `movePanelHTML`
re-renders `seatLast` / `seatHover.rep` verbatim.

## 5. The fit number doesn't mean what its caption says

**Repro.** Fresh class, no flags or links. Partners × 24, 23 students → Generate. Then Partners × 23. Then set
Standing placement, Front-seat and Academic mixing to 0 and Generate.
**Saw.** 24 desks: every option "fit 62", issues "Every priority is satisfied". 23 desks: "fit 58", same message.
Pods × 24: "fit 77". Priorities zeroed: "fit 4" (with band warnings — see #7). Caption: "100 = every priority
satisfied · 0 = no better than random".
**Expected.** A chart the app itself calls perfect should not score 58–77, and the number should not swing 15
points with the room template. The cause is structural: fill-from-front (and the band/depth terms) charge a cost on
every desk but the front row, so the best possible chart carries a large fixed cost and fit is "how much of the
random-chart cost you shaved", not "how many priorities are met". As a teacher I read 62 as "meh" and keep
regenerating for nothing. Either the caption should say what it measures, or the score should be relative to the
best-found chart.
**Responsible.** `scoreSeats` (fit = 1 − soft/baseline), `seatBaseline` (30 random charts), `buildModel` unary
terms (`fill`, `over` band overshoot). Inherited from v8 unchanged.

## 6. "Standing" is not the number a teacher thinks it is, and the app never says so

**Repro.** Period 1 (synthetic gradebook, IXL mostly at 0–3 %). Read the Students list numbers and the sheet line.
**Saw** (real output):
- `Focus 35% · IXL 17% → standing 32` — the lowest passing-or-not grade in the class is *not* low standing
  (band "front three-quarters"), because 17 % IXL ranks 57th in a class where most are at 3 %.
- `Focus 53% · IXL 0% → standing 22` — a C-ish student with no IXL yet *is* low and is pulled to the front half.
- `Focus 28% · (no IXL match) → standing 2`.
The sheet and why-here print "Focus 35% · IXL 17% → standing 32" as if 32 were derived from those two numbers; it
is the mean of two *class percentile ranks* (7 and 57), which appear nowhere. The Priorities text says "Lower
standing (FAST, Focus grade, IXL)"; the legend says "number = standing (FAST · Focus · IXL)".
**Expected.**
- Early in the year IXL completion is ties and noise (everyone at 3 % gets rank 30; one unit of work jumps a
  student to rank 57+). Weighting it equal to the Focus grade lets IXL override a failing grade.
- Because the two components are class ranks, ~25 % of *every* class is "low standing" by construction — in the
  accelerated class that's the bottom of a B-average room being pulled forward, and the same student's standing
  changes when a classmate turns in a worksheet.
- FAST `pct` is a state percentile; averaging it with class ranks mixes scales (FAST 60th pct, class-bottom Focus →
  "32").
- At minimum the standing line should show the ranks it averaged ("Focus 35% (7th in class) · IXL 17% (57th) →
  32") and the band definition should be visible somewhere in-app (it is only in `SEATING_SPEC.md`). With the
  numbers as they are, I can't defend "why is my F student in the back?" to a parent or an AP.
**Responsible.** `seatStudents` (`rankPct` on `grades`/`ixls`, mean of parts), `standingText`, `SEAT_FACTORS.fast.desc`,
the legend in `renderSeating`.
(What is fair: a student with nothing is "no scores yet — treated as mid-level", standing null, band "anywhere",
no number in the list; a student with only a Focus grade is ranked on that alone. Both reasonable.)

## 7. The issues list and why-here ignore the Priorities sliders

**Repro.** Priorities → Standing placement 0, Front-seat flag 0. Generate.
**Saw.** Fit 4 (solver obeyed the sliders); issues list: four "(standing 32) is further back than the band suggests"
warnings; why-here says "— sitting further back"; a Front-seat student not in the front third would still get
"needs a front seat".
**Expected.** If I turned a priority off, the chart should not be flagged for it — or the caption should say the
list checks rules regardless of weights. Right now the fit says "good" and the list says "4 issues" about the same chart.
**Responsible.** `explainSeats`, `whyHere` never consult `seatW()`.

## 8. More students than desks (and no chart yet) is a dead end

**Repro.** New semester: Partners × 22, class of 23, no saved chart. Also 12 desks (a small-group room).
**Saw.** Notice "23 students but only 22 desks — add desks in Room", Generate disabled, Print disabled, and tapping
any desk does nothing (`seatWork` stays null). No way to seat 22 by hand and put one at the side table, or to seat
the first 12 for a station rotation. Once a chart exists (e.g. you had 23 desks, then deleted one) the surface does
work: the lost desk's occupant goes to "Not seated" and manual moves continue.
**Expected.** Either let Generate run with the overflow listed under "Not seated" (the scorer already tolerates
unseated students — `scoreSeats` skips `asg[i] < 0`), or let me start a blank chart by hand.
**Responsible.** `renderSeating` (`can = … stu.length <= nd`), `seatGenerate` (`stu.length > G.ds.length` → return),
`bindSeating` → `act` (`if (!w) … return`).

## 9. "Clear saved" is one tap with no confirmation and no undo

**Repro.** Open a class with a saved, unedited chart → tap "Clear saved".
**Saw.** Chart gone, `sec.seating` deleted, no dialog, Undo disabled (the working copy is deleted too).
**Expected.** v8 asked "Clear the saved chart for this period?". Tally's own "Clear desks" asks. This is the only
destructive control on the surface without a step between the tap and the loss, and it sits next to Undo.
**Responsible.** `bindSeating` → `#seatClear`.

## 10. The four options are the same chart shuffled — nothing to choose between

**Repro.** Generate three times (E1), any template.
**Saw.** Every run: Options 1–4 all "fit 62" (or all 77, all 58); pairwise 1–2 desks of 23 in common. With no
flags set, this is inevitable (every student is interchangeable), but even with seven students flagged the options
came out at identical fit. The option cards give a teacher no reason to pick one over another.
**Expected.** Options that differ in something I can read ("Option 2: Greer front-left, Blake by the door") or at
least different fits. Low priority on its own; it compounds #5.
**Responsible.** `seatGenerate` (dedupe at 85 % same desks, sort by total), 5 restarts of the same objective.

## 11. Changing the room quietly changes every class's chart

**Repro.** Saved charts in two classes. Room → Templates → Partners with fewer desks (23 → 22), or Groups of 4.
**Saw.** Toast "Partners: 22 desks." Students on the dropped desk vanish into "Not seated" in each class with no
mention; switching Partners → Groups of 4 keeps students "by desk number", so keep-apart pairs can become
pod-mates in classes I'm not looking at. The Room view shows nothing about the consequences; I only find out when I
open each class's Chart and see fit 0 · 1 hard.
**Expected.** A summary after a template/delete: "3 students unseated in 2 classes; 1 keep-apart rule now broken in
3rd Period". `roomDropDesks` already touches every class, so the information is at hand.
**Responsible.** `openRoomTemplates` (`data-tpl` handler), `roomDropDesks`, `bindRoom` → `#rmDel`.

## 12. "Partners" means different things depending on how the row was drawn

**Repro.** Templates → Straight rows (gap 24 → centres 94 apart) vs Grid… with "Group desks in pairs" off (gap 12 →
centres 82 apart). `PARTNER_D` = 88.
**Saw.** In the template, row-mates are "neighbors"; in the Grid, every row-mate is a "partner": two-lows and
high+high partner costs apply, issue text says "are partners", "New partners" counts them, why-here lists "Partners:
…" for desks that are just next to each other in a row.
**Expected.** One definition, or the Grid's no-pairs gap matching the template's.
**Responsible.** `bindRoom` → `#rmGrid` (gap 12), `ROOM_TEMPLATES.rows` (gap 24), `geometry` (`PARTNER_D`).

## 13. Print copies: small wording and mode issues

- The print dialog calls the student/sub copy "safe to project". It prints full names and photos; Tally's own rule
  (README, Race/Data Lab) is that student-facing screens never show names. "Safe to leave for a sub" is true;
  "project" isn't, by Tally's standard. (`openSeatPrint` copy inherited from v8.)
- With Names off, the sub copy prints initials ("H. S.") — a sub can't use it, and nothing in the dialog says so.
  (`svgChart` safe branch uses `H`.)
- The teacher copy's `<p>` says "9/27/2026 · 23 students · teacher copy" — the count is seated desks
  (`Object.keys(seats).length`), so with a ghost (#1) or an unseated student it's wrong.
- The teacher desk now reads "Teacher" (v8: "Mr. Shaffer") and the header lost v8's course · room line. Minor, but
  the sub copy used to say which room it was for.
What's right: neither copy prints standing, accommodations or notes; the sub copy has no dots, tags or locks
(verified in the popup DOM). ESE/504 tags print only on the teacher copy, as v8 did.

## 14. Lost from v8 (a teacher used these)

- **Roster tab**: search box, and one-tap L/M/H + "F" (front) toggles on every student card. In Tally each
  behavior change is open sheet → tap → Done → full re-render (23 students = 69 taps on the tablet at the start of
  the year). `renderSeating` Students list has room for the toggles.
- **"N students have no FAST score — treated as mid-level" alert** on the roster. Tally shows the phrase only inside
  one student's sheet.
- **Missing-since / Restore** handling for students who drop off the import (v8 `active:false`, "Not in latest
  import"). Tally's equivalent is the roster-mismatch notice, but seating doesn't react to it (#1).
- **Confirm on Clear saved** (#9).
- Teacher-desk label and course/room on the print header (#13).
Nothing else I checked was lost: templates, drag/zoom/nudge/undo, locks, hover preview, consequence diff, unseat/
reseat, both print modes, weights, keep-apart hard rule, seat-near, prev-partner freshness, FAST level dots all came
across with the same numbers.

## 15. Small things

- `seatBase` (the random baseline behind the fit) is only reset when a sheet closes or a v8 backup is imported.
  A weekly gradebook import changes every standing but not the cached baseline, so the fit shown on the saved chart
  the next morning is against last week's random charts. Off by a few points at most. (`seatBaseline` key.)
- Standing in the Students list is a bare number whose breakdown is a `title` tooltip — invisible on the tablet and
  the Promethean.
- "Row 1 of 9" in a horseshoe: every side desk is its own "row" (`rowIndex` groups by depth only), so why-here says
  "Row 7 of 9 · front three-quarters ✓" for a desk that is physically at the front-left.
- `seatMove`'s locked-student toast builds a name from `{ display: a, first: '', last: '' }` when the student isn't
  found, which prints ", " with Names on.
- The chart legend line "number = standing (FAST · Focus · IXL)" refers to numbers that are on the Students list,
  not on the chart (desks show initials, dots and tags; empty desks show desk numbers) — I looked for standing
  numbers on the desks first.

---

## What's solid (checked, not assumed)

- **Weekly re-import is safe on the pool path.** Re-dropping the same Focus gradebook and the course-wide IXL export
  left `sec.seating` byte-identical and every `seatInfo` field intact (plan, accommodations, links, behavior).
  Keying students by the Focus roster line was the right call for this.
- **Standing is live.** `seatStudents` recomputes from the current gradebook and IXL every render — a new import
  moves the numbers with no extra step, and the band/why-here follow.
- **The sheet saves however you leave it** — Done, ×, Escape, or a tap on the backdrop all persist nick,
  accommodations and notes (`onchange` fires on blur first). Keep-apart / seat-near are symmetric and mutually
  exclusive in both directions, verified in state.
- **Consequences are honest.** Hover "If dropped here: fit 77 → 39 ⚠ Greer Pryor needs a front seat — sitting in
  the back ⚠ Blake Abbott should be near the teacher desk — isn't" matched the post-swap report exactly; Undo
  restored the prior seats.
- **Why-here reads well** for a flagged student: row, band line with ✓, Front-seat ✓, "ESE: preferential seating;
  extended time" as its own plan-styled line, partners and nearby with (H) tags, the note. That is the panel I'd
  keep open during a parent conference.
- **Groups of 4** geometry is right: every desk has exactly 2 partners (side, front/back) and the diagonal is a
  neighbor; "front third" in a 2-pod-row room is the first desk row only, which is what "front seat" means in pods.
- **Desk ids are stable through template changes**, so a saved chart survives Partners → Pods with the same count,
  and shrinking a template moves only the lost desk's occupant to "Not seated".
- **Locks** survive regeneration and Save; the Generate button says "(keeping 1 locked)".
- **Names off** masks chart, Students list, the sheet header and every relation chip (initials), and hides photos —
  everything except the cached move panel (#4).
- **No page errors** in any run; the solver finished 23 × 24 in well under 2 s each time.
