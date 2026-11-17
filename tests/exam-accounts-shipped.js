// run.js timeout: 480 s
// Tests: school accounts in THE SHIPPED MODE (coordinator's decision after the third review, 17 Nov 2026): an account never
// places a row by itself. It learns, and it suggests. A row the account would have placed waits in Waiting for you with the
// account's student as the one-press suggestion and both facts shown ("from X's school account"; the name typed, or "no
// name"); his press is his own placement. A certain name places by the name exactly as 6444eed did (before accounts), except
// where the learning rule asks (the address reads as someone else, or is already another student's).
// The test build with the switch as shipped (window.__tally.accountPlaces is never called here). Synthetic classes, records
// and addresses only: the third reviewer's scenarios (reviews/tally-accounts3/probes/a-first-paste.js S1–S10 and
// b-second-paste.js) on his rosters (tests/exam/fx-accounts: Khan, Ali / Khanna, Alice / Hughes, Caleb and Daria;
// tests/exam/fx-accounts2: the twins Hughes, Dana and Daria). Where each row went on 6444eed is written below (OLD) from
// running his probe on that build.
const { chromium, fs, path, exe, check, done, pick, APP } = require('./lib');
const F = require('./exam/fixtures.js'); const ac = n => F.account(n); const D = '@students.example.org';
const EXF = n => path.resolve('fixtures', 'exams', n);
const S = [
  ['S1', 'fx-accounts', [[ac('KHAN, ALI'), 'Ali Khan', 0], [ac('KHANNA, ALICE'), 'Alice Khanna', 1], [ac('HUGHES, DARIA'), 'Daria Hughes', 2], [ac('HUGHES, CALEB'), 'Caleb Hughes', 3], [ac('LINDQVIST, ELSA'), 'Elsa Lindqvist', 4], [ac('PATEL, ROHAN'), 'Rohan Patel', 5]]],
  ['S2', 'fx-accounts', [[ac('KHANNA, ALICE'), 'Ali Khan', 0], [ac('KHAN, ALI'), 'Alice Khanna', 1], [ac('PATEL, ROHAN'), 'Elsa Lindqvist', 2], [ac('HUGHES, CALEB'), 'Daria Hughes', 3], ['akhan' + D, 'Alice Khanna', 4], ['akhanna' + D, 'Ali Khan', 5]]],
  ['S3', 'fx-accounts', [[ac('LINDQVIST, ELSA'), 'Elsa Lindqvst', 0], [ac('PATEL, ROHAN'), 'Rohan', 1], [ac('KHAN, ALI'), 'Ali', 2], [ac('KHANNA, ALICE'), 'Alice', 3], [ac('MOREAU, CAMILLE'), '', 4], [ac('HUGHES, DARIA'), 'Daria', 5], [ac('KHAN, ALI'), 'Ali Kahn', 6], [ac('BROOKS, AVA'), 'Ava', 7]]],
  ['S4a', 'fx-accounts', [[ac('PATEL, ROHAN'), 'Rohan Patel', 0], [ac('PATEL, ROHAN'), 'Elsa Lindqvist', 1], [ac('PATEL, ROHAN'), '', 2, 'PATEL, ROHAN'], [ac('PATEL, ROHAN'), 'Rohan', 3, 'PATEL, ROHAN'], [ac('PATEL, ROHAN'), 'Elsa', 4]]],
  ['S4b', 'fx-accounts', [[ac('PATEL, ROHAN'), 'Elsa Lindqvist', 0], [ac('PATEL, ROHAN'), 'Rohan Patel', 1], [ac('PATEL, ROHAN'), '', 2, 'PATEL, ROHAN'], [ac('PATEL, ROHAN'), 'Elsa', 3]]],
  ['S4c', 'fx-accounts', [['s7700123' + D, 'Elsa Lindqvist', 0], ['s7700123' + D, 'Rohan Patel', 1], ['s7700123' + D, '', 2], ['s7700123' + D, 'Rohan', 3], ['s7700123' + D, 'Elsa', 4]]],
  ['S4d', 'fx-accounts', [['s7700999' + D, 'Ali Khan', 0], ['s7700999' + D, 'Alice', 1], ['s7700999' + D, '', 2, 'KHAN, ALI'], ['s7700999' + D, 'Ali', 3, 'KHAN, ALI']]],
  ['S5', 'fx-accounts', [[ac('KHAN, ALI'), 'Ali Khan', 0], [ac('KHAN, ALI'), '', 1, 'KHAN, ALI'], [ac('LINDQVIST, ELSA'), 'Elsa', 2]], { twice: true }],
  ['S6', 'fx-accounts', [[ac('KHAN, ALI'), 'Ali Khan', 0], [ac('KHAN, ALI'), 'Ali', 1, 'KHAN, ALI'], [ac('PATEL, ROHAN'), 'Elsa Lindqvist', 2]], { order: true }],
  ['S7', 'fx-accounts', [[ac('KHAN, ALI'), 'Ali Khan', 0], [ac('KHAN, ALI'), 'Ali', 1, 'KHAN, ALI'], [ac('PATEL, ROHAN'), 'Elsa Lindqvist', 2], [ac('PATEL, ROHAN'), '', 3]], { noHead: true }],
  ['S8', 'fx-accounts2', [[ac('HUGHES, DANA'), 'Dana Hughes', 0], [ac('HUGHES, DARIA'), 'Daria Hughes', 1], [ac('HUGHES, DARIA'), 'Dana Hughes', 2], [ac('HUGHES, DANA'), '', 3], [ac('HUGHES, DARIA'), 'Daria', 4], ['dhughes' + D, 'Dana Hughes', 5], ['dhughes' + D, '', 6]]],
  ['S9', 'fx-accounts', [[ac('KHANNA, ALICE'), 'Alice Khanna', 0], [ac('KHANNA, ALICE'), 'Ali', 1], [ac('KHANNA, ALICE'), 'Khan', 2], [ac('KHANNA, ALICE'), 'Ali Khanna', 3], [ac('KHAN, ALI'), 'Ali Khan', 4], [ac('KHAN, ALI'), 'Alice', 5], [ac('KHAN, ALI'), 'Al Khan', 6]]],
  ['S10', 'fx-accounts', [[ac('KHANNA, ALICE'), 'Alice Khanna', 0], [ac('KHANNA, ALICE'), 'Ali K.', 1], [ac('KHANNA, ALICE'), 'A Khan', 2], [ac('BROOKS, AVA'), 'Ava Brooks', 3], [ac('BROOKS, AVA'), 'Ava Marie', 4], [ac('NGUYEN, AVA MARIE'), 'Ava Nguyen', 5], [ac('NGUYEN, AVA MARIE'), 'Ava B.', 6]]],
];
// where each row went on 6444eed (the shipped build before accounts): its student, or null (it waited)
const OLD = {"S1":["KHAN, ALI","KHANNA, ALICE","HUGHES, DARIA","HUGHES, CALEB","LINDQVIST, ELSA","PATEL, ROHAN"],"S2":["KHAN, ALI","KHANNA, ALICE","LINDQVIST, ELSA","HUGHES, DARIA","KHANNA, ALICE","KHAN, ALI"],"S3":[null,null,null,null,null,null,null,null],"S4a":["PATEL, ROHAN","LINDQVIST, ELSA",null,null,null],"S4b":["LINDQVIST, ELSA","PATEL, ROHAN",null,null],"S4c":["LINDQVIST, ELSA","PATEL, ROHAN",null,null,null],"S4d":["KHAN, ALI",null,null,null],"S5":["KHAN, ALI",null,null],"S6":["KHAN, ALI",null,"LINDQVIST, ELSA"],"S7":["KHAN, ALI",null,"LINDQVIST, ELSA",null],"S8":[null,null,null,null,null,null,null],"S9":["KHANNA, ALICE",null,null,null,"KHAN, ALI",null,null],"S10":["KHANNA, ALICE",null,null,"BROOKS, AVA",null,"NGUYEN, AVA MARIE",null]};
// the page may never say that an account places or identifies a test by itself
const CLAIM = /(by|from) (a|the|its|their) school account[^.]*\b(placed|places|identif\w*)\b|\baccounts? (places|placed|identif\w*)\b|takes a school account as the student|places later tests by it|placed with \S+ by a school account/i;
(async () => {
  const K = JSON.parse(fs.readFileSync(EXF('keys.json'), 'utf8')); const LOCKED = JSON.parse(fs.readFileSync(EXF('locked.json'), 'utf8'));
  const browser = await chromium.launch({ executablePath: exe }); const errs = [];
  const fresh = async fxd => { const FXA = n => path.resolve('tests', 'exam', fxd, n);
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } }); await ctx.route(u => !/^(file|data|blob):/.test(String(u)), r => r.abort());
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400);
    const A = (fn, arg) => p.evaluate(([s, a]) => (new Function('A', 'arg', 'return (' + s + ')(A, arg)'))(window.__all, a), [fn.toString(), arg === undefined ? null : arg]);
    await p.setInputFiles('#file', fs.readdirSync(FXA('')).filter(f => /^IXL-Score-Grid/.test(f)).map(FXA)); await p.waitForTimeout(900);
    for (const f of ['focus_gradebook_p4.csv', 'focus_gradebook_p5.csv']) { await p.setInputFiles('#file', [FXA(f)]); await p.waitForTimeout(700); await pick(p); await p.waitForTimeout(300); const a = await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(200); } }
    const codes = await A(async (A, a) => { const X = A.examS(); X.pairs = [JSON.stringify({ priv: a.K.tally.priv, pub: a.K.tally.pub, made: new Date().toISOString() })]; X.sites = [{ key: a.K.site.pub, made: 1, got: new Date().toISOString() }]; X.trial = { code: 'X', words: 'a b c d', at: new Date().toISOString(), key: a.K.site.pub }; X.warned = true; A.xtLocalAdd('mine', a.K.tally.pub); A.xtLocalAdd('checked', a.K.site.pub);
      const ok = []; for (const code of Object.keys(a.L)) { try { const { rec, checked } = await A.examOpen(a.L[code], code); if (rec.trial || !checked || rec.course !== 'm7' || rec.unit !== 10) continue; await A.examPut(code, a.L[code], rec, checked, 'site'); ok.push(code); } catch (e) {} } A.save(); return ok; }, { K, L: LOCKED });
    await p.click('#rail .rc:has-text("4th")'); await p.waitForTimeout(250); await p.click('#openTests'); await p.waitForTimeout(400);
    const paste = async t => { await p.click('#xtPaste'); await p.fill('#xtSheet', t); await p.waitForTimeout(150); const note = await p.evaluate(() => [...document.querySelectorAll('#modal .xtSheetTrust')].filter(e => !e.hidden).map(e => e.innerText).join(' ')); await p.click('#xtTake'); await p.waitForTimeout(500); return note; };
    const where = c => A((A, c) => { const e = A.examS().recs[c]; const L = A.xtLedger(); const r = A.examS().rows.find(r => r.codes.includes(c)); return { where: L.at[c] && L.at[c].where, who: e && e.who ? e.who.n : null, how: e && e.who ? e.who.how : null, from: r && r.from ? r.from.n : null, suggest: r && r.suggest ? r.suggest.n : null, conflict: r && r.conflict ? r.conflict.kind : null, ri: A.examS().rows.indexOf(r) }; }, c);
    const byAcct = () => A(A => { const X = A.examS(); return X.rows.filter(r => r.how === 'account').length + Object.values(X.recs).filter(e => e.who && e.who.how === 'account').length; });
    const press = async ri => { const b = await p.$(`#xtWaiting [data-xyes="${ri}"]`); if (!b) return false; await b.click(); await p.waitForTimeout(250); return true; };
    const pageText = () => p.evaluate(() => document.body.innerText);
    return { ctx, p, A, codes, paste, where, byAcct, press, pageText }; };
  const ts = i => `11/16/2026 10:${String(10 + i).padStart(2, '0')}:00`;
  const sheet = (rows, codes) => 'Timestamp\tEmail Address\tFirst and last name\tTest code\n' + rows.map((r, i) => [ts(i), r[0], r[1], codes[r[2]]].join('\t')).join('\n') + '\n';

  /* 1. The third reviewer's first-paste scenarios S1–S10, each on a fresh Tally: no row is ever on a student's row by the
     account; every row placed is placed where 6444eed placed it (never where it asked, never elsewhere); every exact own
     name from its own address places as on 6444eed; every row the account would have placed waits with the account's
     student as the suggestion, said "from X's school account", and one press of it puts the test on that student. */
  let rowsN = 0, acctN = 0, unsafe = [], exactOwn = 0, exactOwnOk = 0, sugg = 0, suggOk = [], suggBad = [], claims = [], fromLine = 0;
  for (const [label, fx, rows, o = {}] of S) {
    const T = await fresh(fx); const { codes } = T;
    let txt;
    if (o.order) txt = 'Test code\tFirst and last name\tEmail Address\tTimestamp\n' + rows.map((r, i) => [codes[r[2]], r[1], r[0], ts(i)].join('\t')).join('\n') + '\n';
    else if (o.noHead) txt = rows.map((r, i) => [ts(i), r[0], r[1], codes[r[2]]].join('\t')).join('\n') + '\n';
    else txt = sheet(rows, codes);
    const note = await T.paste(txt); if (o.twice) await T.paste(txt); if (CLAIM.test(note)) claims.push(label + ' paste note: ' + note);
    acctN += await T.byAcct();
    const W = []; for (const [i, r] of rows.entries()) { const w = await T.where(codes[r[2]]); W.push(w); rowsN++;
      if (w.where === 'row' && w.who !== OLD[label][i]) unsafe.push(`${label} "${r[1]}" → ${w.who} (6444eed: ${OLD[label][i] || 'waited'})`);
      const own = OLD[label][i] && r[0] === ac(OLD[label][i]); if (own) { exactOwn++; if (w.where === 'row' && w.who === OLD[label][i] && w.how === 'exact') exactOwnOk++; } }
    const txtP = await T.pageText(); if (CLAIM.test(txtP)) claims.push(label + ' page: ' + (txtP.match(CLAIM) || [])[0]);
    { const wt = await T.p.evaluate(() => (document.querySelector('#xtWaiting') || {}).innerText || ''); fromLine += (wt.match(/from [^.()]+'s school account/g) || []).length; }
    for (const [i, r] of rows.entries()) { const w = W[i]; if (!w.from) continue; sugg++;
      if (w.suggest !== w.from || w.where !== 'waiting' || w.conflict) { suggBad.push(`${label} "${r[1]}": suggest ${w.suggest}, from ${w.from}, ${w.where}`); continue; }
      if (r[3] && r[3] !== w.from) suggBad.push(`${label} "${r[1]}": suggested ${w.from}, meant ${r[3]}`); }
    // one press of each suggestion (in order): the test goes on that student, as his own placement
    for (const [i, r] of rows.entries()) { const w0 = W[i]; if (!w0.from) continue; const ok = await T.press(w0.ri); const w = await T.where(codes[r[2]]);
      if (ok && w.where === 'row' && w.who === w0.from && w.how === 'you') suggOk.push(label + ' ' + r[1]); else suggBad.push(`${label} "${r[1]}": pressed ${ok}, now ${w.where} ${w.who} ${w.how}`); }
    acctN += await T.byAcct();
    await T.ctx.close(); }
  check(acctN === 0, `S1–S10 (${rowsN} rows): no row and no test is ever placed by an account (${acctN})`);
  check(!unsafe.length, `S1–S10: every row placed is placed where 6444eed placed it (0 UNSAFE differences)${unsafe.length ? ': ' + unsafe.join('; ') : ''}`);
  check(exactOwn > 0 && exactOwnOk === exactOwn, `S1–S10: every exact own name from its own address places by the name as on 6444eed: ${exactOwnOk} of ${exactOwn}`);
  check(sugg > 0 && !suggBad.length && suggOk.length === sugg && fromLine === sugg, `S1–S10: the ${sugg} rows an account would have placed wait, each with the account's student as the one-press suggestion, the line saying "from X's school account"; one press puts each on that student as his own placement (${suggOk.length} of ${sugg})${suggBad.length ? ': ' + suggBad.join('; ') : ''}`);
  check(!claims.length, 'S1–S10: nowhere does the page say an account places or identifies a test by itself' + (claims.length ? ': ' + claims.join(' | ') : ''));

  /* 2. F2 (third review): an address that reads as nobody, with two students' certain names in one paste, is learned from
     neither, whichever comes first; each name places itself, and a blank row from it waits with no suggestion. */
  for (const order of [0, 1]) { const T = await fresh('fx-accounts'); const { codes } = T; const N = [['s7700123' + D, 'Elsa Lindqvist', 0], ['s7700123' + D, 'Rohan Patel', 1]];
    await T.paste(sheet((order ? N.slice().reverse() : N).concat([['s7700123' + D, '', 2]]), codes));
    const w = [await T.where(codes[0]), await T.where(codes[1]), await T.where(codes[2])]; const acc = await T.A(A => Object.keys(A.examS().accounts));
    check(!acc.length && w[0].who === 'LINDQVIST, ELSA' && w[1].who === 'PATEL, ROHAN' && w[2].where === 'waiting' && !w[2].suggest, `F2 (${order ? 'Rohan' : 'Elsa'} first): one address with two students' certain names is learned from neither; each name places itself; the blank row waits with no suggestion: ${JSON.stringify({ acc, w: w.map(x => x.where + ' ' + x.who + ' ' + (x.suggest || '')) })}`);
    await T.ctx.close(); }

  /* 3. The reviewer's second paste (b-second-paste.js) on accounts learned from exact names: a classmate's first name plus
     an initial, first + middle, single words: all wait (none on a row by the account); then Forget, a blank row from the
     forgotten account answered as Rohan: his press is his, the toast counts the account's other test judged again (F3),
     and Undo puts everything back exactly. */
  { const T = await fresh('fx-accounts'); const { codes, p, A } = T;
    const N = ['KHAN, ALI', 'KHANNA, ALICE', 'BROOKS, AVA', 'NGUYEN, AVA MARIE', 'LINDQVIST, ELSA', 'PATEL, ROHAN'];
    const full = { 'KHAN, ALI': 'Ali Khan', 'KHANNA, ALICE': 'Alice Khanna', 'BROOKS, AVA': 'Ava Brooks', 'NGUYEN, AVA MARIE': 'Ava Nguyen', 'LINDQVIST, ELSA': 'Elsa Lindqvist', 'PATEL, ROHAN': 'Rohan Patel' };
    await T.paste(sheet(N.map((n, i) => [ac(n), full[n], i]), codes));
    const w1 = []; for (let i = 0; i < N.length; i++) w1.push(await T.where(codes[i]));
    check(w1.every((w, i) => w.where === 'row' && w.who === N[i] && w.how === 'exact') && (await A(A => Object.keys(A.examS().accounts).length)) === 6, 'second paste set-up: six exact names from their own addresses place by the name, and the six accounts are learned');
    const rows = [['KHANNA, ALICE', 'Ali K.'], ['KHANNA, ALICE', 'Ali Kh'], ['KHANNA, ALICE', 'A Khan'], ['KHANNA, ALICE', 'Al Khan'], ['BROOKS, AVA', 'Ava Marie'], ['NGUYEN, AVA MARIE', 'Ava B.'], ['NGUYEN, AVA MARIE', 'Ava Br'], ['KHANNA, ALICE', 'Ali'], ['KHANNA, ALICE', 'Khan'], ['LINDQVIST, ELSA', 'Rohan Lindqvist']];
    await T.paste(sheet(rows.map((r, i) => [ac(r[0]), r[1], 10 + i]), codes));
    const w2 = []; for (let i = 0; i < rows.length; i++) w2.push(await T.where(codes[10 + i]));
    check(w2.every(w => w.where === 'waiting') && (await T.byAcct()) === 0, `second paste: all ${rows.length} of the reviewer's rows ("Ali K.", "A Khan", "Ava Marie", "Ava B.", …) wait; none is on a row by the account: ${w2.map(w => w.where).join(', ')}`);
    const E = ac('LINDQVIST, ELSA');
    await T.paste(sheet([[E, '', 22], [E, 'Elsa', 23]], codes));
    await A((A, a) => A.xtForgetAccount(a), E); await p.waitForTimeout(300);
    await T.paste(sheet([[E, '', 24]], codes));
    const snap = () => A(A => { const X = A.examS(); return JSON.stringify({ r: X.recs, rows: X.rows, a: X.accounts, al: X.alias, s: A.xtLedger().at }); }); const s0 = await snap();
    await A((A, c) => { const X = A.examS(); const r = X.rows.find(r => r.codes.includes(c)); const w = A.examRoster().find(x => x.n === 'PATEL, ROHAN'); A.xtAnswer(r, { sec: w.sec, n: w.n }, undefined); }, codes[24]); await p.waitForTimeout(400);
    const toast = (await p.evaluate(() => (document.querySelector('#toast') || {}).innerText || '')).replace(/\s+/g, ' ');
    const w24 = await T.where(codes[24]), w4 = await T.where(codes[4]);
    check(w24.who === 'PATEL, ROHAN' && w24.how === 'you' && w4.where === 'waiting' && /1 other test from it is judged again against it: waiting for you/.test(toast) && !CLAIM.test(toast), `F3: after Forget, his answer that the account is Rohan's is his own placement, Elsa's earlier test from it is judged again and waits, and the toast says so: "${toast}"`);
    await A(A => A.xtUndo()); await p.waitForTimeout(400);
    check((await snap()) === s0, 'and Undo puts back exactly what was there');
    check((await T.byAcct()) === 0, 'second paste, Forget, answer, Undo: no row and no test is ever placed by an account');
    await T.ctx.close(); }

  /* 4. The second review's q4 roster, in the shipped mode: 28 exact names with their own addresses place with zero
     questions; then 28 with a slip, the first name only or no name, from those accounts, each wait with the correct
     one-press suggestion (28 questions, 28 right suggestions), and the 28 presses put each on the right student. */
  { let placed1 = 0, asked1 = [], q2 = 0, right = 0, pressed = 0, bad = [], words = [];
    for (const off of [0, 14]) { const T = await fresh('fx-accounts'); const { codes } = T;
      const ros = (await T.A(A => A.examRoster())).filter(x => /7T4A/.test(x.sec)).slice(off, off + 14);
      const nm = n => { const [l, f] = n.split(', '); const c = s => s.toLowerCase().replace(/(^|[\s'-])\S/g, m => m.toUpperCase()); return c(f.replace(/ JR\.?$/i, '')) + ' ' + c(l); };
      const slip = t => { const [f, l] = t.split(' '); return [f.slice(0, -1) + f.slice(-1).repeat(2), l].join(' '); };
      const note = await T.paste(sheet(ros.map((x, i) => [ac(x.n), nm(x.n), i]), codes));
      if (off === 0) words.push(note);
      for (let i = 0; i < ros.length; i++) { const w = await T.where(codes[i]); if (w.where === 'row' && w.who === ros[i].n && w.how === 'exact') placed1++; else asked1.push(nm(ros[i].n)); }
      await T.paste(sheet(ros.map((x, i) => [ac(x.n), i % 3 === 0 ? slip(nm(x.n)) : i % 3 === 1 ? nm(x.n).split(' ')[0] : '', 14 + i]), codes));
      const W = []; for (let i = 0; i < ros.length; i++) { const w = await T.where(codes[14 + i]); W.push(w); if (w.where === 'waiting') q2++; if (w.where === 'waiting' && w.suggest === ros[i].n && w.from === ros[i].n && !w.conflict) right++; else bad.push(`${ros[i].n}: ${w.where} suggest ${w.suggest}`); }
      if (off === 0) words.push(await T.pageText());
      for (let i = 0; i < ros.length; i++) { await T.press(W[i].ri); const w = await T.where(codes[14 + i]); if (w.where === 'row' && w.who === ros[i].n && w.how === 'you') pressed++; else bad.push(`pressed ${ros[i].n}: ${w.where} ${w.who}`); }
      if ((await T.byAcct()) !== 0) bad.push('placed by an account');
      await T.ctx.close(); }
    check(placed1 === 28, `q4, shipped: exact names with their own addresses ${placed1} of 28 placed by the name, with zero questions${asked1.length ? '; asked: ' + asked1.join(', ') : ''}`);
    check(q2 === 28 && right === 28 && pressed === 28 && !bad.length, `q4, shipped: slips, first names only or no name: ${q2} of 28 wait (28 questions), ${right} of 28 with the right one-press suggestion, ${pressed} of 28 on the right student after the press${bad.length ? ': ' + bad.join('; ') : ''}`);
    check(/uses the school account to suggest the student and learns it; you confirm/.test(words[0]) && !CLAIM.test(words[0]), `under the paste: "${words[0]}"`);
    check(/from .+'s school account/.test(words[1]) && !CLAIM.test(words[1]), 'the waiting rows say "from X\'s school account", and nowhere that the account places a test by itself'); }

  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close(); done();
})();
