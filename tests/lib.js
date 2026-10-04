// Shared preamble for every suite: browser path, check(), done(), and a cwd of the repo root
// so 'Tally.html' and 'fixtures/…' resolve the same whether a suite is run alone or via run.js.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const os = require('os');
process.chdir(path.resolve(__dirname, '..'));
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium'
  : require('child_process').execSync('ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome 2>/dev/null | head -1').toString().trim() || undefined;
let fails = 0, passes = 0;
const check = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (c) passes++; else fails++; };
const done = () => { console.log(fails ? `\n${fails} FAILED (${passes} passed)` : `\nALL PASS (${passes})`); process.exitCode = fails ? 1 : 0; };
// Scratch directory for files a suite writes (scrub output, screenshots) — never inside fixtures/.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tally-test-'));
// A suite that needs a fixture the repo doesn't ship (scrubbed real exports) calls this first.
const need = (...files) => { const missing = files.filter(f => !fs.existsSync(path.join('fixtures', f))); if (missing.length) { console.log('SKIP missing fixtures: ' + missing.join(', ')); process.exitCode = 0; process.exit(); } };
// Suites written when every unit counted: turn off "first N units aren't assigned" right after the page loads.
const unskip = p => p.evaluate(() => { const T = window.__tally; T.state.settings.skipFirst = { acc: 0, on: 0 }; T.state.settings.details = true; T.save(); });   // also the dense (Details) view these suites were written against
const dense = p => p.evaluate(() => { const T = window.__tally; T.state.settings.details = true; T.save(); T.render(); });
// The suites drive the test build (keeps window.__tally); the shipped Tally.html / index.html are never touched by a test run.
const APP = 'Tally.test.html', SCRUB = 'Scrub.test.html';
// "Which class is this gradebook?" only opens when Tally can't place the file by its names — click the choice if it is asked.
// A file whose students are in no class opens "New class" instead; "It belongs to a class I already have" leads to the list.
const pick = async (p, sel = '[data-sec]') => { if (!/__new__/.test(sel)) { const e = await p.$('#ncExisting'); if (e) { await e.click(); await p.waitForTimeout(200); } } const d = await p.$(sel); if (d) await d.click(); return !!d; };
// Settings, Guide and Details view live in the header's ⋯ menu: open it, then choose.
const more = async (p, sel) => { await p.click('#btnMore'); await p.click(sel); };
module.exports = { chromium, fs, path, exe, check, done, tmp, need, unskip, dense, pick, more, APP, SCRUB };
