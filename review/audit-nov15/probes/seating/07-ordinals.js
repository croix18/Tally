// SEA-07: standingText writes every percentile with "th": "FAST 22th pct", "3th percentile in class", "1th percentile".
// The conference form already has an ordinal() helper (conference.js line 112).
const { open, check, done } = require('./h.js');
(async () => {
  const { b, p, errs, K } = await open();
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; T.state.seatBasis = 'blend';
    const t = A.standingText({ pct: 22, level: 2, grade: 61.4, gradeRank: 3, ixlPct: 40, ixlRank: 1, standing: 9 });
    // and on the real class: how many students' sheet lines carry a wrong ordinal
    const s = T.state.sections[K]; const bad = A.seatStudents(s).map(x => A.standingText(x)).filter(x => /\b(\d*1)th\b|\b(\d*2)th\b|\b(\d*3)th\b/.test(x.replace(/\b1[123]th\b/g, '')));
    return { sample: t, fixtureLinesWithWrongOrdinal: bad.length, example: bad[0] || '' }; }, K);
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: "FAST 22nd pct (L2) · Focus 61% (3rd percentile in class) · IXL 40% (1st percentile) → standing 9"');
  check(!/22th|3th|1th/.test(o.sample), 'ordinals read 22nd / 3rd / 1st');
  check(o.fixtureLinesWithWrongOrdinal === 0, 'no student sheet line in the fixture class has a wrong ordinal');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
