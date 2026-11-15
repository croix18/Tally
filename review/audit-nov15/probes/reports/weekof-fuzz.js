// weekOf over 2026-2029 in several time zones: always the Monday of the school week; Saturday/Sunday -> the next Monday.
const H = require('./h.js');
(async () => { let bad = [];
  for (const tz of ['America/New_York', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Europe/London']) {
    const { b, p } = await H.open({ tz });
    const r = await p.evaluate(() => { const A = window.__all; const out = []; let n = 0;
      for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2030, 0, 1); t += 864e5) { const d = new Date(t); const iso = d.toISOString().slice(0, 10); const [y, m, dd] = iso.split('-').map(Number);
        const wd = new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); const add = wd === 6 ? 2 : wd === 0 ? 1 : 1 - wd; const e = new Date(Date.UTC(y, m - 1, dd + add)).toISOString().slice(0, 10);
        const got = A.weekOf(iso); n++; if (got !== e) out.push(iso + '->' + got + ' exp ' + e);
        const got2 = A.weekOf(iso + 'T23:30:00.000Z'); if (got2 !== e) out.push('stamp ' + iso + '->' + got2); }
      return { n, out: out.slice(0, 5), nb: out.length }; });
    if (r.nb) bad.push(tz + ': ' + r.nb + ' ' + r.out.join('; ')); console.log(tz, r.n, r.nb); await b.close(); }
  console.log('OBSERVED:', bad.join(' | ') || 'all Mondays'); console.log('EXPECTED: all Mondays'); process.exitCode = bad.length ? 1 : 0; })();
