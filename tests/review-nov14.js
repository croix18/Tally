// 14 Nov 2026, the hostile review's items 3, 5, 6, 7 and 8 (NOTES: "Hostile review, 14 Nov 2026").
//   3. two students with one name are told apart everywhere (each used to show the first one's numbers);
//   5. typing in one tab is not wiped when another Tally tab saves, and neither tab's change is lost;
//   6. the category fit is remembered between renders;
//   7. "IXL at goal" is one figure on Grades and Students;
//   8. a saved gradebook that can't be read is not dropped in silence.
const { chromium, fs, path, exe, check, done, APP, pick } = require('./lib');
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const K = '1205050-7T1A';

  // ---- 3. one name, two students ----
  const u = await p.evaluate(() => { const T = window.__tally; const rows = (ids) => [['Student ID', 'Student', 'Grade', 'Quiz\n10 Points'], [ids ? '500421' : '', 'Doe, Jane', '90%', '9'], [ids ? '500067' : '', 'Doe, Jane', '50%', '5'], [ids ? '500999' : '', 'Roe, Rick', '70%', '7']];
    return { withIds: T.parseGradebook(rows(true)).students, none: T.parseGradebook(rows(false).map(r => r.slice(1))).students, again: T.uniqueNames(['Doe, Jane (ID …0421)', 'Doe, Jane (ID …0067)'], ['500421', '500067']) }; });
  check(u.withIds.join('|') === 'Doe, Jane (ID …0421)|Doe, Jane (ID …0067)|Roe, Rick', 'two students with one name each carry the end of their Focus ID: ' + u.withIds.join(' | '));
  check(u.none.join('|') === 'Doe, Jane (1)|Doe, Jane (2)|Roe, Rick' && u.again.join('|') === 'Doe, Jane (ID …0421)|Doe, Jane (ID …0067)', 'without IDs they are numbered in order; a name already marked is left alone');
  // a gradebook saved before today with the same name twice: told apart on load, and each student's own numbers show
  await p.evaluate(K => { const T = window.__tally; const gb = T.state.sections[K].grades; let j = 1; const g0 = T.computeGrade(T.state.sections[K], 0).rounded; while (T.computeGrade(T.state.sections[K], j).rounded === g0) j++; window.__j = j; gb.ids = gb.students.map((_, i) => String(700000 + i * 37)); gb.students[j] = gb.students[0]; T.save(); return j; }, K);
  const J = await p.evaluate(() => window.__j); await p.reload(); await p.waitForTimeout(800);
  const d = await p.evaluate(([K, J]) => { const T = window.__tally; const s = T.state.sections[K]; const gb = s.grades; const a = gb.students[0], c = gb.students[J];
    return { a, c, ga: T.studentSummary(s, a).grade.rounded, gc: T.studentSummary(s, c).grade.rounded, ra: T.computeGrade(s, 0).rounded, rc: T.computeGrade(s, J).rounded, ma: T.studentSummary(s, a).missing, mc: T.studentSummary(s, c).missing, wantM: gb.assignments.filter(x => x.status[J] === 'missing').length, gi: T.findStudent(s, c).gi }; }, [K, J]);
  check(d.a !== d.c && / \(ID …\d{4}\)$/.test(d.a) && / \(ID …\d{4}\)$/.test(d.c), 'a saved gradebook with one name twice is told apart on load: ' + d.a + ' / ' + d.c);
  check(d.gi === J && d.ga === d.ra && d.gc === d.rc && d.ra !== d.rc && d.mc === d.wantM, `each shows their own grade and missing work (${d.ga}% and ${d.gc}%; the second used to show the first one's ${d.ra}%)`);
  await p.evaluate(([K, c]) => window.__tally.openProfile(K, c), [K, d.c]); await p.waitForTimeout(400);
  check(new RegExp('\\b' + d.rc + '%').test(await p.evaluate(() => document.querySelector('#gridwrap').innerText)), 'the second student\'s page shows the second student\'s grade');

  // ---- 6. the fit is remembered ----
  const f = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const a = T.fitCategories(s); const t0 = performance.now(); let same = true; for (let i = 0; i < 50; i++) same = same && T.fitCategories(s) === a; const ms = performance.now() - t0;
    const keep = s.grades.overall[3]; s.grades.overall[3] = keep - 9; const c = T.fitCategories(s); s.grades.overall[3] = keep; const back = T.fitCategories(s);
    return { same, ms: Math.round(ms), changed: c !== a && c.err > 0, back: back === a && back.exact }; }, K);
  check(f.same && f.ms < 100, `fifty renders' worth of fits return the remembered answer (${f.ms} ms in all)`);
  check(f.changed && f.back, 'a changed gradebook is fitted afresh, and the earlier answer is still good for the earlier data');

  // ---- 7. one "IXL at goal" ----
  const x = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; const rows = T.gbRows(s); const v = T.ixlVsTests(s); return v.every((r, i) => rows[i].ixl == null ? r.ixl == null : r.ixl === T.ixlFor(s, rows[i].ixl).pct) && v.some(r => r.ixl != null); }, K);
  check(x, 'the Grades table\'s "IXL at goal" is the Students screen\'s own figure, student for student');

  // ---- 5. two tabs ----
  const q = await ctx.newPage(); q.on('dialog', dl => dl.accept()); q.on('pageerror', e => errs.push('tab2: ' + e.message)); await q.goto('file://' + path.resolve(APP)); await q.waitForTimeout(800);
  const nm = await q.evaluate(K => window.__tally.state.sections[K].grades.students[3], K);
  await q.evaluate(([K, nm]) => { const T = window.__tally; T.openConference(T.state.sections[K], nm); }, [K, nm]); await q.waitForTimeout(500);
  await q.click('#cfConcerns'); await q.keyboard.press('Control+End'); await q.keyboard.type(' Call after 5; discussed the retake plan.');
  const before = await p.evaluate(() => window.__tally.state.settings.details);
  await p.evaluate(() => { const T = window.__tally; T.state.settings.details = !T.state.settings.details; T.save(); }); await q.waitForTimeout(600);
  const mid = await q.evaluate(() => ({ open: !document.querySelector('#modal').classList.contains('hidden'), text: document.querySelector('#cfConcerns').value, toast: (document.querySelector('#toast') || {}).innerText || '' }));
  check(mid.open && /discussed the retake plan\.$/.test(mid.text) && /Another Tally tab just saved\. Finish what you are typing/.test(mid.toast), 'a save in another tab no longer closes the form being typed in: the text is still there and the tab says why it is waiting');
  await q.click('#mCancel'); await q.waitForTimeout(700);
  const after = await q.evaluate(([K, nm]) => { const T = window.__tally; const s = T.state.sections[K]; const fm = Object.values(s.confForms || {})[0] || {}; return { note: fm.concerns || '', details: T.state.settings.details }; }, [K, nm]);
  check(/discussed the retake plan\.$/.test(after.note) && after.details === !before, 'closing the form keeps what was typed AND takes in the other tab\'s change (neither is lost)');
  await p.waitForTimeout(500);
  const first = await p.evaluate(K => { const T = window.__tally; const fm = Object.values(T.state.sections[K].confForms || {})[0] || {}; return { note: fm.concerns || '', details: T.state.settings.details }; }, K);
  check(/discussed the retake plan\.$/.test(first.note) && first.details === !before, 'and the first tab ends up with both as well');
  const m3 = await p.evaluate(() => { const m = window.__tally.merge3; return JSON.stringify([m({ a: 1, b: { x: 1, y: 1 } }, { a: 2, b: { x: 1, y: 1 } }, { a: 1, b: { x: 1, y: 5 }, c: 9 }), m({ a: 1 }, { a: 2 }, { a: 3 }), m({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 2 }), m({ l: [1, 2] }, { l: [1, 2, 3] }, { l: [1, 2] })]); });
  check(m3 === '[{"a":2,"b":{"x":1,"y":5},"c":9},{"a":2},{"a":1},{"l":[1,2,3]}]', 'the merge: each side\'s own changes are kept, a clash keeps what was done here, a removal stays removed: ' + m3);
  // nothing being typed: the other tab's save is taken at once, as before
  await q.evaluate(() => { const T = window.__tally; T.state.settings.details = !T.state.settings.details; T.save(); }); await p.waitForTimeout(500);
  check((await p.evaluate(() => window.__tally.state.settings.details)) === before, 'with nothing being typed a save in the other tab is taken in at once, as before');
  await q.close();

  // ---- 8. an unreadable gradebook is not dropped in silence ----
  const raw = await p.evaluate(K => { const s = JSON.parse(localStorage.getItem('tally.v1')); s.sections[K].grades.assignments[0].values = 'x'; const t = JSON.stringify(s); localStorage.setItem('tally.v1', t); return t.length; }, K);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.reload()]); await p.waitForTimeout(900);
  const lost = await p.evaluate(K => ({ gb: !!window.__tally.state.sections[K].grades, toast: (document.querySelector('#toast') || {}).innerText || '', kept: (localStorage.getItem('tally.v1.broken') || '').length }), K);
  check(!lost.gb && /couldn't read the saved gradebook for .+, so that class has none now: import the Focus export again\./.test(lost.toast), 'a gradebook that can\'t be read: the message names the class and says what to do: ' + lost.toast.slice(0, 150));
  check(dl && /^tally-before-repair-.*\.json$/.test(dl.suggestedFilename()) && lost.kept === raw, 'the data as it was is downloaded and kept before anything can be saved over it');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})();
