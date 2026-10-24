// The what-if page, audited (Croix, 19 Oct 2026: a prediction came out 1 % high: a student "landed at 59 % despite
// them supposed to be at 60 according to Tally"). Every number on the page is recomputed here from the raw gradebook
// with the test's own copy of the formula: never read back from the code under test: and compared to what the page
// shows. Also: the retake-eligibility rule (no NHI, the current unit's IXL all at goal) on every screen that states it.
const { chromium, fs, path, exe, check, done, APP, pick, more } = require('./lib');
// Focus's grade: each category's points earned ÷ points possible, weighted; NHI = 0 over full possible; excused/blank
// left out; empty categories drop out of the weighting; rounded half up. The test's copy is G(), below.
const round = p => Math.round(p + 1e-9);
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1536,height:864}}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const K='1205050-7T1A';
  // the raw gradebook and the category map, straight from state (the map is what the page uses; the formula is ours)
  const raw=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const g=T.gradingFor(s.prep); return { gb:JSON.parse(JSON.stringify(s.grades)), cats:g.cats, map:g.map, focus:s.grades.overall }; },K);
  const W={}; raw.cats.forEach(c=>W[c.name]=c.w); const catOf=n=>raw.map[n];
  const G=(i,over,extra)=>{ const cats={}; raw.gb.assignments.forEach(a=>{ if(!(a.max>0)) return; let st=a.status?a.status[i]:(a.values[i]==null?'blank':'score'); let v=a.values[i]; if(over&&Object.prototype.hasOwnProperty.call(over,a.name)){ v=over[a.name]; st=v==null?'excused':'score'; } if(st!=='score'&&st!=='missing') return; const c=cats[catOf(a.name)]=cats[catOf(a.name)]||{e:0,p:0}; c.e+=st==='missing'?0:Number(v)||0; c.p+=a.max; });
    if(extra){ const c=cats[extra.cat]=cats[extra.cat]||{e:0,p:0}; c.e+=extra.pts; c.p+=extra.max; }
    let tw=0,tot=0; for(const k in cats){ if(cats[k].p>0){ tw+=W[k]; tot+=W[k]*cats[k].e/cats[k].p*100; } } return tw?tot/tw:null; };
  const letter=v=>v>=90?'A':v>=80?'B':v>=70?'C':v>=60?'D':'F';
  // ---- 1. the engine against Focus, student by student ------------------------------------------------------------------
  const n=raw.gb.students.length; const exact=raw.gb.students.map((_,i)=>G(i));
  check(n===23 && exact.every((v,i)=>round(v)===raw.focus[i]),'the test\'s own formula, rounded half up, gives Focus\'s Grade column for all '+n+' students');
  const half=exact.map((v,i)=>({v,i})).filter(x=>Math.abs(x.v-Math.floor(x.v)-0.5)<1e-9);
  check(half.length>=1 && half.every(x=>raw.focus[x.i]===Math.floor(x.v)+1),'a grade exactly on a half (here '+half.map(x=>x.v).join(', ')+') is rounded UP by Focus: so Tally rounds half up too');
  const engine=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; return s.grades.students.map((_,i)=>T.computeGrade(s,i).rounded); },K);
  check(engine.every((v,i)=>v===raw.focus[i]),'…and so does Tally\'s engine, for every student');
  // ---- 2. every what-if cell, for every student with something to move ---------------------------------------------------
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(300); await p.click('#openGrades'); await p.waitForTimeout(500);
  let cells=0, bad=[]; const seenHalfPoint=[];
  for (let i=0;i<n;i++) {
    await p.evaluate(({K,i})=>{ const T=window.__tally; T.openProfile(K, T.state.sections[K].grades.students[i]); },{K,i}); await p.waitForTimeout(250);
    const pg=await p.evaluate(()=>{ const root=document.querySelector('#pWhat'); if(!root) return null; const num=t=>Number((t.match(/→\s*(\d+)/)||[])[1]);
      const sec=h=>{ const hs=[...root.querySelectorAll('h4.subh')]; const x=hs.find(e=>e.textContent.startsWith(h)); return x?x.nextElementSibling:null; };
      const miss=sec('If missing work'); const missRows=miss&&miss.tagName==='TABLE'?[...miss.querySelectorAll('tbody tr')].map(tr=>({ name:tr.querySelector('b').textContent, total:tr.classList.contains('total'), to:num(tr.children[2].textContent), delta:tr.children[2].textContent.match(/([+−]\d+|no change)/)[1] })):[];
      const re=sec('If an assessment were retaken'); const reRows=re?[...re.querySelectorAll('tbody tr')].map(tr=>({ name:tr.querySelector('b').textContent, cells:[...tr.children].slice(2).map(td=>{ const m=td.textContent.match(/([\d.]+)\/([\d.]+)\s*→\s*(\d+)/); return m?{pts:Number(m[1]),max:Number(m[2]),to:Number(m[3])}:null; }) })):[];
      const ix=sec('If IXL were finished'); const ixRows=ix?[...ix.querySelectorAll('tbody tr')].map(tr=>({ name:tr.querySelector('b').textContent, to:num(tr.children[2].textContent) })):[];
      const nowG=Number(document.querySelector('.wnow .gchip').textContent.match(/\d+/)[0]); const nx=Number(root.querySelector('.wiMax').value); const pts=Number(root.querySelector('.wiPts').value); const out=num(root.querySelector('.wiOut').textContent); const need=root.querySelector('.wiNeed').textContent;
      return { nowG, missRows, reRows, ixRows, nx, pts, out, need }; });
    if (!pg) continue;
    const base=G(i); if (pg.nowG!==round(base)) bad.push(i+': now '+pg.nowG+' vs '+round(base));
    const allIn={}; raw.gb.assignments.forEach(a=>{ if(a.status&&a.status[i]==='missing') allIn[a.name]=a.max; });
    pg.missRows.forEach(r=>{ cells++; const want=r.total?round(G(i,allIn)):round(G(i,{[r.name]:raw.gb.assignments.find(a=>a.name===r.name).max})); if (r.to!==want) bad.push(i+': missing '+r.name+' shows '+r.to+' wants '+want); const d=want-round(base); const dl=d>0?'+'+d:d<0?'−'+(-d):'no change'; if (r.delta!==dl) bad.push(i+': delta '+r.delta+' vs '+dl); });
    pg.reRows.forEach(r=>r.cells.forEach(c=>{ if(!c) return; cells++; const a=raw.gb.assignments.find(x=>x.name===r.name); const want=round(G(i,{[r.name]:c.pts})); if (c.to!==want) bad.push(i+': retake '+r.name+' at '+c.pts+' shows '+c.to+' wants '+want); [70,80,90,100].forEach(pc=>{ const ex=a.max*pc/100; if (Math.abs(c.pts-Math.round(ex*2)/2)<1e-9 && Math.abs(ex-c.pts)>1e-9 && round(G(i,{[r.name]:ex}))!==want) seenHalfPoint.push(r.name+' '+pc+'%: '+c.pts+'/'+a.max); }); }));
    pg.ixRows.forEach(r=>{ cells++; const want=round(G(i,{[r.name]:raw.gb.assignments.find(a=>a.name===r.name).max})); if (r.to!==want) bad.push(i+': IXL '+r.name+' shows '+r.to+' wants '+want); });
    cells++; const wantNext=round(G(i,null,{cat:'Assessments',max:pg.nx,pts:pg.pts})); if (pg.out!==wantNext) bad.push(i+': next '+pg.pts+'/'+pg.nx+' shows '+pg.out+' wants '+wantNext);
    // "Next assessment: 13.5/21 for a D": the least half point that reaches the letter, and half a point less does not
    [...pg.need.matchAll(/([\d.]+)\/(\d+) for (an? ([A-D]))/g)].forEach(m=>{ cells++; const pts=Number(m[1]), mx=Number(m[2]), L=m[4]; const tgt={D:60,C:70,B:80,A:90}[L]; const at=round(G(i,null,{cat:'Assessments',max:mx,pts})); const below=pts>0?round(G(i,null,{cat:'Assessments',max:mx,pts:pts-0.5})):-1; if (!(at>=tgt && below<tgt)) bad.push(i+': need '+pts+'/'+mx+' for '+L+': at '+at+', half less '+below); });
  }
  check(cells>150 && bad.length===0,'every number on the what-if page is the formula\'s answer ('+cells+' cells over '+n+' students)'+(bad.length?': wrong: '+bad.slice(0,6).join(' | '):''));
  check(seenHalfPoint.length>=1,'the retake table\'s grade is computed from the half-point score it shows, where that differs from the exact percent (this was the 1 % slip): '+seenHalfPoint.slice(0,3).join(', '));
  // ---- 3. Show student: the live grade follows the switches and sliders ---------------------------------------------------
  const who=exact.findIndex((v,i)=>raw.gb.assignments.some(a=>a.status[i]==='missing') && raw.gb.assignments.some(a=>catOf(a.name)==='Assessments' && !/ixl/i.test(a.name) && a.status[i]==='score' && a.values[i]<a.max));
  await p.evaluate(({K,i})=>{ const T=window.__tally; T.openProfile(K, T.state.sections[K].grades.students[i]); },{K,i:who}); await p.waitForTimeout(300); await p.click('#pShow'); await p.waitForTimeout(500);
  const sh=await p.evaluate(()=>{ const miss=document.querySelector('#show .shRow[data-k="miss"]'); const re=document.querySelector('#show .shRow[data-k="re"]'); miss.querySelector('.shOn').click(); const sl=re.querySelector('.shPts'); sl.value=Math.min(Number(sl.max), Number(sl.value)+2); sl.dispatchEvent(new Event('input',{bubbles:true})); return { miss:miss.dataset.n, missPts:Number(miss.querySelector('.shPts').value), re:re.dataset.n, rePts:Number(sl.value), v:Number(document.querySelector('#shIfV').textContent.replace('%','')), L:document.querySelector('#shIfL').textContent }; });
  const wantSh=round(G(who,{[sh.miss]:sh.missPts,[sh.re]:sh.rePts}));
  check(sh.v===wantSh && sh.L===letter(wantSh),'Show student: turning in '+sh.miss+' and sliding '+sh.re+' to '+sh.rePts+' gives '+sh.v+'% '+sh.L+': the formula agrees');
  await p.reload(); await p.waitForTimeout(600);
  // ---- 4. retake eligibility: no NHI, and the current unit's IXL all at goal ---------------------------------------------
  // set the course to Unit 1 and shape three students: eligible; missing work only; IXL short only
  const shaped=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.state.settings.currentUnit={...(T.state.settings.currentUnit||{}),[s.prep]:1}; T.state.settings.curUnitTouched={...(T.state.settings.curUnitTouched||{}),[s.prep]:true}; const gb=s.grades; const names=gb.students; const t=s.threshold;
    const u1=T.unitsOf(s).find(u=>u.num===1); const pick=[]; names.forEach((nm,i)=>{ const f=T.findStudent(s,nm); if (f.ixl==null || f.gi<0) return; pick.push({nm,i,ixl:f.ixl}); });
    const setAll=(ixl,ok)=>{ u1.active.forEach(k=>{ s.scores[k][ixl]=ok?Math.max(t,s.scores[k][ixl]||0):Math.min(t-1,s.scores[k][ixl]==null?t-5:s.scores[k][ixl]); }); if (s.best) u1.active.forEach(k=>{ const b=s.best[T.skillKey(s.skills[k])]; if (b) delete b[T.ixlKeyAt(s,ixl)]; }); };
    const clearMissing=i=>gb.assignments.forEach(a=>{ if (a.status&&a.status[i]==='missing'){ a.status[i]='score'; a.values[i]=a.max; } });
    const addMissing=i=>{ const a=gb.assignments.find(a=>/Worksheet/.test(a.name)); a.status[i]='missing'; a.values[i]=null; return a.name; };
    const A=pick[0], B=pick[1], C=pick[2]; setAll(A.ixl,true); clearMissing(A.i); setAll(B.ixl,true); clearMissing(B.i); const mB=addMissing(B.i); setAll(C.ixl,false); clearMissing(C.i);
    // every other unit with a Focus IXL column counts too (round 8): finish those for all three, so Unit 1 alone decides
    T.unitsOf(s).filter(u=>u.num!==1).forEach(u=>u.active.forEach(k=>{ [A,B,C].forEach(x=>{ s.scores[k][x.ixl]=Math.max(t,s.scores[k][x.ixl]||0); if (s.best) { const b=s.best[T.skillKey(s.skills[k])]; if (b) delete b[T.ixlKeyAt(s,x.ixl)]; } }); }));
    // C: exactly two skills short
    const shortC=u1.active.slice(0,2); u1.active.forEach(k=>{ s.scores[k][C.ixl]=shortC.includes(k)?t-10:t; });
    gb.assignments.forEach(a=>{ a.missing=a.status.filter(x=>x==='missing').length; }); s._keys=null; T.save(); return { A:A.nm, B:B.nm, C:C.nm, mB, unit:u1.short, nUnit:u1.active.length }; },K);
  await p.reload(); await p.waitForTimeout(700);
  const rt=await p.evaluate(({K,shaped})=>{ const T=window.__tally; const s=T.state.sections[K]; return ['A','B','C'].map(k=>{ const r=T.retakeStatus(s,shaped[k]); return { ok:r.ok, missing:r.missing, short:r.short.map(x=>x.name), unit:r.unit&&r.unit.short }; }); },{K,shaped});
  check(rt[0].ok && !rt[0].missing.length && !rt[0].short.length && rt[0].unit===shaped.unit,'eligible: nothing missing and every '+shaped.unit+' skill at goal');
  check(!rt[1].ok && rt[1].missing.join()===shaped.mB && !rt[1].short.length,'not eligible with one NHI ('+shaped.mB+') even though IXL is done');
  check(!rt[2].ok && !rt[2].missing.length && rt[2].short.length===2,'not eligible with two '+shaped.unit+' skills under goal even though nothing is missing');
  // on the Students list: a column and a sort
  await p.click('#btnStudents'); await p.waitForTimeout(500);
  const dir=await p.evaluate(({shaped})=>{ const row=nm=>[...document.querySelectorAll('.sdir tr[data-name]')].find(tr=>tr.dataset.name===nm); const cell=nm=>{ const tr=row(nm); const tds=[...tr.children]; return tds[tds.length-2].textContent.trim(); }; return { A:cell(shaped.A), B:cell(shaped.B), C:cell(shaped.C), head:[...document.querySelectorAll('.sdir thead th')].map(t=>t.textContent).join('|'), sort:!!document.querySelector('[data-sort="retake"]') }; },{shaped});
  check(/Retake/.test(dir.head) && dir.sort,'the Students list has a Retake column and a Retake sort');
  check(/retake/.test(dir.A) && /1 missing/.test(dir.B) && !/IXL/.test(dir.B) && new RegExp('2 IXL skills in '+shaped.unit).test(dir.C) && !/missing/.test(dir.C),'each row says why or that they may: "'+dir.A+'" / "'+dir.B+'" / "'+dir.C+'"');
  await p.click('[data-sort="retake"]'); await p.waitForTimeout(300);
  const order=await p.evaluate(()=>[...document.querySelectorAll('.sdir tr[data-name]')].map(tr=>{ const tds=[...tr.children]; return /retake/.test(tds[tds.length-2].textContent); }));
  check(order.length>5 && order.every((ok,i)=>i===0 || ok<=order[i-1]) && order[0]===true,'sorted by Retake, the eligible students come first ('+order.filter(Boolean).length+' of '+order.length+')');
  // on the student page: a tile, the retake table's note, Show student's line, the printed report
  for (const [k,want] of [['A',/Eligible/],['B',/Not yet/],['C',/Not yet/]]) { await p.evaluate(({K,nm})=>{ const T=window.__tally; T.openProfile(K,nm); },{K,nm:shaped[k]}); await p.waitForTimeout(300);
    const t=await p.evaluate(()=>({ tile:document.querySelector('#pRetake').textContent.replace(/\s+/g,' '), head:(document.querySelector('#pWhat h4.subh .rtag')||{textContent:''}).textContent.replace(/\s+/g,' ') }));
    check(want.test(t.tile) && (k==='A' ? /eligible/.test(t.head) : /not yet:/.test(t.head)),'student '+k+': tile "'+t.tile+'" and the retake table says "'+t.head+'"'); }
  await p.evaluate(({K,nm})=>{ const T=window.__tally; T.openProfile(K,nm); },{K,nm:shaped.C}); await p.waitForTimeout(300); await p.click('#pShow'); await p.waitForTimeout(500);
  const line=await p.evaluate(()=>(document.querySelector('#show .rtLine')||{textContent:''}).textContent); check(new RegExp('^To retake: finish 2 IXL skills in '+shaped.unit+'\\.$').test(line.trim()),'Show student tells the student what to do first: "'+line.trim()+'"');
  await p.reload(); await p.waitForTimeout(600);
  const rep=await p.evaluate(({K,nm})=>{ const T=window.__tally; const s=T.state.sections[K]; const i=s.grades.students.indexOf(nm); return T.studentReportSection(s,i,null); },{K,nm:shaped.B});
  check(/Retakes:<\/b> not yet\. To retake: turn in 1 missing assignment\./.test(rep),'the printed report carries the same line');
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
