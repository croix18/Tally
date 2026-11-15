// Counter for SEA-05: same-name pair arriving through the real paths (roster paste + gradebook import), not by
// editing gb.students. Builds twins in temp copies of the scrubbed fixtures (row 3 renamed to row 1's name).
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/counter-seating/repo';
const lib = require(path.join(REPO, 'tests/lib.js')); const { chromium, fs, exe, pick, APP } = lib; const K = '1205050-7T1A';
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext({ timezoneId: 'America/New_York' })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('/tmp/cs-fx/roster_twins.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', ['/tmp/cs-fx/gb_twins.csv']); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    const gbNames = s.grades.students.filter(n => /SUTTER/.test(n)); const roster = JSON.stringify(s.roster).match(/[^"]*SUTTER[^"]*/g);
    const stu = A.seatStudents(s).filter(x => /SUTTER/.test(x.display));
    return { gbNames, roster, seat: stu.map(x => ({ id: x.id, grade: x.grade == null ? null : Math.round(x.grade) })) }; }, K);
  console.log('OBSERVED:', JSON.stringify(o), errs.join('|'));
  const ids = o.seat.map(x => x.id); const ok = o.seat.length === 2 && new Set(ids).size === 2 && o.seat.every(x => x.grade != null);
  console.log('EXPECTED: two seating students, distinct ids, each with their own grade'); await b.close(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
