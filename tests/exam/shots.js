/* Screenshots of every Tests screen for a person to look at (not a suite): node tests/exam/shots.js <out dir>
   Opens the shipped Tally.html from file://, loads the Full save the e2e suite leaves in $FULL (or makes its own state
   through the stand-in), and shoots the class, a test whole, Connect and the dialogs at 1366×768 and 1920×1080, each also
   as one tall page. */
const { chromium, fs, path, exe, pick } = require('../lib');
const SITE = require('./site.js'); const http = require('http');
const OUT = path.resolve(process.argv[2] || '/home/claude/shots/tally-tests'); fs.mkdirSync(OUT, { recursive: true });
const FX = n => path.resolve('fixtures', 'exams', n);
const post = (site, p, body) => new Promise(res => { const r = http.request(site.url + p, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, x => { let t = ''; x.on('data', c => t += c); x.on('end', () => res(JSON.parse(t))); }); r.end(JSON.stringify(body || {})); });
(async () => {
  const site = await SITE.start(); const b = await chromium.launch({ executablePath: exe });
  const open = async (w, h) => { const ctx = await b.newContext({ viewport: { width: w, height: h }, acceptDownloads: true });
    await ctx.route('https://mrshaffer.org/**', async route => { const u = new URL(route.request().url()); const r = await new Promise(res => http.get(site.url + u.pathname, x => { let t = ''; x.on('data', c => t += c); x.on('end', () => res({ status: x.statusCode, headers: x.headers, body: t })); })); route.fulfill(r); });
    const p = await ctx.newPage(); p.on('dialog', d => d.accept()); p.on('pageerror', e => console.log('PAGEERROR', e.message)); await p.goto('file://' + path.resolve('Tally.html')); await p.waitForTimeout(300); return { ctx, p }; };
  // build a state once
  const { ctx, p } = await open(1366, 768);
  await p.setInputFiles('#file', fs.readdirSync(FX('')).filter(f => /^IXL/.test(f)).map(FX)); await p.waitForTimeout(800);
  for (const f of ['focus_gradebook_p4.csv', 'focus_gradebook_p5.csv']) { await p.setInputFiles('#file', [FX(f)]); await p.waitForTimeout(700); await pick(p); await p.waitForTimeout(300); const a = await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(200); } }
  try { await p.click('#rail .rc:has-text("4th")', { timeout: 8000 }); } catch (e) { await p.screenshot({ path: '/tmp/xshots-fail.png' }); throw e; } await p.click('#openTests'); await p.waitForTimeout(300);
  await p.click('#xtMake'); await p.waitForSelector('#xtKey'); const pub = (await p.textContent('#xtKey')).trim(); const tr = await post(site, '/__ctl/tally', { pub });
  await p.fill('#xtTrialIn', tr.code); await p.click('#xtTrialGo'); await p.waitForSelector('.xtWords');
  await p.screenshot({ path: path.join(OUT, 'r01-trial-1366.png') });
  await p.click('#xtLater').catch(() => {}); await p.click('#xtDone'); await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(OUT, 'r02-empty-1366.png') });
  await p.click('#xtPaste'); await p.fill('#xtSheet', fs.readFileSync(FX('responses.tsv'), 'utf8')); await p.waitForTimeout(100); await p.screenshot({ path: path.join(OUT, 'r03-paste-1366.png') });
  await p.click('#xtTake'); for (let i = 0; i < 80; i++) { await p.waitForTimeout(250); if (!(await p.$('#xtProg:not(.hidden) .xtSpin'))) break; }
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btnFullSave')]); const full = path.join(OUT, '..', 'tests-state.json'); await dl.saveAs(full); await ctx.close();
  for (const [w, h] of [[1366, 768], [1920, 1080]]) {
    for (const tall of [false, true]) {
      const o = await open(w, tall ? 2600 : h); const q = o.p; await q.setInputFiles('#file', [full]); await q.waitForTimeout(800);
      if (await q.evaluate(() => document.querySelector('#btnHide').getAttribute('aria-pressed') === 'false')) await q.click('#btnHide');
      await q.click('#rail .rc:has-text("4th")'); await q.click('#openTests'); await q.waitForTimeout(400);
      { const t2 = await post(site, '/__ctl/tally', { pub }); await q.click('#xtConnBtn'); await q.waitForTimeout(200); await q.fill('#xtTrialIn', t2.code); await q.click('#xtTrialGo'); await q.waitForTimeout(1500); await q.click('#xtDone'); await q.waitForTimeout(800); }
      const tag = `${w}${tall ? '-tall' : ''}`; await q.screenshot({ path: path.join(OUT, `r10-class-${tag}.png`) });
      for (let i = 0; i < 60 && /Checking/.test(await q.evaluate(() => (document.querySelector('#xtProg') || {}).textContent || '')); i++) await q.waitForTimeout(250);
      await q.screenshot({ path: path.join(OUT, `r10-class-${tag}.png`) });
      if (!tall && w === 1366) { await q.click('#rail .rc:has-text("5th")'); await q.click('#openTests'); await q.waitForTimeout(600); await q.screenshot({ path: path.join(OUT, 'r13-two-groups-5th-1366.png') }); await q.click('#rail .rc:has-text("4th")'); await q.click('#openTests'); await q.waitForTimeout(400); }
      await q.evaluate(() => { const r = [...document.querySelectorAll('.xtList tbody tr[data-xcode]')].find(x => /O'NEIL/i.test(x.textContent)); r.click(); }); await q.waitForTimeout(800);
      await q.screenshot({ path: path.join(OUT, `r11-detail-${tag}.png`) });
      if (tall) { await q.evaluate(() => document.querySelector('#gridwrap').scrollTo(0, 1e5)); await q.waitForTimeout(150); await q.screenshot({ path: path.join(OUT, `r12-detail-bottom-${tag}.png`) }); }
      await o.ctx.close();
    }
  }
  await b.close(); await site.close(); console.log('shots in', OUT);
})().catch(e => { console.error(e); process.exit(1); });
