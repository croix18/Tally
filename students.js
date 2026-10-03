/* ---------- students.js — Students: every student in one place, for the teacher ----------
   Spliced into app.js's closure. Teacher-only: never reachable from the projected Race/Data Lab, and the Names toggle
   masks names here as everywhere. Three surfaces:
     · Students (view.mode 'students') — every student of every class, searchable, with grade, change, missing, IXL.
     · A student's page (view.mode 'student', view.stu = { key, name }) — the grade now and at the end of each closed
       quarter, trends across the year, every assignment and assessment, IXL by unit, and what would move the grade.
     · Show student (#show) — the what-ifs turned toward the student: only their numbers, sliders they can drag,
       nothing else on screen until the teacher holds to exit. */

const tcase = s => String(s || '').toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (m, p, c) => p + c.toUpperCase()).replace(/\bMc([a-z])/g, (m, c) => 'Mc' + c.toUpperCase()).replace(/\bO'([a-z])/g, (m, c) => "O'" + c.toUpperCase());
// "LAST, FIRST MIDDLE" → "First Last"; anything else title-cased as it is.
const niceName = d => { const m = String(d || '').match(/^([^,]+),\s*(.+)$/); return m ? tcase(m[2].split(/\s+/)[0] + ' ' + m[1]) : tcase(d); };
const firstName = d => { const m = String(d || '').match(/^[^,]+,\s*(\S+)/); return tcase(m ? m[1] : String(d || '').split(/\s+/)[0]); };
const mean = a => { const v = a.filter(x => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };

// Name matching is the expensive part (buildRows), so one screen reads each class's rows once: renderStudentsView and
// renderProfile reset the cache, everything they call shares it.
let rowCache = new Map();
const cachedRows = (sec, kind) => { const k = sec.key + '|' + kind; if (!rowCache.has(k)) rowCache.set(k, kind === 'gb' ? gbRows(sec) : buildRows(sec)); return rowCache.get(k); };
// Where a student sits in a class: their gradebook row (gi, -1 if none) and IXL row (ixl, null if unmatched).
function findStudent(sec, name) {
  const nn = norm(name); const gb = sec.grades;
  const gi = gb ? gb.students.findIndex(n => norm(n) === nn) : -1;
  let row = gi >= 0 ? cachedRows(sec, 'gb')[gi] : null;
  if (!row || row.ixl == null) { const r2 = cachedRows(sec, 'all').find(r => norm(r.display) === nn && r.status !== 'ixlOnly'); if (r2) row = r2; }
  return { gi, ixl: row && row.ixl != null ? row.ixl : null, row, id: row && row.id ? row.id : (gb && gi >= 0 && gb.ids ? gb.ids[gi] : '') };
}
// The students of a class, in Focus order: the roster rows (the gradebook's list when one is loaded).
function classStudents(sec) {
  if (sec.placeholder) return [];
  const rows = cachedRows(sec, 'all').filter(r => r.status !== 'ixlOnly'); const seen = new Set(rows.map(r => norm(r.display)));
  const extra = sec.grades ? sec.grades.students.filter(n => !seen.has(norm(n))) : [];
  return rows.map(r => r.display).concat(extra);
}
// IXL for one student: per assigned unit (points, own total, skills below goal / not started), split open vs closed.
function ixlFor(sec, si) {
  if (si == null) return null; const t = sec.threshold;
  const units = unitsOf(sec).filter(u => u.assigned && u.total).map(u => { const own = activeFor(sec, u, si);
    return { u, q: unitQuarter(sec, u), closed: unitClosed(sec, u), p: points(sec, u, si), n: own.length,
      below: own.filter(k => { const v = eff(sec, k, si); return v != null && v < t; }).map(k => ({ name: sec.skills[k].name, v: eff(sec, k, si) })),
      notStarted: own.filter(k => eff(sec, k, si) == null).map(k => sec.skills[k].name) }; });
  const open = units.filter(x => !x.closed); const basis = open.length ? open : units;
  const done = basis.reduce((a, x) => a + x.p, 0), poss = basis.reduce((a, x) => a + x.n, 0);
  return { units, open, done, poss, pct: poss ? done / poss * 100 : null, basisClosed: !open.length && units.length > 0 };
}
// Skills at goal on today's assigned units at each IXL import (the same reading the Race uses), and the class mean.
function ixlTrend(sec, si) {
  const hist = sec.history || []; if (!hist.length || si == null) return null; const key = ixlKeyAt(sec, si);
  const units = unitsOf(sec).filter(u => u.assigned);
  const val = (h, k) => h.pu ? units.reduce((a, u) => a + ((h.pu[u.name] || {})[k] || 0), 0) : (h.per[k] != null ? h.per[k] : null);
  return { dates: hist.map(h => h.date), mine: hist.map(h => h.per[key] == null ? null : val(h, key)), cls: hist.map(h => mean(Object.keys(h.per).map(k => val(h, k)))) };
}
// Every gradebook this student appears in, oldest quarter first: the closed archives, then the open gradebook.
function studentBooks(sec, name) {
  const out = [];
  for (let n = 1; n <= 4; n++) { const s = qSec(sec, n); if (!s || !s._arch) continue; const i = s.grades.students.findIndex(x => norm(x) === norm(name)); if (i >= 0) out.push({ q: n, closed: true, final: s._closed, s, i }); }
  if (sec.grades) { const s = openSec(sec); const i = s.grades.students.findIndex(x => norm(x) === norm(name)); if (i >= 0 && s.grades.assignments.length) out.push({ q: snapBasis(sec).q, closed: false, s, i }); }
  return out;
}
const cellOf = (a, i) => { const st = a.status ? a.status[i] : (a.values[i] == null ? 'blank' : 'score'); return { st, v: a.values[i] }; };
const avgPct = a => { const v = a.values.filter(x => x != null); return v.length && a.max ? v.reduce((x, y) => x + y, 0) / v.length / a.max * 100 : null; };
const isAssess = (s, a) => catIn(s, a) === 'Assessments' && !/\bixl\b/i.test(a.name) && a.max > 0;

// One summary line per student for the directory and the class navigation.
function studentSummary(sec, name) {
  const f = findStudent(sec, name); const o = openSec(sec); const out = { sec, name, f, grade: null, d: null, missing: 0, ixl: null, finals: [] };
  if (o && o.grades && f.gi >= 0 && o.grades.assignments.length) {
    const r = computeGrade(o, f.gi); out.grade = r; out.missing = o.grades.assignments.filter(a => a.status && a.status[f.gi] === 'missing').length;
    const prev = prevGradeSnap(o); if (prev && r && r.rounded != null) { const j = prev.students.indexOf(name); if (j >= 0 && prev.grade[j] != null) out.d = r.rounded - prev.grade[j]; if (j >= 0) out.dMissing = out.missing - prev.missing[j]; }
    out.sliding = (out.d != null && out.d <= -3) || out.dMissing > 0;
  }
  for (let n = 1; n <= 4; n++) { const k = qSec(sec, n); if (!k || !k._arch) continue; const a = sec.qArchive[n]; const i = a.gb.students.findIndex(x => norm(x) === norm(name)); if (i >= 0 && a.final[i] != null) out.finals.push({ q: n, g: a.final[i], closed: k._closed }); }
  const ix = ixlFor(sec, f.ixl); if (ix) out.ixl = ix;
  return out;
}

/* ---------- Students directory ---------- */
let stuSort = 'class', stuClass = '';
function renderStudentsView() {
  rowCache = new Map();
  const H = state.settings.hideNames; const nm = d => esc(H ? mask(d) : niceName(d)); const q = norm(search);
  const secs = state.order.map(k => state.sections[k]).filter(s => !stuClass || s.key === stuClass);
  let rows = []; secs.forEach(s => classStudents(s).forEach(n => { if (!q || norm(n).includes(q) || norm(niceName(n)).includes(q)) rows.push(studentSummary(s, n)); }));
  const g = r => r.grade && r.grade.rounded != null ? r.grade.rounded : 999;
  if (stuSort === 'grade') rows.sort((a, b) => g(a) - g(b) || a.name.localeCompare(b.name));
  else if (stuSort === 'missing') rows.sort((a, b) => b.missing - a.missing || g(a) - g(b));
  else if (stuSort === 'sliding') rows.sort((a, b) => (b.sliding ? 1 : 0) - (a.sliding ? 1 : 0) || (a.d ?? 0) - (b.d ?? 0) || g(a) - g(b));
  else if (stuSort === 'name') rows.sort((a, b) => norm(a.name).localeCompare(norm(b.name)));
  const cq = currentQuarter(); const closedQs = [1, 2, 3, 4].filter(n => qClosed(n));
  $('#bar').innerHTML = `<h2>Students</h2><span class="meta">${plural(rows.length, 'student')}${q ? ` matching “${esc(search)}”` : ''} · grades are ${esc(Q_NAMES[cq - 1])}${closedQs.length ? ` · ${closedQs.map(n => 'Q' + n).join(', ')} closed` : ''}</span><div class="spacer"></div>
    <label class="curUnit">Class <select id="stuClass"><option value="">Every class</option>${state.order.map(k => `<option value="${esc(k)}" ${k === stuClass ? 'selected' : ''}>${esc(state.sections[k].label)}</option>`).join('')}</select></label>
    <div class="seg small" role="group" aria-label="Sort">${[['class', 'By class'], ['name', 'A–Z'], ['grade', 'Lowest grade'], ['missing', 'Most missing'], ['sliding', 'Sliding']].map(([k, l]) => `<button data-sort="${k}" class="${stuSort === k ? 'on' : ''}" aria-pressed="${stuSort === k}">${l}</button>`).join('')}</div>
    <div class="legend"><span>Tap a student for everything: grades, trends, what-ifs</span></div>`;
  $('#bar').classList.add('detail');
  let lastSec = null; let body = '';
  rows.forEach(r => {
    if (stuSort === 'class' && r.sec !== lastSec) { lastSec = r.sec; body += `<tr class="sgroup"><th colspan="8" style="--cc:${classColor(r.sec)}">${esc(r.sec.label)}</th></tr>`; }
    const o = openSec(r.sec); const qs = r.grade && r.f.gi >= 0 ? quickestPath(r.sec, o, r.f.gi, r.f.ixl) : null;
    const ix = r.ixl; const fin = r.finals.map(x => `<span class="qfin">Q${x.q} ${x.g}<small>${letterOf(x.g)}</small></span>`).join('');
    body += `<tr data-open="${esc(r.sec.key)}" data-name="${esc(r.name)}" class="${r.sliding ? 'sliding' : ''}"><td><button class="nm nmbtn">${nm(r.name)}</button>${r.sliding ? ' <span class="gtag">sliding</span>' : ''}</td>
      <td><span class="qdot" style="--cc:${classColor(r.sec)}"></span>${esc(r.sec.label)}</td><td>${r.grade ? gradeChip(r.grade) : '<small>no grade yet</small>'}</td>
      <td class="${r.d < 0 ? 'down' : r.d > 0 ? 'up' : ''}">${r.d == null ? '' : signedPts(r.d)}</td><td>${r.missing || ''}</td>
      <td>${ix && ix.pct != null ? `${Math.round(ix.pct)}% <small>${ix.done}/${ix.poss}</small>` : '<small>—</small>'}</td><td class="qcol">${quickestShort(qs)}</td><td>${fin}</td></tr>`;
  });
  $('#gridwrap').innerHTML = `<div class="grades stuDir"><section class="gsec"><table class="checkTable gstu sdir"><thead><tr><th>Student</th><th>Class</th><th>${esc(Q_NAMES[cq - 1])}</th><th>Since last import</th><th>Missing</th><th>IXL at goal</th><th>Quickest to the next letter</th><th>Closed quarters</th></tr></thead><tbody>${body || `<tr><td colspan="8" class="ghint">${q ? `No student matches “${esc(search)}”.` : 'No students yet — import a Focus gradebook or paste a roster.'}</td></tr>`}</tbody></table></section></div>`;
  $('#gridwrap').querySelectorAll('tr[data-open]').forEach(tr => tr.onclick = () => openProfile(tr.dataset.open, tr.dataset.name));
  $('#bar').querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { stuSort = b.dataset.sort; render(); });
  const sc = $('#stuClass'); if (sc) sc.onchange = () => { stuClass = sc.value; render(); };
}

/* ---------- One student's page ---------- */
let profileBack = null;
function openProfile(key, name, from) {
  if (!state.sections[key] || !name) return;
  const m = $('#modal'); if (!m.classList.contains('hidden')) { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; }
  profileBack = from || (view.mode === 'student' ? profileBack : { ...view, active: state.active });
  $('#toast').classList.remove('show');   // a lingering toast can carry other names
  state.active = key; view = { mode: 'student', unit: null, stu: { key, name } }; render();
}
function profileLeave() {
  const b = profileBack; profileBack = null;
  if (b && b.mode && b.mode !== 'student') { if (b.active && state.sections[b.active]) state.active = b.active; view = { mode: b.mode, unit: b.unit || null, sub: b.sub, q: b.q }; }
  else view = { mode: 'students', unit: null };
  render();
}
function renderProfile() {
  rowCache = new Map();
  const st = view.stu; const sec = state.sections[st.key]; if (!sec) { view = { mode: 'students', unit: null }; return render(); }
  const H = state.settings.hideNames; const name = st.name; const shownName = H ? mask(name) : niceName(name); const nm = d => esc(H ? mask(d) : niceName(d));
  const f = findStudent(sec, name); const sum = studentSummary(sec, name); const books = studentBooks(sec, name);
  const openB = books.find(b => !b.closed); const cq = currentQuarter();
  const list = classStudents(sec); const at = list.findIndex(n => norm(n) === norm(name));
  const backLabel = profileBack && profileBack.mode === 'grades' ? 'Grades' : profileBack && profileBack.mode === 'home' ? 'Overview' : profileBack && profileBack.mode === 'seating' ? 'Seating' : profileBack && (profileBack.mode === 'units' || profileBack.mode === 'unit') ? sec.label : 'Students';
  $('#bar').innerHTML = `<div class="crumb"><button id="back">‹ ${esc(backLabel)}</button><h2>${esc(shownName)}</h2></div><span class="meta"><span class="qdot" style="--cc:${classColor(sec)}"></span>${esc(sec.label)}${f.id && !H ? ` · ID ${esc(f.id)}` : ''}${at >= 0 ? ` · ${at + 1} of ${list.length}` : ''}</span><div class="spacer"></div>
    <button class="pill toggle" id="pPrev" ${at > 0 ? '' : 'disabled'} title="Previous student in this class">‹ Prev</button><button class="pill toggle" id="pNext" ${at >= 0 && at < list.length - 1 ? '' : 'disabled'} title="Next student in this class">Next ›</button>
    ${openB ? `<button class="pill toggle" id="pPrint" title="One printed page for the student and home">Print report</button><button class="pill" id="pShow" title="Turn the screen toward the student: their grade and what-ifs, nothing else">Show student</button>` : ''}`;
  $('#bar').classList.add('detail');

  // headline tiles
  const r = sum.grade; const ix = sum.ixl;
  const assessNow = openB ? (() => { let e = 0, p = 0; openB.s.grades.assignments.filter(a => isAssess(openB.s, a)).forEach(a => { const c = cellOf(a, openB.i); if (c.st === 'score' || c.st === 'missing') { e += c.st === 'missing' ? 0 : (c.v || 0); p += a.max; } }); return p ? e / p * 100 : null; })() : null;
  const it = ixlTrend(sec, f.ixl); const itD = it && it.mine.filter(v => v != null).length >= 2 ? (() => { const v = it.mine.filter(x => x != null); return v[v.length - 1] - v[v.length - 2]; })() : null;
  const tiles = `<div class="gcards">
    <div class="gcard big"><small>${esc(Q_NAMES[cq - 1])} grade</small>${r && r.rounded != null ? `<b>${r.rounded}%<em class="lt ${r.letter}">${r.letter}</em></b><span class="${sum.d < 0 ? 'down' : 'up'}">${sum.d != null ? `${signedPts(sum.d)} since the last import` : 'first import this quarter'}</span>` : `<b>—</b><span>${f.gi < 0 ? 'not in this class\'s Focus gradebook' : openB ? 'nothing graded yet (all excused or blank)' : 'no ' + esc(Q_NAMES[cq - 1]) + ' gradebook yet'}</span>`}</div>
    ${sum.finals.map(x => `<div class="gcard"><small>${esc(Q_NAMES[x.q - 1])} ${x.closed ? 'final' : '(kept)'}</small><b>${x.g}%<em class="lt ${letterOf(x.g)}">${letterOf(x.g)}</em></b><span>${x.closed ? 'closed · kept in Tally' : 'not closed yet · kept in Tally'}</span></div>`).join('')}
    <div class="gcard"><small>Missing now</small><b>${openB ? sum.missing : '—'}</b><span>${openB ? (sum.dMissing > 0 ? `+${sum.dMissing} since the last import` : sum.missing ? 'not handed in (counts as 0)' : 'nothing missing') : ''}</span></div>
    <div class="gcard"><small>IXL at goal</small><b>${ix && ix.pct != null ? Math.round(ix.pct) + '%' : '—'}</b><span>${ix && ix.poss ? `${ix.done} of ${ix.poss} skills${ix.basisClosed ? ' (closed units)' : ''}${itD != null ? ` · ${itD >= 0 ? '+' : '−'}${Math.abs(itD)} since the last export` : ''}` : f.ixl == null ? 'not matched to IXL' : 'no units assigned'}</span></div>
    <div class="gcard"><small>Tests &amp; quizzes</small><b>${assessNow != null ? Math.round(assessNow) + '%' : '—'}</b><span>${assessNow != null ? 'assessment points, IXL columns left out' : ''}</span></div>
  </div>`;

  // trends
  const gh = sec.gradeHistory || []; let trends = '';
  if (gh.length) {
    const labels = gh.map(h => fmtDate(h.date)); const marks = []; gh.forEach((h, i) => { if (i && snapQ(h) !== snapQ(gh[i - 1])) marks.push({ i, label: 'Q' + snapQ(h) }); });
    const mine = gh.map(h => { const j = h.students.indexOf(name); return j >= 0 ? h.grade[j] : null; }); const cls = gh.map(h => mean(h.grade));
    const gradeChart = mine.filter(v => v != null).length >= 2 ? chartLines(labels, [{ name: H ? mask(name) : firstName(name), values: mine, color: 'var(--teal)' }, { name: 'Class average', values: cls, color: '#8a93a6', ref: true }], { pct: true, min: (lo => lo >= 65 ? 60 : lo >= 25 ? 20 : 0)(Math.min(...mine.filter(v => v != null), ...cls.filter(v => v != null))), max: 100, h: 240, w: 760, marks, aria: 'grade by import against the class average' }) : '';
    const catNames = gradingFor(sec.prep).cats.map(c => c.name); const hc = gh.filter(h => h.cats);
    const catChart = hc.length >= 2 ? chartLines(hc.map(h => fmtDate(h.date)), catNames.map((c, k) => ({ name: c, values: hc.map(h => { const j = h.students.indexOf(name); return j >= 0 && h.cats[c] ? h.cats[c][j] : null; }), color: seriesColor(k) })).filter(sr => sr.values.some(v => v != null)), { pct: true, min: 0, max: 100, h: 220, w: 760, aria: 'category percent by import' }) : '';
    const missChart = mine.filter(v => v != null).length >= 2 ? chartLines(labels, [{ name: 'Missing', values: gh.map(h => { const j = h.students.indexOf(name); return j >= 0 ? h.missing[j] : null; }), color: 'var(--bad)' }], { min: 0, h: 180, w: 760, marks, aria: 'missing assignments by import' }) : '';
    const ixlChart = it && it.mine.filter(v => v != null).length >= 2 ? chartLines(it.dates.map(fmtDate), [{ name: H ? mask(name) : firstName(name), values: it.mine, color: 'var(--teal)' }, { name: 'Class average', values: it.cls, color: '#8a93a6', ref: true }], { min: 0, h: 200, w: 760, aria: 'IXL skills at goal by export' }) : '';
    trends = `<section class="gsec"><h3>Grade over the year</h3>${gradeChart || `<p class="ghint">The line appears after a second Focus import (${plural(mine.filter(v => v != null).length, 'import')} so far).</p>`}
      ${catChart ? `<h4 class="subh">Each category</h4>${catChart}` : ''}
      <div class="gtwo">${missChart ? `<div><h4 class="subh">Missing work</h4>${missChart}</div>` : ''}${ixlChart ? `<div><h4 class="subh">IXL skills at goal</h4>${ixlChart}</div>` : ''}</div></section>`;
  }

  // assessments across the year
  const assess = []; books.forEach(b => b.s.grades.assignments.filter(a => isAssess(b.s, a)).forEach(a => { const c = cellOf(a, b.i); if (c.st === 'blank' || c.st === 'unread') return; assess.push({ a, q: b.q, closed: b.closed, date: aDate(a, b.s.grades) || '', pct: c.st === 'missing' ? 0 : c.st === 'score' ? (c.v || 0) / a.max * 100 : null, c, avg: avgPct(a) }); }));
  assess.sort((x, y) => x.date.localeCompare(y.date) || x.a.name.localeCompare(y.a.name));
  const aMarks = []; assess.forEach((x, i) => { if (i && x.q !== assess[i - 1].q) aMarks.push({ i, label: 'Q' + x.q }); });
  const assessChart = assess.filter(x => x.pct != null).length >= 2 ? chartLines(assess.map(x => x.date ? fmtDate(x.date) : x.a.name.slice(0, 10)), [{ name: H ? mask(name) : firstName(name), values: assess.map(x => x.pct), color: 'var(--teal)' }, { name: 'Class average', values: assess.map(x => x.avg), color: '#8a93a6', ref: true }], { pct: true, min: 0, max: 100, h: 230, w: 760, marks: aMarks, aria: 'each assessment score against the class average' }) : '';
  const scoreTxt = (c, a) => c.st === 'missing' ? '<b class="nhi">NHI</b>' : c.st === 'excused' ? '<small>excused</small>' : c.st === 'score' ? `${fmtN(c.v)}/${a.max}` : '—';
  const assessSec = assess.length ? `<section class="gsec"><h3>Assessments across the year</h3>${assessChart}<table class="checkTable"><thead><tr><th>Assessment</th><th>Quarter</th><th>Due</th><th>Score</th><th>%</th><th>Class avg</th><th>vs class</th></tr></thead><tbody>
      ${assess.slice().reverse().map(x => `<tr class="${x.closed ? 'qold' : ''}"><td>${esc(x.a.name)}</td><td>Q${x.q}${x.closed ? ' <small>closed</small>' : ''}</td><td>${esc(x.a.due || '')}</td><td>${scoreTxt(x.c, x.a)}</td><td>${x.pct == null ? '' : Math.round(x.pct) + '%'}</td><td>${pct1(x.avg)}</td><td class="${x.pct != null && x.avg != null ? (x.pct - x.avg < -5 ? 'down' : x.pct - x.avg > 5 ? 'up' : '') : ''}">${x.pct != null && x.avg != null ? signedPts(Math.round(x.pct - x.avg)) : ''}</td></tr>`).join('')}</tbody></table></section>` : '';

  // every assignment, per quarter
  const table = b => { const rows = b.s.grades.assignments.map(a => ({ a, c: cellOf(a, b.i), cat: catIn(b.s, a), avg: avgPct(a) })).sort((x, y) => dueKey(y.a.due).localeCompare(dueKey(x.a.due)) || x.a.name.localeCompare(y.a.name));
    const g = computeGrade(b.s, b.i);
    return `<div class="catline">${(b.s._cats || gradingFor(sec.prep).cats).map(c => { const x = g && g.cats[c.name]; return `<div class="catbar"><span>${esc(c.name)} <small>${c.w}%</small></span><div class="bar"><i style="width:${x && x.pct != null ? Math.max(0, Math.min(100, x.pct)) : 0}%"></i></div><b>${x && x.pct != null ? pct1(x.pct) : '—'}</b><small>${x && x.possible ? `${+x.earned.toFixed(1)} / ${x.possible} pts` : ''}</small></div>`; }).join('')}</div>
      <table class="checkTable sasg"><thead><tr><th>Assignment</th><th>Category</th><th>Due</th><th>Score</th><th>%</th><th>Class avg</th></tr></thead><tbody>${rows.map(x => `<tr class="${x.c.st === 'missing' ? 'miss' : ''}"><td>${esc(x.a.name)}</td><td>${esc(x.cat)}</td><td>${esc(x.a.due || '')}</td><td>${scoreTxt(x.c, x.a)}</td><td>${x.c.st === 'score' && x.a.max ? Math.round(x.c.v / x.a.max * 100) + '%' : x.c.st === 'missing' ? '0%' : ''}</td><td>${pct1(x.avg)}</td></tr>`).join('')}</tbody></table>`; };
  const asgSecs = books.slice().reverse().map(b => { const g = computeGrade(b.s, b.i); const miss = b.s.grades.assignments.filter(a => cellOf(a, b.i).st === 'missing').length;
    const head = `${esc(Q_NAMES[b.q - 1])}${b.closed ? (b.final ? ' · final' : ' · kept') : ''} · ${g && g.rounded != null ? `${g.rounded}% ${g.letter}` : '—'} · ${plural(b.s.grades.assignments.length, 'assignment')}${miss ? ` · ${miss} missing` : ''}`;
    return b.closed ? `<details class="gsec qbook"><summary><h3>${head}</h3><small>${b.final ? `closed ${esc(fmtDate((quarters().closed[b.q].at || '').slice(0, 10)))} — nothing here raises alerts` : 'kept when the next quarter\'s export arrived — close the quarter under Quarters'}</small></summary>${table(b)}</details>` : `<section class="gsec qbook"><h3>${head}</h3>${table(b)}</section>`; }).join('');

  // IXL by unit
  let ixlSec = '';
  if (ix && ix.units.length) {
    const unitRow = x => `<div class="iu ${x.closed ? 'closed' : ''}"><div class="iuh"><b>${esc(x.u.short)}</b> <span>${esc(x.u.title)}</span>${x.closed ? ` <span class="gtag muted">Q${x.q} · closed</span>` : x.u.current ? ' <span class="gtag">now</span>' : ''}<span class="iup">${x.p} / ${x.n}</span></div><div class="bar"><i style="width:${x.n ? x.p / x.n * 100 : 0}%"></i></div>
      ${x.below.length ? `<div class="iul"><span>Below goal (${sec.threshold}):</span> ${x.below.map(b => `${esc(b.name)} <small>${b.v}</small>`).join(' · ')}</div>` : ''}${x.notStarted.length ? `<div class="iul"><span>Not started:</span> ${esc(x.notStarted.join(' · '))}</div>` : ''}${!x.below.length && !x.notStarted.length ? `<div class="iul done">All ${x.n} skills at goal</div>` : ''}</div>`;
    const cl = ix.units.filter(x => x.closed);
    ixlSec = `<section class="gsec"><h3>IXL by unit <small>goal SmartScore ${sec.threshold} · export of ${esc(fmtDate(dataDate(sec)))}</small></h3>${ix.open.map(unitRow).join('') || '<p class="ghint">Every assigned unit is in a closed quarter.</p>'}
      ${cl.length ? `<details class="qunitsold"><summary>${plural(cl.length, 'unit')} from closed quarters — still tracked, no alerts</summary>${cl.map(unitRow).join('')}</details>` : ''}</section>`;
  } else if (f.ixl == null) ixlSec = `<section class="gsec"><h3>IXL</h3><p class="ghint">Not matched to an IXL account in this class.</p></section>`;

  // what would move it (open quarter only)
  const qp = openB ? quickestPath(sec, openB.s, openB.i, f.ixl) : null;
  const wi = openB ? `${qp ? `<section class="gsec" id="pQuick">${quickestCard(qp)}</section>` : ''}<section class="gsec" id="pWhat"><h3>What would move the grade <small>${esc(Q_NAMES[openB.q - 1])}</small></h3>${whatIfMarkup(openB.s, openB.i)}</section>`
    : `<section class="gsec"><h3>What would move the grade</h3><p class="ghint">${anyClosed() ? `${esc(Q_NAMES[cq - 1])} has no gradebook yet — closed quarters don't change, so there's nothing to move until the first ${esc(Q_NAMES[cq - 1])} import.` : 'Import this class\'s Focus gradebook for grades and what-ifs.'}</p></section>`;

  $('#gridwrap').innerHTML = `<div class="grades profile">${tiles}<div class="pcols"><div class="pmain">${trends}${assessSec}${asgSecs}</div><div class="pside">${wi}${ixlSec}</div></div></div>`;
  if (openB) wireWhatIf($('#pWhat'), openB.s, openB.i);
  $('#back').onclick = profileLeave;
  const go = d => { const n = list[at + d]; if (n) { view.stu = { key: sec.key, name: n }; render(); } };
  $('#pPrev').onclick = () => go(-1); $('#pNext').onclick = () => go(1);
  const pp = $('#pPrint'); if (pp) pp.onclick = () => printStudentReports(sec, [f.gi], `${name} — report`);
  const ps = $('#pShow'); if (ps) ps.onclick = () => openShow(sec, name);
}

/* ---------- Quickest way to the next letter ----------
   The fewest pieces of work that lift the grade one letter (F→D, D→C, C→B, B→A), chosen one at a time by what each adds.
   Missing work (NHI) and IXL come first — that is where struggling students' points are; only if those can't get there are
   retakes added (the last one at the lowest score that still works). An IXL step is one skill: one more point in that
   unit's Focus IXL column, and the page names which skills are closest to goal. */
const NEXT_UP = [[60, 'D'], [70, 'C'], [80, 'B'], [90, 'A']];
function quickestPath(sec, s, i, ixlIdx) {
  const base = computeGrade(s, i); if (!base || base.rounded == null) return null;
  const tgt = NEXT_UP.find(([t]) => base.rounded < t); if (!tgt) return { top: true, base };
  const [target, letter] = tgt; const gb = s.grades;
  const ixlCol = a => /\bixl\b/i.test(a.name) && a.max > 0 && a.status && (a.status[i] === 'score' || a.status[i] === 'missing');
  const nowOf = a => a.status[i] === 'missing' ? 0 : (Number(a.values[i]) || 0);
  const nhi = gb.assignments.filter(a => a.max > 0 && a.status && a.status[i] === 'missing' && !ixlCol(a));
  const ixl = gb.assignments.filter(a => ixlCol(a) && nowOf(a) < a.max);
  const over = {}; const done = new Set(); const ixlPlus = {}; const g = () => computeGrade(s, i, over).rounded;
  let cur = g(); let guard = 0;
  // phase 1: missing work and IXL skills, best gain first (ties go to missing work: one assignment, done)
  while (cur < target && guard++ < 400) {
    let best = null;
    nhi.forEach(a => { if (done.has(a.name)) return; over[a.name] = a.max; const v = computeGrade(s, i, over).pct; delete over[a.name]; if (!best || v > best.v + 1e-9) best = { v, kind: 'nhi', a }; });
    ixl.forEach(a => { const at = nowOf(a) + (ixlPlus[a.name] || 0); if (at >= a.max) return; const prev = over[a.name]; over[a.name] = at + 1; const v = computeGrade(s, i, over).pct; if (prev == null) delete over[a.name]; else over[a.name] = prev; if (!best || v > best.v + 1e-9) best = { v, kind: 'ixl', a }; });
    if (!best) break;
    if (best.kind === 'nhi') { over[best.a.name] = best.a.max; done.add(best.a.name); }
    else { ixlPlus[best.a.name] = (ixlPlus[best.a.name] || 0) + 1; over[best.a.name] = nowOf(best.a) + ixlPlus[best.a.name]; }
    cur = g();
  }
  // prune: greedy can overshoot — drop any assignment, then any IXL skill, the plan still reaches the letter without
  if (cur >= target) {
    [...done].forEach(n => { const v = over[n]; delete over[n]; if (g() >= target) done.delete(n); else over[n] = v; });
    Object.keys(ixlPlus).forEach(n => { const a = gb.assignments.find(x => x.name === n); while (ixlPlus[n] > 0) { ixlPlus[n]--; if (ixlPlus[n]) over[n] = nowOf(a) + ixlPlus[n]; else delete over[n]; if (g() < target) { ixlPlus[n]++; over[n] = nowOf(a) + ixlPlus[n]; break; } } if (!ixlPlus[n]) delete ixlPlus[n]; });
    cur = g();
  }
  // phase 2: retakes, only when missing work and IXL can't reach the letter
  const retakes = [];
  if (cur < target) {
    const tests = gb.assignments.filter(a => isAssess(s, a) && a.status && a.status[i] === 'score' && (Number(a.values[i]) || 0) < a.max);
    while (cur < target) {
      let best = null; tests.forEach(a => { if (over[a.name] != null) return; over[a.name] = a.max; const v = computeGrade(s, i, over).pct; delete over[a.name]; if (!best || v > best.v) best = { v, a }; });
      if (!best) break; over[best.a.name] = best.a.max; retakes.push(best.a); cur = g();
    }
    if (cur >= target && retakes.length) { const a = retakes[retakes.length - 1]; for (let p = Math.ceil((Number(a.values[i]) || 0) * 2) / 2; p <= a.max; p += 0.5) { over[a.name] = p; if (g() >= target) break; } cur = g(); }
  }
  // the IXL skills to do, closest to goal first, per Focus IXL column
  const ixlSteps = Object.keys(ixlPlus).map(name => { const a = gb.assignments.find(x => x.name === name); const u = gbUnitFor(sec, a); let skills = [];
    if (u && ixlIdx != null) { const t = sec.threshold; const unit = unitsOf(sec).find(x => x.name === u.name); if (unit) skills = activeFor(sec, unit, ixlIdx).map(k => ({ name: sec.skills[k].name, v: eff(sec, k, ixlIdx) })).filter(x => x.v == null || x.v < t).sort((x, y) => (y.v ?? -1) - (x.v ?? -1)).slice(0, ixlPlus[name]); }
    return { a, n: ixlPlus[name], unit: u, skills }; });
  const result = computeGrade(s, i, over);
  return { base, target, letter, reached: result.rounded >= target, result, over, nhi: nhi.filter(a => done.has(a.name)), ixl: ixlSteps, retakes: retakes.map(a => ({ a, pts: over[a.name] })), steps: done.size + ixlSteps.reduce((x, y) => x + y.n, 0) + retakes.length };
}
const anLetter = l => (/^[AF]/.test(l) ? 'an ' : 'a ') + l;
// One line for the Students list: "2 missing + 3 IXL skills → C".
function quickestShort(q) {
  if (!q) return ''; if (q.top) return '<small>has an A</small>';
  const parts = []; if (q.nhi.length) parts.push(q.nhi.length + ' missing'); const ix = q.ixl.reduce((a, x) => a + x.n, 0); if (ix) parts.push(plural(ix, 'IXL skill')); if (q.retakes.length) parts.push(plural(q.retakes.length, 'retake'));
  return q.reached ? `${parts.join(' + ')} → <b>${q.letter}</b>` : `<small>${q.letter} needs more than missing work, IXL and retakes</small>`;
}
// The plan as a list, for the teacher's page, the student's screen and the printed report.
function quickestList(q, forStudent) {
  if (!q || q.top) return '';
  const you = forStudent ? 'Turn in' : 'Turn in'; const items = [];
  q.nhi.forEach(a => items.push(`<li><b>${you} ${esc(a.name)}</b> <small>${a.max} pts${a.due ? ' · was due ' + esc(a.due) : ''}</small></li>`));
  q.ixl.forEach(x => items.push(`<li><b>Pass ${plural(x.n, 'more IXL skill')}${x.unit ? ' in ' + esc(x.unit.short) : ''}</b> <small>${esc(x.a.name)}</small>${x.skills.length ? `<div class="qsk">${x.skills.map(k => `${esc(k.name)} <small>${k.v == null ? 'not started' : 'at ' + k.v}</small>`).join(' · ')}</div>` : ''}</li>`));
  q.retakes.forEach(r => items.push(`<li><b>Retake ${esc(r.a.name)}</b> <small>score at least ${fmtN(r.pts)} / ${r.a.max}</small></li>`));
  return `<ol class="qpath">${items.join('')}</ol>`;
}
function quickestCard(q, forStudent) {
  if (!q) return ''; if (q.top) return `<div class="qcard top"><b>${forStudent ? 'You have an A' : 'Already an A'}</b><span>${forStudent ? 'Keep turning everything in.' : 'Nothing to climb — the what-ifs below show what keeps it.'}</span></div>`;
  const head = forStudent ? `Your quickest way to ${anLetter(q.letter)}` : `Quickest way to ${anLetter(q.letter)}`;
  if (!q.reached) return `<div class="qcard"><b>${head}</b><span>Even with every missing assignment turned in, IXL finished and every retake at full marks, the grade only reaches ${q.result.rounded}%. It will take the next assessments too.</span>${quickestList(q, forStudent)}</div>`;
  return `<div class="qcard"><div class="qhead"><b>${head}</b><span class="qres">${q.base.rounded}% → <b>${q.result.rounded}% ${q.result.letter}</b></span></div><span>${plural(q.steps, 'step')}${q.ixl.length ? ' · IXL counts once it\'s copied into Focus' : ''}</span>${quickestList(q, forStudent)}${forStudent ? '<button class="pill" id="shPlan">Show me on the sliders</button>' : ''}</div>`;
}

// The teacher's what-ifs: each missing assignment turned in, retakes, IXL columns, and the next assessment.
function nextSize(s) { const sizes = {}; s.grades.assignments.filter(a => isAssess(s, a) && a.max).forEach(a => sizes[a.max] = (sizes[a.max] || 0) + 1); return Number(Object.keys(sizes).sort((a, b) => sizes[b] - sizes[a] || b - a)[0] || 20); }
// A result reads "→ 69 D +5": the new grade, its letter, and the change from now ("no change" when it doesn't move).
const whatIfArrow = r => x => { if (!x || x.rounded == null) return ''; const d = x.rounded - r.rounded; return `<b class="arrow">→ ${x.rounded} <small>${x.letter}</small></b> <span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}">${d > 0 ? '+' + d : d < 0 ? '−' + Math.abs(d) : 'no change'}</span>`; };
function whatIfMarkup(s, i) {
  const gb = s.grades; const r = computeGrade(s, i); if (!r) return ''; if (r.rounded == null) return '<p class="ghint">Nothing is graded for this student yet this quarter.</p>';
  const arrow = whatIfArrow(r);
  const missing = gb.assignments.filter(a => a.status && a.status[i] === 'missing'); const allIn = {}; missing.forEach(a => allIn[a.name] = a.max);
  const assess = gb.assignments.filter(a => catIn(s, a) === 'Assessments' && a.max > 0 && a.status && (a.status[i] === 'score' || a.status[i] === 'missing'));
  const ixlCols = assess.filter(a => /\bixl\b/i.test(a.name) && (a.values[i] == null || a.values[i] < a.max));
  const tests = assess.filter(a => !/\bixl\b/i.test(a.name) && (a.values[i] == null || a.values[i] < a.max));
  const nx = nextSize(s);
  return `<div class="wnow">Now ${gradeChip(r)}</div>
    <p class="whatif-intro">Each line below changes <b>one thing</b> in the Focus gradebook and shows the grade that would result — nothing else moves.</p>
    <h4 class="subh">If missing work were turned in${missing.length ? ` <small>${missing.length}</small>` : ''}</h4>
    ${missing.length ? `<table class="checkTable whatif"><tbody>${missing.map(a => `<tr><td><b>${esc(a.name)}</b> <small>${esc(catIn(s, a))} · due ${esc(a.due || '?')}</small></td><td>turned in for full credit (${a.max}/${a.max})</td><td>${arrow(computeGrade(s, i, { [a.name]: a.max }))}</td></tr>`).join('')}${missing.length > 1 ? `<tr class="total"><td><b>All ${missing.length} turned in</b></td><td>full credit on each</td><td>${arrow(computeGrade(s, i, allIn))}</td></tr>` : ''}</tbody></table>` : '<p class="ghint">Nothing missing.</p>'}
    ${tests.length ? `<h4 class="subh">If an assessment were retaken</h4><p class="ghint">Each cell: the grade if that assessment were re-scored at that percent. A dash means the score is already at or above it.</p><table class="checkTable whatif"><thead><tr><th>Assessment</th><th>Now</th><th>70%</th><th>80%</th><th>90%</th><th>100%</th></tr></thead><tbody>${tests.map(a => `<tr><td><b>${esc(a.name)}</b></td><td>${a.status[i] === 'missing' ? '<b class="nhi">NHI</b>' : `${fmtN(a.values[i])}/${a.max} <small>(${Math.round(a.values[i] / a.max * 100)}%)</small>`}</td>${[70, 80, 90, 100].map(p => `<td>${a.status[i] !== 'missing' && a.values[i] >= a.max * p / 100 ? '<span class="ghint" title="already at or above this">—</span>' : `<small class="pts">${fmtN(Math.round(a.max * p / 100 * 2) / 2)}/${a.max}</small><br>${arrow(computeGrade(s, i, { [a.name]: a.max * p / 100 }))}`}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}
    ${ixlCols.length ? `<h4 class="subh">If IXL were finished</h4><table class="checkTable whatif"><tbody>${ixlCols.map(a => `<tr><td><b>${esc(a.name)}</b> <small>now ${a.status[i] === 'missing' ? 'NHI' : fmtN(a.values[i]) + '/' + a.max}</small></td><td>every skill at goal (${a.max}/${a.max})</td><td>${arrow(computeGrade(s, i, { [a.name]: a.max }))}</td></tr>`).join('')}</tbody></table>` : ''}
    <h4 class="subh">If the next assessment scored…</h4>
    <div class="nextrow"><label>out of <input type="number" class="wiMax" value="${nx}" min="1" max="500" style="width:70px"></label><label>score <input type="range" class="wiPts" min="0" max="${nx}" step="0.5" value="${Math.round(nx * 0.8)}"> <b class="wiV">${Math.round(nx * 0.8)}</b> / <span class="wiMaxV">${nx}</span></label><span class="wiOut">${arrow(withNext(s, i, 'Assessments', nx, Math.round(nx * 0.8)))}</span></div>
    <p class="ghint wiNeed">${needText(s, i, nx)}</p>`;
}
function needText(s, i, mx) {
  const r = computeGrade(s, i); const cur = r && r.rounded; const miss = s.grades.assignments.some(a => a.status && a.status[i] === 'missing');
  const parts = [[90, 'an A'], [80, 'a B'], [70, 'a C']].filter(([t]) => cur == null || cur < t).map(([t, w]) => { const n = neededOn(s, i, 'Assessments', mx, t); return n == null ? null : `<b>${fmtN(n)}/${mx}</b> for ${w}`; }).filter(Boolean);
  const keep = cur != null && cur >= 70 ? (() => { const floor = cur >= 90 ? 90 : cur >= 80 ? 80 : 70; const n = neededOn(s, i, 'Assessments', mx, floor); return n == null ? null : `${n === 0 ? 'even a 0' : `<b>${fmtN(n)}/${mx}</b>`} keeps ${floor === 90 ? 'the A' : floor === 80 ? 'the B' : 'the C'}`; })() : null;
  const all = [...parts, keep].filter(Boolean);
  return all.length ? 'Next assessment: ' + all.join(' · ') : `No single assessment out of ${mx} can reach a C from here — ${miss ? 'the missing work is the lever' : 'it will take more than one'}.`;
}
function wireWhatIf(root, s, i) {
  if (!root) return; const mxI = root.querySelector('.wiMax'), sl = root.querySelector('.wiPts'); if (!mxI || !sl) return;
  const arrow = whatIfArrow(computeGrade(s, i));
  const upd = () => { const mx = Math.max(1, Number(mxI.value) || 1); sl.max = mx; const p = Math.min(mx, Number(sl.value)); root.querySelector('.wiV').textContent = fmtN(p); const mv = root.querySelector('.wiMaxV'); if (mv) mv.textContent = mx; root.querySelector('.wiOut').innerHTML = arrow(withNext(s, i, 'Assessments', mx, p)); root.querySelector('.wiNeed').innerHTML = needText(s, i, mx); };
  mxI.oninput = upd; sl.oninput = upd;
}

/* ---------- Show student: the what-ifs, turned toward the student ----------
   Full screen, one student, their own numbers only. Each change is a switch or a slider; the grade at the top follows.
   The teacher leaves by holding the exit button (a tap or Escape does nothing), so the rest of Tally stays out of reach. */
// A grade with overrides and, optionally, one more assignment (the next assessment).
function gradeWith(s, i, over, next) {
  if (!next) return computeGrade(s, i, over);
  const gb = s.grades; const n = gb.students.length; const values = new Array(n).fill(null), status = new Array(n).fill('blank'); values[i] = next.pts; status[i] = 'score';
  const x = { name: '\u0000next', max: next.max, values, status };
  return computeGrade({ ...s, grades: { ...gb, assignments: gb.assignments.concat([x]) }, _map: { ...(s._map || {}), '\u0000next': 'Assessments' } }, i, over);
}
function openShow(sec, name) {
  const s = openSec(sec); const i = s.grades ? s.grades.students.findIndex(n => norm(n) === norm(name)) : -1; if (i < 0 || !s.grades.assignments.length) return;
  const gb = s.grades; const cats = gradingFor(sec.prep).cats; const base = computeGrade(s, i); if (!base || base.rounded == null) { toast('Nothing is graded for this student yet this quarter — there is nothing to show.', false); return; }
  const missing = gb.assignments.filter(a => a.status && a.status[i] === 'missing');
  const retake = gb.assignments.filter(a => isAssess(s, a) && a.status && a.status[i] === 'score' && a.values[i] < a.max);
  const ixlCols = gb.assignments.filter(a => catIn(s, a) === 'Assessments' && /\bixl\b/i.test(a.name) && a.max > 0 && a.status && (a.status[i] === 'score' || a.status[i] === 'missing') && (a.values[i] == null || a.values[i] < a.max));
  const nx = nextSize(s);
  const ownAvg = base.cats.Assessments && base.cats.Assessments.pct != null ? base.cats.Assessments.pct / 100 : 0.8; const nxStart = Math.round(nx * ownAvg * 2) / 2;
  const hist = (sec.gradeHistory || []).filter(h => snapQ(h) === snapBasis(sec).q).map(h => { const j = h.students.indexOf(name); return j >= 0 ? h.grade[j] : null; });
  const plan = quickestPath(sec, s, i, findStudent(sec, name).ixl);
  const H = state.settings.hideNames; const who = H ? mask(name) : firstName(name);
  // state of every control: missing → { on, pts }, retake/ixl → pts, next → { on, max, pts }
  const st = { miss: {}, re: {}, ix: {}, next: { on: false, max: nx, pts: nxStart } };
  missing.forEach(a => st.miss[a.name] = { on: false, pts: a.max }); retake.forEach(a => st.re[a.name] = a.values[i]); ixlCols.forEach(a => st.ix[a.name] = a.status[i] === 'missing' ? 0 : a.values[i]);
  const row = (kind, a, now, lo) => `<div class="shRow" data-k="${kind}" data-n="${esc(a.name)}"><div class="shL"><b>${esc(a.name)}</b><small>${kind === 'miss' ? `not handed in · worth ${a.max} points` : `now ${fmtN(now)} / ${a.max}`}</small></div>
      ${kind === 'miss' ? `<label class="shSw"><input type="checkbox" class="shOn"><span>Turn it in</span></label>` : ''}
      <div class="shS ${kind === 'miss' ? 'off' : ''}"><input type="range" class="shPts" min="${lo}" max="${a.max}" step="0.5" value="${kind === 'miss' ? a.max : now}" aria-label="${esc(a.name)} score"><output>${fmtN(kind === 'miss' ? a.max : now)} / ${a.max}</output></div></div>`;
  const el = document.createElement('div'); el.id = 'show'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'What-ifs for ' + who);
  el.innerHTML = `<div class="shTop"><div><div class="shWho">${esc(who)}</div><div class="shSub">${esc(sec.label)} · ${esc(Q_NAMES[currentQuarter() - 1])} · Focus of ${esc(fmtDate(gb.importedAt.slice(0, 10)))}</div></div>
      <div class="shTools"><button class="pill pale" id="shReset">Start over</button><button class="pill small exitPill" id="shExit" title="Teacher: press and hold to exit"><span class="ring"></span>Hold to exit</button></div></div>
    <div class="shBody">
      <div class="shGrade"><div class="shNow"><small>Your grade now</small><b>${base.rounded}<span>%</span></b><em class="lt ${base.letter}">${base.letter}</em></div>
        <div class="shArrow" aria-hidden="true">→</div>
        <div class="shIf"><small>If you do the things you picked</small><b id="shIfV">${base.rounded}<span>%</span></b><em class="lt ${base.letter}" id="shIfL">${base.letter}</em><div class="shDelta" id="shDelta">Pick something below</div></div></div>
      <div class="shCats" id="shCats"></div><p class="shHint shKey">Bars show each part of the grade after the changes you picked; the dark line is where it is now.</p>
      ${hist.filter(v => v != null).length >= 2 ? `<div class="shTrend"><small>Your grade at each check this quarter</small>${sparkline(hist, 640, 90)}</div>` : ''}
      <div class="shQuick">${quickestCard(plan, true)}</div>
      <div class="shTry">
        ${missing.length ? `<section><h3>Turn in missing work</h3>${missing.map(a => row('miss', a, 0, 0)).join('')}</section>` : ''}
        ${retake.length ? `<section><h3>Retake an assessment</h3><p class="shHint">Slide to the score you'd get on the retake.</p>${retake.map(a => row('re', a, a.values[i], a.values[i])).join('')}</section>` : ''}
        ${ixlCols.length ? `<section><h3>Finish IXL</h3>${ixlCols.map(a => row('ix', a, st.ix[a.name], st.ix[a.name])).join('')}</section>` : ''}
        <section><h3>Your next assessment</h3><div class="shRow" data-k="next"><div class="shL"><b>Next test or quiz</b><small>out of <input type="number" id="shNextMax" value="${nx}" min="1" max="200"> points · starts at your usual score</small></div><label class="shSw"><input type="checkbox" class="shOn" id="shNextOn"><span>Count it</span></label>
          <div class="shS off"><input type="range" class="shPts" id="shNextPts" min="0" max="${nx}" step="0.5" value="${st.next.pts}" aria-label="Next assessment score"><output>${st.next.pts} / ${nx}</output></div></div>
          <p class="shHint" id="shNeed"></p></section>
      </div>
    </div>`;
  document.body.appendChild(el); document.body.classList.add('showMode'); $('#toast').classList.remove('show');
  const catBars = (a, b) => cats.map(c => { const x = a.cats[c.name], y = b.cats[c.name]; const w = v => v == null ? 0 : Math.max(0, Math.min(100, v)); return `<div class="shCat"><span>${esc(c.name)} <small>counts ${c.w}%</small></span><div class="shBar"><i class="if" style="width:${w(y && y.pct)}%"></i><i class="now" style="left:calc(${w(x && x.pct)}% - 2px)" title="now ${x && x.pct != null ? Math.round(x.pct) + '%' : '—'}"></i></div><b>${y && y.pct != null ? Math.round(y.pct) + '%' : '—'}</b></div>`; }).join('');
  const recompute = () => {
    const over = {}; missing.forEach(a => { if (st.miss[a.name].on) over[a.name] = st.miss[a.name].pts; }); retake.forEach(a => { if (st.re[a.name] !== a.values[i]) over[a.name] = st.re[a.name]; }); ixlCols.forEach(a => { const now = a.status[i] === 'missing' ? 0 : a.values[i]; if (st.ix[a.name] !== now) over[a.name] = st.ix[a.name]; });
    const r = gradeWith(s, i, over, st.next.on ? { max: st.next.max, pts: st.next.pts } : null);
    $('#shIfV').innerHTML = `${r.rounded}<span>%</span>`; const L = $('#shIfL'); L.textContent = r.letter; L.className = 'lt ' + r.letter;
    const d = r.rounded - base.rounded; const picked = Object.keys(over).length + (st.next.on ? 1 : 0);
    $('#shDelta').innerHTML = !picked ? 'Pick something below' : d > 0 ? `<b>+${d}</b> points${r.letter !== base.letter ? ` — that's ${/^[AF]/.test(r.letter) ? 'an' : 'a'} <b>${r.letter}</b>` : ''}` : d < 0 ? `<b>${d}</b> points` : 'no change yet';
    $('#shDelta').className = 'shDelta ' + (d > 0 ? 'up' : d < 0 ? 'down' : '');
    $('#shCats').innerHTML = catBars(base, r);
    const mx = st.next.max; const n = [[90, 'an A'], [80, 'a B'], [70, 'a C']].filter(([t]) => base.rounded < t).map(([t, w]) => { const v = neededOn(s, i, 'Assessments', mx, t); return v == null ? null : `<b>${fmtN(v)} of ${mx}</b> gets you ${w}`; }).filter(Boolean);
    $('#shNeed').innerHTML = n.length ? 'On its own: ' + n.join(' · ') + '.' : base.rounded >= 90 ? 'You have an A — keep it up.' : `One test alone can't get you to a C from here${missing.length ? ' — turning in the missing work is the biggest help' : ''}.`;
  };
  el.querySelectorAll('.shRow').forEach(rw => { const k = rw.dataset.k, nm = rw.dataset.n; const rg = rw.querySelector('.shPts'), on = rw.querySelector('.shOn'), out = rw.querySelector('output'), box = rw.querySelector('.shS');
    const mxOf = () => k === 'next' ? st.next.max : Number(rg.max);
    rg.oninput = () => { const v = Number(rg.value); out.textContent = `${fmtN(v)} / ${mxOf()}`; if (k === 'miss') st.miss[nm].pts = v; else if (k === 're') st.re[nm] = v; else if (k === 'ix') st.ix[nm] = v; else st.next.pts = v; recompute(); };
    if (on) on.onchange = () => { box.classList.toggle('off', !on.checked); if (k === 'miss') st.miss[nm].on = on.checked; else st.next.on = on.checked; recompute(); }; });
  const nm = $('#shNextMax'); nm.oninput = () => { const v = Math.max(1, Math.min(200, Number(nm.value) || 1)); st.next.max = v; const rg = $('#shNextPts'); rg.max = v; if (st.next.pts > v) { st.next.pts = v; rg.value = v; } rg.nextElementSibling.textContent = `${fmtN(st.next.pts)} / ${v}`; recompute(); };
  $('#shReset').onclick = () => { document.body.removeChild(el); document.body.classList.remove('showMode'); openShow(sec, name); };
  let hold; const start = e => { e.preventDefault(); $('#shExit').classList.add('holding'); hold = setTimeout(closeShow, 1500); };
  const stop = () => { clearTimeout(hold); const b = $('#shExit'); if (b) b.classList.remove('holding'); };
  const b = $('#shExit'); b.onpointerdown = start; b.onpointerup = stop; b.onpointerleave = stop; b.onpointercancel = stop;
  b.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) start(e); }; b.onkeyup = stop;
  const sp = $('#shPlan'); if (sp && plan && plan.reached) sp.onclick = () => {   // set every switch and slider to the plan
    el.querySelectorAll('.shRow').forEach(rw => { const k = rw.dataset.k, nm = rw.dataset.n; const rg = rw.querySelector('.shPts'), on = rw.querySelector('.shOn'), out = rw.querySelector('output'), box = rw.querySelector('.shS');
      if (k === 'miss') { const yes = plan.nhi.some(a => a.name === nm); on.checked = yes; box.classList.toggle('off', !yes); st.miss[nm] = { on: yes, pts: Number(rg.max) }; rg.value = rg.max; out.textContent = `${fmtN(Number(rg.max))} / ${rg.max}`; }
      else if (k === 'ix' && plan.over[nm] != null) { st.ix[nm] = plan.over[nm]; rg.value = plan.over[nm]; out.textContent = `${fmtN(plan.over[nm])} / ${rg.max}`; }
      else if (k === 're' && plan.over[nm] != null) { st.re[nm] = plan.over[nm]; rg.value = plan.over[nm]; out.textContent = `${fmtN(plan.over[nm])} / ${rg.max}`; } });
    recompute(); const t = el.querySelector('.shGrade'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  recompute(); el.tabIndex = -1; el.focus({ preventScroll: true });
}
function closeShow() { const el = $('#show'); if (el) el.remove(); document.body.classList.remove('showMode'); render(); }
// Escape, Tab out of the screen, or a stray key must not reach the teacher's Tally underneath.
document.addEventListener('keydown', e => { const el = $('#show'); if (!el) return; if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (e.key === 'Tab') { const items = [...el.querySelectorAll('button,input')].filter(x => !x.disabled && x.offsetParent !== null); if (!items.length) return; const k = items.indexOf(document.activeElement); if (e.shiftKey && k <= 0) { e.preventDefault(); items[items.length - 1].focus(); } else if (!e.shiftKey && (k === -1 || k === items.length - 1)) { e.preventDefault(); items[0].focus(); } } }, true);

const STU_CSS = `
.qcard{display:flex;flex-direction:column;gap:6px}.qcard .qhead{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline}.qcard>b,.qcard .qhead>b{font-size:var(--t-l);color:var(--navy)}.qcard>span{color:var(--ink-soft);font-size:var(--t-s)}.qres{font-size:var(--t-m,15px)}.qres b{color:var(--teal)}
.qpath{margin:4px 0 2px;padding-left:22px;display:flex;flex-direction:column;gap:6px}.qpath li small{color:var(--ink-soft)}.qsk{font-size:var(--t-s);margin-top:2px}.qsk small{color:var(--bad);font-weight:700}
#pQuick{border-left:5px solid var(--teal)}.qcol{font-size:var(--t-s);white-space:nowrap}.qcol b{color:var(--teal)}
.shQuick .qcard{background:var(--white);border-radius:var(--r);box-shadow:var(--shadow-1);padding:16px 22px;border-left:6px solid var(--teal)}.shQuick .qcard>b,.shQuick .qhead>b{font-size:clamp(20px,2.4vw,28px)}.shQuick .qpath{font-size:var(--t-m,17px)}.shQuick #shPlan{align-self:flex-start;margin-top:6px}
.qdot{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--cc);margin-right:6px;vertical-align:baseline}
.sdir tr[data-open]{cursor:pointer}.sdir tr[data-open]:hover td{background:var(--paleturq)}.sdir tr.sgroup th{text-align:left;padding:14px 8px 6px;font-size:var(--t-s);color:var(--navy);border-bottom:3px solid var(--cc)}
.qfin{display:inline-flex;gap:2px;align-items:baseline;font-weight:900;font-size:var(--t-s);padding:1px 8px;border-radius:999px;background:var(--grid);margin-right:4px}.qfin small{font-size:10px}
.profile .gcards{margin-bottom:14px}.gcard b em.lt,.shGrade em.lt{font-style:normal;font-size:.55em;margin-left:6px;padding:2px 8px;border-radius:999px;background:var(--paleturq);vertical-align:middle}
em.lt.D,em.lt.F{background:var(--sand)}em.lt.F{background:var(--coral)}.gcard.big b{font-size:34px}
.pcols{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:16px;align-items:start}.pmain,.pside{display:flex;flex-direction:column;gap:16px;min-width:0}
@media (max-width:1100px){.pcols{grid-template-columns:1fr}}
.subh{margin:14px 0 4px;font-size:var(--t-xs);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft)}.subh small{color:var(--teal)}
.gsec h3 small{font-weight:500;letter-spacing:0;text-transform:none;color:var(--ink-soft);margin-left:6px}
.catline{display:flex;flex-direction:column;gap:4px;margin:4px 0 10px}.catline .catbar{display:grid;grid-template-columns:150px 1fr 54px 110px;gap:10px;align-items:center;font-size:var(--t-s)}.catline .catbar small{color:var(--ink-soft)}
.catline .bar,.iu .bar{height:10px;border-radius:6px;background:var(--grid);overflow:hidden}.catline .bar i,.iu .bar i{display:block;height:100%;background:var(--teal);border-radius:6px}
.sasg tr.miss td{background:#fdeeea}.nhi{color:var(--bad)}.qold td{color:var(--ink-soft)}
details.qbook>summary{cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}details.qbook>summary::-webkit-details-marker{display:none}details.qbook>summary h3{margin:0}details.qbook>summary h3::before{content:'▸ ';color:var(--teal)}details.qbook[open]>summary h3::before{content:'▾ '}details.qbook>summary small{color:var(--ink-soft)}
.iu{padding:8px 0;border-bottom:1px solid var(--grid)}.iu:last-child{border-bottom:none}.iuh{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;margin-bottom:4px}.iuh span{color:var(--ink-soft);font-size:var(--t-s)}.iup{margin-left:auto;font-weight:900;color:var(--navy)!important;font-size:var(--t-m,15px)!important}
.iul{font-size:var(--t-s);margin-top:3px}.iul span{font-weight:700}.iul small{color:var(--bad);font-weight:700}.iul.done{font-style:italic;color:var(--teal)}.iu.closed{opacity:.75}
.gtag.muted{background:var(--grid);color:var(--ink-soft)}.qunitsold summary{cursor:pointer;font-size:var(--t-s);color:var(--ink-soft);padding:8px 0}
.wnow{font-size:var(--t-s);display:flex;gap:8px;align-items:center;color:var(--ink-soft)}
.gempty{max-width:620px;margin:40px auto;background:var(--white);border:1px solid var(--grid);border-radius:var(--r);box-shadow:var(--shadow-1);padding:24px}.gempty h3{margin:0 0 8px}
.qseg{margin:0 6px}.quarters .qdates{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:4px}.quarters .qdates label{display:flex;flex-direction:column;gap:3px;padding:8px;border:2px solid var(--grid);border-radius:10px;font-size:var(--t-s)}
.quarters .qdates label.now{border-color:var(--teal)}.quarters .qdates label.closed{background:var(--grid)}.quarters .qdates small{color:var(--ink-soft)}.quarters h3{margin:14px 0 6px}
.qunits{display:flex;flex-wrap:wrap;gap:6px 14px;padding:6px 0}.qunits label{display:flex;gap:6px;align-items:center;font-size:var(--t-s)}.qunits label.dim{color:var(--ink-soft)}.qunits small{color:var(--teal)}
.linkbtn{background:none;border:none;padding:0;color:var(--teal);font:inherit;font-weight:700;text-decoration:underline;cursor:pointer}
.usub .qtag{display:inline-block;margin-left:4px;padding:0 6px;border-radius:999px;background:var(--grid);color:var(--ink-soft);font-weight:900}
th.unit.qclosed .uh{opacity:.7}
body.showMode #top,body.showMode #app,body.showMode #empty,body.showMode #toast{display:none!important}
#show{position:fixed;inset:0;z-index:60;background:var(--cream,#F6F5F0);overflow:auto;padding:24px clamp(16px,4vw,56px) 60px;color:var(--navy)}
#show .shTop{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;position:sticky;top:-24px;z-index:3;background:var(--cream,#F6F5F0);padding:12px 0 10px}.shWho{font-size:clamp(30px,4vw,46px);font-weight:900;line-height:1.05}.shSub{color:var(--ink-soft);font-size:var(--t-s);margin-top:4px}
.shTools{display:flex;gap:8px;align-items:center}#shExit{position:relative;overflow:hidden}#shExit .ring{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--sand);opacity:.6}#shExit.holding .ring{width:100%;transition:width 1.5s linear}
.shBody{max-width:1100px;margin:18px auto 0;display:flex;flex-direction:column;gap:18px}
.shGrade{display:flex;align-items:center;gap:clamp(12px,3vw,40px);flex-wrap:wrap;background:var(--white);border-radius:var(--r);box-shadow:var(--shadow-1);padding:20px 28px}
.shGrade small{display:block;font-size:var(--t-xs);letter-spacing:.1em;text-transform:uppercase;color:var(--teal);font-weight:900}.shGrade b{font-size:clamp(56px,8vw,96px);font-weight:900;line-height:1}.shGrade b span{font-size:.4em}.shGrade em.lt{font-size:clamp(22px,3vw,34px)}
.shArrow{font-size:clamp(34px,5vw,60px);color:var(--teal);font-weight:900}.shIf>b{color:var(--teal)}.shDelta{font-size:var(--t-l);margin-top:6px;color:var(--ink-soft)}.shGrade .shDelta b{font-size:inherit;line-height:inherit}.shDelta.up{color:var(--teal)}.shDelta.down{color:var(--bad)}
.shCats{display:flex;flex-direction:column;gap:8px;background:var(--white);border-radius:var(--r);box-shadow:var(--shadow-1);padding:14px 22px}.shCat{display:grid;grid-template-columns:200px 1fr 60px;gap:12px;align-items:center;font-size:var(--t-m,16px)}.shCat small{color:var(--ink-soft)}
.shBar{position:relative;height:16px;border-radius:9px;background:var(--grid);overflow:hidden}.shBar i{position:absolute;top:0;bottom:0}.shBar i.if{left:0;background:var(--teal);border-radius:9px}.shBar i.now{width:4px;background:var(--navy);border-radius:2px;z-index:1}
.shTrend{background:var(--white);border-radius:var(--r);box-shadow:var(--shadow-1);padding:12px 22px}.shTrend small{display:block;color:var(--ink-soft);font-size:var(--t-xs);text-transform:uppercase;letter-spacing:.08em;font-weight:900}
.shTry{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:16px}.shTry section{background:var(--white);border-radius:var(--r);box-shadow:var(--shadow-1);padding:14px 20px}.shTry h3{margin:0 0 8px;font-size:var(--t-xs);letter-spacing:.1em;text-transform:uppercase;color:var(--teal)}
.shRow{display:grid;grid-template-columns:1fr auto;gap:6px 14px;align-items:center;padding:10px 0;border-bottom:1px solid var(--grid)}.shRow:last-child{border-bottom:none}.shL b{display:block;font-size:var(--t-m,16px)}.shL small{color:var(--ink-soft)}.shL input{width:64px;font:inherit}
.shS{grid-column:1/-1;display:flex;gap:12px;align-items:center}.shS.off{display:none}.shS input{flex:1;min-height:36px;accent-color:var(--teal)}.shS output{font-weight:900;min-width:78px;text-align:right}
.shSw{display:flex;gap:8px;align-items:center;font-weight:700;cursor:pointer;min-height:44px}.shSw input{width:24px;height:24px;accent-color:var(--teal)}.shHint{color:var(--ink-soft);font-size:var(--t-s);margin:4px 0}
@media (max-width:700px){.shTry{grid-template-columns:1fr}.shCat{grid-template-columns:120px 1fr 50px}.catline .catbar{grid-template-columns:110px 1fr 48px}.catline .catbar small:last-child{display:none}}
@media print{#show{display:none}}
`;
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: STU_CSS }));
