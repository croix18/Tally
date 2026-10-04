// Overview (home), calm-by-default with a Details toggle, and the Data Lab graph types.
const { chromium, fs, path, exe, check, done, tmp, APP, pick, more } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await pick(p,'[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(800); if ((await p.textContent('#modal')).trim()) { await p.click('#mCancel').catch(()=>{}); await p.waitForTimeout(300); } }
  // --- Overview
  await p.reload(); await p.waitForTimeout(600);
  check(await p.locator('#gridwrap .home').count()===1 && await p.locator('.hcard').count()===2,'reload opens on the Overview with a card per class');
  check((await p.getAttribute('#btnHome','aria-current'))==='page' && await p.locator('body.home').count()===1 && await p.locator('.tab.active').count()===0,'on the Overview: Classes is the current place, no class tab active');
  const ht=await p.textContent('.home');
  check(/IXL work at goal/.test(ht) && /Focus average/.test(ht) && /Missing work/.test(ht) && /Sliding/.test(ht) && /Needs attention/.test(ht),'cards carry the headline numbers and there is a needs-attention list');
  check(await p.locator('.hatt li').count()>=2 && /roster not in IXL/.test(ht),'needs-attention lists the roster mismatch');
  check(await p.locator('.gsec .chart').count()>=2 && /Letter grades by class/.test(ht),'IXL bars and letters stacked bars drawn');
  check(/appear after a second gradebook import/.test(ht),'trend charts explain they need a second import');
  await p.click('.hatt li button'); await p.waitForTimeout(400);
  check(await p.locator('table.grid').count()===1 && await p.locator('.tab.active').count()===1,'tapping an attention item opens that class');
  // --- calm grid
  check(await p.locator('#bar #nToggle.nchip').count()===1 && await p.locator('#notices .notice').count()===0 && /to fix/.test(await p.textContent('#nToggle')) && (await p.evaluate(()=>document.querySelector('#notices').getBoundingClientRect().height))<14,'notices are a count in the class bar, not a band above it');
  await p.click('#nToggle'); await p.waitForTimeout(200); check(await p.locator('#notices .nfold .notice').count()>=1 && (await p.getAttribute('#nToggle','aria-expanded'))==='true','tapping the count shows the notices');
  await p.click('#nToggle'); await p.waitForTimeout(200); check(await p.locator('#notices .notice').count()===0,'and tapping it again folds them');
  check(await p.locator('#printOwed').isHidden() && await p.locator('#moreBtn').count()===1,'secondary controls live behind the ⋯ menu');
  await p.click('#moreBtn'); await p.waitForTimeout(200); check(await p.locator('#moreMenu:not(.hidden) #mStillOwed').count()===1,'menu opens with Still owed');
  await p.mouse.click(600, 700); await p.waitForTimeout(200); check(await p.locator('#moreMenu.hidden').count()===1 && await p.locator('body.details').count()===0 && await p.locator('#menuOverlay').count()===0,'a tap outside only dismisses the menu (nothing underneath fires)');
  await p.click('#moreBtn'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(100); check(await p.locator('#moreMenu.hidden').count()===1 && await p.evaluate(()=>document.activeElement&&document.activeElement.id)==='moreBtn','Escape closes the menu and returns focus to ⋯');
  await more(p,'#btnDetails'); await p.waitForTimeout(400);
  check(await p.locator('#printOwed').isVisible() && await p.locator('#nToggle').count()===0 && await p.locator('.notice').count()>=1,'Details view restores the full notices and controls');
  await more(p,'#btnDetails'); await p.waitForTimeout(300); check(await p.locator('#nToggle').count()===1,'and Calm folds them again');
  await p.click('#btnHome'); await p.waitForTimeout(300); check(await p.locator('#gridwrap .home').count()===1,'Overview button returns home');
  // --- What changed digest (fabricate last week for the first class)
  await p.evaluate(()=>{ const T=window.__tally; const s=T.state.sections[T.state.order[0]]; const cur=s.history[s.history.length-1]; const per={}; const pu=JSON.parse(JSON.stringify(cur.pu)); Object.keys(cur.per).forEach((k,i)=>{ let d=Math.min(cur.per[k], i%3===0?3:i%3===1?1:0); per[k]=cur.per[k]-d; for(const u in pu){ const take=Math.min(d,pu[u][k]||0); pu[u][k]-=take; d-=take; } }); s.history=[{...cur,date:'2026-09-19',per,pu},cur];
    const gc=s.gradeHistory[s.gradeHistory.length-1]; s.gradeHistory=[{...gc,date:'2026-09-19',grade:gc.grade.map((g,i)=>g==null?g:Math.min(100,g+(i%4===0?6:i%4===1?-4:0))),missing:gc.missing.map((m,i)=>i%5===0?Math.max(0,m-1):m),assignments:gc.assignments.slice(0,3)},gc]; T.save(); T.render(); });
  await p.click('#btnHome'); await p.waitForTimeout(400); await p.click('[data-digest]'); await p.waitForTimeout(400);
  const dg=(await p.textContent('#modal')).replace(/\s+/g,' ');
  check(/What changed/.test(dg) && /Sep 19 → Sep 26/.test(dg),'digest opens for the class with the date span');
  check(/skills at goal since Sep 19/.test(dg) && /of the class moved up/.test(dg) && /Biggest movers/.test(dg),'IXL section: total, share moved up, biggest movers');
  check(/class average/.test(dg) && /missing assignments/.test(dg) && /Sliding:/.test(dg) && /Newly missing work/.test(dg) && /New assignments/.test(dg),'Focus section: average, missing, sliding, newly missing, new assignments');
  check(await p.evaluate(()=>document.getElementById('modal').classList.contains('private')),'digest backdrop is private (names on screen)');
  await p.click('#mCancel'); await p.waitForTimeout(200);
  await p.click('.hcard'); await p.waitForTimeout(400); await p.click('#moreBtn'); await p.waitForTimeout(200); check(await p.locator('#mDigest').count()===1,'digest also in the class ⋯ menu');
  await p.click('#mDigest'); await p.waitForTimeout(300); check(/What changed/.test(await p.textContent('#modal')),'…and opens from there'); await p.click('#mCancel'); await p.waitForTimeout(200);
  await p.click('#btnHome'); await p.waitForTimeout(300);
  // --- Data Lab graph types
  await p.click('#btnLb'); await p.waitForTimeout(500); await p.click('[data-tab="lab"]'); await p.waitForTimeout(400);
  const kinds={dots:'.chart .dot',hist:'.chart .bar',stem:'table.stem',bar:'.chart .bar',circle:'.chart.circle path',box:'.labSvg'};
  for (const k of Object.keys(kinds)) { await p.selectOption('#labKind',k); await p.waitForTimeout(350); const n=await p.locator(kinds[k]).count(); check(n>0,`${k}: draws (${n} marks)`); }
  await p.selectOption('#labKind','hist'); await p.waitForTimeout(200); await p.selectOption('#labBin','5'); await p.waitForTimeout(300); check((await p.locator('.chart .bar').count())<=10,'histogram bin size applies');
  check(await p.locator('#labDots').count()===0 && await p.locator('#labTukey').count()===0,'box-only controls hidden for other graph types');
  await p.selectOption('#labKind','line'); await p.waitForTimeout(300); check(/Needs at least two imports|Pick /.test(await p.textContent('#lb')),'line graph explains it needs history');
  await p.selectOption('#labUnit','unit:__all__'); await p.waitForTimeout(300); check(await p.locator('.labRow.one .chart .ln').count()>=1,'…and draws once a class has two imports (the digest step gave 1st period a second one)');
  // --- Points / % toggle: values, stats and axis become percent of the maximum
  await p.selectOption('#labUnit', await p.evaluate(()=>document.querySelector('#labUnit option').value)); await p.selectOption('#labKind','box'); await p.waitForTimeout(300);
  const before=await p.evaluate(()=>{ const T=window.__tally; const s=T.labSeries(T.state.settings.labPrep, T.state.settings.labUnit)[0]; return {max:s.max, med:s.st.median, pct:s.pct}; });
  await p.click('[data-pct="1"]'); await p.waitForTimeout(400);
  const after=await p.evaluate(()=>{ const T=window.__tally; const s=T.labSeries(T.state.settings.labPrep, T.state.settings.labUnit)[0]; return {max:s.max, med:s.st.median, pct:s.pct, unit:s.unit, ints:s.values.every(v=>v==null||Number.isInteger(v))}; });
  check(!before.pct && after.pct && after.max===100 && after.ints && Math.abs(after.med - Math.round(before.med/before.max*100))<=1 && /^% of/.test(after.unit),'% mode rescales to whole percents of the maximum: '+JSON.stringify([before,after]));
  await p.click('#labStats'); await p.waitForTimeout(300); check(/median\s*\d+%/.test((await p.textContent('.labStats')).replace(/\s+/g,' ')),'stats read as percents');
  await p.click('#labValues'); await p.waitForTimeout(300); check(/\d+%/.test(await p.textContent('.labValues, .labHalf').catch(()=>'')) || /%/.test(await p.textContent('#lb')),'values chips carry %');
  check(/rounded to whole percents/.test(await p.textContent('.lbSub')),'subtitle says so');
  await p.click('[data-pct="0"]'); await p.waitForTimeout(300); await p.click('#labValues'); await p.click('#labStats'); await p.click('#labStats'); await p.waitForTimeout(200);
  // give it history and check a single combined chart with one line per class
  await p.evaluate(()=>{ const T=window.__tally; T.state.order.forEach(k=>{ const s=T.state.sections[k]; if(s.prep!=='acc') return; const cur=s.history[s.history.length-1]; const per={}; Object.keys(cur.per).forEach(x=>per[x]=Math.max(0,cur.per[x]-2)); s.history=[{...cur,date:'2026-09-19',per}, cur]; }); T.save(); });
  await p.click('[data-prep="acc"]').catch(()=>{}); await p.waitForTimeout(200); await p.selectOption('#labUnit','unit:__all__'); await p.selectOption('#labKind','line'); await p.waitForTimeout(400);
  check(await p.locator('.labRow.one .chart .ln').count()>=1 && await p.locator('.labRow').count()===1,'line graph: one chart, one line per class');
  check(!/[A-Z]{3,}, [A-Z]/.test(await p.textContent('#lb')),'no student names on the Data Lab');
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700);
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
