// CON-09: in Quarter 2 the Overview's "IXL work at goal" (and its chart, and the Race) counts every unit up to Working
// in, Quarter 1's units included; the Students list, student page, weekly report and Still owed count this quarter's
// units. Same words, two numbers for the same class.
const H = require('./h.js');
(async () => { const { b, p, errs } = await H.open(); await H.scenarioA(p); await H.importGb(p, 'fixtures/focus_gradebook_scrubbed_q2.csv');
  const o = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; document.querySelector('#btnHome').click();
    const card = document.querySelector(`.hcard[data-go="${CSS.escape(K)}"]`); const tile = [...card.querySelectorAll('.hnums>div')].find(d => /IXL work at goal/i.test(d.innerText)).innerText.replace(/\s+/g, ' ');
    const open = T.unitsOf(s).filter(u => u.assigned && u.total && !T.unitClosed(s, u)); let d = 0, n = 0;
    T.population(s).forEach(x => open.forEach(u => { d += T.points(s, u, x.i); n += T.totalFor(s, u, x.i); }));
    return { tile, quarter: T.liveQuarter(s), open: open.map(u => u.short), openPct: Math.round(d / n * 100) }; }, H.K);
  console.log('OBSERVED:', JSON.stringify(o));
  console.log(`EXPECTED: "IXL work at goal" on the Overview = the class's Quarter ${o.quarter} IXL (${o.open.join(', ')}): ${o.openPct}%, as on the Students list / report (or a label that says "all year")`);
  H.check(o.tile.includes(o.openPct + '%'), 'Overview IXL at goal is on this quarter\'s units');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
