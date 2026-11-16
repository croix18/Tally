// The audit of 15 Nov 2026, the pages that go home (fixer RPT): one check per finding in the weekly report, its print
// layout, the Reports page and Remove a print, each written to fail on the code before its fix.
const { chromium, fs, path, exe, check, done, pick, tmp, APP } = require(require('path').join(process.env.TALLY_REPO, 'tests/lib.js'));
const K = '1205050-7T1A';
async function openPage(b, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true, timezoneId: 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  if (opts.now) await p.addInitScript(t => { const R = Date; let off = t - R.now(); window.__setNow = x => { off = x - R.now(); }; class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } } window.Date = D; }, opts.now);
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  return { ctx, p, errs };
}
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const all = [];
  for (const setup of ['plain', 'ownSkip', 'courseSkip', 'focusAbove', 'extraCredit']) {
    const { ctx, p, errs } = await openPage(b);
    const r = await p.evaluate(([K, setup]) => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const rows = A.gbRows(s);
      const col = gb.assignments.find(a => /Unit 2 IXL/.test(a.name)); const u0 = T.unitsOf(s).find(x => x.short === 'Unit 2');
      const pupils = rows.map((r, i) => r && r.ixl != null ? i : -1).filter(i => i >= 0);
      if (setup === 'courseSkip') u0.active.slice(0, 2).forEach(k => s.excluded[A.skillKey(s.skills[k])] = true);
      pupils.forEach((i, n) => { const ix = rows[i].ixl;
        if (setup === 'ownSkip' && n % 2 === 0) { const sk = {}; u0.active.slice(0, 6).forEach(k => sk[A.skillKey(s.skills[k])] = true); s.studentSkips[A.ixlKeyAt(s, ix)] = sk; }
        if (setup === 'focusAbove' && n % 2 === 0) { const sk = {}; u0.active.slice(0, 6).forEach(k => sk[A.skillKey(s.skills[k])] = true); s.studentSkips[A.ixlKeyAt(s, ix)] = sk; col.status[i] = 'score'; col.values[i] = Math.min(col.max, 14); }
        if (n % 3 === 1 && col.status[i] !== 'missing') { col.status[i] = 'missing'; col.values[i] = null; } });
      if (setup === 'extraCredit') gb.assignments.push({ name: 'Bonus Puzzle', max: 0, due: '10/01', values: gb.students.map((_, i) => i % 2 ? 3 : null), status: gb.students.map((_, i) => i % 2 ? 'score' : 'blank'), missing: 0, excused: 0 });
      T.save(); T.render();
      const out = [];
      pupils.forEach(i => { const html = A.studentReportSection(s, i, rows[i]); const txt = new DOMParser().parseFromString(html, 'text/html').body.textContent.replace(/\s+/g, ' ');
        const m = txt.match(/this quarter's IXL finished \(([^)]*)\)[^→]*→ (\d+)% ?([A-F])?/i); if (!m) return;
        // the oracle: really finish the student's own list in a copy, then let Tally's own copy logic say what goes in Focus
        const c = JSON.parse(JSON.stringify(s)); const ix = rows[i].ixl; const units = T.unitsOf(c).filter(u => u.assigned && u.total && !A.unitClosed(c, u));
        units.forEach(u => A.activeFor(c, u, ix).forEach(k => { c.scores[k][ix] = 100; if (c.best && c.best[k]) c.best[k][ix] = 100; }));
        const oc = A.openSec(c); const pend = {}; A.pendingCopies(c, oc, i, ix).forEach(x => pend[x.a.name] = x.to);
        const allIn = {}; oc.grades.assignments.forEach(a => { if (a.status[i] === 'missing' && !/\bixl\b/i.test(a.name) && a.max > 0) allIn[a.name] = a.max; });
        const lead = txt.slice(Math.max(0, m.index - 60), m.index);
        const withWork = /turned in and|made up and|Both|All \d/.test(lead);
        const g = A.computeGrade(oc, i, { ...pend, ...(withWork ? allIn : {}) });
        out.push({ i, printed: Number(m[2]), oracle: g && g.rounded, withWork, own: A.activeFor(s, u0, ix).length, colMax: col.max, focus: col.status[i] === 'missing' ? 'NHI' : col.values[i] }); });
      return out; }, [K, setup]);
    const bad = r.filter(x => x.printed !== x.oracle);
    console.log(setup, `${r.length} students recounted; ${bad.length} differ`, JSON.stringify(bad.slice(0, 4)));
    all.push(...bad.map(x => ({ setup, ...x }))); if (errs.length) console.log('errs', errs.join(' | ')); await ctx.close();
  }
  check(!all.length, 'RPT-08: "this quarter\'s IXL finished" equals the grade after really finishing the own list');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(1); });
