// Coverage harness (not a finding): Tally's pure date functions against an independent oracle, in four time zones and
// at the clock instants the brief lists. Exit 1 on any disagreement.
const { openAt, check, done, dn, ds, civil } = require('./_tim.js');
const TZS = ['America/New_York', 'UTC', 'Pacific/Honolulu', 'Asia/Tokyo'];
const LOCAL = ['2026-10-09T23:59', '2026-10-10T00:01', '2026-12-18T23:59', '2026-12-19T00:01', '2027-03-04T23:59', '2027-03-05T00:01', '2027-05-28T23:59', '2027-05-29T00:01',
  '2027-03-14T01:30', '2027-03-14T03:30', '2027-03-15T00:30', '2027-11-07T00:30', '2027-11-07T01:30', '2027-11-08T23:30', '2026-11-01T12:00', '2026-12-31T23:59', '2027-01-01T00:01', '2028-02-29T19:30',
  '2026-10-12T07:00', '2026-11-14T20:00', '2026-11-15T19:30', '2027-07-15T12:00', '2027-08-10T08:00', '2026-11-15T23:30'];
// a local wall time in tz -> instant (search; good to the minute)
function instantOf(local, tz) { let t = Date.parse(local + ':00Z'); for (let k = 0; k < 3; k++) { const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(t)).replace(', ', 'T'); t += Date.parse(local + ':00Z') - Date.parse(f + ':00Z'); } return t; }
let seed = 7; const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const ENDS = ['2026-10-09', '2026-12-18', '2027-03-04', '2027-05-28'];
const days = []; for (let i = 0; i < 300; i++) days.push(ds(dn('2026-07-01') + rnd(800)));
ENDS.forEach(e => days.push(e, ds(dn(e) + 1), ds(dn(e) - 1)));
const mds = []; for (let i = 0; i < 300; i++) mds.push(`${1 + rnd(13)}/${rnd(33)}` + ['', '/26', '/2027', '/7'][rnd(4)]); mds.push('01/08', '12/15', '7/1', '6/30', '13/1', '00/10', ' 9/5 ');
(async () => {
  let bad = 0, n = 0; const show = []; const B = await require('./_tim.js').chromium.launch({ executablePath: require('./_tim.js').exe });
  for (const tz of TZS) {
    const { ctx, p } = await openAt(tz, null, { browser: B });
    for (const lt of LOCAL) {
      const inst = instantOf(lt, tz); await p.clock.setFixedTime(new Date(inst));
      const r = await p.evaluate(({ days, mds }) => { const A = window.__all, T = window.__tally;
        return { today: A.todayISO(), age: days.map(d => A.ageDays(d)), week: days.map(d => A.weekOf(d)), btw: days.map((d, i) => A.daysBetween(d, days[(i + 1) % days.length])), q: days.map(d => A.quarterOf(d)),
          md: mds.map(m => A.mdToISO(m)), ldo: days.map((d, i) => A.localDayOf(new Date(Date.now() - i * 3600e3 * 7).toISOString())), now: Date.now(), qd: A.quarterDue(),
          td: days.slice(0, 40).map(d => A.testDays({ from: d, to: '' })), isday: ['2027-02-29', '2028-02-29', '2026-13-01', '2026-11-31', '2026-11-30'].map(A.isDay) }; }, { days, mds });
      const today = civil(inst, tz); const chk = (ok, what) => { n++; if (!ok) { bad++; if (show.length < 25) show.push(`${tz} ${lt}: ${what}`); } };
      chk(r.today === today, `todayISO ${r.today} vs ${today}`);
      days.forEach((d, i) => { chk(r.age[i] === Math.max(0, dn(today) - dn(d)), `ageDays(${d})=${r.age[i]}`);
        const wd = new Date(dn(d) * 864e5).getUTCDay(); const mon = ds(dn(d) + (wd === 6 ? 2 : wd === 0 ? 1 : 1 - wd)); chk(r.week[i] === mon, `weekOf(${d})=${r.week[i]} vs ${mon}`);
        const e = days[(i + 1) % days.length]; chk(r.btw[i] === dn(e) - dn(d), `daysBetween(${d},${e})=${r.btw[i]}`);
        let q = 4; for (let k = 0; k < 4; k++) if (d <= ENDS[k]) { q = k + 1; break; } chk(r.q[i] === q, `quarterOf(${d})=${r.q[i]}`);
        chk(r.ldo[i] === civil(r.now - i * 3600e3 * 7, tz), `localDayOf -${i * 7}h`);
        if (i < 40) { const wdn = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(new Date(dn(d) * 864e5)); chk(r.td[i].startsWith(wdn), `testDays(${d})=${r.td[i]}`); } });
      mds.forEach((m, i) => { const x = m.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/); let o = null;
        if (x) { const mo = +x[1], d = +x[2]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) { const y = x[3] ? (x[3].length === 2 ? 2000 + +x[3] : +x[3]) : (mo >= 7 ? 2026 : 2027); o = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; } }
        chk(r.md[i] === o, `mdToISO(${m})=${r.md[i]} vs ${o}`); });
      let cq = 1; const qd = today > ENDS[0] ? 1 : null; chk(r.qd === qd, `quarterDue ${r.qd} vs ${qd}`);
      chk(JSON.stringify(r.isday) === '[false,true,false,false,true]', 'isDay ' + r.isday);
    }
    await ctx.close();
  }
  await B.close();
  console.log(`checked ${n}; disagreements ${bad}`); show.forEach(s => console.log('  ' + s));
  console.log('OBSERVED:', bad, 'disagreements'); console.log('EXPECTED: 0');
  check(bad === 0, 'date functions agree with the oracle'); done();
})().catch(e => { console.error(e); process.exit(2); });
