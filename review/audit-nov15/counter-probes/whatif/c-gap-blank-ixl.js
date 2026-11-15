// Gap check: an IXL column whose cell is blank for a student (new column not yet entered): copy offered? retake? plan words?
const S = require('/home/claude/work/audit/whatif/probes/_setup.js');
(async () => { const { b, p } = await S.open();
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const col = gb.assignments.find(a => a.name === 'Unit 2 IXL');
    const i = gb.students.findIndex(n => { const f = A.findStudent(s, n); return f.ixl != null && A.points(s, T.unitsOf(s).find(u => u.short === 'Unit 2'), f.ixl) >= 3; }); const n = gb.students[i], ix = A.findStudent(s, n).ixl;
    col.status[i] = 'score'; col.values[i] = 0; const before = A.pendingCopies(s, A.openSec(s), i, ix).map(c => c.a.name + ':' + c.from + '->' + c.to);
    col.status[i] = 'blank'; col.values[i] = null;
    const after = A.pendingCopies(s, A.openSec(s), i, ix).map(c => c.a.name + ':' + c.from + '->' + c.to);
    const q = A.quickestPath(s, A.openSec(s), i, ix); const d = document.createElement('div'); d.innerHTML = A.quickestList(q);
    return { before, after, why: A.retakeWhy(A.retakeStatus(s, n)), ixlreq: [...d.querySelectorAll('li')].map(x => x.innerText.replace(/\s+/g, ' ')).filter(t => /Focus yet/.test(t)) }; }, S.K);
  console.log(JSON.stringify(r)); await b.close(); })();
