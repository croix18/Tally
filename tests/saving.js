// Two saves and nothing else (Croix, 21 Oct 2026: "I just did a ton of work, clicked the save thinking it was the whole
// thing, accidentally refreshed the page and lost it all because all I saved were the settings. So I need a full save
// and a board save, that's it"), and a Tally that cannot keep anything (on his Google Site, "if I accidentally navigate
// away from the site I lose it all"). The second case is reproduced with a sandboxed frame, which, like a Google Sites
// embed, gives the page no storage that lasts.
const { chromium, fs, path, exe, check, done, tmp, APP, pick, more, fullSave } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1536,height:864},acceptDownloads:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const K='1205050-7T1A';
  // ---- 1. only two saves ----------------------------------------------------------------------------------------------------
  await p.click('#btnMore'); await p.waitForTimeout(150);
  const items=await p.evaluate(()=>[...document.querySelectorAll('#topMenu button')].map(x=>[...x.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('')));
  check(items.join(' | ')==='Details view | Settings | Guide | Full save | Board save','the menu offers Full save and Board save: '+items.join(' | ')); await p.keyboard.press('Escape');
  await more(p,'#btnSettings'); await p.waitForTimeout(300);
  const st=await p.evaluate(()=>({ cfg:!!document.querySelector('#exportCfg'), row:[...document.querySelector('#exportFull').parentElement.querySelectorAll('button')].map(x=>x.textContent.trim()), saves:[...document.querySelectorAll('#modal button')].map(x=>x.textContent.trim()).filter(t=>/save|backup/i.test(t)), text:document.querySelector('#modal').textContent }));
  check(!st.cfg && st.row.join(' | ')==='Full save | Board save | Open a save' && !/backup/i.test(st.text),'Settings saves with Full save and Board save (and opens a save); the word "backup" is gone: '+st.row.join(' | '));
  check(st.saves.every(t=>/^(Full save|Board save|Open a save|Save Race|Save Data Lab|Save)$/.test(t)),'no other button in Settings says save except the Race and Data Lab pictures and the dialog\'s own Save (the course setup for another teacher is "Share this setup"): '+st.saves.join(' | '));
  const all=fs.readFileSync(APP,'utf8'); check(!/Save backup|tally-backup-/.test(all),'no settings-only save is left anywhere in the page');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // the Overview's reminder is a Full save
  await p.click('#btnHome'); await p.waitForTimeout(300); await p.click('#hAtt > summary').catch(()=>{}); await p.waitForTimeout(200);
  const [d0]=await Promise.all([p.waitForEvent('download'), p.click('#hBackup')]); check(/^tally-full-\d{4}-\d{2}-\d{2}\.json$/.test(d0.suggestedFilename()),'the Overview\'s save reminder downloads a Full save: '+d0.suggestedFilename());
  // ---- 2. what counts as unsaved work ---------------------------------------------------------------------------------------
  const unsaved=()=>p.evaluate(()=>{ const T=window.__tally; return T.state.savedPrint!==T.workPrint(); });
  check(!(await unsaved()),'right after a Full save there is nothing unsaved');
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(300); await p.click('#btnMore'); await p.click('#btnDetails'); await p.waitForTimeout(200); await p.click('#btnMore'); await p.click('#btnDetails'); await p.waitForTimeout(200);
  check(!(await unsaved()),'opening a class or switching Details view is not work to save');
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.addNote(s, s.grades.students[0], 'Moved seats.'); T.save(); },K);
  check(await unsaved(),'a new note is');
  const ev=await p.evaluate(()=>{ const e=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(e); return e.defaultPrevented; });
  check(!ev && await p.locator('#keep:not(.hidden)').count()===0,'where this browser keeps Tally, leaving never asks and no warning strip shows');
  const F=await fullSave(p); await p.keyboard.press('Escape');
  check(!(await unsaved()) && F.json.state.sections[K].stuNotes && Object.keys(F.json.state.sections[K].stuNotes).length===1,'the next Full save has the note, and nothing is unsaved again');
  // ---- 3. a page that keeps nothing (a Google Sites embed) ------------------------------------------------------------------
  const host=path.join(tmp,'site.html'); fs.writeFileSync(host,`<!doctype html><body style="margin:0"><iframe id="f" sandbox="allow-scripts allow-downloads allow-modals allow-popups allow-forms" src="file://${path.resolve(APP)}" style="border:0;width:1536px;height:864px"></iframe></body>`);
  const q=await ctx.newPage(); q.on('pageerror',e=>errs.push('frame: '+e.message)); q.on('dialog',d=>d.accept()); await q.goto('file://'+host); await q.waitForTimeout(900);
  const fr=q.frames().find(x=>x!==q.mainFrame());
  const s0=await fr.evaluate(()=>({ keep:!document.querySelector('#keep').classList.contains('hidden'), text:document.querySelector('#keep').textContent, open:!!document.querySelector('#keepOpen'), toast:document.querySelector('#toast').classList.contains('show') ? document.querySelector('#toast').textContent : '', origin:location.origin }));
  check(s0.keep && /can't keep your work after you leave it/.test(s0.text) && /Open your last Full save/.test(s0.text) && s0.open,'in a frame with no lasting storage, a strip says so and offers to open the last Full save: "'+s0.text+'"');
  check(!/could not be read|Could not save/.test(s0.toast),'and no error message about storage');
  await fr.setInputFiles('#file',[F.file]); await q.waitForTimeout(900);
  const s1=await fr.evaluate(()=>({ n:window.__tally.state.order.length, text:document.querySelector('#keep').textContent, save:!!document.querySelector('#keepSave') }));
  check(s1.n===1 && /Everything is in your Full save from/.test(s1.text) && s1.save,'the Full save opens there; the strip says it is all saved: "'+s1.text+'"');
  const ask0=await fr.evaluate(()=>{ const e=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(e); return e.defaultPrevented; }); check(!ask0,'leaving now loses nothing, so Tally does not ask');
  await fr.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.addNote(s, s.grades.students[1], 'Needs a calculator.'); T.save(); T.render(); },K); await q.waitForTimeout(200);
  const s2=await fr.evaluate(()=>{ const e=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(e); return { ask:e.defaultPrevented, text:document.querySelector('#keep').textContent, toast:document.querySelector('#toast').classList.contains('show') ? document.querySelector('#toast').textContent : '', att:(document.querySelector('#hBackup')||{textContent:''}).textContent }; });
  check(s2.ask && /only on this page/.test(s2.text),'after a change the strip says it is only on this page, and leaving asks first: "'+s2.text+'"');
  check(/work on this page is in no Full save yet/.test(s2.att),'the Overview\'s save line says the same: "'+s2.att.trim()+'"');
  check(!/Could not save/.test(s2.toast),'saving to the browser fails quietly there (the strip already says it)');
  const [d2]=await Promise.all([q.waitForEvent('download'), fr.click('#keepSave')]); await q.waitForTimeout(300); const f2=path.join(tmp,'frame-full.json'); await d2.saveAs(f2);
  const s3=await fr.evaluate(()=>{ const e=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(e); return { ask:e.defaultPrevented, text:document.querySelector('#keep').textContent }; });
  const J=JSON.parse(fs.readFileSync(f2,'utf8')); const notes=Object.values(J.state.sections[K].stuNotes).flat().map(n=>n.text);
  check(!s3.ask && /Everything is in your Full save/.test(s3.text) && notes.includes('Needs a calculator.') && notes.includes('Moved seats.'),'one tap on the strip downloads a Full save with the new work; leaving no longer asks');
  await q.screenshot({ path: path.join(tmp,'fragile.png') });
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('screenshots: '+tmp);
  await b.close(); done();
})();
