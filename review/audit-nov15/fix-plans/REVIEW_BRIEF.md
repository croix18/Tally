# Tally audit, 15 Nov 2026: counter-review of the fixes

Tally is one HTML file a 7th-grade math teacher (Croix) uses to turn IXL and Focus gradebook exports into the grades
he copies into the gradebook of record, what-ifs for students, reports for families, and statistics charts for his
class. An audit found defects; a counter agent confirmed them; ten fixers then fixed them on separate branches, now
merged as branch `audit-fixes` (77 commits on top of `main`). His rule: *"Don't make any decisions before running
it against a counter agent."* You are that counter agent for the fixes. Nothing is pushed until you have tried to
break them.

## Your workspace
- `/home/claude/work/fix/<you>/` (named in your assignment) is your own clone, on `audit-fixes`, already built
  (`Tally.test.html`). `main` there is the code before the fixes: `git diff main...HEAD -- <file>` and
  `git log main..HEAD --stat` show what changed. You may change your clone to test an idea, but you report; you do
  not deliver fixes. Never push, never touch `/home/claude/tally` or other directories under `/home/claude/work/`.
- What each fix was meant to do: the plans in `/home/claude/work/fix/plans/*.md`. The findings and their
  reproductions: `review/audit-nov15/` (RESULTS.md, reports/, probes/, counter-probes/). The code map, how to read
  the very long lines and where decisions are recorded: `review/audit-nov15/BRIEF_COMMON.md` ("The code", "The
  intent is written down"). Each fixer's regression suite is `tests/audit-nov15-*.js`.
- Run anything that opens a browser through the queue: `/home/claude/work/fix/t node tests/run.js <names>` or
  `/home/claude/work/fix/t env TALLY_REPO=$PWD node <probe>`. Never run the whole suite. No subagents. Synthetic or
  scrubbed data only. Be economical: read each file once, keep tool output short.

## For every fix in your slice
1. Is it right and complete for its finding? Read the change; run the finding's probe on your clone.
2. What else did it change? Every caller of a changed function, every screen that shows the changed figure, every
   decision NOTES.md records about it, privacy (nothing student-facing may identify a student).
3. What new edge does it open? Data saved BEFORE the fix (a new field that old saves lack: does loading, saving and a
   Full save round trip still work?), null or empty cases, two students of one name, a class with no gradebook or no
   IXL, a kept quarter, speed on a full load.
4. Is its test real (would it fail on the old code), and does the area's existing suite still pass?
5. Are the words on screen true, plain American English, with no em dashes?
Then look at the fixes together: two fixes that touch the same quantity must agree.

## Your reply (compact: it is all the integrator reads; do not write a report file)
One block per defect you can PROVE (a script in `/home/claude/work/fix/<you>/review-probes/` or exact steps):
```
<finding ID or area> | Critical / High / Medium / Low | what is wrong | repro | the fix you would make
```
Then "Sound" (one line listing the fixes you attacked and could not break), "He should be told" (behavior changes the
fixers did not mention), and "Not checked". No preamble.
