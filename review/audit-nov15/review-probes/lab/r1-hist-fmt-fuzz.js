// Counter-review: CHT-01/CHT-12 bins and HLT-03/CHT-14 number formats, against an oracle written here.
const path = require('path'); const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '..');
const lib = require(path.join(REPO, 'tests/lib.js')); const { chromium, exe, APP, check, done } = lib;
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(APP));
  const out = await p.evaluate(() => {
    const A = window.__all; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const P = s => new DOMParser().parseFromString(s, 'image/svg+xml');
    // ---- bins: every value in exactly one bar whose label is true ----
    const fails = []; const inLabel = (lab, x, ints, last) => { const m = /^(-?[\d.]+)(?:–(-?[\d.]+))?$/.exec(lab); if (!m) return null; const lo = +m[1], hi = m[2] == null ? lo : +m[2];
      if (m[2] == null) return x === lo; if (ints) return x >= lo && x <= hi; return x >= lo && (last ? x <= hi : x < hi); };
    const MAXES = [1, 2, 10, 11, 25, 26, 27, 40, 100];
    for (let t = 0; t < 3000; t++) {
      const max = MAXES[t % MAXES.length]; const halves = t % 3 === 0; const n = 5 + Math.floor(rnd() * 30);
      const vals = []; for (let i = 0; i < n; i++) { let x = Math.floor(rnd() * (max + 1)); if (halves && x < max && rnd() < .4) x += .5; vals.push(x); }
      const ints = vals.every(Number.isInteger);
      for (const kind of ['hist', 'bar']) for (const bin of kind === 'hist' ? [0, 1, 2, 5, 10] : [0]) {
        const svg = kind === 'hist' ? A.chartHist(vals, max, bin, {}) : A.chartFreq(vals, max, {}); const d = P(svg);
        const bars = [...d.querySelectorAll('rect.bar title')].map(tt => { const m = /^(.*): (\d+) student/.exec(tt.textContent); return { lab: m[1], n: +m[2] }; });
        const total = bars.reduce((a, x) => a + x.n, 0);
        const histIsBar = kind === 'bar' && /histogram/.test(svg);
        // for each bar, how many values its label truly covers; and whether each value is covered by exactly one label
        const cover = vals.map(x => bars.filter((bb, i) => inLabel(bb.lab, x, ints, i === bars.length - 1)).length);
        const truthful = bars.every((bb, i) => vals.filter(x => inLabel(bb.lab, x, ints, i === bars.length - 1)).length === bb.n);
        const top = A.histTop(kind, vals, max, bin, false); const drawn = Math.max(...bars.map(x => x.n));
        if (total !== vals.length || !truthful || cover.some(c => c !== 1) || top !== drawn)
          if (!(kind === "bar" && !ints)) fails.push({ kind, max, bin, vals: vals.slice().sort((a, b) => a - b).join(','), total, n: vals.length, bars: bars.filter(x => x.n).map(x => x.lab + ':' + x.n).join(' '), top, drawn, multi: cover.filter(c => c !== 1).length });
      }
    }
    // two rows on one Board, one all whole numbers, one with a half: do their bars sit on the same x positions?
    const xs = s => [...P(s).querySelectorAll('rect.bar')].map(r => +(+r.getAttribute('x')).toFixed(1));
    const rowInt = xs(A.chartHist([0, 3, 5, 7, 9, 10], 10, 1, {})), rowHalf = xs(A.chartHist([0, 3, 5, 7.5, 9, 10], 10, 1, {}));
    // ---- formats against an exact oracle (values in halves or tenths -> integers) ----
    const fmtFails = []; const half = q => { const t = Math.floor(q); return t + (q - t >= .5 - 1e-12 ? 1 : 0); };   // round half up on an exact count of hundredths
    const exact = (num, den) => { // number num/den shown: exact if it has <=2 decimals, else nearest tenth half up (away from zero), never -0.0
      const neg = num < 0; const a = Math.abs(num); if ((a * 100) % den === 0) { const h = a * 100 / den; if (h % 100 === 0) return (neg && h ? '-' : '') + h / 100; let s = (h / 100).toFixed(2).replace(/0$/, ''); return (neg ? '-' : '') + s; }
      const tenths = Math.floor((a * 10 * 2 + den) / (2 * den)); const s = (tenths / 10).toFixed(1); return (neg && tenths ? '-' : '') + s; };
    const one = (num, den) => { const neg = num < 0, a = Math.abs(num); const tenths = Math.floor((a * 20 + den) / (2 * den)); return (neg && tenths ? '-' : '') + (tenths / 10).toFixed(1); };
    for (let t = 0; t < 4000; t++) {
      const scale = [1, 2, 10][t % 3]; const n = 2 + Math.floor(rnd() * 25); const neg = t % 5 === 0;
      const ints = []; for (let i = 0; i < n; i++) ints.push(Math.floor(rnd() * 200 * scale / 10) - (neg ? 60 * scale / 10 : 0));   // value = int / scale
      if (t % 7 === 0) { ints.length = 20; ints.fill(600 * scale / 10 * 1, 0, 19); ints[19] = 610 * scale / 10; }   // 1201/20 = 60.05 style
      const vals = ints.map(k => k / scale); const st = A.stats(vals);
      const s = ints.slice().sort((a, b) => a - b); const N = s.length;
      const medI = a => { const m = a.length; return m % 2 ? [a[(m - 1) / 2] * 2, 2] : [a[m / 2 - 1] + a[m / 2], 2]; };   // numerator over 2*scale
      const hf = Math.floor(N / 2), lo = s.slice(0, hf), up = s.slice(N % 2 ? hf + 1 : hf);
      const [mn, md] = medI(s), [q1n] = N > 1 ? medI(lo) : [s[0] * 2], [q3n] = N > 1 ? medI(up) : [s[0] * 2];
      const sum = s.reduce((a, x) => a + x, 0);
      // MAD exactly: sum |x - sum/N| / N  => sum |N x - sum| / (N^2) in units of 1/scale
      const madNum = s.reduce((a, x) => a + Math.abs(N * x - sum), 0);
      const want = { median: exact(mn, 2 * scale), q1: exact(q1n, 2 * scale), q3: exact(q3n, 2 * scale), iqr: exact(q3n - q1n, 2 * scale), mean: one(sum, N * scale), mad: one(madNum, N * N * scale) };
      const got = { median: A.fmtN(st.median), q1: A.fmtN(st.q1), q3: A.fmtN(st.q3), iqr: A.fmtN(st.iqr), mean: A.fmt1(st.mean), mad: A.fmt1(st.mad) };
      for (const k in want) if (want[k] !== got[k]) fmtFails.push(k + ' ' + ints.slice(0, 6).join(',') + '../' + scale + ' want ' + want[k] + ' got ' + got[k]);
      // the Race's gain: g = sum of deltas / m
      const m = 1 + Math.floor(rnd() * 30); const gs = Math.floor(rnd() * 200) - 100; const g = gs / m;
      const lb = A.lbMarkup([{ key: 'x', prep: 'acc', name: 'P1', label: 'P1', students: m, assignedUnits: [], assignedSkills: 1, done: 1, possible: 2, doneEach: 1, completion: .5, gain: g, active: .5, movers: 1, measured: m, thrChanged: false, basisChanged: false, prevDate: '2026-11-01', date: '2026-11-08', rank: 1 }], 'acc');
      const line = (/([+−]\d+\.\d) skills per student/.exec(new DOMParser().parseFromString(lb, 'text/html').body.textContent) || [])[1];
      const w = one(gs, m); const wantG = (w.startsWith('-') ? '−' + w.slice(1) : '+' + w);
      if (line !== wantG) fmtFails.push('gain ' + gs + '/' + m + ' want ' + wantG + ' got ' + line);
    }
    const minus0 = [A.fmtN(-0.04), A.fmt1(-0.04), A.fmtV(-0.04), A.fmtN(-0.001), A.fmt1(-1e-12), A.fmtN(1e-7), A.fmtN(2.675), A.fmtN(-2.25)];
    return { fails: fails.length, sample: fails.slice(0, 6), rowInt, rowHalf, fmtFails: fmtFails.length, fmtSample: fmtFails.slice(0, 8), minus0 };
  });
  console.log(JSON.stringify(out, null, 1));
  check(out.fails === 0, 'every value in exactly one bar with a true label; histTop agrees with the drawn bars');
  check(JSON.stringify(out.rowInt) === JSON.stringify(out.rowHalf), 'two rows (whole numbers / one half) at bin 1 put bars on the same x positions');
  check(out.fmtFails === 0, 'stats and gain formats agree with the exact oracle');
  check(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
