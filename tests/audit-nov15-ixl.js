// Audit of 15 Nov 2026, fixer IXL: the grid, copy to Focus, receipts and the Focus check. Each check failed before its fix.
const { chromium, fs, path, exe, check, done, pick, tmp, APP } = require('./lib');
const K = '1205050-7T1A';   // the scrubbed real class in fixtures/
const fresh = async b => { const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true, timezoneId: 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept()); await p.goto('file://' + path.resolve(APP)); return { p, errs, ctx }; };
// The scrubbed class: IXL Score Grid, the Focus roster, then the Quarter 1 Focus gradebook (gb: another gradebook file to use).
const realClass = async (p, gb = 'fixtures/focus_gradebook_scrubbed.csv', roster = fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')) => {
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', roster); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve(gb)]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600); };
(async () => {
  const b = await chromium.launch({ executablePath: exe });

  // ---- IXL-01: "ID + points" carries the gradebook's Student IDs ----
  { const { p, ctx } = await fresh(b); await realClass(p);
    const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const u = T.unitsOf(s).find(x => x.short === 'Unit 2');
      const gb = s.grades; const lines = A.unitColumn(s, u, 'ids'); const ids = (gb.ids || []).filter(Boolean).length;
      return { ids, withId: lines.filter((l, i) => gb.ids && gb.ids[i] && l.startsWith(gb.ids[i] + '\t')).length, rowIds: A.copyRows(s).filter(r => r.id).length }; }, K);
    check(o.ids > 0 && o.withId === o.ids && o.rowIds === o.ids, `IXL-01: with a gradebook loaded, every "ID + points" line and copy row carries its Focus Student ID (${o.withId}/${o.rowIds} of ${o.ids})`);
    await ctx.close(); }

  // ---- IXL-03: a student whose points fell below what was copied (Focus too high) is "differ", not "up since copy" ----
  { const { p, ctx } = await fresh(b); await realClass(p);
    const o = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
      const u = T.unitsOf(s).find(x => x.short === 'Unit 2'); await A.copyUnit(s, u); const rc = s.receipts[u.name];
      const a = s.grades.assignments.find(x => A.gbUnitFor(s, x) && A.gbUnitFor(s, x).name === u.name);
      const rows = A.gbRows(s); rows.forEach((r, i) => { const x = rc.rows.find(y => y[0] === r.display); if (x && x[1] != null) { a.values[i] = x[1]; a.status[i] = 'score'; } });
      const r0 = rows.find(r => r.ixl != null && T.points(s, u, r.ixl) === u.total); const up = rows.find(r => r.ixl != null && r !== r0 && T.points(s, u, r.ixl) < u.total && T.points(s, u, r.ixl) > 0);
      s.studentSkips[A.ixlKeyAt(s, r0.ixl)] = { [A.skillKey(s.skills[u.active[0]])]: true };
      const i = rows.indexOf(up); const was = T.points(s, u, up.ixl) - 1; a.values[i] = was; rc.rows.find(y => y[0] === up.display)[1] = was;   /* a student who moved up since the copy stays "stale" */
      const chk = A.reconcile(s).find(x => x.unit.name === u.name);
      A.openFocusCheck(s, u.name); const txt = document.querySelector('#modal').innerText;
      return { drop: chk.rows.find(x => x.display === r0.display).status, rise: chk.rows.find(x => x.display === up.display).status, upNeg: /up [−-]\d+ since/.test(txt) }; }, K);
    check(o.drop === 'differ' && !o.upNeg, `IXL-03: Tally fell below the copied number in Focus: "differ", never "up -1 since" (${o.drop})`);
    check(o.rise === 'stale', `IXL-03: Tally rose above the copied number in Focus: still "up since you copied" (${o.rise})`);
    await ctx.close(); }

  // ---- IXL-06: a gradebook name the roster reader can't read keeps its own row; Copy says so before copying ----
  { const { p, ctx } = await fresh(b); await realClass(p); const asked = []; p.on('dialog', d => asked.push(d.message()));
    const before = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const u = T.unitsOf(s).find(x => x.short === 'Unit 2'); return { col: A.unitColumn(s, u, 'points'), names: s.grades.students.slice() }; }, K);
    const f2 = path.join(tmp, 'focus_gradebook_scrubbed.csv'); fs.writeFileSync(f2, fs.readFileSync('fixtures/focus_gradebook_scrubbed.csv', 'utf8').replace('EASTON, LOGAN KAI', 'ПЕТРОВ, ИВАН'));
    await p.setInputFiles('#file', [f2]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
    const o = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); });
      const u = T.unitsOf(s).find(x => x.short === 'Unit 2'); const col = A.unitColumn(s, u, 'points'); const rows = A.copyRows(s);
      await A.copyUnit(s, u); return { col, names: s.grades.students.slice(), rowNames: rows.map(r => r.display), copied: !!s.receipts[u.name] }; }, K);
    const i = o.names.findIndex(n => /ПЕТРОВ/.test(n));
    const off = o.names.filter((n, j) => j !== i && (o.rowNames[j] !== n || o.col[j] !== before.col[before.names.indexOf(n)])).length;
    check(i >= 0 && o.col.length === o.names.length && o.col[i] === '' && off === 0, `IXL-06: an unreadable gradebook name keeps a blank row of its own and no other row shifts (${off} rows off)`);
    check(asked.some(m => /can't read the name on row 4/.test(m)) && o.copied, `IXL-06: Copy says which gradebook row it can't read before copying ("${(asked[0] || '').slice(0, 60)}")`);
    await ctx.close(); }

  // ---- IXL-13: a skill skipped for one student between two imports is not read as that student dropping ----
  { const { p, ctx } = await fresh(b);
    const sk = (id, sc) => ({ id, sc }); const st = ['ALEX ABBOTT', 'BLAKE BRISCOE', 'CASEY CARVER', 'DREW DUNNE'];
    const grid = (date, skills) => { const q = v => '"' + v + '"'; const lines = [['Unit', '', 'Skill name', 'Permanent Skill ID', ...st].map(q).join(',')];
      skills.forEach(s => lines.push([q('Unit 1 Synthetic Unit'), q('Lesson 1.1 L'), q('Synthetic skill ' + s.id), s.id, ...s.sc.map(v => v == null ? '' : v)].join(',')));
      const d = fs.mkdtempSync(path.join(tmp, 'g')); const f = path.join(d, `IXL-Score-Grid_${date}_This-School-Year_1205050-7T5A-M_J-ACC_Math-Nation-FL-B.E.S.T.-Accelerated-7th-Grade_Math.csv`); fs.writeFileSync(f, lines.join('\n')); return f; };
    await p.setInputFiles('#file', [grid('2026-11-02', [sk('AA1', [90, 10, 70, null]), sk('AA2', [80, null, null, null]), sk('AA3', [null, null, null, null])])]); await p.waitForTimeout(700);
    await p.evaluate(() => { const T = window.__tally; const s = T.state.sections[T.state.order[0]]; s.skipRoster = true; T.state.settings.currentUnit = { acc: 1, on: null }; T.save(); T.render(); });
    await p.setInputFiles('#file', [grid('2026-11-09', [sk('AA1', [90, 10, 70, null]), sk('AA2', [80, 90, null, null]), sk('AA3', [null, null, null, null])])]); await p.waitForTimeout(700);   // Blake earns one
    await p.evaluate(() => { const T = window.__tally; T.state.view = undefined; }); await p.click('[data-u]'); await p.waitForTimeout(300);
    await p.click('[data-cell="1|0"]'); await p.waitForTimeout(300);   // AA2 skipped for Alex alone
    const read = () => p.evaluate(() => { const T = window.__tally, A = window.__all; const s = T.state.sections[T.state.order[0]]; const h = s.history;
      const mv = A.movement(s, h[h.length - 1], h[h.length - 2]); const d = A.digestFor(s);
      return { skipped: JSON.stringify(s.studentSkips), alex: mv && mv.deltas ? mv.deltas['ALEX ABBOTT#0'] : 'none', blake: mv && mv.deltas && mv.deltas['BLAKE BRISCOE#0'] ? mv.deltas['BLAKE BRISCOE#0'].d : null, down: (d.ixl && d.ixl.down || []).length }; });
    const o = await read();
    check(/ALEX ABBOTT#0/.test(o.skipped) && o.alex === undefined && o.down === 0, `IXL-13: the student whose own list changed is left out of the movement, nobody "Dropped" (${JSON.stringify(o)})`);
    check(o.blake === 1, `IXL-13: a classmate who earned a skill is still measured (+${o.blake})`);
    await p.reload(); await p.waitForTimeout(800); const r = await read();
    check(r.alex === undefined && r.blake === 1, `IXL-13: the same after a reload (each student's own total is saved with the snapshot)`);
    const bf = await p.evaluate(() => JSON.stringify(window.__all.boardFile())); const bfile = path.join(tmp, 'board-ixl13.json'); fs.writeFileSync(bfile, bf);
    const q = await fresh(b); await q.p.setInputFiles('#file', [bfile]); await q.p.waitForTimeout(900);
    const ob = await q.p.evaluate(() => { const A = window.__all; const x = A.leaderboardData()[0]; const s = window.__tally.state.sections[x.key]; return { gain: x.gain, basis: x.basisChanged, own: s.history.some(h => h.own && Object.keys(h.own).length) }; });
    check(ob.own && (ob.gain > 0 || ob.basis) && !/ABBOTT|BRISCOE|CARVER|DUNNE|ALEX|BLAKE/i.test(bf), `IXL-13: a Board file carries each student's own totals under pseudonyms, its Race doesn't read the skip as a loss, and it names no student (${JSON.stringify(ob)})`);
    await q.ctx.close(); await ctx.close(); }

  // ---- IXL-07 (round 2): snapshots on different best-score bases are a change of basis, not students moving ----
  { const { p, ctx } = await fresh(b); const st = ['ALEX ABBOTT', 'BLAKE BRISCOE', 'CASEY CARVER', 'DREW DUNNE'];
    const grid = (date, rows) => { const q = v => '"' + v + '"'; const lines = [['Unit', '', 'Skill name', 'Permanent Skill ID', ...st].map(q).join(',')];
      rows.forEach(([id, sc]) => lines.push([q('Unit 1 Synthetic Unit'), q('Lesson 1.1 L'), q('Synthetic skill ' + id), id, ...sc.map(v => v == null ? '' : v)].join(',')));
      const d = fs.mkdtempSync(path.join(tmp, 'g')); const f = path.join(d, `IXL-Score-Grid_${date}_This-School-Year_1205050-7T5A-M_J-ACC_Math-Nation-FL-B.E.S.T.-Accelerated-7th-Grade_Math.csv`); fs.writeFileSync(f, lines.join('\n')); return f; };
    await p.setInputFiles('#file', [grid('2026-11-02', [['AA1', [90, 90, 70, 10]], ['AA2', [85, 10, null, null]]])]); await p.waitForTimeout(700);
    await p.evaluate(() => { const T = window.__tally; const s = T.state.sections[T.state.order[0]]; s.skipRoster = true; T.state.settings.currentUnit = { acc: 1, on: null }; T.state.settings.useBest = true; T.save(); });
    await p.setInputFiles('#file', [grid('2026-11-09', [['AA1', [50, 90, 70, 10]], ['AA2', [85, 10, null, null]]])]); await p.waitForTimeout(700);   // Alex's AA1 fell; best keeps it
    await p.evaluate(() => { window.__all.setUseBest(false); window.__tally.save(); });
    const read = () => p.evaluate(() => { const A = window.__all, T = window.__tally; const s = T.state.sections[T.state.order[0]]; const x = A.leaderboardData()[0]; const d = A.digestFor(s); const h = s.history;
      return { basis: x.basisChanged, gain: x.gain, down: (d.ixl && d.ixl.down || []).length, bases: h.map(y => y.best), mv: (A.movement(s, h[h.length - 1], h[h.length - 2]) || {}).reason }; });
    const o = await read();
    check(o.mv === 'basis' && o.basis && o.down === 0 && JSON.stringify(o.bases) === '[true,false]', `IXL-07: turning best score off reads as a change of basis, nobody "Dropped" (${JSON.stringify(o)})`);
    await p.reload(); await p.waitForTimeout(800); const r = await read();
    check(r.mv === 'basis' && JSON.stringify(r.bases) === '[true,false]', `IXL-07: each snapshot's basis survives a reload (${JSON.stringify(r.bases)})`);
    const old = await p.evaluate(() => { const A = window.__all, T = window.__tally; const s = T.state.sections[T.state.order[0]]; const h = s.history.map(y => { const z = { ...y }; delete z.best; return z; }); const m = A.movement(s, h[1], h[0]); return m && m.reason; });
    check(old === null, `IXL-07: snapshots saved without the field are read as before (reason ${old})`);
    await ctx.close(); }

  // ---- IXL-04: a "Keep Focus" row is recorded in the receipt as the number that was pasted ----
  { const { p, ctx } = await fresh(b); await realClass(p);
    const o = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); });
      const u = T.unitsOf(s).find(x => x.short === 'Unit 2'); const r = A.reconcile(s).find(x => x.unit.name === u.name).rows.find(x => x.status === 'differ' && x.focus != null);
      s.overrides[u.name] = { [r.display]: { focus: r.focus, tally: r.tally, at: new Date().toISOString(), why: 'paper retake' } };
      const col = A.unitColumn(s, u, 'points'); const i = A.copyRows(s).findIndex(x => x.display === r.display);
      await A.copyUnit(s, u); const rec = s.receipts[u.name].rows.find(x => x[0] === r.display); return { pasted: col[i], focus: r.focus, tally: r.tally, rec: rec[1] }; }, K);
    check(String(o.rec) === o.pasted && o.rec === o.focus && o.focus !== o.tally, `IXL-04: the receipt records the kept Focus number that was pasted (pasted ${o.pasted}, receipt ${o.rec}, Tally ${o.tally})`);
    await ctx.close(); }

  // ---- IXL-09: a roster typed in another case than the gradebook: a fresh receipt still finds every student ----
  { const { p, ctx } = await fresh(b); await realClass(p, undefined, fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8').split('\n').map(l => l.toLowerCase().replace(/(^|[\s,'-])([a-z])/g, (m, a, c) => a + c.toUpperCase())).join('\n'));
    const o = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); });
      const u = T.unitsOf(s).find(x => x.short === 'Unit 2'); await A.copyUnit(s, u); A.openReceipt(s, u.name); const txt = document.querySelector('#modal').innerText;
      return { gone: (txt.match(/not on the roster now/g) || []).length, rows: s.receipts[u.name].rows.length, differ: s.roster.split('\n')[0] !== s.grades.students[0] }; }, K);
    check(o.differ && o.rows > 0 && o.gone === 0, `IXL-09: right after a copy the receipt marks 0 of ${o.rows} rows "not on the roster now" (${o.gone})`);
    await ctx.close(); }

  // ---- IXL-07: switching "best score" in Settings re-takes the newest snapshot ----
  { const { p, ctx } = await fresh(b);
    const st = ['ALEX ABBOTT', 'BLAKE BRISCOE', 'CASEY CARVER'];
    const grid = (date, rows) => { const q = v => '"' + v + '"'; const lines = [['Unit', '', 'Skill name', 'Permanent Skill ID', ...st].map(q).join(',')];
      rows.forEach(([id, sc]) => lines.push([q('Unit 1 Synthetic Unit'), q('Lesson 1.1 L'), q('Synthetic skill ' + id), id, ...sc.map(v => v == null ? '' : v)].join(',')));
      const d = fs.mkdtempSync(path.join(tmp, 'g')); const f = path.join(d, `IXL-Score-Grid_${date}_This-School-Year_1205050-7T5A-M_J-ACC_Math-Nation-FL-B.E.S.T.-Accelerated-7th-Grade_Math.csv`); fs.writeFileSync(f, lines.join('\n')); return f; };
    await p.setInputFiles('#file', [grid('2026-11-02', [['AA1', [90, 80, 10]], ['AA2', [80, 75, null]]])]); await p.waitForTimeout(700);
    await p.evaluate(() => { const T = window.__tally; const s = T.state.sections[T.state.order[0]]; s.skipRoster = true; T.state.settings.currentUnit = { acc: 1, on: null }; T.save(); T.render(); });
    await p.setInputFiles('#file', [grid('2026-11-09', [['AA1', [50, 40, 10]], ['AA2', [80, 30, null]]])]); await p.waitForTimeout(700);   // SmartScores fell
    const snapVsGrid = () => p.evaluate(() => { const T = window.__tally, A = window.__all; const s = T.state.sections[T.state.order[0]]; const u = T.unitsOf(s)[0]; const h = s.history[s.history.length - 1];
      return { best: T.state.settings.useBest, same: JSON.stringify(h.per) === JSON.stringify(Object.fromEntries(A.ixlList(s).map(x => [x.key, T.points(s, u, x.i)]))) }; });
    await p.click('#btnSettings'); await p.waitForTimeout(300); await global.seeTab(p, '#useBest'); await p.uncheck('#useBest'); await p.click('#mSave'); await p.waitForTimeout(400);
    const off = await snapVsGrid();
    await p.click('#btnSettings'); await p.waitForTimeout(300); await global.seeTab(p, '#useBest'); await p.check('#useBest'); await p.click('#mSave'); await p.waitForTimeout(400);
    const on = await snapVsGrid();
    check(off.best === false && off.same && on.best === true && on.same, `IXL-07: the newest snapshot equals the grid after best score is turned off, and on again (${JSON.stringify([off, on])})`);
    await ctx.close(); }

  // ---- TIM-01 (this part): a copy, a kept row and a pasted roster stamped at 8:30 pm Eastern show that day, not tomorrow ----
  { const { p, ctx } = await fresh(b); await realClass(p);
    const o = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); });
      const eve = '2026-11-14T01:30:00.000Z';   /* Fri 13 Nov 2026, 8:30 pm in New York */
      const u = T.unitsOf(s).find(x => x.short === 'Unit 2'); await A.copyUnit(s, u); s.receipts[u.name].at = eve;
      const r = A.reconcile(s).find(x => x.unit.name === u.name).rows.find(x => x.status === 'differ' && x.focus != null);
      s.overrides[u.name] = { [r.display]: { focus: r.focus, tally: r.tally, at: eve, why: 'paper retake' } }; s.rosterAt = eve; T.save(); T.render();
      const grid = document.querySelector('#gridwrap') ? document.querySelector('#gridwrap').innerText : '';
      A.openFocusCheck(s, u.name); const fc = document.querySelector('#modal').innerHTML;
      return { grid: /copied Nov 13/i.test(grid) && !/copied Nov 14/i.test(grid), fc: /Nov 13/.test(fc) && !/Nov 14/.test(fc) }; }, K);
    check(o.grid && o.fc, `TIM-01: an evening copy and an evening "Keep Focus" read Nov 13 (the local day), not Nov 14 (${JSON.stringify(o)})`);
    await ctx.close(); }

  // ---- IXL-10: the grid's footer "Class average" is the counted class's, without the NOT ON ROSTER accounts ----
  { const { p, ctx } = await fresh(b); await realClass(p);
    const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); });
      T.render(); const foot = [...document.querySelectorAll('table.grid tfoot td')].map(t => t.innerText);
      const pop = T.population(s); const us = T.unitsOf(s).filter(u => !u.upcoming && !u.hidden); const pm = us.map(u => (pop.reduce((a, x) => a + T.points(s, u, x.i), 0) / pop.length).toFixed(1));
      return { ixlOnly: A.buildRows(s).filter(r => r.status === 'ixlOnly').length, foot: foot.slice(2, 2 + pm.length), pm }; }, K);
    check(o.ixlOnly > 0 && JSON.stringify(o.foot) === JSON.stringify(o.pm), `IXL-10: the footer class average is the counted class's (${o.foot.join(', ')} vs ${o.pm.join(', ')}, ${o.ixlOnly} not-on-roster accounts left out)`);
    await ctx.close(); }

  // ---- IXL-11: with a gradebook loaded, "New student?" says to export a new gradebook; Copy asks first when a roster student isn't in it ----
  { const { p, ctx } = await fresh(b); await realClass(p); const asked = []; p.on('dialog', d => asked.push(d.message()));
    const nr = await p.evaluate(K => { document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); }); return window.__all.buildRows(window.__tally.state.sections[K]).find(r => r.status === 'ixlOnly'); }, K);
    await p.click(`[data-ignore="${nr.key}"]`); await p.waitForTimeout(200); const dlg = await p.textContent('#modal');
    check(/New student\?\s*Export a new gradebook from Focus and drop it on Tally/.test(dlg), `IXL-11: the dialog says to export a new gradebook ("${(dlg.match(/New student\?[^.]*\./) || [''])[0]}")`);
    const o = await p.evaluate(async ({ K, who }) => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); });
      const lines = s.roster.split('\n').filter(Boolean); lines.splice(3, 0, '9999999\t' + who); s.roster = lines.join('\n'); s.rosterAt = new Date().toISOString(); T.save(); T.render();   /* the roster re-pasted with the new student */
      const u = T.unitsOf(s).find(x => x.short === 'Unit 2'); await A.copyUnit(s, u); return { toast: document.querySelector('#toast').innerText }; }, { K, who: nr.display });
    check(asked.some(m => /1 student on your roster is not in the Focus gradebook/.test(m) && m.includes(nr.display) && /off by one/.test(m)), `IXL-11: Copy asks first, naming the roster student the gradebook lacks ("${(asked[0] || '').slice(0, 70)}")`);
    check(/not in the Focus gradebook: export a new gradebook/.test(o.toast), 'IXL-11: after "Copy anyway" the toast still says a new gradebook is needed');
    await ctx.close(); }

  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
