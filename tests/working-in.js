// "Working in" must never quietly change which units count. Each check here is a case an independent verifier broke
// on 4 Oct 2026 (review/verify-4oct.md): an older save losing a copied unit, a backup erasing the unit, Settings
// swallowing it, a toggled unit staying hidden for good. Synthetic fixtures only.
const { chromium, fs, path, exe, check, done, tmp, pick, more, APP } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1366,height:768},acceptDownloads:true}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  const P1=path.resolve('fixtures/focus_gradebook_pool_p1.csv');
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await pick(p,'[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(700); const a=await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(300); } }
  const K='period-1';
  const st=()=>p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; return { cur:T.state.settings.currentUnit, touched:T.state.settings.curUnitTouched, assigned:T.unitsOf(s).filter(u=>u.assigned).map(u=>u.num).join(), marks:JSON.stringify(T.state.assigned.acc) }; },K);
  const card=()=>p.evaluate(()=>{ const d=document.querySelector('.himport'); if (d && d.tagName==='DETAILS') d.open=true; return d ? d.textContent.replace(/\s+/g,' ') : ''; });
  const s0=await st(); check(s0.cur.acc===3 && s0.assigned==='1,2,3' && !s0.touched.acc,'start: accelerated works in Unit 3 (set by Tally, not picked): '+s0.assigned);

  // 1. An older save: no "Working in", Units 1–3 counting on the old rule, and Unit 5 already copied to Focus
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const u5=T.unitsOf(s).find(u=>u.num===5); s.receipts[u5.name]={ at:new Date().toISOString(), exportDate:s.date, goal:s.threshold, outOf:u5.total, skipped:[], rows:[] }; T.state.settings.currentUnit={ acc:null, on:null }; T.state.settings.curUnitTouched={ acc:false, on:false }; T.state.lastImport=null; T.save(); },K);
  await p.reload(); await p.waitForTimeout(900);
  const s1=await st();
  check(s1.cur.acc===3 && s1.assigned==='1,2,3,5','the save opens with Units 1–3 still counting, and Unit 5 — already copied to Focus — is kept as Assigned, not dropped: '+s1.assigned);
  await p.click('#btnHome'); await p.waitForTimeout(300);
  check(/Accelerated — Working in set to Unit 3[^.]*; Unit 5 was already copied to Focus and still counts/.test(await card()),'the Overview card says so and stays (a toast alone is gone in seconds): '+(await card()).match(/Accelerated — [^.]*\./));
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(400);
  check((await p.evaluate(()=>[...document.querySelectorAll('th.unit .t')].map(t=>t.textContent.trim()).join())).replace(/[^\d,]/g,'')==='1,2,3,5' && await p.locator('th.unit .rlink').count()===1,'Unit 5 is a column with its "copied" line');
  // …also when Tally reopens on the Board, where toasts never show
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.currentUnit={ acc:null, on:null }; T.state.settings.leaderboard=true; T.state.lastImport=null; T.save(); });
  await p.reload(); await p.waitForTimeout(900);
  const li=await p.evaluate(()=>JSON.stringify(window.__tally.state.lastImport)); check(/Working in set to Unit 3/.test(li) && await p.locator('body.lbMode').count()===1,'reopening on the Board: the unit is set and the note is waiting on the Overview');
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.leaderboard=false; T.save(); }); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const u5=T.unitsOf(s).find(u=>u.num===5); delete s.receipts[u5.name]; delete T.state.assigned.acc[u5.name]; T.save(); T.render(); },K);

  // 2. Focus gets an IXL column for a later unit: a unit Tally set follows it; a unit the teacher picked does not move
  const t=fs.readFileSync(P1,'utf8'); const u4=path.join(tmp,'p1_unit4.csv'); fs.writeFileSync(u4, t.replace('"Unit 1 IXL','"Unit 4 IXL'));
  check(t!==fs.readFileSync(u4,'utf8'),'(fixture: the gradebook\'s IXL column renamed to Unit 4)');
  await p.setInputFiles('#file',[u4]); await p.waitForTimeout(900);
  const s2=await st(); check(s2.cur.acc===4 && s2.assigned==='1,2,3,4','Focus now has a Unit 4 IXL column: Working in moves from 3 to 4 by itself: '+s2.assigned);
  await p.click('#btnHome'); await p.waitForTimeout(300); check(/Working in moved from Unit 3 to Unit 4 — the latest unit Focus has an IXL column for/.test(await card()),'…and the import card says it moved, and why');
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(300); await p.selectOption('#curUnit','2'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[u4]); await p.waitForTimeout(900);
  const s3=await st(); check(s3.cur.acc===2 && s3.touched.acc===true,'a unit picked on the class bar is never moved by an import, even when Focus is ahead of it: '+JSON.stringify(s3.cur));
  await p.setInputFiles('#file',[P1]); await p.waitForTimeout(900);

  // 3. A backup saved before any unit was picked must not erase this device's unit; a course it leaves empty gets one
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(300);
  await more(p,'#btnSettings'); await p.waitForTimeout(200); const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#exportCfg')]);
  const cfg=JSON.parse(fs.readFileSync(await dl.path(),'utf8')); cfg.settings.currentUnit={ acc:null, on:null }; cfg.settings.curUnitTouched={ acc:false, on:false }; const nul=path.join(tmp,'backup-null.json'); fs.writeFileSync(nul, JSON.stringify(cfg));
  await p.setInputFiles('#cfgFile',nul); await p.waitForTimeout(600);
  const s4=await st(); check(s4.cur.acc===2 && s4.cur.on===3 && s4.assigned==='1,2','loading a backup that has no Working in keeps the units this device had: '+JSON.stringify(s4.cur));
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.currentUnit={ acc:null, on:null }; T.state.settings.curUnitTouched={ acc:false, on:false }; T.save(); });
  await more(p,'#btnSettings'); await p.waitForTimeout(200); await p.setInputFiles('#cfgFile',nul); await p.waitForTimeout(600);
  const s5=await st(); check(s5.cur.acc===3 && s5.cur.on===3 && s5.assigned==='1,2,3' && /Working in set to Unit 3/.test(await p.textContent('#toast')),'…and when neither side has one, the load sets it and says so — no reload needed, nothing left counting nothing: '+s5.assigned);
  cfg.settings.currentUnit={ acc:5, on:4 }; const five=path.join(tmp,'backup-five.json'); fs.writeFileSync(five, JSON.stringify(cfg));
  await more(p,'#btnSettings'); await p.waitForTimeout(200); await p.setInputFiles('#cfgFile',five); await p.waitForTimeout(600);
  check((await st()).cur.acc===5,'a backup that does carry a unit still brings it (the laptop → tablet bridge)');
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.currentUnit={ acc:1, on:3 }; T.state.settings.curUnitTouched={ acc:true, on:false }; T.save(); T.render(); });

  // 4. Settings: raising "units not assigned at the start" past Working in must not leave the course counting nothing
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(300); await more(p,'#btnSettings'); await p.waitForTimeout(300);
  await p.locator('#skipFirst button, #skipFirst [data-v]').nth(1).click().catch(async()=>{ await p.selectOption('#skipFirst','1'); }); await p.click('#mSave'); await p.waitForTimeout(500);
  const s6=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const sel=document.querySelector('#curUnit'); return { skip:T.state.settings.skipFirst.acc, cur:T.state.settings.currentUnit.acc, assigned:T.unitsOf(s).filter(u=>u.assigned).map(u=>u.num).join(), shown:sel.options[sel.selectedIndex].textContent.trim(), value:sel.value, toast:document.querySelector('#toast').textContent }; },K);
  check(s6.skip===1 && s6.cur>1 && s6.assigned.length>0 && !s6.assigned.split(',').includes('1'),'Unit 1 becomes a review unit while the course was working in Unit 1: Working in is re-seated on a unit that counts ('+s6.cur+'; counting '+s6.assigned+')');
  check(s6.shown==='Unit '+s6.cur && s6.value===String(s6.cur) && /Working in set to Unit/.test(s6.toast),'the selector shows that unit as selected, and the Save toast says what happened: '+s6.shown);
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.skipFirst.acc=0; T.state.settings.currentUnit.acc=3; T.state.settings.curUnitTouched.acc=true; T.save(); T.render(); }); await p.waitForTimeout(200);

  // 5. A later unit toggled Assigned and back again returns to Ahead — it is not hidden for good
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(300); await p.click('#aheadBtn'); await p.waitForTimeout(150); await p.click('#aheadMenu button:nth-child(2)'); await p.waitForTimeout(300);
  await p.click('#hideUnit'); await p.waitForTimeout(200); const m1=(await st()).marks; await p.click('#hideUnit'); await p.waitForTimeout(200); const m2=(await st()).marks;
  check(/Unit 5[^"]*":true/.test(m1) && m2==='{}','Assigned → Not assigned on a later unit clears the mark instead of pinning it as unassigned: '+m2);
  await p.click('#back'); await p.waitForTimeout(300);
  check(/Units 4–17/.test(await p.textContent('th.ahead')) && await p.locator('#toggleAll').count()===0,'the unit is back under Ahead, with no "1 unassigned unit" left behind');
  await p.selectOption('#curUnit','6'); await p.waitForTimeout(400);
  check((await st()).assigned==='1,2,3,4,5,6' && /Units 1–6 count/.test(await p.textContent('#toast')),'…and it counts when the course reaches it: Units 1–6');
  // a unit deliberately marked Not assigned inside the range is named in the toast, and the Ahead header only claims what is under it
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.state.assigned.acc[T.unitsOf(s).find(u=>u.num===5).name]=false; T.state.assigned.acc[T.unitsOf(s).find(u=>u.num===9).name]=true; T.save(); T.render(); },K);
  await p.selectOption('#curUnit','7'); await p.waitForTimeout(400);
  check(/Units 1–7 count \(not Unit 5 — marked Not assigned\)/.test(await p.textContent('#toast')),'the toast names a unit in the range that is marked Not assigned: '+(await p.textContent('#toast')).slice(0,110));
  check(/9 later units/.test(await p.textContent('th.ahead')) && !/Units 8–17/.test(await p.textContent('th.ahead')),'with Unit 9 counted early the Ahead header says "9 later units", not a range that includes it: '+(await p.textContent('th.ahead .s')));
  await p.evaluate(()=>{ const T=window.__tally; T.state.assigned.acc={}; T.state.settings.currentUnit.acc=3; T.save(); T.render(); });

  // 6. a course made only of an export without names still gets a unit; a broken class can't blank the page at start-up
  const pure=await p.evaluate(()=>{ const T=window.__tally; const keepS=T.state.sections, keepO=T.state.order, keepC=JSON.stringify(T.state.settings.currentUnit), keepT=JSON.stringify(T.state.settings.curUnitTouched);
    const mk=o=>Object.assign({ key:'x', label:'x', date:'2026-09-26', importedAt:'2026-09-26T12:00:00.000Z', prep:'acc', threshold:60, excluded:{}, studentSkips:{}, ignored:{}, aliases:{}, roster:'', history:[], receipts:{}, best:{}, students:['A','B','C','D'], skills:['Unit 1 A','Unit 2 B'].map((u,i)=>({ unit:u, name:'s'+i, id:'i'+i, lesson:'' })), scores:[[90,90,null,null],[null,null,null,null]] }, o);
    T.state.sections={ x:mk({ placeholder:true }) }; T.state.order=['x']; T.state.settings.currentUnit={ acc:null, on:null }; T.state.settings.curUnitTouched={ acc:false, on:false };
    const ph=T.defaultWorkingIn().map(x=>x.unit+':'+x.why).join();
    T.state.sections=keepS; T.state.order=keepO; T.state.settings.currentUnit=JSON.parse(keepC); T.state.settings.curUnitTouched=JSON.parse(keepT); return { ph }; });
  check(pure.ph==='1:started','a class imported without names (placeholder) still gets a Working in: '+pure.ph);
  await p.evaluate(()=>{ const T=window.__tally; const s=T.state.sections['period-1']; T.state.settings.currentUnit={ acc:null, on:null }; T.save(); const raw=JSON.parse(localStorage.getItem('tally.v1')); raw.sections['period-1'].importedAt=undefined; raw.sections['period-1'].date=undefined; localStorage.setItem('tally.v1', JSON.stringify(raw)); });
  await p.reload(); await p.waitForTimeout(900);
  check(await p.locator('#tabs .tab').count()===2 && await p.locator('#app:not(.hidden)').count()===1,'a class with no dates cannot blank the page at start-up: the app still opens');
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
