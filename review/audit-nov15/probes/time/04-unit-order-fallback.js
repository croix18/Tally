// TIM-04: unitClosed's "no IXL column anywhere" rule assumes the units are taught in number order. Both courses are
// not (2026-27 test dates: accelerated Unit 11 in December before Units 7-10 in Q3; on-level Units 9, 10, 8 in Q2 before
// 5, 7 in Q3). In Quarter 3 the accelerated class's current Unit 7 counts as a past quarter's unit (not owed, not on the
// report, out of the open units) until its Focus IXL column appears, even with Quarter 2 properly closed.
const path = require('path'); const { importGb, openAt, check, done, pick, fs } = require('./_tim.js');
const K = '1205050-7T1A';
(async () => {
  const { b, p, errs } = await openAt('America/New_York', '2026-12-21T15:00:00Z');   // Mon 21 Dec 2026: Quarter 2 has ended
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  await importGb(p, path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv'));
  // the Quarter 2 gradebook also holds the Unit 11 IXL column (Unit 11's test was 11 Dec); close Q1 and Q2 the normal way
  const r1 = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    const u3 = s.grades.assignments.find(a => /^Unit 3 IXL/.test(a.name)); const u11 = JSON.parse(JSON.stringify(u3)); u11.name = 'Unit 11 IXL'; u11.assignedOn = '12/01'; u11.due = '12/11'; s.grades.assignments.push(u11);
    const name = n => T.unitsOf(s).find(u => u.short === 'Unit ' + n).name; T.state.assigned.acc[name(7)] = true; T.state.assigned.acc[name(11)] = true;
    A.closeQuarter(1, { acc: [...A.unitsDueIn('acc', 1)], on: [] }); A.closeQuarter(2, { acc: [...A.unitsDueIn('acc', 2)], on: [] }); T.save();
    return { q2units: Object.keys(A.quarters().units.acc).filter(k => A.quarters().units.acc[k] === 2).map(k => k.split(' ').slice(0, 2).join(' ')) }; }, K);
  // Tue 12 Jan 2027: the first Quarter 3 export (no IXL column yet: Unit 7's comes before its 14 Jan test)
  await p.clock.setFixedTime(new Date('2027-01-12T15:00:00Z'));
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    const q3 = s.grades.assignments.filter(a => !A.gbUnitFor(s, a)).slice(0, 4).map((a, i) => ({ ...JSON.parse(JSON.stringify(a)), name: 'Q3 Worksheet ' + (i + 1), assignedOn: '01/05', due: '01/0' + (6 + i) }));
    s.grades = { ...s.grades, assignments: q3, overall: null, importedAt: new Date().toISOString(), exportedAt: new Date().toISOString() }; T.save(); T.render();
    const u = n => T.unitsOf(s).find(x => x.short === 'Unit ' + n);
    return { live: A.liveQuarter(s), cq: A.currentQuarter(), u7closed: A.unitClosed(s, u(7)), u7q: A.unitQuarterOf(s, u(7)), u11q: A.unitQuarterOf(s, u(11)), open: A.openUnits(s).map(x => x.short), u8closed: A.unitClosed(s, u(8)), u10closed: A.unitClosed(s, u(10)), u12closed: A.unitClosed(s, u(12)) }; }, K);
  console.log('OBSERVED: Q2 closed with', JSON.stringify(r1.q2units), '| Q3:', JSON.stringify(r));
  console.log('EXPECTED: Unit 7 (taught now, test 14 Jan) is not closed and is among the open units; Units 8-10 are not closed either');
  check(r.live === 3 && r.cq === 3, 'the class is in Quarter 3');
  check(r.u7closed === false, 'Unit 7 is not treated as a past quarter\'s unit');
  check(r.open.includes('Unit 7'), 'Unit 7 is an open unit');
  check(r.u8closed === false && r.u10closed === false, 'Units 8 and 10 (taught in Q3) are not closed');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
