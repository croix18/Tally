# Seating — design and how it fits Tally

Ported (27 Sep 2026) from Croix's standalone **Seating Chart v8** (`Seating_Chart_v8.html`, a 1.6 MB single file of
which 1.5 MB is pdf.js for the Focus Class List import). The room editor, geometry, scoring model, simulated-annealing
solver and move-consequence engine came across; the PDF import did not. v8 stays the once-a-year importer of photos
and FAST scores: its JSON backup (⋯ → Export) is dropped on Tally like any other file.

## Data
- `state.room` — one room for every class: `{ w, h, front: top|right|bottom|left, desks: [{id, x, y, r}], teacher: {x,y,w,h}|null, door: {x,y}|null }`.
  Desks are 70 units square (`DESK`), positions snap to 10. Desk ids are stable: templates reuse ids in numbered order,
  so saved charts follow desks when the room changes; deleting a desk unseats whoever sat there in every class.
- `state.seatWeights` — the eight priorities (0–10), defaults in `SEAT_FACTORS`.
- `sec.seating` — `{ seats: { deskId: display }, locks: { display: true }, savedAt }`. Unsaved edits live in
  `seatWork[sec.key]` (memory only) until Save.
- `sec.seatInfo[display]` — per student: `nick, behavior (low|medium|high), front, nearTeacher, plan ('' | ESE | 504 |
  ESE+504), accom, apart[], together[], notes, photo (48×60 JPEG data URL), level, pct, scale` (FAST PM3).
- Students are the class's **roster rows** (Focus `LAST, FIRST M`), so a chart survives IXL and gradebook re-imports.
  `seatStudents(sec)` joins each row to the gradebook (by name) and to IXL (by the roster match).

## Standing (what "low" means for placement)
**Place by** (Priorities → `state.seatBasis`): `blend` (default), `fast`, `grade` (Focus course grade), `tests`
(assessment average, IXL columns out — from `ixlVsTests`), `ixl` (share of assigned skills at goal). One source →
standing is that source's class percentile rank (FAST: the state percentile).
**Partners** (`state.seatPairs`): `mix` (default — two lows aren't partners), `tutor` (partner cost falls to 0 at a
50-point standing gap, so strong sits with weak), `similar` (the reverse). The "Partner pairing" weight is spent
whichever way is chosen (`pairCost`).
`standing` = mean of whichever exist: the FAST percentile, the class percentile rank of the current Focus grade, and
the class percentile rank of IXL completion on assigned units. Below 25 (or FAST level 1) counts as low: pulled toward
the front by the band rule (under 25 → front half, under 50 → front three-quarters), and two lows aren't partners.
The student sheet and "why here" show the parts ("FAST 12th pct (L1) · Focus 68% · IXL 40% → standing 31").

## Solver
Unary costs per (student, desk): front flag × depth, near-teacher flag × distance to the teacher desk, standing
band overshoot, fill-from-front. Pair costs by relation (none / neighbor within 2.2 desks / partner within 1.25):
behavior pairs, two lows, seat-near not satisfied, previous partners (from the saved chart). Keep-apart is a hard
constraint (1000). Simulated annealing in a Web Worker, 5 restarts × 300 ms, greedy polish, four distinct options
(≥15 % different). Locked students keep their desk across regenerations. Fit = 1 − cost / random-baseline (0 when a
hard rule is broken).

## Surfaces
- Class bar → **Seating** → `Chart` / `Room` segment; `Print`; `Priorities` (weights, `openSeatWeights`).
- Chart: Generate → options → fit → Save / Undo / Back to saved; issues list; tap a seated desk → why-here panel with
  Lock / Unseat / Edit; tap another desk → swap or move, with before→after fit and the issues added and fixed; hover a
  target desk → "if dropped here". Students list (tap → sheet). Unseated students are seated by tap.
- Room: templates (rows, partners, pods, trios, horseshoe, chevron), + Desk, + Row…, Grid…, front side, room size,
  teacher desk, door; drag / pinch / wheel-zoom; select → rotate, duplicate, nudge, delete; undo (30 steps).
- Student sheet (`openSeatSheet`, private backdrop): goes-by, behavior, flags, plan + accommodations, keep-apart /
  seat-near chips (symmetric, mutually exclusive), notes, standing line, link to the Grades card.
- Print (`printSeating`): teacher copy (photos, names, level and behavior dots, plan tags) or student/sub copy
  (photos and names only); every class with a saved chart, one page each.
- Names off masks the chart, list and sheet to initials and hides photos.

## Import of the v8 backup (`importSeatingBackup`)
Period → class: same section code (`1205050-7T1A`) if a per-section class exists, else the pool class of that period
number. Student → roster row by normalised `raw` name. Photos are re-encoded to 48×60 JPEG (~2 KB). Relations are
remapped to Tally names within the same class. The room comes in only if Tally's room is still empty; a saved chart
comes in only if the class has none and the desk ids exist. Weights merge. Unmatched names are listed in the toast.
The Tally backup (Settings) carries room, weights, saved charts and seatInfo.

## Round 4 (27 Sep, late)
See `ROUND4_FINDINGS.md`. Notables: `buildModel(sec, stu, G, withFresh)` — the fresh-partners term only when
generating; `seatCandsBy`/`seatUiFor` keep options and selection per class; `pruneSeats` frees seats of students
no longer on the roster; `cleanSeatInfo`/`cleanId`/`numOr` coerce everything from imports and backups; prints
ignore the Names toggle (`seatPlain`); "Seat by hand" when there is no chart or more students than desks.

## Later the same night
P2s closed: `roomPush`/`roomUndoPop` snapshot every class's seats; templates renumber before reusing ids; departed
students' seatInfo is stamped `gone` and dropped after 45 days (`Not on the roster` list, Forget); list search and
quick toggles; keyboard room editor; seeded fit baseline; `state.room.name` on prints; `shownLast`/`nick` = "Shown as".

## Not carried over / open
- The pdf.js Class List import (photos + FAST come via the JSON backup instead).
- v8's per-period rename/delete (Tally classes are managed in Settings).
- Ideas: use the chart on the Overview card; per-unit modified lists could feed seating.
