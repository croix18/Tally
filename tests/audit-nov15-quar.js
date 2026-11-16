// 15 Nov 2026 audit, fixer QUAR: quarters, dates and Home. Each block is the regression check for one finding
// (its ID in the check's words). Synthetic or scrubbed data only; the page runs in his time zone at a fixed clock.
const { chromium, fs, path, exe, check, done, pick, tmp, APP } = require('./lib');
const K = '1205050-7T1A';
async function openAt(b, when, tz = 'America/New_York') {
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: tz, locale: 'en-US', acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  if (when) await p.clock.setFixedTime(new Date(when));
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400);
  return { ctx, p, errs };
}
const importGb = async (p, file) => { await p.setInputFiles('#file', [path.resolve(file)]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(500); if (await p.$('#askApply')) { await p.click('#askApply'); await p.waitForTimeout(500); } };
// the scrubbed accelerated class: its IXL export, roster and Quarter 1 gradebook
async function accClass(p, q2) {
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await importGb(p, 'fixtures/focus_gradebook_scrubbed.csv');
  if (q2) await importGb(p, 'fixtures/focus_gradebook_scrubbed_q2.csv');
}
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const allErrs = [];
  const T0 = async (when, fn) => { const o = await openAt(b, when); try { await fn(o.p, o.ctx); } finally { allErrs.push(...o.errs); await o.ctx.close(); } };

  // TIM-04: in Quarter 3, a unit whose test is still ahead is not a past quarter's unit (neither course runs in number order)
  await T0('2026-12-21T15:00:00Z', async p => {
    await accClass(p, true);
    await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
      const u3 = s.grades.assignments.find(a => /^Unit 3 IXL/.test(a.name)); const u11 = JSON.parse(JSON.stringify(u3)); u11.name = 'Unit 11 IXL'; u11.assignedOn = '12/01'; u11.due = '12/11'; s.grades.assignments.push(u11);
      const name = n => T.unitsOf(s).find(u => u.short === 'Unit ' + n).name; T.state.assigned.acc[name(7)] = true; T.state.assigned.acc[name(11)] = true;
      A.closeQuarter(1, { acc: [...A.unitsDueIn('acc', 1)], on: [] }); A.closeQuarter(2, { acc: [...A.unitsDueIn('acc', 2)], on: [] }); T.save(); }, K);
    await p.clock.setFixedTime(new Date('2027-01-12T15:00:00Z'));
    const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
      const q3 = s.grades.assignments.filter(a => !A.gbUnitFor(s, a)).slice(0, 4).map((a, i) => ({ ...JSON.parse(JSON.stringify(a)), name: 'Q3 Worksheet ' + (i + 1), assignedOn: '01/05', due: '01/0' + (6 + i) }));
      s.grades = { ...s.grades, assignments: q3, overall: null, importedAt: new Date().toISOString(), exportedAt: new Date().toISOString() }; T.save(); T.render();
      const u = n => T.unitsOf(s).find(x => x.short === 'Unit ' + n);
      return { live: A.liveQuarter(s), c: [2, 3, 6, 7, 8, 10, 11].map(n => n + ':' + A.unitClosed(s, u(n))).join(' '), open: A.openUnits(s).map(x => x.short) }; }, K);
    check(r.live === 3 && /7:false/.test(r.c) && /8:false/.test(r.c) && /10:false/.test(r.c) && r.open.includes('Unit 7'), 'TIM-04: in Quarter 3 Units 7, 8 and 10 (tests in Quarter 3) are not past, and Unit 7 is open: ' + r.c + ' | open ' + r.open.join(', '));
    check(/2:true/.test(r.c) && /3:true/.test(r.c) && /6:true/.test(r.c) && /11:true/.test(r.c), 'TIM-04: units tested in Quarters 1 and 2 (2, 3, 6, 11) stay past: ' + r.c);
  });

  // TIM-02: the Quarters dialog keeps a date when the box is left, refuses one out of order, and a bad stored set falls back
  await T0('2026-11-15T17:00:00Z', async p => {
    await p.evaluate(() => window.__all.openQuarters());
    if (await p.locator('#qDates summary').count()) await p.click('#qDates summary');
    await p.click('input[data-qend="1"]'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
    const seen = []; for (const k of '12172026') { await p.keyboard.type(k); await p.waitForTimeout(100); seen.push(await p.evaluate(() => window.__all.quarters().ends[1])); }
    const typing = await p.evaluate(() => document.activeElement && document.activeElement.dataset.qend);
    await p.click('#modal header h2'); await p.waitForTimeout(200);
    const r = await p.evaluate(() => ({ ends: window.__all.quarters().ends.slice(), box: (document.querySelector('input[data-qend="1"]') || {}).value }));
    check(seen.every(d => d === '2026-12-18') && typing === '1' && r.ends[1] === '2026-12-17' && r.box === '2026-12-17', 'TIM-02: typing 12/17/2026 into Quarter 2\'s end keeps nothing (and the box keeps the cursor) until the box is left, then 2026-12-17: ' + seen.join(' ') + ' -> ' + r.ends[1] + ', typing in ' + typing);
    const bad = await p.evaluate(async () => { const i = document.querySelector('input[data-qend="1"]'); i.focus(); i.value = '2026-09-01'; i.dispatchEvent(new Event('change')); i.blur(); await new Promise(r => setTimeout(r, 50));
      const w = document.querySelector('#qDateWarn'); return { ends: window.__all.quarters().ends.slice(), box: document.querySelector('input[data-qend="1"]').value, warn: w && !w.classList.contains('hidden') ? w.textContent : '' }; });
    check(bad.ends[1] === '2026-12-17' && bad.box === '2026-12-17' && /has to end after Quarter 1/.test(bad.warn), 'TIM-02: 1 Sep 2026 for Quarter 2\'s end is refused, the box is put back and the dialog says why: ' + bad.warn);
    const yr = await p.evaluate(async () => { const i = document.querySelector('input[data-qend="2"]'); i.focus(); i.value = '0027-03-04'; i.dispatchEvent(new Event('change')); i.blur(); await new Promise(r => setTimeout(r, 50)); return window.__all.quarters().ends[2]; });
    check(yr === '2027-03-04', 'TIM-02: a two-digit year (0027-03-04) is refused: ' + yr);
    const fb = await p.evaluate(() => { const A = window.__all; A.quarters().ends = ['2026-10-09', '2026-09-01', '2027-03-04', '2027-05-28']; return A.quarters().ends.join(','); });
    check(fb === '2026-10-09,2026-12-18,2027-03-04,2027-05-28', 'TIM-02: stored quarter ends out of order fall back to the school year\'s dates: ' + fb);
  });

  // TIM-09: typing a two-day test's new last day keeps it
  await T0('2026-11-15T17:00:00Z', async p => {
    await p.evaluate(() => { window.__tally.state.testDates = window.__all.cleanTestDates(null); window.__all.openTestDates('on'); });
    const i = await p.evaluate(() => window.__tally.state.testDates.on.findIndex(x => x.unit === 'Unit 10'));
    const sel = `input[data-f="to"][data-i="${i}"]`;
    await p.click(sel); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowRight');
    await p.keyboard.type('21'); await p.waitForTimeout(150); await p.keyboard.press('Tab'); await p.waitForTimeout(150);
    const mid = await p.evaluate(() => window.__tally.state.testDates.on.find(y => y.unit === 'Unit 10').to);
    // a last day before the day, typed whole and left, is still cleared
    const sel2 = `input[data-f="to"][data-i="${i}"]`;
    await p.evaluate(s => { const e = document.querySelector(s); e.focus(); e.value = '2026-11-02'; e.dispatchEvent(new Event('change')); e.blur(); }, sel2);
    const after = await p.evaluate(s => ({ row: window.__tally.state.testDates.on.find(y => y.unit === 'Unit 10'), box: document.querySelector(s).value }), sel2);
    check(mid === '2026-11-21', 'TIM-09: typing 21 over a two-day test\'s last day (Nov 20) keeps Nov 21: ' + mid);
    check(after.row.to === '' && after.box === '', 'TIM-09: a last day before the first day, once the box is left, is still cleared in the row and the box: ' + JSON.stringify(after));
  });

  // TIM-01 (this file's sites): Fri 18 Dec 2026, 8:30 pm in New York, Quarter 2 closed tonight: every day named is Dec 18
  await T0('2026-12-19T01:30:00Z', async p => {
    await accClass(p);
    await p.evaluate(() => { const T = window.__tally, A = window.__all; A.quarters().closed = { 1: { at: '2026-10-12T15:00:00.000Z' } }; A.closeQuarter(2, { acc: [], on: [] }); T.save(); T.render(); });
    await p.click('#btnHome'); await p.waitForTimeout(400);
    const r = await p.evaluate(K => { const A = window.__all, T = window.__tally; const notice = (document.querySelector('.qce') || {}).textContent || '';
      A.openQuarters(); const m = document.querySelector('#modal'); const dlg = (m.querySelector('.qclosed') || {}).textContent || ''; const dates = [...m.querySelectorAll('.qdates label')].map(l => l.textContent.replace(/\s+/g, ' ')).join(' | '); document.querySelector('#mClose').click();
      const s = T.state.sections[K]; s.rosterAt = '2026-11-01T01:30:00.000Z'; s.date = '2026-11-01';   // pasted Sat 31 Oct, 9:30 pm; IXL exported 1 Nov
      T.render(); const ros = A.attentionItems(s).map(a => a.text).filter(t => /roster pasted/.test(t)); return { notice, dlg, dates, ros, early: A.closedEarly() }; }, K);
    check(/closed early on Dec 18\b/.test(r.notice), 'TIM-01: the Overview says Quarter 2 was closed early on Dec 18, the local day: ' + r.notice.slice(0, 80));
    check(/Quarter 2 closed Dec 18\b/.test(r.dlg) && /early, it ends Dec 18/.test(r.dlg) && r.early === 2, 'TIM-01: the Quarters dialog says "Quarter 2 closed Dec 18" and tags it early, as closedEarly() does: ' + r.dlg);
    check(/Quarter 2 ends.*closed Dec 18/.test(r.dates), 'TIM-01: the quarter dates say Quarter 2 closed Dec 18: ' + r.dates);
    check(r.ros.length === 1 && /roster pasted Oct 31/.test(r.ros[0]), 'TIM-01: a roster pasted at 9:30 pm on Oct 31 is "pasted Oct 31", older than the Nov 1 export: ' + JSON.stringify(r.ros));
  });

  // TIM-03 and RPT-03: a gradebook is dated by the day Focus wrote the file, not the day it was imported
  await T0('2026-10-12T12:30:00Z', async p => {
    const gbFile = path.join(tmp, 'focus_gradebook_thursday.csv'); fs.copyFileSync('fixtures/focus_gradebook_scrubbed.csv', gbFile); const thu = new Date('2026-10-08T19:00:00Z'); fs.utimesSync(gbFile, thu, thu);
    const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
    await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
    await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
    await importGb(p, gbFile);
    const r = await p.evaluate(() => { window.__all.openQuarters(); const m = document.querySelector('#modal'); const o = { row: (m.querySelector('.qkeep') || {}).textContent || '', warn: /exported before Quarter 1 ended/.test(m.textContent) }; document.querySelector('#mClose').click(); return o; });
    check(/exported Oct 8/.test(r.row) && r.warn, 'TIM-03: Close Quarter 1 names the day Focus wrote the gradebook (Oct 8) and warns it was exported before Quarter 1 ended: ' + r.row);
    await p.clock.setFixedTime(new Date('2026-10-19T16:00:00Z'));
    const h = await p.evaluate(K => { const T = window.__tally, A = window.__all; T.state.settings.remindDays = 7; T.render(); return A.attentionItems(T.state.sections[K]).filter(a => /Focus gradebook is/.test(a.text)).map(a => a.text + ' / ' + a.detail); }, K);
    check(h.length === 1 && /11 days old/.test(h[0]) && /^Focus gradebook is 11 days old \/ Oct 8\./.test(h[0]), 'RPT-03: on Oct 19 the Overview says the Focus gradebook (written Oct 8, imported Oct 12) is 11 days old: ' + JSON.stringify(h));
  });

  // TIM-08 and TIM-10: Quarter 1 over, a Quarter 2 export in; the Overview names Quarter 2; reopening Quarter 1 says nothing comes back
  await T0('2026-10-20T16:00:00Z', async p => {
    await accClass(p, true);
    await p.click('#btnHome'); await p.waitForTimeout(400);
    const meta = await p.evaluate(() => ({ m: (document.querySelector('#bar .meta') || {}).textContent || '', cq: window.__all.currentQuarter(), lq: window.__all.liveQ() }));
    check(/Quarter 2/.test(meta.m) && !/Quarter 1/.test(meta.m) && meta.cq === 1 && meta.lq === 2, 'TIM-08: before Quarter 1 is closed, the Overview over Quarter 2 grades says "Quarter 2": ' + meta.m);
    await p.evaluate(() => { const A = window.__all; A.closeQuarter(1, { acc: [...A.unitsDueIn('acc', 1)], on: [] }); window.__tally.save(); A.openQuarters(); });
    const hint = await p.evaluate(() => [...document.querySelectorAll('#modal .ghint')].map(e => e.textContent).find(t => /Reopening/.test(t)) || '');
    await p.click('#qReopen'); await p.waitForTimeout(300);
    const t = await p.evaluate(() => (document.querySelector('#toast') || {}).textContent || '');
    check(/already past Quarter 1/.test(hint) && !/brings back/.test(hint), 'TIM-10: the Closed list says reopening Quarter 1 keeps its record, as the gradebooks are past it: ' + hint);
    check(/Quarter 1 is open again/.test(t) && !/are back/.test(t) && /don't come back/.test(t), 'TIM-10: the reopen message does not say missing work came back: ' + t);
  });
  // TIM-10, the other way: closed early by mistake, the work is still in the open gradebook, so it does come back
  await T0('2026-10-05T16:00:00Z', async p => {
    await accClass(p);
    await p.evaluate(() => { const A = window.__all; A.closeQuarter(1, { acc: [], on: [] }); window.__tally.save(); A.openQuarters(); });
    await p.click('#qReopen'); await p.waitForTimeout(300);
    const t = await p.evaluate(() => (document.querySelector('#toast') || {}).textContent || '');
    check(/missing work and Focus checks are back/.test(t), 'TIM-10: reopening a quarter closed early, its work still in the open gradebook, says its missing work is back: ' + t);
  });

  // CON-08 and CON-09: the Overview's IXL card. A class with no IXL export says so; one with IXL names the units it counts
  await T0('2026-11-15T17:00:00Z', async p => {
    await accClass(p, true);
    await p.click('#btnHome'); await p.waitForTimeout(400);
    const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const lb = A.leaderboardData().find(x => x.key === K);
      const tile = k => { const c = document.querySelector(`.hcard[data-go="${CSS.escape(k)}"]`); const d = c && [...c.querySelectorAll('.hnums>div')].find(x => /IXL work at goal/i.test(x.innerText)); return d ? d.innerText.replace(/\s+/g, ' ') : ''; };
      const one = tile(K);
      // a class made from its gradebook alone, before its IXL export
      T.state.sections['quar-noixl'] = { ...JSON.parse(JSON.stringify(s)), key: 'quar-noixl', label: '9th Period', students: [], skills: [], scores: [], best: [], history: [], roster: '' }; T.state.order.push('quar-noixl'); T.render(); document.querySelector('#btnHome').click();
      return { one, pct: Math.round(lb.completion * 100), units: lb.assignedUnits, span: A.unitSpan(lb.assignedUnits), none: tile('quar-noixl') }; }, K);
    check(r.one.includes(r.pct + '%') && r.span && r.one.toLowerCase().includes('ixl work at goal · ' + r.span.toLowerCase()), 'CON-09: the Overview\'s IXL card keeps its number and names the units it counts beside its label (' + r.span + '): ' + r.one);
    check(/no IXL export yet/.test(r.none) && !/first import/.test(r.none), 'CON-08: a class with no IXL export reads "no IXL export yet", not "first import": ' + r.none);
  });

  // IXL-12: What changed measures the counted class; a skipped duplicate account is out of it, but still "New in IXL"
  await T0('2026-11-15T17:00:00Z', async p => {
    const dir = fs.mkdtempSync(path.join(tmp, 'ixl-'));
    const grid = (date, students, skills) => { const q = v => '"' + String(v).replace(/"/g, '""') + '"'; const lines = [['Unit', '', 'Skill name', 'Permanent Skill ID', ...students].map(q).join(',')];
      skills.forEach(s => lines.push([q(s.unit), q('Lesson 1.1 L'), q(s.name), s.id, ...s.scores.map(v => v == null ? '' : v)].join(',')));
      const f = path.join(dir, date, `IXL-Score-Grid_${date}_This-School-Year_1205050-7T5A-M_J-ACC_Math-Nation-FL-B.E.S.T.-Accelerated-7th-Grade_Math.csv`); fs.mkdirSync(path.dirname(f)); fs.writeFileSync(f, lines.join('\n')); return f; };
    const sk = (id, sc) => ({ unit: 'Unit 1 Synthetic Unit', name: 'Synthetic skill ' + id, id, scores: sc });
    const st = ['ALEX ABBOTT', 'BLAKE BRISCOE', 'DUPE ACCOUNT', 'NEWBIE NOTONROSTER'];   // the third is a duplicate account he skips; the fourth is new this week
    await p.setInputFiles('#file', [grid('2026-11-02', st.slice(0, 3), [sk('AA1', [90, 10, null]), sk('AA2', [null, null, null]), sk('AA3', [null, null, null])])]); await p.waitForTimeout(700);
    await p.evaluate(() => { const T = window.__tally; const s = T.state.sections[T.state.order[0]]; s.roster = 'Abbott, Alex\nBriscoe, Blake'; s.ignored = { 'DUPE ACCOUNT#0': true }; T.state.settings.currentUnit = { acc: 1, on: null }; T.save(); T.render(); });
    await p.setInputFiles('#file', [grid('2026-11-09', st, [sk('AA1', [90, 10, 90, 90]), sk('AA2', [null, 90, 90, null]), sk('AA3', [null, null, 90, null])])]); await p.waitForTimeout(700);
    const o = await p.evaluate(() => { const T = window.__tally, A = window.__all; const s = T.state.sections[T.state.order[0]]; const d = A.digestFor(s); const lb = A.leaderboardData().find(r => r.key === s.key);
      return { pop: T.population(s).length, measured: d.ixl.measured, up: d.ixl.up, total: d.ixl.total, movers: d.ixl.movers.map(m => m.name).join(', '), newNames: d.ixl.newNames.join(', '), race: lb && lb.movers }; });
    check(o.pop === 2 && o.measured === 2 && o.up === 1 && o.total === 1 && !/DUPE/.test(o.movers) && o.race === o.up, 'IXL-12: What changed counts the 2 counted students (1 moved up, +1 skill, as the Race), not the skipped account that gained 3: ' + JSON.stringify(o));
    check(/NEWBIE/.test(o.newNames), 'IXL-12: "New in IXL" still lists a new account not on the roster, so he notices it: ' + o.newNames);
  });

  // Same-name fix (mergeArchive): two students of one name keep their own scores when new columns join a kept quarter
  await T0('2026-11-15T17:00:00Z', async p => {
    await accClass(p);
    const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
      const col = (name, vals) => ({ name, max: 10, values: vals, status: vals.map(v => v == null ? 'blank' : 'score'), missing: 0, excused: 0, due: '09/1' + name.length % 9, assignedOn: '09/01', category: '' });
      const A1 = 'SMITH, JO (ID ...1111)', A2 = 'SMITH, JO (ID ...2222)';
      const old = { students: [A1, A2, 'LEE, SAM'], ids: ['1111', '2222', '3333'], overall: null, importedAt: '2026-09-20T15:00:00.000Z', exportedAt: null, file: 'a.csv', assignments: [col('Quiz A', [1, 2, 3])] };
      const sec = { ...s, key: 'quar-twins', qArchive: { 1: { gb: old, map: {}, cats: null, final: [null, null, null], at: '', file: '' } } };
      // the new file lists them in another order, the twins without the ID mark, and Sam's name spelled with a double space
      const fresh = { students: ['SMITH, JO', 'LEE,  SAM', 'SMITH, JO'], ids: ['2222', '', '1111'], overall: null, importedAt: '2026-10-01T15:00:00.000Z', exportedAt: null, file: 'b.csv', assignments: [col('Quiz B', [20, 30, 10])] };
      A.mergeArchive(sec, 1, fresh); const g = sec.qArchive[1].gb; const b = g.assignments.find(a => a.name === 'Quiz B');
      // with no IDs at all, a name two students share is not guessed
      const sec2 = { ...s, key: 'quar-twins2', qArchive: { 1: { gb: { ...JSON.parse(JSON.stringify(old)), ids: [], students: ['Smith, Jo', 'Smith, Jo.', 'LEE, SAM'] }, map: {}, cats: null, final: [], at: '', file: '' } } };
      A.mergeArchive(sec2, 1, { ...fresh, ids: [], students: ['SMITH JO', 'LEE, SAM', 'SMITH JO'] }); const b2 = sec2.qArchive[1].gb.assignments.find(a => a.name === 'Quiz B');
      return { b: b && b.values, b2: b2 && b2.values }; }, K);
    check(JSON.stringify(r.b) === '[10,20,30]', 'same-name fix: mergeArchive lines up two students of one name by Focus ID (Jo ...1111 gets 10, Jo ...2222 gets 20) and Sam by name: ' + JSON.stringify(r.b));
    check(JSON.stringify(r.b2) === '[null,null,30]', 'same-name fix: with no IDs, a loosely matched name two students share is left blank, not given to the first: ' + JSON.stringify(r.b2));
  });

  // Round 2. The Overview's "IXL as of" names both ends when classes' exports differ; a class with an export but no
  // counted student says so; a Focus ID with a space in it still finds the student's row in a kept quarter
  await T0('2026-11-15T17:00:00Z', async p => {
    await accClass(p);
    const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
      const two = { ...JSON.parse(JSON.stringify(s)), key: 'quar-r2', label: '9th Period', date: '2026-11-13' }; T.state.sections['quar-r2'] = two; T.state.order.push('quar-r2');
      const now = s.date; T.render(); document.querySelector('#btnHome').click(); const meta = (document.querySelector('#bar .meta') || {}).textContent || '';
      two.ignored = Object.fromEntries(A.ixlList(two).map(x => [x.key, true])); two.roster = ''; T.render(); document.querySelector('#btnHome').click();
      const c = document.querySelector('.hcard[data-go="quar-r2"]'); const d = c && [...c.querySelectorAll('.hnums>div')].find(x => /IXL work at goal/i.test(x.innerText));
      const col = (name, vals) => ({ name, max: 10, values: vals, status: vals.map(() => 'score'), missing: 0, excused: 0, due: '09/1' + name.length % 9, assignedOn: '09/01', category: '' });
      const sec = { ...s, key: 'quar-ids', qArchive: { 1: { gb: { students: ['SMITH, JO (ID ...1111)', 'SMITH, JO (ID ...2222)'], ids: ['1111', '2222'], overall: null, importedAt: '2026-09-20T15:00:00.000Z', exportedAt: null, file: 'a.csv', assignments: [col('Quiz A', [1, 2])] }, map: {}, cats: null, final: [], at: '', file: '' } } };
      A.mergeArchive(sec, 1, { students: ['SMITH, JO', 'SMITH, JO'], ids: [' 2222', '1111 '], overall: null, importedAt: '2026-10-01T15:00:00.000Z', exportedAt: null, file: 'b.csv', assignments: [col('Quiz B', [20, 10])] });
      return { now, meta, tile: d ? d.innerText.replace(/\s+/g, ' ') : '', b: sec.qArchive[1].gb.assignments.find(a => a.name === 'Quiz B').values, gi: A.gbIndex({ students: ['A', 'B'], ids: ['1 111', '2222'] }, 'X', '1111') }; }, K);
    const fd = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    check(r.now < '2026-11-13' && r.meta.includes('IXL as of ' + fd(r.now) + ' to Nov 13'), 'round 2: the Overview says "IXL as of ' + fd(r.now) + ' to Nov 13" when the classes\' exports differ: ' + r.meta);
    check(/no students counted/.test(r.tile) && !/no IXL export yet/.test(r.tile), 'round 2 (CON-08): a class with an IXL export but no counted student says "no students counted": ' + r.tile);
    check(JSON.stringify(r.b) === '[10,20]' && r.gi === 0, 'round 2: a Focus ID is read the same way (spaces dropped) by mergeArchive and gbIndex: ' + JSON.stringify(r.b) + ', gbIndex ' + r.gi);
  });

  check(allErrs.length === 0, 'no page errors' + (allErrs.length ? ': ' + allErrs.join(' | ') : ''));
  await b.close(); done();
})().catch(e => { console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
