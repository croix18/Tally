// Exploration harness: a valid Full save, mutated at one random place (null, {}, [], a string, a number, a deleted key,
// "__proto__"), taken in the way loadTallyFile does (adopt(hydrate(s) || s)), then rendered on every main view.
const D = require('./dat-lib.js');
(async () => {
  const { b, p, errs } = await D.open(); await D.loadClass(p); await D.populate(p);
  const N = Number(process.env.N || 400);
  const r = await p.evaluate(async ([K, N]) => { const A = window.__all, T = window.__tally; const good = JSON.stringify(T.stateForSave()); let seed = Number(42); const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const paths = []; const walk = (o, p, d) => { if (d > 7 || !o || typeof o !== 'object') return; const ks = Object.keys(o); (Array.isArray(o) ? ks.slice(0, 3) : ks).forEach(k => { paths.push(p.concat(k)); walk(o[k], p.concat(k), d + 1); }); }; walk(JSON.parse(good), [], 0);
    const VALS = [null, {}, [], 'x', 0, -1, 1e9, true, '2026-13-45', { __proto__: null }, [null], ['x']];
    const fails = {}; let rf = null; const ce = console.error; console.error = (...a) => { if (/render failed|could not/i.test(String(a[0]))) rf = rf || String(a[1] && a[1].message || a[1]).slice(0, 90); return ce.apply(console, a); }; const views = ['home', 'units', 'grades', 'students', 'seating'];
    for (let t = 0; t < N; t++) { const s = JSON.parse(good); const pth = paths[Math.floor(rnd() * paths.length)]; const parent = pth.slice(0, -1).reduce((o, k) => o[k], s); const key = pth[pth.length - 1]; const op = Math.floor(rnd() * (VALS.length + 1));
      if (op === VALS.length) delete parent[key]; else parent[key] = JSON.parse(JSON.stringify(VALS[op]));
      const tag = pth.join('.').replace(/\.\d+/g, '.N').replace(/1205050-7T1A/g, 'K') + ' = ' + (op === VALS.length ? 'deleted' : JSON.stringify(VALS[op]));
      let stage = 'adopt'; rf = null; try { A.adopt(A.hydrate(JSON.parse(JSON.stringify(s))) || s); stage = 'render'; T.render(); const k0 = A.state.order[0]; if (k0) { stage = 'settings'; T.openSettings(k0, 'class'); stage = 'profile'; const nm = A.classStudents(A.state.sections[k0])[0]; if (nm) T.openProfile(k0, nm); stage = 'leave'; A.leaveSettings(); } stage = 'boot'; localStorage.setItem('tally.v1', JSON.stringify(T.stateForSave())); const re = A.load(); if (re) A.adopt(re); T.render(); if (rf) throw new Error('RENDER ' + rf); }
      catch (e) { const msg = stage + ': ' + String(e && e.message).slice(0, 90); (fails[msg] = fails[msg] || []).push(tag); }
      try { A.adopt(A.hydrate(JSON.parse(good))); } catch (e) {} }
    return { paths: paths.length, fails: Object.fromEntries(Object.entries(fails).map(([m, l]) => [m, [l.length, ...l.slice(0, 3)]])) }; }, [D.K, N]);
  console.log(JSON.stringify(r, null, 1).slice(0, 6000)); console.log('page errors', errs.length, errs.slice(0, 5).join(' | ').slice(0, 800)); await b.close();
})().catch(e => { console.error(e); process.exit(2); });
