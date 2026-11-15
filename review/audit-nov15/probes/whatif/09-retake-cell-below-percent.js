// WIF-09: the "If an assessment were retaken" table's 70% / 80% / 90% columns round the score to the NEAREST half point,
// so a cell under "70%" can hold a score below 70% (14.5 / 21 = 69.0%). Since 19 Oct the arrow is computed from the
// score shown (right), but the header and the score disagree.
const S = require('./_setup.js');
(async () => { const { b, p, errs } = await S.open();
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    const a = gb.assignments.find(x => x.name === 'Unit 1 Assessment'); const i = 0; a.status[i] = 'score'; a.values[i] = 10;
    const div = document.createElement('div'); div.innerHTML = A.whatIfMarkup(A.openSec(s), i, A.retakeStatus(s, gb.students[i]));
    const tr = [...div.querySelectorAll('table.whatif tbody tr')].find(x => x.querySelector('b').textContent === a.name);
    const cells = [...tr.children].slice(2).map((td, k) => { const m = /([\d.]+)\/(\d+)/.exec(td.textContent); return { head: [70, 80, 90, 100][k], pts: m ? +m[1] : null, pct: m ? +m[1] / +m[2] * 100 : null }; });
    return { max: a.max, cells };
  }, S.K);
  const bad = r.cells.filter(c => c.pct != null && c.pct < c.head - 1e-9);
  console.log('OBSERVED: Unit 1 Assessment out of', r.max + ':', r.cells.map(c => `${c.head}% column → ${c.pts}/${r.max} (${c.pct.toFixed(1)}%)`).join(' · '));
  console.log('EXPECTED: each column\'s score is at least that percent: the least half point at or above it (70% of 21 = 14.7 → 15, 90% → 19)');
  S.check(bad.length === 0, 'no column shows a score below its own percent (' + bad.map(c => c.head + '%').join(', ') + ')');
  S.check(errs.length === 0, 'no page errors');
  await b.close(); S.done(); })().catch(e => { console.error(e); process.exit(2); });
