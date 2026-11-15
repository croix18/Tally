// DAT-08: an old-style backup (written until 21 Oct; "files in his Drive still load") opened on a Tally in use asks
// "Add it to what is here? Nothing here is removed." and then replaces, class by class, the goal, the Focus-check
// overrides, the seating notes/flags/FAST levels (seatInfo) and the seating chart with the backup's older copies.
const D = require('./dat-lib.js');
(async () => {
  const { b, p, errs } = await D.open(); await D.loadClass(p);
  const r = await p.evaluate(async K => { const A = window.__all, T = window.__tally, st = A.state, s = st.sections[K]; const nm = A.classStudents(s)[0];
    // the backup as written in October (the same fields tests/lib.js legacyOf writes), taken from this Tally then
    s.seatInfo = { [nm]: A.cleanSeatInfo({ notes: 'October note', level: 2 }) }; s.overrides = {}; T.save();
    const x = JSON.parse(JSON.stringify(T.stateForSave().sections[K]));
    const legacy = { tally: 4, exported: '2026-10-15T12:00:00.000Z', settings: {}, sections: { [K]: { label: x.label, prep: x.prep, studentSkips: x.studentSkips, threshold: x.threshold, roster: x.roster, rosterAt: x.rosterAt, excluded: x.excluded, ignored: x.ignored, aliases: x.aliases, hiddenUnits: x.hiddenUnits, history: x.history, gradeHistory: [], seating: null, seatInfo: x.seatInfo, qArchive: {}, overrides: x.overrides } } };
    // since then: a new goal, a Focus-check override, a seating note and FAST level
    s.threshold = 72; s.overrides = { 'Unit 1': { [nm]: { focus: 4, tally: 5, at: '2026-11-10T12:00:00.000Z', why: 'late penalty' } } }; s.seatInfo[nm].notes = 'November note: needs front'; s.seatInfo[nm].level = 4; T.save();
    window.confirm = () => true; await A.loadTallyFile({ name: 'tally-backup-2026-10-15.json' }, legacy);
    const now = st.sections[K]; return { goal: now.threshold, overrides: Object.keys(now.overrides || {}).length, seatNote: (now.seatInfo[nm] || {}).notes, level: (now.seatInfo[nm] || {}).level };
  }, D.K);
  console.log('OBSERVED:', JSON.stringify(r));
  console.log('EXPECTED:', '{"goal":72,"overrides":1,"seatNote":"November note: needs front","level":4}: the dialog says "Nothing here is removed", and loadSettingsBackup\'s own comment says "An old backup adds to what is here, never takes it away"');
  const { check, done } = D.L;
  check(r.goal === 72, 'the goal set since the backup stays'); check(r.overrides === 1, 'the Focus-check override made since stays'); check(r.seatNote === 'November note: needs front' && r.level === 4, 'the seating note and FAST level entered since stay');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | ')); await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
