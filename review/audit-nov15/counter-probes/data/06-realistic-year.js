// Counter probe for DAT-06: how full does localStorage get in a REALISTIC year for Croix (NOTES "Croix's setup"):
// 5 classes (acc 23 + 20, on-level 13 + 16 + 19 = 91 students), real skill lists (acc 219, on-level 177 from the course
// fixtures), two course pools of 91, one IXL import a week (36 weeks), one gradebook import a week (36 gradeSnapshots,
// app's own writer), Q1-Q3 kept + Q4 live, with the real class's notes/reports/family/overrides etc. from dat-lib.
// Also measures how this Chromium counts the quota (ASCII vs non-Latin-1, empty storage).
// Prints numbers; exits 0 if the realistic year fits under 80% of the measured limit, 1 otherwise.
const path = require('path');
const D = require('/home/claude/work/audit/data/probes/dat-lib.js');
const P = require(path.join(D.REPO, 'parser.js'));
const fs = require('fs');
(async () => {
  const pool = f => { const g = P.parseIxlGrid(P.csvToRows(fs.readFileSync(path.join(D.REPO, 'fixtures', fs.readdirSync(path.join(D.REPO, 'fixtures')).find(x => x.startsWith(f))), 'utf8'))); return { students: g.students, skills: g.skills, scores: g.scores }; };
  const pools = { acc: pool('course_acc_'), on: pool('course_on_') };
  const { b, p, errs } = await D.open(); await D.loadClass(p); await D.populate(p);
  const lim = await p.evaluate(() => { const saved = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); saved[k] = localStorage.getItem(k); } localStorage.clear();
    const probe = ch => { let lo = 0, hi = 12e6; while (hi - lo > 1000) { const mid = Math.floor((lo + hi) / 2); try { localStorage.setItem('k', ch.repeat(mid)); lo = mid; } catch (e) { hi = mid; } } localStorage.removeItem('k'); return lo; };
    const r = { ascii: probe('x'), latin1: probe('é'), bmp: probe('€') }; for (const k in saved) localStorage.setItem(k, saved[k]); return r; });
  console.log('empty-storage max value length (chars): ' + JSON.stringify(lim) + '  (Tally assumes 5,242,880)');
  const y = await p.evaluate(([K, pools]) => { const A = window.__all, T = window.__tally, st = A.state; const src = JSON.parse(JSON.stringify(T.stateForSave().sections[K])); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const realA = src.grades.assignments.length, q1A = (src.qArchive[1] && src.qArchive[1].gb.assignments.length) || 0;
    const plan = [['acc', 23], ['acc', 20], ['on', 13], ['on', 16], ['on', 19]];
    st.pools = { acc: { ...pools.acc, date: '2027-05-20', file: 'acc.csv', importedAt: '2027-05-20T16:00:00.000Z' }, on: { ...pools.on, date: '2027-05-20', file: 'on.csv', importedAt: '2027-05-20T16:00:00.000Z' } };
    const keys = [];
    plan.forEach(([prep, n], c) => { const s = JSON.parse(JSON.stringify(src)); const pl = pools[prep]; s.key = 'period-' + (c + 1); s.label = 'P' + (c + 1); s.prep = prep; s.threshold = prep === 'acc' ? 67 : 60; s.pool = false; s.period = c + 1;
      const real = src.students; const names = Array.from({ length: n }, (_, i) => real[i % real.length] + (i >= real.length ? ' II' : '') + (c ? ' ' + 'ABCDE'[c] : ''));
      s.students = names; s.skills = pl.skills.map(x => ({ ...x })); s.scores = s.skills.map(() => names.map(() => rnd() < .3 ? null : Math.round(rnd() * 70)));
      s.best = null; s.history = []; s.gradeHistory = []; s._keys = null;
      const remap = o => { const out = {}; const vs = Object.values(o || {}); names.forEach((nm, i) => { if (vs.length) out[A.norm(nm)] = vs[i % vs.length]; }); return out; };
      // per-student records: the real class's, spread over this class's names (notes, reports, family, conference forms)
      s.stuNotes = remap(src.stuNotes); s.reportLog = remap(src.reportLog); s.family = remap(src.family); s.confForms = remap(src.confForms);
      // a heavier-than-fixture but plausible record load: 4 notes and 9 weekly reports a student
      names.forEach(nm => { const k = A.norm(nm); s.stuNotes[k] = Array.from({ length: 4 }, (_, i) => ({ id: 'n' + i, at: '2026-10-01T12:00:00.000Z', text: 'Ordinary note about homework and participation ' + i }));
        s.reportLog[k] = Array.from({ length: 9 }, (_, i) => ({ date: '2026-1' + (i % 2) + '-0' + (1 + i % 9), q: 1 + (i % 4), gb: '2026-09-01', ix: '2026-09-01', grade: 80, missing: 1, ixl: 2 })); });
      const gb = s.grades; const fix = g => { g.students = names.map(x => x.split(' ').reverse().join(', ')); g.ids = names.map((_, i) => String(2000000 + c * 100 + i)); g.overall = names.map(() => Math.round(60 + rnd() * 40));
        g.assignments.forEach(a => { a.values = names.map(() => rnd() < .1 ? null : Math.round(rnd() * (a.max || 10))); a.status = names.map(() => rnd() < .08 ? 'missing' : null); if (a.codes) a.codes = names.map(() => null); }); return g; };
      s.grades = fix(gb); s.roster = s.grades.students.map((x, i) => x + '\t' + s.grades.ids[i]).join('\n');
      for (const q of [1, 2, 3]) if (src.qArchive[1]) { const qa = JSON.parse(JSON.stringify(src.qArchive[1])); fix(qa.gb); qa.final = names.map(() => 80); s.qArchive[q] = qa; }
      st.sections[s.key] = s; st.order.push(s.key); keys.push(s.key);
      for (let w = 0; w < 36; w++) { const day = new Date(Date.UTC(2026, 7, 14 + w * 7, 16)).toISOString(); s.date = A.localDayOf(day); s.importedAt = day;
        s.scores = s.scores.map(r => r.map(v => v == null ? (rnd() < .08 ? 40 : null) : Math.min(100, v + Math.round(rnd() * 6)))); s._keys = null; A.mergeBest(s); A.snapshot(s);
        s.grades.importedAt = day; try { A.gradeSnapshot(s); } catch (e) {} }
    });
    delete st.sections[K]; st.order = st.order.filter(k => k !== K);
    const json = JSON.stringify(T.stateForSave()); const one = st.sections['period-1']; const parts = {}; for (const k of Object.keys(one)) parts[k] = JSON.stringify(one[k] === undefined ? null : one[k]).length;
    const saved = T.save(); const use = A.storageUse();
    return { realQ2Assignments: realA, realQ1Assignments: q1A, chars: json.length, saved, usePct: use.pct, hist: one.history.length, gh: (one.gradeHistory || []).length, perClassP1: Object.entries(parts).sort((a, b) => b[1] - a[1]).slice(0, 6), pools: JSON.stringify(st.pools).length };
  }, [D.K, pools]);
  console.log('OBSERVED realistic year:', JSON.stringify(y));
  const frac = y.chars / lim.ascii; console.log('fraction of measured limit: ' + (100 * frac).toFixed(1) + '%');
  D.L.check(y.saved === true && frac < 0.8, 'a realistic year saves with room to spare');
  await b.close(); D.L.done();
})().catch(e => { console.error(e); process.exit(2); });
