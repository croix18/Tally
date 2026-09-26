/* ---------- home.js — the Overview: one card per class, what needs attention, and the teacher charts ----------
   Spliced into app.js's closure. view.mode === 'home' renders here instead of the grid. */
function gradeSummary(sec) {
  if (!sec.grades) return null;
  const gs = gradeAll(sec); const prev = prevGradeSnap(sec); const letters = { A: 0, B: 0, C: 0, D: 0, F: 0 }; gs.forEach(r => { if (r && r.letter) letters[r.letter]++; });
  const avg = classAverage(sec); const pv = prev ? prev.grade.filter(v => v != null) : []; const prevAvg = pv.length ? pv.reduce((a, b) => a + b, 0) / pv.length : null;
  const prevIdx = prev ? new Map(prev.students.map((n, i) => [n, i])) : null; let sliding = 0, missingStudents = 0;
  sec.grades.students.forEach((name, i) => { const r = gs[i]; const miss = sec.grades.assignments.filter(a => a.status && a.status[i] === 'missing').length; if (miss) missingStudents++;
    if (prevIdx && prevIdx.has(name)) { const j = prevIdx.get(name); const d = r && r.rounded != null && prev.grade[j] != null ? r.rounded - prev.grade[j] : null; if ((d != null && d <= -3) || miss > (prev.missing[j] || 0)) sliding++; } });
  return { avg, prevAvg, prevDate: prev ? prev.date : null, letters, missing: sec.grades.assignments.reduce((a, x) => a + x.missing, 0), missingStudents, sliding, fit: fitCategories(sec), date: sec.grades.importedAt.slice(0, 10) };
}
// Everything a class could need a look at, one line each, in priority order.
function attentionItems(sec) {
  const out = []; const rows = buildRows(sec); const rs = rosterState(sec);
  if (sec.pool && sec.awaitingPool) out.push({ level: 'warn', text: `waiting for the ${sec.prep === 'acc' ? 'accelerated' : 'on-level'} IXL export`, go: 'grid' });
  if (sec.placeholder) out.push({ level: 'warn', text: 'IXL export has no student names', go: 'grid' });
  const ro = rows.filter(r => r.status === 'rosterOnly').length, am = rows.filter(r => r.status === 'ambiguous').length, io = rows.filter(r => r.status === 'ixlOnly').length;
  if (ro || am || io) out.push({ level: 'warn', text: [ro ? `${ro} on the roster not in IXL` : '', am ? `${am} with two IXL matches` : '', io ? `${io} in IXL not on the roster` : ''].filter(Boolean).join(' · '), go: 'grid' });
  if (rs.hasText && !rs.count) out.push({ level: 'warn', text: 'the pasted roster couldn\'t be read', go: 'settings' });
  if (sec.grades) { const checks = reconcile(sec); const off = checks.filter(c => c.counts.differ + c.counts.missing > 0 || !c.maxOK); if (off.length) out.push({ level: 'warn', text: 'Focus doesn\'t match Tally — ' + off.map(c => `${c.unit.short}: ${!c.maxOK ? 'points differ' : plural(c.counts.differ + c.counts.missing, 'student')}`).join(', '), go: 'grid' });
    const fit = fitCategories(sec); if (fit && !fit.exact) out.push({ level: 'warn', text: `grades don't all match Focus (off by ${fit.err} across ${fit.n}) — check categories`, go: 'grades' }); if (!sec.grades.overall) out.push({ level: 'info', text: 'gradebook has no Grade column — categories are guesses', go: 'grades' }); }
  const rvg = rosterVsGradebook(sec); if (rvg) out.push({ level: 'info', text: `gradebook list differs from the roster (${rvg.added.length} new, ${rvg.gone.length} gone)`, go: 'grid' });
  const od = overdue(sec); if (od) out.push({ level: 'info', text: `IXL export is ${plural(od, 'day')} old`, go: 'import' });
  if (sec.grades && state.settings.remindDays && ageDays(sec.grades.importedAt) > state.settings.remindDays) out.push({ level: 'info', text: `Focus gradebook is ${plural(ageDays(sec.grades.importedAt), 'day')} old`, go: 'import' });
  if (!sec.grades && !sec.awaitingPool) out.push({ level: 'info', text: 'no Focus gradebook yet', go: 'import' });
  return out;
}
function renderHome() {
  const secs = state.order.map(k => state.sections[k]); const race = leaderboardData(); const byKey = new Map(race.map(r => [r.key, r]));
  const H = state.settings.hideNames;
  const card = s => { const r = byKey.get(s.key); const g = gradeSummary(s); const att = attentionItems(s); const warn = att.filter(a => a.level === 'warn').length;
    const checks = s.grades ? reconcile(s) : []; const off = checks.filter(c => c.counts.differ + c.counts.missing > 0 || !c.maxOK).length;
    const focusChip = !s.grades ? '<span class="hchip muted">no gradebook</span>' : !checks.length ? '<span class="hchip muted">no IXL columns in Focus</span>' : off ? `<span class="hchip warn">Focus: ${off} unit${off === 1 ? '' : 's'} off</span>` : '<span class="hchip ok">Focus ✓</span>';
    return `<button class="hcard ${warn ? 'warn' : ''}" data-go="${esc(s.key)}" style="--cc:${classColor(s)}">
      <div class="hhead"><b>${esc(s.label)}</b><small>${plural(s.students.length, 'student')} · goal ${s.threshold}${s.date ? ' · IXL ' + esc(fmtDate(s.date)) : ''}</small></div>
      <div class="hnums">
        <div><small>IXL work at goal</small><b>${r ? Math.round(r.completion * 100) + '%' : '—'}</b><span>${r && r.gain != null ? `${r.gain >= 0 ? '+' : '−'}${Math.abs(r.gain).toFixed(1)} skills/student since ${esc(fmtDate(r.prevDate))}` : r && r.thrChanged ? 'goal changed' : 'first import'}</span></div>
        <div><small>Focus average</small><b>${g && g.avg != null ? Math.round(g.avg) + '%' : '—'}</b><span>${g && g.prevAvg != null ? `${Math.round(g.avg) - Math.round(g.prevAvg) >= 0 ? '+' : '−'}${Math.abs(Math.round(g.avg) - Math.round(g.prevAvg))} since ${esc(fmtDate(g.prevDate))}` : g ? 'first gradebook' : ''}</span></div>
        <div><small>Missing work</small><b>${g ? g.missing : '—'}</b><span>${g ? plural(g.missingStudents, 'student') : ''}</span></div>
        <div><small>Sliding</small><b>${g && g.prevDate ? g.sliding : '—'}</b><span>${g && g.prevDate ? 'down 3+ or more missing' : 'needs 2 gradebooks'}</span></div>
      </div>
      <div class="hchips">${focusChip}${g ? `<span class="hchip letters">${['A', 'B', 'C', 'D', 'F'].map(l => `<i class="${l}">${l}<em>${g.letters[l]}</em></i>`).join('')}</span>` : ''}${warn ? `<span class="hchip warn">${plural(warn, 'thing')} to look at</span>` : ''}</div>
    </button>`; };
  const att = secs.flatMap(s => attentionItems(s).map(a => ({ ...a, sec: s })));
  const attList = att.length ? `<ul class="hatt">${att.map(a => `<li class="${a.level}"><button data-go="${esc(a.sec.key)}" data-where="${a.go}"><b>${esc(a.sec.label)}</b> — ${esc(a.text)}</button></li>`).join('')}</ul>` : '<p class="ghint">Nothing needs attention.</p>';
  // charts
  const withHist = secs.filter(s => (s.gradeHistory || []).length); const dates = [...new Set(withHist.flatMap(s => s.gradeHistory.map(h => h.date)))].sort();
  const avgLines = dates.length >= 2 ? chartLines(dates.map(fmtDate), withHist.map(s => ({ name: s.label, color: classColor(s), values: dates.map(d => { const h = s.gradeHistory.find(h => h.date === d); if (!h) return null; const v = h.grade.filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }) })), { pct: true, min: 40, max: 100, h: 260, aria: 'Focus class average by import' }) : `<p class="ghint">Class averages over time appear after a second gradebook import${dates.length === 1 ? ' (one so far: ' + esc(fmtDate(dates[0])) + ')' : ''}.</p>`;
  const ixlBars = race.length ? chartBars(race.map(r => ({ label: r.label, value: r.completion * 100, color: classColor(state.sections[r.key]), hint: `${r.done} of ${r.possible} skill-points` })), { pct: true, max: 100, labelW: 180, aria: 'IXL assigned work at goal by class' }) : '';
  const missLines = dates.length >= 2 ? chartLines(dates.map(fmtDate), withHist.map(s => ({ name: s.label, color: classColor(s), values: dates.map(d => { const h = s.gradeHistory.find(h => h.date === d); return h ? h.missing.reduce((a, b) => a + b, 0) : null; }) })), { min: 0, h: 220, aria: 'missing assignments by import' }) : '';
  const lettersRows = secs.filter(s => s.grades).map(s => { const g = gradeSummary(s); return { label: s.label, parts: g.letters }; });
  const lettersChart = lettersRows.length ? chartStacked(lettersRows, ['A', 'B', 'C', 'D', 'F'], { colors: LETTER_COLORS, labelW: 180, aria: 'letter grades by class' }) : '';
  const asOf = secs.map(s => s.date).filter(Boolean).sort().pop();
  $('#bar').innerHTML = `<h2>Overview</h2><span class="meta">${secs.length} ${secs.length === 1 ? 'class' : 'classes'}${asOf ? ' · IXL as of ' + esc(fmtDate(asOf)) : ''}</span><div class="spacer"></div><div class="legend"><span>Tap a class to open it</span></div>`;
  $('#bar').classList.remove('detail');
  $('#gridwrap').innerHTML = `<div class="home">
    <div class="hcards">${secs.map(card).join('')}</div>
    <div class="gtwo">
      <section class="gsec"><h3>Needs attention</h3>${attList}</section>
      <section class="gsec"><h3>IXL work at goal by class</h3>${ixlBars || '<p class="ghint">Import an IXL export.</p>'}</section>
    </div>
    <section class="gsec"><h3>Focus class average by import</h3>${avgLines}</section>
    <div class="gtwo">
      <section class="gsec"><h3>Letter grades by class</h3>${lettersChart || '<p class="ghint">Import a Focus gradebook.</p>'}</section>
      <section class="gsec"><h3>Missing assignments by import</h3>${missLines || '<p class="ghint">Appears after a second gradebook import.</p>'}</section>
    </div>
  </div>`;
  $('#gridwrap').querySelectorAll('[data-go]').forEach(b => b.onclick = e => { e.stopPropagation(); const where = b.dataset.where || 'grid'; state.active = b.dataset.go;
    if (where === 'import') { $('#file').click(); return; }
    view = where === 'grades' && state.sections[state.active].grades ? { mode: 'grades', unit: null } : { mode: 'units', unit: null }; save(); render(); if (where === 'settings') openSettings(); });
}
