// Shared setup for the CNF probes: the scrubbed real class (IXL grid, roster, Q1 gradebook; optionally the Q2 gradebook).
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/conference/repo';
const L = require(path.join(REPO, 'tests/lib.js'));
const K = '1205050-7T1A';
async function open(opts = {}) {
  const b = await L.chromium.launch({ executablePath: L.exe });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true, timezoneId: 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(L.APP));
  if (opts.blank) return { b, ctx, p, errs, L, K };
  const ixl = L.fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', L.fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await L.pick(p); await p.waitForTimeout(600);
  if (opts.q2) { await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await L.pick(p); await p.waitForTimeout(600); }
  return { b, ctx, p, errs, L, K };
}
module.exports = { open, REPO, K };
