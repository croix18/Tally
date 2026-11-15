const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/health/repo';
const { chromium, fs, exe, check, done, pick, tmp, APP } = require(path.join(REPO, 'tests/lib.js'));
const K = '1205050-7T1A';
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const out = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const gb = s.grades; const a = gb.assignments[0];
    return { keys: Object.keys(s), gbKeys: Object.keys(gb), aKeys: Object.keys(a), a0: JSON.stringify(a).slice(0, 300), nS: s.students.length, nK: s.skills.length, sk0: s.skills[0], hist: (s.history||[]).length, h0: JSON.stringify(s.history[0]).slice(0,200), roster: JSON.stringify(s.roster).slice(0,200), tallyKeys: Object.keys(T).length, settings: Object.keys(T.state.settings) }; }, K);
  console.log(JSON.stringify(out, null, 1).slice(0, 3000));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
