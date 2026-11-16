// TIM-02: a quarter end typed with the keyboard and then the dialog closed with Escape (or the x): is it kept, or lost silently?
const path = require('path'); const repo = path.resolve(process.env.TALLY_REPO || '.'); process.chdir(repo);
const { chromium, fs, exe, pick, check, done, APP } = require(path.join(repo, 'tests/lib'));
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'America/New_York', locale: 'en-US' }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept()); await p.goto('file://' + path.resolve(APP));
  await p.setInputFiles('#file', [path.resolve('fixtures', fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed')))]); await p.waitForTimeout(500);
  const out = {};
  for (const how of ['Escape', 'x', 'Tab then Escape']) {
    await p.evaluate(() => { window.__tally.state.quarters.ends = ['2026-10-09', '2026-12-18', '2027-03-04', '2027-05-28']; window.__all.openQuarters({ dates: true }); });
    await p.waitForTimeout(200); await p.click('[data-qend="2"]'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
    await p.keyboard.type('03052027'); await p.waitForTimeout(100);
    const typed = await p.evaluate(() => document.querySelector('[data-qend="2"]').value);
    if (how === 'Escape') await p.keyboard.press('Escape'); else if (how === 'x') await p.click('#mClose'); else { await p.keyboard.press('Tab'); await p.waitForTimeout(100); await p.keyboard.press('Escape'); }
    await p.waitForTimeout(200);
    out[how] = { typed, kept: await p.evaluate(() => window.__tally.state.quarters.ends[2]), open: await p.evaluate(() => !document.querySelector('#modal').classList.contains('hidden')) };
    if (out[how].open) await p.evaluate(() => window.__all.render && document.querySelector('#modal').classList.add('hidden'));
  }
  console.log(JSON.stringify(out));
  for (const k of Object.keys(out)) check(out[k].typed !== '2027-03-05' || out[k].kept === '2027-03-05', `${k}: the typed Quarter 3 end is kept (typed ${out[k].typed}, kept ${out[k].kept})`);
  check(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
