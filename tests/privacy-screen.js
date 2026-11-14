// The privacy screen (Croix, 14 Nov 2026: "Can you make a privacy screen. So if I haven't used it in x amount of time it
// blurs the screen."). After the set minutes with nothing touched, Tally is blurred and can't be read or used; a
// click or a key brings it back; it stays off where the screen is meant to be seen.
const { chromium, fs, path, exe, check, done, APP, pick } = require('./lib');
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const st = () => p.evaluate(() => ({ veiled: document.body.classList.contains('veiled'), shown: !document.querySelector('#veil').classList.contains('hidden'), text: document.querySelector('#veil').innerText.replace(/\s+/g, ' ') }));
  const idle = async min => { await p.evaluate(m => { const T = window.__tally; T.idle(m * 60000); T.veilTick(); }, min); await p.waitForTimeout(100); };
  await idle(60); check(!(await st()).veiled, 'with no class loaded there is nothing to hide: no privacy screen');
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  check((await p.evaluate(() => window.__tally.state.settings.privacy)) === 5, 'it is on from the start, at 5 minutes');
  await idle(4.9); check(!(await st()).veiled, 'under the time: nothing happens');
  await idle(5.1); let s = await st();
  check(s.veiled && s.shown && /Tally is hidden Nothing touched for 5 minutes\. Show Tally Click anywhere or press a key/.test(s.text), 'after 5 minutes untouched the screen is hidden and says why: ' + s.text);
  await p.waitForTimeout(900);   // an element with its own transition eases into the blur
  const look = await p.evaluate(() => { const kids = [...document.body.children].filter(el => el.id !== 'veil' && el.tagName !== 'SCRIPT' && getComputedStyle(el).display !== 'none'); const v = document.querySelector('#veil').getBoundingClientRect();
    return { blur: kids.every(el => { const m = getComputedStyle(el).filter.match(/blur\((\d+)px\)/); return !!m && Number(m[1]) >= 20; }), inert: kids.every(el => el.inert), n: kids.length, cover: v.width >= document.documentElement.clientWidth && v.height >= document.documentElement.clientHeight, focus: document.activeElement && document.activeElement.id, names: document.querySelector('#veil').innerText }; });
  check(look.n >= 2 && look.blur && look.inert && look.cover && look.focus === 'veilShow', 'everything on the page is blurred past reading and can\'t be clicked or tabbed into; the cover fills the window: ' + JSON.stringify(look));
  await p.mouse.move(300, 300); await p.mouse.move(500, 420); await p.waitForTimeout(100); check((await st()).veiled, 'moving the mouse does not uncover it');
  await p.keyboard.press('Shift'); check((await st()).veiled, 'nor does a bare Shift');
  await p.keyboard.press('Control+k'); await p.waitForTimeout(150); s = await st();
  check(!s.veiled && !s.shown && !(await p.evaluate(() => document.activeElement && document.activeElement.id === 'search')) && (await p.evaluate(() => [...document.body.children].every(el => !el.inert))), 'a key press shows Tally again, and the key itself does nothing else (Ctrl+K did not open the finder)');
  await idle(6); await p.mouse.click(40, 700); await p.waitForTimeout(150); check(!(await st()).veiled, 'a click anywhere shows it again');
  // using Tally restarts the clock
  await p.evaluate(() => window.__tally.idle(6 * 60000)); await p.mouse.move(200, 200); await p.evaluate(() => window.__tally.veilTick()); check(!(await st()).veiled, 'any use (even moving the mouse) restarts the clock');
  // the setting
  await p.evaluate(() => window.__tally.openSettings()); await p.waitForTimeout(400);
  check(await p.locator('#privacy [data-priv]').count() === 6 && await p.locator('#privacy .on').innerText() === '5 min', 'Settings has the choice: Off, 1, 2, 5, 10, 15 minutes');
  await p.evaluate(() => document.querySelector('#privacy [data-priv="1"]').click()); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await idle(1.1); s = await st(); check(s.veiled && /Nothing touched for 1 minute\./.test(s.text), 'set to 1 minute it hides after 1 minute');
  await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  await p.reload(); await p.waitForTimeout(700); check((await p.evaluate(() => window.__tally.state.settings.privacy)) === 1, 'the choice is kept');
  await p.evaluate(() => { const T = window.__tally; T.state.settings.privacy = 0; T.save(); }); await idle(600); check(!(await st()).veiled, 'Off: it never hides');
  await p.evaluate(() => { const T = window.__tally; T.state.settings.privacy = 5; T.save(); });
  // where the screen is meant to be seen
  await p.evaluate(() => document.body.classList.add('lbMode')); await idle(30); const board = (await st()).veiled; await p.evaluate(() => document.body.classList.remove('lbMode'));
  await p.evaluate(() => document.body.classList.add('showMode')); await idle(30); const show = (await st()).veiled; await p.evaluate(() => document.body.classList.remove('showMode'));
  check(!board && !show, 'the Board and a student\'s Show page are never hidden: they are there to be looked at');
  // on demand, from the finder
  await p.evaluate(() => window.__tally.idle(0)); await p.click('#search'); await p.keyboard.type('hide the screen'); await p.waitForTimeout(300); await p.keyboard.press('Enter'); await p.waitForTimeout(300); s = await st();
  check(s.veiled && /You hid the screen\./.test(s.text), '"Hide the screen now" in the search box hides it at once: ' + s.text);
  await p.click('#veilShow'); await p.waitForTimeout(150); check(!(await st()).veiled, 'the button shows it again');

  // ---------- the PIN (Croix, 14 Nov 2026: "Oh yeah a pin would be great!") ----------
  const ui = (fn, arg) => p.evaluate(fn, arg);   // the Files tab of Settings isn't the one showing: its controls are driven directly
  await ui(() => window.__tally.openSettings()); await p.waitForTimeout(300);
  check(/A click or a key press brings it back\./.test(await ui(() => document.querySelector('#pinBox').innerText)) && !(await ui(() => window.__tally.pinOn())), 'no PIN to start with: Settings says a click or a key brings Tally back, and offers a PIN');
  const tryPin = (a, b2) => ui(([a, b2]) => { if (!document.querySelector('#pin1')) (document.querySelector('#pinNew') || document.querySelector('#pinChange')).click(); document.querySelector('#pin1').value = a; document.querySelector('#pin2').value = b2; document.querySelector('#pinSave').click(); const m = document.querySelector('#pinMsg'); return m ? m.textContent : document.querySelector('#pinBox').innerText; }, [a, b2]);
  check(/4 to 8 digits/.test(await tryPin('12', '12')) && /4 to 8 digits/.test(await tryPin('12ab', '12ab')), 'a PIN is 4 to 8 digits, nothing else');
  check(/don't match/.test(await tryPin('2468', '2469')) && !(await ui(() => window.__tally.pinOn())), 'typed twice, and the two must match');
  check(/PIN is on\./.test(await tryPin('2468', '2468')) && await ui(() => window.__tally.pinOn()), 'a matching pair sets it; Settings now says the PIN is on');
  const stored = await ui(() => localStorage.getItem('tally.pin'));
  check(!/2468/.test(stored) && !(await ui(() => JSON.stringify(window.__tally.stateForSave()).includes(JSON.parse(localStorage.getItem('tally.pin')).hash))) && !/"pin"|tally\.pin/.test(await ui(() => JSON.stringify(window.__tally.stateForSave()))), 'the PIN itself is never stored (a salted hash is), and it is not in a Full save');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await idle(5.1); s = await st();
  check(s.veiled && /Tally is hidden Nothing touched for 5 minutes\. Show Tally Enter your PIN Forgot the PIN\?/.test(s.text) && await ui(() => document.activeElement.id === 'veilPin'), 'with a PIN the hidden screen asks for it: ' + s.text);
  await p.mouse.click(40, 700); await p.waitForTimeout(100); await p.keyboard.press('Control+k'); await p.waitForTimeout(100);
  check((await st()).veiled && await ui(() => document.activeElement.id === 'veilPin') && !(await ui(() => document.querySelector('#search') === document.activeElement)), 'a click or a key no longer shows Tally, and no shortcut reaches the page');
  await p.keyboard.type('1111'); check(await ui(() => getComputedStyle(document.querySelector('#veilPin')).webkitTextSecurity === 'disc'), 'the digits typed are shown as dots');
  await p.keyboard.press('Enter'); await p.waitForTimeout(100); s = await st();
  check(s.veiled && /That is not the PIN\./.test(s.text) && await ui(() => document.querySelector('#veilPin').value === ''), 'a wrong PIN says so and clears the box');
  await p.keyboard.type('2468'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  check(!(await st()).veiled && await ui(() => [...document.body.children].every(el => !el.inert)), 'the right PIN shows Tally');
  // a reload doesn't lift it
  await idle(6); await p.reload(); await p.waitForTimeout(800); s = await st();
  check(s.veiled && /Hidden since you were last here\./.test(s.text) && await ui(() => [...document.body.children].filter(el => el.id !== 'veil' && el.tagName !== 'SCRIPT').every(el => el.inert)), 'reloading the page does not get past it: ' + s.text);
  // five wrong tries: a wait
  for (let k = 0; k < 5; k++) { await p.fill('#veilPin', '0000'); await p.keyboard.press('Enter'); await p.waitForTimeout(60); }
  s = await st(); check(s.veiled && /Too many tries\. Wait \d+ seconds\./.test(s.text) && await ui(() => document.querySelector('#veilPin').disabled && document.querySelector('#veilShow').disabled), 'five wrong tries and it makes whoever is guessing wait: ' + s.text.slice(0, 80));
  // forgotten: one of his own Full saves gets him back in, and only that
  const os = require('os'); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tally-pin-')); const put = (n, c) => { const f = path.join(tmp, n); fs.writeFileSync(f, c); return f; };
  const full = await ui(() => JSON.stringify({ tally: 4, full: { saved: new Date().toISOString(), classes: 1 }, state: window.__tally.stateForSave() }));
  const before = await ui(() => JSON.stringify(window.__tally.stateForSave()).length);
  await ui(() => document.querySelector('#veilForgot').click());
  await p.setInputFiles('#veilFile', put('fake.json', JSON.stringify({ tally: 4, full: { saved: 'x' }, state: { sections: {}, order: [] } }))); await p.waitForTimeout(300); s = await st();
  const fake = s.veiled && /That is not a Full save of the classes in this Tally\./.test(s.text);
  const other = JSON.parse(full); Object.values(other.state.sections).forEach(x => { x.students = x.students.map((_, i) => 'Somebody Else' + i); if (x.grades) x.grades.students = x.grades.students.map((_, i) => 'ELSE, SOMEBODY' + i); });
  await p.setInputFiles('#veilFile', put('other.json', JSON.stringify(other))); await p.waitForTimeout(300); s = await st();
  check(fake && s.veiled && /That is not a Full save of the classes in this Tally\./.test(s.text) && await ui(() => window.__tally.pinOn()), 'a made-up save, or a save of other students, does not get in: ' + fake + ' / ' + JSON.stringify(s));
  await p.setInputFiles('#veilFile', put('board.json', JSON.stringify({ tally: 4, board: { saved: 'x' }, state: JSON.parse(full).state }))); await p.waitForTimeout(300);
  check((await st()).veiled && /That is a Board save\. A Full save is needed\./.test((await st()).text), 'a Board save (no names in it) is not enough');
  await p.setInputFiles('#veilFile', put('tally-full.json', full)); await p.waitForTimeout(400); s = await st();
  check(!s.veiled && !(await ui(() => window.__tally.pinOn())) && /The PIN is removed\. Nothing else changed\./.test(await p.textContent('#toast')) && (await ui(() => JSON.stringify(window.__tally.stateForSave()).length)) === before, 'his own Full save removes the PIN and shows Tally; nothing is loaded from the file and the data is untouched');
  // a Tally opened after the time has passed starts hidden (with a PIN only)
  await ui(() => { localStorage.setItem('tally.use', String(Date.now() - 10 * 60000)); }); await p.reload(); await p.waitForTimeout(700);
  const noPinBoot = (await st()).veiled;
  await ui(() => { window.__tally.pinSet('135790'); localStorage.setItem('tally.use', String(Date.now() - 10 * 60000)); }); await p.reload(); await p.waitForTimeout(700); s = await st();
  check(!noPinBoot && s.veiled && /Hidden since you were last here\./.test(s.text), 'opened after the time has passed, Tally starts hidden when there is a PIN (and not when there isn\'t)');
  await p.fill('#veilPin', '135790'); await p.keyboard.press('Enter'); await p.waitForTimeout(150); check(!(await st()).veiled, 'and the PIN opens it');
  await ui(() => window.__tally.openSettings()); await p.waitForTimeout(300); await ui(() => document.querySelector('#pinOff').click()); await p.waitForTimeout(150);
  check(!(await ui(() => window.__tally.pinOn())) && /A click or a key press brings it back\./.test(await ui(() => document.querySelector('#pinBox').innerText)), 'Remove in Settings turns the PIN off');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})();
