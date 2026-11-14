// 13 Nov 2026 (Croix): "harden that engine. Make sure the ixl units match the assessment units. Can you also make each
// dot clickable and it pops up the students name" and "I'm still getting the error about the mismatch of grades and it
// links me to the categories page which I can't do anything to rectify ... I have no idea what the situation is."
//   1. the Grades scatter pairs each unit's IXL with that unit's assessments only, per student;
//   2. every dot opens a card naming its student(s), by mouse and by keyboard, and leads to the student's page;
//   3. the Focus-difference notice names who differs, and "See why" tests what would explain each one.
const { chromium, fs, path, exe, check, done, APP, pick } = require('./lib');
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const K = '1205050-7T1A';

  // ---- the name reader ----
  const names = await p.evaluate(() => { const f = window.__tally.asgUnitNums; return Object.fromEntries(['Unit 3 Assessment', 'Units 3-4 Test', 'Unit 3 & 4 Quiz', 'Units 8 and 9', '3.02 Quiz', 'Unit 1.4 Check', 'Unit 12 Test 10/21', 'Whiteboard Practice Week 9/21', 'Squares and Cubes Quiz', 'Unit 30 Test', 'Unit 3/4 Test', 'Unit 3 and Unit 4 Test', 'Units 3, 4, and 5 Test', 'Unit 3 Test - 10/21'].map(n => [n, f(n).join(',')])); });
  check(names['Unit 3/4 Test'] === '3,4' && names['Unit 3 and Unit 4 Test'] === '3,4' && names['Units 3, 4, and 5 Test'] === '3,4,5' && names['Unit 3 Test - 10/21'] === '3', 'a slash, "and Unit", and a three-unit list are read; a trailing date is not');
  check(names['Unit 3 Assessment'] === '3' && names['Units 3-4 Test'] === '3,4' && names['Unit 3 & 4 Quiz'] === '3,4' && names['Units 8 and 9'] === '8,9', 'a name\'s units: one, a range, a pair');
  check(names['3.02 Quiz'] === '3' && names['Unit 1.4 Check'] === '1' && names['Unit 12 Test 10/21'] === '12' && names['Unit 30 Test'] === '30', 'a lesson number gives its unit; a date after the unit is not a unit');
  check(names['Whiteboard Practice Week 9/21'] === '' && names['Squares and Cubes Quiz'] === '', 'a date or a plain name carries no unit');

  // ---- 1. the pairing ----
  const m = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const r = T.ixlTestPairs(s); const gb = s.grades; const rows = T.gbRows(s); const units = T.unitsOf(s);
    // by hand for every dot: only tests the student has a score on, and only those tests' units on the IXL side
    const byHand = r.pts.every(pt => { let e = 0, q = 0; const nums = new Set(); r.units.forEach(u => u.tests.forEach(t => { const a = gb.assignments.find(x => x.name === t.name); if (a.status[pt.i] !== 'score') return; nums.add(u.num); }));
      const seen = new Set(); r.units.forEach(u => u.tests.forEach(t => { if (seen.has(t.name)) return; seen.add(t.name); const a = gb.assignments.find(x => x.name === t.name); if (a.status[pt.i] === 'score') { e += a.values[pt.i]; q += a.max; } }));
      let d = 0, poss = 0; [...nums].forEach(n => { const u = units.find(x => x.num === n); poss += T.activeFor(s, u, rows[pt.i].ixl).length; d += T.points(s, u, rows[pt.i].ixl); });
      return Math.abs(pt.tests - e / q * 100) < 1e-9 && Math.abs(pt.ixl - d / poss * 100) < 1e-9 && pt.units.join() === [...nums].sort((a, b) => a - b).join(); });
    return { units: r.units.map(u => u.short + ': ' + u.tests.map(t => t.name + (t.how === 'date' ? '*' : '')).join(' | ')), left: r.left, n: r.pts.length, un: r.unmatched, byHand, anyIxl: r.units.some(u => u.tests.some(t => /ixl/i.test(t.name))), total: gb.students.length, noScore: r.noScore }; }, K);
  // 14 Nov 2026: "It should use the unit assessments only for that specific chart. The Unit assessments to the unit ixls."
  check(m.units.length === 1 && m.units[0] === 'Unit 1: Unit 1 Assessment', 'the unit assessment only, beside its own unit\'s IXL: ' + m.units.join(' · '));
  const lo = m.left.map(x => x.name + ' / ' + x.why);
  check(['Unit 1 Vocabulary Quiz', 'Unit 1 Notebook Check', 'Unit 2 Vocabulary Quiz', 'Squares and Cubes Quiz'].every(n => lo.includes(n + ' / not a unit assessment')), 'vocabulary quizzes, notebook checks and other quizzes are left out and named: ' + lo.join('; '));
  const ua = await p.evaluate(() => { const f = window.__tally.isUnitAssessment; return ['Unit 3 Assessment', 'Unit 3 Test', 'Units 3-4 Exam', 'Unit 3 Assessment Retake', 'Unit 3 Vocabulary Quiz', 'Unit 3 Notebook Check', 'Unit 3 Practice Test', 'Proportions Test', 'Unit 3 Quiz', 'Unit 3 Re-Assessment', 'Unit 3 Test Corrections'].map(n => f(n) ? 1 : 0).join(''); });
  check(ua === '11100000000', 'a unit assessment is named for its unit and called an assessment, test or exam; retakes, quizzes, checks and practice tests are not: ' + ua);
  check(!m.anyIxl && m.byHand, 'no IXL column is on the test side, and every dot equals a hand count over its own matched units');
  check(m.n + m.un + m.noScore === m.total && m.n === 16, 'every student is a dot or is counted as left out (' + m.n + ' dots, ' + m.un + ' not matched to IXL)');

  // a unit whose IXL isn't assigned leaves its tests out, and they are named with the reason
  const un = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const u1 = T.unitsOf(s).find(u => u.num === 1); T.state.assigned = T.state.assigned || {}; T.state.assigned[s.prep] = { ...(T.state.assigned[s.prep] || {}), [u1.name]: false };
    const r = T.ixlTestPairs(s); const out = { units: r.units.map(u => u.num), left: r.left.map(x => x.name + ' / ' + x.why), u: r.pts.every(pt => pt.units.join() === '2') }; delete T.state.assigned[s.prep][u1.name]; return out; }, K);
  check(un.units.join() === '' && un.left.some(x => /^Unit 1 Assessment \/ no assigned IXL for Unit 1$/.test(x)), 'with Unit 1\'s IXL not assigned, its assessment is left out by name with the reason: ' + un.left.join('; '));
  // a test not handed in is not a score: it leaves that test (and its unit) out for that student instead of a 0
  const nhi = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const gb = s.grades; const g2 = T.gradingFor(s.prep); const q2 = gb.assignments.find(a => a.name === 'Unit 2 Vocabulary Quiz'); q2.name = 'Unit 2 Assessment'; g2.map['Unit 2 Assessment'] = 'Assessments'; const r0 = T.ixlTestPairs(s); const pt = r0.pts[0]; const keep = JSON.stringify(gb.assignments);
    gb.assignments.forEach(a => { if (/^Unit 1 /.test(a.name) && !/ixl/i.test(a.name)) { a.status[pt.i] = 'missing'; a.values[pt.i] = null; } });
    const r1 = T.ixlTestPairs(s).pts.find(x => x.i === pt.i); gb.assignments = JSON.parse(keep); gb.assignments.find(a => a.name === 'Unit 2 Assessment').name = 'Unit 2 Vocabulary Quiz'; delete g2.map['Unit 2 Assessment']; return { before: pt.units.join(), after: r1 ? r1.units.join() : null, y: r1 ? r1.tests : null }; }, K);
  check(nhi.before === '1,2' && nhi.after === '2' && nhi.y > 0, 'with two unit assessments, a student who did not hand in Unit 1\'s is plotted on Unit 2 against Unit 2 alone, not pulled down by a zero');
  // a pretest never counts
  const pre = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const a = s.grades.assignments.find(a => a.name === 'Unit 1 Assessment'); a.name = 'Unit 1 Pretest'; const g = T.gradingFor(s.prep); g.map['Unit 1 Pretest'] = 'Assessments'; const r = T.ixlTestPairs(s); a.name = 'Unit 1 Assessment'; delete g.map['Unit 1 Pretest']; return r.left.map(x => x.name + ' / ' + x.why); }, K);
  check(pre.includes('Unit 1 Pretest / a pretest'), 'a pretest is left out and named');

  // ---- 2. the dots ----
  await p.click('#openGrades'); await p.waitForTimeout(500);
  const txt = (await p.textContent('#gridwrap')).replace(/\s+/g, ' ');
  check(/Matched by unit: Unit 1 IXL with Unit 1 Assessment\./.test(txt) && /Left out: [^.]*Unit 2 Vocabulary Quiz[^.]*\(not a unit assessment\) · 7 students not matched to IXL/.test(txt), 'under the chart: what is matched to what, and what was left out');
  const dots = await p.$$eval('.scatter .ptg', gs => gs.map(g => ({ ids: g.dataset.pt.split(','), n: (g.querySelector('.pn') || {}).textContent || '', tab: g.getAttribute('tabindex'), role: g.getAttribute('role'), label: g.getAttribute('aria-label') })));
  const all = dots.flatMap(d => d.ids);
  check(all.length === 16 && new Set(all).size === 16 && dots.every(d => d.tab === '0' && d.role === 'button' && d.label), 'every one of the 16 students is on exactly one dot, and each dot is a button');
  check(dots.filter(d => d.ids.length > 1).every(d => d.n === String(d.ids.length)) && dots.filter(d => d.ids.length === 1).every(d => d.n === ''), 'a dot shared by students carries their count');
  // no dot's centre lies under another dot
  const clear = await p.$$eval('.scatter .ptg', gs => gs.every(g => { const c = g.querySelector('.pt').getBoundingClientRect(); const el = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2); return el && el.closest('.ptg') === g; }));
  check(clear, 'no dot is hidden behind another: each can be clicked at its centre');
  const stu = await p.evaluate(K => window.__tally.state.sections[K].grades.students, K);
  let okNames = true, okShut = true;
  for (let k = 0; k < dots.length; k++) { await p.keyboard.press('Escape'); await p.click('.gcards'); await p.locator('.scatter .ptg').nth(k).click(); await p.waitForTimeout(60); const vis = await p.locator('.scpop').isVisible(); const got = vis ? await p.$$eval('.scpop [data-open]', bs => bs.map(x => x.textContent)) : [];
    if (!vis || got.join('|') !== dots[k].ids.map(i => stu[Number(i)]).join('|')) { okNames = false; console.log('dot', k, got, dots[k].ids); } }
  check(okNames, 'clicking each dot opens a card with the name of every student it stands for');
  const one = dots.findIndex(d => d.ids.length === 1); await p.keyboard.press('Escape'); await p.click('.gcards'); await p.locator('.scatter .ptg').nth(one).click(); await p.waitForTimeout(60);
  const card = (await p.locator('.scpop').innerText()).replace(/\s+/g, ' ');
  check(/IXL \d+% at goal · assessments \d+% · Units? [\d, ]+$/.test(card), 'the card says the student\'s two numbers and which units they are made of: ' + card);
  await p.locator('.scatter .ptg').nth(one).click(); await p.waitForTimeout(60); okShut = !(await p.locator('.scpop').isVisible()); check(okShut, 'the same dot again closes the card');
  await p.locator('.scatter .ptg').nth(one).focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(60); const kb = await p.locator('.scpop').isVisible(); await p.keyboard.press('Escape'); await p.waitForTimeout(60);
  check(kb && !(await p.locator('.scpop').isVisible()), 'Enter on a focused dot opens the card; Escape closes it');
  await p.locator('.scatter .ptg').nth(one).click(); await p.waitForTimeout(60); await p.click('.gcards'); await p.waitForTimeout(60); check(!(await p.locator('.scpop').isVisible()), 'a click anywhere else closes it');
  const box = await p.evaluate(() => { const a = document.querySelector('.scwrap').getBoundingClientRect(); document.querySelector('.scatter .ptg').dispatchEvent(new MouseEvent('click', { bubbles: true })); const c = document.querySelector('.scpop').getBoundingClientRect(); return c.left >= a.left - 1 && c.right <= a.right + 1; }); check(box, 'the card stays inside the chart\'s width');
  // names hidden: the card masks them like the rest of the screen
  await p.evaluate(() => { const T = window.__tally; T.state.settings.hideNames = true; T.render(); }); await p.waitForTimeout(300);
  await p.locator('.scatter .ptg').nth(one).click(); await p.waitForTimeout(60); const masked = await p.$$eval('.scpop [data-open]', bs => bs.map(x => x.textContent));
  check(masked.length === 1 && /^[A-Z]\. [A-Z]\.$/.test(masked[0]) && !(await p.locator('.scatter').innerHTML()).includes(stu[Number(dots[one].ids[0])]), 'with names hidden the card and the chart carry initials only: ' + masked[0]);
  await p.evaluate(() => { const T = window.__tally; T.state.settings.hideNames = false; T.render(); }); await p.waitForTimeout(300);
  await p.locator('.scatter .ptg').nth(one).click(); await p.waitForTimeout(60); await p.click('.scpop [data-open]'); await p.waitForTimeout(500);
  const view = await p.evaluate(() => ({ t: document.body.innerText.toLowerCase(), stu: window.__tally.view && window.__tally.view.stu })); check(view.t.includes(stu[Number(dots[one].ids[0])].split(',')[0].toLowerCase()) && !(await p.$('.scatter')), 'the name in the card opens that student\'s page');
  await p.click('#openGrades'); await p.waitForTimeout(400);

  // ---- the board's "IXL and a test" reads a name's unit the same way ----
  const lab = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const st = T.state.settings; const u = n => 'unit:' + T.unitsOf(s).find(x => x.num === n).name; const keep = st.labCorr;
    st.labCorr = { [s.prep]: { x: u(2) } }; const own = T.corrPick(s.prep).y;
    const a = s.grades.assignments.find(q => q.name === 'Unit 2 Vocabulary Quiz'); a.name = 'Units 1-2 Test'; const range = T.corrPick(s.prep).y; a.name = 'Unit 2 Vocabulary Quiz';
    st.labCorr = { [s.prep]: { x: u(2), y: 'gb:Unit 1 Assessment' } }; const off = T.labCorrMarkup(s.prep, 'class');
    st.labCorr = { [s.prep]: { x: u(1), y: 'gb:Unit 1 Assessment' } }; const on = T.labCorrMarkup(s.prep, 'class'); st.labCorr = keep;
    return { own, range, off: /Different units:<\/b> Unit 1 Assessment is a Unit 1 score, set beside Unit 2's IXL/.test(off), on: /Different units/.test(on) }; }, K);
  check(lab.own === 'gb:Unit 2 Vocabulary Quiz' && lab.range === 'gb:Units 1-2 Test', 'the board pairs a unit with its own test, a "Units 1-2 Test" included: ' + lab.own + ' / ' + lab.range);
  check(lab.off && !lab.on, 'a unit set by hand beside another unit\'s test says so on the board; a matched pair says nothing');
  // ---- 3. Tally and Focus differ ----
  check(!(await p.$('.notice.gdiff')), 'grades that match Focus raise no notice');
  // (a) one student: Focus counts a blank as a zero
  const a = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const gb = s.grades; let hit = null;
    for (const x of gb.assignments) { for (let i = 0; i < gb.students.length && !hit; i++) { if (x.status[i] !== 'score' || !(x.max > 0)) continue; const keepV = x.values[i]; x.status[i] = 'blank'; x.values[i] = null; const now = T.computeGrade(s, i).rounded; const as0 = T.computeGrade(s, i, { [x.name]: 0 }).rounded;
        if (now !== as0 && Math.abs(now - as0) >= 3) { gb.overall[i] = as0; hit = { i, name: gb.students[i], asg: x.name, now, as0 }; } else { x.status[i] = 'score'; x.values[i] = keepV; } } if (hit) break; }
    T.save(); T.render(); return hit; }, K); await p.waitForTimeout(400);
  const n1 = (await p.locator('.notice.gdiff').innerText()).replace(/\s+/g, ' ');
  check(new RegExp(`differs from Focus's for 1 of 23 students: ${a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(Tally ${a.now}, Focus ${a.as0}\\)`).test(n1) && /The other 22 match exactly/.test(n1) && !/Categories/.test(n1), 'the notice names the student and both numbers, and no longer sends him to Categories: ' + n1);
  await p.click('#gdWhy'); await p.waitForTimeout(300);
  const d1 = (await p.locator('.gdtab tbody').innerText()).replace(/\s+/g, ' ');
  check(d1.includes(a.name) && d1.includes(`Would match if the blank on ${a.asg} counted as a 0. That is arithmetic, not proof`) && /Tally's categories: Assessments [\d.]+%/.test(d1), 'See why: the one cell that would close the gap is named as arithmetic, not as fact, with Tally\'s category averages to compare: ' + d1.slice(0, 260));
  check(/agree for 22 of 23 students/.test((await p.locator('.gdiffBody').innerText()).replace(/\s+/g, ' ')), 'the dialog says how many agree');
  // the Overview lists it, until he says to stop
  const homeHas = async () => p.evaluate(K => window.__tally.attentionItems(window.__tally.state.sections[K]).map(x => x.text).join(' | '), K);
  check(/Tally's grade differs from Focus's for 1 student/.test(await homeHas()), 'Needs attention carries it, in the same words');
  await p.click('#gdQuiet'); await p.waitForTimeout(400);
  check(!/differs from Focus/.test(await homeHas()) && await p.locator('.notice.gdiff.soft').count() === 1, '"Stop flagging" takes it off Needs attention; the Grades screen keeps a quiet line');
  await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const j = s.grades.overall.findIndex((v, i) => v != null && T.computeGrade(s, i).rounded === v); s.grades.overall[j] -= 4; T.render(); }, K); await p.waitForTimeout(300);
  check(/differs from Focus's for 2 students/.test(await homeHas()), 'a new difference brings it back');
  // (b) class-wide: Focus isn't counting one assignment
  const bRes = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const gb = s.grades; const x = gb.assignments.find(q => q.name === 'Unit 1 Assessment');
    // Focus's column rebuilt from the scores without the notebook check
    gb.overall = gb.students.map((_, i) => T.computeGrade(s, i, { [x.name]: null }).rounded); T.render(); const f = T.fitCategories(s); const gd = T.gradeDiff(s, f); return gd ? { n: gd.off.length, whole: gd.whole.map(w => w.html).join(' / '), weights: gd.whole.some(w => w.weights), fix: gd.whole.some(w => w.fix) } : null; }, K);
  check(bRes && bRes.n >= 2 && /Every grade matches when <b>Unit 1 Assessment<\/b> isn't counted/.test(bRes.whole) && !bRes.weights && !bRes.fix, 'an assignment Focus isn\'t counting is found and named for the whole class (nothing for Tally to change, so no button): ' + JSON.stringify(bRes).slice(0, 200));
  // (c) class-wide: the weights in Tally are not Focus's
  const cRes = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const gb = s.grades; gb.overall = gb.students.map((_, i) => T.computeGrade(s, i).rounded); const g = T.gradingFor(s.prep); g.cats.forEach(c => c.w = c.name === 'Assessments' ? 50 : c.name === 'Classwork' ? 40 : 10); T.save(); T.render();
    const f = T.fitCategories(s); const gd = T.gradeDiff(s, f); return gd ? { n: gd.off.length, weights: (gd.whole.find(w => w.weights && w.weights.join() === '70,25,5') || {}).weights, at: gd.whole.findIndex(w => w.weights && w.weights.join() === '70,25,5'), all: gd.whole.map(w => w.html), exact: f.exact } : { exact: f.exact }; }, K); await p.waitForTimeout(300);
  check(cRes.exact === false && cRes.weights && cRes.weights.join() === '70,25,5', 'wrong weights: the set that reproduces every Focus grade is found (' + JSON.stringify(cRes.weights) + ')');
  await p.click('#gdWhy'); await p.waitForTimeout(300); await p.click(`[data-gdfix="${cRes.at}"]`); await p.waitForTimeout(500);
  const fixed = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; return { exact: T.fitCategories(s).exact, w: T.gradingFor(s.prep).cats.map(c => c.w).join() }; }, K);
  check(fixed.exact && fixed.w === '70,25,5' && !(await p.$('.notice.gdiff')), '"Use these weights" sets them and the grades match Focus again: ' + JSON.stringify(fixed) + ' ' + (await p.$('.notice.gdiff') ? (await p.locator('.notice.gdiff').innerText()).slice(0, 200) : ''));
  await p.click('#gdUndo'); await p.waitForTimeout(400); check((await p.evaluate(K => window.__tally.gradingFor(window.__tally.state.sections[K].prep).cats.map(c => c.w).join(), K)) === '50,40,10', 'and it can be undone');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})();
