// Grades: the Focus formula, category fitting, what-ifs, history, the screens, and privacy — against the scrubbed real export.
const { chromium, fs, path, exe, check, done, tmp, APP } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await p.click('[data-sec]'); await p.waitForTimeout(600);
  check(/every category confirmed by the Focus grade column/.test(await p.evaluate(()=>JSON.stringify(window.__tally.state.lastImport))),'the import result reports the categories were proved');
  const K='1205050-7T1A';
  // 1. formula + fit
  const m=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades; const fit=T.fitCategories(s); const g=T.gradingFor(s.prep);
    const gs=T.gradeAll(s); return { exact:fit.exact, err:fit.err, undetermined:Object.values(fit.determined).filter(x=>!x).length, notebook:fit.map['Unit 1 Notebook Check'], ixl:fit.map['Unit 2 IXL'], wb:fit.map['Whiteboard Practice Week 9/21'],
      mismatches:gs.filter((r,i)=>r.rounded!==gb.overall[i]).length, how:Object.values(g.how).filter(h=>h==='fit').length, letters:gs.map(r=>r.letter).join('') }; }, K);
  check(m.exact && m.err===0 && m.mismatches===0,'computed grade equals the Focus Grade column for all 23 students');
  check(m.undetermined===0 && m.how===13,'every assignment\'s category is proved by the fit and stored as fit');
  check(m.notebook==='Assessments' && m.ixl==='Assessments' && m.wb==='Participation','notebook check and IXL land in Assessments, whiteboard in Participation');
  check(/^[ABCDF]+$/.test(m.letters) && m.letters.length===23,'letters assigned');
  // 2. what-ifs (Micah: 47 F, five missing worksheets)
  const w=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades; const i=gb.students.indexOf('DORSEY, MICAH FLYNN-WINTER');
    const allIn={}; gb.assignments.forEach(a=>{ if(a.status[i]==='missing') allIn[a.name]=a.max; });
    const base=T.computeGrade(s,i); const one=T.computeGrade(s,i,{'2.03 Worksheet':10}); const all=T.computeGrade(s,i,allIn);
    // hand check: Assessments 59.8% (from Focus: 2/17+27+5+10+1+10+12 ... trust computed), Classwork 0/50 → with all worksheets 50/50 = 100%
    return { base:base.rounded, cw:base.cats.Classwork.pct, one:one.rounded, all:all.rounded, allCw:all.cats.Classwork.pct, need:T.neededOn(s,i,'Assessments',20,70), next:T.withNext(s,i,'Assessments',20,20).rounded }; }, K);
  check(w.base===47 && w.cw===0,'Micah: 47 (F), Classwork 0% with five worksheets not handed in');
  check(w.one>w.base && w.all===72 && w.allCw===100,'turning in one worksheet lifts the grade; all five → 72 (C)');
  check(w.need===null && w.next<70,'a single 20-point assessment cannot reach a C from 47 (the missing work is the lever)');
  // needed-score solver on a student near a boundary: find someone in 76-79 and check the C→B threshold is monotone and exact
  const nb=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.students; const gs=T.gradeAll(s); const i=gs.findIndex(r=>r.rounded>=76&&r.rounded<=79); if(i<0) return null;
    const n=T.neededOn(s,i,'Assessments',20,80); const at=T.withNext(s,i,'Assessments',20,n).rounded; const below=n>0?T.withNext(s,i,'Assessments',20,n-0.5).rounded:null; return {g:gs[i].rounded,n,at,below}; }, K);
  check(nb && nb.at>=80 && (nb.below==null || nb.below<80),'needed score for a B is the least half-point that gets there: '+JSON.stringify(nb));
  // 3. screens
  await p.click('#openGrades'); await p.waitForTimeout(500);
  const txt=await p.textContent('#gridwrap');
  const expectAvg=await p.evaluate(K=>{ const T=window.__tally; const g=T.gradeAll(T.state.sections[K]).map(r=>r&&r.rounded).filter(v=>v!=null); return g.reduce((a,b)=>a+b,0)/g.length; }, K);   // mean of the ROUNDED grades, as Focus averages
  const cavg=txt.replace(/\s+/g,' ').match(/Class average\s*(\d+)%/); check(cavg && cavg[1]===String(Math.round(expectAvg)) && /A\s*13/.test(txt) && /Missing work\s*22/.test(txt),'overview cards: average, letters, missing');
  check(/Matches the Focus Grade column for all 23 students/.test(txt),'overview states the formula matches Focus');
  check(await p.locator('.gasg tbody tr').count()===13 && await p.locator('.gstu tbody tr').count()===23,'assignments and students tables');
  check(/r = 0\.\d\d/.test(txt) && await p.locator('.scatter .pt').count()===16,'IXL vs assessments scatter with r, IXL columns excluded');
  check((await p.locator('.gasg small').allTextContents()).every(t=>/✓/.test(t)),'every assignment shows the proved tick');
  // 4. move a category → user, Focus disagrees, not overridden by a re-fit
  await p.selectOption('.gasg select[data-cat="Unit 1 Notebook Check"]','Classwork'); await p.waitForTimeout(500);
  const mv=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const g=T.gradingFor(s.prep); const fit=T.fitCategories(s); return {how:g.how['Unit 1 Notebook Check'], map:g.map['Unit 1 Notebook Check'], exact:fit.exact, dis:fit.disagree['Unit 1 Notebook Check']}; }, K);
  check(mv.how==='user' && mv.map==='Classwork' && !mv.exact && mv.dis===true,'moved assignment is marked user; the fit now disagrees');
  check(/Focus disagrees/.test(await p.textContent('.gasg')) && /don't all match Focus/.test(await p.textContent('#gridwrap')),'the row and a notice say Focus disagrees');
  await p.selectOption('.gasg select[data-cat="Unit 1 Notebook Check"]','Assessments'); await p.waitForTimeout(500);
  check(!/Focus disagrees/.test(await p.textContent('.gasg')),'moving it back clears the disagreement');
  // 5. student page (was the one-student card) + privacy
  const first=await p.evaluate(()=>document.querySelector('.gstu tr[data-stu]').dataset.stu).then(i=>p.evaluate(({K,i})=>window.__tally.state.sections[K].grades.students[i],{K,i:Number(i)}));
  await p.click('.gstu tr[data-stu]'); await p.waitForTimeout(400); const card=(await p.textContent('#bar'))+(await p.textContent('#gridwrap'));
  const others=await p.evaluate(K=>window.__tally.state.sections[K].grades.students, K);
  const last=n=>n.split(',')[0].trim().toUpperCase();
  check(card.toUpperCase().includes(last(first)) && others.filter(n=>n!==first && last(n).length>3).every(n=>!card.toUpperCase().includes(last(n))),'student page shows only that student');
  check(await p.locator('.profile').count()===1 && !(await p.evaluate(()=>document.getElementById('toast').classList.contains('show'))),'the page opens in the teacher view');
  check(/missing work were turned in/i.test(card) && /retaken/i.test(card) && /next assessment scored/i.test(card) && /→ \d+/.test(card),'page has missing, retakes, next-assessment what-ifs');
  await p.fill('.wiMax','50'); await p.waitForTimeout(150); check((await p.getAttribute('.wiPts','max'))==='50','next-assessment slider follows points possible');
  const [pop]=await Promise.all([ctx.waitForEvent('page'), p.click('#pPrint')]); await pop.waitForLoadState(); await pop.waitForTimeout(300); const ptxt=await pop.evaluate(()=>document.body.innerText);
  check(ptxt.includes(first) && others.filter(n=>n!==first).every(n=>!ptxt.includes(n)) && /What would move the grade/i.test(ptxt) && /weighted Assessments 70%/.test(ptxt),'print page: one student, formula stated'); await pop.close();
  await p.click('#back'); await p.waitForTimeout(300);
  check(await p.locator('.gstu').count()===1,'back returns to Grades');
  // hidden names mask the overview and the card
  await p.click('#btnHide'); await p.waitForTimeout(400);
  check(!(await p.textContent('.gstu')).includes(first),'Names off masks the students table');
  await p.click('#btnHide'); await p.waitForTimeout(400);
  // 6. history: a second import on another date → trend, Δ column, sliding
  const h=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades;
    // pretend last week's import: everyone 3 points lower on Unit 1 Assessment, one student with the worksheets turned in
    s.gradeHistory=[]; const save=JSON.stringify(gb); gb.importedAt='2026-09-19T12:00:00.000Z';
    const a=gb.assignments.find(a=>a.name==='Unit 1 Assessment'); a.values=a.values.map(v=>v==null?v:Math.min(a.max,v+3));
    const i=gb.students.indexOf('DORSEY, MICAH FLYNN-WINTER'); gb.assignments.forEach(x=>{ if(x.status[i]==='missing'){ x.status[i]='score'; x.values[i]=x.max; x.missing--; } });
    T.gradeSnapshot(s); s.grades=JSON.parse(save); T.gradeSnapshot(s); T.save(); T.render();
    return { n:s.gradeHistory.length, dates:s.gradeHistory.map(x=>x.date), micahThen:s.gradeHistory[0].grade[i], micahNow:s.gradeHistory[1].grade[i] }; }, K);
  check(h.n===2 && h.dates[0]==='2026-09-19' && h.dates[1]===new Date().toISOString().slice(0,10),'two history entries by date');
  const t2=await p.textContent('#gridwrap');
  check(/since Sep 19/.test(t2) && /Class average by import/.test(t2) && await p.locator('.gcard .spark').count()===1,'trend card and Δ since previous import');
  const sl=await p.locator('.gstu tr.sliding').count(); check(sl>=1 && /sliding/.test(await p.locator('.gstu tr.sliding').first().textContent()),'sliding students flagged and sorted first: '+sl);
  check(h.micahThen>h.micahNow && /−2[0-9]/.test(await p.locator('.gstu tr.sliding').first().textContent()),'a student whose grade fell shows the drop');
  // 7. persistence + backup
  await p.reload(); await p.waitForTimeout(500);
  check(await p.evaluate(K=>{ const s=window.__tally.state.sections[K]; return s.grades.assignments.length===13 && s.gradeHistory.length===2 && window.__tally.gradingFor('acc').how['Unit 1 IXL']==='fit'; }, K),'gradebook, history and category map survive a reload');
  await p.click('#btnSettings'); const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#exportCfg')]); const cfg=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
  check(cfg.grading && cfg.grading.acc && cfg.grading.acc.cats[0].w===70 && cfg.sections[K].gradeHistory.length===2 && !JSON.stringify(cfg).includes('"values"'),'backup carries weights, category map and grade history, not raw scores');
  await p.click('#mCancel');
  // 8. no Grade column → guesses flagged; the asker appears for new assignments
  const p2=await ctx.newPage(); p2.on('dialog',d=>d.accept()); await p2.goto('file://'+path.resolve(APP)); await p2.evaluate(()=>localStorage.clear()); await p2.reload(); await p2.waitForTimeout(300);
  const csv=fs.readFileSync('fixtures/focus_gradebook_scrubbed.csv','utf8').split('\n'); const noGrade=csv.map((l,i)=>i===0? l.replace('"Grade",','') : l.replace(/^("[^"]*","[^"]*","[^"]*"),"[^"]*",/,'$1,')).join('\n');
  fs.writeFileSync(path.join(tmp,'nograde.csv'),noGrade);
  await p2.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p2.waitForTimeout(500); await p2.click('#rpSkip'); await p2.waitForTimeout(200);
  await p2.setInputFiles('#file',[path.join(tmp,'nograde.csv')]); await p2.waitForTimeout(500); await p2.click('[data-sec]'); await p2.waitForTimeout(500);
  check(/Which category\?/.test(await p2.textContent('#modal')) && await p2.locator('[data-ask]').count()===13,'without a Grade column, the asker lists every new assignment');
  await p2.click('[data-ask="0"] [data-c="Classwork"]'); await p2.click('#askApply'); await p2.waitForTimeout(400);
  const ng=await p2.evaluate(()=>{ const T=window.__tally; const s=Object.values(T.state.sections)[0]; const g=T.gradingFor(s.prep); return {wb:g.map['Whiteboard Practice Week 9/21'], how:g.how['Whiteboard Practice Week 9/21'], ov:s.grades.overall}; });
  check(ng.wb==='Classwork' && ng.how==='user' && ng.ov===null,'asker choice applied as user; no overall column');
  await p2.click('#openGrades'); await p2.waitForTimeout(400); check(/categories are name-based guesses/.test(await p2.textContent('#gridwrap')),'overview says categories are guesses');
  await p2.close();
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
