// HLT-06: category percents are rounded with a bare Math.round (pct1, grades.js line 444; the report's category bars,
// grades.js line 873; the profile, students.js lines 495-501, 739; the conference form, conference.js line 505), while
// the course grade uses roundPct (half up with 1e-9 slack). 23 of 40 points is exactly 57.5%, but 23/40*100 is
// 57.49999999999999 in floating point, so the category shows 57% where the same rule Tally uses for grades gives 58%.
const path = require('path'); process.env.TALLY_REPO = process.env.TALLY_REPO || '/home/claude/work/audit/health/repo';
const { open, K, lib } = require('./_load.js'); const { check, done } = lib;
(async () => {
  const { b, p, errs } = await open();
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = JSON.parse(JSON.stringify(T.state.sections[K])); const n = s.grades.students.length;
    // one student, Assessments only: a 40-point test, 23 earned
    s.grades.assignments = [{ name: 'Synthetic Test', category: 'Assessments', categoryFromFile: false, max: 40, values: Array(n).fill(23), status: Array(n).fill('score'), missing: 0, excused: 0, unread: 0, percent: false, assignedOn: '11/10', due: '11/10' }];
    s._map = { 'Synthetic Test': 'Assessments' }; s.grades.overall = null;
    const r = A.computeGrade(s, 0); const c = r.cats.Assessments;
    return { catPct: c.pct, shownByPct1: A.pct1(c.pct), shownByMathRound: Math.round(c.pct) + '%', courseGrade: r.rounded + '%' }; }, K);
  console.log('OBSERVED:', JSON.stringify(out));
  console.log('EXPECTED: 23/40 = 57.5% shown as 58% (half up, the rule roundPct applies to the course grade), so a one-category grade and its category agree');
  check(out.shownByPct1 === '58%', 'category percent rounds 57.5 up');
  check(out.shownByPct1 === out.courseGrade, 'category percent = course grade when the grade has one category');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
