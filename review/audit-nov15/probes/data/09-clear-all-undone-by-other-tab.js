// DAT-09: Settings > Files > "Clear all Tally data" removes tally.v1, but a second Tally tab still holds everything in
// memory and ignores the removal (the storage listener returns on newValue == null). Its next save, from any click,
// writes every class, name and grade back into this browser.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/data/repo';
const { chromium, fs, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const A = await ctx.newPage(); const errs = []; A.on('pageerror', e => errs.push(e.message)); A.on('dialog', d => d.accept());
  await A.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await A.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await A.waitForTimeout(600);
  const B = await ctx.newPage(); B.on('pageerror', e => errs.push('B ' + e.message)); B.on('dialog', d => d.accept()); await B.goto('file://' + path.resolve(APP)); await B.waitForTimeout(500);
  // tab A: Clear all Tally data (the real button), as on a shared computer at the end of the day
  await A.evaluate(() => window.__tally.openSettings(undefined, 'files')); await A.waitForTimeout(300); await A.click('#wipe'); await A.waitForTimeout(1500);
  const cleared = await A.evaluate(() => localStorage.getItem('tally.v1'));
  // tab B, left open: any action that saves (here, the eye button)
  await B.evaluate(() => document.querySelector('#btnHide').click()); await B.waitForTimeout(300);
  const back = await B.evaluate(() => { const v = localStorage.getItem('tally.v1'); return v ? Object.keys(JSON.parse(v).sections).length : 0; });
  console.log('OBSERVED:', JSON.stringify({ storedAfterClear: cleared ? 'data' : 'empty', classesStoredAfterOneClickInTheOtherTab: back }));
  console.log('EXPECTED:', 'after "Clear all Tally data" this browser keeps no class: the other tab is told (it goes empty, or at least never writes the old state back)');
  check(cleared == null, 'Clear all empties this browser (as designed)'); check(back === 0, 'the other open tab does not write the cleared data back');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
