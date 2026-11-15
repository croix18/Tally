// GRD-05: a closed quarter shows two different "final" grades for the same student. Closing keeps Focus's own Grade
// column as each student's final (quarters.js mergeArchive), and the Overview and the student's tiles read that; but the
// Grades screen's closed-quarter tab ("Final class average", the letters, every student row) re-computes from the kept
// scores with Tally's engine. Whenever Tally and Focus differed at close (the mismatch Croix still sees, NOTES 13-14
// Nov), the closed quarter disagrees with itself.
const path = require('path');
const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, fs, exe, check, done, pick, APP } = require(path.join(REPO, 'tests/lib.js'));
const K = '1205050-7T1A';
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  // Focus's Grade column differs from Tally for two students (as in Croix's real class: Focus counts something the export doesn't show)
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    gb.overall[0] = gb.overall[0] - 6; gb.overall[1] = gb.overall[1] + 4; const tallyNow = [0, 1].map(i => A.computeGrade(s, i).rounded);
    A.closeQuarter(1, {}); T.save(); T.render();
    const arch = s.qArchive && s.qArchive[1]; const k = A.qSec(s, 1);
    const tabGrade = [0, 1].map(i => A.computeGrade(k, i).rounded);
    return { focus: [gb.overall[0], gb.overall[1]], tallyNow, kept: arch && [arch.final[0], arch.final[1]], tabGrade, avgTab: A.classAverage(k), avgFinal: arch && arch.final.filter(v => v != null).reduce((a, b) => a + b, 0) / arch.final.filter(v => v != null).length }; }, K);
  // what the Grades screen's Q1 tab shows on screen
  await p.click(`[data-k="${K}"]`).catch(() => {}); await p.waitForTimeout(200); await p.click('#openGrades'); await p.waitForTimeout(300);
  const q1 = await p.$('[data-gq="1"]'); if (q1) { await q1.click(); await p.waitForTimeout(400); }
  const screen = await p.evaluate(() => { const card = [...document.querySelectorAll('#gridwrap .gcard')].map(c => c.textContent.replace(/\s+/g, ' ').trim())[0]; const row = document.querySelector('#gridwrap .gstu tr[data-stu="0"] .gchip'); return { card, row0: row && row.textContent }; });
  console.log('OBSERVED:', JSON.stringify(r), JSON.stringify(screen));
  console.log('EXPECTED: one final per student in a closed quarter: the Q1 tab shows the kept final (' + (r.kept && r.kept[0]) + ' for student 0) or says plainly that it is Tally\'s re-computation and differs from Focus\'s final');
  check(r.kept && r.kept[0] === r.focus[0], 'setup: the kept final is Focus\'s grade');
  check(r.tabGrade[0] === r.kept[0] && r.tabGrade[1] === r.kept[1], 'the Grades screen\'s closed-quarter grade equals the kept final');
  check(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
