/* ---------- Tests (16 Nov 2026): unit tests taken on mrshaffer.org, opened here ----------
   Croix, 15 Nov 2026: "You build me a descrytor inside tally or something like that." "I want literally all the data that is
   possible to get …" "How do I know it'll open on my tally?" The design is Windmill's practice/exam/DESIGN.md (sections 3
   and 4) and reviews/CHANGES-16NOV.md; the lock is vendor/seal.js (window.ExamSeal, Windmill's exam/seal.js unchanged); the
   reading of sheets, names, records, placement and flags is examcore.js (window.ExamCore). This file is the keeping, the
   fetching, the checking and the screens.

   Version 2 (after the review of 16 Nov 2026, REVIEW.md C1–C4, H1–H3): what Tally keeps of a test is the SITE'S LOCKED TEXT,
   opened and checked again in every session; a record's student is kept on the record's own entry.
     state.exam = {v: 2, site, pairs: [JSON text of {priv, pub, made}] (every key this Tally has, its own or from a Full save),
       sites: [{key, made, got}] (every site key it has been given), trial: {code, words, at, key}, warned,
       recs: {code: entry}   entry = {got, src: 'site' | 'file', who: {sec, n, how: 'exact' | 'remembered' | 'you', at} | null,
                                      no: [{sec, n}] (not theirs), nobody: true (he said so), was: {sec, n, how, at} (whose it had
                                      been), sum: the verified summary (recomputed whenever the record is opened), legacy: true}
       rows: the form's responses ({codes, name, line, when, at, raw, email, got, who, how, cands, suggest, remember}),
       fails: {code: {why, course, unit, at}}, picks, alias: {typed name's key: {sec, n, at}}, period, view,
       dismissed: {flag id: ISO}, locked: {code: text} (only where IndexedDB is refused, and in a Full save)}
     IndexedDB 'tally-tests' / 'locked': code → the locked text. A Full save carries every locked text.
     localStorage 'tally.exam.local' (this browser only, never in a file): {mine: [the public keys this Tally made],
       checked: [the site keys a trial proved in this browser]}. A key that came in a file opens records but is never "the one
       to paste"; a site key no trial proved here signs nothing Tally will score.
   The only requests: GET <site>/api/test/key and GET <site>/api/test/result/<code>. Neither carries a name. */
const EXAM_SITE = 'https://mrshaffer.org';
const EX = () => window.ExamCore, SEALX = () => window.ExamSeal;
const examCan = () => !!(window.ExamSeal && window.crypto && crypto.subtle && window.CompressionStream && window.DecompressionStream && window.isSecureContext !== false);
const xtNum = v => typeof v === 'number' && isFinite(v) ? v : null;
const xtStr = (v, n) => typeof v === 'string' ? v.slice(0, n || 200) : null;
const XCODE = /^[0-9A-HJKMNP-TV-Z]{12}$/;
function examPairOk(t) { try { const p = JSON.parse(t); return !!(p && p.priv && p.priv.kty === 'EC' && p.priv.d && /^TALLY1\.[A-Za-z0-9_-]{87}$/.test(p.pub)); } catch (e) { return false; } }
const xtWhoOf = (w, how) => w && typeof w === 'object' && typeof w.sec === 'string' && typeof w.n === 'string' ? { sec: w.sec, n: w.n.slice(0, 120), ...(typeof w.id === 'string' && /^\d{4,20}$/.test(w.id) ? { id: w.id } : {}), ...(how ? { how: ['exact', 'remembered', 'you'].includes(w.how) ? w.how : 'exact', at: xtStr(w.at, 30) } : {}), ...(typeof w.cl === 'string' ? { cl: w.cl.slice(0, 60) } : {}) } : null;
// the verified summary the class list needs, made from an opened record
function examSum(r) { const v = EX().readRecord(r); return { course: v.course, unit: v.unit, points: v.points, of: v.of, started: v.started, finished: v.finished, seconds: v.seconds, opened: v.opened, ended: v.ended, limit: v.limit, rule: v.rule, unlocks: v.unlocks, awayN: v.log ? v.away.length : null, awaySec: v.awaySec, hasLog: !!v.log }; }
function cleanSum(s) { if (!s || typeof s !== 'object') return null; const o = {}; ['unit', 'points', 'of', 'started', 'finished', 'seconds', 'opened', 'limit', 'unlocks', 'awayN', 'awaySec'].forEach(k => { o[k] = xtNum(s[k]); }); o.course = xtStr(s.course, 8) || ''; o.ended = ['left', 'teacher', 'time'].includes(s.ended) ? s.ended : null; o.rule = s.rule && typeof s.rule === 'object' ? { leave: xtStr(s.rule.leave, 8) || 'count', after: xtNum(s.rule.after) } : null; o.hasLog = !!s.hasLog; return o; }
function cleanRec(e) {
  if (!e || typeof e !== 'object') return null;
  return { got: xtStr(e.got, 30), src: e.src === 'file' ? 'file' : 'site', who: xtWhoOf(e.who, true), no: (Array.isArray(e.no) ? e.no : []).map(w => xtWhoOf(w)).filter(Boolean).slice(0, 20), nobody: !!e.nobody, was: xtWhoOf(e.was, true), ...(xtWhoOf(e.gone, true) ? { gone: xtWhoOf(e.gone, true) } : {}), sum: cleanSum(e.sum), ...(e.legacy ? { legacy: true } : {}) };
}
// the shape this branch kept before the review (v1): sec.exams / state.exam.loose = {code: {r: the opened record, got, src, n, pin}}
function cleanExamMap(o) { const out = {}; if (o && typeof o === 'object') for (const k of Object.keys(o)) { const e = o[k]; if (XCODE.test(k) && e && typeof e === 'object' && e.r && typeof e.r === 'object' && !Array.isArray(e.r)) out[k] = e; } return out; }
function cleanExam(x) {
  x = x && typeof x === 'object' ? x : {};
  const site = typeof x.site === 'string' && /^https?:\/\/[^\s/?#]+$/.test(x.site) ? x.site : EXAM_SITE;
  const pairs = [...new Set((Array.isArray(x.pairs) ? x.pairs : []).filter(p => typeof p === 'string' && examPairOk(p)))];
  const seen = new Set(); const sites = (Array.isArray(x.sites) ? x.sites : []).filter(s => s && typeof s.key === 'string' && /^[A-Za-z0-9_-]{87}$/.test(s.key) && !seen.has(s.key) && seen.add(s.key)).map(s => ({ key: s.key, made: xtNum(s.made), got: xtStr(s.got, 30), ...(xtStr(s.paired, 30) ? { paired: xtStr(s.paired, 30) } : {}) }));
  // a save made before site keys carried "paired": the key its trial proved was paired (R2-H3)
  if (x.trial && typeof x.trial.key === 'string') sites.forEach(s => { if (s.key === x.trial.key && !s.paired) s.paired = xtStr(x.trial.at, 30) || 'yes'; });
  const rows = (Array.isArray(x.rows) ? x.rows : []).filter(r => r && typeof r === 'object').map(r => ({ codes: (Array.isArray(r.codes) ? r.codes : []).filter(c => XCODE.test(c)).slice(0, 4), name: xtStr(r.name, 120) || '', line: xtNum(r.line) || 0, when: xtNum(r.when), at: xtStr(r.at, 40) || '', raw: xtStr(r.raw, 60) || '', email: !!r.email, got: xtStr(r.got, 30), who: xtWhoOf(r.who), how: ['exact', 'remembered', 'you'].includes(r.how) ? r.how : null, cands: (Array.isArray(r.cands) ? r.cands : []).map(w => xtWhoOf(w)).filter(Boolean).slice(0, 8), suggest: xtWhoOf(r.suggest), remember: xtWhoOf(r.remember) }));
  const fails = {}; if (x.fails && typeof x.fails === 'object') for (const k of Object.keys(x.fails)) { const f = x.fails[k]; if (XCODE.test(k) && f && ['none', 'format', 'key', 'signature', 'code', 'net'].includes(f.why)) fails[k] = { why: f.why, course: xtStr(f.course, 8), unit: xtNum(f.unit), at: xtStr(f.at, 30) }; }
  const strMap = (o, ok) => { const out = {}; if (o && typeof o === 'object') for (const k of Object.keys(o)) if (SAFE_KEY(k) && ok(o[k])) out[k] = o[k]; return out; };
  const recs = {}; if (x.recs && typeof x.recs === 'object') for (const k of Object.keys(x.recs)) { if (!XCODE.test(k)) continue; const e = cleanRec(x.recs[k]); if (e) recs[k] = e; }
  const locked = {}; if (x.locked && typeof x.locked === 'object') for (const k of Object.keys(x.locked)) if (XCODE.test(k) && typeof x.locked[k] === 'string' && /^[A-Za-z0-9_-]+$/.test(x.locked[k])) locked[k] = x.locked[k];
  const out = { v: 2, site, pairs, sites, trial: x.trial && typeof x.trial === 'object' && typeof x.trial.words === 'string' ? { code: xtStr(x.trial.code, 12), words: x.trial.words.slice(0, 60), at: xtStr(x.trial.at, 30), key: xtStr(x.trial.key, 90) } : null, warned: !!x.warned,
    recs, rows, fails, picks: strMap(x.picks, v => typeof v === 'string' && XCODE.test(v)), alias: strMap(x.alias, v => !!xtWhoOf(v)),
    period: strMap(x.period, v => v && typeof v === 'object' && /^\d{1,2}:\d{2}$/.test(v.from) && /^\d{1,2}:\d{2}$/.test(v.to)), view: strMap(x.view, v => typeof v === 'string' && v.length < 20), dismissed: strMap(x.dismissed, v => typeof v === 'string'), deleted: (() => { const o = {}; if (x.deleted && typeof x.deleted === 'object') for (const k of Object.keys(x.deleted)) { const d = x.deleted[k]; if (XCODE.test(k) && d && typeof d === 'object') o[k] = { at: xtStr(d.at, 30), course: xtStr(d.course, 8), unit: xtNum(d.unit), points: xtNum(d.points), of: xtNum(d.of) }; } return o; })(),
    seen: Array.isArray(x.seen) ? x.seen.filter(v => typeof v === 'string' && v.length < 200).slice(0, 6000) : null, fromSave: xtStr(x.fromSave, 30) };
  if (Object.keys(locked).length) out.locked = locked;
  // v1 → v2: a record kept opened by the build before the review has no locked text to check again. It is kept (nothing is
  // lost), with its student, as "kept by an earlier Tally": never scored until it is fetched again and checks out.
  const legacy = x.legacy && typeof x.legacy === 'object' ? x.legacy : {}; const v1 = cleanExamMap(x.loose);
  for (const k of Object.keys(v1)) if (!out.recs[k]) { out.recs[k] = { got: xtStr(v1[k].got, 30), src: 'site', who: null, no: [], nobody: false, was: null, sum: (() => { try { return cleanSum(examSum(v1[k].r)); } catch (e) { return null; } })(), legacy: true }; legacy[k] = v1[k].r; }
  out.legacy = strMap(legacy, v => v && typeof v === 'object');
  return out;
}
// v1 kept a class's records on the class (sec.exams): they move to state.exam.recs with their student (migrate() calls this)
function examMigrateClass(s) {
  const v1 = cleanExamMap(s.exams); delete s.exams; const X = state.exam;
  for (const k of Object.keys(v1)) { if (X.recs[k]) continue; const e = v1[k]; const n = typeof e.n === 'string' ? e.n : null;
    X.recs[k] = { got: xtStr(e.got, 30), src: e.src === 'file' ? 'file' : 'site', who: n ? { sec: s.key, n, how: e.pin ? 'you' : 'exact', at: xtStr(e.got, 30) } : null, no: [], nobody: false, was: null, sum: (() => { try { return cleanSum(examSum(e.r)); } catch (x) { return null; } })(), legacy: true };
    X.legacy[k] = e.r; }
}
const examS = () => (state.exam = state.exam && state.exam.v === 2 ? state.exam : cleanExam(state.exam));
const examPairs = () => examS().pairs.map(t => JSON.parse(t));
/* this browser's own: the keys it made, the site keys a trial proved here (never in a file) */
const XLOC = 'tally.exam.local';
function xtLocal() { try { const o = JSON.parse(localStorage.getItem(XLOC) || '{}'); return { mine: Array.isArray(o.mine) ? o.mine.filter(x => typeof x === 'string') : [], checked: Array.isArray(o.checked) ? o.checked.filter(x => typeof x === 'string') : [] }; } catch (e) { return { mine: [], checked: [] }; } }
function xtLocalAdd(k, v) { const o = xtLocal(); if (!o[k].includes(v)) o[k].push(v); try { localStorage.setItem(XLOC, JSON.stringify(o)); } catch (e) {} }
// the key to paste: the newest key THIS Tally made; never one that only arrived in a file
const examPub = () => { const mine = xtLocal().mine; const p = examPairs().filter(x => mine.includes(x.pub)); return p.length ? p[p.length - 1].pub : null; };
const examForeign = () => { const mine = xtLocal().mine; return examPairs().filter(x => !mine.includes(x.pub)); };
/* The site keys Tally trusts, in THIS browser only (tally.exam.local.checked): one a trial proved here, or one a Full save
   brought marked "paired" that the site itself serves now (R3-C1: a key in a file is never trusted on the file's say-so; the
   lost-laptop day is one request to the site). A key the site hands out that no trial or save vouched for (a key made
   again, a stranger's answer) is never trusted until a trial (review L6). */
const examChecked = () => { const c = xtLocal().checked; return examS().sites.filter(s => c.includes(s.key)).map(s => s.key); };
const examSavedKeys = () => { const c = xtLocal().checked; return examS().sites.filter(s => s.paired && !c.includes(s.key)); };
let xtSiteAsk = null;   // this session's question to the site about a Full save's keys: {running} | {net, t} | {ok, served, t}
try { window.addEventListener('online', () => { if (xtSiteAsk && xtSiteAsk.net) examConfirmSaved(true); }); } catch (e) {}   // the network back: ask the site again at once
function examConfirmed(key) { xtLocalAdd('checked', key); xtVer.forEach((v, c) => { if (v !== 'ok') xtVer.delete(c); }); }
async function examConfirmSaved(force) {
  if (!examSavedKeys().length || !examCan() || (xtSiteAsk && xtSiteAsk.running)) return;
  if (!force && xtSiteAsk && (!xtSiteAsk.net || Date.now() - xtSiteAsk.t < 15000)) return;   // asked already; offline: again after 15 s (or when the browser is online again)
  xtSiteAsk = { running: true, t: Date.now() };
  const r = await examGet('/api/test/key');
  if (!r.ok || !r.j || typeof r.j.key !== 'string') { xtSiteAsk = { net: true, t: Date.now() }; if (view.mode === 'tests') render(); return; }
  const hit = examSavedKeys().find(k => k.key === r.j.key); if (hit) examConfirmed(hit.key);
  xtSiteAsk = { ok: !!hit, served: r.j.key, t: Date.now() };
  if (hit) examVerifyAll(); if (view.mode === 'tests') render();
}
// a Full save carries the keys, and opening one never takes a key away from this Tally: the keys here join the save's
const examKeysNow = () => { const X = examS(); return { pairs: X.pairs.slice(), sites: X.sites.slice() }; };
function examKeepKeys(k) { const X = examS(); k.pairs.forEach(p => { if (!X.pairs.includes(p)) X.pairs.unshift(p); }); k.sites.forEach(s => { if (!X.sites.some(x => x.key === s.key)) X.sites.unshift(s); }); }
// the Tests tab's count: what needs a look in this class's newest test (the Grid tab's count works the same way)
/* The Tests tab's count (16 Nov 2026): what needs a look IN THIS CLASS. The warnings of the class's own test on screen, plus
   each test waiting for him that names one of this class's students (a row matched or suggested to them, or a test on their
   row that can't be scored as it is) and no warning already counts. A waiting test that names nobody in any class counts in
   no class's tab: it is in "Waiting for you" on every class's Tests page, where it can't be missed. */
function xtTabCount(s) { try { if (!examAll().length && !examS().rows.length) return 0; const L = xtLedger(); const { t } = xtCurrent(s);
  const fl = t ? xtModel(s, t, L).flags.filter(f => f.level === 'warn') : []; const covered = new Set(fl.map(f => f.code).filter(Boolean));
  return fl.length + L.waiting.filter(c => !covered.has(c) && xtNamesOf(c).some(w => w.sec === s.key)).length; } catch (e) { return 0; } }
// the students a held or named code points at: its own student, and whom its response rows were matched, suggested or remembered as
function xtNamesOf(code) { const X = examS(), e = X.recs[code], out = []; if (e && e.who) out.push(e.who);
  X.rows.forEach(r => { if (r.codes.includes(code)) [r.who, r.suggest, r.remember].concat(r.cands || []).forEach(w => { if (w) out.push(w); }); }); return out; }
const examConnected = () => !!(examPairs().length && examS().sites.length);
/* every record Tally holds: [{code, e, sec, n}] (sec/n: the student it is with, or null) */
function examAll() { const X = examS(); return Object.keys(X.recs).map(code => { const e = X.recs[code]; return { code, e, sec: e.who ? e.who.sec : null, n: e.who ? e.who.n : null }; }); }
function examHeld(code) { const e = examS().recs[code]; return e ? { code, e, sec: e.who ? e.who.sec : null, n: e.who ? e.who.n : null } : null; }
// the address this copy of Tally may reach (its Content-Security-Policy's connect-src)
function examAllowed(site) { const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]'); const csp = m ? m.getAttribute('content') : ''; const cs = (/connect-src([^;]*)/.exec(csp) || [, ''])[1].trim().split(/\s+/).filter(Boolean);
  if (!m) return { ok: true, list: [] }; let origin = ''; try { origin = new URL(site).origin; } catch (e) { return { ok: false, list: cs }; }
  return { ok: cs.some(x => x === origin || x === origin + '/' || (/:\*$/.test(x) && origin.startsWith(x.slice(0, -2) + ':'))), list: cs.filter(x => x !== "'none'") }; }

/* ---------------------------------------------------------------- the locked texts: IndexedDB, else Tally's own storage */
let xdb = null, xdbTried = null; const xtLocked = new Map(); let xtStoreMode = null, xtLockedReady = null;
function xdbOpen() { if (xdbTried) return xdbTried; xdbTried = new Promise(res => { try { if (!window.indexedDB) return res(null); const q = indexedDB.open('tally-tests', 1); q.onupgradeneeded = () => { try { q.result.createObjectStore('locked'); } catch (e) {} }; q.onsuccess = () => { xdb = q.result; res(xdb); }; q.onerror = () => res(null); q.onblocked = () => res(null); } catch (e) { res(null); } }); return xdbTried; }
function xdbTx(mode, fn) { return new Promise(res => { try { const tx = xdb.transaction('locked', mode); const st = tx.objectStore('locked'); const out = fn(st); tx.oncomplete = () => res(out && out.result !== undefined ? out.result : true); tx.onerror = () => res(null); tx.onabort = () => res(null); } catch (e) { res(null); } }); }
async function xdbAll() { if (!xdb) return {}; const keys = await xdbTx('readonly', st => st.getAllKeys()), vals = await xdbTx('readonly', st => st.getAll()); const o = {}; if (keys && vals) keys.forEach((k, i) => { o[k] = vals[i]; }); return o; }
async function xdbPut(obj) { if (!xdb) return false; return !!(await xdbTx('readwrite', st => { for (const k of Object.keys(obj)) st.put(obj[k], k); })); }
async function xdbClear() { await xdbOpen(); if (!xdb) return; await xdbTx('readwrite', st => st.clear()); }
// every locked text into memory; what a Full save or the fallback brought goes into IndexedDB
function examLoadLocked() {
  xtLockedReady = (async () => {
    const db = await xdbOpen(); const X = examS();
    if (db) { const all = await xdbAll(); for (const k of Object.keys(all)) if (typeof all[k] === 'string') xtLocked.set(k, all[k]); }
    const st = X.locked || {}; for (const k of Object.keys(st)) xtLocked.set(k, st[k]);
    if (db && Object.keys(st).length && await xdbPut(st)) { delete X.locked; save(); }
    xtStoreMode = db ? 'idb' : 'here';
  })();
  return xtLockedReady;
}
async function examKeepLocked(code, text) {
  xtLocked.set(code, text); await (xtLockedReady || examLoadLocked());
  if (xtStoreMode === 'idb' && await xdbPut({ [code]: text })) return;
  const X = examS(); X.locked = X.locked || {}; X.locked[code] = text; xtStoreMode = 'here';
}
// a Full save was opened: what this session opened and checked is forgotten, and the locked texts are loaded again
function examReset(saved) { const m = $('#modal'); if (m && !m.classList.contains('hidden') && m._cancel) m._cancel();   // a question open over the old data is closed, never answered into the new (R3-L2)
  if (saved) { examS().fromSave = String(saved).slice(0, 30); xtSiteAsk = null; setTimeout(() => examConfirmSaved(true), 0); } xtGen++; xtLastUndo = null; xtAutoTried.clear(); xtVer.clear(); xtOpened.clear(); xtLocked.clear(); xtLockedReady = null; examLoadLocked(); }
// what a Full save carries of Tests: everything, the locked texts included (so a Full save is still everything)
function examForSave(ex) { const X = examS(); const locked = {}; for (const k of Object.keys(X.recs)) { const t = xtLocked.get(k) || (X.locked || {})[k]; if (t) locked[k] = t; }
  const c = xtLocal().checked, now = new Date().toISOString(); const sites = (ex.sites || []).map(k => !k.paired && c.includes(k.key) ? { ...k, paired: now } : k);   // the site keys a trial proved go with the save (R2-H3)
  return { ...ex, sites, locked }; }

/* ---------------------------------------------------------------- the network: two GETs, no name in either */
async function examGet(path) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null; const t = ctl ? setTimeout(() => ctl.abort(), 15000) : null;
  try { const r = await fetch(examS().site + path, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: ctl ? ctl.signal : undefined });
    let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, ok: r.ok, j }; }
  catch (e) { return { status: 0, ok: false, j: null, net: true }; }
  finally { if (t) clearTimeout(t); }
}
// the site's signing key: kept with every one before it (a key made again on the site must not orphan old records). A key
// Tally has not been given before is kept but not trusted: no trial has proved it here (review L6).
async function examSiteKey() {
  const r = await examGet('/api/test/key'); if (!r.ok || !r.j || typeof r.j.key !== 'string') return { ok: false, net: !!r.net || !r.status, status: r.status };
  let raw; try { raw = SEALX().unb64u(r.j.key); } catch (e) { raw = null; } if (!raw || raw.length !== 65 || raw[0] !== 4) return { ok: false, bad: true };
  const X = examS(); const had = X.sites.find(s => s.key === r.j.key);
  if (had && had.paired && !xtLocal().checked.includes(had.key)) { examConfirmed(had.key); xtSiteAsk = { ok: true, served: had.key, t: Date.now() }; setTimeout(() => examVerifyAll(), 0); }   // a saved key the site serves: checked (R3-C1)
  if (!had) { X.sites.push({ key: r.j.key, made: xtNum(r.j.made), got: new Date().toISOString() }); save(); }
  return { ok: true, key: r.j.key, fresh: !had };
}
/* Open a locked record with every key Tally has (newest first) against the site keys. Throws with .why. → {rec, checked}:
   checked when a site key a trial proved in this browser signed it. A signature no known key holds makes Tally ask the site
   for its key once a batch (a key made again); a record signed by that new key is opened but not checked. */
let examKeyAsk = null;
async function examOpen(locked, code) {
  const S = SEALX(), pairs = examPairs().reverse();
  if (!pairs.length) { const e = new Error('no key'); e.why = 'nokey'; throw e; }
  const tryWith = async keys => { let last = null; if (!keys.length) { const e = new Error('no site key'); e.why = 'signature'; throw e; } for (const p of pairs) { try { return await S.open(locked, p.priv, keys, code ? { code } : undefined); } catch (e) { last = e; if (e.why !== 'key') throw e; } } throw last; };
  const checked = examChecked(), all = () => examS().sites.map(s => s.key);
  if (!all().length) { const k = await examSiteKey(); if (!k.ok) { const e = new Error('no site key'); e.why = 'nosite'; throw e; } }
  if (checked.length) { try { return { rec: await tryWith(checked), checked: true }; } catch (e) { if (e.why !== 'signature') throw e; } }
  try { return { rec: await tryWith(all()), checked: false }; }
  catch (e) { if (e.why !== 'signature') throw e; if (!examKeyAsk) examKeyAsk = examSiteKey(); await examKeyAsk; return { rec: await tryWith(all()), checked: false }; }
}

/* ---------------------------------------------------------------- checking, every session */
const xtOpened = new Map();
const xtVer = new Map();
let xtVerJob = null;
// one record: open it again from its locked text and check the signature; its summary is made again from what opened
async function examCheckOne(code) {
  const X = examS(), e = X.recs[code]; if (!e) return;
  const text = xtLocked.get(code) || (X.locked || {})[code];
  if (!text) { xtVer.set(code, e.legacy ? 'legacy' : 'missing'); return; }
  try { const { rec, checked } = await examOpen(text, code); if (rec && rec.trial) { xtVer.set(code, 'format'); return; } xtOpened.set(code, rec); e.sum = cleanSum(examSum(rec)); xtVer.set(code, checked ? 'ok' : 'unchecked'); }
  catch (err) { xtVer.set(code, ['format', 'key', 'signature', 'code'].includes(err.why) ? err.why : err.why === 'nokey' ? 'key' : 'wait'); }
}
function examVerifyAll() {
  if (xtVerJob) return xtVerJob; if (!examCan()) { Object.keys(examS().recs).forEach(c => { if (!xtVer.has(c)) xtVer.set(c, 'nocrypto'); }); return Promise.resolve(); }
  xtVerJob = (async () => { await (xtLockedReady || examLoadLocked()); const todo = Object.keys(examS().recs).filter(c => !xtVer.has(c)); if (!todo.length) return;
    xtProgressCheck(0, todo.length); let i = 0; for (const c of todo) { await examCheckOne(c); if (++i % 10 === 0) xtProgressCheck(i, todo.length); } save(); })()
    .finally(() => { xtVerJob = null; if (view.mode === 'tests') render(); });
  return xtVerJob;
}
const xtOk = code => xtVer.get(code) === 'ok';
function xtProgressCheck(i, n) { const el = $('#xtProg'); if (!el || (examJob && examJob.running)) return; el.classList.remove('hidden'); el.innerHTML = `<span class="xtSpin" aria-hidden="true"></span>Checking ${n} test${n === 1 ? '' : 's'} with the site's signature… ${i ? i + ' done' : ''}`; }

/* ---------------------------------------------------------------- keeping, and where each record belongs */
async function examPut(code, text, rec, checked, src) {
  const X = examS(); if (xtDeletedCode(code)) return;   // deleted while it was being fetched: the tombstone wins
  await examKeepLocked(code, text); if (xtDeletedCode(code)) { xtLocked.delete(code); xdbDel(code); return; }
  const was = X.recs[code]; X.recs[code] = was ? { ...was, got: new Date().toISOString(), src, legacy: undefined } : { got: new Date().toISOString(), src, who: null, no: [], nobody: false, was: null, sum: null };
  if (X.recs[code].legacy === undefined) delete X.recs[code].legacy; if (X.legacy) delete X.legacy[code];
  xtGen++; X.recs[code].sum = cleanSum(examSum(rec)); xtOpened.set(code, rec); xtVer.set(code, checked ? 'ok' : 'unchecked'); delete X.fails[code];
}
// the students of every class, for matching a typed name
// with each student's Focus Student ID where the roster or gradebook has one: a test is bound to that number (R2-C1)
function examRoster() { const out = []; for (const k of state.order) { const s = state.sections[k]; if (!s || s.placeholder) continue; const ids = {};
    try { cachedRows(s, 'all').forEach(r => { if (r.id && /^\d{4,20}$/.test(String(r.id))) ids[r.display] = String(r.id); }); const g = s.grades; if (g && Array.isArray(g.students) && Array.isArray(g.ids)) g.students.forEach((n, i) => { if (!ids[n] && g.ids[i] && /^\d{4,20}$/.test(String(g.ids[i]).trim())) ids[n] = String(g.ids[i]).trim(); }); } catch (e) {}
    classStudents(s).forEach(n => out.push({ sec: k, n, display: n, id: ids[n] || '' })); } return out; }
const xtKeyOf = w => w.sec + '\u0001' + w.n;
/* A response row to a student: only when it is certainly theirs (examcore matchName: exact and unrivaled), or by what he
   answered before when that is still the only sensible reading (fresh rows only; older rows are offered it, never given it). */
function examMatch(r, roster, fresh) {
  const X = examS(); const there = w => !!w && roster.some(x => x.sec === w.sec && x.n === w.n);
  if (r.how === 'you' && there(r.who)) return;
  const m = EX().matchName(r.name, roster, { noPick: r.email }); const at = i => ({ sec: roster[i].sec, n: roster[i].n });
  r.cands = m.cands.map(at); r.suggest = m.suggest != null ? at(m.suggest) : null; r.remember = null;
  if (m.pick != null) { r.who = at(m.pick); r.how = 'exact'; return; }
  if (r.how === 'remembered' && there(r.who) && !m.cands.some(i => !(roster[i].sec === r.who.sec && roster[i].n === r.who.n))) return;   // placed by a remembered answer, and still the only reading
  r.who = null; r.how = null;
  const al = r.name ? X.alias[EX().nameKey(r.name)] : null;
  if (al && there(al)) {
    const others = m.cands.filter(i => !(roster[i].sec === al.sec && roster[i].n === al.n));
    if (!others.length && fresh) { r.who = { sec: al.sec, n: al.n }; r.how = 'remembered'; }
    else { r.remember = { sec: al.sec, n: al.n }; r.suggest = null; }
  }
}
/* Every record to the student it belongs to. The record's entry holds its student; rows only add a placement, never take one
   away by being dropped (review C3, H2). A placement belongs to ONE CHILD, not to a name (Croix, R2-C1): it is bound to the
   student's Focus Student ID where the roster has one. When the student is no longer on their class's roster, the test
   follows them only when it is plainly the same child: the same ID in another class, or (no ID) a student of the same full
   name who is NEW in another class in the same import, while no student of that name was anywhere before it. Otherwise it
   goes back to "Nobody turned in" (gone: whose it had been, in which class) and stays there until he gives it to someone:
   a response row typed with that name is never enough to put it on a namesake. */
function examRefile() {
  xtPurge(); const X = examS(); const roster = examRoster(); const byKey = new Map(roster.map(x => [xtKeyOf(x), x]));
  const there = w => { if (!w) return false; const x = byKey.get(xtKeyOf(w)); return !!x && !(w.id && x.id && w.id !== x.id); };
  const before = X.seen ? new Set(X.seen) : null;
  X.rows.forEach(r => { if (r.who && !there(r.who)) { r.who = null; r.how = null; } if (!r.who) examMatch(r, roster, false); });
  for (const code of Object.keys(X.recs)) { const e = X.recs[code]; if (!e.who) continue;
    if (there(e.who)) { const x = byKey.get(xtKeyOf(e.who)); if (x.id && !e.who.id) e.who = { ...e.who, id: x.id }; continue; }
    let to = null;
    // by the same Student ID, and a name that shares a word with the one it had (an ID on a different name is not trusted)
    if (e.who.id && roster.some(x => x.id)) { const h = roster.filter(x => x.id === e.who.id); const w0 = new Set(norm(e.who.n).split(' ')); if (h.length === 1 && norm(h[0].n).split(' ').some(w => w.length > 1 && w0.has(w))) to = h[0]; }
    else if (before) { const k = norm(e.who.n); const h = roster.filter(x => norm(x.n) === k); const had = [...before].filter(b => norm(b.slice(b.indexOf('\u0001') + 1)) === k && b !== xtKeyOf(e.who));
      if (h.length === 1 && !before.has(xtKeyOf(h[0])) && !had.length) to = h[0]; }
    if (to) e.who = { ...e.who, sec: to.sec, n: to.n, ...(to.id ? { id: to.id } : {}) };
    else { const sec = state.sections[e.who.sec]; e.gone = { ...e.who, cl: sec ? labShort(sec.label) : (e.who.cl || '') }; e.was = e.who; e.who = null; } }
  const P = EX().placeAll(X.rows, xtEntries());
  for (const code of Object.keys(X.recs)) { const e = X.recs[code], to = P.place[code];
    if (to && (!e.who || e.who.sec !== to.sec || e.who.n !== to.n)) { const row = X.rows.find(r => r.codes.includes(code) && r.who && r.who.sec === to.sec && r.who.n === to.n); const x = byKey.get(xtKeyOf(to)); e.who = { sec: to.sec, n: to.n, ...(x && x.id ? { id: x.id } : {}), how: row && row.how ? row.how : 'exact', at: new Date().toISOString() }; e.was = null; }
    else if (!to && e.who && e.who.how !== 'you') { e.was = e.who; e.who = null; } }
  X.seen = roster.map(xtKeyOf);
  return P;
}
const xtEntries = () => { const X = examS(); return Object.keys(X.recs).map(code => { const e = X.recs[code]; return { code, who: e.who, no: e.no, nobody: e.nobody, gone: e.gone }; }); };
/* WHERE EACH TEST IS (R2-C2: nothing is ever in limbo). Every test Tally holds is in exactly one place:
     'row'     on its student's row (placed; checked this session, or being checked)
     'waiting' in "Waiting for you": two students claim it, a name Tally isn't sure of, a test taken off a student and not
               given to anyone, or one that can't be scored as it is (its locked copy missing, not checked, failed its check)
     'nobody'  in "Nobody turned in"
   The count line, the class rows and both lists are all drawn from this. → {at: {code: {where, why, st}}, row, waiting, nobody} */
const examUnfetched = () => { const X = examS(), D = X.deleted || {}, out = new Set(); X.rows.forEach(r => r.codes.forEach(c => { if (!X.recs[c] && !D[c] && (!X.fails[c] || X.fails[c].why === 'net')) out.add(c); })); return [...out]; };
const XBAD = ['missing', 'legacy', 'unchecked', 'signature', 'key', 'format', 'code', 'nocrypto'];
function xtLedger() {
  xtPurge(); const X = examS(); const P = EX().placeAll(X.rows, xtEntries()); const out = { at: {}, row: [], waiting: [], nobody: [], P };
  for (const code of Object.keys(X.recs)) { const e = X.recs[code], st = P.state[code], v = xtVer.get(code);
    const where = XBAD.includes(v) ? 'waiting' : !e.sum ? 'waiting' : st === 'placed' ? 'row' : st === 'nobody' ? 'nobody' : 'waiting';
    const why = XBAD.includes(v) ? v : !e.sum ? 'wait' : where === 'waiting' ? (st === 'shared' ? 'shared' : 'who') : st;
    out.at[code] = { where, why, st, to: P.place[code] || null }; out[where].push(code); }
  // a code a response names that Tally doesn't hold and hasn't been told about (not fetched yet, or the network failed): waiting (R3-H1)
  examUnfetched().forEach(code => { out.at[code] = { where: 'waiting', why: 'unfetched', st: null, to: null }; out.waiting.push(code); });
  return out;
}
/* A pasted or opened response sheet → rows kept (a row seen before is not added twice), matched, fetched. Rows are history:
   when there are very many, only rows whose test is placed or nobody's and that are over 2,000 rows old are let go. */
function examTakeSheet(text, from, o) {
  const X = examS(); const got = EX().readSheet(text, o); const now = new Date().toISOString();
  if (got.cols.code == null) return { ok: false, why: 'Tally found no test code in that. A code is 12 letters and digits, like K7QF-2M9D-X4TB: copy the response sheet\'s rows (or the whole sheet) and paste again.' };
  const key = r => (r.codes.join(',') || r.raw) + '|' + EX().nameKey(r.name) + '|' + (r.when || r.at);
  const have = new Set(X.rows.map(key)); const roster = examRoster(); let added = 0;
  for (const r of got.rows) { if (have.has(key(r))) continue; have.add(key(r)); const row = { codes: r.codes, name: r.name, line: r.line, when: r.when, at: r.at, raw: r.raw, email: !!r.email, got: now, who: null, how: null, cands: [], suggest: null, remember: null }; examMatch(row, roster, true); X.rows.push(row); added++; }
  if (X.rows.length > 6000) { const keep = new Set(); X.rows.slice(-2000).forEach(r => keep.add(r)); X.rows.forEach(r => { if (!r.who && r.codes.some(c => !X.recs[c] || !X.recs[c].who)) keep.add(r); }); X.rows = X.rows.filter(r => keep.has(r)); }
  if (added) xtGen++; examRefile(); save();
  const codes = [...new Set(got.rows.flatMap(r => r.codes))];
  return { ok: true, rows: got.rows.length, added, codes, cols: got.cols, alts: got.alts, header: got.header, from };
}
let examJob = null;   // {total, done, net, running}
const xtQueue = new Set();   // codes asked for while a fetch ran
const xtAutoTried = new Set();   // codes fetched without being asked this session (not fetched yet when Tests opened)
/* Fetch every code not held yet, three at a time, with a count on screen. A code the network failed on, or whose answer was not
   the site's (a filter page, HTML, a 404 that is not the site's own), is tried again by Try again; one the site answered (not
   found, not this Tally's, not signed) is not, unless asked. */
async function examFetch(codes, again) {
  if (!examCan()) { toast('This browser can\'t open test records here. Open Tally on your laptop in Chrome or Edge.', true, 7000); return; }
  if (!examPairs().length) { toast('Connect Tally first: it needs its key to open a test.', true); return; }
  if (examJob && examJob.running) { (codes || []).forEach(c => xtQueue.add(c)); render(); return; }   // a second paste while the first is fetched: queued, never dropped (R3-H1)
  codes = [...new Set((codes || []).concat([...xtQueue]))]; xtQueue.clear();
  const X = examS(); const todo = codes.filter(c => !xtDeletedCode(c) && (!X.recs[c] || X.recs[c].legacy || xtVer.get(c) === 'missing') && (again || !X.fails[c] || X.fails[c].why === 'net'));
  if (!todo.length) { render(); return; }
  if (!X.sites.length) { const k = await examSiteKey(); if (!k.ok) { toast(`Tally couldn't reach ${esc(X.site)} for the site's key. Check the network and try again.`, true, 7000); return; } }
  examJob = { total: todo.length, done: 0, net: 0, running: true }; examKeyAsk = null; xtProgress();
  const one = async code => {
    if (xtDeletedCode(code)) { examJob.done++; xtProgress(); return; }   // deleted while it waited in this pass: never asked for
    const r = await examGet('/api/test/result/' + code); const now = new Date().toISOString();
    if (r.status === 404 && r.j && r.j.error === 'none') X.fails[code] = { why: 'none', at: now };
    else if (!r.ok || !r.j || typeof r.j.record !== 'string') { X.fails[code] = { why: 'net', at: now }; examJob.net++; }
    else { try { const { rec, checked } = await examOpen(r.j.record, code); if (rec && rec.trial) X.fails[code] = { why: 'format', at: now }; else await examPut(code, r.j.record, rec, checked, 'site'); }
      catch (e) { X.fails[code] = { why: ['format', 'key', 'signature', 'code'].includes(e.why) ? e.why : 'net', at: now }; if (X.fails[code].why === 'net') examJob.net++; } }
    examJob.done++; xtProgress();
  };
  const q = todo.slice(); const lane = async () => { while (q.length) await one(q.shift()); };
  try { await Promise.all([lane(), lane(), lane()]); }
  finally { const j = examJob; j.running = false; examRefile(); save(); render();
    // anything asked for meanwhile, or named by a response and never fetched: another pass (a code the site answered is not asked again)
    const left = [...new Set([...xtQueue, ...examUnfetched().filter(c => !examS().fails[c])])]; xtQueue.clear(); left.forEach(c => xtAutoTried.add(c)); if (left.length) setTimeout(() => examFetch(left, true), 0);
    toast(j.net ? `${j.done - j.net} of ${j.total} fetched. ${plural(j.net, 'code')} couldn't reach the site's test records (no network, or something else answered): <b>Try again</b> when the network is back.` : `Fetched ${plural(j.total, 'test')}.`, !!j.net, 6000); }
}
function xtProgress() { const el = $('#xtProg'); if (!el || !examJob) return; el.classList.remove('hidden'); el.innerHTML = examJob.running ? `<span class="xtSpin" aria-hidden="true"></span>Fetching ${Math.min(examJob.done + 1, examJob.total)} of ${examJob.total}…` : ''; }
/* The cockpit's results file: every locked record of a day, opened with no network. */
async function examOpenFile(obj, name) {
  if (!examCan()) { toast('This browser can\'t open test records here. Open Tally on your laptop in Chrome or Edge.', true, 7000); return; }
  if (!examPairs().length) { toast('Connect Tally first (the Tests tab of any class): it needs its key to open these.', true, 7000); return; }
  const X = examS();
  if (!X.sites.length) { toast('Tally has no key of the site\'s yet, so it can\'t check these. Connect to the site once first (the Tests tab of any class), then open the file again.', true, 9000); return; }
  const list = Array.isArray(obj.results) ? obj.results : []; const n = { opened: 0, had: 0, failed: 0, unchecked: 0, why: {} }; examKeyAsk = null;
  const fileKey = obj.site && typeof obj.site.key === 'string' ? obj.site.key : null; const strange = fileKey && !X.sites.some(s => s.key === fileKey);
  for (const r of list) {
    const code = r && SEALX().readCode(r.code); if (!code || typeof r.record !== 'string') continue;
    if (X.recs[code] && !X.recs[code].legacy) { n.had++; continue; }
    if (xtDeletedCode(code)) { n.deleted = (n.deleted || 0) + 1; continue; }   // a test he deleted: only Bring back brings it back
    try { const { rec, checked } = await examOpen(r.record, code); if (rec.trial) continue; await examPut(code, r.record, rec, checked, 'file'); n.opened++; if (!checked) n.unchecked++; }
    catch (e) { const why = ['format', 'key', 'signature', 'code'].includes(e.why) ? e.why : 'format'; X.fails[code] = { why, course: xtStr(r.course, 8), unit: xtNum(+r.unit), at: new Date().toISOString() }; n.failed++; n.why[why] = (n.why[why] || 0) + 1; }
  }
  examRefile(); save(); render();
  const loose = examAll().filter(x => !x.sec).length;
  toast(`${esc(name || 'Results file')}: ${plural(n.opened, 'test')} opened${n.had ? `, ${n.had} already here` : ''}${n.deleted ? `, ${n.deleted} you deleted left out (Deleted tests can bring ${n.deleted === 1 ? 'it' : 'them'} back)` : ''}${loose ? ` · ${plural(loose, 'test')} not with a student yet` : ''}${n.unchecked ? ` · <b>${n.unchecked} signed by a site key this Tally hasn't checked</b>` : ''}${n.failed ? ` · <b>${n.failed} didn't open</b> (${Object.keys(n.why).map(w => xtWhyWord(w) + ' ' + n.why[w]).join(', ')}): see Tests` : ''}${strange ? ' · <b>this file names a site key Tally was never paired with</b>' : ''}.`, !!n.failed || strange || !!n.unchecked, 9000);
}
const xtWhyWord = w => ({ none: 'not on the site', format: 'not a record', key: 'another Tally\'s key', signature: 'not signed by the site', code: 'wrong code', net: 'no network' })[w] || w;

/* ---------------------------------------------------------------- Connect and the trial */
async function examMakeKey() {
  if (!examCan()) return; const X = examS();
  const k = await SEALX().makeTallyKey(); X.pairs.push(JSON.stringify({ priv: k.priv, pub: k.pub, made: new Date().toISOString() })); xtLocalAdd('mine', k.pub); X.warned = false; X.trial = null; save();
  const s = await examSiteKey(); render();
  if (!s.ok) toast(`The key is made. Tally couldn't reach ${esc(X.site)} for the site's key yet: it tries again when you enter the trial code.`, true, 7000);
}
async function examTrial(text) {
  const out = $('#xtTrialOut'); const say = (h, bad) => { if (out) { out.innerHTML = h; out.classList.toggle('bad', !!bad); } };
  const code = SEALX().readCode(text); if (!code) { say('That isn\'t a code: it is 12 letters and digits, like K7QF-2M9D-X4TB.', true); return; }
  say('<span class="xtSpin" aria-hidden="true"></span>Opening the trial…'); examKeyAsk = null;
  const r = await examGet('/api/test/result/' + code);
  if (r.status === 404 && r.j && r.j.error === 'none') { say(`The site has no record with the code ${esc(SEALX().showCode(code))}. Check the code in the cockpit (a new trial is made each time the key is pasted).`, true); return; }
  if (!r.ok || !r.j || typeof r.j.record !== 'string') { say(`Tally couldn't reach the site's test records at ${esc(examS().site)}. Check the network, then try again.`, true); return; }
  // the site's key now (a trial is signed with the key the site uses today)
  await examSiteKey();
  const S = SEALX(); let sk = null, tp = null, rec = null;
  for (const s of examS().sites.slice().reverse()) { for (const p of examPairs().reverse()) { try { rec = await S.open(r.j.record, p.priv, [s.key], { code }); sk = s.key; tp = p.pub; break; } catch (e) { if (e.why === 'format' || e.why === 'code') { say('That is not a trial record.', true); return; } } } if (sk) break; }
  if (!sk) { let why = null; try { await examOpen(r.j.record, code); } catch (e) { why = e.why; } say(why === 'key' ? 'This trial is locked to another key: the key in the cockpit is not this Tally\'s. Copy the key above and paste it into the cockpit again.' : 'The trial opened, but the site did not sign it with its key. Do not use this pairing: check the site\'s address under Connection.', true); return; }
  if (!rec || rec.trial !== true || typeof rec.nonce !== 'string') { say('That code is a student\'s test, not the cockpit\'s trial. Enter the trial code the cockpit shows next to Tally\'s key.', true); return; }
  const w = await S.words(rec.nonce, sk, tp);
  xtLocalAdd('checked', sk); { const se = examS().sites.find(x => x.key === sk); if (se) se.paired = new Date().toISOString(); } xtVer.forEach((v, c) => { if (v !== 'ok') xtVer.delete(c); });   // records waiting on this key are checked again
  examS().trial = { code, words: w, at: new Date().toISOString(), key: sk }; save(); render(); examVerifyAll();
  const ws = $('.xtWords'); if (ws) ws.scrollIntoView({ block: 'center' });
}
// the site's key: is one in use that no trial has proved in this browser? (Connect says so, and offers the trial again)
// the newest site key Tally has been given is one no trial has proved here (a key made again): Connect says so and offers the trial
const examKeyUnchecked = () => { const c = examChecked(), S = examS().sites.filter(s => !(s.paired && !c.includes(s.key))).sort((x, y) => String(x.got || '').localeCompare(String(y.got || ''))); const newest = S[S.length - 1]; return !!newest && !c.includes(newest.key); };

/* ---------------------------------------------------------------- the screens */
/* The tests a class lists, newest first: [{course, unit, key, last}]. Only a test (course + unit) one of THIS class's own
   students holds (Croix, 16 Nov 2026: "if I'm running a test in one class, why are all the other classes getting scored on
   it"). A test with no student (Nobody turned in) or waiting for him belongs to no class: it is in the two lists at the foot
   of every class's Tests page, and nowhere else. */
function xtTests(s) {
  const m = new Map(); const add = (course, unit, t) => { if (!course) return; const k = EX().testKey(course, unit); const o = m.get(k) || { course, unit, key: k, last: 0 }; o.last = Math.max(o.last, t || 0); m.set(k, o); };
  examAll().forEach(x => { const u = x.e.sum; if (u && x.sec === s.key && x.n) add(u.course, u.unit, u.finished); });
  return [...m.values()].sort((a, b) => b.last - a.last || String(a.key).localeCompare(String(b.key)));
}
// the test on screen for a class: the one he chose, else the newest; null when no student of the class holds a test
function xtCurrent(s) {
  const list = xtTests(s); const want = view.test || examS().view[s.key];
  return { t: list.find(x => x.key === want) || list[0] || null, list };
}
// a record's row view, from its verified summary
const xtV = u => u ? { points: u.points, of: u.of, seconds: u.seconds, started: u.started, finished: u.finished, away: { length: u.awayN || 0 }, awaySec: u.awaySec || 0, log: u.hasLog, ended: u.ended } : null;
/* For a response Tally can't place and whose likely students are in more than one class: what the record itself shows of
   where it was sat ("started 9:41 am with 4th Period's tests"): the class whose placed tests of the same test share its
   opening, or whose start times it falls among (Croix's rule 4: ask, but say what is known, that class's student first). */
function xtHint(r, all) {
  const code = r.codes[0], me = examS().recs[code]; if (!me || !me.sum || !xtOk(code) || !r.cands || new Set(r.cands.map(c => c.sec)).size < 2) return null;
  const u = me.sum; let best = null;
  for (const sec of new Set(r.cands.map(c => c.sec))) {
    const theirs = all.filter(x => x.sec === sec && x.code !== code && x.e.sum && xtOk(x.code) && x.e.sum.course === u.course && x.e.sum.unit === u.unit && x.e.sum.started != null);
    if (!theirs.length) return null;   // a class with nothing placed yet can't be ruled out (R2-L3)
    const same = u.opened != null && theirs.filter(x => x.e.sum.opened === u.opened).length >= Math.max(1, theirs.length / 2);
    const lo = Math.min(...theirs.map(x => x.e.sum.started)), hi = Math.max(...theirs.map(x => x.e.sum.started));
    if ((same && u.started != null && u.started >= lo - 30 * 60000 && u.started <= hi + 30 * 60000) || (u.opened == null && u.started >= lo - 15 * 60000 && u.started <= hi + 15 * 60000)) { if (best) return null; best = sec; }
  }
  return best ? { sec: best, text: 'started ' + EX().hm(u.started) + ' with ' + labShort(state.sections[best].label) + '\'s tests' } : null;
}
// what one class shows for one test: a row per student (Focus order), the records, the flags
function xtModel(s, t, L) {
  const X = examS(); const C = EX(); const all = examAll(); L = L || xtLedger(); const atRow = c => L.at[c] && L.at[c].where === 'row';
  if (!t) return { rows: [], flags: [], recs: [], rowsSeen: X.rows, L };   // a class with no test of its own: no rows, no numbers, no flags
  const recs = all.filter(x => x.e.sum).map(x => { const u = x.e.sum; return { code: x.code, course: u.course, unit: u.unit, started: u.started, finished: u.finished, seconds: u.seconds, opened: u.opened, ended: u.ended, limit: u.limit, rule: u.rule, after: u.rule && u.rule.after, unlocks: u.unlocks, awayN: u.awayN, points: u.points, of: u.of, sec: x.sec, n: x.n, how: x.e.who && x.e.who.how, no: x.e.no, nobody: x.e.nobody, was: x.e.was, gone: x.e.gone, ok: xtOk(x.code) }; });
  // rows as the flags see them: with what Tally knows of where an unplaced test was sat, and the remembered answer offered
  const D = X.deleted || {}; const rows = X.rows.filter(r => !(r.codes.length && r.codes.every(c => D[c]))).map(r => r.codes.some(c => D[c]) ? { ...r, codes: r.codes.filter(c => !D[c]) } : r).map(r => { if (r.who || !r.codes.length) return r; const h = xtHint(r, all); if (!h) return r; const cands = r.cands.slice().sort((p, q) => (q.sec === h.sec) - (p.sec === h.sec)); return { ...r, hint: h.text, cands, suggest: r.suggest && r.suggest.sec === h.sec ? r.suggest : r.suggest }; });
  const fl = C.flags({ sec: s.key, prep: s.prep, course: t.course, unit: t.unit, period: X.period[s.key] || null, rows, recs, fails: X.fails, picks: X.picks, known: all.filter(x => !x.sec).map(x => x.code), show: shown, hideText: !!state.settings.hideNames }).filter(f => !X.dismissed[f.id]);
  const studs = classStudents(s); const here = x => x.e.sum && x.e.sum.course === t.course && x.e.sum.unit === t.unit;
  const rowsOut = studs.map((n, i) => { const mine = all.filter(x => x.sec === s.key && x.n === n && here(x) && atRow(x.code)).map(x => ({ code: x.code, e: x.e, ok: xtOk(x.code) })); const held = all.filter(x => x.sec === s.key && x.n === n && here(x) && !atRow(x.code)).map(x => x.code).concat(X.rows.filter(r => r.who && r.who.sec === s.key && r.who.n === n && r.codes.some(c => L.at[c] && L.at[c].why === 'unfetched')).map(r => r.codes[0]));
    const okd = mine.filter(x => x.ok); const pk = X.picks[s.key + '|' + n + '|' + t.key]; const use = okd.length === 1 && mine.length === 1 ? okd[0] : okd.find(x => x.code === pk) || null;
    return { i, n, mine, held, use, v: use ? xtV(use.e.sum) : null, flags: fl.filter(f => (f.names || []).includes(n)) }; });
  return { rows: rowsOut, flags: fl, recs, rowsSeen: rows, L };
}
// the count that must always add up (Croix: "placed + waiting for you + nobody turned in = records held")
function xtCounts(L) { L = L || xtLedger(); const n = { held: Object.keys(L.at).length, placed: L.row.length, waiting: L.waiting.length, nobody: L.nobody.length }; return n; }
const xtVerdict = (v, almost) => almost ? '<span class="xtV almost">Almost</span>' : v === 'right' ? '<span class="xtV right">Right</span>' : v === 'wrong' ? '<span class="xtV wrong">Not right</span>' : v === 'blank' ? '<span class="xtV blank">Blank</span>' : v === 'some' ? '<span class="xtV some">Part right</span>' : '<span class="xtV unread">Can\'t read</span>';
const xtWhen = ms => { if (ms == null) return ''; const d = new Date(ms); return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ', ' + EX().hm(ms); };
const xtPct = (p, of) => p != null && of ? Math.round(p / of * 100) : null;
// what Connect says of a Full save's pairing in this browser (R3-C1)
function xtSaveWords() { const X = examS(); const day = X.fromSave ? ' of ' + esc(fmtDate(localDay(X.fromSave))) : '';
  if (examChecked().length && !examKeyUnchecked()) return ` (from your Full save${day}, checked with the site${xtSiteAsk && xtSiteAsk.ok ? ' today' : ''})`;
  if (xtSiteAsk && xtSiteAsk.net) return ` (from your Full save${day}) · <em>not checked yet: the site could not be reached. Tally asks again by itself</em>`;
  if (xtSiteAsk && xtSiteAsk.served) return ` (from your Full save${day}) · <em>the site's key now is not the one in your save: tests signed with the save's key can't be checked here. Enter a trial code to check the site's current key</em>`;
  if (!examSavedKeys().length && !examChecked().length) return ` · <em>this Tally hasn't checked the site's key yet: enter a trial code</em>`;
  return ` (from your Full save${day}) · <em>checking with the site…</em>`; }
const xtHost = () => { const X = examS(); try { return new URL(X.site).host; } catch (e) { return X.site; } };
// where a test is opened and closed (16 Nov 2026: Croix looked for it in Tally): said once, quietly, with the site's teacher page
const xtSiteHint = () => `Tests are opened and closed on the site, on the cockpit's Test card: <a href="${esc(examS().site.replace(/\/+$/, ''))}/teacher/" target="_blank" rel="noopener noreferrer">${esc(xtHost())}/teacher ↗</a>`;
function xtStatusHtml() {
  const X = examS(); const P = examPairs(); const host = (() => { try { return new URL(X.site).host; } catch (e) { return X.site; } })();
  if (!examCan()) return `<div class="notice info xtCan"><span>${ico('info')}</span><span><b>This browser can't open test records here.</b> It has no Web Crypto in this window (a file opened from a tablet's file manager is one such place). The tests Tally has already opened are below; to connect or to fetch new ones, open Tally on your laptop in Chrome or Edge.</span></div>`;
  const state1 = !P.length ? 'off' : !X.sites.length ? 'half' : 'on';
  return `<div class="xtConn ${state1}" role="status"><i aria-hidden="true"></i><span>${state1 === 'on' ? `<b>Connected</b> to ${esc(host)}${!examPub() && examForeign().length && (X.fromSave || examSavedKeys().length) ? xtSaveWords() : !examChecked().length ? ' · <em>this Tally hasn\'t checked the site\'s key yet: enter a trial code</em>' : examKeyUnchecked() ? ' · <em>the site\'s key changed: check it with a new trial code</em>' : X.trial ? ` · pairing checked ${esc(fmtDate(localDay(X.trial.at)))}` : ' · <em>pairing not checked yet</em>'}` : state1 === 'half' ? `<b>Not connected yet:</b> Tally has its key but not ${esc(host)}'s` : `<b>Not connected</b> to ${esc(host)}`}</span><button class="linkbtn" id="xtConnBtn">${state1 === 'on' ? 'Connection' : 'Connect'}</button></div>`;
}
function renderTests(s) {
  const X = examS();
  if (view.connect || !examPairs().length || (!X.trial && !examAll().length && !X.rows.length)) { view.connect = true; return xtConnectPage(s); }
  const wrap = $('#gridwrap'); examRefile(); examConfirmSaved(false);
  if (examCan() && examPairs().length && !(examJob && examJob.running)) { const u = examUnfetched().filter(c => !X.fails[c] && !xtAutoTried.has(c)); if (u.length) { u.forEach(c => xtAutoTried.add(c)); setTimeout(() => examFetch(u), 0); } }   // codes a response names that were never fetched (a reload mid-fetch)
  if (Object.keys(X.recs).some(c => !xtVer.has(c))) examVerifyAll();
  if (view.code) return renderTestDetail(s, view.code);
  const { t, list } = xtCurrent(s); const L = xtLedger(); const M = xtModel(s, t, L); const C = EX(); const H = !!state.settings.hideNames;
  const got = M.rows.filter(r => r.use), pts = got.map(r => xtPct(r.v.points, r.v.of)).filter(v => v != null).sort((a, b) => a - b);
  const mean = pts.length ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length) : null, med = pts.length ? (pts.length % 2 ? pts[(pts.length - 1) / 2] : Math.round((pts[pts.length / 2 - 1] + pts[pts.length / 2]) / 2)) : null;
  const left = got.filter(r => r.v.away.length).length, times = got.map(r => r.v.seconds).filter(v => v != null).sort((a, b) => a - b);
  const warns = M.flags.filter(f => f.level === 'warn'), infos = M.flags.filter(f => f.level !== 'warn');
  const sort = view.xsort || 'focus'; const rows = M.rows.slice();
  const k = { name: r => r.n.toLowerCase(), score: r => r.use ? -(xtPct(r.v.points, r.v.of) ?? -1) : 1e9, time: r => r.use ? (r.v.seconds ?? 1e9) : 1e9 + 1, away: r => r.use ? -(r.v.awaySec + r.v.away.length * 1e-3) : 1e9, done: r => r.use ? (r.v.finished ?? 9e15) : 9e15 + 1 }[sort];
  if (k) rows.sort((a, b) => (k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : a.i - b.i)); else rows.sort((a, b) => (!!b.use - !!a.use) || a.i - b.i);
  const per = X.period[s.key];
  const fact = (lbl, val, sub, cls) => `<div class="gcard ${cls || ''}"><small>${lbl}</small><b>${val}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
  const th = (id, lbl, cls) => `<th class="${cls || ''}" aria-sort="${sort === id ? 'ascending' : 'none'}"><button class="xtSort ${sort === id ? 'on' : ''}" data-xsort="${id}">${lbl}</button></th>`;
  const CHIP = { shared: 'Shared code', none: 'Not found', format: 'Not a record', key: 'Other key', signature: 'Not signed', code: 'Wrong code', net: 'Not fetched', twice: 'Two tests', left: 'Ended: left', period: 'Outside period', apart: 'Apart from class', opening: 'Other opening', rule: 'Rule not kept', long: 'Long sitting', teacher: 'Not finished', time: 'Out of time', other: 'Other test', unclaimed: 'Nobody', who: 'Who?', badcode: 'Bad code', makeup: 'Make-up?', groups: 'Two groups' };
  const flagChip = f => `<span class="xtChip ${f.level}">${esc(CHIP[f.kind] || f.kind)}</span>`;
  const HOW = { exact: '', remembered: 'remembered', you: 'given by you' };
  const row = r => { const v = r.v;
    if (!r.use) { const f = r.flags; const wait = r.mine.filter(x => !x.ok); return `<tr class="none"><td class="xtNo">${r.i + 1}</td><td class="stu"><button class="nm nmbtn" data-prof="${esc(r.n)}">${esc(shown(r.n))}</button></td><td colspan="4" class="xtMissing">${r.mine.filter(x => x.ok).length > 1 ? `${r.mine.length} tests: choose the one that counts` : wait.length ? 'Checking its test…' : r.held.length ? 'Its test is waiting for you: see <a href="#xtWaiting">Waiting for you</a>, below' : f.length ? 'See what to look at, above' : 'No test turned in'}</td><td>${f.map(flagChip).join('')}</td></tr>`; }
    const pc = xtPct(v.points, v.of); const how = r.use.e.who && HOW[r.use.e.who.how];
    return `<tr data-xcode="${r.use.code}" tabindex="0" title="Open ${esc(shown(r.n))}'s test"><td class="xtNo">${r.i + 1}</td><td class="stu"><span class="nm">${esc(shown(r.n))}</span>${how ? `<small class="xtHow">${esc(how)}</small>` : ''}</td>
      <td class="xtScore"><b>${v.points ?? '?'}</b><small>/ ${v.of ?? '?'}</small><span class="xtBar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, pc ?? 0))}%"></i></span><em>${pc == null ? '' : pc + '%'}</em></td>
      <td class="num">${esc(C.clock(v.seconds))}</td>
      <td class="num ${v.away.length ? 'away' : ''}">${v.log ? (v.away.length ? `${v.away.length} · ${esc(C.dur(v.awaySec))}` : '<span class="xtNone">none</span>') : '<span class="xtNone">no log</span>'}</td>
      <td class="xtFin">${esc(xtWhen(v.finished))}</td><td class="xtFl">${r.flags.map(flagChip).join('')}<button class="linkbtn xtNot" data-xnot="${r.use.code}" title="This test isn't ${esc(shown(r.n))}'s: take it off them and say whose it is">Not theirs</button></td></tr>`; };
  const fbtn = f => {   // the button that does something about each flag
    if (f.kind === 'shared') return `<button class="pill small" data-xshare="${f.code}">Say whose it is</button>`;
    if (f.kind === 'who') { const i = X.rows.findIndex(r => r.line === f.rows[0].line && r.codes.join() === f.rows[0].codes.join() && r.name === f.rows[0].name); return f.suggest ? `<span class="xtBtns"><button class="pill small" data-xyes="${i}" data-sec="${esc(f.suggest.sec)}" data-n="${esc(f.suggest.n)}">Yes</button><button class="pill small pale" data-xwho="${i}">Someone else</button></span>` : `<button class="pill small" data-xwho="${i}">Choose the student</button>`; }
    if (f.kind === 'unclaimed') return `<span class="xtBtns"><button class="pill small pale" data-xcode="${f.code}">Open</button><button class="pill small" data-xgive="${f.code}">Give it to a student</button></span>`;
    if (f.kind === 'none' && f.near && f.near.length && f.rows && f.rows[0] && f.rows[0].who) return `<button class="pill small" data-xnear="${f.code}" data-to="${f.near[0]}">Give ${esc(SEALX().showCode(f.near[0]))} to ${esc(shown(f.rows[0].who.n))}</button>`;
    if (f.kind === 'twice') return `<button class="pill small" data-xtwice="${esc(f.names[0])}">Choose the one that counts</button>`;
    if (['left', 'period', 'apart', 'opening', 'rule', 'long', 'teacher', 'time', 'makeup'].includes(f.kind)) return `<button class="pill small pale" data-xcode="${f.code}">Open the test</button>`;
    if (f.kind === 'other') return `<button class="pill small pale" data-xtest="${esc(C.testKey(f.course, f.unit))}">Open ${esc(C.testName(f.course, f.unit))}</button>`;
    if (!examCan()) return '';
    if (f.kind === 'net') return `<button class="pill small" data-xretry="1">Try again</button>`;
    if (f.kind === 'code' || f.kind === 'format') return `<button class="pill small pale" data-xagain="${f.code}">Fetch again</button>`;
    return ''; };
  const flagRow = f => `<li class="${f.level}"><span class="xtFi">${ico(f.level === 'warn' ? 'warn' : 'info')}</span><div><b>${esc(f.text)}</b><p>${esc(f.todo)}</p></div><div class="xtAct">${fbtn(f)}<button class="linkbtn xtDis" data-xdis="${esc(f.id)}" title="Dismiss: it goes to the dismissed list at the foot of Tests, where it can be brought back">Dismiss</button></div></li>`;
  const empty = !t;
  const more = view.xflags ? warns.length : Math.min(warns.length, warns.length > 4 ? 3 : 4);
  const title = list.length > 1 ? `<label class="xtTitle xtTitleSel"><span class="vh">Test</span><select id="xtPick">${list.map(x => `<option value="${esc(x.key)}" ${t && x.key === t.key ? 'selected' : ''}>${esc(C.testName(x.course, x.unit))}</option>`).join('')}</select></label>` : `<h2 class="xtTitle">${list.length ? esc(C.testName(t.course, t.unit)) : 'Tests'}</h2>`;
  const cnt = xtCounts(L);
  const alias = Object.entries(X.alias), dism = Object.entries(X.dismissed), dels = Object.entries(X.deleted || {}).sort((a, b) => String(b[1].at).localeCompare(String(a[1].at)));
  const quiet = alias.length || dism.length || dels.length ? `<details class="xtQuiet" ${view.xquiet ? 'open' : ''}><summary>What Tally remembers (${alias.length}) · dismissed (${dism.length})${dels.length ? ` · deleted tests (${dels.length})` : ''}</summary><div class="xtQuietBody">
      ${alias.length ? `<h4>Names you answered</h4><ul>${alias.map(([k, w], ai) => `<li><span>“${esc(H ? mask(k) : k)}” is ${esc(shown(w.n))}${state.sections[w.sec] ? ` <small>${esc(labShort(state.sections[w.sec].label))}</small>` : ''}${w.at ? ` <small>since ${esc(fmtDate(localDay(w.at)))}</small>` : ''}</span><button class="linkbtn" data-xforget="${ai}">Forget</button></li>`).join('')}</ul><p class="ghint">Tally uses an answer only when the same words could mean nobody else; otherwise it asks, with this student first.</p>` : ''}
      ${dism.length ? `<h4>Dismissed</h4><ul>${dism.map(([id, at]) => `<li><span>${esc(xtDismissText(id))} <small>${esc(fmtDate(localDay(at)))}</small></span><button class="linkbtn" data-xundis="${esc(id)}">Bring back</button></li>`).join('')}</ul>` : ''}
      ${dels.length ? `<h4 id="xtDeleted">Deleted tests</h4><ul>${dels.map(([code, d]) => `<li><span><span class="xtCode">${esc(SEALX().showCode(code))}</span> · ${esc(d.course ? C.testName(d.course, d.unit) : 'a test')}${d.points != null ? ` · ${d.points} / ${d.of}` : ''} <small>deleted ${esc(fmtDate(localDay(d.at)))}</small></span><button class="linkbtn" data-xback="${code}">Bring back</button></li>`).join('')}</ul><p class="ghint">Tally doesn't keep these. Bring back fetches the test from the site again.</p>` : ''}</div></details>` : '';
  wrap.innerHTML = `<div class="grades xt">
    <div class="xtTop">${title}<div class="xtTopR">${xtStatusHtml()}${list.length ? `<button class="linkbtn xtPerBtn" id="xtPeriod" title="When this class meets: a test started or finished outside it is flagged">${per ? `Period ${esc(xtHp(per.from))}–${esc(xtHp(per.to))}` : 'Set the period\'s times'}</button>` : ''}</div></div>
    ${empty ? '' : `<p class="ghint xtSiteHint">${xtSiteHint()}</p>`}
    <div id="xtProg" class="xtProg ${examJob && examJob.running ? '' : 'hidden'}"></div>${xtStoreLine()}
    ${empty ? `<div class="gempty xtEmpty"><h3>${examAll().length || X.rows.length ? `No test for ${esc(labShort(s.label))} yet` : 'No tests here yet'}</h3><p>${examAll().length || X.rows.length ? `A test shows here once one of this class's own students has one. A code Tally can't put with a student waits below, under Waiting for you or Nobody turned in, and counts in no class.` : `When students finish a test on ${esc(xtHost())} they turn in a code through your Google Form. Copy the rows of the form's response sheet and paste them here, or open the cockpit's results file. Tally fetches each test, opens it and puts it with the student.`}</p><div class="rp-actions"><button class="pill" id="xtPaste2">Paste responses</button><button class="pill pale" id="xtOpen2">Open a file</button></div><p class="ghint xtSiteHint">${xtSiteHint()}</p></div>` : `
    <div class="gcards">
      ${fact('Turned in', `${got.length}<i class="xtOf"> of ${M.rows.length}</i>`, M.rows.length - got.length ? `${M.rows.length - got.length} without a test` : 'everyone')}
      ${fact('Class average', mean == null ? '—' : mean + '%', med == null ? '' : `median ${med}%`)}
      ${fact('Time', times.length ? esc(C.clock(times[Math.floor(times.length / 2)])) : '—', times.length ? `median · ${esc(C.clock(times[0]))} to ${esc(C.clock(times[times.length - 1]))}` : '')}
      ${fact('Left the test', String(left), left ? `${plural(left, 'student')}, ${got.reduce((a, r) => a + r.v.away.length, 0)} times in all` : 'nobody', left ? 'warnish' : '')}
    </div>
    ${warns.length ? `<section class="xtFlags" aria-label="What doesn't add up"><h3>${plural(warns.length, 'thing')} to look at</h3><ul>${warns.slice(0, more).map(flagRow).join('')}</ul>${warns.length > more ? `<button class="linkbtn xtMoreFlags" id="xtMoreFlags">${warns.length - more} more</button>` : view.xflags && warns.length > 4 ? '<button class="linkbtn xtMoreFlags" id="xtMoreFlags">Show fewer</button>' : ''}</section>` : ''}
    <section class="gsec xtTable"><table class="checkTable xtList"><thead><tr><th class="xtNo">#</th>${th('name', 'Student')}${th('score', 'Score')}${th('time', 'Time', 'num')}${th('away', 'Away', 'num')}${th('done', 'Finished')}<th>Flags</th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table>
      <p class="ghint xtHonest">Score, time and finish are the site's own, checked with its signature when Tally opened them today. Away, and everything else a test shows about the sitting, is what the student's device reported: evidence, not proof.</p></section>
    ${infos.length ? `<section class="xtFlags info"><ul>${infos.map(flagRow).join('')}</ul></section>` : ''}`}
    ${xtLedgerHtml(L)}
    <p class="xtCount" id="xtCount">All classes: ${plural(cnt.held, 'test')} = ${cnt.placed} with a student + ${cnt.waiting} waiting for you + ${cnt.nobody} nobody turned in.</p>
    ${quiet}
  </div>`;
  xtWire(s, t, M);
  if (examJob && examJob.running) xtProgress(); else if (xtVerJob) xtProgressCheck(0, Object.keys(X.recs).filter(c => !xtVer.has(c)).length);
}
/* "Waiting for you" and "Nobody turned in": every test held that is not on a student's row, from every class and every test,
   each with what can be done about it. Neither list can be dismissed: a test leaves it only by being placed. */
const XWHY = { shared: 'Two students turned in this code', who: 'Tally isn\'t sure whose this is', missing: 'Its locked copy is missing from this browser: fetch it again', legacy: 'Kept by an earlier build of Tally without its locked copy: fetch it again',
  unchecked: 'Signed by a key this Tally has not checked: connect to the site once, or run a trial (Connection)', signature: 'What is stored was not signed by the site (a changed Full save?): never scored', key: 'Locked to a key this Tally doesn\'t have',
  format: 'What is stored is not a test record', unfetched: 'Not fetched yet', code: 'What is stored answers to another code', nocrypto: 'This browser can\'t check test records here: open Tally on your laptop in Chrome or Edge', wait: 'Being checked' };
function xtUnfetchedWords(code) { const f = examS().fails[code]; return f && f.why === 'net' ? ` The site couldn't be reached for it (${esc(fmtDate(localDay(f.at)))}): fetch it again when the network is back.` : examJob && examJob.running ? ' It is in the queue: Tally fetches it next.' : ''; }
function xtLedgerHtml(L) {
  const X = examS(); const C = EX(); if (!L.waiting.length && !L.nobody.length) return '';
  const sumOf = code => { const e = X.recs[code], u = e && e.sum; return u && xtOk(code) ? `${u.points} / ${u.of}, taken ${C.hm(u.started)}–${C.hm(u.finished)}` : ''; };
  const testOf = code => { const u = X.recs[code] && X.recs[code].sum; return u && u.course ? C.testName(u.course, u.unit) : X.recs[code] ? 'A test' : 'A code turned in'; };
  const rowsOf = code => X.rows.filter(r => r.codes.includes(code));
  const item = (code, body, btns) => `<li data-xled="${code}"><div><b>${esc(testOf(code))}</b> · <span class="xtCode">${esc(SEALX().showCode(code))}</span>${sumOf(code) ? ` · ${esc(sumOf(code))}` : ''}<p>${body}</p></div><div class="xtAct">${btns}<button class="linkbtn xtDel" data-xdel="${code}" title="Delete this test from Tally (it can be brought back from Deleted tests)">Delete</button></div></li>`;
  const W = L.waiting.map(code => { const a = L.at[code], e = X.recs[code] || { no: [] }, rs = rowsOf(code); const who = e.who ? ` It is ${esc(shown(e.who.n))}'s.` : '';
    const typed = rs.length ? ` Turned in as ${rs.map(r => `<b>${esc(shown(r.who ? r.who.n : r.name || 'no name'))}</b> (row ${r.line})`).join(' and ')}.` : '';
    const not = (e.no || []).length ? ` Not ${e.no.map(w => esc(shown(w.n))).join(' or ')}'s (you said so).` : '';
    const gone = X.fails[code] && X.fails[code].why === 'none' && ['missing', 'legacy'].includes(a.why) ? ` <b>The site no longer has it</b> (asked ${esc(fmtDate(localDay(X.fails[code].at)))}): the score is still in the cockpit's results for that day.` : '';
    const btn = ['missing', 'legacy', 'unfetched'].includes(a.why) && examCan() ? `<button class="pill small" data-xrefetch="${code}">Fetch again</button>` : a.why === 'unchecked' ? '<button class="pill small pale" data-xconn="1">Connection</button>'
      : a.why === 'shared' ? `<button class="pill small" data-xshare="${code}">Say whose it is</button>` : a.why === 'who' ? `<button class="pill small" data-xgive="${code}">Give it to a student</button><button class="pill small pale" data-xnobody="${code}">Nobody yet</button>` : '';
    const why2 = a.why === 'unchecked' ? (xtSiteAsk && xtSiteAsk.net ? ' The site could not be reached: Tally asks again by itself.' : xtSiteAsk && xtSiteAsk.served && !xtSiteAsk.ok && examSavedKeys().length ? ' The site\'s key now is a different one: a test signed with a key the site has since replaced can\'t be checked in this browser; its score is in the cockpit.' : '') : a.why === 'unfetched' ? xtUnfetchedWords(code) : '';
    return item(code, `${esc(XWHY[a.why] || a.why)}.${a.why === 'who' || a.why === 'shared' || a.why === 'unfetched' ? typed + not : who}${why2}${gone}`, btn); });
  const N = L.nobody.map(code => { const e = X.recs[code]; const g = e.gone;
    return item(code, g ? `It had been ${g.how === 'you' ? 'given to' : 'with'} ${esc(shown(g.n))}${g.cl ? ` (${esc(g.cl)})` : ''}, who is no longer on that roster.` : e.nobody ? 'You said nobody yet.' : 'Nobody turned this code in.', `${xtOk(code) ? `<button class="pill small pale" data-xcode="${code}">Open</button>` : ''}<button class="pill small" data-xgive="${code}">Give it to a student</button>`); });
  const again = L.waiting.filter(c => ['missing', 'legacy', 'unfetched'].includes(L.at[c].why));
  return `${W.length ? `<section class="xtLedger" id="xtWaiting" aria-label="Waiting for you"><h3>Waiting for you <span>${W.length}</span></h3><p class="ghint">Tests that are on nobody's row yet, from every class. Each counts for nobody until you say.${again.length > 1 && examCan() ? ` <button class="pill small" data-xrefetch="${again.join(',')}">Fetch all ${again.length} again</button>` : ''}</p><ul>${W.join('')}</ul></section>` : ''}
    ${N.length ? `<details class="xtLedger" id="xtNobody" ${view.xnobody === false ? '' : 'open'}><summary><h3>Nobody turned in <span>${N.length}</span></h3></summary><ul>${N.join('')}</ul></details>` : ''}`;
}
const xtHp = x => { const m = /^(\d{1,2}):(\d{2})$/.exec(x || ''); if (!m) return x; const h = +m[1]; return (h % 12 || 12) + ':' + m[2] + (h < 12 ? ' am' : ' pm'); };
// a dismissed flag, in words, from its id (kind|code|names|row)
function xtDismissText(id) { const [kind, code, names] = String(id).split('|'); const W = { shared: 'Shared code', none: 'Code not on the site', format: 'Not a record', key: 'Another Tally\'s key', signature: 'Not signed', twice: 'Two tests', left: 'Ended by leaving', period: 'Outside the period', apart: 'Apart from the class', opening: 'Another opening', rule: 'The rule not kept', long: 'Long sitting', teacher: 'Not finished', time: 'Out of time', unclaimed: 'Nobody turned it in', who: 'Who turned it in', badcode: 'Not a code', makeup: 'A make-up?', groups: 'Two groups', net: 'Not fetched' };
  return (W[kind] || kind) + (names ? ': ' + names.split(',').map(n => shown(n)).join(', ') : '') + (code && XCODE.test(code) ? ' · ' + SEALX().showCode(code) : ''); }
/* Storage (review H3): the locked texts live in IndexedDB; Tests warns at 70% of what the browser gives either store. */
let xtQuota = null;
function xtStoreLine() {
  if (navigator.storage && navigator.storage.estimate && !xtQuota) { xtQuota = { pending: true }; navigator.storage.estimate().then(q => { xtQuota = q || {}; if (view.mode === 'tests' && q && q.quota && q.usage / q.quota >= 0.7) render(); }).catch(() => { xtQuota = {}; }); }
  const u = storageUse(); const q = xtQuota && xtQuota.quota ? xtQuota : null;
  const lsPct = u.pct, idbPct = q ? Math.round(q.usage / q.quota * 100) : 0; const here = xtStoreMode === 'here' && Object.keys(examS().recs).length > 0;
  const only = here ? `<div class="notice info xtStore" role="status"><span>${ico('info')}</span><span><b>This browser gives Tally no separate place for test records</b> (no IndexedDB here), so your tests are kept only in Tally's own storage in this browser, which also holds everything else. <b>Your Full save is the only other copy:</b> make one after every batch of tests.</span><button class="pill small pale" id="xtStoreSave">Full save</button></div>` : '';
  if (lsPct < (here ? 40 : 70) && idbPct < 70) return only;
  const tests = (() => { try { return JSON.stringify(examS()).length; } catch (e) { return 0; } })();
  const lsW = lsPct >= (here ? 40 : 70);
  return `<div class="notice xtStore" role="status"><span>${ico('warn')}</span><span><b>${lsW ? `This browser's room for Tally is ${lsPct}% full` : `This browser's room for test records is ${idbPct}% full`}</b> (${lsW ? `${u.mb(u.total)} of about ${u.mb(u.quota)} MB; Tests is ${u.mb(tests)} MB of it` : `${(q.usage / 1048576).toFixed(1)} of ${(q.quota / 1048576).toFixed(0)} MB`}). Make a Full save now and keep it in your school Drive: it holds everything. When the room is full, Tally can't save new work in this browser.${here ? ' Tests are kept only here and in your Full saves.' : ''}</span><button class="pill small" id="xtStoreSave">Full save</button></div>`;
}
function testsBarHtml(s) {
  if (view.code) { const h = examHeld(view.code); const u = h && h.e.sum; return `<div class="crumb"><button id="xtBack">‹ Tests</button><h2>${u ? esc(EX().testName(u.course, u.unit)) : 'Tests'}</h2></div>`; }
  if (!examPairs().length || view.connect) return `<span class="meta">Tests taken on the website, opened with Tally's own key</span>`;
  return `<div class="spacer"></div><button class="pill toggle" id="xtCopy" title="Every student's points, in Focus order, to paste into the Focus column">Copy scores</button><button class="pill toggle" id="xtOpen" title="The response sheet saved as CSV, or the cockpit's results file">Open a file</button><button class="pill" id="xtPaste">Paste responses</button>`;
}
function xtWire(s, t, M) {
  const wrap = $('#gridwrap'); const on = (sel, fn) => wrap.querySelectorAll(sel).forEach(b => b.onclick = e => { e.stopPropagation(); fn(b, e); });
  on('#xtConnBtn', () => { view.connect = true; render(); }); on('[data-xconn]', () => { view.connect = true; render(); });
  on('[data-xcode]', b => { view.code = b.dataset.xcode; render(); window.scrollTo(0, 0); });
  wrap.querySelectorAll('tr[data-xcode]').forEach(tr => tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); view.code = tr.dataset.xcode; render(); } });
  on('[data-prof]', b => openProfile(s.key, b.dataset.prof));
  on('[data-xsort]', b => { view.xsort = view.xsort === b.dataset.xsort ? 'focus' : b.dataset.xsort; render(); });
  on('[data-xtest]', b => { view.test = b.dataset.xtest; examS().view[s.key] = b.dataset.xtest; save(); render(); });
  // Try again: every code the network (or something that wasn't the site) failed on, in one batch
  on('[data-xretry]', () => examFetch(Object.keys(examS().fails).filter(c => examS().fails[c].why === 'net'), true));
  on('[data-xagain]', b => { delete examS().fails[b.dataset.xagain]; examFetch([b.dataset.xagain], true); });
  on('[data-xrefetch]', b => examFetch(b.dataset.xrefetch.split(','), true));
  on('[data-xshare]', b => xtChoose(s, b.dataset.xshare, 'shared'));
  on('[data-xgive]', b => xtChoose(s, b.dataset.xgive, 'give'));
  on('[data-xwho]', b => xtWho(s, examS().rows[+b.dataset.xwho]));
  on('[data-xyes]', b => { const r = examS().rows[+b.dataset.xyes]; if (r) xtAnswer(r, { sec: b.dataset.sec, n: b.dataset.n }); });
  on('[data-xnot]', b => xtNotTheirs(s, b.dataset.xnot));
  on('[data-xtwice]', b => xtTwice(s, t, b.dataset.xtwice));
  on('[data-xnear]', b => { const f = M.flags.find(x => x.code === b.dataset.xnear); const who = f && f.rows[0] && f.rows[0].who; if (!who) return; xtGive(b.dataset.to, who); });
  on('[data-xdis]', b => xtDo(() => { examS().dismissed[b.dataset.xdis] = new Date().toISOString(); }, 'Dismissed. It is in the dismissed list at the foot of Tests.'));
  on('[data-xundis]', b => { view.xquiet = true; xtDo(() => { delete examS().dismissed[b.dataset.xundis]; }, 'Brought back.'); });
  on('[data-xforget]', b => { view.xquiet = true; xtDo(() => { const k = Object.keys(examS().alias)[+b.dataset.xforget]; if (k != null) delete examS().alias[k]; }, 'Forgotten. Tally asks about that name again.'); });
  on('[data-xnobody]', b => xtNobody(b.dataset.xnobody));
  on('[data-xdel]', b => xtDeleteAsk(b.dataset.xdel)); on('[data-xback]', b => { view.xquiet = true; xtBringBack(b.dataset.xback); });
  on('#xtStoreSave', () => saveFull());
  on('#xtPaste2', () => xtPasteBox()); on('#xtOpen2', () => xtFilePick()); on('#xtPeriod', () => xtPeriodBox(s)); on('#xtMoreFlags', () => { view.xflags = !view.xflags; render(); });
  const q = wrap.querySelector('.xtQuiet'); if (q) q.ontoggle = () => { view.xquiet = q.open; };
  const nb = wrap.querySelector('#xtNobody'); if (nb) nb.ontoggle = () => { view.xnobody = nb.open; };
  const pk = wrap.querySelector('#xtPick'); if (pk) pk.onchange = () => { view.test = pk.value; examS().view[s.key] = pk.value; save(); render(); };
  const tr = wrap.querySelectorAll('tr[data-xcode]'); tr.forEach(r => r.onclick = () => { view.code = r.dataset.xcode; render(); window.scrollTo(0, 0); });
}
function xtBarWire(s) {
  const b = $('#bar'); if (!b) return; const on = (id, fn) => { const x = b.querySelector(id); if (x) x.onclick = fn; };
  on('#xtBack', () => { view.code = null; render(); });
  on('#xtPaste', () => xtPasteBox()); on('#xtOpen', () => xtFilePick()); on('#xtCopy', () => xtCopy(s));
}
// the class period's times, so a test started or finished outside them is flagged (Tally has no bell schedule of its own)
function xtPeriodBox(s) {
  const m = $('#modal'); m.classList.remove('hidden'); const p = examS().period[s.key] || { from: '', to: '' };
  m.innerHTML = `<div class="panel narrow"><header><h2>When ${esc(s.label)} meets</h2><button id="mClose" aria-label="Close">×</button></header><div class="body one"><p>A test started or finished outside these times (with a minute's grace either side) is flagged. Leave both empty to flag nothing.</p>
    <div class="row2"><div class="field"><label for="xtFrom">Starts</label><input type="time" id="xtFrom" value="${esc(p.from)}"></div><div class="field"><label for="xtTo">Ends</label><input type="time" id="xtTo" value="${esc(p.to)}"></div></div>
    <div class="rp-actions"><button class="pill" id="xtPerSave">Save</button><button class="pill pale" id="mCancel">Cancel</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  $('#xtPerSave').onclick = () => { const a = $('#xtFrom').value, b = $('#xtTo').value; if (!a && !b) delete examS().period[s.key]; else if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b) || b <= a) { toast('Give a start and an end, the end after the start.', true); return; } else examS().period[s.key] = { from: a, to: b }; save(); close(); render(); };
}
/* pasting the response sheet: a dialog with one box. When two columns could be the name, it asks once which. */
function xtPasteBox() {
  const m = $('#modal'); m.classList.remove('hidden'); m.classList.add('private'); let nameCol = null;
  m.innerHTML = `<div class="panel narrow"><header><h2>Paste the form's responses</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body one"><p>In the response sheet, select the rows (or click the corner to select everything), copy, and paste here. Tally finds the timestamp, the name and the code itself; other columns and the header row don't matter.</p>
      <textarea id="xtSheet" class="xtSheet" spellcheck="false" ${state.settings.hideNames ? 'placeholder="Names stay hidden on screen; they are still read."' : 'placeholder="11/16/2026 10:42:13&#9;Ava Nguyen&#9;K7QF-2M9D-X4TB"'}></textarea>
      <p class="xtSheetSay" id="xtSheetSay" aria-live="polite"></p><div id="xtNameAsk"></div>
      <div class="rp-actions"><button class="pill" id="xtTake">Fetch the tests</button><button class="pill pale" id="mCancel">Cancel</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  const ta = $('#xtSheet');
  const paint = () => { const g = EX().readSheet(ta.value, nameCol != null ? { name: nameCol } : undefined); const n = g.rows.reduce((a, r) => a + r.codes.length, 0); const hd = j => g.header ? g.header[j] : 'column ' + (j + 1);
    $('#xtSheetSay').textContent = !ta.value.trim() ? '' : g.cols.code == null ? 'No code found yet.' : `${plural(g.rows.length, 'response')}, ${plural(n, 'code')}: codes from “${hd(g.cols.code)}”${g.cols.name != null ? `, names from “${hd(g.cols.name)}”` : g.cols.email != null ? `, no name column: names from the email addresses (the part before the @), which Tally only suggests` : ', no name column'}.`;
    const ask = $('#xtNameAsk'); ask.innerHTML = g.alts && g.alts.length > 1 && nameCol == null ? `<p class="xtSheetQ"><b>Which column is the student's own name?</b></p><div class="seg">${g.alts.map(j => `<button data-ncol="${j}" class="${j === g.cols.name ? 'on' : ''}">${esc(hd(j))}</button>`).join('')}</div>` : '';
    ask.querySelectorAll('[data-ncol]').forEach(b => b.onclick = () => { nameCol = +b.dataset.ncol; paint(); }); };
  ta.oninput = () => { nameCol = null; paint(); };
  if (!coarse()) ta.focus();
  $('#xtTake').onclick = () => { const r = examTakeSheet(ta.value, 'paste', nameCol != null ? { name: nameCol } : undefined); if (!r.ok) { $('#xtSheetSay').textContent = r.why; return; } close(); render(); examFetch(r.codes); };
}
function xtFilePick() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,.tsv,.txt,.json,text/csv,application/json';
  inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; const text = await f.text(); let obj = null; if (/\.json$/i.test(f.name) || /^\s*\{/.test(text)) { try { obj = JSON.parse(text); } catch (e) {} }
    if (obj && Array.isArray(obj.results)) return examOpenFile(obj, f.name);
    if (obj && obj.tally) { toast('That is a Tally save: open it through Import.', true); return; }
    const r = examTakeSheet(text, 'file'); if (!r.ok) { toast(esc(r.why), true, 8000); return; } render(); examFetch(r.codes); };
  inp.click();
}
/* UNDO (R2-C2): every change he makes in Tests goes through xtDo, which keeps what Tests held just before it. Undo puts back
   exactly that. It is refused, plainly, when something else changed since (tests fetched, a roster imported). */
/* DELETED TESTS (Croix, 16 Nov 2026: "a way to delete a test so it doesn't show up in the stats for a class and it clears from
   my tally"). Deleting takes the test's summary and its locked text out of Tally (state and IndexedDB) with its pick, fail
   and v1 copy; only a TOMBSTONE stays, state.exam.deleted[code] = {at, course, unit, points, of} (no name), carried by the
   Full save. The tombstone always wins: a deleted code is never fetched by itself, never re-added by a paste, the cockpit's
   file or another tab's save (whatever a merge brings back, xtPurge takes out again), and is in no list or flag. Response
   rows that name it stay (they are history; a paste of the same sheet is not added twice) but every reader skips the code.
   Bring back (Deleted tests, at the foot) takes the tombstone off and fetches it from the site again. */
const xtTrash = new Map();   // code → its locked text, for Undo in this session
function xtPurge() { const X = examS(); for (const code of Object.keys(X.deleted || {})) { delete X.recs[code]; if (X.legacy) delete X.legacy[code]; delete X.fails[code]; if (X.locked) delete X.locked[code];
    for (const k of Object.keys(X.picks)) if (X.picks[k] === code) delete X.picks[k]; xtVer.delete(code); xtOpened.delete(code); } }
async function xdbDel(code) { await xdbOpen(); if (!xdb) return; await xdbTx('readwrite', st => st.delete(code)); }
const xtDeletedCode = c => !!(examS().deleted || {})[c];
function xtDeleteAsk(code) {
  const X = examS(), e = X.recs[code], u = e && e.sum, ok = xtOk(code), C = EX(); const who = e && e.who ? e.who.n : null;
  const name = u && u.course ? C.testName(u.course, u.unit) : 'This test';
  const m = $('#modal'); m.classList.remove('hidden'); m.classList.add('private');
  m.innerHTML = `<div class="panel narrow"><header><h2>Delete this test?</h2><button id="mClose" aria-label="Close">×</button></header><div class="body one">
    <p><b>${esc(name)}</b>${u && ok ? ` · ${u.points} / ${u.of}` : ''} · <span class="xtCode">${esc(SEALX().showCode(code))}</span>${who ? ` · ${esc(shown(who))}'s` : ''}</p>
    <p>${who ? `It leaves ${esc(shown(who))}'s row and the class's numbers, and` : 'It leaves the lists below, and'} Tally no longer keeps it. The site still has the locked test, so you can bring it back from <b>Deleted tests</b> at the foot of Tests.</p>
    <div class="rp-actions"><button class="pill danger" id="xtDelGo">Delete</button><button class="pill pale" id="mCancel" data-autofocus>Cancel</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = ev => { if (ev.target === m) close(); };
  $('#xtDelGo').onclick = () => { close(); examDelete(code); }; 
}
function examDelete(code) {
  const X = examS(), e = X.recs[code], u = (e && e.sum) || {}; const f = X.fails[code] || {}; const text = xtLocked.get(code) || (X.locked || {})[code]; if (text) xtTrash.set(code, text);
  if (view.code === code) view.code = null;
  xtDo(() => { X.deleted[code] = { at: new Date().toISOString(), course: u.course || f.course || null, unit: u.unit != null ? u.unit : f.unit != null ? f.unit : null, points: xtOk(code) ? u.points : null, of: xtOk(code) ? u.of : null };
    xtLocked.delete(code); xdbDel(code); xtPurge(); }, `${esc(SEALX().showCode(code))} is deleted. It is under Deleted tests at the foot of Tests.`);
}
// Bring back: the tombstone off, fetched from the site again; if it can't be, the tombstone goes back and he is told why
async function xtBringBack(code) {
  const X = examS(), tomb = X.deleted[code]; if (!tomb) return; delete X.deleted[code]; xtGen++; xtLastUndo = null; save(); render();
  await examFetch([code], true); for (let i = 0; i < 300 && ((examJob && examJob.running) || xtQueue.has(code)); i++) await new Promise(r => setTimeout(r, 200));
  const Y = examS(); if (Y.recs[code]) { toast(`${esc(SEALX().showCode(code))} is back.`, false, 5000); return; }
  const why = (Y.fails[code] || {}).why; Y.deleted[code] = tomb; delete Y.fails[code]; save(); render();
  toast(why === 'none' ? `The site no longer has ${esc(SEALX().showCode(code))}, so it stays deleted.` : why && why !== 'net' ? `${esc(SEALX().showCode(code))} came back from the site but didn't open (${esc(xtWhyWord(why))}), so it stays deleted.` : `Tally couldn't reach ${esc(xtHost())} for ${esc(SEALX().showCode(code))}, so it stays deleted. Bring it back when the network is back.`, true, 8000);
}
let xtGen = 0;
let xtLastUndo = null;
const xtRosterSig = () => examRoster().map(x => xtKeyOf(x) + '\u0002' + x.id).join('\n');
const xtSnap = () => { const X = examS(); return { gen: xtGen, roster: xtRosterSig(), data: JSON.stringify({ recs: X.recs, rows: X.rows, alias: X.alias, picks: X.picks, dismissed: X.dismissed, seen: X.seen, fails: X.fails, deleted: X.deleted, ...(X.legacy && Object.keys(X.legacy).length ? { legacy: X.legacy } : {}) }) }; };
function xtDo(fn, say, quiet) {
  const snap = xtSnap(); fn(); examRefile(); save(); render(); const id = 'xtUndo' + (++xtGen);
  xtLastUndo = { snap: { ...snap, gen: xtGen }, id }; const mine = xtLastUndo;
  if (!quiet || say) toast(`${say || 'Done.'} <button class="tundo" id="${id}">Undo</button>`, false, 7000);
  const u = document.getElementById(id); if (u) u.onclick = () => xtUndo(mine);
}
function xtUndo(u) {
  u = u || xtLastUndo; if (!u) return false;
  if (u !== xtLastUndo || u.snap.gen !== xtGen || u.snap.roster !== xtRosterSig()) { toast('That can\'t be undone any more: something changed in Tests since. Change it by hand.', true, 6000); return false; }
  Object.assign(examS(), JSON.parse(u.snap.data)); xtLastUndo = null; xtGen++;
  // a test brought back by Undo gets its locked text back too (kept in memory when it was deleted), and is checked again
  for (const code of Object.keys(examS().recs)) if (!xtLocked.has(code) && !(examS().locked || {})[code] && xtTrash.has(code)) { examKeepLocked(code, xtTrash.get(code)); xtVer.delete(code); }
  examRefile(); save(); render(); if (Object.keys(examS().recs).some(c => !xtVer.has(c))) examVerifyAll(); toast('Undone.', false, 3000); return true;
}
// a dialog listing students: whose is this code / which student is this. extra: more buttons (e.g. Nobody yet)
function xtPickStudent(title, lead, cands, onPick, extra, onExtra, not) {
  const m = $('#modal'); m.classList.remove('hidden'); m.classList.add('private'); const roster = examRoster().filter(r => !(not && r.sec === not.sec && r.n === not.n));
  const first = cands.filter(c => roster.some(r => r.sec === c.sec && r.n === c.n)); const firstSet = new Set(first.map(c => c.sec + '|' + c.n));
  const opt = (c, i) => `<button class="xtWho" data-i="${i}"><span class="dot" style="--cc:${classColor(state.sections[c.sec])}"></span><b>${esc(shown(c.n))}</b><small>${esc(labShort(state.sections[c.sec].label))}</small></button>`;
  const all = first.concat(roster.filter(r => !firstSet.has(r.sec + '|' + r.n)).map(r => ({ sec: r.sec, n: r.n })));
  m.innerHTML = `<div class="panel narrow"><header><h2>${esc(title)}</h2><button id="mClose" aria-label="Close">×</button></header><div class="body one"><p>${lead}</p>
    ${first.length ? `<div class="xtWhos">${first.map((c, i) => opt(c, i)).join('')}</div>` : ''}<input type="search" id="xtFind" class="xtFind" placeholder="Find a student" aria-label="Find a student"><div class="xtWhos xtAll" id="xtAll"></div><div class="rp-actions">${extra || ''}<button class="pill pale" id="mCancel">Cancel</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.querySelectorAll('[data-xextra]').forEach(b => b.onclick = () => { close(); if (onExtra) onExtra(b.dataset.xextra); });
  // with nothing typed: the rest of this class; typing finds anyone in any class
  const paint = q => { const nq = norm(q); const list = all.slice(first.length).filter(c => nq ? norm(c.n).includes(nq) || norm(shown(c.n)).includes(nq) : c.sec === state.active).slice(0, 40); $('#xtAll').innerHTML = list.map(c => opt(c, all.indexOf(c))).join(''); wire(); };
  const wire = () => m.querySelectorAll('.xtWho').forEach(b => b.onclick = () => { close(); onPick(all[+b.dataset.i]); });
  $('#xtFind').oninput = e => paint(e.target.value); paint(''); wire();
  return { close, m };
}
/* He answered a row: it is that student's. Remembered for that name (used later only where it is still the only reading);
   other rows with the same words are offered it, not given it. Undoable. */
function xtAnswer(r, c) {
  const X = examS();
  xtDo(() => { r.who = { sec: c.sec, n: c.n }; r.how = 'you'; if (r.name && !r.email) X.alias[EX().nameKey(r.name)] = { sec: c.sec, n: c.n, at: new Date().toISOString() };
    r.codes.forEach(code => { const e = X.recs[code]; if (e) { e.nobody = false; delete e.gone; e.no = (e.no || []).filter(w => !(w.sec === c.sec && w.n === c.n)); } }); },
    `Row ${r.line} is ${esc(shown(c.n))}'s.${r.name && !r.email ? ` Tally remembers “${esc(shown(r.name))}” as them, and uses it only where nobody else could be meant.` : ''}`);
}
// nobody yet: the test goes to the tests nobody turned in (the rows that named someone keep their words; he answered for the test)
function xtNobody(code) { const e = examS().recs[code]; if (!e) return; xtDo(() => { e.nobody = true; if (e.who && e.who.how !== 'you') { e.was = e.who; e.who = null; } }, `${esc(SEALX().showCode(code))} is among the tests nobody turned in.`); }
function xtWho(s, r) {
  if (!r) return; const h = xtHint(r, examAll()); const cs = h ? r.cands.slice().sort((p, q) => (q.sec === h.sec) - (p.sec === h.sec)) : r.cands;
  const C = r.remember ? [r.remember].concat(cs.filter(c => !(c.sec === r.remember.sec && c.n === r.remember.n))) : cs;
  xtPickStudent('Who turned this in?', `Row ${r.line} of the responses: <b>${esc(r.name ? shown(r.name) : 'no name')}</b>${r.email ? ' (from the email address)' : ''}${r.at ? ` at ${esc(r.at)}` : ''}, code ${esc(r.codes.map(c => SEALX().showCode(c)).join(', '))}.${r.remember ? ` You said “${esc(shown(r.name))}” was ${esc(shown(r.remember.n))} before; another student could be meant now.` : C.length ? ' The likely students first.' : ''}`, C, c => xtAnswer(r, c),
    '<button class="pill pale" data-xextra="nobody">Nobody yet</button>', () => xtDo(() => { r.codes.forEach(code => { const e = examS().recs[code]; if (e) { e.nobody = true; if (e.who && e.who.how !== 'you') { e.was = e.who; e.who = null; } } }); }, 'Left with nobody: it is among the tests nobody turned in.'));
}
// give a test to a student by hand (it stays with them until he moves it)
function xtGiveNow(e, c, off) { const x = examRoster().find(r => r.sec === c.sec && r.n === c.n); if (off) e.no = (e.no || []).filter(w => !(w.sec === off.sec && w.n === off.n)).concat([{ sec: off.sec, n: off.n }]);
  e.who = { sec: c.sec, n: c.n, ...(x && x.id ? { id: x.id } : {}), how: 'you', at: new Date().toISOString() }; e.nobody = false; e.was = null; delete e.gone; e.no = (e.no || []).filter(w => !(w.sec === c.sec && w.n === c.n)); }
function xtGive(code, c) { const e = examS().recs[code]; if (!e) return; xtDo(() => xtGiveNow(e, c), `${esc(SEALX().showCode(code))} is ${esc(shown(c.n))}'s now.`); }
/* Not theirs (Croix after the review, rule 1): on every placed test, its row and its page. Asks whose it is; nothing changes
   until he answers. A student → it is theirs; Nobody yet → the tests nobody turned in; Cancel → it stays exactly where it was
   (R2-C2). Either answer can be undone. */
function xtNotTheirs(s, code) {
  const X = examS(), e = X.recs[code]; if (!e || !e.who) return; const off = { sec: e.who.sec, n: e.who.n };
  const rs = X.rows.filter(r => r.codes.includes(code)); const cands = []; rs.forEach(r => (r.cands || []).concat(r.suggest ? [r.suggest] : []).forEach(c => { if (!(c.sec === off.sec && c.n === off.n) && !cands.some(x => x.sec === c.sec && x.n === c.n)) cands.push(c); }));
  const u = xtOk(code) && e.sum;
  xtPickStudent('Who turned this in?', `If ${esc(SEALX().showCode(code))} isn't ${esc(shown(off.n))}'s, whose is it?${u ? ` The test: ${u.points} / ${u.of}, taken ${esc(EX().hm(u.started))}–${esc(EX().hm(u.finished))}.` : ''}${rs.length ? ` It was turned in as ${rs.map(r => `<b>${esc(shown(r.name || 'no name'))}</b>`).join(' and ')}.` : ''} Cancel leaves it with ${esc(shown(off.n))}.`, cands,
    c => { view.code = null; xtDo(() => xtGiveNow(e, c, off), `${esc(SEALX().showCode(code))} is ${esc(shown(c.n))}'s now, not ${esc(shown(off.n))}'s.`); },
    '<button class="pill pale" data-xextra="nobody">Nobody yet</button>', () => { view.code = null; xtDo(() => { e.no = (e.no || []).filter(w => !(w.sec === off.sec && w.n === off.n)).concat([off]); e.was = e.who; e.who = null; e.nobody = true; delete e.gone; }, `${esc(SEALX().showCode(code))} is among the tests nobody turned in.`); }, off);
}
function xtChoose(s, code, how) {
  const X = examS(); const rs = X.rows.filter(r => r.codes.includes(code)); const cands = []; rs.forEach(r => { if (r.who && !cands.some(c => c.sec === r.who.sec && c.n === r.who.n)) cands.push(r.who); else (r.cands || []).forEach(c => { if (!cands.some(x => x.sec === c.sec && x.n === c.n)) cands.push(c); }); });
  { const h = rs.length ? xtHint(rs[0], examAll()) : null; if (h) cands.sort((p, q) => (q.sec === h.sec) - (p.sec === h.sec)); }
  const h = examHeld(code); const u = h && xtOk(code) && h.e.sum;
  const lead = how === 'shared' ? `${esc(SEALX().showCode(code))} was turned in by ${rs.map(r => `<b>${esc(shown(r.who ? r.who.n : r.name))}</b> (row ${r.line}${r.at ? ', ' + esc(r.at) : ''})`).join(' and ')}. ${u ? `The test: ${u.points} / ${u.of}, taken ${esc(EX().hm(u.started))}–${esc(EX().hm(u.finished))}${u.opened != null ? ` in the opening of ${esc(EX().hm(u.opened))}` : ''}.` : ''} Whose is it?`
    : `${esc(SEALX().showCode(code))}${u ? `: ${u.points} / ${u.of}, taken ${esc(EX().hm(u.started))}–${esc(EX().hm(u.finished))}${u.opened != null ? ` in the opening of ${esc(EX().hm(u.opened))}` : ''}` : ''}. Nobody turned this code in.`;
  xtPickStudent(how === 'shared' ? 'Whose test is this?' : 'Give this test to a student', lead, cands, c => xtGive(code, c));
}
function xtTwice(s, t, n) {
  const list = examAll().filter(x => x.sec === s.key && x.n === n && x.e.sum && x.e.sum.course === t.course && x.e.sum.unit === t.unit && xtOk(x.code));
  const m = $('#modal'); m.classList.remove('hidden'); m.classList.add('private');
  m.innerHTML = `<div class="panel narrow"><header><h2>${esc(shown(n))}: two tests</h2><button id="mClose" aria-label="Close">×</button></header><div class="body one"><p>Each was a separate sitting on the site. The one you choose is the score; the other stays here, marked. If one isn't theirs, open it and press Not theirs.</p>
    <div class="xtWhos">${list.map(x => { const u = x.e.sum; return `<button class="xtWho" data-c="${x.code}"><b>${u.points} / ${u.of}</b><small>taken ${esc(EX().hm(u.started))}–${esc(EX().hm(u.finished))} · ${esc(EX().clock(u.seconds))} · away ${u.awayN || 0}</small><span class="xtCode">${esc(SEALX().showCode(x.code))}</span></button>`; }).join('')}</div>
    <div class="rp-actions"><button class="pill pale" id="mCancel">Cancel</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { close(); xtDo(() => { examS().picks[s.key + '|' + n + '|' + t.key] = b.dataset.c; }, `The test that counts for ${esc(shown(n))} is chosen.`); });
}
/* Copy scores: the way a unit's IXL goes to Focus (copyUnit): one line per Focus row, in Focus order, the points or blank */
async function xtCopy(s) {
  // never a partial column: while this session's check is running, Copy waits for it (R2-M3)
  if (examCan() && Object.keys(examS().recs).some(c => !xtVer.has(c))) examVerifyAll();
  if (xtVerJob) { const n = Object.keys(examS().recs).length; const say = () => `Checking ${n - Object.keys(examS().recs).filter(c => !xtVer.has(c)).length} of ${n} tests with the site's signature… Copy follows.`;
    toast(say(), false, 60000); const iv = setInterval(() => { const tt = $('#toast'); if (tt && /Checking/.test(tt.textContent)) tt.firstChild && (tt.innerHTML = say()); }, 400);
    try { await xtVerJob; } finally { clearInterval(iv); } }
  const fetching = () => (examJob && examJob.running) || xtQueue.size > 0 || (examCan() && examUnfetched().some(c => !examS().fails[c]));
  if (fetching()) { toast('Fetching tests… Copy follows when every code turned in is fetched.', false, 60000); const until = Date.now() + 60000; while (fetching() && Date.now() < until) await new Promise(r => setTimeout(r, 200)); if (xtVerJob) await xtVerJob;
    if (fetching()) { toast('Some codes turned in aren\'t fetched yet (see Waiting for you): Copy waits for them. Try again in a moment.', true, 7000); return; } }
  const { t } = xtCurrent(s); if (!t) { toast(`No student of ${esc(s.label)} has a test here yet, so there are no scores to copy.`, true); return; }
  const M = xtModel(s, t); const gb = s.grades && Array.isArray(s.grades.students) && s.grades.students.length ? s.grades.students : null;
  const order = gb || classStudents(s); const by = new Map(M.rows.map(r => [r.n, r])); const byN = new Map(); M.rows.forEach(r => { const k = norm(r.n); byN.set(k, byN.has(k) ? null : r); });   // a gradebook row by its exact name, else by a plain name only one student has
  const lines = order.map(n => { const r = by.get(n) || byN.get(norm(n)); return r && r.use && r.v.points != null ? String(r.v.points) : ''; });
  const got = lines.filter(Boolean).length; if (!got) { toast(`No scores for ${esc(EX().testName(t.course, t.unit))} in ${esc(s.label)} yet.`, true); return; }
  const ofs = [...new Set(M.rows.filter(r => r.use).map(r => r.v.of))]; const two = M.rows.filter(r => r.mine.length > 1 && !r.use).length;
  const text = lines.join('\n'); let ok = legacyCopy(text);
  if (!ok && window.isSecureContext && navigator.clipboard) { try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {} }
  const title = `${EX().testName(t.course, t.unit)} test · /${ofs.length === 1 ? ofs[0] : ofs.join(' or ')}`;
  if (ok) toast(`<b>${esc(EX().testName(t.course, t.unit))}</b> copied: ${plural(lines.length, 'row')} in ${gb ? 'the Focus gradebook\'s' : 'roster'} order · ${got} with a score${lines.length - got ? ` · ${lines.length - got} blank` : ''}${ofs.length === 1 ? ` · out of <b>${ofs[0]}</b>` : ` · <b>not every test is out of the same points (${ofs.join(', ')})</b>`}${two ? ` · <b>${plural(two, 'student')} with two tests left blank until you choose</b>` : ''}`, false, 8000);
  else showCopyBox(text, title);
}

/* ---------------------------------------------------------------- Connect */
function xtConnectPage(s) {
  examConfirmSaved(false);
  const X = examS(); const P = examPairs(); const pub = examPub(); const mineP = P.filter(x => x.pub === pub); const foreign = examForeign(); const host = (() => { try { return new URL(X.site).host; } catch (e) { return X.site; } })();
  const proven = examChecked().length > 0 && !examKeyUnchecked();
  const can = examCan(); const viaSave = !pub && foreign.length > 0 && proven; const step = !pub && !foreign.length ? 1 : viaSave ? 4 : !(X.trial && proven) ? 3 : 4; const saveDay = X.fromSave ? ' of ' + fmtDate(localDay(X.fromSave)) : ''; const allowed = examAllowed(X.site);
  const li = (n, title, body) => `<li class="${step > n && !(n === 2 && step === 3) ? 'done' : step === n || (n === 2 && step === 3) ? 'now' : ''}"><span class="xtN" aria-hidden="true">${step > n && !(n === 2 && step === 3) ? ico('check') : n}</span><div><h4>${title}</h4>${body}</div></li>`;
  $('#gridwrap').innerHTML = `<div class="grades xt"><div class="xtConnect">
    <div class="xtConnHead"><h3>${examConnected() && X.trial ? 'Connection' : `Connect Tally to the tests on ${esc(host)}`}</h3>${examPairs().length && (X.trial || examAll().length || X.rows.length) ? `<button class="pill ${X.trial && !examAll().length ? '' : 'pale '}small" id="xtDone">${examAll().length || X.rows.length ? 'Back to the tests' : 'Done'}</button>` : ''}</div>
    <p class="xtLead">Every test a student finishes is locked on the site so that only this Tally can open it, and signed by the site so nobody else can make one. This connects the two, once.</p>
    ${!can ? xtStatusHtml() : ''}
    <ol class="xtSteps">
      ${li(1, 'Make Tally\'s key', !pub && foreign.length ? (viaSave ? `<p><b>Connected (from your Full save${esc(saveDay)}, checked with the site${xtSiteAsk && xtSiteAsk.ok ? ' today' : ''}).</b> The save brought this Tally's key${foreign.length === 1 ? '' : 's'} and the site's key it was paired with, and the site serves that same key, so your tests open and score here as they did there: nothing to paste, no trial to do. Make a key of this Tally's own only if you want the cockpit to lock new tests to this browser's own key instead.</p>` : `<p><b>Your Full save brought ${foreign.length === 1 ? 'a key' : foreign.length + ' keys'} this Tally did not make</b> (made ${esc(whenText(foreign[foreign.length - 1].made))}). ${xtSiteAsk && xtSiteAsk.net ? 'The site\'s key it was paired with is <b>not checked yet: the site could not be reached</b>. Tally asks again by itself when the network is back; until then your tests wait, unscored.' : xtSiteAsk && xtSiteAsk.served ? 'The site no longer serves the key it was paired with: tests signed with that key can\'t be checked in this browser (their scores are in the cockpit). Enter a trial code from the cockpit (step 3) to check the site\'s current key; nothing needs pasting.' : examSavedKeys().length ? 'Tally is checking the site\'s key it was paired with against the site…' : 'The save holds no site key a trial proved: enter a trial code from the cockpit (step 3) to check the site\'s key here; nothing needs pasting.'}</p>`) + `<button class="pill small pale" id="xtMake" ${can ? '' : 'disabled'}>Make this Tally's own key</button>` : pub ? `<p>Made ${esc(whenText(mineP[mineP.length - 1].made))}.${foreign.length ? ` This Tally also holds ${foreign.length === 1 ? 'a key' : foreign.length + ' keys'} that came in a Full save; ${foreign.length === 1 ? 'it opens' : 'they open'} tests, but the key to paste is this one.` : ''} This is the half the website needs; the other half never leaves Tally and your Full saves.</p><div class="xtKeyRow"><code class="xtKey" id="xtKey">${esc(pub)}</code><button class="pill small" id="xtCopyKey">Copy</button></div>
        ${!X.warned ? `<div class="notice xtLose"><span>${ico('warn')}</span><span><b>If this key is lost, nobody can open these tests again: not you, not the site.</b> It lives only in this Tally and in your Full saves. The scores would still be in the cockpit; every answer, time and the rest of the record would not. Make a Full save now and keep it in your school Drive.</span><div class="xtLoseBtns"><button class="pill small" id="xtSaveNow">Full save now</button><button class="linkbtn" id="xtLater">Later</button></div></div>` : ''}`
        : `<p>Only this key opens your students' test records. Tally makes it here; it takes a second.</p><button class="pill" id="xtMake" ${can ? '' : 'disabled'}>Make the key</button>`)}
      ${li(2, 'Paste it into the cockpit', `<p>On ${esc(host)}, open the cockpit's <b>Test</b> card and paste the key into <b>Tally's key</b>. The cockpit makes a trial test and shows its code.</p>`)}
      ${li(3, 'Enter the trial code', `<div class="xtTrialRow"><input id="xtTrialIn" class="xtCodeIn" placeholder="K7QF-2M9D-X4TB" autocomplete="off" spellcheck="false" aria-label="The trial code" ${(pub || foreign.length) && can ? '' : 'disabled'}><button class="pill small" id="xtTrialGo" ${(pub || foreign.length) && can ? '' : 'disabled'}>Open</button></div><p class="xtTrialOut" id="xtTrialOut" aria-live="polite"></p>`)}
      ${li(4, 'Type the four words into the cockpit', viaSave ? `<p>Done when this pairing was made${X.trial ? ` (the trial ${esc(SEALX().showCode(X.trial.code))}, ${esc(whenText(X.trial.at))})` : ''}, on the Tally your Full save came from.</p>` : X.trial ? `<p>Tally opened the trial and checked the site's signature. Type these four words into the box under the trial code on the cockpit's <b>Test</b> card, then press <b>Confirm</b>. Only a Tally that opened the trial knows them, so the site knows the pairing works.</p><div class="xtWordsRow"><div class="xtWords" aria-label="The four words">${X.trial.words.split(' ').map(w => `<span>${esc(w)}</span>`).join('')}</div><button class="pill small" id="xtCopyWords">Copy</button></div><p class="ghint">From the trial ${esc(SEALX().showCode(X.trial.code))}, ${esc(whenText(X.trial.at))}. If the cockpit says the words are wrong, it holds another key: paste this Tally's key again and enter the new trial code.</p>` : '<p>Tally opens the trial with its key and shows four words. You type them into the cockpit; the site works them out on its side, and they match only if the cockpit has this Tally\'s key and Tally has the site\'s.</p>')}
    </ol>
    <details class="xtMore"><summary>Address, keys</summary>
      <div class="xtMoreBody">
        <label class="xtAddr">The site <input id="xtSite" value="${esc(X.site)}" spellcheck="false"></label><button class="pill small pale" id="xtSiteSave">Use this address</button>
        <p class="ghint">${allowed.ok ? `This copy of Tally may reach ${esc(allowed.list.join(', ') || 'any address')}.` : `<b>This copy of Tally may only reach ${esc(allowed.list.join(', '))}</b>: another address would be refused by the browser.`} Tally asks the site for two things only: its signing key, and a test by its code. Nothing about a student is ever sent.</p>
        <h4>Tally's keys</h4><ul class="xtKeys">${P.slice().reverse().map(p => `<li><code>${esc(p.pub.slice(0, 18))}…</code> made ${esc(whenText(p.made))}${p.pub === pub ? ' · <b>the one to paste</b>' : foreign.some(f => f.pub === p.pub) ? ' · came in a Full save: opens tests, never pasted' : ' · still opens the tests locked to it'}</li>`).join('') || '<li>none yet</li>'}</ul>
        <h4>The site's keys</h4><ul class="xtKeys">${X.sites.slice().reverse().map(k => `<li><code>${esc(k.key.slice(0, 18))}…</code>${k.made ? ` made ${esc(whenText(new Date(k.made).toISOString()))}` : ''} · first seen ${esc(whenText(k.got))}</li>`).join('') || '<li>none yet</li>'}</ul>
        ${pub ? `<p class="ghint">A new key is only for a fresh start: tests already taken stay locked to the old one, which Tally keeps.</p><button class="pill small pale" id="xtNewKey" ${can ? '' : 'disabled'}>Make a new key</button>` : ''}
      </div></details>
  </div></div>`;
  const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  on('#xtMake', async () => { $('#xtMake').disabled = true; $('#xtMake').textContent = 'Making…'; await examMakeKey(); });
  on('#xtCopyKey', () => { const ok = legacyCopy(pub); if (ok) toast('Tally\'s key copied. Paste it into the cockpit.', false); else showCopyBox(pub, 'Tally\'s key'); });
  on('#xtSaveNow', () => { examS().warned = true; saveFull(); });
  on('#xtCopyWords', () => { const w = X.trial.words; if (legacyCopy(w)) toast('The four words copied. Paste them into the cockpit.', false); else showCopyBox(w, 'the cockpit\'s word box'); });
  on('#xtLater', () => { examS().warned = true; save(); render(); });
  on('#xtTrialGo', () => examTrial($('#xtTrialIn').value)); const ti = $('#xtTrialIn'); if (ti) ti.onkeydown = e => { if (e.key === 'Enter') examTrial(ti.value); };
  on('#xtDone', () => { view.connect = false; render(); });
  on('#xtSiteSave', () => { const v = $('#xtSite').value.trim().replace(/\/+$/, ''); if (!/^https?:\/\/[^\s/?#]+$/.test(v)) { toast('An address like https://mrshaffer.org', true); return; } examS().site = v; save(); render(); toast(`Tests now uses ${esc(v)}.`, false); });
  on('#xtNewKey', async () => { if (!await ask('Make a new key? Tests already taken stay locked to the old key, which Tally keeps and still opens them with. The cockpit needs the new key, and the pairing is checked again.', 'Make a new key')) return; await examMakeKey(); });
}

/* ---------------------------------------------------------------- one test, whole */
// what a fact can mean: said on the test's own page, never in a list of names (Croix after the review, M1, N1, N2)
const XMAYBE = { apart: 'It can mean a make-up you arranged, a late start, a test taken somewhere else while it was open (at home), or one started early to see the questions.', opening: 'It can mean a make-up in an opening you made for it, or a test taken while you had it open for someone else.', makeup: '', long: 'It can mean extended time (an accommodation), a test left open and come back to, or a student who worked slowly.', rule: 'The page counts and locks on the student\'s device; it can mean the page was tampered with, or a device problem.', period: 'It can mean a make-up, or a test taken outside class while it was open.' };
const xtSecGone = sec => !state.sections[sec];
const xtHowWords = w => w.how === 'you' ? `You gave this test to ${shown(w.n)}${w.at ? ' on ' + fmtDate(localDay(w.at)) : ''}.` : w.how === 'remembered' ? `Placed with ${shown(w.n)} by a name you answered before (remembered from ${w.at ? fmtDate(localDay(w.at)) : 'earlier'}).` : `Turned in as ${shown(w.n)}: the name matched them and no one else.`;
function renderTestDetail(s, code) {
  const X = examS(), e = X.recs[code]; const wrap = $('#gridwrap');
  if (!e) { view.code = null; return renderTests(s); }
  // shown only once it has been opened and checked in this session; never the content of one that failed its check
  const st = xtVer.get(code), rec = xtOpened.get(code);
  if (!rec || st !== 'ok') {
    if (!st && examCan()) { wrap.innerHTML = '<div class="grades xt"><p class="xtProg"><span class="xtSpin" aria-hidden="true"></span>Opening the test and checking the site\'s signature…</p></div>'; examCheckOne(code).then(() => { if (view.code === code) render(); }); return; }
    wrap.innerHTML = `<div class="grades xt"><div class="notice info"><span>${ico('info')}</span><span><b>Tally can't show this test.</b> ${esc({ unchecked: 'It is signed by a key this Tally has not checked: connect to the site once (Tally asks the site whether it serves that key), or enter a trial code under Connection. Until then it is never scored.', legacy: 'An earlier build of Tally kept it without its locked copy, so it can\'t be checked: fetch it again from the class list.', missing: 'Its locked copy is missing: fetch it again from the class list.', signature: 'What is stored was not signed by the site (a changed Full save?): it is never shown or scored.', key: 'It is locked to a key this Tally doesn\'t have.', format: 'What is stored is not a test record.', code: 'What is stored answers to another code.' }[st] || (examCan() ? 'It hasn\'t been checked yet.' : 'This browser can\'t open test records here (no Web Crypto). Open Tally on your laptop in Chrome or Edge.'))}</span></div></div>`; return;
  }
  const v = EX().readRecord(rec); const C = EX(); const n = e.who ? e.who.n : null;
  const { t } = xtCurrent(s); const M = xtModel(s, { course: v.course, unit: v.unit, key: C.testKey(v.course, v.unit) });
  const fl = M.flags.filter(f => f.code === code || (f.kind === 'twice' && (f.codes || []).includes(code)));
  const pc = xtPct(v.points, v.of); const L = v.log;
  const devClock = L && L.t0 != null && v.started != null ? Math.round((L.t0 - v.started) / 1000) : null;
  const qRows = v.questions.map(q => {
    const parts = q.parts.map((p, i) => { const changes = p.vals.length; return `<tr class="${i ? 'sub' : ''}" id="xq-${esc(p.id)}">
      <td class="xtQ">${i ? `<span class="xtPart">${esc(p.id)}</span>` : `<b>${esc(q.q)}</b>${q.parts.length > 1 ? `<span class="xtPart">${esc(p.id)}</span>` : ''}`}</td>
      <td class="xtAns">${p.typed == null || C.answerText(p.type, p.typed) === '' ? '<span class="xtNone">nothing</span>' : `<span class="xtTyped">${esc(C.answerText(p.type, p.typed))}</span>`}</td>
      <td>${xtVerdict(p.v, p.almost)}</td>
      <td class="xtKeyT">${esc(C.keyText(p.key))}</td>
      ${i ? '<td></td><td></td><td></td>' : `<td class="num">${q.sec == null ? '' : esc(C.clock(q.sec))}</td><td class="num">${q.visits ?? ''}</td><td class="num">${q.first == null ? (q.sec == null ? '' : '<span class="xtNone">never</span>') : esc(C.clock(q.first))}</td>`}
      <td class="xtChg">${changes ? `<details><summary>${p.n != null && p.n > changes ? `${p.n} values` : plural(changes, 'value')}</summary><ol>${p.vals.map(x => `<li><time>${esc(C.clock(x[0]))}</time> <span class="xtTyped">${esc(C.answerText(p.type, x[1]) || '(empty)')}</span> <small>${esc(x[2] === 'keypad' ? 'keypad' : x[2] === 'tap' ? 'picked' : x[2] === 'typed' ? 'typed' : '')}</small></li>`).join('')}${p.n != null && p.n > changes ? `<li class="xtDrop">${p.n - changes} more in between, not kept (the first 4 and last 8 are)</li>` : ''}</ol></details>` : '<span class="xtNone">—</span>'}${p.pastes ? ` <span class="xtChip warn">${plural(p.pastes, 'paste')}</span>` : ''}</td>
      <td>${i ? '' : q.flagEnd ? '<span class="xtChip info">Flagged</span>' : q.flag ? '<span class="xtChip soft">Flagged, then not</span>' : ''}</td></tr>`; }).join('');
    return parts; }).join('');
  const list = (items, empty, f) => items.length ? `<ul class="xtEvents">${items.map(f).join('')}</ul>` : `<p class="xtNone">${empty}</p>`;
  const dropped = k => v.drop[k] ? `<p class="xtDrop">${v.drop[k]} more not kept (the log keeps ${k === 'visits' ? 300 : 100}).</p>` : '';
  const AWAY = { tab: 'another tab or app', window: 'another window', fullscreen: 'out of full screen', reload: 'reloaded the page' };
  const BLOCK = { copy: 'Copy', cut: 'Cut', menu: 'Right-click menu', print: 'Print', selectall: 'Select all', drag: 'Drag', save: 'Save page', find: 'Find (Ctrl+F)' };
  const D = v.device || {}; const dv = (x, f) => x == null ? '<span class="xtNone">not reported</span>' : esc(f ? f(x) : String(x));
  wrap.innerHTML = `<div class="grades xt xtD">
    <section class="xtHead">
      <div class="xtWho1"><h2>${n ? esc(shown(n)) : '<span class="xtNone">Nobody yet</span>'}</h2><p>${esc(C.testName(v.course, v.unit))} · <span class="xtCode">${esc(SEALX().showCode(code))}</span>${e.src === 'file' ? ' · from the cockpit\'s file' : ''}</p>
        ${!n ? `<div class="xtOwn"><span>${e.gone ? `Nobody's now. It had been ${e.gone.how === 'you' ? 'given to' : 'with'} ${esc(shown(e.gone.n))}${e.gone.cl ? ` (${esc(e.gone.cl)})` : ''}, who is no longer on that roster.` : e.was ? `Nobody's now. It had been ${esc(shown(e.was.n))}'s.` : 'Nobody turned this code in.'}</span><button class="pill small" id="xtGiveD">Give it to a student</button></div>` : `<div class="xtOwn"><span>${esc(xtHowWords(e.who))}</span><button class="pill small pale" id="xtNotD" title="This test isn't ${esc(shown(n))}'s: take it off them and say whose it is">Not theirs</button></div>`}
        <div class="xtSee"><a class="pill small" id="xtSeeD" href="${esc(EX().teacherLink(X.site, rec))}" target="_blank" rel="noopener noreferrer">See the test ↗</a><span>Opens this unit's teacher copy on the site, with the questions as this student was given them. Be signed in to the teacher section in this browser.</span></div></div>
      <div class="xtBig"><b>${v.points ?? '?'}</b><small>/ ${v.of ?? '?'}</small><span>${pc == null ? '' : pc + '%'}</span></div>
      <dl class="xtFacts">
        <div><dt>Time</dt><dd>${esc(C.clock(v.seconds)) || '—'}</dd></div>
        <div><dt>Finished</dt><dd>${esc(xtWhen(v.finished)) || '—'}</dd></div>
        <div><dt>Left the test</dt><dd class="${v.away.length ? 'away' : ''}">${!L ? '<span class="xtNone">no log</span>' : v.away.length ? `${plural(v.away.length, 'time')} · ${esc(C.dur(v.awaySec))}` : 'never'}</dd></div>
        <div><dt>Taken</dt><dd>${v.started != null ? esc(EX().hm(v.started)) + '–' + esc(EX().hm(v.finished)) : '—'}${v.opened != null ? `<small class="xtOpenTag">opening of ${esc(EX().hm(v.opened))}</small>` : ''}</dd></div>
        <div><dt>Rule</dt><dd>${v.rule ? esc(v.rule.leave === 'lock' ? `Lock after ${v.rule.after}` : v.rule.leave === 'end' ? `End after ${v.rule.after}` : 'Count only') : '—'}${v.unlocks ? ` · unlocked ${plural(v.unlocks, 'time')}` : ''}${v.ended === 'left' ? ' · <b class="bad">ended: left</b>' : v.ended === 'teacher' ? ' · <b class="bad">closed by the site</b>' : v.ended === 'time' ? ' · <b class="bad">ran out of time</b>' : ''}<small class="xtOpenTag">${v.limit ? esc(v.limit) + ' minutes allowed' : 'no time limit'}</small></dd></div>
      </dl>
    </section>
    ${fl.length ? `<section class="xtFlags"><ul>${fl.map(f => `<li class="${f.level}"><span class="xtFi">${ico(f.level === 'warn' ? 'warn' : 'info')}</span><div><b>${esc(f.text)}</b><p>${esc(f.todo)}${XMAYBE[f.kind] ? ' ' + esc(XMAYBE[f.kind]) : ''}</p></div></li>`).join('')}</ul></section>` : ''}
    <p class="xtHonest">The answers, the score, and the start and finish times are the site's own. Everything else on this page is what the student's device reported about itself: evidence, not proof.</p>
    <section class="gsec xtTL"><h3>The sitting</h3>${L ? '' : '<p class="xtNote">This device sent no log (or one too large to keep): only the site\'s own times and saves are known.</p>'}<div class="xtTLsvg"></div></section>
    <section class="gsec"><h3>Questions</h3><div class="xtScroll"><table class="checkTable xtQs"><thead><tr><th>Q</th><th>Answer</th><th>Result</th><th>Key</th><th class="num" title="How long the question was on screen, in minutes and seconds">On it</th><th class="num">Visits</th><th class="num" title="Time on the question before its first answer">First answer</th><th>Every value it held</th><th></th></tr></thead><tbody>${qRows}</tbody></table></div></section>
    <div class="gtwo">
      <section class="gsec"><h3>Calculator</h3>${!L ? '<p class="xtNone">No log.</p>' : list(v.calc, 'Never opened.', c => `<li><time>${esc(C.clock(c.at))}</time><span>${esc(c.which === 'fast' ? 'FAST (Desmos)' : c.which === 'ti' ? 'TI-30Xa' : c.which || 'calculator')} on question ${esc(c.q)}</span><small>${esc(C.dur(c.sec))}</small></li>`)}${dropped('calc')}<p class="ghint">What is typed inside a calculator can't be seen: it is another site's page.</p>
        <h3 class="mt">Scratch paper</h3>${!L ? '<p class="xtNone">No log.</p>' : list(v.scratch, 'Never opened.', c => `<li><time>${esc(C.clock(c.at))}</time><span>${c.tab === 'grid' ? 'Grid' : 'Notes'} on question ${esc(c.q)}</span><small>${esc(C.dur(c.sec))}</small></li>`)}${dropped('scratch')}
</section>
      <section class="gsec"><h3>Away</h3>${!L ? '<p class="xtNone">No log.</p>' : list(v.away, 'Never left the test.', a => `<li class="bad"><time>${esc(C.clock(a.at))}</time><span>${esc(AWAY[a.kind] || a.kind || 'away')}${a.q ? ` · on question ${esc(a.q)}` : ''}</span><small>${esc(C.dur(a.sec))}</small></li>`)}${dropped('away')}
        <h3 class="mt">Blocked</h3>${!L ? '<p class="xtNone">No log.</p>' : list(v.blocked, 'Nothing was tried.', b => `<li><time>${esc(C.clock(b.at))}</time><span>${esc(BLOCK[b.what] || b.what)}${b.q ? ` · on question ${esc(b.q)}` : ''}</span></li>`)}${dropped('blocked')}
        <h3 class="mt">Idle</h3>${!L ? '<p class="xtNone">No log.</p>' : list(v.idle, 'No pause longer than a minute.', b => `<li><time>${esc(C.clock(b.at))}</time><span>Nothing typed or tapped${b.q ? ` · on question ${esc(b.q)}` : ''}</span><small>${esc(C.dur(b.sec))}</small></li>`)}${dropped('idle')}</section>
    </div>
    ${v.paper.length ? `<section class="gsec"><h3>Scratch paper at Finish</h3>${v.cut ? '<p class="ghint">Long notes were shortened to fit the log.</p>' : ''}<div class="xtPapers">${v.paper.map(p => `<figure class="xtPaper"><figcaption>Question ${esc(p.q)}</figcaption>${p.notes.trim() ? `<pre>${esc(p.notes)}</pre>` : ''}${p.grid ? xtGrid(p.grid) : ''}</figure>`).join('')}</div></section>` : ''}
    <div class="gtwo">
      <section class="gsec"><h3>The clocks</h3><dl class="xtDl">
        <dt>Site: started</dt><dd>${esc(xtWhen(v.started)) || '—'}</dd><dt>Site: finished</dt><dd>${esc(xtWhen(v.finished)) || '—'}</dd>
        <dt>Site: saves</dt><dd>${v.saves ?? '—'}${v.timeline.length ? ` · ${plural(v.timeline.length, 'answer change')} seen` : ''}</dd>
        <dt>Device: test appeared</dt><dd>${L && L.t0 != null ? esc(xtWhen(L.t0)) : '<span class="xtNone">not reported</span>'}${devClock != null && Math.abs(devClock) >= 5 ? ` <small>(${esc(C.dur(Math.abs(devClock)))} ${devClock > 0 ? 'after' : 'before'} the site's start)</small>` : ''}</dd>
        <dt>Device: Finish</dt><dd>${L && L.t1 != null ? esc(xtWhen(L.t1)) : '<span class="xtNone">not reported</span>'}${L && L.deviceSeconds != null ? ` <small>(${esc(C.clock(L.deviceSeconds))} on the device's clock)</small>` : ''}</dd>
        <dt>Saves that failed</dt><dd>${L && L.fails != null ? L.fails : '<span class="xtNone">not reported</span>'}</dd></dl></section>
      <section class="gsec"><h3>The device</h3><dl class="xtDl">
        <dt>Screen</dt><dd>${D.sw != null ? esc(D.sw + ' × ' + D.sh) : dv(null)}${D.dpr != null ? ` <small>at ${esc(D.dpr)}×</small>` : ''}</dd><dt>Window</dt><dd>${D.ww != null ? esc(D.ww + ' × ' + D.wh) : dv(null)}</dd>
        <dt>System</dt><dd>${D.os != null ? esc([D.os, D.osv].filter(x => x != null).join(' ')) : dv(null)}</dd><dt>Browser</dt><dd>${D.br != null ? esc([D.br, D.brv].filter(x => x != null).join(' ')) : dv(null)}</dd>
        <dt>Touch</dt><dd>${dv(D.touch, x => x ? 'yes' : 'no')}</dd><dt>Dark mode</dt><dd>${dv(D.dark, x => x ? 'on' : 'off')}</dd><dt>Larger text</dt><dd>${dv(D.large, x => x ? 'on' : 'off')}</dd><dt>Zoom</dt><dd>${dv(D.zoom, x => Math.round(x * 100) + '%')}</dd><dt>Time zone</dt><dd>${dv(D.tz)}</dd></dl></section>
    </div>
    <section class="gsec xtRec"><h3>The record</h3><dl class="xtDl wide"><dt>Code</dt><dd>${esc(SEALX().showCode(code))}</dd><dt>Test</dt><dd>${esc(v.course)} · unit ${esc(v.unit)} · content ${esc(v.cv)} · kit ${esc(v.kit)}</dd><dt>Drawn test</dt><dd><code>${esc(v.seed)}</code></dd><dt>Sitting</dt><dd><code>${esc(v.id)}</code></dd><dt>Opened</dt><dd>${esc(whenText(e.got))}, ${e.src === 'file' ? 'from the cockpit\'s results file' : 'from the site'}; opened and checked with the site's signature today.</dd></dl></section>
    <div class="xtDelRow"><button class="linkbtn xtDel" id="xtDelD">Delete this test</button></div>
  </div>`;
  xtDrawTL(v);
  const gd = $('#xtGiveD'); if (gd) gd.onclick = () => xtChoose(s, code, 'give');
  const nd = $('#xtNotD'); if (nd) nd.onclick = () => xtNotTheirs(s, code);
  const dd = $('#xtDelD'); if (dd) dd.onclick = () => xtDeleteAsk(code);
  wrap.querySelectorAll('[data-xq]').forEach(b => b.onclick = () => { const el = document.getElementById('xq-' + b.dataset.xq); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('xtLit'); setTimeout(() => el.classList.remove('xtLit'), 1600); } });
}
/* The sitting, drawn: one row per question across the test's length (when it was on screen, when its answer changed, when it
   was flagged), and under it a row each for away, the calculator, scratch paper, idle and blocked, then the site's saves
   on the site's own clock. The device's rows are in seconds from when the test appeared on the device. */
// drawn at the pixels it has, so its words are the page's size on any screen; again when the window changes size
let xtTLv = null, xtTLt = null;
function xtDrawTL(v) { xtTLv = v; const box = $('#gridwrap .xtTLsvg'); if (!box) return; box.innerHTML = xtTimeline(v, box.clientWidth); xtWireTL(); }
function xtWireTL() { $('#gridwrap').querySelectorAll('.xtTimeline [data-xq]').forEach(b => b.onclick = () => { const el = document.getElementById('xq-' + b.dataset.xq); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('xtLit'); setTimeout(() => el.classList.remove('xtLit'), 1600); } }); }
window.addEventListener('resize', () => { clearTimeout(xtTLt); xtTLt = setTimeout(() => { if (view.mode === 'tests' && view.code && xtTLv && $('#gridwrap .xtTLsvg')) xtDrawTL(xtTLv); }, 150); });
function xtTimeline(v, width) {
  const C = EX(); const L = v.log; const qs = v.questions;
  const end = Math.max(1, L && L.deviceSeconds != null ? L.deviceSeconds : 0, v.seconds || 0, ...v.visits.map(x => x.at + x.sec), ...v.away.map(x => x.at + x.sec), ...v.calc.map(x => x.at + x.sec), ...v.scratch.map(x => x.at + x.sec), ...v.idle.map(x => x.at + x.sec), ...v.timeline.map(x => x.at));
  const W = Math.max(560, Math.round(width || 1000)), G = 84, R = 16, rowH = qs.length > 24 ? 11 : 15, X = s => G + Math.max(0, Math.min(1, s / end)) * (W - G - R);
  let y = 22; const out = []; const lane = (label, h, cls) => { const y0 = y; out.push(`<text class="ll ${cls || ''}" x="${G - 10}" y="${y0 + h / 2 + 4}" text-anchor="end">${label}</text><line class="lg" x1="${G}" x2="${W - R}" y1="${y0 + h}" y2="${y0 + h}"/>`); y += h + 4; return y0; };
  const step = [60, 120, 300, 600, 900, 1200, 1800, 3600].find(s => end / s <= 10) || Math.ceil(end / 10 / 3600) * 3600;   // never more than a dozen ticks, whatever a record claims
  const ticks = []; for (let s = 0; s <= end; s += step) ticks.push(s);
  // questions
  const qY = {}; const top = y; qs.forEach(q => { qY[q.q] = y; y += rowH; });
  const qEnd = y;
  out.push(`<rect class="qband" x="${G}" y="${top}" width="${W - G - R}" height="${qEnd - top}"/>`);
  qs.forEach((q, i) => { const yy = qY[q.q]; if (i % 2) out.push(`<rect class="zebra" x="${G}" y="${yy}" width="${W - G - R}" height="${rowH}"/>`);
    out.push(`<text class="ql ${q.v}" x="${G - 10}" y="${yy + rowH / 2 + 4}" text-anchor="end" data-xq="${esc(q.parts[0].id)}"><title>Question ${esc(q.q)}: ${esc(q.v === 'right' ? 'right' : q.v === 'blank' ? 'blank' : q.v === 'some' ? 'part right' : q.v === 'unread' ? 'can\'t read' : 'not right')}</title>${esc(q.q)}</text><circle class="qv ${q.v}${q.almost ? ' almost' : ''}" cx="${G - 4}" cy="${yy + rowH / 2}" r="2.6"/>`); });
  v.visits.forEach(x => { const yy = qY[x.q]; if (yy == null) return; out.push(`<rect class="vis" x="${X(x.at).toFixed(1)}" y="${yy + 2}" width="${Math.max(1.5, X(x.at + x.sec) - X(x.at)).toFixed(1)}" height="${rowH - 4}" rx="2"><title>Question ${esc(x.q)}: ${esc(C.clock(x.at))}–${esc(C.clock(x.at + x.sec))} (${esc(C.dur(x.sec))})</title></rect>`); });
  v.parts.forEach(p => { const yy = qY[p.q]; if (yy == null) return; p.vals.forEach(x => { const at = xtNum(x[0]); if (at == null) return; out.push(`<path class="chg ${x[2] === 'keypad' ? 'kp' : x[2] === 'tap' ? 'tap' : ''}" d="M${X(at).toFixed(1)} ${yy + 1}v${rowH - 2}"><title>${esc(p.id)} at ${esc(C.clock(at))}: ${esc(C.answerText(p.type, x[1]) || '(empty)')} (${esc(x[2] === 'tap' ? 'picked' : x[2] || '')})</title></path>`); }); });
  y += 6;
  const blocks = (list, cls, tip) => list.map(x => `<rect class="${cls}" x="${X(x.at).toFixed(1)}" y="${y + 2}" width="${Math.max(2, X(x.at + x.sec) - X(x.at)).toFixed(1)}" height="12" rx="2"><title>${tip(x)}</title></rect>`).join('');
  const AW = { tab: 'another tab or app', window: 'another window', fullscreen: 'out of full screen', reload: 'reloaded' };
  if (L) {
    out.push(blocks(v.away, 'away', x => `Away (${esc(AW[x.kind] || x.kind)}) at ${esc(C.clock(x.at))} for ${esc(C.dur(x.sec))}${x.q ? ', on question ' + esc(x.q) : ''}`)); lane('Away', 16, v.away.length ? 'bad' : '');
    out.push(blocks(v.calc, 'calc', x => `Calculator at ${esc(C.clock(x.at))} for ${esc(C.dur(x.sec))}, question ${esc(x.q)}`)); lane('Calculator', 16);
    out.push(blocks(v.scratch, 'scr', x => `Scratch paper (${x.tab}) at ${esc(C.clock(x.at))} for ${esc(C.dur(x.sec))}, question ${esc(x.q)}`)); lane('Scratch', 16);
    out.push(blocks(v.idle, 'idle', x => `Idle ${esc(C.dur(x.sec))} at ${esc(C.clock(x.at))}${x.q ? ', question ' + esc(x.q) : ''}`)); lane('Idle', 16);
    out.push(v.blocked.map(x => `<path class="blk" d="M${(X(x.at) - 4).toFixed(1)} ${y + 4}l8 8m0 -8l-8 8"><title>Blocked: ${esc(x.what)} at ${esc(C.clock(x.at))}</title></path>`).join('')); lane('Blocked', 16);
  }
  out.push(v.timeline.map(x => `<path class="save" d="M${X(x.at).toFixed(1)} ${y + 3}v10"><title>The site saw ${esc(x.part)} change at ${esc(C.clock(x.at))} (site's clock)</title></path>`).join('')); lane('Site saves', 16);
  const H = y + 22;
  const grid = ticks.map(s => `<line class="tk" x1="${X(s).toFixed(1)}" x2="${X(s).toFixed(1)}" y1="14" y2="${H - 18}"/><text class="tl" x="${X(s).toFixed(1)}" y="${H - 4}" text-anchor="middle">${!s ? '0' : s >= 7200 ? Math.round(s / 3600) + ' h' : Math.round(s / 60) + ' min'}</text>`).join('');
  const fin = v.seconds != null ? `<line class="fin" x1="${X(v.seconds).toFixed(1)}" x2="${X(v.seconds).toFixed(1)}" y1="10" y2="${H - 18}"/><text class="finl" x="${X(v.seconds).toFixed(1)}" y="9" text-anchor="${v.seconds / end > 0.9 ? 'end' : 'middle'}">Finish ${esc(C.clock(v.seconds))}</text>` : '';
  const legend = `<div class="xtLegend"><span><i class="vis"></i>On screen</span><span><i class="chg"></i>Answer changed</span><span><i class="away"></i>Away</span><span><i class="calc"></i>Calculator</span><span><i class="scr"></i>Scratch paper</span><span><i class="idle"></i>Idle over a minute</span><span><i class="dotk right"></i>Right</span><span><i class="dotk wrong"></i>Not right</span><span><i class="dotk blank"></i>Blank</span></div>`;
  return `${legend}<svg class="xtTimeline" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="The sitting over ${esc(C.clock(end))}: when each question was on screen, and the times away, the calculator, scratch paper and idle stretches">${grid}${out.join('')}${fin}</svg>${v.drop.visits ? `<p class="xtDrop">${plural(v.drop.visits, 'visit')} after the first 300 are not drawn (not kept).</p>` : ''}`;
}
// scratch paper's grid, as the student left it: 20 × 20 squares, four quadrants or the first, in squares from the lower left
function xtGrid(g) {
  const S = 160, u = S / 20, P = 8, X = x => P + x * u, Y = y => P + S - y * u; const lines = [];
  for (let i = 0; i <= 20; i++) lines.push(`<line class="${i % 5 ? 'gl' : 'gl5'}" x1="${X(i)}" x2="${X(i)}" y1="${Y(0)}" y2="${Y(20)}"/><line class="${i % 5 ? 'gl' : 'gl5'}" x1="${X(0)}" x2="${X(20)}" y1="${Y(i)}" y2="${Y(i)}"/>`);
  const ax = g.four ? 10 : 0; lines.push(`<line class="ax" x1="${X(0)}" x2="${X(20)}" y1="${Y(ax)}" y2="${Y(ax)}"/><line class="ax" x1="${X(ax)}" x2="${X(ax)}" y1="${Y(0)}" y2="${Y(20)}"/>`);
  const clip = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; if (!dx && !dy) return null; let t0 = -1e9, t1 = 1e9; for (const [p, q] of [[-dx, x1], [dx, 20 - x1], [-dy, y1], [dy, 20 - y1]]) { if (p === 0) { if (q < 0) return null; continue; } const r = q / p; if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r); } return t0 > t1 ? null : [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy]; };
  const things = g.o.map(t => t[0] === 'p' ? `<circle class="pt" cx="${X(t[1])}" cy="${Y(t[2])}" r="3"/>` : t[0] === 's' ? `<line class="seg" x1="${X(t[1])}" y1="${Y(t[2])}" x2="${X(t[3])}" y2="${Y(t[4])}"/>` : (() => { const c = clip(t[1], t[2], t[3], t[4]); return c ? `<line class="seg ln" x1="${X(c[0])}" y1="${Y(c[1])}" x2="${X(c[2])}" y2="${Y(c[3])}"/>` : ''; })());
  return `<svg class="xtGrid" viewBox="0 0 ${S + 2 * P} ${S + 2 * P}" role="img" aria-label="Scratch grid, ${g.four ? 'four quadrants' : 'first quadrant'}, each square ${g.scale}: ${g.o.length} marks">${lines.join('')}${things.filter(t => /^<line/.test(t)).join('')}${things.filter(t => /^<circle/.test(t)).join('')}</svg><figcaption class="xtGridCap">${g.four ? 'Four quadrants' : 'First quadrant'} · a square is ${esc(g.scale)}</figcaption>`;
}
