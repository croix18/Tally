// Tests: nothing is ever in limbo (Croix after the second review, R2-C2). After EVERY action he can take, every test Tally
// holds is in exactly one place — a student's row, "Waiting for you", or "Nobody turned in" — and the count line under the
// list adds up. Random sequences of actions run on the fixture classes and records (synthetic): place, Yes, Someone else,
// Not theirs (a student, Nobody yet, Cancel), Undo, give by hand, take back, Nobody yet, dismiss, bring back, paste and paste
// again, a roster that moves, drops, renames or adds a namesake, a class deleted, a Full save opened. The first violation
// fails the suite and prints the sequence that made it. Undo must give back exactly what was there before; Cancel must
// change nothing. Half the sequences run with the rosters' Student IDs, half without.
//   INV_N=<sequences> (default 2000), INV_SEED=<seed>. About 0.2 s a sequence on this machine.
// run.js timeout: 1200 s
const { chromium, fs, path, exe, check, done, pick, APP } = require('./lib');
const SEAL = require('../vendor/seal.js');
const FX = n => path.resolve('fixtures', 'exams', n);
const N = +process.env.INV_N || 2000, SEED = +process.env.INV_SEED || 20261116, STEPS = 7;
(async () => {
  const K = JSON.parse(fs.readFileSync(FX('keys.json'), 'utf8')); const LOCKED = JSON.parse(fs.readFileSync(FX('locked.json'), 'utf8'));
  // lesson tests too (16 Nov 2026): two tests of one unit in play (the unit test and Lesson 10.03, a two-lesson day in 5th)
  const F = require('./exam/fixtures.js'); const LS = F.lessons(F.build(), SEAL.newCode); for (const x of LS) LOCKED[x.record.code] = await SEAL.seal(x.record, K.site.priv, K.tally.pub);
  const lessonRows = LS.map((x, i) => `11/17/2026 11:${String(10 + i).padStart(2, '0')}:00\t\t${x.who.sec}\t${F.firstLast(x.who.n).replace(' Jr.', '')}\t${x.record.code}\t`).join('\n');
  const browser = await chromium.launch({ executablePath: exe }); const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400);
  const A = (fn, arg) => p.evaluate(([s, a]) => (new Function('A', 'arg', 'return (' + s + ')(A, arg)'))(window.__all, a), [fn.toString(), arg === undefined ? null : arg]);
  await p.setInputFiles('#file', fs.readdirSync(FX('')).filter(f => /^IXL-Score-Grid/.test(f)).map(FX)); await p.waitForTimeout(900);
  for (const f of ['focus_gradebook_p4.csv', 'focus_gradebook_p5.csv']) { await p.setInputFiles('#file', [FX(f)]); await p.waitForTimeout(700); await pick(p); await p.waitForTimeout(300); const a = await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(200); } }
  // connected; every fixture record this Tally can open put in; the response sheet read (no network: nothing is fetched)
  const setup = await A(async (A, a) => { const X = A.examS(); X.pairs = [JSON.stringify({ priv: a.K.tally.priv, pub: a.K.tally.pub, made: new Date().toISOString() })]; X.sites = [{ key: a.K.site.pub, made: 1, got: new Date().toISOString(), paired: new Date().toISOString() }]; X.trial = { code: 'X', words: 'a b c d', at: new Date().toISOString(), key: a.K.site.pub }; X.warned = true; A.xtLocalAdd('mine', a.K.tally.pub); A.xtLocalAdd('checked', a.K.site.pub);
    let n = 0; window.__later = []; for (const [i, code] of Object.keys(a.L).entries()) { if (i % 4 === 3) { window.__later.push(code); continue; } try { const { rec, checked } = await A.examOpen(a.L[code], code); if (rec.trial) continue; await A.examPut(code, a.L[code], rec, checked, 'site'); n++; } catch (e) {} }
    A.examTakeSheet(a.sheet, 'paste');
    // rosters as roster text only (a gradebook's students would come back as extras when a line is dropped)
    for (const k of A.state.order) { const s = A.state.sections[k]; s.roster = A.rosterFromGradebook(s, s.grades); s.grades = null; }
    { const s = A.state.sections[A.state.order[0]]; s.roster += '\n3333399001\tKHAN, ALI\n3333399002\tKHANNA, ALICE\n3333399003\tHUGHES, DANA\n3333399004\tHUGHES, DARIA'; }   // look-alikes, so the account rule meets the names it is about (second review)
    A.save(); A.view.mode = 'tests'; A.render();
    return { n, held: Object.keys(X.recs).length, classes: A.state.order.length };
  }, { K, L: LOCKED, sheet: fs.readFileSync(FX('responses.tsv'), 'utf8').trimEnd() + '\n' + lessonRows + '\n' });
  check(setup.n >= 20 && setup.classes === 2, `the fixture: ${setup.n} tests held in ${setup.classes} classes, the response sheet read`);

  // the site, as a stand-in inside the page: a held-back fixture record by its code (a few ms later), else "none"; the key
  await p.evaluate(a => { window.__site = a; window.fetch = async url => { const u = String(url); { const c0 = (/result\/([0-9A-Z]{12})$/.exec(u) || [])[1]; if (c0 && window.__all.examS().deleted[c0] && !(window.__inv && window.__inv.bringing === c0)) (window.__fetchBad = window.__fetchBad || []).push(c0); } await new Promise(r => setTimeout(r, 2 + Math.random() * 25));
    if (/\/api\/test\/key$/.test(u)) return new Response(JSON.stringify({ key: a.key, made: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const c = (/result\/([0-9A-Z]{12})$/.exec(u) || [])[1]; return c && a.L[c] ? new Response(JSON.stringify({ code: c, record: a.L[c] }), { status: 200 }) : new Response(JSON.stringify({ error: 'none' }), { status: 404 }); }; }, { L: LOCKED, key: K.site.pub });
  // the runner, in the page: one call runs a batch of sequences and returns the first violation (with its sequence)
  await p.evaluate(() => {
    const A = window.__all;
    window.__inv = { start: null };
    const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const tests = () => { const X = A.examS(); return JSON.stringify({ recs: X.recs, rows: X.rows, alias: X.alias, picks: X.picks, dismissed: X.dismissed, seen: X.seen, fails: X.fails, deleted: X.deleted, accounts: X.accounts }); };
    const lines = s => String(s.roster || '').split('\n').filter(l => l.trim());
    const modal = () => document.querySelector('#modal:not(.hidden)');
    const shut = () => { const m = modal(); if (m && m._cancel) m._cancel(); };
    /* the table's strength order, written here on its own: 5 exact full name · 4 near (each part exact or one slip) · 3 a
       nickname or prefix of the first name with the last · 2 the first or last name alone, exactly · 1 a part, prefix or
       look-alike · 0 none */
    window.__inv.strength = (typed, display) => {
      const tok = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/['’]/g, '').replace(/[^a-z]+/g, ' ').trim().split(' ').filter(w => w && !/^(jr|sr|ii|iii|iv|v)$/.test(w));
      const ed = (a, b) => { const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; } for (let j = 0; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) { d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); } return d[a.length][b.length]; };
      const groups = (A.EX().NICKNAMES || []).map(l => l.split(' ')); const nick = (a, b) => groups.some(g => g.includes(a) && g.includes(b));
      const T = tok(typed); const c = String(display).indexOf(','); if (!T.length || c < 0) return 0;
      const Ls0 = tok(String(display).slice(0, c)), Fs = tok(String(display).slice(c + 1)); if (!Fs.length || !Ls0.length) return 0; const first = Fs[0], Ls = Ls0.concat(Ls0.length > 1 ? [Ls0.join('')] : []);
      if (T.length >= 2 && T.every(t => Fs.includes(t) || Ls.includes(t)) && T.includes(first) && Ls0.some(l => T.includes(l))) return 5;
      const fr = t => Fs.includes(t) ? 3 : Fs.some(f => Math.min(f.length, t.length) >= 3 && ed(t, f) <= 1) ? 2 : Fs.some(f => nick(t, f) || (t.length >= 2 && f.startsWith(t))) ? 1 : 0;
      const lr = t => Ls.includes(t) ? 3 : Ls.some(l => Math.min(l.length, t.length) >= 3 && ed(t, l) <= 1) ? 2 : Ls.some(l => t.length >= 3 && l.startsWith(t)) ? 1 : 0;
      if (T.length === 1) return Fs.includes(T[0]) || Ls.includes(T[0]) ? 2 : fr(T[0]) || lr(T[0]) ? 1 : 0;
      let best = 0; T.forEach((a, i) => T.forEach((b, j) => { if (i === j) return; const x = fr(a), y = lr(b); if (x && y) best = Math.max(best, x >= 2 && y >= 2 ? 4 : 3); }));
      return best || (T.some(t => fr(t) || lr(t)) ? 1 : 0); };
    window.__inv.idle = async () => { for (let i = 0; i < 400 && ((A.examJob && A.examJob.running) || A.xtQueue.size); i++) await new Promise(r => setTimeout(r, 10)); await new Promise(r => setTimeout(r, 5)); for (let i = 0; i < 400 && A.examJob && A.examJob.running; i++) await new Promise(r => setTimeout(r, 10)); };
    window.__inv.save0 = () => { window.__inv.start = JSON.stringify(A.stateForSave()); const r = {}; A.state.order.forEach(k => { r[k] = A.state.sections[k].roster; }); window.__inv.rosters = r; window.__inv.order = A.state.order.slice(); window.__inv.exam = JSON.stringify(A.state.exam); window.__inv.whole = true; };
    window.__inv.reset = async ids => { shut(); A.xtAutoTried.clear();
      // quick: only Tests and the rosters changed in the last sequence (no class deleted, no Full save opened)
      if (!window.__inv.whole) { A.state.exam = A.cleanExam(JSON.parse(window.__inv.exam)); A.state.order = window.__inv.order.slice(); for (const k of A.state.order) A.state.sections[k].roster = ids ? window.__inv.rosters[k] : String(window.__inv.rosters[k] || '').replace(/^\d{4,}\t/gm, '');
        A.view.mode = 'tests'; A.view.code = null; A.state.active = A.state.order[0]; A.render(); return; }
      window.__inv.whole = false; const s = JSON.parse(window.__inv.start); if (!ids) for (const k of Object.keys(s.sections)) s.sections[k].roster = String(s.sections[k].roster || '').replace(/^\d{4,}\t/gm, '');
      A.adopt(A.hydrate(s) || s); if (A.xtVer.size < Object.keys(A.examS().recs).length) await A.examVerifyAll(); /* the same tests, checked once already this session */ A.view.mode = 'tests'; A.view.code = null; A.state.active = A.state.order[0]; A.render(); };
    // where everything is, checked three ways: the ledger, the page, and every class's rows
    window.__inv.check = () => {
      const X = A.examS(), L = A.xtLedger(), held = Object.keys(X.recs), all = Object.keys(L.at), bad = [];
      const seen = {}; ['row', 'waiting', 'nobody'].forEach(w => L[w].forEach(c => { seen[c] = (seen[c] || []).concat(w); }));
      held.forEach(c => { if (!seen[c] || seen[c].length !== 1) bad.push(`${c} is in ${(seen[c] || ['nowhere']).join(' and ')}`); });
      // an account is one student's; a row placed by an account is placed by the account Tally holds; a forgotten account places nothing
      // THE ACCOUNT RULE, from the second review's table, judged here by an oracle of this suite's own (window.__inv.strength,
      // written from the table, never the code's helpers): a row placed by an account, with a name typed, must point at the
      // account's student at all and at nobody else more strongly; and no row from an address whose account now names someone
      // else stays placed by the old basis (unless he placed it himself)
      { const ros = A.examRoster(); X.rows.forEach(r => { if (!r.who || r.how === 'you') return; const E = r.addr && X.accounts[r.addr];
          if (E && !(E.sec === r.who.sec && E.n === r.who.n)) { bad.push(`row ${r.line} from ${r.addr} stays with ${r.who.n} (how ${r.how}) though the account is ${E.n}'s now`); return; }
          if (r.how !== 'account' || r.kept || !r.name) return; const st = window.__inv.strength; const sX = st(r.name, r.who.n); const top = Math.max(0, ...ros.filter(x => !(x.sec === r.who.sec && x.n === r.who.n)).map(x => st(r.name, x.n)));
          if (!(sX > 0 && sX >= top)) bad.push(`row ${r.line} ("${r.name}") is placed with ${r.who.n} by the account, though the name points at someone else as strongly or more (${sX} vs ${top})`); }); }
      X.rows.forEach(r => { if (r.how === 'account' && !r.kept) { const w = X.accounts[r.addr]; if (!w || w.gone || w.sec !== r.who.sec || w.n !== r.who.n) bad.push(`row ${r.line} is placed by the account ${r.addr}, which Tally does not hold for ${r.who && r.who.n}`); } });
      Object.keys(X.deleted || {}).forEach(c => { if (L.at[c] || X.recs[c]) bad.push(`${c} is deleted but still held or listed`); });
      if ((window.__fetchBad || []).length) bad.push('a deleted test was fetched without Bring back: ' + window.__fetchBad.splice(0).join(', '));
      Object.keys(seen).forEach(c => { if (!X.recs[c] && !(L.at[c].why === 'unfetched' && X.rows.some(r => r.codes.includes(c)))) bad.push(`${c} listed but neither held nor named by a response`); });
      X.rows.forEach(r => r.codes.forEach(c => { if (!L.at[c] && !(X.deleted || {})[c] && !(X.fails[c] && X.fails[c].why !== 'net')) bad.push(`${c} is named by a response but is in no list (not held, not fetched, not failed)`); }));
      // the page (a class's Tests, as he sees it)
      const cnt = (document.querySelector('#xtCount') || {}).textContent || '';
      const m = /All classes: (\d+) tests? = (\d+) with a student \+ (\d+) waiting for you \+ (\d+) nobody turned in/.exec(cnt);
      if (all.length && !m) bad.push('no count line: ' + cnt.slice(0, 80));
      if (m && (+m[1] !== all.length || +m[2] !== L.row.length || +m[3] !== L.waiting.length || +m[4] !== L.nobody.length || +m[1] !== +m[2] + +m[3] + +m[4])) bad.push('count line does not add up or does not match: ' + cnt);
      const dom = sel => [...document.querySelectorAll(sel)].map(li => li.dataset.xled).sort().join(',');
      if (dom('#xtWaiting li[data-xled]') !== L.waiting.slice().sort().join(',')) bad.push('the Waiting list on the page is not the waiting tests');
      if (dom('#xtNobody li[data-xled]') !== L.nobody.slice().sort().join(',')) bad.push('the Nobody list on the page is not the nobody tests');
      // every test on a row is on that student's row of its own test, and no row shows a test that is not 'row'
      const C = A.EX();
      for (const c of L.row) { const to = L.at[c].to, s = A.state.sections[to && to.sec], u = X.recs[c].sum;
        if (!s || !A.classStudents(s).includes(to.n)) { bad.push(`${c} is on a row of ${to && to.n} (${to && to.sec}), who is not on a roster`); continue; }
        const Mo = A.xtModel(s, { course: u.course, unit: u.unit, scope: u.scope || '', scopeName: u.scopeName || '', key: C.testKey(u.course, u.unit, u.scope) }, L); const r = Mo.rows.find(x => x.n === to.n);
        if (!r || !r.mine.some(x => x.code === c)) bad.push(`${c} should be on ${to.n}'s row and is not`); }
      for (const k of A.state.order) { const s = A.state.sections[k]; for (const t of A.xtTests(s)) for (const r of A.xtModel(s, t, L).rows) for (const x of r.mine) if (L.at[x.code].where !== 'row') bad.push(`${x.code} shows on ${r.n}'s row but is ${L.at[x.code].where}`); }
      // the rendered class: each test on its rows is shown there (its score, a "choose", or being checked)
      if (A.view.mode === 'tests' && !A.view.code && document.querySelector('.xtList')) { const s = A.state.sections[A.state.active]; const { t } = A.xtCurrent(s);
        for (const r of A.xtModel(s, t, L).rows) if (r.mine.length) { const tr = [...document.querySelectorAll('.xtList tbody tr')].find(x => (x.querySelector('.nm') || {}).textContent === A.shown(r.n)); const txt = tr ? tr.textContent : '';
          if (!tr || !(tr.dataset.xcode || /choose the one that counts|Checking/.test(txt))) bad.push(`${r.n}'s test is not shown on their row`); } }
      return bad;
    };
    const pickOf = (R, l) => l.length ? l[Math.floor(R() * l.length)] : null;
    const roster = () => A.examRoster();
    const placed = () => Object.keys(A.examS().recs).filter(c => A.examS().recs[c].who);
    // the actions: each returns a word for the sequence, and what it promises (undo: the state it must give back)
    const ACT = {
      answer: R => { const r = pickOf(R, A.examS().rows.filter(x => x.codes.length)), c = pickOf(R, roster()); if (!r || !c) return null; A.xtAnswer(r, { sec: c.sec, n: c.n }); return `answer row ${r.line} = ${c.n}`; },
      yes: R => { const r = pickOf(R, A.examS().rows.filter(x => x.suggest && !x.who)); if (!r) return null; A.xtAnswer(r, r.suggest); return `Yes row ${r.line}`; },
      someone: R => { const r = pickOf(R, A.examS().rows.filter(x => x.codes.length && !x.who)); if (!r) return null; A.xtWho(A.state.sections[A.state.active], r); return 'Someone else row ' + r.line + ': ' + ACT.modal(R); },
      not: R => { const c = pickOf(R, placed()); if (!c) return null; A.xtNotTheirs(A.state.sections[A.state.active], c); return 'Not theirs ' + c + ': ' + ACT.modal(R); },
      give: R => { const c = pickOf(R, Object.keys(A.examS().recs)), s = pickOf(R, roster()); if (!c || !s) return null; A.xtGive(c, { sec: s.sec, n: s.n }); return `give ${c} to ${s.n}`; },
      takeBack: R => { const c = pickOf(R, placed().filter(x => A.examS().recs[x].who.how === 'you')); if (!c) return null; A.xtNotTheirs(A.state.sections[A.state.active], c); const b = document.querySelector('#modal [data-xextra="nobody"]'); if (!b) return 'take back: no dialog'; b.click(); return 'take back ' + c; },
      nobody: R => { const c = pickOf(R, Object.keys(A.examS().recs)); if (!c) return null; A.xtNobody(c); return 'Nobody yet ' + c; },
      undo: R => { const u = A.xtLastUndo; if (!u) return null; const want = window.__inv.before; const ok = A.xtUndo(u); window.__inv.undid = ok ? want : null; return 'Undo'; },
      dismiss: R => { A.render(); const b = pickOf(R, [...document.querySelectorAll('[data-xdis]')]); if (!b) return null; b.click(); return 'dismiss ' + b.dataset.xdis.split('|')[0]; },
      bring: R => { A.render(); const b = pickOf(R, [...document.querySelectorAll('[data-xundis]')]); if (!b) return null; b.click(); return 'bring back'; },
      paste: R => { const X = A.examS(); const codes = Object.keys(X.recs); const names = roster().map(x => x.n); const rows = ['Timestamp\tFull name\tYour test code'];
        for (let i = 0; i < 1 + Math.floor(R() * 4); i++) { const n = pickOf(R, names) || 'Nobody Here'; const m = /^([^,]+),\s*(\S+)/.exec(n); let typed = m ? m[2] + ' ' + m[1] : n; if (R() < 0.3) typed = typed.slice(0, -1); if (R() < 0.15) typed = typed.split(' ')[0];
          rows.push(`11/${17 + Math.floor(R() * 3)}/2026 ${10 + Math.floor(R() * 3)}:${String(Math.floor(R() * 60)).padStart(2, '0')}:00\t${typed}\t${R() < 0.1 ? 'NOTACODE' : pickOf(R, codes)}`); }
        A.examTakeSheet(rows.join('\n'), 'paste'); A.render(); return 'paste ' + (rows.length - 1) + ' rows'; },
      pasteFetch: R => { const codes = window.__later.concat(['ZZZZZZZZZZZ' + 'ABCDEFGH'[Math.floor(R() * 8)]]); const names = roster().map(x => x.n); const rows = ['Timestamp\tFull name\tYour test code'];
        for (let i = 0; i < 1 + Math.floor(R() * 3); i++) { const n = pickOf(R, names) || 'Nobody Here'; const m = /^([^,]+),\s*(\S+)/.exec(n); rows.push(`11/18/2026 1${Math.floor(R() * 3)}:${String(Math.floor(R() * 60)).padStart(2, '0')}:0${i}\t${m ? m[2] + ' ' + m[1] : n}\t${pickOf(R, codes)}`); }
        const r = A.examTakeSheet(rows.join('\n'), 'paste'); A.render(); if (r.ok) { if (A.examJob && A.examJob.running) window.__inv.overlap = (window.__inv.overlap || 0) + 1; A.examFetch(r.codes); } return 'paste and fetch ' + (rows.length - 1) + ' rows' + (A.examJob && A.examJob.running ? ' (a fetch running)' : ''); },
      waitFetch: async R => { if (!(A.examJob && A.examJob.running)) return null; await window.__inv.idle(); return 'the fetching ends'; },
      // school accounts: rows from an address (learned, new, or a classmate's), with the name right, mistyped, someone else's or none
      pasteAcct: R => { const X = A.examS(); const ros = roster(); const known = Object.keys(X.accounts || {}); const codes = Object.keys(X.recs); const rows = ['Timestamp\tEmail Address\tFirst and last name\tTest code'];
        for (let i = 0; i < 1 + Math.floor(R() * 3); i++) { const useKnown = R() < 0.45 && known.length; const ka = useKnown ? pickOf(R, known) : null; const owner = ka && ros.find(x => x.sec === X.accounts[ka].sec && x.n === X.accounts[ka].n);
          const st = owner && R() < 0.75 ? owner : R() < 0.35 ? pickOf(R, ros.filter(x => /^(KHAN, ALI|KHANNA, ALICE|HUGHES, DANA|HUGHES, DARIA)$/.test(x.n))) || pickOf(R, ros) : pickOf(R, ros); const m = /^([^,]+),\s*(\S+)/.exec(st.n) || [, st.n, '']; const ad = ka || (m[2][0] + m[1]).toLowerCase().replace(/[^a-z]/g, '') + Math.floor(R() * 90) + '@students.example.org';
          const LA = { 'KHAN, ALI': 'KHANNA, ALICE', 'KHANNA, ALICE': 'KHAN, ALI', 'HUGHES, DANA': 'HUGHES, DARIA', 'HUGHES, DARIA': 'HUGHES, DANA' }; const other = (LA[st.n] && R() < 0.7 && ros.find(x => x.n === LA[st.n])) || pickOf(R, ros); const o = /^([^,]+),\s*(\S+)/.exec(other.n) || [, other.n, '']; const nm = [m[2] + ' ' + m[1], o[2] + ' ' + o[1], (m[2] + ' ' + m[1]).slice(0, -2), '', o[2], m[2]][Math.floor(R() * 6)];
          rows.push(`11/19/2026 9:${String(Math.floor(R() * 60)).padStart(2, '0')}:0${i}\t${ad}\t${nm}\t${pickOf(R, codes)}`); }
        A.examTakeSheet(rows.join('\n'), 'paste'); A.render(); return 'paste ' + (rows.length - 1) + ' rows with school accounts'; },
      forgetAcct: R => { A.view.xquiet = true; A.render(); const b = pickOf(R, [...document.querySelectorAll('[data-xfacct]')]); if (!b) return null; b.click(); return 'forget an account'; },
      conflict: R => { A.render(); const b = pickOf(R, [...document.querySelectorAll('[data-xconf]')]); if (!b) return null; b.click(); const m = modal(); if (!m) return 'conflict: no dialog'; const x = R();
        if (x < 0.25) { const before = tests(); m.querySelector('#mCancel').click(); A.render(); if (tests() !== before) window.__inv.cancelBroke = true; return 'conflict: Cancel'; }
        const c = pickOf(R, [...m.querySelectorAll('[data-ch]')]); if (!c) { m.querySelector('#mCancel').click(); return 'conflict: none'; } const k = c.dataset.ch; c.click(); return 'conflict: ' + k; },
      del: R => { const X = A.examS(); const c = pickOf(R, Object.keys(X.recs).concat(A.examUnfetched())); if (!c) return null; A.xtDeleteAsk(c); const m = modal(); if (!m) return 'delete: no dialog';
        if (R() < 0.2) { const before = tests(); m.querySelector('#mCancel').click(); if (tests() !== before) window.__inv.cancelBroke = true; return 'delete ' + c + ': Cancel'; } m.querySelector('#xtDelGo').click(); return 'delete ' + c; },
      back: async R => { const c = pickOf(R, Object.keys(A.examS().deleted || {})); if (!c) return null; await window.__inv.idle(); window.__inv.bringing = c; await A.xtBringBack(c); window.__inv.bringing = null; return 'bring back ' + c + (A.examS().recs[c] ? '' : ' (stays deleted)'); },
      roster: R => { const k = pickOf(R, A.state.order); if (!k) return null; const s = A.state.sections[k], l = lines(s); const what = pickOf(R, ['drop', 'rename', 'move', 'namesake']); const i = Math.floor(R() * l.length); if (!l.length) return null;
        if (what === 'drop') { l.splice(i, 1); s.roster = l.join('\n'); }
        else if (what === 'rename') { l[i] = l[i].replace(/^(\d+\t)?([^,]+),/, (x, id, last) => (id || '') + last + '-ORTIZ,'); s.roster = l.join('\n'); }
        else { const o = pickOf(R, A.state.order.filter(x => x !== k)); if (!o) return null; const line = l[i]; if (what === 'move') { l.splice(i, 1); s.roster = l.join('\n'); }
          const so = A.state.sections[o]; so.roster = lines(so).concat([what === 'namesake' ? line.replace(/^\d+/, id => String(+id + 7)) : line]).join('\n'); }
        A.save(); A.render(); return `roster ${what} in ${k}`; },
      delClass: R => { if (A.state.order.length < 2 || R() < 0.6) return null; window.__inv.whole = true; const k = pickOf(R, A.state.order); delete A.state.sections[k]; A.state.order = A.state.order.filter(x => x !== k); A.state.active = A.state.order[0]; A.save(); A.render(); return 'delete class ' + k; },
      full: async R => { window.__inv.whole = true; const st0 = A.stateForSave(); st0.exam = A.examForSave(st0.exam); const j = JSON.parse(JSON.stringify(st0)); const keys = A.examKeysNow(); A.adopt(A.hydrate(j) || j); A.examKeepKeys(keys); A.examReset(new Date().toISOString()); await A.examLoadLocked(); await A.examVerifyAll(); A.view.mode = 'tests'; A.render(); return 'open a Full save'; },
      // a dialog that is open: a student, Nobody yet, or Cancel (Cancel must change nothing)
      modal: R => { const m = modal(); if (!m) return 'no dialog'; const x = R(); if (x < 0.34) { const before = tests(); m.querySelector('#mCancel').click(); A.render(); if (tests() !== before) window.__inv.cancelBroke = true; return 'Cancel'; }
        if (x < 0.6) { const b = m.querySelector('[data-xextra="nobody"]'); if (b) { b.click(); return 'Nobody yet'; } }
        const bs = [...m.querySelectorAll('.xtWho')]; const b = pickOf(R, bs); if (!b) { m.querySelector('#mCancel').click(); return 'Cancel (empty)'; } const t = b.textContent; b.click(); return 'picked ' + t.slice(0, 30); }
    };
    const NAMES = ['answer', 'yes', 'someone', 'not', 'give', 'takeBack', 'nobody', 'undo', 'undo', 'dismiss', 'bring', 'paste', 'pasteFetch', 'pasteFetch', 'waitFetch', 'del', 'del', 'back', 'pasteAcct', 'pasteAcct', 'pasteAcct', 'forgetAcct', 'conflict', 'conflict', 'roster', 'roster', 'delClass', 'full'];
    window.__inv.run = async (from, n, steps, seed) => {
      const t0 = performance.now(); let acts = 0;
      for (let q = from; q < from + n; q++) {
        const R = rng(seed + q * 7919); const ids = q % 2 === 0; await window.__inv.idle(); await window.__inv.reset(ids); const seq = [ids ? '(with Student IDs)' : '(no Student IDs)'];
        for (let st = 0; st < steps; st++) {
          const name = NAMES[Math.floor(R() * NAMES.length)]; window.__inv.cancelBroke = false; window.__inv.undid = undefined;
          const pre = tests(), u0 = A.xtLastUndo;
          const k = pickOf(R, A.state.order); if (k) { A.state.active = k; A.view.code = null; }
          let w; try { w = await ACT[name](R); } catch (e) { return { q, seq: seq.concat([name + ' THREW ' + e.message]), bad: [String(e.stack || e).slice(0, 300)] }; }
          shut();
          if (w == null) continue; seq.push(w); acts++;
          A.view.mode = 'tests'; A.view.code = null; A.render();
          const bad = window.__inv.check();
          if (window.__inv.cancelBroke) bad.push('Cancel changed what Tests held');
          if (name === 'undo' && window.__inv.undid && tests() !== window.__inv.undid) { const x = JSON.parse(window.__inv.undid), y = JSON.parse(tests()); const dif = []; const walk = (a, b, p) => { if (dif.length > 3) return; if (JSON.stringify(a) === JSON.stringify(b)) return; if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], p + '.' + k); } else dif.push(p + ': ' + JSON.stringify(a) + ' → ' + JSON.stringify(b)); }; walk(x, y, '');
            bad.push('Undo did not give back exactly what was there before the last action: ' + dif.join(' | ').slice(0, 600)); }
          if (A.xtLastUndo && A.xtLastUndo !== u0) window.__inv.before = pre;   // what Undo must give back: the state just before the action it undoes
          if (bad.length) return { q, seq, bad };
        }
        // when the fetching is over, every code a response names was fetched (or the site answered for it): none left behind (R3-H1)
        await window.__inv.idle(); A.view.mode = 'tests'; A.render(); const left = A.examUnfetched().filter(c => !A.examS().fails[c]); const bad = window.__inv.check();
        if (left.length) bad.push('after the fetching ended, codes a response names were never fetched: ' + left.join(', '));
        if (bad.length) return { q, seq: seq.concat(['(the fetching ends)']), bad };
      }
      return { ok: true, acts, ms: Math.round(performance.now() - t0) };
    };
  });
  await p.evaluate(async () => { window.__all.render(); await new Promise(r => setTimeout(r, 50)); await window.__inv.idle(); window.__all.render(); window.__inv.save0(); });   // the fixture's responses fetched first

  /* R2-C1: a placement belongs to one child, not to a name. Each case from the fixture as set up. */
  const c1 = await p.evaluate(async () => { const A = window.__all, out = {};
    const one = async (ids, fn) => { await window.__inv.reset(ids); const L = A.xtLedger(); const k4 = A.state.order[0], k5 = A.state.order[1];
      const code = L.row.find(c => L.at[c].to.sec === k4 && A.examS().recs[c].who.how === 'exact') || L.row.find(c => L.at[c].to.sec === k4); const n = A.examS().recs[code].who.n; const S = A.state.sections;
      const line = String(S[k4].roster).split('\n').find(l => l.endsWith('\t' + n) || l === n);
      fn({ S, k4, k5, n, line }); A.render(); const e = A.examS().recs[code]; const L2 = A.xtLedger();
      return { where: L2.at[code].where, who: e.who && (e.who.sec === k5 ? '5th|' : '4th|') + e.who.n, gone: e.gone ? e.gone.n + ' (' + e.gone.cl + ')' : null, text: (document.querySelector('#xtNobody') || {}).textContent || '' }; };
    const drop = (S, k, l) => { S[k].roster = String(S[k].roster).split('\n').filter(x => x !== l).join('\n'); };
    const add = (S, k, l) => { S[k].roster = String(S[k].roster) + '\n' + l; };
    // a namesake already in another class, then the student leaves: the test does not move to the namesake
    out.namesake = await one(false, ({ S, k4, k5, line }) => { add(S, k5, line); A.render(); drop(S, k4, line); });
    // the same, with Student IDs (the namesake has another ID)
    out.namesakeIds = await one(true, ({ S, k4, k5, line }) => { add(S, k5, line.replace(/^\d+/, id => String(+id + 1))); A.render(); drop(S, k4, line); });
    // plainly the same child moved: gone from 4th and new in 5th in one import, no one of that name anywhere before
    out.moved = await one(false, ({ S, k4, k5, line }) => { drop(S, k4, line); add(S, k5, line); });
    // renamed in Focus, the same Student ID: the test stays with them
    out.renamed = await one(true, ({ S, k4, line }) => { S[k4].roster = String(S[k4].roster).replace(line, line.replace(/\t([^,]+),/, '\t$1-ORTIZ,')); });
    // an ID now on another child (a name that shares no word): not trusted
    out.idOnOther = await one(true, ({ S, k4, line }) => { S[k4].roster = String(S[k4].roster).replace(line, line.replace(/\t.*$/, '\tZZYZX, QUENTIN')); });
    return out; });
  // R2-L1: the give dialog never shows the summary of a test not checked this session
  const l1 = await p.evaluate(async () => { const A = window.__all; await window.__inv.reset(true); const code = A.xtLedger().row[0]; A.xtVer.set(code, 'missing'); A.xtChoose(A.state.sections[A.state.active], code, 'give'); const t = document.querySelector('#modal .body p').textContent; document.querySelector('#modal #mCancel').click(); A.xtVer.set(code, 'ok'); return t; });
  check(!/\d+ \/ \d+/.test(l1), 'R2-L1: "Give it to a student" for a test not checked this session shows no score or times: ' + l1.slice(0, 60));
  // R3-L2: a question open when a Full save is opened is closed, not answered into the new data
  const l2 = await p.evaluate(async () => { const A = window.__all; await window.__inv.reset(true); const r = A.examS().rows.find(x => x.codes.length && !x.who); A.xtWho(A.state.sections[A.state.active], r);
    const open1 = !document.querySelector('#modal').classList.contains('hidden'); const st0 = A.stateForSave(); st0.exam = A.examForSave(st0.exam); const j = JSON.parse(JSON.stringify(st0)); A.adopt(A.hydrate(j) || j); A.examReset(new Date().toISOString());
    const open2 = !document.querySelector('#modal').classList.contains('hidden'); const a0 = JSON.stringify(A.examS().alias); const b = document.querySelector('#modal .xtWho'); if (b) b.click(); await A.examLoadLocked(); await A.examVerifyAll(); window.__inv.whole = true; return { open1, open2, same: JSON.stringify(A.examS().alias) === a0 }; });
  check(l2.open1 && !l2.open2 && l2.same, 'R3-L2: a "Who turned this in?" question open when a Full save is opened is closed, and nothing is answered into the new data');
  check(c1.namesake.where === 'nobody' && !c1.namesake.who && /no longer on that roster/.test(c1.namesake.text) && c1.namesake.gone, 'R2-C1: a student leaves while another child of the same name is in another class: the test goes to Nobody turned in ("' + (c1.namesake.text.match(/It had been[^.]*\./) || [''])[0] + '"), never to the namesake');
  check(c1.namesakeIds.where === 'nobody' && !c1.namesakeIds.who, 'R2-C1: the same with Student IDs (the namesake\'s ID differs): nobody\'s, not the namesake\'s');
  check(c1.moved.where === 'row' && /^5th\|/.test(c1.moved.who || ''), 'R2-C1: plainly the same child moved (gone from one class and new in another in one import, no namesake before): the test follows them');
  check(c1.renamed.where === 'row' && /-ORTIZ/.test(c1.renamed.who || ''), 'R2-C1: renamed in Focus with the same Student ID: the test stays with them');
  check(c1.idOnOther.where === 'nobody', 'R2-C1: a Student ID that is now on a name sharing no word with the one it had is not trusted: nobody\'s');
  let total = 0, acts = 0, fail = null; const t0 = Date.now(); const B = 50;
  const FROM = +process.env.INV_FROM || 0;   // to replay from a given sequence (each one starts from the same state)
  for (let q = FROM; q < N && !fail; q += B) { const r = await p.evaluate(([q, n, s, seed]) => window.__inv.run(q, n, s, seed), [q, Math.min(B, N - q), STEPS, SEED]); if (!r.ok) fail = r; else { total += Math.min(B, N - q); acts += r.acts; } }
  if (fail) console.log('VIOLATION in sequence', fail.q, '(seed ' + SEED + '):\n  ' + fail.seq.join('\n  ') + '\n  -> ' + fail.bad.join('\n  -> '));
  const overlap = await p.evaluate(() => window.__inv.overlap || 0);
  console.log(`RAN ${total} random sequences, ${acts} actions (${overlap} pastes made while a fetch was running), ${((Date.now() - t0) / 1000).toFixed(1)} s (seed ${SEED})`);
  check(!fail, `after every action of ${total} random sequences (${acts} actions: place, Yes, Someone else, Not theirs, Cancel, Undo, give, take back, Nobody yet, dismiss, bring back, paste, pastes during a fetch, Delete and Bring back a test, rows from school accounts (learned, new, a classmate's), Forget an account, an account's conflict answered or cancelled, rosters moved, dropped, renamed and given namesakes, a class deleted, a Full save opened), every test held is in exactly one place and the count line adds up; Cancel changes nothing; Undo gives back exactly what was there` + (fail ? ' — FAILED at sequence ' + fail.q : ''));
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close(); done();
})().catch(e => { console.error(e); check(false, 'crashed: ' + e.message); done(); process.exit(1); });
