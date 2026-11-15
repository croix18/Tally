// Counter probe for TIM-04, on-level course: units taught out of number order (Q2: 4, 9, 10, 8; Q3: 5, 7, 11; Q4: 6).
// Engine-level: one on-level IXL class with a synthetic gradebook whose IXL columns follow the 2026-27 test dates.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/counter-time/repo';
const { chromium, fs, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.clock.setFixedTime(new Date('2026-11-15T15:00:00Z'));
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400);
  const ixl = fs.readdirSync('fixtures').find(f => /7T3A/.test(f));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(800);
  const col = (name, asg, due) => ({ name, assignedOn: asg, due });
  const run = (when, setup) => p.evaluate(([setup]) => { const T = window.__tally, A = window.__all; const K = '1205050-7T3A'; const s = T.state.sections[K];
    const mk = cols => ({ students: [{ name: 'Zed, Amy', id: '1' }], assignments: cols.map(c => ({ name: c.name, max: 10, category: 'Assessments', assignedOn: c.assignedOn, due: c.due, values: [''], status: [''], codes: [''] })), importedAt: new Date().toISOString(), exportedAt: new Date().toISOString(), overall: null });
    eval(setup); T.save(); T.render(); A.unitQCache.clear && A.unitQCache.clear();
    const us = T.unitsOf(s).filter(u => u.num >= 4 && u.num <= 13);
    return { prep: s.prep, live: A.liveQuarter(s), cur: (T.state.settings.currentUnit || {}).on, closed: us.filter(u => A.unitClosed(s, u)).map(u => u.num), assigned: us.filter(u => u.assigned).map(u => u.num), open: A.openUnits(s).map(u => u.num) }; }, [setup]);
  const out = {};
  out.nowQ2 = await run(0, `T.state.assigned.on = T.state.assigned.on || {}; T.state.settings.currentUnit.on = 9; s.grades = mk([{name:'Unit 3 IXL',assignedOn:'09/20',due:'09/25'},{name:'Unit 4 IXL',assignedOn:'10/14',due:'10/20'},{name:'Unit 9 IXL',assignedOn:'10/28',due:'11/03'},{name:'Worksheet',assignedOn:'11/10',due:'11/12'}]); A.closeQuarter(1, {acc:[], on:[...A.unitsDueIn('on',1)]});`);
  await p.clock.setFixedTime(new Date('2027-01-12T15:00:00Z'));
  // Q3 export arrives BEFORE Q2 is closed (Q2 gradebook kept by keepOutgoing in real flow: simulate with the archive)
  out.q3open = await run(0, `const q2 = mk([{name:'Unit 4 IXL',assignedOn:'10/14',due:'10/20'},{name:'Unit 9 IXL',assignedOn:'10/28',due:'11/03'},{name:'Unit 10 IXL',assignedOn:'11/16',due:'11/20'},{name:'Unit 8 IXL',assignedOn:'12/07',due:'12/11'}]); s.qArchive = s.qArchive || {}; s.qArchive[2] = { gb: q2, map: {}, at: new Date().toISOString() }; s.grades = mk([{name:'Q3 Worksheet',assignedOn:'01/05',due:'01/07'}]); T.state.settings.currentUnit.on = 5; [4,8,9,10].forEach(n => T.state.assigned.on[T.unitsOf(s).find(u => u.num === n).name] = true); T.state.settings.curUnitTouched = Object.assign(T.state.settings.curUnitTouched||{}, {on:true});`);
  out.q3closed = await run(0, `A.closeQuarter(2, {acc:[], on:[...A.unitsDueIn('on',2)]});`);
  console.log('OBSERVED:', JSON.stringify(out));
  console.log('EXPECTED: in Q3 Unit 5 (test 21 Jan) and Unit 7 (9 Feb) are not past; Unit 6 (Q4) not past');
  check(!out.q3open.closed.includes(5) && !out.q3open.closed.includes(7), 'Q3 export before Q2 closed: Units 5 and 7 not past');
  check(!out.q3closed.closed.includes(5) && !out.q3closed.closed.includes(7), 'Q2 closed: Units 5 and 7 not past');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
