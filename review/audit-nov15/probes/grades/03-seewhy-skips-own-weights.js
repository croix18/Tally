// GRD-03 (built on the GRD-01 generator): "See why"'s weight search (gradeDiff (e)) skips Tally's own weights, so the setup
// 'Tally's weights + one assignment in another category' is never tried. When the fit stalls (GRD-01) the dialog then
// offers OTHER weights as the setups that reproduce every grade, and says the export can't tell them apart, while the
// true setup (Focus's real weights, one category moved) is not listed.
// Original GRD-01 notes: one assignment in the wrong category (an unchecked name guess), weights right, Focus's Grade column exact.
// The single move that reproduces every grade exists, yet fitCategories' coordinate descent can take another move first
// and stall above zero error. Then nothing is proved, Tally's grades stay off Focus's, and "See why" cannot find the one
// move either (its weight search skips the current weights), so it says nothing useful or proposes other WEIGHTS.
// Realistic sizes: 18-30 students, 8-25 assignments, weights 70/25/5, scores in half points, some NHI / excused.
const path = require('path');
const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400);
  const run = SC => p.evaluate(SC => {
    const T = window.__tally, A = window.__all;
    let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const pickA = arr => arr[Math.floor(rnd() * arr.length)];
    const CATS = ['Assessments', 'Classwork', 'Participation'], W = [70, 25, 5];
    const out = { cases: 0, stalled: 0, ex: null, gdSays: {} };
    const g = T.gradingFor('acc'); g.cats = CATS.map((c, k) => ({ name: c, w: W[k] }));
    for (let t = 0; t < 400; t++) {
      const nS = ri(18, 30), nA = ri(8, 25); const students = Array.from({ length: nS }, (_, i) => 'Student' + i + ', Test');
      const assignments = [], truth = {};
      for (let j = 0; j < nA; j++) { const max = pickA([4, 5, 10, 10, 10, 20, 25, 40, 50]); const ability = rnd();
        const values = [], status = [];
        for (let i = 0; i < nS; i++) { const r = rnd(); const st = r < 0.86 ? 'score' : r < 0.95 ? 'missing' : 'excused'; status.push(st);
          values.push(st === 'score' ? Math.min(max, Math.round(max * 2 * (0.45 + 0.55 * Math.min(1, ability * 0.5 + rnd() * 0.8))) / 2) : null); }
        const name = 'Item ' + j; assignments.push({ name, max, values, status, missing: status.filter(x => x === 'missing').length }); truth[name] = pickA(CATS); }
      const gb = { students, assignments, importedAt: '2026-11-13T15:00:00.000Z' };
      g.map = { ...truth }; g.how = {}; assignments.forEach(a => g.how[a.name] = 'fit'); g.ec = {}; g.codes = {};
      const sec = { key: 'st' + t, prep: 'acc', grades: gb };
      gb.overall = students.map((_, i) => A.computeGrade(sec, i).rounded);          // Focus = the true setup
      let wrongA = null, wrongTo = null;
      if (SC === 'one') { wrongA = pickA(assignments); wrongTo = pickA(CATS.filter(c => c !== truth[wrongA.name])); g.map[wrongA.name] = wrongTo; g.how[wrongA.name] = 'guess'; }
      else { const kNew = ri(2, 5); for (let j = 0; j < kNew; j++) { const a = assignments[j]; g.how[a.name] = 'guess'; if (rnd() < 0.4) { g.map[a.name] = pickA(CATS.filter(c => c !== truth[a.name])); wrongA = a; wrongTo = g.map[a.name]; } } if (!wrongA) continue; }                     // Tally's one wrong guess
      if (!A.gradeOff(sec).length) continue;                                           // the wrong guess changes nobody: nothing to find
      out.cases++;
      const fit = A.fitCategories(sec);
      if (!fit.exact) { out.stalled++; const gd = A.gradeDiff(sec, fit);
        const said = !gd ? 'no dialog' : gd.whole.some(w => /weights of/.test(w.html)) ? 'proposes other weights' : gd.whole.length ? 'other' : 'nothing class-wide';
        out.gdSays[said] = (out.gdSays[said] || 0) + 1;
        if (said === 'proposes other weights' && !out.wx) out.wx = { t, wrong: wrongA.name + ' is ' + wrongTo + ' in Tally, ' + truth[wrongA.name] + ' in Focus', oneMoveAtTallysWeightsReproducesAll: students.every((_, i) => A.computeGrade(sec, i, null, { ...g.map, [wrongA.name]: truth[wrongA.name] }).rounded === gb.overall[i]), seeWhy: gd.whole.map(w => w.html.replace(/<[^>]+>/g, '')), listedIncludesTallysWeights: gd.whole.some(w => w.weights && w.weights.join() === '70,25,5') };
        if (!out.ex) out.ex = { t, nS, nA, wrong: wrongA.name + ' is ' + wrongTo + ' in Tally, ' + truth[wrongA.name] + ' in Focus', fitErr: fit.err, off: A.gradeOff(sec).length,
          truthReproducesAll: students.every((_, i) => A.computeGrade(sec, i, null, truth).rounded === gb.overall[i]),
          seeWhy: gd ? gd.whole.map(w => w.html.replace(/<[^>]+>/g, '').slice(0, 160)) : null }; }
    }
    return out;
  }, SC);
  const res = await run('one');
  console.log('OBSERVED:', JSON.stringify(res.wx, null, 0).slice(0, 2000));
  console.log('EXPECTED: with Tally\'s weights + one move reproducing every grade, See why lists that setup first ("Every grade matches with Item N in X"), with its one-click fix, and does not tell the teacher the export cannot tell other WEIGHTS apart');
  check(res.wx && res.wx.oneMoveAtTallysWeightsReproducesAll, 'the probe found its case');
  check(!res.wx || res.wx.seeWhy.some(h => /matches with (?!weights)/.test(h)) , 'See why names the one-category fix at Tally\'s own weights');
  check(!errs.length, 'no page errors');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
