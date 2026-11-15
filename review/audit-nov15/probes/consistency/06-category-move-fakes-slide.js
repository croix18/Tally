// CON-06: moving an assignment to another category (or changing a weight) regrades today's snapshot only. The earlier
// import's snapshot keeps the old categories, so "since last import", Sliding, the digest and the trend report a
// change no student made.
const H = require('./h.js'); const fs = require('fs'); const path = require('path');
(async () => { const { b, p, errs } = await H.open();
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  // the same Q1 gradebook exported a week ago and today: nothing changed in between
  const rows = H.gbRead('fixtures/focus_gradebook_scrubbed.csv'); const f1 = H.gbWrite(rows, 'gb-week-ago.csv'); const f2 = H.gbWrite(rows, 'gb-today.csv');
  await H.importGb(p, f1);
  // file it as last week's import (Tally dates a gradebook by when Focus wrote it; the suites do the same in tests/grades.js)
  await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; s.grades.importedAt = s.grades.exportedAt = new Date(Date.now() - 7 * 864e5).toISOString(); s.gradeHistory = []; A.gradeSnapshot(s); T.save(); }, H.K);
  await H.importGb(p, f2);
  const before = await p.evaluate(K => { const s = window.__tally.state.sections[K]; return (s.gradeHistory || []).map(h => h.date); }, H.K);
  // the teacher moves one assignment's category on the Grades screen
  await p.evaluate(K => { window.__tally.state.active = K; document.querySelector('#openGrades').click(); }, H.K); await p.waitForTimeout(300);
  const pre = await p.evaluate(() => [...document.querySelectorAll('table.gstu tr[data-stu]')].map(tr => tr.children[2].innerText.trim()).filter(t => t && t !== '±0').length);
  console.log('before the move: students with a change since last import =', pre);
  await p.selectOption('select[data-cat="Unit 1 Notebook Check"]', 'Classwork'); await p.waitForTimeout(500);
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    const since = [...document.querySelectorAll('table.gstu tr[data-stu]')].map(tr => tr.children[2].innerText.trim()).filter(t => t && t !== '±0');
    const slide = [...document.querySelectorAll('.grades .gcard')].find(c => /Sliding/i.test(c.innerText)).innerText.replace(/\s+/g, ' ');
    const d = A.digestFor(s); return { since: since.length, sample: since.slice(0, 6), slide, digestSlid: d.focus ? d.focus.slid.length : null, digestAvg: d.focus ? [d.focus.prevAvg, d.focus.avg].map(x => Math.round(x * 10) / 10) : null }; }, H.K);
  console.log('imports:', before.join(', '));
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: no score changed between the two imports: every "since" is ±0 or blank, Sliding 0, digest slid 0, the same average both days');
  H.check(o.since === 0, 'no student shows a change since the last import (' + o.since + ' do)');
  H.check(/Sliding 0/i.test(o.slide), 'Sliding is 0: ' + o.slide);
  H.check(o.digestSlid === 0, 'the digest lists nobody as sliding (' + o.digestSlid + ')');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
