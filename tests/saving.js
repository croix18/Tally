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
  const [d0]=await Promise.all([p.waitForEvent('download'), p.click('#hBackup')]); check(/^tally-full-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(d0.suggestedFilename()),'the Overview\'s save reminder downloads a Full save, named to the minute so the newest sorts last: '+d0.suggestedFilename());
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
  // Ctrl+S is a Full save anywhere
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.addNote(s, s.grades.students[2], 'Ctrl+S check.'); T.save(); },K);
  const [dk]=await Promise.all([p.waitForEvent('download'), p.keyboard.press('Control+s')]); check(/^tally-full-/.test(dk.suggestedFilename()) && !(await unsaved()),'Ctrl+S makes a Full save');
  const F2=path.join(tmp,'newest.json'); await dk.saveAs(F2);
  // ---- 3. a page that keeps nothing (a Google Sites embed) ------------------------------------------------------------------
  // no allow-modals and no allow-same-origin: nothing may depend on the browser's own confirm box or on storage
  const host=path.join(tmp,'site.html'); fs.writeFileSync(host,`<!doctype html><body style="margin:0"><iframe id="f" sandbox="allow-scripts allow-downloads allow-popups allow-forms" src="file://${path.resolve(APP)}" style="border:0;width:1536px;height:864px"></iframe></body>`);
  let nativeDialogs=0; const q=await ctx.newPage(); q.on('pageerror',e=>errs.push('frame: '+e.message)); q.on('dialog',d=>{ nativeDialogs++; d.accept(); }); await q.goto('file://'+host); await q.waitForTimeout(900);
  const fr=q.frames().find(x=>x!==q.mainFrame());
  const s0=await fr.evaluate(()=>({ fragile:window.__tally.storageFragile, keep:!document.querySelector('#keep').classList.contains('hidden'), text:document.querySelector('#keep').textContent, h2:document.querySelector('#drop h2').textContent, launch:document.querySelector('#launch').textContent, toast:document.querySelector('#toast').classList.contains('show') ? document.querySelector('#toast').textContent : '' }));
  check(s0.fragile && s0.keep && /can't keep your work after you leave it/.test(s0.text) && /Each visit starts from your newest Full save/.test(s0.text),'in a frame with no lasting storage, a strip says so: "'+s0.text+'"');
  check(s0.h2==='Open your newest Full save.' && s0.launch==='Open a save','the first screen there is "Open your newest Full save" with an Open a save button');
  check(!/could not be read|Could not save/.test(s0.toast),'and no error message about storage');
  await fr.setInputFiles('#file',[F.file]); await q.waitForTimeout(900);
  const s1=await fr.evaluate(()=>({ n:window.__tally.state.order.length, text:document.querySelector('#keep').textContent, cls:document.querySelector('#keep').className, save:!!document.querySelector('#keepSave') }));
  check(s1.n===1 && /Everything is in full-\d+\.json \(today /.test(s1.text) && /\bok\b/.test(s1.cls) && s1.save,'the Full save opens there; the strip names the file and says all is saved: "'+s1.text+'"');
  const ask0=await fr.evaluate(()=>{ const e=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(e); return e.defaultPrevented; }); check(!ask0,'leaving now loses nothing, so Tally does not ask');
  // opening an OLDER save over a newer one: Tally's own dialog says so, Cancel keeps everything
  await fr.setInputFiles('#file',[F2]); await q.waitForTimeout(400); await fr.click('#askYes'); await q.waitForTimeout(700);   // (F2 is newer: opens)
  await fr.setInputFiles('#file',[F.file]); await q.waitForTimeout(500);
  const older=await fr.evaluate(()=>({ shown:!document.querySelector('#ask').classList.contains('hidden'), msg:(document.querySelector('#askMsg')||{textContent:''}).textContent, yes:(document.querySelector('#askYes')||{textContent:''}).textContent }));
  check(older.shown && /older than the Full save already open here/.test(older.msg) && older.yes==='Open it','opening an older save warns in Tally\'s own dialog: "'+older.msg+'"');
  await fr.click('#askNo'); await q.waitForTimeout(300);
  check(await fr.evaluate(()=>window.__tally.state.sections['1205050-7T1A'].stuNotes && Object.values(window.__tally.state.sections['1205050-7T1A'].stuNotes).flat().some(n=>n.text==='Ctrl+S check.')),'Cancel keeps the newer work');
  // work that is only on the page
  await fr.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.addNote(s, s.grades.students[1], 'Needs a calculator.'); T.save(); T.render(); },K); await q.waitForTimeout(200);
  await fr.click('#btnHome'); await q.waitForTimeout(300);
  const s2=await fr.evaluate(()=>{ const e=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(e); return { ask:e.defaultPrevented, text:document.querySelector('#keep').textContent, cls:document.querySelector('#keep').className, toast:document.querySelector('#toast').classList.contains('show') ? document.querySelector('#toast').textContent : '', att:(document.querySelector('#hBackup')||{textContent:''}).textContent }; });
  check(s2.ask && /Changes from the last less than a minute are only on this page\. Autosave every 10 min is on\./.test(s2.text) && /\bdue\b/.test(s2.cls),'after a change the strip says how long it has been only on this page, and leaving asks first: "'+s2.text+'"');
  check(/work on this page is in no Full save yet/.test(s2.att),'the Overview\'s save line says the same: "'+s2.att.trim()+'"');
  check(!/Could not save/.test(s2.toast),'saving to the browser fails quietly there (the strip already says it)');
  await fr.evaluate(()=>window.__tally.ageUnsaved(4*60000)); await fr.evaluate(()=>window.__tally.render());
  const s2b=await fr.evaluate(()=>({ text:document.querySelector('#keep').textContent, cls:document.querySelector('#keep').className }));
  check(/last 4 minutes/.test(s2b.text) && /\bdue\b/.test(s2b.cls),'the minutes count up');
  // autosave: after 10 minutes of unsaved work, with no click (a timer), a Full save downloads
  await fr.evaluate(()=>window.__tally.ageUnsaved(11*60000));
  const [da]=await Promise.all([q.waitForEvent('download',{timeout:5000}).catch(()=>null), fr.evaluate(()=>setTimeout(()=>window.__tally.autoTick(),10))]); await q.waitForTimeout(300);
  const aJ=da ? JSON.parse(fs.readFileSync(await da.path(),'utf8')) : null;
  check(da && /^tally-full-/.test(da.suggestedFilename()) && aJ.full.how==='auto' && Object.values(aJ.state.sections[K].stuNotes).flat().some(n=>n.text==='Needs a calculator.'),'autosave downloads a Full save on its own after 10 minutes of unsaved work'+(da?': '+da.suggestedFilename():' (no download)'));
  const s3=await fr.evaluate(()=>{ const e=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(e); return { ask:e.defaultPrevented, text:document.querySelector('#keep').textContent, toast:document.querySelector('#toast').textContent }; });
  check(!s3.ask && /Everything is in tally-full-/.test(s3.text) && /Autosaved/.test(s3.toast),'after it, nothing is unsaved and the strip names the file: "'+s3.text+'"');
  // switching away from the page saves too, at most every two minutes
  await fr.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.addNote(s, s.grades.students[3], 'Left the tab.'); T.save(); T.ageUnsaved(0); },K);
  const hide=()=>fr.evaluate(()=>{ Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true}); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true}); });
  const [dv]=await Promise.all([q.waitForEvent('download',{timeout:4000}).catch(()=>null), hide()]);
  check(!!dv,'switching to another tab with unsaved work downloads a Full save');
  await fr.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; T.addNote(s, s.grades.students[4], 'Again.'); T.save(); },K);
  const [dv2]=await Promise.all([q.waitForEvent('download',{timeout:2500}).catch(()=>null), hide()]);
  check(!dv2,'…but not again within two minutes (no pile of files from flipping between tabs)');
  // Ctrl+S inside the frame
  const [ds]=await Promise.all([q.waitForEvent('download'), (async()=>{ await fr.click('#keep span'); await q.keyboard.press('Control+s'); })()]);
  check(/^tally-full-/.test(ds.suggestedFilename()),'Ctrl+S saves inside the Google Site too');
  // a question that would have been the browser's confirm box is Tally's own dialog there
  await fr.evaluate(()=>{ window.__answer=null; window.__tally.ask('Remove this note?','Remove').then(v=>window.__answer=v); }); await q.waitForTimeout(150);
  const askUi=await fr.evaluate(()=>({ shown:!document.querySelector('#ask').classList.contains('hidden'), yes:document.querySelector('#askYes').textContent, focus:document.activeElement.id }));
  await q.keyboard.press('Escape'); await q.waitForTimeout(100); const esc1=await fr.evaluate(()=>window.__answer);
  check(askUi.shown && askUi.yes==='Remove' && askUi.focus==='askYes' && esc1===false,'questions use Tally\'s own dialog (named button, Escape cancels)');
  check(nativeDialogs===0,'and no browser dialog was ever opened inside the frame');
  // printing: the page opens in a window, with a Ctrl+P hint because the frame may not start printing itself
  const [pop]=await Promise.all([ctx.waitForEvent('page'), fr.evaluate(()=>window.__tally.openGuide())]); await pop.waitForURL(/^blob:/,{timeout:5000}).catch(()=>{}); await pop.waitForLoadState(); const pt=await pop.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.textContent).join(' ')+' '+document.body.innerText.slice(0,300));
  check(/Print/.test(pt) && /press Ctrl\+P/.test(pt),'a printed page from the frame opens (sent to the pop-up as a file, since the frame may not write into it) with a Print button and a Ctrl+P hint'); await pop.close();
  await q.screenshot({ path: path.join(tmp,'fragile.png') });
  // where pop-ups are blocked too, a printed page downloads instead
  const host2=path.join(tmp,'site2.html'); fs.writeFileSync(host2,`<!doctype html><body style="margin:0"><iframe sandbox="allow-scripts allow-downloads allow-forms" src="file://${path.resolve(APP)}" style="border:0;width:1200px;height:800px"></iframe></body>`);
  const q2=await ctx.newPage(); q2.on('pageerror',e=>errs.push('frame2: '+e.message)); await q2.goto('file://'+host2); await q2.waitForTimeout(800); const fr2=q2.frames().find(x=>x!==q2.mainFrame());
  const [dp]=await Promise.all([q2.waitForEvent('download',{timeout:4000}).catch(()=>null), fr2.evaluate(()=>window.__tally.openGuide())]);
  check(dp && /Tally-guide\.html$/.test(dp.suggestedFilename()),'with pop-ups blocked, the Guide downloads as a page to open and print');
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('screenshots: '+tmp);
  await b.close(); done();
})();
