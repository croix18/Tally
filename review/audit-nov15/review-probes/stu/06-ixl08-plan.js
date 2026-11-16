// IXL-08 in the plan: an IXL-named Focus column no unit claims ("IXL Diagnostic"), NHI, now blocks the retake in
// retakeStatus (missing), but quickestPath (student page, Show student, weekly report) plans a retake without it.
const path = require('path'); const repo = path.resolve(process.env.TALLY_REPO || '.'); process.chdir(repo);
const { chromium, fs, exe, pick, check, done, APP } = require(path.join(repo, 'tests/lib'));
const K = '1205050-7T1A';
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'America/New_York' }); const p = await ctx.newPage();
  p.on('dialog', d => d.accept()); await p.goto('file://' + path.resolve(APP));
  await p.setInputFiles('#file', [path.resolve('fixtures', fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed')))]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  for (const f of ['focus_gradebook_scrubbed.csv', 'focus_gradebook_scrubbed_q2.csv']) { await p.setInputFiles('#file', [path.resolve('fixtures', f)]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600); }
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all, sec = T.state.sections[K]; const s = A.openSec(sec); const gb = s.grades; const out = [];
    const tmpl = gb.assignments.find(a => A.catIn(s, a) === 'Assessments' && /ixl/i.test(a.name));
    const col = JSON.parse(JSON.stringify(tmpl)); col.name = 'IXL Diagnostic'; col.max = 1; col.values = gb.students.map(() => 1); col.status = gb.students.map(() => 'score'); gb.assignments.push(col);
    gb.students.forEach((name, i) => { const f = A.findStudent(sec, name); if (f.ixl == null) return; const before = A.retakeStatus(sec, name); if (!before.ok) return;
      col.values[i] = null; col.status[i] = 'missing'; const ts = gb.assignments.filter(a => A.isAssess(s, a) && !/ixl/i.test(a.name) && a.max > 0 && a.status[i] === 'score'); const keep = ts.map(a => a.values[i]); ts.forEach(a => { a.values[i] = Math.round(a.max * 0.5); }); A.rowCache && A.rowCache.clear && A.rowCache.clear();
      const rt = A.retakeStatus(sec, name); const qp = A.quickestPath(sec, s, i, f.ixl);
      out.push({ i, unit: !!A.gbUnitFor(sec, col), rtOk: rt.ok, why: A.retakeWhy(rt, true), plan: qp && qp.plan ? qp.plan.map(x => x.kind + ':' + x.a.name + (x.n ? ':' + x.n : '')) : qp && qp.top ? 'top' : null });
      col.values[i] = 1; col.status[i] = 'score'; ts.forEach((a, k) => { a.values[i] = keep[k]; }); });
    return out; }, K);
  console.log(JSON.stringify(r));
  const bad = r.filter(x => !x.rtOk && Array.isArray(x.plan) && x.plan.some(s => /^retake/.test(s)) && !x.plan.some(s => /IXL Diagnostic/.test(s)));
  console.log('OBSERVED: ' + bad.length + ' students are told "' + (bad[0] ? bad[0].why : '') + '" yet their plan retakes a test without the IXL Diagnostic: ' + JSON.stringify(bad[0] && bad[0].plan));
  console.log('EXPECTED: a plan that retakes a test first turns in every column retakeStatus counts as missing');
  check(r.length > 0, 'staged at least one eligible student');
  check(!bad.length, 'no plan retakes past a column that blocks the retake');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
