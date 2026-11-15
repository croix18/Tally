// TIM-05: one assignment in the Quarter 2 gradebook due after the quarter's end (winter-break work assigned 12/14,
// due 01/05) makes Tally treat the whole class as being in Quarter 3 while Quarter 2 is still being taught.
const path = require('path'); const { importGb, openAt, check, done, pick, fs } = require('./_tim.js');
const K = '1205050-7T1A';
(async () => {
  const { b, p, errs } = await openAt('America/New_York', '2026-12-15T15:00:00Z');   // Tue 15 Dec 2026, Quarter 2
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  await importGb(p, path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv'));
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    A.closeQuarter(1, { acc: [...A.unitsDueIn('acc', 1)], on: [] }); T.save();
    const u3 = T.unitsOf(s).find(x => x.short === 'Unit 3'); T.state.assigned.acc[u3.name] = true;
    const before = { live: A.liveQuarter(s), u3: A.unitClosed(s, u3), q2tab: !!A.qSec(s, 2) || A.classQuarters(s).includes(2), owed: A.openUnits(s).map(x => x.short) };
    const ws = s.grades.assignments.find(a => !A.gbUnitFor(s, a)); const brk = { ...JSON.parse(JSON.stringify(ws)), name: 'Winter Break Packet', assignedOn: '12/14', due: '01/05', values: ws.values.map(() => null), status: ws.values.map(() => 'blank') };
    s.grades.assignments.push(brk); T.save(); T.render();
    return { before, after: { live: A.liveQuarter(s), u3: A.unitClosed(s, u3), classQuarters: A.classQuarters(s), owed: A.openUnits(s).map(x => x.short), header: A.Q_NAMES[A.liveQuarter(s) - 1] } }; }, K);
  console.log('OBSERVED:', JSON.stringify(r));
  console.log('EXPECTED: still Quarter 2 after the break packet is added: Unit 3 open and owed, the class listed in Quarter 2');
  check(r.after.live === 2, 'the class is still in Quarter 2');
  check(r.after.u3 === false, 'Unit 3 (Quarter 2 work) is still owed');
  check(r.after.classQuarters.includes(2), 'the class still has a Quarter 2');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
