/* ---------- sync.js — one Tally on every computer (spliced into app.js) ----------
   Croix, 22 Oct 2026: working on the laptop, the Promethean should have the same Tally without carrying a file.
   Only where Tally is opened from mrshaffer.org (its Worker answers /api/sync: worker.js in croix18/mrshaffer-site);
   on GitHub Pages, a Google Site or the file itself none of this shows.

   The lock is made on this computer, from a passphrase that never leaves it:
     PBKDF2-SHA-256 (600,000 rounds) over the passphrase → 64 bytes: the first 32 are an AES-256-GCM key, the last 32 a
     second secret the server checks (it keeps only a SHA-256 of it). The state is gzipped, then sealed with AES-GCM
     under a fresh 12-byte IV. The edit number travels inside the seal and must match what the server says, so the
     server can't hand back an older copy as a newer one. The server can read none of it.
   This computer keeps the two derived secrets (localStorage "tally.sync"), not the passphrase, so it is typed once per
   computer (Croix: the panel is his alone; no asking again). Tally suggests the passphrase: five words from a list of
   2,048: because a made-up one is the weak point of all this.

   Rhythm: a change is sent a few seconds after it is saved, at most once a minute, and when the page is hidden. The
   other computers look for a newer copy every minute while Tally is showing and whenever it comes back to the front.
   They take it unless something here hasn't been sent; then they ask which to keep, and the one not kept downloads as
   a Full save first: this computer's, or the other computer's: so neither is ever only gone. A new copy waits while a
   dialog is open or a field is being typed in. One thing happens at a time (SY.busy). Only a server answer that says so
   ({error:"passphrase"}, {empty:true}) turns sync off here; a filter page, an outage or a timeout never does. */
var SY = null;   // var: save() runs (and calls syncSoon) before this file's lines do
const SYNC_KEY = 'tally.sync', SYNC_SALT = 'mrshaffer.org · Tally sync · v1', SYNC_ITER = 600000, SYNC_GAP = 60000;
const SYNC_MAGIC = [84, 83, 89, 49];   // "TSY1"
// BIP-39 English word list (2,048 words; MIT, Patricio Palladino and Paul Miller): five words ≈ 55 bits.
const SYNC_WORDS = '/*__WORDS__*/'.split(' ');
const syncTE = new TextEncoder();
const syncAAD = syncTE.encode('tally-sync-v1');
const b64 = u => btoa(String.fromCharCode(...u));
const b64url = u => b64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
// "Lantern-Cobalt  rhubarb" and "lantern cobalt rhubarb" are the same passphrase: case, dashes and spacing don't count.
const syncNorm = p => String(p || '').normalize('NFKC').toLowerCase().split(/[\s\-_.,]+/).filter(Boolean).join(' ');
// At least five different words of three letters or more, 24 characters in all (the school's name is four words), or a long, varied phrase.
function syncPassOk(p) { const n = syncNorm(p), w = n.split(' ').filter(x => x.length >= 3); return (new Set(w).size >= 5 && n.length >= 24) || (n.length >= 32 && new Set(n.replace(/ /g, '')).size >= 12); }
function syncSuggest() { const r = crypto.getRandomValues(new Uint16Array(5)); return [...r].map(x => SYNC_WORDS[x % 2048]).join(' '); }
function syncLoadCfg() { try { const o = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null'); return o && typeof o.k === 'string' && typeof o.a === 'string' ? o : null; } catch (e) { return null; } }
function syncStoreCfg(o) { try { if (o) localStorage.setItem(SYNC_KEY, JSON.stringify(o)); else localStorage.removeItem(SYNC_KEY); } catch (e) {} }
const syncOn = () => !!(SY && SY.ready && SY.cfg && SY.key);
// True when every change made here has gone out to Sync: nothing is lost by replacing or clearing this computer, so no
// Full save (names and grades) needs to land in its Downloads (a shared panel, say).
const syncHolds = () => syncOn() && !state.board && workPrint() === SY.cfg.print;

async function syncDerive(pass) {
  const base = await crypto.subtle.importKey('raw', syncTE.encode(syncNorm(pass)), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: syncTE.encode(SYNC_SALT), iterations: SYNC_ITER }, base, 512));
  return { k: b64(bits.slice(0, 32)), a: b64url(bits.slice(32)) };
}
const syncKeyOf = k => crypto.subtle.importKey('raw', unb64(k), 'AES-GCM', false, ['encrypt', 'decrypt']);
async function syncSeal(obj, key) {
  const gz = new Uint8Array(await new Response(new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: syncAAD }, key, gz));
  const out = new Uint8Array(4 + 12 + ct.length); out.set(SYNC_MAGIC, 0); out.set(iv, 4); out.set(ct, 16); return out;
}
async function syncOpen(buf, key) {
  const u = new Uint8Array(buf); if (u.length < 32 || SYNC_MAGIC.some((v, i) => u[i] !== v)) throw new Error('not a Tally sync file');
  const gz = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(4, 16), additionalData: syncAAD }, key, u.slice(16));
  return JSON.parse(await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}
// Every request gives up after a while (a captive portal or a filter can hold a connection open forever).
function syncFetch(path, opt, a, ms) {
  const o = opt || {}; const h = { ...(o.headers || {}) }; if (a !== false) h.Authorization = 'Bearer ' + (a || SY.cfg.a);
  let signal; try { signal = AbortSignal.timeout(ms || 30000); } catch (e) {}
  return fetch(path, { ...o, cache: 'no-store', headers: h, signal });
}
const syncBody = async r => { try { return await r.json(); } catch (e) { return {}; } };
const syncMark = m => m ? m.rev + '|' + m.saved : '';
const syncLock = j => !!(j && j.error === 'passphrase');   // the only 403 that means "your passphrase is no longer the one"

function syncStatus(s) { if (!SY) return; SY.status = s; syncUI(); }
// Something open that a new copy must not pull the floor out from under.
function syncBusyHere() {
  const m = $('#modal'), a = $('#ask'); if ((m && !m.classList.contains('hidden')) || (a && !a.classList.contains('hidden'))) return true;
  const ae = document.activeElement; if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.id !== 'search') return true;
  if (document.body.classList.contains('lbMode') || document.body.classList.contains('showMode')) return true;   // projected: never a question, never a download, while students can see the screen (audit, 24 Oct)
  return document.body.classList.contains('dragging');
}
// One thing at a time: a send, a look for something newer, a question. Anything that arrives meanwhile is dropped (the
// next minute's look, or the next save, picks it up).
async function syncRun(fn) { if (!SY || SY.busy) return; SY.busy = true; try { await fn(); } catch (e) { syncStatus(navigator.onLine === false ? 'offline' : 'error'); } finally { SY.busy = false; } }
// Called by save(): a change goes out a few seconds later, never sooner than a minute after the last send.
function syncSoon() {
  if (!SY || !syncOn() || state.board) return;
  clearTimeout(SY.t); const wait = Math.max(4000, SY.lastPush + SYNC_GAP - Date.now());
  SY.t = setTimeout(() => syncPush(), wait);
}
const syncPush = force => syncRun(() => pushInner(force, 0));
const syncPull = () => syncRun(async () => { const next = await pullInner(); if (next) await pushInner(next === 'force', 1); });
const syncPayload = rev => ({ tally: 4, sync: { rev, saved: new Date().toISOString(), classes: state.order.length }, state: stateForSave() });
async function pushInner(force, depth) {
  if (!syncOn() || state.board) return;
  if (!state.order.length) return;   // an empty Tally never overwrites the synced one
  const print = workPrint(); if (!force && print === SY.cfg.print) return;
  SY.lastPush = Date.now();
  const body = await syncSeal(syncPayload((SY.cfg.rev || 0) + 1), SY.key);
  const r = await syncFetch('/api/sync', { method: 'PUT', headers: { 'X-Base-Rev': String(SY.cfg.rev || 0), 'Content-Type': 'application/octet-stream' }, body }, null, 60000);
  const j = await syncBody(r);
  if (r.ok) { Object.assign(SY.cfg, { rev: j.rev, mark: syncMark(j), print, sentAt: j.saved }); syncStoreCfg(SY.cfg); syncStatus('ok'); }
  else if (r.status === 409 && depth < 1) { const next = await pullInner(); if (next) await pushInner(next === 'force', depth + 1); return; }   // another computer sent first: take it, or ask
  else if (r.status === 403 && syncLock(j)) { syncLost(); return; }
  else { syncStatus('error'); return; }
  if (syncOn() && workPrint() !== SY.cfg.print) syncSoon();   // changed again while it was sending
}
// Looks for a newer copy. Returns 'push' / 'force' when this computer's Tally should go out next.
async function pullInner() {
  if (!syncOn()) return null;
  if (syncBusyHere() || Date.now() < SY.snooze) { SY.waiting = true; return null; }
  SY.waiting = false;
  const r = await syncFetch('/api/sync/meta'); const meta = await syncBody(r);
  if (r.status === 403 && syncLock(meta)) { syncLost(); return null; }
  if (!r.ok) { syncStatus('error'); return null; }
  if (meta.empty) { syncLost('cleared'); return null; }   // the store was reset (a lost passphrase): only the Sync sheet sends to an empty store
  if (syncMark(meta) === SY.cfg.mark) { syncStatus('ok'); return workPrint() !== SY.cfg.print && state.order.length ? 'push' : null; }
  const g = await syncFetch('/api/sync', null, null, 60000);
  if (g.status === 403 && syncLock(await syncBody(g.clone()))) { syncLost(); return null; }
  if (!g.ok) { syncStatus('error'); return null; }
  const got = { rev: +g.headers.get('x-rev'), saved: g.headers.get('x-saved') };
  const cfg = await syncOpen(await g.arrayBuffer(), SY.key);
  // the edit number is sealed inside: a copy that isn't what the server says it is, or is older than one this computer
  // has already had, is not taken
  if (!cfg.sync || cfg.sync.rev !== got.rev || (SY.cfg.rev && got.rev < SY.cfg.rev)) { syncStatus('error'); return null; }
  if (syncBusyHere()) { SY.waiting = true; return null; }   // something opened while it was downloading
  const mine = !state.board && state.order.length > 0 && workPrint() !== SY.cfg.print;   // changes made here that never went out
  if (mine) {
    const pick = await syncChoose(`Tally changed here and on another computer (sent ${whenText(got.saved)}). Which one should every computer keep? The other one downloads as a Full save first.`, 'This computer\'s', 'The other one');
    if (pick === null) { SY.snooze = Date.now() + 5 * 60000; SY.waiting = true; return null; }   // not now: asked again in five minutes
    if (pick === 'a') { syncKeepFile(cfg, got); Object.assign(SY.cfg, { rev: got.rev, mark: syncMark(got) }); syncStoreCfg(SY.cfg); return 'force'; }
    if (!syncHolds()) saveFull();   // this computer's version, kept as a file before it is replaced (not when the synced copy already holds it)
  }
  syncApply(cfg, got);
  return null;
}
// The other computer's copy, as a Full save file, before this computer's is sent over it.
function syncKeepFile(cfg, got) { downloadJson({ tally: 4, full: { saved: got.saved, classes: (cfg.state.order || []).length, how: 'sync' }, state: cfg.state }, 'tally-full-' + stamp(got.saved) + '-other-computer.json'); }
// The other computer's Tally becomes this one. What is only about this screen stays: names shown or hidden, Details view,
// the open class. A computer that had no classes (the panel joining) starts with names hidden.
function syncApply(cfg, got) {
  const s = JSON.parse(JSON.stringify(cfg && cfg.state || {})); if (!s.sections || typeof s.sections !== 'object') throw new Error('not tally');
  const was = state.settings || {}, active = state.active, joining = !!state.board || !state.order.length; delete s.board;
  adopt(hydrate(s) || s);
  state.settings.hideNames = joining ? true : !!was.hideNames; state.settings.details = !!was.details;
  if (active && state.order.includes(active)) state.active = active; else if (!state.order.includes(state.active)) state.active = state.order[0] || null;
  if (joining) view = { mode: 'home', unit: null };
  render(); save();   // the first paint fills in what Tally works out on its own (the Working in, quarters): part of the copy, not a change made here
  Object.assign(SY.cfg, { rev: got.rev, mark: syncMark(got), print: workPrint(), gotAt: new Date().toISOString() }); syncStoreCfg(SY.cfg); clearTimeout(SY.t); syncStatus('ok');
  toast(`Updated from your other computer (sent ${esc(whenText(got.saved))}).`, false, 4000);
}
// The passphrase changed on another computer (or the store was reset): this one stops, and says so.
function syncLost(why) {
  syncStoreCfg(null); if (SY) { SY.cfg = null; SY.key = null; clearTimeout(SY.t); } syncStatus('off');
  toast(`Sync is off on this computer: ${why === 'cleared' ? 'the synced copy was reset' : 'the passphrase was changed on another computer'}. Turn it on again with the new passphrase (⋯ → Sync).`, true, 9000);
}
// Two named choices (the browser's confirm box only says OK and Cancel). Resolves 'a', 'b', or null for "not now".
// Neither button starts focused, so Enter alone decides nothing.
function syncChoose(msg, a, b) {
  return new Promise(res => {
    const d = $('#ask'); const prev = document.activeElement;
    d.innerHTML = `<div class="askBox" role="alertdialog" aria-modal="true" aria-labelledby="askMsg" tabindex="-1"><p id="askMsg">${esc(msg)}</p><div class="askRow"><button class="pill pale" id="askB">${esc(b)}</button><button class="pill pale" id="askA">${esc(a)}</button></div></div>`;
    d.classList.remove('hidden');
    const done = v => { d.classList.add('hidden'); d.innerHTML = ''; document.removeEventListener('keydown', key, true); try { if (prev && prev.focus) prev.focus(); } catch (e) {} res(v); };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); } };
    document.addEventListener('keydown', key, true);
    $('#askA').onclick = () => done('a'); $('#askB').onclick = () => done('b'); d.onclick = e => { if (e.target === d) done(null); };
    d.querySelector('.askBox').focus();
  });
}

/* ---------- the Sync sheet (⋯ → Sync, or "Turn on sync" on an empty Tally) ---------- */
function syncAgo(iso) { return iso ? whenText(iso) : 'not yet'; }
function syncUI() {
  const b = $('#btnSync'), l = $('#launchSync'); if (!b) return;
  if (l) l.classList.toggle('hidden', syncOn() || state.order.length > 0);
  if (SY && SY.waiting && !SY.busy && syncOn() && Date.now() >= SY.snooze) setTimeout(() => { if (SY.waiting && !syncBusyHere()) syncPull(); }, 400);   // a dialog just closed: the copy that waited comes in
  const sm = $('#topSync'); if (sm) { const st = !syncOn() ? 'Off' : SY.status === 'offline' ? 'Offline' : SY.status === 'error' ? 'Trouble' : 'On'; sm.textContent = st; sm.classList.toggle('due', syncOn() && st !== 'On'); }
}
// The passphrase is hidden as it is typed (audit, 22 Oct 2026: typed on the panel it was readable by the room);
// Show reveals both fields, and Suggest one shows the words it picked so they can be written down.
function syncShowWire() { const b = $('#syShow'); if (!b) return; const set = on => { ['#syPass', '#syAgain'].forEach(id => { const el = $(id); if (el) el.type = on ? 'text' : 'password'; }); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'Hide' : 'Show'; }; b.onclick = () => set(b.getAttribute('aria-pressed') !== 'true'); const sg = $('#sySuggest'); if (sg) sg.addEventListener('click', () => set(true)); }
const SYNC_PASS_FIELDS = (lab1, lab2) => `
    <div class="field"><label for="syPass">${lab1}</label><div class="syRow"><input type="password" id="syPass" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"><button class="pill pale small" id="syShow" type="button" aria-pressed="false">Show</button><button class="pill pale small" id="sySuggest" type="button">Suggest one</button></div></div>
    <div class="field hidden" id="syAgainF"><label for="syAgain">${lab2}</label><input type="password" id="syAgain" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
    <p class="ghint">Five random words, like the ones Suggest one gives. Write it down somewhere safe; capitals and dashes don't matter. It's typed once on each computer, so never type it while the screen is projected.</p>`;
function openSync() {
  if (!SY || !SY.ready) return;
  const m = $('#modal'); m.classList.remove('hidden');
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; render(); };
  m._cancel = close;
  const shell = (body, foot) => { m.innerHTML = `<div class="panel narrow syncPanel"><header><h2>Sync</h2><button id="mClose" aria-label="Close">×</button></header><div class="body one">${body}<p class="warnline hidden" id="syMsg" role="alert"></p></div><footer><div class="spacer"></div>${foot}</footer></div>`; $('#mClose').onclick = close; m.onclick = e => { if (e.target === m) close(); }; };
  const say = t => { const msg = $('#syMsg'); msg.textContent = t; msg.classList.toggle('hidden', !t); };
  if (syncOn()) {
    const st = SY.status === 'offline' ? '<p class="warnline">No connection right now. Changes go out when it comes back.</p>' : SY.status === 'error' ? '<p class="warnline">The last try didn\'t go through. Tally keeps trying every minute.</p>' : '';
    shell(`<p class="syncLead"><b>On.</b> Every computer with your passphrase keeps the same Tally.</p>${st}
      <dl class="syncWhen"><dt>Last sent from here</dt><dd>${esc(syncAgo(SY.cfg.sentAt))}</dd><dt>Last received</dt><dd>${esc(syncAgo(SY.cfg.gotAt))}</dd></dl>
      <p class="ghint">Locked with your passphrase before it leaves this computer. mrshaffer.org keeps only the locked copy.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pill pale small" id="syChange">Change the passphrase</button><button class="pill pale small" id="syOff">Turn off on this computer</button></div>`,
      `<button class="pill pale" id="syNow">Sync now</button><button class="pill" id="syDone">Done</button>`);
    $('#syDone').onclick = close;
    $('#syNow').onclick = async () => { close(); await syncPull(); await syncPush(); toast(SY.status === 'ok' ? 'Synced.' : 'Couldn\'t reach mrshaffer.org. Tally keeps trying.', SY.status !== 'ok'); };
    $('#syOff').onclick = async () => { if (!await ask('Turn sync off on this computer? Its Tally stays as it is, and the other computers keep syncing.', 'Turn off')) return; syncStoreCfg(null); SY.cfg = null; SY.key = null; clearTimeout(SY.t); syncStatus('off'); close(); toast('Sync is off on this computer.', false); };
    $('#syChange').onclick = () => syncChangeSheet();
    return;
  }
  const has = state.order.length > 0;
  shell(`<p class="syncLead">The same Tally on every computer you use: your laptop, the classroom panel, the tablet.</p>
    ${SYNC_PASS_FIELDS('Passphrase', 'Type it again')}
    <div class="field hidden" id="sySetupF"><label for="sySetup">Setup code</label><input type="password" id="sySetup" autocomplete="off" autocapitalize="off" spellcheck="false"><p class="ghint" style="margin-top:4px">The SYNC_SETUP secret you saved in Cloudflare. Needed once, to claim the empty store.</p></div>
    <p class="ghint">Tally locks everything with the passphrase before it leaves this computer; mrshaffer.org keeps only the locked copy and can't open it. A lost passphrase can't be recovered, but each computer keeps its own Tally either way.</p>
    <p class="ghint hidden" id="syResetP"><button class="pill pale small" id="syReset" type="button">Lost the passphrase? Start over</button></p>`,
    `<button class="pill pale" id="syCancel">Cancel</button><button class="pill" id="syGo">Turn on sync</button>`);
  $('#syCancel').onclick = close; $('#sySuggest').onclick = () => { $('#syPass').value = syncSuggest(); $('#syPass').dispatchEvent(new Event('input')); };
  syncShowWire(); const pass = $('#syPass'), again = $('#syAgain'), go = $('#syGo');
  let fresh = false;   // the store is empty: this computer claims it (the passphrase twice, and the setup code)
  pass.oninput = () => { if (fresh) again.value = ''; };
  [pass, again, $('#sySetup')].forEach(i => i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
  if (!coarse()) pass.focus();
  $('#syReset').onclick = () => syncResetSheet();
  go.onclick = async () => {
    say('');
    if (!syncPassOk(pass.value)) { say('Use at least five different words (Suggest one gives five). A school or team name can be guessed.'); return; }
    if (fresh) {
      if (syncNorm(again.value) !== syncNorm(pass.value)) { say('The two don\'t match.'); return; }
      if (!$('#sySetup').value.trim()) { say('Type the setup code you saved in Cloudflare.'); return; }
    }
    go.disabled = true; go.textContent = 'Checking…';
    try {
      const d = await syncDerive(pass.value);   // always from what is typed now
      const r = await syncFetch('/api/sync/meta', null, d.a); const meta = await syncBody(r);
      if (r.status === 403 && syncLock(meta)) { say('That isn\'t the passphrase already in use.'); $('#syResetP').classList.remove('hidden'); return; }
      if (!r.ok) throw new Error(r.status);
      if (meta.empty) {
        if (!has) { say('Nothing is synced yet. Turn sync on first at the computer that has your classes.'); return; }
        if (!SY.setup) { say('Sync isn\'t set up on mrshaffer.org yet: add the SYNC_SETUP secret in Cloudflare first.'); return; }
        if (!fresh) { fresh = true; $('#syAgainF').classList.remove('hidden'); $('#sySetupF').classList.remove('hidden'); if (!coarse()) again.focus(); return; }
        await syncStart(d, { claim: $('#sySetup').value.trim() }); return;
      }
      if (has) {
        const pick = await syncChoose(`There is already a synced Tally, sent ${whenText(meta.saved)}. Which one should every computer keep? The other one downloads as a Full save first.`, 'The synced one', 'This computer\'s');
        if (pick === null) return;
        await syncStart(d, pick === 'a' ? { take: meta } : { replace: meta }); return;
      }
      await syncStart(d, { take: meta });
    } catch (e) { say('Couldn\'t reach mrshaffer.org. Check the connection and try again.'); }
    finally { if (go.isConnected) { go.disabled = false; go.textContent = fresh ? 'Send this Tally' : 'Turn on sync'; } }
  };
  async function syncStart(d, how) {
    SY.cfg = { k: d.k, a: d.a, rev: 0, mark: '', print: '' }; SY.key = await syncKeyOf(d.k); SY.snooze = 0;
    const undo = () => { SY.cfg = null; SY.key = null; };
    if (how.take) {   // take the synced copy; what was here downloads as a Full save first
      if (state.order.length && unsavedWork()) saveFull();
      SY.cfg.print = workPrint(); syncStoreCfg(SY.cfg); close(); await syncPull();
      const ok = !!(SY.cfg && SY.cfg.mark);
      toast(ok ? 'Sync is on. This computer now has your synced Tally.' : 'Sync is on, but the synced copy didn\'t come through yet. Tally keeps trying.', !ok, 6000); return; }
    let headers = {};
    if (how.replace) {   // this computer's goes over the synced one: keep the synced one as a file first
      const g = await syncFetch('/api/sync', null, null, 60000); if (!g.ok) { undo(); throw new Error(g.status); }
      const got = { rev: +g.headers.get('x-rev'), saved: g.headers.get('x-saved') }; syncKeepFile(await syncOpen(await g.arrayBuffer(), SY.key), got); SY.cfg.rev = got.rev;
    } else headers = { 'X-Setup': how.claim };
    const r = await syncFetch('/api/sync', { method: 'PUT', headers: { ...headers, 'X-Base-Rev': String(SY.cfg.rev), 'Content-Type': 'application/octet-stream' }, body: await syncSeal(syncPayload(SY.cfg.rev + 1), SY.key) }, null, 60000);
    const j = await syncBody(r);
    if (r.status === 403 && j.error === 'setup') { undo(); say('That isn\'t the setup code saved in Cloudflare.'); return; }
    if (!r.ok) { undo(); say(r.status === 409 ? 'Another computer sent a copy just now. Try again.' : 'Couldn\'t send. Check the connection and try again.'); return; }
    Object.assign(SY.cfg, { rev: j.rev, mark: syncMark(j), print: workPrint(), sentAt: j.saved }); syncStoreCfg(SY.cfg); syncStatus('ok'); close();
    toast('Sync is on. Your Tally is locked and sent; type the same passphrase on your other computers.', false, 7000);
  }
}
// A new passphrase, in one step: this computer's Tally goes up locked with the new one, and the old secret authorises it,
// so the store is never empty and nobody else can claim it in between.
function syncChangeSheet() {
  const m = $('#modal');
  if (!state.order.length) { toast('Change the passphrase on the computer that has your classes.', true); return; }
  m.innerHTML = `<div class="panel narrow syncPanel"><header><h2>New passphrase</h2><button id="mClose" aria-label="Close">×</button></header><div class="body one">
    <p>Every other computer turns sync off until it's given the new one. This computer's Tally is what they'll get.</p>
    ${SYNC_PASS_FIELDS('New passphrase', 'Type it again')}<p class="warnline hidden" id="syMsg" role="alert"></p></div>
    <footer><div class="spacer"></div><button class="pill pale" id="syCancel">Cancel</button><button class="pill" id="syGo">Change it</button></footer></div>`;
  const close = () => openSync(); m._cancel = close; $('#mClose').onclick = close; $('#syCancel').onclick = close;
  $('#syAgainF').classList.remove('hidden');
  $('#sySuggest').onclick = () => { $('#syPass').value = syncSuggest(); $('#syAgain').value = ''; }; syncShowWire();
  const say = t => { const msg = $('#syMsg'); msg.textContent = t; msg.classList.toggle('hidden', !t); };
  $('#syGo').onclick = async () => {
    const p = $('#syPass').value; say('');
    if (!syncPassOk(p)) { say('Use at least five different words (Suggest one gives five).'); return; }
    if (syncNorm($('#syAgain').value) !== syncNorm(p)) { say('The two don\'t match.'); return; }
    const go = $('#syGo'); go.disabled = true; go.textContent = 'Changing…';
    try {
      // this computer must have the newest copy, and nothing unsent, before its Tally goes up under the new passphrase
      m.classList.add('hidden'); await syncPull(); m.classList.remove('hidden');
      if (!syncOn()) { m.classList.add('hidden'); m.innerHTML = ''; return; }
      if (workPrint() !== SY.cfg.print) await syncPush();
      if (workPrint() !== SY.cfg.print) { say('This computer has changes that haven\'t gone out yet. Try again in a moment.'); return; }
      const d = await syncDerive(p), key = await syncKeyOf(d.k);
      const r = await syncFetch('/api/sync', { method: 'PUT', headers: { 'X-Base-Rev': String(SY.cfg.rev || 0), 'X-New-Key': d.a, 'Content-Type': 'application/octet-stream' }, body: await syncSeal(syncPayload((SY.cfg.rev || 0) + 1), key) }, null, 60000);
      const j = await syncBody(r);
      if (!r.ok) { say(r.status === 409 ? 'Another computer sent a copy just now. Try again.' : 'Couldn\'t reach mrshaffer.org. Nothing changed.'); return; }
      SY.cfg = { k: d.k, a: d.a, rev: j.rev, mark: syncMark(j), print: workPrint(), sentAt: j.saved }; SY.key = key; syncStoreCfg(SY.cfg); syncStatus('ok');
      m.classList.add('hidden'); m.innerHTML = ''; render(); toast('Passphrase changed. Type the new one on your other computers.', false, 7000);
    } catch (e) { say('Couldn\'t reach mrshaffer.org. Nothing changed.'); }
    finally { if (go.isConnected) { go.disabled = false; go.textContent = 'Change it'; } }
  };
}
// A lost passphrase: the setup code from Cloudflare clears the store. Each computer keeps its own Tally.
function syncResetSheet() {
  const m = $('#modal');
  m.innerHTML = `<div class="panel narrow syncPanel"><header><h2>Start over</h2><button id="mClose" aria-label="Close">×</button></header><div class="body one">
    <p>This clears the synced copy so a new passphrase can be used. Nothing on this computer changes; every computer keeps its own Tally. Afterwards, turn sync on at the laptop first.</p>
    <div class="field"><label for="sySetup">Setup code</label><input type="password" id="sySetup" autocomplete="off" autocapitalize="off" spellcheck="false"><p class="ghint" style="margin-top:4px">The SYNC_SETUP secret you saved in Cloudflare.</p></div>
    <p class="warnline hidden" id="syMsg" role="alert"></p></div>
    <footer><div class="spacer"></div><button class="pill pale" id="syCancel">Cancel</button><button class="pill danger" id="syGo">Clear the synced copy</button></footer></div>`;
  const close = () => openSync(); m._cancel = close; $('#mClose').onclick = close; $('#syCancel').onclick = close;
  const say = t => { const msg = $('#syMsg'); msg.textContent = t; msg.classList.toggle('hidden', !t); };
  $('#syGo').onclick = async () => {
    const code = $('#sySetup').value.trim(); if (!code) { say('Type the setup code.'); return; }
    try { const r = await syncFetch('/api/sync/reset', { method: 'POST', headers: { 'X-Setup': code } }, false); const j = await syncBody(r);
      if (r.status === 403) { say('That isn\'t the setup code saved in Cloudflare.'); return; }
      if (!r.ok) { say(j.error === 'setup secret missing' ? 'Add the SYNC_SETUP secret in Cloudflare first.' : 'Couldn\'t reach mrshaffer.org.'); return; }
      toast('The synced copy is cleared. Turn sync on with a new passphrase.', false, 6000); openSync();
    } catch (e) { say('Couldn\'t reach mrshaffer.org.'); }
  };
}

/* ---------- start ---------- */
async function syncBoot() {
  SY = { ready: false, setup: false, cfg: syncLoadCfg(), key: null, busy: false, t: 0, lastPush: 0, status: 'off', waiting: false, snooze: 0 };
  if (location.protocol !== 'https:' || storageFragile || !(window.crypto && crypto.subtle) || typeof CompressionStream === 'undefined') return;
  try { const r = await syncFetch('/api/sync/ping', null, false, 10000); const j = r.ok ? await r.json() : null; SY.ready = !!(j && j.ok && j.ready); SY.setup = !!(j && j.setup); } catch (e) {}
  if (!SY.ready) return;
  // the menu item exists only where sync does (a file, GitHub Pages and a Google Site keep the menu as it was)
  const mb = document.createElement('button'); mb.id = 'btnSync'; mb.title = 'The same Tally on every computer, locked with your passphrase';
  mb.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2"/><polyline points="19 2 19 6.5 14.5 6.5"/><polyline points="5 22 5 17.5 9.5 17.5"/></svg>Sync<small id="topSync"></small>';
  mb.onclick = () => { if (closeOpenMenu) closeOpenMenu(); openSync(); }; $('#topMenu').insertBefore(mb, $('#btnBoardSave'));
  if (SY.cfg) { try { SY.key = await syncKeyOf(SY.cfg.k); } catch (e) { SY.cfg = null; } }
  syncStatus(syncOn() ? 'ok' : 'off');
  if (syncOn()) await syncPull();
  setInterval(() => { if (document.visibilityState === 'visible') syncPull(); }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!syncOn()) return;
    if (document.visibilityState === 'visible') syncPull();
    else if (state.order.length && workPrint() !== SY.cfg.print && Date.now() - SY.lastPush > 15000) { clearTimeout(SY.t); syncPush(); }   // leaving: send now (not on every quick switch)
  });
  window.addEventListener('focus', () => { if (syncOn() && SY.waiting) syncPull(); });
}
