// DAT-02: with a PIN set and the privacy screen up, printing (Ctrl+P, or the browser's menu) prints Tally unblurred:
// app.html's print rule hides #veil and sets filter:none on everything under it, and the veil's key handler does not
// stop Ctrl+P when a PIN is on. The PDF printed here carries the students' names.
const path = require('path'); const { execSync } = require('child_process');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/data/repo';
const { chromium, fs, exe, check, done, pick, APP, tmp } = require(path.join(REPO, 'tests/lib.js'));
const K = '1205050-7T1A';
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  // the Students page (every name), then a PIN, then the screen hides
  const last = await p.evaluate(K => { const T = window.__tally; T.state.settings.hideNames = false; T.state.active = K; T.save(); T.openProfile && 0; T.pinSet('4826'); T.veil('now'); return T.state.sections[K].grades.students[0].split(',')[0]; }, K);
  await p.waitForTimeout(300);
  const ctrlP = await p.evaluate(() => { const e = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, bubbles: true, cancelable: true }); document.body.dispatchEvent(e); return { prevented: e.defaultPrevented, stillVeiled: document.body.classList.contains('veiled') }; });
  await p.emulateMedia({ media: 'print' });
  const css = await p.evaluate(() => { const gw = document.querySelector('#gridwrap') || document.body.children[0]; const top = [...document.body.children].find(el => el.id !== 'veil' && el.tagName !== 'SCRIPT' && getComputedStyle(el).display !== 'none'); return { veil: getComputedStyle(document.querySelector('#veil')).display, filter: top ? getComputedStyle(top).filter : '?' }; });
  const pdf = path.join(tmp, 'veiled.pdf'); await p.pdf({ path: pdf, format: 'Letter' });
  const txt = execSync(`pdftotext ${pdf} -`).toString().toUpperCase();
  const leaked = txt.includes(last.toUpperCase());
  console.log('OBSERVED:', JSON.stringify({ ctrlPprevented: ctrlP.prevented, stillVeiled: ctrlP.stillVeiled, printVeilDisplay: css.veil, printFilter: css.filter, surnameInPrintedPdf: leaked }));
  console.log('EXPECTED:', 'while hidden behind a PIN, a print shows nothing of Tally (no names): the veil stays in print, or Ctrl+P is swallowed and the print rule keeps the blur');
  check(!leaked, 'the printed page carries no student name while the PIN screen is up');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
