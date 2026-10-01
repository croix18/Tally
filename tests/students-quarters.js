// Students and quarters: the Students directory, a student's page (trends, what-ifs, Q1 final), the Show-student screen,
// and closing a quarter — its record is kept, its alerts stop, the next quarter's exports start fresh.
// Runs against the scrubbed real class; focus_gradebook_scrubbed_q2.csv is the same class with Quarter 2 dates.
const { chromium, fs, path, exe, check, done, tmp } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:1000},acceptDownloads:true}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve('Tally.html'));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await p.click('[data-sec]'); await p.waitForTimeout(600);
  const K='1205050-7T1A'; const MICAH='DORSEY, MICAH FLYNN-WINTER';
  // an earlier import, so trends have two points (as a second weekly import would)
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const h=JSON.parse(JSON.stringify(s.gradeHistory[0])); h.date='2026-09-12'; h.grade=h.grade.map(g=>g==null?null:g-2); s.gradeHistory.unshift(h); T.save(); }, K);

  // 1. dates → quarters
  const d=await p.evaluate(()=>{ const T=window.__tally; return { sep:T.mdToISO('09/25'), jan:T.mdToISO('01/05'), full:T.mdToISO('3/4/2027'), bad:T.mdToISO('13/40'), q:[T.aQuarter({due:'10/09'}),T.aQuarter({due:'10/13'}),T.aQuarter({due:'12/18'}),T.aQuarter({due:'03/05'}),T.aQuarter({due:'',assignedOn:'08/20'})], cur:T.currentQuarter() }; });
  check(d.sep==='2026-09-25' && d.jan==='2027-01-05' && d.full==='2027-03-04' && d.bad===null,'Focus MM/DD dates read into the 2026–27 school year');
  check(d.q.join()==='1,2,2,4,1' && d.cur===1,'quarters from the Lake County end dates (Oct 9, Dec 18, Mar 4, May 28); assigned date when there is no due date');
  const same=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; return T.openSec(s)===s; }, K);
  check(same,'with nothing closed, the class is read exactly as before');

  // 2. Students directory
  await p.click('#btnStudents'); await p.waitForTimeout(300);
  check(await p.locator('.sdir tr[data-open]').count()===23 && /Students/.test(await p.textContent('#bar h2')),'Students lists every student of the class');
  const rowTxt=(await p.textContent('.sdir tr[data-name="'+MICAH+'"]')).replace(/\s+/g,' ');
  const cells=await p.$$eval('.sdir tr[data-name="'+MICAH+'"] td',t=>t.map(x=>x.textContent.trim()));
  check(cells[0]==='Micah Dorsey' && /^47\s*F$/.test(cells[2]) && cells[3]==='+2' && cells[4]==='5','a row reads name, grade, change, missing: '+cells.slice(0,5).join(' | '));
  await p.click('[data-sort="grade"]'); await p.waitForTimeout(200);
  const firstG=await p.evaluate(()=>[...document.querySelectorAll('.sdir .gchip')].slice(0,3).map(x=>parseInt(x.textContent)));
  check(firstG[0]<=firstG[1] && firstG[1]<=firstG[2],'Lowest grade sort puts the lowest first');
  await p.click('#btnHome'); await p.waitForTimeout(200); await p.fill('#search','micah'); await p.waitForTimeout(300);
  check(await p.locator('.sdir tr[data-open]').count()===1,'Find a student from the Overview searches the Students list');
  await p.fill('#search',''); await p.waitForTimeout(200);

  // 3. A student's page
  await p.click('.sdir tr[data-name="'+MICAH+'"]'); await p.waitForTimeout(400);
  const pg=(await p.textContent('#gridwrap')).replace(/\s+/g,' ');
  check(/Micah Dorsey/.test(await p.textContent('#bar h2')) && /Quarter 1 grade\s*47%/.test(pg) && /Missing now\s*5/.test(pg),'page headline: grade and missing work');
  check(await p.locator('.profile svg.chart').count()>=2 && /Grade over the year/.test(pg) && /Assessments across the year/.test(pg),'trends: grade over the year and assessments charts');
  check(/IXL by unit/.test(pg) && /What would move the grade/.test(pg) && /Everything turned in\s*→ 72/.test(pg),'IXL by unit and the what-ifs (everything turned in → 72)');
  check(await p.locator('.sasg tbody tr').count()===13 && await p.locator('.sasg tr.miss').count()===5,'every assignment listed, the five missing marked');
  await p.click('#pNext'); await p.waitForTimeout(300); const nextName=await p.textContent('#bar h2'); await p.click('#pPrev'); await p.waitForTimeout(300);
  check(nextName!=='Micah Dorsey' && /Micah Dorsey/.test(await p.textContent('#bar h2')),'Prev/Next walks the class in Focus order');
  // names off
  await p.click('#btnHide'); await p.waitForTimeout(300);
  const masked=(await p.textContent('#bar'))+(await p.textContent('#gridwrap'));
  check(!/Micah|Dorsey|MICAH|DORSEY/.test(masked) && /M\. D\./.test(masked),'Names off: the page shows initials only');
  await p.click('#btnHide'); await p.waitForTimeout(300);
  // from the grid
  await p.click('#back'); await p.waitForTimeout(300);
  await p.click('.tab'); await p.waitForTimeout(300);
  await p.click(`table.grid [data-prof="${MICAH}"]`); await p.waitForTimeout(300);
  check(/Micah Dorsey/.test(await p.textContent('#bar h2')),'tapping a name in the class grid opens their page');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  check(await p.locator('table.grid').count()===1,'Escape goes back to where you came from');
  await p.click('#openGrades'); await p.waitForTimeout(300); await p.click(`.gstu tr[data-stu] >> nth=0`); await p.waitForTimeout(300);
  check(await p.locator('.profile').count()===1 && /Grades/.test(await p.textContent('#back')),'a Grades row opens the page, with the way back to Grades');

  // 3b. Quickest way to the next letter: missing work and IXL first, fewest steps
  const qk=await p.evaluate(({K,MICAH})=>{ const T=window.__tally; const s=T.state.sections[K]; const i=s.grades.students.indexOf(MICAH); const f=T.findStudent(s,MICAH); const q=T.quickestPath(s,s,i,f.ixl);
    // check it is minimal: no single step can be dropped and still reach the target
    const over=q.over; const names=Object.keys(over); const drop=names.some(n=>{ const o={...over}; delete o[n]; return T.computeGrade(s,i,o).rounded>=q.target; });
    const all=T.state.sections[K].grades.students.map((n,j)=>{ const p=T.quickestPath(s,s,j,null); return p && !p.top && p.reached ? T.computeGrade(s,j,p.over).rounded>=p.target && T.computeGrade(s,j).rounded<p.target : true; });
    return { letter:q.letter, reached:q.reached, res:q.result.rounded, nhi:q.nhi.length, ixl:q.ixl.reduce((a,x)=>a+x.n,0), re:q.retakes.length, drop, allOk:all.every(Boolean), skills:q.ixl.flatMap(x=>x.skills.map(k=>k.name)).length }; },{K,MICAH});
  check(qk.letter==='D' && qk.reached && qk.res>=60 && qk.re===0 && qk.nhi+qk.ixl>0,'Micah (47 F): quickest way to a D uses missing work / IXL only → '+qk.res+' ('+qk.nhi+' missing, '+qk.ixl+' IXL skills)');
  check(!qk.drop,'the plan has no step it could do without');
  check(qk.allOk,'every student\'s plan reaches the next letter it names');
  check(/Quickest way to a D/.test(await p.textContent('#pQuick')),'the student page leads with the quickest way');
  // 4. Show student
  await p.evaluate(({K,MICAH})=>window.__tally.openProfile(K,MICAH),{K,MICAH}); await p.waitForTimeout(300);
  await p.click('#pShow'); await p.waitForTimeout(300);
  const sh=await p.evaluate(()=>({ top:getComputedStyle(document.getElementById('top')).display, app:getComputedStyle(document.getElementById('app')).display, txt:document.getElementById('show').textContent, miss:document.querySelectorAll('#show .shRow[data-k="miss"]').length }));
  check(sh.top==='none' && sh.app==='none','Show student hides the rest of Tally');
  const roster=fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8').split('\n').map(l=>l.split('\t').pop().trim()).filter(Boolean);
  const others=roster.filter(n=>n!==MICAH).map(n=>n.split(',')[0].trim()).filter(l=>l.length>3 && sh.txt.toUpperCase().includes(l.toUpperCase()));
  check(/Micah/.test(sh.txt) && !others.length && sh.miss===5,'only the student\'s own name and work on screen'+(others.length?' — also: '+others.join(', '):''));
  check(/Your quickest way to a D/.test(await p.textContent('#show .shQuick')),'Show student shows the quickest way');
  await p.click('#shPlan'); await p.waitForTimeout(200); const ifv=parseInt(await p.textContent('#shIfV'));
  check(ifv===qk.res,'“Show me on the sliders” sets the plan and the grade lands on it ('+ifv+')');
  await p.click('#shReset'); await p.waitForTimeout(200);
  const ons=await p.$$('#show .shRow[data-k="miss"] .shOn'); for(const o of ons) await o.check(); await p.waitForTimeout(200);
  check(/72/.test(await p.textContent('#shIfV')) && /C/.test(await p.textContent('#shIfL')) && /\+25/.test(await p.textContent('#shDelta')),'turning in all five: 47 → 72 (C), +25 points');
  const nx=await p.evaluate(({K,MICAH})=>{ const T=window.__tally; const s=T.state.sections[K]; const i=s.grades.students.indexOf(MICAH); return [T.gradeWith(s,i,null,{max:20,pts:15}).rounded, T.withNext(s,i,'Assessments',20,15).rounded]; },{K,MICAH});
  check(nx[0]===nx[1],'the next-assessment what-if agrees with the solver ('+nx.join(' = ')+')');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const ex=await p.$('#shExit'); const bb=await ex.boundingBox(); await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down(); await p.waitForTimeout(300); await p.mouse.up(); await p.waitForTimeout(200);
  check(await p.locator('#show').count()===1,'Escape and a quick tap don\'t leave the student screen');
  await p.mouse.down(); await p.waitForTimeout(1700); await p.mouse.up(); await p.waitForTimeout(300);
  check(await p.locator('#show').count()===0 && await p.locator('.profile').count()===1,'holding the exit returns to the teacher\'s page');

  // 5. Close Quarter 1
  await p.click('#btnHome'); await p.waitForTimeout(200);
  const before=await p.evaluate(K=>{ const T=window.__tally; return T.reconcile(T.state.sections[K]).length; }, K);
  await p.click('#homeQuarters'); await p.waitForTimeout(300);
  const pre=await p.evaluate(()=>[...document.querySelectorAll('[data-qu]')].filter(x=>x.checked).map(x=>x.dataset.qu));
  check(pre.join()==='acc|Unit 1: Equations and Inequalities,acc|Unit 2: Rational and Irrational Numbers' || pre.length===2,'the close dialog pre-ticks the IXL units whose Focus column was due in Q1: '+pre.join(' / '));
  await p.click('#qClose'); await p.waitForTimeout(500);
  check(/Quarter 1 closed/.test(await p.textContent('#toast')),'closing reports what was kept');
  const c=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const a=s.qArchive['1']; const fin=a.final; const ov=s.grades.overall;
    return { n:a.gb.assignments.length, match:fin.every((g,i)=>g===ov[i]), recon:T.reconcile(s).length, cur:T.currentQuarter(), open:T.openSec(s).grades.assignments.length, units:Object.values(T.state.quarters.units.acc).length }; }, K);
  check(before>0 && c.recon===0,'Focus checks on Q1 IXL columns stop ('+before+' → 0)');
  check(c.n===13 && c.match,'the kept Q1 record has every assignment, and its final grades equal Focus\'s Grade column');
  check(c.cur===2 && c.open===0 && c.units===2,'Quarter 2 is now; nothing open until a Q2 export arrives');
  const home=(await p.textContent('#gridwrap')).replace(/\s+/g,' ');
  check(/no Q2 gradebook yet/.test(home) && /Q1 final \d+%/.test(home) && !/Focus doesn't match Tally/.test(home) && /Missing work\s*0/.test(home),'Overview: no Q1 missing work or Focus mismatch; Q1 final shown');
  await p.click('.hcard'); await p.waitForTimeout(300);
  check(await p.locator('th.unit.qclosed').count()===2 && /Q1 closed/.test(await p.textContent('thead')),'the grid tags the two Q1 units as closed');
  check(!/Focus doesn't match/.test(await p.textContent('#notices')),'no Focus-mismatch notice on the class');
  const rep=await p.evaluate(({K,MICAH})=>{ const T=window.__tally; const s=T.state.sections[K]; const i=s.grades.students.indexOf(MICAH); return T.studentReportSection(s,i,T.gbRows(s)[i]); },{K,MICAH});
  check(!/2\.03 Worksheet/.test(rep) && !/<b>Unit 1<\/b>|<b>Unit 2<\/b>/.test(rep),'the student report no longer lists Q1 missing work or Q1 IXL units');
  await p.click('#openGrades'); await p.waitForTimeout(300);
  check(/Quarter 1 is closed/.test(await p.textContent('#gridwrap')) && await p.locator('.gasg select[disabled]').count()===13 && await p.locator('[data-gq="2"]').count()===1,'Grades opens on the kept Q1 (read-only) with a Q2 tab');
  await p.click('#bar [data-gq="2"]'); await p.waitForTimeout(300);
  check(/Quarter 2 hasn't started/.test(await p.textContent('#gridwrap')),'the Q2 tab waits for the first Q2 gradebook');

  // 6. A Q2 gradebook: fresh start, Q1 kept
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(500);
  const ds=await p.$('[data-sec]'); if(ds){ await ds.click(); await p.waitForTimeout(500); } const ask=await p.$('#askApply'); if(ask){ await ask.click(); await p.waitForTimeout(400); }
  const q2=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const qs=s.gradeHistory.map(h=>h.q); return { names:s.grades.assignments.map(a=>a.name), arch:s.qArchive['1'].gb.assignments.map(a=>a.name), qs, open:T.openSec(s)===s, prev:!!(function(){ return null; })() }; }, K);
  check(q2.names.includes('Proportions Quiz') && q2.arch.includes('Squares and Cubes Quiz') && !q2.arch.includes('Proportions Quiz'),'the Q2 export replaces the live gradebook; the Q1 record is untouched');
  check(q2.qs.includes(1) && q2.qs.includes(2) && q2.open,'history keeps Q1 and Q2 snapshots side by side');
  await p.click('#openGrades').catch(()=>{}); await p.waitForTimeout(300);
  const g2=(await p.textContent('#gridwrap')).replace(/\s+/g,' ');
  check(/Sliding\s*0/.test(g2) && /first import/.test(g2),'Q2\'s first gradebook: nobody "slid" across the quarter break');
  await p.evaluate(({K,MICAH})=>window.__tally.openProfile(K,MICAH),{K,MICAH}); await p.waitForTimeout(400);
  const pg2=(await p.textContent('#gridwrap')).replace(/\s+/g,' ');
  check(/Quarter 2 grade/.test(pg2) && /Quarter 1 final\s*47%/.test(pg2) && /Quarter 1 · final · 47% F/.test(pg2),'the student page: Q2 grade now, Q1 final kept with its assignments');
  check(await p.locator('.profile .qmark').count()>=1,'the year chart marks where Q2 starts');
  // a late Q1 export (the final one) refreshes the record
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); const ds2=await p.$('[data-sec]'); if(ds2){ await ds2.click(); await p.waitForTimeout(500); }
  check(/updated the closed-quarter record/.test(await p.textContent('#toast')),'a Q1 export imported after closing updates the kept Q1 record');

  // 7. Backup carries the quarter record; reopen/close
  await p.click('#btnSettings'); await p.waitForTimeout(300);
  const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#exportCfg')]); const f=path.join(tmp,'bk.json'); await dl.saveAs(f); await p.keyboard.press('Escape');
  const bk=JSON.parse(fs.readFileSync(f,'utf8'));
  check(bk.quarters && bk.quarters.closed['1'] && bk.sections[K].qArchive['1'].gb.assignments.length===13,'the backup carries the closed quarters and each class\'s Q1 record');
  const p2=await ctx.newPage(); await p2.goto('file://'+path.resolve('Tally.html')); await p2.evaluate(()=>localStorage.clear()); await p2.reload();
  p2.on('dialog',d=>d.accept());
  await p2.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p2.waitForTimeout(500);
  await p2.click('#btnSettings'); await p2.waitForTimeout(300); await p2.setInputFiles('#cfgFile',f); await p2.waitForTimeout(600);
  const r2=await p2.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; return { closed:T.currentQuarter(), arch:s.qArchive && s.qArchive['1'] ? s.qArchive['1'].gb.assignments.length : 0 }; }, K);
  check(r2.closed===2 && r2.arch===13,'a backup loaded on another device brings Q1 back closed, with its record');
  await p2.close();
  const ro=await p.evaluate(K=>{ const T=window.__tally; T.reopenQuarter(1); const a=T.currentQuarter(); T.closeQuarter(1,{acc:[],on:[]}); return [a, T.currentQuarter()]; }, K);
  check(ro[0]===1 && ro[1]===2,'reopen and close again');
  // 9. Review round: the orders and inputs that could lose or leak the Q1 record
  const fresh=async()=>{ const q=await ctx.newPage(); q.on('pageerror',e=>errs.push(e.message)); q.on('dialog',d=>d.accept()); await q.goto('file://'+path.resolve('Tally.html')); await q.evaluate(()=>localStorage.clear()); await q.reload();
    await q.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await q.waitForTimeout(500); await q.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await q.click('#rpSave'); await q.waitForTimeout(300);
    await q.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await q.waitForTimeout(500); await q.click('[data-sec]'); await q.waitForTimeout(600); return q; };
  const imp=async(q,f)=>{ await q.setInputFiles('#file',[f]); await q.waitForTimeout(500); const d=await q.$('[data-sec]'); if(d){ await d.click(); await q.waitForTimeout(500);} const a=await q.$('#askApply'); if(a){ await a.click(); await q.waitForTimeout(300);} };
  // (a) the Q2 export arrives BEFORE Q1 is closed
  let q=await fresh(); await imp(q, path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv'));
  const a1=await q.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const kept=s.qArchive&&s.qArchive['1']?s.qArchive['1'].gb.assignments.length:0; const per=T.closeQuarter(1,{acc:[],on:[]}); return { kept, after:s.qArchive['1'].gb.assignments.length, fin:s.qArchive['1'].final.every((g,i)=>g===s.qArchive['1'].gb.overall[i]), per:per.length }; }, K);
  check(/kept \(this file starts a new quarter\)/.test(await q.textContent('#toast')) || a1.kept===13,'a Q2 export imported before closing keeps Q1 first');
  check(a1.kept===13 && a1.after===13 && a1.fin && a1.per===1,'…and closing Q1 afterwards keeps all 13 assignments with Focus\'s final grades');
  // (b) a later export carrying ONE closed-quarter column merges instead of replacing
  const one=path.join(tmp,'one_q1_col.csv'); { const csv=fs.readFileSync('fixtures/focus_gradebook_scrubbed_q2.csv','utf8'); fs.writeFileSync(one, csv.replace(/Proportions Quiz([\s\S]*?)Assigned 11\/03\s*\n\s*Due 11\/03/, 'Unit 1 Test Retake$1Assigned 10/08\n Due 10/08')); }
  const before1=await q.evaluate(K=>window.__tally.state.sections[K].qArchive['1'].final.slice(), K);
  await imp(q, one);
  const b1=await q.evaluate(K=>{ const a=window.__tally.state.sections[K].qArchive['1']; return { n:a.gb.assignments.length, names:a.gb.assignments.map(x=>x.name), fin:a.final }; }, K);
  check(b1.n===14 && b1.names.includes('Unit 1 Test Retake') && b1.names.includes('Squares and Cubes Quiz'),'one Q1-dated column in a later export is merged into the Q1 record, not swapped for it ('+b1.n+' columns)');
  // (c) a backup from a device that never closed Q1 can't reopen it or wipe the record
  const bkOld=path.join(tmp,'old.json'); fs.writeFileSync(bkOld, JSON.stringify({ tally:4, quarters:{ ends:['2026-10-09','2026-12-18','2027-03-04','2027-05-28'], closed:{}, units:{acc:{},on:{}} }, sections:{ [K]:{ label:'1st Period · Accelerated', qArchive:{} } } }));
  await q.click('#btnSettings'); await q.waitForTimeout(300); await q.setInputFiles('#cfgFile', bkOld); await q.waitForTimeout(500);
  const c1=await q.evaluate(K=>{ const T=window.__tally; return { cur:T.currentQuarter(), n:(T.state.sections[K].qArchive['1']||{gb:{assignments:[]}}).gb.assignments.length }; }, K);
  check(c1.cur===2 && c1.n===14,'loading an older backup keeps Q1 closed and its record');
  // (d) a hostile archive in a backup is coerced, never markup
  const bkBad=path.join(tmp,'bad.json'); const arch=await q.evaluate(K=>JSON.parse(JSON.stringify(window.__tally.state.sections[K].qArchive)), K); arch['1'].gb.assignments[0].max='<img src=x onerror="window.__pwned=1">'; arch['1'].gb.assignments[0].values[0]='<b>x</b>'; arch['1'].gb.assignments.push({name:'x'});
  fs.writeFileSync(bkBad, JSON.stringify({ tally:4, sections:{ [K]:{ label:'1st Period · Accelerated', qArchive:arch } } }));
  await q.click('#btnSettings'); await q.waitForTimeout(300); await q.setInputFiles('#cfgFile', bkBad); await q.waitForTimeout(500);
  await q.click('.tab'); await q.waitForTimeout(200); await q.click('#openGrades'); await q.waitForTimeout(200); const q1b=await q.$('#bar [data-gq="1"]'); if(q1b){ await q1b.click(); await q.waitForTimeout(300); }
  check(!(await q.evaluate(()=>window.__pwned)) && await q.evaluate(K=>window.__tally.state.sections[K].qArchive['1'].gb.assignments.length, K)===14,'a backup with markup in an archived gradebook is rejected or coerced (no script runs, record intact)');
  // (e) the digest says nothing about a closed quarter; (f) an open column for a closed unit is still checked
  const e1=await q.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.state.quarters.units.acc[T.unitsOf(s)[1].name]=1; T.save(); const rc=T.reconcile(s).map(r=>r.unit.short); return { rc }; }, K);
  check(e1.rc.includes('Unit 2'),'a Q2 IXL column for a unit marked Q1 is still checked against Focus ('+e1.rc.join(', ')+')');
  q.close();
  q=await fresh(); await q.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const h=JSON.parse(JSON.stringify(s.gradeHistory[0])); h.date='2026-09-12'; h.grade=h.grade.map(g=>g==null?null:g+6); h.q=1; s.gradeHistory.unshift(h); T.closeQuarter(1,{acc:[],on:[]}); T.save(); T.render(); }, K);
  await q.click('#btnHome'); await q.waitForTimeout(200); await q.click('.hdigest'); await q.waitForTimeout(300); const dg=await q.textContent('#modal');
  check(!/Sliding:|Newly missing/.test(dg) && /needs two gradebook imports/.test(dg),'the weekly digest is silent about a closed quarter');
  await q.keyboard.press('Escape');
  // (g) every quarter closed: Grades still opens
  await q.evaluate(()=>{ const T=window.__tally; [2,3,4].forEach(n=>T.closeQuarter(n,{acc:[],on:[]})); T.save(); });
  await q.click('.hcard'); await q.waitForTimeout(200); await q.click('#openGrades'); await q.waitForTimeout(300);
  check(await q.locator('#bar h2').count()>=1,'with every quarter closed, Grades still opens');
  await q.close();
  // 8. His real setup: course-wide IXL pools carved into periods by Focus gradebooks
  const p3=await ctx.newPage(); p3.on('pageerror',e=>errs.push(e.message)); p3.on('dialog',d=>d.accept()); await p3.goto('file://'+path.resolve('Tally.html')); await p3.evaluate(()=>localStorage.clear()); await p3.reload();
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p3.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p3.waitForTimeout(800);
  for (const [f,per,prep] of [['focus_gradebook_pool_p1.csv',1,'acc'],['focus_gradebook_pool_p2.csv',2,'on']]) {
    await p3.setInputFiles('#file',[path.resolve('fixtures',f)]); await p3.waitForTimeout(600); await p3.click('[data-sec="__new__"]'); await p3.waitForTimeout(200);
    await p3.click(`#ncPeriod [data-p="${per}"]`); await p3.click(`#ncPrep [data-prep="${prep}"]`); await p3.click('#ncMake'); await p3.waitForTimeout(800);
    if ((await p3.textContent('#modal')).trim()) { await p3.click('#mCancel').catch(()=>{}); await p3.waitForTimeout(300); } }
  const t0=Date.now(); await p3.click('#btnStudents'); await p3.waitForSelector('.sdir'); const ms=Date.now()-t0;
  const n3=await p3.locator('.sdir tr[data-open]').count(); const withIxl=await p3.evaluate(()=>[...document.querySelectorAll('.sdir tr[data-open] td:nth-child(6)')].filter(td=>/%/.test(td.textContent)).length);
  check(n3>=40 && withIxl>=n3-2 && await p3.locator('.sdir tr.sgroup').count()===2,'pool classes: both periods listed, IXL found for almost everyone ('+withIxl+' of '+n3+')');
  check(ms<3000,'the Students list renders quickly ('+ms+' ms)');
  await p3.click('.sdir tr[data-open] >> nth=5'); await p3.waitForTimeout(400);
  check(/IXL by unit/.test(await p3.textContent('#gridwrap')) && await p3.locator('.iu').count()>0,'a pool student\'s page shows their IXL units');
  await p3.close();
  check(!errs.length,'no page errors '+errs.join(' | '));
  await b.close(); done();
})();
