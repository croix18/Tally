// WIF-01 beyond the suite: (A) gradebooks with no ID columns, (B) one of the pair leaves (the other's name loses its
// mark), (C) a Full-save-style reload, (D) mergeArchive's merge path with the rows in another order.
// Each twin's open-quarter book, kept Quarter 1 book and final must be their own row.
const path = require('path'); const repo = path.resolve(process.env.TALLY_REPO || '.'); process.chdir(repo);
const { chromium, fs, exe, pick, check, done, tmp, APP } = require(path.join(repo, 'tests/lib'));
const K = '1205050-7T1A';
const read = p => p.evaluate(K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const gb = s.grades; const arch = s.qArchive && s.qArchive[1]; const out = [];
  gb.students.forEach((n, i) => { if (!/^SUTTER, HAYDEN SKYLER/.test(n)) return; const id = (gb.ids || [])[i];
    // the oracle: the kept row with the same ID; with no IDs, the kept row whose Q1 grade the source file gave this row (window.__q1)
    const ai = arch ? (id ? arch.gb.ids.findIndex(x => String(x).trim() === String(id).trim()) : arch.gb.students.indexOf(n)) : -1;
    const books = A.studentBooks(s, n); const ob = books.find(x => !x.closed), cb = books.find(x => x.q === 1); const fin = A.studentSummary(s, n).finals.find(x => x.q === 1);
    out.push({ n, i, id, ai, openRow: ob ? ob.i : null, keptRow: cb ? cb.i : null, fin: fin ? fin.g : null, archFin: ai >= 0 ? arch.final[ai] : null, own: A.computeGrade(A.openSec(s), i).rounded, now: A.studentSummary(s, n).r ? A.studentSummary(s, n).r.rounded : null }); });
  return out; }, K);
const verdict = (tag, o) => { console.log(tag, JSON.stringify(o)); check(o.length >= 1, tag + ': twins present');
  o.forEach(x => { check(x.openRow === x.i, `${tag} ${x.n}: open book is own row`); check(x.keptRow === (x.ai >= 0 ? x.ai : null), `${tag} ${x.n}: kept Q1 book is own row (${x.keptRow} vs ${x.ai})`); check(x.fin === x.archFin, `${tag} ${x.n}: Q1 final is own (${x.fin} vs ${x.archFin})`); }); };
async function page(b) { const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'America/New_York' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept()); await p.goto('file://' + path.resolve(APP)); return { ctx, p, errs }; }
async function load(p, files) {
  await p.setInputFiles('#file', [path.resolve('fixtures', fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed')))]); await p.waitForTimeout(500);
  const ros = fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8').split('\n'); ros[1] = ros[0]; await p.fill('#rpText', ros.join('\n')); await p.click('#rpSave'); await p.waitForTimeout(300);
  for (const f of files) { await p.setInputFiles('#file', [f]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600); } }
const ros = fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8').split('\n'); const n0 = ros[0], n1 = ros[1];
const twin = (f, opt) => { let t = fs.readFileSync(path.join('fixtures', f), 'utf8'); let lines = t.split('\n');
  if (opt.leave) lines = lines.filter(l => !l.includes('"' + n1 + '"'));
  t = lines.join('\n').split('"' + n1 + '"').join('"' + n0 + '"');
  if (opt.noIds) { lines = t.split('\n'); lines[0] = lines[0].replace(/^"Student ID","Local ID",/, ''); lines = lines.map(l => /^"\d+","[^"]*",/.test(l) ? l.replace(/^"\d+","[^"]*",/, '') : l); t = lines.join('\n'); }
  const out = path.join(tmp, 'rv-' + (opt.noIds ? 'noid-' : '') + (opt.leave ? 'leave-' : '') + f); fs.writeFileSync(out, t); return out; };
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  { const { ctx, p, errs } = await page(b); await load(p, [twin('focus_gradebook_scrubbed.csv', { noIds: true }), twin('focus_gradebook_scrubbed_q2.csv', { noIds: true })]);
    const ids = await p.evaluate(K => (window.__tally.state.sections[K].grades.ids || []).filter(Boolean).length, K); check(ids === 0, 'A: the gradebook has no IDs');
    const st = () => p.evaluate(K => { const s = window.__tally.state.sections[K]; const g = s.grades; const a = s.qArchive && s.qArchive[1]; return { n: g.assignments.length, s01: g.students.slice(0, 2), q: window.__all.gbQuarter(g), arch: a ? { n: a.gb.assignments.length, s01: a.gb.students.slice(0, 2), f: a.final.slice(0, 2) } : null }; }, K);
    console.log('A state', JSON.stringify(await st())); verdict('A no IDs', await read(p)); console.log('save()', await p.evaluate(() => window.__tally.save()), await p.evaluate(() => (localStorage.getItem(Object.keys(localStorage)[0]) || '').length)); await p.reload(); await p.waitForTimeout(800); console.log('A state after reload', JSON.stringify(await st())); verdict('A no IDs, reloaded', await read(p)); check(!errs.length, 'A: no page errors ' + errs.join('|')); await ctx.close(); }
  { const { ctx, p, errs } = await page(b); await load(p, [twin('focus_gradebook_scrubbed.csv', {}), twin('focus_gradebook_scrubbed_q2.csv', {})]);
    verdict('B before', await read(p));
    await p.setInputFiles('#file', [twin('focus_gradebook_scrubbed_q2.csv', { leave: true })]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
    const o = await read(p); verdict('B one left', o); check(o.length === 1 && !/\(ID/.test(o[0].n), 'B: the one who stayed lost the mark');
    // D: merge path: drop one kept column so a re-import merges, with the twins' rows swapped in the source
    await p.evaluate(K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const a = s.qArchive[1]; a.gb.assignments.push({ ...JSON.parse(JSON.stringify(a.gb.assignments[0])), name: 'Old kept only' }); T.save(); }, K);
    await p.setInputFiles('#file', [twin('focus_gradebook_scrubbed.csv', {})]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
    await p.setInputFiles('#file', [twin('focus_gradebook_scrubbed_q2.csv', {})]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
    verdict('D after merge + both back', await read(p));
    check(!errs.length, 'B/D: no page errors ' + errs.join('|')); await ctx.close(); }
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
