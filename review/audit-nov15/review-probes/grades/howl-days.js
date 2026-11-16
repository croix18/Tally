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
  const hw = await openPage(b, { now: Date.parse('2026-11-16T12:00:00-05:00') });
  const days = []; for (let t = Date.parse('2026-11-09T12:00:00Z'); t <= Date.parse('2027-04-09T12:00:00Z'); t += 864e5) days.push(new Date(t).toISOString().slice(0, 10));
  const out = await hw.p.evaluate(([K, days]) => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const rows = A.gbRows(s);
    const i = rows.findIndex(r => r && r.ixl != null); const ix = rows[i].ixl;
    gb.assignments.forEach(a => { if (a.status[i] === 'missing' || a.status[i] === 'excused') { a.status[i] = 'score'; a.values[i] = a.max; } }); s.skills.forEach((_, k) => { s.scores[k][ix] = 95; });
    const q = gb.assignments.find(a => /Squares and Cubes Quiz/.test(a.name)); q.status[i] = 'score'; q.values[i] = Math.round(q.max * 0.5); T.save();
    const NS = A.NO_SCHOOL || []; const school = d => !NS.some(([a, b]) => d >= a && d <= b);
    const bad = []; const seen = {};
    for (const d of days) { for (const hh of ['07:30', '12:00', '21:30']) { window.__setNow(new Date(d + 'T' + hh + ':00-0' + (d >= '2027-03-14' ? 4 : 5) + ':00').getTime());
      const bs = [...new DOMParser().parseFromString(A.studentReportSection(s, i, rows[i]), 'text/html').querySelectorAll('.howl p:first-child > b')].slice(1).map(x => x.textContent);
      // parse "Wednesday, Nov 18" into a date after d
      const toISO = txt => { const m = txt.match(/^(\w+), (\w+) (\d+)$/); if (!m) return null; const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(m[2]); let y = Number(d.slice(0, 4)); if (mo + 1 < Number(d.slice(5, 7))) y++; return { wd: m[1], iso: `${y}-${String(mo + 1).padStart(2, '0')}-${m[3].padStart(2, '0')}` }; };
      const [w, th] = bs.map(toISO);
      const ok = w && th && w.wd === 'Wednesday' && th.wd === 'Thursday' && school(w.iso) && school(th.iso) && w.iso >= d && (Date.parse(th.iso) - Date.parse(w.iso)) === 864e5;
      // the first such week: no earlier Wednesday on or after d (and not past) that is a school day with its Thursday
      let first = true; for (let x = Date.parse(d + 'T12:00:00Z'); w && x < Date.parse(w.iso + 'T12:00:00Z'); x += 864e5) { const di = new Date(x); const iso = di.toISOString().slice(0, 10); const nx = new Date(x + 864e5).toISOString().slice(0, 10); if (di.getUTCDay() === 3 && school(iso) && school(nx)) first = false; }
      if (!ok || !first) bad.push(d + ' ' + hh + ': ' + bs.join(' / ') + (ok ? ' (a nearer week was free)' : ''));
      seen[bs.join(' / ')] = 1; } }
    return { n: days.length, bad: bad.slice(0, 12), nBad: bad.length, ns: JSON.stringify(NS), sample: Object.keys(seen).slice(0, 40) }; }, [K, days]);
  console.log(JSON.stringify(out));
  check(out.nBad === 0, 'RPT-09: every print day from Nov 9 to Apr 9 names the first Wednesday and Thursday that are both school days');
  check(!hw.errs.length, 'no page errors ' + hw.errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(1); });
