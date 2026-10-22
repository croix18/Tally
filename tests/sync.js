// Sync (Croix, 22 Oct 2026: "working on my laptop, how will the data get to the Promethean?"). Two computers — two browser
// contexts — share one store that behaves like the Worker at mrshaffer.org/api/sync (worker.js in croix18/mrshaffer-site):
// a hash of the second secret, an edit count checked on every send (409 when stale), 403 {error:"passphrase"} for the
// wrong one, the setup code to claim an empty store or reset it, and X-New-Key to change the passphrase in one step.
//   · the laptop turns sync on (a weak passphrase is refused; Suggest one gives five words; a fresh store asks for it twice
//     and for the setup code) and sends a locked copy: no student name, ID or class label is readable on the server
//   · an empty Tally on the panel offers "Turn on sync"; the wrong passphrase is refused; the right one (other capitals,
//     dashes) brings the same Tally, names hidden
//   · a change on the laptop reaches the panel; a change on both asks which to keep, and the one not kept downloads
//   · a copy whose sealed edit number disagrees with the server's is refused; a filter's 403 page turns nothing off
//   · a new passphrase on the laptop turns the panel's sync off; a lost passphrase is reset with the setup code
//   · under connect-src 'self' nothing is refused; on a file:// page there is no Sync at all
const { chromium, fs, path, exe, check, done, APP, pick } = require('./lib');
const crypto = require('crypto');
const ORIGIN = 'https://tally.test', SETUP = 'test-setup-code-1234';
const CSP = "default-src 'self' 'unsafe-inline' data: blob:; connect-src 'self'; base-uri 'none'; form-action 'none'";
const store = { ver: null, blob: null, meta: null, puts: 0, tamper: null, filter: false };
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
async function api(route) {
  const r = route.request(), u = new URL(r.url()), h = r.headers(); const j = (o, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (u.pathname === '/api/sync/ping') return j({ ok: true, v: 2, ready: true, setup: true });
  if (store.filter) return route.fulfill({ status: 403, contentType: 'text/html', body: '<h1>Blocked by your network</h1>' });
  if (u.pathname === '/api/sync/reset' && r.method() === 'POST') { if (h['x-setup'] !== SETUP) return j({ error: 'setup' }, 403); store.ver = store.blob = store.meta = null; return j({ ok: true }); }
  const m = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(h.authorization || ''); if (!m) return j({ error: 'no key' }, 401);
  const given = sha(m[1]);
  if (store.ver && store.ver !== given) return j({ error: 'passphrase' }, 403);
  if (r.method() === 'GET') { if (u.pathname === '/api/sync/meta') return j(store.ver && store.meta ? store.meta : { empty: true }); if (!store.ver || !store.meta) return j({ empty: true }, 404);
    const meta = store.tamper || store.meta; return route.fulfill({ status: 200, headers: { 'content-type': 'application/octet-stream', 'x-rev': String(meta.rev), 'x-saved': meta.saved }, body: store.blob }); }
  if (r.method() === 'PUT') {
    if (!store.ver && h['x-setup'] !== SETUP) return j({ error: 'setup' }, 403);
    const nk = h['x-new-key']; if (nk != null && (!store.ver || !/^[A-Za-z0-9_-]{43}$/.test(nk))) return j({ error: 'new key' }, 400);
    const cur = store.ver && store.meta ? store.meta.rev : 0; const base = parseInt(h['x-base-rev'] || '0', 10);
    if (base !== cur) return j({ error: 'stale', ...(store.meta || { rev: 0 }) }, 409);
    const body = r.postDataBuffer(); store.puts++; store.blob = body; store.meta = { rev: cur + 1, saved: new Date(Date.now() + store.puts).toISOString(), size: body.length }; store.ver = nk != null ? sha(nk) : given; return j(store.meta); }
  return j({ error: 'method' }, 405);
}
async function computer(b, name) {
  const ctx = await b.newContext({ viewport: { width: 1536, height: 864 }, acceptDownloads: true }); const p = await ctx.newPage();
  p.errs = []; p.downloads = []; p.on('pageerror', e => p.errs.push(name + ': ' + e.message)); p.on('dialog', d => d.accept()); p.on('download', d => p.downloads.push(d.suggestedFilename()));
  p.on('console', m => { if (m.type() === 'error' && /Content Security Policy|Refused to/.test(m.text())) p.errs.push(name + ' CSP: ' + m.text()); });
  await ctx.route(ORIGIN + '/**', route => { const u = new URL(route.request().url()); if (u.pathname.startsWith('/api/')) return api(route);
    return route.fulfill({ status: 200, contentType: 'text/html', headers: { 'content-security-policy': CSP }, body: fs.readFileSync(APP) }); });
  await p.goto(ORIGIN + '/tally/'); await p.waitForTimeout(500); return p;
}
const T = (p, f, a) => p.evaluate(f, a);
const label = (p, i) => T(p, i => { const t = window.__tally; return t.state.sections[t.state.order[i]].label; }, i);
const setLabel = (p, i, v) => T(p, ([i, v]) => { const t = window.__tally; t.state.sections[t.state.order[i]].label = v; t.save(); }, [i, v]);
const toastText = p => p.evaluate(() => document.querySelector('#toast').textContent);
const openSync = async p => { if (await p.isVisible('#launchSync')) await p.click('#launchSync'); else { await p.click('#btnMore'); await p.click('#btnSync'); } await p.waitForTimeout(200); };
const PASS = 'Lantern cobalt rhubarb orbit mosaic';
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  // ---- the laptop: two classes from the fixtures ----------------------------------------------------------------------
  const lap = await computer(b, 'laptop');
  const acc = fs.readdirSync('fixtures').find(f => f.startsWith('course_acc')), on = fs.readdirSync('fixtures').find(f => f.startsWith('course_on'));
  await lap.setInputFiles('#file', [path.resolve('fixtures', acc), path.resolve('fixtures', on)]); await lap.waitForTimeout(800);
  for (const [f, per, pr] of [['focus_gradebook_pool_p1.csv', '1', 'acc'], ['focus_gradebook_pool_p2.csv', '2', 'on']]) { await lap.setInputFiles('#file', [path.resolve('fixtures', f)]); await lap.waitForTimeout(600); await pick(lap, '[data-sec="__new__"]'); await lap.waitForTimeout(200); await lap.click(`#ncPeriod [data-p="${per}"]`); await lap.click(`#ncPrep [data-prep="${pr}"]`); await lap.click('#ncMake'); await lap.waitForTimeout(700); const a = await lap.$('#askApply'); if (a) { await a.click(); await lap.waitForTimeout(300); } }
  const lapInfo = await T(lap, () => { const t = window.__tally; return { n: t.state.order.length, labels: t.state.order.map(k => t.state.sections[k].label), names: t.state.order.flatMap(k => t.state.sections[k].students.slice(0, 5)), ids: t.state.order.flatMap(k => ((t.state.sections[k].grades || {}).students || []).slice(0, 3).map(s => String(s.id || ''))).filter(x => x.length > 3) }; });
  check(lapInfo.n === 2 && lapInfo.names.length >= 5, `the laptop has two classes (${lapInfo.labels.join(', ')})`);
  await lap.click('#btnMore'); check(await lap.isVisible('#btnSync'), 'on mrshaffer.org the ⋯ menu has Sync'); check((await lap.textContent('#topSync')) === 'Off', 'and says Off'); await lap.keyboard.press('Escape');
  await openSync(lap);
  for (const weak of ['cobalt orbit', 'aaaa aaaa aaaa aaaa aaaa', 'ab cd ef gh ij kl mn']) { await lap.fill('#syPass', weak); await lap.click('#syGo'); await lap.waitForTimeout(150);
    check(/four different words/i.test(await lap.textContent('#syMsg')), `a weak passphrase ("${weak}") is refused before anything is sent`); }
  await lap.click('#sySuggest'); const sug = await lap.inputValue('#syPass');
  check(sug.split(' ').length === 5 && await T(lap, s => window.__tally.syncPassOk(s), sug), `Suggest one gives five words (${sug})`);
  check(store.puts === 0, 'nothing was sent');
  await lap.fill('#syPass', PASS); await lap.click('#syGo'); await lap.waitForSelector('#syAgainF:not(.hidden)', { timeout: 15000 });
  check(await lap.isVisible('#sySetupF'), 'an empty store asks for the passphrase again, and the setup code');
  await lap.fill('#syAgain', PASS + ' x'); await lap.click('#syGo'); await lap.waitForTimeout(200);
  check(/don't match/.test(await lap.textContent('#syMsg')), 'two different passphrases are refused');
  await lap.fill('#syAgain', PASS.toUpperCase()); await lap.fill('#sySetup', 'wrong code'); await lap.click('#syGo'); await lap.waitForTimeout(2500);
  check(/isn't the setup code/.test(await lap.textContent('#syMsg')) && store.puts === 0 && !store.ver, 'the wrong setup code claims nothing');
  // the passphrase corrected after "Type it again" appeared: the lock is made from the corrected one
  await lap.fill('#syPass', PASS + ' quilt'); await lap.fill('#syAgain', PASS + ' quilt'); await lap.fill('#sySetup', SETUP); await lap.click('#syGo'); await lap.waitForTimeout(2500);
  check(store.puts === 1 && store.meta && store.meta.rev === 1, 'the matching passphrase and setup code send the first locked copy');
  const blob = store.blob.toString('latin1');
  check(blob.startsWith('TSY1'), 'the stored copy is a locked Tally file');
  const leaks = [...lapInfo.names, ...lapInfo.labels, ...lapInfo.ids].filter(s => s && blob.includes(s));
  check(!leaks.length, `no name, ID or class label is readable in what the server holds${leaks.length ? ' — found ' + leaks.slice(0, 3).join(', ') : ''}`);
  check(!/students|sections|"tally"/.test(blob), 'nor any of Tally\'s field names (it is compressed and sealed)');
  const stored = await T(lap, () => JSON.parse(localStorage.getItem('tally.sync')));
  check(stored && stored.k && stored.a && !JSON.stringify(stored).toLowerCase().includes('lantern'), 'the laptop keeps the two derived secrets, not the passphrase');
  check(/locked and sent/.test(await toastText(lap)), 'and says it is on');
  const PASS2 = PASS + ' quilt';
  // ---- the panel: an empty Tally --------------------------------------------------------------------------------------
  const pan = await computer(b, 'panel');
  check(await pan.isVisible('#launchSync'), 'an empty Tally on mrshaffer.org offers "Turn on sync"');
  await openSync(pan); await pan.fill('#syPass', PASS); await pan.click('#syGo'); await pan.waitForTimeout(2500);
  check(/isn't the passphrase/.test(await pan.textContent('#syMsg')), 'the passphrase before the correction is refused: the lock was made from the corrected one');
  check(await pan.isVisible('#syReset'), 'and "Lost the passphrase? Start over" appears');
  await pan.fill('#syPass', PASS2.toUpperCase().replace(/ /g, '-')); await pan.click('#syGo'); await pan.waitForTimeout(3000);
  const panInfo = await T(pan, () => { const t = window.__tally; return { n: t.state.order.length, labels: t.state.order.map(k => t.state.sections[k].label), names: t.state.order.flatMap(k => t.state.sections[k].students.slice(0, 5)), hide: t.state.settings.hideNames }; });
  check(panInfo.n === 2 && JSON.stringify(panInfo.names) === JSON.stringify(lapInfo.names) && JSON.stringify(panInfo.labels) === JSON.stringify(lapInfo.labels), 'the right passphrase (dashes, capitals) brings the same Tally: same classes, same students');
  check(panInfo.hide === true, 'a computer joining with no classes of its own starts with names hidden');
  check(store.puts === 1, 'taking the synced copy sends nothing back');
  // ---- a change on the laptop reaches the panel -----------------------------------------------------------------------
  await setLabel(lap, 0, 'Sync check A'); await T(lap, () => window.__tally.syncPush()); await lap.waitForTimeout(300);
  check(store.meta.rev === 2, 'a change on the laptop goes out');
  await T(lap, () => window.__tally.syncPush()); check(store.meta.rev === 2, 'nothing new: nothing sent');
  await T(pan, () => { const t = window.__tally; t.state.settings.hideNames = false; t.save(); });
  check(store.meta.rev === 2, 'showing names on the panel is not a change to send');
  await T(pan, () => window.__tally.syncPull()); await pan.waitForTimeout(500);
  check(await label(pan, 0) === 'Sync check A', 'the panel takes it');
  check(await T(pan, () => window.__tally.state.settings.hideNames) === false, 'and keeps its own names switch');
  check(/Updated from your other computer/.test(await toastText(pan)), 'and says where it came from');
  // a dialog open on the panel: the new copy waits
  await setLabel(lap, 0, 'Sync check B'); await T(lap, () => window.__tally.syncPush());
  await pan.click('#btnMore'); await pan.click('#btnSettings'); await pan.waitForTimeout(200);
  await T(pan, () => window.__tally.syncPull()); await pan.waitForTimeout(300);
  check(await label(pan, 0) === 'Sync check A', 'with Settings open on the panel, the new copy waits');
  await pan.click('#mCancel'); await pan.waitForTimeout(900);
  check(await label(pan, 0) === 'Sync check B', 'and arrives when Settings closes');
  // ---- the server can't pass an old copy off as new, and a filter page turns nothing off --------------------------------
  const real = store.meta; const oldBlob = store.blob;
  await setLabel(lap, 0, 'Sync check C'); await T(lap, () => window.__tally.syncPush());
  store.blob = oldBlob; store.tamper = { rev: store.meta.rev, saved: store.meta.saved };   // rev 4 claimed for the rev-3 copy
  await T(pan, () => window.__tally.syncPull()); await pan.waitForTimeout(300);
  check(await label(pan, 0) === 'Sync check B' && await T(pan, () => window.__tally.SY.status) === 'error', 'a copy whose sealed edit number isn\'t the one the server claims is refused');
  store.tamper = null; store.blob = null; await T(lap, () => { const t = window.__tally; t.state.sections[t.state.order[0]].label = 'Sync check D'; t.save(); t.SY.cfg.print = 'x'; return t.syncPush(true); }); void real;
  store.filter = true; await T(pan, () => window.__tally.syncPull()); await pan.waitForTimeout(300);
  check(!!(await T(pan, () => window.__tally.SY.cfg)), 'a school filter\'s 403 page does not turn sync off or forget the key');
  store.filter = false; await T(pan, () => window.__tally.syncPull()); await pan.waitForTimeout(400);
  check(await label(pan, 0) === 'Sync check D', 'and the next look brings the newest copy');
  // ---- both changed: ask; the one not kept downloads ------------------------------------------------------------------
  await setLabel(pan, 1, 'Changed on the panel');
  await setLabel(lap, 1, 'Changed on the laptop'); await T(lap, () => window.__tally.syncPush());
  let n0 = pan.downloads.length; const pulling = T(pan, () => window.__tally.syncPull()); await pan.waitForSelector('#askA', { timeout: 5000 });
  check(/changed here and on another computer/.test(await pan.textContent('#askMsg')), 'a change on both computers asks which to keep');
  check(await T(pan, () => document.activeElement && document.activeElement.classList.contains('askBox')), 'and neither choice starts focused (Enter alone decides nothing)');
  await pan.click('#askB'); await pulling; await pan.waitForTimeout(500);
  check(pan.downloads.slice(n0).some(f => /^tally-full-/.test(f)), 'choosing the other one downloads a Full save of the panel\'s first');
  check(await label(pan, 1) === 'Changed on the laptop', 'then takes the laptop\'s');
  await setLabel(pan, 1, 'Panel wins');
  await setLabel(lap, 0, 'Laptop loses'); await T(lap, () => window.__tally.syncPush());
  n0 = pan.downloads.length; const revBefore = store.meta.rev; const pull2 = T(pan, () => window.__tally.syncPull()); await pan.waitForSelector('#askA', { timeout: 5000 }); await pan.click('#askA'); await pull2; await pan.waitForTimeout(500);
  check(pan.downloads.slice(n0).some(f => /other-computer\.json$/.test(f)), 'keeping this computer\'s downloads the other computer\'s version first');
  check(store.meta.rev === revBefore + 1, 'then sends this computer\'s over it');
  await T(lap, () => window.__tally.syncPull()); await lap.waitForTimeout(400);
  check(await label(lap, 1) === 'Panel wins', 'and the laptop takes it');
  // not now: the question waits five minutes instead of coming back on the next tap
  await setLabel(pan, 0, 'Panel again'); await setLabel(lap, 0, 'Laptop again'); await T(lap, () => window.__tally.syncPush());
  const p3 = T(pan, () => window.__tally.syncPull()); await pan.waitForSelector('#askA', { timeout: 5000 }); await pan.keyboard.press('Escape'); await p3; await pan.waitForTimeout(800);
  check(await pan.isHidden('#askA') && await T(pan, () => window.__tally.SY.snooze > Date.now() + 60000), '"not now" puts the question off for five minutes');
  await T(pan, () => { window.__tally.SY.snooze = 0; }); const p4 = T(pan, () => window.__tally.syncPull()); await pan.waitForSelector('#askA', { timeout: 5000 }); await pan.click('#askB'); await p4;
  // ---- a new passphrase on the laptop, in one step ---------------------------------------------------------------------
  await openSync(lap); check(await lap.isVisible('#syChange'), 'the laptop\'s Sync sheet says On, with Change the passphrase');
  check(/Last sent from here/.test(await lap.textContent('.syncWhen')), 'and when it last sent and received');
  await lap.click('#syChange'); await lap.waitForSelector('#syAgainF:not(.hidden)');
  const NEW = 'harbor violet saddle quartz lemon'; const verBefore = store.ver;
  await lap.fill('#syPass', NEW); await lap.fill('#syAgain', NEW); await lap.click('#syGo'); await lap.waitForTimeout(2500);
  check(store.ver && store.ver !== verBefore && store.meta, 'the new passphrase replaces the old one without the store ever being empty');
  check(/Passphrase changed/.test(await toastText(lap)), 'the laptop says so');
  await T(pan, () => window.__tally.syncPull()); await pan.waitForTimeout(300);
  check(!(await T(pan, () => window.__tally.SY.cfg)) && /passphrase was changed/.test(await toastText(pan)), 'the panel turns its sync off and says why');
  await openSync(pan); await pan.fill('#syPass', NEW); await pan.click('#syGo'); await pan.waitForSelector('#askA', { timeout: 8000 });
  check(/already a synced Tally/.test(await pan.textContent('#askMsg')), 'a panel with classes of its own asks which to keep');
  await pan.click('#askA'); await pan.waitForTimeout(1500);
  check(await label(pan, 0) === await label(lap, 0), 'and with the synced one chosen, matches the laptop again');
  // ---- a lost passphrase: start over with the setup code ---------------------------------------------------------------
  await T(pan, () => { window.__tally.SY.cfg = null; window.__tally.SY.key = null; });
  await openSync(pan); await pan.fill('#syPass', 'forgotten words never written down'); await pan.click('#syGo'); await pan.waitForTimeout(2500);
  await pan.click('#syReset'); await pan.fill('#sySetup', 'nope'); await pan.click('#syGo'); await pan.waitForTimeout(300);
  check(/isn't the setup code/.test(await pan.textContent('#syMsg')) && store.meta, 'a wrong setup code clears nothing');
  await pan.fill('#sySetup', SETUP); await pan.click('#syGo'); await pan.waitForTimeout(500);
  check(store.meta === null && store.ver === null, 'the setup code clears the synced copy');
  await T(lap, () => window.__tally.syncPull()); await lap.waitForTimeout(300);
  check(!(await T(lap, () => window.__tally.SY.cfg)) && /synced copy was reset/.test(await toastText(lap)), 'the laptop notices and turns its sync off (it never claims the empty store on its own)');
  check(store.ver === null, 'the store stays unclaimed until someone turns sync on with the setup code');
  // ---- clearing Tally on a computer forgets its key -------------------------------------------------------------------
  await T(pan, () => { localStorage.setItem('tally.sync', '{"k":"x","a":"y"}'); });
  if (await pan.isVisible('#modal')) await pan.click('#mClose');
  await pan.click('#btnMore'); await pan.click('#btnSettings'); await pan.waitForTimeout(200); await pan.click('#wipe'); await pan.waitForTimeout(1200);
  check(await T(pan, () => localStorage.getItem('tally.sync')) === null, 'Clear all Tally data forgets this computer\'s sync key');
  // ---- no Sync where there is no mrshaffer.org ------------------------------------------------------------------------
  const f = await (await b.newContext()).newPage(); await f.goto('file://' + path.resolve(APP)); await f.waitForTimeout(400);
  check(await f.isHidden('#launchSync') && !(await f.$('#btnSync')), 'opened as a file, Tally shows no Sync');
  const errs = [...lap.errs, ...pan.errs]; check(!errs.length, 'no errors and nothing refused by connect-src \'self\'' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); done();
})();
