/* ---------- Tests (16 Nov 2026): unit tests taken on mrshaffer.org, opened here ----------
   Croix, 15 Nov 2026: "You build me a descrytor inside tally or something like that." "I want literally all the data that is
   possible to get …" "How do I know it'll open on my tally?" The design is Windmill's practice/exam/DESIGN.md (sections 3
   and 4); the lock is vendor/seal.js (window.ExamSeal, Windmill's exam/seal.js unchanged); the reading of sheets, names,
   records and flags is examcore.js (window.ExamCore). This file is the keeping, the fetching and the screens.

   What Tally keeps (all of it in this browser's Tally data and in a Full save; none of it in a Board save):
     state.exam = {site, pairs: [JSON text of {priv, pub, made}] (every key Tally has made, newest last), sites: [{key, made,
       got}] (every site key it has been paired with), trial: {code, words, at, key} (the last trial it opened), warned,
       rows: the form's responses (each {code, codes, name, line, when, at, raw, got, who: {sec, n} | null, how, cands}),
       loose: {code: entry} (opened records that belong to no student yet), fails: {code: {why, course, unit, at}},
       picks: {"sec|name|course/unit": code}, alias: {typed name's key: {sec, n}}, period: {sec: {from, to}}, view: {sec: test}}
     sec.exams = {code: entry}: the opened records of that class's students. entry = {r: the record, got, src: 'site' | 'file',
       n: the student, pin: {sec, n} (the teacher's choice) | null}
   A record is kept only after it opened with one of Tally's keys AND its signature held with one of the site's keys.
   The only requests: GET <site>/api/test/key and GET <site>/api/test/result/<code>. Neither carries a name. */
const EXAM_SITE = 'https://mrshaffer.org';
const EX = () => window.ExamCore, SEALX = () => window.ExamSeal;
const examCan = () => !!(window.ExamSeal && window.crypto && crypto.subtle && window.CompressionStream && window.DecompressionStream && window.isSecureContext !== false);
const xtNum = v => typeof v === 'number' && isFinite(v) ? v : null;
const xtStr = (v, n) => typeof v === 'string' ? v.slice(0, n || 200) : null;
function examPairOk(t) { try { const p = JSON.parse(t); return !!(p && p.priv && p.priv.kty === 'EC' && p.priv.d && /^TALLY1\.[A-Za-z0-9_-]{87}$/.test(p.pub)); } catch (e) { return false; } }
function cleanExamEntry(e) {
  if (!e || typeof e !== 'object' || !e.r || typeof e.r !== 'object' || Array.isArray(e.r)) return null;
  const who = w => w && typeof w === 'object' && typeof w.sec === 'string' && typeof w.n === 'string' ? { sec: w.sec, n: w.n } : null;
  return { r: e.r, got: xtStr(e.got, 30), src: e.src === 'file' ? 'file' : 'site', n: xtStr(e.n, 120), pin: who(e.pin) };
}
function cleanExamMap(o) { const out = {}; if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (!/^[0-9A-HJKMNP-TV-Z]{12}$/.test(k)) continue; const e = cleanExamEntry(o[k]); if (e) out[k] = e; } return out; }
function cleanExam(x) {
  x = x && typeof x === 'object' ? x : {};
  const site = typeof x.site === 'string' && /^https?:\/\/[^\s/?#]+$/.test(x.site) ? x.site : EXAM_SITE;
  const pairs = [...new Set((Array.isArray(x.pairs) ? x.pairs : []).filter(p => typeof p === 'string' && examPairOk(p)))];
  const seen = new Set(); const sites = (Array.isArray(x.sites) ? x.sites : []).filter(s => s && typeof s.key === 'string' && /^[A-Za-z0-9_-]{87}$/.test(s.key) && !seen.has(s.key) && seen.add(s.key)).map(s => ({ key: s.key, made: xtNum(s.made), got: xtStr(s.got, 30) }));
  const who = w => w && typeof w === 'object' && typeof w.sec === 'string' && typeof w.n === 'string' ? { sec: w.sec, n: w.n.slice(0, 120) } : null;
  const rows = (Array.isArray(x.rows) ? x.rows : []).filter(r => r && typeof r === 'object').map(r => ({ codes: (Array.isArray(r.codes) ? r.codes : []).filter(c => /^[0-9A-HJKMNP-TV-Z]{12}$/.test(c)).slice(0, 4), name: xtStr(r.name, 120) || '', line: xtNum(r.line) || 0, when: xtNum(r.when), at: xtStr(r.at, 40) || '', raw: xtStr(r.raw, 60) || '', got: xtStr(r.got, 30), who: who(r.who), how: ['exact', 'loose', 'you'].includes(r.how) ? r.how : null, cands: (Array.isArray(r.cands) ? r.cands : []).map(who).filter(Boolean).slice(0, 6) })).slice(-2000);
  const fails = {}; if (x.fails && typeof x.fails === 'object') for (const k of Object.keys(x.fails)) { const f = x.fails[k]; if (/^[0-9A-HJKMNP-TV-Z]{12}$/.test(k) && f && ['none', 'format', 'key', 'signature', 'code', 'net'].includes(f.why)) fails[k] = { why: f.why, course: xtStr(f.course, 8), unit: xtNum(f.unit), at: xtStr(f.at, 30) }; }
  const strMap = (o, ok) => { const out = {}; if (o && typeof o === 'object') for (const k of Object.keys(o)) if (SAFE_KEY(k) && ok(o[k])) out[k] = o[k]; return out; };
  return { site, pairs, sites, trial: x.trial && typeof x.trial === 'object' && typeof x.trial.words === 'string' ? { code: xtStr(x.trial.code, 12), words: x.trial.words.slice(0, 60), at: xtStr(x.trial.at, 30), key: xtStr(x.trial.key, 90) } : null, warned: !!x.warned,
    rows, loose: cleanExamMap(x.loose), fails, picks: strMap(x.picks, v => typeof v === 'string' && /^[0-9A-HJKMNP-TV-Z]{12}$/.test(v)), alias: strMap(x.alias, v => !!who(v)),
    period: strMap(x.period, v => v && typeof v === 'object' && /^\d{1,2}:\d{2}$/.test(v.from) && /^\d{1,2}:\d{2}$/.test(v.to)), view: strMap(x.view, v => typeof v === 'string' && v.length < 20) };
}
const examS = () => (state.exam = state.exam && state.exam.rows ? state.exam : cleanExam(state.exam));
const examPairs = () => examS().pairs.map(t => JSON.parse(t));
const examPub = () => { const p = examPairs(); return p.length ? p[p.length - 1].pub : null; };
// a Full save carries the keys, and opening one never takes a key away from this Tally: the keys here join the save's
const examKeysNow = () => { const X = examS(); return { pairs: X.pairs.slice(), sites: X.sites.slice() }; };
function examKeepKeys(k) { const X = examS(); k.pairs.forEach(p => { if (!X.pairs.includes(p)) X.pairs.unshift(p); }); k.sites.forEach(s => { if (!X.sites.some(x => x.key === s.key)) X.sites.unshift(s); }); }
// the Tests tab's count: what needs a look in this class's newest test (the Grid tab's count works the same way)
function xtTabCount(s) { try { if (!examAll().length && !examS().rows.length) return 0; const { t } = xtCurrent(s); return xtModel(s, t).flags.filter(f => f.level === 'warn').length; } catch (e) { return 0; } }
const examConnected = () => !!(examPairs().length && examS().sites.length);
/* every opened record, wherever it is kept: [{code, e, sec}] */
function examAll() { const out = []; const X = examS(); for (const c of Object.keys(X.loose)) out.push({ code: c, e: X.loose[c], sec: null }); for (const k of state.order) { const s = state.sections[k]; if (s && s.exams) for (const c of Object.keys(s.exams)) out.push({ code: c, e: s.exams[c], sec: k }); } return out; }
function examHeld(code) { return examAll().find(x => x.code === code) || null; }
// the address this copy of Tally may reach (its Content-Security-Policy's connect-src)
function examAllowed(site) { const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]'); const csp = m ? m.getAttribute('content') : ''; const cs = (/connect-src([^;]*)/.exec(csp) || [, ''])[1].trim().split(/\s+/).filter(Boolean);
  if (!m) return { ok: true, list: [] }; let origin = ''; try { origin = new URL(site).origin; } catch (e) { return { ok: false, list: cs }; }
  return { ok: cs.some(x => x === origin || x === origin + '/' || (/:\*$/.test(x) && origin.startsWith(x.slice(0, -2) + ':'))), list: cs.filter(x => x !== "'none'") }; }

/* ---------------------------------------------------------------- the network: two GETs, no name in either */
async function examGet(path) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null; const t = ctl ? setTimeout(() => ctl.abort(), 15000) : null;
  try { const r = await fetch(examS().site + path, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: ctl ? ctl.signal : undefined });
    let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, ok: r.ok, j }; }
  catch (e) { return { status: 0, ok: false, j: null, net: true }; }
  finally { if (t) clearTimeout(t); }
}
// the site's signing key: kept with every one before it (a key made again on the site must not orphan old records)
async function examSiteKey() {
  const r = await examGet('/api/test/key'); if (!r.ok || !r.j || typeof r.j.key !== 'string') return { ok: false, net: !!r.net || !r.status, status: r.status };
  let raw; try { raw = SEALX().unb64u(r.j.key); } catch (e) { raw = null; } if (!raw || raw.length !== 65 || raw[0] !== 4) return { ok: false, bad: true };
  const X = examS(); const had = X.sites.find(s => s.key === r.j.key); if (!had) { X.sites.push({ key: r.j.key, made: xtNum(r.j.made), got: new Date().toISOString() }); save(); }
  return { ok: true, key: r.j.key, fresh: !had };
}
/* Open a locked record with every key Tally has made (newest first) against every site key it holds. Throws with .why. A
   signature that fails once makes Tally ask the site for its key again (a key made again), then try once more. */
let examKeyAsk = null;   // one request for the site's key per batch, shared by every record that needs it
async function examOpen(locked, code) {
  const S = SEALX(), pairs = examPairs().reverse(), sites = () => examS().sites.map(s => s.key);
  if (!pairs.length) { const e = new Error('no key'); e.why = 'nokey'; throw e; }
  const tryAll = async () => { let last = null; for (const p of pairs) { try { return await S.open(locked, p.priv, sites(), code ? { code } : undefined); } catch (e) { last = e; if (e.why !== 'key') throw e; } } throw last; };
  if (!sites().length) { const k = await examSiteKey(); if (!k.ok) { const e = new Error('no site key'); e.why = 'nosite'; throw e; } }
  try { return await tryAll(); }
  catch (e) { if (e.why !== 'signature') throw e; if (!examKeyAsk) examKeyAsk = examSiteKey(); await examKeyAsk; return await tryAll(); }
}

/* ---------------------------------------------------------------- keeping */
function examPut(code, rec, src) {
  const X = examS(); const was = examHeld(code); const e = { r: rec, got: new Date().toISOString(), src, n: null, pin: was ? was.e.pin : null };
  if (was) { if (was.sec) delete state.sections[was.sec].exams[code]; else delete X.loose[code]; }
  X.loose[code] = e; delete X.fails[code];
}
// every record to the student it belongs to (examcore placeAll), or to nobody yet. A response matched to a student who is
// no longer in that class (a roster change, a class removed) is matched again first.
function examRefile() {
  const X = examS(); const roster = examRoster(); const there = w => !!w && roster.some(x => x.sec === w.sec && x.n === w.n);
  X.rows.forEach(r => { if (r.who && !there(r.who)) { r.who = null; r.how = null; examMatch(r, roster); } });
  const all = examAll(); const P = EX().placeAll(X.rows, all.map(x => ({ code: x.code, pin: x.e.pin })));
  for (const x of all) {
    let to = P.place[x.code]; if (to && !(state.sections[to.sec] && classStudents(state.sections[to.sec]).includes(to.n))) to = null;
    const now = x.sec && x.e.n ? { sec: x.sec, n: x.e.n } : null; if (to && now && to.sec === now.sec && to.n === now.n) continue; if (!to && !now) continue;
    if (x.sec) delete state.sections[x.sec].exams[x.code]; else delete X.loose[x.code];
    if (to) { const s = state.sections[to.sec]; s.exams = s.exams || {}; s.exams[x.code] = { ...x.e, n: to.n }; } else X.loose[x.code] = { ...x.e, n: null };
  }
}
// the students of every class, for matching a typed name
function examRoster() { const out = []; for (const k of state.order) { const s = state.sections[k]; if (!s || s.placeholder) continue; classStudents(s).forEach(n => out.push({ sec: k, n, display: n })); } return out; }
function examMatch(r, roster) {
  const X = examS(); if (r.how === 'you' && r.who && roster.some(x => x.sec === r.who.sec && x.n === r.who.n)) return;
  const al = r.name ? X.alias[EX().nameKey(r.name)] : null;
  if (al && roster.some(x => x.sec === al.sec && x.n === al.n)) { r.who = { sec: al.sec, n: al.n }; r.how = 'you'; r.cands = []; return; }
  const m = EX().matchName(r.name, roster); r.who = m.pick != null ? { sec: roster[m.pick].sec, n: roster[m.pick].n } : null; r.how = m.how; r.cands = m.cands.map(i => ({ sec: roster[i].sec, n: roster[i].n }));
}
/* A pasted or opened response sheet → rows kept (a row seen before is not added twice), matched, fetched. */
function examTakeSheet(text, from) {
  const X = examS(); const got = EX().readSheet(text); const now = new Date().toISOString();
  if (got.cols.code == null) return { ok: false, why: 'Tally found no test code in that. A code is 12 letters and digits, like K7QF-2M9D-X4TB: copy the response sheet\'s rows (or the whole sheet) and paste again.' };
  const key = r => (r.codes.join(',') || r.raw) + '|' + EX().nameKey(r.name) + '|' + (r.when || r.at);
  const have = new Set(X.rows.map(key)); const roster = examRoster(); let added = 0;
  for (const r of got.rows) { if (have.has(key(r))) continue; have.add(key(r)); const row = { codes: r.codes, name: r.name, line: r.line, when: r.when, at: r.at, raw: r.raw, got: now, who: null, how: null, cands: [] }; examMatch(row, roster); X.rows.push(row); added++; }
  if (X.rows.length > 2000) X.rows = X.rows.slice(-2000);
  examRefile(); save();
  const codes = [...new Set(got.rows.flatMap(r => r.codes))];
  return { ok: true, rows: got.rows.length, added, codes, cols: got.cols, header: got.header, from };
}
let examJob = null;   // {total, done, net, running}
/* Fetch every code not held yet, three at a time, with a count on screen. A code that failed for the network is tried again;
   one that answered (not found, not this Tally's, not signed) is not, unless asked. */
async function examFetch(codes, again) {
  if (!examCan()) { toast('This browser can\'t open test records here. Open Tally on your laptop in Chrome or Edge.', true, 7000); return; }
  if (!examPairs().length) { toast('Connect Tally first: it needs its key to open a test.', true); return; }
  if (examJob && examJob.running) return;
  const X = examS(); const todo = codes.filter(c => !examHeld(c) && (again || !X.fails[c] || X.fails[c].why === 'net'));
  if (!todo.length) { render(); return; }
  if (!X.sites.length) { const k = await examSiteKey(); if (!k.ok) { toast(`Tally couldn't reach ${esc(X.site)} for the site's key. Check the network and try again.`, true, 7000); return; } }
  examJob = { total: todo.length, done: 0, net: 0, running: true }; examKeyAsk = null; xtProgress();
  const one = async code => {
    const r = await examGet('/api/test/result/' + code);
    if (r.status === 404) X.fails[code] = { why: 'none', at: new Date().toISOString() };
    else if (!r.ok || !r.j || typeof r.j.record !== 'string') { X.fails[code] = { why: r.ok ? 'format' : 'net', at: new Date().toISOString() }; if (!r.ok) examJob.net++; }
    else { try { const rec = await examOpen(r.j.record, code); if (rec && rec.trial) X.fails[code] = { why: 'format', at: new Date().toISOString() }; else examPut(code, rec, 'site'); }
      catch (e) { X.fails[code] = { why: ['format', 'key', 'signature', 'code'].includes(e.why) ? e.why : 'net', at: new Date().toISOString() }; } }
    examJob.done++; xtProgress();
  };
  const q = todo.slice(); const lane = async () => { while (q.length) await one(q.shift()); };
  try { await Promise.all([lane(), lane(), lane()]); }
  finally { const j = examJob; j.running = false; examRefile(); save(); render();
    toast(j.net ? `${j.done - j.net} of ${j.total} fetched. ${plural(j.net, 'code')} couldn't reach the site: <b>Try again</b> when the network is back.` : `Fetched ${plural(j.total, 'test')}.`, !!j.net, 5000); }
}
function xtProgress() { const el = $('#xtProg'); if (!el || !examJob) return; el.classList.remove('hidden'); el.innerHTML = examJob.running ? `<span class="xtSpin" aria-hidden="true"></span>Fetching ${Math.min(examJob.done + 1, examJob.total)} of ${examJob.total}…` : ''; }
/* The cockpit's results file: every locked record of a day, opened with no network. */
async function examOpenFile(obj, name) {
  if (!examCan()) { toast('This browser can\'t open test records here. Open Tally on your laptop in Chrome or Edge.', true, 7000); return; }
  if (!examPairs().length) { toast('Connect Tally first (the Tests tab of any class): it needs its key to open these.', true, 7000); return; }
  const X = examS(); const list = Array.isArray(obj.results) ? obj.results : []; const n = { opened: 0, had: 0, failed: 0, why: {} }; examKeyAsk = null;
  const fileKey = obj.site && typeof obj.site.key === 'string' ? obj.site.key : null; const strange = fileKey && !X.sites.some(s => s.key === fileKey);
  for (const r of list) {
    const code = r && SEALX().readCode(r.code); if (!code || typeof r.record !== 'string') continue;
    if (examHeld(code)) { n.had++; continue; }
    try { const rec = await examOpen(r.record, code); if (rec.trial) continue; examPut(code, rec, 'file'); n.opened++; }
    catch (e) { const why = ['format', 'key', 'signature', 'code'].includes(e.why) ? e.why : 'format'; X.fails[code] = { why, course: xtStr(r.course, 8), unit: xtNum(+r.unit), at: new Date().toISOString() }; n.failed++; n.why[why] = (n.why[why] || 0) + 1; }
  }
  examRefile(); save(); render();
  const loose = Object.keys(X.loose).length;
  toast(`${esc(name || 'Results file')}: ${plural(n.opened, 'test')} opened${n.had ? `, ${n.had} already here` : ''}${loose ? ` · ${plural(loose, 'test')} nobody turned in yet` : ''}${n.failed ? ` · <b>${n.failed} didn't open</b> (${Object.keys(n.why).map(w => xtWhyWord(w) + ' ' + n.why[w]).join(', ')}): see Tests` : ''}${strange ? ' · <b>this file names a site key Tally was never paired with</b>' : ''}.`, !!n.failed || strange, 9000);
}
const xtWhyWord = w => ({ none: 'not on the site', format: 'not a record', key: 'another Tally\'s key', signature: 'not signed by the site', code: 'wrong code', net: 'no network' })[w] || w;

/* ---------------------------------------------------------------- Connect and the trial */
async function examMakeKey() {
  if (!examCan()) return; const X = examS();
  const k = await SEALX().makeTallyKey(); X.pairs.push(JSON.stringify({ priv: k.priv, pub: k.pub, made: new Date().toISOString() })); X.warned = false; X.trial = null; save();
  const s = await examSiteKey(); render();
  if (!s.ok) toast(`The key is made. Tally couldn't reach ${esc(X.site)} for the site's key yet: it tries again when you enter the trial code.`, true, 7000);
}
async function examTrial(text) {
  const out = $('#xtTrialOut'); const say = (h, bad) => { if (out) { out.innerHTML = h; out.classList.toggle('bad', !!bad); } };
  const code = SEALX().readCode(text); if (!code) { say('That isn\'t a code: it is 12 letters and digits, like K7QF-2M9D-X4TB.', true); return; }
  say('<span class="xtSpin" aria-hidden="true"></span>Opening the trial…'); examKeyAsk = null;
  const r = await examGet('/api/test/result/' + code);
  if (r.status === 404) { say(`The site has no record with the code ${esc(SEALX().showCode(code))}. Check the code in the cockpit (a new trial is made each time the key is pasted).`, true); return; }
  if (!r.ok || !r.j || typeof r.j.record !== 'string') { say(`Tally couldn't reach ${esc(examS().site)}. Check the network, then try again.`, true); return; }
  let rec; try { rec = await examOpen(r.j.record, code); }
  catch (e) { say(e.why === 'key' ? 'This trial is locked to another key: the key in the cockpit is not this Tally\'s. Copy the key above and paste it into the cockpit again.' : e.why === 'signature' ? 'The trial opened, but the site did not sign it. Do not use this pairing: check the site\'s address under Connection.' : e.why === 'nosite' ? `Tally couldn't reach ${esc(examS().site)} for the site's key. Check the network, then try again.` : 'That is not a trial record.', true); return; }
  if (!rec || rec.trial !== true || typeof rec.nonce !== 'string') { say('That code is a student\'s test, not the cockpit\'s trial. Enter the trial code the cockpit shows next to Tally\'s key.', true); return; }
  // the four words are made with the site key that signed it and the Tally key it was locked to
  const S = SEALX(); let sk = null, tp = null;
  for (const s of examS().sites) { for (const p of examPairs()) { try { await S.open(r.j.record, p.priv, [s.key]); sk = s.key; tp = p.pub; break; } catch (e) {} } if (sk) break; }
  const w = await S.words(rec.nonce, sk, tp);
  examS().trial = { code, words: w, at: new Date().toISOString(), key: sk }; save(); render();
  const ws = $('.xtWords'); if (ws) ws.scrollIntoView({ block: 'center' });
}

/* ---------------------------------------------------------------- the screens */
function xtTests(s) {   // the tests this class has records (or flags) for, newest first: [{course, unit, key, last}]
  const m = new Map(); const add = (course, unit, t) => { if (!course) return; const k = EX().testKey(course, unit); const o = m.get(k) || { course, unit, key: k, last: 0 }; o.last = Math.max(o.last, t || 0); m.set(k, o); };
  Object.values(s.exams || {}).forEach(e => add(e.r.course, xtNum(e.r.unit), e.r.site && e.r.site.finished));
  const prep = s.prep; Object.values(examS().loose).forEach(e => { const c = EX().COURSES[e.r.course]; if (!c || c.prep === prep) add(e.r.course, xtNum(e.r.unit), e.r.site && e.r.site.finished); });
  Object.values(examS().fails).forEach(f => { if (f.course && (!EX().COURSES[f.course] || EX().COURSES[f.course].prep === prep)) add(f.course, f.unit, 0); });
  return [...m.values()].sort((a, b) => b.last - a.last || String(a.key).localeCompare(String(b.key)));
}
function xtCurrent(s) {
  const list = xtTests(s); const want = view.test || examS().view[s.key];
  const t = list.find(x => x.key === want) || list[0] || { course: s.prep === 'acc' ? 'a7' : 'm7', unit: ((state.settings.currentUnit || {})[s.prep]) || null, key: '', last: 0 };
  if (!t.key) t.key = EX().testKey(t.course, t.unit); return { t, list };
}
// what one class shows for one test: a row per student (Focus order), the records, the flags
function xtModel(s, t) {
  const X = examS(); const C = EX();
  const recs = examAll().map(x => { const v = xtRead(x.e); return { code: x.code, course: v.course, unit: v.unit, started: v.started, finished: v.finished, seconds: v.seconds, opened: v.opened, ended: v.ended, rule: v.rule, after: v.rule && v.rule.after, unlocks: v.unlocks, awayN: v.log ? v.away.length : null, sec: x.sec, n: x.e.n, pin: x.e.pin, points: v.points, of: v.of }; });
  const fl = C.flags({ sec: s.key, prep: s.prep, course: t.course, unit: t.unit, period: X.period[s.key] || null, rows: X.rows, recs, fails: X.fails, picks: X.picks, known: Object.keys(X.loose), show: shown });
  const studs = classStudents(s); const here = e => e.r.course === t.course && xtNum(e.r.unit) === t.unit;
  const rows = studs.map((n, i) => { const mine = Object.keys(s.exams || {}).filter(c => s.exams[c].n === n && here(s.exams[c])).map(c => ({ code: c, e: s.exams[c] }));
    const pk = X.picks[s.key + '|' + n + '|' + t.key]; const use = mine.length === 1 ? mine[0] : mine.find(x => x.code === pk) || null;
    return { i, n, mine, use, v: use ? xtRead(use.e) : null, flags: fl.filter(f => (f.names || []).includes(n)) }; });
  return { rows, flags: fl, recs };
}
// a record read for the screens, once per record object (records never change once kept)
const xtReadCache = new WeakMap(); function xtRead(e) { let v = xtReadCache.get(e.r); if (!v) { v = EX().readRecord(e.r); xtReadCache.set(e.r, v); } return v; }
const xtVerdict = (v, almost) => almost ? '<span class="xtV almost">Almost</span>' : v === 'right' ? '<span class="xtV right">Right</span>' : v === 'wrong' ? '<span class="xtV wrong">Not right</span>' : v === 'blank' ? '<span class="xtV blank">Blank</span>' : v === 'some' ? '<span class="xtV some">Part right</span>' : '<span class="xtV unread">Can\'t read</span>';
const xtWhen = ms => { if (ms == null) return ''; const d = new Date(ms); return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ', ' + EX().hm(ms); };
const xtPct = (p, of) => p != null && of ? Math.round(p / of * 100) : null;
function xtStatusHtml() {
  const X = examS(); const P = examPairs(); const host = (() => { try { return new URL(X.site).host; } catch (e) { return X.site; } })();
  if (!examCan()) return `<div class="notice info xtCan"><span>${ico('info')}</span><span><b>This browser can't open test records here.</b> It has no Web Crypto in this window (a file opened from a tablet's file manager is one such place). The tests Tally has already opened are below; to connect or to fetch new ones, open Tally on your laptop in Chrome or Edge.</span></div>`;
  const state1 = !P.length ? 'off' : !X.sites.length ? 'half' : 'on';
  return `<div class="xtConn ${state1}" role="status"><i aria-hidden="true"></i><span>${state1 === 'on' ? `<b>Connected</b> to ${esc(host)}${X.trial ? ` · pairing checked ${esc(fmtDate(localDay(X.trial.at)))}` : ' · <em>pairing not checked yet</em>'}` : state1 === 'half' ? `<b>Not connected yet:</b> Tally has its key but not ${esc(host)}'s` : `<b>Not connected</b> to ${esc(host)}`}</span><button class="linkbtn" id="xtConnBtn">${state1 === 'on' ? 'Connection' : 'Connect'}</button></div>`;
}
function renderTests(s) {
  const X = examS();
  if (view.connect || !examPairs().length || (!X.trial && !examAll().length && !X.rows.length)) { view.connect = true; return xtConnectPage(s); }
  const wrap = $('#gridwrap'); examRefile();
  if (view.code) return renderTestDetail(s, view.code);
  const { t, list } = xtCurrent(s); const M = xtModel(s, t); const C = EX();
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
  const flagChip = f => `<span class="xtChip ${f.level}">${esc({ shared: 'Shared code', none: 'Not found', format: 'Not a record', key: 'Other key', signature: 'Not signed', code: 'Wrong code', net: 'Not fetched', twice: 'Two tests', left: 'Ended: left', period: 'Outside period', apart: 'Apart from class', opening: 'Other opening', rule: 'Rule not kept', long: 'Very long', teacher: 'Not finished', other: 'Other test', unclaimed: 'Nobody', who: 'Who?', badcode: 'Bad code' }[f.kind] || f.kind)}</span>`;
  const row = r => { const v = r.v;
    if (!r.use) { const f = r.flags; return `<tr class="none"><td class="xtNo">${r.i + 1}</td><td class="stu"><button class="nm nmbtn" data-prof="${esc(r.n)}">${esc(shown(r.n))}</button></td><td colspan="4" class="xtMissing">${r.mine.length > 1 ? `${r.mine.length} tests: choose the one that counts` : f.length ? 'See what to look at, above' : 'No test turned in'}</td><td>${f.map(flagChip).join('')}</td></tr>`; }
    const pc = xtPct(v.points, v.of);
    return `<tr data-xcode="${r.use.code}" tabindex="0" title="Open ${esc(shown(r.n))}'s test"><td class="xtNo">${r.i + 1}</td><td class="stu"><span class="nm">${esc(shown(r.n))}</span></td>
      <td class="xtScore"><b>${v.points ?? '?'}</b><small>/ ${v.of ?? '?'}</small><span class="xtBar" aria-hidden="true"><i style="width:${pc ?? 0}%"></i></span><em>${pc == null ? '' : pc + '%'}</em></td>
      <td class="num">${esc(C.clock(v.seconds))}</td>
      <td class="num ${v.away.length ? 'away' : ''}">${v.log ? (v.away.length ? `${v.away.length} · ${esc(C.dur(v.awaySec))}` : '<span class="xtNone">none</span>') : '<span class="xtNone">no log</span>'}</td>
      <td class="xtFin">${esc(xtWhen(v.finished))}</td><td>${r.flags.map(flagChip).join('')}</td></tr>`; };
  const fbtn = f => {   // the button that does something about each flag
    if (f.kind === 'shared') return `<button class="pill small" data-xshare="${f.code}">Say whose it is</button>`;
    if (f.kind === 'who') return `<button class="pill small" data-xwho="${X.rows.indexOf(f.rows[0])}">Choose the student</button>`;
    if (f.kind === 'unclaimed') return `<span class="xtBtns"><button class="pill small pale" data-xcode="${f.code}">Open</button><button class="pill small" data-xgive="${f.code}">Give it to a student</button></span>`;
    if (f.kind === 'none' && f.near && f.near.length && f.rows && f.rows[0] && f.rows[0].who) return `<button class="pill small" data-xnear="${f.code}" data-to="${f.near[0]}">Give ${esc(SEALX().showCode(f.near[0]))} to ${esc(shown(f.rows[0].who.n))}</button>`;
    if (f.kind === 'twice') return `<button class="pill small" data-xtwice="${esc(f.names[0])}">Choose the one that counts</button>`;
    if (['left', 'period', 'apart', 'opening', 'rule', 'long', 'teacher'].includes(f.kind)) return `<button class="pill small pale" data-xcode="${f.code}">Open the test</button>`;
    if (f.kind === 'other') return `<button class="pill small pale" data-xtest="${esc(C.testKey(f.course, f.unit))}">Open ${esc(C.testName(f.course, f.unit))}</button>`;
    if (!examCan()) return '';
    if (f.kind === 'net') return `<button class="pill small" data-xretry="1">Try again</button>`;
    if (f.kind === 'code' || f.kind === 'format') return `<button class="pill small pale" data-xagain="${f.code}">Fetch again</button>`;
    return ''; };
  const flagRow = f => `<li class="${f.level}"><span class="xtFi">${ico(f.level === 'warn' ? 'warn' : 'info')}</span><div><b>${esc(f.text)}</b><p>${esc(f.todo)}</p></div>${fbtn(f)}</li>`;
  const net = M.flags.filter(f => f.kind === 'net');
  const empty = !list.length && !X.rows.length;
  const more = view.xflags ? warns.length : Math.min(warns.length, warns.length > 4 ? 3 : 4);
  const title = list.length > 1 ? `<label class="xtTitle xtTitleSel"><span class="vh">Test</span><select id="xtPick">${list.map(x => `<option value="${esc(x.key)}" ${x.key === t.key ? 'selected' : ''}>${esc(C.testName(x.course, x.unit))}</option>`).join('')}</select></label>` : `<h2 class="xtTitle">${list.length ? esc(C.testName(t.course, t.unit)) : 'Tests'}</h2>`;
  wrap.innerHTML = `<div class="grades xt">
    <div class="xtTop">${title}<div class="xtTopR">${xtStatusHtml()}${list.length ? `<button class="linkbtn xtPerBtn" id="xtPeriod" title="When this class meets: a test finished outside it is flagged">${per ? `Period ${esc(per.from)}–${esc(per.to)}` : 'Set the period\'s times'}</button>` : ''}</div></div>
    <div id="xtProg" class="xtProg ${examJob && examJob.running ? '' : 'hidden'}"></div>
    ${empty ? `<div class="gempty xtEmpty"><h3>No tests here yet</h3><p>When students finish a test on mrshaffer.org they turn in a code through your Google Form. Copy the rows of the form's response sheet and paste them here, or open the cockpit's results file. Tally fetches each test, opens it and puts it with the student.</p><div class="rp-actions"><button class="pill" id="xtPaste2">Paste responses</button><button class="pill pale" id="xtOpen2">Open a file</button></div></div>` : `
    <div class="gcards">
      ${fact('Turned in', `${got.length}<i class="xtOf"> of ${M.rows.length}</i>`, M.rows.length - got.length ? `${M.rows.length - got.length} without a test` : 'everyone')}
      ${fact('Class average', mean == null ? '—' : mean + '%', med == null ? '' : `median ${med}%`)}
      ${fact('Time', times.length ? esc(C.clock(times[Math.floor(times.length / 2)])) : '—', times.length ? `median · ${esc(C.clock(times[0]))} to ${esc(C.clock(times[times.length - 1]))}` : '')}
      ${fact('Left the test', String(left), left ? `${plural(left, 'student')}, ${got.reduce((a, r) => a + r.v.away.length, 0)} times in all` : 'nobody', left ? 'warnish' : '')}
    </div>
    ${warns.length ? `<section class="xtFlags" aria-label="What doesn't add up"><h3>${plural(warns.length, 'thing')} to look at</h3><ul>${warns.slice(0, more).map(flagRow).join('')}</ul>${warns.length > more ? `<button class="linkbtn xtMoreFlags" id="xtMoreFlags">${warns.length - more} more</button>` : view.xflags && warns.length > 4 ? '<button class="linkbtn xtMoreFlags" id="xtMoreFlags">Show fewer</button>' : ''}</section>` : ''}
    <section class="gsec xtTable"><table class="checkTable xtList"><thead><tr><th class="xtNo">#</th>${th('name', 'Student')}${th('score', 'Score')}${th('time', 'Time', 'num')}${th('away', 'Away', 'num')}${th('done', 'Finished')}<th>Flags</th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table>
      <p class="ghint xtHonest">Score, time and finish are the site's own. Away, and everything else a test shows about the sitting, is what the student's device reported: evidence, not proof.</p></section>
    ${infos.length ? `<section class="xtFlags info"><ul>${infos.filter(f => f.kind !== 'net' || f === net[0]).map(f => f.kind === 'net' && net.length > 1 ? { ...f, text: `${plural(net.length, 'code')} not fetched yet.` } : f).map(flagRow).join('')}</ul></section>` : ''}`}
  </div>`;
  xtWire(s, t, M);
  if (examJob && examJob.running) xtProgress();
}
function testsBarHtml(s) {
  if (view.code) { const e = (s.exams && s.exams[view.code]) || examS().loose[view.code]; const r = e ? e.r : {}; return `<div class="crumb"><button id="xtBack">‹ Tests</button><h2>${e ? esc(EX().testName(r.course, xtNum(r.unit))) : 'Tests'}</h2></div>`; }
  if (!examPairs().length || view.connect) return `<span class="meta">Tests taken on the website, opened with Tally's own key</span>`;
  return `<div class="spacer"></div><button class="pill toggle" id="xtCopy" title="Every student's points, in Focus order, to paste into the Focus column">Copy scores</button><button class="pill toggle" id="xtOpen" title="The response sheet saved as CSV, or the cockpit's results file">Open a file</button><button class="pill" id="xtPaste">Paste responses</button>`;
}
function xtWire(s, t, M) {
  const wrap = $('#gridwrap'); const on = (sel, fn) => wrap.querySelectorAll(sel).forEach(b => b.onclick = e => { e.stopPropagation(); fn(b, e); });
  on('#xtConnBtn', () => { view.connect = true; render(); });
  on('[data-xcode]', b => { view.code = b.dataset.xcode; render(); window.scrollTo(0, 0); });
  wrap.querySelectorAll('tr[data-xcode]').forEach(tr => tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); view.code = tr.dataset.xcode; render(); } });
  on('[data-prof]', b => openProfile(s.key, b.dataset.prof));
  on('[data-xsort]', b => { view.xsort = view.xsort === b.dataset.xsort ? 'focus' : b.dataset.xsort; render(); });
  on('[data-xtest]', b => { view.test = b.dataset.xtest; examS().view[s.key] = b.dataset.xtest; save(); render(); });
  on('[data-xretry]', () => examFetch(Object.keys(examS().fails).filter(c => examS().fails[c].why === 'net'), true));
  on('[data-xagain]', b => { delete examS().fails[b.dataset.xagain]; examFetch([b.dataset.xagain], true); });
  on('[data-xshare]', b => xtChoose(s, b.dataset.xshare, 'shared'));
  on('[data-xgive]', b => xtChoose(s, b.dataset.xgive, 'give'));
  on('[data-xwho]', b => xtWho(s, examS().rows[+b.dataset.xwho]));
  on('[data-xtwice]', b => xtTwice(s, t, b.dataset.xtwice));
  on('[data-xnear]', b => { const f = M.flags.find(x => x.code === b.dataset.xnear); const who = f && f.rows[0] && f.rows[0].who; const h = examHeld(b.dataset.to); if (!who || !h) return; h.e.pin = { sec: who.sec, n: who.n }; examRefile(); save(); render(); toast(`${esc(SEALX().showCode(b.dataset.to))} is ${esc(shown(who.n))}'s now.`, false); });
  on('#xtPaste2', () => xtPasteBox()); on('#xtOpen2', () => xtFilePick()); on('#xtPeriod', () => xtPeriodBox(s)); on('#xtMoreFlags', () => { view.xflags = !view.xflags; render(); });
  const pk = wrap.querySelector('#xtPick'); if (pk) pk.onchange = () => { view.test = pk.value; examS().view[s.key] = pk.value; save(); render(); };
  const tr = wrap.querySelectorAll('tr[data-xcode]'); tr.forEach(r => r.onclick = () => { view.code = r.dataset.xcode; render(); window.scrollTo(0, 0); });
}
function xtBarWire(s) {
  const b = $('#bar'); if (!b) return; const on = (id, fn) => { const x = b.querySelector(id); if (x) x.onclick = fn; };
  on('#xtBack', () => { view.code = null; render(); });
  on('#xtPaste', () => xtPasteBox()); on('#xtOpen', () => xtFilePick()); on('#xtCopy', () => xtCopy(s));
}
// the class period's times, so a test finished outside them is flagged (Tally has no bell schedule of its own)
function xtPeriodBox(s) {
  const m = $('#modal'); m.classList.remove('hidden'); const p = examS().period[s.key] || { from: '', to: '' };
  m.innerHTML = `<div class="panel narrow"><header><h2>When ${esc(s.label)} meets</h2><button id="mClose" aria-label="Close">×</button></header><div class="body one"><p>A test finished outside these times is flagged. Leave both empty to flag nothing.</p>
    <div class="row2"><div class="field"><label for="xtFrom">Starts</label><input type="time" id="xtFrom" value="${esc(p.from)}"></div><div class="field"><label for="xtTo">Ends</label><input type="time" id="xtTo" value="${esc(p.to)}"></div></div>
    <div class="rp-actions"><button class="pill" id="xtPerSave">Save</button><button class="pill pale" id="mCancel">Cancel</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  $('#xtPerSave').onclick = () => { const a = $('#xtFrom').value, b = $('#xtTo').value; if (!a && !b) delete examS().period[s.key]; else if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b) || b <= a) { toast('Give a start and an end, the end after the start.', true); return; } else examS().period[s.key] = { from: a, to: b }; save(); close(); render(); };
}
/* pasting the response sheet: a dialog with one box */
function xtPasteBox() {
  const m = $('#modal'); m.classList.remove('hidden'); m.classList.add('private');
  m.innerHTML = `<div class="panel narrow"><header><h2>Paste the form's responses</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body one"><p>In the response sheet, select the rows (or click the corner to select everything), copy, and paste here. Tally finds the timestamp, the name and the code itself; other columns and the header row don't matter.</p>
      <textarea id="xtSheet" class="xtSheet" spellcheck="false" ${state.settings.hideNames ? 'placeholder="Names stay hidden on screen; they are still read."' : 'placeholder="11/16/2026 10:42:13&#9;Ava Nguyen&#9;K7QF-2M9D-X4TB"'}></textarea>
      <p class="xtSheetSay" id="xtSheetSay" aria-live="polite"></p>
      <div class="rp-actions"><button class="pill" id="xtTake">Fetch the tests</button><button class="pill pale" id="mCancel">Cancel</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  const ta = $('#xtSheet'); ta.oninput = () => { const g = EX().readSheet(ta.value); const n = g.rows.reduce((a, r) => a + r.codes.length, 0); $('#xtSheetSay').textContent = !ta.value.trim() ? '' : g.cols.code == null ? 'No code found yet.' : `${plural(g.rows.length, 'response')}, ${plural(n, 'code')}${g.header ? `: codes from “${g.header[g.cols.code]}”${g.cols.name != null ? `, names from “${g.header[g.cols.name]}”` : ', no name column'}` : ''}.`; };
  if (!coarse()) ta.focus();
  $('#xtTake').onclick = () => { const r = examTakeSheet(ta.value, 'paste'); if (!r.ok) { $('#xtSheetSay').textContent = r.why; return; } close(); render(); examFetch(r.codes); };
}
function xtFilePick() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,.tsv,.txt,.json,text/csv,application/json';
  inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; const text = await f.text(); let obj = null; if (/\.json$/i.test(f.name) || /^\s*\{/.test(text)) { try { obj = JSON.parse(text); } catch (e) {} }
    if (obj && Array.isArray(obj.results)) return examOpenFile(obj, f.name);
    if (obj && obj.tally) { toast('That is a Tally save: open it through Import.', true); return; }
    const r = examTakeSheet(text, 'file'); if (!r.ok) { toast(esc(r.why), true, 8000); return; } render(); examFetch(r.codes); };
  inp.click();
}
// a dialog listing students: whose is this code / which student is this
function xtPickStudent(title, lead, cands, onPick, extra) {
  const m = $('#modal'); m.classList.remove('hidden'); m.classList.add('private'); const roster = examRoster();
  const first = cands.filter(c => roster.some(r => r.sec === c.sec && r.n === c.n)); const firstSet = new Set(first.map(c => c.sec + '|' + c.n));
  const opt = (c, i) => `<button class="xtWho" data-i="${i}"><span class="dot" style="--cc:${classColor(state.sections[c.sec])}"></span><b>${esc(shown(c.n))}</b><small>${esc(labShort(state.sections[c.sec].label))}</small></button>`;
  const all = first.concat(roster.filter(r => !firstSet.has(r.sec + '|' + r.n)).map(r => ({ sec: r.sec, n: r.n })));
  m.innerHTML = `<div class="panel narrow"><header><h2>${esc(title)}</h2><button id="mClose" aria-label="Close">×</button></header><div class="body one"><p>${lead}</p>
    ${first.length ? `<div class="xtWhos">${first.map((c, i) => opt(c, i)).join('')}</div>` : ''}<input type="search" id="xtFind" class="xtFind" placeholder="Find a student" aria-label="Find a student"><div class="xtWhos xtAll" id="xtAll"></div>${extra || ''}<div class="rp-actions"><button class="pill pale" id="mCancel">Cancel</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  // with nothing typed: the rest of this class; typing finds anyone in any class
  const paint = q => { const nq = norm(q); const list = all.slice(first.length).filter(c => nq ? norm(c.n).includes(nq) || norm(shown(c.n)).includes(nq) : c.sec === state.active).slice(0, 40); $('#xtAll').innerHTML = list.map(c => opt(c, all.indexOf(c))).join(''); wire(); };
  const wire = () => m.querySelectorAll('.xtWho').forEach(b => b.onclick = () => { close(); onPick(all[+b.dataset.i]); });
  $('#xtFind').oninput = e => paint(e.target.value); paint(''); wire();
  return { close, m };
}
function xtWho(s, r) {
  if (!r) return;
  xtPickStudent('Who turned this in?', `Row ${r.line} of the responses: <b>${esc(r.name ? shown(r.name) : 'no name')}</b>${r.at ? ` at ${esc(r.at)}` : ''}, code ${esc(r.codes.map(c => SEALX().showCode(c)).join(', '))}.${r.cands.length ? ' The likely students first.' : ''}`, r.cands, c => {
    r.who = { sec: c.sec, n: c.n }; r.how = 'you'; if (r.name) examS().alias[EX().nameKey(r.name)] = { sec: c.sec, n: c.n };
    examS().rows.forEach(o => { if (o !== r && !o.who && o.name && EX().nameKey(o.name) === EX().nameKey(r.name)) { o.who = { sec: c.sec, n: c.n }; o.how = 'you'; } });
    examRefile(); save(); render(); toast(`Row ${r.line} is ${esc(shown(c.n))}'s. Tally will read “${esc(shown(r.name || ''))}” as them from now on.`, false, 4500); });
}
function xtChoose(s, code, how) {
  const X = examS(); const rs = X.rows.filter(r => r.codes.includes(code)); const cands = []; rs.forEach(r => { if (r.who && !cands.some(c => c.sec === r.who.sec && c.n === r.who.n)) cands.push(r.who); else r.cands.forEach(c => { if (!cands.some(x => x.sec === c.sec && x.n === c.n)) cands.push(c); }); });
  const h = examHeld(code); const v = h ? EX().readRecord(h.e.r) : null;
  const lead = how === 'shared' ? `${esc(SEALX().showCode(code))} was turned in by ${rs.map(r => `<b>${esc(shown(r.who ? r.who.n : r.name))}</b> (row ${r.line}${r.at ? ', ' + esc(r.at) : ''})`).join(' and ')}. ${v ? `The test: ${v.points} / ${v.of}, finished ${esc(xtWhen(v.finished))}.` : ''} Whose is it?`
    : `${esc(SEALX().showCode(code))}${v ? `: ${v.points} / ${v.of}, finished ${esc(xtWhen(v.finished))}` : ''}. Nobody turned this code in.`;
  xtPickStudent(how === 'shared' ? 'Whose test is this?' : 'Give this test to a student', lead, cands, c => { const hh = examHeld(code); if (!hh) return; hh.e.pin = { sec: c.sec, n: c.n }; examRefile(); save(); render(); toast(`${esc(SEALX().showCode(code))} is ${esc(shown(c.n))}'s now.`, false); });
}
function xtTwice(s, t, n) {
  const list = Object.keys(s.exams || {}).filter(c => s.exams[c].n === n && s.exams[c].r.course === t.course && xtNum(s.exams[c].r.unit) === t.unit);
  const m = $('#modal'); m.classList.remove('hidden'); m.classList.add('private');
  m.innerHTML = `<div class="panel narrow"><header><h2>${esc(shown(n))}: two tests</h2><button id="mClose" aria-label="Close">×</button></header><div class="body one"><p>Each was a separate sitting on the site. The one you choose is the score; the other stays here, marked.</p>
    <div class="xtWhos">${list.map(c => { const v = EX().readRecord(s.exams[c].r); return `<button class="xtWho" data-c="${c}"><b>${v.points} / ${v.of}</b><small>finished ${esc(xtWhen(v.finished))} · ${esc(EX().clock(v.seconds))} · away ${v.away.length}</small><span class="xtCode">${esc(SEALX().showCode(c))}</span></button>`; }).join('')}</div>
    <div class="rp-actions"><button class="pill pale" id="mCancel">Cancel</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { examS().picks[s.key + '|' + n + '|' + t.key] = b.dataset.c; save(); close(); render(); });
}
/* Copy scores: the way a unit's IXL goes to Focus (copyUnit): one line per Focus row, in Focus order, the points or blank */
async function xtCopy(s) {
  const { t } = xtCurrent(s); const M = xtModel(s, t); const gb = s.grades && Array.isArray(s.grades.students) && s.grades.students.length ? s.grades.students : null;
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
  const X = examS(); const P = examPairs(); const pub = P.length ? P[P.length - 1].pub : null; const host = (() => { try { return new URL(X.site).host; } catch (e) { return X.site; } })();
  const can = examCan(); const step = !pub ? 1 : !X.trial ? 3 : 4; const allowed = examAllowed(X.site);
  const li = (n, title, body) => `<li class="${step > n && !(n === 2 && step === 3) ? 'done' : step === n || (n === 2 && step === 3) ? 'now' : ''}"><span class="xtN" aria-hidden="true">${step > n && !(n === 2 && step === 3) ? ico('check') : n}</span><div><h4>${title}</h4>${body}</div></li>`;
  $('#gridwrap').innerHTML = `<div class="grades xt"><div class="xtConnect">
    <div class="xtConnHead"><h3>${examConnected() && X.trial ? 'Connection' : `Connect Tally to the tests on ${esc(host)}`}</h3>${examPairs().length && (X.trial || examAll().length || X.rows.length) ? `<button class="pill ${X.trial && !examAll().length ? '' : 'pale '}small" id="xtDone">${examAll().length || X.rows.length ? 'Back to the tests' : 'Done'}</button>` : ''}</div>
    <p class="xtLead">Every test a student finishes is locked on the site so that only this Tally can open it, and signed by the site so nobody else can make one. This connects the two, once.</p>
    ${!can ? xtStatusHtml() : ''}
    <ol class="xtSteps">
      ${li(1, 'Make Tally\'s key', pub ? `<p>Made ${esc(whenText(P[P.length - 1].made))}. This is the half the website needs; the other half never leaves Tally and your Full saves.</p><div class="xtKeyRow"><code class="xtKey" id="xtKey">${esc(pub)}</code><button class="pill small" id="xtCopyKey">Copy</button></div>
        ${!X.warned ? `<div class="notice xtLose"><span>${ico('warn')}</span><span><b>If this key is lost, nobody can open these tests again: not you, not the site.</b> It lives only in this Tally and in your Full saves. The scores would still be in the cockpit; every answer, time and the rest of the record would not. Make a Full save now and keep it in your school Drive.</span><div class="xtLoseBtns"><button class="pill small" id="xtSaveNow">Full save now</button><button class="linkbtn" id="xtLater">Later</button></div></div>` : ''}`
        : `<p>Only this key opens your students' test records. Tally makes it here; it takes a second.</p><button class="pill" id="xtMake" ${can ? '' : 'disabled'}>Make the key</button>`)}
      ${li(2, 'Paste it into the cockpit', `<p>On ${esc(host)}, open the cockpit's <b>Test</b> card and paste the key into <b>Tally's key</b>. The cockpit makes a trial test and shows its code.</p>`)}
      ${li(3, 'Enter the trial code', `<div class="xtTrialRow"><input id="xtTrialIn" class="xtCodeIn" placeholder="K7QF-2M9D-X4TB" autocomplete="off" spellcheck="false" aria-label="The trial code" ${pub && can ? '' : 'disabled'}><button class="pill small" id="xtTrialGo" ${pub && can ? '' : 'disabled'}>Open</button></div><p class="xtTrialOut" id="xtTrialOut" aria-live="polite"></p>`)}
      ${li(4, 'Type the four words into the cockpit', X.trial ? `<p>Tally opened the trial and checked the site's signature. Type these four words into the box under the trial code on the cockpit's <b>Test</b> card, then press <b>Confirm</b>. Only a Tally that opened the trial knows them, so the site knows the pairing works.</p><div class="xtWordsRow"><div class="xtWords" aria-label="The four words">${X.trial.words.split(' ').map(w => `<span>${esc(w)}</span>`).join('')}</div><button class="pill small" id="xtCopyWords">Copy</button></div><p class="ghint">From the trial ${esc(SEALX().showCode(X.trial.code))}, ${esc(whenText(X.trial.at))}. If the cockpit says the words are wrong, it holds another key: paste this Tally's key again and enter the new trial code.</p>` : '<p>Tally opens the trial with its key and shows four words. You type them into the cockpit; the site works them out on its side, and they match only if the cockpit has this Tally\'s key and Tally has the site\'s.</p>')}
    </ol>
    <details class="xtMore"><summary>Address, keys</summary>
      <div class="xtMoreBody">
        <label class="xtAddr">The site <input id="xtSite" value="${esc(X.site)}" spellcheck="false"></label><button class="pill small pale" id="xtSiteSave">Use this address</button>
        <p class="ghint">${allowed.ok ? `This copy of Tally may reach ${esc(allowed.list.join(', ') || 'any address')}.` : `<b>This copy of Tally may only reach ${esc(allowed.list.join(', '))}</b>: another address would be refused by the browser.`} Tally asks the site for two things only: its signing key, and a test by its code. Nothing about a student is ever sent.</p>
        <h4>Tally's keys</h4><ul class="xtKeys">${P.slice().reverse().map((p, i) => `<li><code>${esc(p.pub.slice(0, 18))}…</code> made ${esc(whenText(p.made))}${i === 0 ? ' · <b>the one to paste</b>' : ' · still opens the tests locked to it'}</li>`).join('') || '<li>none yet</li>'}</ul>
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
function renderTestDetail(s, code) {
  const e = s.exams && s.exams[code] || examS().loose[code]; const wrap = $('#gridwrap');
  if (!e) { view.code = null; return renderTests(s); }
  const v = EX().readRecord(e.r); const C = EX(); const n = e.n;
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
      <td class="xtChg">${changes ? `<details><summary>${p.n != null && p.n > changes ? `${p.n} values` : plural(changes, 'value')}</summary><ol>${p.vals.map(x => `<li><time>${esc(C.clock(x[0]))}</time> <span class="xtTyped">${esc(C.answerText(p.type, x[1]) || '(empty)')}</span> <small>${esc(x[2] === 'keypad' ? 'keypad' : x[2] === 'tap' ? 'tapped' : x[2] === 'typed' ? 'typed' : '')}</small></li>`).join('')}${p.n != null && p.n > changes ? `<li class="xtDrop">${p.n - changes} more in between, not kept (the first 4 and last 8 are)</li>` : ''}</ol></details>` : '<span class="xtNone">—</span>'}${p.pastes ? ` <span class="xtChip warn">${plural(p.pastes, 'paste')}</span>` : ''}</td>
      <td>${i ? '' : q.flagEnd ? '<span class="xtChip info">Flagged</span>' : q.flag ? '<span class="xtChip soft">Flagged, then not</span>' : ''}</td></tr>`; }).join('');
    return parts; }).join('');
  const list = (items, empty, f) => items.length ? `<ul class="xtEvents">${items.map(f).join('')}</ul>` : `<p class="xtNone">${empty}</p>`;
  const dropped = k => v.drop[k] ? `<p class="xtDrop">${v.drop[k]} more not kept (the log keeps ${k === 'visits' ? 300 : 100}).</p>` : '';
  const AWAY = { tab: 'another tab or app', window: 'another window', fullscreen: 'out of full screen', reload: 'reloaded the page' };
  const BLOCK = { copy: 'Copy', cut: 'Cut', menu: 'Right-click menu', print: 'Print', selectall: 'Select all', drag: 'Drag', save: 'Save page' };
  const D = v.device || {}; const dv = (x, f) => x == null ? '<span class="xtNone">not reported</span>' : esc(f ? f(x) : String(x));
  wrap.innerHTML = `<div class="grades xt xtD">
    <section class="xtHead">
      <div class="xtWho1"><h2>${n ? esc(shown(n)) : '<span class="xtNone">Nobody yet</span>'}</h2><p>${esc(C.testName(v.course, v.unit))} · <span class="xtCode">${esc(SEALX().showCode(code))}</span>${e.src === 'file' ? ' · from the cockpit\'s file' : ''}</p>
        ${!n ? `<div class="xtOwn"><span>Nobody turned this code in.</span><button class="pill small" id="xtGiveD">Give it to a student</button></div>` : e.pin ? `<div class="xtOwn"><span>You gave this test to ${esc(shown(n))}.</span><button class="pill small pale" id="xtTakeBack">Take it back</button></div>` : ''}</div>
      <div class="xtBig"><b>${v.points ?? '?'}</b><small>/ ${v.of ?? '?'}</small><span>${pc == null ? '' : pc + '%'}</span></div>
      <dl class="xtFacts">
        <div><dt>Time</dt><dd>${esc(C.clock(v.seconds)) || '—'}</dd></div>
        <div><dt>Finished</dt><dd>${esc(xtWhen(v.finished)) || '—'}</dd></div>
        <div><dt>Left the test</dt><dd class="${v.away.length ? 'away' : ''}">${!L ? '<span class="xtNone">no log</span>' : v.away.length ? `${plural(v.away.length, 'time')} · ${esc(C.dur(v.awaySec))}` : 'never'}</dd></div>
        <div><dt>Taken</dt><dd>${v.started != null ? esc(EX().hm(v.started)) + '–' + esc(EX().hm(v.finished)) : '—'}${v.opened != null ? `<small class="xtOpenTag">opening of ${esc(EX().hm(v.opened))}</small>` : ''}</dd></div>
        <div><dt>Rule</dt><dd>${v.rule ? esc(v.rule.leave === 'lock' ? `Lock after ${v.rule.after}` : v.rule.leave === 'end' ? `End after ${v.rule.after}` : 'Count only') : '—'}${v.unlocks ? ` · unlocked ${plural(v.unlocks, 'time')}` : ''}${v.ended === 'left' ? ' · <b class="bad">ended: left</b>' : v.ended === 'teacher' ? ' · ended by you' : ''}</dd></div>
      </dl>
    </section>
    ${fl.length ? `<section class="xtFlags"><ul>${fl.map(f => `<li class="${f.level}"><span class="xtFi">${ico(f.level === 'warn' ? 'warn' : 'info')}</span><div><b>${esc(f.text)}</b><p>${esc(f.todo)}</p></div></li>`).join('')}</ul></section>` : ''}
    <p class="xtHonest">The answers, the score, and the start and finish times are the site's own. Everything else on this page is what the student's device reported about itself: evidence, not proof.</p>
    <section class="gsec xtTL"><h3>The sitting</h3>${L ? '' : '<p class="xtNone">The device sent no log with this test: only the site\'s own times and saves are known.</p>'}<div class="xtTLsvg"></div></section>
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
    <section class="gsec xtRec"><h3>The record</h3><dl class="xtDl wide"><dt>Code</dt><dd>${esc(SEALX().showCode(code))}</dd><dt>Test</dt><dd>${esc(v.course)} · unit ${esc(v.unit)} · content ${esc(v.cv)} · kit ${esc(v.kit)}</dd><dt>Drawn test</dt><dd><code>${esc(v.seed)}</code></dd><dt>Sitting</dt><dd><code>${esc(v.id)}</code></dd><dt>Opened</dt><dd>${esc(whenText(e.got))}, ${e.src === 'file' ? 'from the cockpit\'s results file' : 'from the site'}; the site's signature held.</dd></dl></section>
  </div>`;
  xtDrawTL(v);
  const gd = $('#xtGiveD'); if (gd) gd.onclick = () => xtChoose(s, code, 'give');
  const tb = $('#xtTakeBack'); if (tb) tb.onclick = () => { const h = examHeld(code); if (!h) return; const was = h.e.n; h.e.pin = null; examRefile(); save(); const now = examHeld(code); if (!now || !now.e.n) { view.code = null; } render(); toast(`${esc(SEALX().showCode(code))} is no longer ${esc(shown(was || ''))}'s.${now && now.e.n ? '' : ' It is back among the tests nobody turned in.'}`, false, 5000); };
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
  const step = [60, 120, 300, 600, 900, 1200, 1800, 3600].find(s => end / s <= 10) || 3600;
  const ticks = []; for (let s = 0; s <= end; s += step) ticks.push(s);
  // questions
  const qY = {}; const top = y; qs.forEach(q => { qY[q.q] = y; y += rowH; });
  const qEnd = y;
  out.push(`<rect class="qband" x="${G}" y="${top}" width="${W - G - R}" height="${qEnd - top}"/>`);
  qs.forEach((q, i) => { const yy = qY[q.q]; if (i % 2) out.push(`<rect class="zebra" x="${G}" y="${yy}" width="${W - G - R}" height="${rowH}"/>`);
    out.push(`<text class="ql ${q.v}" x="${G - 10}" y="${yy + rowH / 2 + 4}" text-anchor="end" data-xq="${esc(q.parts[0].id)}"><title>Question ${esc(q.q)}: ${esc(q.v === 'right' ? 'right' : q.v === 'blank' ? 'blank' : q.v === 'some' ? 'part right' : q.v === 'unread' ? 'can\'t read' : 'not right')}</title>${esc(q.q)}</text><circle class="qv ${q.v}${q.almost ? ' almost' : ''}" cx="${G - 4}" cy="${yy + rowH / 2}" r="2.6"/>`); });
  v.visits.forEach(x => { const yy = qY[x.q]; if (yy == null) return; out.push(`<rect class="vis" x="${X(x.at).toFixed(1)}" y="${yy + 2}" width="${Math.max(1.5, X(x.at + x.sec) - X(x.at)).toFixed(1)}" height="${rowH - 4}" rx="2"><title>Question ${esc(x.q)}: ${esc(C.clock(x.at))}–${esc(C.clock(x.at + x.sec))} (${esc(C.dur(x.sec))})</title></rect>`); });
  v.parts.forEach(p => { const yy = qY[p.q]; if (yy == null) return; p.vals.forEach(x => { const at = xtNum(x[0]); if (at == null) return; out.push(`<path class="chg ${x[2] === 'keypad' ? 'kp' : x[2] === 'tap' ? 'tap' : ''}" d="M${X(at).toFixed(1)} ${yy + 1}v${rowH - 2}"><title>${esc(p.id)} at ${esc(C.clock(at))}: ${esc(C.answerText(p.type, x[1]) || '(empty)')} (${esc(x[2] || '')})</title></path>`); }); });
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
  const grid = ticks.map(s => `<line class="tk" x1="${X(s).toFixed(1)}" x2="${X(s).toFixed(1)}" y1="14" y2="${H - 18}"/><text class="tl" x="${X(s).toFixed(1)}" y="${H - 4}" text-anchor="middle">${s ? Math.round(s / 60) + ' min' : '0'}</text>`).join('');
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
