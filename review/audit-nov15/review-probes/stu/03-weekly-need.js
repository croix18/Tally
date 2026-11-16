// WIF-02 left on two surfaces: the weekly report's retake sentence (grades.js ixlNeed) and the conference form's
// "Finish on IXL" still count every skill below goal, while retakeWhy (chip, student page, Show student) names `need`.
// Scrubbed class, Q1 + Q2 gradebooks; student row 7 (6 missing, Unit 3: 5 skills below goal, 3 needed to fill the column),
// one of their tests set below full so the report prints its retake line. Exit 1 while the surfaces disagree.
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
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all, sec = T.state.sections[K]; const s = A.openSec(sec); const gb = s.grades; const i = 7; const name = gb.students[i];
    const t = gb.assignments.find(a => A.isAssess(s, a) && !/ixl/i.test(a.name) && a.max > 0 && a.status[i] === 'score'); if (t) t.values[i] = Math.round(t.max * 0.5);
    A.rowCache && A.rowCache.clear && A.rowCache.clear();
    const rt = A.retakeStatus(sec, name); const d = document.createElement('div'); d.innerHTML = A.studentReportSection(s, i, A.gbRows(s)[i]);
    const wk = (d.innerText || d.textContent).match(/[^.\n]*IXL skill[^.\n]*/g) || [];
    const conf = A.conferenceWork(A.conferenceData(sec, name)); return { test: t && t.name, why: A.retakeWhy(rt, true), need: rt.need, short: rt.short.length, wk, conf: (conf.match(/Unit \d+: \d+ skills? left/g) || []) }; }, K);
  console.log(JSON.stringify(r));
  console.log('OBSERVED: retake line on the student page / Show student: "' + r.why + '"; weekly report: ' + JSON.stringify(r.wk) + '; conference form: ' + JSON.stringify(r.conf));
  console.log('EXPECTED: every surface names the ' + r.need + ' skills still needed (not the ' + r.short + ' below goal)');
  // (the weekly report's ixlNeed / rtNeed is computed but never printed: dead code, not checked)
  check(r.conf.every(x => !new RegExp(': ' + r.short + ' skill').test(x)), 'conference form names the skills still needed');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
