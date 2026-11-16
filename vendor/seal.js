/* Practice-test kit: locking a test's record, and opening one (16 Nov 2026; practice/exam/DESIGN.md, "3. The record and the
   code"). One file for both ends, so the site that locks a record and the Tally that opens it cannot disagree on the format:
   the site's Worker calls seal(); Tally calls open(). Web Crypto and the platform's own deflate, no library, so it runs in a
   Worker, in a browser (a secure context: https, localhost, a file opened from the disk) and under Node 20+.

   What a locked record is (a student can neither read one, change one nor make one):
     plain  = the record as JSON, UTF-8, deflate-raw
     sig    = ECDSA P-256 / SHA-256 over plain, with the site's key (64 bytes, r ‖ s) — the key never leaves the site
     key    = HKDF-SHA-256(ECDH(a fresh pair made for this record, Tally's public key),
                           salt = the fresh pair's public key, info = "windy-hill-result-v1") → AES-256-GCM
     locked = 01 ‖ the fresh public key (65) ‖ iv (12) ‖ AES-GCM(sig ‖ plain)      carried as base64url text
   Opening needs Tally's private half (so: only Tally); a record that opens was signed by the site (so: only the site made it).

     newCode() → 'K7QF2M9DX4TB'          12 Crockford base-32 characters, fresh randomness (60 bits; at least one a digit):
                                         a record's name
     showCode(code) → 'K7QF-2M9D-X4TB'    readCode(text) → the 12 characters, or null (case, hyphens, spaces, I L O forgiven)
     findCodes(text) → every code in a text, in order, each once (a form's answer cell, a pasted column); a code as shown
                       (no I L O U, a digit) before one that needs a letter forgiven; of overlapping runs, the one written as one thing
     makeSiteKey()  → Promise {priv: JWK, pub: base64url of the 65-byte point}        the site's signing pair (ECDSA)
     makeTallyKey() → Promise {priv: JWK, pub: 'TALLY1.' + base64url of the point}    Tally's pair (ECDH); pub is what is pasted
     readTallyPub(text) → the 65 bytes, or throws (why: 'tally-key')
     seal(record, sitePriv, tallyPub) → Promise<locked text>
     open(locked, tallyPriv, sitePub, {code}?) → Promise<record>; sitePub one key or a list (a site key made again)
        throws an Error whose .why is  'format'     not a locked record
                                       'key'        not locked to this Tally's key (or damaged on the way)
                                       'signature'  it opened, and the site did not sign it — the record is not shown
                                       'code'       it is another code's record
     newTrial(code, now) → the trial record the site seals to prove a pairing ({v, trial: true, code, nonce, made})
     words(nonce, sitePub, tallyPub) → Promise<'maple otter lantern creek'>   the four-word check both ends show: only a
        Tally that opened the trial knows the nonce, and the words differ if either end holds another key
     b64u(bytes), unb64u(text)

   A browser script (window.ExamSeal) and a Node module. check/seal.js holds it: round trips, every byte of a locked record
   changed, the wrong keys, a record a student made, and a record locked on 16 Nov 2026 that must open for as long as there
   are records (check/seal_vector.json). */
(function (root) {
'use strict';
var G = typeof globalThis !== 'undefined' ? globalThis : root, C = G.crypto, S = C && C.subtle;
var ABC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';                    /* Crockford base 32: no I, L, O, U */
var INFO = 'windy-hill-result-v1', PAIR = 'windy-hill-pairing-v1', TALLY = 'TALLY1.';
var EC = { name: 'ECDH', namedCurve: 'P-256' }, DSA = { name: 'ECDSA', namedCurve: 'P-256' }, SIGN = { name: 'ECDSA', hash: 'SHA-256' };

function fail(why, text) { var e = new Error(text); e.why = why; return e; }
function need() { if (!S || !G.CompressionStream) throw fail('platform', 'This browser cannot lock or open a record here (no Web Crypto).'); }
function utf8(t) { return new TextEncoder().encode(t); }
function b64u(b) {
  var s = '';
  for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(t) {
  var s = String(t).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*$/.test(s) || s.length % 4 === 1) throw fail('format', 'not base64url');
  while (s.length % 4) s += '=';
  var b = atob(s), o = new Uint8Array(b.length);
  for (var i = 0; i < b.length; i++) o[i] = b.charCodeAt(i);
  return o;
}
function through(bytes, stream) {
  return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function (b) { return new Uint8Array(b); });
}
function join(list) {
  var n = 0, i; for (i = 0; i < list.length; i++) n += list[i].length;
  var o = new Uint8Array(n), at = 0; for (i = 0; i < list.length; i++) { o.set(list[i], at); at += list[i].length; }
  return o;
}

/* ---- the code ---- */
function newCode() {                                             /* always with a digit in it, so a code is never a word */
  for (;;) { var b = C.getRandomValues(new Uint8Array(12)), s = ''; for (var i = 0; i < 12; i++) s += ABC[b[i] & 31]; if (/[0-9]/.test(s)) return s; }
}
function readCode(t) {
  var s = String(t == null ? '' : t).toUpperCase().replace(/[\s\-‐-―_.]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  return /^[0-9A-HJKMNP-TV-Z]{12}$/.test(s) ? s : null;
}
function showCode(c) { var s = readCode(c); return s ? s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8) : String(c == null ? '' : c); }
/* Every code in a text, in the text's order, each once. A code as the site shows it has no I, L, O or U and at least one digit,
   so a run that reads as one only after forgiving a letter ("code K7QF-…" → C0DE-K7QF-…) is taken only when the text holds no
   code as shown. Where runs overlap, the one written as one thing wins: twelve together or the same separator twice
   (K7QF-2M9D-X4TB, K7QF 2M9D X4TB, K7QF - 2M9D - X4TB, dots, slashes), then the one with more groups holding a digit
   ("Mary K7QF 2M9D X4TB" is not MARY-K7QF-2M9D), then the leftmost. */
function findCodes(text) {
  var t = String(text == null ? '' : text), SEP = '([\\s\\-\\u2010-\\u2015_.\\/]*)', G = '([0-9A-Za-z]{4})';
  var re = new RegExp('(?=' + G + SEP + G + SEP + G + '(?![0-9A-Za-z]))', 'g'), m, shown = [], forgiven = [];
  while ((m = re.exec(t))) {
    var i = m.index; re.lastIndex = i + 1;
    if (i > 0 && /[0-9A-Za-z]/.test(t.charAt(i - 1))) continue;                      /* a run starts where a word does */
    var raw = (m[1] + m[3] + m[5]).toUpperCase(), s1 = m[2].replace(/\s+/g, ''), s2 = m[4].replace(/\s+/g, '');
    var c = readCode(raw); if (!c) continue;
    var one = (m[2] === '' && m[4] === '') || (m[2] !== '' && m[4] !== '' && s1 === s2);
    var digits = (/[0-9]/.test(m[1]) ? 1 : 0) + (/[0-9]/.test(m[3]) ? 1 : 0) + (/[0-9]/.test(m[5]) ? 1 : 0);
    var cand = { c: c, at: i, end: i + m[1].length + m[2].length + m[3].length + m[4].length + m[5].length, rank: (one ? 0 : 10) - digits };
    if (!/[ILOU]/.test(raw) && digits > 0) shown.push(cand);
    else if (digits > 0 || ((m[2] !== '' || m[4] !== '') && /[0-9]/.test(c))) forgiven.push(cand);   /* a code has a digit once read; twelve letters together are a word */
  }
  var list = shown.length ? shown : forgiven, kept = [];
  list.sort(function (a, b) { return a.rank - b.rank || a.at - b.at; });
  list.forEach(function (x) { if (!kept.some(function (k) { return x.at < k.end && k.at < x.end; })) kept.push(x); });
  kept.sort(function (a, b) { return a.at - b.at; });
  var out = []; kept.forEach(function (x) { if (out.indexOf(x.c) < 0) out.push(x.c); });
  return out;
}

/* ---- the keys ---- */
function makeSiteKey() {
  need();
  return S.generateKey(DSA, true, ['sign', 'verify']).then(function (kp) {
    return Promise.all([S.exportKey('jwk', kp.privateKey), S.exportKey('raw', kp.publicKey)]);
  }).then(function (r) { return { priv: r[0], pub: b64u(new Uint8Array(r[1])) }; });
}
function makeTallyKey() {
  need();
  return S.generateKey(EC, true, ['deriveBits']).then(function (kp) {
    return Promise.all([S.exportKey('jwk', kp.privateKey), S.exportKey('raw', kp.publicKey)]);
  }).then(function (r) { return { priv: r[0], pub: TALLY + b64u(new Uint8Array(r[1])) }; });
}
function readTallyPub(t) {
  if (t instanceof Uint8Array) { if (t.length === 65 && t[0] === 4) return t; throw fail('tally-key', "That is not Tally's key."); }
  var s = String(t == null ? '' : t).replace(/\s+/g, ''), b;
  if (s.slice(0, TALLY.length) !== TALLY) throw fail('tally-key', "That is not Tally's key.");
  try { b = unb64u(s.slice(TALLY.length)); } catch (e) { throw fail('tally-key', "That is not Tally's key."); }
  if (b.length !== 65 || b[0] !== 4) throw fail('tally-key', "That is not Tally's key.");
  return b;
}
function sitePubs(p) {
  return (Array.isArray(p) ? p : [p]).filter(function (x) { return x != null && x !== ''; }).map(function (x) {
    var b = x instanceof Uint8Array ? x : unb64u(x);
    if (b.length !== 65 || b[0] !== 4) throw fail('site-key', "That is not the site's key.");
    return b;
  });
}
function aesKey(shared, salt, use) {
  return S.importKey('raw', shared, 'HKDF', false, ['deriveKey']).then(function (hk) {
    return S.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: utf8(INFO) }, hk, { name: 'AES-GCM', length: 256 }, false, [use]);
  });
}

/* ---- lock ---- */
async function seal(record, sitePriv, tallyPub) {
  need();
  var tp = await S.importKey('raw', readTallyPub(tallyPub), EC, false, []).catch(function () { throw fail('tally-key', "That is not Tally's key."); });
  var plain = await through(utf8(JSON.stringify(record)), new G.CompressionStream('deflate-raw'));
  var sk = sitePriv && sitePriv.type === 'private' ? sitePriv : await S.importKey('jwk', sitePriv, DSA, false, ['sign']);
  var sig = new Uint8Array(await S.sign(SIGN, sk, plain));
  var eph = await S.generateKey(EC, true, ['deriveBits']);
  var ephPub = new Uint8Array(await S.exportKey('raw', eph.publicKey));
  var key = await aesKey(await S.deriveBits({ name: 'ECDH', public: tp }, eph.privateKey, 256), ephPub, 'encrypt');
  var iv = C.getRandomValues(new Uint8Array(12));
  var ct = new Uint8Array(await S.encrypt({ name: 'AES-GCM', iv: iv }, key, join([sig, plain])));
  return b64u(join([new Uint8Array([1]), ephPub, iv, ct]));
}

/* ---- open ---- */
async function open(locked, tallyPriv, sitePub, opts) {
  need();
  var b, keys = sitePubs(sitePub);
  try { b = locked instanceof Uint8Array ? locked : unb64u(locked); } catch (e) { throw fail('format', 'This is not a locked record.'); }
  if (b.length < 1 + 65 + 12 + 16 + 64 + 1 || b[0] !== 1 || b[1] !== 4) throw fail('format', 'This is not a locked record.');
  var ephPub = b.subarray(1, 66), iv = b.subarray(66, 78), ct = b.subarray(78), eph, body;
  var priv = tallyPriv && tallyPriv.type === 'private' ? tallyPriv : await S.importKey('jwk', tallyPriv, EC, false, ['deriveBits']);
  try { eph = await S.importKey('raw', ephPub, EC, false, []); } catch (e) { throw fail('format', 'This is not a locked record.'); }
  var key = await aesKey(await S.deriveBits({ name: 'ECDH', public: eph }, priv, 256), ephPub, 'decrypt');
  try { body = new Uint8Array(await S.decrypt({ name: 'AES-GCM', iv: iv }, key, ct)); }
  catch (e) { throw fail('key', "This record is not locked to this Tally's key."); }
  if (body.length < 65) throw fail('format', 'This is not a locked record.');
  var sig = body.subarray(0, 64), plain = body.subarray(64), ok = false;
  for (var i = 0; i < keys.length && !ok; i++) {
    var vk = await S.importKey('raw', keys[i], DSA, false, ['verify']);
    ok = await S.verify(SIGN, vk, sig, plain);
  }
  if (!ok) throw fail('signature', 'The site did not sign this record.');
  var record;                                                    /* inflated only once the site's signature holds */
  try { record = JSON.parse(new TextDecoder().decode(await through(plain, new G.DecompressionStream('deflate-raw')))); }
  catch (e) { throw fail('format', 'This is not a locked record.'); }
  if (opts && opts.code != null && (!record || record.code !== readCode(opts.code))) throw fail('code', "This is another code's record.");
  return record;
}

/* ---- proving a pairing ---- */
function newTrial(code, now) { return { v: 1, trial: true, code: code, nonce: b64u(C.getRandomValues(new Uint8Array(16))), made: now }; }
async function words(nonce, sitePub, tallyPub) {
  need();
  var sp = sitePubs(sitePub); if (sp.length !== 1) throw fail('site-key', "That is not the site's key.");
  var h = new Uint8Array(await S.digest('SHA-256', join([utf8(PAIR), unb64u(nonce), sp[0], readTallyPub(tallyPub)])));
  return [WORDS[h[0]], WORDS[h[1]], WORDS[h[2]], WORDS[h[3]]].join(' ');
}
/* 256 plain words, one a byte */
var WORDS = ('ant bat bear bee bird calf cat colt cow crab crow deer dog dove duck eagle eel elk fish fox frog goat goose hawk hen horse ' +
  'lamb lark lion lynx mole moose moth mouse mule newt otter owl pony puppy quail robin seal shark sheep snail swan tiger toad trout ' +
  'whale wolf wren yak zebra acorn beach berry bloom branch brook bush canyon cave cliff cloud coast coral creek dawn delta desert ' +
  'dune dusk field fern flame flint flood forest frost glade grass grove hill ice island lake leaf maple marsh meadow moon moss oak ' +
  'ocean peak pebble pine pond rain reef ridge river rock root sand sea shade shore sky snow spring star stone storm stream sun thorn ' +
  'tide trail tree valley wave wind wood apple bagel bean bread butter cake carrot cherry corn cocoa grape honey jam lemon lime mango ' +
  'melon mint nut oat olive onion peach pear pepper plum rice salt soup toast anchor arrow badge ball banner barn basket bell bench ' +
  'boat book boot bottle bowl box brick bridge broom brush bucket button cabin candle canoe card chair chalk clock coat coin comb cup ' +
  'desk door drum fence flag flute fork gate glove hammer harp hat helmet hook horn jar kettle key kite ladder lamp lantern map ' +
  'mirror nail needle net oar paddle page pail pan pen pencil piano pillow plate pocket quilt raft ribbon ring rope ruler saddle sail ' +
  'scarf shelf ship shoe shovel sled spoon stamp string table tent ticket towel tower train tray trunk vase wagon wheel window yarn').split(' ');

var api = { newCode: newCode, showCode: showCode, readCode: readCode, findCodes: findCodes, makeSiteKey: makeSiteKey, makeTallyKey: makeTallyKey,
  readTallyPub: readTallyPub, seal: seal, open: open, newTrial: newTrial, words: words, b64u: b64u, unb64u: unb64u, WORDS: WORDS, VERSION: 1 };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ExamSeal = api;
})(typeof self !== 'undefined' ? self : this);
