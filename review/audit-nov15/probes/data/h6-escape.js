// Exploration harness: an HTML payload in a student's name (IXL, roster and gradebook alike), an assignment title, a
// skill name, a unit name, a note, a family log, a conference box, a class label, a data set label and file names;
// then every page and dialog the finder reaches, the newer dialogs, the Board and the print pages. Any live <img src=x>
// or <svg data-pwn> or window.__x counts.
const D = require('./dat-lib.js'); const path = require('path'); const fs = require('fs');
const PAY = `<img src=x data-pwn onerror="window.__x=(window.__x||0)+1">`; const PAY2 = `"><svg data-pwn onload="window.__x=(window.__x||0)+1">`;
(async () => {
  const { b, p, errs } = await D.open(); const R = D.REPO; const tmp = D.L.tmp;
  const ixlF = fs.readdirSync(path.join(R, 'fixtures')).find(f => f.startsWith('ixl_7T1A_scrubbed'));
  let ixl = fs.readFileSync(path.join(R, 'fixtures', ixlF), 'utf8').replace(/SUTTER/g, 'SUT' + PAY.replace(/"/g, "'") + 'TER').replace('Convert fractions or mixed numbers to decimals', 'Convert ' + PAY.replace(/"/g, "'") + ' decimals').replace('Unit 1 Equations and Inequalities', 'Unit 1 Equations ' + PAY.replace(/"/g, "'"));
  let ros = fs.readFileSync(path.join(R, 'fixtures/focus_roster_scrubbed.txt'), 'utf8').replace(/SUTTER/g, 'SUT' + PAY.replace(/"/g, "'") + 'TER');
  let gb = fs.readFileSync(path.join(R, 'fixtures/focus_gradebook_scrubbed.csv'), 'utf8').replace(/SUTTER/gi, m => 'SUT' + PAY.replace(/"/g, "'") + 'TER').replace('Squares and Cubes Quiz', 'Squares ' + PAY.replace(/"/g, "'") + ' Quiz');
  const fi = path.join(tmp, ixlF); fs.writeFileSync(fi, ixl); const fg = path.join(tmp, 'focus_gradebook_x.csv'); fs.writeFileSync(fg, gb);
  await p.setInputFiles('#file', [fi]); await p.waitForTimeout(500); await p.fill('#rpText', ros); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [fg]); await p.waitForTimeout(500); await D.L.pick(p); await p.waitForTimeout(600);
  const r = await p.evaluate(async ([K, PAY, PAY2]) => { const A = window.__all, T = window.__tally, st = A.state, s = st.sections[K]; st.settings.hideNames = false; st.settings.details = true;
    const nm = A.classStudents(s).find(n => /SUT/.test(n)) || A.classStudents(s)[0]; s.label = 'P1 ' + PAY2; s.file = 'x' + PAY + '.csv'; s.grades.file = 'g' + PAY2 + '.csv';
    A.addNote(s, nm, 'note ' + PAY + PAY2); A.setFamily(s, nm, { contacts: [{ id: 'c', name: 'Mom ' + PAY, rel: 'Mother', phone: PAY2, email: '', note: PAY }], log: [{ id: 'l', at: '2026-11-10', how: 'Call', who: PAY2, text: PAY }] });
    s.confForms = { [A.norm(nm)]: { saved: '2026-11-12T15:00:00.000Z', strengths: PAY, concerns: PAY2, work: PAY, tests: PAY2 } };
    st.custom = [{ id: 'c1', label: 'Data ' + PAY2, unit: PAY, prep: s.prep, values: { [K]: [1, 2, 3, 4, 5, 6] } }];
    const ri = A.classStudents(s).indexOf(nm); s.reportLog = { [A.norm(nm)]: [{ date: '2026-11-06', q: 2, gb: '2026-11-05', ix: '2026-11-04', grade: 88, missing: 1, ixl: 3 }] };
    T.save(); const seen = []; const chk = where => { const n = document.querySelectorAll('[data-pwn]').length; if (n && !window.__shown) { window.__shown = 1; const e = document.querySelector('[data-pwn]'); seen.push('SAMPLE ' + e.tagName + ' in ' + e.parentElement.tagName + '.' + e.parentElement.className + ' #' + (e.closest('[id]') || {}).id + ' :: ' + e.parentElement.outerHTML.slice(0, 300) + ' :: ns ' + e.namespaceURI + ' complete=' + e.complete); } const w = window.__x || 0; if (n || w) seen.push(where + ' (' + n + ' live, ' + w + ' ran)'); document.querySelectorAll('[data-pwn]').forEach(e => e.remove()); window.__x = 0; };
    const sleep = ms => new Promise(r => setTimeout(r, ms)); const modalClose = () => { const m = document.querySelector('#modal'); if (m) { m.classList.add('hidden'); m.innerHTML = ''; } };
    const step = async (where, f) => { try { await f(); } catch (e) { seen.push(where + ' threw ' + String(e.message).slice(0, 60)); } await sleep(120); chk(where); modalClose(); };
    st.active = K; T.render(); chk('home');
    // every finder entry (pages and actions), with names showing; one search for the student
    for (const q of ['', 'sut', 'unit', 'p1']) { const items = A.finderItems(q); for (const it of items.slice(0, 40)) { if (/Clear|Full save|Board save|Import|Hide the screen|Board$/.test(it.label)) continue; await step('finder[' + q + '] ' + it.kind + ':' + it.label.slice(0, 30), async () => { await it.go(); }); } }
    const si = s.grades.students.findIndex(n => /SUT/.test(n));
    await step('profile', () => T.openProfile(K, nm)); await step('studentCard', () => A.openStudentCard(s, si)); await step('removePrint', () => A.openRemovePrint(s)); await step('returns', () => A.openReturns(s));
    await step('digest', () => A.openDigest(s)); await step('stillOwed', () => A.openStillOwed(s)); await step('gbQuestions', () => A.openGbQuestions(s));
    await step('weights', () => A.openWeights(s)); await step('conference', () => A.openConference(s, nm)); await step('show', () => A.openShow(s, nm)); try { A.closeShow(); } catch (e) {}
    const gd = A.gradeDiff && A.gradeDiff(s); if (gd) await step('gradeDiff', () => A.openGradeDiff(s, gd));
    for (const u of A.unitsOf(s).slice(0, 2)) await step('focusCheck ' + u.short, () => A.openFocusCheck(s, u.name));
    await step('veil', () => { A.veil('now'); }); A.unveil();
    // prints (HTML strings): the weekly report, the conference form, the FAST report, the classes print
    const html = []; const op = A.openPrint; window.open = () => null;
    return { seen };
  }, [D.K, PAY, PAY2]);
  console.log(JSON.stringify(r, null, 1).slice(0, 4000)); console.log('page errors', errs.length, errs.slice(0, 4).join(' | ').slice(0, 600)); await b.close();
})().catch(e => { console.error(e); process.exit(2); });
