// Family contacts, the contact log and signed reports (Croix, 25 Oct 2026: "a space … on the students page for parent
// contact information … contact log … to fortify my command center"; "number of missing signed progress reports …
// tracked … as a check mark … Then I can have a list of parents to contact").
const { chromium, fs, path, exe, check, done, APP, pick, tmp } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1300,height:1000},acceptDownloads:true}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const K='1205050-7T1A'; const S=await p.evaluate(K=>window.__tally.state.sections[K].grades.students,K);
  // 1. a contact and a log entry, on the page and kept
  await p.evaluate(({K,n})=>window.__tally.openProfile(K,n),{K,n:S[1]}); await p.waitForTimeout(400);
  check(await p.locator('#pFamily').count()===1 && /No contacts yet/.test(await p.textContent('#pFamily')),'the student page has a Family section, empty to start');
  await p.click('#fAdd'); await p.fill('#pFamily [name=name]','Jordan Calder'); await p.fill('#pFamily [name=rel]','Mother'); await p.fill('#pFamily [name=phone]','(352) 555-0142'); await p.fill('#pFamily [name=email]','jcalder@example.com'); await p.fill('#pFamily [name=note]','Prefers texts after 4'); await p.click('#pFamily .fform [type=submit]'); await p.waitForTimeout(400);
  const card=await p.evaluate(()=>{ const c=document.querySelector('#pFamily .fcard'); return c && { text:c.innerText.replace(/\s+/g,' '), tel:c.querySelector('a[href^="tel:"]')?.getAttribute('href'), mail:c.querySelector('a[href^="mailto:"]')?.getAttribute('href') }; });
  check(card && /Jordan Calder Mother/.test(card.text) && card.tel==='tel:3525550142' && card.mail==='mailto:jcalder@example.com' && /Prefers texts after 4/.test(card.text),'the contact shows name, relationship, a tap-to-call phone, a mailto email and the note: '+JSON.stringify(card));
  await p.fill('#lform [name=text]','Called about the missing worksheets; will check the planner nightly.'); await p.selectOption('#lform [name=how]','Call'); await p.click('#lform [type=submit]'); await p.waitForTimeout(400);
  const log=await p.evaluate(()=>[...document.querySelectorAll('#pFamily .clog li')].map(li=>li.innerText.replace(/\s+/g,' ')));
  check(log.length===1 && /Call · Jordan Calder/.test(log[0]) && /planner nightly/.test(log[0]),'a log entry carries the date, how, who and what: '+log[0]);
  await p.reload(); await p.waitForTimeout(700); await p.evaluate(({K,n})=>window.__tally.openProfile(K,n),{K,n:S[1]}); await p.waitForTimeout(400);
  check(await p.locator('#pFamily .fcard').count()===1 && await p.locator('#pFamily .clog li').count()===1,'…and both are there after a reload');
  // edit, then the Family section is per student
  await p.click('#pFamily [data-cedit]'); await p.fill('#pFamily [name=phone]','(352) 555-0199'); await p.click('#pFamily .fform [type=submit]'); await p.waitForTimeout(400);
  check(/555-0199/.test(await p.textContent('#pFamily .fcard')),'Edit changes the contact in place');
  await p.evaluate(({K,n})=>window.__tally.openProfile(K,n),{K,n:S[2]}); await p.waitForTimeout(400);
  check(await p.locator('#pFamily .fcard').count()===0,'another student has no contacts');
  // 2. hidden names hide it; Show student and the Board file never carry it
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.hideNames=true; T.save(); T.render(); }); await p.waitForTimeout(300);
  await p.evaluate(({K,n})=>window.__tally.openProfile(K,n),{K,n:S[1]}); await p.waitForTimeout(400);
  check(/Hidden while names are hidden/.test(await p.textContent('#pFamily')) && await p.locator('#pFamily .fcard').count()===0,'with names hidden the Family section shows nothing');
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.hideNames=false; T.save(); T.render(); }); await p.waitForTimeout(300);
  const board=await p.evaluate(()=>JSON.stringify(window.__tally.boardFile()));
  check(!/Calder|555-01|jcalder/.test(board),'a Board file carries no contact');
  await p.evaluate(({K,n})=>window.__tally.openProfile(K,n),{K,n:S[1]}); await p.waitForTimeout(300); await p.click('#pShow'); await p.waitForTimeout(400);
  check(!/Calder|555-01|jcalder|Family/.test(await p.evaluate(()=>document.querySelector('#show').textContent)),'Show student carries no contact'); await p.reload(); await p.waitForTimeout(700);
  // 3. signed reports: print a batch, tick one back on the page, see the class list
  await p.click('#btnHome'); await p.waitForTimeout(300); await p.click('.hcard'); await p.waitForTimeout(300); await p.click('#btnPrint'); await p.waitForTimeout(300);
  const [pop]=await Promise.all([ctx.waitForEvent('page'), p.click('#rpWeekly')]); await pop.waitForLoadState(); await pop.close();
  await p.evaluate(({K,n})=>window.__tally.openProfile(K,n),{K,n:S[1]}); await p.waitForTimeout(400);
  check(await p.locator('#pFamily [data-back]').count()===1 && /not back yet/.test(await p.textContent('#pFamily .reps')),'after a print the page lists the report as not back yet');
  await p.click('#pFamily [data-back]'); await p.waitForTimeout(400);
  check(/back signed/.test(await p.textContent('#pFamily .reps')) && await p.evaluate(({K,n})=>{ const T=window.__tally; const l=T.reportsOf(T.state.sections[K],n); return /^\d{4}-\d{2}-\d{2}$/.test(l[l.length-1].back); },{K,n:S[1]}),'ticking it records the day it came back');
  await p.click('#back'); await p.waitForTimeout(300); await p.click('#btnHome'); await p.waitForTimeout(300); await p.click('.hcard'); await p.waitForTimeout(300); await p.click('#moreBtn'); await p.waitForTimeout(200); await p.click('#mReturns'); await p.waitForTimeout(400);
  const ret=await p.evaluate(()=>({ rows:document.querySelectorAll('.rettab tbody tr').length, back:document.querySelectorAll('.rettab tr.back').count, backN:document.querySelectorAll('.rettab tr.back').length, lead:document.querySelector('#modal .retHead').textContent, home:[...document.querySelectorAll('.rettab td.who')].map(t=>t.textContent).filter(t=>/Calder/.test(t)).length }));
  check(ret.rows===S.length && ret.backN===1 && /^Week of \w{3} \d+/.test(ret.lead) && /22 reports still out/.test(ret.lead) && ret.home===1 && !/Tick a report/.test(await p.textContent('#modal')),'Signed reports lists every student with the latest report, who is back, and the first contact for home: '+JSON.stringify(ret));
  await p.click('.rettab tbody tr:first-child [data-rback]'); await p.waitForTimeout(400);
  check(await p.locator('.rettab tr.back').count()===2 && /21 reports still out/.test(await p.textContent('#modal .retHead')),'a tick in the list counts too');
  // Croix, marking the list (25 Oct): the Home cell opens a card to add the contact right there, or go to the page
  const nm2=S[3]; await p.click(`[data-home="${nm2}"]`); await p.waitForTimeout(300);
  check(await p.locator('.rettab tr.qedit form').count()===1 && await p.locator('[data-goto]').count()===1,'tapping Home opens a contact card in the list');
  await p.fill('.qedit [name=name]','Ray Easton'); await p.fill('.qedit [name=rel]','Father'); await p.fill('.qedit [name=phone]','352-555-0177'); await p.click('.qedit [type=submit]'); await p.waitForTimeout(400);
  check(await p.locator('.rettab tr.qedit').count()===0 && /Ray Easton \(Father\) · 352-555-0177/.test(await p.textContent(`[data-home="${nm2}"]`)) && await p.evaluate(({K,n})=>window.__tally.familyOf(window.__tally.state.sections[K],n).contacts.length===1,{K,n:nm2}),'saving it adds the contact to the student and shows it in the list');
  await p.click(`[data-home="${nm2}"]`); await p.waitForTimeout(300); await p.click('[data-goto]'); await p.waitForTimeout(500);
  check(await p.locator('#modal.hidden').count()===1 && await p.locator('#pFamily .fcard').count()===1 && /Ray Easton/.test(await p.textContent('#pFamily')),'"Open … page" goes to that student\'s page, at Family');
  await p.click('#back'); await p.waitForTimeout(300); await p.click('#btnHome'); await p.waitForTimeout(300); await p.click('.hcard'); await p.waitForTimeout(300); await p.click('#moreBtn'); await p.waitForTimeout(200); await p.click('#mReturns'); await p.waitForTimeout(400);
  await p.click('#retClear'); await p.waitForTimeout(400);
  check(/Cleared/.test(await p.textContent('#modal')) && await p.locator('.rettab').count()===0 && await p.evaluate(({K,n})=>{ const T=window.__tally; const l=T.reportsOf(T.state.sections[K],n); return !!l[l.length-1].back; },{K,n:S[1]}),'Clear the list empties it; each report (and its signed-back date) stays on the student');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // 4. a full save carries contacts, log and the back dates; a reload keeps them
  const fam=await p.evaluate(({K})=>JSON.stringify(window.__tally.state.sections[K].family),{K});
  await p.reload(); await p.waitForTimeout(700);
  check(await p.evaluate(({K})=>JSON.stringify(window.__tally.state.sections[K].family),{K})===fam && await p.evaluate(({K,n})=>{ const T=window.__tally; const l=T.reportsOf(T.state.sections[K],n); return !!l[l.length-1].back; },{K,n:S[1]}),'contacts, the log and the signed-back dates survive a reload');
  console.log('errors:',errs); check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
