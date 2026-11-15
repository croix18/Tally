// DAT-07: Scrub.html gives two different real students the same pseudonym once a session has seen ~100 name tokens.
// fakeToken() draws from 50 first / 49 last names; `used` is one set for every role, and its retry loop stops at
// used.size >= 2 * pool.length, after which a fake already in use is handed out again. A year of exports (six IXL
// files, six gradebooks, the roster: ~180 students, ~360 distinct name tokens) is well past that.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/data/repo';
const { chromium, exe, check, done, SCRUB } = require(path.join(REPO, 'tests/lib.js'));
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(SCRUB));
  const r = await p.evaluate(() => { const S = window.__scrub.scrubName;
    // 180 synthetic students (made-up letter strings, not real names)
    const word = (i, salt) => { let s = ''; let n = i * 7 + salt; for (let k = 0; k < 6; k++) { s += 'bcdfghjklmnprstvz'[n % 17] + 'aeiou'[(n >> 2) % 5]; n = Math.floor(n / 3) + k * 11; } return s[0].toUpperCase() + s.slice(1, 7) + i; };
    const real = Array.from({ length: 300 }, (_, i) => `${word(i % 110, 3)}, ${word(i, 5)}`);   // one session of a year of files: 300 students, 110 surnames shared (siblings, common surnames), 300 distinct first names
    const fake = real.map(n => S(n)); const by = new Map(); fake.forEach((f, i) => { (by.get(f) || by.set(f, []).get(f)).push(real[i]); });
    const dup = [...by.entries()].filter(([, l]) => l.length > 1); const firsts = new Map(); real.forEach((n, i) => { const rf = n.split(', ')[1], ff = fake[i].split(', ')[1]; (firsts.get(ff) || firsts.set(ff, new Set()).get(ff)).add(rf); }); const firstClash = [...firsts.values()].filter(x => x.size > 1).length;
    // the same student read in the other order still maps to the same fake (consistency must hold)
    const swap = real.slice(0, 20).every((n, i) => { const [l, f] = n.split(', '); const g = S(f + ' ' + l); const [fl, ff] = fake[i].split(', '); return g === ff + ' ' + fl; });
    return { students: real.length, distinctFakes: by.size, sharedPseudonyms: dup.length, firstNameFakesSharedByTwoRealFirstNames: firstClash, example: dup[0] ? { fake: dup[0][0].replace(/[a-z]/g, '') + '…', reals: dup[0][1].length } : null, orderConsistent: swap }; });
  console.log('OBSERVED:', JSON.stringify(r));
  console.log('EXPECTED:', '300 distinct real students -> 300 distinct pseudonyms, and distinct real first names -> distinct fake first names (a shared pseudonym merges two students in every scrubbed fixture: one row read as the other, wrong matches)');
  check(r.distinctFakes === r.students, 'no two students share a pseudonym'); check(r.firstNameFakesSharedByTwoRealFirstNames === 0, 'no fake first name stands for two real first names');
  check(r.orderConsistent, 'one student keeps one pseudonym across name orders');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
