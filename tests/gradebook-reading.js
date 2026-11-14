// 14 Nov 2026, from the hostile review (NOTES: "Hostile review, 14 Nov 2026", items 1 and 2).
//   1. The gradebook reader no longer changes grades silently: a percent cell is a percent of the column's points, a
//      0-point column is extra credit (Focus's rule), a column with no points and a text grade Tally doesn't know are
//      left out and ASKED about (once per course), an impossible score is left out and shown.
//   2. "See why" no longer states coincidences as facts: a class-wide cause must reproduce every grade; a per-student
//      line is "would match if", only when one cell alone does it, never for a one-point gap or when the class is off.
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
  const toGrades = async () => { if (!(await p.$('#openGrades'))) { await p.click(`[data-k="${K}"]`); await p.waitForTimeout(300); } await p.click('#openGrades'); await p.waitForTimeout(400); };

  // ---------- the reader ----------
  const r = await p.evaluate(() => { const rows = [['Student', 'Grade', 'Quiz A\n20 Points', 'Percent Only', 'Codes\n10 Points', 'Bonus\n0 Points', 'No Points', 'Range\n10 Points'],
    ['Doe, Jane', '88%', '50%', '80%', 'Late', '2', '7', '-5'], ['Roe, Rick', '70%', '15', '60%', 'NG', '', '9', '150'], ['Poe, Pat', '90%', '8', '100%', 'X', '1', '', '9'], ['Low, Lee', '60%', '20', '', 'NHI Not Handed In', '', '4', '21'], ['May, Mia', '75%', '12', '90%', 'Inc', '', '5', '10'], ['Kay, Kit', '75%', '12', '90%', '-', '', '5', '*']];
    const gb = window.__tally.parseGradebook(rows); return gb && gb.assignments.map(a => ({ name: a.name, max: a.max, values: a.values, status: a.status, codes: a.codes || null })); });
  const A = n => r.find(a => a.name === n);
  check(A('Quiz A').max === 20 && A('Quiz A').values.join() === '10,15,8,20,12,12', 'a "50%" cell in a 20-point column is 10 points; the column stays out of 20 (it used to become out of 100): ' + A('Quiz A').values.join());
  check(A('Percent Only').max === 100 && A('Percent Only').values[0] === 80, 'a column of percents with no points anywhere is still read out of 100');
  const c = A('Codes'); check(c.status.join() === 'unread,excused,unread,missing,unread,unread' && c.codes[0] === 'Late' && c.codes[2] === 'X' && c.codes[4] === 'Inc' && c.codes[5] === '-', 'NG is excused and NHI is missing; "Late", "X", "Inc" and "-" are kept as codes to ask about, not guessed: ' + c.status.join());
  check(A('Bonus').max === 0 && A('Bonus').values[0] === 2 && A('No Points').max === null && A('No Points').values[1] === 9, 'a 0-point column and a column with no points both come through with their scores');
  const g = A('Range'); check(g.status.join() === 'unread,unread,score,unread,score,unread' && g.values[0] === null && g.codes[0] === '-5' && g.codes[1] === '150' && g.codes[3] === '21' && g.values[2] === 9, 'scores below zero or over twice the points are left out and kept to show (they used to make grades of -50% and 1500%): ' + g.status.join());

  // ---------- extra credit, a column with no points, a text grade ----------
  const base = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; return { ok: T.fitCategories(s).exact, off: T.gradeOff(s).length, n: s.grades.students.length, g0: T.computeGrade(s, 0) }; }, K);
  check(base.ok && base.off === 0, 'start: the scrubbed class reproduces Focus exactly');
  const ec = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const gb = s.grades; const n = gb.students.length; const g = T.gradingFor(s.prep);
    const before = T.computeGrade(s, 0).cats.Assessments; gb.assignments.push({ name: 'Bonus Problem', category: 'Assessments', max: 0, values: gb.students.map((_, i) => i === 0 ? 3 : null), status: gb.students.map((_, i) => i === 0 ? 'score' : 'blank'), missing: 0, excused: 0, due: '', assignedOn: '' }); g.map['Bonus Problem'] = 'Assessments'; g.how['Bonus Problem'] = 'user';
    const after = T.computeGrade(s, 0).cats.Assessments; const other = T.computeGrade(s, 1).rounded === gb.overall[1];
    return { before, after, other }; }, K);
  check(ec.after.possible === ec.before.possible && Math.abs(ec.after.earned - ec.before.earned - 3) < 1e-9 && ec.other, 'a 0-point column is extra credit: its 3 points add to the category, nothing to the possible, and nobody else moves');
  // Focus's grades now include the bonus: Tally matches with nothing asked
  const np = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const gb = s.grades; const g = T.gradingFor(s.prep);
    gb.assignments.push({ name: 'Worksheet 9', category: 'Classwork', max: null, values: gb.students.map((_, i) => i < 6 ? 4 : null), status: gb.students.map((_, i) => i < 6 ? 'score' : 'blank'), missing: 0, excused: 0, due: '', assignedOn: '' }); g.map['Worksheet 9'] = 'Classwork'; g.how['Worksheet 9'] = 'user';
    const out = T.computeGrade(s, 0).cats.Classwork.earned; gb.overall = gb.students.map((_, i) => T.computeGrade({ ...s, _ec: { 'Worksheet 9': true } }, i).rounded);
    T.save(); T.render(); const q = T.gbQuestions(s); const f = T.fitCategories(s); const gd = T.gradeDiff(s, f);
    return { out, q: q.noPoints.map(o => [o.name, o.rule, o.ecErr, o.noErr]), open: q.open, off: T.gradeOff(s).length, whole: gd ? gd.whole.map(w => w.html + '|' + (w.fix ? w.fix.label : '')) : [], home: T.attentionItems(s).map(x => x.text).join(' | ') }; }, K);
  check(np.open === 1 && np.q[0][0] === 'Worksheet 9' && np.q[0][1] === null && np.q[0][2] === 0 && np.q[0][3] > 0, 'a column with no points is not counted and is listed as a decision, with the proof that Focus counts it: ' + JSON.stringify(np.q));
  check(np.off >= 2 && np.whole.length === 1 && /<b>Worksheet 9<\/b> \(no points in the export\) is extra credit\.\|Count it as extra credit/.test(np.whole[0]), 'See why finds it as the one cause for the whole class, with the fix: ' + np.whole.join(' / '));
  check(/The gradebook has one thing only you can decide/.test(np.home), 'Needs attention says a decision is waiting');
  await toGrades();
  const n0 = (await p.locator('.notice.gbq').innerText()).replace(/\s+/g, ' ');
  check(/One thing in this gradebook needs a decision: Worksheet 9 has no points\. The export doesn't say how Focus counts it, so it is left out of the grade until you say\./.test(n0), 'the Grades screen says what is undecided and that it is left out meanwhile: ' + n0.slice(0, 160));
  await p.click('#gqDecide'); await p.waitForTimeout(300);
  const row = (await p.locator('.gqrow').first().innerText()).replace(/\s+/g, ' ');
  check(/Worksheet 9 no points possible in the export · 6 scores\. In Focus an assignment with no points is extra credit\. Extra credit Focus's grades match this way Not in the grade/.test(row), 'Decide: both choices, and which one reproduces Focus: ' + row);
  await p.click('.gqrow [data-rule="ec"]'); await p.waitForTimeout(400);
  const dec = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; return { off: T.gradeOff(s).length, ec: T.gradingFor(s.prep).ec['Worksheet 9'], on: document.querySelector('.gqrow [data-rule="ec"]').getAttribute('aria-pressed') }; }, K);
  check(dec.off === 0 && dec.ec === true && dec.on === 'true', 'choosing Extra credit counts it and every grade matches Focus');
  await p.click('#gdUndo'); await p.waitForTimeout(400); check((await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; return T.gradeOff(s).length > 0 && T.gradingFor(s.prep).ec['Worksheet 9'] === undefined; }, K)), 'and Undo takes the choice back');
  await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; T.gradingFor(s.prep).ec['Worksheet 9'] = true; T.regradeCourse(s.prep); T.save(); document.querySelector('#mCancel').click(); }, K); await p.waitForTimeout(400);
  check(/Worksheet 9 is extra credit/.test((await p.locator('.notice.gbq.soft').innerText())) && !/only you can decide/.test(await p.evaluate(K => window.__tally.attentionItems(window.__tally.state.sections[K]).map(x => x.text).join('|'), K)), 'once decided the notice goes quiet (it stays as a line with Change) and leaves Needs attention');

  // a text grade: left out until he says; Focus's grades show which way it counts; the rule holds after a reload
  const code = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const gb = s.grades; const a = gb.assignments.find(x => x.name === 'Unit 1 Assessment'); const who = [2, 5];
    a.codes = {}; who.forEach(i => { a.codes[i] = 'Late'; a.values[i] = null; a.status[i] = 'unread'; });
    gb.overall = gb.students.map((_, i) => T.computeGrade(s, i, who.includes(i) ? { [a.name]: 0 } : null).rounded);
    T.save(); T.render(); const q = T.gbQuestions(s); const gd = T.gradeDiff(s, T.fitCategories(s));
    return { q: q.codes.map(o => [o.code, o.n, o.rule, o.zeroErr, o.outErr]), off: T.gradeOff(s).length, whole: gd ? gd.whole.map(w => w.html + '|' + (w.fix ? w.fix.label : '')) : [], rows: gd ? gd.off.map(o => o.facts.join(';')) : [] }; }, K);
  check(code.q.length === 1 && code.q[0].slice(0, 3).join() === 'LATE,2,' && code.q[0][3] === 0 && code.q[0][4] > 0, '"Late" in two cells is one decision, left out for now; counted as a zero it reproduces Focus: ' + JSON.stringify(code.q));
  check(code.off === 2 && /“Late”<\/b> \(2 cells\) is a zero\.\|Count “Late” that way/.test(code.whole[0] || '') && code.rows.every(x => /couldn't read “Late” on <b>Unit 1 Assessment<\/b> \(as a 0 the grade matches\)/.test(x)), 'See why says the same for the class and for each student: ' + code.whole.join(' / '));
  await p.click('#gdWhy'); await p.waitForTimeout(300); await p.click('[data-gdfix="0"]'); await p.waitForTimeout(500);
  const ruled = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const a = s.grades.assignments.find(x => x.name === 'Unit 1 Assessment'); return { rule: T.gradingFor(s.prep).codes.LATE, st: [a.status[2], a.status[5]].join(), off: T.gradeOff(s).length, miss: a.missing }; }, K);
  check(ruled.rule === 'zero' && ruled.st === 'missing,missing' && ruled.off === 0 && ruled.miss >= 2, 'the fix sets the rule for the course: the cells count as zeros (and as missing work) and the grades match');
  await p.reload(); await p.waitForTimeout(800);
  const kept = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const a = s.grades.assignments.find(x => x.name === 'Unit 1 Assessment'); return { rule: T.gradingFor(s.prep).codes.LATE, ec: T.gradingFor(s.prep).ec['Worksheet 9'], codes: a.codes && a.codes[2], off: T.gradeOff(s).length }; }, K);
  check(kept.rule === 'zero' && kept.ec === true && kept.codes === 'Late' && kept.off === 0, 'the rules and the cells\' own text survive a reload: ' + JSON.stringify(kept));
  // a later import of the same text follows the rule without asking again
  const later = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const gb = T.parseGradebook([['Student', 'Grade', 'Quiz\n10 Points'], ['A, A', '50%', 'Late'], ['B, B', '90%', '9'], ['C, C', '80%', '8']]); T.applyCodes(gb, s.prep); return gb.assignments[0].status.join(); }, K);
  check(later === 'missing,score,score', 'a later gradebook with "Late" in it is read by the rule');

  // ---------- See why: no coincidences ----------
  const reset = `const T = window.__tally; const s = T.state.sections[K]; const gb = s.grades; gb.overall = gb.students.map((_, i) => T.computeGrade(s, i).rounded);`;
  const noise = await p.evaluate(new Function('K', reset + `[1, 8, 14].forEach((i, k) => gb.overall[i] += k % 2 ? 1 : -1); T.render(); const gd = T.gradeDiff(s, T.fitCategories(s));
    return { n: gd.off.length, whole: gd.whole.length, many: gd.many, would: gd.off.map(o => o.would).filter(Boolean), facts: gd.off.flatMap(o => o.facts).filter(f => !/rounding line/.test(f)) };`), K);
  check(noise.n === 3 && noise.whole === 0 && !noise.many && noise.would.length === 0 && noise.facts.length === 0, 'Focus off by one point for three students: no cause is claimed for any of them (the first build gave each one to nine): ' + JSON.stringify(noise));
  await toGrades(); await p.click('#gdWhy'); await p.waitForTimeout(300);
  const said = (await p.locator('.gdtab tbody').innerText()).replace(/\s+/g, ' ');
  check((said.match(/No single score explains it\./g) || []).length + (said.match(/rounding line/g) || []).length >= 3 && !/isn't counted in Focus|counts as a 0 in Focus/.test(said), 'the dialog says so plainly and states nothing about Focus as fact');
  await p.click('#mCancel'); await p.waitForTimeout(200);
  const big = await p.evaluate(new Function('K', reset + `for (let i = 0; i < gb.students.length; i += 2) gb.overall[i] += (i % 3) - 1 || 2; T.render(); const gd = T.gradeDiff(s, T.fitCategories(s));
    return { n: gd.off.length, tot: gd.n, many: gd.many, whole: gd.whole.length, would: gd.off.map(o => o.would).filter(Boolean).length };`), K);
  check(big.many && big.whole === 0 && big.would === 0 && big.n > big.tot / 3, 'half the class off by random amounts: called class-wide, with no per-student guesses and no invented cause: ' + JSON.stringify(big));
  const twoGap = await p.evaluate(new Function('K', reset + `gb.overall[4] += 2; gb.overall[9] -= 3; T.render(); const gd = T.gradeDiff(s, T.fitCategories(s)); return gd.off.map(o => o.would);`), K);
  check(twoGap.every(w => !w || !/ and |;/.test(w)), 'a bigger gap gets at most one "would match if", never a list');
  // weights AND one category differ (the reviewer's case the first build missed)
  const joint = await p.evaluate(new Function('K', reset + `const g = T.gradingFor(s.prep); const a = gb.assignments.find(x => x.name === 'Unit 1 Notebook Check'); const was = g.map[a.name] || T.catOf(s.prep, a.name, a); const wasHow = g.how[a.name];
    const truth = { ...s, _cats: g.cats.map(c => ({ name: c.name, w: c.name === 'Assessments' ? 60 : c.name === 'Classwork' ? 30 : 10 })), _map: { ...Object.fromEntries(gb.assignments.map(x => [x.name, T.catOf(s.prep, x.name, x)])), [a.name]: 'Classwork' } };
    gb.overall = gb.students.map((_, i) => T.computeGrade(truth, i).rounded); T.save(); T.render(); const t0 = performance.now(); const gd = T.gradeDiff(s, T.fitCategories(s)); const ms = performance.now() - t0;
    return { was, wasHow, w: T.gradingFor(s.prep).cats.map(c => c.w).join(), off: gd.off.length, whole: gd.whole.map(x => x.html + '|' + (x.fix ? x.fix.label : '')), ms: Math.round(ms) };`), K);
  const jt = joint.whole.findIndex(w => /weights of Assessments 60% · Classwork 30% · Participation 10% and <b>Unit 1 Notebook Check<\/b> in Classwork\.\|Use these weights and categories$/.test(w));
  check(jt > 0 && /setups? of weights and categories reproduces? every grade/.test(joint.whole[0]) && !/\|./.test(joint.whole[0]), 'weights and one category wrong together: the true setup is found (' + joint.ms + ' ms), and when others fit too Tally says the export can\'t tell them apart: ' + joint.whole.map(w => w.slice(0, 150)).join(' /// '));
  await toGrades(); await p.click('#gdWhy'); await p.waitForTimeout(300); await p.click(`[data-gdfix="${jt}"]`); await p.waitForTimeout(500);
  const fixed = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const g = T.gradingFor(s.prep); return { off: T.gradeOff(s).length, w: g.cats.map(c => c.w).join(), cat: g.map['Unit 1 Notebook Check'] }; }, K);
  check(fixed.off === 0 && fixed.w === '60,30,10' && fixed.cat === 'Classwork', 'one button sets both and every grade matches');
  await p.click('#gdUndo'); await p.waitForTimeout(400);
  const undone = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const g = T.gradingFor(s.prep); return { w: g.cats.map(c => c.w).join(), cat: g.map['Unit 1 Notebook Check'] || T.catOf(s.prep, 'Unit 1 Notebook Check', s.grades.assignments.find(x => x.name === 'Unit 1 Notebook Check')) }; }, K);
  check(undone.w === joint.w && undone.cat === joint.was, 'Undo puts back the weights AND the category (the first build left categories moved): ' + JSON.stringify(undone));
  // the stored category is a wrong guess while the fit itself reproduces Focus: it used to raise nothing at all
  const guess = await p.evaluate(new Function('K', reset + `const g = T.gradingFor(s.prep); const nm = 'Unit 1 Notebook Check'; const right = T.catOf(s.prep, nm, gb.assignments.find(x => x.name === nm)); const wrong = g.cats.map(c => c.name).find(c => c !== right);
    g.map[nm] = wrong; g.how[nm] = 'ok'; T.render(); const f = T.fitCategories(s); const gd = T.gradeDiff(s, f); return { exact: f.exact, off: T.gradeOff(s).length, whole: gd ? gd.whole.map(x => x.html + '|' + (x.fix ? x.fix.label : '')) : [], right, home: T.attentionItems(s).map(x => x.text).join('|') };`), K);
  check(guess.exact && guess.off > 0 && guess.whole.length === 1 && new RegExp('<b>Unit 1 Notebook Check</b> in ' + guess.right).test(guess.whole[0]) && /Use this category$/.test(guess.whole[0]) && /differs from Focus/.test(guess.home), 'a wrong category in use is reported even when the fit is exact, with the category Focus\'s grades prove: ' + (guess.whole[0] || '').slice(0, 160));
  // worst case for time: a big class where nothing explains the difference, so every test runs to the end
  const perf = await p.evaluate(new Function('K', reset + `const base = gb.assignments.filter(a => a.max > 0).slice(); const g = T.gradingFor(s.prep); for (let r = 0; r < 4; r++) base.forEach(a => { const nm = a.name + ' #' + r; gb.assignments.push({ ...a, name: nm, values: a.values.slice(), status: a.status.slice() }); g.map[nm] = T.catOf(s.prep, a.name, a); g.how[nm] = 'user'; });
    gb.overall = gb.students.map((_, i) => T.computeGrade(s, i).rounded + (i % 2 ? 2 : -3)); const f = T.fitCategories(s); const t0 = performance.now(); const gd = T.gradeDiff(s, f); return { ms: Math.round(performance.now() - t0), a: gb.assignments.length, whole: gd.whole.length };`), K);
  check(perf.ms < 4000 && perf.whole === 0, `${perf.a} assignments, nothing explains it: the whole diagnosis takes ${perf.ms} ms and claims nothing`);
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})();
