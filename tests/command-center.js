// Overview (home), calm-by-default with a Details toggle, and the Data Lab graph types.
const { chromium, fs, path, exe, check, done, tmp } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve('Tally.html'));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await p.click('[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(800); if ((await p.textContent('#modal')).trim()) { await p.click('#mCancel').catch(()=>{}); await p.waitForTimeout(300); } }
  // --- Overview
  await p.reload(); await p.waitForTimeout(600);
  check(await p.locator('.home').count()===1 && await p.locator('.hcard').count()===2,'reload opens on the Overview with a card per class');
  check((await p.getAttribute('#btnHome','aria-pressed'))==='true' && await p.locator('.tab.active').count()===0,'Overview button pressed, no class tab active');
  const ht=await p.textContent('.home');
  check(/IXL work at goal/.test(ht) && /Focus average/.test(ht) && /Missing work/.test(ht) && /Sliding/.test(ht) && /Needs attention/.test(ht),'cards carry the headline numbers and there is a needs-attention list');
  check(await p.locator('.hatt li').count()>=2 && /roster not in IXL/.test(ht),'needs-attention lists the roster mismatch');
  check(await p.locator('.gsec .chart').count()>=2 && /Letter grades by class/.test(ht),'IXL bars and letters stacked bars drawn');
  check(/appear after a second gradebook import/.test(ht),'trend charts explain they need a second import');
  await p.click('.hatt li button'); await p.waitForTimeout(400);
  check(await p.locator('table.grid').count()===1 && await p.locator('.tab.active').count()===1,'tapping an attention item opens that class');
  // --- calm grid
  check(await p.locator('#nToggle').count()===1 && await p.locator('.nfold.hidden').count()===1 && /to look at/.test(await p.textContent('#nToggle')),'notices fold into one status line');
  await p.click('#nToggle'); await p.waitForTimeout(200); check(await p.locator('.nfold:not(.hidden) .notice').count()>=1,'tapping the status line expands the notices');
  check(await p.locator('#printOwed').isHidden() && await p.locator('#moreBtn').count()===1,'secondary controls live behind the ⋯ menu');
  await p.click('#moreBtn'); await p.waitForTimeout(200); check(await p.locator('#moreMenu:not(.hidden) #mStillOwed').count()===1,'menu opens with Still owed');
  await p.click('#btnDetails'); await p.waitForTimeout(400);
  check(await p.locator('#printOwed').isVisible() && await p.locator('#nToggle').count()===0 && await p.locator('.notice').count()>=1,'Details view restores the full notices and controls');
  await p.click('#btnDetails'); await p.waitForTimeout(300); check(await p.locator('#nToggle').count()===1,'and Calm folds them again');
  await p.click('#btnHome'); await p.waitForTimeout(300); check(await p.locator('.home').count()===1,'Overview button returns home');
  // --- Data Lab graph types
  await p.click('#btnLb'); await p.waitForTimeout(500); await p.click('[data-tab="lab"]'); await p.waitForTimeout(400);
  const kinds={dots:'.chart .dot',hist:'.chart .bar',stem:'table.stem',bar:'.chart .bar',circle:'.chart.circle path',box:'.labSvg'};
  for (const k of Object.keys(kinds)) { await p.selectOption('#labKind',k); await p.waitForTimeout(350); const n=await p.locator(kinds[k]).count(); check(n>0,`${k}: draws (${n} marks)`); }
  await p.selectOption('#labKind','hist'); await p.waitForTimeout(200); await p.selectOption('#labBin','5'); await p.waitForTimeout(300); check((await p.locator('.chart .bar').count())<=10,'histogram bin size applies');
  check(await p.locator('#labDots').count()===0 && await p.locator('#labTukey').count()===0,'box-only controls hidden for other graph types');
  await p.selectOption('#labKind','line'); await p.waitForTimeout(300); check(/Needs at least two imports|pick/.test(await p.textContent('#lb')),'line graph explains it needs history');
  await p.selectOption('#labUnit','unit:__all__'); await p.waitForTimeout(300); check(/Needs at least two imports/.test(await p.textContent('#lb')),'…including for All units with one import');
  // give it history and check a single combined chart with one line per class
  await p.evaluate(()=>{ const T=window.__tally; T.state.order.forEach(k=>{ const s=T.state.sections[k]; if(s.prep!=='acc') return; const cur=s.history[s.history.length-1]; const per={}; Object.keys(cur.per).forEach(x=>per[x]=Math.max(0,cur.per[x]-2)); s.history=[{...cur,date:'2026-09-19',per}, cur]; }); T.save(); });
  await p.click('[data-prep="acc"]').catch(()=>{}); await p.waitForTimeout(200); await p.selectOption('#labUnit','unit:__all__'); await p.selectOption('#labKind','line'); await p.waitForTimeout(400);
  check(await p.locator('.labRow.one .chart .ln').count()>=1 && await p.locator('.labRow').count()===1,'line graph: one chart, one line per class');
  check(!/[A-Z]{3,}, [A-Z]/.test(await p.textContent('#lb')),'no student names on the Data Lab');
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700);
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
