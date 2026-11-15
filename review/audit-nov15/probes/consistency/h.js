// Shared harness for CON probes: scenario setup + surface scrapers. Uses only __tally/__all, fixtures, synthetic data.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/consistency/repo';
const L = require(path.join(REPO, 'tests/lib.js'));
const { chromium, fs, exe, pick, APP } = L;
const K = '1205050-7T1A';
async function open(opts) {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true, timezoneId: 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(() => { window.__prints = []; window.open = () => { let buf = ''; const w = { document: { open() { buf = ''; }, write(h) { buf += h; }, close() { window.__prints.push(buf); } }, focus() {}, print() {}, close() {}, location: {} }; return w; }; });
  await p.goto('file://' + path.resolve(APP));
  return { b, ctx, p, errs };
}
async function scenarioA(p) {
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
}
async function importGb(p, file) { await p.setInputFiles('#file', [path.resolve(file)]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(700); if (await p.$('#modal:not(.hidden) #askApply')) { await p.click('#askApply'); await p.waitForTimeout(400); } }
// close a quarter the way the Quarters dialog does, with its pre-ticked units
async function closeQ(p, n) { await p.evaluate(() => { const b = document.querySelector('#btnHome'); if (b) b.click(); }); await p.waitForTimeout(200); await p.click('#homeQuarters'); await p.waitForTimeout(400);
  const r = await p.evaluate(n => { const m = document.querySelector('#modal'); const bs = [...m.querySelectorAll('button')]; const b = bs.find(x => new RegExp('^Close Quarter ' + n).test(x.innerText.trim())); if (b) b.click(); return bs.map(x => x.id + ':' + x.innerText.trim()).join(' | '); }, n); await p.waitForTimeout(500);
  const b2 = await p.evaluate(n => { const m = document.querySelector('#modal'); if (!m || m.classList.contains('hidden')) return 'closed'; const bs = [...m.querySelectorAll('button')]; const b = bs.find(x => /^Close( Quarter \\d)?$|^Close it|^Close Q/.test(x.innerText.trim()) && x.id !== 'mClose'); if (b) b.click(); return bs.map(x => x.id + ':' + x.innerText.trim()).join(' | '); }, n); await p.waitForTimeout(500); return r + ' || ' + b2; }
const txt = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); return e ? e.innerText : null; }, sel);
const clk = async (p, sel, w) => { await p.click(sel); await p.waitForTimeout(w || 350); };
const prints = p => p.evaluate(() => { const out = window.__prints.map(h => { const d = new DOMParser().parseFromString(h, 'text/html'); d.querySelectorAll('script,style').forEach(x => x.remove()); return d.body ? d.body.innerText || d.body.textContent : ''; }); window.__prints = []; return out; });
module.exports = { ...L, REPO, K, open, scenarioA, importGb, closeQ, txt, clk, prints };
// ---------- the scrape: every surface that states a student's or a class's numbers, plus an independent recount ----------
// Runs entirely in the page (synchronous renders), returns { classes: { key: { oracle, surfaces } } }.
function scrapeAll(opts) {
  const T = window.__tally, A = window.__all; const o = opts || {};
  const num = t => { const m = /(-?\d+(?:\.\d+)?)/.exec(t || ''); return m ? Number(m[1]) : null; };
  const out = {};
  const click = sel => { const e = document.querySelector(sel); if (e) e.click(); return !!e; };
  for (const key of T.state.order) {
    const s = T.state.sections[key]; const C = out[key] = { label: s.label, prep: s.prep, stu: {}, cls: {} };
    // ---- oracle: from raw state, written from GRADES_SPEC §1 and README "How it counts" ----
    const os = s.grades ? T.openSec(s) : null; const gb = os && os.grades;
    const g = A.gradingFor(s.prep); const cats = (os && os._cats) || g.cats;
    const oGrade = i => { const acc = {}; cats.forEach(c => acc[c.name] = { e: 0, p: 0, w: c.w });
      gb.assignments.forEach(a => { const cat = A.catIn(os, a); const st = a.status ? a.status[i] : (a.values[i] == null ? 'blank' : 'score');
        const ec = A.isExtraCredit(os, g, a); if (ec) { if (st === 'score' && a.values[i] > 0) (acc[cat] = acc[cat] || { e: 0, p: 0, w: 0 }).e += a.values[i]; return; }
        if (!(a.max > 0)) return; if (st !== 'score' && st !== 'missing') return; const c = acc[cat] = acc[cat] || { e: 0, p: 0, w: 0 }; c.e += st === 'missing' ? 0 : (+a.values[i] || 0); c.p += a.max; });
      let tw = 0, t = 0; for (const k in acc) if (acc[k].p > 0) { tw += acc[k].w; t += acc[k].w * acc[k].e / acc[k].p * 100; }
      if (!tw) return null; const x = t / tw; const r = Math.floor(x + 0.5 + 1e-9); return { x, r, L: r >= 90 ? 'A' : r >= 80 ? 'B' : r >= 70 ? 'C' : r >= 60 ? 'D' : 'F' }; };
    const thr = s.threshold; const units = T.unitsOf(s).filter(u => u.assigned && u.total);
    const openU = units.filter(u => !T.unitClosed(s, u)); const basis = openU.length ? openU : units;
    const rows = T.gbRows ? T.gbRows(s) : [];
    if (gb) gb.students.forEach((name, i) => { const og = gb.assignments.length ? oGrade(i) : null; const row = rows[i]; const si = row && row.ixl != null ? row.ixl : null;
      let done = null, poss = null; if (si != null) { done = 0; poss = 0; basis.forEach(u => T.activeFor(s, u, si).forEach(k => { poss++; const v = T.eff(s, k, si); if (v != null && v >= thr) done++; })); }
      C.stu[name] = { i, si, oracle: { grade: og ? og.r : null, raw: og ? +og.x.toFixed(4) : null, L: og ? og.L : '', missing: gb.assignments.filter(a => a.status && a.status[i] === 'missing').length, ixlDone: done, ixlPoss: poss, ixlPct: poss ? Math.round(done / poss * 100) : null }, s: {} }; });
    const gl = gb ? Object.values(C.stu).map(x => x.oracle.grade).filter(v => v != null) : [];
    C.cls.oracle = { n: gl.length, avg: gl.length ? Math.round(gl.reduce((a, b) => a + b, 0) / gl.length + 1e-9) : null, avgRaw: gl.length ? gl.reduce((a, b) => a + b, 0) / gl.length : null,
      letters: ['A', 'B', 'C', 'D', 'F'].map(L => Object.values(C.stu).filter(x => x.oracle.L === L).length).join(' '), missing: Object.values(C.stu).reduce((a, x) => a + x.oracle.missing, 0), missingStudents: Object.values(C.stu).filter(x => x.oracle.missing).length, pop: T.population(s).length };
    if (!gb) continue;
    T.state.active = key; T.save();
    // ---- Grades screen ----
    try { click('#btnHome'); const hb = document.querySelector(`[data-go="${CSS.escape(key)}"].hcard`); if (hb) hb.click(); click('#openGrades');
      const cards = [...document.querySelectorAll('.grades .gcards .gcard')].map(c => c.innerText.replace(/\s+/g, ' ').trim()); C.cls.grades = { cards, notice: [...document.querySelectorAll('.grades .notice')].map(n => n.innerText.replace(/\s+/g, ' ')).join(' | '), catTable: [...document.querySelectorAll('.grades .gtwo .checkTable tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')), asgMissingSum: [...document.querySelectorAll('table.gasg tbody tr')].reduce((a, r) => a + (num(r.children[5].innerText) || 0), 0), scatter: (document.querySelector('.gsec .ghint') || {}).innerText };
      document.querySelectorAll('table.gstu tr[data-stu]').forEach(tr => { const i = +tr.dataset.stu; const name = gb.students[i]; const td = tr.children; if (!C.stu[name]) return;
        C.stu[name].s.grades = { grade: num(td[1].innerText), L: (/[A-F]/.exec(td[1].innerText) || [''])[0], missing: num(td[3].innerText) || 0, ixl: /not matched/.test(td[5].innerText) ? null : num(td[5].innerText), since: td[2].innerText.trim() }; });
    } catch (e) { C.err = (C.err || '') + ' grades:' + e.message; }
    // ---- Students list (this class) ----
    try { click('#openStudents'); C.cls.students = { bar: document.querySelector('#bar').innerText.replace(/\s+/g, ' '), rows: document.querySelectorAll('tr[data-open]').length };
      document.querySelectorAll('tr[data-open]').forEach(tr => { const name = tr.dataset.name; const gi = gb.students.indexOf(name); const td = [...tr.children]; const nm = gi >= 0 ? gb.students[gi] : name; const ix = tr.querySelector('[data-l="IXL"]').innerText;
        const rec = { grade: num(tr.querySelector('.sGr').innerText), L: (/[A-F]/.exec(tr.querySelector('.sGr').innerText) || [''])[0], missing: num(tr.querySelector('[data-l="Missing"]').innerText) || 0, ixl: num(ix), ixlFrac: (/(\d+)\/(\d+)/.exec(ix) || []).slice(1).map(Number).join('/'), quick: tr.querySelector('.qcol').innerText.trim(), retake: td[td.length - 2].innerText.trim(), since: tr.querySelector('[data-l="Since last import"]').innerText.trim(), fin: td[td.length - 1].innerText.trim() };
        (C.stu[nm] || (C.stu[nm] = { i: -1, oracle: {}, s: {} })).s.list = rec; });
    } catch (e) { C.err = (C.err || '') + ' list:' + e.message; }
    // ---- each student's page, Show student, conference panel ----
    for (const name of gb.students) { const X = C.stu[name]; if (!X) continue;
      try { T.openProfile(key, name); const tiles = {}; document.querySelectorAll('.profile .gcards .gcard').forEach(c => { const k = (c.querySelector('small') || {}).innerText || ''; tiles[k.trim().toUpperCase()] = c.innerText.replace(/\s+/g, ' ').trim(); });
        const gk = Object.keys(tiles).find(k => / GRADE$/.test(k)); const ixk = tiles['IXL AT GOAL'] || ''; const head = [...document.querySelectorAll('.qbook h3')].map(h => h.innerText.replace(/\s+/g, ' '));
        const qc = document.querySelector('#pQuick'); const qtxt = qc ? qc.innerText.replace(/\s+/g, ' ') : '';
        X.s.page = { grade: gk ? num(tiles[gk].replace(/^[A-Z0-9 ]+GRADE/, '')) : null, gradeTile: gk ? tiles[gk] : '', missing: num((tiles['MISSING NOW'] || '').replace('MISSING NOW', '')), ixl: num(ixk.replace('IXL AT GOAL', '')), ixlFrac: (/(\d+) of (\d+) skills/.exec(ixk) || []).slice(1).join('/'), ixlTile: ixk, retake: (tiles['RETAKE'] || '').replace(/^RETAKE\s*/, ''), heads: head, quick: qtxt, whatNow: ((document.querySelector('#pWhat') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 160) };
        if (o.show && document.querySelector('#pShow')) { document.querySelector('#pShow').click(); const sh = document.querySelector('#show'); X.s.show = sh ? { text: sh.innerText.replace(/\s+/g, ' ').slice(0, 900) } : null; if (sh) A.closeShow(); T.openProfile(key, name); }
        if (o.conf && document.querySelector('#pConf')) { document.querySelector('#pConf').click(); const m = document.querySelector('#modal'); const t = m ? m.innerText : ''; const fg = t.split('From the gradebook')[1] || ''; X.s.conf = { from: fg.replace(/\s+/g, ' ').replace(/Close Print.*$/, '').trim() };
          if (o.confPrint) { const pb = [...m.querySelectorAll('button')].find(b => /^Print$/.test(b.innerText.trim())); if (pb) { window.__prints = []; pb.click(); const h = window.__prints.pop() || ''; const d = new DOMParser().parseFromString(h, 'text/html'); X.s.conf.print = (d.body ? d.body.textContent : '').replace(/\s+/g, ' ').slice(0, 1500); } }
          const cl = document.querySelector('#mClose'); if (cl) cl.click(); }
      } catch (e) { X.err = e.message; }
    }
    // ---- the weekly report for everyone (the Reports page's "Everyone") ----
    try { const rws = T.gbRows(s); let nrep = 0; gb.students.forEach((nm, i) => { const h = A.studentReportSection(s, i, rws[i]); const d = new DOMParser().parseFromString('<body>' + h + '</body>', 'text/html'); const rp = d.body; if (!C.stu[nm]) return; nrep++;
        const t = rp.textContent.replace(/\s+/g, ' '); const big = rp.querySelector('.big'); const board = {}; rp.querySelectorAll('.board>div').forEach(dv => { const k = (dv.querySelector('small') || {}).textContent || ''; board[k.trim()] = dv.textContent.replace(/\s+/g, ' ').trim(); });
        C.stu[nm].s.report = { grade: big ? num(big.textContent) : null, L: big ? (/[A-F]/.exec(big.textContent.replace(/\d/g, '')) || [''])[0] : '', board, steps: rp.querySelectorAll('.steps tbody tr, .todo li').length, text: t.slice(0, 3000) }; }); C.cls.reportN = nrep;
    } catch (e) { C.err = (C.err || '') + ' report:' + e.message; }
    // ---- Home card ----
    try { click('#btnHome'); const card = document.querySelector(`.hcard[data-go="${CSS.escape(key)}"]`); C.cls.home = card ? card.innerText.replace(/\s+/g, ' ') : null; } catch (e) { C.err = (C.err || '') + ' home:' + e.message; }
    // ---- Reports page counts ----
    try { const hb = document.querySelector(`.hcard[data-go="${CSS.escape(key)}"]`); if (hb) hb.click(); click('#openReports'); C.cls.reports = document.querySelector('#gridwrap').innerText.replace(/\s+/g, ' ').slice(0, 600); } catch (e) { C.err = (C.err || '') + ' reports:' + e.message; }
  }
  return out;
}
module.exports.scrapeAll = scrapeAll;
// ---------- synthetic Focus gradebooks: read the scrubbed export, change it, write it back as Focus does ----------
const P = require(path.join(REPO, 'parser.js'));
const gbRead = f => P.csvToRows(fs.readFileSync(path.resolve(f), 'utf8'));
const gbWrite = (rows, name) => { const q = v => v == null ? '' : '"' + String(v).replace(/"/g, '""') + '"'; const f = path.join(L.tmp, name || ('gb-' + Date.now() + '.csv')); fs.writeFileSync(f, rows.map(r => r.map(q).join(',')).join('\n') + '\n'); return f; };
module.exports.gbRead = gbRead; module.exports.gbWrite = gbWrite;
