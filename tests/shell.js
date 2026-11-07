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
  const sumW = await p.evaluate(() => { const T = window.__tally; return T.fixCount(T.state.order.map(k => T.state.sections[k])); });   // the Overview's count: one line per cause across classes, a quarter past its end
  // ---- the rail ----------------------------------------------------------------------------------------------------
  check(await p.locator('body.has').count() === 1 && await p.locator('#rail:not(.hidden)').count() === 1 && !(await p.locator('#top .brand').isVisible()) && await p.locator('#rail .brand').isVisible(), 'after the import: the rail, with the wordmark; the header keeps search, the names switch, the menu and Import');
  check(await rail() === `All classes(${sumW})* [Accelerated] 1st Period(${warns['1205050-7T1A']}) 2nd Period(${warns.p2}) [On-level] 5th Period(${warns.p5})`, 'All classes (with the Overview\'s count), then every class under its course with how many things to fix: ' + await rail());
  check(await p.$$eval('#rail .foot button', bs => bs.map(x => [...x.childNodes].filter(n => n.nodeType === 3 || n.classList).map(n => n.textContent.trim()).filter(Boolean).join(' ')).join(' | ')) === 'Board | Details view | Settings | Guide | Full save never', 'at the foot: Board, Details view, Settings, Guide, Full save and when it last was');
  check(await p.locator('#nav, #tabs, .tab, #btnStudents:not(#ctabs button), #stuClass').count() === 0, 'the old places are gone: no top tabs, no pill row, no Class menu');
  // ---- All classes --------------------------------------------------------------------------------------------------
  { const w = await where(); check(w.h2 === 'All classes' && w.rail === 'All classes' && w.tab === 'Overview' && w.mode === 'home' && await tabs() === 'Overview* Students Reports', 'the Overview is All classes › Overview'); }
  await p.click('#btnStudents'); await p.waitForTimeout(400);
  { const w = await where(); const n = await p.locator('.sdir tr[data-open]').count(); const groups = await p.$$eval('.sdir tr.sgroup th', e => e.map(x => x.textContent.trim()));
    check(w.tab === 'Students' && w.rail === 'All classes' && n === 69 && groups.join('|') === '1st Period|2nd Period|5th Period', 'All classes › Students: every student of every class, by class (' + n + ')'); }
  await p.click('#openReports'); await p.waitForTimeout(400);
  check(/Print · All classes/.test(await p.textContent('#rpPrint')) && await p.locator('#rpScope').count() === 0 && (await where()).tab === 'Reports' && await p.locator('#rpBack .retall, #rpBack .ghint').count() >= 1, 'All classes › Reports is a page: printing for every class, and every class\'s signed reports'); await p.click('#openOverview'); await p.waitForTimeout(200);
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
  check(/Print · 2nd Period/.test(await p.textContent('#rpPrint')) && await p.locator('#rpScope button[aria-pressed="true"]:has-text("2nd Period")').count() === 1 && /Reports out and back/.test(await p.textContent('#rpBack')) && (await where()).tab === 'Reports', 'Reports is a page of the class: printing for this class, with its signed reports beside'); await p.click('#openGrid'); await p.waitForTimeout(200);
  // ---- phase 2: one Actions menu per class, one inbox ------------------------------------------------------------
  await p.click('#openGrid'); await p.waitForTimeout(300);
  check(await p.locator('#bar #btnPrint, #bar #moreBtn, #bar #openGrades').count() === 0 && await p.locator('#chead #actBtn').count() === 1, 'the grid bar keeps only Working in; everything else is behind Actions on the class header');
  await p.click('#actBtn'); await p.waitForTimeout(200);
  const menu = await p.$$eval('#actMenu button', bs => bs.map(b => b.firstChild.textContent.trim()));
  check(menu.join(' | ').replace(/Close Quarter \d/, 'Quarters') === 'Copy Unit 3 to Focus | What changed this week | Quarters | Board save | Class settings', 'Actions: Copy the unit being worked in, What changed, the quarters, Board save, Class settings (Print and Signed reports are the Reports tab): ' + menu.join(' | '));
  await p.click('#mDigest'); await p.waitForTimeout(400); check(/What changed/.test(await p.textContent('#modal')), 'What changed opens from it'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('#actBtn'); await p.waitForTimeout(150); await p.click('#mSettings'); await p.waitForTimeout(400); check((await where()).mode === 'settings' && await p.locator('#bar #stabs [data-stab="class"]').count() === 1 && await p.locator('.spage #secLabel').count() === 1 && (await where()).rail === '2nd Period', 'Class settings opens the Settings page on this class'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('#btnHome'); await p.waitForTimeout(300); await p.click('#actBtn'); await p.waitForTimeout(200);
  const menuAll = await p.$$eval('#actMenu button', bs => bs.map(b => b.firstChild.textContent.trim()).join(' | ').replace(/Close Quarter \d/, 'Quarters'));
  check(menuAll === 'Quarters | Board save | Full save | Settings', 'All classes has the Tally-wide actions: ' + menuAll); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // the inbox: the Overview's list, the rail's counts and the class's own list are one list
  const ov = await p.evaluate(() => [...document.querySelectorAll('#hAtt .hatt li.warn')].length);
  check(ov === sumW && await p.locator('#rail #btnHome .n').textContent() === String(sumW), 'the Overview lists ' + ov + ' things to fix, the number on the rail');
  await p.click('[data-k="p2"]'); await p.waitForTimeout(400);
  { const chip = await p.textContent('#nToggle'); check(new RegExp('^' + warns.p2 + ' to fix').test(chip.trim()) && await p.locator('#notices #nAtt').count() === 0, 'a class: the count in the bar, the inbox folded: ' + chip.trim()); }
  await p.click('#nToggle'); await p.waitForTimeout(300);
  { const li = await p.$$eval('#nAtt .hatt li', es => es.map(e => ({ warn: e.classList.contains('warn'), text: e.querySelector('b').textContent, fix: (e.querySelector('.hfix') || {}).textContent || '' })));
    const items = await p.evaluate(() => window.__tally.attentionItems(window.__tally.state.sections.p2).map(i => i.text));
    check(li.filter(x => x.warn).length === warns.p2 && li.length === items.length && li.every((x, i) => items.some(t => t.charAt(0).toUpperCase() + t.slice(1) === x.text)), 'open: the same items the Overview and the rail count, warnings first (' + li.length + ')');
    check(li.some(x => /IXL export is \d+ days old/.test(x.text) && x.fix === 'Import') && li.some(x => /on the roster not in IXL/.test(x.text) && /LOWELL CALDER/.test(x.text + ' ') === false), 'each row carries its fix: the old export has Import'); }
  check(/LOWELL CALDER/.test(await p.textContent('#nAtt')), 'the names are in the row\'s detail (names showing)');
  await p.click('#nToggle'); await p.waitForTimeout(200); check(await p.locator('#nAtt').count() === 0, 'tapping the count folds it again');
  // switching class keeps the Grid; All classes › Students then a class's Students are two lists
  await p.click('[data-k="p5"]'); await p.waitForTimeout(400);
  { const w = await where(); check(w.rail === '5th Period' && w.tab === 'Grid' && /^5th Period/.test(w.h2) && /On-level/.test(await p.textContent('#chead .meta')), 'another class on the rail opens its Grid'); }
  await p.click('#openStudents'); await p.waitForTimeout(400); await p.click('#btnHome'); await p.waitForTimeout(300); await p.click('#btnStudents'); await p.waitForTimeout(400);
  check(await p.locator('.sdir tr[data-open]').count() === 69 && (await where()).rail === 'All classes', 'All classes › Students is every class again after a class\'s Students');
  // ---- phase 4: Reports and Settings are pages ------------------------------------------------------------------
  await p.click('[data-k="p2"]'); await p.waitForTimeout(300); await p.click('#openReports'); await p.waitForTimeout(400);
  { const r = await p.evaluate(() => ({ cards: [...document.querySelectorAll('.rpage .gsec h3')].map(h => h.textContent.replace(/\s+/g, ' ').trim()), who: document.querySelectorAll('#rpWho button').length, owed: document.querySelectorAll('[data-owed]').length, also: ['rpDigest', 'rpBoard', 'rpRace', 'rpLab'].every(id => document.getElementById(id)), back: /No weekly reports printed/.test(document.querySelector('#rpBack').textContent), modal: document.querySelector('#modal').classList.contains('hidden') }));
    check(r.cards.join(' | ') === 'Print · 2nd Period | Reports out and back | Also' && r.who === 3 && r.owed === 3 && r.also && r.back && r.modal, 'a class\'s Reports: the print choices, the signed-reports list (empty until a print) and the saved pages, side by side, no dialog: ' + r.cards.join(' | ')); }
  { const [w] = await Promise.all([ctx.waitForEvent('page'), p.click('#rpWeekly')]); await w.waitForTimeout(600); await w.close(); await p.waitForTimeout(500);
    check((await where()).tab === 'Reports' && await p.locator('#rpBack .rettab tbody tr').count() === 23 && /23 reports still out/.test(await p.textContent('#rpBack .rphead')), 'printing the weekly reports lists them as out, on the same page'); }
  await p.click('#rpBack .rettab tbody tr:first-child [data-rback]'); await p.waitForTimeout(400); check(/22 reports still out/.test(await p.textContent('#rpBack .rphead')) && (await where()).tab === 'Reports', 'a tick marks one back without leaving the page');
  await p.click('[data-scope="all"]'); await p.waitForTimeout(400); check(/Print · All classes/.test(await p.textContent('#rpTitle')) && (await where()).rail === '2nd Period' && await p.locator('#rpBack .rettab tbody tr').count() === 23, 'All classes in the print card prints every class; the page stays the class\'s'); await p.click('[data-scope="class"]'); await p.waitForTimeout(300);
  await p.click('#btnHome'); await p.waitForTimeout(300); await p.click('#openReports'); await p.waitForTimeout(400);
  { const rows = await p.evaluate(() => [...document.querySelectorAll('#rpBack .retall tbody tr')].map(tr => [...tr.cells].map(c => c.textContent.trim()).join(' ')));
    check(rows.length === 3 && /2nd Period.* \w{3} \d+ 1 of 23 Open ›/.test(rows[1]) && /none printed yet +Reports ›/.test(rows[0]), 'All classes › Reports: one line per class, who is back, and the way to its list: ' + rows.join(' | ')); }
  await p.click('#rpBack [data-retk="p2"]'); await p.waitForTimeout(400); check((await where()).rail === '2nd Period' && (await where()).tab === 'Reports', '…which opens that class\'s Reports');
  await p.click('#openGrid'); await p.waitForTimeout(300);
  // the rail's foot
  await p.click('#btnSettings'); await p.waitForTimeout(400); check((await where()).mode === 'settings' && await p.locator('#bar #stabs').count() === 1 && await p.locator('#rail #btnSettings.on').count() === 1, 'Settings opens from the rail, as a page, and the rail lights it'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  { const [gd] = await Promise.all([ctx.waitForEvent('page'), p.click('#btnGuide')]); await gd.waitForLoadState(); check(/Full save/.test(await gd.evaluate(() => document.body.textContent)), 'the Guide opens from the rail'); await gd.close(); }
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
