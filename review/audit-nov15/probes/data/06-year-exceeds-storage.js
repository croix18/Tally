// DAT-06: a full school year (6 classes x 30 students x 300 skills, 40 IXL import days, Q1-Q3 kept + Q4 live with 40
// assignments each, 36 gradebook imports, notes, reports, family) built with the app's own writers (snapshot, mergeBest)
// does not fit in Chromium's localStorage: save() fails with QuotaExceededError. CFG='{...}' env changes the year.
// (snapshot, gradeSnapshot, mergeBest), measured against what this Chromium's localStorage really accepts.
const D = require('./dat-lib.js');
(async () => {
  const { b, p, errs } = await D.open(); await D.loadClass(p); await D.populate(p);
  const r = await p.evaluate(K => { const A = window.__all, T = window.__tally, st = A.state; const s = st.sections[K];
    const sz = o => JSON.stringify(o === undefined ? null : o).length; const per = {}; for (const k of Object.keys(s)) per[k] = sz(s[k]);
    const top = {}; for (const k of Object.keys(st)) if (k !== 'sections') top[k] = sz(st[k]);
    return { students: s.students.length, skills: s.skills.length, gbA: s.grades.assignments.length, hist: s.history.length, per: Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 14), top: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 6), total: sz(T.stateForSave()) }; }, D.K);
  console.log(JSON.stringify(r));
  // the real limit of this browser
  const lim = await p.evaluate(() => { const k = 'dat.fill'; let lo = 0, hi = 20e6; while (hi - lo > 50000) { const mid = Math.floor((lo + hi) / 2); try { localStorage.setItem(k, 'x'.repeat(mid)); lo = mid; } catch (e) { hi = mid; } } localStorage.removeItem(k); return lo; });
  console.log('max single value chars accepted ~', lim);
  // a synthetic year: 6 classes x 30 students x 300 skills, 40 import days, Q1-Q3 kept + Q4 live (40 assignments each), 36 gradebook snapshots, notes, reports, family
  const y = await p.evaluate(([K, CFG]) => { const A = window.__all, T = window.__tally, st = A.state; const src = st.sections[K]; let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const { NC, NS, NK, ND, NA, NG } = CFG;
    const mkGb = (q, names) => ({ students: names.map(n => n.split(' ').reverse().join(', ')), ids: names.map((_, i) => String(1000000 + i)), overall: names.map(() => Math.round(rnd() * 100)), importedAt: '2026-0' + (q + 7) + '-10T12:00:00.000Z', file: 'Gradebook Q' + q + ' synthetic export.csv',
      assignments: Array.from({ length: NA }, (_, j) => ({ name: 'Q' + q + ' Assignment number ' + j + ' (synthetic)', category: j % 3 ? 'Classwork' : 'Assessments', categoryFromFile: true, max: 20, values: names.map(() => Math.round(rnd() * 20)), status: names.map(() => rnd() < .1 ? 'missing' : 'ok'), missing: 0, excused: 0, due: '2026-09-' + String(1 + j % 28).padStart(2, '0'), assignedOn: '2026-09-01' })) });
    for (let c = 0; c < NC; c++) { const s = JSON.parse(JSON.stringify(T.stateForSave().sections[K])); s.key = 'SYN-' + c; s.label = 'Period ' + (c + 1); s.period = c + 1; s.pool = false; s.qArchive = {};
      const names = Array.from({ length: NS }, (_, i) => 'KAI' + c + 'N' + i + ' MORALES');
      s.students = names; s.skills = Array.from({ length: NK }, (_, k) => ({ unit: 'Unit ' + (1 + Math.floor(k / 30)) + ': Synthetic unit title', lesson: 'L' + k, name: 'Synthetic skill name number ' + k + ' about equations', id: 'S' + k.toString(36).toUpperCase().padStart(3, 'A') }));
      s.scores = s.skills.map(() => names.map(() => rnd() < .2 ? null : Math.round(rnd() * 100))); s.best = null; s.history = []; s.gradeHistory = []; s.roster = names.map(n => n.split(' ').reverse().join(', ') + '\t' + (1000000 + names.indexOf(n))).join('\n');
      s.stuNotes = {}; s.family = {}; s.reportLog = {}; s.confForms = {}; s.practice = {}; s.seatInfo = {}; s.overrides = {}; s._keys = null;
      st.sections[s.key] = s; st.order.push(s.key);
      for (let d = 0; d < ND; d++) { s.date = A.localDayOf(new Date(Date.UTC(2026, 7, 12 + d * 6, 16)).toISOString()); s.importedAt = s.date + 'T16:00:00.000Z'; s.scores = s.scores.map(r => r.map(v => v == null ? (rnd() < .1 ? 50 : null) : Math.min(100, v + Math.round(rnd() * 5)))); s._keys = null; A.mergeBest(s); A.snapshot(s); }
      for (let q = 1; q <= 3; q++) { const gb = mkGb(q, names); s.qArchive[q] = { gb, map: {}, cats: null, final: names.map(() => 80), at: '2026-10-09T12:00:00.000Z', file: gb.file }; }
      s.grades = mkGb(4, names);
      for (let w = 0; w < NG; w++) { s.gradeHistory.push({ date: A.localDayOf(new Date(Date.UTC(2026, 7, 14 + w * 7, 16)).toISOString()), at: '', file: 'x.csv', q: 1 + Math.floor(w / 9), students: s.grades.students.slice(), grade: names.map(() => Math.round(rnd() * 100)), missing: names.map(() => Math.floor(rnd() * 3)), cats: { Classwork: names.map(() => Math.round(rnd() * 1000) / 10), Assessments: names.map(() => Math.round(rnd() * 1000) / 10) }, assignments: s.grades.assignments.map(a => ({ name: a.name, max: 20, due: a.due, avg: 71.234567, n: 30, missing: 2 })) }); }
      names.forEach(n => { const k = A.norm(n); s.stuNotes[k] = Array.from({ length: 5 }, (_, i) => ({ id: 'n' + i, at: '2026-10-01T12:00:00.000Z', text: 'A synthetic note of ordinary length about homework and participation, number ' + i })); s.reportLog[k] = Array.from({ length: 12 }, (_, i) => ({ date: '2026-' + String(8 + Math.floor(i / 3)).padStart(2, '0') + '-1' + (i % 3), q: 1, gb: '2026-09-01', ix: '2026-09-01', grade: 80, missing: 1, ixl: 2 })); s.family[k] = { contacts: [{ id: 'a', name: 'Parent Synthetic', rel: 'Mother', phone: '555-0100', email: 'parent@example.com', note: '' }, { id: 'b', name: 'Parent Two', rel: 'Father', phone: '555-0101', email: '', note: '' }], log: Array.from({ length: 4 }, (_, i) => ({ id: 'l' + i, at: '2026-10-0' + (i + 1), how: 'Call', who: 'Parent Synthetic', text: 'Talked about missing work and the retake' })) }; });
    }
    const ex = st.sections['SYN-0'].history[5]; window.__ex = JSON.stringify({ keys: Object.keys(ex), per: JSON.stringify(ex.per).slice(0, 300), pu: JSON.stringify(ex.pu).slice(0, 300), ua: JSON.stringify(ex.ua).slice(0, 200), best: JSON.stringify(st.sections['SYN-0'].best).slice(0, 200) });
    delete st.sections[K]; st.order = st.order.filter(k => k !== K);
    const json = JSON.stringify(T.stateForSave()); const one = st.sections['SYN-0']; const parts = {}; for (const k of Object.keys(one)) parts[k] = JSON.stringify(one[k] === undefined ? null : one[k]).length;
    let ok = true, err = ''; try { localStorage.setItem('tally.v1', json); } catch (e) { ok = false; err = e.name; }
    const saved = T.save();
    return { cfg: CFG, chars: json.length, perClass: Object.entries(parts).sort((a, b) => b[1] - a[1]).slice(0, 8), setItem: ok, err, saveReturned: saved, use: A.storageUse().pct }; }, [D.K, JSON.parse(process.env.CFG || '{"NC":6,"NS":30,"NK":300,"ND":40,"NA":40,"NG":36}')]);
  const { check, done } = D.L; console.log('OBSERVED:', JSON.stringify({ stateChars: y.chars, browserMaxChars: lim, save: y.saveReturned, err: y.err, biggestPerClass: y.perClass.slice(0, 4) }));
  console.log('EXPECTED:', 'a school year of his classes fits in this browser with room to spare (save() returns true)');
  check(y.saveReturned === true, 'a full year saves'); check(errs.length === 0, 'no page errors: ' + errs.join(' | ')); await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
