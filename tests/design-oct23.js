// Round 7 (23 Oct 2026), usability: closing a quarter only after it ends (early is a deliberate step in Settings, with
// Undo and a banner), and getting out of a category mistake (Focus's own grades fix it in one tap, with Undo).
const { chromium, fs, path, exe, check, done, APP, pick, more } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if (m.type()==='error') console.log('CONSOLE', m.text()); }); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const K='1205050-7T1A';
  // Quarter 1 runs to Dec 1 here, so today is in the middle of it
  await p.evaluate(()=>{ const T=window.__tally; T.state.quarters.ends[0]='2026-12-01'; T.save(); T.render(); });

  // 1. Quarters: no way to close before the end date
  await p.click('#btnHome'); await p.waitForTimeout(200); await p.click('#homeQuarters'); await p.waitForTimeout(300);
  check(/^Quarters/.test(await p.textContent('#modal h2')) && await p.locator('#qClose').count()===0 && /After that, Tally asks you to close it/.test(await p.textContent('#modal')),'before the end date the Quarters dialog has dates and nothing that closes');
  await p.click('#mClose'); await p.waitForTimeout(200);

  // 2. Closing early: Settings → Close Quarter 1 early… → a tick → the button
  await more(p,'#btnSettings'); await p.waitForTimeout(300);
  check(/Quarter 1 ends Dec 1/.test(await p.textContent('#modal')) && await p.locator('#setQEarly').count()===1,'Settings says when the quarter ends and offers closing early');
  await seeTab(p,'#setQEarly'); await p.click('#setQEarly'); await p.waitForTimeout(300);
  check(/Close Quarter 1 early/.test(await p.textContent('#modal h2')) && await p.locator('#qClose[disabled]').count()===1 && /I know Quarter 1 runs until Dec 1/.test(await p.textContent('#modal')),'the early close waits for "I know Quarter 1 runs until Dec 1"');
  await p.check('#qSure'); await p.click('#qClose'); await p.waitForTimeout(400);
  check(await p.evaluate(()=>window.__tally.state.quarters.closed[1]!=null) && await p.locator('#qUndo').count()===1,'it closes, and the message has Undo');
  await p.click('#qUndo'); await p.waitForTimeout(300);
  check(await p.evaluate(()=>!window.__tally.state.quarters.closed[1] && window.__tally.currentQuarter()===1),'Undo opens Quarter 1 again');

  // 3. While closed early, the Overview says so with a one-tap Reopen
  await p.evaluate(()=>{ window.__tally.closeQuarter(1,{acc:[],on:[]}); window.__tally.save(); window.__tally.render(); }); await p.click('#btnHome'); await p.waitForTimeout(300);
  check(await p.locator('.notice.qce').count()===1 && /Quarter 1 was closed early/.test(await p.textContent('.notice.qce')) && /runs until Dec 1/.test(await p.textContent('.notice.qce')),'the Overview says Quarter 1 was closed early and when it really ends');
  await p.click('#ceReopen'); await p.waitForTimeout(300);
  check(await p.evaluate(()=>!window.__tally.state.quarters.closed[1]) && await p.locator('.notice.qce').count()===0 && /open again/.test(await p.textContent('#toast')),'Reopen is one tap, no question');

  // 4. The Quarters dialog lists each closed quarter with Reopen on the latest
  await p.evaluate(()=>{ window.__tally.closeQuarter(1,{acc:[],on:[]}); window.__tally.save(); window.__tally.render(); });
  await p.click('#btnHome'); await p.waitForTimeout(200); await p.click('#homeQuarters'); await p.waitForTimeout(300);
  check(await p.locator('.qclosed li').count()===1 && /early, it ends Dec 1/.test(await p.textContent('.qclosed')) && await p.locator('#qReopen').count()===1,'the dialog lists Quarter 1 as closed early, with Reopen');
  await p.click('#qReopen'); await p.waitForTimeout(300);
  check(await p.evaluate(()=>!window.__tally.state.quarters.closed[1]),'Reopen in the dialog needs no confirmation');
  await p.click('#mClose'); await p.waitForTimeout(200);

  // 5. A gradebook for a quarter closed early asks to reopen it
  await p.evaluate(()=>{ window.__tally.closeQuarter(1,{acc:[],on:[]}); window.__tally.save(); window.__tally.render(); });
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
  check(await p.evaluate(()=>!window.__tally.state.quarters.closed[1]),'importing a Quarter 1 gradebook while Quarter 1 is closed early reopens it (the question was answered yes)');

  // 6. A category mistake: tests in Classwork, IXL in Participation, all "set by you"
  const names=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const g=T.gradingFor(s.prep);
    const bad=s.grades.assignments.filter(a=>/quiz|test|assessment|ixl/i.test(a.name)).map(a=>a.name);
    s.grades.assignments.forEach(a=>{ if (/ixl/i.test(a.name)) { g.map[a.name]='Participation'; g.how[a.name]='user'; } else if (/quiz|test|assessment/i.test(a.name)) { g.map[a.name]='Classwork'; g.how[a.name]='user'; } });
    T.save(); T.render(); return bad; },K);
  check(names.length>=2,'the mistake touches '+names.length+' assignments');
  await p.click('#btnHome'); await p.waitForTimeout(300);
  const att=await p.evaluate(K=>window.__tally.attentionItems(window.__tally.state.sections[K]).map(a=>a.text).join(' | '),K);
  check(/you set disagree with Focus's grades/.test(att) && /not in Assessments/.test(att),'Needs attention says the categories disagree with Focus and a test is outside Assessments: '+att);
  await p.click('.hcard'); await p.waitForTimeout(300); await p.click('#openGrades'); await p.waitForTimeout(400);
  check(await p.locator('.notice.catfix').count()===1 && /Focus's grades disagree with/.test(await p.textContent('.notice.catfix')),'Grades: a notice names the categories Focus disagrees with');
  check(/Let Tally decide all/.test(await p.textContent('#gAsg')) && await p.locator('.catsrc.src-user').count()===names.length,'the rows you set say "Set by you", with a way back for all of them');
  await p.click('#catUseFocus'); await p.waitForTimeout(400);
  const fixed=await p.evaluate(K=>{ const T=window.__tally; const f=T.fitCategories(T.state.sections[K]); return { exact:f.exact, dis:Object.values(f.disagree||{}).filter(Boolean).length }; },K);
  check(fixed.exact && fixed.dis===0 && await p.locator('#catUndo').count()===1,'"Use Focus\'s" puts them back and grades match Focus again, with Undo');
  await p.click('#catUndo'); await p.waitForTimeout(300);
  check(await p.evaluate(K=>{ const T=window.__tally; return !T.fitCategories(T.state.sections[K]).exact; },K),'Undo brings the mistake back exactly');
  await p.click('#catAllBack'); await p.waitForTimeout(400);
  const all=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const g=T.gradingFor(s.prep); return { exact:T.fitCategories(s).exact, user:s.grades.assignments.filter(a=>g.how[a.name]==='user').length }; },K);
  check(all.exact && all.user===0,'"Let Tally decide all" forgets every hand-set category and Focus\'s grades decide again');
  // one row by hand, then back
  const one=names[0]; await p.selectOption(`select[data-cat="${one}"]`,'Participation'); await p.waitForTimeout(300);
  check(/is Participation in every accelerated class/.test(await p.textContent('#toast')),'changing one category says it applies to every accelerated class, with Undo');
  await p.click(`[data-back="${one}"]`); await p.waitForTimeout(300);
  check(await p.evaluate(({K,one})=>{ const T=window.__tally; const g=T.gradingFor(T.state.sections[K].prep); return g.how[one]!=='user' && T.fitCategories(T.state.sections[K]).exact; },{K,one}),'"Let Tally decide" on one row puts that row back');

  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
