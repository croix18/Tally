// WIF-11: a student with a modified IXL list (per-student skips) cannot reach the column's full points, since Tally's
// copy is one point per own skill at goal (pendingCopies: min(column, points)). The teacher's what-ifs and Show
// student still offer "If IXL were finished: every skill, 17/17", a grade the student cannot get by finishing their list;
// the quickest plan on the same page caps at the student's own list.
const S = require('./_setup.js');
(async () => { const { b, p, errs } = await S.open();
  const r = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    const u2 = T.unitsOf(s).find(u => u.short === 'Unit 2'); const col = gb.assignments.find(a => a.name === 'Unit 2 IXL');
    const i = gb.students.findIndex(n => { const f = A.findStudent(s, n); return f.ixl != null && A.points(s, u2, f.ixl) <= 3; });
    const name = gb.students[i]; const ix = A.findStudent(s, name).ixl; const key = A.ixlKeyAt(s, ix);
    // skip 5 of the unit's skills for this student only (the per-student skip, "tap the cell"), all below goal
    const below = u2.active.filter(k => { const v = A.eff(s, k, ix); return v == null || v < s.threshold; }).slice(0, 5);
    s.studentSkips[key] = s.studentSkips[key] || {}; below.forEach(k => s.studentSkips[key][A.skillKey(s.skills[k])] = true);
    col.status[i] = 'score'; col.values[i] = A.points(s, u2, ix);
    const own = A.activeFor(s, u2, ix).length;
    const div = document.createElement('div'); div.innerHTML = A.whatIfMarkup(A.openSec(s), i, A.retakeStatus(s, name));
    const row = [...div.querySelectorAll('tr')].find(tr => /Unit 2 IXL/.test(tr.textContent) && /every skill/.test(tr.textContent));
    // what finishing the whole own list really gives: every own skill at goal, then Tally's copy
    A.activeFor(s, u2, ix).forEach(k => s.scores[k][ix] = 100); const copy = A.pendingCopies(s, A.openSec(s), i, ix).find(c => c.a === col);
    return { own, max: col.max, row: row ? row.innerText.replace(/\s+/g, ' ') : null, copyTo: copy ? copy.to : null };
  }, S.K);
  console.log('OBSERVED: own list', r.own, 'skills, column', r.max, 'points; what-if row "' + r.row + '"; finishing every own skill copies', r.copyTo + '/' + r.max, 'into Focus');
  console.log('EXPECTED: "every skill" offers what finishing the student\'s own list gives:', r.copyTo + '/' + r.max, '(or the list is scaled to the column, and the copy says so)');
  S.check(r.row && r.row.includes('every skill, ' + r.copyTo + '/' + r.max), 'the IXL what-if is reachable by finishing the student\'s own list');
  S.check(errs.length === 0, 'no page errors');
  await b.close(); S.done(); })().catch(e => { console.error(e); process.exit(2); });
