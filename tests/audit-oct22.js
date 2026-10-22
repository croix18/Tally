// The full audit of 22 Oct 2026 (AUDIT_PLAN.md): one check per Critical/High finding that was fixed, each written to
// fail on the code before the fix. Croix: "Set up a plan to run a full audit looking for any other critical bugs and
// strengthening and hardening the things Tally does. Make sure it all works flawlessly and effortlessly."
const { chromium, fs, path, exe, check, done, tmp, APP, pick, fullSave } = require('./lib');
const P = require('../parser.js');
const csvOf = rows => rows.map(r => r.map(v => v == null ? '' : '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n') + '\r\n';
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const errs=[];
  const fresh=async(opts={})=>{ const ctx=await b.newContext({viewport:{width:1536,height:864},acceptDownloads:true}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message+' @ '+String(e.stack||'').split('\n').slice(0,3).join(' '))); p.on('dialog',d=>{ (p._dialogs=p._dialogs||[]).push(d.message()); return p._answer===false?d.dismiss():d.accept(); }); await p.goto('file://'+path.resolve(APP)); return { ctx, p }; };
  const oneClass=async p=>{ const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed')); await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
    await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
    await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600); };
  const pools=async p=>{ const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
    await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
    for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await pick(p,'[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(700); const a=await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(300); } }
    return { acc, on }; };
  const K='1205050-7T1A';

  // ---- 1. Copy pastes in the gradebook's order, and the roster follows Focus -------------------------------------------
  { const { ctx, p } = await fresh(); await oneClass(p);
    const rows=P.csvToRows(fs.readFileSync('fixtures/focus_gradebook_scrubbed.csv','utf8')); const gone=await p.evaluate(K=>window.__tally.state.sections[K].grades.students[2],K);
    const cut=rows.filter(r=>!(r||[]).some(v=>v===gone)); const f=path.join(tmp,'gradebook_left.csv'); fs.writeFileSync(f, csvOf(cut));
    await p.setInputFiles('#file',[f]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
    const r=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const u=T.unitsOf(s).find(x=>x.assigned&&x.total); const col=T.unitColumn(s,u,'points'); const gb=s.grades.students; const rows=T.gbRows(s);
      const want=rows.map(r=>r.ixl==null?'':String(T.points(s,u,r.ixl))); return { n:col.length, gb:gb.length, same:col.every((v,j)=>v===want[j]), roster:T.parseRosterText(s.roster).length, line:JSON.stringify(T.state.lastImport) }; },K);
    check(r.n===r.gb && r.gb===22 && r.same,'a student who left: Copy gives exactly the gradebook\'s 22 rows, each the right student\'s points (it gave 23, shifting everyone below by one)');
    check(r.roster===22 && /roster updated from Focus: 1 left/.test(r.line),'the roster follows Focus, and the import says so');
    await ctx.close(); }

  // ---- 2. a newer class export survives the next gradebook ------------------------------------------------------------
  { const { ctx, p } = await fresh(); const { acc } = await pools(p);
    const sec=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A')); const newer=path.join(tmp, sec.replace('2026-09-26','2026-09-29').replace(/^ixl_7T1A_scrubbed_/,'')); fs.copyFileSync(path.resolve('fixtures',sec), newer);
    await p.setInputFiles('#file',[newer, path.resolve('fixtures/focus_gradebook_pool_p1.csv')]); await p.waitForTimeout(1200); const a=await p.$('[data-sec="period-1"]'); if (a) { await a.click(); await p.waitForTimeout(500); }
    const d=await p.evaluate(()=>window.__tally.state.sections['period-1'].date); check(d==='2026-09-29','the class\'s newer IXL export dropped with its gradebook stays (the gradebook used to put the class back on the older course export): '+d);
    // a renamed course export is filed under the course its skills belong to
    const ren=path.join(tmp,'IXL 10-20 export.csv'); fs.copyFileSync(path.resolve('fixtures',acc), ren);
    const before=await p.evaluate(()=>({ on:window.__tally.state.pools.on.skills.length, acc:window.__tally.state.pools.acc.skills.length }));
    await p.setInputFiles('#file',[ren]); await p.waitForTimeout(900);
    const after=await p.evaluate(()=>({ on:window.__tally.state.pools.on.skills.length, acc:window.__tally.state.pools.acc.skills.length, file:window.__tally.state.pools.acc.file, line:JSON.stringify(window.__tally.state.lastImport) }));
    check(after.on===before.on && after.file==='IXL 10-20 export.csv' && /read as the accelerated course from its skills/.test(after.line),'a renamed accelerated export (no course in the name) goes to the accelerated course, read from its skills, and says so');
    await ctx.close(); }

  { const { ctx, p } = await fresh(); await pools(p);
    // carving a course export: a loose name on one roster can't take a student another class matched exactly
    const steal=await p.evaluate(()=>{ const T=window.__tally; const s1=T.state.sections['period-1'], s2=T.state.sections['period-2']; s2.prep=s1.prep;   // same course, so they carve one pool
      const rows1=T.buildRows(s1).filter(r=>r.status==='ok'&&r.ixl!=null); const victim=rows1.find(r=>{ const m=r.display.match(/^([^,]+),\s*(\S{4,})/); return m; }) || rows1[0]; const m=victim.display.match(/^([^,]+),\s*(\S+)/); const loose=m ? m[1]+', '+m[2].slice(0,3) : victim.display.split(' ').slice(-1)[0]+', '+victim.display.split(' ')[0].slice(0,3);
      s2.roster=(s2.roster||'')+'\n'+loose; T.state.order.forEach(k=>{ const x=T.state.sections[k]; if (x.pool) { x.fromSection=false; } }); T.render();
      const rows=T.poolRows(s2); const pool=T.state.pools[s1.prep]; return { victim:victim.display, took:rows.some(r=>pool.students[r.ixl]===s1.students[victim.ixl]) }; });
    check(!steal.took,'a loose roster name in one class (for "'+steal.victim+'") does not take a student another class matched exactly');
    await ctx.close(); }

  // ---- 3. FAST: a near-name with a different ID is not this student -----------------------------------------------------
  { const { ctx, p } = await fresh(); await oneClass(p);
    const r=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const n=s.grades.students[0], id=s.grades.ids[0]; const short=n.replace(/^([^,]+,\s*\S{3}).*$/,'$1');
      T.importFast({ students:[{ id:'999000111', name:short, grade:7, tests:[{ test:'FAST', pm:'PM1', year:'2026-27', level:1, scale:190 }], info:{ L30:'Y' } }], blank:0, windows:[{ pm:'PM1', year:'2026-27' }] }, 'x.csv');
      return { hist:T.testHistory(s,n).length, l30:(T.state.testInfo['id:'+id]||null) }; },K);
    check(r.hist===0 && !r.l30,'a FAST row whose name nearly matches a student but whose ID is someone else\'s is not given to that student');
    await ctx.close(); }

  // ---- 4. gradebooks: an earlier quarter's file never replaces the live one; an older copy asks -------------------------
  { const { ctx, p } = await fresh(); await oneClass(p);
    await p.evaluate(()=>window.__tally.closeQuarter(1,{acc:[],on:[]}));
    await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
    const q2=await p.evaluate(K=>window.__tally.state.sections[K].grades.assignments.map(a=>a.name).join('|'),K);
    p._answer=false; p._dialogs=[]; await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
    const r1=await p.evaluate(K=>window.__tally.state.sections[K].grades.assignments.map(a=>a.name).join('|'),K);
    check(r1===q2 && p._dialogs.some(m=>/This is a Quarter 1 gradebook, and .* is already on Quarter 2\. Quarter 1 is closed/.test(m)),'an old Q1 file dropped while Q2 is in asks before touching the closed Q1 record, and No changes nothing (it used to replace Q2 and rewrite Q1 finals)');
    p._answer=true; await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
    const r2=await p.evaluate(K=>window.__tally.state.sections[K].grades.assignments.map(a=>a.name).join('|'),K);
    check(r2===q2,'…and Yes updates only the Q1 record; the Q2 gradebook stays');
    // an older copy of this quarter's file (its newest graded work is earlier) asks first
    const rows=P.csvToRows(fs.readFileSync('fixtures/focus_gradebook_scrubbed_q2.csv','utf8')); const hdr=rows.findIndex(r=>r&&r.some(v=>/Student/.test(String(v||''))));
    const last=await p.evaluate(K=>{ const g=window.__tally.state.sections[K].grades; const due=a=>window.__tally.mdToISO(a.due)||''; return g.assignments.filter(a=>a.values.some(v=>v!=null)).sort((a,b)=>due(b).localeCompare(due(a)))[0].name; },K);
    const col=rows[hdr].findIndex(v=>String(v||'').startsWith(last)); const older=rows.map(r=>r?r.filter((_,j)=>j!==col):r); const f=path.join(tmp,'gradebook_q2_older.csv'); fs.writeFileSync(f, csvOf(older));
    p._answer=false; p._dialogs=[]; await p.setInputFiles('#file',[f]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
    const r3=await p.evaluate(K=>window.__tally.state.sections[K].grades.assignments.length,K);
    check(col>0 && p._dialogs.some(m=>/looks older than the one/.test(m)) && r3===q2.split('|').length,'an older copy of the current gradebook asks before replacing the newer one ('+last+' missing from it)');
    p._answer=true;
    // the student page names the open quarter by its own work: Quarter 2
    await ctx.close(); }
  { const { ctx, p } = await fresh(); await oneClass(p);
    await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
    const lab=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.openProfile(K, s.grades.students[0]); return { cq:T.currentQuarter(), page:document.querySelector('#gridwrap').textContent }; },K);
    check(lab.cq===1 && /Quarter 2 grade/.test(lab.page) && !/Quarter 1 grade/.test(lab.page),'with Q1 not yet closed, Q2 grades are labelled Quarter 2 on the student page (they said "Quarter 1")');
    await ctx.close(); }

  // ---- 5. keeping data: two tabs, an unreadable save, an old backup, the fold -------------------------------------------
  { const { ctx, p } = await fresh(); await oneClass(p); const q=await ctx.newPage(); q.on('pageerror',e=>errs.push(e.message)); await q.goto('file://'+path.resolve(APP)); await q.waitForTimeout(500);
    await q.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.addNote(s, s.grades.students[0], 'From the other tab.'); T.save(); },K); await p.waitForTimeout(300);
    await p.evaluate(()=>{ const T=window.__tally; T.state.settings.hideNames=!T.state.settings.hideNames; T.save(); });
    await q.reload(); await q.waitForTimeout(500);
    const n=await q.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; return T.notesOf(s, s.grades.students[0]).length; },K);
    check(n===1,'a second tab\'s note survives the first tab\'s next save (the stale tab used to write over it)');
    // unreadable saved data is downloaded before anything can overwrite it
    await q.close(); await p.evaluate(()=>localStorage.setItem('tally.v1','{"sections":{"x":'+'"y"'.repeat(5)+'}}garbage'));
    const [dl]=await Promise.all([p.waitForEvent('download',{timeout:5000}).catch(()=>null), p.reload()]); await p.waitForTimeout(600);
    const msg=await p.evaluate(()=>document.querySelector('#toast').textContent);
    check(dl && /^tally-unreadable-/.test(dl.suggestedFilename()) && /downloaded as tally-unreadable-/.test(msg),'saved data Tally can\'t read is downloaded as a file first, and the message says so');
    await ctx.close(); }
  { const { ctx, p } = await fresh(); await oneClass(p);
    const F=await fullSave(p); await p.keyboard.press('Escape');
    const st=F.json.state; const s0=st.sections[K]; const legacy={ tally:4, exported:'2026-09-01T12:00:00.000Z', settings:{}, sections:{ [K]:{ label:s0.label, threshold:s0.threshold, history:[{ date:'2026-08-30', at:'2026-08-30T12:00:00.000Z', thr:67, students:1, per:{} }], studentSkips:{ 'Someone':{ x:true } }, ignored:{}, aliases:{} } } };
    await p.evaluate(K=>{ const s=window.__tally.state.sections[K]; s.studentSkips={ 'Here Already':{ y:true } }; window.__tally.save(); },K);
    const f=path.join(tmp,'old-backup.json'); fs.writeFileSync(f, JSON.stringify(legacy)); const before=s0.history.length;
    await p.setInputFiles('#file',[f]); await p.waitForTimeout(700);
    const r=await p.evaluate(K=>{ const s=window.__tally.state.sections[K]; return { h:s.history.map(x=>x.date), skips:Object.keys(s.studentSkips||{}) }; },K);
    check(r.h.length===before+1 && r.h[0]==='2026-08-30' && r.skips.includes('Here Already') && r.skips.includes('Someone'),'an old backup adds its history and skips to what is here instead of replacing them');
    // the fold keeps what the duplicate held of its own
    await p.evaluate(K=>{ const T=window.__tally; const st=T.state; const src=st.sections[K]; src.period=1; st.sections['period-1']={ ...JSON.parse(JSON.stringify(src)), key:'period-1', pool:false }; st.order.push('period-1');
      const d=st.sections[K]; delete d.grades; d.roster=''; d.stuNotes={}; d.qArchive={}; d.receipts={ 'Unit 2':{ at:'2026-10-20T10:00:00.000Z', rows:[] } }; d.studentSkips={ 'Kid, A':{ s1:true } }; T.save(); },K);
    await p.reload(); await p.waitForTimeout(700);
    const fold=await p.evaluate(()=>{ const s=window.__tally.state.sections['period-1']; return { gone:!window.__tally.state.sections['1205050-7T1A'], rc:Object.keys(s.receipts||{}), sk:Object.keys(s.studentSkips||{}) }; });
    check(fold.gone && fold.rc.includes('Unit 2') && fold.sk.includes('Kid, A'),'folding a duplicate class keeps its Focus copy receipts and per-student skips');
    await ctx.close(); }

  // ---- 6. "unsaved work" means real work --------------------------------------------------------------------------------
  { const { ctx, p } = await fresh(); await oneClass(p); const F=await fullSave(p); await p.keyboard.press('Escape');
    const { ctx:c2, p:q } = await fresh(); await q.setInputFiles('#file',[F.file]); await q.waitForTimeout(800);
    await q.click(`[data-k="${K}"]`).catch(()=>{}); await q.waitForTimeout(400); await q.evaluate(()=>window.__tally.render());
    const u1=await q.evaluate(()=>window.__tally.state.savedPrint!==window.__tally.workPrint());
    await q.reload(); await q.waitForTimeout(600); const u2=await q.evaluate(()=>window.__tally.state.savedPrint!==window.__tally.workPrint());
    check(!u1 && !u2,'right after opening a Full save, looking at a class or reloading is not unsaved work (in Google Site mode it raised the strip, the leave prompt and an autosave)');
    await ctx.close(); await c2.close(); }

  // ---- 7. grades and plans --------------------------------------------------------------------------------------------
  { const { ctx, p } = await fresh(); await oneClass(p);
    const r=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K];
      // a blank Focus IXL cell where Tally has 0 is not a match (a blank is left out of the grade, a 0 is not)
      const col=s.grades.assignments.find(a=>/\bixl\b/i.test(a.name)); const u=T.unitsOf(s).find(x=>x.name===(T.gbUnitFor?T.gbUnitFor(s,col):{}).name);
      const rows=T.gbRows(s); const j=rows.findIndex(x=>x.ixl!=null && u && T.points(s,u,x.ixl)===0);
      let blank=null; if (j>=0) { col.values[j]=null; col.status[j]='blank'; const rc=T.reconcile(s).find(c=>c.unit.name===u.name); blank=rc.rows.find(x=>x.display===rows[j].display).status; }
      // an NHI in an IXL column is not "missing work" for a retake; IXL skills decide that
      const n=s.grades.students[0]; const i=0; const st0=T.retakeStatus(s,n).missing.length; col.status[i]='missing'; col.values[i]=null; const st1=T.retakeStatus(s,n).missing.length;
      return { blank, j, st0, st1 }; },K);
    check(r.j<0 || r.blank!=='match','the Focus check flags a blank IXL cell where Tally has 0 ('+r.blank+')');
    check(r.st0===r.st1,'an NHI in a Focus IXL column is not counted as missing work for retakes (the conference form and the retake line disagreed)');
    // the quickest plan never asks for skills a student has already done in IXL: that gap is a copy into Focus
    const q=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; let copy=0, bad=0; s.grades.students.forEach((n,i)=>{ const f=T.findStudent(s,n); const pl=T.quickestPath(s,s,i,f.ixl); if (!pl||pl.top) return;
        pl.plan.forEach(x=>{ if (x.kind==='copy') copy++; if (x.kind==='ixl' && f.ixl!=null) { const u=T.unitsOf(s).find(y=>y.name===(x.unit||{}).name); if (u && T.points(s,u,f.ixl)+x.n > T.activeFor(s,u,f.ixl).length) bad++; } }); }); return { copy, bad }; },K);
    check(q.bad===0 && q.copy>0,'the quickest plan lists IXL already earned as "Copy … into Focus" ('+q.copy+' students) and never plans more skills than a student has left');
    await ctx.close(); }

  // ---- 8. a bad date in a save, the Data Lab's scale, the panel's passphrase, the page's walls ------------------------
  { const { ctx, p } = await fresh(); await oneClass(p);
    await p.evaluate(K=>{ const s=JSON.parse(localStorage.getItem('tally.v1')); s.sections[K].date='abc'; s.order=['x',K,K]; localStorage.setItem('tally.v1',JSON.stringify(s)); },K);
    await p.reload(); await p.waitForTimeout(700);
    const ok=await p.evaluate(()=>({ tabs:document.querySelectorAll('#tabs [data-k]').length, cards:document.querySelector('#app').classList.contains('hidden') }));
    check(ok.tabs===1 && !ok.cards && errs.length===0,'a save with a broken date and a doubled class shows Tally normally (it used to stay blank for good)');
    const csp=fs.readFileSync(APP,'utf8'); check(/http-equiv="Content-Security-Policy"[^>]*connect-src 'self'/.test(csp),'the shipped page carries a Content Security Policy: nothing can be sent anywhere but its own site');
    await ctx.close(); }
  { const { ctx, p } = await fresh(); await pools(p);
    await p.evaluate(()=>{ const T=window.__tally; T.state.settings.leaderboard=true; T.state.settings.lbTab='lab'; T.save(); T.render(); }); await p.waitForTimeout(500);
    await p.selectOption('#labKind','dots').catch(()=>{}); await p.waitForTimeout(300);
    const hs=await p.evaluate(()=>[...document.querySelectorAll('#lb .labRow .labPlot svg')].map(s=>s.getAttribute('viewBox')));
    check(hs.length>=1 && new Set(hs).size===1,'every Data Lab row is drawn to one scale ('+[...new Set(hs)].join(' / ')+')');
    await ctx.close(); }

  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
