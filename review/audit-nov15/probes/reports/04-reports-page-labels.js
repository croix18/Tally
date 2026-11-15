// RPT-04: the Reports page describes things the print no longer does: the weekly button promises "what moved" (the
// "Since the last report" strip went 7 Nov 2026), and "What changed this week" says "since the last report" although it
// compares the last two imports. And "By grade" with only "No grade yet" picked titles the print "(...)" with nothing inside.
const H = require('./h.js');
(async () => { const { b, ctx, p, errs, K } = await H.open();
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; A.openPrintMenu(s, false);
    const wk = document.querySelector('#rpWeekly small').textContent, dg = document.querySelector('#rpDigest small').textContent;
    const rep = new DOMParser().parseFromString(A.studentReportSection(s, 0, A.gbRows(s)[0]), 'text/html').body.textContent;
    return { wk, dg, moved: /since the last report|what moved/i.test(rep) }; }, K);
  // By grade -> only "No grade yet": give one student no grade so the button is enabled, then read the print's title
  await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; s.grades.assignments.forEach(a => { a.status[0] = 'excused'; a.values[0] = null; }); T.save(); A.openPrintMenu(s, false); }, K);
  await p.click('[data-who="letters"]'); for (const L of ['C', 'D', 'F']) await p.click(`[data-letter="${L}"]`); await p.click('[data-letter="—"]');
  const [w] = await Promise.all([ctx.waitForEvent('page'), p.click('#rpWeekly')]); await w.waitForLoadState(); const title = await w.title(); await w.close();
  console.log('OBSERVED:', JSON.stringify({ weeklyButton: o.wk, digestButton: o.dg, reportSaysWhatMoved: o.moved, printTitle: title }));
  console.log('EXPECTED: the weekly button names only what the report holds (no "what moved"); the digest button says what it compares (the last two imports); the title says which students ("No grade yet"), never "()"');
  H.check(!/what moved/.test(o.wk) || o.moved, 'the weekly button does not promise "what moved"');
  H.check(!/since the last report/.test(o.dg), 'the digest button does not say "since the last report"');
  H.check(!/\(\)/.test(title), 'the print title is not "...()": ' + title);
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
