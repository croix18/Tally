// 15 Nov 2026 audit, seating engine (SEA-*): regression checks for the fixes. Synthetic data on the scrubbed fixtures.
const { chromium, fs, path, exe, check, done, pick, tmp, APP } = require('./lib');
const K = '1205050-7T1A';
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'America/New_York' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const room = (n, cols) => p.evaluate(([n, cols]) => { const T = window.__tally; const desks = []; for (let i = 0; i < n; i++) desks.push({ id: 'd' + i, x: 40 + (i % cols) * 94, y: 40 + Math.floor(i / cols) * 110, r: 0 }); T.state.room = { w: 1200, h: 900, front: 'top', desks, teacher: { x: 1000, y: 780, w: 130, h: 64 }, door: null }; }, [n, cols]);
  await room(30, 6);

  // SEA-04: room Undo keeps a chart saved after the room edit, and seats again only the students whose desks come back
  const r04 = await p.evaluate(K => { const A = window.__all, T = window.__tally, sec = T.state.sections[K]; const ids = A.seatStudents(sec).map(s => s.id);
    delete sec.seating; for (const k in A.seatWork) delete A.seatWork[k]; A.roomUndo.length = 0;
    A.roomPush(); T.state.room.desks.push({ id: 'dX', x: 900, y: 600, r: 0 });   /* + Desk */
    sec.seating = { seats: { d0: ids[0], d1: ids[1] }, locks: {}, savedAt: '2026-11-15T15:00:00.000Z' };   /* saved after the edit */
    A.roomUndoPop(); const a = { desks: T.state.room.desks.length, seats: sec.seating ? Object.keys(sec.seating.seats).length : null };
    /* a chart saved before a desk delete: the undo brings the desk and its student back, and an unchanged chart is restored whole */
    sec.seating = { seats: { d0: ids[0], d1: ids[1], d2: ids[2] }, locks: { [ids[2]]: true }, savedAt: '2026-11-15T15:00:00.000Z' }; delete A.seatWork[K];
    A.roomPush(); T.state.room.desks = T.state.room.desks.filter(d => d.id !== 'd2'); A.roomDropDesks(new Set(T.state.room.desks.map(d => d.id)));
    sec.seating = { ...sec.seating, seats: { ...sec.seating.seats, d3: ids[3] }, savedAt: '2026-11-15T16:00:00.000Z' };   /* saved again after the delete */
    A.roomUndoPop(); const s = sec.seating.seats; const c = { d2: s.d2 === ids[2], d3: s.d3 === ids[3], lock: !!sec.seating.locks[ids[2]], n: Object.keys(s).length };
    A.roomPush(); T.state.room.desks.push({ id: 'dY', x: 900, y: 700, r: 0 }); A.roomUndoPop(); const same = Object.keys(sec.seating.seats).length;
    delete sec.seating; return { a, c, same }; }, K);
  check(r04.a.desks === 30 && r04.a.seats === 2, `SEA-04 room Undo takes the desk back and keeps the chart saved after the room edit (${JSON.stringify(r04.a)})`);
  check(r04.c.d2 && r04.c.d3 && r04.c.lock && r04.c.n === 4, `SEA-04 room Undo of a desk delete seats its student again and keeps the later save (${JSON.stringify(r04.c)})`);
  check(r04.same === 4, 'SEA-04 room Undo with no save since the edit restores the chart as before');

  // SEA-02: no fit number while anyone is without a seat; more students than desks is never fit 100
  await p.evaluate(K => { const T = window.__tally; T.state.active = K; T.save(); }, K);
  await p.click('[data-k="' + K + '"]').catch(() => {}); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(400);
  await p.click('#seatHand'); await p.waitForTimeout(400);
  const f02 = await p.evaluate(() => ({ n: document.querySelector('.fit .n').textContent, hint: document.querySelector('.fit .ghint').textContent }));
  check(f02.n === '–' && /^\d+ without a seat: the fit shows once everyone has a desk/.test(f02.hint), `SEA-02 an empty hand chart shows no fit number, only how many are without a seat (${f02.n} / ${f02.hint.slice(0, 60)})`);
  const c02 = await p.evaluate(K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const stu = A.seatStudents(s); const keep = T.state.room.desks; T.state.room.desks = keep.slice(0, stu.length - 3); const G = A.geometry();
    const seats = {}; G.ds.forEach((d, i) => seats[d.id] = stu[i].id); const fit = A.scoreSeats(s, seats, stu, G, A.buildModel(s, stu, G)).fit; T.state.room.desks = keep; return fit; }, K);
  check(c02 !== 100, `SEA-02 a chart with 3 students more than desks is not fit 100 (got ${c02})`);
  await p.click('#seatRevert').catch(() => {}); await p.waitForTimeout(200);
  await p.evaluate(K => { delete window.__all.seatWork[K]; }, K);

  // Round 2. SEA-04: room Undo never puts a working copy back wholesale: unsaved hand seating survives, desks the undo removes are freed, a Clear every desk comes back with its seats
  const r2u = await p.evaluate(K => { const A = window.__all, T = window.__tally, sec = T.state.sections[K]; const ids = A.seatStudents(sec).map(s => s.id); delete sec.seating; for (const k in A.seatWork) delete A.seatWork[k]; A.roomUndo.length = 0;
    A.roomPush(); T.state.room.desks.push({ id: 'dZ', x: 900, y: 600, r: 0 });
    A.seatWork[K] = { seats: { d0: ids[0], d1: ids[1], dZ: ids[2] }, locks: { [ids[0]]: true }, source: 'hand', dirty: true, undo: [] };   /* hand seating after the edit, not saved */
    A.roomUndoPop(); const w = A.seatWork[K]; const hand = { kept: !!w && w.seats.d0 === ids[0] && w.seats.d1 === ids[1] && !!w.locks[ids[0]], ghost: !!w && 'dZ' in w.seats, desks: T.state.room.desks.length };
    sec.seating = { seats: { d0: ids[0], d1: ids[1] }, locks: { [ids[1]]: true }, savedAt: '2026-11-15T15:00:00.000Z' }; delete A.seatWork[K]; A.workFor(sec);
    A.roomPush(); const keep = T.state.room.desks; T.state.room.desks = []; A.roomDropDesks(new Set()); const cleared = Object.keys(sec.seating.seats).length;
    A.roomUndoPop(); const back = { cleared, desks: T.state.room.desks.length === keep.length, saved: sec.seating.seats.d0 === ids[0] && sec.seating.seats.d1 === ids[1] && !!sec.seating.locks[ids[1]], work: A.seatWork[K].seats.d1 === ids[1] && !!A.seatWork[K].locks[ids[1]] };
    delete sec.seating; delete A.seatWork[K]; return { hand, back }; }, K);
  check(r2u.hand.kept && !r2u.hand.ghost && r2u.hand.desks === 30, `SEA-04 room Undo keeps unsaved hand seating and its locks, and frees only the seat on the desk it takes away (${JSON.stringify(r2u.hand)})`);
  check(r2u.back.cleared === 0 && r2u.back.desks && r2u.back.saved && r2u.back.work, `SEA-04 Undo after "Clear every desk" brings back the desks, the seats and the locks (${JSON.stringify(r2u.back)})`);

  // Round 2. SEA-02: an option that leaves anyone without a desk shows no fit number
  const r2o = await p.evaluate(K => { const A = window.__all, T = window.__tally; const ids = A.seatStudents(T.state.sections[K]).map(s => s.id); A.seatCandsBy[K] = [{ asg: [], seats: { d0: ids[0] }, fit: 0, hard: 0 }]; T.render();
    const t = (document.querySelector('.cand button small') || {}).textContent || ''; A.seatCandsBy[K] = []; T.render(); return t; }, K);
  check(/^fit –/.test(r2o), `SEA-02 an option that leaves students without a desk shows "fit –", not "fit 0" (${r2o})`);

  // Round 2. SEA-12: the list chip and the student card read a keep-apart or seat-near from either student
  const r2c = await p.evaluate(K => { const A = window.__all, T = window.__tally, sec = T.state.sections[K]; const stu = A.seatStudents(sec); const [x, y, z] = stu; const keep = JSON.parse(JSON.stringify(sec.seatInfo));
    A.seatInfoOf(sec, x.id).apart = [y.id]; A.seatInfoOf(sec, y.id).apart = []; A.seatInfoOf(sec, z.id).together = [y.id]; A.seatInfoOf(sec, y.id).together = []; T.render();
    const tags = [...document.querySelectorAll('.seatStu')].map(e => e.textContent); const yTag = tags.find(t => t.includes(A.seatName(y)) && !t.includes(A.seatName(x))) || '';
    A.openSeatSheet(sec, y.id); const iy = stu.indexOf(x), iz = stu.indexOf(z); const m = document.querySelector('#modal');
    const out = { chipApart: /1 apart/.test(yTag), chipNear: /1 near/.test(yTag), cardApart: !!m.querySelector(`[data-rel="apart|${iy}"].apart`), cardNear: !!m.querySelector(`[data-rel="together|${iz}"].near`) };
    m.querySelector(`[data-rel="apart|${iy}"]`).click(); out.offBoth = !A.seatInfoOf(sec, x.id).apart.includes(y.id) && !A.seatInfoOf(sec, y.id).apart.includes(x.id);
    m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; sec.seatInfo = keep; T.render(); return out; }, K);
  check(r2c.chipApart && r2c.chipNear, `SEA-12 the student list shows "1 apart" and "1 near" for a link stored on the other student (${JSON.stringify(r2c)})`);
  check(r2c.cardApart && r2c.cardNear && r2c.offBoth, 'SEA-12 the student card marks a link stored on the other student, and tapping it removes the link from both');

  // Round 2: the "Clear every desk" dialog says Undo brings the seats back too
  await p.click('#seatSub [data-sub="room"]'); await p.waitForTimeout(300); await p.click('#rmClear'); await p.waitForTimeout(300);
  const clearText = await p.evaluate(() => { const m = document.querySelector('#modal'); const t = m.textContent; m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; return t; });
  check(/brings the desks and the seats back/.test(clearText) && !/not the seats/.test(clearText), `the Clear every desk dialog says Undo brings the desks and the seats back (${clearText.replace(/\s+/g, ' ').slice(0, 140)})`);
  await p.click('#seatSub [data-sub="chart"]'); await p.waitForTimeout(300);

  // SEA-12: a keep-apart or seat-near stored on only one of the two students is read both ways
  const r12 = await p.evaluate(K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const keepRoom = T.state.room, keepW = T.state.seatWeights;
    T.state.room = { w: 900, h: 600, front: 'top', desks: [{ id: 'd0', x: 40, y: 40, r: 0 }, { id: 'd1', x: 110, y: 40, r: 0 }, { id: 'd2', x: 600, y: 400, r: 0 }], teacher: null, door: null }; T.state.seatWeights = {};
    const mk = (id, apart, together) => ({ id, display: id, first: id, last: 'X', behavior: 'low', front: false, nearTeacher: false, standing: 50, level: null, apart, together, plan: '', notes: '' });
    const stu = [mk('ADAMS, A', [], []), mk('BAKER, B', ['ADAMS, A'], []), mk('COLE, C', [], ['ADAMS, A'])]; const G = A.geometry(); const seats = { d0: 'ADAMS, A', d1: 'BAKER, B', d2: 'COLE, C' }; const M = A.buildModel(s, stu, G);
    const why = A.whyHere(s, { seats }, 'ADAMS, A', 'd0', stu, G).map(l => l.msg); const iss = A.explainSeats(seats, stu, G).map(x => x.msg);
    const out = { hard: M.hard.length, fitHard: A.scoreSeats(s, seats, stu, G, M).hard, issHard: A.explainSeats(seats, stu, G).filter(x => x.t === 'hard').length, near: M.P[0][2][0] > 0,
      whyApart: why.some(m => /^Keep apart from .*TOO CLOSE/.test(m)), whyNear: why.some(m => /^Wants to sit near .*not near/.test(m)), issNear: iss.some(m => /wanted near each other: not near/.test(m)) };
    T.state.room = keepRoom; T.state.seatWeights = keepW; return out; }, K);
  check(r12.hard === 1 && r12.fitHard === 1 && r12.issHard === 1, `SEA-12 a keep-apart stored on one student only is a hard rule in the solver, the fit and the issues (${JSON.stringify(r12)})`);
  check(r12.whyApart && r12.whyNear && r12.near && r12.issNear, 'SEA-12 why-here, the issues and the solver read a one-sided keep-apart and seat-near from the other student too');

  // SEA-03, SEA-11: "saved <date>" is the local day, any savedAt type renders, and a backup's savedAt is stored as a date string
  const r03 = await p.evaluate(async K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const bar = v => { s.seating = { seats: {}, locks: {}, savedAt: v }; try { return A.renderSeatingBar(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); } catch (e) { return 'ERROR ' + e.message; } };
    const out = { evening: bar(new Date(2026, 10, 15, 20, 30).toISOString()), day: A.fmtDate('2026-11-15'), num: bar(Date.UTC(2026, 10, 10, 15)), junk: [null, {}, 'nonsense', NaN].map(bar) }; delete s.seating;
    const names = A.seatStudents(s).slice(0, 2).map(x => x.display);
    const v8 = { v: 1, periods: [{ id: 'p1', sectionId: K, name: 'Period 1' }], students: names.map((n, i) => { const m = n.match(/^([^,]+),\s*(\S+)/); return { id: 's' + i, periodId: 'p1', raw: n, last: m[1], first: m[2], apart: [], together: [] }; }),
      layout: { w: 900, h: 600, front: 'top', desks: [{ id: 'd0', x: 100, y: 100, r: 0 }, { id: 'd1', x: 170, y: 100, r: 0 }] }, charts: { p1: { seats: { d0: 's0', d1: 's1' }, locks: {}, savedAt: 1757635200000 } } };
    const r = await A.importSeatingBackup(v8); out.imported = r.charts; out.savedAt = s.seating && s.seating.savedAt; delete s.seating; return out; }, K);
  check(r03.evening.includes('saved ' + r03.day), `SEA-03 a chart saved at 8:30 pm Eastern on 15 Nov reads "saved ${r03.day}" (${r03.evening.slice(0, 40)})`);
  check(!/ERROR/.test(r03.num + r03.junk.join()) && r03.num.includes('saved ' + 'Nov 10') && r03.junk.every(t => /saved/.test(t) && !/1969|1970|Invalid/.test(t)), `SEA-11 a numeric or junk savedAt renders the Seating bar (${[r03.num, ...r03.junk].map(t => t.slice(0, 20)).join(' | ')})`);
  check(r03.imported === 1 && typeof r03.savedAt === 'string' && r03.savedAt.startsWith('2025-09-'), `SEA-11 a Seating Chart backup's numeric savedAt is stored as a date string (${r03.savedAt})`);

  // SEA-06, SEA-07, SEA-09: why-here at weight 0, ordinals, one partner threshold
  const r06 = await p.evaluate(K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const keepRoom = T.state.room, keepW = T.state.seatWeights, keepP = T.state.seatPairs, keepB = T.state.seatBasis;
    const desks = []; for (let i = 0; i < 8; i++) desks.push({ id: 'd' + i, x: 40 + (i % 4) * 70, y: 40 + Math.floor(i / 4) * 300, r: 0 }); T.state.room = { w: 900, h: 600, front: 'top', desks, teacher: { x: 740, y: 20, w: 130, h: 64 }, door: null };
    const mk = (id, o) => Object.assign({ id, display: id, first: id, last: 'X', behavior: 'low', front: false, nearTeacher: false, standing: 60, level: null, apart: [], together: [], plan: '', notes: '' }, o);
    const stu = [mk('A', { behavior: 'high', front: true, nearTeacher: true, standing: 10, together: ['C'] }), mk('B', { behavior: 'high' }), mk('C'), mk('D')]; const G = A.geometry(); const seats = { d4: 'A', d5: 'B', d0: 'C', d1: 'D' };
    T.state.seatWeights = { behavior: 0, fast: 0, front: 0, teacher: 0, together: 0 }; const off = A.whyHere(s, { seats }, 'A', 'd4', stu, G);
    T.state.seatWeights = {}; const on = A.whyHere(s, { seats }, 'A', 'd4', stu, G);
    T.state.seatBasis = 'blend'; const text = A.standingText({ pct: 22, level: 2, grade: 61.4, gradeRank: 3, ixlPct: 40, ixlRank: 1, standing: 9 }) + ' | ' + A.standingText({ pct: 11, grade: 70, gradeRank: 12, ixlPct: 50, ixlRank: 13, standing: 12 });
    T.state.room = { w: 900, h: 600, front: 'top', desks: [{ id: 'd0', x: 40, y: 40, r: 0 }, { id: 'd1', x: 110, y: 40, r: 0 }], teacher: null, door: null }; const G2 = A.geometry(); const pair = {};
    for (const [mode, a, c] of [['tutor', 60, 80], ['tutor', 60, 90], ['similar', 40, 80], ['similar', 40, 60]]) { T.state.seatPairs = mode; const st = [mk('A', { standing: a }), mk('B', { standing: c })]; const sts = { d0: 'A', d1: 'B' };
      const warn = A.whyHere(s, { seats: sts }, 'A', 'd0', st, G2).some(l => /Tutor pairs|Similar level/.test(l.msg) && !l.ok); pair[mode + (c - a)] = warn === (A.explainSeats(sts, st, G2).length > 0) ? 'agree' : 'differ'; }
    T.state.room = keepRoom; T.state.seatWeights = keepW; T.state.seatPairs = keepP; T.state.seatBasis = keepB;
    return { offWarn: off.filter(l => !l.ok).map(l => l.msg), offH: off.some(l => /keeps other H/.test(l.msg)), onWarn: on.filter(l => !l.ok).length, onH: on.some(l => /keeps other H/.test(l.msg)), text, pair }; }, K);
  check(r06.offWarn.length === 0 && !r06.offH, `SEA-06 why-here marks nothing as failing for priorities at weight 0 and makes no claim about H students (${r06.offWarn.join(' | ')})`);
  check(r06.onWarn >= 4 && r06.onH, `SEA-06 the same seat at the default weights still shows its failing lines (${r06.onWarn})`);
  check(/FAST 22nd pct/.test(r06.text) && /3rd percentile in class/.test(r06.text) && /IXL 40% \(1st percentile\)/.test(r06.text) && /FAST 11th/.test(r06.text) && /12th percentile in class/.test(r06.text) && /13th percentile\)/.test(r06.text), `SEA-07 standing percentiles read 22nd, 3rd, 1st, 11th, 12th, 13th (${r06.text})`);
  check(Object.values(r06.pair).every(v => v === 'agree'), `SEA-09 why-here and the issues list agree on every partner pair (${JSON.stringify(r06.pair)})`);

  // printSeating counts only seated students on the roster; importSeatingBackup's id map has no inherited keys
  const rP = await p.evaluate(async K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const ids = A.seatStudents(s).map(x => x.id); let html = '';
    const keep = window.open; window.open = () => ({ document: { open() {}, write(h) { html += h; }, close() {} } });
    A.seatWork[K] = { seats: { d0: ids[0], d1: ids[1], d2: 'GONE, STUDENT' }, locks: {}, source: 'saved', dirty: false, undo: [] }; try { A.printSeating(s, 'teacher'); } finally { window.open = keep; } delete A.seatWork[K];
    const count = (html.match(/· (\d+) students/) || [])[1];
    let err = null, unmatched = null; try { const r = await A.importSeatingBackup({ v: 1, periods: [{ id: 'p1', sectionId: K, name: 'Period 1' }], students: [{ id: 'constructor', periodId: 'p1', raw: 'NOBODY, NOT ON ROSTER', last: 'Nobody', first: 'Not', apart: [], together: [] }], charts: {} }); unmatched = JSON.stringify(r).length; } catch (e) { err = e.message; }
    return { count, err, unmatched }; }, K);
  check(rP.count === '2', `printSeating's "N students" counts only seated students on the roster (${rP.count})`);
  check(rP.err === null, `a Seating Chart backup with a student id "constructor" imports without an error (${rP.err})`);

  // SEA-01 (kept last: it brings in the Quarter 2 gradebook): Seating's IXL figure is the Students screen's, open-quarter units only
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
  const r01 = await p.evaluate(K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; T.state.seatBasis = 'blend'; const closed = A.unitsOf(s).filter(u => u.assigned && u.total && A.unitClosed(s, u)).length;
    const stu = A.seatStudents(s).filter(x => x.ixl != null); return { closed, n: stu.length, differ: stu.filter(x => Math.round(x.ixlPct) !== Math.round(A.ixlFor(s, x.ixl).pct)).length }; }, K);
  check(r01.closed > 0 && r01.n > 0 && r01.differ === 0, `SEA-01 with a closed unit, Seating's IXL % equals the Students screen's for every student (${r01.differ} of ${r01.n} differ)`);

  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
