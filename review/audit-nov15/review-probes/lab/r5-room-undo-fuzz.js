// Counter-review SEA-04: random room edit / chart edit / save / clear / room Undo sequences over two classes.
// Invariants at every room Undo: nothing saved or placed (and no lock) is lost, no student at two desks, no seat on a missing desk.
const path = require('path');
const { open, check, done, roomJS } = require(path.join(process.env.TALLY_REPO, 'review/audit-nov15/probes/seating/h.js'));
(async () => {
  const { b, p, errs, K } = await open();
  await p.evaluate(`(${roomJS})(30, 6)`);
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const S = T.state;
    const base = S.sections[K]; const c2 = JSON.parse(JSON.stringify(base)); c2.key = 'k2'; c2.period = 2; c2.label = '2nd Period · Accelerated'; S.sections.k2 = c2; S.order.push('k2'); delete base.seating; delete c2.seating;
    const keys = [K, 'k2']; const ids = k => A.seatStudents(S.sections[k]).map(s => s.id);
    let seed = 11; const rnd = n => { seed = (seed * 16807) % 2147483647; return seed % n; }; let clock = Date.parse('2026-11-15T12:00:00Z');
    const W = A.seatWork; const probs = []; const kinds = {};
    const dupes = w => { const v = Object.values(w.seats); return v.length !== new Set(v).size; };
    for (let run = 0; run < 300; run++) {
      // fresh start for each run
      A.roomUndo.length = 0; keys.forEach(k => { delete W[k]; delete S.sections[k].seating; }); window.eval(`(${'(' + (() => 0) + ')'})`);
      const desks = []; for (let i = 0; i < 30; i++) desks.push({ id: 'd' + i, x: 40 + (i % 6) * 94, y: 40 + Math.floor(i / 6) * 110, r: 0 }); S.room = { w: 1200, h: 900, front: 'top', desks, teacher: null, door: null };
      const log = [];
      for (let step = 0; step < 14; step++) {
        const op = rnd(6), k = keys[rnd(2)], sec = S.sections[k];
        if (op === 0) { // room edit: delete a desk (or add one)
          A.roomPush(); if (rnd(3) && S.room.desks.length) { const d = S.room.desks[rnd(S.room.desks.length)].id; S.room.desks = S.room.desks.filter(x => x.id !== d); A.roomDropDesks(new Set(S.room.desks.map(x => x.id))); log.push('del ' + d); } else { S.room.desks.push({ id: 'n' + run + '_' + step, x: 5, y: 5, r: 0 }); log.push('add'); } }
        else if (op === 1 || op === 2) { // chart edit: put an unseated student at an empty desk (seat by hand), maybe lock him
          let w = A.workFor(sec); if (!w) { W[k] = w = { seats: {}, locks: {}, source: 'hand', dirty: true, undo: [] }; }
          const seated = new Set(Object.values(w.seats)); const free = S.room.desks.map(d => d.id).filter(d => w.seats[d] == null); const un = ids(k).filter(i => !seated.has(i));
          if (free.length && un.length) { const d = free[rnd(free.length)], sid = un[rnd(un.length)]; w.seats[d] = sid; if (rnd(2)) w.locks[sid] = true; w.dirty = true; log.push(k.slice(-2) + ' place ' + d); } }
        else if (op === 3) { const w = W[k]; if (w) { clock += 1000; sec.seating = { seats: JSON.parse(JSON.stringify(w.seats)), locks: { ...w.locks }, savedAt: new Date(clock).toISOString() }; w.dirty = false; w.source = 'saved'; log.push(k.slice(-2) + ' save'); } }
        else if (op === 4) { if (sec.seating && !(W[k] && W[k].dirty)) { delete sec.seating; delete W[k]; log.push(k.slice(-2) + ' clear'); } }
        else if (A.roomUndo.length) {
          const before = keys.map(k => ({ saved: JSON.parse(JSON.stringify(S.sections[k].seating || null)), work: JSON.parse(JSON.stringify(W[k] || null)) }));
          A.roomUndoPop(); log.push('UNDO');
          const desk = new Set(S.room.desks.map(d => d.id));
          keys.forEach((k, j) => { const sv = S.sections[k].seating, w = W[k];
            for (const [nm, was, now] of [['saved', before[j].saved, sv], ['work', before[j].work, w]]) {
              if (now && dupes(now)) { probs.push(['two desks', nm, k, log.join(' > ')]); kinds['two desks ' + nm] = 1; }
              if (now && Object.keys(now.seats).some(d => !desk.has(d))) { probs.push(['ghost desk', nm, k, log.join(' > ')]); kinds['ghost ' + nm] = 1; }
              if (was && was.seats) for (const [d, sid] of Object.entries(was.seats)) if (!now || !now.seats || now.seats[d] !== sid) { if (desk.has(d)) { probs.push(['lost seat', nm, k, log.join(' > ')]); kinds['lost seat ' + nm + (nm === 'work' && was.dirty ? ' (unsaved edits)' : '')] = 1; break; } }
              if (was && was.locks) for (const sid in was.locks) if (was.locks[sid] && Object.values(was.seats).includes(sid) && !(now && now.locks && now.locks[sid])) { probs.push(['lost lock', nm, k, log.join(' > ')]); kinds['lost lock ' + nm] = 1; break; }
            } });
        }
      }
    }
    return { n: probs.length, kinds: Object.keys(kinds), ex: Object.keys(kinds).map(kk => probs.find(x => kk.startsWith(x[0] + ' ' + x[1]))) };
  }, K);
  console.log(JSON.stringify(out, null, 1));
  check(!out.kinds.some(k => /saved|two desks|ghost/.test(k)), 'room Undo never loses a saved seat or lock, never puts a student at two desks');
  check(!out.kinds.some(k => /work/.test(k)), 'room Undo never loses a chart edit made after the room edit');
  check(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
