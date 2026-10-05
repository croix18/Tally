// Class averages in the Data Lab (Croix, 5 Oct 2026: "Can I get a class average option in the data lab" — he chose all three):
//   1. an Average toggle: each class's average beside its name, and a mark at it on the plots that can carry one
//   2. a graph type, "Class averages": one bar per class
//   3. a data set, "Course grade": each class's Focus course grade, kept as aggregate as every other Focus set
// Every number is recounted here from the raw state, not read back from the code under test.
const { chromium, fs, path, exe, check, done, pick, more, APP } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1536,height:864},acceptDownloads:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await pick(p,'[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(700); const a=await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(300); } }
  // a second accelerated class, so there is something to compare: a copy of 1st Period with different scores
  await p.evaluate(()=>{ const T=window.__tally; const s=JSON.parse(JSON.stringify(T.state.sections['period-1'])); s.key='period-3'; s.period=3; s.label='3rd Period · Accelerated'; if (s.team) s.team='3rd Period';
    s.grades.assignments.forEach(a=>{ if (a.max) a.values=a.values.map((v,i)=>v==null?null:Math.max(0,Math.min(a.max, v + (i%3===0?2:i%3===1?-1:0)))); });
    s.scores=s.scores.map((row,k)=>Array.isArray(row)?row.map((v,i)=>v==null?null:(i%4===0?Math.min(100,v+15):v)):row);
    T.state.sections['period-3']=s; T.state.order.push('period-3'); T.save(); });
  await p.reload(); await p.waitForTimeout(700);
  const classes=await p.evaluate(()=>window.__tally.state.order.map(k=>window.__tally.state.sections[k].label).join(' | ')); console.log('classes: '+classes);
  await p.click('#btnLb'); await p.waitForTimeout(600); await p.click('[data-tab="lab"]'); await p.waitForTimeout(500); await p.click('.lbFocus [data-prep="acc"]'); await p.waitForTimeout(300);
  const opts=await p.$$eval('#labUnit option',os=>os.map(o=>o.value)); const unitId=opts.find(v=>/^unit:(?!__)/.test(v)), gbId=opts.find(v=>/^gb:.*Assess/.test(v))||opts.find(v=>v.startsWith('gb:'));
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  // ---- 1. the Average toggle -----------------------------------------------------------------------------------
  await p.selectOption('#labUnit',unitId); await p.waitForTimeout(300); await p.selectOption('#labKind','box'); await p.waitForTimeout(300);
  check(await p.locator('#labAvg').count()===1 && await p.getAttribute('#labAvg','aria-pressed')==='false' && await p.locator('#lb .labAvg').count()===0,'the Data Lab has an Average button, off until he asks');
  await p.click('#labAvg'); await p.waitForTimeout(300);
  const shown=await p.evaluate(()=>[...document.querySelectorAll('#lb .labRow')].map(r=>({ name:r.querySelector('.labName').firstChild.textContent.trim(), avg:(r.querySelector('.labAvg b')||{textContent:''}).textContent, word:(r.querySelector('.labAvg span')||{textContent:''}).textContent, n:Number((r.querySelector('.labName small b').textContent.match(/\d+/)||[])[0]) })));
  // recount: a unit's points per student, from the unit view's own points column
  const recount=await p.evaluate(id=>{ const T=window.__tally; const out={}; T.state.order.forEach(k=>{ const s=T.state.sections[k]; if (s.prep!=='acc') return; const u=T.unitsOf(s).find(u=>u.name===id.slice(5)); const pop=T.population(s); const vals=pop.map(x=>T.points(s,u,x.i)); out[s.label.replace(/ · .*/,'')]={ sum:vals.reduce((a,b)=>a+b,0), n:vals.length }; }); return out; }, unitId).catch(e=>({err:String(e)}));
  check(!recount.err,'the test can reach the raw points'+(recount.err?': '+recount.err:''));
  check(shown.length===2 && shown.every(r=>r.word==='average' && /^\d+\.\d$/.test(r.avg)),'with Average on, each class shows its average beside its name, to one decimal: '+shown.map(r=>r.name+' '+r.avg).join(', '));
  if (!recount.err) check(shown.every(r=>recount[r.name] && r.n===recount[r.name].n && r.avg===(recount[r.name].sum/recount[r.name].n).toFixed(1)),'…and it is the sum of the unit\'s points over the students counted: '+shown.map(r=>r.name+' '+recount[r.name].sum+'/'+recount[r.name].n).join(', '));
  check(/average \(mean\)/.test(await p.textContent('#lb .labLegend')) && await p.locator('#lb .labRow .labMean').count()===2,'the box plot marks it with the diamond and the key names it');
  // the mark sits at the average on every plot that has a number line
  const at=async(kind)=>p.evaluate(kind=>[...document.querySelectorAll('#lb .labRow')].map(r=>{ const svg=r.querySelector('.labPlot svg'); const g=svg&&svg.querySelector('g.mean'); if (!g) return null; const line=g.querySelector('line'); const x=line.getBoundingClientRect().left+line.getBoundingClientRect().width/2;
      const ticks=[...svg.querySelectorAll('text.tl')].map(t=>({v:Number(t.textContent), x:t.getBoundingClientRect().left+t.getBoundingClientRect().width/2, y:t.getBoundingClientRect().top})); const base=Math.max(...ticks.map(t=>t.y)); const ax=ticks.filter(t=>Math.abs(t.y-base)<3 && Number.isFinite(t.v)).sort((a,b)=>a.v-b.v); const a0=ax[0], a1=ax[ax.length-1];
      const dia=g.querySelector('rect').getBoundingClientRect(); const marks=[...svg.querySelectorAll('.dot, text.val')].map(e=>e.getBoundingClientRect()); const hit=marks.some(m=>m.left<dia.right-1 && dia.left<m.right-1 && m.top<dia.bottom-1 && dia.top<m.bottom-1);
      return { value:a0.v+(x-a0.x)/(a1.x-a0.x)*(a1.v-a0.v), title:g.querySelector('title').textContent, avg:Number(r.querySelector('.labAvg b').textContent), hit }; }),kind);
  for (const kind of ['dots','hist','bar']) { await p.selectOption('#labKind',kind); await p.waitForTimeout(350); const m=await at(kind);
    check(m.length===2 && m.every(x=>x && Math.abs(x.value-x.avg)<=0.08 && /^Average \d/.test(x.title) && !x.hit),kind+': a dashed line and diamond stand at the average on the axis, clear of the data ('+m.map(x=>x?x.value.toFixed(2)+' vs '+x.avg:'none').join(', ')+')');
    check((await p.textContent('#lb .labLegend')).trim()==='average (mean)','…with a one-item key for the diamond'); }
  for (const kind of ['stem','circle']) { await p.selectOption('#labKind',kind); await p.waitForTimeout(350);
    check(await p.locator('#lb .labAvg').count()===2 && await p.locator('#lb g.mean').count()===0 && await p.locator('#lb .labLegend').count()===0,kind+': the number is beside the name; there is no axis to mark, so no mark and no key'); }
  // percent mode
  await p.selectOption('#labKind','dots'); await p.click('#labPct [data-pct="1"]'); await p.waitForTimeout(350);
  const pc=await p.evaluate(()=>[...document.querySelectorAll('#lb .labAvg b')].map(b=>b.textContent)); check(pc.length===2 && pc.every(t=>/^\d+\.\d%$/.test(t)),'in % the average is a percent: '+pc.join(', '));
  await p.click('#labPct [data-pct="0"]'); await p.waitForTimeout(300);
  await p.reload(); await p.waitForTimeout(700); check(await p.getAttribute('#labAvg','aria-pressed')==='true' && await p.locator('#lb .labAvg').count()===2,'the choice is remembered');
  await p.click('#labAvg'); await p.waitForTimeout(300); check(await p.locator('#lb .labAvg').count()===0 && await p.locator('#lb g.mean').count()===0,'off again: no number, no mark');
  // ---- 2. Class averages, one bar per class ---------------------------------------------------------------------
  await p.selectOption('#labKind','avg'); await p.waitForTimeout(400);
  const bars=await p.evaluate(()=>{ const svg=document.querySelector('#lb .labAvgBars svg'); if (!svg) return null; const rects=[...svg.querySelectorAll('rect.bar')]; const labels=[...svg.querySelectorAll('text.lbl')].map(t=>t.textContent); const vals=[...svg.querySelectorAll('text.val')].map(t=>t.textContent);
    const ticks=[...svg.querySelectorAll('text.tl')].map(t=>({v:Number(t.textContent), x:t.getBoundingClientRect().left+t.getBoundingClientRect().width/2})).sort((a,b)=>a.v-b.v); const a0=ticks[0], a1=ticks[ticks.length-1];
    return { labels, vals, fills:rects.map(r=>getComputedStyle(r).fill), ends:rects.map(r=>a0.v+(r.getBoundingClientRect().right-a0.x)/(a1.x-a0.x)*(a1.v-a0.v)), starts:rects.map(r=>Math.round(r.getBoundingClientRect().left-a0.x)), ticks:ticks.map(t=>t.v), rows:document.querySelectorAll('#lb .labRow').length, sub:document.querySelector('#lb .lbSub').textContent, title:document.querySelector('#lb .lbTitle').textContent, h:Math.round(rects[0].getBoundingClientRect().height) }; });
  check(bars && bars.rows===1 && bars.labels.join('|')==='1st Period|3rd Period','"Class averages" is one chart with one bar per class, in period order: '+(bars?bars.labels.join(', '):''));
  if (!recount.err) check(bars.vals.every((v,i)=>v===(recount[bars.labels[i]].sum/recount[bars.labels[i]].n).toFixed(1)),'each bar is labelled with that class\'s average: '+bars.vals.join(', '));
  check(bars.ends.every((e,i)=>Math.abs(e-Number(bars.vals[i]))<=0.12) && bars.starts.every(s=>Math.abs(s)<=2) && bars.ticks[0]===0,'the bars start at zero and end at their value on the axis ('+bars.ends.map(e=>e.toFixed(2)).join(', ')+')');
  check(new Set(bars.fills).size===2 && bars.h>=24,'each bar wears its class\'s colour and is thick enough for the room ('+bars.h+' px)');
  check(/^Accelerated classes, average points per class, as of /.test(bars.sub),'the facts line says what the bars are: "'+bars.sub+'"');
  check(await p.locator('#labAvg, #labStats, #labValues, #labDots, #labTukey').count()===0 && await p.locator('#labPct').count()===1,'the per-class buttons step aside on a one-chart view; Points / % stays');
  await p.click('#labPct [data-pct="1"]'); await p.waitForTimeout(300); const pb=await p.evaluate(()=>({ vals:[...document.querySelectorAll('#lb .labAvgBars text.val')].map(t=>t.textContent), ticks:[...document.querySelectorAll('#lb .labAvgBars text.tl')].map(t=>t.textContent).join(' ') }));
  check(pb.vals.every(v=>/^\d+\.\d%$/.test(v)) && /0% 25% 50% 75% 100%/.test(pb.ticks),'in % the bars run on a 0–100% axis: '+pb.vals.join(', ')); await p.click('#labPct [data-pct="0"]'); await p.waitForTimeout(300);
  // ---- 3. the course grade ---------------------------------------------------------------------------------------
  check(opts.includes('grade:course') && /^Course grade · Quarter \d$/.test(await p.$eval('#labUnit option[value="grade:course"]',o=>o.textContent)),'the data list offers the course grade, named with its quarter');
  await p.selectOption('#labUnit','grade:course'); await p.waitForTimeout(400);
  const kinds=await p.$$eval('#labKind option',os=>os.map(o=>o.value).join(',')); check(kinds==='box,hist,circle,line,avg','a Focus data set is offered only in aggregate forms: '+kinds);
  const cg=await p.evaluate(()=>({ vals:[...document.querySelectorAll('#lb .labAvgBars text.val')].map(t=>t.textContent), labels:[...document.querySelectorAll('#lb .labAvgBars text.lbl')].map(t=>t.textContent), title:document.querySelector('#lb .lbTitle').textContent, sub:document.querySelector('#lb .lbSub').textContent }));
  // recount from the grade engine, rounded per student as Focus shows it — the same number as the Overview card
  const want=await p.evaluate(()=>{ const T=window.__tally; const out={}; T.state.order.forEach(k=>{ const s=T.state.sections[k]; if (s.prep!=='acc') return; const g=T.gradeAll(s).map(r=>r&&r.rounded).filter(v=>v!=null); out[s.label.replace(/ · .*/,'')]={ avg:g.reduce((a,b)=>a+b,0)/g.length, n:g.length, letters:g.reduce((m,v)=>{ const l=v>=90?'A':v>=80?'B':v>=70?'C':v>=60?'D':'F'; m[l]=(m[l]||0)+1; return m; },{}) }; }); return out; });
  check(/^Course grade: Quarter \d$/.test(cg.title) && /average course grade per class, as of /.test(cg.sub),'heading: "'+cg.title+'" / "'+cg.sub+'"');
  check(cg.vals.length===2 && cg.vals.every((v,i)=>v===want[cg.labels[i]].avg.toFixed(1)+'%'),'each class\'s bar is the mean of its students\' Focus grades: '+cg.vals.join(', '));
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700);
  await more(p,'#btnDetails'); await p.waitForTimeout(300); const card=await p.evaluate(()=>[...document.querySelectorAll('.hcard')].map(c=>({ name:c.querySelector('.hhead b').textContent.replace(/ · .*/,''), focus:[...c.querySelectorAll('.hnums > div')].map(d=>d.textContent).find(t=>/Focus average/i.test(t)) })).filter(c=>c.focus)); await more(p,'#btnDetails'); await p.waitForTimeout(200);
  check(card.filter(c=>want[c.name]).every(c=>Number((c.focus.match(/(\d+)%/)||[])[1])===Math.round(want[c.name].avg)),'…the same number as "Focus average" on its Overview card: '+card.filter(c=>want[c.name]).map(c=>c.name+' '+(c.focus.match(/\d+%/)||[''])[0]).join(', '));
  // and a unit's average in the Lab is the "Class average" under that unit's column in the class grid
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(400);
  const foot=await p.evaluate(()=>{ const heads=[...document.querySelectorAll('table.grid thead th.unit')]; const cells=[...document.querySelectorAll('table.grid tfoot td, table.grid tfoot th')]; const first=heads[0]; const hx=first.getBoundingClientRect(); const c=cells.find(td=>{ const r=td.getBoundingClientRect(); return Math.abs((r.left+r.right)/2-(hx.left+hx.right)/2)<8; }); return { unit:first.textContent.trim().slice(0,8), avg:c?c.textContent.trim():null }; });
  check(foot.avg===shown.find(r=>r.name==='1st Period').avg,'the Lab\'s average for '+foot.unit.split(/\s+/).slice(0,2).join(' ')+' is the grid\'s own "Class average" for that column: '+foot.avg);
  await p.click('#btnHome'); await p.waitForTimeout(300);
  await p.click('#btnLb'); await p.waitForTimeout(600);
  // aggregate only: no dots, no values, no outliers, bins of 5 or more, and never fewer than five students
  await p.selectOption('#labKind','box'); await p.waitForTimeout(300);
  check(await p.locator('#labDots, #labValues, #labTukey, #labPct').count()===0 && await p.locator('#lb .labDot').count()===0 && await p.locator('#lb .labValues').count()===0,'box plot of the course grade: no dot per student, no list of values, no outlier marks, and no Points / % (it is a percent)');
  await p.click('#labAvg'); await p.waitForTimeout(300); const gAvg=await p.evaluate(()=>[...document.querySelectorAll('#lb .labRow')].map(r=>r.querySelector('.labName').firstChild.textContent.trim()+' '+r.querySelector('.labAvg b').textContent)); check(gAvg.every(t=>{ const [a,b2,v]=t.match(/^(.+) ([\d.]+%)$/)||[]; return want[b2] && v===want[b2].avg.toFixed(1)+'%'; }),'Average works on it too: '+gAvg.join(', ')); await p.click('#labAvg'); await p.waitForTimeout(200);
  await p.selectOption('#labKind','hist'); await p.waitForTimeout(300); check((await p.$$eval('#labBin option',os=>os.map(o=>o.value).join(',')))==='0,5,10','histogram bins are 5 or wider');
  await p.selectOption('#labKind','circle'); await p.waitForTimeout(300);
  const pies=await p.evaluate(()=>[...document.querySelectorAll('#lb .labRow')].map(r=>({ name:r.querySelector('.labName').firstChild.textContent.trim(), leg:[...r.querySelectorAll('svg.circle text.lbl')].map(t=>t.textContent.trim().replace(/\s+/g,' ')) })));
  check(pies.length===2 && pies.every(pz=>pz.leg.every(l=>{ const [k,n]=l.split(' '); return (want[pz.name].letters[k]||0)===Number(n); })),'circle graph: the letters are the class\'s letter grades: '+pies.map(pz=>pz.name+' '+pz.leg.join(' ')).join(' | '));
  await p.selectOption('#labKind','line'); await p.waitForTimeout(300); check(/Needs at least two gradebook imports|%/.test(await p.textContent('#lb .labRows')),'line graph: the class average at each gradebook import (or says it needs two)');
  // a class under five students is never drawn
  await p.evaluate(()=>{ const T=window.__tally; const s=T.state.sections['period-3']; const keep=4; s.grades.students=s.grades.students.slice(0,keep); s.grades.assignments.forEach(a=>{ a.values=a.values.slice(0,keep); if (a.status) a.status=a.status.slice(0,keep); }); T.save(); T.render(); });
  await p.selectOption('#labKind','avg'); await p.waitForTimeout(400);
  const small=await p.evaluate(()=>({ labels:[...document.querySelectorAll('#lb .labAvgBars text.lbl')].map(t=>t.textContent).join(','), note:(document.querySelector('#lb .labAvgBars .labNotYet')||{textContent:''}).textContent }));
  check(small.labels==='1st Period' && /3rd Period: not enough students yet \(needs 5\)/.test(small.note),'a class with four graded students gets no bar, and the chart says why: "'+small.note+'"');
  // a saved page carries it
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700); await more(p,'#btnSettings'); await p.waitForTimeout(300);
  const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#saveLab')]); const saved=fs.readFileSync(await dl.path(),'utf8');
  check(/class="labPlot labAvgBars"/.test(saved) && /Course grade: Quarter/.test(saved) && !/window\.__tally/.test(saved.replace(/<script[\s\S]*?<\/script>/g,'')),'the saved Data Lab page is the same chart');
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
