// CON-04: Grades → Categories, column "Avg (turned in)" (tooltip: "Average of the scores turned in: work not handed in
// is left out here (it counts as 0 in the grade)"). The number is the mean of each student's category percent, NHIs as 0.
const H = require('./h.js');
(async () => { const { b, p, errs } = await H.open(); await H.scenarioA(p);
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const os = T.openSec(s); const gb = os.grades;
    document.querySelector('#openGrades').click();
    const th = [...document.querySelectorAll('.gtwo .checkTable thead th')].map(t => t.title).filter(Boolean)[0];
    const shown = {}; document.querySelectorAll('.gtwo .checkTable tbody tr').forEach(tr => shown[tr.children[0].innerText] = tr.children[3].innerText);
    const rec = {}; A.gradingFor(s.prep).cats.forEach(c => { const turnedIn = [], withZeros = [];
      gb.students.forEach((_, i) => { let e = 0, pz = 0, pt = 0; gb.assignments.forEach(a => { if (A.catIn(os, a) !== c.name || !(a.max > 0)) return; const st = a.status[i]; if (st === 'score') { e += +a.values[i]; pt += a.max; pz += a.max; } else if (st === 'missing') pz += a.max; });
        if (pt) turnedIn.push(e / pt * 100); if (pz) withZeros.push(e / pz * 100); });
      const m = v => v.length ? Math.round(v.reduce((x, y) => x + y, 0) / v.length) + '%' : '—'; rec[c.name] = { turnedIn: m(turnedIn), withNHIasZero: m(withZeros) }; });
    return { tooltip: th, shown, rec }; }, H.K);
  console.log('OBSERVED:', JSON.stringify(o.shown), '| tooltip:', o.tooltip);
  console.log('EXPECTED: the turned-in average', JSON.stringify(Object.fromEntries(Object.entries(o.rec).map(([k, v]) => [k, v.turnedIn]))), '(what is shown equals NHI-as-zero:', JSON.stringify(Object.fromEntries(Object.entries(o.rec).map(([k, v]) => [k, v.withNHIasZero]))) + ')');
  for (const k in o.rec) H.check(o.shown[k] === o.rec[k].turnedIn, `${k}: shown ${o.shown[k]} is the turned-in average ${o.rec[k].turnedIn}`);
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
