// Course-wide IXL exports (no section code, every student of the course in one file) become pools; Focus gradebooks
// make period classes carved from them. Fixtures: two real scrubbed course exports + two synthetic gradebooks of pool names.
const { chromium, fs, path, exe, check, done, tmp } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:1000}}); await ctx.grantPermissions(['clipboard-read','clipboard-write']); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve('Tally.html'));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  // pools
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  const pools=await p.evaluate(()=>{const P=window.__tally.state.pools; return {acc:[P.acc.students.length,P.acc.skills.length], on:[P.on.students.length,P.on.skills.length], sections:window.__tally.state.order.length};});
  check(pools.acc.join()==='91,220' && pools.on.join()==='91,177' && pools.sections===0,'both course exports become pools, no class yet: '+JSON.stringify(pools));
  check(/Accelerated.*91 students/.test(await p.textContent('#toast')) && /import a Focus gradebook for each period/.test(await p.textContent('#toast')),'toast explains the next step');
  check(await p.locator('#empty:not(.hidden)').count()===1,'landing still shown until a class exists');
  // gradebook → new class (period + course)
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_pool_p1.csv')]); await p.waitForTimeout(600);
  check(await p.locator('[data-sec="__new__"].on').count()===1,'picker offers "+ New class" as the choice when no class matches');
  await p.click('[data-sec="__new__"]'); await p.waitForTimeout(300);
  check(await p.locator('#ncMake[disabled]').count()===1,'Make is disabled until period and course are chosen');
  await p.click('#ncPeriod [data-p="1"]'); await p.click('#ncPrep [data-prep="acc"]'); await p.click('#ncMake'); await p.waitForTimeout(800);
  if ((await p.textContent('#modal')).trim()) { await p.click('#mCancel').catch(()=>{}); await p.waitForTimeout(300); }
  const s1=await p.evaluate(()=>{const T=window.__tally; const s=T.state.sections['period-1']; const rows=T.buildRows(s); return {label:s.label, pool:s.pool, students:s.students.length, skills:s.skills.length, ok:rows.filter(r=>r.status==='ok').length, amb:rows.filter(r=>r.status!=='ok').map(r=>r.display+':'+r.status), io:rows.filter(r=>r.status==='ixlOnly').length, date:s.date, grades:!!s.grades, units:T.unitsOf(s).length, thr:s.threshold};});
  check(s1.label==='1st Period · Accelerated' && s1.pool===true && s1.thr===67,'class made with the chosen period and course: '+s1.label);
  check(s1.students===22 && s1.skills===220 && s1.ok===22 && s1.io===0 && s1.units===17 && s1.date==='2026-09-26','class carved from the accelerated pool: 22 of 23 roster names matched, no IXL-only rows');
  check(s1.amb.join()==='QUILL, DAKOTA:rosterOnly','the one unmatched (two pool students normalise to the same name) is flagged for the fixer');
  check(s1.grades===true,'gradebook attached to the new class');
  // resolve the ambiguous one with the fixer: pool leftovers are offered
  await p.click('button.flag[data-fix="QUILL, DAKOTA"]'); await p.waitForTimeout(300);
  const chips=await p.locator('.picks .chip').allTextContents();
  check(chips.length>=2 && chips.some(c=>/DAKOTA QUILL$/.test(c.trim())),'fixer offers the pool candidates: '+chips.slice(0,3).join(' | '));
  await p.locator('.picks .chip').filter({hasText:/^DAKOTA QUILL$/}).first().click(); await p.waitForTimeout(500);
  const s1b=await p.evaluate(()=>{const T=window.__tally; const s=T.state.sections['period-1']; return {students:s.students.length, ok:T.buildRows(s).filter(r=>r.status==='ok').length};});
  check(s1b.students===23 && s1b.ok===23,'after picking, the class re-materialises with all 23');
  // second gradebook → 2nd period on-level; period 1 is greyed out in the picker
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_pool_p2.csv')]); await p.waitForTimeout(600);
  await p.click('[data-sec="__new__"]'); await p.waitForTimeout(300);
  check(await p.locator('#ncPeriod [data-p="1"][disabled]').count()===1,'a period already in use can\'t be chosen twice');
  await p.click('#ncPeriod [data-p="2"]'); await p.click('#ncPrep [data-prep="on"]'); await p.click('#ncMake'); await p.waitForTimeout(800);
  if ((await p.textContent('#modal')).trim()) { await p.click('#mCancel').catch(()=>{}); await p.waitForTimeout(300); }
  const s2=await p.evaluate(()=>{const T=window.__tally; const s=T.state.sections['period-2']; return {label:s.label, students:s.students.length, skills:s.skills.length, units:T.unitsOf(s).length, race:T.leaderboardData().map(r=>r.key).sort().join()};});
  check(s2.label==='2nd Period · On-level' && s2.skills===177 && s2.units===13 && s2.students>=23,'on-level class carved from the on-level pool (177 skills, 13 units)');
  check(s2.race==='period-1,period-2','both classes in the race');
  // copy works from a pool-backed class
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(200); await p.click('th.unit .copy'); await p.waitForTimeout(300);
  const clip=await p.evaluate(()=>navigator.clipboard.readText()); check(clip.split('\n').length===23,'copy gives 23 rows in Focus order');
  // default: the first accelerated unit and the first two on-level units aren't assigned; Settings changes it per course; a hand mark wins
  const dflt=await p.evaluate(()=>{const T=window.__tally; const u=k=>T.unitsOf(T.state.sections[k]).filter(u=>!u.assigned).map(u=>u.short); return {acc:u('period-1'), on:u('period-2'), race:T.leaderboardData().map(r=>r.key+':'+r.assignedUnits[0]), rc:T.reconcile(T.state.sections['period-1']).map(c=>c.unit.short)};});
  check(!dflt.acc.includes('Unit 1') && dflt.on.includes('Unit 1') && !dflt.on.includes('Unit 2'),'by default only Unit 1 (on-level) is not assigned; accelerated Unit 1 counts: '+JSON.stringify([dflt.acc,dflt.on]));
  check(dflt.race.some(x=>/^period-2:/.test(x) && !/:Unit 1$/.test(x)),'unassigned units are out of the Race');
  await p.click('[data-k="period-2"]'); await p.waitForTimeout(200); await p.click('#btnSettings'); await p.waitForTimeout(200); await p.click('[data-skip="3"]'); await p.click('#mSave'); await p.waitForTimeout(400);
  check((await p.evaluate(()=>window.__tally.unitsOf(window.__tally.state.sections['period-2']).filter(u=>!u.assigned).map(u=>u.short))).includes('Unit 3'),'Settings: "First 3" unassigns Unit 3 for the on-level course');
  await p.evaluate(()=>{ const T=window.__tally; T.state.assigned.on['Unit 2 Probability']=true; T.save(); T.render(); });
  check((await p.evaluate(()=>window.__tally.unitsOf(window.__tally.state.sections['period-2']).find(u=>u.short==='Unit 2').assigned))===true,'a unit marked Assigned by hand overrides the default');
  // skill skips are course-wide: skipping in one class skips it for the other class of the same course
  await p.evaluate(()=>{ const T=window.__tally; const S=T.state.sections; S['period-3']={...S['period-1'], key:'period-3', label:'3rd Period · Accelerated', period:3, excluded:S['period-1'].excluded, receipts:{}, history:[]}; T.state.order.push('period-3'); T.save(); T.render(); });
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(200); await p.click('th.unit .ulink'); await p.waitForTimeout(300);
  const before=await p.evaluate(()=>window.__tally.unitsOf(window.__tally.state.sections['period-3'])[0].total);
  await p.click('th.skill button[data-x]'); await p.waitForTimeout(300);
  check(/for every accelerated class/.test(await p.textContent('#toast')),'skip toast says it applies to the course');
  const after=await p.evaluate(()=>{const T=window.__tally; return [T.unitsOf(T.state.sections['period-3'])[0].total, Object.keys(T.state.skips.acc).length];});
  check(after[0]===before-1 && after[1]===1,'the other accelerated class lost the same skill; state.skips.acc holds it');
  await p.reload(); await p.waitForTimeout(500);
  check(await p.evaluate(()=>{const T=window.__tally; const S=T.state.sections; return S['period-1'].excluded===S['period-3'].excluded && S['period-1'].excluded===T.state.skips.acc && Object.keys(T.state.skips.acc).length===1;}),'after reload every accelerated class still shares the course skips');
  await p.evaluate(()=>{ const T=window.__tally; delete T.state.sections['period-3']; T.state.order=T.state.order.filter(k=>k!=='period-3'); T.state.skips.acc={}; T.state.order.forEach(k=>{ const s=T.state.sections[k]; if(s.prep==='acc') s.excluded=T.state.skips.acc; }); T.save(); T.render(); });
  await p.click('#back').catch(()=>{}); await p.waitForTimeout(200);
  // re-import the accelerated pool → the class refreshes and the toast says so
  await p.setInputFiles('#file',[path.resolve('fixtures',acc)]); await p.waitForTimeout(800);
  check(/IXL course export/.test(await p.textContent('#toast')) && /1 class updated/.test(await p.textContent('#toast')),'re-importing the pool refreshes its classes');
  // reload persists pools and classes
  await p.reload(); await p.waitForTimeout(500);
  check(await p.evaluate(()=>{const T=window.__tally; return T.state.order.length===2 && !!T.state.pools.acc && T.state.sections['period-1'].students.length===23;}),'pools and classes survive a reload');
  // a gradebook before its pool: class exists, waits, then fills when the pool arrives
  const q=await ctx.newPage(); q.on('dialog',d=>d.accept()); await q.goto('file://'+path.resolve('Tally.html')); await q.evaluate(()=>localStorage.clear()); await q.reload(); await q.waitForTimeout(300);
  await q.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_pool_p2.csv')]); await q.waitForTimeout(600); await q.click('[data-sec="__new__"]'); await q.waitForTimeout(300);
  await q.click('#ncPeriod [data-p="2"]'); await q.click('#ncPrep [data-prep="on"]'); await q.click('#ncMake'); await q.waitForTimeout(800);
  if ((await q.textContent('#modal')).trim()) { await q.click('#mCancel').catch(()=>{}); await q.waitForTimeout(300); }
  check(/Waiting for the on-level IXL export/.test(await q.textContent('#notices')),'class made before its pool shows a waiting notice');
  await q.setInputFiles('#file',[path.resolve('fixtures',on)]); await q.waitForTimeout(800);
  check(await q.evaluate(()=>{const s=window.__tally.state.sections['period-2']; return s.students.length>=23 && !s.awaitingPool;}) && !/Waiting for/.test(await q.textContent('#notices')),'pool arriving fills the waiting class');
  await q.close();
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
