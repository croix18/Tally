// SEA-03: the Seating bar's "saved <date>" is the UTC day of savedAt. A chart saved at 8:30 pm Eastern on Sun 15 Nov
// reads "saved Nov 16". (The "gone" date had the same bug and was fixed to the local day on 14 Nov.)
const { open, check, done, roomJS } = require('./h.js');
(async () => {
  const { b, p, errs, K } = await open({ tz: 'America/New_York' });
  await p.evaluate(`(${roomJS})(30, 6)`);
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const stu = A.seatStudents(s); const G = A.geometry();
    const seats = {}; stu.forEach((x, i) => seats[G.ds[i].id] = x.id);
    const at = new Date(2026, 10, 15, 20, 30);   // 8:30 pm local (Eastern) on Sunday 15 Nov 2026
    s.seating = { seats, locks: {}, savedAt: at.toISOString() }; T.save();
    const bar = A.renderSeatingBar(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    return { savedAt: s.seating.savedAt, bar, localDay: A.fmtDate('2026-11-15') }; }, K);
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: the bar names the local day the chart was saved: "saved ' + o.localDay + '"');
  check(o.bar.includes('saved ' + o.localDay), 'a chart saved at 8:30 pm Eastern on 15 Nov reads "saved ' + o.localDay + '"');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
