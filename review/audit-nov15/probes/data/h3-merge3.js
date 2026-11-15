// Exploration harness: merge3 properties on random JSON trees (base, mine = edit(base), theirs = edit(base)).
const D = require('./dat-lib.js'); const path = require('path');
(async () => {
  const { b, p, errs } = await D.open();
  const r = await p.evaluate(() => { const M = window.__all.merge3; let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const leaf = () => [0, 1, 2, 'a', 'b', null, true, false, ''][Math.floor(rnd() * 9)];
    const gen = d => { const r = rnd(); if (d > 3 || r < 0.35) return leaf(); if (r < 0.55) return Array.from({ length: Math.floor(rnd() * 3) }, () => gen(d + 1)); const o = {}; const n = Math.floor(rnd() * 4); for (let i = 0; i < n; i++) o['k' + Math.floor(rnd() * 5)] = gen(d + 1); return o; };
    const clone = x => JSON.parse(JSON.stringify(x)); const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    // edit: change, add or delete one key somewhere (records which path)
    const edit = (x, tag) => { const y = clone(x); const objs = []; const walk = (o, p) => { if (o && typeof o === 'object' && !Array.isArray(o)) { objs.push([o, p]); for (const k in o) walk(o[k], p + '.' + k); } }; walk(y, ''); if (!objs.length) return { y: tag, path: '' };
      const [o, p] = objs[Math.floor(rnd() * objs.length)]; const ks = Object.keys(o); const op = rnd(); let path;
      if (op < 0.4 || !ks.length) { const k = 'n' + tag + Math.floor(rnd() * 3); o[k] = tag; path = p + '.' + k; } else if (op < 0.8) { const k = ks[Math.floor(rnd() * ks.length)]; o[k] = tag + '!'; path = p + '.' + k; } else { const k = ks[Math.floor(rnd() * ks.length)]; delete o[k]; path = p + '.' + k; }
      return { y, path }; };
    const get = (o, path) => path.split('.').slice(1).reduce((v, k) => v == null ? undefined : v[k], o);
    const bad = { id1: 0, id2: 0, id3: 0, lost: [] }; let n = 0;
    for (let t = 0; t < 4000; t++) { const base = { root: gen(0) }; const a = edit(base, 'A'), c = edit(base, 'B'); n++;
      if (!eq(M(clone(base), clone(a.y), clone(base)), a.y)) bad.id1++;
      if (!eq(M(clone(base), clone(base), clone(c.y)), c.y)) bad.id2++;
      if (!eq(M(clone(base), clone(a.y), clone(a.y)), a.y)) bad.id3++;
      // disjoint edits (neither path a prefix of the other): both must survive
      const disjoint = a.path && c.path && !a.path.startsWith(c.path) && !c.path.startsWith(a.path);
      if (disjoint) { const m = M(clone(base), clone(a.y), clone(c.y)); const okA = eq(get(m, a.path), get(a.y, a.path)), okC = eq(get(m, c.path), get(c.y, c.path)); if (!okA || !okC) bad.lost.push({ base: JSON.stringify(base).slice(0, 160), aPath: a.path, cPath: c.path, merged: JSON.stringify(m).slice(0, 160), lost: okA ? 'theirs' : 'mine' }); } }
    // hand-built: both add a note to one student's (array) list; both add history days
    const base = { notes: { x: [{ id: 1 }] } }; const m1 = M(base, { notes: { x: [{ id: 1 }, { id: 2 }] } }, { notes: { x: [{ id: 1 }, { id: 3 }] } });
    return { n, bad: { id1: bad.id1, id2: bad.id2, id3: bad.id3, lostN: bad.lost.length, lost: bad.lost.slice(0, 4) }, arrays: JSON.stringify(m1) }; });
  console.log(JSON.stringify(r, null, 1)); console.log('errors', errs.join(' | ')); await b.close();
})().catch(e => { console.error(e); process.exit(2); });
