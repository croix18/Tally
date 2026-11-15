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

  // ---- IXL-04: a row kept on purpose ("Keep Focus") is copied as Focus's number, but the receipt records Tally's ----
  const out = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); });
    const u = T.unitsOf(s).find(x => x.short === 'Unit 2');
    const chk = A.reconcile(s).find(x => x.unit.name === u.name); const r = chk.rows.find(x => x.status === 'differ' && x.focus != null);
    s.overrides[u.name] = { [r.display]: { focus: r.focus, tally: r.tally, at: new Date().toISOString(), why: 'paper retake' } };
    const col = A.unitColumn(s, u, 'points'); const i = A.copyRows(s).findIndex(x => x.display === r.display);
    await A.copyUnit(s, u); const rc = s.receipts[u.name]; const rec = rc.rows.find(x => x[0] === r.display);
    A.openReceipt(s, u.name); const tr = [...document.querySelectorAll('#modal .checkTable tbody tr')][rc.rows.indexOf(rec)];
    return { pasted: col[i], focus: r.focus, tally: r.tally, receipt: rec[1], shown: tr ? tr.children[1].innerText : null }; }, K);
  console.log('OBSERVED:', `the copy pasted ${out.pasted} for the kept student (Focus ${out.focus}, Tally ${out.tally}); the receipt records ${out.receipt} and its "Copied" column shows "${out.shown}"`);
  console.log('EXPECTED:', `the receipt ("exactly what was copied", README) records and shows ${out.pasted}`);
  check(String(out.receipt) === String(out.pasted), 'the receipt records what was pasted');
  await b.close(); done();   // done() sets the exit code: 1 if any check failed
})().catch(e => { console.error(e); process.exit(2); });
