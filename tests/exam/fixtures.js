#!/usr/bin/env node
/* Synthetic Tests fixtures (16 Nov 2026): an invented class of 28 (4th Period, on-level) and 6 more (5th Period), the
   records of a unit test they took on the site, locked with vendor/seal.js and keys made for these fixtures only, the
   Google Form's response sheet with the mess a real one has, and the cockpit's results file. No real student anywhere.
     node tests/exam/fixtures.js            writes fixtures/exams/ (deterministic but for the keys and each lock's randomness)
   Also a module: require('./exam-fixtures.js').build(seed) → {students, records, sheet, …} without the locking, for the
   stand-in site (tests/exam/site.js), which locks records to whatever Tally key it is given, as the real site does.

   Every record is in the shape DESIGN.md pins (the record; "The log's shape"); each student is one kind of sitting:
   the plain, the perfect, the one who left a lot, the one whose test ended itself, a long idle, heavy scratch paper,
   logs at their caps with drop counts, no log at all (null), fields the page could not fill (null), two tests, a code
   two students turned in, a typo'd code, a record locked to another Tally, a forged one signed by another key, another
   unit, the other course, a name Tally can't be sure of, a finish outside the period. */
'use strict';
const fs = require('fs'), path = require('path');
const SEAL = require(path.join(__dirname, '..', '..', 'vendor', 'seal.js'));
const OUT = path.join(__dirname, '..', '..', 'fixtures', 'exams');
const ABC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// 28 + 6 invented students. Two Avas, an accent, a hyphen, an apostrophe, a middle name, a suffix.
const P4 = ['Nguyen, Ava Marie', 'Brooks, Ava', 'Ramírez, José', 'Garcia-Lopez, Alexander', "O'Neil, Brennan", 'Whitaker, Dominic Jr.', 'Okafor, Chidinma', 'Lindqvist, Elsa', 'Patel, Rohan', 'Moreau, Camille', 'Johnson, Mikayla',
  'Haddad, Yusuf', 'Kowalski, Piotr', 'Tran, Linh', 'Delgado, Mateo', 'Fischer, Hannah', 'Abara, Kofi', 'Sato, Haruto', 'Bianchi, Giulia', 'MacLeod, Fiona', 'Reyes, Valentina', 'Kim, Daniel', 'Osei, Ama', 'Novak, Tereza',
  'Hughes, Caleb', 'Ferreira, Lucas', 'Ivanova, Daria', 'Bello, Tunde'];
const P5 = ['Quinlan, Rory', 'Santos, Bianca', 'Achebe, Obi', 'Larsen, Freya', 'Mendez, Carlos', 'Yilmaz, Selin'];
const first = d => d.split(', ')[1].replace(/ Jr\.$/, '').split(' ')[0], last = d => d.split(', ')[0];
const firstLast = d => d.split(', ')[1].replace(/ Jr\.$/, '') + ' ' + d.split(', ')[0] + (/ Jr\.$/.test(d) ? ' Jr.' : '');

/* the test: On-level (m7) Unit 10, 18 questions, 2 points each; questions 4 and 9 have parts (a) and (b), a point each */
const QS = [
  { q: '1', type: 'text', key: '3/4', wrong: ['0.7', '4/3', '3'], almost: '0.75' },
  { q: '2', type: 'mc', key: 1, n: 4 }, { q: '3', type: 'multi', key: [0, 2], n: 4 },
  { q: '4a', type: 'text', key: '12', wrong: ['10', '14'] }, { q: '4b', type: 'text', key: '-5', wrong: ['5', '-6'] },
  { q: '5', type: 'nline', key: { c: '3', closed: true, dir: 'right' } },
  { q: '6', type: 'cgraph', key: [{ name: 'Soccer', deg: 90 }, { name: 'Swim', deg: 90 }, { name: 'Track', deg: 180 }] },
  { q: '7', type: 'text', key: ['2', '5'], boxes: 2 },
  { q: '8', type: 'text', key: 'x ≥ 4', wrong: ['x > 4', 'x ≤ 4'], almost: '4 ≤ x' },
  { q: '9a', type: 'text', key: '$18.75', wrong: ['$18.50', '$17.25'] }, { q: '9b', type: 'mc', key: 3, n: 4 },
  { q: '10', type: 'text', key: '2.5', wrong: ['25', '0.25'], almost: '5/2' }, { q: '11', type: 'mc', key: 0, n: 4 }, { q: '12', type: 'text', key: '-2/3', wrong: ['2/3', '-3/2'] },
  { q: '13', type: 'nline', key: { c: '-1.5', closed: false, dir: 'left' } }, { q: '14', type: 'text', key: '144', wrong: ['124', '12'] }, { q: '15', type: 'mc', key: 2, n: 4 },
  { q: '16', type: 'text', key: '7x + 3', wrong: ['7x+5', '10x'] }, { q: '17', type: 'multi', key: [1, 3], n: 5 }, { q: '18', type: 'text', key: '0.4', wrong: ['4', '0.04'], almost: '2/5' }];
const LET = 'ABCDEFGH';
const keyTextOf = p => p.type === 'mc' ? LET[p.key] : p.type === 'multi' ? p.key.map(k => LET[k]).join(',') : p.type === 'nline' ? 'nline:' + p.key.c + '|' + (p.key.closed ? 'closed' : 'open') + '|' + p.key.dir : p.type === 'cgraph' ? 'cgraph:' + p.key.map(s => s.name + '=' + s.deg).join('|') : Array.isArray(p.key) ? p.key.slice() : p.key;
const pointsOf = p => /[ab]$/.test(p.q) ? 1 : 2;
const OF = QS.reduce((a, p) => a + pointsOf(p), 0);

function code(r) { for (;;) { let s = ''; for (let i = 0; i < 12; i++) s += ABC[Math.floor(r() * 32)]; if (/[0-9]/.test(s)) return s; } }
// a local time on 16 Nov 2026 (the fixtures' day), as the site's clock would stamp it
const at = (h, m, s) => new Date(2026, 10, 16, h, m, s || 0).getTime();

/* one sitting. o: {skill 0..1, start: ms, away: n, kinds, idle: [sec], scratch: 'heavy'|'some'|null, calc: n, cap, log: false
   (null log), nulls, ended, rule, course, unit, skew (device clock seconds behind), pastes, flagEnd} */
function sitting(r, o) {
  const started = o.start, parts = [], vals = {}, qlog = {}, visits = [], away = [], calc = [], opens = [], idle = [], blocked = [], end = {}, timeline = [];
  let t = 2 + Math.floor(r() * 4), right = 0;
  const qnums = [...new Set(QS.map(p => p.q.replace(/[ab]$/, '')))];
  const pick = l => l[Math.floor(r() * l.length)];
  const answer = (p, good) => { if (p.type === 'mc') return good ? p.key : (p.key + 1 + Math.floor(r() * (p.n - 1))) % p.n;
    if (p.type === 'multi') return good ? p.key.slice() : [p.key[0]]; if (p.type === 'nline') return good ? { ...p.key } : { ...p.key, closed: !p.key.closed };
    if (p.type === 'cgraph') return good ? p.key.map(s => ({ ...s })) : [{ name: p.key[0].name, deg: 180 }, { name: p.key[2].name, deg: 180 }];
    if (p.boxes) return good ? p.key.slice() : [p.key[0], String(+p.key[1] + 1)]; return good ? p.key : pick(p.wrong); };
  const verdict = {}; const typed = {};
  QS.forEach(p => { const roll = r(); let v = roll < o.skill ? 'right' : roll < o.skill + 0.08 && p.almost ? 'almost' : roll < o.skill + 0.12 ? 'blank' : roll < o.skill + 0.15 && p.type === 'text' ? 'unread' : 'wrong';
    if (o.blankFrom && +p.q.replace(/[ab]$/, '') >= o.blankFrom) v = 'blank';
    verdict[p.q] = v; typed[p.q] = v === 'right' ? answer(p, true) : v === 'almost' ? p.almost : v === 'blank' ? null : v === 'unread' ? 'about ' + pick(['three fourths', 'half', 'twelve']) : answer(p, false); });
  for (const q of qnums) {
    const dwell = 35 + Math.floor(r() * 110) + (o.slowQ === q ? 400 : 0), ps = QS.filter(p => p.q.replace(/[ab]$/, '') === q);
    const firstAns = ps.every(p => typed[p.q] == null) ? null : 6 + Math.floor(r() * Math.min(60, dwell - 8));
    visits.push([q, t, dwell]);
    qlog[q] = { sec: dwell, visits: 1, first: firstAns, flag: false, flagEnd: false };
    ps.forEach((p, k) => { if (typed[p.q] == null) return; const how = p.type === 'text' ? (r() < 0.7 ? 'typed' : 'keypad') : 'tap'; const l = vals[p.q] = [];
      if (r() < 0.35 && p.type !== 'cgraph') l.push([t + firstAns + k * 4, answer(p, verdict[p.q] !== 'right'), how]);
      l.push([t + firstAns + k * 4 + (l.length ? 9 + Math.floor(r() * 20) : 0), typed[p.q], how]);
      timeline.push([t + firstAns + k * 4 + 3, p.q]); });
    if (o.calc && r() < o.calc) calc.push([pick(['fast', 'ti']), q, t + 4, 12 + Math.floor(r() * 50)]);
    if (o.scratch && r() < (o.scratch === 'heavy' ? 0.8 : 0.25)) { const tab = r() < 0.5 ? 'notes' : 'grid'; opens.push([tab, q, t + 3, 15 + Math.floor(r() * 60)]);
      if (tab === 'notes' || o.scratch === 'heavy') end[q] = { n: o.scratch === 'heavy' ? pick(['12 × 3 = 36\n36 + 108 = 144', 'half of 5 is 2.5\nso 5/2', 'x + 4 > 8\nx > 4 … no, ≥', 'total = 18.75\n3 × 6.25']) : '', g: { v: [r() < 0.5 ? 4 : 1, pick([1, 2, 5])], o: tab === 'grid' ? [['p', 10, 10], ['p', 13, 14], ['s', 10, 10, 13, 14], ['l', 4, 2, 6, 6]].slice(0, 2 + Math.floor(r() * 3)) : [] } }; }
    if (o.away && away.length < o.away && r() < Math.max(0.3, o.away / qnums.length)) { const n = Math.min(3, o.away - away.length); for (let i = 0; i < n && away.length < o.away; i++) away.push([t + 10 + i * 9, 3 + Math.floor(r() * (o.awayLong || 40)), (o.kinds || ['tab'])[away.length % (o.kinds || ['tab']).length], q]); }
    if (o.blocked && r() < 0.4) blocked.push([t + 5, pick(['copy', 'menu', 'selectall', 'print', 'cut']), q]);
    if (o.idle && o.idle.length && r() < 0.25) idle.push([t + 20, o.idle.shift(), q]);
    t += dwell;
  }
  // a review pass: back to a few questions; one is flagged and stays flagged
  const back = qnums.filter(() => r() < 0.25);
  back.forEach((q, i) => { const s = 8 + Math.floor(r() * 40); visits.push([q, t, s]); qlog[q].visits++; qlog[q].sec += s; if (i === 0) { qlog[q].flag = true; qlog[q].flagEnd = !!o.flagEnd; } t += s; });
  (o.idle || []).forEach(s => idle.push([Math.floor(t / 2), s, qnums[3]]));
  if (o.away) { while (away.length < o.away) away.push([20 + away.length * 31, 6, (o.kinds || ['tab'])[away.length % (o.kinds || ['tab']).length], '3']); away.length = o.away; }   // exactly as many times away as the sitting is meant to have
  const total = t + 4 + (o.extra || 0), finished = started + total * 1000;
  QS.forEach(p => { const v = verdict[p.q]; const pv = v === 'almost' ? 'wrong' : v; parts.push({ id: p.q, type: p.type, typed: typed[p.q], v: pv, almost: v === 'almost', key: keyTextOf(p) }); if (pv === 'right') right += pointsOf(p); });
  const skew = (o.skew || 0) * 1000;
  let log = { v: 1, t0: started + 1400 - skew, t1: finished + 300 - skew, q: qlog, visits, parts: {}, calc, scratch: { opens, end, cut: !!o.cut }, away, blocked, idle,
    device: { sw: 1366, sh: 768, ww: 1366, wh: 657, dpr: 1, touch: false, os: 'ChromeOS', osv: '128.0', br: 'Chrome', brv: '128', dark: false, large: false, zoom: 1, tz: 'America/New_York' }, fails: 0,
    drop: { visits: 0, calc: 0, scratch: 0, away: 0, blocked: 0, idle: 0 } };
  Object.keys(vals).forEach(id => { log.parts[id] = { vals: vals[id], n: vals[id].length, pastes: 0 }; });
  if (o.pastes) { const id = '1'; if (log.parts[id]) log.parts[id].pastes = o.pastes; }
  if (o.cap) {   // a log at its caps: 300 visits, 100 of each other list, the counts of what was dropped
    while (log.visits.length < 300) { const v = log.visits[log.visits.length % 20]; log.visits.push([v[0], Math.min(total - 2, v[1] + 1), 1]); }
    log.drop.visits = 45; const fill = (k, mk) => { while (log[k].length < 100) log[k].push(mk(log[k].length)); };
    fill('away', i => [10 + i * 20, 2, 'tab', String(1 + i % 18)]); log.drop.away = 7; fill('blocked', i => [12 + i * 20, 'copy', String(1 + i % 18)]); log.drop.blocked = 31;
    while (log.calc.length < 100) log.calc.push(['ti', String(1 + log.calc.length % 18), 5 + log.calc.length * 20, 3]); log.drop.calc = 3;
    log.parts['14'] = { vals: [[100, '12', 'typed'], [101, '124', 'typed'], [102, '1244', 'typed'], [103, '124', 'typed'], [900, '14', 'typed'], [901, '144', 'typed'], [902, '1444', 'typed'], [903, '144', 'typed'], [1200, '14', 'typed'], [1201, '144', 'typed'], [1202, '1440', 'typed'], [1203, '144', 'typed']], n: 37, pastes: 0 };
  }
  if (o.nulls) { log.device = { sw: null, sh: null, ww: 1280, wh: null, dpr: null, touch: null, os: null, osv: null, br: 'Chrome', brv: null, dark: null, large: null, zoom: null, tz: null }; log.fails = null; log.t0 = null; Object.values(log.q).forEach(e => { e.first = null; }); }
  if (o.log === false) log = null;
  return { v: 1, id: [...Array(16)].map(() => '0123456789abcdef'[Math.floor(r() * 16)]).join(''), code: null, course: o.course || 'm7', unit: o.unit == null ? 10 : o.unit, cv: 3, kit: '7f3a9c21b04e', seed: [...Array(32)].map(() => '0123456789abcdef'[Math.floor(r() * 16)]).join(''),
    site: { started, finished, saves: 20 + Math.floor(r() * 30), timeline: timeline.sort((a, b) => a[0] - b[0]), limit: o.limit === undefined ? 120 : o.limit, ...(o.opened === null ? {} : { opened: o.opened || at(9, 38) }) },
    rule: o.rule || { leave: 'count', after: 3 }, ended: o.ended || null, unlocks: o.unlocks || 0, parts, points: right, of: OF, log };
}

/* A record's strings are the student's own (CHANGES-16NOV §6, review N4): markup, a closing script tag, a 200-character run,
   right-to-left and zero-width characters, an answer that is a 2 KB object, junk among the times away. Tally shows them inert. */
const HOSTILE = { img: '<img src=x onerror="document.title=\'pwned\'">', script: '</script><script>document.title="pwned"</script>', run: 'W'.repeat(200), rtl: '\u202Eevil\u202C txt\u200B\u200Dzero\uFEFFwidth' };
function hostile(rec) {
  rec.parts[0].typed = HOSTILE.img; rec.parts[0].v = 'wrong';
  rec.parts[3].typed = HOSTILE.run + HOSTILE.rtl; rec.parts[3].v = 'unread';
  rec.parts[1].typed = { junk: 'x'.repeat(2000), nested: { a: [1, 2, HOSTILE.script] } };
  rec.parts[2].key = HOSTILE.script;
  const L = rec.log; L.scratch.end['2'] = { n: HOSTILE.script + '\n' + HOSTILE.img + '\n' + HOSTILE.rtl + '\n' + HOSTILE.run, g: { v: [4, 1], o: [['p', 3, 4], ['zz', 1], ['l', 'a', 1, 2, 3]] } };
  L.away.push(['x', 5, 'tab', '1'], [30, -4, 'tab', '1'], [40, 999999, 'tab', '1'], null, [50, 1e400, 'tab', '1'], 'junk');
  L.device.os = HOSTILE.img; L.device.br = HOSTILE.rtl; L.calc.push([HOSTILE.script, '2', 60, 5]);
  if (L.parts['1']) L.parts['1'].vals.push([70, HOSTILE.img, 'typed']);
}
/* The class, the records and the sheet. Each record carries how it is to be locked (to: 'tally' | 'other'; by: 'site' | 'old'
   | 'forger'); `rows` are the form's responses, in the order they came in. */
function build(seed) {
  const r = rng(seed == null ? 20261116 : seed); const recs = [], rows = [];
  const add = (who, o, extra) => { const rec = sitting(r, o); rec.code = code(r); recs.push({ code: rec.code, record: rec, to: 'tally', by: 'site', who, ...(extra || {}) }); return rec.code; };
  const day = (i, late) => at(9, 41 + (i % 6), (i * 7) % 60) + (late || 0);
  const row = (name, c, when, x) => rows.push({ when, name, code: c, ...(x || {}) });
  const fmt = ms => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; };
  const sk = [0.92, 0.75, 0.55, 0.85, 0.66, 0.48, 0.81, 0.7, 0.6, 0.88, 0.73, 0.52, 0.95, 0.64, 0.79, 0.58, 0.83, 0.69, 0.77, 0.61, 0.9, 0.72, 0.5, 0.86, 0.67, 0.74, 0.8, 0.63];
  const kinds = {
    0: { skill: 1, away: 0, calc: 0, scratch: null },                                                    // perfect, nothing used
    1: { away: 12, kinds: ['tab', 'window', 'fullscreen', 'tab', 'reload'], awayLong: 90, blocked: true },   // left a lot
    2: { away: 3, kinds: ['tab'], rule: { leave: 'end', after: 3 }, ended: 'left', blankFrom: 11 },      // the test ended itself
    3: { idle: [612, 75] }, 4: { scratch: 'heavy', cut: true, calc: 0.5 }, 5: { cap: true, away: 3, calc: 0.3 },
    7: { nulls: true, unlocks: 1, rule: { leave: 'lock', after: 2 }, away: 2 },
    13: { pastes: 2, blocked: true }, 20: { skew: -184, flagEnd: true, extra: 2700 }, 21: { start: at(10, 52) }, 22: { slowQ: '6' },
    11: { rule: { leave: 'end', after: 3 }, away: 3 },                                                 // left 3 times under "end after 3" and it did not end
    14: { rule: { leave: 'lock', after: 2 }, away: 4 },                                                // left 4 times under "lock after 2", never unlocked
    25: { ended: 'teacher' },
    10: { ended: 'time', limit: 30, extra: 600 },                                                       // ran out of the 30 minutes allowed
    6: { log: false, limit: null },                                                                    // no time limit                                                                          // the site closed it with what was saved
    27: { start: at(13, 5), opened: at(12, 55) },                                                      // taken in the afternoon, in another opening (at home?)
    26: { opened: null } };                                                                            // an older record with no site.opened
  const codes = {};
  P4.forEach((d, i) => { codes[i] = add({ sec: 4, n: d }, { skill: sk[i], start: day(i), calc: 0.15, scratch: 'some', away: i % 4 === 1 ? 1 : 0, ...(kinds[i] || {}) }, i === 23 ? { by: 'old' } : null); });   // Tereza's is signed with the site's key from before it was made again; Daniel finishes after the period
  // the mess
  const twice = add({ sec: 4, n: P4[8] }, { skill: 0.9, start: at(10, 35), calc: 0.2 });                   // Rohan Patel sat it twice
  const other = add({ sec: 4, n: P4[12] }, { skill: 0.8, start: day(12) }, { to: 'other' });                // locked to another Tally
  const forged = add({ sec: 4, n: P4[16] }, { skill: 1, start: day(16) }, { by: 'forger' });               // a perfect score signed by someone else
  const unit9 = add({ sec: 4, n: P4[18] }, { skill: 0.7, start: at(9, 43), unit: 9 });                       // another unit
  const a7 = add({ sec: 4, n: P4[19] }, { skill: 0.6, start: at(9, 44), course: 'a7', unit: 4 });            // the other course
  const late = codes[21], oldKey = codes[23];
  const nobody = add(null, { skill: 0.66, start: day(25), ended: 'teacher' });                            // abandoned: the site finished and sealed it                                                  // nobody turned it in (the cockpit's file has it)
  const p5 = P5.map((d, i) => add({ sec: 5, n: d }, { skill: 0.6 + i * 0.05, start: at(10, 41 + i), calc: 0.1, opened: at(10, 38) }));
  hostile(recs.find(x => x.code === p5[0]).record);                                                       // a genuinely signed record full of a student's own strings
  // the responses, as the form collected them
  P4.forEach((d, i) => {
    const when = fmt(recs.find(x => x.code === codes[i]).record.site.finished + 40000 + i * 1000);
    if (i === 10) return row('Mikayla Jonson', codes[i], when);                                // a typo in the name: matched, loosely
    if (i === 0) return row('ava nguyen', codes[i].toLowerCase().replace(/(.{4})(.{4})/, '$1 $2 '), when);   // lower case, spaces
    if (i === 1) return row('Ava', codes[i], when);                                            // which Ava? Tally asks
    if (i === 2) return row('Jose Ramirez', SEAL.showCode(codes[i]), when);                    // no accent typed: still exact
    if (i === 3) return row('Alex Garcia-Lopez', codes[i], when);                              // a nickname: loose
    if (i === 9) return row(firstLast(d), codes[i], when);                                     // Camille turns in her own code …
    if (i === 15) return row(firstLast(d), codes[9], when);                                    // … and Hannah turns in Camille's (a code two students turned in); Hannah's own is nobody's
    if (i === 17) return row(firstLast(d), codes[17].slice(0, 11) + (codes[17][11] === 'Z' ? 'Y' : 'Z'), when);   // one character wrong
    if (i === 24) return;                                                                         // Caleb never turned his in
    if (i === 26) return row(firstLast(d), codes[26].slice(0, 8), when);                       // a code cut short: not a code
    row(firstLast(d), codes[i], when);
  });
  row(firstLast(P4[8]), twice, fmt(at(11, 20)));                                                  // Rohan's second test
  row(firstLast(P4[12]), other, fmt(at(10, 31)));                                                 // the one locked to another Tally (Piotr's own is above too)
  row(firstLast(P4[16]), forged, fmt(at(10, 32)));
  row(firstLast(P4[18]), unit9, fmt(at(10, 33)));
  row(firstLast(P4[19]), a7, fmt(at(10, 34)));
  P5.forEach((d, i) => row(firstLast(d), p5[i], fmt(at(11, 25 + i))));
  return { students: { 4: P4, 5: P5 }, recs, rows, fmt, codes: { twice, other, forged, unit9, a7, late, oldKey, nobody, p5, byIndex: codes }, OF };
}

/* the response sheet two ways: as copied from the sheet (tabs, the form's own column order and an extra question), and as its
   CSV download (another order, blank rows, quotes) */
function sheets(b) {
  const tsv = ['Timestamp\tEmail Address\tWhat period are you in?\tFull name\tYour test code\tHow did it go?'];
  b.rows.forEach((x, i) => { tsv.push([x.when, 'student' + (i + 1) + '@students.example.org', x.name === 'Rory Quinlan' || /Santos|Achebe|Larsen|Mendez|Yilmaz/.test(x.name) ? '5' : '4', x.name, x.code, i % 5 ? '' : 'ok I think'].join('\t')); if (i === 6) tsv.push('\t\t\t\t\t'); });
  const q = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  const csv = ['"Your test code","Full name","Timestamp","How did it go?"'];
  b.rows.forEach((x, i) => { csv.push([x.code, x.name, x.when, i % 7 ? '' : 'fine, I guess'].map(q).join(',')); if (i % 9 === 4) csv.push(',,,'); });
  return { tsv: tsv.join('\n') + '\n', csv: csv.join('\r\n') + '\r\n' };
}
/* the class files Tally imports: a per-period IXL Score Grid and a Focus gradebook for each */
function classFiles(b) {
  const files = {};
  for (const [p, list] of Object.entries(b.students)) {
    const names = list.map(firstLast), r = rng(+p);
    const ixl = ['Unit,,Skill name,Permanent Skill ID,' + names.join(',')];
    [['Unit 10 Equations and Inequalities', 'Lesson 10.1', 'Solve one-step equations', 'K3P'], ['Unit 10 Equations and Inequalities', 'Lesson 10.2', 'Solve two-step equations', 'K4Q'], ['Unit 10 Equations and Inequalities', 'Lesson 10.3', 'Graph inequalities on number lines', 'K5R'], ['Unit 9 Expressions', 'Lesson 9.1', 'Combine like terms', 'J2M']]
      .forEach(s => ixl.push(s.join(',') + ',' + names.map(() => r() < 0.15 ? '' : String(Math.floor(40 + r() * 61))).join(',')));
    files[`IXL-Score-Grid_2026-11-16_This-School-Year_1205050-7T${p}A-M_J-GR7_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv`] = ixl.join('\n') + '\n';
    const hdr = (n, pts, a, d) => `"${n}\n \n\n \n ${pts} Points\n \n \n\n \n Assigned ${a}\n Due ${d}"`;
    const gb = ['"Student ID","Local ID","Student","Grade",' + [hdr('Unit 9 Assessment', 30, '11/03', '11/04'), hdr('Unit 10 IXL', 3, '11/05', '11/13'), hdr('10.1 Worksheet', 10, '11/06', '11/07')].join(',')];
    list.forEach((d, i) => { const a = Math.floor(14 + r() * 16), w = Math.floor(5 + r() * 6); const g = Math.round((a / 30 * 70 + w / 10 * 25 + 5) ); gb.push(`"${3333300000 + +p * 100 + i}","","${d.toUpperCase()}","${g}% ${g >= 90 ? 'A' : g >= 80 ? 'B' : g >= 70 ? 'C' : g >= 60 ? 'D' : 'F'}","${a}.0 - ${Math.round(a / 30 * 100)} % - A","2.0 - 67 % - A","${w}.0 - ${w * 10} % - A"`); });
    files[`focus_gradebook_p${p}.csv`] = gb.join('\n') + '\n';
  }
  return files;
}
/* lock every record as the site would: to the Tally key given (or another Tally's), signed by the site's key (or the old one,
   or a forger's); the cockpit's results file for the day, sealed the same way */
async function lockAll(b, keys, tallyPub) {
  const out = {};
  for (const x of b.recs) out[x.code] = await SEAL.seal(x.record, (x.by === 'forger' ? keys.forger : x.by === 'old' ? keys.old : keys.site).priv, x.to === 'other' ? keys.other.pub : tallyPub);
  return out;
}
function resultsFile(b, locked, keys) {
  return { site: { key: keys.site.pub }, results: b.recs.filter(x => x.record.course === 'm7' && x.record.unit === 10).map(x => { const r = x.record, aw = r.log ? r.log.away : [];
    const ok = aw.filter(e => Array.isArray(e) && typeof e[0] === 'number' && typeof e[1] === 'number' && isFinite(e[1]) && e[1] >= 0 && e[1] <= 86400), secs = Math.round((r.site.finished - r.site.started) / 1000);
    return { code: x.code, course: r.course, unit: r.unit, points: r.points, of: r.of, seconds: secs, away: ok.length, awaySeconds: Math.min(secs, ok.reduce((a, e) => a + e[1], 0)), opened: r.site.opened == null ? null : r.site.opened, started: r.site.started, finished: r.site.finished, record: locked[x.code] }; }) };
}
async function makeKeys() { return { site: await SEAL.makeSiteKey(), old: await SEAL.makeSiteKey(), forger: await SEAL.makeSiteKey(), tally: await SEAL.makeTallyKey(), other: await SEAL.makeTallyKey() }; }

module.exports = { HOSTILE, build, sheets, classFiles, lockAll, resultsFile, makeKeys, QS, OF, P4, P5, firstLast, at };

if (require.main === module) (async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = build(), keys = await makeKeys(), sh = sheets(b), locked = await lockAll(b, keys, keys.tally.pub);
  fs.writeFileSync(path.join(OUT, 'keys.json'), JSON.stringify({ note: 'Made for these fixtures only (tests/exam/fixtures.js); they lock nothing real.', site: keys.site, old: keys.old, forger: keys.forger, tally: keys.tally, other: keys.other }, null, 1) + '\n');
  fs.writeFileSync(path.join(OUT, 'records.json'), JSON.stringify(b.recs, null, 0) + '\n');
  fs.writeFileSync(path.join(OUT, 'locked.json'), JSON.stringify(locked, null, 0) + '\n');
  fs.writeFileSync(path.join(OUT, 'responses.tsv'), sh.tsv); fs.writeFileSync(path.join(OUT, 'responses.csv'), sh.csv);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(resultsFile(b, locked, keys)) + '\n');
  for (const [f, t] of Object.entries(classFiles(b))) fs.writeFileSync(path.join(OUT, f), t);
  const sizes = b.recs.map(x => JSON.stringify(x.record).length).sort((a, c) => a - c);
  console.log(`exam fixtures: ${b.recs.length} records (${Object.keys(b.students).map(k => b.students[k].length).join(' + ')} students), ${b.rows.length} responses; a record is ${Math.round(sizes[0] / 1024)}–${Math.round(sizes[sizes.length - 1] / 1024)} KB of JSON (median ${Math.round(sizes[sizes.length >> 1] / 1024)} KB)`);
})().catch(e => { console.error(e); process.exit(1); });
