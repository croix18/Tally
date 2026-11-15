// Shared setup for the WIF probes: the scrubbed real class (IXL, roster, Quarter 1 gradebook), from the probe template.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/whatif/repo';
const lib = require(path.join(REPO, 'tests/lib.js'));
const { chromium, fs, exe, pick, APP } = lib;
const K = '1205050-7T1A';
async function open(opts) {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1920, height: 1080 } }, opts || {}));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  return { b, p, errs };
}
module.exports = Object.assign({ open, K, REPO }, lib);
