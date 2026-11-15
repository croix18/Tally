// TIM-06: an early Quarter 2 export (Quarter 1 not closed yet) keeps Quarter 1's columns only when their NAME is not in
// the new file. A recurring title ("Notebook Check" in both quarters) is dropped: Quarter 1's scores for it are lost and
// the kept Quarter 1 finals are recomputed without it.
const path = require('path'); const { importGb, openAt, check, done, pick, fs, tmp } = require('./_tim.js');
const K = '1205050-7T1A';
(async () => {
  const q1 = path.join(tmp, 'gb_q1.csv'), q2 = path.join(tmp, 'gb_q2.csv');
  fs.writeFileSync(q1, fs.readFileSync('fixtures/focus_gradebook_scrubbed.csv', 'utf8').replace('"Squares and Cubes Quiz', '"Notebook Check'));
  fs.writeFileSync(q2, fs.readFileSync('fixtures/focus_gradebook_scrubbed_q2.csv', 'utf8').replace('"Proportions Quiz', '"Notebook Check'));
  const { b, p, errs } = await openAt('America/New_York', '2026-10-13T15:00:00Z');
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [q1]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const a = await p.evaluate(K => { const s = window.__tally.state.sections[K]; const nb = s.grades.assignments.find(x => x.name === 'Notebook Check');
    return { n: s.grades.assignments.length, nbDue: nb && nb.due, nbVals: nb && nb.values.filter(v => v != null).length, overall: s.grades.overall }; }, K);
  await p.clock.setFixedTime(new Date('2026-11-15T17:00:00Z'));
  await importGb(p, q2);
  const r = await p.evaluate(K => { const s = window.__tally.state.sections[K]; const k = (s.qArchive || {})[1]; if (!k) return { none: true };
    const nb = k.gb.assignments.find(x => x.name === 'Notebook Check');
    return { file: k.file, at: k.at, live: s.grades.file, liveN: s.grades.assignments.map(x=>x.name+'@'+x.due).join(';'), lines: window.__tally.state.lastImport.lines.map(l=>l.text).join(' // '), kept: k.gb.assignments.length, nbDue: nb ? nb.due : null, final: k.final, line: window.__tally.state.lastImport.lines.slice(-1)[0].text }; }, K);
  const diff = r.final ? r.final.filter((f, i) => a.overall && a.overall[i] != null && f !== Math.round(a.overall[i])).length : -1;
  console.log(JSON.stringify(r).slice(0,1500)); console.log('OBSERVED: Q1 file had', a.n, 'columns, "Notebook Check" due', a.nbDue, 'with', a.nbVals, 'scores | kept Q1 record:', r.kept, 'columns, its "Notebook Check" =', r.nbDue, '| finals differing from Focus\'s Q1 Grade column:', diff, '|', r.line);
  console.log('EXPECTED: the kept Q1 record has all', a.n, 'columns, including the Q1 "Notebook Check" (due 09/11), and its finals equal Focus\'s Q1 Grade column');
  check(r.kept === a.n, 'every Quarter 1 column is kept');
  check(r.nbDue === '09/11', 'Quarter 1\'s "Notebook Check" is kept');
  check(diff === 0, 'the kept Quarter 1 finals equal Focus\'s Grade column');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
