const { open, K } = require('./_load.js'); const path = require('path'); const { pick } = require('./_load.js').lib;
(async () => {
  const { b, p, errs } = await open();
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const a = s.qArchive && s.qArchive[1];
    if (!a) return { noArch: Object.keys(s.qArchive || {}) };
    const q = A.qSec(s, 1); const diffs = [];
    a.gb.students.forEach((n, i) => { const r = A.computeGrade(q, i); const sum = A.studentSummary(s, n); const f = sum && sum.finals && sum.finals.find(x => x.q === 1); if ((r && r.rounded) !== a.final[i]) diffs.push([i, r && r.rounded, a.final[i], f && f.g]); });
    const codes = a.gb.assignments.filter(x => x.codes && Object.keys(x.codes).length).map(x => x.name + ':' + JSON.stringify(x.codes)).slice(0, 5);
    return { n: a.gb.students.length, overall: !!a.gb.overall, diffs, codes, ec: a.gb.assignments.filter(x => x.max == null || x.max === 0).map(x => x.name), qClosed1: A.qClosed(1), gbQ: A.gbQuarter(s.grades) }; }, K);
  console.log(JSON.stringify(out)); console.log(errs.join('|'));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
