// A Focus gradebook is placed on its class by its students' names and IDs, without a question, when it is plainly that
// class; "Which class is this gradebook?" opens only when it isn't — and says why. Synthetic fixtures only.
const { chromium, fs, path, exe, check, done, tmp, APP } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  const P1=path.resolve('fixtures/focus_gradebook_pool_p1.csv'), P2=path.resolve('fixtures/focus_gradebook_pool_p2.csv');
  const modal=async()=>(await p.locator('#modal:not(.hidden)').count()) ? (await p.textContent('#modal .panel header h2').catch(()=>''))||'open' : '';
  const closeAsk=async()=>{ for (let i=0;i<4;i++) { const a=await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(300); } } };
  const drop=async files=>{ await p.setInputFiles('#file',files); await p.waitForTimeout(900); };
  // split a fixture into its (multi-line) header and its student rows
  const parts=f=>{ const t=fs.readFileSync(f,'utf8'); const i=t.search(/^"\d{6,}"/m); return { head:t.slice(0,i), rows:t.slice(i).split(/\r?\n/).filter(l=>/^"\d{6,}"/.test(l)) }; };
  const write=(name,head,rows)=>{ const f=path.join(tmp,name); fs.writeFileSync(f, head+rows.join('\n')+'\n'); return f; };
  const g1=parts(P1), g2=parts(P2);

  // 1. First run: no class exists, so there is nothing to choose between — straight to "New class"
  await drop([path.resolve('fixtures',acc), path.resolve('fixtures',on)]);
  await drop([P1]);
  check(await modal()==='New class from this gradebook' && await p.locator('#ncExisting').count()===0,'with no class yet the gradebook goes straight to "New class" (no "Which class?" first)');
  check(await p.locator('#ncMake[disabled]').count()===1,'period and course are Croix\'s to pick — Focus puts neither in the file');
  await p.click('#ncPeriod [data-p="1"]'); await p.click('#ncPrep [data-prep="acc"]'); await p.click('#ncMake'); await p.waitForTimeout(800); await closeAsk();
  check(await p.evaluate(()=>{ const s=window.__tally.state.sections['period-1']; return !!s && s.prep==='acc' && s.grades.students.length===23; }),'period 1 made as accelerated with its 23 students');

  // 2. A second class's first gradebook: none of its students are in a class, so again straight to "New class"
  await drop([P2]);
  check(await modal()==='New class from this gradebook' && /only 1 of them in a class already/.test(await p.textContent('#modal')),'students who are in no class (one shared name aside): one dialog, and it says so');
  check(await p.locator('#ncExisting').count()===1,'…with a way back to an existing class');
  await p.click('#ncPeriod [data-p="2"]'); await p.click('#ncPrep [data-prep="on"]'); await p.click('#ncMake'); await p.waitForTimeout(800); await closeAsk();
  check(await p.evaluate(()=>{ const s=window.__tally.state.sections['period-2']; return !!s && s.prep==='on' && s.grades.students.length===24; }),'period 2 made as on-level with its 24 students');

  // 3. The weekly drop: both gradebooks at once, no question, each on its own class
  await p.evaluate(()=>{ const T=window.__tally; Object.values(T.state.sections).forEach(s=>{ s.grades.file='old'; }); T.state.lastImport=null; T.save(); });
  await drop([P2, P1]);
  check(await modal()==='','the weekly drop of both gradebooks asks nothing');
  const wk=await p.evaluate(()=>{ const T=window.__tally; return { f1:T.state.sections['period-1'].grades.file, f2:T.state.sections['period-2'].grades.file, lines:T.state.lastImport.lines.map(l=>l.label+' — '+l.text) }; });
  check(/pool_p1/.test(wk.f1) && /pool_p2/.test(wk.f2),'each file landed on its own class: '+wk.f1+' / '+wk.f2);
  check(wk.lines.filter(l=>/placed by its names \(2[34] of 2[34]\)/.test(l)).length===2,'the import result says where each went and on what evidence: '+wk.lines.filter(l=>/placed/.test(l)).join(' | '));
  await p.click('#btnHome').catch(()=>{}); await p.waitForTimeout(300);
  const card=await p.evaluate(()=>{ const d=document.querySelector('.himport'); if (d && d.tagName==='DETAILS') d.open=true; return d ? d.textContent : ''; });
  check(/placed by its names/.test(card),'…and it is on the Overview\'s import card');

  // 4. The class changed a little (two left, one joined): still plainly that class
  const moved=write('p1_changed.csv', g1.head, [...g1.rows.slice(2), '"1111199999","","NEWCOMER, RILEY","80% B","17.0 - 81 % - B"']);
  await drop([moved]);
  const ch=await p.evaluate(()=>{ const g=window.__tally.state.sections['period-1'].grades; return { n:g.students.length, file:g.file }; });
  check(await modal()==='' && ch.n===22 && /p1_changed/.test(ch.file),'two students gone and one new: placed on period 1 without asking ('+ch.n+' students)');
  await drop([P1]);   // back to the full class
  check(await modal()==='','…and the full class again, still no question');

  // 5. Student IDs carry it when Focus changes how a name is written
  const renamed=write('p1_renamed.csv', g1.head, g1.rows.map((r,i)=>r.replace(/^("\d+","[^"]*",")([^"]+)"/,(m,a,n)=>a+'ZZ'+i+', RENAMED"')));
  const mt=await p.evaluate(async txt=>{ const T=window.__tally; const ids=[...txt.matchAll(/^"(\d{6,})"/gm)].map(x=>x[1]); return T.matchSection({ students: ids.map((_,i)=>'ZZ'+i+', RENAMED'), ids }); }, fs.readFileSync(renamed,'utf8'));
  check(mt.auto==='period-1' && mt.best.n===23,'every name different but every student ID the same: still period 1 ('+mt.best.n+' of 23)');

  // 6. Not plainly one class: it asks, with the reason, and nothing is changed until Croix chooses
  const before=await p.evaluate(()=>JSON.stringify(Object.values(window.__tally.state.sections).map(s=>[s.grades.file, s.grades.students.length])));
  const cells=g1.rows[0].split('","').slice(3).join('","');   // the score cells of a period-1 row, reused under period-2 names
  const split=write('split.csv', g1.head, [...g1.rows.slice(0,12), ...g2.rows.slice(0,12).map(r=>r.split('","').slice(0,3).join('","')+'","'+cells)]);
  await drop([split]);
  check(await modal()==='Which class is this gradebook?' && /split between 1st Period · Accelerated \(1[23]\) and 2nd Period · On-level \(12\)/.test(await p.textContent('#pickWhy')),'half one class, half another: asks — '+(await p.textContent('#pickWhy').catch(()=>'')).slice(0,90));
  await p.click('#mCancel'); await p.waitForTimeout(300);
  const few=write('few.csv', g1.head, g1.rows.slice(0,5));
  await drop([few]);
  check(await modal()==='Which class is this gradebook?' && /only 5 of the 23 students in 1st Period/.test(await p.textContent('#pickWhy')),'five students of a class of 23: asks rather than replace the class with a fragment');
  check(await p.locator('[data-sec="period-1"].on').count()===1,'…with period 1 offered as the likely one');
  await p.click('#mCancel'); await p.waitForTimeout(300);
  const mixed=write('mostly.csv', g1.head, [...g1.rows.slice(0,14), ...Array.from({length:9},(_,i)=>`"11112000${10+i}","","STRANGER${i}, PAT","70% C","15.0 - 71 % - C"`)]);
  await drop([mixed]);
  check(await modal()==='Which class is this gradebook?' && /Only 14 of its 23 students are in 1st Period/.test(await p.textContent('#pickWhy')),'14 of 23 names match (under 80 %): asks');
  await p.click('#mCancel'); await p.waitForTimeout(300);
  const stranger=write('strangers.csv', g1.head, Array.from({length:20},(_,i)=>`"11113000${10+i}","","NOBODY${i}, SAM","70% C","15.0 - 71 % - C"`));
  await drop([stranger]);
  check(await modal()==='New class from this gradebook','names that match nowhere: asks for the new class');
  await p.click('#ncExisting'); await p.waitForTimeout(300);
  check(await modal()==='Which class is this gradebook?' && /None of its students are in a class yet/.test(await p.textContent('#pickWhy')) && await p.locator('[data-sec="__new__"].on').count()===1 && await p.locator('.picks [data-sec]:not([data-sec="__new__"])').count()===2,'"It belongs to a class I already have" opens the class list');
  await p.click('#mCancel'); await p.waitForTimeout(300);
  const after=await p.evaluate(()=>JSON.stringify(Object.values(window.__tally.state.sections).map(s=>[s.grades.file, s.grades.students.length])));
  check(before===after,'four skipped files changed nothing');

  // 7. Two files for the same class in one drop: the first is placed, the second asks
  const copy=write('p1_copy.csv', g1.head, g1.rows);
  await drop([P1, copy]);
  check(await modal()==='Which class is this gradebook?' && /Another file in this drop already went to 1st Period/.test(await p.textContent('#pickWhy')),'a second file for the same class in one drop asks before replacing the first');
  await p.click('#mCancel'); await p.waitForTimeout(300);
  check(await p.evaluate(()=>/pool_p1/.test(window.__tally.state.sections['period-1'].grades.file)),'…and skipping it leaves the first in place');
  await ctx.close();

  // 8. A class made from a per-period IXL export, no roster yet: placed through the IXL name matcher
  const c2=await b.newContext({viewport:{width:1400,height:1000}}); const q=await c2.newPage(); q.on('pageerror',e=>errs.push(e.message)); q.on('dialog',d=>d.accept());
  await q.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  if (ixl && fs.existsSync('fixtures/focus_gradebook_scrubbed.csv')) {
    await q.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await q.waitForTimeout(700);
    await q.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await q.waitForTimeout(900);
    const title=(await q.locator('#modal:not(.hidden)').count()) ? await q.textContent('#modal .panel header h2').catch(()=>'') : '';
    check(title!=='Which class is this gradebook?','a class with only its IXL export: the gradebook is placed by matching its names to the IXL names');
    const a=await q.$('#askApply'); if (a) { await a.click(); await q.waitForTimeout(300); }
    const r=await q.evaluate(()=>{ const T=window.__tally; const s=T.state.sections[T.state.order[0]]; return { gb:!!(s.grades&&s.grades.students.length), roster:!!s.roster, line:(T.state.lastImport.lines.find(l=>/placed by its names/.test(l.text))||{}).text||'' }; });
    check(r.gb && r.roster && /placed by its names/.test(r.line),'…its roster is filled from the file and the result line says so: '+r.line.slice(-60));
  } else console.log('SKIP per-period fixtures missing');
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
