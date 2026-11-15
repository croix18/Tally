// Exploration harness (not a finding): populate, then Full save -> load on an empty Tally; save -> reload; clean* idempotence.
const D = require('./dat-lib.js');
(async () => {
  const { b, ctx, p, errs } = await D.open(); await D.loadClass(p); const info = await D.populate(p); console.log('populated', JSON.stringify(info));
  const before = await p.evaluate(() => { const T = window.__tally; return JSON.stringify({ tally: 4, full: { saved: new Date().toISOString(), classes: T.state.order.length, how: 'manual' }, state: T.stateForSave() }); });
  // 1. reload through migrate
  await p.reload(); await p.waitForTimeout(800);
  const r1 = await p.evaluate(([before, DIFF]) => { const diff = eval(DIFF); const a = JSON.parse(before).state; const bb = JSON.parse(JSON.stringify(window.__tally.stateForSave())); return diff(a, bb); }, [before, D.DIFF]);
  console.log('RELOAD diffs', r1.length); r1.forEach(x => console.log('  ' + x));
  // 2. Full save -> empty Tally
  const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push('p2 ' + e.message)); p2.on('dialog', d => d.accept());
  await p2.goto('about:blank'); await p2.evaluate(() => localStorage.clear()).catch(() => {});
  const b2 = await D.L.chromium.launch({ executablePath: D.L.exe }); const c2 = await b2.newContext({ timezoneId: 'America/New_York' }); const q = await c2.newPage(); q.on('pageerror', e => errs.push('q ' + e.message)); q.on('dialog', d => d.accept());
  await q.goto('file://' + require('path').resolve(D.L.APP));
  const r2 = await q.evaluate(async ([before, DIFF]) => { const diff = eval(DIFF); const cfg = JSON.parse(before); await window.__all.loadTallyFile({ name: 'tally-full-x.json' }, JSON.parse(before)); const bb = JSON.parse(JSON.stringify(window.__tally.stateForSave())); return diff(cfg.state, bb); }, [before, D.DIFF]);
  console.log('FULL-LOAD diffs', r2.length); r2.forEach(x => console.log('  ' + x));
  // 3. clean* idempotence / keeps-valid on the live values
  const r3 = await p.evaluate(([K, DIFF]) => { const diff = eval(DIFF); const A = window.__all, s = A.state.sections[K], st = A.state; const out = {};
    const t = (name, f, v) => { const c = JSON.parse(JSON.stringify(v)); const once = f(JSON.parse(JSON.stringify(v))); const twice = f(JSON.parse(JSON.stringify(once))); out[name] = { keeps: diff(c, JSON.parse(JSON.stringify(once)), 6), idem: diff(JSON.parse(JSON.stringify(once)), JSON.parse(JSON.stringify(twice)), 6) }; };
    t('cleanNotes', A.cleanNotes, s.stuNotes); t('cleanFamily', A.cleanFamily, s.family); t('cleanPractice', A.cleanPractice, s.practice); t('cleanConfForms', A.cleanConfForms, s.confForms); t('cleanReportLog', A.cleanReportLog, s.reportLog);
    t('cleanOverrides', A.cleanOverrides, s.overrides); t('cleanArchive', A.cleanArchive, s.qArchive); t('cleanGB(live)', A.cleanGB, s.grades); t('cleanTests', A.cleanTests, st.tests); t('cleanTestInfo', A.cleanTestInfo, st.testInfo); t('cleanTestDates', A.cleanTestDates, st.testDates); t('cleanDismissed', A.cleanDismissed, st.dismissed);
    for (const k in s.seatInfo) t('cleanSeatInfo', A.cleanSeatInfo, s.seatInfo[k]);
    return out; }, [D.K, D.DIFF]);
  for (const [k, v] of Object.entries(r3)) console.log('CLEAN', k, 'keeps:', v.keeps.length ? v.keeps.join(' ; ') : 'ok', '| idem:', v.idem.length ? v.idem.join(' ; ') : 'ok');
  console.log('errors', errs.join(' | '));
  await b.close(); await b2.close();
})().catch(e => { console.error(e); process.exit(2); });
