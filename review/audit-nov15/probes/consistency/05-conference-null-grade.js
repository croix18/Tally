// CON-05: a student with nothing graded this quarter (every cell NG / excused). The student page says "nothing graded
// yet"; the conference panel says "Quarter 1: null% " and the printed form "Current Grade: %".
const H = require('./h.js');
(async () => { const { b, p, errs } = await H.open(); await H.scenarioA(p);
  const rows = H.gbRead('fixtures/focus_gradebook_scrubbed.csv'); const r = rows.findIndex(x => x[2] === 'MERCER, EVERLY MARLOW'); for (let c = 4; c < rows[0].length; c++) rows[r][c] = 'NG';
  await H.importGb(p, H.gbWrite(rows, 'nothing-graded.csv'));
  const o = await p.evaluate(K => { const T = window.__tally; const name = 'MERCER, EVERLY MARLOW'; T.openProfile(K, name);
    const tile = document.querySelector('.profile .gcard.big').innerText.replace(/\s+/g, ' ');
    document.querySelector('#pConf').click(); const m = document.querySelector('#modal'); const facts = (m.querySelector('.cfFacts') || m).innerText.replace(/\s+/g, ' ');
    window.__prints = []; const pb = [...m.querySelectorAll('button')].find(b => /^Print$/.test(b.innerText.trim())); if (pb) pb.click();
    const d = new DOMParser().parseFromString(window.__prints.pop() || '', 'text/html'); d.querySelectorAll('script,style').forEach(x => x.remove());
    const cur = (/Current Grade:\s*([^R]*)Report/.exec(d.body.textContent.replace(/\s+/g, ' ')) || [])[1];
    return { tile, facts: facts.slice(0, 160), printed: 'Current Grade:' + cur }; }, H.K);
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: no "null" on screen; the panel and the form say no grade yet (as the tile does: "nothing graded yet")');
  H.check(!/null/.test(o.facts), 'conference panel has no "null"');
  H.check(!/Current Grade:\s*%/.test(o.printed), 'printed form does not print a bare "%"');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
