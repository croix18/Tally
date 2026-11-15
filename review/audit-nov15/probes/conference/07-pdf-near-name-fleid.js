// CNF-07: the score report PDF matches by name only (matchPerson(people, name, '')). Its third pass takes a first name
// that starts the same ("HAY" ~ "HAYDEN"), and no FLEID check stops it: a row of a different student (another FLEID)
// is put on a roster student whose own FLEID Tally already holds. The Focus report has this guard (idClash, audit
// 22 Oct 2026: "a near-name took another student's scores"); the PDF path has nothing like it.
const H = require('./_h.js');
(async () => { const { b, p, errs, L, K } = await H.open({ q2: true });
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const nm = s.grades.students[0];   // SUTTER, HAYDEN SKYLER
    const last = nm.split(',')[0], first = nm.split(',')[1].trim().split(' ')[0];
    const cats = ['1. Number Sense'];
    // PM1 report: the student herself, FLEID …01
    A.importFastItems({ grade: 8, pm: 'PM1', year: '2026-27', cats, kind: 'items', students: [{ fleid: 'FL000000000001', name: nm, scale: 250, level: 3, pct: 60, cats: {} }] }, 'pm1.pdf');
    // PM2 report: she has not tested yet; another student on the teacher's Cambium roster, same last name, a first name that starts hers
    A.importFastItems({ grade: 8, pm: 'PM2', year: '2026-27', cats, kind: 'items', students: [{ fleid: 'FL000000000002', name: `${last}, ${first.slice(0, 3)}`, scale: 199, level: 1, pct: 2, cats: {} }] }, 'pm2.pdf');
    const h = A.testHistory(s, nm).map(x => `${x.pm} ${x.scale}`); const fl = A.fastInfo(s, nm).FLEID;
    return { student: nm.slice(0, 4) + '…', other: `${last.slice(0, 4)}…, ${first.slice(0, 3)}`, history: h, fleidNow: fl }; }, K);
  console.log('OBSERVED:', JSON.stringify(out));
  console.log('EXPECTED: the PM2 row (FLEID FL000000000002) is not this student (her FLEID is FL000000000001): it is kept as "not in your classes", her history stays PM1 250');
  L.check(!out.history.some(x => /^PM2/.test(x)), 'no PM2 from another FLEID: ' + out.history.join(', '));
  L.check(out.fleidNow === 'FL000000000001', 'her FLEID is not overwritten: ' + out.fleidNow);
  L.check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); L.done(); })().catch(e => { console.error(e); process.exit(2); });
