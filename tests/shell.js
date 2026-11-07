// The shell (Croix, 7 Nov 2026: "Moving from menu to menu is clunky ... It's difficult to tell sometimes how to navigate
// or find something"; Direction A of the navigation canvas, phase 1): one spine, Tally → a class → a tab.
//   the rail: All classes, every class under its course with its to-fix count, Board / Settings / Guide / Full save
//   every class: Grid · Grades · Students · Seating · Reports; All classes: Overview · Students · Reports
//   a student opens under the class's Students tab; a unit under Grid; the rail and the tabs always say where you are
//   the old places are gone: no top tabs, no pill row, no Grades or Seating buttons on the bar, no Class menu on Students
//   a short window scrolls as one page; a phone gets the classes as a strip under the header
// Synthetic: the scrubbed fixture and copies of it.
const { chromium, fs, path, exe, check, done, pick, more, tmp, APP } = require('./lib');
let B = null;
(async () => {
  const b = B = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  check(await p.locator('#rail.hidden').count() === 1 && await p.locator('body.has').count() === 0 && await p.locator('#top .brand').isVisible(), 'before the first import: no rail, the wordmark in the header');
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  // a second accelerated class and an on-level one, copies of the first
  await p.evaluate(() => { const T = window.__tally; const base = T.state.sections['1205050-7T1A']; base.period = 1; base.label = '1st Period · Accelerated'; base.team = '1st Period';
    const mk = (per, prep) => { const s = JSON.parse(JSON.stringify(base)); s.key = 'p' + per; s.period = per; s.prep = prep; s.label = per + (per === 2 ? 'nd' : 'th') + ' Period · ' + (prep === 'acc' ? 'Accelerated' : 'On-level'); s.team = s.label.replace(/ · .*/, ''); T.state.sections[s.key] = s; T.state.order.push(s.key); };
    mk(2, 'acc'); mk(5, 'on'); T.save(); });
  await p.reload(); await p.waitForTimeout(800);
  const rail = () => p.evaluate(() => [...document.querySelectorAll('#rail .sec, #rail button')].filter(e => !e.closest('.foot')).map(e => e.classList.contains('sec') ? '[' + e.textContent.trim() + ']' : (e.querySelector('.lbl') || e).textContent.trim() + ((e.querySelector('.n') || {}).textContent ? '(' + e.querySelector('.n').textContent + ')' : '') + (e.classList.contains('on') ? '*' : '')).join(' '));
  const tabs = () => p.evaluate(() => [...document.querySelectorAll('#ctabs button')].map(x => x.firstChild.textContent.trim() + (x.getAttribute('aria-selected') === 'true' ? '*' : '')).join(' '));
  const where = () => p.evaluate(() => ({ h2: document.querySelector('#chead h2').textContent.trim(), rail: (document.querySelector('#rail button.on .lbl') || {}).textContent, tab: (document.querySelector('#ctabs [aria-selected="true"]') || { firstChild: { textContent: '' } }).firstChild.textContent.trim(), mode: window.__tally.view.mode }));
  const warns = await p.evaluate(() => { const T = window.__tally; const o = {}; T.state.order.forEach(k => { o[k] = T.attentionItems(T.state.sections[k]).filter(i => i.level === 'warn').length; }); return o; });
  const sumW = Object.values(warns).reduce((a, b) => a + b, 0);
  // ---- the rail ----------------------------------------------------------------------------------------------------
  check(await p.locator('body.has').count() === 1 && await p.locator('#rail:not(.hidden)').count() === 1 && !(await p.locator('#top .brand').isVisible()) && await p.locator('#rail .brand').isVisible(), 'after the import: the rail, with the wordmark; the header keeps search, the names switch, the menu and Import');
  check(await rail() === `All classes(${sumW})* [Accelerated] 1st Period(${warns['1205050-7T1A']}) 2nd Period(${warns.p2}) [On-level] 5th Period(${warns.p5})`, 'All classes first, then every class under its course, each with how many things to fix: ' + await rail());
  check(await p.$$eval('#rail .foot button', bs => bs.map(x => [...x.childNodes].filter(n => n.nodeType === 3 || n.classList).map(n => n.textContent.trim()).filter(Boolean).join(' ')).join(' | ')) === 'Board | Settings | Guide | Full save never', 'at the foot: Board, Settings, Guide, Full save and when it last was');
  check(await p.locator('#nav, #tabs, .tab, #btnStudents:not(#ctabs button), #stuClass').count() === 0, 'the old places are gone: no top tabs, no pill row, no Class menu');
  // ---- All classes --------------------------------------------------------------------------------------------------
  { const w = await where(); check(w.h2 === 'All classes' && w.rail === 'All classes' && w.tab === 'Overview' && w.mode === 'home' && await tabs() === 'Overview* Students Reports', 'the Overview is All classes › Overview'); }
  await p.click('#btnStudents'); await p.waitForTimeout(400);
  { const w = await where(); const n = await p.locator('.sdir tr[data-open]').count(); const groups = await p.$$eval('.sdir tr.sgroup th', e => e.map(x => x.textContent.trim()));
    check(w.tab === 'Students' && w.rail === 'All classes' && n === 69 && groups.join('|') === '1st Period|2nd Period|5th Period', 'All classes › Students: every student of every class, by class (' + n + ')'); }
  await p.click('#openReports'); await p.waitForTimeout(400);
  check(/Print · /.test(await p.textContent('#modal')) && await p.locator('#modal .seg button[aria-pressed="true"]:has-text("All classes")').count() === 1, 'All classes › Reports opens printing for every class'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // ---- a class --------------------------------------------------------------------------------------------------
  await p.click('[data-k="p2"]'); await p.waitForTimeout(400);
  { const w = await where(); check(/^2nd Period/.test(w.h2) && w.rail === '2nd Period' && w.tab === 'Grid' && await tabs() === 'Grid* Grades Students Seating Reports' && await p.locator('table.grid').count() === 1, 'a class opens on its Grid, lit on the rail: ' + await tabs()); }
  check(await p.locator('#ctabs #openGrid small').textContent() === String(warns.p2) && await p.locator('#bar #openGrades, #bar #openSeating, #bar h2').count() === 0, 'the Grid tab carries the to-fix count; the bar no longer holds the class name or Grades and Seating buttons');
  await p.click('#openGrades'); await p.waitForTimeout(400);
  { const w = await where(); check(w.tab === 'Grades' && w.rail === '2nd Period' && w.mode === 'grades' && await p.locator('#gridwrap .grades').count() === 1 && await p.locator('#bar #back').count() === 0 && await p.locator('#gradesWeights').count() === 1, 'Grades: a tab, its own controls on the tab row, no back link'); }
  await p.click('#openSeating'); await p.waitForTimeout(400);
  { const w = await where(); check(w.tab === 'Seating' && w.mode === 'seating' && await p.locator('#seatSub').count() === 1 && await p.locator('#bar #back').count() === 0, 'Seating: a tab'); }
  await p.click('#openStudents'); await p.waitForTimeout(400);
  { const w = await where(); const n = await p.locator('.sdir tr[data-open]').count(); const cls = await p.locator('.sdir th:has-text("Class")').count();
    check(w.tab === 'Students' && w.rail === '2nd Period' && n === 23 && cls === 0 && await p.locator('#bar [data-sort="class"]').count() === 0 && await p.locator('#bar [data-sort="name"][aria-pressed="true"]').count() === 1, 'Students: this class\'s 23, A–Z, no Class column and no By class'); }
  await p.locator('.sdir tr[data-open]').first().click(); await p.waitForTimeout(400);
  { const w = await where(); check(w.mode === 'student' && w.tab === 'Students' && w.rail === '2nd Period' && /^2nd Period/.test(w.h2) && /^‹ Students/.test(await p.textContent('#back')) && await p.locator('#bar.own').count() === 1, 'a student opens under the class\'s Students tab, with the way back to the list on a bar of its own'); }
  await p.click('#pNext'); await p.waitForTimeout(300); check((await where()).mode === 'student' && (await where()).rail === '2nd Period', 'Next stays in the class');
  await p.click('#openGrid'); await p.waitForTimeout(400); await p.click('th.unit .ulink'); await p.waitForTimeout(400);
  { const w = await where(); check(w.mode === 'unit' && w.tab === 'Grid' && (await p.textContent('#back')).trim() === '‹ Grid' && await p.locator('#bar.own').count() === 1, 'a unit opens under Grid, with "‹ Grid" the way back'); }
  await p.click('#back'); await p.waitForTimeout(300); check((await where()).mode === 'units', '…and goes back to it');
  // a name on the grid opens the student under Students
  await p.locator('table.grid [data-prof]').first().click(); await p.waitForTimeout(400);
  { const w = await where(); check(w.mode === 'student' && w.tab === 'Students' && w.rail === '2nd Period' && /^‹ 2nd Period/.test(await p.textContent('#back')), 'a name on the grid opens the student under Students, with the way back to the grid'); }
  await p.click('#back'); await p.waitForTimeout(300); check((await where()).mode === 'units' && (await where()).tab === 'Grid', '…which goes back to the grid');
  // the Reports tab, for this class
  await p.click('#openReports'); await p.waitForTimeout(400);
  check(/Print · 2nd Period/.test(await p.textContent('#modal')) && await p.locator('#modal .seg button[aria-pressed="true"]:has-text("2nd Period")').count() === 1, 'Reports opens printing for this class'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // switching class keeps the Grid; All classes › Students then a class's Students are two lists
  await p.click('[data-k="p5"]'); await p.waitForTimeout(400);
  { const w = await where(); check(w.rail === '5th Period' && w.tab === 'Grid' && /^5th Period/.test(w.h2) && /On-level/.test(await p.textContent('#chead .meta')), 'another class on the rail opens its Grid'); }
  await p.click('#openStudents'); await p.waitForTimeout(400); await p.click('#btnHome'); await p.waitForTimeout(300); await p.click('#btnStudents'); await p.waitForTimeout(400);
  check(await p.locator('.sdir tr[data-open]').count() === 69 && (await where()).rail === 'All classes', 'All classes › Students is every class again after a class\'s Students');
  // the rail's foot
  await p.click('#railSettings'); await p.waitForTimeout(400); check(await p.locator('#modal:not(.hidden) #stabs').count() === 1, 'Settings opens from the rail'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  { const [gd] = await Promise.all([ctx.waitForEvent('page'), p.click('#railGuide')]); await gd.waitForLoadState(); check(/Full save/.test(await gd.evaluate(() => document.body.textContent)), 'the Guide opens from the rail'); await gd.close(); }
  await p.click('#btnLb'); await p.waitForTimeout(500); check(await p.locator('#lb:not(.hidden)').count() === 1, 'the Board opens from the rail');
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1900);
  // keyboard: the rail's buttons are real buttons with a visible ring
  await p.keyboard.press('Tab'); const ring = await p.evaluate(() => { const b = document.querySelector('#rail .rc'); b.focus(); const cs = getComputedStyle(b); return { style: cs.outlineStyle, color: cs.outlineColor }; });
  check(ring.style === 'solid' && /45, 212, 191/.test(ring.color), 'a focused rail item shows the turquoise ring on the navy rail');
  // a short window scrolls as one page: the grid is never squeezed to nothing under the bar and the notices
  await p.evaluate(() => { const T = window.__tally; T.state.settings.details = true; T.save(); }); await p.click('[data-k="1205050-7T1A"]'); await p.waitForTimeout(300);
  await p.setViewportSize({ width: 911, height: 512 }); await p.waitForTimeout(400);
  { const m = await p.evaluate(() => ({ gw: document.querySelector('#gridwrap').getBoundingClientRect().height, doc: document.documentElement.scrollHeight, win: innerHeight })); check(m.gw >= 250 && m.doc > m.win, 'at 911×512 with Details on, the grid keeps ' + Math.round(m.gw) + ' px and the page scrolls'); }
  await p.evaluate(() => { const T = window.__tally; T.state.settings.details = false; T.save(); }); await p.setViewportSize({ width: 1366, height: 768 }); await p.waitForTimeout(300);
  // the rail narrows on a tablet; a phone gets the classes as a strip under the header
  await p.setViewportSize({ width: 1024, height: 768 }); await p.waitForTimeout(300);
  check(await p.evaluate(() => document.querySelector('#rail').getBoundingClientRect().width) <= 200, 'a tablet: a narrower rail');
  const raw = await p.evaluate(() => localStorage.getItem('tally.v1'));
  const ph = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const q = await ph.newPage(); q.on('pageerror', e => errs.push('phone: ' + e.message));
  await q.goto('file://' + path.resolve(APP)); await q.evaluate(s => localStorage.setItem('tally.v1', s), raw); await q.reload(); await q.waitForTimeout(900);
  await q.click('[data-k="p2"]'); await q.waitForTimeout(500);
  { const m = await q.evaluate(() => { const r = document.querySelector('#rail').getBoundingClientRect(), t = document.querySelector('#top').getBoundingClientRect(); return { under: r.top >= t.bottom - 1, wide: document.documentElement.scrollWidth <= innerWidth + 1, tabs: document.querySelector('#ctabs').scrollWidth > document.querySelector('#ctabs').clientWidth, brand: getComputedStyle(document.querySelector('#top .brand')).display !== 'none', on: (document.querySelector('#rail button.on .lbl') || {}).textContent }; });
    check(m.under && m.wide && m.brand && m.on === '2nd Period', 'a phone: the classes are a strip under the header, the wordmark back in the header, nothing wider than the screen'); }
  await ph.close();
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); done();
})().catch(async e => { console.log('FAIL crashed: ' + (e && e.stack || e)); try { if (B) await B.close(); } catch (x) {} process.exitCode = 1; });
