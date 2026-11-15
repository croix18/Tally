// Exploration: the weekly drop in every order. Scenario FRESH: empty Tally, all four files at once.
// Scenario WEEKLY: base state built once, then week-2 copies (newer dates, changed scores, one more column) in every order.
const H = require('./h.js'); const { fs, path } = H;
const fx = fs.readdirSync(path.join(H.REPO, 'fixtures')); const ACC = fx.find(f => f.startsWith('course_acc')), ON = fx.find(f => f.startsWith('course_on'));
const strip = f => f.replace(/^course_(acc|on)_/, '');
const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r]));
const NC = { 'focus_gradebook_pool_p1.csv': { period: 1, prep: 'acc' }, 'focus_gradebook_pool_p2.csv': { period: 2, prep: 'on' } };
const wk2 = (f, date) => { let t = fs.readFileSync(path.join(H.REPO, 'fixtures', f), 'utf8'); // bump every 5th score by 1 (capped at 100)
  let n = 0; t = t.replace(/,(\d{1,2}),/g, (m, v) => (++n % 5 === 0 ? ',' + Math.min(100, +v + 7) + ',' : m)); return { name: strip(f).replace(/\d{4}-\d{2}-\d{2}/, date), text: t }; };
(async () => {
  const { b, p, errs } = await H.open(); const mode = process.argv[2] || 'fresh';
  const base = [{ fixture: ACC, name: strip(ACC) }, { fixture: ON, name: strip(ON) }, { fixture: 'focus_gradebook_pool_p1.csv' }, { fixture: 'focus_gradebook_pool_p2.csv' }];
  let start = null;
  if (mode === 'weekly') { await H.imp(p, base, { nc: NC }); start = await p.evaluate(() => localStorage.getItem('tally.v1')); }
  const files = mode === 'weekly' ? [wk2(ACC, '2026-10-03'), wk2(ON, '2026-10-03'), { fixture: 'focus_gradebook_pool_p1.csv', lastModified: Date.parse('2026-10-03T15:00:00Z') }, { fixture: 'focus_gradebook_pool_p2.csv', lastModified: Date.parse('2026-10-03T15:00:00Z') }] : base;
  const results = {};
  for (const order of perms([0, 1, 2, 3])) {
    await p.evaluate(s => { localStorage.clear(); if (s) localStorage.setItem('tally.v1', s); }, start); await p.reload(); await p.waitForTimeout(300);
    const r = await H.imp(p, order.map(i => files[i]), { nc: NC });
    const c = JSON.stringify(await H.canon(p)); (results[c] = results[c] || []).push(order.join('') + ' ' + r.answers.map(a => a.slice(0, 40)).join(';'));
  }
  const keys = Object.keys(results); console.log(mode, 'distinct final states:', keys.length);
  keys.forEach((k, i) => { console.log('#' + i, results[k].slice(0, 4).join(' || ')); if (i) { const a = JSON.parse(keys[0]), c = JSON.parse(k); for (const s of new Set([...Object.keys(a.secs), ...Object.keys(c.secs)])) for (const f of Object.keys({ ...(a.secs[s] || {}), ...(c.secs[s] || {}) })) if (JSON.stringify((a.secs[s] || {})[f]) !== JSON.stringify((c.secs[s] || {})[f])) console.log('   diff', s, f, JSON.stringify((a.secs[s] || {})[f]).slice(0, 150), '→', JSON.stringify((c.secs[s] || {})[f]).slice(0, 150)); if (JSON.stringify(a.order) !== JSON.stringify(c.order)) console.log('   order', a.order, c.order); } });
  if (keys.length > 1) { const x = keys[0], y = keys[1]; let i = 0; while (x[i] === y[i]) i++; console.log('first char diff at', i, x.slice(Math.max(0,i-200), i+150), '\n VS ', y.slice(Math.max(0,i-200), i+150)); }
  console.log('first state:', keys[0].slice(0, 600)); console.log('errors:', errs.slice(0, 3));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
