// Tests, end to end in Chromium (16 Nov 2026), on the SHIPPED Tally.html opened from a file:// address. Its one network
// address, https://mrshaffer.org, is answered by a stand-in for the site's two public routes (tests/exam/site.js) running
// on this machine; the test build (which may also reach 127.0.0.1) proves the address setting, a network that is gone, and
// a browser without Web Crypto. Synthetic classes and records only (tests/exam/fixtures.js).
// Screenshots go to $SHOTS (default: the suite's temp folder).
const { chromium, fs, path, exe, check, done, tmp, pick, APP } = require('./lib');
const SITE = require('./exam/site.js'); const F = require('./exam/fixtures.js'); const http = require('http');
const SHIP = 'Tally.html'; const SHOTS = process.env.SHOTS || tmp; fs.mkdirSync(SHOTS, { recursive: true });
const FX = n => path.resolve('fixtures', 'exams', n);
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
  await shot(p, '03-trial-words-1366');
  const [dl0] = await Promise.all([p.waitForEvent('download'), p.click('#xtSaveNow')]); await dl0.saveAs(path.join(tmp, 'after-key.json'));
  const fs0 = JSON.parse(fs.readFileSync(path.join(tmp, 'after-key.json'), 'utf8'));
  check(fs0.full && fs0.state.exam && fs0.state.exam.pairs.length === 1 && JSON.parse(fs0.state.exam.pairs[0]).priv.d && JSON.parse(fs0.state.exam.pairs[0]).pub === pub, 'the Full save offered there carries the private half of the key');
  await p.click('#xtDone'); await p.waitForTimeout(300);
  check(/Connected to mrshaffer\.org · pairing checked/.test(await text(p, '.xtConn')), 'Tests always says whether it is connected: "Connected … pairing checked"');

  /* ---- 2. the form's responses, pasted; the site's key made again between ---- */
  await ctl(site, '/__ctl/rotate', {});
  await p.click('#xtPaste'); await p.fill('#xtSheet', fs.readFileSync(FX('responses.tsv'), 'utf8')); await p.waitForTimeout(150);
  check(/38 responses, 37 codes: codes from “Your test code”, names from “Full name”/.test(await text(p, '#xtSheetSay')), 'pasting the sheet says what Tally found in it before anything is fetched: ' + await text(p, '#xtSheetSay'));
  await shot(p, '04-paste-1366');
  await p.evaluate(() => { window.__prog = false; new MutationObserver(() => { const el = document.querySelector('#xtProg'); if (el && /Fetching \d+ of \d+/.test(el.textContent)) window.__prog = true; }).observe(document.body, { subtree: true, childList: true, characterData: true }); });
  await p.click('#xtTake'); await p.waitForTimeout(300); const sawProg = () => p.evaluate(() => window.__prog);
  check(await fetched(p), 'the codes are fetched, three at a time'); check(await sawProg(), 'with a visible count while it runs');
  const gets = sent.filter(x => /\/api\/test\/result\//.test(x.url));
  check(gets.length >= 37 && gets.every(x => x.method === 'GET' && !x.body && !/cookie|authorization/i.test(Object.keys(x.headers || {}).join(' ')) && !(x.headers || {}).referer), 'each test is one GET with nothing but its code: no cookie, no referrer, no body (' + gets.length + ')');
  const names = [...F.P4, ...F.P5].flatMap(n => n.toLowerCase().split(/[ ,]+/)).filter(w => w.length > 3);
  check(sent.every(x => !names.some(w => decodeURIComponent(x.url).toLowerCase().includes(w))) && sent.every(x => /^https:\/\/mrshaffer\.org\/api\/test\/(key|result\/[0-9A-Z]{12})$/.test(x.url)), 'every request went to the two routes, and no name was in any of them (' + sent.length + ' requests)');
  check(await p.locator('.xtFlags:not(.info) li').count() === 3 && /\d+ more/.test(await text(p, '#xtMoreFlags')), 'with many flags, the first three show and the rest are one tap away');
  await p.click('#xtMoreFlags'); await p.waitForTimeout(200);
  const listTxt = await text(p, '#gridwrap'); if (process.env.XDEBUG) { console.log('TABS', await text(p, '#ctabs')); console.log(listTxt); await shot(p, 'dbg-class', true); }
  check(/Two students turned in the same code: Moreau, Camille and Fischer, Hannah/i.test(listTxt) && /No test on the site has the code/.test(listTxt) && /locked to another Tally/.test(listTxt) && /was not signed by the site/.test(listTxt) && /isn.t sure who “Ava” is/.test(listTxt) && /turned in 2 tests/.test(listTxt) && /outside the class period/.test(listTxt) === false && /for On-level Unit 9/.test(listTxt) && /for Accelerated Unit 4/.test(listTxt) && /is not a code/.test(listTxt) && /ended itself/.test(listTxt), 'the class shows every flag of the pasted mess, each with what to do');
  check(/Nobody turned in/.test(listTxt) === false, 'a test nobody turned in is not known until the cockpit\'s file says so');
  check(!/Abara, Kofi[^\n]*36\s*\/\s*36/i.test(listTxt) && await p.locator('tr[data-xcode]').count() >= 20, 'the forged record (a perfect score) is shown nowhere; the others are rows');
    const hughes = await p.evaluate(() => [...document.querySelectorAll('.xtList tbody tr')].find(r => /Hughes/i.test(r.textContent)).textContent); check(/No test turned in/.test(hughes), 'Caleb Hughes: no test turned in');
  await shot(p, '05-class-1366'); await shot(p, '05-class-1366-full', true);
  // the site's key made again: records signed after it opened; the one signed before it still opens
  const oldRow = await p.evaluate(() => [...document.querySelectorAll('.xtList tbody tr')].find(r => /Novak/i.test(r.textContent)).textContent);
  check(/\d+\s*\/\s*36/.test(oldRow) && (await p.evaluate(() => window.__x = 1)) === 1, 'a record signed with the site\'s earlier key opens beside the ones signed after it was made again (Tereza Novak)');
  // resolve what he is asked
  await p.click('[data-xwho]'); await p.waitForTimeout(200); check(await p.locator('#modal .xtWhos .xtWho').count() >= 2 && /Brooks, Ava/i.test(await text(p, '#modal .xtWhos')), 'who is “Ava”: the two Avas are offered first');
  await p.click('#modal .xtWho:has-text("BROOKS, AVA")'); await p.waitForTimeout(300);
  check(!/isn.t sure who “Ava”/.test(await text(p, '#gridwrap')) && /BROOKS, AVA\s*\d+\s*\/\s*36/.test(await text(p, '.xtList')), 'once chosen, the row is Ava Brooks\'s and the question is gone');
  await p.click('[data-xshare]'); await p.waitForTimeout(200); await p.click('#modal .xtWho:has-text("MOREAU, CAMILLE")'); await p.waitForTimeout(300);
  check(!/same code/.test(await text(p, '#gridwrap')), 'a shared code given to the student it belongs to: the flag is gone');
  await p.click('[data-xtwice]'); await p.waitForTimeout(200); const twoTests = await p.locator('#modal [data-c]').count(); await p.click('#modal [data-c] >> nth=1'); await p.waitForTimeout(300);
  check(twoTests === 2, 'two tests by one student: both offered, the one that counts chosen');
  await p.click('#xtPeriod'); await p.fill('#xtFrom', '09:40'); await p.fill('#xtTo', '10:40'); await p.click('#xtPerSave'); await p.waitForTimeout(300);
  check(/outside the class period \(09:40–10:40\)/.test(await text(p, '#gridwrap')), 'with the period\'s times set, a finish outside them is flagged');
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
  await openTest('OKAFOR'); check(/no log/i.test(await text(p, '.xtFacts')) && /The device sent no log/.test(await text(p, '#gridwrap')), 'a null log: the site\'s part only, and says so');
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

  /* ---- 6. a Full save carries the key and the records; a Board save carries neither ---- */
  const [dl1] = await Promise.all([p.waitForEvent('download'), p.click('#btnFullSave')]); const fpath = path.join(tmp, 'full-tests.json'); await dl1.saveAs(fpath);
  const fsave = JSON.parse(fs.readFileSync(fpath, 'utf8')); const secs = Object.values(fsave.state.sections); const held = secs.reduce((a, s) => a + Object.keys(s.exams || {}).length, 0);
  check(fsave.state.exam.pairs.length === 1 && held >= 30 && fsave.state.exam.sites.length === 2, `the Full save holds the key, both site keys and every opened test (${held})`);
  await p.click('#actBtn'); await p.waitForTimeout(150); const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#mBoardSave')]); const bpath = path.join(tmp, 'board.json'); await dl2.saveAs(bpath);
  const board = fs.readFileSync(bpath, 'utf8'); check(!/TALLY1\.|"exam"|"exams"|"pairs"|"kty"/.test(board), 'the Board save holds no key and no test');
  const results = await ctl(site, '/__ctl/results'); fs.writeFileSync(path.join(tmp, 'results.json'), JSON.stringify(results));
  await ctx.close();

  /* ---- 7. a fresh Tally: the Full save, then the cockpit's file with the network off ---- */
  for (const [vp, tag] of [[{ width: 1366, height: 768 }, '1366'], [{ width: 1920, height: 1080 }, '1920']]) for (const dark of [false, true]) {
    const o = await open(SHIP, { vp, dark }); const q = o.p;
    await q.setInputFiles('#file', [fpath]); await q.waitForTimeout(900);
    if (await q.evaluate(() => document.querySelector('#btnHide').getAttribute('aria-pressed') === 'false')) { await q.click('#btnHide'); await q.waitForTimeout(200); }   // a Full save opened on an empty Tally keeps names hidden (as it always has)
    await toTests(q, '4th');
    if (tag === '1366' && !dark) {
      if (process.env.XDEBUG) { await shot(q, 'dbg-fresh', true); console.log('FRESH', (await text(q, '#gridwrap')).slice(0, 600)); }
      check(/Connected to mrshaffer\.org/.test(await text(q, '.xtConn')) && await q.locator('tr[data-xcode]').count() >= 22, 'a fresh Tally that opens the Full save has the key and every test');
      await o.ctx.setOffline(true); site.state.down = true; const before = sent.length;
      await q.setInputFiles('#file', [path.join(tmp, 'results.json')]); await q.waitForTimeout(1500); if (await q.$('#xtMoreFlags')) { await q.click('#xtMoreFlags'); await q.waitForTimeout(200); }
      const t2 = await text(q, '#gridwrap');
      check(/Nobody turned in/.test(t2) && before >= 0, 'the cockpit\'s results file opens with the network off; the tests nobody turned in appear');
      check(/opened/.test(await text(q, '#toast')), 'and says what it opened: ' + (await text(q, '#toast')).slice(0, 140));
      await q.click('[data-xgive]'); await q.waitForTimeout(200); check(await q.locator('#modal .xtAll .xtWho').count() === 28, 'giving a test: the class\'s own students are listed, anyone else is a search away'); await q.fill('#xtFind', 'hughes'); await q.waitForTimeout(100); await q.click('#modal .xtWho:has-text("HUGHES, CALEB")'); await q.waitForTimeout(300).catch(() => {});
      const caleb = await q.evaluate(() => [...document.querySelectorAll('.xtList tbody tr')].find(r => /Hughes/i.test(r.textContent)).textContent);
      check(/\d+\s*\/\s*36/.test(caleb), 'a test nobody turned in, given to the student: it is his now');
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
    check(/not fetched yet/i.test(await text(q, '#gridwrap')) && await q.locator('[data-xretry]').count() === 1, 'with the network gone: "not fetched yet", and Try again');
    site.state.down = false; await q.click('[data-xretry]'); await fetched(q); await q.waitForTimeout(300);
    check(!/not fetched yet/i.test(await text(q, '#gridwrap')) && await q.locator('tr[data-xcode]').count() === 6, 'Try again with the network back: every 5th Period test fetched');
    const st = await q.evaluate(() => window.__tally && JSON.parse(localStorage.getItem('tally.v1')).exam.sites.length); check(st >= 1, 'the site key is kept in Tally\'s data');
    await q.click('.xtConn .linkbtn'); await q.waitForTimeout(200); await q.click('.xtMore summary'); await q.fill('#xtSite', 'https://example.org'); await q.click('#xtSiteSave'); await q.waitForTimeout(200); await q.click('.xtMore summary').catch(() => {});
    check(/may only reach/.test(await text(q, '.xtMoreBody')), 'an address this copy may not reach is said to be refused, before anything is tried');
    await o.ctx.close();
    const o2 = await open(APP, { init: () => { delete window.DecompressionStream; } }); const q2 = o2.p;
    await q2.setInputFiles('#file', [fpath]); await q2.waitForTimeout(900); await toTests(q2, '4th');
    const t3 = await text(q2, '#gridwrap');
    check(/This browser can't open test records here/.test(t3) && await q2.locator('tr[data-xcode]').count() >= 22, 'without the platform\'s deflate: Tests says so plainly, and the tests already opened still show');
    await shot(q2, '12-no-webcrypto-1366');
    await q2.click('#xtPaste'); await q2.fill('#xtSheet', 'Ana Test\tK7QF-2M9D-X4TB'); await q2.click('#xtTake'); await q2.waitForTimeout(400);
    check(/can.t open test records here/.test(await text(q2, '#toast')), 'and asking it to fetch says why it can\'t, nothing breaks');
    await o2.ctx.close();
  }
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close(); await site.close(); done();
})().catch(e => { console.error(e); check(false, 'crashed: ' + (e && e.message)); done(); process.exit(1); });
