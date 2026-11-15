// CHT oracle + fuzz harness for the chart primitives and stats(). Independent re-implementation of the statistics;
// SVG of every chart form parsed and checked mark by mark. Prints a tally of disagreements by kind, with one example each.
// Run: TALLY_REPO=... node probes/00-fuzz-primitives.js [cases]
const path = require('path');
const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, fs, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
const N = +process.argv[2] || 3000;
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const res = await p.evaluate(N => {
    const A = window.__all; const bad = {}; const note = (k, ex) => { bad[k] = bad[k] || { n: 0, ex }; bad[k].n++; };
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648; const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    // ---------- oracle ----------
    const med = a => a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
    const O = vals => { const v = vals.slice().sort((a, b) => a - b), n = v.length; const h = Math.floor(n / 2);
      const lo = v.slice(0, h), up = v.slice(n - h); const q1 = n > 1 ? med(lo) : v[0], q3 = n > 1 ? med(up) : v[0]; const iqr = q3 - q1;
      const mean = v.reduce((a, b) => a + b, 0) / n; const mad = v.reduce((a, b) => a + Math.abs(b - mean), 0) / n;
      const off = iqr <= 1; const outs = off ? [] : v.filter(x => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr); const ins = v.filter(x => !outs.includes(x));
      const c = {}; v.forEach(x => c[x] = (c[x] || 0) + 1); const mc = Math.max(...Object.values(c)); const modes = mc === 1 ? null : Object.keys(c).filter(k => c[k] === mc).map(Number).sort((a, b) => a - b);
      return { n, min: v[0], max: v[n - 1], q1, median: med(v), q3, iqr, mean, mad, range: v[n - 1] - v[0], outliers: outs, wLo: ins[0], wHi: ins[ins.length - 1], mode: modes }; };
    const close = (a, b) => Math.abs(a - b) < 1e-9;
    const gen = () => { const kind = ri(0, 6), n = [5, 5, 6, 7, 8, ri(5, 12), ri(5, 40), ri(13, 90)][ri(0, 7)]; let max = [3, 6, 10, 12, 21, 23, 25, 35, 50, 100][ri(0, 9)];
      let v;
      if (kind === 0) v = Array.from({ length: n }, () => ri(0, max));                                  // uniform ints
      else if (kind === 1) { const c = ri(0, max); v = Array(n).fill(c); }                                // all equal
      else if (kind === 2) { const a = ri(0, max), b2 = ri(0, max); v = Array.from({ length: n }, () => rnd() < .5 ? a : b2); }  // two values
      else if (kind === 3) { const c = ri(0, max); v = Array.from({ length: n }, () => rnd() < .6 ? c : ri(0, max)); }     // heavy ties
      else if (kind === 4) v = Array.from({ length: n }, () => Math.round(rnd() * max * 2) / 2);          // halves (8.5)
      else if (kind === 5) v = Array.from({ length: n }, () => rnd() < .3 ? 0 : rnd() < .3 ? max : ri(0, max)); // zeros and maxes
      else { v = Array.from({ length: n }, () => ri(Math.round(max * .6), max)); v[0] = 0; }             // one far-low value
      return { v, max }; };
    const P = s => new DOMParser().parseFromString(s, 'image/svg+xml');
    let cases = 0;
    for (let t = 0; t < N; t++) { const { v, max } = gen(); cases++;
      // ---- stats ----
      const s = A.stats(v), o = O(v);
      ['n', 'min', 'max', 'q1', 'median', 'q3', 'iqr', 'mean', 'mad', 'range', 'wLo', 'wHi'].forEach(k => { if (!close(s[k], o[k])) note('stats.' + k, { v, tally: s[k], oracle: o[k] }); });
      if (JSON.stringify(s.outliers) !== JSON.stringify(o.outliers)) note('stats.outliers', { v, tally: s.outliers, oracle: o.outliers });
      if (JSON.stringify(s.mode && s.mode.slice().sort((a, b) => a - b)) !== JSON.stringify(o.mode)) note('stats.mode', { v, tally: s.mode, oracle: o.mode });
      // ---- histogram ----
      [0, 1, 2, 5, 10].forEach(bin => { const svg = A.chartHist(v, max, bin, {}); const d = P(svg); const bars = [...d.querySelectorAll('rect.bar')];
        const B = bin || A.autoBin(max); const nb = Math.max(1, Math.ceil(max / B - 1e-9));
        const counts = bars.map(r => +(/: (\d+) student/.exec(r.querySelector('title').textContent) || [])[1]);
        const tot = counts.reduce((a, b) => a + b, 0); if (tot !== v.length) note('hist.count-sum', { v, max, bin, tot });
        // oracle bins: [k*B,(k+1)*B) and the last bin closed at max
        const oc = Array(nb).fill(0); v.forEach(x => { let k = Math.floor(x / B); if (k >= nb) k = nb - 1; oc[k]++; });
        if (JSON.stringify(oc) !== JSON.stringify(counts)) note('hist.bins', { v, max, bin, tally: counts, oracle: oc });
        // heights proportional to counts
        const hs = bars.map(r => +r.getAttribute('height')); const ks = hs.map((h, i) => counts[i] ? h / counts[i] : null).filter(x => x != null); if (ks.some(k => Math.abs(k - ks[0]) > 1e-6)) note('hist.height', { v, max, bin });
        // labels: every value lies inside the range its bar's title states
        bars.forEach((r, i) => { const t2 = r.querySelector('title').textContent.split(':')[0]; const m = /^(\d+(?:\.\d+)?)(?:–(\d+(?:\.\d+)?))?$/.exec(t2); if (!m) { note('hist.label-parse', { t2 }); return; } const lo = +m[1], hi = m[2] != null ? +m[2] : +m[1];
          const inBin = v.filter(x => { let k = Math.floor(x / B); if (k >= nb) k = nb - 1; return k === i; }); const ints = v.every(Number.isInteger);
          if (ints && inBin.some(x => x < lo || x > hi)) note('hist.label-range', { v, max, bin, label: t2, inBin });
          if (!ints && i < nb - 1 && inBin.some(x => x === hi)) note('hist.label-ambiguous-decimal', { max, bin, label: t2 }); });
        const axisEnd = [...d.querySelectorAll('text.tl')].map(x => x.textContent).pop(); if (+axisEnd !== max && max % B) note('hist.axis-end-not-max', { max, bin: B, axisEnd });
      });
      // ---- bar graph (frequency) ----
      { const svg = A.chartFreq(v, max, {}); const d = P(svg); const bars = [...d.querySelectorAll('rect.bar')]; const counts = bars.map(r => +(/: (\d+) student/.exec(r.querySelector('title').textContent) || [])[1]);
        const tot = counts.reduce((a, b) => a + b, 0); if (tot !== v.length) note('freq.count-sum', { v, max, tot });
        if (max <= 25 && v.every(Number.isInteger)) { const labs = bars.map(r => +r.querySelector('title').textContent.split(':')[0]); labs.forEach((L, i) => { const oc = v.filter(x => x === L).length; if (oc !== counts[i]) note('freq.bar', { v, max, L, tally: counts[i], oracle: oc }); }); }
        if (!v.every(Number.isInteger) && max <= 25) note('freq.decimals-rounded-silently', { max, sample: v.filter(x => !Number.isInteger(x)).slice(0, 3) }); }
      // ---- dot plot ----
      { const svg = A.chartDots(v, max, {}); const d = P(svg); const dots = [...d.querySelectorAll('circle.dot')]; if (dots.length !== v.length) note('dots.count', { v, n: dots.length });
        const X = x => 30 + x / (max || 1) * (800 - 60); const byx = {}; dots.forEach(c => { const k = (+c.getAttribute('cx')).toFixed(3); byx[k] = (byx[k] || 0) + 1; });
        const oc = {}; v.forEach(x => { const k = X(x).toFixed(3); oc[k] = (oc[k] || 0) + 1; }); if (JSON.stringify(Object.entries(byx).sort()) !== JSON.stringify(Object.entries(oc).sort())) note('dots.positions', { v, max });
        const ticks = [...d.querySelectorAll('text.tl')].map(x => +x.textContent); if (ticks[ticks.length - 1] !== max) note('dots.axis-stops-short-of-max', { max, last: ticks[ticks.length - 1] }); }
      // ---- stem-and-leaf ----
      { const html = A.chartStem(v, max); const d = new DOMParser().parseFromString(html, 'text/html'); let leaves = [];
        d.querySelectorAll('tr').forEach(tr => { const st = +tr.querySelector('th').textContent; const L = tr.querySelector('td').textContent.trim(); const ls = L ? L.split(' ').map(Number) : []; if (ls.some((x, i) => i && x < ls[i - 1])) note('stem.unsorted', { v }); ls.forEach(l => leaves.push(st * 10 + l)); });
        const exp = v.map(Math.round).sort((a, b) => a - b); if (JSON.stringify(leaves) !== JSON.stringify(exp)) note('stem.values', { v, leaves });
        if (!v.every(Number.isInteger)) note('stem.decimals-rounded-undisclosed', { sample: v.filter(x => !Number.isInteger(x)).slice(0, 3), key: d.querySelector('.ghint').textContent }); }
      // ---- box plot geometry ----
      { const scale = max; const svg = A.boxSVG(s, scale, 800, { tukey: true, dots: true, stats: true }); const d = P(svg); const X = x => 14 + (800 - 44) * (x / scale);
        const box = d.querySelector('rect.labBox'); if (!close(+box.getAttribute('x'), X(o.q1))) note('box.q1', { v }); if (o.q3 > o.q1 && !close(+box.getAttribute('x') + +box.getAttribute('width'), X(o.q3))) note('box.q3', { v });
        const medl = d.querySelector('line.labMed'); if (!close(+medl.getAttribute('x1'), X(o.median))) note('box.median', { v });
        const wh = [...d.querySelectorAll('line.labWhisk')]; if (!close(+wh[0].getAttribute('x1'), X(o.wLo)) || !close(+wh[1].getAttribute('x2'), X(o.wHi))) note('box.whiskers', { v });
        const outs = [...d.querySelectorAll('circle.labOut')].map(c => +c.getAttribute('cx')); if (outs.length !== o.outliers.length || outs.some((x, i) => !close(x, X(o.outliers[i])))) note('box.outliers', { v });
        const dd = d.querySelectorAll('circle.labDot').length; if (dd !== v.length) note('box.dots', { v, dd });
        const tk = [...d.querySelectorAll('text.labTickTxt')].map(x => +x.textContent); if (tk[tk.length - 1] !== scale) note('box.axis-end', { scale, tk }); }
      // ---- circle graph: percent labels ----
      { const k = ri(2, 5); const parts = Array.from({ length: k }, (_, i) => ({ label: 'P' + i, value: ri(0, 30) })); const tot = parts.reduce((a, x) => a + x.value, 0); if (!tot) continue;
        [A.chartCircle(parts), A.chartPie(parts)].forEach((svg, which) => { const d = P(svg); const paths = [...d.querySelectorAll('path')];
          // angles
          let a0 = -Math.PI / 2; const nz = parts.filter(x => x.value);
          paths.forEach((pa, i) => { const pt = nz[i]; const tt = pa.querySelector('title').textContent; if (!tt.startsWith(pt.label + ':')) note('circle.title-order', { tt }); });
          const labs = [...d.querySelectorAll('text.val')].map(x => +/(\d+)%/.exec(x.textContent)[1]);
          const shown = nz.filter(x => x.value / tot >= 0.06).length; const sum = nz.map(x => Math.round(x.value / tot * 100)).reduce((a, b) => a + b, 0);
          if (labs.length === nz.length && sum !== 100) note('circle.labels-sum-not-100' + (which ? '-pie' : ''), { parts: parts.map(x => x.value), labs, sum });
          if (labs.length < nz.length) note('circle.small-slice-unlabelled' + (which ? '-pie' : ''), { parts: parts.map(x => x.value) }); }); }
      // ---- line chart: every point's height read back through the axis ticks ----
      { const L = ri(2, 9), S = ri(1, 3); const pct = rnd() < .5; const series = Array.from({ length: S }, (_, j) => ({ name: 'C' + j, values: Array.from({ length: L }, () => rnd() < .1 ? null : (pct ? ri(0, 100) : Math.round(rnd() * max * 10) / 10)) }));
        if (series.some(x => x.values.some(v => v != null))) { const svg = A.chartLines(series.map((_, i) => 'L' + i).slice(0, 0).concat(Array.from({ length: L }, (_, i) => 'D' + i)), series, pct ? { pct: true, min: 0, max: 100 } : {}); const d = P(svg);
          const tk = [...d.querySelectorAll('text.tl')].filter(t => t.getAttribute('text-anchor') === 'end').map(t => ({ v: parseFloat(t.textContent), y: +t.getAttribute('y') - 4 }));
          const a = tk[0], z = tk[tk.length - 1]; const val = y => a.v + (y - a.y) / (z.y - a.y) * (z.v - a.v);
          d.querySelectorAll('circle').forEach(c => { const m = /^(C\d) · D(\d+): ([\d.]+)/.exec(c.querySelector('title').textContent); const want = series[+m[1].slice(1)].values[+m[2]]; const got = val(+c.getAttribute('cy')); if (Math.abs(got - want) > 0.05 * Math.max(1, Math.abs(z.v - a.v)) / 10) note('lines.y', { want, got, ticks: tk.map(t => t.v) }); });
          const vals = series.flatMap(x => x.values).filter(v => v != null); if (Math.max(...vals) > z.v + 1e-9 || Math.min(...vals) < a.v - 1e-9) note('lines.off-axis', { min: Math.min(...vals), max: Math.max(...vals), axis: [a.v, z.v] });
          if (tk.some(t => !Number.isInteger(t.v))) note('lines.fractional-ticks', { ticks: tk.map(t => t.v) }); } }
      // ---- pearson ----
      { const n = ri(3, 30); const xs = Array.from({ length: n }, () => rnd()), ys = xs.map(x => x * ri(-2, 2) + rnd()); const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
        const r0 = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / Math.sqrt(xs.reduce((a, x) => a + (x - mx) ** 2, 0) * ys.reduce((a, y) => a + (y - my) ** 2, 0)); const r = A.pearson(xs, ys); if (Number.isFinite(r0) ? Math.abs(r - r0) > 1e-9 : r != null) note('pearson', { r, r0 }); }
      // ---- bars: zero baseline, length proportional ----
      { const items = Array.from({ length: ri(1, 6) }, (_, i) => ({ label: 'B' + i, value: Math.round(rnd() * max * 10) / 10 })); const d = P(A.chartBars(items, { max })); const rs = [...d.querySelectorAll('rect.bar')]; const x0 = +rs[0].getAttribute('x');
        rs.forEach((r, i) => { if (+r.getAttribute('x') !== x0) note('bars.baseline', {}); const k = +r.getAttribute('width') / (items[i].value || 1); if (items[i].value && Math.abs(k - (800 - 150 - 60) / max) > 1e-6 && Math.abs(k - (640 - 150 - 60) / max) > 1e-6) note('bars.length', { k, value: items[i].value, max }); }); }
    }
    return { cases, bad };
  }, N);
  console.log('cases:', res.cases);
  Object.entries(res.bad).forEach(([k, x]) => console.log(String(x.n).padStart(6), k, JSON.stringify(x.ex).slice(0, 260)));
  check(errs.length === 0, 'no page errors: ' + errs.join(' | ').slice(0, 300));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
