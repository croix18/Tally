// --require hook: run a suite with the clock shifted (SHIFT_TO=ISO) and/or the browser zone set (SHIFT_TZ=Area/City).
const Module = require('module'); const orig = Module.prototype.require;
const to = process.env.SHIFT_TO ? Date.parse(process.env.SHIFT_TO) : null; const off = to ? to - Date.now() : 0;
if (off) { const D = Date; class FD extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + off); } static now() { return D.now() + off; } } global.Date = FD; }
const initJS = off ? `(() => { const off = ${off}; const D = Date; class FD extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + off); } static now() { return D.now() + off; } } FD.parse = D.parse; FD.UTC = D.UTC; window.Date = FD; })();` : null;
let patched = false;
Module.prototype.require = function (id) { const m = orig.apply(this, arguments);
  if (id === 'playwright' && !patched) { patched = true; const L = m.chromium.launch.bind(m.chromium);
    m.chromium.launch = async (o) => { const b = await L(o); const NC = b.newContext.bind(b);
      b.newContext = async (co = {}) => { const c = await NC({ ...co, ...(process.env.SHIFT_TZ ? { timezoneId: process.env.SHIFT_TZ } : {}) }); if (initJS) await c.addInitScript(initJS); return c; };
      const NP = b.newPage.bind(b); b.newPage = async (po) => { const c = await b.newContext(po || {}); return c.newPage(); }; return b; }; }
  return m; };
