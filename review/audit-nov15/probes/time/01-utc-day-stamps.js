// TIM-01: stamps made with toISOString() are shown (and compared) by their UTC day: after 7 pm Eastern (8 pm in
// summer time) the screen names tomorrow. Clock: Fri 18 Dec 2026, 8:30 pm New York (= 01:30 UTC on 19 Dec).
const path = require('path'); const { openAt, check, done, pick, fs } = require('./_tim.js');
const K = '1205050-7T1A';
(async () => {
  const { b, p, errs } = await openAt('America/New_York', '2026-12-19T01:30:00Z');
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  // the teacher copies a unit's points to Focus tonight
  const ui = await p.evaluate(K => window.__tally.unitsOf(window.__tally.state.sections[K]).findIndex(u => u.total > 0), K);
  await p.click(`.copy[data-c="${ui}"]`); await p.waitForTimeout(400);
  const copied = (await p.locator('.rlink').first().textContent().catch(() => '')).trim();
  // Quarter 1 was closed in October; tonight, the last day of Quarter 2, he closes Quarter 2 (early: it ends today)
  await p.evaluate(() => { const T = window.__tally, A = window.__all; const q = A.quarters(); q.closed = { 1: { at: '2026-10-12T15:00:00.000Z' } };
    A.closeQuarter(2, { acc: [], on: [] }); T.save(); T.render(); });
  await p.click('#btnHome'); await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const T = window.__tally, A = window.__all;
    const notice = (document.querySelector('.qce') || {}).textContent || '';
    A.openQuarters(); const dlg = (document.querySelector('.qclosed') || {}).textContent || ''; document.querySelector('#mClose').click();
    return { today: A.todayISO(), early: A.closedEarly(), notice: notice.replace(/\s+/g, ' ').trim(), dlg: dlg.replace(/\s+/g, ' ').trim() }; });
  console.log('OBSERVED: today', r.today, '| unit link:', JSON.stringify(copied), '| Overview:', JSON.stringify(r.notice.slice(0, 80)), '| Quarters dialog:', JSON.stringify(r.dlg));
  console.log('EXPECTED: every date says Dec 18 (the local day); the dialog tags Quarter 2 "early, it ends Dec 18", as closedEarly() =', r.early, 'and the Overview notice do');
  check(/Dec 18/.test(copied) && !/Dec 19/.test(copied), 'the "copied" link names the local day');
  check(/on Dec 18/.test(r.notice), 'the Overview "closed early on" names the local day');
  check(/Quarter 2 closed Dec 18/.test(r.dlg), 'the Quarters dialog says "closed Dec 18"');
  check(/early, it ends Dec 18/.test(r.dlg), 'the Quarters dialog tags the early close, as closedEarly() does');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
