const { open, synth, K } = require('./_load.js');
(async () => {
  const { b, p } = await open(); const keys = await p.evaluate(synth, K);
  const cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  const m = process.argv[2] || 'students';
  await cdp.send('Profiler.start');
  const t = await p.evaluate(([m, k]) => { const T = window.__tally; T.state.active = k; T.view.mode = m; const t0 = performance.now(); T.render(); return performance.now() - t0; }, [m, keys[0]]);
  const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map(n => [n.id, n])); const parent = new Map(); profile.nodes.forEach(n => (n.children || []).forEach(c => parent.set(c, n.id)));
  const incl = {}; profile.samples.forEach((id, j) => { const seen = new Set(); let x = id; while (x) { const f = byId.get(x).callFrame.functionName; if (f && !seen.has(f)) { seen.add(f); incl[f] = (incl[f] || 0) + profile.timeDeltas[j] / 1000; } x = parent.get(x); } });
  console.log(m, Math.round(t) + 'ms', Object.entries(incl).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([f, v]) => f + ':' + Math.round(v)).join(' '));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
