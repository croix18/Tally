// shared: load the fixture class, then build a synthetic full load (6 classes x 30 students x 300 skills, 12 history days, 60 assignments)
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/health/repo';
const lib = require(path.join(REPO, 'tests/lib.js')); const { chromium, fs, exe, pick, APP } = lib;
const K = '1205050-7T1A';
async function open(opts = {}) {
  const b = await chromium.launch({ executablePath: exe, env: { ...process.env, ...(opts.env || {}) } });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true, ...(opts.ctx || {}) });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  if (opts.init) await p.addInitScript(opts.init);
  await p.goto('file://' + path.resolve(APP));
  if (opts.fixture !== false) {
    const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
    await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
    await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
    await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  }
  return { b, ctx, p, errs };
}
// in-page: synthesize the full load from the fixture class
const synth = (K) => { const T = window.__tally; const S = T.state; const src = S.sections[K];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const keys = [];
  for (let c = 0; c < 6; c++) { const s = JSON.parse(JSON.stringify(src)); const key = 'SYN' + c + '-7T' + (c + 1) + 'A'; s.key = key; s.label = 'Period ' + (c + 1); s.period = c + 1; s.team = 'P' + (c + 1);
    const nS = 30; const names = [], ros = [], gbn = [];
    for (let i = 0; i < nS; i++) { const f = 'SYNF' + String.fromCharCode(65 + c) + i, l = 'SYNL' + String.fromCharCode(65 + (i % 26)) + i; names.push(f + ' ' + l); ros.push(l + ', ' + f); gbn.push(l + ', ' + f); }
    s.students = names; s.roster = ros.join('\n'); s.ignored = {}; s.aliases = {}; s.studentSkips = {}; s.overrides = {}; delete s._keys; s.seating = null; s.seatInfo = null;
    const skills = []; for (let u = 1; u <= 6; u++) for (let j = 0; j < 50; j++) skills.push({ unit: 'Unit ' + u + ' Synthetic ' + u, lesson: 'Lesson ' + u + '.' + (j % 5 + 1) + ' L', name: 'Skill ' + u + '-' + j, id: 'S' + c + 'U' + u + 'K' + j });
    s.skills = skills; s.excluded = {}; s.best = {}; s.receipts = {};
    s.scores = skills.map((sk, k) => names.map(() => { const u = +sk.unit.split(' ')[1]; return u > 4 ? null : rnd() < 0.2 ? null : Math.floor(rnd() * 101); }));
    const nA = 60; const asg = []; for (let a = 0; a < nA; a++) { const max = [5, 10, 20, 50, 100][a % 5]; const st = [], v = [];
      for (let i = 0; i < nS; i++) { const r = rnd(); if (r < 0.05) { st.push('missing'); v.push(null); } else if (r < 0.08) { st.push('excused'); v.push(null); } else { st.push('score'); v.push(Math.round(rnd() * max * 2) / 2); } }
      const m = 9 + Math.floor(a / 6), d = 1 + (a % 6) * 4; const date = '2026-' + String(m > 12 ? 12 : m < 10 ? 10 : m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      asg.push({ name: (a % 10 === 0 ? 'Unit ' + (a / 10 + 1) + ' Assessment' : a % 3 === 0 ? 'IXL Unit ' + (a % 4 + 1) : 'Classwork ' + a), category: a % 10 === 0 ? 'Assessments' : a % 7 === 0 ? 'Participation' : 'Classwork', categoryFromFile: false, max, values: v, status: st, missing: st.filter(x => x === 'missing').length, excused: st.filter(x => x === 'excused').length, unread: 0, percent: false, assignedOn: date, due: date }); }
    s.grades = { ...s.grades, assignments: asg, students: gbn, ids: gbn.map((_, i) => String(100000 + c * 100 + i)), overall: null, raw: undefined };
    s.history = []; for (let h = 0; h < 12; h++) { const d = new Date(2026, 9, 12 + h * 3); const per = {}; names.forEach((n, i) => per[n + '#0'] = Math.floor(rnd() * 150)); s.history.push({ date: d.toISOString().slice(0, 10), at: d.toISOString(), thr: s.threshold, students: nS, per }); }
    s.gradeHistory = [];
    S.sections[key] = s; S.order.push(key); keys.push(key); }
  T.save(); T.render(); return keys; };
module.exports = { open, synth, K, lib };
