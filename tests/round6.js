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
  // 4. the student page and its printout (the scrubbed real class)
  const ctx2=await b.newContext({viewport:{width:1400,height:900}}); const q=await ctx2.newPage(); q.on('pageerror',e=>errs.push(e.message)); q.on('dialog',d=>d.accept());
  await q.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await q.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await q.waitForTimeout(500);
  await q.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await q.click('#rpSave'); await q.waitForTimeout(300);
  await q.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await q.waitForTimeout(500); await q.click('[data-sec]'); await q.waitForTimeout(600);
  const RK='1205050-7T1A';
  await q.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.state.settings.currentUnit={acc:2,on:2};
    // a second import a week earlier so the tiles have a trend to draw
    const g=s.gradeHistory[s.gradeHistory.length-1]; s.gradeHistory=[{...JSON.parse(JSON.stringify(g)),date:'2026-09-19',missing:g.missing.map(m=>Math.max(0,m-1))},g];
    const h=s.history[s.history.length-1]; const per={}; Object.keys(h.per).forEach(k=>per[k]=Math.max(0,h.per[k]-1)); s.history=[{...JSON.parse(JSON.stringify(h)),date:'2026-09-19',per,pu:null},h]; T.save(); },RK);
  const worst=await q.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gs=T.gradeAll(s); let w=0; gs.forEach((g,i)=>{ if (g && g.rounded!=null && g.rounded<gs[w].rounded) w=i; }); return s.grades.students[w]; },RK);
  await q.evaluate(([K,n])=>window.__tally.openProfile(K,n),[RK,worst]); await q.waitForTimeout(500);
  const pg=await q.evaluate(()=>{ const g=document.querySelector('#gridwrap'); const small=[...g.querySelectorAll('svg text')].map(t=>{ const svg=t.ownerSVGElement; const k=svg.getBoundingClientRect().width/(svg.viewBox.baseVal.width||svg.getBoundingClientRect().width); return parseFloat(getComputedStyle(t).fontSize)*k; }); return { sparks:g.querySelectorAll('.gcard .tspark').length, minText:small.length?Math.min(...small):99, tilesRow:new Set([...g.querySelectorAll('.gcards .gcard')].map(c=>Math.round(c.getBoundingClientRect().top))).size, wide:g.querySelector('.gcards').getBoundingClientRect().width/g.querySelector('.profile').getBoundingClientRect().width, folded:g.querySelectorAll('details.iumore:not([open])').length, twoLine:[...g.querySelectorAll('.checkTable.whatif tbody tr td:last-child')].filter(td=>!td.closest('table').querySelector('thead')).some(td=>td.getBoundingClientRect().height>60) }; });
  check(pg.sparks>=1 && pg.minText>=9,'student page: the small trends are sparklines in their tiles and no chart text is under 9 px on screen ('+pg.minText.toFixed(1)+')');
  check(pg.tilesRow===1 && pg.wide>0.97,'the headline tiles are one row across the full width');
  check(pg.folded>=1 && !pg.twoLine,'long "not started" lists are folded; a what-if result stays on its line');
  await q.setViewportSize({width:800,height:1280}); await q.waitForTimeout(300);
  const st=await q.evaluate(()=>{ const y=sel=>{ const e=document.querySelector(sel); return e?e.getBoundingClientRect().top:null; }; const pv=document.querySelector('#pPrev').getBoundingClientRect(), nx=document.querySelector('#pNext').getBoundingClientRect(); return { quick:y('#pQuick'), what:y('#pWhat'), trend:y('.pmain .gsec'), pair:Math.abs(pv.top-nx.top)<4, w:document.querySelector('#pWhat').getBoundingClientRect().width/document.querySelector('.profile').getBoundingClientRect().width }; });
  check(st.quick<st.trend && st.what<st.trend && st.pair && st.w>0.97,'in one column the plan and the what-ifs come before the charts; Prev and Next stay together');
  await q.setViewportSize({width:1400,height:900}); await q.waitForTimeout(200);
  const [rep]=await Promise.all([ctx2.waitForEvent('page'), q.click('#pPrint')]); await rep.waitForLoadState(); await rep.waitForTimeout(500);
  const pages=buf=>(buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
  const one=pages(await rep.pdf({format:'Letter'})); const rtxt=await rep.evaluate(()=>document.body.innerText);
  check(one===1 && await rep.evaluate(()=>document.fonts.check('900 16px "DM Sans"') && /DM Sans/.test(getComputedStyle(document.body).fontFamily)),'the report for the student furthest behind prints on one page, in DM Sans ('+one+' page)');
  check(!/isn't reachable on one assessment/.test(rtxt) && (/One assessment alone won't change the letter|\/\d+ for a/.test(rtxt)),'the next-assessment line is one plain sentence, not three "isn\'t reachable"');
  check(/Not started \(\d+\):/.test(rtxt) && /and \d+ more, in order, under Unit \d+ in IXL/.test(rtxt) && /Below goal \(\d+\):/.test(rtxt),'IXL still owed names every below-goal skill and the next few not started, and counts the rest');
  await rep.close();
  await q.click('#back'); await q.waitForTimeout(300); await q.click(`[data-k="${RK}"]`); await q.waitForTimeout(300); await q.click('#moreBtn'); await q.waitForTimeout(200); await q.click('#mReports'); await q.waitForTimeout(300);
  const [all]=await Promise.all([ctx2.waitForEvent('page'), q.click('[data-rep="all"]')]); await all.waitForLoadState(); await all.waitForTimeout(600);
  const secs=await all.evaluate(()=>document.querySelectorAll('.rep').length); const pp=pages(await all.pdf({format:'Letter'}));
  check(secs>=20 && pp===secs,'the whole class prints one page per student ('+secs+' students, '+pp+' pages)'); await all.close();
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
