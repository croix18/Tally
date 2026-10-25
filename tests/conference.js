// The parent conference form, student notes and FAST results (Croix, 21 Oct 2026: "Can you make it so Tally can
// generate this for me for whichever student I select? I can upload pm data into Tally to have it track the testing
// data … Also a way to keep notes about a student"). Strengths/Concerns are drafted from the data and editable; the
// redo list is assessments under 70 %; a semester grade is the average of its two quarters.
// The FAST report here is synthetic, built in the shape of the school's export (three header rows, the BOM and the
// en dash mangled the way his copy was); no real score is in the repo.
const { chromium, fs, path, exe, check, done, tmp, APP, pick, more, fullSave } = require('./lib');
const BOM = 'ï»¿', DASH = 'â\u0080\u0093';   // what a UTF-8 BOM and "–" become after one wrong round trip, as in his file
function fastCsv(rows) {
  const q = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
  const head = [`"${BOM}""ID"""`, 'Student', 'Teacher', 'GradeLevel', 'Race', 'ELL', 'ESE', '504', 'L30', 'Percentile', 'Survey 2Match', 'TestedAboveGrade', 'PM3TestLevel', 'Gain', 'Achievement Level', '', 'Growth', '', 'Scale Score', '', 'Growth', ''].join(',');
  const y1 = '2025' + DASH + '2026', y2 = '2026' + DASH + '2027';
  const years = ',,,,,,,,,,,,,,' + [y1, y2, y1, y2, y1, y2, y1, y2].join(',');
  const wins = ',,,,,,,,,,,,,,PM3,PM1,PM1,Total,PM3,PM1,PM1,Total';
  return [head, years, wins].concat(rows.map(r => [r.id, r.name, 'TEACHER, SAMPLE (2026) +1', '07', r.race ?? 'X', r.ell ?? '', r.ese ?? '', r.s504 ?? '', r.l30 ?? '', r.pct, '', r.above ? 'Y' : '', r.pm3 ? '06' : '', '', r.l3 ?? '', r.l1 ?? '', '', '', r.s3 ?? '', r.s1 ?? '', r.s3 != null && r.s1 != null ? r.s1 - r.s3 : '', ''].map(q).join(','))).join('\r\n') + '\r\n';
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
  const noMiddle=n=>n.replace(/^([^,]+,\s*\S+).*$/,'$1');   // "LAST, FIRST MIDDLE" → "LAST, FIRST"
  const rows=[ { id:ids[0], name:S[0], pct:81, above:true, pm3:1, l3:4, l1:2, s3:247, s1:231, race:'W', l30:'', ese:'' },
    { id:ids[1], name:noMiddle(S[1]), pct:0, pm3:1, l3:1, l1:1, s3:168, s1:196, race:'B', ese:'Y', l30:'Y' },   // name without the middle name
    { id:ids[2], name:S[2], pct:30, pm3:1, l3:2, l1:2, s3:221, s1:236, race:'H', ell:'LY', s504:'Y', l30:'Y' },   // 236 is High Level 2 on the grade-8 table, as Focus says
    { id:'', name:S[3], pct:57, pm3:1, l3:3, l1:2, s3:234, s1:229 },          // no ID: matched by name
    { id:ids[4], name:'', pct:'', l1:3, s1:253 },                             // no name: matched by ID; new this year (no PM3)
    { id:'999000111', name:'STRANGER, NEW', pct:50, pm3:1, l3:3, l1:3, s3:233, s1:240 },   // not in any class
    { id:'', name:'', pct:60, pm3:1, l3:3, l1:2, s3:235, s1:233 } ];          // name and ID deleted: cannot be placed
  const f1=path.join(tmp,'fast_report.csv'); fs.writeFileSync(f1, fastCsv(rows), 'utf8');
  const parsed=await p.evaluate(t=>window.__tally.parseFastReport(window.__tally.csvToRows ? window.__tally.csvToRows(t) : csvToRows(t)), fs.readFileSync(f1,'utf8')).catch(()=>null);
  const pr=parsed||await p.evaluate(t=>{ return window.__tally.parseFastReport(csvToRows(t)); }, fs.readFileSync(f1,'utf8'));
  check(pr && pr.windows.map(w=>w.pm+' '+w.year).join(',')==='PM3 2025-26,PM1 2026-27','the two windows are read from the second and third header rows, through the mangled dash: '+(pr&&pr.windows.map(w=>w.pm+' '+w.year).join(', ')));
  const r0=pr.students.find(s=>s.id===ids[0]);
  check(JSON.stringify(r0.tests)===JSON.stringify([{test:'FAST',pm:'PM3',year:'2025-26',level:4,scale:247,pct:81,grade:6},{test:'FAST',pm:'PM1',year:'2026-27',level:2,scale:231,above:true}]),'one student: last year\'s PM3 with its percentile and the grade of the test, this year\'s PM1 marked above grade');
  check(pr.students.find(s=>s.id===ids[4]).tests.length===1 && pr.blank===1 && pr.students.length===6,'a student with only PM1 has one record; the row with no ID and no name is counted and skipped');
  const i2=pr.students.find(s=>s.id===ids[2]).info;
  check(i2.Race==='H' && i2.ELL==='LY' && i2['504']==='Y' && i2.L30==='Y' && i2.Teacher && i2.GradeLevel==='07' && i2.Percentile==='30' && i2['Scale growth PM1']==='15' && Object.values(i2).every(v=>v!==''),'every other column is kept under its own heading, growth included (Croix: "I want it to log it. It\'s all important"): '+Object.keys(i2).join(', '));
  await p.setInputFiles('#file',[f1]); await p.waitForTimeout(700);
  const toast1=await p.evaluate(()=>document.querySelector('#toast').textContent);
  check(/FAST report \(PM3 2025-26 and PM1 2026-27\): 5 students matched to your classes \(1 by ID, the rest by name\) · 1 not in your classes: STRANGER, NEW \(kept, in case they join\) · 1 row with no name or ID skipped\. Every column was kept\./.test(toast1),'the import matches by name (the one row with no name by its ID) and says so: "'+toast1+'"');
  const st1=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__tally.state.tests)));
  const ti=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__tally.state.testInfo)));
  check(st1['id:'+ids[0]] && st1['id:'+ids[0]].length===2 && st1['id:999000111'] && Object.keys(st1).some(k=>k.startsWith('n:')),'scores are kept under the student\'s roster name and ID; the stranger is kept in case they join');
  check(ti['id:'+ids[2]] && ti['id:'+ids[2]].FAST.fields.L30==='Y' && ti['id:'+ids[2]].FAST.fields.Race==='H' && /fast_report\.csv$/.test(ti['id:'+ids[2]].FAST.file),'the report\'s other columns are kept per student too, with the file they came from');
  // a later report replaces a window instead of adding a second copy
  const rows2=rows.slice(0,1).map(r=>({ ...r, s1:240, l1:2 })); /* 240 is High Level 2 on the grade-8 table */ const f2=path.join(tmp,'fast_report_again.csv'); fs.writeFileSync(f2, fastCsv(rows2), 'utf8');
  await p.setInputFiles('#file',[f2]); await p.waitForTimeout(600);
  const again=await p.evaluate(id=>window.__tally.state.tests['id:'+id], ids[0]);
  check(again.length===2 && again.find(t=>t.pm==='PM1').scale===240,'importing the report again replaces PM1 2026-27 rather than adding a second one');
  // his own sample, names and IDs deleted: nothing can be placed, and Tally says so instead of guessing
  const f3=path.join(tmp,'no_names.csv'); fs.writeFileSync(f3, fastCsv(rows.map(r=>({ ...r, id:'', name:'' }))), 'utf8');
  const before=await p.evaluate(()=>JSON.stringify(window.__tally.state.tests)); await p.setInputFiles('#file',[f3]); await p.waitForTimeout(600);
  const t3=await p.evaluate(()=>({ msg:document.querySelector('#toast').textContent, err:document.querySelector('#toast').classList.contains('err'), same:JSON.stringify(window.__tally.state.tests) }));
  check(t3.err && /no student names or IDs/.test(t3.msg) && t3.same===before,'a report with no IDs or names is refused with a plain reason: "'+t3.msg+'"');

  // ---- 2. the student page: FAST and notes -------------------------------------------------------------------------------
  const open=async i=>{ await p.evaluate(({K,nm})=>window.__tally.openProfile(K,nm),{K,nm:S[i]}); await p.waitForTimeout(300); };
  await open(0);
  const ft=await p.evaluate(()=>[...document.querySelectorAll('#pTests .ftab:not(.targets) tr')].map(tr=>[...tr.children].map(c=>c.textContent.trim()).join(' ').replace(/\s+/g,' ').trim()));
  check(ft.length===2 && /^PM1 2026-27 Level 2 240 −7 above grade$/.test(ft[0]) && /^PM3 2025-26 Level 4 247 81st pct$/.test(ft[1]),'the student page lists FAST newest first with the change in scale score: '+ft.join(' / '));
  await open(3); const byName=await p.evaluate(()=>document.querySelectorAll('#pTests .ftab:not(.targets) tr').length); check(byName===2,'the student without an ID in the report is found by name');
  await open(2); const fl=await p.evaluate(()=>({ flags:[...document.querySelectorAll('#pTests .fflag')].map(x=>x.textContent), all:[...document.querySelectorAll('#pTests .fall dt')].map(x=>x.textContent) }));
  check(fl.flags.join(' | ')==='Lowest 30% | 504 | ELL (LY)' && ['Race','L30','ELL','504','Percentile','Scale growth PM1','Teacher'].every(k=>fl.all.includes(k)),'the student page shows the flags (L30 first) and, folded, everything the report said: '+fl.flags.join(' | '));
  await p.click('#btnStudents'); await p.waitForTimeout(400); await p.click('#stuL30'); await p.waitForTimeout(300);
  const l30=await p.evaluate(()=>({ n:document.querySelectorAll('.sdir tr[data-name]').length, meta:document.querySelector('#bar .meta').textContent, chips:document.querySelectorAll('.sdir .fflag.l30').length }));
  check(l30.n===2 && l30.chips===2 && /2 students in the lowest 30%/.test(l30.meta),'Students has an L30 button that lists only the lowest-30% students, each tagged: "'+l30.meta+'"');
  await p.click('#stuL30'); await p.waitForTimeout(200);
  await open(1); const zero=await p.evaluate(()=>document.querySelector('#pTests').textContent); check(/below 1st pct/.test(zero),'a percentile of 0 reads "below 1st"');
  await open(5); check(await p.evaluate(()=>!document.querySelector('#pTests')),'a student with no results has no FAST section');
  // 1c. FAST targets (24 Oct 2026): last year's PM3 in its grade-6 bucket, this year's PM1 in its grade-7 bucket, and what PM2 / PM3 need
  const tg=await p.evaluate(({K,S})=>{ const T=window.__tally; const s=T.state.sections[K]; return [0,1,2,4].map(i=>{ const t=T.fastTargets(s,S[i]); return t && { prior:t.prior&&t.prior.scale, pb:t.priorBucket&&t.priorBucket.label, latest:t.latest&&t.latest.scale, lb:t.latestBucket&&t.latestBucket.label, gain:t.gain&&t.gain.score, rows:t.rows.map(r=>r.what+'='+r.score+(r.met?'*':'')) }; }); },{K,S});
  check(tg[1].pb==='Low Level 1' && tg[1].lb==='Low Level 1' && tg[1].gain===198 && tg[1].rows[0]==='Mid Level 1=198','an accelerated class sits the grade-8 test: a Low Level 1 on the grade-6 PM3 (168) needs 198 on the grade-8 scale for a gain; a 196 PM1 is still Low Level 1 there: '+tg[1].rows.join(' '));
  check(tg[0].pb==='Level 4' && tg[0].gain===263 && tg[0].lb==='High Level 2','a Level 4 last year (247) needs a Level 5 for a gain: 263 on the grade-8 scale; the 240 PM1 is High Level 2 there');
  check(!tg[0].rows.some(r=>/^Level 2=/.test(r)) && tg[0].rows.some(r=>/^Level 3=/.test(r)),'a Level 4 last year gets no Level 2 target (below last year\'s level), and keeps Level 3 (on grade level): '+tg[0].rows.join(' '));
  check(tg[2].pb==='High Level 2' && tg[2].gain===244 && tg[2].rows.filter(r=>r==='Level 3=244').length===1,'a High Level 2 gains at Level 3 (244 on the grade-8 scale), and the Level 3 row is not listed twice');
  check(tg[3] && tg[3].prior==null && tg[3].gain==null && /Level 3=244\*/.test(tg[3].rows.join()) && /Level 4=254$/.test(tg[3].rows.join().replace(/,Level 5.*$/,'')),'a student new this year has no gain target but the level targets, met where PM1 already reached them');
  // 1c2 (audit, 24 Oct 2026): a student who missed PM1 has only last year's PM3, and it stays last year's; Focus's own
  // level decides the scale when the class flag would put a score on the wrong table
  const edge=await p.evaluate(({K,S,ids})=>{ const T=window.__tally; const s=T.state.sections[K];
    T.importFast({ students:[ { id:ids[6], name:S[6], grade:7, tests:[{ test:'FAST', pm:'PM3', year:'2025-26', level:1, scale:180, grade:6 }], info:{} },
      { id:ids[7], name:S[7], grade:7, tests:[{ test:'FAST', pm:'PM3', year:'2025-26', level:3, scale:230, grade:6 }, { test:'FAST', pm:'PM1', year:'2026-27', level:4, scale:250 }], info:{} } ], blank:0, windows:[{ pm:'PM3', year:'2025-26' },{ pm:'PM1', year:'2026-27' }] }, 'edge.csv');
    const a=T.fastTargets(s,S[6]), b=T.fastTargets(s,S[7]); const html=T.fastReportSection ? T.fastReportSection(s,S[6]) : '';
    return { a:{ prior:a.prior&&a.prior.scale, pg:a.prior&&a.prior.grade, latest:a.latest, gain:a.gain&&a.gain.score, gradeNow:a.gradeNow }, b:{ gradeNow:b.gradeNow, lb:b.latestBucket&&b.latestBucket.label, gain:b.gain&&b.gain.score }, html }; },{K,S,ids});
  check(edge.a.prior===180 && edge.a.pg===6 && edge.a.latest===null && edge.a.gain===198 && edge.a.gradeNow===8,'only last year\'s PM3 in Tally: it is last year\'s (grade 6), there is no window this year yet, and the gain target is still set: '+JSON.stringify(edge.a));
  check(edge.b.gradeNow===7 && edge.b.lb==='Level 4' && edge.b.gain===247,'Focus says the 250 PM1 is Level 4, which only the grade-7 table gives, so that student\'s targets sit on the grade-7 scale: '+JSON.stringify(edge.b));
  // 1d. the FAST report: one page, scales for both years, the targets, a goal box
  await open(1); check(await p.locator('#pFast').count()===1,'a student with FAST results gets a FAST report button');
  const [fr]=await Promise.all([ctx.waitForEvent('page'), p.click('#pFast')]); await fr.waitForLoadState(); await fr.waitForTimeout(500);
  const frTxt=(await fr.evaluate(()=>document.body.innerText)).replace(/\s+/g,' '); const frPages=(await fr.pdf({format:'Letter'})).toString('latin1').match(/\/Type\s*\/Page[^s]/g).length;
  const frMarks=await fr.evaluate(()=>({ above:[...document.querySelectorAll('.marks:not(.under) .mk')].map(m=>m.textContent), under:[...document.querySelectorAll('.marks.under .mk')].map(m=>m.textContent) }));
  check(frMarks.above.length===2 && frMarks.under.length===2 && frMarks.under.every(t=>/Gain|Grade level/.test(t)),'scores are marked above the bands and the targets below them: '+JSON.stringify(frMarks));
  check(frPages===1 && await fr.locator('.scale').count()===2 && await fr.locator('.mk').count()>=2 && /YOUR TARGETS FOR PM2 AND PM3/i.test(frTxt) && /Mid Level 1 learning gain 198/.test(frTxt) && await fr.locator('svg.fline circle').count()>=2 && /My goal for PM3/.test(frTxt) && /Math Grade 6 FAST/.test(frTxt) && /Math Grade 8 FAST/.test(frTxt) && !/Tally|school grade|above grade|cut scores/.test(frTxt),'the FAST report prints on one page: two scales with the scores marked, the targets, a goal box ('+frPages+' page)');
  const frCards=await fr.evaluate(()=>[...document.querySelectorAll('.cards > div')].map(d=>d.innerText.replace(/\s+/g,' ')));
  check(/^MATH GRADE 6 FAST PM3/i.test(frCards[0]) && /^MATH GRADE 8 FAST PM1/i.test(frCards[1]) && /\((\+|−)\d+\)/.test(frCards[1]) && !/than last year/.test(frCards[1]) && await fr.locator('.cards .lv i').count()>=2,'the cards name the test and window, show the change in brackets, and fill each level pill by where the score sits: '+frCards.slice(0,2).join(' | '));
  check(/scored a 168 \(Low Level 1\) on the 25\/26 Math Grade 6 FAST\. A learning gain in 26\/27 means scoring a 198 \(Mid Level 1\) or higher on the Math Grade 8 FAST\. On the PM1, the score was a 196 \(Low Level 1\), so 2 more points are needed for a gain\./.test(frTxt) && !/LAST YEAR AND THIS YEAR/i.test(frTxt) && /YOUR FAST SCORES/i.test(frTxt) && /Dec 8/.test(frTxt) && /May/.test(frTxt) && /25\/26 School Year · Math Grade 6 FAST/.test(frTxt) && /26\/27 School Year · Math Grade 8 FAST/.test(frTxt),'the explanation reads as Croix wrote it, the extra heading is gone, and the chart dates PM2 (Dec 8) and PM3 (May)');
  await fr.close();
  await open(1); const tgt=(await p.textContent('#pTests')).replace(/\s+/g,' ');
  check(/Last year's PM3 ?168/.test(tgt) && /Math Grade 6 FAST/.test(tgt) && /Math Grade 8 FAST/.test(tgt) && /What PM2 and PM3 need ?Math Grade 8 FAST/.test(tgt) && /Mid Level 1 ?learning gain ?198/.test(tgt) && /2 more than PM1/.test(tgt) && /Level 3 ?on grade level ?244/.test(tgt),'the student page shows the buckets and the targets in plain words: '+tgt.slice(0,160));
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
  const expectFor=i=>({ missing: raw.gb.assignments.filter(a=>a.status && a.status[i]==='missing' && !/\bixl\b/i.test(a.name)).map(a=>a.name),
    redo: raw.gb.assignments.filter(a=>assess(a) && a.status && a.status[i]==='score' && a.values[i]!=null && a.values[i]/a.max<0.7).map(a=>a.name) });
  const nice=n=>{ const m=n.match(/^([^,]+),\s*(.+)$/); const t=s=>s.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()); return t(m[2].split(/\s+/)[0]+' '+m[1]); };
  let worst=-1, best=-1; S.forEach((_,i)=>{ const e=expectFor(i); if (worst<0 && e.missing.length && e.redo.length) worst=i; if (best<0 && !e.missing.length) best=i; });
  check(worst>=0 && best>=0,'the fixture has a student with missing work and a low assessment (row '+worst+') and one with nothing missing (row '+best+')');
  await open(worst); await p.click('#pConf'); await p.waitForTimeout(400);
  const v=await p.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.confForm input,.confForm textarea')].map(e=>[e.id,e.value])));
  const want=await p.evaluate(({K,nm})=>{ const T=window.__tally; const s=T.state.sections[K]; const i=s.grades.students.indexOf(nm); return { g:T.computeGrade(s,i).rounded, per:s.period, rt:T.retakeStatus(s,nm) }; },{K,nm:S[worst]});
  const ew=expectFor(worst);
  check(v.cfName===nice(S[worst]) && v.cfCurrent===String(want.g) && v.cfPeriod===String(want.per||'') && v.cfGrade==='7' && /Grade 7/.test(v.cfCourse),'header fields: '+[v.cfName,v.cfGrade,v.cfCourse,v.cfPeriod,v.cfCurrent+'%'].join(' · '));
  check(ew.missing.every(n=>v.cfWork.includes('• '+n+' (due') || v.cfWork.includes('• '+n+'\n')) && (v.cfWork.match(/^• (?!.*skills? left$)/gm)||[]).length===ew.missing.length+ew.redo.length && ew.redo.every(n=>v.cfWork.includes('• '+n+': ')) && /^Turn in \(zeros until turned in\):/m.test(v.cfWork) && /^Can be retaken \(below 70%\):/m.test(v.cfWork),'"Missing & redo" lists exactly the '+ew.missing.length+' assignments not handed in and the '+ew.redo.length+' assessments under 70%');
  check(/^Retake allowed after: missing work( \+ Unit \d+ IXL)?$/m.test(v.cfWork) && !want.rt.ok,'and says what opens a retake: "'+(v.cfWork.match(/^Retake.*$/m)||[''])[0]+'"');
  check(new RegExp('^• '+ew.missing.length+' missing assignments?, (a zero|zeros) until turned in').test(v.cfConcerns.split('\n')[0]),'Concerns is drafted from the numbers: "'+v.cfConcerns.split('\n')[0]+'"');
  check(['Q1','Q2','S1','Q3','Q4','S2'].every(q=>v['cf'+q]===''),'no report-card grade is filled while no quarter has been closed');
  // the draft rules, over the whole class (21 Oct 2026, after three reviews: a teacher's, a data auditor's, a parent's)
  const all=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; return s.grades.students.map(n=>{ const d=T.conferenceData(s,n); const dr=T.conferenceDraft(d); return { n, S:dr.strengths, C:dr.concerns, W:T.conferenceWork(d), poss:d.ix?d.ix.poss:null, graded:d.graded, redo:d.redo.length, missing:d.missing.length+d.missedTests.length, grade:d.r?d.r.rounded:null, noIxl:d.rt.noIxl, checks:T.conferenceChecks(d) }; }); },K);
  const lines=x=>x?x.split('\n').filter(Boolean):[];
  const bad=(rule,f)=>{ const b=all.filter(f); check(b.length===0, rule+(b.length?': not for '+b.length+': '+b.slice(0,2).map(x=>JSON.stringify(x.S+' | '+x.C+' | '+x.W).slice(0,220)).join(' ; '):'')); };
  bad('no strength rests on a notebook check or a vocabulary quiz',x=>/notebook|vocab/i.test(x.S));
  bad('no dashboard fragments or jargon: "Strong on assessments", "assessment average", "at goal", "pts", "(listed below)" only after a count',x=>/Strong on|assessment average|at goal|\bpts\b|Best assessment/i.test(x.S+x.C+x.W));
  bad('no IXL account wording ever reaches the form (it is a teacher check instead)',x=>/IXL account|no IXL|First no/i.test(x.S+x.C+x.W) || (x.noIxl && !x.checks.some(c=>/IXL isn't linked/.test(c))));
  bad('the year-long IXL total is never printed',x=>x.poss && new RegExp('of '+x.poss+'\\b').test(x.S+x.C));
  bad('Strengths and Concerns are short notes: every line a bullet, no sentence full stops, at most four each',x=>[...lines(x.S),...lines(x.C)].some(l=>!/^• [A-Z0-9]/.test(l) || /[.]$/.test(l)) || lines(x.S).length>4 || lines(x.C).length>4);
  bad('a retake line appears only with something below 70%',x=>/^Retake/m.test(x.W)!==(x.redo>0));
  bad('missing work is always in Concerns',x=>x.missing>0 && !/missing assignment|not taken yet/.test(x.C));
  bad('nothing is called a concern or a strength for a student with only participation graded',x=>x.graded<3 && (x.C!=='' || /Every assignment turned in/.test(x.S)));
  bad('every student with something graded gets a Concerns line ("No concerns right now" when there are none)',x=>x.graded>=3 && x.C==='');
  bad('"Every assignment turned in" never sits beside missing work',x=>/Every assignment turned in/.test(x.S) && x.missing>0);
  // report-card grades: quarters as closed, semesters the average of two quarters rounded half up
  const rc=await p.evaluate(()=>{ const R=window.__tally.reportCard; const c=(q,g,closed=true)=>({ q, g, closed });
    return [R([c(1,89),c(2,90)]), R([c(1,88),c(2,91)]), R([c(1,79),c(2,80,false)]), R([c(1,92),c(2,85),c(3,70),c(4,75)]), R([c(1,64),c(2,55)])]; });
  check(rc[0].S1===90 && rc[1].S1===90 && rc[2].S1===null && rc[2].Q2===null && rc[2].Q1===79 && rc[3].S1===89 && rc[3].S2===73 && rc[4].S1===60,'semesters: 89 & 90 → 90, 88 & 91 → 90 (89.5 rounds up), a quarter still open leaves S1 blank, 70 & 75 → 73, 64 & 55 → 60');
  const fin=await p.evaluate(({K,nm})=>{ const T=window.__tally; const s=T.state.sections[K]; T.closeQuarter(1,{acc:[],on:[]}); const i=s.qArchive['1'].gb.students.indexOf(nm); const d=T.conferenceData(s,nm); return { q1:s.qArchive['1'].final[i], rc:d.rc }; },{K,nm:S[worst]});
  check(fin.q1!=null && fin.rc.Q1===fin.q1 && fin.rc.S1===null,'once Quarter 1 is closed its final grade fills Q1 ('+fin.q1+'); S1 waits for Q2');
  await p.evaluate(()=>{ window.__tally.reopenQuarter(1); }); await p.click('#mClose'); await p.waitForTimeout(300);
  await open(best); await p.click('#pConf'); await p.waitForTimeout(400);
  const vb=await p.evaluate(()=>({ s:document.querySelector('#cfStrengths').value, w:document.querySelector('#cfWork').value }));
  check(/^• Every assignment turned in$/m.test(vb.s) && (vb.w==="" || !/^Turn in/m.test(vb.w)),'a student with nothing missing gets that as a strength, and no "not handed in" list');
  await p.click('#mClose'); await p.waitForTimeout(300);
  // notes go into the form on a click; edits, the teacher and the course are kept
  await open(0); await p.click('#pConf'); await p.waitForTimeout(400);
  const nAside=await p.evaluate(()=>document.querySelectorAll('.cfNotes li').length); check(nAside===2,'the student\'s notes sit beside the form');
  await p.click('.cfNotes li:last-child [data-cfadd="concerns"]'); await p.fill('#cfTeacher','Mr. Shaffer'); await p.fill('#cfCourse','M/J Grade 7 Math');
  const conc=await p.inputValue('#cfConcerns'); check(conc.endsWith(note1),'"+ Concerns" adds the note to the end of Concerns');
  check((await p.inputValue('#cfTests'))==='FAST PM1 2026-27: Level 2, 240 (above grade); FAST PM3 2025-26: Level 4, 247, 81st percentile (grade 6 test)','the test-history line: "'+(await p.inputValue('#cfTests'))+'"');
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

  // ---- 4. the full save carries notes, FAST, the kept form text and the header fields ----------------------------------------
  await p.click('#mClose').catch(()=>{}); await p.waitForTimeout(200); await open(3); await p.click('#pConf'); await p.waitForTimeout(300); await p.fill('#cfStrengths','Edited for row three.'); await p.click('#mCancel'); await p.waitForTimeout(200);
  const FS=await fullSave(p); const bk=FS.file; const B=FS.json.state; await p.keyboard.press('Escape');
  check(B.tests && B.tests['id:'+ids[0]] && B.settings.teacherName==='Mr. Shaffer' && Object.values(B.settings.courseNames).includes('M/J Grade 7 Math') && Object.keys(B.sections[K].stuNotes).length===1 && Object.keys(B.sections[K].confForms).length===1,'the full save holds FAST, the teacher and course names, the notes and the kept form text');
  const ctx2=await b.newContext({viewport:{width:1536,height:864}}); const q=await ctx2.newPage(); q.on('pageerror',e=>errs.push('restore: '+e.message)); q.on('dialog',d=>d.accept()); await q.goto('file://'+path.resolve(APP)); await q.waitForTimeout(300);
  await q.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await q.waitForTimeout(500); await q.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await q.click('#rpSave'); await q.waitForTimeout(300);
  await q.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await q.waitForTimeout(500); await pick(q); await q.waitForTimeout(600);
  await q.setInputFiles('#file',[bk]); await q.waitForTimeout(800);
  const R=await q.evaluate(({K,a,c})=>{ const T=window.__tally; const s=T.state.sections[K]; return { notes:T.notesOf(s,a).length, tests:T.testHistory(s,a).length, kept:(s.confForms||{})[Object.keys(s.confForms||{})[0]], teacher:T.state.settings.teacherName }; },{K,a:S[0],c:S[3]});
  check(R.notes===2 && R.tests===2 && R.kept && R.kept.strengths==='Edited for row three.' && R.teacher==='Mr. Shaffer','opening the full save in another Tally brings all of it back');
  // the full save keeps it too (it is the whole state); the migrate whitelist keeps the new settings through a reload
  await q.reload(); await q.waitForTimeout(500); check(await q.evaluate(()=>window.__tally.state.settings.teacherName==='Mr. Shaffer' && Object.keys(window.__tally.state.tests).length>0),'…and they survive a reload');
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('screenshots: '+tmp);
  await b.close(); done();
})();
