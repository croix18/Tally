// GRD-02: "See why" says "Every grade matches when X isn't counted" when that is true only with the FIT's categories,
// not with the categories Tally is using. gradeDiff's (d) tests errOf = min(error with the categories in use, error with
// fit.map), but words the result as if only X differed, and offers no category change.
// Focus: one column it doesn't count (X) AND one of Tally's stored categories is a wrong guess. Taking X out with the
// categories in use still leaves most of the class off.
const path = require('path');
const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400);
  const res = await p.evaluate(() => {
    const T = window.__tally, A = window.__all;
    let seed = 3; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const pickA = arr => arr[Math.floor(rnd() * arr.length)];
    const CATS = ['Assessments', 'Classwork', 'Participation'];
    const g = T.gradingFor('acc'); g.cats = [{ name: 'Assessments', w: 70 }, { name: 'Classwork', w: 25 }, { name: 'Participation', w: 5 }];
    let tried = 0, claims = 0; const bad = [];
    for (let t = 0; t < 600 && bad.length < 2; t++) {
      const nS = ri(15, 28), nA = ri(6, 14); const students = Array.from({ length: nS }, (_, i) => 'Student' + i + ', Test');
      const assignments = [], truth = {};
      for (let j = 0; j < nA; j++) { const max = pickA([5, 10, 10, 20, 25, 50]); const values = [], status = [];
        for (let i = 0; i < nS; i++) { const r = rnd(); const st = r < 0.88 ? 'score' : r < 0.95 ? 'missing' : 'excused'; status.push(st); values.push(st === 'score' ? ri(Math.round(max), max * 2) / 2 : null); }
        const name = 'Item ' + j; assignments.push({ name, max, values, status, missing: status.filter(x => x === 'missing').length }); truth[name] = pickA(CATS); }
      const gb = { students, assignments, importedAt: '2026-11-13T15:00:00.000Z' }; const sec = { key: 'nc' + t, prep: 'acc', grades: gb };
      const X = pickA(assignments).name;
      g.map = { ...truth }; g.how = {}; assignments.forEach(a => g.how[a.name] = 'fit'); g.ec = {}; g.codes = {};
      gb.overall = students.map((_, i) => A.computeGrade(sec, i, { [X]: null }).rounded);   // Focus doesn't count X
      const wrong = pickA(assignments.filter(a => a.name !== X)); g.map[wrong.name] = pickA(CATS.filter(c => c !== truth[wrong.name])); g.how[wrong.name] = 'guess';   // and Tally has one wrong guess
      const fit = A.fitCategories(sec); const gd = A.gradeDiff(sec, fit); if (!gd) continue; tried++;
      gd.whole.filter(w => /isn't counted\./.test(w.html)).forEach(w => { claims++; const nm = w.html.match(/<b>([^<]+)<\/b>/)[1];
        const stillOff = students.map((_, i) => i).filter(i => A.computeGrade(sec, i, { [nm]: null }).rounded !== gb.overall[i]);
        if (stillOff.length) bad.push({ says: w.html.replace(/<[^>]+>/g, ''), fix: w.fix, offNow: A.gradeOff(sec).length, offAfterTakingItOut: stillOff.length, of: nS,
          tallyHas: wrong.name + ' in ' + g.map[wrong.name], fitHas: wrong.name + ' in ' + fit.map[wrong.name], focusHas: wrong.name + ' in ' + truth[wrong.name], categoryMentioned: /categor|in (Assessments|Classwork|Participation)/.test(w.html) }); });
    }
    return { tried, claims, bad };
  });
  console.log('OBSERVED:', JSON.stringify(res.bad, null, 0).slice(0, 1600));
  console.log(`OBSERVED: ${res.bad.length} false "isn't counted" claims among ${res.claims} made in ${res.tried} dialogs`);
  console.log('EXPECTED: an "Every grade matches when X isn\'t counted" line only when taking X out WITH THE CATEGORIES IN USE reproduces every grade (NOTES 14 Nov: "a class-wide cause is only reported when it reproduces EVERY student\'s grade exactly"); when it needs the fit\'s categories too, the line must name those category changes (and offer them).');
  check(res.bad.length === 0, 'every "isn\'t counted" sentence is true with the categories in use');
  check(!errs.length, 'no page errors');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
