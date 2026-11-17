// Tests: LESSON TESTS (16 Nov 2026). Croix: "I want you to apply that across all of the practice tests, so I can test on a
// specific unit or lesson to test on." A lesson test's record is a unit test's plus scope ("lesson-10.03") and scopeName
// ("Lesson 10.03 · Writing inequalities"); the test is course + unit + scope. Synthetic classes and records (tests/exam/
// fixtures.js lessons()): 4th Period has the unit test and Lesson 10.03 (three students sat both); 5th Period has only a
// two-lesson day; one lesson name is hostile markup. The test build, no network: records are sealed here and put in.
// Screenshots (1366 and 400 px) go to $SHOTS (default: the suite's temp folder).
const { chromium, fs, path, exe, check, done, tmp, pick, APP } = require('./lib');
const F = require('./exam/fixtures.js'); const SEAL = require('../vendor/seal.js');
const FX = n => path.resolve('fixtures', 'exams', n); const SHOTS = process.env.SHOTS || tmp; fs.mkdirSync(SHOTS, { recursive: true });
(async () => {
  const K = JSON.parse(fs.readFileSync(FX('keys.json'), 'utf8')); const LOCKED = JSON.parse(fs.readFileSync(FX('locked.json'), 'utf8'));
  const L = F.lessons(F.build(), SEAL.newCode); for (const x of L) x.locked = await SEAL.seal(x.record, K.site.priv, K.tally.pub);
  const extra = F.lessons(F.build(), SEAL.newCode)[1]; extra.locked = await SEAL.seal(extra.record, K.site.priv, K.tally.pub);   // one more lesson test, for the cockpit's file
  const browser = await chromium.launch({ executablePath: exe }); const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400);
  const A = (fn, arg) => p.evaluate(([s, a]) => (new Function('A', 'arg', 'return (' + s + ')(A, arg)'))(window.__all, a), [fn.toString(), arg === undefined ? null : arg]);
  const text = sel => p.evaluate(s => (document.querySelector(s) || {}).innerText || '', sel);
  const both = async (name, sel) => { const at = () => p.evaluate(sel => { const t = document.querySelector('#toast'); if (t) t.style.visibility = 'hidden'; const e = sel && document.querySelector(sel); if (e) e.scrollIntoView({ block: 'start' }); }, sel || null);
    await at(); await p.screenshot({ path: path.join(SHOTS, name + '-1366.png') }); await p.setViewportSize({ width: 400, height: 860 }); await p.waitForTimeout(250); await at(); await p.screenshot({ path: path.join(SHOTS, name + '-400.png') });
    await p.setViewportSize({ width: 1366, height: 768 }); await p.waitForTimeout(150); await p.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.style.visibility = ''; }); };
  await p.setInputFiles('#file', fs.readdirSync(FX('')).filter(f => /^IXL-Score-Grid/.test(f)).map(FX)); await p.waitForTimeout(900);
  for (const f of ['focus_gradebook_p4.csv', 'focus_gradebook_p5.csv']) { await p.setInputFiles('#file', [FX(f)]); await p.waitForTimeout(700); await pick(p); await p.waitForTimeout(300); const a = await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(200); } }
  // 4th Period's unit tests (the fixture's sheet, its 4th Period rows only) and every lesson test, put in and their responses read
  const sheet4 = fs.readFileSync(FX('responses.tsv'), 'utf8').split('\n').filter((l, i) => i === 0 || l.split('\t')[2] === '4').join('\n');
  const lessonSheet = 'Timestamp\tFirst and last name\tTest code\n' + L.map((x, i) => `11/17/2026 10:${String(10 + i).padStart(2, '0')}:00\t${F.firstLast(x.who.n).replace(' Jr.', '')}\t${x.record.code}`).join('\n');
  await A(async (A, a) => { const X = A.examS(); X.pairs = [JSON.stringify({ priv: a.K.tally.priv, pub: a.K.tally.pub, made: new Date().toISOString() })]; X.sites = [{ key: a.K.site.pub, made: 1, got: new Date().toISOString() }]; X.trial = { code: 'X', words: 'a b c d', at: new Date().toISOString(), key: a.K.site.pub }; X.warned = true; A.xtLocalAdd('mine', a.K.tally.pub); A.xtLocalAdd('checked', a.K.site.pub);
    const put = async (code, text) => { try { const { rec, checked } = await A.examOpen(text, code); if (!rec.trial) await A.examPut(code, text, rec, checked, 'site'); } catch (e) {} };
    for (const code of Object.keys(a.U)) await put(code, a.U[code]); for (const x of a.L) await put(x.record.code, x.locked);
    A.examTakeSheet(a.s4, 'paste'); A.examTakeSheet(a.ls, 'paste'); A.save(); }, { K, U: LOCKED, L, s4: sheet4, ls: lessonSheet });
  await p.click('#rail .rc:has-text("4th")'); await p.waitForTimeout(250); await p.click('#openTests'); await p.waitForTimeout(800);
  const lessonKey = 'm7/10#lesson-10.03';
  const opts = await p.evaluate(() => [...document.querySelectorAll('#xtPick option')].map(o => [o.value, o.textContent]));
  check(opts.some(o => o[0] === 'm7/10' && o[1] === 'On-level Unit 10') && opts.some(o => o[0] === lessonKey && o[1] === 'On-level Unit 10 · Lesson 10.03'), 'a class with the unit test and a lesson test of the same unit lists both, each its own test, named short in the picker: ' + JSON.stringify(opts));
  // the unit test: the three who sat both have their unit score and no "two tests"
  await p.selectOption('#xtPick', 'm7/10'); await p.waitForTimeout(400);
  const unitTxt = await text('#gridwrap');
  check(!/NGUYEN, AVA MARIE has 2 tests|BROOKS, AVA has 2 tests|RAMÍREZ, JOSÉ has 2 tests/.test(unitTxt) && /NGUYEN, AVA MARIE\s*\d+\s*\/\s*36/.test(await text('.xtList')), 'a student with the unit test and a lesson test has two different tests, not "two tests": the unit view shows the unit score');
  check(!/turned in here (is|are) for On-level Unit 10 · Lesson/.test(unitTxt), 'and a lesson test of this unit is in the picker, not a note about "another test"');
  // the lesson test
  await p.selectOption('#xtPick', lessonKey); await p.waitForTimeout(400); await both('l1-class-unit-and-lesson', '.xtTop');
  const lt = await text('#gridwrap'); const turned = await text('.gcards .gcard:first-child b');
  check(/On-level Unit 10 · Lesson 10\.03 · Writing inequalities/.test(await text('.xtTop')) && parseInt(turned) === 6 && /NGUYEN, AVA MARIE\s*\d+\s*\/\s*8/.test(await text('.xtList')) && !/has 2 tests/.test(lt), 'the lesson view: its full name at the top, its own numbers (6 of 28 turned in, scores out of 8), no "two tests"');
  check(await A(A => A.examS().view[A.state.active]) === lessonKey, 'the test chosen is remembered for the class');
  // Copy scores copies the lesson's column
  await p.evaluate(() => { window.__copied = null; const o = document.execCommand.bind(document); document.execCommand = c => { if (c === 'copy') { window.__copied = document.activeElement && document.activeElement.value; return true; } return o(c); }; });
  await p.click('#xtCopy'); await p.waitForTimeout(400); const col = (await p.evaluate(() => window.__copied) || '').split('\n').filter(Boolean);
  check(col.length === 6 && col.every(v => +v <= 8) && /Lesson 10\.03/.test(await text('#toast')), 'Copy scores in the lesson view copies the lesson\'s scores (out of 8) and names the lesson: ' + (await text('#toast')).slice(0, 80));
  // the hostile lesson name: text, capped, isolated
  check(await p.evaluate(() => !window.__pwned && !document.querySelector('#gridwrap img, #gridwrap b b')) , 'a lesson name that is markup is shown as text: nothing runs, no element made');
  // a lesson test's page: its full name, See the test with the scope; a unit test's link exactly as before
  const lcode = L[0].record.code; await A((A, c) => { A.view.code = c; A.render(); }, lcode); await p.waitForTimeout(600);
  const href = await p.getAttribute('#xtSeeD', 'href'); const pay = JSON.parse(Buffer.from(href.split('#test=')[1], 'base64url').toString('utf8'));
  check(/Lesson 10\.03 · Writing inequalities/.test(await text('.xtWho1')) && /\/teacher\/m7\/unit-10\/practice\/#test=/.test(href) && Object.keys(pay).join() === 'v,course,unit,seed,scope,cv,kit,code,points,of,parts' && pay.scope === 'lesson-10.03' && pay.of === 8, 'a lesson test\'s page names the lesson in full; See the test carries its scope, right after the seed: ' + Object.keys(pay).join());
  await both('l2-lesson-test-page', '.xtD');
  const ucode = await A(A => Object.keys(A.examS().recs).find(c => A.examS().recs[c].sum && !A.examS().recs[c].sum.scope && A.xtOk(c)));
  await A((A, c) => { A.view.code = c; A.render(); }, ucode); await p.waitForTimeout(500);
  const upay = JSON.parse(Buffer.from((await p.getAttribute('#xtSeeD', 'href')).split('#test=')[1], 'base64url').toString('utf8'));
  check(Object.keys(upay).join() === 'v,course,unit,seed,cv,kit,code,points,of,parts', 'a unit test\'s link is exactly as before: no scope key');
  await A(A => { A.view.code = null; A.render(); });
  // the hostile name, on the test's own page
  const hcode = L[8].record.code; await A((A, c) => { A.view.code = c; A.render(); }, hcode); await p.waitForTimeout(500);
  const hn = await p.evaluate(() => { const e = document.querySelector('.xtWho1 .xtScopeName'); return e ? { t: e.textContent, iso: getComputedStyle(e).unicodeBidi, kids: e.children.length } : null; });
  check(hn && /^On-level Unit 10 · <img src=x onerror="window.__pwned=1"><b>Lesson 10\.03<\/b>/.test(hn.t) && /… \(\d+ more characters\)$/.test(hn.t) && hn.kids === 0 && hn.iso === 'isolate' && await p.evaluate(() => !window.__pwned), 'its page shows the hostile lesson name as text, capped at 120 characters, isolated, never markup');
  await A(A => { A.view.code = null; A.render(); });
  // 5th Period: only a lesson test (a two-lesson day)
  await p.click('#rail .rc:has-text("5th")'); await p.waitForTimeout(250); await p.click('#openTests'); await p.waitForTimeout(500);
  check(await p.locator('#xtPick').count() === 0 && /On-level Unit 10 · Lessons 10\.09–10\.10 · Solving two-step inequalities/.test(await text('.xtTop')) && parseInt(await text('.gcards .gcard:first-child b')) === 3, 'a class with only a lesson test (a two-lesson day) lists that test alone, named in full, with its own numbers');
  // the cockpit's results file with lesson rows: its scope and name are only labels; the record says what the test is
  await A(async (A, a) => { await A.examOpenFile({ site: { key: a.key }, results: [{ code: a.code, record: a.locked, course: 'm7', unit: 10, scope: 'lesson-99.99', name: 'A label only' }] }, 'r.json'); }, { key: K.site.pub, code: extra.record.code, locked: extra.locked });
  const ex = await A((A, c) => A.examS().recs[c] && A.examS().recs[c].sum, extra.record.code);
  check(ex && ex.scope === 'lesson-10.03' && ex.scopeName === 'Lesson 10.03 · Writing inequalities', 'the cockpit\'s results file with lesson rows opens as before; the test is what the locked record says (not the file row\'s label)');
  // an old summary with no scope reads as a unit test until the record is checked again this session: then its scope is the record's
  const re = await A(async (A, c) => { const e = A.examS().recs[c]; delete e.sum.scope; delete e.sum.scopeName; A.xtVer.delete(c); await A.examVerifyAll(); return A.examS().recs[c].sum.scope; }, lcode);
  check(re === 'lesson-10.03', 'a summary kept without its scope gets it back from the record itself when it is checked again');
  // a deleted lesson test's tombstone keeps which test it was
  await A((A, c) => A.examDelete(c), L[1].record.code); await p.waitForTimeout(200);
  const tomb = await A((A, c) => A.examS().deleted[c], L[1].record.code);
  check(tomb && tomb.scope === 'lesson-10.03' && /Lesson 10\.03/.test(await A((A) => { A.view.xquiet = true; A.render(); return document.querySelector('.xtQuiet').innerText; })), 'a deleted lesson test\'s tombstone keeps its scope, and Deleted tests names the lesson');
  // the ledger: every test in exactly one place with two tests of one unit in play
  const led = await A(A => { const L = A.xtLedger(); const all = Object.keys(L.at); const n = L.row.length + L.waiting.length + L.nobody.length; return all.length === n && new Set([...L.row, ...L.waiting, ...L.nobody]).size === n; });
  check(led, 'with a unit test and lesson tests of one unit held, every test is in exactly one place');
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close(); done();
})().catch(e => { console.error(e); check(false, 'crashed: ' + (e && e.message)); done(); process.exit(1); });
