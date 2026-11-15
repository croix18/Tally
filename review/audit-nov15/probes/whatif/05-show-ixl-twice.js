// WIF-05: an IXL column Focus marks NHI, for a student linked to IXL, is two rows on Show student: "Turn in missing
// work" (a switch worth the column's full points) and "Finish IXL" (a slider). Both write the same cell; the slider wins
// silently, so "Turn it in" stays switched on at 17 / 17 while the grade is computed from the slider.
const S = require('./_setup.js');
(async () => { const { b, p, errs } = await S.open();
  const r = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    const col = gb.assignments.find(a => a.name === 'Unit 2 IXL');
    const i = gb.students.findIndex(n => A.findStudent(s, n).ixl != null && A.computeGrade(s, gb.students.indexOf(n)).rounded < 90);
    col.status[i] = 'missing'; col.values[i] = null; const name = gb.students[i];
    T.openProfile(K, name); await new Promise(r => setTimeout(r, 50)); A.openShow(s, name); const el = document.getElementById('show');
    const rows = [...el.querySelectorAll('.shRow')].filter(x => x.dataset.n === 'Unit 2 IXL').map(x => x.dataset.k);
    const miss = el.querySelector('.shRow[data-k="miss"][data-n="Unit 2 IXL"]'), ix = el.querySelector('.shRow[data-k="ix"][data-n="Unit 2 IXL"]');
    const sw = miss.querySelector('.shOn'); sw.checked = true; sw.dispatchEvent(new Event('change'));
    const afterSwitch = parseInt(el.querySelector('#shIfV').textContent);
    const rg = ix.querySelector('.shPts'); rg.value = 2; rg.dispatchEvent(new Event('input'));
    const afterSlider = parseInt(el.querySelector('#shIfV').textContent);
    return { rows, afterSwitch, afterSlider, switchOn: sw.checked, missOut: miss.querySelector('output').textContent, full: A.computeGrade(s, i, { 'Unit 2 IXL': col.max }).rounded, two: A.computeGrade(s, i, { 'Unit 2 IXL': 2 }).rounded };
  }, S.K);
  console.log('OBSERVED: Unit 2 IXL rows on Show student:', r.rows.join(' + '), '· "Turn it in" on →', r.afterSwitch + '%; then Finish IXL slider at 2 →', r.afterSlider + '% while "Turn it in" still reads on at', r.missOut);
  console.log('EXPECTED: one control per assignment (the column once), so the screen never shows two answers for one cell (full credit would be', r.full + '%, 2 points', r.two + '%)');
  S.check(r.rows.length === 1, 'the NHI IXL column is one row on Show student');
  S.check(errs.length === 0, 'no page errors');
  await b.close(); S.done(); })().catch(e => { console.error(e); process.exit(2); });
