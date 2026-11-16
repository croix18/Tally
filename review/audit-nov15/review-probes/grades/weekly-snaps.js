// Counter-review (15 Nov 2026), GRD-04: six ordinary weekly Focus imports with NO settings change, then a real one.
// Each week Focus adds two graded columns and one column made ahead with no scores yet (graded the next week). Names
// are neutral, so Tally's name guess (Classwork) is wrong for some; Focus's Grade column proves them when they are graded.
// Expected: every week after the first compares with the week before (no "grading settings changed"); then a weights
// change makes nobody move. Each import goes through the import's own steps: applyCategories, then gradeSnapshot.
//   TALLY_REPO=<clone> node review-probes/weekly-snaps.js
const path = require('path');
const REPO = process.env.TALLY_REPO;
const { chromium, fs, exe, check, done, pick, APP } = require(path.join(REPO, 'tests/lib.js'));
const K = '1205050-7T1A';
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'America/New_York' })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400);
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(700);
  if (await p.$('#modal:not(.hidden) #askApply')) { await p.click('#askApply'); await p.waitForTimeout(300); }
  const SEED = Number(process.env.SEED || 5);
  const weeks = ['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06', '2026-11-13', '2026-11-20'];
  const res = await p.evaluate(({ K, weeks, SEED }) => {
    const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const g = T.gradingFor(s.prep);
    let seed = SEED; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const CATS = g.cats.map(c => c.name); const students = s.grades.students.slice(); const nS = students.length;
    const cols = []; const truth = {}; s.gradeHistory = [];
    const mk = (j, due) => { const max = [10, 20, 25][j % 3]; truth['Lesson ' + j + ' Practice'] = CATS[Math.floor(rnd() * CATS.length)]; return { name: 'Lesson ' + j + ' Practice', max, due, scores: students.map(() => { const r = rnd(); return r < 0.85 ? ['score', Math.round(rnd() * max * 2) / 2] : r < 0.95 ? ['missing', null] : ['excused', null]; }) }; };
    const log = []; let j = 0;
    weeks.forEach((d, w) => {
      const md = d.slice(5).replace('-', '/') + '/2026';
      cols.forEach(c => c.graded = true);                                   // last week's made-ahead column is graded now
      cols.push({ ...mk(j++, md), graded: true }, { ...mk(j++, md), graded: true }, { ...mk(j++, md), graded: false });
      const assignments = cols.map(c => ({ name: c.name, max: c.max, due: c.due, values: c.scores.map(x => c.graded && x[0] === 'score' ? x[1] : null), status: c.scores.map(x => c.graded ? x[0] : 'blank') }));
      assignments.forEach(a => { a.missing = a.status.filter(x => x === 'missing').length; a.excused = a.status.filter(x => x === 'excused').length; });
      s.grades.assignments = assignments; s.grades.importedAt = s.grades.exportedAt = d + 'T19:00:00.000Z';
      s.grades.overall = students.map((_, i) => A.computeGrade(s, i, null, truth).rounded);   // Focus = the true categories
      A.applyCategories(s); A.gradeSnapshot(s);
      const prev = A.prevGradeSnap(s), ruled = A.gradeRulesChanged(s), dg = A.digestFor(s);
      const moved = Object.keys(truth).filter(n => (prev || ruled) && (prev || ruled).rules && (prev || ruled).rules.cat[n] != null && (prev || ruled).rules.cat[n].split('|')[0] !== A.catIn(s, { name: n }));
      log.push({ week: d, prev: prev && prev.date, ruled: ruled && ruled.date, digest: dg.focus ? dg.focus.from : null, off: A.gradeOff(s).length, catsChangedSince: moved });
    });
    T.save(); T.state.active = K; return { log, nS };
  }, { K, weeks, SEED });
  await p.evaluate(() => document.querySelector('#openGrades').click()); await p.waitForTimeout(400);
  const cards = await p.evaluate(() => [...document.querySelectorAll('#gridwrap .gcard')].map(c => c.innerText.replace(/\s+/g, ' ').trim()).filter(t => /Class average|Sliding/i.test(t)));
  console.log(JSON.stringify(res.log, null, 0)); console.log('cards after week 6:', JSON.stringify(cards));
  const bad = res.log.slice(1).filter(x => !x.prev || !x.digest);
  check(!bad.length, `every weekly import after the first compares with the one before (${bad.length} of 5 weeks say the grading settings changed: ${bad.map(x => x.week + ' ' + JSON.stringify(x.catsChangedSince)).join('; ')})`);
  // a real settings change: the weights
  const after = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const g = T.gradingFor(s.prep); g.cats[0].w += 5; g.cats[1].w -= 5; A.regradeCourse(s.prep); T.save(); T.render();
    const dg = A.digestFor(s); return { prev: !!A.prevGradeSnap(s), ruled: !!A.gradeRulesChanged(s), digest: !!dg.focus, tags: document.querySelectorAll('#gridwrap .gstu .gtag').length,
      since: [...document.querySelectorAll('table.gstu tr[data-stu]')].map(tr => tr.children[2].innerText.trim()).filter(t => t && t !== '±0').length }; }, K);
  console.log('after a weights change:', JSON.stringify(after));
  check(!after.prev && after.ruled && !after.digest && !after.tags && !after.since, 'a weights change: nobody moves');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
