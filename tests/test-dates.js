// Test dates and the signatures (Croix, 25 Oct 2026, with the "All test dates" lists from mrshaffer.org/a7 and /m7:
// "Can you use the space on the front to add in a test reminder of when the next scheduled test is. Give me an option
// in settings to update them if I need to later"; and "take the signatures out of the box, move it to the bottom, and
// give more space"). The 2026-27 lists are there from the start, the weekly report's front names the course's next
// test, Settings → Course → Test dates edits them, and the signatures sit unboxed at the foot of the front.
const { chromium, fs, path, exe, check, done, APP, pick, fullSave } = require('./lib');
const K = '1205050-7T1A';
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1300,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  // 1. the lists Croix sent, there from the start
  const d0=await p.evaluate(()=>{ const T=window.__tally; const t=T.state.testDates; const on9=t.on.find(x=>x.unit==='Unit 9');
    return { acc:t.acc.length, on:t.on.length, first:t.acc[0], on9, u89:t.acc.find(x=>x.unit==='Units 8–9'), last:t.acc[t.acc.length-1] }; });
  check(d0.acc===13 && d0.on===11 && d0.first.unit==='Unit 3' && d0.first.from==='2026-10-15' && d0.on9.from==='2026-11-02' && d0.on9.to==='2026-11-03' && d0.on9.title==='Algebraic Expressions' && d0.u89.from==='2027-02-18' && d0.last.unit==='Unit 17' && d0.last.from==='2027-04-15','a new Tally holds the 2026-27 test dates: 13 accelerated, 11 on-level (two days each): '+JSON.stringify(d0.on9));
  const nx=await p.evaluate(()=>{ const T=window.__tally; const n=(p,d)=>{ const x=T.nextTest(p,d); return x?x.unit+' '+x.from:'none'; };
    return { a1:n('acc','2026-10-25'), a2:n('acc','2026-10-26'), a3:n('acc','2026-10-27'), o1:n('on','2026-11-03'), o2:n('on','2026-11-04'), end:n('acc','2027-04-16'), oend:n('on','2027-04-29'),
      d1:T.testDays(T.nextTest('acc','2026-10-25')), d2:T.testDays(T.nextTest('on','2026-10-25')), d3:T.testDays({ from:'2026-12-04', to:'2026-12-07' }),
      nums:['Unit 4','Units 8–9','Units 15–16','Units 8 and 9','Unit 10','Units 3-5'].map(T.testUnitNums) }; });
  check(nx.a1==='Unit 4 2026-10-26' && nx.a2==='Unit 4 2026-10-26' && nx.a3==='Unit 5 2026-11-05' && nx.o1==='Unit 9 2026-11-02' && nx.o2==='Unit 10 2026-11-19' && nx.end==='none' && nx.oend==='none','the next test: the day of a test still counts, and so does a two-day test\'s second day; none after the last: '+JSON.stringify(nx).slice(0,200));
  check(nx.d1==='Monday, Oct 26' && nx.d2==='Monday, Nov 2 and Tuesday, Nov 3' && nx.d3==='Friday, Dec 4 to Monday, Dec 7','the days read as a family reads them: '+[nx.d1,nx.d2,nx.d3].join(' | '));
  check(JSON.stringify(nx.nums)==='[[4],[8,9],[15,16],[8,9],[10],[3,4,5]]','a test\'s units come from its label: '+JSON.stringify(nx.nums));
  const cl=await p.evaluate(()=>{ const T=window.__tally; return T.cleanTestDates({ acc:[{ unit:' Unit 2 ', title:'<b>x</b>', from:'2026-11-01', to:'2026-10-01' }, { unit:'Unit 1', from:'2026-02-30' }, 5, null, { unit:'', title:'', from:'', to:'' }, { from:'2026-11-02', to:'2026-11-03' }], on:'junk' }); });
  check(cl.acc.length===3 && cl.acc[0].unit==='Unit 2' && cl.acc[0].title==='<b>x</b>' && cl.acc[0].to==='' && cl.acc[1].from==='' && cl.acc[2].to==='2026-11-03' && cl.on.length===11,'stored dates are cleaned: a last day before the day, a day that does not exist and empty rows go; a course with no list gets the 2026-27 one: '+JSON.stringify(cl.acc));

  // the class: IXL, roster, gradebook
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  // dates around today, so the suite reads the same on any day: Unit 3 last week, Unit 4 in three days (no name: the IXL unit's), Unit 5 later
  const who=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const day=n=>{ const d=new Date(T.todayISO()+'T12:00:00'); d.setDate(d.getDate()+n); return T.localDayOf(d.toISOString()); };
    T.state.testDates.acc=[{ unit:'Unit 3', title:'Exponents and Scientific Notation', from:day(-5), to:'' }, { unit:'Unit 4', title:'', from:day(3), to:'' }, { unit:'Unit 5', title:'Multi-Step Proportional Relationships', from:day(10), to:'' }];
    T.state.settings.teacherName='Mr. Shaffer'; T.save(); const rows=T.gbRows(s); const linked=rows.map((r,i)=>r&&r.ixl!=null?i:-1).filter(i=>i>=0); const unlinked=rows.findIndex(r=>!r||r.ixl==null);
    return { a:linked[0], c:linked[2], unlinked, d3:day(3), d1:day(1), d2:day(2), d10:day(10) }; },K);
  const report=i=>p.evaluate(({K,i})=>{ const T=window.__tally; const s=T.state.sections[K]; const d=document.createElement('div'); d.innerHTML=T.studentReportSection(s,i,T.gbRows(s)[i]); document.body.appendChild(d);
    const txt=x=>x?x.textContent.replace(/\s+/g,' ').trim():''; const nt=d.querySelector('.panel.next'); const col=d.querySelector('.two > .col');
    const u4=[...d.querySelectorAll('.panel.ixl .u')].find(u=>/^Unit 4\b/.test(txt(u.querySelector('.uh'))));
    const out={ next:txt(nt), when:txt(nt&&nt.querySelector('.ntd')), unit:txt(nt&&nt.querySelector('.ntu')), ixl:txt(nt&&nt.querySelector('.ntx')), col:col?[...col.children].map(x=>x.className).join(','):'', back:u4?txt(u4.querySelector('.uh > b')):'',
      sigs:[...d.querySelectorAll('.sigs small')].map(x=>x.textContent).join(' | '), sigBoxed:!!d.querySelector('.pledge .sigs, .pledge .sig'), sigLast:(()=>{ const kids=[...d.querySelector('section.rep').children]; const k=kids.findIndex(x=>x.classList.contains('sigs')); return kids[k-1]&&kids[k-1].className+'>'+(kids[k+1]&&kids[k+1].className); })() };
    d.remove(); return out; },{K,i});
  const fmt=d=>p.evaluate(d=>window.__tally.testDays({ from:d, to:'' }),d);
  // 2. the front names the next test, under the tests and quizzes; a name left blank takes the IXL unit's
  const A=await report(who.a);
  check(A.when===await fmt(who.d3) && A.unit==='Unit 4 Solving Problems with Rational Numbers' && /^panel\s+,panel next$|panel ,panel next/.test(A.col) && !A.ixl,'the next test prints in its own panel under "Tests & quizzes": '+A.next+' ('+A.col+')');
  // 3. with Unit 4 on the IXL list, where the student stands on it, the same count as the back
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.state.assigned.acc[T.unitsOf(s).find(u=>u.num===4).name]=true; T.save(); },K);
  const A2=await report(who.a); const [at,of]=(A2.back.match(/(\d+) \/ (\d+)/)||[]).slice(1).map(Number);
  check(of>0 && !A2.ixl && !/IXL|at goal/.test(A2.next) && A2.unit==='Unit 4 Solving Problems with Rational Numbers','the panel is the day and the unit only, with no line on the unit\'s IXL even when Unit 4 is on the list (Croix: "Get rid of the all ixl skills line in the next test box"): '+A2.next);
  if (who.unlinked>=0) { const U=await report(who.unlinked); check(U.when && !U.ixl,'a student with no IXL link gets the same panel: '+U.next); }
  // 4. a test over two days, and a name given in the dates over the IXL unit's
  await p.evaluate(({K,who})=>{ const T=window.__tally; T.state.testDates.acc[1]={ unit:'Unit 4', title:'Rational Numbers', from:who.d1, to:who.d2 }; },{K,who});
  const A3=await report(who.a); const two=await p.evaluate(who=>window.__tally.testDays({ from:who.d1, to:who.d2 }),who);
  check(A3.when===two && / and /.test(two) && A3.unit==='Unit 4 Rational Numbers','a two-day test prints both days ("'+two+'"), and the name typed in the dates wins over IXL\'s: '+A3.unit);
  // 5. nothing ahead: no panel
  await p.evaluate(({K})=>{ const T=window.__tally; T.state.testDates.acc=T.state.testDates.acc.slice(0,1); },{K});
  const A4=await report(who.a);
  check(!A4.next && A4.col==='panel ','with no test ahead, the front has no test panel: '+JSON.stringify(A4.col));
  // 6. the signatures: their own block after the plan, out of any box, two lines each
  check(A4.sigs==='Student signature | Date | Parent or guardian signature | Date' && !A4.sigBoxed && /^pledge>panel miss/.test(A4.sigLast),'the signatures: student and parent or guardian, each with a date, after the plan box and outside it: '+A4.sigs+' · '+A4.sigLast);
  await p.evaluate(({K,who})=>{ const T=window.__tally; T.state.testDates.acc=[{ unit:'Unit 4', title:'', from:who.d3, to:'' }, { unit:'Unit 5', title:'Multi-Step Proportional Relationships', from:who.d10, to:'' }]; T.save(); },{K,who});

  // 7. printed, two-sided and one-sided: the signatures at the foot of the front, unboxed, with room to sign
  const printed=async (dup)=>{ await p.evaluate(dup=>{ window.__tally.state.settings.duplex=dup; },dup);
    const [pop]=await Promise.all([ctx.waitForEvent('page'), p.evaluate(({K,who})=>{ const T=window.__tally; T.printStudentReports(T.state.sections[K],[who.a,who.c],'Two'); },{K,who})]);
    await pop.waitForLoadState(); await pop.waitForFunction(()=>document.body.getAttribute('data-paged')==='1');
    const lay=await pop.evaluate(()=>[...document.querySelectorAll('body>section.wk:not(.teach)')].map(s=>{ const pg=s.querySelector('.page'); const sg=s.querySelector('.sigs'); const cs=getComputedStyle(sg); const bottom=pg.getBoundingClientRect().top+parseFloat(getComputedStyle(pg).paddingTop)+940;
      return { onFront:sg.parentNode===pg, last:pg.lastElementChild===sg, gap:Math.round(bottom-sg.getBoundingClientRect().bottom), border:['Top','Right','Bottom','Left'].map(k=>parseFloat(cs['border'+k+'Width'])).reduce((a,v)=>a+v,0),
        lines:[...sg.querySelectorAll('i')].map(i=>Math.round(i.getBoundingClientRect().height)), wide:Math.round(sg.querySelector('.f').getBoundingClientRect().width), next:!!pg.querySelector('.panel.next') }; }));
    const info=await pop.evaluate(()=>({ backs:document.querySelectorAll('.page.back').length, blanks:document.querySelectorAll('.page.blank').length, boxes:document.querySelectorAll('.page').length, left:[...document.styleSheets].some(ss=>[...ss.cssRules].some(r=>/@page :left/.test(r.cssText))), over:[...document.querySelectorAll('.page')].filter(x=>x.scrollHeight>x.clientHeight+1).length }));
    const pdf=await pop.pdf({format:'Letter', preferCSSPageSize:true}); await pop.close();
    const pages=await p.evaluate(async b64=>{ const T=window.__tally; const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); return (await T.pdfTextPages(u8.buffer)).map(pg=>{ const its=pg.filter(i=>i.s.trim()); return { t:its.map(i=>i.s).join(' ').replace(/\s+/g,' '), x:Math.min(...its.map(i=>i.x)), sigY:(its.find(i=>/Parent or guardian signature/.test(i.s))||{}).y }; }); }, pdf.toString('base64'));
    return { lay, info, pages }; };
  const D=await printed(true);
  check(D.lay.length===2 && D.lay.every(x=>x.onFront && x.last && x.gap>=0 && x.gap<=4 && x.border===0 && x.next),'two-sided: each report\'s signatures are the last thing on its front, at the bottom edge, with no box: '+JSON.stringify(D.lay.map(x=>({ gap:x.gap, border:x.border }))));
  check(D.lay.every(x=>x.lines.length===4 && x.lines.every(h=>h>=28) && x.wide>=400),'room to sign: four lines at least 28 px tall, the signature lines '+D.lay[0].wide+' px wide: '+JSON.stringify(D.lay[0].lines));
  const fronts=D.pages.filter(pg=>/WEEKLY PROGRESS REPORT/.test(pg.t));
  check(fronts.length===2 && fronts.every(pg=>/NEXT TEST/.test(pg.t) && /Student signature/.test(pg.t) && pg.sigY!=null && pg.sigY<70) && D.info.over===0,'in the PDF each front carries the next test and ends with the signatures at the foot of the page (the parent line\'s label '+fronts.map(pg=>Math.round(pg.sigY)).join(', ')+' pt from the bottom)');
  check(D.info.backs>0 && D.info.left,'two-sided keeps the mirrored margin on the backs');
  const O=await printed(false);
  check(O.lay.every(x=>x.onFront && x.last && x.gap>=0 && x.gap<=4 && x.border===0),'one-sided: the same front, the signatures at its foot: '+JSON.stringify(O.lay.map(x=>x.gap)));
  check(O.info.blanks===0 && O.info.backs===0 && !O.info.left && O.pages.length===O.info.boxes && O.pages.every(pg=>pg.t.trim() && pg.x>=70),'one-sided: no blank pages, no mirrored margins: every page keeps the punch margin on the left ('+O.pages.length+' pages, text from '+Math.min(...O.pages.map(pg=>Math.round(pg.x)))+' pt)');
  await p.evaluate(()=>{ window.__tally.state.settings.duplex=true; window.__tally.save(); });

  // 8. the layout rules on their own: a front too full for everything keeps the signatures at its foot, and the back
  // follows on the next page (not a page after that)
  const engine=async blocks=>{ const html=await p.evaluate(blocks=>window.__tally.printDoc('t','body{font:12px Arial}.blk{border:1px solid #000;box-sizing:border-box}',`<section class="rep">${blocks.map(([h,a,id])=>`<div class="blk" id="${id}" style="height:${h}px" ${a||''}></div>`).join('')}</section>`,1),blocks);
    const pg=await ctx.newPage(); await pg.setContent(html); await pg.waitForFunction(()=>document.body.getAttribute('data-paged')==='1');
    const r=await pg.evaluate(()=>({ pages:[...document.querySelectorAll('.page')].map(x=>[...x.children].map(c=>c.id).join('+')), gap:(()=>{ const s=document.getElementById('sig'); if (!s) return null; const pg=s.closest('.page'); return Math.round(pg.getBoundingClientRect().top+parseFloat(getComputedStyle(pg).paddingTop)+940-s.getBoundingClientRect().bottom); })() }));
    await pg.close(); return r; };
  const e1=await engine([[300,'','a'],[100,'data-bottom','sig'],[200,'data-newpage','back']]);
  const e2=await engine([[500,'','a'],[400,'','b'],[100,'data-bottom','sig'],[200,'data-newpage','back']]);
  const e3=await engine([[300,'','a'],[200,'data-newpage','back']]);
  check(e1.pages.join(' | ')==='a+sig | back' && e1.gap>=0 && e1.gap<=4,'room on the front: the signatures go to its foot and the back starts page 2: '+e1.pages.join(' | ')+' (gap '+e1.gap+')');
  check(e2.pages.join(' | ')==='a+sig | b+back' && e2.gap>=0 && e2.gap<=4,'a front too full: what does not fit goes to page 2 with the back after it, and the signatures stay at the foot of the front: '+e2.pages.join(' | '));
  check(e3.pages.join(' | ')==='a | back','with no signatures, the back still starts page 2: '+e3.pages.join(' | '));

  // 9. Settings → Course: the next test, and the list to change
  await p.evaluate(K=>{ const T=window.__tally; T.state.active=K; T.render(); T.openSettings(K); },K); await p.waitForTimeout(300);
  await p.click('#stabs [data-stab="course"]'); await p.waitForTimeout(150);
  const line=await p.textContent('#testNext');
  check(line===`Next: Unit 4, ${await fmt(who.d3)}. The weekly report prints it on the front.`,'Settings → Course names the next test: "'+line+'"');
  await p.click('#setTests'); await p.waitForTimeout(300);
  const ed=await p.evaluate(()=>({ title:document.querySelector('#modal h2').textContent, rows:[...document.querySelectorAll('.tdrow')].map(r=>r.querySelector('[data-f=unit]').value+'|'+r.querySelector('[data-f=from]').value+'|'+r.className.replace('tdrow','').trim()), course:document.querySelector('#tdCourse .on').textContent }));
  check(ed.title==='Test dates' && ed.course==='Accelerated' && ed.rows.length===2 && /^Unit 4\|.*\|next$/.test(ed.rows[0]),'Test dates opens on the class\'s course, the next test marked: '+JSON.stringify(ed));
  // change a day: kept at once, and the line above says so
  await p.fill('.tdrow[data-row="0"] [data-f=from]', who.d10); await p.dispatchEvent('.tdrow[data-row="0"] [data-f=from]','change'); await p.waitForTimeout(100);
  const ch=await p.evaluate(()=>({ st:window.__tally.state.testDates.acc.map(x=>x.unit+' '+x.from).join(', '), ls:localStorage.getItem('tally.v1')||'' }));
  check(ch.st.startsWith('Unit 4 '+who.d10) && ch.ls.includes(who.d10),'a changed day is kept as soon as it changes: '+ch.st);
  // a last day before the day is cleared
  await p.fill('.tdrow[data-row="0"] [data-f=to]', who.d1); await p.dispatchEvent('.tdrow[data-row="0"] [data-f=to]','change'); await p.waitForTimeout(100);
  check(await p.evaluate(()=>window.__tally.state.testDates.acc[0].to==='' && document.querySelector('.tdrow[data-row="0"] [data-f=to]').value===''),'a last day before the day is not kept');
  // add a test, half filled; another left empty: on Done the empty one goes, Settings comes back on Course
  await p.click('#tdAdd'); await p.waitForTimeout(200);
  const foc=await p.evaluate(()=>document.activeElement && document.activeElement.dataset.f);
  await p.fill('.tdrow[data-row="2"] [data-f=unit]','Unit 6'); await p.fill('.tdrow[data-row="2"] [data-f=title]','Relationships in Triangles'); await p.fill('.tdrow[data-row="2"] [data-f=from]', who.d1);
  await p.click('#tdAdd'); await p.waitForTimeout(200);
  const rows3=await p.evaluate(()=>[...document.querySelectorAll('.tdrow')].map(r=>r.querySelector('[data-f=unit]').value));
  check(foc==='unit' && rows3.join(',')==='Unit 6,Unit 4,Unit 5,','Add a test puts an empty row at the end with the cursor in it; the list sorts by day when it redraws: '+rows3.join(','));
  await p.click('#tdDone'); await p.waitForTimeout(300);
  const back=await p.evaluate(()=>({ tab:(document.querySelector('#stabs .on')||{}).dataset, acc:window.__tally.state.testDates.acc.map(x=>x.unit+'|'+x.title+'|'+x.from) }));
  check(back.tab && back.tab.stab==='course' && back.acc.length===3 && back.acc[0]==='Unit 6|Relationships in Triangles|'+who.d1,'Done keeps the new test (typed, not yet confirmed by leaving the box), drops the empty row and goes back to Settings → Course: '+JSON.stringify(back.acc));
  check((await p.textContent('#testNext')).startsWith('Next: Unit 6,'),'…which names the new next test');
  // remove, then undo; the other course
  await p.click('#setTests'); await p.waitForTimeout(300);
  await p.click('.tdrow[data-row="0"] .tdx'); await p.waitForTimeout(200);
  const gone=await p.evaluate(()=>window.__tally.state.testDates.acc.map(x=>x.unit).join(','));
  await p.click('#tdUndo'); await p.waitForTimeout(200);
  const again=await p.evaluate(()=>({ st:window.__tally.state.testDates.acc.map(x=>x.unit).join(','), rows:document.querySelectorAll('.tdrow').length }));
  check(gone==='Unit 4,Unit 5' && again.st.split(',').sort().join(',')==='Unit 4,Unit 5,Unit 6' && again.rows===3,'× removes a test and Undo puts it back: '+gone+' → '+again.st);
  await p.click('[data-tdc="on"]'); await p.waitForTimeout(250);
  const on=await p.evaluate(()=>({ rows:document.querySelectorAll('.tdrow').length, two:[...document.querySelectorAll('.tdrow')].filter(r=>r.querySelector('[data-f=to]').value).length, course:document.querySelector('#tdCourse .on').textContent }));
  check(on.course==='On-level' && on.rows===11 && on.two===11,'On-level shows its own list, every test over two days: '+JSON.stringify(on));
  await p.click('#tdDone'); await p.waitForTimeout(300); await p.click('#mCancel'); await p.waitForTimeout(200);
  // 10. kept: through a reload and a Full save
  await p.reload(); await p.waitForTimeout(800);
  const kept=await p.evaluate(()=>window.__tally.state.testDates.acc.map(x=>x.unit).sort().join(','));
  check(kept==='Unit 4,Unit 5,Unit 6','the dates are there after Tally is opened again: '+kept);
  const fs1=await fullSave(p); await p.click('#mCancel').catch(()=>{});
  check(fs1.json.state && fs1.json.state.testDates && fs1.json.state.testDates.acc.length===3 && fs1.json.state.testDates.on.length===11,'a Full save carries the test dates');
  const old=await p.evaluate(()=>{ const T=window.__tally; const s=JSON.parse(JSON.stringify(T.state)); delete s.testDates; T.adopt(s); return { acc:T.state.testDates.acc.length, on:T.state.testDates.on.length }; });
  check(old.acc===13 && old.on===11,'a save from before test dates opens with the 2026-27 lists: '+JSON.stringify(old));
  console.log('errors:',errs); check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
