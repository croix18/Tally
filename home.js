/* ---------- home.js — the Overview: one card per class, what needs attention, and the teacher charts ----------
   Spliced into app.js's closure. view.mode === 'home' renders here instead of the grid. */
function gradeSummary(sec0) {
  if (!sec0.grades) return null;
  // Only the open quarter counts here: a closed quarter's missing work and grades don't raise anything.
  const sec = openSec(sec0);
  const lastQ = [4, 3, 2, 1].find(n => qClosed(n) && sec0.qArchive && sec0.qArchive[n]); const qFinal = lastQ ? { q: lastQ, avg: mean(sec0.qArchive[lastQ].final) } : null;
  if (!sec.grades.assignments.length) return { waiting: true, q: currentQuarter(), qFinal, avg: null, prevAvg: null, prevDate: null, letters: { A: 0, B: 0, C: 0, D: 0, F: 0 }, missing: 0, missingStudents: 0, sliding: 0, fit: null, date: sec0.grades.importedAt.slice(0, 10) };
  const gs = gradeAll(sec); const prev = prevGradeSnap(sec); const letters = { A: 0, B: 0, C: 0, D: 0, F: 0 }; gs.forEach(r => { if (r && r.letter) letters[r.letter]++; });
  const avg = classAverage(sec); const pv = prev ? prev.grade.filter(v => v != null) : []; const prevAvg = pv.length ? pv.reduce((a, b) => a + b, 0) / pv.length : null;
  const prevIdx = prev ? new Map(prev.students.map((n, i) => [n, i])) : null; let sliding = 0, missingStudents = 0;
  sec.grades.students.forEach((name, i) => { const r = gs[i]; const miss = sec.grades.assignments.filter(a => a.status && a.status[i] === 'missing').length; if (miss) missingStudents++;
    if (prevIdx && prevIdx.has(name)) { const j = prevIdx.get(name); const d = r && r.rounded != null && prev.grade[j] != null ? r.rounded - prev.grade[j] : null; if ((d != null && d <= -3) || miss > (prev.missing[j] || 0)) sliding++; } });
  return { avg, prevAvg, prevDate: prev ? prev.date : null, letters, missing: sec.grades.assignments.reduce((a, x) => a + x.missing, 0), missingStudents, sliding, fit: sec === sec0 ? fitCategories(sec) : null, date: sec.grades.importedAt.slice(0, 10), qFinal };
}
// Everything a class could need a look at, one line each, in priority order.
function attentionItems(sec) {
  if (attCache.has(sec.key)) return attCache.get(sec.key);
  const out = []; attCache.set(sec.key, out); const rows = buildRows(sec); const rs = rosterState(sec);
  if (sec.pool && sec.awaitingPool) out.push({ level: 'warn', text: `waiting for the ${sec.prep === 'acc' ? 'accelerated' : 'on-level'} IXL export`, go: 'import', shared: true });
  if (sec.placeholder) out.push({ level: 'warn', text: 'IXL export has no student names', go: 'grid' });
  else if (sec.allBlank) out.push({ level: 'warn', text: 'the IXL export has no scores in it', go: 'grid' });
  if (!rs.hasText && !rs.count && !sec.skipRoster && !(sec.pool && sec.awaitingPool)) out.push({ level: 'warn', text: 'no roster yet', go: 'grid' });
  const ro = rows.filter(r => r.status === 'rosterOnly').length, am = rows.filter(r => r.status === 'ambiguous').length, io = rows.filter(r => r.status === 'ixlOnly').length;
  if ((ro || am || io) && !(sec.pool && sec.awaitingPool)) out.push({ level: 'warn', text: [ro ? `${ro} on the roster not in IXL` : '', am ? `${am} with two IXL matches` : '', io ? `${io} in IXL not on the roster` : ''].filter(Boolean).join(' · '), go: 'grid' });
  if (rs.hasText && !rs.count) out.push({ level: 'warn', text: 'the pasted roster couldn\'t be read', go: 'settings' });
  if (sec.grades) { const checks = reconcile(sec); const off = checks.filter(c => c.counts.differ + c.counts.missing > 0 || !c.maxOK); if (off.length) out.push({ level: 'warn', text: 'Focus doesn\'t match Tally — ' + off.map(c => `${c.unit.short}: ${!c.maxOK ? 'points differ' : plural(c.counts.differ + c.counts.missing, 'student')}`).join(', '), go: 'grid', shared: off.every(c => !c.maxOK) });
    const stale = off.length ? [] : checks.filter(c => c.counts.stale > 0); if (stale.length) out.push({ level: 'info', text: 'moved up since you copied — ' + stale.map(c => `${c.unit.short}: ${plural(c.counts.stale, 'student')}`).join(' · ') + ' — copy again', go: 'grid' });
    const fit = hasOpenGrades(sec) && openSec(sec) === sec ? fitCategories(sec) : null; if (fit && !fit.exact) out.push({ level: 'warn', text: `grades don't all match Focus (off by ${fit.err} across ${fit.n}) — check categories`, go: 'grades' }); if (!sec.grades.overall && hasOpenGrades(sec)) out.push({ level: 'info', text: 'gradebook has no Grade column — categories are guesses', go: 'grades' }); }
  // No "Working in" unit and nothing in Focus to read it from: until one is picked, which units count is a guess.
  if (!sec.placeholder && sec.students.length && !(state.settings.currentUnit || {})[sec.prep]) out.push({ level: 'info', text: 'pick the unit you\'re working in — until then Tally guesses which units count', go: 'grid', shared: true });
  const rvg = rosterVsGradebook(sec); if (rvg) out.push({ level: 'info', text: `gradebook list differs from the roster (${rvg.added.length} new, ${rvg.gone.length} gone)`, go: 'grid' });
  const od = overdue(sec); if (od) out.push({ level: 'info', text: `IXL export is ${plural(od, 'day')} old`, go: 'import', shared: true });
  if (sec.grades && state.settings.remindDays && ageDays(sec.grades.importedAt) > state.settings.remindDays) out.push({ level: 'info', text: `Focus gradebook is ${plural(ageDays(sec.grades.importedAt), 'day')} old`, go: 'import', shared: true });
  if (!sec.grades && !sec.awaitingPool) out.push({ level: 'info', text: 'no Focus gradebook yet', go: 'import', shared: true });
  return out;
}
// One line per cause: the same line from several classes is said once ("Every class", "Accelerated", or the periods), warnings first.
function attentionGroups(secs) {
  const groups = []; secs.forEach(s => attentionItems(s).forEach(a => { const k = a.level + '|' + a.go + '|' + a.text; let g = groups.find(x => x.k === k); if (!g) groups.push(g = { k, level: a.level, go: a.go, text: a.text, shared: !!a.shared, secs: [] }); g.secs.push(s); }));
  const short = s => String(s.label).split(' · ')[0];
  groups.forEach(g => { const n = g.secs.length; const prep = ['acc', 'on'].find(p => { const all = secs.filter(s => s.prep === p); return all.length > 1 && all.length === n && g.secs.every(s => s.prep === p); });
    g.who = n === 1 ? g.secs[0].label : n === secs.length ? 'Every class' : prep ? (prep === 'acc' ? 'Accelerated' : 'On-level') : g.secs.map(short).join(', ');
    g.each = !g.shared && n > 1 ? g.secs.map(s => ({ key: s.key, label: short(s), color: classColor(s) })) : null; });   // a class's own problem (its roster) keeps a way into each class
  return [...groups.filter(g => g.level === 'warn'), ...groups.filter(g => g.level !== 'warn')];
}
function renderHome() {
  const qd = quarterDue(); const cq = currentQuarter();
  const secs = state.order.map(k => state.sections[k]); const race = leaderboardData(); const byKey = new Map(race.map(r => [r.key, r]));
  const H = state.settings.hideNames;
  const card = s => { const r = byKey.get(s.key); const g = gradeSummary(s); const att = attentionItems(s); const warn = att.filter(a => a.level === 'warn').length;
    const checks = s.grades ? reconcile(s) : []; const off = checks.filter(c => c.counts.differ + c.counts.missing > 0 || !c.maxOK).length; const staleN = off ? 0 : checks.reduce((n, c) => n + (c.counts.stale || 0), 0);
    const ixlCols = s.grades ? s.grades.assignments.filter(a => gbUnitFor(s, a)) : [];
    const waiting = !!(g && g.waiting);   // the quarter was closed and the new one has no gradebook yet: say that, not zeros
    const focusChip = waiting ? '' : !s.grades ? '<span class="hchip muted">no gradebook</span>' : !checks.length ? (ixlCols.length ? `<span class="hchip muted" title="Focus has an IXL column for a unit Tally isn't counting (a review unit, or past Working in)">Focus IXL ${esc(ixlCols.map(a => gbUnitFor(s, a).short).join(', '))} not counted</span>` : '<span class="hchip muted">no IXL columns in Focus</span>') : off ? `<span class="hchip warn">Focus: ${off} unit${off === 1 ? '' : 's'} off</span>` : staleN ? `<span class="hchip stale">Focus: ${staleN} up since copy</span>` : '<span class="hchip ok">Focus ✓</span>';
    return `<article class="hcardW" style="--cc:${classColor(s)}"><button class="hcard ${warn ? 'warn' : ''}" data-go="${esc(s.key)}" aria-label="Open ${esc(s.label)}">
      <div class="hhead"><b>${esc(s.label)}</b><small>${plural(s.students.length, 'student')} · goal ${s.threshold}${s.date ? ' · IXL ' + esc(fmtDate(s.date)) : ''}</small></div>
      <div class="hnums">
        <div><small>IXL work at goal</small><b>${r ? Math.round(r.completion * 100) + '%' : '—'}</b><span>${r && r.gain != null ? `${r.gain >= 0 ? '+' : '−'}${Math.abs(r.gain).toFixed(1)} skills/student since ${esc(fmtDate(r.prevDate))}` : r && r.thrChanged ? 'goal changed' : r && r.basisChanged ? 'skills counted changed' : 'first import'}</span></div>
        ${waiting ? `<div><small>Focus${g.qFinal && g.qFinal.avg != null ? ` · Q${g.qFinal.q} final` : ''}</small><b>${g.qFinal && g.qFinal.avg != null ? Math.round(g.qFinal.avg) + '%' : '—'}</b><span>Q${g.q} gradebook not in yet</span></div>` : `
        <div><small>Focus average${anyClosed() ? ' · Q' + currentQuarter() : ''}</small><b>${g && g.avg != null ? Math.round(g.avg) + '%' : '—'}</b><span>${g && g.prevAvg != null ? `${Math.round(g.avg) - Math.round(g.prevAvg) >= 0 ? '+' : '−'}${Math.abs(Math.round(g.avg) - Math.round(g.prevAvg))} since ${esc(fmtDate(g.prevDate))}` : g ? (g.qFinal && g.qFinal.avg != null ? `Q${g.qFinal.q} final ${Math.round(g.qFinal.avg)}%` : 'first gradebook') : ''}</span></div>
        <div><small>Missing work</small><b>${g ? g.missing : '—'}</b><span>${g ? plural(g.missingStudents, 'student') : ''}</span></div>
        <div><small>Sliding</small><b>${g && g.prevDate ? g.sliding : '—'}</b><span>${g && g.prevDate ? 'down 3+ or more missing' : 'needs 2 gradebooks'}</span></div>`}
      </div>
      <div class="hchips">${focusChip}${g && !waiting ? `<span class="hchip letters">${['A', 'B', 'C', 'D', 'F'].map(l => `<i class="${l}">${l}<em>${g.letters[l]}</em></i>`).join('')}</span>` : ''}${warn ? `<span class="hchip warn">${plural(warn, 'thing')} to look at</span>` : ''}</div>
    </button><button class="hchip act hdigest" data-digest="${esc(s.key)}">What changed ›</button></article>`; };
  const groups = attentionGroups(secs);
  const qdLine = qd ? `<li class="info"><button id="qdGo"><i></i><span><b>${esc(Q_NAMES[qd - 1])}</b> ended ${esc(fmtDate(quarters().ends[qd - 1]))} — close it so its missing work and Focus checks stop coming up</span><em>›</em></button></li>` : '';
  const lb = state.lastBackup; const bkLine = backupBehind() ? `<li class="info"><button id="hBackup" title="Download a backup file — keep it in your school Drive"><i></i><span><b>Back up</b> — ${lb ? `new imports since the last backup (${esc(ageDays(lb) === 0 ? 'earlier today' : fmtDate(lb.slice(0, 10)))})` : 'nothing has been backed up from this browser yet'}</span><em>Save backup</em></button></li>` : '';
  const attList = groups.length || qdLine || bkLine ? `<ul class="hatt">${qdLine}${groups.map(g => g.each ? `<li class="${g.level} each"><div><i></i><span>${esc(g.text.charAt(0).toUpperCase() + g.text.slice(1))}:</span>${g.each.map(c => `<button class="hgo" data-go="${esc(c.key)}" data-where="${g.go}" style="--cc:${c.color}">${esc(c.label)}</button>`).join('')}</div></li>`
    : `<li class="${g.level}"><button data-go="${esc(g.secs[0].key)}" data-where="${g.go}"><i></i><span><b>${esc(g.who)}</b> — ${esc(g.text)}</span><em>›</em></button></li>`).join('')}${bkLine}</ul>` : '';
  // charts
  const withHist = secs.filter(s => (s.gradeHistory || []).length); const dates = [...new Set(withHist.flatMap(s => s.gradeHistory.map(h => h.date)))].sort();
  const avgLines = dates.length >= 2 ? chartLines(dates.map(fmtDate), withHist.map(s => ({ name: s.label, color: classColor(s), values: dates.map(d => { const h = s.gradeHistory.filter(h => h.date === d).pop(); if (!h) return null; const v = h.grade.filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }) })), { pct: true, min: 40, max: 100, h: 260, w: 900, labelW: 200, aria: 'Focus class average by import' }) : `<p class="ghint">Class averages over time appear after a second gradebook import${dates.length === 1 ? ' (one so far: ' + esc(fmtDate(dates[0])) + ')' : ''}.</p>`;
  const ixlBars = race.length ? chartBars(race.map(r => ({ label: r.label, value: r.completion * 100, color: classColor(state.sections[r.key]), hint: `${r.done} of ${r.possible} skill-points` })), { pct: true, max: 100, labelW: 180, aria: 'IXL assigned work at goal by class' }) : '';
  const missLines = dates.length >= 2 ? chartLines(dates.map(fmtDate), withHist.map(s => ({ name: s.label, color: classColor(s), values: dates.map(d => { const h = s.gradeHistory.filter(h => h.date === d).pop(); return h ? h.missing.reduce((a, b) => a + b, 0) : null; }) })), { min: 0, h: 220, aria: 'missing assignments by import' }) : '';
  const lettersRows = secs.filter(s => s.grades).map(s => ({ s, g: gradeSummary(s) })).filter(x => !x.g.waiting).map(x => ({ label: x.s.label, parts: x.g.letters }));
  const lettersChart = lettersRows.length ? chartStacked(lettersRows, ['A', 'B', 'C', 'D', 'F'], { colors: LETTER_COLORS, dark: LETTER_DARK, labelW: 180, aria: 'letter grades by class' }) : '';
  const asOf = secs.map(s => s.date).filter(Boolean).sort().pop();
  const withGb = secs.filter(s => s.grades).length, waitN = anyClosed() ? secs.filter(s => s.grades && !hasOpenGrades(s)).length : 0;
  $('#bar').innerHTML = `<h2>Overview</h2><span class="meta">${secs.length} ${secs.length === 1 ? 'class' : 'classes'}${asOf ? ' · IXL as of ' + esc(fmtDate(asOf)) : ''} · ${esc(Q_NAMES[cq - 1])}${waitN ? (waitN === withGb ? ' · no gradebooks yet' : ` · ${waitN} of ${withGb} gradebooks still to come`) : ''}${lb && !bkLine ? ` · backed up ${esc(ageDays(lb) === 0 ? 'today' : fmtDate(lb.slice(0, 10)))}` : ''}</span><div class="spacer"></div><button class="pill ${qd ? '' : 'toggle'}" id="homeQuarters" title="Quarter dates; close a quarter so its work stops raising alerts">${qd ? `Close ${esc(Q_NAMES[qd - 1])}` : 'Quarters'}</button><div class="legend"><span>Tap a class to open it</span></div>`;
  $('#bar').classList.remove('detail');
  const li = state.lastImport; const liAge = li ? ageDays(li.at) : null;
  // Today's import is spelled out; an older one folds to a line (failures always show).
  const importLine = li && (li.lines.length || li.fails.length) ? `<details class="himport ${li.fails.length ? 'warn' : ''}" ${liAge === 0 || li.fails.length ? 'open' : ''}><summary><b>Last import</b> <small>${liAge === 0 ? 'today' : liAge === 1 ? 'yesterday' : esc(fmtDate(li.at.slice(0, 10)))}, ${esc(fmtTime(li.at))}${li.fails.length ? ` · ${li.fails.length} couldn't be read` : ''}</small><button class="linkbtn" id="liHide" title="Remove this until the next import">Dismiss</button></summary>
    <ul>${li.lines.map(l => `<li><b>${esc(l.label)}</b> — ${esc(l.text)}</li>`).join('')}${li.fails.map(f => `<li class="bad"><b>Couldn't read</b> — ${esc(f)}</li>`).join('')}${li.skipped ? `<li class="muted">${plural(li.skipped, 'file')} skipped</li>` : ''}</ul></details>` : '';
  $('#gridwrap').innerHTML = `<div class="home">
    ${importLine}
    ${attList ? `<section class="gsec hneeds"><h3>Needs attention</h3>${attList}</section>` : ''}
    <div class="hcards">${secs.map(card).join('')}</div>
    <div class="gtwo">
      <section class="gsec"><h3>IXL work at goal by class</h3>${ixlBars || '<p class="ghint">Import an IXL export.</p>'}</section>
      <section class="gsec"><h3>Letter grades by class</h3>${lettersChart || `<p class="ghint">${waitN ? `Appears with the first ${esc(Q_NAMES[cq - 1])} gradebook.` : 'Import a Focus gradebook.'}</p>`}</section>
    </div>
    <section class="gsec"><h3>Focus class average by import</h3>${avgLines}</section>
    <section class="gsec"><h3>Missing assignments by import</h3>${missLines || '<p class="ghint">Appears after a second gradebook import.</p>'}</section>
  </div>`;
  const hb = $('#hBackup'); if (hb) hb.onclick = () => { saveBackup(); render(); };
  const lh = $('#liHide'); if (lh) lh.onclick = e => { e.preventDefault(); state.lastImport = null; save(); render(); };
  const hq = $('#homeQuarters'); if (hq) hq.onclick = openQuarters; const qg = $('#qdGo'); if (qg) qg.onclick = openQuarters;
  $('#gridwrap').querySelectorAll('[data-digest]').forEach(b => b.onclick = e => { e.stopPropagation(); openDigest(state.sections[b.dataset.digest]); });
  $('#gridwrap').querySelectorAll('[data-go]').forEach(b => b.onclick = e => { e.stopPropagation(); const where = b.dataset.where || 'grid'; state.active = b.dataset.go;
    if (where === 'import') { $('#file').click(); return; }
    view = where === 'grades' && state.sections[state.active].grades ? { mode: 'grades', unit: null } : { mode: 'units', unit: null }; save(); render(); if (where === 'settings') openSettings(); });
}

/* ---------- What changed — the weekly digest for one class ----------
   Reads the two histories a class already keeps: IXL snapshots (per-student skills at goal by import date) and
   gradebook snapshots (per-student grade and missing count by import date). Teacher-only; names honour the Names toggle. */
function digestFor(sec) {
  const H = state.settings.hideNames; const nm = d => H ? mask(d) : d; const disp = n => nm(ixlDisplay(n));
  const out = { sec, ixl: null, focus: null };
  const hist = sec.history || []; const cur = hist[hist.length - 1]; const prev = hist.filter(h => h.date < (cur ? cur.date : '')).pop();
  const mv = movement(sec, cur, prev, true);   // open units only: a closed quarter's IXL doesn't make the digest
  if (mv && !mv.reason) {
    const keys = Object.keys(cur.per); const deltas = keys.map(k => ({ key: k, name: k.replace(/#\d+$/, ''), d: mv.deltas[k] ? mv.deltas[k].d : 0, now: mv.deltas[k] ? mv.deltas[k].now : cur.per[k], had: !!mv.deltas[k] }));
    const measured = deltas.filter(x => x.had); const up = measured.filter(x => x.d > 0), down = measured.filter(x => x.d < 0);
    const total = measured.reduce((a, x) => a + x.d, 0);
    const newNames = keys.filter(k => prev.per[k] == null).map(k => k.replace(/#\d+$/, '')), gone = Object.keys(prev.per).filter(k => cur.per[k] == null).map(k => k.replace(/#\d+$/, ''));
    // units that became complete for everyone counted (no student below the unit's total) between the two dates can't be read from snapshots; use the grid now
    const units = unitsOf(sec).filter(u => u.assigned && u.total && !unitClosed(sec, u)); const pop = population(sec);
    const unitDone = units.map(u => ({ u, done: pop.filter(x => points(sec, u, x.i) >= totalFor(sec, u, x.i)).length })).filter(x => x.done === pop.length && pop.length).map(x => x.u.short);
    out.ixl = { from: prev.date, to: cur.date, total, perStudent: measured.length ? total / measured.length : 0, up: up.length, measured: measured.length, movers: up.sort((a, b) => b.d - a.d).slice(0, 5).map(x => ({ name: disp(x.name), d: x.d, now: x.now })),
      down: down.sort((a, b) => a.d - b.d).slice(0, 5).map(x => ({ name: disp(x.name), d: x.d })), stuck: measured.filter(x => x.d === 0 && x.now === 0).length, newNames: newNames.map(disp), gone: gone.map(disp), unitDone };
  } else if (mv) out.ixl = { thrChanged: mv.reason === 'thr', basisChanged: mv.reason === 'basis', from: prev.date, to: cur.date };
  const gh = sec.gradeHistory || []; const gc0 = gh[gh.length - 1]; const gc = gc0 && !qClosed(snapQ(gc0)) ? gc0 : null;   // a closed quarter has nothing to report
  const gp = gc ? gh.filter(h => h.date < gc.date && snapQ(h) === snapQ(gc)).pop() : null;   // a new quarter starts fresh: nothing "slid" across the break
  if (gc && gp) {
    const idxP = new Map(gp.students.map((n, i) => [n, i])); const rows = gc.students.map((n, i) => { const j = idxP.get(n); return { name: n, g: gc.grade[i], m: gc.missing[i], pg: j == null ? null : gp.grade[j], pm: j == null ? null : gp.missing[j] }; });
    const both = rows.filter(r => r.pg != null && r.g != null); const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    const slid = both.filter(r => r.g - r.pg <= -3).sort((a, b) => (a.g - a.pg) - (b.g - b.pg)); const rose = both.filter(r => r.g - r.pg >= 3).sort((a, b) => (b.g - b.pg) - (a.g - a.pg));
    const letterDown = both.filter(r => letterOf(r.g) !== letterOf(r.pg) && r.g < r.pg), letterUp = both.filter(r => letterOf(r.g) !== letterOf(r.pg) && r.g > r.pg);
    const newMissing = rows.filter(r => r.pm != null && r.m > r.pm), cleared = rows.filter(r => r.pm != null && r.m < r.pm);
    const prevA = new Set(gp.assignments.map(a => a.name)); const newAsg = gc.assignments.filter(a => !prevA.has(a.name));
    out.focus = { from: gp.date, to: gc.date, avg: avg(gc.grade.filter(v => v != null)), prevAvg: avg(gp.grade.filter(v => v != null)), slid: slid.slice(0, 6).map(r => ({ name: nm(r.name), d: r.g - r.pg, g: r.g })), rose: rose.slice(0, 6).map(r => ({ name: nm(r.name), d: r.g - r.pg, g: r.g })),
      letterDown: letterDown.map(r => ({ name: nm(r.name), from: letterOf(r.pg), to: letterOf(r.g) })), letterUp: letterUp.map(r => ({ name: nm(r.name), from: letterOf(r.pg), to: letterOf(r.g) })),
      newMissing: newMissing.map(r => ({ name: nm(r.name), n: r.m - r.pm })), cleared: cleared.map(r => ({ name: nm(r.name), n: r.pm - r.m })), missingNow: gc.missing.reduce((a, b) => a + b, 0), missingThen: gp.missing.reduce((a, b) => a + b, 0),
      newAsg: newAsg.map(a => ({ name: a.name, avg: a.avg, missing: a.missing, max: a.max })) };
  }
  return out;
}
function digestMarkup(d) {
  const sec = d.sec; const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(Math.round(v * 10) / 10);
  const names = (arr, f) => arr.length ? arr.map(f).join(' · ') : '';   // names carry their own commas (LAST, FIRST), so items are separated by a dot
  let ixl = '';
  if (!d.ixl) ixl = `<p class="ghint">IXL: needs two imports on different days.</p>`;
  else if (d.ixl.thrChanged) ixl = `<p class="ghint">IXL: the goal changed between ${esc(fmtDate(d.ixl.from))} and ${esc(fmtDate(d.ixl.to))}, so movement isn't comparable this week.</p>`;
  else if (d.ixl.basisChanged) ixl = `<p class="ghint">IXL: the skills counted changed between ${esc(fmtDate(d.ixl.from))} and ${esc(fmtDate(d.ixl.to))}, so movement isn't comparable this week.</p>`;
  else { const x = d.ixl; ixl = `<div class="dgrid">
      <div class="dstat"><b>${sgn(x.total)}</b><small>skills at goal since ${esc(fmtDate(x.from))}</small></div>
      <div class="dstat"><b>${x.measured ? Math.round(x.up / x.measured * 100) : 0}%</b><small>of the class moved up (${x.up} of ${x.measured})</small></div>
      <div class="dstat"><b>${sgn(x.perStudent)}</b><small>skills per student</small></div>
      <div class="dstat"><b>${x.stuck}</b><small>still at zero</small></div></div>
    ${x.movers.length ? `<p><b>Biggest movers:</b> ${names(x.movers, m => `${esc(m.name)} <span class="dup">+${m.d}</span>`)}</p>` : ''}
    ${x.down.length ? `<p><b>Dropped</b> (SmartScores fell below goal): ${names(x.down, m => `${esc(m.name)} <span class="ddown">${m.d}</span>`)}</p>` : ''}
    ${x.unitDone.length ? `<p><b>Units everyone has finished:</b> ${esc(x.unitDone.join(', '))}</p>` : ''}
    ${x.newNames.length ? `<p><b>New in IXL:</b> ${esc(x.newNames.join(' · '))}</p>` : ''}${x.gone.length ? `<p><b>No longer in IXL:</b> ${esc(x.gone.join(' · '))}</p>` : ''}`; }
  let focus = '';
  if (!d.focus) focus = `<p class="ghint">Focus: needs two gradebook imports on different days.</p>`;
  else { const f = d.focus; focus = `<div class="dgrid">
      <div class="dstat"><b>${f.avg != null ? Math.round(f.avg) + '%' : '—'}</b><small>class average${f.prevAvg != null ? ` (${sgn(Math.round(f.avg) - Math.round(f.prevAvg))} since ${esc(fmtDate(f.from))})` : ''}</small></div>
      <div class="dstat"><b>${f.missingNow}</b><small>missing assignments (${sgn(f.missingNow - f.missingThen)})</small></div>
      <div class="dstat"><b>${f.slid.length}</b><small>slid 3+ points</small></div>
      <div class="dstat"><b>${f.rose.length}</b><small>rose 3+ points</small></div></div>
    ${f.slid.length ? `<p><b>Sliding:</b> ${names(f.slid, r => `${esc(r.name)} <span class="ddown">${r.d}</span> → ${r.g}`)}</p>` : ''}
    ${f.letterDown.length ? `<p><b>Dropped a letter:</b> ${names(f.letterDown, r => `${esc(r.name)} ${r.from}→${r.to}`)}</p>` : ''}
    ${f.rose.length ? `<p><b>Climbing:</b> ${names(f.rose, r => `${esc(r.name)} <span class="dup">+${r.d}</span> → ${r.g}`)}</p>` : ''}
    ${f.letterUp.length ? `<p><b>Up a letter:</b> ${names(f.letterUp, r => `${esc(r.name)} ${r.from}→${r.to}`)}</p>` : ''}
    ${f.newMissing.length ? `<p><b>Newly missing work:</b> ${names(f.newMissing, r => `${esc(r.name)} (+${r.n})`)}</p>` : ''}
    ${f.cleared.length ? `<p><b>Turned work in:</b> ${names(f.cleared, r => `${esc(r.name)} (${r.n})`)}</p>` : ''}
    ${f.newAsg.length ? `<p><b>New assignments:</b> ${names(f.newAsg, a => `${esc(a.name)}${a.avg != null ? ` (avg ${Math.round(a.avg)}%${a.missing ? ', ' + a.missing + ' missing' : ''})` : ''}`)}</p>` : ''}`; }
  return `<section class="dsec"><h3>IXL</h3>${ixl}</section><section class="dsec"><h3>Focus</h3>${focus}</section>`;
}
function openDigest(sec) {
  const d = digestFor(sec); const m = $('#modal'); m.classList.remove('hidden'); m.classList.add('private'); $('#toast').classList.remove('show');
  const span = d.ixl && d.ixl.from ? `${fmtDate(d.ixl.from)} → ${fmtDate(d.ixl.to)}` : d.focus ? `${fmtDate(d.focus.from)} → ${fmtDate(d.focus.to)}` : 'first week';
  m.innerHTML = `<div class="panel"><header><h2>What changed · ${esc(sec.label)} <span class="hsub">${esc(span)}</span></h2><button id="mClose" aria-label="Close">×</button></header>
    <div class="body one digest">${digestMarkup(d)}<div class="rp-actions"><button class="pill" id="dgPrint">Print</button><button class="pill pale" id="mCancel">Close</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  $('#dgPrint').onclick = () => { const w = window.open('', '_blank'); if (!w) { toast('Pop-up blocked — allow pop-ups for this page to print.', true); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>What changed — ${esc(sec.label)}</title><style>${printFontCss()}</style><style>body{font-family:'DM Sans',Arial,Helvetica,sans-serif;margin:28px;color:#000;font-size:11pt}h1{font-size:16pt;margin:0 0 2px}h3{font-size:11pt;margin:16px 0 4px;border-bottom:1px solid #999}.dgrid{display:flex;gap:18px;flex-wrap:wrap;margin:6px 0}.dstat b{font-size:18pt;display:block}.dstat small{font-size:9pt;color:#444}p{margin:4px 0}.dup,.ddown{font-weight:bold}.ghint{color:#555}</style></head><body><h1>What changed · ${esc(sec.label)}</h1><div style="font-size:9.5pt;color:#333">${esc(span)} · printed ${new Date().toLocaleDateString()}</div>${digestMarkup(d)}</body></html>`); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 300); };
}
