# Tally audit fixes, 15 Nov 2026: the fixer's brief

Tally is one HTML file a 7th-grade math teacher (Croix) uses to turn IXL and Focus gradebook exports into the grades
he copies into the gradebook of record, what-ifs and plans for students, reports for families, and statistics charts
he projects for his class. Twelve auditors found defects and a counter agent confirmed each one. Your job: fix the
ones in your plan, prove each fix, and break nothing. A wrong number here becomes a grade or a sentence to a parent.

## Your workspace

- `/home/claude/work/fix/<you>/` is your own git clone of Tally on branch `fix-<you>` (your plan names it). Work only
  there. Commit to that branch as you go, one commit per finding or small group, message `Audit <ID>: <what>`.
  Never push. Never touch `/home/claude/tally` or any other directory under `/home/claude/work/`.
- Read first, in your clone: `review/audit-nov15/BRIEF_COMMON.md`, sections "The code" and "The intent is written
  down" (the code map, how to read the very long lines with `fold`, where decisions are recorded). Then your plan.
- The findings are in `review/audit-nov15/reports/<auditor>/FINDINGS.md`, the reproductions in
  `review/audit-nov15/probes/<auditor>/` and `review/audit-nov15/counter-probes/<auditor>/`.

## How to fix one finding

1. Build the test build (`python3 build.py --test`; never pipe it into `head`) and run the finding's probe ON YOUR
   CLONE: `TALLY_REPO=$PWD node review/audit-nov15/probes/<auditor>/NN-*.js`. Without `TALLY_REPO` a probe runs
   against an old copy elsewhere and tells you nothing. It must exit 1 (the defect is there). If it exits 0, or
   fails for some other reason, find out why before changing anything.
2. Read the code path end to end, and the decisions NOTES.md records about it (grep). Make the smallest change that
   makes Tally right, following the fix your plan gives (the counter agent already tried most of them). If the
   plan's fix turns out wrong or unsafe, do what is right and say why.
3. Rebuild and rerun the probe: it must exit 0. If it still fails only because it asserts on exact wording that you
   worded differently, say so in your report (do not edit anything under `review/`).
4. Add a regression check to `tests/audit-nov15-<you>.js` (a new file, in the style of the other suites:
   `const { chromium, fs, path, exe, check, done, pick, tmp, APP } = require('./lib');`, results through `check()`,
   `done()` at the end). It must fail on the old code and pass on yours. A test may use `window.__all.<name>` (the
   test build exposes every top-level function and constant by name) as well as `window.__tally`.
5. Run the suites that cover what you touched (`node tests/run.js <names>`; your plan lists them) and your new
   suite. All must pass. If an existing check asserted the old, wrong behavior, update that check and list it in
   your report. Never weaken a check to make it pass.

## Rules

- Edit only the source files your plan names. If a fix needs a small change in another source file, keep it as small
  as you can and list it under "Edits outside my files": other fixers are editing those files right now, and the
  integrator has to know.
- Do NOT edit: NOTES.md, README.md, the built files (Tally.html, index.html, Scrub.html), anything under `review/`,
  package files, or the `window.__tally = { ... }` line in app.js (tests use `window.__all` instead).
- House style: the repo writes long one-line functions; keep to it. A `// comment` inside a one-line statement
  comments out the rest of the line, so use `/* */` there. Where the reason for a change is not obvious, one short
  comment in plain words, such as `/* 15 Nov 2026 audit (TIM-04): a unit whose test is still ahead is not past */`.
- Words on screen: American English, plain, no em dashes (a colon or a comma instead), no jargon. A message that
  reports a problem says what is wrong and what to do about it.
- Privacy: nothing student-facing (the Board, Show student, the student or substitute seating print) may name or
  identify a student. Do not change what "Hide names" shows.
- Do not add features and do not refactor beyond what a fix needs. Do not fix anything that is not in your plan: if
  you find another defect, report it.
- A fix you cannot make cleanly and prove is skipped and reported, not forced.
- Run every suite and every probe through the queue: `/home/claude/work/fix/t node tests/run.js <names>` and
  `/home/claude/work/fix/t env TALLY_REPO=$PWD node review/audit-nov15/probes/...`. It waits for one of three slots,
  so the wait can be a few minutes when others are testing: that is the queue, not a hang. Give those Bash calls a
  long timeout, and run several suites in one call rather than many calls.
- The machine is small (2 cores) and other fixers are running suites too. The suites use fixed waits, so a check
  that fails under load may pass alone: rerun a failing suite once by itself before you investigate. Never run the
  whole suite (`node tests/run.js` with no names).
- Do the work yourself: no subagents. Synthetic or scrubbed data only. Be economical: read each file once, keep
  tool output short.

## Your final message (compact: it is all the integrator reads)

One block for each finding in your plan:

```
<ID> | fixed / skipped | file: function(s) changed | test: the check's wording in tests/audit-nov15-<you>.js | probe exits 0: yes / no
what he will see change: one sentence, or "nothing visible"
```

Then: "Edits outside my files" (file, function, why) · "Existing checks I changed" (suite, check, why) · "Suites run"
(name: pass / fail counts) · "Not done" (why) · "Other defects noticed" (not fixed). End with the output of
`git log --oneline main..HEAD`.
