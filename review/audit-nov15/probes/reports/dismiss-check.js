const H = require('./h.js');
(async () => { const { b, p, K } = await H.open();
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const n = s.students;
    const put = (asOf, last) => { s.practice = {}; [0, 1].forEach(i => s.practice[A.norm(n[i])] = { asOf, questions: 5, minutes: 3, last, mastered: 0, proficient: 0, skills: {} }); };
    const items = () => { T.render(); return A.attentionItems(s).filter(a => a.dkey).map(a => a.text); };
    put('2026-11-10', '2026-11-01'); const a1 = items(); const it = A.attentionItems(s).find(a => a.dkey); T.state.dismissed = { [it.dkey]: '2026-11-15' }; const a2 = items();
    put('2026-11-10', '2026-11-01'); const a3 = items();               // same Quickview again
    put('2026-11-14', '2026-11-01'); const a4 = items();               // a newer Quickview, same idle students
    s.practice[A.norm(n[1])].last = '2026-11-13'; const a5 = items();  // one practiced
    return { a1, a2, a3, a4, a5 }; }, K);
  console.log(JSON.stringify(o)); await b.close(); })();
