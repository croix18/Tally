// SEA coverage checks (not findings unless a FAIL appears): gone date, prints, locks, NaN scan, why-here vs own geometry,
// move consequences vs own hard counter, undo, more students than desks.
const { open, check, done, roomJS } = require('./h.js');
(async () => {
  // gone date at 9:30 pm Eastern on 15 Nov (02:30 UTC 16 Nov)
  { const { b, p, errs, K } = await open({ now: Date.UTC(2026, 10, 16, 2, 30) });
    await p.evaluate(`(${roomJS})(30, 6)`);
    const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; s.seatInfo['GHOST, NEW'] = A.cleanSeatInfo({}); s.seatInfo['GHOST, OLD45'] = A.cleanSeatInfo({ gone: '2026-10-01' }); s.seatInfo['GHOST, OLD46'] = A.cleanSeatInfo({ gone: '2026-09-30' });
      T.state.active = K; return 1; }, K);
    await p.click('[data-k="' + K + '"]').catch(() => {}); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(400);
    const g = await p.evaluate(K => { const s = window.__tally.state.sections[K]; return { now: new Date().toString().slice(0, 24), newGone: s.seatInfo['GHOST, NEW'] && s.seatInfo['GHOST, NEW'].gone, k45: !!s.seatInfo['GHOST, OLD45'], k46: !!s.seatInfo['GHOST, OLD46'], side: document.querySelector('.departed') ? document.querySelector('.departed').textContent.replace(/\s+/g, ' ').slice(0, 160) : '' }; }, K);
    console.log('gone:', JSON.stringify(g));
    check(g.newGone === '2026-11-15', 'a student vanishing at 9:30 pm Eastern is stamped with the local day');
    check(g.k45 && !g.k46, '45 days kept, 46 dropped');
    check(errs.length === 0, 'no page errors ' + errs.join('|')); await b.close(); }
  const { b, p, errs, K } = await open();
  await p.evaluate(`(${roomJS})(30, 6)`);
  // a roster-only student with no IXL, no grade, no FAST
  await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; s.roster = s.roster + '\n9999999\tNOBODY, NOSCORE Q'; T.save(); T.state.active = K; }, K);
  const r = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const out = {};
    const stu = A.seatStudents(s); const G = A.geometry(); const ns = stu.find(x => x.display === 'NOBODY, NOSCORE Q'); out.noscore = ns ? { standing: ns.standing, text: A.standingText(ns) } : null;
    // safe vs teacher svg
    stu.forEach((x, i) => { const inf = s.seatInfo[x.id]; inf.level = 1 + (i % 5); inf.pct = (i * 13) % 100; inf.behavior = i % 4 ? 'low' : 'high'; inf.plan = i % 3 ? '' : '504'; });
    const st2 = A.seatStudents(s); const seats = {}; st2.forEach((x, i) => seats[G.ds[i].id] = x.id);
    const safe = A.svgChart(s, seats, st2, G, 'safe', null), teach = A.svgChart(s, seats, st2, G, 'teacher', null);
    out.safeLeaks = ['FAST level', '>504<', '>H<', 'standing', '%'].filter(t => safe.includes(t)); out.teacherHas = ['FAST level', '>504<', '>H<'].filter(t => teach.includes(t));
    // why-here partner/neighbor lists vs my own distance relation, on 200 random seatings
    const C = d => ({ x: d.x + 35, y: d.y + 35 }); let whyBad = 0, hardBad = 0, moves = 0; let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    st2.forEach((x, i) => { if (i % 5 === 0 && i + 3 < st2.length) { s.seatInfo[x.id].apart = [st2[i + 3].id]; s.seatInfo[st2[i + 3].id].apart = [x.id]; } });
    const st3 = A.seatStudents(s); const M = A.buildModel(s, st3, G);
    const myHard = sts => { let h = 0; const at = {}; for (const [d, id] of Object.entries(sts)) at[id] = G.ds.findIndex(z => z.id === d); for (let i = 0; i < st3.length; i++) for (let j = i + 1; j < st3.length; j++) { const a = st3[i], c = st3[j]; if (at[a.id] == null || at[c.id] == null) continue; if (!(a.apart.includes(c.id) || c.apart.includes(a.id))) continue; const p1 = C(G.ds[at[a.id]]), p2 = C(G.ds[at[c.id]]); if (Math.hypot(p1.x - p2.x, p1.y - p2.y) <= 154) h++; } return h; };
    for (let t = 0; t < 200; t++) { const ids = st3.map(x => x.id).sort(() => rnd() - 0.5); const sts = {}; const order = G.ds.map(d => d.id).sort(() => rnd() - 0.5); ids.forEach((id, i) => sts[order[i]] = id);
      const sid = ids[0], desk = Object.keys(sts).find(d => sts[d] === sid); const lines = A.whyHere(s, { seats: sts }, sid, desk, st3, G);
      const me = C(G.ds.find(d => d.id === desk)); const partners = [], near = []; for (const [d, id] of Object.entries(sts)) { if (id === sid) continue; const q = C(G.ds.find(z => z.id === d)); const dd = Math.hypot(me.x - q.x, me.y - q.y); if (dd <= 88) partners.push(id); else if (dd <= 154) near.push(id); }
      const pl = lines.find(l => /^Partner|^No partner/.test(l.msg)); const nl = lines.find(l => /^Nearby/.test(l.msg));
      if ((partners.length ? !/^Partner/.test(pl.msg) : !/^No partner/.test(pl.msg)) || (near.length ? !nl || nl.msg.split(',').length !== near.length : !!nl)) whyBad++;
      if (A.scoreSeats(s, sts, st3, G, M).hard !== myHard(sts)) hardBad++;
      // a random swap: reported hard before/after vs mine
      const w = { seats: JSON.parse(JSON.stringify(sts)), locks: {}, undo: [] }; const ds = Object.keys(w.seats); const f = ds[0 | rnd() * ds.length], to = G.ds[0 | rnd() * G.ds.length].id; if (f === to) continue;
      const h0 = myHard(w.seats); const rep = A.seatMove(s, w, f, to, false); moves++; if (!rep || rep.hardBefore !== h0 || rep.hardAfter !== myHard(w.seats)) hardBad++;
      if (JSON.stringify(JSON.parse(w.undo[w.undo.length - 1])) !== JSON.stringify(sts)) hardBad++; }
    out.whyBad = whyBad; out.hardBad = hardBad; out.moves = moves;
    // locks survive generation (the real seatGenerate path)
    const keep = {}; keep[G.ds[7].id] = st3[0].id; keep[G.ds[22].id] = st3[1].id; s.seating = { seats: { ...seats }, locks: {}, savedAt: new Date().toISOString() };
    delete A.seatWork[s.key]; const w0 = A.workFor(s); w0.seats = { ...seats }; for (const d of Object.keys(w0.seats)) if (w0.seats[d] === st3[0].id || w0.seats[d] === st3[1].id) delete w0.seats[d]; Object.assign(w0.seats, keep); w0.locks = { [st3[0].id]: true, [st3[1].id]: true };
    await A.seatGenerate(s); const cands = A.seatCandsBy[s.key] || []; out.cands = cands.length; out.locksKept = cands.every(c => c.seats[G.ds[7].id] === st3[0].id && c.seats[G.ds[22].id] === st3[1].id);
    out.candHard = cands.map(c => c.hard); out.candFit = cands.map(c => c.fit); out.allSeated = cands.every(c => Object.keys(c.seats).length === st3.length);
    return out; }, K);
  console.log('cov:', JSON.stringify(r));
  check(r.noscore && r.noscore.standing === null && /treated as mid-level/.test(r.noscore.text), 'a student with no data: null standing, "treated as mid-level"');
  check(r.safeLeaks.length === 0 && r.teacherHas.length === 3, 'student/sub copy carries no level, plan, H or standing; teacher copy does');
  check(r.whyBad === 0, 'why-here partner / nearby lists match my own distance relation (200 seatings)');
  check(r.hardBad === 0, `scoreSeats and seatMove hard counts and undo snapshots match my checker (${r.moves} moves)`);
  check(r.cands > 0 && r.locksKept && r.allSeated, 'generation keeps both locked students at their desks in every option and seats everyone');
  // NaN scan of the rendered view
  await p.click('[data-k="' + K + '"]').catch(() => {}); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(500);
  const scan = await p.evaluate(() => { const t = document.querySelector('#gridwrap').innerHTML; return ['NaN', 'undefined', 'Infinity', 'null%'].filter(x => t.includes(x)); });
  check(scan.length === 0, 'no NaN / undefined / Infinity in the seating view: ' + scan.join(','));
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
