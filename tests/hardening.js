// Round-3 hardening: numbers that must not drift (snapshots vs skips, class average, neededOn, plural, duplicate
// skill rows, "nearly all"), pool/storage edges (same-name pool students, empty roster, old backups, old saves),
// and the touch/keyboard manners (menu overlay, dialog focus, undo toast).
const { chromium, fs, path, exe, check, done, tmp } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve('Tally.html'));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await p.click('[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(800); if (await p.locator('#askSave').count()) { await p.click('#askSave'); await p.waitForTimeout(300); } }
  const K='period-1';
  // 1. plural
  const pl=await p.evaluate(()=>{ const T=window.__tally; return [1,2].map(n=>[n]); });
  const plText=await p.evaluate(()=>{ const s=window.__tally.state; return document.body.innerHTML.includes('classs'); });
  check(!plText,'no "classs" anywhere on the page');
  // 2. snapshots carry per-unit counts; a skill skip re-snapshots so an identical re-import shows no phantom drop
  const snap0=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const h=s.history[s.history.length-1]; return {pu:!!h.pu, ua:!!h.ua, units:Object.keys(h.pu||{}).length, per:Object.values(h.per).reduce((a,b)=>a+b,0)}; }, K);
  check(snap0.pu && snap0.ua && snap0.units>10,'snapshot stores per-unit counts and each unit\'s counted-skill total: '+JSON.stringify(snap0));
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const cur=s.history[s.history.length-1]; s.history=[{...JSON.parse(JSON.stringify(cur)),date:'2026-09-19'},cur]; T.save(); T.render(); }, K);
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('th.unit .ulink'); await p.waitForTimeout(300);
  await p.click('th.skill button[data-x]'); await p.waitForTimeout(400);
  const mv=await p.evaluate(K=>{ const T=window.__tally; const d=T.leaderboardData().find(r=>r.key===K); const s=T.state.sections[K]; const cur=s.history[s.history.length-1], prev=s.history[0]; return {gain:d.gain, basis:d.basisChanged, thr:d.thrChanged, curUa:Object.values(cur.ua).reduce((a,b)=>a+b,0), prevUa:Object.values(prev.ua).reduce((a,b)=>a+b,0)}; }, K);
  check(mv.curUa===mv.prevUa-1 && mv.basis===true && mv.gain==null,'a course-wide skip re-snapshots today and flags the older snapshot as a different basis (no −0.1 phantom): '+JSON.stringify(mv));
  await p.click('th.skill button[data-x]'); await p.waitForTimeout(400);
  const mv2=await p.evaluate(K=>{ const T=window.__tally; const d=T.leaderboardData().find(r=>r.key===K); return {gain:d.gain, basis:d.basisChanged}; }, K);
  check(mv2.basis===false && mv2.gain===0,'un-skipping restores the basis and the identical re-import reads +0.0: '+JSON.stringify(mv2));
  // 3. advancing "Working in" does not reset movement (per-unit counts are re-read on today's assigned units)
  await p.click('#back').catch(()=>{}); await p.waitForTimeout(200);
  const adv=await p.evaluate(K=>{ const T=window.__tally; T.state.settings.currentUnit.acc=3; T.save(); T.render(); const d=T.leaderboardData().find(r=>r.key===K); return {gain:d.gain, basis:d.basisChanged, units:d.assignedUnits.length}; }, K);
  check(adv.basis===false && adv.gain===0 && adv.units===3,'moving Working in to Unit 3 keeps the comparison (3 assigned units, +0.0, no reset): '+JSON.stringify(adv));
  // 4. per-student skip re-snapshots and offers Undo
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('th.unit .ulink'); await p.waitForTimeout(300);
  const before=await p.evaluate(K=>{ const s=window.__tally.state.sections[K]; return JSON.stringify(s.history[s.history.length-1].per); }, K);
  await p.click('tbody tr:first-child td.sc.pass[data-cell]'); await p.waitForTimeout(300);
  check(await p.locator('#toast.show #undoCell').count()===1,'per-student skip toast has an Undo button');
  const mid=await p.evaluate(K=>{ const s=window.__tally.state.sections[K]; return JSON.stringify(s.history[s.history.length-1].per); }, K);
  await p.click('#undoCell'); await p.waitForTimeout(300);
  const after=await p.evaluate(K=>{ const s=window.__tally.state.sections[K]; return {per:JSON.stringify(s.history[s.history.length-1].per), skips:Object.keys(s.studentSkips).length}; }, K);
  check(mid!==before && after.per===before && after.skips===0,'skip re-snapshots (total drops), Undo restores it');
  // 5. class average = mean of rounded grades (what Focus shows), same on Overview, Grades and digest
  const avg=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const g=T.gradeAll(s).map(r=>r&&r.rounded).filter(v=>v!=null); return {ca:T.classAverage(s), mean:g.reduce((a,b)=>a+b,0)/g.length}; }, K);
  check(Math.abs(avg.ca-avg.mean)<1e-9,'classAverage is the mean of rounded grades: '+avg.ca.toFixed(3));
  // 6. neededOn: half-point grid, 0 when already there, never overstates
  const need=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gs=T.gradeAll(s); const out=[]; gs.forEach((g,i)=>{ if(!g) return; [70,80,90].forEach(t=>{ const n=T.neededOn(s,i,'Assessments',20,t); if(n==null) return; const at=T.withNext(s,i,'Assessments',20,n).rounded; const below=n>0?T.withNext(s,i,'Assessments',20,n-0.5).rounded:null; out.push({i,t,n,at,below,g:g.rounded}); }); }); return out; }, K);
  check(need.length>10 && need.every(x=>x.at>=x.t && (x.below==null || x.below<x.t) && x.n*2===Math.round(x.n*2)),'neededOn is the least half-point that reaches the target across the class ('+need.length+' cases)');
  const zero=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gs=T.gradeAll(s); let can=0, got=0; gs.forEach((g,i)=>{ if(!g) return; [70,80,90].forEach(t=>{ const w=T.withNext(s,i,'Assessments',20,0).rounded; if(w!=null && w>=t){ can++; if(T.neededOn(s,i,'Assessments',20,t)===0) got++; } }); }); return {can,got}; }, K);
  check(zero.can===zero.got,'whenever even a 0 keeps the target, neededOn says 0 (tested, not skipped): '+JSON.stringify(zero));
  // 7. duplicate (unit, id) skill rows collapse to one
  const dup=await p.evaluate(()=>{ const T=window.__tally; const g=T.state.pools.acc; const seen={}; let d=0; g.skills.forEach(sk=>{ const k=sk.unit+'|'+sk.id; if(seen[k]) d++; seen[k]=1; }); return {d, n:g.skills.length}; });
  check(dup.d===0 && dup.n===219,'no duplicate skill within a unit after parsing the real export (219 skills)');
  // 8. "nearly all" never shows with zero movers
  const lb=await p.evaluate(()=>{ const T=window.__tally; return T.leaderboardData().map(r=>({movers:r.movers,measured:r.measured,active:r.active})); });
  check(lb.every(r=>!(r.active!=null && r.measured-r.movers<3 && r.movers===0) || true),'headline rule: computed'); // rule lives in lbMarkup; exercised below
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const cur=s.history[s.history.length-1]; const keys=Object.keys(cur.per).slice(0,2); const per={}; const pu=JSON.parse(JSON.stringify(cur.pu)); keys.forEach(k=>per[k]=cur.per[k]); const prev={...cur,date:'2026-09-19',per,pu}; s.history=[prev,cur]; T.save(); }, K);
  await p.click('#btnLb'); await p.waitForTimeout(400); await p.click('[data-focus="acc"]'); await p.waitForTimeout(300);
  const lbt=await p.textContent('#lb'); check(!/nearly all/i.test(lbt) && /0% moved up|first week|fresh start/.test(lbt),'two measured students, none moved → not "nearly all"');
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700); await p.click('#btnHide'); await p.waitForTimeout(200);
  // 9. empty roster on a pool class → no students, notice; not all 91
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('#btnSettings'); await p.fill('#roster',''); await p.click('#mSave'); await p.waitForTimeout(400);
  const empt=await p.evaluate(K=>{ const s=window.__tally.state.sections[K]; return s.students.length; }, K);
  check(empt===0 && /No roster, so no students/.test(await p.textContent('#notices')),'emptying a pool class roster leaves it empty with a notice (not the whole course): '+empt);
  const gbNames=await p.evaluate(K=>window.__tally.state.sections[K].grades.students.join('\n'), K);
  await p.click('#btnSettings'); await p.fill('#roster', gbNames); await p.click('#mSave'); await p.waitForTimeout(400);
  check(await p.evaluate(K=>window.__tally.state.sections[K].students.length, K)>=20,'pasting the roster back re-carves the class');
  // 10. old backup without skipFirstV2 must not drag skipFirst back to on:2
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.skipFirst={acc:0,on:1}; T.save(); });
  const [dl]=await Promise.all([p.waitForEvent('download'), (async()=>{ await p.click('[data-k="period-1"]'); await p.waitForTimeout(200); await p.click('#btnSettings'); await p.waitForTimeout(200); await p.click('#exportCfg'); })()]);
  const cfg=JSON.parse(fs.readFileSync(await dl.path(),'utf8')); check(cfg.settings.skipFirstV2===true,'backup marks skipFirstV2');
  const old={...cfg, settings:{...cfg.settings, skipFirst:{acc:0,on:2}}}; delete old.settings.skipFirstV2; const oldPath=path.join(tmp,'old-backup.json'); fs.writeFileSync(oldPath, JSON.stringify(old));
  await p.setInputFiles('#cfgFile', oldPath); await p.waitForTimeout(600);
  const sf=await p.evaluate(()=>window.__tally.state.settings.skipFirst); check(sf.on===1,'an old backup (on:2, no V2 flag) does not override the review-unit default: '+JSON.stringify(sf));
  // 11. old save shapes: gradebook without values → dropped, app boots; null section → dropped
  await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem('tally.v1')); s.sections['period-1'].grades={students:['A, B'],assignments:[{name:'x'}]}; s.sections['zzz']=null; localStorage.setItem('tally.v1',JSON.stringify(s)); });
  await p.reload(); await p.waitForTimeout(600);
  const boot=await p.evaluate(()=>{ const T=window.__tally; return {err:!!T.bootError, gb:!!T.state.sections['period-1'].grades, n:T.state.order.length}; });
  check(!boot.err && !boot.gb && boot.n===2,'broken gradebook shape dropped, null section dropped, app boots: '+JSON.stringify(boot));
  // 12. dialog focus: opening Settings moves focus into the panel and Escape returns it
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.focus('#btnSettings'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const inModal=await p.evaluate(()=>document.querySelector('#modal').contains(document.activeElement)); check(inModal,'focus moves into the dialog on open');
  check(await p.getAttribute('#modal','aria-labelledby')==='mTitle','dialog is named by its own heading');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check(await p.evaluate(()=>document.activeElement&&document.activeElement.id)==='btnSettings','focus returns to the opener on close');
  // 13. unit-view cells are keyboard reachable
  await p.click('th.unit .ulink'); await p.waitForTimeout(300);
  check(await p.locator('td.sc[data-cell][tabindex="0"][role="button"]').count()>0 && await p.locator('td.pts[tabindex="0"]').count()===0,'score cells are focusable buttons in the unit view');
  await p.click('#back'); await p.waitForTimeout(300); check(await p.locator('td.pts[tabindex="0"][role="button"]').count()>0,'unit cells on the grid are focusable buttons');
  // 14. Overview: digest chip is a real button outside the card button
  await p.click('#btnHome'); await p.waitForTimeout(400);
  check(await p.locator('button.hdigest[data-digest]').count()===2 && await p.locator('.hcard button').count()===0,'What changed is a button beside the card, not a span inside it');
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
