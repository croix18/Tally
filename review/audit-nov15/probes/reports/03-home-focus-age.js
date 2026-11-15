// RPT-03: Home's "Focus gradebook is N days old" dates the gradebook by when it was imported; the print check dates the
// same gradebook by when Focus wrote it (NOTES: "Focus is dated by the file"). An old export imported today is "fresh" on Home.
const H = require('./h.js');
(async () => { const { b, p, errs, K, asks } = await H.open();
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    T.state.settings.remindDays = 7; s.grades.exportedAt = new Date(Date.now() - 10 * 864e5).toISOString(); s.grades.importedAt = new Date().toISOString(); T.save(); T.render();
    const home = A.attentionItems(s).map(a => a.text).filter(t => /Focus gradebook/.test(t)); const stale = A.staleExports(s, [0]);
    return { home, stale }; }, K);
  console.log('OBSERVED: Home reminders about the gradebook:', JSON.stringify(out.home), '| print check:', JSON.stringify(out.stale));
  console.log('EXPECTED: Home also says the Focus gradebook is 10 days old (remind after 7), as the print check does');
  H.check(out.home.some(t => /10 days old/.test(t)), 'Home dates the gradebook by the file, like the print check');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
