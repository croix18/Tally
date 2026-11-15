// DAT-05 (DECISION): "Forgot the PIN?" accepts any Full save of these classes as proof that the person is the teacher.
// Every Full save (Ctrl+S, the autosave, the save made before opening a file or removing a class) is downloaded by the
// browser to this same computer's Downloads folder, and the file picker on the hidden screen opens right there. So the
// person at the locked laptop removes the PIN with the newest file in Downloads, in two clicks.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/data/repo';
const { chromium, fs, exe, check, done, pick, APP, tmp } = require(path.join(REPO, 'tests/lib.js'));
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(600);
  // the teacher sets a PIN and makes a Full save as told ("Make a Full save now: it is your way back in")
  await p.evaluate(() => window.__tally.pinSet('4826'));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => window.__tally.saveFull())]);
  const inDownloads = path.join(tmp, dl.suggestedFilename()); await dl.saveAs(inDownloads);
  // he walks away; the screen hides. Someone else: Forgot the PIN? -> the newest tally-full-*.json in Downloads
  await p.evaluate(() => window.__tally.veil('now')); await p.waitForTimeout(200);
  await p.click('#veilForgot'); await p.setInputFiles('#veilFile', inDownloads); await p.waitForTimeout(500);
  const r = await p.evaluate(() => ({ veiled: document.body.classList.contains('veiled'), pinOn: window.__tally.pinOn() }));
  console.log('OBSERVED:', JSON.stringify({ file: path.basename(inDownloads), ...r }));
  console.log('EXPECTED:', 'a file Tally itself left in this computer\'s Downloads is not proof that the person at the keyboard is the teacher: the PIN stays (or recovery needs something only he has)');
  check(r.veiled && r.pinOn, 'the PIN is not removed by the Full save sitting in Downloads');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
