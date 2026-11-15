// TIM-07: one import made while the computer's clock was a year ahead leaves a grade snapshot dated in the future. Once
// the clock is right, "What changed this week" keeps comparing that stale snapshot (it is always the last by date) and
// never reports the new imports; the reminder calls the future gradebook "today".
const path = require('path'); const { openAt, check, done, importGb, fs } = require('./_tim.js');
const K = '1205050-7T1A';
(async () => {
  const { b, p, errs } = await openAt('America/New_York', '2027-11-10T15:00:00Z');   // the clock wrongly reads 10 Nov 2027
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await importGb(p, path.resolve('fixtures/focus_gradebook_scrubbed.csv'));
  await p.clock.setFixedTime(new Date('2026-11-10T15:00:00Z'));                      // fixed: Tue 10 Nov 2026
  await importGb(p, path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv'));
  await p.clock.setFixedTime(new Date('2026-11-13T15:00:00Z'));                      // Fri 13 Nov: a second Q2 export, one score changed
  await p.evaluate(K => { const T = window.__tally, s = T.state.sections[K]; const a = s.grades.assignments.find(x => x.values.some(v => v != null)); const i = a.values.findIndex(v => v != null); a.values[i] = Math.max(0, a.values[i] - 5);
    s.grades.importedAt = new Date().toISOString(); window.__all.gradeSnapshot(s); T.save(); }, K);
  const r = await p.evaluate(K => { const A = window.__all, T = window.__tally, s = T.state.sections[K];
    const gh = s.gradeHistory.map(h => h.date + ':Q' + h.q); const last = s.gradeHistory[s.gradeHistory.length - 1];
    const d = A.digestFor(s); const txt = A.digestMarkup(d).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); return { gh, digestBase: last.date, digestGrades: d.grades || null, digest: txt.slice(0, 300), prev: (A.prevGradeSnap ? A.prevGradeSnap(s) || {} : {}).date }; }, K);
  console.log('OBSERVED:', JSON.stringify(r));
  console.log('EXPECTED: the digest compares the 13 Nov snapshot with the 10 Nov one; no snapshot is dated after today (2026-11-13)');
  check(r.digestBase === '2026-11-13', 'the digest\'s "now" is the latest import, not a future-dated snapshot');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
