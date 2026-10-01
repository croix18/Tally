/* ---------- Grades: the Focus course grade, category fitting, what-ifs, history, and the Grades screens ----------
   See GRADES_SPEC.md. Everything here reads sec.grades (the current Focus gradebook) and state.grading[prep]
   (category weights + assignment→category map). Pure functions first, screens after. */

const DEFAULT_CATS = [{ name: 'Assessments', w: 70 }, { name: 'Classwork', w: 25 }, { name: 'Participation', w: 5 }];
const LETTERS = [[90, 'A'], [80, 'B'], [70, 'C'], [60, 'D'], [0, 'F']];
const letterOf = pct => pct == null ? '' : (LETTERS.find(([lo]) => pct >= lo) || LETTERS[LETTERS.length - 1])[1];

function gradingFor(prep) {
  state.grading = state.grading || {};
  let g = state.grading[prep];
  if (!g || !Array.isArray(g.cats) || !g.cats.length) g = state.grading[prep] = { cats: DEFAULT_CATS.map(c => ({ ...c })), map: {}, how: {} };
  g.map = g.map && typeof g.map === 'object' && !Array.isArray(g.map) ? g.map : {}; g.how = g.how && typeof g.how === 'object' && !Array.isArray(g.how) ? g.how : {};
  g.cats = g.cats.filter(c => c && typeof c.name === 'string' && Number.isFinite(+c.w)).map(c => ({ name: c.name, w: +c.w })); if (!g.cats.length) g.cats = DEFAULT_CATS.map(c => ({ ...c }));
  return g;
}
// Name-based guess. Croix's categories: whiteboard/participation → Participation; tests, quizzes, IXL, notebook checks,
// vocabulary → Assessments (the Focus fit proved IXL and notebook checks sit there); everything else → Classwork.
function catGuess(name, cats) {
  const has = n => cats.find(c => c.name.toLowerCase() === n.toLowerCase());
  const n = String(name || '');
  if (/\b(whiteboard|participation|bell ?work|bellringer|warm[- ]?up|exit ticket)\b/i.test(n) && has('Participation')) return 'Participation';
  if (/\b(test|exam|assessment|benchmark|quiz|ixl|notebook|vocab(ulary)?|project|fsa|fast)\b/i.test(n) && has('Assessments')) return 'Assessments';
  return (has('Classwork') || cats[0]).name;
}
// A category the export itself states (a category row above the header) is taken as given when it names one of ours.
function catFromFile(a, cats) { const c = a && a.categoryFromFile && a.category ? cats.find(x => x.name.toLowerCase() === String(a.category).trim().toLowerCase()) : null; return c ? c.name : null; }
function catOf(prep, name, a) { const g = gradingFor(prep); return g.map[name] || catFromFile(a, g.cats) || catGuess(name, g.cats); }
// The category an assignment had in the class as seen: a closed quarter keeps the map it was closed with.
const catIn = (s, a) => (s._map && s._map[a.name]) || catOf(s.prep, a.name, a);

// The course grade for student i. `over` optionally replaces cells: { [assignmentName]: points } (null = leave out).
// NHI counts as 0 over the full possible; excused/blank cells are left out; empty categories re-weight the rest.
function computeGrade(sec, i, over, mapOverride) {
  const gb = sec.grades; if (!gb) return null;
  const g = gradingFor(sec.prep); const cats = {}; (sec._cats || g.cats).forEach(c => cats[c.name] = { earned: 0, possible: 0, w: c.w, n: 0 });   // a kept quarter keeps its own weights
  gb.assignments.forEach(a => {
    if (a.max == null || !(a.max > 0)) return;
    const cat = (mapOverride && mapOverride[a.name]) || (sec._map && sec._map[a.name]) || catOf(sec.prep, a.name, a); const c = cats[cat] || (cats[cat] = { earned: 0, possible: 0, w: 0, n: 0 });
    let v = a.values[i], stt = a.status ? a.status[i] : (v == null ? 'blank' : 'score');
    if (over && Object.prototype.hasOwnProperty.call(over, a.name)) { v = over[a.name]; stt = v == null ? 'excused' : 'score'; }
    if (stt === 'excused' || stt === 'blank' || stt === 'unread') return;
    c.earned += stt === 'missing' ? 0 : Number(v) || 0; c.possible += a.max; c.n++;
  });
  let tw = 0, tot = 0; for (const k in cats) { const c = cats[k]; if (c.possible > 0) { c.pct = c.earned / c.possible * 100; tw += c.w; tot += c.w * c.pct; } else c.pct = null; }
  const pct = tw ? tot / tw : null;
  return { pct, rounded: pct == null ? null : Math.round(pct), letter: letterOf(pct == null ? null : Math.round(pct)), cats };
}
const gradeAll = (sec, mapOverride) => sec.grades ? sec.grades.students.map((_, i) => computeGrade(sec, i, null, mapOverride)) : [];

// Fit assignment categories to the Focus "Grade" column. Coordinate descent from the current map/guesses; then, at
// zero error, each assignment is "determined" only if every alternative category breaks the fit.
function fitCategories(sec, opts) {
  const lock = !(opts && opts.ignoreUser);
  const gb = sec.grades; const g = gradingFor(sec.prep); const names = g.cats.map(c => c.name);
  if (!gb || !gb.overall || names.length < 2) return null;
  const idx = gb.students.map((_, i) => i).filter(i => gb.overall[i] != null);
  if (idx.length < 3) return null;
  const err = map => idx.reduce((e, i) => { const r = computeGrade(sec, i, null, map); return e + (r && r.rounded != null ? Math.abs(r.rounded - gb.overall[i]) : 0); }, 0);
  // Coordinate descent can stall in a local minimum (two categories wrong at once), so it runs from two starting
  // points — the stored map and pure name guesses — and keeps the better result. User-set assignments stay put when locked.
  const descend = start => {
    const map = { ...start }; let best = err(map), changed = true, rounds = 0;
    while (changed && rounds++ < 12) {
      changed = false;
      for (const a of gb.assignments) {
        if (lock && g.how[a.name] === 'user') continue;
        const cur = map[a.name]; let bestC = cur, bestE = best;
        for (const c of names) { if (c === cur) continue; map[a.name] = c; const e = err(map); if (e < bestE) { bestE = e; bestC = c; } }
        map[a.name] = bestC; if (bestC !== cur) { best = bestE; changed = true; }
      }
    }
    return { map, best };
  };
  const stored = {}, guessed = {};
  gb.assignments.forEach(a => { stored[a.name] = catOf(sec.prep, a.name, a); guessed[a.name] = lock && g.how[a.name] === 'user' && g.map[a.name] ? g.map[a.name] : (catFromFile(a, g.cats) || catGuess(a.name, g.cats)); });
  const r1 = descend(stored), r2 = descend(guessed); const { map, best } = r2.best < r1.best ? r2 : r1;
  const determined = {};
  if (best === 0) gb.assignments.forEach(a => { const cur = map[a.name]; determined[a.name] = names.every(c => { if (c === cur) return true; map[a.name] = c; const bad = err(map) > 0; map[a.name] = cur; return bad; }); });
  // a category you set by hand "disagrees" with Focus when letting everything float reproduces the Grade column better and lands it elsewhere
  const disagree = {};
  if (lock && gb.assignments.some(a => g.how[a.name] === 'user')) { const free = fitCategories(sec, { ignoreUser: true }); gb.assignments.forEach(a => { if (g.how[a.name] === 'user') disagree[a.name] = !!free && free.err < best && free.map[a.name] !== map[a.name]; }); }
  return { map, err: best, exact: best === 0, determined, disagree, n: idx.length };
}
// Apply a fit after import: proved assignments are stored as `fit`; new ones the fit can't prove are returned so the
// import can ask. Returns { ask: [names], proved: n, guessed: n }.
function applyCategories(sec) {
  const gb = sec.grades; if (!gb) return { ask: [], proved: 0, guessed: 0 };
  const g = gradingFor(sec.prep); const fit = fitCategories(sec); const ask = []; let proved = 0, guessed = 0;
  gb.assignments.forEach(a => {
    if (g.how[a.name] === 'user') return;
    if (fit && fit.exact && fit.determined[a.name]) { g.map[a.name] = fit.map[a.name]; g.how[a.name] = 'fit'; proved++; return; }
    const fromFile = catFromFile(a, g.cats);
    if (fromFile && g.how[a.name] !== 'fit') { g.map[a.name] = fromFile; g.how[a.name] = 'file'; return; }
    if (!g.map[a.name]) { g.map[a.name] = catGuess(a.name, g.cats); g.how[a.name] = 'guess'; guessed++; ask.push(a.name); }
    else if (g.how[a.name] === 'guess') guessed++;
  });
  return { ask, proved, guessed, fit };
}

/* ---------- what-ifs ---------- */
// Minimum points out of `max` on a NEW assignment in `cat` to reach `target` percent (rounded), or null if impossible.
function neededOn(sec, i, cat, max, target) {
  const g = gradingFor(sec.prep); const base = computeGrade(sec, i); if (!base) return null;
  const c = base.cats[cat] || { earned: 0, possible: 0, w: (g.cats.find(x => x.name === cat) || {}).w || 0 };
  const grade = pts => { let tw = 0, tot = 0; for (const k in base.cats) { const x = base.cats[k]; const e = k === cat ? x.earned + pts : x.earned, p = k === cat ? x.possible + max : x.possible; if (p > 0) { tw += x.w; tot += x.w * e / p * 100; } } if (!(cat in base.cats) && c.w) { tw += c.w; tot += c.w * pts / max * 100; } return tw ? tot / tw : null; };
  if (Math.round(grade(max)) < target) return null;
  // Scores are entered in half points, so walk the half-point grid (0 first — a student already above the line needs nothing).
  for (let pts = 0; pts <= max; pts += 0.5) if (Math.round(grade(pts)) >= target) return pts;
  return max;
}
// Grade after a new assignment in `cat` worth `max` scored `pts`.
function withNext(sec, i, cat, max, pts) {
  const base = computeGrade(sec, i); if (!base) return null; const g = gradingFor(sec.prep);
  let tw = 0, tot = 0, seen = false;
  for (const k in base.cats) { const x = base.cats[k]; const e = k === cat ? x.earned + pts : x.earned, p = k === cat ? x.possible + max : x.possible; if (k === cat) seen = true; if (p > 0) { tw += x.w; tot += x.w * e / p * 100; } }
  if (!seen) { const w = (g.cats.find(x => x.name === cat) || {}).w || 0; tw += w; tot += w * pts / max * 100; }
  const pct = tw ? tot / tw : null; return { pct, rounded: pct == null ? null : Math.round(pct), letter: letterOf(pct == null ? null : Math.round(pct)) };
}

/* ---------- history ---------- */
// What a gradebook snapshot measures: with nothing closed, the whole gradebook; otherwise its open part, or — in the gap
// before the next quarter's first export — the latest quarter it holds. Each snapshot records its quarter (q).
function snapBasis(sec) {
  const gb = sec.grades; if (!anyClosed()) return { s: sec, q: gbQuarter(gb) };
  const o = openSec(sec); if (o.grades.assignments.length) return { s: o, q: currentQuarter() };
  const qn = gbQuarter(gb); const sub = gb.assignments.filter(a => aQuarter(a, gb) === qn);
  return { s: sub.length === gb.assignments.length ? sec : { ...sec, grades: { ...gb, assignments: sub, overall: null } }, q: qn };
}
const snapQ = h => h.q || quarterOf(h.date);
function gradeSnapshot(sec) {
  if (!sec.grades) return;
  const { s, q } = snapBasis(sec); const gb = s.grades;
  const date = (gb.importedAt || new Date().toISOString()).slice(0, 10);
  const grades = gradeAll(s); const cn = gradingFor(sec.prep).cats.map(c => c.name);
  const snap = { date, at: gb.importedAt, file: gb.file, q, students: gb.students.slice(), grade: grades.map(r => r && r.rounded), missing: gb.students.map((_, i) => gb.assignments.filter(a => (a.status ? a.status[i] : null) === 'missing').length),
    cats: Object.fromEntries(cn.map(c => [c, grades.map(r => r && r.cats[c] && r.cats[c].pct != null ? Math.round(r.cats[c].pct * 10) / 10 : null)])),
    assignments: gb.assignments.map(a => { const v = a.values.filter(x => x != null); return { name: a.name, max: a.max, due: a.due, avg: v.length && a.max ? v.reduce((x, y) => x + y, 0) / v.length / a.max * 100 : null, missing: a.missing }; }) };
  // one snapshot per import day AND quarter: the last Q1 export and the first Q2 export can land on the same day
  sec.gradeHistory = (sec.gradeHistory || []).filter(h => !(h.date === date && snapQ(h) === q)); sec.gradeHistory.push(snap); sec.gradeHistory.sort((a, b) => a.date.localeCompare(b.date) || snapQ(a) - snapQ(b));
  if (sec.gradeHistory.length > 60) sec.gradeHistory = sec.gradeHistory.slice(-60);
}
// The previous import of the SAME quarter: a fresh quarter's first gradebook has nothing to slide from.
const prevGradeSnap = sec => { if (sec._closed) return null; const h = sec.gradeHistory || []; const cur = sec.grades ? (sec.grades.importedAt || '').slice(0, 10) : null; const q = sec.grades ? snapBasis(sec).q : null; return h.filter(x => x.date < cur && snapQ(x) === q).pop() || null; };

/* ---------- analysis ---------- */
function pearson(xs, ys) { const n = xs.length; if (n < 3) return null; const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null; }
// Per gradebook student: IXL assigned work at goal (%) via the roster matcher, and their average on non-IXL assessments.
function ixlVsTests(sec) {
  const gb = sec.grades; if (!gb) return [];
  const rows = gbRows(sec); const units = unitsOf(sec).filter(u => u.assigned); const t = sec.threshold; const g = gradingFor(sec.prep);
  const tests = gb.assignments.filter(a => catIn(sec, a) === 'Assessments' && !/\bixl\b/i.test(a.name) && a.max > 0);
  return gb.students.map((name, i) => {
    const r = rows[i]; let ixl = null;
    if (r && r.ixl != null) { let done = 0, poss = 0; units.forEach(u => { const own = activeFor(sec, u, r.ixl); poss += own.length; own.forEach(k => { const v = eff(sec, k, r.ixl); if (v != null && v >= t) done++; }); }); ixl = poss ? done / poss * 100 : null; }
    let e = 0, p = 0; tests.forEach(a => { const s = a.status ? a.status[i] : null; if (s === 'score' || s === 'missing') { e += s === 'missing' ? 0 : (a.values[i] || 0); p += a.max; } });
    return { name, i, ixl, tests: p ? e / p * 100 : null };
  });
}
function classAverage(sec, mapOverride, dropName) {
  const gb = sec.grades; if (!gb) return null;
  let over = null; if (dropName) { over = {}; over[dropName] = null; }
  // Mean of the ROUNDED grades — the number Focus shows in its Average row, and the one every screen and the digest use.
  const gs = gb.students.map((_, i) => computeGrade(sec, i, over, mapOverride)).map(r => r && r.rounded).filter(v => v != null);
  return gs.length ? gs.reduce((a, b) => a + b, 0) / gs.length : null;
}

/* ---------- screens ---------- */
const pct1 = v => v == null ? '—' : Math.round(v) + '%';
const signedPts = d => d == null ? '' : (d > 0 ? '+' : d < 0 ? '−' : '±') + Math.abs(d);
const gradeChip = r => r && r.rounded != null ? `<span class="gchip ${r.letter}">${r.rounded}<small>${r.letter}</small></span>` : '<span class="gchip">—</span>';
const dueKey = d => { const m = String(d || '').match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/); return m ? `${(m[3] || '').padStart(4, '0')}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : ''; };

function sparkline(vals, w, h) {
  const v = vals.filter(x => x != null); if (v.length < 2) return '';
  const lo = Math.min(...v, 50), hi = Math.max(...v, 100); const X = i => 4 + i * (w - 8) / (vals.length - 1), Y = x => h - 4 - (x - lo) / (hi - lo || 1) * (h - 8);
  let d = '', last = null; vals.forEach((x, i) => { if (x == null) return; d += (d ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x).toFixed(1) + ' '; last = [X(i), Y(x)]; });
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d}"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3"/></svg>`;
}
function scatterSVG(pts, w, h) {
  const X = x => 40 + x / 100 * (w - 56), Y = y => h - 36 - y / 100 * (h - 48);
  let s = `<svg class="scatter" viewBox="0 0 ${w} ${h}" role="img" aria-label="IXL work at goal against assessment average, one dot per student">`;
  [0, 50, 100].forEach(v => { s += `<line x1="${X(v)}" y1="${Y(0)}" x2="${X(v)}" y2="${Y(100)}" class="gl"/><text x="${X(v)}" y="${h - 20}" text-anchor="middle" class="tl">${v}%</text>`; s += `<line x1="${X(0)}" y1="${Y(v)}" x2="${X(100)}" y2="${Y(v)}" class="gl"/><text x="${X(0) - 6}" y="${Y(v) + 4}" text-anchor="end" class="tl">${v}</text>`; });
  s += `<text x="${(X(0) + X(100)) / 2}" y="${h - 4}" text-anchor="middle" class="al">IXL assigned work at goal</text><text transform="translate(10 ${(Y(0) + Y(100)) / 2}) rotate(-90)" text-anchor="middle" class="al">assessments (no IXL)</text>`;
  pts.forEach(p => { s += `<circle cx="${X(p.ixl).toFixed(1)}" cy="${Y(p.tests).toFixed(1)}" r="6" class="pt"><title>${esc(p.label)}: IXL ${Math.round(p.ixl)}% · assessments ${Math.round(p.tests)}%</title></circle>`; });
  return s + '</svg>';
}

// Which quarter the Grades screen shows: view.q when the class has it, else the newest it has.
// The class as the Grades screen shows quarter n: its kept copy, or the open gradebook.
const gradesView = (s0, n) => { const k = qSec(s0, n); return k && k._arch ? k : openSec(s0); };
function gradesQuarter(s0) { const qs = classQuarters(s0); return view.q && (qs.includes(view.q) || view.q === currentQuarter()) ? view.q : (qs.length ? qs[qs.length - 1] : currentQuarter()); }
// The class bar's "Grades" button hands over to this; renderGrid defers to it when view.mode === 'grades'.
function renderGradesBar(s0) {
  const n = gradesQuarter(s0); const s = gradesView(s0, n); const gb = s.grades; const prev = prevGradeSnap(s);
  const qs = classQuarters(s0); const cur = currentQuarter(); if (!qs.includes(cur)) qs.push(cur);
  const seg = qs.length > 1 || anyClosed() ? `<div class="seg small qseg" role="group" aria-label="Quarter">${qs.map(q => `<button data-gq="${q}" class="${q === n ? 'on' : ''}" aria-pressed="${q === n}">Q${q}${qClosed(q) ? ' · final' : ''}</button>`).join('')}</div>` : '';
  return `<div class="crumb"><button id="back">‹ ${esc(s0.label)}</button><h2>Grades</h2></div>${seg}<span class="meta">${s._closed ? `${esc(Q_NAMES[n - 1])} · closed ${esc(fmtDate((quarters().closed[n].at || '').slice(0, 10)))} · ` : s._arch ? `${esc(Q_NAMES[n - 1])} · kept, not closed yet · ` : ''}${gb && gb.assignments.length ? `Focus gradebook of ${esc(fmtDate(gb.importedAt.slice(0, 10)))} · ${plural(gb.assignments.length, 'assignment')} · ${plural(gb.students.length, 'student')}${prev ? ` · previous import ${esc(fmtDate(prev.date))}` : ''}` : `no ${esc(Q_NAMES[n - 1])} gradebook yet`}</span>
      <div class="spacer"></div>
      <button class="pill toggle" id="gradesWeights" title="Category weights">${gradingFor(s0.prep).cats.map(c => `${esc(c.name.slice(0, 1))} ${c.w}`).join(' · ')}</button>
      ${s._arch ? '' : '<button class="pill toggle" id="gradesCats" title="Check or move assignment categories">Categories</button>'}
      <button class="pill toggle" id="gradesQuarters" title="Quarter dates; close a quarter">Quarters</button>
      <div class="legend"><span>Tap a student for their page: every grade, trends, what-ifs</span></div>`;
}
function renderGrades(s0) {
  const n = gradesQuarter(s0); const s = gradesView(s0, n); const closedQ = !!(s && s._arch);   // a kept copy is read-only
  if (!s || !s.grades || !s.grades.assignments.length) {
    const qs = classQuarters(s0).filter(qClosed);
    $('#gridwrap').innerHTML = `<div class="grades"><div class="gempty"><h3>${esc(Q_NAMES[n - 1])} hasn't started in Tally yet</h3><p>${qs.length ? `${qs.map(q => Q_NAMES[q - 1]).join(' and ')} ${qs.length === 1 ? 'is' : 'are'} closed and kept. ` : ''}Import this class's first ${esc(Q_NAMES[n - 1])} gradebook from Focus and its grades, trends and what-ifs start here.</p>
      <div class="rp-actions">${qs.map(q => `<button class="pill pale" data-gq="${q}">Open ${esc(Q_NAMES[q - 1])} (final)</button>`).join('')}<button class="pill" id="gImport">Import</button></div></div></div>`;
    $('#gridwrap').querySelectorAll('[data-gq]').forEach(b => b.onclick = () => { view.q = Number(b.dataset.gq); render(); });
    const gi = $('#gImport'); if (gi) gi.onclick = () => $('#file').click();
    return;
  }
  const gb = s.grades; const g = gradingFor(s.prep); const H = state.settings.hideNames; const nm = d => esc(H ? mask(d) : d);
  const grades = gradeAll(s); const prev = prevGradeSnap(s); const fit = s === s0 ? fitCategories(s) : null;
  const letters = { A: 0, B: 0, C: 0, D: 0, F: 0 }; grades.forEach(r => { if (r && r.letter) letters[r.letter]++; });
  const avg = classAverage(s); const prevAvg = prev ? (prev.grade.filter(v => v != null).reduce((a, b) => a + b, 0) / (prev.grade.filter(v => v != null).length || 1)) : null;
  const missingTotal = gb.assignments.reduce((a, x) => a + x.missing, 0);
  // per-student rows
  const prevIdx = prev ? new Map(prev.students.map((n, i) => [n, i])) : null;
  const rows = gb.students.map((name, i) => {
    const r = grades[i]; const pi = prevIdx && prevIdx.has(name) ? prevIdx.get(name) : null;
    const pg = pi != null ? prev.grade[pi] : null, pm = pi != null ? prev.missing[pi] : null;
    const missing = gb.assignments.filter(a => a.status && a.status[i] === 'missing');
    let weakest = null; for (const k in r.cats) { const c = r.cats[k]; if (c.pct != null && (weakest == null || c.pct < r.cats[weakest].pct)) weakest = k; }
    const d = r.rounded != null && pg != null ? r.rounded - pg : null;
    const sliding = (d != null && d <= -3) || (pm != null && missing.length > pm);
    return { name, i, r, d, missing: missing.length, dMissing: pm != null ? missing.length - pm : null, weakest, sliding };
  });
  const ixl = ixlVsTests(s); const ixlBy = new Map(ixl.map(x => [x.i, x]));
  rows.sort((a, b) => (b.sliding - a.sliding) || ((a.r.rounded ?? 101) - (b.r.rounded ?? 101)) || a.name.localeCompare(b.name));
  const sliding = rows.filter(r => r.sliding).length;
  // assignments
  const asg = gb.assignments.map(a => { const v = a.values.filter(x => x != null); const cat = catIn(s, a); const how = g.how[a.name] || (g.map[a.name] ? 'user' : 'guess');
    return { a, cat, how, avg: v.length && a.max ? v.reduce((x, y) => x + y, 0) / v.length / a.max * 100 : null, cost: avg != null ? avg - classAverage(s, null, a.name) : null, disagree: fit && fit.disagree && fit.disagree[a.name] }; })
    .sort((x, y) => dueKey(y.a.due).localeCompare(dueKey(x.a.due)) || x.a.name.localeCompare(y.a.name));
  const catRows = (s._cats || g.cats).map(c => { const list = asg.filter(x => x.cat === c.name); const gs = grades.map(r => r.cats[c.name] && r.cats[c.name].pct).filter(v => v != null); return { c, n: list.length, avg: gs.length ? gs.reduce((a, b) => a + b, 0) / gs.length : null }; });
  const pts = ixl.filter(x => x.ixl != null && x.tests != null).map(x => ({ ...x, label: H ? mask(x.name) : x.name })); const rr = pts.length >= 8 ? pearson(pts.map(x => x.ixl), pts.map(x => x.tests)) : null;
  // No direction claim below |r| = 0.3, and a small class is a hint, not a finding.
  const rWord = rr == null ? '' : (Math.abs(rr) < 0.3 ? 'no clear relationship between IXL work and assessment scores here' : (Math.abs(rr) < 0.5 ? 'a weak tendency for ' : Math.abs(rr) < 0.7 ? 'a moderate tendency for ' : 'a strong tendency for ') + (rr > 0 ? 'students doing more IXL to score higher on assessments' : 'students doing more IXL to score lower on assessments')) + (pts.length < 20 ? ` (${pts.length} students — treat as a hint, not proof)` : '');
  const hist = (s.gradeHistory || []).filter(h => snapQ(h) === n); const trend = hist.length >= 2 ? hist.map(h => { const v = h.grade.filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }) : null;
  const unverified = closedQ && s._closed ? `<div class="notice soft"><span>✓</span><span><b>${esc(Q_NAMES[n - 1])} is closed.</b> This is the copy Tally kept on ${esc(fmtDate((quarters().closed[n].at || '').slice(0, 10)))} — every score and the final grades. Nothing here raises an alert.</span></div>` : closedQ ? `<div class="notice info"><span>ⓘ</span><span><b>${esc(Q_NAMES[n - 1])} isn't closed yet.</b> A newer export started the next quarter, so Tally kept this copy of ${esc(Q_NAMES[n - 1])} before it was replaced. Close it under <b>Quarters</b> when grades are final.</span></div>` : s._partial ? '' : !gb.overall ? `<div class="notice info"><span>ⓘ</span><span>This export has no Grade column, so assignment categories are name-based guesses — check them under <b>Categories</b>.</span></div>` : (fit && !fit.exact ? `<div class="notice"><span>⚠︎</span><span><b>Tally's grades don't all match Focus</b> (off by ${fit.err} points in total across ${fit.n} students). A category or weight is probably wrong — open <b>Categories</b>.</span></div>` : '');
  const cell = (v, cls) => `<td class="${cls || ''}">${v}</td>`;
  const html = `<div class="grades">
    ${unverified}
    <div class="gcards">
      <div class="gcard"><small>${closedQ ? 'Final class average' : 'Class average'}</small><b>${pct1(avg)}</b>${closedQ ? `<span>${esc(Q_NAMES[n - 1])}, as closed</span>` : prevAvg != null && avg != null ? `<span class="${Math.round(avg) - Math.round(prevAvg) < 0 ? 'down' : 'up'}">${signedPts(Math.round(avg) - Math.round(prevAvg))} since ${esc(fmtDate(prev.date))}</span>` : '<span>first import</span>'}</div>
      <div class="gcard"><small>Letters</small><b class="letters">${['A', 'B', 'C', 'D', 'F'].map(l => `<i class="${l}">${l}<em>${letters[l]}</em></i>`).join('')}</b></div>
      <div class="gcard"><small>${closedQ ? 'Missing at close' : 'Missing work'}</small><b>${missingTotal}</b><span>${plural(rows.filter(r => r.missing).length, 'student')} with something missing</span></div>
      ${closedQ ? '' : `<div class="gcard"><small>Sliding</small><b>${sliding}</b><span>${prev ? 'grade down 3+ or more missing since ' + esc(fmtDate(prev.date)) : 'needs a second import'}</span></div>`}
      ${trend ? `<div class="gcard"><small>Class average by import</small>${sparkline(trend, 160, 44)}<span>${hist.map(h => esc(fmtDate(h.date))).join(' → ')}</span></div>` : ''}
    </div>
    <div class="gtwo">
      <section class="gsec"><h3>Categories</h3><table class="checkTable"><thead><tr><th>Category</th><th>Weight</th><th>Assignments</th><th title="Average of the scores turned in — work not handed in is left out here (it counts as 0 in the grade)">Avg (turned in)</th></tr></thead><tbody>
        ${catRows.map(x => `<tr><td>${esc(x.c.name)}</td><td>${x.c.w}%</td><td>${x.n}</td><td>${pct1(x.avg)}</td></tr>`).join('')}</tbody></table>
        <p class="ghint">Course grade = each category's points earned ÷ points possible, weighted. Missing work counts as 0; excused (NG) is left out.${fit && fit.exact ? ` <b>Matches the Focus Grade column for all ${fit.n} students.</b>` : ''}</p></section>
      <section class="gsec"><h3>IXL vs assessments</h3>${pts.length >= 8 ? scatterSVG(pts, 420, 260) + `<p class="ghint">${plural(pts.length, 'student')} with both · r = ${rr.toFixed(2)} — ${rWord}. Assessment average leaves the IXL columns out so it isn't circular.</p>` : `<p class="ghint">Needs at least 8 students matched to IXL with an assessment on record (${pts.length} so far).</p>`}</section>
    </div>
    <section class="gsec"><h3>Assignments</h3><table class="checkTable gasg"><thead><tr><th>Assignment</th><th>Category</th><th>Due</th><th>Points</th><th title="Average of the scores turned in — work not handed in is left out here (it counts as 0 in the grade)">Avg (turned in)</th><th>Missing</th><th>Excused</th><th title="Class average now minus the class average without this assignment — negative means it pulls grades down">Effect</th></tr></thead><tbody>
      ${asg.map(x => `<tr class="${x.disagree ? 'differ' : ''}"><td>${esc(x.a.name)}</td><td><select data-cat="${esc(x.a.name)}" ${closedQ ? 'disabled' : ''}>${g.cats.map(c => `<option ${c.name === x.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select> <small title="${x.how === 'fit' ? 'proved by the Focus Grade column' : x.how === 'user' ? 'set by you' : x.how === 'file' ? 'stated in the export' : 'guessed from the name'}">${x.how === 'fit' ? '✓' : x.how === 'user' ? 'edited' : x.how === 'file' ? 'from file' : 'guess'}${x.disagree ? ' · Focus disagrees' : ''}</small></td><td>${esc(x.a.due || '')}</td><td>${x.a.max != null ? esc(fmtN(x.a.max)) : '—'}</td><td>${pct1(x.avg)}</td><td>${x.a.missing || ''}</td><td>${x.a.excused || ''}</td><td>${x.cost == null ? '' : (x.cost >= 0 ? '+' : '−') + Math.abs(x.cost).toFixed(1)}</td></tr>`).join('')}</tbody></table></section>
    <section class="gsec"><h3>Students</h3><table class="checkTable gstu"><thead><tr><th>Student</th><th>Grade</th><th>Since ${prev ? esc(fmtDate(prev.date)) : 'last import'}</th><th>Missing</th><th>Weakest category</th><th>IXL at goal</th></tr></thead><tbody>
      ${rows.map(x => { const ix = ixlBy.get(x.i); return `<tr class="${x.sliding ? 'sliding' : ''}" data-stu="${x.i}"><td><button class="nm nmbtn">${nm(x.name)}</button>${x.sliding ? ' <span class="gtag">sliding</span>' : ''}</td><td>${gradeChip(x.r)}</td><td class="${x.d != null && x.d < 0 ? 'down' : x.d > 0 ? 'up' : ''}">${x.d == null ? '' : signedPts(x.d)}</td><td>${x.missing || ''}${x.dMissing > 0 ? ` <small>(+${x.dMissing})</small>` : ''}</td><td>${x.weakest ? `${esc(x.weakest)} <small>${pct1(x.r.cats[x.weakest].pct)}</small>` : ''}</td><td>${ix && ix.ixl != null ? pct1(ix.ixl) : '<small>not matched</small>'}</td></tr>`; }).join('')}</tbody></table></section>
  </div>`;
  const wrap = $('#gridwrap'); wrap.innerHTML = html;
  wrap.querySelectorAll('[data-cat]').forEach(sel => sel.onchange = () => { if (closedQ) return; g.map[sel.dataset.cat] = sel.value; g.how[sel.dataset.cat] = 'user'; gradeSnapshot(s0); save(); render(); });
  wrap.querySelectorAll('[data-stu]').forEach(tr => tr.onclick = () => openProfile(s0.key, gb.students[Number(tr.dataset.stu)]));
}

// The old one-student card became the student's page (students.js); callers keep this name.
function openStudentCard(s, i) { if (s.grades && s.grades.students[i] != null) openProfile(s.key, s.grades.students[i]); }

/* ---------- Student report: one page per student — the Focus grade, what would move it, and the IXL still owed ----------
   Printed from the student card (one student) or the class ⋯ menu (everyone, or only students who owe something).
   Always full names: this page is for the student and the people at home. */
const REPORT_CSS = `@page{margin:.6in}body{font-family:Georgia,'Times New Roman',serif;color:#000;background:#fff;margin:0;font-size:11pt;line-height:1.35}
.rep{padding:18px 24px 24px;break-after:page;page-break-after:always}.rep:last-child{break-after:auto;page-break-after:auto}
h1,h2,h3,.meta,th,.big,.grid small{font-family:Arial,Helvetica,sans-serif}h1{font-size:17pt;margin:0}h2{font-size:11.5pt;margin:16px 0 4px;border-bottom:1.5px solid #000;padding-bottom:2px;text-transform:uppercase;letter-spacing:.06em}
.meta{font-size:9.5pt;color:#333;margin:2px 0 10px}.top{display:flex;gap:24px;align-items:flex-start}.big{font-size:30pt;font-weight:bold;line-height:1;margin:2px 0 4px;white-space:nowrap}.big small{font-size:14pt;margin-left:6px}
table{border-collapse:collapse;width:100%}td,th{padding:3px 6px;text-align:left;vertical-align:top;border-bottom:1px solid #ddd;font-size:10.5pt}th{font-size:8.5pt;text-transform:uppercase;letter-spacing:.05em;color:#333}
.r{text-align:right;white-space:nowrap}.nhi{font-weight:bold}.cats td{border-bottom:none;padding:1px 6px}.two{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}
.u{margin:4px 0 6px}.uh{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;display:flex;justify-content:space-between}.uh b{font-weight:bold}.l{margin:1px 0 0 12px;font-size:10pt}.l span{font-weight:bold}.l.done{font-style:italic}
.foot{font-size:8.5pt;color:#444;margin-top:14px;border-top:1px solid #999;padding-top:6px}.bar{position:fixed;top:0;right:0;padding:8px;background:#fff;font-family:Arial,sans-serif}.bar button{font:inherit;padding:6px 14px}@media print{.bar{display:none}}`;
function studentReportSection(s0, i, ixlRow) {
  const s = openSec(s0);   // a closed quarter's work can't move the grade any more, so the report is about the open one
  const gb = s.grades; const g = gradingFor(s.prep); const name = gb.students[i]; const r0 = computeGrade(s, i); const r = r0 && r0.rounded != null ? r0 : null;   // nothing graded yet → no grade line, no targets
  const missing = gb.assignments.filter(a => a.status && a.status[i] === 'missing'); const allIn = {}; missing.forEach(a => allIn[a.name] = a.max);
  const ixlCols = gb.assignments.filter(a => catIn(s, a) === 'Assessments' && /\bixl\b/i.test(a.name) && a.max > 0 && a.status && (a.status[i] === 'score' || a.status[i] === 'missing') && (a.values[i] == null || a.values[i] < a.max));
  const sizes = {}; gb.assignments.filter(a => catOf(s.prep, a.name) === 'Assessments' && !/\bixl\b/i.test(a.name) && a.max).forEach(a => sizes[a.max] = (sizes[a.max] || 0) + 1);
  const nextMax = Number(Object.keys(sizes).sort((a, b) => sizes[b] - sizes[a] || b - a)[0] || 20);
  const cur = r ? r.rounded : null;
  const need = r ? [[90, 'an A'], [80, 'a B'], [70, 'a C']].filter(([t]) => cur < t).map(([t, w]) => { const n = neededOn(s, i, 'Assessments', nextMax, t); return n == null ? `${w} isn't reachable on one assessment` : `${n}/${nextMax} for ${w}`; }) : [];
  const keep = r && cur >= 70 ? (() => { const floor = cur >= 90 ? 90 : cur >= 80 ? 80 : 70; const n = neededOn(s, i, 'Assessments', nextMax, floor); return n == null ? null : `${n === 0 ? 'even a 0' : n + '/' + nextMax} keeps the ${floor === 90 ? 'A' : floor === 80 ? 'B' : 'C'}`; })() : null;
  const arrow = x => x && x.rounded != null ? `→ ${x.rounded}% ${x.letter}` : '';
  // IXL still owed, from the class's IXL grid via the roster match
  const units = unitsOf(s).filter(u => u.assigned && u.total && !unitClosed(s, u)); const t = s.threshold; let ixl = '';
  if (ixlRow && ixlRow.ixl != null) {
    const per = units.map(u => { const own = activeFor(s, u, ixlRow.ixl); const p = points(s, u, ixlRow.ixl);
      const below = own.filter(k => { const v = eff(s, k, ixlRow.ixl); return v != null && v < t; }).map(k => `${s.skills[k].name} (${eff(s, k, ixlRow.ixl)})`);
      const notStarted = own.filter(k => eff(s, k, ixlRow.ixl) == null).map(k => s.skills[k].name);
      return `<div class="u"><div class="uh"><span><b>${esc(u.short)}</b> ${esc(u.title)}</span><b>${p} / ${own.length}</b></div>${below.length ? `<div class="l"><span>Below goal (${t}):</span> ${esc(below.join(' · '))}</div>` : ''}${notStarted.length ? `<div class="l"><span>Not started:</span> ${esc(notStarted.join(' · '))}</div>` : ''}${!below.length && !notStarted.length ? `<div class="l done">All ${own.length} skills at goal</div>` : ''}</div>`; }).join('');
    ixl = `<h2>IXL still owed <span style="text-transform:none;letter-spacing:0;font-weight:normal">· export of ${esc(fmtDate(dataDate(s)) || '?')} · goal SmartScore ${t}</span></h2>${per || '<p>No units assigned yet.</p>'}`;
  } else if (s.students.length) ixl = `<h2>IXL still owed</h2><p>IXL progress isn't available for this student yet.</p>`;
  const moves = [
    ...missing.map(a => `<tr><td class="nhi">${esc(a.name)}</td><td>${a.max} pts${a.due ? ' · due ' + esc(a.due) : ''}</td><td class="r">turned in ${arrow(computeGrade(s, i, { [a.name]: a.max }))}</td></tr>`),
    missing.length > 1 ? `<tr><td><b>All missing work turned in</b></td><td></td><td class="r"><b>${arrow(computeGrade(s, i, allIn))}</b></td></tr>` : '',
    ...ixlCols.map(a => `<tr><td>${esc(a.name)}</td><td>now ${a.status[i] === 'missing' ? 'NHI' : a.values[i] + '/' + a.max}</td><td class="r">at ${a.max}/${a.max} ${arrow(computeGrade(s, i, { [a.name]: a.max }))}</td></tr>`),
    (missing.length && ixlCols.length) ? (() => { const both = { ...allIn }; ixlCols.forEach(a => both[a.name] = a.max); return `<tr><td><b>All missing work turned in and IXL finished</b></td><td></td><td class="r"><b>${arrow(computeGrade(s, i, both))}</b></td></tr>`; })() : '',
    (need.length || keep) ? `<tr><td>Next assessment (out of ${nextMax})</td><td colspan="2">${[...need, keep].filter(Boolean).join(' · ')}</td></tr>` : r && cur < 70 ? `<tr><td>Next assessment (out of ${nextMax})</td><td colspan="2">No single assessment reaches a C from here — ${missing.length || ixlCols.length ? 'the work above is the lever' : 'it will take more than one'}.</td></tr>` : ''].filter(Boolean).join('');
  return `<section class="rep"><h1>${esc(name)}</h1><div class="meta">${esc(s.label)} · Focus gradebook as of ${esc(fmtDate(gb.importedAt.slice(0, 10)))} · printed ${new Date().toLocaleDateString()}</div>
    <div class="top"><div class="big">${r ? `${r.rounded}%<small>${r.letter}</small>` : '—'}</div>${r ? '' : `<p>${anyClosed() && !gb.assignments.length ? `No ${esc(Q_NAMES[currentQuarter() - 1])} grades in Tally yet.` : 'Nothing graded yet this quarter.'}</p>`}
      <table class="cats"><tbody>${g.cats.map(c => { const x = r && r.cats[c.name]; return `<tr><td>${esc(c.name)} <small>(${c.w}%)</small></td><td class="r">${x && x.possible ? `${+x.earned.toFixed(1)} / ${x.possible}` : '—'}</td><td class="r">${x && x.pct != null ? Math.round(x.pct) + '%' : '—'}</td></tr>`; }).join('')}</tbody></table></div>
    <h2>What would move the grade</h2>${moves ? `<table><tbody>${moves}</tbody></table>` : '<p>Nothing missing and every assessment at full marks — keep going.</p>'}
    ${ixl}
    <div class="foot">Course grade = each category's points earned ÷ points possible, weighted ${g.cats.map(c => `${esc(c.name)} ${c.w}%`).join(' · ')}. Work not handed in counts as zero; excused work is left out. IXL: one point per skill at or above the goal SmartScore. Figures come from the exports named above; Focus is the record of grade.</div></section>`;
}
function printStudentReports(s, indices, title) {
  const rows = gbRows(s);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${REPORT_CSS}</style></head><body><div class="bar"><button onclick="window.print()">Print</button></div>${indices.map(i => studentReportSection(s, i, rows[i])).join('')}</body></html>`;
  const w = window.open('', '_blank');
  if (!w) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = title.replace(/[^\w-]+/g, '_') + '.html'; a.click(); toast('Pop-ups are blocked, so the page was saved as a file instead.', false, 5000); return; }
  w.document.open(); w.document.write(html); w.document.close(); if (indices.length === 1) setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 300);
}
function printStudentCard(s, i) { printStudentReports(s, [i], `${s.grades.students[i]} — report`); }
// Class-level chooser: everyone, or only students with something owed (missing work or IXL below goal).
function openStudentReports(s) {
  const gb = s.grades; if (!gb) { toast('Import this class\'s Focus gradebook first — the report needs the grade.', true); return; }
  if (!hasOpenGrades(s)) { toast(`No ${esc(Q_NAMES[currentQuarter() - 1])} grades in Tally yet — reports start with the first ${esc(Q_NAMES[currentQuarter() - 1])} gradebook.`, false, 5000); return; }
  const rows = gbRows(s); const units = unitsOf(s).filter(u => u.assigned && u.total && !unitClosed(s, u)); const og = openSec(s).grades;
  const owes = gb.students.map((_, i) => { const miss = og.assignments.some(a => a.status && a.status[i] === 'missing'); const r = rows[i]; const ixl = r && r.ixl != null && units.some(u => points(s, u, r.ixl) < totalFor(s, u, r.ixl)); return miss || ixl; });
  const n = owes.filter(Boolean).length;
  const m = $('#modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="panel narrow"><header><h2>Student reports · ${esc(s.label)}</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body one"><p>One page per student: the Focus grade, what would move it, and the IXL still owed. Full names — these go home.</p>
      <div class="rp-actions col"><button class="pill" data-rep="all">Everyone <small>${plural(gb.students.length, 'page')}</small></button><button class="pill pale" data-rep="owes" ${n ? '' : 'disabled'}>Only students who owe something <small>${plural(n, 'page')}</small></button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.querySelectorAll('[data-rep]').forEach(b => b.onclick = () => { const idx = gb.students.map((_, i) => i).filter(i => b.dataset.rep === 'all' || owes[i]); close(); printStudentReports(s, idx, `Student reports — ${s.label}`); });
}

// Asked at import for new assignments the Focus fit couldn't prove.
function askCategories(sec, names, fit) {
  const g = gradingFor(sec.prep);
  return new Promise(resolve => {
    const m = $('#modal'); m.classList.remove('hidden');
    m.innerHTML = `<div class="panel narrow"><header><h2>Which category?</h2><button id="mClose" aria-label="Close">×</button></header>
      <div class="body one"><p>${fit && fit.exact ? 'The Focus Grade column proved every other assignment, but these could go in more than one category without changing anyone\'s grade.' : sec.grades.overall ? 'Tally couldn\'t match these to the Focus Grade column, so it\'s guessing from the names.' : 'This export has no Grade column, so categories are guesses from the names.'} Pick for ${esc(sec.label)}:</p>
        ${names.map((n, k) => `<div class="field"><label>${esc(n)}</label><div class="seg small" data-ask="${k}">${g.cats.map(c => `<button data-c="${esc(c.name)}" class="${g.map[n] === c.name ? 'on' : ''}">${esc(c.name)}</button>`).join('')}</div></div>`).join('')}
        <div class="rp-actions"><button class="pill" id="askApply">Apply</button><button class="pill pale" id="mCancel">Keep the guesses</button></div></div></div>`;
    const done = () => { m.classList.add('hidden'); m.innerHTML = ''; resolve(); };
    m._cancel = done; $('#mClose').onclick = done; $('#mCancel').onclick = done; m.onclick = e => { if (e.target === m) done(); };
    m.querySelectorAll('[data-ask]').forEach(seg => seg.querySelectorAll('button').forEach(b => b.onclick = () => { seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }));
    $('#askApply').onclick = () => { m.querySelectorAll('[data-ask]').forEach(seg => { const n = names[Number(seg.dataset.ask)]; const on = seg.querySelector('button.on'); if (on) { g.map[n] = on.dataset.c; g.how[n] = 'user'; } }); done(); };
  });
}

// Category weights editor (from the Grades bar).
function openWeights(sec) {
  const g = gradingFor(sec.prep);
  const m = $('#modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="panel narrow"><header><h2>Category weights · ${sec.prep === 'acc' ? 'accelerated' : 'on-level'}</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body one"><p>As set in Focus. Applies to every ${sec.prep === 'acc' ? 'accelerated' : 'on-level'} class.</p>
      ${g.cats.map((c, k) => `<div class="field row2"><label>${esc(c.name)}</label><input type="number" data-w="${k}" value="${c.w}" min="0" max="100" style="width:90px"> <span>%</span></div>`).join('')}
      <p class="ghint" id="wsum"></p>
      <div class="rp-actions"><button class="pill" id="wSave">Save</button><button class="pill pale" id="mCancel">Cancel</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  const sum = () => { const t = [...m.querySelectorAll('[data-w]')].reduce((a, el) => a + (Number(el.value) || 0), 0); $('#wsum').textContent = t === 100 ? 'Adds up to 100.' : `Adds up to ${t} — Focus weights normally total 100.`; };
  m.querySelectorAll('[data-w]').forEach(el => el.oninput = sum); sum();
  $('#wSave').onclick = () => { m.querySelectorAll('[data-w]').forEach(el => { g.cats[Number(el.dataset.w)].w = Math.max(0, Number(el.value) || 0); }); state.order.map(k => state.sections[k]).filter(x => x.prep === sec.prep && x.grades).forEach(gradeSnapshot); save(); close(); render(); };
}
