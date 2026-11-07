// The shell: the rail (All classes, each class, the Board), the class tabs, search, the names switch, a ⋯ menu, and Import.
const { chromium, fs, path, exe, check, done, tmp, pick, APP } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1366,height:768},acceptDownloads:true}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const vis=sel=>p.locator(sel).isVisible();
  // 1. before anything is imported: nowhere to go yet
  check(await vis('#btnGuide0') && await vis('#btnImport') && !(await vis('#rail')) && !(await vis('#btnHide')),'landing: the Guide and Import, no rail');
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await pick(p,'[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(700); const a=await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(300); } }
  // 2. the rail: one spine (Croix, 7 Nov 2026): All classes, every class under its course, the Board at the foot
  const rail=async()=>p.evaluate(()=>[...document.querySelectorAll('#rail .lbl, #rail .sec')].map(x=>x.textContent.trim()+(x.closest('button') && x.closest('button').classList.contains('on')?'*':'')+(x.closest('button') && x.closest('button').getAttribute('aria-current')==='page'?'!':'')).join(' | '));
  const tabs=async()=>p.evaluate(()=>[...document.querySelectorAll('#ctabs button')].map(x=>x.firstChild.textContent.trim()+(x.getAttribute('aria-selected')==='true'?'*':'')).join(' '));
  await p.click('#btnHome'); await p.waitForTimeout(300);
  check(await rail()==='All classes*! | Accelerated | 1st Period | On-level | 2nd Period' && await p.locator('body.home').count()===1,'the rail: All classes, then each class under its course: '+await rail());
  check(await tabs()==='Overview* Students Reports' && await p.locator('#chead h2').textContent()==='All classes','All classes has Overview, Students and Reports');
  check(await vis('#btnLb') && await vis('#btnSettings') && await vis('#btnGuide') && /Full save/.test(await p.textContent('#rail .foot')),'the Board, Settings, the Guide and Full save at its foot');
  check(!(await vis('#btnGuide0')) && await vis('#btnHide') && await vis('#search'),'after an import: search and the names switch; the landing Guide button is gone');
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300);
  check(await rail()==='All classes | Accelerated | 1st Period*! | On-level | 2nd Period' && await tabs()==='Grid* Grades Students Seating Reports','a class lights on the rail and opens on its Grid tab, with the same five tabs every class has: '+await tabs());
  await p.click('#openGrades'); await p.waitForTimeout(300); check(await tabs()==='Grid Grades* Students Seating Reports' && await p.locator('#gridwrap .grades').count()===1,'Grades is a tab of the class');
  await p.click('#openStudents'); await p.waitForTimeout(300); check(await tabs()==='Grid Grades Students* Seating Reports' && await p.locator('.sdir').count()===1 && !/2nd Period/.test(await p.textContent('.sdir')) && await p.locator('.sdir th:has-text("Class")').count()===0,'Students is a tab of the class: that class\'s students, no Class column');
  await p.click('#openSeating'); await p.waitForTimeout(300); check(await tabs()==='Grid Grades Students Seating* Reports','Seating too');
  await p.click('#openReports'); await p.waitForTimeout(300); check(/Print · 1st Period/.test(await p.textContent('#rpPrint')) && await p.locator('#ctabs #openReports[aria-selected="true"]').count()===1 && await p.locator('#modal.hidden').count()===1,'Reports is a page of the class: the print choices, no dialog'); await p.click('#openGrid'); await p.waitForTimeout(200);
  await p.click('#btnHome'); await p.click('#btnStudents'); await p.waitForTimeout(300);
  check(await rail()==='All classes*! | Accelerated | 1st Period | On-level | 2nd Period' && await tabs()==='Overview Students* Reports' && /2nd Period/.test(await p.textContent('.sdir')),'All classes › Students: every class, and nothing but All classes lit on the rail');
  await p.click('#btnHome'); await p.waitForTimeout(300);
  check(await p.locator('body.home').count()===1,'All classes goes back to the Overview from anywhere');
  const quiet=await p.evaluate(()=>[...document.querySelectorAll('#top button')].filter(x=>x.offsetParent!==null && x.classList.contains('pill') && !x.classList.contains('ghost')).map(x=>x.id).join());
  check(quiet==='btnImport','Import is the only filled button: '+quiet);
  // 3. the rail's foot and the Actions menu (phase 3, 7 Nov 2026: the ⋯ menu is gone)
  check(await p.locator('#btnMore, #topMenu').count()===0,'no ⋯ menu in the header any more');
  const foot=await p.$$eval('#rail .foot button',bs=>bs.map(x=>[...x.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('')));
  check(foot.join(' | ')==='Board | Details view | Settings | Guide | Full save','the rail\'s foot: Board, Details view, Settings, Guide, Full save: '+foot.join(' | '));
  await p.click('#btnDetails'); await p.waitForTimeout(300);
  check(await p.locator('body.details').count()===1 && await p.getAttribute('#btnDetails','aria-checked')==='true' && await p.getAttribute('#btnDetails','role')==='menuitemcheckbox','Details view is a switch on the rail');
  const sw=await p.evaluate(()=>getComputedStyle(document.querySelector('#btnDetails .sw')).backgroundColor); check(sw!=='rgb(232, 226, 213)' && await vis('#btnDetails .sw'),'…and its switch shows on');
  await p.click('#btnDetails'); await p.waitForTimeout(200); check(await p.locator('body.details').count()===0,'…and off again');
  await p.click('#btnSettings'); await p.waitForTimeout(300);
  check(await p.locator('.spage #exportFull').count()===1 && await p.evaluate(()=>window.__tally.view.mode)==='settings','Settings opens from the rail, as a page'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check(await p.evaluate(()=>document.activeElement.id)==='btnSettings','closing Settings returns focus to the rail button');
  check((await p.textContent('#btnFullSave .age')).trim()==='never' && await p.locator('#btnFullSave .age.due').count()===1,'Full save says none has been made, and that one is due');
  const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#btnFullSave')]); await p.waitForTimeout(300);
  check(/^tally-full-.*\.json$/.test(dl.suggestedFilename()),'Full save downloads the full save: '+dl.suggestedFilename());
  check((await p.textContent('#btnFullSave .age')).trim()==='today' && await p.locator('#btnFullSave .age.due').count()===0,'…and then reads "today"');
  const [pop]=await Promise.all([ctx.waitForEvent('page'), (async()=>{ await p.click('#btnGuide'); })()]); await pop.waitForLoadState();
  const g=await pop.textContent('body'); check(/Every week or two/.test(g) && /eye button/.test(g) && /Board/.test(g) && !/Header toggle/.test(g),'the Guide opens from the rail and describes this header'); await pop.close();
  // the Actions menu: a real menu (focus, arrows, Escape, a tap outside)
  await p.click('#btnHome'); await p.waitForTimeout(200);
  check(await p.locator('#actMenu.hidden').count()===1,'the Actions menu is closed until asked for');
  await p.click('#actBtn'); await p.waitForTimeout(200);
  const items=await p.evaluate(()=>[...document.querySelectorAll('#actMenu button')].map(x=>x.firstChild.textContent.trim()).join(' | ').replace(/Close Quarter \d/,'Quarters'));
  check(items==='Quarters | Board save | Full save | Settings' && await p.getAttribute('#actBtn','aria-expanded')==='true','All classes\' Actions: Quarters, Board save, Full save, Settings: '+items);
  check(await p.evaluate(()=>document.activeElement.id)==='mQuarters','focus moves to the first item');
  await p.keyboard.press('ArrowDown'); check(await p.evaluate(()=>document.activeElement.id)==='mBoardSave','arrow keys move through it');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  check(await p.locator('#actMenu.hidden').count()===1 && await p.evaluate(()=>document.activeElement.id)==='actBtn' && await p.getAttribute('#actBtn','aria-expanded')==='false','Escape closes it and returns focus');
  await p.click('#actBtn'); await p.waitForTimeout(150); await p.mouse.click(300,500); await p.waitForTimeout(150);
  check(await p.locator('#actMenu.hidden').count()===1 && await p.locator('body.home').count()===1,'a tap outside closes it without touching what is underneath');
  // 4. the names switch
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300);
  const first=()=>p.evaluate(()=>document.querySelector('td.stu .nm').textContent.trim());
  const full=await first();
  check(await p.getAttribute('#btnHide','aria-pressed')==='true' && /showing/.test(await p.getAttribute('#btnHide','aria-label')) && /,/.test(full),'names showing: the switch is filled and says so');
  await p.click('#btnHide'); await p.waitForTimeout(300); const masked=await first();
  check(await p.getAttribute('#btnHide','aria-pressed')==='false' && /hidden/.test(await p.getAttribute('#btnHide','aria-label')) && masked!==full && masked.length<full.length,'one tap hides names (initials: '+masked+') and the eye is crossed out');
  check(await p.locator('#btnHide svg line').count()===1,'the crossed-out eye is drawn, not a font glyph');
  await p.click('#btnHide'); await p.waitForTimeout(200); check(await first()===full,'…and one tap brings them back');
  // 5. one row wherever Tally is used; it may wrap on a phone but never overflows
  for (const [w,h,label] of [[1920,1080,'panel'],[1366,768,'Chromebox'],[1024,768,'small laptop'],[800,1280,'tablet upright'],[768,1024,'iPad upright']]) {
    await p.setViewportSize({width:w,height:h}); await p.waitForTimeout(200);
    const m=await p.evaluate(()=>{ const t=document.querySelector('#top'); const kids=[...t.children].filter(c=>c.offsetParent!==null && c.getBoundingClientRect().height>0); const tops=kids.map(c=>c.getBoundingClientRect().top+c.getBoundingClientRect().height/2); const right=Math.max(...kids.map(c=>c.getBoundingClientRect().right)); return { rows:(Math.max(...tops)-Math.min(...tops))<12?1:2, inside:right<=t.getBoundingClientRect().right+0.5, search:Math.round(document.querySelector('#search').getBoundingClientRect().width), page:document.documentElement.scrollWidth<=innerWidth+1 }; });
    check(m.rows===1 && m.inside && m.page && m.search>=110,label+' ('+w+' px): one row, nothing cut, search '+m.search+' px wide');
  }
  await p.setViewportSize({width:390,height:800}); await p.waitForTimeout(200);
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1 && [...document.querySelectorAll('#top > *')].filter(c=>c.offsetParent!==null).every(c=>c.getBoundingClientRect().right<=innerWidth)),'phone width: the header wraps and nothing runs off the screen');
  // the Actions menu stays inside the window when the header wraps (a phone, or the Chromebox at 200 % zoom = 683 px wide)
  for (const [w,h,label] of [[683,384,'Chromebox at 200 %'],[390,800,'phone'],[911,512,'Chromebox at 150 %']]) {
    await p.setViewportSize({width:w,height:h}); await p.waitForTimeout(200); await p.click('#actBtn'); await p.waitForTimeout(200);
    const r=await p.evaluate(()=>{ const m=document.querySelector('#actMenu').getBoundingClientRect(); return { l:Math.round(m.left), r:Math.round(m.right), ok:m.left>=0 && m.right<=innerWidth && m.width>120 }; });
    check(r.ok,label+' ('+w+' px): the Actions menu opens inside the window ('+r.l+'…'+r.r+')'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  }
  for (const w of [700,720,740,760]) { await p.setViewportSize({width:w,height:900}); await p.waitForTimeout(150);
    const m=await p.evaluate(()=>{ const t=document.querySelector('#top').getBoundingClientRect(); return { page:document.documentElement.scrollWidth<=innerWidth+1, inside:[...document.querySelectorAll('#top > *')].filter(c=>c.offsetParent!==null).every(c=>c.getBoundingClientRect().right<=t.right+0.5) }; });
    check(m.page && m.inside,w+' px: nothing sticks out of the header and the page does not scroll sideways'); }
  await p.setViewportSize({width:768,height:1024}); await p.waitForTimeout(150);
  check(await p.evaluate(()=>{ const s=document.querySelector('#search'); const c=document.createElement('canvas').getContext('2d'); const cs=getComputedStyle(s); c.font=cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily; return c.measureText(s.placeholder).width <= s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 1; }),'iPad upright: "Find a student…" is not cut off in the search field');
  // semantics, and a menu never outlives the screen it was opened on
  await p.setViewportSize({width:1366,height:768}); await p.click('#btnHome'); await p.waitForTimeout(200);
  check(await p.evaluate(()=>!document.querySelector('#btnHome').hasAttribute('aria-pressed') && document.querySelector('#btnHome').getAttribute('aria-current')==='page'),'the places say where you are with aria-current only (no contradictory pressed state)');
  await p.click('#actBtn'); await p.waitForTimeout(150);
  check(await p.evaluate(()=>document.querySelector('#actMenu').getAttribute('role')==='menu' && [...document.querySelectorAll('#actMenu button')].every(x=>/^menuitem/.test(x.getAttribute('role')))),'the Actions menu is a menu of menu items');
  await p.keyboard.press('End'); const endId=await p.evaluate(()=>document.activeElement.id); await p.keyboard.press('Home'); check(endId==='mSettings' && await p.evaluate(()=>document.activeElement.id)==='mQuarters','End and Home jump to its last and first items');
  await p.evaluate(()=>window.__tally.render()); await p.waitForTimeout(150);   // what an import finishing does while a menu is open
  check(await p.locator('#actMenu.hidden').count()===1 && await p.locator('#menuOverlay').count()===0 && await p.getAttribute('#actBtn','aria-expanded')==='false','a re-render (an import finishing) closes an open menu and its overlay');
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); const before=await p.inputValue('#curUnit'); await p.focus('#curUnit'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(200);
  check(await p.evaluate(()=>window.__tally.state.settings.currentUnit.acc)!==Number(before) || await p.inputValue('#curUnit')!==before,'…and its key listener is gone: arrow keys work on the page again');
  await p.setViewportSize({width:800,height:1280}); await p.click('#actBtn'); await p.waitForTimeout(200);
  check(await p.evaluate(()=>{ const r=document.querySelector('#actMenu').getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.height>150; }),'the menu opens inside the screen on the tablet');
  await p.keyboard.press('Escape');
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
