// A past quarter's IXL is not owed (Croix, 8 Nov 2026: "All of the missing ixl for the quarter should be shown and they
// can't go back to a previous quarter to make stuff up"). With a Quarter 2 export in Tally and Quarter 1 not closed yet,
// a unit whose Focus IXL column is Quarter 1's is past: the report, its totals, the tile and the still-owed list leave
// it out, the grid tags it "Q1", and closing Quarter 1 offers it ticked ("Q1 closed" after). A unit with a column in Quarter 2
// stays owed, and so does one the teacher leaves unticked when Quarter 1 closes.
const { chromium, fs, path, exe, check, done, APP, pick } = require('./lib');
const K = '1205050-7T1A';
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  // every student's report, read: the course line, the units on the back, the totals and the IXL tile
  const look = () => p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const rows = T.gbRows(s); const txt = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
    const units = T.unitsOf(s).filter(u => u.assigned); const open = units.filter(u => !T.unitClosed(s, u));
    const reps = s.grades.students.map((name, i) => { if (!rows[i] || rows[i].ixl == null) return null; const d = new DOMParser().parseFromString(T.studentReportSection(s, i, rows[i]), 'text/html');
      const tile = [...d.querySelectorAll('.board > div')].find(x => /IXL at goal/.test(txt(x)));
      return { name, course: txt(d.querySelector('.course')), back: [...d.querySelectorAll('.panel.ixl .uh b:first-child')].map(txt), owedBack: [...d.querySelectorAll('.panel.ixl .u')].filter(u => u.querySelector('.sks')).map(u => txt(u.querySelector('.uh b'))), main: txt(d.querySelector('.panel.main')), tile: txt(tile && tile.querySelector('b')),
        want: open.reduce((n, u) => n + T.activeFor(s, u, rows[i].ixl).length, 0) }; }).filter(Boolean);
    const tags = [...document.querySelectorAll('.grid thead th')].filter(th => th.querySelector('.qtag')).map(th => ({ th: txt(th).slice(0, 40), tag: txt(th.querySelector('.qtag')), title: th.querySelector('.qtag').title }));
    return { live: T.liveQuarter(s), units: units.map(u => u.short + ':' + (T.unitClosed(s, u) ? 'past' : 'open')), open: open.map(u => u.short), reps, tags }; }, K);
  const andL = xs => xs.length > 2 ? xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1] : xs.join(' and ');
  const unitWords = us => us.length > 1 ? 'Units ' + andL(us.map(u => u.replace(/^Unit /, ''))) : andL(us);
  const unitsSaid = m => (m.match(/in (Units? [\d, and]+?)[).]? (are|is|→|not)|\(\d+ skills? in (Units? [\d, and]+)\)/) || []).slice(1).filter(x => x && /^Unit/.test(x))[0] || '';
  // 1. Quarter 1's export: Units 1, 2 and 3 are the quarter's
  const A = await look();
  check(A.live === 1 && A.units.join(' ') === 'Unit 1:open Unit 2:open Unit 3:open' && A.reps.every(r => / · Quarter 1$/.test(r.course)), 'with Quarter 1\'s export, Units 1, 2 and 3 are the quarter\'s: ' + A.units.join(', '));
  const a1 = A.reps.filter(r => /this quarter's IXL finished|still below goal/.test(r.main));
  check(a1.length > 5 && a1.every(r => unitsSaid(r.main) === unitWords(r.owedBack)) && a1.some(r => unitsSaid(r.main) === 'Units 1, 2 and 3'), 'Do this week names every unit of Quarter 1 with IXL owed, as the back lists them (' + a1.length + ' students): ' + (a1[0] ? unitsSaid(a1[0].main) : ''));
  // 2. a Quarter 2 export, Quarter 1 not closed: Unit 1's column is Quarter 1's, so Unit 1 is past; Unit 2 has a column
  //    in Quarter 2 (its IXL review), so it stays owed
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(800);
  await p.evaluate(K => { window.__tally.state.active = K; window.__tally.render(); }, K); await p.waitForTimeout(400);
  const B = await look();
  check(B.live === 2 && B.units.join(' ') === 'Unit 1:past Unit 2:open Unit 3:open' && B.reps.every(r => / · Quarter 2$/.test(r.course)), 'after a Quarter 2 export, Quarter 1 not closed: the report is Quarter 2\'s and Unit 1 is past: ' + B.units.join(', '));
  check(B.reps.every(r => !r.back.includes('Unit 1') && r.back.every(u => u === 'Unit 2' || u === 'Unit 3')) && B.reps.some(r => r.back.length === 2), 'no report lists Unit 1\'s IXL on the back; Units 2 and 3 are listed: ' + JSON.stringify(B.reps[0].back));
  const b1 = B.reps.filter(r => /this quarter's IXL finished|still below goal/.test(r.main));
  check(b1.length > 5 && b1.every(r => unitsSaid(r.main) === unitWords(r.owedBack) && !/^Units? 1\b/.test(unitsSaid(r.main))) && b1.some(r => unitsSaid(r.main) === 'Units 2 and 3'), 'Do this week names Quarter 2\'s IXL only, never Unit 1 (' + b1.length + ' students): ' + (b1[0] ? unitsSaid(b1[0].main) : ''));
  check(B.reps.every(r => { const m = /^(\d+) \/ (\d+)$/.exec(r.tile); return m && +m[2] === r.want; }), 'the IXL tile counts Units 2 and 3 only: ' + B.reps[0].tile + ' (' + B.reps[0].want + ' skills)');
  const tag1 = B.tags.find(t => /^Unit 1(?!\d)/.test(t.th));
  check(tag1 && tag1.tag === 'Q1' && /which the class has moved past/.test(tag1.title), 'the grid tags Unit 1 "Q1" (Quarter 1 not closed, but the class has moved past it): ' + JSON.stringify(tag1));
  const due = await p.evaluate(() => [...window.__tally.unitsDueIn('acc', 1)]);
  check(due.some(n => /^Unit 1\b/.test(n)) && due.some(n => /^Unit 2\b/.test(n)) && !due.some(n => /^Unit 3\b/.test(n)), 'closing Quarter 1 offers Units 1 and 2 ticked, from the kept Quarter 1 copy: ' + due.join(', '));
  const [w] = await Promise.all([ctx.waitForEvent('page'), p.evaluate(K => window.__tally.printStillOwed(window.__tally.state.sections[K]), K)]); await w.waitForLoadState(); await w.waitForTimeout(300);
  const owedTxt = await w.evaluate(() => document.body.innerText); await w.close();
  check(!/Unit 1 Equations/.test(owedTxt) && /Unit 2|Unit 3/.test(owedTxt), 'the still-owed list leaves Unit 1 out too');
  // 3. Quarter 1 closed with those units: Unit 1 reads "Q1 closed"; Unit 2's Quarter 2 column keeps it owed
  await p.evaluate(() => { const T = window.__tally; const d = T.unitsDueIn('acc', 1); T.closeQuarter(1, { acc: [...d], on: [] }); T.render(); }); await p.waitForTimeout(400);
  const C = await look(); const tagC = C.tags.find(t => /^Unit 1(?!\d)/.test(t.th));
  check(C.units.join(' ') === 'Unit 1:past Unit 2:open Unit 3:open' && tagC && tagC.tag === 'Q1 closed' && C.reps.every(r => !r.back.includes('Unit 1') && / · Quarter 2$/.test(r.course)), 'with Quarter 1 closed: Unit 1 reads "Q1 closed", Units 2 and 3 are still owed, the report is Quarter 2\'s: ' + C.units.join(', ') + ' ' + JSON.stringify(tagC));
  // 4. a unit left unticked when Quarter 1 closes stays owed: closing settled it (the teacher carried it into Quarter 2)
  await p.evaluate(() => { const T = window.__tally; T.reopenQuarter(1); T.closeQuarter(1, { acc: [], on: [] }); T.render(); }); await p.waitForTimeout(400);
  const D = await look();
  check(D.units.join(' ') === 'Unit 1:open Unit 2:open Unit 3:open' && D.reps.some(r => r.back.includes('Unit 1')), 'Quarter 1 closed with no unit ticked: Unit 1 is carried into Quarter 2 and owed again: ' + D.units.join(', '));
  check(errs.length === 0, 'no errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); done();
})().catch(e => { console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
