// The shipped pages are the build of the sources beside them (third review, R3-L3). The site hands out main's Tally.html as
// it is, so the committed Tally.html (and index.html, its copy for GitHub Pages, and Scrub.html) must be exactly what
// build.py makes from the committed sources: `python3 build.py --check` builds in memory and compares, writing nothing.
const { check, done } = require('./lib'); const { spawnSync } = require('child_process'); const fs = require('fs'); const crypto = require('crypto');
const r = spawnSync('python3', ['build.py', '--check'], { encoding: 'utf8' });
const sha = crypto.createHash('sha256').update(fs.readFileSync('Tally.html')).digest('hex');
console.log('Tally.html SHA-256 ' + sha);
check(r.status === 0, 'Tally.html, index.html and Scrub.html are exactly the build of the sources here: ' + (r.stdout + r.stderr).trim().replace(/\n/g, ' · '));
const g = spawnSync('git', ['status', '--porcelain', '--', 'Tally.html', 'index.html', 'Scrub.html'], { encoding: 'utf8' });
if (g.status === 0) check(!g.stdout.trim() || process.env.ALLOW_DIRTY, 'and they are the committed files (no uncommitted change to a shipped page)' + (g.stdout.trim() ? ': ' + g.stdout.trim() : ''));
// The shipped page never lets an account place a row by itself (coordinator, 17 Nov 2026, after the third accounts review):
// the switch is off, set once, and the only way to turn it on (the test build's window.__tally.accountPlaces) is not in it.
{ const h = fs.readFileSync('Tally.html', 'utf8'); const on = (h.match(/ACCOUNT_PLACES\s*=\s*(?!=)[^;]*/g) || []);
  check(on.length === 1 && /^ACCOUNT_PLACES = false$/.test(on[0]) && h.includes('let ACCOUNT_PLACES = false;') && !/accountPlaces/.test(h) && fs.readFileSync('index.html', 'utf8') === h,
    'the shipped page has ACCOUNT_PLACES off (an account never places a row by itself), set once, with no way to turn it on: ' + JSON.stringify(on)); }
done();
