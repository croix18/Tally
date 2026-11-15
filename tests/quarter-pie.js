// The quarter's IXL on the board (Croix, 15 Nov 2026: "Can I get an option on the board to show all ixls for the current
// grading period on one pie for each class."). A data set in the Data Lab, "Quarter N IXL · skills at goal": every unit
// assigned in the grading period the classes are in. As a circle graph it is one pie a class of every skill for every
// student (at goal, below goal, not started); in the other forms it is each student's skills at goal on those units.
//   1. it is in the data-set menu, named for the quarter, and the choice carries over when the quarter changes
//   2. the pies count the quarter's units only: a unit from a quarter the class has moved past is out
//   3. each student's own list is counted (a modified list), a class too small to show isn't drawn, a whole course adds up
//   4. the other forms, the line over the quarter's imports, both courses, and a Board save all agree with a recount
// Every number is recounted here from the raw state with the grid's own primitives, not read back from the new code.
const { chromium, fs, path, exe, check, done, pick, tmp, APP } = require('./lib');
const K = '1205050-7T1A';
let B = null;
const med = a => { const n = a.length, h = Math.floor(n / 2); return n % 2 ? a[h] : (a[h - 1] + a[h]) / 2; };
const five = vals => { const v = vals.slice().sort((a, b) => a - b), n = v.length, h = Math.floor(n / 2); return { q1: med(v.slice(0, h)), median: med(v), q3: med(v.slice(n % 2 ? h + 1 : h)) }; };
const fmtN = x => Number.isInteger(x) ? String(x) : x.toFixed(1);
(async () => {
  const b = B = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);

  const board = async (o, page) => { await (page || p).evaluate(o => { const T = window.__tally; Object.assign(T.state.settings, { leaderboard: true, lbTab: 'lab' }, o || {}); T.save(); T.render(); }, o); await (page || p).waitForTimeout(450); };
  const leave = async () => { await p.evaluate(() => { const T = window.__tally; T.state.settings.leaderboard = false; T.save(); T.render(); }); await p.waitForTimeout(300); };
  const choose = async (sel, v) => { await p.selectOption(sel, v); await p.waitForTimeout(400); };
  // the recount: every counted student's own skills on the units that are assigned, counted, and not from a past quarter
  const recount = page => (page || p).evaluate(() => { const T = window.__tally; const out = {};
    T.state.order.map(k => T.state.sections[k]).forEach(s => { const us = T.unitsOf(s).filter(u => u.assigned && u.total && !T.unitClosed(s, u)); const pop = T.population(s); let at = 0, below = 0, none = 0; const per = [], own = [];
      pop.forEach(x => { let mine = 0, n = 0; us.forEach(u => T.activeFor(s, u, x.i).forEach(k => { n++; const v = T.eff(s, k, x.i); if (v == null) none++; else if (v >= s.threshold) { at++; mine++; } else below++; })); per.push(mine); own.push(n); });
      out[s.key] = { name: (s.team || s.label).replace(/ · .*/, ''), prep: s.prep, units: us.map(u => u.short), names: us.map(u => u.name), max: us.reduce((a, u) => a + u.total, 0), n: pop.length, at, below, none, per, own, thr: s.threshold }; });
    return out; });
  const view = page => (page || p).evaluate(() => ({ title: (document.querySelector('#lb .lbTitle') || {}).textContent || '', sub: (document.querySelector('#lb .lbSub') || {}).textContent || '',
    legend: [...document.querySelectorAll('#lb .labPieLegend span')].map(x => x.textContent.trim()), groups: [...document.querySelectorAll('#lb .labGroupHead')].map(x => x.textContent.trim()), empty: (document.querySelector('#lb .lbEmpty') || {}).textContent || '',
    cards: [...document.querySelectorAll('#lb .labPie')].map(c => ({ name: c.querySelector('.labName').textContent.trim(), small: (c.querySelector('.labPieHead small') || {}).textContent || '', thin: c.classList.contains('thin'),
      key: [...c.querySelectorAll('.labPieKey span')].map(x => x.textContent.trim()), slices: [...c.querySelectorAll('.labPieArt svg path title')].map(t => t.textContent), notYet: (c.querySelector('.labNotYet') || {}).textContent || '',
      w: c.querySelector('.labPieArt svg circle') ? c.querySelector('.labPieArt svg circle').getBoundingClientRect().width : 0 })),
    rows: [...document.querySelectorAll('#lb .labRow:not(.one)')].map(r => ({ name: r.querySelector('.labName').firstChild.textContent.trim(), small: (r.querySelector('.labName small') || {}).textContent || '', box: (r.querySelector('.labBox title') || {}).textContent || '', avg: (r.querySelector('.labAvg b') || {}).textContent || '' })),
    opts: [...document.querySelectorAll('#labUnit option')].map(o => o.value + '|' + o.textContent), kind: (document.querySelector('#labKind') || {}).value, picked: (document.querySelector('#labUnit') || {}).value,
    notYet: [...document.querySelectorAll('#lb .labNotYet')].map(e => e.textContent.trim()) }));
  const keyOf = r => [`At goal: ${r.at}`, `Below: ${r.below}`, `Not started: ${r.none}`].join(' | ');
  const pctOf = (v, r) => Math.round(v / (r.at + r.below + r.none) * 100);
  const sliceOf = r => [['At goal (' + r.thr + '+)', r.at], ['Below goal', r.below], ['Not started', r.none]].filter(x => x[1]).map(([l, v]) => `${l}: ${v} (${pctOf(v, r)}%)`).join(' | ');

  // ---------- 1. Quarter 1: the option, and what it counts ----------
  await board({ labPrep: 'acc', labKind: 'box', labPct: false, labStats: 0, labAvg: false });
  let v = await view(); let R = await recount();
  { const i = v.opts.indexOf('ixl:quarter|Quarter 1 IXL · skills at goal');
    check(i >= 0 && v.opts[i + 1] === 'unit:__all__|All assigned units · skills at goal', 'the data-set menu has "Quarter 1 IXL · skills at goal", beside All assigned units'); }
  await choose('#labUnit', 'ixl:quarter'); await choose('#labKind', 'circle'); v = await view();
  check(v.title === 'Quarter 1 IXL: skills at goal' && /^Accelerated classes, Units 1–3, every skill counted once for each student, as of /.test(v.sub), 'chosen with Circle graph: the title names the quarter and the line under it says what is counted: ' + v.title + ' / ' + v.sub);
  check(R[K].units.join() === 'Unit 1,Unit 2,Unit 3' && v.cards.length === 1 && v.cards[0].key.join(' | ') === keyOf(R[K]) && v.cards[0].slices.join(' | ') === sliceOf(R[K]), 'in Quarter 1 the pie is every skill of Units 1, 2 and 3 for every counted student: ' + v.cards[0].key.join(' · '));
  check(R[K].at + R[K].below + R[K].none === R[K].n * R[K].max && R[K].max === 59 && v.cards[0].small === `n = ${R[K].n} · 59 skills each`, 'the slices add up to every student times the 59 skills, and the card says so: ' + v.cards[0].small);
  check(v.legend.join(' | ') === `At goal (${R[K].thr}+) | Below goal | Not started`, 'one key above the pies: ' + v.legend.join(' · '));
  const q1 = { ...R[K] };

  // ---------- 2. Quarter 2 arrives: same choice, the quarter's own units ----------
  await leave();
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(800);
  await board(); v = await view(); R = await recount();
  check(v.picked === 'ixl:quarter' && v.kind === 'circle' && v.opts.includes('ixl:quarter|Quarter 2 IXL · skills at goal') && !v.opts.some(o => /Quarter 1 IXL/.test(o)), 'after a Quarter 2 export the same choice is still showing, now named Quarter 2');
  check(v.title === 'Quarter 2 IXL: skills at goal' && /^Accelerated classes, Units 2–3, every skill counted once/.test(v.sub) && R[K].units.join() === 'Unit 2,Unit 3', 'it counts Quarter 2\'s units: Unit 1 belongs to a quarter the class has moved past, so it is out: ' + v.sub);
  check(v.cards[0].key.join(' | ') === keyOf(R[K]) && v.cards[0].small === `n = ${R[K].n} · 36 skills each` && R[K].at + R[K].below + R[K].none === R[K].n * 36 && keyOf(R[K]) !== keyOf(q1), 'the pie is recounted on Units 2 and 3 only (' + v.cards[0].key.join(' · ') + '; with Unit 1 it was ' + keyOf(q1).replace(/ \| /g, ' · ') + ')');
  { const u1 = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const u = T.unitsOf(s).find(u => u.num === 1); return { open: T.openUnits(s).map(u => u.short).join(), closed: T.unitClosed(s, u), assigned: u.assigned }; }, K);
    check(u1.open === 'Unit 2,Unit 3' && u1.closed && u1.assigned, 'the quarter\'s units are the assigned ones that are not past (Unit 1 is assigned and past)'); }

  // ---------- 3. more classes: other scores, a modified list, a class too small to show, an on-level class ----------
  await leave();
  const made = await p.evaluate(K => { const T = window.__tally; const base = T.state.sections[K]; base.period = 1; base.label = '1st Period · Accelerated'; base.team = '1st Period';
    const mk = (per, key, prep, f) => { const s = JSON.parse(JSON.stringify(base)); s.key = key; s.period = per; s.prep = prep; s.label = per + (per === 2 ? 'nd' : per === 3 ? 'rd' : 'th') + ' Period · ' + (prep === 'acc' ? 'Accelerated' : 'On-level'); s.team = s.label.replace(/ · .*/, '');
      s.best = null; s.scores = s.scores.map((row, k) => Array.isArray(row) ? row.map((x, i) => f(x, i, k)) : row); T.state.sections[key] = s; T.state.order.push(key); return s; };
    mk(2, 'p2-acc', 'acc', (x, i, k) => x == null ? ((i + k) % 5 === 0 ? 40 : null) : Math.min(100, x + 10));
    const p3 = mk(3, 'p3-acc', 'acc', (x, i, k) => (i + k) % 3 === 0 ? null : x == null ? 95 : x);
    // one student of 3rd Period has three of Unit 3's skills taken off their list
    const who = T.population(p3)[0]; const u3 = T.unitsOf(p3).find(u => u.num === 3); const off = {}; u3.active.slice(0, 3).forEach(k => off[T.skillKey(p3.skills[k])] = true); p3.studentSkips[T.ixlKeyAt(p3, who.i)] = off;
    // 5th Period: only four students on its roster (fewer than five counted), so it is too small to draw
    const p5 = mk(5, 'p5-acc', 'acc', x => x); p5.roster = p5.roster.split('\n').filter(l => l.trim()).slice(0, 4).join('\n');
    mk(6, 'p6-on', 'on', (x, i, k) => x == null ? null : (i + k) % 4 === 0 ? 30 : x); T.state.settings.currentUnit = { ...(T.state.settings.currentUnit || {}), on: 3 }; T.state.settings.skipFirst = { ...(T.state.settings.skipFirst || {}), on: 0 };
    // imports over time: one in Quarter 1 (26 Sep), two in Quarter 2 made up from it, and today's as of 10 Nov
    T.state.order.map(k => T.state.sections[k]).forEach((s, c) => { const h = s.history[s.history.length - 1]; const like = (date, drop) => { const x = JSON.parse(JSON.stringify(h)); x.date = date; Object.keys(x.pu).forEach(u => Object.keys(x.pu[u]).forEach((key, j) => { x.pu[u][key] = Math.max(0, x.pu[u][key] - drop - (j + c) % 2); })); return x; };
      s.history = [h, like('2026-10-20', 6), like('2026-11-03', 2)]; s.date = '2026-11-10'; T.snapshot(s); });
    T.save(); return { small: T.population(p5).length, list: T.activeFor(p3, u3, who.i).length, full: u3.total, hist: base.history.map(h => h.date).join() }; }, K);
  check(made.small > 0 && made.small < 5 && made.list === made.full - 3 && made.hist === '2026-09-26,2026-10-20,2026-11-03,2026-11-10', 'set up: five classes (one with ' + made.small + ' counted students, one on-level), a modified list, imports on 26 Sep, 20 Oct, 3 Nov and 10 Nov');
  await p.reload(); await p.waitForTimeout(800);
  await board({ labPrep: 'acc', labUnit: 'ixl:quarter', labKind: 'circle', labCmp: { acc: 'class', on: 'class' }, labPct: false, labStats: 0, labAvg: false }); v = await view(); R = await recount();
  const acc = ['1205050-7T1A', 'p2-acc', 'p3-acc', 'p5-acc'];
  check(v.cards.map(c => c.name).join('|') === '1st Period|2nd Period|3rd Period|5th Period' && v.legend.length === 3, 'one pie for each accelerated class, in period order, under one key');
  check(['1205050-7T1A', 'p2-acc', 'p3-acc'].every((k, i) => v.cards[i].key.join(' | ') === keyOf(R[k]) && v.cards[i].slices.join(' | ') === sliceOf(R[k])) && new Set(['1205050-7T1A', 'p2-acc', 'p3-acc'].map(k => keyOf(R[k]))).size === 3, 'each pie is its own class\'s recount, slice for slice: ' + v.cards.slice(0, 3).map(c => c.name + ' ' + c.key.join(' · ')).join(' / '));
  check(R['p3-acc'].at + R['p3-acc'].below + R['p3-acc'].none === R['p3-acc'].n * 36 - 3 && v.cards[2].small === `n = ${R['p3-acc'].n}` && v.cards[0].small === `n = ${R[K].n} · 36 skills each`, 'a student\'s modified list is counted as it is: 3rd Period has three skills fewer, and its card no longer says "36 skills each"');
  check(v.cards[3].thin && /Not enough students yet \(needs 5\)/.test(v.cards[3].notYet) && !v.cards[3].key.length, 'a class with fewer than five counted students is not drawn (as everywhere on the board)');
  check(v.cards.slice(0, 3).every(c => c.w >= 180), 'the pies are big on a 1920×1080 board: ' + v.cards.slice(0, 3).map(c => Math.round(c.w)).join(', ') + ' px across');
  const names = await p.evaluate(() => { const T = window.__tally; return T.state.order.flatMap(k => [...T.state.sections[k].students, ...(T.state.sections[k].grades ? T.state.sections[k].grades.students : [])]); });
  { const html = await p.evaluate(() => document.querySelector('#lb').outerHTML.toLowerCase()); check(names.length > 60 && !names.some(n => html.includes(n.toLowerCase())) && !names.some(n => n.includes(',') && html.includes(n.split(',')[0].toLowerCase())), 'no student is named anywhere on the board'); }

  // the whole course on one pie, and one class beside it
  await choose('#labCmp', 'pool'); v = await view();
  { const sum = { at: 0, below: 0, none: 0, n: 0, thr: R[K].thr }; acc.forEach(k => { sum.at += R[k].at; sum.below += R[k].below; sum.none += R[k].none; sum.n += R[k].n; });
    check(v.cards.length === 1 && v.cards[0].name === 'All accelerated' && v.cards[0].key.join(' | ') === keyOf(sum) && new RegExp('^n = ' + sum.n + ' · 4 classes').test(v.cards[0].small) && /^All accelerated classes together, Units 2–3, every skill/.test(v.sub), 'All accelerated together: one pie, every class\'s skills added up (the small class counts here, as IXL always pools): ' + v.cards[0].key.join(' · '));
    await choose('#labCmp', 'vs:p2-acc'); v = await view();
    check(v.cards.length === 2 && v.cards[0].name === '2nd Period' && v.cards[0].key.join(' | ') === keyOf(R['p2-acc']) && v.cards[1].key.join(' | ') === keyOf(sum), 'one class beside the whole course: its own pie and the course\'s'); }
  await choose('#labCmp', 'class');

  // ---------- 4. the other forms: each student's skills at goal on the quarter's units ----------
  await choose('#labKind', 'box'); v = await view();
  { const ok = ['1205050-7T1A', 'p2-acc', 'p3-acc'].every((k, i) => { const f = five(R[k].per); return v.rows[i] && v.rows[i].box === `Q1 ${fmtN(f.q1)} · median ${fmtN(f.median)} · Q3 ${fmtN(f.q3)} · IQR ${fmtN(f.q3 - f.q1)}`; });
    check(ok && /Units 2–3, skills at goal per student/.test(v.sub), 'as a box plot it is each student\'s skills at goal on Units 2 and 3: ' + (v.rows[0] || {}).box); }
  await lbOpt(p, '#labPct'); await p.click('#labPct [data-pct="1"]'); await p.waitForTimeout(400); v = await view();
  { const f = five(R[K].per.map(x => Math.round(x / R[K].max * 100))); check(v.rows[0].box === `Q1 ${fmtN(f.q1)}% · median ${fmtN(f.median)}% · Q3 ${fmtN(f.q3)}% · IQR ${fmtN(f.q3 - f.q1)}%`, 'and in percent of the quarter\'s 36 skills with %: ' + v.rows[0].box); }
  for (const k of ['dots', 'hist', 'stem', 'bar', 'avg']) { await choose('#labKind', k); v = await view(); check(v.title === 'Quarter 2 IXL: skills at goal' && !v.empty && (await p.locator('#lb .labPlot svg, #lb .labPlot table.stem').count()) > 0, 'drawn as ' + k); }
  await lbOpt(p, '#labPct'); if (await p.$('#labPct [data-pct="0"]')) { await p.click('#labPct [data-pct="0"]'); await p.waitForTimeout(300); }
  // the line: the quarter's own imports, each class's average share of the quarter's skills at goal
  await choose('#labKind', 'line');
  const line = await p.evaluate(() => { const svg = document.querySelector('#lb .labRow.one .chart'); if (!svg) return null; const pts = {};
    svg.querySelectorAll('circle').forEach(c => { const t = (c.querySelector('title') || {}).textContent || ''; const m = /^(.+?) · (.+?): (\d+)%/.exec(t); if (m) (pts[m[1]] = pts[m[1]] || []).push({ at: m[2], v: +m[3] }); }); return pts; });
  const want = await p.evaluate(() => { const T = window.__tally; const out = {}; T.state.order.map(k => T.state.sections[k]).filter(s => s.prep === 'acc' && T.population(s).length >= 5).forEach(s => { const us = T.unitsOf(s).filter(u => u.assigned && u.total && !T.unitClosed(s, u));
      out[(s.team || s.label).replace(/ · .*/, '')] = s.history.filter(h => h.date > '2026-10-09').map(h => { const tot = us.reduce((a, u) => a + h.ua[u.name], 0); const keys = Object.keys(h.per); return Math.round(keys.reduce((a, key) => a + us.reduce((x, u) => x + (h.pu[u.name][key] || 0), 0) / tot * 100, 0) / keys.length); }); }); return out; });
  v = await view();
  check(line && Object.keys(want).every(n => line[n] && line[n].map(x => x.at).join() === 'Oct 20,Nov 3,Nov 10' && line[n].every((x, i) => Math.abs(x.v - want[n][i]) <= 1)) && Object.keys(line).length === 3, 'as a line: each class\'s average share of the quarter\'s skills at goal at the quarter\'s three imports (the September import is Quarter 1\'s, so it is not on it): ' + JSON.stringify(line && line['1st Period']));
  check(/Units 2–3, average share of the quarter's skills at goal at each import/.test(v.sub), 'and the line under the title says what the line is');
  await choose('#labKind', 'circle');

  // ---------- both courses ----------
  await p.evaluate(() => { const T = window.__tally; T.state.settings.labPick = { acc: 'ixl:quarter', on: 'ixl:quarter' }; T.state.settings.labPrep = 'both'; T.state.settings.labRows = 'class'; T.save(); T.render(); }); await p.waitForTimeout(450); v = await view();
  check(v.groups.join('|') === 'Accelerated|On-level' && v.cards.length === 5 && v.cards[4].name === '6th Period' && v.cards[4].key.join(' | ') === keyOf(R['p6-on']) && v.title === 'Quarter 2 IXL: skills at goal', 'both courses, each class: the on-level class has its own pie under its course\'s name: ' + (v.cards[4] || { key: [] }).key.join(' · '));
  await p.evaluate(() => { const T = window.__tally; T.state.settings.labPrep = 'acc'; T.save(); T.render(); }); await p.waitForTimeout(400);

  // ---------- a Board save shows the same pies ----------
  const cfg = await p.evaluate(() => JSON.stringify(window.__tally.boardFile()));
  { const j = JSON.parse(cfg); check(j.state.sections[K].openUnits.join('|') === R[K].names.join('|') && !names.some(n => cfg.includes(n)), 'the Board save carries each class\'s quarter units and no student\'s name'); }
  const bf = path.join(tmp, 'tally-board-quarter.json'); fs.writeFileSync(bf, cfg);
  // another computer: its own browser storage (a second tab here would share this Tally's)
  const ctx2 = await b.newContext({ viewport: { width: 1920, height: 1080 } }); const q = await ctx2.newPage(); q.on('pageerror', e => errs.push('board page: ' + e.message)); q.on('dialog', d => d.accept()); await q.goto('file://' + path.resolve(APP)); await q.waitForTimeout(500);
  await q.setInputFiles('#file', [bf]); await q.waitForTimeout(1000);
  const bv = await view(q);
  check(await q.evaluate(() => !!window.__tally.state.board) && bv.title === 'Quarter 2 IXL: skills at goal' && /Units 2–3/.test(bv.sub) && bv.cards.map(c => c.name).join('|') === '1st Period|2nd Period|3rd Period|5th Period', 'opened on another Tally it comes up on the same pies: ' + bv.title + ' / ' + bv.sub);
  check(['1205050-7T1A', 'p2-acc', 'p3-acc'].every((k, i) => bv.cards[i].key.join(' | ') === keyOf(R[k])), 'with the same counts, although the save holds no kept quarter to work Unit 1 out from: ' + bv.cards.slice(0, 3).map(c => c.key.join(' · ')).join(' / '));
  { const w = await q.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const withList = T.openUnits(s).map(u => u.short).join(); const kept = s.openUnits; delete s.openUnits; const without = T.openUnits(s).map(u => u.short).join(); s.openUnits = kept; return { withList, without }; }, K);
    check(w.withList === 'Unit 2,Unit 3' && w.without !== w.withList, 'that list is what keeps it right there: worked out again from the save alone, the quarter would read ' + w.without); }
  await ctx2.close();

  // ---------- IXL and a test keeps its own choices; a class an export behind ----------
  await board({ labPrep: 'acc', labUnit: 'ixl:quarter', labKind: 'corr' });
  { const xs = await p.$$eval('#labCx option', os => os.map(o => o.value)); check(xs.length > 0 && !xs.includes('ixl:quarter') && xs.includes('unit:__all__'), 'IXL and a test still offers single units and All assigned units across the bottom, not the quarter\'s set'); }
  // 2nd Period's gradebook has no Quarter 2 column for Unit 2, so for it Unit 2 is past: its pie is Unit 3 alone
  await p.evaluate(() => { const T = window.__tally; const s = T.state.sections['p2-acc']; s.grades.assignments = s.grades.assignments.filter(a => a.name !== 'Unit 2 IXL Review'); T.save(); });
  await board({ labKind: 'circle' }); v = await view(); R = await recount();
  check(R['p2-acc'].units.join() === 'Unit 3' && v.cards[1].key.join(' | ') === keyOf(R['p2-acc']) && v.cards[1].small === `n = ${R['p2-acc'].n} · 19 skills each` && v.cards[0].small === `n = ${R[K].n} · 36 skills each`, 'a class whose gradebook puts Unit 2 in the past counts Unit 3 alone, and its card says how many skills that is: ' + v.cards[1].small);
  check(/^Accelerated classes, each class's own units for the quarter, every skill counted once/.test(v.sub) && !/Units 2–3/.test(v.sub), 'and the line under the title no longer names one set of units for every class: ' + v.sub);
  // ---------- nothing assigned this quarter ----------
  await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const T = window.__tally; T.state.assigned = T.state.assigned || {}; const m = { ...(T.state.assigned.acc || {}) }; T.unitsOf(T.state.sections[T.state.order[0]]).filter(u => u.num === 2 || u.num === 3).forEach(u => { m[u.name] = false; }); T.state.assigned.acc = m; T.save(); });
  await board({ labPrep: 'acc', labUnit: 'ixl:quarter', labKind: 'circle' }); v = await view();
  check(/No IXL unit is assigned for Quarter 2 yet/.test(v.empty) && !v.cards.length && v.picked === 'ixl:quarter', 'with no unit assigned in the quarter the board says so, and the choice stays: ' + v.empty);
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(async e => { console.error(e); try { if (B) await B.close(); } catch (x) {} process.exit(1); });
