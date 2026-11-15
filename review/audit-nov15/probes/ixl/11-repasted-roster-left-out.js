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

  // ---- IXL-11: a student who joined after the last gradebook export. The Not-on-roster dialog says re-paste the roster
  //      "so they get a row in Focus order"; done exactly that way, Copy still leaves them out, one row short of the Focus page ----
  await p.evaluate(() => document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); }));
  const nr = await p.evaluate(K => { const A = window.__all; const s = window.__tally.state.sections[K]; return A.buildRows(s).find(r => r.status === 'ixlOnly'); }, K);
  await p.click(`[data-ignore="${nr.key}"]`); await p.waitForTimeout(200);
  const dlg = await p.textContent('#modal');
  await p.click('#nrRoster'); await p.waitForTimeout(400);
  // the Focus roster now, with the new student in alphabetical place (synthetic: the IXL-only account's name)
  const roster = await p.evaluate(K => window.__tally.state.sections[K].roster, K);
  const lines = roster.split('\n').filter(Boolean); const at = lines.findIndex(l => l.replace(/^\d+\t/, '').localeCompare(nr.display) > 0); lines.splice(at, 0, '9999999\t' + nr.display);
  await global.seeTab(p, '#roster'); await p.fill('#roster', lines.join('\n')); await p.click('#mSave'); await p.waitForTimeout(400);
  const out = await p.evaluate(async ({ K, who }) => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); });
    const u = T.unitsOf(s).find(x => x.short === 'Unit 2'); const rows = A.copyRows(s); await A.copyUnit(s, u);
    return { inCopy: rows.some(r => r.display === who), n: rows.length, onRoster: A.buildRows(s).find(r => r.display === who).status, toast: document.querySelector('#toast').innerText }; }, { K, who: nr.display });
  console.log('OBSERVED:', `dialog: "${(dlg.match(/New student\?[^.]*\./) || [''])[0]}"; after re-pasting, the new student is "${out.onRoster}" on the grid, in the copy: ${out.inCopy}; copy has ${out.n} rows for a Focus roster of ${lines.length}; toast: "${out.toast.slice(0, 160)}"`);
  console.log('EXPECTED:', `the copy has a row for the new student in Focus order (${lines.length} rows), as the dialog promises; or, if Copy must follow the gradebook export, the dialog says to export a new gradebook and Copy says a roster student is missing from it`);
  check(out.inCopy || /export|gradebook/i.test(out.toast), 'the re-pasted student gets a copy row, or the copy says why not');
  await b.close(); done();   // done() sets the exit code: 1 if any check failed
})().catch(e => { console.error(e); process.exit(2); });
