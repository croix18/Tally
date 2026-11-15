// Shared setup for the SEA probes: loads the scrubbed fixture class (IXL grid, Focus roster, Q1 gradebook) into
// Tally.test.html and hands back the page. Synthetic data only beyond the repo's scrubbed fixtures.
const path = require('path');
const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const lib = require(path.join(REPO, 'tests/lib.js'));   // chdirs into REPO
const { chromium, fs, exe, pick, APP } = lib;
const K = '1205050-7T1A';
async function open(opts = {}) {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true, timezoneId: opts.tz || 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  if (opts.now) await p.addInitScript(t => { const D = Date, off = t - D.now(); class FD extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + off); } static now() { return D.now() + off; } } window.Date = FD; }, opts.now);
  await p.goto('file://' + path.resolve(APP));
  if (opts.bare) return { b, p, errs, K };
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  return { b, p, errs, K };
}
// a room of n desks in straight rows (cols per row), 94 apart across, 110 deep (the "Straight rows" template's spacing)
const roomJS = `(n, cols, gapX, gapY) => { const T = window.__tally; const desks = []; for (let i = 0; i < n; i++) desks.push({ id: 'd' + i, x: 40 + (i % cols) * (gapX || 94), y: 40 + Math.floor(i / cols) * (gapY || 110), r: 0 }); T.state.room = { w: 1200, h: 900, front: 'top', desks, teacher: { x: 1000, y: 780, w: 130, h: 64 }, door: null }; }`;
module.exports = { ...lib, REPO, K, open, roomJS };
