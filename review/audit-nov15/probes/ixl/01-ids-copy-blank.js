// PROBE TEMPLATE for the Tally deep audit (15 Nov 2026). Copy it, rename it probes/NN-slug.js, and replace the body.
//   Run:   TALLY_REPO=/home/claude/work/audit/<you>/repo node probes/NN-slug.js
//   Exit:  1 when the defect is present (a check fails), 0 when everything checked is right.
// It must run on ANY clean audit copy (the counter agent reruns it on its own), so use only window.__tally / window.__all,
// the repo's fixtures, and data you synthesize inside the script. No real student data, ever.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/ixl/repo';
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

  // ---- IXL-01: "ID + points" copy (and the CSV keyed by student ID) once a Focus gradebook is loaded ----
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    T.state.settings.copyMode = 'ids'; const u = T.unitsOf(s).find(x => x.short === 'Unit 2');
    const lines = A.unitColumn(s, u, 'ids'); const gb = s.grades;
    const rows = A.copyRows(s); const rc = A.reconcile(s).find(x => x.unit.name === u.name);
    return { nIds: (gb.ids || []).filter(Boolean).length, nStu: gb.students.length, first3: lines.slice(0, 3), withId: lines.filter((l, i) => gb.ids && gb.ids[i] && l.startsWith(gb.ids[i] + '\t')).length,
      rowIds: rows.filter(r => r.id).length, rcIds: rc ? rc.rows.filter(r => r.id).length : -1 }; }, K);
  console.log('OBSERVED:', `${out.withId} of ${out.nStu} "ID + points" lines start with the student's Focus ID (gradebook has ${out.nIds} IDs); copyRows rows with an id: ${out.rowIds}; Focus-check rows with an id: ${out.rcIds}; first lines ${JSON.stringify(out.first3)}`);
  console.log('EXPECTED:', `every line of an "ID + points" copy (and every row of the CSV "keyed by student ID") carries that student's Focus ID: ${out.nIds} of ${out.nStu}`);
  check(out.withId === out.nIds && out.nIds > 0, 'ID + points copy carries the IDs the gradebook has');
  check(out.rowIds === out.nIds, 'copyRows (CSV, corrections) carry the IDs');
  await b.close(); done();   // done() sets the exit code: 1 if any check failed
})().catch(e => { console.error(e); process.exit(2); });
