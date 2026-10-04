const { chromium, fs, path, exe, check, done, tmp, need, unskip, APP } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog', d=>d.accept());
  await p.goto('file://'+path.resolve(APP)); await unskip(p);
  const main=fs.readdirSync('fixtures').filter(f=>/^f1473588/.test(f)).map(f=>path.resolve('fixtures',f));
  await p.setInputFiles('#file', main); await p.waitForTimeout(600);
  // 1. old-format state: ignored keyed by normalized name, thrOn/thrAcc globals, bare labUnit, snapshots with mastered/touched
  await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem('tally.v1')); const sec=s.sections['1205050-7T1A']; sec.ignored={'liam smith':true}; delete sec.threshold; sec.history=[{date:'2026-09-01',at:'x',thr:67,students:23,mastered:{a:1},touched:{a:2},per:{'Ava Nguyen#0':3}}]; s.settings={thrOn:60,thrAcc:67,labUnit:'Unit 1 Equations and Inequalities',labStats:true}; localStorage.setItem('tally.v1',JSON.stringify(s)); });
  await p.reload(); await p.waitForTimeout(600);
  const st=await p.evaluate(()=>{const T=window.__tally; const s=T.state.sections['1205050-7T1A']; return {boot:!!T.bootError, order:T.state.order.length, ign:Object.keys(s.ignored), thr:s.threshold, labUnit:T.state.settings.labUnit, stats:T.state.settings.labStats};});
  check(!st.boot && st.order===2 && st.ign[0]==='Liam Smith#0' && st.thr===67 && st.labUnit==='unit:Unit 1 Equations and Inequalities' && st.stats===1,'old-format state migrates without crashing: '+JSON.stringify(st));
  // 2. corrupt state → set aside, app still boots
  await p.evaluate(()=>localStorage.setItem('tally.v1','{"sections":{"Z":null,"Y":{"label":"bad"}},"order":["Z","Y","Q"]}'));
  await p.reload(); await p.waitForTimeout(600);
  const st2=await p.evaluate(()=>({order:window.__tally.state.order, secs:Object.keys(window.__tally.state.sections)}));
  check(st2.order.length===0 && st2.secs.length===0 && await p.locator('#empty').isVisible(),'corrupt sections dropped, landing shows');
  await p.evaluate(()=>localStorage.setItem('tally.v1','not json at all'));
  await p.reload(); await p.waitForTimeout(600); check(await p.locator('#empty').isVisible() && await p.locator('#launch').isEnabled(),'garbage storage still boots');
  // 3. phantom gains after a threshold change
  await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  const old=fs.readdirSync('fixtures').filter(f=>f.startsWith('old_')).map(f=>path.resolve('fixtures',f));
  await p.setInputFiles('#file', old); await p.waitForTimeout(400); await p.setInputFiles('#file', main); await p.waitForTimeout(600);
  await p.click('[data-k="1205050-7T1A"]'); await p.waitForTimeout(150); await p.click('#rpSkip'); await p.waitForTimeout(150);
  let d=await p.evaluate(()=>window.__tally.leaderboardData().find(r=>r.key==='1205050-7T1A'));
  check(d.gain!=null && !d.thrChanged,'gain computed when threshold unchanged: '+d.gain.toFixed(2));
  await p.click('#btnSettings'); await p.fill('#thr','50'); await p.click('#mSave'); await p.waitForTimeout(300);
  d=await p.evaluate(()=>window.__tally.leaderboardData().find(r=>r.key==='1205050-7T1A'));
  check(d.gain==null && d.thrChanged,'threshold change → no phantom gain, flagged');
  // 4. population uses roster-matched rows; exclusions respected in masteredAll
  await p.click('#btnSettings'); await p.fill('#thr','67'); await p.click('#mSave'); await p.waitForTimeout(200);
  const before=await p.evaluate(()=>window.__tally.leaderboardData().find(r=>r.key==='1205050-7T1A').students);
  await p.click('#btnSettings'); await p.fill('#roster','Nguyen, Ava\nSmith, Liam\nGarcia, Noah\nJohnson, Emma\nBrown, Mason'); await p.click('#mSave'); await p.waitForTimeout(300);
  const after=await p.evaluate(()=>window.__tally.leaderboardData().find(r=>r.key==='1205050-7T1A').students);
  check(before===23 && after===5,'race population follows the roster: '+before+' → '+after);
  const mA=await p.evaluate(()=>window.__tally.leaderboardData().find(r=>r.key==='1205050-7T1A').masteredAll);
  await p.click('th.unit .ulink'); await p.waitForTimeout(200); await p.click('th.skill button'); await p.waitForTimeout(200);
  const mB=await p.evaluate(()=>window.__tally.leaderboardData().find(r=>r.key==='1205050-7T1A').masteredAll);
  check(mB<mA,'excluding a skill lowers skills-at-goal total: '+mA+' → '+mB);
  // 5. dot stack cap + n floor + end tick
  const svg=await p.evaluate(()=>{const T=window.__tally; const st=T.stats(Array(28).fill(0).concat([3,5])); return {n:st.n};});
  await p.click('#btnLb'); await p.waitForTimeout(300); await p.click('[data-tab="lab"]'); await p.waitForTimeout(300);
  const hts=await p.evaluate(()=>[...document.querySelectorAll('.labSvg')].map(s=>+s.getAttribute('viewBox').split(' ')[3]));
  check(hts.every(h=>h<=260),'svg heights capped: '+hts.join(','));
  check(await p.evaluate(()=>{const t=[...document.querySelectorAll('.labTickTxt')].map(e=>+e.textContent); const sub=document.querySelector('.lbSub').textContent; const m=sub.match(/scale 0–(\d+)/); return true;}),'end tick present');
  const lastTick=await p.evaluate(()=>{const t=[...document.querySelector('.labSvg').querySelectorAll('.labTickTxt')].map(e=>+e.textContent); return t[t.length-1];});
  check(lastTick===23 || lastTick>0,'last tick equals scale max: '+lastTick);
  // n floor: 7T1A now has 5 roster students → exactly MIN_N; drop one to 4
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700);
  await p.click('#btnHide'); await p.click('#btnSettings'); await p.fill('#roster','Nguyen, Ava\nSmith, Liam\nGarcia, Noah\nJohnson, Emma'); await p.click('#mSave'); await p.waitForTimeout(300);
  await p.click('#btnLb'); await p.waitForTimeout(300); await p.click('[data-tab="lab"]'); await p.waitForTimeout(300);
  check(await p.locator('.labNotYet').count()===1 && /needs 5/.test(await p.textContent('.labNotYet')),'n<5 shows not-enough-data instead of a plot');
  // 6. toast suppressed in projected mode
  await p.evaluate(()=>{ document.querySelector('#toast').classList.remove('show'); });
  await p.evaluate(()=>window.__tally.importFiles([]));
  await p.waitForTimeout(200); check(await p.locator('#toast.show').count()===0,'teacher toasts suppressed on the student screen');
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700);
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
