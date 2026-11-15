// DAT-01: Tally in two tabs. In tab A the teacher pastes a new roster into Settings, then clicks into the Goal box (the
// roster box is changed but no longer focused). Tab B saves anything (here: a note). Tab A takes B's save at once
// (typingNow() only looks at the focused field and the #modal), re-renders Settings, and the pasted roster is gone.
//   Run: TALLY_REPO=/home/claude/work/audit/base node probes/01-two-tab-wipes-unfocused-edit.js
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/data/repo';
const { chromium, fs, exe, check, done, pick, APP } = require(path.join(REPO, 'tests/lib.js'));
const K = '1205050-7T1A';
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'America/New_York' });
  const A = await ctx.newPage(); const errs = []; A.on('pageerror', e => errs.push(e.message)); A.on('dialog', d => d.accept());
  await A.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await A.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await A.waitForTimeout(500);
  await A.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await A.click('#rpSave'); await A.waitForTimeout(300);
  const B = await ctx.newPage(); B.on('pageerror', e => errs.push('B ' + e.message)); B.on('dialog', d => d.accept()); await B.goto('file://' + path.resolve(APP)); await B.waitForTimeout(500);
  // tab A: Settings > Class, paste a roster, then click into the Goal box
  await A.evaluate(K => window.__tally.openSettings(K, 'class'), K); await A.waitForTimeout(300);
  const typed = fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8') + '\nNEWSTUDENT, SYNTHETIC';
  await A.fill('#roster', typed); await A.click('#thr'); await A.waitForTimeout(150);
  // tab B saves (any change: a note on a student)
  await B.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; T.addNote(s, s.students[0], 'from tab B'); T.save(); }, K);
  await A.waitForTimeout(800);
  const after = await A.evaluate(() => { const r = document.querySelector('#roster'); return { exists: !!r, hasNew: !!r && /NEWSTUDENT/.test(r.value), view: window.__tally.view.mode }; });
  const noteIn = await A.evaluate(K => { const s = window.__tally.state.sections[K]; return Object.values(s.stuNotes || {}).flat().some(n => n.text === 'from tab B'); }, K);
  console.log('OBSERVED:', JSON.stringify({ ...after, tabBNoteTakenIn: noteIn }));
  console.log('EXPECTED:', 'the pasted roster (NEWSTUDENT) is still in the box in tab A (NOTES 14 Nov item 5: "Both tabs end with both changes"; typing is kept)');
  check(after.exists && after.hasNew, 'the roster pasted in tab A survives the other tab\'s save');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
