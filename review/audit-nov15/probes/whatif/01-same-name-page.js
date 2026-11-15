// WIF-01: two students with one name. The 14 Nov fix marks each name ("DOE, JANE (ID …0421)") and findStudent tries the
// exact name first, but studentBooks, openShow, the Prev/Next position and the closed-quarter finals still match by
// norm(name), which strips the mark: the second student's page shows the FIRST student's what-ifs, quickest way,
// assignment table and Show student.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/whatif/repo';
const { chromium, fs, exe, check, done, pick, APP } = require(path.join(REPO, 'tests/lib.js'));
const K = '1205050-7T1A';
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  // the same name twice in a saved gradebook (as tests/review-nov14.js stages it): told apart on load by the end of the ID
  await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const gb = s.grades; let j = 1; const g0 = T.computeGrade(s, 0).rounded; while (T.computeGrade(s, j).rounded === g0) j++; window.__j = j; gb.ids = gb.students.map((_, i) => String(700000 + i * 37)); gb.students[j] = gb.students[0]; T.save(); }, K);
  const J = await p.evaluate(() => window.__j); await p.reload(); await p.waitForTimeout(800);
  const names = await p.evaluate(([K, J]) => { const gb = window.__tally.state.sections[K].grades; return [gb.students[0], gb.students[J]]; }, [K, J]);
  const want = await p.evaluate(([K, J]) => { const A = window.__all, s = window.__tally.state.sections[K]; const l = A.classStudents(s); return { first: A.computeGrade(s, 0).rounded, second: A.computeGrade(s, J).rounded, at: l.indexOf(s.grades.students[J]) + 1, n: l.length }; }, [K, J]);
  await p.evaluate(([K, n]) => window.__tally.openProfile(K, n), [K, names[1]]); await p.waitForTimeout(500);
  const page = await p.evaluate(() => { const t = s => { const e = document.querySelector(s); return e ? e.innerText : ''; };
    const tile = /(\d+)%/.exec(t('.gcard.big')); const now = /Now\s*(\d+)/.exec(t('#pWhat')); const book = /·\s*(\d+)%\s*[A-F]\s*·/.exec(t('.qbook h3'));
    return { tile: tile && +tile[1], whatIfNow: now && +now[1], bookHead: book && +book[1], pos: (/(\d+) of (\d+)/.exec(t('#bar .meta')) || [])[0] }; });
  await p.click('#pShow'); await p.waitForTimeout(400);
  const show = await p.evaluate(() => { const e = document.querySelector('.shNow b'); return e ? parseInt(e.textContent) : null; });
  console.log('names:', names.join(' / '), ' row of the second:', J);
  console.log('OBSERVED: second student\'s page: tile', page.tile + '%, what-ifs "Now"', page.whatIfNow + '%, assignment table head', page.bookHead + '%, Show student', show + '%, position "' + page.pos + '"');
  console.log('EXPECTED: every figure is the second student\'s own grade', want.second + '% (the first student has', want.first + '%), position "' + want.at + ' of ' + want.n + '" (its own place in classStudents)');
  check(page.tile === want.second, 'tile shows the second student');
  check(page.whatIfNow === want.second, 'what-ifs ("Now") are the second student\'s');
  check(page.bookHead === want.second, 'the assignment table is the second student\'s');
  check(show === want.second, 'Show student shows the second student');
  check(page.pos === want.at + ' of ' + want.n, 'Prev/Next position is the second student\'s');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
