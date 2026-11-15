// HLT-02: a kept quarter has two "final" grades. The Students list, the profile's quarter tile and the Overview card read
// the stored final (Focus's own Grade column); the Grades screen's "Q1 · final" tab, its "Final class average" and the
// profile's per-quarter heading recompute the grade from the kept cells. Whenever Tally's computation does not reproduce
// Focus (the Focus check's "N students off": an unread text code, a wrong category guess), the two disagree.
const path = require('path'); process.env.TALLY_REPO = process.env.TALLY_REPO || '/home/claude/work/audit/health/repo';
const { open, K, lib } = require('./_load.js'); const { check, done, pick } = lib;
(async () => {
  const { b, p, errs } = await open();
  // Quarter 1 export as Focus wrote it, except one student's Unit 1 Assessment cell reads "INC" (Focus counted it; Tally has no rule for INC yet)
  const st = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    const a = gb.assignments.find(x => x.name === 'Unit 1 Assessment'); const i = a.status.findIndex(x => x === 'score' && a.values[x === 'score' ? 0 : 0] != null);
    a.codes = a.codes || {}; a.codes[i] = 'INC'; A.applyCodes(gb, s.prep); T.save(); return { i, name: gb.students[i], focus: gb.overall[i], tally: A.computeGrade(s, i).rounded }; }, K);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(700); await pick(p); await p.waitForTimeout(700);
  const out = await p.evaluate(([K, i, name]) => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; if (!A.qClosed(1)) A.closeQuarter(1, {}); const arch = s.qArchive[1]; const q = A.qSec(s, 1);
    const j = arch.gb.students.indexOf(name); const sum = A.studentSummary(s, name); const f = sum.finals.find(x => x.q === 1);
    const home = A.gradeSummary(s); A.gradingFor(s.prep).codes.INC = 'zero'; A.regradeCourse(s.prep); const afterRule = A.computeGrade(A.qSec(s, 1), j).rounded;
    return { q1Closed: A.qClosed(1), storedFinal: arch.final[j], studentsListFinal: f && f.g, gradesTabFinal: A.computeGrade(q, j).rounded, overviewQ1Avg: home.qFinal && +home.qFinal.avg.toFixed(2), gradesTabAvg: +A.classAverage(q).toFixed(2), gradesTabFinalAfterInczero: afterRule, archivedCellStatus: arch.gb.assignments.find(x => x.name === 'Unit 1 Assessment').status[j] }; }, [K, st.i, st.name]);
  console.log('staged:', JSON.stringify(st));
  console.log('OBSERVED:', JSON.stringify(out));
  console.log('EXPECTED: one Quarter 1 final per student and one Quarter 1 class average on every screen (GRADES_SPEC sec. 7: the kept "final" equals the Focus Grade column)');
  check(out.studentsListFinal === out.gradesTabFinal, 'Students list Q1 final = Grades "Q1 · final" tab grade');
  check(out.overviewQ1Avg === out.gradesTabAvg, 'Overview Q1 final average = Grades "Final class average"');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
