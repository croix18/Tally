/* Tests, the part with no screen (16 Nov 2026): reading the Google Form's responses, matching a typed name to the roster,
   reading a test's record (Windmill practice/exam/DESIGN.md, "3. The record and the code", "The log's shape") into what the
   Tests screens show, and the flags. Pure: no DOM, no storage, no network. A browser script (window.ExamCore, built into
   Tally by build.py beside the vendored exam/seal.js) and a Node module (tests/exam-core.js runs it there).
   The lock itself (open, the code, the four words) is vendor/seal.js, unchanged; this file only calls readCode/findCodes. */
(function (root) {
'use strict';
var SEAL = root.ExamSeal || (typeof require === 'function' ? require('./vendor/seal.js') : null);
var COURSES = { m7: { prep: 'on', name: 'On-level' }, a7: { prep: 'acc', name: 'Accelerated' } };
var LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
var own = function (o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); };
var num = function (v) { return typeof v === 'number' && isFinite(v) ? v : null; };
var str = function (v) { return typeof v === 'string' ? v : null; };
var arr = function (v) { return Array.isArray(v) ? v : []; };

/* ---------------------------------------------------------------- times */
// 41:07, or 1:02:05 past an hour (the test page's own clock face)
function clock(sec) { sec = num(sec); if (sec == null || sec < 0) return ''; sec = Math.round(sec); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0'); }
// 1 min 5 s · 42 s · 1 h 3 min (the test page's "Left the test 2 times · 1 min 5 s")
function dur(sec) { sec = num(sec); if (sec == null || sec < 0) return ''; sec = Math.round(sec); if (sec < 60) return sec + ' s'; var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min' + (s ? ' ' + s + ' s' : ''); }

/* ---------------------------------------------------------------- the response sheet
   What a teacher copies out of the Form's response sheet (tab-separated) or saves from it (CSV): a timestamp, the
   student's name, the code, in any order, with or without the header row, with whatever other questions the form has. */
function rowsOf(text) {
  text = String(text == null ? '' : text).replace(/^﻿/, '');
  var lines = text.split(/\r\n|\r|\n/), tabs = lines.filter(function (l) { return l.indexOf('\t') >= 0; }).length;
  var commas = lines.filter(function (l) { return l.indexOf(',') >= 0; }).length, sep = tabs ? '\t' : commas ? ',' : '\t';
  var out = [], row = [], cell = '', q = false, i = 0, c;
  for (; i < text.length; i++) {
    c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"' && cell === '') { q = true; continue; }
    if (c === sep) { row.push(cell); cell = ''; continue; }
    if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; continue; }
    cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  return out.map(function (r) { return r.map(function (x) { return x.trim(); }); });
}
var DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/;
// a Form timestamp, read in the computer's own time zone: "11/16/2026 10:42:13", "2026-11-16 10:42:13", "11/16/2026 9:05 AM"
function readWhen(t) {
  t = String(t == null ? '' : t).trim(); if (!t) return null; var m = DATE_RE.exec(t), d;
  if (m) { var y = +m[3]; if (y < 100) y += 2000; var h = m[4] == null ? 0 : +m[4]; if (m[7]) { h = h % 12 + (/p/i.test(m[7]) ? 12 : 0); }
    d = new Date(y, +m[1] - 1, +m[2], h, m[5] == null ? 0 : +m[5], m[6] == null ? 0 : +m[6]); }
  else if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t))) d = new Date(+m[1], +m[2] - 1, +m[3], m[4] == null ? 0 : +m[4], m[5] == null ? 0 : +m[5], m[6] == null ? 0 : +m[6]);
  else return null;
  return isNaN(d) ? null : d.getTime();
}
var looksName = function (t) { t = String(t || ''); return /[A-Za-zÀ-ɏ]{2,}/.test(t) && !/@/.test(t) && !/\d{3,}/.test(t) && t.length <= 80; };
/* → {cols: {code, name, at}, rows: [{line, at, when, name, codes, raw}], skipped, header}
   line: the row's number on the sheet (1 = the first line pasted). codes: every code in the code cell (findCodes reads
   spaces, hyphens, lower case, O for 0 and I or L for 1); raw: that cell as typed, kept when no code reads out of it. */
/* An address, from a cell: "a@b.org", "Name <a@b.org>", "mailto:a@b.org" → "a@b.org" (lower case); anything else → "". No
   backtracking: a crafted 50,000-character cell is refused by its length first (review L1). */
function addrOf(c) {
  var t = String(c == null ? '' : c).trim(); if (!t || t.length > 400) return '';
  var lt = t.indexOf('<'), gt = t.lastIndexOf('>'); if (lt >= 0 && gt > lt) t = t.slice(lt + 1, gt).trim();
  t = t.replace(/^mailto:/i, '').toLowerCase(); if (t.length > 254) return '';
  var p = t.split('@'); if (p.length !== 2 || !p[0] || !p[1] || /[\s,;<>]/.test(t) || p[1].indexOf('.') <= 0 || p[1].charAt(p[1].length - 1) === '.') return '';
  return t.slice(0, 120);
}
function isAddr(c) { return !!addrOf(c); }
function readSheet(text, o) {
  var rows = rowsOf(text), lines = rows.map(function (r, i) { return { r: r, line: i + 1 }; }).filter(function (x) { return x.r.some(function (c) { return c !== ''; }); });
  var res = { cols: { code: null, name: null, at: null }, rows: [], skipped: 0, header: null };
  if (!lines.length) return res;
  var n = Math.max.apply(null, lines.map(function (x) { return x.r.length; })), score = [], j, k;
  for (j = 0; j < n; j++) score.push({ code: 0, when: 0, name: 0, head: '' });
  // a cell with an @ in it is never a code: "elindqvist35" reads as one, and so does "Elsa <elindqvist35@…>" (review M1)
  lines.forEach(function (x) { for (j = 0; j < n; j++) { var c = x.r[j] || ''; if (!c) continue; if (c.indexOf('@') >= 0) { c = c.split(/\s+/).filter(function (w) { return w.indexOf('@') < 0; }).join(' '); if (!c) continue; } if (SEAL.findCodes(c).length) score[j].code++; else if (readWhen(c) != null) score[j].when++; else if (looksName(c)) score[j].name++; } });
  var best = function (key, not) { var b = null; for (j = 0; j < n; j++) { if (not.indexOf(j) >= 0) continue; if (score[j][key] > 0 && (b == null || score[j][key] > score[b][key])) b = j; } return b; };
  var code = best('code', []); if (code == null) return res;
  // the header: the first line whose code cell holds no code and whose cells are words, not data
  var first = lines[0], isHead = !SEAL.findCodes(first.r[code] || '').length && first.r.some(function (c) { return /[A-Za-z]/.test(c); }) && readWhen(first.r[0]) == null;
  // with a header row, the code column is never one whose header says name, email, username or account (review N5)
  if (isHead && /name|e-?mail|user\s*name|account/i.test(String(first.r[code] || ''))) { var not = []; for (j = 0; j < n; j++) if (/name|e-?mail|user\s*name|account/i.test(String(first.r[j] || ''))) not.push(j); code = best('code', not); if (code == null) return res; }
  if (isHead) res.header = first.r.slice();
  var hd = function (j) { return isHead ? String(first.r[j] || '') : ''; };
  var at = best('when', [code]);
  var nameCols = []; for (j = 0; j < n; j++) if (j !== code && j !== at && score[j].name && !/e-?mail|user\s*name|account/i.test(hd(j))) nameCols.push(j);
  // the name: a header that is plainly the student's own name ("Your name", "Full name", "Student name", "First and last
  // name") wins over any other header holding "name" ("Partner name (if any)"); two such columns, or none and two columns
  // that could both be names, are a question (alts), asked once when the sheet is pasted
  var bad = /e-?mail|user\s*name|account|teacher|period|class|score|grade|unit|partner|parent|guardian/i;
  var own = nameCols.filter(function (j) { return /\b(your|full|student'?s?|first(\s+and\s+last)?|last)\b[^,]*name|^\s*name\s*$|^\s*student\s*$/i.test(hd(j)) && !bad.test(hd(j)); });
  var named = own.length ? own : nameCols.filter(function (j) { return /name|student|who/i.test(hd(j)) && !bad.test(hd(j)); });
  var name = named.length ? named[0] : null, alts = named.length > 1 ? named.slice() : [];
  if (name == null && nameCols.length) {
    var words = function (j) { return lines.filter(function (x) { return /\S+[\s,]+\S+/.test(x.r[j] || '') && looksName(x.r[j]); }).length; };
    nameCols = nameCols.filter(function (j) { return !bad.test(hd(j)); });
    for (k = 0; k < nameCols.length; k++) if (name == null || words(nameCols[k]) > words(name) || (words(nameCols[k]) === words(name) && score[nameCols[k]].name > score[name].name)) name = nameCols[k];
    if (name != null) { var close = nameCols.filter(function (j) { return j !== name && words(j) >= words(name) * 0.8 && words(j) > 0; }); if (close.length) alts = [name].concat(close); }
  }
  if (o && o.name != null && o.name >= 0 && o.name < n) { name = o.name; alts = []; }
  // the student's school account (16 Nov 2026: the form collects it, Verified): by its header (Email Address, Email,
  // Username, School account), else the column whose cells are addresses; read beside the name, whatever else there is
  // With a header row the account column is taken by its header ONLY, and never one that names someone else ("Parent email",
  // "Partner email (if any)"): review H2. Without one, the column whose cells are addresses.
  // any header that says email / e-mail / username / school or student account, in whatever words ("Your school email",
  // "Email (school)", "What is your school email?"), unless it names someone else (review N6)
  var mail = null, data = lines.length - (isHead ? 1 : 0), ACCT = /e-?mail|user\s*name|\baccount\b/i, OTHER = /parent|guardian|\bmom\b|\bdad\b|mother|father|partner|friend|teacher/i;
  if (isHead) { for (j = 0; j < n && mail == null; j++) if (j !== code && j !== at && j !== name && ACCT.test(hd(j)) && !OTHER.test(hd(j))) mail = j; }
  else { var am = []; for (j = 0; j < n; j++) if (j !== code && j !== at && j !== name && lines.filter(function (x) { return isAddr(x.r[j]); }).length >= Math.max(1, data * 0.6)) am.push(j);
    if (am.length === 1) mail = am[0]; else if (am.length > 1) res.acctTwo = true; }   // two address columns and no header: no guess
  res.google = isHead && mail != null && /^\s*email address\s*$/i.test(hd(mail));   // Google's own column, collected Verified when the form says so
  res.alts = alts; res.email = mail;
  res.cols = { code: code, name: name, at: at, email: mail };
  lines.forEach(function (x, i) {
    if (i === 0 && isHead) return;
    var cell = x.r[code] || '', codes = SEAL.findCodes(cell), nm = name == null ? '' : (x.r[name] || ''), w = at == null ? '' : (x.r[at] || ''), ad = mail == null ? '' : addrOf(x.r[mail]);
    if (!codes.length && !cell && !nm && !ad) { res.skipped++; return; }
    if (cell.indexOf('@') >= 0) { var bare = cell.split(/\s+/).filter(function (w) { return w.indexOf('@') < 0; }).join(' '); codes = SEAL.findCodes(bare); }   // an address typed in the code cell is never a code; a real code beside it is (review N5)
    else if (!codes.length && SEAL.readCode(cell)) codes = [SEAL.readCode(cell)];
    res.rows.push({ line: x.line, at: w, when: readWhen(w), name: nm, codes: codes, raw: codes.length ? '' : clip(cell, 60), addr: ad });
  });
  return res;
}

/* ---------------------------------------------------------------- names
   A name as the student typed it (or chose it from a list) against the roster's "Last, First Middle". Exact: every word
   typed is a word of the student's name, and the first and last names are both there (in either order; a middle name may
   be left out). Forgiving: one slip in the first or last name, a nickname that starts the same, a last initial. Only an
   exact match to one student, or a forgiving match to one student and nobody close behind, is taken without asking;
   anything else is a question for the teacher, with the likely students first. */
var SUFFIX = /^(jr|sr|ii|iii|iv|v)$/;
function words(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z\s,]/g, function (c) { return c === "'" || c === '’' ? '' : ' '; }); }
function tokens(s) { return words(s).replace(/,/g, ' ').split(/\s+/).filter(Boolean).filter(function (t) { return !SUFFIX.test(t); }); }
function partsOf(display) {
  var w = words(display), c = w.indexOf(','), first, last;
  if (c >= 0) { last = w.slice(0, c).split(/\s+/).filter(Boolean); first = w.slice(c + 1).split(/\s+/).filter(Boolean); }
  else { var t = w.split(/\s+/).filter(Boolean); last = t.slice(-1); first = t.slice(0, -1); }
  first = first.filter(function (t) { return !SUFFIX.test(t); }); last = last.filter(function (t) { return !SUFFIX.test(t); });
  return { first: first[0] || '', middle: first.slice(1), last: last, all: first.concat(last) };
}
function edit(a, b) {
  if (a === b) return 0; if (Math.abs(a.length - b.length) > 2) return 3;
  var p = [], i, j; for (j = 0; j <= b.length; j++) p[j] = j;
  for (i = 1; i <= a.length; i++) { var q = [i]; for (j = 1; j <= b.length; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = q; }
  return p[b.length];
}
function like(t, w) {   // how alike one typed word is to one word of the name: 1 the same … 0 nothing
  if (!t || !w) return 0; if (t === w) return 1;
  if (t.length === 1) return w[0] === t ? 0.6 : 0;
  var d = edit(t, w); if (d === 1 && Math.min(t.length, w.length) >= 4) return 0.85; if (d === 2 && Math.min(t.length, w.length) >= 7) return 0.7;
  if (t.length >= 3 && w.length >= 3 && (w.indexOf(t) === 0 || t.indexOf(w) === 0)) return 0.75;   // Alex · Alexander, Kate · Katelyn
  return 0;
}
/* roster: [{display}, …] → {pick, how, suggest, cands, rivals}
   A name is taken without asking (pick, how 'exact') only when it is EXACT AND UNRIVALED (Croix's rule after the review,
   16 Nov 2026: "a score may land on a child only when it is certainly theirs"): the typed words are one roster student's first
   and last name (any order, case, accents, punctuation; a middle name may be left out) and no other student in any class is a
   near match for the same words: the same last name with a first name that starts the same, a nickname or one slip. "Jon
   Smith" with Smith, Jon and Smith, Jonathan on the rosters asks. Anything forgiving is a SUGGESTION (suggest), never a pick.
   cands: every student it could be, the likeliest first. o.noPick: the typed name is not one to take (an email's local part). */
/* NICKNAMES: names one child may go by. Each line is one group: two first names on the same line are "related", so a
   student typing one of them could be a student whose roster name is another. Croix: add a line, or a name to a line, and
   matching asks about those names from then on (lower case, no accents; a name may be on more than one line). */
var NICKNAMES = [
  'bob bobby rob robbie robert', 'bill billy will willy liam william', 'liz lizzie beth betty eliza elizabeth',
  'kate katie kathy katherine catherine', 'mike mikey michael miguel', 'alex alejandro alejandra alexander alexandra alexis',
  'chris christopher christian cristian christina', 'nick nicky nicholas nicolas', 'joe joey jose joseph', 'tony anthony antonio',
  'pepe jose', 'paco pancho francisco frank frankie', 'lupe guadalupe', 'chuy jesus', 'nacho ignacio', 'manny manuel emmanuel',
  'sam sammy samuel samantha', 'ben benny benjamin', 'dan danny daniel', 'matt matthew mateo', 'tom tommy thomas tomas',
  'jim jimmy jamie james', 'jack jackson john johnny', 'andy drew andrew andres', 'abby abigail', 'maddie madison madeline',
  'izzy bella isabel isabella', 'gabby gabi gabriela gabriella gabriel', 'vicky victoria', 'nate nathan nathaniel',
  'zach zack zachary', 'josh joshua', 'jake jacob', 'charlie chuck charles carlos', 'eddie ed edward eduardo',
  'ricky rick richard ricardo', 'teddy ted theodore', 'leo leonardo leonard', 'max maxwell maximilian maximo',
  'ellie ella eleanor elena', 'addie addison adeline', 'lexi alexa alexis', 'cami camila camille', 'sofi sophie sofia sophia',
  'mia maria', 'ana anna annie anne',
  'sean shawn shaun', 'henry hank harry', 'ty tyler', 'dick rick ricky richard', 'peggy maggie meg margaret margarita',
  'ted ed eddie edward', 'pat patty patricia patrick', 'steve steven stephen esteban', 'greg gregory', 'jeff jeffrey geoff',
  'cathy kathy cat kat', 'jen jenny jennifer', 'jess jessie jessica', 'becca becky rebecca', 'tori victoria', 'trey tre', 'xander alexander', 'sasha alexandra alexander'
];
var NICK = {}; NICKNAMES.forEach(function (line, g) { line.split(/\s+/).forEach(function (n) { (NICK[n] = NICK[n] || []).push(g); }); });
function nick(a, b) { var A = NICK[a], B = NICK[b]; return !!(A && B && A.some(function (g) { return B.indexOf(g) >= 0; })); }
// edits between two words, a swap of two neighboring letters counting as one (Kahn/Khan, Elias/Elisa)
function osa(a, b) {
  if (a === b) return 0; if (Math.abs(a.length - b.length) > 2) return 3;
  var d = [], i, j; for (i = 0; i <= a.length; i++) { d[i] = [i]; } for (j = 0; j <= b.length; j++) d[0][j] = j;
  for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
    var c = a[i - 1] === b[j - 1] ? 0 : 1; d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
// a first name a student could have typed for another's: one starts the other (3+ letters), two edits or fewer, or nicknames
// (third review, R3-M1: also any two first names that begin with the same letter: Sean/Shawn, Henry/Hank, Tyler/Ty)
function relFirst(t, f) { if (!t || !f) return false; if (t === f || t[0] === f[0]) return true; if (t.length >= 3 && f.length >= 3 && (f.indexOf(t) === 0 || t.indexOf(f) === 0)) return true; var n = Math.min(t.length, f.length); return n >= 2 && osa(t, f) <= (n >= 5 ? 2 : 1) || nick(t, f); }
// a last name that is the same or near: equal with spaces, hyphens, apostrophes, case and accents gone, or one edit apart
function relLast(a, b) { if (!a || !b) return false; if (a === b) return true; return Math.min(a.length, b.length) >= 3 && osa(a, b) <= 1; }
// near (for the likely students offered when nothing is exact): every typed word is tried against the first name here, so it
// stays strict; rival() splits the typed words into first and last before it compares (R3-M1)
function nearFirst(t, f) { if (!t || !f) return false; if (t === f) return true; if (t.length >= 3 && f.length >= 3 && (f.indexOf(t) === 0 || t.indexOf(f) === 0)) return true; return Math.min(t.length, f.length) >= 3 && osa(t, f) <= 1 || nick(t, f); }
function nearLast(t, L) { return L.some(function (l) { return relLast(t, l); }); }
/* A RIVAL of the student X a typed name exactly matches (Croix, 16 Nov 2026, R2-H1): another student, in any class, whose last
   name is the same or near X's (as a whole, run together: Van Dyke/Vandyke; or word by word: Lea/Lee, Kahn/Khan) and whose
   first name is related to the first name typed (above). With a rival Tally asks. */
function rival(T, X, Y) {
  var lastT = T.filter(function (t) { return X.last.indexOf(t) >= 0; }), firstT = T.filter(function (t) { return X.last.indexOf(t) < 0; });
  var lastNear = relLast(X.last.join(''), Y.last.join('')) || lastT.some(function (t) { return Y.last.some(function (l) { return relLast(t, l); }); });
  if (!lastNear) return false;
  return firstT.some(function (t) { return relFirst(t, Y.first) || Y.middle.some(function (m) { return m === t; }); });
}
function matchName(typed, roster, o) {
  var T = tokens(typed), out = { pick: null, how: null, suggest: null, cands: [], rivals: [] };
  if (!T.length) return out;
  var parts = roster.map(function (r) { return partsOf(r.display); });
  var scored = roster.map(function (r, i) {
    var P = parts[i], set = P.all;
    var exact = !!P.first && P.last.length > 0 && T.every(function (t) { return set.indexOf(t) >= 0; }) && T.indexOf(P.first) >= 0 && P.last.some(function (l) { return T.indexOf(l) >= 0; });
    var f = 0, l = 0, extra = 0;
    T.forEach(function (t) { var a = like(t, P.first), b = Math.max.apply(null, P.last.map(function (x) { return like(t, x); }).concat([0])), m = Math.max.apply(null, P.middle.map(function (x) { return like(t, x); }).concat([0]));
      if (a >= b && a > 0) f = Math.max(f, a); else if (b > 0) l = Math.max(l, b); else if (!m) extra++; });
    // near: some typed word is (nearly) the last name and another (nearly) the first: a child the same words could mean
    var near = (T.some(function (t) { return nearLast(t, P.last); }) && T.some(function (t) { return nearFirst(t, P.first); })) || (T.length >= 2 && T.every(function (t) { return set.indexOf(t) >= 0; }));   // or every word typed is in their name (a first and middle name)
    return { i: i, exact: exact, near: near, s: f + l - extra * 0.5 + (exact ? 1 : 0), f: f, l: l };
  });
  var ex = scored.filter(function (x) { return x.exact; });
  var c = scored.filter(function (x) { return x.exact || x.near || (x.s >= 0.75 && (x.f > 0 || x.l > 0)); }).sort(function (a, b) { return b.s - a.s; });
  out.cands = c.slice(0, 8).map(function (x) { return x.i; });
  if (ex.length === 1) {
    var X = parts[ex[0].i];
    out.rivals = scored.filter(function (x) { return x.i !== ex[0].i && (x.near || x.exact || rival(T, X, parts[x.i])); }).map(function (x) { return x.i; });
    out.rivals.forEach(function (i) { if (out.cands.indexOf(i) < 0) out.cands.push(i); });
    if (!out.rivals.length && !(o && o.noPick)) { out.pick = ex[0].i; out.how = 'exact'; }
    else out.suggest = ex[0].i;
    return out;
  }
  if (ex.length > 1) { out.rivals = ex.map(function (x) { return x.i; }); return out; }
  // a forgiving reading: suggested when it is the one close student and nobody is near it
  if (c.length && c[0].f >= 0.75 && c[0].l >= 0.6 && c[0].s >= 1.55 && (c.length === 1 || c[1].s < c[0].s - 0.5)) out.suggest = c[0].i;
  return out;
}
/* ---------------------------------------------------------------- school accounts (16 Nov 2026)
   Croix: "It's their name but also sometimes abbreviated and mixed." The part of an address before the @ is read into who it
   could be: jsmith12, smithj, john.s, j.smith, josmi4821, johnsmith, first.last. Digits go; dots, underscores and hyphens split
   it into pieces; each piece must be the start of a first or last name (one piece may be split in two: an initial and a
   name, or the first letters of each). → acctFit(local, display): 0 when it can't be them, else a score (letters matched,
   more when a whole name is spelled out). acctCands(addr, roster): every student it could be, the likeliest first. It only
   ranks and narrows: a student is never placed by how an address reads, only by an account Tally has learned. */
function acctLocal(addr) { var a = String(addr || '').toLowerCase(); var l = a.indexOf('@') >= 0 ? a.slice(0, a.indexOf('@')) : a; return l.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '').replace(/\d+/g, ' ').split(/[^a-z]+/).filter(Boolean); }
function acctFit(local, display) {
  var T = Array.isArray(local) ? local : acctLocal(local), P = partsOf(display); if (!T.length || !P.first || !P.last.length) return 0;
  var F = P.first, L = P.last.join(''), Ls = P.last.concat(P.last.length > 1 ? [L] : []), Fs = [F].concat(P.middle);
  var pre = function (t, w) { return !!t && !!w && w.indexOf(t) === 0; };
  var lastPre = function (t) { return Ls.some(function (l) { return pre(t, l); }); }, firstPre = function (t) { return Fs.some(function (f) { return pre(t, f); }); };
  var whole = function (t) { return Fs.indexOf(t) >= 0 || Ls.indexOf(t) >= 0 ? 2 : 0; };
  var best = 0, sc;
  if (T.length >= 2) {
    var a = T[0], b = T[T.length - 1];
    if ((firstPre(a) && lastPre(b)) || (lastPre(a) && firstPre(b))) { sc = a.length + b.length + whole(a) + whole(b); if (a.length + b.length >= 3) best = Math.max(best, sc); }
    return best;
  }
  var t = T[0];
  for (var k = 1; k < t.length; k++) { var x = t.slice(0, k), y = t.slice(k);
    if ((firstPre(x) && lastPre(y)) || (lastPre(x) && firstPre(y))) { sc = t.length + whole(x) + whole(y) + (Math.min(x.length, y.length) >= 2 ? 1 : 0); best = Math.max(best, sc); } }
  if (!best && t.length >= 4 && (lastPre(t) || firstPre(t))) best = 1;   // a name alone ("smith12"): it could be them, barely
  return best;
}
function acctRank(addr, roster) { var T = acctLocal(addr); if (!T.length) return []; return roster.map(function (r, i) { return { i: i, s: acctFit(T, r.display) }; }).filter(function (x) { return x.s > 0; }).sort(function (p, q) { return q.s - p.s; }); }
// the one student an address reads as best, alone; null when it reads as nobody or as two or more equally (review L2)
function acctReads(addr, roster) { var R = acctRank(addr, roster); return R.length && (R.length === 1 || R[0].s > R[1].s) ? R[0].i : null; }
// may an account be learned for the student a certain name picks? Only when the address reads as nobody, or as that student
// first and alone, or as that student among equals (reviews C2, N7): never when it reads better as someone else
function acctAgrees(addr, roster, pick) { var R = acctRank(addr, roster); if (!R.length) return true; return R.some(function (x) { return x.i === pick && x.s === R[0].s; }); }
function acctCands(addr, roster) {
  var T = acctLocal(addr); if (!T.length) return [];
  return roster.map(function (r, i) { return { i: i, s: acctFit(T, r.display) }; }).filter(function (x) { return x.s > 0; }).sort(function (p, q) { return q.s - p.s; }).map(function (x) { return x.i; });
}
/* HOW STRONGLY A TYPED NAME POINTS AT A STUDENT (the second review of school accounts, 17 Nov 2026), one order for everything
   an account is weighed against: 5 the exact full name · 4 a near name (each part exact or one slip) · 3 a nickname or a
   prefix of the first name with the last name · 2 the first (or last) name alone, exactly · 1 a part of it, a prefix or a
   look-alike · 0 nothing. A first name that is exactly a student's outranks one that only starts it or looks like it. */
function nameStrength(typed, display) {
  var T = tokens(typed), P = partsOf(display); if (!T.length || !P.first || !P.last.length) return 0;
  var F = [P.first].concat(P.middle), L = P.last.concat(P.last.length > 1 ? [P.last.join('')] : []), all = F.concat(L);
  if (T.length >= 2 && T.every(function (t) { return all.indexOf(t) >= 0; }) && T.indexOf(P.first) >= 0 && P.last.some(function (l) { return T.indexOf(l) >= 0; })) return 5;
  var fr = function (t) { return F.indexOf(t) >= 0 ? 3 : F.some(function (f) { return Math.min(f.length, t.length) >= 3 && osa(t, f) <= 1; }) ? 2 : F.some(function (f) { return nick(t, f) || (t.length >= 2 && f.indexOf(t) === 0); }) ? 1 : 0; };
  var lr = function (t) { return L.indexOf(t) >= 0 ? 3 : L.some(function (l) { return Math.min(l.length, t.length) >= 3 && osa(t, l) <= 1; }) ? 2 : L.some(function (l) { return t.length >= 3 && l.indexOf(t) === 0; }) ? 1 : 0; };
  if (T.length === 1) { var t = T[0]; return F.indexOf(t) >= 0 || L.indexOf(t) >= 0 ? 2 : fr(t) || lr(t) ? 1 : 0; }
  var best = 0;
  for (var i = 0; i < T.length; i++) for (var j = 0; j < T.length; j++) { if (i === j) continue; var a = fr(T[i]), b = lr(T[j]); if (!a || !b) continue;
    best = Math.max(best, a >= 2 && b >= 2 ? 4 : 3); }
  if (best) return best;
  return T.some(function (t) { return fr(t) || lr(t); }) ? 1 : 0;
}
var nameKey = function (t) { return tokens(t).sort().join(' '); };

/* ---------------------------------------------------------------- the record
   Every field is read as the design pins it and nothing else is trusted to have its shape: the record opened and its
   signature held, but a field the page could not fill is null, and an older page's log may be shaped differently. */
var qOf = function (id) { var s = String(id == null ? '' : id); return s.replace(/[a-z]+$/i, '') || s; };
// what a student typed is shown as text and never at any length: past 300 characters it is cut, and says so
function clip(s, n) { s = String(s); n = n || 300; return s.length > n ? s.slice(0, n) + '… (' + (s.length - n) + ' more characters)' : s; }
function answerText(type, a) { try { return clip(answerRaw(type, a)); } catch (e) { return '(unreadable)'; } }
function answerRaw(type, a) {
  if (a == null) return '';
  if (type === 'mc' && (typeof a === 'number' || (typeof a === 'string' && /^\d+$/.test(a)))) return LET[+a] || String(a);
  if (type === 'multi' && Array.isArray(a)) return a.slice(0, 40).map(function (k) { return LET[+k] || String(k); }).join(', ');
  if (type === 'nline' || (a && typeof a === 'object' && !Array.isArray(a) && ('c' in a || 'dir' in a || 'closed' in a))) {
    if (!a || typeof a !== 'object') return String(a);
    var bits = []; if (a.c != null && a.c !== '') bits.push(String(a.c).replace(/^-/, '−')); if (a.closed != null) bits.push(a.closed ? 'closed dot' : 'open dot'); if (a.dir === 'left' || a.dir === 'right') bits.push('arrow ' + (a.dir === 'left' ? '←' : '→'));
    return bits.join(' · ');
  }
  if (type === 'cgraph' || (Array.isArray(a) && a.length && a[0] && typeof a[0] === 'object') || (a && Array.isArray(a.graph))) {
    var g = Array.isArray(a) ? a : a && Array.isArray(a.graph) ? a.graph : [];
    return g.map(function (s) { return (s && s.name != null ? String(s.name) : 'unnamed') + ' ' + (s ? Math.round(+s.deg) : 0) + '°'; }).join(' · ');
  }
  if (Array.isArray(a)) return a.map(function (x) { return x == null || x === '' ? '_' : String(x); }).join('  ·  ');
  if (typeof a === 'object') return JSON.stringify(a);
  return String(a);
}
// the key as the record carries it: the letter of a choice, "A,C", "nline:3|closed|right", "cgraph:Dogs=90|Cats=270", or text
function keyText(k) { try { return clip(keyRaw(k)); } catch (e) { return '(unreadable)'; } }
function keyRaw(k) {
  if (k == null) return '';
  if (typeof k === 'object' && !Array.isArray(k)) return JSON.stringify(k);
  if (Array.isArray(k)) return k.map(String).join('  ·  ');
  var s = String(k), m;
  if ((m = /^nline:([^|]*)\|(open|closed)\|(left|right)$/.exec(s))) return answerText('nline', { c: m[1], closed: m[2] === 'closed', dir: m[3] });
  if (/^cgraph:/.test(s)) return s.slice(7).split('|').filter(Boolean).map(function (x) { var e = x.lastIndexOf('='); return e > 0 ? x.slice(0, e) + ' ' + x.slice(e + 1) + '°' : x; }).join(' · ');
  if (/^[A-Z](,[A-Z])+$/.test(s)) return s.split(',').join(', ');
  return s;
}
var VERDICTS = ['right', 'wrong', 'blank', 'unread'];
/* → the record as the screens read it (never the record itself changed) */
function readRecord(r) {
  r = r && typeof r === 'object' ? r : {};
  var site = r.site && typeof r.site === 'object' ? r.site : {}, log = r.log && typeof r.log === 'object' && !Array.isArray(r.log) ? r.log : null;
  var started = num(site.started), finished = num(site.finished);
  var parts = arr(r.parts).filter(function (p) { return p && typeof p === 'object'; }).map(function (p) {
    var v = VERDICTS.indexOf(p.v) >= 0 ? p.v : 'unread', lp = log && log.parts && typeof log.parts === 'object' && own(log.parts, String(p.id)) ? log.parts[String(p.id)] : null;
    return { id: String(p.id == null ? '' : p.id), q: qOf(p.id), type: str(p.type) || 'text', typed: own(p, 'typed') ? p.typed : null, v: v, almost: !!p.almost, key: own(p, 'key') ? p.key : null,
      vals: lp && Array.isArray(lp.vals) ? lp.vals.filter(Array.isArray).slice(0, 12) : [], n: lp ? num(lp.n) : null, pastes: lp ? num(lp.pastes) : null };
  });
  var qs = [], byQ = {};
  parts.forEach(function (p) { if (!byQ[p.q]) { byQ[p.q] = { q: p.q, parts: [] }; qs.push(byQ[p.q]); } byQ[p.q].parts.push(p); });
  var lq = log && log.q && typeof log.q === 'object' ? log.q : {};
  qs.forEach(function (q) { var e = own(lq, q.q) && lq[q.q] && typeof lq[q.q] === 'object' ? lq[q.q] : null;
    q.sec = e ? num(e.sec) : null; q.visits = e ? num(e.visits) : null; q.first = e ? num(e.first) : null; q.flag = e ? !!e.flag : null; q.flagEnd = e ? !!e.flagEnd : null;
    var vs = q.parts.map(function (p) { return p.v; }); q.v = vs.every(function (v) { return v === 'right'; }) ? 'right' : vs.every(function (v) { return v === 'blank'; }) ? 'blank' : vs.some(function (v) { return v === 'right'; }) ? 'some' : vs.indexOf('wrong') >= 0 ? 'wrong' : vs[0];
    q.almost = q.parts.some(function (p) { return p.almost; }); });
  // the device's lists, each entry kept only in its pinned shape
  // each list at the design's caps (300 visits, 100 of each other), whatever the record holds: the rest is counted as dropped
  var over = {}, CAP = { visits: 300, calc: 100, away: 100, blocked: 100, idle: 100, scratch: 100 };
  var list = function (k, shape) { if (!log || !Array.isArray(log[k])) return []; var l = log[k].filter(function (e) { return Array.isArray(e) && shape(e); }); if (l.length > CAP[k]) { over[k] = l.length - CAP[k]; l = l.slice(0, CAP[k]); } return l; };
  // the site's own rule (CHANGES-16NOV §6): [at, sec, kind, q] with 0 ≤ sec ≤ 86400; the count and the sum then agree with its clear summary
  var away = list('away', function (e) { return num(e[0]) != null && num(e[1]) != null && e[1] >= 0 && e[1] <= 86400; }).map(function (e) { return { at: e[0], sec: e[1], kind: str(e[2]) || '', q: e[3] == null ? '' : String(e[3]) }; });
  var visits = list('visits', function (e) { return num(e[1]) != null && num(e[2]) != null; }).map(function (e) { return { q: String(e[0]), at: e[1], sec: e[2] }; });
  var calc = list('calc', function (e) { return num(e[2]) != null && num(e[3]) != null; }).map(function (e) { return { which: str(e[0]) || '', q: e[1] == null ? '' : String(e[1]), at: e[2], sec: e[3] }; });
  var sc = log && log.scratch && typeof log.scratch === 'object' ? log.scratch : {};
  var scratch = Array.isArray(sc.opens) ? sc.opens.filter(function (e) { return Array.isArray(e) && num(e[2]) != null && num(e[3]) != null; }).filter(function (e, i, l) { if (i === 100) over.scratch = l.length - 100; return i < 100; }).map(function (e) { return { tab: e[0] === 'grid' ? 'grid' : 'notes', q: e[1] == null ? '' : String(e[1]), at: e[2], sec: e[3] }; }) : [];
  var paper = []; if (sc.end && typeof sc.end === 'object') Object.keys(sc.end).slice(0, 60).forEach(function (q) { var e = sc.end[q]; if (!e || typeof e !== 'object') return; var g = e.g && typeof e.g === 'object' ? e.g : null;
    var o = g && Array.isArray(g.o) ? g.o.filter(function (t) { return Array.isArray(t) && (t[0] === 'p' ? t.length === 3 : (t[0] === 's' || t[0] === 'l') && t.length === 5) && t.slice(1).every(function (v) { return num(v) != null && v >= -1 && v <= 21; }); }).slice(0, 400) : [];
    var notes = typeof e.n === 'string' ? clip(e.n, 4096) : ''; if (!notes.trim() && !o.length) return;
    paper.push({ q: q, notes: notes, grid: o.length ? { four: !(g.v && g.v[0] === 1), scale: g.v && num(g.v[1]) ? g.v[1] : 1, o: o } : null }); });
  paper.sort(function (a, b) { return (parseFloat(a.q) || 0) - (parseFloat(b.q) || 0) || String(a.q).localeCompare(String(b.q)); });
  var blocked = list('blocked', function (e) { return num(e[0]) != null; }).map(function (e) { return { at: e[0], what: clip(str(e[1]) || '', 30), q: e[2] == null ? '' : String(e[2]) }; });
  var idle = list('idle', function (e) { return num(e[0]) != null && num(e[1]) != null; }).map(function (e) { return { at: e[0], sec: e[1], q: e[2] == null ? '' : String(e[2]) }; });
  var dev0 = log && log.device && typeof log.device === 'object' ? log.device : null, dev = null;
  if (dev0) { dev = {}; ['sw', 'sh', 'ww', 'wh', 'dpr', 'zoom'].forEach(function (k) { dev[k] = num(dev0[k]); }); ['touch', 'dark', 'large'].forEach(function (k) { dev[k] = typeof dev0[k] === 'boolean' ? dev0[k] : null; }); ['os', 'osv', 'br', 'brv', 'tz'].forEach(function (k) { dev[k] = dev0[k] == null ? null : clip(String(dev0[k]), 60); }); }
  var drop = log && log.drop && typeof log.drop === 'object' ? log.drop : {};
  var t0 = log ? num(log.t0) : null, t1 = log ? num(log.t1) : null;
  var sum = function (l) { return l.reduce(function (a, e) { return a + (e.sec || 0); }, 0); };
  return {
    code: str(r.code) || '', id: str(r.id) || '', trial: r.trial === true, course: str(r.course) || '', unit: num(r.unit), cv: r.cv, kit: str(r.kit), seed: str(r.seed),
    scope: typeof r.scope === 'string' && /^[a-z0-9][a-z0-9.+\-]{0,39}$/i.test(r.scope) ? r.scope : '', scopeName: typeof r.scope === 'string' && r.scope && typeof r.scopeName === 'string' ? clip(r.scopeName, 120) : '',
    started: started, finished: finished, seconds: started != null && finished != null && finished >= started ? Math.round((finished - started) / 1000) : null,
    saves: num(site.saves), timeline: arr(site.timeline).filter(function (e) { return Array.isArray(e) && num(e[0]) != null; }).slice(0, 1500).map(function (e) { return { at: e[0], part: e[1] == null ? '' : String(e[1]) }; }),
    rule: r.rule && typeof r.rule === 'object' ? { leave: str(r.rule.leave) || 'count', after: num(r.rule.after) } : null, ended: r.ended === 'left' || r.ended === 'teacher' || r.ended === 'time' ? r.ended : null, limit: num(site.limit), unlocks: num(r.unlocks),
    points: num(r.points), of: num(r.of), parts: parts, questions: qs,
    log: log ? { t0: t0, t1: t1, deviceSeconds: t0 != null && t1 != null && t1 >= t0 ? Math.round((t1 - t0) / 1000) : null, fails: num(log.fails), shaped: own(log, 'v') && Array.isArray(log.visits) } : null,
    opened: num(site.opened),
    visits: visits, away: away, awaySec: started != null && finished != null && finished >= started ? Math.min(sum(away), Math.round((finished - started) / 1000)) : sum(away), calc: calc, scratch: scratch, paper: paper, cut: !!sc.cut, blocked: blocked, idle: idle, idleSec: sum(idle),
    device: dev, drop: { visits: (num(drop.visits) || 0) + (over.visits || 0), calc: (num(drop.calc) || 0) + (over.calc || 0), scratch: (num(drop.scratch) || 0) + (over.scratch || 0), away: (num(drop.away) || 0) + (over.away || 0), blocked: (num(drop.blocked) || 0) + (over.blocked || 0), idle: (num(drop.idle) || 0) + (over.idle || 0) }
  };
}
/* ---------------------------------------------------------------- see the test (16 Nov 2026, Croix: "show me the exact questions")
   The unit's teacher copy on the site redraws the student's exact test from its seed, proves it is the same test by its keys,
   and shows each question with the answer, the verdict and the key:  <site>/teacher/<course>/unit-<N>/practice/#test=<payload>
   payload = base64url(UTF-8 JSON) of {v: 1, course, unit, seed, cv, kit, code, points, of, parts: [[id, answer, result, key], …]}
   in the record's own part order. answer: what Tally shows in its Answer column ("" when blank); result: "almost", else the
   verdict when right / wrong / blank, else "unread"; key: the record's RAW key, exactly (the teacher copy compares it with its
   own redraw character for character). No name, class or roster id: only what the record holds about the test itself.
   teacherPayload(record) → the object; teacherLink(site, record) → the href. The fragment never reaches the site. */
function b64u(s) {
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  var bytes = new TextEncoder().encode(s), bin = ''; for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function teacherPayload(rec) {
  var v = readRecord(rec);
  var head = { v: 1, course: v.course, unit: v.unit, seed: v.seed }; if (v.scope) head.scope = v.scope;   // a lesson test's scope; a unit test's payload stays exactly as it was
  return Object.assign(head, { cv: v.cv === undefined ? null : v.cv, kit: v.kit, code: v.code, points: v.points, of: v.of,
    parts: v.parts.map(function (p) { return [p.id, p.typed == null ? '' : answerText(p.type, p.typed), p.almost ? 'almost' : ['right', 'wrong', 'blank'].indexOf(p.v) >= 0 ? p.v : 'unread', p.key]; }) });
}
function teacherLink(site, rec) {
  var P = teacherPayload(rec); return String(site || '').replace(/\/+$/, '') + '/teacher/' + encodeURIComponent(String(P.course).toLowerCase()) + '/unit-' + encodeURIComponent(String(P.unit)) + '/practice/#test=' + b64u(JSON.stringify(P));
}
var courseName = function (c) { return COURSES[c] ? COURSES[c].name : String(c || '').toUpperCase(); };
/* LESSON TESTS (16 Nov 2026, Croix: "so I can test on a specific unit or lesson"). A lesson test's record is a unit test's plus
   scope (the practice page's id: "lesson-10.03", a two-lesson day "lesson-10.09+10", a thread day "lesson-t-a1") and scopeName
   ("Lesson 10.03 · Writing inequalities"). The test is course + unit + scope: a unit test (no scope) and a lesson test of the
   same unit never mix. testKey keeps a unit test's key exactly as it was ("m7/10"); a lesson test's is "m7/10#lesson-10.03".
   testName: short, for lists ("On-level Unit 10 · Lesson 10.03"); testFull: with the lesson's own name, for its page. */
var scopeShort = function (scope, scopeName) { if (!scope) return ''; var n = String(scopeName || '').split(' · ')[0].trim(); if (n) return n.slice(0, 40);
  var m = /^lesson-(t-)?(.+)$/.exec(scope); return m ? (m[1] ? 'Thread ' + m[2].toUpperCase() : 'Lesson ' + m[2]) : String(scope).slice(0, 40); };
var testName = function (course, unit, scope, scopeName) { return courseName(course) + ' Unit ' + (unit == null ? '?' : unit) + (scope ? ' · ' + scopeShort(scope, scopeName) : ''); };
var testFull = function (course, unit, scope, scopeName) { return courseName(course) + ' Unit ' + (unit == null ? '?' : unit) + (scope ? ' · ' + (String(scopeName || '').trim() || scopeShort(scope)) : ''); };
var testKey = function (course, unit, scope) { return String(course || '') + '/' + (unit == null ? '' : unit) + (scope ? '#' + scope : ''); };
var sameTest = function (a, b) { return !!a && !!b && a.course === b.course && a.unit === b.unit && (a.scope || '') === (b.scope || ''); };

/* ---------------------------------------------------------------- what does not add up
   Pure on purpose: the screens hand in what Tally holds and get back every flag with what is wrong and what to do.
   claims: [{code, name, when, line, who: {k, n} | null}]  (each response row and the student it was matched to)
   held:   {code: {course, unit, finished, ended, sec, who}}  (records that opened, wherever they are kept)
   fails:  {code: why}  ('none' | 'format' | 'key' | 'signature' | 'code' | 'net')
   period: {from: 'HH:MM', to: 'HH:MM'} or null (the class period, when Tally knows it)                                     */
function minutes(hhmm) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '')); return m ? +m[1] * 60 + +m[2] : null; }
function outsidePeriod(finished, period, tz) {
  if (finished == null || !period) return false; var a = minutes(period.from), b = minutes(period.to); if (a == null || b == null || b <= a) return false;
  var d = new Date(finished), m = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; return m < a - 1 || m > b + 1;   // a minute's grace on both sides of the bell
}
function distance(a, b) { if (!a || !b || a.length !== b.length) return 99; var n = 0; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; }
// a code nobody's record answers to, and a code on the site that nobody turned in one or two characters away: likely a typo
function nearCodes(code, pool) { return pool.filter(function (c) { return c !== code && distance(c, code) <= 2; }).sort(function (x, y) { return distance(x, code) - distance(y, code); }); }

/* Where each record belongs (Croix after the review: "nothing placed is ever lost"; "a score may land on a child only when it
   is certainly theirs"). The record's own entry holds its student (who: {sec, n, how}); the response rows only ever ADD a
   placement, never take one away by being dropped.
     rows:    [{codes, name, who: {sec, n} | null}]   (who: the row's student when it was certain: exact and unrivaled,
              remembered and still the only reading, or the teacher's answer)
     entries: [{code, who: {sec, n, how} | null, pin (older name for who with how 'you'), no: [{sec, n}] (not theirs)}]
   → {place: {code: {sec, n} | null}, state: {code: 'placed' | 'waiting' | 'shared' | 'nobody'}, shared: {code: rows},
      waiting: {code: rows}}
   A row whose words are all in the name of another row's student, with the same code, is that same child sending the form
   twice. A record placed by the teacher stays where he put it. Any other record whose rows now name two children, or a child
   and someone Tally can't name, waits for him. */
function sameChild(r, w) { var T = tokens(r.name), N = tokens(w.n); return T.length > 0 && T.every(function (t) { return N.indexOf(t) >= 0; }); }
function placeAll(rows, recs) {
  var by = {}, place = {}, state = {}, shared = {}, waiting = {};
  rows.forEach(function (r) { (r.codes || (r.code ? [r.code] : [])).forEach(function (c) { if (c) (by[c] = by[c] || []).push(r); }); });
  recs.forEach(function (x) {
    if (x.nobody && !(x.who && x.who.how === 'you')) { place[x.code] = null; state[x.code] = 'nobody'; return; }   // he said: nobody yet
    if (x.gone && !x.who) { place[x.code] = null; state[x.code] = 'nobody'; return; }   // its student left the roster: nobody's, until he gives it (R2-C1)
    var mine = x.who || (x.pin ? { sec: x.pin.sec, n: x.pin.n, how: 'you' } : null), no = x.no || [];
    var not = function (w) { return no.some(function (q) { return q.sec === w.sec && q.n === w.n; }); };
    if (mine && mine.how === 'you') { place[x.code] = { sec: mine.sec, n: mine.n }; state[x.code] = 'placed'; return; }
    var rs = by[x.code] || [], C = {}, U = [];
    rs.forEach(function (r) { if (r.who && !not(r.who)) C[r.who.sec + '\u0000' + r.who.n] = r.who; else U.push(r); });
    var ks = Object.keys(C);
    U = U.filter(function (r) { return !ks.some(function (k) { return sameChild(r, C[k]); }); });          // the same child, twice
    if (mine) { if (!not(mine)) C[mine.sec + '\u0000' + mine.n] = C[mine.sec + '\u0000' + mine.n] || mine; ks = Object.keys(C); U = U.filter(function (r) { return !sameChild(r, mine); }); }
    if (!rs.length && !mine) { place[x.code] = null; state[x.code] = 'nobody'; return; }
    if (ks.length === 1 && !U.length) { place[x.code] = { sec: C[ks[0]].sec, n: C[ks[0]].n }; state[x.code] = 'placed'; return; }
    place[x.code] = null;
    if (ks.length >= 2 || (ks.length === 1 && U.length)) { shared[x.code] = rs; state[x.code] = 'shared'; }
    else { waiting[x.code] = rs; state[x.code] = 'waiting'; }
  });
  return { place: place, state: state, shared: shared, waiting: waiting };
}
/* Every flag for one class and the test on screen. Each says what is wrong, as facts (text), and what he can do (todo);
   possibilities ("at home", "extended time") belong on the test's own page, not in a list of names. Each has an id, so he can
   dismiss it (and bring it back), and names the code, the student and the response rows it is about.
     c = {sec, prep, course, unit, period, rows, fails: {code: {why, course, unit}},
          recs: [{code, course, unit, started, finished, seconds, opened, ended, limit, rule, unlocks, awayN, points, of,
                  sec, n, how, no, was}],   (sec/n: where the record is kept now)
          picks: {"sec|n|course/unit": code}, known: [codes the site has], show: name → what the screen may show}
   Level: 'warn' (he should look) or 'info' (a note). */
function flags(c) {
  var out = [], here = function (x) { return sameTest(x, c); }, mine = function (w) { return !!w && w.sec === c.sec; };
  var rows = c.rows || [], recs = c.recs || [], fails = c.fails || {}, held = {}, shownName = c.show || function (n) { return n; };
  /* a flag's id: kind | code | names | the test | what makes it this one and no other (R2-M2): dismissing one never silences
     another, and a note whose cause changes (other codes failing, other tests turned in) comes back as a new one */
  var tk = testKey(c.course, c.unit, c.scope), rowId = function (r) { return r ? (r.at || r.when || '') + '#' + r.line + '#' + (r.codes || []).join(',') + '#' + (r.raw || '') : ''; };
  var push = function (f) { f.id = f.id || [f.kind, f.code || '', (f.names || []).join(','), tk, f.uniq != null ? f.uniq : f.rows && f.rows[0] ? rowId(f.rows[0]) : ''].join('|'); out.push(f); };
  recs.forEach(function (x) { held[x.code] = x; });
  var P = placeAll(rows, recs.map(function (x) { return { code: x.code, who: x.sec && x.n ? { sec: x.sec, n: x.n, how: x.how || (x.pin ? 'you' : 'exact') } : x.pin ? { sec: x.pin.sec, n: x.pin.n, how: 'you' } : null, no: x.no, nobody: x.nobody, gone: x.gone }; }));
  // what this class's students already hold of this test (a flag about a typo or a bad cell goes when the child has their test)
  var holds = {}; recs.forEach(function (x) { if (x.sec === c.sec && x.n && here(x) && x.ok !== false) holds[x.n] = true; });
  var hp = function (s) { var m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); if (!m) return s; var h = +m[1]; return (h % 12 || 12) + ':' + m[2] + (h < 12 ? ' am' : ' pm'); };
  // a code two students turned in
  Object.keys(P.shared).forEach(function (code) {
    var rs = P.shared[code], x = held[code]; if (!rs.some(function (r) { return mine(r.who); }) && (rs.some(function (r) { return r.who; }) || !(x && here(x)))) return;
    if (x && x.course && !here(x)) return;   // a shared code of another test (a lesson test of this unit is another test) shows there
    var who = []; rs.forEach(function (r) { var n = r.who ? r.who.n : r.name; if (who.indexOf(n) < 0) who.push(n); });
    push({ kind: 'shared', level: 'warn', code: code, rows: rs, names: who, text: 'Two students turned in the same code: ' + who.map(shownName).join(' and ') + '.',
      todo: 'Only one of them took this test. Look at the code on each student\'s results screen (or ask), then say whose it is; until then it counts for nobody.' });
  });
  // codes that open to nothing, or not here
  var claimed = {}; rows.forEach(function (r) { (r.codes || []).forEach(function (code) { (claimed[code] = claimed[code] || []).push(r); }); });
  var unclaimed = recs.filter(function (x) { return P.state[x.code] === 'nobody'; }).map(function (x) { return x.code; });
  var netN = 0, netC = [];
  Object.keys(fails).forEach(function (code) {
    var fx = fails[code] && typeof fails[code] === 'object' ? fails[code] : { why: fails[code] }, why = fx.why, rs = claimed[code] || [];
    var who = rs.map(function (r) { return r.who && r.who.sec === c.sec ? r.who.n : null; }).filter(Boolean);
    if (!who.length) { if (rs.some(function (r) { return r.who; })) return; if (fx.course != null && !sameTest(fx, c)) return; }
    if ((why === 'none' || why === 'format') && who.length && who.every(function (n) { return holds[n]; })) return;   // the child turned in the right code since
    var whom = who.length ? who.map(shownName).join(' and ') : rs.length ? 'a response with no student matched (' + shownName(rs[0].name || 'no name') + ')' : 'the cockpit\'s file';
    var near = why === 'none' ? nearCodes(code, (c.known || []).concat(unclaimed)) : [];
    var f = { kind: why, level: 'warn', code: code, rows: rs, names: who, near: near };
    if (why === 'none') { f.text = 'No test on the site has the code ' + fmtCode(code) + ' (' + whom + ').'; f.todo = near.length ? 'It is ' + (distance(near[0], code) === 1 ? 'one character' : 'two characters') + ' away from ' + fmtCode(near[0]) + ', a test nobody turned in: most likely a typo. Give that test to this student, or ask them to turn in the code on their screen again.' : 'Most likely a typo. Ask the student for the code on their results screen and turn it in again, or find their test in the cockpit\'s results file.'; }
    else if (why === 'format') { f.text = 'The code ' + fmtCode(code) + ' (' + whom + ') opens to something that is not a test record.'; f.todo = 'Nothing can be read from it. Ask the student for the code on their screen; if it is the same, open the cockpit\'s results file for that day.'; }
    else if (why === 'key') { f.text = 'The test with the code ' + fmtCode(code) + ' (' + whom + ') is locked to another Tally\'s key.'; f.todo = 'It was locked to the key the cockpit held when the test was taken. Open this Tally from the Full save that holds that key (Tally keeps every key it has made), or check in the cockpit which key is pasted there.'; }
    else if (why === 'signature') { f.text = 'The record for ' + fmtCode(code) + ' (' + whom + ') was not signed by the site.'; f.todo = 'Tally will not show what is in it. Take the score from the cockpit\'s results for that day, and talk to the student.'; }
    else if (why === 'code') { f.text = 'The site answered ' + fmtCode(code) + ' (' + whom + ') with another code\'s record.'; f.todo = 'Tally did not keep it. Try again; if it happens again, open the cockpit\'s results file instead.'; }
    else if (why === 'net') { netN++; netC.push(code); return; }
    else return;
    push(f);
  });
  // the network, or anything that wasn't the site's answer: one note for the batch, not one per child
  if (netN) push({ kind: 'net', level: 'info', id: 'net|||' + tk + '|' + c.sec + ':' + netC.sort().join(','), n: netN, text: (netN === 1 ? '1 code' : netN + ' codes') + ' couldn\'t reach the site\'s test records.', todo: 'The network was down, or something between Tally and the site (a school filter, the site not answering) answered instead. Try again when the network is back, or open the cockpit\'s results file.' });
  // records held for this class
  var mineRecs = recs.filter(function (x) { return x.sec === c.sec && x.n && x.ok !== false; });   // only records checked this session
  var byStu = {}; mineRecs.filter(here).forEach(function (x) { (byStu[x.n] = byStu[x.n] || []).push(x); });
  Object.keys(byStu).forEach(function (n) { var l = byStu[n]; if (l.length < 2) return; var pk = (c.picks || {})[c.sec + '|' + n + '|' + testKey(c.course, c.unit, c.scope)];
    if (pk && l.some(function (x) { return x.code === pk; })) return;
    push({ kind: 'twice', level: 'warn', names: [n], uniq: l.map(function (x) { return x.code; }).sort().join(','), codes: l.map(function (x) { return x.code; }), text: shownName(n) + ' has ' + l.length + ' tests for ' + testName(c.course, c.unit, c.scope, c.scopeName) + ' (' + l.map(function (x) { return hm(x.started) + '–' + hm(x.finished) + (x.points != null ? ', ' + x.points + ' / ' + x.of : ''); }).join('; ') + ').',
      todo: 'Each was a separate sitting on the site. Choose the one that counts; the other stays in Tally, marked. If one isn\'t theirs, open it and press Not theirs.' }); });
  mineRecs.filter(here).forEach(function (x) {
    if (x.ended === 'left') push({ kind: 'left', level: 'warn', code: x.code, names: [x.n], text: shownName(x.n) + '\'s test ended itself: they left it ' + (x.after || x.awayN || 'too many') + ' times.',
      todo: 'The score is what was answered when it ended. Open the test to see when and for how long; then decide whether it stands or they sit it again (open the test again in the cockpit).' });
    var so = outsidePeriod(x.started, c.period), fo = outsidePeriod(x.finished, c.period);
    if (so || fo) push({ kind: 'period', level: 'warn', code: x.code, names: [x.n], text: shownName(x.n) + (so && fo ? ' took it ' + hm(x.started) + '–' + hm(x.finished) : so ? ' started at ' + hm(x.started) : ' finished at ' + hm(x.finished)) + ', outside the class period (' + hp(c.period.from) + '–' + hp(c.period.to) + ').',
      todo: 'Times are the site\'s clock. If it wasn\'t a make-up you allowed, open the test and look at its timeline.' });
    var r = x.rule, aw = x.awayN;
    if (r && aw != null && r.after != null && ((r.leave === 'lock' && aw > r.after && !x.unlocks) || (r.leave === 'end' && aw >= r.after && x.ended !== 'left')))
      push({ kind: 'rule', level: 'warn', code: x.code, names: [x.n], text: shownName(x.n) + ' left the test ' + aw + ' times under ' + (r.leave === 'lock' ? 'Lock after ' + r.after + ' and was never unlocked' : 'End after ' + r.after + ' and the test did not end') + ': the page on that device did not ' + (r.leave === 'lock' ? 'lock' : 'end the test') + '.',
        todo: 'Open the test and look at each time away, then talk to the student.' });
    if (x.ended === 'teacher') push({ kind: 'teacher', level: 'warn', code: x.code, names: [x.n], text: shownName(x.n) + '\'s test did not finish: the site closed it with what was saved when the test closed.',
      todo: 'The score counts only the answers saved before then. Decide whether it stands, or open the test again in the cockpit for them to finish.' });
    if (x.ended === 'time') push({ kind: 'time', level: 'warn', code: x.code, names: [x.n], text: shownName(x.n) + '\'s test ran out of time' + (x.limit ? ' (' + x.limit + ' minutes allowed)' : '') + ': the site closed it with what was saved.',
      todo: 'The score counts only the answers saved before the time ran out. Decide whether it stands, or let them finish another time (open the test again in the cockpit).' });
  });
  // against the rest of the class (one class, one test, one day). Only against a clear majority: a group (the same opening,
  // else starts within half an hour of each other) holding at least 60% of the class's records. Two real sittings are one
  // note; a test alone in its own opening is a note (a make-up?).
  var med = function (v) { v = v.slice().sort(function (p, q) { return p - q; }); var m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  var days = {}; mineRecs.filter(here).filter(function (x) { return x.started != null; }).forEach(function (x) { var d = new Date(x.started), k = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); (days[k] = days[k] || []).push(x); });
  Object.keys(days).forEach(function (k) {
    var l = days[k]; if (l.length < 5) return;
    // groups: by opening where every record has one, else by start times (a gap of over 30 minutes starts a new group)
    // groups: the same opening (where every record has one) AND starts within half an hour of each other
    var groups = [], byOpen = l.every(function (x) { return x.opened != null; }), go = {};
    l.forEach(function (x) { var o = byOpen ? String(x.opened) : '-'; (go[o] = go[o] || []).push(x); });
    Object.keys(go).forEach(function (o) { var srt = go[o].slice().sort(function (p, q) { return p.started - q.started; }), g = [srt[0]]; for (var i = 1; i < srt.length; i++) { if (srt[i].started - srt[i - 1].started > 30 * 60000) { groups.push(g); g = []; } g.push(srt[i]); } groups.push(g); });
    groups.sort(function (p, q) { return q.length - p.length; });
    var big = groups[0];
    // an opening with one record in it is a make-up, said once, as a note; it does not count against the majority
    var alone = byOpen ? groups.filter(function (g) { return g.length === 1 && g !== big && go[String(g[0].opened)].length === 1; }) : [];
    alone.forEach(function (g) { var x = g[0]; push({ kind: 'makeup', level: 'info', code: x.code, names: [x.n], text: shownName(x.n) + ' took it alone at ' + hm(x.started) + ' in its own opening (opened ' + hm(+x.opened) + ').', todo: 'A make-up you arranged? If not, open the test.' }); });
    var counted = l.length - alone.length;
    if (big.length < 0.6 * counted) {
      var real = groups.filter(function (g) { return g.length > 1 || !byOpen; });
      if (real.length > 1) push({ kind: 'groups', level: 'info', id: 'groups|||' + tk + '|' + c.sec + ':' + k, text: 'This class sat in ' + (real.length === 2 ? 'two' : real.length) + ' groups: ' + real.map(function (g) { return hm(Math.min.apply(null, g.map(function (x) { return x.started; }))) + ' (' + g.length + ')'; }).join(' and ') + '.', todo: 'No group is most of the class, so Tally doesn\'t flag anyone as apart from it.' });
    } else {
      var ms = med(big.map(function (x) { return x.started; })), mf = med(big.map(function (x) { return x.finished; }));
      var off = function (x) { return x.started < ms - 20 * 60000 || x.started > mf; }, rest = big.filter(function (x) { return !off(x); }); if (!rest.length) rest = big;
      var first = Math.min.apply(null, rest.map(function (x) { return x.started; })), last = Math.max.apply(null, rest.map(function (x) { return x.finished; }));
      var gap = function (t, ref) { var m = Math.round(Math.abs(t - ref) / 60000); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + m % 60 + ' min' : ''); };
      l.forEach(function (x) {
        var sameOpen = !byOpen || String(x.opened) === String(big[0].opened);
        if (big.indexOf(x) >= 0 || sameOpen) { if (big.indexOf(x) < 0 || off(x)) push({ kind: 'apart', level: 'warn', code: x.code, names: [x.n], text: shownName(x.n) + ' started at ' + hm(x.started) + ', ' + gap(x.started, first) + (x.started < first ? ' before' : ' after') + ' the rest of the class (' + hm(first) + '–' + hm(last) + ').', todo: 'Open the test: its clocks and timeline show when it was taken.' }); return; }
        if (alone.some(function (g) { return g[0] === x; })) return;
        push({ kind: 'opening', level: 'warn', code: x.code, names: [x.n], text: shownName(x.n) + ' started at ' + hm(x.started) + (byOpen ? ' in the opening of ' + hm(+x.opened) + '; ' + big.length + ' of the class\'s ' + l.length + ' were in the opening of ' + hm(+big[0].opened) : ', apart from the ' + big.length + ' of ' + l.length + ' who took it ' + hm(first) + '–' + hm(last)) + '.', todo: 'Open the test: its clocks and timeline show when it was taken.' });
      });
    }
    var sm = med(l.filter(function (x) { return x.seconds != null; }).map(function (x) { return x.seconds; }));
    l.forEach(function (x) { if (x.seconds != null && sm && x.seconds > 2 * sm) push({ kind: 'long', level: 'warn', code: x.code, names: [x.n], text: shownName(x.n) + ' sat for ' + dur(x.seconds) + '; the class\'s typical time was ' + dur(sm) + '.',
      todo: 'Open the test: its timeline shows where the time went.' }); });
  });
  // records of this class for another test, or another course
  var other = {}; mineRecs.filter(function (x) { return !(x.course === c.course && x.unit === c.unit); }).forEach(function (x) { var k = testKey(x.course, x.unit, x.scope); var o = other[k] = other[k] || { scope: x.scope || '', scopeName: x.scopeName || '', course: x.course, unit: x.unit, n: 0, codes: [] }; o.n++; o.codes.push(x.code); });
  Object.keys(other).forEach(function (k) { var o = other[k]; push({ kind: 'other', level: 'info', course: o.course, unit: o.unit, scope: o.scope, scopeName: o.scopeName, n: o.n, uniq: k + ':' + o.codes.sort().join(','), text: (o.n === 1 ? '1 test' : o.n + ' tests') + ' turned in here ' + (o.n === 1 ? 'is' : 'are') + ' for ' + testName(o.course, o.unit, o.scope, o.scopeName) + ', not ' + testName(c.course, c.unit, c.scope, c.scopeName) + '.',
    todo: (COURSES[o.course] && COURSES[o.course].prep !== c.prep ? 'That is the other course\'s test: the student may have opened the wrong one. ' : '') + 'Open ' + testName(o.course, o.unit, o.scope, o.scopeName) + ' to see ' + (o.n === 1 ? 'it' : 'them') + '.' }); });
  // tests nobody turned in, of this test (with what the record shows of when and where it was taken)
  recs.filter(function (x) { return P.state[x.code] === 'nobody' && here(x) && x.ok !== false; }).forEach(function (x) {
    push({ kind: 'unclaimed', level: 'warn', code: x.code, text: 'Nobody turned in ' + fmtCode(x.code) + ' (' + (x.points != null ? x.points + ' / ' + x.of + ', ' : '') + (x.started != null ? 'taken ' + hm(x.started) + '–' : 'finished ') + hm(x.finished) + (x.opened != null ? ', in the opening of ' + hm(x.opened) : '') + (x.ended === 'teacher' ? ', not finished: closed by the site' : x.ended === 'time' ? ', ran out of time: closed by the site' : '') + ').' + (x.gone ? ' It had been ' + (x.gone.how === 'you' ? 'given to ' : 'with ') + shownName(x.gone.n) + (x.gone.cl ? ' (' + x.gone.cl + ')' : '') + ', who is no longer on that roster.' : ''),
      todo: 'A student finished this test and didn\'t turn the code in, or typed it wrong. Give it to the student it belongs to.' }); });
  // responses waiting for him: a name Tally isn't sure of (with its suggestion), a test two rows claim
  rows.filter(function (r) { return !r.who && (r.codes || []).length && !P.shared[(r.codes || [])[0]]; }).forEach(function (r) {
    var x = held[r.codes[0]]; if (x && !here(x) && x.course) return;
    if (P.state[r.codes[0]] === 'placed') return;              // its test is placed (the same child twice, or he answered)
    if (r.cands && r.cands.length && !r.cands.some(function (w) { return w && w.sec === c.sec; }) && !(r.suggest && r.suggest.sec === c.sec)) return;
    var s = r.suggest, rem = r.remember, cf = r.conflict;
    if (cf) return push({ kind: 'who', level: 'warn', rows: [r], code: r.codes[0], conflict: cf, names: [], text: cf.kind === 'moved' ? 'Row ' + r.line + ' came from a school account Tally had learned as ' + shownName(cf.was.n) + '\'s; you said it is ' + shownName(cf.acct.n) + '\'s.' : cf.kind === 'typed' ? 'Row ' + r.line + ' came from ' + shownName(cf.acct.n) + '\'s school account' + (cf.gone ? ' (no longer on a roster)' : '') + '; the name typed ' + (cf.typed ? 'points at ' + shownName(cf.typed.n) : 'isn\'t theirs') + '.' : cf.kind === 'reads' && !cf.reads ? '“' + shownName(r.name) + '” (row ' + r.line + ') came from a school account that reads as more than one student.' : cf.kind === 'has' ? '“' + shownName(r.name) + '” (row ' + r.line + ') came from a school account Tally doesn\'t know, and ' + shownName(cf.typed.n) + ' has another.' : '“' + shownName(r.name) + '” (row ' + r.line + ') came from a school account that reads as ' + shownName(cf.reads.n) + '.',
      todo: 'Until you say whose it is, the test counts for nobody.' });
    push({ kind: 'who', level: 'warn', rows: [r], code: r.codes[0], suggest: s || rem || null,
      text: !r.name && r.addr ? (s ? 'A test from a school account Tally doesn\'t know yet (row ' + r.line + ') — ' + shownName(s.n) + '?' : 'A test from a school account Tally doesn\'t know yet (row ' + r.line + ').') : r.name ? (s ? '“' + shownName(r.name) + '” — ' + shownName(s.n) + '?' : rem ? '“' + shownName(r.name) + '” — ' + shownName(rem.n) + ', as you said before?' : 'Tally isn\'t sure who “' + shownName(r.name) + '” is (row ' + r.line + ').') + (r.email ? ' (the name is from the email address)' : '') + (r.hint ? ' The test ' + r.hint + '.' : '') : 'Row ' + r.line + ' has a code and no name.',
      todo: s || rem ? 'Until you say, the test counts for nobody.' : 'Choose the student. Until you do, the test counts for nobody.' }); });
  rows.filter(function (r) { return !(r.codes || []).length && r.raw && (!r.who || r.who.sec === c.sec) && !(r.who && holds[r.who.n]); }).forEach(function (r) {
    push({ kind: 'badcode', level: 'warn', rows: [r], names: r.who ? [r.who.n] : [], text: (c.hideText ? 'What ' + (r.who ? shownName(r.who.n) : 'row ' + r.line) + ' typed (' + String(r.raw).length + ' characters)' : '“' + r.raw + '” (' + (r.who ? shownName(r.who.n) : shownName(r.name || 'row ' + r.line)) + ')') + ' is not a code: a code is 12 letters and digits, like K7QF-2M9D-X4TB.',
      todo: 'Ask the student for the code on their results screen; or find their test among the ones nobody turned in.' }); });
  return out;
}
var fmtCode = function (c) { return SEAL.showCode(c); };
function hm(ms) { if (ms == null) return '?'; var d = new Date(ms); var h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' am' : ' pm'); }

var api = { acctAgrees: acctAgrees, nameStrength: nameStrength, addrOf: addrOf, acctRank: acctRank, acctReads: acctReads, acctFit: acctFit, acctCands: acctCands, acctLocal: acctLocal, teacherPayload: teacherPayload, teacherLink: teacherLink, b64u: b64u, NICKNAMES: NICKNAMES, osa: osa, rival: rival, COURSES: COURSES, clip: clip, placeAll: placeAll, flags: flags, hm: hm, clock: clock, dur: dur, rowsOf: rowsOf, readWhen: readWhen, readSheet: readSheet, tokens: tokens, partsOf: partsOf, edit: edit, matchName: matchName, nameKey: nameKey,
  qOf: qOf, answerText: answerText, keyText: keyText, readRecord: readRecord, courseName: courseName, testName: testName, testFull: testFull, testKey: testKey, sameTest: sameTest, scopeShort: scopeShort, minutes: minutes, outsidePeriod: outsidePeriod, distance: distance, nearCodes: nearCodes };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ExamCore = api;
})(typeof self !== 'undefined' ? self : this);
