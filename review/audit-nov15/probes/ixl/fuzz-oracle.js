// Auditor IXL: independent oracle vs Tally's IXL engine, on the scrubbed class and on N randomized synthetic classes.
// Run: TALLY_REPO=... node probes/fuzz-oracle.js [N] [seed]
// Compares: points(), totalFor(), ixlFor(), snapshot per/pu/ua, unitColumn in col/names/ids modes (order = gradebook order),
// reconcile statuses and counts, the grid DOM cells, row and footer figures. Exit 1 on any disagreement.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/ixl/repo';
const { chromium, fs, exe, check, done, pick, APP } = require(path.join(REPO, 'tests/lib.js'));
const K = '1205050-7T1A';
const N = +process.argv[2] || 2000, SEED = +process.argv[3] || 12345;
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  // ---- my own CSV reader + oracle on the fixture (node side): points per unit per IXL student at the class goal ----
  const csv = t => { const rows = []; let row = [], f = '', q = false; for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c; } if (f || row.length) { row.push(f); rows.push(row); } return rows; };
  const R = csv(fs.readFileSync(path.resolve('fixtures', ixl), 'utf8'));
  const names = R[0].slice(4); const fx = {};
  const merged = new Map(); R.slice(1).filter(r => r.length >= 4 && r[0]).forEach(r => { const k = r[0] + '|' + r[3]; const v = names.map((_, i) => r[4 + i] == null || r[4 + i] === '' ? null : Number(r[4 + i])); if (merged.has(k)) { const o = merged.get(k).v; v.forEach((x, i) => { if (x != null && (o[i] == null || x > o[i])) o[i] = x; }); } else merged.set(k, { u: r[0], v }); });   // a skill listed twice in one unit is one skill (best of the two rows)
  merged.forEach(({ u, v }) => { fx[u] = fx[u] || { n: 0, pts: names.map(() => 0) }; fx[u].n++; v.forEach((x, i) => { if (x != null && x >= 67) fx[u].pts[i]++; }); });
  const fixtureCmp = await p.evaluate(({ K, fx, names }) => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const bad = [];
    T.unitsOf(s).forEach(u => { const o = fx[u.name]; if (!o) { bad.push('unit ' + u.name + ' missing in oracle'); return; } if (o.n !== u.idx.length) bad.push(u.name + ' skills ' + o.n + ' vs ' + u.idx.length);
      names.forEach((nm, i) => { const si = s.students.indexOf(nm); if (si < 0) { bad.push('student ' + nm); return; } const tp = T.points ? T.points(s, u, si) : A.points(s, u, si); if (u.total === u.idx.length && tp !== o.pts[i]) bad.push(`${u.short} ${nm}: tally ${tp} oracle ${o.pts[i]}`); }); });
    return { bad, thr: s.threshold, ex: Object.keys(s.excluded || {}).length }; }, { K, fx, names });
  console.log('fixture oracle:', JSON.stringify(fixtureCmp).slice(0, 600));
  check(fixtureCmp.bad.length === 0, 'fixture: every unit and student matches my CSV oracle');

  // ---- randomized synthetic classes, all inside one page session ----
  const res = await p.evaluate(({ K, N, SEED }) => {
    const T = window.__tally, A = window.__all; const st = T.state; const base = st.sections[K];
    let seed = SEED; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const ch = a => a[Math.floor(rnd() * a.length)];
    const FIRST = ['ALEX', 'BLAKE', 'CASEY', 'DREW', 'EMERY', 'FINLEY', 'GRAY', 'HARPER', 'IVY', 'JUDE', 'KIT', 'LANE', 'MORGAN', 'NOEL', 'OAKLEY', 'PAT', 'QUINN', 'REESE', 'SAGE', 'TATE'];
    const LAST = ['ABBOTT', 'BRISCOE', 'CARVER', 'DUNNE', 'ELLIS', 'FORD', 'GALE', 'HOLT', 'IRVING', 'JOYNER', 'KEMP', 'LYLE', 'MARSH', 'NUNEZ', 'OWENS', 'PRICE'];
    const cap = w => w[0] + w.slice(1).toLowerCase();
    const fails = []; const fail = (c, m) => { if (fails.length < 40) fails.push('case ' + c + ': ' + m); };
    let compared = 0; const process_ids_known = (a, e) => a.map(x => x.replace(/^[^\t]*\t/, '')).join('|') !== e.map(x => x.replace(/^[^\t]*\t/, '')).join('|');   // IXL-01 (blank IDs) is known: compare the rest
    // independent oracle helpers (written from README "How it counts" + NOTES, not from the code)
    const okey = (students) => { const seen = {}; return students.map(n => { const k = n.toLowerCase(); seen[k] = (seen[k] || 0) + 1; return n + '#' + (seen[k] - 1); }); };
    for (let c = 0; c < N; c++) {
      const prep = rnd() < 0.5 ? 'acc' : 'on';
      const nStu = ri(1, 28); const used = new Set(); const studs = [];
      while (studs.length < nStu) { const n = ch(FIRST) + ' ' + ch(LAST); if (!used.has(n)) { used.add(n); studs.push(n); } }
      const nUnits = ri(1, 5); const skills = []; for (let u = 1; u <= nUnits; u++) { const m = ri(0, 8); for (let j = 0; j < m; j++) skills.push({ unit: `Unit ${u} Title${u}`, lesson: `Lesson ${u}.${j}`, name: `Skill ${u}-${j}`, id: `S${c}x${u}x${j}` }); }
      if (!skills.length) skills.push({ unit: 'Unit 1 Title1', lesson: 'Lesson 1.0', name: 'Skill 1-0', id: `S${c}x1x0` });
      const sv = () => { const r = rnd(); return r < 0.3 ? null : r < 0.35 ? 0 : r < 0.4 ? 100 : ri(0, 100); };
      const thr = rnd() < 0.15 ? ch([1, 100, 59, 61, 66, 68]) : (prep === 'acc' ? 67 : 60);
      const scores = skills.map(() => studs.map(sv));
      // planted edges: exactly at goal, one below
      scores.forEach(r => r.forEach((v, i) => { if (rnd() < 0.08) r[i] = thr; else if (rnd() < 0.05) r[i] = thr - 1; }));
      const keys = okey(studs);
      const best = {}; if (rnd() < 0.7) skills.forEach((sk, k) => { const row = best[sk.id] = {}; studs.forEach((n, i) => { if (rnd() < 0.3) row[keys[i]] = ri(0, 100); }); });
      const excluded = {}; skills.forEach(sk => { if (rnd() < 0.12) excluded[sk.id] = true; });
      const skips = {}; studs.forEach((n, i) => { if (rnd() < 0.2) { const o = {}; skills.forEach(sk => { if (rnd() < 0.4) o[sk.id] = true; }); if (Object.keys(o).length) skips[keys[i]] = o; } });
      const useBest = rnd() < 0.8; const skipFirst = ri(0, 1); const cur = ri(skipFirst, nUnits + 1) || null;
      const marks = {}; for (let u = 1; u <= nUnits; u++) if (rnd() < 0.15) marks[`Unit ${u} Title${u}`] = rnd() < 0.5;
      // Focus side: the gradebook lists some of the students (and some not in IXL) in its own order
      const inGb = studs.filter(() => rnd() < 0.9); const extra = []; for (let e = 0; e < ri(0, 2); e++) extra.push(ch(FIRST) + ' ZED' + c + e);
      const gbNames = [...inGb, ...extra].sort(() => rnd() - 0.5).map(n => { const [f, l] = n.split(' '); return cap(l) + ', ' + cap(f); });
      const ids = gbNames.map((_, i) => String(9000000 + c * 50 + i));
      // stage the class
      const s = base; Object.assign(s, { prep, threshold: thr, students: studs, skills, scores, best: Object.keys(best).length ? best : null, studentSkips: skips, ignored: {}, aliases: {}, receipts: {}, overrides: {}, history: [], gbUnitMap: {}, qArchive: {}, _keys: null, placeholder: false, skipRoster: false });
      st.skips[prep] = excluded; s.excluded = excluded; st.settings.useBest = useBest; st.settings.skipFirst = { acc: 0, on: 0, [prep]: skipFirst }; st.settings.currentUnit = { acc: null, on: null, [prep]: cur }; st.assigned[prep] = marks;
      s.roster = gbNames.map((n, i) => ids[i] + '\t' + n).join('\n');
      // gradebook: one IXL column per unit, random Focus values / statuses
      const unitsT = T.unitsOf(s);
      const asg = unitsT.filter(() => rnd() < 0.8).map(u => { const max = rnd() < 0.8 ? u.total : ri(1, 12); const status = [], values = [];
        gbNames.forEach(() => { const r = rnd(); if (r < 0.15) { status.push('blank'); values.push(null); } else if (r < 0.25) { status.push('missing'); values.push(null); } else if (r < 0.3) { status.push('excused'); values.push(null); } else { status.push('score'); values.push(rnd() < 0.1 ? ri(0, max) + 0.5 : ri(0, max + 1)); } });
        return { name: `${u.short} IXL`, max, values, status, category: 'IXL', due: '11/10', assignedOn: '11/02', excused: status.includes('excused') }; });
      s.grades = { students: gbNames, ids, assignments: asg, importedAt: new Date(Date.UTC(2026, 10, 14, 12, 0, c % 60)).toISOString() + c, exportedAt: null, raw: {} };
      asg.forEach(a => { s.grades.raw[a.name] = a.status.map(x => x === 'excused' ? 'EX' : x === 'missing' ? 'NHI' : ''); });
      // receipts: random earlier copies
      const unitsNow = T.unitsOf(s);
      // ---- oracle ----
      const oUnits = []; const seenU = new Map(); skills.forEach((sk, k) => { if (!seenU.has(sk.unit)) { seenU.set(sk.unit, oUnits.length); oUnits.push({ name: sk.unit, num: +sk.unit.match(/^Unit (\d+)/)[1], idx: [] }); } oUnits[seenU.get(sk.unit)].idx.push(k); });
      oUnits.forEach(u => { u.active = u.idx.filter(k => !excluded[skills[k].id]); u.assigned = marks[u.name] != null ? marks[u.name] : u.num <= skipFirst ? false : (!!cur && u.num <= cur); });
      const oScore = (k, i) => { const v = scores[k][i]; if (!useBest || !best[skills[k].id]) return v; const bv = best[skills[k].id][keys[i]]; return bv == null ? v : v == null ? bv : Math.max(v, bv); };
      const oOwn = (u, i) => u.active.filter(k => !(skips[keys[i]] && skips[keys[i]][skills[k].id]));
      const oPts = (u, i) => oOwn(u, i).filter(k => { const v = oScore(k, i); return v != null && v >= thr; }).length;
      if (unitsNow.length !== oUnits.length) { fail(c, 'unit count'); continue; }
      unitsNow.forEach((u, ui) => { const o = oUnits[ui]; if (u.name !== o.name || u.total !== o.active.length || u.assigned !== !!o.assigned) fail(c, `unit ${u.name} total ${u.total}/${o.active.length} assigned ${u.assigned}/${o.assigned}`);
        studs.forEach((n, i) => { compared++; const tp = T.points(s, u, i), tt = T.totalFor ? T.totalFor(s, u, i) : A.totalFor(s, u, i); if (tp !== oPts(o, i)) fail(c, `${u.short} ${n} points ${tp} oracle ${oPts(o, i)}`); if (tt !== oOwn(o, i).length) fail(c, `${u.short} ${n} total ${tt} oracle ${oOwn(o, i).length}`); }); });
      // ixlFor: open units only (nothing is closed here)
      studs.forEach((n, i) => { const f = A.ixlFor(s, i); const au = oUnits.filter(u => u.assigned && u.active.length); const d = au.reduce((a, u) => a + oPts(u, i), 0), q = au.reduce((a, u) => a + oOwn(u, i).length, 0); if (!f || f.done !== d || f.poss !== q) fail(c, `ixlFor ${n} ${f && f.done}/${f && f.poss} vs ${d}/${q}`); });
      // snapshot
      A.snapshot(s); const h = s.history[s.history.length - 1];
      studs.forEach((n, i) => { const per = oUnits.filter(u => u.assigned).reduce((a, u) => a + oPts(u, i), 0); if (h.per[keys[i]] !== per) fail(c, `snapshot per ${n} ${h.per[keys[i]]} vs ${per}`); oUnits.forEach(u => { if (h.pu[u.name][keys[i]] !== oPts(u, i)) fail(c, `snapshot pu ${u.name} ${n}`); if (h.ua[u.name] !== u.active.length) fail(c, 'ua ' + u.name); }); });
      // copy: rows in the gradebook's order, '' for a Focus student not in IXL
      const byName = new Map(studs.map((n, i) => { const [f, l] = n.split(' '); return [cap(l) + ', ' + cap(f), i]; }));
      unitsNow.forEach((u, ui) => { if (!u.total) return; const o = oUnits[ui];
        const col = A.unitColumn(s, u, 'col'); const ex = gbNames.map(g => byName.has(g) ? String(oPts(o, byName.get(g))) : '');
        if (col.join('|') !== ex.join('|')) fail(c, `copy ${u.short}: ${col.join(',')} vs ${ex.join(',')}`);
        const ids2 = A.unitColumn(s, u, 'ids'); const exI = gbNames.map((g, j) => { const i = byName.get(g); const own = i == null ? '' : oOwn(o, i).length !== o.active.length ? '\t/' + oOwn(o, i).length : ''; return ids[j] + '\t' + (i == null ? '' : oPts(o, i)) + own; });
        if (process_ids_known(ids2, exI)) fail(c, `ids ${u.short}: ${ids2.slice(0, 3)} vs ${exI.slice(0, 3)}`);
        const nm = A.unitColumn(s, u, 'names'); if (nm.map(x => x.split('\t')[0]).join('|') !== gbNames.join('|')) fail(c, 'names order'); });
      // no gradebook: the pasted roster's order (and with no roster at all, IXL names by last name, every row named)
      { const g0 = s.grades, r0 = s.roster; s.grades = null; const rl = gbNames.slice().sort(() => rnd() - 0.5); s.roster = rl.join('\n');
        unitsNow.forEach((u, ui) => { if (!u.total) return; const o = oUnits[ui]; const col = A.unitColumn(s, u, 'col'); const ex = rl.map(g => byName.has(g) ? String(oPts(o, byName.get(g))) : '');
          if (col.join('|') !== ex.join('|')) fail(c, `roster copy ${u.short}: ${col.join(',')} vs ${ex.join(',')}`); });
        s.roster = ''; const disp = studs.map((n, i) => [A.ixlDisplay(n), i]).sort((a, b) => a[0].localeCompare(b[0]));
        unitsNow.forEach((u, ui) => { if (!u.total) return; const o = oUnits[ui]; const col = A.unitColumn(s, u, 'names'); const ex = disp.map(([d, i]) => d + '\t' + oPts(o, i) + (oOwn(o, i).length !== o.active.length ? '\t/' + oOwn(o, i).length : ''));
          if (col.join('|') !== ex.join('|')) fail(c, `no-roster copy ${u.short}`); });
        s.grades = g0; s.roster = r0; }
      if (c % 25 === 0) { st.active = K; s.skipRoster = false; T.render(); const trs = [...document.querySelectorAll('#gridwrap table.grid tbody tr')]; const br = A.buildRows(s); const shownU = unitsNow.filter(u => !u.upcoming && (!u.hidden || st.settings.showAllUnits));
        if (trs.length !== br.length) fail(c, `grid rows ${trs.length} vs ${br.length}`);
        br.forEach((r, j) => { const tds = trs[j] ? [...trs[j].querySelectorAll('td.pts')] : []; shownU.forEach((u, k) => { const o = oUnits[unitsNow.indexOf(u)]; const ex = r.ixl == null ? '—' : oPts(o, r.ixl) + '/' + oOwn(o, r.ixl).length; const got = tds[k] ? tds[k].innerText.replace(/\s+/g, '') : 'none'; if (got !== ex) fail(c, `grid cell ${r.display} ${u.short}: ${got} vs ${ex}`); }); }); }
      // reconcile, from the written rules: blank/NHI/excused vs Tally, a value equal within 0.01
      const rcs = A.reconcile(s);
      asg.forEach(a => { const u = unitsNow.find(x => a.name === x.short + ' IXL'); const o = oUnits[unitsNow.indexOf(u)]; const r = rcs.find(x => x.assignment === a);
        if (!o.assigned) { if (r) fail(c, 'reconciled an unassigned unit'); return; } if (!r) { fail(c, 'no reconcile for ' + a.name); return; }
        if (r.maxOK !== (a.max === o.active.length)) fail(c, 'maxOK');
        gbNames.forEach((g, j) => { const i = byName.get(g); const row = r.rows[j]; let ex;
          if (i == null) ex = 'unmatched'; else { const tp = oPts(o, i), fv = a.values[j];
            if (fv == null) ex = tp > 0 ? 'missing' : (a.status[j] === 'missing' || a.status[j] === 'excused') ? 'match' : 'missing';
            else ex = Math.abs(fv - tp) < 0.01 ? 'match' : 'differ'; }
          if (!row || row.status !== ex || row.display !== g) fail(c, `reconcile ${a.name} ${g}: ${row && row.status} vs ${ex}`); }); });
    }
    return { fails, compared };
  }, { K, N, SEED });
  console.log('compared', res.compared, 'student-unit cells over', N, 'random classes');
  res.fails.slice(0, 25).forEach(f => console.log('  ' + f));
  console.log('OBSERVED:', res.fails.length, 'disagreements'); console.log('EXPECTED: 0 disagreements');
  check(res.fails.length === 0, 'random classes: Tally agrees with the oracle');
  check(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
