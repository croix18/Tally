// HLT-04: the Grades screen's assignment table shows a "cost" (class average now minus class average without this
// column). With a single graded column (the first export of a quarter), the average without it is null and
// `avg - null` = avg, so the column shows "+83.0" as if removing the only assignment would lower the average by 83 points.
const path = require('path'); process.env.TALLY_REPO = process.env.TALLY_REPO || '/home/claude/work/audit/health/repo';
const { open, K, lib } = require('./_load.js'); const { check, done } = lib;
(async () => {
  const { b, p, errs } = await open();
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    s.grades.assignments = s.grades.assignments.filter(a => a.name === 'Unit 1 Assessment'); s.grades.overall = null; T.save();
    T.state.active = K; T.view.mode = 'grades'; T.render();
    const row = [...document.querySelectorAll('tr')].filter(tr => tr.textContent.includes('Unit 1 Assessment') && tr.querySelectorAll('td').length > 6).pop();
    const cells = row ? [...row.querySelectorAll('td')].map(td => td.textContent.trim()) : null;
    return { avg: A.classAverage(s), without: A.classAverage(s, null, 'Unit 1 Assessment'), costCell: cells && cells[cells.length - 1], cells }; }, K);
  console.log('OBSERVED:', JSON.stringify(out));
  console.log('EXPECTED: the cost cell is blank (or "—") when removing the column leaves no grade to average; never a signed number equal to the average itself');
  check(out.without == null && !/\d/.test(out.costCell || ''), 'no cost number for the only graded column');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
