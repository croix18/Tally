// A real class end to end (scrubbed exports): IXL CSV → roster paste → Focus gradebook → Data Lab.
const { chromium, fs, path, exe, check, done, tmp, unskip } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900}}); await ctx.grantPermissions(['clipboard-read','clipboard-write']); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve('Tally.html')); await unskip(p);
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(600);
  const s=await p.evaluate(()=>{const T=window.__tally; const s=Object.values(T.state.sections)[0]; return {label:s.label,thr:s.threshold,n:s.students.length,skills:s.skills.length,scored:s.scores.flat().filter(v=>v!=null).length};});
  check(s.label==='1st Period · Accelerated' && s.thr===67 && s.n===23 && s.skills===219 && s.scored===886,'real IXL CSV: 23 students, 220 skills, 886 scores, goal 67');
  // roster from the real Focus file (ID<TAB>Last, First Middle)
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.waitForTimeout(200);
  const rep=await p.textContent('#rpReport'); check(/16 of 23 roster names matched/.test(rep),'real roster: 16 exact matches (7 are scrubber artifacts): '+rep.slice(0,45));
  check(!/Matched loosely/.test(rep),'middle names no longer count as loose matches');
  await p.click('#rpSave'); await p.waitForTimeout(400);
  check(/left out of copies/.test(await p.textContent('#notices')),'roster-mismatch notice says IXL-only students are left out of copies');
  await p.click('th.unit .copy'); await p.waitForTimeout(300); const ct=await p.textContent('#toast');
  check(/7 IXL students not on the roster — left out/.test(ct),'copy toast counts the students left out: '+ct.replace(/\s+/g,' ').slice(0,160));
  // Focus gradebook through the picker
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500);
  check(await p.locator('[data-sec]:not([data-sec="__new__"])').count()===1,'picker appears for the Focus export');
  await p.click('[data-sec]'); await p.waitForTimeout(400);
  const g=await p.evaluate(()=>{const s=Object.values(window.__tally.state.sections)[0].grades; return {n:s.students.length, a:s.assignments.map(a=>[a.name,a.max,a.category,a.missing,a.excused,a.unread])};});
  check(g.n===23 && g.a.length===13,'Focus export: 23 students, 13 assignments');
  check(JSON.stringify(g.a.find(a=>a[0]==='Unit 1 Assessment'))==='["Unit 1 Assessment",21,"Assessments",0,1,0]','Unit 1 Assessment: 21 points, Assessments, 1 excused (NG), nothing unread');
  check(g.a.find(a=>a[0]==='Unit 2 IXL')[1]===17 && g.a.find(a=>a[0]==='Whiteboard Practice Week 9/21')[1]===5,'multi-line headers: points parsed, titles intact including "Week 9/21"');
  check(g.a.every(a=>a[5]===0) && g.a.find(a=>a[0]==='Worksheet 1.4')[3]===7,'every Focus cell readable; NHI counts as missing');
  // Data Lab on a Focus assessment
  await p.click('#btnLb'); await p.waitForTimeout(300); await p.click('[data-tab="lab"]'); await p.waitForTimeout(300);
  await p.selectOption('#labUnit','gb:Unit 1 Assessment'); await p.waitForTimeout(400);
  check(await p.locator('.labRow').count()===1 && /out of 21/.test(await p.textContent('.lbSub')) && !/excused/.test(await p.textContent('.labName')),'Data Lab plots the real assessment out of 21 — no excused count on the student screen');
  await p.click('#labStats'); await p.waitForTimeout(200); await p.screenshot({path:path.join(tmp,'shot21.png')});
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700); await p.click('#btnHide'); await p.waitForTimeout(150);
  // Copy Unit 2 → 17 skills, matches the Focus "Unit 2 IXL 17 Points" assignment
  const u2=await p.evaluate(()=>{const T=window.__tally; const s=Object.values(T.state.sections)[0]; return T.unitsOf(s).find(u=>u.short==='Unit 2').total;});
  check(u2===17,'Tally Unit 2 is out of 17 — same as the Focus "Unit 2 IXL" column');
  await p.screenshot({path:path.join(tmp,'shot22.png')});
  // run-together surnames (what IXL appears to do with "LOWELL CALDER" and "JARVIS-DUNMORE")
  const rt=await p.evaluate(()=>{const T=window.__tally; const base={skills:[],scores:[],excluded:{},aliases:{},hiddenUnits:{},threshold:60,ignored:{},studentSkips:{}};
    return T.buildRows({...base,students:['CASEY LOWELLCALDER','TATUM JARVISDUNMORE','REMY YORKVANCE'],roster:'LOWELL CALDER, CASEY DE LOS AVERY\nJARVIS-DUNMORE, TATUM\nYORK VANCE, REMY'}).map(x=>x.status+'/'+x.tier);});
  check(rt.every(x=>x==='ok/exact'),'two-word and hyphenated surnames match IXL\'s run-together form exactly');
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
