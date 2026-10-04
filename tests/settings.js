// Settings is three scopes under three headings — this class, this course, all of Tally — and the class is chosen in
// the dialog, not inherited from whichever tab was last open.
const { chromium, fs, path, exe, check, done, tmp, pick, more, APP } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1536,height:864}}); const p=await ctx.newPage();
  const errs=[]; let dialogs=[], answer=true; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>{ dialogs.push(d.message()); answer?d.accept():d.dismiss(); });
  await p.goto('file://'+path.resolve(APP));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await pick(p,'[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(700); const a=await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(300); } }
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(200); await p.click('#btnHome'); await p.waitForTimeout(300); await more(p,'#btnSettings'); await p.waitForTimeout(300);
  // 1. the three scopes, in order, each owning its controls
  const lay=await p.evaluate(()=>{ const m=document.querySelector('#modal'); const heads=[...m.querySelectorAll('.scopeHead')]; const scopeOf=id=>{ const el=m.querySelector(id); if (!el) return 'missing'; let best=null; heads.forEach(h=>{ if (h.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING) best=h; }); return best?best.querySelector('b').textContent:'none'; };
    return { title:m.querySelector('header h2').textContent, heads:heads.map(h=>h.querySelector('b').textContent).join(' | '), sub:heads.map(h=>(h.querySelector('span')||{textContent:''}).textContent).join(' | '),
      cls:['#secLabel','#thr','[data-prep]','#roster','#matchReport','#dropGrades','#forget'].map(scopeOf), course:['#skipFirst','#exportCourse','#importCourse'].map(scopeOf), all:['#useBest','#remind','#copyMode','#exportCfg','#importCfg','#addCustom','#saveRace','#saveLab','#storeLine','#wipe'].map(scopeOf), small:/Applies to every class|for every class of this course/.test(m.textContent) }; });
  check(lay.title==='Settings' && lay.heads==='This class | This course | All of Tally','the dialog is "Settings" with three headings: '+lay.heads);
  check(lay.cls.every(x=>x==='This class'),'this class: name, goal, course, roster, match report, gradebook, remove — '+[...new Set(lay.cls)].join());
  check(lay.course.every(x=>x==='This course'),'this course: review units and the course settings file — '+[...new Set(lay.course)].join());
  check(lay.all.every(x=>x==='All of Tally'),'all of Tally: best score, reminder, copy format, backup, own data, share, storage, clear — '+[...new Set(lay.all)].join());
  check(/every accelerated class/.test(lay.sub) && /every class, both courses/.test(lay.sub) && !lay.small,'each heading says who it reaches, so no option needs "applies to every class" in small print: '+lay.sub);
  // 2. the class is chosen in the dialog
  const opts=await p.evaluate(()=>[...document.querySelectorAll('#setClass option')].map(o=>o.textContent+(o.selected?'*':'')).join(' | '));
  check(/1st Period · Accelerated\*? \| 2nd Period · On-level/.test(opts),'the class picker lists every class: '+opts);
  await p.selectOption('#setClass','period-2'); await p.waitForTimeout(300);
  const sw=await p.evaluate(()=>({ name:document.querySelector('#secLabel').value, sub:[...document.querySelectorAll('.scopeHead span')].map(s=>s.textContent).join(' | '), skip:document.querySelector('#skipFirst .on').textContent, active:window.__tally.state.active }));
  check(sw.name==='2nd Period · On-level' && /every on-level class/.test(sw.sub) && sw.skip==='First 1' && sw.active==='period-2','choosing another class shows that class and its course (on-level: first unit is review): '+sw.name);
  // 3. a pasted roster is not lost by switching class without being asked
  await p.fill('#roster','Zzz, Q'); dialogs=[]; answer=false; await p.selectOption('#setClass','period-1'); await p.waitForTimeout(300);
  check(dialogs.length===1 && /Discard the roster changes/.test(dialogs[0]) && await p.inputValue('#secLabel')==='2nd Period · On-level' && await p.inputValue('#setClass')==='period-2','switching class with an unsaved roster asks first; declining stays put');
  answer=true; await p.selectOption('#setClass','period-1'); await p.waitForTimeout(300); check(await p.inputValue('#secLabel')==='1st Period · Accelerated','…and accepting switches');
  // 4. saving still reaches the right scope
  await p.fill('#thr','70'); await p.click('#copyMode [data-cm="ids"]'); await p.click('#mSave'); await p.waitForTimeout(400);
  const sv=await p.evaluate(()=>{ const T=window.__tally; return { p1:T.state.sections['period-1'].threshold, p2:T.state.sections['period-2'].threshold, cm:T.state.settings.copyMode }; });
  check(sv.p1===70 && sv.p2===60 && sv.cm==='ids','Save: the goal changed for this class only, the copy format for all of Tally: '+JSON.stringify(sv));
  // 5. one class: no picker, just its name
  await p.evaluate(()=>{ const T=window.__tally; delete T.state.sections['period-2']; T.state.order=['period-1']; T.state.active='period-1'; T.save(); T.render(); });
  await more(p,'#btnSettings'); await p.waitForTimeout(300);
  check(await p.locator('#setClass').count()===0 && /1st Period · Accelerated/.test(await p.textContent('.scopeHead')),'with one class there is no picker — the heading names the class');
  await p.keyboard.press('Escape');
  // 6. fits a Windows laptop at 150 % scale without the footer leaving the screen
  await p.setViewportSize({width:1280,height:720}); await more(p,'#btnSettings'); await p.waitForTimeout(300);
  check(await p.evaluate(()=>{ const f=document.querySelector('#modal footer').getBoundingClientRect(); const h=document.querySelector('#modal header').getBoundingClientRect(); return f.bottom<=innerHeight && h.top>=0 && document.documentElement.scrollWidth<=innerWidth+1; }),'1280×720: the title and the Save / Cancel row are both on screen');
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
