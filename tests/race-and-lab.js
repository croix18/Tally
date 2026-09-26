const { chromium, fs, path, exe, check, done, tmp, need } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900},hasTouch:true}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog', d=>d.accept());
  await p.goto('file://'+path.resolve('Tally.html'));
  const old=fs.readdirSync('fixtures').filter(f=>f.startsWith('old_')).map(f=>path.resolve('fixtures',f));
  const main=fs.readdirSync('fixtures').filter(f=>/^f1473588/.test(f)).map(f=>path.resolve('fixtures',f));
  await p.setInputFiles('#file', old); await p.waitForTimeout(400);
  await p.setInputFiles('#file', main); await p.waitForTimeout(600);
  const tmps=[]; for(const [a,b] of [['7T3A','7T4A'],['7T3A','7T5A'],['7T1A','7T2A']]){ const src=main.find(f=>f.includes(a)); const dst=path.resolve('fixtures','tmp_'+path.basename(src).replace(a,b)); fs.copyFileSync(src,dst); tmps.push(dst);} await p.setInputFiles('#file',tmps); await p.waitForTimeout(800); tmps.forEach(f=>fs.unlinkSync(f));
  for(const k of ['1205050-7T2A','1205050-7T4A','1205050-7T5A']){ await p.click('[data-k="'+k+'"]'); await p.waitForTimeout(120); await p.click('#rpSkip'); await p.waitForTimeout(120); }
  await p.click('[data-k="1205050-7T2A"]'); await p.click('#btnSettings'); await p.click('[data-prep="on"]'); await p.fill('#secLabel','2nd Period'); await p.click('#mSave'); await p.waitForTimeout(200);
  const hist=await p.evaluate(()=>window.__tally.state.sections['1205050-7T1A'].history.map(h=>[h.date,Object.keys(h.per).length]));
  check(hist.length===2 && hist[0][0]==='2026-09-01' && hist[1][0]==='2026-09-25','two snapshots kept: '+JSON.stringify(hist));
  // team names
  await p.click('[data-k="1205050-7T1A"]'); await p.waitForTimeout(150); await p.click('#rpSkip'); await p.waitForTimeout(150);
  await p.click('#btnSettings'); await p.fill('#secLabel','The Integers'); await p.click('#mSave'); await p.waitForTimeout(200);
  await p.click('[data-k="1205050-7T3A"]'); await p.waitForTimeout(150); await p.click('#rpSkip'); await p.waitForTimeout(150);
  await p.click('#btnSettings'); await p.fill('#secLabel','Fraction Action'); await p.click('#mSave'); await p.waitForTimeout(200);
  const data=await p.evaluate(()=>window.__tally.leaderboardData());
  console.log(JSON.stringify(data.map(r=>({n:r.name,rank:r.rank,c:+r.completion.toFixed(3),gain:r.gain,active:r.active,assigned:r.assignedSkills})),null,0));
  check(data.length===5 && data.filter(r=>r.prep==='acc').length===1 && data.filter(r=>r.prep==='on').map(r=>r.rank).sort().join()=='1,2,2,2' && data.every(r=>r.completion>=0 && r.completion<=1),'five classes; identical clones share rank 2; ranked on completion');
  const t1=data.find(r=>r.label==='The Integers'||r.label.includes('7T1A')); check(t1.gain>0 && t1.active>0.5 && !t1.thrChanged,'gain vs older snapshot computed');
  // open leaderboard
  await p.click('#btnLb'); await p.waitForTimeout(1500);
  check(await p.locator('#lb.hidden').count()===0 && await p.locator('.lbCard').count()===5 && await p.locator('.lbLeagueName').count()===2,'leaderboard shows 5 cards in 2 leagues');
  const txt=await p.textContent('#lb'); check(!/Nguyen|Smith|Garcia/.test(txt),'no student names on leaderboard');
  check(await p.evaluate(()=>getComputedStyle(document.querySelector('#top')).visibility)==='hidden','teacher UI hidden behind leaderboard');
  check((await p.evaluate(()=>window.__tally.state.settings.hideNames))===true,'entering projected mode forces Hide names');
  check(await p.locator('.lbTie').count()===3 && await p.locator('.trophy').count()===1,'tied classes labelled; trophy only for a clear leader in a multi-class league');
  check(await p.locator('#lbDownload').count()===0,'no Save button on the student screen');
  await p.screenshot({path:path.join(tmp,'shot12.png')});
  // hold to exit: short tap does nothing, long hold exits
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(300); await p.locator('#lbExit').dispatchEvent('pointerup'); await p.waitForTimeout(200);
  check(await p.locator('#lb.hidden').count()===0,'short tap does not exit');
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700);
  check(await p.locator('#lb.hidden').count()===1,'hold exits');
  check(/^[A-Z]\. [A-Z]\.$/.test((await p.textContent('tbody td.stu .nm')).trim()),'after exit the grid shows initials, not names');
  await p.click('#btnHide'); await p.waitForTimeout(150);
  await p.click('#btnLb'); await p.waitForTimeout(300); await p.click('[data-focus="on"]'); await p.waitForTimeout(300);
  check(await p.locator('.lbCard').count()===4 && await p.locator('.lbLeagueName').count()===0,'focus On-level shows only that league');
  await p.click('[data-focus="both"]'); await p.waitForTimeout(200);
  // Data Lab
  await p.click('[data-tab="lab"]'); await p.waitForTimeout(400);
  check(await p.locator('.labRow').count()>=1 && await p.locator('.labSvg').count()>=1,'data lab renders box plots');
  check(await p.locator('.labStats').count()===0,'stats hidden by default');
  check(await p.locator('.labOut').count()===0 && !/outlier/.test(await p.textContent('.labLegend')),'no outlier circles or legend in min–max mode');
  const labTxt=await p.textContent('#lb'); check(!/Nguyen|Smith|Garcia/.test(labTxt),'no names in data lab');
  await p.click('#labStats'); await p.waitForTimeout(300); check(await p.locator('.labStats').count()>=1 && /median/.test(await p.textContent('.labStats')) && /mode/i.test(await p.textContent('.labStats')) && !/mean/i.test(await p.textContent('.labStats')) && await p.locator('.labMean').count()===0,'reveal step 1: five-number summary + mode, no mean diamond yet');
  await p.click('#labStats'); await p.waitForTimeout(300); check(/mean/i.test(await p.textContent('.labStats')) && /shape/i.test(await p.textContent('.labStats')) && await p.locator('.labMean').count()>0 && !/mean (above|below) median/.test(await p.textContent('.labStats')),'reveal step 2: mean diamond appears, shape described from the picture');
  await p.click('#labTukey'); await p.waitForTimeout(300); check(/outliers/i.test(await p.textContent('.labStats')) && /outlier/.test(await p.textContent('.labLegend')),'outliers appear only with the toggle'); await p.click('#labTukey'); await p.waitForTimeout(200);
  await p.click('[data-prep="on"]'); await p.waitForTimeout(300); check(await p.locator('.labRow').count()===4,'on-level lab shows 4 classes');
  await p.selectOption('#labUnit','unit:__all__'); await p.waitForTimeout(300); check(/All units/.test(await p.textContent('.lbSub')),'dataset switch');
  await p.screenshot({path:path.join(tmp,'shot14.png')}); await p.selectOption('#labUnit', await p.evaluate(()=>document.querySelector('#labUnit option').value)); await p.waitForTimeout(300); await p.screenshot({path:path.join(tmp,'shot15.png')});
  const allScale=await p.textContent('.lbSub'); check(!/0–2\d\d/.test(allScale),'all-skills scale from data, not 220: '+allScale.slice(-14));
  await p.click('[data-tab="race"]'); await p.waitForTimeout(200);
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700);
  // persistence of leaderboard mode across reload
  await p.click('#btnLb'); await p.waitForTimeout(200); await p.reload(); await p.waitForTimeout(600);
  check(await p.locator('#lb.hidden').count()===0,'leaderboard survives reload (panel-safe)');
  // standalone download
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700);
  await p.click('#btnSettings'); const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#saveRace')]); const fp=await dl.path(); const html=fs.readFileSync(fp,'utf8'); await p.click('#mCancel'); await p.waitForTimeout(200);
  await p.click('#btnLb'); await p.waitForTimeout(300);
  check(/Race/.test(html) && !/Nguyen|Smith|Garcia|localStorage/.test(html) && /The Integers/.test(html),'standalone page has no names, has class names');
  fs.copyFileSync(fp,path.join(tmp,'race.html')); const p2=await ctx.newPage(); await p2.goto('file://'+path.join(tmp,'race.html')); await p2.waitForTimeout(1500); await p2.screenshot({path:path.join(tmp,'shot13.png')}); await p2.close();
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1700);
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
