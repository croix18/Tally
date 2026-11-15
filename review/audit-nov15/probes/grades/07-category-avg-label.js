// GRD-07: the Grades screen's Categories table heads its average "Avg (turned in)", titled "Average of the scores turned
// in: work not handed in is left out here (it counts as 0 in the grade)". The number under it is the mean of the
// students' CATEGORY GRADES (renderGrades catRows: grades.map(r => r.cats[c].pct)), and a category grade counts every NHI
// as 0. So the figure includes the zeros the label says it leaves out (the Assignments table's column of the same name
// really does leave them out).
const path = require('path');
const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, fs, exe, check, done, pick, APP } = require(path.join(REPO, 'tests/lib.js'));
const K = '1205050-7T1A';
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  await p.click(`[data-k="${K}"]`).catch(() => {}); await p.waitForTimeout(200); await p.click('#openGrades'); await p.waitForTimeout(400);
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const g = T.gradingFor(s.prep);
    const tbl = document.querySelector('#gridwrap .gsec .checkTable'); const head = tbl.querySelector('th:nth-child(4)'); const rows = [...tbl.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()));
    const out = {};
    g.cats.forEach(c => { const list = gb.assignments.filter(a => A.catIn(s, a) === c.name && a.max > 0);
      // turned in only: each student's earned / possible over the cells with a score (NHI left out), then the class mean
      const per = gb.students.map((_, i) => { let e = 0, q = 0; list.forEach(a => { if (a.status[i] === 'score') { e += a.values[i]; q += a.max; } }); return q ? e / q * 100 : null; }).filter(v => v != null);
      const nhi = list.reduce((x, a) => x + a.missing, 0);
      out[c.name] = { shown: (rows.find(rw => rw[0] === c.name) || [])[3], turnedIn: per.length ? Math.round(per.reduce((x, y) => x + y, 0) / per.length) + '%' : '—', nhis: nhi }; });
    return { header: head.textContent.trim(), title: head.getAttribute('title'), out }; }, K);
  console.log('OBSERVED:', JSON.stringify(r));
  const bad = Object.entries(r.out).filter(([, x]) => x.nhis > 0 && x.shown !== x.turnedIn);
  console.log('EXPECTED: under "' + r.header + '" ("' + r.title + '"), each category\'s mean of the scores turned in; or the label says it is the class\'s mean category grade with NHIs as 0');
  check(bad.length === 0, 'the Categories table\'s "Avg (turned in)" leaves NHIs out, as its label says: ' + bad.map(([k, x]) => `${k} shows ${x.shown}, turned-in mean ${x.turnedIn} (${x.nhis} NHIs)`).join('; '));
  check(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
