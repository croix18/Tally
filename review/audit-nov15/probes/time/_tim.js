// Shared helper for TIM probes: a page of the test build in a given time zone at a fixed clock.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/time/repo';
const L = require(path.join(REPO, 'tests/lib.js'));
async function openAt(tz, when, opts = {}) {
  const b = opts.browser || await L.chromium.launch({ executablePath: L.exe });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, timezoneId: tz, locale: 'en-US', acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  if (when) await p.clock.setFixedTime(new Date(when));
  await p.goto('file://' + path.resolve(L.APP)); await p.waitForTimeout(opts.wait || 400);
  return { b, ctx, p, errs };
}
// civil-date helpers (independent oracle): day strings <-> day numbers
const dn = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const ds = n => new Date(n * 864e5).toISOString().slice(0, 10);
const civil = (instant, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
// a Focus gradebook import, answering the class picker and the category check (Tally's guesses kept)
async function importGb(p, file) { await p.setInputFiles('#file', [file]); await p.waitForTimeout(500); await L.pick(p); await p.waitForTimeout(500);
  if (await p.$('#askApply')) { await p.click('#askApply'); await p.waitForTimeout(500); } }
module.exports = { importGb, ...L, REPO, openAt, dn, ds, civil };
