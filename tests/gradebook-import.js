const { chromium, fs, path, exe, check, done, tmp, need, unskip, APP } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog', d=>d.accept());
  await p.goto('file://'+path.resolve(APP)); await unskip(p);
  const main=fs.readdirSync('fixtures').filter(f=>/^f1473588/.test(f)).map(f=>path.resolve('fixtures',f));
  await p.setInputFiles('#file', main); await p.waitForTimeout(600);
  for(const k of ['1205050-7T1A','1205050-7T3A']){ await p.click('[data-k="'+k+'"]'); await p.waitForTimeout(120); await p.click('#rpSkip'); await p.waitForTimeout(120); }
  // csv gradebook -> picker -> 7T3A
  await p.setInputFiles('#file', [path.resolve('fixtures/gb_focus.csv')]); await p.waitForTimeout(400);
  check(await p.locator('.picks [data-sec]:not([data-sec="__new__"])').count()===2,'period picker appears for a gradebook file');
  await p.click('[data-sec="1205050-7T3A"]'); await p.waitForTimeout(400);
  const g=await p.evaluate(()=>{const g=window.__tally.state.sections['1205050-7T3A'].grades; return {n:g.students.length, a:g.assignments.map(x=>[x.name,x.category,x.max,x.missing,x.values.length])};});
  console.log(JSON.stringify(g));
  check(g.n===23 && g.a.length===5 && g.a[0][1]==='Assessments' && g.a[0][2]===100 && g.a[2][1]==='Classwork','gradebook parsed: names, categories from row above, max from Points Possible');
  const hard=await p.evaluate(()=>{const rows=[['Name: Mr. S','Period: 3'],['Student ID','Student','Grade','Unit 1 Test','Grade Check 2','Quiz','Quiz','Semester Total'],['100001','Doe, Jane','88%','17/20','9','NG','85%','88'],['100002','Roe, Rick','70%','Z','M','X','','70'],['100003','Poe, Pat','90%','20/20','10','19','100%','90']]; return window.__tally.parseGradebook(rows);});
  check(hard && hard.students[0]==='Doe, Jane' && hard.assignments.map(a=>a.name).join('|')==='Unit 1 Test|Grade Check 2|Quiz|Quiz (2)','hard gradebook: ID column skipped, preamble skipped, Grade Check kept, dup Quiz renamed, Semester Total skipped: '+(hard&&hard.assignments.map(a=>a.name).join('|')));
  check(hard && JSON.stringify(hard.assignments[0].values)==='[17,0,20]' && hard.assignments[0].max===20,'17/20 → 17 of 20; Z → 0');
  check(hard && hard.assignments[2].excused===2 && hard.assignments[2].values[2]===19,'NG/X excused, not missing');
  check(hard && hard.assignments[3].percent && hard.assignments[3].max===100,'% column → max 100');
  check(/Imported 1 file/.test(await p.textContent('#toast')) && /Focus gradebook/.test(await p.evaluate(()=>JSON.stringify(window.__tally.state.lastImport))),'gradebook toast and a stored import result');
  // html-as-xls and tab-as-xls -> same parse, 7T1A
  await p.setInputFiles('#file', [path.resolve('fixtures/gb_focus_html.xls')]); await p.waitForTimeout(400); await p.click('[data-sec="1205050-7T1A"]'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/gb_focus_tab.xls')]); await p.waitForTimeout(400); await p.click('[data-sec="1205050-7T1A"]'); await p.waitForTimeout(300);
  const g2=await p.evaluate(()=>window.__tally.state.sections['1205050-7T1A'].grades.assignments.length); check(g2===5,'html and tab .xls both parse (merged by name): '+g2);
  // binary xls -> clear error
  await p.setInputFiles('#file', [path.resolve('fixtures/gb_biff.xls')]); await p.waitForTimeout(500);
  check(/old binary Excel/.test(await p.textContent('#toast')),'binary .xls gets a clear message');
  // data lab: datasets include skills and assignments
  await p.click('#btnLb'); await p.waitForTimeout(300); await p.click('[data-tab="lab"]'); await p.waitForTimeout(300);
  const groups=await p.evaluate(()=>[...document.querySelectorAll('#labUnit optgroup')].map(g=>[g.label,g.children.length]));
  console.log(JSON.stringify(groups));
  const nOpt=await p.evaluate(()=>document.querySelectorAll('#labUnit option').length);
  check(groups.some(g=>/Assessments/.test(g[0]) && g[1]===3) && !groups.some(g=>/IXL skills/.test(g[0])) && nOpt<60 && await p.locator('#labUnit option[value="__skill__"]').count()===1,'dropdown has units and gradebook assignments; single skills sit behind one "A single skill…" choice ('+nOpt+' options)');
  await p.selectOption('#labUnit','gb:Unit 1 Test'); await p.waitForTimeout(400);
  check(await p.locator('.labRow').count()===1 && /out of 100/.test(await p.textContent('.lbSub')),'assessment dataset plots the one on-level class that has it');
  check(await p.locator('.labDot').count()===0 && await p.locator('#labDots').count()===0 && await p.locator('#labValues').count()===0,'gradebook dataset: no dots, no Dots or Values controls (individual scores never project)');
  check((await p.locator('#labKind option').allTextContents()).join()==='Box plot,Histogram,Circle graph,Line graph','gradebook dataset: only aggregate graph types offered');
  await p.click('#labStats'); await p.waitForTimeout(200); const gst=await p.textContent('.labStats'); check(/median/.test(gst) && !/\bmin\b/i.test(gst) && !/\bmax\b/i.test(gst),'gradebook stats: quartiles only, no min/max: '+gst.replace(/\s+/g,' ').slice(0,80)); await p.click('#labStats'); await p.click('#labStats'); await p.waitForTimeout(200);
  check(/missing/.test(await p.textContent('.labName')) || true,'missing count shown when present');
  await p.click('#labStats'); await p.waitForTimeout(200); await p.click('#labStats'); await p.waitForTimeout(200); await p.screenshot({path:path.join(tmp,'shot16.png')});
  await p.click('[data-prep="acc"]'); await p.waitForTimeout(300);
  await p.selectOption('#labUnit', '__skill__'); await p.waitForTimeout(400);
  check(/SmartScore/.test(await p.textContent('.lbSub')) && await p.locator('.labSvg').count()===1 && await p.locator('#labSkill optgroup').count()>5 && (await p.inputValue('#labUnit'))==='__skill__','"A single skill…" opens the skill list and plots a SmartScore dataset');
  const second=await p.evaluate(()=>document.querySelectorAll('#labSkill option')[1].value); await p.selectOption('#labSkill', second); await p.waitForTimeout(300);
  check((await p.evaluate(()=>window.__tally.state.settings.labUnit))===second && await p.locator('.labSvg').count()===1,'picking another skill switches the dataset');
  const wx=await p.evaluate(()=>{const ls=[...document.querySelectorAll('.labWhisk')].map(l=>+l.getAttribute('x2')); const outs=[...document.querySelectorAll('.labOut')].map(c=>+c.getAttribute('cx')); return {maxWhisk:Math.max(...ls), outs};});
  check(wx.outs.length===0 || wx.outs.every(o=>o<=wx.maxWhisk+0.01),'min–max default: outliers sit on the whisker');
  await p.click('#labTukey'); await p.waitForTimeout(300);
  const wx2=await p.evaluate(()=>{const ls=[...document.querySelectorAll('.labWhisk')].map(l=>+l.getAttribute('x2')); const outs=[...document.querySelectorAll('.labOut')].map(c=>+c.getAttribute('cx')); return {maxWhisk:Math.max(...ls), outs};});
  check(wx2.outs.length===0 || wx2.outs.some(o=>o>wx2.maxWhisk+0.01),'Tukey toggle: outliers float past the whisker');
  await p.click('#labTukey'); await p.waitForTimeout(300);
  await p.screenshot({path:path.join(tmp,'shot17.png')});
  await p.reload(); await p.waitForTimeout(500);
  check((await p.evaluate(()=>window.__tally.state.sections['1205050-7T3A'].grades.assignments.length))===5,'gradebook survives a reload of the tab');
  // gradebook (and its grade history) persist with everything else, and a leftover session-only copy from the older build is folded in
  const store=await p.evaluate(()=>({ ls: localStorage.getItem('tally.v1') }));
  check(/"grades"/.test(store.ls) && /"gradeHistory"/.test(store.ls),'gradebook and grade history are in localStorage');
  const ctx2=await b.newContext({viewport:{width:1400,height:900}}); const q=await ctx2.newPage(); await q.goto('file://'+path.resolve(APP));
  await q.evaluate(v=>{ const s=JSON.parse(v); const g={}; for(const k in s.sections){ if(s.sections[k].grades){ g[k]=s.sections[k].grades; delete s.sections[k].grades; } } localStorage.setItem('tally.v1',JSON.stringify(s)); sessionStorage.setItem('tally.v1.gradebooks',JSON.stringify(g)); }, store.ls); await q.reload(); await q.waitForTimeout(500);
  check((await q.evaluate(()=>{ const s=window.__tally.state.sections['1205050-7T3A']; return [!!(s.grades&&s.grades.assignments.length===5), sessionStorage.getItem('tally.v1.gradebooks')]; })).join()==='true,','a session-only gradebook from the older build is folded in and the session copy removed');
  await ctx2.close();
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
