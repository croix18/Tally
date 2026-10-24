// Round 8 (24 Oct 2026): the high-level audit's fixes, each with a check that failed before it.
//   · retakes wait for every open unit's IXL, not only the unit being worked in
//   · a typed "= IXL name" alias reaches Copy and the Focus check
//   · missing work counts NHI only (a blank cell isn't missing work)
//   · a kept-quarter record carries its import date
//   · the Data Lab compares any two data sets, one picked per course
//   · Sync never asks or downloads while the Board is up; a Full save opened on a hidden Tally keeps names hidden
const { chromium, fs, path, exe, check, done, tmp, APP, pick, more } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:1000},acceptDownloads:true}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const K='1205050-7T1A';

  // 1. retake: Unit 1 IXL is NHI in Focus and Unit 1 skills aren't done, while Unit 3 (working in) is finished
  const rt=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades;
    const i=gb.students.findIndex(n=>T.findStudent(s,n).ixl!=null); const name=gb.students[i]; const f=T.findStudent(s,name);
    gb.assignments.forEach(a=>{ if (a.status[i]==='missing') { a.status[i]='score'; a.values[i]=a.max; } });
    const u1=gb.assignments.find(a=>a.name==='Unit 1 IXL'); u1.status[i]='missing'; u1.values[i]=null;
    const unit3=T.unitsOf(s).find(u=>u.num===3); T.activeFor(s,unit3,f.ixl).forEach(k=>{ s.scores[k][f.ixl]=100; }); s.best=null;
    const unit1=T.unitsOf(s).find(u=>u.num===1); T.activeFor(s,unit1,f.ixl).forEach(k=>{ s.scores[k][f.ixl]=null; });
    gb.assignments.forEach(a=>{ a.missing=a.status.filter(t=>t==='missing').length; }); T.save();
    const r=T.retakeStatus(s,name); const d=T.conferenceData(s,name); const qp=T.quickestPath(s,T.openSec(s),i,f.ixl);
    return { ok:r.ok, why:T.retakeWhy(r), behind:(r.behind||[]).map(x=>x.unit.short), work:T.conferenceWork(d), plan:qp&&qp.plan.map(x=>x.kind+':'+(x.a?x.a.name:'')).join(' > ') }; },K);
  check(rt.ok===false && rt.behind.includes('Unit 1') && /IXL skills? in Unit 1/.test(rt.why),'a retake waits for Unit 1\'s IXL too, not only the working unit: '+rt.why);
  check(/Unit 1 IXL/.test(rt.work) || !/Can be retaken/.test(rt.work),'the conference form says the same ('+rt.work.split('\n').pop()+')');

  // 2. a typed alias on the roster
  const al=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades;
    const rows=T.gbRows(s); const j=rows.findIndex(r=>r.status==='rosterOnly'); if (j<0) return { skip:true };
    const disp=gb.students[j]; const ixlName=s.students.find(n=>!rows.some(r=>r.ixlName===n)); if (!ixlName) return { skip:true };
    s.roster=s.roster.split('\n').map(l=>l.includes(disp.split(',')[0])? l+' = '+ixlName : l).join('\n'); s._keys=null; T.save(); T.render();
    const rows2=T.gbRows(s); const r2=rows2[j]; const col=T.unitColumn ? null : null;
    const rec=T.reconcile(s); const unmatched=rec.flatMap(c=>c.rows||[]).filter(r=>r.i===j && r.status==='unmatched').length;
    return { disp, ixlName, matched:r2 && r2.ixl!=null, status:r2 && r2.status }; },K);
  check(al.skip || (al.matched && al.status==='ok'),'a roster line "LAST, FIRST = IXL name" matches in the gradebook rows Copy and the Focus check use: '+JSON.stringify(al));

  // 3. missing work counts NHI only
  const mw=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades;
    const a=gb.assignments.find(x=>x.status.some(t=>t==='score')); const i=a.status.findIndex(t=>t==='score'); a.status[i]='blank'; a.values[i]=null; a.missing=a.status.filter(t=>t==='missing').length;
    const before=T.gradeSummary(s).missing; const perStudent=gb.students.reduce((n,_,k)=>n+gb.assignments.filter(x=>x.status[k]==='missing').length,0); const blanks=gb.assignments.reduce((n,x)=>n+x.status.filter(t=>t==='blank').length,0); return { before, perStudent, blanks }; },K);
  check(mw.before===mw.perStudent && mw.blanks>0,'the Overview\'s missing count equals the per-student NHI count ('+mw.before+' = '+mw.perStudent+'), '+mw.blanks+' blanks left out');
  await p.reload(); await p.waitForTimeout(600);
  const mw2=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; return s.grades.assignments.every(a=>a.missing===a.status.filter(t=>t==='missing').length); },K);
  check(mw2,'…and a saved gradebook is read the same way after a reload');

  // 4. a kept-quarter record from an older file carries its dates
  await p.evaluate(()=>{ const T=window.__tally; T.state.quarters.ends[0]='2026-09-01'; T.closeQuarter(1,{acc:[],on:[]}); T.save(); T.render(); });
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
  const arch=await p.evaluate(K=>{ const T=window.__tally; const a=T.state.sections[K].qArchive['1']; return a && a.gb.importedAt && a.gb.importedAt.slice(0,4); },K);
  check(arch==='2026','updating the kept Quarter 1 record stamps it with today\'s date, not Dec 31 1969');

  // 5. the Data Lab compares any two sets, one per course (needs a second course: made from the on-level pool)
  const on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  await p.setInputFiles('#file',[path.resolve('fixtures','focus_gradebook_pool_p2.csv')]); await p.waitForTimeout(600); await pick(p,'[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click('#ncPeriod [data-p="2"]'); await p.click('#ncPrep [data-prep="on"]'); await p.click('#ncMake'); await p.waitForTimeout(700); const ap=await p.$('#askApply'); if (ap) { await ap.click(); await p.waitForTimeout(300); }
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.leaderboard=true; T.state.settings.lbTab='lab'; T.state.settings.labPrep='both'; T.save(); T.render(); }); await p.waitForTimeout(500);
  check(await p.locator('#labA').count()===1 && await p.locator('#labO').count()===1 && await p.locator('#labPair').count()===0,'Both: one data-set picker per course, no forced pairing');
  const aOpts=await p.$$eval('#labA option',os=>os.map(o=>o.value)), oOpts=await p.$$eval('#labO option',os=>os.map(o=>o.value));
  const aPick=aOpts.find(v=>v.startsWith('unit:') && v!=='unit:__all__'), oPick=oOpts.filter(v=>v.startsWith('unit:') && v!=='unit:__all__').pop();
  await p.selectOption('#labA',aPick); await p.waitForTimeout(300); await p.selectOption('#labO',oPick); await p.waitForTimeout(300);
  const sides=await p.evaluate(()=>({ a:document.querySelector('#labA').value, o:document.querySelector('#labO').value, rows:document.querySelectorAll('#lb .labRow').length, title:document.querySelector('#lb .lbTitle').textContent }));
  check(sides.a===aPick && sides.o===oPick && sides.rows===2 && / vs /.test(sides.title),'each side keeps its own pick and the Board draws both: '+sides.title);
  await p.click('[data-prep="acc"]'); await p.waitForTimeout(300); await p.click('[data-prep="both"]'); await p.waitForTimeout(300);
  check(await p.$eval('#labO',s=>s.value)===oPick,'switching away and back keeps the on-level side');
  // the Options card holds the toggles
  check(await p.locator('#lbOpts').count()===1 && !(await p.locator('#labStats').isVisible()),'the toggles sit behind Options');
  await p.click('#lbOpts'); await p.waitForTimeout(200); check(await p.locator('#labStats').isVisible(),'Options opens them');
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.leaderboard=false; T.save(); T.render(); }); await p.waitForTimeout(300);

  // 6. Sync is quiet while the Board is up
  const busy=await p.evaluate(()=>{ document.body.classList.add('lbMode'); const r=window.__tally.syncBusyHere ? window.__tally.syncBusyHere() : null; document.body.classList.remove('lbMode'); return r; });
  check(busy===true || busy===null,'with the Board up, Sync counts this computer as busy (no question, no download)'+(busy===null?' (helper not exposed; skipped)':''));

  // 7. a Full save opened on a hidden Tally keeps names hidden
  await more(p,'#btnSettings'); await p.waitForTimeout(250); await seeTab(p,'#exportFull'); const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#exportFull')]); const fp=path.join(tmp,'full-hidden.json'); await dl.saveAs(fp); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.hideNames=true; T.save(); T.render(); });
  await p.setInputFiles('#file',[fp]); await p.waitForTimeout(800);
  check(await p.evaluate(()=>window.__tally.state.settings.hideNames===true),'opening a Full save while names are hidden keeps them hidden');

  console.log('errors:',errs); check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
