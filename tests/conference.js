// The parent conference form, student notes and FAST results (Croix, 21 Oct 2026: "Can you make it so Tally can
// generate this for me for whichever student I select? I can upload pm data into Tally to have it track the testing
// data … Also a way to keep notes about a student"). Strengths/Concerns are drafted from the data and editable; the
// redo list is assessments under 70 %; a semester grade is the average of its two quarters.
// The FAST report here is synthetic, built in the shape of the school's export (three header rows, the BOM and the
// en dash mangled the way his copy was); no real score is in the repo.
const { chromium, fs, path, exe, check, done, tmp, APP, pick, more } = require('./lib');
const BOM = 'ï»¿', DASH = 'â\u0080\u0093';   // what a UTF-8 BOM and "–" become after one wrong round trip, as in his file
function fastCsv(rows) {
  const q = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
  const head = [`"${BOM}""ID"""`, 'Student', 'Teacher', 'GradeLevel', 'Race', 'ELL', 'ESE', '504', 'L30', 'Percentile', 'Survey 2Match', 'TestedAboveGrade', 'PM3TestLevel', 'Gain', 'Achievement Level', '', 'Growth', '', 'Scale Score', '', 'Growth', ''].join(',');
  const y1 = '2025' + DASH + '2026', y2 = '2026' + DASH + '2027';
  const years = ',,,,,,,,,,,,,,' + [y1, y2, y1, y2, y1, y2, y1, y2].join(',');
  const wins = ',,,,,,,,,,,,,,PM3,PM1,PM1,Total,PM3,PM1,PM1,Total';
  return [head, years, wins].concat(rows.map(r => [r.id, r.name, 'TEACHER, SAMPLE (2026) +1', '07', 'ZZRACE', 'ZZELL', 'ZZESE', 'ZZ504', 'ZZL30', r.pct, '', r.above ? 'Y' : '', r.pm3 ? '06' : '', '', r.l3 ?? '', r.l1 ?? '', '', '', r.s3 ?? '', r.s1 ?? '', r.s3 != null && r.s1 != null ? r.s1 - r.s3 : '', ''].map(q).join(','))).join('\r\n') + '\r\n';
}
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1536,height:864},acceptDownloads:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const K='1205050-7T1A';
  const raw=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const g=T.gradingFor(s.prep); return { gb:JSON.parse(JSON.stringify(s.grades)), map:g.map }; },K);
  const S=raw.gb.students, ids=raw.gb.ids||[]; check(S.length===23 && ids.filter(Boolean).length===23,'the scrubbed gradebook carries a Focus ID for every student');

  // ---- 1. the FAST report ------------------------------------------------------------------------------------------------
  const rows=[ { id:ids[0], name:'', pct:81, above:true, pm3:1, l3:4, l1:2, s3:247, s1:231 },
    { id:ids[1], name:'', pct:0, pm3:1, l3:1, l1:1, s3:168, s1:196 },
    { id:ids[2], name:'', pct:30, pm3:1, l3:2, l1:3, s3:221, s1:236 },
    { id:'', name:S[3], pct:57, pm3:1, l3:3, l1:2, s3:234, s1:229 },          // no ID: matched by name
    { id:ids[4], name:'', pct:'', l1:4, s1:253 },                             // new this year: no PM3
    { id:'999000111', name:'', pct:50, pm3:1, l3:3, l1:3, s3:233, s1:240 },   // not in any class
    { id:'', name:'', pct:60, pm3:1, l3:3, l1:2, s3:235, s1:233 } ];          // names deleted: cannot be placed
  const f1=path.join(tmp,'fast_report.csv'); fs.writeFileSync(f1, fastCsv(rows), 'utf8');
  const parsed=await p.evaluate(t=>window.__tally.parseFastReport(window.__tally.csvToRows ? window.__tally.csvToRows(t) : csvToRows(t)), fs.readFileSync(f1,'utf8')).catch(()=>null);
  const pr=parsed||await p.evaluate(t=>{ return window.__tally.parseFastReport(csvToRows(t)); }, fs.readFileSync(f1,'utf8'));
  check(pr && pr.windows.map(w=>w.pm+' '+w.year).join(',')==='PM3 2025-26,PM1 2026-27','the two windows are read from the second and third header rows, through the mangled dash: '+(pr&&pr.windows.map(w=>w.pm+' '+w.year).join(', ')));
  const r0=pr.students.find(s=>s.id===ids[0]);
  check(JSON.stringify(r0.tests)===JSON.stringify([{test:'FAST',pm:'PM3',year:'2025-26',level:4,scale:247,pct:81,grade:6},{test:'FAST',pm:'PM1',year:'2026-27',level:2,scale:231,above:true}]),'one student: last year\'s PM3 with its percentile and the grade of the test, this year\'s PM1 marked above grade');
  check(pr.students.find(s=>s.id===ids[4]).tests.length===1 && pr.blank===1 && pr.students.length===6,'a student with only PM1 has one record; the row with no ID and no name is counted and skipped');
  check(pr.students.every(s=>s.tests.every(t=>Object.keys(t).every(k=>['test','pm','year','level','scale','pct','grade','above'].includes(k)))) && !/ZZ/.test(JSON.stringify(pr)),'nothing from the race, ELL, ESE, 504 or L30 columns is read');
  await p.setInputFiles('#file',[f1]); await p.waitForTimeout(700);
  const toast1=await p.evaluate(()=>document.querySelector('#toast').textContent);
  check(/FAST results \(PM3 2025-26 and PM1 2026-27\): 5 students matched · 1 not in your classes .*1 row with no ID or name skipped/.test(toast1),'the import says what it matched: "'+toast1+'"');
  const st1=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__tally.state.tests)));
  check(st1['id:'+ids[0]] && st1['id:'+ids[0]].length===2 && st1['id:999000111'] && Object.keys(st1).some(k=>k.startsWith('n:')) && !/ZZ/.test(JSON.stringify(st1)),'scores are kept by Focus ID (and by name for the row without one); the stranger is kept in case they join; no demographic value is stored');
  // a later report replaces a window instead of adding a second copy
  const rows2=rows.slice(0,1).map(r=>({ ...r, s1:240, l1:3 })); const f2=path.join(tmp,'fast_report_again.csv'); fs.writeFileSync(f2, fastCsv(rows2), 'utf8');
  await p.setInputFiles('#file',[f2]); await p.waitForTimeout(600);
  const again=await p.evaluate(id=>window.__tally.state.tests['id:'+id], ids[0]);
  check(again.length===2 && again.find(t=>t.pm==='PM1').scale===240,'importing the report again replaces PM1 2026-27 rather than adding a second one');
  // his own sample, names and IDs deleted: nothing can be placed, and Tally says so instead of guessing
  const f3=path.join(tmp,'no_names.csv'); fs.writeFileSync(f3, fastCsv(rows.map(r=>({ ...r, id:'', name:'' }))), 'utf8');
  const before=await p.evaluate(()=>JSON.stringify(window.__tally.state.tests)); await p.setInputFiles('#file',[f3]); await p.waitForTimeout(600);
  const t3=await p.evaluate(()=>({ msg:document.querySelector('#toast').textContent, err:document.querySelector('#toast').classList.contains('err'), same:JSON.stringify(window.__tally.state.tests) }));
  check(t3.err && /no student IDs or names/.test(t3.msg) && t3.same===before,'a report with no IDs or names is refused with a plain reason: "'+t3.msg+'"');

  // ---- 2. the student page: FAST and notes -------------------------------------------------------------------------------
  const open=async i=>{ await p.evaluate(({K,nm})=>window.__tally.openProfile(K,nm),{K,nm:S[i]}); await p.waitForTimeout(300); };
  await open(0);
  const ft=await p.evaluate(()=>[...document.querySelectorAll('#pTests tr')].map(tr=>[...tr.children].map(c=>c.textContent.trim()).join(' ').replace(/\s+/g,' ').trim()));
  check(ft.length===2 && /^PM1 2026-27 Level 3 240 −7 above grade$/.test(ft[0]) && /^PM3 2025-26 Level 4 247 81st pct$/.test(ft[1]),'the student page lists FAST newest first with the change in scale score: '+ft.join(' / '));
  await open(3); const byName=await p.evaluate(()=>document.querySelectorAll('#pTests tr').length); check(byName===2,'the student without an ID in the report is found by name');
  await open(1); const zero=await p.evaluate(()=>document.querySelector('#pTests').textContent); check(/below 1st pct/.test(zero),'a percentile of 0 reads "below 1st"');
  await open(5); check(await p.evaluate(()=>!document.querySelector('#pTests')),'a student with no results has no FAST section');
  // notes
  await open(0); const note1='Talked with mom on the phone. Works better near the front.', note2='Asked for help after class on two-step equations.';
  await p.fill('#noteText', note1); await p.click('#noteAdd'); await p.waitForTimeout(300); await p.fill('#noteText', note2); await p.keyboard.press('Control+Enter'); await p.waitForTimeout(300);
  await p.reload(); await p.waitForTimeout(600); await open(0);
  const nl=await p.evaluate(()=>[...document.querySelectorAll('#pNotes .notes li')].map(li=>({ t:li.querySelector('time').textContent, p:li.querySelector('p').textContent })));
  const today=await p.evaluate(()=>new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date()));
  check(nl.length===2 && nl[0].p===note2 && nl[1].p===note1 && nl.every(n=>n.t.length>2),'notes are kept after a reload, newest first, each dated ('+nl.map(n=>n.t).join(', ')+'; today '+today+')');
  await p.evaluate(()=>{ const e=document.querySelector('#pTests'); if (e) e.scrollIntoView(); }); await p.screenshot({ path: path.join(tmp,'student-page.png') });
  await open(2); check(await p.evaluate(()=>document.querySelectorAll('#pNotes .notes li').length===0),'notes belong to one student');
  await open(0); await p.click('#pShow'); await p.waitForTimeout(500);
  const showTxt=await p.evaluate(()=>document.querySelector('#show').textContent);
  check(!showTxt.includes('Talked with mom') && !/FAST|Level 3/.test(showTxt),'Show student carries no note and no FAST score');
  await p.reload(); await p.waitForTimeout(600);
  const bf=await p.evaluate(()=>JSON.stringify(window.__tally.boardFile()));
  check(!bf.includes('Talked with mom') && !bf.includes(note2) && !/"tests"\s*:\s*\{\s*"/.test(bf) && !bf.includes('"scale"') && !bf.includes('id:'+ids[0]),'the Board file carries no note and no FAST score');
  await p.evaluate(()=>{ window.__tally.state.settings.hideNames=true; window.__tally.render(); }); await p.waitForTimeout(300); await open(0);
  const hid=await p.evaluate(()=>({ n:document.querySelector('#pNotes').textContent, f:document.querySelector('#pTests').textContent }));
  check(/Hidden while names are hidden/.test(hid.n) && !hid.n.includes('Talked') && /Hidden while names are hidden/.test(hid.f) && !/247/.test(hid.f),'with names hidden, notes and FAST are hidden too');
  await p.evaluate(()=>{ window.__tally.state.settings.hideNames=false; window.__tally.save(); window.__tally.render(); }); await p.waitForTimeout(300);

  // ---- 3. the conference form, against the gradebook read independently ---------------------------------------------------
  const assess=a=>raw.map[a.name]==='Assessments' && !/\bixl\b/i.test(a.name) && a.max>0;
  const expectFor=i=>({ missing: raw.gb.assignments.filter(a=>a.status && a.status[i]==='missing').map(a=>a.name),
    redo: raw.gb.assignments.filter(a=>assess(a) && a.status && a.status[i]==='score' && a.values[i]!=null && a.values[i]/a.max<0.7).map(a=>a.name) });
  const nice=n=>{ const m=n.match(/^([^,]+),\s*(.+)$/); const t=s=>s.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()); return t(m[2].split(/\s+/)[0]+' '+m[1]); };
  let worst=-1, best=-1; S.forEach((_,i)=>{ const e=expectFor(i); if (worst<0 && e.missing.length && e.redo.length) worst=i; if (best<0 && !e.missing.length) best=i; });
  check(worst>=0 && best>=0,'the fixture has a student with missing work and a low assessment (row '+worst+') and one with nothing missing (row '+best+')');
  await open(worst); await p.click('#pConf'); await p.waitForTimeout(400);
  const v=await p.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.confForm input,.confForm textarea')].map(e=>[e.id,e.value])));
  const want=await p.evaluate(({K,nm})=>{ const T=window.__tally; const s=T.state.sections[K]; const i=s.grades.students.indexOf(nm); return { g:T.computeGrade(s,i).rounded, per:s.period, rt:T.retakeStatus(s,nm) }; },{K,nm:S[worst]});
  const ew=expectFor(worst);
  check(v.cfName===nice(S[worst]) && v.cfCurrent===String(want.g) && v.cfPeriod===String(want.per||'') && v.cfGrade==='7' && /Grade 7/.test(v.cfCourse),'header fields: '+[v.cfName,v.cfGrade,v.cfCourse,v.cfPeriod,v.cfCurrent+'%'].join(' · '));
  check(ew.missing.every(n=>v.cfWork.includes('• '+n+',')) && (v.cfWork.match(/^• /gm)||[]).length===ew.missing.length+ew.redo.length && ew.redo.every(n=>v.cfWork.includes('• '+n+',')),'"Missing & redo" lists exactly the '+ew.missing.length+' assignments not handed in and the '+ew.redo.length+' assessments under 70%');
  check(/Retakes: not yet\. First turn in \d+ missing assignments?/.test(v.cfWork) && !want.rt.ok,'and says whether a retake is allowed, in the words Show student uses');
  check(new RegExp('^'+ew.missing.length+' assignments? not handed in').test(v.cfConcerns.split('\n')[0]),'Concerns is drafted from the numbers: "'+v.cfConcerns.split('\n')[0]+'"');
  check(['Q1','Q2','S1','Q3','Q4','S2'].every(q=>v['cf'+q]===''),'no report-card grade is filled while no quarter has been closed');
  // report-card grades: quarters as closed, semesters the average of two quarters rounded half up
  const rc=await p.evaluate(()=>{ const R=window.__tally.reportCard; const c=(q,g,closed=true)=>({ q, g, closed });
    return [R([c(1,89),c(2,90)]), R([c(1,88),c(2,91)]), R([c(1,79),c(2,80,false)]), R([c(1,92),c(2,85),c(3,70),c(4,75)]), R([c(1,64),c(2,55)])]; });
  check(rc[0].S1===90 && rc[1].S1===90 && rc[2].S1===null && rc[2].Q2===null && rc[2].Q1===79 && rc[3].S1===89 && rc[3].S2===73 && rc[4].S1===60,'semesters: 89 & 90 → 90, 88 & 91 → 90 (89.5 rounds up), a quarter still open leaves S1 blank, 70 & 75 → 73, 64 & 55 → 60');
  const fin=await p.evaluate(({K,nm})=>{ const T=window.__tally; const s=T.state.sections[K]; T.closeQuarter(1,{acc:[],on:[]}); const i=s.qArchive['1'].gb.students.indexOf(nm); const d=T.conferenceData(s,nm); return { q1:s.qArchive['1'].final[i], rc:d.rc }; },{K,nm:S[worst]});
  check(fin.q1!=null && fin.rc.Q1===fin.q1 && fin.rc.S1===null,'once Quarter 1 is closed its final grade fills Q1 ('+fin.q1+'); S1 waits for Q2');
  await p.evaluate(()=>{ window.__tally.reopenQuarter(1); }); await p.click('#mClose'); await p.waitForTimeout(300);
  await open(best); await p.click('#pConf'); await p.waitForTimeout(400);
  const vb=await p.evaluate(()=>({ s:document.querySelector('#cfStrengths').value, w:document.querySelector('#cfWork').value }));
  check(/Turns in every assignment/.test(vb.s) && (vb.w==='' || !/Not handed in/.test(vb.w)),'a student with nothing missing gets that as a strength, and no "not handed in" list');
  await p.click('#mClose'); await p.waitForTimeout(300);
  // notes go into the form on a click; edits, the teacher and the course are kept
  await open(0); await p.click('#pConf'); await p.waitForTimeout(400);
  const nAside=await p.evaluate(()=>document.querySelectorAll('.cfNotes li').length); check(nAside===2,'the student\'s notes sit beside the form');
  await p.click('.cfNotes li:last-child [data-cfadd="concerns"]'); await p.fill('#cfTeacher','Mr. Shaffer'); await p.fill('#cfCourse','M/J Grade 7 Math');
  const conc=await p.inputValue('#cfConcerns'); check(conc.endsWith(note1),'"+ Concerns" adds the note to the end of Concerns');
  check((await p.inputValue('#cfTests'))==='FAST PM1 2026-27: Level 3, 240 (above grade); FAST PM3 2025-26: Level 4, 247, 81st percentile (grade 6 test)','the test-history line: "'+(await p.inputValue('#cfTests'))+'"');
  await p.fill('#cfStrengths','Kind to classmates. Explains steps out loud.'); await p.click('#mCancel'); await p.waitForTimeout(300);
  await p.reload(); await p.waitForTimeout(600); await open(0); await p.click('#pConf'); await p.waitForTimeout(400);
  const kept=await p.evaluate(()=>({ s:document.querySelector('#cfStrengths').value, c:document.querySelector('#cfConcerns').value, t:document.querySelector('#cfTeacher').value, co:document.querySelector('#cfCourse').value, f:document.querySelector('.confPanel footer').textContent }));
  check(kept.s==='Kind to classmates. Explains steps out loud.' && kept.c.endsWith(note1) && /Your edits from/.test(kept.f),'after a reload the form opens with his edits, and says so');
  check(kept.t==='Mr. Shaffer' && kept.co==='M/J Grade 7 Math','the teacher name and course name are remembered for every student');
  await p.click('#mClose'); await p.waitForTimeout(200); await open(2); await p.click('#pConf'); await p.waitForTimeout(400);
  check((await p.inputValue('#cfTeacher'))==='Mr. Shaffer' && !(await p.inputValue('#cfStrengths')).includes('Kind to classmates'),'another student gets the teacher name but not the first student\'s text');
  await p.click('#mClose'); await p.waitForTimeout(200); await open(0); await p.click('#pConf'); await p.waitForTimeout(400);
  await p.click('#cfRefill'); await p.waitForTimeout(400);
  check(!(await p.inputValue('#cfStrengths')).includes('Kind to classmates') && !(await p.$('#cfRefill')),'"Start over from Tally" goes back to the draft');
  await p.screenshot({ path: path.join(tmp,'conference-dialog.png') });
  // printing: a popup with the school's form, one Letter page
  const [pop]=await Promise.all([ctx.waitForEvent('page'), p.click('#cfPrint')]); await pop.waitForLoadState('load'); await pop.waitForTimeout(300);
  const pg=await pop.evaluate(()=>({ title:document.title, imgs:[...document.images].map(i=>i.naturalWidth), h1:document.querySelector('h1').textContent, labels:[...document.querySelectorAll('.f b, section > b')].map(x=>x.textContent).join('|'), name:document.querySelector('.r .u').textContent }));
  check(pg.imgs.length===2 && pg.imgs.every(w=>w>500) && pg.h1==='PARENT CONFERENCE INPUT FORM' && pg.name===nice(S[0]),'the print window is the school\'s form with its banner and footer, filled in');
  check(['Student Name:','Grade:','Teacher:','Course:','Period:','Current Grade:','Q1:','Q2:','S1:','Q3:','Q4:','S2:','FAST/EBA Test History:','Student Strengths in Class:','Student Concerns in Class:','Missing Assignments & Assignments Needing to be Redone:'].every(l=>pg.labels.includes(l)),'every field on the paper form is there');
  await pop.screenshot({ path: path.join(tmp,'conference-print.png'), fullPage:true });
  const pages=async html=>{ const q=await ctx.newPage(); await q.setContent(html); await q.waitForTimeout(300); const pdf=await q.pdf({ format:'Letter', printBackground:true, preferCSSPageSize:true }); const fs2=await q.evaluate(()=>[...document.querySelectorAll('.t')].map(t=>parseFloat(getComputedStyle(t).fontSize))); await q.close(); return { n:(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length, fs:fs2 }; };
  const html=await pop.evaluate(()=>'<!DOCTYPE html>'+document.documentElement.outerHTML); await pop.close();
  const one=await pages(html); check(one.n===1,'it prints on one Letter page');
  const long=await p.evaluate(()=>{ const T=window.__tally; const blah='Needs reminders to show work and check answers before turning them in. '; return T.conferenceHtml({ name:'Long Text', grade:'7', teacher:'T', course:'C', period:'1', current:'71', rc:{}, tests:'x', strengths:blah.repeat(14), concerns:blah.repeat(14), work:Array.from({length:22},(_,i)=>'• Assignment '+(i+1)+', 10 pts').join('\n') }); });
  const lp=await pages(long); check(lp.n===1 && lp.fs.every(f=>f<14),'a lot of text still prints on one page: the boxes shrink their type ('+lp.fs.map(f=>f.toFixed(1)+'px').join(', ')+')');

  // ---- 4. the backup carries notes, FAST, the kept form text and the header fields ----------------------------------------
  await p.click('#mClose').catch(()=>{}); await p.waitForTimeout(200); await open(3); await p.click('#pConf'); await p.waitForTimeout(300); await p.fill('#cfStrengths','Edited for row three.'); await p.click('#mCancel'); await p.waitForTimeout(200);
  await more(p,'#btnSettings'); await p.waitForTimeout(300);
  const [d1]=await Promise.all([p.waitForEvent('download'), p.click('#exportCfg')]); const bk=path.join(tmp,'backup.json'); await d1.saveAs(bk); await p.keyboard.press('Escape');
  const B=JSON.parse(fs.readFileSync(bk,'utf8'));
  check(B.tests && B.tests['id:'+ids[0]] && B.settings.teacherName==='Mr. Shaffer' && Object.values(B.settings.courseNames).includes('M/J Grade 7 Math') && Object.keys(B.sections[K].stuNotes).length===1 && Object.keys(B.sections[K].confForms).length===1,'the backup holds FAST, the teacher and course names, the notes and the kept form text');
  const ctx2=await b.newContext({viewport:{width:1536,height:864}}); const q=await ctx2.newPage(); q.on('pageerror',e=>errs.push('restore: '+e.message)); q.on('dialog',d=>d.accept()); await q.goto('file://'+path.resolve(APP)); await q.waitForTimeout(300);
  await q.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await q.waitForTimeout(500); await q.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await q.click('#rpSave'); await q.waitForTimeout(300);
  await q.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await q.waitForTimeout(500); await pick(q); await q.waitForTimeout(600);
  await q.setInputFiles('#file',[bk]); await q.waitForTimeout(800);
  const R=await q.evaluate(({K,a,c})=>{ const T=window.__tally; const s=T.state.sections[K]; return { notes:T.notesOf(s,a).length, tests:T.testHistory(s,a).length, kept:(s.confForms||{})[Object.keys(s.confForms||{})[0]], teacher:T.state.settings.teacherName }; },{K,a:S[0],c:S[3]});
  check(R.notes===2 && R.tests===2 && R.kept && R.kept.strengths==='Edited for row three.' && R.teacher==='Mr. Shaffer','loading the backup into another Tally brings all of it back');
  // the full save keeps it too (it is the whole state); the migrate whitelist keeps the new settings through a reload
  await q.reload(); await q.waitForTimeout(500); check(await q.evaluate(()=>window.__tally.state.settings.teacherName==='Mr. Shaffer' && Object.keys(window.__tally.state.tests).length>0),'…and they survive a reload');
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('screenshots: '+tmp);
  await b.close(); done();
})();
