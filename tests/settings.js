// Settings is a page on the class spine (phase 4 of the navigation redesign, 7 Nov 2026), not a dialog with its own
// class picker: the rail says which class; All classes › Settings holds what reaches every class, and the way to each
// class's own. Three scopes under three headings: this class, this course, all of Tally (and Files).
const { chromium, fs, path, exe, check, done, tmp, pick, more, APP , fullSave, legacyOf } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1536,height:864}}); const p=await ctx.newPage();
  const errs=[]; let dialogs=[], answer=true; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>{ dialogs.push(d.message()); answer?d.accept():d.dismiss(); });
  await p.goto('file://'+path.resolve(APP));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await pick(p,'[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(700); check(await p.locator(`[data-k="period-${per}"]`).count()===1,'class made: period '+per); }
  const where=()=>p.evaluate(()=>({ mode:window.__tally.view.mode, all:!!window.__tally.view.all, active:window.__tally.state.active, rail:(document.querySelector('#rail button.on .lbl')||{}).textContent, tabs:[...document.querySelectorAll('#stabs [data-stab]')].map(b=>b.dataset.stab+(b.classList.contains('on')?'*':'')).join(' ') }));
  // 1. a class's Settings: the three scopes, in order, each owning its controls; the rail lights the class and Settings
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(200); await more(p,'#btnSettings'); await p.waitForTimeout(300);
  const lay=await p.evaluate(()=>{ const m=document.querySelector('.spage'); const heads=[...m.querySelectorAll('.scopeHead')]; const scopeOf=id=>{ const el=m.querySelector(id); if (!el) return 'missing'; let best=null; heads.forEach(h=>{ if (h.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING) best=h; }); return best?best.querySelector('b').textContent:'none'; };
    return { title:document.querySelector('#bar .crumb h2').textContent, heads:heads.map(h=>h.querySelector('b').textContent).join(' | '), sub:heads.map(h=>(h.querySelector('span')||{textContent:''}).textContent).join(' | '),
      cls:['#secLabel','#thr','[data-prep]','#roster','#matchReport','#dropGrades','#forget'].map(scopeOf), course:['#skipFirst','#exportCourse','#importCourse'].map(scopeOf), all:['#useBest','#remind','#copyMode','#exportFull','#exportBoard','#importCfg','#addCustom','#saveRace','#saveLab','#storeLine','#wipe'].map(scopeOf), small:/Applies to every class|for every class of this course/.test(m.textContent), modal:document.querySelector('#modal').classList.contains('hidden') }; });
  check(lay.title==='Settings' && lay.heads==='This class | This course | All of Tally | Files' && lay.modal,'the page is "Settings" under the class header, with four tabs and headings, and no dialog: '+lay.heads);
  const w1=await where(); check(w1.mode==='settings' && !w1.all && w1.active==='period-1' && w1.rail==='1st Period' && w1.tabs==='class* course tally files' && await p.locator('#rail #btnSettings.on').count()===1,'the rail lights the class and Settings: '+JSON.stringify(w1));
  check(await p.locator('#stabs [data-stab]').count()===4 && await p.locator('section.stab.on').count()===1 && await p.locator('#setClass').count()===0,'one tab shows at a time, and there is no class picker: the rail is the picker');
  check(lay.cls.every(x=>x==='This class'),'this class: name, goal, course, roster, match report, gradebook, remove: '+[...new Set(lay.cls)].join());
  check(lay.course.every(x=>x==='This course'),'this course: review units and the course settings file: '+[...new Set(lay.course)].join());
  check(lay.all.every(x=>x==='All of Tally' || x==='Files'),'all of Tally and Files: best score, reminder, copy format, backup, own data, share, storage, clear: '+[...new Set(lay.all)].join());
  check(/every accelerated class/.test(lay.sub) && /every class, both courses/.test(lay.sub) && !lay.small,'each heading says who it reaches, so no option needs "applies to every class" in small print: '+lay.sub);
  // 2. another class on the rail shows that class's settings, on the same tab
  await p.click('[data-k="period-2"]'); await p.waitForTimeout(300);
  const sw=await p.evaluate(()=>({ name:document.querySelector('#secLabel').value, sub:[...document.querySelectorAll('.scopeHead span')].map(s=>s.textContent).join(' | '), skip:document.querySelector('#skipFirst .on').textContent, active:window.__tally.state.active, mode:window.__tally.view.mode }));
  check(sw.name==='2nd Period · On-level' && /every on-level class/.test(sw.sub) && sw.skip==='First 1' && sw.active==='period-2' && sw.mode==='settings','tapping another class on the rail shows that class and its course, still in Settings (on-level: first unit is review): '+sw.name);
  // 3. a pasted roster is not lost by leaving the page without being asked
  await seeTab(p,'#roster'); await p.fill('#roster','Zzz, Q'); dialogs=[]; answer=false; await p.click('[data-k="period-1"]'); await p.waitForTimeout(300);
  check(dialogs.length===1 && /Discard the roster changes/.test(dialogs[0]) && await p.inputValue('#secLabel')==='2nd Period · On-level' && (await where()).active==='period-2','leaving with an unsaved roster asks first; declining stays put');
  answer=true; await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); check(await p.inputValue('#secLabel')==='1st Period · Accelerated' && (await where()).mode==='settings','…and accepting switches, staying in Settings');
  // 3b. the same for every other unsaved field: none is dropped without a question, none follows to the other class
  for (const [what, act] of [['the goal', async()=>{ await seeTab(p,'#thr'); await p.fill('#thr','80'); }], ['the name', async()=>{ await seeTab(p,'#secLabel'); await p.fill('#secLabel','Renamed'); }], ['the copy format', async()=>{ await seeTab(p,'#copyMode [data-cm="ids"]'); await p.click('#copyMode [data-cm="ids"]'); }], ['the reminder', async()=>{ await seeTab(p,'#remind'); await p.click('#remind [data-remind="14"]'); }], ['best score', async()=>{ await seeTab(p,'#useBest'); await p.click('#useBest'); }], ['review units', async()=>{ await seeTab(p,'[data-skip="2"]'); await p.click('[data-skip="2"]'); }], ['the course', async()=>{ await seeTab(p,'[data-prep="on"]'); await p.click('[data-prep="on"]'); }]]) {
    await act(); dialogs=[]; answer=false; await p.click('[data-k="period-2"]'); await p.waitForTimeout(250);
    check(dialogs.length===1 && /haven't saved/.test(dialogs[0]) && (await where()).active==='period-1','changing '+what+' and then tapping another class asks before dropping it');
    answer=true; await p.click('[data-k="period-2"]'); await p.waitForTimeout(250); await p.click('[data-k="period-1"]'); await p.waitForTimeout(250); }
  const kept=await p.evaluate(()=>{ const T=window.__tally; return { thr:T.state.sections['period-1'].threshold, label:T.state.sections['period-1'].label, cm:T.state.settings.copyMode, rem:T.state.settings.remindDays, best:T.state.settings.useBest, skip:T.state.settings.skipFirst.acc, prep:T.state.sections['period-1'].prep }; });
  check(kept.thr===67 && kept.label==='1st Period · Accelerated' && kept.cm!=='ids' && kept.skip===0 && kept.prep==='acc','…and a discarded change is discarded, not applied: '+JSON.stringify(kept));
  // 3c. the tabs, All classes and the search box ask too
  await seeTab(p,'#thr'); await p.fill('#thr','80'); dialogs=[]; answer=false; await p.click('#openGrid'); await p.waitForTimeout(250); await p.click('#btnHome'); await p.waitForTimeout(250); await p.fill('#search','z'); await p.waitForTimeout(250);
  check(dialogs.length===3 && (await where()).mode==='settings' && await p.inputValue('#thr')==='80','the Grid tab, All classes and the search box each ask before leaving unsaved edits, and declining keeps them');
  await p.fill('#search',''); answer=true; await p.click('#openGrid'); await p.waitForTimeout(300); check((await where()).mode==='units' && await p.evaluate(()=>window.__tally.state.sections['period-1'].threshold)===67,'…accepting leaves, dropping the edit');
  // 3d. flipping the course on the page: "This course" follows it
  await more(p,'#btnSettings'); await p.waitForTimeout(250);
  await seeTab(p,'[data-prep="on"]'); await p.click('[data-prep="on"]'); await p.waitForTimeout(150);
  check(/every on-level class/.test(await p.textContent('#courseOf')) && (await p.textContent('#skipFirst .on')).trim()==='First 1','tapping On-level turns "This course" into the on-level course and shows its own review-unit count');
  await seeTab(p,'[data-prep="acc"]'); await p.click('[data-prep="acc"]'); await p.waitForTimeout(150); check(/every accelerated class/.test(await p.textContent('#courseOf')) && (await p.textContent('#skipFirst .on')).trim()==='None','…and back');
  // 3e. Cancel, Escape and Back return to the page that was open
  dialogs=[]; await p.keyboard.press('Escape'); await p.waitForTimeout(200); check(dialogs.length===0 && (await where()).mode==='units' && await p.evaluate(()=>window.__tally.state.sections['period-1'].prep)==='acc','Escape is Cancel: it leaves and drops the changed course without a question (only a pasted roster is asked about)');
  await p.click('th.unit .ulink'); await p.waitForTimeout(300);
  const where0=await p.evaluate(()=>document.querySelector('#bar').textContent.slice(0,60)+'|'+window.__tally.state.active+'|'+window.__tally.view.mode);
  await more(p,'#btnSettings'); await p.waitForTimeout(250); await p.click('#setBack'); await p.waitForTimeout(300);
  check(await p.evaluate(()=>document.querySelector('#bar').textContent.slice(0,60)+'|'+window.__tally.state.active+'|'+window.__tally.view.mode)===where0 && await p.locator('.rc.on[data-k="period-1"]').count()===1,'from 1st Period\'s unit view: Settings, Back: still 1st Period\'s unit view');
  await more(p,'#btnSettings'); await p.waitForTimeout(250); await p.click('#mCancel'); await p.waitForTimeout(300); check((await where()).mode==='unit','Cancel does the same');
  await more(p,'#btnSettings'); await p.waitForTimeout(250); await p.click('[data-k="period-2"]'); await p.waitForTimeout(250); await p.click('#mCancel'); await p.waitForTimeout(300);
  check((await where()).active==='period-2' && (await where()).mode==='units','after moving to another class in Settings, Cancel lands on that class\'s grid (the page it came from belonged to the other class)');
  // 4. saving still reaches the right scope, and returns to the page that was open
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(200); await p.click('#openGrades'); await p.waitForTimeout(200); await more(p,'#btnSettings'); await p.waitForTimeout(300);
  await seeTab(p,'#thr'); await p.fill('#thr','70'); await seeTab(p,'#copyMode [data-cm="ids"]'); await p.click('#copyMode [data-cm="ids"]'); await p.click('#mSave'); await p.waitForTimeout(400);
  const sv=await p.evaluate(()=>{ const T=window.__tally; return { p1:T.state.sections['period-1'].threshold, p2:T.state.sections['period-2'].threshold, cm:T.state.settings.copyMode, mode:T.view.mode }; });
  check(sv.p1===70 && sv.p2===60 && sv.cm==='ids' && sv.mode==='grades','Save: the goal changed for this class only, the copy format for all of Tally, and the Grades tab is back: '+JSON.stringify(sv));
  // 4b. a message goes to the top of the screen, never onto Save / Cancel
  await more(p,'#btnSettings'); await p.waitForTimeout(300); await seeTab(p,'#exportFull'); const [bk]=await Promise.all([p.waitForEvent('download'), p.click('#exportFull')]); await p.waitForTimeout(300);
  check(await p.evaluate(()=>{ const t=document.querySelector('#toast').getBoundingClientRect(); const bs=[...document.querySelectorAll('.spage .sfoot .pill')].map(b=>b.getBoundingClientRect()); const clear=r=>t.bottom<=r.top || t.top>=r.bottom || t.right<=r.left || t.left>=r.right; return document.querySelector('#toast').classList.contains('show') && bs.every(clear); }),'the "Full save downloaded" message covers neither Save nor Cancel');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // 5. All classes › Settings: what reaches every class, and the way to each class's own
  await p.click('#btnHome'); await p.waitForTimeout(200); await more(p,'#btnSettings'); await p.waitForTimeout(300);
  const wa=await where(); const heads=await p.evaluate(()=>[...document.querySelectorAll('.spage .scopeHead b')].map(h=>h.textContent).join(' | '));
  check(wa.mode==='settings' && wa.all && wa.rail==='All classes' && /^classes\*? tally\*? files\*?$/.test(wa.tabs) && heads==='Each class | All of Tally | Files' && await p.locator('#roster, #thr, #skipFirst').count()===0,'All classes › Settings: Classes, Tally and Files, nothing of one class: '+JSON.stringify(wa)+' · '+heads);
  const cl=await p.evaluate(()=>[...document.querySelectorAll('.setClasses .pill')].map(b=>b.textContent.replace(/\s+/g,' ').trim()).join(' | '));
  check(/1st Period · Accelerated goal 70 · gradebook \| Accelerated course settings \| 2nd Period · On-level goal 60 · gradebook \| On-level course settings/.test(cl),'the Classes tab lists each class under its course, with its goal, and each course\'s settings: '+cl);
  await seeTab(p,'[data-setcourse="period-2"]'); await p.click('[data-setcourse="period-2"]'); await p.waitForTimeout(300); const wc=await where();
  check(wc.active==='period-2' && !wc.all && wc.tabs==='class course* tally files' && /every on-level class/.test(await p.textContent('#courseOf')),'"On-level course settings" opens an on-level class\'s Settings on its Course tab: '+JSON.stringify(wc));
  await p.click('#mCancel'); await p.waitForTimeout(300); check((await where()).mode==='units' && (await where()).active==='period-2','…and Cancel lands on that class\'s grid: the rail moved to it');
  await p.click('#btnHome'); await p.waitForTimeout(200); await more(p,'#btnSettings'); await p.waitForTimeout(250); await seeTab(p,'#remind'); await p.click('#remind [data-remind="14"]'); await p.click('#mSave'); await p.waitForTimeout(300);
  check(await p.evaluate(()=>window.__tally.state.settings.remindDays)===14 && (await where()).mode==='home','Save from All classes › Settings keeps the Tally-wide change and returns to the Overview');
  // 6. one class: the heading names it
  await p.evaluate(()=>{ const T=window.__tally; delete T.state.sections['period-2']; T.state.order=['period-1']; T.state.active='period-1'; T.save(); T.render(); });
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(200); await more(p,'#btnSettings'); await p.waitForTimeout(300);
  check(/1st Period · Accelerated/.test(await p.textContent('.scopeHead')),'with one class the heading names the class');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // 7. fits a Windows laptop at 150 % scale: the Save / Cancel row is reached by scrolling the page, not lost
  await p.setViewportSize({width:1280,height:720}); await more(p,'#btnSettings'); await p.waitForTimeout(300);
  check(await p.evaluate(()=>{ const f=document.querySelector('.spage .sfoot'); f.scrollIntoView(); const r=f.getBoundingClientRect(); const h=document.querySelector('#bar .crumb').getBoundingClientRect(); return r.bottom<=innerHeight && h.top>=0 && document.documentElement.scrollWidth<=innerWidth+1; }),'1280×720: the title and the Save / Cancel row are both on screen');
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
