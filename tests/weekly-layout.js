// The weekly report after the second review (Croix, 25 Oct 2026: "Implement all of the things you say it got right. I
// agree the bars are dark … the last week's plan box … is taking up way too much space. Also, can you move missing
// assignments and ixls on the back page. Remove the your smartscore in parentheses line"; "79.5 rounds to 80 a B. They
// can retake multiple"). One panel for what to do, the retake inside it with its dates; light header bars; three
// tiles; the plan box on full lines; the missing assignments and the IXL still owed on the back.
const { chromium, fs, path, exe, check, done, APP, pick } = require('./lib');
const K = '1205050-7T1A';
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1300,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  // three students set up for it: A's way to the next letter is a retake alone; B has an A and a retake would still
  // raise it; C must turn work in first, and only then retake
  const who=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades; T.state.settings.teacherName='Mr. Shaffer';
    const rows=T.gbRows(s); const linked=rows.map((r,i)=>r&&r.ixl!=null?i:-1).filter(i=>i>=0); const full=i=>gb.assignments.forEach(x=>{ x.status[i]='score'; x.values[i]=x.max; });
    const [a,bb,c]=linked; full(a); gb.assignments.find(x=>x.name==='Squares and Cubes Quiz').values[a]=9;
    full(bb); gb.assignments.find(x=>x.name==='Unit 1 Vocabulary Quiz').values[bb]=12;
    full(c); const w=gb.assignments.find(x=>x.name==='2.03 Worksheet'); w.status[c]='missing'; w.values[c]=null; gb.assignments.find(x=>x.name==='Unit 1 Assessment').values[c]=0;
    T.save(); return { a, b:bb, c, missN:gb.students.map((_,i)=>gb.assignments.filter(x=>x.status[i]==='missing').length) }; },K);
  const report=i=>p.evaluate(({K,i})=>{ const T=window.__tally; const s=T.state.sections[K]; const d=document.createElement('div'); d.innerHTML=T.studentReportSection(s,i,T.gbRows(s)[i]); document.body.appendChild(d);
    const txt=x=>x?x.textContent.replace(/\s+/g,' ').trim():''; const main=d.querySelector('.panel.main');
    const out={ main:txt(main), howl:txt(d.querySelector('.howl')), boxes:d.querySelectorAll('.howl .box').length, alert:d.querySelectorAll('.panel.alert').length, retakePanels:[...d.querySelectorAll('.panel .ph')].filter(x=>/retake/i.test(x.textContent)).length,
      moves:[...([...d.querySelectorAll('.panel')].find(x=>/What would move/i.test(txt(x.querySelector('.ph'))))||d).querySelectorAll('tr')].map(txt),
      miss:[...((d.querySelector('.panel.miss')||d).querySelectorAll('tbody tr'))].map(tr=>({ t:txt(tr), box:!!tr.querySelector('.box') })), missHead:txt(d.querySelector('.panel.miss .ph')),
      order:[...d.querySelectorAll('section.rep > *')].map(x=>x.className.replace(/\s+/g,'.')||x.tagName), ixlHead:txt(d.querySelector('.panel.ixl .ph')), last:txt(d.querySelector('.lastplan')),
      mainHead:txt(d.querySelector('.panel.main .ph')), tq:[...d.querySelectorAll('.two .col > .panel:first-child table.tq tr')].map(tr=>[...tr.children].map(txt)), tqPara:!!d.querySelector('.two p.tests') };
    d.remove(); return out; },{K,i});
  // 1. A: one panel says what to do, the retake inside it: the score to aim for, a full score second, the HOWL days with dates
  const A=await report(who.a);
  const days=await p.evaluate(()=>{ const T=window.__tally; const mon=new Date(T.weekOf(T.todayISO())+'T12:00:00'); const now=new Date(); now.setHours(12,0,0,0); if (mon.getTime()+2*864e5<now.getTime()) mon.setDate(mon.getDate()+7); return [2,3].map(d=>new Date(mon.getTime()+d*864e5).toLocaleDateString(undefined,{ weekday:'long', month:'short', day:'numeric' })); });
  check(!A.alert && !A.retakePanels && /Retake Squares and Cubes Quiz score at least [\d.]+ \/ 27 · a full score: \d+% [A-D]/.test(A.main) && !/once everything above is done/.test(A.main),'the retake is a step in "Do this week" (no second box), the score to aim for first and a full score second, with no "once everything above is done" when nothing is above it: '+A.main.slice(0,200));
  check(A.howl.includes(`HOWL on ${days[0]} or ${days[1]}`) && /you are eligible \(nothing missing and Units 1 and 2 IXL at goal\)/.test(A.howl) && /Need another time\? Tell Mr\. Shaffer\./.test(A.howl) && /I need another time/.test(A.howl) && A.boxes===4,'the HOWL days carry their dates ('+days.join(', ')+'), and a student can ask for another time: '+A.howl.slice(0,240));
  // the panel is "Do this week", nothing after it (Croix, 25 Oct 2026: "Get rid of the quickest way to a b title")
  check(A.mainHead==='Do this week' && /These steps take the grade from \d+% to \d+% [A-D]/.test(A.main),'the panel\'s title is "Do this week" alone; the line under it still says where the steps take the grade: "'+A.mainHead+'"');
  // the tests and quizzes in rows: name, score, percent ("make the test assessment box more organized")
  const tests=await p.evaluate(({K,i})=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades; return gb.assignments.filter(a=>T.catOf(s.prep,a.name)==='Assessments' && !/\bixl\b/i.test(a.name) && a.max>0 && (a.status[i]==='score'||a.status[i]==='missing')).map(a=>[a.name, a.status[i]==='missing'?'NHI':(Number.isInteger(a.values[i])?String(a.values[i]):a.values[i].toFixed(1))+'/'+a.max, a.status[i]==='missing'?'0%':Math.round(a.values[i]/a.max*100)+'%']); },{K,i:who.c});
  const Ct=await report(who.c);
  check(Ct.tq.length===tests.length && tests.length>=3 && Ct.tq.every((r,k)=>r.length===3 && r[0]===tests[k][0] && r[1]===tests[k][1] && r[2]===tests[k][2]) && !Ct.tqPara,'"Tests & quizzes" is a table: one row per assessment, its score and its percent in their own columns, in Focus\'s order: '+Ct.tq.map(r=>r.join(' ')).join(' | '));
  const nhiAt=await p.evaluate(K=>{ const T=window.__tally; const gb=T.state.sections[K].grades; const q=gb.assignments.find(a=>a.name==='Squares and Cubes Quiz'); return q.status.indexOf('missing'); },K);
  const nhiRow=nhiAt>=0 ? (await report(nhiAt)).tq.find(r=>r[0]==='Squares and Cubes Quiz') : null;
  check(nhiRow && nhiRow[1]==='NHI' && nhiRow[2]==='0%','an assessment not handed in reads NHI, 0%: '+JSON.stringify(nhiRow));
  // an IXL column Focus marks NHI is missing work (Croix, 31 Oct 2026): the report says so, with or without an IXL link
  const nhiIxl=await p.evaluate(({K,who})=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades; const i=who.b; const col=gb.assignments.find(a=>/\bixl\b/i.test(a.name)); const keep=[col.status[i],col.values[i]]; col.status[i]='missing'; col.values[i]=null;
    const d=document.createElement('div'); const txt=x=>x?x.textContent.replace(/\s+/g,' ').trim():'';
    d.innerHTML=T.studentReportSection(s,i,T.gbRows(s)[i]); const linked={ main:txt(d.querySelector('.panel.main')), tile:txt(([...d.querySelectorAll('.board > div')].find(x=>/Missing assignments/.test(txt(x)))||d).querySelector('b')) };
    d.innerHTML=T.studentReportSection(s,i,null); const unlinked={ main:txt(d.querySelector('.panel.main')) };
    col.status[i]=keep[0]; col.values[i]=keep[1]; return { col:col.name, linked, unlinked }; },{K,who});
  check(nhiIxl.linked.tile==='1' && !/Nothing missing/.test(nhiIxl.linked.main) && !/Nothing missing/.test(nhiIxl.unlinked.main) && new RegExp(`(Still missing: ${nhiIxl.col}\\. Do the ${nhiIxl.col} skills this week\\.|Do the ${nhiIxl.col} skills \\d+ pts)`).test(nhiIxl.unlinked.main) && new RegExp(`(Still missing: ${nhiIxl.col}|IXL skill|${nhiIxl.col} points \\(\\d+\\) go into Focus|${nhiIxl.col} points go into Focus)`).test(nhiIxl.linked.main) && !/Nothing missing/.test(nhiIxl.linked.main),'an NHI IXL column is a missing assignment: the tile counts it and "Do this week" never says nothing is missing: '+JSON.stringify(nhiIxl).slice(0,700));
  // 2. B: an A already, and a retake would still raise it
  const B=await report(who.b);
  check(/An A already/.test(B.main) && /Retake Unit 1 Vocabulary Quiz: a full score takes your grade to 100% A\./.test(B.main) && B.boxes===4 && !/see the box above/.test(B.main),'with an A already, the retake that still raises it is one line with the HOWL days under it: '+B.main.slice(0,200));
  // 3. C: work to turn in first, then the retake: the steps say so, and no HOWL days yet
  const C=await report(who.c);
  check(/Turn in 2\.03 Worksheet/.test(C.main) && /Retake Unit 1 Assessment score at least [\d.]+ \/ 21, once everything above is done/.test(C.main) && !C.boxes && /Retakes: not yet\. To retake: turn in 1 missing assignment/.test(C.main),'when work comes first, the retake step waits for it and the HOWL days wait for eligibility: '+C.main.slice(0,220));
  // 4. the back: every missing assignment with a box and what turning it in does, biggest first; the front sums them up
  const many=who.missN.findIndex(n=>n>=4); const M=await report(many);
  const pcts=M.miss.map(r=>Number((r.t.match(/→ (\d+)%/)||[])[1]));
  check(M.miss.length===who.missN[many] && M.miss.every(r=>r.box && /turned in → \d+% [A-F]/.test(r.t)) && pcts.every((v,k)=>!k||v<=pcts[k-1]) && new RegExp(who.missN[many]+' assignments · \\d+ points').test(M.missHead),'the back lists all '+who.missN[many]+' missing assignments, each with a box and what turning it in does, biggest first: '+M.missHead);
  check(M.moves.filter(t=>/Worksheet|Assignment \d/.test(t)).length===0 && M.moves.filter(t=>new RegExp('^All '+who.missN[many]+' missing assignments turned in').test(t)).length===1,'"What would move the grade" sums the missing work up in one line: '+M.moves.join(' | ').slice(0,200));
  const ord=M.order.join(' ');
  check(/panel\.main.*two.*pledge.*sigs.*panel\.miss.*panel\.ixl/.test(ord) && /^head since|^head/.test(ord),'the front: header, grade, "Do this week", tests and moves, the plan and signatures; then the missing assignments and the IXL still owed: '+ord);
  check(M.ixlHead==='IXL still owed goal SmartScore 67','the IXL header no longer explains the parentheses: "'+M.ixlHead+'"');
  // 5. the last plan: none on a first report; "Last week's plan" after last week's report; a dated plan after an older one
  const lastFor=async (date)=>{ await p.evaluate(({K,i,date})=>{ const T=window.__tally; const s=T.state.sections[K]; s.reportLog=s.reportLog||{}; const k=T.norm(s.grades.students[i]); if (date) s.reportLog[k]=[{ date, q:null, gb:'', ix:'', grade:70, missing:1, ixl:null }]; else delete s.reportLog[k]; },{K,i:who.a,date}); return (await report(who.a)).last; };
  const lastMon=await p.evaluate(()=>{ const T=window.__tally; const d=new Date(T.weekOf(T.todayISO())+'T12:00:00'); d.setDate(d.getDate()-7); return T.localDayOf(d.toISOString()); });
  const l0=await lastFor(null), l1=await lastFor(lastMon), l2=await lastFor('2026-09-14');
  check(l0==='' && /^Last week's plan done partly not yet$/.test(l1) && /^My plan from Sep 14 done partly not yet$/.test(l2),'the last plan\'s check prints only when there was a report: '+JSON.stringify([l0,l1,l2]));
  await lastFor(null);
  // 6. printed: light header bars, an outlined title, the name on one line, the plan's lines across the box, the back on page 2
  const [pop]=await Promise.all([ctx.waitForEvent('page'), p.evaluate(({K,i})=>{ const T=window.__tally; const s=T.state.sections[K]; s.reportLog=s.reportLog||{}; s.reportLog[T.norm(s.grades.students[i])]=[{ date:'2026-09-14', q:null, gb:'', ix:'', grade:70, missing:1, ixl:null }]; T.printStudentReports(s,[i],'One'); },{K,i:many})]);
  await pop.waitForLoadState(); await pop.waitForFunction(()=>document.body.getAttribute('data-paged')==='1');
  const look=await pop.evaluate(()=>{ const lum=c=>{ const m=c.match(/\d+/g).map(Number); return Math.round(.299*m[0]+.587*m[1]+.114*m[2]); }; const ph=[...document.querySelectorAll('.wk .ph')]; const pl=document.querySelector('.pledge'), ln=document.querySelector('.pledge .lines');
    return { bars:Math.min(...ph.map(x=>lum(getComputedStyle(x).backgroundColor))), ink:Math.max(...ph.map(x=>lum(getComputedStyle(x).color))), badge:getComputedStyle(document.querySelector('.badge')).backgroundColor, nameLines:Math.round(document.querySelector('.who h1').getBoundingClientRect().height/parseFloat(getComputedStyle(document.querySelector('.who h1')).lineHeight)), since:!!document.querySelector('section.rep > .page > .since') && !document.querySelector('.head .since'), lines:ln.getBoundingClientRect().width/(pl.clientWidth-20) }; });
  check(look.bars>=200 && look.ink<=60 && look.badge==='rgb(255, 255, 255)','the header bars are light grey with dark text, and the title is outlined, not filled: '+JSON.stringify(look));
  check(look.nameLines===1 && look.since && look.lines>0.95,'the since strip sits under the header, so the name keeps one line; "This week I will" runs the box\'s full width: '+JSON.stringify({ nameLines:look.nameLines, since:look.since, lines:look.lines.toFixed(2) }));
  const pdf=await pop.pdf({format:'Letter', preferCSSPageSize:true}); await pop.close();
  const pages=await p.evaluate(async b64=>{ const T=window.__tally; const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); return (await T.pdfTextPages(u8.buffer)).map(pg=>pg.map(i=>i.s).join(' ').replace(/\s+/g,' ').trim()); }, pdf.toString('base64'));
  check(pages.length>=2 && /^MISSING ASSIGNMENTS/.test(pages[1]) && !/IXL STILL OWED|turned in → \d+% [A-F] .*turned in →/.test(pages[0]) && /IXL STILL OWED/.test(pages.slice(1).join(' ')),'printed two-sided, the back (page 2) begins with the missing assignments and the IXL still owed follows; the front has neither list');
  // one-sided: the same back, on page 2
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.duplex=false; });
  const [one]=await Promise.all([ctx.waitForEvent('page'), p.evaluate(({K,i})=>window.__tally.printStudentReports(window.__tally.state.sections[K],[i],'One'),{K,i:many})]); await one.waitForLoadState(); await one.waitForFunction(()=>document.body.getAttribute('data-paged')==='1');
  const pdf1=await one.pdf({format:'Letter', preferCSSPageSize:true}); await one.close();
  const pages1=await p.evaluate(async b64=>{ const T=window.__tally; const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); return (await T.pdfTextPages(u8.buffer)).map(pg=>pg.map(i=>i.s).join(' ').replace(/\s+/g,' ').trim()); }, pdf1.toString('base64'));
  check(pages1.length>=2 && /^MISSING ASSIGNMENTS/.test(pages1[1]),'printed one-sided, the missing assignments still start page 2');
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.duplex=true; T.save(); });
  console.log('errors:',errs); check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
