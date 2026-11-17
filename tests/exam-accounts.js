// Tests: school accounts (16 Nov 2026). Croix: "the Google form I can force them to use a managed account ie their school
// account so I should be able to easily id who submits the form" … "It's their name but also sometimes abbreviated and mixed.
// So also learn. I can help assign the first time." Synthetic classes, records and addresses only (tests/exam/fixtures.js).
// The test build, no network: the fixture's records are put in directly; the response sheets are pasted through the page.
//   a first sheet learns accounts from certain names; "Ava" is suggested by her account; a row with no name is assigned
//   a second sheet with mistyped names is placed by account alone
//   an account and a certain name that disagree (3a), a new account for a student who has one (3b), an account that reads as
//   someone else (3b): each waits and changes nothing until answered
//   Forget; Not theirs with both answers; a Full save keeps the accounts, a Board save has none; Hide names
// Screenshots (1366 and 400 px) go to $SHOTS (default: the suite's temp folder).
const { chromium, fs, path, exe, check, done, tmp, pick, APP } = require('./lib');
const F = require('./exam/fixtures.js');
const FX = n => path.resolve('fixtures', 'exams', n); const SHOTS = process.env.SHOTS || tmp; fs.mkdirSync(SHOTS, { recursive: true });
(async () => {
  const K = JSON.parse(fs.readFileSync(FX('keys.json'), 'utf8')); const LOCKED = JSON.parse(fs.readFileSync(FX('locked.json'), 'utf8'));
  const browser = await chromium.launch({ executablePath: exe }); const errs = [];
  const open = async () => { const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    const sent = []; p.on('request', q => { if (!/^(file|data|blob):/.test(q.url())) sent.push(q.url()); }); await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400); return { ctx, p, sent }; };
  const A = (p, fn, arg) => p.evaluate(([s, a]) => (new Function('A', 'arg', 'return (' + s + ')(A, arg)'))(window.__all, a), [fn.toString(), arg === undefined ? null : arg]);
  const text = (p, sel) => p.evaluate(s => (document.querySelector(s) || {}).innerText || '', sel);
  const both = async (p, name, sel) => { const at = async () => p.evaluate(sel => { const t = document.querySelector('#toast'); if (t) t.style.visibility = 'hidden'; const e = sel && document.querySelector(sel); if (e) e.scrollIntoView({ block: 'start' }); }, sel || null); await at(); await p.screenshot({ path: path.join(SHOTS, name + '-1366.png') });
    await p.setViewportSize({ width: 400, height: 860 }); await p.waitForTimeout(250); await at(); await p.screenshot({ path: path.join(SHOTS, name + '-400.png') }); await p.setViewportSize({ width: 1366, height: 768 }); await p.waitForTimeout(150); await p.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.style.visibility = ''; }); };
  const { ctx, p, sent } = await open();
  await p.setInputFiles('#file', fs.readdirSync(FX('')).filter(f => /^IXL-Score-Grid/.test(f)).map(FX)); await p.waitForTimeout(900);
  for (const f of ['focus_gradebook_p4.csv', 'focus_gradebook_p5.csv']) { await p.setInputFiles('#file', [FX(f)]); await p.waitForTimeout(700); await pick(p); await p.waitForTimeout(300); const a = await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(200); } }
  const codes = await A(p, async (A, a) => { const X = A.examS(); X.pairs = [JSON.stringify({ priv: a.K.tally.priv, pub: a.K.tally.pub, made: new Date().toISOString() })]; X.sites = [{ key: a.K.site.pub, made: 1, got: new Date().toISOString() }]; X.trial = { code: 'X', words: 'a b c d', at: new Date().toISOString(), key: a.K.site.pub }; X.warned = true; A.xtLocalAdd('mine', a.K.tally.pub); A.xtLocalAdd('checked', a.K.site.pub);
    const ok = []; for (const code of Object.keys(a.L)) { try { const { rec, checked } = await A.examOpen(a.L[code], code); if (rec.trial || !checked || rec.course !== 'm7' || rec.unit !== 10) continue; await A.examPut(code, a.L[code], rec, checked, 'site'); ok.push(code); } catch (e) {} } A.save(); return ok; }, { K, L: LOCKED });
  check(codes.length >= 28, `${codes.length} synthetic tests held, nobody's yet`);
  await p.click('#rail .rc:has-text("4th")'); await p.waitForTimeout(250); await p.click('#openTests'); await p.waitForTimeout(400);
  const P4 = F.P4, acct = F.account, typed = d => F.firstLast(d).replace(' Jr.', '');
  const sheet = rows => 'Timestamp\tEmail Address\tFirst and last name\tTest code\n' + rows.map((r, i) => [`11/16/2026 10:${String(10 + i).padStart(2, '0')}:00`, r[0], r[1], r[2]].join('\t')).join('\n') + '\n';
  const paste = async t => { await p.click('#xtPaste'); await p.fill('#xtSheet', t); await p.waitForTimeout(150); const say = await text(p, '#xtSheetTrust'); await p.click('#xtTake'); await p.waitForTimeout(500); return say; };
  const where = c => A(p, (A, c) => { const e = A.examS().recs[c]; const L = A.xtLedger(); return { where: L.at[c] && L.at[c].where, who: e && e.who ? e.who.n : null, how: e && e.who ? e.who.how : null }; }, c);
  const accts = () => A(p, A => { const o = {}; for (const [a, w] of Object.entries(A.examS().accounts)) o[a] = w.n + '|' + w.how + (w.gone ? '|gone' : ''); return o; });
  const U = s => s.toUpperCase();

  /* 1. the first sheet: certain names learn their accounts; "Ava" is suggested by her account; a row with no name is assigned */
  const s1 = [4, 5, 6, 7, 8, 9].map((i, k) => [acct(P4[i]), typed(P4[i]), codes[k]]).concat([[acct(P4[1]), 'Ava', codes[6]], [acct(P4[12]), '', codes[7]]]);
  const trust = await paste(sheet(s1));
  check(/collects it Verified/.test(trust), 'near the paste: Tally takes the school account as the student only because the form collects it Verified, and says so');
  const a1 = await accts(); const learned = [4, 5, 6, 7, 8, 9].filter(i => a1[acct(P4[i])] === U(P4[i]) + '|name').length;
  check(learned === 6 && (await where(codes[0])).how === 'exact', `a first sheet: every certain name places its test and teaches Tally its school account (${learned} of 6 learned)`);
  const w1 = await text(p, '#xtWaiting');
  check(/Ava/.test(w1) && await p.locator(`#xtWaiting [data-xyes][data-n="${U(P4[1])}"]`).count() === 1 && !a1[acct(P4[1])], '"Ava" from an account that reads as Brooks, Ava: one press to say yes (the account narrowed the two Avas to one), nothing learned yet');
  check(await p.locator(`#xtWaiting [data-xyes][data-n="${U(P4[12])}"]`).count() === 1, 'a row with no name: the account alone suggests the one student it can be; he assigns');
  await both(p, 'a1-first-paste-accounts-to-assign', '#xtWaiting');
  await p.click(`#xtWaiting [data-xyes][data-n="${U(P4[1])}"]`); await p.waitForTimeout(300); await p.click(`#xtWaiting [data-xyes][data-n="${U(P4[12])}"]`); await p.waitForTimeout(300);
  const a1b = await accts();
  check(a1b[acct(P4[1])] === U(P4[1]) + '|you' && a1b[acct(P4[12])] === U(P4[12]) + '|you' && (await where(codes[6])).who === U(P4[1]), 'his one press places each and learns the account (no "yes to all")');

  /* 2. a second sheet with names mistyped: placed by the account alone */
  const s2 = [[acct(P4[4]), 'Brenan ONeal', codes[8]], [acct(P4[5]), 'Dom', codes[9]], [acct(P4[6]), '', codes[10]]];
  await paste(sheet(s2));
  const pl = await Promise.all([8, 9, 10].map(k => where(codes[k])));
  check(pl.every((x, k) => x.where === 'row' && x.how === 'account' && x.who === U(P4[4 + k])), 'a second sheet with the names mistyped (or none): each test placed by its school account alone: ' + JSON.stringify(pl));
  // Brennan now has two tests (his first sheet's and this one): he chooses this one, so the row shows it
  await p.click(`[data-xtwice="${U(P4[4])}"]`); await p.waitForTimeout(200); await p.click(`#modal [data-c="${codes[8]}"]`); await p.waitForTimeout(300);
  check(/school account/.test(await p.evaluate(c => (document.querySelector(`tr[data-xcode="${c}"]`) || {}).innerText || '', codes[8])), 'the row says how: "school account"');
  await p.click(`tr[data-xcode="${codes[8]}"]`); await p.waitForTimeout(500);
  check(new RegExp(`Turned in from ${U(P4[4]).replace(/'/g, '.')}'s school account \\(${acct(P4[4]).replace(/\./g, '\\.')}\\)`).test(await text(p, '.xtOwn')), 'the test\'s page says which account turned it in: ' + (await text(p, '.xtOwn')).slice(0, 120));
  check(!/%40|@/.test(decodeURIComponent((await p.getAttribute('#xtSeeD', 'href')).split('#test=')[0])) && !Buffer.from((await p.getAttribute('#xtSeeD', 'href')).split('#test=')[1], 'base64url').toString().includes('@'), 'no address in the See-the-test link');
  await both(p, 'a2-test-placed-by-account', '.xtD'); await p.click('#xtBack'); await p.waitForTimeout(300);

  /* 3. conflicts: each waits and changes nothing until answered */
  const snap = () => A(p, A => JSON.stringify({ r: A.examS().recs, a: A.examS().accounts }));
  // 3a: Elsa's account, Rohan's name typed
  const s3 = [[acct(P4[7]), typed(P4[8]), codes[11]]]; await paste(sheet(s3));
  if (process.env.XDEBUG) console.log('ROWS', JSON.stringify(await A(p, A => A.examS().rows.slice(-3).map(r => [r.line, r.name, r.addr, r.codes, r.how]))), await text(p, '#toast'), await text(p, '#modal'));
  const c3 = await where(codes[11]); const w3 = await text(p, '#xtWaiting');
  check(c3.where === 'waiting' && !c3.who && new RegExp(`From ${U(P4[7])}'s school account; the name typed points at ${U(P4[8])}`).test(w3), 'an account and a certain name for two different students: it waits, with both facts: "' + (w3.match(/From [^.]*\./) || [''])[0] + '"');
  const before3 = await snap(); const ci = await A(p, (A, c) => A.examS().rows.findIndex(r => r.codes.includes(c)), codes[11]);
  await p.click(`#xtWaiting [data-xconf="${ci}"]`); await p.waitForTimeout(200); await both(p, 'a3-conflict-question');
  check(await p.locator('#modal [data-ch]').count() === 3 && await p.evaluate(() => document.activeElement && document.activeElement.id === 'mCancel'), 'the question offers: the account\'s student, the typed one this time, the typed one with the account moved (and Someone else); Cancel focused');
  await p.click('#modal #mCancel'); await p.waitForTimeout(200);
  check(await snap() === before3, 'Cancel changes nothing');
  await p.click(`#xtWaiting [data-xconf="${ci}"]`); await p.waitForTimeout(150); await p.click('#modal [data-ch="typedKeep"]'); await p.waitForTimeout(300);
  check((await where(codes[11])).who === U(P4[8]) && (await accts())[acct(P4[7])] === U(P4[7]) + '|name', '"the typed one this time": the test is Rohan\'s, the account stays Elsa\'s (a test on a classmate\'s login)');
  // 3b: a new account, Camille's certain name, but Camille has an account already
  await paste(sheet([['cmoreau.2@students.example.org', typed(P4[9]), codes[12]]]));
  const c4 = await where(codes[12]);
  check(c4.where === 'waiting' && !(await accts())['cmoreau.2@students.example.org'] && /has another school account/.test(await text(p, '#xtWaiting')), 'a new account typing a certain name of a student who has another account: it waits, nothing learned');
  // 3b: a new account that reads as someone else (José), the name typed certain (Okafor)
  await paste(sheet([[acct(P4[2]).replace('@', '9@'), typed(P4[14]), codes[13]]]));
  const c5 = await where(codes[13]);
  if (process.env.XDEBUG) console.log('C5', JSON.stringify(c5), JSON.stringify(await A(p, A => A.examS().rows.slice(-1))), await text(p, '#xtWaiting'));
  check(c5.where === 'waiting' && /the account reads as RAM/i.test(await text(p, '#xtWaiting')), 'a new account that reads as another student than the name typed: it waits (stricter than "learn": a classmate\'s name typed on one\'s own login)');

  /* 4. Forget: future rows ask again; nothing already placed moves */
  const fa = acct(P4[5]); const fi = await A(p, (A, a) => Object.keys(A.examS().accounts).indexOf(a), fa);
  await p.click('.xtQuiet summary'); await p.waitForTimeout(150); await both(p, 'a4-accounts-list', '#xtAccounts');
  await p.click(`[data-xfacct="${fi}"]`); await p.waitForTimeout(300);
  check(!(await accts())[fa] && (await where(codes[9])).who === U(P4[5]), 'Forget: the account is gone, and the test it placed stays where it was');
  await paste(sheet([[fa, 'Dom', codes[14]]]));
  check((await where(codes[14])).where === 'waiting', 'a later test from a forgotten account is never placed by it: it asks');

  /* 5. Not theirs on a test placed by its account: the account moves, or stays */
  const nt = async (code, choice) => { await A(p, (A, c) => { A.view.code = c; A.render(); }, code); await p.waitForTimeout(400); await p.click('#xtNotD'); await p.waitForTimeout(150); await p.fill('#xtFind', 'hughes'); await p.waitForTimeout(100); await p.click('#modal .xtAll .xtWho >> nth=0'); await p.waitForTimeout(150);
    const q = await text(p, '#modal'); await p.click(`#modal [data-acct="${choice}"]`); await p.waitForTimeout(300); return q; };
  const q1 = await nt(codes[10], 'keep');
  check(/And the school account\?/.test(q1) && (await where(codes[10])).who === 'HUGHES, CALEB' && (await accts())[acct(P4[6])] === U(P4[6]) + '|name', 'Not theirs on an account\'s test asks about the account in the same question; "it stays": the test moves, the account does not');
  const q2 = await nt(codes[8], 'move');
  check((await where(codes[8])).who === 'HUGHES, CALEB' && (await accts())[acct(P4[4])] === 'HUGHES, CALEB|you' && (await where(codes[0])).where === 'waiting', '"the account is theirs from now on": the test and the account move; the account\'s earlier test (typed with Brennan\'s exact name) is judged again against the account now and waits (rule 3 of the second review)');

  /* 6. Full save keeps the accounts; a Board save has none; Hide names; no address sent */
  const [dl] = await Promise.all([p.waitForEvent('download'), A(p, A => A.saveFull())]); const fp = path.join(tmp, 'acct-full.json'); await dl.saveAs(fp); const full = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const n0 = Object.keys(await accts()).length;
  const o2 = await open(); await o2.p.setInputFiles('#file', [fp]); await o2.p.waitForTimeout(900);
  const back = await A(o2.p, A => Object.keys(A.examS().accounts).length); await o2.ctx.close();
  check(Object.keys(full.state.exam.accounts).length === n0 && back === n0 && n0 > 0, `a Full save carries the ${n0} accounts and a fresh Tally opening it has them all`);
  await p.click('#actBtn'); await p.waitForTimeout(150); const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#mBoardSave')]); const bp = path.join(tmp, 'acct-board.json'); await dl2.saveAs(bp);
  check(!/@students\.example\.org|"accounts"/.test(fs.readFileSync(bp, 'utf8')), 'a Board save holds no account');
  await p.click('#btnHide'); await p.waitForTimeout(300); await p.click('.xtQuiet summary').catch(() => {}); await p.waitForTimeout(150);
  const html = await p.evaluate(() => document.querySelector('#gridwrap').innerHTML + document.querySelector('#gridwrap').innerText);
  const leaks = [...new Set(Object.keys(await accts()).filter(a => html.includes(a.split('@')[0] + '@')))];
  check(!leaks.length && /•••@students\.example\.org/.test(html), 'with Hide names on, no address is on the page or in its markup (each is masked: a•••@…): ' + leaks.slice(0, 3).join(', '));
  check(!sent.some(u => /@|%40/.test(u)), 'no address in any request the page made');
  const inv = await A(p, A => { const X = A.examS(), seen = {}; const bad = []; for (const [a, w] of Object.entries(X.accounts)) { if (seen[a]) bad.push(a); seen[a] = 1; }
    X.rows.forEach(r => { if (r.how === 'account' && !r.kept && !(X.accounts[r.addr] && X.accounts[r.addr].sec === r.who.sec && X.accounts[r.addr].n === r.who.n)) bad.push('row ' + r.line); }); return bad; });
  check(!inv.length, 'every row placed by an account is placed by the account Tally holds now: ' + inv.join(', '));
  /* 7. THE REVIEW (16 Nov 2026, reviews/tally-accounts/REVIEW.md). Each scenario is the reviewer's probe, on its synthetic rosters
     (tests/exam/fx-accounts: Kim, Daniel → KHAN, ALI; Bello, Tunde → KHANNA, ALICE; Ivanova, Daria → HUGHES, DARIA, Caleb's twin).
     Each failed on 7183562 for the reviewer's reason. A fresh Tally for each, so one can't hide another. */
  const FXA = n => path.resolve('tests', 'exam', 'fx-accounts', n);
  const fresh = async (rosterText, fxd) => { const FXA = n => path.resolve('tests', 'exam', fxd || 'fx-accounts', n); const o = await open(); const q = o.p; const B = (fn, arg) => q.evaluate(([s, a]) => (new Function('A', 'arg', 'return (' + s + ')(A, arg)'))(window.__all, a), [fn.toString(), arg === undefined ? null : arg]);
    await q.setInputFiles('#file', fs.readdirSync(FXA('')).filter(f => /^IXL-Score-Grid/.test(f)).map(FXA)); await q.waitForTimeout(900);
    for (const f of ['focus_gradebook_p4.csv', 'focus_gradebook_p5.csv']) { await q.setInputFiles('#file', [FXA(f)]); await q.waitForTimeout(700); await pick(q); await q.waitForTimeout(300); const a = await q.$('#askApply'); if (a) { await a.click(); await q.waitForTimeout(200); } }
    await B(async (A, a) => { const X = A.examS(); X.pairs = [JSON.stringify({ priv: a.K.tally.priv, pub: a.K.tally.pub, made: new Date().toISOString() })]; X.sites = [{ key: a.K.site.pub, made: 1, got: new Date().toISOString() }]; X.trial = { code: 'X', words: 'a b c d', at: new Date().toISOString(), key: a.K.site.pub }; X.warned = true; A.xtLocalAdd('mine', a.K.tally.pub); A.xtLocalAdd('checked', a.K.site.pub);
      for (const code of a.codes) { try { const { rec, checked } = await A.examOpen(a.L[code], code); await A.examPut(code, a.L[code], rec, checked, 'site'); } catch (e) {} }
      if (a.rt) for (const k of A.state.order) { const s = A.state.sections[k]; s.roster = A.rosterFromGradebook(s, s.grades); s.grades = null; } A.save(); }, { K, L: LOCKED, codes, rt: !!rosterText });
    await q.click('#rail .rc:has-text("4th")'); await q.waitForTimeout(250); await q.click('#openTests'); await q.waitForTimeout(400);
    const pasteQ = async (t) => { await q.click('#xtPaste'); await q.fill('#xtSheet', t); await q.waitForTimeout(150); await q.click('#xtTake'); await q.waitForTimeout(500); };
    const whereQ = c => B((A, c) => { const e = A.examS().recs[c]; const L = A.xtLedger(); return { where: L.at[c] && L.at[c].where, who: e && e.who ? e.who.n : null, how: e && e.who ? e.who.how : null }; }, c);
    const acctsQ = () => B(A => { const o = {}; for (const [a, w] of Object.entries(A.examS().accounts)) o[a] = w.n + '|' + w.how + (w.gone ? '|gone' : ''); return o; });
    return { ...o, q, B, pasteQ, whereQ, acctsQ }; };
  const E = 'elindqvist35@students.example.org', AK = 'akhan@students.example.org';
  { // C1: a learned account must not outrank a typed name that points at someone else, certain or not
    const T = await fresh(); await T.pasteQ(sheet([[E, 'Elsa Lindqvist', codes[0]]]));
    await T.pasteQ(sheet([[E, 'Rohan Pattel', codes[1]], [E, 'Camile Moreau', codes[2]], [E, 'Mikayla', codes[3]], [E, 'Elsa Lindqvst', codes[4]], [E, '', codes[5]]]));
    const w = await Promise.all([1, 2, 3, 4, 5].map(k => T.whereQ(codes[k])));
    check(w.slice(0, 3).every(x => x.where === 'waiting' && !x.who) && w[3].who === 'LINDQVIST, ELSA' && w[4].who === 'LINDQVIST, ELSA', 'C1: from Elsa\'s learned account, "Rohan Pattel", "Camile Moreau" and "Mikayla" (names that point at classmates, not certainly) each wait with both facts; her own name with a slip, or no name, is placed by the account: ' + JSON.stringify(w.map(x => x.where + ':' + (x.who || ''))));
    await T.ctx.close(); }
  { // C2: an account is learned from a name only when the address reads as that student first and unrivaled, or as nobody
    const T = await fresh(); await T.pasteQ(sheet([[AK, 'Alice Khanna', codes[0]]]));
    const a = await T.acctsQ(); const w0 = await T.whereQ(codes[0]);
    await T.pasteQ(sheet([[AK, 'Ali Kahn', codes[1]], [AK, '', codes[2]]])); const w1 = await T.whereQ(codes[1]), w2 = await T.whereQ(codes[2]);
    check(!a[AK] && w0.where === 'waiting' && w1.who !== 'KHANNA, ALICE' && w2.who !== 'KHANNA, ALICE', 'C2: akhan@ (reads as KHAN, ALI first) typed "Alice Khanna": nothing learned, it waits; Ali\'s next tests never go to Alice: ' + JSON.stringify([a[AK] || null, w0.where, w1.who, w2.who]));
    await T.ctx.close(); }
  { // H1: an account "no longer on a roster" still counts as held: a certain name for someone else asks, never re-learns it
    const T = await fresh(true); await T.pasteQ(sheet([[E, 'Elsa Lindqvist', codes[0]]]));
    const saved = await T.B(A => { const s = A.state.sections[A.state.active]; const was = s.roster; s.roster = was.split('\n').filter(l => !/LINDQVIST/.test(l)).join('\n'); A.save(); A.render(); return was; }); await T.q.waitForTimeout(300);
    await T.pasteQ(sheet([[E, 'Rohan Patel', codes[1]]])); const a1 = (await T.acctsQ())[E]; const w1 = await T.whereQ(codes[1]);
    await T.B((A, r) => { A.state.sections[A.state.active].roster = r; A.save(); A.render(); }, saved); await T.q.waitForTimeout(300);
    await T.pasteQ(sheet([[E, '', codes[2]]])); const w2 = await T.whereQ(codes[2]);
    check(/^LINDQVIST, ELSA/.test(a1) && w1.where === 'waiting' && w2.who === 'LINDQVIST, ELSA', 'H1: Elsa\'s account while she is off the roster stays hers ("' + a1 + '"); a row from it typed "Rohan Patel" waits; when she is back her test goes to her');
    await T.ctx.close(); }
  { // H2: a Parent / Partner email column is never the school account
    const T = await fresh(); const PE = 'hughes.family@gmail.example.com';
    const notes = []; for (const head of ['Timestamp\tFirst and last name\tTest code\tParent email', 'Timestamp\tFirst and last name\tTest code\tPartner email (if any)']) {
      await T.q.click('#xtPaste'); await T.q.fill('#xtSheet', head + '\n' + `11/16/2026 10:10:00\tCaleb Hughes\t${codes[0]}\t${PE}`); await T.q.waitForTimeout(200);
      notes.push([await T.q.evaluate(() => document.querySelector('#xtSheetSay').textContent), await T.q.evaluate(() => !document.querySelector('#xtSheetTrust').hidden)]); await T.q.click('#modal #mClose'); await T.q.waitForTimeout(150); }
    await T.pasteQ('Timestamp\tFirst and last name\tTest code\tParent email\n' + `11/16/2026 10:10:00\tCaleb Hughes\t${codes[0]}\t${PE}`);
    await T.pasteQ('Timestamp\tFirst and last name\tTest code\tParent email\n' + `11/16/2026 10:11:00\tDaria Hughs\t${codes[1]}\t${PE}`);
    const w = await T.whereQ(codes[1]); const a = await T.acctsQ();
    check(notes.every(n => !/school accounts from/.test(n[0]) && !n[1]) && !a[PE] && w.who !== 'HUGHES, CALEB', 'H2: a "Parent email" or "Partner email (if any)" column is not read as the school account (no Verified note, nothing learned); Daria\'s test is never placed with Caleb: ' + JSON.stringify(notes));
    await T.ctx.close(); }
  { // H3: "Tally learned it wrong" sends the account's other tests back to Waiting, and no page says the account was the old student's now
    const T = await fresh(); await T.pasteQ(sheet([[AK, 'Ali Kahn', codes[0]]])); const ci = await T.B((A, c) => A.examS().rows.findIndex(r => r.codes.includes(c)), codes[0]);
    await T.B((A, a) => { const r = A.examS().rows[a.i]; const sec = A.state.active; A.xtAnswer(r, { sec, n: 'KHANNA, ALICE' }); }, { i: ci });   // his answer, wrongly: Alice
    await T.pasteQ(sheet([[AK, '', codes[1]], [AK, '', codes[2]]])); const before = [await T.whereQ(codes[1]), await T.whereQ(codes[2])];
    await T.B((A, c) => { A.view.code = null; A.xtNotTheirs(A.state.sections[A.state.active], c); }, codes[2]); await T.q.waitForTimeout(200);
    await T.q.click('#modal .xtWho:has-text("KHAN, ALI")'); await T.q.waitForTimeout(200); await T.q.click('#modal [data-acct="move"]'); await T.q.waitForTimeout(400);
    const w1 = await T.whereQ(codes[1]); const words = await T.B((A, c) => { const e = A.examS().recs[c]; return e && e.who ? A.xtHowWords(e.who, c) : ''; }, codes[1]);
    check(before.every(x => x.who === 'KHANNA, ALICE') && w1.who === 'KHAN, ALI' && (await T.whereQ(codes[2])).who === 'KHAN, ALI' && (await T.acctsQ())[AK] === 'KHAN, ALI|you' && !/KHANNA, ALICE's school account/.test(words), 'H3: "the account is KHAN, ALI\'s from now on (Tally learned it wrong)": that test goes to Ali; the account\'s other test (no name typed) leaves Alice\'s row and, judged again against the account now, goes to Ali (rule 3 of the second review): ' + JSON.stringify(w1));
    await T.ctx.close(); }
  { // H4: answering a conflict "the account's" never teaches the classmate's typed name as that student
    const T = await fresh(true); await T.pasteQ(sheet([[E, 'Elsa Lindqvist', codes[0]]])); await T.pasteQ(sheet([[E, 'Rohan Patel', codes[1]]]));
    const ci = await T.B((A, c) => A.examS().rows.findIndex(r => r.codes.includes(c)), codes[1]); await T.q.click(`#xtWaiting [data-xconf="${ci}"]`); await T.q.waitForTimeout(150); await T.q.click('#modal [data-ch="acct"]'); await T.q.waitForTimeout(300);
    const al = await T.B(A => JSON.stringify(A.examS().alias)); const toast = await T.q.evaluate(() => document.querySelector('#toast').textContent);
    await T.B(A => { const s = A.state.sections[A.state.active]; s.roster = s.roster.split('\n').filter(l => !/PATEL, ROHAN/.test(l)).join('\n'); A.save(); A.render(); }); await T.q.waitForTimeout(300);
    await T.pasteQ(sheet([['rpatel@students.example.org', 'Rohan Patel', codes[2]]])); const w = await T.whereQ(codes[2]);
    check(!/patel|rohan/i.test(al) && !/remembers “Rohan Patel”/.test(toast) && w.who !== 'LINDQVIST, ELSA', 'H4: answering "LINDQVIST, ELSA\'s (the account\'s)" remembers no name; a later "Rohan Patel" is never placed with Elsa: ' + al);
    await T.ctx.close(); }
  { // M1: an Email Address cell that is not a bare address is never a code; its address is read
    const T = await fresh(); const sent0 = T.sent.length;
    await T.pasteQ('Timestamp\tEmail Address\tFirst and last name\tTest code\n' + `11/16/2026 10:10:00\tElsa Lindqvist <${E}>\tElsa Lindqvist\t${codes[0]}\n11/16/2026 10:11:00\tHannah Fischer <hfischer1234@students.example.org>\tHannah Fischer\t${codes[1]}\n`); await T.q.waitForTimeout(800);
    const rows = await T.B(A => A.examS().rows.map(r => ({ codes: r.codes, addr: r.addr })));
    check(rows.length === 2 && rows[0].codes[0] === codes[0] && rows[1].codes[0] === codes[1] && rows[0].addr === E && !T.sent.slice(sent0).some(u => /E11NDQV1ST35|HF1SCHER1234/.test(u)), 'M1: "Name <address>" in the Email Address column: the codes come from the code column, the address is read, nothing spelled from an address is requested: ' + JSON.stringify(rows));
    await T.ctx.close(); }
  /* 8. THE SECOND REVIEW (17 Nov 2026, reviews/tally-accounts2/REVIEW2.md), each failing on 5a25f91 first */
  const AL = 'akhanna@students.example.org';
  { // N1, N4: a classmate's exact name, or exact first name, on a look-alike's learned account asks; X's own slip, first name or tie places
    const T = await fresh(); await T.pasteQ(sheet([[AL, 'Alice Khanna', codes[0]], [AK, 'Ali Khan', codes[1]], [E, 'Elsa Lindqvist', codes[2]], [acct(P4[1]), 'Ava Brooks', codes[3]]]));
    await T.pasteQ(sheet([[AL, 'Ali Khan', codes[4]], [AK, 'Alice Khanna', codes[5]], [AL, 'Ali', codes[6]], [acct(P4[1]), 'Ava', codes[7]], [AK, 'Ali Kahn', codes[8]], [AL, 'Alice', codes[9]]]));
    const w = await Promise.all([4, 5, 6, 7, 8, 9].map(k => T.whereQ(codes[k])));
    check(w[0].where === 'waiting' && w[1].where === 'waiting', 'N1: "Ali Khan" on Alice Khanna\'s account and "Alice Khanna" on Ali Khan\'s (each a classmate\'s exact name) wait with both facts: ' + JSON.stringify(w.slice(0, 2)));
    check(w[2].where === 'waiting', 'N4: "Ali" (exactly KHAN, ALI\'s first name, only the start of Alice) on Alice\'s account waits: ' + JSON.stringify(w[2]));
    check(w[3].who === 'BROOKS, AVA' && w[4].who === 'KHAN, ALI' && w[5].who === 'KHANNA, ALICE', 'and the account still places its own student\'s first name when two share it ("Ava"), a slip of their own name ("Ali Kahn"), and their own first name ("Alice")');
    await T.ctx.close(); }
  { // N1 (c): twins Dana and Daria (fx-accounts2): "Dana Hughes" on Daria's account asks
    const T = await fresh(false, 'fx-accounts2'); const D = 'dhughes@students.example.org'; await T.pasteQ(sheet([[D, 'Daria Hughes', codes[0]]]));
    const r0 = await T.B((A, c) => A.examS().rows.findIndex(r => r.codes.includes(c)), codes[0]); await T.B((A, i) => A.xtAnswer(A.examS().rows[i], { sec: A.state.active, n: 'HUGHES, DARIA' }), r0); await T.q.waitForTimeout(300);
    await T.pasteQ(sheet([[D, 'Dana Hughes', codes[1]], [D, 'Daria Hughs', codes[2]]])); const w1 = await T.whereQ(codes[1]), w2 = await T.whereQ(codes[2]);
    check(w1.where === 'waiting' && w2.who === 'HUGHES, DARIA', 'N1: a twin\'s exact name ("Dana Hughes") on the other twin\'s account waits; Daria\'s own name with a slip goes to her: ' + JSON.stringify([w1, w2]));
    await T.ctx.close(); }
  { // N3: when the account moves, a test from it placed by a certain name is judged again against the account as it is now
    const T = await fresh(); await T.pasteQ(sheet([[AK, 'Ali Kahn', codes[0]]])); const ci = await T.B((A, c) => A.examS().rows.findIndex(r => r.codes.includes(c)), codes[0]);
    await T.B((A, i) => A.xtAnswer(A.examS().rows[i], { sec: A.state.active, n: 'KHANNA, ALICE' }), ci);   // his answer, wrongly
    await T.pasteQ(sheet([[AK, 'Alice Khanna', codes[1]], [AK, '', codes[2]]])); const before = [await T.whereQ(codes[1]), await T.whereQ(codes[2])];
    await T.B((A, c) => { A.view.code = null; A.xtNotTheirs(A.state.sections[A.state.active], c); }, codes[2]); await T.q.waitForTimeout(200);
    await T.q.click('#modal .xtWho:has-text("KHAN, ALI")'); await T.q.waitForTimeout(200); const sub = await T.q.evaluate(() => document.querySelector('#modal [data-acct="move"]').textContent); await T.q.click('#modal [data-acct="move"]'); await T.q.waitForTimeout(400);
    const w1 = await T.whereQ(codes[1]); const toast = await T.q.evaluate(() => document.querySelector('#toast').textContent);
    check(before[0].who === 'KHANNA, ALICE' && w1.where === 'waiting' && /judged again/.test(toast) && /account was learned wrong/.test(sub), 'N3, N8: "the account was learned wrong" (said so even though it came from his answer): a test from it placed by the certain name "Alice Khanna" is judged again against the account now (Ali\'s) and waits; the toast says other tests are judged again: ' + JSON.stringify(w1));
    await T.ctx.close(); }
  { // N2: a row from a gone account: the question says what the answer does; unticked it teaches nothing, ticked the account moves
    const T = await fresh(true); await T.pasteQ(sheet([[E, 'Elsa Lindqvist', codes[0]]]));
    const was = await T.B(A => { const s = A.state.sections[A.state.active]; const was = s.roster; s.roster = was.split('\n').filter(l => !/LINDQVIST/.test(l)).join('\n'); A.save(); A.render(); return was; }); await T.q.waitForTimeout(300);
    await T.pasteQ(sheet([[E, '', codes[1]]])); const ri = await T.B((A, c) => A.examS().rows.findIndex(r => r.codes.includes(c)), codes[1]);
    await T.B((A, i) => A.xtWho(A.state.sections[A.state.active], A.examS().rows[i]), ri); await T.q.waitForTimeout(200); const q = await T.q.evaluate(() => document.querySelector('#modal').textContent);
    await T.q.click('#modal #mCancel'); await T.q.waitForTimeout(100);
    check(!/also teaches Tally the account/.test(q) && /unticked, your answer teaches Tally nothing about it/.test(q) && /no longer on a roster/.test(q), 'N2: on a row from a gone account the question no longer says the answer teaches the account; it offers "and the school account is theirs from now on", unticked by default');
    await T.ctx.close(); }
  { // N5, N6, N7 in the page: an address as the code; "Your school email"; a tie that includes the certain name
    const T = await fresh(); const s0 = T.sent.length;
    await T.pasteQ('Timestamp\tYour school email\tFirst and last name\tTest code\n11/16/2026 11:00:00\thfischer1234@students.example.org\tHannah Fischer\thfischer1234@students.example.org\n11/16/2026 11:01:00\tmaria.g@students.example.org\tElsa Lindqvist\t' + codes[0] + '\n'); await T.q.waitForTimeout(800);
    const rows = await T.B(A => A.examS().rows.map(r => ({ codes: r.codes, addr: r.addr }))); const req = T.sent.slice(s0).filter(u => /result/.test(u));
    check(!rows.some(r => r.codes.some(c => /HF1SCHER/.test(c))) && !req.some(u => /HF1SCHER1234/.test(u)) && rows.some(r => r.addr === 'hfischer1234@students.example.org'), 'N5, N6: an address typed as the code is never a code or a request; "Your school email" is read as the account column');
    await T.ctx.close(); }
  { // no needless questions (the second review's q4): 28 of 28 with exact names and their own addresses place with zero
    // questions; 28 of 28 with a slip, the first name only or no name, from those accounts, place too (Khan/Khanna and twins included)
    let placed1 = 0, placed2 = 0, asked = [];
    for (const off of [0, 14]) { const T = await fresh(false, 'fx-accounts');   // the review's q4 roster (Khan/Khanna; the Hughes twins Caleb and Daria)
      const ros = (await T.B(A => A.examRoster())).filter(x => /7T4A/.test(x.sec)).slice(off, off + 14);
      const nm = n => { const [l, f] = n.split(', '); const c = s => s.toLowerCase().replace(/(^|[\s'-])\S/g, m => m.toUpperCase()); return c(f.replace(/ JR\.?$/i, '')) + ' ' + c(l); };
      const slip = t => { const [f, l] = t.split(' '); return [f.slice(0, -1) + f.slice(-1).repeat(2), l].join(' '); };
      await T.pasteQ(sheet(ros.map((x, i) => [acct(x.n), nm(x.n), codes[i]])));
      for (let i = 0; i < ros.length; i++) { const w = await T.whereQ(codes[i]); if (w.where === 'row' && w.who === ros[i].n) placed1++; else asked.push(nm(ros[i].n)); }
      await T.pasteQ(sheet(ros.map((x, i) => [acct(x.n), i % 3 === 0 ? slip(nm(x.n)) : i % 3 === 1 ? nm(x.n).split(' ')[0] : '', codes[14 + i]])));
      for (let i = 0; i < ros.length; i++) { const w = await T.whereQ(codes[14 + i]); if (w.where === 'row' && w.who === ros[i].n) placed2++; else asked.push('2nd: ' + ros[i].n); }
      await T.ctx.close(); }
    check(placed1 === 28 && placed2 === 28, `no needless questions: exact names and their own addresses ${placed1} of 28 placed; slips, first names only or no name ${placed2} of 28 placed; asked: ${asked.join('; ') || 'none'}`); }
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close(); done();
})().catch(e => { console.error(e); check(false, 'crashed: ' + (e && e.message)); done(); process.exit(1); });
