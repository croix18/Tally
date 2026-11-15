// SEA-02: Fit counts only seated students, and with more students than desks the baseline is 0 and fit is forced
// to 100. "Seat by hand" on an empty chart shows a green "100 ... less priority cost than a random seating" beside
// "23 issues · 23 hard"; a saved chart after the roster outgrows the room shows 100 too.
const { open, check, done, roomJS } = require('./h.js');
(async () => {
  const { b, p, errs, K } = await open();
  const nStu = await p.evaluate(K => window.__all.seatStudents(window.__tally.state.sections[K]).length, K);
  await p.evaluate(`(${roomJS})(30, 6)`);
  await p.evaluate(K => { const T = window.__tally; T.state.active = K; T.save(); }, K);
  await p.click('[data-k="' + K + '"]').catch(() => {}); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(400);
  await p.click('#seatHand'); await p.waitForTimeout(400);
  const a = await p.evaluate(() => ({ fit: document.querySelector('.fit .n').textContent, cls: document.querySelector('.fit .n').className, caption: document.querySelector('.fit .ghint').textContent.slice(0, 60), summary: document.querySelector('.seatSide details summary').textContent }));
  // case 2: a saved chart for every student, then the room loses desks below the roster size
  const c = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const stu = A.seatStudents(s); const G = A.geometry();
    const seats = {}; stu.forEach((x, i) => seats[G.ds[i].id] = x.id); s.seating = { seats, locks: {}, savedAt: new Date().toISOString() };
    const M = A.buildModel(s, stu, G); const full = A.scoreSeats(s, seats, stu, G, M).fit;
    T.state.room.desks = T.state.room.desks.slice(0, stu.length - 3); const G2 = A.geometry(); const seats2 = {}; for (const d of G2.ds) if (seats[d.id]) seats2[d.id] = seats[d.id];
    const M2 = A.buildModel(s, stu, G2); return { full, short: A.scoreSeats(s, seats2, stu, G2, M2).fit, desks: G2.ds.length, stu: stu.length }; }, K);
  console.log('OBSERVED:', JSON.stringify({ students: nStu, handEmpty: a, outgrown: c }));
  console.log('EXPECTED: an empty or partial chart is not scored 100 / "good"; with students left unseated the fit is not shown as near-perfect (each unseated student is itself listed as a hard issue)');
  check(!(a.fit === '100' && /good/.test(a.cls)), 'an empty hand-seated chart is not shown as fit 100 (good)');
  check(c.short !== 100, `a chart with ${c.stu - c.desks} students left without a desk is not fit 100 (got ${c.short}; the same chart with everyone seated was ${c.full})`);
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
