// TIM-02: in the Quarters dialog every keystroke in a date box commits a half-typed date and redraws the dialog
// (focus lost), and any date is accepted, even one before the previous quarter's end. Typing "12/17/2026" into
// Quarter 2's end (Chrome's date box, from the month segment) leaves Quarter 2 ending 18 Jan 2026.
const path = require('path'); const { openAt, check, done, importGb, fs } = require('./_tim.js');
(async () => {
  const { b, p, errs } = await openAt('America/New_York', '2026-11-15T17:00:00Z');
  // a class in Quarter 2 (Quarter 1 kept and closed), so the stray dates reach its grade history
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await importGb(p, path.resolve('fixtures/focus_gradebook_scrubbed.csv')); await importGb(p, path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv'));
  await p.evaluate(() => { const A = window.__all; A.closeQuarter(1, { acc: [...A.unitsDueIn('acc', 1)], on: [] }); window.__tally.save(); });
  const qs0 = await p.evaluate(() => Object.values(window.__tally.state.sections)[0].gradeHistory.map(h => h.date + ':Q' + h.q).join(' '));
  await p.evaluate(() => window.__all.openQuarters());
  if (await p.locator('#qDates summary').count()) await p.click('#qDates summary');   // when Quarter 1 is due, the dates sit under "Quarter dates…"
  const sel = 'input[data-qend="1"]';
  await p.click(sel); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');   // the month segment
  const seen = [];
  for (const k of '12172026') { await p.keyboard.type(k); await p.waitForTimeout(120); seen.push(await p.evaluate(() => window.__all.quarters().ends[1])); }
  const r = await p.evaluate(() => { const A = window.__all; return { ends: A.quarters().ends.slice(), qOfDec10: A.quarterOf(A.mdToISO('12/10')), focus: document.activeElement && document.activeElement.tagName }; });
  console.log('OBSERVED: Quarter 2 end after each keystroke:', seen.join(' '), '| ends', JSON.stringify(r.ends), '| an assignment due 12/10 is in Quarter', r.qOfDec10, '| focus on', r.focus);
  console.log('EXPECTED: Quarter 2 ends 2026-12-17 (or is unchanged while the date is half typed); never a day before Quarter 1 ends; 12/10 stays Quarter 2');
  check(r.ends[1] === '2026-12-17' || r.ends[1] === '2026-12-18', 'the typed date (or the old one) is what is kept');
  check(seen.every(d => d > r.ends[0]), 'no half-typed date before Quarter 1\'s end is ever committed');
  // the handler itself: an out-of-order date is accepted
  await p.evaluate(() => { const i = document.querySelector('input[data-qend="1"]'); i.value = '2026-09-01'; i.dispatchEvent(new Event('change')); });
  const e2 = await p.evaluate(() => window.__all.quarters().ends.slice());
  console.log('OBSERVED: after choosing 1 Sep 2026 for Quarter 2 end:', JSON.stringify(e2));
  console.log('EXPECTED: refused (Quarter 1 ends 9 Oct): the four ends must be in order');
  check(e2[1] > e2[0], 'quarter ends stay in order');
  // he notices and puts Quarter 2's end back with the calendar pop-up
  await p.evaluate(() => { const i = document.querySelector('input[data-qend="1"]'); i.value = '2026-12-18'; i.dispatchEvent(new Event('change')); });
  const qs1 = await p.evaluate(() => ({ ends: window.__all.quarters().ends.join(','), h: Object.values(window.__tally.state.sections)[0].gradeHistory.map(h => h.date + ':Q' + h.q).join(' ') }));
  console.log('OBSERVED: grade history before', JSON.stringify(qs0), '| after the dates are put back', JSON.stringify(qs1));
  console.log('EXPECTED: the history is as before (one Quarter 2 snapshot for today); no Quarter 3 snapshot dated 15 Nov');
  check(!/:Q3/.test(qs1.h), 'no stray Quarter 3 snapshot is left in the grade history');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
