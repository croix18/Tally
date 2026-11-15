// PROBE TEMPLATE for the Tally deep audit (15 Nov 2026). Copy it, rename it probes/NN-slug.js, and replace the body.
//   Run:   TALLY_REPO=/home/claude/work/audit/<you>/repo node probes/NN-slug.js
//   Exit:  1 when the defect is present (a check fails), 0 when everything checked is right.
// It must run on ANY clean audit copy (the counter agent reruns it on its own), so use only window.__tally / window.__all,
// the repo's fixtures, and data you synthesize inside the script. No real student data, ever.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/ixl/repo';
const { chromium, fs, exe, check, done, pick, tmp, APP } = require(path.join(REPO, 'tests/lib.js'));   // lib.js chdirs into REPO
const K = '1205050-7T1A';   // the scrubbed real class in fixtures/ (16 counted students, accelerated)
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true /* , timezoneId: 'America/New_York' */ });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  // ---- one real (scrubbed) class: IXL Score Grid, then the Focus roster, then the Quarter 1 Focus gradebook ----
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  // (a Quarter 2 gradebook for the same class: fixtures/focus_gradebook_scrubbed_q2.csv, imported the same way)

  // ---- IXL-08: a Focus column named IXL that no unit claims (e.g. "IXL Diagnostic") is neither missing work nor IXL to finish ----
  const pre = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); });
    return s.grades.students.filter(n => A.retakeStatus(s, n).ok); }, K);
  // the same Focus export with one more column: "IXL Diagnostic", 10 points, Not Handed In for everyone (synthetic)
  const csvRows = (t => { const rows = []; let row = [], f = '', q = false; for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c !== '\r') f += c; } if (f || row.length) { row.push(f); rows.push(row); } return rows; })(fs.readFileSync('fixtures/focus_gradebook_scrubbed.csv', 'utf8'));
  const ci = csvRows[0].findIndex(h => /^Unit 2 IXL/.test(h)); const head = csvRows[0][ci].replace('Unit 2 IXL', 'IXL Diagnostic').replace(/\d+ Points/, '10 Points');
  const out2 = csvRows.map((r, j) => { const c = r.slice(); c.splice(ci + 1, 0, j === 0 ? head : (r[2] ? 'NHI Not Handed In' : '')); return c.map(v => '"' + v.replace(/"/g, '""') + '"').join(','); }).join('\n');
  const f2 = require('path').join(tmp, 'focus_gradebook_scrubbed.csv'); fs.writeFileSync(f2, out2);
  await p.setInputFiles('#file', [f2]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(800);
  const out = await p.evaluate(({ K, pre }) => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; document.querySelectorAll('#modal').forEach(m => { if (m._cancel) m._cancel(); });
    const a = s.grades.assignments.find(x => x.name === 'IXL Diagnostic');
    const still = pre.filter(n => A.retakeStatus(s, n).ok);
    return { has: !!a, st: a ? a.status.filter(x => x === 'missing').length : -1, pre: pre.length, still: still.length, unit: a ? A.gbUnitFor(s, a) : 'x' }; }, { K, pre });
  console.log('OBSERVED:', `Focus column "IXL Diagnostic" imported: ${out.has} (NHI for ${out.st} students, mapped to unit: ${JSON.stringify(out.unit && out.unit.name)}); students called retake-eligible: ${out.pre} before, ${out.still} after`);
  console.log('EXPECTED:', `0 eligible after: each now has a Not Handed In assignment (README "Retakes": a student may retake when nothing is missing)`);
  check(out.has && out.st > 0, 'the column was read');
  check(out.still === 0, 'an NHI in an IXL-named column with no unit still blocks a retake');
  await b.close(); done();   // done() sets the exit code: 1 if any check failed
})().catch(e => { console.error(e); process.exit(2); });
