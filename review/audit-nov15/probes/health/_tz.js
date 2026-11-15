const { open, K } = require('./_load.js');
(async () => { const { b, p } = await open({ ctx: process.env.SHIFT_TZ ? { timezoneId: process.env.SHIFT_TZ } : {} });
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    return { imp: gb.importedAt, exp: gb.exportedAt, hist: (s.gradeHistory || []).map(h => h.date + '/' + h.q), today: A.todayISO(), local: A.localDayOf(gb.importedAt), sDate: s.date, now: new Date().toString() }; }, K);
  console.log(JSON.stringify(o)); await b.close(); })();
