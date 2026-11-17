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
  check(c3.where === 'waiting' && !c3.who && new RegExp(`From ${U(P4[7])}'s school account; the name typed is ${U(P4[8])}`).test(w3), 'an account and a certain name for two different students: it waits, with both facts: "' + (w3.match(/From [^.]*\./) || [''])[0] + '"');
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
  check((await where(codes[8])).who === 'HUGHES, CALEB' && (await accts())[acct(P4[4])] === 'HUGHES, CALEB|you' && (await where(codes[0])).who === U(P4[4]), '"the account is theirs from now on": the test and the account move; the account\'s earlier test stays where it was');

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
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close(); done();
})().catch(e => { console.error(e); check(false, 'crashed: ' + (e && e.message)); done(); process.exit(1); });
