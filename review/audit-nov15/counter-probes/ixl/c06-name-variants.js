// PROBE TEMPLATE for the Tally deep audit (15 Nov 2026). Copy it, rename it probes/NN-slug.js, and replace the body.
//   Run:   TALLY_REPO=/home/claude/work/audit/<you>/repo node probes/NN-slug.js
//   Exit:  1 when the defect is present (a check fails), 0 when everything checked is right.
// It must run on ANY clean audit copy (the counter agent reruns it on its own), so use only window.__tally / window.__all,
// the repo's fixtures, and data you synthesize inside the script. No real student data, ever.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/counter-ixl/repo';
const { chromium, fs, exe, check, done, pick, tmp, APP } = require(path.join(REPO, 'tests/lib.js'));   // lib.js chdirs into REPO
const K = '1205050-7T1A';   // the scrubbed real class in fixtures/ (16 counted students, accelerated)
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true /* , timezoneId: 'America/New_York' */ });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  // ---- one real (scrubbed) class: IXL Score Grid, then the Focus roster, then the Quarter 1 Focus gradebook ----
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  // (a Quarter 2 gradebook for the same class: fixtures/focus_gradebook_scrubbed_q2.csv, imported the same way)

  // ---- IXL-06: one gradebook name the roster reader can't read shifts every copy row below it by one ----
  const before = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); });
    const u = T.unitsOf(s).find(x => x.short === 'Unit 2'); return { col: A.unitColumn(s, u, 'points'), names: s.grades.students.slice() }; }, K);
  // the same Focus export, with the 4th student's name as Focus could hold it in another script (synthetic name)
  const src = fs.readFileSync('fixtures/focus_gradebook_scrubbed.csv', 'utf8');
  const VAR = process.env.VAR || ''; const mod = src.replace('EASTON, LOGAN KAI', VAR); const f2 = require('path').join(tmp, 'focus_gradebook_scrubbed.csv'); fs.writeFileSync(f2, mod);
  await p.setInputFiles('#file', [f2]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    const u = T.unitsOf(s).find(x => x.short === 'Unit 2'); const rows = A.copyRows(s);
    return { col: A.unitColumn(s, u, 'points'), names: s.grades.students.slice(), rowNames: rows.map(r => r.display) }; }, K);
  const i = 3; console.log('variant', JSON.stringify(VAR), 'gb names', out.names.length, 'row4', JSON.stringify(out.names[3]));
  const wrong = out.names.map((n, j) => j === i ? null : (out.col[j] !== before.col[before.names.indexOf(n)] ? `${j + 1}` : null)).filter(Boolean);
  const misrow = out.names.map((n, j) => out.rowNames[j] === n ? null : `${j + 1}`).filter(Boolean);
  console.log('OBSERVED:', `gradebook has ${out.names.length} students (row ${i + 1} renamed); copy has ${out.col.length} lines; ${misrow.length} rows are a different student than Focus's row (rows ${misrow.join(',')}); ${wrong.length} students would get another student's points; last copy row is "${out.rowNames[out.rowNames.length - 1]}"`);
  console.log('EXPECTED:', `row ${i + 1} blank (not matched to IXL), every other row the points of that row's own student (0 rows shifted)`);
  check(misrow.length === 0 && wrong.length === 0, 'copy rows stay on their Focus rows');
  await b.close(); done();   // done() sets the exit code: 1 if any check failed
})().catch(e => { console.error(e); process.exit(2); });
