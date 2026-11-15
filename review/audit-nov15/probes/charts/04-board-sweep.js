// CHT sweep harness (not a single finding): renders the Data Lab for every data set x chart form x row choice x
// Points/% x stats level, five classes (the fixture and four synthetic copies), and checks each screen against an
// independent recount: "n =" against the marks drawn, the stats cells against my own statistics, no name or ID
// anywhere in the markup, no NaN/undefined/Infinity, Focus sets drawing no per-student marks, marks inside the axis.
const { open, path } = require('./_setup');
const { check, done } = require(path.join(process.env.TALLY_REPO || path.resolve(__dirname, '../repo'), 'tests/lib.js'));
(async () => {
  const { b, p, errs } = await open({ classes: 5 });
  const res = await p.evaluate(() => { const T = window.__tally, A = window.__all, st = T.state.settings; const bad = {}; const note = (k, ex) => { bad[k] = bad[k] || { n: 0, ex }; bad[k].n++; };
    const med = a => a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
    const O = vals => { const v = vals.filter(x => x != null).sort((a, b) => a - b), n = v.length, h = Math.floor(n / 2); const q1 = med(v.slice(0, h)), q3 = med(v.slice(n - h)); return { n, min: v[0], max: v[n - 1], q1, median: med(v), q3, iqr: q3 - q1, range: v[n - 1] - v[0], mean: v.reduce((a, b) => a + b, 0) / n }; };
    const f1 = x => Number.isInteger(x) ? String(x) : x.toFixed(1);
    // every identifying string in the data: names, ids, keys
    const ids = new Set(); T.state.order.forEach(k => { const s = T.state.sections[k]; (s.students || []).forEach(x => { if (typeof x === 'string') ids.add(x); else if (x) Object.values(x).forEach(v => typeof v === 'string' && ids.add(v)); });
      if (s.grades) (s.grades.students || []).forEach(x => { if (typeof x === 'string') ids.add(x); else if (x) Object.values(x).forEach(v => typeof v === 'string' && ids.add(v)); }); JSON.stringify(s.roster || {}).replace(/"([^"]{4,})"/g, (m, v) => { ids.add(v); return m; }); });
    const idList = [...ids].filter(x => x.length >= 4 && !/^(score|blank|missing|excused|true|false)$/i.test(x));
    const ds = A.labDatasets('acc').list.filter(d => !/^skill:/.test(d.id) || /Unit 3/.test(d.label)).slice(0, 60);
    const kinds = ['box', 'dots', 'hist', 'stem', 'bar', 'circle', 'line', 'avg', 'corr']; const cmps = ['class', 'pool', 'vs:p3-acc']; let renders = 0;
    for (const d of ds) for (const kind of kinds) for (const cmp of cmps) for (const pct of [false, true]) for (const lvl of [0, 2]) {
      st.labPct = pct; st.labCmp = { acc: cmp }; st.labKind = kind; st.labUnit = d.id; st.labPrep = 'acc'; st.labBin = 0;
      let html; try { html = A.labMarkup('acc', d.id, lvl, true, true, true, kind); } catch (e) { note('throw', { id: d.id, kind, cmp, e: e.message }); continue; } renders++;
      const ctx = { id: d.id, kind, cmp, pct, lvl };
      if (/NaN|undefined|Infinity/.test(html.replace(/<[^>]+>/g, ' ')) || /="[^"]*(NaN|undefined|Infinity)/.test(html)) note('nan-undefined', { ...ctx, at: (/.{60}(NaN|undefined|Infinity).{20}/.exec(html) || [''])[0] });
      const hit = idList.find(x => html.includes(x)); if (hit) note('identifier-in-markup', { ...ctx, hit: hit.slice(0, 3) + '…' });
      const doc = new DOMParser().parseFromString(html, 'text/html'); const focus = /^(gb|grade):/.test(d.id);
      if (kind === 'line' || kind === 'avg' || kind === 'corr') continue;
      const ser = (() => { let raw = A.labSeries('acc', d.id); if (raw.length > 1 && !raw[0].pct && raw.every(x => x.kind === 'gb') && new Set(raw.map(x => x.max)).size > 1) raw = A.labSeries('acc', d.id, true); return raw; })();
      const rows = [...doc.querySelectorAll('.labRow:not(.thin), .labPie:not(.thin)')];
      rows.forEach(r => { const name = (r.querySelector('.labName').firstChild || {}).textContent.trim(); const small = (r.querySelector('.labName small, .labPieHead small') || {}).textContent || '';
        const n = +(/n = (\d+)/.exec(small) || [])[1];
        const x = name === 'All accelerated' ? null : ser.find(y => y.name.replace(/\s*·\s*(Accelerated|On-level)$/i, '') === name);
        const vals = x ? x.values : (focus ? ser.filter(y => y.st.n >= 5) : ser).flatMap(y => y.values);
        const o = O(vals); if (o.n !== n) note('n-mismatch', { ...ctx, name, n, oracle: o.n });
        if (o.n < 5) note('row-under-MIN_N-drawn', { ...ctx, name, n: o.n });
        if (kind === 'dots' && !focus) { const c = r.querySelectorAll('circle.dot').length; if (c !== n) note('dots-count', { ...ctx, name, c, n }); }
        if (kind === 'box') { const c = r.querySelectorAll('circle.labDot').length; if (!focus && c !== n) note('box-dots-count', { ...ctx, name, c, n }); if (focus && c) note('focus-dots-drawn', { ...ctx, name, c });
          const svg = r.querySelector('svg.labSvg'); const W = svg.viewBox.baseVal.width; [...svg.querySelectorAll('line,circle,rect')].filter(el => !el.closest('g[transform]')).forEach(el => { const xs = ['x1', 'x2', 'cx', 'x'].map(a => el.getAttribute(a)).filter(v => v != null).map(Number); if (xs.some(v => v > W - 10 || v < 0)) note('box-mark-off-axis', { ...ctx, name, cls: el.getAttribute('class'), xs, W }); }); }
        if (focus && r.querySelector('.labValues')) note('focus-values-shown', { ...ctx, name });
        if (lvl > 0 && kind !== 'circle') { const cells = {}; r.querySelectorAll('.labStats div').forEach(dv => { const sp = dv.querySelector('span'); if (sp) cells[sp.textContent] = dv.querySelector('b').textContent; });
          const U = x && x.pct || (!x && ser[0] && ser[0].pct) ? '%' : '';
          ['min', 'Q1', 'median', 'Q3', 'max', 'range', 'IQR'].forEach(k => { const ov = o[{ Q1: 'q1', Q3: 'q3', IQR: 'iqr' }[k] || k]; if (cells[k] !== f1(ov) + U) note('stat-' + k, { ...ctx, name, shown: cells[k], oracle: f1(ov) + U }); });
          if (cells.mean !== o.mean.toFixed(1) + U) note('stat-mean', { ...ctx, name, shown: cells.mean, oracle: o.mean.toFixed(1) + U }); }
      });
    }
    // ---- Both courses: two on-level copies, every row choice ----
    ['p4-acc', 'p5-acc'].forEach((k, j) => { const s = JSON.parse(JSON.stringify(T.state.sections[k])); s.key = 'on' + j; s.prep = 'on'; s.threshold = 60; s.period = 6 + j; s.label = (6 + j) + 'th Period · On-level'; s.team = (6 + j) + 'th Period'; T.state.sections[s.key] = s; T.state.order.push(s.key); });
    const dsO = A.labDatasets('on').list.filter(d => !/^skill:/.test(d.id)).slice(0, 25);
    for (const d of ds.slice(0, 25)) for (const kind of kinds) for (const rows of ['course', 'class', 'vs:p2-acc']) for (const pct of [false, true]) {
      st.labPct = pct; st.labRows = rows; st.labKind = kind; st.labPrep = 'both'; st.labPick = { acc: d.id, on: dsO[(renders * 7) % dsO.length].id }; st.labBin = 0;
      let html; try { html = A.labMarkup('both', d.id, 2, true, true, true, kind); } catch (e) { note('both-throw', { id: d.id, kind, rows, e: e.message }); continue; } renders++;
      if (/NaN|undefined|Infinity/.test(html.replace(/<[^>]+>/g, ' ')) || /="[^"]*(NaN|undefined|Infinity)/.test(html)) note('both-nan-undefined', { id: d.id, on: st.labPick.on, kind, rows, at: (/.{60}(NaN|undefined|Infinity).{20}/.exec(html) || [''])[0] });
      const hit = idList.find(x => html.includes(x)); if (hit) note('both-identifier', { id: d.id, kind, rows });
      const doc = new DOMParser().parseFromString(html, 'text/html'); doc.querySelectorAll('.labRow:not(.thin), .labPie:not(.thin)').forEach(r => { const n = +(/n = (\d+)/.exec((r.querySelector('.labName small, .labPieHead small') || {}).textContent || '') || [])[1]; if (n < 5) note('both-row-under-MIN_N', { id: d.id, kind, rows, n }); });
    }
    return { renders, bad, idN: idList.length };
  });
  console.log('renders:', res.renders, 'identifiers checked:', res.idN);
  Object.entries(res.bad).forEach(([k, x]) => console.log(String(x.n).padStart(6), k, JSON.stringify(x.ex).slice(0, 300)));
  check(Object.keys(res.bad).length === 0, 'every screen agrees with the recount');
  check(errs.length === 0, 'no page errors ' + errs.join('|').slice(0, 300));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
