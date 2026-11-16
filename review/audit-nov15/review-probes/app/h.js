const { chromium, fs, path, exe, check, done, pick, tmp, APP } = require('../tests/lib');
const DAY = Date.parse('2026-11-13T15:00:00Z');
const enc = t => Buffer.from(t, 'utf8').toString('base64');
async function open() {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, timezoneId: 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(300);
  return { b, p, errs };
}
// Drives importFiles() with in-page files and answers Tally's dialogs: ans.ask 'yes'/'no', ans.nc {period, prep} for "New class".
async function imp(p, files, ans = {}) {
  return p.evaluate(async ({ files, ans }) => {
    const A = window.__all; const answers = [];
    const tick = setInterval(() => {
      const y = document.querySelector('#askYes'), n = document.querySelector('#askNo');
      if (y) { answers.push('ask:' + ((document.querySelector('#askMsg') || {}).textContent || '')); (ans.ask === 'no' ? n : y).click(); }
      const m = document.querySelector('#modal:not(.hidden)'); if (!m) return;
      if (m.querySelector('#ncMake')) { answers.push('newClass'); if (!ans.nc) { m.querySelector('#mCancel').click(); return; }
        m.querySelector(`#ncPeriod [data-p="${ans.nc.period}"]`).click(); m.querySelector(`#ncPrep [data-prep="${ans.nc.prep}"]`).click(); m.querySelector('#ncMake').click(); return; }
      if (m.querySelector('.picks')) { answers.push('pick'); m.querySelector('#mCancel').click(); return; }
      if (m.querySelector('#askApply')) { answers.push('categories'); m.querySelector('#askApply').click(); }
    }, 30);
    const fl = files.map(f => { const bin = atob(f.b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new File([u8], f.name, { lastModified: f.lastModified }); });
    try { await A.importFiles(fl); } finally { clearInterval(tick); }
    return { answers, last: window.__tally.state.lastImport };
  }, { files: files.map(f => ({ name: f.name, lastModified: f.lastModified || DAY, b64: enc(f.text) })), ans });
}
const skillRows = (n, unit = 'Unit 1 Ratios') => Array.from({ length: n }, (_, k) => `"${unit}","Lesson 1.${k + 1}","Skill ${k + 1}",S${k + 1}X`);
const grid = (names, skills, score) => 'Unit,,Skill name,Permanent Skill ID,' + names.map(n => `"${n}"`).join(',') + '\n' + skills.map((s, k) => s + ',' + names.map((n, i) => score(n, i, k)).join(',')).join('\n') + '\n';
const POOL = d => `IXL-Score-Grid_${d}_This-School-Year_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv`;
const flip = n => { const t = n.split(' '); return t.slice(1).join(' ') + ', ' + t[0]; };
const gbFile = (rows, id0) => '"Student","Student ID","Unit 1 Quiz (10 pts)"\n' + rows.map((n, i) => `"${n}","${id0 + i}","8"`).join('\n') + '\n';
// Pick a pool student for a roster line with the roster fixer, as the teacher does.
const fix = (p, key, disp, want) => p.evaluate(async ({ key, disp, want }) => { const A = window.__all, s = window.__tally.state.sections[key];
  A.openFixer(s, disp); await new Promise(r => setTimeout(r, 100)); const btn = document.querySelector(`#modal [data-pick="@pool:${want}"]`);
  if (btn) btn.click(); else { const c = document.querySelector('#mCancel'); if (c) c.click(); } await new Promise(r => setTimeout(r, 100)); return !!btn; }, { key, disp, want });
const scoreOf = (p, key, disp) => p.evaluate(({ key, disp }) => { const A = window.__all, s = window.__tally.state.sections[key]; const r = A.buildRows(s).find(x => x.display === disp);
  return !r ? 'none' : r.ixl == null || r.status !== 'ok' ? r.status : s.scores[0][r.ixl]; }, { key, disp });
module.exports = { chromium, fs, path, exe, check, done, pick, tmp, APP, DAY, enc, open, imp, skillRows, grid, POOL, flip, gbFile, fix, scoreOf };
