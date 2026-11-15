// CON-08: a class made from its Focus gradebook, with no IXL yet. Its Overview card reads "IXL WORK AT GOAL — first
// import": the reason given for the dash is wrong (there is no IXL import at all).
const H = require('./h.js'); const path = require('path');
(async () => { const { b, p, errs } = await H.open(); await H.scenarioA(p);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_pool_p2.csv')]); await p.waitForTimeout(800);
  await p.evaluate(() => { const bs = [...document.querySelectorAll('#modal button')]; const b2 = bs.find(b => b.innerText.trim() === '2'); if (b2) b2.click(); const ac = bs.find(b => b.innerText.trim() === 'Accelerated'); if (ac) ac.click(); }); await p.waitForTimeout(200);
  await p.click('#ncMake'); await p.waitForTimeout(800); if (await p.$('#modal:not(.hidden) #askApply')) { await p.click('#askApply'); await p.waitForTimeout(400); }
  const o = await p.evaluate(() => { const T = window.__tally; document.querySelector('#btnHome').click(); const k = T.state.order.find(k => !T.state.sections[k].students.length);
    const card = document.querySelector(`.hcard[data-go="${CSS.escape(k)}"]`); const ixl = [...card.querySelectorAll('.hnums>div')].find(d => /IXL work at goal/i.test(d.innerText));
    return { key: k, ixlStudents: T.state.sections[k].students.length, history: (T.state.sections[k].history || []).length, tile: ixl.innerText.replace(/\s+/g, ' ') }; });
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: the dash explained as no IXL export yet (the class has', o.history, 'IXL imports), not "first import"');
  H.check(!/first import/i.test(o.tile), 'no "first import" under a class with no IXL import');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
