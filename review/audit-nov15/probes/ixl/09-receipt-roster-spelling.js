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
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8').split('\n').map(l => l.toLowerCase().replace(/(^|[\s,'-])([a-z])/g, (m, a, b) => a + b.toUpperCase())).join('\n')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  // (a Quarter 2 gradebook for the same class: fixtures/focus_gradebook_scrubbed_q2.csv, imported the same way)

  // ---- IXL-09: the receipt matches rows by the ROSTER's spelling, the copy writes them by the GRADEBOOK's ----
  const out = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); });
    const u = T.unitsOf(s).find(x => x.short === 'Unit 2'); await A.copyUnit(s, u);
    A.openReceipt(s, u.name); const txt = document.querySelector('#modal').innerText;
    const gone = (txt.match(/not on the roster now/g) || []).length; const sum = (txt.match(/[^\n]*no longer on the roster[^\n]*/) || [''])[0];
    return { roster0: s.roster.split('\n')[0], gb0: s.grades.students[0], gone, rows: s.receipts[u.name].rows.length, sum }; }, K);
  console.log('OBSERVED:', `roster line 1 "${out.roster0}", gradebook "${out.gb0}"; right after the copy the receipt marks ${out.gone} of ${out.rows} rows "not on the roster now" (${out.sum.trim()})`);
  console.log('EXPECTED:', '0 rows "not on the roster now": every copied student is still in the class, seconds after the copy');
  check(out.gone === 0, 'a fresh receipt finds every student it copied');
  await b.close(); done();   // done() sets the exit code: 1 if any check failed
})().catch(e => { console.error(e); process.exit(2); });
