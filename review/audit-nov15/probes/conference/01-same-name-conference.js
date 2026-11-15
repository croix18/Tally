// CNF-01: two students with one name in a class (review 14 Nov item 3, "DONE"): the parent conference form of the
// second student shows the FIRST student's grade, missing work, tests and report-card grades.
// studentBooks / studentSummary.finals look the student up with norm(), which strips the "(ID …1234)" mark.
const H = require('./_h.js');
(async () => { const { b, p, errs, L, K } = await H.open({ q2: true });
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    A.closeQuarter && A.quarters().closed;   // nothing closed: Q1 is a kept copy, Q2 is the open gradebook
    const gb = s.grades; const ids = gb.ids;
    // pick two students with different grades and rename both to one name, as a Focus export with a same-name pair would
    const g = gb.students.map((n, i) => ({ i, r: A.computeGrade(A.openSec(s), i) })).filter(x => x.r && x.r.rounded != null);
    const a = g[0], bb = g.find(x => x.r.rounded !== a.r.rounded);
    gb.students[a.i] = 'DOE, JANE'; gb.students[bb.i] = 'DOE, JANE'; A.uniqueNames(gb.students, ids);
    T.save(); T.render();
    const nameA = gb.students[a.i], nameB = gb.students[bb.i];
    const truthB = A.computeGrade(A.openSec(s), bb.i).rounded, truthA = A.computeGrade(A.openSec(s), a.i).rounded;
    const dB = A.conferenceData(s, nameB);
    const missTruth = gb.assignments.filter(x => x.status && x.status[bb.i] === 'missing' && !/\bixl\b/i.test(x.name)).length;
    return { nameA, nameB, truthA, truthB, formB: dB.r && dB.r.rounded, retakeMissingB: dB.rt.missing.length, formMissingB: dB.missing.length + dB.missedTests.length, missTruth,
      findStudentGi: A.findStudent(s, nameB).gi, booksI: A.studentBooks(s, nameB).map(x => x.i), gbI: bb.i }; }, K);
  console.log('OBSERVED:', JSON.stringify(out));
  console.log('EXPECTED: the conference form for', out.nameB, 'reads its own row', out.gbI, '(grade', out.truthB + '%, ' + out.missTruth + ' missing)');
  L.check(out.formB === out.truthB, `the form's current grade is the student's own (${out.formB} vs ${out.truthB})`);
  L.check(out.booksI.every(i => i === out.gbI), 'studentBooks finds the student\'s own gradebook row');
  L.check(out.formMissingB === out.missTruth, 'the form lists the student\'s own missing work');
  L.check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); L.done(); })().catch(e => { console.error(e); process.exit(2); });
