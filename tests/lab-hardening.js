// Hardening the Data Lab for the room (Croix, 4 Nov 2026: "Can you harden it and check for bugs and fringe cases").
// Each section is a case an audit of the five new features found, checked against numbers recounted here:
//   privacy   a whole course of Focus scores, beside its classes, must not give away a class too small to show
//   lock      one screen wake lock per full screen, let go whenever full screen ends, however fast
//   bar       the full-screen bar fades even after Options was left open
//   stuck     a saved Compare choice that no longer fits, or a key from a file, reads as each class
//   board     a Board save: no IXL and a test (its Focus columns are shuffled), and the Compare choice travels
//   saved     the saved Data Lab page draws no dot per student for Focus scores
//   math      tiny units, extra credit, each class's own goal, one assignment out of different totals
//   layout    pies on a phone, a tablet, ten classes by course, and with stats under them
// Synthetic: the scrubbed fixture and copies of it.
const { chromium, fs, path, exe, check, done, pick, more, tmp, APP } = require('./lib');
let B = null;
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const letter = p => p >= 90 ? 'A' : p >= 80 ? 'B' : p >= 70 ? 'C' : p >= 60 ? 'D' : 'F';
const near = (shown, want) => want != null && Math.abs(shown - want) <= 0.5 + 1e-6;
(async () => {
  const b = B = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  // a stand-in screen wake lock that answers after __delay ms, as Chrome's does in a later task
  await p.addInitScript(() => { window.__locks = []; window.__delay = 0;
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async type => { await new Promise(r => setTimeout(r, window.__delay)); const l = { type, released: false, ls: [], addEventListener(e, f) { if (e === 'release') this.ls.push(f); }, async release() { if (this.released) return; this.released = true; this.ls.forEach(f => f()); } }; window.__locks.push(l); return l; } } }); });
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  await p.evaluate(() => { const T = window.__tally; const base = T.state.sections['1205050-7T1A']; base.period = 1; base.label = '1st Period · Accelerated'; base.team = '1st Period';
    const mk = (per, shift, boost) => { const s = JSON.parse(JSON.stringify(base)); s.key = 'p' + per + '-acc'; s.period = per; s.label = per + (per === 2 ? 'nd' : per === 3 ? 'rd' : 'th') + ' Period · Accelerated'; s.team = s.label.replace(/ · .*/, '');
      s.grades.assignments.forEach(a => { if (a.max) a.values = a.values.map((v, i) => v == null ? null : Math.max(0, Math.min(a.max, Math.round((v + shift * ((i * 7 + per) % 5 - 2) / 2) * 2) / 2))); });
      s.scores = s.scores.map(row => Array.isArray(row) ? row.map((v, i) => v == null ? (((i + per) % 6 === 0) ? 70 : null) : Math.max(0, Math.min(100, v + boost * (((i + per) % 3) - 1)))) : row);
      T.state.sections[s.key] = s; T.state.order.push(s.key); };
    mk(2, 3, 12); mk(3, -2, 20); mk(5, 4, -15); mk(6, 1, 8); T.save(); });
  await p.reload(); await p.waitForTimeout(800);
  const T0 = await p.evaluate(() => { const T = window.__tally; const us = T.unitsOf(T.state.sections['1205050-7T1A']); return { u1: 'unit:' + us.find(u => u.num === 1).name, u4: us.find(u => u.num === 4).name }; });
  const set = cfg => p.evaluate(cfg => { const T = window.__tally; Object.assign(T.state.settings, { leaderboard: true, lbTab: 'lab' }, cfg); T.save(); T.render(); }, cfg).then(() => p.waitForTimeout(350));
  const view = () => p.evaluate(() => ({ title: (document.querySelector('#lb .lbTitle') || {}).textContent || '', sub: (document.querySelector('#lb .lbSub') || {}).textContent || '',
    rows: [...document.querySelectorAll('#lb .labRow:not(.one), #lb .labPie')].map(r => ({ name: (r.querySelector('.labName').firstChild || {}).textContent.trim(), small: (r.querySelector('.labName small, .labPieHead small') || {}).textContent || '', chips: [...r.querySelectorAll('.labPieKey span')].map(s => s.textContent.trim()), note: (r.querySelector('.labNotYet') || {}).textContent || '', thin: r.classList.contains('thin') })),
    kinds: [...document.querySelectorAll('#labKind option')].map(o => o.value), cmp: (document.querySelector('#labCmp') || {}).value || null, notYet: [...document.querySelectorAll('#lb .labNotYet')].map(e => e.textContent) }));
  const lines = () => p.evaluate(() => { const svg = document.querySelector('#lb .labRow.one .chart'); if (!svg) return null; const pts = {}; const vb = svg.viewBox.baseVal;
    svg.querySelectorAll('circle').forEach(c => { const m = /^(.+?) · (.+?): (\d+)%/.exec((c.querySelector('title') || {}).textContent || ''); if (m) (pts[m[1]] = pts[m[1]] || []).push({ at: m[2], v: +m[3], cy: +c.getAttribute('cy') }); });
    return { pts, ticks: [...svg.querySelectorAll('text.tl')].map(t => t.textContent), h: vb.height }; });
  await p.click('#btnLb'); await p.waitForTimeout(600); await p.click('[data-tab="lab"]'); await p.waitForTimeout(400);

  // ---- privacy: one make-up score in 5th Period --------------------------------------------------------------------
  // 5th Period has one score on the Unit 1 Assessment (the rest not taken yet). Shown on its own it is too few (needs
  // 5); a course row that counted it would give it away: its letter is the course's count minus the classes' counts.
  await p.evaluate(() => { const T = window.__tally; const a = T.state.sections['p5-acc'].grades.assignments.find(a => a.name === 'Unit 1 Assessment'); window.__keep5 = JSON.parse(JSON.stringify(a)); const j = a.values.findIndex(v => v != null); a.values = a.values.map((v, i) => i === j ? 2 : null); if (a.status) a.status = a.status.map((st, i) => i === j ? 'score' : 'blank'); a.missing = 0; T.save(); });
  const gbPts = await p.evaluate(() => { const T = window.__tally; const o = {}; T.state.order.forEach(k => { const s = T.state.sections[k]; const a = s.grades.assignments.find(a => a.name === 'Unit 1 Assessment'); o[(s.team || s.label).replace(/ · .*/, '')] = a.values.filter(v => v != null); }); return o; });
  const gbMax = await p.evaluate(() => window.__tally.state.sections['1205050-7T1A'].grades.assignments.find(a => a.name === 'Unit 1 Assessment').max);
  const shownPts = Object.entries(gbPts).filter(([, v]) => v.length >= 5); const shownN = shownPts.map(([k, v]) => [k, v.map(x => Math.round(x / gbMax * 100))]);
  const lettersOf = arr => ['A', 'B', 'C', 'D', 'F'].map(L => L + ': ' + arr.filter(v => letter(v) === L).length);
  await set({ labPrep: 'acc', labUnit: 'gb:Unit 1 Assessment', labKind: 'circle', labCmp: { acc: 'class', on: 'class' } });
  { const v = await view(); const r5 = v.rows.find(r => r.name === '5th Period'); check(r5 && r5.thin && /n = 1/.test(r5.small) && /Not enough students yet/.test(r5.note), 'each class: 5th Period\'s one score is too few to show (n = 1)'); }
  await set({ labCmp: { acc: 'pool', on: 'class' } });
  { const v = await view(); const want = shownN.flatMap(([, v]) => v); const r = v.rows[0];
    check(v.rows.length === 1 && r.name === 'All accelerated' && r.small.startsWith('n = ' + want.length + ' · 4 classes'), 'all accelerated together counts the four classes shown on their own: ' + r.small + ' (5th Period\'s one score left out)');
    check(JSON.stringify(r.chips) === JSON.stringify(lettersOf(want)), '…so its letters are exactly the four classes\' letters added up: ' + r.chips.join(', ')); }
  await set({ labCmp: { acc: 'vs:p5-acc', on: 'class' } });
  { const v = await view(); check(v.rows.map(r => r.name).join('|') === '5th Period|All accelerated' && v.rows[0].thin && v.rows[1].small.startsWith('n = ' + shownN.reduce((a, [, x]) => a + x.length, 0)), '5th Period vs all accelerated: the class too few to show, and a course that leaves its score out'); }
  await set({ labKind: 'box', labStats: 1 });
  { const mins = await p.evaluate(() => [...document.querySelectorAll('#lb .labRow')].map(r => [...r.querySelectorAll('.labStats div')].find(d => /^min/.test(d.textContent))).filter(Boolean).map(d => d.querySelector('b').textContent));
    const want = Math.min(...shownPts.flatMap(([, v]) => v)); check(mins.length === 1 && Number(mins[0]) === want && want !== 2, 'Show stats beside 5th Period: the course\'s minimum is ' + mins.join() + ', the four classes\' own (5th Period\'s 2 points is nowhere)'); }
  await p.evaluate(() => { const T = window.__tally; const s = T.state.sections['p5-acc']; const i = s.grades.assignments.findIndex(a => a.name === 'Unit 1 Assessment'); s.grades.assignments[i] = window.__keep5; T.save(); });
  await set({ labStats: 0 });

  // ---- privacy: a Focus line over time ---------------------------------------------------------------------------
  // An older import where 2nd Period had only two scores on the Unit 1 Assessment: no point for 2nd Period that day,
  // and the course's point that day leaves 2nd Period out.
  const gh = await p.evaluate(() => { const T = window.__tally; const out = {}; T.state.order.forEach(k => { const s = T.state.sections[k]; const h = s.gradeHistory[s.gradeHistory.length - 1]; const old = JSON.parse(JSON.stringify(h)); const d = new Date(h.date + 'T12:00:00'); d.setDate(d.getDate() - 7); old.date = d.toISOString().slice(0, 10);
      old.assignments.forEach(a => { if (a.name === 'Unit 1 Assessment') { a.avg = 40 + s.period * 3; a.n = k === 'p2-acc' ? 2 : 12 + s.period; } }); s.gradeHistory.unshift(old);
      out[(s.team || s.label).replace(/ · .*/, '')] = s.gradeHistory.map(z => { const a = z.assignments.find(a => a.name === 'Unit 1 Assessment'); return { date: z.date, avg: a ? a.avg : null, n: a ? (Number.isInteger(a.n) ? a.n : z.students.length - (a.missing || 0)) : 0 }; }); }); T.save(); return out; });
  await set({ labKind: 'line', labCmp: { acc: 'class', on: 'class' } });
  { const L = await lines(); const d0 = gh['1st Period'][0].date;
    check(L && L.pts['2nd Period'] && L.pts['2nd Period'].length === 1 && L.pts['1st Period'].length === 2, 'a class\'s point on a Focus line needs 5 or more scores: 2nd Period, with 2 that day, has no point there');
    await set({ labCmp: { acc: 'pool', on: 'class' } }); const P = await lines();
    const w = Object.entries(gh).filter(([, a]) => a[0].n >= 5); const want0 = w.reduce((a, [, x]) => a + x[0].avg * x[0].n, 0) / w.reduce((a, [, x]) => a + x[0].n, 0);
    check(P && P.pts['All accelerated'] && near(P.pts['All accelerated'][0].v, want0), 'the course\'s point that day is the other four classes\' average, by how many scores each has: ' + (P && P.pts['All accelerated'] ? P.pts['All accelerated'][0].v : '?') + '% (recount ' + want0.toFixed(1) + ')'); }
  const hasN = await p.evaluate(() => { const T = window.__tally; const s = T.state.sections['1205050-7T1A']; const h = s.gradeHistory[s.gradeHistory.length - 1]; return h.assignments.every(a => Number.isInteger(a.n)) && h.assignments.find(a => a.name === 'Unit 1 Assessment').n === s.grades.assignments.find(a => a.name === 'Unit 1 Assessment').values.filter(v => v != null).length; });
  check(hasN, 'a gradebook import now keeps how many scores each assignment\'s average is of');

  // ---- the lock: one per full screen, let go however fast it ends ---------------------------------------------------
  await set({ labKind: 'circle', labUnit: T0.u1, labCmp: { acc: 'class', on: 'class' } });
  const locks = () => p.evaluate(() => ({ held: window.__locks.filter(l => !l.released).length, all: window.__locks.length, fs: !!document.fullscreenElement }));
  await p.evaluate(() => { window.__delay = 120; }); await p.click('#lbFull');
  await p.evaluate(() => { window.__tally.render(); window.__tally.render(); }); await p.waitForTimeout(600);
  { const s = await locks(); check(s.fs && s.held === 1 && s.all === 1, 'Chrome answering in its own time: one press asks once, even with the board redrawn while it answers (' + s.all + ' asked, ' + s.held + ' held)'); }
  await p.click('#lbFull'); await p.waitForTimeout(300);
  { const s = await locks(); check(!s.fs && s.held === 0, 'Exit full screen lets it go'); }
  await p.evaluate(() => { window.__delay = 400; }); await p.click('#lbFull'); await p.waitForTimeout(60); await p.evaluate(() => document.exitFullscreen()); await p.waitForTimeout(800);
  { const s = await locks(); check(!s.fs && s.held === 0 && s.all === 2, 'leaving full screen before Chrome answered: the lock that arrives late is let go at once (' + s.held + ' held)'); }
  await p.evaluate(() => { window.__delay = 0; });

  // ---- the bar: fades even after Options was left open ---------------------------------------------------------------
  await p.click('#lbFull'); await p.waitForTimeout(300); await p.click('#lbOpts'); await p.waitForTimeout(150);
  await p.selectOption('#labKind', 'corr'); await p.waitForTimeout(300); await p.mouse.move(9, 9); await p.waitForTimeout(4300);
  { const op = await p.evaluate(() => getComputedStyle(document.querySelector('.lbTools')).opacity); check(op === '0' && await p.locator('#lbOpts').count() === 0, 'Options open, then IXL and a test (which has no Options): the bar still fades (opacity ' + op + ')'); }
  await p.mouse.move(600, 500); await p.waitForTimeout(400); await p.selectOption('#labKind', 'circle'); await p.waitForTimeout(300); await p.click('#lbOpts'); await p.waitForTimeout(150);
  await p.click('[data-tab="race"]'); await p.waitForTimeout(300); await p.mouse.move(9, 9); await p.waitForTimeout(4300);
  { const op = await p.evaluate(() => getComputedStyle(document.querySelector('.lbTools')).opacity); check(op === '0', '…and on the Race, after leaving the Data Lab with Options open'); }
  await p.evaluate(() => document.exitFullscreen()); await p.waitForTimeout(300); await p.click('[data-tab="lab"]'); await p.waitForTimeout(300);

  // ---- stuck choices -----------------------------------------------------------------------------------------------
  // the class picked has nothing for the data set: an empty row in its place, under a subtitle that names it
  await p.evaluate(() => { const T = window.__tally; const g = T.state.sections['p6-acc'].grades; window.__a6 = g.assignments.find(a => a.name === 'Squares and Cubes Quiz'); g.assignments = g.assignments.filter(a => a !== window.__a6); T.save(); });
  await set({ labUnit: 'gb:Squares and Cubes Quiz', labKind: 'box', labCmp: { acc: 'vs:p6-acc', on: 'class' } });
  { const v = await view(); check(v.rows.map(r => r.name).join('|') === '6th Period|All accelerated' && v.rows[0].thin && /No scores for this yet/.test(v.rows[0].note) && /^6th Period and all accelerated classes, /.test(v.sub), '6th Period has no Squares and Cubes Quiz: its row says so, beside the course, under "' + v.sub.slice(0, 40) + '…"'); }
  await set({ labKind: 'avg' });
  { const v = await view(); check(v.notYet.some(t => /6th Period: no scores for this yet/.test(t)), 'class averages say the same'); }
  await set({ labKind: 'circle' });
  { const v = await view(); check(v.rows[0].name === '6th Period' && /No scores for this yet/.test(v.rows[0].note), '…and so does its pie\'s place'); }
  await set({ labKind: 'line' });
  { const v = await view(); check(v.notYet.some(t => /6th Period: no scores for this yet/.test(t)), '…and the line graph, under the course\'s line'); }
  await p.evaluate(() => { const T = window.__tally; T.state.sections['p6-acc'].grades.assignments.push(window.__a6); T.save(); });
  // a key from a file that names no class, or the object prototype, is each class; a renamed file's key is kept
  for (const bad of ['vs:__proto__', 'vs:constructor', 'vs:toString']) { await set({ labCmp: { acc: bad, on: 'class' }, labRows: bad, labKind: 'box' }); await p.reload(); await p.waitForTimeout(700);
    const v = await view(); check(!errs.length && v.cmp === 'class' && v.rows.length === 5, JSON.stringify(bad) + ' from a file: no error, each class'); }
  await p.evaluate(() => { const T = window.__tally; const s = JSON.parse(JSON.stringify(T.state.sections['p6-acc'])); s.key = 'Accel 7 Period 6 (renamed).v2'; T.state.sections[s.key] = s; T.state.order = T.state.order.map(k => k === 'p6-acc' ? s.key : k); delete T.state.sections['p6-acc']; T.state.settings.labCmp = { acc: 'vs:' + s.key, on: 'class' }; T.save(); });
  await p.reload(); await p.waitForTimeout(800);
  { const v = await view(); check(v.cmp === 'vs:Accel 7 Period 6 (renamed).v2' && v.rows.map(r => r.name).join('|') === '6th Period|All accelerated', 'a class keyed by a renamed file (spaces, dots, brackets) stays picked after a reload'); }
  // one class left: its saved "vs" can't stick (the menu is gone)
  const keep = await p.evaluate(() => JSON.stringify(window.__tally.state));
  await p.evaluate(() => { const T = window.__tally; const k = 'p2-acc'; T.state.order = [k]; Object.keys(T.state.sections).forEach(x => { if (x !== k) delete T.state.sections[x]; }); T.state.settings.labCmp = { acc: 'vs:p2-acc', on: 'class' }; T.save(); });
  await p.reload(); await p.waitForTimeout(800);
  { const v = await view(); check(v.cmp === null && v.rows.length === 1 && v.rows[0].name === '2nd Period' && !/all accelerated/i.test(v.sub), 'one class left: one row for it, no "vs all accelerated" with no menu to undo it'); }
  await p.evaluate(keep => { const T = window.__tally; const st = JSON.parse(keep); T.state.order = st.order; T.state.sections = st.sections; T.state.settings.labCmp = { acc: 'class', on: 'class' }; T.save(); }, keep); await p.reload(); await p.waitForTimeout(800);
  check((await view()).rows.length === 5, '(five classes back)');

  // ---- a Board save ---------------------------------------------------------------------------------------------------
  await set({ labUnit: T0.u1, labKind: 'corr', labCmp: { acc: 'vs:p3-acc', on: 'class' } });
  const bf = await p.evaluate(() => window.__tally.boardFile()); const bpath = path.join(tmp, 'board-' + Date.now() + '.json'); fs.writeFileSync(bpath, JSON.stringify(bf));
  check(bf.state.settings.labCmp && bf.state.settings.labCmp.acc === 'vs:p3-acc', 'the Board save carries the Compare choice');
  { const ctx2 = await b.newContext({ viewport: { width: 1920, height: 1080 } }); const q = await ctx2.newPage(); q.on('pageerror', e => errs.push('board: ' + e.message)); q.on('dialog', d => d.accept());
    await q.goto('file://' + path.resolve(APP)); await q.waitForTimeout(400); await q.setInputFiles('#file', [bpath]); await q.waitForTimeout(900);
    const st = await q.evaluate(() => { if (!document.querySelector('[data-tab="lab"].on')) document.querySelector('[data-tab="lab"]').click(); return 1; }); await q.waitForTimeout(400);
    const bv = await q.evaluate(() => ({ board: !!window.__tally.state.board, kinds: [...document.querySelectorAll('#labKind option')].map(o => o.value), title: (document.querySelector('#lb .lbTitle') || {}).textContent || '', box: document.querySelectorAll('#lb .labBox').length, cmp: (document.querySelector('#labCmp') || {}).value, sub: (document.querySelector('#lb .lbSub') || {}).textContent || '' }));
    check(bv.board && !bv.kinds.includes('corr'), 'a Board save offers no IXL and a test: its Focus columns are shuffled one by one, so no student\'s IXL can be set beside their test');
    check(bv.box > 0 && !/IXL and/.test(bv.title), '…a saved "IXL and a test" opens as a box plot instead of a false "no student has both"');
    check(bv.cmp === 'vs:p3-acc' && /^3rd Period and all accelerated classes/.test(bv.sub), '…and the Compare choice is the one he left: ' + bv.sub.slice(0, 45));
    await ctx2.close(); }

  // ---- the saved Data Lab page --------------------------------------------------------------------------------------
  const onSrc = fs.readdirSync('fixtures').find(f => /^f1473588-.*7T3A.*\.xlsx$/.test(f)); const ons = ['7T4A', '7T7A', '7T8A', '7T9A'].map(c => { const d = path.join(tmp, onSrc.replace('7T3A', c)); fs.copyFileSync(path.resolve('fixtures', onSrc), d); return d; });
  await set({ leaderboard: false }); await p.setInputFiles('#file', ons); await p.waitForTimeout(1500); { const sk = await p.$('#rpSkip'); if (sk && await sk.isVisible()) { await sk.click(); await p.waitForTimeout(200); } }
  await p.evaluate(u => { const T = window.__tally; Object.assign(T.state.settings, { leaderboard: false, labPrep: 'both', labRows: 'class', labUnit: u, labKind: 'box', labPick: { acc: 'gb:Unit 1 Assessment' }, labDots: {} }); T.save(); T.render(); }, T0.u1); await p.waitForTimeout(400);   // the single-course pick an IXL unit, the accelerated side a Focus assignment
  await more(p, '#btnSettings'); await p.waitForTimeout(300); await seeTab(p, '#saveLab');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#saveLab')]); const sp = path.join(tmp, 'lab-' + Date.now() + '.html'); await dl.saveAs(sp); const html = fs.readFileSync(sp, 'utf8');
  check(/Unit 1 Assessment/.test(html) && (html.match(/class="labDot"/g) || []).length === 0 && (html.match(/class="labBox"/g) || []).length >= 5, 'the saved Data Lab page, Both by class with a Focus assignment on one side: box plots, and no dot per student (' + (html.match(/class="labDot"/g) || []).length + ' dots)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);

  // ---- layout: ten classes by course, stats under the pies -----------------------------------------------------------
  const fits = () => p.evaluate(() => { const cards = [...document.querySelectorAll('#lb .labPie')]; const top = document.querySelector('.lbTools').getBoundingClientRect().top; const ring = c => { const r = c.querySelector('.labPieArt svg circle'); return r ? r.getBoundingClientRect().width : 0; };
    return { n: cards.length, bottom: Math.max(...cards.map(c => c.getBoundingClientRect().bottom)), top, d: Math.min(...cards.filter(c => !c.classList.contains('thin')).map(ring)), cols: getComputedStyle(document.querySelector('#lb .labPies')).gridTemplateColumns.split(' ').length, keyBelow: cards.every(c => { const a = c.querySelector('.labPieArt'), k = c.querySelector('.labPieKey'); return !a || !k || k.getBoundingClientRect().top >= a.getBoundingClientRect().bottom - 1; }) }; });
  { const pickOn = await p.evaluate(() => { const T = window.__tally; const s = T.state.order.map(k => T.state.sections[k]).find(s => s.prep === 'on'); return 'unit:' + T.unitsOf(s).find(u => u.num === 1).name; });
    await set({ labPrep: 'both', labRows: 'class', labKind: 'circle', labPick: { acc: T0.u1, on: pickOn }, labStats: 0 }); }
  { const f = await fits(); check(f.n === 9 && f.bottom <= f.top + 1 && f.d >= 110 && f.keyBelow, 'Both by class, nine classes in two courses: every pie fits above the bar (' + Math.round(f.bottom) + ' ≤ ' + Math.round(f.top) + '), each ' + Math.round(f.d) + ' px across, ' + f.cols + ' across'); }
  await set({ labPrep: 'acc', labStats: 1, labCmp: { acc: 'class', on: 'class' } });
  { const f = await fits(); check(f.n === 5 && f.bottom <= f.top + 1, 'five pies with Show stats under each still fit above the bar (' + Math.round(f.bottom) + ' ≤ ' + Math.round(f.top) + ')'); }
  await set({ labStats: 0 });
  await p.setViewportSize({ width: 1024, height: 768 }); await p.waitForTimeout(500);
  { const f = await fits(); check(f.cols === 3 && f.d >= 90 && f.bottom <= f.top + 1, 'a tablet on its side (1024×768): three across as on the board, each ' + Math.round(f.d) + ' px, above the bar'); }
  await p.setViewportSize({ width: 820, height: 1180 }); await p.waitForTimeout(500);
  { const f = await fits(); check(f.cols === 2 && f.d >= 120 && f.bottom <= f.top + 1, 'a tablet on its end (820×1180): two across, each ' + Math.round(f.d) + ' px, above the bar'); }
  const ph = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); const q = await ph.newPage(); q.on('pageerror', e => errs.push('phone: ' + e.message));
  await q.goto('file://' + path.resolve(APP)); await q.evaluate(s => { localStorage.setItem('tally.v1', s); }, await p.evaluate(() => localStorage.getItem('tally.v1'))); await q.reload(); await q.waitForTimeout(900);
  await q.evaluate(() => { const T = window.__tally; Object.assign(T.state.settings, { leaderboard: true, lbTab: 'lab', labPrep: 'acc', labKind: 'circle' }); T.render(); }); await q.waitForTimeout(500);
  { const f = await q.evaluate(() => { const cards = [...document.querySelectorAll('#lb .labPie')]; const ring = c => { const r = c.querySelector('.labPieArt svg circle'); return r ? r.getBoundingClientRect().width : 0; };
      return { n: cards.length, d: Math.min(...cards.map(ring)), cols: getComputedStyle(document.querySelector('#lb .labPies')).gridTemplateColumns.split(' ').length, keyBelow: cards.every(c => c.querySelector('.labPieKey').getBoundingClientRect().top >= c.querySelector('.labPieArt').getBoundingClientRect().bottom - 1), wide: document.documentElement.scrollWidth <= innerWidth + 1 }; });
    check(f.n === 5 && f.cols === 1 && f.d >= 180 && f.keyBelow && f.wide, 'on a phone: one pie across, ' + Math.round(f.d) + ' px wide, its counts under it, nothing wider than the screen'); }
  await ph.close(); await p.setViewportSize({ width: 1920, height: 1080 }); await p.waitForTimeout(300);

  // ---- math ------------------------------------------------------------------------------------------------------------
  // each class's own goal: 2nd Period's goal is 90, the rest 80
  const sk = await p.evaluate(u1 => { const T = window.__tally; T.state.sections['p2-acc'].threshold = 90; T.save(); const s0 = T.state.sections['1205050-7T1A']; const u = T.unitsOf(s0).find(u => 'unit:' + u.name === u1); const k = u.idx[2]; const key = T.skillKey(s0.skills[k]);
    const per = {}; T.state.order.map(x => T.state.sections[x]).filter(s => s.prep === 'acc').forEach(s => { const kk = s.skills.findIndex(z => T.skillKey(z) === key); const v = T.population(s).map(x => T.eff(s, kk, x.i)).filter(v => v != null); per[(s.team || s.label).replace(/ · .*/, '')] = { at: v.filter(x => x >= s.threshold).length, n: v.length }; }); return { id: 'skill:' + key, per }; }, T0.u1);
  await set({ labPrep: 'acc', labUnit: sk.id, labKind: 'circle', labCmp: { acc: 'vs:p2-acc', on: 'class' } });
  { const v = await view(); const key = await p.$$eval('#lb .labPieLegend span', s => s.map(x => x.textContent.trim())); const want = Object.values(sk.per).reduce((a, x) => a + x.at, 0);
    check(v.rows[0].chips[0] === 'At goal: ' + sk.per['2nd Period'].at && v.rows[1].chips[0] === 'At goal: ' + want, 'a skill\'s pie counts at goal by each class\'s own goal: 2nd Period (goal 90) ' + sk.per['2nd Period'].at + ', the course ' + want + ' (recount, each class by its goal)');
    check(key[0] === "At goal (each class's goal)", 'the key doesn\'t name one goal when the classes differ: "' + key[0] + '"'); }
  await p.evaluate(() => { const T = window.__tally; T.state.sections['p2-acc'].threshold = 80; T.save(); });
  // one assignment out of different totals: 5th Period's Squares and Cubes Quiz is out of 30, the rest out of 27
  await p.evaluate(() => { const T = window.__tally; const a = T.state.sections['p5-acc'].grades.assignments.find(a => a.name === 'Squares and Cubes Quiz'); a.max = 30; T.save(); });
  await set({ labUnit: 'gb:Squares and Cubes Quiz', labKind: 'box', labCmp: { acc: 'pool', on: 'class' }, labPct: false });
  { const v = await view(); const box = await p.$eval('#lb .labBox title', t => t.textContent); const want = await p.evaluate(() => { const T = window.__tally; return T.state.order.map(k => T.state.sections[k]).filter(s => s.prep === 'acc').flatMap(s => { const a = s.grades.assignments.find(a => a.name === 'Squares and Cubes Quiz'); return a.values.filter(v => v != null).map(v => Math.round(v / a.max * 100)); }).sort((x, y) => x - y); });
    const med = a => { const n = a.length, h = Math.floor(n / 2); return n % 2 ? a[h] : (a[h - 1] + a[h]) / 2; }; const m = med(want);
    check(/percent of points out of/.test(v.sub) && box.includes(`median ${Number.isInteger(m) ? m : m.toFixed(1)}%`), 'the same quiz out of 27 and out of 30: the course is pooled in percent of each class\'s total, median ' + m + '% (' + v.sub.slice(0, 60) + '…)'); }
  await p.evaluate(() => { const T = window.__tally; const a = T.state.sections['p5-acc'].grades.assignments.find(a => a.name === 'Squares and Cubes Quiz'); a.max = 27; T.save(); });
  // a unit of two skills: three ranges, 0, 1 and 2 (every other skill of Unit 4 skipped)
  await p.evaluate(u4 => { const T = window.__tally; T.state.order.map(k => T.state.sections[k]).filter(s => s.prep === 'acc').forEach(s => { const u = T.unitsOf(s).find(u => u.name === u4); u.idx.slice(2).forEach(k => { s.excluded[T.skillKey(s.skills[k])] = true; }); }); T.save(); }, T0.u4);
  await set({ labKind: 'corr', labCmp: { acc: 'pool', on: 'class' }, labCorr: { acc: { x: 'unit:' + T0.u4, y: 'grade:course' }, on: {} } });
  { const L = await lines(); const v = await view(); const nb = L ? L.ticks.filter(t => !/%$/.test(t)) : []; check((L && nb.join(',') === '0,1,2') || (!L && v.notYet.some(t => /Not enough students/.test(t))), 'a unit of two skills is three ranges, 0, 1 and 2, not "0, 1, 1, 2": ' + (L ? nb.join(', ') : v.notYet.join(' '))); }
  await p.evaluate(u4 => { const T = window.__tally; T.state.order.map(k => T.state.sections[k]).forEach(s => { Object.keys(s.excluded).forEach(k => delete s.excluded[k]); }); T.save(); }, T0.u4);
  // extra credit: the Unit 1 Assessment over its total for most students: the axis rises to meet the average
  await p.evaluate(() => { const T = window.__tally; T.state.order.map(k => T.state.sections[k]).filter(s => s.prep === 'acc').forEach(s => { const a = s.grades.assignments.find(a => a.name === 'Unit 1 Assessment'); a.values = a.values.map(v => v == null ? null : a.max + 3); }); T.save(); });
  await set({ labCorr: { acc: { x: T0.u1, y: 'gb:Unit 1 Assessment' }, on: {} } });
  { const L = await lines(); const tops = L ? L.ticks.filter(t => /%$/.test(t)).map(t => parseInt(t, 10)) : []; const vals = L ? Object.values(L.pts).flat() : [];
    check(L && vals.length && vals.every(pt => pt.v > 100 && pt.cy >= 0) && Math.max(...tops) >= Math.max(...vals.map(x => x.v)), 'extra credit: every range averages ' + (vals[0] || {}).v + '%, and the axis runs to ' + Math.max(...tops) + '% so the line is on the chart'); }
  await p.evaluate(() => { const T = window.__tally; T.state.order.map(k => T.state.sections[k]).filter(s => s.prep === 'acc').forEach(s => { const a = s.grades.assignments.find(a => a.name === 'Unit 1 Assessment'); a.values = a.values.map(v => v == null ? null : a.max - 3); }); T.save(); });

  // ---- no gradebook in Tally: one plain group of units -------------------------------------------------------------------
  { const c3 = await b.newContext({ viewport: { width: 1400, height: 900 } }); const r = await c3.newPage(); r.on('pageerror', e => errs.push('plain: ' + e.message)); r.on('dialog', d => d.accept());
    await r.goto('file://' + path.resolve(APP)); await r.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await r.waitForTimeout(600); const rp = await r.$('#rpSkip'); if (rp && await rp.isVisible()) await rp.click();
    await r.evaluate(() => { const T = window.__tally; Object.assign(T.state.settings, { leaderboard: true, lbTab: 'lab', labPrep: 'acc', labKind: 'box' }); T.render(); }); await r.waitForTimeout(400);
    const g = await r.$$eval('#labUnit optgroup', gs => gs.map(x => x.label)); check(g[0] === 'IXL units (points)' && !g.some(x => /not in Focus/.test(x)), 'with no gradebook in Tally the units are one plain group, none "not in Focus yet": ' + g.slice(0, 2).join(' | '));
    await c3.close(); }
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); done();
})().catch(async e => { console.log('FAIL crashed: ' + (e && e.stack || e)); try { if (B) await B.close(); } catch (x) {} process.exitCode = 1; });
