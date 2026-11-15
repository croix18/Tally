// GRD coverage: scatterSVG geometry. Every single dot sits at X(ixl), Y(tests) against the drawn ticks; merged dots name all.
const path = require('path'); const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
(async () => { const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage(); await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const A = window.__all; let seed = 5; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; const bad = []; let dots = 0, merged = 0;
    for (let t = 0; t < 300; t++) { const n = 8 + Math.floor(rnd() * 25); const pts = Array.from({ length: n }, (_, i) => ({ i, name: 'N' + (i % 5), label: 'N' + (i % 5), ixl: Math.round(rnd() * 100), tests: Math.round(rnd() * (t % 7 ? 100 : 130)), units: [1] }));
      const svg = A.scatterSVG(pts, 420, 260); const d = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const tl = [...d.querySelectorAll('text.tl')]; const xt = tl.filter(e => e.getAttribute('text-anchor') === 'middle').map(e => [parseFloat(e.textContent), +e.getAttribute('x')]); const yt = tl.filter(e => e.getAttribute('text-anchor') === 'end').map(e => [parseFloat(e.textContent), +e.getAttribute('y') - 4]);
      const fx = v => xt[0][1] + (v - xt[0][0]) * (xt[2][1] - xt[0][1]) / (xt[2][0] - xt[0][0]); const fy = v => yt[0][1] + (v - yt[0][0]) * (yt[2][1] - yt[0][1]) / (yt[2][0] - yt[0][0]);
      const seen = new Set();
      d.querySelectorAll('g.ptg').forEach(g => { const ids = g.getAttribute('data-pt').split(',').map(Number); ids.forEach(x => seen.add(x)); const c = g.querySelector('circle'); const cx = +c.getAttribute('cx'), cy = +c.getAttribute('cy'); dots++;
        if (ids.length === 1) { const q = pts[ids[0]]; if (Math.abs(cx - fx(q.ixl)) > 0.11 || Math.abs(cy - fy(q.tests)) > 0.11) bad.push({ t, q, cx, cy, ex: fx(q.ixl), ey: fy(q.tests) }); }
        else { merged++; ids.forEach(x => { const q = pts[x]; if (Math.hypot(cx - fx(q.ixl), cy - fy(q.tests)) > 9 * 2) bad.push({ t, far: q }); if (!g.getAttribute('aria-label').includes(`IXL ${q.ixl}% · assessments ${q.tests}%`)) bad.push({ t, tip: q }); }); } });
      if (seen.size !== n) bad.push({ t, lost: n - seen.size }); }
    return { dots, merged, bad: bad.slice(0, 5), nbad: bad.length }; });
  console.log(JSON.stringify(r)); check(!r.nbad, 'scatter geometry'); await b.close(); done(); })();
