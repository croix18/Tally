// Audit of 15 Nov 2026, the conference form and FAST (fixer CONF): one regression check per finding fixed.
// The scrubbed class (IXL grid, roster, Q1 and Q2 gradebooks) plus synthetic FAST rows; no real score is in the repo.
const { chromium, fs, path, exe, check, done, pick, tmp, APP } = require('./lib');
const K = '1205050-7T1A';
const gbIn = async (p, f) => { await p.setInputFiles('#file', [path.resolve(f)]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(700); if (await p.$('#modal:not(.hidden) #askApply')) { await p.click('#askApply'); await p.waitForTimeout(400); } };
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true, timezoneId: 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await gbIn(p, 'fixtures/focus_gradebook_scrubbed.csv'); await gbIn(p, 'fixtures/focus_gradebook_scrubbed_q2.csv');
  const snap = await p.evaluate(() => JSON.stringify(window.__tally.state));
  const reset = () => p.evaluate(st => { const T = window.__tally; Object.keys(T.state).forEach(k => delete T.state[k]); Object.assign(T.state, JSON.parse(st)); T.save(); T.render(); }, snap);

  // ---- CON-03: an IXL column with skills still to do is missing work on the parent form too (Croix, 31 Oct) ----------
  const c03 = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const os = T.openSec(s); const rows = T.gbRows(s); let cases = 0, bad = 0, turnedIn = 0;
    os.grades.students.forEach((n, i) => { const ow = A.owedWork(s, os, i, rows[i].ixl); if (!ow.owed.some(a => /\bixl\b/i.test(a.name))) return; cases++;
      const d = A.conferenceData(s, n); if (d.missing.length + d.missedTests.length !== ow.owed.length) bad++; if (/Every assignment turned in/.test(A.conferenceDraft(d).strengths)) turnedIn++; });
    return { cases, bad, turnedIn }; }, K);
  check(c03.cases > 0 && c03.bad === 0 && c03.turnedIn === 0, `CON-03: the parent form counts an owed IXL column as missing, as the weekly report does (${c03.cases} students, ${c03.bad} differ, ${c03.turnedIn} told "Every assignment turned in")`);

  // ---- CNF-06: a missing notebook check is work to turn in, never a test "not taken yet" --------------------------------
  const c06 = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; let cases = 0, bad = 0;
    A.classStudents(s).forEach(nm => { const d = A.conferenceData(s, nm); const nbMiss = d.missing.filter(a => /notebook/i.test(a.name)).length; const nbTest = d.missedTests.filter(a => /notebook/i.test(a.name)).length; if (nbMiss + nbTest === 0) return; cases++;
      const w = A.conferenceWork(d); const notTaken = (w.split('Not taken yet:')[1] || '').split('\n\n')[0]; if (nbTest || /notebook/i.test(notTaken)) bad++; });
    return { cases, bad }; }, K);
  check(c06.cases > 0 && c06.bad === 0, `CNF-06: a missing notebook check is listed under "Turn in", not "Not taken yet" (${c06.cases} students, ${c06.bad} wrong)`);

  // ---- CNF-02: a FAST name key is not read or written when two students share the name; a unique name still reads it ----
  const c02 = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    gb.students[0] = 'DOE, JANE'; gb.students[1] = 'DOE, JANE'; A.uniqueNames(gb.students, gb.ids); T.save(); T.render();
    const nA = gb.students[0], nB = gb.students[1], nC = gb.students[2]; const idA = A.findStudent(s, nA).id, idB = A.findStudent(s, nB).id;
    T.importFast({ students: [
      { id: idA, name: 'DOE, JANE', grade: 7, tests: [{ test: 'FAST', pm: 'PM3', year: '2025-26', level: 1, scale: 170, grade: 6 }, { test: 'FAST', pm: 'PM1', year: '2026-27', level: 1, scale: 200 }], info: { L30: 'Y' } },
      { id: idB, name: 'DOE, JANE', grade: 7, tests: [{ test: 'FAST', pm: 'PM1', year: '2026-27', level: 3, scale: 250 }], info: { L30: '' } } ],
      blank: 0, windows: [{ pm: 'PM3', year: '2025-26' }, { pm: 'PM1', year: '2026-27' }] }, 'fast.csv');
    const wrote = Object.keys(T.state.tests).filter(k => k.startsWith('n:doe')); const hB = A.testHistory(s, nB).map(h => `${h.pm} ${h.year} ${h.scale}`); const tB = A.fastTargets(s, nB);
    T.state.tests['n:' + A.norm(nC)] = [{ test: 'FAST', pm: 'PM1', year: '2026-27', level: 2, scale: 230 }]; T.render(); const hC = A.testHistory(s, nC).map(h => `${h.pm} ${h.scale}`);
    return { wrote, hB, gainB: tB && tB.gain ? tB.gain.score : null, l30B: A.isL30(s, nB), hC }; }, K);
  check(c02.hB.join() === 'PM1 2026-27 250' && c02.gainB == null && !c02.l30B && !c02.wrote.length, `CNF-02: a student sharing a name sees only her own FAST rows (${c02.hB.join(', ')}; gain ${c02.gainB}; name keys written: ${c02.wrote.join(', ') || 'none'})`);
  check(c02.hC.includes('PM1 230'), 'CNF-02: a student whose name is his alone still reads a row kept by name (the score report PDF stores only the name key)');
  await reset();

  // ---- CNF-03: an August Focus report (only last spring's PM3) keeps PM3TestLevel and no "tested above grade" on it ----
  const c03f = await p.evaluate(K => { const T = window.__tally, A = window.__all; const parse = window.parseFastReport || A.parseFastReport; const s = T.state.sections[K]; const gb = s.grades; const nm = gb.students[2], id = String(gb.ids[2]);
    const head = ['ID', 'Student', 'GradeLevel', 'Percentile', 'TestedAboveGrade', 'PM3TestLevel', 'Achievement Level', 'Scale Score'];
    const aug = parse([head, ['', '', '', '', '', '', '2025-2026', '2025-2026'], ['', '', '', '', '', '', 'PM3', 'PM3'], [id, nm, '07', '60', 'Y', '07', '3', '240']]);
    const t = aug && aug.students[0] ? aug.students[0].tests.find(h => h.pm === 'PM3') : null;
    T.state.tests = { ['id:' + id]: [{ test: 'FAST', pm: 'PM3', year: '2025-26', level: 3, scale: 240, above: true }] };   /* a mark the old parser left on last year's PM3 */
    const head2 = ['ID', 'Student', 'GradeLevel', 'Percentile', 'TestedAboveGrade', 'PM3TestLevel', 'Achievement Level', '', 'Scale Score', ''];
    const sept = parse([head2, ['', '', '', '', '', '', '2025-2026', '2026-2027', '2025-2026', '2026-2027'], ['', '', '', '', '', '', 'PM3', 'PM1', 'PM3', 'PM1'], [id, nm, '07', '60', '', '07', '3', '2', '240', '236']]);
    T.importFast(sept, 'sept.csv'); const after = A.testHistory(s, nm).find(h => h.pm === 'PM3' && h.year === '2025-26');
    return { grade: t ? t.grade : null, above: t ? !!t.above : null, afterAbove: after ? !!after.above : null, line: A.conferenceTests(A.conferenceData(s, nm)) }; }, K);
  check(c03f.grade === 7 && c03f.above === false, `CNF-03: an August report's PM3 keeps its PM3TestLevel and no above-grade mark (grade ${c03f.grade}, above ${c03f.above})`);
  check(c03f.afterAbove === false && /grade 7 test/.test(c03f.line), `CNF-03: a later report clears an above-grade mark left on last year's PM3 (${c03f.line})`);
  await reset();

  // ---- CNF-07: the score report PDF does not put a near-name's row (another FLEID) on a student whose FLEID is known ----
  const c07 = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const nm = s.grades.students[0]; const last = nm.split(',')[0], first = nm.split(',')[1].trim().split(' ')[0]; const cats = ['1. Number Sense'];
    const pdf = (pm, st) => A.importFastItems({ grade: 8, pm, year: '2026-27', cats, kind: 'items', students: [st] }, pm + '.pdf');
    pdf('PM1', { fleid: 'FL000000000001', name: nm, scale: 250, level: 3, pct: 60, cats: {} });
    pdf('PM2', { fleid: 'FL000000000002', name: `${last}, ${first.slice(0, 3)}`, scale: 199, level: 1, pct: 2, cats: {} });
    const h1 = A.testHistory(s, nm).map(x => `${x.pm} ${x.scale}`); const fl = A.fastInfo(s, nm).FLEID;
    pdf('PM3', { fleid: 'FL000000000001', name: nm, scale: 262, level: 4, pct: 75, cats: {} });
    return { h1, fl, h2: A.testHistory(s, nm).map(x => `${x.pm} ${x.scale}`) }; }, K);
  check(!c07.h1.some(x => /^PM2/.test(x)) && c07.fl === 'FL000000000001', `CNF-07: a near-name row with another FLEID stays off the student and her FLEID stays hers (${c07.h1.join(', ')}; ${c07.fl})`);
  check(c07.h2.includes('PM3 262'), 'CNF-07: her own later row (same FLEID) still matches by name');
  await reset();

  // ---- CON-05: nothing graded yet: the conference panel says so, never "null%" --------------------------------------------
  const c05 = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const os = T.openSec(s); const nm = os.grades.students[3]; const i = 3;
    os.grades.assignments.forEach(a => { if (a.status) a.status[i] = 'excused'; a.values[i] = null; }); T.save(); T.render();
    const d = A.conferenceData(s, nm); A.openConference(s, nm); const facts = (document.querySelector('#modal .cfFacts') || {}).textContent || ''; document.querySelector('#mCancel').click();
    return { pre: !!d.r && d.r.rounded == null, facts: facts.replace(/\s+/g, ' ').slice(0, 200) }; }, K);
  check(c05.pre && !/null/.test(c05.facts) && /nothing graded yet/.test(c05.facts), `CON-05: the conference panel says "nothing graded yet", not "null%" (${c05.facts})`);
  await reset();

  // ---- CNF-05: while names are hidden the form's FAST box shows no scores, and closing it keeps his own words ----------
  const c05h = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const nm = gb.students[0], id = String(gb.ids[0]);
    T.importFast({ students: [{ id, name: nm, grade: 7, tests: [{ test: 'FAST', pm: 'PM3', year: '2025-26', level: 2, scale: 220, pct: 31, grade: 6 }, { test: 'FAST', pm: 'PM1', year: '2026-27', level: 1, scale: 205 }], info: { L30: 'Y' } }], blank: 0, windows: [] }, 'f.csv');
    A.openConference(s, nm); const ta = document.querySelector('#cfTests'); ta.value = 'PM1 205, my words'; document.querySelector('#mCancel').click();
    const before = ((s.confForms || {})[A.norm(nm)] || {}).tests;
    T.state.settings.hideNames = true; T.save(); T.render();
    A.openConference(s, nm); const box = document.querySelector('#cfTests'); const shown = { v: box.value, ro: box.readOnly }; document.querySelector('#mCancel').click();
    const after = ((s.confForms || {})[A.norm(nm)] || {}).tests; T.state.settings.hideNames = false; T.save(); T.render();
    return { before, after, shown }; }, K);
  check(c05h.shown.v === '' && c05h.shown.ro, `CNF-05: with names hidden the FAST box is empty and read-only ("${c05h.shown.v}")`);
  check(c05h.before === 'PM1 205, my words' && c05h.after === c05h.before, `CNF-05: opening and closing the form with names hidden keeps his words in the FAST box ("${c05h.after}")`);
  await reset();

  // ---- the FAST report's failure toast shows a name as text, never as markup ----------------------------------------------
  await p.evaluate(() => { window.__prints = []; window.__all.printFast([{ sec: null, names: ['<i id="confXss">A</i>, B'] }], 'FAST'); });
  await p.waitForTimeout(1200);
  const tx = await p.evaluate(() => ({ el: !!document.querySelector('#confXss'), text: [...document.querySelectorAll('.toast, #toast, [class*=toast]')].map(e => e.textContent).join(' | ').slice(0, 300) }));
  check(!tx.el && /<i id="confXss">/.test(tx.text), `a report that fails names the student as text in the toast (${tx.text})`);

  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
