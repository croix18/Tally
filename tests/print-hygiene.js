// No code on paper or on screen (8 Nov 2026). A source comment that slipped inside a template string printed at the top
// of every weekly report's first page for a day ("// the title alone (Croix, 8 Nov 2026: …)"): the pager pages element
// children only, so stray text sits above page 1, and the line fit the page's slack, so no layout check saw it. Every
// print page and the main views are read as text for comment marks, template marks and words only code says, and every
// print section is checked for stray text outside its elements.
const { chromium, fs, path, exe, check, done, APP, pick } = require('./lib');
const K = '1205050-7T1A';
// "//" not after a colon (a link), "/*", "*/", "${", a word from the source, or what a missing value prints as
const BAD = String.raw`(^|[^:\\])\/\/|\/\*|\*\/|\$\{|\bCroix\b|\bundefined\b|\bNaN\b|\[object |\bnull\b`;
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  await p.setInputFiles('#file', [path.resolve('fixtures/fast_items_g8.pdf')]); await p.waitForTimeout(2500);
  await p.evaluate(() => { window.__tally.state.settings.teacherName = 'Mr. Shaffer'; window.__tally.save(); });
  // what a page says, line by line, that only code would say; and text sitting outside the page's elements
  const scan = pg => pg.evaluate(BAD => { const re = new RegExp(BAD); const lines = (document.body.innerText || '').split('\n').map(l => l.trim()).filter(Boolean);
    const loose = [document.body, ...document.querySelectorAll('body > section, body > section > .page')].flatMap(el => [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim().slice(0, 90)));
    return { n: lines.length, bad: lines.filter(l => re.test(l)).map(l => l.slice(0, 140)), loose }; }, BAD);
  const popup = async (go, paged) => { const [w] = await Promise.all([ctx.waitForEvent('page', { timeout: 20000 }), go()]); await w.waitForLoadState();
    if (paged) await w.waitForFunction(() => document.body.getAttribute('data-paged') === '1', null, { timeout: 30000 }); else await w.waitForTimeout(400);
    const r = await scan(w); await w.close(); return r; };
  const report = (what, r) => check(r.n > 0 && !r.bad.length && !r.loose.length, what + ': ' + r.n + ' lines, ' + (r.bad.length || r.loose.length ? 'code text' : 'no code text') + (r.bad.length ? ' · ' + JSON.stringify(r.bad.slice(0, 3)) : '') + (r.loose.length ? ' · loose text: ' + JSON.stringify(r.loose.slice(0, 3)) : ''));
  // 1. the weekly reports of the class with its checklist, and one report alone
  await p.click('#openReports'); await p.waitForTimeout(300);
  report('the weekly reports and the checklist', await popup(() => p.click('#rpWeekly'), true));
  report('one student\'s weekly report', await popup(() => p.evaluate(K => window.__tally.printStudentReports(window.__tally.state.sections[K], [0], 'One'), K), true));
  // 2. the FAST reports
  report('the FAST reports', await popup(() => p.click('#rpFast'), true));
  // 3. the still-owed lists: names, initials, slips
  for (const mode of [undefined, 'initials', 'slips']) report('the still-owed list (' + (mode || 'names') + ')', await popup(() => p.evaluate(({ K, mode }) => window.__tally.printStillOwed(window.__tally.state.sections[K], mode), { K, mode }), false));
  // 4. the guide
  report('the guide', await popup(() => p.evaluate(() => window.__tally.openGuide()), false));
  // 5. the conference form, from a student's page
  const nm = await p.evaluate(K => window.__tally.state.sections[K].grades.students[0], K);
  await p.evaluate(({ K, nm }) => window.__tally.openProfile(K, nm), { K, nm }); await p.waitForTimeout(400);
  report('a student\'s page on screen', await scan(p));
  await p.click('#pConf'); await p.waitForTimeout(400);
  report('the conference form on screen', await scan(p));
  report('the conference form printed', await popup(() => p.click('#cfPrint'), false));
  await p.click('#mClose'); await p.waitForTimeout(300);
  // 6. a seating chart: a room from a template, a chart generated and saved, both copies printed
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(400);
  await p.click('#seatSub [data-sub="room"]'); await p.waitForTimeout(300); await p.click('#rmTpl'); await p.waitForTimeout(300); await p.fill('#tplN', '24'); await p.click('[data-tpl="pairs"]'); await p.waitForTimeout(500);
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(400);
  await p.click('#seatGen'); await p.waitForFunction(() => document.querySelectorAll('.cand button').length > 0, null, { timeout: 30000 }); await p.waitForTimeout(300);
  await p.locator('.cand button').first().click(); await p.waitForTimeout(200); await p.click('#seatSave'); await p.waitForTimeout(400);
  report('the seating view on screen', await scan(p));
  for (const pm of ['teacher', 'safe']) report('the seating chart, ' + pm + ' copy', await popup(async () => { await p.click('#seatPrint'); await p.waitForTimeout(200); await p.click(`[data-pm="${pm}"]`); }, false));
  // 7. the class grid, the Reports page and Settings on screen
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(400);
  report('the class grid on screen', await scan(p));
  await p.click('#openReports'); await p.waitForTimeout(300); report('the Reports page on screen', await scan(p));
  await p.click('#btnSettings'); await p.waitForTimeout(300); report('Settings on screen', await scan(p));
  check(errs.length === 0, 'no errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); done();
})().catch(e => { console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
