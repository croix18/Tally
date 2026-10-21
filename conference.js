/* ---------- conference.js — the Windy Hill "Parent Conference Input Form", filled from Tally (spliced into app.js) ----------
   Croix, 21 Oct 2026: "Can you make it so Tally can generate this for me for whichever student I select?"
   One student at a time, from their page. Tally fills what it knows — current grade, report-card grades, test history,
   missing work, assessments under 70 % and whether a retake is allowed — and drafts Strengths and Concerns from the
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
function conferenceData(sec, name) {
  const f = findStudent(sec, name); const sum = studentSummary(sec, name); const books = studentBooks(sec, name); const openB = books.find(b => !b.closed);
  const r = openB ? computeGrade(openB.s, openB.i) : null;
  // report-card grades: only closed quarters are report-card grades; a semester is the average of its two quarters
  const rc = reportCard(sum.finals);
  // the open quarter's work
  const gb = openB ? openB.s.grades : null; const i = openB ? openB.i : -1;
  const missing = gb ? gb.assignments.filter(a => a.status && a.status[i] === 'missing').map(a => ({ name: a.name, max: a.max, due: a.due || '', cat: catIn(openB.s, a) })) : [];
  const tests = gb ? gb.assignments.filter(a => isAssess(openB.s, a) && a.status && a.status[i] === 'score' && a.values[i] != null).map(a => ({ name: a.name, v: Number(a.values[i]), max: a.max, pct: Number(a.values[i]) / a.max * 100 })) : [];
  const redo = tests.filter(t => t.pct < 70);
  const rt = retakeStatus(sec, name); const ix = ixlFor(sec, f.ixl);
  return { sec, name, f, sum, r, q: openB ? openB.q : currentQuarter(), rc, missing, tests, redo, rt, ix, hist: testHistory(sec, name), notes: notesOf(sec, name), cats: r ? r.cats : {} };
}

// A first draft of Strengths and Concerns, in plain sentences a parent can read. Only what the numbers show.
function conferenceDraft(d) {
  const pct = v => Math.round(v) + '%'; const s = [], c = [];
  const A = d.cats.Assessments, C = d.cats.Classwork;
  const best = d.tests.slice().sort((x, y) => y.pct - x.pct)[0];
  if (A && A.pct != null && A.pct >= 80) s.push(`Strong on assessments: ${pct(A.pct)} overall${best ? `, best on ${best.name} (${pct(best.pct)})` : ''}.`);
  else if (best && best.pct >= 85) s.push(`Best assessment so far: ${best.name} (${pct(best.pct)}).`);
  if (!d.missing.length && d.r) s.push('Turns in every assignment. Nothing is missing this quarter.');
  if (C && C.pct != null && C.pct >= 85) s.push(`Classwork is consistent: ${pct(C.pct)}.`);
  if (d.ix && d.ix.poss && d.ix.pct >= 80) s.push(`Keeps up with IXL: ${d.ix.done} of ${d.ix.poss} assigned skills at goal.`);
  else if (d.rt.unit && !d.rt.noIxl && !d.rt.short.length && d.rt.nUnit) s.push(`Finished every ${d.rt.unit.short} IXL skill.`);
  if (d.sum.d != null && d.sum.d >= 3) s.push(`Grade is up ${d.sum.d} points since the last gradebook.`);
  if (d.missing.length) c.push(`${plural(d.missing.length, 'assignment')} not handed in, each counted as a zero (listed below).`);
  if (A && A.pct != null && A.pct < 70) c.push(`Assessment average is ${pct(A.pct)}${d.redo.length ? `; ${plural(d.redo.length, 'assessment')} below 70% (listed below)` : ''}.`);
  else if (d.redo.length) c.push(`${plural(d.redo.length, 'assessment')} below 70% (listed below).`);
  if (d.ix && d.ix.poss && d.ix.pct < 60) { const ns = d.ix.open.reduce((a, u) => a + u.notStarted.length, 0); c.push(`IXL: ${d.ix.done} of ${d.ix.poss} assigned skills at goal${ns ? `; ${ns} not started` : ''}.`); }
  else if (d.rt.short.length) c.push(`${plural(d.rt.short.length, 'IXL skill')} in ${d.rt.unit.short} still below goal.`);
  if (d.sum.d != null && d.sum.d <= -3) c.push(`Grade is down ${-d.sum.d} points since the last gradebook.`);
  return { strengths: confLines(s), concerns: confLines(c) };
}
function conferenceWork(d) {
  const lines = [];
  if (d.missing.length) { lines.push('Not handed in (each counts as a zero until it is):'); d.missing.forEach(a => lines.push(`• ${a.name}, ${fmtN(a.max)} pts${a.due ? ', due ' + a.due : ''}`)); }
  if (d.redo.length) { if (lines.length) lines.push(''); lines.push('Assessments below 70%:'); d.redo.forEach(t => lines.push(`• ${t.name}, ${fmtN(t.v)}/${fmtN(t.max)} (${Math.round(t.pct)}%)`)); }
  if (d.redo.length || d.missing.length) { lines.push(''); lines.push(d.rt.ok ? 'Retakes: eligible now.' : `Retakes: not yet. First ${retakeWhy(d.rt, true)}.`); }
  return lines.join('\n');
}
// FAST / EBA history in one line, newest first: "FAST PM1 2026-27: Level 2, 231 (above grade); FAST PM3 2025-26: Level 4, 247, 81st percentile".
const ordinal = n => { n = Math.round(n); const t = n % 100; return n + (t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'); };
const pctWord = p => p < 1 ? 'below 1st percentile' : ordinal(p) + ' percentile';
function testLine(h) { return `${h.test}${h.pm ? ' ' + h.pm : ''}${h.year ? ' ' + h.year : ''}: ` + [h.level != null ? 'Level ' + h.level : '', h.scale != null ? String(h.scale) : '', h.pct != null ? pctWord(h.pct) : ''].filter(Boolean).join(', ') + (h.above ? ' (above grade)' : h.grade != null ? ` (grade ${h.grade} test)` : ''); }
function conferenceTests(d) { return d.hist.map(testLine).join('; '); }

/* ---------- FAST results ----------
   state.tests = { 'id:<Focus ID>' | 'n:<last|first>': [{ test: 'FAST', pm: 'PM1', year: '2026-27', level, scale, pct?, grade?, above? }] }.
   Kept once for the whole app (a student who changes period keeps their history), by ID and by name so either finds them.
   Teacher-only: hidden while names are hidden, never on Show student, never in a Board file. */
const looseName = n => { const m = String(n || '').match(/^([^,]+),\s*(\S+)/); if (m) return norm(m[1]) + '|' + norm(m[2]); const w = norm(n).split(' '); return w.length > 1 ? w[w.length - 1] + '|' + w[0] : norm(n); };
const testKeys = (id, name) => [id ? 'id:' + String(id).trim() : null, name ? 'n:' + looseName(name) : null].filter(Boolean);
const testSig = h => [h.test, h.pm || '', h.year || ''].join('|');
function cleanTests(o) {   // a declaration: migrate() runs before this file's consts exist
  const out = {}; if (!o || typeof o !== 'object') return out; const n = v => typeof v === 'number' && isFinite(v) ? v : undefined;
  for (const k of Object.keys(o)) { if (!SAFE_KEY(k) || !/^(id|n):/.test(k) || !Array.isArray(o[k])) continue;
    const list = o[k].filter(h => h && typeof h.test === 'string').slice(-40).map(h => { const x = { test: h.test.slice(0, 20), pm: typeof h.pm === 'string' ? h.pm.slice(0, 6) : '', year: typeof h.year === 'string' ? h.year.slice(0, 9) : '' };
      ['level', 'scale', 'pct', 'grade'].forEach(f => { if (n(h[f]) != null) x[f] = h[f]; }); if (h.above) x.above = true; return x; }).filter(h => h.level != null || h.scale != null);
    if (list.length) out[k.slice(0, 120)] = list; }
  return out;
}
function mergeTests(a, b) { const out = { ...(a || {}) }; for (const k in b) { const keep = (out[k] || []).filter(h => !b[k].some(x => testSig(x) === testSig(h))); out[k] = keep.concat(b[k]); } return out; }
// Every student on a roster, by ID and by loose name, for matching an imported report.
function rosterIndex() { const ids = new Set(), names = new Set(); rowCache = new Map(); state.order.forEach(k => { const s = state.sections[k]; if (!s || s.board) return; classStudents(s).forEach(n => { const f = findStudent(s, n); if (f.id) ids.add(String(f.id).trim()); names.add(looseName(n)); }); }); return { ids, names }; }
function importFast(fx, file) {
  if (!fx.students.length) { toast(fx.blank ? `${esc(file)}: this FAST report has no student IDs or names, so Tally can't tell whose scores they are.` : `${esc(file)}: no FAST scores in this report.`, true, 8000); return; }
  const add = {}; fx.students.forEach(st => testKeys(st.id, st.name).forEach(k => { add[k] = (add[k] || []).filter(h => !st.tests.some(x => testSig(x) === testSig(h))).concat(st.tests.map(t => ({ ...t }))); }));
  state.tests = mergeTests(state.tests, cleanTests(add));
  const ri = rosterIndex(); const unmatched = fx.students.filter(st => !(st.id && ri.ids.has(String(st.id).trim())) && !(st.name && ri.names.has(looseName(st.name))));
  save(); const wins = fx.windows.map(w => w.pm + ' ' + w.year).join(' and ');
  toast(`FAST results (${esc(wins)}): ${plural(fx.students.length - unmatched.length, 'student')} matched${unmatched.length ? ` · <b>${unmatched.length} not in your classes</b> (kept, in case they join)` : ''}${fx.blank ? ` · ${plural(fx.blank, 'row')} with no ID or name skipped` : ''}`, false, 9000);
  render();
}

// Test history for one student: imported FAST results, then the FAST score the Seating Chart backup carried.
function testHistory(sec, name) {
  const f = findStudent(sec, name); const seen = new Set(); const out = [];
  testKeys(f.id, name).forEach(k => ((state.tests || {})[k] || []).forEach(h => { const sig = testSig(h); if (seen.has(sig)) return; seen.add(sig); out.push(h); }));
  out.sort((a, b) => (b.year + b.pm).localeCompare(a.year + a.pm));
  const si = (sec.seatInfo || {})[f.row && f.row.display ? f.row.display : name] || null;
  if (!out.some(h => /FAST/i.test(h.test)) && si && (si.level || si.pct != null || si.scale != null)) out.push({ test: 'FAST', pm: 'PM3', year: '', level: si.level, scale: si.scale, pct: si.pct, src: 'seating' });
  return out;
}
// The student page's FAST section: newest first, with the change in scale score from one window to the next.
function testsSection(sec, name) {
  const hist = testHistory(sec, name); if (!hist.length) return '';
  if (state.settings.hideNames) return `<section class="gsec" id="pTests"><h3>FAST</h3><p class="ghint">Hidden while names are hidden.</p></section>`;
  return `<section class="gsec" id="pTests"><h3>FAST</h3><table class="ftab"><tbody>${hist.map((h, j) => { const prev = hist[j + 1]; const dv = prev && h.scale != null && prev.scale != null ? h.scale - prev.scale : null;
    return `<tr><th scope="row">${esc([h.pm, h.year].filter(Boolean).join(' '))}</th><td>${h.level != null ? `<span class="flvl l${Math.min(5, Math.max(1, h.level))}">Level ${h.level}</span>` : ''}</td><td class="num">${h.scale != null ? h.scale : ''}${dv != null ? ` <small class="${dv < 0 ? 'neg' : 'pos'}">${dv > 0 ? '+' : dv < 0 ? '−' : '±'}${Math.abs(dv)}</small>` : ''}</td><td>${h.pct != null ? esc(pctWord(h.pct).replace(' percentile', ' pct')) : h.above ? 'above grade' : h.grade != null ? 'grade ' + h.grade + ' test' : ''}</td></tr>`; }).join('')}</tbody></table></section>`;
}

// Kept conference text, per student: { tests, strengths, concerns, work, saved }.
function cleanConfForms(o) { const out = {}; if (o && typeof o === 'object') for (const k of Object.keys(o)) { const v = o[k]; if (!SAFE_KEY(k) || !v || typeof v !== 'object') continue; const t = x => typeof x === 'string' ? x.slice(0, 4000) : ''; out[k] = { tests: t(v.tests).slice(0, 600), strengths: t(v.strengths), concerns: t(v.concerns), work: t(v.work), saved: typeof v.saved === 'string' ? v.saved.slice(0, 30) : '' }; } return out; }

function openConference(sec, name) {
  const d = conferenceData(sec, name); const st = state.settings; const k = norm(name);
  sec.confForms = sec.confForms || {}; const kept = sec.confForms[k] || null;
  const draft = conferenceDraft(d);
  const v = { grade: st.gradeLevel || '7', teacher: st.teacherName || '', course: (st.courseNames || {})[sec.prep] || (sec.prep === 'acc' ? 'Grade 7 Accelerated Math' : 'Grade 7 Math'), period: sec.period != null ? String(sec.period) : '',
    current: d.r && d.r.rounded != null ? String(d.r.rounded) : '', rc: { ...d.rc }, tests: kept && kept.tests != null ? kept.tests : conferenceTests(d),
    strengths: kept ? kept.strengths : draft.strengths, concerns: kept ? kept.concerns : draft.concerns, work: kept ? kept.work : conferenceWork(d) };
  const m = $('#modal'); m.classList.remove('hidden'); m.classList.add('private');
  const H = st.hideNames; const shown = H ? mask(name) : niceName(name);
  const rcCell = q => `<label class="cf-rc">${q}<input type="text" id="cf${q}" value="${v.rc[q] == null ? '' : esc(String(v.rc[q]))}" inputmode="numeric" maxlength="4"></label>`;
  m.innerHTML = `<div class="panel wide confPanel"><header><h2>Parent conference · ${esc(shown)}</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body confBody">
      <div class="confForm">
        <div class="row3 r2"><div class="field"><label for="cfName">Student name</label><input type="text" id="cfName" value="${esc(H ? '' : niceName(name))}" ${H ? 'placeholder="hidden while names are hidden"' : ''}></div><div class="field sm"><label for="cfGrade">Grade</label><input type="text" id="cfGrade" value="${esc(v.grade)}" maxlength="4"></div></div>
        <div class="row3 r3"><div class="field"><label for="cfTeacher">Teacher</label><input type="text" id="cfTeacher" value="${esc(v.teacher)}"></div><div class="field"><label for="cfCourse">Course</label><input type="text" id="cfCourse" value="${esc(v.course)}"></div><div class="field sm"><label for="cfPeriod">Period</label><input type="text" id="cfPeriod" value="${esc(v.period)}" maxlength="4"></div></div>
        <div class="row3 r4"><div class="field sm"><label for="cfCurrent">Current grade %</label><input type="text" id="cfCurrent" value="${esc(v.current)}" maxlength="5"></div><div class="field cf-rcs"><label>Report card grades</label><div>${['Q1', 'Q2', 'S1', 'Q3', 'Q4', 'S2'].map(rcCell).join('')}</div></div></div>
        <div class="field"><label for="cfTests">FAST / EBA test history</label><textarea id="cfTests" rows="2" placeholder="No test results in Tally yet">${esc(v.tests)}</textarea></div>
        <div class="field"><label for="cfStrengths">Strengths in class</label><textarea id="cfStrengths" rows="4">${esc(v.strengths)}</textarea></div>
        <div class="field"><label for="cfConcerns">Concerns in class</label><textarea id="cfConcerns" rows="4">${esc(v.concerns)}</textarea></div>
        <div class="field"><label for="cfWork">Missing assignments &amp; assignments needing to be redone</label><textarea id="cfWork" rows="6">${esc(v.work)}</textarea></div>
      </div>
      <aside class="confSide">
        <h3>Notes</h3>
        ${H ? '<p class="ghint">Hidden while names are hidden.</p>' : d.notes.length ? `<ul class="cfNotes">${d.notes.slice().reverse().map(n => `<li><time>${esc(fmtDate(localDay(n.at)))}</time><p>${esc(n.text)}</p><span><button class="pill pale small" data-cfadd="strengths" data-nid="${esc(n.id)}">+ Strengths</button><button class="pill pale small" data-cfadd="concerns" data-nid="${esc(n.id)}">+ Concerns</button></span></li>`).join('')}</ul>` : '<p class="ghint">No notes for this student.</p>'}
        <h3>From the gradebook</h3>
        <ul class="cfFacts">${[d.r ? `${esc(Q_NAMES[d.q - 1])}: ${d.r.rounded}% ${d.r.letter}` : '', ...Object.entries(d.cats).filter(([, x]) => x.pct != null).map(([c, x]) => `${esc(c)}: ${Math.round(x.pct)}%`), d.ix && d.ix.poss ? `IXL: ${d.ix.done} of ${d.ix.poss} skills at goal` : '', `Missing: ${d.missing.length}`, d.rt.ok ? 'Retake: eligible' : `Retake: ${esc(retakeWhy(d.rt))}`].filter(Boolean).map(x => `<li>${x}</li>`).join('')}</ul>
      </aside>
    </div>
    <footer>${kept ? `<small class="ghint" style="margin:0">Your edits from ${esc(fmtDate(localDay(kept.saved)))}</small><button class="linkbtn" id="cfRefill">Start over from Tally</button>` : ''}<div class="spacer"></div><button class="pill pale" id="mCancel">Close</button><button class="pill" id="cfPrint">Print</button></footer></div>`;
  const val = id => ($('#' + id) || {}).value || '';
  const keep = () => {   // remember the teacher, course and grade for next time; the student's text for this student
    st.teacherName = val('cfTeacher').slice(0, 80); st.gradeLevel = val('cfGrade').slice(0, 4); st.courseNames = { ...(st.courseNames || {}), [sec.prep]: val('cfCourse').slice(0, 80) };
    const now = { tests: val('cfTests').slice(0, 600), strengths: val('cfStrengths').slice(0, 4000), concerns: val('cfConcerns').slice(0, 4000), work: val('cfWork').slice(0, 4000) };
    const fresh = { tests: conferenceTests(d), strengths: draft.strengths, concerns: draft.concerns, work: conferenceWork(d) };
    if (Object.keys(now).some(x => now[x] !== fresh[x])) sec.confForms[k] = { ...now, saved: new Date().toISOString() }; else delete sec.confForms[k];
    save(); };
  const close = () => { keep(); m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.querySelectorAll('[data-cfadd]').forEach(b => b.onclick = () => { const n = d.notes.find(x => x.id === b.dataset.nid); if (!n) return; const ta = $(b.dataset.cfadd === 'strengths' ? '#cfStrengths' : '#cfConcerns'); ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' : '') + n.text; ta.focus(); });
  const rf = $('#cfRefill'); if (rf) rf.onclick = () => { if (!confirm('Replace your edits with a fresh draft from Tally?')) return; delete sec.confForms[k]; save(); openConference(sec, name); };
  $('#cfPrint').onclick = () => { keep(); printConference({ name: val('cfName') || niceName(name), grade: val('cfGrade'), teacher: val('cfTeacher'), course: val('cfCourse'), period: val('cfPeriod'), current: val('cfCurrent'),
    rc: Object.fromEntries(['Q1', 'Q2', 'S1', 'Q3', 'Q4', 'S2'].map(q => [q, val('cf' + q)])), tests: val('cfTests'), strengths: val('cfStrengths'), concerns: val('cfConcerns'), work: val('cfWork') }); };
}

// The form as the school prints it: banner, title, underlined fields, three writing blocks, footer — one Letter page.
function conferenceHtml(x) {
  const line = (label, value, cls) => `<span class="f ${cls || ''}"><b>${label}</b><span class="u">${esc(value || '')}</span></span>`;
  const block = (label, text) => `<section><b>${label}</b><div class="t">${esc(text || '')}</div></section>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Parent Conference Input Form — ${esc(x.name)}</title><style>
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
function printConference(x) {
  const html = conferenceHtml(x); const w = window.open('', '_blank');
  if (!w) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = 'Conference form - ' + x.name.replace(/[^\w -]+/g, '') + '.html'; a.click(); toast('Pop-ups are blocked, so the form was saved as a file instead.', false, 5000); return; }
  w.document.open(); w.document.write(html); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 400);
}
