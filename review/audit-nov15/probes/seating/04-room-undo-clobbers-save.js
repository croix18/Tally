// SEA-04: room Undo restores every class's saved chart from the snapshot taken at the room edit. A chart saved AFTER
// that edit is silently replaced by the older one (or deleted, if the class had none), in every class, with no word.
const { open, check, done, roomJS } = require('./h.js');
(async () => {
  const { b, p, errs, K } = await open();
  await p.evaluate(`(${roomJS})(30, 6)`);
  await p.evaluate(K => { const T = window.__tally; T.state.active = K; T.save(); }, K);
  await p.click('[data-k="' + K + '"]').catch(() => {}); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(400);
  // 1. Room: nudge a desk (a room edit: roomPush snapshots every class's seats: this class has none yet)
  await p.click('#seatSub [data-sub="room"]'); await p.waitForTimeout(300);
  await p.click('#rmDesk'); await p.waitForTimeout(300);   // + Desk: one undo step
  // 2. Chart: seat by hand, place two students, Save
  await p.click('#seatSub [data-sub="chart"]'); await p.waitForTimeout(300);
  await p.click('#seatHand'); await p.waitForTimeout(300);
  for (let k = 0; k < 2; k++) { await p.click(`[data-unseated]`); await p.waitForTimeout(150); await p.click(`.cdesk:has(rect.empty) >> nth=0`); await p.waitForTimeout(200); }
  await p.click('#seatSave'); await p.waitForTimeout(400);
  const saved = await p.evaluate(K => { const s = window.__tally.state.sections[K]; return s.seating ? Object.keys(s.seating.seats).length : 0; }, K);
  // 3. Room again: Undo (meant to take back the extra desk)
  await p.click('#seatSub [data-sub="room"]'); await p.waitForTimeout(300); await p.click('#rmUndo'); await p.waitForTimeout(300);
  const after = await p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; return { desks: T.state.room.desks.length, seating: s.seating ? Object.keys(s.seating.seats).length : null }; }, K);
  console.log('OBSERVED:', JSON.stringify({ savedSeats: saved, afterRoomUndo: after }));
  console.log('EXPECTED: Undo removes the added desk (31 -> 30) and leaves the chart saved after it (2 seats) alone');
  check(saved === 2, 'the hand chart was saved with 2 students');
  check(after.desks === 30, 'room undo took the desk back');
  check(after.seating === 2, `the chart saved after the room edit survives room Undo (seats now: ${after.seating})`);
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
