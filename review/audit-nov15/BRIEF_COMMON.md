# Tally deep audit, 15 Nov 2026: common brief (read all of it before anything else)

## What Tally is, and why the bar is absolute

Tally is one HTML file that a 7th-grade math teacher (Croix Shaffer, Windy Hill Middle School, Lake County FL) runs on
his laptop. He drops IXL Score Grid exports and Focus gradebook exports on it. It then:

- turns IXL SmartScores into unit points that he **copies into the Focus gradebook** (the grades of record);
- computes each student's real Focus course grade and tells students and families what would move it (what-ifs,
  "quickest way to the next letter", retake eligibility, the weekly report, the parent conference form);
- projects anonymous class data on the classroom board (the Race and the Data Lab: box plots, dot plots, histograms,
  stem-and-leaf, bar, circle and line graphs, class averages, correlation) to students he is teaching statistics to.

So a wrong number is never cosmetic. It becomes a grade in Focus, a sentence said to a parent, or a statistics example
in front of 7th graders.

His request, verbatim: *"Is there anything I missed? I want you to run a deep dive on the cores and engines that make
up tally. Look at all edge cases. I need all of the math and the information absolutely correct at all times. Graphs,
what ifs, charts, everything. Deep audit the whole project. Look for things we missed, look for edge cases, look for
opportunities to clean and harden code. Don't make any decisions before running it against a counter agent."*

## Where you fit

1. **Auditors (you)**, one per engine, find problems and PROVE them.
2. **A counter agent** then tries to refute every finding you report: it reruns your reproduction on a clean copy and
   checks your "expected" against the documented intent.
3. Only findings that survive are decided on and fixed, by someone else.

You fix nothing in the real repo. Your product is evidence.

## Ground rules (hard)

1. Your directory is `/home/claude/work/audit/<you>/` (named in your assignment). It holds `repo/` (your own copy of
   Tally at commit 8f973ed, plus an audit-only hook) and `probes/`. Work only there. Never write anything under
   `/home/claude/tally` (the real repo) or `/home/claude/work/audit/base`, never run `git commit` or `git push`, never
   touch another auditor's directory.
2. Synthetic or scrubbed data only. `repo/fixtures/` is scrubbed or synthetic; invent everything else. Never ask for or
   fetch real student data. Tally needs no network. Use the web only to verify an external fact (a published cut
   score, a standard), and never send anything about this project anywhere.
3. Do the work yourself. Do not spawn subagents and do not delegate.
4. The machine is small (2 cores, 7 GB) and shared with other auditors. One browser at a time; close it when a probe
   ends. Do not run the whole suite (`node tests/run.js` with no names takes 20 minutes). One suite at a time is fine
   (`cd repo && node tests/run.js grades`). Never pipe `python3 build.py` into `head`.
5. Timing: the suites use fixed waits, and under load a UI read can misfire. Assert on engine outputs and state
   wherever you can, and rerun any failing probe at least twice before you believe it.
6. Write as you go. Append each finding to `FINDINGS.md` as soon as it is proven. If you are running out of room,
   stop exploring and finish the two deliverables: an unwritten finding is lost.

## The code

- Sources in `repo/`: `app.html` (markup and CSS); `parser.js` (its own `<script>`, and `require`-able in node:
  `csvToRows`, `parseIxlGrid`, `parseIxlFilename`, `asScore`, `xlsxToRows`, `parseFastReport`, `readZip`,
  `inflateRaw`); and `app.js`, an IIFE into which `grades.js`, `charts.js`, `home.js`, `seating.js`, `quarters.js`,
  `students.js` and `conference.js` are spliced at markers, so they all share one scope. `scrub.src.html` is the
  separate name scrubber. `build.py` assembles them.
- **Lines are very long** (one function is often one line of 500 to 4,000 characters) and the Read tool cuts long
  lines. Read through `fold`: `fold -s -w 220 repo/grades.js > /tmp/<you>-grades.txt`, then Read that file; or
  `sed -n '45,66p' repo/grades.js | fold -s -w 220`. Cite a function by name and by the source file's own line number
  (`grep -n "^function name" repo/file.js`). `/home/claude/work/audit/INVENTORY.txt` lists every top-level function as
  `file:line name`.
- Build: `cd repo && python3 build.py --test` writes `Tally.test.html` (already built for you). The test build has two
  handles: `window.__tally` (the suites' handle: `state`, `save()`, `render()` and about 200 functions) and
  `window.__all` (audit-only: every top-level function and constant by name, such as `__all.computeGrade` or
  `__all.Q_ENDS`; the names are listed in `/home/claude/work/audit/ALL_NAMES.txt`). The shipped build has neither.
- Probes: start from `/home/claude/work/audit/probe_template.js`. It loads the scrubbed real class and shows how to
  reach the engine. `repo/tests/*.js` are working harnesses for every screen, so borrow their setup code:
  `tests/quarter-pie.js` builds five classes and a second quarter; `tests/whatif-audit.js`, `tests/grades.js`,
  `tests/quickest.js`, `tests/audit-oct22.js`, `tests/audit-oct24.js` and `tests/audit-oct25.js` build many edge cases.
- The model in one paragraph (verify each part as you read; do not trust this summary over the code).
  `state.sections[key]` is a class: `students[]`, `skills[]`, `scores[skillIndex][studentIndex]` (a SmartScore or
  null), `best` (the best score kept across imports), `threshold` (the goal: 60 on-level, 67 accelerated), `prep`
  (`'acc'` or `'on'`), `roster`, `studentSkips`, `history[]` (one snapshot per import day), `grades` (the open Focus
  gradebook: its students, their IDs, and assignments with name, max, scores, status and codes), `qArchive[n]` (kept
  quarters). `unitsOf(sec)` gives the units; `activeFor(sec, unit, si)` a student's own skill list; `eff(sec, k, si)`
  the score that counts; `points(sec, unit, si)` the skills at goal; `population(sec)` the counted students.
  `gradingFor(prep)` gives categories and weights and `computeGrade(sec, i)` the Focus grade. Quarters: `Q_ENDS`,
  `quarters()`, `liveQuarter(sec)`, `unitClosed(sec, unit)`.
- Today is Sunday 15 Nov 2026: Quarter 2 of 2026-27 (Quarter 1 ended 9 Oct). His time zone is America/New_York.

## The intent is written down. Read it before calling anything a bug.

- `repo/NOTES.md` (170 KB) records every decision, with the teacher's own words. Grep it for your domain's terms and
  read every hit. The newest sections run from "## IXL beside its own unit's tests" to "## Hostile review, 14 Nov
  2026".
- `repo/README.md` ("How it counts"), `repo/GRADES_SPEC.md` (the grade formula, quarters, students, quickest way),
  `repo/SEATING_SPEC.md`, `repo/COMMAND_CENTER.md`.
- `repo/AUDIT_PLAN.md` lists what three audits in October fixed, logged or left for Croix. NOTES.md "Hostile review,
  14 Nov 2026" holds the latest backlog. Do not re-report any of that unless you can show a regression or that the fix
  is incomplete.
- A behavior that NOTES.md records as decided is not a defect. If you believe a decision produces a wrong number, or
  contradicts another decision, report it as class DECISION with the evidence. Otherwise leave it alone.
- Parked by Croix, do not report: what "Hide names" shows (initials); the Board file's per-unit shuffle (judged on 14
  Nov); the 2027-28 school-year rollover as such (known; report only a new and concrete consequence).

## Method (required)

1. **Read every line of the code assigned to you.** Not a skim. Four audits have been over this code; what is left is
   in the corners.
2. **Build an independent oracle.** Write your own implementation of your engine's math from the written intent (not
   by copying Tally's code). Compare it with Tally on (a) the scrubbed fixtures, (b) thousands of randomized synthetic
   cases, (c) hand-built edge cases. Run the comparison inside one page session (`page.evaluate`) so it is fast.
   Chase every disagreement until you know which side is wrong.
3. **Attack the edges** listed in your assignment, and the ones you find while reading.
4. **Check what the screen SAYS**, not only what the engine returns: counts, "n =", dates, units, percent signs,
   labels, plurals, "as of", tooltips, aria text, printed pages. A true number under a false label is a finding.
5. **Code health in your area**: duplicated logic that can drift apart; dead code; `x || default` where 0 or '' is a
   real value; float equality and rounding at a boundary; unguarded division (NaN, Infinity or "undefined" reaching
   the screen); date parsing; sorts without a comparator; joins by array position; missing guards. Report only what
   lowers the risk of a wrong number, lost data or a crash, or clearly simplifies. Say exactly what to change and why
   it is safe. Long one-line functions are the repo's house style: do not report formatting.

## Evidence standard

A finding counts only with a runnable reproduction: `probes/NN-slug.js`, built from the template, that prints
`OBSERVED:` and `EXPECTED:` lines and exits 1 while the defect exists and 0 once it is fixed (it becomes the regression
test). It must run on a clean copy: `TALLY_REPO=/home/claude/work/audit/base node probes/NN-slug.js` (default
`TALLY_REPO` to your own `repo/`). Use only `__tally` / `__all`, the fixtures and data you synthesize in the script,
so it does not depend on any change you made to your copy. For a pure code-health item the "reproduction" is the exact
lines plus a short script or grep that shows the hazard. Whatever you could not prove goes under "Suspicions", with
what you tried.

Say how a real teacher reaches it. "Only if a file is edited by hand" and "every Monday" are different findings. Rate
honestly on AUDIT_PLAN.md's scale. **Critical**: a wrong grade, point or retake answer shown or copied into Focus;
data lost or put on the wrong student or class; a name or grade reaching a student-facing screen; Tally failing to
open. **High**: a common weekly flow breaks, needs a workaround or misleads (a wrong count, stale data shown as
current). **Medium**: an uncommon flow breaks; a recoverable surprise; a statement that is slightly false.
**Low**: polish.

## What to deliver (in your directory)

1. `FINDINGS.md`, one entry per finding in exactly this shape:

```
### <TAG>-NN  <one-line title>
- Class: WRONG-NUMBER | WRONG-INFO | CRASH | DATA-LOSS | PRIVACY | FRAGILE | CLEANUP | DECISION
- Severity: Critical | High | Medium | Low
- Where: file.js: function (line N)
- Trigger: the realistic situation, and how often it would happen
- Observed: ...
- Expected: ... and why that is right (cite GRADES_SPEC, NOTES, README, the math, or an external source)
- Repro: probes/NN-slug.js, with its output pasted
- Suggested fix: the smallest change, and what it could break
- Confidence: High | Medium | Low, and what would change your mind
```

   followed by "## Suspicions (unproven)" and "## Cleanup and hardening" (CLEANUP items may be brief).
2. `COVERAGE.md`: what you verified correct and how (the oracle, how many random cases, which edge cases), and what
   you did not get to. This matters as much as the findings: it is the record of what is known to be right.
3. Your final message to the orchestrator, under 300 words: counts by severity, the five most important findings in
   one line each, what you could not cover, and the two file paths. Do not paste the report.

Quality over volume: eight proven findings beat forty guesses. But do not hold back a real one because it is rare.
He asked for "absolutely correct at all times".
