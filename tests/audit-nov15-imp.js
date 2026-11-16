// 15 Nov 2026 audit, fixer IMP: reading files, course exports and placing students. Synthetic data only.
const { chromium, fs, path, exe, check, done, pick, tmp, APP } = require('./lib');
const DAY = Date.parse('2026-11-13T15:00:00Z');
const enc = t => Buffer.from(t, 'utf8').toString('base64');
async function open() {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, timezoneId: 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(300);
  return { b, p, errs };
}
// Drives importFiles() with in-page files and answers Tally's dialogs: ans.ask 'yes'/'no', ans.nc {period, prep} for "New class".
async function imp(p, files, ans = {}) {
  return p.evaluate(async ({ files, ans }) => {
    const A = window.__all; const answers = [];
    const tick = setInterval(() => {
      const y = document.querySelector('#askYes'), n = document.querySelector('#askNo');
      if (y) { answers.push('ask:' + ((document.querySelector('#askMsg') || {}).textContent || '')); (ans.ask === 'no' ? n : y).click(); }
      const m = document.querySelector('#modal:not(.hidden)'); if (!m) return;
      if (m.querySelector('#ncMake')) { answers.push('newClass'); if (!ans.nc) { m.querySelector('#mCancel').click(); return; }
        m.querySelector(`#ncPeriod [data-p="${ans.nc.period}"]`).click(); m.querySelector(`#ncPrep [data-prep="${ans.nc.prep}"]`).click(); m.querySelector('#ncMake').click(); return; }
      if (m.querySelector('.picks')) { answers.push('pick'); m.querySelector('#mCancel').click(); return; }
      if (m.querySelector('#askApply')) { answers.push('categories'); m.querySelector('#askApply').click(); }
    }, 30);
    const fl = files.map(f => { const bin = atob(f.b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new File([u8], f.name, { lastModified: f.lastModified }); });
    try { await A.importFiles(fl); } finally { clearInterval(tick); }
    return { answers, last: window.__tally.state.lastImport };
  }, { files: files.map(f => ({ name: f.name, lastModified: f.lastModified || DAY, b64: enc(f.text) })), ans });
}
const skillRows = (n, unit = 'Unit 1 Ratios') => Array.from({ length: n }, (_, k) => `"${unit}","Lesson 1.${k + 1}","Skill ${k + 1}",S${k + 1}X`);
const grid = (names, skills, score) => 'Unit,,Skill name,Permanent Skill ID,' + names.map(n => `"${n}"`).join(',') + '\n' + skills.map((s, k) => s + ',' + names.map((n, i) => score(n, i, k)).join(',')).join('\n') + '\n';
const POOL = d => `IXL-Score-Grid_${d}_This-School-Year_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv`;
const flip = n => { const t = n.split(' '); return t.slice(1).join(' ') + ', ' + t[0]; };
const gbFile = (rows, id0) => '"Student","Student ID","Unit 1 Quiz (10 pts)"\n' + rows.map((n, i) => `"${n}","${id0 + i}","8"`).join('\n') + '\n';
// Pick a pool student for a roster line with the roster fixer, as the teacher does.
const fix = (p, key, disp, want) => p.evaluate(async ({ key, disp, want }) => { const A = window.__all, s = window.__tally.state.sections[key];
  A.openFixer(s, disp); await new Promise(r => setTimeout(r, 100)); const btn = document.querySelector(`#modal [data-pick="@pool:${want}"]`);
  if (btn) btn.click(); else { const c = document.querySelector('#mCancel'); if (c) c.click(); } await new Promise(r => setTimeout(r, 100)); return !!btn; }, { key, disp, want });
const scoreOf = (p, key, disp) => p.evaluate(({ key, disp }) => { const A = window.__all, s = window.__tally.state.sections[key]; const r = A.buildRows(s).find(x => x.display === disp);
  return !r ? 'none' : r.ixl == null || r.status !== 'ok' ? r.status : s.scores[0][r.ixl]; }, { key, disp });

(async () => {
  // IMP-01 (a): two JORDAN LEEs in one course export, one in each class: each class counts its own after the fixer pick, also after a reload
  { const { b, p, errs } = await open();
    const A = ['AVA STONE', 'JORDAN LEE', 'MILO REED', 'NIA PAGE', 'OWEN TATE'], B = ['PIA ROSS', 'QUINN HALE', 'JORDAN LEE', 'RUBY CHAN', 'SAM VOSS'];
    await imp(p, [{ name: POOL('2026-11-13'), text: grid([...A, ...B], skillRows(4), (n, i, k) => n === 'JORDAN LEE' ? (i < 5 ? 60 : 95) : 70 + k) }]);
    await imp(p, [{ name: 'gradebook_p1.csv', text: gbFile(A.map(n => flip(n) + (n === 'JORDAN LEE' ? ' ALEX' : '')), 2000100) }], { nc: { period: 1, prep: 'on' } });
    await imp(p, [{ name: 'gradebook_p2.csv', text: gbFile(B.map(n => flip(n) + (n === 'JORDAN LEE' ? ' MICHAEL' : '')), 2000200) }], { nc: { period: 2, prep: 'on' } });
    await fix(p, 'period-1', 'LEE, JORDAN ALEX', 'JORDAN LEE#0'); await fix(p, 'period-2', 'LEE, JORDAN MICHAEL', 'JORDAN LEE#1');
    const a1 = await scoreOf(p, 'period-1', 'LEE, JORDAN ALEX'), a2 = await scoreOf(p, 'period-2', 'LEE, JORDAN MICHAEL');
    await p.reload(); await p.waitForTimeout(400); const a3 = await scoreOf(p, 'period-2', 'LEE, JORDAN MICHAEL');
    check(a1 === 60 && a2 === 95 && a3 === 95, `IMP-01: a student who shares his IXL name with one in another class is counted with his own scores after the fixer pick, and after a reload (${a1}, ${a2}, ${a3})`);
    check(!errs.length, 'IMP-01 (a): no page errors ' + errs.join('|')); await b.close(); }
  // IMP-01 (b): both in ONE class, picked in the opposite order to the course export: no swap
  { const { b, p, errs } = await open();
    const pool = ['AVA STONE', 'JORDAN LEE', 'MILO REED', 'JORDAN LEE', 'NIA PAGE', 'OWEN TATE'];
    await imp(p, [{ name: POOL('2026-11-13'), text: grid(pool, skillRows(4), (n, i) => n === 'JORDAN LEE' ? (i === 1 ? 60 : 95) : 72) }]);
    await imp(p, [{ name: 'gb.csv', text: gbFile(['STONE, AVA', 'LEE, JORDAN ALEX', 'LEE, JORDAN MICHAEL', 'REED, MILO', 'PAGE, NIA', 'TATE, OWEN'], 5001) }], { nc: { period: 1, prep: 'on' } });
    await fix(p, 'period-1', 'LEE, JORDAN ALEX', 'JORDAN LEE#1'); await fix(p, 'period-1', 'LEE, JORDAN MICHAEL', 'JORDAN LEE#0');
    const x = await scoreOf(p, 'period-1', 'LEE, JORDAN ALEX'), y = await scoreOf(p, 'period-1', 'LEE, JORDAN MICHAEL');
    check(x === 95 && y === 60, `IMP-01: two students of one IXL name in one class keep the rows the fixer picked for them, never each other's (${x}, ${y})`);
    // A class saved by an earlier Tally kept them under its own "#n" keys (the 95s under #0): the next carve moves each kept best to its student
    const kept = await p.evaluate(() => { const A = window.__all, T = window.__tally, s = T.state.sections['period-1']; delete s.poolKeys; s._keys = null; s.best = {}; A.mergeBest(s);
      s.history.unshift({ date: '2026-11-01', at: '2026-11-01T12:00:00Z', thr: 60, students: 6, per: { 'JORDAN LEE#0': 4, 'JORDAN LEE#1': 1 }, pu: {}, ua: {}, own: { U1: { 'JORDAN LEE#0': 'alex', 'JORDAN LEE#1': 'michael' } } });
      A.materialize(s); const old = s.history.find(h => h.date === '2026-11-01'); window.__own = old && old.own && old.own.U1; const r = A.buildRows(s), e = d => { const x = r.find(y => y.display === d); return x && x.ixl != null ? A.eff(s, 0, x.ixl) : null; };
      return [e('LEE, JORDAN ALEX'), e('LEE, JORDAN MICHAEL')]; });
    const own = await p.evaluate(() => window.__own);
    check(own && own['JORDAN LEE#1'] === 'alex' && own['JORDAN LEE#0'] === 'michael', `IMP-01: a history entry's own-unit counts (h.own) move to each student's new key too (${JSON.stringify(own)})`);
    check(kept[0] === 95 && kept[1] === 60, `IMP-01: best scores a class kept under its old keys follow each student when the class is next carved, never the other one of that name (${kept})`);
    check(!errs.length, 'IMP-01 (b): no page errors ' + errs.join('|')); await b.close(); }
  // CTR-01: a student moves from 2nd to 1st period in the weekly drop and his SmartScores fell from 80 to 50: his kept best comes with him
  { const { b, p, errs } = await open();
    const A = ['AVA STONE', 'MILO REED', 'NIA PAGE', 'OWEN TATE'], B = ['PIA ROSS', 'QUINN HALE', 'RUBY CHAN', 'SAM VOSS', 'ALEX MOORE'], pool = [...A, ...B];
    const ids = Object.fromEntries(pool.map((n, i) => [n, 4000100 + i]));
    const g = alex => grid(pool, skillRows(4, 'Unit 2 Ratios'), n => n === 'ALEX MOORE' ? alex : 70), gb = list => '"Student","Student ID","Unit 2 Quiz (10 pts)"\n' + list.map(n => `"${flip(n)}","${ids[n]}","8"`).join('\n') + '\n';
    await imp(p, [{ name: POOL('2026-11-06'), text: g(80) }]);
    await imp(p, [{ name: 'p1.csv', text: gb(A), lastModified: DAY - 7 * 864e5 }], { nc: { period: 1, prep: 'on' } });
    await imp(p, [{ name: 'p2.csv', text: gb(B), lastModified: DAY - 7 * 864e5 }], { nc: { period: 2, prep: 'on' } });
    await imp(p, [{ name: POOL('2026-11-13'), text: g(50) }, { name: 'p2.csv', text: gb(B.slice(0, 4)) }, { name: 'p1.csv', text: gb([...A, 'ALEX MOORE']) }]);
    const o = await p.evaluate(() => { const T = window.__tally, Al = window.__all, s = T.state.sections['period-1']; const si = s.students.indexOf('ALEX MOORE'); const u = T.unitsOf(s).find(x => /Unit 2/.test(x.name)) || T.unitsOf(s)[0];
      return { si, raw: si >= 0 ? s.scores[0][si] : null, eff: si >= 0 ? Al.eff(s, 0, si) : null, pts: si >= 0 ? Al.points(s, u, si) : null }; });
    check(o.si >= 0 && o.raw === 50 && o.eff === 80 && o.pts === 4, `CTR-01: a student who moves to another class of the course keeps his best scores (raw 50, best 80, 4 points): ${JSON.stringify(o)}`);
    check(!errs.length, 'CTR-01: no page errors ' + errs.join('|')); await b.close(); }
  // CTR-01 round 2: a student withdraws; later a different student of his name joins another class: no carry without the same Student ID,
  // and none at all from a pasted roster without IDs
  for (const withIds of [true, false]) { const { b, p, errs } = await open();
    const A = ['AVA STONE', 'JORDAN LEE', 'MILO REED', 'NIA PAGE', 'OWEN TATE'], B = ['PIA ROSS', 'RUBY CHAN', 'SAM VOSS', 'TOM WELD', 'UMA YATES'];
    let id = 7000; const ids = {}; const gb = (list, tag) => '"Student","Student ID","Unit 1 Quiz (10 pts)"\n' + list.map(n => `"${flip(n)}","${ids[n + tag] = ids[n + tag] || id++}","8"`).join('\n') + '\n';
    await imp(p, [{ name: POOL('2026-10-30'), text: grid([...A, ...B], skillRows(4), n => n === 'JORDAN LEE' ? 95 : 70) }]);
    await imp(p, [{ name: 'p1.csv', text: gb(A, 'a'), lastModified: DAY - 14 * 864e5 }], { nc: { period: 1, prep: 'on' } });
    await imp(p, [{ name: 'p2.csv', text: gb(B, 'a'), lastModified: DAY - 14 * 864e5 }], { nc: { period: 2, prep: 'on' } });
    const A2 = A.filter(n => n !== 'JORDAN LEE');
    await imp(p, [{ name: POOL('2026-11-06'), text: grid([...A2, ...B], skillRows(4), () => 70) }, { name: 'p1.csv', text: gb(A2, 'a'), lastModified: DAY - 7 * 864e5 }], { ask: 'yes' });
    if (withIds) await imp(p, [{ name: POOL('2026-11-13'), text: grid([...A2, ...B, 'JORDAN LEE'], skillRows(4), n => n === 'JORDAN LEE' ? 30 : 70) }, { name: 'p2.csv', text: gb([...B, 'JORDAN LEE'], 'b') }], { ask: 'yes' });
    else { await p.evaluate(() => { const s = window.__tally.state.sections['period-2']; s.roster = 'ROSS, PIA\nCHAN, RUBY\nVOSS, SAM\nWELD, TOM\nYATES, UMA\nLEE, JORDAN'; });
      await imp(p, [{ name: POOL('2026-11-13'), text: grid([...A2, ...B, 'JORDAN LEE'], skillRows(4), n => n === 'JORDAN LEE' ? 30 : 70) }], { ask: 'yes' }); }
    const o = await p.evaluate(() => { const T = window.__tally, Al = window.__all, s = T.state.sections['period-2']; const si = s.students.indexOf('JORDAN LEE'); return { si, eff: si >= 0 ? Al.eff(s, 0, si) : null, pts: si >= 0 ? Al.points(s, T.unitsOf(s)[0], si) : null }; });
    check(o.si >= 0 && o.eff === 30 && o.pts === 0, `CTR-01: a new student never takes the kept best of a withdrawn student of the same name (${withIds ? 'different Student IDs' : 'roster without IDs'}): ${JSON.stringify(o)}`);
    check(!errs.length, 'CTR-01 namesake: no page errors ' + errs.join('|')); await b.close(); }
  // CTR-01: two students of one name in the course never share kept best scores across classes
  { const { b, p, errs } = await open();
    const A = ['AVA STONE', 'JORDAN LEE', 'MILO REED'], B = ['PIA ROSS', 'JORDAN LEE', 'RUBY CHAN'];
    await imp(p, [{ name: POOL('2026-11-13'), text: grid([...A, ...B], skillRows(2), (n, i) => n === 'JORDAN LEE' ? (i < 3 ? 90 : 40) : 70) }]);
    await imp(p, [{ name: 'p1.csv', text: gbFile(A.map(n => flip(n) + (n === 'JORDAN LEE' ? ' ALEX' : '')), 2000100) }], { nc: { period: 1, prep: 'on' } });
    await imp(p, [{ name: 'p2.csv', text: gbFile(B.map(n => flip(n) + (n === 'JORDAN LEE' ? ' MICHAEL' : '')), 2000200) }], { nc: { period: 2, prep: 'on' } });
    await fix(p, 'period-1', 'LEE, JORDAN ALEX', 'JORDAN LEE#0'); await fix(p, 'period-2', 'LEE, JORDAN MICHAEL', 'JORDAN LEE#1');
    // the next week ALEX has left the course: MICHAEL is now the course's only JORDAN LEE (key #0, the key ALEX's 90s are kept under in 1st period)
    await p.evaluate(() => { const s = window.__tally.state.sections['period-1']; s.roster = 'STONE, AVA\nREED, MILO'; delete s.aliases['LEE, JORDAN ALEX']; });
    await imp(p, [{ name: POOL('2026-11-20'), text: grid([...A.filter(n => n !== 'JORDAN LEE'), ...B], skillRows(2), n => n === 'JORDAN LEE' ? 40 : 70) }], { ask: 'yes' });
    await fix(p, 'period-2', 'LEE, JORDAN MICHAEL', 'JORDAN LEE#0');
    const e2 = await p.evaluate(() => { const A = window.__all, s = window.__tally.state.sections['period-2']; const r = A.buildRows(s).find(x => x.display === 'LEE, JORDAN MICHAEL'); return r && r.ixl != null ? A.eff(s, 0, r.ixl) : r && r.status; });
    check(e2 === 40, `CTR-01: a student never takes the kept best of another student of the same name from another class (${e2})`);
    check(!errs.length, 'CTR-01 (b): no page errors ' + errs.join('|')); await b.close(); }
  // IMP-06: the weekly drop in either order: ALEX MOORE moved to 1st period, where Focus calls him "MOORE, ALEXANDER"
  { const { b, p, errs } = await open();
    const A = ['AVA STONE', 'MILO REED', 'NIA PAGE', 'OWEN TATE'], B = ['PIA ROSS', 'QUINN HALE', 'RUBY CHAN', 'SAM VOSS', 'ALEX MOORE'], pool = [...A, ...B];
    const ids = Object.fromEntries(pool.map((n, i) => [n, 4000100 + i])), gb = list => '"Student","Student ID","Unit 1 Quiz (10 pts)"\n' + list.map(([n, d]) => `"${d || flip(n)}","${ids[n]}","8"`).join('\n') + '\n';
    await imp(p, [{ name: POOL('2026-11-06'), text: grid(pool, skillRows(4), () => 70) }]);
    await imp(p, [{ name: 'p1.csv', text: gb(A.map(n => [n])), lastModified: DAY - 7 * 864e5 }], { nc: { period: 1, prep: 'on' } });
    await imp(p, [{ name: 'p2.csv', text: gb(B.map(n => [n])), lastModified: DAY - 7 * 864e5 }], { nc: { period: 2, prep: 'on' } });
    const start = await p.evaluate(() => localStorage.getItem('tally.v1'));
    const files = [{ name: POOL('2026-11-13'), text: grid(pool, skillRows(4), () => 80) }, { name: 'p1.csv', text: gb([...A.map(n => [n]), ['ALEX MOORE', 'MOORE, ALEXANDER']]) }, { name: 'p2.csv', text: gb(B.slice(0, 4).map(n => [n])) }];
    const res = [];
    for (const order of [[0, 1, 2], [0, 2, 1]]) {
      await p.evaluate(s => { localStorage.clear(); localStorage.setItem('tally.v1', s); }, start); await p.reload(); await p.waitForTimeout(300);
      await imp(p, order.map(i => files[i]));
      res.push(await p.evaluate(() => { const T = window.__tally, A = window.__all, s1 = T.state.sections['period-1'], s2 = T.state.sections['period-2']; const r = A.buildRows(s1).find(x => /MOORE/.test(x.display)) || {};
        return s1.students.includes('ALEX MOORE') && r.status === 'ok' && !s2.students.includes('ALEX MOORE') ? 'ok' : r.status; }));
    }
    check(res.every(x => x === 'ok'), `IMP-06: the weekly drop gives the same classes in any order: a student who changed classes is in his new class either way (${res})`);
    check(!errs.length, 'IMP-06: no page errors ' + errs.join('|')); await b.close(); }
  // IXL-02: a class's own export swaps one student for another, same class size: the history snapshot reads the new students' keys
  { const { b, p, errs } = await open();
    const sec = (date, names, rows) => ({ name: `IXL-Score-Grid_${date}_This-School-Year_1205050-7T5A-M_J-ACC_Math-Nation-FL-B.E.S.T.-Accelerated-7th-Grade_Math.csv`,
      text: 'Unit,,Skill name,Permanent Skill ID,' + names.map(n => `"${n}"`).join(',') + '\n' + rows.map(([id, sc]) => `"Unit 1 Synthetic Unit","Lesson 1.1 L","Synthetic skill ${id}",${id},` + sc.map(v => v == null ? '' : v).join(',')).join('\n') + '\n' });
    await imp(p, [sec('2026-11-02', ['ALEX ABBOTT', 'BLAKE BRISCOE', 'CASEY CARVER'], [['AA1', [90, 50, null]], ['AA2', [80, null, null]]])]);
    await p.evaluate(() => { const T = window.__tally; const s = T.state.sections[T.state.order[0]]; s.skipRoster = true; T.state.settings.currentUnit = { acc: 1, on: null }; T.save(); });
    await imp(p, [sec('2026-11-09', ['ANDY ADAMS', 'BLAKE BRISCOE', 'CASEY CARVER'], [['AA1', [null, 50, null]], ['AA2', [null, null, null]]])]);
    const o = await p.evaluate(() => { const T = window.__tally, A = window.__all; const s = T.state.sections[T.state.order[0]]; const h = s.history[s.history.length - 1]; return { andy: h.per['ANDY ADAMS#0'], date: h.date, key0: A.ixlKeyAt(s, 0) }; });
    check(o.andy === 0 && o.date === '2026-11-09' && o.key0 === 'ANDY ADAMS#0', `IXL-02: after a same-size export swaps a student, the history snapshot gives the new student his own points, not the withdrawn student's kept best (${JSON.stringify(o)})`);
    check(!errs.length, 'IXL-02: no page errors ' + errs.join('|')); await b.close(); }
  // IMP-03: last school year's grid asks first; Cancel keeps this year's course data, OK takes it
  { const { b, p, errs } = await open();
    const names = ['AVA STONE', 'MILO REED', 'NIA PAGE', 'OWEN TATE', 'PIA ROSS'];
    const THIS = POOL('2026-11-06'), LAST = 'IXL-Score-Grid_2026-11-13_Last-School-Year_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv';
    await imp(p, [{ name: THIS, text: grid(names, skillRows(4), () => 85) }]);
    const state = () => p.evaluate(() => { const P = window.__tally.state.pools.on; return { q: window.__q || '', file: P.file, s: P.scores[0][0] }; });
    await p.evaluate(() => { window.__q = ''; window.confirm = m => { window.__q = m; return false; }; });
    await imp(p, [{ name: LAST, text: grid(names, skillRows(4), () => '') }]); const no = await state();
    await p.evaluate(() => { window.__q = ''; window.confirm = m => { window.__q = m; return true; }; });
    await imp(p, [{ name: LAST, text: grid(names, skillRows(4), () => '') }]); const yes = await state();
    check(/last school year/i.test(no.q) && /on-level course/.test(no.q) && no.file === THIS && no.s === 85, `IMP-03: a "Last-School-Year" Score Grid asks first, and Cancel keeps this year's course data (${no.file}, ${no.s}; "${no.q.slice(-120)}")`);
    check(/last school year/i.test(yes.q) && yes.file === LAST, 'IMP-03: …and OK imports it, as asked');
    await p.evaluate(() => { window.__q = ''; window.confirm = m => { window.__q = m; return true; }; });
    await imp(p, [{ name: THIS.replace('2026-11-06', '2026-11-14'), text: grid(names, skillRows(4), () => 85) }]); const plain = await state();
    check(plain.q === '' && plain.s === 85, "IMP-03: this school year's grid imports without the question");
    check(!errs.length, 'IMP-03: no page errors ' + errs.join('|')); await b.close(); }
  // IMP-02: an export with blank name headers and one skill listed twice: every skill keeps its own scores
  { const { b, p, errs } = await open();
    const rows = [['Unit 1 Ratios', 'Lesson 1.1', 'Skill one', 'S1'], ['Unit 1 Ratios', 'Lesson 1.1', 'Skill two', 'S2'], ['Unit 1 Ratios', 'Lesson 1.2', 'Skill two', 'S2'], ['Unit 1 Ratios', 'Lesson 1.2', 'Skill three', 'S3'], ['Unit 2 Rates', 'Lesson 2.1', 'Skill five', 'S5']];
    const val = { S1: 10, S2: 20, S3: 30, S5: 90 };
    await imp(p, [{ name: 'IXL-Score-Grid_2026-11-13_This-School-Year_1205050-7T4A-M_J-GR7_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv', text: 'Unit,,Skill name,Permanent Skill ID,,,\n' + rows.map(r => r.join(',') + ',' + [0, 1, 2].map(() => val[r[3]]).join(',')).join('\n') + '\n' }]);
    const o = await p.evaluate(() => { const s = window.__tally.state.sections['1205050-7T4A']; return s ? { ph: s.placeholder, n: s.students.length, got: s.skills.map((k, i) => k.id + '=' + (s.scores[i] || [])[0]).join(','), rows: s.scores.length } : null; });
    check(o && o.ph && o.n === 3 && o.rows === 4 && o.got === 'S1=10,S2=20,S3=30,S5=90', `IMP-02: an export with no student names reads a skill listed twice as one skill, and every later skill keeps its own scores (${JSON.stringify(o)})`);
    check(!errs.length, 'IMP-02: no page errors ' + errs.join('|')); await b.close(); }
  // Small ones: bare CR line breaks in a pasted roster; a semicolon-separated file; SmartScores outside 0 to 100
  { const { b, p, errs } = await open();
    const n = await p.evaluate(() => window.__all.parseRosterText('STONE, AVA\rREED, MILO\rPAGE, NIA').map(x => x.display).join('|'));
    check(n === 'STONE, AVA|REED, MILO|PAGE, NIA', `a roster pasted with bare CR line breaks reads one student a line (${n})`);
    const sc = await p.evaluate(() => [101, 999, -5, '150', '100%', 100, 0, '87.5'].map(v => (window.__all.asScore || window.asScore)(v)));
    check(JSON.stringify(sc) === JSON.stringify([null, null, null, null, 100, 100, 0, 87.5]), `a score outside 0 to 100 is not a SmartScore (${JSON.stringify(sc)})`);
    const r = await imp(p, [{ name: 'IXL-Score-Grid_2026-11-13_This-School-Year_1205050-7T4A-M_J-GR7_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv', text: 'Unit;;Skill name;Permanent Skill ID;"AVA STONE";"MILO REED"\n"Unit 1";"Lesson 1.1";"Skill 1";S1X;80;70\n' }]);
    const o = await p.evaluate(() => ({ order: window.__tally.state.order.length, toast: (document.querySelector('#toast') || {}).textContent || '' }));
    const fails = (r.last && r.last.fails) || [];
    check(o.order === 0 && fails.length === 1 && /semicolons/.test(fails[0]) && /Export the Score Grid from IXL again/.test(fails[0]) && !/Imported 1 file/.test(o.toast), `a semicolon-separated file is refused and says why, with no empty class (${o.order} classes; ${fails.join('|')}; toast "${o.toast.slice(0, 80)}")`);
    const r2 = await imp(p, [{ name: 'IXL-Score-Grid_2026-11-13_This-School-Year_1205050-7T4A-M_J-GR7_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv', text: 'Unit,,Skill name,Permanent Skill ID,"AVA STONE"\n' }]);
    const f2 = (r2.last && r2.last.fails) || [];
    check(await p.evaluate(() => window.__tally.state.order.length) === 0 && /no skill rows/.test(f2[f2.length - 1]), `a Score Grid with no skill rows is refused and says why (${f2.join('|')})`);
    check(!errs.length, 'small ones: no page errors ' + errs.join('|')); await b.close(); }
  done();
})().catch(e => { console.error(e); process.exit(1); });
