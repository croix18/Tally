// Grades: the Focus formula, category fitting, what-ifs, history, the screens, and privacy: against the scrubbed real export.
const { chromium, fs, path, exe, check, done, tmp, APP, pick, more , fullSave, legacyOf } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
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
  check(await p.locator('.gasg small').count()>0 && await p.locator('.gasg small').count()===await p.locator('.gasg small svg.ico[aria-label="confirmed"]').count(),'every assignment shows the proved tick');
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
  check(ptxt.includes(first) && others.filter(n=>n!==first).every(n=>!ptxt.includes(n)) && /What would move the grade/i.test(ptxt) && !/weighted Assessments/.test(ptxt),'print page: one student, no formula footnote (the page is the student\'s)');
  check(/Do this week/i.test(ptxt) && /This week I will/.test(ptxt) && /Last week's plan/.test(ptxt) && /First report/.test(ptxt) && await pop.locator('.todo li .box').count()>=1 && await pop.locator('section.teach').count()===0,'the weekly report has the checklist, the plan box and signature lines; a first report says so; one student\'s print has no teacher page'); await pop.close();
  const logged=await p.evaluate(()=>{ const s=Object.values(window.__tally.state.sections)[0]; const L=s.reportLog||{}; const k=Object.keys(L)[0]; return k && L[k].length===1 && L[k][0].grade!=null && typeof L[k][0].missing==='number'; });
  check(logged,'printing a report logs the grade, missing count and IXL skills for the next report\'s "since" strip');
  await p.evaluate(()=>{ const s=Object.values(window.__tally.state.sections)[0]; const L=s.reportLog; const k=Object.keys(L)[0]; L[k]=[{ date:'2026-10-10', grade:L[k][0].grade-5, missing:L[k][0].missing+2, ixl:L[k][0].ixl }]; window.__tally.save(); });
  const [pop2]=await Promise.all([ctx.waitForEvent('page'), p.click('#pPrint')]); await pop2.waitForLoadState(); await pop2.waitForTimeout(300); const pt2=await pop2.evaluate(()=>document.body.innerText);
  check(/Since the last report/.test(pt2) && /Oct 10/.test(pt2) && /\+5/.test(pt2) && /−2/.test(pt2),'the next report says what moved since the last one (grade +5, missing −2)'); await pop2.close();
  // audit (24 Oct): the strip says when the exports haven't changed since then; a report from another quarter is not the one to move from; the copy step is a note, not a box
  await p.evaluate(()=>{ const T=window.__tally; const s=Object.values(T.state.sections)[0]; const L=s.reportLog; const k=Object.keys(L)[0]; const e=L[k][L[k].length-1]; L[k]=[{ date:'2026-10-10', q:e.q, gb:e.gb, ix:e.ix, grade:e.grade-5, missing:e.missing+2, ixl:e.ixl }]; T.save(); });
  const [pop3]=await Promise.all([ctx.waitForEvent('page'), p.click('#pPrint')]); await pop3.waitForLoadState(); await pop3.waitForTimeout(300); const pt3=await pop3.evaluate(()=>document.body.innerText);
  check(/Focus and IXL exports unchanged since then/.test(pt3),'when neither export has been re-imported since the last report, the strip says so'); 
  check(await pop3.locator('.todo li').count()===await pop3.evaluate(()=>[...document.querySelectorAll('.todo li')].filter(li=>!/goes into Focus/.test(li.textContent)).length),'the "goes into Focus" step is not a box for the student'); await pop3.close();
  await p.evaluate(()=>{ const T=window.__tally; const s=Object.values(T.state.sections)[0]; const L=s.reportLog; const k=Object.keys(L)[0]; L[k]=[{ date:'2026-10-10', q:4, grade:10, missing:9, ixl:0 }]; T.save(); });
  const [pop4]=await Promise.all([ctx.waitForEvent('page'), p.click('#pPrint')]); await pop4.waitForLoadState(); await pop4.waitForTimeout(300); const pt4=await pop4.evaluate(()=>document.body.innerText);
  check(/First report/.test(pt4) && !/Since the last report/.test(pt4),'a report logged in another quarter is not the one to move from'); await pop4.close();
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.hideNames=true; const s=Object.values(T.state.sections)[0]; s.reportLog={}; T.save(); T.render(); }); await p.waitForTimeout(300);
  p.removeAllListeners('dialog'); p.once('dialog',d=>d.dismiss()); await p.click('#pPrint'); await p.waitForTimeout(400); p.on('dialog',d=>d.accept());
  check(await p.evaluate(()=>Object.keys(Object.values(window.__tally.state.sections)[0].reportLog||{}).length===0),'with names hidden, saying no to the question opens nothing and logs nothing');
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.hideNames=false; T.save(); T.render(); }); await p.waitForTimeout(300);
  // Croix (25 Oct): a retake notice when the student is eligible and a retake would raise the grade
  const elig=await p.evaluate(()=>{ const T=window.__tally; const s=Object.values(T.state.sections)[0]; const gb=s.grades; T.state.settings.teacherName='Mr. Shaffer';
    const i=gb.students.findIndex(n=>T.findStudent(s,n).ixl!=null); const f=T.findStudent(s,gb.students[i]);
    gb.assignments.forEach(a=>{ if (a.status[i]==='missing') { a.status[i]='score'; a.values[i]=a.max; } }); T.unitsOf(s).forEach(u=>T.activeFor(s,u,f.ixl).forEach(k=>{ s.scores[k][f.ixl]=100; })); s.best=null;
    const t=gb.assignments.find(a=>/assessment/i.test(a.name)); t.status[i]='score'; t.values[i]=Math.round(t.max*0.5); T.save(); T.openProfile(Object.keys(T.state.sections)[0], gb.students[i]); return { name:gb.students[i], test:t.name }; });
  await p.waitForTimeout(400);
  const [popE]=await Promise.all([ctx.waitForEvent('page'), p.click('#pPrint')]); await popE.waitForLoadState(); await popE.waitForTimeout(400);
  const al=await popE.evaluate(()=>{ const a=document.querySelector('.panel.alert'); return a?a.innerText.replace(/\s+/g,' '):''; });
  check(/RETAKE THIS WEEK/i.test(al) && /eligible to retake/.test(al) && /→ \d+% [A-D]/.test(al) && /Mr\. Shaffer's room during HOWL time on Wednesday or Thursday/.test(al) && /Tell the teacher whose HOWL time you would be in/.test(al) && /Focus message/.test(al) && await popE.locator('.panel.alert .box').count()===3,'an eligible student whose retake would raise the grade gets the HOWL-time notice with the grade it reaches and the boxes to tick: '+al.slice(0,100)); await popE.close();
  await p.click('#back'); await p.waitForTimeout(300);
  check(await p.locator('.gstu').count()===1,'back returns to Grades');
  // Croix (24 Oct): batches by class and by letter grade; a reminder when the exports are old
  await p.evaluate(()=>window.__tally.openStudentReports(Object.values(window.__tally.state.sections)[0])); await p.waitForTimeout(300);
  await p.click('[data-who="letters"]'); await p.waitForTimeout(150);
  const cdf=await p.evaluate(()=>{ const T=window.__tally; const s=Object.values(T.state.sections)[0]; const o=T.openSec(s); return s.grades.students.filter((_,i)=>{ const r=T.computeGrade(o,i); return r && /^[CDF]$/.test(r.letter); }).length; });
  const on=await p.$$eval('[data-letter]',bs=>bs.filter(b=>b.classList.contains('on')).map(b=>b.dataset.letter).join(''));
  check(on==='CDF' && (await p.textContent('#rpWeekly small')).startsWith(cdf+' pages'),'By grade starts on C, D and F, and the button counts those students ('+cdf+')');
  await p.click('[data-letter="A"]'); await p.waitForTimeout(100); const withA=await p.textContent('#rpWeekly small'); await p.click('[data-letter="A"]'); await p.waitForTimeout(100);
  check(parseInt(withA)>cdf,'adding A adds its students: '+withA);
  const msgs=[]; p.removeAllListeners('dialog'); p.on('dialog',d=>{ msgs.push(d.message()); d.accept(); });
  const [popB]=await Promise.all([ctx.waitForEvent('page'), p.click('#rpWeekly')]); await popB.waitForLoadState(); await popB.waitForTimeout(300);
  const printedLetters=await popB.$$eval('section.rep .big',es=>es.map(e=>e.textContent.replace(/^\d+%/,'')));
  check(printedLetters.length===cdf && printedLetters.every(l=>/^[CDF]$/.test(l)),'the batch holds exactly the C, D and F students: '+printedLetters.join(''));
  const teach=await popB.evaluate(()=>({ n:document.querySelectorAll('section.teach').length, rows:document.querySelectorAll('section.teach tbody tr').length, boxes:document.querySelectorAll('section.teach .box').length, text:document.querySelector('section.teach').innerText.replace(/\s+/g,' ').slice(0,400) }));
  check(teach.n===1 && teach.rows===cdf && teach.boxes===cdf*2 && /Reports out and back/i.test(teach.text) && /Back, signed/i.test(teach.text),'a batch ends with the teacher\'s page: every student in it, a box for handed out and one for back signed: '+JSON.stringify({n:teach.n,rows:teach.rows,boxes:teach.boxes,cdf})); await popB.close();
  check(msgs.length===1 && /the IXL export is from .*\d+ days ago\. A weekly report wants today's numbers\. Print anyway\?/.test(msgs[0]) && !/Focus gradebook/.test(msgs[0]),'before printing, Tally says the IXL export is not today\'s (the gradebook came in today): "'+msgs[0]+'"');
  await p.evaluate(()=>{ const T=window.__tally; const s=Object.values(T.state.sections)[0]; s.grades.importedAt=new Date(Date.now()-864e5).toISOString(); T.save(); });
  const why=await p.evaluate(()=>{ const T=window.__tally; const s=Object.values(T.state.sections)[0]; return T.staleExports(s,[0]); });
  check(why.length===2 && /Focus gradebook in Tally is from yesterday/.test(why[0]),'a gradebook from yesterday is named too (Croix: a Monday morning print should have a Monday morning grade): '+why.join('; '));
  await p.evaluate(()=>{ const T=window.__tally; const s=Object.values(T.state.sections)[0]; s.grades.importedAt=new Date().toISOString(); T.save(); });
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
  const cfg=(await fullSave(p)).json.state;
  check(cfg.grading && cfg.grading.acc && cfg.grading.acc.cats[0].w===70 && cfg.grading.acc.map && cfg.sections[K].gradeHistory.length===2 && cfg.sections[K].grades,'the full save carries weights, category map, grade history and the gradebook');
  await p.click('#mCancel');
  // 8. no Grade column → guesses flagged; the asker appears for new assignments
  const p2=await ctx.newPage(); p2.on('dialog',d=>d.accept()); await p2.goto('file://'+path.resolve(APP)); await p2.evaluate(()=>localStorage.clear()); await p2.reload(); await p2.waitForTimeout(300);
  const csv=fs.readFileSync('fixtures/focus_gradebook_scrubbed.csv','utf8').split('\n'); const noGrade=csv.map((l,i)=>i===0? l.replace('"Grade",','') : l.replace(/^("[^"]*","[^"]*","[^"]*"),"[^"]*",/,'$1,')).join('\n');
  fs.writeFileSync(path.join(tmp,'nograde.csv'),noGrade);
  await p2.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p2.waitForTimeout(500); await p2.click('#rpSkip'); await p2.waitForTimeout(200);
  await p2.setInputFiles('#file',[path.join(tmp,'nograde.csv')]); await p2.waitForTimeout(500); await pick(p2); await p2.waitForTimeout(500);
  check(/Check 13 categories/.test(await p2.textContent('#modal')) && await p2.locator('select[data-ask]').count()===13,'without a Grade column, the asker lists every new assignment, one dropdown each');
  await p2.selectOption('[data-ask="0"]','Classwork'); await p2.waitForTimeout(100);
  check(await p2.locator('.askcat tr.changed').count()===1 && /Save 1 change/.test(await p2.textContent('#askApply')),'the changed row is marked and the button says how many');
  await p2.click('#askApply'); await p2.waitForTimeout(400);
  const ng=await p2.evaluate(()=>{ const T=window.__tally; const s=Object.values(T.state.sections)[0]; const g=T.gradingFor(s.prep); const other=s.grades.assignments.map(a=>a.name).filter(n=>n!=='Whiteboard Practice Week 9/21'); return {wb:g.map['Whiteboard Practice Week 9/21'], how:g.how['Whiteboard Practice Week 9/21'], ov:s.grades.overall, rest:other.filter(n=>g.how[n]==='user').length}; });
  check(ng.wb==='Classwork' && ng.how==='user' && ng.ov===null && ng.rest===0,'only the row changed becomes yours; the rest stay guesses; no overall column');
  await p2.click('#openGrades'); await p2.waitForTimeout(400); check(/categories are name-based guesses/.test(await p2.textContent('#gridwrap')),'overview says categories are guesses');
  await p2.close();
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
