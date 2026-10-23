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
  check(top<=120,'the header is one slim row and the search: '+Math.round(top)+'px');
  const bar=await p.evaluate(()=>{ const n=document.querySelector('#nav').getBoundingClientRect(), i=document.querySelector('#btnImport').getBoundingClientRect(); return { nb:Math.round(n.bottom), nh:Math.round(n.height), ib:Math.round(i.bottom), it:Math.round(i.top), pos:getComputedStyle(document.querySelector('#nav')).position }; });
  check(bar.pos==='fixed' && bar.nb===844 && bar.ib<=844 && bar.it>=844-bar.nh,'Classes, Students, Board and Import sit in a tab bar at the bottom: '+JSON.stringify(bar));
  const inputs=await p.evaluate(()=>[...document.querySelectorAll('input,select')].filter(e=>e.offsetParent).every(e=>parseFloat(getComputedStyle(e).fontSize)>=16));
  check(inputs,'every text box and menu is 16px, so an iPhone doesn\'t zoom in when one is tapped');
  const ch=await p.evaluate(()=>[...document.querySelectorAll('#gridwrap svg.chart')].map(s=>s.viewBox.baseVal.width));
  check(ch.length>0 && ch.every(w=>w<=380),'Overview charts are drawn at phone width, so their text stays readable: '+ch.join(', '));
  const scroller=await p.evaluate(()=>{ window.scrollTo(0,400); return window.scrollY>0 && document.querySelector('#top').getBoundingClientRect().bottom<0; });
  check(scroller,'the page itself scrolls, and the header scrolls away');
  await p.evaluate(()=>window.scrollTo(0,0));

  await p.click('.hcard'); await p.waitForTimeout(300); await fits('Class grid');
  const nameOk=await p.evaluate(()=>[...document.querySelectorAll('table.grid td.stu')].slice(0,6).every(td=>{ const n=td.querySelector('.nm'); return !n || n.getBoundingClientRect().width>60; }));
  check(nameOk,'every name in the grid is visible, even with a "not in IXL" tag');
  await p.click('#openGrades'); await p.waitForTimeout(300); await fits('Grades');
  const tb=await p.evaluate(()=>[...document.querySelectorAll('#gridwrap table.checkTable')].map(t=>({ cards:t.classList.contains('asCards'), fits:t.getBoundingClientRect().width<=t.parentElement.clientWidth+2 })));
  check(tb.length>=3 && tb.every(t=>t.fits) && tb.some(t=>t.cards),'Grades: every table fits; the wide ones are cards ('+tb.filter(t=>t.cards).length+' of '+tb.length+')');
  const asg=await p.evaluate(()=>{ const td=document.querySelector('.gasg.asCards tbody tr td:nth-child(3)'); return td && td.dataset.l; });
  check(asg==='Due','a card labels each value with its column ("Due")');

  await p.click('#btnStudents'); await p.waitForTimeout(300); await fits('Students');
  const card=await p.evaluate(()=>{ const tr=document.querySelector('.sdir tr[data-open]'); const r=tr.getBoundingClientRect(); return { disp:getComputedStyle(tr).display, w:r.width, head:getComputedStyle(document.querySelector('.sdir thead')).display, name:tr.querySelector('.nm').getBoundingClientRect().width }; });
  check(card.disp==='flex' && card.head==='none' && card.w<=380 && card.name>80,'Students is a list of cards with the name first: '+JSON.stringify(card));
  await p.click('.sdir tr[data-open]'); await p.waitForTimeout(400); await fits('Student page');
  const sp=await p.evaluate(()=>[...document.querySelectorAll('#gridwrap table.checkTable')].every(t=>t.getBoundingClientRect().width<=t.parentElement.clientWidth+2));
  check(sp,'the student page has no table wider than its box (the what-ifs are cards)');

  await p.click('#pConf'); await p.waitForTimeout(400);
  const dlg=await p.evaluate(()=>{ const r=document.querySelector('#modal .panel').getBoundingClientRect(); return [r.width,r.height]; });
  check(dlg[0]>=388 && dlg[1]>=840,'a dialog fills the screen: '+dlg.map(Math.round).join('×'));
  await p.click('#mClose'); await p.waitForTimeout(200);
  await more(p,'#btnSettings'); await p.waitForTimeout(300); await fits('Settings'); await p.click('#mCancel'); await p.waitForTimeout(200);

  await p.click('#btnLb'); await p.waitForTimeout(500);
  const tools=await p.evaluate(()=>{ const t=document.querySelector('.lbTools'); const r=t.getBoundingClientRect(); const ex=document.querySelector('#lbExit').getBoundingClientRect(); return { h:Math.round(r.height), bottom:Math.round(r.bottom), exit:ex.right<=390 && ex.bottom<=844 && ex.width>0 }; });
  check(tools.bottom<=844 && tools.h<=70 && tools.exit,'the Board\'s controls are one short row at the bottom with Hold to exit on screen: '+JSON.stringify(tools));
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.lbTab='lab'; T.save(); T.render(); }); await p.waitForTimeout(400);
  await p.click('#lbOpts'); await p.waitForTimeout(200);
  const opened=await p.evaluate(()=>{ const u=document.querySelector('#labUnit'); const r=u&&u.getBoundingClientRect(); return !!r && r.width>200 && r.right<=390; });
  check(opened,'Options opens the Data Lab controls, each fitting the screen (the data-set menu full width)');
  await p.click('#lbOpts'); await p.waitForTimeout(200);
  const lab=await p.evaluate(()=>{ const t=document.querySelector('.lbTools').getBoundingClientRect(); const c=document.querySelector('.lbWrap svg'); return { tb:t.bottom, cw:c?c.getBoundingClientRect().width:0 }; });
  check(lab.tb<=844 && lab.cw>=320,'Data Lab: the chart is the width of the screen and the controls are on it: '+JSON.stringify(lab));

  // a phone on its side
  const q=await (await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true})).newPage(); q.on('pageerror',e=>errs.push(e.message)); q.on('dialog',d=>d.accept());
  await q.goto('file://'+path.resolve(APP)); await q.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await q.waitForTimeout(500); await q.click('#rpSkip').catch(()=>{}); await q.waitForTimeout(300);
  const land=await q.evaluate(()=>({ sw:document.documentElement.scrollWidth, top:document.querySelector('#top').getBoundingClientRect().height, bar:document.querySelector('#nav').getBoundingClientRect().height }));
  check(land.sw<=844 && land.top<=80 && land.bar<=56,'on its side: a one-row header and a thin tab bar: '+JSON.stringify(land));
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
