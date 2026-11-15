// GRD-04: "since the last import" compares grades computed under DIFFERENT grading settings. A history snapshot keeps
// only the computed grades of its day; a change of weights (or a category, a text-grade rule, extra credit, a See-why
// fix) re-grades only the current snapshot. The previous import's grades stay as they were computed, so the Students
// table's change column, "Sliding", the class-average change and the digest report the settings change as students'
// progress. No score changed between the two imports here.
const path = require('path');
const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, fs, exe, check, done, pick, APP } = require(path.join(REPO, 'tests/lib.js'));
const K = '1205050-7T1A';
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  // The previous import: the same gradebook three days earlier (same scores, same settings), as a Monday export would leave.
  await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const h = s.gradeHistory; const last = h[h.length - 1];
    const d = new Date(last.date + 'T12:00:00'); d.setDate(d.getDate() - 3); const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    h.unshift({ ...JSON.parse(JSON.stringify(last)), date: ds, at: d.toISOString() }); T.save(); T.render(); }, K);
  const before = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const prev = A.prevGradeSnap(s);
    return { prev: prev && prev.date, deltas: s.grades.students.map((n, i) => A.computeGrade(s, i).rounded - prev.grade[prev.students.indexOf(n)]) }; }, K);
  // Croix corrects the weights in the Weights dialog (Assessments 70 -> 80, Classwork 25 -> 15), as Focus has them.
  await p.click(`[data-k="${K}"]`).catch(() => {}); await p.waitForTimeout(200); await p.click('#openGrades'); await p.waitForTimeout(400);
  await p.click('#gradesWeights'); await p.waitForTimeout(200);
  await p.fill('[data-w="0"]', '80'); await p.fill('[data-w="1"]', '15'); await p.click('#wSave'); await p.waitForTimeout(400);
  const after = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const prev = A.prevGradeSnap(s);
    const deltas = s.grades.students.map((n, i) => A.computeGrade(s, i).rounded - prev.grade[prev.students.indexOf(n)]);
    const tags = document.querySelectorAll('#gridwrap .gstu .gtag').length; const card = [...document.querySelectorAll('#gridwrap .gcard')].map(c => c.textContent.replace(/\s+/g, ' ').trim()).filter(t => /Class average|Sliding/.test(t));
    const moved = s.grades.students.map((n, i) => ({ n, d: deltas[i] })).filter(x => x.d).length;
    return { weights: T.gradingFor(s.prep).cats.map(c => c.name[0] + c.w).join(' '), deltas, moved, slidingTags: tags, card }; }, K);
  console.log('OBSERVED: before the weights change, change since the previous import:', JSON.stringify(before.deltas));
  console.log('OBSERVED: after (' + after.weights + '), with no score changed:', JSON.stringify(after.deltas), `→ ${after.moved} students show a change; ${after.slidingTags} "sliding" tags; cards: ${JSON.stringify(after.card)}`);
  console.log('EXPECTED: no change for anyone (no score changed between the two imports): the change since the last import should compare like with like, or say the settings changed');
  check(before.deltas.every(d => d === 0), 'setup: no change before');
  check(after.moved === 0 && after.slidingTags === 0, 'a weights change is not reported as students moving');
  check(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
