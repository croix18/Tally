// A phone (390 × 844, touch): the page scrolls, nothing is wider than the screen, the header is compact, the Students
// list is cards, dialogs fill the screen and the Board's controls stay reachable. (Croix, 23 Oct 2026: "it's terrible
// for mobile".)
const { chromium, fs, path, exe, check, done, APP, pick, more } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const fits=async name=>{ const w=await p.evaluate(()=>document.documentElement.scrollWidth); check(w<=390, name+': nothing wider than the screen ('+w+'px)'); };

  await p.click('#btnHome'); await p.waitForTimeout(300); await fits('Overview');
  const top=await p.evaluate(()=>document.querySelector('#top').getBoundingClientRect().height);
  check(top<=170,'the header is compact: '+Math.round(top)+'px');
  const scroller=await p.evaluate(()=>{ window.scrollTo(0,400); return window.scrollY>0 && document.querySelector('#top').getBoundingClientRect().bottom<0; });
  check(scroller,'the page itself scrolls, and the header scrolls away');
  await p.evaluate(()=>window.scrollTo(0,0));

  await p.click('.hcard'); await p.waitForTimeout(300); await fits('Class grid');
  const nameOk=await p.evaluate(()=>[...document.querySelectorAll('table.grid td.stu')].slice(0,6).every(td=>{ const n=td.querySelector('.nm'); return !n || n.getBoundingClientRect().width>60; }));
  check(nameOk,'every name in the grid is visible, even with a "not in IXL" tag');
  await p.click('#openGrades'); await p.waitForTimeout(300); await fits('Grades');

  await p.click('#btnStudents'); await p.waitForTimeout(300); await fits('Students');
  const card=await p.evaluate(()=>{ const tr=document.querySelector('.sdir tr[data-open]'); const r=tr.getBoundingClientRect(); return { disp:getComputedStyle(tr).display, w:r.width, head:getComputedStyle(document.querySelector('.sdir thead')).display, name:tr.querySelector('.nm').getBoundingClientRect().width }; });
  check(card.disp==='flex' && card.head==='none' && card.w<=380 && card.name>80,'Students is a list of cards with the name first: '+JSON.stringify(card));
  await p.click('.sdir tr[data-open]'); await p.waitForTimeout(400); await fits('Student page');

  await p.click('#pConf'); await p.waitForTimeout(400);
  const dlg=await p.evaluate(()=>{ const r=document.querySelector('#modal .panel').getBoundingClientRect(); return [r.width,r.height]; });
  check(dlg[0]>=388 && dlg[1]>=840,'a dialog fills the screen: '+dlg.map(Math.round).join('×'));
  await p.click('#mClose'); await p.waitForTimeout(200);
  await more(p,'#btnSettings'); await p.waitForTimeout(300); await fits('Settings'); await p.click('#mCancel'); await p.waitForTimeout(200);

  await p.click('#btnLb'); await p.waitForTimeout(500);
  const tools=await p.evaluate(()=>{ const t=document.querySelector('.lbTools'); const r=t.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, wrap:getComputedStyle(t).flexWrap, ex:!!document.querySelector('#lbExit') }; });
  check(tools.bottom<=844 && tools.wrap==='nowrap' && tools.ex,'the Board\'s controls are one row on the screen, Hold to exit included: '+JSON.stringify(tools));
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.lbTab='lab'; T.save(); T.render(); }); await p.waitForTimeout(400);
  const lab=await p.evaluate(()=>{ const t=document.querySelector('.lbTools').getBoundingClientRect(); const c=document.querySelector('.lbWrap svg'); return { tb:t.bottom, cw:c?c.getBoundingClientRect().width:0 }; });
  check(lab.tb<=844 && lab.cw>=320,'Data Lab: the chart is the width of the screen and the controls are on it: '+JSON.stringify(lab));

  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
