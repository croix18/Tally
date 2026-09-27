# Tally — round 3 review: The Administrator (district technology & privacy)

Lens: student-data exposure on shared and projected devices, correctness of the record, equity of the grading
and ranking tools. Findings only, ranked most severe first. Verified with Playwright against a scratchpad copy of
the repo (shipped build for the no-debug-handle / no-network checks, `--test` build for everything else; state =
both course pools + `focus_gradebook_pool_p1/p2.csv` → 1st acc, 2nd on-level; viewport 1920×1080). Harness:
`scratchpad/admin.js`, screenshots in `/tmp/tally-test-E2r1wH/`.

## What is solid

- The shipped `Tally.html` has no `window.__tally` (`typeof` → `undefined`) and makes **no request** other than the
  page itself across import, Overview, Grades, Race and every Data Lab graph type (1 request total, `file://`).
  The only `http` string in the file is the OOXML namespace URI in the xlsx reader.
- `esc()` is applied consistently. Crafted student names, unit names, skill names, assignment names (with quotes
  and `<img onerror>`), and a gradebook student name all rendered inert in the grid, unit view, Grades table,
  student card, print window, digest, Data Lab option list, SVG `<title>`, and Settings. One hole (finding 4).
- The student card and digest use `#modal.private` (94% paper + 24px blur); nothing beneath is legible
  (`card-hidden.png`). Escape closes them; reload lands on the Overview, which carries no names.
- Projected mode: `#top`/`#app` are `visibility:hidden`, toasts are suppressed (`toast()` returns in `lbMode`
  unless `fromLb`), Enter/Space on the exit pill and Escape do not exit, reload stays projected, and
  `hideNames` is forced on entry and stays on after exit.
- Storage is honest about itself: the Settings "This computer" copy matches what `tally.v1` holds; the backup
  toast says it contains names, skill counts and computed grades; the course-settings file really has no names.
- Rows under 5 students are suppressed in the Data Lab; the Race hides a 1–2 student remainder.
- Boot is wrapped: a null section or a non-array `order` is set aside as `tally.v1.broken` and the app still opens.

## REQUIRED

### 1. Focus gradebook scores are projected, one dot per student, and the projected screen lets anyone browse them
**Repro.** Import an IXL export and a Focus gradebook → Race → Data Lab → in the data-set dropdown pick any
entry under a category group (e.g. `Unit 1 Assessment`) → Dot plot; tap Values and Show stats.
**Saw** (`lab-gb-dots.png`): 23 exact assessment scores (7, 7.5, 8 … 21 of 21) as dots, then listed as chips,
with min/max; Circle graph shows `F: 13 (57%)`, `A: 2`; Histogram / Stem-and-leaf / Bar give the same
per-student values. The dropdown, graph type, Values and stats controls are all live on the student-facing screen
(only *exit* is hold-locked), so a student at the Promethean can switch from an IXL unit to any quiz or test column,
and from box plot to dot plot, without the teacher.
**Expected.** Assessment/classwork scores are education records. Even without names, a class of 13–23 with a
visible "min 7", "1 F", a lone outlier dot, or 23 listed values is small-n disclosure: the student with the lowest
score knows it is theirs and so do the students who saw them get the paper back. The 5-student floor is a floor for
"is a plot drawable", not for "is an individual identifiable". `gb:` data sets should not be on the projected
surface at all (or only as class averages / letter counts with a floor of ≥10 per slice, no min/max, no Values,
no dots), and the dataset/graph controls should be behind the same hold as exit, or the teacher should choose the
data set before projecting.
**Responsible.** `app.js` `labDatasets()` (adds every gradebook assignment under `add(c, 'gb:'+a.name…)`),
`labSeries()` (`gb:` branch returns raw `a.values`), `labMarkup()` / `valuesMarkup()` / `labPlot()` (dots,
stem-and-leaf, circle with letter counts via `LETTER_COLORS`, stats cells `min`/`max`/`outliers`), and
`renderLeaderboard()` which wires `#labUnit`, `#labKind`, `#labValues`, `#labStats` on the projected screen.
The same applies, less severely, to `skill:` data sets (every student's SmartScore on one skill, with "N not started")
and to the `· N excused` label on a projected row (`labMarkup` `row()`): "1 excused" on a projector says one child
had an accommodation this week.

### 2. Hold-to-exit lands on whatever teacher screen was open — including the Grades table with letter grades per student
**Repro.** Open a class → Grades → Race (enter projected) → hold to exit.
**Saw** (`after-exit-grades.png`): the panel immediately shows the Grades screen: letter counts, the IXL-vs-
assessments scatter (hover titles `D. Q.: IXL 12% · assessments 33%`), the assignments table with missing counts,
and below the fold the Students table `D. Q. · 28 F · 1 missing · Classwork 0%`, tagged *sliding*. Names are
initials — in a class of 23, initials identify almost everyone, and the class knows who "D. Q." is. The same
happens from the grid (every student's points per unit) and from the unit view (every SmartScore).
**Expected.** Exiting a student-facing screen on a projected device must land on a screen that carries no
per-student data: the Overview. `view` should be reset to `home` on exit (and arguably on entry), and the
`hideNames` guard should not be treated as sufficient for projection — the guide says "Turn Names off before
projecting anything", which implies the grid/Grades are projectable with initials. They are not; only Race and
Data Lab should ever be on the panel.
**Responsible.** `app.js` `renderLeaderboard()` hold timer (`state.settings.leaderboard = false; save(); render();`
— `view` untouched) and `enterProjected()`; the guide text in `openGuide()` ("Names … Off = initials only, for
projecting") and the `#btnHide` title.

### 3. "Clear all Tally data" leaves `tally.v1.broken` — a full copy of names, IDs, scores and grades — on the shared machine
**Repro.** Cause a boot failure once (any malformed save, e.g. a `null` section — Tally writes the whole prior
state to `localStorage['tally.v1.broken']`), then Settings → Clear all Tally data.
**Saw.** After the wipe the only key left is `tally.v1.broken`, still holding the complete previous state
(rosters with Focus student IDs, IXL scores, gradebook cells, computed grades). Nothing in the UI ever reads,
shows, restores or deletes it; it survives every future Clear.
**Expected.** Clear must remove every key Tally writes (`LS_KEY`, `LS_KEY + '.broken'`, `GB_KEY`). The
"broken" copy should also expire (one boot) or be offered for download and removed. The Settings copy
("Everything Tally shows … is saved in this browser. On a shared computer, clear it when you're done") is
currently false on any machine that ever had a boot error.
**Responsible.** `app.js` boot `catch` (line ~124, writes `.broken`), `openSettings()` `#wipe` handler
(removes only `LS_KEY` and `GB_KEY`).

### 4. Stored XSS through a file name in the import-failure toast
**Repro.** Rename any non-IXL file to `<img src=x onerror=alert(document.cookie)>.csv` and drop it on Tally.
**Saw.** The `onerror` handler ran (harness hook fired `filename`); the toast reads ".csv: This does not look like an
IXL Score Grid export…" because the `<img>` was parsed as markup. Every other render path escapes; this one
concatenates `f.name + ': ' + e.message` and hands it to `toast()`, which sets `innerHTML`.
**Why it matters here.** A file name is the one input a student can control on a shared classroom device
(a USB stick, a Drive share named to look like an IXL export). Script in this origin reads `localStorage`
wholesale — every roster, ID, score and grade — with no network guard to stop exfiltration by, say, an `<img>`
to an external URL.
**Expected.** `esc(f.name)` and `esc(e.message)` in the failure message (or a `toast` that takes text by default).
**Responsible.** `app.js` `importFiles()` line ~275 `fails.push(f.name + ': ' + e.message)` and line ~304
`toast(fails.join(' — '), true)`.

### 5. The "Still owed" initials handout is described as "safe to hand to students" — it is a class-wide list of every student's gaps
**Repro.** Class → ⋯ → Still owed (print) → OK (initials).
**Saw.** One page listing `G. P.`, `B. A.`, `S. C.` … each with "Below goal (67): …" and "Not started: …" for
every assigned unit, footer "· initials". The confirm dialog says "OK = initials (safe to hand to students)".
**Expected.** A handout that goes to students must be one student per page (their own row only), or the copy must
say "for the teacher / co-teacher only". Initials in a 13–23 student class are directly identifying in that
community; distributing another student's progress list is a FERPA disclosure regardless of the masking.
**Responsible.** `app.js` `openStillOwed()` (single page for all rows; `confirm()` copy).

### 6. No access control on the classroom Chromebox: the full record is one tap from the Overview
**Repro.** On the panel (or any shared computer) open Tally cold. It opens on the Overview (no names) — but tapping
a class card shows the grid with initials; tapping **Names** shows full names; **Grades** shows every grade;
Settings shows the roster with Focus student IDs; **Save backup** downloads it all as JSON.
**Saw.** `tally.v1` on the test state is ~400 KB and contains: 91-student pools with every SmartScore, rosters
as `1111100000\tPRYOR, GREER`, gradebook `ids`, `overall` grades, `raw` Focus cells, `gradeHistory` per student,
`history.per` keyed by full name. All plaintext, no passphrase, no session lock, persists across reboots
(NOTES plans to move the panel to a GitHub Pages origin precisely so it persists).
**Expected.** For the projected/shared device either (a) don't persist there — a "projector mode" that loads a
backup into memory only for the lesson, or (b) a teacher passphrase gating the Names toggle, Grades, Settings and
backup, with the Overview and student screens open. At minimum the README/guide must say the panel should never
hold a class's data between lessons. The "Guide" line "On a shared computer: Settings → Clear all Tally data when
done" is the only mitigation and depends on the teacher remembering (and see finding 3).
**Responsible.** Storage design (`save()`/`load()`), `renderHome()` → `renderGrid()`, `$('#btnHide')`,
`openSettings()`.

## RECOMMENDED

### 7. Race and "All units" movement count review and upcoming units that the Settings copy says leave the Race
**Repro.** On-level class (Unit 1 is a review unit; "Working in" Unit 3, so Units 4+ are upcoming). Compare
`history[last].per[student]` with skills at goal in *assigned* units only.
**Saw.** For the first on-level student: snapshot `per` = 28, assigned-only = 21; the 7 extra are review/upcoming
units (`Unit 1, 4, 5, 6, 7, 9, 11, 12, 13` are hidden/upcoming for that class). `snapshot()` and
`leaderboardData().totalNow` both use `activeIdx(s)` (every non-skipped skill in the file), so "moved up" and
"skills per student" in the Race, the digest's movers list, and the Data Lab "All units · skills at goal" all count
work in units the class was never assigned. Settings copy: review units "leave the Race, Data Lab, Focus check and
copies". The completion bar does honour assignment; the headline (movement) does not.
**Why it matters.** Equity: a class with several students working ahead in IXL at home wins the movement race
over a class doing exactly the assigned work; the digest names "Biggest movers" on the same basis.
**Responsible.** `app.js` `snapshot()`, `leaderboardData()` (`totalNow`/`masteredAll`), `labSeries()`
(`unit:__all__` branch), `home.js` `digestFor()` (reads `per`).

### 8. Race headline says "nearly all moved up" when nobody did (small measured n)
**Repro.** Any class whose previous snapshot covers ≤2 students (first week after a roster change, or two new
students plus a re-imported pool). Fabricated `measured: 2, movers: 0`.
**Saw.** Headline `nearly all · moved up` with `active = 0`. The rule is `rest = measured - movers; if (rest < 3)
→ "nearly all"`, which fires whenever fewer than three students *didn't* move — including when no one did.
**Expected.** Guard on `movers` too (e.g. show "nearly all" only when `active ≥ 0.75`), and when `measured < 5`
show "first week" rather than any share.
**Responsible.** `app.js` `lbMarkup()` `headline()`.

### 9. "Sliding" flags bookkeeping events and model changes, not student behaviour
**Saw (from source).** A student is *sliding* if their rounded grade fell ≥3 **or** their missing count rose by
any amount since the previous gradebook import. When a new assignment is entered with NHI for everyone who hasn't
turned it in yet, all of them are tagged *sliding* on the Overview card, the Grades table (`<span class="gtag">`)
and the digest. Separately, changing a category (`[data-cat]` select) or the weights re-snapshots only today's
`gradeHistory` entry; the previous entry keeps the old model, so the next digest reports "slid −4" for students
whose grade only changed because the category map did.
**Expected.** "More missing" should require the assignment to be past due by more than the import interval, or be
reported separately ("new missing work") rather than under a label that reads as a judgement; a category/weight
change should re-snapshot every history entry it can (assignments are stored per entry) or mark the trend as
"model changed".
**Responsible.** `grades.js` `renderGrades()` (`sliding` rule), `home.js` `gradeSummary()` / `digestFor()`,
`grades.js` `openWeights()` and the `[data-cat]` handler (`gradeSnapshot(s)` only).

### 10. Students with no scores yet are dropped from the gradebook — and therefore from the auto-filled roster and every copy
**Saw (from source).** `parseGradebook()` skips any row whose assignment cells are all blank ("e.g. an inactive
student with no scores"). A newly enrolled student in Focus with no grades yet is thus absent from
`gb.students`, absent from the roster Tally fills from the gradebook, and appears as "in IXL, not on roster"; the
Copy column omits them and the receipt records nothing for them. The Focus check can't see them either.
**Expected.** Keep blank rows (they are on the Focus roster by definition) or at least list them in the import
toast.
**Responsible.** `app.js` `parseGradebook()` line ~800, `gradebookRosterText()`.

### 11. Old saves can blank the app at render time (no boot safety net there)
**Repro.** Seed `tally.v1` with a section whose `grades` has `assignments` but no `students` (the shape the
sessionStorage-era build could leave), or an assignment with `max` but no `values`.
**Saw.** Boot succeeds (`bootError` null, nothing set aside) but `render()` throws
(`Cannot read properties of undefined (reading 'join')` / `(reading '0')`): the header renders, the body is empty,
and it stays that way on every reload — with all the data still in localStorage and no UI path to recover except
the Settings button, if it happens to render. `load()` only checks `grades.assignments` is truthy.
**Expected.** Validate `grades.students` (array, same length as each `assignments[].values`/`status`) in
`load()`/`migrate()` and drop the gradebook (keeping `gradeHistory`) when it doesn't fit; wrap `render()` at boot
the same way `load()` is wrapped.
**Responsible.** `app.js` `load()` line ~24, `migrate()`; `grades.js` `gradeAll()` / `computeGrade()`.

### 12. Names toggle gaps
- **Loose-match tooltip.** `renderGrid()` `nameCell` emits
  `title="Matched loosely to ${esc(r.ixlName)} — tap to change"` on the masked name button; hovering with the
  Chromebox mouse shows the full IXL name while Names are hidden. (No loose matches in the pool fixtures, so
  verified from source, `app.js` line ~1055.)
- **Search.** "Find a student…" matches on the full display name while names are hidden: typing `GREER` filtered
  the masked grid to one row (`renderGrid()` filter uses `r.display`). Anyone at the keyboard can resolve
  initials to a name by trying first names.
- **Copy by hand.** `showCopyBox()` is not `.private` and shows the copy text in a textarea; in `names` mode
  (forced whenever a class has no roster) that is `LAST, FIRST\tpoints` for the whole class, regardless of the
  Names toggle. On the panel, a failed clipboard write projects the roster.
- **Roster panel.** `renderRosterPanel()` renders `esc(s.roster)` into the disabled textarea when names are
  hidden (only matters when a roster has text that failed to parse).
- **Student print page** (`printStudentCard`) and the digest print use the full name / whatever the digest was
  built with; that is the right behaviour for a conference sheet, but the button is available while Names are
  hidden and the toggle's title says "hidden … before projecting". Worth a confirm like Still owed has.

### 13. Backup and file copy: what the copy says vs what is in the file
- The backup toast says "student names, weekly skill counts and computed Focus grades". The file also holds
  **Focus student ID numbers** (the roster line is `1111100000\tPRYOR, GREER`), aliases, ignored IXL accounts and
  per-import missing-work counts per student. Say "names and student IDs".
- "Remove this class" says "Its roster and exclusions go too" — but the class's students' IXL scores stay in
  `state.pools[prep]` (91 students), and `state.custom` keeps that class's values under its key.
- Clear does not close print windows already open (Still owed / student card / digest are separate windows with
  full names) and cannot recall files saved to Downloads (backup JSON, unit CSV keyed by student ID, saved Race /
  Data Lab pages). The Settings "This computer" paragraph should mention Downloads on a shared machine.
- `downloadUnitCSV()` quotes cells but does not neutralise leading `=`, `+`, `-`, `@` — a pasted roster line or
  a Focus name starting with one of those becomes a formula when the CSV is opened in Excel/Sheets (low
  likelihood, standard hardening).

### 14. Category map is shared across every class of a prep by assignment *name*
`state.grading[prep].map[name]` is one entry per assignment name for all classes of that course.
`applyCategories()` on a later class's import overwrites a `fit`/`file`/`guess` entry (never `user`) with that
class's fit — silently changing the computed grade for the class imported earlier when two classes use the same
name for differently-weighted work. The earlier class does get the "grades don't all match Focus" attention line,
so it is not invisible, but the cause isn't named. Key the map by class, or by name only when the fit agrees
across classes. (`grades.js` `applyCategories()`, `catOf()`.)

### 15. Copy and labels around projection
- `#btnHide` title / guide: "Off = initials only, for projecting." Initials are identifying in a class; the guide
  should say only Race and Data Lab are for the projector.
- The Race exposes "N students" and "done of possible skill-points" per class — fine — but until a "Working in"
  unit is picked, `assignedUnitsForPrep()` is the *union* of what any class in the prep auto-assigned (≥25% of
  that class started the unit). In the test state the on-level league read "assigned: Unit 2 – Unit 10" from one
  synthetic class's spread, and every on-level class's `completion` is then computed over that union, deflating
  the classes that haven't reached those units. Once `currentUnit` is set this goes away; the first-week Race
  should say "no working unit chosen" rather than rank on the union. (`leaderboardData()` `aUnits`, `unitsOf()`
  `auto`.)

## Notes for the record

- Not re-reported (accepted): `Scrub.html` `__scrub`; two-imports requirement for Race/trends; pool one-class-per-
  student.
- Verified-clean surfaces: Overview (no names anywhere, including the needs-attention list and chart tooltips);
  Race cards (class label only; label is teacher-editable and the field says "what students see"); tab strip
  hidden in projected mode; digest and student card private backdrop; notices lists (`list()`), receipt, Focus
  check, match fixer, not-on-roster dialog and Settings match report all honour the Names toggle; the
  course-settings export has no names; toast suppression in projected mode.
