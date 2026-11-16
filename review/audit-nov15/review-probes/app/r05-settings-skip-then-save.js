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
  const typed = fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8').split('\n').slice(1).join('\n') + '\nNEWSTUDENT, SYNTHETIC';
  await A.fill('#roster', typed); await A.click('#thr'); await A.waitForTimeout(150);
  // tab B saves (any change: a note on a student)
  await B.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; T.addNote(s, s.students[0], 'from tab B'); T.save(); }, K);
  await A.waitForTimeout(800);
  const ign = await A.evaluate(() => document.querySelectorAll('#matchReport [data-ign]').length);
  await A.click('#matchReport [data-ign]'); await A.waitForTimeout(300);
  await A.fill('#thr', '77'); await A.click('#mSave'); await A.waitForTimeout(500);
  const o = await A.evaluate(K => { const T = window.__tally, s = T.state.sections[K]; const st = JSON.parse(localStorage.getItem('tally.v1')).sections[K];
    return { skipButtons: null, roster: /NEWSTUDENT/.test(s.roster), thr: s.threshold, ign: Object.keys(s.ignored || {}).length, note: Object.values(s.stuNotes || {}).flat().some(n => n.text === 'from tab B'), stored: { roster: /NEWSTUDENT/.test(st.roster), thr: st.threshold }, toast: (document.querySelector('#toast') || {}).textContent }; }, K);
  console.log('OBSERVED', ign, JSON.stringify(o));
  check(o.roster && o.thr === 77 && o.stored.roster && o.stored.thr === 77, 'tab A: after skipping an IXL account in the match report and pressing Save, the pasted roster and the new goal are saved');
  check(o.note, "tab B's note is in too");
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
