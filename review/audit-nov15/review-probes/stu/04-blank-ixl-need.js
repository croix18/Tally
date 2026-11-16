// A unit's IXL column left blank for one student (Focus shows no score yet): retakeStatus counts `need` from the column
// (WIF-02), but quickestPath's required-IXL step (ixlreq, "isn't in Focus yet") still counts every skill below goal.
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
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all, sec = T.state.sections[K]; const s = A.openSec(sec); const gb = s.grades; const i = 7; const name = gb.students[i]; const f = A.findStudent(sec, name);
    const col = gb.assignments.find(a => /\bixl\b/i.test(a.name) && /3/.test(a.name)); col.status[i] = 'blank'; col.values[i] = null;
    gb.assignments.filter(a => a.status[i] === 'missing').forEach(a => { a.status[i] = 'score'; a.values[i] = a.max; });   // nothing else owed
    const t = gb.assignments.find(a => A.isAssess(s, a) && !/ixl/i.test(a.name) && a.max > 0 && a.status[i] === 'score'); t.values[i] = Math.round(t.max * 0.3);
    const rt = A.retakeStatus(sec, name); const qp = A.quickestPath(sec, s, i, f.ixl);
    return { col: col.name, why: A.retakeWhy(rt, true), need: rt.need, short: rt.short.length, behind: (rt.behind || []).map(x => x.unit.short + ' need ' + x.need + ' short ' + x.short.length), steps: qp && qp.plan ? qp.plan.map(x => x.kind + ':' + x.a.name + ':' + x.n) : qp }; }, K);
  console.log(JSON.stringify(r));
  const req = (r.steps || []).filter(x => /^ixlreq/.test(x)); const n = req.length ? +req[0].split(':').pop() : null; const want = r.need || (r.behind[0] && +r.behind[0].split(' ')[3]);
  console.log('OBSERVED: retake line "' + r.why + '"; plan step ' + JSON.stringify(req));
  console.log('EXPECTED: the plan\'s required IXL step names the same ' + want + ' skills');
  check(!req.length || n === want, 'quickestPath and retakeWhy name the same number of skills');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
