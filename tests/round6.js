// Round 6, Build 2: alerts that can be cleared ("No IXL account" is a state), one attention line per cause above the
// cards, the notice band as a count in the class bar, the backup line, Working in defaulted from Focus's IXL columns.
const { chromium, fs, path, exe, check, done, tmp, APP } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900},acceptDownloads:true}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await p.click('[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(800); if (await p.locator('#askSave').count()) { await p.click('#askSave'); await p.waitForTimeout(300); } }
  const K='period-1';
  // 0. Working in, when nobody picked it, comes from Focus's IXL columns (never a review unit) and the import says so
  const wi=await p.evaluate(()=>{ const T=window.__tally; return { cur:T.state.settings.currentUnit, skip:T.state.settings.skipFirst, li:JSON.stringify(T.state.lastImport) }; });
  check(wi.cur.acc===1 && wi.cur.on==null && wi.skip.on===1,'accelerated Working in is set to the unit Focus has an IXL column for; on-level (its only column is the review unit) is left for the teacher: '+JSON.stringify(wi.cur));
  check(/Working in set to Unit 1/.test(wi.li),'the import result says Working in was set');
  await p.click('#btnHome'); await p.waitForTimeout(300);
  const l0=await p.evaluate(()=>[...document.querySelectorAll('.hatt li')].map(l=>l.textContent.replace(/\s+/g,' ').trim()));
  check(!l0.some(t=>/assigned by guess/.test(t)) && l0.filter(t=>/pick the unit you're working in/.test(t)).length===1,'no "assigned by guess" line; only the course that still needs a pick is asked: '+l0.length+' lines');
  // 0b. backup: asked for once after an import, one tap, then quiet
  check(await p.locator('#hBackup').count()===1 && /nothing has been backed up/.test(await p.textContent('#hBackup')),'the Overview offers a backup after an import');
  const [bk]=await Promise.all([p.waitForEvent('download'), p.click('#hBackup')]); await p.waitForTimeout(400);
  const cfg=JSON.parse(fs.readFileSync(await bk.path(),'utf8'));
  check(cfg.tally===4 && Object.keys(cfg.sections).length===2 && await p.locator('#hBackup').count()===0 && /backed up today/.test(await p.textContent('#bar .meta')),'one tap saves the backup; the line goes and the bar says "backed up today"');
  await p.reload(); await p.waitForTimeout(600); check(await p.locator('#hBackup').count()===0 && /^\d{4}-/.test(await p.evaluate(()=>window.__tally.state.lastBackup)),'the backup date survives a reload');
  await p.click('#btnSettings'); await p.waitForTimeout(200); check(/Last saved today/.test(await p.textContent('#lastBk')),'Settings shows when the backup was last saved'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const [gd]=await Promise.all([ctx.waitForEvent('page'), p.click('#btnGuide')]); await gd.waitForLoadState(); check(/Save a backup/.test(await gd.evaluate(()=>document.body.innerText)),'the Guide\'s weekly list includes the backup'); await gd.close();
  // 1. "No IXL account" is an answer: the flag, the count, the tab dot and the Overview line all go
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(400);
  const before=await p.evaluate(K=>{ const T=window.__tally; return { warn:T.sectionWarn(T.state.sections[K]), chip:(document.querySelector('#nToggle')||{}).textContent||'', flags:document.querySelectorAll('button.flag:not(.quiet)').length }; },K);
  check(before.warn && before.flags===1 && /to fix/.test(before.chip),'a roster name missing from IXL is flagged, counted and dotted: '+before.chip);
  const who=await p.getAttribute('button.flag[data-fix]','data-fix');
  await p.click('button.flag[data-fix]'); await p.waitForTimeout(300); await p.click('#unmatch'); await p.waitForTimeout(400);
  const after=await p.evaluate(([K,who])=>{ const T=window.__tally; const s=T.state.sections[K]; const row=T.buildRows(s).find(r=>r.display===who); return { status:row.status, flags:document.querySelectorAll('button.flag:not(.quiet)').length, quiet:document.querySelectorAll('.flag.quiet').length, items:T.attentionItems(s).map(a=>a.text) }; },[K,who]);
  check(after.status==='noAccount' && after.flags===0 && after.quiet===1 && !after.items.some(t=>/roster not in IXL/.test(t)),'after "No IXL account" the row is a quiet state, not a flag: '+JSON.stringify(after.items));
  check(/no IXL account/.test(await p.textContent('#toast')),'the choice is acknowledged');
  const col=await p.evaluate(([K,who])=>{ const T=window.__tally; const s=T.state.sections[K]; const u=T.unitsOf(s).find(u=>u.assigned); return T.unitColumn(s,u,'names').find(l=>l.startsWith(who)); },[K,who]);
  check(col!=null && col.split('\t')[1]==='','their row is still copied, blank, so the Focus column stays aligned: '+JSON.stringify(col));
  await p.click('.flag.quiet'); await p.waitForTimeout(300);
  check(/Marked as no IXL account/.test(await p.textContent('#modal')) && await p.locator('#reflag').count()===1 && await p.locator('#unmatch').count()===0,'tapping the tag reopens the matcher with "Flag again"');
  await p.click('#reflag'); await p.waitForTimeout(300); check(await p.locator('button.flag:not(.quiet)').count()===1,'"Flag again" brings the flag back');
  await p.click('button.flag[data-fix]'); await p.waitForTimeout(300); await p.click('#unmatch'); await p.waitForTimeout(300);
  // 2. the tab dot and the Overview say the same thing
  const agree=await p.evaluate(()=>{ const T=window.__tally; return T.state.order.map(k=>{ const s=T.state.sections[k]; return T.sectionWarn(s)===T.attentionItems(s).some(a=>a.level==='warn') && document.querySelector(`.tab[data-k="${k}"]`).classList.contains('warn')===T.sectionWarn(s); }); });
  check(agree.every(Boolean),'a tab wears a dot exactly when the Overview lists a warning for that class');
  // 3. one line per cause: a cause shared by the course or the file is said once
  await p.evaluate(()=>{ const T=window.__tally; const d=new Date(Date.now()-30*86400000).toISOString().slice(0,10); ['acc','on'].forEach(k=>{ T.state.pools[k].date=d; }); T.state.order.forEach(k=>{ T.state.sections[k].date=d; }); T.state.settings.remindDays=7; T.save(); T.render(); });
  await p.click('#btnHome'); await p.waitForTimeout(400);
  const lines=await p.evaluate(()=>[...document.querySelectorAll('.hatt li')].map(l=>l.textContent.replace(/\s+/g,' ').trim()));
  check(lines.filter(l=>/IXL export is \d+ days old/.test(l)).length===1 && lines.some(l=>/^Every class — IXL export is/.test(l)),'two classes with the same stale export get one line: '+JSON.stringify(lines));
  const order=await p.evaluate(()=>{ const n=document.querySelector('.hneeds'), c=document.querySelector('.hcards'); return n && c ? n.getBoundingClientRect().top < c.getBoundingClientRect().top : null; });
  check(order===true,'Needs attention sits above the class cards');
  check((await p.evaluate(()=>{ const ls=[...document.querySelectorAll('.hatt li')].map(l=>l.classList.contains('warn')); return ls.every((w,i)=>i===0 || !w || ls[i-1]); })),'warnings come before notes');
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
