# Round 5 — district data-privacy / IT administrator audit: the whole of Tally

Lens: what student data Tally stores and emits, what a crafted file can do to it, what a passer-by sees. Test build
(`python3 build.py --test`), Playwright/Chromium 1400×900, state = both scrubbed course pools → 1st Period Accelerated /
2nd Period On-level from the two synthetic gradebooks, a 24-desk Partners room, a synthetic v8 Seating Chart backup
(47 photos, ESE/504 plans, accommodation text, notes, FAST) and a second IXL/Focus snapshot so movement and digests
exist. Every run had `page.on('request')`, `pageerror` and `dialog` listeners. Harnesses in my scratchpad
(`setup.js`, `a1-storage.js` … `a7-net.js`); nothing in the repo was changed. Rounds 3–4 items are re-reported only
where they regressed or were never closed.

Ranked most severe first; each has repro, saw, expected, responsible.

---

## P0

### 1. Every student's exact Focus assessment score is listed on the projected Data Lab — the round-3 fix only hid the button
**Repro.** Race → Data Lab (names are forced off, fine). With the default IXL unit dataset selected tap **Values** (a
legitimate teacher move: "read the quartiles by hand"). Now — you, or a student at the Promethean — pick any entry under
a Focus category in the *Data set* dropdown, e.g. `Unit 1 Assessment`.
**Saw.** The Values button disappears, but the chips stay: `7 7.5 8 9 9.5 9.5 10 11 11 11.5 12 | 12 | 12 12.5 12.5 13
15.5 16 17 17.5 18.5 20.5 21` — all 23 raw assessment scores of the class, sorted, labelled "lower half · median = Q1",
on the student-facing screen, in 19 px chips. `state.settings.labValues` persists, so it is still on next lesson and on
every gb: dataset; the **Save Data Lab** page (`downloadLeaderboard`) carries the same list. ROUND3_FINDINGS #1 was closed
on the basis that "Focus scores are never one dot per student on a projected screen"; dots were removed, Values was not.
**Expected.** `gb:` datasets never render `valuesMarkup`, whatever `labValues` holds (force `valuesOn = false` for
`gb:` the way `dotsOn` already is, in both `renderLeaderboard` and `downloadLeaderboard`).
**Responsible.** `app.js` `renderLeaderboard()` — `dotsOn` is forced off for `gb:` but `st.labValues` is passed
through; `labMarkup()` `row()` (`${valuesOn ? valuesMarkup(...) : ''}` has no `x.kind` check); `downloadLeaderboard()`.

## P1

### 2. The other projected routes to one student's Focus score: histogram bins of 1, box-plot min/max/outliers, circle counts of 1–2, "N excused"
**Repro.** Data Lab, a `gb:` dataset, on the projected screen: *Show as* → Histogram → *bins of 1*; or Box plot → Show
stats (twice) → Outliers; or Circle graph.
**Saw.** Bins of 1 on `Unit 1 Assessment`: `7–8: 2 students`, `8–9: 1 student`, `13–14: 1 student`, `15–16: 1 student`
(bar label "1", tooltip on hover at the panel) — a dot plot with extra steps. Box plot stats: `min 7 · max 21`; with
Outliers on, each outlier is a circle titled `Outlier 7` and listed in the stats strip. Circle graph: `A: 2 (9%)`,
`C: 2 (9%)`, `F: 13 (57%)`. Rows also print `· 1 excused` / `· 3 no score`. In a 13–23 student class the lowest score,
a lone outlier and a 1–2 student slice are known to the class; the min is the student who got the paper back last.
**Expected.** For `gb:` datasets on the projected surface: no bins smaller than 5 points, no min/max/outliers/mode, no
slice or bin under 5 students (suppress or merge), no excused/no-score counts; or keep Focus data off the student
screen entirely (the teacher has the Grades view for the same picture).
**Responsible.** `app.js` `labMarkup()` (stats cells, `row()` excused/missing line), `labPlot()` (`gb` allows
`hist`/`circle`), `renderLeaderboard()` (`#labBin`, `#labTukey`, `#labStats` live on the projected screen),
`charts.js` `chartHist` / `chartCircle` (no floor per bin/slice).

### 3. Prototype pollution through a Tally backup (`sections.__proto__`) — corrupts state, persists junk, blanks the app until reload
**Repro.** Settings → Load backup with `{"tally":4,"sections":{"__proto__":{"label":"POLLUTED","roster":"EVIL, ONE",
"threshold":5,"excluded":{"x":true}}}}` (scratchpad `a2-backup.js`).
**Saw.** `({}).label === "POLLUTED"`, `({}).roster === "EVIL, ONE"`, `({}).threshold === 5` — `Object.assign(state.sections[k], cl)`
ran with `state.sections['__proto__']` resolving to `Object.prototype`, so every one of `clean()`'s 15 fields became an
enumerable own property of `Object.prototype`. `migrate()`'s `for…in` then pushed `label, threshold, roster, rosterAt,
skipRoster, excluded, ignored, aliases, hiddenUnits, seatInfo, seating, studentSkips, prep, gradeHistory, history` into
`state.order`, `save()` persisted that order, and `render()` threw ("That file is not a Tally backup" toast, grid blank).
A reload heals it only because `Object.prototype` resets and `migrate()` filters the order. `constructor`, `toString`,
`hasOwnProperty` keys land on `Object` / the prototype functions the same way. The v8 path is immune (`byPer[__proto__]`
throws before writing); `Object.assign({}, state.assigned.acc, cfg.assigned.acc)` and `state.pendingCfg[k] = cl` set the
prototype of those objects rather than polluting `Object.prototype` (still: an own `__proto__` key in `assigned` makes
every unit "marked").
**Expected.** Only own, plain-named keys are restored: `Object.keys(cfg.sections)` filtered with
`Object.prototype.hasOwnProperty.call(state.sections, k)` and a key whitelist (`/^[\w-]+$/`, never `__proto__`,
`constructor`, `prototype`); build sections with `Object.create(null)` or check `hasOwnProperty` before `Object.assign`.
**Responsible.** `app.js` `#cfgFile.onchange` (`for (const k in cfg.sections) … if (state.sections[k]) Object.assign(state.sections[k], cl) … else state.pendingCfg[k] = cl`), `migrate()` (`for (const k in state.sections)` / `state.order.push`), `#courseFile.onchange` and `#cfgFile` `Object.assign({}, …, cfg.assigned.*)`.

### 4. Stored XSS through a Tally backup's `custom[].values` — fires in Settings → Edit data set
**Repro.** Load a backup with `custom: [{ id:'c1', label:'Minutes', prep:'acc', values: { 'period-1':
['</textarea><img src=x onerror="…">', 5, 6, 7, 8] } }]`; Settings → **Edit** on that data set.
**Saw.** The payload executed (`custom-values` hook fired). `openCustomEditor` writes
`${(c.values[x.key] || []).join(' ')}` straight into the `<textarea>`; every other custom field (`label`, `unit`, `id`)
is escaped, and the Data Lab renders the same values through `Number()` so it is safe there. `migrate()` keeps any
`custom` entry with an `id` and `label`; values are never coerced to numbers on load or restore, so the payload is
persisted and fires on every edit. Same class as round-4 #1, which was closed for `seatInfo`/`room` but not for `custom`.
**Expected.** `custom[].values[key]` coerced with `parseNums`-equivalent logic on load and restore (numbers only, capped
length), and `esc()` in the editor regardless.
**Responsible.** `app.js` `openCustomEditor()` (textarea body), `#cfgFile.onchange` (`cfg.custom.forEach(c => … state.custom.push(c))`), `migrate()` (`state.custom.filter(c => c && c.id && c.label)`).

### 5. A failed save is still reported as success on every path except the seating Save — and the work is gone after reload
**Repro.** Fill `localStorage` to the quota (`a6-quota.js`), then: import a Focus gradebook; Settings → rename the class
→ Save; skip a skill in the unit view; Copy a unit; Load a backup; toggle Names.
**Saw.** Import: the only toast is "Imported 1st Period · Accelerated (goal 67, 22 students)"; the persisted gradebook is
still the old file, the new one vanishes on reload. Settings: "Could not save — storage is full…" flashes and is
replaced by "Saved". Skip: "Skipped Convert fractions … for every accelerated class" (persisted skips: 0). Copy: the
copy toast, the receipt never persists. Backup: "Loaded settings for 1 class". Only the bare Names toggle leaves the
quota toast on screen. Round 4 #10 fixed `save()` to return a result; only `bindSeating` reads it.
**Expected.** Every caller that follows `save()` with a success toast checks the result (or `toast()` refuses to
replace an unexpired error toast); the import summary says "not saved — storage full" in red.
**Responsible.** `app.js` `importFiles()` (`save(); render(); … toast('Imported …')`), `openSettings()` `#mSave`
(`save(); close(); render(); toast('Saved')`), `renderGrid()` `[data-x]` / `[data-cell]` handlers, `copyUnit()`,
`#cfgFile.onchange`, `#courseFile.onchange`, `openCustomEditor()` `#cSave`, `home.js`/`grades.js` `[data-cat]`,
`seating.js` sheet `close()`; `toast()` itself.

## P2

### 6. Names off still shows each student's FAST percentile and level, Focus grade, ranks and behaviour on the Seating surface
**Repro.** Names off → Seating → generate → tap a desk; hover the standing number in the Students list; open a sheet.
**Saw.** Why-here for `L. S.`: "L. S. · **L1** · standing 63" then "**FAST 40th pct (L1) · Focus 55% (rank 50 in class) ·
IXL 88% (rank 98)** → standing 63", "Partner: W. Z. · 68", "Nearby: S. F. · 30, M. B. **(M)**", "**High behavior** — the
solver keeps other H students away". Students list: every row carries `<i class="st" title="FAST 0th pct (L1) · Focus 35%
(rank 7 in class) …">21</i>`. Sheet header: "Standing: FAST 0th pct (L1) · Focus 35% (rank 7 in class) · IXL 16% (rank
57)". Issues list: "L. S. & N. Y. are neighbors — both high behavior". Initials + a desk on a projected or mirrored
screen identify the child; FAST level and the Focus grade are education records, the behaviour rating is a teacher
judgement about a named child. Round 4 #8 closed plan/accommodation/notes/photos/nick; these fields were left.
**Expected.** With Names off the seating surface shows initials and seat geometry only: no standing number or tooltip,
no FAST/Focus/IXL line, no L-level, no behaviour tags or issue text naming behaviour — the same rule the chart already
applies to dots and plan tags.
**Responsible.** `seating.js` `renderSeating()` (list `title="${esc(standingText(x))}"`, `${x.standing}`), `movePanelHTML()`
(`x.level ? ' · L' + x.level`, `standing`), `whyHere()` (`standingText(s)`, `tag()` behaviour letters, "High behavior"
line), `explainSeats()` (behaviour text), `openSeatSheet()` (`Standing:` line, Behavior segment).

### 7. Search resolves initials to names while Names are off (grid and Seating) — round 3 #12 never closed
**Repro.** Names off, class grid: type `greer` in "Find a student…"; Seating: type `greer` in the list search.
**Saw.** Grid filters to one row (`G. P.`); Seating list to one row. Both match on the full display name
(`norm(r.display)`, and `data-n="pryor greer g p"` on every seating row — the normalized full name in a DOM attribute).
Anyone at the keyboard resolves every set of initials by trying first names.
**Expected.** When names are hidden, search matches the masked text only (or the search box is disabled with the roster
textarea, as Settings already does), and `data-n` holds no more than the masked name.
**Responsible.** `app.js` `renderGrid()` (`norm(r.display).includes(q)`), `seating.js` `renderSeating()` (`data-n`),
`bindSeating()` filter.

### 8. Junk in a Tally backup bricks a view permanently — with no boot-time guard, Settings and "Clear everything" can become unreachable
**Repro** (each a one-key backup, `a2-backup.js` "JUNK"): `custom:[{id,label,prep,values:null}]`;
`sections['period-1'].aliases = {'PRYOR, GREER': 5}`; `gradeHistory:[{date:'2026-09-01',grade:[1,2]}]` (no
`students`/`missing`/`assignments`); `grading.acc.map['Unit 1 Assessment'] = {}`.
**Saw.** `values:null` → "Cannot convert undefined or null to object" in `openSettings` — Settings never opens again,
before and after reload, so Remove class / Clear all Tally data are gone (the only way out is devtools). Alias number →
`a.includes is not a function` in `buildRows` — the class grid is blank on every reload (Settings happened to still open in this case). `gradeHistory` without `students`
→ `reading 'reduce'` in `gradeSummary` — the Overview (the boot screen) is blank. Object in `grading.map` → "Cannot
convert object to primitive value" — Overview blank. `clean()` type-checks the container (`typeof c.aliases === 'object'`)
but never the values; `render()` at boot is not wrapped like `load()` is, so nothing is set aside and no toast says why.
**Expected.** `clean()` / `migrate()` coerce leaves (alias → string, `rosterAt`/`savedAt` → ISO string or null,
`gradeHistory[i]` needs `students`, `grade`, `missing`, `assignments` arrays of one length, `grading.map` values → strings
in `cats`, `custom.values` → `{key: number[]}`); boot `render()` wrapped so a throwing view falls back to a screen that
still has Settings.
**Responsible.** `app.js` `#cfgFile.onchange` `clean()`, `migrate()`, boot (`render()` at the end of the IIFE),
`openSettings()` (`Object.values(c.values)`), `grades.js` `prevGradeSnap`/`renderGrades`, `home.js` `gradeSummary`.

### 9. The backup's disclosure line still understates what travels to Drive — round 4 #8 still open
**Saw.** Toast: "it contains student names, weekly skill counts and computed Focus grades". Settings copy: "Rosters,
goals, skips, matches, category weights, each student's weekly skill counts … and their computed Focus grade per import.
Not raw scores." The file also holds Focus student IDs (`1111100000\tPRYOR, GREER`), 47 photos, 13 ESE/504 flags with
accommodation text, free-text notes, FAST level/percentile/scale score, behaviour ratings, keep-apart links, saved charts
(146 KB for two classes). Same for "Remove this class … Its roster and exclusions go too" (also photos, plans, notes).
**Expected.** Say what is in it: "names and student IDs, photos, ESE/504 and accommodation notes, FAST scores, seating
notes, weekly skill counts and computed grades".
**Responsible.** `app.js` `#exportCfg` toast and the Settings "Backup" paragraph; `#forget` confirm.

## P3

### 10. Full names in `data-*` attributes under Names off (grid, fixer, seating)
`data-fix="QUILL, DAKOTA"` on the three roster flags in the grid (every view while a class is open, incl. the Race/Lab
overlay's hidden DOM); the fixer lists `data-pick="@pool:DAKOTA QUILL#0"` for all 136 unmatched pool students;
seating rows carry `data-n` (finding 7). Invisible on screen, visible in a screen-shared devtools pane or a saved page.
`renderGrid()` `nameCell`, `openFixer()`, `renderSeating()`. Masked correctly: every `title`, `aria-label`, placeholder
and value on the 30 surfaces scanned (`a4-names.js`), all toasts (including the v8 "not matched" list), the digest,
receipts, Focus check, Grades, student card, Overview, Race, Data Lab, and the hold-to-exit landing.

### 11. Unit CSV is open to spreadsheet formula injection
`downloadUnitCSV` quotes cells but does not neutralise a leading `=`, `+`, `-`, `@` in the Student / Student ID columns,
which come from the Focus export (or a pasted roster). A name like `=HYPERLINK(...)` in an export opens as a formula in
Excel/Sheets. Prefix such cells with `'` or a space. `app.js` `downloadUnitCSV()`.

### 12. Other import robustness gaps (in-session only, no persistence)
- A per-section IXL file with no student names whose name is `__proto__.csv` keys the class `__proto__`: the section is
  written to `state.sections.__proto__` (setter), `state.order` gets `'__proto__'`, and `state.order.sort` throws
  "reading 'localeCompare'" before `save()`. Clean after reload. `importFiles()` (`meta.key` from the file name).
- A course-settings file with `skipped: [null]` applies `goal` and `assigned` in memory, then throws on `sk.key`, shows
  "That file is not a Tally course settings file", and the half-applied change is persisted by the next `save()`.
  `#courseFile.onchange` (mutate-then-validate).
- v8 backup: `students: [null]`-style records are now filtered, but `periodId: "__proto__"` still surfaces a raw
  "push is not a function" toast (round 4 #10, open).

### 13. Print fallback still writes full-name HTML into Downloads without saying what it wrote
With pop-ups blocked, Still owed (names/slips), Student reports and both seating copies save
`Still-owed_1st_Period_Accelerated.html`, `Student_reports_…html`, `Seating_…html` with a toast that only says "saved as a
file instead" (round 4 #12). Fine on the teacher laptop; on a Chromebox kiosk profile that Downloads folder is shared.

### 14. Copy that over-promises
"One list, initials — **safe to post or project**" (Still owed) and the Guide's "Names: Off = initials only, for
projecting": initials in a 13–23 student class are identifying to the class. The seating print dialog's "Student / sub
copy — safe to project" is fine (names and photos are the point of a sub copy) but "project" should not be in it either.
`openStillOwed()`, `openGuide()`, `openSeatPrint()`.

---

## What's solid

- **Storage inventory (honest and bounded).** One key, `tally.v1` (≈500 KB for two classes: pools 248 KB, sections
  249 KB of which `skills` 38 KB, `scores` 24 KB, `seatInfo` 29 KB with 23 photos, `history` 18 KB, `best` 11 KB,
  gradebook 4 KB incl. `raw` cells, `gradeHistory` 2 KB). No IndexedDB, no sessionStorage after boot, no cookies. Rosters
  carry Focus IDs; snapshots are keyed by IXL name (`"GREER PRYOR#0": 8`); `gradeHistory` holds names + rounded grades +
  missing counts, never raw scores — as NOTES says.
- **Exports are what they say, except finding 9 and finding 1's page.** Course settings: 131 bytes, no names. Race page:
  class labels and totals only. Student reports: one page per student, that student only, no IDs. Still owed initials:
  masked; slips: one page each. Seating sub copy: names + photos, zero plan tags / levels / H badges / notes; teacher copy:
  no notes or accommodation text. Digest print: whatever the digest shows (masked when Names are off).
- **XSS.** Payloads in the IXL student, unit, lesson, skill name and skill ID; gradebook student, assignment name, cell,
  student ID and file name; roster line and alias; seating nick, accommodation and notes — 50 surfaces including all six
  print windows, the CSV, the toasts, the Data Lab option list and every graph type, before and after reload: zero
  executions (`a3-xss.js`). The round-3 file-name toast and round-4 seating sinks stay fixed.
- **Network.** Zero non-`file:` requests across every run; `http:`/`javascript:` photo values in a v8 backup and a Tally
  backup are dropped to `null` before they reach an `<img>`/`<image>`; a room `name` URL is inert text. The committed
  `Tally.html`/`index.html` have no `window.__tally`, no `<script src>`/`<link>`, and the only URL in the file is the OOXML
  namespace.
- **Projected mode.** Entering forces Names off and clears the toast; exit lands on the Overview with names still hidden;
  the Overview carries no names, photos, plans or FAST; toasts are suppressed. The v8 import toast masks unmatched names.
- **Clear everything** removes `tally.v1`, `tally.v1.broken` and the session key and lands on the drop zone; Remove class
  drops that class's seating data and chart.
- **v8 import coercion** (round 4) holds: ids, coordinates, weights, levels, photos all coerced; relations stay within
  the class; prototype keys in `students[].id` only re-point `idMap`'s prototype.
- **Big state.** 200,000 custom values load and render without error; 4.8 MB of filler beside a 420 KB state left the
  app responsive; `save()` itself names the quota correctly (finding 5 is about who listens).
