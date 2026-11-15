// DAT-04: while the PIN screen is up, a file dropped on it is still imported: the document-level 'drop' handler
// (app.js, wiring) checks only lbMode/showMode, and #veil (not inert) is the drop target. Here a second IXL export
// is dropped on the hidden screen and replaces the class's scores.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/data/repo';
const { chromium, fs, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(600);
  const before = await p.evaluate(() => { const T = window.__tally; T.pinSet('4826'); T.veil('now'); return JSON.stringify(T.state.order); });
  await p.waitForTimeout(200);
  // drop the on-level course export (a new class) onto the hidden screen
  const f = fs.readdirSync('fixtures').find(x => x.startsWith('csv_IXL-Score-Grid'));
  const data = fs.readFileSync(path.join('fixtures', f), 'utf8');
  await p.evaluate(([name, text]) => { const dt = new DataTransfer(); dt.items.add(new File([text], name, { type: 'text/csv' })); const v = document.querySelector('#veil');
    v.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true })); v.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, [f, data]);
  await p.waitForTimeout(1500);
  const after = await p.evaluate(() => ({ order: JSON.stringify(window.__tally.state.order), veiled: document.body.classList.contains('veiled') }));
  console.log('OBSERVED:', JSON.stringify({ classesBefore: before, classesAfter: after.order, stillVeiled: after.veiled }));
  console.log('EXPECTED:', 'nothing changes while the PIN screen is up (NOTES: hidden means "can\'t be used"; the PIN keeps "hands off an unattended screen")');
  check(after.order === before, 'a file dropped on the PIN screen changes nothing');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
