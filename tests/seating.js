// Seating: room editor (templates, desks), solver + options, moves with consequences, locks, save/reload, live
// standing from Focus + IXL, student sheet, print copies, Names-off masking, and import of the standalone Seating
// Chart's JSON backup (photos, FAST scores, flags, room, saved chart) matched onto Tally's rosters.
const { chromium, fs, path, exe, check, done, tmp } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve('Tally.html'));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await p.click('[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(800); if (await p.locator('#askSave').count()) { await p.click('#askSave'); await p.waitForTimeout(300); } }
  const K='period-1';
  // 1. seating view opens; no desks → notice; room editor with a template
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(400);
  check(await p.locator('.seat').count()===1 && /No desks yet/.test(await p.textContent('.seatSide')),'Seating opens from the class bar and asks for a room first');
  await p.click('#seatSub [data-sub="room"]'); await p.waitForTimeout(300); await p.click('#rmTpl'); await p.waitForTimeout(300); await p.fill('#tplN','24'); await p.click('[data-tpl="pairs"]'); await p.waitForTimeout(500);
  const room=await p.evaluate(()=>{ const r=window.__tally.state.room; return {n:r.desks.length, ids:new Set(r.desks.map(d=>d.id)).size, front:r.front}; });
  check(room.n===24 && room.ids===24 && room.front==='top','Partners template lays out 24 desks with unique ids');
  await p.click('#rmDesk'); await p.waitForTimeout(300); check(await p.evaluate(()=>window.__tally.state.room.desks.length)===25 && await p.locator('.selbar').count()===1,'+ Desk adds one and selects it');
  await p.click('#rmDel'); await p.waitForTimeout(300); check(await p.evaluate(()=>window.__tally.state.room.desks.length)===24,'delete removes the selected desk');
  await p.click('#rmRow'); await p.waitForTimeout(200); await p.fill('[data-f="n"]','4'); await p.click('#askOk'); await p.waitForTimeout(300); check(await p.evaluate(()=>window.__tally.state.room.desks.length)===28,'+ Row asks in a dialog (no prompt()) and adds the row');
  await p.click('#rmUndo'); await p.waitForTimeout(300); check(await p.evaluate(()=>window.__tally.state.room.desks.length)===24,'room undo');
  // drag a desk with the pointer
  const before=await p.evaluate(()=>({...window.__tally.state.room.desks[0]}));
  const box=await p.locator('.g-desk').first().boundingBox(); await p.mouse.move(box.x+box.width/2, box.y+box.height/2); await p.mouse.down(); await p.mouse.move(box.x+box.width/2+60, box.y+box.height/2+40,{steps:6}); await p.mouse.up(); await p.waitForTimeout(300);
  const after=await p.evaluate(()=>({...window.__tally.state.room.desks[0]})); check(after.x!==before.x || after.y!==before.y,'dragging a desk moves it (snapped to the grid): '+JSON.stringify([before.x,before.y,after.x,after.y]));
  await p.reload(); await p.waitForTimeout(700); check(await p.evaluate(()=>window.__tally.state.room.desks.length)===24,'the room survives a reload');
  // 2. live standing: FAST absent, so Focus rank + IXL rank
  const st=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const stu=T.seatStudents(s); return { n:stu.length, withStanding:stu.filter(x=>x.standing!=null).length, sample:stu.slice(0,3).map(x=>[x.grade!=null, x.ixlPct!=null, x.standing]) }; }, K);
  check(st.n>=20 && st.withStanding===st.n && st.sample.every(x=>x[0]&&x[1]&&x[2]>=0&&x[2]<=100),'every roster student has a standing blended from Focus grade rank and IXL rank: '+JSON.stringify(st.sample));
  // 3. generate → options, fit, chart; pick; swap with consequences; lock; save; reload
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(400);
  await p.click('#seatGen'); await p.waitForFunction(()=>document.querySelectorAll('.cand button').length>0,{timeout:20000}); await p.waitForTimeout(400);
  const nOpt=await p.locator('.cand button').count(); const fit=+(await p.textContent('.fit .n'));
  check(nOpt>=1 && nOpt<=4 && fit>0 && await p.locator('.cdesk .cname').count()>=20,'solver returns options; the chart seats everyone: options='+nOpt+' fit='+fit);
  await p.locator('.cand button').nth(nOpt-1).click(); await p.waitForTimeout(300); check(await p.locator('.cand button.on').count()===1,'picking an option marks it');
  const seatsBefore=await p.evaluate(K=>JSON.stringify(window.__tally.seatWork[K].seats), K);
  await p.locator('.cdesk').nth(0).click(); await p.waitForTimeout(300); check(await p.locator('.seatWhy').count()===1 && /Row \d of \d/.test(await p.textContent('.seatWhy')),'tapping a seated student shows why they are there');
  await p.locator('.cdesk').nth(5).click(); await p.waitForTimeout(300);
  const seatsAfter=await p.evaluate(K=>JSON.stringify(window.__tally.seatWork[K].seats), K);
  check(seatsAfter!==seatsBefore && /Swapped|Moved/.test(await p.textContent('#seatMove')) && /fit \d+ → \d+/.test(await p.textContent('#seatMove')),'second tap swaps and reports the consequences');
  await p.click('#seatUndo'); await p.waitForTimeout(300); check(await p.evaluate(K=>JSON.stringify(window.__tally.seatWork[K].seats), K)===seatsBefore,'undo restores the swap');
  await p.locator('.cdesk').nth(0).click(); await p.waitForTimeout(200); await p.click('[data-lock]'); await p.waitForTimeout(300);
  const locked=await p.evaluate(K=>Object.keys(window.__tally.seatWork[K].locks).length, K); check(locked===1 && (await p.textContent('#seatGen')).includes('keeping 1 locked'),'lock a seat; Generate says it keeps it');
  const fitPre=+(await p.textContent('.fit .n')); await p.click('#seatSave'); await p.waitForTimeout(400);
  const saved=await p.evaluate(K=>{ const s=window.__tally.state.sections[K].seating; return s && Object.keys(s.seats).length; }, K); check(saved>=20,'saved chart stored on the class: '+saved);
  await p.reload(); await p.waitForTimeout(700); await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(400);
  check(await p.locator('.cdesk .cname').count()>=20 && /saved/.test(await p.textContent('#bar')),'saved chart comes back after a reload');
  const fitPost=+(await p.textContent('.fit .n')); check(Math.abs(fitPost-fitPre)<=8 && fitPost>0,'saving does not collapse the fit (not scored against itself as previous partners): '+fitPre+' → '+fitPost);
  // 4. student sheet: flags, keep-apart symmetric, exclusive with seat-near
  await p.locator('.seatStu').first().click(); await p.waitForTimeout(300);
  const me=await p.evaluate(K=>window.__tally.seatStudents(window.__tally.state.sections[K])[0].display, K);
  await p.click('[data-beh="high"]'); await p.click('[data-flag="front"]'); await p.locator('[data-rel^="apart|"]').first().click(); await p.waitForTimeout(100);
  const tid=await p.locator('[data-rel^="apart|"]').first().getAttribute('data-rel'); const other=await p.evaluate(([K,i])=>window.__tally.seatStudents(window.__tally.state.sections[K])[i].display, [K,+tid.split('|')[1]]);
  await p.click('#mCancel'); await p.waitForTimeout(400);
  const rel=await p.evaluate(([K,me,other])=>{ const s=window.__tally.state.sections[K]; return { mine:s.seatInfo[me], theirs:s.seatInfo[other] }; }, [K,me,other]);
  check(rel.mine.behavior==='high' && rel.mine.front===true && rel.mine.apart.includes(other) && rel.theirs.apart.includes(me),'sheet saves behavior, flag and a symmetric keep-apart');
  check(await p.locator('.seatStu').first().locator('i.hot').count()===1,'roster row shows the H tag');
  // 5. Names off masks the chart and the list
  await p.click('#btnHide'); await p.waitForTimeout(400);
  const txt=await p.textContent('#gridwrap'); check(!txt.includes(me.split(',')[0]) && /[A-Z]\. [A-Z]\./.test(txt),'Names off: chart and list show initials only');
  await p.click('#btnHide'); await p.waitForTimeout(300);
  // 6. print copies
  await p.click('#seatPrint'); await p.waitForTimeout(200); check(await p.locator('[data-pm="teacher"]').count()===1 && await p.locator('[data-pm="safe"]').count()===1,'print offers teacher and student/sub copies');
  const [pop]=await Promise.all([ctx.waitForEvent('page'), p.click('[data-pm="safe"]')]); await pop.waitForLoadState(); await pop.waitForTimeout(300);
  const ptxt=await pop.textContent('body'); check(await pop.locator('.chartSvg').count()===1 && !/L\d|🔒/.test(ptxt) && !(await pop.locator('circle').count()),'sub copy has no level dots, behavior dots or locks'); await pop.close();
  // 7. import the standalone Seating Chart's backup: photos shrink, FAST comes in, relations and the saved chart map onto Tally's roster
  const names=await p.evaluate(K=>window.__tally.seatStudents(window.__tally.state.sections[K]).map(x=>x.display), K);
  const png1=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
  const photo='data:image/png;base64,'+png1.toString('base64');
  const v8={v:1,periods:[{id:'p1',sectionId:'1205050-7T1A',name:'Period 1',course:'M/J ACCEL MATH GR 7',room:'WHM07'},{id:'p9',sectionId:'1205050-7T9A',name:'Period 9',course:'x',room:'y'}],
    students:names.slice(0,5).map((n,i)=>{ const m=n.match(/^([^,]+),\s*(\S+)/); return {id:'s'+i,periodId:'p1',raw:n,last:m[1],first:m[2],middle:'',nick:i===0?'Gee':'',level:1+i,pct:10+i*20,scale:250+i,photo:i<2?photo:null,behavior:i===1?'high':'low',front:i===2,nearTeacher:false,plan:i===3?'504':'',accom:i===3?'front row':'',apart:i===0?['s1']:i===1?['s0']:[],together:i===2?['s3']:i===3?['s2']:[],notes:'',active:true}; }).concat([{id:'zz',periodId:'p9',raw:'NOBODY, ZED',last:'NOBODY',first:'ZED',middle:'',nick:'',level:null,pct:null,scale:null,photo:null,behavior:'low',front:false,nearTeacher:false,plan:'',accom:'',apart:[],together:[],notes:'',active:true}]),
    ap:'p1',layout:{w:900,h:600,front:'top',desks:[{id:'dA',x:100,y:100,r:0},{id:'dB',x:170,y:100,r:0}],deskSize:70,teacher:{x:740,y:500,w:130,h:64},door:{x:20,y:560}},charts:{p1:{seats:{dA:'s0',dB:'s1'},locks:{},savedAt:'2026-09-12T00:00:00.000Z'}},weights:{behavior:10}};
  const jp=path.join(tmp,'seating-backup.json'); fs.writeFileSync(jp, JSON.stringify(v8));
  await p.setInputFiles('#file',[jp]); await p.waitForTimeout(1200);
  const imp=await p.evaluate(([K,names])=>{ const s=window.__tally.state.sections[K]; const a=s.seatInfo[names[0]], b=s.seatInfo[names[1]], c=s.seatInfo[names[2]], d=s.seatInfo[names[3]]; return { nick:a.nick, pct:a.pct, level:b.level, photo:a.photo, photoLen:(a.photo||'').length, apart:a.apart.includes(names[1]) && b.apart.includes(names[0]), together:c.together.includes(names[3]) && d.together.includes(names[2]), plan:d.plan, accom:d.accom, beh:b.behavior, front:c.front, w:window.__tally.state.seatWeights.behavior, room:window.__tally.state.room.desks.length, toast:document.querySelector('#toast').textContent }; }, [K,names]);
  check(imp.nick==='Gee' && imp.pct===10 && imp.level===2 && imp.beh==='high' && imp.front===true && imp.plan==='504' && imp.accom==='front row','backup fields land on the matching roster students (nick, FAST, behavior, flag, plan)');
  check(imp.apart && imp.together,'keep-apart and seat-near links are remapped to Tally names, both directions');
  check(/^data:image\/jpeg/.test(imp.photo) && imp.photoLen<6000,'photos are re-encoded small: '+imp.photoLen+' chars');
  check(imp.w===10 && imp.room===24,'weights come in; the existing room is kept (the backup\'s two desks are not forced over it)');
  check(/5 students matched/.test(imp.toast) && /1 not matched/.test(imp.toast),'toast reports matched and unmatched: '+imp.toast.slice(0,120));
  const st2=await p.evaluate(K=>window.__tally.seatStudents(window.__tally.state.sections[K])[0], K);
  check(st2.pct===10 && st2.standing!=null && st2.standing<st2.gradeRank+1 || st2.standing<=50,'FAST percentile now blends into the standing: '+JSON.stringify([st2.pct,st2.gradeRank,st2.ixlRank,st2.standing]));
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(400);
  check(await p.locator('.seatStu .ph img').count()===2,'imported photos show on the student list');
  // a Tally backup dropped here is refused with a pointer to Settings
  const tb=path.join(tmp,'tally-backup.json'); fs.writeFileSync(tb, JSON.stringify({tally:4,sections:{}}));
  await p.setInputFiles('#file',[tb]); await p.waitForTimeout(600); check(/Tally backup/.test(await p.textContent('#toast')),'a Tally backup on the drop zone is redirected to Settings');
  // 8. backup round-trip carries room, weights, seating and seatInfo
  await p.click('#btnSettings'); await p.waitForTimeout(200);
  const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#exportCfg')]); const cfg=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
  check(cfg.room && cfg.room.desks.length===24 && cfg.seatWeights.behavior===10 && cfg.sections[K].seating && Object.keys(cfg.sections[K].seatInfo).length>=5,'Tally backup carries the room, weights, saved chart and seating info');
  await p.keyboard.press('Escape');
  // 9. round-4 regressions
  // fit does not collapse after Save (the saved chart is not scored against itself as "previous partners")
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(400);
  // options belong to one class: period 2 shows none of period 1's
  await p.click('#seatGen'); await p.waitForFunction(()=>document.querySelectorAll('.cand button').length>0,{timeout:20000}); await p.waitForTimeout(300);
  await p.click('[data-k="period-2"]'); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(400);
  check(await p.locator('.cand button').count()===0 && await p.locator('.seatWhy').count()===0,'switching classes shows no other class\'s options or selection');
  // Generate then leave: nothing paints over the Overview
  await p.click('#seatGen'); await p.waitForTimeout(150); await p.click('#btnHome'); await p.waitForTimeout(2200);
  check(await p.locator('#gridwrap .home').count()===1 && await p.locator('.seat').count()===0,'leaving mid-solve aborts it; the Overview stays');
  // a withdrawn student is freed from the saved chart, no ghost
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const lines=s.roster.split('\n'); s.roster=lines.slice(1).join('\n'); T.save(); }, K);
  await p.reload(); await p.waitForTimeout(700); await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(500);
  const ghost=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const names=new Set(T.seatStudents(s).map(x=>x.id)); return Object.values(s.seating.seats).filter(n=>!names.has(n)).length; }, K);
  check(ghost===0 && /seat freed/.test(await p.textContent('#toast')),'a student who left the roster is unseated with a notice');
  // clear desks then chart: no throw, chart view still renders
  await p.click('#seatSub [data-sub="room"]'); await p.waitForTimeout(300); await p.click('#rmClear'); await p.waitForTimeout(200); await p.click('#cfOk'); await p.waitForTimeout(300);
  await p.click('#seatSub [data-sub="chart"]'); await p.waitForTimeout(300); check(await p.locator('.seat').count()===1 && /No desks yet/.test(await p.textContent('.seatSide')),'zero desks → the chart view renders its notice, no crash');
  await p.click('#rmUndo').catch(()=>{}); await p.click('#seatSub [data-sub="room"]'); await p.waitForTimeout(200); await p.click('#rmUndo'); await p.waitForTimeout(300);
  check(await p.evaluate(()=>window.__tally.state.room.desks.length)===24,'room undo brings the desks back');
  // seat by hand with more students than desks
  await p.evaluate(()=>{ const T=window.__tally; T.state.room.desks=T.state.room.desks.slice(0,10); T.save(); });
  await p.click('#seatSub [data-sub="chart"]'); await p.waitForTimeout(300);
  check(await p.locator('#seatGen').isDisabled() && (await p.locator('#seatHand').count()===1 || await p.locator('[data-unseated]').count()>0),'more students than desks: Generate is off but hand seating is offered');
  if (await p.locator('#seatHand').count()) { await p.click('#seatHand'); await p.waitForTimeout(300); }
  await p.evaluate(K=>{ const T=window.__tally; const w=T.seatWork[K]; if (w) { w.seats={}; } T.render(); }, K); await p.waitForTimeout(300);
  await p.locator('[data-unseated]').first().click(); await p.waitForTimeout(200); await p.locator('.cdesk').first().click(); await p.waitForTimeout(300);
  check(await p.evaluate(K=>Object.keys(window.__tally.seatWork[K].seats).length, K)===1,'tap a name, tap a desk → seated by hand');
  // XSS-shaped import values are neutralised
  const cur0=await p.evaluate(K=>window.__tally.seatStudents(window.__tally.state.sections[K])[0].display, K);
  const evil={v:1,periods:[{id:'p1',sectionId:'1205050-7T1A',name:'Period 1'}],students:[{id:'e1',periodId:'p1',raw:cur0,last:'x',first:'y',level:'<img src=x onerror=window.__pwn=1>',pct:'1e9',photo:'http://127.0.0.1:9/x.jpg',nick:'<b>bold</b>',behavior:'high'}],layout:{w:'</svg><script>window.__pwn2=1</script>',h:600,front:'top',desks:[{id:'"><img src=x onerror=window.__pwn3=1>',x:'1e9',y:0}]},charts:{},weights:{behavior:'99'}};
  const ep=path.join(tmp,'evil.json'); fs.writeFileSync(ep, JSON.stringify(evil)); await p.setInputFiles('#file',[ep]); await p.waitForTimeout(800);
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(400);
  const pwn=await p.evaluate(([K,n])=>{ const T=window.__tally; const i=T.state.sections[K].seatInfo; const a=i[n]; return { p1:!!window.__pwn, p2:!!window.__pwn2, p3:!!window.__pwn3, level:a.level, pct:a.pct, photo:a.photo, w:T.state.seatWeights.behavior, ids:T.state.room.desks.every(d=>/^[\w-]+$/.test(d.id)) }; }, [K,cur0]);
  check(!pwn.p1 && !pwn.p2 && !pwn.p3 && pwn.level===null && pwn.pct===100 && pwn.w===10 && pwn.ids && (pwn.photo==null || /^data:image\/jpeg/.test(pwn.photo)),'malicious backup values are coerced; nothing executes; no http photo stored: '+JSON.stringify({level:pwn.level,pct:pwn.pct,w:pwn.w}));
  check(!/<b>bold/.test(await p.evaluate(()=>document.querySelector('.seatList').innerHTML)) || /&lt;b&gt;/.test(await p.evaluate(()=>document.querySelector('.seatList').innerHTML)),'nick is escaped on the list');
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
