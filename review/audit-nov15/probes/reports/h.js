// Shared setup for RPT probes: loads the scrubbed fixture class exactly as probe_template.js does.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/reports/repo';
const L = require(path.join(REPO, 'tests/lib.js'));
const { chromium, fs, exe, pick, APP } = L;
const K = '1205050-7T1A';
async function open(opts = {}) {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true, timezoneId: opts.tz || 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); const asks = []; p.on('dialog', d => { asks.push(d.message()); d.accept(); });
  if (opts.now) await p.addInitScript(t => { const R = Date; let off = t - R.now(); window.__setNow = x => { off = x - R.now(); }; class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } } window.Date = D; }, opts.now);
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  if (opts.closeQ1) await p.evaluate(() => { window.__all.closeQuarter(1, { acc: [], on: [] }); window.__tally.save(); window.__tally.render(); });
  if (opts.q2) { await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600); }
  return { b, ctx, p, errs, asks, K };
}
module.exports = { ...L, open, K, REPO };
