// WIF-03 on the other surfaces: an NHI on a 0-point (extra credit) column. retakeStatus, the what-ifs, Show student and
// the plan say it is not missing work (Croix's call); the weekly report and the conference form?
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
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all, sec = T.state.sections[K]; const s = A.openSec(sec); const gb = s.grades; const i = 2; const name = gb.students[i];
    const tmpl = gb.assignments.find(a => A.catIn(s, a) === 'Classwork' || A.catIn(s, a) === 'Participation') || gb.assignments[0];
    const col = JSON.parse(JSON.stringify(tmpl)); col.name = 'Bonus Puzzle'; col.max = 0; col.values = gb.students.map(() => 2); col.status = gb.students.map(() => 'score'); col.values[i] = null; col.status[i] = 'missing'; gb.assignments.push(col);
    A.rowCache && A.rowCache.clear && A.rowCache.clear();
    const rt = A.retakeStatus(sec, name); const f = A.findStudent(sec, name); const ow = A.owedWork(sec, s, i, f.ixl).owed.map(a => a.name);
    const d = document.createElement('div'); d.innerHTML = A.studentReportSection(s, i, A.gbRows(s)[i]); const wk = d.innerText || d.textContent;
    return { rtOk: rt.ok, owed: ow, weeklyNames: /Bonus Puzzle/.test(wk), snip: (wk.match(/[^\n]{0,80}Bonus Puzzle[^\n]{0,80}/g) || []).join(' || '), weeklyMissing: (wk.match(/\d+ missing|missing assignments?[^.\n]{0,40}/gi) || []).slice(0, 3) }; }, K);
  console.log(JSON.stringify(r));
  console.log('OBSERVED: retakeStatus ok=' + r.rtOk + '; owedWork (weekly report) owes ' + JSON.stringify(r.owed) + '; weekly report names it: ' + r.weeklyNames);
  console.log('EXPECTED: a 0-point column is never missing work on any surface');
  check(!r.owed.includes('Bonus Puzzle') && !r.weeklyNames, 'the weekly report does not ask for the 0-point column');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
