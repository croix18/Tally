// Shared setup for the DAT probes: one page with the scrubbed class, its roster, Q1 gradebook, Q1 closed, Q2 gradebook,
// an IXL Quickview, and every student-linked record populated with synthetic text (each carrying a unique token).
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/data/repo';
const L = require(path.join(REPO, 'tests/lib.js'));   // chdirs into REPO
const { chromium, fs, exe, pick, APP } = L;
const K = '1205050-7T1A';
async function open(opts = {}) {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true, timezoneId: 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  return { b, ctx, p, errs };
}
async function loadClass(p) {
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
}
// everything else, filled in through the app's own writers where there is one
async function populate(p) {
  await p.evaluate(() => { const A = window.__all; A.closeQuarter(1, { acc: [], on: [] }); A.save(); });
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
  await p.setInputFiles('#file', [path.resolve('fixtures/ixl_quickview.pdf')]); await p.waitForTimeout(1500);
  return p.evaluate(K => { const T = window.__tally, A = window.__all, st = T.state, s = st.sections[K];
    const names = A.classStudents(s); const nm = names[0], nm2 = names[1];
    A.addNote(s, nm, 'TOKNOTE note text'); A.setFamily(s, nm, { contacts: [{ id: 'c1', name: 'TOKFAMNAME', rel: 'Mother', phone: '555-0100', email: 'tok@example.com', note: 'TOKFAMNOTE' }], log: [{ id: 'l1', at: '2026-11-10', how: 'Call', who: 'TOKWHO', text: 'TOKLOG' }] });
    const n0 = A.norm(nm);
    s.reportLog = { [n0]: [{ date: '2026-11-06', back: '2026-11-09', q: 2, gb: '2026-11-05', gbAt: '2026-11-05T13:00:00.000Z', ix: '2026-11-04', grade: 88, missing: 1, ixl: 3 }, { date: '2026-11-13', cleared: true, q: 2, gb: '2026-11-12', ix: '2026-11-12', grade: 90, missing: 0, ixl: null }] };
    s.confForms = { [n0]: { saved: '2026-11-12T15:00:00.000Z', strengths: 'TOKSTRENGTH', concerns: 'TOKCONCERN', base: { strengths: 'was', concerns: 'was2' } } };
    s.overrides = { 'Unit 1': { [nm]: { focus: 4, tally: 5, at: '2026-11-01T12:00:00.000Z', why: 'TOKWHY late' } } };
    s.seatInfo = { [nm]: A.cleanSeatInfo({ nick: 'TOKNICK', behavior: 'high', front: true, plan: '504', accom: 'TOKACCOM', apart: [nm2], together: [], notes: 'TOKSEATNOTE', level: 3, pct: 55, scale: 330 }) };
    s.studentSkips = s.studentSkips || {}; s.aliases = { ...(s.aliases || {}) }; s.gbUnitMap = { ...(s.gbUnitMap || {}) };
    st.tests = A.cleanTests({ ['n:' + n0]: [{ test: 'FAST', pm: 'PM1', year: '2026-27', level: 3, scale: 331, pct: 55, grade: 7, cats: { 'Number Sense': 'near' } }], 'id:TOKID123': [{ test: 'FAST', pm: 'PM3', year: '2025-26', level: 2, scale: 310, above: true }] });
    st.testInfo = A.cleanTestInfo({ ['n:' + n0]: { 'PM1 2026-27': { fields: { FLEID: 'FL000TOKFLEID', Name: 'TOKFASTNAME' }, at: '2026-10-01T00:00:00Z', file: 'TOKFASTFILE.pdf' } } });
    st.custom = [{ id: 'c1', label: 'Minutes to school', unit: 'min', prep: 'acc', values: { [K]: [5, 10, 15, 20, 25] } }];
    st.dismissed = { 'x:abc': '2026-11-10' };
    T.save(); return { names: names.length, nm, practice: Object.keys(s.practice || {}).length, qa: Object.keys(s.qArchive || {}), gh: (s.gradeHistory || []).length, hist: (s.history || []).length };
  }, K);
}
// a path-wise deep diff: where a and b differ (first `max`)
const DIFF = `(a, b, max = 40) => { const out = []; const walk = (x, y, p) => { if (out.length >= max) return; if (x === y) return; const tx = Array.isArray(x) ? 'array' : x === null ? 'null' : typeof x, ty = Array.isArray(y) ? 'array' : y === null ? 'null' : typeof y;
  if (tx !== ty) { out.push(p + ': ' + tx + ' ' + JSON.stringify(x === undefined ? 'undef' : x).slice(0, 80) + ' -> ' + ty + ' ' + JSON.stringify(y === undefined ? 'undef' : y).slice(0, 80)); return; }
  if (tx === 'object' || tx === 'array') { const ks = new Set([...Object.keys(x), ...Object.keys(y)]); for (const k of ks) walk(x[k], y[k], p + '.' + k); return; }
  if (Number.isNaN(x) && Number.isNaN(y)) return; out.push(p + ': ' + JSON.stringify(x).slice(0, 80) + ' -> ' + JSON.stringify(y).slice(0, 80)); }; walk(a, b, ''); return out; }`;
module.exports = { REPO, L, K, open, loadClass, populate, DIFF };
