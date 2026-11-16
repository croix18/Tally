// 15 Nov 2026 audit, fixer STU: the student page, what-ifs, plans and retakes. Each block is one finding's regression check.
const { chromium, fs, path, exe, check, done, pick, tmp, APP } = require('./lib');
const K = '1205050-7T1A';
const ixlFile = () => path.resolve('fixtures', fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed')));
async function cls(b) {   // the scrubbed real class: IXL, roster, the Quarter 1 gradebook
  const o = await open(b); const p = o.p;
  await p.setInputFiles('#file', [ixlFile()]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  return o;
}
async function open(b) {
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'America/New_York' }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept()); await p.goto('file://' + path.resolve(APP)); return { ctx, p, errs };
}
(async () => {
  const b = await chromium.launch({ executablePath: exe });

  // ---- WIF-01 / CON-01 / CNF-01: two students of one name, staged as a real import does ------------------------------
  // The roster and both quarters' gradebooks carry the second student's row under the first one's name, with their own
  // Focus IDs. Quarter 1 is kept when the Quarter 2 export arrives. Every surface must show each student their own row.
  {
    const { ctx, p, errs } = await open(b);
    await p.setInputFiles('#file', [ixlFile()]); await p.waitForTimeout(500);
    const ros = fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8').split('\n'); const n0 = ros[0], n1 = ros[1]; ros[1] = n0;
    await p.fill('#rpText', ros.join('\n')); await p.click('#rpSave'); await p.waitForTimeout(300);
    for (const f of ['focus_gradebook_scrubbed.csv', 'focus_gradebook_scrubbed_q2.csv']) {
      const out = path.join(tmp, 'twin-' + f); fs.writeFileSync(out, fs.readFileSync(path.join('fixtures', f), 'utf8').split('"' + n1 + '"').join('"' + n0 + '"'));
      await p.setInputFiles('#file', [out]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
    }
    const read = () => p.evaluate(K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const gb = s.grades; const key = x => String(x || '').replace(/\s+/g, '');
      const arch = s.qArchive && s.qArchive[1]; const out = { kept: !!arch, twins: [] };
      gb.students.forEach((n, i) => { if (!/^SUTTER, HAYDEN SKYLER/.test(n)) return; const id = gb.ids[i]; const ai = arch ? arch.gb.ids.findIndex(x => key(x) === key(id)) : -1;
        const own = A.computeGrade(A.openSec(s), i).rounded; const books = A.studentBooks(s, n); const ob = books.find(x => !x.closed), cb = books.find(x => x.q === 1);
        const sum = A.studentSummary(s, n); const fin = sum.finals.find(x => x.q === 1);
        T.openProfile(K, n); const t = q => { const e = document.querySelector(q); return e ? e.innerText : ''; };
        const now = (/Now\s*(\d+)/.exec(t('#pWhat')) || [])[1]; const pos = (/(\d+) of (\d+)/.exec(t('#bar .meta')) || [])[0];
        document.querySelector('#pShow').click(); const showEl = document.querySelector('.shNow b'); const show = showEl ? parseInt(showEl.textContent) : null; A.closeShow();
        T.openProfile(K, n); document.querySelector('#pConf').click(); const conf = (/Quarter 2: (\d+)%/.exec(t('#modal')) || [])[1]; document.querySelector('#mClose').click();
        const list = A.classStudents(s);
        out.twins.push({ n, i, own, ai, openRow: ob ? ob.i : null, keptRow: cb ? cb.i : null, keptFinal: fin ? fin.g : null, archFinal: ai >= 0 ? arch.final[ai] : null,
          now: +now, show, conf: +conf, pos, wantPos: (list.indexOf(n) + 1) + ' of ' + list.length, gi: A.findStudent(s, n).gi }); });
      return out; }, K);
    const check1 = (o, tag) => {
      check(o.kept && o.twins.length === 2 && o.twins[0].n !== o.twins[1].n, `same name ${tag}: two marked students and a kept Quarter 1`);
      check(o.twins[0].own !== o.twins[1].own || o.twins[0].archFinal !== o.twins[1].archFinal, `same name ${tag}: the two have different grades (the check can tell them apart)`);
      for (const x of o.twins) { const who = x.n.replace(/^.*\(/, '('); console.log('  ', tag, JSON.stringify(x));
        check(x.gi === x.i && x.openRow === x.i, `same name ${tag} ${who}: the open quarter's book is the student's own row`);
        check(x.ai >= 0 && x.keptRow === x.ai, `same name ${tag} ${who}: the kept Quarter 1 book is the student's own row, found by Focus ID`);
        check(x.keptFinal === x.archFinal, `same name ${tag} ${who}: the Quarter 1 final is the student's own`);
        check(x.now === x.own, `same name ${tag} ${who}: what-ifs "Now" is the student's own grade`);
        check(x.show === x.own, `same name ${tag} ${who}: Show student shows the student's own grade`);
        check(x.conf === x.own, `same name ${tag} ${who}: the conference form shows the student's own grade`);
        check(x.pos === x.wantPos, `same name ${tag} ${who}: Prev/Next position is the student's own place`); }
    };
    check1(await read(), 'import');
    // a quarter kept before the 14 Nov marks holds the plain names (and here the pair in the other order): the Focus ID still finds each student's row
    await p.evaluate(K => { const T = window.__tally, s = T.state.sections[K]; const a = s.qArchive[1], g = a.gb; const sw = l => { if (Array.isArray(l) && l.length === g.students.length) { const t = l[0]; l[0] = l[1]; l[1] = t; } };
      g.students = g.students.map(n => n.replace(/ \((ID …\w+|\d+)\)$/, '')); [g.students, g.ids, g.overall, a.final].forEach(sw); g.assignments.forEach(c => { sw(c.values); sw(c.status); }); T.save(); }, K);
    check1(await read(), 'unmarked kept quarter');
    // round 2: each twin's own records (notes, family, report log, conference edits) are kept apart, through a save and a reload;
    // an entry already kept under the plain name both share is shown to neither and stays in the saved data
    await p.evaluate(K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const [a] = s.grades.students.filter(n => /^SUTTER, HAYDEN SKYLER/.test(n)); const key = A.stuKey ? A.stuKey(s, a) : A.norm(a); const nn = A.norm(a);
      s.stuNotes = s.stuNotes || {}; s.stuNotes[nn] = [{ id: 'old1', at: '2026-10-01T12:00:00.000Z', text: 'Old note kept under the shared name' }]; s.family = s.family || {}; s.family[nn] = { contacts: [{ id: 'old2', name: 'Old contact', rel: '', phone: '555-0199', email: '', note: '' }], log: [] };
      A.addNote(s, a, 'Private note about the FIRST twin'); A.setFamily(s, a, { contacts: [{ id: 'x1', name: 'Parent of first twin', rel: 'Mother', phone: '555-0101', email: '', note: '' }], log: [] });
      s.confForms = s.confForms || {}; s.confForms[key] = { concerns: 'Concern written for the FIRST twin', base: { concerns: '' }, saved: new Date().toISOString() };
      A.logReport(s, s.grades.students.indexOf(a), A.findStudent(s, a).row); T.save(); }, K);
    await p.reload(); await p.waitForTimeout(800);
    const keys = await p.evaluate(K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const [a, b] = s.grades.students.filter(n => /^SUTTER, HAYDEN SKYLER/.test(n)); const nn = A.norm(a); const k = A.stuKey || A.norm;
      const conc = n => { T.openProfile(K, n); document.querySelector('#pConf').click(); const v = (document.querySelector('#cfConcerns') || {}).value || ''; document.querySelector('#mClose').click(); return v; };
      T.openProfile(K, b); const page = (document.querySelector('#view') || document.body).innerText; const other = s.grades.students.find(n => !/^SUTTER/.test(n));
      return { kA: k(s, a), kB: k(s, b), notesA: A.notesOf(s, a).map(x => x.text), notesB: A.notesOf(s, b).map(x => x.text), famB: A.familyOf(s, b).contacts.length, famA: A.familyOf(s, a).contacts.map(c => c.phone),
        repA: A.reportsOf(s, a).length, repB: A.reportsOf(s, b).length, pageB: /FIRST twin|555-0101|Old note|555-0199/.test(page), concA: conc(a), concB: conc(b),
        orphan: !!(s.stuNotes[nn] && s.stuNotes[nn][0].id === 'old1' && s.family[nn] && s.family[nn].contacts[0].id === 'old2'), same: k(s, other) === A.norm(other) }; }, K);
    check(keys.kA !== keys.kB && keys.same, `same name: each twin's records have their own key (${keys.kA} / ${keys.kB}); every other student keeps the plain name`);
    check(JSON.stringify(keys.notesA) === '["Private note about the FIRST twin"]' && !keys.notesB.length, 'same name: after a reload the note is the first twin\'s only, and the old shared-name note is shown to neither: ' + JSON.stringify([keys.notesA, keys.notesB]));
    check(JSON.stringify(keys.famA) === '["555-0101"]' && keys.famB === 0, 'same name: the family contact is the first twin\'s only');
    check(keys.repA === 1 && keys.repB === 0, `same name: the weekly-report log is the first twin's only (${keys.repA} / ${keys.repB})`);
    check(/FIRST twin/.test(keys.concA) && !/FIRST twin/.test(keys.concB), 'same name: the conference form\'s edits open for the first twin only: ' + JSON.stringify(keys.concB));
    check(!keys.pageB, 'same name: the second twin\'s page shows none of it');
    check(keys.orphan, 'same name: the entries kept under the shared plain name stay in the saved data, untouched');
    const unit = await p.evaluate(() => { const A = window.__all; if (!A.gbIndex) return 'no gbIndex'; const gb = { students: ['DOE, JANE', 'DOE, JANE', 'ROE, AL'], ids: ['100', '200', '300'] };
      return [A.gbIndex(gb, 'DOE, JANE (ID …0200)', '200'), A.gbIndex(gb, 'DOE, JANE (ID …0300)', '999'), A.gbIndex(gb, 'DOE, JANE'), A.gbIndex(gb, 'Roe, Al'), A.gbIndex(gb, 'ROE, AL', '999')]; });
    check(JSON.stringify(unit) === '[1,-1,-1,2,-1]', 'gbIndex: ID first; a shared plain name finds no one; a row with another ID is never taken by name: ' + JSON.stringify(unit));
    check(errs.length === 0, 'same name: no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  // ---- WIF-02: the retake line names the skills that fill the unit's Focus column (Unit 1: 23 skills, column out of 15) --
  {
    const { ctx, p, errs } = await cls(b);
    const r = await p.evaluate(K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const gb = s.grades; const col = gb.assignments.find(a => /^Unit 1 IXL$/.test(a.name)); const u = T.unitsOf(s).find(x => x.short === 'Unit 1');
      const out = []; gb.students.forEach((n, i) => { const f = A.findStudent(s, n); if (f.ixl == null) return; const rt = A.retakeStatus(s, n); const x = rt.unit && rt.unit.name === u.name && rt.short.length ? { short: rt.short, need: rt.need } : rt.behind.find(y => y.unit.name === u.name); if (!x) return;
        const need = Math.min(x.short.length, col.max - A.points(s, u, f.ixl)); if (need >= x.short.length) return; out.push({ i, need, shown: x.short.length, why: A.retakeWhy(rt), toStudent: A.retakeWhy(rt, true) }); });
      return out; }, K);
    check(r.length > 0, 'WIF-02: the class has students whose Unit 1 column fills before every skill is at goal (' + r.length + ')');
    check(r.every(x => new RegExp('\\b' + x.need + ' IXL skills? in Unit 1').test(x.why) && new RegExp('finish ' + x.need + ' IXL skills? in Unit 1').test(x.toStudent)), 'WIF-02: the retake line asks for the skills that fill the column, to the teacher and to the student: ' + r.map(x => x.need + '/' + x.shown + ' "' + x.toStudent + '"').join('; '));
    check(errs.length === 0, 'WIF-02: no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  // ---- WIF-10 / CON-02: after Quarter 1 closes, the IXL tile's class average, sparkline and change count the open units ------
  {
    const { ctx, p, errs } = await cls(b);
    await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
    const r = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
      A.closeQuarter(1, { [s.prep]: ['Unit 1 Equations and Inequalities', 'Unit 2 Rational and Irrational Numbers'] }); T.save(); T.render();
      const name = s.grades.students.find(n => A.findStudent(s, n).ixl != null); const si = A.findStudent(s, name).ixl; T.openProfile(K, name); await new Promise(r => setTimeout(r, 100));
      const tile = [...document.querySelectorAll('.gcard')].find(x => /IXL at goal/.test(x.textContent)).innerText.replace(/\s+/g, ' ');
      const same = T.population(s).map(x => A.ixlFor(s, x.i).done); const avg = Math.round(same.reduce((a, b) => a + b, 0) / same.length * 10) / 10;
      const ix = A.ixlFor(s, si); const it = A.ixlTrend(s, si);
      const h = s.history[s.history.length - 1]; const pu = h.pu; delete h.pu; const old = A.ixlTrend(s, si); h.pu = pu;   // an import kept before per-unit counts
      return { tile, avg, open: ix.open.map(x => x.u.short).join(','), done: ix.done, last: it.mine[it.mine.length - 1], noPu: [old.mine[old.mine.length - 1], old.cls[old.cls.length - 1]] }; }, K);
    const m = /class average ([\d.]+) skills/.exec(r.tile);
    check(r.open === 'Unit 2,Unit 3' && m && Math.abs(+m[1] - r.avg) < 0.06, `WIF-10: the class average is counted on the tile's own units (${r.open}): ${m && m[1]} vs ${r.avg}`);
    check(r.last === r.done, `WIF-10: the sparkline's last point is the tile's own count (${r.last} vs ${r.done})`);
    check(r.noPu[0] == null && r.noPu[1] == null, 'WIF-10: an import with no per-unit counts gives no figure on the narrower basis: ' + JSON.stringify(r.noPu));
    check(errs.length === 0, 'WIF-10: no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  // ---- IXL-08: an IXL-named Focus column no unit claims ("IXL Diagnostic"), Not Handed In, blocks a retake like any missing work ----
  {
    const { ctx, p, errs } = await cls(b);
    const r = await p.evaluate(K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const gb = s.grades; const n = gb.students.length;
      const ok0 = gb.students.filter(x => A.retakeStatus(s, x).ok);
      const a = { name: 'IXL Diagnostic', max: 10, values: Array(n).fill(null), status: Array(n).fill('missing'), missing: n, excused: 0, assigned: gb.assignments[0].assigned, due: gb.assignments[0].due }; gb.assignments.unshift(a);
      const after = ok0.map(x => A.retakeStatus(s, x)); return { unit: A.gbUnitFor(s, a) ? 'claimed' : null, n0: ok0.length, nowOk: after.filter(r => r.ok).length, listed: after.every(r => r.missing.includes('IXL Diagnostic')) }; }, K);
    check(r.unit === null && r.n0 > 0 && r.nowOk === 0 && r.listed, `IXL-08: an NHI in an IXL column no unit claims blocks the retake and is listed as missing (${r.n0} eligible before, ${r.nowOk} after)`);
    check(errs.length === 0, 'IXL-08: no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  // ---- WIF-04: "Show me on the sliders" shows the plan alone, whatever the student tried first ------------------------
  {
    const { ctx, p, errs } = await cls(b);
    const r = await p.evaluate(async K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const gb = s.grades;
      const i = gb.students.findIndex((n, j) => { const q = A.quickestPath(s, A.openSec(s), j, A.findStudent(s, n).ixl); return q && !q.top && q.reached && !q.retakes.length; });
      const name = gb.students[i]; T.openProfile(K, name); await new Promise(r => setTimeout(r, 50)); A.openShow(s, name); const el = document.getElementById('show'); const q = A.quickestPath(s, A.openSec(s), i, A.findStudent(s, name).ixl);
      const on = el.querySelector('#shNextOn'); on.checked = true; on.dispatchEvent(new Event('change')); const nr = el.querySelector('#shNextPts'); nr.value = 0; nr.dispatchEvent(new Event('input'));
      const moved = [...el.querySelectorAll('.shRow[data-k="re"] .shPts, .shRow[data-k="ix"] .shPts')]; moved.forEach(rg => { rg.value = rg.max; rg.dispatchEvent(new Event('input')); });
      el.querySelector('#shPlan').click(); const shown = parseInt(el.querySelector('#shIfV').textContent);
      const back = [...el.querySelectorAll('.shRow[data-k="re"], .shRow[data-k="ix"]')].filter(rw => q.over[rw.dataset.n] == null).every(rw => { const rg = rw.querySelector('.shPts'); return rg.value === rg.defaultValue; });
      const res = { shown, plan: q.result.rounded, nextOn: el.querySelector('#shNextOn').checked, moved: moved.length, back }; A.closeShow(); return res; }, K);
    check(r.shown === r.plan && !r.nextOn, `WIF-04: after the student's own picks, "Show me on the sliders" shows the plan's grade (${r.shown} vs ${r.plan}) with the next test off`);
    check(r.back, `WIF-04: every slider the plan does not use is back at the current score (${r.moved} moved first)`);
    check(errs.length === 0, 'WIF-04: no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  // ---- WIF-05: an NHI IXL column of a student linked to IXL is one control on Show student (the Finish IXL slider) ------
  // ---- WIF-06: the next test's starting score never passes its points --------------------------------------------------
  {
    const { ctx, p, errs } = await cls(b);
    const r = await p.evaluate(async K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const gb = s.grades;
      const col = gb.assignments.find(a => a.name === 'Unit 2 IXL'); const linked = gb.students.map((n, j) => j).filter(j => A.findStudent(s, gb.students[j]).ixl != null); const unl = gb.students.findIndex(n => A.findStudent(s, n).ixl == null);
      const i = linked[0], k = linked[1]; [i, unl].forEach(j => { col.status[j] = 'missing'; col.values[j] = null; });
      const rowsOf = n => { A.openShow(s, n); const el = document.getElementById('show'); const ks = el ? [...el.querySelectorAll('.shRow')].filter(x => x.dataset.n === 'Unit 2 IXL').map(x => x.dataset.k) : null; A.closeShow(); return ks; };
      const one = rowsOf(gb.students[i]), notLinked = unl >= 0 ? rowsOf(gb.students[unl]) : ['miss'];
      const q = gb.assignments.find(a => a.name === 'Unit 1 Vocabulary Quiz'); q.status[k] = 'score'; q.values[k] = q.max + 3; gb.assignments.filter(a => A.catIn(s, a) === 'Assessments' && a !== q).forEach(a => { if (a.max > 0) { a.status[k] = 'score'; a.values[k] = a.max; } });
      A.openShow(s, gb.students[k]); const el = document.getElementById('show'); const rg = el.querySelector('#shNextPts'); const res = { one, notLinked, label: rg.nextElementSibling.textContent, mx: +el.querySelector('#shNextMax').value }; A.closeShow(); return res; }, K);
    check(JSON.stringify(r.one) === '["ix"]', 'WIF-05: a linked student\'s NHI IXL column is one row on Show student, the IXL slider: ' + JSON.stringify(r.one));
    check(r.notLinked && r.notLinked.includes('miss'), 'WIF-05: a student not linked to IXL still sees it under missing work: ' + JSON.stringify(r.notLinked));
    check(+r.label.split('/')[0] <= r.mx, `WIF-06: the next test starts within its points ("${r.label}", out of ${r.mx})`);
    check(errs.length === 0, 'WIF-05/06: no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  // ---- GRD-05 / CON-10 (the student page's part): a closed quarter's heading shows the kept Focus final --------------
  {
    const { ctx, p, errs } = await cls(b);
    await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
    const r = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
      A.closeQuarter(1, { [s.prep]: ['Unit 1 Equations and Inequalities', 'Unit 2 Rational and Irrational Numbers'] }); T.save(); const a = s.qArchive[1];
      const head = n => { T.openProfile(K, n); return [...document.querySelectorAll('.qbook h3')].map(h => h.innerText.replace(/\s+/g, ' ')).find(h => /Quarter 1/i.test(h)) || ''; };
      const rec = j => A.computeGrade(A.qSec(s, 1), j).rounded; const j0 = a.final.findIndex((f, j) => f != null && rec(j) != null); const j1 = a.final.findIndex((f, j) => j > j0 && f != null && rec(j) != null);
      const keep = a.final[j0]; a.final[j0] = rec(j0) >= 50 ? rec(j0) - 7 : rec(j0) + 7;   // Focus's kept final differs from Tally's recount of the kept cells
      const out = { differ: { head: head(a.gb.students[j0]), kept: a.final[j0], rec: rec(j0) } }; a.final[j0] = keep;
      a.final[j1] = rec(j1); out.same = { head: head(a.gb.students[j1]), rec: rec(j1) }; a.final[j1] = null; out.none = { head: head(a.gb.students[j1]), rec: rec(j1) }; return out; }, K);
    const L = v => v >= 90 ? 'A' : v >= 80 ? 'B' : v >= 70 ? 'C' : v >= 60 ? 'D' : 'F';
    check(new RegExp(`· final · ${r.differ.kept}% ${L(r.differ.kept)} · Tally's recount ${r.differ.rec}% ${L(r.differ.rec)} ·`, 'i').test(r.differ.head), 'GRD-05: a closed quarter\'s heading shows the kept final, and Tally\'s recount beside it when it differs: ' + r.differ.head);
    check(new RegExp(`· final · ${r.same.rec}% `, 'i').test(r.same.head) && !/recount/i.test(r.same.head), 'GRD-05: when the two agree the heading shows one grade: ' + r.same.head);
    check(new RegExp(`· closed · Tally's recount ${r.none.rec}% `, 'i').test(r.none.head) && !/final/i.test(r.none.head), 'GRD-05: with no kept final the heading shows Tally\'s recount, labelled, and never says "final": ' + r.none.head);
    check(errs.length === 0, 'GRD-05: no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  // ---- WIF-03 (Croix's call): a 0-point (extra credit) column is never missing work ------------------------------------
  // ---- WIF-07 (Croix's call): an IXL column excused for the student does not block a retake ----------------------------
  {
    const { ctx, p, errs } = await cls(b);
    const r = await p.evaluate(async K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const gb = s.grades; const n = gb.students.length;
      const name = gb.students.find(x => A.retakeStatus(s, x).ok); const pl = q => q ? (q.top ? 'top' : q.plan.map(x => x.kind + ':' + (x.a ? x.a.name : '')).join()) : null; const i = gb.students.indexOf(name);
      const plan0 = pl(A.quickestPath(s, A.openSec(s), i, A.findStudent(s, name).ixl));
      const ec = { name: 'Puzzle Extra Credit', max: 0, values: Array(n).fill(null), status: Array(n).fill('blank'), missing: 1, excused: 0, assigned: gb.assignments[0].assigned, due: gb.assignments[0].due }; ec.status[i] = 'missing'; gb.assignments.unshift(ec);
      T.openProfile(K, name); await new Promise(r => setTimeout(r, 50)); const what = (document.querySelector('#pWhat') || {}).innerText || '';
      A.openShow(s, name); const showRow = !!document.querySelector('#show .shRow[data-n="Puzzle Extra Credit"]'); A.closeShow();
      const rt = A.retakeStatus(s, name); const plan1 = pl(A.quickestPath(s, A.openSec(s), i, A.findStudent(s, name).ixl));
      const ec0 = { why: A.retakeWhy(rt), ok: rt.ok, inWhatIf: what.includes('Puzzle Extra Credit'), showRow, samePlan: plan0 === plan1 }; gb.assignments.shift();
      // WIF-07, as the probe stages it: nothing missing, tests low, Unit 2 IXL excused for this student with Unit 2 skills short
      const u2 = T.unitsOf(s).find(u => u.short === 'Unit 2'); const col = gb.assignments.find(a => a.name === 'Unit 2 IXL');
      const j = gb.students.findIndex(x => { const f = A.findStudent(s, x); return f.ixl != null && A.points(s, u2, f.ixl) < col.max - 2; }); const nm = gb.students[j];
      gb.assignments.forEach(a => { if (a === col) { a.status[j] = 'excused'; a.values[j] = null; return; } if (/ixl/i.test(a.name)) { a.status[j] = 'score'; a.values[j] = a.max; return; } a.status[j] = 'score'; a.values[j] = A.isAssess(s, a) ? Math.round(a.max * 0.55) : a.max; });
      const rt2 = A.retakeStatus(s, nm); const q = A.quickestPath(s, A.openSec(s), j, A.findStudent(s, nm).ixl); const div = document.createElement('div'); div.innerHTML = A.quickestList(q);
      col.status[j] = 'blank'; const blank = A.retakeStatus(s, nm).ok;   // a blank cell is not excused: unchanged
      return { ec0, ex: { ok: rt2.ok, notYet: /isn't in Focus yet/.test(div.innerText), retakes: q.retakes.length, blank } }; }, K);
    check(r.ec0.ok, 'WIF-03: an NHI on a 0-point column does not block a retake ' + JSON.stringify(r.ec0));
    check(!r.ec0.inWhatIf && !r.ec0.showRow, `WIF-03: it is not offered as work to turn in, on the page's what-ifs or on Show student (${r.ec0.inWhatIf}, ${r.ec0.showRow})`);
    check(r.ec0.samePlan, 'WIF-03: the plan is unchanged');
    check(r.ex.ok && !r.ex.notYet && r.ex.retakes > 0, 'WIF-07: an excused IXL column does not block a retake and is never "isn\'t in Focus yet": ' + JSON.stringify(r.ex));
    check(r.ex.blank === false, 'WIF-07: a blank IXL cell (not excused) still counts, as before');
    check(errs.length === 0, 'WIF-03/07: no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  // ---- HLT-01: quickestPath works out each column's category once, not again in every computeGrade call ----------------
  // Counted, not timed: each computeGrade reads its gradebook once (counted on a copy of the class with a counting getter),
  // and every category lookup reads the class's grading settings (counted through a Proxy on state.grading).
  {
    const { ctx, p, errs } = await cls(b);
    const r = await p.evaluate(K => { const T = window.__tally, A = window.__all, sec = T.state.sections[K]; const o = A.openSec(sec); const nA = o.grades.assignments.length; const out = [];
      o.grades.students.forEach((n, i) => { let gr = 0, gd = 0; const s = { ...o }; const gb = o.grades; Object.defineProperty(s, 'grades', { get: () => { gr++; return gb; }, enumerable: true });
        const real = T.state.grading; T.state.grading = new Proxy(real, { get: (t, k) => { if (k === sec.prep) gd++; return t[k]; } });
        try { A.quickestPath(sec, s, i, A.findStudent(sec, n).ixl); } finally { T.state.grading = real; }
        out.push({ gr, gd }); });
      return { nA, out, worst: Math.max(...out.map(x => x.gd / (x.gr + nA))) }; }, K);
    check(r.worst < 3, `HLT-01: a plan looks up the categories about once per column, not once per column per what-if (worst ${r.worst.toFixed(1)} grading reads per gradebook read + column, ${r.nA} columns)`);
    check(errs.length === 0, 'HLT-01: no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  // ---- round 2, WIF-02 leftovers: the conference form and a blank-column plan step name the skills still needed ---------
  // ---- round 2, IXL-08 with WIF-05: an IXL-named column no unit claims is work to turn in on Show student and in the plan --
  {
    const { ctx, p, errs } = await cls(b);
    await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
    const r = await p.evaluate(K => { const T = window.__tally, A = window.__all, sec = T.state.sections[K]; const s = A.openSec(sec); const gb = s.grades; const i = 7; const name = gb.students[i]; const f = A.findStudent(sec, name);
      const t = gb.assignments.find(a => A.isAssess(s, a) && !/ixl/i.test(a.name) && a.max > 0 && a.status[i] === 'score'); t.values[i] = Math.round(t.max * 0.3);
      const rt = A.retakeStatus(sec, name); const conf = (A.conferenceWork(A.conferenceData(sec, name)).match(/Unit \d+: \d+ skills? left/g) || []);
      const ix = [...(rt.short.length ? [{ unit: rt.unit, n: rt.need, sh: rt.short.length }] : []), ...rt.behind.map(x => ({ unit: x.unit, n: x.need, sh: x.short.length }))];
      const col = gb.assignments.find(a => /\bixl\b/i.test(a.name) && /3/.test(a.name)); col.status[i] = 'blank'; col.values[i] = null; gb.assignments.filter(a => a.status[i] === 'missing').forEach(a => { a.status[i] = 'score'; a.values[i] = a.max; });
      const rt2 = A.retakeStatus(sec, name); const qp = A.quickestPath(sec, s, i, f.ixl); const req = qp && qp.plan ? qp.plan.filter(x => x.kind === 'ixlreq').map(x => x.n) : [];
      const want = rt2.short.length ? rt2.need : (rt2.behind[0] || {}).need;
      // IXL Diagnostic (no unit), Not Handed In for one eligible linked student
      const tm = gb.assignments.find(a => A.catIn(s, a) === 'Assessments' && /ixl/i.test(a.name)); const dg = JSON.parse(JSON.stringify(tm)); dg.name = 'IXL Diagnostic'; dg.max = 1; dg.values = gb.students.map(() => 1); dg.status = gb.students.map(() => 'score'); gb.assignments.push(dg);
      const j = gb.students.findIndex((n, k) => k !== i && A.findStudent(sec, n).ixl != null && A.retakeStatus(sec, n).ok); const nj = gb.students[j]; dg.values[j] = null; dg.status[j] = 'missing';
      gb.assignments.filter(a => A.isAssess(s, a) && !/ixl/i.test(a.name) && a.max > 0 && a.status[j] === 'score').forEach(a => { a.values[j] = Math.round(a.max * 0.5); });
      const q3 = A.quickestPath(sec, s, j, A.findStudent(sec, nj).ixl); const plan3 = q3 && q3.plan ? q3.plan.map(x => x.kind + ':' + x.a.name) : [];
      A.openShow(sec, nj); const rows = [...document.querySelectorAll('#show .shRow')].filter(x => x.dataset.n === 'IXL Diagnostic').map(x => x.dataset.k); A.closeShow();
      return { conf, ix, req, want, plan3, rows, why3: A.retakeWhy(A.retakeStatus(sec, nj), true) }; }, K);
    check(r.ix.length > 0 && r.ix.some(x => x.n < x.sh) && r.conf.length === r.ix.length && r.ix.every(x => r.conf.includes(`${x.unit.short}: ${x.n} skill${x.n === 1 ? '' : 's'} left`)), 'round 2: the conference form names the skills still needed for the retake: ' + JSON.stringify([r.conf, r.ix.map(x => x.n + '/' + x.sh)]));
    check(r.req.length === 1 && r.req[0] === r.want, `round 2: with the unit's IXL cell blank, the plan's required step names the same ${r.want} skills as the retake line (${JSON.stringify(r.req)})`);
    check(r.plan3.includes('nhi:IXL Diagnostic') && !r.plan3.some(x => /^ixl/.test(x) && /Diagnostic/.test(x)), 'round 2: an NHI "IXL Diagnostic" (no unit) is planned as work to turn in, not as IXL skills: ' + JSON.stringify(r.plan3));
    check(JSON.stringify(r.rows) === '["miss"]', 'round 2: on Show student it is one "Turn it in" row, as the retake line says ("' + r.why3 + '"): ' + JSON.stringify(r.rows));
    check(errs.length === 0, 'round 2 WIF-02/IXL-08: no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
