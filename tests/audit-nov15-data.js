// Audit of 15 Nov 2026, fixer DATA: saves, two tabs and the privacy screen. One check (or a few) per finding fixed.
const { chromium, fs, path, exe, check, done, pick, tmp, APP, SCRUB } = require('./lib');
const { execSync } = require('child_process');
const K = '1205050-7T1A';
const loadClass = async p => {
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
};
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const errs = [];
  const page = async ctx => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept()); await p.goto('file://' + path.resolve(APP)); return p; };

  // DAT-02: a print while the PIN screen is up shows the veil card and nothing of Tally
  { const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'America/New_York' }); const p = await page(ctx); await loadClass(p);
    const last = await p.evaluate(K => { const T = window.__tally; T.state.settings.hideNames = false; T.state.active = K; T.save(); T.render(); T.pinSet('4826'); T.veil('now'); return T.state.sections[K].grades.students[0].split(',')[0]; }, K);
    await p.waitForTimeout(300); await p.emulateMedia({ media: 'print' });
    const pdf = path.join(tmp, 'veiled.pdf'); await p.pdf({ path: pdf, format: 'Letter' }); const txt = execSync(`pdftotext ${pdf} -`).toString();
    check(!txt.toUpperCase().includes(last.toUpperCase()) && /Tally is hidden/.test(txt), 'DAT-02: printing while hidden behind a PIN prints the veil card and no student name');
    await p.evaluate(() => { const T = window.__tally; T.pinClear && T.pinClear(); }); await ctx.close(); }

  // DAT-01: another tab's save waits for an unsaved, unfocused edit on the Settings page; saving it keeps both tabs' changes
  { const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'America/New_York' }); const A = await page(ctx); await loadClass(A);
    const B = await page(ctx); await B.waitForTimeout(400);
    await A.evaluate(K => window.__tally.openSettings(K, 'class'), K); await A.waitForTimeout(300);
    const typed = fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8') + '\nZEDSTUDENT, SYNTHETIC';
    await A.fill('#roster', typed); await A.click('#thr'); await A.waitForTimeout(150);
    await B.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; T.addNote(s, s.students[0], 'from tab B'); T.save(); }, K); await A.waitForTimeout(800);
    const kept = await A.evaluate(() => { const r = document.querySelector('#roster'); return !!r && /ZEDSTUDENT/.test(r.value) && window.__tally.view.mode === 'settings'; });
    await A.click('#mSave'); await A.waitForTimeout(500);
    const both = await A.evaluate(K => { const s = window.__tally.state.sections[K]; return { roster: /ZEDSTUDENT/.test(s.roster || ''), note: Object.values(s.stuNotes || {}).flat().some(n => n.text === 'from tab B') }; }, K);
    check(kept && both.roster && both.note, 'DAT-01: a roster pasted in Settings and left unsaved (focus in the Goal box) survives another tab\'s save, and saving keeps both changes: ' + JSON.stringify({ kept, ...both }));
    await ctx.close(); }

  // DAT-09: "Clear all Tally data" in one tab is not undone by a second open tab
  { const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); const A = await page(ctx); await loadClass(A);
    const B = await page(ctx); await B.waitForTimeout(400);
    await A.evaluate(() => window.__tally.openSettings(undefined, 'files')); await A.waitForTimeout(300); await A.click('#wipe'); await A.waitForTimeout(1500);
    await B.waitForTimeout(500); await B.evaluate(() => { const h = document.querySelector('#btnHide'); if (h) h.click(); window.__tally.save(); }); await B.waitForTimeout(300);
    const r = await B.evaluate(() => ({ stored: localStorage.getItem('tally.v1'), classes: window.__tally.state.order.length }));
    const stored = r.stored ? Object.keys(JSON.parse(r.stored).sections || {}).length : 0;
    check(stored === 0 && r.classes === 0, 'DAT-09: after Clear all in one tab, the other open tab starts over empty and a save there writes no class back: ' + JSON.stringify({ stored, classes: r.classes }));
    await ctx.close(); }

  // DAT-01, round 2: a save from the Settings page itself (skipping an IXL account in the match report) while edits are
  // unsaved and another tab's save waits must not swap the class objects out from under Settings
  { const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'America/New_York' }); const A = await page(ctx); await loadClass(A);
    const B = await page(ctx); await B.waitForTimeout(400);
    await A.evaluate(K => window.__tally.openSettings(K, 'class'), K); await A.waitForTimeout(300);
    const typed = fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8').split('\n').slice(1).join('\n') + '\nZEDSTUDENT, SYNTHETIC';
    await A.fill('#roster', typed); await A.click('#thr'); await A.waitForTimeout(150);
    await B.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; T.addNote(s, s.students[0], 'from tab B'); T.save(); }, K); await A.waitForTimeout(800);
    const ign = await A.$('#matchReport [data-ign]'); if (ign) { await ign.click(); await A.waitForTimeout(300); }
    await A.fill('#thr', '77'); await A.click('#mSave'); await A.waitForTimeout(500);
    const o = await A.evaluate(K => { const s = window.__tally.state.sections[K]; const st = JSON.parse(localStorage.getItem('tally.v1')).sections[K];
      return { roster: /ZEDSTUDENT/.test(s.roster), thr: s.threshold, ign: Object.keys(s.ignored || {}).length, note: Object.values(s.stuNotes || {}).flat().some(n => n.text === 'from tab B'), storedRoster: /ZEDSTUDENT/.test(st.roster), storedThr: st.threshold }; }, K);
    check(!!ign && o.roster && o.thr === 77 && o.ign >= 1 && o.note && o.storedRoster && o.storedThr === 77, 'DAT-01 (round 2): skipping an IXL account on the Settings page while another tab\'s save waits, then Save: the pasted roster, the new goal, the skip and the other tab\'s note are all kept and stored: ' + JSON.stringify(o));
    await ctx.close(); }

  // DAT-09, round 2: a localStorage.clear() by another local page (same file:// origin) does not empty an open Tally tab
  { const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); const A = await page(ctx); await loadClass(A);
    const other = await ctx.newPage(); await other.goto('file://' + path.resolve('fixtures/roster.txt')); await other.evaluate(() => localStorage.clear()); await A.waitForTimeout(1200);
    await A.evaluate(() => window.__tally.save()); await A.waitForTimeout(300);
    const o = await A.evaluate(() => ({ classes: window.__tally.state.order.length, stored: !!localStorage.getItem('tally.v1') && JSON.parse(localStorage.getItem('tally.v1')).order.length }));
    check(o.classes === 1 && o.stored === 1, 'DAT-09 (round 2): another local page clearing storage leaves the open Tally tab as it was, and its next save writes the class back: ' + JSON.stringify(o));
    await ctx.close(); }

  // DAT-04: a file dropped on the PIN screen is not imported, and the card says to enter the PIN first
  { const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); const p = await page(ctx); await loadClass(p);
    const before = await p.evaluate(() => { const T = window.__tally; T.pinSet('4826'); T.veil('now'); return JSON.stringify(T.state.order); }); await p.waitForTimeout(200);
    const f = fs.readdirSync('fixtures').find(x => x.startsWith('csv_IXL-Score-Grid')); const data = fs.readFileSync(path.join('fixtures', f), 'utf8');
    await p.evaluate(([name, text]) => { const dt = new DataTransfer(); dt.items.add(new File([text], name, { type: 'text/csv' })); const v = document.querySelector('#veil'); v.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, [f, data]);
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => ({ order: JSON.stringify(window.__tally.state.order), veiled: document.body.classList.contains('veiled'), msg: (document.querySelector('#veilMsg') || {}).textContent }));
    check(r.order === before && r.veiled && /Enter the PIN first/.test(r.msg || ''), 'DAT-04: a file dropped on the PIN screen changes nothing and the card says to enter the PIN first: ' + JSON.stringify(r));
    await p.evaluate(() => window.__tally.pinClear && window.__tally.pinClear()); await ctx.close(); }

  // DAT-07: Scrub gives every distinct real name its own pseudonym, past the size of its name lists
  { const ctx = await b.newContext(); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + path.resolve(SCRUB));
    const r = await p.evaluate(() => { const S = window.__scrub.scrubName; const w = (i, salt) => { let s = ''; let n = i * 7 + salt; for (let k = 0; k < 6; k++) { s += 'bcdfghjklmnprstvz'[n % 17] + 'aeiou'[(n >> 2) % 5]; n = Math.floor(n / 3) + k * 11; } return s[0].toUpperCase() + s.slice(1, 7) + i; };
      const real = Array.from({ length: 300 }, (_, i) => `${w(i % 110, 3)}, ${w(i, 5)}`); const fake = real.map(S);
      const firsts = new Map(); real.forEach((n, i) => { const ff = fake[i].split(', ')[1]; (firsts.get(ff) || firsts.set(ff, new Set()).get(ff)).add(n.split(', ')[1]); });
      return { distinct: new Set(fake).size, firstClash: [...firsts.values()].filter(x => x.size > 1).length, again: S(real[5]) === fake[5] }; });
    check(r.distinct === 300 && r.firstClash === 0 && r.again, 'DAT-07: 300 students sharing 110 surnames get 300 different pseudonyms, no fake first name stands for two real ones, and a name scrubs the same way twice: ' + JSON.stringify(r));
    await ctx.close(); }

  // DAT-08, DAT-06 (true wording), the default goal in migrate, the course-setup import's keys
  { const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); const p = await page(ctx); await loadClass(p);
    // an old-style backup's dialog says what it replaces
    await p.evaluate(K => { window.__askSeen = ''; window.confirm = m => { window.__askSeen = m; return false; }; const T = window.__tally, x = JSON.parse(JSON.stringify(T.stateForSave().sections[K]));
      window.__all.loadTallyFile({ name: 'tally-backup-2026-10-15.json' }, { tally: 4, exported: '2026-10-15T12:00:00.000Z', settings: {}, sections: { [K]: { label: x.label, prep: x.prep, threshold: x.threshold, roster: x.roster, history: x.history } } }); }, K);
    await p.waitForTimeout(400);
    const said = await p.evaluate(() => { const m = document.querySelector('#askMsg'); const t = window.__askSeen || (m && !document.querySelector('#ask').classList.contains('hidden') ? m.textContent : ''); const no = document.querySelector('#askNo'); if (no && !document.querySelector('#ask').classList.contains('hidden')) no.click(); return t; });
    check(/old-style backup/.test(said) && !/Nothing here is removed/.test(said) && /goals, grading, Focus check choices, hidden units, seating notes, seating charts and room replace the ones here/.test(said), 'DAT-08: the old-style backup\'s dialog says its goals, grading, Focus check choices and seating replace the ones here: ' + said.replace(/\s+/g, ' '));
    // storage full: the advice names what fills it and that a Full save keeps everything
    const full = await p.evaluate(() => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; try { window.__tally.save(); } finally { Storage.prototype.setItem = orig; } return document.querySelector('#toast').textContent; });
    check(/storage is full/.test(full) && /Full save/.test(full) && /IXL history, best scores and grade history/.test(full) && !/gradebook or photos/.test(full), 'DAT-06: the storage-full message says a Full save keeps everything and names what takes the room: ' + full);
    // migrate gives an accelerated class (prep 'acc', no old 'accelerated' flag) the accelerated default goal
    const thr = await p.evaluate(K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const was = { prep: s.prep, thr: s.threshold }; s.prep = 'acc'; delete s.accelerated; s.threshold = null; A.migrate(); const got = s.threshold; s.prep = was.prep; s.threshold = was.thr; return { got, want: A.DEFAULT_THR.acc }; }, K);
    check(thr.got === thr.want, 'migrate: a class with no goal on the accelerated course gets the accelerated default goal: ' + JSON.stringify(thr));
    // the course-setup import drops a file's __proto__ key
    const prep = await p.evaluate(K => window.__tally.state.sections[K].prep, K);
    await p.evaluate(K => { window.confirm = () => true; window.__tally.openSettings(K, 'course'); }, K); await p.waitForTimeout(300);
    const json = `{"tally":"course","prep":"${prep}","goal":60,"assigned":{"__proto__":{"polluted":1},"9":true},"skipped":[]}`;
    await p.setInputFiles('#courseFile', { name: 'tally-course.json', mimeType: 'application/json', buffer: Buffer.from(json) }); await p.waitForTimeout(400);
    await p.evaluate(() => { const y = document.querySelector('#askYes'); if (y && !document.querySelector('#ask').classList.contains('hidden')) y.click(); }); await p.waitForTimeout(400);
    const ca = await p.evaluate(prep => { const a = window.__tally.state.assigned[prep]; return { own: Object.prototype.hasOwnProperty.call(a, '9'), proto: Object.getPrototypeOf(a) === Object.prototype, polluted: 'polluted' in a }; }, prep);
    check(ca.own && ca.proto && !ca.polluted, 'the course-setup import takes the file\'s unit marks but not a __proto__ key: ' + JSON.stringify(ca));
    await ctx.close(); }

  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
