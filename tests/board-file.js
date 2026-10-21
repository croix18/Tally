// Two files beside each other (Croix, 19 Oct 2026: the laptop's backup would not load on the Promethean; "maybe it can
// make a scrubbed save file that doesn't include individual grades so it's super safe for the Promethean board, but
// still give me the option of a full save for my laptop").
//   · a full save loads into an empty Tally and is the same Tally: every class, score, grade and setting
//   · a Board file holds no name, ID, roster or student's row of grades; a Tally that loads it shows the Board only,
//     and the Board shows the same Race and the same Data Lab numbers as the laptop
// Also the cause of the Promethean's refusal: the picker was limited to files typed .json.
const { chromium, fs, path, exe, check, done, tmp, APP, pick, more } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1536,height:864},acceptDownloads:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await pick(p,'[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(700); const a=await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(300); } }
  // a second import on another day, so the Race has movement, plus a custom data set
  await p.evaluate(()=>{ const T=window.__tally; T.state.order.forEach(k=>{ const s=T.state.sections[k]; const h=JSON.parse(JSON.stringify(s.history[s.history.length-1])); h.date='2026-09-12'; h.at='2026-09-12T10:00:00.000Z'; Object.keys(h.per).forEach((key,i)=>{ if (i%2) { h.per[key]=Math.max(0,h.per[key]-2); Object.keys(h.pu).forEach(u=>{ h.pu[u][key]=Math.max(0,(h.pu[u][key]||0)-1); }); } }); s.history.unshift(h); s.history.sort((a,b)=>a.date.localeCompare(b.date)); });
    T.state.custom.push({ id:'cX', label:'Minutes to school', unit:'minutes', prep:'on', values:{ 'period-2':[5,10,12,20,25,30,8] } }); T.save(); });
  await p.reload(); await p.waitForTimeout(700);
  // what the laptop shows on the Board, to compare against later
  const boardOf=async()=>{ await p.click('#btnLb').catch(()=>{}); await p.waitForTimeout(500); const race=await p.evaluate(()=>[...document.querySelectorAll('#lb .lbCard')].map(c=>c.querySelector('.lbName').textContent.replace(/\s+/g,' ').trim()+' '+c.querySelector('.lbPct').textContent.replace(/\s+/g,' ').trim()+' '+c.querySelector('.lbDone').textContent.trim()).join(' | '));
    await p.click('[data-tab="lab"]'); await p.waitForTimeout(400); const out={ race };
    for (const prep of ['acc','on']) { await p.click(`.lbFocus [data-prep="${prep}"]`).catch(()=>{}); await p.waitForTimeout(300); const opts=await p.$$eval('#labUnit option',os=>os.map(o=>o.value)); const sets=[opts.find(v=>/^unit:(?!__)/.test(v)),'unit:__all__','grade:course',opts.find(v=>v.startsWith('gb:')),opts.find(v=>v.startsWith('custom:'))].filter(Boolean);
      for (const u of sets) { await p.selectOption('#labUnit',u); await p.waitForTimeout(250); await p.selectOption('#labKind','box'); await p.waitForTimeout(250); if (!(await p.locator('#labStats').count())) continue; while ((await p.getAttribute('#labStats','aria-pressed'))!=='true') { await p.click('#labStats'); await p.waitForTimeout(200); }
        out[prep+' '+u]=await p.evaluate(()=>[...document.querySelectorAll('#lb .labRow')].map(r=>r.querySelector('.labName').textContent.replace(/\s+/g,' ').trim()+' :: '+[...r.querySelectorAll('.labStats div')].map(d=>d.textContent.replace(/\s+/g,' ').trim()).join(', ')).join(' | ')); } }
    await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700); return out; };
  const laptop=await boardOf();
  const nLaptop=await p.evaluate(()=>({ classes:window.__tally.state.order.length, names:window.__tally.state.order.map(k=>window.__tally.state.sections[k].students[0]) }));
  // ---- the two files ---------------------------------------------------------------------------------------------------
  await more(p,'#btnSettings'); await p.waitForTimeout(300);
  check(await p.locator('#cfgFile').getAttribute('accept')===null,'the file picker for Tally files no longer limits the Android picker to files typed .json');
  const [d1]=await Promise.all([p.waitForEvent('download'), p.click('#exportFull')]); const fullPath=path.join(tmp,'full.json'); await d1.saveAs(fullPath);
  const [d2]=await Promise.all([p.waitForEvent('download'), p.click('#exportBoard')]); const boardPath=path.join(tmp,'board.json'); await d2.saveAs(boardPath);
  await p.keyboard.press('Escape');
  const full=JSON.parse(fs.readFileSync(fullPath,'utf8')), board=JSON.parse(fs.readFileSync(boardPath,'utf8'));
  check(full.tally===4 && full.full && full.state && Object.keys(full.state.sections).length===nLaptop.classes && Object.values(full.state.sections).some(s=>s.grades),'the full save is a Tally file holding every class, scores and gradebooks');
  check(/tally-full-\d{4}-\d{2}-\d{2}-\d{4}\.json/.test(d1.suggestedFilename()) && /tally-board-\d{4}-\d{2}-\d{2}-\d{4}\.json/.test(d2.suggestedFilename()),'the files are named by kind and date: '+d1.suggestedFilename()+', '+d2.suggestedFilename());
  // ---- what the Board file does not contain ----------------------------------------------------------------------------
  const txt=fs.readFileSync(boardPath,'utf8'); const realNames=[]; Object.values(full.state.sections).forEach(s=>{ realNames.push(...s.students); if (s.grades) realNames.push(...s.grades.students); if (s.roster) realNames.push(...s.roster.split('\n').map(x=>x.trim()).filter(Boolean)); }); Object.values(full.state.pools||{}).forEach(pl=>realNames.push(...(pl.students||[])));
  const leaked=[...new Set(realNames)].filter(n=>n && n.length>3 && txt.includes(n)).concat([...new Set(realNames)].flatMap(n=>n.split(/[,\s]+/)).filter(w=>w.length>4 && txt.includes(w)));
  check(leaked.length===0,'no student name, first or last, from any class, roster or course pool is anywhere in the Board file'+(leaked.length?' — found '+leaked.slice(0,4).join(', '):''));
  const ids=(txt.match(/\b\d{9,10}\b/g)||[]).filter(x=>!/^20\d\d/.test(x)); check(ids.length===0,'no student ID number is in it'+(ids.length?': '+ids.slice(0,3).join(', '):''));
  const bs=board.state; const anySec=Object.values(bs.sections)[0];
  check(Object.keys(bs.pools).length===0 && Object.values(bs.sections).every(s=>s.roster==='' && !s.seating && !Object.keys(s.seatInfo).length && !Object.keys(s.qArchive).length && !s.best && !Object.keys(s.overrides).length && (!s.grades || (!s.grades.raw && !s.grades.ids && !s.grades.overall && s.grades.file===''))),'no course pool, roster, seating, kept quarter, receipt or raw Focus cell travels either');
  // no row of Focus grades: the assignments are shuffled independently, so no student index lines up across them
  const rowTest=(()=>{ const fs0=Object.values(full.state.sections).find(s=>s.grades && s.grades.assignments.length>3); const bs0=bs.sections[Object.keys(full.state.sections).find(k=>full.state.sections[k]===fs0)]; const A=fs0.grades.assignments, B=bs0.grades.assignments; const n=fs0.grades.students.length;
    // for each real student, is there an index j in the Board file whose values match theirs on EVERY assignment? (would be a row)
    let rows=0; for (let i=0;i<n;i++) { for (let j=0;j<n;j++) { if (A.every(a=>{ const bb=B.find(x=>x.name===a.name); return bb && bb.values[j]===a.values[i] && (bb.status||[])[j]===(a.status||[])[i]; })) { rows++; break; } } }
    // and each assignment's multiset of values is unchanged
    const same=A.every(a=>{ const bb=B.find(x=>x.name===a.name); return bb && JSON.stringify(a.values.slice().sort())===JSON.stringify(bb.values.slice().sort()); });
    return { n, rows, same }; })();
  check(rowTest.same && rowTest.rows<=Math.max(2,Math.round(rowTest.n*0.15)),'each assignment keeps its scores but no student\'s row of grades survives the shuffle ('+rowTest.rows+' of '+rowTest.n+' rows could be lined up by chance; the same multisets per assignment)');
  check(Object.values(bs.sections).every(s=>!s.grades || (Array.isArray(s.boardGrades) && s.boardGrades.length>0 && s.boardGrades.every(v=>Number.isInteger(v)))),'the course grades travel as one shuffled list per class');
  // ---- an empty Tally loads the Board file -----------------------------------------------------------------------------
  const ctx2=await b.newContext({viewport:{width:1920,height:1080}}); const q=await ctx2.newPage(); q.on('pageerror',e=>errs.push('board: '+e.message)); q.on('dialog',d=>d.accept()); await q.goto('file://'+path.resolve(APP)); await q.waitForTimeout(400);
  await q.setInputFiles('#file',[boardPath]); await q.waitForTimeout(900);
  const bm=await q.evaluate(()=>({ board:!!window.__tally.state.board, lb:!!window.__tally.state.settings.leaderboard, lbShown:!document.querySelector('#lb').classList.contains('hidden'), hide:window.__tally.state.settings.hideNames, nav:document.querySelector('#nav').classList.contains('hidden'), eye:document.querySelector('#btnHide').classList.contains('hidden'), more:document.querySelector('#topMore').classList.contains('hidden') }));
  check(bm.board && bm.lb && bm.lbShown,'dropped on an empty Tally, the Board file opens straight into the Board');
  check(bm.hide && bm.nav && bm.eye && bm.more,'names are hidden and cannot be shown; the Classes / Students places, the eye and the ⋯ menu are gone');
  await q.locator('#lbExit').dispatchEvent('pointerdown'); await q.waitForTimeout(1700);
  const card=await q.evaluate(()=>({ card:(document.querySelector('.boardCard')||{textContent:''}).textContent.replace(/\s+/g,' ').trim(), grid:document.querySelectorAll('table.grid').length, cards:document.querySelectorAll('.hcard').length, lbHidden:document.querySelector('#lb').classList.contains('hidden') }));
  check(card.lbHidden && /Board save/.test(card.card) && /no names/.test(card.card) && card.grid===0 && card.cards===0,'leaving the Board shows one card — the file, its date, "no names" and Open the Board — and no grid, no class cards: "'+card.card+'"');
  await q.click('#openBoard'); await q.waitForTimeout(500); check(await q.evaluate(()=>!document.querySelector('#lb').classList.contains('hidden')),'Open the Board opens it again');
  await q.reload(); await q.waitForTimeout(700); check(await q.evaluate(()=>!!window.__tally.state.board && !document.querySelector('#lb').classList.contains('hidden')),'and it survives a reload as a Board-only Tally');
  // the same numbers as the laptop
  const pHold=p; const pB=q; const boardOfB=async()=>{ const race=await pB.evaluate(()=>[...document.querySelectorAll('#lb .lbCard')].map(c=>c.querySelector('.lbName').textContent.replace(/\s+/g,' ').trim()+' '+c.querySelector('.lbPct').textContent.replace(/\s+/g,' ').trim()+' '+c.querySelector('.lbDone').textContent.trim()).join(' | ')); await pB.click('[data-tab="race"]').catch(()=>{}); await pB.waitForTimeout(300); const race2=await pB.evaluate(()=>[...document.querySelectorAll('#lb .lbCard')].map(c=>c.querySelector('.lbName').textContent.replace(/\s+/g,' ').trim()+' '+c.querySelector('.lbPct').textContent.replace(/\s+/g,' ').trim()+' '+c.querySelector('.lbDone').textContent.trim()).join(' | '));
    await pB.click('[data-tab="lab"]'); await pB.waitForTimeout(400); const out={ race:race2 };
    for (const prep of ['acc','on']) { await pB.click(`.lbFocus [data-prep="${prep}"]`).catch(()=>{}); await pB.waitForTimeout(300); const opts=await pB.$$eval('#labUnit option',os=>os.map(o=>o.value)); const sets=[opts.find(v=>/^unit:(?!__)/.test(v)),'unit:__all__','grade:course',opts.find(v=>v.startsWith('gb:')),opts.find(v=>v.startsWith('custom:'))].filter(Boolean);
      for (const u of sets) { await pB.selectOption('#labUnit',u); await pB.waitForTimeout(250); await pB.selectOption('#labKind','box'); await pB.waitForTimeout(250); if (!(await pB.locator('#labStats').count())) continue; while ((await pB.getAttribute('#labStats','aria-pressed'))!=='true') { await pB.click('#labStats'); await pB.waitForTimeout(200); }
        out[prep+' '+u]=await pB.evaluate(()=>[...document.querySelectorAll('#lb .labRow')].map(r=>r.querySelector('.labName').textContent.replace(/\s+/g,' ').trim()+' :: '+[...r.querySelectorAll('.labStats div')].map(d=>d.textContent.replace(/\s+/g,' ').trim()).join(', ')).join(' | ')); } } return out; };
  const panel=await boardOfB();
  check(panel.race===laptop.race && laptop.race.length>20,'the Race on the panel is the laptop\'s Race: '+panel.race.slice(0,80)+'…');
  const keys=Object.keys(laptop).filter(k=>k!=='race'); const diff=keys.filter(k=>laptop[k]!==panel[k]);
  if (diff.length) diff.forEach(k=>console.log('laptop '+k+': '+laptop[k]+'\npanel  '+k+': '+panel[k]));
  check(keys.length>=8 && diff.length===0,'every Data Lab data set gives the same five-number summary, mean and mode on the panel as on the laptop ('+keys.length+' sets: a unit, all units, the course grade, a Focus assignment, own data — both courses)'+(diff.length?' — differ: '+diff.join(', '):''));
  await ctx2.close();
  // ---- an empty Tally loads the full save ------------------------------------------------------------------------------
  const ctx3=await b.newContext({viewport:{width:1536,height:864}}); const r=await ctx3.newPage(); r.on('pageerror',e=>errs.push('full: '+e.message)); r.on('dialog',d=>d.accept()); await r.goto('file://'+path.resolve(APP)); await r.waitForTimeout(400);
  await r.setInputFiles('#file',[fullPath]); await r.waitForTimeout(900);
  const fm=await r.evaluate(()=>{ const T=window.__tally; return { board:!!T.state.board, classes:T.state.order.length, names:T.state.order.map(k=>T.state.sections[k].students[0]), grades:T.state.order.filter(k=>T.state.sections[k].grades).length, pools:Object.keys(T.state.pools).length, home:document.body.classList.contains('home'), cards:document.querySelectorAll('.hcard').length }; });
  check(!fm.board && fm.classes===nLaptop.classes && JSON.stringify(fm.names)===JSON.stringify(nLaptop.names) && fm.grades>=2 && fm.pools===2 && fm.home && fm.cards===nLaptop.classes,'dropped on an empty Tally, the full save is the laptop: '+fm.classes+' classes with their students, '+fm.grades+' gradebooks, both course pools, the Overview');
  const sameState=await r.evaluate(()=>JSON.stringify(window.__tally.state.order.map(k=>{ const s=window.__tally.state.sections[k]; return [s.label, s.scores.length, s.students.length, s.grades?s.grades.assignments.length:0, (s.history||[]).length]; })));
  const origState=await p.evaluate(()=>JSON.stringify(window.__tally.state.order.map(k=>{ const s=window.__tally.state.sections[k]; return [s.label, s.scores.length, s.students.length, s.grades?s.grades.assignments.length:0, (s.history||[]).length]; })));
  check(sameState===origState,'…class for class, the same skills, students, assignments and history');
  // loading over a Tally that has classes asks first; declining changes nothing
  let asked=''; r.removeAllListeners('dialog'); r.on('dialog',d=>{ asked=d.message(); d.dismiss(); });
  await r.setInputFiles('#file',[boardPath]); await r.waitForTimeout(700);
  check(/Open the Board save/.test(asked) && /replaces everything/.test(asked) && await r.evaluate(()=>!window.__tally.state.board && window.__tally.state.order.length>0),'loading a Board file over a working Tally asks first, and No leaves everything as it was: "'+asked.slice(0,90)+'…"');
  await ctx3.close();
  // ---- an older settings backup still loads the old way (merged onto existing classes) ------------------------------------
  const legacy=await p.evaluate(()=>{ const T=window.__tally; const cfg={ tally:4, exported:new Date().toISOString(), settings:{ copyMode:'ids' }, sections:{} }; T.state.order.forEach(k=>{ const x=T.state.sections[k]; cfg.sections[k]={ label:x.label+' (old)', prep:x.prep, threshold:x.threshold, roster:x.roster, history:x.history, gradeHistory:x.gradeHistory||[] }; }); return cfg; });
  const legPath=path.join(tmp,'legacy.json'); fs.writeFileSync(legPath, JSON.stringify(legacy));
  await p.setInputFiles('#file',[legPath]); await p.waitForTimeout(900);
  check(await p.evaluate(()=>window.__tally.state.order.every(k=>/\(old\)$/.test(window.__tally.state.sections[k].label)) && window.__tally.state.settings.copyMode==='ids' && !window.__tally.state.board),'a settings-only backup from an earlier Tally still merges onto the classes here');
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
