// DAT-03: "five wrong tries wait 30 seconds" (NOTES, the privacy screen) is held in memory only (veilTries,
// veilLockUntil): a reload comes back hidden (tally.veil) but with the lockout gone and five fresh tries.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/data/repo';
const { chromium, fs, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(600);
  await p.evaluate(() => { window.__tally.pinSet('4826'); window.__tally.veil('now'); }); await p.waitForTimeout(200);
  for (let i = 0; i < 5; i++) { await p.fill('#veilPin', String(1000 + i)); await p.click('#veilShow'); await p.waitForTimeout(80); }
  const locked = await p.evaluate(() => ({ disabled: document.querySelector('#veilPin').disabled, msg: document.querySelector('#veilMsg').textContent }));
  await p.reload(); await p.waitForTimeout(900);
  const after = await p.evaluate(() => ({ veiled: document.body.classList.contains('veiled'), disabled: !!(document.querySelector('#veilPin') || {}).disabled, msg: (document.querySelector('#veilMsg') || {}).textContent }));
  // and a right guess goes straight through after the reload
  await p.fill('#veilPin', '4826'); await p.click('#veilShow'); await p.waitForTimeout(150);
  const open = await p.evaluate(() => !document.body.classList.contains('veiled'));
  console.log('OBSERVED:', JSON.stringify({ beforeReload: locked, afterReload: after, rightPinAcceptedInsideTheWait: open }));
  console.log('EXPECTED:', 'after a reload inside the 30-second wait the PIN box is still disabled ("Too many tries"), so a reload does not buy five more tries');
  check(locked.disabled, 'five wrong tries lock the box (as designed)');
  check(after.veiled && after.disabled, 'the lockout survives a reload');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
