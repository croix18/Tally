// The weekly progress report, redesigned for the people who read it (Croix, 7 Nov 2026: "I want them perfect and easy
// to understand and read"; the canvas "Tally weekly report redesign"):
//   one grade, one sentence under it (the pending IXL points said once, every projection starting from that grade)
//   three plain facts; Do this week as a table with a "Grade after" column, the letter written when a step crosses
//   into a new one, and the two totals under the steps (the old "What would move the grade" table is gone)
//   the back: missing assignments in the front's order with cumulative grades; the IXL skills in three columns,
//   started skills first; the header says what the codes and the parentheses are
//   family words: "not handed in", not NHI; "Words on this page" under the signatures; the sample fits two sheets
const { chromium, fs, path, exe, check, done, pick, APP } = require('./lib');
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  // every student's report, parsed: the pieces the checks read
  const all = await p.evaluate(() => { const T = window.__tally; const s = T.state.sections[T.state.active]; const o = T.openSec(s); const rows = T.gbRows(s); const txt = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
    return s.grades.students.map((name, i) => { const html = T.studentReportSection(s, i, rows[i]); const d = new DOMParser().parseFromString(html, 'text/html');
      const r = T.computeGrade(o, i); const ixlIdx = rows[i] && rows[i].ixl != null ? rows[i].ixl : null; const copies = T.pendingCopies(s, o, i, ixlIdx); const pend = {}; copies.forEach(c => pend[c.a.name] = c.to); const b0 = copies.length ? T.computeGrade(o, i, pend) : r;
      const owed = T.owedWork(s, o, i, ixlIdx).owed; const work = owed.filter(a => !/\bixl\b/i.test(a.name)); const allIn = {}; work.forEach(a => allIn[a.name] = a.max); const allG = T.computeGrade(o, i, { ...pend, ...allIn });
      const panels = [...d.querySelectorAll('.panel .ph')].map(txt);
      return { name, grade: r && r.rounded, b0: b0 && b0.rounded, b0L: b0 && b0.letter, copies: copies.length, owed: owed.length, work: work.length, allG: allG && allG.rounded, allL: allG && allG.letter,
        gline: !!d.querySelector('.gline'), mainHead: txt(d.querySelector('.panel.main .ph')), withixl: !!d.querySelector('.withixl'), copyPts: copies.reduce((n, c) => n + Math.max(0, c.to - (c.a.status[i] === 'missing' ? 0 : Number(c.a.values[i]) || 0)), 0), all: txt(d.body), panels,
        tiles: [...d.querySelectorAll('.board small')].map(txt), stepHead: [...d.querySelectorAll('.panel.main .steps th')].map(txt), steps: [...d.querySelectorAll('.panel.main .steps tbody tr')].map(tr => ({ step: txt(tr.children[1]), after: txt(tr.children[2]) })),
        tots: [...d.querySelectorAll('.panel.main .tot')].map(txt), 
        back: [...d.querySelectorAll('.panel.miss .missT tbody tr')].map(tr => ({ name: txt(tr.children[1]), cell: txt(tr.children[3]) })), backHead: [...d.querySelectorAll('.panel.miss .missT th')].map(txt), note: txt(d.querySelector('.panel.miss .note')),
        ixlHead: txt(d.querySelector('.panel.ixl .ph')), units: [...d.querySelectorAll('.panel.ixl .u')].map(u => ({ head: txt(u.querySelector('.uh')), scores: [...u.querySelectorAll('.sk b')].map(x => Number(txt(x).replace(/[()]/g, ''))) })),
        words: txt(d.querySelector('.wordsOn')), nhi: /\bNHI\b/.test(d.body.textContent) }; }); });
  const S = all.filter(x => x.grade != null);
  check(S.length > 10, S.length + ' graded students');
  // 1. one grade, one sentence
  check(S.every(x => !x.gline && !x.withixl), 'nothing under the big grade but the category bars (the sentence went at Croix\'s word, 7 Nov 2026)');
  const moved = S.filter(x => x.copies && x.b0 !== x.grade);
  check(moved.length > 0 && S.every(x => x.mainHead === 'Do this week') && moved.every(x => !x.steps.length || Number(x.steps[0].after.split('%')[0]) >= x.b0), 'the Do this week title stands alone (Croix, 8 Nov 2026); with IXL points waiting for Focus the steps still start from the grade they make (' + moved.length + ' students)');
  check(S.every(x => !/Your IXL points go into Focus/.test(x.all)), 'the points are said once: the old lead line in Do this week is gone');
  // 2. each fact once: tiles, totals, no "What would move the grade"
  check(S.every(x => x.tiles.join('|') === 'Missing work|IXL at goal|Retake a test?') && S.every(x => !/all on the back|come first|skills in Units/.test(x.all)), 'three tiles: Missing work, IXL at goal, Retake a test?, each a label and a number');
  check(S.every(x => !x.panels.some(t => /What would move the grade|next assessment|IXL and the grade/i.test(t))) && S.every(x => !/The next test is worth|Finishing it lifts/.test(x.all)) && S.every(x => x.panels.some(t => /^Next test$/.test(t))), 'no "What would move the grade" or "IXL and the grade" box (Croix, 7 and 8 Nov 2026); the Next test box carries the date and unit only');
  const withSteps = S.filter(x => x.steps.length);
  check(withSteps.length > 0 && withSteps.every(x => x.stepHead.join('|') === '|Step|Grade after'), 'the steps are a table with a "Grade after" column (' + withSteps.length + ' students)');
  const letterOf = n => n >= 90 ? 'A' : n >= 80 ? 'B' : n >= 70 ? 'C' : n >= 60 ? 'D' : 'F';
  const letterRule = withSteps.every(x => { let prev = x.b0L; return x.steps.every(st => { if (!st.after) return true; const m = /^(\d+)%( [A-F])?$/.exec(st.after); if (!m) return false; const L = letterOf(+m[1]); const want = L !== prev; prev = L; return !!m[2] === want && (!m[2] || m[2].trim() === L); }); });
  check(letterRule, 'a step shows its letter only when it crosses into a new one (53%, 58%, 63% D)');
  const multi = withSteps.filter(x => x.work > 1);
  check(multi.length > 0 && multi.every(x => x.tots.length >= 1 && new RegExp('^(All \\d+|Both) missing assignments (turned in|made up|done) ?→ ' + x.allG + '% ' + x.allL + '$').test(x.tots[0])), 'under the steps, the total: "All N missing assignments turned in → X% L", the grade with every one in (' + multi.length + ' students)');
  // 3. the back: the front's order, cumulative, the note
  const backed = S.filter(x => x.work > 0);
  check(backed.every(x => x.backHead.join('|') === '|Assignment|Was due|Grade after, in this order'), 'the missing-assignments table has Assignment, Was due and "Grade after, in this order"');
  const cumOK = backed.every(x => { const vals = x.back.map(r => /^(\d+)%/.exec(r.cell)).filter(Boolean).map(m => +m[1]); return vals.length === x.work && vals.every((v, k) => !k || v >= vals[k - 1]) && vals[vals.length - 1] === x.allG; });
  check(cumOK, 'each row\'s grade counts the rows above it: never down, and the last row is the all-in total from the front');
  const frontFirst = backed.filter(x => x.steps.length).every(x => { const fronts = x.steps.map(s => (/Turn in (.+?) \d+ pts|Make up (.+?) \d+ pts/.exec(s.step) || [])[1]).filter(Boolean); return fronts.every((n, k) => x.back[k] && x.back[k].name.startsWith(n)) && !x.note; });
  check(frontFirst, 'the front\'s steps come first on the back, in their order (no note under the table: Croix struck it)');
  // 4. the IXL list
  const withIxl = S.filter(x => x.units.length);
  check(withIxl.length > 0 && withIxl.every(x => /goal: SmartScore \d+ · \(your score now\)/.test(x.ixlHead) && !/search box/.test(x.ixlHead) && /unit bar: at goal started/.test(x.ixlHead)), 'the IXL header says the goal, what the parentheses are and what the unit bar shows (the codes sentence struck by Croix)');
  const orderOK = withIxl.every(x => x.units.every(u => { const sc = u.scores; const firstZero = sc.indexOf(0); const started = firstZero < 0 ? sc : sc.slice(0, firstZero); return started.every((v, k) => !k || v <= started[k - 1]) && (firstZero < 0 || sc.slice(firstZero).every(v => v === 0)); }));
  check(orderOK, 'inside each unit the started skills come first, closest to goal at the top, then the skills not begun');
  // 5. family words
  check(S.every(x => !x.nhi), 'no report says "NHI"');
  check(S.every(x => !x.words && !/Since the last report/.test(x.all)), 'no "Words on this page" line and no "Since the last report" strip (both struck by Croix, 7 Nov 2026)');
  // 6. the sample student with the most owed prints on two sheets, the plan box on the front
  const idx = await p.evaluate(() => { const T = window.__tally; const s = T.state.sections[T.state.active]; const o = T.openSec(s); const rows = T.gbRows(s); let best = -1, bi = 0; s.grades.students.forEach((_, i) => { const n = T.owedWork(s, o, i, rows[i] && rows[i].ixl != null ? rows[i].ixl : null).owed.length; if (n > best && rows[i] && rows[i].ixl != null) { best = n; bi = i; } }); return bi; });
  const [w] = await Promise.all([ctx.waitForEvent('page'), p.evaluate(i => { const T = window.__tally; T.printStudentReports(T.state.sections[T.state.active], [i], 'One'); }, idx)]);
  await w.waitForLoadState(); await w.waitForFunction(() => document.body.getAttribute('data-paged'), null, { timeout: 15000 });
  const lay = await w.evaluate(() => { const pages = [...document.querySelectorAll('.page')]; return { n: pages.length, pledgeOn: pages.findIndex(pg => pg.querySelector('.pledge')), sigsOn: pages.findIndex(pg => pg.querySelector('.sigs')), missOn: pages.findIndex(pg => pg.querySelector('.panel.miss')), cols: getComputedStyle(document.querySelector('.sks')).gridTemplateColumns.split(' ').length }; });
  check(lay.n === 2 && lay.pledgeOn === 0 && lay.sigsOn === 0 && lay.missOn === 1 && lay.cols === 3, 'the student with the most owed prints on two sheets: plan and signatures on the front, the lists on the back in three columns: ' + JSON.stringify(lay));
  await w.close();
  // 7. the unit being worked in and its standards, under the tiles (Croix, 8 Nov 2026)
  const wi = await p.evaluate(() => { const T = window.__tally; const s = T.state.sections[T.state.active]; const rows = T.gbRows(s); const d = new DOMParser().parseFromString(T.studentReportSection(s, 0, rows[0]), 'text/html'); const txt = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
    const u = T.unitsOf(s).find(x => x.current); const col = d.querySelector('.tcol'); return { unit: txt(d.querySelector('.panel.wi .wiu')), codes: txt(d.querySelector('.panel.wi .wis')), want: u ? u.short + ' ' + u.title : '', order: col ? [...col.children].map(c => c.className).join(',') : '' }; });
  check(wi.unit === wi.want && /^MA\.[78]\.[A-Z]+\.\d\.\d( · MA\.[78]\.[A-Z]+\.\d\.\d)*$/.test(wi.codes) && wi.order === 'board,panel wi,panel next', 'a "Working in" box under the tiles names the unit and its B.E.S.T. benchmark codes, above the Next test box: ' + wi.unit + ' | ' + wi.codes);
  check(errs.length === 0, 'no errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); done();
})().catch(e => { console.log('FAIL crashed: ' + (e && e.stack || e)); process.exitCode = 1; });
