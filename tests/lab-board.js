// The Data Lab on the board (Croix, 4 Nov 2026: "I love the tab where I can show the students the comparison between
// classes ... can I get a full screen mode that request chrome to stay on and not black out, bigger pies ..., A line
// chart to show correlation between an ixl skill and its test grades ..., a way to display all of a prep ... compared to
// a specific class ..., an option to show comparisons on ixls not yet in the grade book yet but in tally"):
//   1. Full screen, with a screen wake lock while it lasts; the bar fades while the room watches and comes back on a touch
//   2. Circle graphs as a grid of large pies under one key
//   3. "IXL and a test": the average test score of each range of the unit's IXL, groups of 3 or more, and r
//   4. Compare: each class, the whole course, or one class beside the whole course (the other course, in Both)
//   5. IXL units Focus doesn't have yet, in their own group, and a single unit's line over time from Tally's history
// Every number is recounted here from the raw state, not read back from the code under test.
const { chromium, fs, path, exe, check, done, pick, tmp, APP } = require('./lib');
let B = null;   // the browser, closed even if the suite crashes
const med = a => { const n = a.length, h = Math.floor(n / 2); return n % 2 ? a[h] : (a[h - 1] + a[h]) / 2; };
const five = vals => { const v = vals.slice().sort((a, b) => a - b), n = v.length, h = Math.floor(n / 2); return { n, q1: med(v.slice(0, h)), median: med(v), q3: med(v.slice(n % 2 ? h + 1 : h)) }; };
const fmtN = x => Number.isInteger(x) ? String(x) : x.toFixed(1);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const pear = (xs, ys) => { const n = xs.length, mx = mean(xs), my = mean(ys); let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { a += (xs[i] - mx) * (ys[i] - my); b += (xs[i] - mx) ** 2; c += (ys[i] - my) ** 2; } return a / Math.sqrt(b * c); };
const near = (shown, want) => want != null && Math.abs(shown - want) <= 0.5 + 1e-6;   // the board rounds to whole percents
(async () => {
  const b = B = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  // a stand-in screen wake lock that records what is asked of it (headless Chromium grants none); the page can be told
  // to refuse, as Chrome does on battery saver, and its visibility can be set, as when the teacher switches tabs
  await p.addInitScript(() => { window.__locks = []; window.__refuse = false; window.__vis = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async type => { if (window.__refuse) throw new DOMException('refused', 'NotAllowedError');
      const l = { type, released: false, ls: [], addEventListener(e, f) { if (e === 'release') this.ls.push(f); }, async release() { if (this.released) return; this.released = true; this.ls.forEach(f => f()); } }; window.__locks.push(l); return l; } } }); });
  await p.goto('file://' + path.resolve(APP));
  // Five accelerated classes: the scrubbed class and four copies with shifted scores, a gradebook in each, and an IXL
  // import five days before the latest in each class's history (synthetic: the fixture's scrubbed names only)
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  await p.evaluate(() => { const T = window.__tally; const K = '1205050-7T1A'; const base = T.state.sections[K]; base.period = 1; base.label = '1st Period · Accelerated'; base.team = '1st Period';
    const h = base.history[base.history.length - 1]; const d0 = new Date(h.date + 'T12:00:00'); d0.setDate(d0.getDate() - 5); const older = JSON.parse(JSON.stringify(h)); older.date = d0.toISOString().slice(0, 10);
    Object.keys(older.pu).forEach(u => Object.keys(older.pu[u]).forEach(k => { older.pu[u][k] = Math.max(0, older.pu[u][k] - ((k.length + u.length) % 4)); })); Object.keys(older.per).forEach(k => { older.per[k] = Math.max(0, older.per[k] - 3); }); base.history.unshift(older);
    const mk = (per, shift, boost) => { const s = JSON.parse(JSON.stringify(base)); s.key = 'p' + per + '-acc'; s.period = per; s.label = per + (per === 2 ? 'nd' : per === 3 ? 'rd' : 'th') + ' Period · Accelerated'; s.team = s.label.replace(/ · .*/, '');
      s.grades.assignments.forEach(a => { if (a.max) a.values = a.values.map((v, i) => v == null ? null : Math.max(0, Math.min(a.max, Math.round((v + shift * ((i * 7 + per) % 5 - 2) / 2) * 2) / 2))); });
      s.scores = s.scores.map(row => Array.isArray(row) ? row.map((v, i) => v == null ? (((i + per) % 6 === 0) ? 70 : null) : Math.max(0, Math.min(100, v + boost * (((i + per) % 3) - 1)))) : row);
      s.history = s.history.map(hh => { const c = JSON.parse(JSON.stringify(hh)); Object.keys(c.pu || {}).forEach(u => Object.keys(c.pu[u]).forEach(k => { c.pu[u][k] = Math.max(0, c.pu[u][k] + ((k.charCodeAt(0) + per) % 5) - 2); })); return c; });
      T.state.sections[s.key] = s; T.state.order.push(s.key); };
    mk(2, 3, 12); mk(3, -2, 20); mk(5, 4, -15); mk(6, 1, 8); T.save(); });
  await p.reload(); await p.waitForTimeout(800);
  const NAMES = ['1st Period', '2nd Period', '3rd Period', '5th Period', '6th Period'];
  // recounts: a unit's points per counted student (the grid's own points column), and the unit's skill total
  const unitVals = nm => p.evaluate(nm => { const T = window.__tally; const out = {}; T.state.order.map(k => T.state.sections[k]).filter(s => s.prep === 'acc').forEach(s => { const u = T.unitsOf(s).find(u => u.name === nm); out[(s.team || s.label).replace(/ · .*/, '')] = { vals: T.population(s).map(x => T.points(s, u, x.i)), total: u.total }; }); return out; }, nm);
  const view = () => p.evaluate(() => ({ title: (document.querySelector('#lb .lbTitle') || {}).textContent || '', sub: (document.querySelector('#lb .lbSub') || {}).textContent || '',
    rows: [...document.querySelectorAll('#lb .labRow:not(.one)')].map(r => ({ name: r.querySelector('.labName').firstChild.textContent.trim(), small: (r.querySelector('.labName small') || {}).textContent || '', course: r.classList.contains('course'), box: (r.querySelector('.labBox title') || {}).textContent || '' })),
    notYet: [...document.querySelectorAll('#lb .labNotYet')].map(e => e.textContent.trim()), kinds: [...document.querySelectorAll('#labKind option')].map(o => o.value) }));
  const lines = () => p.evaluate(() => { const svg = document.querySelector('#lb .labRow.one .chart'); if (!svg) return null; const pts = {};
    svg.querySelectorAll('circle').forEach(c => { const t = (c.querySelector('title') || {}).textContent || ''; const m = /^(.+?) · (.+?): (\d+)%(?: · (\d+) students?)?$/.exec(t); if (m) (pts[m[1]] = pts[m[1]] || []).push({ at: m[2], v: +m[3], n: m[4] != null ? +m[4] : null }); });
    return { pts, circles: svg.querySelectorAll('circle').length, paths: [...svg.querySelectorAll('path.ln')].map(x => x.classList.contains('ref')), ends: [...svg.querySelectorAll('text.lbl')].map(t => t.firstChild.textContent.trim()), vals: svg.querySelectorAll('text.val').length, ticks: [...svg.querySelectorAll('text.tl')].map(t => t.textContent) }; });
  const pies = () => p.evaluate(() => ({ cards: [...document.querySelectorAll('#lb .labPie')].map(c => { const art = c.querySelector('.labPieArt svg'); const ring = art && art.querySelector('circle'); const box = c.getBoundingClientRect();
      const labs = art ? [...art.querySelectorAll('text.val')].map(t => { const r = t.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; }) : [];
      return { name: c.querySelector('.labName').textContent.trim(), small: (c.querySelector('.labPieHead small') || {}).textContent || '', chips: [...c.querySelectorAll('.labPieKey span')].map(s => s.textContent.trim()), d: ring ? ring.getBoundingClientRect().width : 0, top: box.top, bottom: box.bottom, left: box.left, right: box.right, labs }; }),
    key: [...document.querySelectorAll('#lb .labPieLegend span')].map(s => s.textContent.trim()), legends: document.querySelectorAll('#lb .labPieLegend').length, toolsTop: document.querySelector('.lbTools').getBoundingClientRect().top, vh: innerHeight }));
  const set = cfg => p.evaluate(cfg => { const T = window.__tally; Object.assign(T.state.settings, cfg); T.save(); T.render(); }, cfg).then(() => p.waitForTimeout(350));
  const choose = async (sel, v) => { await p.selectOption(sel, v); await p.waitForTimeout(380); };

  await p.click('#btnLb'); await p.waitForTimeout(600); await p.click('[data-tab="lab"]'); await p.waitForTimeout(500);

  // ---- 5. IXL units Focus doesn't have yet ------------------------------------------------------------------------
  const groups = await p.$$eval('#labUnit optgroup', gs => gs.map(g => ({ label: g.label, items: [...g.querySelectorAll('option')].map(o => o.value) })));
  const want5 = await p.evaluate(() => { const T = window.__tally; const secs = T.state.order.map(k => T.state.sections[k]).filter(s => s.prep === 'acc'); const inGb = new Set();
    secs.forEach(s => s.grades.assignments.forEach(a => { const m = /^Unit (\d+) IXL\b/i.exec(a.name); if (m) inGb.add(+m[1]); }));
    const units = []; secs.forEach(s => T.unitsOf(s).forEach(u => { if (!u.hidden && u.total && !units.some(x => x.name === u.name)) units.push({ name: u.name, num: u.num }); }));
    return { inF: units.filter(u => inGb.has(u.num)).map(u => 'unit:' + u.name), notF: units.filter(u => !inGb.has(u.num)).map(u => 'unit:' + u.name), gbUnits: [...inGb].sort() }; });
  const gIn = groups.find(g => g.label === 'IXL units in Focus (points)'), gNot = groups.find(g => g.label === 'IXL units not in Focus yet (points)');
  check(gIn && gNot && groups.indexOf(gIn) === 0 && groups.indexOf(gNot) === 1, 'the data list opens with two groups of IXL units: "IXL units in Focus" then "IXL units not in Focus yet" (' + groups.map(g => g.label).join(' | ') + ')');
  check(gIn && JSON.stringify(gIn.items.filter(v => v !== 'unit:__all__')) === JSON.stringify(want5.inF) && gIn.items[gIn.items.length - 1] === 'unit:__all__', 'in Focus: the units the gradebook has an IXL column for (Units ' + want5.gbUnits.join(', ') + '), then All assigned units');
  check(gNot && want5.notF.length > 0 && JSON.stringify(gNot.items) === JSON.stringify(want5.notF), 'not in Focus yet: every other unit Tally counts (' + want5.notF.map(v => (/^unit:(Unit \d+)/.exec(v) || [, v])[1]).join(', ') + ')');
  const U1 = want5.inF[0], U2 = want5.inF[1], U3 = want5.notF[0], U1n = U1.slice(5), U3n = U3.slice(5);
  // a unit Focus doesn't have yet works in every graph, from Tally's own count
  await choose('#labUnit', U3);
  for (const k of ['box', 'dots', 'hist', 'stem', 'bar', 'circle', 'avg']) { await choose('#labKind', k); const v = await view();
    const drew = await p.evaluate(() => document.querySelectorAll('#lb .labPlot svg, #lb .labPlot table.stem, #lb .labPie svg').length);
    check(drew > 0 && !v.notYet.some(t => /Focus scores|No class/.test(t)), k + ': ' + U3n.slice(0, 6) + ' (not in Focus yet) draws as any IXL unit does'); }
  { const v = await view(); check(v.kinds.join(',') === 'box,dots,hist,stem,bar,circle,line,avg,corr', 'an IXL unit is offered in every form, and IXL and a test: ' + v.kinds.join(',')); }
  // ...and its line over time: each class's average share of the unit at goal at each import
  await choose('#labKind', 'line');
  const hist = await p.evaluate(nm => { const T = window.__tally; const out = {}; T.state.order.map(k => T.state.sections[k]).filter(s => s.prep === 'acc').forEach(s => { out[(s.team || s.label).replace(/ · .*/, '')] = (s.history || []).map(h => { const pu = (h.pu || {})[nm], tot = (h.ua || {})[nm]; return { date: h.date, v: pu && tot ? Object.values(pu).map(x => x / tot * 100) : [] }; }); }); return out; }, U3n);
  const dates = [...new Set(Object.values(hist).flatMap(h => h.map(x => x.date)))].sort();
  { const L = await lines(); const v = await view();
    check(L && dates.length === 2 && NAMES.every(n => L.pts[n] && L.pts[n].length === 2), 'one line per class, a point at each of the ' + dates.length + ' imports (' + dates.join(', ') + ')');
    check(L && NAMES.every(n => L.pts[n].every((pt, i) => near(pt.v, mean(hist[n].find(h => h.date === dates[i]).v)))), 'each point is the class\'s average of skills at goal over the unit\'s skills, from that day\'s import: ' + (L ? NAMES.map(n => n.slice(0, 3) + ' ' + L.pts[n].map(x => x.v + '%').join('→')).join(', ') : ''));
    check(/average share of the unit's skills at goal at each import/.test(v.sub) && L.ticks.includes('100%'), 'the line says what it shows: "' + v.sub + '"'); }
  // ---- 4. Compare (one course) ------------------------------------------------------------------------------------
  const cmpOpts = await p.$$eval('#labCmp option', os => os.map(o => [o.value, o.textContent]));
  check(cmpOpts.map(o => o[1]).join(' | ') === ['Each class', 'All accelerated together', ...NAMES.map(n => n + ' vs all accelerated')].join(' | '), 'a Compare menu: each class, all accelerated together, or one class beside all accelerated');
  check(cmpOpts[0][0] === 'class' && await p.$eval('#labCmp', s => s.value) === 'class', '…each class until he picks');
  // the line graph, the whole course: each class as of its latest import on or before the day
  await choose('#labCmp', 'pool');
  { const L = await lines(); const wantP = dates.map(d => mean(Object.values(hist).flatMap(h => (h.filter(x => x.date <= d).pop() || { v: [] }).v)));
    check(L && Object.keys(L.pts).join() === 'All accelerated' && L.pts['All accelerated'].every((pt, i) => near(pt.v, wantP[i])), 'all accelerated together: one line, every student in the course at each import (' + wantP.map(x => x.toFixed(1)).join(' → ') + ')'); }
  await choose('#labCmp', 'vs:p3-acc');
  { const L = await lines(); const v = await view();
    check(L && Object.keys(L.pts).join('|') === '3rd Period|All accelerated' && JSON.stringify(L.paths) === '[false,true]', '3rd Period vs all accelerated: two lines, the course\'s dashed');
    check(/^3rd Period and all accelerated classes, /.test(v.sub), 'the line under the title says who: "' + v.sub.slice(0, 60) + '…"'); }
  // the rows, on a box plot of Unit 1
  const u1 = await unitVals(U1n); const allU1 = Object.values(u1).flatMap(x => x.vals);
  await choose('#labKind', 'box'); await choose('#labCmp', 'pool'); await choose('#labUnit', U1);
  { const v = await view(); const f = five(allU1);
    check(v.rows.length === 1 && v.rows[0].name === 'All accelerated' && v.rows[0].course, 'all accelerated together: one row for the course');
    check(new RegExp('^n = ' + allU1.length + ' · 5 classes').test(v.rows[0].small), '…every counted student in the five classes: ' + v.rows[0].small + ' (recount ' + Object.values(u1).map(x => x.vals.length).join(' + ') + ')');
    check(v.rows[0].box === `Q1 ${fmtN(f.q1)} · median ${fmtN(f.median)} · Q3 ${fmtN(f.q3)} · IQR ${fmtN(f.q3 - f.q1)}`, '…and its box is the five-number summary of all of them: ' + v.rows[0].box);
    check(/^All accelerated classes together, /.test(v.sub), 'subtitle: "' + v.sub.slice(0, 50) + '…"'); }
  await choose('#labCmp', 'vs:p3-acc');
  { const v = await view(); const f3 = five(u1['3rd Period'].vals);
    check(v.rows.map(r => r.name).join('|') === '3rd Period|All accelerated' && !v.rows[0].course && v.rows[1].course, '3rd Period vs all accelerated: the class, then the whole course marked as a course');
    check(v.rows[0].small.startsWith('n = ' + u1['3rd Period'].vals.length) && v.rows[1].small.startsWith('n = ' + allU1.length) && v.rows[0].box.startsWith(`Q1 ${fmtN(f3.q1)} · median ${fmtN(f3.median)} `), '…3rd Period is its own ' + u1['3rd Period'].vals.length + ', the course all ' + allU1.length); }
  await choose('#labKind', 'avg');
  { const bars = await p.evaluate(() => ({ l: [...document.querySelectorAll('#lb .labAvgBars text.lbl')].map(t => t.textContent), v: [...document.querySelectorAll('#lb .labAvgBars text.val')].map(t => t.textContent), sub: document.querySelector('#lb .lbSub').textContent }));
    check(bars.l.join('|') === '3rd Period|All accelerated' && bars.v[0] === mean(u1['3rd Period'].vals).toFixed(1) && bars.v[1] === mean(allU1).toFixed(1), 'class averages: 3rd Period ' + bars.v[0] + ' beside the course\'s ' + bars.v[1]);
    check(/average points$|average points, as of/.test(bars.sub) && !/per row/.test(bars.sub), 'the bars are "average points", not "per row": "' + bars.sub + '"'); }
  await choose('#labKind', 'hist');
  { const v = await view(); check(/bars show the percent of the students in each row/.test(v.sub), 'a histogram of a class beside a course of five draws percents of each row\'s students, and says so'); }
  // remembered for the course; a class that is gone, or a bad value in a file, is each class again
  await p.reload(); await p.waitForTimeout(800);
  check(await p.$eval('#labCmp', s => s.value) === 'vs:p3-acc', 'the compare choice comes back after a reload');
  for (const bad of ['vs:gone-class', 'vs:<img src=x onerror=alert(1)>', 'everything']) { await set({ labCmp: { acc: bad, on: 'class' } }); await p.reload(); await p.waitForTimeout(700);
    check(await p.$eval('#labCmp', s => s.value) === 'class' && (await view()).rows.length === 5 && !errs.length, JSON.stringify(bad) + ' is read as each class'); }
  // ---- 2. The pies ------------------------------------------------------------------------------------------------
  await set({ labUnit: U1, labKind: 'circle', labCmp: { acc: 'class', on: 'class' }, labPct: false });
  const rng = (m, i) => { const e = j => Math.ceil(m * j / 4); const lo = e(i), hi = i === 3 ? m : e(i + 1) - 1; return lo === hi ? String(lo) : lo + '–' + hi; };
  const quarters = (vals, m) => { const q = [0, 0, 0, 0]; vals.forEach(v => q[Math.min(3, Math.floor(v / m * 4))]++); return q; };
  const pie5 = await pies(); const m1 = u1['1st Period'].total;
  check(pie5.cards.map(c => c.name).join('|') === NAMES.join('|') && pie5.legends === 1, 'circle graphs: one pie per class in period order, one key for all of them');
  check(pie5.key.length === 4 && pie5.key.every((t, i) => t.endsWith('(' + rng(m1, i) + ' of ' + m1 + ')')), 'the key names the four ranges of the unit\'s ' + m1 + ' skills: ' + pie5.key.map((t, i) => rng(m1, i)).join(', '));
  check(pie5.cards.every(c => { const q = quarters(u1[c.name].vals, m1); return c.chips.join('|') === q.map((n, i) => rng(m1, i) + ': ' + n).join('|') && c.small.startsWith('n = ' + u1[c.name].vals.length); }), 'beside each pie, its counts in the key\'s order, recounted: ' + pie5.cards.map(c => c.name.slice(0, 3) + ' ' + c.chips.map(x => x.split(': ')[1]).join('/')).join(', '));
  const dMin5 = Math.min(...pie5.cards.map(c => c.d));
  check(dMin5 >= 200, 'the pies are big on a 1920×1080 board: ' + Math.round(dMin5) + ' px across with five classes (the circle graphs they replace drew 92 in a row of five)');
  check(pie5.cards.every(c => c.bottom <= pie5.toolsTop + 1), 'all five fit above the bar at the bottom, no scrolling (lowest card ends at ' + Math.round(Math.max(...pie5.cards.map(c => c.bottom))) + ', the bar starts at ' + Math.round(pie5.toolsTop) + ')');
  const clash = cs => cs.some(c => c.labs.some((a, i) => c.labs.some((z, j) => j > i && a.l < z.r - 1 && z.l < a.r - 1 && a.t < z.b - 1 && z.t < a.b - 1)));
  check(!clash(pie5.cards), 'no two slice labels on a pie overlap');
  // every unit and Focus set: no two labels on a pie overlap (an A and an F meet at the top), and none leaves its card
  const allIds = await p.$$eval('#labUnit option', os => os.map(o => o.value).filter(v => /^(unit|gb|grade):/.test(v))); const bad = [];
  for (const id of allIds) { await p.selectOption('#labUnit', id); await p.waitForTimeout(220); const P = await pies();
    if (clash(P.cards) || P.cards.some(c => c.labs.some(l => l.l < c.left - 1 || l.r > c.right + 1 || l.t < c.top - 1 || l.b > c.bottom + 1))) bad.push(id); }
  check(allIds.length > 20 && !bad.length, 'the pies of every data set (' + allIds.length + '): no labels overlap or leave the card' + (bad.length ? ': ' + bad.join(', ') : ''));
  await choose('#labUnit', U1);
  await choose('#labCmp', 'vs:p3-acc');
  { const P = await pies(); const q = quarters(allU1, m1);
    check(P.cards.map(c => c.name).join('|') === '3rd Period|All accelerated' && P.cards[1].chips.join('|') === q.map((n, i) => rng(m1, i) + ': ' + n).join('|'), '3rd Period beside all accelerated: the course\'s pie counts all ' + allU1.length + ' students (' + q.join('/') + ')');
    check(Math.min(...P.cards.map(c => c.d)) > dMin5 * 1.3 && !clash(P.cards), 'two pies are drawn larger still: ' + Math.round(Math.min(...P.cards.map(c => c.d))) + ' px across'); }
  // ---- 3. IXL and a test ------------------------------------------------------------------------------------------
  const pairsOf = (xName, yId) => p.evaluate(([xName, yId]) => { const T = window.__tally; const out = {};
    T.state.order.map(k => T.state.sections[k]).filter(s => s.prep === 'acc').forEach(s => { const u = T.unitsOf(s).find(u => u.name === xName); const gb = s.grades; const rows = T.gbRows(s); let ys;
      if (yId === 'grade:course') ys = T.gradeAll(T.openSec(s)).map(r => r && r.rounded != null ? r.rounded : null);
      else { const a = gb.assignments.find(a => 'gb:' + a.name === yId); ys = gb.students.map((_, i) => a.values[i] != null && (!a.status || a.status[i] === 'score') ? a.values[i] / a.max * 100 : null); }
      out[(s.team || s.label).replace(/ · .*/, '')] = gb.students.map((_, i) => { const r = rows[i]; if (!r || r.ixl == null || ys[i] == null) return null; const own = T.activeFor(s, u, r.ixl).length; return own ? { f: T.points(s, u, r.ixl) / own, y: ys[i] } : null; }).filter(Boolean); });
    return out; }, [xName, yId]);
  const bands = pairs => { const s = [0, 0, 0, 0], n = [0, 0, 0, 0]; pairs.forEach(q => { const k = Math.min(3, Math.floor(q.f * 4 + 1e-9)); s[k] += q.y; n[k]++; }); return n.map((k, i) => ({ n: k, v: k >= 3 ? s[i] / k : null })); };
  await set({ labCmp: { acc: 'class', on: 'class' }, labUnit: U1, labKind: 'box', labCorr: { acc: {}, on: {} } });
  await choose('#labKind', 'corr');
  const cx0 = await p.$eval('#labCx', s => s.value), cy0 = await p.$eval('#labCy', s => s.value);
  check(cx0 === U1 && cy0 === 'gb:Unit 1 Assessment', '"IXL and a test" opens on the unit showing and that unit\'s own test: ' + cx0.slice(5, 11) + ' and ' + cy0.slice(3));
  const pr = await pairsOf(U1n, 'gb:Unit 1 Assessment'); const prAll = Object.values(pr).flat();
  const wantL = Object.fromEntries([...NAMES.map(n => [n, bands(pr[n])]), ['All accelerated', bands(prAll)]]);
  const drawnW = Object.keys(wantL).filter(k => wantL[k].filter(x => x.v != null).length >= 2);
  { const L = await lines(); const v = await view(); const ax = await p.$$eval('#lb .labAxis', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
    check(v.title === 'Unit 1 IXL and Unit 1 Assessment', 'the title names both: "' + v.title + '"');
    const days = await p.evaluate(() => { const T = window.__tally; const s = T.state.sections['1205050-7T1A']; return { ixl: T.fmtDate(s.date), gb: T.fmtDate(T.localDayOf(s.grades.importedAt)) }; });
    check(days.ixl !== days.gb && v.sub.endsWith(`IXL as of ${days.ixl}, Focus as of ${days.gb}`), 'the IXL export and the gradebook are from different days, and the line says both: "…' + v.sub.slice(-40) + '"');
    check(L && JSON.stringify(Object.keys(L.pts).sort()) === JSON.stringify(drawnW.slice().sort()) && L.paths.filter(Boolean).length === 1, 'a line for each class with points in two ranges or more, and the whole course dashed (' + drawnW.join(', ') + ')');
    check(L && L.ticks.slice(-4).join('|') === [0, 1, 2, 3].map(i => rng(m1, i)).join('|'), 'across: four ranges of the unit\'s ' + m1 + ' skills, a quarter each: ' + (L ? L.ticks.slice(-4).join(', ') : ''));
    const ok = L && drawnW.every(k => { const got = L.pts[k], w = wantL[k].map((x, i) => ({ ...x, at: rng(m1, i) })).filter(x => x.v != null); return got.length === w.length && got.every((pt, i) => pt.at === w[i].at && near(pt.v, w[i].v) && pt.n === w[i].n); });
    check(ok, 'up: each point is the average test score of the students in that range, recounted: ' + (L ? Object.entries(L.pts).map(([k, a]) => k.slice(0, 3) + ' ' + a.map(x => x.v).join('/')).join(', ') : ''));
    check(L && Object.values(L.pts).flat().every(pt => pt.n >= 3) && L.circles === Object.values(L.pts).flat().length, 'every point stands for 3 or more students, and there is no other mark: no one\'s score is on the board (' + (L ? L.circles : 0) + ' points)');
    const r = pear(prAll.map(q => q.f), prAll.map(q => q.y));
    check(ax[0] && ax[0].includes(`r = ${r.toFixed(2)} for the ${prAll.length} accelerated students with both`), 'r is worked out over every student with both: r = ' + r.toFixed(2) + ' for ' + prAll.length);
    const words = Math.abs(r) < 0.3 ? 'no clear relationship' : (Math.abs(r) < 0.5 ? 'a weak' : Math.abs(r) < 0.7 ? 'a moderate' : 'a strong') + ' tendency for students with more of the IXL at goal to score ' + (r > 0 ? 'higher' : 'lower');
    check(ax[0] && ax[0].includes(words) && ax[0].startsWith(`Across: Unit 1 IXL skills at goal (of ${m1}). Up: the average on Unit 1 Assessment of the students in each range, 3 or more to a point.`), '…and the caption reads it in words: "' + (ax[0] || '').slice(-90) + '"'); }
  await choose('#labCmp', 'vs:p3-acc');
  { const L = await lines(); const ax = await p.$eval('#lb .labAxis', e => e.textContent.replace(/\s+/g, ' '));
    const w3 = wantL['3rd Period'].filter(x => x.v != null), wc = wantL['All accelerated'].filter(x => x.v != null);
    check(L && Object.keys(L.pts).join('|') === '3rd Period|All accelerated' && JSON.stringify(L.paths) === '[false,true]', '3rd Period vs all accelerated: the class\'s line and the course\'s, dashed');
    check(L && L.pts['3rd Period'].every((pt, i) => near(pt.v, w3[i].v)) && L.pts['All accelerated'].every((pt, i) => near(pt.v, wc[i].v)), '…each from its own students');
    check(L && L.vals === L.circles - 2, 'two lines: every point but the last carries its value (the last is in the line\'s label)');
    const r3 = pr['3rd Period'].length >= 8 ? pear(pr['3rd Period'].map(q => q.f), pr['3rd Period'].map(q => q.y)) : null;
    check(r3 == null || ax.includes(`3rd Period's ${pr['3rd Period'].length}: r = ${r3.toFixed(2)}.`), '…and the class\'s own r beside the course\'s' + (r3 != null ? ': ' + r3.toFixed(2) : '')); }
  await choose('#labCmp', 'pool');
  { const L = await lines(); check(L && Object.keys(L.pts).join() === 'All accelerated' && JSON.stringify(L.paths) === '[false]', 'all accelerated together: one solid line'); }
  // a class with no gradebook yet, set beside the course: the course's line, solid, and a line saying why the class has none
  await p.evaluate(() => { const T = window.__tally; window.__gb6 = T.state.sections['p6-acc'].grades; T.state.sections['p6-acc'].grades = null; T.render(); }); await p.waitForTimeout(300);
  await choose('#labCmp', 'vs:p6-acc');
  { const L = await lines(); const ax = await p.$$eval('#lb .labAxis', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()).join(' '));
    check(L && Object.keys(L.pts).join() === 'All accelerated' && JSON.stringify(L.paths) === '[false]' && /6th Period: no student has both a score on Unit 1 Assessment and Unit 1 IXL yet\./.test(ax), 'a class with no gradebook beside the course: the course\'s line alone, and a line saying why the class has none'); }
  await p.evaluate(() => { const T = window.__tally; T.state.sections['p6-acc'].grades = window.__gb6; T.save(); T.render(); }); await p.waitForTimeout(300);
  await choose('#labCmp', 'class');
  // a new unit brings its own test; a unit Focus has no test for yet is set beside the course grade
  await choose('#labCx', U2);
  check(await p.$eval('#labCy', s => s.value) === 'gb:Unit 2 Vocabulary Quiz', 'Unit 2 brings Unit 2\'s own graded work: ' + (await p.$eval('#labCy', s => s.value)).slice(3));
  await choose('#labCx', U3);
  { const cy = await p.$eval('#labCy', s => s.value); const v = await view(); check(cy === 'grade:course' && /^Unit \d+ IXL and Course grade, Quarter \d$/.test(v.title), U3n.slice(0, 6) + ' has no test in Focus yet: it is set beside the course grade ("' + v.title + '")');
    const pg = await pairsOf(U3n, 'grade:course'); const all = Object.values(pg).flat(); const L = await lines(); const wc = bands(all).filter(x => x.v != null);
    check(L && L.pts['All accelerated'] && L.pts['All accelerated'].every((pt, i) => near(pt.v, wc[i].v)), '…from Tally\'s own count of the unit and each student\'s Focus grade: ' + (L && L.pts['All accelerated'] ? L.pts['All accelerated'].map(x => x.v + '%').join(' → ') : 'no line')); }
  await choose('#labCy', 'gb:Squares and Cubes Quiz');
  await p.reload(); await p.waitForTimeout(800);
  check(await p.$eval('#labCx', s => s.value) === U3 && await p.$eval('#labCy', s => s.value) === 'gb:Squares and Cubes Quiz' && (await view()).title.endsWith('IXL and Squares and Cubes Quiz'), 'a test he picks stays picked after a reload');
  await choose('#labKind', 'box'); await choose('#labKind', 'corr');
  check(await p.$eval('#labCy', s => s.value) === 'gb:Squares and Cubes Quiz', '…and after a trip to another graph');
  // ---- 1. Full screen ---------------------------------------------------------------------------------------------
  await set({ labUnit: U1, labKind: 'circle', labCmp: { acc: 'class', on: 'class' } });
  const fsNow = () => p.evaluate(() => ({ fs: document.fullscreenElement === document.documentElement, body: document.body.className, locks: window.__locks.map(l => l.type + (l.released ? ':released' : '')), btn: (document.querySelector('#lbFull') || {}).textContent || null, pressed: (document.querySelector('#lbFull') || { getAttribute: () => null }).getAttribute('aria-pressed'), op: getComputedStyle(document.querySelector('.lbTools') || document.body).opacity, pe: getComputedStyle(document.querySelector('.lbTools') || document.body).pointerEvents }));
  { const s = await fsNow(); check(s.btn === 'Full screen' && s.pressed === 'false' && !s.fs && !s.locks.length, 'the board has a Full screen button; nothing is asked of the browser until it is pressed'); }
  await p.click('#lbFull'); await p.waitForTimeout(500);
  { const s = await fsNow(); check(s.fs && /\blbFull\b/.test(s.body), 'pressed: the page fills the screen (the browser\'s bars are gone)');
    check(s.locks.join() === 'screen', '…and a screen wake lock is asked for, so the board doesn\'t dim or sleep: ' + s.locks.join());
    check(s.btn === 'Exit full screen' && s.pressed === 'true', '…the button now reads "Exit full screen"'); }
  { const P = await pies(); check(Math.min(...P.cards.map(c => c.d)) > dMin5, 'in full screen the pies take the room the bar gave up: ' + Math.round(Math.min(...P.cards.map(c => c.d))) + ' px across (was ' + Math.round(dMin5) + ')'); }
  await p.mouse.move(8, 8); await p.waitForTimeout(4300);
  { const s = await fsNow(); check(s.op === '0' && s.pe === 'none', 'left alone for a few seconds, the bar fades away (opacity ' + s.op + ')'); }
  await p.evaluate(() => window.__tally.render()); await p.waitForTimeout(500);
  { const s = await fsNow(); check(s.op === '0' && /\blbFull\b/.test(s.body) && s.locks.join() === 'screen', 'a redraw of the board (new data from another computer) leaves it in full screen with the bar away and the one lock'); }
  await p.mouse.move(700, 500); await p.waitForTimeout(500);
  { const s = await fsNow(); check(s.op === '1' && s.pe === 'auto', 'a mouse move or touch brings it back'); }
  await p.click('#lbOpts'); await p.waitForTimeout(4300);
  { const s = await fsNow(); check(s.op === '1', 'while Options is open the bar stays'); }
  await p.click('#lbOpts'); await p.waitForTimeout(200);
  // Chrome lets a wake lock go whenever the tab is hidden; it is asked for again when the board is back in view
  await p.evaluate(async () => { window.__vis = 'hidden'; await window.__locks[0].release(); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(200);
  { const s = await fsNow(); check(s.locks.join() === 'screen:released', 'switching tabs: the browser takes the lock back, and nothing is asked while hidden'); }
  await p.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(300);
  { const s = await fsNow(); check(s.locks.join() === 'screen:released,screen', 'back on the board: the lock is asked for again'); }
  await p.click('#lbFull'); await p.waitForTimeout(500);
  { const s = await fsNow(); check(!s.fs && !/\blbFull\b/.test(s.body) && s.locks.every(l => /released/.test(l)) && s.btn === 'Full screen' && s.op === '1', 'Exit full screen: the browser\'s bars are back, the lock is let go, the bar is in view'); }
  // Esc is the browser's own way out: the page follows it
  await p.click('#lbFull'); await p.waitForTimeout(500); await p.evaluate(() => document.exitFullscreen()); await p.waitForTimeout(400);
  { const s = await fsNow(); check(!s.fs && !/\blbFull\b/.test(s.body) && s.locks.length === 3 && s.locks.every(l => /released/.test(l)) && s.btn === 'Full screen', 'leaving full screen with Esc lets the lock go too'); }
  // a refused lock (battery saver, a policy) still gives full screen
  await p.evaluate(() => { window.__refuse = true; }); await p.click('#lbFull'); await p.waitForTimeout(500);
  { const s = await fsNow(); check(s.fs && /\blbFull\b/.test(s.body) && s.locks.length === 3 && !errs.length, 'if the browser refuses to keep the screen on, full screen still works and nothing breaks'); }
  await p.click('#lbFull'); await p.waitForTimeout(400); await p.evaluate(() => { window.__refuse = false; });
  // the Race has the button too; leaving the board leaves full screen
  await p.click('[data-tab="race"]'); await p.waitForTimeout(500);
  check(await p.locator('#lbFull').count() === 1, 'the Race tab has the Full screen button too');
  await p.click('#lbFull'); await p.waitForTimeout(500); check((await fsNow()).fs, '…and it works there');
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1900);
  { const s = await fsNow(); check(!s.fs && !/\blbFull|lbMode\b/.test(s.body) && s.locks.every(l => /released/.test(l)) && await p.locator('#lb:not(.hidden)').count() === 0, 'Hold to exit leaves the board, full screen and the lock together'); }
  // ---- 4. Compare across both courses -----------------------------------------------------------------------------
  // Two on-level classes in periods none of the five has (a class export for a period Tally has is that period's class):
  // 4th Period, a copy of the on-level fixture under another class code, and 8th Period, two students, too few to draw
  const src = fs.readdirSync('fixtures').find(f => /^f1473588-.*7T3A.*\.xlsx$/.test(f)); const on4 = path.join(tmp, src.replace('7T3A', '7T4A')); fs.copyFileSync(path.resolve('fixtures', src), on4);
  const on8 = path.resolve('fixtures', fs.readdirSync('fixtures').find(f => /^csv_.*7T8A.*\.csv$/.test(f)));
  await p.setInputFiles('#file', [on4, on8]); await p.waitForTimeout(1000); { const sk = await p.$('#rpSkip'); if (sk && await sk.isVisible()) { await sk.click(); await p.waitForTimeout(200); } }
  const K4 = '1205050-7T4A', K8 = '1205050-7T8A';
  const ns = await p.evaluate(() => { const T = window.__tally; const o = {}; T.state.order.forEach(k => { const s = T.state.sections[k]; o[k] = { n: T.population(s).length, prep: s.prep, name: (s.team || s.label).replace(/ · .*/, '') }; }); return o; });
  check(ns[K4] && ns[K4].prep === 'on' && ns[K4].n >= 5 && ns[K8] && ns[K8].prep === 'on' && ns[K8].n < 5, 'two on-level classes: ' + [K4, K8].map(k => ns[k] ? ns[k].name + ' (' + ns[k].n + ')' : k + ' missing').join(', '));
  const accN = Object.values(ns).filter(x => x.prep === 'acc').reduce((a, x) => a + x.n, 0), onN = ns[K4].n + ns[K8].n;
  await p.click('#btnLb'); await p.waitForTimeout(600); await p.click('[data-tab="lab"]'); await p.waitForTimeout(400); await p.click('.lbFocus [data-prep="both"]'); await p.waitForTimeout(500);
  await set({ labKind: 'box', labPick: { acc: 'unit:__all__', on: 'unit:__all__' } });
  const bothOpts = await p.$$eval('#labCmp option', os => os.map(o => [o.value, o.textContent]));
  check(bothOpts.slice(0, 2).map(o => o[1]).join('|') === 'Each course|Each class' && bothOpts.some(o => o[0] === 'vs:p3-acc' && o[1] === '3rd Period vs all on-level') && bothOpts.some(o => o[0] === 'vs:' + K4 && o[1] === ns[K4].name + ' vs all accelerated'), 'Both: each course, each class, or one class beside the whole of the other course');
  check(!(await view()).kinds.includes('corr'), 'IXL and a test is a one-course graph: not offered in Both');
  await choose('#labCmp', 'vs:p3-acc');
  { const v = await view(); check(v.rows.map(r => r.name).join('|') === '3rd Period|All on-level' && v.rows[0].small.startsWith('n = ' + ns['p3-acc'].n) && v.rows[1].small.startsWith('n = ' + onN + ' · ') && v.rows[1].course, '3rd Period vs all on-level: 3rd Period\'s ' + ns['p3-acc'].n + ' beside all ' + onN + ' on-level students (' + v.rows[1].small + ')');
    check(/^3rd Period and all on-level classes, /.test(v.sub), '…said in the subtitle: "' + v.sub.slice(0, 45) + '…"'); }
  await choose('#labCmp', 'vs:' + K4);
  { const v = await view(); check(v.rows.map(r => r.name).join('|') === ns[K4].name + '|All accelerated' && v.rows[1].small.startsWith('n = ' + accN + ' · 5 classes'), ns[K4].name + ' beside all ' + accN + ' accelerated students in 5 classes'); }
  // a class too small to draw keeps its place: first, beside the course it is compared with, and in its course's group
  await choose('#labCmp', 'vs:' + K8);
  { const v = await view(); check(v.rows.map(r => r.name).join('|') === ns[K8].name + '|All accelerated' && /Not enough students yet/.test(v.notYet.join()), ns[K8].name + ' (' + ns[K8].n + ' students) vs all accelerated: the class first, saying it is too few to draw, then the course'); }
  await choose('#labCmp', 'class');
  { const order = await p.$$eval('#lb .labRows > .labGroupHead, #lb .labRows > .labRow', es => es.map(e => e.classList.contains('labGroupHead') ? '[' + e.textContent + ']' : e.querySelector('.labName').firstChild.textContent.trim()));
    check(order.join('|') === ['[Accelerated]', ...NAMES, '[On-level]', ns[K4].name, ns[K8].name].join('|'), 'each class, under its course: ' + order.join(', ')); }
  await choose('#labKind', 'circle');
  { const order = await p.$$eval('#lb .labPies > .labGroupHead, #lb .labPies > .labPie', es => es.map(e => e.classList.contains('labGroupHead') ? '[' + e.textContent + ']' : e.querySelector('.labName').textContent.trim()));
    check(order.join('|') === ['[Accelerated]', ...NAMES, '[On-level]', ns[K4].name, ns[K8].name].join('|'), '…and the pies the same way'); }
  await choose('#labKind', 'box'); await choose('#labCmp', 'course');
  { const v = await view(); check(v.rows.map(r => r.name).join('|') === 'Accelerated|On-level' && v.rows[0].small.startsWith('n = ' + accN) && v.rows[1].small.startsWith('n = ' + onN), 'each course, every student in it: ' + accN + ' and ' + onN); }
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); done();
})().catch(async e => { console.log('FAIL crashed: ' + (e && e.stack || e)); try { if (B) await B.close(); } catch (x) {} process.exitCode = 1; });
