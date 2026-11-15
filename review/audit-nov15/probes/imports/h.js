// Shared helpers for the IMP probes (synthetic data only). Loads the test build and drives importFiles() directly
// with in-page File objects, answering Tally's own dialogs by a policy (default: OK / "Replace" on every ask).
const path = require('path');
const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const lib = require(path.join(REPO, 'tests/lib.js'));   // chdirs into REPO
const { chromium, fs, exe, APP } = lib;
async function open(opts = {}) {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, timezoneId: 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const asked = []; p.on('dialog', d => { asked.push(d.message().slice(0, 160)); (opts.no ? d.dismiss() : d.accept()); });
  await p.goto('file://' + path.resolve(APP));
  await p.evaluate(() => { window.__asked = []; });
  return { b, ctx, p, errs, asked };
}
// files: [{ name, text } | { name, b64 } | { name, fixture }], lastModified optional (ms)
function payload(files) { return files.map(f => ({ name: f.name || path.basename(f.fixture), lastModified: f.lastModified || Date.parse('2026-11-13T15:00:00Z'),
  b64: f.b64 || (f.fixture ? fs.readFileSync(path.join(REPO, 'fixtures', f.fixture)).toString('base64') : Buffer.from(f.text, 'utf8').toString('base64')) })); }
// answer: 'yes' | 'no' for asks; pick: a section key / '__new__' / null for "Which class"; nc: {period, prep} for New class
async function imp(p, files, ans = {}) {
  return p.evaluate(async ({ files, ans }) => {
    const A = window.__all; const answers = [];
    const tick = setInterval(() => {
      const y = document.querySelector('#askYes'), n = document.querySelector('#askNo');
      if (y) { answers.push('ask:' + (document.querySelector('#askMsg') || {}).textContent.slice(0, 160)); (ans.ask === 'no' ? n : y).click(); }
      const m = document.querySelector('#modal:not(.hidden)'); if (!m) return;
      if (m.querySelector('#ncMake')) { answers.push('newClass'); const fn = (m.querySelector('b') || {}).textContent || ''; const nc = ans.nc && (ans.nc[fn] || (ans.nc.period ? ans.nc : null)); if (!nc) { m.querySelector('#mCancel').click(); return; }
        m.querySelector(`#ncPeriod [data-p="${nc.period}"]`).click(); m.querySelector(`#ncPrep [data-prep="${nc.prep}"]`).click(); m.querySelector('#ncMake').click(); return; }
      if (m.querySelector('.picks')) { answers.push('pick:' + ((m.querySelector('#pickWhy') || {}).textContent || '')); const b = ans.pick ? m.querySelector(`[data-sec="${ans.pick}"]`) : null; (b || m.querySelector('#mCancel')).click(); return; }
      if (m.querySelector('#askApply')) { answers.push('categories'); m.querySelector('#askApply').click(); return; }
      if (m.querySelector('#mCancel') && !m.__seen) { m.__seen = 1; answers.push('modal:' + m.textContent.slice(0, 120)); }
    }, 30);
    const fl = files.map(f => { const bin = atob(f.b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new File([u8], f.name, { lastModified: f.lastModified }); });
    window.confirm = () => { answers.push('confirm'); return ans.ask !== 'no'; };
    try { await Promise.race([A.importFiles(fl), new Promise((_, rj) => setTimeout(() => rj(new Error('importFiles hung: ' + answers.join(';') + ' modal=' + ((document.querySelector('#modal:not(.hidden)') || {}).textContent || '').slice(0, 200))), 20000))]); } finally { clearInterval(tick); }
    const st = window.__tally.state; return { answers, last: st.lastImport, order: st.order.slice() };
  }, { files: payload(files), ans });
}
// A canonical view of the state for comparison: per class, students and their scores by skill key, plus gradebook placement
async function canon(p) {
  return p.evaluate(() => { const st = window.__tally.state; const A = window.__all; const out = {};
    for (const k of st.order) { const s = st.sections[k]; const g = s.grades || {};
      const pts = {}; try { A.unitsOf(s).forEach(u => { pts[u.name || u.short] = (s.students || []).map((n, si) => A.points(s, u, si)).join(','); }); } catch (e) { pts.err = e.message; }
      out[k] = { label: s.label, prep: s.prep, pool: !!s.pool, fromSection: !!s.fromSection, date: s.date, students: (s.students || []).join('|'), nSkills: (s.skills || []).length,
        scores: JSON.stringify(s.scores || []).length, gb: (g.students || []).length + ':' + (g.assignments || []).map(a => a.name).join('|') + ':' + (g.file || ''), roster: String(s.roster || '').split('\n').length, pts }; }
    return { order: st.order.slice(), pools: Object.fromEntries(Object.entries(st.pools || {}).sort().filter(([, v]) => v).map(([k, v]) => [k, v.date + ':' + v.students.length + ':' + v.file])), secs: out }; });
}
const report = (obs, exp, ok) => { console.log('OBSERVED:', obs); console.log('EXPECTED:', exp); lib.check(ok, 'defect absent'); };
module.exports = { ...lib, REPO, open, imp, canon, payload, report };
