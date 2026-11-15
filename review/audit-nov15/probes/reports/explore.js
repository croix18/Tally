const H = require('./h.js');
(async () => { const { b, p, errs, K } = await H.open({ q2: process.argv[2] === 'q2' });
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const og = A.openSec(s);
    return { q: T.liveQuarter(s), cq: A.currentQuarter(), keys: Object.keys(s).join(','), gbkeys: Object.keys(gb).join(','), nst: gb.students.length, ns: s.students.length, thr: s.threshold, useBest: T.state.settings.useBest,
      asg: og.grades.assignments.map(a => a.name + '|' + a.max + '|' + A.catOf(s.prep, a.name) + '|' + (a.status || []).filter(x => x === 'missing').length + '|' + a.missing + '|' + [...new Set(a.status)].join('/')),
      units: T.unitsOf(s).map(u => [u.short, u.title, u.assigned, u.total, A.unitClosed(s, u), A.unitClosed(og, u), u.current, u.num].join('|')), rows: A.gbRows(s).slice(0, 3), stu0: gb.students.slice(0, 3), dd: gb.exportedAt + ' ' + gb.importedAt + ' ' + s.date }; }, K);
  console.log(JSON.stringify(o, null, 1).slice(0, 5000)); console.log(errs); await b.close(); })();
