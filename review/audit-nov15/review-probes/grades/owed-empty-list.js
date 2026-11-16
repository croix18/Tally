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
  const { ctx, p, errs } = await openPage(b);
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const rows = A.gbRows(s);
    const i = rows.findIndex(r => r && r.ixl != null); const ix = rows[i].ixl; const col = gb.assignments.find(a => /Unit 2 IXL/.test(a.name)); const u = T.unitsOf(s).find(x => x.short === 'Unit 2');
    const skip = {}; u.active.forEach(k => skip[A.skillKey(s.skills[k])] = true); s.studentSkips[A.ixlKeyAt(s, ix)] = skip;   // every Unit 2 skill skipped for this student
    gb.assignments.forEach(a => { if (a.status[i] === 'missing') { a.status[i] = 'score'; a.values[i] = a.max; } }); col.status[i] = 'missing'; col.values[i] = null; T.save();
    const own = A.activeFor(s, u, ix).length; const ow = A.owedWork(s, A.openSec(s), i, ix); const rt = A.retakeStatus(s, gb.students[i]);
    const html = A.studentReportSection(s, i, rows[i]); const doc = new DOMParser().parseFromString(html, 'text/html'); const txt = doc.body.textContent.replace(/\s+/g, ' ');
    const cf = A.confData ? null : null;
    return { own, owed: ow.owed.map(a => a.name), earned: ow.earned.map(a => a.name), retakeOk: rt.ok, rt: { missing: rt.missing, short: rt.short.length, behind: rt.behind.map(x => x.unit.short + ":" + x.short.length), unit: rt.unit && rt.unit.short }, owedTxt: (txt.match(/IXL still owed.{0,400}/) || [""])[0], missingLine: (txt.match(/Still missing[^.]*\.[^.]*\./) || [''])[0], below: /below/.test(txt) ? (txt.match(/.{0,80}below.{0,40}/) || [''])[0] : '' }; }, K);
  console.log(JSON.stringify(r));
  check(!(r.own === 0 && r.owed.length && r.retakeOk), 'RPT-07 / retake rule agree for a student whose own Unit 2 list is empty (owedWork owes it while retakeStatus clears it)');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(1); });
