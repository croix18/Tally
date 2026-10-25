/* ---------- students.js — Students: every student in one place, for the teacher ----------
   Spliced into app.js's closure. Teacher-only: never reachable from the projected Race/Data Lab, and the Names toggle
   masks names here as everywhere. Three surfaces:
     · Students (view.mode 'students'): every student of every class, searchable, with grade, change, missing, IXL.
     · A student's page (view.mode 'student', view.stu = { key, name }): the grade now and at the end of each closed
       quarter, trends across the year, every assignment and assessment, IXL by unit, and what would move the grade.
     · Show student (#show): the what-ifs turned toward the student: only their numbers, sliders they can drag,
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
  return { gi, ixl: row && row.ixl != null ? row.ixl : null, row, noAccount: !!(row && row.status === 'noAccount'), id: row && row.id ? row.id : (gb && gi >= 0 && gb.ids ? gb.ids[gi] : '') };
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
  const pop = new Set(population(sec).map(x => x.key)); const inClass = h => { const ks = Object.keys(h.per).filter(k => pop.has(k)); return ks.length ? ks : Object.keys(h.per); };   // the roster-matched class, as on the Race and the grid
  return { dates: hist.map(h => h.date), mine: hist.map(h => h.per[key] == null ? null : val(h, key)), cls: hist.map(h => mean(inClass(h).map(k => val(h, k)))) };
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

/* ---------- Student notes ----------
   A dated log per student, kept on the class (sec.stuNotes[norm(name)] = [{ id, at, text }], newest last). Teacher-only:
   hidden while names are hidden, never on Show student, never in a Board file; carried by the backup and a full save. */
const NOTE_MAX = 2000;
function cleanNotes(o) { const out = {}; if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (!SAFE_KEY(k) || !Array.isArray(o[k])) continue; const list = o[k].filter(n => n && typeof n.text === 'string' && n.text.trim() && typeof n.at === 'string').map(n => ({ id: typeof n.id === 'string' ? n.id.slice(0, 20) : Math.random().toString(36).slice(2, 10), at: n.at.slice(0, 30), text: n.text.slice(0, 2000) })).slice(-200); if (list.length) out[k] = list; } return out; }   /* a declaration: migrate() runs before this file's consts exist */
const notesOf = (sec, name) => ((sec.stuNotes || {})[norm(name)] || []);
function addNote(sec, name, text) { text = String(text || '').trim().slice(0, NOTE_MAX); if (!text) return null; sec.stuNotes = sec.stuNotes || {}; const k = norm(name); const n = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: new Date().toISOString(), text }; (sec.stuNotes[k] = sec.stuNotes[k] || []).push(n); return n; }
function dropNote(sec, name, id) { const k = norm(name); const l = (sec.stuNotes || {})[k]; if (!l) return; sec.stuNotes[k] = l.filter(n => n.id !== id); if (!sec.stuNotes[k].length) delete sec.stuNotes[k]; }
function notesSection(sec, name) {
  const H = state.settings.hideNames; const list = notesOf(sec, name).slice().reverse();
  if (H) return `<section class="gsec" id="pNotes"><h3>Notes${list.length ? ` <small>${list.length}</small>` : ''}</h3><p class="ghint">Hidden while names are hidden.</p></section>`;
  return `<section class="gsec" id="pNotes"><h3>Notes${list.length ? ` <small>${list.length}</small>` : ''}</h3>
    <div class="noteAdd"><textarea id="noteText" rows="2" maxlength="${NOTE_MAX}" placeholder="New note" aria-label="New note"></textarea><button class="pill small" id="noteAdd">Add</button></div>
    ${list.length ? `<ul class="notes">${list.map(n => `<li data-nid="${esc(n.id)}"><time datetime="${esc(n.at)}">${esc(fmtDate(localDay(n.at)))}</time><p>${esc(n.text)}</p><button class="linkbtn" data-ndel="${esc(n.id)}" aria-label="Remove this note">Remove</button></li>`).join('')}</ul>` : ''}</section>`;
}
function wireNotes(sec, name) {
  const add = $('#noteAdd'), ta = $('#noteText'); if (!add || !ta) return;
  const go = () => { if (!ta.value.trim()) { toast('Type the note first.', false, 2500); ta.focus(); return; } if (addNote(sec, name, ta.value)) { save(); render(); const t = $('#noteText'); if (t) t.focus(); } };
  add.onclick = go; ta.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(); } };
  document.querySelectorAll('#pNotes [data-ndel]').forEach(b => b.onclick = async () => { if (!await ask('Remove this note?')) return; dropNote(sec, name, b.dataset.ndel); save(); render(); });
}

/* ---------- IXL Students Quickview (a PDF) ----------
   Analytics → Students Quickview, printed: for every student, every skill practised this school year with questions
   answered, time spent, the score they started at and where they are now, plus the student's totals and when they
   last practised (Croix, 25 Oct 2026: "I have pdfs with this data. Can you utilize it?"). What the Score Grid cannot
   say: effort (questions, minutes), recency, and practice outside the assigned units. Kept on the class as
   sec.practice[norm(ixlName)] = { asOf, questions, minutes, last, mastered, proficient, skills: { ID: { q, min, from,
   to, name, g } } }, matched by the IXL name (the Quickview shows "Hayden Sutter"; the Score Grid "HAYDEN SUTTER"). */
const MONTHS3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function parseMins(t) { const m = /(?:(\d+)\s*hr)?\s*(?:(\d+)\s*min)?/.exec(String(t || '')); if (/<\s*1\s*min/.test(t)) return 0; return (Number(m && m[1] || 0) * 60) + Number(m && m[2] || 0); }
function parseIxlQuickviewPdf(pages) {
  const flat = pages.flat().map(i => i.s).join(' ').replace(/\s+/g, ' ');
  if (!/STUDENTS\s+QUICKVIEW/i.test(flat)) return null;
  const dr = /DATE RANGE:\s*(.*?):\s*([A-Za-z]{3})\w*\.? (\d{1,2})(?:,? (\d{4}))?\s*[-–]\s*([A-Za-z]{3})\w*\.? (\d{1,2})(?:,? (\d{4}))?/.exec(flat);
  let asOf = todayISO(), range = '';
  if (dr) { const mo = MONTHS3.indexOf(dr[5].toLowerCase()) + 1; const start = Number(quarters().ends[0].slice(0, 4)); const y = dr[7] ? Number(dr[7]) : (mo >= 7 ? start : start + 1); if (mo) asOf = `${y}-${String(mo).padStart(2, '0')}-${String(Number(dr[6])).padStart(2, '0')}`; range = `${dr[2]} ${dr[3]} to ${dr[5]} ${dr[6]}`; }
  const students = []; let cur = null;
  const HEAD = /^(.+?)\s+([\d,]+)\s+questions?\s+((?:\d+\s*hr\s*)?(?:<?\s*\d+\s*min)?)\s*Practiced\s+(today|yesterday|(\d+)\s+days?\s+ago)/i;
  /* A skill row, read from the left and the right rather than by one strict pattern (Croix, 25 Oct 2026: "the time
     spent is extremely hit or miss"): the grade token starts it; from the right, the current score, then the start
     score if there is one, then the time (which may be absent on a row), then the questions; what is left between the
     code and those numbers is the name with the three-character skill ID at its end. */
  const TIME = /^(?:<\s*1\s*min|\d+\s*hr(?:\s*\d+\s*min)?|\d+\s*min)$/;
  const row = text => { const m = /^(\d(?:st|nd|rd|th))\s*(\([A-Z]+\.?\d*\))?\s+(.*)$/.exec(text); if (!m) return null;
    const toks = m[3].split(' ').filter(Boolean); const nums = [];   /* peel integers off the right */
    while (toks.length && /^\d+$/.test(toks[toks.length - 1]) && nums.length < 2) nums.unshift(Number(toks.pop()));
    if (!nums.length) return null;
    let min = null; for (let w = 4; w >= 1; w--) { const t = toks.slice(-w).join(' '); if (toks.length >= w && TIME.test(t)) { min = parseMins(t); toks.splice(-w); break; } }
    let q = null; if (toks.length && /^\d+$/.test(toks[toks.length - 1])) q = Number(toks.pop());
    if (toks.length < 2) return null; const id = toks[toks.length - 1]; if (!/^[A-Z0-9]{3}$/.test(id) || /^\d+$/.test(id)) return null;
    return { g: (m[1] + (m[2] ? ' ' + m[2] : '')).trim(), name: toks.slice(0, -1).join(' ').trim(), id, q: q == null ? 0 : q, min, from: nums.length === 2 ? nums[0] : 0, to: nums[nums.length - 1] }; };
  pages.forEach(items => {
    const its = items.filter(i => i.s && i.s.trim()).map(i => ({ ...i, s: i.s.trim() })).sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = []; its.forEach(i => { const ln = lines.find(l => Math.abs(l.y - i.y) <= 4); if (ln) ln.items.push(i); else lines.push({ y: i.y, items: [i] }); });
    lines.forEach(ln => { ln.items.sort((a, b) => a.x - b.x); const text = ln.items.map(i => i.s).join(' ').replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
      const h = HEAD.exec(text); if (h) { cur = { name: h[1].trim(), questions: Number(h[2].replace(/,/g, '')), minutes: parseMins(h[3]), days: /today/i.test(h[4]) ? 0 : /yesterday/i.test(h[4]) ? 1 : Number(h[5]), mastered: 0, proficient: 0, rows: [] }; students.push(cur); return; }
      if (!cur) return;
      const mp = /(\d+)\s+Mastered\s+(\d+)\s+Proficient/i.exec(text); if (mp) { cur.mastered = Number(mp[1]); cur.proficient = Number(mp[2]); return; }
      const r = row(text); if (r) cur.rows.push(r); });
  });
  return { asOf, range, students, kind: 'quickview' };
}
function cleanPractice(o) { const out = {}; const n = v => typeof v === 'number' && isFinite(v) ? v : (Number(v) || 0); const day = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : '';
  if (o && typeof o === 'object') for (const k of Object.keys(o)) { const v = o[k]; if (!SAFE_KEY(k) || !v || typeof v !== 'object') continue; const skills = {};
    Object.keys(v.skills || {}).slice(0, 300).forEach(id => { const x = v.skills[id]; if (!/^[A-Z0-9]{2,6}$/.test(id) || !x || typeof x !== 'object') return; skills[id] = { q: n(x.q), min: x.min == null ? null : n(x.min), from: n(x.from), to: n(x.to), name: typeof x.name === 'string' ? x.name.slice(0, 100) : '', g: typeof x.g === 'string' ? x.g.slice(0, 16) : '' }; });
    out[k] = { asOf: day(v.asOf), questions: n(v.questions), minutes: n(v.minutes), last: day(v.last), mastered: n(v.mastered), proficient: n(v.proficient), skills }; }
  return out; }
const practiceOf = (sec, ixlName) => (sec.practice || {})[norm(ixlName)] || null;
function importQuickview(fx, file) {
  if (!fx.students.length) { toast(`${esc(file)}: no student blocks in this Quickview.`, true, 8000); return; }
  const secs = state.order.map(k => state.sections[k]).filter(s => s && !s.board && !s.placeholder && s.students.length);
  const swap = nm => nm.split(/\s+/).length === 2 ? nm.split(/\s+/).reverse().join(' ') : nm;
  let matched = 0; const unmatched = []; const touched = new Set();
  fx.students.forEach(st => {
    const keys = [norm(st.name), norm(swap(st.name))]; let hit = false;
    secs.forEach(s => { const found = s.students.find(n => keys.includes(norm(n))); if (!found) return; hit = true; touched.add(s.key);
      const skills = {}; st.rows.forEach(r => { skills[r.id] = { q: r.q, min: r.min, from: r.from, to: r.to, name: r.name, g: r.g }; });
      const last = (() => { const d = new Date(fx.asOf + 'T12:00:00'); d.setDate(d.getDate() - (st.days || 0)); return localDayOf(d.toISOString()); })();
      s.practice = s.practice || {}; s.practice[norm(found)] = { asOf: fx.asOf, questions: st.questions, minutes: st.minutes, last, mastered: st.mastered, proficient: st.proficient, skills }; });
    if (hit) matched++; else unmatched.push(st.name);
  });
  save();
  toast(`IXL Quickview${fx.range ? ` (${esc(fx.range)})` : ''}: ${plural(matched, 'student')} matched by IXL name in ${plural(touched.size, 'class')}: questions, time and when they last practiced, by skill${unmatched.length ? ` · <b>${unmatched.length} not in your classes</b>: ${unmatched.slice(0, 3).map(esc).join('; ')}${unmatched.length > 3 ? '…' : ''}` : ''}.`, false, 10000);
  render();
}
// The practice a student has on an assigned skill (by its permanent ID), if the Quickview knew it.
function skillPractice(sec, ixlName, k) { const pr = practiceOf(sec, ixlName); const id = sec.skills[k] && sec.skills[k].id; return pr && id && pr.skills[id] ? pr.skills[id] : null; }
const minsWord = m => m == null ? '' : m < 1 ? '<1 min' : m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`;
function practiceSection(sec, name) {
  const f = findStudent(sec, name); const ixlName = f.ixl != null ? sec.students[f.ixl] : null; const pr = ixlName ? practiceOf(sec, ixlName) : null; if (!pr) return '';
  const idOf = {}; sec.skills.forEach((sk, k) => { if (sk.id) idOf[sk.id] = k; });
  const rows = Object.keys(pr.skills).map(id => ({ id, ...pr.skills[id], k: idOf[id] })).sort((a, b) => b.min - a.min || b.q - a.q);
  const top = rows.slice(0, 12); const idle = ageDays(pr.last);
  return `<section class="gsec" id="pPractice"><h3>IXL practice <small>this school year, as of ${esc(fmtDate(pr.asOf))}</small></h3>
    <div class="gcards"><div class="gcard"><small>Answered</small><b>${pr.questions.toLocaleString()}</b><span>questions</span></div><div class="gcard"><small>Time on IXL</small><b>${esc(minsWord(pr.minutes))}</b><span>${pr.mastered || pr.proficient ? `${pr.mastered} mastered · ${pr.proficient} proficient` : 'learning'}</span></div><div class="gcard ${idle >= 7 ? 'warn' : ''}"><small>Last practiced</small><b>${esc(fmtDate(pr.last))}</b><span>${idle === 0 ? 'today' : idle === 1 ? 'yesterday' : plural(idle, 'day') + ' ago'}</span></div></div>
    ${top.length ? `<table class="ftab prac"><thead><tr><th>Skill</th><th class="num">Questions</th><th class="num">Time</th><th class="num">Score</th></tr></thead><tbody>${top.map(r => `<tr class="${r.k == null ? 'off' : ''}"><td>${esc(r.name)}${r.k == null ? ' <small>not in a unit</small>' : ''}</td><td class="num">${r.q}</td><td class="num">${esc(minsWord(r.min))}</td><td class="num">${r.from && r.from !== r.to ? `<small>${r.from} →</small> ` : ''}<b>${r.to}</b></td></tr>`).join('')}</tbody></table>${rows.length > top.length ? `<p class="ghint">and ${rows.length - top.length} more skills, less time on each</p>` : ''}` : '<p class="ghint">No skills practiced yet.</p>'}</section>`;
}

/* ---------- Family: contacts, the contact log, and signed reports ----------
   Croix (25 Oct 2026): "a space or a tab or something on the students page for parent contact information … email,
   phone number, relationship to student, contact log, notes about times I've had to contact that I can write in …
   to fortify my command center". Kept on the class like notes: sec.family[norm(name)] = { contacts: [{ id, name,
   rel, phone, email, note }], log: [{ id, at, how, who, text }] }. Teacher-only: hidden while names are hidden,
   never on Show student, never in a Board file (which lists its fields); carried by the backup, a full save and
   Sync. Whether a weekly report came back signed lives on that report's log entry (sec.reportLog[…].back). */
var HOWS = ['Call', 'Email', 'Focus message', 'Text', 'In person', 'Note home'];
var RELS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Stepmother', 'Stepfather', 'Other'];
function cleanFamily(o) { const out = {}; const str = (v, n) => typeof v === 'string' ? v.trim().slice(0, n) : ''; const rid = () => Math.random().toString(36).slice(2, 10);
  if (o && typeof o === 'object') for (const k of Object.keys(o)) { const v = o[k]; if (!SAFE_KEY(k) || !v || typeof v !== 'object') continue;
    const contacts = (Array.isArray(v.contacts) ? v.contacts : []).map(c => c && typeof c === 'object' ? { id: str(c.id, 20) || rid(), name: str(c.name, 80), rel: str(c.rel, 40), phone: str(c.phone, 40), email: str(c.email, 120), note: str(c.note, 300) } : null).filter(c => c && (c.name || c.phone || c.email)).slice(0, 10);
    const log = (Array.isArray(v.log) ? v.log : []).map(e => e && typeof e === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String(e.at)) ? { id: str(e.id, 20) || rid(), at: String(e.at), how: HOWS.includes(e.how) ? e.how : 'Note home', who: str(e.who, 80), text: str(e.text, 2000) } : null).filter(e => e && (e.text || e.who)).slice(-300);
    if (contacts.length || log.length) out[k] = { contacts, log }; }
  return out; }
const familyOf = (sec, name) => { const f = (sec.family || {})[norm(name)]; return f ? { contacts: f.contacts || [], log: f.log || [] } : { contacts: [], log: [] }; };
function setFamily(sec, name, f) { sec.family = sec.family || {}; const k = norm(name); if (f.contacts.length || f.log.length) sec.family[k] = f; else delete sec.family[k]; }
const reportsOf = (sec, name) => ((sec.reportLog || {})[norm(name)] || []);
function markReportBack(sec, name, date, back) { const l = reportsOf(sec, name); const e = l.find(x => x.date === date); if (!e) return; if (back) e.back = todayISO(); else delete e.back; }
function familySection(sec, name) {
  const H = state.settings.hideNames; const f = familyOf(sec, name); const reps = reportsOf(sec, name).slice(-6).reverse(); const n = f.contacts.length;
  if (H) return `<section class="gsec" id="pFamily"><h3>Family${n ? ` <small>${n}</small>` : ''}</h3><p class="ghint">Hidden while names are hidden.</p></section>`;
  const tel = v => `<a href="tel:${esc(v.replace(/[^\d+]/g, ''))}">${esc(v)}</a>`, mail = v => `<a href="mailto:${esc(v)}">${esc(v)}</a>`;
  const cards = f.contacts.map(c => `<div class="fcard" data-cid="${esc(c.id)}"><div><b>${esc(c.name || '(no name)')}</b>${c.rel ? ` <span class="rel">${esc(c.rel)}</span>` : ''}</div><div class="ways">${[c.phone ? tel(c.phone) : '', c.email ? mail(c.email) : ''].filter(Boolean).join(' · ') || '<span class="ghint">no phone or email yet</span>'}</div>${c.note ? `<div class="cnote">${esc(c.note)}</div>` : ''}<div class="cbtns"><button class="linkbtn" data-cedit="${esc(c.id)}">Edit</button><button class="linkbtn" data-cdel="${esc(c.id)}">Remove</button></div></div>`).join('');
  const who = f.contacts.map(c => c.name).filter(Boolean);
  const logRows = f.log.slice().reverse().map(e => `<li data-lid="${esc(e.id)}"><time>${esc(fmtDate(e.at))}</time><span class="how">${esc(e.how)}${e.who ? ` · ${esc(e.who)}` : ''}</span><p>${esc(e.text)}</p><button class="linkbtn" data-ldel="${esc(e.id)}" aria-label="Remove this entry">Remove</button></li>`).join('');
  const repRows = reps.map(e => `<li><label><input type="checkbox" data-back="${esc(e.date)}" ${e.back ? 'checked' : ''}> <time>${esc(fmtDate(e.date))}</time> <span>${e.grade != null ? e.grade + '%' : ''}${e.missing ? ` · ${e.missing} missing` : ''}</span> <small>${e.back ? `back signed ${esc(fmtDate(e.back))}` : 'not back yet'}</small></label></li>`).join('');
  return `<section class="gsec" id="pFamily"><h3>Family${n ? ` <small>${n}</small>` : ''}</h3>
    <div class="fcards">${cards || '<p class="ghint">No contacts yet.</p>'}</div>
    <div id="fformSlot"></div><button class="pill toggle small" id="fAdd">Add contact</button>
    <h4 class="subh">Contact log${f.log.length ? ` <small>${f.log.length}</small>` : ''}</h4>
    <form class="lform" id="lform"><input type="date" name="at" value="${esc(todayISO())}" aria-label="Date"><select name="how" aria-label="How">${HOWS.map(h => `<option>${h}</option>`).join('')}</select><input name="who" list="whoList" placeholder="Who" value="${esc(who[0] || '')}" maxlength="80" aria-label="Who"><datalist id="whoList">${who.map(w => `<option value="${esc(w)}">`).join('')}</datalist><textarea name="text" rows="2" maxlength="2000" placeholder="What was said, what was agreed" aria-label="What was said"></textarea><button class="pill small" type="submit">Log it</button></form>
    ${logRows ? `<ul class="clog">${logRows}</ul>` : ''}
    <h4 class="subh">Weekly reports</h4>${repRows ? `<ul class="reps">${repRows}</ul>` : '<p class="ghint">None printed yet. Tick each one here when it comes back signed.</p>'}</section>`;
}
function wireFamily(sec, name) {
  const root = $('#pFamily'); if (!root) return; const f = familyOf(sec, name); const fa = $('#fAdd'); if (!fa) return;
  const showForm = c => { const slot = $('#fformSlot'); if (!slot || state.settings.hideNames) return; slot.innerHTML = familyFormHtml(c); $('#fAdd').classList.add('hidden'); const fm = slot.querySelector('form'); fm.querySelector('[name=name]').focus();
    fm.onsubmit = e => { e.preventDefault(); const d = Object.fromEntries(new FormData(fm).entries()); const id = fm.dataset.cid; const next = { ...familyOf(sec, name) }; const c = { id: id || Date.now().toString(36), name: String(d.name || '').trim(), rel: String(d.rel || '').trim(), phone: String(d.phone || '').trim(), email: String(d.email || '').trim(), note: String(d.note || '').trim() };
      if (!c.name && !c.phone && !c.email) { toast('A contact needs at least a name, a phone or an email.', false, 3000); return; }
      next.contacts = id ? next.contacts.map(x => x.id === id ? c : x) : next.contacts.concat([c]); setFamily(sec, name, next); save(); render(); };
    fm.querySelector('[data-fcancel]').onclick = () => { slot.innerHTML = ''; $('#fAdd').classList.remove('hidden'); }; };
  $('#fAdd').onclick = () => showForm({});
  root.querySelectorAll('[data-cedit]').forEach(b => b.onclick = () => showForm(f.contacts.find(c => c.id === b.dataset.cedit) || {}));
  root.querySelectorAll('[data-cdel]').forEach(b => b.onclick = async () => { if (!await ask('Remove this contact?')) return; const next = { ...familyOf(sec, name) }; next.contacts = next.contacts.filter(c => c.id !== b.dataset.cdel); setFamily(sec, name, next); save(); render(); });
  const lf = $('#lform'); if (lf) lf.onsubmit = e => { e.preventDefault(); const d = Object.fromEntries(new FormData(lf).entries()); const text = String(d.text || '').trim(); if (!text) { toast('Write what happened first.', false, 2500); lf.querySelector('[name=text]').focus(); return; }
    const next = { ...familyOf(sec, name) }; next.log = next.log.concat([{ id: Date.now().toString(36), at: /^\d{4}-\d{2}-\d{2}$/.test(d.at) ? d.at : todayISO(), how: HOWS.includes(d.how) ? d.how : 'Note home', who: String(d.who || '').trim(), text }]); setFamily(sec, name, next); save(); render(); };
  root.querySelectorAll('[data-ldel]').forEach(b => b.onclick = async () => { if (!await ask('Remove this log entry?')) return; const next = { ...familyOf(sec, name) }; next.log = next.log.filter(x => x.id !== b.dataset.ldel); setFamily(sec, name, next); save(); render(); });
  root.querySelectorAll('[data-back]').forEach(cb => cb.onchange = () => { markReportBack(sec, name, cb.dataset.back, cb.checked); save(); render(); });
}
function familyFormHtml(c = {}) { return `<form class="fform" data-cid="${esc(c.id || '')}"><input name="name" placeholder="Name" value="${esc(c.name || '')}" maxlength="80" aria-label="Name"><input name="rel" list="relList" placeholder="Relationship" value="${esc(c.rel || '')}" maxlength="40" aria-label="Relationship"><datalist id="relList">${RELS.map(r => `<option value="${r}">`).join('')}</datalist><input name="phone" type="tel" placeholder="Phone" value="${esc(c.phone || '')}" maxlength="40" aria-label="Phone"><input name="email" type="email" placeholder="Email" value="${esc(c.email || '')}" maxlength="120" aria-label="Email"><input name="note" placeholder="Note (best time to call, language, …)" value="${esc(c.note || '')}" maxlength="300" aria-label="Note"><div class="fbtns"><button class="pill small" type="submit">${c.id ? 'Save' : 'Add contact'}</button><button class="pill toggle small" type="button" data-fcancel>Cancel</button></div></form>`; }
// Class level (⋯ → Signed reports): who has the latest weekly report back, who doesn't, and how to reach home.
// Croix, marking a print (25 Oct 2026): "Week of", not the print date; no instructions, just the count; a way to
// clear the list; and the Home cell opens a card to add or edit the contact right there, or go to the student's page.
const weekOf = d => { const x = new Date(d + 'T12:00:00'); const wd = x.getDay(); x.setDate(x.getDate() + (wd === 6 ? 2 : wd === 0 ? 1 : 1 - wd)); return localDayOf(x.toISOString()); };   // the school week's Monday; a weekend print belongs to the week ahead
function openReturns(s, editing) {
  const gb = s.grades; if (!gb) { toast('No gradebook yet, so no reports have been printed for this class.', true); return; }
  const all = gb.students.map(nm => { const l = reportsOf(s, nm); const last = l[l.length - 1] || null; return { nm, last, f: familyOf(s, nm) }; }).filter(r => r.last);
  if (!all.length) { toast('No weekly reports printed for this class yet.', false, 4000); return; }
  const rows = all.filter(r => !r.last.cleared); const out = rows.filter(r => !r.last.back); const H = state.settings.hideNames;
  const weeks = [...new Set(rows.map(r => weekOf(r.last.date)))].sort();
  const m = $('#modal'); m.classList.remove('hidden');
  const home = r => { const c = r.f.contacts[0]; return H ? '' : c ? `${esc(c.name)}${c.rel ? ` (${esc(c.rel)})` : ''}${c.phone ? ` · ${esc(c.phone)}` : ''}${c.email ? ` · ${esc(c.email)}` : ''}${r.f.contacts.length > 1 ? ` <small>+${r.f.contacts.length - 1}</small>` : ''}` : '<span class="add">Add a contact</span>'; };
  const row = r => `<tr class="${r.last.back ? 'back' : ''}"><td><label><input type="checkbox" data-rback="${esc(r.nm)}" data-date="${esc(r.last.date)}" ${r.last.back ? 'checked' : ''}> ${esc(H ? mask(r.nm) : r.nm)}</label></td><td>${r.last.back ? `back ${esc(fmtDate(r.last.back))}` : `<b>${ageDays(r.last.date) ? plural(ageDays(r.last.date), 'day') + ' out' : 'printed today'}</b>`}</td><td class="who">${H ? '' : `<button class="linkbtn home" data-home="${esc(r.nm)}">${home(r)}</button>`}</td></tr>${editing === r.nm && !H ? `<tr class="qedit"><td colspan="3"><div class="qcard">${familyFormHtml(r.f.contacts[0] || {})}<button class="linkbtn" data-goto="${esc(r.nm)}">Open ${esc(niceName(r.nm).split(' ')[0])}'s page</button></div></td></tr>` : ''}`;
  m.innerHTML = `<div class="panel"><header><h2>Signed reports · ${esc(s.label)}</h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body one">${rows.length ? `<div class="retHead"><b>Week of ${weeks.map(w => esc(fmtDate(w))).join(', ')}</b><span>${out.length ? `${plural(out.length, 'report')} still out` : 'all back'}</span></div>
      <table class="rettab"><thead><tr><th>Back signed</th><th></th><th>Home</th></tr></thead><tbody>${out.map(row).join('')}${rows.filter(r => r.last.back).map(row).join('')}</tbody></table>` : '<p class="ghint">Cleared. The next weekly reports you print start a new list.</p>'}
      <div class="rp-actions">${out.length && !H ? `<button class="pill pale" id="retCopy">Copy the still-out list</button>` : ''}${rows.length ? `<button class="pill toggle" id="retClear">Clear the list</button>` : ''}</div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; }; m._cancel = close; $('#mClose').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.querySelectorAll('[data-rback]').forEach(cb => cb.onchange = () => { markReportBack(s, cb.dataset.rback, cb.dataset.date, cb.checked); save(); openReturns(s, editing); });
  m.querySelectorAll('[data-home]').forEach(b => b.onclick = () => openReturns(s, editing === b.dataset.home ? null : b.dataset.home));
  m.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => { const nm = b.dataset.goto; close(); openProfile(s.key, nm); setTimeout(() => { const f = $('#pFamily'); if (f) f.scrollIntoView({ block: 'start' }); }, 60); });
  const fm = m.querySelector('.qedit form'); if (fm) { const nm = editing; fm.querySelector('[name=name]').focus();
    fm.onsubmit = e => { e.preventDefault(); const d = Object.fromEntries(new FormData(fm).entries()); const id = fm.dataset.cid; const next = { ...familyOf(s, nm) }; const c = { id: id || Date.now().toString(36), name: String(d.name || '').trim(), rel: String(d.rel || '').trim(), phone: String(d.phone || '').trim(), email: String(d.email || '').trim(), note: String(d.note || '').trim() };
      if (!c.name && !c.phone && !c.email) { toast('A contact needs at least a name, a phone or an email.', false, 3000); return; }
      next.contacts = id ? next.contacts.map(x => x.id === id ? c : x) : next.contacts.concat([c]); setFamily(s, nm, next); save(); openReturns(s, null); };
    fm.querySelector('[data-fcancel]').onclick = () => openReturns(s, null); }
  const clr = $('#retClear'); if (clr) clr.onclick = async () => { if (!await ask(`Clear this list? ${out.length ? `${plural(out.length, 'report')} still out will drop off it. ` : ''}Every report stays on its student's page.`, 'Clear')) return; rows.forEach(r => { r.last.cleared = true; }); save(); openReturns(s); };
  const cp = $('#retCopy'); if (cp) cp.onclick = async () => { const text = out.map(r => { const c = r.f.contacts[0]; return `${r.nm}\t${c ? [c.name, c.rel, c.phone, c.email].filter(Boolean).join(' · ') : ''}`; }).join('\n'); try { await navigator.clipboard.writeText(text); toast('Copied: one line per student, with the first contact.', false, 3000); } catch (e) { toast('Could not copy here.', true); } };
}

/* ---------- Retake eligibility ----------
   Croix's rule (19 Oct 2026): a student may retake an assessment only when they are completely caught up: nothing not
   handed in (NHI) in the open quarter, and every counted IXL skill in the unit the course is working in at goal.
   One function decides; every screen shows its answer. */
function retakeStatus(sec, name) {
  const f = findStudent(sec, name); const o = openSec(sec); const gb = o && o.grades && f.gi >= 0 ? o.grades : null;
  const missing = gb ? gb.assignments.filter(a => a.status && a.status[f.gi] === 'missing' && !/\bixl\b/i.test(a.name)).map(a => a.name) : [];   // an IXL column is judged by the skills below, not by its Focus cell (one meaning of "missing" everywhere)
  const cur = (state.settings.currentUnit || {})[sec.prep]; const units = unitsOf(sec); const unit = (cur && units.find(u => u.num === cur)) || units.filter(u => u.assigned).pop() || null;
  let short = [], noIxl = f.ixl == null, nUnit = 0; const behind = [];
  const shortIn = u => { const t = sec.threshold; return activeFor(sec, u, f.ixl).filter(k => { const v = eff(sec, k, f.ixl); return v == null || v < t; }).map(k => ({ name: sec.skills[k].name, v: eff(sec, k, f.ixl) })); };
  // "Caught up on everything" means everything Focus grades (Croix, 24 Oct 2026: "if I haven't graded unit 4 IXLs yet,
  // it shouldn't be required to be finished before a retake"): a unit's IXL counts only while the open gradebook has an
  // IXL column for it and that cell isn't already at full credit. The unit being worked in is listed first.
  if (!noIxl && gb) { const seen = new Set();
    gb.assignments.forEach(a => { if (!/\bixl\b/i.test(a.name) || aClosed(a, gb)) return; const u = gbUnitFor(sec, a); if (!u || seen.has(u.name) || unitClosed(sec, u)) return; seen.add(u.name);
      const full = a.max > 0 && a.status && a.status[f.gi] === 'score' && Number(a.values[f.gi]) >= a.max; if (full) return;
      const sh = shortIn(u); if (!sh.length) return; if (unit && u.name === unit.name) short = sh; else behind.push({ unit: u, short: sh, col: a.name }); }); }
  if (unit && !noIxl) nUnit = activeFor(sec, unit, f.ixl).length;
  const ok = !missing.length && !noIxl && !short.length && !behind.length;
  return { ok, missing, short, unit, nUnit, noIxl, behind, hasGrades: !!(gb && gb.assignments.length) };
}
// "2 missing · 3 IXL skills in Unit 3", or "" when eligible — the same words on every screen.
function retakeWhy(r, forStudent) {
  const parts = [];
  if (r.missing.length) parts.push(forStudent ? `turn in ${plural(r.missing.length, 'missing assignment')}` : `${r.missing.length} missing`);
  if (r.noIxl) parts.push(forStudent ? 'check your IXL account with your teacher' : 'IXL not linked');
  else { const units = [...(r.short.length ? [{ unit: r.unit, short: r.short }] : []), ...(r.behind || [])];
    units.forEach(x => parts.push(forStudent ? `finish ${plural(x.short.length, 'IXL skill')} in ${x.unit.short}` : `${plural(x.short.length, 'IXL skill')} in ${x.unit.short}`)); }
  return parts.join(forStudent ? ' and ' : ' · ');
}
const retakeChip = r => r.ok ? `<span class="rtag ok" title="Nothing missing, and every IXL skill in the unit is at goal">${ico('check', 'eligible')} retake</span>` : `<span class="rtag" title="To retake: ${esc(retakeWhy(r, true))}">${esc(retakeWhy(r))}</span>`;

/* ---------- Students directory ---------- */
let stuSort = 'class', stuClass = '', stuL30 = false;
function renderStudentsView() {
  rowCache = new Map();
  const H = state.settings.hideNames; const nm = d => esc(H ? mask(d) : niceName(d)); const q = norm(search);
  const secs = state.order.map(k => state.sections[k]).filter(s => !stuClass || s.key === stuClass);
  let rows = []; secs.forEach(s => classStudents(s).forEach(n => { if (!q || norm(n).includes(q) || norm(niceName(n)).includes(q)) { const r = studentSummary(s, n); r.retake = retakeStatus(s, n); r.l30 = isL30(s, n); rows.push(r); } }));
  const anyL30 = rows.some(r => r.l30); if (stuL30 && anyL30 && !H) rows = rows.filter(r => r.l30);   // the lower quartile is its own bucket on the school grade
  const g = r => r.grade && r.grade.rounded != null ? r.grade.rounded : 999;
  if (stuSort === 'grade') rows.sort((a, b) => g(a) - g(b) || a.name.localeCompare(b.name));
  else if (stuSort === 'missing') rows.sort((a, b) => b.missing - a.missing || g(a) - g(b));
  else if (stuSort === 'sliding') rows.sort((a, b) => (b.sliding ? 1 : 0) - (a.sliding ? 1 : 0) || (a.d ?? 0) - (b.d ?? 0) || g(a) - g(b));
  else if (stuSort === 'name') rows.sort((a, b) => norm(a.name).localeCompare(norm(b.name)));
  else if (stuSort === 'retake') rows.sort((a, b) => (b.retake.ok ? 1 : 0) - (a.retake.ok ? 1 : 0) || (a.retake.missing.length + a.retake.short.length) - (b.retake.missing.length + b.retake.short.length) || g(a) - g(b));
  const cq = liveQ(); const closedQs = [1, 2, 3, 4].filter(n => qClosed(n)); const mixedQ = secs.some(x => x.grades && liveQuarter(x) !== cq);   // one class already on Q2 while another is on Q1: the grade column says which per row
  $('#bar').innerHTML = `<h2>Students</h2><span class="meta">${plural(rows.length, 'student')}${stuL30 && anyL30 && !H ? ' in the lowest 30%' : ''}${q ? ` matching “${esc(search)}”` : ''} · grades are ${esc(Q_NAMES[cq - 1])}${closedQs.length ? ` · ${closedQs.map(n => 'Q' + n).join(', ')} closed` : ''}</span><div class="spacer"></div>
    <label class="curUnit">Class <select id="stuClass"><option value="">Every class</option>${state.order.map(k => `<option value="${esc(k)}" ${k === stuClass ? 'selected' : ''}>${esc(state.sections[k].label)}</option>`).join('')}</select></label>
    ${anyL30 && !H ? `<button class="pill toggle small ${stuL30 ? 'on' : ''}" id="stuL30" aria-pressed="${stuL30}" title="Only students the FAST report marks as the lowest 30%">L30</button>` : ''}<div class="seg small" role="group" aria-label="Sort">${[['class', 'By class'], ['name', 'A–Z'], ['grade', 'Lowest grade'], ['missing', 'Most missing'], ['sliding', 'Sliding'], ['retake', 'Retake']].map(([k, l]) => `<button data-sort="${k}" class="${stuSort === k ? 'on' : ''}" aria-pressed="${stuSort === k}">${l}</button>`).join('')}</div>`;
  $('#bar').classList.add('detail');
  let lastSec = null; let body = '';
  rows.forEach(r => {
    if (stuSort === 'class' && r.sec !== lastSec) { lastSec = r.sec; body += `<tr class="sgroup"><th colspan="9" style="--cc:${classColor(r.sec)}">${esc(r.sec.label)}</th></tr>`; }
    const o = openSec(r.sec); const qs = r.grade && r.f.gi >= 0 ? quickestPath(r.sec, o, r.f.gi, r.f.ixl) : null;
    const ix = r.ixl; const fin = r.finals.map(x => `<span class="qfin">Q${x.q} ${x.g}<small>${letterOf(x.g)}</small>${x.closed ? '' : ' <small>kept</small>'}</span>`).join('');
    body += `<tr data-open="${esc(r.sec.key)}" data-name="${esc(r.name)}" class="${r.sliding ? 'sliding' : ''}"><td><button class="nm nmbtn">${nm(r.name)}</button>${r.l30 && !H ? ' <span class="fflag l30 small">L30</span>' : ''}${r.sliding ? ' <span class="gtag">sliding</span>' : ''}</td>
      <td class="sCls"><span class="qdot" style="--cc:${classColor(r.sec)}"></span>${esc(r.sec.label)}</td><td class="sGr">${r.grade ? gradeChip(r.grade) + (mixedQ ? ` <small>Q${liveQuarter(r.sec)}</small>` : '') : '<small>no grade yet</small>'}</td>
      <td class="${r.d < 0 ? 'down' : r.d > 0 ? 'up' : ''}" data-l="Since last import">${r.d == null ? '' : signedPts(r.d)}</td><td data-l="Missing">${r.missing || ''}</td>
      <td data-l="IXL">${ix && ix.pct != null ? `${Math.round(ix.pct)}% <small>${ix.done}/${ix.poss}</small>` : '<small>—</small>'}</td><td class="qcol">${quickestShort(qs)}</td><td>${r.retake.hasGrades ? retakeChip(r.retake) : ''}</td><td>${fin}</td></tr>`;
  });
  $('#gridwrap').innerHTML = `<div class="grades stuDir"><section class="gsec"><table class="checkTable gstu sdir"><thead><tr><th>Student</th><th>Class</th><th>${mixedQ ? 'This quarter' : esc(Q_NAMES[cq - 1])}</th><th>Since last import</th><th>Missing</th><th>IXL at goal</th><th>Quickest to the next letter</th><th>Retake</th><th>Earlier quarters</th></tr></thead><tbody>${body || `<tr><td colspan="9" class="ghint">${q ? `No student matches “${esc(search)}”.` : 'No students yet: import a Focus gradebook or paste a roster.'}</td></tr>`}</tbody></table></section></div>`;
  $('#gridwrap').querySelectorAll('tr[data-open]').forEach(tr => tr.onclick = () => openProfile(tr.dataset.open, tr.dataset.name));
  $('#bar').querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { stuSort = b.dataset.sort; render(); });
  const sc = $('#stuClass'); if (sc) sc.onchange = () => { stuClass = sc.value; render(); };
  const l3 = $('#stuL30'); if (l3) l3.onclick = () => { stuL30 = !stuL30; render(); };
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
// A tile's own trend: a small line (and optionally a dashed reference, e.g. the class average) scaled to its own range.
function tileSpark(vals, o) {
  o = o || {}; const all = [...vals, ...(o.ref || [])].filter(x => x != null); if (vals.filter(x => x != null).length < 2) return '';
  const W = 96, Hh = 26; const lo = Math.min(...all), hi = Math.max(...all); const X = (i, n) => 3 + i * (W - 6) / Math.max(1, n - 1), Y = x => Hh - 4 - (x - lo) / ((hi - lo) || 1) * (Hh - 8);
  const path = a => { let d = ''; a.forEach((x, i) => { if (x != null) d += (d ? 'L' : 'M') + X(i, a.length).toFixed(1) + ' ' + Y(x).toFixed(1) + ' '; }); return d; };
  const lastI = vals.map((x, i) => x != null ? i : -1).filter(i => i >= 0).pop();
  return `<svg class="tspark" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" role="img" aria-label="${esc(o.label || 'trend')}">${o.ref ? `<path class="ref" d="${path(o.ref)}"/>` : ''}<path d="${path(vals)}" style="stroke:${o.color || 'var(--teal)'}"/><circle cx="${X(lastI, vals.length).toFixed(1)}" cy="${Y(vals[lastI]).toFixed(1)}" r="2.6" style="fill:${o.color || 'var(--teal)'}"/></svg>`;
}
function renderProfile() {
  rowCache = new Map();
  const st = view.stu; const sec = state.sections[st.key]; if (!sec) { view = { mode: 'students', unit: null }; return render(); }
  const H = state.settings.hideNames; const name = st.name; const shownName = H ? mask(name) : niceName(name); const nm = d => esc(H ? mask(d) : niceName(d));
  const f = findStudent(sec, name); const sum = studentSummary(sec, name); const books = studentBooks(sec, name);
  const openB = books.find(b => !b.closed); const cq = liveQuarter(sec);
  const list = classStudents(sec); const at = list.findIndex(n => norm(n) === norm(name));
  const backLabel = profileBack && profileBack.mode === 'grades' ? 'Grades' : profileBack && profileBack.mode === 'home' ? 'Overview' : profileBack && profileBack.mode === 'seating' ? 'Seating' : profileBack && (profileBack.mode === 'units' || profileBack.mode === 'unit') ? sec.label : 'Students';
  $('#bar').innerHTML = `<div class="crumb"><button id="back">‹ ${esc(backLabel)}</button><h2>${esc(shownName)}</h2></div><span class="meta"><span class="qdot" style="--cc:${classColor(sec)}"></span>${esc(sec.label)}${f.id && !H ? ` · ID ${esc(f.id)}` : ''}${at >= 0 ? ` · ${at + 1} of ${list.length}` : ''}</span><div class="spacer"></div>
    <span class="pnav"><button class="pill toggle" id="pPrev" ${at > 0 ? '' : 'disabled'} title="Previous student in this class">‹ Prev</button><button class="pill toggle" id="pNext" ${at >= 0 && at < list.length - 1 ? '' : 'disabled'} title="Next student in this class">Next ›</button></span>
    ${openB ? `<button class="pill toggle" id="pPrint" title="The weekly report: one printed page for the student and home">Weekly report</button>` : ''}${testHistory(sec, name).some(h => /FAST/i.test(h.test) && h.scale != null) ? `<button class="pill toggle" id="pFast" title="One printed page: FAST levels, this year's targets and a goal box">FAST report</button>` : ''}<button class="pill toggle" id="pConf" title="The school's parent conference form, filled in from Tally">Conference form</button>${openB ? `<button class="pill" id="pShow" title="Turn the screen toward the student: their grade and what-ifs, nothing else">Show student</button>` : ''}`;
  $('#bar').classList.add('detail');

  // headline tiles
  const r = sum.grade; const ix = sum.ixl;
  const assessNow = openB ? (() => { let e = 0, p = 0; openB.s.grades.assignments.filter(a => isAssess(openB.s, a)).forEach(a => { const c = cellOf(a, openB.i); if (c.st === 'score' || c.st === 'missing') { e += c.st === 'missing' ? 0 : (c.v || 0); p += a.max; } }); return p ? e / p * 100 : null; })() : null;
  const it = ixlTrend(sec, f.ixl); const itD = it && it.mine.filter(v => v != null).length >= 2 ? (() => { const v = it.mine.filter(x => x != null); return v[v.length - 1] - v[v.length - 2]; })() : null;
  // The two small trends live inside their tiles (a 6 px chart axis helps nobody): the line, and for IXL the class average as a number.
  const ghs = sec.gradeHistory || []; const missHist = ghs.map(h => { const j = h.students.indexOf(name); return j >= 0 ? h.missing[j] : null; });
  const clsNow = it && it.cls.length ? it.cls[it.cls.length - 1] : null;
  const tiles = `<div class="gcards">
    <div class="gcard big"><small>${esc(Q_NAMES[cq - 1])} grade</small>${r && r.rounded != null ? `<b>${r.rounded}%<em class="lt ${r.letter}">${r.letter}</em></b><span class="${sum.d < 0 ? 'down' : 'up'}">${sum.d != null ? `${signedPts(sum.d)} since the last import` : 'first import this quarter'}</span>` : `<b>—</b><span>${f.gi < 0 ? 'not in this class\'s Focus gradebook' : openB ? 'nothing graded yet (all excused or blank)' : 'no ' + esc(Q_NAMES[cq - 1]) + ' gradebook yet'}</span>`}</div>
    ${sum.finals.map(x => `<div class="gcard"><small>${esc(Q_NAMES[x.q - 1])} ${x.closed ? 'final' : '(kept)'}</small><b>${x.g}%<em class="lt ${letterOf(x.g)}">${letterOf(x.g)}</em></b><span>${x.closed ? 'closed · kept in Tally' : 'not closed yet · kept in Tally'}</span></div>`).join('')}
    <div class="gcard"><small>Missing now</small><b>${openB ? sum.missing : '—'}${openB ? tileSpark(missHist, { color: 'var(--bad)', label: 'missing assignments at each Focus import' }) : ''}</b><span>${openB ? (sum.dMissing > 0 ? `+${sum.dMissing} since the last import` : sum.missing ? 'not handed in (counts as 0)' : 'nothing missing') : ''}</span></div>
    <div class="gcard"><small>IXL at goal</small><b>${ix && ix.pct != null ? Math.round(ix.pct) + '%' : '—'}${it ? tileSpark(it.mine, { ref: it.cls, label: 'IXL skills at goal at each export, with the class average dashed' }) : ''}</b><span>${ix && ix.poss ? `${ix.done} of ${ix.poss} skills${ix.basisClosed ? ' (closed units)' : ''}${itD != null ? ` · ${itD >= 0 ? '+' : '−'}${Math.abs(itD)} since the last export` : ''}${clsNow != null && !ix.basisClosed ? ` · class average ${fmtN(Math.round(clsNow * 10) / 10)} skills` : ''}` : f.ixl == null ? (f.noAccount ? 'no IXL account' : 'not matched to an IXL account') : 'no units assigned'}</span></div>
    <div class="gcard"><small>Tests &amp; quizzes</small><b>${assessNow != null ? Math.round(assessNow) + '%' : '—'}</b><span>${assessNow != null ? 'IXL columns left out' : ''}</span></div>
    ${openB ? (() => { const rt = retakeStatus(sec, name); return `<div class="gcard ${rt.ok ? 'rtOk' : 'rtNo'}" id="pRetake"><small>Retake</small><b>${rt.ok ? `${ico('check', 'eligible')} Eligible` : 'Not yet'}</b><span>${rt.ok ? 'nothing missing' + (rt.unit ? ', ' + rt.unit.short + ' IXL at goal' : '') : esc(retakeWhy(rt))}</span></div>`; })() : ''}
  </div>`;

  // trends
  const gh = sec.gradeHistory || []; let trends = '';
  if (gh.length) {
    const labels = gh.map(h => fmtDate(h.date)); const marks = []; gh.forEach((h, i) => { if (i && snapQ(h) !== snapQ(gh[i - 1])) marks.push({ i, label: 'Q' + snapQ(h) }); });
    const mine = gh.map(h => { const j = h.students.indexOf(name); return j >= 0 ? h.grade[j] : null; }); const cls = gh.map(h => mean(h.grade));
    const gradeChart = mine.filter(v => v != null).length >= 2 ? chartLines(labels, [{ name: H ? mask(name) : firstName(name), values: mine, color: 'var(--teal)' }, { name: 'Class average', values: cls, color: '#8a93a6', ref: true }], { pct: true, min: (lo => lo >= 65 ? 60 : lo >= 25 ? 20 : 0)(Math.min(...mine.filter(v => v != null), ...cls.filter(v => v != null))), max: 100, h: 240, w: 760, marks, aria: 'grade by import against the class average' }) : '';
    const catNames = gradingFor(sec.prep).cats.map(c => c.name); const hc = gh.filter(h => h.cats);
    const catChart = hc.length >= 2 ? chartLines(hc.map(h => fmtDate(h.date)), catNames.map((c, k) => ({ name: c, values: hc.map(h => { const j = h.students.indexOf(name); return j >= 0 && h.cats[c] ? h.cats[c][j] : null; }), color: seriesColor(k) })).filter(sr => sr.values.some(v => v != null)), { pct: true, min: 0, max: 100, h: 220, w: 760, aria: 'category percent by import' }) : '';
    trends = `<section class="gsec"><h3>Grade over the year</h3>${gradeChart || `<p class="ghint">The line appears after a second Focus import (${plural(mine.filter(v => v != null).length, 'import')} so far).</p>`}
      ${catChart ? `<h4 class="subh">Each category</h4>${catChart}` : ''}</section>`;
  }

  // assessments across the year
  const assess = []; books.forEach(b => b.s.grades.assignments.filter(a => isAssess(b.s, a)).forEach(a => { const c = cellOf(a, b.i); if (c.st === 'blank' || c.st === 'unread') return; assess.push({ a, q: b.q, closed: b.closed, date: aDate(a, b.s.grades) || '', pct: c.st === 'missing' ? 0 : c.st === 'score' ? (c.v || 0) / a.max * 100 : null, c, avg: avgPct(a) }); }));
  assess.sort((x, y) => x.date.localeCompare(y.date) || x.a.name.localeCompare(y.a.name));
  const aMarks = []; assess.forEach((x, i) => { if (i && x.q !== assess[i - 1].q) aMarks.push({ i, label: 'Q' + x.q }); });
  const assessChart = assess.filter(x => x.pct != null).length >= 2 ? chartLines(assess.map(x => x.date ? fmtDate(x.date) : x.a.name.slice(0, 10)), [{ name: H ? mask(name) : firstName(name), values: assess.map(x => x.pct), color: 'var(--teal)' }, { name: 'Class average', values: assess.map(x => x.avg), color: '#8a93a6', ref: true }], { pct: true, min: 0, max: 100, h: 230, w: 760, marks: aMarks, aria: 'each assessment score against the class average' }) : '';
  const scoreTxt = (c, a) => c.st === 'missing' ? '<b class="nhi">NHI</b>' : c.st === 'excused' ? '<small>excused</small>' : c.st === 'score' ? `${fmtN(c.v)}/${a.max}` : '—';
  const assessSec = assess.length ? `<section class="gsec"><h3>Assessments across the year</h3>${assessChart}<table class="checkTable"><thead><tr><th>Assessment</th><th>Quarter</th><th>Due</th><th class="n">Score</th><th class="n">%</th><th class="n">Class avg</th><th class="n">vs class</th></tr></thead><tbody>
      ${assess.slice().reverse().map(x => `<tr class="${x.closed ? 'qold' : ''}"><td>${esc(x.a.name)}</td><td>Q${x.q}${x.closed ? ' <small>closed</small>' : ''}</td><td>${esc(x.a.due || '')}</td><td class="n">${scoreTxt(x.c, x.a)}</td><td class="n">${x.pct == null ? '' : Math.round(x.pct) + '%'}</td><td class="n">${pct1(x.avg)}</td><td class="n ${x.pct != null && x.avg != null ? (x.pct - x.avg < -5 ? 'down' : x.pct - x.avg > 5 ? 'up' : '') : ''}">${x.pct != null && x.avg != null ? signedPts(Math.round(x.pct - x.avg)) : ''}</td></tr>`).join('')}</tbody></table></section>` : '';

  // every assignment, per quarter
  const table = b => { const rows = b.s.grades.assignments.map(a => ({ a, c: cellOf(a, b.i), cat: catIn(b.s, a), avg: avgPct(a) })).sort((x, y) => dueKey(y.a.due).localeCompare(dueKey(x.a.due)) || x.a.name.localeCompare(y.a.name));
    const g = computeGrade(b.s, b.i);
    return `<div class="catline">${(b.s._cats || gradingFor(sec.prep).cats).map(c => { const x = g && g.cats[c.name]; return `<div class="catbar"><span>${esc(c.name)} <small>${c.w}%</small></span><div class="bar"><i style="width:${x && x.pct != null ? Math.max(0, Math.min(100, x.pct)) : 0}%;background:${gradeFill(x && x.pct)}"></i></div><b>${x && x.pct != null ? pct1(x.pct) : '—'}</b><small>${x && x.possible ? `${+x.earned.toFixed(1)} / ${x.possible} pts` : ''}</small></div>`; }).join('')}</div>
      <table class="checkTable sasg"><thead><tr><th>Assignment</th><th>Category</th><th>Due</th><th class="n">Score</th><th class="n">%</th><th class="n">Class avg</th></tr></thead><tbody>${rows.map(x => `<tr class="${x.c.st === 'missing' ? 'miss' : ''}"><td>${esc(x.a.name)}</td><td>${esc(x.cat)}</td><td>${esc(x.a.due || '')}</td><td class="n">${scoreTxt(x.c, x.a)}</td><td class="n">${x.c.st === 'score' && x.a.max ? Math.round(x.c.v / x.a.max * 100) + '%' : x.c.st === 'missing' ? '0%' : ''}</td><td class="n">${pct1(x.avg)}</td></tr>`).join('')}</tbody></table>`; };
  const asgSecs = books.slice().reverse().map(b => { const g = computeGrade(b.s, b.i); const miss = b.s.grades.assignments.filter(a => cellOf(a, b.i).st === 'missing').length;
    const head = `${esc(Q_NAMES[b.q - 1])}${b.closed ? (b.final ? ' · final' : ' · kept') : ''} · ${g && g.rounded != null ? `${g.rounded}% ${g.letter}` : '—'} · ${plural(b.s.grades.assignments.length, 'assignment')}${miss ? ` · ${miss} missing` : ''}`;
    return b.closed ? `<details class="gsec qbook"><summary><h3>${head}</h3><small>${b.final ? `closed ${esc(fmtDate((quarters().closed[b.q].at || '').slice(0, 10)))}: nothing here raises alerts` : 'kept when the next quarter\'s export arrived: close the quarter under Quarters'}</small></summary>${table(b)}</details>` : `<section class="gsec qbook"><h3>${head}</h3>${table(b)}</section>`; }).join('');

  // IXL by unit
  let ixlSec = '';
  if (ix && ix.units.length) {
    const unitRow = x => `<div class="iu ${x.closed ? 'closed' : ''}"><div class="iuh"><b>${esc(x.u.short)}</b> <span>${esc(x.u.title)}</span>${x.closed ? ` <span class="gtag muted">Q${x.q} · closed</span>` : x.u.current ? ' <span class="gtag">now</span>' : ''}<span class="iup">${x.p} / ${x.n}</span></div><div class="bar"><i style="width:${x.n ? x.p / x.n * 100 : 0}%"></i></div>
      ${x.below.length ? `<div class="iul"><span>Below goal (${sec.threshold}):</span> ${x.below.map(b => `${esc(b.name)} <small>${b.v}</small>`).join(' · ')}</div>` : ''}${x.notStarted.length ? (x.notStarted.length <= 4 ? `<div class="iul"><span>Not started:</span> ${esc(x.notStarted.join(' · '))}</div>` : `<details class="iul iumore"><summary><span>Not started:</span> ${plural(x.notStarted.length, 'skill')}</summary>${esc(x.notStarted.join(' · '))}</details>`) : ''}${!x.below.length && !x.notStarted.length ? `<div class="iul done">All ${x.n} skills at goal</div>` : ''}</div>`;
    const cl = ix.units.filter(x => x.closed);
    ixlSec = `<section class="gsec"><h3>IXL by unit <small>goal SmartScore ${sec.threshold} · export of ${esc(fmtDate(dataDate(sec)))}</small></h3>${ix.open.map(unitRow).join('') || '<p class="ghint">Every assigned unit is in a closed quarter.</p>'}
      ${cl.length ? `<details class="qunitsold"><summary>${plural(cl.length, 'unit')} from closed quarters: still tracked, no alerts</summary>${cl.map(unitRow).join('')}</details>` : ''}</section>`;
  } else if (f.ixl == null) ixlSec = `<section class="gsec"><h3>IXL</h3><p class="ghint">${f.noAccount ? 'No IXL account.' : 'Not matched to an IXL account in this class.'}</p></section>`;

  // what would move it (open quarter only)
  const qp = openB ? quickestPath(sec, openB.s, openB.i, f.ixl) : null;
  const wi = openB ? `${qp ? `<section class="gsec" id="pQuick">${quickestCard(qp)}</section>` : ''}<section class="gsec" id="pWhat"><h3>What would move the grade <small>${esc(Q_NAMES[openB.q - 1])}</small></h3>${whatIfMarkup(openB.s, openB.i, retakeStatus(sec, name))}</section>`
    : `<section class="gsec"><h3>What would move the grade</h3><p class="ghint">${anyClosed() ? `${esc(Q_NAMES[cq - 1])} has no gradebook yet: closed quarters don't change, so there's nothing to move until the first ${esc(Q_NAMES[cq - 1])} import.` : 'Import this class\'s Focus gradebook for grades and what-ifs.'}</p></section>`;

  $('#gridwrap').innerHTML = `<div class="grades profile">${tiles}<div class="pcols"><div class="pmain">${trends}${assessSec}${asgSecs}</div><div class="pside">${wi}${ixlSec}${practiceSection(sec, name)}${testsSection(sec, name)}${notesSection(sec, name)}${familySection(sec, name)}</div></div></div>`;
  if (openB) wireWhatIf($('#pWhat'), openB.s, openB.i);
  $('#back').onclick = profileLeave;
  const go = d => { const n = list[at + d]; if (n) { view.stu = { key: sec.key, name: n }; render(); } };
  $('#pPrev').onclick = () => go(-1); $('#pNext').onclick = () => go(1);
  const pp = $('#pPrint'); if (pp) pp.onclick = () => printStudentReports(sec, [f.gi], `${name}: report`);
  const pf = $('#pFast'); if (pf) pf.onclick = () => printFastReports(sec, [name], 'FAST report');
  const ps = $('#pShow'); if (ps) ps.onclick = () => openShow(sec, name);
  wireNotes(sec, name); wireFamily(sec, name);
  const pc = $('#pConf'); if (pc) pc.onclick = () => openConference(sec, name);
}

/* ---------- Quickest way to the next letter ----------
   The fewest pieces of work that lift the grade one letter (F→D, D→C, C→B, B→A), chosen one at a time by what each adds.
   Missing work (NHI) and IXL come first: that is where struggling students' points are; only if those can't get there are
   retakes added (the last one at the lowest score that still works). An IXL step is one skill: one more point in that
   unit's Focus IXL column, and the page names which skills are closest to goal. */
const NEXT_UP = [[60, 'D'], [70, 'C'], [80, 'B'], [90, 'A']];
function quickestPath(sec, s, i, ixlIdx) {
  const base = computeGrade(s, i); if (!base || base.rounded == null) return null;
  const tgt = NEXT_UP.find(([t]) => base.rounded < t); if (!tgt) return { top: true, base };
  const [target, letter] = tgt; const gb = s.grades;
  const ixlCol = a => /\bixl\b/i.test(a.name) && a.max > 0 && a.status && (a.status[i] === 'score' || a.status[i] === 'missing');
  // IXL as it really stands (audit, 22 Oct 2026): Tally's points can be ahead of the Focus column (not copied yet) —
  // that gap is a copy, not student work — and no student is planned more skills than their own list holds.
  const focusOf = a => a.status[i] === 'missing' ? 0 : (Number(a.values[i]) || 0);
  const ixlInfo = {};
  if (ixlIdx != null) gb.assignments.filter(ixlCol).forEach(a => { const u = gbUnitFor(sec, a); const unit = u ? unitsOf(sec).find(x => x.name === u.name) : null; if (!unit) return;
    const tp = points(sec, unit, ixlIdx), n = activeFor(sec, unit, ixlIdx).length; ixlInfo[a.name] = { tp, cap: Math.min(a.max, Math.max(n, focusOf(a))), unit: u }; });
  const copies = gb.assignments.filter(a => ixlInfo[a.name] && ixlInfo[a.name].tp > focusOf(a)).map(a => ({ a, from: focusOf(a), to: Math.min(a.max, ixlInfo[a.name].tp), unit: ixlInfo[a.name].unit }));
  const copyTo = n => { const c = copies.find(x => x.a.name === n); return c ? c.to : null; };
  const nowOf = a => { const c = copyTo(a.name); return c != null ? c : focusOf(a); };
  const capOf = a => ixlInfo[a.name] ? ixlInfo[a.name].cap : a.max;
  const nhi = gb.assignments.filter(a => a.max > 0 && a.status && a.status[i] === 'missing' && !ixlCol(a));
  const ixl = ixlIdx == null ? [] : gb.assignments.filter(a => ixlCol(a) && nowOf(a) < capOf(a));   // no IXL link: Tally can't name the skills, so it doesn't plan them (the retake line says "IXL not linked")
  const over = {}; copies.forEach(c => over[c.a.name] = c.to); const done = new Set(); const ixlPlus = {}; const g = () => computeGrade(s, i, over).rounded;
  let cur = g(); let guard = 0;
  // phase 1: missing work and IXL skills, best gain first (ties go to missing work: one assignment, done)
  while (cur < target && guard++ < 400) {
    let best = null;
    nhi.forEach(a => { if (done.has(a.name)) return; over[a.name] = a.max; const v = computeGrade(s, i, over).pct; delete over[a.name]; if (!best || v > best.v + 1e-9) best = { v, kind: 'nhi', a }; });
    ixl.forEach(a => { const at = nowOf(a) + (ixlPlus[a.name] || 0); if (at >= capOf(a)) return; const prev = over[a.name]; over[a.name] = at + 1; const v = computeGrade(s, i, over).pct; if (prev == null) delete over[a.name]; else over[a.name] = prev; if (!best || v > best.v + 1e-9) best = { v, kind: 'ixl', a }; });
    if (!best) break;
    if (best.kind === 'nhi') { over[best.a.name] = best.a.max; done.add(best.a.name); }
    else { ixlPlus[best.a.name] = (ixlPlus[best.a.name] || 0) + 1; over[best.a.name] = nowOf(best.a) + ixlPlus[best.a.name]; }
    cur = g();
  }
  // prune: greedy can overshoot — drop any assignment, then any IXL skill, the plan still reaches the letter without
  if (cur >= target) {
    [...done].forEach(n => { const v = over[n]; delete over[n]; if (g() >= target) done.delete(n); else over[n] = v; });
    Object.keys(ixlPlus).forEach(n => { const a = gb.assignments.find(x => x.name === n); while (ixlPlus[n] > 0) { ixlPlus[n]--; if (ixlPlus[n]) over[n] = nowOf(a) + ixlPlus[n]; else if (copyTo(n) != null) over[n] = copyTo(n); else delete over[n]; if (g() < target) { ixlPlus[n]++; over[n] = nowOf(a) + ixlPlus[n]; break; } } if (!ixlPlus[n]) delete ixlPlus[n]; });
    cur = g();
  }
  // phase 2: retakes, only when missing work and IXL can't reach the letter. A retake is never a shortcut (Croix,
  // 21 Oct 2026: "A student cannot take a retake unless they are all caught up on everything"), so before any retake
  // the plan includes every missing assignment and every IXL skill the current unit still needs; if that alone
  // reaches the letter, no retake is listed at all.
  const retakes = []; let retakeBlocked = null; const needUnits = [];
  if (cur < target) {
    const rt = retakeStatus(sec, gb.students[i]);
    nhi.forEach(a => { over[a.name] = a.max; done.add(a.name); });
    if (rt.noIxl) retakeBlocked = 'IXL is not linked to this student in Tally, so retake readiness is unknown';
    else { const units = [...(rt.short.length && rt.unit ? [{ unit: rt.unit, short: rt.short }] : []), ...(rt.behind || [])];
      units.forEach(x => { const col = gb.assignments.find(a => ixlCol(a) && (gbUnitFor(sec, a) || {}).name === x.unit.name);
        const need = col ? Math.min(x.short.length, capOf(col) - nowOf(col)) : 0;
        if (col && need > 0) { if (need > (ixlPlus[col.name] || 0)) { ixlPlus[col.name] = need; over[col.name] = nowOf(col) + need; } }
        else needUnits.push({ unit: x.unit, n: x.short.length, full: !!col }); });   // the unit's IXL isn't in Focus yet, or Focus already gives full credit: required, but no grade change
    }
    cur = g();
  }
  if (cur < target && !retakeBlocked) {
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
  // The order to do it in: what adds the most comes first (an IXL line is judged per skill, since each skill is a piece
  // of work), retakes last — and the grade after each line, so the list adds up to the result in front of whoever reads it.
  // (Croix, 7 Oct: the list was in gradebook order, so a +3 worksheet sat above a +7 one and read as the tool's first pick.)
  const pend = [...nhi.filter(a => done.has(a.name)).map(a => ({ kind: 'nhi', a, n: 1, to: a.max })), ...ixlSteps.map(x => ({ kind: 'ixl', a: x.a, n: x.n, to: nowOf(x.a) + x.n, unit: x.unit, skills: x.skills }))];
  const plan = []; const acc = {}; let at = base.pct;
  copies.forEach(c => { acc[c.a.name] = c.to; const r = computeGrade(s, i, acc); at = r.pct; plan.push({ kind: 'copy', a: c.a, n: 0, from: c.from, to: c.to, unit: c.unit, after: r.rounded }); });   // the teacher's copy comes first: it needs no student work
  while (pend.length) { let bi = 0, bv = -Infinity; pend.forEach((c, k) => { acc[c.a.name] = c.to; const v = (computeGrade(s, i, acc).pct - at) / c.n; delete acc[c.a.name]; if (v > bv + 1e-9) { bv = v; bi = k; } });
    const c = pend.splice(bi, 1)[0]; acc[c.a.name] = c.to; const r = computeGrade(s, i, acc); at = r.pct; plan.push({ ...c, after: r.rounded }); }
  retakes.forEach(a => { acc[a.name] = over[a.name]; plan.push({ kind: 'retake', a, n: 1, to: over[a.name], after: computeGrade(s, i, acc).rounded }); });
  if (needUnits.length && retakes.length) { needUnits.forEach(nu => { const ri = plan.findIndex(x => x.kind === 'retake'); plan.splice(ri, 0, { kind: 'ixlreq', full: nu.full, a: { name: nu.unit.short + ' IXL', max: nu.n }, n: nu.n, unit: nu.unit, after: ri > 0 ? plan[ri - 1].after : base.rounded, skills: [] }); }); }
  return { base, target, letter, reached: result.rounded >= target, result, over, plan, retakeBlocked, nhi: plan.filter(x => x.kind === 'nhi').map(x => x.a), ixl: ixlSteps, retakes: retakes.map(a => ({ a, pts: over[a.name] })), steps: done.size + ixlSteps.reduce((x, y) => x + y.n, 0) + retakes.length + (needUnits.length && retakes.length ? needUnits.reduce((x, y) => x + y.n, 0) : 0) };
}
const anLetter = l => (/^[AF]/.test(l) ? 'an ' : 'a ') + l;
// One line for the Students list: "2 missing + 3 IXL skills → C".
function quickestShort(q) {
  if (!q) return ''; if (q.top) return '<small>has an A</small>';
  const parts = []; if (q.nhi.length) parts.push(q.nhi.length + ' missing'); const ix = q.plan.filter(x => x.kind === 'ixl' || x.kind === 'ixlreq').reduce((a, x) => a + x.n, 0); if (ix) parts.push(plural(ix, 'IXL skill')); if (q.retakes.length) parts.push(plural(q.retakes.length, 'retake')); if (q.plan.some(x => x.kind === 'copy')) parts.unshift('copy IXL');   // the same steps the student page lists (audit: the ixlreq step was left out)
  return q.reached ? `${parts.join(' + ')} → <b>${q.letter}</b>` : `<small>${q.letter} needs more than missing work, IXL and retakes</small>`;
}
// The plan as a list, for the teacher's page, the student's screen and the printed report.
function quickestList(q, forStudent) {
  if (!q || q.top) return '';
  const after = x => `<span class="qafter" title="The grade once this and everything above it is done">→ ${x.after}%</span>`;
  const items = q.plan.map(x => x.kind === 'nhi' ? `<li>${after(x)}<b>Turn in ${esc(x.a.name)}</b> <small>${x.a.max} pts${x.a.due ? ' · was due ' + esc(x.a.due) : ''}</small></li>`
    : x.kind === 'ixl' ? `<li>${after(x)}<b>Pass ${plural(x.n, 'more IXL skill')}${x.unit ? ' in ' + esc(x.unit.short) : ''}</b> <small>${esc(x.a.name)}</small>${x.skills.length ? `<div class="qsk">${x.skills.map(k => `${esc(k.name)} <small>${k.v == null ? 'not started' : 'at ' + k.v}</small>`).join(' · ')}</div>` : ''}</li>`
    : x.kind === 'copy' ? `<li>${after(x)}<b>${forStudent ? `Your ${esc(x.unit ? x.unit.short : x.a.name)} IXL goes into Focus` : `Copy ${esc(x.unit ? x.unit.short : x.a.name)} IXL into Focus`}</b> <small>${forStudent ? 'already earned' : `IXL has ${fmtN(x.to)}, Focus shows ${fmtN(x.from)}`}</small></li>`
    : x.kind === 'ixlreq' ? `<li><span class="qafter none" title="This step opens the retake; it adds no points until Focus has a column for it">no change</span><b>Finish ${plural(x.n, 'IXL skill')} in ${esc(x.unit.short)}</b> <small>${x.full ? `Focus already gives full credit for ${esc(x.unit.short)} IXL` : `${esc(x.unit.short)} IXL isn't in Focus yet`} · needed before a retake</small></li>`
    : `<li>${after(x)}<b>Retake ${esc(x.a.name)}</b> <small>score at least ${fmtN(x.to)} / ${x.a.max} · ${forStudent ? 'once everything above is done' : 'allowed once everything above is done'}</small></li>`);
  return `<ol class="qpath">${items.join('')}</ol>`;
}
function quickestCard(q, forStudent) {
  if (!q) return ''; if (q.top) return `<div class="qcard top"><b>${forStudent ? 'You have an A' : 'Already an A'}</b><span>${forStudent ? 'Keep turning everything in.' : 'Nothing to climb: the what-ifs below show what keeps it.'}</span></div>`;
  const head = forStudent ? `Your quickest way to ${anLetter(q.letter)}` : `Quickest way to ${anLetter(q.letter)}`;
  if (!q.reached) return `<div class="qcard"><b>${head}</b><span>Even with every missing assignment turned in, IXL finished${q.retakeBlocked ? '' : ' and every retake at full marks'}, the grade only reaches ${q.result.rounded}%. It will take the next assessments too.${!forStudent && q.retakeBlocked ? ` Retakes aren't planned: ${esc(q.retakeBlocked)}.` : ''}</span>${quickestList(q, forStudent)}</div>`;
  return `<div class="qcard"><div class="qhead"><b>${head}</b><span class="qres">${q.base.rounded}% → <b>${q.result.rounded}% ${q.result.letter}</b></span></div><span>${plural(q.steps, 'step')}${q.ixl.length ? ' · IXL counts once it\'s copied into Focus' : ''}</span>${quickestList(q, forStudent)}${forStudent ? '<button class="pill" id="shPlan">Show me on the sliders</button>' : ''}</div>`;
}

// The teacher's what-ifs: each missing assignment turned in, retakes, IXL columns, and the next assessment.
function nextSize(s) { const sizes = {}; s.grades.assignments.filter(a => isAssess(s, a) && a.max).forEach(a => sizes[a.max] = (sizes[a.max] || 0) + 1); return Number(Object.keys(sizes).sort((a, b) => sizes[b] - sizes[a] || b - a)[0] || 20); }
// A result reads "→ 69 D +5": the new grade, its letter, and the change from now ("no change" when it doesn't move).
const whatIfArrow = r => x => { if (!x || x.rounded == null) return ''; const d = x.rounded - r.rounded; return `<b class="arrow">→ ${x.rounded} <small>${x.letter}</small></b> <span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}">${d > 0 ? '+' + d : d < 0 ? '−' + Math.abs(d) : 'no change'}</span>`; };
function whatIfMarkup(s, i, rt) {
  const gb = s.grades; const r = computeGrade(s, i); if (!r) return ''; if (r.rounded == null) return '<p class="ghint">Nothing is graded for this student yet this quarter.</p>';
  const arrow = whatIfArrow(r);
  const missing = gb.assignments.filter(a => a.status && a.status[i] === 'missing'); const allIn = {}; missing.forEach(a => allIn[a.name] = a.max);
  const assess = gb.assignments.filter(a => catIn(s, a) === 'Assessments' && a.max > 0 && a.status && (a.status[i] === 'score' || a.status[i] === 'missing'));
  const ixlCols = assess.filter(a => /\bixl\b/i.test(a.name) && (a.values[i] == null || a.values[i] < a.max));
  // A retake needs a first take: an assessment that was never handed in (NHI) is missing work, listed above, not here.
  const tests = assess.filter(a => !/\bixl\b/i.test(a.name) && a.status[i] === 'score' && a.values[i] != null && a.values[i] < a.max);
  const nx = nextSize(s);
  return `<div class="wnow">Now ${gradeChip(r)}</div>
    <h4 class="subh">If missing work were turned in${missing.length ? ` <small>${missing.length}</small>` : ''}</h4>
    ${missing.length ? `<table class="checkTable whatif"><tbody>${missing.map(a => `<tr><td><b>${esc(a.name)}</b><small>${esc(catIn(s, a))} · due ${esc(a.due || '?')}</small></td><td>turned in, ${a.max}/${a.max}</td><td>${arrow(computeGrade(s, i, { [a.name]: a.max }))}</td></tr>`).join('')}${missing.length > 1 ? `<tr class="total"><td><b>All ${missing.length} turned in</b></td><td>full credit</td><td>${arrow(computeGrade(s, i, allIn))}</td></tr>` : ''}</tbody></table>` : '<p class="ghint">Nothing missing.</p>'}
    ${tests.length ? `<h4 class="subh">If an assessment were retaken${rt ? ` <span class="rtag ${rt.ok ? 'ok' : ''}">${rt.ok ? ico('check', 'eligible') + ' eligible' : 'not yet: ' + esc(retakeWhy(rt))}</span>` : ''}</h4><table class="checkTable whatif"><thead><tr><th>Assessment</th><th>Now</th><th>70%</th><th>80%</th><th>90%</th><th>100%</th></tr></thead><tbody>${tests.map(a => `<tr><td><b>${esc(a.name)}</b></td><td>${fmtN(a.values[i])}/${a.max} <small>(${Math.round(a.values[i] / a.max * 100)}%)</small></td>${[70, 80, 90, 100].map(p => `<td>${a.values[i] >= a.max * p / 100 ? '<span class="ghint" title="already at or above this">—</span>' : (() => { const pts = Math.round(a.max * p / 100 * 2) / 2; return `<small class="pts">${fmtN(pts)}/${a.max}</small><br>${arrow(computeGrade(s, i, { [a.name]: pts }))}`; })()}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}
    ${ixlCols.length ? `<h4 class="subh">If IXL were finished</h4><table class="checkTable whatif"><tbody>${ixlCols.map(a => `<tr><td><b>${esc(a.name)}</b><small>now ${a.status[i] === 'missing' ? 'NHI' : fmtN(a.values[i]) + '/' + a.max}</small></td><td>every skill, ${a.max}/${a.max}</td><td>${arrow(computeGrade(s, i, { [a.name]: a.max }))}</td></tr>`).join('')}</tbody></table>` : ''}
    <h4 class="subh">If the next assessment scored…</h4>
    <div class="nextrow"><label>out of <input type="number" class="wiMax" value="${nx}" min="1" max="500" style="width:70px"></label><label>score <input type="range" class="wiPts" min="0" max="${nx}" step="0.5" value="${Math.round(nx * 0.8)}"> <b class="wiV">${Math.round(nx * 0.8)}</b> / <span class="wiMaxV">${nx}</span></label><span class="wiOut">${arrow(withNext(s, i, 'Assessments', nx, Math.round(nx * 0.8)))}</span></div>
    <p class="ghint wiNeed">${needText(s, i, nx)}</p>`;
}
function needText(s, i, mx) {
  const na = nextAssessment(s, i, mx); if (na.cur == null) return '';
  const parts = [na.can.map(x => `<b>${fmtN(x.n)}/${mx}</b> for ${x.w}`).join(' · '),
    na.cant.length ? (na.can.length ? `${na.cant.join(' or ')} would take more than one` : `no single assessment out of ${mx} reaches ${na.cant[na.cant.length - 1]}`) : '',
    na.keep ? `${na.keep.n === 0 ? 'even a 0' : `<b>${fmtN(na.keep.n)}/${mx}</b>`} keeps the ${na.keep.letter}` : ''].filter(Boolean);
  return parts.length ? 'Next assessment: ' + parts.join(' · ') + '.' : '';
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
  const gb = s.grades; const cats = gradingFor(sec.prep).cats; const base = computeGrade(s, i); if (!base || base.rounded == null) { toast('Nothing is graded for this student yet this quarter: there is nothing to show.', false); return; }
  const missing = gb.assignments.filter(a => a.status && a.status[i] === 'missing');
  const retake = gb.assignments.filter(a => isAssess(s, a) && a.status && a.status[i] === 'score' && a.values[i] < a.max);
  const ixlCols = gb.assignments.filter(a => catIn(s, a) === 'Assessments' && /\bixl\b/i.test(a.name) && a.max > 0 && a.status && (a.status[i] === 'score' || a.status[i] === 'missing') && (a.values[i] == null || a.values[i] < a.max));
  const nx = nextSize(s);
  const ownAvg = base.cats.Assessments && base.cats.Assessments.pct != null ? base.cats.Assessments.pct / 100 : 0.8; const nxStart = Math.round(nx * ownAvg * 2) / 2;
  const plan = quickestPath(sec, s, i, findStudent(sec, name).ixl);
  const H = state.settings.hideNames; const who = H ? mask(name) : firstName(name);
  // state of every control: missing → { on, pts }, retake/ixl → pts, next → { on, max, pts }
  const st = { miss: {}, re: {}, ix: {}, next: { on: false, max: nx, pts: nxStart } };
  missing.forEach(a => st.miss[a.name] = { on: false, pts: a.max }); retake.forEach(a => st.re[a.name] = a.values[i]); ixlCols.forEach(a => st.ix[a.name] = a.status[i] === 'missing' ? 0 : a.values[i]);
  const row = (kind, a, now, lo) => `<div class="shRow" data-k="${kind}" data-n="${esc(a.name)}"><div class="shL"><b>${esc(a.name)}</b><small>${kind === 'miss' ? `not handed in · worth ${a.max} points` : `now ${fmtN(now)} / ${a.max}`}</small></div>
      ${kind === 'miss' ? `<label class="shSw"><input type="checkbox" class="shOn"><span>Turn it in</span></label>` : ''}
      <div class="shS ${kind === 'miss' ? 'off' : ''}"><input type="range" class="shPts" min="${lo}" max="${a.max}" step="0.5" value="${kind === 'miss' ? a.max : now}" aria-label="${esc(a.name)} score"><output>${fmtN(kind === 'miss' ? a.max : now)} / ${a.max}</output></div></div>`;
  const el = document.createElement('div'); el.id = 'show'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'What-ifs for ' + who);
  el.innerHTML = `<div class="shTop"><div><div class="shWho">${esc(who)}</div><div class="shSub">${esc(sec.label)} · ${esc(Q_NAMES[liveQuarter(sec) - 1])} · Focus of ${esc(fmtDate(localDayOf(gb.importedAt)))}</div></div>
      <div class="shTools"><button class="pill pale" id="shReset">Start over</button><button class="pill small exitPill" id="shExit" title="Teacher: press and hold to exit"><span class="ring"></span>Hold to exit</button></div>
      <div class="shGrade"><div class="shNow"><small>Your grade now</small><b>${base.rounded}<span>%</span></b><em class="lt ${base.letter}">${base.letter}</em></div>
        <div class="shArrow" aria-hidden="true">→</div>
        <div class="shIf"><small>If you do the things you picked</small><b id="shIfV">${base.rounded}<span>%</span></b><em class="lt ${base.letter}" id="shIfL">${base.letter}</em><div class="shDelta" id="shDelta">Pick something below</div></div></div></div>
    <div class="shBody">
      <div class="shQuick">${quickestCard(plan, true)}</div>
      <div class="shTry">
        ${missing.length ? `<section><h3>Turn in missing work</h3>${missing.map(a => row('miss', a, 0, 0)).join('')}</section>` : ''}
        ${retake.length ? (() => { const rt = retakeStatus(sec, name); return `<section><h3>Retake an assessment</h3>${rt.ok ? `<p class="shHint rtLine ok">${ico('check', 'eligible')} You can retake: nothing is missing${rt.unit ? ` and ${esc(rt.unit.short)} IXL is at goal` : ''}.</p>` : `<p class="shHint rtLine">To retake: ${esc(retakeWhy(rt, true))}.</p>`}${retake.map(a => row('re', a, a.values[i], a.values[i])).join('')}</section>`; })() : ''}
        ${ixlCols.length ? `<section><h3>Finish IXL</h3>${ixlCols.map(a => row('ix', a, st.ix[a.name], st.ix[a.name])).join('')}</section>` : ''}
        <section><h3>Your next assessment</h3><div class="shRow" data-k="next"><div class="shL"><b>Next test or quiz</b><small>out of <input type="number" id="shNextMax" value="${nx}" min="1" max="200"> points</small></div><label class="shSw"><input type="checkbox" class="shOn" id="shNextOn"><span>Count it</span></label>
          <div class="shS off"><input type="range" class="shPts" id="shNextPts" min="0" max="${nx}" step="0.5" value="${st.next.pts}" aria-label="Next assessment score"><output>${st.next.pts} / ${nx}</output></div></div>
          <p class="shHint" id="shNeed"></p></section>
      </div>
      <div class="shCats" id="shCats"></div><p class="shHint shKey"><i></i>now</p>
    </div>`;
  document.body.appendChild(el); document.body.classList.add('showMode'); $('#toast').classList.remove('show');
  const catBars = (a, b) => cats.map(c => { const x = a.cats[c.name], y = b.cats[c.name]; const w = v => v == null ? 0 : Math.max(0, Math.min(100, v)); return `<div class="shCat"><span>${esc(c.name)} <small>counts ${c.w}%</small></span><div class="shBar"><i class="if" style="width:${w(y && y.pct)}%;background:${gradeFill(y && y.pct)}"></i><i class="now" style="left:calc(${w(x && x.pct)}% - 2px)" title="now ${x && x.pct != null ? Math.round(x.pct) + '%' : '—'}"></i></div><b>${y && y.pct != null ? Math.round(y.pct) + '%' : '—'}</b></div>`; }).join('');
  const recompute = () => {
    const over = {}; missing.forEach(a => { if (st.miss[a.name].on) over[a.name] = st.miss[a.name].pts; }); retake.forEach(a => { if (st.re[a.name] !== a.values[i]) over[a.name] = st.re[a.name]; }); ixlCols.forEach(a => { const now = a.status[i] === 'missing' ? 0 : a.values[i]; if (st.ix[a.name] !== now) over[a.name] = st.ix[a.name]; });
    const r = gradeWith(s, i, over, st.next.on ? { max: st.next.max, pts: st.next.pts } : null);
    $('#shIfV').innerHTML = `${r.rounded}<span>%</span>`; const L = $('#shIfL'); L.textContent = r.letter; L.className = 'lt ' + r.letter;
    const d = r.rounded - base.rounded; const picked = Object.keys(over).length + (st.next.on ? 1 : 0);
    $('#shDelta').innerHTML = !picked ? 'Pick something below' : d > 0 ? `<b>+${d}</b> points${r.letter !== base.letter ? `: that's ${/^[AF]/.test(r.letter) ? 'an' : 'a'} <b>${r.letter}</b>` : ''}` : d < 0 ? `<b>${d}</b> points` : 'no change yet';
    $('#shDelta').className = 'shDelta ' + (d > 0 ? 'up' : d < 0 ? 'down' : '');
    $('#shCats').innerHTML = catBars(base, r);
    const mx = st.next.max; const na = nextAssessment(s, i, mx);   // the same computed facts as the report: every letter above, a D included
    $('#shNeed').innerHTML = na.can.length ? 'On its own: ' + na.can.map(x => `<b>${fmtN(x.n)} of ${mx}</b> gets you ${x.w}`).join(' · ') + '.' : !na.cant.length ? 'You have an A: keep it up.' : `One test alone can't get you to ${na.cant[na.cant.length - 1]} from here${missing.length ? ': turning in the missing work is the biggest help' : ''}.`;
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
.qcard{display:flex;flex-direction:column;gap:6px}.qcard .qhead{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline}.qcard>b,.qcard .qhead>b{font-size:var(--t-l);color:var(--navy)}.qcard>span{color:var(--ink-soft);font-size:var(--t-s)}.qres{font-size:var(--t-l)}.qres b{color:var(--teal)}
.qpath{margin:4px 0 2px;padding-left:22px;display:flex;flex-direction:column;gap:6px}.qpath li small{color:var(--ink-soft)}.qafter{float:right;margin-left:14px;font-weight:var(--w-heavy);color:var(--navy);white-space:nowrap}.qafter.none{color:var(--ink-soft);font-weight:var(--w-med);font-size:var(--t-s)}.qsk{font-size:var(--t-s);margin-top:2px}.qsk small{color:var(--bad);font-weight:var(--w-bold)}
#pQuick{border-left:5px solid var(--teal)}.qcol{font-size:var(--t-s);white-space:nowrap}.qcol b{color:var(--teal)}
.shQuick .qcard{background:var(--white);border-radius:var(--r);box-shadow:var(--shadow-1);padding:16px 22px;border-left:6px solid var(--teal)}.shQuick .qcard>b,.shQuick .qhead>b{font-size:clamp(20px,2.4vw,28px)}.shQuick .qpath{font-size:17px}.shQuick #shPlan{align-self:flex-start;margin-top:6px}
.qdot{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--cc);margin-right:6px;vertical-align:baseline}
.sdir tr[data-open]{cursor:pointer}.sdir tr[data-open]:hover td{background:var(--paleturq)}.sdir tr.sgroup th{text-align:left;padding:14px 8px 6px;font-size:var(--t-s);color:var(--navy);border-bottom:3px solid var(--cc)}
.qfin{display:inline-flex;gap:2px;align-items:baseline;font-weight:var(--w-black);font-size:var(--t-s);padding:1px 8px;border-radius:var(--r-pill);background:var(--grid);margin-right:4px}.qfin small{font-size:10px}
.profile .gcards{margin-bottom:14px}.gcard b em.lt,.shGrade em.lt{font-style:normal;font-size:.55em;margin-left:6px;padding:2px 8px;border-radius:var(--r-pill);background:var(--paleturq);vertical-align:middle}
.gcard b em.lt.A,.shGrade em.lt.A,em.lt.A{background:var(--g-a-wash)}.gcard b em.lt.B,.shGrade em.lt.B,em.lt.B{background:var(--g-b-wash)}.gcard b em.lt.C,.shGrade em.lt.C,em.lt.C{background:var(--g-c-wash)}.gcard b em.lt.D,.shGrade em.lt.D,em.lt.D{background:var(--g-d-wash)}.gcard b em.lt.F,.shGrade em.lt.F,em.lt.F{background:var(--g-f-wash);color:var(--bad)}.gcard.big b{font-size:34px}
.pcols{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:16px;align-items:start}.pmain,.pside{display:flex;flex-direction:column;gap:16px;min-width:0}
/* one column: the plan and the what-ifs come first, then the trends, then the long lists */
@media (max-width:1100px){.pcols{display:flex;flex-direction:column;align-items:stretch}.pmain,.pside{display:contents}.pcols #pQuick{order:-3}.pcols #pWhat{order:-2}}
.profile .gcards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}@media (max-width:900px){.profile .gcards{grid-template-columns:1fr 1fr}}.profile .gcard b{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.profile .gcard b em.lt{margin-left:0}
.tspark{margin-left:auto;flex:none}.tspark path{fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.tspark path.ref{stroke:#8a93a6;stroke-width:1.5;stroke-dasharray:3 3}
.pnav{display:inline-flex;gap:6px;white-space:nowrap}
.iumore summary{cursor:pointer;list-style:none}.iumore summary::-webkit-details-marker{display:none}.iumore summary::after{content:": show";color:var(--teal);font-weight:var(--w-bold)}.iumore[open] summary::after{content:": hide"}.iumore[open] summary{margin-bottom:2px}
.checkTable.whatif td:first-child small{display:block;font-weight:var(--w-reg);color:var(--ink-soft)}.checkTable.whatif td:nth-child(2){white-space:nowrap}.checkTable.whatif td:last-child{white-space:nowrap;text-align:right}.checkTable.whatif thead+tbody td:last-child,.checkTable.whatif thead+tbody td{text-align:left;white-space:normal}
.subh{margin:14px 0 4px;font-size:var(--t-xs);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft)}.subh small{color:var(--teal)}
.gsec h3 small{font-weight:var(--w-reg);letter-spacing:0;text-transform:none;color:var(--ink-soft);margin-left:6px}
.catline{display:flex;flex-direction:column;gap:4px;margin:4px 0 10px}.catline .catbar{display:grid;grid-template-columns:150px 1fr 54px 110px;gap:10px;align-items:center;font-size:var(--t-s)}.catline .catbar small{color:var(--ink-soft)}
.catline .bar,.iu .bar{height:10px;border-radius:var(--r-pill);background:var(--grid);overflow:hidden}.catline .bar i,.iu .bar i{display:block;height:100%;background:var(--teal);border-radius:var(--r-pill);box-shadow:inset 0 0 0 1px rgba(22,33,58,.2)}
.sasg tr.miss td{background:#fdeeea}.nhi{color:var(--bad)}.qold td{color:var(--ink-soft)}
details.qbook>summary{cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}details.qbook>summary::-webkit-details-marker{display:none}details.qbook>summary h3{margin:0}details.qbook>summary h3::before{content:"";display:inline-block;width:7px;height:7px;border:solid var(--teal);border-width:0 2px 2px 0;transform:rotate(-45deg);margin:0 10px 2px 2px}details.qbook[open]>summary h3::before{transform:rotate(45deg);margin-bottom:4px}details.qbook>summary small{color:var(--ink-soft)}
.iu{padding:8px 0;border-bottom:1px solid var(--grid)}.iu:last-child{border-bottom:none}.iuh{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;margin-bottom:4px}.iuh span{color:var(--ink-soft);font-size:var(--t-s)}.iup{margin-left:auto;font-weight:var(--w-black);color:var(--navy)!important;font-size:var(--t-l)!important}
.iul{font-size:var(--t-s);margin-top:3px}.iul span{font-weight:var(--w-bold)}.iul small{color:var(--bad);font-weight:var(--w-bold)}.iul.done{font-style:italic;color:var(--teal)}.iu.closed{opacity:.75}
.gtag.muted{background:var(--grid);color:var(--ink-soft)}.qunitsold summary{cursor:pointer;font-size:var(--t-s);color:var(--ink-soft);padding:8px 0}
.wnow{font-size:var(--t-s);display:flex;gap:8px;align-items:center;color:var(--ink-soft)}
.gempty{max-width:620px;margin:40px auto;background:var(--white);border:1px solid var(--grid);border-radius:var(--r);box-shadow:var(--shadow-1);padding:24px}.gempty h3{margin:0 0 8px}
.qseg{margin:0 6px}.quarters .qdates{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:4px}.quarters .qdates label{display:flex;flex-direction:column;gap:3px;padding:8px;border:2px solid var(--grid);border-radius:var(--r-m);font-size:var(--t-s)}
.quarters .qdates label.now{border-color:var(--teal)}.quarters .qdates label.closed{background:var(--grid)}.quarters .qdates small{color:var(--ink-soft)}.quarters h3{margin:14px 0 6px}
.quarters .qlead{font-size:var(--t-l);margin:0 0 10px}.quarters .qkeep{margin:10px 0 4px}.quarters .qkeep td{padding:8px 10px}.quarters .qkeep td:last-child{color:var(--ink-soft);text-align:right;white-space:nowrap}
.qmore{border-top:1px solid var(--grid);margin-top:10px}.qmore summary{cursor:pointer;padding:12px 0;min-height:var(--h-touch);box-sizing:border-box;display:flex;gap:10px;align-items:center;justify-content:space-between;list-style:none;font-weight:var(--w-bold)}.qmore summary::-webkit-details-marker{display:none}.qmore summary u{color:var(--teal);font-weight:var(--w-heavy);white-space:nowrap}.qmore summary b{font-weight:var(--w-black)}.qmore[open]>summary u{visibility:hidden}.qmore#qDates summary,.qmore#qEarly>summary{color:var(--teal);justify-content:flex-start}.qmore#qEarly>summary small{color:var(--ink-soft);font-weight:var(--w-reg);margin-left:6px}.qmore#qEarly[open]>summary{margin-bottom:4px}.quarters>.qdates{margin-bottom:2px}.qmore .field>label{color:var(--ink-soft)}.qmore+.rp-actions{margin-top:14px}
.qunits{display:flex;flex-wrap:wrap;gap:6px 14px;padding:6px 0}.qunits label{display:flex;gap:6px;align-items:center;font-size:var(--t-s)}.qunits label.dim{color:var(--ink-soft)}.qunits small{color:var(--teal)}
.linkbtn{background:none;border:none;padding:0;color:var(--teal);font:inherit;font-weight:var(--w-bold);text-decoration:underline;cursor:pointer}
.qtag{display:inline-block;font-size:var(--t-xs);padding:0 6px;border-radius:var(--r-pill);background:var(--grid);color:var(--ink-soft);font-weight:var(--w-black)}
th.unit.qclosed .uh{opacity:.7}
body.showMode #top,body.showMode #app,body.showMode #empty,body.showMode #toast{display:none!important}
#show{position:fixed;inset:0;z-index:60;background:var(--cream,#F6F5F0);overflow:auto;padding:24px clamp(16px,4vw,56px) 60px;color:var(--navy)}
#show .shTop{display:grid;grid-template-columns:1fr auto;align-items:start;gap:8px 16px;position:sticky;top:-24px;z-index:3;background:var(--cream,#F6F5F0);padding:12px 0 10px;max-width:1100px;margin:0 auto;box-shadow:0 12px 12px -12px rgba(22,33,58,.18)}#show .shTop .shGrade{grid-column:1 / -1}.shWho{font-size:clamp(30px,4vw,46px);font-weight:var(--w-black);line-height:1.05}.shSub{color:var(--ink-soft);font-size:var(--t-s);margin-top:4px}
.shTools{display:flex;gap:8px;align-items:center}#shExit{position:relative;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}#shExit .ring{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--sand);opacity:.6}#shExit.holding .ring{width:100%;transition:width 1.5s linear}
.shBody{max-width:1100px;margin:18px auto 0;display:flex;flex-direction:column;gap:18px}
.shGrade{display:flex;align-items:center;gap:clamp(12px,3vw,36px);flex-wrap:wrap;background:var(--white);border-radius:var(--r);box-shadow:var(--shadow-1);padding:10px 22px}.shNow,.shIf{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.shNow small,.shIf small{flex-basis:100%}
.shGrade small{display:block;font-size:var(--t-xs);letter-spacing:.1em;text-transform:uppercase;color:var(--teal);font-weight:var(--w-black)}.shGrade b{font-size:clamp(36px,5vw,52px);font-weight:var(--w-black);line-height:1;min-width:2.2ch;text-align:right}.shGrade b span{font-size:.45em}.shGrade em.lt{font-size:clamp(18px,2.2vw,24px);font-weight:var(--w-black);margin-left:0}
.shArrow{font-size:clamp(28px,3.6vw,40px);color:var(--teal);font-weight:var(--w-black)}.shIf>b{color:var(--teal)}.shDelta{font-size:var(--t-l);color:var(--ink-soft);white-space:nowrap}.shGrade .shDelta b{font-size:inherit;line-height:inherit}.shDelta.up{color:var(--teal)}.shDelta.down{color:var(--bad)}
.shCats{display:flex;flex-direction:column;gap:8px;background:var(--white);border-radius:var(--r);box-shadow:var(--shadow-1);padding:14px 22px}.shCat{display:grid;grid-template-columns:200px 1fr 60px;gap:12px;align-items:center;font-size:16px}.shCat small{color:var(--ink-soft)}
.shBar{position:relative;height:16px;border-radius:var(--r-pill);background:var(--grid);overflow:hidden}.shBar i{position:absolute;top:0;bottom:0}.shBar i.if{left:0;background:var(--teal);border-radius:var(--r-pill);box-shadow:inset 0 0 0 1px rgba(22,33,58,.2)}.shBar i.now{width:4px;background:var(--navy);border-radius:var(--r-xs);z-index:1}
.shTry{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:16px}.shTry section{background:var(--white);border-radius:var(--r);box-shadow:var(--shadow-1);padding:14px 20px}.shTry h3{margin:0 0 8px;font-size:var(--t-xs);letter-spacing:.1em;text-transform:uppercase;color:var(--teal)}
.shRow{display:grid;grid-template-columns:1fr auto;gap:6px 14px;align-items:center;padding:10px 0;border-bottom:1px solid var(--grid)}.shRow:last-child{border-bottom:none}.shL b{display:block;font-size:16px}.shL small{color:var(--ink-soft)}.shL input{width:64px;font:inherit}
.shS{grid-column:1/-1;display:flex;gap:12px;align-items:center}.shS.off{display:none}.shS input{flex:1;min-height:var(--h-m);accent-color:var(--teal)}.shS output{font-weight:var(--w-black);min-width:78px;text-align:right}
.shSw{display:flex;gap:8px;align-items:center;font-weight:var(--w-bold);cursor:pointer;min-height:var(--h-touch)}.shSw input{width:24px;height:24px;accent-color:var(--teal)}.shHint{color:var(--ink-soft);font-size:var(--t-s);margin:4px 0}.shHint.rtLine{font-weight:var(--w-bold);color:var(--navy)}.shHint.rtLine.ok{color:var(--teal)}.shKey{text-align:right}.shKey i{display:inline-block;width:4px;height:14px;background:var(--navy);border-radius:var(--r-xs);vertical-align:-2px;margin-right:6px}
@media (max-width:700px){.shTry{grid-template-columns:1fr}.shCat{grid-template-columns:120px 1fr 50px}.catline .catbar{grid-template-columns:110px 1fr 48px}.catline .catbar small:last-child{display:none}}
@media print{#show{display:none}}
`;
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: STU_CSS }));
