// Tests, end to end in Chromium (16 Nov 2026), on the SHIPPED Tally.html opened from a file:// address. Its one network
// address, https://mrshaffer.org, is answered by a stand-in for the site's two public routes (tests/exam/site.js) running
// on this machine; the test build (which may also reach 127.0.0.1) proves the address setting, a network that is gone, and
// a browser without Web Crypto. Synthetic classes and records only (tests/exam/fixtures.js).
// Screenshots go to $SHOTS (default: the suite's temp folder).
const { chromium, fs, path, exe, check, done, tmp, pick, APP } = require('./lib');
const SITE = require('./exam/site.js'); const F = require('./exam/fixtures.js'); const http = require('http');
const SHIP = 'Tally.html'; const SHOTS = process.env.SHOTS || tmp; fs.mkdirSync(SHOTS, { recursive: true });
const FX = n => path.resolve('fixtures', 'exams', n); const H2C = c => c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8);
const ctl = (site, p, body) => new Promise((res, rej) => { const d = body ? JSON.stringify(body) : ''; const r = http.request(site.url + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' } }, x => { let t = ''; x.on('data', c => t += c); x.on('end', () => { try { res(JSON.parse(t)); } catch (e) { rej(e); } }); }); r.on('error', rej); r.end(d); });
(async () => {
  if (!fs.existsSync(SHIP) || !/ExamSeal/.test(fs.readFileSync(SHIP, 'utf8'))) { console.log('SKIP the shipped Tally.html has no Tests yet: python3 build.py'); return; }
  const site = await SITE.start(); const b = site.b; const errs = [];
  const browser = await chromium.launch({ executablePath: exe });
  const sent = [];   // every request the page makes to the network
  async function open(file, o = {}) {
    const ctx = await browser.newContext({ viewport: o.vp || { width: 1366, height: 768 }, acceptDownloads: true, colorScheme: o.dark ? 'dark' : 'light', ...(o.ctx || {}) });
    if (o.init) await ctx.addInitScript(o.init);
    // https://mrshaffer.org is the stand-in: each request goes on to it, as the browser sent it
    await ctx.route('https://mrshaffer.org/**', async route => { const q = route.request(); sent.push({ url: q.url(), method: q.method(), headers: await q.allHeaders(), body: q.postData() });
      const u = new URL(q.url()); if (site.state.down) return route.abort('internetdisconnected');
      if (site.state.slow && /\/result\//.test(u.pathname)) await new Promise(r => setTimeout(r, site.state.slow));
      const r = await new Promise(res => http.get(site.url + u.pathname, x => { let t = ''; x.on('data', c => t += c); x.on('end', () => res({ status: x.statusCode, headers: x.headers, body: t })); }).on('error', () => res(null)));
      if (!r) return route.abort('connectionrefused'); return route.fulfill({ status: r.status, headers: r.headers, body: r.body }); });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    p.on('request', q => { if (!/^(file|data|blob):/.test(q.url())) sent.push({ url: q.url(), method: q.method(), page: true }); });
    await p.goto('file://' + path.resolve(file)); await p.waitForTimeout(400);
    return { ctx, p };
  }
  const shot = async (p, name, full) => { await p.waitForTimeout(150); await p.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); };
  const importClasses = async p => {
    await p.setInputFiles('#file', fs.readdirSync(FX('')).filter(f => /^IXL-Score-Grid/.test(f)).map(FX)); await p.waitForTimeout(900);
    for (const f of ['focus_gradebook_p4.csv', 'focus_gradebook_p5.csv']) { await p.setInputFiles('#file', [FX(f)]); await p.waitForTimeout(700); await pick(p); await p.waitForTimeout(300); const a = await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(200); } }
  };
  const toTests = async (p, per) => { await p.click(`#rail .rc:has-text("${per}")`); await p.waitForTimeout(250); await p.click('#openTests'); await p.waitForTimeout(350); };
  const text = (p, sel) => p.evaluate(s => (document.querySelector(s) || {}).innerText || '', sel);
  const fetched = async p => { for (let i = 0; i < 120; i++) { await p.waitForTimeout(250); const run = await p.evaluate(() => !!document.querySelector('#xtProg:not(.hidden) .xtSpin')); if (!run) return true; } return false; };

  /* ---- 1. the shipped file: Connect, the trial, the four words ---- */
  const { ctx, p } = await open(SHIP);
  check(await p.evaluate(() => isSecureContext && !!crypto.subtle && !!window.DecompressionStream && !!window.ExamSeal && !!window.ExamCore), 'the shipped file, opened from file://, has Web Crypto, the platform\'s deflate, and the lock');
  check(await p.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]').content.includes('connect-src https://mrshaffer.org;')), 'its CSP lets it reach https://mrshaffer.org and nothing else');
  await importClasses(p); await toTests(p, '4th');
  check(await p.locator('#ctabs #openTests[aria-selected="true"]').count() === 1 && /Grid\d*\s*Grades\s*Students\s*Seating\s*Tests\d*\s*Reports/.test(await text(p, '#ctabs')), 'Tests is a tab of the class, between Seating and Reports');
  check(/Connect Tally to the tests on mrshaffer\.org/.test(await text(p, '#gridwrap')) && await p.locator('.xtSteps > li').count() === 4, 'a class with nothing connected opens on Connect: four steps');
  await shot(p, '01-connect-1366');
  await p.click('#xtMake'); await p.waitForSelector('#xtKey', { timeout: 8000 });
  const pub = (await text(p, '#xtKey')).trim();
  check(/^TALLY1\.[A-Za-z0-9_-]{87}$/.test(pub), 'Make the key shows Tally\'s public key to paste: ' + pub.slice(0, 16) + '…');
  check(/If this key is lost, nobody can open these tests again/.test(await text(p, '.xtLose')) && await p.locator('.xtLose #xtSaveNow').count() === 1, 'it says once, plainly, what losing the key means, and offers the Full save right there');
  check(sent.some(x => /\/api\/test\/key$/.test(x.url)), 'it read the site\'s signing key');
  await shot(p, '02-key-made-1366');
  const tr = await ctl(site, '/__ctl/tally', { pub });
  await p.fill('#xtTrialIn', tr.code.toLowerCase().replace(/(.{4})/g, '$1 ')); await p.click('#xtTrialGo'); await p.waitForSelector('.xtWords', { timeout: 8000 });
  const words = await p.evaluate(() => [...document.querySelectorAll('.xtWords span')].map(s => s.textContent).join(' '));
  check(words === tr.words, `the trial opens and its four words are the cockpit's: "${words}" = "${tr.words}"`);
  const big = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.xtWords span')).fontSize)); check(big >= 28, 'the words are large enough to compare across a desk (' + big + ' px)');
  check(/Type these four words into the box under the trial code on the cockpit's Test card/.test(await text(p, '.xtSteps')) && await p.locator('#xtCopyWords').count() === 1 && await p.evaluate(() => getComputedStyle(document.querySelector('.xtWords')).textTransform) === 'lowercase', 'the line under the words says to type them into the cockpit; lower case, with a Copy button');
  await shot(p, '03-trial-words-1366');
  const [dl0] = await Promise.all([p.waitForEvent('download'), p.click('#xtSaveNow')]); await dl0.saveAs(path.join(tmp, 'after-key.json'));
  const fs0 = JSON.parse(fs.readFileSync(path.join(tmp, 'after-key.json'), 'utf8'));
  check(fs0.full && fs0.state.exam && fs0.state.exam.pairs.length === 1 && JSON.parse(fs0.state.exam.pairs[0]).priv.d && JSON.parse(fs0.state.exam.pairs[0]).pub === pub, 'the Full save offered there carries the private half of the key');
  await p.click('#xtDone'); await p.waitForTimeout(300);
  check(/Connected to mrshaffer\.org · pairing checked/.test(await text(p, '.xtConn')), 'Tests always says whether it is connected: "Connected … pairing checked"');

  /* ---- 2. the form's responses, pasted; the site's key made again between (review L6: a new site key is not trusted until a trial proves it) ---- */
  await ctl(site, '/__ctl/rotate', {});
  await p.click('#xtPaste'); await p.fill('#xtSheet', fs.readFileSync(FX('responses.tsv'), 'utf8')); await p.waitForTimeout(150);
  check(/38 responses, 37 codes: codes from “Your test code”, names from “Full name”/.test(await text(p, '#xtSheetSay')), 'pasting the sheet says what Tally found in it before anything is fetched: ' + await text(p, '#xtSheetSay'));
  await shot(p, '04-paste-1366');
  await p.evaluate(() => { window.__prog = false; new MutationObserver(() => { const el = document.querySelector('#xtProg'); if (el && /Fetching \d+ of \d+/.test(el.textContent)) window.__prog = true; }).observe(document.body, { subtree: true, childList: true, characterData: true }); });
  // R3-H1: the first half of the sheet, then the second half pasted while the first is still being fetched (the site slow)
  const sheetAll = fs.readFileSync(FX('responses.tsv'), 'utf8').trim().split('\n'); const half = Math.ceil(sheetAll.length / 2);
  site.state.slow = 250; await p.fill('#xtSheet', sheetAll.slice(0, half).join('\n')); await p.click('#xtTake'); await p.waitForTimeout(400); const sawProg = () => p.evaluate(() => window.__prog);
  check(await p.evaluate(() => !!document.querySelector('#xtProg:not(.hidden) .xtSpin')), 'the first half is being fetched (the site answering slowly)');
  await p.click('#xtPaste'); await p.fill('#xtSheet', [sheetAll[0]].concat(sheetAll.slice(half)).join('\n')); await p.click('#xtTake'); await p.waitForTimeout(200);
  const mid = await text(p, '#xtWaiting'), midCount = await text(p, '#xtCount');
  check((mid.match(/Not fetched yet/g) || []).length >= 5 && /tests = \d+ with a student \+ \d+ waiting for you/.test(midCount), 'a second paste while the first is fetched: its codes are queued and listed under Waiting for you as "Not fetched yet", counted in the count line (R3-H1): ' + midCount);
  for (let i = 0; i < 240 && (/Not fetched yet/.test(await text(p, '#gridwrap')) || await p.evaluate(() => !!document.querySelector('#xtProg:not(.hidden) .xtSpin'))); i++) await p.waitForTimeout(250); site.state.slow = 0;
  check(!/Not fetched yet/.test(await text(p, '#gridwrap')), 'the codes are fetched, three at a time, the queued ones in another pass when the first ends: none left'); check(await sawProg(), 'with a visible count while it runs');
  const gets = sent.filter(x => /\/api\/test\/result\//.test(x.url));
  check(gets.length >= 37 && gets.every(x => x.method === 'GET' && !x.body && !/cookie|authorization/i.test(Object.keys(x.headers || {}).join(' ')) && !(x.headers || {}).referer), 'each test is one GET with nothing but its code: no cookie, no referrer, no body (' + gets.length + ')');
  const names = [...F.P4, ...F.P5].flatMap(n => n.toLowerCase().split(/[ ,]+/)).filter(w => w.length > 3);
  check(sent.every(x => !names.some(w => decodeURIComponent(x.url).toLowerCase().includes(w))) && sent.every(x => /^https:\/\/mrshaffer\.org\/api\/test\/(key|result\/[0-9A-Z]{12})$/.test(x.url)), 'every request went to the two routes, and no name was in any of them (' + sent.length + ' requests)');
  check(/the site's key changed: check it with a new trial code/.test(await text(p, '.xtConn')) && /Signed by a key this Tally has not checked: connect to the site once, or run a trial/.test(await text(p, '#gridwrap')) && !/NGUYEN, AVA MARIE\s*\d+\s*\/\s*36/.test(await text(p, '.xtList')), 'the site\'s key made again: Tally says so, and the tests it signed are not scored until a trial proves the key (L6)');
  const oldRow = await p.evaluate(() => [...document.querySelectorAll('.xtList tbody tr')].find(r => /Novak/i.test(r.textContent)).textContent);
  check(/\d+\s*\/\s*36/.test(oldRow), 'the one record signed with the site\'s earlier, proven key is scored (Tereza Novak)');
  await shot(p, '05a-key-changed-1366');
  const tr2 = await ctl(site, '/__ctl/tally', { pub });
  await p.click('#xtConnBtn'); await p.waitForTimeout(200); await p.fill('#xtTrialIn', tr2.code); await p.click('#xtTrialGo'); await p.waitForFunction(c => (document.querySelector('.xtSteps') || {}).innerText && document.querySelector('.xtSteps').innerText.includes(c), H2C(tr2.code));
  check((await p.evaluate(() => [...document.querySelectorAll('.xtWords span')].map(s => s.textContent).join(' '))) === tr2.words, 'a new trial proves the new key: the four words match');
  await p.click('#xtDone'); await p.waitForTimeout(300); for (let i = 0; i < 60 && /Checking/.test(await text(p, '#xtProg')); i++) await p.waitForTimeout(250); await p.waitForTimeout(300);
  check(/pairing checked/.test(await text(p, '.xtConn')) && !/hasn't checked/.test(await text(p, '#gridwrap')), 'every test opens and is checked with the proven key');
  check(await p.locator('.xtFlags:not(.info) li').count() === 3 && /\d+ more/.test(await text(p, '#xtMoreFlags')), 'with many flags, the first three show and the rest are one tap away');
  await p.click('#xtMoreFlags'); await p.waitForTimeout(200);
  const listTxt = await text(p, '#gridwrap'); if (process.env.XDEBUG) { console.log(listTxt); await shot(p, 'dbg-class', true); }
  check(/Two students turned in the same code: Moreau, Camille and Fischer, Hannah/i.test(listTxt) && /No test on the site has the code/.test(listTxt) && /locked to another Tally/.test(listTxt) && /was not signed by the site/.test(listTxt) && /isn.t sure who “Ava”/.test(listTxt) && /has 2 tests/.test(listTxt) && /is not a code/.test(listTxt) && /ended itself/.test(listTxt), 'the class shows every flag of the pasted mess, each with what to do');
  check(/started at 1:05 pm, 3 h 24 min after the rest of the class/.test(listTxt) && /took it alone at 2:30 pm in its own opening/.test(listTxt) && /under Lock after 2 and was never unlocked: the page on that device did not lock/.test(listTxt) && /under End after 3 and the test did not end/.test(listTxt) && /the class's typical time was/.test(listTxt) && /did not finish: the site closed it/.test(listTxt) && /ran out of time \(30 minutes allowed\)/.test(listTxt) && !/at home/.test(listTxt), 'and the review\'s: apart (facts, no "at home"), a make-up note, the rule, a long sitting, closed by the site, out of time');
  check(/“Mikayla Jonson” — JOHNSON, MIKAYLA\?/.test(listTxt) && /“Alex Garcia-Lopez” — GARCIA-LOPEZ, ALEXANDER\?/.test(listTxt) && /No test turned in/.test((await p.evaluate(() => [...document.querySelectorAll('.xtList tbody tr')].find(r => /JOHNSON/.test(r.textContent)).textContent))), 'a forgiving reading is a question ("Mikayla Jonson — Johnson, Mikayla?"), and until he answers the test counts for nobody (H1)');
  const cntTxt = await text(p, '#xtCount'); const cm = /(\d+) tests = (\d+) with a student \+ (\d+) waiting for you \+ (\d+) nobody turned in/.exec(cntTxt);
  check(cm && +cm[1] === +cm[2] + +cm[3] + +cm[4], 'the count line adds up: ' + cntTxt);
  check(!/Abara, Kofi[^\n]*36\s*\/\s*36/i.test(listTxt) && await p.locator('tr[data-xcode]').count() >= 18, 'the forged record (a perfect score) is shown nowhere; the others are rows');
  const hughes = await p.evaluate(() => [...document.querySelectorAll('.xtList tbody tr')].find(r => /Hughes/i.test(r.textContent)).textContent); check(/No test turned in/.test(hughes), 'Caleb Hughes: no test turned in');
  await shot(p, '05-class-1366'); await p.evaluate(() => { const f = [...document.querySelectorAll('.xtFlags li')].find(li => /Mikayla Jonson/.test(li.textContent)); if (f) f.scrollIntoView({ block: 'center' }); }); await shot(p, '05b-suggestion-row-1366');
  // resolve what he is asked
  await p.click('[data-xwho]'); await p.waitForTimeout(200); check(await p.locator('#modal .xtWhos .xtWho').count() >= 2 && /Brooks, Ava/i.test(await text(p, '#modal .xtWhos')), 'who is “Ava”: the two Avas are offered first');
  await p.click('#modal .xtWho:has-text("BROOKS, AVA")'); await p.waitForTimeout(300);
  check(!/isn.t sure who “Ava”/.test(await text(p, '#gridwrap')) && /BROOKS, AVA[\s\S]{0,40}\d+\s*\/\s*36/.test(await text(p, '.xtList')), 'once chosen, the row is Ava Brooks\'s and the question is gone');
  await p.click('[data-xyes][data-n="JOHNSON, MIKAYLA"]'); await p.waitForTimeout(300); await p.click('[data-xyes][data-n="GARCIA-LOPEZ, ALEXANDER"]'); await p.waitForTimeout(300);
  check(/JOHNSON, MIKAYLA[\s\S]{0,40}\d+\s*\/\s*36/.test(await text(p, '.xtList')), 'Yes to a suggestion places the test');
  await p.click('[data-xshare]'); await p.waitForTimeout(200); await p.click('#modal .xtWho:has-text("MOREAU, CAMILLE")'); await p.waitForTimeout(300);
  check(!/same code/.test(await text(p, '#gridwrap')), 'a shared code given to the student it belongs to: the flag is gone');
  await p.click('[data-xtwice]'); await p.waitForTimeout(200); const twoTests = await p.locator('#modal [data-c]').count(); await p.click('#modal [data-c] >> nth=1'); await p.waitForTimeout(300);
  check(twoTests === 2, 'two tests by one student: both offered, the one that counts chosen');
  // Not theirs (review C1): on a row; Nobody yet returns it; then give it back
  await p.evaluate(() => { const r = [...document.querySelectorAll('.xtList tbody tr[data-xcode]')].find(x => /GARCIA-LOPEZ/.test(x.textContent)); r.querySelector('[data-xnot]').click(); }); await p.waitForTimeout(300);
  check(/Who turned this in\?/.test(await text(p, '#modal')) && await p.locator('#modal [data-xextra="nobody"]').count() === 1, '"Not theirs" on a row takes the test off and asks whose it is, "Nobody yet" possible');
  await shot(p, '05c-not-theirs-1366');
  await p.click('#modal [data-xextra="nobody"]'); await p.waitForTimeout(300); if (/more/.test(await text(p, '#xtMoreFlags'))) { await p.click('#xtMoreFlags'); await p.waitForTimeout(150); }
  check(/No test turned in/.test(await p.evaluate(() => [...document.querySelectorAll('.xtList tbody tr')].find(r => /GARCIA-LOPEZ/.test(r.textContent)).textContent)) && /Nobody turned in/.test(await text(p, '#gridwrap')), 'Nobody yet: he has no test, and it is among the tests nobody turned in');
  await p.click('#toast .tundo'); await p.waitForTimeout(300);
  check(/GARCIA-LOPEZ, ALEXANDER[\s\S]{0,40}\d+\s*\/\s*36/.test(await text(p, '.xtList')), 'and Undo puts it back');
  { const cnt0 = await text(p, '#xtCount'); await p.evaluate(() => { const r = [...document.querySelectorAll('.xtList tbody tr[data-xcode]')].find(x => /GARCIA-LOPEZ/.test(x.textContent)); r.querySelector('[data-xnot]').click(); }); await p.waitForTimeout(250);
    await p.click('#modal #mCancel'); await p.waitForTimeout(250);
    check(/GARCIA-LOPEZ, ALEXANDER[\s\S]{0,40}\d+\s*\/\s*36/.test(await text(p, '.xtList')) && await text(p, '#xtCount') === cnt0, 'Not theirs, then Cancel: the test stays exactly where it was (R2-C2): ' + cnt0); }
  await p.click('#xtPeriod'); await p.fill('#xtFrom', '09:40'); await p.fill('#xtTo', '10:40'); await p.click('#xtPerSave'); await p.waitForTimeout(300);
  check(/outside the class period \(9:40 am–10:40 am\)/.test(await text(p, '#gridwrap')), 'with the period\'s times set, a start or finish outside them is flagged, in one clock style');
  // what Tally remembers, and dismissed flags, in one quiet place
  await p.click('[data-xdis] >> nth=0'); await p.waitForTimeout(250);
  await p.click('.xtQuiet summary'); await p.waitForTimeout(150);
  if (process.env.XDEBUG) console.log('QUIET', await text(p, '.xtQuiet'));
  check(/What Tally remembers \(3\) · dismissed \(1\)/.test(await text(p, '.xtQuiet')) && /“ava” is BROOKS, AVA/.test(await text(p, '.xtQuietBody')) && await p.locator('[data-xundis]').count() === 1, 'one quiet place: the names he answered ("ava" is BROOKS, AVA, and his two Yes answers) and the dismissed flag, each with a way back');
  await p.evaluate(() => document.querySelector('.xtQuiet').scrollIntoView({ block: 'center' })); await shot(p, '05d-quiet-place-1366');
  await p.click('[data-xundis]'); await p.waitForTimeout(200);
  await shot(p, '06-class-resolved-1366');

  /* ---- 3. one test, whole ---- */
  const openTest = async who => { await p.evaluate(w => { const r = [...document.querySelectorAll('.xtList tbody tr[data-xcode]')].find(x => x.textContent.includes(w)); r.click(); }, who); await p.waitForTimeout(400); };
  await openTest("O'NEIL");
  const d = await text(p, '#gridwrap');
  const nVis = await p.locator('svg.xtTimeline rect.vis').count(), nQl = await p.locator('svg.xtTimeline text.ql').count();
  check(/The sitting/i.test(d) && nVis > 15 && nQl === 18, `the detail opens on the timeline: every question a row (${nQl}), every visit drawn (${nVis})`);
  check(/Scratch paper at Finish/i.test(d) && await p.locator('.xtPaper svg.xtGrid').count() >= 1 && await p.locator('.xtPaper pre').count() >= 1, 'scratch paper at Finish: the notes as text, the grid drawn');
  check(/evidence, not proof/.test(d) && /the site's own/.test(d), 'one honest line: what is the site\'s and what is the device\'s account');
  const nTr = await p.locator('.xtQs tbody tr').count(); check(nTr === 20 && /Every value it held/i.test(d), `every part of every question (${nTr} rows), with what was typed, the result, the key, the time on it`);
  check(await p.locator('#bar #xtBack').count() === 1 && /‹ Tests/.test(await text(p, '#bar')), 'a crumb back to the class');
  await shot(p, '07-detail-heavy-scratch-1366'); await shot(p, '07-detail-heavy-scratch-1366-full', true);
  await p.click('.xtQs details summary >> nth=0'); await p.waitForTimeout(100); check(await p.locator('.xtQs details[open] li').count() >= 1, 'a part\'s values open to every value it held and how');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); check(await p.locator('.xtList').count() === 1, 'Escape goes back to the class');
  await openTest('BROOKS, AVA'); check(/Left the test\s*12 times/i.test(await text(p, '.xtFacts')) && await p.locator('svg.xtTimeline rect.away').count() === 12 && /out of full screen|reloaded the page/.test(await text(p, '#gridwrap')), 'twelve times away, each in the list with its kind and drawn on the timeline');
  await shot(p, '08-detail-away-1366', true); await p.click('#xtBack'); await p.waitForTimeout(250);
  await openTest('WHITAKER'); check(/45 visits after the first 300 are not drawn/.test(await text(p, '#gridwrap')) && /7 more not kept/.test(await text(p, '#gridwrap')), 'a capped log says what was not kept');
  await p.click('#xtBack'); await p.waitForTimeout(250);
  await openTest('OKAFOR'); check(/no log/i.test(await text(p, '.xtFacts')) && /This device sent no log \(or one too large to keep\)/.test(await text(p, '#gridwrap')), 'a null log: the site\'s part only, and says so');
  await p.click('#xtBack'); await p.waitForTimeout(250);
  await openTest('LINDQVIST'); check(/not reported/.test(await text(p, '#gridwrap')), 'fields the device could not fill read "not reported"');
  await p.click('#xtBack'); await p.waitForTimeout(250);

  /* ---- 4. Hide names ---- */
  await p.click('#btnHide'); await p.waitForTimeout(300);
  const hiddenList = await text(p, '#gridwrap'); await openTest('O.'); const hiddenDetail = await text(p, '#gridwrap');
  const full = [...F.P4, ...F.P5].map(n => n.split(', ')[0]).filter(n => n.length > 3);
  check(!full.some(n => hiddenList.toLowerCase().includes(n.toLowerCase())) && !full.some(n => hiddenDetail.toLowerCase().includes(n.toLowerCase())) && /[A-Z]\. [A-Z]\./.test(hiddenList), 'with names hidden, Tests shows initials only, in the list, the flags and the test');
  await shot(p, '09-hidden-names-1366'); await p.click('#xtBack'); await p.waitForTimeout(200); await p.click('#btnHide'); await p.waitForTimeout(300);

  /* ---- 5. Copy scores, the way IXL goes to Focus ---- */
  await p.evaluate(() => { window.__copied = null; const o = document.execCommand.bind(document); document.execCommand = c => { if (c === 'copy') { window.__copied = document.activeElement && document.activeElement.value; return true; } return o(c); }; });
  await p.click('#xtCopy'); await p.waitForTimeout(300);
  const copied = await p.evaluate(() => window.__copied); const lines = (copied || '').split('\n');
  const gbOrder = fs.readFileSync(FX('focus_gradebook_p4.csv'), 'utf8').split('\n').filter(l => /^"33333/.test(l)).map(l => l.split('","')[2]);
  const want = gbOrder.map(N => F.P4.find(x => x.toUpperCase() === N));
  const scoreOf = async dn => p.evaluate(dn => { const r = [...document.querySelectorAll('.xtList tbody tr')].find(x => x.querySelector('.nm') && x.querySelector('.nm').textContent.toLowerCase() === dn.toLowerCase()); const b = r && r.querySelector('.xtScore b'); return b ? b.textContent : ''; }, dn);
  let same = lines.length === 28; for (let i = 0; i < 28 && same; i++) { const s = await scoreOf(want[i]); if ((lines[i] || '') !== s) { same = false; console.log('row', i, want[i], JSON.stringify(lines[i]), JSON.stringify(s)); } }
  check(same, 'Copy scores: 28 lines in the Focus gradebook\'s order, each the score on screen, blank for no test');
  check(/copied: 28 rows in the Focus gradebook's order/.test(await text(p, '#toast')) && /out of 36/.test(await text(p, '#toast')), 'and says so: ' + (await text(p, '#toast')).slice(0, 120));

  /* ---- 5b. a new session: Copy pressed while every test is being checked again waits for the check (R2-M3) ---- */
  const reopen = async () => { await p.reload(); await p.waitForTimeout(300); await toTests(p, '4th'); };
  await p.addInitScript(() => { window.__copied = null; const o = document.execCommand.bind(document); document.execCommand = c => { if (c === 'copy') { window.__copied = document.activeElement && document.activeElement.value; return true; } return o(c); }; });
  await reopen(); await p.click('#xtCopy'); const midCheck = /Checking \d+ of \d+ tests/.test(await text(p, '#toast'));
  for (let i = 0; i < 80 && (await p.evaluate(() => window.__copied)) == null; i++) await p.waitForTimeout(150);
  check(await p.evaluate(() => window.__copied) === copied, 'Copy pressed at once in a new session waits for the check and copies the whole column, never a partial one (R2-M3)' + (midCheck ? ', saying "Checking N of M tests…" meanwhile' : ''));
  /* ---- 5c. a locked copy lost from IndexedDB: waiting, "Fetch again" really fetches it, and it scores again (R2-H2) ---- */
  { const lost = await p.evaluate(async () => { const code = [...document.querySelectorAll('.xtList tbody tr[data-xcode]')].find(r => /O'NEIL, BRENNAN/.test(r.textContent)).dataset.xcode;
      await new Promise(res => { const q = indexedDB.open('tally-tests', 1); q.onsuccess = () => { const tx = q.result.transaction('locked', 'readwrite'); tx.objectStore('locked').delete(code); tx.oncomplete = () => { q.result.close(); res(); }; tx.onerror = res; }; }); return code; });
    await reopen(); for (let i = 0; i < 80 && /Checking/.test(await text(p, '#xtProg')); i++) await p.waitForTimeout(200); await p.waitForTimeout(200);
    const before = sent.length; const tw = await text(p, '#xtWaiting');
    check(/Its locked copy is missing from this browser: fetch it again\. It is O'NEIL, BRENNAN's/.test(tw) && /O'NEIL, BRENNAN[\s\S]{0,20}Its test is waiting for you/.test(await text(p, '.xtList')), 'a test whose locked copy is gone from the browser is waiting for him ("fetch it again"), and its student\'s row says so (R2-H2)');
    await p.click(`#xtWaiting [data-xrefetch="${lost}"]`); await fetched(p); await p.waitForTimeout(300);
    check(sent.slice(before).some(x => x.url.endsWith('/api/test/result/' + lost)) && /O'NEIL, BRENNAN\s*\d+\s*\/\s*36/.test(await text(p, '.xtList')) && !/locked copy is missing/.test(await text(p, '#gridwrap')), 'Fetch again asks the site for that code, and it opens, checks and scores again (R2-H2)'); }

  /* ---- 6. a Full save carries the key and the records; a Board save carries neither ---- */
  const [dl1] = await Promise.all([p.waitForEvent('download'), p.click('#btnFullSave')]); const fpath = path.join(tmp, 'full-tests.json'); await dl1.saveAs(fpath);
  const fsave = JSON.parse(fs.readFileSync(fpath, 'utf8')); const held = Object.keys(fsave.state.exam.recs || {}).length, locked = Object.keys(fsave.state.exam.locked || {}).length;
  check(fsave.state.exam.pairs.length === 1 && held >= 30 && locked === held && fsave.state.exam.sites.length === 2 && Object.values(fsave.state.exam.locked).every(t => /^[A-Za-z0-9_-]{200,}$/.test(t)), `the Full save holds the key, both site keys, every test and every test's locked text (${held} tests, ${locked} locked texts)`);
  check(!/"r":\{"v":1/.test(fs.readFileSync(fpath, 'utf8')) && !/"points":/.test(JSON.stringify(fsave.state.exam.locked)), 'and no opened record: what it keeps of a test is the site\'s locked text (C4)');
  await p.click('#actBtn'); await p.waitForTimeout(150); const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#mBoardSave')]); const bpath = path.join(tmp, 'board.json'); await dl2.saveAs(bpath);
  const board = fs.readFileSync(bpath, 'utf8'); check(!/TALLY1\.|"exam"|"exams"|"pairs"|"kty"/.test(board), 'the Board save holds no key and no test');
  const results = await ctl(site, '/__ctl/results'); fs.writeFileSync(path.join(tmp, 'results.json'), JSON.stringify(results));
  await ctx.close();

  /* ---- 6b. R3-C1: a site key in a Full save is trusted only when the site serves it now (or a trial proved it here) ---- */
  { const SEAL = require('../vendor/seal.js'); const ed = JSON.parse(fs.readFileSync(fpath, 'utf8')); const ex = ed.state.exam; const pair = JSON.parse(ex.pairs[0]); const forger = await SEAL.makeSiteKey();
    const base = Object.values(ex.recs).find(e => e.who && e.sum); const R0 = JSON.parse(fs.readFileSync(FX('records.json'), 'utf8'))[0].record; const fake = JSON.parse(JSON.stringify(R0)); fake.code = SEAL.newCode(); fake.points = fake.of;
    ex.locked[fake.code] = await SEAL.seal(fake, forger.priv, pair.pub); ex.recs[fake.code] = { ...base, who: { sec: base.who.sec, n: 'HUGHES, CALEB', how: 'you', at: new Date().toISOString() }, sum: { ...base.sum, points: fake.of } };
    ex.sites.push({ key: forger.pub, made: Date.now(), got: new Date().toISOString(), paired: new Date().toISOString() }); const epath = path.join(tmp, 'edited-full.json'); fs.writeFileSync(epath, JSON.stringify(ed));
    const o = await open(SHIP); const q = o.p; await q.setInputFiles('#file', [epath]); await q.waitForTimeout(900); await toTests(q, '4th');
    for (let i = 0; i < 80 && /Checking/.test(await text(q, '#xtProg')); i++) await q.waitForTimeout(250); await q.waitForTimeout(300);
    const w = await text(q, '#xtWaiting'), shownCode = SEAL.showCode(fake.code);
    check(await q.locator(`tr[data-xcode="${fake.code}"]`).count() === 0 && w.includes(shownCode) && /Signed by a key this Tally has not checked: connect to the site once, or run a trial/.test(w) && await q.locator('tr[data-xcode]').count() >= 22,
      'an edited Full save that brings its own "paired" site key and a test sealed with it, opened in a fresh browser: the made-up test is never scored, it waits as "signed by a key this Tally has not checked"; the genuine tests score (the site serves their key) (R3-C1)');
    await o.ctx.close(); }
  // the save opened with the network off: nothing scored, said plainly; the site answering later clears it by itself
  { const o = await open(SHIP); const q = o.p; await o.ctx.setOffline(true); site.state.down = true;
    await q.setInputFiles('#file', [fpath]); await q.waitForTimeout(900); await toTests(q, '4th'); await q.waitForTimeout(600);
    check(/not checked yet: the site could not be reached/.test(await text(q, '.xtConn')) && await q.locator('tr[data-xcode]').count() === 0 && /Signed by a key this Tally has not checked/.test(await text(q, '#xtWaiting')), 'opened with the network off: Connect says the save\'s pairing is not checked yet (the site could not be reached), and nothing is scored (R3-C1): ' + (await text(q, '.xtConn')).slice(0, 120));
    await o.ctx.setOffline(false); site.state.down = false; for (let i = 0; i < 60 && await q.locator('tr[data-xcode]').count() < 22; i++) await q.waitForTimeout(250);
    check(await q.locator('tr[data-xcode]').count() >= 22 && /checked with the site today/.test(await text(q, '.xtConn')), 'and when the network is back it clears by itself: one request to the site, and every test scores');
    await o.ctx.close(); }

  /* ---- 7. a fresh Tally: the Full save, then the cockpit's file with the network off ---- */
  for (const [vp, tag] of [[{ width: 1366, height: 768 }, '1366'], [{ width: 1920, height: 1080 }, '1920']]) for (const dark of [false, true]) {
    const o = await open(SHIP, { vp, dark }); const q = o.p;
    await q.setInputFiles('#file', [fpath]); await q.waitForTimeout(900);
    if (await q.evaluate(() => document.querySelector('#btnHide').getAttribute('aria-pressed') === 'false')) { await q.click('#btnHide'); await q.waitForTimeout(200); }   // a Full save opened on an empty Tally keeps names hidden (as it always has)
    await toTests(q, '4th');
    if (process.env.XDEBUG && tag === '1366' && !dark) console.log('FRESH0', await text(q, '.xtConn'), await q.locator('tr[data-xcode]').count());
    for (let i = 0; i < 80 && /Checking/.test(await text(q, '#xtProg')); i++) await q.waitForTimeout(250); await q.waitForTimeout(200);
    if (tag === '1366' && !dark) check(/Connected to mrshaffer\.org \(from your Full save of [^)]*, checked with the site today\)/.test(await text(q, '.xtConn')) && await q.locator('tr[data-xcode]').count() >= 22, 'a fresh Tally that opens the Full save scores every test at once: no trial, no new key, nothing to paste (R2-H3): ' + await text(q, '.xtConn'));
    if (tag === '1366' && !dark) { await q.click('#xtConnBtn'); await q.waitForTimeout(200);
      await shot(q, '15-connect-from-save-1366');
      check(/Connected \(from your Full save of [^)]*\)\. The save brought this Tally's key/.test(await text(q, '.xtSteps')) && await q.locator('#xtKey').count() === 0, 'Connect says it is connected from the Full save, and offers no key "to paste" (R2-H3)');
      await q.click('#xtDone'); await q.waitForTimeout(300); }
    if (tag === '1366' && !dark) {
      if (process.env.XDEBUG) { await shot(q, 'dbg-fresh', true); console.log('FRESH', (await text(q, '#gridwrap')).slice(0, 600)); }
      check(await q.locator('tr[data-xcode]').count() >= 22, 'the fresh Tally holds every test from the save, checked');
      await o.ctx.setOffline(true); site.state.down = true; const before = sent.length;
      await q.setInputFiles('#file', [path.join(tmp, 'results.json')]); await q.waitForTimeout(1500); if (await q.$('#xtMoreFlags')) { await q.click('#xtMoreFlags'); await q.waitForTimeout(200); }
      const t2 = await text(q, '#gridwrap');
      check(/Nobody turned in/.test(t2) && before >= 0, 'the cockpit\'s results file opens with the network off; the tests nobody turned in appear');
      check(/opened/.test(await text(q, '#toast')), 'and says what it opened: ' + (await text(q, '#toast')).slice(0, 140));
      await q.click('[data-xgive]'); await q.waitForTimeout(200); check(await q.locator('#modal .xtAll .xtWho').count() === 28, 'giving a test: the class\'s own students are listed, anyone else is a search away'); await q.fill('#xtFind', 'hughes'); await q.waitForTimeout(100); await q.click('#modal .xtWho:has-text("HUGHES, CALEB")'); await q.waitForTimeout(300).catch(() => {});
      const caleb = await q.evaluate(() => [...document.querySelectorAll('.xtList tbody tr')].find(r => /Hughes/i.test(r.textContent)).textContent);
      check(/\d+\s*\/\s*36/.test(caleb), 'a test nobody turned in, given to the student: it is his now');
      await q.evaluate(() => [...document.querySelectorAll('.xtList tbody tr[data-xcode]')].find(r => /Hughes/i.test(r.textContent)).click()); await q.waitForTimeout(300);
      check(/You gave this test to HUGHES, CALEB/.test(await text(q, '.xtOwn')) && /checked with the site's signature today/.test(await text(q, '.xtRec')) && /opening of 9:38 am/.test(await text(q, '.xtFacts')) && /120 minutes allowed/.test(await text(q, '.xtFacts')), 'his test says it was given by hand, with its opening and times');
      await q.click('#xtNotD'); await q.waitForTimeout(300); await q.click('#modal [data-xextra="nobody"]'); await q.waitForTimeout(300); if (/more/.test(await text(q, '#xtMoreFlags'))) { await q.click('#xtMoreFlags'); await q.waitForTimeout(150); }
      const back = await q.evaluate(() => [...document.querySelectorAll('.xtList tbody tr')].find(r => /Hughes/i.test(r.textContent)).textContent); if (process.env.XDEBUG) console.log('BACK', back, (await text(q, '#gridwrap')).split('Nobody turned in').length - 1, await text(q, '#toast'));
      check(/No test turned in/.test(back) && (await text(q, '#gridwrap')).split('Nobody turned in').length - 1 >= 4, 'Not theirs, then Nobody yet: he has no test again and it is back among the tests nobody turned in');
      await q.click('[data-xgive]'); await q.waitForTimeout(200); await q.fill('#xtFind', 'hughes'); await q.waitForTimeout(100); await q.click('#modal .xtWho:has-text("HUGHES, CALEB")'); await q.waitForTimeout(300);
      site.state.down = false; await o.ctx.setOffline(false);
    }
    await q.evaluate(() => window.scrollTo(0, 0)); await shot(q, `10-class-${tag}${dark ? '-dark' : ''}`);
    await q.evaluate(() => { const r = [...document.querySelectorAll('.xtList tbody tr[data-xcode]')].find(x => /Garcia-Lopez/i.test(x.textContent)); r.click(); }); await q.waitForTimeout(400);
    await shot(q, `11-detail-${tag}${dark ? '-dark' : ''}`); if (!dark) await shot(q, `11-detail-${tag}-full`, true);
    const over = await q.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); check(!over, `${tag}${dark ? ' dark' : ''}: no sideways scrolling in a test's detail`);
    await o.ctx.close();
  }

  /* ---- 8. the test build: the address setting, a network that is gone, no Web Crypto ---- */
  {
    const o = await open(APP); const q = o.p; await importClasses(q); await toTests(q, '5th');
    await q.click('.xtMore summary'); await q.fill('#xtSite', site.url); await q.click('#xtSiteSave'); await q.waitForTimeout(200);
    await q.click('.xtMore summary').catch(() => {}); check(/may reach https:\/\/mrshaffer\.org, http:\/\/127\.0\.0\.1:\*/.test(await text(q, '.xtMoreBody')), 'the address is a setting; it says which addresses this copy may reach');
    await q.click('#xtMake'); await q.waitForSelector('#xtKey'); const pub2 = (await text(q, '#xtKey')).trim(); const tr2 = await ctl(site, '/__ctl/tally', { pub: pub2 });
    await q.fill('#xtTrialIn', tr2.code); await q.click('#xtTrialGo'); await q.waitForSelector('.xtWords'); check((await q.evaluate(() => [...document.querySelectorAll('.xtWords span')].map(s => s.textContent).join(' '))) === tr2.words, 'pointed at a stand-in on this machine, the trial opens and the words match');
    await q.click('#xtDone'); await q.waitForTimeout(200);
    site.state.down = true;
    await q.click('#xtPaste'); await q.fill('#xtSheet', fs.readFileSync(FX('responses.csv'), 'utf8')); await q.click('#xtTake'); await fetched(q); await q.waitForTimeout(300);
    check(/codes couldn't reach the site's test records/.test(await text(q, '#gridwrap')) && await q.locator('[data-xretry]').count() === 1, 'with the network gone: one note for the batch, and Try again (M3)');
    site.state.down = false; await q.click('[data-xretry]'); await fetched(q); await q.waitForTimeout(300);
    check(!/couldn't reach the site's test records/.test(await text(q, '#gridwrap')) && await q.locator('tr[data-xcode]').count() === 6, 'Try again with the network back: every 5th Period test fetched');
    // a genuinely signed record full of a student's own strings: shown as text, inert
    await q.evaluate(() => [...document.querySelectorAll('.xtList tbody tr[data-xcode]')].find(r => /QUINLAN/i.test(r.textContent)).click()); await q.waitForTimeout(500);
    const inert = await q.evaluate(() => ({ title: document.title, imgs: document.querySelectorAll('#gridwrap img').length, scripts: document.querySelectorAll('#gridwrap script').length, onerr: document.querySelectorAll('#gridwrap [onerror]').length, txt: document.querySelector('#gridwrap').innerText, wide: document.documentElement.scrollWidth > innerWidth + 1 }));
    check(!/pwned/.test(inert.title) && inert.imgs === 0 && inert.scripts === 0 && inert.onerr === 0 && inert.txt.includes('<img src=x onerror=') && inert.txt.includes('</script><script>') && /more characters\)/.test(inert.txt) && !inert.wide, 'a record\'s markup, a closing script tag, a 200-character run, right-to-left and zero-width text and a 2 KB answer are all shown as inert text, cut where long, and nothing runs');
    await shot(q, '13-hostile-record-1366', true); await q.click('#xtBack'); await q.waitForTimeout(250);
    const st = await q.evaluate(() => window.__tally && JSON.parse(localStorage.getItem('tally.v1')).exam.sites.length); check(st >= 1, 'the site key is kept in Tally\'s data');
    await q.click('.xtConn .linkbtn'); await q.waitForTimeout(200); await q.click('.xtMore summary'); await q.fill('#xtSite', 'https://example.org'); await q.click('#xtSiteSave'); await q.waitForTimeout(200); await q.click('.xtMore summary').catch(() => {});
    check(/may only reach/.test(await text(q, '.xtMoreBody')), 'an address this copy may not reach is said to be refused, before anything is tried');
    await o.ctx.close();
    const o2 = await open(APP, { init: () => { delete window.DecompressionStream; } }); const q2 = o2.p;
    await q2.setInputFiles('#file', [fpath]); await q2.waitForTimeout(900); await toTests(q2, '4th');
    const t3 = await text(q2, '#gridwrap');
    check(/This browser can't open test records here/.test(t3) && await q2.locator('tr[data-xcode]').count() === 0 && /This browser can't check test records here: open Tally on your laptop/.test(t3) && /Waiting for you/.test(t3), 'without the platform\'s deflate: Tests says so plainly, and scores nothing it can\'t check (each test is said to be waiting)');
    await shot(q2, '12-no-webcrypto-1366');
    await q2.click('#xtPaste'); await q2.fill('#xtSheet', 'Ana Test\tK7QF-2M9D-X4TB'); await q2.click('#xtTake'); await q2.waitForTimeout(400);
    check(/can.t open test records here/.test(await text(q2, '#toast')), 'and asking it to fetch says why it can\'t, nothing breaks');
    await o2.ctx.close();
  }
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close(); await site.close(); done();
})().catch(e => { console.error(e); check(false, 'crashed: ' + (e && e.message)); done(); process.exit(1); });
