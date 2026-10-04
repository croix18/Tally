const { chromium, fs, path, exe, check, done, tmp, need, unskip, APP } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog', d=>d.accept());
  await p.goto('file://'+path.resolve(APP)); await unskip(p);
  const main=fs.readdirSync('fixtures').filter(f=>/^f1473588/.test(f)).map(f=>path.resolve('fixtures',f));
  const old=fs.readdirSync('fixtures').filter(f=>f.startsWith('old_')).map(f=>path.resolve('fixtures',f));
  // best-score: import NEWER first (higher scores), then OLDER (lower) confirmed → grid shows best from history
  await p.setInputFiles('#file', main); await p.waitForTimeout(500);
  const ptsNew=await p.evaluate(()=>{const T=window.__tally; const s=T.state.sections['1205050-7T1A']; const u=T.unitsOf(s)[0]; return T.population(s).map(x=>T.__pts?0:0).length && T.unitsOf(s)[0] && [...Array(s.students.length).keys()].map(i=>{let p=0; for(const k of u.active){const v=T.eff(s,k,i); if(v!=null&&v>=s.threshold)p++;} return p;}).reduce((a,b)=>a+b,0);});
  await p.setInputFiles('#file', old); await p.waitForTimeout(500);   // dialog auto-accepted: replace with older
  const ptsOldBest=await p.evaluate(()=>{const T=window.__tally; const s=T.state.sections['1205050-7T1A']; const u=T.unitsOf(s)[0]; return [...Array(s.students.length).keys()].map(i=>{let p=0; for(const k of u.active){const v=T.eff(s,k,i); if(v!=null&&v>=s.threshold)p++;} return p;}).reduce((a,b)=>a+b,0);});
  check(ptsOldBest===ptsNew,'best-score grading keeps points after an older/lower import: '+ptsNew+' vs '+ptsOldBest);
  await p.click('#btnSettings'); await p.click('#useBest'); await p.click('#mSave'); await p.waitForTimeout(300);
  const ptsRaw=await p.evaluate(()=>{const T=window.__tally; const s=T.state.sections['1205050-7T1A']; const u=T.unitsOf(s)[0]; return [...Array(s.students.length).keys()].map(i=>{let p=0; for(const k of u.active){const v=T.eff(s,k,i); if(v!=null&&v>=s.threshold)p++;} return p;}).reduce((a,b)=>a+b,0);});
  check(ptsRaw<ptsNew,'with best-score off, points follow the current (lower) export: '+ptsRaw);
  await p.click('#btnSettings'); await p.click('#useBest'); await p.click('#mSave'); await p.waitForTimeout(300);
  await p.click('[data-k="1205050-7T1A"]'); await p.waitForTimeout(150); await p.click('#rpSkip'); await p.waitForTimeout(150);
  await p.click('th.unit .ulink'); await p.waitForTimeout(300);
  check(await p.locator('td.sc.best').count()>0,'cells graded from a better earlier score are marked');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // receipt on copy
  await ctx.grantPermissions(['clipboard-read','clipboard-write']);
  await p.click('th.unit .copy'); await p.waitForTimeout(300);
  const rc=await p.evaluate(()=>{const s=window.__tally.state.sections['1205050-7T1A']; const r=Object.values(s.receipts)[0]; return r && {outOf:r.outOf, goal:r.goal, rows:r.rows.length};});
  check(rc && rc.rows===23 && rc.goal===67,'copy stores a receipt: '+JSON.stringify(rc));
  check(/copied/.test(await p.textContent('th.unit')),'unit header shows copied date');
  check(/FOCUS title/.test(await p.textContent('#toast')),'toast hands over the FOCUS title');
  // shape from geometry + mode
  const sh=await p.evaluate(()=>{const S=window.__tally.stats; return [S([81,81,81,81,81,81,81,81,81,81,100,100,100,100,100,72]).shape, S([1,2,3,4,5,6,7,8,9]).shape, S([2,3,4,4,4,5,20]).shape, S([15,15,15,15,15,15,15,15,15,14,14,13,17,17,20,2,3,7,8,11,15,15,15]).shape, S([1,2,2,3]).mode];});
  console.log(JSON.stringify(sh));
  check(/gap between 81 and 100/.test(sh[0]) && /two clusters/.test(sh[0]),'two clusters detected');
  check(/roughly symmetric/.test(sh[1]) && /skewed right/.test(sh[2]) && /skewed left/.test(sh[3]) && JSON.stringify(sh[4])==='[2]','shape from tails; mode');
  // filename identity without course code; Pre-Algebra not accelerated
  const fx=await p.evaluate(()=>{const f=parseIxlFilename; return [f('IXL-Score-Grid_2026-09-25_This-School-Year_Period 3 Math.xlsx').key===f('IXL-Score-Grid_2026-10-02_This-School-Year_Period 3 Math.xlsx').key, f('IXL-Score-Grid_2026-09-25_This-School-Year_1205050-8T2A-M_J-GR8_Pre-Algebra.xlsx').accelerated, f('IXL-Score-Grid_2026-09-25_This-School-Year_1205050-8T2A-M_J-ACC_Algebra-1.xlsx').accelerated];});
  check(fx[0]===true,'renamed class keys the same week to week');
  check(fx[1]===false && fx[2]===true,'Pre-Algebra is not accelerated; Algebra 1 is');
  // gradebook header with pts + date; grade level; inactive rows
  const gb=await p.evaluate(()=>window.__tally.parseGradebook([['Student','Student ID','Grade Level','Unit 1 Test 100 pts 09/12','IXL Unit 1 23 pts 09/15'],['Doe, Jane','1','7','88','20'],['Withdrawn, Zed (Inactive)','2','7','',''],['Roe, Rick','3','7','70','18']]));
  check(gb.assignments.map(a=>a.name+'|'+a.max).join(';')==='Unit 1 Test|100;IXL Unit 1|23' && gb.students.length===2,'pts before date; Grade Level skipped; inactive row dropped: '+JSON.stringify(gb.assignments.map(a=>[a.name,a.max]))+' '+gb.students.length);
  // language spot checks
  await p.click('#btnSettings'); const stxt=await p.textContent('#modal'); await p.click('#mCancel');
  check(/Goal SmartScore/.test(stxt) && /Class name/.test(stxt) && !/Threshold|Team name|period/i.test(stxt.replace(/Period/g,'')),'settings uses goal / class name vocabulary');
  check(/Goal 67/.test(await p.textContent('[data-k="1205050-7T1A"]')),'tab badge says Goal');
  check((await p.textContent('#btnLb')).trim()==='Race' && (await p.textContent('#btnImport')).trim()==='Import','header buttons: Race, Import');
  await p.click('#btnLb'); await p.waitForTimeout(300); await p.click('[data-tab="lab"]'); await p.waitForTimeout(300);
  check((await p.getAttribute('#labDots','aria-pressed'))==='true' && /^Dots$/.test((await p.textContent('#labDots')).trim()),'toggle shows state by fill, label fixed');
  await p.screenshot({path:path.join(tmp,'shot18.png')});
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700);
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
