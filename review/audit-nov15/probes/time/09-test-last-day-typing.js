// TIM-09: Settings -> Test dates: typing a new last day for a two-day test erases it. The first keystroke makes a date
// before the first day; testRow clears it and the handler writes '' back into the box being typed in.
const { openAt, check, done } = require('./_tim.js');
(async () => {
  const { b, p, errs } = await openAt('America/New_York', '2026-11-15T17:00:00Z');
  await p.evaluate(() => { window.__tally.state.testDates = window.__all.cleanTestDates(null); window.__all.openTestDates('on'); });
  const i = await p.evaluate(() => window.__tally.state.testDates.on.findIndex(x => x.unit === 'Unit 10'));   // 19-20 Nov
  const sel = `input[data-f="to"][data-i="${i}"]`;
  await p.click(sel); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowRight');   // the day segment
  await p.keyboard.type('21'); await p.waitForTimeout(150); await p.keyboard.press('Tab'); await p.waitForTimeout(150);
  await p.click('#tdDone'); await p.waitForTimeout(200);
  const r = await p.evaluate(() => { const A = window.__all; const x = window.__tally.state.testDates.on.find(y => y.unit === 'Unit 10'); return { row: x, says: A.testDays(x), nextOnFri20: (A.nextTest('on', '2026-11-20') || {}).unit }; });
  console.log('OBSERVED:', JSON.stringify(r));
  console.log('EXPECTED: Unit 10 runs 2026-11-19 to 2026-11-21 (or keeps 11-20): "Thursday, Nov 19 to Saturday, Nov 21", and on Fri 20 Nov the next test is still Unit 10');
  check(r.row.to === '2026-11-21' || r.row.to === '2026-11-20', 'the last day survives typing');
  check(r.nextOnFri20 === 'Unit 10', 'on the second test day the weekly report still names Unit 10');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
