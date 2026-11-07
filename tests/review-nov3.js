// The weekly report after the review of 3 Nov 2026 (Croix: "Fix all ten"). Read as a student or a parent would, the
// report had ten things that confused: projections from two different grades, missing work counted three ways, "listed
// below" over nothing, a part-done IXL column read as finished, "turn in" a quiz, Tally's own words ("not linked",
// "assigned units"), two IXL skills with one name, a next-assessment line squeezed into a narrow column, "Start here"
// far from goal, and "1 more assessment can be retaken" without saying which. Expectations here are computed from the
// gradebook and the IXL export directly, not from the report's own helpers.
const { chromium, fs, path, exe, check, done, APP, pick } = require('./lib');
const K = '1205050-7T1A';
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1300,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const asks=[]; p.on('dialog',d=>{ asks.push(d.message()); d.accept(); });
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  // helpers in the page: what a report says, and the facts to hold it to
  await p.evaluate(K=>{ const T=window.__tally; T.state.settings.teacherName='Mr. Shaffer'; T.save();
    const txt=x=>x?x.textContent.replace(/\s+/g,' ').trim():'';
    window.__R={ K, txt,
      s:()=>T.state.sections[K],
      look:(i,row)=>{ const s=T.state.sections[K]; const d=document.createElement('div'); d.innerHTML=T.studentReportSection(s,i,row===undefined?T.gbRows(s)[i]:row); const panelOf=re=>[...d.querySelectorAll('.panel')].find(x=>re.test(txt(x.querySelector('.ph'))));
        const tile=re=>[...d.querySelectorAll('.board > div')].find(x=>re.test(txt(x.querySelector('small'))));
        const mv=panelOf(/IXL and the grade/i);   // the IXL columns as sentences (7 Nov 2026); the missing-work totals sit under the steps (.tot)
        return { all:txt(d), big:txt(d.querySelector('.big')), sub:txt(d.querySelector('.gline')), main:txt(d.querySelector('.panel.main')), lead:[...d.querySelectorAll('.panel.main .pbody > p.lead')].map(txt),
          steps:[...d.querySelectorAll('.panel.main .steps tbody tr')].map(txt), tots:[...d.querySelectorAll('.panel.main .tot')].map(txt), rt:txt(d.querySelector('.panel.main .rt')), howl:txt(d.querySelector('.howl')),
          missN:txt(tile(/Missing/).querySelector('b')), missSpan:txt(tile(/Missing/).querySelector('span')), ixlSpan:txt(tile(/IXL/).querySelector('span')), rtSpan:txt(tile(/Retake/).querySelector('span')),
          moves:mv?[...mv.querySelectorAll('.words p')].map(pp=>({ t:txt(pp) })):[],
          missHead:txt(d.querySelector('.panel.miss .ph')), miss:[...d.querySelectorAll('.panel.miss tbody tr')].map(tr=>({ t:txt(tr), box:!!tr.querySelector('.box') })), missBody:txt(d.querySelector('.panel.miss .pbody')),
          ixlPanel:txt(panelOf(/IXL still owed/i)), sk:[...d.querySelectorAll('.panel.ixl .sk')].map(x=>({ name:txt(x.querySelector('.nm')), sid:txt(x.querySelector('.sid')) })),
          start:[...d.querySelectorAll('.panel.ixl .start .si')].map(txt), since:txt(d.querySelector('.since')), hint:txt(d.querySelector('.pledge > small')),
          lists:!!d.querySelector('.panel.miss .box, .panel.ixl .sk'), hasStart:!!d.querySelector('.panel.ixl .start') }; },
      // the IXL points Focus doesn't have yet, from the export: a point a skill at goal, up to the column's points
      copies:i=>{ const s=T.state.sections[K]; const o=T.openSec(s); const row=T.gbRows(s)[i]; if (!row||row.ixl==null) return []; return o.grades.assignments.filter(a=>/\bixl\b/i.test(a.name)&&a.max>0&&a.status&&(a.status[i]==='score'||a.status[i]==='missing')).map(a=>{ const u=T.gbUnitFor(s,a); const unit=u&&T.unitsOf(s).find(x=>x.name===u.name); if (!unit) return null; const to=Math.min(a.max,T.points(s,unit,row.ixl)), from=a.status[i]==='missing'?0:Number(a.values[i])||0; return to>from?{ name:a.name, from, to, max:a.max }:null; }).filter(Boolean); },
      // NHI work, less an IXL column whose skills are all at goal in IXL
      owed:i=>{ const s=T.state.sections[K]; const o=T.openSec(s); const row=T.gbRows(s)[i]; return o.grades.assignments.filter(a=>a.status&&a.status[i]==='missing').filter(a=>{ if (!/\bixl\b/i.test(a.name)||!row||row.ixl==null) return true; const u=T.gbUnitFor(s,a); const unit=u&&T.unitsOf(s).find(x=>x.name===u.name); return !(unit&&T.points(s,unit,row.ixl)>=a.max); }).map(a=>a.name); },
      setCell:(i,name,v)=>{ const a=T.state.sections[K].grades.assignments.find(x=>x.name===name); const keep=[a.status[i],a.values[i]]; if (v==null) { a.status[i]='missing'; a.values[i]=null; } else { a.status[i]='score'; a.values[i]=v; } return ()=>{ a.status[i]=keep[0]; a.values[i]=keep[1]; }; } };
  },K);

  // ---- 1. One baseline: the page projects from the grade with the IXL points in, so copying them changes nothing but the
  // grade at the top (Cobb: Unit 1 IXL 3 in Focus, 15 in IXL; Rhodes: Unit 2 IXL part done, Unit 1 IXL done) ----
  const base=await p.evaluate(()=>{ const T=window.__tally, R=window.__R; const s=R.s(); const gb=s.grades; const out=[];
    gb.students.forEach((n,i)=>{ const c=R.copies(i); if (!c.length) return; const before=R.look(i); const want=T.computeGrade(T.openSec(s),i,Object.fromEntries(c.map(x=>[x.name,x.to])));
      const undo=c.map(x=>R.setCell(i,x.name,x.to)); const after=R.look(i); undo.forEach(f=>f());
      const strip=x=>({ steps:x.steps, tots:x.tots, moves:x.moves.map(m=>m.t), miss:x.miss.map(m=>m.t), rt:x.rt, extra:x.lead.filter(l=>/^Retake /.test(l)) });
      out.push({ n, i, c, want:want.rounded+'% '+want.letter, big:before.big, sub:before.sub, lead:before.lead, afterBig:after.big, afterSub:after.sub, afterLead:after.lead[0]||'', same:JSON.stringify(strip(before))===JSON.stringify(strip(after)), b:strip(before), a:strip(after) }); });
    return out; });
  check(base.length>=3,'the fixture has students whose IXL points Focus doesn\'t have yet: '+base.map(x=>x.n.split(',')[0]+' '+x.c.map(c=>c.name+' '+c.from+'→'+c.to).join(', ')).join(' | '));
  const moved=base.filter(x=>x.want.split('%')[0]!==x.big.split('%')[0]);
  check(moved.length>0 && moved.every(x=>new RegExp('which makes it '+x.want.split('%')[0]+'%\\. Everything below starts from '+x.want.split('%')[0]+'\\.$').test(x.sub) && x.afterBig.replace(/\s/g,'')===x.want.replace(/\s/g,'')),'under the grade, the grade once the IXL is in Focus, in a sentence: the grade Focus shows after the copy: '+moved.map(x=>x.big+' → "'+x.sub+'"').join(' | '));
  check(base.every(x=>x.same),'every step, row and retake line reads the same before and after the teacher copies the IXL points: one baseline'+(base.filter(x=>!x.same).map(x=>' | '+x.n+': '+JSON.stringify(x.b).slice(0,300)+' vs '+JSON.stringify(x.a).slice(0,300)).join('')));
  check(base.every(x=>/^This is the grade in Focus today\. The \d+ IXL points? .+ already earned goe?s? in at the next grade update/.test(x.sub) && !/Your IXL points go into Focus/.test(x.lead.join(' '))) && base.every(x=>/^This is the grade in Focus today\.( Nothing is missing.*)?$/.test(x.afterSub||'This is the grade in Focus today.')),'the points that go in are said once, under the grade, and the sentence goes once they are in: '+base.map(x=>x.sub).join(' | ').slice(0,400));

  // ---- 2. One missing count: the tile, the strip, the back, the retake line, the log and the checklist agree ----
  const cnt=await p.evaluate(()=>{ const T=window.__tally, R=window.__R; const s=R.s(); const gb=s.grades; const rows=T.gbRows(s); const bad=[]; let n=0, named=0;
    const undo=[R.setCell(3,'Unit 2 IXL',null), R.setCell(6,'Unit 2 IXL',null), R.setCell(9,'Unit 1 IXL',null)];   // an IXL column done in IXL (Easton, 17 of 17), two part done (Whitlock 16 of 17, Dorsey 3 of 15)
    s.reportLog={}; gb.students.forEach(nm=>{ s.reportLog[T.norm(nm)]=[{ date:'2026-09-14', q:null, gb:'', ix:'', grade:70, missing:1, ixl:null }]; });
    gb.students.forEach((nm,i)=>{ const L=R.look(i); const want=R.owed(i); n++;
      const strip=(L.since.match(/Missing 1 → (\d+)/)||[])[1]; const head=(L.missHead.match(/(\d+) assignments?/)||[])[1]||'0';
      if (L.missN!==(want.length?String(want.length):'None') || strip!==String(want.length) || head!==String(want.length)) bad.push(nm+': tile '+L.missN+', strip '+strip+', back '+head+', owed '+want.length);
      const rt=T.retakeStatus(s,nm); if (!rt.ok && rt.missing.length) { named++; const all=new RegExp('(turn in|make up|turn in or make up) all '+rt.missing.length+' missing assignments').test(L.rt); if (!(all ? rt.missing.length===want.length : rt.missing.slice(0,2).every(x=>L.rt.includes(x)))) bad.push(nm+': retake line "'+L.rt+'" for '+rt.missing.join(', ')); }
      T.logReport(s,i,rows[i]); const e=s.reportLog[T.norm(nm)].slice(-1)[0]; if (e.missing!==want.length) bad.push(nm+': logged '+e.missing+', owed '+want.length); });
    const easton=R.look(3); undo.forEach(f=>f());
    return { bad, n, named, easton:{ missN:easton.missN, missSpan:easton.missSpan, miss:easton.miss, main:easton.main } }; });
  check(cnt.bad.length===0 && cnt.named>0,'for all '+cnt.n+' students the tile, "Since the last report", the back\'s header and the log count the same missing work; the retake line names it ('+cnt.named+' students)'+(cnt.bad.length?': '+cnt.bad.slice(0,4).join(' | '):''));
  check(cnt.easton.missN==='None' && cnt.easton.missSpan==='Unit 2 IXL done, not in Focus yet' && cnt.easton.miss.length===1 && !cnt.easton.miss[0].box && /^Unit 2 IXL 17 pts\s*done in IXL, not in Focus yet$/.test(cnt.easton.miss[0].t),'an IXL column Focus marks NHI with every skill done in IXL is not missing work: the tile reads 0 and names it, and the back notes it without a box: '+JSON.stringify(cnt.easton).slice(0,300));

  // ---- 3 and 4. An IXL column says where its skills are: listed below (and how far along), in IXL, or done ----
  const where=await p.evaluate(()=>{ const T=window.__tally, R=window.__R; const s=R.s(); const out={};
    { const k=T.gbRows(s)[6].ixl; const u2=T.unitsOf(s).find(u=>u.num===2); const keep=u2.idx.map(x=>s.scores[x][k]); u2.idx.forEach(x=>{ s.scores[x][k]=null; }); const back=R.setCell(6,'Unit 2 IXL',null); const best=T.state.settings.useBest; T.state.settings.useBest=false;   // Whitlock with nothing of Unit 2 begun (best scores off, so the cleared ones count)
      out.none=R.look(6); back(); T.state.settings.useBest=best; u2.idx.forEach((x,j)=>{ s.scores[x][k]=keep[j]; }); }
    let undo;
    undo=[R.setCell(11,'Unit 2 IXL',null)]; out.part=R.look(11); undo.forEach(f=>f());             // Rhodes: 2 of 17 in IXL
    undo=R.setCell(1,'Unit 2 IXL',null); out.unl=R.look(1); undo();                                 // Lowell Calder: not matched to IXL
    return out; });
  const row=(L,n)=>(L.miss.find(r=>r.t.startsWith(n))||{}).t||'';
  check(/do the skills listed below$/.test(row(where.none,'Unit 2 IXL')) && where.none.sk.length>=17 && where.none.missN==='2','an IXL column with nothing begun in IXL is missing work that points at the list below, and the list is there: '+row(where.none,'Unit 2 IXL'));
  check(/2 of 17 points so far: the rest are below$/.test(row(where.part,'Unit 2 IXL')) && where.part.moves.some(m=>/^Unit 2 IXL: 2 of 17 skills at goal\. Finishing it lifts the grade to \d+%/.test(m.t)),'a part-done IXL column says how far along it is, on the back and in "IXL and the grade": '+row(where.part,'Unit 2 IXL')+' / '+(where.part.moves.map(m=>m.t).join(' | ')));
  check(/do the skills in IXL$/.test(row(where.unl,'Unit 2 IXL')) && !/listed below/.test(where.unl.all) && /^IXL still owed\s*Your IXL skills aren't on this report\. Ask Mr\. Shaffer which ones are still owed\.$/.test(where.unl.ixlPanel),'with no IXL account matched, the column sends the student to IXL, never to a list that isn\'t there: '+row(where.unl,'Unit 2 IXL')+' / '+where.unl.ixlPanel);

  // ---- 5. A quiz or test not taken is made up, not turned in ----
  const mk=await p.evaluate(()=>{ const R=window.__R; const L=R.look(6); return { steps:L.steps, moves:L.moves.map(m=>m.t), miss:L.miss.map(m=>m.t), all:L.all }; });
  check(mk.miss.some(t=>/^Squares and Cubes Quiz 27 points · make it up/.test(t)) && !/Turn in Squares and Cubes Quiz|Squares and Cubes Quiz turned in/.test(mk.all) && (!mk.steps.some(t=>/Squares and Cubes Quiz/.test(t)) || mk.steps.some(t=>/^Make up Squares and Cubes Quiz/.test(t))),'a quiz not taken reads "make up": '+mk.miss.join(' | '));

  // ---- 6. The family's words: no "not linked", "assigned units", "check your IXL account"; the units by name ----
  const words=await p.evaluate(()=>{ const T=window.__tally, R=window.__R; const s=R.s(); const rows=T.gbRows(s); const bad=[]; let unl=0;
    s.grades.students.forEach((nm,i)=>{ const L=R.look(i); if (/not linked|assigned units|check your IXL account/i.test(L.all)) bad.push(nm+': '+(L.all.match(/.{30}(not linked|assigned units|check your IXL account).{0,30}/i)||[''])[0]);
      if (rows[i]&&rows[i].ixl==null) { unl++; if (L.ixlSpan!=='not on this report') bad.push(nm+': IXL tile "'+L.ixlSpan+'"'); if (L.rt && !/ask Mr\. Shaffer to check your IXL/.test(L.rt)) bad.push(nm+': retake "'+L.rt+'"'); }
      else if (L.ixlSpan!=='skills in Units 1, 2 and 3') bad.push(nm+': IXL tile "'+L.ixlSpan+'"'); });
    return { bad, unl }; });
  check(words.bad.length===0 && words.unl>0,'no report uses Tally\'s words: the IXL tile says "skills in Units 1, 2 and 3", or "not on this report" for the '+words.unl+' students not matched to IXL, whose retake line says to ask Mr. Shaffer'+(words.bad.length?': '+words.bad.slice(0,3).join(' | '):''));
  // before printing: the students whose IXL points Focus doesn't have, and the students not matched to IXL ("No IXL account" is an answer)
  const pre=await p.evaluate(()=>{ const T=window.__tally, R=window.__R; const s=R.s(); const rows=T.gbRows(s); const nm=s.grades.students; const unl=nm.filter((_,i)=>!rows[i]||rows[i].ixl==null); const beh=nm.filter((_,i)=>R.copies(i).length && T.computeGrade(T.openSec(s),i));
    s.aliases=s.aliases||{}; const none=rows.find(r=>r&&r.ixl==null); s.aliases[none.display]='#none'; s.grades.exportedAt=new Date().toISOString(); s.grades.importedAt=s.grades.exportedAt; s._dateKeep=s.date; s.date=T.todayISO(); T.save();
    return { unl:unl.length, beh:beh.length, noneNice:T.niceName(none.display), owed:nm.map((_,i)=>R.owed(i).length) }; });
  asks.length=0; const popP=await Promise.all([ctx.waitForEvent('page',{timeout:5000}).catch(()=>null), p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.printStudentReports(s,s.grades.students.map((_,i)=>i),'All'); },K)]).then(r=>r[0]);
  const outBack=popP ? await popP.evaluate(()=>[...document.querySelectorAll('section.teach tbody tr')].map(tr=>tr.children[3].textContent.trim())) : [];
  if (popP) await popP.close();
  await p.evaluate(()=>{ const s=window.__R.s(); delete s.aliases[Object.keys(s.aliases).find(k=>s.aliases[k]==='#none')]; s.date=s._dateKeep; delete s._dateKeep; window.__tally.save(); });
  const q0=asks[0]||'';
  check(new RegExp(`${pre.beh} students' IXL points aren't all in Focus yet \\(.+\\), so their reports count them as going in at the next grade update\\.`).test(q0) && new RegExp(`${pre.unl-1} students aren't matched to an IXL account \\(.+\\), so their reports can't list IXL skills\\.`).test(q0) && !q0.includes(pre.noneNice) && !/wants today's numbers/.test(q0),'before printing, the teacher hears which students\' IXL points Focus is missing and which students aren\'t matched to IXL (one marked "No IXL account" is not listed): '+q0.slice(0,400));

  check(outBack.length===pre.owed.length && outBack.every((t,k)=>t===(pre.owed[k]?String(pre.owed[k]):'')),'the teacher\'s "Reports out and back" page counts missing work as the reports do: '+outBack.join(','));

  // ---- 7. IXL's skill ID beside each skill: two skills can share a name ----
  const ids=await p.evaluate(()=>{ const T=window.__tally, R=window.__R; const s=R.s(); const rows=T.gbRows(s); let best=null;
    s.grades.students.forEach((nm,i)=>{ if (!rows[i]||rows[i].ixl==null) return; const L=R.look(i); const by={}; L.sk.forEach(x=>{ const nmOnly=x.name.replace(new RegExp(' '+x.sid+'$'),''); (by[nmOnly]=by[nmOnly]||[]).push(x.sid); }); const twins=Object.entries(by).filter(([,v])=>v.length>1);
      const known=new Set(s.skills.map(k=>k.id)); if (!best || twins.length>best.twins.length) best={ nm, n:L.sk.length, withId:L.sk.filter(x=>x.sid && known.has(x.sid)).length, twins, head:L.ixlPanel.slice(0,160) }; });
    return best; });
  check(ids && ids.n>0 && ids.withId===ids.n && ids.twins.length>0 && ids.twins.every(([,v])=>new Set(v).size===v.length) && /grey code typed into IXL's search box opens that skill/.test(ids.head),'every owed skill carries its IXL skill ID, so two skills with one name can be told apart: '+JSON.stringify(ids.twins.slice(0,2)));

  // ---- 8. The next assessment across the table; "Both"; "every missing assignment but" the IXL column the tile counts ----
  const tb=await p.evaluate(()=>{ const T=window.__tally, R=window.__R; const s=R.s(); const bad=[]; let next=0; s.grades.students.forEach((nm,i)=>{ const L=R.look(i); if (/Next assessment|The next test is worth/.test(L.all)) next++; });
    const both=R.look(7).tots; const undo=R.setCell(7,'Unit 1 IXL',null); const but=R.look(7); undo(); return { bad, next, both, but:but.tots, butN:but.missN }; });
  check(tb.bad.length===0 && tb.next===0,'the next test\'s box carries its date and unit only; no report has a next-assessment sentence (Croix, 7 Nov 2026)'+(tb.bad.length?': '+tb.bad.slice(0,2).join(' | '):''));
  check(tb.both.some(t=>/^Both missing assignments turned in\s*→ \d+% [A-F]$/.test(t)) && tb.but.some(t=>/^Every missing assignment but Unit 1 IXL turned in\s*→ \d+% [A-F]$/.test(t)) && tb.butN==='3','two missing assignments read "Both"; with an IXL column counted on the tile too (3), the total says which it leaves out: '+tb.both[0]+' / '+tb.but[0]);

  // ---- 9. "Start here" only within 15 of goal ----
  const st=await p.evaluate(()=>{ const T=window.__tally, R=window.__R; const s=R.s(); const rows=T.gbRows(s); const bad=[]; let shown=0, none=0;
    s.grades.students.forEach((nm,i)=>{ if (!rows[i]||rows[i].ixl==null) return; const L=R.look(i); const k=rows[i].ixl; const units=T.unitsOf(s).filter(u=>u.assigned&&u.total);
      const near=units.flatMap(u=>T.activeFor(s,u,k).map(x=>T.eff(s,x,k))).filter(v=>v>0&&v<s.threshold&&s.threshold-v<=15).sort((a,b)=>b-a).slice(0,3);
      const got=L.start.map(t=>Number((t.match(/^(\d+) from goal/)||[])[1]));
      if (JSON.stringify(got)!==JSON.stringify(near.map(v=>s.threshold-v))) bad.push(nm+': '+JSON.stringify(got)+' want '+JSON.stringify(near.map(v=>s.threshold-v)));
      if (got.length) shown++; else none++; });
    return { bad, shown, none }; });
  check(st.bad.length===0 && st.shown>0,'"Start here" lists the started skills within 15 of goal, closest first, and nothing farther ('+st.shown+' students have one, '+st.none+' don\'t)'+(st.bad.length?': '+st.bad.slice(0,3).join(' | '):''));

  // ---- 10. The other assessments to retake, by name; the plan box points only at what the page has ----
  const nm10=await p.evaluate(()=>{ const T=window.__tally, R=window.__R; const s=R.s(); const gb=s.grades; const rows=T.gbRows(s); const tests=['Unit 1 Assessment','Squares and Cubes Quiz','Unit 1 Vocabulary Quiz']; let L=null, i=-1;
    for (const k of gb.students.map((_,k)=>k).filter(k=>rows[k]&&rows[k].ixl!=null&&!R.owed(k).length&&T.retakeStatus(s,gb.students[k]).ok)) { for (const drop of [2,3,4]) {
      const undo=tests.map(n=>{ const a=gb.assignments.find(x=>x.name===n); return R.setCell(k,n,a.max-drop); }); const got=R.look(k); undo.forEach(f=>f());
      if (got.lead.some(l=>/can be retaken too/.test(l))) { L=got; i=k; break; } } if (L) break; }
    const hints=[]; gb.students.forEach((nm,k)=>{ const H=R.look(k); const want=H.hasStart?'pick a step from "Do this week" or "Start here" on the back':H.lists?'pick a step from "Do this week" or the lists on the back':'pick a step from "Do this week"'; if (H.hint!==want) hints.push(nm+': "'+H.hint+'"'); });
    return { i, lead:L?L.lead.filter(l=>/^Retake /.test(l)):[], hints }; });
  check(nm10.lead.length===1 && /^Retake (Unit 1 Assessment|Squares and Cubes Quiz|Unit 1 Vocabulary Quiz): .* (Unit 1 Assessment|Squares and Cubes Quiz|Unit 1 Vocabulary Quiz)( and (Unit 1 Assessment|Squares and Cubes Quiz|Unit 1 Vocabulary Quiz))? can be retaken too\.$/.test(nm10.lead[0]) && !/more assessments? can be retaken/.test(nm10.lead[0]),'the other assessments a student can retake are named, not counted: '+(nm10.lead[0]||'(no retake line)'));
  check(nm10.hints.length===0,'the plan box sends the student to "Start here" only when the back has it, and to the lists on the back only when there are any'+(nm10.hints.length?': '+nm10.hints.slice(0,3).join(' | '):''));

  console.log('errors:',errs); check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
