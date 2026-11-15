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

  // IXL-10: the grid footer's Class average includes IXL accounts flagged NOT ON ROSTER (left out of copies, Race and Lab)
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); });
    T.render(); const st = {}; A.buildRows(s).forEach(r => st[r.status] = (st[r.status] || 0) + 1);
    const foot = [...document.querySelectorAll('table.grid tfoot td')].map(t => t.innerText).join('|');
    const pop = T.population(s); const us = T.unitsOf(s).filter(u => !u.upcoming && !u.hidden);
    const pm = us.map(u => (pop.reduce((a, x) => a + T.points(s, u, x.i), 0) / pop.length).toFixed(1));
    return { st, foot, pm, n: s.students.length, ign: Object.keys(s.ignored) }; }, K);
  console.log('OBSERVED:', `rows: ${JSON.stringify(out.st)}; grid footer "Class average" per unit: ${out.foot.split('|').slice(2, 2 + out.pm.length).join(', ')}`);
  console.log('EXPECTED:', `the counted class (population(): the ${out.st.ok} roster-matched students, as the Race and Data Lab use): ${out.pm.join(', ')}`);
  check(out.foot.split('|').slice(2, 2 + out.pm.length).join(',') === out.pm.join(','), 'the grid class average is the counted class average');
  await b.close(); done();   // done() sets the exit code: 1 if any check failed
})().catch(e => { console.error(e); process.exit(2); });
