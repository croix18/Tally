// CNF-03: a Focus FAST report pulled before PM1 (only last spring's PM3 in it, the shape fastYearNow's comment names):
// parseFastReport drops PM3TestLevel (it only reads it when the PM3 is not in the report's newest year) and puts
// TestedAboveGrade on last year's PM3. The gain target then sits on the wrong grade's table. A later import does not
// clear the stale "above" (mergeTests only adds fields).
const H = require('./_h.js');
(async () => { const { b, p, errs, L, K } = await H.open({ q2: true });
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    const nm = gb.students[2], id = String(gb.ids[2]);
    const hdr = ['ID', 'Student', 'GradeLevel', 'L30', 'Percentile', 'TestedAboveGrade', 'PM3TestLevel', 'Achievement Level', 'Scale Score'];
    const aug = [hdr, ['', '', '', '', '', '', '', '2025-2026', '2025-2026'], ['', '', '', '', '', '', '', 'PM3', 'PM3'], [id, nm, '07', '', '60', 'Y', '07', '3', '240']];
    const r1 = (A.parseFastReport || window.parseFastReport)(aug); const pm3 = r1.students[0].tests[0];
    T.importFast(r1, 'fast-aug.csv');
    const t1 = A.fastTargets(s, nm);
    // the PM1 report later: the same PM3 plus this year's PM1, TestedAboveGrade now blank
    const hdr2 = ['ID', 'Student', 'GradeLevel', 'L30', 'Percentile', 'TestedAboveGrade', 'PM3TestLevel', 'Achievement Level', '', 'Scale Score', ''];
    const sep = [hdr2, ['', '', '', '', '', '', '', '2025-2026', '2026-2027', '2025-2026', '2026-2027'], ['', '', '', '', '', '', '', 'PM3', 'PM1', 'PM3', 'PM1'], [id, nm, '07', '', '60', '', '07', '3', '3', '240', '242']];
    T.importFast((A.parseFastReport || window.parseFastReport)(sep), 'fast-sep.csv');
    const pm3b = A.testHistory(s, nm).find(h => h.pm === 'PM3');
    return { pm3, t1: t1 && { priorGrade: t1.prior.grade, priorBucket: t1.priorBucket.label, gain: t1.gain.score, gainLabel: t1.gain.label }, pm3AfterSept: pm3b, line: A.testLine(pm3b) }; }, K);
  console.log('OBSERVED:', JSON.stringify(out));
  console.log('EXPECTED: PM3 2025-26 read with grade 7 (its PM3TestLevel) and no above flag; Level 3 on the grade-7 table, so the gain is Level 4 on this accelerated class grade-8 test (254); after the September report the line reads "(grade 7 test)"');
  L.check(out.pm3.grade === 7, 'PM3TestLevel is read when the report holds only last year');
  L.check(out.t1 && out.t1.priorBucket === 'Level 3' && out.t1.gain === 254, 'the gain target uses the grade of the test taken: ' + JSON.stringify(out.t1));
  L.check(!out.pm3AfterSept.above && /grade 7 test/.test(out.line), 'a later report clears the stale above-grade mark: ' + out.line);
  L.check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); L.done(); })().catch(e => { console.error(e); process.exit(2); });
