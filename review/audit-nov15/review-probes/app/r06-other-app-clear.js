// DAT-09: the storage listener also reloads on e.key === null, which only localStorage.clear() raises; Tally never calls
// clear(). Another page of the same origin (every file:// page in Chrome) that clears storage now makes an open Tally tab
// reload empty, where before its next save wrote the classes back.
const path = require('path'); const REPO = process.env.TALLY_REPO;
const { chromium, fs, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext();
  const A = await ctx.newPage(); A.on('dialog', d => d.accept()); await A.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed')); await A.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await A.waitForTimeout(600);
  const other = await ctx.newPage(); await other.goto('file://' + path.resolve('fixtures/roster.txt')); await other.evaluate(() => localStorage.clear()); await A.waitForTimeout(1200);
  await A.evaluate(() => { try { const T = window.__tally; T.save(); } catch (e) {} }); await A.waitForTimeout(300);
  const o = await A.evaluate(() => ({ classes: window.__tally.state.order.length, stored: !!localStorage.getItem('tally.v1') && JSON.parse(localStorage.getItem('tally.v1')).order.length }));
  console.log('OBSERVED', JSON.stringify(o));
  check(o.classes === 1 && o.stored === 1, 'a clear() by another page of the same origin does not leave the open Tally tab empty');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
