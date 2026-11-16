// Tests, without a browser (16 Nov 2026): the vendored lock is Windmill's own and opens Windmill's vector; every reason a
// record is refused; the response sheet read whatever its mess; names matched, and asked about when not sure; the record
// read in every shape the fixtures hold; and every flag the design names, raised by the synthetic class's mess.
// Runs under Node (Web Crypto and CompressionStream are Node's own). Fixtures: tests/exam/fixtures.js → fixtures/exams/.
const { check, done, fs, path } = require('./lib');
const crypto = require('crypto'); const assert = require('assert');
const SEAL = require('../vendor/seal.js'); const C = require('../examcore.js'); const F = require('./exam/fixtures.js');
const why = async p => { try { await p; return null; } catch (e) { return e.why || '(no why) ' + e.message; } };
const deep = (a, b) => { try { assert.deepStrictEqual(a, b); return true; } catch (e) { return false; } };
(async () => {
  /* 1. the copy is Windmill's, unchanged */
  const meta = JSON.parse(fs.readFileSync('vendor/seal.json', 'utf8'));
  const sha = crypto.createHash('sha256').update(fs.readFileSync('vendor/seal.js')).digest('hex');
  check(sha === meta.sha256 && /^[0-9a-f]{40}$/.test(meta.commit), `vendor/seal.js is the copy vendor/seal.json records (Windmill ${meta.commit.slice(0, 7)}, sha256 ${sha.slice(0, 12)}…)`);
  const vsha = crypto.createHash('sha256').update(fs.readFileSync('fixtures/seal_vector.json')).digest('hex');
  check(vsha === meta.vector.sha256, 'fixtures/seal_vector.json is Windmill\'s check/seal_vector.json, unchanged');
  const built = fs.existsSync('Tally.html') ? fs.readFileSync('Tally.html', 'utf8') : '';
  check(built.includes(fs.readFileSync('vendor/seal.js', 'utf8')), 'the shipped Tally.html carries vendor/seal.js byte for byte');

  /* 2. Windmill's vector opens */
  const V = JSON.parse(fs.readFileSync('fixtures/seal_vector.json', 'utf8'));
  const vr = await SEAL.open(V.locked, V.tallyPriv, V.sitePub, { code: V.code });
  check(deep(vr, V.record), 'the record Windmill locked on 16 Nov 2026 opens, as it went in');
  const vt = await SEAL.open(V.trialLocked, V.tallyPriv, V.sitePub);
  check(vt.trial === true && (await SEAL.words(vt.nonce, V.sitePub, V.tallyPub)) === V.words, 'its trial opens and gives its four words: ' + V.words);
  let rv = null; try { rv = C.readRecord(vr); } catch (e) {}
  check(rv && rv.points === 4 && rv.of === 6 && rv.parts.length === 6 && rv.away.length === 0 && rv.questions.length === 6 && rv.seconds === 2467, 'a record whose log is not in the pinned shape (the vector\'s) is read without a fault: the site\'s part shows, the odd log entries are left out');

  /* 3. every reason a record is refused */
  const K = JSON.parse(fs.readFileSync('fixtures/exams/keys.json', 'utf8')), L = JSON.parse(fs.readFileSync('fixtures/exams/locked.json', 'utf8')), R = JSON.parse(fs.readFileSync('fixtures/exams/records.json', 'utf8'));
  const sites = [K.site.pub, K.old.pub];
  const pick = f => R.find(f); const ok = pick(x => x.to === 'tally' && x.by === 'site');
  check(deep(await SEAL.open(L[ok.code], K.tally.priv, sites, { code: ok.code }), ok.record), 'a fixture record opens with the fixture Tally\'s key and the site\'s keys');
  check(await why(SEAL.open('this is not a record', K.tally.priv, sites)) === 'format' && await why(SEAL.open(SEAL.b64u(new Uint8Array(200)), K.tally.priv, sites)) === 'format', "'format': what is not a locked record");
  check(await why(SEAL.open(L[pick(x => x.to === 'other').code], K.tally.priv, sites)) === 'key', "'key': a record locked to another Tally");
  check(await why(SEAL.open(L[pick(x => x.by === 'forger').code], K.tally.priv, sites)) === 'signature', "'signature': a record signed by a key that is not the site's");
  check(await why(SEAL.open(L[ok.code], K.tally.priv, sites, { code: R.find(x => x !== ok).code })) === 'code', "'code': a record that answers to another code");
  const old = pick(x => x.by === 'old');
  check(await why(SEAL.open(L[old.code], K.tally.priv, [K.site.pub])) === 'signature' && !!(await SEAL.open(L[old.code], K.tally.priv, sites)), 'a site key made again: the old key, kept, still opens the records it signed');
  let bad = 0; const raw = SEAL.unb64u(L[ok.code]); for (const i of [0, 1, 40, 70, 90, raw.length - 1]) { const b2 = raw.slice(); b2[i] ^= 4; if (!['format', 'key'].includes(await why(SEAL.open(b2, K.tally.priv, sites)))) bad++; }
  check(bad === 0, 'a byte changed anywhere and nothing opens');

  /* 4. the response sheet */
  const tsv = fs.readFileSync('fixtures/exams/responses.tsv', 'utf8'), csv = fs.readFileSync('fixtures/exams/responses.csv', 'utf8');
  const b = F.build();
  for (const [name, text, cols] of [['copied from the sheet (tabs)', tsv, { code: 4, name: 3, at: 0, email: null }], ['the CSV download (another order, blank rows, quotes)', csv, { code: 0, name: 1, at: 2, email: null }], ['the rows alone, no header', tsv.split('\n').slice(1).join('\n'), { code: 4, name: 3, at: 0, email: null }]]) {
    const s = C.readSheet(text);
    check(deep(s.cols, cols) && s.rows.length === b.rows.length, `${name}: the code, name and time columns are found, every response read (${s.rows.length}; cols ${JSON.stringify(s.cols)})`);
    const codes = s.rows.flatMap(r => r.codes); const want = b.rows.map(r => SEAL.readCode(r.code)).filter(Boolean);
    check(deep(codes, want), `${name}: every code read, lower case and spaces forgiven, a short one not taken for a code`);
    check(s.rows.filter(r => !r.codes.length).length === 1 && s.rows.find(r => !r.codes.length).raw.length === 8 && s.rows.every(r => r.when != null), `${name}: the cut-short code is kept as typed, to flag; every timestamp read`);
  }
  check(C.readSheet('hello there\nno codes here').cols.code == null && C.readSheet('').rows.length === 0, 'a paste with no code in it is said to have none');
  check(C.readSheet('K7QF-2M9D-X4TB\nk7qf 2m9d x4tc\n').rows.length === 2, 'a column of codes alone is read (no name: Tally asks)');

  /* 5. names */
  const roster = [...F.P4.map(n => ({ sec: 'p4', display: n })), ...F.P5.map(n => ({ sec: 'p5', display: n }))];
  const m = t => { const r = C.matchName(t, roster); return { how: r.how, who: r.pick == null ? null : roster[r.pick].display, cands: r.cands.map(i => roster[i].display) }; };
  check(m('ava nguyen').how === 'exact' && m('ava nguyen').who === 'Nguyen, Ava Marie', 'exact: case and a left-out middle name');
  check(m('Jose Ramirez').how === 'exact' && m('Jose Ramirez').who === 'Ramírez, José', 'exact: an accent not typed');
  check(m('Nguyen Ava').how === 'exact' && m('Dominic Whitaker Jr.').how === 'exact' && m("Brennan ONeil").how === 'exact', 'exact: last name first; a suffix; an apostrophe left out');
  const sg = t => { const r = C.matchName(t, roster); return r.suggest == null ? null : roster[r.suggest].display; };
  check(m('Mikayla Jonson').who === null && sg('Mikayla Jonson') === 'Johnson, Mikayla', 'forgiving (one letter off) is a suggestion, never a placement');
  check(m('Alex Garcia-Lopez').who === null && sg('Alex Garcia-Lopez') === 'Garcia-Lopez, Alexander', 'forgiving (a nickname) is a suggestion, never a placement');
  /* review C1, H1: exact AND unrivaled, across every class */
  const R2 = [['4', 'Smith, Jonathan'], ['4', 'Doe, Robert'], ['5', 'Smith, Jon'], ['5', 'Doe, Bobby'], ['4', 'Smith, John'], ['6', 'Parker, Alexander James'], ['4', 'Lee, Thomas'], ['4', 'Thomas, Lee']].map(([sec, display]) => ({ sec, display }));
  const m2 = t => { const r = C.matchName(t, R2); return { pick: r.pick == null ? null : R2[r.pick].display, sug: r.suggest == null ? null : R2[r.suggest].display, cands: r.cands.map(i => R2[i].display) }; };
  check(m2('Jon Smith').pick === null && m2('Jon Smith').cands.includes('Smith, Jonathan') && m2('Jon Smith').cands.includes('Smith, Jon'), '"Jon Smith" with Smith, Jon and Smith, Jonathan on the rosters: asks, both offered (C1)');
  check(m2('Bob Doe').pick === null && m2('Bob Doe').sug === 'Doe, Bobby', '"Bob Doe": Doe, Bobby is only suggested (H1)');
  check(m2('Jonny Smith').pick === null && m2('Alex Parker').pick === null, '"Jonny Smith" and "Alex Parker": never placed without him (H1)');
  check(m2('Robert Doe').pick === 'Doe, Robert' && m2('John Smith').pick === 'Smith, John', 'a name that is one student\'s and nobody else\'s near match is still placed: Robert Doe, John Smith');
  check(m2('Lee Thomas').pick === null, 'Lee Thomas / Thomas Lee: asks');
  check(C.matchName('ava brooks', roster, { noPick: true }).pick === null, 'a name read from an email address is never placed (L3)');
  { const a = m('Ava'); check(a.how === null && a.who === null && a.cands.length === 2 && a.cands.includes('Brooks, Ava'), 'not sure ("Ava": two Avas): no student taken; both offered'); }
  check(m('Zed Quux').who === null && m('').who === null, 'nobody like it: no student');
  check(m('Rory Quinlan').how === 'exact', 'a student of another class is found in that class');

  /* 6. the record, in every shape the fixtures hold */
  let fault = null; const read = {}; for (const x of R) { try { read[x.code] = C.readRecord(x.record); } catch (e) { fault = e; } }
  check(!fault, 'every fixture record reads without a fault' + (fault ? ': ' + fault.message : ''));
  const byWho = n => R.filter(x => x.who && x.who.n === n).map(x => read[x.code]);
  const [cap] = byWho(F.P4[5]), [nolog] = byWho(F.P4[6]), [nul] = byWho(F.P4[7]), [ended] = byWho(F.P4[2]), [heavy] = byWho(F.P4[4]), [leftALot] = byWho(F.P4[1]), [idle] = byWho(F.P4[3]);
  check(cap.visits.length === 300 && cap.drop.visits === 45 && cap.away.length === 100 && cap.drop.away === 7 && cap.drop.blocked === 31 && cap.parts.find(p => p.id === '14').n === 37, 'a capped log: 300 visits and 100 of each list, with the counts of what was dropped');
  check(nolog.log === null && nolog.away.length === 0 && nolog.points != null && nolog.seconds > 0, 'a null log: the site\'s part only');
  check(nul.device.os === null && nul.log.t0 === null && nul.questions.every(q => q.first === null) && nul.log.fails === null, 'null fields read as not reported');
  check(ended.ended === 'left' && ended.rule.leave === 'end' && ended.away.length === 3, 'a test that ended itself after leaving');
  check(heavy.paper.length >= 4 && heavy.paper.some(p => p.grid && p.grid.o.length) && heavy.paper.some(p => p.notes.includes('\n')) && heavy.cut, 'heavy scratch paper: notes and grids at Finish');
  check(leftALot.away.length === 12 && new Set(leftALot.away.map(a => a.kind)).size >= 4 && leftALot.blocked.length > 0, 'lots of away, of every kind, and blocked tries');
  check(idle.idle.some(i => i.sec === 612), 'a long idle');
  const types = new Set(R.flatMap(x => x.record.parts.map(p => p.type))); check(['text', 'mc', 'multi', 'nline', 'cgraph'].every(t => types.has(t)), 'every answer type is in the fixtures: ' + [...types].join(', '));
  const vs = new Set(R.flatMap(x => x.record.parts.map(p => p.almost ? 'almost' : p.v))); check(['right', 'wrong', 'blank', 'unread', 'almost'].every(v => vs.has(v)), 'every verdict is in the fixtures, and "almost"');
  check(C.answerText('mc', 1) === 'B' && C.answerText('multi', [0, 2]) === 'A, C' && C.answerText('nline', { c: '-1.5', closed: false, dir: 'left' }) === '−1.5 · open dot · arrow ←' && C.answerText('cgraph', [{ name: 'Swim', deg: 90 }]) === 'Swim 90°' && C.answerText('text', ['2', '']) === '2  ·  _', 'each kind of answer reads as words');
  check(C.keyText('nline:3|closed|right') === '3 · closed dot · arrow →' && C.keyText('cgraph:Soccer=90|Track=270') === 'Soccer 90° · Track 270°' && C.keyText('A,C') === 'A, C' && C.keyText(['2', '5']) === '2  ·  5', 'each kind of key reads as words');
  check(C.clock(2467) === '41:07' && C.clock(3725) === '1:02:05' && C.dur(65) === '1 min 5 s' && C.dur(42) === '42 s' && C.dur(3700) === '1 h 1 min', 'times as the test page writes them');

  /* 7. every flag, from the class's mess */
  const s = C.readSheet(tsv); const X = { rows: [] };
  s.rows.forEach(r => { const mm = C.matchName(r.name, roster); X.rows.push({ ...r, who: mm.pick == null ? null : { sec: roster[mm.pick].sec, n: roster[mm.pick].display }, how: mm.how, suggest: mm.suggest == null ? null : { sec: roster[mm.suggest].sec, n: roster[mm.suggest].display }, cands: mm.cands.map(i => ({ sec: roster[i].sec, n: roster[i].display })) }); });
  const recs = [], fails = {};
  for (const x of R) {   // what Tally would hold after fetching every code turned in, then opening the cockpit's file
    const turned = X.rows.some(r => r.codes.includes(x.code)), inFile = x.record.course === 'm7' && x.record.unit === 10;
    if (!turned && !inFile) continue;
    try { await SEAL.open(L[x.code], K.tally.priv, sites, { code: x.code }); const v = C.readRecord(x.record); recs.push({ code: x.code, course: v.course, unit: v.unit, started: v.started, finished: v.finished, seconds: v.seconds, opened: v.opened, ended: v.ended, limit: v.limit, rule: v.rule, after: v.rule && v.rule.after, unlocks: v.unlocks, awayN: v.log ? v.away.length : null, points: v.points, of: v.of, pin: null }); }
    catch (e) { fails[x.code] = { why: e.why, ...(turned ? {} : { course: x.record.course, unit: x.record.unit }) }; }
  }
  X.rows.forEach(r => r.codes.forEach(c => { if (!recs.some(x => x.code === c) && !fails[c]) fails[c] = { why: 'none' }; }));
  const P = C.placeAll(X.rows, recs); recs.forEach(x => { const to = P.place[x.code]; x.sec = to ? to.sec : null; x.n = to ? to.n : null; });
  const fl = C.flags({ sec: 'p4', prep: 'on', course: 'm7', unit: 10, period: { from: '09:40', to: '10:40' }, rows: X.rows, recs, fails, picks: {}, known: [] });
  const kinds = {}; fl.forEach(f => (kinds[f.kind] = kinds[f.kind] || []).push(f));
  const has = (k, test, what) => check(!!(kinds[k] && kinds[k].some(test)), `flag ${k}: ${what}` + (kinds[k] ? '' : ' (none raised)'));
  has('shared', f => f.names.includes('Moreau, Camille') && f.names.includes('Fischer, Hannah') && /Two students/.test(f.text) && /say whose/.test(f.todo), 'a code two students turned in, named, with what to do');
  has('none', f => f.names.includes('Sato, Haruto') && /typo/.test(f.todo), 'a code that opens to nothing on the site (a typo)');
  has('key', f => f.names.includes('Kowalski, Piotr') && /Full save/.test(f.todo), 'a record locked to another Tally');
  has('signature', f => f.names.includes('Abara, Kofi') && /will not show/.test(f.todo), 'a record the site did not sign');
  has('twice', f => f.names[0] === 'Patel, Rohan' && /has 2 tests/.test(f.text) && /Choose/.test(f.todo), 'a second test by the same student, with both sittings\' times');
  has('unclaimed', f => recs.find(x => x.code === f.code && !x.n) && /Give it/.test(f.todo), 'a test nobody turned in (in the cockpit\'s file)');
  has('period', f => f.names.includes('Kim, Daniel') && /outside the class period \(9:40 am–10:40 am\)/.test(f.text), 'a start or finish outside the class period, in one clock style (L5)');
  has('left', f => f.names.includes('Ramírez, José') && /ended itself/.test(f.text), 'a test ended by leaving');
  has('other', f => f.course === 'm7' && f.unit === 9, 'a record for another unit than the one on screen');
  has('other', f => f.course === 'a7' && /other course/.test(f.todo), 'a record for the other course');
  has('who', f => f.rows[0].name === 'Ava' && /Choose the student/.test(f.todo) && /counts for nobody/.test(f.todo), 'a name Tally is not sure of: the test counts for nobody until he says');
  has('who', f => f.rows[0].name === 'Mikayla Jonson' && /“Mikayla Jonson” — Johnson, Mikayla\?/.test(f.text) && f.suggest && f.suggest.n === 'Johnson, Mikayla', 'a forgiving reading is asked as a question: "Mikayla Jonson — Johnson, Mikayla?" (H1)');
  check(!recs.some(x => x.n === 'Johnson, Mikayla'), 'and until he answers, her test is with nobody');
  has('badcode', f => f.names.includes('Ivanova, Daria') && /is not a code/.test(f.text), 'a code too short to be one');
  check(!recs.some(x => x.code === b.codes.forged || x.code === b.codes.other), 'a record that did not open is never among the records Tally keeps');
  // CHANGES-16NOV §7: against the rest of the class, the rule, the length, a test the site closed
  has('apart', f => f.names.includes('Bello, Tunde') && /started at 1:05 pm, 3 h 24 min after the rest of the class \(9:41 am–\d+:\d\d am\)/.test(f.text) && !/home/.test(f.text + f.todo), 'apart from the class: the facts only ("started 1:05 pm, 3 h 24 min after the rest of the class"), no "at home" in the list (M1)');
  has('makeup', f => f.names.includes('Tran, Linh') && f.level === 'info' && /took it alone at 2:30 pm in its own opening \(opened 2:25 pm\)/.test(f.text), 'a test alone in its own opening is a note: a make-up? (M1)');
  check(!fl.some(f => (f.kind === 'opening' || f.kind === 'apart') && f.names.includes('Tran, Linh')), 'the make-up is not also flagged as apart or another opening');
  has('rule', f => f.names.includes('Delgado, Mateo') && /left the test 4 times under Lock after 2 and was never unlocked: the page on that device did not lock/.test(f.text), 'the rule not kept under Lock after: it is the page that locks (N1)');
  has('rule', f => f.names.includes('Haddad, Yusuf') && /left the test 3 times under End after 3 and the test did not end/.test(f.text), 'the rule not kept under End after (N1)');
  has('long', f => f.names.includes('Reyes, Valentina') && /sat for [0-9 hmin]+; the class's typical time was/.test(f.text), 'a long sitting: the time and the class\'s typical time (N2)');
  has('teacher', f => f.names.includes('Ferreira, Lucas') && /did not finish/.test(f.text), 'a test the site closed (ended by the teacher\'s side)');
  has('time', f => f.names.includes('MacLeod, Fiona') && /ran out of time \(30 minutes allowed\): the site closed it with what was saved/.test(f.text), 'a test that ran out of the time allowed (ended: \'time\')');
  check(read[b.codes.byIndex[19]].limit === 30 && read[b.codes.byIndex[6]].limit === null && read[b.codes.byIndex[0]].limit === 120 && read[b.codes.byIndex[19]].ended === 'time', 'site.limit is read (30, none, the default 120) and ended: \'time\' kept');
  check(!fl.some(f => f.kind === 'rule' && (f.names.includes('Ramírez, José') || f.names.includes('Okafor, Chidinma'))), 'a test that did end after leaving, and one that was locked and unlocked, raise no rule flag');
  check(!fl.some(f => ['apart', 'long'].includes(f.kind) && !['Bello, Tunde', 'Reyes, Valentina', 'Kim, Daniel', 'Patel, Rohan'].includes(f.names[0])), 'only the afternoon test, the very long one and the two sat after the class (Daniel\'s late one, Rohan\'s second) are apart or long: ' + fl.filter(f => ['apart', 'long'].includes(f.kind)).map(f => f.names[0]).join(', '));
  check(fl.filter(f => f.kind === 'unclaimed').every(f => /taken \d+:\d+ am–\d+:\d+ am/.test(f.text)) && fl.filter(f => f.kind === 'unclaimed' && /in the opening of 9:38 am/.test(f.text)).length === 4 && fl.some(f => f.kind === 'unclaimed' && /not finished: closed by the site/.test(f.text)), 'a test nobody turned in is shown with its start and finish and its opening (an older record without one, without it; and says when the site closed it)');
  /* CHANGES-16NOV §6: a record's strings are the student's own */
  const hr = read[b.codes.p5[0]];
  check(hr.away.length === 0 && hr.awaySec === 0, 'junk among the times away is not counted (the site\'s rule: 0 ≤ sec ≤ 86400): ' + hr.away.length);
  const ht = C.answerText('text', hr.parts.find(p => p.id === '2').typed);
  check(ht.length < 360 && /more characters\)$/.test(ht), 'an answer that is a 2 KB object is shown cut, never at its length');
  check(hr.paper.find(p => p.q === '2').grid.o.length === 1, 'a scratch grid\'s malformed marks are dropped, the good one kept');
  check(fl.every(f => typeof f.text === 'string' && f.text.length > 10 && typeof f.todo === 'string' && f.todo.length > 20), 'every flag says what is wrong and what he can do');
  const p5 = C.flags({ sec: 'p5', prep: 'on', course: 'm7', unit: 10, period: null, rows: X.rows, recs, fails, picks: {}, known: [] });
  check(!p5.some(f => ['shared', 'key', 'signature', 'twice', 'left', 'badcode'].includes(f.kind)) && recs.filter(x => x.sec === 'p5').length === 6, '5th Period gets its own six tests and none of 4th Period\'s flags');
  const picked = C.flags({ sec: 'p4', prep: 'on', course: 'm7', unit: 10, period: null, rows: X.rows, recs, fails, picks: { ['p4|Patel, Rohan|m7/10']: b.codes.twice }, known: [] });
  check(!picked.some(f => f.kind === 'twice'), 'once he chooses the test that counts, the second-test flag is gone');
  const net = C.flags({ sec: 'p4', prep: 'on', course: 'm7', unit: 10, period: null, rows: X.rows, recs, fails: { ...fails, [b.codes.byIndex[11]]: { why: 'net' } }, picks: {}, known: [] });
  check(net.some(f => f.kind === 'net' && f.level === 'info' && /Try again|network/.test(f.todo)), 'a code the network failed on is a note with a way to try again, not an error');
  const near = C.flags({ sec: 'p4', prep: 'on', course: 'm7', unit: 10, period: null, rows: X.rows, recs, fails, picks: {}, known: [b.codes.byIndex[17]] });
  check(near.some(f => f.kind === 'none' && f.near[0] === b.codes.byIndex[17] && /one character/.test(f.todo)), 'a typo\'d code one character from a test nobody turned in names that test');

  /* the review's probes, in their essence (REVIEW.md; probes p5, p12, p4, p4b) */
  { const at = (d, h, mi) => new Date(2026, 10, d, h, mi).getTime(), min = 60000;
    const mk = (i, start, durMin, o = {}) => ({ code: 'C' + String(i).padStart(11, '0'), course: 'm7', unit: 10, started: start, finished: start + durMin * min, seconds: durMin * 60, opened: o.opened === undefined ? at(16, 9, 30) : o.opened, ended: o.ended || null, sec: 'P4', n: 'S' + i, how: 'exact', rule: o.rule || { leave: 'count', after: 3 }, unlocks: o.unlocks || 0, awayN: o.awayN || 0, points: 20, of: 36 });
    const run = (recs, extra) => C.flags({ sec: 'P4', prep: 'on', course: 'm7', unit: 10, period: null, rows: [], recs, fails: {}, ...(extra || {}) });
    const cls = (n, start = at(16, 9, 40), dur = 35) => Array.from({ length: n }, (_, i) => mk(i, start + i * min, dur));
    const two = run([...cls(5), ...Array.from({ length: 5 }, (_, i) => mk(20 + i, at(16, 13, 5) + i * min, 35, { opened: at(16, 12, 55) }))]);
    check(!two.some(f => ['apart', 'opening'].includes(f.kind)) && two.filter(f => f.kind === 'groups').length === 1 && /This class sat in two groups: 9:40 am \(5\) and 1:05 pm \(5\)/.test(two.find(f => f.kind === 'groups').text) && two.find(f => f.kind === 'groups').level === 'info', 'two equal sittings: one note, "this class sat in two groups: 9:40 am (5) and 1:05 pm (5)", no warning on any child (M1)');
    const six = run([...cls(3), ...Array.from({ length: 3 }, (_, i) => mk(20 + i, at(16, 13, 5) + i * min, 35))]);
    check(!six.some(f => ['apart', 'opening'].includes(f.kind)), '3 and 3: no majority, nobody flagged as apart');
    const tie = run([...Array.from({ length: 3 }, (_, i) => mk(i, at(16, 9, 40), 35, { opened: at(16, 9, 30) })), ...Array.from({ length: 3 }, (_, i) => mk(10 + i, at(16, 9, 41), 35, { opened: at(16, 9, 35) }))]);
    check(!tie.some(f => f.kind === 'opening'), 'an opening tie (3 and 3) flags nobody (M1)');
    const mu = run([...cls(6), mk(9, at(16, 14, 30), 35, { opened: at(16, 14, 25) })]);
    check(mu.filter(f => f.kind === 'makeup').length === 1 && !mu.some(f => ['apart', 'opening'].includes(f.kind)), 'a make-up alone in its own opening: one note, nothing else (M1)');
    const minority = run([...cls(8), mk(30, at(16, 12, 0), 35, { opened: at(16, 11, 50) }), mk(31, at(16, 12, 1), 35, { opened: at(16, 11, 50) })]);
    check(minority.filter(f => f.kind === 'opening').length === 2 && /in the opening of 11:50 am; 8 of the class's 10 were in the opening of 9:30 am/.test(minority.find(f => f.kind === 'opening').text), 'two in another opening beside a clear majority: each flagged, with the facts');
    check(run([mk(1, at(16, 9, 39) + 30000, 30)], { period: { from: '09:40', to: '10:30' } }).every(f => f.kind !== 'period') && run([mk(1, at(16, 9, 38), 30)], { period: { from: '09:40', to: '10:30' } }).some(f => f.kind === 'period'), 'the period: a minute\'s grace before the bell as after it (L5)');
    const lock = run([mk(1, at(16, 9, 40), 35, { rule: { leave: 'lock', after: 2 }, awayN: 3 })])[0];
    check(lock && /the page on that device did not lock/.test(lock.text) && !/site should/.test(lock.text), 'the rule flag says it is the page that locks (N1)');
    // stale flags (p12)
    const A = { sec: 'P4', n: 'BROOKS, AVA' }, good = 'K7QF2M9DX4TB', typo = 'K7QF2M9DX4TA';
    const rec = { code: good, course: 'm7', unit: 10, started: at(16, 9, 40), finished: at(16, 10, 10), seconds: 1800, sec: 'P4', n: 'BROOKS, AVA', how: 'exact', rule: null };
    const fl1 = C.flags({ sec: 'P4', prep: 'on', course: 'm7', unit: 10, rows: [{ codes: [typo], name: 'Ava Brooks', who: A, line: 2 }, { codes: [good], name: 'Ava Brooks', who: A, line: 9 }], recs: [rec], fails: { [typo]: { why: 'none' } } });
    check(!fl1.some(f => f.kind === 'none'), 'a typo row clears once the same student holds a test of that unit (M2)');
    const P2 = C.placeAll([{ codes: [good], name: 'Ava', who: null, line: 2 }, { codes: [good], name: 'Ava Brooks', who: A, line: 9 }], [{ code: good }]);
    check(P2.state[good] === 'placed' && P2.place[good].n === 'BROOKS, AVA', 'the same form sent twice ("Ava", then "Ava Brooks", one code) is one child, not a shared code (M2)');
    const fl3 = C.flags({ sec: 'P4', prep: 'on', course: 'm7', unit: 10, rows: [{ codes: [], raw: 'K7QF 2M9D', name: 'Ava Brooks', who: A, line: 2 }, { codes: [good], name: 'Ava Brooks', who: A, line: 9 }], recs: [rec], fails: {} });
    check(!fl3.some(f => f.kind === 'badcode'), 'a not-a-code row clears likewise (M2)');
    check(C.flags({ sec: 'P4', prep: 'on', course: 'm7', unit: 10, rows: [{ codes: [], raw: 'Bart Kowalczyk', name: '', who: null, line: 4 }], recs: [], fails: {}, hideText: true }).every(f => !/Kowalczyk/.test(f.text)), 'with names hidden, what a student typed in the code box is not shown (M4)');
    check(fl1.concat(two, mu).every(f => typeof f.id === 'string' && f.id.length > 3), 'every flag has an id, so it can be dismissed and brought back');
    // nothing placed is lost (p4, p4b): the entry holds its student
    const keep = C.placeAll([], [{ code: good, who: { sec: 'P4', n: 'LEE, MIA', how: 'exact' } }]);
    check(keep.state[good] === 'placed' && keep.place[good].n === 'LEE, MIA', 'a placed test whose response rows are gone stays with its student (H2)');
    const notT = C.placeAll([{ codes: [good], name: 'Ava Brooks', who: A, line: 9 }], [{ code: good, who: null, no: [A] }]);
    check(notT.state[good] === 'waiting', '"Not theirs": the student it was taken off is never given it again by the same row (C1)');
    const nob = C.placeAll([{ codes: [good], name: 'Ava Brooks', who: A, line: 9 }], [{ code: good, who: null, no: [A], nobody: true }]);
    check(nob.state[good] === 'nobody', '"Nobody yet": it goes back to the tests nobody turned in');
    const conflict = C.placeAll([{ codes: [good], name: 'Ava Brooks', who: A, line: 9 }, { codes: [good], name: 'Mia Lee', who: { sec: 'P4', n: 'LEE, MIA' }, line: 10 }], [{ code: good, who: { sec: 'P4', n: 'BROOKS, AVA', how: 'exact' } }]);
    check(conflict.state[good] === 'shared' && conflict.place[good] === null, 'a later response naming another child takes the test off both until he says (a score only when certain)');
    const byHand = C.placeAll([{ codes: [good], name: 'Mia Lee', who: { sec: 'P4', n: 'LEE, MIA' }, line: 10 }], [{ code: good, who: { sec: 'P4', n: 'BROOKS, AVA', how: 'you' } }]);
    check(byHand.place[good].n === 'BROOKS, AVA', 'a test he placed by hand stays where he put it');
    // M5: a log's lists at the design's caps, strings cut
    const big = JSON.parse(JSON.stringify(R[0].record)); big.log.visits = Array.from({ length: 10000 }, (_, i) => ['1', i, 1]); big.log.away = Array.from({ length: 5000 }, (_, i) => [i, 1, 'tab', '1']); big.log.device.os = 'x'.repeat(5000); big.site.timeline = Array.from({ length: 9000 }, (_, i) => [i, '1']);
    const rb = C.readRecord(big); check(rb.visits.length === 300 && rb.drop.visits === 9700 + (R[0].record.log.drop.visits || 0) && rb.away.length === 100 && rb.drop.away >= 4900 && rb.device.os.length < 120 && rb.timeline.length === 1500, 'a log of thousands of entries is read at the design\'s caps (300 visits, 100 away) with the rest counted as dropped; long strings cut (M5)');
  }
  /* CHANGES-16NOV §11 */
  { const tapped = R.some(x => Object.values(x.record.log ? x.record.log.parts : {}).some(p => p.vals.some(v => v[2] === 'tap'))); const find = R.find(x => x.record.log && x.record.log.blocked.some(b => b[1] === 'find'));
    const rf = find && C.readRecord(find.record); check(tapped && rf && rf.blocked.some(b => b.what === 'find') && rf.blocked.some(b => b.what === 'zoomhack'), 'the fixtures hold a picked value ("tap"), a blocked find and a blocked kind Tally doesn\'t know; all read'); }
  done();
})().catch(e => { console.error(e); check(false, 'crashed: ' + e.message); done(); });
