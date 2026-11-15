// Shared setup for the CHT probes: the scrubbed fixture class (accelerated, 16 counted students) and, on request,
// synthetic copies of it as more classes. Only __tally / __all, the repo's fixtures and synthesized data.
const path = require('path');
const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const lib = require(path.join(REPO, 'tests/lib.js'));   // chdirs into REPO
const { chromium, fs, exe, pick, APP } = lib;
const K = '1205050-7T1A';
async function open(opts) {
  opts = opts || {};
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true, timezoneId: 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  if (opts.classes) await p.evaluate(n => { const T = window.__tally; const base = T.state.sections['1205050-7T1A']; base.period = 1; base.label = '1st Period · Accelerated'; base.team = '1st Period';
    for (let per = 2; per <= n; per++) { const s = JSON.parse(JSON.stringify(base)); s.key = 'p' + per + '-acc'; s.period = per; s.label = per + (per === 2 ? 'nd' : per === 3 ? 'rd' : 'th') + ' Period · Accelerated'; s.team = s.label.replace(/ · .*/, '');
      s.scores = s.scores.map(row => Array.isArray(row) ? row.map((v, i) => v == null ? null : Math.max(0, Math.min(100, v + 9 * (((i + per) % 3) - 1)))) : row);
      T.state.sections[s.key] = s; T.state.order.push(s.key); }
    T.save(); }, opts.classes);
  return { b, p, errs, K };
}
module.exports = { open, K, REPO, lib, path, fs };
