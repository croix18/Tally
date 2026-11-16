// The audit of 15 Nov 2026, the pages that go home (fixer RPT): one check per finding in the weekly report, its print
// layout, the Reports page and Remove a print, each written to fail on the code before its fix.
const { chromium, fs, path, exe, check, done, pick, tmp, APP } = require('./lib');
const K = '1205050-7T1A';
async function openPage(b, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true, timezoneId: 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  if (opts.now) await p.addInitScript(t => { const R = Date; let off = t - R.now(); window.__setNow = x => { off = x - R.now(); }; class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } } window.Date = D; }, opts.now);
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  return { ctx, p, errs };
}
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const { ctx, p, errs } = await openPage(b);

  // RPT-07 / RPT-08: a student with skills skipped for them alone (12 of Unit 2's 17), all 12 at goal
  const m = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const rows = A.gbRows(s);
    const i = rows.findIndex(r => r && r.ixl != null); const ix = rows[i].ixl; const col = gb.assignments.find(a => /Unit 2 IXL/.test(a.name)); const u = T.unitsOf(s).find(x => x.short === 'Unit 2');
    const skip = {}; u.active.slice(0, 5).forEach(k => skip[A.skillKey(s.skills[k])] = true); s.studentSkips[A.ixlKeyAt(s, ix)] = skip;
    A.activeFor(s, u, ix).forEach(k => { s.scores[k][ix] = 90; }); const own = A.activeFor(s, u, ix).length;
    gb.assignments.forEach(a => { if (a !== col && a.status[i] === 'missing') { a.status[i] = 'score'; a.values[i] = a.max; } });
    col.status[i] = 'missing'; col.values[i] = 0; T.save();
    const owedNhi = A.owedWork(s, A.openSec(s), i, ix).owed.map(a => a.name);
    const d1 = new DOMParser().parseFromString(A.studentReportSection(s, i, rows[i]), 'text/html');
    const doneRow = [...d1.querySelectorAll('tr.done')].map(x => x.textContent).join(' | '); const restBelow = /the rest are below/.test(d1.body.textContent);
    col.status[i] = 'score'; col.values[i] = own; T.save();   // copied: 12/17 in Focus, IXL still owed in another unit
    const d2 = new DOMParser().parseFromString(A.studentReportSection(s, i, rows[i]), 'text/html'); const tot = [...d2.querySelectorAll('.tot')].map(x => x.textContent).find(x => /IXL finished/.test(x)) || '';
    const real = {}; gb.assignments.filter(a => A.ixlColOf(a, i)).forEach(a => { const mm = a.name.match(/unit\s*(\d+)/i); const uu = mm && T.unitsOf(s).find(x => x.short === 'Unit ' + mm[1]); if (uu) real[a.name] = Math.min(a.max, A.totalFor(s, uu, ix)); });
    const g = A.computeGrade(A.openSec(s), i, real);
    return { own, max: col.max, owedNhi, doneRow, restBelow, tot, real: g.rounded + '%' }; }, K);
  check(m.own === 12 && !m.owedNhi.includes('Unit 2 IXL'), 'RPT-07: a student who finished every skill on their own list does not owe the IXL column: ' + JSON.stringify(m.owedNhi));
  check(/12 of 17 pts/.test(m.doneRow) && !m.restBelow, 'RPT-07: the back lists the column as done with the 12 of 17 points that go into Focus, and points at no empty list: ' + m.doneRow);
  check(!m.tot || m.tot.includes(m.real), 'RPT-08: "This quarter\'s IXL finished" claims a grade finishing the student\'s own list reaches (' + m.real + '): ' + m.tot);
  // the counter's case: two skills skipped for the whole course, the Focus column at its old points
  const c = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const rows = A.gbRows(s);
    const i = rows.findIndex((r, k) => r && r.ixl != null && k > 0); const ix = rows[i].ixl; const col = gb.assignments.find(a => /Unit 2 IXL/.test(a.name)); let u = T.unitsOf(s).find(x => x.short === 'Unit 2');
    u.active.slice(0, 2).forEach(k => s.excluded[A.skillKey(s.skills[k])] = true); T.save(); u = T.unitsOf(s).find(x => x.short === 'Unit 2');
    u.active.forEach(k => { s.scores[k][ix] = 90; }); col.status[i] = 'missing'; col.values[i] = 0; T.save();
    const r = { owed: A.owedWork(s, A.openSec(s), i, ix).owed.map(a => a.name), n: u.active.length, max: col.max };
    u.idx.forEach(k => delete s.excluded[A.skillKey(s.skills[k])]); T.save(); return r; }, K);
  check(c.n < c.max && !c.owed.includes('Unit 2 IXL'), 'RPT-07: a course-wide skip with the column at its old points: a student with every course skill at goal does not owe it: ' + JSON.stringify(c));

  // round 2: a 0-point (extra credit) column at NHI is never missing work; a unit whose every skill is skipped for the student is neither owed nor earned
  const r2 = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const rows = A.gbRows(s);
    const ids = rows.map((r, k) => r && r.ixl != null ? k : -1).filter(k => k >= 0); const i = ids[2], ix = rows[i].ixl;
    const col = JSON.parse(JSON.stringify(gb.assignments[0])); col.name = 'Bonus Puzzle'; col.max = 0; col.values = gb.students.map(() => 2); col.status = gb.students.map(() => 'score'); col.values[i] = null; col.status[i] = 'missing'; gb.assignments.push(col); T.save();
    const ow1 = A.owedWork(s, A.openSec(s), i, ix); const t1 = new DOMParser().parseFromString(A.studentReportSection(s, i, rows[i]), 'text/html').body.textContent;
    gb.assignments.pop(); T.save();
    const u = T.unitsOf(s).find(x => x.short === 'Unit 2'); const c2 = gb.assignments.find(a => /Unit 2 IXL/.test(a.name)); const skip = {}; u.active.forEach(k => skip[A.skillKey(s.skills[k])] = true); s.studentSkips[A.ixlKeyAt(s, ix)] = skip;
    c2.status[i] = 'missing'; c2.values[i] = null; T.save();
    const ow2 = A.owedWork(s, A.openSec(s), i, ix); const rt = A.retakeStatus(s, gb.students[i]);
    const r = { ec: [...ow1.owed, ...ow1.earned].map(a => a.name).includes('Bonus Puzzle'), ecTxt: /Bonus Puzzle/.test(t1), own: A.activeFor(s, u, ix).length, owed2: ow2.owed.map(a => a.name), earned2: ow2.earned.map(a => a.name), rtMissing: rt.missing };
    delete s.studentSkips[A.ixlKeyAt(s, ix)]; T.save(); return r; }, K);
  check(!r2.ec && !r2.ecTxt, 'round 2: an extra credit (0-point) column left NHI is not missing work on the weekly report: ' + JSON.stringify(r2));
  check(r2.own === 0 && !r2.owed2.includes('Unit 2 IXL') && !r2.earned2.includes('Unit 2 IXL') && !r2.rtMissing.includes('Unit 2 IXL'), 'round 2 (RPT-07): with every Unit 2 skill skipped for the student, the column is neither owed nor earned, as for the retake rule: ' + JSON.stringify(r2));
  // RPT-02: a student Tally can't see in IXL, nothing missing: IXL columns at a third, then all full, then nothing graded
  const f = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const rows = A.gbRows(s); const i = rows.findIndex(r => !r || r.ixl == null);
    const say = () => { T.save(); const d = new DOMParser().parseFromString(A.studentReportSection(s, i, rows[i]), 'text/html'); return d.querySelector('.panel.main .pbody').textContent.trim(); };
    gb.assignments.forEach(a => { a.status[i] = 'score'; a.values[i] = /\bixl\b/i.test(a.name) ? Math.floor(a.max / 3) : a.max; }); const third = say();
    gb.assignments.forEach(a => { a.values[i] = A.catOf(s.prep, a.name) === 'Assessments' ? a.max : Math.round(a.max / 2); }); const full = say();
    gb.assignments.forEach(a => { if (A.catOf(s.prep, a.name) === 'Assessments') { a.status[i] = 'excused'; a.values[i] = null; } }); const none = say();
    return { third, full, none }; }, K);
  const FM = /every assessment at full marks/;
  check(!FM.test(f.third) && !FM.test(f.none) && FM.test(f.full), 'RPT-02: "every assessment at full marks" only when every item of the Assessments list is full, IXL included, and never with none graded: ' + JSON.stringify(f));
  check(!errs.length, 'no page errors: ' + errs.join(' | '));
  await ctx.close();

  // RPT-01: Monday the class is printed, one report comes back signed Tuesday, two are reprinted Wednesday
  const w = await openPage(b, { now: Date.parse('2026-11-16T08:00:00-05:00') });
  const r1 = await w.p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const rows = A.gbRows(s); s.reportLog = {}; const nm = s.grades.students;
    window.__setNow(Date.parse('2026-11-16T08:00:00-05:00')); nm.forEach((_, i) => A.logReport(s, i, rows[i]));
    window.__setNow(Date.parse('2026-11-17T08:00:00-05:00')); A.markReportBack(s, nm[0], '2026-11-16', true);
    window.__setNow(Date.parse('2026-11-18T08:00:00-05:00')); [0, 1].forEach(i => A.logReport(s, i, rows[i])); T.save();
    const list = A.printsOf(s).map(x => `${x.date}:${x.n}:${x.back}`); const snap = JSON.stringify(s.reportLog); const canon = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(x => [x, v[x]])) : v);
    const kept = canon(A.cleanReportLog(JSON.parse(snap))) === canon(JSON.parse(snap));   // a save and the undo keep every print day
    const n = A.removePrint(s, '2026-11-18'); const after = A.printsOf(s).map(x => `${x.date}:${x.n}:${x.back}`);
    const stu0 = A.reportsOf(s, nm[0]).map(e => e.date + (e.back ? ' back' : '') + (e.printed ? ' ' + e.printed.join(',') : ''));
    s.reportLog = A.cleanReportLog(JSON.parse(snap)); const undone = canon(s.reportLog) === canon(JSON.parse(snap));
    A.removePrint(s, '2026-11-18'); const n2 = A.removePrint(s, '2026-11-16'); const empty = !Object.keys(s.reportLog).length;
    s.reportLog = { 'old student': [{ date: '2026-11-09', q: 2, gb: '', ix: '', grade: 80, missing: 0, ixl: null, back: '2026-11-10' }] }; const old = A.printsOf(s).map(x => `${x.date}:${x.n}:${x.back}`).join(' ');
    return { n: nm.length, list, kept, removed: n, after, stu0, undone, n2, empty, old }; }, K);
  check(r1.list.join(' ') === `2026-11-18:2:0 2026-11-16:${r1.n}:1`, 'RPT-01: a mid-week reprint is its own print; Monday still counts every report and the back-signed tick: ' + r1.list.join(' '));
  check(r1.kept && r1.undone, 'RPT-01: the report log keeps each entry\'s print days through a save, and Undo of a removal restores it exactly');
  check(r1.removed === 2 && r1.after.join(' ') === `2026-11-16:${r1.n}:1` && JSON.stringify(r1.stu0) === '["2026-11-16 back"]', 'RPT-01: removing the Wednesday reprint leaves Monday\'s print of every student and its tick: ' + r1.after.join(' ') + ' ' + JSON.stringify(r1.stu0));
  check(r1.n2 === r1.n && r1.empty, 'RPT-01: removing Monday too takes every report off');
  check(r1.old === '2026-11-09:1:1', 'RPT-01: an entry saved before print days were kept reads as one print on its date: ' + r1.old);
  check(!w.errs.length, 'no page errors (RPT-01): ' + w.errs.join(' | '));
  await w.ctx.close();

  // RPT-06: a long IXL list runs over several pages; "Start here" prints once, at its top
  const L = await openPage(b);
  const [pw] = await Promise.all([L.ctx.waitForEvent('page'), L.p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const rows = A.gbRows(s);
    const k3 = s.skills.findIndex(sk => /^Unit 3\b/.test(sk.unit)); for (let n = 0; n < 150; n++) { s.skills.push({ ...s.skills[k3], id: '', name: 'Extra practice skill number ' + (n + 1) + ' with a longer name' }); s.scores.push(s.students.map((_, j) => j % 3 ? 60 : null)); }
    T.save(); const i = rows.findIndex((r, k) => r && r.ixl != null && k % 3); T.printStudentReports(s, [i], 'One'); }, K)]);
  await pw.waitForLoadState(); await pw.waitForFunction(() => document.body.getAttribute('data-paged') === '1', null, { timeout: 60000 });
  const lay = await pw.evaluate(() => ({ start: document.querySelectorAll('.start').length, cont: document.querySelectorAll('.panel.ixl.cont').length, pages: document.querySelectorAll('.page').length }));
  check(lay.cont > 0 && lay.start === 1, 'RPT-06: a long IXL list continued over pages prints "Start here" once: ' + JSON.stringify(lay));
  await pw.close();
  // RPT-04: the Reports page's labels say what the prints hold, and a print of "No grade yet" names it
  const lb = await L.p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; s.grades.assignments.forEach(a => { a.status[0] = 'excused'; a.values[0] = null; }); T.save(); A.openPrintMenu(s, false);
    return { wk: document.querySelector('#rpWeekly small').textContent, dg: document.querySelector('#rpDigest small').textContent }; }, K);
  await L.p.click('[data-who="letters"]'); for (const x of ['C', 'D', 'F']) await L.p.click(`[data-letter="${x}"]`); await L.p.click('[data-letter="—"]');
  const [tw] = await Promise.all([L.ctx.waitForEvent('page'), L.p.click('#rpWeekly')]); await tw.waitForLoadState(); const title = await tw.title(); await tw.close();
  check(!/what moved/.test(lb.wk) && !/since the last report/.test(lb.dg) && /since the previous import/.test(lb.dg), 'RPT-04: the Weekly and digest buttons promise only what they print: ' + JSON.stringify(lb));
  check(/\(no grade yet\)$/.test(title), 'RPT-04: a print of the students with no grade yet says so in its title: ' + title);
  check(!L.errs.length, 'no page errors (RPT-06): ' + L.errs.join(' | '));
  await L.ctx.close();

  // RPT-09: the retake notice's HOWL days are school days (a break week is skipped)
  const hw = await openPage(b, { now: Date.parse('2026-11-16T12:00:00-05:00') });
  const days = await hw.p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const rows = A.gbRows(s);
    const i = rows.findIndex(r => r && r.ixl != null); const ix = rows[i].ixl;
    gb.assignments.forEach(a => { if (a.status[i] === 'missing' || a.status[i] === 'excused') { a.status[i] = 'score'; a.values[i] = a.max; } }); s.skills.forEach((_, k) => { s.scores[k][ix] = 95; });
    const q = gb.assignments.find(a => /Squares and Cubes Quiz/.test(a.name)); q.status[i] = 'score'; q.values[i] = Math.round(q.max * 0.5); T.save();
    return ['2026-11-09', '2026-11-16', '2026-11-19', '2026-11-20', '2026-12-17'].map(d => { window.__setNow(Date.parse(d + 'T12:00:00-05:00'));  const bs = [...new DOMParser().parseFromString(A.studentReportSection(s, i, rows[i]), 'text/html').querySelectorAll('.howl p:first-child > b')].slice(1).map(x => x.textContent); return d + ': ' + bs.join(' / '); }); }, K);
  check(JSON.stringify(days) === JSON.stringify(['2026-11-09: Wednesday, Nov 18 / Thursday, Nov 19', '2026-11-16: Wednesday, Nov 18 / Thursday, Nov 19', '2026-11-19: Wednesday, Dec 2 / Thursday, Dec 3', '2026-11-20: Wednesday, Dec 2 / Thursday, Dec 3', '2026-12-17: Wednesday, Jan 6 / Thursday, Jan 7']),
    'RPT-09: HOWL retake days skip Veterans Day, Thanksgiving week and winter break: ' + JSON.stringify(days));
  const end = await hw.p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const rows = A.gbRows(s); const i = rows.findIndex(r => r && r.ixl != null);
    return ['2027-05-24', '2027-05-27'].map(d => { window.__setNow(Date.parse(d + 'T12:00:00-04:00')); const h = new DOMParser().parseFromString(A.studentReportSection(s, i, rows[i]), 'text/html').querySelector('.howl p'); return d + ': ' + (h ? h.textContent.replace(/^.*?during HOWL on /, '').split('.')[0] : '(no notice)'); }); }, K);
  check(JSON.stringify(end) === JSON.stringify(['2027-05-24: Wednesday, May 26 or Thursday, May 27', '2027-05-27: a Wednesday or Thursday']), 'round 2 (RPT-09): after the last day of school the retake notice names no summer dates: ' + JSON.stringify(end));
  // a report that fails names the student in its toast as text, not as markup
  const tx = await hw.p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const keep = s.grades.students[0]; s.grades.students[0] = '<b id="xssName">Pat</b> Test';
    const st = T.state.settings; const had = Object.getOwnPropertyDescriptor(st, 'teacherName'); Object.defineProperty(st, 'teacherName', { configurable: true, get() { throw new Error('test: report fails'); } });
    const ce = console.error; console.error = () => {}; try { A.printStudentReports(s, [0, 1], 'Fail'); } catch (e) {} console.error = ce;
    delete st.teacherName; if (had) Object.defineProperty(st, 'teacherName', had); s.grades.students[0] = keep;
    await new Promise(r => setTimeout(r, 400)); const t = document.querySelector('#toast'); return { text: t ? t.textContent : '', tag: !!document.querySelector('#toast #xssName') }; }, K);
  check(/could not be made/.test(tx.text) && /<b id="xssName">Pat<\/b>/.test(tx.text) && !tx.tag, 'a failed report\'s toast shows the student\'s name as text: ' + tx.text);
  check(!hw.errs.length, 'no page errors (RPT-09): ' + hw.errs.join(' | '));
  await hw.ctx.close();
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(1); });
