// "Quickest way to the next letter" reads in the order to do it, and adds up on the page.
// Croix, 7 Oct 2026, with a student's page: "How does the math here make sense? Quickest path should be the two [big
// ones], not 2.02 and 1.4": the list was in gradebook order, so a +3 worksheet sat above a +7 one; and "NHI isn't in
// the retake category because it hasn't even happened yet": a never-handed-in assessment was a row in the retake table.
// Runs on the scrubbed real class, with one student reshaped to match the page he sent.
const { chromium, fs, path, exe, check, done, APP, pick } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1536,height:864}}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const K='1205050-7T1A', WHO='RHODES, SUTTON ELLIS';
  // his student: four things never handed in: two 10-point worksheets, a 20-point worksheet, and a 10-point assessment
  await p.evaluate(({K,WHO})=>{ const T=window.__tally; const s=T.state.sections[K]; const i=s.grades.students.indexOf(WHO); const A=n=>s.grades.assignments.find(a=>a.name===n);
    A('2.01 Worksheet').max=20; A('2.01 Worksheet').values=A('2.01 Worksheet').values.map(v=>v==null?null:v*2);
    ['2.03 Worksheet'].forEach(n=>{ A(n).status[i]='score'; A(n).values[i]=6; });
    ['2.02 Worksheet','2.01 Worksheet','Worksheet 1.4','Unit 1 Notebook Check'].forEach(n=>{ A(n).status[i]='missing'; A(n).values[i]=null; });
    s.grades.assignments.forEach(a=>{ a.missing=a.status.filter(x=>x==='missing').length; }); T.save(); },{K,WHO});
  await p.reload(); await p.waitForTimeout(700);
  // ---- the plan, recounted ---------------------------------------------------------------------------------------
  const q=await p.evaluate(({K,WHO})=>{ const T=window.__tally; const s=T.state.sections[K]; const i=s.grades.students.indexOf(WHO); const f=T.findStudent(s,WHO); const q=T.quickestPath(s,s,i,f.ixl); const base=T.computeGrade(s,i);
    const now=a=>a.status[i]==='missing'?0:(Number(a.values[i])||0);
    // each line's gain on its own, from where the student is now, and the grade with every line so far applied
    const acc={}; const lines=q.plan.map(x=>{ const solo=T.computeGrade(s,i,{[x.a.name]:x.to}).pct-base.pct; acc[x.a.name]=x.to; return { kind:x.kind, name:x.a.name, n:x.n, to:x.to, max:x.a.max, was:now(x.a), after:x.after, recount:T.computeGrade(s,i,acc).rounded, perStep:solo/x.n }; });
    return { base:base.rounded, target:q.target, letter:q.letter, reached:q.reached, result:q.result.rounded, steps:q.steps, lines, overKeys:Object.keys(q.over).sort().join('|'), planKeys:[...new Set(q.plan.filter(x=>x.kind!=='ixlreq').map(x=>x.a.name))].sort().join('|'), nhiOrder:q.nhi.map(a=>a.name).join(' > ') }; },{K,WHO});
  console.log('plan: '+q.base+'% → '+q.lines.map(l=>(l.kind==='ixl'?l.n+' IXL skills in ':'')+l.name+' → '+l.after).join(', '));
  check(q.reached && q.letter==='D' && q.lines.filter(l=>l.kind==='nhi').length>=3 && q.lines.some(l=>l.kind==='ixl'||l.kind==='copy'),'the reshaped student reaches a D with the IXL already earned copied in and three of the four missing pieces ('+q.base+'% → '+q.result+'%, '+q.steps+' steps)');
  check(q.planKeys===q.overKeys,'the list is exactly the work the result is computed from: nothing counted that is not listed');
  check(q.lines.every(l=>l.after===l.recount),'the grade shown after each line is the grade with that line and every line above it done: '+q.lines.map(l=>l.after).join(' → '));
  check(q.lines[q.lines.length-1].after===q.result && q.lines.every((l,k)=>k===0||l.after>=q.lines[k-1].after),'the last line lands on the headline result, and the grade never steps down ('+q.result+'%)');
  const copyFirst=q.lines.findIndex(l=>l.kind!=='copy'); check(q.lines.slice(0,Math.max(0,copyFirst)).every(l=>l.kind==='copy') && q.lines.slice(Math.max(0,copyFirst)).every(l=>l.kind!=='copy'),'IXL already earned but not yet in Focus is a copy step, listed first (audit, 22 Oct 2026)');
  const nonRe=q.lines.filter(l=>l.kind!=='retake'&&l.kind!=='copy'); check(nonRe[0].kind==='nhi' && nonRe[0].name!=='2.02 Worksheet' && nonRe[0].name!=='Worksheet 1.4','the first line is one of the two big ones, not a 10-point worksheet: '+nonRe[0].name);
  check(new Set(nonRe.slice(0,2).map(l=>l.name)).size===2 && nonRe.slice(0,2).every(l=>['2.01 Worksheet','Unit 1 Notebook Check'].includes(l.name)),'the 20-point worksheet and the notebook check lead the list: '+q.nhiOrder);
  const ix=q.lines.findIndex(l=>l.kind==='ixl'); check(ix<0 || (ix===q.lines.filter(l=>l.kind!=='retake').length-1 && q.lines[ix].perStep<Math.min(...q.lines.filter(l=>l.kind==='nhi').map(l=>l.perStep))),'IXL skills come after the missing work here: one skill moves the grade less than any one assignment ('+(ix<0?'none needed':q.lines[ix].perStep.toFixed(2))+' a skill)');
  // ---- on the page ---------------------------------------------------------------------------------------------------
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(300); await p.click('#openGrades'); await p.waitForTimeout(500);
  await p.locator('.gstu tr[data-stu]',{hasText:'RHODES'}).first().click(); await p.waitForTimeout(500);
  const pg=await p.evaluate(()=>{ const card=document.querySelector('#pQuick'); const lis=[...card.querySelectorAll('.qpath > li')].map(li=>({ what:li.querySelector('b').textContent, after:(li.querySelector('.qafter')||{textContent:''}).textContent.trim() }));
    const tables=[...document.querySelectorAll('#pWhat table.whatif')]; const sub=[...document.querySelectorAll('#pWhat h4.subh')].map(h=>h.textContent);
    const missRows=[...tables[0].querySelectorAll('tbody tr:not(.total)')].map(tr=>({ name:tr.querySelector('b').textContent, gain:Number((tr.textContent.match(/\+(\d+)\s*$/)||[])[1]) }));
    const reIdx=sub.findIndex(h=>/retaken/.test(h)); const reT=[...document.querySelectorAll('#pWhat h4.subh')].find(h=>/retaken/.test(h.textContent)); const reRows=reT?[...reT.nextElementSibling.querySelectorAll('tbody tr')].map(tr=>({ name:tr.querySelector('b').textContent, now:tr.children[1].textContent.trim() })):[];
    return { head:card.querySelector('.qres').textContent, lis, missRows, reRows, h:[...card.querySelectorAll('.qafter')].map(e=>{ const r=e.getBoundingClientRect(), c=card.getBoundingClientRect(); return r.right<=c.right+1 && r.width>0; }) }; });
  check(pg.lis.length===q.lines.length && pg.lis.every((l,k)=>l.after==='→ '+q.lines[k].after+'%'),'each line on the student\'s page ends with the grade it brings: '+pg.lis.map(l=>l.what.replace(/^Turn in /,'')+' '+l.after).join(' · '));
  check(new RegExp(q.base+'% → '+q.result+'% D').test(pg.head) && pg.lis[pg.lis.length-1].after==='→ '+q.result+'%' && pg.h.every(Boolean),'…and the last one is the number in the heading ('+pg.head.trim()+')');
  const gainOf=n=>(pg.missRows.find(r=>r.name===n)||{}).gain; const turnIns=pg.lis.filter(l=>/^Turn in /.test(l.what)).map(l=>l.what.replace(/^Turn in /,''));
  check(turnIns.length>=3 && turnIns.every((n,k)=>k===0||gainOf(turnIns[k-1])>=gainOf(n)),'the turn-ins are in the order of the "+N" beside each in the table below: '+turnIns.map(n=>n+' +'+gainOf(n)).join(', '));
  // ---- NHI is missing work, not a retake -----------------------------------------------------------------------------
  check(pg.missRows.some(r=>r.name==='Unit 1 Notebook Check'),'a never-handed-in assessment is under "If missing work were turned in"');
  check(pg.reRows.length>0 && !pg.reRows.some(r=>r.name==='Unit 1 Notebook Check') && pg.reRows.every(r=>/^\d/.test(r.now) && !/NHI/.test(r.now)),'…and not under "If an assessment were retaken": every row there has a score to improve on ('+pg.reRows.map(r=>r.name).join(', ')+')');
  // the student's own screen already had it right; hold it there too
  await p.click('#pShow'); await p.waitForTimeout(500);
  const sh=await p.evaluate(()=>({ re:[...document.querySelectorAll('#show .shRow[data-k="re"] .shL b')].map(b=>b.textContent), miss:[...document.querySelectorAll('#show .shRow[data-k="miss"] .shL b')].map(b=>b.textContent), order:[...document.querySelectorAll('#show .qpath > li > b')].map(b=>b.textContent), after:[...document.querySelectorAll('#show .qpath .qafter')].map(e=>e.textContent.trim()) }));
  check(sh.re.length>0 && !sh.re.includes('Unit 1 Notebook Check') && sh.miss.includes('Unit 1 Notebook Check') && sh.order.filter(t=>!/IXL goes into Focus/.test(t)).join('|')===pg.lis.map(l=>l.what).filter(t=>!/^Copy .* IXL into Focus$/.test(t)).join('|') && sh.order.filter(t=>/IXL goes into Focus/.test(t)).length===pg.lis.filter(l=>/^Copy .* IXL into Focus$/.test(l.what)).length && sh.after.join('|')===pg.lis.map(l=>l.after).join('|'),'Show student: same order, same running grade, and no NHI among the retakes');
  await p.reload(); await p.waitForTimeout(600);
  // ---- every student in the class ------------------------------------------------------------------------------------
  const all=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; let n=0, bad=[]; s.grades.students.forEach((name,i)=>{ const f=T.findStudent(s,name); const q=T.quickestPath(s,s,i,f?f.ixl:null); if (!q||q.top) return; n++; const acc={}; let prev=-1, ok=true; q.plan.forEach(x=>{ acc[x.a.name]=x.to; if (T.computeGrade(s,i,acc).rounded!==x.after || x.after<prev) ok=false; prev=x.after; });
      if (q.plan.length && q.plan[q.plan.length-1].after!==q.result.rounded) ok=false; if (Object.keys(q.over).sort().join('|')!==q.plan.filter(x=>x.kind!=='ixlreq').map(x=>x.a.name).sort().join('|')) ok=false; if (q.plan.findIndex(x=>x.kind==='retake')>-1 && q.plan.slice(q.plan.findIndex(x=>x.kind==='retake')).some(x=>x.kind!=='retake')) ok=false; if (!ok) bad.push(name); }); return { n, bad }; },K);
  check(all.n>=5 && all.bad.length===0,'for all '+all.n+' students with a plan: the lines add up to the result, in order, retakes last'+(all.bad.length?': not for '+all.bad.length:''));
  // Croix, 21 Oct 2026: "It should not suggest a retake if it is the quickest route. A student cannot take a retake unless
  // they are all caught up on everything." Every plan with a retake does all missing work and the current unit's IXL
  // first; a plan never lists a retake that the catch-up alone makes unnecessary; no IXL link, no retake.
  const rk=await p.evaluate(K=>{ const T=window.__tally; const sec=T.state.sections[K]; const s=T.openSec(sec); const out={ withRetake:0, bad:[], blocked:0 };
    // make some students need a retake: drop their best quiz to a low score so catch-up work can't reach the letter
    const run=()=>s.grades.students.forEach((nm,i)=>{ const f=T.findStudent(sec,nm); const q=T.quickestPath(sec,s,i,f.ixl); if(!q||q.top) return; const rt=T.retakeStatus(sec,nm);
      const ri=q.plan.findIndex(x=>x.kind==='retake'); if (ri<0) return; out.withRetake++;
      const before=q.plan.slice(0,ri); const missing=s.grades.assignments.filter(a=>a.max>0&&a.status&&a.status[i]==='missing'&&!/\bixl\b/i.test(a.name)).map(a=>a.name);
      if (!missing.every(n=>before.some(x=>x.kind==='nhi'&&x.a.name===n))) out.bad.push(nm+': a retake before all missing work');
      if (rt.noIxl) out.bad.push(nm+': a retake without an IXL link');
      if (rt.short.length && !before.some(x=>(x.kind==='ixl'&&/\bixl\b/i.test(x.a.name))||x.kind==='ixlreq')) out.bad.push(nm+': a retake before the unit IXL');
      // without the retakes, the catch-up alone falls short (otherwise the retake was not needed)
      const over={...q.over}; q.plan.filter(x=>x.kind==='retake').forEach(x=>delete over[x.a.name]); if (T.computeGrade(s,i,over).rounded>=q.target) out.bad.push(nm+': a retake the catch-up made unnecessary'); });
    const save=JSON.stringify(s.grades.assignments.map(a=>a.values));
    s.grades.assignments.forEach(a=>{ if (/Squares and Cubes Quiz/.test(a.name)) a.values=a.values.map((v,j)=>a.status&&a.status[j]==='score'?Math.min(Number(v)||0,5):v); });
    run(); const vals=JSON.parse(save); s.grades.assignments.forEach((a,k)=>a.values=vals[k]);
    out.noIxlRetake=s.grades.students.some((nm,i)=>{ const f=T.findStudent(sec,nm); if (f.ixl!=null) return false; const q=T.quickestPath(sec,s,i,null); if (q&&q.retakeBlocked) out.blocked++; return q&&q.plan&&q.plan.some(x=>x.kind==='retake'); });
    return out; },K);
  check(rk.withRetake>=3 && rk.bad.length===0,'every plan that needs a retake ('+rk.withRetake+' students) first turns in all missing work and finishes the unit\'s IXL, and lists no retake the catch-up makes unnecessary'+(rk.bad.length?': '+rk.bad.slice(0,3).join('; '):''));
  check(!rk.noIxlRetake,'a student with no IXL link in Tally is never planned a retake');
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
