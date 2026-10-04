const { chromium, fs, path, exe, check, done, tmp, need, unskip, APP } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900}}); await ctx.grantPermissions(['clipboard-read','clipboard-write']); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); let dialogAnswer=true; p.on('dialog', d=>dialogAnswer?d.accept():d.dismiss());
  await p.goto('file://'+path.resolve(APP)); await unskip(p);
  const main=fs.readdirSync('fixtures').filter(f=>/^f1473588/.test(f)).map(f=>path.resolve('fixtures',f));
  await p.setInputFiles('#file', main); await p.waitForTimeout(500);
  const tmps=[]; { const src=main.find(f=>f.includes('7T3A')); const dst=path.resolve('fixtures','tmp_'+path.basename(src).replace('7T3A','7T4A')); fs.copyFileSync(src,dst); tmps.push(dst);} await p.setInputFiles('#file',tmps); await p.waitForTimeout(500); tmps.forEach(f=>fs.unlinkSync(f));
  for(const k of ['1205050-7T1A','1205050-7T3A','1205050-7T4A']){ await p.click('[data-k="'+k+'"]'); await p.waitForTimeout(100); await p.click('#rpSkip'); await p.waitForTimeout(100); }
  // 1. assignment is per course: unassign Unit 1 in 7T3A → 7T4A also unassigned; 7T1A (acc) untouched
  await p.click('[data-k="1205050-7T3A"]'); await p.waitForTimeout(150); await p.click('th.unit .ulink'); await p.waitForTimeout(200);
  check((await p.textContent('#hideUnit')).includes('Assigned'),'unit shows Assigned');
  await p.click('#hideUnit'); await p.waitForTimeout(250);
  const a=await p.evaluate(()=>{const T=window.__tally; const u=k=>T.unitsOf(T.state.sections[k])[0]; return [u('1205050-7T3A').assigned,u('1205050-7T4A').assigned,u('1205050-7T1A').assigned, T.state.assigned.on];});
  check(a[0]===false && a[1]===false && a[2]===true,'unassigning applies to every on-level class, not accelerated: '+JSON.stringify(a.slice(0,3)));
  await p.click('#hideUnit'); await p.waitForTimeout(250);
  // race: completion headline over assigned units
  const d=await p.evaluate(()=>window.__tally.leaderboardData().map(r=>({n:r.label,c:+r.completion.toFixed(3),poss:r.possible,units:r.assignedUnits.length,rank:r.rank})));
  console.log(JSON.stringify(d));
  check(d.every(r=>r.poss>0 && r.units>0) && d.every(r=>r.rank>=1),'race data: completion over assigned units');
  await p.click('#btnLb'); await p.waitForTimeout(400); const lbt=await p.textContent('#lb');
  check(/% complete/.test(lbt) && /assigned:/.test(lbt) && /of [\d,]+ skill-points · \d+ students/.test(await p.getAttribute('.lbBarRow','title')),'race shows % complete and the assigned units; the skill-point detail is the bar\'s tooltip');
  await p.screenshot({path:path.join(tmp,'shot19.png')}); await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700); await p.click('#btnHide'); await p.waitForTimeout(150);
  // 2. per-student skip: tap a cell
  await p.click('[data-k="1205050-7T1A"]'); await p.waitForTimeout(150); await p.click('th.unit .ulink'); await p.waitForTimeout(250);
  const tots=()=>p.evaluate(()=>{const T=window.__tally; const s=T.state.sections['1205050-7T1A']; const u=T.unitsOf(s)[0]; return s.students.map((_,i)=>T.totalFor(s,u,i));}); const before=await tots();
  await p.click('tbody tr:first-child td.sc[data-cell]'); await p.waitForTimeout(300);
  const after=await tots();
  check(before.every(x=>x===23) && after.filter(x=>x===22).length===1 && after.filter(x=>x===23).length===22,'tapping a cell skips that skill for that student only');
  check(await p.locator('td.sc.own').count()===1,'per-student skip cell hatched');
  check(/\/22/.test(await p.textContent('tbody tr:first-child td.ptsd')),'student points show own out-of');
  // copy notes modified list, raw points (no scaling)
  await p.click('#copyUnit'); await p.waitForTimeout(300); check(/1 student on a modified list/.test(await p.textContent('#toast')),'copy toast flags the modified list');
  // names mode shows own out-of
  await p.click('#btnSettings'); await p.click('[data-cm="names"]'); await p.click('#mSave'); await p.waitForTimeout(200);
  await p.click('#copyUnit'); await p.waitForTimeout(300); const clip=await p.evaluate(()=>navigator.clipboard.readText());
  check(/\t\/22$/m.test(clip) && clip.split('\n').filter(l=>/\t\//.test(l)).length===1,'name mode appends /22 only for the modified student');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // 3. ID copy + CSV
  const roster=fs.readFileSync('fixtures/roster.txt','utf8').split('\n').map((l,i)=>`${100000+i}\t${l}`).join('\n');
  await p.click('#btnSettings'); await p.fill('#roster', roster); await p.click('[data-cm="ids"]'); await p.click('#mSave'); await p.waitForTimeout(300);
  await p.click('th.unit .copy'); await p.waitForTimeout(300); const clip2=await p.evaluate(()=>navigator.clipboard.readText());
  check(/^100000\t\d+/.test(clip2),'ID ⇥ points copy: '+clip2.split('\n')[0]);
  await p.click('th.unit .ulink'); await p.waitForTimeout(250);
  const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#csvUnit')]); const csv=fs.readFileSync(await dl.path(),'utf8');
  check(/"Student ID","Student","IXL Unit 1","Out of","Goal","Export date"/.test(csv) && /"100000","Nguyen, Ava","\d+","2[23]","67","2026-09-25"/.test(csv),'CSV keyed by ID with out-of and goal');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // 4. still owed page (popup) with initials
  await p.click('#printOwed'); await p.waitForTimeout(200); check(await p.locator('[data-owed]').count()===3,'Still owed offers slips / initials list / names list (no confirm())');
  const [pop]=await Promise.all([ctx.waitForEvent('page'), p.click('[data-owed="initials"]')]); await pop.waitForLoadState(); await pop.waitForTimeout(300);
  const txt=await pop.textContent('body');
  check(/Still owed/.test(txt) && /Below goal \(67\)/.test(txt) && /A\. N\./.test(txt) && !/Nguyen/.test(txt),'still-owed page: initials, below-goal lists');
  check(/Not matched to an IXL account/.test(txt) || !/not matched/.test(txt),'unmatched roster students are listed, not dropped');
  const bw=await pop.evaluate(()=>{const cs=getComputedStyle(document.body); return cs.color+'|'+cs.backgroundColor;}); check(bw==='rgb(0, 0, 0)|rgb(255, 255, 255)','black on white');
  await pop.screenshot({path:path.join(tmp,'shot20.png'), fullPage:false}); await pop.close();
  await p.click('#printOwed'); await p.waitForTimeout(200); const [pop2]=await Promise.all([ctx.waitForEvent('page'), p.click('[data-owed="slips"]')]); await pop2.waitForLoadState(); await pop2.waitForTimeout(300);
  check(/Nguyen, Ava/.test(await pop2.textContent('body')) && await pop2.evaluate(()=>getComputedStyle(document.querySelectorAll('.stu')[1]).breakBefore==='page'),'slips: full names, one page per student'); await pop2.close();
  // 5. custom data set
  await p.click('#btnSettings'); await p.click('#addCustom'); await p.waitForTimeout(200);
  await p.fill('#cLabel','Minutes to school'); await p.fill('#cUnit','minutes');
  const tas=p.locator('.cVals'); const n=await tas.count(); check(n===1,'editor lists the one accelerated class: '+n);
  await tas.first().fill('5, 10 12 8 30 15 7 22 9 11'); await p.click('#cSave'); await p.waitForTimeout(300);
  await p.click('#btnLb'); await p.waitForTimeout(300); await p.click('[data-tab="lab"]'); await p.waitForTimeout(300);
  const opt=await p.evaluate(()=>[...document.querySelectorAll('#labUnit optgroup')].map(g=>g.label));
  check(opt.includes('Our own data'),'custom group in dropdown');
  const cid=await p.evaluate(()=>window.__tally.state.custom[0].id); await p.selectOption('#labUnit','custom:'+cid); await p.waitForTimeout(400);
  check(await p.locator('.labRow').count()===1 && /minutes per student/.test(await p.textContent('.lbSub')),'custom data plots with its unit');
  await p.click('#labStats'); await p.waitForTimeout(200); check(/median/.test(await p.textContent('.labStats')),'stats on custom data');
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700); await p.click('#btnHide');
  // 6. course settings export/import
  await p.click('[data-k="1205050-7T3A"]'); await p.waitForTimeout(150); await p.click('th.unit .ulink'); await p.waitForTimeout(200); await p.click('th.skill button'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('#btnSettings'); await p.fill('#thr','55'); await p.click('#mSave'); await p.waitForTimeout(200);
  await p.click('#btnSettings'); const [dl2]=await Promise.all([p.waitForEvent('download'), p.click('#exportCourse')]); const course=JSON.parse(fs.readFileSync(await dl2.path(),'utf8')); await p.click('#mCancel');
  check(course.tally==='course' && course.prep==='on' && course.goal===55 && course.skipped.length===1 && !JSON.stringify(course).includes('Nguyen'),'course file: goal, skipped skill, no names');
  fs.writeFileSync('/tmp/course.json', JSON.stringify(course));
  await p.click('[data-k="1205050-7T4A"]'); await p.waitForTimeout(150); await p.click('#btnSettings'); await p.setInputFiles('#courseFile','/tmp/course.json'); await p.waitForTimeout(400);
  const applied=await p.evaluate(()=>{const s=window.__tally.state.sections['1205050-7T4A']; return [s.threshold, Object.keys(s.excluded).length];});
  check(applied[0]===55 && applied[1]===1,'course settings applied to the other on-level class: '+applied);
  // backup roundtrip carries studentSkips + assigned + custom
  await p.click('[data-k="1205050-7T1A"]'); await p.waitForTimeout(150); await p.click('#btnSettings'); const [dl3]=await Promise.all([p.waitForEvent('download'), p.click('#exportCfg')]); const bk=JSON.parse(fs.readFileSync(await dl3.path(),'utf8')); await p.click('#mCancel');
  check(bk.custom.length===1 && Object.keys(bk.sections['1205050-7T1A'].studentSkips).length===1 && bk.assigned.on,'backup carries custom sets, student skips, assignment marks');
  await p.reload(); await p.waitForTimeout(500); check((await p.evaluate(()=>Object.keys(window.__tally.state.sections['1205050-7T1A'].studentSkips).length))===1,'student skips persist');
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
