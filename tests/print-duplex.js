// Two-sided printing and every class in one print (Croix, 25 Oct 2026: "I do print 2 sided. Id also like a way to
// print all classes in one go"). Chrome ignores `break-before: right`, so a print page lays itself out in page-sized
// boxes and gives a report that ends on a front a blank back: each student starts on a new sheet. Checked against the
// PDF Chrome itself prints: the boxes are the pages, every report starts on an odd page, backs mirror the punch margin.
const { chromium, fs, path, exe, check, done, APP, pick } = require('./lib');
const K1 = '1205050-7T1A', K2 = '1205050-7T2B';
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1300,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const asks=[]; p.on('dialog',d=>{ asks.push(d.message()); d.accept(); });
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  await p.setInputFiles('#file',[path.resolve('fixtures/fast_items_g8.pdf')]); await p.waitForTimeout(2500);
  // a second class: the first one's copy as 2nd period
  await p.evaluate(({K1,K2})=>{ const T=window.__tally; const c=JSON.parse(JSON.stringify(T.state.sections[K1])); c.key=K2; c.label='2nd Period · Accelerated'; c.period=2; c.reportLog={}; T.state.sections[K2]=c; T.state.order.push(K2); T.state.active=K1; T.save(); T.render(); },{K1,K2});
  await p.waitForTimeout(300);
  // the PDF a print page makes, read back page by page
  const pdfOf=async pop=>{ const pdf=await pop.pdf({format:'Letter', preferCSSPageSize:true}); const n=(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
    const pages=await p.evaluate(async b64=>{ const T=window.__tally; const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); return (await T.pdfTextPages(u8.buffer)).map(pg=>{ const its=pg.filter(i=>i.s.trim()); return { t:its.map(i=>i.s).join(' '), x:its.length?Math.min(...its.map(i=>i.x)):null }; }); }, pdf.toString('base64'));
    return { n, pages }; };
  const paged=async pop=>{ await pop.waitForLoadState(); await pop.waitForFunction(()=>document.body.getAttribute('data-paged')==='1', null, {timeout:30000}); };
  // what a paged print page holds: per section, its pages; the ones that overflow their box
  const layoutOf=pop=>pop.evaluate(()=>({ secs:[...document.querySelectorAll('body>section')].map(s=>({ cls:s.className, pages:s.querySelectorAll('.page').length, blank:s.querySelectorAll('.page.blank').length, head:(s.querySelector('.course,h1')||{}).textContent||'' })), divs:document.querySelectorAll('.page').length, over:[...document.querySelectorAll('.page')].filter(x=>x.scrollHeight>x.clientHeight+1).length }));
  const startsOdd=lay=>{ let at=0; const bad=[]; lay.secs.forEach((s,i)=>{ if (at%2) bad.push(i); at+=s.pages; }); return bad; };

  // 1. the menu: this class or every class, and two-sided printing on unless unticked
  await p.click('#btnPrint'); await p.waitForTimeout(300);
  const m1=await p.evaluate(()=>({ scope:[...document.querySelectorAll('#rpScope button')].map(b=>b.textContent.replace(/\s+/g,' ').trim()+':'+b.getAttribute('aria-pressed')), dup:document.querySelector('#rpDuplex').checked, every:document.querySelector('[data-who="all"] small').textContent, title:document.querySelector('#modal h2').textContent }));
  check(m1.scope.length===2 && /1st Period · Accelerated:true/.test(m1.scope[0]) && /All classes 2:false/.test(m1.scope[1]) && m1.dup && m1.every==='23' && /Print · 1st Period/.test(m1.title),'Print offers this class or all classes, with two-sided printing ticked: '+JSON.stringify(m1));
  await p.click('[data-scope="all"]'); await p.waitForTimeout(300);
  const m2=await p.evaluate(()=>({ every:document.querySelector('[data-who="all"] small').textContent, weekly:document.querySelector('#rpWeekly small').textContent, fast:document.querySelector('#rpFast small').textContent, title:document.querySelector('#modal h2').textContent, owed:[...document.querySelectorAll('[data-owed]')].map(b=>b.textContent.replace(/\s+/g,' ').trim()) }));
  check(m2.title==='Print · All classes' && m2.every==='46' && /^46 students, 2 classes/.test(m2.weekly) && /^46 students/.test(m2.fast) && /A list per class, initials/.test(m2.owed.join('|')),'All classes counts every class\'s students: '+JSON.stringify(m2));
  // 2. the weekly reports for every class, two-sided: each class's reports, then its checklist; every report on a new sheet
  await p.evaluate(K2=>{ const T=window.__tally; const s=T.state.sections[K2]; s.grades.exportedAt=new Date(Date.now()-3*864e5).toISOString(); },K2);
  asks.length=0; const [w]=await Promise.all([ctx.waitForEvent('page'), p.click('#rpWeekly')]); await paged(w);
  const ask1=asks[0]||'';
  check(/the Focus gradebook in Tally is from .*3 days ago \(2nd Period · Accelerated\)/.test(ask1) && /the IXL export is from .*\(every class\)/.test(ask1),'before printing every class, the old exports are named once each, with the classes they belong to: '+ask1.slice(0,260));
  const L=await layoutOf(w); const P=await pdfOf(w);
  const kinds=L.secs.map(s=>/teach/.test(s.cls)?'C':'W').join('');
  check(kinds==='W'.repeat(23)+'C'+'W'.repeat(23)+'C' && /1st Period/.test(L.secs[23].head) && /2nd Period/.test(L.secs[47].head),'one print holds 1st period\'s 23 reports and its checklist, then 2nd period\'s');
  check(L.divs===P.n && L.over===0,'the laid-out pages are the printed pages ('+L.divs+' boxes, '+P.n+' pages in the PDF), none cut short');
  const odd=startsOdd(L); check(odd.length===0,'every report and each checklist starts on a front (an odd page), so no sheet holds two students'+(odd.length?': '+odd.slice(0,5).join(','):''));
  check(L.secs.slice(0,-1).every(s=>s.pages%2===0) && L.secs.every(s=>s.blank<=1) && L.secs.some(s=>s.blank===1),'a report that ends on a front gets one blank back; none gets two');
  const heads=P.pages.map((pg,i)=>/WEEKLY PROGRESS REPORT/.test(pg.t)?i+1:0).filter(Boolean);
  check(heads.length===46 && heads.every(n=>n%2===1) && P.pages.filter(pg=>/REPORTS OUT AND BACK/i.test(pg.t)).length===2,'in the PDF, all 46 reports begin on odd pages and the two checklists print');
  const back=P.pages.findIndex((pg,i)=>i%2===1 && pg.t.trim()); const front=P.pages[back-1];
  check(back>0 && front.x!=null && P.pages[back].x!=null && front.x-P.pages[back].x>30,'a back carries the wide margin on the right, so the punch holes stay clear on both sides (front text at '+(front&&front.x)+' pt, back at '+(back>0&&P.pages[back].x)+' pt)');
  check(P.pages.some(pg=>/IXL STILL OWED \(continued\)/i.test(pg.t)),'an IXL list that runs past the back says "continued"');
  check(P.pages.every((pg,i)=>!/WEEKLY PROGRESS REPORT/.test(pg.t) || (i+1<P.pages.length && /^MISSING ASSIGNMENTS/.test(P.pages[i+1].t.trim()))),'every report\'s back starts with its missing assignments (the IXL still owed after them)');
  const logged=await p.evaluate(({K1,K2})=>{ const T=window.__tally; return [K1,K2].map(k=>Object.keys(T.state.sections[k].reportLog||{}).length); },{K1,K2});
  check(logged[0]===23 && logged[1]===23,'printing every class logs every report, in its own class: '+logged.join(' + '));
  await w.close();
  // 3. one student's report: no blank page at the end
  const [one]=await Promise.all([ctx.waitForEvent('page'), p.evaluate(K1=>{ const T=window.__tally; T.printStudentReports(T.state.sections[K1],[0],'One'); },K1)]); await paged(one);
  const L1=await layoutOf(one); const P1=await pdfOf(one);
  check(L1.secs.length===1 && L1.secs[0].blank===0 && P1.n===L1.divs && !(await one.$('.bar .hint')),'one student\'s report ends where it ends ('+P1.n+' pages, no blank back)');
  await one.close();
  // 4. FAST reports for every class: each on its own sheet
  await p.evaluate(K1=>{ const T=window.__tally; T.openPrintMenu(T.state.sections[K1]); },K1); await p.waitForTimeout(300);
  const [fp]=await Promise.all([ctx.waitForEvent('page'), p.click('#rpFast')]); await paged(fp);
  const LF=await layoutOf(fp); const PF=await pdfOf(fp);
  check(LF.secs.length===46 && startsOdd(LF).length===0 && LF.divs===PF.n && PF.pages.filter((pg,i)=>i%2===1).every(pg=>!pg.t.trim()),'46 FAST reports for both classes, each one page with a blank back ('+PF.n+' pages)');
  await fp.close();
  // 5. IXL still owed for every class: a slip per student on its own sheet; a list per class, each starting on a front
  await p.evaluate(K1=>window.__tally.openPrintMenu(window.__tally.state.sections[K1]),K1); await p.waitForTimeout(300);
  const [sp]=await Promise.all([ctx.waitForEvent('page'), p.click('[data-owed="slips"]')]); await paged(sp);
  const LS=await layoutOf(sp); const PS=await pdfOf(sp);
  check(LS.secs.length===46 && startsOdd(LS).length===0 && LS.divs===PS.n && /1st Period · Accelerated · IXL export of/.test(PS.pages[0].t),'slips for every class: one per student, each on its own sheet, each with its class and export date ('+PS.n+' pages)');
  await sp.close();
  await p.evaluate(K1=>window.__tally.openPrintMenu(window.__tally.state.sections[K1]),K1); await p.waitForTimeout(300);
  const [lp]=await Promise.all([ctx.waitForEvent('page'), p.click('[data-owed="initials"]')]); await paged(lp);
  const LL=await layoutOf(lp); const PL=await pdfOf(lp); const hint=await lp.evaluate(()=>(document.querySelector('.bar .hint')||{}).textContent);
  check(LL.secs.length===2 && /Still owed · 1st Period/.test(LL.secs[0].head) && /Still owed · 2nd Period/.test(LL.secs[1].head) && startsOdd(LL).length===0 && LL.divs===PL.n && hint==='Print two-sided: each class starts on a new sheet.','a list per class, the second starting on a new sheet: '+LL.secs.map(s=>s.pages).join('+')+' pages · '+hint);
  const lasts=await p.evaluate(K1=>window.__tally.state.sections[K1].grades.students.map(n=>n.split(',')[0].trim()),K1); const ltxt=PL.pages.map(pg=>pg.t).join(' ');
  check(lasts.length===23 && !lasts.some(n=>new RegExp('\\b'+n+'\\b').test(ltxt)),'the initials list prints no student\'s name');
  await lp.close();
  // 6. one-sided: untick it and the same pages print with no blank backs and the punch margin on the left of every
  // page (25 Oct 2026: the layout runs one-sided too, so the signatures sit at the foot of the front); the choice is kept
  await p.evaluate(K1=>window.__tally.openPrintMenu(window.__tally.state.sections[K1]),K1); await p.waitForTimeout(300);
  await p.click('#rpDuplex'); await p.waitForTimeout(100);
  check(await p.evaluate(()=>window.__tally.state.settings.duplex===false),'unticking two-sided is kept in settings');
  await p.click('[data-scope="class"]'); await p.waitForTimeout(300);
  check(await p.evaluate(()=>!document.querySelector('#rpDuplex').checked),'…and the menu opens with it unticked');
  await p.reload(); await p.waitForTimeout(800); await p.evaluate(K1=>{ const T=window.__tally; T.state.active=K1; T.render(); },K1); await p.waitForTimeout(300);
  check(await p.evaluate(()=>window.__tally.state.settings.duplex===false),'…and after Tally is opened again');
  await p.evaluate(K1=>window.__tally.openPrintMenu(window.__tally.state.sections[K1]),K1); await p.waitForTimeout(300);
  const [os]=await Promise.all([ctx.waitForEvent('page'), p.click('#rpWeekly')]); await paged(os);
  const o=await os.evaluate(()=>({ paged:document.body.classList.contains('paged'), duplex:document.body.classList.contains('duplex'), blank:document.querySelectorAll('.page.blank').length, backs:document.querySelectorAll('.page.back').length, hint:(document.querySelector('.bar .hint')||{}).textContent, left:[...document.styleSheets].some(ss=>[...ss.cssRules].some(r=>/@page :left/.test(r.cssText))) }));
  const LO=await layoutOf(os); const PO=await pdfOf(os); const headsO=PO.pages.map((pg,i)=>/WEEKLY PROGRESS REPORT/.test(pg.t)?i:-1).filter(i=>i>=0);
  check(o.paged && !o.duplex && !o.blank && !o.backs && !o.left && o.hint==='Print one-sided so no sheet holds two students.' && LO.divs===PO.n && LO.over===0 && PO.pages.every(pg=>pg.t.trim() && pg.x>=70),'one-sided printing lays out the same pages with no blank backs and the punch margin on the left of every page ('+PO.n+' pages): '+JSON.stringify(o));
  check(headsO.length===23 && LO.secs.filter(s=>!/teach/.test(s.cls)).length===23 && LO.secs.every(s=>!s.blank),'…each of the 23 reports starts a page of its own');
  await os.close();
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.duplex=true; T.save(); });
  console.log('errors:',errs); check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
