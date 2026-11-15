// SEA-05: two students with the same name (different Focus IDs) are one student to Seating. seatStudents joins the
// gradebook by name (the last of the two wins), and the seating id / seatInfo key is the display name, so both get one
// grade, one standing, one photo and one set of flags, and a chart can hold only one of them (the other shows seated
// at the same desk). The 14 Nov fix keyed the other screens by Focus Student ID (NOTES, Hostile review item 3).
const { open, check, done, roomJS } = require('./h.js');
(async () => {
  const { b, p, errs, K } = await open();
  await p.evaluate(`(${roomJS})(30, 6)`);
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    // find two gradebook students with clearly different grades; give the second the first one's name (synthetic twins)
    const g = gb.students.map((n, i) => ({ i, pct: (A.computeGrade(s, i) || {}).pct })).filter(x => x.pct != null).sort((a, b) => a.pct - b.pct);
    const lo = g[0], hi = g[g.length - 1]; const name = gb.students[lo.i];
    gb.students[hi.i] = name; s.roster = A.rosterFromGradebook(s, gb); T.save();
    const ids = gb.ids ? [gb.ids[lo.i], gb.ids[hi.i]] : null;
    const stu = A.seatStudents(s).filter(x => x.display === name);
    const G = A.geometry(); const M = A.buildModel(s, stu, G); const seats = { [G.ds[0].id]: stu[0].id, [G.ds[10].id]: stu[1] ? stu[1].id : 'x' };
    const unseated = stu.filter(x => !Object.values(seats).includes(x.id)).length;
    const at = A.asgFromSeats(seats, stu, G);
    return { ids, gradesInFocus: [Math.round(lo.pct), Math.round(hi.pct)], seatingRows: stu.length, seatingGrades: stu.map(x => x.grade == null ? null : Math.round(x.grade)), sameId: stu.length === 2 && stu[0].id === stu[1].id, desksOfTheTwo: at }; }, K);
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: two seating students with their own grades (' + o.gradesInFocus.join(' and ') + '), distinct ids, and two different desks');
  check(o.seatingRows === 2, 'both students are on the seating list');
  check(JSON.stringify(o.seatingGrades) === JSON.stringify(o.gradesInFocus), 'each gets their own Focus grade in standing');
  check(!o.sameId, 'they have distinct seating ids (so a chart can seat both and their flags/photos stay apart)');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
