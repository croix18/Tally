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
module.exports = { chromium, fs, path, exe, check, done, tmp, need };
