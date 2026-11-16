// Two students of one name (the WIF-01 staging of tests/audit-nov15-stu.js): what is KEPT per student (notes, family
// contacts and log, conference-form edits, the weekly report log) is keyed by norm(name), and norm() maps both marked
// names to one key ("sutter hayden skyler id"). So the second twin's page and conference form show the first one's.
const { chromium, fs, path, exe, check, done, pick, tmp, APP } = require(require('path').resolve('tests/lib'));
const K = '1205050-7T1A';
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'America/New_York' }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept()); await p.goto('file://' + path.resolve(APP));
  await p.setInputFiles('#file', [path.resolve('fixtures', fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed')))]); await p.waitForTimeout(500);
  const ros = fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8').split('\n'); const n0 = ros[0], n1 = ros[1]; ros[1] = n0;
  await p.fill('#rpText', ros.join('\n')); await p.click('#rpSave'); await p.waitForTimeout(300);
  const f = 'focus_gradebook_scrubbed_q2.csv'; const out = path.join(tmp, 'twin-' + f); fs.writeFileSync(out, fs.readFileSync(path.join('fixtures', f), 'utf8').split('"' + n1 + '"').join('"' + n0 + '"'));
  await p.setInputFiles('#file', [out]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all, s = T.state.sections[K];
    const tw = s.grades.students.filter(n => /^SUTTER, HAYDEN SKYLER/.test(n)); const [a, b] = tw;
    A.addNote(s, a, 'Private note about the FIRST twin');
    A.setFamily(s, a, { contacts: [{ id: 'x1', name: 'Parent of first twin', rel: 'Mother', phone: '555-0101', email: '', note: '' }], log: [] });
    s.confForms = s.confForms || {}; s.confForms[A.norm(a)] = { concerns: 'Concern written for the FIRST twin', base: { concerns: '' }, saved: new Date().toISOString() };
    T.save();
    T.openProfile(K, b); const page = document.querySelector('#view') ? document.querySelector('#view').innerText : document.body.innerText;
    const pc = document.querySelector('#pConf'); if (pc) pc.click(); const conc = (document.querySelector('#cfConcerns') || {}).value || '';
    return { tw, keyA: A.norm(a), keyB: A.norm(b), notesB: A.notesOf(s, b).map(n => n.text), famB: A.familyOf(s, b).contacts.map(c => c.name + ' ' + c.phone),
      pageHasNote: /FIRST twin/.test(page), pageHasPhone: /555-0101/.test(page), confB: conc }; }, K);
  console.log(JSON.stringify(r));
  console.log('OBSERVED: second twin: notes', JSON.stringify(r.notesB), 'family', JSON.stringify(r.famB), 'conference concerns', JSON.stringify(r.confB));
  console.log('EXPECTED: none of the first twin\'s notes, contacts or form text on the second twin');
  check(r.keyA !== r.keyB, 'the two students have different storage keys');
  check(!r.notesB.length && !r.pageHasNote, 'second twin shows no note of the first');
  check(!r.famB.length && !r.pageHasPhone, 'second twin shows no family contact of the first');
  check(!/FIRST/.test(r.confB), 'second twin\'s conference form does not start from the first one\'s words');
  check(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
