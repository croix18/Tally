// CHT Board-save harness: every Data Lab data set, as Tally draws it, against the same data set drawn from a Board save
// of it (opened in a fresh page): the multiset of values, n, missing, the stats, the line-graph dates must match; the
// saved file must carry no name or ID; every chart form must render without NaN/undefined.
const { open, path, fs } = require('./_setup');
const { check, done, tmp, chromium, exe, APP } = require(path.join(process.env.TALLY_REPO || path.resolve(__dirname, '../repo'), 'tests/lib.js'));
(async () => {
  const { b, p, errs } = await open({ classes: 5 });
  const snap = () => p.evaluate(() => { const A = window.__all; const o = {}; A.labDatasets('acc').list.forEach(d => { o[d.id] = A.labSeries('acc', d.id).map(x => ({ name: String(x.name).replace(/\s*·.*$/, ""), vals: x.values.filter(v => v != null).slice().sort((a, b) => a - b).join(','), n: x.st.n, missing: x.missing })); }); return o; });
  const before = await snap();
  const { cfg, ids } = await p.evaluate(() => { const T = window.__tally, A = window.__all; const ids = new Set(); T.state.order.forEach(k => { const s = T.state.sections[k]; JSON.stringify([s.students, s.grades && s.grades.students, s.roster || '']).replace(/"([^"]{4,})"/g, (m, v) => { ids.add(v); return m; }); });
    return { cfg: A.boardFile(), ids: [...ids] }; });
  const file = path.join(require('os').tmpdir(), 'cht-board-' + process.pid + '.json'); fs.writeFileSync(file, JSON.stringify(cfg));
  const txt = JSON.stringify(cfg); const leak = ids.filter(x => !/^(score|blank|missing|excused)$/.test(x) && txt.includes(x));
  const q = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, timezoneId: 'America/New_York' })).newPage(); const errs2 = []; q.on('pageerror', e => errs2.push(e.message)); q.on('dialog', d => d.accept());
  await q.goto('file://' + path.resolve(APP)); await q.setInputFiles('#file', [file]); await q.waitForTimeout(1200);
  const after = await q.evaluate(() => { const A = window.__all; const o = {}; A.labDatasets('acc').list.forEach(d => { o[d.id] = A.labSeries('acc', d.id).map(x => ({ name: String(x.name).replace(/\s*·.*$/, ""), vals: x.values.filter(v => v != null).slice().sort((a, b) => a - b).join(','), n: x.st.n, missing: x.missing })); }); return o; });
  const bad = [];
  Object.keys(before).forEach(id => { const a = before[id], c = after[id]; if (!c) { bad.push(id + ': missing on the Board'); return; } a.forEach((r, i) => { const r2 = c.find(x => x.name === r.name); if (!r2) bad.push(id + ' ' + r.name + ': row missing'); else { if (r2.vals !== r.vals) bad.push(id + ' ' + r.name + ': values differ'); if (r2.missing !== r.missing) bad.push(id + ' ' + r.name + ': missing ' + r.missing + ' -> ' + r2.missing); } }); });
  const nan = await q.evaluate(() => { const A = window.__all, st = window.__tally.state.settings; const out = []; A.labDatasets('acc').list.filter(d => !/^skill:/.test(d.id)).forEach(d => ['box', 'dots', 'hist', 'stem', 'bar', 'circle', 'line', 'avg', 'corr'].forEach(k => ['class', 'pool'].forEach(c => { st.labCmp = { acc: c }; const h = A.labMarkup('acc', d.id, 2, true, true, true, k); if (/NaN|undefined|Infinity/.test(h)) out.push(d.id + ' ' + k + ' ' + c); }))); return out; });
  console.log('OBSERVED: data sets', Object.keys(before).length, '· differences:', bad.length, bad.slice(0, 6).join(' | '), '· identifiers in the file:', leak.length, '· NaN/undefined renders:', nan.length, nan.slice(0, 3).join(' | '));
  console.log('EXPECTED: the Board draws every data set from the same values as Tally, the file names no student, nothing renders NaN');
  check(bad.length === 0, 'the Board save draws the same distributions');
  check(leak.length === 0, 'no name or ID in the Board save');
  check(nan.length === 0, 'no NaN/undefined on the Board');
  check(errs.length + errs2.length === 0, 'no page errors ' + errs.concat(errs2).join('|').slice(0, 300));
  fs.unlinkSync(file); await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
