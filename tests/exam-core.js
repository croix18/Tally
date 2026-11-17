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
  for (const [name, text, cols] of [['copied from the sheet (tabs)', tsv, { code: 4, name: 3, at: 0, email: 1 }], ['the CSV download (another order, blank rows, quotes)', csv, { code: 0, name: 1, at: 2, email: null }], ['the rows alone, no header', tsv.split('\n').slice(1).join('\n'), { code: 4, name: 3, at: 0, email: 1 }]]) {
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
  const R2 = [['4', 'Smith, Jonathan'], ['4', 'Doe, Robert'], ['5', 'Smith, Jon'], ['5', 'Doe, Bobby'], ['4', 'Smith, John'], ['6', 'Parker, Alexander James'], ['4', 'Lee, Thomas'], ['4', 'Thomas, Lee'], ['5', 'Okafor, Chidinma']].map(([sec, display]) => ({ sec, display }));
  const m2 = t => { const r = C.matchName(t, R2); return { pick: r.pick == null ? null : R2[r.pick].display, sug: r.suggest == null ? null : R2[r.suggest].display, cands: r.cands.map(i => R2[i].display) }; };
  check(m2('Jon Smith').pick === null && m2('Jon Smith').cands.includes('Smith, Jonathan') && m2('Jon Smith').cands.includes('Smith, Jon'), '"Jon Smith" with Smith, Jon and Smith, Jonathan on the rosters: asks, both offered (C1)');
  check(m2('Bob Doe').pick === null && m2('Bob Doe').sug === 'Doe, Bobby', '"Bob Doe": Doe, Bobby is only suggested (H1)');
  check(m2('Jonny Smith').pick === null && m2('Alex Parker').pick === null, '"Jonny Smith" and "Alex Parker": never placed without him (H1)');
  check(m2('Chidinma Okafor').pick === 'Okafor, Chidinma' && m2('Robert Doe').pick === null && m2('John Smith').pick === null, 'a name nobody else could have typed is placed (Chidinma Okafor); "Robert Doe" asks (Bobby is his nickname, R2-H1); "John Smith" asks, Smith, Jon being one slip away');
  const R3 = [['4', 'Garcia, Ana'], ['4', 'Garcia, Anna'], ['5', 'Marie, Ava'], ['4', 'Patel, Ava Marie']].map(([sec, display]) => ({ sec, display }));
  check(C.matchName('Ana Garcia', R3).pick == null && C.matchName('Marie Ava', R3).pick == null && C.matchName('Ava Patel', R3).pick != null, 'Ana / Anna Garcia ask; "Marie Ava" asks (Patel, Ava Marie\'s first and middle names); "Ava Patel" is placed');
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
  { // R2-M2: a flag's id carries its test and what makes it this one, so dismissing one never silences another
    const tw10 = fl.find(f => f.kind === 'twice'), u11 = recs.map(x => x.sec === 'p4' && x.n === 'Patel, Rohan' ? { ...x, unit: 11 } : x);
    const tw11 = C.flags({ sec: 'p4', prep: 'on', course: 'm7', unit: 11, period: null, rows: X.rows, recs: u11, fails, picks: {}, known: [] }).find(f => f.kind === 'twice');
    const net2 = C.flags({ sec: 'p4', prep: 'on', course: 'm7', unit: 10, period: null, rows: X.rows, recs, fails: { ...fails, [b.codes.byIndex[12]]: { why: 'net' } }, picks: {}, known: [] }).find(f => f.kind === 'net');
    const bc = fl.find(f => f.kind === 'badcode'), bc2 = C.flags({ sec: 'p4', prep: 'on', course: 'm7', unit: 10, period: null, rows: X.rows.map(r => r === bc.rows[0] ? { ...r, at: '11/20/2026 9:00:00' } : r), recs, fails, picks: {}, known: [] }).find(f => f.kind === 'badcode');
    check(tw10 && tw11 && tw10.id !== tw11.id && net.find(f => f.kind === 'net').id !== net2.id && bc.id !== bc2.id && fl.every(f => f.id.split('|')[3] === 'm7/10'),
      'R2-M2: "two tests" in Unit 10 and in Unit 11 are two flags; a network note with other codes failing is a new one; a bad code sent at another time is another; every id names its test: ' + tw10.id); }
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
  /* R2-H1: rivals by nickname, a swap of letters, a short or spaced last name: each asks, none is placed */
  { const cases = [['Elisa Garcia', ['Garcia, Elias', 'Garcia, Elisa']], ['Adian Ross', ['Ross, Aidan', 'Ross, Adian']], ['Bobby Doe', ['Doe, Robert', 'Doe, Bobby']],
      ['Bill Ng', ['Ng, William', 'Ng, Bill']], ['Liz Park', ['Park, Elizabeth', 'Park, Liz']], ['Mia Lee', ['Lea, Mia', 'Lee, Mia']], ['Sara Khan', ['Kahn, Sara', 'Khan, Sara']],
      ['Tom Vandyke', ['Van Dyke, Tom', 'Vandyke, Tom']], ['Pepe Ruiz', ['Ruiz, Jose', 'Ruiz, Pepe']], ['Jon Smith', ['Smith, John', 'Smith, Jon']],
      // R3-M1: the same initial, and the third review's table
      ['Shawn Lee', ['Lee, Sean', 'Lee, Shawn']], ['Hank Hill', ['Hill, Henry', 'Hill, Hank']], ['Ty Ng', ['Ng, Tyler', 'Ng, Ty']], ['Peggy Ruiz', ['Ruiz, Margaret', 'Ruiz, Peggy']], ['Ted Cole', ['Cole, Edward', 'Cole, Ted']],
      ['Kat Hu', ['Hu, Cathy', 'Hu, Kat']], ['Tori Lane', ['Lane, Victoria', 'Lane, Tori']], ['Esteban Diaz', ['Diaz, Steve', 'Diaz, Esteban']], ['Xander Hill', ['Hill, Alexander', 'Hill, Xander']], ['Sasha Hill', ['Hill, Alexandra', 'Hill, Sasha']]];
    const bad = cases.filter(([t, ros]) => { const R = ros.map((d, i) => ({ sec: String(4 + i), display: d })); const r = C.matchName(t, R); return r.pick != null || !r.cands.includes(0); });
    check(!bad.length, 'R2-H1, R3-M1: Bobby/Robert, Bill/William, Liz/Elizabeth, Elisa/Elias, Adian/Aidan, Lee/Lea, Khan/Kahn, Vandyke/Van Dyke, Pepe/Jose, Jon/John, Sean/Shawn, Henry/Hank, Tyler/Ty, Margaret/Peggy, Edward/Ted, Cathy/Kat, Victoria/Tori, Steve/Esteban, Alexander/Xander, Alexandra/Sasha all ask, the other child offered: ' + JSON.stringify(bad.map(x => x[0])));
    const R = [{ sec: '4', display: 'Smith, Ava' }, { sec: '5', display: 'Brown, Mia' }, { sec: '5', display: 'Brown, Ava' }, { sec: '4', display: 'Lee, Ana' }, { sec: '6', display: 'Okafor, Chidinma' }];
    check(C.matchName('Ava Brown', R).pick === 2 && C.matchName('Chidinma Okafor', R).pick === 4, 'R2-H1: Ava and Mia (two different short names) are not rivals; a name nobody else is near is still placed');
    check(C.NICKNAMES.some(l => l.split(' ').includes('chuy') && l.includes('jesus')) && C.osa('kahn', 'khan') === 1 && C.osa('elias', 'elisa') === 1, 'the nickname list is one plain list in examcore.js; a swap of two letters is one edit'); }
  /* 16 Nov 2026, lesson tests: course + unit + scope is the test */
  { const LS = F.lessons(F.build(), SEAL.newCode); const lr = LS[0].record, ur = b.recs.find(x => x.record.course === 'm7' && x.record.unit === 10).record;
    check(C.testKey('m7', 10) === 'm7/10' && C.testKey('m7', 10, 'lesson-10.03') === 'm7/10#lesson-10.03' && C.testName('m7', 10) === 'On-level Unit 10' && C.testName('a7', 6, 'lesson-6.03', 'Lesson 6.03 · Ratios') === 'Accelerated Unit 6 · Lesson 6.03' && C.testName('m7', 10, 'lesson-10.09+10') === 'On-level Unit 10 · Lesson 10.09+10' && C.testName('m7', 10, 'lesson-t-a1') === 'On-level Unit 10 · Thread A1' && C.testFull('m7', 10, 'lesson-10.03', 'Lesson 10.03 · Writing inequalities') === 'On-level Unit 10 · Lesson 10.03 · Writing inequalities',
      'a lesson test\'s key and names: the unit test\'s key unchanged ("m7/10"); short in lists ("Unit 10 · Lesson 10.03"), the lesson\'s own name in full on its page');
    const v = C.readRecord(lr), vu = C.readRecord(ur);
    check(v.scope === 'lesson-10.03' && v.scopeName === 'Lesson 10.03 · Writing inequalities' && vu.scope === '' && vu.scopeName === '' && C.readRecord({ ...lr, scope: '<b>x</b>' }).scope === '' && C.readRecord({ ...lr, scopeName: 'y'.repeat(400) }).scopeName.length < 160, 'the record\'s scope and name are read as text (an odd scope is no scope; the name is capped); a record without them is the unit test');
    const pu = C.teacherPayload(ur), pl = C.teacherPayload(lr);
    check(Object.keys(pu).join() === 'v,course,unit,seed,cv,kit,code,points,of,parts' && Object.keys(pl).join() === 'v,course,unit,seed,scope,cv,kit,code,points,of,parts' && pl.scope === 'lesson-10.03', 'See the test: a lesson test\'s payload carries its scope after the seed; a unit test\'s is exactly as before');
    const base = { sec: 'p4', n: 'Nguyen, Ava Marie', course: 'm7', unit: 10, started: 1, finished: 2, ok: true };
    const two = [{ ...base, code: 'AAAAAAAAAAA1' }, { ...base, code: 'AAAAAAAAAAA2', scope: 'lesson-10.03', scopeName: 'Lesson 10.03 · Writing inequalities' }];
    const fu = C.flags({ sec: 'p4', prep: 'on', course: 'm7', unit: 10, rows: [], recs: two, fails: {}, picks: {}, known: [] }), fl = C.flags({ sec: 'p4', prep: 'on', course: 'm7', unit: 10, scope: 'lesson-10.03', scopeName: 'x', rows: [], recs: two, fails: {}, picks: {}, known: [] });
    check(!fu.some(f => f.kind === 'twice' || f.kind === 'other') && !fl.some(f => f.kind === 'twice' || f.kind === 'other'), 'a student with the unit test and a lesson test of the same unit: no "two tests" and no "another test" note in either view');
    const two2 = two.concat([{ ...base, code: 'AAAAAAAAAAA3', scope: 'lesson-10.03' }]); const fl2 = C.flags({ sec: 'p4', prep: 'on', course: 'm7', unit: 10, scope: 'lesson-10.03', rows: [], recs: two2, fails: {}, picks: {}, known: [] });
    check(fl2.some(f => f.kind === 'twice' && /Lesson 10\.03/.test(f.text) && /m7\/10#lesson-10\.03/.test(f.id)) && !C.flags({ sec: 'p4', prep: 'on', course: 'm7', unit: 10, rows: [], recs: two2, fails: {}, picks: {}, known: [] }).some(f => f.kind === 'twice'), 'two lesson tests of one lesson are "two tests" in the lesson view only; the flag\'s id carries the lesson'); }
  /* 16 Nov 2026, school accounts: the address column, and reading the part before the @ */
  { const H = 'Timestamp\tEmail Address\tFirst and last name\tTest code\n';
    const a1 = C.readSheet(H + '11/16/2026 10:01:00\t JSmith12@Students.Example.org \tJohn Smith\tK7QF-2M9D-X4TB\n11/16/2026 10:02:00\t\tAva Brooks\tK7QF-2M9D-X4TC\n');
    check(a1.cols.email === 1 && a1.cols.name === 2 && a1.rows[0].addr === 'jsmith12@students.example.org' && a1.rows[0].name === 'John Smith' && a1.rows[1].addr === '' && a1.rows[1].name === 'Ava Brooks', 'the address column by its header, beside the name: each row keeps its address, lower case and trimmed; a row with no address keeps its name');
    const a2 = C.readSheet('11/16/2026 10:01:00\tK7QF-2M9D-X4TB\tAva Brooks\tavbro4023@x.org\n11/16/2026 10:02:00\tK7QF-2M9D-X4TC\tJohn Smith\tjohn.s@x.org\n');
    check(a2.cols.email === 3 && a2.cols.name === 2 && a2.rows[1].addr === 'john.s@x.org', 'with no header, the address column is found by what is in it');
    const a3 = C.readSheet('Username,Test code\nsmithj@x.org,K7QF-2M9D-X4TB\n');
    check(a3.cols.email === 0 && a3.cols.name == null && a3.rows[0].name === '' && a3.rows[0].addr === 'smithj@x.org', 'with no name column: the address alone (the row has no name; Tally reads candidates from the account)');
    const R = ['Smith, John', 'Smith, Jane', 'Smith, Jonathan', 'Doe, Jane', 'Garcia-Lopez, Alexander', 'Brooks, Ava', 'Nguyen, Ava Marie', 'Okafor, Chidinma'].map(d => ({ display: d }));
    const who = a => C.acctCands(a, R).map(i => R[i].display);
    check(['john.s@x.org', 'johnsmith@x.org', 'john.smith@x.org'].every(a => who(a)[0] === 'Smith, John' && who(a).length === 1) && who('agarcialopez40@x.org')[0] === 'Garcia-Lopez, Alexander' && who('chidinma.o@x.org')[0] === 'Okafor, Chidinma' && who('brooksa@x.org')[0] === 'Brooks, Ava' && who('ANGUYEN7@X.ORG')[0] === 'Nguyen, Ava Marie',
      'the part before the @ read: first.last, first.l, firstlast, flast + digits, lastf, a hyphenated last name run together, any case');
    check(who('jsmith12@x.org').length === 3 && who('smithj@x.org').length === 3 && who('josmi4821@x.org').join() === 'Smith, John,Smith, Jonathan' && who('s123456@x.org').length === 0,
      'an account that fits two or more students names them all (it narrows, it never picks); one that reads as nobody names nobody');
    // in matching: two students who fit one account: ask; the account picks nobody by itself
    check(C.matchName('', R).pick == null && C.acctFit('jsmith', 'Smith, John') > 0 && C.acctFit('jsmith', 'Doe, Jane') === 0, 'the address only narrows: nobody is placed by how an address reads'); }
  /* 16 Nov 2026, "See the test": the link to the unit's teacher copy, and its payload, exactly as the contract says */
  { const RS = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'fixtures', 'exams', 'records.json'), 'utf8'));
    const want = r => ({ v: 1, course: r.course, unit: r.unit, seed: r.seed, cv: r.cv === undefined ? null : r.cv, kit: r.kit, code: r.code, points: r.points, of: r.of,
      parts: r.parts.map(p => [String(p.id), p.typed == null ? '' : C.answerText(p.type, p.typed), p.almost ? 'almost' : ['right', 'wrong', 'blank'].includes(p.v) ? p.v : 'unread', p.key]) });
    const dec = h => JSON.parse(Buffer.from(h.split('#test=')[1], 'base64url').toString('utf8'));
    const bad = RS.filter(x => { const h = C.teacherLink('https://mrshaffer.org/', x.record); const u = new URL(h); return u.pathname !== `/teacher/${x.record.course.toLowerCase()}/unit-${x.record.unit}/practice/` || JSON.stringify(dec(h)) !== JSON.stringify(want(x.record)) || /[^A-Za-z0-9_-]/.test(h.split('#test=')[1]); });
    const kinds = new Set(); RS.forEach(x => x.record.parts.forEach(p => { kinds.add(p.type); if (p.almost) kinds.add('almost'); kinds.add(p.v === 'blank' ? 'blank' : ['right', 'wrong'].includes(p.v) ? 'verdict' : 'unread'); if (p.type === 'text' && Array.isArray(p.typed)) kinds.add('boxes'); }));
    check(!bad.length && ['mc', 'multi', 'text', 'boxes', 'nline', 'cgraph', 'almost', 'blank', 'unread'].every(k => kinds.has(k)), 'See the test: for every fixture record (' + RS.length + '; mc, multi, text, text with boxes, nline, cgraph, almost, blank, unreadable), teacherLink(site, record) is <site>/teacher/<course>/unit-<N>/practice/#test=<base64url JSON> and decodes to exactly the contract: ' + JSON.stringify(bad.map(x => x.code)));
    const names = RS.map(x => x.who).filter(Boolean).flatMap(n => String(n).split(/[ ,]+/)).filter(w => w.length > 2);
    check(RS.every(x => { const t = Buffer.from(C.teacherLink('https://mrshaffer.org', x.record).split('#test=')[1], 'base64url').toString('utf8'); return !names.some(w => t.toLowerCase().includes(w.toLowerCase())) && !/"(n|name|sec|who|student|roster|class)"/.test(t); }), 'and it holds no name, class or roster id');
    const long = JSON.parse(JSON.stringify(RS[0].record)); const p0 = long.parts.find(p => p.type === 'text'); p0.typed = 'x'.repeat(400); p0.key = 'k'.repeat(400);
    const lp = dec(C.teacherLink('https://mrshaffer.org', long)).parts.find(q => q[0] === String(p0.id));
    check(/… \(100 more characters\)$/.test(lp[1]) && lp[3] === 'k'.repeat(400) && C.teacherPayload(long).parts.length === long.parts.length, 'the 300-character clip applies to the answer, never to the key (the raw key, character for character)'); }
  done();
})().catch(e => { console.error(e); check(false, 'crashed: ' + e.message); done(); });
