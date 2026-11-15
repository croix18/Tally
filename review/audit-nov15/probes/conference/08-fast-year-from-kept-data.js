// CNF-08: "this year" for FAST is the newest school year in ANY result Tally keeps (fastYearNow), with one escape:
// a newest year that holds only PM3s is last year. Tally keeps every result, so next August the year just ended
// holds PM1, PM2 and PM3 (kept from this year's students) and the escape never fires: a new student's 6th-grade PM3,
// the only score his August report carries, is shown as "PM3 this year" with no gain target (the 24 Oct bug again).
// The clock is set to 20 Aug 2027 (after the PM3 window of 2026-27, before PM1 of 2027-28).
const H = require('./_h.js');
(async () => { const { b, p, errs, L, K } = await H.open({ q2: true });
  await p.clock.setFixedTime(new Date('2027-08-20T10:00:00-04:00'));
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; s.prep = 'on'; const gb = s.grades;
    const old = gb.students[0], oldId = String(gb.ids[0]), nw = gb.students[1], nwId = String(gb.ids[1]);
    // kept from 2026-27: a student who sat all three windows
    T.importFast({ students: [{ id: oldId, name: old, grade: 7, tests: [{ test: 'FAST', pm: 'PM1', year: '2026-27', level: 2, scale: 225 }, { test: 'FAST', pm: 'PM2', year: '2026-27', level: 2, scale: 230 }, { test: 'FAST', pm: 'PM3', year: '2026-27', level: 3, scale: 240 }], info: {} }], blank: 0, windows: [] }, 'may.csv');
    // August 2027: a rising 7th grader's report carries his 6th-grade PM3 only
    T.importFast({ students: [{ id: nwId, name: nw, grade: 7, tests: [{ test: 'FAST', pm: 'PM3', year: '2026-27', level: 2, scale: 215, grade: 6 }], info: {} }], blank: 0, windows: [{ pm: 'PM3', year: '2026-27' }] }, 'aug.csv');
    const t = A.fastTargets(s, nw); const div = document.createElement('div'); div.innerHTML = A.fastTargetsHtml(t);
    return { thisYear: t.thisYear, prior: t.prior && t.prior.scale, latest: t.latest && (t.latest.pm + ' ' + t.latest.year), gain: t.gain && t.gain.score, cards: [...div.querySelectorAll('.gcard')].map(c => c.textContent.replace(/\s+/g, ' ').trim()) }; }, K);
  console.log('OBSERVED:', JSON.stringify(out));
  console.log('EXPECTED: in August 2027 this year is 2027-28; the 2026-27 PM3 (215, Low Level 2 on grade 6) is last year\'s, and the gain target is High Level 2 on grade 7 (229)');
  L.check(out.thisYear === '2027-28' && out.prior === 215 && out.latest == null && out.gain === 229, 'the new student\'s PM3 is last year\'s, with its gain target');
  L.check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); L.done(); })().catch(e => { console.error(e); process.exit(2); });
