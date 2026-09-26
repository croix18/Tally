const { chromium } = require('playwright'); const fs=require('fs'); const path=require('path');
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : require('child_process').execSync('ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome | head -1').toString().trim();
let fails=0; const check=(c,msg)=>{ console.log((c?'PASS ':'FAIL ')+msg); if(!c) fails++; };
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900}});
  await ctx.grantPermissions(['clipboard-read','clipboard-write']);
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error' && !/ERR_TUNNEL|fonts/.test(m.text())) errs.push(m.text()); });
  p.on('dialog', async d=>{ dialogs.push(d.message()); await (dialogAnswer? d.accept(): d.dismiss()); });
  let dialogs=[], dialogAnswer=true;
  await p.goto('file://'+path.resolve('Tally.html'));
  const files=fs.readdirSync('fixtures').filter(f=>f.endsWith('.xlsx') && !f.startsWith('old_')).map(f=>path.resolve('fixtures',f));
  await p.setInputFiles('#file', files); await p.waitForTimeout(600);
  check((await p.evaluate(()=>window.__tally.state.order.length))===2,'two sections imported');
  // no double scroll
  const sh=await p.evaluate(()=>[document.documentElement.scrollHeight, window.innerHeight, document.body.scrollHeight]);
  check(sh[0]<=sh[1],'no page-level scroll: '+sh);
  // roster with ID column first
  await p.click('[data-k="1205050-7T1A"]');
  const roster=fs.readFileSync('fixtures/roster.txt','utf8').split('\n').map((l,i)=>`${100000+i}\t${l}\t7T1A`).join('\n');
  await p.click('#btnSettings'); await p.fill('#roster', roster); await p.waitForTimeout(150);
  let rep=await p.textContent('#matchReport'); check(/22 of 24/.test(rep),'ID-first roster parsed: '+rep.slice(0,60));
  // garbage roster
  await p.fill('#roster', '12345\n67890\n'); await p.waitForTimeout(100); rep=await p.textContent('#matchReport'); check(/Couldn't read any names/.test(rep),'unreadable roster flagged');
  // alias
  await p.fill('#roster', roster); await p.click('#mSave'); await p.waitForTimeout(300);
  // ignore IXL-only student via flag, then un-ignore in settings
  dialogs=[]; dialogAnswer=true; await p.click('button.flag[data-ignore]'); await p.waitForTimeout(250);
  check(await p.locator('button.flag[data-ignore]').count()===0,'ignored IXL-only student hidden');
  await p.click('#btnSettings'); check(/Ignored IXL students/.test(await p.textContent('#matchReport')),'ignored listed in settings');
  await p.click('#matchReport [data-unign]'); await p.waitForTimeout(100); check(!/Ignored IXL students/.test(await p.textContent('#matchReport')),'un-ignore works');
  await p.fill('#roster', roster+'\nHarris, A = Aiden Harris'); await p.waitForTimeout(100); rep=await p.textContent('#matchReport'); check(/23 of 25/.test(rep) && !/Aiden Harris <|In IXL but not on roster/.test(rep),'alias pins Aiden Harris: '+rep.slice(0,40));
  await p.click('#mSave'); await p.waitForTimeout(300);
  // loose match notice
  check(await p.locator('.notice.soft').count()===1,'loose-match notice shown');
  check(/Taylor, Ben → Benjamin Taylor/.test(await p.textContent('.notice.soft')),'loose list names Ben Taylor');
  // search does not change class average; # stays unfiltered
  const avgBefore=await p.evaluate(()=>document.querySelector('tfoot td:nth-child(3)').textContent);
  await p.fill('#search','Nguyen'); await p.waitForTimeout(150);
  const avgAfter=await p.evaluate(()=>document.querySelector('tfoot td:nth-child(3)').textContent);
  check(avgBefore===avgAfter,'class average unchanged under search '+avgBefore+' '+avgAfter);
  check((await p.textContent('tbody td.idx'))==='1','# keeps roster position');
  await p.fill('#search','zzzz'); await p.waitForTimeout(150); check(await p.locator('tr.nomatch').count()===1,'no-match row');
  await p.click('[data-k="1205050-7T3A"]'); await p.waitForTimeout(150); check((await p.inputValue('#search'))==='' && await p.locator('tbody tr').count()>5,'search cleared on tab switch');
  await p.click('[data-k="1205050-7T1A"]'); await p.waitForTimeout(150);
  // untouched units hidden by default + toggle
  const unitsShown=await p.locator('th.unit').count(); check(unitsShown<17,'untouched units hidden: '+unitsShown);
  await p.click('#toggleAll'); await p.waitForTimeout(150); check(await p.locator('th.unit').count()===17,'toggle shows all 17'); await p.click('#toggleAll'); await p.waitForTimeout(150);
  // copy all-zero unit -> confirm dialog
  dialogs=[]; dialogAnswer=false;
  await p.click('#toggleAll'); await p.waitForTimeout(150);
  await p.locator('th.unit.quiet .copy').first().click(); await p.waitForTimeout(200);
  check(dialogs.length===1 && /zeros/.test(dialogs[0]),'all-zero copy asks first: '+dialogs[0]);
  await p.click('#toggleAll'); await p.waitForTimeout(150);
  // copy unit 1 toast wording
  await p.click('th.unit .copy'); await p.waitForTimeout(250); const t=await p.textContent('#toast'); check(/Unit 1 copied — 25 rows in FOCUS order, points out of 23/.test(t),'toast: '+t);
  const clip=await p.evaluate(()=>navigator.clipboard.readText()); check(clip.split('\n').length===25 && clip.split('\n').filter(x=>x==='').length===2,'clipboard 25 lines, 2 blanks');
  // detail view: sticky points header z-index after scroll
  await p.click('th.unit .ulink'); await p.waitForTimeout(250);
  await p.evaluate(()=>document.querySelector('#gridwrap').scrollTop=300); await p.waitForTimeout(100);
  const over=await p.evaluate(()=>{const th=document.querySelector('thead th.ptsd'); const r=th.getBoundingClientRect(); const el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return el.closest('th')?.classList.contains('ptsd');});
  check(over===true,'points header stays on top after scroll');
  await p.evaluate(()=>document.querySelector('#gridwrap').scrollTop=0);
  // exclude a skill -> denominators
  const before=await p.textContent('tr.skills th.ptsd'); await p.click('th.skill button'); await p.waitForTimeout(250);
  const after=await p.textContent('tr.skills th.ptsd'); check(/of 23/.test(before)&&/of 22/.test(after),'exclude skill: '+before.replace(/\s+/g,' ')+' -> '+after.replace(/\s+/g,' '));
  check(await p.locator('th.skill.off').count()===1,'excluded header styled');
  await p.screenshot({path:'shot6.png'});
  // Esc closes modal only (not view)
  await p.click('#btnSettings'); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  check(await p.locator('#modal.hidden').count()===1 && await p.locator('#bar.detail').count()===1,'Esc closes modal, keeps detail view');
  // backdrop click with dirty roster asks
  await p.click('#btnSettings'); await p.fill('#roster','Zzz, Q'); dialogs=[]; dialogAnswer=false; await p.mouse.click(5,5); await p.waitForTimeout(150);
  check(dialogs.length===1 && await p.locator('#modal.hidden').count()===0,'dirty roster: backdrop asks and stays open');
  dialogAnswer=true; await p.keyboard.press('Escape'); await p.waitForTimeout(150); check(await p.locator('#modal.hidden').count()===1,'discard confirmed closes');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150); check(await p.locator('#bar.detail').count()===0,'second Esc pops view');
  // threshold blank keeps value, min 1
  await p.click('#btnSettings'); await p.fill('#thrAcc',''); await p.click('#mSave'); await p.waitForTimeout(150);
  check((await p.evaluate(()=>window.__tally.state.settings.thrAcc))===67,'blank threshold keeps 67');
  await p.click('#btnSettings'); await p.fill('#thrAcc','0'); await p.click('#mSave'); await p.waitForTimeout(150);
  check((await p.evaluate(()=>window.__tally.state.settings.thrAcc))===1,'threshold 0 clamps to 1');
  await p.click('#btnSettings'); await p.fill('#thrAcc','67'); await p.click('#mSave'); await p.waitForTimeout(150);
  // older export guard
  dialogs=[]; dialogAnswer=false; const old=fs.readdirSync('fixtures').filter(f=>f.startsWith('old_')).map(f=>path.resolve('fixtures',f));
  await p.setInputFiles('#file', old); await p.waitForTimeout(500);
  check(dialogs.length===1 && /older/.test(dialogs[0]),'older export asks: '+dialogs[0].slice(0,80));
  check((await p.evaluate(()=>window.__tally.state.sections['1205050-7T1A'].date))==='2026-09-25','declined: newer data kept');
  // hide names
  await p.click('#btnHide'); await p.waitForTimeout(150); const nm=await p.textContent('tbody td.stu .nm'); check(/^[A-Z]\. [A-Z]\.$/.test(nm.trim()),'hide names -> initials: '+nm); await p.click('#btnHide');
  // backup pending sections
  await p.click('#btnSettings');
  const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#exportCfg')]); const cfgPath=await dl.path(); const cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));
  check(cfg.sections['1205050-7T1A'].roster.length>10 && cfg.sections['1205050-7T1A'].excluded && Object.keys(cfg.sections['1205050-7T1A'].excluded).length===1,'backup has roster+exclusions');
  await p.click('#mCancel');
  // wipe, load backup first, then import -> roster restored
  await p.evaluate(()=>{localStorage.clear();}); await p.reload(); await p.waitForTimeout(300);
  await p.setInputFiles('#file', files.slice(0,1)); await p.waitForTimeout(400); // import one section so settings opens
  await p.click('#btnSettings'); await p.setInputFiles('#cfgFile', cfgPath); await p.waitForTimeout(300);
  const held=await p.evaluate(()=>Object.keys(window.__tally.state.pendingCfg)); check(held.length===1,'backup holds section not yet imported: '+held);
  await p.setInputFiles('#file', files.slice(1)); await p.waitForTimeout(400);
  const restored=await p.evaluate(()=>{const s=window.__tally.state.sections; return Object.values(s).map(x=>[x.label, x.roster.length>0, Object.keys(x.excluded).length]);});
  check(restored[0][1] && restored[0][2]===1 && (await p.evaluate(()=>Object.keys(window.__tally.state.pendingCfg).length))===0,'held config applied on import: '+JSON.stringify(restored));
  await p.click('[data-k="1205050-7T1A"]'); await p.waitForTimeout(200); await p.screenshot({path:'shot7.png'});
  // six sections layout
  const tmps=[]; for(let i=0;i<4;i++){ const src=files[1]; const dst=path.resolve('fixtures','tmp'+i+'_'+path.basename(src).replace('7T3A','7T'+(4+i)+'A')); fs.copyFileSync(src,dst); tmps.push(dst);} await p.setInputFiles('#file',tmps); await p.waitForTimeout(800); tmps.forEach(f=>fs.unlinkSync(f));
  const sh2=await p.evaluate(()=>[document.documentElement.scrollHeight, window.innerHeight]); check(sh2[0]<=sh2[1],'six sections: still no page scroll '+sh2);
  await p.screenshot({path:'shot8.png'});
  console.log('errors:', errs); check(errs.length===0,'no console errors');
  await b.close(); console.log(fails? `\n${fails} FAILED` : '\nALL PASS');
})();
