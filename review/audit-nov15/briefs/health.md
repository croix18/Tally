# Auditor HLT: code health across the whole codebase   (tag HLT, directory /home/claude/work/audit/health/)

He asked for "opportunities to clean and harden code". The engine auditors look at behavior. You look at the code as
code, across every file, plus build.py, tests/run.js, tests/lib.js and package.json.

## Tasks
1. **Lint properly.** Install eslint in YOUR directory (`cd /home/claude/work/audit/health && npm i eslint`; the
   registry is reachable). Lint the script as the browser sees it (extract the app `<script>` from
   `repo/Tally.test.html`, or concatenate the sources as build.py does). Rules: no-undef, no-unused-vars,
   no-dupe-keys, no-dupe-args, no-dupe-else-if, no-self-assign, no-self-compare, no-unreachable, no-fallthrough,
   no-cond-assign, no-constant-condition, no-unsafe-negation, use-isnan, valid-typeof, no-redeclare, no-shadow,
   array-callback-return, no-loss-of-precision, no-sparse-arrays, no-prototype-builtins, no-useless-escape. Triage
   every hit: a real bug (prove it), dead code (prove no caller in the sources or the tests), or noise.
2. **Hazards, each with proof that it is reachable**: `|| default` on a value that can rightly be 0, '' or false (a
   score of 0, a max of 0, a goal of 0, period 0, index 0); `parseInt` / `parseFloat` / unary plus / `Number()` on file
   or typed text; loose equality across types; `.sort()` with no comparator on numbers; a division whose denominator
   can be 0 and whose result reaches the screen; an `indexOf` / `find` result used unguarded; two arrays joined by
   position after being filtered separately; a regex that reads "Unit 1" out of "Unit 10"; `new Date(string)`;
   `JSON.parse` without a guard; a quadratic loop in a render path.
3. **One quantity, one function.** List every quantity computed in more than one place (the grade %, the letter, IXL
   at goal, the missing count, the class average, the counted students, the quarter of a unit, percent formatting)
   with the file and function of each implementation. For each pair, prove whether they can disagree by constructing
   the input. This is the most valuable part of your audit: it is where two screens start telling different stories.
4. **Rounding and formatting.** Every helper that turns a number into text (roundPct, pct1, fmtV, toFixed uses,
   Math.round uses): a table of where each is used, whether one quantity is rounded differently on different
   screens, and what each does at .5 (89.5; 69.45; a float such as 0.895 * 100), with -0, and with a trailing ".0".
5. **Performance.** Time render() and the heavy engines on a synthetic full load (six classes x 30 students x 300
   skills, 12 history days, a 60-assignment gradebook each): which functions dominate, anything super-linear, any
   render that recomputes the same thing for every row.
6. **Tests.** Which engine functions have no direct assertion in tests/ (cross INVENTORY.txt against a grep of the
   tests)? Which suites depend on today's date or the time zone (run two of them under a shifted clock or zone and
   show a failure if there is one)? What should a permanent property-test suite for the math contain?
7. **Structural proposals**, ranked by risk removed per line changed: for example one `figures(sec, i)` used by every
   screen, invariant checks in the test build, a shared date module. Keep the house style (long one-line functions).

Most of this needs no browser. For runtime proof use the probe template.
