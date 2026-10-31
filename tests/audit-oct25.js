// The audit of 25 Oct 2026 (Croix: "Can you run an audit and debugging and hardening on everything that we've done
// today"): one check per finding in the weekly report, the signed-reports list, the family section, the FAST report
// and the PDF imports, each written to fail on the code before its fix. The IXL Quickview's own findings are in
// quickview.js.
const { chromium, fs, path, exe, check, done, APP, pick, more } = require('./lib');
const K = '1205050-7T1A';
const timeoutPop = (ctx, ms = 5000) => Promise.race([ctx.waitForEvent('page'), new Promise(r => setTimeout(() => r(null), ms))]);
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1300,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const asks=[]; let dismissNext=false;
  p.on('dialog',d=>{ asks.push(d.message()); if (dismissNext) { dismissNext=false; d.dismiss(); } else d.accept(); });
  await p.goto('file://'+path.resolve(APP));
  // C7: pdf.js is inert text until the first PDF (start-up parses none of it); C11: its element no longer shadows pdf.js's own global
  const boot=await p.evaluate(()=>({ lib:typeof window.pdfjsLib, oldId:!!document.getElementById('pdfjsWorker'), lib2:(document.getElementById('tallyPdfLib')||{}).type, wk:(document.getElementById('tallyPdfWorker')||{}).type }));
  check(boot.lib==='undefined' && !boot.oldId && boot.lib2==='text/plain' && boot.wk==='text/plain','pdf.js and its worker wait as inert text, under ids of their own, until a PDF arrives: '+JSON.stringify(boot));
  // A10: a class held from a backup (its IXL export not in yet) brings its family contacts and notes when the export arrives
  await p.evaluate(K=>{ const T=window.__tally; T.state.pendingCfg[K]={ family:{ 'held student':{ contacts:[{ id:'c1', name:'Pat Held', rel:'Mother', phone:'555-0100', email:'', note:'' }], log:[] } }, stuNotes:{ 'held student':[{ id:'n1', at:'2026-10-01T12:00:00.000Z', text:'kept' }] } }; T.save(); },K);
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  const held=await p.evaluate(K=>{ const s=window.__tally.state.sections[K]; return { fam:!!(s.family||{})['held student'], note:!!(s.stuNotes||{})['held student'] }; },K);
  check(held.fam && held.note,'a class held from a backup keeps its family contacts and notes when its IXL export makes the class: '+JSON.stringify(held));
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const S=await p.evaluate(K=>window.__tally.state.sections[K].grades.students,K);

  // ---- the weekly report --------------------------------------------------------------------------------------------
  // A1: with no step for the student (the IXL already earned reaches the next letter once it is copied), the report
  // said "Nothing missing and every assessment at full marks" to a student with missing work
  const a1=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades; const rows=T.gbRows(s);
    const col=gb.assignments.find(a=>a.name==='Unit 2 IXL'); const u=T.unitsOf(s).find(x=>x.name===(T.gbUnitFor(s,col)||{}).name); const quiz=gb.assignments.find(a=>a.name==='Squares and Cubes Quiz');
    for (let i=0;i<gb.students.length;i++) { const r=rows[i]; if (!r || r.ixl==null || T.points(s,u,r.ixl)<3) continue;
      const keep=gb.assignments.map(a=>[a.values[i],a.status[i]]); const back=()=>keep.forEach(([v,st],k)=>{ gb.assignments[k].values[i]=v; gb.assignments[k].status[i]=st; });
      gb.assignments.forEach(a=>{ if (a===col) { a.values[i]=0; a.status[i]='score'; } else if (a.name==='2.03 Worksheet') { a.values[i]=null; a.status[i]='missing'; } else { a.values[i]=a.max; a.status[i]='score'; } });
      for (let v=quiz.max; v>=0; v-=0.5) { quiz.values[i]=v; const qp=T.quickestPath(s,T.openSec(s),i,r.ixl);
        if (qp && !qp.top && qp.reached && qp.plan.length && qp.plan.every(x=>x.kind==='copy')) { const d=document.createElement('div'); d.innerHTML=T.studentReportSection(s,i,r); back(); return { i, v, txt:d.textContent.replace(/\s+/g,' ') }; } }
      back(); }
    return null; },K);
  const a1t=a1?a1.txt:'';
  check(a1 && /Still missing: 2\.03 Worksheet\. Turn it in this week\./.test(a1t) && !/Nothing missing/.test(a1t) && /Your Unit 2 IXL points go into Focus at the next grade update, and that takes the grade to \d+% [A-D]\./.test(a1t),'a plan the IXL copy alone completes still names the missing work: '+(a1t.match(/DO THIS WEEK.{0,260}/i)||[''])[0]);
  // A2: the tests-and-quizzes figure counts an NHI as 0, as the student page does (since 25 Oct it heads the Tests &
  // quizzes panel; the tile that said "5 gradeds" is gone, so A7 went with it)
  const a2=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades; const rows=T.gbRows(s); const quiz=gb.assignments.find(a=>a.name==='Squares and Cubes Quiz'); const i=quiz.status.indexOf('missing');
    const tests=gb.assignments.filter(a=>T.catOf(s.prep,a.name)==='Assessments' && !/\bixl\b/i.test(a.name) && a.max>0 && (a.status[i]==='score'||a.status[i]==='missing'));
    const want=Math.round(tests.reduce((n,a)=>n+(a.status[i]==='score'?Number(a.values[i])||0:0),0)/tests.reduce((n,a)=>n+a.max,0)*100);
    const d=document.createElement('div'); d.innerHTML=T.studentReportSection(s,i,rows[i]); const head=[...d.querySelectorAll('.panel .ph')].find(x=>/Tests/.test(x.textContent)).textContent.replace(/\s+/g,' ');
    return { i, want, n:tests.length, head, tiles:[...d.querySelectorAll('.board > div small')].map(x=>x.textContent) }; },K);
  check(a2.head.includes(a2.want+'% overall') && /NHI counts as 0/.test(a2.head),'the tests-and-quizzes figure counts the quiz not handed in as 0 ('+a2.want+'%): '+a2.head);
  check(a2.tiles.join('|')==='Missing assignments|IXL at goal|Retake','three tiles: missing assignments, IXL at goal, retake ('+a2.tiles.join(', ')+')');
  // A9: an IXL column marked NHI is listed once, as IXL to finish, not also as work to turn in
  const a9=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades; const rows=T.gbRows(s); const col=gb.assignments.find(a=>a.name==='Unit 1 IXL'); const i=0; const keep=[col.values[i],col.status[i]];
    col.values[i]=null; col.status[i]='missing'; const d=document.createElement('div'); d.innerHTML=T.studentReportSection(s,i,rows[i]); col.values[i]=keep[0]; col.status[i]=keep[1];
    const panel=[...d.querySelectorAll('.panel')].find(x=>/What would move the grade/i.test(x.querySelector('.ph').textContent)); return [...panel.querySelectorAll('tr')].map(tr=>tr.textContent.replace(/\s+/g,' ')).filter(t=>/Unit 1 IXL/.test(t) && !/^All /.test(t)); },K);
  check(a9.length===1 && /at 15\/15/.test(a9[0]) && !/turned in/.test(a9[0]),'an NHI IXL column is one row in "What would move the grade": '+JSON.stringify(a9));
  // A3: one log entry per school week; a second print that week keeps "back, signed" and moves from last week's report
  const a3=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades; const rows=T.gbRows(s); const i=1; const nm=gb.students[i];
    T.logReport(s,i,rows[i]); const key=Object.keys(s.reportLog).find(k=>s.reportLog[k]===T.reportsOf(s,nm));
    const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; const thisMon=T.weekOf(T.todayISO()); const lm=new Date(thisMon+'T12:00:00'); lm.setDate(lm.getDate()-7); const lastMon=iso(lm);
    s.reportLog[key]=[{ date:lastMon, q:null, gb:'', ix:'', grade:50, missing:9, ixl:1, back:lastMon }, { date:thisMon, q:null, gb:'', ix:'', grade:61, missing:3, ixl:2, back:thisMon }];
    const since=text(T.studentReportSection(s,i,rows[i])).match(/Since the last report.{0,120}/); T.logReport(s,i,rows[i]); const l=T.reportsOf(s,nm);
    function text(h){ const d=document.createElement('div'); d.innerHTML=h; return d.textContent.replace(/\s+/g,' '); }
    return { since:since&&since[0], n:l.length, last:l[l.length-1], first:l[0], today:T.todayISO(), lastMon, thisMon }; },K);
  check(a3.n===2 && a3.last.date===a3.today && a3.last.back===a3.thisMon && a3.first.date===a3.lastMon,'a second print in the same week replaces that week\'s entry and keeps its "back, signed" tick: '+JSON.stringify({ n:a3.n, last:a3.last, first:a3.first.date }));
  check(/Grade 50% →/.test(a3.since||''),'"Since the last report" moves from last week\'s report, not from an earlier print this week: '+a3.since);
  // A4: the report and the reminder date Focus by when the file was written; "unchanged since then" compares that time
  const a4=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades; const rows=T.gbRows(s); const i=1; const nm=gb.students[i]; const keep=gb.exportedAt;
    gb.exportedAt=new Date(Date.now()-2*864e5).toISOString(); const two=T.fmtDate(T.localDayOf(gb.exportedAt));
    const key=Object.keys(s.reportLog).find(k=>s.reportLog[k]===T.reportsOf(s,nm)); const l=s.reportLog[key]; l[0].gbAt=gb.exportedAt;
    const tx=h=>{ const d=document.createElement('div'); d.innerHTML=h; return d.textContent.replace(/\s+/g,' '); };
    const r1=tx(T.studentReportSection(s,i,rows[i])); l[0].gbAt='2026-01-01T00:00:00.000Z'; const r2=tx(T.studentReportSection(s,i,rows[i])); gb.exportedAt=keep;
    return { two, head:(r1.match(/Focus as of [A-Z][a-z]+ \d+/)||[''])[0], same:/Focus export unchanged since then/.test(r1), changed:/Focus export unchanged/.test(r2) }; },K);
  check(a4.head==='Focus as of '+a4.two,'the report dates Focus by the file, written two days ago: "'+a4.head+'" (want '+a4.two+')');
  check(a4.same && !a4.changed,'"Focus export unchanged since then" compares the file\'s own time, so a new export with the same import day is not called unchanged');
  // A5: "eligible … IXL at goal" names only the units the check looked at (the unit being worked in may have no Focus column yet)
  const a5=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades; const rows=T.gbRows(s);
    const withCol=new Set(gb.assignments.map(a=>(T.gbUnitFor(s,a)||{}).name).filter(Boolean)); const u=T.unitsOf(s).find(x=>x.num && !withCol.has(x.name)); const i=rows.findIndex(r=>r && r.ixl!=null);
    const keep=gb.assignments.map(a=>[a.values[i],a.status[i]]); const cu=JSON.stringify(T.state.settings.currentUnit||{});
    gb.assignments.forEach(a=>{ a.values[i]=a.max; a.status[i]='score'; }); T.state.settings.currentUnit={ ...(T.state.settings.currentUnit||{}), [s.prep]:u.num };
    const rt=T.retakeStatus(s,gb.students[i]); const d=document.createElement('div'); d.innerHTML=T.studentReportSection(s,i,rows[i]); const line=(d.querySelector('.rt, .howl')||{}).textContent||'';   // 31 Oct: with every assessment full the report prints no retake line; the words come from the student page below
    T.openProfile(K,gb.students[i]); window.__a5back=()=>{ keep.forEach(([v,st],k)=>{ gb.assignments[k].values[i]=v; gb.assignments[k].status[i]=st; }); T.state.settings.currentUnit=JSON.parse(cu); };
    return { ok:rt.ok, cur:u.short, line:line.replace(/\s+/g,' '), checked:rt.checked.map(x=>x.short) }; },K);
  await p.waitForTimeout(300); a5.tile=await p.evaluate(()=>{ const t=((document.querySelector('#pRetake')||{}).innerText||'').replace(/\s+/g,' '); window.__a5back(); delete window.__a5back; return t; });
  check(a5.ok && /nothing missing and Units 1 and 2 IXL at goal/.test(a5.tile) && !a5.tile.includes(a5.cur+' IXL'),'the eligible line names the units Focus grades (Units 1 and 2), not '+a5.cur+', which nothing checked: '+a5.tile.slice(0,160));
  check(/Units 1 and 2 IXL at goal/.test(a5.tile) && !a5.tile.includes(a5.cur+' IXL'),'the student page\'s Retake tile says the same: '+a5.tile);
  await p.click('#back').catch(()=>{}); await p.waitForTimeout(200);
  // A10: names hidden with fresh exports: the question is about the names only
  asks.length=0;
  const popH=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; s.grades.exportedAt=new Date().toISOString(); s.grades.importedAt=s.grades.exportedAt; s._dateKeep=s.date; s.date=T.todayISO(); T.state.settings.hideNames=true; T.printStudentReports(s,[0],'x'); },K).then(()=>timeoutPop(ctx,3000));
  if (popH) await popH.close();
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.state.settings.hideNames=false; s.date=s._dateKeep; delete s._dateKeep; T.save(); },K);
  check(asks.length===1 && /names are hidden/.test(asks[0]) && !/wants today's numbers/.test(asks[0]),'with names hidden and today\'s exports, the question is about the names alone: "'+(asks[0]||'')+'"');
  // A6: a batch says to print one-sided; one student's report does not
  const [popB]=await Promise.all([ctx.waitForEvent('page'), p.evaluate(K=>{ const T=window.__tally; T.printStudentReports(T.state.sections[K],[0,1],'Batch'); },K)]); await popB.waitForLoadState();
  const hint=await popB.evaluate(()=>(document.querySelector('.bar .hint')||{}).textContent||''); const hintPrint=await popB.evaluate(()=>{ const b=document.querySelector('.bar'); return b ? getComputedStyle(b).display : ''; }); await popB.close();
  const [popO]=await Promise.all([ctx.waitForEvent('page'), p.evaluate(K=>{ const T=window.__tally; T.printStudentReports(T.state.sections[K],[0],'One'); },K)]); await popO.waitForLoadState();
  const hint1=await popO.evaluate(()=>!!document.querySelector('.bar .hint')); await popO.close();
  check(hint==='Print two-sided: each student starts on a new sheet.' && !hint1 && hintPrint==='flex','a batch\'s Print bar says how to print it (two-sided, laid out so each student starts on a new sheet); one report does not: "'+hint+'"');
  // batch hardening: one student's bad record leaves a line in place of that report, the rest print, and the teacher is told
  const bad=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const nm=s.grades.students[2]; T.logReport(s,2,T.gbRows(s)[2]); const key=Object.keys(s.reportLog).find(k=>s.reportLog[k]===T.reportsOf(s,nm)); s._bad=key; s.reportLog[key]='junk'; return nm; },K);
  const popX=await Promise.all([timeoutPop(ctx,4000), p.evaluate(K=>{ const T=window.__tally; try { T.printStudentReports(T.state.sections[K],[0,1,2,3],'Batch'); } catch (e) { return String(e); } },K)]).then(r=>r[0]);
  const bx=popX ? await popX.evaluate(()=>({ n:document.querySelectorAll('section.rep.wk:not(.teach)').length, fail:[...document.querySelectorAll('section.rep')].filter(x=>/could not make this report/.test(x.textContent)).length, teach:document.querySelectorAll('section.teach').length })) : null; if (popX) await popX.close();
  const toastX=await p.textContent('#toast');
  await p.evaluate(K=>{ const s=window.__tally.state.sections[K]; s.reportLog[s._bad]=[]; delete s._bad; },K);
  check(bx && bx.n===3 && bx.fail===1 && bx.teach===1 && /1 report could not be made/.test(toastX),'a batch with one unreadable record prints the other three and the checklist, and says which one failed: '+JSON.stringify(bx)+' '+toastX.slice(0,80));
  // the report log as loaded from a file: impossible dates dropped, junk numbers made blank, the file time kept, in date order
  const cl=await p.evaluate(()=>window.__tally.cleanReportLog({ a:[{ date:'2026-13-45', grade:80 }, { date:'2026-10-20', grade:'abc', missing:'x', ixl:'7', q:2.5, gbAt:'2026-10-20T10:00:00.000Z' }, { date:'2026-10-13', back:'2026-10-14', grade:70, q:1 }], __proto__x:[] }));
  check(cl.a && cl.a.length===2 && cl.a[0].date==='2026-10-13' && cl.a[0].back==='2026-10-14' && cl.a[1].grade===null && cl.a[1].missing===0 && cl.a[1].ixl===7 && cl.a[1].q===null && cl.a[1].gbAt==='2026-10-20T10:00:00.000Z','a report log from a file is checked: impossible dates dropped, junk numbers blank, in date order, the file time kept: '+JSON.stringify(cl.a));

  // ---- signed reports and family -------------------------------------------------------------------------------------
  // A8: up to 20 contacts are kept (an eleventh used to vanish at the next load), and Add contact goes away at 20
  const a8=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const nm=s.grades.students[0]; const cs=Array.from({length:25},(_,j)=>({ id:'x'+j, name:'Contact '+j, rel:'Other', phone:'', email:'', note:'' }));
    const kept=T.cleanFamily({ a:{ contacts:cs, log:[] } }).a.contacts.length; T.setFamily(s,nm,{ contacts:cs.slice(0,20), log:[] }); T.save(); T.openProfile(K,nm); window.__cs=cs; window.__nm=nm;
    return { kept }; },K);
  await p.waitForTimeout(300); a8.hidden=await p.evaluate(()=>document.querySelector('#fAdd').classList.contains('hidden'));
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.setFamily(s,window.__nm,{ contacts:window.__cs.slice(0,3), log:[] }); T.save(); T.render(); },K); await p.waitForTimeout(300);
  a8.shown=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const v=!document.querySelector('#fAdd').classList.contains('hidden'); T.setFamily(s,window.__nm,{ contacts:[], log:[] }); T.save(); return v; },K);
  check(a8.kept===20 && a8.hidden && a8.shown,'up to 20 contacts are kept, and Add contact is hidden at 20: '+JSON.stringify(a8));
  await p.click('#back').catch(()=>{}); await p.waitForTimeout(200);
  // A10: Signed reports with the gradebook removed says why the list is empty, not that nothing was printed
  const a10=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades; delete s.grades; T.openReturns(s); const t=document.querySelector('#toast').textContent; s.grades=gb; return t; },K);
  check(/no Focus gradebook right now/.test(a10) && !/no reports have been printed/.test(a10),'Signed reports with the gradebook removed says to import it, since reports were printed: "'+a10+'"');
  // A10: removing a class names what goes with it, family and weekly reports included
  asks.length=0; dismissNext=true; await more(p,'#btnSettings'); await p.waitForTimeout(250); await seeTab(p,'#forget'); await p.click('#forget'); await p.waitForTimeout(300);
  check(asks.length===1 && /family contacts and the contact log/.test(asks[0]) && /weekly reports and signed-report ticks/.test(asks[0]) && /IXL practice/.test(asks[0]),'"Remove this class" names the family log, the weekly reports and the IXL practice among what goes: '+(asks[0]||'').slice(0,240));
  check(await p.evaluate(K=>!!window.__tally.state.sections[K],K),'…and Cancel keeps the class');
  await p.keyboard.press('Escape'); await p.evaluate(()=>{ const m=document.querySelector('#modal'); if (m) { m.classList.add('hidden'); m.innerHTML=''; } }); await p.waitForTimeout(150);
  // C11: a practice record with no last-practiced day reads plainly, never "null days ago"
  const nul=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const nm=s.grades.students[0]; const f=T.findStudent(s,nm); const ix=s.students[f.ixl]; s.practice=s.practice||{}; const k=Object.keys(s.practice).length; s.practice[T.norm(ix)]={ asOf:'2026-10-24', questions:5, minutes:3, last:'', mastered:0, proficient:0, skills:{} }; T.openProfile(K,nm); return ''; },K)
    .then(()=>p.waitForTimeout(300)).then(()=>p.evaluate(()=>((document.querySelector('#pPractice')||{}).innerText||'').replace(/\s+/g,' ')));
  check(nul && !/null/.test(nul) && /Last practiced — not in the Quickview/i.test(nul),'a Quickview without a last-practiced day reads "not in the Quickview": '+nul.slice(0,160));
  await p.evaluate(K=>{ const s=window.__tally.state.sections[K]; s.practice={}; window.__tally.save(); },K); await p.click('#back').catch(()=>{}); await p.waitForTimeout(200);

  // ---- PDFs: drop, one worker, the score report's split tables -------------------------------------------------------
  const g8=fs.readFileSync('fixtures/fast_items_g8.pdf').toString('base64');
  const w=await p.evaluate(async b64=>{ let n=0; const W0=window.Worker; window.Worker=function(...a){ n++; return new W0(...a); }; window.Worker.prototype=W0.prototype;
    const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); const T=window.__tally; await T.pdfTextPages(u8.slice().buffer); await T.pdfTextPages(u8.slice().buffer); await T.pdfTextPages(u8.slice().buffer); window.Worker=W0; return { n, lib:typeof window.pdfjsLib }; }, g8);
  check(w.n<=1 && w.lib==='object','pdf.js starts with the first PDF, and three PDFs in a row read on one worker ('+w.n+' started from file://)');
  // served over http, as GitHub Pages serves Tally, the blob worker really starts: one for every PDF of the session
  { const srv=require('http').createServer((q,r)=>{ r.writeHead(200,{ 'content-type':'text/html; charset=utf-8' }); fs.createReadStream(path.resolve(APP)).pipe(r); }); await new Promise(r=>srv.listen(0,'127.0.0.1',r));
    const hp=await ctx.newPage(); const herr=[]; hp.on('pageerror',e=>herr.push(e.message)); await hp.goto(`http://127.0.0.1:${srv.address().port}/`);
    const hw=await hp.evaluate(async b64=>{ let n=0; const W0=window.Worker; window.Worker=function(...a){ n++; return new W0(...a); }; window.Worker.prototype=W0.prototype;
      const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); const T=window.__tally; const r=[]; for (let k=0;k<3;k++) r.push((await T.pdfTextPages(u8.slice().buffer)).length); window.Worker=W0; return { n, r }; }, g8);
    await hp.close(); srv.close();
    check(hw.n===1 && hw.r.every(x=>x===hw.r[0] && x>1) && !herr.length,'over http, three PDFs read on one real worker ('+hw.n+' started, '+hw.r.join('/')+' pages)'+(herr.length?': '+herr.join(' | '):'')); }
  // C4: a PDF dropped on the window is imported (the drop used to list only spreadsheets and backups)
  await p.evaluate(b64=>{ const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); const dt=new DataTransfer(); dt.items.add(new File([u8],'fast_items_g8.pdf',{ type:'application/pdf' })); document.dispatchEvent(new DragEvent('drop',{ dataTransfer:dt, bubbles:true, cancelable:true })); }, g8); await p.waitForTimeout(3000);
  const dropT=await p.textContent('#toast');
  check(/FAST score report \(PM1 2026-27, Math Grade 8 FAST\): 23 students matched/.test(dropT),'a PDF dropped on Tally is read: '+dropT.slice(0,100));
  // B: a category table that runs onto a page with no header keeps its category
  const carry=await p.evaluate(async b64=>{ const T=window.__tally; const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); const pages=await T.pdfTextPages(u8.buffer);
    const full=T.parseFastItemsPdf(pages); const pi=pages.findIndex((pg,j)=>j>1 && pg.some(i=>/^1\.\s/.test(i.s.trim())) && j>0 && pages[j-1].some(i=>/^1\.\s/.test(i.s.trim())));
    const cut=pages.map((pg,j)=>j===pi ? pg.filter(i=>!/^(1\.\s.*|Performance|Student|FLEID)$/.test(i.s.trim())) : pg); const part=T.parseFastItemsPdf(cut);
    const onPage=pages[pi].filter(i=>/^FL\d{12}$/.test(i.s.trim())).map(i=>i.s.trim()); const cat=full.cats[0];
    const lost=onPage.filter(f=>{ const a=full.students.find(s=>s.fleid===f), b2=part.students.find(s=>s.fleid===f); return a && a.cats[cat] && (!b2 || b2.cats[cat]!==a.cats[cat]); });
    return { pi, n:onPage.length, lost:lost.length }; }, g8);
  check(carry.pi>1 && carry.n>0 && carry.lost===0,'a reporting-category table that runs onto a page without its header keeps its category for the '+carry.n+' students there: '+JSON.stringify(carry));
  // B: the FLEID from the score report survives a Focus FAST re-import for the same student
  const fl=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const nm=s.grades.students[0], id=s.grades.ids[0];
    T.importFast({ students:[{ id, name:nm, grade:7, tests:[{ test:'FAST', pm:'PM1', year:'2026-27', level:2, scale:229 }], info:{ L30:'' } }], blank:0, windows:[{ pm:'PM1', year:'2026-27' }] }, 'focus-again.csv');
    return Object.keys(T.state.testInfo).filter(k=>k==='id:'+id || k.startsWith('n:')).map(k=>T.state.testInfo[k].FAST.fields).filter(f=>f.ID===id).map(f=>f.FLEID); },K);
  check(fl.length>0 && fl.every(Boolean),'the FLEID from the score report is kept when the Focus FAST report comes in again: '+JSON.stringify(fl));

  // ---- the FAST report -------------------------------------------------------------------------------------------------
  // B: "this year" when the newest results are all PM3 is the year after them (a Focus report pulled in August holds only last spring)
  const yr=await p.evaluate(()=>{ const T=window.__tally; const keep=T.state.tests; T.state.tests={ 'n:x':[{ test:'FAST', pm:'PM3', year:'2025-26', scale:240 }] }; const a=T.fastYearNow(); T.state.tests={ 'n:x':[{ test:'FAST', pm:'PM3', year:'2025-26', scale:240 }, { test:'FAST', pm:'PM1', year:'2026-27', scale:241 }] }; const b2=T.fastYearNow(); T.state.tests=keep; return [a,b2]; });
  check(yr[0]==='2026-27' && yr[1]==='2026-27','only PM3s on file means the year after them is this year; a PM1 settles it: '+yr.join(', '));
  // B: last year's PM3 from the Seating Chart stays when only this year's windows are imported, and sets the gain target
  const seat=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const nm=s.grades.students[5]; const f=T.findStudent(s,nm); const key=f.row && f.row.display ? f.row.display : nm; s.seatInfo=s.seatInfo||{}; s.seatInfo[key]={ level:3, scale:232, pct:55 };
    T.importFast({ students:[{ id:s.grades.ids[5], name:nm, grade:7, tests:[{ test:'FAST', pm:'PM1', year:'2026-27', level:2, scale:233 }], info:{} }], blank:0, windows:[{ pm:'PM1', year:'2026-27' }] }, 'pm1.csv');
    const t=T.fastTargets(s,nm); return { prior:t && t.prior && t.prior.scale, gain:t && t.gain && t.gain.score }; },K);
  check(seat.prior===232 && seat.gain>0,'a Seating Chart PM3 from last year stays beside an imported PM1 and gives the gain target: '+JSON.stringify(seat));
  // B: the test grade comes from the newest window that names one; an accelerated grade-8 class does not ask for a grade-9 table
  const gr=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const nm=s.grades.students[6], id=s.grades.ids[6];
    T.importFast({ students:[{ id, name:nm, grade:7, tests:[{ test:'FAST', pm:'PM3', year:'2025-26', level:3, scale:233, grade:6 }, { test:'FAST', pm:'PM1', year:'2026-27', level:2, scale:236, grade:8 }, { test:'FAST', pm:'PM2', year:'2026-27', level:2, scale:228, grade:7 }], info:{} }], blank:0, windows:[] }, 'g.csv');
    const a=T.fastTargets(s,nm).gradeNow; const nm2=s.grades.students[7], id2=s.grades.ids[7];
    T.importFast({ students:[{ id:id2, name:nm2, grade:8, tests:[], info:{ GradeLevel:'08' } }], blank:0, windows:[] }, 'g8.csv');
    T.testKeys(id2,nm2).forEach(k=>{ T.state.tests[k]=[{ test:'FAST', pm:'PM3', year:'2025-26', scale:240 }, { test:'FAST', pm:'PM1', year:'2026-27', scale:250 }]; });   // no window names its test or level
    let b2, err=''; try { b2=T.fastTargets(s,nm2).gradeNow; T.fastReportSection(s,nm2); } catch (e) { err=String(e); } return { a, b:b2, err }; },K);
  check(gr.a===7,'the test grade comes from the newest window that names one (PM2 on the grade-7 test after a grade-8 PM1): '+gr.a);
  check(gr.b===8 && !gr.err,'an accelerated student in grade 8 stays on the grade-8 table (there is no grade-9 FAST table) and the report is made: '+JSON.stringify(gr));
  // B: the chart is left out for a test with no table, rather than breaking the report
  const ch=await p.evaluate(()=>{ try { return JSON.stringify(window.__tally.fastLineChart({ gradeNow:9, prior:null, now:[], gain:null })); } catch (e) { return 'threw '+e; } });
  check(ch==='""','no chart for a grade the state tables don\'t cover: '+ch);
  // the report itself, for a student with PM1, PM2 missed, PM3, scores close together, one a point short of the gain
  const CATS={ '1. Number Sense and Operations and Probability':'near','2. Algebraic Reasoning':'below','3. Linear Relationships, Data Analysis and Functions':'near','4. Geometric Reasoning':'above' };
  const fr=await p.evaluate(({K,CATS})=>{ const T=window.__tally; const s=T.state.sections[K]; const nm=s.grades.students[8], id=s.grades.ids[8];
    T.importFast({ students:[{ id, name:nm, grade:7, tests:[{ test:'FAST', pm:'PM3', year:'2025-26', level:3, scale:234, pct:50, grade:6 }], info:{} }], blank:0, windows:[] }, 'r.csv');
    const g=T.fastTargets(s,nm).gain.score;   // one point short of it on PM3, two short on PM1, PM2 missed
    T.importFast({ students:[{ id, name:nm, grade:7, tests:[{ test:'FAST', pm:'PM1', year:'2026-27', scale:g-2, pct:51, cats:CATS }, { test:'FAST', pm:'PM3', year:'2026-27', scale:g-1, pct:52, cats:CATS }], info:{} }], blank:0, windows:[] }, 'r2.csv');
    const t=T.fastTargets(s,nm); const lv=T.fastBucket(t.gradeNow,g-1).level; return { nm, gain:t.gain && t.gain.score, gradeNow:t.gradeNow, lo:T.fastLevelFloor(t.gradeNow,lv), hi:T.fastLevelFloor(t.gradeNow,lv+1) }; },{K,CATS});
  const [fp]=await Promise.all([ctx.waitForEvent('page'), p.evaluate(({K,nm})=>window.__tally.printFastReports(window.__tally.state.sections[K],[nm],'FAST'),{K,nm:fr.nm})]); await fp.waitForLoadState(); await fp.waitForTimeout(400);
  const fx=await fp.evaluate(()=>({ txt:document.body.innerText.replace(/\s+/g,' '), sub:[...document.querySelectorAll('svg.fline text')].map(t=>t.textContent), gainX:[...document.querySelectorAll('svg.fline text')].filter(t=>t.textContent==='gain').map(t=>Number(t.getAttribute('x'))), pills:[...document.querySelectorAll('.cards .lv small')].map(x=>x.textContent), groups:[...document.querySelectorAll('.marks:not(.under) .mk')].map(m=>m.dataset.n), pledge:getComputedStyle(document.querySelector('.rep.fast .pledge')).breakInside }));
  check(/and 1 more point is needed for a gain\./.test(fx.txt),'one point short reads "1 more point is needed": '+(fx.txt.match(/On the PM\d.{0,110}/)||[''])[0]);
  check(fx.sub.includes('missed') && fx.gainX.length===1 && fx.gainX[0]>=296,'the chart marks a window that was missed and puts the gain label in the right margin: '+JSON.stringify({ sub:fx.sub.filter(x=>/missed|Dec|May|gain/.test(x)), gainX:fx.gainX }));
  check(fx.groups.includes('2') || fx.groups.includes('3'),'scores a point apart share one mark with a line per window: '+JSON.stringify(fx.groups));
  check(fx.pledge==='avoid','the goal box never splits across two pages');
  const pill=fx.pills.find(x=>x.startsWith(String(fr.lo)+'–')); check(pill===`${fr.lo}–${fr.hi-1}`,'a level pill gives the level\'s own range, ending one below the next level ('+pill+')');
  await fp.close();
  // B: every window and four topics still print on one page, with no mark cut off at either end of a bar
  const fits=[];
  for (const [j,c] of [[168,201,203,205],[247,245,246,248],[290,288,289,291],[231,229,240,251]].entries()) {
    const nm=await p.evaluate(({K,j,c,CATS})=>{ const T=window.__tally; const s=T.state.sections[K]; const n=s.grades.students[10+j]; const id=s.grades.ids[10+j];
      T.importFast({ students:[{ id, name:n, grade:7, tests:[{test:'FAST',pm:'PM3',year:'2025-26',level:T.fastBucket(6,c[0]).level,scale:c[0],pct:40,grade:6},{test:'FAST',pm:'PM1',year:'2026-27',scale:c[1],pct:41,cats:CATS},{test:'FAST',pm:'PM2',year:'2026-27',scale:c[2],pct:44,cats:CATS},{test:'FAST',pm:'PM3',year:'2026-27',scale:c[3],pct:47,cats:CATS}], info:{} }], blank:0, windows:[] }, 'fit.csv'); return n; },{K,j,c,CATS});
    const [pop]=await Promise.all([ctx.waitForEvent('page'), p.evaluate(({K,nm})=>window.__tally.printFastReports(window.__tally.state.sections[K],[nm],'FAST'),{K,nm})]); await pop.waitForLoadState(); await pop.waitForTimeout(300);
    const pages=((await pop.pdf({format:'Letter'})).toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
    const clipped=await pop.evaluate(()=>[...document.querySelectorAll('.mk')].filter(k=>{ const r=k.getBoundingClientRect(), sr=k.closest('.scale').getBoundingClientRect(); return r.left<sr.left-1 || r.right>sr.right+1; }).length);
    fits.push({ c:c.join('/'), pages, clipped }); await pop.close();
  }
  check(fits.every(f=>f.pages===1 && f.clipped===0),'PM3 last year and PM1, PM2, PM3 this year with four topics print on one page, every mark inside its bar: '+JSON.stringify(fits));
  // FAST batch hardening: one student's bad record does not blank the batch
  const fb=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const a=s.grades.students[8], c=s.grades.students[9]; const key='id:'+s.grades.ids[9]; T.state._keepT=T.state.tests[key]; const odd={ test:'FAST', pm:'PM1', year:'2026-27' }; Object.defineProperty(odd,'scale',{ get(){ throw new Error('unreadable record'); }, enumerable:false }); T.state.tests[key]=[odd]; return [a,c,key]; },K);   // a record that throws when read, for this one student
  const popF=await Promise.all([timeoutPop(ctx,4000), p.evaluate(({K,fb})=>{ try { window.__tally.printFastReports(window.__tally.state.sections[K],[fb[0],fb[1]],'FAST batch'); } catch (e) { return String(e); } },{K,fb})]).then(r=>r[0]);
  const fbx=popF ? await popF.evaluate(()=>({ fast:document.querySelectorAll('section.rep.fast').length, fail:[...document.querySelectorAll('section.rep')].filter(x=>/could not make this report/.test(x.textContent)).length, hint:(document.querySelector('.bar .hint')||{}).textContent||'' })) : null; if (popF) await popF.close();
  await p.evaluate(fb=>{ const T=window.__tally; T.state.tests[fb[2]]=T.state._keepT; delete T.state._keepT; T.save(); },fb);
  check(fbx && fbx.fast===1 && fbx.fail===1 && /two-sided/.test(fbx.hint),'a FAST batch with one unreadable record prints the other report and a line in its place: '+JSON.stringify(fbx));

  console.log('errors:',errs); check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
