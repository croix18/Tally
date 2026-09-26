// Export age + reminder, Data Lab values, receipt viewer, guide, header button kinds
const { chromium, fs, path, exe, check, done, tmp, need } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900}}); await ctx.grantPermissions(['clipboard-read','clipboard-write']); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve('Tally.html'));
  check(await p.locator('#btnGuide').isVisible(),'Guide is available before anything is imported');
  // --- reminder: an export from 2026-09-01 is old; default reminder is 7 days
  const old=fs.readdirSync('fixtures').filter(f=>f.startsWith('old_')).map(f=>path.resolve('fixtures',f));
  await p.setInputFiles('#file', old); await p.waitForTimeout(500); await p.click('#rpSkip'); await p.waitForTimeout(300);
  const age=await p.evaluate(()=>window.__tally.ageDays('2026-09-01'));
  check(age>=20,'ageDays counts calendar days: '+age);
  check(await p.evaluate(()=>window.__tally.ageText(new Date().toISOString().slice(0,10)))==='today','ageText: today');
  let notices=await p.textContent('#notices');
  check(/IXL export is \d+ days old/.test(notices) && /reminded after 7 days/.test(notices),'old export raises the reminder notice');
  check(await p.locator('.tab .age').count()===1,'class chip shows the age instead of the date when overdue');
  check(/\(\d+ (days|weeks) ago\)/.test(await p.textContent('#bar')),'bar shows how old the export is');
  await p.screenshot({path:path.join(tmp,'shot25.png')});
  // turn the reminder off → notice gone; 30 days → still fine for a 25-day-old file
  await p.click('#btnSettings'); await p.click('[data-remind="0"]'); await p.click('#mSave'); await p.waitForTimeout(300);
  check(!/days old/.test(await p.textContent('#notices')) && await p.locator('.tab .age').count()===0,'reminder Off silences the notice');
  await p.click('#btnSettings'); await p.click('[data-remind="30"]'); await p.click('#mSave'); await p.waitForTimeout(300);
  check(!/days old/.test(await p.textContent('#notices')),'30-day reminder does not fire for a 25-day-old export');
  await p.click('#btnSettings'); await p.click('[data-remind="7"]'); await p.click('#mSave'); await p.waitForTimeout(300);
  // a fresh export replaces it → notice gone
  const main=fs.readdirSync('fixtures').filter(f=>/^f1473588.*7T1A/.test(f)).map(f=>path.resolve('fixtures',f));
  await p.setInputFiles('#file', main); await p.waitForTimeout(600);
  check(!/days old/.test(await p.textContent('#notices')),'importing a fresh export clears the reminder');
  // the notice's Import button opens the picker
  // --- receipt viewer
  const ui=await p.evaluate(()=>window.__tally.unitsOf(Object.values(window.__tally.state.sections)[0]).findIndex(u=>u.total>0));
  await p.click(`.copy[data-c="${ui}"]`); await p.waitForTimeout(300);
  check(await p.locator('.rlink').count()===1,'unit header shows a "copied" link after Copy');
  await p.click('.rlink'); await p.waitForTimeout(300);
  let txt=await p.textContent('#modal');
  check(/Copied · Unit/.test(txt) && /Nobody has moved up since/.test(txt) && await p.locator('.checkTable tbody tr').count()>10,'receipt panel lists every copied row with copied vs now');
  await p.screenshot({path:path.join(tmp,'shot26.png')});
  // simulate movement: lower one copied value → shows "up N"
  await p.evaluate(()=>{const s=Object.values(window.__tally.state.sections)[0]; const rc=Object.values(s.receipts)[0]; const r=rc.rows.find(x=>x[1]>0); r[1]=r[1]-1;});
  await p.click('#mCancel'); await p.waitForTimeout(200); await p.click('.rlink'); await p.waitForTimeout(300);
  txt=await p.textContent('#modal'); check(/1 student up since/.test(txt) && /up 1/.test(txt),'a student who gained since the copy reads as "up 1"');
  await p.click('#rcCopy'); await p.waitForTimeout(400);
  const clip=await p.evaluate(()=>navigator.clipboard.readText()); check(clip.split('\n').length>10,'"Copy again" copies the column: '+clip.split('\n').length+' rows');
  await p.click('.rlink'); await p.waitForTimeout(300); check(/Nobody has moved up since/.test(await p.textContent('#modal')),'fresh receipt after copying again'); await p.click('#mCancel'); await p.waitForTimeout(200);
  // unit detail bar shows the receipt too
  await p.click(`.ulink[data-u="${ui}"]`); await p.waitForTimeout(300); check(await p.locator('#rcUnit').count()===1,'unit view bar shows "Copied ‹date›"'); await p.click('#back'); await p.waitForTimeout(200);
  // --- Data Lab values
  await p.click('#btnLb'); await p.waitForTimeout(600); await p.click('[data-tab="lab"]'); await p.waitForTimeout(500);
  check(await p.locator('.labValues').count()===0,'values are hidden by default');
  await p.click('#labValues'); await p.waitForTimeout(500);
  const nv=await p.locator('.labValues').count(); check(nv>=1,'Values shows the sorted list under each plot');
  const vs=await p.evaluate(()=>{const row=document.querySelector('.labRow'); const chips=[...row.querySelectorAll('.labChips span:not(.gap)')].map(x=>+x.textContent); const st=window.__tally.labSeries(window.__tally.state.settings.labPrep, window.__tally.state.settings.labUnit)[0].st; return {chips, values:st.values, q1:st.q1, q3:st.q3, med:st.median, qChips:[...row.querySelectorAll('.labChips span.q')].map(x=>+x.textContent), mChips:[...row.querySelectorAll('.labChips span.m')].map(x=>+x.textContent)};});
  check(JSON.stringify(vs.chips)===JSON.stringify(vs.values),'chips are exactly the sorted values');
  check(vs.qChips.length>=2 && vs.mChips.length===1 && Math.abs(vs.mChips[0]-vs.med)<0.01,'median highlighted; a Q1 and Q3 chip highlighted in each half');
  await p.screenshot({path:path.join(tmp,'shot27.png')});
  // saved Data Lab page carries the values
  const [dl]=await Promise.all([p.waitForEvent('download'), p.evaluate(()=>{ window.__tally.state.settings.leaderboard=false; window.__tally.render(); document.querySelector('#btnSettings').click(); setTimeout(()=>document.querySelector('#saveLab').click(),100); })]);
  const saved=fs.readFileSync(await dl.path(),'utf8'); check(/labValues/.test(saved) && /labChips/.test(saved),'saved Data Lab page includes the values');
  await p.click('#mCancel'); await p.waitForTimeout(200);
  // --- guide
  const [pop]=await Promise.all([ctx.waitForEvent('page'), p.click('#btnGuide')]); await pop.waitForLoadState(); await pop.waitForTimeout(300);
  const g=await pop.textContent('body'); check(/Every week or two/.test(g) && /Words on the screen/.test(g) && /co-teacher/i.test(g) && /accelerated 67/.test(g),'guide opens with the weekly flow, glossary, co-teacher section and the live goals');
  await pop.emulateMedia({media:'print'}); await pop.screenshot({path:path.join(tmp,'shot28.png'),fullPage:true}); await pop.close();
  // --- header: every secondary action is a ghost; Import is the one filled button
  const kinds=await p.evaluate(()=>[...document.querySelectorAll('#top button')].filter(b=>!b.classList.contains('hidden')).map(b=>b.id+':'+(b.classList.contains('ghost')?'ghost':'primary')));
  check(kinds.filter(k=>k.endsWith('primary')).length===1 && kinds.find(k=>k.startsWith('btnImport')).endsWith('primary'),'one primary button in the header: '+kinds.join(' '));
  await p.screenshot({path:path.join(tmp,'shot29.png')});
  // backup carries the reminder
  const [dl2]=await Promise.all([p.waitForEvent('download'), p.evaluate(()=>{ document.querySelector('#btnSettings').click(); setTimeout(()=>document.querySelector('#exportCfg').click(),100); })]);
  const cfg=JSON.parse(fs.readFileSync(await dl2.path(),'utf8')); check(cfg.settings.remindDays===7,'backup keeps the reminder setting');
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
