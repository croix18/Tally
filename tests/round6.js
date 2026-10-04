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
  const l0=await p.evaluate(()=>[...document.querySelectorAll('.hatt li:not(.more)')].map(l=>l.textContent.replace(/\s+/g,' ').trim()));
  check(!l0.some(t=>/assigned by guess/.test(t)) && l0.filter(t=>/pick the unit you're working in/.test(t)).length===1,'no "assigned by guess" line; only the course that still needs a pick is asked: '+l0.length+' lines');
  // 0b. backup: asked for once after an import, one tap, then quiet
  check(await p.locator('#hBackup').count()===1 && /nothing has been backed up/.test(await p.textContent('#hBackup')) && /back up/.test(await p.textContent('#hNotes > summary')),'the Overview offers a backup after an import (in the notes line)');
  await p.click('#hNotes > summary'); await p.waitForTimeout(200);
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
  check(await p.locator(`button.nmbtn[data-prof="${who}"]`).count()===1,'a student with no IXL account still links to their page');
  // 1b. "copied <date>" stays in the calm header beside the Focus badge, and Copy sits on one line across units
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const u=T.unitsOf(s).find(u=>u.assigned); s.receipts[u.name]={ at:new Date().toISOString(), exportDate:s.date, goal:s.threshold, outOf:u.total, skipped:[], rows:[] }; T.save(); T.render(); },K);
  const hd=await p.evaluate(()=>({ rl:[...document.querySelectorAll('th.unit .rlink')].filter(e=>e.offsetParent).length, badge:[...document.querySelectorAll('th.unit .fcheck')].filter(e=>e.offsetParent).length, copyY:[...new Set([...document.querySelectorAll('th.unit .copy')].filter(e=>e.offsetParent).map(e=>Math.round(e.getBoundingClientRect().bottom)))].length, titleY:[...new Set([...document.querySelectorAll('th.unit .t')].map(e=>Math.round(e.getBoundingClientRect().top)))].length }));
  check(hd.rl>=1 && hd.badge>=1 && hd.copyY<=1 && hd.titleY===1,'the header shows "copied" next to the Focus badge; titles share a top line and Copy buttons a bottom line: '+JSON.stringify(hd));
  // 1c. Working in: a choice made on the class bar — even "— pick —" — is not overwritten by the next import
  await p.selectOption('#curUnit',''); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures',acc)]); await p.waitForTimeout(900);
  check((await p.evaluate(()=>window.__tally.state.settings.currentUnit.acc))===null,'choosing "— pick —" survives the next import (the default only fills a course nobody has touched)');
  await p.reload(); await p.waitForTimeout(600); check((await p.evaluate(()=>window.__tally.defaultWorkingIn().length))===0 && (await p.evaluate(()=>window.__tally.state.settings.curUnitTouched.acc))===true,'and survives a reload');
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(300); await p.selectOption('#curUnit','1'); await p.waitForTimeout(300);
  // 2. the tab dot and the Overview say the same thing
  const agree=await p.evaluate(()=>{ const T=window.__tally; return T.state.order.map(k=>{ const s=T.state.sections[k]; return T.sectionWarn(s)===T.attentionItems(s).some(a=>a.level==='warn') && document.querySelector(`.tab[data-k="${k}"]`).classList.contains('warn')===T.sectionWarn(s); }); });
  check(agree.every(Boolean),'a tab wears a dot exactly when the Overview lists a warning for that class');
  // 2b. the printed next-assessment line is true for every student of both synthetic classes (many F students who can reach a D)
  const truthP=await p.evaluate(()=>{ const T=window.__tally; const bad=[]; let dReach=0, wont=0, n=0;
    T.state.order.forEach(k=>{ const s=T.state.sections[k]; const rows=T.gbRows(s); s.grades.students.forEach((name,i)=>{ n++; const html=T.studentReportSection(s,i,rows[i]); const m=html.match(/Next assessment \(out of (\d+)\)<\/td><td colspan="2">([^<]*)</); if (!m) return; const mx=Number(m[1]), line=m[2].toLowerCase(); const na=T.nextAssessment(T.openSec(s),i,mx);
      na.can.forEach(x=>{ if (!line.includes(`${x.n}/${mx} for ${x.w}`.toLowerCase())) bad.push(name+': missing '+x.w); if (x.w==='a D') dReach++; });
      const w=line.match(/won't reach (an? [a-d])/); if (w) { wont++; if (na.can.length) bad.push(name+': says won\'t reach, but can'); if (w[1]!==na.cant[na.cant.length-1].toLowerCase()) bad.push(name+': wrong letter'); }
      if (/won't change the letter/.test(line)) bad.push(name+': "won\'t change the letter"'); if (na.keep && !/keeps the [a-d]/.test(line)) bad.push(name+': keep clause dropped'); }); });
    return { bad, dReach, wont, n }; });
  check(truthP.bad.length===0 && truthP.dReach>0,'the report\'s next-assessment line is true for all '+truthP.n+' synthetic students: '+truthP.dReach+' F students are told the score that makes a D; '+truthP.wont+' are told one assessment won\'t reach the next letter'+(truthP.bad.length?' — '+truthP.bad.slice(0,3).join(' | '):''));
  // 3. one line per cause: a cause shared by the course or the file is said once
  await p.evaluate(()=>{ const T=window.__tally; const d=new Date(Date.now()-30*86400000).toISOString().slice(0,10); ['acc','on'].forEach(k=>{ T.state.pools[k].date=d; }); T.state.order.forEach(k=>{ T.state.sections[k].date=d; }); T.state.settings.remindDays=7; T.save(); T.render(); });
  await p.click('#btnHome'); await p.waitForTimeout(400);
  const lines=await p.evaluate(()=>[...document.querySelectorAll('.hatt li:not(.more)')].map(l=>l.textContent.replace(/\s+/g,' ').trim()));
  check(lines.filter(l=>/^Every class — IXL export is \d+ days old/.test(l)).length===1,'two classes with the same stale export get one line: '+lines.length+' rows');
  if (await p.locator('#hNotes[open]').count()) { await p.click('#hNotes > summary'); await p.waitForTimeout(200); }
  const fold=await p.evaluate(()=>{ const d=document.querySelector('#hNotes'); const cards=[...document.querySelectorAll('.hcard')].map(c=>c.getBoundingClientRect()); const bottom=document.querySelector('#gridwrap').getBoundingClientRect().bottom; return { notes:!!d, open:d&&d.open, top:Math.round(cards[0].top), whole:cards.filter(c=>c.bottom<=Math.min(bottom,innerHeight)).length, n:cards.length }; });
  check((!fold.notes || !fold.open) && fold.whole===fold.n && fold.top<520,'things to know share one folded line, so every class card is whole on the first screen (cards start at '+fold.top+' px)');
  const order=await p.evaluate(()=>{ const n=document.querySelector('.hneeds'), c=document.querySelector('.hcards'); return n && c ? n.getBoundingClientRect().top < c.getBoundingClientRect().top : null; });
  check(order===true,'Needs attention sits above the class cards');
  check((await p.evaluate(()=>{ const ls=[...document.querySelectorAll('.hneeds>.hatt>li')].map(l=>l.classList.contains('warn')); return ls.every((w,i)=>i===0 || !w || ls[i-1]); })),'warnings come before notes');
  // 3b. storage: a pool class no longer saves its own copy of the course's skills; Settings shows how full the browser is
  const st0=await p.evaluate(()=>{ const T=window.__tally; const raw=JSON.parse(localStorage.getItem('tally.v1')); const s=raw.sections['period-1']; return { flag:s.poolSkills===true, skills:s.skills, live:T.state.sections['period-1'].skills===T.state.pools.acc.skills, n:T.state.sections['period-1'].skills.length, chars:localStorage.getItem('tally.v1').length }; });
  check(st0.flag && Array.isArray(st0.skills) && st0.skills.length===0 && st0.live && st0.n>100,'the saved class points at the pool for its skills ('+st0.n+' skills, not stored twice) and still saves a list — an older Tally.html drops a class whose skills aren\'t one');
  // a save from before the change (its own identical copy) loads, behaves the same, and is slimmed on the next save
  const fat=await p.evaluate(()=>{ const raw=JSON.parse(localStorage.getItem('tally.v1')); for (const k in raw.sections) { const x=raw.sections[k]; if (x.poolSkills) { x.skills=JSON.parse(JSON.stringify(raw.pools[x.prep].skills)); delete x.poolSkills; } } const str=JSON.stringify(raw); localStorage.setItem('tally.v1', str); return str.length; });
  await p.reload(); await p.waitForTimeout(700);
  const st1=await p.evaluate(()=>{ const T=window.__tally; const u=T.unitsOf(T.state.sections['period-1']); T.save(); return { live:T.state.sections['period-1'].skills===T.state.pools.acc.skills, units:u.length, chars:localStorage.getItem('tally.v1').length, rows:T.buildRows(T.state.sections['period-1']).length }; });
  check(st1.live && st1.units>10 && st1.rows>20 && st1.chars<fat*0.9,'an older save with its own copies loads the same and shrinks on the next save ('+Math.round(fat/1000)+'K → '+Math.round(st1.chars/1000)+'K)');
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('#btnSettings'); await p.waitForTimeout(300);
  check(/Storage: \d+\.\d of about 5\.0 MB/.test(await p.textContent('#storeLine')) && await p.locator('#storeLine.full').count()===0,'Settings says how much of the browser\'s storage is used: '+(await p.textContent('#storeLine')).trim().slice(0,60));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(()=>{ localStorage.setItem('other-tool','x'.repeat(4300000)); window.__tally.render(); }); await p.click('#btnHome'); await p.waitForTimeout(300);
  check(await p.locator('#hStore').count()===1 && /storage is \d+% full/.test(await p.textContent('#hStore')) && /other saved pages hold most of it/.test(await p.textContent('#hStore')),'when the browser\'s storage is nearly full the Overview says so, counting other saved pages');
  await p.evaluate(()=>{ localStorage.removeItem('other-tool'); window.__tally.render(); });
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
  check(!/isn't reachable on one assessment/.test(rtxt) && !/won't change the letter/.test(rtxt),'the next-assessment line no longer says "isn\'t reachable" three times, nor that the letter can\'t change');
  const truth=await q.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const rows=T.gbRows(s); const bad=[]; let dReach=0, keeps=0;
    s.grades.students.forEach((name,i)=>{ const html=T.studentReportSection(s,i,rows[i]); const m=html.match(/Next assessment \(out of (\d+)\)<\/td><td colspan="2">([^<]*)</); if (!m) return; const mx=Number(m[1]), line=m[2]; const na=T.nextAssessment(T.openSec(s),i,mx);
      na.can.forEach(x=>{ if (!line.toLowerCase().includes(`${x.n}/${mx} for ${x.w}`.toLowerCase())) bad.push(name+': missing "'+x.w+'"'); if (x.w==='a D') dReach++; });
      const wont=line.match(/won't reach (an? [A-D])/); if (wont && na.can.length) bad.push(name+': says won\'t reach but can'); if (wont && wont[1]!==na.cant[na.cant.length-1]) bad.push(name+': names the wrong letter');
      if (na.keep) { keeps++; if (!/keeps the [A-D]/.test(line)) bad.push(name+': keep clause dropped'); } });
    return { bad, dReach, keeps, n:s.grades.students.length }; },RK);
  check(truth.bad.length===0 && truth.keeps>0,'every student\'s next-assessment line matches what is computed: reachable letters (a D included) are named, "won\'t reach" only when none is, and what keeps the current letter stays ('+truth.n+' students, '+truth.keeps+' keep clauses, '+truth.dReach+' can reach a D)'+(truth.bad.length?': '+truth.bad.slice(0,3).join(' | '):''));
  check(/Not started \(\d+\):/.test(rtxt) && /and \d+ more, in order, under Unit \d+ in IXL/.test(rtxt) && /Below goal \(\d+\):/.test(rtxt),'IXL still owed names every below-goal skill and the next few not started, and counts the rest');
  await rep.close();
  await q.click('#back'); await q.waitForTimeout(300); await q.click(`[data-k="${RK}"]`); await q.waitForTimeout(300); await q.click('#moreBtn'); await q.waitForTimeout(200); await q.click('#mReports'); await q.waitForTimeout(300);
  const [all]=await Promise.all([ctx2.waitForEvent('page'), q.click('[data-rep="all"]')]); await all.waitForLoadState(); await all.waitForTimeout(600);
  const secs=await all.evaluate(()=>document.querySelectorAll('.rep').length); const pp=pages(await all.pdf({format:'Letter'}));
  check(secs>=20 && pp===secs,'the whole class prints one page per student ('+secs+' students, '+pp+' pages)'); await all.close();
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
