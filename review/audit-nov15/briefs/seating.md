# Auditor SEA: the seating engine   (tag SEA, directory /home/claude/work/audit/seating/)

The 14 Nov review listed the seating algorithm as NOT covered. Cover it.

## Scope (read all of it)
- seating.js, all of it; SEATING_SPEC.md; tests/seating.js, auto-place.js; the Seating Chart backup loader in app.js
  (grep "seat" in the "Saving and loading" section); NOTES.md: grep seating, standing, keep-apart, talker.

## Oracle
Your own scorer and your own constraint checker.
- Every claim the screen makes about a chart must be true: "why they're here", what a swap "fixes" and "breaks", the
  counts of constraints met and broken, each student's standing (the FAST percentile blended with the live Focus grade
  and IXL completion, with the documented weights).
- Hard constraints (keep-apart) are never broken when a valid arrangement exists: brute-force small rooms (6 to 8
  seats) and compare. When none exists, the screen must say so honestly.
- Locked seats stay. More students than seats; fewer; empty desks; a desk rotated or dragged (who is "next to" whom
  afterwards: the distance thresholds); front and near-teacher flags.
- The same input gives the same chart, or the randomness is seeded and stated.
- Missing data (no FAST, no grade, no IXL): no NaN anywhere, and a fair default.
- Printed copies: the student / substitute copy must show no standing, flag, reason or grade.
- Dates (the "gone" date was changed to the local day on 14 Nov: verify); withdrawn students; two students of one
  name; several classes sharing one room; Undo.
