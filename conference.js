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
  if (!d.rt.noIxl && d.rt.unit && d.rt.nUnit && !d.rt.short.length) S.push(`• Every ${d.rt.unit.short} IXL skill finished`);
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
      ['level', 'scale', 'pct', 'grade'].forEach(f => { if (n(h[f]) != null) x[f] = h[f]; }); if (h.above) x.above = true; return x; }).filter(h => h.level != null || h.scale != null);
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
function mergeTests(a, b) { const out = { ...(a || {}) }; for (const k in b) { const keep = (out[k] || []).filter(h => !b[k].some(x => testSig(x) === testSig(h))); out[k] = keep.concat(b[k]); } return out; }
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
    keys.forEach(k => { add[k] = (add[k] || []).filter(h => !st.tests.some(x => testSig(x) === testSig(h))).concat(st.tests.map(t => ({ ...t }))); info[k] = { FAST: { fields: { ...st.info, ...(st.name ? { Student: st.name } : {}), ...(st.id ? { ID: st.id } : {}) }, at, file: String(file || '') } }; });
  });
  state.tests = mergeTests(state.tests, cleanTests(add));
  state.testInfo = { ...(state.testInfo || {}), ...cleanTestInfo(info) };
  save(); const wins = fx.windows.map(w => w.pm + ' ' + w.year).join(' and ');
  const names = unmatched.slice(0, 3).map(st => esc(st.name ? shown(st.name) : 'ID ' + st.id)).join('; ');
  toast(`FAST report (${esc(wins)}): ${plural(byName + byId, 'student')} matched to your classes${byId ? ` (${byId} by ID, the rest by name)` : ' by name'}${unmatched.length ? ` · <b>${unmatched.length} not in your classes</b>: ${names}${unmatched.length > 3 ? '…' : ''} (kept, in case they join)` : ''}${fx.blank ? ` · ${plural(fx.blank, 'row')} with no name or ID skipped` : ''}. Every column was kept.`, false, 10000);
  render();
}
// Everything the FAST report said about a student, by column heading ({} when there is no report).
function fastInfo(sec, name) { const f = findStudent(sec, name); for (const k of testKeys(f.id, name)) { const v = ((state.testInfo || {})[k] || {}).FAST; if (v) return v.fields || {}; } return {}; }
const flagOn = v => v != null && String(v).trim() !== '' && !/^(n|no|0|-|none)$/i.test(String(v).trim());
// The flags a teacher acts on, from the report: L30 first.
function fastFlags(fi) { const out = []; if (flagOn(fi.L30)) out.push({ k: 'L30', t: 'Lowest 30%', cls: 'l30' }); ['ESE', '504', 'ELL'].forEach(c => { if (flagOn(fi[c])) out.push({ k: c, t: /^y(es)?$/i.test(fi[c]) ? c : `${c} (${fi[c]})`, cls: '' }); }); if (flagOn(fi.TestedAboveGrade)) out.push({ k: 'above', t: 'Tests above grade', cls: '' }); return out; }
const isL30 = (sec, name) => flagOn(fastInfo(sec, name).L30);

// Test history for one student: imported FAST results, then the FAST score the Seating Chart backup carried.
function testHistory(sec, name) {
  const f = findStudent(sec, name); const seen = new Set(); const out = [];
  testKeys(f.id, name).forEach(k => ((state.tests || {})[k] || []).forEach(h => { const sig = testSig(h); if (seen.has(sig)) return; seen.add(sig); out.push(h); }));
  out.sort((a, b) => (b.year + b.pm).localeCompare(a.year + a.pm));
  const si = (sec.seatInfo || {})[f.row && f.row.display ? f.row.display : name] || null;
  if (!out.some(h => /FAST/i.test(h.test)) && si && (si.level || si.pct != null || si.scale != null)) out.push({ test: 'FAST', pm: 'PM3', year: '', level: si.level, scale: si.scale, pct: si.pct, src: 'seating' });
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
function fastYearNow() { let y = ''; Object.values(state.tests || {}).forEach(list => (list || []).forEach(h => { if (/FAST/i.test(h.test) && h.year && h.year > y) y = h.year; })); return y || null; }
function prevSchoolYear(y) { const m = /^(\d{4})-(\d{2,4})$/.exec(y || ''); if (!m) return null; const a = Number(m[1]) - 1; return `${a}-${String(a + 1).slice(-m[2].length)}`; }
// Everything the page says about a student's FAST year: last year's PM3, this year's windows, and what PM2 / PM3 need.
function fastTargets(sec, name) {
  const hist = testHistory(sec, name).filter(h => /FAST/i.test(h.test) && h.scale != null); if (!hist.length) return null;
  const fi = fastInfo(sec, name); const gradeLevel = Number(String(fi.GradeLevel || state.settings.gradeLevel || '7').replace(/^0+/, '')) || 7;
  /* This year is the newest school year in any FAST result in Tally, not in this student's: a student who missed PM1
     has only last year's PM3, and that is still last year's (audit, 24 Oct 2026: it was shown as "PM3 this year" on
     the wrong grade's scale). Last year is the school year before it. */
  const thisYear = fastYearNow(); const lastYear = thisYear ? prevSchoolYear(thisYear) : null;
  const prior0 = hist.find(h => h.pm === 'PM3' && h.year === lastYear) || (hist.some(h => h.year) ? null : hist.find(h => h.pm === 'PM3' && !h.year));
  const prior = prior0 ? { ...prior0, grade: prior0.grade || gradeLevel - 1 } : null;
  const now = hist.filter(h => h.year === thisYear && h.year).sort((a, b) => a.pm.localeCompare(b.pm)); const latest = now[now.length - 1] || null;
  /* The test taken this year: accelerated classes sit the grade above, and the FAST report's "tested above grade" flag
     says so too. When the report also gives this year's achievement level, the scale whose cut scores reproduce that
     level wins, so a class flag that is wrong for one student doesn't put their scores on the wrong table. */
  const above = sec.prep === 'acc' || now.some(h => h.above);
  const agree = g => now.filter(h => h.level != null && fastBucket(g, h.scale) && fastBucket(g, h.scale).level === h.level).length;
  const pref = above ? [gradeLevel + 1, gradeLevel] : [gradeLevel, gradeLevel + 1];
  const gradeNow = agree(pref[1]) > agree(pref[0]) && FAST_MATH[pref[1]] ? pref[1] : pref[0];
  const b = s => fastBucket(gradeNow, s); const c = FAST_MATH[gradeNow];
  const gain = prior ? fastGainFloor(gradeNow, prior) : null;
  const rows = [];
  if (gain) rows.push({ k: 'gain', what: 'Learning gain', sub: gain.score === fastLevelFloor(gradeNow, 3) ? 'Level 3, on grade level' : gain.label, score: gain.score, why: 'counts for the school grade' });
  if (c) [[2, 'Level 2'], [3, 'Level 3'], [4, 'Level 4'], [5, 'Level 5']].forEach(([lv, lab]) => { const sc = fastLevelFloor(gradeNow, lv); if (!rows.some(r => r.score === sc)) rows.push({ k: 'l' + lv, what: lab, sub: lv === 3 ? 'on grade level' : '', score: sc }); });
  rows.sort((x, y) => x.score - y.score);
  rows.forEach(r => { r.met = latest && latest.scale != null && latest.scale >= r.score; r.gap = latest && latest.scale != null ? r.score - latest.scale : null; });
  return { gradeNow, gradeLevel, thisYear, prior, priorBucket: prior ? fastBucket(prior.grade, prior.scale) : null, latest, latestBucket: latest ? b(latest.scale) : null, now, rows, gain };
}
function fastTargetsHtml(t) {
  if (!t) return '';
  const lvl = bk => bk ? `<span class="flvl l${bk.level}">${esc(bk.label)}</span>` : '';
  const grade = g => `<small>grade ${g} test</small>`;
  const cards = `${t.prior ? `<div class="gcard"><small>Last year's PM3</small><b>${t.prior.scale}</b><span>${lvl(t.priorBucket)} ${grade(t.prior.grade)}</span></div>` : `<div class="gcard"><small>Last year's PM3</small><b>—</b><span>not in Tally, so no gain target</span></div>`}
    ${t.latest ? `<div class="gcard"><small>${esc(t.latest.pm)} this year</small><b>${t.latest.scale}</b><span>${lvl(t.latestBucket)} ${grade(t.gradeNow)}${t.gain && t.latest.scale >= t.gain.score ? ' <b class="pos">already a gain</b>' : ''}</span></div>` : `<div class="gcard"><small>This year</small><b>—</b><span>no window scored yet</span></div>`}`;
  const list = t.rows.map(r => `<tr class="${r.met ? 'met' : ''}"><td>${esc(r.what)}${r.sub ? ` <small>${esc(r.sub)}</small>` : ''}</td><td class="num"><b>${r.score}</b>${r.k === 'gain' ? '' : ''}</td><td>${r.met ? `${ico('check')} reached on ${esc(t.latest.pm)}` : r.gap != null ? `<small>${r.gap} more than ${esc(t.latest.pm)}</small>` : ''}${r.why && !r.met ? ` <small class="why">· ${esc(r.why)}</small>` : ''}</td></tr>`).join('');
  return `<div class="fastT"><div class="gcards two">${cards}</div>
    <h4 class="subh">What PM2 and PM3 need <small>grade ${t.gradeNow} scale</small></h4>
    <table class="ftab targets"><tbody>${list}</tbody></table></div>`;
}
/* ---------- the FAST report: one printed page per student for a data talk ----------
   Last year's PM3 and this year's windows in their buckets, each on a scale drawn from the state cut scores, the
   targets for PM2 and PM3 (gain, each level, on grade level), the history, and a box for the student's own goals. */
function fastScaleHtml(grade, marks) {
  const c = FAST_MATH[grade]; if (!c) return '';
  const lo = c[0], hi = c[8]; const X = v => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
  const bands = [[c[0], c[1], 'Low 1', 'l1'], [c[1], c[2], 'Mid 1', 'l1'], [c[2], c[3], 'High 1', 'l1'], [c[3], c[4], 'Low 2', 'l2'], [c[4], c[5], 'High 2', 'l2'], [c[5], c[6], 'Level 3', 'l3'], [c[6], c[7], 'Level 4', 'l4'], [c[7], c[8], 'Level 5', 'l5']];
  /* Scores sit above the bands and targets below, so a PM1 next to its target never overlaps it; marks at the same
     score share one label, and marks within a few points of each other take turns standing taller (audit, 24 Oct). */
  const row = (list, cls) => { const ms = []; list.filter(m => m.v != null).sort((a, b) => a.v - b.v).forEach(m => { const v = Math.max(lo, Math.min(m.v, hi)); const same = ms.find(x => x.v === v); if (same) same.label += ' · ' + m.label; else ms.push({ v, label: m.label, shown: m.v }); });
    ms.forEach((m, j) => { m.tall = j > 0 && X(m.v) - X(ms[j - 1].v) < 7 && !ms[j - 1].tall; });
    const under = /under/.test(cls);
    return ms.length ? `<div class="${cls}${ms.some(m => m.tall) ? ' tiered' : ''}">${ms.map(m => `<div class="mk${m.tall ? ' tall' : ''}" style="left:${X(m.v)}%">${under ? `<i></i><b>${esc(m.label)}</b><small>${m.shown}</small>` : `<b>${esc(m.label)}</b><small>${m.shown}</small><i></i>`}</div>`).join('')}</div>` : ''; };
  return `<div class="scale">${row(marks.filter(m => m.cls !== 'tg'), 'marks')}
    <div class="bands">${bands.map(([a, b, lab, cls]) => `<div class="${cls}" style="left:${X(a)}%;width:${X(b) - X(a)}%"><span>${lab}</span><small>${a}</small></div>`).join('')}</div>${row(marks.filter(m => m.cls === 'tg'), 'marks under')}</div>`;
}
function fastReportSection(sec, name) {
  const t = fastTargets(sec, name); const fi = fastInfo(sec, name); const hist = testHistory(sec, name).filter(h => /FAST/i.test(h.test));
  const flags = fastFlags(fi); const first = niceName(name).split(' ')[0];
  if (!t) return `<section class="rep fast"><h1>${esc(niceName(name))}</h1><div class="meta">${esc(sec.label)} · printed ${new Date().toLocaleDateString()}</div><p>No FAST results in Tally for this student yet.</p></section>`;
  const lvl = bk => bk ? `<span class="lv l${bk.level}">${esc(bk.label)}</span>` : '';
  const gainWords = t.gain && t.priorBucket ? `${first} was <b>${esc(t.priorBucket.label)}</b> on last year's grade-${t.prior.grade} test. This year a learning gain is <b>${esc(t.gain.label)} or higher: ${t.gain.score} or more</b> on the grade-${t.gradeNow} scale.${t.latest ? (t.latest.scale >= t.gain.score ? ` ${esc(t.latest.pm)} already got there${t.latest.pm === 'PM3' ? '' : ', and PM3 is the one that counts, so hold it'}.` : ` ${esc(t.latest.pm)} was ${t.latest.scale}, so ${t.gain.score - t.latest.scale} more.`) : ''} A gain counts for the school grade.` : 'No last-year PM3 in Tally, so there is no gain target yet; the level targets still apply.';
  const rows = t.rows.map(r => `<tr class="${r.met ? 'met' : ''}"><td><span class="box"></span>${esc(r.what)}${r.sub ? ` <small>${esc(r.sub)}</small>` : ''}</td><td class="r"><b>${r.score}</b></td><td>${r.met ? `✓ reached on ${esc(t.latest.pm)}` : r.gap != null ? `${r.gap} more than ${esc(t.latest.pm)}` : ''}</td></tr>`).join('');
  const histRows = hist.slice().sort((a, b) => (a.year + a.pm).localeCompare(b.year + b.pm)).map(h => { const g = h.year === t.thisYear ? t.gradeNow : (h.grade || (t.prior && t.prior.grade) || t.gradeLevel - 1); const bk = h.scale != null ? fastBucket(g, h.scale) : null;
    return `<tr><td>${esc([h.pm, h.year].filter(Boolean).join(' '))}</td><td class="r">${h.scale != null ? h.scale : ''}</td><td>${h.level != null ? 'Level ' + h.level : ''}</td><td>${bk ? esc(bk.label) : ''}</td><td>${h.pct != null ? esc(pctWord(h.pct)) : ''}</td><td>grade ${g} test</td></tr>`; }).join('');
  const l3 = fastLevelFloor(t.gradeNow, 3);
  const thisYearMarks = [...t.now.map(h => ({ v: h.scale, label: h.pm, cls: 'now' })), ...(t.gain && t.gain.score !== l3 ? [{ v: t.gain.score, label: 'Gain', cls: 'tg' }] : []), { v: l3, label: t.gain && t.gain.score === l3 ? 'Gain · grade level' : 'Grade level', cls: 'tg' }];
  return `<section class="rep fast"><div class="head"><div><h1>${esc(niceName(name))}</h1><div class="meta">${esc(sec.label)} · FAST Mathematics · printed ${new Date().toLocaleDateString()}</div></div>${flags.length ? `<div class="flags">${flags.map(x => `<span>${esc(x.t)}</span>`).join('')}</div>` : ''}</div>
    <div class="cards">${t.prior ? `<div><small>Last year's PM3</small><b>${t.prior.scale}</b>${lvl(t.priorBucket)}<span>grade ${t.prior.grade} test${t.prior.pct != null ? ' · ' + esc(pctWord(t.prior.pct)) : ''}</span></div>` : `<div><small>Last year's PM3</small><b>—</b><span>not in Tally</span></div>`}
      ${t.now.length ? '' : `<div><small>This year</small><b>—</b><span>no window scored yet</span></div>`}${t.now.map(h => `<div><small>${esc(h.pm)} this year</small><b>${h.scale}</b>${lvl(fastBucket(t.gradeNow, h.scale))}<span>grade ${t.gradeNow} test${t.prior && t.prior.scale != null ? ` · ${h.scale - t.prior.scale >= 0 ? '+' : '−'}${Math.abs(h.scale - t.prior.scale)} since PM3` : ''}</span></div>`).join('')}
      ${t.gain && t.gain.score === l3 ? `<div class="goal"><small>Gain this year</small><b>${l3}+</b><span>Level 3, on grade level</span></div>` : `${t.gain ? `<div class="goal"><small>Gain this year</small><b>${t.gain.score}+</b><span>${esc(t.gain.label)}</span></div>` : ''}<div class="goal"><small>Level 3 (on grade level)</small><b>${l3}+</b><span>grade ${t.gradeNow} scale</span></div>`}</div>
    <h2>Last year <span class="hs">grade ${t.prior ? t.prior.grade : t.gradeLevel - 1} scale</span></h2>${fastScaleHtml(t.prior ? t.prior.grade : t.gradeLevel - 1, t.prior ? [{ v: t.prior.scale, label: 'PM3', cls: 'now' }] : [])}
    <h2>This year <span class="hs">grade ${t.gradeNow} scale</span></h2>${fastScaleHtml(t.gradeNow, thisYearMarks)}
    <p class="gain">${gainWords}</p>
    <h2>What PM2 and PM3 need</h2><table class="targets"><tbody>${rows}</tbody></table>
    <h2>Every window</h2><table class="hist"><thead><tr><th>Window</th><th class="r">Score</th><th>Level</th><th>Bucket</th><th>Percentile</th><th>Test</th></tr></thead><tbody>${histRows}</tbody></table>
    <div class="pledge"><div><b>My goal for PM2</b><i></i></div><div><b>My goal for PM3</b><i></i></div><div class="wide"><b>How I'll get there</b><i></i><i></i></div><div class="sig"><span>Student</span><span>Teacher</span><span>Date</span></div></div>
    <div class="foot">Levels and the Level 1 and Level 2 subcategories are the state cut scores (State Board of Education, 10 Jan 2024). Level 3 means working on grade level. A learning gain is the next subcategory up from Level 1 or 2, the next level up from Level 3 or 4, or Level 5 again. Scores come from the Focus FAST report imported into Tally.</div></section>`;
}
const FAST_REPORT_CSS = `
.rep.fast .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:8px 0 2px}.rep.fast .cards>div{border:1px solid #bbb;border-radius:6px;padding:6px 9px}.rep.fast .cards small{display:block;font-size:7.5pt;text-transform:uppercase;letter-spacing:.06em;color:#333}.rep.fast .cards b{font-size:19pt;font-weight:900;line-height:1.1;display:block}.rep.fast .cards span{display:block;font-size:8pt;color:#444}.rep.fast .cards .goal{border:1.5px solid #000}
.rep.fast .lv{display:inline-block;border:1px solid #000;border-radius:8px;padding:0 6px;font-size:8pt;font-weight:bold;margin:2px 0}
.rep.fast .flags{display:flex;gap:6px;flex-wrap:wrap}.rep.fast .flags span{border:1px solid #000;border-radius:8px;padding:1px 8px;font-size:8.5pt;font-weight:bold}
.scale{margin:4px 0 12px}.bands{position:relative;height:26px;border:1px solid #000;border-radius:4px;overflow:hidden}.bands>div{position:absolute;top:0;bottom:0;border-left:1px solid #000;font-size:7.5pt;padding:2px 0 0 3px;overflow:hidden;white-space:nowrap}.bands>div:first-child{border-left:none}.bands span{display:block;font-weight:bold}.bands small{display:block;font-size:7pt;color:#333}
.bands .l1{background:#f0f0f0}.bands .l2{background:#dcdcdc}.bands .l3{background:#c4c4c4}.bands .l4{background:#a8a8a8}.bands .l5{background:#8c8c8c}.bands .l4,.bands .l5{color:#fff}.bands .l4 small,.bands .l5 small{color:#eee}
.marks{position:relative;height:34px}.marks.tiered{height:56px}.mk{position:absolute;bottom:0;transform:translateX(-50%);text-align:center;font-size:7.5pt;line-height:1.05;display:flex;flex-direction:column;align-items:center;white-space:nowrap}.mk b{font-size:8.5pt}.mk i{display:block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #000}.marks .mk.tall i{border:none;border-left:1px solid #000;height:30px}.marks.under{height:30px}.marks.under .mk{bottom:auto;top:0}.marks.under .mk i{border-top:none;border-bottom:8px solid #555}.marks.under .mk b{color:#333;font-size:7.5pt}.marks.under.tiered{height:52px}.marks.under .mk.tall i{border:none;border-left:1px solid #555;height:30px}
.rep.fast .gain{margin:4px 0 8px;font-size:10pt}
.rep.fast .targets td{padding:3px 6px;font-size:10pt}.rep.fast .targets tr.met td{color:#0F766E}.rep.fast .hist td,.rep.fast .hist th{font-size:9pt}
.rep.fast .pledge{grid-template-columns:1fr 1fr}.rep.fast .pledge .wide{grid-column:1/-1}.rep.fast .pledge b{display:block;margin-bottom:2px}.rep.fast .pledge i{display:block;border-bottom:1px solid #000;height:15px}`;
function printFastReports(sec, names, title) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${printFontCss()}</style><style>${REPORT_CSS}${FAST_REPORT_CSS}</style></head><body><div class="bar"><button onclick="window.print()">Print</button></div>${names.map(n => fastReportSection(sec, n)).join('')}</body></html>`;
  const go = () => openPrint(html, names.length === 1 ? 'FAST-report.html' : `FAST-reports-${sec.label.replace(/[^\w-]+/g, '_')}.html`, names.length === 1);
  if (state.settings.hideNames) { ask(`Names are hidden, but the ${names.length === 1 ? 'report opens with the student\'s full name and scores' : 'reports open with every student\'s full name and scores'} on screen. Open ${names.length === 1 ? 'it' : 'them'}?`, 'Open').then(ok => { if (ok) go(); }); return; }
  go();
}
// The student page's FAST section: newest first, with the change in scale score from one window to the next.
function testsSection(sec, name) {
  const hist = testHistory(sec, name); const fi = fastInfo(sec, name); if (!hist.length && !Object.keys(fi).length) return '';
  if (state.settings.hideNames) return `<section class="gsec" id="pTests"><h3>FAST</h3><p class="ghint">Hidden while names are hidden.</p></section>`;
  const flags = fastFlags(fi); const keys = Object.keys(fi).filter(k => !['Student', 'ID'].includes(k));
  return `<section class="gsec" id="pTests"><h3>FAST</h3>${flags.length ? `<div class="fflags">${flags.map(x => `<span class="fflag ${x.cls}">${esc(x.t)}</span>`).join('')}</div>` : ''}<table class="ftab"><tbody>${hist.map((h, j) => { const prev = hist[j + 1]; const dv = prev && h.scale != null && prev.scale != null ? h.scale - prev.scale : null;
    return `<tr><th scope="row">${esc([h.pm, h.year].filter(Boolean).join(' '))}</th><td>${h.level != null ? `<span class="flvl l${Math.min(5, Math.max(1, h.level))}">Level ${h.level}</span>` : ''}</td><td class="num">${h.scale != null ? h.scale : ''}${dv != null ? ` <small class="${dv < 0 ? 'neg' : 'pos'}">${dv > 0 ? '+' : dv < 0 ? '−' : '±'}${Math.abs(dv)}</small>` : ''}</td><td>${h.pct != null ? esc(pctWord(h.pct).replace(' percentile', ' pct')) : h.above ? 'above grade' : h.grade != null ? 'grade ' + h.grade + ' test' : ''}</td></tr>`; }).join('')}</tbody></table>${fastTargetsHtml(fastTargets(sec, name))}${keys.length ? `<details class="fall"><summary>Everything in the report</summary><dl>${keys.map(k => `<dt>${esc(k)}</dt><dd>${esc(fi[k])}</dd>`).join('')}</dl></details>` : ''}</section>`;
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
