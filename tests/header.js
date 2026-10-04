// The header: three places (Classes, Students, Board), search, the names switch, a ⋯ menu, and Import.
const { chromium, fs, path, exe, check, done, tmp, pick, APP } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1366,height:768},acceptDownloads:true}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const vis=sel=>p.locator(sel).isVisible();
  // 1. before anything is imported: nowhere to go yet
  check(await vis('#btnGuide0') && await vis('#btnImport') && !(await vis('#nav')) && !(await vis('#btnMore')) && !(await vis('#btnHide')),'landing: the Guide and Import, no places and no menu');
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await pick(p,'[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(700); const a=await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(300); } }
  // 2. the places
  const nav=async()=>p.evaluate(()=>[...document.querySelectorAll('#nav button')].map(x=>x.textContent.trim()+(x.classList.contains('on')?'*':'')+(x.getAttribute('aria-current')==='page'?'!':'')).join(' '));
  await p.click('#btnHome'); await p.waitForTimeout(300);
  check(await nav()==='Classes*! Students Board' && await p.locator('body.home').count()===1,'three places; Classes is the Overview: '+await nav());
  check(!(await vis('#btnGuide0')) && await vis('#btnMore') && await vis('#btnHide') && await vis('#search'),'after an import: search, the names switch and the menu; the landing Guide button is gone');
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300);
  check(await nav()==='Classes*! Students Board','inside a class, Classes is still the current place');
  await p.click('#btnStudents'); await p.waitForTimeout(300);
  check(await nav()==='Classes Students*! Board','Students marks itself: '+await nav());
  await p.click('#btnHome'); await p.waitForTimeout(300);
  check(await p.locator('body.home').count()===1,'Classes goes back to the Overview from anywhere');
  const quiet=await p.evaluate(()=>[...document.querySelectorAll('#top button')].filter(x=>x.offsetParent!==null && x.classList.contains('pill') && !x.classList.contains('ghost')).map(x=>x.id).join());
  check(quiet==='btnImport','Import is the only filled button: '+quiet);
  // 3. the menu
  check(await p.locator('#topMenu.hidden').count()===1,'the menu is closed until asked for');
  await p.click('#btnMore'); await p.waitForTimeout(200);
  const items=await p.evaluate(()=>[...document.querySelectorAll('#topMenu button')].map(x=>x.childNodes.length && [...x.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('')).join(' | '));
  check(items==='Details view | Settings | Guide | Save backup' && await p.getAttribute('#btnMore','aria-expanded')==='true','the menu holds Details view, Settings, Guide and Save backup: '+items);
  check(await p.evaluate(()=>document.activeElement.id)==='btnDetails','focus moves to the first item');
  await p.keyboard.press('ArrowDown'); check(await p.evaluate(()=>document.activeElement.id)==='btnSettings','arrow keys move through it');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  check(await p.locator('#topMenu.hidden').count()===1 && await p.evaluate(()=>document.activeElement.id)==='btnMore' && await p.getAttribute('#btnMore','aria-expanded')==='false','Escape closes it and returns focus to the button');
  await p.click('#btnMore'); await p.waitForTimeout(150); await p.mouse.click(300,500); await p.waitForTimeout(150);
  check(await p.locator('#topMenu.hidden').count()===1 && await p.locator('body.home').count()===1,'a tap outside closes it without touching what is underneath');
  await p.click('#btnMore'); await p.click('#btnDetails'); await p.waitForTimeout(300);
  check(await p.locator('body.details').count()===1 && await p.getAttribute('#btnDetails','aria-checked')==='true' && await p.getAttribute('#btnDetails','role')==='menuitemcheckbox' && await p.locator('#topMenu.hidden').count()===1,'Details view switches on from the menu');
  await p.click('#btnMore'); await p.waitForTimeout(150);
  const sw=await p.evaluate(()=>getComputedStyle(document.querySelector('#btnDetails .sw')).backgroundColor); check(sw!=='rgb(232, 226, 213)' && await vis('#btnDetails .sw'),'…and its switch shows on ('+sw+')');
  await p.click('#btnDetails'); await p.waitForTimeout(200); check(await p.locator('body.details').count()===0,'…and off again');
  await p.click('#btnMore'); await p.click('#btnSettings'); await p.waitForTimeout(300);
  check(await p.locator('#modal:not(.hidden) #exportCfg').count()===1,'Settings opens from the menu'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check(await p.evaluate(()=>document.activeElement.id)==='btnMore','closing Settings returns focus to the menu button');
  await p.click('#btnMore'); await p.waitForTimeout(150);
  check((await p.textContent('#topBk')).trim()==='never' && await p.locator('#topBk.due').count()===1,'Save backup says no backup has been made, and that one is due');
  const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#btnBackup')]); await p.waitForTimeout(300);
  check(/^tally-backup-.*\.json$/.test(dl.suggestedFilename()),'Save backup downloads the backup: '+dl.suggestedFilename());
  await p.click('#btnMore'); await p.waitForTimeout(150); check((await p.textContent('#topBk')).trim()==='today' && await p.locator('#topBk.due').count()===0,'…and then reads "today"'); await p.keyboard.press('Escape');
  const [pop]=await Promise.all([ctx.waitForEvent('page'), (async()=>{ await p.click('#btnMore'); await p.click('#btnGuide'); })()]); await pop.waitForLoadState();
  const g=await pop.textContent('body'); check(/Every week or two/.test(g) && /eye button/.test(g) && /Board/.test(g) && !/Header toggle/.test(g),'the Guide opens from the menu and describes this header'); await pop.close();
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
  // the menu stays inside the window when the header wraps (a phone, or the Chromebox at 200 % zoom = 683 px wide)
  for (const [w,h,label] of [[683,384,'Chromebox at 200 %'],[390,800,'phone'],[911,512,'Chromebox at 150 %']]) {
    await p.setViewportSize({width:w,height:h}); await p.waitForTimeout(200); await p.click('#btnMore'); await p.waitForTimeout(200);
    const r=await p.evaluate(()=>{ const m=document.querySelector('#topMenu').getBoundingClientRect(); return { l:Math.round(m.left), r:Math.round(m.right), ok:m.left>=0 && m.right<=innerWidth && m.width>200 }; });
    check(r.ok,label+' ('+w+' px): the ⋯ menu opens inside the window ('+r.l+'…'+r.r+')'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  }
  for (const w of [700,720,740,760]) { await p.setViewportSize({width:w,height:900}); await p.waitForTimeout(150);
    const m=await p.evaluate(()=>{ const t=document.querySelector('#top').getBoundingClientRect(); return { page:document.documentElement.scrollWidth<=innerWidth+1, inside:[...document.querySelectorAll('#top > *')].filter(c=>c.offsetParent!==null).every(c=>c.getBoundingClientRect().right<=t.right+0.5) }; });
    check(m.page && m.inside,w+' px: nothing sticks out of the header and the page does not scroll sideways'); }
  await p.setViewportSize({width:768,height:1024}); await p.waitForTimeout(150);
  check(await p.evaluate(()=>{ const s=document.querySelector('#search'); const c=document.createElement('canvas').getContext('2d'); const cs=getComputedStyle(s); c.font=cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily; return c.measureText(s.placeholder).width <= s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 1; }),'iPad upright: "Find a student…" is not cut off in the search field');
  // semantics, and a menu never outlives the screen it was opened on
  await p.setViewportSize({width:1366,height:768}); await p.click('#btnHome'); await p.waitForTimeout(200);
  check(await p.evaluate(()=>!document.querySelector('#btnHome').hasAttribute('aria-pressed') && !document.querySelector('#btnStudents').hasAttribute('aria-pressed') && document.querySelector('#btnHome').getAttribute('aria-current')==='page'),'the places say where you are with aria-current only (no contradictory pressed state)');
  await p.click('#btnMore'); await p.waitForTimeout(150);
  check(await p.evaluate(()=>document.querySelector('#topMenu').getAttribute('role')==='menu' && [...document.querySelectorAll('#topMenu button')].every(x=>/^menuitem/.test(x.getAttribute('role')))),'the menu and its items are announced as a menu');
  await p.keyboard.press('End'); const endId=await p.evaluate(()=>document.activeElement.id); await p.keyboard.press('Home'); check(endId==='btnBackup' && await p.evaluate(()=>document.activeElement.id)==='btnDetails','End and Home jump to the last and first item');
  await p.evaluate(()=>window.__tally.render()); await p.waitForTimeout(150);   // what an import finishing does while a menu is open
  check(await p.locator('#topMenu.hidden').count()===1 && await p.locator('#menuOverlay').count()===0 && await p.getAttribute('#btnMore','aria-expanded')==='false','a re-render (an import finishing) closes an open menu and removes its overlay');
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); const before=await p.inputValue('#curUnit'); await p.focus('#curUnit'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(200);
  check(await p.evaluate(()=>window.__tally.state.settings.currentUnit.acc)!==Number(before) || await p.inputValue('#curUnit')!==before,'…and its key listener is gone: arrow keys work on the page again');
  await p.setViewportSize({width:800,height:1280}); await p.click('#btnMore'); await p.waitForTimeout(200);
  check(await p.evaluate(()=>{ const r=document.querySelector('#topMenu').getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.height>150; }),'the menu opens inside the screen on the tablet');
  await p.keyboard.press('Escape');
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
