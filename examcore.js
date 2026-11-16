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
function readSheet(text) {
  var rows = rowsOf(text), lines = rows.map(function (r, i) { return { r: r, line: i + 1 }; }).filter(function (x) { return x.r.some(function (c) { return c !== ''; }); });
  var res = { cols: { code: null, name: null, at: null }, rows: [], skipped: 0, header: null };
  if (!lines.length) return res;
  var n = Math.max.apply(null, lines.map(function (x) { return x.r.length; })), score = [], j, k;
  for (j = 0; j < n; j++) score.push({ code: 0, when: 0, name: 0, head: '' });
  lines.forEach(function (x) { for (j = 0; j < n; j++) { var c = x.r[j] || ''; if (!c) continue; if (SEAL.findCodes(c).length) score[j].code++; else if (readWhen(c) != null) score[j].when++; else if (looksName(c)) score[j].name++; } });
  var best = function (key, not) { var b = null; for (j = 0; j < n; j++) { if (not.indexOf(j) >= 0) continue; if (score[j][key] > 0 && (b == null || score[j][key] > score[b][key])) b = j; } return b; };
  var code = best('code', []); if (code == null) return res;
  // the header: the first line whose code cell holds no code and whose cells are words, not data
  var first = lines[0], isHead = !SEAL.findCodes(first.r[code] || '').length && first.r.some(function (c) { return /[A-Za-z]/.test(c); }) && readWhen(first.r[0]) == null;
  if (isHead) res.header = first.r.slice();
  var hd = function (j) { return isHead ? String(first.r[j] || '') : ''; };
  var at = best('when', [code]);
  var nameCols = []; for (j = 0; j < n; j++) if (j !== code && j !== at && score[j].name) nameCols.push(j);
  // a column headed "name" or "student" wins (not "email"); else the one with the most names in it, two words before one
  var named = nameCols.filter(function (j) { return /name|student|who/i.test(hd(j)) && !/e-?mail|teacher|period/i.test(hd(j)); });
  var name = named.length ? named[0] : null;
  if (name == null && nameCols.length) {
    var words = function (j) { return lines.filter(function (x) { return /\S+[\s,]+\S+/.test(x.r[j] || '') && looksName(x.r[j]); }).length; };
    nameCols = nameCols.filter(function (j) { return !/e-?mail|period|class|teacher|score|grade|unit/i.test(hd(j)); });
    for (k = 0; k < nameCols.length; k++) if (name == null || words(nameCols[k]) > words(name) || (words(nameCols[k]) === words(name) && score[nameCols[k]].name > score[name].name)) name = nameCols[k];
  }
  res.cols = { code: code, name: name, at: at };
  lines.forEach(function (x, i) {
    if (i === 0 && isHead) return;
    var cell = x.r[code] || '', codes = SEAL.findCodes(cell), nm = name == null ? '' : (x.r[name] || ''), w = at == null ? '' : (x.r[at] || '');
    if (!codes.length && !cell && !nm) { res.skipped++; return; }
    if (!codes.length && SEAL.readCode(cell)) codes = [SEAL.readCode(cell)];
    res.rows.push({ line: x.line, at: w, when: readWhen(w), name: nm, codes: codes, raw: codes.length ? '' : cell });
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
/* roster: [{display}, …] → {pick: index or null, how: 'exact' | 'loose' | null, cands: [index, …] (most likely first)} */
function matchName(typed, roster) {
  var T = tokens(typed), out = { pick: null, how: null, cands: [] };
  if (!T.length) return out;
  var scored = roster.map(function (r, i) {
    var P = partsOf(r.display), set = P.all;
    var exact = !!P.first && P.last.length > 0 && T.every(function (t) { return set.indexOf(t) >= 0; }) && T.indexOf(P.first) >= 0 && P.last.some(function (l) { return T.indexOf(l) >= 0; });
    var f = 0, l = 0, extra = 0;
    T.forEach(function (t) { var a = like(t, P.first), b = Math.max.apply(null, P.last.map(function (x) { return like(t, x); }).concat([0])), m = Math.max.apply(null, P.middle.map(function (x) { return like(t, x); }).concat([0]));
      if (a >= b && a > 0) f = Math.max(f, a); else if (b > 0) l = Math.max(l, b); else if (!m) extra++; });
    return { i: i, exact: exact, s: f + l - extra * 0.5, f: f, l: l };
  });
  var ex = scored.filter(function (x) { return x.exact; });
  if (ex.length === 1) return { pick: ex[0].i, how: 'exact', cands: [ex[0].i] };
  if (ex.length > 1) return { pick: null, how: null, cands: ex.map(function (x) { return x.i; }) };
  var c = scored.filter(function (x) { return x.s >= 0.75 && (x.f > 0 || x.l > 0); }).sort(function (a, b) { return b.s - a.s; });
  out.cands = c.slice(0, 6).map(function (x) { return x.i; });
  if (c.length && c[0].f >= 0.75 && c[0].l >= 0.6 && c[0].s >= 1.55 && (c.length === 1 || c[1].s < c[0].s - 0.5)) { out.pick = c[0].i; out.how = 'loose'; }
  return out;
}
var nameKey = function (t) { return tokens(t).sort().join(' '); };

/* ---------------------------------------------------------------- the record
   Every field is read as the design pins it and nothing else is trusted to have its shape: the record opened and its
   signature held, but a field the page could not fill is null, and an older page's log may be shaped differently. */
var qOf = function (id) { var s = String(id == null ? '' : id); return s.replace(/[a-z]+$/i, '') || s; };
function answerText(type, a) {
  if (a == null) return '';
  if (type === 'mc') return typeof a === 'number' || /^\d+$/.test(String(a)) ? (LET[+a] || String(a)) : String(a);
  if (type === 'multi') return Array.isArray(a) ? a.map(function (k) { return LET[+k] || String(k); }).join(', ') : String(a);
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
function keyText(k) {
  if (k == null) return '';
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
      vals: lp && Array.isArray(lp.vals) ? lp.vals.filter(Array.isArray) : [], n: lp ? num(lp.n) : null, pastes: lp ? num(lp.pastes) : null };
  });
  var qs = [], byQ = {};
  parts.forEach(function (p) { if (!byQ[p.q]) { byQ[p.q] = { q: p.q, parts: [] }; qs.push(byQ[p.q]); } byQ[p.q].parts.push(p); });
  var lq = log && log.q && typeof log.q === 'object' ? log.q : {};
  qs.forEach(function (q) { var e = own(lq, q.q) && lq[q.q] && typeof lq[q.q] === 'object' ? lq[q.q] : null;
    q.sec = e ? num(e.sec) : null; q.visits = e ? num(e.visits) : null; q.first = e ? num(e.first) : null; q.flag = e ? !!e.flag : null; q.flagEnd = e ? !!e.flagEnd : null;
    var vs = q.parts.map(function (p) { return p.v; }); q.v = vs.every(function (v) { return v === 'right'; }) ? 'right' : vs.every(function (v) { return v === 'blank'; }) ? 'blank' : vs.some(function (v) { return v === 'right'; }) ? 'some' : vs.indexOf('wrong') >= 0 ? 'wrong' : vs[0];
    q.almost = q.parts.some(function (p) { return p.almost; }); });
  // the device's lists, each entry kept only in its pinned shape
  var list = function (k, shape) { return log && Array.isArray(log[k]) ? log[k].filter(function (e) { return Array.isArray(e) && shape(e); }) : []; };
  var away = list('away', function (e) { return num(e[0]) != null && num(e[1]) != null; }).map(function (e) { return { at: e[0], sec: e[1], kind: str(e[2]) || '', q: e[3] == null ? '' : String(e[3]) }; });
  var visits = list('visits', function (e) { return num(e[1]) != null && num(e[2]) != null; }).map(function (e) { return { q: String(e[0]), at: e[1], sec: e[2] }; });
  var calc = list('calc', function (e) { return num(e[2]) != null && num(e[3]) != null; }).map(function (e) { return { which: str(e[0]) || '', q: e[1] == null ? '' : String(e[1]), at: e[2], sec: e[3] }; });
  var sc = log && log.scratch && typeof log.scratch === 'object' ? log.scratch : {};
  var scratch = Array.isArray(sc.opens) ? sc.opens.filter(function (e) { return Array.isArray(e) && num(e[2]) != null && num(e[3]) != null; }).map(function (e) { return { tab: e[0] === 'grid' ? 'grid' : 'notes', q: e[1] == null ? '' : String(e[1]), at: e[2], sec: e[3] }; }) : [];
  var paper = []; if (sc.end && typeof sc.end === 'object') Object.keys(sc.end).forEach(function (q) { var e = sc.end[q]; if (!e || typeof e !== 'object') return; var g = e.g && typeof e.g === 'object' ? e.g : null;
    var o = g && Array.isArray(g.o) ? g.o.filter(function (t) { return Array.isArray(t) && (t[0] === 'p' ? t.length === 3 : (t[0] === 's' || t[0] === 'l') && t.length === 5) && t.slice(1).every(function (v) { return num(v) != null; }); }) : [];
    var notes = typeof e.n === 'string' ? e.n : ''; if (!notes.trim() && !o.length) return;
    paper.push({ q: q, notes: notes, grid: o.length ? { four: !(g.v && g.v[0] === 1), scale: g.v && num(g.v[1]) ? g.v[1] : 1, o: o } : null }); });
  paper.sort(function (a, b) { return (parseFloat(a.q) || 0) - (parseFloat(b.q) || 0) || String(a.q).localeCompare(String(b.q)); });
  var blocked = list('blocked', function (e) { return num(e[0]) != null; }).map(function (e) { return { at: e[0], what: str(e[1]) || '', q: e[2] == null ? '' : String(e[2]) }; });
  var idle = list('idle', function (e) { return num(e[0]) != null && num(e[1]) != null; }).map(function (e) { return { at: e[0], sec: e[1], q: e[2] == null ? '' : String(e[2]) }; });
  var dev = log && log.device && typeof log.device === 'object' ? log.device : null, drop = log && log.drop && typeof log.drop === 'object' ? log.drop : {};
  var t0 = log ? num(log.t0) : null, t1 = log ? num(log.t1) : null;
  var sum = function (l) { return l.reduce(function (a, e) { return a + (e.sec || 0); }, 0); };
  return {
    code: str(r.code) || '', id: str(r.id) || '', trial: r.trial === true, course: str(r.course) || '', unit: num(r.unit), cv: r.cv, kit: str(r.kit), seed: str(r.seed),
    started: started, finished: finished, seconds: started != null && finished != null && finished >= started ? Math.round((finished - started) / 1000) : null,
    saves: num(site.saves), timeline: arr(site.timeline).filter(function (e) { return Array.isArray(e) && num(e[0]) != null; }).map(function (e) { return { at: e[0], part: e[1] == null ? '' : String(e[1]) }; }),
    rule: r.rule && typeof r.rule === 'object' ? { leave: str(r.rule.leave) || 'count', after: num(r.rule.after) } : null, ended: r.ended === 'left' || r.ended === 'teacher' ? r.ended : null, unlocks: num(r.unlocks),
    points: num(r.points), of: num(r.of), parts: parts, questions: qs,
    log: log ? { t0: t0, t1: t1, deviceSeconds: t0 != null && t1 != null && t1 >= t0 ? Math.round((t1 - t0) / 1000) : null, fails: num(log.fails), shaped: own(log, 'v') && Array.isArray(log.visits) } : null,
    visits: visits, away: away, awaySec: sum(away), calc: calc, scratch: scratch, paper: paper, cut: !!sc.cut, blocked: blocked, idle: idle, idleSec: sum(idle),
    device: dev, drop: { visits: num(drop.visits) || 0, calc: num(drop.calc) || 0, scratch: num(drop.scratch) || 0, away: num(drop.away) || 0, blocked: num(drop.blocked) || 0, idle: num(drop.idle) || 0 }
  };
}
var courseName = function (c) { return COURSES[c] ? COURSES[c].name : String(c || '').toUpperCase(); };
var testName = function (course, unit) { return courseName(course) + ' Unit ' + (unit == null ? '?' : unit); };
var testKey = function (course, unit) { return String(course || '') + '/' + (unit == null ? '' : unit); };

/* ---------------------------------------------------------------- what does not add up
   Pure on purpose: the screens hand in what Tally holds and get back every flag with what is wrong and what to do.
   claims: [{code, name, when, line, who: {k, n} | null}]  (each response row and the student it was matched to)
   held:   {code: {course, unit, finished, ended, sec, who}}  (records that opened, wherever they are kept)
   fails:  {code: why}  ('none' | 'format' | 'key' | 'signature' | 'code' | 'net')
   period: {from: 'HH:MM', to: 'HH:MM'} or null (the class period, when Tally knows it)                                     */
function minutes(hhmm) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '')); return m ? +m[1] * 60 + +m[2] : null; }
function outsidePeriod(finished, period, tz) {
  if (finished == null || !period) return false; var a = minutes(period.from), b = minutes(period.to); if (a == null || b == null || b <= a) return false;
  var d = new Date(finished), m = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; return m < a || m > b + 1;   // a minute's grace past the bell for the Finish tap
}
function distance(a, b) { if (!a || !b || a.length !== b.length) return 99; var n = 0; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; }
// a code nobody's record answers to, and a code on the site that nobody turned in one or two characters away: likely a typo
function nearCodes(code, pool) { return pool.filter(function (c) { return c !== code && distance(c, code) <= 2; }).sort(function (x, y) { return distance(x, code) - distance(y, code); }); }

/* Where each opened record belongs. rows: the response rows (each {code, who: {sec, n} | null}); recs: [{code, pin}] (pin:
   the student the teacher gave it to). → {code: {sec, n} | null, …} and the codes two students turned in. A record goes
   to the one student every row with its code names, or to the teacher's choice; a code two students turned in goes to
   nobody until he says whose it is. */
function placeAll(rows, recs) {
  var by = {}, place = {}, shared = {};
  rows.forEach(function (r) { (r.codes || [r.code]).forEach(function (c) { if (c) (by[c] = by[c] || []).push(r); }); });
  recs.forEach(function (x) {
    if (x.pin) { place[x.code] = { sec: x.pin.sec, n: x.pin.n }; return; }
    var rs = by[x.code] || [], who = {}, any = false;
    rs.forEach(function (r) { if (r.who) { who[r.who.sec + '\u0000' + r.who.n] = r.who; any = true; } });
    var ks = Object.keys(who), names = {}; rs.forEach(function (r) { names[nameKey(r.name)] = 1; });
    if (ks.length > 1 || (ks.length === 1 && rs.some(function (r) { return !r.who && Object.keys(names).length > 1; }))) { shared[x.code] = rs; place[x.code] = null; }
    else place[x.code] = any ? who[ks[0]] : null;
  });
  return { place: place, shared: shared };
}
/* Every flag for one class and the test on screen. Each says what is wrong and what he can do (kind, text, todo), and
   names the code, the student and the response rows it is about, so the screen can put the button that fixes it on it.
     c = {sec, prep, course, unit, period, students: [n], rows, recs: [{code, course, unit, finished, ended, sec, n, pin}],
          fails: {code: why}, picks: {"sec|n|course/unit": code}, known: [codes the site has, from a results file]} */
function flags(c) {
  var out = [], here = function (x) { return x.course === c.course && x.unit === c.unit; }, mine = function (w) { return !!w && w.sec === c.sec; };
  var rows = c.rows || [], recs = c.recs || [], fails = c.fails || {}, held = {}, shownName = c.show || function (n) { return n; };
  recs.forEach(function (x) { held[x.code] = x; });
  var P = placeAll(rows, recs);
  // a code two students turned in
  Object.keys(P.shared).forEach(function (code) {
    var rs = P.shared[code], x = held[code]; if (!rs.some(function (r) { return mine(r.who); }) && (rs.some(function (r) { return r.who; }) || !(x && here(x)))) return;
    var who = []; rs.forEach(function (r) { var n = r.who ? r.who.n : r.name; if (who.indexOf(n) < 0) who.push(n); });
    out.push({ kind: 'shared', level: 'warn', code: code, rows: rs, names: who, text: 'Two students turned in the same code: ' + who.map(shownName).join(' and ') + '.',
      todo: 'Only one of them took this test. Look at the code on each student\'s results screen (or ask), then say whose it is; the other student has no test until they turn in their own code.' });
  });
  // codes that open to nothing, or not here
  var claimed = {}; rows.forEach(function (r) { (r.codes || []).forEach(function (code) { (claimed[code] = claimed[code] || []).push(r); }); });
  var unclaimed = recs.filter(function (x) { return !x.sec && !x.pin && !claimed[x.code]; }).map(function (x) { return x.code; });
  Object.keys(fails).forEach(function (code) {
    var fx = fails[code] && typeof fails[code] === 'object' ? fails[code] : { why: fails[code] }, why = fx.why, rs = claimed[code] || [];
    var who = rs.map(function (r) { return r.who && r.who.sec === c.sec ? r.who.n : null; }).filter(Boolean);
    // this class's when one of its students turned it in; a code nobody here or elsewhere was matched to shows where its
    // test belongs (the cockpit's file says which test it is), or everywhere when nothing says
    if (!who.length) { if (rs.some(function (r) { return r.who; })) return; if (fx.course != null && !(fx.course === c.course && fx.unit === c.unit)) return; }
    var whom = who.length ? who.map(shownName).join(' and ') : rs.length ? 'a response with no student matched (' + shownName(rs[0].name || 'no name') + ')' : 'the cockpit\'s file';
    var near = why === 'none' ? nearCodes(code, (c.known || []).concat(unclaimed)) : [];
    var f = { kind: why, level: 'warn', code: code, rows: rs, names: who, near: near };
    if (why === 'none') { f.text = 'No test on the site has the code ' + fmtCode(code) + ' (' + whom + ').'; f.todo = near.length ? 'It is ' + (distance(near[0], code) === 1 ? 'one character' : 'two characters') + ' away from ' + fmtCode(near[0]) + ', a test nobody turned in: most likely a typo. Give that test to this student, or ask them to turn in the code on their screen again.' : 'Most likely a typo. Ask the student for the code on their results screen and turn it in again, or find their test in the cockpit\'s results file.'; }
    else if (why === 'format') { f.text = 'The code ' + fmtCode(code) + ' (' + whom + ') opens to something that is not a test record.'; f.todo = 'Nothing can be read from it. Ask the student for the code on their screen; if it is the same, open the cockpit\'s results file for that day.'; }
    else if (why === 'key') { f.text = 'The test with the code ' + fmtCode(code) + ' (' + whom + ') is locked to another Tally\'s key.'; f.todo = 'It was locked to the key the cockpit held when the test was taken. Open this Tally from the Full save that holds that key (Tally keeps every key it has made), or check in the cockpit which key is pasted there.'; }
    else if (why === 'signature') { f.text = 'The record for ' + fmtCode(code) + ' (' + whom + ') was not signed by the site.'; f.todo = 'Tally will not show what is in it: it may have been made by someone other than the site. Take the score from the cockpit\'s results for that day, and talk to the student.'; }
    else if (why === 'code') { f.text = 'The site answered ' + fmtCode(code) + ' (' + whom + ') with another code\'s record.'; f.todo = 'Tally did not keep it. Try again; if it happens again, open the cockpit\'s results file instead.'; }
    else if (why === 'net') { f.kind = 'net'; f.level = 'info'; f.text = 'Not fetched yet: ' + fmtCode(code) + ' (' + whom + ').'; f.todo = 'The site could not be reached. Try again when the network is back, or open the cockpit\'s results file.'; }
    else return;
    out.push(f);
  });
  // records held for this class
  var mineRecs = recs.filter(function (x) { return x.sec === c.sec; });
  var byStu = {}; mineRecs.filter(here).forEach(function (x) { (byStu[x.n] = byStu[x.n] || []).push(x); });
  Object.keys(byStu).forEach(function (n) { var l = byStu[n]; if (l.length < 2) return; var pk = (c.picks || {})[c.sec + '|' + n + '|' + testKey(c.course, c.unit)];
    if (pk && l.some(function (x) { return x.code === pk; })) return;
    out.push({ kind: 'twice', level: 'warn', names: [n], codes: l.map(function (x) { return x.code; }), text: shownName(n) + ' turned in ' + l.length + ' tests for ' + testName(c.course, c.unit) + '.',
      todo: 'Each was a separate sitting on the site. Look at both, then choose the one that counts; the other stays in Tally, marked.' }); });
  mineRecs.filter(here).forEach(function (x) {
    if (x.ended === 'left') out.push({ kind: 'left', level: 'warn', code: x.code, names: [x.n], text: shownName(x.n) + '\'s test ended itself: they left it ' + (x.after || 'too many') + ' times.',
      todo: 'The score is what was answered when it ended. Open the test to see when and for how long; then decide whether it stands or they sit it again (open the test again in the cockpit).' });
    if (outsidePeriod(x.finished, c.period)) out.push({ kind: 'period', level: 'warn', code: x.code, names: [x.n], text: shownName(x.n) + ' finished at ' + hm(x.finished) + ', outside the class period (' + c.period.from + '–' + c.period.to + ').',
      todo: 'The site\'s clock says when Finish was pressed. If it wasn\'t a make-up you allowed, open the test and look at its timeline.' });
  });
  // records of this class for another test, or another course
  var other = {}; mineRecs.filter(function (x) { return !here(x); }).forEach(function (x) { var k = testKey(x.course, x.unit); (other[k] = other[k] || { course: x.course, unit: x.unit, n: 0 }).n++; });
  Object.keys(other).forEach(function (k) { var o = other[k]; out.push({ kind: 'other', level: 'info', course: o.course, unit: o.unit, n: o.n, text: (o.n === 1 ? '1 test' : o.n + ' tests') + ' turned in here ' + (o.n === 1 ? 'is' : 'are') + ' for ' + testName(o.course, o.unit) + ', not ' + testName(c.course, c.unit) + '.',
    todo: (COURSES[o.course] && COURSES[o.course].prep !== c.prep ? 'That is the other course\'s test: the student may have opened the wrong one. ' : '') + 'Open ' + testName(o.course, o.unit) + ' to see ' + (o.n === 1 ? 'it' : 'them') + '.' }); });
  // tests nobody claimed, of this course
  recs.filter(function (x) { return !x.sec && !x.pin && !P.shared[x.code] && !claimed[x.code] && here(x); }).forEach(function (x) {
    out.push({ kind: 'unclaimed', level: 'warn', code: x.code, text: 'Nobody turned in ' + fmtCode(x.code) + ' (' + (x.points != null ? x.points + ' / ' + x.of + ', ' : '') + 'finished ' + hm(x.finished) + ').',
      todo: 'A student finished this test and didn\'t turn the code in, or typed it wrong. Give it to the student it belongs to.' }); });
  // responses Tally could not put a name to, or whose code doesn't read
  rows.filter(function (r) { return !r.who && (r.codes || []).length && !P.shared[(r.codes || [])[0]]; }).forEach(function (r) {
    var x = held[r.codes[0]]; if (x && !here(x) && x.course) return;
    if (r.cands && r.cands.length && !r.cands.some(function (w) { return w && w.sec === c.sec; })) return;   // asked where the likely students are
    out.push({ kind: 'who', level: 'warn', rows: [r], code: r.codes[0], text: r.name ? 'Tally isn\'t sure who “' + shownName(r.name) + '” is (row ' + r.line + ').' : 'Row ' + r.line + ' has a code and no name.', todo: 'Choose the student. Tally remembers it for that name.' }); });
  rows.filter(function (r) { return !(r.codes || []).length && r.raw && (!r.who || r.who.sec === c.sec); }).forEach(function (r) {
    out.push({ kind: 'badcode', level: 'warn', rows: [r], names: r.who ? [r.who.n] : [], text: '“' + r.raw + '” (' + (r.who ? shownName(r.who.n) : shownName(r.name || 'row ' + r.line)) + ') is not a code: a code is 12 letters and digits, like K7QF-2M9D-X4TB.',
      todo: 'Ask the student for the code on their results screen; or find their test among the ones nobody turned in.' }); });
  return out;
}
var fmtCode = function (c) { return SEAL.showCode(c); };
function hm(ms) { if (ms == null) return '?'; var d = new Date(ms); var h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' am' : ' pm'); }

var api = { COURSES: COURSES, placeAll: placeAll, flags: flags, hm: hm, clock: clock, dur: dur, rowsOf: rowsOf, readWhen: readWhen, readSheet: readSheet, tokens: tokens, partsOf: partsOf, edit: edit, matchName: matchName, nameKey: nameKey,
  qOf: qOf, answerText: answerText, keyText: keyText, readRecord: readRecord, courseName: courseName, testName: testName, testKey: testKey, minutes: minutes, outsidePeriod: outsidePeriod, distance: distance, nearCodes: nearCodes };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ExamCore = api;
})(typeof self !== 'undefined' ? self : this);
