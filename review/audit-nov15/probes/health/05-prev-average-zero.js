// HLT-05: "previous class average" is computed twice. The Grades screen (grades.js renderGrades, line 521) divides by
// `(n || 1)`, so a previous import where nobody had a grade yet gives 0, and the card says "+60 since <date>".
// The Overview (home.js gradeSummary, line 10) gives null for the same snapshot and says nothing.
const path = require('path'); process.env.TALLY_REPO = process.env.TALLY_REPO || '/home/claude/work/audit/health/repo';
const { open, K, lib } = require('./_load.js'); const { check, done } = lib;
(async () => {
  const { b, p, errs } = await open();
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    const keep = JSON.stringify(gb); const realAt = gb.importedAt;
    // last week's export: the same columns already listed in Focus, none graded yet (all blank)
    s.gradeHistory = []; gb.importedAt = new Date(Date.parse(realAt) - 7 * 864e5).toISOString();
    gb.assignments.forEach(a => { a.values = a.values.map(() => null); a.status = a.status.map(() => 'blank'); a.missing = 0; });
    T.gradeSnapshot(s); s.grades = JSON.parse(keep); s.grades.importedAt = realAt; T.gradeSnapshot(s); T.save();
    T.state.active = K; T.view.mode = 'grades'; T.render();
    const card = [...document.querySelectorAll('.gcard')].find(c => /Class average/.test(c.textContent));
    const home = A.gradeSummary(s);
    return { history: s.gradeHistory.map(h => h.date + ':' + h.grade.filter(v => v != null).length + ' graded'), gradesCard: card && card.textContent.replace(/\s+/g, ' ').trim(), overviewPrevAvg: home.prevAvg }; }, K);
  console.log('OBSERVED:', JSON.stringify(out));
  console.log('EXPECTED: no change line when the previous import had no grades ("first import" or nothing), as the Overview does (prevAvg null)');
  check(!/since/.test(out.gradesCard || ''), 'Grades card shows no "+N since" against an import that had no grades');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
