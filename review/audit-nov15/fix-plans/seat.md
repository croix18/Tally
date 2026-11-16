# Plan for fixer SEAT: the seating engine   (clone /home/claude/work/fix/seat, branch fix-seat, new suite tests/audit-nov15-seat.js)

Your file: seating.js. Findings: review/audit-nov15/reports/seating/FINDINGS.md; probes: review/audit-nov15/probes/seating/ (they share h.js). Read SEATING_SPEC.md first.
Suites to keep green: seating, auto-place.

1. SEA-04 (High, data loss). Room Undo puts back every class's saved chart from before the room edit, deleting charts saved since. Fix: roomPush keeps each class's `savedAt`; roomUndoPop restores a class's chart only if its `savedAt` still matches; otherwise it leaves that chart alone and only re-seats students whose desks came back with the undo. Probe 04.
2. SEA-01 (Medium). seatStudents counts IXL over every assigned unit, closed quarters included, so Seating says 17 % where the Students screen says 6 %, and the figure feeds standing. Fix (tried by the counter, seating suite 69/0): `ixlFor(sec, r.ixl).pct`. Before you finish, check whether the "Assessments" place-by basis (ixlVsTests) follows the same open-quarter rule, and report what you find without changing it. Probe 01.
3. SEA-02 (Medium). An empty or partial chart shows a green fit of 100 beside "23 hard". Fix: in the render, show no fit number while anyone is unseated (say "N without a seat" instead) and never show 100 when the baseline is 0. Leave scoreSeats alone so the move deltas still work during hand seating. Probe 02.
4. SEA-12 (Medium). A keep-apart or seat-near link stored on only one of the two students is read in one direction, so a hard rule is silently not enforced. Fix (tried, 69/0): check `a.apart.includes(b.id) || b.apart.includes(a.id)` in buildModel, explainSeats and whyHere, and the same for `together`. Probe 12.
5. SEA-03 and SEA-11 (Low). "saved <date>" shows the UTC day and crashes on a savedAt that is not a string. Fix: format through the local-day helper that the "gone" date uses, make it tolerate a number or junk, and coerce savedAt to a date string when a Seating Chart backup is imported. Probes 03, 11.
6. SEA-06 (Low): whyHere's lines are gated on `seatW(k)`, so a priority at weight 0 raises nothing (and the "keeps other H students away" line is not printed at weight 0). SEA-07 (Low): percentiles use `ordinal()` (conference.js, same scope) so "22th" becomes "22nd". SEA-09 (Low): why-here and the issues list use one threshold for partners, the solver's own (pairCost >= 0.5). Probes 06, 07, 09.
7. If trivial: printSeating's "N students" counts only seats whose student is on the roster.
Do not change SEA-10 (FAST level 1 under every "Place by": Croix's call) or SEA-05 (refuted).
8. Small and safe (from the saves audit): importSeatingBackup builds its idMap with Object.create(null), not a plain object.
