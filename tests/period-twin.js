// One class per period (Croix, 22 Oct 2026: "It keeps adding an extra 5th period class when I try to upload IXL data").
// A class made from the course export and a gradebook is keyed "period-N"; a class's own IXL export is keyed by its
// section code (1205050-7T1A). The export used to start a second class for the same period. Now it goes to the class
// already there, a duplicate already in a saved Tally folds back into the real class, and a class's notes and the
// rest survive every weekly IXL import.
const { chromium, fs, path, exe, check, done, tmp, APP, pick } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1536,height:864}}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const list=()=>p.evaluate(()=>window.__tally.state.order.map(k=>{ const s=window.__tally.state.sections[k]; return { k, label:s.label, date:s.date, file:s.file, grades:!!s.grades, notes:Object.keys(s.stuNotes||{}).length, from:!!s.fromSection }; }));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await pick(p,'[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(700); const a=await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(300); } }
  await p.evaluate(()=>{ const T=window.__tally; const s=T.state.sections['period-1']; T.addNote(s, s.grades.students[0], 'Keep this note.'); T.save(); });
  const l0=await list(); check(l0.length===2 && l0.map(x=>x.k).join()==='period-1,period-2','two classes from the course exports and two gradebooks');
  // the 1st period class's own export, same day as the course export: nothing new
  const sec=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A'));
  await p.setInputFiles('#file',[path.resolve('fixtures',sec)]); await p.waitForTimeout(800);
  const l1=await list(); const ov=await p.evaluate(()=>JSON.stringify(window.__tally.state.lastImport));
  check(l1.length===2 && l1[0].file===l0[0].file,'its own IXL export, dated the same day as the course export, adds no class and changes nothing');
  check(/no change: this class already has the course export from the same day or later/.test(ov),'and the import line says so');
  // a newer export of that class: it updates the 1st period class itself
  const newer=path.join(tmp, sec.replace('2026-09-26','2026-09-29').replace(/^ixl_7T1A_scrubbed_/,'')); fs.copyFileSync(path.resolve('fixtures',sec), newer);
  await p.setInputFiles('#file',[newer]); await p.waitForTimeout(800);
  const l2=await list(); const p1=l2.find(x=>x.k==='period-1');
  check(l2.length===2 && p1.date==='2026-09-29' && p1.file===path.basename(newer) && p1.from,'a newer export of 1st period updates the 1st period class: still two classes, data from Sep 29');
  check(p1.grades && p1.notes===1,'the class keeps its gradebook and its notes');
  // the older course export again does not overwrite the class's newer data; a newer one does
  await p.setInputFiles('#file',[path.resolve('fixtures',acc)]); await p.waitForTimeout(800);
  check((await list()).find(x=>x.k==='period-1').date==='2026-09-29','an older course export leaves the newer class data alone');
  const accNew=path.join(tmp, acc.replace('2026-09-26','2026-10-02').replace(/^course_acc_/,'')); fs.copyFileSync(path.resolve('fixtures',acc), accNew);
  await p.setInputFiles('#file',[accNew]); await p.waitForTimeout(800);
  const l3=(await list()).find(x=>x.k==='period-1'); check(l3.date==='2026-10-02' && !l3.from,'a newer course export takes over again');
  // a duplicate already in a saved Tally (made by the old import) folds back into the real class on load
  await p.evaluate(()=>{ const T=window.__tally; const st=T.state; const src=st.sections['period-1']; st.sections['1205050-7T1A']={ key:'1205050-7T1A', label:'1st Period · Accelerated', prep:'acc', period:1, date:'2026-10-05', file:'IXL-Score-Grid_2026-10-05_x.csv', importedAt:'2026-10-05T12:00:00.000Z', students:src.students.slice(), skills:src.skills, scores:src.scores.map(r=>r.slice()), roster:'', history:[{ date:'2026-10-05', at:'2026-10-05T12:00:00.000Z', thr:67, students:1, per:{} }], threshold:67, excluded:{}, ignored:{}, aliases:{}, studentSkips:{} }; st.order.push('1205050-7T1A'); T.save(); });
  await p.reload(); await p.waitForTimeout(900);
  const l4=await list(); const msg=await p.evaluate(()=>document.querySelector('#toast').textContent); const f1=l4.find(x=>x.k==='period-1');
  check(l4.length===2 && !l4.some(x=>x.k==='1205050-7T1A') && f1.date==='2026-10-05' && f1.grades && f1.notes===1,'on load, the second 1st Period folds into the real one, with the newer IXL data; gradebook and notes stay');
  check(/1st Period · Accelerated was in Tally twice/.test(msg),'and Tally says it did: "'+msg+'"');
  // a class keyed by its own export keeps its notes through the next weekly export
  const ctx2=await b.newContext(); const q=await ctx2.newPage(); q.on('pageerror',e=>errs.push(e.message)); q.on('dialog',d=>d.accept()); await q.goto('file://'+path.resolve(APP));
  await q.setInputFiles('#file',[path.resolve('fixtures',sec)]); await q.waitForTimeout(600);
  await q.evaluate(()=>{ const T=window.__tally; const s=T.state.sections['1205050-7T1A']; T.addNote(s, s.students[0], 'Still here?'); s.gbUnitMap={ x:'Unit 2' }; T.save(); });
  await q.setInputFiles('#file',[newer]); await q.waitForTimeout(700);
  const kept=await q.evaluate(()=>{ const s=window.__tally.state.sections['1205050-7T1A']; return { n:Object.keys(s.stuNotes||{}).length, map:s.gbUnitMap, date:s.date, classes:window.__tally.state.order.length }; });
  check(kept.n===1 && kept.map && kept.map.x==='Unit 2' && kept.date==='2026-09-29' && kept.classes===1,'a weekly class export keeps the class\'s notes and Focus links (they used to be dropped)');
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
