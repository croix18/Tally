/* ---------- conference.js — the Windy Hill "Parent Conference Input Form", filled from Tally (spliced into app.js) ----------
   Croix, 21 Oct 2026: "Can you make it so Tally can generate this for me for whichever student I select?"
   One student at a time, from their page. Tally fills what it knows: current grade, report-card grades, test history,
   missing work, assessments under 70 % and whether a retake is allowed: and drafts Strengths and Concerns from the
   numbers; everything is editable before printing. The two text boxes and the lists are kept per student
   (sec.confForms[norm(name)]) so a second print starts from his edits; the numbers are always read fresh.
   The printed page is a replica of the school's form: its banner and footer are the form's own artwork. */
const CONF_TOP = '/*__CONF_TOP__*/', CONF_FOOT = '/*__CONF_FOOT__*/';
const confRound = v => v == null ? null : Math.round(v + 1e-9);   // report-card averages round half up, as Focus does
const confLines = arr => arr.filter(Boolean).join('\n');

// Report-card grades from the closed quarters' final grades: a semester is the average of its two quarters, rounded
// half up (Croix, 21 Oct 2026: "Average of the two quarters"; no semester exam). A quarter still open is left blank.
function reportCard(finals) {
  const q = {}; (finals || []).filter(x => x.closed && x.g != null).forEach(x => q['Q' + x.q] = x.g);
  const sem = (a, b) => q[a] != null && q[b] != null ? confRound((q[a] + q[b]) / 2) : null;
  return { Q1: q.Q1 ?? null, Q2: q.Q2 ?? null, S1: sem('Q1', 'Q2'), Q3: q.Q3 ?? null, Q4: q.Q4 ?? null, S2: sem('Q3', 'Q4') };
}
// Everything the form needs, read fresh from the class.
// Words a parent reads: "tests and quizzes", never "assessments"; no "pts", no "at goal", no year-long IXL totals.
// (21 Oct 2026, after three reviews of 23 drafts — a teacher's, a data auditor's and a parent's: notebook checks and
// 7-point vocabulary quizzes were praised as "best", the Assessments category, which holds the IXL columns, was
// called a test average, a failed unit test sat beside "strong on assessments", and missing work was counted but
// never said what it costs.)
const REAL_TEST = a => !/notebook|vocab/i.test(a.name) && a.max >= 10;   // a test or quiz that says what a student knows
function conferenceData(sec, name) {
  const f = findStudent(sec, name); const sum = studentSummary(sec, name); const books = studentBooks(sec, name); const openB = books.find(b => !b.closed);
  const r = openB ? computeGrade(openB.s, openB.i) : null;
  const rc = reportCard(sum.finals);   // only closed quarters are report-card grades; a semester averages its two
  const s = openB ? openB.s : null; const gb = s ? s.grades : null; const i = openB ? openB.i : -1;
  const ixlCol = a => /\bixl\b/i.test(a.name);
  const classAvg = a => { const v = []; a.values.forEach((x, j) => { if (a.status && a.status[j] === 'score' && x != null) v.push(Number(x) / a.max * 100); }); return v.length >= 3 ? v.reduce((p, q) => p + q, 0) / v.length : null; };
  const all = gb ? gb.assignments.filter(a => a.max > 0) : [];
  const missingAll = all.filter(a => a.status && a.status[i] === 'missing' && !ixlCol(a));
  const missing = missingAll.filter(a => !isAssess(s, a)).map(a => ({ name: a.name, max: a.max, due: a.due || '', cat: catIn(s, a) }));
  const missedTests = missingAll.filter(a => isAssess(s, a)).map(a => ({ name: a.name, max: a.max, due: a.due || '' }));
  const tests = gb ? all.filter(a => isAssess(s, a) && a.status && a.status[i] === 'score' && a.values[i] != null).map(a => ({ name: a.name, v: Number(a.values[i]), max: a.max, pct: Number(a.values[i]) / a.max * 100, real: REAL_TEST(a), unit: /\b(unit|module)\b.*\b(assessment|test|exam)\b|\b(assessment|test|exam)\b/i.test(a.name) && !/quiz/i.test(a.name), avg: classAvg(a), due: a.due || '' })) : [];
  const redo = tests.filter(t => confRound(t.pct) < 70);
  const graded = gb ? all.filter(a => a.status && (a.status[i] === 'score' || a.status[i] === 'missing') && catIn(s, a) !== 'Participation').length : 0;
  // what turning in every missing assignment and making up every missed test at full credit would do to the grade
  let ifDone = null; if (r && missingAll.length) { const over = {}; missingAll.forEach(a => over[a.name] = a.max); ifDone = computeGrade(s, i, over).rounded; }
  const ifWith = list => { if (!r || !list.length) return null; const over = {}; list.forEach(a => over[a.name] = a.max); return computeGrade(s, i, over).rounded; };
  const ifWork = ifWith(missingAll.filter(a => !isAssess(s, a))), ifTests = ifWith(missingAll.filter(a => isAssess(s, a)));
  // the Focus IXL columns: how much of the grade's IXL is done
  const ixlCols = all.filter(a => ixlCol(a) && a.status && (a.status[i] === 'score' || a.status[i] === 'missing'));
  const ixlGrade = ixlCols.length ? { got: ixlCols.reduce((p, a) => p + (a.status[i] === 'score' ? Number(a.values[i]) || 0 : 0), 0), max: ixlCols.reduce((p, a) => p + a.max, 0) } : null;
  const prev = s && !s._closed ? prevGradeSnap(s) : null;
  const rt = retakeStatus(sec, name); const ix = ixlFor(sec, f.ixl);
  const first = state.settings.hideNames ? mask(name) : niceName(name).split(' ')[0];
  return { sec, name, first, f, sum, r, q: liveQuarter(sec), rc, missing, missedTests, tests, redo, graded, ifDone, ifWork, ifTests, ixlGrade, prevDate: prev ? prev.date : null, rt, ix, hist: testHistory(sec, name), notes: notesOf(sec, name), cats: r ? r.cats : {} };
}

// Strengths and Concerns as short notes (Croix, 23 Oct 2026: "short notes, but give me space to edit and write in
// stuff"). One fact per line, each with its number, the biggest effect on the grade first; the box keeps room to write.
// Words a parent reads: "tests and quizzes", never "assessments"; no "pts", no "at goal", no year-long IXL totals.
function conferenceDraft(d) {
  const P = v => confRound(v) + '%'; const S = [], C = [];
  const avgOf = t => t.avg != null ? ` (class average ${P(t.avg)})` : '';
  const real = d.tests.filter(t => t.real);
  const unitTests = real.filter(t => t.unit);
  // ---- strengths ----
  const bestUnit = unitTests.slice().sort((a, b) => b.pct - a.pct)[0];
  const bestReal = real.slice().sort((a, b) => b.pct - a.pct || b.max - a.max)[0];
  const stand = t => t && (confRound(t.pct) >= 85 || (confRound(t.pct) >= 75 && t.avg != null && t.pct - t.avg >= 10));
  const best = stand(bestUnit) ? bestUnit : stand(bestReal) ? bestReal : null;
  if (best) S.push(`• ${P(best.pct)} on the ${best.name}${avgOf(best)}`);
  if (d.r && d.r.rounded != null && d.r.rounded >= 85 && d.graded >= 3) S.push(`• ${d.r.rounded}% in the class so far (${d.r.letter})`);
  if (real.length >= 2) { const avg = real.reduce((a, t) => a + t.pct, 0) / real.length; if (confRound(avg) >= 85 && !(best && real.length === 2)) S.push(`• Tests and quizzes average ${P(avg)}`); }
  if (d.r && !d.missing.length && !d.missedTests.length && d.graded >= 3) S.push('• Every assignment turned in');
  if (d.rt.unitDone) S.push(`• Every ${d.rt.unit.short} IXL skill finished`);
  if (d.sum.d != null && d.sum.d >= 3 && d.prevDate && d.r) S.push(`• Grade up ${d.sum.d} points since ${fmtDate(d.prevDate)} (now ${d.r.rounded}%)`);
  // ---- concerns ----
  const now = d.r ? d.r.rounded : null;
  if (d.missing.length) { const k = d.missing.length; const up = d.ifWork != null && now != null && d.ifWork - now >= 1;
    C.push(`• ${k === 1 ? '1 missing assignment' : k + ' missing assignments'}, ${k === 1 ? 'a zero' : 'zeros'} until turned in${up ? ` (grade ${now}% → up to ${d.ifWork}% if turned in)` : ''}`); }
  if (d.missedTests.length) { const k = d.missedTests.length; const up = d.ifTests != null && now != null && d.ifTests - now >= 1;
    C.push(`• ${k === 1 ? `${d.missedTests[0].name} not taken yet` : `${k} tests or quizzes not taken yet`}${up ? ` (grade → up to ${d.ifTests}% once taken)` : ''}`); }
  const low = real.filter(t => confRound(t.pct) < 70).sort((a, b) => a.pct - b.pct);
  if (low.length) { C.push(`• ${P(low[0].pct)} on the ${low[0].name}${avgOf(low[0])}`);
    if (low.length > 1) C.push(`• Also below 70%: ${low.slice(1, 3).map(t => `${t.name} (${P(t.pct)})`).join(', ')}${low.length > 3 ? ` and ${low.length - 3} more` : ''}`); }
  if (d.ixlGrade && d.ixlGrade.max && d.ixlGrade.got / d.ixlGrade.max < 0.6 && now != null && now < 80) C.push(`• IXL in the grade: ${d.ixlGrade.got} of ${d.ixlGrade.max} points so far`);
  if (d.sum.d != null && d.sum.d <= -3 && d.prevDate && now != null) C.push(`• Grade down ${-d.sum.d} points since ${fmtDate(d.prevDate)} (now ${now}%)`);
  if (d.r && d.graded >= 3 && !C.length) C.push('• No concerns right now');   // with only participation graded there is nothing to judge yet
  return { strengths: confLines(S.slice(0, 4)), concerns: confLines(C.slice(0, 4)) };
}
// The third box: what to turn in, what hasn't been taken, the IXL left, what can be retaken, and when a retake opens.
// A retake needs everything caught up first (missing work and the unit's IXL), so that line says exactly what.
function conferenceWork(d) {
  const out = []; const due = a => a.due ? ` (due ${a.due})` : ''; const group = (head, items) => { if (!items.length) return; if (out.length) out.push(''); out.push(head); items.forEach(x => out.push('• ' + x)); };
  group('Turn in (zeros until turned in):', d.missing.map(a => a.name + due(a)));
  group('Not taken yet:', d.missedTests.map(a => a.name + due(a)));
  const ixlUnits = d.redo.length && !d.rt.noIxl ? [...(d.rt.unit && d.rt.short.length ? [{ unit: d.rt.unit, short: d.rt.short }] : []), ...(d.rt.behind || [])] : [];   // listed only when it stands between the student and a retake
  const ixlLeft = ixlUnits.reduce((n, x) => n + x.short.length, 0);
  group('Finish on IXL:', ixlUnits.map(x => `${x.unit.short}: ${plural(x.short.length, 'skill')} left`));
  group('Can be retaken (below 70%):', d.redo.map(t => `${t.name}: ${confRound(t.pct)}%`));
  if (d.redo.length) { const need = [d.rt.missing.length ? 'missing work' : '', ...ixlUnits.map(x => `${x.unit.short} IXL`)].filter(Boolean);
    out.push(d.rt.ok ? 'Retake: allowed now' : `Retake allowed after: ${need.length ? need.join(' + ') : `all work is caught up${d.rt.unit ? `, including ${d.rt.unit.short} IXL` : ''}`}`); }
  return out.join('\n');
}
// Things to look at before printing — shown beside the form, never on it.
function conferenceChecks(d) {
  const out = []; const old = a => { const m = String(a.due || '').match(/^(\d{1,2})\/(\d{1,2})/); if (!m) return false; const now = new Date(); let y = now.getFullYear(); const dt = new Date(y, Number(m[1]) - 1, Number(m[2])); if (dt > now) dt.setFullYear(y - 1); return (now - dt) / 864e5 > 30; };
  if (!d.r) out.push('No gradebook for this student yet.');
  else if (d.graded < 3) out.push('Only participation is graded so far, so there is little to draft from.');
  d.tests.filter(t => t.pct < 20).forEach(t => out.push(`${t.name}: ${fmtN(t.v)} of ${fmtN(t.max)}. An absence or a blank paper?`));
  if (d.rt.noIxl) out.push('IXL isn\'t linked to this student in Tally, so retake readiness on IXL is unknown.');
  [...d.missing, ...d.missedTests].filter(old).forEach(a => out.push(`${a.name} was due ${a.due}. Still accepted?`));
  if (d.r && d.tests.filter(t => t.real).length < 2) out.push('Fewer than two tests or quizzes graded.');
  return out;
}
// FAST / EBA history in one line, newest first: "FAST PM1 2026-27: Level 2, 231 (above grade); FAST PM3 2025-26: Level 4, 247, 81st percentile".
const ordinal = n => { n = Math.round(n); const t = n % 100; return n + (t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'); };
const pctWord = p => p < 1 ? 'below 1st percentile' : ordinal(p) + ' percentile';
function testLine(h) { return `${h.test}${h.pm ? ' ' + h.pm : ''}${h.year ? ' ' + h.year : ''}: ` + [h.level != null ? 'Level ' + h.level : '', h.scale != null ? String(h.scale) : '', h.pct != null ? pctWord(h.pct) : ''].filter(Boolean).join(', ') + (h.above ? ' (above grade)' : h.grade != null ? ` (grade ${h.grade} test)` : ''); }
function conferenceTests(d) { return d.hist.map(testLine).join('; '); }

/* ---------- FAST results ----------
   state.tests    = { key: [{ test: 'FAST', pm: 'PM1', year: '2026-27', level, scale, pct?, grade?, above? }] }
   state.testInfo = { key: { FAST: { fields: { L30: 'Y', ESE: '', Race: …, every other column by its heading }, at, file } } }
   key = 'n:<the roster name, normalized>' (and 'id:<Focus ID>' when the report has one). Kept once for the whole app,
   so a student who changes period keeps their history. Matching is by name, the way IXL rows are matched: the exact
   name, then last name + first name, then last name + a first name that starts the same (Chris / Christopher); the
   report's Student ID settles two students with the same name and a spelling that differs. Teacher-only: hidden while
   names are hidden, never on Show student, never in a Board save. */
const looseName = n => { const m = String(n || '').match(/^([^,]+),\s*(\S+)/); if (m) return norm(m[1]) + '|' + norm(m[2]); const w = norm(n).split(' '); return w.length > 1 ? w[w.length - 1] + '|' + w[0] : norm(n); };
const testKeys = (id, name) => [id ? 'id:' + String(id).trim() : null, name ? 'n:' + norm(name) : null, name ? 'n:' + looseName(name) : null].filter(Boolean);   // the last: saves from before name matching
const testSig = h => [h.test, h.pm || '', h.year || ''].join('|');
function cleanTests(o) {   // a declaration: migrate() runs before this file's consts exist
  const out = {}; if (!o || typeof o !== 'object') return out; const n = v => typeof v === 'number' && isFinite(v) ? v : undefined;
  for (const k of Object.keys(o)) { if (!SAFE_KEY(k) || !/^(id|n):/.test(k) || !Array.isArray(o[k])) continue;
    const list = o[k].filter(h => h && typeof h.test === 'string').slice(-40).map(h => { const x = { test: h.test.slice(0, 20), pm: typeof h.pm === 'string' ? h.pm.slice(0, 6) : '', year: typeof h.year === 'string' ? h.year.slice(0, 9) : '' };
      ['level', 'scale', 'pct', 'grade'].forEach(f => { if (n(h[f]) != null) x[f] = h[f]; }); if (h.above) x.above = true;
      if (h.cats && typeof h.cats === 'object') { const c = {}; Object.keys(h.cats).slice(0, 8).forEach(name => { const v = h.cats[name]; if (typeof name === 'string' && name.length <= 80 && ['below', 'near', 'above'].includes(v)) c[name] = v; }); if (Object.keys(c).length) x.cats = c; }   // the score report's reporting categories
      return x; }).filter(h => h.level != null || h.scale != null);
    if (list.length) out[k.slice(0, 120)] = list; }
  return out;
}
function cleanTestInfo(o) {
  const out = {}; if (!o || typeof o !== 'object') return out;
  for (const k of Object.keys(o)) { if (!SAFE_KEY(k) || !/^(id|n):/.test(k) || !o[k] || typeof o[k] !== 'object') continue; const per = {};
    for (const t of Object.keys(o[k]).slice(0, 8)) { const v = o[k][t]; if (!SAFE_KEY(t) || !v || typeof v !== 'object' || !v.fields || typeof v.fields !== 'object') continue; const fields = {};
      Object.keys(v.fields).slice(0, 80).forEach(f => { if (SAFE_KEY(f) && typeof v.fields[f] === 'string') fields[f.slice(0, 60)] = v.fields[f].slice(0, 80); });
      per[t.slice(0, 20)] = { fields, at: typeof v.at === 'string' ? v.at.slice(0, 30) : '', file: typeof v.file === 'string' ? v.file.slice(0, 120) : '' }; }
    if (Object.keys(per).length) out[k.slice(0, 120)] = per; }
  return out;
}
// A window already on file gains the new fields and keeps the rest (the Focus report brings levels and scales, the
// score report PDF brings percentiles and reporting categories; each fills in what the other lacks).
function mergeTests(a, b) { const out = { ...(a || {}) }; for (const k in b) { const old = out[k] || []; const keep = old.filter(h => !b[k].some(x => testSig(x) === testSig(h))); out[k] = keep.concat(b[k].map(x => { const was = old.find(h => testSig(h) === testSig(x)); return was ? { ...was, ...x, ...(was.cats || x.cats ? { cats: { ...(was.cats || {}), ...(x.cats || {}) } } : {}) } : x; })); } return out; }
// Every student on every roster, for matching an imported report by name.
function rosterPeople() { const out = []; rowCache = new Map(); state.order.forEach(k => { const s = state.sections[k]; if (!s || s.board || s.placeholder) return; classStudents(s).forEach(n => { const f = findStudent(s, n); const m = String(n).match(/^([^,]+),\s*(.+)$/);
  out.push({ name: n, id: f.id ? String(f.id).trim() : '', nn: norm(n), last: m ? norm(m[1]) : norm(n).split(' ').pop(), first: (m ? norm(m[2]) : norm(n)).split(' ')[0] || '' }); }); });
  const seen = new Set(); return out.filter(p => { const k = p.nn + '|' + p.id; if (seen.has(k)) return false; seen.add(k); return true; }); }
function matchPerson(people, name, id) {
  const m = String(name || '').match(/^([^,]+),\s*(.+)$/); const nn = norm(name); const last = m ? norm(m[1]) : nn.split(' ').pop(); const first = (m ? norm(m[2]) : nn).split(' ')[0] || '';
  const byId = id ? people.filter(p => p.id && p.id === String(id).trim()) : [];
  const passes = [p => p.nn === nn, p => p.last === last && p.first === first, p => p.last === last && first && p.first && (p.first.startsWith(first) || first.startsWith(p.first))];
  const idClash = p => id && p.id && p.id !== String(id).trim();   // both have an ID and they differ: not this student (audit: a near-name took another student's scores)
  if (name) for (const pass of passes) { const c = people.filter(pass).filter(p => !idClash(p)); if (c.length === 1) return { p: c[0], how: 'name' }; if (c.length > 1) { const pick = c.find(p => byId.includes(p)); if (pick) return { p: pick, how: 'name' }; break; } }
  if (byId.length === 1) return { p: byId[0], how: 'id' };
  return null;
}
function importFast(fx, file) {
  if (!fx.students.length) { toast(fx.blank ? `${esc(file)}: this FAST report has no student names or IDs, so Tally can't tell whose scores they are.` : `${esc(file)}: no FAST scores in this report.`, true, 8000); return; }
  const people = rosterPeople(); const add = {}, info = {}; const unmatched = []; let byName = 0, byId = 0; const at = new Date().toISOString();
  fx.students.forEach(st => {
    const hit = matchPerson(people, st.name, st.id); if (hit) { if (hit.how === 'id') byId++; else byName++; } else unmatched.push(st);
    const keys = hit ? [hit.p.id ? 'id:' + hit.p.id : null, 'n:' + hit.p.nn, st.id && st.id !== hit.p.id ? 'id:' + st.id : null].filter(Boolean) : [st.id ? 'id:' + st.id : null, st.name ? 'n:' + norm(st.name) : null].filter(Boolean);
    keys.forEach(k => { add[k] = (add[k] || []).filter(h => !st.tests.some(x => testSig(x) === testSig(h))).concat(st.tests.map(t => ({ ...t }))); const fl = ((((state.testInfo || {})[k] || {}).FAST || {}).fields || {}).FLEID; info[k] = { FAST: { fields: { ...st.info, ...(st.name ? { Student: st.name } : {}), ...(st.id ? { ID: st.id } : {}), ...(fl ? { FLEID: fl } : {}) }, at, file: String(file || '') } }; });   // the score report's FLEID survives a Focus re-import (audit, 25 Oct 2026)
  });
  state.tests = mergeTests(state.tests, cleanTests(add));
  state.testInfo = { ...(state.testInfo || {}), ...cleanTestInfo(info) };
  save(); const wins = fx.windows.map(w => w.pm + ' ' + w.year).join(' and ');
  const names = unmatched.slice(0, 3).map(st => esc(st.name ? shown(st.name) : 'ID ' + st.id)).join('; ');
  toast(`FAST report (${esc(wins)}): ${plural(byName + byId, 'student')} matched to your classes${byId ? ` (${byId} by ID, the rest by name)` : ' by name'}${unmatched.length ? ` · <b>${unmatched.length} not in your classes</b>: ${names}${unmatched.length > 3 ? '…' : ''} (kept, in case they join)` : ''}${fx.blank ? ` · ${plural(fx.blank, 'row')} with no name or ID skipped` : ''}. Every column was kept.`, false, 10000);
  render();
}
/* ---------- the FLDOE score report, a PDF ----------
   "Score, Achievement and Points Earned on Grade N FAST Mathematics (PM1 2026-27) of All Rosters, by Student and
   Reporting Category" (Cambium's reporting site; Croix, 24 Oct 2026: "it will fill in their percentiles as well as
   give more in depth detail of the standard sections broken down. I can only get it as a pdf"). Page 1 is the Total
   table: Student · FLEID · Scale Score · Achievement Level · Percentile Rank, with State / District / School / My
   Students summary rows above the students. Each later page is one reporting category (its name in the header, "1.
   Number Sense and Operations and Algebraic Reasoning") whose rows read Below / At/Near / Above the Standard. pdf.js
   gives the text with positions; a row is anchored on its FLEID, the name is whatever sits left of it on the same
   line or the line above and below (long names wrap), and the values are whatever sits right of it. */
const FLEID_RE = /^FL\d{12}$/;
function parseFastItemsPdf(pages) {
  const flat = pages.flat().map(i => i.s).join(' ').replace(/\s+/g, ' ');
  const g = /Grade\s+(\d{1,2})\s+FAST\s+Math/i.exec(flat); const w = /\((PM\d)\s+(\d{4})\s*[-–]\s*(\d{2,4})\)/.exec(flat) || /Test Reasons:\s*(PM\d)\s+(\d{4})\s*[-–]\s*(\d{2,4})/.exec(flat);
  if (!g || !w || !pages.some(pg => pg.some(i => FLEID_RE.test(i.s.trim())))) return null;
  const grade = Number(g[1]); const pm = w[1].toUpperCase(); const year = `${w[2]}-${w[3].slice(-2)}`;
  const students = new Map(); const cats = []; let cat = null;   // a category table that runs onto a page without its header keeps its category (audit, 25 Oct 2026)
  pages.forEach(items => {
    const its = items.filter(i => i.s && i.s.trim()).map(i => ({ ...i, s: i.s.trim() })).sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = []; its.forEach(i => { const ln = lines.find(l => Math.abs(l.y - i.y) <= 3); if (ln) { ln.items.push(i); } else lines.push({ y: i.y, items: [i] }); });
    lines.forEach(ln => {
      ln.items.sort((a, b) => a.x - b.x); const text = ln.items.map(i => i.s).join(' ').replace(/\s+/g, ' ');
      const h = /(?:^|\s)(\d\.\s+[A-Z][^]*)$/.exec(text.replace(/^Student\s+FLEID\s+/i, '').replace(/^Student\s+/i, '').replace(/^FLEID\s+/i, ''));
      if (h && !/Total$/.test(text)) { cat = h[1].replace(/\s+/g, ' ').trim(); if (!cats.includes(cat)) cats.push(cat); return; }
      if (/\bTotal$/.test(text) && /^Student/i.test(text)) { cat = null; return; }
      ln.items.filter(i => FLEID_RE.test(i.s)).forEach(F => {
        const near = its.filter(i => i !== F && Math.abs(i.y - F.y) <= 11);   /* a wrapped name's second line */
        const name = near.filter(i => i.x < F.x - 1).sort((a, b) => b.y - a.y || a.x - b.x).map(i => i.s).join(' ').replace(/\s+/g, ' ').trim();
        const right = near.filter(i => i.x > F.x + (F.w || 0) - 1 && Math.abs(i.y - F.y) <= 4).sort((a, b) => a.x - b.x).map(i => i.s).join(' ').replace(/\s+/g, ' ');
        const st = students.get(F.s) || { fleid: F.s, name: '', scale: null, level: null, pct: null, cats: {} }; if (name && !st.name) st.name = name;
        if (cat) { const pf = /(Below|At\/Near|Above)\s+the\s+Standard/i.exec(right); if (pf) st.cats[cat] = { below: 'below', 'at/near': 'near', above: 'above' }[pf[1].toLowerCase()]; }
        else { const lv = /Level\s*(\d)/.exec(right); const sc = /(?:^|\s)(\d{3})(?=\s|$)/.exec(right); const after = lv ? right.slice(lv.index + lv[0].length) : '';
          if (sc) st.scale = Number(sc[1]); if (lv) st.level = Number(lv[1]);
          const pc = /(?:^|\s)(n\/a|<\s*\d+|\d{1,2})(?=\s|$)/.exec(after); if (pc) st.pct = /n\/a/i.test(pc[1]) ? null : /^</.test(pc[1]) ? 0 : Number(pc[1]); }
        students.set(F.s, st);
      });
    });
  });
  const list = [...students.values()].filter(st => st.name && (st.scale != null || st.level != null || Object.keys(st.cats).length));
  return { grade, pm, year, cats, students: list, kind: 'items' };
}
// Match the score report's students to the rosters by name (its FLEID is not a Focus ID), add what it knows to the
// window already on file, and keep the FLEID so the next report matches by it.
function importFastItems(fx, file, collect) {
  if (!fx.students.length) { const t = `${file}: no student rows in this score report`; if (collect) collect.fails.push(t); else toast(esc(t) + '.', true, 8000); return; }
  const people = rosterPeople(); const byFleid = {}; Object.keys(state.testInfo || {}).forEach(k => { const f = ((state.testInfo[k] || {}).FAST || {}).fields || {}; if (f.FLEID) byFleid[f.FLEID] = k; });
  const add = {}, info = {}; const unmatched = []; let matched = 0, byFl = 0; const at = new Date().toISOString();
  fx.students.forEach(st => {
    let keys = null; const prev = byFleid[st.fleid]; let hit = matchPerson(people, st.name, '');
    if (hit) { matched++; keys = [hit.p.id ? 'id:' + hit.p.id : null, 'n:' + hit.p.nn].filter(Boolean); }
    else if (prev) { matched++; byFl++; keys = [prev]; }
    else { unmatched.push(st); keys = ['n:' + norm(st.name)]; }
    const t = { test: 'FAST', pm: fx.pm, year: fx.year, grade: fx.grade }; if (st.scale != null) t.scale = st.scale; if (st.level != null) t.level = st.level; if (st.pct != null) t.pct = st.pct; if (Object.keys(st.cats).length) t.cats = st.cats;
    keys.forEach(k => { add[k] = [t]; const was = ((state.testInfo || {})[k] || {}).FAST || {}; info[k] = { FAST: { fields: { ...(was.fields || {}), FLEID: st.fleid, Student: (was.fields || {}).Student || st.name }, at, file: String(file || '') } }; });
  });
  state.tests = mergeTests(state.tests, cleanTests(add));
  state.testInfo = { ...(state.testInfo || {}), ...cleanTestInfo(info) };
  save();
  const names = unmatched.slice(0, 3).map(st => esc(shown(st.name))).join('; ');
  toast(`FAST score report (${esc(fx.pm)} ${esc(fx.year)}, ${esc(fastTestName(fx.grade))}): ${plural(matched, 'student')} matched to your classes by name${byFl ? ` (${byFl} by FLEID)` : ''} · percentiles and ${fx.cats.length === 1 ? 'one reporting category' : fx.cats.length + ' reporting categories'} added${unmatched.length ? ` · <b>${unmatched.length} not in your classes</b>: ${names}${unmatched.length > 3 ? '…' : ''} (kept, in case they join)` : ''}.`, false, 10000);
  if (collect) collect.lines.push({ label: 'FAST score report', text: `${fx.pm} ${fx.year}, ${fastTestName(fx.grade)}: ${plural(matched, 'student')} matched · percentiles and ${fx.cats.length} reporting ${fx.cats.length === 1 ? 'category' : 'categories'} added${unmatched.length ? ` · ${unmatched.length} not in your classes` : ''}` });
  else render();
}
// The reporting categories a window carries ("1. Number Sense and Operations and Algebraic Reasoning": below | near |
// above), named without their number, in the report's order.
const CAT_WORDS = { below: 'Below the standard', near: 'At or near the standard', above: 'Above the standard' };
function catList(h) { return h && h.cats ? Object.keys(h.cats).map(k => ({ name: k.replace(/^\d+\.\s*/, ''), v: h.cats[k] })) : []; }
function catsHtml(h) { const cs = catList(h); return cs.length ? `<div class="fcats">${cs.map(c => `<span class="fcat ${c.v}"><i></i>${esc(c.name)} <small>${esc(CAT_WORDS[c.v].replace(' the standard', ''))}</small></span>`).join('')}</div>` : ''; }
// Everything the FAST report said about a student, by column heading ({} when there is no report).
function fastInfo(sec, name) { const f = findStudent(sec, name); for (const k of testKeys(f.id, name)) { const v = ((state.testInfo || {})[k] || {}).FAST; if (v) return v.fields || {}; } return {}; }
const flagOn = v => v != null && String(v).trim() !== '' && !/^(n|no|0|-|none)$/i.test(String(v).trim());
// The flags a teacher acts on, from the report: L30 first.
function fastFlags(fi) { const out = []; if (flagOn(fi.L30)) out.push({ k: 'L30', t: 'Lowest 30%', cls: 'l30' }); ['ESE', '504', 'ELL'].forEach(c => { if (flagOn(fi[c])) out.push({ k: c, t: /^y(es)?$/i.test(fi[c]) ? c : `${c} (${fi[c]})`, cls: '' }); }); if (flagOn(fi.TestedAboveGrade)) out.push({ k: 'above', t: 'Tests above grade', cls: '' }); return out; }
const isL30 = (sec, name) => flagOn(fastInfo(sec, name).L30);

// Test history for one student: imported FAST results, then the FAST score the Seating Chart backup carried.
function testHistory(sec, name) {
  const f = findStudent(sec, name); const seen = new Set(); const out = [];
  testKeys(f.id, name).forEach(k => { const l = (state.tests || {})[k]; (Array.isArray(l) ? l : []).forEach(h => { if (!h) return; const sig = testSig(h); if (seen.has(sig)) return; seen.add(sig); out.push(h); }); });   // one odd entry never stops every student's FAST page
  out.sort((a, b) => (b.year + b.pm).localeCompare(a.year + a.pm));
  const si = (sec.seatInfo || {})[f.row && f.row.display ? f.row.display : name] || null;
  /* The Seating Chart backup carries last year's PM3. It stays until an imported PM3 says the same thing: importing only
     this year's score report used to drop it, and with it the student's gain target (audit, 25 Oct 2026). */
  const cy = fastYearNow();
  if (!out.some(h => /FAST/i.test(h.test) && h.pm === 'PM3' && h.year && h.year !== cy) && si && (si.level || si.pct != null || si.scale != null)) out.push({ test: 'FAST', pm: 'PM3', year: '', level: si.level, scale: si.scale, pct: si.pct, src: 'seating' });
  return out;
}
/* ---------- FAST achievement levels and learning gains ----------
   Cut scores approved by the State Board of Education, 10 Jan 2024 (FAST Mathematics, grades 3 to 8), with the Level 1
   and Level 2 subcategories the school grade's learning gains use. Each grade's row: the first score of Low 1, Mid 1,
   High 1, Low 2, High 2, Level 3, Level 4, Level 5, and the top of the scale.
   A learning gain (Croix, 24 Oct 2026: "a gain is defined by moving to the next bucket up … The threes need to get a
   four for a gain. The fours need a five. The fives have to maintain their five."): from Level 1 or 2, the next
   subcategory up or a higher level; from Level 3 or 4, the level above; from Level 5, Level 5 again.
   Accelerated classes sit the grade-8 test, so their scores this year sit on the grade-8 table while last year's PM3
   stays on the grade-6 one. */
// "2026-27" → "26/27" (Croix, 25 Oct 2026: "change last year and this year to 25/26 School Year and 26/27 School Year").
const syShort = y => { const m = /^(\d{4})-(\d{2,4})$/.exec(y || ''); return m ? `${m[1].slice(2)}/${m[2].slice(-2)}` : ''; };
// When the windows not yet taken happen (Croix, 25 Oct 2026: "pm2 is December 8 pm3 is in May"), for the chart.
const FAST_WHEN = { PM1: 'Sept', PM2: 'Dec 8', PM3: 'May' };
const FAST_MATH = { 3: [140, 155, 169, 183, 191, 198, 209, 225, 260], 4: [155, 170, 185, 200, 206, 211, 221, 238, 273], 5: [158, 175, 191, 207, 215, 222, 234, 246, 285],
  6: [168, 183, 198, 213, 221, 229, 239, 254, 287], 7: [175, 191, 207, 223, 229, 235, 247, 258, 288], 8: [183, 198, 213, 227, 236, 244, 254, 263, 291] };
const FAST_BUCKETS = [[1, 'Low Level 1'], [1, 'Mid Level 1'], [1, 'High Level 1'], [2, 'Low Level 2'], [2, 'High Level 2'], [3, 'Level 3'], [4, 'Level 4'], [5, 'Level 5']];
// The bucket a scale score falls in on a grade's table: { idx 0..7, level, label }, or null with no score or table.
function fastBucket(grade, scale) { const cuts = FAST_MATH[grade]; if (!cuts || scale == null) return null;   /* below the first cut is still Low Level 1 */ let i = 0; for (let k = 1; k < 8; k++) if (scale >= cuts[k]) i = k; return { idx: i, level: FAST_BUCKETS[i][0], label: FAST_BUCKETS[i][1], grade }; }
const fastLevelFloor = (grade, level) => { const c = FAST_MATH[grade]; return c ? [null, c[0], c[3], c[5], c[6], c[7]][level] : null; };
// The lowest score on this grade's table that counts as a learning gain over a prior-year result.
function fastGainFloor(grade, prior) {
  const c = FAST_MATH[grade]; const pb = prior && prior.grade ? fastBucket(prior.grade, prior.scale) : null; if (!c || !pb) return null;
  if (pb.level <= 2) return { score: c[pb.idx + 1], label: FAST_BUCKETS[pb.idx + 1][1] };
  if (pb.level === 5) return { score: c[7], label: 'Level 5 again' };
  return { score: fastLevelFloor(grade, pb.level + 1), label: `Level ${pb.level + 1}` };
}
// The newest school year ('2026-27') among every FAST result in Tally, and the one before a given year.
/* PM3 closes a school year, so a newest year that holds nothing but PM3s is last year: a Focus report pulled in August,
   before PM1, carries only last spring's PM3 (audit, 25 Oct 2026). */
function fastYearNow() { let y = ''; const pms = {}; Object.values(state.tests || {}).forEach(list => (Array.isArray(list) ? list : []).forEach(h => { if (h && /FAST/i.test(h.test) && h.year) { if (h.year > y) y = h.year; (pms[h.year] = pms[h.year] || new Set()).add(h.pm); } }));
  if (!y) return null; return [...pms[y]].every(pm => pm === 'PM3') ? nextSchoolYear(y) : y; }
function nextSchoolYear(y) { const m = /^(\d{4})-(\d{2,4})$/.exec(y || ''); if (!m) return null; const a = Number(m[1]) + 1; return `${a}-${String(a + 1).slice(-m[2].length)}`; }
function prevSchoolYear(y) { const m = /^(\d{4})-(\d{2,4})$/.exec(y || ''); if (!m) return null; const a = Number(m[1]) - 1; return `${a}-${String(a + 1).slice(-m[2].length)}`; }
// Everything the page says about a student's FAST year: last year's PM3, this year's windows, and what PM2 / PM3 need.
function fastTargets(sec, name) {
  const hist = testHistory(sec, name).filter(h => /FAST/i.test(h.test) && h.scale != null); if (!hist.length) return null;
  const fi = fastInfo(sec, name); const gradeLevel = Number(String(fi.GradeLevel || state.settings.gradeLevel || '7').replace(/^0+/, '')) || 7;
  /* This year is the newest school year in any FAST result in Tally, not in this student's: a student who missed PM1
     has only last year's PM3, and that is still last year's (audit, 24 Oct 2026: it was shown as "PM3 this year" on
     the wrong grade's scale). Last year is the school year before it. */
  const thisYear = fastYearNow(); const lastYear = thisYear ? prevSchoolYear(thisYear) : null;
  const prior0 = hist.find(h => h.pm === 'PM3' && h.year === lastYear) || hist.find(h => h.pm === 'PM3' && !h.year) || null;   // an imported last-year PM3, else the Seating Chart's
  const prior = prior0 ? { ...prior0, grade: prior0.grade || gradeLevel - 1 } : null;
  const now = hist.filter(h => h.year === thisYear && h.year).sort((a, b) => a.pm.localeCompare(b.pm)); const latest = now[now.length - 1] || null;
  /* The test taken this year: accelerated classes sit the grade above, and the FAST report's "tested above grade" flag
     says so too. When the report also gives this year's achievement level, the scale whose cut scores reproduce that
     level wins, so a class flag that is wrong for one student doesn't put their scores on the wrong table. */
  const above = sec.prep === 'acc' || now.some(h => h.above);
  const agree = g => now.filter(h => h.level != null && fastBucket(g, h.scale) && fastBucket(g, h.scale).level === h.level).length;
  const pref = above ? [gradeLevel + 1, gradeLevel] : [gradeLevel, gradeLevel + 1];
  const known = now.slice().reverse().find(h => h.grade && FAST_MATH[h.grade]);   // the score report names its test outright; the newest window wins (a student moved to accelerated after PM1 sits the grade-8 test now)
  let gradeNow = known ? known.grade : agree(pref[1]) > agree(pref[0]) && FAST_MATH[pref[1]] ? pref[1] : pref[0];
  if (!FAST_MATH[gradeNow]) gradeNow = Math.max(3, Math.min(8, gradeNow));   /* the state tables run grades 3 to 8: an accelerated class with GradeLevel 8 would ask for a grade-9 table and crash the report (audit, 25 Oct 2026) */
  const b = s => fastBucket(gradeNow, s); const c = FAST_MATH[gradeNow];
  const gain = prior ? fastGainFloor(gradeNow, prior) : null;
  const rows = [];
  if (gain) rows.push({ k: 'gain', what: gain.label.replace(/ again$/, ''), sub: gain.score === fastLevelFloor(gradeNow, 3) ? 'learning gain, on grade level' : 'learning gain', score: gain.score, why: 'counts for the school grade' });   // the level first, "learning gain" beside it, like Level 3's "on grade level" (Croix, 25 Oct 2026)
  const floorLv = prior && prior.grade ? Math.min(3, (fastBucket(prior.grade, prior.scale) || { level: 1 }).level) : 1;   /* Croix (25 Oct 2026), of a Level 4 student's "Level 2" row: "This should not be a target because it's less than his PM3 level" */
  if (c) [[2, 'Level 2'], [3, 'Level 3'], [4, 'Level 4'], [5, 'Level 5']].filter(([lv]) => lv >= floorLv).forEach(([lv, lab]) => { const sc = fastLevelFloor(gradeNow, lv); if (!rows.some(r => r.score === sc)) rows.push({ k: 'l' + lv, what: lab, sub: lv === 3 ? 'on grade level' : '', score: sc }); });
  rows.sort((x, y) => x.score - y.score);
  rows.forEach(r => { r.met = latest && latest.scale != null && latest.scale >= r.score; r.gap = latest && latest.scale != null ? r.score - latest.scale : null; });
  return { gradeNow, gradeLevel, thisYear, prior, priorBucket: prior ? fastBucket(prior.grade, prior.scale) : null, latest, latestBucket: latest ? b(latest.scale) : null, now, rows, gain };
}
function fastTargetsHtml(t) {
  if (!t) return '';
  const lvl = bk => bk ? `<span class="flvl l${bk.level}">${esc(bk.label)}</span>` : '';
  const grade = g => `<small>${esc(fastTestName(g))}</small>`;
  const cards = `${t.prior ? `<div class="gcard"><small>Last year's PM3</small><b>${t.prior.scale}</b><span>${lvl(t.priorBucket)} ${grade(t.prior.grade)}</span></div>` : `<div class="gcard"><small>Last year's PM3</small><b>—</b><span>not in Tally, so no gain target</span></div>`}
    ${t.latest ? `<div class="gcard"><small>${esc(t.latest.pm)} this year</small><b>${t.latest.scale}</b><span>${lvl(t.latestBucket)} ${grade(t.gradeNow)}${t.gain && t.latest.scale >= t.gain.score ? ' <b class="pos">already a gain</b>' : ''}</span></div>` : `<div class="gcard"><small>This year</small><b>—</b><span>no window scored yet</span></div>`}`;
  const list = t.rows.map(r => `<tr class="${r.met ? 'met' : ''}"><td>${esc(r.what)}${r.sub ? ` <small>${esc(r.sub)}</small>` : ''}</td><td class="num"><b>${r.score}</b>${r.k === 'gain' ? '' : ''}</td><td>${r.met ? `${ico('check')} reached on ${esc(t.latest.pm)}` : r.gap != null ? `<small>${r.gap} more than ${esc(t.latest.pm)}</small>` : ''}${r.why && !r.met ? ` <small class="why">· ${esc(r.why)}</small>` : ''}</td></tr>`).join('');
  return `<div class="fastT"><div class="gcards two">${cards}</div>
    <h4 class="subh">What PM2 and PM3 need <small>${esc(fastTestName(t.gradeNow))}</small></h4>
    <table class="ftab targets"><tbody>${list}</tbody></table></div>`;
}
/* ---------- the FAST report: one printed page per student for a data talk ----------
   Last year's PM3 and this year's windows in their buckets, each on a scale drawn from the state cut scores, the
   targets for PM2 and PM3 (gain, each level, on grade level), the history, and a box for the student's own goals. */
/* Two grades' tables have different cut scores, so drawn to scale their levels never line up (Croix, 25 Oct 2026: "it's
   just tough to compare the two, being at two different levels"). With `W` (eight band widths shared by both bars)
   each level sits at the same place on both, and a score is placed by how far it is through its own level. */
function fastBandWidths(grades) { const W = Array(8).fill(0); grades.forEach(g => { const c = FAST_MATH[g]; for (let i = 0; i < 8; i++) W[i] += (c[i + 1] - c[i]) / (c[8] - c[0]) / grades.length; }); return W; }
function fastPos(grade, v, W) { const c = FAST_MATH[grade]; if (!c || v == null) return null; v = Math.max(c[0], Math.min(c[8], v)); let i = 0; for (let k = 1; k < 8; k++) if (v >= c[k]) i = k; let at = 0; for (let k = 0; k < i; k++) at += W[k]; return at + W[i] * (v - c[i]) / Math.max(1, c[i + 1] - c[i]); }
function fastScaleHtml(grade, marks, W) {
  const c = FAST_MATH[grade]; if (!c) return '';
  const lo = c[0], hi = c[8]; const X = W ? v => fastPos(grade, v, W) * 100 : v => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
  const bands = [[c[0], c[1], 'Low 1', 'l1'], [c[1], c[2], 'Mid 1', 'l1'], [c[2], c[3], 'High 1', 'l1'], [c[3], c[4], 'Low 2', 'l2'], [c[4], c[5], 'High 2', 'l2'], [c[5], c[6], 'Level 3', 'l3'], [c[6], c[7], 'Level 4', 'l4'], [c[7], c[8], 'Level 5', 'l5']];
  /* Scores sit above the bands and targets below, so a PM1 next to its target never overlaps it; marks at the same
     score share one label, and marks within a few points of each other take turns standing taller (audit, 24 Oct). */
  /* Marks closer than a label's width are drawn as one mark with a line per window ("PM1 245 / PM2 246 / PM3 248"),
     at their middle: three windows a few points apart used to print on top of each other (audit, 25 Oct 2026). A
     mark near either end is anchored inward so its label stays on the page. */
  const row = (list, cls) => { const ms = []; list.filter(m => m.v != null).sort((a, b) => a.v - b.v).forEach(m => { const v = Math.max(lo, Math.min(m.v, hi)); const same = ms.find(x => x.v === v); if (same) same.label += ' · ' + m.label; else ms.push({ v, label: m.label, shown: m.v }); });
    const groups = []; ms.forEach(m => { m.x = X(m.v); const g = groups[groups.length - 1]; if (g && m.x - g[g.length - 1].x < 6) g.push(m); else groups.push([m]); });
    const under = /under/.test(cls); const tall = Math.max(1, ...groups.map(g => g.length));
    const mark = g => { const x = g.reduce((a, m) => a + m.x, 0) / g.length; const text = g.length === 1 ? `<b>${esc(g[0].label)}</b><small>${g[0].shown}</small>` : g.map(m => `<span class="ln"><b>${esc(m.label)}</b> ${m.shown}</span>`).join('');
      return `<div class="mk${g.length > 1 ? ' grp' : ''}${x < 5 ? ' edgeL' : x > 95 ? ' edgeR' : ''}" data-n="${g.length}" style="left:${x}%">${under ? `<i></i>${text}` : `${text}<i></i>`}</div>`; };
    return groups.length ? `<div class="${cls}" style="height:${(under ? 30 : 34) + (tall > 2 ? 9 * (tall - 2) : 0)}px">${groups.map(mark).join('')}</div>` : ''; };
  return `<div class="scale">${row(marks.filter(m => m.cls !== 'tg'), 'marks')}
    <div class="bands">${bands.map(([a, b, lab, cls]) => `<div class="${cls}" style="left:${X(a)}%;width:${X(b) - X(a)}%"><span>${lab}</span><small>${a}</small></div>`).join('')}</div>${row(marks.filter(m => m.cls === 'tg'), 'marks under')}</div>`;
}
const fastTestName = g => `Math Grade ${g} FAST`;   // the cards carry every window with its test, level and percentile; the old "Every FAST so far" table repeated them and is gone (Croix, 25 Oct 2026)
/* The page is the student's: nothing on it that only the teacher needs (Croix, 24 Oct 2026: "get rid of the tests
   above grade pill, the mention of tally … a gain counts for school grade, basically anything and everything that
   students don't know or need to worry about"). Tests are named the way the student hears them: Math Grade 8 FAST. */
// Every window on one chart: the y axis is the levels (lined up as above), so a grade-6 score and a grade-8 score sit
// where they stand in their own test's levels; the gain target is a dashed line.
function fastLineChart(t) {
  const syNow = syShort(t.thisYear) || 'this year', syLast = syShort(t.prior && t.prior.year) || (t.thisYear ? syShort(prevSchoolYear(t.thisYear)) : '') || 'last year';
  /* The y axis is this year's test's scale score, last year's PM3 plotted at its own number on it, so a 244 then and a
     244 now sit level (Croix, 25 Oct 2026: "Scale the chart for the grade 8 test … don't include the FAST level
     labels. Put pm3 from last year on the chart where it would lie on the 8th grade test"). The level floors of this
     year's test are dotted lines, marked only by their scores. */
  const c = FAST_MATH[t.gradeNow]; if (!c) return ''; const floors = [c[3], c[5], c[6], c[7]];
  const pts = [{ lab: 'PM3', v: t.prior ? t.prior.scale : null }, ...['PM1', 'PM2', 'PM3'].map(pm => { const h = t.now.find(x => x.pm === pm); return { lab: pm, v: h ? h.scale : null }; })];
  const vals = pts.map(p => p.v).filter(v => v != null); const lo = Math.min(...vals, t.gain ? t.gain.score : Infinity, c[5]) - 8, hi = Math.max(...vals, t.gain ? t.gain.score : -Infinity, c[7]) + 6;
  const w = 330, h = 146, L = 30, R = 34, T = 10, B = 28; const iw = w - L - R, ih = h - T - B;   /* the gain is labelled in the right margin, clear of the last point (audit, 25 Oct 2026) */
  const X = i => L + iw * (i + .5) / pts.length, Y = v => T + ih * (1 - (v - lo) / (hi - lo));
  const got = pts.map((p, i) => p.v == null ? null : { i, x: X(i), y: Y(p.v), v: p.v });
  const line = got.filter(Boolean); const path = line.map((p, j) => `${j ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const gy = t.gain ? Y(t.gain.score) : null;
  return `<svg class="fline" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="FAST scale scores by window">
    ${floors.filter(v => v > lo && v < hi && !(t.gain && v === t.gain.score)).map(v => `<line x1="${L}" x2="${L + iw}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="#999" stroke-width=".8" stroke-dasharray="1.5 2.5"/><text x="${L - 4}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end" font-size="7.5" fill="#555">${v}</text>`).join('')}
    ${gy != null ? `<line x1="${L}" x2="${L + iw}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}" stroke="#000" stroke-width="1" stroke-dasharray="4 3"/><text x="${L + iw + 3}" y="${(gy - 1).toFixed(1)}" font-size="7.5" font-weight="700">gain</text><text x="${L + iw + 3}" y="${(gy + 8).toFixed(1)}" font-size="8" font-weight="900">${t.gain.score}</text>` : ''}
    ${path ? `<path d="${path}" fill="none" stroke="#000" stroke-width="2"/>` : ''}
    ${line.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#000" stroke="#fff" stroke-width="1.5"/><text x="${p.x.toFixed(1)}" y="${(gy != null && p.y > gy && p.y - gy < 15 || p.y - 7 < T + 2 ? p.y + 14 : p.y - 7).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="900">${p.v}</text>`).join('')}
    ${pts.map((p, i) => `<text x="${X(i).toFixed(1)}" y="${h - 16}" text-anchor="middle" font-size="8.5" font-weight="700">${p.lab}</text><text x="${X(i).toFixed(1)}" y="${h - 6}" text-anchor="middle" font-size="7" fill="#444">${i === 0 ? esc(syLast) : p.v != null ? esc(syNow) : pts.slice(i + 1).some(q => q.v != null) ? 'missed' : esc(FAST_WHEN[p.lab] || '')}</text>`).join('')}
  </svg>`;
}
function fastReportSection(sec, name) {
  const t = fastTargets(sec, name);
  const first = niceName(name).split(' ')[0]; const today = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  if (!t) return `<section class="rep fast"><h1>${esc(niceName(name))}</h1><div class="meta">${esc(sec.label)} · ${esc(today)}</div><p>No FAST scores on file yet.</p></section>`;
  /* The level pill shows where the score sits inside its level, filled like the scale below (Croix, 25 Oct 2026: "Maybe
     it could fill in their level within their current level. Like the graph below"). */
  const lvl = (g, sc) => { const bk = fastBucket(g, sc); const c = FAST_MATH[g]; if (!bk || !c) return ''; const lo = c[bk.idx], hi = c[bk.idx + 1]; const pc = Math.max(4, Math.min(100, Math.round((sc - lo) / Math.max(1, hi - lo) * 100)));
    return `<span class="lv l${bk.level}"><i style="width:${pc}%"></i><em>${esc(bk.label)}</em><small>${lo}–${bk.idx === 7 ? hi : hi - 1}</small></span>`; };   // Level 4 on grade 6 is 239–253: 254 is Level 5 (audit, 25 Oct 2026)
  const l3 = fastLevelFloor(t.gradeNow, 3); const gainIsL3 = !!t.gain && t.gain.score === l3;
  const nowName = fastTestName(t.gradeNow), priorGrade = t.prior ? t.prior.grade : t.gradeLevel - 1, priorName = fastTestName(priorGrade);
  const diff = h => t.prior && t.prior.scale != null ? ` <small class="chg">(${h.scale >= t.prior.scale ? '+' : '−'}${Math.abs(h.scale - t.prior.scale)})</small>` : '';
  const cards = [
    t.prior ? `<div><small>${esc(priorName)} PM3</small><b>${t.prior.scale}</b>${lvl(priorGrade, t.prior.scale)}<span>${t.prior.pct != null ? esc(pctWord(t.prior.pct)) : ''}</span></div>` : `<div><small>${esc(priorName)} PM3</small><b>—</b><span>no score on file</span></div>`,
    t.now.length ? t.now.map(h => `<div><small>${esc(nowName)} ${esc(h.pm)}</small><b>${h.scale}${diff(h)}</b>${lvl(t.gradeNow, h.scale)}<span>${h.pct != null ? esc(pctWord(h.pct)) : ''}</span></div>`).join('') : `<div><small>${esc(nowName)}</small><b>—</b><span>no window scored yet</span></div>`,
    t.gain ? `<div class="goal"><small>Your target · a gain</small><b>${t.gain.score}+</b><span>${gainIsL3 ? 'Level 3, on grade level' : esc(t.gain.label)}</span></div>` : ''].join('');   /* no "On grade level" card: Level 3 is a row in the targets and a mark on the scale (Croix, 25 Oct 2026: "Not needed") */
  /* In plain sentences, each score with its level (Croix, 25 Oct 2026: "Hayden scored a 247 (Level 4) on last year's
     Math Grade 6 FAST. A learning gain this year means scoring a 263 (Level 5) or higher on the Math Grade 8 FAST.
     Hayden scored 229 (Low Level 2) on the PM1. Hayden must increase by 34 points in order to achieve a gain."). */
  const syNow = syShort(t.thisYear) || 'this year', syLast = syShort(t.prior && t.prior.year) || (t.thisYear ? syShort(prevSchoolYear(t.thisYear)) : '') || 'last year';
  /* "2025/26 (6th Grade)", "2026/27 (7th Grade)": the student's grade that year, not the test's (Croix, 25 Oct 2026; "School Year" taken out) */
  const syLong = y => { const m = /^(\d{4})-(\d{2,4})$/.exec(y || ''); return m ? `${m[1]}/${m[2].slice(-2)}` : ''; }, ord = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
  const yNow = syLong(t.thisYear), yLast = syLong((t.prior && t.prior.year) || (t.thisYear ? prevSchoolYear(t.thisYear) : ''));
  const syNowL = yNow ? `${yNow} (${ord(t.gradeLevel)} Grade)` : 'This year', syLastL = yLast ? `${yLast} (${ord(t.gradeLevel - 1)} Grade)` : 'Last year';
  const lvOf = (g, v) => { const bk = fastBucket(g, v); return bk ? ` (${esc(bk.label)})` : ''; };
  const gainLv = t.gain ? (fastBucket(t.gradeNow, t.gain.score) || { label: t.gain.label }).label : '';
  const said = [
    t.prior ? `${esc(first)} scored a <b>${t.prior.scale}</b>${lvOf(priorGrade, t.prior.scale)} on ${/\//.test(syLast) ? `the ${esc(syLast)}` : "last year's"} ${esc(priorName)}.` : `There is no PM3 score from last year on file, so there is no learning-gain target yet; the level targets below still apply.`,
    t.gain ? `A learning gain ${/\//.test(syNow) ? `in ${esc(syNow)}` : 'this year'} means scoring a <b>${t.gain.score} (${esc(gainLv)}) or higher</b> on the ${esc(nowName)}.` : '',
    t.latest ? `On the ${esc(t.latest.pm)}, ${esc(first)} scored a <b>${t.latest.scale}</b>${lvOf(t.gradeNow, t.latest.scale)}${t.gain ? (t.latest.scale >= t.gain.score ? (t.latest.pm === 'PM3' ? ', a gain.' : ', already a gain. PM3 is the one that counts, so hold it there.') : (n => ` and <b>${n} more point${n === 1 ? '' : 's'}</b> ${n === 1 ? 'is' : 'are'} needed for a gain.`)(t.gain.score - t.latest.scale)) : '.'}` : ''];   /* the name once (Croix, 25 Oct 2026: "I might've put Hayden's name in that text too many times") */
  const gainWords = said.filter(Boolean).join(' ');
  const rows = t.rows.map(r => `<tr class="${r.met ? 'met' : ''}"><td><span class="box"></span>${esc(r.what)}${r.sub ? ` <small>${esc(r.sub)}</small>` : ''}</td><td class="r"><b>${r.score}</b></td><td>${r.met ? `✓ reached on ${esc(t.latest.pm)}` : r.gap != null ? `${r.gap} more than ${esc(t.latest.pm)}` : ''}</td></tr>`).join('');
  const W = fastBandWidths([priorGrade, t.gradeNow].filter((g, i, a) => FAST_MATH[g] && a.indexOf(g) === i));
  const thisYearMarks = [...t.now.map(h => ({ v: h.scale, label: h.pm, cls: 'now' })), ...(t.gain && !gainIsL3 ? [{ v: t.gain.score, label: 'Gain', cls: 'tg' }] : []), { v: l3, label: gainIsL3 ? 'Gain · grade level' : 'Grade level', cls: 'tg' }];
  return `<section class="rep fast"><div class="head"><div><h1>${esc(niceName(name))}</h1><div class="meta">${esc(sec.label)} · ${esc(nowName)} · ${esc(today)}</div></div></div>
    <div class="cards">${cards}</div>
    <div class="slab first">${esc(syLastL)} · ${esc(priorName)}</div>${fastScaleHtml(priorGrade, t.prior ? [{ v: t.prior.scale, label: 'PM3', cls: 'now' }] : [], W)}
    <div class="slab">${esc(syNowL)} · ${esc(nowName)}</div>${fastScaleHtml(t.gradeNow, thisYearMarks, W)}
    <p class="gain">${gainWords}</p>
    <div class="two tl"><div><h2>Your targets for PM2 and PM3</h2><table class="targets"><tbody>${rows}</tbody></table></div><div><h2>Your FAST scores</h2>${fastLineChart(t)}</div></div>
    ${(() => { const h = t.now.slice().reverse().find(x => x.cats) || null; const cs = catList(h);
      const topics = cs.length ? `<div><h2>By topic <span class="hs">${esc(h.pm)}</span></h2><table class="topics"><thead><tr><th></th><th class="c">Below</th><th class="c">At/near</th><th class="c">Above</th></tr></thead><tbody>${cs.map(c => `<tr><td>${esc(c.name)}</td>${['below', 'near', 'above'].map(v => `<td class="c ${c.v === v ? 'on' : ''}">${c.v === v ? '●' : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
      return topics; })()}
    <div class="pledge"><div><b>My goal for PM2</b><i></i></div><div><b>My goal for PM3</b><i></i></div><div class="wide"><b>How I'll get there</b><i></i><i></i><i></i></div><div class="sig"><span>Student</span><span>Teacher</span><span>Date</span></div></div></section>`;
}
const FAST_REPORT_CSS = `
.rep.fast h2{margin:6px 0 3px}.rep.fast .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:8px 0 2px}.rep.fast .cards>div{border:1px solid #bbb;border-radius:6px;padding:5px 9px}.rep.fast .cards small{display:block;font-size:7.5pt;text-transform:uppercase;letter-spacing:.06em;color:#333}.rep.fast .cards b{font-size:17pt;font-weight:900;line-height:1.1;display:block}.rep.fast .cards span{display:block;font-size:8pt;color:#444}.rep.fast .cards .goal{border:1.5px solid #000}
.rep.fast .cards .lv{position:relative;display:flex;justify-content:space-between;align-items:center;border:1px solid #000;border-radius:8px;padding:0 7px;height:15px;font-size:8pt;margin:3px 0 2px;overflow:hidden;background:#fff}.rep.fast .lv i{position:absolute;left:0;top:0;bottom:0;background:#c9c9c9}.rep.fast .lv em,.rep.fast .lv small{position:relative;font-style:normal}.rep.fast .lv em{font-weight:bold}.rep.fast .lv small{font-size:6.5pt;color:#333;text-transform:none;letter-spacing:0;display:inline}.rep.fast .cards b .chg{display:inline;font-size:11pt;font-weight:bold;text-transform:none;letter-spacing:0;color:#000;margin-left:4px}
.scale{margin:2px 0 5px}.bands{position:relative;height:26px;border:1px solid #000;border-radius:4px;overflow:hidden}.bands>div{position:absolute;top:0;bottom:0;border-left:1px solid #000;font-size:7.5pt;padding:2px 0 0 3px;overflow:hidden;white-space:nowrap}.bands>div:first-child{border-left:none}.bands span{display:block;font-weight:bold}.bands small{display:block;font-size:7pt;color:#333}
.bands .l1{background:#f0f0f0}.bands .l2{background:#dcdcdc}.bands .l3{background:#c4c4c4}.bands .l4{background:#a8a8a8}.bands .l5{background:#8c8c8c}.bands .l4,.bands .l5{color:#fff}.bands .l4 small,.bands .l5 small{color:#eee}
.marks{position:relative;height:34px}.mk{position:absolute;bottom:0;transform:translateX(-50%);text-align:center;font-size:7.5pt;line-height:1.05;display:flex;flex-direction:column;align-items:center;white-space:nowrap}.mk b{font-size:8.5pt}.mk i{display:block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #000}.mk .ln{display:block;font-size:7.5pt;line-height:1.1}.mk .ln b{font-size:8pt}.mk.edgeL{transform:none;align-items:flex-start;text-align:left}.mk.edgeL i{margin-left:-5px}.mk.edgeR{transform:translateX(-100%);align-items:flex-end;text-align:right}.mk.edgeR i{margin-right:-5px}.marks.under{height:30px}.marks.under .mk{bottom:auto;top:0}.marks.under .mk i{border-top:none;border-bottom:8px solid #555}.marks.under .mk b{color:#333;font-size:7.5pt}
.rep.fast .gain{margin:3px 0 5px;font-size:10pt;line-height:1.35}.rep.fast .slab{font-size:8.5pt;font-weight:bold;margin:2px 0 -2px}.rep.fast .slab.first{margin-top:9px}.rep.fast .two.tl{display:grid;grid-template-columns:1fr 330px;gap:0 16px;align-items:start}.rep.fast .fline{display:block;margin-top:4px}.rep.fast .two.tl .targets td{font-size:9.5pt;padding:3px 4px}
.rep.fast .topics th{text-align:center;font-size:8pt}.rep.fast .topics th:first-child{text-align:left}.rep.fast .topics td{font-size:9pt;padding:1px 6px}.rep.fast .topics td.c{text-align:center;width:60px;color:#000;font-size:11pt;line-height:1}.rep.fast .topics th.c{width:60px}
.rep.fast .targets td{padding:3px 6px;font-size:10pt}.rep.fast .targets tr.met td{color:#0F766E}.rep.fast .hist td,.rep.fast .hist th{font-size:8.5pt;white-space:nowrap;padding:2px 5px}
.rep.fast .pledge{break-inside:avoid;page-break-inside:avoid;grid-template-columns:1fr 1fr;gap:6px 24px;padding:7px 12px 8px;margin-top:8px}.rep.fast .pledge .wide{grid-column:1/-1}.rep.fast .pledge b{display:block;margin-bottom:3px}.rep.fast .pledge i{display:block;border-bottom:1px solid #000;height:18px}.rep.fast .pledge .sig{margin-top:6px}`;
function printFastReports(sec, names, title) { printFast([{ sec, names }], title); }
// One class or several (Croix, 25 Oct 2026: "a way to print all classes in one go"), each student's page on its own.
function printFast(groups, title) {
  groups = groups.filter(g => g.names.length); const n = groups.reduce((a, g) => a + g.names.length, 0); if (!n) return;
  const failed = []; const body = groups.map(g => g.names.map(nm => safeSection(() => fastReportSection(g.sec, nm), nm, failed)).join('')).join('');
  const html = printDoc(title, REPORT_CSS + FAST_REPORT_CSS, body, n);
  const go = () => { openPrint(html, n === 1 ? 'FAST-report.html' : `${title.replace(/[^\w-]+/g, '_')}.html`, n === 1);
    if (failed.length) toast(`${plural(failed.length, 'report')} could not be made: ${failed.slice(0, 3).map(x => shown(x)).join('; ')}${failed.length > 3 ? '…' : ''}.`, true, 6000); };
  if (state.settings.hideNames) { ask(`Names are hidden, but the ${n === 1 ? 'report opens with the student\'s full name and scores' : 'reports open with every student\'s full name and scores'} on screen. Open ${n === 1 ? 'it' : 'them'}?`, 'Open').then(ok => { if (ok) go(); }); return; }
  go();
}
// The student page's FAST section: newest first, with the change in scale score from one window to the next.
function testsSection(sec, name) {
  const hist = testHistory(sec, name); const fi = fastInfo(sec, name); if (!hist.length && !Object.keys(fi).length) return '';
  if (state.settings.hideNames) return `<section class="gsec" id="pTests"><h3>FAST</h3><p class="ghint">Hidden while names are hidden.</p></section>`;
  const flags = fastFlags(fi); const keys = Object.keys(fi).filter(k => !['Student', 'ID'].includes(k));
  return `<section class="gsec" id="pTests"><h3>FAST</h3>${flags.length ? `<div class="fflags">${flags.map(x => `<span class="fflag ${x.cls}">${esc(x.t)}</span>`).join('')}</div>` : ''}<table class="ftab"><tbody>${hist.map((h, j) => { const prev = hist[j + 1]; const dv = prev && h.scale != null && prev.scale != null ? h.scale - prev.scale : null;
    return `<tr><th scope="row">${esc([h.pm, h.year].filter(Boolean).join(' '))}</th><td>${h.level != null ? `<span class="flvl l${Math.min(5, Math.max(1, h.level))}">Level ${h.level}</span>` : ''}</td><td class="num">${h.scale != null ? h.scale : ''}${dv != null ? ` <small class="${dv < 0 ? 'neg' : 'pos'}">${dv > 0 ? '+' : dv < 0 ? '−' : '±'}${Math.abs(dv)}</small>` : ''}</td><td>${h.pct != null ? esc(pctWord(h.pct).replace(' percentile', ' pct')) : h.above ? 'above grade' : h.grade != null ? 'grade ' + h.grade + ' test' : ''}</td></tr>`; }).join('')}</tbody></table>${(() => { const h = hist.find(x => x.cats); return h ? `<h4 class="subh">By topic <small>${esc([h.pm, h.year].filter(Boolean).join(' '))}</small></h4>${catsHtml(h)}` : ''; })()}${fastTargetsHtml(fastTargets(sec, name))}${keys.length ? `<details class="fall"><summary>Everything in the report</summary><dl>${keys.map(k => `<dt>${esc(k)}</dt><dd>${esc(fi[k])}</dd>`).join('')}</dl></details>` : ''}</section>`;
}

// Kept conference text, per student: only the boxes you edited ({ strengths, …, saved }), and base: Tally's draft each
// edit started from, so the form can say when the numbers have moved on since.
function cleanConfForms(o) { const out = {}; const BOX = ['tests', 'strengths', 'concerns', 'work']; const lim = b => b === 'tests' ? 600 : 4000;   // a box you never edited isn't kept: it follows Tally's numbers
  if (o && typeof o === 'object') for (const k of Object.keys(o)) { const v = o[k]; if (!SAFE_KEY(k) || !v || typeof v !== 'object') continue; const x = { saved: typeof v.saved === 'string' ? v.saved.slice(0, 30) : '' };
    BOX.forEach(b => { if (typeof v[b] === 'string') x[b] = v[b].slice(0, lim(b)); }); if (v.base && typeof v.base === 'object') { x.base = {}; BOX.forEach(b => { if (typeof v.base[b] === 'string') x.base[b] = v.base[b].slice(0, lim(b)); }); }
    if (BOX.some(b => b in x)) out[k] = x; }
  return out; }

function openConference(sec, name) {
  const d = conferenceData(sec, name); const st = state.settings; const k = norm(name);
  sec.confForms = sec.confForms || {}; const kept = sec.confForms[k] || null;
  const draft = conferenceDraft(d);
  const v = { grade: st.gradeLevel || '7', teacher: st.teacherName || '', course: (st.courseNames || {})[sec.prep] || (sec.prep === 'acc' ? 'Grade 7 Accelerated Math' : 'Grade 7 Math'), period: sec.period != null ? String(sec.period) : '',
    current: d.r && d.r.rounded != null ? String(d.r.rounded) : '', rc: { ...d.rc } };
  const fresh = { tests: conferenceTests(d), strengths: draft.strengths, concerns: draft.concerns, work: conferenceWork(d) };
  const has = b => !!kept && typeof kept[b] === 'string'; const base = { ...((kept && kept.base) || {}) };
  ['tests', 'strengths', 'concerns', 'work'].forEach(b => { v[b] = has(b) ? kept[b] : fresh[b]; });
  const BOXID = { tests: 'cfTests', strengths: 'cfStrengths', concerns: 'cfConcerns', work: 'cfWork' };
  const boxNote = b => !has(b) ? '' : `<p class="cfEdited" data-for="${b}">${base[b] != null && base[b] !== fresh[b] ? `<b>Tally's numbers changed since you edited this.</b> <button class="linkbtn" data-cfmerge="${b}">Add the new lines</button> · ` : 'Your words. '}<button class="linkbtn" data-cfdraft="${b}">Back to Tally's draft</button></p>`;
  const m = $('#modal'); m.classList.remove('hidden'); m.classList.add('private');
  const H = st.hideNames; const shown = H ? mask(name) : niceName(name);
  const rcCell = q => `<label class="cf-rc">${q}<input type="text" id="cf${q}" value="${v.rc[q] == null ? '' : esc(String(v.rc[q]))}" inputmode="numeric" maxlength="4"></label>`;
  m.innerHTML = `<div class="panel wide confPanel"><header><h2>Parent conference · ${esc(shown)}</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body confBody">
      <div class="confForm">
        <div class="row3 r2"><div class="field"><label for="cfName">Student name</label><input type="text" id="cfName" value="${esc(H ? '' : niceName(name))}" ${H ? 'placeholder="hidden while names are hidden"' : ''}></div><div class="field sm"><label for="cfGrade">Grade</label><input type="text" id="cfGrade" value="${esc(v.grade)}" maxlength="4"></div></div>
        <div class="row3 r3"><div class="field"><label for="cfTeacher">Teacher</label><input type="text" id="cfTeacher" value="${esc(v.teacher)}"></div><div class="field"><label for="cfCourse">Course</label><input type="text" id="cfCourse" value="${esc(v.course)}"></div><div class="field sm"><label for="cfPeriod">Period</label><input type="text" id="cfPeriod" value="${esc(v.period)}" maxlength="4"></div></div>
        <div class="row3 r4"><div class="field sm"><label for="cfCurrent">Current grade %</label><input type="text" id="cfCurrent" value="${esc(v.current)}" maxlength="5"></div><div class="field cf-rcs"><label>Report card grades</label><div>${['Q1', 'Q2', 'S1', 'Q3', 'Q4', 'S2'].map(rcCell).join('')}</div></div></div>
        <div class="field"><label for="cfTests">FAST / EBA test history</label><textarea id="cfTests" rows="2" placeholder="No test results in Tally yet">${esc(v.tests)}</textarea>${boxNote('tests')}</div>
        <div class="field"><label for="cfStrengths">Strengths in class</label><textarea id="cfStrengths" rows="5">${esc(v.strengths)}</textarea>${boxNote('strengths')}${!has('strengths') && !draft.strengths ? '<p class="ghint" style="margin:2px 0 0">Nothing in the numbers stands out yet. Add something you have seen in class, or one of the notes beside the form.</p>' : ''}</div>
        <div class="field"><label for="cfConcerns">Concerns in class</label><textarea id="cfConcerns" rows="5">${esc(v.concerns)}</textarea>${boxNote('concerns')}</div>
        <div class="field"><label for="cfWork">Missing assignments &amp; assignments needing to be redone</label><textarea id="cfWork" rows="7">${esc(v.work)}</textarea>${boxNote('work')}</div>
      </div>
      <aside class="confSide">
        ${(() => { const ck = conferenceChecks(d); return ck.length ? `<h3>Check before printing</h3><ul class="cfChecks">${ck.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''; })()}
        <h3>Notes</h3>
        ${H ? '<p class="ghint">Hidden while names are hidden.</p>' : d.notes.length ? `<ul class="cfNotes">${d.notes.slice().reverse().map(n => `<li><time>${esc(fmtDate(localDay(n.at)))}</time><p>${esc(n.text)}</p><span><button class="pill pale small" data-cfadd="strengths" data-nid="${esc(n.id)}">+ Strengths</button><button class="pill pale small" data-cfadd="concerns" data-nid="${esc(n.id)}">+ Concerns</button></span></li>`).join('')}</ul>` : '<p class="ghint">No notes for this student.</p>'}
        ${(() => { const fl = H ? [] : fastFlags(fastInfo(sec, name)); return fl.length ? `<h3>From FAST</h3><div class="fflags">${fl.map(x => `<span class="fflag ${x.cls}">${esc(x.t)}</span>`).join('')}</div>` : ''; })()}
        <h3>From the gradebook</h3>
        <ul class="cfFacts">${[(() => { const t = H ? null : fastTargets(sec, name); return t && t.gain ? `FAST gain: ${t.gain.score} or more on PM3${t.latest ? ` (${esc(t.latest.pm)} ${t.latest.scale}${t.latest.scale >= t.gain.score ? ', a gain already' : ''})` : ''}` : t && t.latest ? `FAST ${esc(t.latest.pm)}: ${t.latest.scale}, ${esc(t.latestBucket ? t.latestBucket.label : '')}` : ''; })(), d.r ? `${esc(Q_NAMES[d.q - 1])}: ${d.r.rounded}% ${d.r.letter}` : '', ...Object.entries(d.cats).filter(([, x]) => x.pct != null).map(([c, x]) => `${esc(c)}: ${Math.round(x.pct)}%`), d.ix && d.ix.poss ? `IXL: ${d.ix.done} of ${d.ix.poss} skills at goal` : '', `Missing: ${d.missing.length + d.missedTests.length}`, d.rt.ok ? 'Retake: eligible' : `Retake: ${esc(retakeWhy(d.rt))}`, d.ixlGrade && d.ixlGrade.max ? `IXL in Focus: ${d.ixlGrade.got} of ${d.ixlGrade.max}` : ''].filter(Boolean).map(x => `<li>${x}</li>`).join('')}</ul>
      </aside>
    </div>
    <footer>${kept ? `<small class="ghint" style="margin:0">Your edits from ${esc(fmtDate(localDay(kept.saved)))}</small><button class="linkbtn" id="cfRefill">Start over from Tally</button>` : ''}<div class="spacer"></div><button class="pill pale" id="mCancel">Close</button><button class="pill" id="cfPrint">Print</button></footer></div>`;
  const val = id => ($('#' + id) || {}).value || '';
  const keep = () => {   // remember the teacher, course and grade for next time; the student's text for this student
    st.teacherName = val('cfTeacher').slice(0, 80); st.gradeLevel = val('cfGrade').slice(0, 4); st.courseNames = { ...(st.courseNames || {}), [sec.prep]: val('cfCourse').slice(0, 80) };
    const now = { tests: val('cfTests').slice(0, 600), strengths: val('cfStrengths').slice(0, 4000), concerns: val('cfConcerns').slice(0, 4000), work: val('cfWork').slice(0, 4000) };
    const out = {}, b2 = {}; Object.keys(now).forEach(b => { if (now[b] !== fresh[b]) { out[b] = now[b]; b2[b] = base[b] != null ? base[b] : fresh[b]; } });   // each box on its own: an untouched box keeps following the numbers
    if (Object.keys(out).length) sec.confForms[k] = { ...out, base: b2, saved: Object.keys(out).every(b => has(b) && kept[b] === out[b]) && kept.saved ? kept.saved : new Date().toISOString() }; else delete sec.confForms[k];
    save(); };
  const close = () => { keep(); m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.querySelectorAll('[data-cfadd]').forEach(b => b.onclick = () => { const n = d.notes.find(x => x.id === b.dataset.nid); if (!n) return; const ta = $(b.dataset.cfadd === 'strengths' ? '#cfStrengths' : '#cfConcerns'); ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' : '') + n.text; ta.focus(); });
  const noteOf = b => m.querySelector(`.cfEdited[data-for="${b}"]`);
  m.querySelectorAll('[data-cfmerge]').forEach(x => x.onclick = () => { const b = x.dataset.cfmerge; const ta = $('#' + BOXID[b]); const have = new Set(ta.value.split('\n').map(l => l.trim()).filter(Boolean));
    const add = fresh[b].split('\n').filter(l => l.trim() && !have.has(l.trim()) && !/:$/.test(l.trim())); if (add.length) ta.value = ta.value.replace(/\s+$/, '') + '\n' + add.join('\n'); base[b] = fresh[b];
    const n = noteOf(b); if (n) n.innerHTML = add.length ? `Added ${add.length === 1 ? '1 line' : add.length + ' lines'} from Tally at the end. Remove any you don't need.` : 'Nothing new to add.'; });
  m.querySelectorAll('[data-cfdraft]').forEach(x => x.onclick = () => { const b = x.dataset.cfdraft; $('#' + BOXID[b]).value = fresh[b]; base[b] = fresh[b]; const n = noteOf(b); if (n) n.remove(); });
  const rf = $('#cfRefill'); if (rf) rf.onclick = async () => { if (!await ask('Replace your edits with a fresh draft from Tally?')) return; delete sec.confForms[k]; save(); openConference(sec, name); };
  $('#cfPrint').onclick = () => { keep(); printConference({ name: val('cfName') || niceName(name), grade: val('cfGrade'), teacher: val('cfTeacher'), course: val('cfCourse'), period: val('cfPeriod'), current: val('cfCurrent'),
    rc: Object.fromEntries(['Q1', 'Q2', 'S1', 'Q3', 'Q4', 'S2'].map(q => [q, val('cf' + q)])), tests: val('cfTests'), strengths: val('cfStrengths'), concerns: val('cfConcerns'), work: val('cfWork') }); };
}

// The form as the school prints it: banner, title, underlined fields, three writing blocks, footer — one Letter page.
function conferenceHtml(x) {
  const line = (label, value, cls) => `<span class="f ${cls || ''}"><b>${label}</b><span class="u">${esc(value || '')}</span></span>`;
  const block = (label, text) => `<section><b>${label}</b><div class="t">${esc(text || '')}</div></section>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Parent Conference Input Form: ${esc(x.name)}</title><style>
@page{size:letter;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#fff}
body{font-family:Arial,Helvetica,sans-serif;color:#000;--fs:10.5pt}
.page{width:8.5in;height:11in;position:relative;overflow:hidden;margin:0 auto}
.top{display:block;width:8.5in;height:auto}
h1{font-size:11pt;font-weight:bold;text-align:center;margin:.02in 0 .2in}
.in{padding:0 .98in 0 .98in}
.r{display:flex;align-items:flex-end;gap:.12in;margin:0 0 .2in;font-size:10.5pt;white-space:nowrap}
.f{display:flex;align-items:flex-end;gap:.05in;flex:1}.f b{font-weight:bold}.f.n{flex:0 0 auto}
.u{flex:1;border-bottom:1px solid #000;min-width:.5in;padding:0 .04in 1px;font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.15;color:#0b2a6b;overflow:hidden;text-overflow:ellipsis}
.rc .f{flex:0 0 auto}.rc .f b{font-weight:normal}.rc .u{width:.55in;flex:0 0 .55in;text-align:center}
.tests .u{white-space:normal;overflow:visible}
section{margin:0 0 .08in}section b{display:block;font-size:10.5pt;margin-bottom:.05in}
.t{white-space:pre-wrap;font-size:var(--fs);line-height:1.3;color:#0b2a6b;min-height:1.6in;max-height:1.75in;overflow:hidden}
.foot{position:absolute;left:.7in;right:.7in;bottom:.22in}.foot img{width:100%;height:auto;display:block}
.bar{position:fixed;top:8px;right:8px}.bar button{font:inherit;padding:6px 14px}
@media print{.bar{display:none}}
@media screen{body{background:#eee}.page{background:#fff;margin:16px auto;box-shadow:0 2px 12px rgba(0,0,0,.2)}}
</style></head><body><div class="bar"><button onclick="window.print()">Print</button></div><div class="page">
<img class="top" src="${CONF_TOP}" alt="Windy Hill Middle School">
<h1>PARENT CONFERENCE INPUT FORM</h1>
<div class="in">
<div class="r">${line('Student Name:', x.name)}${line('Grade:', x.grade, 'n" style="flex:0 0 1.3in')}</div>
<div class="r">${line('Teacher:', x.teacher)}${line('Course:', x.course)}${line('Period:', x.period, 'n" style="flex:0 0 .95in')}</div>
<div class="r"><span class="f n"><b>Current Grade:</b><span class="u" style="width:.55in;text-align:center">${esc(x.current || '')}</span><b>%</b></span></div>
<div class="r" style="margin-bottom:.1in"><b>Report Card Grades:</b></div>
<div class="r rc">${['Q1', 'Q2', 'S1', 'Q3', 'Q4', 'S2'].map(q => line(q + ':', x.rc[q])).join('<span style="flex:1"></span>')}</div>
<div class="r tests">${line('FAST/EBA Test History:', x.tests)}</div>
${block('Student Strengths in Class:', x.strengths)}${block('Student Concerns in Class:', x.concerns)}${block('Missing Assignments &amp; Assignments Needing to be Redone:', x.work)}
</div>
<div class="foot"><img src="${CONF_FOOT}" alt="whm.lake.k12.fl.us · 3575 Hancock Rd. Clermont, FL 34711 · (352) 394-2123 · (352) 394-7901"></div>
</div><script>
// a long box shrinks its text until it fits its space, so the form stays one page
document.querySelectorAll('.t').forEach(function(t){ var s=10.5; while (t.scrollHeight > t.clientHeight + 1 && s > 7) { s -= 0.25; t.style.fontSize = s + 'pt'; } });
<\/script></body></html>`;   // <\/script>: a literal close tag would end Tally's own script
}
async function printConference(x) { if (state.settings.hideNames && !await ask(`Names are hidden, but the form opens with ${x.name ? 'the student\'s full name' : 'the student\'s details'}, grades and notes on screen. Open it?`, 'Open the form')) return; openPrint(conferenceHtml(x), 'Conference-form.html', true); }   // no student name in the file name
