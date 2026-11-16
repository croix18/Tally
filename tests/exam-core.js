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
  for (const [name, text, cols] of [['copied from the sheet (tabs)', tsv, { code: 4, name: 3, at: 0 }], ['the CSV download (another order, blank rows, quotes)', csv, { code: 0, name: 1, at: 2 }], ['the rows alone, no header', tsv.split('\n').slice(1).join('\n'), { code: 4, name: 3, at: 0 }]]) {
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
  check(m('Mikayla Jonson').how === 'loose' && m('Mikayla Jonson').who === 'Johnson, Mikayla', 'forgiving: one letter off in the last name, one student close, taken and marked');
  check(m('Alex Garcia-Lopez').how === 'loose' && m('Alex Garcia-Lopez').who === 'Garcia-Lopez, Alexander', 'forgiving: a nickname that starts the same');
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
  s.rows.forEach(r => { const mm = C.matchName(r.name, roster); X.rows.push({ ...r, who: mm.pick == null ? null : { sec: roster[mm.pick].sec, n: roster[mm.pick].display }, how: mm.how, cands: mm.cands.map(i => ({ sec: roster[i].sec, n: roster[i].display })) }); });
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
  has('twice', f => f.names[0] === 'Patel, Rohan' && /choose/.test(f.todo), 'a second test by the same student');
  has('unclaimed', f => recs.find(x => x.code === f.code && !x.n) && /Give it/.test(f.todo), 'a test nobody turned in (in the cockpit\'s file)');
  has('period', f => f.names.includes('Kim, Daniel') && /outside the class period/.test(f.text), 'a finish outside the class period');
  has('left', f => f.names.includes('Ramírez, José') && /ended itself/.test(f.text), 'a test ended by leaving');
  has('other', f => f.course === 'm7' && f.unit === 9, 'a record for another unit than the one on screen');
  has('other', f => f.course === 'a7' && /other course/.test(f.todo), 'a record for the other course');
  has('who', f => f.rows[0].name === 'Ava' && /Choose the student/.test(f.todo), 'a name Tally is not sure of');
  has('badcode', f => f.names.includes('Ivanova, Daria') && /is not a code/.test(f.text), 'a code too short to be one');
  check(!recs.some(x => x.code === b.codes.forged || x.code === b.codes.other), 'a record that did not open is never among the records Tally keeps');
  // CHANGES-16NOV §7: against the rest of the class, the rule, the length, a test the site closed
  has('apart', f => f.names.includes('Bello, Tunde') && /took it at 1:05 pm–[0-9:]+ pm; the rest of this class took it 9:4\d am–/.test(f.text) && /at home/.test(f.todo), 'a test taken apart from the class, said with its times and the class\'s');
  has('opening', f => f.names.includes('Bello, Tunde') && /another opening of the test \(opened 12:55 pm\) than the rest of this class \(opened 9:38 am\)/.test(f.text), 'a test started in another opening than the class\'s');
  has('period', f => f.names.includes('Bello, Tunde') && /took it 1:05 pm–/.test(f.text), 'a start (and finish) outside the period');
  has('rule', f => f.names.includes('Delgado, Mateo') && /left the test 4 times; the rule was lock after 2, and it was never unlocked/.test(f.text), 'left more times than "lock after" allowed, never unlocked');
  has('rule', f => f.names.includes('Haddad, Yusuf') && /left the test 3 times; the rule was end after 3, and it did not end/.test(f.text), 'left as many times as "end after" allowed, and it did not end');
  has('long', f => f.names.includes('Reyes, Valentina') && /more than twice the class's typical/.test(f.text), 'a sitting more than twice the class\'s median');
  has('teacher', f => f.names.includes('Ferreira, Lucas') && /did not finish/.test(f.text), 'a test the site closed (ended by the teacher\'s side)');
  has('time', f => f.names.includes('Johnson, Mikayla') && /ran out of time \(30 minutes allowed\): the site closed it with what was saved/.test(f.text), 'a test that ran out of the time allowed (ended: \'time\')');
  check(read[b.codes.byIndex[10]].limit === 30 && read[b.codes.byIndex[6]].limit === null && read[b.codes.byIndex[0]].limit === 120 && read[b.codes.byIndex[10]].ended === 'time', 'site.limit is read (30, none, the default 120) and ended: \'time\' kept');
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
  done();
})().catch(e => { console.error(e); check(false, 'crashed: ' + e.message); done(); });
