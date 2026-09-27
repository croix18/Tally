// Round-5 regressions: projected Data Lab keeps Focus scores aggregate; prototype-pollution and XSS through backups;
// course change with a unit open; save failures not masked; Overview search; pool replacement guard; view scroll reset;
// Working-in choices; percent axis; CSV formula guard; older-dated import; contrast token.
const { chromium, fs, path, exe, check, done, tmp } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); let dialogs=[]; p.on('dialog',d=>{ dialogs.push(d.message()); d.accept(); });
  await p.goto('file://'+path.resolve('Tally.html'));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await p.click('[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(800); if (await p.locator('#askSave').count()) { await p.click('#askSave'); await p.waitForTimeout(300); } }
  const K='period-1';
  // 1. projected Data Lab: Values on an IXL set, then a gb set → no per-student chips, bins ≥ 5, no outliers, no excused
  await p.click('#btnLb'); await p.waitForTimeout(400); await p.click('[data-tab="lab"]'); await p.waitForTimeout(300);
  await p.click('#labValues'); await p.waitForTimeout(300); check(await p.locator('.labValues').count()>=1,'Values shows per-student chips on an IXL data set');
  const gbOpt=await p.evaluate(()=>{ const o=[...document.querySelectorAll('#labUnit option')].find(o=>o.value.startsWith('gb:')); return o && o.value; });
  check(!!gbOpt,'a Focus assignment is in the data set list');
  await p.selectOption('#labUnit', gbOpt); await p.waitForTimeout(400);
  check(await p.locator('.labValues').count()===0 && await p.locator('#labValues').count()===0,'switching to a Focus set drops the Values chips even though Values was on');
  await p.selectOption('#labKind','hist'); await p.waitForTimeout(300);
  const bins=await p.evaluate(()=>[...document.querySelectorAll('#labBin option')].map(o=>+o.value)); check(!bins.includes(1) && !bins.includes(2),'bins of 1 or 2 are not offered for Focus scores: '+bins.join(','));
  await p.click('#labTukey').catch(()=>{}); await p.waitForTimeout(200); check(await p.locator('.labOut').count()===0 && !/excused/.test(await p.textContent('#lb')),'no outlier marks or excused counts on a Focus set');
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700); await p.click('#btnHide'); await p.waitForTimeout(200);
  // 2. prototype pollution and XSS through a Tally backup
  const evil={tally:4,sections:{'__proto__':{label:'x',polluted:1},'period-1':{label:'ok'}},assigned:{acc:{'__proto__':{z:1}}},grading:{acc:{cats:[{name:'A',w:100}],map:{'__proto__':{q:1}},how:{}}},custom:[{id:'c1',label:'evil',unit:'',prep:'acc',values:{'period-1':['</textarea><img src=x onerror=window.__x5=1>',5]}}]};
  const ep=path.join(tmp,'evil-backup.json'); fs.writeFileSync(ep, JSON.stringify(evil));
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('#btnSettings'); await p.waitForTimeout(200); await p.setInputFiles('#cfgFile', ep); await p.waitForTimeout(800);
  const pol=await p.evaluate(()=>({ proto:!!({}).polluted, order:window.__tally.state.order.includes('__proto__'), x:!!window.__x5, vals:JSON.stringify((window.__tally.state.custom.find(c=>c.id==='c1')||{}).values) }));
  check(!pol.proto && !pol.order && !pol.x,'a backup with __proto__ keys pollutes nothing and lists no ghost class');
  await p.click('#btnSettings'); await p.waitForTimeout(200); await p.click('[data-editc="c1"], #editCustom, [data-edit="c1"]').catch(()=>{}); await p.waitForTimeout(300);
  check(!(await p.evaluate(()=>!!window.__x5)) && /\[5\]/.test(pol.vals),'custom values are numbers only; the editor can\'t be scripted: '+pol.vals);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.reload(); await p.waitForTimeout(700); check(await p.locator('#tabs .tab').count()===2 && errs.length===0,'app boots clean afterwards');
  // 3. course change while a unit view is open
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('th.unit .ulink'); await p.waitForTimeout(300);
  await p.click('#btnSettings'); await p.waitForTimeout(200); await p.click('#prepSeg [data-prep="on"], [data-prep="on"]'); await p.click('#mSave'); await p.waitForTimeout(500);
  check(errs.length===0 && await p.locator('#bar h2').count()===1,'changing the course with a unit open falls back to the grid, no throw');
  await p.click('#btnSettings'); await p.waitForTimeout(200); await p.click('[data-prep="acc"]'); await p.click('#mSave'); await p.waitForTimeout(500);
  check((await p.evaluate(()=>window.__tally.state.settings.skipFirst.on))===1,'switching a class\'s course does not drag the review-unit count across courses');
  // 4. a failed save is not hidden by the success toast
  await p.evaluate(()=>{ const o=localStorage.setItem.bind(localStorage); window.__origSet=o; localStorage.setItem=()=>{ const e=new Error('QuotaExceededError'); e.name='QuotaExceededError'; throw e; }; });
  await p.click('#btnSettings'); await p.waitForTimeout(200); await p.click('#mSave'); await p.waitForTimeout(400);
  check(/storage is full|Could not save/.test(await p.textContent('#toast')) && await p.locator('#toast.err').count()===1,'the quota error stays on screen instead of "Saved"');
  await p.evaluate(()=>{ localStorage.setItem=window.__origSet; });
  // 5. Overview search opens the class grid properly
  await p.click('#btnHome'); await p.waitForTimeout(300); await p.fill('#search','a'); await p.waitForTimeout(300);
  check(await p.locator('body.home').count()===0 && await p.locator('table.grid').count()===1 && await p.locator('#bar h2').count()===1,'typing in search on the Overview opens the active class grid with its bar');
  await p.fill('#search',''); await p.waitForTimeout(200);
  // 6. pool replacement guard: a file with barely-overlapping students asks first
  const rows=fs.readFileSync(path.resolve('fixtures',acc),'utf8').split('\n'); const hdrI=rows.findIndex(r=>/skill name/i.test(r));
  const junk=rows.map((r,i)=>{ if(i===hdrI){ const cells=r.split(','); return cells.map((c,j)=>j>2&&/[A-Za-z]/.test(c)?'"ZZ'+j+' QQ"':c).join(','); } return r; }).join('\n');
  const jp=path.join(tmp,'course_acc_IXL-Score-Grid_2026-09-27_This-School-Year_Math-Nation-FL-B.E.S.T.-Accelerated-7th-Grade_Math.csv'); fs.writeFileSync(jp, junk);
  dialogs=[]; await p.setInputFiles('#file',[jp]); await p.waitForTimeout(800);
  check(dialogs.some(d=>/Only \d+ of its/.test(d)),'a course file whose students don\'t match the pool asks before replacing it: '+(dialogs[0]||'').slice(0,80));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc)]); await p.waitForTimeout(800);
  // 7. view changes start at the top
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.evaluate(()=>{ document.querySelector('#gridwrap').scrollTop=400; });
  await p.click('#openGrades'); await p.waitForTimeout(400); check(await p.evaluate(()=>document.querySelector('#gridwrap').scrollTop)===0,'opening Grades starts at the top of the page');
  await p.click('#back'); await p.waitForTimeout(300);
  // 8. Working in never lists the review unit; single-unit wording
  await p.click('[data-k="period-2"]'); await p.waitForTimeout(300);
  const opts=await p.evaluate(()=>[...document.querySelectorAll('#curUnit option')].map(o=>o.value).filter(Boolean).map(Number));
  check(!opts.includes(1) && opts.includes(2),'on-level Working in skips the review Unit 1: '+opts.slice(0,3).join(','));
  await p.selectOption('#curUnit','2'); await p.waitForTimeout(300); check(/Unit 2 counts/.test(await p.textContent('#toast')),'a single counting unit reads "Unit 2 counts", not "Units 2–2"');
  // 9. percent axis tops at 100
  await p.click('#btnLb'); await p.waitForTimeout(400); await p.click('[data-tab="lab"]'); await p.waitForTimeout(300); await p.selectOption('#labKind','box'); await p.selectOption('#labUnit','unit:__all__'); await p.waitForTimeout(200);
  if (await p.locator('#labPct').count()) { await p.click('#labPct'); await p.waitForTimeout(300); }
  const ticks=await p.evaluate(()=>[...document.querySelectorAll('.labTickTxt')].map(e=>parseInt(e.textContent)).filter(n=>!isNaN(n)));
  check(ticks.length && Math.max(...ticks)<=100,'percent mode axis ends at 100: max tick '+Math.max(...ticks));
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700); await p.click('#btnHide'); await p.waitForTimeout(200);
  // 10. CSV cells that look like formulas are quoted
  await p.evaluate(K=>{ const s=window.__tally.state.sections[K]; s.roster='=HYPERLINK("x"), EVIL\n'+s.roster; window.__tally.save(); window.__tally.render(); }, 'period-1');
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('th.unit .ulink'); await p.waitForTimeout(300);
  const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#csvUnit')]); const csv=fs.readFileSync(await dl.path(),'utf8');
  check(/"'=HYPERLINK/.test(csv),'a roster name starting with = is neutralised in the CSV');
  await p.keyboard.press('Escape');
  // 11. token contrast
  const bad=await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bad').trim()); check(bad.toLowerCase()==='#b8321f','warning ink darkened for the coral wash');
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
