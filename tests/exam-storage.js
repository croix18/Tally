// Tests: storage and the move from what this branch kept before the review (16 Nov 2026, REVIEW.md H3, C4).
// A test is kept as the site's locked text in IndexedDB (Tally's own storage holds only its small summary and its student),
// opened and checked again in each session. Measured here: a class of 28 × 10 tests and 150 students × 15 tests — what
// Tally's own storage grows by, what IndexedDB holds, the Full save — and every record still there after a reload; the
// warning at 70%; and a record kept the old way (opened, under its class) carried over without being lost.
const { chromium, fs, path, exe, check, done, tmp, pick, APP } = require('./lib');
const SEAL = require('../vendor/seal.js'); const F = require('./exam/fixtures.js');
const FX = n => path.resolve('fixtures', 'exams', n); const SHOTS = process.env.SHOTS || tmp;
(async () => {
  const K = JSON.parse(fs.readFileSync(FX('keys.json'), 'utf8')); const R = JSON.parse(fs.readFileSync(FX('records.json'), 'utf8')).filter(x => x.to === 'tally' && x.by === 'site');
  const browser = await chromium.launch({ executablePath: exe }); const errs = [];
  const open = async (init) => { const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true }); if (init) await ctx.addInitScript(init); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept()); await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400); return { ctx, p }; };
  const A = (p, fn, arg) => p.evaluate(([s, a]) => (new Function('A', 'arg', 'return (' + s + ')(A, arg)'))(window.__all, a), [fn.toString(), arg === undefined ? null : arg]);
  const importClasses = async p => { await p.setInputFiles('#file', fs.readdirSync(FX('')).filter(f => /^IXL-Score-Grid/.test(f)).map(FX)); await p.waitForTimeout(900);
    for (const f of ['focus_gradebook_p4.csv', 'focus_gradebook_p5.csv']) { await p.setInputFiles('#file', [FX(f)]); await p.waitForTimeout(700); await pick(p); await p.waitForTimeout(300); const a = await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(200); } } };
  const connect = p => A(p, (A, k) => { const X = A.examS(); X.pairs = [JSON.stringify({ priv: k.tally.priv, pub: k.tally.pub, made: new Date().toISOString() })]; X.sites = [{ key: k.site.pub, made: 1, got: new Date().toISOString() }]; X.trial = { code: 'X', words: 'a b c d', at: new Date().toISOString(), key: k.site.pub }; X.warned = true; A.xtLocalAdd('mine', k.tally.pub); A.xtLocalAdd('checked', k.site.pub); A.save(); }, K);
  // n records, sealed by the fixtures' site key to the fixtures' Tally key, each a fresh code, given to students of 4th Period
  const make = async (n, unitFrom) => { const out = []; for (let i = 0; i < n; i++) { const r = JSON.parse(JSON.stringify(R[i % R.length].record)); r.code = SEAL.newCode(); r.unit = unitFrom + Math.floor(i / 28); out.push({ code: r.code, text: await SEAL.seal(r, K.site.priv, K.tally.pub) }); } return out; };
  const put = (p, list) => A(p, async (A, list) => { const X = A.examS(); const sec = A.state.order[0]; const studs = A.classStudents(A.state.sections[sec]);
    for (let i = 0; i < list.length; i++) { const { rec, checked } = await A.examOpen(list[i].text, list[i].code); await A.examPut(list[i].code, list[i].text, rec, checked, 'site'); X.recs[list[i].code].who = { sec, n: studs[i % studs.length], how: 'you', at: new Date().toISOString() }; }
    return A.save(); }, list);
  const sizes = p => p.evaluate(async () => { const ls = (localStorage.getItem('tally.v1') || '').length; let idb = 0, n = 0; await new Promise(res => { const q = indexedDB.open('tally-tests', 1); q.onsuccess = () => { const tx = q.result.transaction('locked', 'readonly'); const c = tx.objectStore('locked').openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { idb += cur.value.length; n++; cur.continue(); } else res(); }; c.onerror = res; }; q.onerror = res; }); const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : {}; return { ls, idb, n, usage: est.usage || 0, quota: est.quota || 0 }; });
  const MB = n => (n / 1048576).toFixed(2) + ' MB';

  { const { ctx, p } = await open(); await importClasses(p); await connect(p);
    const s0 = await sizes(p);
    const c1 = await make(280, 1); const ok1 = await put(p, c1); const s1 = await sizes(p);
    console.log(`MEASURE class of 28 x 10 tests (280): tally.v1 ${MB(s0.ls)} -> ${MB(s1.ls)} (+${MB(s1.ls - s0.ls)}, ${Math.round((s1.ls - s0.ls) / 280)} bytes a test); IndexedDB ${s1.n} locked texts, ${MB(s1.idb)} (${Math.round(s1.idb / s1.n)} bytes each)`);
    check(ok1 && s1.n === 280 && (s1.ls - s0.ls) / 280 < 1200, `a class of 28 × 10 tests: Tally's own storage grows by about ${Math.round((s1.ls - s0.ls) / 280)} bytes a test, the locked texts are in IndexedDB (${s1.n})`);
    const c2 = await make(2250 - 280, 11); const ok2 = await put(p, c2); const s2 = await sizes(p);
    console.log(`MEASURE 150 students x 15 tests (2,250): tally.v1 ${MB(s2.ls)} (+${MB(s2.ls - s0.ls)} for Tests); IndexedDB ${s2.n} locked texts, ${MB(s2.idb)}; the browser's estimate: ${MB(s2.usage)} of ${MB(s2.quota)}`);
    check(ok2 && s2.n === 2250 && s2.ls < 4.0 * 1048576, `150 students × 15 tests: every save still succeeds; Tally's own storage holds ${MB(s2.ls)} in all (the browser gives about 5 MB), IndexedDB ${MB(s2.idb)}`);
    const [dl] = await Promise.all([p.waitForEvent('download'), A(p, A => A.saveFull())]); const fp = path.join(tmp, 'big-full.json'); await dl.saveAs(fp); const fsz = fs.statSync(fp).size; const fj = JSON.parse(fs.readFileSync(fp, 'utf8'));
    console.log(`MEASURE the Full save with 2,250 tests: ${MB(fsz)}`);
    check(Object.keys(fj.state.exam.locked).length === 2250 && Object.keys(fj.state.exam.recs).length === 2250, 'the Full save carries all 2,250 tests and their locked texts (a Full save is still everything)');
    await p.reload(); await p.waitForTimeout(1200);
    const back = await A(p, async A => { await A.examLoadLocked(); await A.examVerifyAll(); const ks = Object.keys(A.examS().recs); return { held: ks.length, ok: ks.filter(c => A.xtOk(c)).length }; });
    check(back.held === 2250 && back.ok === 2250, `after a reload every test is still held and opens and checks again from IndexedDB (${back.ok} of ${back.held})`);
    await ctx.close(); }

  // the warning at 70% of what the browser gives (the browser's own estimate, made to say 82% here)
  { const { ctx, p } = await open(() => { if (navigator.storage) navigator.storage.estimate = () => Promise.resolve({ usage: 82 * 1048576, quota: 100 * 1048576 }); }); await importClasses(p); await connect(p);
    await put(p, await make(3, 1)); await p.click('#rail .rc:has-text("4th")'); await p.click('#openTests'); await p.waitForTimeout(700); await p.click('#btnHome'); await p.waitForTimeout(100); await p.click('#rail .rc:has-text("4th")'); await p.click('#openTests'); await p.waitForTimeout(500);
    const w = await p.evaluate(() => (document.querySelector('.xtStore') || {}).innerText || '');
    check(/room for test records is 82% full/.test(w) && /Full save/.test(w), 'Tests warns at 70% of what the browser gives, and offers the Full save: ' + w.slice(0, 90));
    await p.screenshot({ path: path.join(SHOTS, '14-storage-warning-1366.png') }); await ctx.close(); }

  // what this branch kept before the review: opened records under each class (v1). Carried over, nothing lost, never scored
  { const { ctx, p } = await open(); await importClasses(p); await connect(p);
    const v1 = await A(p, (A, recs) => { const sec = A.state.order[0], studs = A.classStudents(A.state.sections[sec]); const st = JSON.parse(localStorage.getItem('tally.v1'));
      st.sections[sec].exams = {}; recs.forEach((r, i) => { st.sections[sec].exams[r.code] = { r, got: '2026-11-16T15:00:00.000Z', src: 'site', n: studs[i], pin: i === 0 ? { sec, n: studs[0] } : null }; });
      st.exam = { site: st.exam.site, pairs: st.exam.pairs, sites: st.exam.sites, trial: st.exam.trial, rows: [], loose: { [recs[5].code]: { r: recs[5], got: '2026-11-16T15:00:00.000Z', src: 'file', n: null, pin: null } }, fails: {}, picks: {}, alias: {}, period: {}, view: {} };
      localStorage.setItem('tally.v1', JSON.stringify(st)); return { sec, studs: studs.slice(0, 5) }; }, R.slice(0, 6).map(x => x.record));
    await p.reload(); await p.waitForTimeout(900);
    const m = await A(p, A => { const X = A.examS(); return Object.keys(X.recs).map(c => ({ c, who: X.recs[c].who, legacy: !!X.recs[c].legacy, kept: !!(X.legacy || {})[c], sum: !!X.recs[c].sum })); });
    check(m.length === 6 && m.every(x => x.legacy && x.kept && x.sum) && m.filter(x => x.who).length === 5 && m.find(x => x.who && x.who.how === 'you'), 'the move from the old way: all 6 records kept (5 with their students, the hand-given one still marked as given by hand, 1 nobody\'s), each with what was opened, none lost');
    await p.click('#rail .rc:has-text("4th")'); await p.click('#openTests'); await p.waitForTimeout(800);
    const t = await p.evaluate(() => document.querySelector('#gridwrap').innerText);
    check(/5 tests here can't be shown: kept by an earlier build of Tally, which kept no locked copy: fetch it again/.test(t) && await p.locator('[data-xrefetch]').count() === 1 && await p.locator('tr[data-xcode]').count() === 0, 'and until fetched again they are listed, with Fetch again, and never scored');
    await ctx.close(); }
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close(); done();
})().catch(e => { console.error(e); check(false, 'crashed: ' + e.message); done(); process.exit(1); });
