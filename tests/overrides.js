// Focus-check overrides ("Keep Focus"): a kept difference is noted with date and reason, stops being flagged, copies
// Focus's number, comes back if Focus changes, survives reload and backup; plus the what-if card's deltas.
const { chromium, fs, path, exe, check, done, tmp, APP, pick, more } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.currentUnit={acc:2,on:2}; T.save(); T.render(); });
  const K='1205050-7T1A';
  const before=await p.evaluate(K=>{ const T=window.__tally; const c=T.reconcile(T.state.sections[K]).find(c=>c.unit.short==='Unit 1'); return { differ:c.counts.differ, missing:c.counts.missing, first:c.rows.find(r=>r.status==='differ') }; }, K);
  check(before.differ>0 && before.first,'the real class has differences to work with: '+before.differ+' differ');
  // 1. keep one
  await p.click('.fcheck'); await p.waitForTimeout(400);
  // Unit 1's points don't agree with Focus here, so the dialog is the setup question and the student rows are folded
  check(await p.locator('details.fcrows:not([open])').count()===1,'points disagree: the student rows start folded under "Student by student"');
  await p.click('.fcrows > summary'); await p.waitForTimeout(200);
  await p.locator(`[data-keep="${before.first.display}"]`).click(); await p.waitForTimeout(200);
  check(await p.locator('#keepForm:not(.hidden) #keepWhy').count()===1 && /Keep Focus/.test(await p.textContent('#keepForm')),'Keep Focus opens an inline note form');
  await p.fill('#keepWhy','late penalty'); await p.press('#keepWhy','Enter'); await p.waitForTimeout(500);
  check(await p.locator('details.fcrows[open]').count()===1,'…and stay open after a row is kept (the dialog redraws)');
  const ov=await p.evaluate(([K,d])=>{ const s=window.__tally.state.sections[K]; const u=Object.keys(s.overrides||{})[0]; return s.overrides[u][d]; }, [K,before.first.display]);
  check(ov && ov.why==='late penalty' && ov.focus===before.first.focus && ov.tally===before.first.tally && /^\d{4}-\d{2}-\d{2}T/.test(ov.at),'override stored with Focus value, Tally value, date and reason');
  const after=await p.evaluate(K=>{ const T=window.__tally; const c=T.reconcile(T.state.sections[K]).find(c=>c.unit.short==='Unit 1'); return { differ:c.counts.differ, accepted:c.counts.accepted }; }, K);
  check(after.differ===before.differ-1 && after.accepted===1,'the kept row stops counting as a difference');
  check(await p.locator(`[data-keep="${before.first.display}"]`).count()===0 && /1 difference kept on purpose/.test(await p.textContent('#modal')) && /late penalty/.test(await p.textContent('.kept')),'the dialog lists it under "kept on purpose" with the note');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // 2. copying the column carries Focus's number for the kept student
  const col=await p.evaluate(([K,d])=>{ const T=window.__tally; const s=T.state.sections[K]; const u=T.unitsOf(s).find(u=>u.short==='Unit 1'); return T.unitColumn(s,u,'names').find(l=>l.startsWith(d)); }, [K,before.first.display]);
  check(col && col.split('\t')[1]===String(before.first.focus),'Copy carries the kept Focus number, not Tally\'s: '+col);
  // 3. survives reload; comes back if Focus changes
  await p.reload(); await p.waitForTimeout(700);
  const r2=await p.evaluate(K=>{ const T=window.__tally; const c=T.reconcile(T.state.sections[K]).find(c=>c.unit.short==='Unit 1'); return c.counts.accepted; }, K); check(r2===1,'override survives a reload');
  await p.evaluate(([K,d])=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades; const a=gb.assignments.find(a=>/Unit 1 IXL/i.test(a.name)); const i=gb.students.indexOf(d); a.values[i]=(a.values[i]||0)+2; T.save(); }, [K,before.first.display]);
  const r3=await p.evaluate(([K,d])=>{ const T=window.__tally; const c=T.reconcile(T.state.sections[K]).find(c=>c.unit.short==='Unit 1'); const row=c.rows.find(r=>r.display===d); return { st:row.status, stale:!!row.staleOverride }; }, [K,before.first.display]);
  check(r3.st!=='accepted' && r3.stale,'when Focus changes for that student the row is flagged again, with a note about the old decision');
  // 4. flag again (undo) and backup round-trip
  await p.evaluate(([K,d])=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades; const a=gb.assignments.find(a=>/Unit 1 IXL/i.test(a.name)); const i=gb.students.indexOf(d); a.values[i]-=2; T.save(); T.render(); }, [K,before.first.display]);
  await p.click('[data-k="1205050-7T1A"]'); await p.waitForTimeout(300);
  await more(p,'#btnSettings'); await p.waitForTimeout(200); const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#exportCfg')]); const cfg=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
  check(cfg.sections[K].overrides && Object.keys(cfg.sections[K].overrides).length===1,'the Tally backup carries overrides'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('.fcheck'); await p.waitForTimeout(400); await p.click('.fcrows > summary'); await p.waitForTimeout(150); await p.click('.kept > summary'); await p.click('[data-unkeep]'); await p.waitForTimeout(400);
  check(await p.locator(`[data-keep="${before.first.display}"]`).count()===1,'"Flag again" puts the row back');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // 5. what-if card: every result carries its change; a no-change retake says so
  await p.click('#openGrades'); await p.waitForTimeout(500); await p.locator('.gstu tr[data-stu]').nth(3).click(); await p.waitForTimeout(400);
  const card=await p.textContent('#gridwrap');
  check(await p.locator('.profile').count()===1 && /Each line below changes one thing/.test(card) && await p.locator('.delta').count()>=5,'student page what-ifs explain themselves and show the change on every line');
  check(await p.locator('.delta.up').count()>0,'positive changes are marked');
  await p.click('#back'); await p.waitForTimeout(200);
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
