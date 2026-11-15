// Shared helpers for auditor IXL's probes: synthetic IXL Score Grid CSVs and a fresh page.
const path = require('path'); const os = require('os');
module.exports = (REPO) => {
  const L = require(path.join(REPO, 'tests/lib.js')); const fs = L.fs;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ixl-audit-'));
  // students: ['FIRST LAST', ...]; skills: [{ unit, lesson, name, id, scores: [..per student, null = blank] }]
  const grid = (date, students, skills, cls = '1205050-7T5A', acc = true) => {
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [['Unit', '', 'Skill name', 'Permanent Skill ID', ...students].map(q).join(',')];
    skills.forEach(s => lines.push([q(s.unit), q(s.lesson || 'Lesson 1.1 L'), q(s.name), s.id, ...s.scores.map(v => v == null ? '' : v)].join(',')));
    const name = `IXL-Score-Grid_${date}_This-School-Year_${cls}-M_J-${acc ? 'ACC' : 'GR7'}_Math-Nation-FL-B.E.S.T.-${acc ? 'Accelerated-' : ''}7th-Grade_Math.csv`;
    const f = path.join(dir, Math.random().toString(36).slice(2, 7), name); fs.mkdirSync(path.dirname(f)); fs.writeFileSync(f, lines.join('\n')); return f; };
  const open = async () => { const b = await L.chromium.launch({ executablePath: L.exe }); const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, timezoneId: 'America/New_York' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept()); await p.goto('file://' + path.resolve(L.APP)); return { b, p, errs }; };
  const imp = async (p, files) => { await p.setInputFiles('#file', [].concat(files)); await p.waitForTimeout(700); };
  return { ...L, grid, open, imp, dir };
};
