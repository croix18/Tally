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

  // ---- IXL-03: Tally goes DOWN after a copy (a skill skipped for one student, best score turned off): the Focus check calls it "up since copy" ----
  const out = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); });
    const u = T.unitsOf(s).find(x => x.short === 'Unit 2'); await A.copyUnit(s, u); const rc = s.receipts[u.name];
    // Focus now holds exactly what was copied (the teacher pasted it; the next gradebook export shows it)
    const a = s.grades.assignments.find(x => A.gbUnitFor(s, x) && A.gbUnitFor(s, x).name === u.name);
    const rows = A.gbRows(s); rows.forEach((r, i) => { const x = rc.rows.find(y => y[0] === r.display); if (x && x[1] != null) { a.values[i] = x[1]; a.status[i] = 'score'; } });
    // then one student's list is modified: a skill they had at goal is skipped just for them
    const r0 = rows.find(r => r.ixl != null && T.points(s, u, r.ixl) === u.total); const k = u.active[0];
    const key = A.ixlKeyAt(s, r0.ixl); s.studentSkips[key] = { [A.skillKey(s.skills[k])]: true };
    T.save(); T.render();
    const chk = A.reconcile(s).find(x => x.unit.name === u.name); const row = chk.rows.find(x => x.display === r0.display);
    const badge = [...document.querySelectorAll('th.unit')].map(t => t.innerText.replace(/\s+/g, ' ')).find(t => t.startsWith('Unit 2')) || '';
    A.openFocusCheck(s, u.name); const dlg = (document.querySelector('#modal').innerText.match(/up [−-]?\d+ since/) || [''])[0];
    return { who: r0.display.replace(/[a-z]/g, '').slice(0, 4), focus: row.focus, tally: row.tally, receipt: row.receipt, status: row.status, badge, dlg }; }, K);
  console.log('OBSERVED:', `Focus ${out.focus} = copied ${out.receipt}, Tally now ${out.tally}: status "${out.status}"; header "${out.badge}"; dialog "${out.dlg}"`);
  console.log('EXPECTED:', 'a student whose Tally points fell below what Focus holds is not "up since copy": Focus is now too HIGH (status differ, or a "down since copy" wording), never "up -1 since"');
  check(!(out.status === 'stale' && out.tally < out.focus), 'a drop is not reported as "up since copy"');
  check(!/up [−-]\d/.test(out.dlg), 'the dialog never says "up -N since"');
  await b.close(); done();   // done() sets the exit code: 1 if any check failed
})().catch(e => { console.error(e); process.exit(2); });
