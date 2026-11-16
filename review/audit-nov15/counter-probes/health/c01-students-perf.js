// Counter HLT-01: Students screen render time on the auditor's load (6x30, 60 cols) and a realistic one (5x25, 30 cols), with a CPU profile.
process.env.TALLY_REPO = process.env.TALLY_REPO || '/home/claude/work/audit/counter-health/repo';
const { open, synth, K } = require('./_load.js');
// realistic variant: trim the synthesized classes in page
const trim = ([keys, nC, nS, nA]) => { const T = window.__tally, S = T.state;
  keys.slice(nC).forEach(k => { delete S.sections[k]; S.order = S.order.filter(x => x !== k); });
  keys.slice(0, nC).forEach(k => { const s = S.sections[k]; s.students = s.students.slice(0, nS); s.scores = s.scores.map(r => r.slice(0, nS)); s.roster = s.roster.split('\n').slice(0, nS).join('\n');
    const g = s.grades; g.students = g.students.slice(0, nS); g.ids = g.ids.slice(0, nS); g.assignments = g.assignments.slice(0, nA).map(a => ({ ...a, values: a.values.slice(0, nS), status: a.status.slice(0, nS) }));
    g.assignments.forEach(a => { a.missing = a.status.filter(x => x === 'missing').length; a.excused = a.status.filter(x => x === 'excused').length; }); });
  T.save(); T.render(); return keys.slice(0, nC); };
async function run(label, dims) {
  const { b, p } = await open(); let keys = await p.evaluate(synth, K); if (dims) keys = await p.evaluate(trim, [keys, ...dims]);
  const t = await p.evaluate(k => { const T = window.__tally; T.state.active = k; T.view.mode = 'students'; T.render(); const r = []; for (let j = 0; j < 3; j++) { const t0 = performance.now(); T.render(); r.push(Math.round(performance.now() - t0)); } return r; }, keys[0]);
  const cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  await p.evaluate(() => window.__tally.render()); const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map(n => [n.id, n])); const parent = new Map(); profile.nodes.forEach(n => (n.children || []).forEach(c => parent.set(c, n.id)));
  const incl = {}, self = {}; profile.samples.forEach((id, j) => { const dt = profile.timeDeltas[j] / 1000; const sf = byId.get(id).callFrame.functionName || '(anon)'; self[sf] = (self[sf] || 0) + dt; const seen = new Set(); let x = id; while (x) { const f = byId.get(x).callFrame.functionName; if (f && !seen.has(f)) { seen.add(f); incl[f] = (incl[f] || 0) + dt; } x = parent.get(x); } });
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([f, v]) => f + ':' + Math.round(v)).join(' ');
  console.log(label, 'renders ms', JSON.stringify(t)); console.log('  inclusive', top(incl)); console.log('  self', top(self));
  await b.close();
}
(async () => { await run('auditor 6x30x60', null); await run('realistic 5x25x30', [5, 25, 30]); })().catch(e => { console.error(e); process.exit(2); });
