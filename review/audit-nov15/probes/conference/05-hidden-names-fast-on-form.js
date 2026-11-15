// CNF-05: with Hide names on, the student page hides FAST ("Hidden while names are hidden") and the conference
// dialog hides the FAST flags and the FAST gain line, but the form's "FAST / EBA test history" box is still filled
// with the student's levels, scale scores and percentiles.
const H = require('./_h.js');
(async () => { const { b, p, errs, L, K } = await H.open({ q2: true });
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    const nm = gb.students[0], id = String(gb.ids[0]);
    T.importFast({ students: [{ id, name: nm, grade: 7, tests: [{ test: 'FAST', pm: 'PM3', year: '2025-26', level: 2, scale: 220, pct: 31, grade: 6 }, { test: 'FAST', pm: 'PM1', year: '2026-27', level: 1, scale: 205 }], info: { L30: 'Y' } }], blank: 0, windows: [] }, 'f.csv');
    T.state.settings.hideNames = true; T.save(); T.render();
    const page = A.testsSection(s, nm);
    A.openConference(s, nm);
    const v = { tests: document.querySelector('#cfTests').value, name: document.querySelector('#cfName').value, aside: document.querySelector('.confSide').textContent };
    document.querySelector('#mCancel').click();
    return { pageHides: /Hidden while names are hidden/.test(page), formTests: v.tests, formName: v.name, asideHasL30: /Lowest 30/.test(v.aside), asideHasGain: /FAST gain/.test(v.aside) }; }, K);
  console.log('OBSERVED:', JSON.stringify(out));
  console.log('EXPECTED: while names are hidden the FAST history box is empty (or says it is hidden), as the student page and the dialog\'s own aside are');
  L.check(out.pageHides && !out.asideHasL30, 'precondition: the page and the aside hide FAST');
  L.check(!/\d{3}/.test(out.formTests), 'the form box shows no FAST scores while names are hidden: "' + out.formTests + '"');
  L.check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); L.done(); })().catch(e => { console.error(e); process.exit(2); });
