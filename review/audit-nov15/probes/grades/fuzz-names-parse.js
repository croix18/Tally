// GRD coverage harness: asgUnitNums / isUnitAssessment / isPretest on a battery of names, and parseGradebook on cell
// and header forms. Prints a table; exits 1 on any line whose expectation fails.
const path = require('path');
const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(300);
  const names = [
    ['Unit 10 Test', [10], true], ['Unit 1 Test', [1], true], ['Unit 3-4 Test', [3, 4], true], ['Unit 3/4 Test', [3, 4], true], ['Units 3 & 4 Exam', [3, 4], true],
    ['10/3 Quiz', [], false], ['Quiz 3.2', [3], false], ['U3 Assessment', [], false], ['Unit 2 Re-Assessment', [2], false], ['Unit 2 Reassessment', [2], false],
    ['Unit 3 Assessment 10/3', [3], true], ['Unit 3 Assessment (Form B)', [3], true], ['Unit 3 Pre-Test', [3], false], ['Unit 3 Pretest', [3], false], ['Unit 3 Post-Test', [3], true],
    ['Unit 3 Test Retake', [3], false], ['Unit 3 Test Corrections', [3], false], ['Unit 3 Practice Test', [3], false], ['Unit 3 Review', [3], false], ['Unit 1-3 Benchmark', [1, 2, 3], false],
    ['Unit 4 Test 2', [4], true], ['Unit 12 Assessment', [12], true], ['Units 3, 4, and 5 Test', [3, 4, 5], true], ['Unit 3 and Unit 4 Test', [3, 4], true], ['Unit 5 to 7 Test', [5, 6, 7], true],
    ['Unit 7.1-7.3 Quiz', [7], false], ['Unit 2 Test - 9/21', [2], true], ['Unit 2 Test 9/21/26', [2], true], ['Unit 1 Vocabulary Quiz', [1], false], ['Unit 1 Notebook Check', [1], false],
    ['Mid-Unit 3 Assessment', [3], true], ['Unit3 Test', [3], true], ['UNIT 6 TEST', [6], true], ['Unit 6 Test Re-Do', [6], false], ['Unit 6 Retest', [6], false],
    ['Unit 2 Test (Part 1 of 2)', [2], true], ['Unit 2 Test Part 2', [2], true], ['2.03 Worksheet', [2], false], ['Worksheet 1.4', [1], false], ['Unit 2 IXL', [2], false],
    ['Unit 4 Exam: 50 pts', [4], true], ['Unit 1 & 2 Cumulative Test', [1, 2], true], ['Unit 5–6 Test', [5, 6], true], ['Unit 9 - 10 Test', [9, 10], true], ['Unit 4 Quiz 4.2', [4], false],
  ];
  const nameRes = await p.evaluate(names => { const A = window.__all; return names.map(([n]) => [n, A.asgUnitNums(n), A.isUnitAssessment(n), A.isPretest(n)]); }, names);
  let bad = 0; nameRes.forEach(([n, nums, ua, pre], k) => { const [, wantN, wantUA] = names[k]; const ok = JSON.stringify(nums) === JSON.stringify(wantN) && (ua && !pre) === wantUA; if (!ok) { bad++; console.log('NAME', JSON.stringify(n), 'nums', JSON.stringify(nums), 'want', JSON.stringify(wantN), 'unitAssessment', ua && !pre, 'want', wantUA); } });
  console.log(`names: ${names.length - bad}/${names.length} as expected`);
  // ---- parseGradebook cells ----
  const cells = [['8.5', 8.5, 'score'], ['.5', 0.5, 'score'], ['1,000', null, '?'], [' 7 ', 7, 'score'], ['100%', 10, 'score'], ['16.5 - 79 % - C', 16.5, 'score'], ['16.5 - 79% - C+', 16.5, 'score'], ['NHI', null, 'missing'], ['NHI Not Handed In', null, 'missing'],
    ['NG', null, 'excused'], ['ng', null, 'excused'], ['EX', null, 'excused'], ['Z', 0, 'score'], ['-3', null, 'unread'], ['25', null, 'unread'], ['15', 15, 'score'], ['8/10', 8, 'score'], ['', null, 'blank'], ['Late', null, 'unread'], ['0', 0, 'score'], ['9.75', 9.75, 'score'], ['5 / 10', 5, 'score'], ['NHI - 0 % - F', null, 'missing'], ['8.5 - 85 % - B', 8.5, 'score']];
  const pr = await p.evaluate(cells => { const T = window.__tally; const rows = [['Student', 'Grade', 'Quiz\n10 Points\nDue 10/03/26', 'Other\n10 Points']]; cells.forEach(([c], k) => rows.push([`Stu${String.fromCharCode(65 + k % 26)}${k}, Test`, '80%', c, '5']));
    const gb = T.parseGradebook(rows); const a = gb.assignments[0]; return { max: a.max, due: a.due, v: a.values, s: a.status, codes: a.codes || {}, n: gb.students.length }; }, cells);
  let cbad = 0; cells.forEach(([c, v, s], k) => { const gv = pr.v[k], gs = pr.s[k]; if (s === '?') { console.log('CELL', JSON.stringify(c), '->', gv, gs, pr.codes[k] || ''); return; } if (gv !== v || gs !== s) { cbad++; console.log('CELL', JSON.stringify(c), 'got', gv, gs, 'want', v, s); } });
  console.log(`cells: max ${pr.max} due ${pr.due}; ${cells.length - cbad}/${cells.length} as expected`);
  // ---- the Grade column's formats ----
  const ovs = [['79% C', 79], ['79 %', 79], ['79', 79], ['79.5%', 79.5], ['C (79%)', 79], ['79% C+', 79], ['', null], ['-', null], ['100%', 100], [' 88% B ', 88]];
  const ov = await p.evaluate(ovs => { const T = window.__tally; const rows = [['Student', 'Grade', 'Quiz\n10 Points']]; ovs.forEach(([c], k) => rows.push([`Ov${String.fromCharCode(65 + k)}, Test`, c, '5'])); return T.parseGradebook(rows).overall; }, ovs);
  let obad = 0; ovs.forEach(([c, v], k) => { if ((ov ? ov[k] : null) !== v) { obad++; console.log('GRADE', JSON.stringify(c), 'got', ov && ov[k], 'want', v); } });
  console.log(`grade column: ${ovs.length - obad}/${ovs.length}`);
  check(!bad, 'unit names'); check(!cbad, 'cells'); check(!obad, 'grade column'); check(!errs.length, 'no page errors');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
