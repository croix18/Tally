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
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})();
