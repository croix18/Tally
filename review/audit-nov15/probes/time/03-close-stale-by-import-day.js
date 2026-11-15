// TIM-03: the Close-quarter dialog judges "exported before the quarter ended" by the day the file was IMPORTED, and
// labels that day "exported". A Thursday 8 Oct export (Quarter 1 ends Fri 9 Oct) imported Monday 12 Oct reads as fresh.
const path = require('path'); const { openAt, check, done, pick, fs, tmp } = require('./_tim.js');
const K = '1205050-7T1A';
(async () => {
  const gbFile = path.join(tmp, 'focus_gradebook_thursday.csv'); fs.copyFileSync('fixtures/focus_gradebook_scrubbed.csv', gbFile);
  const thu = new Date('2026-10-08T19:00:00Z'); fs.utimesSync(gbFile, thu, thu);           // Focus wrote it Thu 8 Oct, 3 pm Eastern
  const { b, p, errs } = await openAt('America/New_York', '2026-10-12T12:30:00Z');         // Mon 12 Oct, 8:30 am
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [gbFile]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const r = await p.evaluate(K => { const A = window.__all, T = window.__tally; const s = T.state.sections[K];
    A.openQuarters(); const m = document.querySelector('#modal'); const t = m.textContent.replace(/\s+/g, ' ');
    return { exportedAt: s.grades.exportedAt, importedAt: s.grades.importedAt, title: (m.querySelector('h2') || {}).textContent, row: (m.querySelector('.qkeep') || {}).textContent, warn: /exported before Quarter 1 ended/.test(t), warnText: ((m.querySelector('.warnline') || {}).textContent || '') }; }, K);
  console.log('OBSERVED:', JSON.stringify(r));
  console.log('EXPECTED: the row says "exported Oct 8" and the dialog warns the gradebook was exported before Quarter 1 ended (Oct 9)');
  check(/exported Oct 8/.test(r.row || ''), 'the row names the day Focus wrote the file');
  check(r.warn, 'the dialog warns the export predates the end of the quarter');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
