/* A stand-in for mrshaffer.org's two public Tests routes, for Tally's suites (16 Nov 2026). Like the real site it locks each
   record to the Tally key pasted into its cockpit and signs it with its own key (vendor/seal.js); the records are the
   synthetic ones of tests/exam/fixtures.js. Both routes answer with CORS *, as DESIGN.md pins them:
     GET /api/test/key            → {key, made}
     GET /api/test/result/<code>  → {code, record} (404 {error} for a code it has no record of)
   And, for the suites only (the cockpit's side, no password here):
     POST /__ctl/tally {pub}      the key pasted into the cockpit: makes a trial (seal.newTrial) → {code, words}
     POST /__ctl/rotate           the site's key made again (records from now on are signed with the new one)
     POST /__ctl/down {down}      every route fails (a network that is gone)
     GET  /__ctl/results          the cockpit's results file for the day ({site: {key}, results: […]})
     GET  /__ctl/log              every request it was sent: method, path, headers (to prove what Tally sends)
   const S = await require('./site.js').start({port}); S.port; S.close(); S.state */
'use strict';
const http = require('http'), path = require('path');
const SEAL = require(path.join(__dirname, '..', '..', 'vendor', 'seal.js'));
const F = require('./fixtures.js');

async function start(o) {
  o = o || {};
  const b = F.build(), keys = await F.makeKeys();
  const st = { tallyPub: null, siteNow: keys.site, made: Date.now(), down: false, locked: {}, trial: null, log: [], b, keys };
  // the record signed "before the key was made again" is signed with keys.old: the site starts on keys.old and moves to
  // keys.site at /rotate, as a real site's key made again would. Until then everything else is signed with the site key too.
  st.siteNow = keys.old; st.siteKeyFor = x => x.by === 'forger' ? keys.forger : x.by === 'old' ? keys.old : st.siteNow;
  async function lockFor(x) {
    if (!st.tallyPub) return null; const k = x.code + '|' + st.tallyPub + '|' + st.siteKeyFor(x).pub;
    if (!st.locked[k]) st.locked[k] = await SEAL.seal(x.record, st.siteKeyFor(x).priv, x.to === 'other' ? keys.other.pub : st.tallyPub);
    return st.locked[k];
  }
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'); st.log.push({ method: req.method, path: u.pathname, headers: req.headers });
    const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    let raw = ''; for await (const c of req) raw += c; let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch (e) {}
    try {
      if (u.pathname.startsWith('/__ctl/')) {
        if (u.pathname === '/__ctl/tally') { st.tallyPub = body.pub; const code = SEAL.newCode(); const tr = SEAL.newTrial(code, Date.now()); st.trial = { code, record: tr, locked: await SEAL.seal(tr, st.siteNow.priv, st.tallyPub) }; st.locked = {};
          return send(200, { code, words: await SEAL.words(tr.nonce, st.siteNow.pub, st.tallyPub) }); }
        if (u.pathname === '/__ctl/rotate') { st.siteNow = keys.site; st.made = Date.now(); return send(200, { key: st.siteNow.pub }); }
        if (u.pathname === '/__ctl/down') { st.down = !!body.down; return send(200, { down: st.down }); }
        if (u.pathname === '/__ctl/results') { const locked = {}; for (const x of b.recs) locked[x.code] = await lockFor(x); const f = F.resultsFile(b, locked, keys); f.site.key = st.siteNow.pub; return send(200, f); }
        if (u.pathname === '/__ctl/log') return send(200, st.log.map(l => ({ method: l.method, path: l.path, headers: l.headers })));
        return send(404, { error: 'ctl' });
      }
      if (st.down) { req.socket.destroy(); return; }
      if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' }); return res.end(); }
      if (req.method !== 'GET') return send(405, { error: 'method' });
      if (u.pathname === '/api/test/key') return send(200, { key: st.siteNow.pub, made: st.made });
      const m = /^\/api\/test\/result\/([0-9A-Z]{12})$/.exec(u.pathname);
      if (m) {
        if (st.trial && m[1] === st.trial.code) return send(200, { code: m[1], record: st.trial.locked });
        const x = b.recs.find(r => r.code === m[1]); if (!x || !st.tallyPub) return send(404, { error: 'none' });
        return send(200, { code: x.code, record: await lockFor(x) });
      }
      return send(404, { error: 'no route' });
    } catch (e) { return send(500, { error: String(e.message || e) }); }
  });
  const port = await new Promise(r => server.listen(o.port || 0, '127.0.0.1', () => r(server.address().port)));
  return { port, url: 'http://127.0.0.1:' + port, state: st, close: () => new Promise(r => server.close(r)), b, keys };
}
module.exports = { start };
