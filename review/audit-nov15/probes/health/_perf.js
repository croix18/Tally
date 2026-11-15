const { open, synth, K } = require('./_load.js');
(async () => {
  const { b, p, errs } = await open(); const keys = await p.evaluate(synth, K);
  const cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  const modes = ['home', 'units', 'grades', 'students', 'reports', 'seating'];
  const res = {};
  for (const m of modes) {
    await cdp.send('Profiler.start');
    const t = await p.evaluate(([m, k]) => { const T = window.__tally; T.state.active = k; T.view.mode = m; const t0 = performance.now(); for (let r = 0; r < 3; r++) T.render(); return (performance.now() - t0) / 3; }, [m, keys[0]]);
    const { profile } = await cdp.send('Profiler.stop');
    const self = {}; const dt = profile.timeDeltas; const byId = new Map(profile.nodes.map(n => [n.id, n]));
    profile.samples.forEach((id, j) => { const n = byId.get(id); const f = n.callFrame.functionName || '(anon)'; self[f] = (self[f] || 0) + (dt[j] || 0) / 1000; });
    const top = Object.entries(self).filter(([f]) => !/^\((idle|program|garbage)/.test(f)).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, ms]) => f + ' ' + (ms / 3).toFixed(0));
    res[m] = { ms: Math.round(t), top };
  }
  // engines
  const eng = await p.evaluate(keys => { const T = window.__tally, A = window.__all; const tm = f => { const t0 = performance.now(); f(); return Math.round(performance.now() - t0); };
    const s = T.state.sections[keys[0]];
    return { gradeAll6: tm(() => keys.forEach(k => A.gradeAll(T.state.sections[k]))), classAvg6: tm(() => keys.forEach(k => A.classAverage(T.state.sections[k]))), population6: tm(() => keys.forEach(k => T.population(T.state.sections[k]))), unitsOf1000: tm(() => { for (let i = 0; i < 1000; i++) T.unitsOf(s); }), points30x6: tm(() => { const us = T.unitsOf(s); for (let i = 0; i < 30; i++) us.forEach(u => A.points(s, u, i)); }), ixlFor30: tm(() => { for (let i = 0; i < 30; i++) A.ixlFor(s, i); }) }; }, keys);
  console.log(JSON.stringify({ res, eng, errs: errs.slice(0, 3) }, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
