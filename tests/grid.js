const { chromium, fs, path, exe, check, done, tmp, need, unskip } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900}});
  await ctx.grantPermissions(['clipboard-read','clipboard-write']);
  const p=await ctx.newPage(); const errs=[]; p.on('framenavigated',f=>console.log('NAV',f.url().slice(-30))); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error' && !/ERR_TUNNEL|fonts|net::/.test(m.text())) errs.push(m.text()); });
  let dialogs=[], dialogAnswer=true; p.on('dialog', async d=>{ dialogs.push(d.message()); await (dialogAnswer? d.accept(): d.dismiss()); });
  await p.goto('file://'+path.resolve('Tally.html')); await unskip(p);
  check(await p.locator('#btnSettings.hidden').count()===1,'settings hidden on landing');
  const main=fs.readdirSync('fixtures').filter(f=>f.endsWith('.xlsx') && /^f1473588/.test(f)).map(f=>path.resolve('fixtures',f));
  await p.setInputFiles('#file', main); await p.waitForTimeout(600);
  check((await p.evaluate(()=>window.__tally.state.order.length))===2,'two sections imported');
  check(await p.locator('.rpanel').count()===1,'roster panel is the first screen');
  check(/Goal 60/.test(await p.textContent('[data-k="1205050-7T3A"]')) && /Goal 67/.test(await p.textContent('[data-k="1205050-7T1A"]')),'per-period thresholds on tabs');
  // roster paste in panel
  await p.click('[data-k="1205050-7T1A"]'); await p.waitForTimeout(150);
  const rosterLines=fs.readFileSync('fixtures/roster.txt','utf8').split('\n');
  const roster=rosterLines.map((l,i)=>`7T1A\t${100000+i}\t${l}\tA`).join('\n');
  await p.fill('#rpText', roster); await p.waitForTimeout(150); let rep=await p.textContent('#rpReport');
  check(/22 of 24/.test(rep),'roster with section+ID columns before name parsed: '+rep.slice(0,45));
  await p.fill('#rpText', 'Student Name\n12345\n'); await p.waitForTimeout(100); rep=await p.textContent('#rpReport'); check(/Couldn't read/.test(rep),'unreadable roster flagged');
  await p.fill('#rpText', roster); await p.click('#rpSave'); await p.waitForTimeout(300);
  check(await p.locator('table.grid').count()===1,'grid after roster save');
  check(await p.locator('.notice.soft').count()===1 && /Taylor, Ben → Benjamin Taylor/.test(await p.textContent('.notice.soft')),'loose-match notice');
  // ignore flag then un-ignore
  // not-on-roster flag opens a new-or-gone chooser; "Re-paste roster" lands in Settings on the roster box; "Skip" ignores
  await p.click('button.flag[data-ignore]'); await p.waitForTimeout(250);
  check(/in IXL but not on the roster/.test(await p.textContent('#modal')) && /Copy leaves them out/.test(await p.textContent('#modal')),'flag explains the copy consequence and offers new vs gone');
  await p.click('#nrRoster'); await p.waitForTimeout(300); check(await p.evaluate(()=>document.activeElement && document.activeElement.id==='roster'),'"Re-paste roster" opens Settings focused on the roster');
  await p.click('#mCancel'); await p.waitForTimeout(200);
  await p.click('button.flag[data-ignore]'); await p.waitForTimeout(250); await p.click('#nrSkip'); await p.waitForTimeout(250);
  check(await p.locator('button.flag[data-ignore]').count()===0,'ignored IXL-only student hidden');
  await p.click('#btnSettings'); check(/Skipped IXL accounts/.test(await p.textContent('#matchReport')),'ignored listed in settings');
  await p.click('#matchReport [data-unign]'); await p.waitForTimeout(100); await p.click('#mCancel'); await p.waitForTimeout(150);
  check(await p.locator('button.flag[data-ignore]').count()===1,'un-ignore restores');
  // fixer: tap NOT IN IXL flag on "Aiden, Carter", pick Aiden Harris
  await p.click('button.flag[data-fix="Aiden, Carter"]'); await p.waitForTimeout(150);
  check(await p.locator('.picks .chip').count()===1 && /Aiden Harris/.test(await p.textContent('.picks')),'fixer offers the leftover IXL name');
  await p.click('.picks .chip'); await p.waitForTimeout(250);
  const fixed=await p.evaluate(()=>window.__tally.buildRows(window.__tally.state.sections['1205050-7T1A']).find(r=>r.display==='Aiden, Carter'));
  check(fixed.status==='ok' && fixed.ixlName==='Aiden Harris' && fixed.tier==='alias','fixer alias applied');
  check(await p.locator('button.flag[data-ignore]').count()===0,'no IXL-only left after fix');
  // search: class average stable, # unfiltered, no-match, cleared on tab switch
  const avgBefore=await p.evaluate(()=>document.querySelector('tfoot td:nth-child(3)').textContent);
  await p.fill('#search','Nguyen'); await p.waitForTimeout(150);
  check(avgBefore===(await p.evaluate(()=>document.querySelector('tfoot td:nth-child(3)').textContent)),'class average unchanged under search');
  check((await p.textContent('tbody td.idx'))==='1','# keeps roster position');
  await p.fill('#search','zzzz'); await p.waitForTimeout(150); check(await p.locator('tr.nomatch').count()===1,'no-match row');
  await p.click('[data-k="1205050-7T3A"]'); await p.waitForTimeout(150); check((await p.inputValue('#search'))==='','search cleared on tab switch');
  // copy without roster on 7T3A -> names included
  await p.click('#rpSkip'); await p.waitForTimeout(200); check(await p.locator('.notice.info').count()===1,'skip roster shows info notice');
  await p.click('th.unit .copy'); await p.waitForTimeout(250); let clip=await p.evaluate(()=>navigator.clipboard.readText());
  check(clip.split('\n').every(l=>l.includes('\t')),'no-roster copy always includes names');
  await p.click('[data-k="1205050-7T1A"]'); await p.waitForTimeout(150);
  // hidden units + toggle
  const shownU=await p.locator('th.unit').count(); check(shownU<17,'quiet units hidden: '+shownU+' shown');
  await p.click('#toggleAll'); await p.waitForTimeout(150); check(await p.locator('th.unit').count()===17,'toggle shows all 17');
  dialogs=[]; dialogAnswer=false; await p.locator('th.unit.quiet .copy').first().click(); await p.waitForTimeout(200);
  check(dialogs.length===1 && /zeros/.test(dialogs[0]),'all-zero copy asks first');
  await p.click('#toggleAll'); await p.waitForTimeout(150);
  // copy unit 1 toast + clipboard
  await p.click('th.unit .copy'); await p.waitForTimeout(250); const t=await p.textContent('#toast');
  check(/Unit 1 copied — 24 rows in FOCUS order/.test(t) && /\/23/.test(t) && /1 blank row/.test(t),'toast: '+t);
  clip=await p.evaluate(()=>navigator.clipboard.readText()); check(clip.split('\n').length===24 && clip.split('\n').filter(x=>x==='').length===1 && !clip.includes('\t'),'clipboard 24 bare lines, 1 blank');
  // detail view
  await p.click('th.unit .ulink'); await p.waitForTimeout(250);
  const fit=await p.evaluate(()=>[...document.querySelectorAll('th.skill .rot')].filter(e=>e.scrollHeight<=e.clientHeight+1).length);
  check(fit>=20,'skill names readable (fit without clipping): '+fit+'/23');
  await p.evaluate(()=>document.querySelector('#gridwrap').scrollTop=300); await p.waitForTimeout(100);
  check(await p.evaluate(()=>{const th=document.querySelector('thead th.ptsd'); const r=th.getBoundingClientRect(); return document.elementFromPoint(r.left+r.width/2, r.top+r.height/2).closest('th')?.classList.contains('ptsd');}),'points header stays on top');
  await p.evaluate(()=>document.querySelector('#gridwrap').scrollTop=0);
  const before=await p.textContent('tr.skills th.ptsd'); await p.click('th.skill button'); await p.waitForTimeout(250);
  check(/of 23/.test(before)&&/of 22/.test(await p.textContent('tr.skills th.ptsd')),'exclude skill updates denominator');
  await p.click('#hideUnit'); await p.waitForTimeout(200); check((await p.textContent('#hideUnit')).includes('Not assigned'),'manual unassign unit');
  await p.click('#hideUnit'); await p.waitForTimeout(200);
  // Esc + dirty modal
  await p.click('#btnSettings'); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  check(await p.locator('#modal.hidden').count()===1 && await p.locator('#bar.detail').count()===1,'Esc closes modal, keeps detail view');
  await p.click('#btnSettings'); await p.fill('#roster','Zzz, Q'); dialogs=[]; dialogAnswer=false; await p.mouse.click(5,5); await p.waitForTimeout(150);
  check(dialogs.length===1 && await p.locator('#modal.hidden').count()===0,'dirty roster: backdrop asks');
  dialogAnswer=true; await p.keyboard.press('Escape'); await p.waitForTimeout(150); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  check(await p.locator('#bar.detail').count()===0,'second Esc pops view');
  // threshold per period
  await p.click('#btnSettings'); await p.fill('#thr',''); await p.click('#mSave'); await p.waitForTimeout(150);
  check((await p.evaluate(()=>window.__tally.state.sections['1205050-7T1A'].threshold))===67,'blank threshold keeps 67');
  await p.click('#btnSettings'); await p.fill('#thr','0'); await p.click('#mSave'); await p.waitForTimeout(150);
  check((await p.evaluate(()=>window.__tally.state.sections['1205050-7T1A'].threshold))===1,'threshold 0 clamps to 1');
  await p.click('#btnSettings'); await p.fill('#thr','67'); await p.click('#mSave'); await p.waitForTimeout(150);
  // older export guard
  dialogs=[]; dialogAnswer=false; await p.setInputFiles('#file', fs.readdirSync('fixtures').filter(f=>f.startsWith('old_')).map(f=>path.resolve('fixtures',f))); await p.waitForTimeout(500);
  check(dialogs.length===1 && /older/.test(dialogs[0]) && (await p.evaluate(()=>window.__tally.state.sections['1205050-7T1A'].date))==='2026-09-25','older export asks; declined keeps newer');
  // hide names everywhere
  await p.click('#btnHide'); await p.waitForTimeout(150);
  const nm=await p.textContent('tbody td.stu .nm'); check(/^[A-Z]\. [A-Z]\.$/.test(nm.trim()),'hide names -> initials');
  check(!/Zed, Withdrawn/.test(await p.textContent('#notices')),'banner hides names');
  await p.click('#btnSettings'); check(await p.locator('#roster').count()===0 && !/Zed, Withdrawn/.test(await p.textContent('#matchReport')),'settings hides roster + names'); await p.click('#mCancel');
  await p.click('#btnHide'); await p.waitForTimeout(150);
  // text-typed scores xlsx + csv sci ids
  const extra=fs.readdirSync('fixtures').filter(f=>f.startsWith('text_')||f.startsWith('csv_')).map(f=>path.resolve('fixtures',f));
  await p.setInputFiles('#file', extra); await p.waitForTimeout(600);
  const tx=await p.evaluate(()=>{const s=window.__tally.state.sections; return {t9:s['1205050-7T9A'].scores[0].slice(0,3), t9blank:s['1205050-7T9A'].allBlank, ids:s['1205050-7T8A'].skills.map(x=>x.id), sc:s['1205050-7T8A'].scores};});
  check(JSON.stringify(tx.t9)==='[81,81,87]' && !tx.t9blank,'text-typed scores parse as numbers');
  check(JSON.stringify(tx.ids)==='["2E5","7E3","0X1"]','csv skill IDs not mangled');
  check(JSON.stringify(tx.sc)==='[[81,40],[null,100],[60,null]]','csv scores + blanks');
  // greedy matcher + duplicate accounts (pure functions)
  const mm=await p.evaluate(()=>{const T=window.__tally; const base={skills:[],scores:[],excluded:{},aliases:{},hiddenUnits:{},threshold:60};
    const a=T.buildRows({...base,students:['Alexander Johnson'],roster:'Johnson, Alex\nJohnson, Alexander',ignored:{}}).map(r=>[r.display,r.status]);
    const d=T.buildRows({...base,students:['Mia Davis','Mia Davis'],roster:'Davis, Mia',ignored:{}}).map(r=>[r.display,r.status]);
    const d2=T.buildRows({...base,students:['Mia Davis','Mia Davis'],roster:'Davis, Mia',ignored:{'Mia Davis#1':true}}).map(r=>[r.display,r.status]);
    const lf=T.buildRows({...base,students:['Smith, John'],roster:'Smith, John',ignored:{}}).map(r=>[r.display,r.status]);
    return {a,d,d2,lf};});
  check(mm.a[1][1]==='ok' && mm.a[0][1]==='rosterOnly','exact match not stolen by nickname: '+JSON.stringify(mm.a));
  check(mm.d[0][1]==='ambiguous' && mm.d2[0][1]==='ok' && mm.d2.length===1,'duplicate account: ambiguous, then resolved by ignoring one');
  check(mm.lf[0][1]==='ok','IXL "Last, First" form matches');
  // backup: hand-edited garbage tolerated
  await p.click('[data-k="1205050-7T1A"]'); await p.waitForTimeout(150); await p.click('#btnSettings');
  const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#exportCfg')]); const cfgPath=await dl.path(); const cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));
  check(cfg.sections['1205050-7T1A'].threshold===67 && cfg.sections['1205050-7T1A'].aliases['Aiden, Carter'],'backup carries threshold + alias');
  cfg.sections['1205050-7T1A'].threshold='sixty'; cfg.sections['NEW-1']={}; fs.writeFileSync('/tmp/bad.json',JSON.stringify(cfg));
  await p.setInputFiles('#cfgFile','/tmp/bad.json'); await p.waitForTimeout(300);
  check((await p.evaluate(()=>window.__tally.state.sections['1205050-7T1A'].threshold))===67 && (await p.evaluate(()=>window.__tally.state.pendingCfg['NEW-1'].label))==='NEW-1','bad backup values sanitized');
  // six sections, no page scroll
  const tmps=[]; for(let i=0;i<3;i++){ const src=main[1]; const dst=path.resolve('fixtures','tmp'+i+'_'+path.basename(src).replace('7T3A','7T'+(4+i)+'A')); fs.copyFileSync(src,dst); tmps.push(dst);} await p.setInputFiles('#file',tmps); await p.waitForTimeout(800); tmps.forEach(f=>fs.unlinkSync(f));
  const sh=await p.evaluate(()=>[document.documentElement.scrollHeight, window.innerHeight]); check(sh[0]<=sh[1],'seven sections: no page scroll '+sh);
  await p.click('[data-k="1205050-7T1A"]'); await p.waitForTimeout(200); await p.screenshot({path:path.join(tmp,'shot9.png')});
  await p.click('th.unit .ulink'); await p.waitForTimeout(250); await p.screenshot({path:path.join(tmp,'shot10.png')});
  await p.click('[data-k="1205050-7T4A"]'); await p.waitForTimeout(250); await p.screenshot({path:path.join(tmp,'shot11.png')});
  await p.reload(); await p.waitForTimeout(400); check((await p.evaluate(()=>window.__tally.state.order.length))===7,'persisted after reload');
  console.log('errors:', errs); check(errs.length===0,'no console errors');
  await b.close(); done();
})();
