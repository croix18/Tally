// The class grid is the units up to "Working in", then one column — Ahead — for work in later units. "Working in" is
// always set once a course has data, so nothing is assigned by guess. Synthetic fixtures only.
const { chromium, fs, path, exe, check, done, tmp, pick, APP } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1366,height:768}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await pick(p,'[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(700); const a=await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(300); } }
  const K='period-1';
  const st=()=>p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const us=T.unitsOf(s); return { cur:T.state.settings.currentUnit, flags:us.map(u=>u.num+(u.assigned?'a':u.upcoming?'u':'h')).join(' '), n:us.length }; },K);
  const cols=()=>p.evaluate(()=>[...document.querySelectorAll('#gridwrap thead th')].map(t=>t.classList.contains('ahead')?'Ahead':t.classList.contains('unit')?t.querySelector('.t').textContent.trim():t.className.trim()).join(' | '));
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(400);
  // 1. the grid
  await p.selectOption('#curUnit','3'); await p.waitForTimeout(400);
  const s0=await st();
  check(s0.cur.acc===3 && /^1a 2a 3a 4u 5u/.test(s0.flags),'Working in Unit 3: Units 1–3 count, the rest are later units: '+s0.flags);
  check(await cols()==='idx | stu | Unit 1 | Unit 2 | Unit 3 | Ahead','the grid is #, Student, Units 1–3 and Ahead — not '+s0.n+' unit columns: '+await cols());
  check(await p.locator('th.unit.upcoming').count()===0 && await p.locator('.utag:not(.now)').count()===0 && await p.locator('#onlyCur').count()===0,'no "upcoming" columns or tags, no "Just Unit N"');
  check(/Units 4–17/.test(await p.textContent('th.ahead')) && /skills at goal/.test(await p.textContent('th.ahead')),'the Ahead header says which units it covers and what it counts');
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1 && document.querySelector('#gridwrap').scrollWidth<=document.querySelector('#gridwrap').clientWidth+1),'the whole grid fits the Chromebox without sideways scrolling');
  // 2. each cell is the student's skills at goal in later units, and only speaks when there are some
  const truth=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const later=T.unitsOf(s).filter(u=>u.upcoming); const rows=T.buildRows(s);
    return [...document.querySelectorAll('#gridwrap tbody tr')].map((tr,i)=>{ const r=rows[i]; const td=tr.querySelector('td.aheadc'); const sum=r.ixl==null?0:later.reduce((a,u)=>a+T.points(s,u,r.ixl),0); const where=r.ixl==null?[]:later.filter(u=>T.points(s,u,r.ixl)>0).map(u=>u.short); return { text:td.textContent.replace(/\s+/g,' ').trim(), sum, where, open:td.dataset.u?T.unitsOf(s)[+td.dataset.u].short:null }; }); },K);
  const withWork=truth.filter(x=>x.sum>0), without=truth.filter(x=>x.sum===0);
  check(withWork.length>0 && withWork.every(x=>new RegExp('^'+x.sum+' skills? · ').test(x.text)),'cells with work read "N skills · where" and N is the points in later units ('+withWork.length+' students): '+withWork.slice(0,3).map(x=>x.text).join(' | '));
  check(without.length>0 && without.every(x=>x.text===''),'students with nothing past Unit 3 have an empty cell — no column of zeros ('+without.length+')');
  check(withWork.every(x=>x.where.length===1 ? x.text.endsWith(x.where[0]) : x.where.length===2 ? /Units \d+ and \d+$/.test(x.text) : new RegExp('in '+x.where.length+' units$').test(x.text)),'"where" names the unit, two units, or how many');
  check(withWork.every(x=>x.open===x.where[0]),'a cell opens the first later unit that student has work in');
  check(new RegExp('^'+withWork.length+' students? ahead$').test((await p.textContent('tfoot td.aheadc')).trim()),'the footer counts the students who are ahead: '+(await p.textContent('tfoot td.aheadc')).trim());
  // 3. the later units are one tap away
  await p.click('#aheadBtn'); await p.waitForTimeout(250);
  const menu=await p.evaluate(()=>({ n:document.querySelectorAll('#aheadMenu button').length, first:document.querySelector('#aheadMenu button').textContent.replace(/\s+/g,' ').trim(), inside:(r=>r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight+1&&r.top>=0)(document.querySelector('#aheadMenu').getBoundingClientRect()), exp:document.querySelector('#aheadBtn').getAttribute('aria-expanded'), focus:document.activeElement.closest('#aheadMenu')!==null }));
  check(menu.n===14 && /^Unit 4/.test(menu.first) && menu.inside && menu.exp==='true' && menu.focus,'tapping Ahead lists the 14 later units inside the screen, focus in the list: '+menu.first);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  check(await p.locator('#aheadMenu.hidden').count()===1 && await p.evaluate(()=>document.activeElement.id)==='aheadBtn','Escape closes it and returns focus to Ahead');
  await p.click('#aheadBtn'); await p.waitForTimeout(150); await p.click('#aheadMenu button:nth-child(2)'); await p.waitForTimeout(400);
  check(/Unit 5/.test(await p.textContent('#bar h2')) && /Not assigned/.test(await p.textContent('#hideUnit')) && await p.locator('#aheadMenu').count()===0,'choosing one opens that unit, marked "Not assigned"');
  // 4. counting a later unit early: it becomes a column and leaves Ahead
  await p.click('#hideUnit'); await p.waitForTimeout(300); await p.click('#back'); await p.waitForTimeout(300);
  check(await cols()==='idx | stu | Unit 1 | Unit 2 | Unit 3 | Unit 5 | Ahead','a later unit marked Assigned becomes a column: '+await cols());
  await p.click('#aheadBtn'); await p.waitForTimeout(150); check(await p.locator('#aheadMenu button').count()===13,'…and is no longer under Ahead'); await p.keyboard.press('Escape');
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; delete T.state.assigned[s.prep][T.unitsOf(s).find(u=>u.num===5).name]; T.save(); T.render(); },K); await p.waitForTimeout(200);
  // 5. keyboard: a cell opens with Enter
  const cell=p.locator('td.aheadc[data-u]').first(); const want=await cell.evaluate(td=>window.__tally.unitsOf(window.__tally.state.sections['period-1'])[+td.dataset.u].short);
  await cell.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  check((await p.textContent('#bar h2')).trim()===want,'Enter on an Ahead cell opens '+want); await p.click('#back'); await p.waitForTimeout(200);
  // 6. moving Working in moves units out of Ahead; at the last unit there is no Ahead column
  await p.selectOption('#curUnit','6'); await p.waitForTimeout(400);
  check(await p.locator('th.unit').count()===6 && /Units 7–17/.test(await p.textContent('th.ahead')),'Working in Unit 6: six columns, Ahead covers 7–17');
  check(await p.locator('#curUnit option[value=""]').count()===0,'the selector has no "— pick —" once a unit is set');
  // late in the year the grid is wider than the screen: it lands on the current unit and Ahead, names still pinned
  await p.selectOption('#curUnit','10'); await p.waitForTimeout(400);
  const land=async()=>p.evaluate(()=>{ const g=document.querySelector('#gridwrap').getBoundingClientRect(); const c=document.querySelector('th.unit.current').getBoundingClientRect(); const a=document.querySelector('th.ahead').getBoundingClientRect(); const n=document.querySelector('tbody td.stu').getBoundingClientRect(); return { wide:document.querySelector('#gridwrap').scrollWidth>document.querySelector('#gridwrap').clientWidth, cur:c.left>=n.right-1 && c.right<=g.right+1, ahead:a.right<=g.right+1, names:n.left>=g.left-1 && n.left<g.left+80 }; });
  let ld=await land(); check(ld.wide && ld.cur && ld.ahead && ld.names,'Working in Unit 10: wider than the screen, so it shows the current unit and Ahead with the names still pinned: '+JSON.stringify(ld));
  await p.click('#btnHome'); await p.waitForTimeout(200); await p.click(`[data-k="${K}"]`); await p.waitForTimeout(400);
  ld=await land(); check(ld.cur && ld.ahead && ld.names,'…and again when the class is opened from the Overview');
  await p.selectOption('#curUnit','17'); await p.waitForTimeout(400);
  check(await p.locator('th.unit').count()===17 && await p.locator('th.ahead').count()===0 && await p.locator('td.aheadc').count()===0,'working in the last unit: every unit is a column and there is no Ahead');
  await p.selectOption('#curUnit','3'); await p.waitForTimeout(300);
  // 7. search and hidden names leave the column intact
  await p.fill('#search','zzzz'); await p.waitForTimeout(300); check(/No students match/.test(await p.textContent('#gridwrap tbody')) && await p.evaluate(()=>{ const td=document.querySelector('tr.nomatch td[colspan]'); return +td.getAttribute('colspan')===document.querySelectorAll('#gridwrap thead th').length-1; }),'the "no match" row spans the new column too'); await p.fill('#search',''); await p.waitForTimeout(200);
  // 7b. one list of later units, however the grid was redrawn; it never stays behind on another screen
  for (const ch of 'abcdef') { await p.type('#search', ch); await p.waitForTimeout(60); } await p.fill('#search',''); await p.waitForTimeout(200);
  check(await p.locator('#aheadMenu').count()===1,'typing in the search box leaves exactly one list of later units behind the Ahead button');
  await p.click('#aheadBtn'); await p.waitForTimeout(150); await p.setViewportSize({width:1200,height:768}); await p.waitForTimeout(250);
  check(await p.locator('#aheadMenu.hidden').count()===1 && await p.locator('#menuOverlay').count()===0,'resizing the window (rotating the tablet) closes the open list instead of leaving it adrift');
  await p.setViewportSize({width:1366,height:768}); await p.click('#btnHome'); await p.waitForTimeout(200); check(await p.locator('#aheadMenu').count()===0,'…and nothing is left on the Overview');
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(300);
  // 7c. Details view pushes the grid down: the list still opens inside the window with room to read it
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.details=true; T.save(); T.render(); }); await p.waitForTimeout(300);
  for (const [w,h] of [[1366,768],[1024,768],[911,512]]) { await p.setViewportSize({width:w,height:h}); await p.waitForTimeout(250); await p.evaluate(()=>document.querySelector('#aheadBtn').scrollIntoView({block:'nearest',inline:'nearest'})); await p.click('#aheadBtn'); await p.waitForTimeout(200);
    const r=await p.evaluate(()=>{ const m=document.querySelector('#aheadMenu').getBoundingClientRect(); return { t:Math.round(m.top), b:Math.round(m.bottom), ok:m.top>=0 && m.bottom<=innerHeight && m.left>=0 && m.right<=innerWidth && m.height>=Math.min(280, innerHeight-40) }; });
    check(r.ok,'Details view at '+w+'×'+h+': the list is inside the window and tall enough to use ('+r.t+'…'+r.b+')'); await p.keyboard.press('Escape'); await p.waitForTimeout(100); }
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.details=false; T.save(); T.render(); }); await p.setViewportSize({width:1366,height:768}); await p.waitForTimeout(200);
  // 7d. when the grid is only a little too wide, landing on the current unit must not cut a column in half under the names
  for (const [w,h] of [[911,512],[800,1280],[600,900]]) { await p.setViewportSize({width:w,height:h}); await p.click('#btnHome'); await p.waitForTimeout(150); await p.click(`[data-k="${K}"]`); await p.waitForTimeout(400);
    const cut=await p.evaluate(()=>{ const g=document.querySelector('#gridwrap'); const edge=document.querySelector('thead th.stu').getBoundingClientRect().right; const ths=[...document.querySelectorAll('thead th.unit, thead th.ahead')].map(th=>th.getBoundingClientRect()); const a=document.querySelector('th.ahead').getBoundingClientRect(); return { scrolled:Math.round(g.scrollLeft), half:ths.some(r=>r.left<edge-1.5 && r.right>edge+1.5), ahead:a.right<=g.getBoundingClientRect().right+1.5 }; });
    check(!cut.half && cut.ahead,w+' px: no unit column is cut in half beside the names and Ahead is fully in view (scrolled '+cut.scrolled+' px)'); }
  await p.setViewportSize({width:1366,height:768}); await p.waitForTimeout(200);
  // 8. an older save that ran on the guess rule gets a unit when it opens — and says so
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.currentUnit={ acc:null, on:null }; T.state.settings.curUnitTouched={ acc:true, on:false }; T.save(); });
  await p.reload(); await p.waitForTimeout(900);
  const after=await p.evaluate(()=>({ cur:window.__tally.state.settings.currentUnit, toast:document.querySelector('#toast').textContent }));
  check(after.cur.acc===3 && after.cur.on===3 && /Accelerated: Working in set to Unit 3 — a quarter of the course has started every unit up to it/.test(after.toast) && /On-level: Working in set to Unit 3/.test(after.toast),'a save with no Working in gets one at start-up, with the reason: '+JSON.stringify(after.cur));
  await p.click('#btnHome'); await p.waitForTimeout(300);
  const card=await p.evaluate(()=>{ const d=document.querySelector('.himport'); if (d && d.tagName==='DETAILS') d.open=true; return d ? d.textContent.replace(/\s+/g,' ') : ''; });
  check(/Accelerated — Working in set to Unit 3/.test(card) && /On-level — Working in set to Unit 3/.test(card),'…and the note stays on the Overview after the toast has gone');
  await p.click(`[data-k="${K}"]`); await p.waitForTimeout(300);
  await p.reload(); await p.waitForTimeout(700); check(!/Working in/.test(await p.textContent('#toast')),'…once: the next start says nothing');
  // 9. the rule itself (pure): numbered units count up to Working in; a plan without "Unit N" sections falls back to "a quarter has started it"
  const pure=await p.evaluate(()=>{ const T=window.__tally; const mk=(units,scores)=>({ prep:'acc', threshold:60, excluded:{}, studentSkips:{}, students:['A','B','C','D'], skills:units.map((u,i)=>({ unit:u, name:'s'+i, id:'i'+i, lesson:'' })), scores });
    const keep=JSON.stringify(T.state.settings.currentUnit); T.state.settings.currentUnit={ acc:2, on:null };
    const a=T.unitsOf(mk(['Unit 1 A','Unit 2 B','Unit 3 C'],[[null,null,null,null],[null,null,null,null],[90,90,90,90]])).map(u=>u.assigned?'a':'u').join('');
    T.state.settings.currentUnit={ acc:null, on:null };
    const n=T.unitsOf(mk(['Unit 1 A','Unit 2 B'],[[90,90,90,90],[90,90,90,90]])).map(u=>u.assigned?'a':'u').join('');
    const c=T.unitsOf(mk(['Chapter A','Chapter B','Chapter C'],[[90,null,null,null],[null,null,null,null],[null,null,null,10]])).map(u=>u.assigned?'a':'u').join('');
    T.state.settings.currentUnit=JSON.parse(keep); return { a, n, c }; });
  check(pure.a==='aau','numbered units: 1–2 count because Working in is 2, and Unit 3 does not count even though every student has finished it: '+pure.a);
  check(pure.n==='uu','with no Working in, no numbered unit counts — nothing is guessed from who has touched what: '+pure.n);
  check(pure.c==='aua','sections that are not "Unit N" still count once a quarter of the class has started them: '+pure.c);
  // 10. Working in defaults: Focus column, else the unbroken run a quarter have started, else the first counted unit
  const dw=await p.evaluate(()=>{ const T=window.__tally; const keepS=T.state.sections, keepO=T.state.order, keepC=JSON.stringify(T.state.settings.currentUnit);
    const mk=(key,scores)=>({ key, label:key, date:'2026-09-26', importedAt:'2026-09-26T12:00:00.000Z', prep:'acc', threshold:60, excluded:{}, studentSkips:{}, ignored:{}, aliases:{}, roster:'', history:[], students:['A','B','C','D'], skills:['Unit 1 A','Unit 2 B','Unit 3 C','Unit 4 D'].map((u,i)=>({ unit:u, name:'s'+i, id:'i'+i, lesson:'' })), scores, receipts:{}, best:{} });
    const run=scores=>{ T.state.sections={ x:mk('x',scores) }; T.state.order=['x']; T.state.settings.currentUnit={ acc:null, on:null }; const r=T.defaultWorkingIn(); return r.map(x=>x.unit+':'+x.why).join(); };
    const out={ started:run([[90,90,null,null],[50,null,null,null],[null,null,null,null],[90,90,90,null]]), gap:run([[90,null,null,null],[null,null,null,null],[90,90,90,90],[null,null,null,null]]), none:run([[null,null,null,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]]) };
    T.state.sections=keepS; T.state.order=keepO; T.state.settings.currentUnit=JSON.parse(keepC); return out; });
  check(dw.started==='2:started','Units 1 and 2 started, 3 untouched, 4 finished by most: Working in is Unit 2 — the run stops at the first unit the course has not started: '+dw.started);
  check(dw.gap==='1:started','a few students far ahead do not pull Working in past a unit nobody has started: '+dw.gap);
  check(dw.none==='1:first','a new class with no scores works in the first unit that counts: '+dw.none);
  // 11. tablet (touch): the column is reachable and the list opens inside the screen with finger-sized rows
  const saved=await p.evaluate(()=>{ const o={}; for (let i=0;i<localStorage.length;i++) { const k=localStorage.key(i); o[k]=localStorage.getItem(k); } return o; });
  const tctx=await b.newContext({viewport:{width:800,height:1280},hasTouch:true,isMobile:true}); const q=await tctx.newPage(); q.on('pageerror',e=>errs.push(e.message));
  await q.goto('file://'+path.resolve(APP)); await q.evaluate(o=>{ for (const k in o) localStorage.setItem(k,o[k]); },saved); await q.reload(); await q.waitForTimeout(700);
  await q.tap(`[data-k="${K}"]`); await q.waitForTimeout(400);
  await q.evaluate(()=>{ const g=document.querySelector('#gridwrap'); g.scrollLeft=g.scrollWidth; }); await q.waitForTimeout(150);
  await q.tap('#aheadBtn'); await q.waitForTimeout(250);
  check(await q.evaluate(()=>{ const r=document.querySelector('#aheadMenu').getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight+1 && r.height>200; }),'tablet upright: the list of later units opens inside the screen');
  check(await q.evaluate(()=>[...document.querySelectorAll('#aheadMenu button')].every(x=>x.getBoundingClientRect().height>=44) && document.querySelector('#aheadBtn').getBoundingClientRect().height>=44),'…with rows, and the Ahead button itself, at least 44 px tall');
  const firstLater=(await q.textContent('#aheadMenu button:nth-child(1) b')).trim();
  await q.tap('#aheadMenu button:nth-child(1)'); await q.waitForTimeout(400); check((await q.textContent('#bar h2')).trim()===firstLater,'…and a tap opens the unit ('+firstLater+')');
  await tctx.close();
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
