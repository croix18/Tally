/* ---------- quarters.js — grading periods: close a quarter, keep its record, stop its alerts ----------
   Spliced into app.js's closure. See GRADES_SPEC.md §7.
   Focus starts a fresh gradebook each quarter, so a class's Q2 export no longer carries Q1. Closing a quarter:
     · freezes each class's gradebook for that quarter as sec.qArchive[n] (every score, the final grades, the
       category of each assignment) — Tally keeps it after Focus drops it;
     · marks the course's IXL units that belonged to the quarter (state.quarters.units[prep][unit] = n);
     · from then on those assignments and units raise nothing: no missing counts, no sliding, no Focus check,
       no "still owed", no what-ifs. They stay visible (Grades → the quarter's tab, each student's page).
   An assignment's quarter comes from its due date (then its assigned date, then the day the gradebook was imported). */
const Q_ENDS = ['2026-10-09', '2026-12-18', '2027-03-04', '2027-05-28'];   // Lake County Schools 2026-27: end of each grading period
const Q_NAMES = ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'];
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
function quarters() {
  const q = state.quarters && typeof state.quarters === 'object' && !Array.isArray(state.quarters) ? state.quarters : (state.quarters = {});
  if (!Array.isArray(q.ends) || q.ends.length !== 4 || !q.ends.every(d => typeof d === 'string' && ISO_RE.test(d))) q.ends = Q_ENDS.slice();
  const closed = {}; if (q.closed && typeof q.closed === 'object') for (const k of ['1', '2', '3', '4']) if (q.closed[k] && typeof q.closed[k] === 'object') closed[k] = { at: typeof q.closed[k].at === 'string' ? q.closed[k].at : '' };
  q.closed = closed;
  const units = {}; ['acc', 'on'].forEach(p => { const u = q.units && q.units[p]; const c = {}; if (u && typeof u === 'object') for (const k of Object.keys(u)) if (SAFE_KEY(k) && [1, 2, 3, 4].includes(u[k])) c[k] = u[k]; units[p] = c; });
  q.units = units;
  return q;
}
// A gradebook that arrives from storage or a backup: every field coerced, so nothing in it can be markup or a getter.
const GB_STATUS = ['score', 'missing', 'excused', 'blank', 'unread'];
const numOrNull = v => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const str = (v, n) => typeof v === 'string' ? v.slice(0, n || 200) : '';
function cleanGB(gb) {
  if (!gb || typeof gb !== 'object' || !Array.isArray(gb.students) || !Array.isArray(gb.assignments)) return null;
  const n = gb.students.length; const students = gb.students.map(x => str(x, 120));
  const assignments = [];
  for (const y of gb.assignments) {
    if (!y || typeof y.name !== 'string' || !Array.isArray(y.values) || y.values.length !== n || (y.status && (!Array.isArray(y.status) || y.status.length !== n))) return null;
    assignments.push({ name: y.name.slice(0, 200), max: numOrNull(y.max), values: y.values.map(numOrNull), status: y.status ? y.status.map(t => GB_STATUS.includes(t) ? t : 'unread') : undefined,
      missing: Number(y.missing) || 0, excused: Number(y.excused) || 0, due: str(y.due, 20), assignedOn: str(y.assignedOn, 20), category: str(y.category, 60), categoryFromFile: !!y.categoryFromFile });
  }
  return { students, ids: Array.isArray(gb.ids) ? gb.ids.map(x => str(String(x ?? ''), 40)) : [], overall: Array.isArray(gb.overall) && gb.overall.length === n ? gb.overall.map(numOrNull) : null,
    importedAt: /^\d{4}-\d{2}-\d{2}/.test(str(gb.importedAt, 40)) ? str(gb.importedAt, 40) : new Date(0).toISOString(), file: str(gb.file, 200), assignments };
}
const cleanCats = c => Array.isArray(c) ? c.filter(x => x && typeof x.name === 'string' && Number.isFinite(+x.w)).map(x => ({ name: x.name.slice(0, 60), w: +x.w })) : null;
// A class's archive, cleaned on load like the live gradebook (restore and migrate both pass through here).
function cleanArchive(a) {
  if (!a || typeof a !== 'object') return {}; const out = {};
  for (const k of ['1', '2', '3', '4']) { const x = a[k]; if (!x || typeof x !== 'object') continue; const gb = cleanGB(x.gb); if (!gb || !gb.assignments.length) continue;
    const map = {}; if (x.map && typeof x.map === 'object') for (const m of Object.keys(x.map)) if (SAFE_KEY(m) && typeof x.map[m] === 'string') map[m] = x.map[m].slice(0, 60);
    const cats = cleanCats(x.cats);
    out[k] = { gb, map, cats: cats && cats.length ? cats : null, final: Array.isArray(x.final) ? gb.students.map((_, i) => numOrNull(x.final[i])) : [], at: str(x.at, 40), file: str(x.file, 200) }; }
  return out;
}
// Two copies of a class's archives (this device's and a backup's): per quarter, never let a missing copy replace one
// that exists; when both exist keep the fuller one (more assignments), then the newer.
function mergeArchives(a, b) {
  const out = { ...(a || {}) };
  for (const k of Object.keys(b || {})) { const x = out[k], y = b[k]; if (!x) { out[k] = y; continue; } const nx = x.gb.assignments.length, ny = y.gb.assignments.length; if (ny > nx || (ny === nx && (y.at || '') > (x.at || ''))) out[k] = y; }
  return out;
}
const pad2 = n => String(n).padStart(2, '0');
// Focus prints dates as MM/DD (no year). The school year runs August → June, so July–December is the first calendar year.
function mdToISO(md) {
  const m = String(md || '').trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/); if (!m) return null;
  const start = Number(quarters().ends[0].slice(0, 4)); const mo = Number(m[1]), d = Number(m[2]); if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : (mo >= 7 ? start : start + 1);
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}
function quarterOf(iso) { if (!iso) return null; const e = quarters().ends; for (let i = 0; i < 4; i++) if (iso <= e[i]) return i + 1; return 4; }
const aDate = (a, gb) => mdToISO(a.due) || mdToISO(a.assignedOn) || (gb && gb.importedAt ? gb.importedAt.slice(0, 10) : null);
const aQuarter = (a, gb) => quarterOf(aDate(a, gb));
const qClosed = n => !!(n && quarters().closed[n]);
const anyClosed = () => Object.keys(quarters().closed).length > 0;
function currentQuarter() { for (let n = 1; n <= 4; n++) if (!qClosed(n)) return n; return 4; }
const aClosed = (a, gb) => qClosed(aQuarter(a, gb));
const unitQuarter = (sec, u) => ((quarters().units[sec.prep] || {})[u.name]) || null;
// A unit marked with a closed quarter is quiet — unless this class's open gradebook has a column for it (a Q2 "Unit 2
// IXL Review" is Q2 work, so it is checked and owed again).
function unitClosed(sec, u) {
  if (!qClosed(unitQuarter(sec, u))) return false;
  const gb = sec.grades; return !(gb && gb.assignments.some(a => !aClosed(a, gb) && (gbUnitFor(sec, a) || {}).name === u.name));
}
// The quarter a gradebook describes: the latest quarter any of its assignments falls in (a fresh Q2 export is all Q2).
function gbQuarter(gb) { if (!gb) return null; let q = 0; gb.assignments.forEach(a => { const n = aQuarter(a, gb); if (n > q) q = n; }); return q || quarterOf(gb.importedAt ? gb.importedAt.slice(0, 10) : null); }
// The class seen through one quarter. n omitted = the open part of the live gradebook (the same object when nothing is
// closed or nothing in it is). With n = the kept copy of that quarter, read-only, when it is closed or the live gradebook
// has moved past it; null when there is none. (_arch: a kept copy; _closed: its quarter is closed.)
function qSec(sec, n) {
  if (n) {
    const a = sec.qArchive && sec.qArchive[n]; const past = sec.grades && gbQuarter(sec.grades) > n;
    if (a && (qClosed(n) || past || !sec.grades)) return { ...sec, grades: a.gb, _q: n, _arch: true, _closed: qClosed(n), _map: a.map, _cats: a.cats || undefined };
    if (qClosed(n) || past) return null;
  }
  const gb = sec.grades; if (!gb) return sec;
  if (!anyClosed()) return sec;
  const keep = gb.assignments.filter(a => !aClosed(a, gb));
  if (keep.length === gb.assignments.length) return sec;
  return { ...sec, grades: { ...gb, assignments: keep, overall: null }, _q: currentQuarter(), _partial: true };
}
const openSec = sec => qSec(sec);
const hasOpenGrades = sec => { const o = openSec(sec); return !!(o && o.grades && o.grades.assignments.length); };
// The quarters a class has anything for, oldest first: every kept copy, then the live gradebook's quarter when it has open work.
function classQuarters(sec) { const out = []; for (let n = 1; n <= 4; n++) { const k = qSec(sec, n); if (k && k._arch) out.push(n); else if (!qClosed(n) && sec.grades && hasOpenGrades(sec) && gbQuarter(openSec(sec).grades) === n) out.push(n); } return out; }

// Keep quarter n's columns of `src` (a gradebook) in this class's archive. A copy that holds every column kept so far
// replaces it; otherwise the new columns are merged in by name, students lined up by name. The final grades are
// recomputed with the archive's own weights (taken when it was first kept; refreshed when the quarter is closed).
function mergeArchive(sec, n, src, refreshCats) {
  sec.qArchive = sec.qArchive || {}; const old = sec.qArchive[n];
  const cols = src ? src.assignments.filter(a => aQuarter(a, src) === n) : [];
  if (!cols.length && !old) return 0;
  let gb = old ? old.gb : null; const map = { ...(old ? old.map : {}) };
  if (cols.length) {
    const fresh = JSON.parse(JSON.stringify({ ...src, assignments: cols })); if (cols.length !== src.assignments.length) fresh.overall = null;
    if (!old || old.gb.assignments.every(a => cols.some(c => c.name === a.name))) gb = fresh;
    else {
      gb = JSON.parse(JSON.stringify(old.gb)); gb.overall = null; const at = new Map(fresh.students.map((x, i) => [norm(x), i]));
      fresh.assignments.forEach(c => { const j = gb.students.map(x => at.get(norm(x)));
        const values = j.map(k => k == null ? null : c.values[k]); const status = j.map(k => k == null ? 'unread' : (c.status ? c.status[k] : (c.values[k] == null ? 'blank' : 'score')));
        const nc = { ...c, values, status, missing: status.filter(t => t === 'missing').length, excused: status.filter(t => t === 'excused').length };
        const k = gb.assignments.findIndex(a => a.name === c.name); if (k >= 0) gb.assignments[k] = nc; else gb.assignments.push(nc); });
      gb.importedAt = fresh.importedAt; gb.file = fresh.file;
    }
    cols.forEach(a => { map[a.name] = catOf(sec.prep, a.name, a); });
  }
  const cats = refreshCats || !old || !old.cats ? gradingFor(sec.prep).cats.map(c => ({ ...c })) : old.cats;
  const tmp = { ...sec, grades: gb, _map: map, _cats: cats }; const final = gb.students.map((_, i) => { const r = computeGrade(tmp, i); return r ? r.rounded : null; });
  sec.qArchive[n] = { gb, map, cats, final, at: new Date().toISOString(), file: gb.file || '' };
  return gb.assignments.length;
}
const archiveQuarter = (sec, n, refreshCats) => mergeArchive(sec, n, sec.grades, refreshCats);
// Before a gradebook import replaces the live one: Focus exports only the current quarter, so a file that has moved on
// (a Q2 export arriving before Q1 is closed) would take the old quarter's scores with it. Keep them first.
function keepOutgoing(sec, incoming) {
  const gb = sec.grades; if (!gb || !gb.assignments.length) return '';
  const nq = gbQuarter(incoming); const names = new Set(incoming.assignments.map(a => a.name));
  const qs = [...new Set(gb.assignments.filter(a => !names.has(a.name)).map(a => aQuarter(a, gb)))].filter(q => q && (q < nq || qClosed(q)));
  qs.forEach(q => mergeArchive(sec, q, gb));
  return qs.filter(q => !qClosed(q)).length ? ` · ${qs.filter(q => !qClosed(q)).map(q => Q_NAMES[q - 1]).join(', ')} kept (this file starts a new quarter)` : '';
}
// After a gradebook import: work from a closed quarter is Focus's final record for it, so it updates that archive.
function quarterAfterImport(sec) {
  const gb = sec.grades; if (!gb || !anyClosed()) return '';
  const qs = [...new Set(gb.assignments.map(a => aQuarter(a, gb)).filter(qClosed))]; if (!qs.length) return '';
  qs.forEach(n => mergeArchive(sec, n, gb));
  return ` · ${qs.map(n => Q_NAMES[n - 1]).join(', ')} work in this file updated the closed-quarter record`;
}
// Units whose Focus IXL column is due in quarter n in any class of the course (the close dialog pre-ticks these).
function unitsDueIn(prep, n) {
  const out = new Set();
  state.order.map(k => state.sections[k]).filter(s => s.prep === prep && s.grades).forEach(s => s.grades.assignments.forEach(a => { const u = gbUnitFor(s, a); if (u && aQuarter(a, s.grades) === n) out.add(u.name); }));
  return out;
}
function closeQuarter(n, unitPicks) {
  const q = quarters(); const per = [];
  state.order.map(k => state.sections[k]).forEach(s => { const kept = archiveQuarter(s, n, true); if (kept) per.push({ s, kept }); });
  ['acc', 'on'].forEach(p => { for (const u of Object.keys(q.units[p])) if (q.units[p][u] === n) delete q.units[p][u]; (unitPicks[p] || []).forEach(u => { if (SAFE_KEY(u)) q.units[p][u] = n; }); });
  q.closed[n] = { at: new Date().toISOString() };
  state.order.map(k => state.sections[k]).forEach(s => { if (s.grades) gradeSnapshot(s); });
  return per;
}
function reopenQuarter(n) { delete quarters().closed[n]; state.order.map(k => state.sections[k]).forEach(s => { if (s.grades) gradeSnapshot(s); }); }   // the archive stays; closing again refreshes it

// A quarter whose end date has passed and isn't closed yet (the Overview offers to close it).
function quarterDue() { const n = currentQuarter(); const end = quarters().ends[n - 1]; const today = new Date(); const iso = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`; return !qClosed(n) && iso > end ? n : null; }

function openQuarters(keep) {
  keep = keep || {};
  const q = quarters(); const n = currentQuarter(); const secs = state.order.map(k => state.sections[k]); const QN = Q_NAMES[n - 1];
  const lastClosed = [4, 3, 2, 1].find(qClosed);
  const allClosed = [1, 2, 3, 4].every(qClosed);
  const courseUnits = p => { const s = secs.find(x => x.prep === p && !x.placeholder && x.skills && x.skills.length); return s ? unitsOf(s).filter(u => u.total || u.idx.length) : []; };
  const due = { acc: unitsDueIn('acc', n), on: unitsDueIn('on', n) };
  const liveN = s => s.grades ? s.grades.assignments.filter(a => aQuarter(a, s.grades) === n).length : 0;
  const isStale = s => liveN(s) > 0 && s.grades.importedAt.slice(0, 10) < q.ends[n - 1];
  const withWork = secs.filter(s => liveN(s) > 0).length, staleN = secs.filter(isStale).length, allStale = staleN > 0 && staleN === withWork; const ended = !!quarterDue();
  // One row per class: what will be kept. The caution above the table carries the "why"; a row only says which.
  const rows = secs.map(s => { const gb = s.grades; const live = liveN(s); const kept = s.qArchive && s.qArchive[n] ? s.qArchive[n].gb.assignments.length : 0; const cnt = live || kept;
    return `<tr><td><span class="qdot" style="--cc:${classColor(s)}"></span>${esc(s.label)}</td><td>${cnt ? plural(cnt, 'assignment') : '<small>nothing to keep</small>'}</td><td>${live ? 'exported ' + esc(fmtDate(gb.importedAt.slice(0, 10))) : kept ? 'kept from an earlier export' : gb ? '' : '<small>no gradebook</small>'}${ended && live && isStale(s) && !allStale ? ' <small class="stale">older</small>' : ''}</td></tr>`; }).join('');
  // a tick made by hand survives a redraw (changing a date redraws the dialog)
  const unitPick = p => { const us = courseUnits(p); if (!us.length) return ''; return `<div class="field"><label>${p === 'acc' ? 'Accelerated' : 'On-level'}</label><div class="qunits">${us.map(u => { const cur = q.units[p][u.name]; const key = p + '|' + u.name; const on = keep.picks && key in keep.picks ? keep.picks[key] : (cur === n || (!cur && due[p].has(u.name))); const other = cur && cur !== n && qClosed(cur); return `<label class="${other ? 'dim' : ''}"><input type="checkbox" data-qu="${esc(key)}" data-short="${esc(u.short)}" ${on || other ? 'checked' : ''} ${other ? 'disabled' : ''}> ${esc(u.short)}${other ? ` <small>Q${cur}</small>` : due[p].has(u.name) ? ' <small>due in Q' + n + '</small>' : ''}</label>`; }).join('')}</div></div>`; };
  const dates = `<div class="qdates">${q.ends.map((d, i) => `<label class="${qClosed(i + 1) ? 'closed' : i + 1 === n ? 'now' : ''}"><span>${Q_NAMES[i]} ends</span><input type="date" data-qend="${i}" value="${esc(d)}" ${qClosed(i + 1) ? 'disabled' : ''}><small>${qClosed(i + 1) ? 'closed ' + esc(fmtDate((q.closed[i + 1].at || '').slice(0, 10))) : i + 1 === n ? 'now' : ''}</small></label>`).join('')}</div>
      <p class="ghint">Lake County Schools 2026–27 dates. An assignment belongs to the quarter its Focus due date falls in.</p>`;
  const form = `<p class="qlead">Tally keeps every ${esc(QN)} score and final grade, then stops bringing it up — no missing work, sliding, Focus checks or still-owed lines. It stays one tap away (Grades → <b>Q${n}</b>, and each student's page), and you can reopen it.</p>
      ${!ended ? `<p class="warnline">${esc(QN)} doesn't end until ${esc(fmtDate(q.ends[n - 1]))}. Closing now keeps each class as of its last export.</p>` : staleN ? `<p class="warnline">${allStale ? (staleN === 1 ? 'The gradebook here was' : 'Every gradebook here was') : `${plural(staleN, 'gradebook')} here ${staleN === 1 ? 'was' : 'were'}`} exported before ${esc(QN)} ended (${esc(fmtDate(q.ends[n - 1]))}). If grades changed in Focus since, export ${esc(QN)} from Focus and import it first.</p>` : ''}
      <table class="checkTable qkeep"><tbody>${rows}</tbody></table>
      ${unitPick('acc') || unitPick('on') ? `<details class="qmore" id="qUnits" ${keep.units ? 'open' : ''}><summary><span>IXL units in ${esc(QN)}: <b id="qUnitSum"></b></span> <u>Change</u></summary>${unitPick('acc')}${unitPick('on')}</details>` : ''}
      <div class="rp-actions"><button class="pill" id="qClose">Close ${esc(QN)}</button><button class="pill pale" id="mCancel">Not yet</button></div>`;
  const m = $('#modal'); m.classList.remove('hidden');
  // When the quarter has ended this dialog is about closing it. Before that it is the quarter dates, with closing early
  // one deliberate step away — so the screen opened to reopen Q1 or fix a date doesn't lead with "Close Quarter 2".
  m.innerHTML = `<div class="panel"><header><h2>${!allClosed && ended ? `Close ${esc(QN)}` : 'Quarters'}</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body one quarters">
      ${allClosed ? `<p><b>Every quarter is closed.</b></p>${dates}` : ended ? `${form}<details class="qmore" id="qDates" ${keep.dates ? 'open' : ''}><summary>Quarter dates…</summary>${dates}</details>`
        : `${dates}<details class="qmore" id="qEarly" ${keep.early ? 'open' : ''}><summary><span>Close ${esc(QN)} early… <small>it ends ${esc(fmtDate(q.ends[n - 1]))}</small></span></summary>${form}</details>`}
      ${lastClosed ? `<p class="ghint">Closed by mistake? <button class="linkbtn" id="qReopen">Reopen ${esc(Q_NAMES[lastClosed - 1])}</button> — its alerts come back; the saved copy stays.</p>` : ''}
    </div></div>`;
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; render(); };
  m._cancel = close; $('#mClose').onclick = close; const mc = $('#mCancel'); if (mc) mc.onclick = close; m.onclick = e => { if (e.target === m) close(); };
  const isOpen = id => { const d = $('#' + id); return !!(d && d.open); };
  const picksNow = () => { const o = {}; m.querySelectorAll('[data-qu]:not(:disabled)').forEach(cb => { o[cb.dataset.qu] = cb.checked; }); return o; };
  const again = extra => openQuarters({ dates: isOpen('qDates'), units: isOpen('qUnits'), early: isOpen('qEarly'), picks: picksNow(), ...(extra || {}) });
  m.querySelectorAll('[data-qend]').forEach(inp => inp.onchange = () => { if (!ISO_RE.test(inp.value)) return; q.ends[Number(inp.dataset.qend)] = inp.value; state.order.map(k => state.sections[k]).forEach(s => { if (s.grades) gradeSnapshot(s); }); save(); again(); });
  const sum = $('#qUnitSum'); const unitSum = () => { if (!sum) return; const by = { acc: [], on: [] }; m.querySelectorAll('[data-qu]:checked:not(:disabled)').forEach(cb => by[cb.dataset.qu.split('|')[0]].push(cb.dataset.short));
    const part = (p, label) => courseUnits(p).length ? `${label} ${by[p].length ? by[p].join(', ') : 'none'}` : ''; sum.textContent = [part('acc', 'Accelerated'), part('on', 'On-level')].filter(Boolean).join(' · '); };
  m.querySelectorAll('[data-qu]').forEach(cb => cb.onchange = unitSum); unitSum();
  const qc = $('#qClose'); if (qc) qc.onclick = () => {
    const picks = { acc: [], on: [] }; m.querySelectorAll('[data-qu]:checked:not(:disabled)').forEach(cb => { const [p, u] = cb.dataset.qu.split(/\|(.*)/s); picks[p].push(u); });
    const per = closeQuarter(n, picks); save(); m.classList.add('hidden'); m.innerHTML = ''; render();
    toast(`<b>${esc(QN)} closed.</b> ${per.length ? `${plural(per.length, 'class')} kept` : 'No gradebook had work from it'} — it won't come up again unless you reopen it.`, false, 5000);
  };
  const ro = $('#qReopen'); if (ro) ro.onclick = () => { if (!confirm(`Reopen ${Q_NAMES[lastClosed - 1]}? Its missing work, Focus checks and still-owed lines come back. The saved copy stays.`)) return; reopenQuarter(lastClosed); save(); openQuarters({}); };
}
