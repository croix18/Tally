(function(){
'use strict';
const LS_KEY = 'tally.v1';
const DEFAULT_THR = { on: 60, acc: 67 };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coarse = () => window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;   // the tablet and the panel: no auto-focus (it raises the keyboard), bigger targets
// Focus-check overrides: the teacher decided Focus's number for a student/unit is right on purpose (late penalty, a
// retake outside IXL, …). Kept with the date and reason; honoured as long as Focus still holds that number.
function cleanOverrides(o) { const out = {}; if (o && typeof o === 'object') for (const u of Object.keys(o)) { if (!SAFE_KEY(u) || !o[u] || typeof o[u] !== 'object') continue; const m = {}; for (const d of Object.keys(o[u])) { const v = o[u][d]; if (!SAFE_KEY(d) || !v || typeof v !== 'object') continue; m[d] = { focus: v.focus == null ? null : +v.focus, tally: v.tally == null ? null : +v.tally, at: typeof v.at === 'string' ? v.at.slice(0, 30) : '', why: typeof v.why === 'string' ? v.why.slice(0, 200) : '' }; } if (Object.keys(m).length) out[u] = m; } return out; }
const overrideFor = (sec, unitName, display) => (sec.overrides && sec.overrides[unitName] && sec.overrides[unitName][display]) || null;
const SAFE_KEY = k => typeof k === 'string' && !['__proto__', 'constructor', 'prototype'].includes(k);   // object keys that come from files
const plural = (n, w) => n + ' ' + (n === 1 ? w : w + (/s$/.test(w) ? 'es' : 's'));

let state = null;
/*__GRADES__*/   // grades.js is spliced in here by build.py (same closure, so it shares state and helpers)
/*__CHARTS__*/   // charts.js too
/*__HOME__*/     // home.js too
/*__SEATING__*/  // seating.js too
/*__QUARTERS__*/ // quarters.js too
/*__STUDENTS__*/ // students.js too
let view = { mode: 'home', unit: null };   // opens on the Overview
let noticesOpen = false, noticeCount = { warn: 0, info: 0 }; let attCache = new Map();
let search = '';

// Gradebook data is saved with everything else. One earlier build kept it in sessionStorage only; anything still
// there is folded in once and removed.
const GB_KEY = LS_KEY + '.gradebooks';
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY)); if (!s || !s.sections) return null;
    try { const g = JSON.parse(sessionStorage.getItem(GB_KEY) || '{}'); for (const k in g) if (s.sections[k] && !s.sections[k].grades && g[k] && Array.isArray(g[k].assignments)) s.sections[k].grades = g[k]; sessionStorage.removeItem(GB_KEY); } catch (e) {}
    for (const k in s.sections) if (s.sections[k] && s.sections[k].grades && !s.sections[k].grades.assignments) delete s.sections[k].grades;
    return s;
  } catch (e) {}
  return null;
}
function migrate() {
  const st = state.settings || {};
  state.settings = { copyNames: !!st.copyNames, hideNames: !!st.hideNames, showAllUnits: !!st.showAllUnits, leaderboard: !!st.leaderboard, lbFocus: st.lbFocus === 'acc' || st.lbFocus === 'on' ? st.lbFocus : 'both', lbTab: st.lbTab === 'lab' ? 'lab' : 'race', labUnit: typeof st.labUnit === 'string' ? (st.labUnit && !/^(unit|skill|gb):/.test(st.labUnit) ? 'unit:' + st.labUnit : st.labUnit) : '', labStats: st.labStats === 2 ? 2 : st.labStats ? 1 : 0, labTukey: !!st.labTukey, labDots: st.labDots && typeof st.labDots === 'object' ? st.labDots : {}, useBest: st.useBest !== false, copyMode: st.copyMode, labPrep: st.labPrep === 'on' ? 'on' : 'acc', labValues: !!st.labValues, remindDays: st.remindDays == null ? 7 : ([0, 7, 14, 30].includes(st.remindDays) ? st.remindDays : 7),
    skipFirst: { acc: st.skipFirst && Number.isInteger(st.skipFirst.acc) ? st.skipFirst.acc : 0, on: st.skipFirst && Number.isInteger(st.skipFirst.on) ? st.skipFirst.on : 1 }, details: !!st.details, labPct: !!st.labPct, labKind: ['box', 'dots', 'hist', 'stem', 'bar', 'circle', 'line'].includes(st.labKind) ? st.labKind : 'box', labBin: [1, 2, 5, 10].includes(st.labBin) ? st.labBin : 0, skipFirstV2: !!st.skipFirstV2, onlyCurrent: { acc: !!(st.onlyCurrent && st.onlyCurrent.acc), on: !!(st.onlyCurrent && st.onlyCurrent.on) },
    currentUnit: { acc: st.currentUnit && Number.isInteger(st.currentUnit.acc) ? st.currentUnit.acc : null, on: st.currentUnit && Number.isInteger(st.currentUnit.on) ? st.currentUnit.on : null } };   // the unit each course is working in: everything up to it is assigned, later units are listed as upcoming   // on-level starts with two review units that aren't assigned; accelerated assigns Unit 1 (a subset of its skills — use the Focus check's skip offer)
  state.pendingCfg = state.pendingCfg || {};
  state.assigned = state.assigned && typeof state.assigned === 'object' ? state.assigned : {}; state.assigned.acc = state.assigned.acc || {}; state.assigned.on = state.assigned.on || {};
  state.custom = Array.isArray(state.custom) ? state.custom.filter(c => c && typeof c.id === 'string' && typeof c.label === 'string').map(c => { const values = {}; if (c.values && typeof c.values === 'object') for (const k of Object.keys(c.values)) if (SAFE_KEY(k) && Array.isArray(c.values[k])) values[k] = c.values[k].map(Number).filter(Number.isFinite); return { ...c, label: c.label.slice(0, 80), unit: typeof c.unit === 'string' ? c.unit.slice(0, 40) : '', prep: c.prep === 'acc' ? 'acc' : 'on', values }; }) : [];
  state.grading = state.grading && typeof state.grading === 'object' ? state.grading : {};
  state.pools = state.pools && typeof state.pools === 'object' ? state.pools : {};
  state.lastBackup = typeof state.lastBackup === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(state.lastBackup) ? state.lastBackup.slice(0, 30) : null;
  const li = state.lastImport; state.lastImport = li && typeof li === 'object' && typeof li.at === 'string' ? { at: li.at.slice(0, 30), lines: (Array.isArray(li.lines) ? li.lines : []).filter(l => l && typeof l === 'object').map(l => ({ label: String(l.label || '').slice(0, 80), text: String(l.text || '').slice(0, 300), pool: l.pool === 'acc' || l.pool === 'on' ? l.pool : null })).slice(0, 20), fails: (Array.isArray(li.fails) ? li.fails : []).map(x => String(x).slice(0, 300)).slice(0, 20), skipped: Number(li.skipped) || 0 } : null;
  roomOK(); state.seatWeights = state.seatWeights && typeof state.seatWeights === 'object' ? state.seatWeights : {};
  state.seatBasis = typeof state.seatBasis === 'string' ? state.seatBasis : 'blend'; state.seatPairs = typeof state.seatPairs === 'string' ? state.seatPairs : 'mix';
  if (!state.settings.skipFirstV2) { state.settings.skipFirst = { acc: 0, on: 1 }; state.settings.skipFirstV2 = true; }   // one-time: the earlier default hid on-level Unit 2 too
  // Skill skips are course-wide: state.skips[prep] is the one object every class of that course reads as sec.excluded.
  state.skips = state.skips && typeof state.skips === 'object' ? state.skips : {}; state.skips.acc = state.skips.acc || {}; state.skips.on = state.skips.on || {};
  state.settings.copyMode = ['points', 'names', 'ids'].includes(state.settings.copyMode) ? state.settings.copyMode : (state.settings.copyNames ? 'names' : 'points');
  for (const k of Object.keys(state.sections)) { if (!SAFE_KEY(k)) { delete state.sections[k]; continue; }
    const s = state.sections[k];
    if (!s || typeof s !== 'object' || !Array.isArray(s.students) || !Array.isArray(s.skills) || !Array.isArray(s.scores)) { delete state.sections[k]; continue; }
    if (typeof s.label !== 'string') s.label = s.autoLabel || k;
    // A gradebook is only usable whole: assignments with values/status arrays of the students' length.
    if (s.grades) { const gb = s.grades; const n = Array.isArray(gb.students) ? gb.students.length : -1; if (n < 0 || !Array.isArray(gb.assignments) || !gb.assignments.every(a => a && typeof a.name === 'string' && Array.isArray(a.values) && a.values.length === n && (!a.status || (Array.isArray(a.status) && a.status.length === n)))) delete s.grades; else gb.assignments.forEach(a => { a.missing = Number(a.missing) || 0; a.excused = Number(a.excused) || 0; if (a.max != null && isNaN(Number(a.max))) a.max = null; }); }
    s.best = s.best && typeof s.best === 'object' ? s.best : null; s.receipts = s.receipts || {}; s.overrides = cleanOverrides(s.overrides); s._keys = null; s.studentSkips = s.studentSkips && typeof s.studentSkips === 'object' ? s.studentSkips : {};
    // one-time: a unit a class had manually hidden/shown becomes the course's assignment mark
    if (s.hiddenUnits && Object.keys(s.hiddenUnits).length) { for (const u in s.hiddenUnits) if (state.assigned[s.prep || 'on'][u] == null) state.assigned[s.prep || 'on'][u] = !s.hiddenUnits[u]; s.hiddenUnits = {}; }
    { const al = {}; if (s.aliases && typeof s.aliases === 'object') for (const k of Object.keys(s.aliases)) if (SAFE_KEY(k) && typeof s.aliases[k] === 'string') al[k] = s.aliases[k]; s.aliases = al; } s.hiddenUnits = s.hiddenUnits && typeof s.hiddenUnits === 'object' ? s.hiddenUnits : {};
    if (typeof s.roster !== 'string') s.roster = ''; s.threshold = s.threshold == null ? s.threshold : +s.threshold;
    s.seatInfo = s.seatInfo && typeof s.seatInfo === 'object' ? s.seatInfo : {}; for (const k in s.seatInfo) s.seatInfo[k] = cleanSeatInfo(s.seatInfo[k]); if (s.seating && (typeof s.seating !== 'object' || !s.seating.seats || typeof s.seating.seats !== 'object')) delete s.seating;
    s.gradeHistory = Array.isArray(s.gradeHistory) ? s.gradeHistory.filter(h => h && typeof h.date === 'string' && Array.isArray(h.grade) && Array.isArray(h.students) && Array.isArray(h.missing) && Array.isArray(h.assignments)) : [];
    // snapshots once carried per-student mastered/touched arrays that nothing reads; keep only the aggregate fields
    s.history = (Array.isArray(s.history) ? s.history : []).filter(h => h && typeof h.date === 'string' && h.per).map(h => ({ date: h.date, at: h.at, thr: h.thr, students: h.students, per: h.per, pu: h.pu, ua: h.ua })); if (s.team) { s.label = s.team; s.team = ''; } s.prep = s.prep === 'acc' || s.prep === 'on' ? s.prep : (s.accelerated ? 'acc' : 'on');
    { const course = state.skips[s.prep === 'acc' ? 'acc' : 'on']; if (s.excluded && s.excluded !== course) Object.keys(s.excluded).forEach(key => { if (s.excluded[key]) course[key] = true; }); s.excluded = course; }   // older saves kept skips per class
    if (s.threshold == null) s.threshold = s.accelerated ? (st.thrAcc || DEFAULT_THR.acc) : (st.thrOn || DEFAULT_THR.on);
    s.threshold = clampThr(s.threshold);
    // ignored used to be keyed by normalized name; now by "Name#occurrence"
    const ig = {}; for (const key in (s.ignored || {})) { if (key.includes('#')) ig[key] = true; else ixlList(s).forEach(x => { if (x.n === key) ig[x.key] = true; }); }
    s.ignored = ig;
  }
  quarters(); for (const k of Object.keys(state.sections)) state.sections[k].qArchive = cleanArchive(state.sections[k].qArchive);
  state.order = (Array.isArray(state.order) ? state.order : []).filter(k => SAFE_KEY(k) && Object.prototype.hasOwnProperty.call(state.sections, k));
  for (const k of Object.keys(state.sections)) if (!state.order.includes(k)) state.order.push(k);
}
function clampThr(v, fallback) { const n = parseInt(v, 10); return isNaN(n) ? (fallback != null ? fallback : DEFAULT_THR.on) : Math.max(1, Math.min(100, n)); }
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); return true; } catch (e) { lastSaveFail = Date.now(); toast(e && /quota/i.test(String(e.name + e.message)) ? 'Could not save — this browser\'s storage is full. Remove a gradebook or photos, or clear old classes; your changes stay until you close the tab.' : 'Could not save to this browser (storage blocked). Your data stays until you close the tab.', true, 8000); return false; } }

/* ---------- names ---------- */
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
const SUFFIX = /^(jr|sr|ii|iii|iv|v)$/;
const PARTICLE = /^(de|la|del|las|los|van|von|der|den|di|da|dos|das|du|le|el|al|bin|ibn|san|santa|st|mc|mac|ter|ten|op|het)$/i;
function stripSuffix(tokens) { const t = tokens.slice(); while (t.length > 1 && SUFFIX.test(t[t.length - 1])) t.pop(); return t; }
function ixlDisplay(name) {
  const t = String(name).trim().split(/\s+/); if (t.length < 2) return name;
  if (name.includes(',')) return name;                                   // already "Last, First"
  const s = stripSuffix(t.map(x => x.toLowerCase().replace(/[.,]/g, ''))).length;
  let start = s - 1; while (start > 1 && PARTICLE.test(t[start - 1])) start--;
  return t.slice(start, s).join(' ') + ', ' + t.slice(0, start).join(' ') + (s < t.length ? ' ' + t.slice(s).join(' ') : '');
}
// IXL students with stable keys: "Name#k" where k is the occurrence among identical names
function ixlList(sec) {
  const seen = {};
  return sec.students.map((name, i) => {
    let n = norm(name);
    if (name.includes(',')) { const [l, f] = name.split(',', 2); n = norm(f + ' ' + l); }
    const k = seen[n] = (seen[n] || 0) + 1;
    const tokens = stripSuffix(n.split(' ').filter(Boolean));
    return { i, name, n, key: name + '#' + (k - 1), first: tokens[0] || '', last: tokens[tokens.length - 1] || '', tokens, dup: false };
  }).map((x, _, arr) => { x.dup = arr.some(y => y !== x && y.n === x.n); return x; });
}
// Roster text -> [{display,last,first,alias}]. Alias syntax on a line:  Last, First = IXL Name
const HEADER_WORDS = /^(student|students|student name|name|names|last name|first name|last|first|#|no\.?|id|grade|period|section)$/i;
function parseRosterText(text) {
  const out = [];
  for (let raw of String(text || '').split(/\r?\n/)) {
    let line = raw.trim(); if (!line) continue;
    let alias = '';
    const eq = line.match(/^(.*?[A-Za-z].*?)\s*=\s*([A-Za-z][^\t]*)$/);
    if (eq && !/\t/.test(eq[2])) { alias = eq[2].trim(); line = eq[1].trim(); }
    const cells = line.split(/\t|\s{2,}|\|/).map(c => c.replace(/^"|"$/g, '').trim()).filter(Boolean);
    // prefer the cell that looks most like a name: "Last, First" first, then two+ alphabetic words
    let cell = cells.find(c => /^[^\d]*[A-Za-zÀ-ɏ][^\d]*,\s*[A-Za-zÀ-ɏ]/.test(c))
            || cells.find(c => /^[A-Za-zÀ-ɏ'’.-]+(\s+[A-Za-zÀ-ɏ'’.-]+)+$/.test(c))
            || cells.find(c => /[A-Za-zÀ-ɏ]{2,}/.test(c) && !/^\d+$/.test(c));
    if (!cell) continue;
    if (HEADER_WORDS.test(cell)) continue;
    let last = '', first = '';
    if (cell.includes(',')) { const [l, f] = cell.split(',', 2); last = l.trim(); first = (f || '').trim(); }
    else { const t = cell.split(/\s+/); if (t.length === 1) { last = t[0]; } else { first = t.slice(0, -1).join(' '); last = t[t.length - 1]; } }
    if (!last && !first) continue;
    const id = (cells.find(c => /^\d{4,}$/.test(c)) || '');
    out.push({ raw: cell, last, first, alias, id, display: first ? last + ', ' + first : last });
  }
  return out;
}
function rosterState(sec) { const n = parseRosterText(sec.roster).length; return { hasText: !!String(sec.roster || '').trim(), count: n }; }
function mask(display) { const m = String(display).match(/^([^,]+),\s*(.+)$/); if (m) return (m[2].trim()[0] || '') + '. ' + (m[1].trim()[0] || '') + '.'; return String(display).split(/\s+/).map(x => (x[0] || '') + '.').join(' '); }
const shown = d => state.settings.hideNames ? mask(d) : d;

// state boots here, after every helper it needs is defined (a TDZ on a regex const once blanked the app on reload)
let bootError = null;
try { state = load() || { settings: {}, sections: {}, order: [], active: null, pendingCfg: {}, pools: {} }; migrate(); }
catch (e) { console.error('Tally: could not load saved data', e); bootError = e; try { localStorage.setItem(LS_KEY + '.broken', localStorage.getItem(LS_KEY) || ''); } catch (x) {} state = { settings: {}, sections: {}, order: [], active: null, pendingCfg: {}, pools: {} }; migrate(); }

// rows: [{ display, sub, ixl, key, status:'ok'|'rosterOnly'|'ambiguous'|'ixlOnly'|'noAccount', tier:'exact'|'loose'|'alias'|'' }]
// Matching runs in PASSES over the whole roster (exact for everyone, then loose), so a nickname never steals an exact match.
function buildRows(sec) {
  const roster = parseRosterText(sec.roster);
  const ignored = sec.ignored || {}, aliases = sec.aliases || {};
  const ixl = ixlList(sec).filter(x => !ignored[x.key]);
  if (!roster.length) {
    return ixl.slice().sort((a, b) => ixlDisplay(a.name).localeCompare(ixlDisplay(b.name)))
      .map(s => ({ display: ixlDisplay(s.name), ixlName: s.name, key: s.key, sub: '', ixl: s.i, status: 'ok', tier: '' }));
  }
  const used = new Set(), match = roster.map(() => null), tier = roster.map(() => ''), sawMulti = roster.map(() => false);
  const R = roster.map(r => {
    const rf = norm(r.first).split(' ').filter(Boolean), rl = stripSuffix(norm(r.last).split(' ').filter(Boolean));
    return { rf, rl, target: (rf.join(' ') + ' ' + rl.join(' ')).trim() };
  });
  const passes = [
    ['alias', (r, ri, s) => { const a = aliases[r.display] || r.alias; if (!a) return false; return a.includes('#') ? s.key === a : s.n === norm(a); }],
    ['exact', (r, ri, s) => { const { rf, rl } = R[ri]; const st = s.tokens.join(' '); if (s.n === R[ri].target || st === R[ri].target || (rf.length > 1 && rl.length && st === rf[0] + ' ' + rl.join(' '))) return true;
      // IXL runs multi-part surnames together ("LOWELL CALDER" / "JARVIS-DUNMORE" → "LOWELLCALDER" / "JARVISDUNMORE")
      return rl.length > 1 && rf[0] && s.tokens[0] === rf[0] && s.tokens.length === 2 && s.tokens[1] === rl.join(''); }],
    ['loose', (r, ri, s) => { const { rf, rl } = R[ri]; return rf[0] && s.tokens[0] === rf[0] && rl.length && s.tokens.slice(-rl.length).join(' ') === rl.join(' '); }],
    ['loose', (r, ri, s) => { const { rf, rl } = R[ri]; return rl.length && s.last === rl[rl.length - 1] && rf[0] && (s.first.startsWith(rf[0]) || rf[0].startsWith(s.first)); }],
  ];
  for (const [name, pred] of passes) {
    roster.forEach((r, ri) => {
      if (match[ri]) return;
      if (name !== 'alias' && (aliases[r.display] || r.alias)) return;   // an alias that didn't resolve stays unmatched
      const cands = ixl.filter(s => !used.has(s.i) && pred(r, ri, s));
      if (cands.length === 1) { used.add(cands[0].i); match[ri] = cands[0]; tier[ri] = name; }
      else if (cands.length > 1) sawMulti[ri] = true;
    });
  }
  const rows = roster.map((r, ri) => {
    const m = match[ri];
    if (m) return { display: r.display, id: r.id, ixlName: m.name, key: m.key, sub: tier[ri] === 'loose' ? 'IXL: ' + m.name : '', ixl: m.i, status: 'ok', tier: tier[ri] };
    // "No IXL account" (the fixer's answer, stored as the alias '#none') is a state, not a problem: no flag, no dot, a blank row in copies.
    if ((aliases[r.display] || r.alias) === '#none') return { display: r.display, id: r.id, ixlName: null, key: null, sub: 'no IXL account', ixl: null, status: 'noAccount', tier: '' };
    return { display: r.display, id: r.id, ixlName: null, key: null, sub: sawMulti[ri] ? 'two IXL matches' : 'not found in IXL', ixl: null, status: sawMulti[ri] ? 'ambiguous' : 'rosterOnly', tier: '' };
  });
  for (const s of ixl) if (!used.has(s.i)) rows.push({ display: ixlDisplay(s.name), ixlName: s.name, key: s.key, sub: 'in IXL, not on roster', ixl: s.i, status: 'ixlOnly', tier: '' });
  return rows;
}

/* ---------- computations ---------- */
const skillKey = sk => sk.id || (sk.unit + '|' + sk.name);
function unitsOf(sec) {
  const map = new Map();
  sec.skills.forEach((sk, i) => { if (!map.has(sk.unit)) map.set(sk.unit, []); map.get(sk.unit).push(i); });
  const t = sec.threshold; const marks = (state.assigned && state.assigned[sec.prep]) || {};
  return [...map.entries()].map(([name, idx]) => {
    const m = name.match(/^Unit\s+(\d+)\s*(.*)$/i);
    const active = idx.filter(k => !sec.excluded[skillKey(sec.skills[k])]);
    // "Looks started": a real share of the class has touched the unit (a quarter of students), not one kid working ahead —
    // a course-wide export has students on every unit, so a single score at goal must not assign a unit for the whole course.
    const n = sec.students.length; const seen = new Array(n).fill(false);
    idx.forEach(k => sec.scores[k].forEach((v, si) => { if (v != null) seen[si] = true; }));
    const share = n ? seen.filter(Boolean).length / n : 0;
    const auto = share >= 0.25;
    const num = m ? Number(m[1]) : 0; const skipFirst = (state.settings.skipFirst || {})[sec.prep] || 0; const cur = (state.settings.currentUnit || {})[sec.prep];
    // Assigned: the course's mark wins; else the first N review units aren't; else everything up to the unit the course is
    // working in is (or, with no current unit chosen yet, whatever a quarter of the class has started).
    const review = num > 0 && num <= skipFirst;
    const assigned = marks[name] != null ? !!marks[name] : review ? false : (cur ? num > 0 && num <= cur : auto);
    const hidden = marks[name] != null ? !marks[name] : review;   // only review units (or ones you hid) leave the grid; upcoming units stay listed
    return { name, short: m ? 'Unit ' + m[1] : name, title: m ? m[2] : '', num, idx, active, total: active.length, hidden, assigned, upcoming: !assigned && !hidden, current: !!cur && num === cur, marked: marks[name] != null };
  });
}
// A student's own list for a unit: the class's counted skills minus any skipped just for them (modified assignment lists)
function activeFor(sec, unit, si) {
  const sk = sec.studentSkips[ixlKeyAt(sec, si)]; if (!sk) return unit.active;
  return unit.active.filter(k => !sk[skillKey(sec.skills[k])]);
}
function totalFor(sec, unit, si) { return activeFor(sec, unit, si).length; }
// The score a student is graded on: their best SmartScore on that skill across every import (SmartScores fall when a student keeps practicing and misses)
function eff(sec, k, si) {
  const cur = sec.scores[k][si];
  if (!state.settings.useBest || !sec.best) return cur;
  const b = sec.best[skillKey(sec.skills[k])]; const bv = b ? b[ixlKeyAt(sec, si)] : undefined;
  return bv == null ? cur : cur == null ? bv : Math.max(cur, bv);
}
function ixlKeyAt(sec, si) { if (!sec._keys || sec._keys.length !== sec.students.length) sec._keys = ixlList(sec).map(x => x.key); return sec._keys[si]; }
function mergeBest(sec) {
  sec.best = sec.best || {};
  sec.skills.forEach((sk, k) => { const key = skillKey(sk); const row = sec.best[key] = sec.best[key] || {}; sec.scores[k].forEach((v, si) => { if (v == null) return; const kk = ixlKeyAt(sec, si); if (row[kk] == null || v > row[kk]) row[kk] = v; }); });
}
function points(sec, unit, si) {
  const t = sec.threshold; let p = 0;
  for (const k of activeFor(sec, unit, si)) { const v = eff(sec, k, si); if (v != null && v >= t) p++; }
  return p;
}

/* ---------- import ---------- */
async function importFiles(files) {
  let ok = [], fails = [], skipped = 0, gbImported = [], deferred = [], poolImported = [];
  for (const f of files) {
    try {
      if (/\.json$/i.test(f.name)) {   // the standalone Seating Chart's backup (photos, FAST, flags, room, charts) — a Tally backup goes through Settings
        let obj = null; try { obj = JSON.parse(await f.text()); } catch (e) {}
        if (obj && obj.tally) { fails.push(f.name + ': that is a Tally backup — load it from Settings → Load backup'); continue; }
        if (!looksLikeSeatingBackup(obj)) { fails.push(f.name + ': not a Seating Chart backup'); continue; }
        const r = await importSeatingBackup(obj); save();
        toast(`Seating Chart backup: ${plural(r.matched, 'student')} matched in ${plural(r.classes, 'class')}${r.room ? ' · room layout' : ''}${r.charts ? ` · ${plural(r.charts, 'saved chart')}` : ''}${r.unmatched.length ? ` · <b>${r.unmatched.length} not matched</b> (${esc(r.unmatched.slice(0, 3).map(n => shown(n)).join('; '))}${r.unmatched.length > 3 ? '…' : ''})` : ''}`, false, 9000);
        render(); continue;
      }
      const rows = await fileToRows(f);
      let g;
      try { g = parseIxlGrid(rows); }
      catch (e) {
        // not an IXL grid — maybe a gradebook export (Focus): students down, assignments across
        const gb = parseGradebook(rows);
        if (!gb) throw e;
        deferred.push({ f, gb });   // attached after every IXL grid in this drop has been imported, so a mixed drop works in any order
        continue;
      }
      const meta = parseIxlFilename(f.name);
      if (!SAFE_KEY(meta.key)) throw new Error('unusable file name');
      if (!meta.section && g.students.length) {   // a course-wide export (no section code): the pool every class of that course is carved from
        const prep = meta.accelerated ? 'acc' : 'on'; const prevPool = state.pools[prep];
        if (prevPool && prevPool.date && meta.date && meta.date < prevPool.date && !confirm(`${f.name}\n\nThis export is dated ${meta.date}, but the ${prep === 'acc' ? 'accelerated' : 'on-level'} course already has data from ${prevPool.date}. Replace the newer data with this older file?`)) { skipped++; continue; }
        if (prevPool && prevPool.students.length) { const have = new Set(prevPool.students.map(n => norm(n))); const same = g.students.filter(n => have.has(norm(n))).length; const share = same / Math.max(prevPool.students.length, g.students.length);
          if ((share < 0.5 || !meta.date) && !confirm(`${f.name}\n\n${!meta.date ? 'This file has no export date in its name' : `Only ${same} of its ${g.students.length} students are in the ${prep === 'acc' ? 'accelerated' : 'on-level'} course already`}. Replace the course's IXL data (${prevPool.students.length} students, ${prevPool.date || 'undated'}) with it?`)) { skipped++; continue; } }
        state.pools[prep] = { students: g.students, skills: g.skills, scores: g.scores, date: meta.date, file: f.name, importedAt: new Date().toISOString() };
        const fed = state.order.map(k => state.sections[k]).filter(x => x.pool && x.prep === prep);
        fed.forEach(x => { materialize(x); ok.push(x); });
        poolImported.push({ prep, students: g.students.length, skills: g.skills.length });
        continue;
      }
      let students = g.students, placeholder = false;
      if (!students.length) {
        const hdr = rows.find(r => r.some(v => typeof v === 'string' && /skill name/i.test(v)));
        const cSkill = hdr.findIndex(v => typeof v === 'string' && /skill name/i.test(v));
        const cId = hdr.findIndex(v => typeof v === 'string' && /skill id/i.test(v));
        const first = Math.max(cSkill, cId) + 1;
        const width = Math.max(...rows.slice(0, 60).map(r => r.length));
        students = []; for (let c = first; c < width; c++) students.push('Student ' + (c - first + 1));
        const hi = rows.indexOf(hdr);
        g.scores = []; for (let i = hi + 1; i < rows.length; i++) { const r = rows[i] || []; if (r[cSkill] == null || String(r[cSkill]).trim() === '') continue; g.scores.push(students.map((_, j) => asScore(r[first + j]))); }
        placeholder = true;
      }
      const allBlank = !g.scores.some(row => row.some(v => v != null));
      const prev = state.sections[meta.key];
      if (prev && prev.date && meta.date && meta.date < prev.date) {
        if (!confirm(`${f.name}\n\nThis export is dated ${meta.date}, but ${prev.label} already has data from ${prev.date}. Replace the newer data with this older file?`)) { skipped++; continue; }
      }
      const pend = state.pendingCfg[meta.key] || {};
      const keep = prev || pend;
      state.sections[meta.key] = {
        key: meta.key, label: prev ? prev.label : (pend.label || meta.label), autoLabel: meta.label,
        accelerated: meta.accelerated,
        threshold: clampThr(keep.threshold != null ? keep.threshold : (meta.accelerated ? DEFAULT_THR.acc : DEFAULT_THR.on)),
        date: meta.date, file: f.name, importedAt: new Date().toISOString(),
        students, skills: g.skills, scores: g.scores,
        roster: keep.roster || '', rosterAt: keep.rosterAt || null, skipRoster: !!keep.skipRoster,
        excluded: state.skips[keep.prep || (meta.accelerated ? 'acc' : 'on')], ignored: keep.ignored || {}, aliases: keep.aliases || {}, hiddenUnits: {}, studentSkips: keep.studentSkips || {},
        history: keep.history || [], team: keep.team || '', prep: keep.prep || (meta.accelerated ? 'acc' : 'on'),
        grades: keep.grades, gradeHistory: keep.gradeHistory || [], qArchive: keep.qArchive || {}, seating: keep.seating, seatInfo: keep.seatInfo || {}, overrides: keep.overrides || {}, period: keep.period != null ? keep.period : (meta.period || undefined),   // the weekly re-import must not drop what the gradebook, the seating chart and the backup put here
        placeholder, allBlank
      };
      if (meta.date) state.sections[meta.key].history = (state.sections[meta.key].history || []).filter(h => h.date <= meta.date);   // an older file accepted on purpose: nothing newer than it is "now"
      snapshot(state.sections[meta.key]);
      state.sections[meta.key].best = prev ? prev.best : null; state.sections[meta.key].receipts = prev ? prev.receipts : {}; state.sections[meta.key]._keys = null; mergeBest(state.sections[meta.key]);
      delete state.pendingCfg[meta.key];
      if (!state.order.includes(meta.key)) state.order.push(meta.key);
      state.active = meta.key; ok.push(state.sections[meta.key]);
    } catch (e) { fails.push(f.name + ': ' + e.message); console.error(e); }
  }
  for (const { f, gb } of deferred) { try {
    let target = await pickSection(f.name, gb);
    if (target === '__new__') target = await askNewClass(f.name, gb);
    if (!target) { skipped++; continue; }
    const sec = state.sections[target]; sec.grades = sec.grades || { assignments: [], students: [] };
    const keptNote = keepOutgoing(sec, gb);   // a file that starts a new quarter mustn't take the old quarter's scores with it
    sec.grades.students = gb.students; sec.grades.ids = gb.ids || []; sec.grades.overall = gb.overall || null; sec.grades.importedAt = new Date().toISOString(); sec.grades.file = f.name; sec.grades.raw = gb.raw || {};
    sec.grades.assignments = gb.assignments;   // whole-gradebook exports replace, so stale columns and index drift can't happen
    const cats = applyCategories(sec);
    if (cats.ask.length) await askCategories(sec, cats.ask, cats.fit);
    const qNote = quarterAfterImport(sec);
    gradeSnapshot(sec);
    // The gradebook's student column IS the Focus roster, in Focus order — use it when no roster has been pasted.
    let rosterNote = '';
    if (!rosterState(sec).count) {
      const text = gradebookRosterText(gb); let okN = 0; try { okN = buildRows({ ...sec, roster: text }).filter(r => r.status === 'ok').length; } catch (e) {}
      if (sec.pool || okN >= Math.max(3, gb.students.length / 2)) { sec.roster = text; sec.rosterAt = new Date().toISOString(); sec.skipRoster = false; rosterNote = ' · roster filled in from the gradebook'; }   // only when its names really are this class
    }
    if (sec.pool) { materialize(sec); if (!ok.includes(sec)) ok.push(sec); }
    gbImported.push({ key: sec.key, label: sec.label, text: `${plural(gb.assignments.length, 'assignment')}, ${plural(gb.students.length, 'student')}${rosterNote}${cats.proved ? ` · ${cats.proved === gb.assignments.length ? 'every category' : plural(cats.proved, 'category')} confirmed by the Focus grade column` : gb.overall ? '' : ' · no Grade column, so categories are guesses'}${keptNote}${qNote}` });
  } catch (e) { fails.push(f.name + ': ' + e.message); console.error(e); } }
  state.order.sort((a, b) => state.sections[a].label.localeCompare(state.sections[b].label, undefined, { numeric: true }));
  const workingIn = defaultWorkingIn();
  // The result stays on the Overview until the next import (one line per file, failures in red); the toast is one line.
  const poolLine = p => { const fed = state.order.map(k => state.sections[k]).filter(x => x.pool && x.prep === p.prep && !x.awaitingPool).length; return { label: p.prep === 'acc' ? 'Accelerated IXL' : 'On-level IXL', pool: p.prep, text: `${plural(p.students, 'student')}, ${plural(p.skills, 'skill')}${fed ? ` → ${plural(fed, 'class')} updated` : ' — no class uses it yet: import a Focus gradebook for each period'}` }; };
  const pools = poolImported.map(poolLine);
  const classes = ok.filter(s => !s.pool).map(s => ({ label: s.label, text: `IXL export — goal ${s.threshold}, ${plural(s.students.length, 'student')}` }));
  const lines = [...pools, ...classes, ...gbImported.map(g => ({ label: g.label, text: 'Focus gradebook — ' + g.text })), ...workingIn.map(x => ({ label: x.prep === 'acc' ? 'Accelerated' : 'On-level', text: `Working in set to Unit ${x.unit} — the latest unit Focus has an IXL column for. Change it on the class bar.` }))];
  if (lines.length || fails.length || skipped) {   // files dropped within a quarter of an hour read as one import; a newer line for the same class replaces the older
    const prev = state.lastImport && Date.now() - new Date(state.lastImport.at) < 15 * 60000 ? state.lastImport : { lines: [], fails: [], skipped: 0 };
    const fresh = lines.map(l => ({ label: String(l.label).slice(0, 80), text: String(l.text).replace(/<[^>]+>/g, '').slice(0, 300), pool: l.pool || null }));
    const kept = prev.lines.filter(l => !fresh.some(f => f.label === l.label)).map(l => { const pl = l.pool && state.pools[l.pool]; return pl ? { ...poolLine({ prep: l.pool, students: pl.students.length, skills: pl.skills.length }) } : l; });   // a course line's "N classes updated" follows the gradebooks dropped after it
    state.lastImport = { at: new Date().toISOString(), lines: [...kept, ...fresh].slice(-20), fails: [...prev.fails, ...fails.map(x => String(x).slice(0, 300))].slice(-20), skipped: (prev.skipped || 0) + skipped }; }
  // A drop that touched several classes lands on the Overview, where the result is; a single file for one class lands on
  // that class (the roster panel or the Focus badges are the next step), and a class still needing its roster always does.
  const needRoster = ok.find(s => !s.pool && !rosterState(s).count); if (needRoster) state.active = needRoster.key;
  const touched = new Set([...ok.map(s => s.key), ...gbImported.map(g => g.key)]).size;
  search = ''; $('#search').value = ''; view = (touched > 1 || pools.length) && !needRoster ? { mode: 'home', unit: null } : { mode: 'units', unit: null };
  save(); render();
  const n = lines.length - workingIn.length;   // files, not notes
  if (fails.length) toast(`${n ? `${plural(n, 'file')} imported, ` : ''}${plural(fails.length, 'file')} couldn't be read — ${esc(fails[0])}${fails.length > 1 ? ' …' : ''}`, true);
  else if (n) toast(`Imported ${plural(n, 'file')}${skipped ? ` · ${skipped} skipped` : ''}${view.mode === 'home' ? '.' : ' — details on the Overview.'}`, false, 3500);
  else if (skipped) toast('Nothing imported.', false);
}

// "Working in", when nobody has picked it: the latest unit this course's Focus gradebooks already have an IXL column for
// (review units don't count). The product can see it, so it doesn't ask — and doesn't guess from who has touched what.
function defaultWorkingIn() {
  const set = []; state.settings.currentUnit = state.settings.currentUnit || { acc: null, on: null };
  ['acc', 'on'].forEach(p => { if (state.settings.currentUnit[p]) return; let hi = 0;
    state.order.map(k => state.sections[k]).filter(s => s.prep === p && s.grades && !s.placeholder && s.skills && s.skills.length).forEach(s => { const o = openSec(s); ((o.grades && o.grades.assignments) || []).forEach(x => { const u = gbUnitFor(s, x); if (u && u.num > hi) hi = u.num; }); });
    if (hi > ((state.settings.skipFirst || {})[p] || 0)) { state.settings.currentUnit[p] = hi; resnapshotPrep(p); set.push({ prep: p, unit: hi }); } });
  return set;
}

/* ---------- history snapshots (aggregates only: per-skill counts + per-student totals) ---------- */
// The students a class is measured on: roster-matched students when a roster exists, otherwise everyone in IXL minus ignored.
function population(sec) {
  const list = ixlList(sec); const ign = sec.ignored || {};
  if (rosterState(sec).count) { const ok = new Set(buildRows(sec).filter(r => r.status === 'ok' && r.ixl != null).map(r => r.ixl)); return list.filter(x => ok.has(x.i)); }
  return list.filter(x => !ign[x.key]);
}
// Counted skills of the units that are assigned right now (the basis every "at goal" total is measured on).
function assignedIdx(sec) { const out = []; unitsOf(sec).forEach(u => { if (u.assigned) out.push(...u.active); }); return out; }
// A snapshot keeps, per student: `per` = skills at goal in the assigned units (their own list, after per-student skips),
// and `pu` = the same per unit for EVERY unit, so movement can be read on whatever units are assigned later; `ua` = how
// many skills each unit counted, so a skip made between two snapshots is detected instead of read as a drop.
// Snapshots are re-taken whenever the basis changes (skips, goal), so the newest one always reflects the grid.
function snapshot(sec) {
  if (sec.placeholder) return;
  const t = sec.threshold, per = {}, pu = {}, ua = {}; const list = ixlList(sec); const units = unitsOf(sec);
  list.forEach(x => per[x.key] = 0);
  units.forEach(u => { const m = {}; ua[u.name] = u.active.length; list.forEach((x, si) => { let n = 0; activeFor(sec, u, si).forEach(k => { const v = eff(sec, k, si); if (v != null && v >= t) n++; }); m[x.key] = n; if (u.assigned) per[x.key] += n; }); pu[u.name] = m; });
  const snap = { date: sec.date || sec.importedAt.slice(0, 10), at: sec.importedAt, thr: t, students: sec.students.length, per, pu, ua };
  sec.history = (sec.history || []).filter(h => h.date !== snap.date).map(h => ({ date: h.date, at: h.at, thr: h.thr, students: h.students, per: h.per, pu: h.pu, ua: h.ua }));
  sec.history.push(snap); sec.history.sort((a, b) => a.date.localeCompare(b.date));
  if (sec.history.length > 60) sec.history = sec.history.slice(-60);
}
// Every class of a course shares skips, so a skip re-snapshots all of them.
function resnapshotPrep(prep) { state.order.map(k => state.sections[k]).forEach(s => { if (s.prep === prep && !s.placeholder) snapshot(s); }); }
// Movement between two snapshots on the units assigned NOW. Returns per-student deltas for students in both, or a reason
// they can't be compared: 'thr' (goal changed), 'basis' (a unit's counted skills changed, or an older snapshot without
// per-unit counts). Reading both snapshots on today's assigned units means advancing "Working in" never resets the race.
// A snapshot's per-student totals on the units assigned now (older snapshots without per-unit counts fall back to their own total).
function snapTotals(sec, h) { if (!h.pu) return Object.values(h.per); const units = unitsOf(sec).filter(u => u.assigned); return Object.keys(h.per).map(key => units.reduce((a, u) => a + ((h.pu[u.name] || {})[key] || 0), 0)); }
function movement(sec, cur, prev, openOnly) {
  if (!cur || !prev) return null;
  if (prev.thr !== cur.thr) return { reason: 'thr' };
  const units = unitsOf(sec).filter(u => u.assigned && !(openOnly && unitClosed(sec, u)));
  if (!prev.pu || !cur.pu || units.some(u => !prev.pu[u.name] || !cur.pu[u.name] || (prev.ua || {})[u.name] !== (cur.ua || {})[u.name])) return { reason: 'basis' };
  const deltas = {};
  Object.keys(cur.per).forEach(key => { if (prev.per[key] == null) return; let now = 0, before = 0; units.forEach(u => { now += cur.pu[u.name][key] || 0; before += prev.pu[u.name][key] || 0; }); deltas[key] = { d: now - before, now }; });
  return { reason: null, deltas };
}
// "Assigned" is defined once per prep: the union of units no class in that prep has hidden.
function assignedUnitsForPrep(prep) {
  const names = new Set();
  state.order.map(k => state.sections[k]).filter(s => s.prep === prep && !s.placeholder).forEach(s => unitsOf(s).forEach(u => { if (u.assigned) names.add(u.name); }));
  return names;
}
function leaderboardData() {
  const out = []; const assignedByPrep = { acc: assignedUnitsForPrep('acc'), on: assignedUnitsForPrep('on') };
  // One baseline date per prep, so every class in a league is measured over the same window even when they
  // were imported on different days: the latest date on which every class (that has any earlier snapshot)
  // already had one. Each class then compares its newest snapshot with its latest snapshot on or before that date.
  const baseline = {};
  ['acc', 'on'].forEach(prep => {
    const dates = state.order.map(k => state.sections[k]).filter(s => s.prep === prep && !s.placeholder && s.history && s.history.length > 1)
      .map(s => { const cur = s.history[s.history.length - 1]; const prev = s.history.filter(h => h.date < cur.date).pop(); return prev ? prev.date : null; }).filter(Boolean);
    baseline[prep] = dates.length ? dates.sort()[0] : null;
  });
  for (const k of state.order) {
    const s = state.sections[k]; if (s.placeholder || !s.students.length) continue;
    const units = unitsOf(s); const t = s.threshold;
    const list = population(s); const n = list.length; if (!n) continue;
    const aUnits = units.filter(u => assignedByPrep[s.prep].has(u.name));
    let done = 0, possible = 0;
    aUnits.forEach(u => list.forEach(x => { const own = activeFor(s, u, x.i); possible += own.length; own.forEach(kk => { const v = eff(s, kk, x.i); if (v != null && v >= t) done++; }); }));
    const masteredAll = done;   // skills at goal on the assigned units (the same basis as "% complete")
    const cur = s.history[s.history.length - 1];
    const prev = cur && baseline[s.prep] ? s.history.filter(h => h.date <= baseline[s.prep] && h.date < cur.date).pop() : null;
    let gain = null, active = null, movers = 0, measured = 0, thrChanged = false, basisChanged = false;
    const mv = movement(s, cur, prev);
    if (mv && mv.reason === 'thr') thrChanged = true;
    else if (mv && mv.reason === 'basis') basisChanged = true;
    else if (mv) { let g = 0, a = 0, m = 0; list.forEach(x => { const e = mv.deltas[x.key]; if (!e) return; m++; g += e.d; if (e.d > 0) a++; }); if (m) { gain = g / m; active = a / m; movers = a; measured = m; } }
    out.push({ key: k, prep: s.prep, name: s.label, label: s.label, students: n, assignedUnits: aUnits.map(u => u.short), assignedSkills: aUnits.reduce((a, u) => a + u.active.length, 0), done, possible, doneEach: done / n,
      completion: possible ? done / possible : 0, masteredAll, gain, active, movers, measured, thrChanged, basisChanged, prevDate: prev ? prev.date : null, date: s.date });
  }
  // The race is MOVEMENT: the share of the class that reached at least one more skill since the league's baseline,
  // with average skills gained as the tiebreak and completion after that. Reaching the goal and stopping earns nothing
  // next week, a class that starts behind can win, and one student can't swing it. Competition ranking (1, 1, 3) on ties.
  // Classes with no baseline yet (first week, or the goal changed) rank by completion below the classes with movement.
  // The furthest-along class in each league is tagged so steady progress is still seen.
  ['acc', 'on'].forEach(p => {
    const rows = out.filter(r => r.prep === p); if (!rows.length) return;
    const rd = x => Math.round(x * 100), r10 = x => Math.round((x || 0) * 10);
    const key = r => r.active == null ? [-1, 0, rd(r.completion)] : [rd(r.active), r10(r.gain), rd(r.completion)];
    const cmp = (a, b) => { const ka = key(a), kb = key(b); for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]; return 0; };
    rows.sort(cmp);
    rows.forEach(r => { r.rank = 1 + rows.filter(x => cmp(x, r) < 0).length; r.tied = rows.some(x => x !== r && cmp(x, r) === 0); r.lead = false; });
    if (rows.length > 1) { const top = Math.max(...rows.map(r => rd(r.completion))); if (top > 0) rows.forEach(r => { if (rd(r.completion) === top) r.lead = true; }); }
  });
  out.sort((a, b) => (a.prep > b.prep ? 1 : a.prep < b.prep ? -1 : 0) || a.rank - b.rank);
  return out;
}
const fmtDate = d => { if (!d) return ''; const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
const fmtTime = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
// Age of a yyyy-mm-dd date (or ISO stamp) in whole days, as of today — local calendar days, so "yesterday" is right at 8 am.
const ageDays = d => { if (!d) return null; const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number); const then = new Date(y, m - 1, dd); const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); return Math.max(0, Math.round((today - then) / 86400000)); };
const ageText = d => { const n = ageDays(d); if (n == null) return ''; if (n === 0) return 'today'; if (n === 1) return 'yesterday'; if (n < 14) return n + ' days ago'; if (n < 60) return Math.round(n / 7) + ' weeks ago'; return Math.round(n / 30) + ' months ago'; };
// The date a class's IXL data is from: the export date in the file name, else the day it was imported.
const dataDate = s => s.date || (s.importedAt ? s.importedAt.slice(0, 10) : null);
const REMIND = [0, 7, 14, 30];
function overdue(s) { const r = state.settings.remindDays; if (!r) return null; const n = ageDays(dataDate(s)); return n != null && n > r ? n : null; }
function lbMarkup(data, focus) {
  if (focus === 'acc' || focus === 'on') data = data.filter(r => r.prep === focus);
  if (!data.length) return `<div class="lbEmpty">Import at least one class to start the race.</div>`;
  const pct = x => Math.round(x * 100);
  const asOf = data.map(r => r.date).filter(Boolean).sort().pop();
  const signed = x => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(1);
  // "% of class moved up" is the headline, but a 1- or 2-student remainder would point at those students, so the
  // number is shown only when everyone moved or at least three didn't; otherwise it reads "nearly all".
  const headline = r => {
    if (r.active == null) return `${pct(r.completion)}<small>% complete</small>`;
    const rest = r.measured - r.movers;
    if (r.active === 1) return `100<small>% moved up</small>`;
    if (rest < 3 && r.movers > 0) return `<span class="lbWord">nearly all</span><small>moved up</small>`;
    return `${pct(r.active)}<small>% moved up</small>`;
  };
  const card = (r, showTrophy) => `<div class="lbCard r${Math.min(r.rank, 3)}" style="--cc:${classColor(state.sections[r.key])}">
      <div class="lbRank">${showTrophy ? '<svg class="trophy" viewBox="0 0 24 24" aria-label="first place"><path d="M7 3h10v3a5 5 0 0 1-10 0V3z"/><path d="M17 5h3v2a4 4 0 0 1-4 4M7 5H4v2a4 4 0 0 0 4 4"/><path d="M12 11v4M8 21h8M9 21v-3h6v3"/></svg>' : r.rank}</div>
      <div class="lbMain">
        <div class="lbName">${esc(r.name)}${r.tied ? ' <span class="lbTie">tied</span>' : ''}${r.lead ? ' <span class="lbTie lead">furthest along</span>' : ''}</div>
        <div class="lbBarWrap"><div class="lbBar" style="--w:${pct(r.completion)}%"></div></div>
        <div class="lbChips">
          <span class="lbChip">${pct(r.completion)}% complete · ${r.done.toLocaleString()} of ${r.possible.toLocaleString()} skill-points · ${plural(r.students, 'student')}</span>
          ${r.thrChanged ? `<span class="lbChip">goal changed — fresh start this week</span>` : r.basisChanged ? `<span class="lbChip">skills counted changed — fresh start this week</span>` : r.gain != null ? `<span class="lbChip gain">${signed(r.gain)} skills per student since ${fmtDate(r.prevDate)}</span>` : `<span class="lbChip">first week in the race</span>`}
        </div>
      </div>
      <div class="lbPct">${headline(r)}</div>
    </div>`;
  const leagues = [['acc', 'Accelerated'], ['on', 'On-level']].map(([p, name]) => ({ p, name, rows: data.filter(r => r.prep === p) })).filter(l => l.rows.length);
  const multi = leagues.length > 1;
  const league = l => {
    const clear = l.rows.length > 1 && !l.rows[0].tied;
    const au = l.rows[0].assignedUnits;
    return `<section class="lbLeague">${multi ? `<div class="lbLeagueHead"><span class="lbLeagueName">${l.name}</span><span class="lbBasis">${au.length ? 'assigned: ' + esc(au.length > 3 && /^Unit \d+$/.test(au[0]) ? au[0] + ' – ' + au[au.length - 1] : au.join(', ')) : 'nothing assigned yet'}</span></div>` : ''}
      <div class="lbList">${l.rows.map(r => card(r, clear && r.rank === 1)).join('')}</div>
    </section>`;
  };
  const one = !multi && leagues[0] ? leagues[0].rows[0].assignedUnits : null;
  return `<div class="lbHead"><div class="lbTitle">Race</div><div class="lbSub">Ranked by the share of each class that moved up this week${one ? (one.length ? ' · ' + esc(one.join(', ')) : ' · nothing assigned yet') : ''}${asOf ? ' · ' + fmtDate(asOf) : ''}</div></div>
    <div class="lbLeagues ${multi ? 'two' : ''}">${leagues.map(league).join('')}</div>`;
}
const LB_CSS = `
.lbCard{border-left:8px solid var(--cc,transparent)}.labRow{border-left:8px solid var(--cc,transparent)}
.lbWrap{min-height:100%;display:flex;flex-direction:column;gap:16px;padding:20px 28px 96px;max-width:1500px;margin:0 auto;width:100%}
.lbHead{display:flex;align-items:baseline;gap:18px;flex-wrap:wrap}
.lbTitle{font-weight:900;font-size:clamp(34px,4.2vw,58px);letter-spacing:.02em;color:var(--navy)}
.lbSub{font-weight:700;color:var(--teal);font-size:clamp(14px,1.5vw,20px)}
.lbList{display:flex;flex-direction:column;gap:14px}
.lbCard{display:grid;grid-template-columns:72px 1fr auto;gap:18px;align-items:center;background:var(--white);border-radius:20px;box-shadow:var(--shadow-2);padding:16px 26px 16px 18px}
.lbCard.r1{background:var(--white);box-shadow:0 0 0 3px var(--turq),var(--shadow-2)} .lbCard.r2{background:var(--paleturq)}
.lbRank{font-weight:900;font-size:clamp(30px,3.4vw,46px);text-align:center;color:var(--navy)}
.lbName{font-weight:900;font-size:clamp(22px,2.6vw,36px);line-height:1.1;color:var(--navy);margin-bottom:8px;overflow-wrap:anywhere}
.lbBarWrap{height:16px;border-radius:999px;background:rgba(22,33,58,.12);overflow:hidden}
.lbCard.r1 .lbBarWrap{background:rgba(255,255,255,.55)}
.lbBar{height:100%;width:0;border-radius:999px;background:var(--navy);animation:lbGrow 1.2s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes lbGrow{to{width:var(--w)}}
.lbChips{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.lbChip{background:rgba(255,255,255,.7);color:var(--navy);border-radius:999px;font-weight:700;font-size:clamp(12px,1.2vw,15px);padding:4px 12px}
.lbCard.r3 .lbChip{background:var(--paleturq)}
.lbChip.gain{background:var(--navy);color:var(--turq)}
.lbPct{font-weight:900;font-size:clamp(40px,5vw,72px);line-height:1;color:var(--navy);font-variant-numeric:tabular-nums}
.lbPct small{font-size:.45em;font-weight:900;opacity:.7}
.lbTie{display:inline-block;vertical-align:middle;font-size:.45em;font-weight:900;letter-spacing:.08em;text-transform:uppercase;background:var(--paleturq);color:var(--teal);border-radius:999px;padding:3px 10px;margin-left:8px}
.lbBasis{font-weight:700;color:var(--teal);font-size:clamp(12px,1.2vw,15px)}
.lbTie.lead{background:var(--navy);color:var(--turq)}
.lbWord{font-size:.5em;letter-spacing:.01em}
.trophy{width:1em;height:1em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;display:block;margin:0 auto}
.lbFoot{display:flex;gap:14px;flex-wrap:wrap;margin-top:6px}
.lbStat{background:var(--navy);color:var(--white);border-radius:999px;padding:10px 20px;font-weight:700;font-size:clamp(14px,1.4vw,18px)}
.lbStat b{color:var(--turq);font-weight:900}
.lbStat.mover{background:var(--sand);color:var(--navy)} .lbStat.mover b{color:var(--navy)}
.lbEmpty{padding:60px;text-align:center;font-weight:700;color:var(--teal);font-size:20px}
.lbLeagues{display:flex;flex-direction:column;gap:18px}
.lbLeagues.two{display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:start}
.lbLeague{display:flex;flex-direction:column;gap:12px}
.lbLeagueHead{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.lbLeagueName{font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--white);background:var(--teal);border-radius:999px;padding:6px 16px;font-size:clamp(13px,1.3vw,17px)}
.lbLeagueMover{font-weight:700;color:var(--navy);background:var(--sand);border-radius:999px;padding:6px 14px;font-size:clamp(12px,1.2vw,15px)}
.lbLeagueMover b{font-weight:900}
.lbLeagues.two .lbCard{grid-template-columns:52px 1fr auto;padding:14px 18px 14px 12px;gap:12px}
.lbLeagues.two .lbName{font-size:clamp(18px,2vw,28px)}
.lbLeagues.two .lbPct{font-size:clamp(30px,3.4vw,48px)}
.lbPct small{display:block;font-size:.28em;letter-spacing:.04em;text-transform:uppercase;opacity:.75;text-align:right}
@media (max-width:1000px){.lbLeagues.two{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.lbBar{animation:none;width:var(--w)}}
@media (max-width:700px){.lbCard{grid-template-columns:48px 1fr;padding:14px}.lbPct{grid-column:2;justify-self:end}}
`;

/* ---------- Data Lab: anonymous class distributions (box plots, dot plots, five-number summaries) ---------- */
function stats(vals) {
  const v = vals.filter(x => x != null).map(Number).filter(Number.isFinite).sort((a, b) => a - b); const n = v.length;
  if (!n) return null;
  const med = a => { const m = a.length; return m % 2 ? a[(m - 1) / 2] : (a[m / 2 - 1] + a[m / 2]) / 2; };
  const half = Math.floor(n / 2);
  const lower = v.slice(0, half), upper = v.slice(n % 2 ? half + 1 : half);   // middle value excluded when n is odd (the middle-school method)
  const q1 = n > 1 ? med(lower) : v[0], q3 = n > 1 ? med(upper) : v[0], median = med(v);
  const iqr = q3 - q1, lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const mad = v.reduce((a, b) => a + Math.abs(b - mean), 0) / n;
  // With an IQR of 0 or 1 (scores bunched on a few values) the 1.5 × IQR fences sit on top of the box and would flag
  // a third of the class, so the rule is switched off: no outliers, whiskers run min to max, and the row says why.
  const bunched = iqr <= 1;
  const outliers = bunched ? [] : v.filter(x => x < lo || x > hi); const inside = bunched ? v : v.filter(x => x >= lo && x <= hi);
  const wLo = inside.length ? inside[0] : v[0], wHi = inside.length ? inside[inside.length - 1] : v[n - 1];
  // shape: the mean-vs-median rule first, then pile-ups and gaps read from the picture
  const counts = {}; v.forEach(x => counts[x] = (counts[x] || 0) + 1);
  const modeCount = Math.max(...Object.values(counts)); const modes = Object.keys(counts).filter(k => counts[k] === modeCount).map(Number);
  const range = v[n - 1] - v[0]; const lTail = q1 - v[0], rTail = v[n - 1] - q3;
  const parts = [];
  if (range === 0) parts.push('every value is the same');
  else {
    // Shape follows the rule 7th graders learn — mean above the median → skewed right, below → skewed left, about the
    // same → roughly symmetric — with the tails as the picture clue, and an honest note when the two disagree.
    const tail = rTail > 1.5 * lTail + 0.5 ? 'right' : lTail > 1.5 * rTail + 0.5 ? 'left' : 'even';
    const diff = mean - median; const tol = Math.max(0.25, range * 0.04);
    const rule = Math.abs(diff) <= tol ? 'even' : diff > 0 ? 'right' : 'left';
    let gap = 0, gapAt = null; for (let i = 1; i < n; i++) { const g = v[i] - v[i - 1]; if (g > gap) { gap = g; gapAt = [v[i - 1], v[i]]; } }
    const clusters = gap >= Math.max(range * 0.25, 2) && v.filter(x => x <= gapAt[0]).length >= 2 && v.filter(x => x >= gapAt[1]).length >= 2;
    // two clusters make "skewed" the wrong word — say what the picture shows and where the mean sits instead
    if (clusters) parts.push(`two clusters with a gap between ${gapAt[0]} and ${gapAt[1]} · mean ${rule === 'even' ? '≈' : rule === 'right' ? 'above' : 'below'} median`);
    else if (rule === 'even') parts.push(tail === 'even' ? 'roughly symmetric (mean ≈ median, tails about even)' : `roughly symmetric by the rule (mean ≈ median), though the ${tail} tail is longer`);
    else parts.push(`skewed ${rule} (mean ${rule === 'right' ? 'above' : 'below'} median${tail === rule ? `, longer tail to the ${rule}` : tail === 'even' ? '; tails look about even' : `; the picture's longer tail is to the ${tail}`})`);
    if (modeCount / n >= 0.4 && modes.length === 1) parts.push(modes[0] === v[n - 1] ? 'a pile-up at the top' : modes[0] === v[0] ? 'a pile-up at the bottom' : 'a big cluster at ' + modes[0]);
  }
  const shape = parts.join(' · ');
  return { n, min: v[0], max: v[n - 1], q1, median, q3, iqr, bunched, mean, mad, range, outliers, wLo, wHi, shape, mode: modes.length === n ? null : modes, modeCount, values: v };
}
function labDatasets(prep) {
  const secs = state.order.map(k => state.sections[k]).filter(s => s.prep === prep && !s.placeholder && s.students.length);
  const groups = [];
  const add = (group, id, label) => { let g = groups.find(x => x.group === group); if (!g) { g = { group, items: [] }; groups.push(g); } if (!g.items.some(x => x.id === id)) g.items.push({ id, label }); };
  secs.forEach(s => unitsOf(s).forEach(u => { if (!u.hidden && u.total) add('IXL units (points)', 'unit:' + u.name, u.short + (u.title ? ' · ' + u.title : '')); }));
  add('IXL units (points)', 'unit:__all__', 'All assigned units · skills at goal');
  secs.forEach(s => { const cats = {}; (s.grades ? s.grades.assignments : []).forEach(a => { cats[catOf(s.prep, a.name, a)] = 1; }); Object.keys(cats).sort().forEach(c => (s.grades.assignments.filter(a => catOf(s.prep, a.name, a) === c)).forEach(a => add(c, 'gb:' + a.name, a.name))); });
  state.custom.filter(c => c.prep === prep).forEach(c => add('Our own data', 'custom:' + c.id, c.label));
  secs.forEach(s => unitsOf(s).forEach(u => { if (!u.hidden) u.idx.forEach(k => { const sk = s.skills[k]; add('IXL skills (SmartScore) — ' + u.short, 'skill:' + skillKey(sk), u.short + ' · ' + sk.name); }); }));
  const list = groups.flatMap(g => g.items);
  return { secs, list, groups };
}
function labSeries(prep, id) {
  const { secs } = labDatasets(prep);
  return secs.map(s => {
    const list = population(s); const aUnits = unitsOf(s).filter(u => u.assigned);
    let vals, max, missing = 0, excused = 0, unit = 'points';
    if (id === 'unit:__all__') { vals = list.map(x => aUnits.reduce((m, u) => m + points(s, u, x.i), 0)); max = aUnits.reduce((m, u) => m + u.total, 0); unit = 'skills at goal'; }
    else if (id.startsWith('unit:')) { const u = unitsOf(s).find(u => u.name === id.slice(5)); if (!u) return null; vals = list.map(x => points(s, u, x.i)); max = u.total; }
    else if (id.startsWith('skill:')) { const k = s.skills.findIndex(sk => skillKey(sk) === id.slice(6)); if (k < 0) return null; vals = list.map(x => eff(s, k, x.i)); missing = vals.filter(v => v == null).length; max = 100; unit = 'SmartScore'; }
    else if (id.startsWith('custom:')) { const c = state.custom.find(c => c.id === id.slice(7)); const vv = c && c.values[s.key]; if (!vv || !vv.length) return null; vals = vv.slice(); max = Math.max(...vv, 1); unit = c.unit || 'value'; }
    else if (id.startsWith('gb:')) { const a = s.grades && s.grades.assignments.find(a => a.name === id.slice(3)); if (!a) return null; vals = a.values; missing = a.missing; excused = a.excused || 0; max = a.max || Math.max(...vals.filter(v => v != null), 1); unit = a.percent ? 'percent' : a.max ? 'points out of ' + a.max : 'score'; }
    else return null;
    let pct = false;
    if (state.settings.labPct && max > 0 && unit !== 'SmartScore') { vals = vals.map(v => v == null ? null : Math.round(v / max * 100)); unit = '% of ' + unit; max = 100; pct = true; }   // percent of the maximum, whole numbers
    const st = stats(vals) || { n: 0 };
    return { name: s.team || s.label, st, max, missing, excused, unit, total: vals.length, kind: id.split(':')[0], values: vals, thr: s.threshold, sec: s, pct };
  }).filter(Boolean);
}
const fmtN = x => Number.isInteger(x) ? String(x) : x.toFixed(1);
function boxSVG(st, scale, w, o) {
  const U = o.pct ? '%' : '';
  // horizontal box plot above an optional dot plot, on a shared scale
  const L = 14, R = 30, X = v => L + (w - L - R) * (scale ? v / scale : 0);
  const counts = {}; st.values.forEach(v => counts[v] = (counts[v] || 0) + 1);
  const maxStack = Math.max(1, ...Object.values(counts));
  const spacing = (w - L - R) / Math.max(scale, 1);
  let r = Math.min(5, Math.max(2.5, spacing / 2.2)); let rowH = r * 2 + 1;
  if (o.dots && maxStack * rowH > 150) { rowH = 150 / maxStack; r = Math.max(1.5, rowH / 2 - 0.5); }
  const boxY = 26, bh = 34, dotsTop = boxY + bh + 24, dotsH = o.dots ? maxStack * rowH + 4 : 0, axisY = dotsTop + dotsH + 16, H = axisY + 6;
  const dotBase = dotsTop + dotsH - r - 2;
  let h = `<svg class="labSvg" viewBox="0 0 ${w} ${H}" role="img" aria-label="Box plot${o.dots ? ' and dot plot' : ''}">`;
  const step = scale > 40 ? 10 : scale > 16 ? 5 : scale > 8 ? 2 : 1;
  const ticks = []; for (let t = 0; t < scale; t += step) ticks.push(t); ticks.push(scale);
  if (ticks.length > 1 && (scale - ticks[ticks.length - 2]) * spacing < 22) ticks.splice(ticks.length - 2, 1);
  ticks.forEach(t => { h += `<line x1="${X(t)}" y1="8" x2="${X(t)}" y2="${axisY - 12}" class="labTick"/><text x="${X(t)}" y="${axisY}" class="labTickTxt">${t}</text>`; });
  const mid = boxY + bh / 2;
  const wLo = o.tukey ? st.wLo : st.min, wHi = o.tukey ? st.wHi : st.max;
  h += `<line x1="${X(wLo)}" y1="${mid}" x2="${X(st.q1)}" y2="${mid}" class="labWhisk"/><line x1="${X(st.q3)}" y1="${mid}" x2="${X(wHi)}" y2="${mid}" class="labWhisk"/>`;
  h += `<line x1="${X(wLo)}" y1="${boxY + 6}" x2="${X(wLo)}" y2="${boxY + bh - 6}" class="labWhisk"/><line x1="${X(wHi)}" y1="${boxY + 6}" x2="${X(wHi)}" y2="${boxY + bh - 6}" class="labWhisk"/>`;
  h += `<rect x="${X(st.q1)}" y="${boxY}" width="${Math.max(X(st.q3) - X(st.q1), 2)}" height="${bh}" rx="4" class="labBox"><title>Q1 ${fmtN(st.q1)}${U} · median ${fmtN(st.median)}${U} · Q3 ${fmtN(st.q3)}${U} · IQR ${fmtN(st.iqr)}${U}</title></rect>`;
  h += `<line x1="${X(st.median)}" y1="${boxY}" x2="${X(st.median)}" y2="${boxY + bh}" class="labMed"><title>Median ${fmtN(st.median)}${U}</title></line>`;
  if (o.mean) h += `<line x1="${X(st.mean)}" y1="${mid}" x2="${X(st.mean)}" y2="${axisY - 12}" class="labMeanLine"/><g transform="translate(${X(st.mean)},${mid}) rotate(45)"><rect x="-6" y="-6" width="12" height="12" class="labMean"><title>Mean ${st.mean.toFixed(1)}</title></rect></g>`;
  if (o.tukey) st.outliers.forEach(o2 => { h += `<circle cx="${X(o2)}" cy="${mid}" r="6" class="labOut"><title>Outlier ${fmtN(o2)}${U}</title></circle>`; });
  if (o.dots) Object.entries(counts).forEach(([v, c]) => { for (let i = 0; i < c; i++) h += `<circle cx="${X(+v)}" cy="${dotBase - i * rowH}" r="${r}" class="labDot"><title>${fmtN(+v)} · ${c} student${c > 1 ? 's' : ''}</title></circle>`; });
  if (o.stats) h += `<text x="${X(st.median)}" y="${boxY - 7}" class="labLbl mid">median ${fmtN(st.median)}${U}</text><text x="${X(st.q1) - 4}" y="${boxY + bh + 15}" class="labLbl end">Q1 ${fmtN(st.q1)}${U}</text><text x="${X(st.q3) + 4}" y="${boxY + bh + 15}" class="labLbl">Q3 ${fmtN(st.q3)}${U}</text>`;
  return h + `</svg>`;
}
const MIN_N = 5;
// The sorted values, split the way students find quartiles by hand: lower half · (middle value) · upper half,
// with the median of each half highlighted. Outliers get a ring when the outlier rule is on.
function valuesMarkup(st, tukey, pct) {
  const v = st.values, n = v.length, half = Math.floor(n / 2);
  const lower = v.slice(0, half), mid = n % 2 ? [v[half]] : [], upper = v.slice(n % 2 ? half + 1 : half);
  const medIdx = a => { const m = a.length; return m % 2 ? [(m - 1) / 2] : [m / 2 - 1, m / 2]; };
  const chip = (x, cls) => `<span class="${cls}${tukey && st.outliers.includes(x) ? ' out' : ''}">${fmtN(x)}${pct ? '%' : ''}</span>`;
  const group = (arr, cls, label) => arr.length ? `<div class="labHalf"><div class="labChips">${arr.map((x, i) => chip(x, medIdx(arr).includes(i) ? 'q' : '')).join('')}</div><small>${label}</small></div>` : '';
  return `<div class="labValues">
    ${group(lower, 'q', `lower half · median = Q1 = ${fmtN(st.q1)}`)}
    ${mid.length ? `<div class="labHalf mid"><div class="labChips">${chip(mid[0], 'm')}</div><small>middle value = median</small></div>` : `<div class="labHalf mid"><div class="labChips"><span class="m gap">${fmtN(st.median)}</span></div><small>median = mean of the two middle values</small></div>`}
    ${group(upper, 'q', `upper half · median = Q3 = ${fmtN(st.q3)}`)}
  </div>`;
}
// One class's plot in the chosen form. Box plots keep their own drawing (whiskers, outliers, dots); the rest use charts.js.
function labPlot(kind, x, scale, id, o) {
  const vals = x.values.filter(v => v != null); const max = Math.max(scale, 1);
  if (x.kind === 'gb' && !['box', 'hist', 'circle', 'line'].includes(kind)) return `<div class="labNotYet">Focus scores are shown as a box plot, histogram, circle graph or line graph only.</div>`;
  if (kind === 'dots') return chartDots(vals, max);
  if (kind === 'hist') return chartHist(vals, max, o.bin || 0);
  if (kind === 'stem') return chartStem(vals, max);
  if (kind === 'bar') return chartFreq(vals, max);
  if (kind === 'circle') {
    if (x.kind === 'skill') { const at = vals.filter(v => v >= x.thr).length, below = vals.length - at; return chartCircle([{ label: 'At goal (' + x.thr + '+)', value: at, color: QUARTER_COLORS[3] }, { label: 'Below goal', value: below, color: QUARTER_COLORS[1] }, { label: 'Not started', value: x.missing, color: 'var(--grid)' }]); }
    if (x.kind === 'gb' && x.max) { const b = { A: 0, B: 0, C: 0, D: 0, F: 0 }; vals.forEach(v => b[letterOf(Math.round(v / x.max * 100))]++); return chartCircle(['A', 'B', 'C', 'D', 'F'].map((k, i) => ({ label: k, value: b[k], color: LETTER_COLORS[k] }))); }
    const q = [0, 0, 0, 0]; vals.forEach(v => q[Math.min(3, Math.floor(v / (x.max || 1) * 4))]++); const m = x.max || 1;
    if (x.pct) return chartCircle([0, 1, 2, 3].map(i => ({ label: ['Under 25%', '25–49%', '50–74%', '75–100%'][i], value: q[i], color: QUARTER_COLORS[i] })));
    // Quarter i holds whole-number scores from ceil(m·i/4) up to the next quarter's start, so no score sits in two ranges.
    const edge = i => Math.ceil(m * i / 4); const rng = i => { const lo = edge(i), hi = i === 3 ? m : edge(i + 1) - 1; return hi < lo ? 'no whole score' : lo === hi ? `${lo}` : `${lo}–${hi}`; };
    return chartCircle([0, 1, 2, 3].map(i => ({ label: `${['Under a quarter', 'A quarter to half', 'Half to three quarters', 'Three quarters or more'][i]} (${rng(i)} of ${m})`, value: q[i], color: QUARTER_COLORS[i] })));
  }
  return boxSVG(x.st, scale, 800, o);
}
const LAB_KINDS = [['box', 'Box plot'], ['dots', 'Dot plot'], ['hist', 'Histogram'], ['stem', 'Stem-and-leaf'], ['bar', 'Bar graph'], ['circle', 'Circle graph'], ['line', 'Line graph']];
function labMarkup(prep, unitName, statsLevel, tukey, dotsOn, valuesOn) {
  statsLevel = +statsLevel || 0; const kind = state.settings.labKind || 'box';
  const { list, secs } = labDatasets(prep);
  if (!secs.length) return `<div class="lbEmpty">No ${prep === 'acc' ? 'accelerated' : 'on-level'} classes imported yet.</div>`;
  if (!list.some(d => d.id === unitName)) unitName = list[0].id;
  const ds = list.find(d => d.id === unitName);
  const seriesAll = labSeries(prep, unitName);
  const series = seriesAll.filter(x => x.st.n >= MIN_N), thin = seriesAll.filter(x => x.st.n < MIN_N);
  // Focus scores on the projected screen stay aggregate: no per-student values, no outlier marks, bins of at least 5, no excused counts.
  const gbSet = unitName.startsWith('gb:'); if (gbSet) { valuesOn = false; tukey = false; }
  if (kind === 'line') {   // every class on one chart — the comparison is the point
    const asOfL = secs.map(s => s.date).filter(Boolean).sort().pop(); let body = '';
    if (unitName === 'unit:__all__') { const dates = [...new Set(series.flatMap(x => (x.sec.history || []).map(h => h.date)))].sort(); if (dates.length < 2) body = '<div class="labNotYet">Needs at least two imports on different days.</div>'; else body = chartLines(dates.map(fmtDate), series.map(x => ({ name: x.name, color: classColor(x.sec), values: dates.map(d => { const h = (x.sec.history || []).find(h => h.date === d); if (!h) return null; const v = snapTotals(x.sec, h); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }) })), { aria: 'class average of skills at goal by import', h: 300, w: 900, labelW: 200 }); }
    else if (unitName.startsWith('gb:')) { const nm = unitName.slice(3); const dates = [...new Set(series.flatMap(x => (x.sec.gradeHistory || []).filter(z => z.assignments.some(a => a.name === nm)).map(z => z.date)))].sort(); if (dates.length < 2) body = '<div class="labNotYet">Needs this assignment in at least two gradebook imports on different days.</div>'; else body = chartLines(dates.map(fmtDate), series.map(x => ({ name: x.name, color: classColor(x.sec), values: dates.map(d => { const z = (x.sec.gradeHistory || []).find(z => z.date === d); const a = z && z.assignments.find(a => a.name === nm); return a ? a.avg : null; }) })), { pct: true, min: 0, max: 100, h: 300, w: 900, labelW: 200, aria: 'class average on this assignment by import' }); }
    else body = '<div class="labNotYet">A line graph needs data over time — pick <b>All units · skills at goal</b> or a Focus assignment.</div>';
    return `<div class="lbHead"><div class="lbTitle">Data Lab</div><div class="lbSub">${esc(list.find(d => d.id === unitName).label)} · class average by import · ${prep === 'acc' ? 'accelerated' : 'on-level'} classes${asOfL ? ' · ' + fmtDate(asOfL) : ''}</div></div>
      <div class="labLegend"><span class="lgNote">Line graph · one line per class · class average by import date</span></div><div class="labRows"><div class="labRow one"><div class="labPlot">${body}</div></div></div>`;
  }
  let scale = Math.max(...series.map(x => x.max), 1);
  if (seriesAll[0] && seriesAll[0].pct) scale = 100;
  else if (unitName === 'unit:__all__' || series.some(x => x.st.max > x.max)) { const top = Math.max(...series.map(x => Math.max(x.st.max, unitName === 'unit:__all__' ? 0 : x.max)), 1); const step = top > 100 ? 20 : top > 40 ? 10 : 5; scale = Math.ceil((top + 1) / step) * step; }
  const unitLabel = seriesAll.length ? seriesAll[0].unit : 'points';
  const asOf = secs.map(s => s.date).filter(Boolean).sort().pop();
  const cell = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
  const row = x => { const fp = v => fmtN(v) + (x.pct ? '%' : ''); return `<div class="labRow" style="--cc:${classColor(x.sec)}">
      <div class="labName">${esc(x.name)}<small><b>n = ${x.st.n}</b>${x.missing ? ` · ${x.missing} ${unitLabel === 'SmartScore' ? 'not started' : 'no score'}` : ''}${x.excused && !gbSet ? ` · ${x.excused} excused` : ''}</small></div>
      <div class="labPlot">${labPlot(kind, x, scale, unitName, { stats: statsLevel > 0, tukey, dots: dotsOn, mean: statsLevel > 1, bin: gbSet ? Math.max(5, state.settings.labBin || 5) : state.settings.labBin, pct: x.pct })}</div>
      ${valuesOn ? valuesMarkup(x.st, tukey, x.pct) : ''}
      ${statsLevel > 0 ? `<div class="labStats">
        ${cell('min', fp(x.st.min))}${cell('Q1', fp(x.st.q1))}${cell('median', fp(x.st.median))}${cell('Q3', fp(x.st.q3))}${cell('max', fp(x.st.max))}${cell('range', fp(x.st.range))}${cell('IQR', fp(x.st.iqr))}${cell('mode', x.st.mode ? x.st.mode.map(fp).join(', ') : 'none')}
        ${statsLevel > 1 ? `${cell('mean', x.st.mean.toFixed(1) + (x.pct ? '%' : ''))}${cell('MAD', x.st.mad.toFixed(1) + (x.pct ? '%' : ''))}<div class="wide"><span>shape</span><b>${x.st.shape}</b></div>${tukey ? `<div class="wide"><span>outliers (1.5 × IQR)</span><b>${x.st.bunched ? `IQR is ${fmtN(x.st.iqr)} — too tight for the 1.5 × IQR rule, so none are marked (whiskers run min to max)` : x.st.outliers.length ? [...new Set(x.st.outliers)].map(v => { const c = x.st.outliers.filter(y => y === v).length; return fmtN(v) + (c > 1 ? ' ×' + c : ''); }).join(', ') : 'none'}</b></div>` : ''}` : ''}
      </div>` : ''}
    </div>`; };
  const thinRow = x => `<div class="labRow thin" style="--cc:${classColor(x.sec)}"><div class="labName">${esc(x.name)}<small>n = ${x.st.n || 0}</small></div><div class="labPlot"><div class="labNotYet">Not enough students yet (needs ${MIN_N})</div></div></div>`;
  return `<div class="lbHead"><div class="lbTitle">Data Lab</div><div class="lbSub">${esc(ds.label)} · ${esc(unitLabel)} per student${seriesAll[0] && seriesAll[0].pct ? ' (rounded to whole percents)' : ''} · ${prep === 'acc' ? 'accelerated' : 'on-level'} classes${asOf ? ' · ' + fmtDate(asOf) : ''}</div></div>
    ${kind !== 'box' ? `<div class="labLegend"><span class="lgNote">${esc(LAB_KINDS.find(k => k[0] === kind)[1])} · one row per class · ${kind === 'hist' ? 'bars count students in each range' : kind === 'dots' ? 'one dot per student' : kind === 'stem' ? 'each leaf is one student' : kind === 'bar' ? (scale > 26 ? 'bar height = how many students in each range (values grouped — too many for one bar each)' : 'bar height = how many students got that value') : kind === 'circle' ? 'share of the class in each slice' : 'class average by import date'}</span></div>` : `<div class="labLegend"><span><i class="lgBox"></i>middle 50% (Q1–Q3)</span><span><i class="lgMed"></i>median</span>${statsLevel > 1 ? '<span><i class="lgMean"></i>mean</span>' : ''}${tukey ? '<span><i class="lgOut"></i>outlier (past 1.5 × IQR)</span><span class="lgNote">whiskers stop at the last value inside 1.5 × IQR</span>' : '<span class="lgNote">whiskers: minimum to maximum</span>'}${dotsOn ? '<span><i class="lgDot"></i>one student</span>' : ''}</div>`}
    <div class="labRows">${series.map(row).join('')}${thin.map(thinRow).join('')}${!seriesAll.length ? '<div class="lbEmpty">No class in this prep has data for that yet.</div>' : ''}</div>
    ${statsLevel === 0 && series.length > 1 ? '<div class="labHint">Stats are hidden — read the plots first. Which class has the higher median? The bigger spread?</div>' : ''}`;
}
const LAB_CSS = CHART_CSS + `
.labLegend{display:flex;gap:16px;flex-wrap:wrap;font-weight:700;font-size:clamp(12px,1.2vw,15px);color:var(--navy)}
.labLegend i{display:inline-block;width:16px;height:12px;vertical-align:-1px;margin-right:6px;border-radius:3px}
.lgNote{color:var(--teal)}
.lgBox{background:var(--paleturq);border:2px solid var(--navy)} .lgMed{background:var(--navy);width:4px!important} .lgMean{background:var(--turq);border:2px solid var(--navy);transform:rotate(45deg);width:10px!important;height:10px!important} .lgOut{border:2px solid var(--navy);border-radius:50%!important;width:12px!important;height:12px!important} .lgDot{background:var(--turq);border:2px solid var(--navy);border-radius:50%!important;width:12px!important;height:12px!important}
.labRows{display:flex;flex-direction:column;gap:14px}
.labRow{background:var(--white);border-radius:20px;box-shadow:var(--shadow-2);padding:10px 22px 6px;display:grid;grid-template-columns:190px 1fr;gap:8px 18px;align-items:center}
.labRow.thin{opacity:.75}
.labNotYet{font-weight:700;color:var(--teal);padding:14px 0}
.labName{font-weight:900;font-size:clamp(18px,2vw,26px);line-height:1.1;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.labName small{display:block;font-size:14px;color:var(--teal);font-weight:700;margin-top:4px} .labName small b{font-size:16px;font-weight:900}
.labPlot{min-width:0}
.labSvg{width:100%;height:auto;display:block;overflow:visible}
.labTick{stroke:var(--grid);stroke-width:1} .labTickTxt{font-size:11px;font-weight:700;fill:var(--teal);text-anchor:middle}
.labWhisk{stroke:var(--navy);stroke-width:2;stroke-linecap:round}
.labBox{fill:var(--paleturq);stroke:var(--navy);stroke-width:2}
.labMed{stroke:var(--navy);stroke-width:4;stroke-linecap:round}
.labMean{fill:var(--turq);stroke:var(--navy);stroke-width:2}
.labMeanLine{stroke:var(--navy);stroke-width:1.5;stroke-dasharray:3 3;opacity:.6}
.labOut{fill:var(--white);stroke:var(--navy);stroke-width:2}
.labDot{fill:var(--turq);stroke:var(--white);stroke-width:1.5}
.labLbl{font-size:12px;font-weight:900;fill:var(--navy)} .labLbl.mid{text-anchor:middle} .labLbl.end{text-anchor:end}
.labStats{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:6px 8px;border-top:2px solid var(--grid);padding:8px 0 4px}
.labStats div{display:flex;flex-direction:column;align-items:center;gap:2px;background:var(--cream);border-radius:10px;padding:6px 4px}
.labStats div.wide{grid-column:span 3;align-items:flex-start;padding-left:10px;text-align:left}
.labStats div.wide b{font-size:13px;line-height:1.3}
.labStats span{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--teal)}
.labStats b{font-weight:900;font-size:clamp(14px,1.4vw,18px);font-variant-numeric:tabular-nums}
.labHint{font-weight:700;color:var(--teal);font-size:clamp(14px,1.4vw,18px);padding:4px 6px}
.labValues{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px 18px;align-items:flex-start;border-top:2px solid var(--grid);padding:8px 0 4px}
.labHalf{display:flex;flex-direction:column;gap:4px}
.labHalf small{font-size:clamp(11px,1.1vw,15px);font-weight:700;color:var(--teal);letter-spacing:.02em}
.labChips{display:flex;flex-wrap:wrap;gap:4px}
.labChips span{min-width:2.2em;padding:.2em .5em;border-radius:8px;background:var(--cream);border:2px solid var(--grid);font-weight:700;font-size:clamp(13px,1.35vw,19px);text-align:center;font-variant-numeric:tabular-nums}
.labChips span.q{background:var(--paleturq);border-color:var(--turq);font-weight:900}
.labChips span.m{background:var(--navy);color:var(--white);border-color:var(--navy);font-weight:900}
.labChips span.m.gap{background:var(--white);color:var(--navy);border-style:dashed}
.labChips span.out{box-shadow:0 0 0 2px var(--coral)}
.labPlot .chart{max-height:min(32vh,260px)} .labRow.one .labPlot .chart{max-height:min(70vh,520px)}
.labStats{gap:4px 6px;padding:6px 0 2px} .labStats div{padding:4px 4px;gap:1px}
.lbTools{background:color-mix(in srgb,var(--cream) 88%,transparent);backdrop-filter:blur(6px);border-radius:999px;padding:6px 8px;box-shadow:var(--shadow-1)}
@media (max-width:800px){.labRow{grid-template-columns:1fr}.labStats{grid-template-columns:repeat(3,1fr)}.labStats div.wide{grid-column:span 3}}
`;
function dotsDefault(id) { return !(id || '').startsWith('gb:'); }
const parseNums = txt => String(txt || '').split(/[\s,;]+/).map(Number).filter(Number.isFinite);
function renderLeaderboard() {
  const el = $('#lb'); const on = !!state.settings.leaderboard;
  el.classList.toggle('hidden', !on); document.body.classList.toggle('lbMode', on);
  if (!on) { el.innerHTML = ''; return; }
  const st = state.settings; const f = st.lbFocus || 'both'; const data = leaderboardData(); const hasBoth = data.some(r => r.prep === 'acc') && data.some(r => r.prep === 'on');
  const lab = st.lbTab === 'lab';
  if (lab && !hasBoth && data.length) st.labPrep = data[0].prep;
  const { list, groups } = labDatasets(st.labPrep);
  if (lab && list.length && !list.some(d => d.id === st.labUnit)) st.labUnit = list[0].id;
  if (lab && (st.labUnit || '').startsWith('gb:') && !['box', 'hist', 'circle', 'line'].includes(st.labKind)) st.labKind = 'box';
  const dotsOn = (st.labUnit || '').startsWith('gb:') ? false : (st.labDots[st.labUnit] != null ? !!st.labDots[st.labUnit] : dotsDefault(st.labUnit));   // Focus scores are never one dot per student on a projected screen
  const tabs = `<div class="seg lbTabs"><button data-tab="race" class="${!lab ? 'on' : ''}">Race</button><button data-tab="lab" class="${lab ? 'on' : ''}">Data Lab</button></div>`;
  const revealLabel = st.labStats === 0 ? 'Show stats' : st.labStats === 1 ? 'Show more' : 'Hide stats';
  const controls = lab
    ? `${hasBoth ? `<div class="seg lbFocus">${[['acc', 'Accelerated'], ['on', 'On-level']].map(([k, n]) => `<button data-prep="${k}" class="${st.labPrep === k ? 'on' : ''}">${n}</button>`).join('')}</div>` : ''}
       <select id="labUnit" class="labSelect" aria-label="Data set">${groups.map(g => `<optgroup label="${esc(g.group)}">${g.items.map(d => `<option value="${esc(d.id)}" ${d.id === st.labUnit ? 'selected' : ''}>${esc(d.label)}</option>`).join('')}</optgroup>`).join('')}</select>
       <select id="labKind" class="labSelect" aria-label="Show as">${LAB_KINDS.filter(([k]) => !(st.labUnit || '').startsWith('gb:') || ['box', 'hist', 'circle', 'line'].includes(k)).map(([k, n]) => `<option value="${k}" ${st.labKind === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
       ${st.labKind === 'hist' ? `<select id="labBin" class="labSelect" aria-label="Bin size"><option value="0">auto bins</option>${((st.labUnit || '').startsWith('gb:') ? [5, 10] : [1, 2, 5, 10]).map(b => `<option value="${b}" ${st.labBin === b ? 'selected' : ''}>bins of ${b}</option>`).join('')}</select>` : ''}
       <button class="pill small" id="labStats" aria-pressed="${st.labStats > 0}">${revealLabel}</button>
       ${st.labKind === 'box' && !(st.labUnit || '').startsWith('gb:') ? `<button class="pill small" id="labDots" aria-pressed="${dotsOn}">Dots</button>` : ''}
       <div class="seg small" id="labPct" title="Show each student's score as points or as a percent of the maximum"><button data-pct="0" class="${st.labPct ? '' : 'on'}">Points</button><button data-pct="1" class="${st.labPct ? 'on' : ''}">%</button></div>
       ${(st.labUnit || '').startsWith('gb:') ? '' : `<button class="pill small" id="labValues" aria-pressed="${!!st.labValues}">Values</button>`}
       ${st.labKind === 'box' ? `<button class="pill small" id="labTukey" aria-pressed="${!!st.labTukey}">Outliers</button>` : ''}`
    : (hasBoth ? `<div class="seg lbFocus">${[['both', 'Both'], ['acc', 'Accelerated'], ['on', 'On-level']].map(([k, n]) => `<button data-focus="${k}" class="${f === k ? 'on' : ''}">${n}</button>`).join('')}</div>` : '');
  el.innerHTML = `<div class="lbWrap">${lab ? labMarkup(st.labPrep, st.labUnit, st.labStats, st.labTukey, dotsOn, st.labValues) : lbMarkup(data, f)}</div>
    <div class="lbTools">${tabs}${controls}<button class="pill small exitPill" id="lbExit" title="Press and hold for 1½ seconds to exit"><span class="ring"></span>Hold to exit</button></div>`;
  el.querySelectorAll('[data-focus]').forEach(b => b.onclick = () => { st.lbFocus = b.dataset.focus; save(); renderLeaderboard(); });
  el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { st.lbTab = b.dataset.tab; save(); renderLeaderboard(); });
  el.querySelectorAll('[data-prep]').forEach(b => b.onclick = () => { st.labPrep = b.dataset.prep; st.labUnit = ''; save(); renderLeaderboard(); });
  const sel = $('#labUnit'); if (sel) sel.onchange = () => { st.labUnit = sel.value; save(); renderLeaderboard(); };
  const lk = $('#labKind'); if (lk) lk.onchange = () => { st.labKind = lk.value; save(); renderLeaderboard(); };
  el.querySelectorAll('[data-pct]').forEach(b => b.onclick = () => { st.labPct = b.dataset.pct === '1'; save(); renderLeaderboard(); });
  const lb = $('#labBin'); if (lb) lb.onchange = () => { st.labBin = Number(lb.value); save(); renderLeaderboard(); };
  const ls = $('#labStats'); if (ls) ls.onclick = () => { st.labStats = (st.labStats + 1) % 3; save(); renderLeaderboard(); };
  const ld = $('#labDots'); if (ld) ld.onclick = () => { st.labDots[st.labUnit] = !dotsOn; save(); renderLeaderboard(); };
  const lv = $('#labValues'); if (lv) lv.onclick = () => { st.labValues = !st.labValues; save(); renderLeaderboard(); };
  const lt = $('#labTukey'); if (lt) lt.onclick = () => { st.labTukey = !st.labTukey; save(); renderLeaderboard(); };
  let hold; const start = e => { e.preventDefault(); $('#lbExit').classList.add('holding'); hold = setTimeout(() => { state.settings.leaderboard = false; view = { mode: 'home', unit: null }; noticesOpen = false; save(); render(); }, 1500); };   // always land on the Overview: it carries no student names
  const stop = () => { clearTimeout(hold); const b = $('#lbExit'); if (b) b.classList.remove('holding'); };
  const b = $('#lbExit'); b.onpointerdown = start; b.onpointerup = stop; b.onpointerleave = stop; b.onpointercancel = stop;
  b.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) start(e); }; b.onkeyup = stop; b.onblur = stop;
  // A long press on a touch screen otherwise opens the copy/paste or context menu and cancels the pointer — swallow it.
  b.oncontextmenu = e => e.preventDefault(); b.addEventListener('touchstart', e => e.preventDefault(), { passive: false }); b.onselectstart = e => e.preventDefault();
}
function enterProjected() {
  state.settings.hideNames = true;                       // projected mode always starts, and ends, with names hidden
  state.settings.leaderboard = true;
  const t = $('#toast'); t.classList.remove('show'); clearTimeout(toastT);
  save(); render();
}
function downloadLeaderboard(which) {
  const data = leaderboardData(); const st = state.settings; const lab = which === 'lab';
  const dotsOn = (st.labUnit || '').startsWith('gb:') ? false : (st.labDots[st.labUnit] != null ? !!st.labDots[st.labUnit] : dotsDefault(st.labUnit));   // Focus scores are never one dot per student on a projected screen
  const body = lab ? labMarkup(st.labPrep, st.labUnit, st.labStats, st.labTukey, dotsOn, st.labValues) : lbMarkup(data, st.lbFocus);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${lab ? 'Data Lab' : 'IXL Race'}</title>
<style>${(document.getElementById('tallyFont') || {}).textContent || ''}</style>
<style>:root{--cream:#F6F5F0;--grid:#E6E4DC;--sand:#EFECE3;--shadow:rgba(22,33,58,.10);--shadow-1:0 1px 2px rgba(22,33,58,.06);--shadow-2:0 1px 2px rgba(22,33,58,.06),0 12px 32px -14px rgba(22,33,58,.22);--turq:#2DD4BF;--paleturq:#DDF4F0;--teal:#0F766E;--navy:#16213A;--coral:#FBDAD2;--bad:#B8321F;--white:#fff;--ink-soft:#66708A;--r:16px}
*{box-sizing:border-box}html,body{margin:0;min-height:100%}body{font-family:"DM Sans",system-ui,sans-serif;color:var(--navy);background:var(--cream)}
${LB_CSS}${LAB_CSS}</style></head><body><div class="lbWrap">${body}</div></body></html>`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = (lab ? 'Data-Lab-' : 'IXL-Race-') + (data.map(r => r.date).filter(Boolean).sort().pop() || new Date().toISOString().slice(0, 10)) + '.html'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(lab ? 'Saved the Data Lab page — no names; it does contain each class\'s values.' : 'Saved the Race page — class totals only, no names.', false, 4500, true);
}

/* ---------- file sniffing: xlsx / csv / html-table-as-.xls / tab-text-as-.xls / real binary .xls ---------- */
async function fileToRows(f) {
  const buf = await f.arrayBuffer(); const u8 = new Uint8Array(buf);
  if (u8[0] === 0x50 && u8[1] === 0x4B) return xlsxToRows(buf);                        // zip → xlsx
  if (u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0) throw new Error('This is an old binary Excel (.xls) file. Open it in Excel or Google Sheets and save as .xlsx or .csv, then import that.');
  let text;
  if ((u8[0] === 0xFF && u8[1] === 0xFE) || (u8[0] === 0xFE && u8[1] === 0xFF)) text = new TextDecoder(u8[0] === 0xFF ? 'utf-16le' : 'utf-16be').decode(u8);
  else text = new TextDecoder().decode(u8);
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const head = text.slice(0, 512).trim();
  if (/^</.test(head) && /<table/i.test(text)) {                                         // HTML table pretending to be .xls
    const doc = new DOMParser().parseFromString(text, 'text/html'); const rows = [];
    const outer = [...doc.querySelectorAll('table')].filter(t => !t.parentElement.closest('table'));
    outer.forEach(table => [...table.querySelectorAll('tr')].filter(tr => tr.closest('table') === table).forEach(tr => {
      const row = []; [...tr.children].forEach(td => { if (!/^t[hd]$/i.test(td.tagName)) return; const t = td.textContent.replace(/\s+/g, ' ').trim(); const span = Math.max(1, parseInt(td.getAttribute('colspan') || '1', 10) || 1); for (let i = 0; i < span; i++) row.push(t === '' ? null : t); });
      rows.push(row);
    }));
    return rows;
  }
  if (/\t/.test(head)) return text.split(/\r?\n/).map(l => l.split('\t').map(v => { v = v.replace(/^"|"$/g, '').trim(); return v === '' ? null : v; }));
  return csvToRows(text);
}
const isNum = v => v != null && v !== '' && !isNaN(Number(String(v).replace(/%$/, '')));
// Generic gradebook grid: a header row with a name column and assignment columns; students down.
// Returns { students:[names], assignments:[{name, category, max, values:[...], missing}] } or null.
function parseGradebook(rows) {
  const isT = v => typeof v === 'string' && v.trim() !== '';
  const idLike = /\b(id|number|no\.?|#)\b/i;
  const nameHdr = /^(student|students|student name|name|full name|last, first|last name)\b/i;
  const looksName = v => isT(v) && /^[A-Za-zÀ-ɏ][^\d]*,\s*[A-Za-zÀ-ɏ]/.test(v.trim());
  let h = -1, nameCol = -1;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const r = rows[i] || []; const texts = r.filter(isT).length; if (texts < 3) continue;
    const nc = r.findIndex(v => isT(v) && nameHdr.test(v.trim()) && !idLike.test(v.trim()));
    const nx = rows[i + 1] || [];
    if (nc >= 0 && (nx.some(looksName) || nx.filter(isT).length >= 2)) { h = i; nameCol = nc; break; }
  }
  if (h < 0) {   // fallback: a row with ≥3 text cells followed by a row with a "Last, First" cell
    for (let i = 0; i < Math.min(rows.length, 40) - 1; i++) {
      const r = rows[i] || [], nx = rows[i + 1] || [];
      if (r.filter(isT).length >= 3 && nx.some(looksName)) { h = i; nameCol = nx.findIndex(looksName); break; }
    }
  }
  if (h < 0 || nameCol < 0) return null;
  const hdr = rows[h];
  const skipExact = /^(id|student id|student number|student #|local id|grade|overall|overall grade|letter grade|letter|total|average|avg|percent|percentage|period|section|email|username|absences|tardies|comments?|teacher|course)$/i;
  const skipPattern = /^(semester|sem|quarter|q\d|term|t\d|final|current|overall|cumulative)\b.*\b(total|average|avg|percent|grade|points)$|^grade level$|^gradebook grade$|\bgrade$/i;
  const cols = []; hdr.forEach((v, c) => { if (c === nameCol || !isT(v)) return; const t = v.trim(); if (skipExact.test(t) || skipPattern.test(t)) return; cols.push({ c, name: t }); });
  // the course grade column (Focus: "Grade" holding "79% C") lets the grading model prove each assignment's category
  const overallCol = hdr.findIndex((v, c) => c !== nameCol && isT(v) && /^(grade|overall|overall grade|percent|percentage|current grade|gradebook grade)$/i.test(v.trim()));
  const idCol = hdr.findIndex((v, c) => c !== nameCol && isT(v) && /^(student id|id|student number|student #|local id)$/i.test(v.trim()));
  if (cols.length < 1) return null;
  const isPP = v => isT(v) && /^(points? possible|max(imum)?( points)?|out of|total points|possible)/i.test(v.trim());
  let maxRow = null; for (let i = Math.max(0, h - 3); i < rows.length; i++) { const r = rows[i] || []; if (r.some(isPP)) { maxRow = r; break; } }
  const catRow = h > 0 && !(rows[h - 1] || []).some(isPP) ? rows[h - 1] : null;
  const excusedRe = /^(ng|x|ex|exc|e|i|inc|excused|exempt|n\/a|na)$/i, missingRe = /^(m|nhi|\*|—|-|missing|late)$/i;
  const examples = [];
  const rawCells = cols.map(() => []);
  const students = [], ids = [], overall = [], data = cols.map(() => []), status = cols.map(() => []), unread = cols.map(() => 0), excusedN = cols.map(() => 0), pct = cols.map(() => false), fracMax = cols.map(() => null);
  const st = (j, v) => status[j].push(v);
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i] || []; const nm = r[nameCol];
    if (!isT(nm) || r.some(isPP)) continue;
    if (/^(class )?(average|mean|median|total)/i.test(nm.trim())) continue;
    if (/\((inactive|withdrawn|dropped|transferred)\)\s*$/i.test(nm)) continue;   // a marked-inactive row leaves; a student with nothing entered yet stays (no grade until something is scored)
    students.push(nm.trim());
    ids.push(idCol >= 0 && r[idCol] != null ? String(r[idCol]).trim() : '');
    { const ov = overallCol >= 0 ? r[overallCol] : null; const m = ov != null && String(ov).match(/^\s*(-?\d+(?:\.\d+)?)\s*%/); overall.push(m ? Number(m[1]) : (typeof ov === 'number' ? ov : null)); }
    cols.forEach((col, j) => {
      let v = r[col.c]; rawCells[j].push(v == null ? '' : String(v).trim()); if (v == null || String(v).trim() === '') { data[j].push(null); st(j, 'blank'); return; }
      if (typeof v === 'number') { data[j].push(v); st(j, 'score'); return; }
      const t = String(v).trim();
      let m;
      if ((m = t.match(/^(-?\d+(?:\.\d+)?)\s*-\s*-?\d+(?:\.\d+)?\s*%\s*(?:-\s*[A-F][+-]?)?$/i))) { data[j].push(Number(m[1])); st(j, 'score'); return; }   // Focus: "16.5 - 79 % - C"
      if (/^nhi\b/i.test(t)) { data[j].push(null); st(j, 'missing'); return; }                                                                              // Focus: "NHI Not Handed In"
      if ((m = t.match(/^(-?\d+(?:\.\d+)?)\s*%$/))) { pct[j] = true; data[j].push(Number(m[1])); st(j, 'score'); return; }
      if ((m = t.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/))) { data[j].push(Number(m[1])); st(j, 'score'); fracMax[j] = fracMax[j] == null ? Number(m[2]) : (fracMax[j] === Number(m[2]) ? fracMax[j] : NaN); return; }
      if (/^-?\d+(\.\d+)?$/.test(t)) { data[j].push(Number(t)); st(j, 'score'); return; }
      if (/^z$/i.test(t)) { data[j].push(0); st(j, 'score'); return; }
      if (excusedRe.test(t)) { data[j].push(null); st(j, 'excused'); excusedN[j]++; return; }
      if (missingRe.test(t)) { data[j].push(null); st(j, 'missing'); return; }
      data[j].push(null); st(j, 'unread'); unread[j]++; if (examples.length < 3 && !examples.includes(t)) examples.push(t);
    });
  }
  if (students.length < 2) return null;
  const seen = {};
  const assignments = cols.map((col, j) => {
    let max = maxRow && isNum(maxRow[col.c]) ? Number(maxRow[col.c]) : null;
    let name = col.name, category = catRow && isT(catRow[col.c]) && !isNum(catRow[col.c]) ? catRow[col.c].trim() : '';
    let assignedOn = '', due = '';
    if (/\n/.test(name)) {   // Focus puts title, points, and dates on separate lines of one header cell
      const lines = name.split(/\n/).map(x => x.trim()).filter(Boolean);
      name = lines[0];
      lines.slice(1).forEach(l => { let mm; if ((mm = l.match(/^(\d+(?:\.\d+)?)\s*points?$/i))) max = max || Number(mm[1]); else if ((mm = l.match(/^assigned\s+(\S+)/i))) assignedOn = mm[1]; else if ((mm = l.match(/^due\s+(\S+)/i))) due = mm[1]; });
    } else {
      const m = name.match(/(\d+(?:\.\d+)?)\s*(?:pts?|points)\b/i) || name.match(/\/\s*(\d+(?:\.\d+)?)\s*$/); if (!max && m) max = Number(m[1]);
      name = name.replace(/\s*\(?\d+(?:\.\d+)?\s*(?:pts?|points)\)?\s*/i, ' ').replace(/\s+\d{1,2}\/\d{1,2}(\/\d{2,4})?\s*$/, '').trim();
    }
    if (!max && fracMax[j] != null && !isNaN(fracMax[j])) max = fracMax[j];
    if (pct[j]) max = 100;
    const categoryFromFile = !!category;
    if (!category) category = /\b(test|exam|assessment|benchmark)\b/i.test(name) ? 'Assessments' : /\bixl\b/i.test(name) ? 'IXL' : /\bquiz\b/i.test(name) ? 'Quizzes' : 'Classwork';
    seen[name] = (seen[name] || 0) + 1; if (seen[name] > 1) name = name + ' (' + seen[name] + ')';
    const vals = data[j]; const missing = vals.filter(v => v == null).length - excusedN[j];
    return { name, category, categoryFromFile, max, values: vals, status: status[j], missing, excused: excusedN[j], unread: unread[j], percent: pct[j], assignedOn, due, _col: col };
  }).filter(a => a.values.some(v => v != null) || a.status.some(x => x === 'missing'));   // an all-NHI column still counts as zeros in Focus; only a column nobody has anything in is dropped
  if (!assignments.length) return null;
  const raw = {}; assignments.forEach((a, j) => { raw[a.name] = rawCells[cols.findIndex(c => c === a._col)] || []; delete a._col; });
  return { students, ids, overall: overall.some(v => v != null) ? overall : null, assignments, unread: assignments.reduce((a, x) => a + x.unread, 0), examples, raw };
}
/* ---------- course-wide IXL pools ----------
   When IXL is exported for the whole course (no section code in the file name), every student in the course is in one
   file. The file is kept as state.pools[prep]; each class made from a Focus gradebook (sec.pool = true) is carved from
   it: its roster names are matched against the pool and the class gets exactly those students' columns. */
const PERIOD_ORD = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
function materialize(sec) {
  const pool = state.pools[sec.prep];
  if (!pool) { sec.students = sec.students || []; sec.skills = sec.skills || []; sec.scores = sec.scores || []; sec.awaitingPool = true; return; }
  // No roster means no students — never the whole course (an emptied roster once handed a class all 91 pool students).
  const idx = rosterState(sec).count ? poolIdx(sec) : [];
  sec.students = idx.map(i => pool.students[i]); sec.skills = pool.skills; sec.scores = pool.scores.map(row => idx.map(i => row[i]));
  sec.date = pool.date; sec.file = pool.file; sec.importedAt = pool.importedAt; sec.awaitingPool = false; sec.placeholder = false; sec.allBlank = !sec.scores.some(r => r.some(v => v != null));
  sec._keys = null; mergeBest(sec); snapshot(sec);
}
// The pool students a class could still claim: everyone in the course not already matched by another class of the same prep.
// Returns pool ixlList entries (with their pool keys, so two students who share a name stay distinct).
function poolRows(sec) { const pool = state.pools[sec.prep]; if (!pool) return []; const tmp = { ...sec, students: pool.students, skills: pool.skills, scores: pool.scores, _keys: null, ignored: {} }; return buildRows(tmp).filter(r => r.status === 'ok' && r.ixl != null); }
function poolIdx(sec) { return poolRows(sec).map(r => r.ixl); }
function poolLeftovers(sec) {
  const pool = state.pools[sec.prep]; if (!pool) return [];
  const taken = new Set(); state.order.map(k => state.sections[k]).filter(x => x !== sec && x.pool && x.prep === sec.prep).forEach(x => poolIdx(x).forEach(i => taken.add(i)));
  return ixlList(pool).filter(x => !taken.has(x.i));
}
function askNewClass(fileName, gb) {
  return new Promise(resolve => {
    const used = new Set(state.order.map(k => state.sections[k].period).filter(Boolean));
    const m = $('#modal'); m.classList.remove('hidden');
    m.innerHTML = `<div class="panel narrow"><header><h2>New class from this gradebook</h2><button id="mClose" aria-label="Close">×</button></header>
      <div class="body one"><p><b>${esc(fileName)}</b> · ${plural(gb.students.length, 'student')}. Which period is this, and which course?</p>
        <div class="field"><label>Period</label><div class="seg" id="ncPeriod">${[1, 2, 3, 4, 5, 6, 7].map(n => `<button data-p="${n}" ${used.has(n) ? 'disabled title="already a class"' : ''}>${n}</button>`).join('')}</div></div>
        <div class="field"><label>Course</label><div class="seg" id="ncPrep"><button data-prep="acc">Accelerated</button><button data-prep="on">On-level</button></div></div>
        <p class="ghint">The class's IXL grid comes from the course-wide IXL export${state.pools.acc || state.pools.on ? '' : ' — import one for each course when you have it'}.</p><p class="ghint warnline" id="ncWarn" hidden></p>
        <div class="rp-actions"><button class="pill" id="ncMake" disabled>Make the class</button><button class="pill pale" id="mCancel">Skip this file</button></div></div></div>`;
    const done = v => { m.classList.add('hidden'); m.innerHTML = ''; resolve(v); };
    m._cancel = () => done(null); $('#mClose').onclick = m._cancel; $('#mCancel').onclick = m._cancel; m.onclick = e => { if (e.target === m) done(null); };
    let period = null, prep = null; const arm = () => { $('#ncMake').disabled = !(period && prep); };
    m.querySelectorAll('#ncPeriod button').forEach(b => b.onclick = () => { period = Number(b.dataset.p); m.querySelectorAll('#ncPeriod button').forEach(x => x.classList.toggle('on', x === b)); arm(); });
    // A student is in one class per course: say so when this gradebook's names already sit in another class of that course.
    const overlap = pr => { const mine = new Set(gb.students.map(n => norm(n))); return state.order.map(k => state.sections[k]).filter(x => x.prep === pr && !x.placeholder).map(x => ({ x, n: parseRosterText(x.roster).filter(r => mine.has(norm(r.display))).length })).filter(o => o.n); };
    m.querySelectorAll('#ncPrep button').forEach(b => b.onclick = () => { prep = b.dataset.prep; m.querySelectorAll('#ncPrep button').forEach(x => x.classList.toggle('on', x === b)); const ov = overlap(prep); const w = $('#ncWarn'); w.hidden = !ov.length; w.textContent = ov.length ? `${ov.map(o => `${o.n} of these students ${o.n === 1 ? 'is' : 'are'} already in ${o.x.label}`).join('; ')} — they would appear in both classes. Fix the roster of whichever class is wrong afterwards.` : ''; arm(); });
    $('#ncMake').onclick = () => {
      const key = 'period-' + period; const label = `${PERIOD_ORD(period)} Period · ${prep === 'acc' ? 'Accelerated' : 'On-level'}`;
      state.sections[key] = { key, label, autoLabel: label, period, pool: true, accelerated: prep === 'acc', prep, threshold: prep === 'acc' ? DEFAULT_THR.acc : DEFAULT_THR.on,
        date: null, file: '', importedAt: new Date().toISOString(), students: [], skills: [], scores: [], roster: '', rosterAt: null, skipRoster: false,
        excluded: state.skips[prep], ignored: {}, aliases: {}, hiddenUnits: {}, studentSkips: {}, history: [], team: '', placeholder: false, allBlank: false, best: null, receipts: {}, _keys: null };
      const held = state.pendingCfg[key]; if (held) { const s0 = state.sections[key]; ['threshold', 'roster', 'rosterAt', 'skipRoster', 'ignored', 'aliases', 'studentSkips', 'history', 'gradeHistory', 'seating', 'seatInfo', 'qArchive'].forEach(f => { if (held[f] != null) s0[f] = held[f]; }); if (held.label) s0.label = held.label; delete state.pendingCfg[key]; }   // a backup loaded before the class existed
      if (!state.order.includes(key)) state.order.push(key); state.active = key;
      done(key);
    };
  });
}
const gradebookRosterText = gb => gb.students.map((n, i) => (gb.ids && gb.ids[i] ? gb.ids[i] + '\t' : '') + n).join('\n');
// When a pasted roster and the gradebook disagree on who is in the class, the notice offers the gradebook's list.
function rosterVsGradebook(sec) {
  const gb = sec.grades; if (!gb || !rosterState(sec).count) return null;
  const have = new Set(parseRosterText(sec.roster).map(r => norm(r.display))); const inGb = new Set(gb.students.map(n => norm(n)));
  const added = gb.students.filter(n => !have.has(norm(n))), gone = parseRosterText(sec.roster).map(r => r.display).filter(d => !inGb.has(norm(d)));
  return added.length || gone.length ? { added, gone } : null;
}
function pickSection(fileName, gb) {
  return new Promise(resolve => {
    const m = $('#modal'); m.classList.remove('hidden');
    const preview = gb.assignments.slice(0, 6).map(a => esc(a.name)).join(', ') + (gb.assignments.length > 6 ? ', …' : '');
    // Suggest the class whose IXL students the gradebook's names match best (same matcher the roster uses).
    const roster = gb.students.join('\n');
    const hits = state.order.map(k => { let n = 0; try { n = buildRows({ ...state.sections[k], roster }).filter(r => r.status === 'ok').length; } catch (e) {} return [k, n]; }).sort((a, b) => b[1] - a[1]);
    const best = hits.length && hits[0][1] >= Math.max(3, gb.students.length / 2) && (hits.length === 1 || hits[0][1] > hits[1][1]) ? hits[0][0] : null;
    m.innerHTML = `<div class="panel narrow"><header><h2>Which class is this gradebook?</h2><button id="mClose" aria-label="Close">×</button></header>
      <div class="body one"><p><b>${esc(fileName)}</b><br>${plural(gb.students.length, 'student')} · ${plural(gb.assignments.length, 'assignment')}: ${preview}${gb.unread ? `<br><span class="warnline">${plural(gb.unread, 'cell')} couldn't be read (${esc(gb.examples.map(x => '“' + x + '”').join(', '))}) and will count as no score.</span>` : ''}</p>
      <div class="picks">${state.order.map(k => `<button class="chip${k === best ? ' on' : ''}" data-sec="${esc(k)}">${esc(state.sections[k].label)}${k === best ? ' <small>· names match</small>' : ''}</button>`).join('')}<button class="chip${!best ? ' on' : ''}" data-sec="__new__">+ New class${!best && state.order.length ? ' <small>· no class matches these names</small>' : ''}</button></div>
      <div class="rp-actions"><button class="pill pale" id="mCancel">Skip this file</button></div></div></div>`;
    const done = v => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; resolve(v); };
    m._cancel = () => done(null); $('#mClose').onclick = m._cancel; $('#mCancel').onclick = m._cancel; m.onclick = e => { if (e.target === m) done(null); };
    m.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => done(b.dataset.sec));
  });
}

/* ---------- render ---------- */
let lastViewKey = '';
function render() {
  rowCache = new Map();   // students.js name-match cache: never outlives one render
  attCache = new Map();   // home.js attention items per class: the tabs, the cards and the list read the same answer once per render
  const has = state.order.length > 0;
  const focusId = document.activeElement && document.activeElement.id && !document.activeElement.closest('#modal') ? document.activeElement.id : null;
  const viewKey = view.mode + '|' + (view.unit || '') + '|' + (view.sub || '') + '|' + (view.q || '') + '|' + (view.stu ? view.stu.key + '/' + view.stu.name : '') + '|' + state.active; if (viewKey !== lastViewKey) { lastViewKey = viewKey; const gw = $('#gridwrap'); if (gw) gw.scrollTop = 0; }
  $('#empty').classList.toggle('hidden', has);
  if (!has) {   // the landing: after a course export with no class yet, say what landed and what comes next instead of "Drop here" again
    const li = state.lastImport, pools = ['acc', 'on'].filter(p => state.pools[p]); const d = $('#drop');
    d.querySelector('h2').innerHTML = pools.length ? `${pools.length === 2 ? 'Both course exports are in' : (pools[0] === 'acc' ? 'Accelerated' : 'On-level') + ' course export is in'}<span>.</span>` : 'Drop your IXL Score Grid here<span>.</span>';
    d.querySelector('p').innerHTML = pools.length ? `Now drop a Focus gradebook for each period${pools.length === 1 ? ` (and the ${pools[0] === 'acc' ? 'on-level' : 'accelerated'} IXL export when you have it)` : ''} — each one makes that period's class from the course pool.` : 'Per-period exports make a class each. A course-wide export (all your students in one file) is kept as the course\'s pool, and each Focus gradebook you drop makes a period\'s class from it.';
    let r = d.querySelector('.himport'); if (li && (li.lines.length || li.fails.length)) { if (!r) { r = document.createElement('div'); r.className = 'himport'; d.appendChild(r); } r.classList.toggle('warn', !!li.fails.length); r.innerHTML = `<h3>Last import <small>${esc(fmtTime(li.at))}</small></h3><ul>${li.lines.map(l => `<li><b>${esc(l.label)}</b> — ${esc(l.text)}</li>`).join('')}${li.fails.map(f => `<li class="bad"><b>Couldn't read</b> — ${esc(f)}</li>`).join('')}</ul>`; } else if (r) r.remove(); }
  else { const r = $('#drop .himport'); if (r) r.remove(); }
  $('#app').classList.toggle('hidden', !has);
  $('#search').classList.toggle('hidden', !has);
  $('#btnHide').classList.toggle('hidden', !has);
  $('#btnSettings').classList.toggle('hidden', !has);
  $('#btnLb').classList.toggle('hidden', !has);
  renderLeaderboard();
  $('#btnHide').setAttribute('aria-pressed', String(!state.settings.hideNames));   // pressed = names showing
  $('#btnHide').title = state.settings.hideNames ? 'Names are hidden (initials only) — tap to show them' : 'Names are showing — tap to hide them before projecting';
  $('#btnHide').textContent = 'Names';
  $('#btnHome').classList.toggle('hidden', !has);
  $('#btnHome').setAttribute('aria-pressed', String(view.mode === 'home'));
  $('#btnStudents').classList.toggle('hidden', !has); $('#btnStudents').setAttribute('aria-pressed', String(view.mode === 'students' || view.mode === 'student'));
  $('#btnDetails').classList.toggle('hidden', !has);
  $('#btnDetails').setAttribute('aria-pressed', String(!!state.settings.details));
  if (seatSolving && !(view.mode === 'seating')) seatAbort();
  document.body.classList.toggle('details', !!state.settings.details);
  document.body.classList.toggle('home', has && view.mode === 'home'); document.body.classList.toggle('grades', has && (view.mode === 'grades' || view.mode === 'students' || view.mode === 'student')); document.body.classList.toggle('seating', has && view.mode === 'seating');
  if (!has) return;
  if (!state.sections[state.active]) state.active = state.order[0];
  renderTabs();
  if (view.mode === 'home') { $('#notices').innerHTML = ''; renderHome(); }
  else if (view.mode === 'students') { $('#notices').innerHTML = ''; renderStudentsView(); }
  else if (view.mode === 'student') { $('#notices').innerHTML = ''; renderProfile(); }
  else { renderNotices(); renderBar(); renderGrid(); }
  if (focusId && document.activeElement === document.body) { const el = document.getElementById(focusId); if (el && !el.disabled) { try { el.focus({ preventScroll: true }); } catch (e) {} } }
}
// A tab's dot means "something here you can do today" — the same warnings the Overview lists, nothing else.
function sectionWarn(s) { return attentionItems(s).some(x => x.level === 'warn'); }
function renderTabs() {
  $('#tabs').innerHTML = state.order.map(k => {
    const s = state.sections[k]; const warn = sectionWarn(s);
    const active = k === state.active && !['home', 'students'].includes(view.mode);
    return `<button class="tab ${active ? 'active' : ''} ${warn ? 'warn' : ''}" role="tab" aria-selected="${active}" data-k="${esc(k)}" style="--cc:${classColor(s)}">
      <span class="n">${esc(s.label)}</span>
      <span class="m"><span class="badge">Goal ${s.threshold}</span> ${plural(s.students.length, 'student')} · <span title="IXL export of ${esc(fmtDate(dataDate(s)))}">${overdue(s) ? `<span class="age">${ageText(dataDate(s))}</span>` : (fmtDate(dataDate(s)) || '')}</span></span>${warn ? '<span class="vh"> — needs attention</span>' : ''}
    </button>`;
  }).join('');
  $('#tabs').querySelectorAll('.tab').forEach(b => b.onclick = () => { state.active = b.dataset.k; view = { mode: 'units', unit: null }; noticesOpen = false; search = ''; $('#search').value = ''; save(); render(); });
}
function renderNotices() {
  const s = state.sections[state.active]; const rows = buildRows(s); const el = $('#notices'); el.innerHTML = '';
  const rs = rosterState(s); const H = state.settings.hideNames;
  const list = arr => H ? '' : ': ' + esc(arr.map(r => r.display).join('; '));
  const ro = rows.filter(r => r.status === 'rosterOnly'), am = rows.filter(r => r.status === 'ambiguous'), io = rows.filter(r => r.status === 'ixlOnly'), loose = rows.filter(r => r.tier === 'loose');
  if (s.placeholder) el.innerHTML += `<div class="notice"><span>⚠︎</span><span>This export had <b>no student names</b> in its header row, so Copy is disabled. Re-export from IXL with names included.</span></div>`;
  else if (s.allBlank) el.innerHTML += `<div class="notice"><span>⚠︎</span><span><b>No scores were found in this export</b> — every cell is empty. If IXL shows scores for this class, the file may be in a format Tally doesn't recognize; try the .csv export.</span></div>`;
  if (rs.hasText && !rs.count) el.innerHTML += `<div class="notice"><span>⚠︎</span><span><b>The pasted roster couldn't be read</b> — no names found. Rows are in IXL order, which is probably not FOCUS order.</span><button data-open="roster">Fix roster</button></div>`;
  else if (!rs.count && s.skipRoster) el.innerHTML += `<div class="notice info"><span>ⓘ</span><span><b>No roster.</b> Rows are sorted by last name; Copy includes names so you can check the order.</span><button data-open="roster">Paste roster</button></div>`;
  if (s.pool && !s.awaitingPool && !rosterState(s).count) el.innerHTML += `<div class="notice"><span>⚠︎</span><span><b>No roster, so no students.</b> Import this period's Focus gradebook or paste the roster in Settings; Tally picks the class out of the course-wide IXL export by name.</span><button data-import="1">Import</button></div>`;
  if (s.pool && s.awaitingPool) el.innerHTML += `<div class="notice info"><span>ⓘ</span><span><b>Waiting for the ${s.prep === 'acc' ? 'accelerated' : 'on-level'} IXL export.</b> This class was made from its Focus gradebook; import the course-wide IXL Score Grid and its ${plural(parseRosterText(s.roster).length, 'student')} will be matched from it.</span><button data-import="1">Import</button></div>`;
  const rvg = rosterVsGradebook(s);
  if (rvg) el.innerHTML += `<div class="notice info"><span>ⓘ</span><span><b>The Focus gradebook's class list differs from the pasted roster</b> — ${rvg.added.length ? `${plural(rvg.added.length, 'student')} in the gradebook but not on the roster${list(rvg.added.map(d => ({ display: d })))}` : ''}${rvg.added.length && rvg.gone.length ? '; ' : ''}${rvg.gone.length ? `${plural(rvg.gone.length, 'student')} on the roster but not in the gradebook${list(rvg.gone.map(d => ({ display: d })))}` : ''}.</span><button data-gbroster="1">Use the gradebook's list</button></div>`;
  if ((ro.length || am.length || io.length) && !(s.pool && s.awaitingPool)) el.innerHTML += `<div class="notice"><span>⚠︎</span><span><b>Roster mismatch</b> — ${ro.length ? `${ro.length} on the roster but not in IXL${list(ro)}. ` : ''}${am.length ? `${am.length} with two IXL matches${list(am)}. ` : ''}${io.length ? `${plural(io.length, 'IXL account')} not on the roster${list(io)}. ` : ''}${io.length ? 'IXL students not on the roster are left out of copies — tap their flag: re-paste the roster for a new student, skip for one who left. ' : ''}Tap a flag to fix it. Blank rows are copied for roster students missing from IXL so the column stays aligned.</span></div>`;
  const od = overdue(s); const gbOd = s.grades && state.settings.remindDays && ageDays(s.grades.importedAt) > state.settings.remindDays ? ageDays(s.grades.importedAt) : null;
  if (od || gbOd) el.innerHTML += `<div class="notice info"><span>ⓘ</span><span>${od ? `<b>This IXL export is ${plural(od, 'day')} old</b> (${fmtDate(dataDate(s))}). ` : ''}${gbOd ? `<b>The Focus gradebook is ${plural(gbOd, 'day')} old</b> (${fmtDate(s.grades.importedAt.slice(0, 10))}). ` : ''}You asked to be reminded after ${state.settings.remindDays} days — export ${od && gbOd ? 'fresh copies' : 'a fresh copy'} and import ${od && gbOd ? 'them' : 'it'}.</span><button data-import="1">Import</button></div>`;
  if (rs.count && s.rosterAt && s.date && s.rosterAt.slice(0, 10) < s.date && (Date.now() - new Date(s.rosterAt)) > 21 * 86400000) el.innerHTML += `<div class="notice info"><span>ⓘ</span><span><b>Roster pasted ${fmtDate(s.rosterAt.slice(0, 10))}</b> — older than this export. If anyone enrolled or left since, re-paste it before you copy.</span><button data-open="roster">Re-paste</button></div>`;
  if (s.grades) { const checks = reconcile(s); const off = checks.filter(c => c.counts.differ + c.counts.missing > 0 || !c.maxOK); const stale = checks.filter(c => c.counts.stale > 0 && !off.includes(c));
    if (off.length) el.innerHTML += `<div class="notice"><span>⚠︎</span><span><b>Focus doesn't match Tally</b> — ${off.map(c => `${esc(c.unit.short)}: ${!c.maxOK ? 'points possible differ' : plural(c.counts.differ + c.counts.missing, 'student')}`).join(' · ')}. Tap the unit's Focus badge to see who.</span></div>`;
    else if (checks.length && !stale.length) el.innerHTML += `<div class="notice soft"><span>✓</span><span><b>Focus matches Tally</b> for ${checks.map(c => esc(c.unit.short)).join(', ')} (gradebook from ${fmtDate(s.grades.importedAt.slice(0, 10))}).</span></div>`;
    else if (stale.length) el.innerHTML += `<div class="notice info"><span>ⓘ</span><span><b>Focus matches what you copied</b>, but ${stale.map(c => `${esc(c.unit.short)}: ${plural(c.counts.stale, 'student')}`).join(' · ')} have moved up since. Copy again when you're ready.</span></div>`; }
  if (loose.length) el.innerHTML += `<div class="notice soft"><span>≈</span><span><b>${plural(loose.length, 'name')} matched loosely</b> (nickname or extra name)${H ? '' : ': ' + esc(loose.map(r => r.display + ' → ' + r.ixlName).join('; '))}. Check once; tap the name to change it.</span></div>`;
  noticeCount = { warn: 0, info: 0 };
  if (!state.settings.details) {   // calm: no band — the class bar carries a small "N to fix" chip that opens these (renderBar)
    const kids = [...el.children]; const warn = kids.filter(n => !n.classList.contains('info') && !n.classList.contains('soft')).length, info = kids.filter(n => n.classList.contains('info')).length;
    const here = view.mode === 'units' || view.mode === 'unit';   // Grades and Seating have their own business
    if (here) noticeCount = { warn, info };
    const emptyClass = !rows.length || !s.students.length;   // nothing in the grid yet: the notices are the screen's explanation, so they show without a tap
    if (!here || !(noticesOpen || emptyClass) || !(warn + info)) el.innerHTML = '';
    else el.innerHTML = `<div class="nfold">${el.innerHTML}</div>`;
  }
  el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openSettings());
  el.querySelectorAll('[data-gbroster]').forEach(b => b.onclick = () => { s.roster = gradebookRosterText(s.grades); s.rosterAt = new Date().toISOString(); s.skipRoster = false; if (s.pool) materialize(s); save(); render(); toast(`Roster for ${esc(s.label)} replaced with the gradebook's ${plural(s.grades.students.length, 'student')}.`, false); });
  el.querySelectorAll('[data-import]').forEach(b => b.onclick = () => $('#file').click());
}
// The calm view's replacement for the full-width notice band: a count in the class bar, only when there is something to do or read.
function noticeChip() { const { warn, info } = noticeCount; if (state.settings.details || !(warn + info)) return ''; return `<button class="nchip ${warn ? 'warn' : ''}" id="nToggle" aria-expanded="${noticesOpen}" title="${noticesOpen ? 'Hide' : 'Show'} what needs a look in this class">${warn ? `${warn} to fix` : plural(info, 'note')}${warn && info ? ` <small>· ${plural(info, 'note')}</small>` : ''}</button>`; }
function renderBar() {
  const s = state.sections[state.active]; const units = unitsOf(s); const t = s.threshold;
  let html = '';
  if (view.mode === 'units') {
    const hid = units.filter(u => u.hidden).length;
    html = `<h2>${esc(s.label)}</h2>${noticeChip()}<span class="meta det">${units.length} units · ${s.skills.length} skills · ${plural(s.students.length, 'student')} · one point per skill at goal (<b>${t}</b>) · IXL export of ${fmtDate(dataDate(s)) || '?'}${dataDate(s) ? ` (${ageText(dataDate(s))})` : ''}</span>
      <div class="spacer"></div>
      ${(() => { const cu = units.find(u => u.current); return cu ? `<button class="pill toggle" id="onlyCur" aria-pressed="${!!state.settings.onlyCurrent[s.prep]}" title="Show only the unit this course is working in">${state.settings.onlyCurrent[s.prep] ? 'Just ' + esc(cu.short) : 'Just ' + esc(cu.short)}</button>` : ''; })()}
      ${hid && !state.settings.onlyCurrent[s.prep] ? `<button class="pill toggle" id="toggleAll" aria-pressed="${!!state.settings.showAllUnits}">${plural(hid, 'unassigned unit')}</button>` : ''}
      <span class="det"><button class="pill toggle" id="printOwed" title="Printer-friendly page: what each student still owes">Still owed</button></span>
      ${s.grades ? `<button class="pill toggle" id="openGrades" title="Focus grades: trends, what-ifs, printable summaries">Grades</button>` : ''}
      <button class="pill toggle" id="openSeating" title="Seating chart: room layout, generated charts, moves with consequences">Seating</button>
      <label class="curUnit" title="The unit this course is working in — every unit up to it counts; later units are listed as upcoming">Working in <select id="curUnit"><option value="">— pick —</option>${units.filter(u => u.num > ((state.settings.skipFirst || {})[s.prep] || 0)).map(u => `<option value="${u.num}" ${u.current ? 'selected' : ''}>${esc(u.short)}</option>`).join('')}</select></label>
      <div class="more"><button class="pill toggle" id="moreBtn" aria-haspopup="true" aria-expanded="false" title="More">⋯</button><div class="menu hidden" id="moreMenu"><button id="mDigest">What changed this week</button><button id="mStillOwed">Still owed (print)</button><button id="mReports">Student reports (print)</button>${hid && !state.settings.onlyCurrent[s.prep] ? `<button id="mToggleAll">${state.settings.showAllUnits ? 'Hide' : 'Show'} ${plural(hid, 'unassigned unit')}</button>` : ''}<button id="mDetails">${state.settings.details ? 'Calm view' : 'Details view'}</button></div></div>
      <div class="legend det"><span>Tap a unit for skill scores</span></div>`;
  } else if (view.mode === 'grades' && s.grades) {
    html = renderGradesBar(s);
  } else if (view.mode === 'seating') {
    html = renderSeatingBar(s);
  } else {
    const u = units.find(u => u.name === view.unit);
    if (!u) { view = { mode: 'units', unit: null }; return renderBar(); }
    const ex = u.idx.length - u.active.length;
    html = `<div class="crumb"><button id="back">‹ ${esc(s.label)}</button><h2>${esc(u.short)}</h2></div>${noticeChip()}<span class="meta">${esc(u.title)} · ${plural(u.active.length, 'skill')} toward the goal${ex ? ` · ${ex} skipped` : ''} · goal ${t}</span>
      <div class="spacer"></div>
      <button class="pill toggle soft" id="hideUnit" aria-pressed="${u.assigned}" title="Whether this unit counts for the course — tap to change">${u.assigned ? 'Assigned' : 'Not assigned'}</button>
      ${s.receipts[u.name] ? `<button class="pill toggle" id="rcUnit" title="What was copied to Focus, and when">Copied ${fmtDate(s.receipts[u.name].at.slice(0, 10))}</button>` : ''}
      <button class="pill toggle" id="csvUnit" title="Download this unit as a CSV keyed by student ID">CSV</button>
      <button class="pill onbar" id="copyUnit"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</button>`;
  }
  $('#bar').innerHTML = html; $('#bar').classList.toggle('detail', view.mode !== 'units');
  const nt = $('#nToggle'); if (nt) nt.onclick = () => { noticesOpen = !noticesOpen; render(); };
  const back = $('#back'); if (back) back.onclick = () => { view = { mode: 'units', unit: null }; render(); };
  const cu = $('#copyUnit'); if (cu) cu.onclick = () => copyUnit(s, units.find(u => u.name === view.unit));
  const ta = $('#toggleAll'); if (ta) ta.onclick = () => { state.settings.showAllUnits = !state.settings.showAllUnits; save(); render(); };
  const oc = $('#onlyCur'); if (oc) oc.onclick = () => { state.settings.onlyCurrent[s.prep] = !state.settings.onlyCurrent[s.prep]; save(); render(); };
  const hu = $('#hideUnit'); if (hu) hu.onclick = () => { const u = units.find(u => u.name === view.unit); state.assigned[s.prep][u.name] = !u.assigned; save(); render(); toast(`${esc(u.short)} ${!u.assigned ? 'assigned' : 'unassigned'} for every ${s.prep === 'acc' ? 'accelerated' : 'on-level'} class`, false); };
  const po = $('#printOwed'); if (po) po.onclick = () => openStillOwed(s);
  const mb = $('#moreBtn'); if (mb) { const menu = $('#moreMenu');
    // An invisible overlay swallows the tap that dismisses the menu (on the panel "outside" is a student's cell); Escape closes and returns focus.
    const closeMenu = () => { menu.classList.add('hidden'); mb.setAttribute('aria-expanded', 'false'); const ov = $('#menuOverlay'); if (ov) ov.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); mb.focus(); } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { const items = [...menu.querySelectorAll('button')]; const i = items.indexOf(document.activeElement); e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); } else if (e.key === 'Tab') { setTimeout(() => { if (!menu.contains(document.activeElement)) closeMenu(); }, 0); } };
    mb.onclick = e => { e.stopPropagation(); if (!menu.classList.contains('hidden')) { closeMenu(); return; } menu.classList.remove('hidden'); mb.setAttribute('aria-expanded', 'true'); const ov = document.createElement('div'); ov.id = 'menuOverlay'; ov.onclick = ev => { ev.stopPropagation(); closeMenu(); }; document.body.appendChild(ov); document.addEventListener('keydown', onKey, true); const first = menu.querySelector('button'); if (first) first.focus(); };
    menu.querySelectorAll('button').forEach(b => b.addEventListener('click', closeMenu));
    const dg = $('#mDigest'); if (dg) dg.onclick = () => openDigest(s); const so = $('#mStillOwed'); if (so) so.onclick = () => openStillOwed(s); const mr = $('#mReports'); if (mr) mr.onclick = () => openStudentReports(s); const mt = $('#mToggleAll'); if (mt) mt.onclick = () => { state.settings.showAllUnits = !state.settings.showAllUnits; save(); render(); }; const md = $('#mDetails'); if (md) md.onclick = () => { state.settings.details = !state.settings.details; save(); render(); }; }
  const og = $('#openGrades'); if (og) og.onclick = () => { view = { mode: 'grades', unit: null }; render(); };
  const cuSel = $('#curUnit'); if (cuSel) cuSel.onchange = () => { state.settings.currentUnit = state.settings.currentUnit || { acc: null, on: null }; state.settings.currentUnit[s.prep] = cuSel.value ? Number(cuSel.value) : null; state.order.map(k => state.sections[k]).filter(x => x.prep === s.prep).forEach(snapshot); save(); render(); toast(cuSel.value ? `${s.prep === 'acc' ? 'Accelerated' : 'On-level'} classes are working in <b>Unit ${cuSel.value}</b> — ${(state.settings.skipFirst[s.prep] || 0) + 1 === Number(cuSel.value) ? `Unit ${cuSel.value} counts` : `Units ${(state.settings.skipFirst[s.prep] || 0) + 1}–${cuSel.value} count`}; later units are upcoming.` : 'No current unit — units count once a quarter of the class has started them.', false, 5000); };
  const gw = $('#gradesWeights'); if (gw) gw.onclick = () => openWeights(s);
  $('#bar').querySelectorAll('[data-gq]').forEach(b => b.onclick = () => { view.q = Number(b.dataset.gq); render(); });
  const gqz = $('#gradesQuarters'); if (gqz) gqz.onclick = openQuarters;
  const os = $('#openSeating'); if (os) os.onclick = () => { view = { mode: 'seating', unit: null, sub: 'chart' }; seatSel = null; seatPending = null; render(); };
  $('#bar').querySelectorAll('#seatSub [data-sub]').forEach(b => b.onclick = () => { view.sub = b.dataset.sub; seatSel = null; render(); });
  const sp = $('#seatPrint'); if (sp) sp.onclick = () => openSeatPrint(s); const sw = $('#seatWeights'); if (sw) sw.onclick = () => openSeatWeights(s);
  const gc = $('#gradesCats'); if (gc) gc.onclick = () => { const t = $('.gasg'); if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  const cv = $('#csvUnit'); if (cv) cv.onclick = () => downloadUnitCSV(s, units.find(u => u.name === view.unit));
  const rcb = $('#rcUnit'); if (rcb) rcb.onclick = () => openReceipt(s, view.unit);
}
function renderRosterPanel(s) {
  const wrap = $('#gridwrap');
  wrap.innerHTML = `<div class="rpanel">
    <div class="rp-l">
      <h3>Paste the roster for ${esc(s.label)}</h3>
      <p>Select the student names in the FOCUS gradebook (ID columns and all), copy, and paste here — one student per line, in FOCUS order. Tally will match them to the ${plural(s.students.length, 'IXL name')} in this export.</p>
      <textarea id="rpText" placeholder="Doe, Jane&#10;Smith, John&#10;…" ${state.settings.hideNames ? 'disabled' : ''}>${esc(s.roster)}</textarea>
      ${state.settings.hideNames ? '<p class="warnline">Names are hidden — turn on Show names to paste a roster.</p>' : ''}
      <div class="rp-actions"><button class="pill" id="rpSave">Save roster</button><button class="pill pale" id="rpSkip">Show scores without a roster</button></div>
    </div>
    <div class="rp-r"><div class="report" id="rpReport">${matchReport(s, s.roster)}</div></div>
  </div>`;
  const ta = $('#rpText');
  ta.oninput = () => { $('#rpReport').innerHTML = matchReport(s, ta.value); };
  if (!state.settings.hideNames && !coarse()) ta.focus();
  $('#rpSave').onclick = () => { const txt = ta.value; if (!parseRosterText(txt).length) { toast("Couldn't read any names in that paste.", true); return; } s.roster = txt; s.rosterAt = new Date().toISOString(); s.skipRoster = false; if (s.pool) materialize(s); save(); render(); toast('Roster saved', false); };
  $('#rpSkip').onclick = () => { s.skipRoster = true; save(); render(); };
}
// The unit view's skill names are vertical text wrapped onto a few lines. The header is only as tall as this unit's longest
// name needs (a unit of short names gets a short header) and no name is ever cut: grow the line length until all fit.
function fitSkillHeads(wrap) {
  const tbl = wrap.querySelector('table.grid'); const rots = [...wrap.querySelectorAll('th.skill .rot')]; if (!tbl || !rots.length) return;
  let hgt = 84; tbl.style.setProperty('--skh', hgt + 'px');
  while (hgt < 220 && rots.some(e => e.scrollWidth > e.clientWidth + 1)) { hgt += 12; tbl.style.setProperty('--skh', hgt + 'px'); }
}
function renderGrid() {
  const s = state.sections[state.active]; const units = unitsOf(s); const allRows = buildRows(s); const t = s.threshold;
  const rs = rosterState(s);
  if (!rs.count && !s.skipRoster && !s.placeholder && view.mode === 'units') return renderRosterPanel(s);
  if (view.mode === 'grades') { if (!s.grades) { view = { mode: 'units', unit: null }; return renderGrid(); } return renderGrades(s); }
  if (view.mode === 'seating') return renderSeating(s);
  const q = norm(search);
  const rows = allRows.map((r, i) => ({ ...r, n: i + 1 })).filter(r => !q || norm(r.display).includes(q) || norm(r.sub).includes(q));
  const wrap = $('#gridwrap');
  const nameCell = r => `<td class="stu"><div class="stuname">${r.status === 'ok' && r.tier === 'loose' ? `<button class="nm nmbtn" data-fix="${esc(r.display)}" title="Matched loosely to ${esc(shown(r.ixlName))} — tap to change">${esc(shown(r.display))}</button>` : r.status === 'ok' || r.status === 'rosterOnly' ? `<button class="nm nmbtn" data-prof="${esc(r.display)}" title="Open ${esc(shown(r.display))}'s page: grades, trends, what-ifs">${esc(shown(r.display))}</button>` : `<span class="nm">${esc(shown(r.display))}</span>`}${
      r.status === 'rosterOnly' && s.pool && s.awaitingPool ? '' :   // the course export hasn't arrived: nobody is "not in IXL" yet
      r.status === 'rosterOnly' ? `<button class="flag" data-fix="${esc(r.display)}">NOT IN IXL — FIX</button>` :
      r.status === 'ambiguous' ? `<button class="flag amb" data-fix="${esc(r.display)}">TWO MATCHES — PICK</button>` :
      r.status === 'noAccount' ? `<button class="flag quiet" data-fix="${esc(r.display)}" title="Tap to match this student to an IXL account">no IXL account</button>` :
      r.status === 'ixlOnly' ? `<button class="flag" data-ignore="${esc(r.key)}">NOT ON ROSTER — FIX</button>` :
      (r.sub && !state.settings.hideNames ? `<span class="sub">${esc(r.sub)}</span>` : '')}</div></td>`;
  if (view.mode === 'units') {
    const onlyCur = state.settings.onlyCurrent[s.prep] && units.some(u => u.current);
    const shownUnits = onlyCur ? units.filter(u => u.current) : units.filter(u => !u.hidden || state.settings.showAllUnits);
    const checks = reconcile(s);
    let h = `<table class="grid"><thead><tr><th class="idx" scope="col">#</th><th class="stu" scope="col">Student</th>`;
    // One slot per line so every title in the header row sits on the same baseline: title, one-line subtitle, one status
    // (the Focus badge, else when it was copied, else a closed-quarter / now / upcoming tag), then Copy for assigned units.
    shownUnits.forEach(u => { const ui = units.indexOf(u); const uq = unitClosed(s, u) ? unitQuarter(s, u) : null; const rc = checks.find(x => x.unit.name === u.name); const bad = rc ? rc.counts.differ + rc.counts.missing + (rc.maxOK ? 0 : 1) : 0;
      const stat = rc ? `<button class="fcheck ${bad ? 'bad' : rc.counts.stale ? 'stale' : 'ok'}" data-fc="${esc(u.name)}" title="Compare with the Focus column">${!rc.maxOK ? 'Focus: points differ' : bad ? `Focus: ${plural(rc.counts.differ + rc.counts.missing, 'student')} off` : rc.counts.stale ? `Focus: ${rc.counts.stale} up since copy` : rc.counts.accepted ? `Focus ✓ · ${rc.counts.accepted} kept` : 'Focus ✓'}</button>`
        : uq ? `<span class="qtag" title="Quarter ${uq} is closed: this unit is still tracked but raises no alerts">Q${uq} closed</span>`
        : s.receipts[u.name] ? `<button class="rlink" data-rc="${esc(u.name)}" title="What was copied to Focus, and when">copied ${fmtDate(s.receipts[u.name].at.slice(0, 10))}</button>`
        : u.upcoming ? '<span class="utag">upcoming</span>' : u.current ? '<span class="utag now">now</span>' : '';
      h += `<th class="unit ${u.hidden ? 'quiet' : ''} ${u.upcoming ? 'upcoming' : ''} ${u.current ? 'current' : ''} ${uq ? 'qclosed' : ''}" scope="col"><div class="uh"><button class="ulink" data-u="${ui}" aria-label="Open ${esc(u.short)}${u.title ? ' — ' + esc(u.title) : ''}, out of ${u.total}" title="${esc(u.title)} · out of ${u.total}"><span class="t">${esc(u.short)}</span><span class="s">${esc(u.title)}</span></button><span class="ustat">${stat}</span><span class="usub det">out of ${u.total}${u.idx.length !== u.total ? ` · ${u.idx.length - u.total} skipped` : ''}${rc && s.receipts[u.name] ? ` · <button class="rlink" data-rc="${esc(u.name)}" title="What was copied to Focus, and when">copied ${fmtDate(s.receipts[u.name].at.slice(0, 10))}</button>` : ''}</span><span class="uact"><button class="copy${u.upcoming ? ' det' : ''}" data-c="${ui}" ${s.placeholder ? 'disabled' : ''} aria-label="Copy ${esc(u.short)} points"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</button></span></div></th>`; });
    h += `</tr></thead><tbody>`;
    if (!rows.length) h += `<tr class="nomatch"><td class="idx"></td><td colspan="${shownUnits.length + 1}">No students match “${esc(search)}”.</td></tr>`;
    rows.forEach(r => {
      h += `<tr><td class="idx">${r.n}</td>${nameCell(r)}`;
      shownUnits.forEach(u => {
        const ui = units.indexOf(u);
        if (r.ixl == null) { h += `<td class="pts na ${u.hidden ? 'quiet' : ''}">—</td>`; return; }
        const p = points(s, u, r.ixl); const tot = totalFor(s, u, r.ixl);
        h += `<td class="pts ${p === tot && tot ? 'full' : p === 0 ? 'zero' : ''} ${u.hidden ? 'quiet' : ''} ${tot !== u.total ? 'own' : ''}" data-u="${ui}" tabindex="0" role="button" aria-label="${esc(u.short)}: ${p} of ${tot} — open"><span class="v">${p}<small>/${tot}</small></span></td>`;
      });
      h += `</tr>`;
    });
    h += `</tbody><tfoot><tr><td class="idx"></td><td class="stu">Class average</td>`;
    shownUnits.forEach(u => { let sum = 0, n = 0; allRows.forEach(r => { if (r.ixl != null) { sum += points(s, u, r.ixl); n++; } }); h += `<td>${n ? (sum / n).toFixed(1) : '—'}</td>`; });
    h += `</tr></tfoot></table>`;
    wrap.innerHTML = h;
    wrap.querySelectorAll('[data-u]').forEach(el => { el.onclick = () => { view = { mode: 'unit', unit: units[+el.dataset.u].name }; render(); wrap.scrollTop = 0; }; if (el.tagName === 'TD') el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } }; });
    wrap.querySelectorAll('[data-c]').forEach(el => el.onclick = (e) => { e.stopPropagation(); copyUnit(s, units[+el.dataset.c]); });
    wrap.querySelectorAll('[data-fc]').forEach(el => el.onclick = (e) => { e.stopPropagation(); openFocusCheck(s, el.dataset.fc); });
    wrap.querySelectorAll('[data-rc]').forEach(el => el.onclick = (e) => { e.stopPropagation(); openReceipt(s, el.dataset.rc); });
  } else {
    const u = units.find(u => u.name === view.unit); if (!u) { view = { mode: 'units', unit: null }; return renderGrid(); }
    const lessons = []; u.idx.forEach(k => { const L = s.skills[k].lesson; const last = lessons[lessons.length - 1]; if (last && last.name === L) last.n++; else lessons.push({ name: L, n: 1 }); });
    let h = `<table class="grid"><thead><tr class="lessons"><th class="idx"></th><th class="stu"></th><th class="ptsd"></th>`;
    lessons.forEach(L => { const m = L.name.match(/^Lesson\s+([\d.]+)/i); const rest = m ? L.name.slice(m[0].length).replace(/^[:\s]+/, '') : L.name;   // a lesson over one or two skills has room for its number, not for "1.2 CONVE…"
      h += `<th class="lname" colspan="${L.n}" scope="colgroup" title="${esc(L.name)}">${esc(m ? (L.n >= 3 ? m[1] + ' ' + rest : m[1]) : L.name)}</th>`; });
    h += `</tr><tr class="skills"><th class="idx" scope="col">#</th><th class="stu" scope="col"><div class="ukey" aria-hidden="true"><span><i class="lp"></i>At goal</span><span><i class="ll"></i>Below goal</span><span><i class="ln"></i>Not started</span><span><i class="lx"></i>Skipped</span><small>Tap a skill to skip it for the course, a cell to skip it for one student.</small></div>Student</th><th class="ptsd" scope="col">Points<br><span class="usub">of ${u.total}</span></th>`;
    u.idx.forEach(k => { const sk = s.skills[k]; const off = !!s.excluded[skillKey(sk)]; h += `<th class="skill ${off ? 'off' : ''}" scope="col"><button data-x="${k}" aria-pressed="${off}" aria-label="${esc(sk.name)}${off ? ' (excluded)' : ''}"><span class="rot">${esc(sk.name)}</span><span class="sid">${esc(sk.id)}</span></button></th>`; });
    h += `</tr></thead><tbody>`;
    if (!rows.length) h += `<tr class="nomatch"><td class="idx"></td><td colspan="${u.idx.length + 2}">No students match “${esc(search)}”.</td></tr>`;
    rows.forEach(r => {
      h += `<tr><td class="idx">${r.n}</td>${nameCell(r)}`;
      if (r.ixl == null) { h += `<td class="ptsd">—</td>` + u.idx.map(() => `<td class="sc none">—</td>`).join('') + `</tr>`; return; }
      const tot = totalFor(s, u, r.ixl); h += `<td class="ptsd">${points(s, u, r.ixl)}${tot !== u.total ? `<small>/${tot}</small>` : ''}</td>`;
      const mySkips = s.studentSkips[ixlKeyAt(s, r.ixl)] || {};
      u.idx.forEach(k => { const cur = s.scores[k][r.ixl]; const v = eff(s, k, r.ixl); const kk = skillKey(s.skills[k]); const off = s.excluded[kk] ? ' off' : mySkips[kk] ? ' off own' : ''; const dc = ` data-cell="${k}|${r.ixl}" tabindex="0" role="button" aria-label="${esc(s.skills[k].name)}: ${v == null ? 'not started' : v} — ${mySkips[kk] ? 'counting again' : 'skip for this student'}"`; const hist = v != null && v !== cur ? ' best' : ''; const tt = hist ? ` title="Best score ${v} from an earlier export; now ${cur == null ? 'blank' : cur}"` : ''; if (v == null) h += `<td class="sc none${off}"${dc}>·</td>`; else if (v >= t) h += `<td class="sc pass${off}${hist}"${tt}${dc}>${v}</td>`; else h += `<td class="sc low${off}${hist}"${tt}${dc}>${v}</td>`; });
      h += `</tr>`;
    });
    h += `</tbody><tfoot><tr><td class="idx"></td><td class="stu">% of class at goal</td><td class="ptsd"></td>`;
    u.idx.forEach(k => { let n = 0, p = 0; allRows.forEach(r => { if (r.ixl != null) { n++; const v = eff(s, k, r.ixl); if (v != null && v >= t) p++; } }); h += `<td>${n ? Math.round(p / n * 100) + '%' : '—'}</td>`; });
    h += `</tr></tfoot></table>`;
    wrap.innerHTML = h;
    fitSkillHeads(wrap);
    wrap.querySelectorAll('[data-x]').forEach(el => el.onclick = () => {
      const sk = s.skills[+el.dataset.x]; const key = skillKey(sk);
      if (s.excluded[key]) delete s.excluded[key]; else s.excluded[key] = true;
      resnapshotPrep(s.prep); save(); const st = wrap.scrollLeft; render(); $('#gridwrap').scrollLeft = st;
      const uu = unitsOf(s).find(x => x.name === view.unit);
      toast(`${s.excluded[key] ? 'Skipped' : 'Counting'} <b>${esc(sk.name)}</b> for every ${s.prep === 'acc' ? 'accelerated' : 'on-level'} class · ${esc(uu.short)} is now out of <b>${uu.total}</b>`, false);
    });
  }
  wrap.querySelectorAll('[data-cell]').forEach(el => { el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } }; });
  wrap.querySelectorAll('[data-cell]').forEach(el => el.onclick = () => {
    const [k, si] = el.dataset.cell.split('|').map(Number); const sk = s.skills[k]; const kk = skillKey(sk);
    if (s.excluded[kk]) { toast('That skill is skipped for the whole course.', false); return; }
    const key = ixlKeyAt(s, si); s.studentSkips[key] = s.studentSkips[key] || {};
    if (s.studentSkips[key][kk]) delete s.studentSkips[key][kk]; else s.studentSkips[key][kk] = true;
    if (!Object.keys(s.studentSkips[key]).length) delete s.studentSkips[key];
    snapshot(s); save(); const st = wrap.scrollLeft; render(); $('#gridwrap').scrollLeft = st;
    const uu = unitsOf(s).find(x => x.name === view.unit); const row = buildRows(s).find(r => r.ixl === si);
    toast(`${s.studentSkips[key] && s.studentSkips[key][kk] ? 'Skipped' : 'Counting'} <b>${esc(sk.name)}</b> for ${esc(shown(row ? row.display : s.students[si]))} · their ${esc(uu.short)} is out of <b>${totalFor(s, uu, si)}</b> <button class="tundo" id="undoCell">Undo</button>`, false, 6000);
    const un = $('#undoCell'); if (un) un.onclick = () => { s.studentSkips[key] = s.studentSkips[key] || {}; if (s.studentSkips[key][kk]) delete s.studentSkips[key][kk]; else s.studentSkips[key][kk] = true; if (!Object.keys(s.studentSkips[key]).length) delete s.studentSkips[key]; snapshot(s); save(); render(); toast('Undone', false, 1500); };
  });
  wrap.querySelectorAll('[data-ignore]').forEach(el => el.onclick = () => openNotOnRoster(s, el.dataset.ignore));
  wrap.querySelectorAll('[data-fix]').forEach(el => el.onclick = () => openFixer(s, el.dataset.fix));
  wrap.querySelectorAll('[data-prof]').forEach(el => el.onclick = e => { e.stopPropagation(); openProfile(s.key, el.dataset.prof); });
}

/* ---------- match fixer (tap a flag, pick the IXL account) ---------- */
// An IXL account that isn't on the pasted roster is either a new student (the roster is stale — re-paste it, so they
// get a row in the copy) or someone who left / a duplicate account (skip). Copies leave them out until one is chosen.
function openNotOnRoster(s, key) {
  const name = key.replace(/#\d+$/, '');
  const m = $('#modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="panel narrow">
    <header><h2>${esc(shown(ixlDisplay(name)))} is in IXL but not on the roster</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body one">
      <p>Their scores show in the grid, but <b>Copy leaves them out</b> until the roster says where their row goes.</p>
      <div class="choice"><b>New student?</b><p>Re-paste the roster from FOCUS so they get a row in FOCUS order.</p><button class="pill" id="nrRoster">Re-paste roster</button></div>
      <div class="choice"><b>Withdrawn, moved, or a duplicate IXL account?</b><p>Skip them — they leave the grid, copies, and the race. Undo any time in Settings.</p><button class="pill pale" id="nrSkip">Skip this account</button></div>
      <div class="rp-actions"><button class="pill pale" id="mCancel">Not now</button></div>
    </div></div>`;
  const close = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  $('#nrSkip').onclick = () => { s.ignored[key] = true; save(); close(); render(); toast(`${esc(shown(ixlDisplay(name)))} skipped for ${esc(s.label)} — undo in Settings.`, false); };
  $('#nrRoster').onclick = () => { close(); openSettings(); const ta = $('#roster'); if (ta) { ta.focus(); ta.scrollIntoView({ block: 'center' }); } };
}
function openFixer(s, display) {
  const rows = buildRows(s); const row = rows.find(r => r.display === display);
  const usedIdx = new Set(rows.filter(r => r.status === 'ok' && r.ixl != null && r.display !== display).map(r => r.ixl));
  let free = ixlList(s).filter(x => !s.ignored[x.key] && !usedIdx.has(x.i));
  // A pool class matches against the course-wide pool, so its choices are pool entries under their pool keys (a section-local
  // key like "Name#0" could point at the other student of that name once the class has only one of them).
  let cur = row && row.ixl != null ? row.ixl : null;
  if (s.pool && state.pools[s.prep]) { const pr = poolRows(s); const mine = pr.find(r => r.display === display); const others = new Set(pr.filter(r => r.display !== display).map(r => r.ixl)); cur = mine ? mine.ixl : null; free = poolLeftovers(s).filter(x => !others.has(x.i)).map(x => ({ name: x.name, key: '@pool:' + x.key, i: x.i, dup: x.dup, pkey: x.key })); }
  const m = $('#modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="panel narrow">
    <header><h2>Match ${esc(shown(display))}</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body one">
      <p>${row && row.ixl != null ? `Currently matched to <b>${esc(shown(row.ixlName))}</b>. ` : row && row.status === 'noAccount' ? 'Marked as <b>no IXL account</b>. ' : ''}Pick the IXL account for this student${row && row.status === 'noAccount' ? ' if they have one now.' : ', or say they have none — Tally stops flagging them and copies a blank row.'}</p>
      <div class="picks">${free.map(x => `<button class="chip ${cur != null && cur === x.i ? 'on' : ''}" data-pick="${esc(x.key)}">${esc(shown(x.name))}${x.dup ? ` <small>#${(x.pkey || x.key).split('#')[1] * 1 + 1}</small>` : ''}</button>`).join('') || '<em>No unmatched IXL students left.</em>'}</div>
      <div class="rp-actions">${row && row.status === 'noAccount' ? '<button class="pill pale" id="reflag">Flag again</button>' : '<button class="pill pale" id="unmatch">No IXL account</button>'}<button class="pill pale" id="mCancel">Cancel</button></div>
    </div></div>`;
  const close = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { const pick = b.dataset.pick; s.aliases[display] = pick.startsWith('@pool:') ? pick.slice(6) : pick; if (s.pool) materialize(s); save(); close(); render(); toast(`${esc(shown(display))} → ${esc(shown(pick.replace(/^@pool:/, '').replace(/#\d+$/, '')))}`, false); });
  const um = $('#unmatch'); if (um) um.onclick = () => { s.aliases[display] = '#none'; if (s.pool) materialize(s); save(); close(); render(); toast(`${esc(shown(display))} — <b>no IXL account</b>. A blank row is copied; tap the tag to change it.`, false, 4500); };
  const rf = $('#reflag'); if (rf) rf.onclick = () => { delete s.aliases[display]; if (s.pool) materialize(s); save(); close(); render(); };
}

/* ---------- copy ---------- */
function unitColumn(sec, unit, mode) {
  const rows = buildRows(sec).filter(r => r.status !== 'ixlOnly');
  const rc = sec.grades ? reconcile(sec).find(c => c.unit.name === unit.name) : null; const kept = rc ? new Map(rc.rows.filter(x => x.status === 'accepted').map(x => [x.display, x.focus])) : new Map();
  return rows.map(r => {
    const p = r.ixl == null ? '' : String(kept.has(r.display) && kept.get(r.display) != null ? kept.get(r.display) : points(sec, unit, r.ixl));
    const own = r.ixl != null && totalFor(sec, unit, r.ixl) !== unit.total ? '\t/' + totalFor(sec, unit, r.ixl) : '';
    if (mode === 'names') return r.display + '\t' + p + own;
    if (mode === 'ids') return (r.id || '') + '\t' + p + own;
    return p;
  });
}
function downloadUnitCSV(sec, unit) {
  const rows = buildRows(sec).filter(r => r.status !== 'ixlOnly');
  const q = v => { let t = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };   // a name that starts like a formula stays text in Excel
  const lines = [['Student ID', 'Student', 'IXL ' + unit.short, 'Out of', 'Goal', 'Export date'].map(q).join(',')];
  rows.forEach(r => lines.push([r.id || '', r.display, r.ixl == null ? '' : points(sec, unit, r.ixl), r.ixl == null ? '' : totalFor(sec, unit, r.ixl), sec.threshold, sec.date || ''].map(q).join(',')));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv' })); a.download = `${sec.label.replace(/[^\w-]+/g, '_')}_${unit.short.replace(/\s+/g, '')}_${sec.date || ''}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`CSV saved — ${plural(rows.length, 'row')} keyed by student ID${rows.some(r => !r.id) ? ' (some rows have no ID in the pasted roster)' : ''}`, false, 4500);
}
function legacyCopy(text) {
  const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:0;outline:0;box-shadow:none;background:transparent;font-size:16px;opacity:.01';
  document.body.appendChild(ta); ta.focus(); ta.select(); try { ta.setSelectionRange(0, text.length); } catch (e) {}
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); return ok;
}
// When nothing can reach the clipboard (a file opened from a file manager on Android, say), show the column to copy by hand.
function showCopyBox(text, title) {
  const m = $('#modal'); m.classList.remove('hidden'); m.classList.add('private');
  m.innerHTML = `<div class="panel narrow"><header><h2>Copy by hand</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body one"><p>This browser wouldn't let Tally write to the clipboard (it happens when the file is opened from a file manager instead of a web address). Tap <b>Select all</b>, then copy, and paste into the Focus column <b>${esc(title)}</b>.</p>
      <textarea id="copyBox" readonly style="width:100%;min-height:220px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px">${esc(text)}</textarea>
      <div class="rp-actions"><button class="pill" id="copySel">Select all</button><button class="pill pale" id="mCancel">Close</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  $('#copySel').onclick = () => { const ta = $('#copyBox'); ta.focus(); ta.select(); try { ta.setSelectionRange(0, text.length); } catch (e) {} };
}
async function copyUnit(sec, unit) {
  if (sec.placeholder) { toast('Copy is disabled for this export because it has no student names.', true); return; }
  if (!unit.total) { toast(`${esc(unit.short)} has no skills that count — include at least one.`, true); return; }
  const rs = rosterState(sec);
  const rowsAll = buildRows(sec).filter(r => r.status !== 'ixlOnly');
  const anyPts = rowsAll.some(r => r.ixl != null && points(sec, unit, r.ixl) > 0);
  if (!anyPts && !confirm(`Nobody in ${sec.label} has earned a point in ${unit.short} yet. Copy a column of zeros anyway?`)) return;
  const mode = !rs.count ? 'names' : state.settings.copyMode;   // no roster → always a checklist, never a bare column
  const lines = unitColumn(sec, unit, mode); const text = lines.join('\n');
  const modified = rowsAll.filter(r => r.ixl != null && totalFor(sec, unit, r.ixl) !== unit.total).length;
  let ok = false;
  ok = legacyCopy(text);   // synchronous first, while the tap still counts as a user gesture (needed on Android and anywhere without the clipboard API)
  if (!ok && window.isSecureContext && navigator.clipboard) { try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {} }
  const blanks = rowsAll.filter(r => r.ixl == null).length; const leftOut = buildRows(sec).filter(r => r.status === 'ixlOnly').length;
  if (ok) { sec.receipts[unit.name] = { at: new Date().toISOString(), exportDate: sec.date, goal: sec.threshold, outOf: unit.total, skipped: unit.idx.filter(k => !unit.active.includes(k)).map(k => sec.skills[k].name), rows: rowsAll.map(r => [r.display, r.ixl == null ? null : points(sec, unit, r.ixl), r.ixl == null ? null : totalFor(sec, unit, r.ixl)]) }; save(); if (view.mode === 'units') { const sl = $('#gridwrap').scrollLeft; renderGrid(); $('#gridwrap').scrollLeft = sl; } }
  if (ok) toast(`<b>${esc(unit.short)}</b> copied — ${plural(lines.length, 'row')}${rs.count ? ' in FOCUS order' : ' with names (no roster, so order is by last name)'} · FOCUS title: <b>IXL ${esc(unit.short)} · ${fmtDate(sec.date) || 'today'} · /${unit.total}</b>${blanks ? ` · ${plural(blanks, 'blank row')} (not in IXL)` : ''}${leftOut ? ` · <b>${plural(leftOut, 'IXL student')} not on the roster — left out</b> (tap their flag)` : ''}${modified ? ` · <b>${plural(modified, 'student')} on a modified list</b> — set their max by hand in FOCUS` : ''}`, false, (modified || blanks || leftOut) ? 10000 : 6000);   // carries the title to type and who was left out, so it stays long enough to read twice
  else showCopyBox(text, `IXL ${unit.short} · ${fmtDate(sec.date) || 'today'} · /${unit.total}`);
}

/* ---------- Still owed: a printer-friendly, black-and-white page per class ---------- */
function openStillOwed(sec) {
  // Three ways out, each honest about who can see it: slips to hand out (a page per student, full names), one list
  // with initials (safe to post or project), one list with names (for the teacher or a co-teacher).
  const m = $('#modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="panel narrow"><header><h2>Still owed · ${esc(sec.label)}</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body one"><p>What each student still owes in the assigned units, in black and white.</p>
      <div class="rp-actions col">
        <button class="pill" data-owed="slips">Slips to hand out <small>one page per student · full names</small></button>
        <button class="pill pale" data-owed="initials">One list, initials <small>safe to post or project</small></button>
        <button class="pill pale" data-owed="names">One list, full names <small>for you or a co-teacher</small></button>
      </div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.querySelectorAll('[data-owed]').forEach(b => b.onclick = () => { const mode = b.dataset.owed; close(); printStillOwed(sec, mode); });
}
function printStillOwed(sec, mode) {
  const initials = mode === 'initials', slips = mode === 'slips';
  const all = buildRows(sec).filter(r => r.status !== 'ixlOnly'); const rows = all.filter(r => r.status === 'ok' && r.ixl != null);
  const units = unitsOf(sec).filter(u => u.assigned && u.total && !unitClosed(sec, u)); const t = sec.threshold;   // a closed quarter's units aren't owed any more
  const nm = r => initials ? mask(r.display) : r.display;
  const block = r => {
    if (r.ixl == null) return `<section class="stu"><h2>${esc(nm(r))}</h2><div class="l">${r.status === 'noAccount' ? 'No IXL account.' : `Not matched to an IXL account — check the roster in Tally (${r.status === 'ambiguous' ? 'two IXL names fit' : 'no IXL name fits'}).`}</div></section>`;
    const per = units.map(u => {
      const own = activeFor(sec, u, r.ixl); const p = points(sec, u, r.ixl);
      const below = own.filter(k => { const v = eff(sec, k, r.ixl); return v != null && v < t; }).map(k => `${sec.skills[k].name} (${eff(sec, k, r.ixl)})`);
      const notStarted = own.filter(k => eff(sec, k, r.ixl) == null).map(k => sec.skills[k].name);
      return `<div class="u"><div class="uh"><b>${esc(u.short)}</b> ${esc(u.title)} <span class="pts">${p} / ${own.length}</span></div>
        ${below.length ? `<div class="l"><span>Below goal (${t}):</span> ${esc(below.join(' · '))}</div>` : ''}
        ${notStarted.length ? `<div class="l"><span>Not started:</span> ${esc(notStarted.join(' · '))}</div>` : ''}
        ${!below.length && !notStarted.length ? `<div class="l done">All ${own.length} skills at goal</div>` : ''}</div>`;
    }).join('');
    return `<section class="stu"><h2>${esc(nm(r))}</h2>${per || '<div class="l">No units assigned yet.</div>'}</section>`;
  };
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Still owed — ${esc(sec.label)}</title>
<style>
@page{margin:.6in}
body{font-family:Georgia,'Times New Roman',serif;color:#000;background:#fff;margin:24px;font-size:11.5pt;line-height:1.35}
h1{font-size:16pt;margin:0 0 2px;font-family:Arial,Helvetica,sans-serif}
.meta{font-size:9.5pt;margin:0 0 14px;font-family:Arial,Helvetica,sans-serif}
.stu{border-top:1.5px solid #000;padding:6px 0 8px;break-inside:avoid;page-break-inside:avoid}${slips ? '.stu{break-before:page;page-break-before:always;border-top:none;padding-top:0}.stu:first-of-type{break-before:auto;page-break-before:auto}' : ''}
.stu h2{font-size:13pt;margin:0 0 4px;font-family:Arial,Helvetica,sans-serif}
.u{margin:2px 0 4px 10px}
.uh{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt}
.uh .pts{float:right;font-weight:bold}
.l{margin:1px 0 0 14px;font-size:10.5pt}
.l span{font-weight:bold}
.l.done{font-style:italic}
.bar{position:fixed;top:0;right:0;padding:8px;background:#fff;font-family:Arial,sans-serif}
.bar button{font:inherit;padding:6px 14px}
@media print{.bar{display:none}}
</style></head><body>
<div class="bar"><button onclick="window.print()">Print</button></div>
<h1>Still owed · ${esc(sec.label)}</h1>
<p class="meta">IXL export of ${fmtDate(sec.date) || '?'} · goal SmartScore ${t} · one point per skill · ${plural(rows.length, 'student')}${all.length > rows.length ? ` (${all.length - rows.length} not matched to IXL)` : ''} · ${units.length ? 'assigned: ' + esc(units.map(u => u.short).join(', ')) : 'no units assigned'}${initials ? ' · initials' : ''}${slips ? ' · one page per student' : ''}</p>
${all.map(block).join('')}
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = `Still-owed_${sec.label.replace(/[^\w-]+/g, '_')}.html`; a.click(); toast('Pop-ups are blocked, so the page was saved as a file instead.', false, 5000); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

/* ---------- Guide: one printable page for you and the co-teacher ---------- */
function openGuide() {
  const secs = state.order.map(k => state.sections[k]);
  const thrs = [...new Set(secs.map(s => `${s.prep === 'acc' ? 'accelerated' : 'on-level'} ${s.threshold}`))];
  const goalLine = thrs.length ? thrs.join(', ') : `on-level ${DEFAULT_THR.on}, accelerated ${DEFAULT_THR.acc}`;
  const remind = state.settings.remindDays;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Tally — one-page guide</title>
<style>
@page{margin:.55in}
body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;margin:24px auto;max-width:8in;font-size:10.5pt;line-height:1.4}
h1{font-size:20pt;margin:0;letter-spacing:.06em}
.sub{font-size:10pt;margin:2px 0 14px}
h2{font-size:11.5pt;margin:14px 0 4px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1.5px solid #000;padding-bottom:2px}
ol,ul{margin:4px 0;padding-left:20px}
li{margin:2px 0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}
dl{margin:4px 0;display:grid;grid-template-columns:auto 1fr;gap:2px 10px}
dt{font-weight:bold;white-space:nowrap}
dd{margin:0}
.box{border:1.5px solid #000;padding:8px 12px;margin-top:6px}
.bar{position:fixed;top:0;right:0;padding:8px;background:#fff}
.bar button{font:inherit;padding:6px 14px}
@media print{.bar{display:none}body{margin:0}}
</style></head><body>
<div class="bar"><button onclick="window.print()">Print</button></div>
<h1>TALLY</h1>
<p class="sub">IXL Score Grid → one grade per unit in Focus. One point per skill at goal (goal SmartScore: ${esc(goalLine)}). Everything stays in this browser; nothing is uploaded anywhere.</p>

<div class="two">
<div>
<h2>Every week or two</h2>
<ol>
<li><b>Export</b> from IXL: Analytics → Score Grid → This school year → Export — one file per course (every student in it) or one per class, both work. From Focus: gradebook → Export, one per period.</li>
<li><b>Import</b> all of them at once (button or drag onto the page). Newer exports replace older; best scores are kept.</li>
<li>Look at the <b>notices</b> under the class chips: roster mismatches, "Focus doesn't match Tally", old exports (reminder: ${remind ? 'after ' + remind + ' days' : 'off'}).</li>
<li>Tap <b>Copy</b> on a unit → paste into that unit's Focus column (rows are already in Focus order). The unit header then shows <i>copied ‹date›</i>.</li>
<li>After the next Focus export, each unit's <b>Focus badge</b> says ✓, "N up since copy", or "N off" — tap it to see who, and <b>Copy corrections</b>.</li>
<li><b>Save a backup</b> to your school Drive (Overview → <i>Back up</i>, or Settings). It is how the laptop and the tablet stay in step, and the only copy if this browser's storage is cleared.</li>
</ol>
<h2>Once per class</h2>
<ol>
<li>The <b>roster</b> comes from the Focus gradebook automatically (with IDs). With a course-wide IXL export, a new gradebook offers <b>+ New class</b>: pick the period and course once. You can still paste a roster in Settings.</li>
<li>Fix any flag on a name: <b>Not in IXL</b>, <b>Two matches</b>, <b>Not on roster</b>.</li>
<li>Mark units <b>Not assigned</b> (open the unit, top bar). This applies to every class in the course.</li>
<li>For a unit where only the lesson skills were required, open the Focus check and accept <b>Skip N skills to match Focus</b>, or tap skills in the unit view to skip them.</li>
</ol>
</div>
<div>
<h2>Words on the screen</h2>
<dl>
<dt>Goal</dt><dd>The SmartScore a skill must reach to earn its point.</dd>
<dt>Skip</dt><dd>A skill that doesn't count — for the class (tap the skill) or one student (tap their cell).</dd>
<dt>Grades</dt><dd>After a Focus gradebook is loaded: the real course grade (weighted categories, proved against the Focus Grade column), trends since the last import, sliding students, IXL against assessment scores, and per-student what-ifs — turn in, retake, next assessment — with a printable one-student page. Categories are proved from the Grade column where possible; move any assignment from its row.</dd>
<dt>Students</dt><dd>Header button (teacher only). Every student of every class with their grade, change, missing work and IXL; tap one for their page: this quarter's grade and each closed quarter's final, the grade, categories, missing work and IXL over the year, every assignment and assessment, IXL still owed by unit, and what would move the grade, starting with the <b>quickest way to the next letter</b> — missing work and IXL first. <b>Show student</b> turns the screen toward them: only their numbers, switches and sliders to try turning work in, retakes and the next test. Hold the exit button to leave.</dd>
<dt>Quarters</dt><dd>When a quarter ends (2026–27: Oct 9, Dec 18, Mar 4, May 28), close it from the Overview. Tally keeps a copy of every class's gradebook for that quarter and goes quiet about it: no missing counts, sliding, Focus checks or still-owed lines for its work or its IXL units. Open it any time under Grades → Q1 and on each student's page. If the next quarter's export arrives first, the old quarter is kept automatically.</dd>
<dt>Working in</dt><dd>Pick the unit each course is on (the selector on the class bar). Every unit up to it counts toward the Race and Focus check; later units stay listed as <i>upcoming</i> so you can see who's working ahead. The first on-level unit is a review unit and never counts (change in Settings).</dd>
<dt>Assigned</dt><dd>Tap a unit's Assigned button to override the rule for that unit either way. Units you unassign leave the grid; the unassigned-units button brings them back.</dd>
<dt>Best</dt><dd>A score from an earlier export that was higher than today's. Points once earned are kept.</dd>
<dt>Copied</dt><dd>A receipt of exactly what went to Focus, and when. Tap it to see who has moved since.</dd>
<dt>Focus ✓ / off</dt><dd>Whether the Focus column matches what Tally counts today.</dd>
<dt>Seating</dt><dd>Draw the room once (templates, drag, rotate — shared by every class), then generate seating for a class: the solver weighs talkers, front-seat and near-teacher flags, keep-apart (hard) and seat-near links, and each student's standing — Priorities → Place by chooses the blend, FAST only, the Focus grade, assessments only, or IXL progress. Tap a student to see why they're there, lock them, or tap a second desk to swap — every move reports what it fixes and breaks. Print a teacher copy or a student/sub copy.</dd>
<dt>Still owed</dt><dd>Printable black-and-white list of what each student is missing, by unit.</dd>
<dt>Race</dt><dd>Student screen: classes ranked by the share of students who reached at least one more skill since last week (average gain breaks ties), so a class that starts behind can still win and one student can't swing it. The bar shows assigned work at goal. Names never show. Hold the exit button to leave.</dd>
<dt>Data Lab</dt><dd>Student screen: box plot, dot plot, histogram, stem-and-leaf, bar, circle or line graph of any unit, skill, assignment, or class-collected data set, in points or percents — no names, and Focus scores only as aggregates.</dd>
<dt>Names</dt><dd>Header toggle. Off = initials only, for projecting.</dd>
</dl>
<h2>For a co-teacher</h2>
<ul>
<li>Open the class chip, tap <b>Still owed</b>, choose initials or names, print. That's the whole job.</li>
<li>Turn <b>Names</b> off before projecting anything.</li>
<li>On a shared computer: Settings → <b>Clear all Tally data</b> when done.</li>
</ul>
<div class="box"><b>If something looks wrong:</b> the file name tells Tally the class and date, so don't rename IXL exports. "Points possible differ" means Focus and Tally disagree on how many skills count — skip or un-skip until they match, or fix the points in Focus.</div>
</div>
</div>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = 'Tally-guide.html'; a.click(); toast('Pop-ups are blocked, so the guide was saved as a file instead.', false, 5000); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

/* ---------- Receipt: what was copied to Focus for a unit, and what has changed since ---------- */
function openReceipt(sec, unitName) {
  const rc = sec.receipts[unitName]; const u = unitsOf(sec).find(x => x.name === unitName); if (!rc || !u) return;
  const m = $('#modal'); m.classList.remove('hidden');
  const H = state.settings.hideNames; const nm = d => esc(H ? mask(d) : d);
  const rows = buildRows(sec).filter(r => r.status !== 'ixlOnly');
  const now = new Map(rows.map(r => [r.display, r.ixl == null ? null : points(sec, u, r.ixl)]));
  const list = rc.rows.map(([d, p, own]) => { const cur = now.has(d) ? now.get(d) : undefined; const diff = p != null && cur != null ? cur - p : 0; return { d, p, own, cur, diff, gone: !now.has(d) }; });
  const up = list.filter(x => x.diff > 0).length, down = list.filter(x => x.diff < 0).length, gone = list.filter(x => x.gone).length;
  const line = x => `<tr class="${x.diff > 0 ? 'stale' : x.diff < 0 ? 'down' : ''}"><td>${nm(x.d)}</td><td>${x.p == null ? '<i>blank</i>' : x.p + (x.own !== rc.outOf ? ` <small>/${x.own}</small>` : '')}</td><td>${x.gone ? '<i>not on the roster now</i>' : x.cur == null ? '—' : x.cur}</td><td>${x.diff > 0 ? 'up ' + x.diff : x.diff < 0 ? 'down ' + (-x.diff) : ''}</td></tr>`;
  m.innerHTML = `<div class="panel"><header><h2>Copied · ${esc(u.short)}</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body one">
      <p><b>${fmtTime(rc.at)}</b> · from the IXL export of ${fmtDate(rc.exportDate) || '?'} · goal ${rc.goal} · out of ${rc.outOf}${rc.skipped && rc.skipped.length ? ` · ${plural(rc.skipped.length, 'skill')} skipped` : ''} · ${plural(rc.rows.length, 'row')}.</p>
      ${rc.goal !== sec.threshold || rc.outOf !== u.total ? `<p class="warnline">Since then: ${rc.goal !== sec.threshold ? `the goal changed (${rc.goal} → ${sec.threshold})` : ''}${rc.goal !== sec.threshold && rc.outOf !== u.total ? ' and ' : ''}${rc.outOf !== u.total ? `the unit is now out of ${u.total}` : ''}. Focus has the old column until you copy again.</p>` : ''}
      <p class="checkSummary">${up ? `<span class="stale">${plural(up, 'student')} up since</span>` : '<span class="ok">Nobody has moved up since</span>'}${down ? ` · <span class="bad">${down} down</span>` : ''}${gone ? ` · ${gone} no longer on the roster` : ''}</p>
      ${rc.skipped && rc.skipped.length ? `<p><small>Skipped when copied: ${esc(rc.skipped.join(' · '))}</small></p>` : ''}
      <table class="checkTable"><thead><tr><th>Student</th><th>Copied</th><th>Now</th><th></th></tr></thead><tbody>${list.map(line).join('')}</tbody></table>
      <div class="rp-actions"><button class="pill" id="rcCopy">Copy ${esc(u.short)} again</button><button class="pill pale" id="mCancel">Close</button></div>
    </div></div>`;
  const close = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; render(); };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  $('#rcCopy').onclick = () => { close(); copyUnit(sec, u); };
}

/* ---------- Focus check: does what's in the gradebook match what Tally computes? ---------- */
function gbUnitFor(sec, a) {
  const manual = (sec.gbUnitMap || {})[a.name]; if (manual === '') return null;
  const units = unitsOf(sec);
  if (manual) return units.find(u => u.name === manual) || null;
  if (!/\bixl\b/i.test(a.name) && a.category !== 'IXL') return null;
  const m = a.name.match(/\bunit\s*(\d+)\b/i); if (!m) return null;
  return units.find(u => u.short === 'Unit ' + m[1]) || null;
}
// Gradebook rows → IXL student indices, using the same matcher as the roster (names and IDs come from the same Focus screen)
function gbRows(sec) {
  if (!sec.grades) return [];
  const roster = sec.grades.students.join('\n');
  const rows = buildRows({ ...sec, roster }).slice(0, sec.grades.students.length);
  return rows;
}
function reconcile(sec) {
  if (!sec.grades) return [];
  const rows = gbRows(sec); const out = [];
  sec.grades.assignments.forEach(a => {
    const u = gbUnitFor(sec, a); if (!u || !u.assigned) return;
    if (aClosed(a, sec.grades)) return;   // a closed quarter's IXL column isn't checked any more (an open column for a closed unit still is)   // an unassigned unit isn't checked even if Focus has a column for it
    const rc = sec.receipts[u.name];
    const list = rows.map((r, i) => {
      const focus = a.values[i]; const excused = focus == null && a.excused && /^(ng|x|ex|e|i|exc|excused|exempt)$/i.test(String((sec.grades.raw || {})[a.name] ? sec.grades.raw[a.name][i] : ''));
      if (r.ixl == null) return { display: r.display, focus, tally: null, own: null, status: 'unmatched' };
      const tally = points(sec, u, r.ixl), own = totalFor(sec, u, r.ixl);
      const rcv = rc ? (rc.rows.find(x => x[0] === r.display) || [])[1] : undefined;
      let status = 'match';
      if (focus == null) status = tally > 0 ? 'missing' : 'match';
      else if (Math.abs(focus - tally) < 0.01) status = 'match';
      else if (rcv != null && Math.abs(focus - rcv) < 0.01) status = 'stale';   // Focus has exactly what was copied; the student moved since
      else status = 'differ';
      const ov = overrideFor(sec, u.name, r.display); const honoured = ov && status !== 'match' && ((ov.focus == null && focus == null) || (ov.focus != null && focus != null && Math.abs(ov.focus - focus) < 0.01));
      if (honoured) status = 'accepted';   // the teacher chose Focus's number on purpose; it stays quiet until Focus changes
      return { display: r.display, id: r.id, focus, tally, own, receipt: rcv, status, override: honoured ? ov : null, staleOverride: ov && !honoured && status !== 'match' ? ov : null };
    });
    const n = k => list.filter(x => x.status === k).length;
    out.push({ unit: u, assignment: a, rows: list, maxOK: a.max == null || a.max === u.total, counts: { match: n('match'), stale: n('stale'), differ: n('differ'), missing: n('missing'), unmatched: n('unmatched'), accepted: n('accepted') }, copiedAt: rc ? rc.at : null });
  });
  return out;
}
function openFocusCheck(sec, unitName) {
  const all = reconcile(sec); const rc = all.find(x => x.unit.name === unitName); if (!rc) return;
  const m = $('#modal'); m.classList.remove('hidden');
  const H = state.settings.hideNames; const nm = d => esc(H ? mask(d) : d);
  const bad = rc.rows.filter(r => r.status !== 'match' && r.status !== 'accepted'); const kept = rc.rows.filter(r => r.status === 'accepted');
  const line = r => `<tr class="${r.status}"><td>${nm(r.display)}</td><td>${r.focus == null ? '<i>blank</i>' : fmtN(r.focus)}</td><td>${r.tally == null ? '—' : fmtN(r.tally) + (r.own !== rc.unit.total ? ` <small>/${r.own}</small>` : '')}</td><td>${r.status === 'match' ? '' : r.status === 'stale' ? `matches what you copied${rc.copiedAt ? ' ' + fmtDate(rc.copiedAt.slice(0, 10)) : ''}; up ${fmtN(r.tally - r.focus)} since` : r.status === 'missing' ? 'nothing in Focus yet' : r.status === 'unmatched' ? 'not found in IXL' : 'Focus differs from Tally'}${r.staleOverride ? ` <small class="ghint">(you kept ${r.staleOverride.focus == null ? 'blank' : fmtN(r.staleOverride.focus)} on ${esc(fmtDate((r.staleOverride.at || '').slice(0, 10)))} — Focus has changed since)</small>` : ''}</td><td>${r.status === 'unmatched' ? '' : `<button class="pill pale small" data-keep="${esc(r.display)}" title="Focus is right for this student — stop flagging it">Keep Focus</button>`}</td></tr>`;
  m.innerHTML = `<div class="panel"><header><h2>Focus check · ${esc(rc.unit.short)}</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body one">
      <p><b>Focus "${esc(rc.assignment.name)}"</b> (${rc.assignment.max != null ? rc.assignment.max + ' points' : 'points unknown'}) vs <b>Tally ${esc(rc.unit.short)}</b> (out of ${rc.unit.total}${rc.copiedAt ? ', copied ' + fmtDate(rc.copiedAt.slice(0, 10)) : ', never copied'}).
      ${rc.maxOK ? '' : `<span class="warnline">Points possible don't agree: Focus says ${rc.assignment.max}, Tally counts ${rc.unit.total} skills.</span>`}</p>
      ${(() => { if (rc.maxOK || rc.assignment.max == null) return ''; const diff = rc.unit.total - rc.assignment.max; if (diff <= 0) return `<p>Tally counts fewer skills than the Focus assignment is worth — un-skip ${plural(-diff, 'skill')} in the unit view, or change the assignment's points in Focus.</p>`;
        // the skills fewest students touched are almost always the "also consider" extras that weren't required
        const pop = population(sec); const cand = rc.unit.active.map(k => ({ k, n: pop.filter(x => sec.scores[k][x.i] != null).length })).sort((a, b) => a.n - b.n || a.k - b.k).slice(0, diff);
        const sug = new Set(cand.map(c => c.k)); const all = rc.unit.active.map(k => ({ k, n: pop.filter(x => sec.scores[k][x.i] != null).length })).sort((a, b) => a.n - b.n || a.k - b.k);
        return `<div class="report skipPick"><b>Skip ${plural(diff, 'skill')} to match Focus?</b> Tick the skills that weren't required — the ${diff} fewest students touched are pre-ticked (usually the "also consider" extras). Applies to every ${sec.prep === 'acc' ? 'accelerated' : 'on-level'} class.
          <div class="skipList">${all.map(c => `<label><input type="checkbox" data-sk="${c.k}" ${sug.has(c.k) ? 'checked' : ''}> ${esc(sec.skills[c.k].name)} <small>${c.n} of ${pop.length}</small></label>`).join('')}</div>
          <p class="ghint" id="skipCount"></p><button class="pill small" id="skipCand">Skip the ticked skills</button></div>`; })()}
      <p class="checkSummary"><span class="ok">${rc.counts.match} match</span>${rc.counts.stale ? ` · <span class="stale">${rc.counts.stale} up since you copied</span>` : ''}${rc.counts.differ ? ` · <span class="bad">${rc.counts.differ} differ</span>` : ''}${rc.counts.missing ? ` · <span class="bad">${rc.counts.missing} blank in Focus</span>` : ''}${rc.counts.unmatched ? ` · ${rc.counts.unmatched} not matched to IXL` : ''}</p>
      <div class="field"><label>This Focus column is</label><select id="gbMap">${[['', '— not an IXL unit —']].concat(unitsOf(sec).map(u => [u.name, u.short + (u.title ? ' · ' + u.title : '')])).map(([v, l]) => `<option value="${esc(v)}" ${v === rc.unit.name ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      ${bad.length ? `<table class="checkTable"><thead><tr><th>Student</th><th>Focus</th><th>Tally</th><th></th><th></th></tr></thead><tbody>${bad.map(line).join('')}</tbody></table>` : `<p class="ok">Every student matches${kept.length ? ' or is kept on purpose' : ''}. Nothing to fix.</p>`}
      <div id="keepForm" class="keepForm hidden"></div>
      ${kept.length ? `<details class="kept"><summary>${plural(kept.length, 'difference')} kept on purpose</summary><table class="checkTable"><thead><tr><th>Student</th><th>Focus</th><th>Tally</th><th>Why</th><th></th></tr></thead><tbody>${kept.map(r => `<tr class="accepted"><td>${nm(r.display)}</td><td>${r.focus == null ? '<i>blank</i>' : fmtN(r.focus)}</td><td>${fmtN(r.tally)}</td><td><small>${esc(fmtDate((r.override.at || '').slice(0, 10)))}${r.override.why ? ' · ' + esc(r.override.why) : ''}</small></td><td><button class="pill pale small" data-unkeep="${esc(r.display)}">Flag again</button></td></tr>`).join('')}</tbody></table><p class="ghint">Kept rows copy Focus's number, not Tally's, when you copy the column. If Focus changes for that student, the row is flagged again.</p></details>` : ''}
      <div class="rp-actions">${bad.length ? `<button class="pill" id="copyFix">Copy corrections (${state.settings.copyMode === 'ids' ? 'ID' : 'name'} ⇥ Tally points)</button>` : ''}<button class="pill pale" id="copyCol">Copy the whole column</button><button class="pill pale" id="mCancel">Close</button></div>
    </div></div>`;
  const close = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; render(); };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  $('#gbMap').onchange = () => { sec.gbUnitMap = sec.gbUnitMap || {}; sec.gbUnitMap[rc.assignment.name] = $('#gbMap').value; save(); close(); if ($('#gbMap') === null && sec.gbUnitMap[rc.assignment.name]) openFocusCheck(sec, sec.gbUnitMap[rc.assignment.name]); };
  const put = async (text, msg) => { let ok = legacyCopy(text); if (!ok && window.isSecureContext && navigator.clipboard) { try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {} } if (ok) toast(msg, false); else showCopyBox(text, rc.assignment.name); };
  const sc = $('#skipCand'); if (sc) {
    const count = () => { const n = m.querySelectorAll('[data-sk]:checked').length; const left = rc.unit.total - n; $('#skipCount').innerHTML = `${plural(n, 'skill')} ticked → ${esc(rc.unit.short)} out of <b>${left}</b>${left === rc.assignment.max ? ' — matches Focus' : ` (Focus: ${rc.assignment.max})`}`; };
    m.querySelectorAll('[data-sk]').forEach(cb => cb.onchange = count); count();
    sc.onclick = () => { const ks = [...m.querySelectorAll('[data-sk]:checked')].map(cb => Number(cb.dataset.sk)); ks.forEach(k => { sec.excluded[skillKey(sec.skills[k])] = true; }); resnapshotPrep(sec.prep); save(); toast(`Skipped ${plural(ks.length, 'skill')} in ${esc(rc.unit.short)} for every ${sec.prep === 'acc' ? 'accelerated' : 'on-level'} class`, false); openFocusCheck(sec, unitName); };
  }
  m.querySelectorAll('[data-keep]').forEach(b => b.onclick = () => {
    const r = rc.rows.find(x => x.display === b.dataset.keep); if (!r) return; const f = $('#keepForm'); f.classList.remove('hidden');
    f.innerHTML = `<b>Keep Focus's ${r.focus == null ? 'blank' : fmtN(r.focus)} for ${nm(r.display)}</b> <span class="ghint">(Tally has ${fmtN(r.tally)})</span><div class="two"><input class="txt" id="keepWhy" maxlength="200" placeholder="Why — e.g. late penalty, retake on paper, excused (optional)"><span class="rp-actions"><button class="pill small" id="keepOk">Keep it</button><button class="pill pale small" id="keepNo">Cancel</button></span></div>`;
    if (!coarse()) $('#keepWhy').focus(); $('#keepWhy').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#keepOk').click(); } };
    $('#keepNo').onclick = () => { f.classList.add('hidden'); f.innerHTML = ''; };
    $('#keepOk').onclick = () => { sec.overrides = sec.overrides || {}; sec.overrides[rc.unit.name] = sec.overrides[rc.unit.name] || {}; sec.overrides[rc.unit.name][r.display] = { focus: r.focus, tally: r.tally, at: new Date().toISOString(), why: $('#keepWhy').value.trim().slice(0, 200) }; save(); toast(`Kept Focus's number for ${esc(nm(r.display))} in ${esc(rc.unit.short)} — it won't be flagged unless Focus changes.`, false, 5000); openFocusCheck(sec, unitName); };
  });
  m.querySelectorAll('[data-unkeep]').forEach(b => b.onclick = () => { if (sec.overrides && sec.overrides[rc.unit.name]) { delete sec.overrides[rc.unit.name][b.dataset.unkeep]; if (!Object.keys(sec.overrides[rc.unit.name]).length) delete sec.overrides[rc.unit.name]; } save(); openFocusCheck(sec, unitName); });
  const cf = $('#copyFix'); if (cf) cf.onclick = () => { const lines = bad.filter(r => r.tally != null).map(r => (state.settings.copyMode === 'ids' ? (r.id || '') : r.display) + '\t' + r.tally); put(lines.join('\n'), `Copied ${plural(lines.length, 'correction')} for ${esc(rc.unit.short)}`); };
  $('#copyCol').onclick = () => copyUnit(sec, rc.unit);
}

/* ---------- settings ---------- */
function matchReport(s, rosterText) {
  const tmp = { ...s, roster: rosterText }; const rr = buildRows(tmp); const rs = rosterState(tmp); const H = state.settings.hideNames;
  const nm = d => esc(H ? mask(d) : d);
  if (!rs.hasText) return 'Nothing pasted yet.';
  if (!rs.count) return `<span class="bad">Couldn't read any names.</span> Paste one student per line, as <code>Last, First</code>. Extra columns (ID numbers, grades) are fine as long as the name is on the line.`;
  const ro = rr.filter(r => r.status === 'rosterOnly'), am = rr.filter(r => r.status === 'ambiguous'), io = rr.filter(r => r.status === 'ixlOnly'), loose = rr.filter(r => r.tier === 'loose'), okc = rr.filter(r => r.status === 'ok').length;
  const ign = Object.keys(s.ignored || {});
  let h = `<span class="${ro.length || am.length || io.length ? 'bad' : 'ok'}">${okc} of ${rs.count} roster names matched to IXL.</span>`;
  if (loose.length) h += `<div><span class="warn">Matched loosely — check once:</span><ul>${loose.map(r => `<li>${nm(r.display)} → ${nm(r.ixlName)}</li>`).join('')}</ul></div>`;
  if (ro.length) h += `<div>Not found in IXL (tap the flag in the grid to fix):<ul>${ro.map(r => `<li>${nm(r.display)}</li>`).join('')}</ul></div>`;
  const na = rr.filter(r => r.status === 'noAccount'); if (na.length) h += `<div>No IXL account (blank row in copies; tap the tag in the grid to change):<ul>${na.map(r => `<li>${nm(r.display)}</li>`).join('')}</ul></div>`;
  if (am.length) h += `<div>Two IXL matches (tap the flag to pick):<ul>${am.map(r => `<li>${nm(r.display)}</li>`).join('')}</ul></div>`;
  if (io.length) h += `<div>In IXL but not on roster:<ul>${io.map(r => `<li>${nm(r.ixlName)} <button data-ign="${esc(r.key)}">skip</button></li>`).join('')}</ul></div>`;
  if (ign.length) h += `<div>Skipped IXL accounts:<ul>${ign.map(k => `<li>${nm(k.replace(/#\d+$/, ''))} <button data-unign="${esc(k)}">count</button></li>`).join('')}</ul></div>`;
  if (s.rosterAt) h += `<div class="hint">Roster pasted ${fmtDate(s.rosterAt.slice(0, 10))}.</div>`;
  return h;
}
// The backup is the bridge between the laptop and the tablet, and the only copy if this browser's storage is cleared.
function saveBackup() {
  const cfg = { tally: 4, exported: new Date().toISOString(), settings: { copyMode: state.settings.copyMode, useBest: state.settings.useBest, remindDays: state.settings.remindDays, skipFirst: state.settings.skipFirst, skipFirstV2: true, currentUnit: state.settings.currentUnit }, assigned: state.assigned, custom: state.custom, grading: state.grading, room: state.room, seatWeights: state.seatWeights, seatBasis: state.seatBasis, seatPairs: state.seatPairs, quarters: quarters(), sections: {} };
  for (const k of state.order) { const x = state.sections[k]; cfg.sections[k] = { label: x.label, prep: x.prep, studentSkips: x.studentSkips, threshold: x.threshold, roster: x.roster, rosterAt: x.rosterAt, skipRoster: x.skipRoster, excluded: x.excluded, ignored: x.ignored, aliases: x.aliases, hiddenUnits: x.hiddenUnits, history: x.history, gradeHistory: x.gradeHistory || [], seating: x.seating || null, seatInfo: x.seatInfo || {}, qArchive: x.qArchive || {}, overrides: x.overrides || {} }; }
  for (const k in state.pendingCfg) if (!cfg.sections[k]) cfg.sections[k] = state.pendingCfg[k];
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })); a.download = 'tally-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  state.lastBackup = new Date().toISOString(); save();
  toast(`Backup saved — it contains student names, weekly skill counts and computed Focus grades${Object.values(state.sections).some(x => x.qArchive && Object.keys(x.qArchive).length) ? ', and the Focus scores of closed quarters' : ''}, so keep it in your school Drive.`, false, 5000);
}
// The newest thing imported (an IXL export or a gradebook), to tell whether the last backup is behind it.
function latestImportAt() { let m = ''; for (const k of state.order) { const s = state.sections[k]; [s.importedAt, s.grades && s.grades.importedAt].forEach(v => { if (typeof v === 'string' && v > m) m = v; }); } return m || null; }
const backupBehind = () => { const li = latestImportAt(); return !!(li && (!state.lastBackup || state.lastBackup < li)); };
function openSettings() {
  const s = state.sections[state.active]; if (!s) return;
  const m = $('#modal'); m.classList.remove('hidden'); const H = state.settings.hideNames;
  m.innerHTML = `<div class="panel">
    <header><h2>${esc(s.label)}</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body">
      <section>
        <div class="row2">
          <div class="field"><label>Class name (what students see)</label><input type="text" id="secLabel" value="${esc(s.label)}" placeholder="${esc(s.autoLabel)}"></div>
          <div class="field"><label>Goal SmartScore</label><input type="number" id="thr" min="1" max="100" value="${s.threshold}"></div>
        </div>
        <div class="row2">
          <div class="field"><label class="check" style="margin:0"><input type="checkbox" id="useBest" ${state.settings.useBest ? 'checked' : ''}> Grade on each student's best score across imports</label><p style="margin-top:4px">SmartScores drop when a student keeps practicing and misses; this keeps a point once it's earned. Applies to every class.</p></div>
          <div class="field"><label>Course</label><div class="seg"><button data-prep="acc" class="${s.prep === 'acc' ? 'on' : ''}">Accelerated</button><button data-prep="on" class="${s.prep !== 'acc' ? 'on' : ''}">On-level</button></div></div>
        </div>
        <div class="field"><label>Units not assigned at the start of the ${s.prep === 'acc' ? 'accelerated' : 'on-level'} course</label><div class="seg small" id="skipFirst">${[0, 1, 2, 3].map(n => `<button data-skip="${n}" class="${(state.settings.skipFirst || {})[s.prep] === n ? 'on' : ''}">${n === 0 ? 'None' : 'First ' + n}</button>`).join('')}</div><p style="margin-top:4px">Review units students don't do. They leave the Race, Data Lab, Focus check and copies for every class of this course. A unit you mark Assigned by hand still wins.</p></div>
        <div class="field"><label>Remind me when an export gets old</label><div class="seg small" id="remind">${REMIND.map(d => `<button data-remind="${d}" class="${state.settings.remindDays === d ? 'on' : ''}">${d ? d + ' days' : 'Off'}</button>`).join('')}</div><p style="margin-top:4px">A note appears on any class whose IXL export or Focus gradebook is older than this. Applies to every class.</p></div>
        <p>${esc(s.file)} · imported ${fmtTime(s.importedAt)}</p>
        <div class="field"><label>Roster — paste from FOCUS, one student per line</label>${H ? '<p class="warnline">Names are hidden. Turn on Show names to view or edit the roster.</p>' : `<textarea id="roster" placeholder="Doe, Jane&#10;Smith, John&#10;…&#10;&#10;Pasting straight from the FOCUS gradebook works, ID columns and all.">${esc(s.roster)}</textarea>`}</div>
        <div class="report" id="matchReport">${matchReport(s, s.roster)}</div>
      </section>
      <section>
        <h3>Copy</h3>
        <div class="seg" id="copyMode">${[['points', 'Points only'], ['names', 'Name ⇥ points'], ['ids', 'ID ⇥ points']].map(([k, n]) => `<button data-cm="${k}" class="${state.settings.copyMode === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        <p>Roster students missing from IXL get a blank line so the column stays aligned. Students on a modified list get their own "out of" after the points.</p>
        <h3 class="mt">Our own data (Data Lab)</h3>
        <p>Numbers the classes collected themselves — minutes to school, letters in a first name. One list per class; no names.</p>
        <div id="customList">${state.custom.map(c => `<div class="customRow"><b>${esc(c.label)}</b> <span>${c.prep === 'acc' ? 'accelerated' : 'on-level'} · ${Object.values(c.values).filter(v => v.length).length} classes</span> <button class="pill pale small" data-editc="${esc(c.id)}">Edit</button> <button class="pill danger small" data-delc="${esc(c.id)}">Delete</button></div>`).join('') || '<p>None yet.</p>'}</div>
        <button class="pill pale small" id="addCustom">Add a data set</button>
        <h3 class="mt">Course settings</h3>
        <p>Goal, skipped skills, and assigned units for this class's course — no rosters, no names. Another teacher loads it to run on the same rules.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pill pale small" id="exportCourse">Save course settings</button><button class="pill pale small" id="importCourse">Load course settings</button><input type="file" id="courseFile" accept=".json" class="hidden"></div>
        <h3 class="mt">Share</h3>
        <p>Save the Race or the Data Lab as a page. The Race page has class totals only; the Data Lab page has each class's values but no names.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pill pale small" id="saveRace">Save Race</button><button class="pill pale small" id="saveLab">Save Data Lab</button></div>
        ${s.grades ? `<h3 class="mt">Gradebook</h3><p>${plural(s.grades.assignments.length, 'assignment')} · ${plural(s.grades.students.length, 'student')} · imported ${fmtDate(s.grades.importedAt.slice(0, 10))} from ${esc(s.grades.file || 'file')}</p><button class="pill danger small" id="dropGrades">Remove this gradebook</button>` : ''}
        <h3 class="mt">Backup</h3>
        <p>Rosters, goals, skips, matches, category weights, each student's weekly skill counts (for the race) and their computed Focus grade per import (for trends). Not raw scores. Load it on another computer before or after importing exports.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="pill pale small" id="exportCfg">Save backup</button><button class="pill pale small" id="importCfg">Load backup</button><input type="file" id="cfgFile" accept=".json" class="hidden"><small id="lastBk" class="ghint" style="margin:0">${state.lastBackup ? `Last saved ${esc(ageDays(state.lastBackup) === 0 ? 'today' : fmtDate(state.lastBackup.slice(0, 10)))}.` : 'Never saved from this browser.'}</small></div>
        <h3 class="mt">This computer</h3>
        <p>Everything Tally shows — IXL scores, rosters, goals, skips, and the Focus gradebook with its grade history — is saved in this browser. On a shared computer, clear it when you're done.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pill danger small" id="forget">Remove this class</button><button class="pill danger small" id="wipe">Clear all Tally data</button></div>
      </section>
    </div>
    <footer><div class="spacer"></div><button class="pill pale" id="mCancel">Cancel</button><button class="pill" id="mSave">Save</button></footer>
  </div>`;
  let copyMode = state.settings.copyMode; m.querySelectorAll('[data-cm]').forEach(b => b.onclick = () => { copyMode = b.dataset.cm; m.querySelectorAll('[data-cm]').forEach(x => x.classList.toggle('on', x === b)); });
  let prep = s.prep; m.querySelectorAll('[data-prep]').forEach(b => b.onclick = () => { prep = b.dataset.prep; m.querySelectorAll('[data-prep]').forEach(x => x.classList.toggle('on', x === b)); });
  let skipFirst = (state.settings.skipFirst || {})[s.prep] || 0, skipTouched = false; m.querySelectorAll('[data-skip]').forEach(b => b.onclick = () => { skipFirst = +b.dataset.skip; skipTouched = true; m.querySelectorAll('[data-skip]').forEach(x => x.classList.toggle('on', x === b)); });
  let remind = state.settings.remindDays; m.querySelectorAll('[data-remind]').forEach(b => b.onclick = () => { remind = +b.dataset.remind; m.querySelectorAll('[data-remind]').forEach(x => x.classList.toggle('on', x === b)); });
  const rosterEl = $('#roster');
  const dirty = () => rosterEl && rosterEl.value !== s.roster;
  const close = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; render(); };
  const cancel = () => { if (dirty() && !confirm('Discard the roster changes you pasted?')) return; close(); };
  m._cancel = cancel;
  $('#mClose').onclick = cancel; $('#mCancel').onclick = cancel;
  m.onclick = e => { if (e.target === m) cancel(); };
  const wireReport = () => {
    m.querySelectorAll('[data-ign]').forEach(b => b.onclick = () => { s.ignored[b.dataset.ign] = true; save(); $('#matchReport').innerHTML = matchReport(s, rosterEl ? rosterEl.value : s.roster); wireReport(); });
    m.querySelectorAll('[data-unign]').forEach(b => b.onclick = () => { delete s.ignored[b.dataset.unign]; save(); $('#matchReport').innerHTML = matchReport(s, rosterEl ? rosterEl.value : s.roster); wireReport(); });
  };
  wireReport();
  if (rosterEl) { rosterEl.oninput = () => { $('#matchReport').innerHTML = matchReport(s, rosterEl.value); wireReport(); }; if (!coarse()) rosterEl.focus(); }
  $('#mSave').onclick = () => {
    const tv = parseInt($('#thr').value, 10); if (!isNaN(tv) && clampThr(tv) !== s.threshold) { s.threshold = clampThr(tv); snapshot(s); }
    state.settings.copyMode = copyMode; state.settings.remindDays = remind; state.settings.skipFirst = state.settings.skipFirst || { acc: 0, on: 1 }; if (skipTouched) state.settings.skipFirst[prep] = skipFirst;   // untouched: the other course's review count must not follow a course change
    const prepChanged = prep !== s.prep;
    s.label = $('#secLabel').value.trim() || s.autoLabel; s.team = ''; s.prep = prep; s.accelerated = prep === 'acc'; s.excluded = state.skips[prep]; state.settings.useBest = $('#useBest').checked;
    if (prepChanged) { if (s.pool) { s.autoLabel = `${PERIOD_ORD(s.period)} Period · ${prep === 'acc' ? 'Accelerated' : 'On-level'}`; if ($('#secLabel').value.trim() === '' || /Period · (Accelerated|On-level)$/.test(s.label)) s.label = s.autoLabel; } if (!$('#thr').value.trim() || clampThr($('#thr').value) === (prep === 'acc' ? DEFAULT_THR.on : DEFAULT_THR.acc)) { s.threshold = prep === 'acc' ? DEFAULT_THR.acc : DEFAULT_THR.on; } }
    const rosterChanged = !!rosterEl && rosterEl.value !== s.roster;
    if (rosterChanged) { s.roster = rosterEl.value; s.rosterAt = new Date().toISOString(); if (parseRosterText(s.roster).length) s.skipRoster = false; }
    if (s.pool && (prepChanged || rosterChanged)) materialize(s);   // a pool class carved from the other course's export needs its skills, scores and goal from that pool
    else if (prepChanged) snapshot(s);
    state.order.sort((a, b) => state.sections[a].label.localeCompare(state.sections[b].label, undefined, { numeric: true }));
    save(); close(); render(); toast('Saved', false);
  };
  $('#forget').onclick = () => { if (!confirm(`Remove ${s.label} from Tally? Its roster and exclusions go too.`)) return; delete state.sections[s.key]; delete seatWork[s.key]; delete seatCandsBy[s.key]; state.order = state.order.filter(k => k !== s.key); state.active = state.order[0] || null; view = { mode: 'units', unit: null }; save(); close(); render(); };
  $('#wipe').onclick = () => {
    const n = state.order.length, r = state.order.filter(k => rosterState(state.sections[k]).count).length;
    if (!confirm(`Clear everything Tally has saved in this browser — ${plural(n, 'class')}, ${plural(r, 'pasted roster')}, goals? Save a backup first if you want the rosters back.`)) return;
    localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_KEY + '.broken'); try { sessionStorage.removeItem(GB_KEY); } catch (e) {} location.reload();
  };
  $('#addCustom').onclick = () => { close(); openCustomEditor(null, s.prep); };
  m.querySelectorAll('[data-editc]').forEach(b => b.onclick = () => { close(); openCustomEditor(b.dataset.editc); });
  m.querySelectorAll('[data-delc]').forEach(b => b.onclick = () => { const c = state.custom.find(x => x.id === b.dataset.delc); if (!confirm(`Delete "${c.label}"?`)) return; state.custom = state.custom.filter(x => x.id !== c.id); save(); close(); openSettings(); });
  $('#exportCourse').onclick = () => {
    const skipped = Object.keys(s.excluded).map(k => { const sk = s.skills.find(x => skillKey(x) === k); return { key: k, name: sk ? sk.name : k, unit: sk ? sk.unit : '' }; });
    const cfg = { tally: 'course', prep: s.prep, goal: s.threshold, assigned: state.assigned[s.prep], skipped, exported: new Date().toISOString() };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })); a.download = `tally-course-${s.prep === 'acc' ? 'accelerated' : 'on-level'}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Course settings saved — no names in this file.', false);
  };
  $('#importCourse').onclick = () => $('#courseFile').click();
  $('#courseFile').onchange = async e => {
    try { const cfg = JSON.parse(await e.target.files[0].text()); if (cfg.tally !== 'course' || !['acc', 'on'].includes(cfg.prep)) throw 0;
      const targets = state.order.map(k => state.sections[k]).filter(x => x.prep === cfg.prep);
      if (!confirm(`Apply the ${cfg.prep === 'acc' ? 'accelerated' : 'on-level'} course settings (goal ${cfg.goal}, ${Object.keys(cfg.assigned || {}).length} unit marks, ${(cfg.skipped || []).length} skipped skills) to ${plural(targets.length, 'class')}?`)) return;
      state.assigned[cfg.prep] = Object.assign({}, state.assigned[cfg.prep], cfg.assigned || {});
      targets.forEach(x => { x.threshold = clampThr(cfg.goal, x.threshold); (cfg.skipped || []).forEach(sk => { x.excluded[sk.key] = true; }); snapshot(x); });
      save(); close(); render(); toast(`Course settings applied to ${plural(targets.length, 'class')}`, false);
    } catch (err) { toast('That file is not a Tally course settings file.', true); }
  };
  $('#saveRace').onclick = () => downloadLeaderboard('race'); $('#saveLab').onclick = () => downloadLeaderboard('lab');
  const dg = $('#dropGrades'); if (dg) dg.onclick = () => { if (!confirm(`Remove the gradebook loaded for ${s.label}? Its grade history stays for trends.`)) return; delete s.grades; if (view.mode === 'grades') view = { mode: 'units', unit: null }; save(); close(); render(); };
  $('#exportCfg').onclick = () => { saveBackup(); const lb = $('#lastBk'); if (lb) lb.textContent = 'Last saved today.'; };
  $('#importCfg').onclick = () => $('#cfgFile').click();
  $('#cfgFile').onchange = async e => {
    try { const cfg = JSON.parse(await e.target.files[0].text()); if (!cfg || !cfg.tally || typeof cfg.sections !== 'object') throw 0;
      if (cfg.settings) { if (cfg.settings.currentUnit && typeof cfg.settings.currentUnit === 'object') state.settings.currentUnit = { acc: Number.isInteger(cfg.settings.currentUnit.acc) ? cfg.settings.currentUnit.acc : null, on: Number.isInteger(cfg.settings.currentUnit.on) ? cfg.settings.currentUnit.on : null }; if (cfg.settings.skipFirst && typeof cfg.settings.skipFirst === 'object' && cfg.settings.skipFirstV2) state.settings.skipFirst = { acc: Number.isInteger(cfg.settings.skipFirst.acc) ? cfg.settings.skipFirst.acc : 0, on: Number.isInteger(cfg.settings.skipFirst.on) ? cfg.settings.skipFirst.on : 1 }; if (['points', 'names', 'ids'].includes(cfg.settings.copyMode)) state.settings.copyMode = cfg.settings.copyMode; if (cfg.settings.copyNames) state.settings.copyMode = 'names'; if (cfg.settings.useBest != null) state.settings.useBest = !!cfg.settings.useBest; if (REMIND.includes(cfg.settings.remindDays)) state.settings.remindDays = cfg.settings.remindDays; }
      const safeObj = o => { const out = {}; if (o && typeof o === 'object') for (const k of Object.keys(o)) if (SAFE_KEY(k)) out[k] = o[k]; return out; };
      if (cfg.assigned && typeof cfg.assigned === 'object') { state.assigned.acc = { ...state.assigned.acc, ...safeObj(cfg.assigned.acc) }; state.assigned.on = { ...state.assigned.on, ...safeObj(cfg.assigned.on) }; }
      if (cfg.grading && typeof cfg.grading === 'object') ['acc', 'on'].forEach(pp => { const g = cfg.grading[pp]; if (g && Array.isArray(g.cats) && g.cats.length) state.grading[pp] = { cats: g.cats.filter(c => c && c.name && isFinite(c.w)).map(c => ({ name: String(c.name), w: Number(c.w) })), map: safeObj(g.map), how: safeObj(g.how) }; });
      if (cfg.room && typeof cfg.room === 'object' && Array.isArray(cfg.room.desks)) { state.room = cfg.room; roomOK(); } if (cfg.seatWeights && typeof cfg.seatWeights === 'object') state.seatWeights = cfg.seatWeights; if (typeof cfg.seatBasis === 'string') state.seatBasis = cfg.seatBasis; if (typeof cfg.seatPairs === 'string') state.seatPairs = cfg.seatPairs;
      // Quarters merge, never undo: a backup from a device that hasn't closed Q1 must not reopen it here.
      if (cfg.quarters && typeof cfg.quarters === 'object') { const loc = JSON.parse(JSON.stringify(quarters())); const had = Object.keys(loc.closed).length; state.quarters = { ends: cfg.quarters.ends, closed: cfg.quarters.closed, units: cfg.quarters.units }; const inc = quarters(); state.quarters = { ends: had ? loc.ends : inc.ends, closed: { ...inc.closed, ...loc.closed }, units: { acc: { ...inc.units.acc, ...loc.units.acc }, on: { ...inc.units.on, ...loc.units.on } } }; quarters(); }
      if (Array.isArray(cfg.custom)) cfg.custom.forEach(c => { if (c && c.id && c.label && !state.custom.some(x => x.id === c.id)) state.custom.push(c); });
      const clean = (c, prev) => ({
        label: typeof c.label === 'string' && c.label.trim() ? c.label.trim() : (prev ? prev.label : undefined),
        threshold: clampThr(c.threshold, prev ? prev.threshold : (c.accelerated ? DEFAULT_THR.acc : DEFAULT_THR.on)),
        roster: typeof c.roster === 'string' ? c.roster : (prev ? prev.roster : ''), rosterAt: c.rosterAt || (prev ? prev.rosterAt : null), skipRoster: !!c.skipRoster,
        excluded: c.excluded && typeof c.excluded === 'object' ? c.excluded : {}, ignored: c.ignored && typeof c.ignored === 'object' ? c.ignored : {},
        aliases: c.aliases && typeof c.aliases === 'object' ? c.aliases : {}, hiddenUnits: c.hiddenUnits && typeof c.hiddenUnits === 'object' ? c.hiddenUnits : {},
        overrides: c.overrides && typeof c.overrides === 'object' ? cleanOverrides(c.overrides) : (prev ? prev.overrides : {}),
        seatInfo: c.seatInfo && typeof c.seatInfo === 'object' ? c.seatInfo : (prev ? prev.seatInfo : {}), seating: c.seating && typeof c.seating === 'object' && c.seating.seats ? c.seating : (prev ? prev.seating : undefined),
        studentSkips: c.studentSkips && typeof c.studentSkips === 'object' ? c.studentSkips : {}, qArchive: mergeArchives(prev ? prev.qArchive : {}, cleanArchive(c.qArchive)), prep: c.prep === 'acc' || c.prep === 'on' ? c.prep : undefined, gradeHistory: Array.isArray(c.gradeHistory) ? c.gradeHistory.filter(h => h && typeof h.date === 'string' && Array.isArray(h.grade)) : (prev ? prev.gradeHistory : []), history: Array.isArray(c.history) ? c.history.filter(h => h && typeof h.date === 'string' && h.per).map(h => ({ date: h.date, at: h.at, thr: h.thr, students: h.students, per: h.per, pu: h.pu, ua: h.ua })) : (prev ? prev.history : [])
      });
      let applied = 0, held = 0;
      for (const k in cfg.sections) { if (!SAFE_KEY(k)) continue; const c = cfg.sections[k] || {}; if (state.sections[k]) { const cl = clean(c, state.sections[k]); Object.assign(state.sections[k], cl); applied++; } else { const cl = clean(c, null); if (!cl.label) cl.label = k; state.pendingCfg[k] = cl; held++; } }
      migrate(); state.order.map(k => state.sections[k]).forEach(x => { if (x.pool) materialize(x); }); save(); close(); render(); toast(`Loaded settings for ${plural(applied, 'class')}${held ? ` · ${held} waiting for their exports to be imported` : ''}`, false, 5000);
    } catch (err) { console.error(err); toast('That file is not a Tally backup.', true); }
  };
}

function openCustomEditor(id, prep) {
  const c = id ? state.custom.find(x => x.id === id) : { id: 'c' + Date.now().toString(36), label: '', unit: '', prep: prep || 'on', values: {} };
  const m = $('#modal'); m.classList.remove('hidden');
  const classes = state.order.map(k => state.sections[k]).filter(x => x.prep === c.prep);
  m.innerHTML = `<div class="panel narrow"><header><h2>${id ? 'Edit' : 'New'} data set</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body one">
      <div class="row2"><div class="field"><label>Name</label><input type="text" id="cLabel" value="${esc(c.label)}" placeholder="Minutes to get to school"></div><div class="field"><label>Unit (shown on the axis)</label><input type="text" id="cUnit" value="${esc(c.unit || '')}" placeholder="minutes"></div></div>
      <div class="field"><label>Course</label><div class="seg">${[['acc', 'Accelerated'], ['on', 'On-level']].map(([k, n]) => `<button data-cprep="${k}" class="${c.prep === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div id="cLists">${classes.map(x => `<div class="field"><label>${esc(x.label)} — one number per student, any order</label><textarea class="cVals" data-sec="${esc(x.key)}" style="min-height:70px">${esc((Array.isArray(c.values[x.key]) ? c.values[x.key] : []).filter(v => typeof v === 'number').join(' '))}</textarea></div>`).join('') || '<p>No classes in this course yet.</p>'}</div>
      <div class="rp-actions"><button class="pill" id="cSave">Save</button><button class="pill pale" id="mCancel">Cancel</button></div>
    </div></div>`;
  const close = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.querySelectorAll('[data-cprep]').forEach(b => b.onclick = () => { c.prep = b.dataset.cprep; c.label = $('#cLabel').value; c.unit = $('#cUnit').value; if (!id) { openCustomEditor(null, c.prep); const l = $('#cLabel'); if (l) l.value = c.label; } else openCustomEditor(id); });
  $('#cSave').onclick = () => {
    c.label = $('#cLabel').value.trim(); c.unit = $('#cUnit').value.trim(); if (!c.label) { toast('Give the data set a name.', true); return; }
    c.values = {}; m.querySelectorAll('.cVals').forEach(ta => { const v = parseNums(ta.value); if (v.length) c.values[ta.dataset.sec] = v; });
    if (!id) state.custom.push(c); save(); close(); render(); toast(`Saved <b>${esc(c.label)}</b> — find it under "Our own data" in the Data Lab.`, false, 4000);
  };
}

/* ---------- toast ---------- */
let toastT, lastSaveFail = 0;
// A toast can be tapped away (it sits over the grid's bottom-right cells); buttons inside it keep their own handlers.
function toast(html, err, ms, fromLb) { if (document.body.classList.contains('lbMode') && !fromLb) return; if (!err && Date.now() - lastSaveFail < 1500) return; /* the save just failed: leave that message up */ const t = $('#toast'); t.innerHTML = html; t.classList.toggle('err', !!err); t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms || (err ? 6000 : 3200)); }

/* ---------- wiring ---------- */
$('#btnImport').onclick = () => $('#file').click();
$('#launch').onclick = () => $('#file').click();
$('#file').onchange = e => { importFiles([...e.target.files]); e.target.value = ''; };
$('#btnSettings').onclick = () => openSettings();
$('#btnGuide').onclick = openGuide;
$('#btnHide').onclick = () => { state.settings.hideNames = !state.settings.hideNames; save(); render(); };
$('#btnHome').onclick = () => { view = { mode: 'home', unit: null }; noticesOpen = false; render(); };
$('#btnStudents').onclick = () => { view = { mode: 'students', unit: null }; render(); };
$('#btnDetails').onclick = () => { state.settings.details = !state.settings.details; save(); render(); };
$('#btnLb').onclick = enterProjected;
$('#search').oninput = e => { search = e.target.value; if (view.mode === 'home' || view.mode === 'students' || view.mode === 'student') { view = { mode: 'students', unit: null }; render(); return; }   // from the Overview, "Find a student" searches every class
  if (view.mode === 'grades' || view.mode === 'seating') { if (!state.active) return; view = { mode: 'units', unit: null }; render(); return; } renderGrid(); };
let dragDepth = 0;
document.addEventListener('dragenter', e => { e.preventDefault(); if (document.body.classList.contains('lbMode')) return; dragDepth++; document.body.classList.add('dragging'); });
document.addEventListener('dragleave', e => { e.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging'); if (document.body.classList.contains('lbMode') || document.body.classList.contains('showMode')) return; const fs = [...e.dataTransfer.files].filter(f => /\.(xlsx|csv|xls|txt|tsv|html?|json)$/i.test(f.name)); if (fs.length) importFiles(fs); else toast('Drop an IXL Score Grid, a Focus gradebook export (.xlsx, .csv, .xls) or a Seating Chart backup (.json).', true); });
// Every dialog goes through #modal, so one observer gives them all the same manners: focus moves into the panel on
// open (to the panel itself — never an input, which would raise the tablet's keyboard), Tab stays inside, the dialog is
// named by its own heading, and focus goes back to whatever opened it on close.
const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let modalOpener = null, modalOpenerId = null, lastOutside = null;
document.addEventListener('focusin', e => { if (!e.target.closest('#modal')) lastOutside = e.target; });   // the observer runs after the opener may have focused an input, so remember the last focus outside the dialog
new MutationObserver(() => {
  const m = $('#modal'); const open = !m.classList.contains('hidden');
  if (open && !m._open) { m._open = true; modalOpener = lastOutside; modalOpenerId = modalOpener && modalOpener.id; setTimeout(() => { if (m.classList.contains('hidden')) return; const panel = m.querySelector('.panel'); if (!panel) return; const h = panel.querySelector('header h2'); if (h) { h.id = h.id || 'mTitle'; m.setAttribute('aria-labelledby', h.id); m.removeAttribute('aria-label'); } panel.tabIndex = -1; panel.focus({ preventScroll: true }); }, 0); }
  else if (!open && m._open) { m._open = false; const el = modalOpener, id = modalOpenerId; modalOpener = null; setTimeout(() => { const target = el && el.isConnected ? el : (id ? $('#' + id) : null); if (target && !target.closest('#modal')) { try { target.focus({ preventScroll: true }); } catch (e) {} } }, 0); }   // the close usually re-renders, so fall back to the opener's id
}).observe($('#modal'), { attributes: true, attributeFilter: ['class'] });
document.addEventListener('keydown', e => {
  const m = $('#modal'); const open = !m.classList.contains('hidden');
  if (e.key === 'Tab' && open) { const items = [...m.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null); if (!items.length) return; const i = items.indexOf(document.activeElement); if (e.shiftKey && (i <= 0)) { e.preventDefault(); items[items.length - 1].focus(); } else if (!e.shiftKey && (i === -1 || i === items.length - 1)) { e.preventDefault(); items[0].focus(); } return; }
  if (e.key !== 'Escape') return;
  if (open) { (m._cancel || (() => m.classList.add('hidden')))(); return; }
  if (view.mode === 'seating' && (seatSel || seatPending)) { seatSel = null; seatPending = null; seatHover = null; render(); return; }
  if (view.mode === 'unit') { view = { mode: 'units', unit: null }; render(); }
  else if (view.mode === 'student' && !(e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))) profileLeave();
});
window.__tally = { get state() { return state; }, save, sectionWarn, attentionItems, attentionGroups, quarters, closeQuarter, reopenQuarter, qSec, openSec, aQuarter, mdToISO, currentQuarter, studentSummary, quickestPath, openProfile, openShow, gradeWith, findStudent, classStudents, snapBasis, computeGrade, gradeAll, fitCategories, applyCategories, neededOn, withNext, gradeSnapshot, gradingFor, catOf, ixlVsTests, classAverage, pearson, openGuide, openReceipt, ageDays, ageText, overdue, totalFor, activeFor, reconcile, gbRows, get bootError() { return bootError; }, importFiles, buildRows, unitsOf, unitColumn, render, parseRosterText, ixlList, leaderboardData, snapshot, stats, labSeries, parseGradebook, fileToRows, population, eff, mergeBest, movement, assignedIdx, studentReportSection, printStudentReports, seatStudents, geometry, deskNumbers, importSeatingBackup, explainSeats, get seatWork() { return seatWork; } };
$('#toast').addEventListener('click', e => { if (e.target.closest('button')) return; $('#toast').classList.remove('show'); });
render();
if (bootError) setTimeout(() => toast('Saved Tally data could not be read and was set aside (kept as a backup in this browser). Re-import your exports.', true, 8000), 300);
})();
