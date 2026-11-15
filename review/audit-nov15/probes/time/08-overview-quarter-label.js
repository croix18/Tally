// TIM-08: with a Quarter 2 export in and Quarter 1 not yet closed in Tally (every class, every quarter change, until he
// closes it), the Overview's header names "Quarter 1" over the Quarter 2 grades its cards show.
const path = require('path'); const { openAt, check, done, importGb, fs } = require('./_tim.js');
const K = '1205050-7T1A';
(async () => {
  const { b, p, errs } = await openAt('America/New_York', '2026-10-20T15:00:00Z');   // Tue 20 Oct: Quarter 1 ended 9 Oct, not closed yet
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await importGb(p, path.resolve('fixtures/focus_gradebook_scrubbed.csv'));
  await importGb(p, path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv'));
  await p.click('#btnHome'); await p.waitForTimeout(400);
  const r = await p.evaluate(K => { const A = window.__all, s = window.__tally.state.sections[K];
    const metas = [...document.querySelectorAll('.meta')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(t => /Quarter \d/.test(t));
    return { live: A.liveQuarter(s), liveQ: A.liveQ(), cq: A.currentQuarter(), metas: metas.slice(0, 3), summaryQ: A.gradeSummary(s).q }; }, K);
  console.log('OBSERVED:', JSON.stringify(r));
  console.log('EXPECTED: the Overview names Quarter 2, the quarter of the grades under it (liveQ() =', r.liveQ + ')');
  check(r.metas.length > 0 && r.metas.every(t => !/Quarter 1/.test(t) && /Quarter 2/.test(t)), 'the Overview header names Quarter 2');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
