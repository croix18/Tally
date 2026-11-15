// CNF-06: a notebook check (Assessments category in Focus) that is not handed in is drafted on the parent form as a
// test that was "not taken yet", and counted among "tests or quizzes not taken yet". The 21 Oct rules (REAL_TEST)
// already say a notebook check is not a test; the missed-test lines ignore that. Real fixture data, weekly.
const H = require('./_h.js');
(async () => { const { b, p, errs, L, K } = await H.open({ q2: true });
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    const hits = A.classStudents(s).map(nm => { const d = A.conferenceData(s, nm); const dr = A.conferenceDraft(d); const w = A.conferenceWork(d);
      const nb = d.missedTests.filter(t => /notebook/i.test(t.name)).map(t => t.name);
      return nb.length ? { nm: nm.slice(0, 3) + '…', nb, concern: dr.concerns.split('\n').find(l => /not taken/.test(l)), work: w.split('\n').filter(l => /Not taken|Notebook/.test(l)) } : null; }).filter(Boolean);
    return { n: hits.length, first: hits[0] }; }, K);
  console.log('OBSERVED:', JSON.stringify(out));
  console.log('EXPECTED: a missing notebook check is listed with the work to turn in ("Turn in"), never as a test or quiz "not taken yet"');
  L.check(out.n === 0 || !/not taken/.test(out.first.concern || ''), 'no notebook check is drafted as "not taken yet" (' + out.n + ' students affected in the fixture class)');
  L.check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); L.done(); })().catch(e => { console.error(e); process.exit(2); });
