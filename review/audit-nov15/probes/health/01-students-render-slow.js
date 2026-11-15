// HLT-01: the Students screen takes seconds to render on a full teaching load (6 classes x 30 students, 60-assignment gradebooks).
// Every render runs quickestPath for every student, and each what-if re-derives every assignment's category (catOf -> gradingFor -> catGuess regexes).
const path = require('path'); process.env.TALLY_REPO = process.env.TALLY_REPO || '/home/claude/work/audit/health/repo';
const { open, synth, K, lib } = require('./_load.js'); const { check, done } = lib;
(async () => {
  const { b, p, errs } = await open(); const keys = await p.evaluate(synth, K);
  const t = await p.evaluate(k => { const T = window.__tally; T.state.active = k; const ms = m => { T.view.mode = m; T.render(); const t0 = performance.now(); T.render(); T.render(); return Math.round((performance.now() - t0) / 2); };
    return { home: ms('home'), grades: ms('grades'), students: ms('students') }; }, keys[0]);
  console.log('OBSERVED: one render, ms:', JSON.stringify(t));
  console.log('EXPECTED: the Students screen renders in under 1000 ms (the Overview and Grades screens take ~100 ms on the same data)');
  check(t.students < 1000, 'Students screen renders in under a second on a full load');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
