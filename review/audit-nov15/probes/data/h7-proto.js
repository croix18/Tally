// Exploration harness: own "__proto__" / "constructor" keys planted in every keyed object of a Full save's text.
const D = require('./dat-lib.js');
(async () => {
  const { b, p, errs } = await D.open(); await D.loadClass(p); await D.populate(p);
  const r = await p.evaluate(async K => { const A = window.__all, T = window.__tally; const good = T.stateForSave(); const txt0 = JSON.stringify({ tally: 4, full: { saved: '2026-11-15T12:00:00.000Z', classes: 1 }, state: good });
    // add "__proto__":{"polluted":1,"x":true} and "constructor":{"prototype":{"polluted":1}} to every object in the text
    const txt = txt0.replace(/\{"/g, '{"__proto__":{"polluted":1,"Unit 1":true},"constructor":{"prototype":{"polluted":1}},"');
    const cfg = JSON.parse(txt); let err = ''; try { await A.loadTallyFile({ name: 'x.json' }, cfg); T.render(); } catch (e) { err = String(e.message).slice(0, 120); }
    const odd = []; const seen = new Set(); const walk = (o, p, d) => { if (!o || typeof o !== 'object' || seen.has(o) || d > 9) return; seen.add(o); const pr = Object.getPrototypeOf(o); if (pr !== Object.prototype && pr !== Array.prototype && pr !== null) odd.push(p + ' proto'); for (const k of Object.keys(o)) { if (k === '__proto__' || k === 'constructor') odd.push(p + '.' + k); walk(o[k], p + '.' + k, d + 1); } }; walk(A.state, 'state', 0);
    const saved = JSON.stringify(T.stateForSave()); return { err, polluted: ({}).polluted, odd: odd.length, oddSample: [...new Set(odd.map(x => x.replace(/\.\d+/g, '.N').replace(/1205050-7T1A/g, 'K')))].slice(0, 25), savedHas: (saved.match(/__proto__/g) || []).length, ok: A.state.order.length };
  }, D.K);
  console.log(JSON.stringify(r, null, 1)); console.log('errors', errs.join(' | ').slice(0, 400)); await b.close();
})().catch(e => { console.error(e); process.exit(2); });
