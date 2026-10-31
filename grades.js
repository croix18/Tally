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
// Where an assignment's category stands: 'fit' (proved by Focus's Grade column), 'user' (set by hand), 'ok' (Tally's
// guess, checked by the teacher: unlike 'user' it stays free, so a later export with a Grade column can still prove or
// move it), 'file' (the export's own category row) or 'guess' (from the name, not looked at yet).
const catHow = (g, a) => g.how[a.name] || (g.map[a.name] ? 'user' : catFromFile(a, g.cats) ? 'file' : 'guess');
// The open quarter's assignments whose category is still an unchecked guess: the only ones that need the teacher's eye
// when the export has no Grade column (Croix, 25 Oct 2026: the reminder stayed after he had set them).
function catGuesses(sec) { const og = openSec(sec); if (!og || !og.grades) return []; const g = gradingFor(sec.prep); return og.grades.assignments.filter(a => catHow(g, a) === 'guess'); }
// "These are right": each unchecked guess is kept at the category it has now, as checked.
function catCheck(prep, list) { const g = gradingFor(prep); list.forEach(a => { if (catHow(g, a) !== 'guess') return; g.map[a.name] = catOf(prep, a.name, a); g.how[a.name] = 'ok'; }); }

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
  return { pct, rounded: roundPct(pct), letter: letterOf(roundPct(pct)), cats };
}
// Focus rounds the grade half up (a 37.5 shows as 38 — seen in a real export). So does Tally, with a hair of slack so a
// grade that is 59.5 in decimal arithmetic but 59.49999… in floating point still rounds the way Focus shows it.
const roundPct = p => p == null ? null : Math.round(p + 1e-9);
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
  const disagree = {}; let focusMap = null;
  if (lock && gb.assignments.some(a => g.how[a.name] === 'user')) { const free = fitCategories(sec, { ignoreUser: true }); focusMap = free && free.err < best ? free.map : null; gb.assignments.forEach(a => { if (g.how[a.name] === 'user') disagree[a.name] = !!free && free.err < best && free.map[a.name] !== map[a.name]; }); }
  return { map, err: best, exact: best === 0, determined, disagree, focusMap, n: idx.length };
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

// Categories are course-wide. Every change keeps one step of undo and re-grades every class of the course.
const catSnap = prep => { const g = gradingFor(prep); return JSON.stringify({ map: g.map, how: g.how }); };
function catRefresh(prep) { state.order.map(k => state.sections[k]).filter(s => s.prep === prep && s.grades).forEach(s => gradeSnapshot(s)); }
function catRestore(prep, snap) { const g = gradingFor(prep); const b = JSON.parse(snap); g.map = b.map; g.how = b.how; catRefresh(prep); }
// "Let Tally decide": forget a hand-set category and fit it again from the Focus Grade column (the name decides where
// Focus can't tell). Croix, 23 Oct: a few stray taps had locked IXL and tests into the wrong categories.
function catLetTally(prep, names) { const g = gradingFor(prep); names.forEach(n => { delete g.map[n]; delete g.how[n]; }); state.order.map(k => state.sections[k]).filter(s => s.prep === prep && s.grades).forEach(s => applyCategories(s)); catRefresh(prep); }
const looksLikeTest = n => /\b(test|exam|assessment|quiz|benchmark)\b/i.test(String(n || ''));
function catUndoToast(prep, snap, html) { toast(`${html} <button class="tundo" id="catUndo">Undo</button>`, false, 6000); const u = $('#catUndo'); if (u) u.onclick = () => { catRestore(prep, snap); save(); render(); toast('Undone', false, 1500); }; }
const courseWord = prep => prep === 'acc' ? 'accelerated' : 'on-level';

/* ---------- what-ifs ---------- */
// Minimum points out of `max` on a NEW assignment in `cat` to reach `target` percent (rounded), or null if impossible.
function neededOn(sec, i, cat, max, target) {
  const g = gradingFor(sec.prep); const base = computeGrade(sec, i); if (!base) return null;
  const c = base.cats[cat] || { earned: 0, possible: 0, w: (g.cats.find(x => x.name === cat) || {}).w || 0 };
  const grade = pts => { let tw = 0, tot = 0; for (const k in base.cats) { const x = base.cats[k]; const e = k === cat ? x.earned + pts : x.earned, p = k === cat ? x.possible + max : x.possible; if (p > 0) { tw += x.w; tot += x.w * e / p * 100; } } if (!(cat in base.cats) && c.w) { tw += c.w; tot += c.w * pts / max * 100; } return tw ? tot / tw : null; };
  if (roundPct(grade(max)) < target) return null;
  // Scores are entered in half points, so walk the half-point grid (0 first — a student already above the line needs nothing).
  for (let pts = 0; pts <= max; pts += 0.5) if (roundPct(grade(pts)) >= target) return pts;
  return max;
}
// Grade after a new assignment in `cat` worth `max` scored `pts`.
function withNext(sec, i, cat, max, pts) {
  const base = computeGrade(sec, i); if (!base) return null; const g = gradingFor(sec.prep);
  let tw = 0, tot = 0, seen = false;
  for (const k in base.cats) { const x = base.cats[k]; const e = k === cat ? x.earned + pts : x.earned, p = k === cat ? x.possible + max : x.possible; if (k === cat) seen = true; if (p > 0) { tw += x.w; tot += x.w * e / p * 100; } }
  if (!seen) { const w = (g.cats.find(x => x.name === cat) || {}).w || 0; tw += w; tot += w * pts / max * 100; }
  const pct = tw ? tot / tw : null; return { pct, rounded: roundPct(pct), letter: letterOf(roundPct(pct)) };
}

/* ---------- history ---------- */
// What a gradebook snapshot measures: with nothing closed, the whole gradebook; otherwise its open part, or — in the gap
// before the next quarter's first export — the latest quarter it holds. Each snapshot records its quarter (q).
function snapBasis(sec) {
  const gb = sec.grades; if (!anyClosed()) return { s: sec, q: gbQuarter(gb) };
  const o = openSec(sec); if (o.grades.assignments.length) return { s: o, q: liveQuarter(sec) };
  const qn = gbQuarter(gb); const sub = gb.assignments.filter(a => aQuarter(a, gb) === qn);
  return { s: sub.length === gb.assignments.length ? sec : { ...sec, grades: { ...gb, assignments: sub, overall: null } }, q: qn };
}
const snapQ = h => h.q || quarterOf(h.date);
function gradeSnapshot(sec) {
  if (!sec.grades) return;
  const { s, q } = snapBasis(sec); const gb = s.grades;
  const date = localDayOf(gb.importedAt || new Date().toISOString());
  const grades = gradeAll(s); const cn = gradingFor(sec.prep).cats.map(c => c.name);
  const snap = { date, at: gb.importedAt, file: gb.file, q, students: gb.students.slice(), grade: grades.map(r => r && r.rounded), missing: gb.students.map((_, i) => gb.assignments.filter(a => (a.status ? a.status[i] : null) === 'missing').length),
    cats: Object.fromEntries(cn.map(c => [c, grades.map(r => r && r.cats[c] && r.cats[c].pct != null ? Math.round(r.cats[c].pct * 10) / 10 : null)])),
    assignments: gb.assignments.map(a => { const v = a.values.filter(x => x != null); return { name: a.name, max: a.max, due: a.due, avg: v.length && a.max ? v.reduce((x, y) => x + y, 0) / v.length / a.max * 100 : null, missing: a.missing }; }) };
  // one snapshot per import day AND quarter: the last Q1 export and the first Q2 export can land on the same day
  sec.gradeHistory = (sec.gradeHistory || []).filter(h => !(h.date === date && snapQ(h) === q)); sec.gradeHistory.push(snap); sec.gradeHistory.sort((a, b) => a.date.localeCompare(b.date) || snapQ(a) - snapQ(b));
  if (sec.gradeHistory.length > 60) sec.gradeHistory = sec.gradeHistory.slice(-60);
}
// The previous import of the SAME quarter: a fresh quarter's first gradebook has nothing to slide from.
const prevGradeSnap = sec => { if (sec._closed) return null; const h = sec.gradeHistory || []; const cur = sec.grades ? localDayOf(sec.grades.importedAt || '') : null; const q = sec.grades ? snapBasis(sec).q : null; return h.filter(x => x.date < cur && snapQ(x) === q).pop() || null; };

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
function scatterSVG(pts, w, h, color) {
  const X = x => 40 + x / 100 * (w - 56), Y = y => h - 36 - y / 100 * (h - 48);
  let s = `<svg class="scatter" viewBox="0 0 ${w} ${h}"${color ? ` style="--cc:${color}"` : ''} role="img" aria-label="IXL work at goal against assessment average, one dot per student">`;
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
  return `<div class="crumb"><button id="back">‹ ${esc(s0.label)}</button><h2>Grades</h2></div>${seg}<span class="meta">${s._closed ? `${esc(Q_NAMES[n - 1])} · closed ${esc(fmtDate((quarters().closed[n].at || '').slice(0, 10)))} · ` : s._arch ? `${esc(Q_NAMES[n - 1])} · kept, not closed yet · ` : ''}${gb && gb.assignments.length ? `Focus gradebook of ${esc(fmtDate(localDayOf(gb.importedAt)))} · ${plural(gb.assignments.length, 'assignment')} · ${plural(gb.students.length, 'student')}${prev ? ` · previous import ${esc(fmtDate(prev.date))}` : ''}` : `no ${esc(Q_NAMES[n - 1])} gradebook yet`}</span>
      <div class="spacer"></div>
      <button class="pill toggle" id="gradesWeights" title="Category weights: ${gradingFor(s0.prep).cats.map(c => `${esc(c.name)} ${c.w}%`).join(', ')}">Weights <small>${gradingFor(s0.prep).cats.map(c => `${esc(c.name.slice(0, 1))} ${c.w}`).join(' · ')}</small></button>
      ${s._arch ? '' : '<button class="pill toggle" id="gradesCats" title="Check or move assignment categories">Categories</button>'}
      <button class="pill toggle" id="gradesQuarters" title="Quarter dates; close a quarter">Quarters</button>`;
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
  const asg = gb.assignments.map(a => { const v = a.values.filter(x => x != null); const cat = catIn(s, a); const how = catHow(g, a);
    return { a, cat, how, avg: v.length && a.max ? v.reduce((x, y) => x + y, 0) / v.length / a.max * 100 : null, cost: avg != null ? avg - classAverage(s, null, a.name) : null, disagree: fit && fit.disagree && fit.disagree[a.name] }; })
    .sort((x, y) => dueKey(y.a.due).localeCompare(dueKey(x.a.due)) || x.a.name.localeCompare(y.a.name));
  const catRows = (s._cats || g.cats).map(c => { const list = asg.filter(x => x.cat === c.name); const gs = grades.map(r => r.cats[c.name] && r.cats[c.name].pct).filter(v => v != null); return { c, n: list.length, avg: gs.length ? gs.reduce((a, b) => a + b, 0) / gs.length : null }; });
  const pts = ixl.filter(x => x.ixl != null && x.tests != null).map(x => ({ ...x, label: H ? mask(x.name) : x.name })); const rr = pts.length >= 8 ? pearson(pts.map(x => x.ixl), pts.map(x => x.tests)) : null;
  // No direction claim below |r| = 0.3, and a small class is a hint, not a finding.
  const rWord = rr == null ? '' : (Math.abs(rr) < 0.3 ? 'no clear relationship between IXL work and assessment scores here' : (Math.abs(rr) < 0.5 ? 'a weak tendency for ' : Math.abs(rr) < 0.7 ? 'a moderate tendency for ' : 'a strong tendency for ') + (rr > 0 ? 'students doing more IXL to score higher on assessments' : 'students doing more IXL to score lower on assessments')) + (pts.length < 20 ? ` (${pts.length} students: treat as a hint, not proof)` : '');
  const guessN = closedQ ? 0 : catGuesses(s0).length;   // unchecked guesses (the banner shows them only for an export with no Grade column)
  const hist = (s.gradeHistory || []).filter(h => snapQ(h) === n); const trend = hist.length >= 2 ? hist.map(h => { const v = h.grade.filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }) : null;
  const unverified = closedQ && s._closed ? `<div class="notice soft"><span>${ico('check')}</span><span><b>${esc(Q_NAMES[n - 1])} is closed.</b> This is the copy Tally kept on ${esc(fmtDate((quarters().closed[n].at || '').slice(0, 10)))}: every score and the final grades. Nothing here raises an alert.</span></div>` : closedQ ? `<div class="notice info"><span>${ico('info')}</span><span><b>${esc(Q_NAMES[n - 1])} isn't closed yet.</b> A newer export started the next quarter, so Tally kept this copy of ${esc(Q_NAMES[n - 1])} before it was replaced. Close it under <b>Quarters</b> when grades are final.</span></div>` : s._partial ? '' : !gb.overall ? (guessN ? `<div class="notice info catcheck"><span>${ico('info')}</span><span><b>${guessN === 1 ? '1 category is Tally\'s guess' : `${guessN} categories are Tally's guesses`}</b> from ${guessN === 1 ? 'its name' : 'their names'}: this export has no Grade column to check ${guessN === 1 ? 'it' : 'them'} against. Change any that are wrong under <b>Assignments</b>.</span><button class="pill small" id="catKeep">${guessN === 1 ? 'It\'s right' : 'These are right'}</button></div>` : '') : (fit && !fit.exact ? `<div class="notice"><span>${ico('warn')}</span><span><b>Tally's grades don't all match Focus</b> (off by ${fit.err} points in total across ${fit.n} students). A category or weight is probably wrong: open <b>Categories</b>.</span></div>` : '');
  const cell = (v, cls) => `<td class="${cls || ''}">${v}</td>`;
  // Fixing a category mistake: Focus's own grades say which rows are wrong, so the fix is one button, and anything set by
  // hand goes back to Tally in one more. A kept quarter is read-only; it says how to change it.
  const course = courseWord(s0.prep); const userSet = closedQ ? [] : asg.filter(x => x.how === 'user').map(x => x.a.name); const dis = closedQ || !fit ? [] : asg.filter(x => x.disagree).map(x => x.a.name);
  const catWord = k => k === 1 ? 'category' : 'categories';
  const catBar = closedQ ? `<p class="ghint">To change a category in ${esc(Q_NAMES[n - 1])}, reopen it under <b>Quarters</b>, change it, then close it again.</p>`
    : `${dis.length && fit.focusMap ? `<div class="notice info catfix"><span>${ico('info')}</span><span><b>Focus's grades disagree with ${dis.length === 1 ? 'a category' : dis.length + ' categories'} you set:</b> ${dis.slice(0, 3).map(esc).join(', ')}${dis.length > 3 ? ` and ${dis.length - 3} more` : ''}.</span><button class="pill small" id="catUseFocus">Use Focus's ${catWord(dis.length)}</button></div>` : ''}${userSet.length ? `<p class="ghint catline">You set ${userSet.length} ${catWord(userSet.length)} by hand. Changes apply to every ${course} class. <button class="linkbtn inl" id="catAllBack">Let Tally decide all ${userSet.length}</button></p>` : `<p class="ghint catline">A change here applies to every ${course} class.</p>`}`;
  const html = `<div class="grades">
    ${unverified}
    <div class="gcards">
      <div class="gcard"><small>${closedQ ? 'Final class average' : 'Class average'}</small><b>${pct1(avg)}</b>${closedQ ? `<span>${esc(Q_NAMES[n - 1])}, as closed</span>` : prevAvg != null && avg != null ? `<span class="${Math.round(avg) - Math.round(prevAvg) < 0 ? 'down' : 'up'}">${signedPts(Math.round(avg) - Math.round(prevAvg))} since ${esc(fmtDate(prev.date))}</span>` : '<span>first import</span>'}</div>
      <div class="gcard"><small>Letters</small><b class="letters">${['A', 'B', 'C', 'D', 'F'].map(l => `<i class="${l}">${l}<em>${letters[l]}</em></i>`).join('')}</b></div>
      <div class="gcard"><small>${closedQ ? 'Missing at close' : 'Missing work'}</small><b>${missingTotal}</b><span>${plural(rows.filter(r => r.missing).length, 'student')} with something missing</span></div>
      ${closedQ ? '' : `<div class="gcard" title="Students whose grade is down 3 points or more, or who have more missing work, since the last gradebook"><small>Sliding</small><b>${sliding}</b><span>${prev ? 'since ' + esc(fmtDate(prev.date)) : 'needs a second import'}</span></div>`}
      ${trend ? `<div class="gcard"><small>Class average by import</small>${sparkline(trend, 160, 44)}<span>${hist.map(h => esc(fmtDate(h.date))).join(' → ')}</span></div>` : ''}
    </div>
    <div class="gtwo">
      <section class="gsec"><h3>Categories</h3><table class="checkTable"><thead><tr><th>Category</th><th>Weight</th><th>Assignments</th><th title="Average of the scores turned in: work not handed in is left out here (it counts as 0 in the grade)">Avg (turned in)</th></tr></thead><tbody>
        ${catRows.map(x => `<tr><td>${esc(x.c.name)}</td><td>${x.c.w}%</td><td>${x.n}</td><td>${pct1(x.avg)}</td></tr>`).join('')}</tbody></table>
        ${fit && fit.exact ? `<p class="ghint"><b>Matches the Focus Grade column for all ${fit.n} students.</b></p>` : ''}</section>
      <section class="gsec"><h3>IXL vs assessments</h3>${pts.length >= 8 && rr != null ? scatterSVG(pts, 420, 260, classColor(s0)) + `<p class="ghint">${plural(pts.length, 'student')} with both · r = ${rr.toFixed(2)}: ${rWord}.</p>` : `<p class="ghint">${pts.length >= 8 ? 'The scores are all the same on one side, so there is nothing to compare yet.' : `Needs at least 8 students matched to IXL with an assessment on record (${pts.length} so far).`}</p>`}</section>
    </div>
    <section class="gsec" id="gAsg"><h3>Assignments</h3>${catBar}<table class="checkTable gasg"><thead><tr><th>Assignment</th><th>Category</th><th>Due</th><th>Points</th><th title="Average of the scores turned in: work not handed in is left out here (it counts as 0 in the grade)">Avg (turned in)</th><th>Missing</th><th>Excused</th><th title="Class average now minus the class average without this assignment: negative means it pulls grades down">Effect</th></tr></thead><tbody>
      ${asg.map(x => `<tr class="${x.disagree ? 'differ' : ''}"><td>${esc(x.a.name)}</td><td><select data-cat="${esc(x.a.name)}" ${closedQ ? 'disabled' : ''}>${g.cats.map(c => `<option ${c.name === x.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select> <small class="catsrc src-${x.how}${x.disagree ? ' off' : ''}">${x.how === 'fit' ? `<span title="Proved by the Focus Grade column">${ico('check', 'confirmed')}</span>` : x.how === 'user' ? 'Set by you' : x.how === 'ok' ? 'Checked by you' : x.how === 'file' ? 'From the file' : 'Tally\'s guess'}${x.disagree ? ' · Focus disagrees' : ''}</small>${x.how === 'user' && !closedQ ? ` <button class="linkbtn inl" data-back="${esc(x.a.name)}" title="Forget your choice; Focus's grades decide">Let Tally decide</button>` : ''}</td><td>${esc(x.a.due || '')}</td><td>${x.a.max != null ? esc(fmtN(x.a.max)) : '—'}</td><td>${pct1(x.avg)}</td><td>${x.a.missing || ''}</td><td>${x.a.excused || ''}</td><td>${x.cost == null ? '' : (x.cost >= 0 ? '+' : '−') + Math.abs(x.cost).toFixed(1)}</td></tr>`).join('')}</tbody></table></section>
    <section class="gsec"><h3>Students</h3><table class="checkTable gstu"><thead><tr><th>Student</th><th>Grade</th><th>Since ${prev ? esc(fmtDate(prev.date)) : 'last import'}</th><th>Missing</th><th>Weakest category</th><th>IXL at goal</th></tr></thead><tbody>
      ${rows.map(x => { const ix = ixlBy.get(x.i); return `<tr class="${x.sliding ? 'sliding' : ''}" data-stu="${x.i}"><td><button class="nm nmbtn">${nm(x.name)}</button>${x.sliding ? ' <span class="gtag">sliding</span>' : ''}</td><td>${gradeChip(x.r)}</td><td class="${x.d != null && x.d < 0 ? 'down' : x.d > 0 ? 'up' : ''}">${x.d == null ? '' : signedPts(x.d)}</td><td>${x.missing || ''}${x.dMissing > 0 ? ` <small>(+${x.dMissing})</small>` : ''}</td><td>${x.weakest ? `${esc(x.weakest)} <small>${pct1(x.r.cats[x.weakest].pct)}</small>` : ''}</td><td>${ix && ix.ixl != null ? pct1(ix.ixl) : '<small>not matched</small>'}</td></tr>`; }).join('')}</tbody></table></section>
  </div>`;
  const wrap = $('#gridwrap'); wrap.innerHTML = html;
  wrap.querySelectorAll('[data-cat]').forEach(sel => sel.onchange = () => { if (closedQ) return; const snap = catSnap(s0.prep); const nm0 = sel.dataset.cat; g.map[nm0] = sel.value; g.how[nm0] = 'user'; catRefresh(s0.prep); save(); render();
    catUndoToast(s0.prep, snap, `<b>${esc(nm0)}</b> is ${esc(sel.value)} in every ${course} class.`); });
  wrap.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { const snap = catSnap(s0.prep); const nm0 = b.dataset.back; catLetTally(s0.prep, [nm0]); save(); render(); catUndoToast(s0.prep, snap, `<b>${esc(nm0)}</b> is back to Tally: ${esc(gradingFor(s0.prep).map[nm0] || '')}.`); });
  const ab = $('#catAllBack'); if (ab) ab.onclick = () => { const snap = catSnap(s0.prep); catLetTally(s0.prep, userSet); save(); render(); catUndoToast(s0.prep, snap, `${userSet.length} ${catWord(userSet.length)} back to Tally.${fitCategories(s0) && fitCategories(s0).exact ? ' Grades match Focus.' : ''}`); };
  const ck = $('#catKeep'); if (ck) ck.onclick = () => { const snap = catSnap(s0.prep); const list = catGuesses(s0); catCheck(s0.prep, list); catRefresh(s0.prep); save(); render(); catUndoToast(s0.prep, snap, `${list.length === 1 ? `<b>${esc(list[0].name)}</b> stays ${esc(gradingFor(s0.prep).map[list[0].name])}` : `${list.length} categories stay as they are`} in every ${course} class.`); };
  const uf = $('#catUseFocus'); if (uf) uf.onclick = () => { const snap = catSnap(s0.prep); dis.forEach(nm0 => { g.map[nm0] = fit.focusMap[nm0]; g.how[nm0] = 'fit'; }); catRefresh(s0.prep); save(); render(); catUndoToast(s0.prep, snap, `Using Focus's ${catWord(dis.length)} for ${dis.length === 1 ? esc(dis[0]) : dis.length + ' assignments'}.`); };
  wrap.querySelectorAll('[data-stu]').forEach(tr => tr.onclick = () => openProfile(s0.key, gb.students[Number(tr.dataset.stu)]));
}

// The old one-student card became the student's page (students.js); callers keep this name.
function openStudentCard(s, i) { if (s.grades && s.grades.students[i] != null) openProfile(s.key, s.grades.students[i]); }

/* ---------- Student report: one page per student — the Focus grade, what would move it, and the IXL still owed ----------
   Printed from the student card (one student) or the class More menu (everyone, or only students who owe something).
   Always full names: this page is for the student and the people at home. */
const REPORT_CSS = `@page{margin:.45in .45in .45in 1in}   /* a left margin for a three-hole punch (Croix, 25 Oct 2026) */
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#000;background:#fff;margin:0;font-size:9.5pt;line-height:1.3}
.rep{padding:18px 24px 24px;break-after:page;page-break-after:always}.rep:last-child{break-after:auto;page-break-after:auto}@media print{.rep{padding:0}}
h1{font-size:17pt;margin:0;font-weight:900}h2{font-size:9.5pt;font-weight:900;margin:10px 0 3px;border-bottom:1.5px solid #000;padding-bottom:2px;text-transform:uppercase;letter-spacing:.06em}h2 .hs{text-transform:none;letter-spacing:0;font-weight:normal;color:#333}
.head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.meta{font-size:9pt;color:#333;margin:2px 0 8px}
.since{border:1.5px solid #000;border-radius:6px;padding:4px 10px;font-size:9pt;display:flex;flex-wrap:wrap;gap:2px 16px;align-items:baseline;margin:8px 0 0}.since small{color:#555;font-weight:normal}.since .stale{color:#B8321F}.since .up{color:#0F766E;font-weight:bold}.since .down{color:#B8321F;font-weight:bold}.since .same{color:#555}
.top{display:flex;gap:18px;align-items:flex-start}.gradeBox{flex:none;min-width:200px}.big{font-size:30pt;font-weight:900;line-height:1;margin:2px 0 4px;white-space:nowrap}.big small{font-size:14pt;margin-left:6px}
.board{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;flex:1}.board>div{border:1px solid #bbb;border-radius:6px;padding:5px 8px}.board small{display:block;font-size:7.5pt;text-transform:uppercase;letter-spacing:.06em;color:#333}.board b{font-size:15pt;font-weight:900;line-height:1.15}.board span{display:block;font-size:8pt;color:#444}.board .ok b{color:#0F766E}.board .no b{color:#B8321F}
table{border-collapse:collapse;width:100%}td,th{padding:1.5px 6px;text-align:left;vertical-align:top;border-bottom:1px solid #ddd;font-size:9pt}td small{color:#444}th{font-size:8.5pt;text-transform:uppercase;letter-spacing:.05em;color:#333}
.r{text-align:right;white-space:nowrap}.nhi{font-weight:bold}.cats td{border-bottom:none;padding:1px 6px}.two{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}
.u{margin:3px 0 5px}.uh{font-size:9.5pt;display:flex;align-items:center;gap:8px}.uh>span:first-child{flex:1}.uh em{font-style:normal;font-size:7.5pt;font-weight:900;letter-spacing:.06em;border:1px solid #000;border-radius:8px;padding:0 5px;margin-left:4px}.uh .pb{width:90px;height:8px;border:1px solid #000;border-radius:4px;overflow:hidden;background:#fff;display:flex}.uh .pb i{display:block;height:100%}.uh .pb i.at{background:#000}.uh .pb i.st{background:repeating-linear-gradient(135deg,#777 0 2px,#fff 2px 4px)}.sks{columns:2;column-gap:18px;margin:3px 0 4px 2px}.sk{break-inside:avoid;display:flex;align-items:baseline;gap:5px;font-size:9pt;padding:1.5px 0}.sk .nm{flex:1}.sk b{white-space:nowrap}.sk b.zero{font-weight:normal;color:#444}.wk .panel.ixl{break-inside:auto}.wk .panel.ixl .u{break-inside:avoid}.wk .panel.ixl .u.long{break-inside:auto}.wk .panel.ixl .uh{break-after:avoid}
.keyline{font-size:7.5pt;color:#444;text-align:right;margin:2px 0 0}.prac{font-size:9pt;margin:3px 0 0;padding:4px 6px;background:#eee;border-radius:4px}.prac em{font-style:normal;font-weight:900;border:1px solid #000;border-radius:8px;padding:0 5px;font-size:7.5pt}.sk .pt{color:#444;white-space:nowrap}.key{display:inline-block;width:12px;height:8px;border:1px solid #000;border-radius:2px;vertical-align:-1px;margin:0 2px 0 8px}.key.at{background:#000}.key.st{background:repeating-linear-gradient(135deg,#777 0 2px,#fff 2px 4px)}.key.no{background:#fff}.uh b{font-weight:bold;min-width:42px;text-align:right}.l{margin:1px 0 0 12px;font-size:9pt;color:#333}.l span{font-weight:bold;color:#000}.l .done{font-style:italic;font-weight:normal}.meta small{color:#555}
.lead{margin:4px 0}.keep{margin:4px 0;font-weight:bold}.todo{list-style:none;margin:2px 0 4px;padding:0;counter-reset:st}.todo li{display:flex;align-items:baseline;gap:8px;padding:3px 0;border-bottom:1px solid #ddd;font-size:10pt}.todo .st{flex:1}.todo .aft{font-weight:900;white-space:nowrap}.todo li::before{counter-increment:st;content:counter(st) ".";width:14px;color:#333}
.box{display:inline-block;width:12px;height:12px;border:1.5px solid #000;border-radius:2px;vertical-align:-2px;margin-right:4px;flex:none}
.tests{margin:3px 0 6px}.rt{margin:4px 0 2px}
.pledge{margin-top:10px;border:1.5px solid #000;border-radius:6px;padding:8px 10px;display:grid;grid-template-columns:1.4fr 1fr;gap:6px 16px;font-size:9.5pt}.pl b{display:block;margin-bottom:2px}.pl i{display:block;border-bottom:1px solid #000;height:15px}.sig{grid-column:1/-1;display:flex;gap:18px;margin-top:6px;font-size:9pt}.sig span{display:flex;align-items:flex-end;gap:6px;flex:1;white-space:nowrap}.sig span::after{content:'';flex:1;border-bottom:1px solid #000;min-width:40px}.sig span:last-child{flex:.6}
.foot{font-size:7.5pt;color:#444;margin-top:8px;border-top:1px solid #999;padding-top:5px}
.wk .head{align-items:flex-start;gap:14px}.wk .title{flex:none}.wk .course{font-size:9pt;font-weight:bold;margin-bottom:3px}.wk .badge{background:#fff;color:#000;border:2px solid #000;font-weight:900;font-size:12pt;letter-spacing:.04em;text-transform:uppercase;padding:5px 12px;border-radius:5px;white-space:nowrap}.wk .who{flex:1;min-width:0}.wk .who h1{font-size:16pt;line-height:1.1}.wk .meta{margin:2px 0 0}
.wk .top{margin:10px 0 8px}.wk .board{grid-template-columns:repeat(3,1fr)}.wk .board>div{background:#eee;border:1px solid #777;border-radius:5px}
.wk .howl{margin:6px -8px -6px;padding:5px 8px 6px;border-top:1px solid #aaa;background:#f2f2f2}.wk .howl p{margin:2px 0}.wk .howl .ticks{display:flex;flex-wrap:wrap;gap:3px 18px;font-size:9pt;margin-top:5px}.wk .howl .ticks>span{display:inline-flex;align-items:center;gap:5px}.wk .howl .box{margin:0}
.wk [data-newpage]{break-before:page;page-break-before:always}.wk .panel.miss td{padding:3px 6px;font-size:9.5pt}.wk .panel.miss .box{margin-right:4px}
.wk .panel{border:1.5px solid #000;border-radius:6px;overflow:hidden;margin:8px 0 0;break-inside:avoid}.wk .ph{background:#e8e8e8;color:#000;border-bottom:1px solid #999;font-weight:900;font-size:9.5pt;text-transform:uppercase;letter-spacing:.06em;padding:3px 8px}.wk .ph .hs{text-transform:none;letter-spacing:0;font-weight:normal;color:#333;font-size:8.5pt}.wk .panel.main{border-width:2.5px}.wk .panel.main .ph{background:#d9d9d9;border-bottom-color:#000}.wk .pbody{padding:4px 8px 6px}.wk .pbody>p:first-child,.wk .pbody>.lead:first-child{margin-top:2px}
.wk .two{gap:0 8px;align-items:start}.wk .two>.panel{margin-top:8px}.wk .col .panel:first-child{margin-top:8px}.wk .rt{margin:4px -8px -6px;padding:4px 8px;background:#eee;border-top:1px solid #aaa}.wk .todo{margin:2px 0 6px}
.wk .pledge{margin-top:8px;border:1.5px solid #000;border-radius:6px;padding:7px 10px 8px;display:block;break-inside:avoid;page-break-inside:avoid}.wk .pledge>b{display:block;margin-bottom:4px}.wk .lines{display:block}.wk .lines i{display:block;border-bottom:1px solid #000;height:19px}.wk .lastplan{display:flex;align-items:center;gap:5px;margin-top:8px;font-size:9.5pt}.wk .lastplan b{margin-right:8px}.wk .lastplan .box{margin:0 2px 0 6px}
.wk .sigs{padding-top:12px;break-inside:avoid;page-break-inside:avoid}.wk .sigs .sr{display:flex;gap:28px}.wk .sigs .sr+.sr{margin-top:14px}.wk .sigs .f{flex:1;min-width:0}.wk .sigs .f.d{flex:0 0 1.7in}.wk .sigs i{display:block;height:30px;border-bottom:1px solid #000}.wk .sigs small{display:block;font-size:8.5pt;color:#333;margin-top:2px}
.wk .panel.next .ntd{font-size:12pt;font-weight:900;margin:2px 0 0}.wk .panel.next .ntu{margin:1px 0 1px}
.wk .tq{margin:0 0 1px}.wk .tq td{padding:2.5px 0;font-size:9pt;border-bottom:1px solid #ddd;vertical-align:baseline}.wk .tq tr:last-child td{border-bottom:none}.wk .tq td.sc,.wk .tq td.pc{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.wk .tq td.sc{padding-left:10px}.wk .tq td.pc{width:3.4em}
.teach .ret{margin-top:10px}.teach .ret th{font-size:8pt;padding:3px 6px;border-bottom:1.5px solid #000}.teach .ret td{padding:4px 6px;font-size:9.5pt;border-bottom:1px solid #bbb;height:20px}.teach .ret td.c,.teach .ret th.c{text-align:center;width:70px}.teach .ret td:nth-child(2){white-space:nowrap}.teach .ret td.w{min-width:80px}.teach .ret td:last-child{width:120px}.teach .ret .box{margin:0;width:13px;height:13px}\n.bar{position:fixed;bottom:14px;right:14px;z-index:10;padding:6px;background:#fff;border-radius:8px;box-shadow:0 1px 8px rgba(0,0,0,.25);display:flex;align-items:center;gap:10px}.bar button{font:inherit;padding:8px 18px}.bar .hint{font-size:9pt;color:#333;padding-left:6px}@media print{.bar{display:none}}`;
// What one next assessment of `mx` points can do for student i — only what is computed: for each letter above the
// current grade (a D counts), the score that reaches it or the fact that none does; and the score that keeps the
// current letter. The report, the student page and Show student all word their sentence from this.
function nextAssessment(s, i, mx) {
  const r = computeGrade(s, i); const cur = r && r.rounded != null ? r.rounded : null; if (cur == null) return { cur: null, can: [], cant: [], keep: null };
  const reach = [[90, 'an A'], [80, 'a B'], [70, 'a C'], [60, 'a D']].filter(([t]) => cur < t).map(([t, w]) => ({ w, n: neededOn(s, i, 'Assessments', mx, t) }));
  const floor = cur >= 90 ? 90 : cur >= 80 ? 80 : cur >= 70 ? 70 : cur >= 60 ? 60 : null; const kn = floor == null ? null : neededOn(s, i, 'Assessments', mx, floor);
  return { cur, can: reach.filter(x => x.n != null), cant: reach.filter(x => x.n == null).map(x => x.w), keep: kn == null ? null : { n: kn, letter: floor === 90 ? 'A' : floor === 80 ? 'B' : floor === 70 ? 'C' : 'D' } };
}
function studentReportSection(s0, i, ixlRow) {
  const s = openSec(s0);   // a closed quarter's work can't move the grade any more, so the report is about the open one
  const gb = s.grades; const g = gradingFor(s.prep); const name = gb.students[i]; const r0 = computeGrade(s, i); const r = r0 && r0.rounded != null ? r0 : null;   // nothing graded yet → no grade line, no targets
  const missing = gb.assignments.filter(a => a.status && a.status[i] === 'missing'); const allIn = {}; missing.filter(a => !/\bixl\b/i.test(a.name)).forEach(a => allIn[a.name] = a.max);
  const ixlCols = gb.assignments.filter(a => /\bixl\b/i.test(a.name) && a.max > 0 && a.status && (a.status[i] === 'score' || a.status[i] === 'missing') && (a.values[i] == null || a.values[i] < a.max));
  const sizes = {}; gb.assignments.filter(a => catOf(s.prep, a.name) === 'Assessments' && !/\bixl\b/i.test(a.name) && a.max).forEach(a => sizes[a.max] = (sizes[a.max] || 0) + 1);
  const nextMax = Number(Object.keys(sizes).sort((a, b) => sizes[b] - sizes[a] || b - a)[0] || 20);
  const na = nextAssessment(s, i, nextMax);
  const nextLine = [na.can.map(x => `${x.n}/${nextMax} for ${x.w}`).join(' · '),
    na.cant.length ? (na.can.length ? `${na.cant.join(' or ')} would take more than one assessment` : `one assessment alone won't reach ${na.cant[na.cant.length - 1]}`) : '',
    na.keep ? `${na.keep.n === 0 ? 'even a 0' : na.keep.n + '/' + nextMax} keeps the ${na.keep.letter}` : ''].filter(Boolean).join(' · ');
  const arrow = x => x && x.rounded != null ? `→ ${x.rounded}% ${x.letter}` : '';
  const rt = r ? retakeStatus(s0, name) : null;
  const tests = gb.assignments.filter(a => catIn(s, a) === 'Assessments' && !/\bixl\b/i.test(a.name) && a.max > 0 && a.status && (a.status[i] === 'score' || a.status[i] === 'missing'));
  const retakeable = () => tests.filter(a => a.status[i] === 'score' && a.values[i] < a.max).map(a => ({ a, g: computeGrade(s, i, { [a.name]: a.max }) })).filter(x => x.g && x.g.rounded != null && r && x.g.rounded > r.rounded).sort((x, y) => y.g.rounded - x.g.rounded);
  const better = rt && rt.ok ? retakeable() : [];
  // ---- since the last report: what moved (the log is written when a report prints) ----
  // A report is the week's (logReport keeps one per school week), so a reprint in the same week moves from the same
  // report the first print did: last week's. A report from an earlier quarter is not the one to move from.
  const thisWeek = weekOf(localDay(new Date().toISOString())); const q = liveQuarter(s0); const log = ((s0.reportLog || {})[norm(name)] || []).filter(e => weekOf(e.date) < thisWeek && (e.q == null || e.q === q)); const last = log[log.length - 1] || null;
  const gbAt = gb.exportedAt || gb.importedAt || '';   // when Focus wrote the file (its date on disk), else when it came into Tally
  const stale = last ? [(last.gbAt ? last.gbAt === gbAt : last.gb && last.gb === (localDayOf(gb.importedAt) || '')) ? 'Focus' : '', last.ix && last.ix === (dataDate(s) || '') ? 'IXL' : ''].filter(Boolean) : [];
  const ixlNow = ixlRow && ixlRow.ixl != null ? unitsOf(s).filter(u => u.assigned && u.total && !unitClosed(s, u)).reduce((n, u) => n + points(s, u, ixlRow.ixl), 0) : null;
  const delta = (a, b, up) => a == null || b == null ? '' : b === a ? '<span class="same">same</span>' : `<span class="${(b > a) === up ? 'up' : 'down'}">${b > a ? '+' : '−'}${Math.abs(b - a)}</span>`;
  const since = last ? `<div class="since"><b>Since the last report <small>${esc(fmtDate(last.date))}</small></b>
      <span>Grade <b>${last.grade != null ? last.grade + '%' : '—'}</b> → <b>${r ? r.rounded + '%' : '—'}</b> ${delta(last.grade, r ? r.rounded : null, true)}</span>
      <span>Missing <b>${last.missing}</b> → <b>${missing.length}</b> ${delta(last.missing, missing.length, false)}</span>
      ${ixlNow != null && last.ixl != null ? `<span>IXL skills <b>${last.ixl}</b> → <b>${ixlNow}</b> ${delta(last.ixl, ixlNow, true)}</span>` : ''}${stale.length ? `<small class="stale">${stale.join(' and ')} export${stale.length > 1 ? 's' : ''} unchanged since then</small>` : ''}</div>` : '';   /* a first report has nothing to move from, so it carries no box (Croix, 25 Oct 2026) */
  // ---- this week's checklist: the quickest path's steps, each a box to tick ----
  const qp = r ? quickestPath(s0, s, i, ixlRow ? ixlRow.ixl : null) : null;
  const stepText = x => x.kind === 'nhi' ? `${/\bixl\b/i.test(x.a.name) ? `Do the <b>${esc(x.a.name)}</b> skills` : `Turn in <b>${esc(x.a.name)}</b>`} <small>${x.a.max} pts${x.a.due ? ' · was due ' + esc(x.a.due) : ''}</small>`
    : x.kind === 'ixl' ? `Pass <b>${plural(x.n, 'more IXL skill')}${x.unit ? ' in ' + esc(x.unit.short) : ''}</b>${x.skills.length ? ` <small>${esc(x.skills.slice(0, 2).map(k => k.name).join(' · '))}${x.skills.length > 2 ? ` and ${x.skills.length - 2} more` : ''}</small>` : ''}`
    : x.kind === 'copy' ? `Your <b>${esc(x.unit ? x.unit.short : x.a.name)} IXL</b> goes into Focus <small>already earned: ${fmtN(x.to)}</small>`
    : x.kind === 'ixlreq' ? `Finish <b>${plural(x.n, 'IXL skill')} in ${esc(x.unit.short)}</b> <small>needed before a retake</small>`
    : (() => { const full = computeGrade(s, i, { ...qp.over, [x.a.name]: x.a.max }); return `Retake <b>${esc(x.a.name)}</b> <small>score at least ${fmtN(x.to)} / ${x.a.max}${x.first ? '' : ', once everything above is done'}${full && full.rounded != null && full.rounded > x.after ? ` · a full score: ${full.rounded}% ${full.letter}` : ''}</small>`; })();
  const steps = qp && !qp.top ? qp.plan.filter(x => x.kind !== 'copy').map((x, k) => `<li><span class="box"></span><span class="st">${stepText({ ...x, first: k === 0 })}</span><span class="aft">${x.kind === 'ixlreq' ? '' : `→ ${x.after}%`}</span></li>`) : [];
  const copies = qp && !qp.top ? qp.plan.filter(x => x.kind === 'copy') : [];   // the teacher's step, not a box for the student (audit, 24 Oct)
  const copyNote = copies.length ? `<p class="lead"><small>${copies.map(x => `Your ${esc(x.unit ? x.unit.short : x.a.name)} IXL points (${fmtN(x.to)}) go into Focus at the next grade update.`).join(' ')}</small></p>` : '';
  // With no step for the student, say only what is true (audit, 25 Oct 2026: "Nothing missing and every assessment at
  // full marks" printed for a student with missing work whenever the IXL copy alone reached the next letter).
  /* An IXL column Focus marks NHI is a missing assignment too (Croix, 31 Oct 2026: "If ixl is missing, they have a
     missing assignment"): the report never says nothing is missing while one is, and names it with the rest. */
  const missWork = missing.filter(a => !/\bixl\b/i.test(a.name));
  const earnedIxl = a => { if (!ixlRow || ixlRow.ixl == null) return false; const u = gbUnitFor(s, a); return !!u && points(s, u, ixlRow.ixl) >= a.max; };   // every skill done: the points just aren't in Focus yet (the copy note says so)
  const missIxl = missing.filter(a => /\bixl\b/i.test(a.name) && !earnedIxl(a)); const belowFull = tests.some(a => a.status[i] === 'score' && Number(a.values[i]) < a.max);
  const stillMissing = () => { const names = [...missWork, ...missIxl]; const todo = [missWork.length ? `turn ${missWork.length === 1 ? 'it' : 'them'} in` : '', missIxl.length ? `do the ${missIxl.length === 1 ? esc(missIxl[0].name) : 'IXL'} skills` : ''].filter(Boolean).join(' and ');
    return `Still missing: ${names.slice(0, 3).map(a => `<b>${esc(a.name)}</b>`).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}. ${todo.charAt(0).toUpperCase() + todo.slice(1)} this week.`; };
  const steady = () => missWork.length || missIxl.length ? `<p class="keep">${stillMissing()}</p>`
    : missing.length ? ''   // only an IXL column already earned: the copy note above says so, and "nothing missing" would contradict the tile
    : better.length ? '<p class="keep">Nothing missing.</p>'
    : `<p class="keep">Nothing missing${belowFull ? '' : ' and every assessment at full marks'}: keep going.</p>`;
  const copyOnly = !!(qp && !qp.top && !steps.length && copies.length && qp.reached);
  const doThis = qp && qp.top ? `<p class="keep">An A already. ${missWork.length || missIxl.length ? stillMissing() : 'This week: keep every assignment in on time and the current unit\'s IXL at goal.'}</p>`
    : steps.length ? `<p class="lead">${qp.reached ? `These steps take the grade from ${qp.base.rounded}% to <b>${qp.result.rounded}% ${qp.result.letter}</b>.` : `Missing work, IXL and retakes reach ${qp.result.rounded}%: the next assessments are needed too.`}</p><ol class="todo">${steps.join('')}</ol>${copyNote}`
    : r ? `${copyOnly ? `<p class="lead">Your ${(u => u.length > 1 ? `${u.slice(0, -1).join(', ')} and ${u[u.length - 1]}` : u[0])(copies.map(x => esc(x.unit ? x.unit.short : x.a.name)))} IXL points go into Focus at the next grade update, and that takes the grade to <b>${qp.result.rounded}% ${qp.result.letter}</b>.</p>` : ''}${steady()}` : '';
  // ---- IXL by unit (the names a student can act on; the rest are counted) ----
  const units = unitsOf(s).filter(u => u.assigned && u.total && !unitClosed(s, u)); const t = s.threshold; let ixl = '';
  if (ixlRow && ixlRow.ixl != null) {
    /* Every skill still owed, by unit, each with the student's SmartScore in parentheses, 0 when not begun (Croix,
       24 Oct 2026: "list them all out more neatly and put what the student currently has on it in parentheses …
       If a student has zero put zero next to each one … you are not limited to one page per student"). The unit's
       bar shows at goal / started / not started at a glance; the list is in IXL's order, two columns, and may run
       onto a second page. Skills at goal are not listed: they are not owed. */
    const per = units.map(u => { const own = activeFor(s, u, ixlRow.ixl); const p = points(s, u, ixlRow.ixl); const n = own.length || 1;
      const owed = own.filter(k => { const v = eff(s, k, ixlRow.ixl); return v == null || v < t; }); const started = owed.filter(k => eff(s, k, ixlRow.ixl) != null);
      const atPct = Math.round(p / n * 100), stPct = Math.round(started.length / n * 100);
      return `<div class="u${owed.length > 14 ? ' long' : ''}"><div class="uh"><span><b>${esc(u.short)}</b> ${esc(u.title)}${u.current ? ' <em>now</em>' : ''}</span><span class="pb"><i class="at" style="width:${atPct}%"></i><i class="st" style="width:${stPct}%"></i></span><b>${p} / ${own.length}</b></div>
        ${owed.length ? `<div class="sks" data-items>${owed.map(k => { const v = eff(s, k, ixlRow.ixl); return `<div class="sk"><span class="box"></span><span class="nm">${esc(s.skills[k].name)}</span> <b class="${v == null ? 'zero' : ''}">(${v == null ? 0 : v})</b></div>`; }).join('')}</div>` : `<div class="l"><span class="done">All ${own.length} skills at goal</span></div>`}</div>`; }).join('');
    ixl = `<div class="panel ixl"><div class="ph">IXL still owed <span class="hs">goal SmartScore ${t}</span></div><div class="pbody" data-items><div class="keyline" data-keep><i class="key at"></i> at goal <i class="key st"></i> started <i class="key no"></i> not yet</div>${per || '<p>No units assigned yet.</p>'}</div></div>`;
  } else if (s.students.length) ixl = `<div class="panel"><div class="ph">IXL still owed</div><div class="pbody"><p>${ixlRow && ixlRow.status === 'noAccount' ? 'No IXL account.' : 'IXL is not linked to this report yet.'}</p></div></div>`;
  else ixl = '';
  // ---- tests and quizzes so far: one row each, the score and its percent in columns (Croix, 25 Oct 2026: "make the
  // test assessment box more organized"; it was one run-on line). Focus's order, newest first; not handed in: NHI, 0%.
  const testsTable = tests.length ? `<table class="tq"><tbody>${tests.map(a => { const nhi = a.status[i] === 'missing';
    return `<tr><td>${esc(a.name)}</td><td class="sc">${nhi ? '<b>NHI</b>' : `${fmtN(a.values[i])}/${fmtN(a.max)}`}</td><td class="pc">${nhi ? '0%' : `${Math.round(a.values[i] / a.max * 100)}%`}</td></tr>`; }).join('')}</tbody></table>` : '<p class="tests">None graded yet.</p>';
  // ---- what would move the grade ----
  const moves = [   // the missing work in one line: each assignment is listed on the back. An IXL column is finished, not turned in: it has its own row (audit: an NHI IXL column was listed twice)
    missWork.length ? `<tr><td class="nhi">${missWork.length === 1 ? `${esc(missWork[0].name)} turned in` : `All ${missWork.length} missing assignments turned in`}</td><td class="r"><b>${arrow(computeGrade(s, i, allIn))}</b></td></tr>` : '',
    ...ixlCols.map(a => `<tr><td>${esc(a.name)} <small>now ${a.status[i] === 'missing' ? 'NHI' : a.values[i] + '/' + a.max}</small></td><td class="r">at ${a.max}/${a.max} ${arrow(computeGrade(s, i, { [a.name]: a.max }))}</td></tr>`),
    (missWork.length && ixlCols.length) ? (() => { const both = { ...allIn }; ixlCols.forEach(a => both[a.name] = a.max); return `<tr><td><b>All missing work turned in and IXL finished</b></td><td class="r"><b>${arrow(computeGrade(s, i, both))}</b></td></tr>`; })() : '',
    nextLine ? `<tr><td>Next assessment (out of ${nextMax})</td><td colspan="2">${nextLine.charAt(0).toUpperCase() + nextLine.slice(1)}.</td></tr>` : ''].filter(Boolean).join('');
  const scoreboard = `<div class="board">
      <div><small>Missing assignments</small><b>${missing.length}</b><span>${missing.length ? plural(missing.reduce((n, a) => n + (a.max || 0), 0), 'point') + ' waiting' : 'nothing'}</span></div>
      <div><small>IXL at goal</small><b>${ixlNow != null ? `${ixlNow} / ${units.reduce((n, u) => n + activeFor(s, u, ixlRow.ixl).length, 0)}` : '—'}</b><span>${ixlNow != null ? 'skills, assigned units' : 'not linked'}</span></div>
      <div class="${rt ? (rt.ok ? 'ok' : 'no') : ''}"><small>Retake</small><b>${rt ? (rt.ok ? 'Eligible' : 'Not yet') : '—'}</b><span>${rt ? (rt.ok ? 'nothing in the way' : esc(retakeWhy(rt))) : ''}</span></div></div>`;
  /* The page is a form (Croix, 24 Oct 2026, with a mock-up: "see how much the borders and boxes complement the data
     and make it easier to understand"): a title block, grey cards, each section a boxed panel with a header bar, and
     the plan as a box of its own. The header bars are light grey (Croix, 25 Oct 2026: "the bars are dark. We can reduce
     or eliminate the darkness"). */
  const panel = (title, body, cls, attrs) => `<div class="panel ${cls || ''}"${attrs || ''}><div class="ph">${title}</div><div class="pbody">${body}</div></div>`;
  /* Retakes, inside "Do this week" (25 Oct 2026: the separate "Retake this week" box said the same thing as the plan,
     with a different number). Croix's notice stays: eligible students come to HOWL on Wednesday or Thursday and tell
     the teacher they would be with; the days now carry their dates, there is a way to ask for another time, and the
     score to aim for comes first, a full score second. Retakes may be taken more than once, and a 79.5 is an 80, a B
     (Croix, 25 Oct 2026), so a retake is offered while it can still raise the grade. */
  const teacher = state.settings.teacherName || 'your math teacher';
  const retakeStep = qp && !qp.top ? qp.plan.find(x => x.kind === 'retake') : null;
  const nextUp = r ? NEXT_UP.find(([tt]) => r.rounded < tt) : null;
  const aimFor = a => { let at = null; if (nextUp) for (let v = Math.ceil((Number(a.values[i]) || 0) * 2) / 2; v <= a.max; v += 0.5) { const gg = computeGrade(s, i, { [a.name]: v }); if (gg && gg.rounded >= nextUp[0]) { at = { v, g: gg }; break; } } return { at, full: computeGrade(s, i, { [a.name]: a.max }) }; };
  const extra = !retakeStep && better.length ? (() => { const a = better[0].a; const m = aimFor(a);
    return `<p class="lead">Retake <b>${esc(a.name)}</b>: ${m.at ? `${fmtN(m.at.v)}/${a.max} or better takes your grade to <b>${m.at.g.rounded}% ${m.at.g.letter}</b>; a full score, ${m.full.rounded}% ${m.full.letter}` : `a full score takes your grade to <b>${m.full.rounded}% ${m.full.letter}</b>`}.${better.length > 1 ? ` <small>${plural(better.length - 1, 'more assessment')} can be retaken too.</small>` : ''}</p>`; })() : '';
  const howlDays = (() => { const mon = new Date(weekOf(localDay(new Date().toISOString())) + 'T12:00:00'); const now = new Date(); now.setHours(12, 0, 0, 0); if (mon.getTime() + 2 * 864e5 < now.getTime()) mon.setDate(mon.getDate() + 7);   // Wednesday gone: next week's
    return [2, 3].map(d => new Date(mon.getTime() + d * 864e5).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })); })();
  const howl = rt && rt.ok && (retakeStep || better.length) ? `<div class="howl"><p><b>Retakes:</b> you are eligible (${esc(retakeOkWhy(rt))}). Come to ${esc(teacher)}'s room during HOWL on <b>${esc(howlDays[0])}</b> or <b>${esc(howlDays[1])}</b>. Tell the teacher whose HOWL you would be in that you are with ${esc(teacher)}, in person or by Focus message. Need another time? Tell ${esc(teacher)}.</p>
      <p class="ticks"><span><span class="box"></span> I told my HOWL teacher</span><span><span class="box"></span> I came Wednesday</span><span><span class="box"></span> I came Thursday</span><span><span class="box"></span> I need another time</span></p></div>` : '';
  const rtLine = rt && !howl ? `<p class="rt"><b>Retakes:</b> ${rt.ok ? `eligible: ${esc(retakeOkWhy(rt))}.` : `not yet. To retake: ${esc(retakeWhy(rt, true))}.`}</p>` : '';
  // ---- tests and quizzes: the overall figure in the header, each one listed ----
  const testPct = (() => { const e = tests.reduce((n, a) => n + (a.status[i] === 'score' ? Number(a.values[i]) || 0 : 0), 0), p = tests.reduce((n, a) => n + a.max, 0); return p ? Math.round(e / p * 100) : null; })();
  // ---- the back: every missing assignment, then the IXL still owed (Croix, 25 Oct 2026: "move missing assignments and
  // ixls on the back page"). Each assignment has a box and what turning it in does, the biggest first. ----
  const missRows = missing.map(a => { const isIxl = /\bixl\b/i.test(a.name); return { a, isIxl, res: isIxl ? null : computeGrade(s, i, { [a.name]: a.max }) }; }).sort((x, y) => (y.res ? y.res.pct : -1) - (x.res ? x.res.pct : -1));
  const missPanel = panel(`Missing assignments${missing.length ? ` <span class="hs">${plural(missing.length, 'assignment')} · ${plural(missing.reduce((n, a) => n + (a.max || 0), 0), 'point')}</span>` : ''}`,
    missing.length ? `<table><tbody data-items>${missRows.map(m => `<tr><td><span class="box"></span> <b>${esc(m.a.name)}</b> <small>${m.a.max} pts${m.a.due ? ' · was due ' + esc(m.a.due) : ''}</small></td><td class="r">${m.isIxl ? 'do the IXL skills' : `turned in ${arrow(m.res)}`}</td></tr>`).join('')}</tbody></table>` : '<p>None. Every assignment is turned in.</p>', 'miss', ' data-newpage');
  // ---- the plan box: "This week I will" on full lines; the last plan's check only when there was a report before ----
  const priorRep = ((s0.reportLog || {})[norm(name)] || []).filter(e => weekOf(e.date) < thisWeek).pop() || null;
  const prevWeek = (() => { const d = new Date(thisWeek + 'T12:00:00'); d.setDate(d.getDate() - 7); return localDayOf(d.toISOString()); })();
  const lastPlan = priorRep ? `<div class="lastplan"><b>${weekOf(priorRep.date) === prevWeek ? 'Last week\'s plan' : `My plan from ${esc(fmtDate(priorRep.date))}`}</b><span class="box"></span> done <span class="box"></span> partly <span class="box"></span> not yet</div>` : '';
  /* ---- the next test, under the tests and quizzes (Croix, 25 Oct 2026: "use the space on the front to add in a test
     reminder of when the next scheduled test is"): the course's next test from Settings → Course → Test dates, its
     day and its unit. A name left blank in the dates takes the IXL unit's. (The line on the unit's IXL that sat under
     it went the same day, at his word.) ---- */
  const nt = nextTest(s0.prep, todayISO()); const ntNums = nt ? testUnitNums(nt.unit) : [];
  const ntTitle = nt ? nt.title || (ntNums.length === 1 ? (unitsOf(s).find(u => u.num === ntNums[0]) || {}).title || '' : '') : '';
  const nextPanel = nt ? panel('Next test', `<p class="ntd">${esc(testDays(nt))}</p><p class="ntu"><b>${esc(nt.unit)}</b>${ntTitle ? ` ${esc(ntTitle)}` : ''}</p>`, 'next') : '';
  /* The signatures: two lines each, no box, at the foot of the front (Croix, 25 Oct 2026: "take the signatures out of
     the box, move it to the bottom, and give more space"). data-bottom: the print layout sets it at the bottom of the
     report's first page. */
  const sigs = `<div class="sigs" data-bottom>${[['Student signature', 'Date'], ['Parent or guardian signature', 'Date']].map(([a, d]) => `<div class="sr"><div class="f"><i></i><small>${a}</small></div><div class="f d"><i></i><small>${d}</small></div></div>`).join('')}</div>`;
  return `<section class="rep wk"><div class="head"><div class="title"><div class="course">${esc(s.label)} · ${esc(Q_NAMES[liveQuarter(s0) - 1])}</div><div class="badge">Weekly progress report</div></div><div class="who"><h1>${esc(name)}</h1><div class="meta">${esc(new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }))} <small>· Focus as of ${esc(fmtDate(localDayOf(gbAt)))}${ixlRow && ixlRow.ixl != null && dataDate(s) ? ` · IXL as of ${esc(fmtDate(dataDate(s)))}` : ''}</small></div></div></div>${since}
    <div class="top"><div class="gradeBox"><div class="big">${r ? `${r.rounded}%<small>${r.letter}</small>` : '—'}</div>${r ? '' : `<p>${anyClosed() && !gb.assignments.length ? `No ${esc(Q_NAMES[currentQuarter() - 1])} grades in Tally yet.` : 'Nothing graded yet this quarter.'}</p>`}
      <table class="cats"><tbody>${g.cats.map(c => { const x = r && r.cats[c.name]; return `<tr><td>${esc(c.name)} <small>(${c.w}%)</small></td><td class="r">${x && x.possible ? `${+x.earned.toFixed(1)} / ${x.possible}` : '—'}</td><td class="r">${x && x.pct != null ? Math.round(x.pct) + '%' : '—'}</td></tr>`; }).join('')}</tbody></table></div>${scoreboard}</div>
    ${panel('Do this week', `${doThis}${extra}${howl}${rtLine}`, 'main')}
    <div class="two"><div class="col">${panel(`Tests &amp; quizzes${testPct != null ? ` <span class="hs">${testPct}% overall${tests.some(a => a.status[i] === 'missing') ? ' · NHI counts as 0' : ''}</span>` : ''}`, testsTable)}${nextPanel}</div>${panel('What would move the grade', moves ? `<table><tbody>${moves}</tbody></table>` : `<p>${r ? `Nothing missing${belowFull ? '' : ' and every assessment at full marks'}.` : 'Nothing graded yet.'}</p>`)}</div>
    <div class="pledge"><b>This week I will</b><div class="lines"><i></i><i></i><i></i></div>${lastPlan}</div>
    ${sigs}
    ${missPanel}
    ${ixl}
</section>`;
}
// A report that prints is remembered, so the next one can say what moved (grade, missing work, IXL skills).
function logReport(s0, i, ixlRow) {
  const s = openSec(s0); const gb = s.grades; if (!gb) return; const name = gb.students[i]; const r = computeGrade(s, i);
  const units = unitsOf(s).filter(u => u.assigned && u.total && !unitClosed(s, u)); const ixl = ixlRow && ixlRow.ixl != null ? units.reduce((n, u) => n + points(s, u, ixlRow.ixl), 0) : null;
  const gbAt = gb.exportedAt || gb.importedAt || '';
  const entry = { date: localDay(new Date().toISOString()), q: liveQuarter(s0), gb: localDayOf(gb.importedAt) || '', ...(gbAt ? { gbAt } : {}), ix: dataDate(s) || '', grade: r && r.rounded != null ? r.rounded : null, missing: gb.assignments.filter(a => a.status && a.status[i] === 'missing').length, ixl };
  // One entry per school week: a reprint or a second look the same week replaces that week's entry and keeps its
  // "back, signed" tick (audit, 25 Oct 2026: reopening a report wiped the tick). A cleared list is not carried over:
  // a report printed after Clear starts the new list.
  s0.reportLog = s0.reportLog || {}; const k = norm(name); const wk = weekOf(entry.date); const old = s0.reportLog[k] || [];
  const same = old.filter(e => weekOf(e.date) === wk); const back = same.map(e => e.back).filter(Boolean).pop(); if (back) entry.back = back;
  const list = old.filter(e => weekOf(e.date) !== wk); list.push(entry); list.sort((a, b) => a.date.localeCompare(b.date)); s0.reportLog[k] = list.slice(-12);
}
/* Two-sided printing (Croix, 25 Oct 2026: "I do print 2 sided"). Chrome ignores `break-before: right`, so a print page
   lays itself out when it opens: each report's blocks go into page-sized boxes (a long IXL list or checklist splits
   between rows, its header carried over and marked "continued"), and a report that ends on a front gets a blank back,
   so the next student starts on a new sheet and no sheet goes home with two students on it. What is laid out is what
   prints: every box is shorter than the printable page. Backs mirror the margin, so the punch holes stay clear on both
   sides. One-sided printing (the box in Print unticked) lays out the same pages, with no blank backs and the punch
   margin on the left of every page: the signatures sit at the foot of the front either way (25 Oct 2026). */
const PAGE_H = 940;   // px: a Letter page less its .45in top and bottom margins is 969.6 px tall; the rest is slack
const duplexOn = () => state.settings.duplex !== false;
const PAGED_CSS = `@page{size:letter;margin:.45in .45in .45in 1in}
body.paged{margin:0!important}.paged [data-newpage]{break-before:auto!important;page-break-before:auto!important}.paged>section{padding:0!important;margin:0!important;break-after:auto!important;page-break-after:auto!important}
.paged .page{box-sizing:content-box;width:676.8px;height:${PAGE_H}px;overflow:hidden;position:relative}
.panel.ixl.cont>.ph .hs,.panel.ixl.cont .keyline{display:none}.panel.ixl.cont>.ph:after{content:" (continued)";text-transform:none;letter-spacing:0;font-weight:normal}.u.cont>.uh>span:first-child:after{content:" (continued)";font-weight:normal;color:#444}
@media screen{body.paged{background:#d6d6d6;padding:10px 0 70px}.paged .page{background:#fff;margin:14px auto;padding:.45in .45in calc(.45in + ${(969.6 - PAGE_H).toFixed(1)}px) 1in;box-shadow:0 1px 5px rgba(0,0,0,.3)}.paged .page.blank:after{content:"Back of the sheet: blank";position:absolute;top:46%;left:0;right:0;text-align:center;color:#aaa;font-size:10pt}}
@media print{.paged .page{break-after:page;page-break-after:always}.paged .page.last{break-after:auto;page-break-after:auto}}
.paged:not([data-paged])>section{visibility:hidden}@media screen{.paged:not([data-paged]):before{content:"Laying out the pages…";position:fixed;top:40%;left:0;right:0;text-align:center;font-size:12pt;color:#555}}`;
const DUPLEX_CSS = `@page :left{margin:.45in 1in .45in .45in}@media screen{.duplex .page.back{padding-left:.45in;padding-right:1in}}`;   // the back's mirrored punch margin
const PAGER_JS = `(function(){
var B=document.body,doPrint=window.print.bind(window),ready=null;
window.print=function(){var go=function(){doPrint()};(ready||Promise.resolve()).then(go,go)};   /* Print waits for the layout */
function mk(c){var d=document.createElement('div');d.className=c;return d}
function over(p){return p.scrollHeight>p.clientHeight+1}
function box(e){return e.nodeType!==1?null:e.hasAttribute('data-items')?e:e.querySelector('[data-items]')}
function items(c){return [].filter.call(c.children,function(x){return !x.hasAttribute('data-keep')})}
function split(el,parent,page){var c=box(el);if(!c||!items(c).length)return null;
var cp=el.cloneNode(true),cc=box(cp);items(cc).forEach(function(x){cc.removeChild(x)});
parent.appendChild(cp);if(over(page)){parent.removeChild(cp);return null}
var n=0;while(items(c).length){var it=items(c)[0],nx=it.nextSibling;cc.appendChild(it);if(!over(page)){n++;continue}
cc.removeChild(it);c.insertBefore(it,nx);if(box(it)){var r=split(it,cc,page);if(r){n++;if(!r.rest)c.removeChild(it)}}break}
if(!n){parent.removeChild(cp);return null}
if(items(c).length){el.classList.add('cont');return {rest:el}}return {rest:null}}
/* [data-bottom] (the signatures) sits at the foot of the section's first page: its height is kept free there while
   the rest is laid out, then it goes in last and is pushed down to the bottom edge. [data-newpage] starts the back: a
   new page, unless the front has already run onto one. */
function layout(sec){var bl=[].slice.call(sec.children),pages=[],p,bot=null;bl.forEach(function(b){sec.removeChild(b)});
bl=bl.filter(function(b){if(!bot&&b.hasAttribute('data-bottom')){bot=b;return false}return true});
function next(){p=mk('page');sec.appendChild(p);pages.push(p)}next();var first=p;
if(bot){first.appendChild(bot);var bh=Math.ceil(bot.getBoundingClientRect().height);first.removeChild(bot);first.style.height=Math.max(0,${PAGE_H}-bh)+'px'}
bl.forEach(function(b){if(b.hasAttribute('data-newpage')&&p.children.length&&pages.length<2)next();var rest=b,g=0;while(rest&&g++<500){p.appendChild(rest);if(!over(p)){rest=null;break}
p.removeChild(rest);var r=split(rest,p,p);if(r){rest=r.rest;if(rest)next();continue}
if(!p.children.length){p.appendChild(rest);rest=null;break}next()}});
if(bot){first.style.height='';first.appendChild(bot);if(over(first)){first.removeChild(bot);if(pages.length<2)next();pages[1].insertBefore(bot,pages[1].firstChild)}
else{var gap=Math.floor(first.getBoundingClientRect().top+(parseFloat(getComputedStyle(first).paddingTop)||0)+${PAGE_H}-bot.getBoundingClientRect().bottom)-2;
if(gap>0){bot.style.position='relative';bot.style.top=gap+'px';if(over(first)){bot.style.position='';bot.style.top=''}}}}
return pages}
function run(){if(B.getAttribute('data-paged'))return;
var secs=[].slice.call(document.querySelectorAll('body>section')),keep=secs.map(function(s){return s.cloneNode(true)}),dup=B.classList.contains('duplex');
try{secs.forEach(function(s,i){var pg=layout(s);if(dup&&pg.length%2&&i<secs.length-1)s.appendChild(mk('page blank'))});
var all=document.querySelectorAll('.page');[].forEach.call(all,function(x,k){if(dup&&k%2)x.classList.add('back')});if(all.length)all[all.length-1].classList.add('last')}
catch(e){secs.forEach(function(s,i){s.parentNode.replaceChild(keep[i],s)});B.classList.remove('paged','duplex');var h=document.querySelector('.bar .hint');if(h)h.textContent=/class/.test(h.textContent)?'Print one-sided so no sheet holds two classes.':'Print one-sided so no sheet holds two students.';if(window.console)console.error(e)}   /* the browser's own page breaks, rather than a half-laid page */
B.setAttribute('data-paged','1')}
ready=window.__paged=(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(run,run);
})();`;
// The report window's Print button, with the one thing to set in the print dialog for a batch: two-sided when the
// pages were laid out for it, one-sided otherwise (two-sided would put the next student on the back of a sheet).
const printBar = (n, what = 'student') => `<div class="bar">${n > 1 ? `<span class="hint">${duplexOn() ? `Print two-sided: each ${what} starts on a new sheet.` : `Print one-sided so no sheet holds two ${what === 'class' ? 'classes' : 'students'}.`}</span>` : ''}<button onclick="window.print()">Print</button></div>`;
// A whole print page: its styles, the Print bar and the layout script; two-sided adds the blank backs and mirrored margins.
function printDoc(title, css, body, n, what) {
  const dup = duplexOn();
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${printFontCss()}</style><style>${css}${PAGED_CSS}${dup ? DUPLEX_CSS : ''}</style></head><body class="paged${dup ? ' duplex' : ''}">${printBar(n, what)}${body}<script>${PAGER_JS}<\/script></body></html>`;
}
// One student's section, or a plain line in its place: one student's odd data never blanks the whole batch.
function safeSection(make, name, failed) { try { return make(); } catch (e) { console.error(e); failed.push(name); return `<section class="rep"><h1>${esc(name)}</h1><p>Tally could not make this report.</p></section>`; } }
function printStudentReports(s, indices, title) { printWeekly([{ s, indices }], title); }
/* A batch is one or more classes, each its students then its "Reports out and back" page (Croix, 25 Oct 2026: "a way
   to print all classes in one go"). Every class's exports are checked before printing. */
function printWeekly(groups, title) {
  groups = groups.filter(g => g.s && g.s.grades && g.indices.length); const n = groups.reduce((a, g) => a + g.indices.length, 0); if (!n) return;
  const failed = [], made = [];
  const body = groups.map(g => { const rows = gbRows(g.s);
    return g.indices.map(i => { const k = failed.length; const h = safeSection(() => studentReportSection(g.s, i, rows[i]), g.s.grades.students[i], failed); if (failed.length === k) made.push([g.s, i, rows[i]]); return h; }).join('')
      + (n > 1 ? safeSection(() => returnChecklist(g.s, g.indices), 'Reports out and back', failed) : ''); }).join('');
  const html = printDoc(title, REPORT_CSS, body, n);
  const go = () => { made.forEach(([s, i, row]) => logReport(s, i, row)); save(); openPrint(html, (n === 1 ? 'Student-report' : title.replace(/[^\w-]+/g, '_')) + '.html', n === 1);   // one student's report: a file name without the name; the log is written only for a report that opens
    if (failed.length) toast(`${plural(failed.length, 'report')} could not be made: ${failed.slice(0, 3).map(x => shown(x)).join('; ')}${failed.length > 3 ? '…' : ''}.`, true, 6000); };
  const old = groups.length === 1 ? staleExports(groups[0].s, groups[0].indices) : staleAcross(groups);
  const why = [...old, ...(state.settings.hideNames ? [`names are hidden, but the ${n === 1 ? 'report opens with the student\'s full name and grades' : 'reports open with every student\'s full name and grades'} on screen`] : [])];   // projected: say so first (audit)
  if (why.length) { ask(`Before printing: ${why.join('; ')}.${old.length ? ' A weekly report wants today\'s numbers.' : ''} Print anyway?`, 'Print anyway').then(ok => { if (ok) go(); }); return; }
  go();
}
// Several classes' old exports, said once each: "the IXL export is from Oct 20, 5 days ago (every class)".
function staleAcross(groups) {
  const by = new Map(); groups.forEach(g => staleExports(g.s, g.indices).forEach(m => { if (!by.has(m)) by.set(m, []); by.get(m).push(g.s.label); }));
  return [...by].map(([m, labels]) => `${m} (${labels.length === groups.length ? 'every class' : labels.join(', ')})`);
}
/* Croix (24 Oct 2026): "remind me to update if it's been too long before generating the weekly report", then "tighter.
   Like Monday morning print should have a Monday morning grade and ixl updates": a weekly report wants today's Focus
   gradebook and today's IXL export, so anything older is named before printing. */
function staleExports(s0, indices) {
  const s = openSec(s0); const gb = s.grades; const out = [];
  const when = d => { const n = ageDays(d); return n === 1 ? 'yesterday' : `${fmtDate(d)}, ${plural(n, 'day')} ago`; };
  const gbDay = localDayOf(gb.exportedAt || gb.importedAt) || '', ixDay = dataDate(s) || '';   // the day Focus wrote the file: Friday's export imported on Monday is Friday's numbers
  if (gbDay && ageDays(gbDay) > 0) out.push(`the Focus gradebook in Tally is from ${when(gbDay)}`);
  if (s.students.length && ixDay && ageDays(ixDay) > 0) out.push(`the IXL export is from ${when(ixDay)}`);
  return out;
}
// The last page of a batch: the teacher's list for holding students to getting the report signed and back (Croix,
// 24 Oct 2026: "a checklist or something as a separate page at the end of the print so that I can hold them
// responsible for getting their progress report signed by parent and turned back in to me").
function returnChecklist(s0, indices) {
  const s = openSec(s0); const gb = s.grades; const today = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const rows = indices.map((i, n) => { const r = computeGrade(s, i); const miss = gb.assignments.filter(a => a.status && a.status[i] === 'missing').length;
    return `<tr><td class="r">${n + 1}</td><td>${esc(gb.students[i])}</td><td class="r">${r && r.rounded != null ? `${r.rounded}% ${r.letter}` : '—'}</td><td class="r">${miss || ''}</td><td class="c"><span class="box"></span></td><td class="c"><span class="box"></span></td><td class="w"></td><td class="w"></td></tr>`; }).join('');
  return `<section class="rep wk teach"><div class="head"><div class="title"><div class="course">${esc(s.label)} · ${esc(Q_NAMES[liveQuarter(s0) - 1])}</div><div class="badge">Reports out and back</div></div><div class="who"><h1>${plural(indices.length, 'report')} handed out ${esc(today)}</h1><div class="meta">Tick when each report goes home and again when it comes back signed. Keep this page.</div></div></div>
    <table class="ret"><thead><tr><th></th><th>Student</th><th class="r">Grade</th><th class="r">Missing</th><th class="c">Handed out</th><th class="c">Back, signed</th><th>Date back</th><th>Note</th></tr></thead><tbody data-items>${rows}</tbody></table></section>`;
}
function printStudentCard(s, i) { printStudentReports(s, [i], `${s.grades.students[i]}: report`); }
/* Everything a class prints, in one place (Croix, 24 Oct 2026: batches "by class … as well as by class average, so if
   I only wanted to print reports for my c, d, and f students"; then "take a critical look at the way to pull up
   reports"): the Print button on the class bar opens it. One page per student (pick who, then weekly or FAST), and
   the IXL still-owed slips and lists. The student page prints one student's report on its own. Croix, 25 Oct 2026:
   "I do print 2 sided. I'd also like a way to print all classes in one go": the menu covers this class or every
   class (each class's reports, then its checklist), and remembers two-sided printing (on unless he unticks it). */
var reportWho = { mode: 'all', letters: ['C', 'D', 'F'], scope: 'class' };
const printClasses = () => state.order.map(k => state.sections[k]).filter(x => x && !x.board && !x.placeholder);
function openPrintMenu(s) {
  const classes = printClasses(); const many = classes.length > 1; if (!many) reportWho.scope = 'class';
  const allMode = reportWho.scope === 'all'; const secs = allMode ? classes : [s];
  const open = sec => unitsOf(sec).filter(u => u.assigned && u.total && !unitClosed(sec, u));
  const info = secs.map(sec => { const gb = sec.grades; if (!gb || !hasOpenGrades(sec)) return { sec, have: false };
    const rows = gbRows(sec); const og = openSec(sec); const ogb = og.grades; const us = open(sec);
    return { sec, have: true, n: gb.students.length,
      owes: gb.students.map((_, i) => ogb.assignments.some(a => a.status && a.status[i] === 'missing') || !!(rows[i] && rows[i].ixl != null && us.some(u => points(sec, u, rows[i].ixl) < totalFor(sec, u, rows[i].ixl)))),
      letterOf: gb.students.map((_, i) => { const r = computeGrade(og, i); return r && r.rounded != null ? r.letter : '—'; }),
      hasFast: gb.students.map(nm => testHistory(sec, nm).some(h => /FAST/i.test(h.test) && h.scale != null)) }; });
  const graded = info.filter(x => x.have); const sum = f => graded.reduce((n, x) => n + f(x), 0);
  const LETTERS = ['A', 'B', 'C', 'D', 'F', '—'];
  const pick = x => x.letterOf.map((_, i) => i).filter(i => reportWho.mode === 'all' || (reportWho.mode === 'owes' ? x.owes[i] : reportWho.letters.includes(x.letterOf[i])));
  const q = Q_NAMES[currentQuarter() - 1];
  const scope = many ? `<div class="seg rpScope" id="rpScope"><button data-scope="class" aria-pressed="${!allMode}">${esc(s.label)}</button><button data-scope="all" aria-pressed="${allMode}">All classes <small>${classes.length}</small></button></div>` : '';
  const perStudent = graded.length ? `<div class="field"><div class="seg" id="rpWho"><button data-who="all" aria-pressed="${reportWho.mode === 'all'}">Everyone <small>${sum(x => x.n)}</small></button><button data-who="owes" aria-pressed="${reportWho.mode === 'owes'}">Owe work <small>${sum(x => x.owes.filter(Boolean).length)}</small></button><button data-who="letters" aria-pressed="${reportWho.mode === 'letters'}">By grade</button></div>
      <div class="rpLetters ${reportWho.mode === 'letters' ? '' : 'hidden'}">${LETTERS.map(L => `<button class="chip ${reportWho.letters.includes(L) ? 'on' : ''}" data-letter="${L}" aria-pressed="${reportWho.letters.includes(L)}">${L === '—' ? 'No grade yet' : L} <small>${sum(x => x.letterOf.filter(y => y === L).length)}</small></button>`).join('')}</div></div>
      <div class="rp-actions col"><button class="pill" id="rpWeekly">Weekly report <small></small></button><button class="pill pale" id="rpFast">FAST report <small></small></button></div>${allMode && graded.length < secs.length ? `<p class="ghint">${plural(secs.length - graded.length, 'class')} without ${esc(q)} grades in Tally ${secs.length - graded.length === 1 ? 'is' : 'are'} left out.</p>` : ''}`
    : `<p class="ghint">${allMode ? `No class has ${esc(q)} grades in Tally yet.` : s.grades ? `No ${esc(q)} grades in Tally yet: weekly and FAST reports start with the first ${esc(q)} gradebook.` : 'Import this class\'s Focus gradebook first: the weekly and FAST reports need the grade.'}</p>`;
  const owedSecs = secs.filter(x => x.students && x.students.length);
  const owed = owedSecs.length ? `<div class="rp-actions col">
        <button class="pill pale" data-owed="slips">Slips to hand out <small>one page per student · full names</small></button>
        <button class="pill pale" data-owed="initials">${allMode ? 'A list per class' : 'One list'}, initials <small>safe to post or project</small></button>
        <button class="pill pale" data-owed="names">${allMode ? 'A list per class' : 'One list'}, full names <small>for you or a co-teacher</small></button></div>` : `<p class="ghint">${allMode ? 'No IXL exports yet.' : 'No IXL export for this class yet.'}</p>`;
  const m = $('#modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="panel narrow"><header><h2>Print · ${allMode ? 'All classes' : esc(s.label)}</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body one">${scope}
      <h3 class="subh">One page per student</h3>${perStudent}
      <h3 class="subh">IXL still owed</h3>${owed}
      <label class="rpDuplex"><input type="checkbox" id="rpDuplex" ${duplexOn() ? 'checked' : ''}> Two-sided printing</label></div></div>`;
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.querySelectorAll('[data-scope]').forEach(b => b.onclick = () => { if (reportWho.scope === b.dataset.scope) return; reportWho.scope = b.dataset.scope; openPrintMenu(s); });
  $('#rpDuplex').onchange = e => { state.settings.duplex = e.target.checked; save(); };
  m.querySelectorAll('[data-owed]').forEach(b => b.onclick = () => { const mode = b.dataset.owed; close(); printStillOwed(owedSecs, mode); });
  if (!graded.length) return;
  const where = allMode ? 'All classes' : s.label;
  const refresh = () => { const n = sum(x => pick(x).length), f = sum(x => pick(x).filter(i => x.hasFast[i]).length);
    $('#rpWho').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.who === reportWho.mode))); $('.rpLetters').classList.toggle('hidden', reportWho.mode !== 'letters');
    m.querySelectorAll('[data-letter]').forEach(b => { const on = reportWho.letters.includes(b.dataset.letter); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    $('#rpWeekly').disabled = !n; $('#rpWeekly small').textContent = `${plural(n, 'student')}${allMode ? `, ${plural(graded.filter(x => pick(x).length).length, 'class')}` : ''} · grade, what moved, this week's list, pledge`; $('#rpFast').disabled = !f; $('#rpFast small').textContent = f ? `${plural(f, 'student')}${f < n ? ' with FAST results' : ''} · levels, targets, goal box` : 'no FAST results among them'; };
  $('#rpWho').querySelectorAll('button').forEach(b => b.onclick = () => { reportWho.mode = b.dataset.who; refresh(); });
  m.querySelectorAll('[data-letter]').forEach(b => b.onclick = () => { const L = b.dataset.letter; reportWho.letters = reportWho.letters.includes(L) ? reportWho.letters.filter(x => x !== L) : [...reportWho.letters, L]; refresh(); });
  const whoWord = () => reportWho.mode === 'all' ? '' : reportWho.mode === 'owes' ? ' (owe work)' : ` (${reportWho.letters.filter(L => L !== '—').join(', ')})`;
  $('#rpWeekly').onclick = () => { const groups = graded.map(x => ({ s: x.sec, indices: pick(x) })); close(); printWeekly(groups, `Student reports: ${where}${whoWord()}`); };
  $('#rpFast').onclick = () => { const groups = graded.map(x => ({ sec: x.sec, names: pick(x).filter(i => x.hasFast[i]).map(i => x.sec.grades.students[i]) })); close(); printFast(groups, `FAST reports: ${where}${whoWord()}`); };
  refresh();
}
const openStudentReports = openPrintMenu;

// Asked at import for new assignments the Focus fit couldn't prove. One dropdown per assignment, already on Tally's
// guess; only a row you change becomes yours (locked); the rest are checked ('ok'), still free for a later Focus export
// to prove. "Decide later" leaves them unchecked. Round 7 (Croix, 23 Oct): rows of pills took stray taps, and Apply
// locked every row at once.
function askCategories(sec, names, fit) {
  const g = gradingFor(sec.prep); const course = courseWord(sec.prep);
  return new Promise(resolve => {
    const m = $('#modal'); m.classList.remove('hidden');
    const why = fit && fit.exact ? 'Focus\'s grades proved every other assignment. These fit more than one category without changing anyone\'s grade.' : sec.grades.overall ? 'Tally couldn\'t prove these from the Focus Grade column, so it guessed from the names.' : 'This export has no Grade column, so these are guesses from the names.';
    m.innerHTML = `<div class="panel narrow"><header><h2>Check ${names.length === 1 ? 'this category' : `${names.length} categories`}</h2><button id="mClose" aria-label="Close">×</button></header>
      <div class="body one"><p>${why} Change only the ones that are wrong.</p>
        <table class="checkTable askcat"><tbody>${names.map((n, k) => `<tr data-row="${k}"><td>${esc(n)}</td><td><select data-ask="${k}" aria-label="Category for ${esc(n)}">${g.cats.map(c => `<option ${g.map[n] === c.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>
        <p class="ghint" id="askSum">Every ${esc(course)} class uses these.</p>
        <div class="rp-actions"><button class="pill" id="askApply">Save</button><button class="pill pale" id="mCancel">Decide later</button></div></div></div>`;
    const done = () => { m.classList.add('hidden'); m.innerHTML = ''; resolve(); };
    m._cancel = done; $('#mClose').onclick = done; $('#mCancel').onclick = done; m.onclick = e => { if (e.target === m) done(); };
    const changed = () => [...m.querySelectorAll('[data-ask]')].filter(sel => sel.value !== g.map[names[Number(sel.dataset.ask)]]);
    const mark = () => { m.querySelectorAll('[data-row]').forEach(tr => tr.classList.remove('changed')); const ch = changed(); ch.forEach(sel => sel.closest('tr').classList.add('changed'));
      $('#askSum').textContent = ch.length ? `${ch.length} changed. Saving changes ${ch.length === 1 ? 'it' : 'them'} in every ${course} class.` : `Every ${course} class uses these.`; $('#askApply').textContent = ch.length ? `Save ${ch.length} ${ch.length === 1 ? 'change' : 'changes'}` : 'Looks right'; };
    m.querySelectorAll('[data-ask]').forEach(sel => sel.onchange = mark); mark();
    $('#askApply').onclick = () => { const ch = new Set(changed().map(sel => { const n = names[Number(sel.dataset.ask)]; g.map[n] = sel.value; g.how[n] = 'user'; return n; }));
      names.forEach(n => { if (!ch.has(n) && g.map[n] && (!g.how[n] || g.how[n] === 'guess')) g.how[n] = 'ok'; }); done(); };
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
  const sum = () => { const t = [...m.querySelectorAll('[data-w]')].reduce((a, el) => a + (Number(el.value) || 0), 0); $('#wsum').textContent = t === 100 ? 'Adds up to 100.' : `Adds up to ${t}: Focus weights normally total 100.`; };
  m.querySelectorAll('[data-w]').forEach(el => el.oninput = sum); sum();
  $('#wSave').onclick = () => { m.querySelectorAll('[data-w]').forEach(el => { g.cats[Number(el.dataset.w)].w = Math.max(0, Number(el.value) || 0); }); state.order.map(k => state.sections[k]).filter(x => x.prep === sec.prep && x.grades).forEach(gradeSnapshot); save(); close(); render(); };
}
