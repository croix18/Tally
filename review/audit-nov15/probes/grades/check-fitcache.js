// GRD coverage: fitCache follows a weights edit, a category move, a text-grade rule and an extra-credit answer.
const path = require('path'); const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, fs, exe, check, done, pick, APP } = require(path.join(REPO, 'tests/lib.js')); const K = '1205050-7T1A';
(async () => { const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage(); p.on('dialog', d => d.accept()); await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed')); await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const g = T.gradingFor(s.prep); const gb = s.grades; const out = [];
    const f = () => { const x = A.fitCategories(s); return x.exact + ':' + x.err; }; out.push(f());
    g.cats[0].w = 60; g.cats[1].w = 35; out.push(f()); g.cats[0].w = 70; g.cats[1].w = 25; out.push(f());
    const a = gb.assignments.find(x => x.name === 'Unit 1 Assessment'); const old = g.map[a.name], oh = g.how[a.name]; g.map[a.name] = 'Classwork'; g.how[a.name] = 'user'; out.push(f()); g.map[a.name] = old; g.how[a.name] = oh; out.push(f());
    // a text grade: one score becomes "Late", counted as zero by a rule
    const i = a.status.findIndex(x => x === 'score'); const v = a.values[i]; a.codes = { [i]: 'Late' }; A.applyCodes(gb, s.prep); out.push(f()); g.codes.LATE = 'zero'; A.applyCodes(gb, s.prep); out.push(f());
    delete g.codes.LATE; delete a.codes; a.status[i] = 'score'; a.values[i] = v; out.push(f());
    gb.assignments.push({ name: 'Bonus', max: null, values: gb.students.map((_, k) => k === 0 ? 5 : null), status: gb.students.map((_, k) => k === 0 ? 'score' : 'blank'), missing: 0 }); out.push(f()); g.ec.Bonus = true; out.push(f());
    return out; }, K);
  console.log(JSON.stringify(r));
  check(r[0] === 'true:0' && r[1] !== r[0] && r[2] === 'true:0' && r[3] !== 'true:0' && r[4] === 'true:0' && r[7] === 'true:0' && r[8] === 'true:0' && r[9] !== 'true:0', 'the fit follows every change');
  await b.close(); done(); })();
