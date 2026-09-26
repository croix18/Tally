#!/usr/bin/env node
// Runs every suite in this folder against a fresh test build of Tally.html / Scrub.html.
//   node tests/run.js            all suites
//   node tests/run.js grid scrub  only those
// The test build keeps the window.__tally handle the suites poke; `python3 build.py`
// (no flag) rebuilds the shipped files without it afterwards.
const { spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const root = path.resolve(__dirname, '..'); process.chdir(root);
const only = process.argv.slice(2);
const suites = fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && !['run.js', 'lib.js'].includes(f)).sort()
  .filter(f => !only.length || only.some(o => f.startsWith(o)));
if (!suites.length) { console.error('no suites match', only.join(' ')); process.exit(2); }

const build = spawnSync('python3', ['build.py', '--test'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status);

const rows = []; let failed = 0;
for (const f of suites) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 180000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const pass = (out.match(/^PASS /gm) || []).length, fail = (out.match(/^FAIL /gm) || []).length;
  const skipped = /^SKIP /m.test(out), crashed = r.status !== 0 && !fail;
  const status = skipped ? 'skip' : (r.status === 0 && !fail) ? 'ok' : 'FAIL';
  if (status === 'FAIL') failed++;
  rows.push({ f, status, pass, fail, ms: Date.now() - t0 });
  console.log(`${status.padEnd(4)} ${f.padEnd(30)} ${String(pass).padStart(3)} pass ${String(fail).padStart(2)} fail  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (status === 'FAIL') console.log(out.split('\n').filter(l => /^FAIL |Error|error/.test(l) || crashed).join('\n').slice(0, 4000));
  else if (skipped) console.log('     ' + out.match(/^SKIP .*/m)[0]);
}
const tp = rows.reduce((a, r) => a + r.pass, 0), tf = rows.reduce((a, r) => a + r.fail, 0);
console.log(`\n${rows.length} suites · ${tp} passed · ${tf} failed · ${rows.filter(r => r.status === 'skip').length} skipped`);

// Leave the shipped build in place, not the test build.
spawnSync('python3', ['build.py'], { stdio: 'ignore' });
process.exit(failed ? 1 : 0);
