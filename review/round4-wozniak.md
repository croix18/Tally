# Wozniak — round 4 review: the Seating surface (correctness under edge cases and state transitions)

27 Sep 2026, evening. Test build `python3 build.py --test`; Playwright / Chromium; probes `p1.js`–`p7.js` in my scratchpad
(`/tmp/claude-0/-home-claude/…/scratchpad/w/`, setup copied from `tests/seating.js`: two course exports, `focus_gradebook_pool_p1/p2.csv`
→ period 1 acc / period 2 on). Nothing in the repo was edited. Every item below was reproduced in the browser unless marked
"by reading". Line numbers are `seating.js` unless another file is named.

## P0 — wrong numbers on the screen the teacher trusts, data crossing classes, or a dead view

### 1. Fit collapses to 0 the moment a chart is saved — and every move afterwards reports "fit 0 → 0"
**Where:** `buildModel` (l.79–81) builds `prevPartners` from `sec.seating` whenever `seatW('fresh') > 0`; `scoreSeats`
(l.101) then scores the *current* chart against that model. When the current chart *is* the saved chart (right after Save,
after reload, after "Back to saved", and every hand-edit of it), every partner pair is "a repeated partner" and costs
`fresh × 1.0` each — 12 pairs × 3 ≈ 36 soft points, which exceeds the random baseline (≈ 30–50), so `1 − t/b < 0` → 0.
**Repro (p3b.js F1):** Generate → Fit box 60, "No issues" → Save. **Saw:** Fit box **0** ("0 = no better than random"),
still "No issues"; after reload still 0; swap two students → consequence panel "fit 0 → 0 · No new issues either way";
set the *New partners* weight to 0 → the same chart reads 60 again.
**Expected:** the saved chart keeps the fit it was generated at; consequences on the saved chart show real deltas.
The "avoid previous partners" term belongs in the solver's objective for *new* options, not in the score of the chart
that defines "previous". As shipped, the number Croix will look at most (the saved chart's fit) is always 0 and the
whole move-consequence engine is blind on saved charts.

### 2. Option buttons from one class appear in another class and can be saved as its chart
**Where:** `seatCands` (l.185) is module-global, not per class; `renderSeating` (l.281) shows it for whatever class is
open; `bindSeating [data-cand]` (l.310) copies `seatCands[i].seats` (desk → *period-1 names*) into `seatWork['period-2']`.
**Repro (p1.js A):** period 1 → Seating → Generate (options appear) → tab period 2 → Seating.
**Saw:** the four "Option N · fit …" buttons from period 1 are on period 2's panel. Tap Option 1: 23 seats filled with
period-1 names, 0 desks drawn as occupied, all 24 period-2 students listed as "Not seated", Fit box **100**, Save enabled.
Save → `sections['period-2'].seating.seats` holds `PRYOR, GREER`, `ABBOTT, BLAKE`… (period-1 students). Same leak for
`seatLast` (the last move report) and `seatCands` after a reload of the other class's chart.
**Expected:** candidates, the last move and the pending "seat them" pick are per class (live in `seatWork[key]`), or are
cleared when the class or view changes (the `#openSeating` hook resets only `seatSel`/`seatPending`).

### 3. "Clear desks" → Chart tab throws and leaves the view blank
**Where:** `rmClear` (l.441) empties `state.room.desks` and `roomDropDesks` empties every `seatWork[k].seats` but leaves the
work object; back on Chart, `renderSeating` sees `w` → `scoreSeats` → `seatBaseline` → `randomAsg` with `m = 0` → `totalScore`
reads `G.rel[undefined][undefined]` → `TypeError: Cannot read properties of undefined (reading 'undefined')`.
**Repro (p4.js G3):** class with a generated or saved chart → Room → Clear desks → OK → Chart.
**Saw:** page error, `#gridwrap` empty (0 children), bar still says Seating. Same crash for any class with a working chart
once the room has zero desks (a fresh device after a Tally-backup restore of a room with `desks: []`, by reading).
**Expected:** the "No desks yet" notice; `scoreSeats`/`seatBaseline` must handle `m = 0` (and `m < n`).

### 4. A solve that finishes after you navigate away paints that class's chart over whatever is showing — including the Overview
**Where:** `seatGenerate` (l.189–201) is async and ends with `renderSeating(sec)` unconditionally; nothing checks that
`view.mode === 'seating'` and `state.active === sec.key`, and the worker isn't terminated on navigation.
**Repro (p1.js B, B2):** period 1 → Seating → Generate → within 1.5 s tap the period-2 tab (or Home).
**Saw:** 2.5 s later `#bar` reads "2nd Period · On-level" (the grid bar) while `#gridwrap` holds period 1's seating chart
with period-1 names; with Home the Overview cards are replaced by the chart (the Overview is where the class list lives).
**Expected:** cancel (`seatWorker.terminate()`) on navigation, or drop the result when the view moved on.

## P1 — data loss or misleading state on ordinary weekly paths

### 5. A student who leaves the roster stays seated as a ghost: the desk looks empty but can't be used, and a swap with it prints their full name with Names off
**Where:** nothing unseats a display name that no longer resolves to a `seatStudents` row. `svgChart` (l.237–254) draws
the desk as `empty` (dashed, numbered, aria "Desk 17 (empty)") because `byId[sid]` is undefined, but `w.seats[id]` still holds
the name, so: `act` (l.321) refuses to seat a pending student there (`if (!w.seats[id])`); tapping it selects it (`if (sid)`)
with no why-here panel and the hint "Tap another desk to swap"; tapping another desk runs `seatMove` and `nm(id)` (l.211)
falls back to the raw display name; `explainSeats` and "Not seated" never mention it; `Object.keys(seats).length` on the
print page counts it; `nLocks` counts it ("keeping 1 locked" for a student who left, p7.js J4).
**Repro (p2.js C–C3):** Generate → Save → remove one roster line (Settings / "Use the gradebook's list" does the same
when Focus renames a student — e.g. a middle name appears — since the new spelling is a new key) → Seating.
**Saw:** `stillInSaved: true`, desk 17 drawn empty, "No issues", 0 not-seated, list says 22 students. Names off → tap desk
17 → tap desk 1 → panel: "Swapped ELKINS, MORGAN and G. P." — the departed student's **full name** next to a masked one; the
page text contains the full name. Seating an unseated student onto desk 17 does nothing (still unseated).
**Expected:** roster reconciliation drops (or at least flags) seats whose student is gone; `nm()` masks with Names off;
a desk with an unresolvable occupant is treated as empty for seating and counted nowhere.

### 6. Re-importing a per-section IXL file drops the class's seating, seatInfo, gradebook and grade history
**Where:** `app.js importFiles` l.273–283 builds a new section object from `keep = prev || pend` and copies an explicit
field list that has no `seating`, `seatInfo`, `grades`, `gradeHistory`, `period` (only `best`/`receipts` are restored on l.285).
**Repro (p5.js H5):** import `ixl_7T1A_scrubbed_*.csv`, give the class seatInfo/seating/grades/gradeHistory, import the same
file again. **Saw:** `seatInfo: []`, `seating: undefined`, `grades: false`, `gradeHistory: 0`, `period: undefined`.
**Expected:** the weekly re-import keeps them (NOTES: "Per-section IXL files still work"; the spec: "a chart survives IXL
and gradebook re-imports" — it does for pool classes via `materialize`, not for per-section ones).

### 7. The backup "bridge" doesn't carry seating (or rosters) to a class that doesn't exist yet
**Where:** `app.js #cfgFile` l.1671 holds unknown classes in `state.pendingCfg`; (a) `askNewClass` (l.914–939) creates
`period-N` without ever reading `pendingCfg[key]`, so a pool class made after the restore gets nothing and the entry is held
forever (and re-exported by the next backup); (b) for a per-section class, `importFiles` l.271–283 applies only
`label/threshold/roster/…` from the held entry — `seatInfo`, `seating`, `gradeHistory` are dropped; (c) `#btnSettings` is
hidden until a class exists (`render` l.974), so on a fresh device the backup can't even be loaded before the first class.
**Repro (p5.js H3, H4):** export a backup from a Tally with period-1 + period-2; in a fresh context import both pools,
make period-1, load the backup ("1 class · 1 waiting"), then make period-2 from its gradebook.
**Saw:** `pendingCfg` still `['period-2']`, period-2 `seatInfo: 0`, roster from the gradebook only. Per-section held entry
→ class created with label + roster, `seatInfo: []`, `seating: undefined`, `gradeHistory: 0`.
**Expected:** the laptop → tablet routine in NOTES restores room, charts and seatInfo for every class once it exists.

### 8. Removing a class and making another under the same key inherits the old class's working chart
**Where:** `app.js #forget` l.1619 deletes the section but not `seatWork[key]`; `workFor` (l.187) returns the stash first.
**Repro (p2.js D):** period 1 acc with a generated (unsaved) chart → Settings → Remove → make period 1 on-level from
`focus_gradebook_pool_p2.csv` → Seating. **Saw:** `seatWork['period-1']` present, 22 foreign names in its seats, "Save as
this class's chart" enabled, everyone "Not seated". Same stash survives a backup restore onto an existing class (the restored
`sec.seating` is invisible until Discard) and a v8 chart import (by reading).

### 9. Seating info is keyed by IXL-derived names until a roster exists, then orphaned
**Where:** `seatStudents` (l.38) uses `buildRows`, which with no roster returns `ixlDisplay(name)` rows (`ASHBY91, DEVIN`);
`seatInfoOf` (l.32) creates and persists an entry per row on every render. The gradebook then fills the roster with Focus
names (`SUTTER, HAYDEN SKYLER`) — different strings.
**Repro (p6.js I1):** per-section class from `ixl_7T1A_scrubbed_*.csv` (no roster) → Seating → mark a student H + Front →
import `focus_gradebook_scrubbed.csv`. **Saw:** 23 orphan keys (`ASHBY91, DEVIN`, …), flags gone from the list.
**Expected:** either don't offer Seating before the roster exists (the grid already forces the roster panel), or key by the
same identity the grid uses.

### 10. Re-running the v8 import erases everything edited in Tally since, and a photo that fails to decode wipes a good one
**Where:** `importSeatingBackup` l.523 `Object.assign(info, {nick, behavior, front, nearTeacher, plan, accom, notes…})`
and l.528 `info.apart = …; info.together = …` replace unconditionally; l.524 `info.photo = await shrinkPhoto(...)` stores
`null` on decode failure.
**Repro (p5.js H1):** set nick/behavior/front/notes/keep-apart in Tally, give one student a photo, drop a v8 backup whose
copy of them has `nick: 'Vee'`, defaults, and a broken photo. **Saw:** nick `Vee`, behavior `low`, front `false`, notes `""`,
apart `[]`, photo `null`. The toast says "7 students matched" and nothing about overwriting.
**Expected:** the once-a-year import fills what's empty (photo, FAST) and asks before replacing Tally-side edits; a failed
photo keeps the existing one. Also seen: two v8 students with the same raw name — the last one wins silently; an entry with
no `raw` lands in the toast as an empty name ("2 not matched (; ORME78, JULES)").

## P2 — fragile, surprising, or noisy

### 11. Template switching doesn't keep students "by desk number" for the horseshoe, and Grid… / a smaller template silently unseat
`openRoomTemplates` l.489–490 reuses old ids in *old number order* but assigns them in the template's *build order*; the
horseshoe builds left column → back row → right column, which is not its front-to-back numbering. **p4.js G1:** rows →
horseshoe: desk 2 empty, VANCE moved 2→3, UNDERHILL 24→12, ABBOTT →24. The dialog promises "stay seated by desk number".
`rmGrid` with "Remove the desks already there" (default on when desks exist) mints fresh ids → every class's saved chart is
wiped (G4: 23 → 0 seated, no toast); a template with fewer desks unseats the rest with only "Straight rows: 2 desks." (G5).

### 12. Room Undo after deleting a desk brings the desk back but not the student
`rmDel` → `roomDropDesks` edits `sec.seating`/`seatWork` outside the room undo stack (`roomPush` snapshots only `state.room`).
**p4.js G2:** 23 seated → delete a desk → 22 → Undo (24 desks again) → still 22. The hint says "deleting a desk unseats
whoever is in it in every class" but Undo implies reversibility.

### 13. Weights from a v8 backup aren't validated → NaN costs, "fit 100" on every option, `NaN` in the Priorities dialog
`importSeatingBackup` l.533 spreads `obj.weights` raw; `seatW` does `+w[k]`. **p3.js E4:** weights
`{behavior:'lots', fast:-50, fill:{x:1}, bogus:3}` → dialog shows `behavior=5/NaN`, `fast=0/-50`, `fill=5/NaN`; Generate
returns four options all "fit 100"; Fit box 100. The Tally backup restore (`app.js` l.1659) takes `cfg.seatWeights` raw too.

### 14. The fit baseline is random and cached on the wrong key
`seatBaseline` (l.98) averages 30 random charts and caches on `key|weights|n|m`; `seatBase` resets on sheet close /
import / reload but not on room edits or flag changes made elsewhere. **p3.js E1:** the same chart reads 62 in the option
label and 62 in the Fit box, then 60, 61, 60, 60, 60, 58 after six sheet open/close cycles while the option label stays 62.
Two classes with the same n and m share nothing (fine), but a class with 22 students and 24 desks re-rolls its baseline every
time a sheet closes, so "fit 60 → 58" can appear with no move. Minor in size, but it is the number under "Fit".

### 15. Keyboard on the chart: Enter on a desk drops focus to `<body>`; Escape doesn't cancel a selection
`renderSeating` replaces `#gridwrap` innerHTML on every action, so the focused `.cdesk` is gone (**p6.js I6:** activeElement
`BODY`); a keyboard user has to Tab from the top after every tap. The document `keydown` handler (`app.js` l.1730) only
handles Escape for modals and the unit view; on the chart with a desk selected Escape does nothing (I5), and in Room it
doesn't deselect.

### 16. Print button stays disabled after Generate until something re-renders the bar; print-all prints the unsaved chart as if saved
`renderSeatingBar` decides `disabled` from `workFor(s)` but `seatGenerate` re-renders only `#gridwrap` (**p6.js I4a:**
disabled `true` right after Generate, `false` after tapping Chart again). `printSeating(all)` (l.386) uses the current
class's working chart under the same "— seating chart" heading as the saved ones (**p7.js J7:** period 1 unsaved, 2 pages).

### 17. Counts include departed students
"N apart" chips (`x.apart.length`, l.291) and "keeping N locked" (l.277) count names that no longer resolve to a student
(**p7.js J4/J5:** "keeping 1 locked" for a student who left; "2 apart" with one live link). The v8 import silently drops
keep-apart links to a student who ended up in another Tally class (by design per the spec — but the toast doesn't say).

### 18. Standing is class-relative, so a quarter of every class is "low" (design note)
`rankPct` is a within-class percentile, so in a class where everyone is at 90 %+ the bottom six still get standing < 25 →
band "front half", "two lows aren't partners", "(standing 12) is further back than the band suggests". With only one
source (no gradebook, or IXL not yet assigned) the whole standing is that one rank. Ties, n < 2 and all-null are handled
correctly (`rankPct` returns mid-rank / null / null, p6.js I2). Worth a sentence in the spec or an absolute floor.

## P3 — small
- `runSolver` creates a blob URL per Generate and never revokes it (p7.js J3: 2 alive after 2 runs).
- `seatingTargetFor` takes the *first* digit run in `per.name` ("Room 7 — Period 2" → period 7); a v8 chart whose desk ids
  don't exist in Tally's room is skipped without a word in the toast (p5.js H1).
- After a backup restore replaces `state.room`, the Room's Undo stack still holds the pre-restore room (by reading).
- `seatInfoOf` persists an all-default entry for every student the moment Seating is opened (23 objects per class in
  localStorage even if nothing was set).

## What's solid (exercised, no fault found)
- Worker error path: a throwing `Worker` → "Solver error: boom" toast, Generate re-enabled, working chart intact (p7.js J2).
- Pop-ups blocked → the print page downloads as `Seating_<class>.html` with a clear toast (p6.js I4).
- ctrl/⌘-wheel zooms about the pointer; a plain wheel leaves the stage alone; pinch state resets on pointer loss (I7).
- Photo import: 91 × 300×400 JPEG (14.5 KB each) → 1.6 KB each, **+40 KB** in localStorage, ~30 ms (I3). Real photos will
  be larger but the 48×60 re-encode bounds the stored size.
- `rankPct` ties (mid-rank), n < 2 → null, all-null → null; standing averages whichever sources exist (I2).
- Keep-apart / seat-near are symmetric and mutually exclusive through the sheet; the v8 import remaps relations by Tally
  name within a class (tests/seating.js §4, §7).
- Room, weights, saved charts and seatInfo survive reload and the Tally backup round trip for classes that already exist.
- `roomDropDesks` unseats in every class *and* in every `seatWork` stash when a desk is deleted or replaced.
- Moving a locked student is refused with a named toast; locks survive "Generate new options" (fixed desks honoured).
- Names off masks the chart, list, sheet header, why-here, hides photos and the notes line — except the ghost case in #5.
