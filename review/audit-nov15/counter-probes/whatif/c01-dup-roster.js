// WIF-01, realistic staging: the roster AND the gradebook both carry the duplicate name (row 1 renamed to row 0's name in both).
const path = require('path'); const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/counter-whatif/repo';
const { chromium, fs, exe, pick, APP } = require(path.join(REPO, 'tests/lib.js')); const K = '1205050-7T1A';
(async () => { const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage(); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed')); await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  const ros = fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8').split('\n'); const n0 = ros[0], n1 = ros[1]; ros[1] = n0;
  await p.fill('#rpText', ros.join('\n')); await p.click('#rpSave'); await p.waitForTimeout(300);
  const gbt = fs.readFileSync('fixtures/focus_gradebook_scrubbed.csv', 'utf8').split('"' + n1 + '"').join('"' + n0 + '"'); const tmp = '/tmp/cw-gb-dup.csv'; fs.writeFileSync(tmp, gbt);
  await p.setInputFiles('#file', [tmp]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const gb = s.grades; const l = A.classStudents(s);
    const g = gb.students.map((n, i) => [n, T.computeGrade(s, i).rounded]).slice(0, 2);
    const books = g.map(([n]) => { const bk = A.studentBooks(s, n); const x = bk[bk.length - 1]; return x ? x.i : null; });
    const show = g.map(([n]) => { const f = A.findStudent(s, n); return f.gi; });
    return { n: l.length, list: l.filter(x => /SUTTER/.test(x)), g, booksRow: books, findRow: show }; }, K);
  console.log(JSON.stringify(r)); await b.close(); })();
