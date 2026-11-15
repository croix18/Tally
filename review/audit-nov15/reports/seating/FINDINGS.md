# SEA findings (auditor's report, condensed by the orchestrator from its final message; probes are in probes/, sharing probes/h.js)

### SEA-04  Room Undo discards charts saved after the room edit, in every class
- Class: DATA-LOSS · Severity: High · Where: seating.js roomUndoPop (line 613) restores each class's `seating` from the roomPush snapshot
- Claim: + Desk, Seat by hand, Save, then Room -> Undo: sec.seating becomes null (or the older chart).
- Repro: probes/04-room-undo-clobbers-save.js · Suggested fix: keep each class's savedAt in roomPush and restore only a class whose savedAt still matches (otherwise only re-add dropped seats), or clear roomUndo on chart Save / Clear.

### SEA-01  IXL completion in Seating counts closed-quarter units and disagrees with the Students screen
- Class: WRONG-INFO · Severity: Medium · Where: seating.js seatStudents (line 68; the ixl sum on line 73)
- Claim: 16 of 16 students differ (17 vs 6, 88 vs 100); the figure feeds standing. NOTES 14 Nov item 7 fixed the same disagreement elsewhere with ixlFor(sec, i).pct.
- Repro: probes/01-ixl-all-units.js · Suggested fix: use ixlFor(sec, r.ixl).pct (standings change: rerun tests/seating.js).

### SEA-02  Fit 100 for an empty or partial chart, and whenever students outnumber desks
- Class: WRONG-INFO · Severity: Medium · Where: scoreSeats (137) skips unseated students; seatBaseline (134) returns 0 when n > m
- Claim: an empty hand chart shows fit "100" beside "23 issues · 23 hard".
- Repro: probes/02-fit-unseated.js · Suggested fix: show no fit while anyone is unseated, or count each unseated student as a hard issue.

### SEA-05  Two students with the same name are one student to Seating
- Class: WRONG-NUMBER · Severity: Medium · Where: seatStudents: gbIdx keyed by name; seating id and seatInfo key = display
- Claim: twins with grades 38 and 100 both get 100, the same id and the same desk.
- Repro: probes/05-same-name.js · Suggested fix: join the gradebook by Focus ID; id = r.id || display; migrate seatInfo keys (the risky part).

### SEA-12  One-sided keep-apart or seat-near links are read in one direction only
- Class: FRAGILE · Severity: Medium · Where: buildModel (142), explainSeats
- Claim: a departed student who returns has a fresh record while others still list them: the hard rule is silently not enforced, while why-here says "TOO CLOSE".
- Repro: probes/12-one-sided-apart.js · Suggested fix: check both directions, for apart and together.

### SEA-03  "saved <date>" in the Seating bar is the UTC day
- Class: WRONG-INFO · Severity: Low · Where: renderSeatingBar (363) · Repro: probes/03-saved-date-utc.js · Suggested fix: the local-day helper used for "gone".

### SEA-06  Why-here still marks zero-weight priorities as failing
- Class: WRONG-INFO · Severity: Low · Where: whyHere (227) · Repro: probes/06-zero-weight-whyhere.js · Suggested fix: gate each line on seatW(k).

### SEA-07  Percentiles always end in "th" ("22th", "3th", "91th")
- Class: WRONG-INFO · Severity: Low · Where: standingText (92) · Repro: probes/07-ordinals.js · Suggested fix: conference.js's ordinal().

### SEA-09  Partner thresholds differ between why-here and the issues list
- Class: WRONG-INFO · Severity: Low · Repro: probes/09-pair-thresholds.js · Suggested fix: one shared threshold.

### SEA-10  DECISION: FAST level 1 counts as "low" under every "Place by"
- Class: DECISION · Severity: Low · Repro: probes/10-level1-other-basis.js

### SEA-11  A non-string savedAt breaks the Seating bar
- Class: CRASH · Severity: Low · Where: importSeatingBackup (843); app.js load (121) · Repro: probes/11-savedat-type.js · Suggested fix: accept savedAt only if it is a date string.

### SEA-08  CLEANUP: the seatBaseline cache key leaves out standings, room geometry and flags
- Class: CLEANUP · Severity: Low · Repro: probes/08-stale-baseline.js

## Suspicions (unproven)
- When no arrangement satisfies every keep-apart, all four options read fit 0 and cannot be compared.
- "If dropped here" previews on locked desks although the move is then refused.

## Cleanup and hardening
- printSeating's "N students" counts Object.keys(seats), which can include withdrawn students. Seat ids depend on display names: with no roster the rows are IXL names, so pasting a roster later marks everyone "gone".
