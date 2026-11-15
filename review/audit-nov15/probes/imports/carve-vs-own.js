// Exploration: a class carved from the course export vs the same class from its own export (the pool's columns for
// exactly those students): same skills, same scores, same points per unit per student? Real scrubbed course fixtures.
const H = require('./h.js'); const { fs, path } = H; const P = require(path.join(H.REPO, 'parser.js'));
(async () => {
  const fx = fs.readdirSync(path.join(H.REPO, 'fixtures')); const res = {};
  for (const [prefix, gbf, prep, sec] of [['course_on', 'focus_gradebook_pool_p2.csv', 'on', '1205050-7T2A-M_J-GR7_Math-Nation-FL-B.E.S.T.-7th-Grade_Math'], ['course_acc', 'focus_gradebook_pool_p1.csv', 'acc', '1205050-7T1A-M_J-ACC_Math-Nation-FL-B.E.S.T.-Accelerated-7th-Grade_Math']]) {
    const f = fx.find(x => x.startsWith(prefix)); const name = f.replace(/^course_(acc|on)_/, '');
    let st1;
    { const { b, p } = await H.open(); await H.imp(p, [{ fixture: f, name }]); await H.imp(p, [{ fixture: gbf }], { nc: { period: 2, prep } });
      st1 = await p.evaluate(() => { const T = window.__tally, A = window.__all; const s = T.state.sections['period-2'];
        const units = T.unitsOf(s); return { students: s.students, pts: Object.fromEntries(s.students.map((n, si) => [n, units.map(u => u.name + ':' + A.points(s, u, si) + '/' + A.totalFor(s, u, si)).join(',')])), skills: s.skills.length, pop: T.population(s).length }; }); await b.close(); }
    // the class's own export: the pool file with only those students' columns
    const rows = P.csvToRows(fs.readFileSync(path.join(H.REPO, 'fixtures', f), 'utf8')); const h = rows.findIndex(r => r.some(v => /skill name/i.test(v || '')));
    const keepIdx = rows[h].map((v, i) => i).filter(i => i < 5 && !(rows[h][i] && st1.students.includes(rows[h][i].trim())) || st1.students.includes(String(rows[h][i] || '').trim()));
    const q = v => v == null ? '' : '"' + String(v).replace(/"/g, '""') + '"';
    const own = rows.map(r => keepIdx.map(i => q(r[i])).join(',')).join('\n') + '\n';
    let st2;
    { const { b, p } = await H.open(); await H.imp(p, [{ name: `IXL-Score-Grid_2026-09-26_This-School-Year_${sec}.csv`, text: own }]);
      await H.imp(p, [{ fixture: gbf }]);
      st2 = await p.evaluate(() => { const T = window.__tally, A = window.__all; const k = T.state.order[0]; const s = T.state.sections[k];
        const units = T.unitsOf(s); return { key: k, students: s.students, pts: Object.fromEntries(s.students.map((n, si) => [n, units.map(u => u.name + ':' + A.points(s, u, si) + '/' + A.totalFor(s, u, si)).join(',')])), skills: s.skills.length, pop: T.population(s).length }; }); await b.close(); }
    const diff = Object.keys(st1.pts).filter(n => st1.pts[n] !== st2.pts[n]);
    res[prep] = { carved: st1.students.length, own: st2.students.length, skills: [st1.skills, st2.skills], pop: [st1.pop, st2.pop], diffStudents: diff.length, ex: diff.slice(0, 2).map(n => n + ' carved ' + st1.pts[n].slice(0, 120) + ' | own ' + (st2.pts[n] || '').slice(0, 120)) };
  }
  console.log(JSON.stringify(res, null, 1));
})().catch(e => { console.error(e); process.exit(2); });
