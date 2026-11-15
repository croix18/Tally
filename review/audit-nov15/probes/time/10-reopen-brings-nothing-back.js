// TIM-10: reopening Quarter 1 after the Quarter 2 export is in brings nothing back, but the toast and the dialog say its
// missing work, Focus checks and still-owed lines are back.
const path = require('path'); const { openAt, check, done, importGb, fs } = require('./_tim.js');
const K = '1205050-7T1A';
(async () => {
  const { b, p, errs } = await openAt('America/New_York', '2026-11-15T17:00:00Z');
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await importGb(p, path.resolve('fixtures/focus_gradebook_scrubbed.csv'));
  await importGb(p, path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv'));
  const st = () => p.evaluate(K => { const A = window.__all, T = window.__tally, s = T.state.sections[K]; const u1 = T.unitsOf(s).find(u => u.short === 'Unit 1');
    const q1miss = (s.qArchive[1] ? s.qArchive[1].gb.assignments.reduce((n, a) => n + (a.missing || 0), 0) : 0);
    const openMiss = A.openSec(s).grades.assignments.filter(a => A.aQuarter(a, s.grades) === 1).length;
    return { closed1: A.qClosed(1), u1closed: A.unitClosed(s, u1), q1MissingInRecord: q1miss, q1ColumnsInOpenGradebook: openMiss }; }, K);
  await p.evaluate(() => { const A = window.__all; A.closeQuarter(1, { acc: [...A.unitsDueIn('acc', 1)], on: [] }); window.__tally.save(); window.__tally.render(); });
  const closed = await st();
  await p.evaluate(() => window.__all.openQuarters()); await p.click('#qReopen'); await p.waitForTimeout(300);
  const toast = ((await p.textContent('#toast').catch(() => '')) || '').replace(/\s+/g, ' ');
  const re = await st();
  console.log('OBSERVED: closed', JSON.stringify(closed), '| reopened', JSON.stringify(re), '| toast:', JSON.stringify(toast.slice(0, 140)));
  console.log('EXPECTED: either reopening brings Quarter 1\'s', re.q1MissingInRecord, 'missing marks and Unit 1 back, or the toast does not say it does');
  check(!(re.u1closed && re.q1ColumnsInOpenGradebook === 0 && /missing work and Focus checks are back/.test(toast)), 'the reopen message matches what came back');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
