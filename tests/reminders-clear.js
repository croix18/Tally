// Reminders that can be cleared (Croix, 25 Oct 2026, with two Overview screenshots: "I can't make these notifications
// go away about the no grade column. I've set the assignments. So I don't know what else it wants from me. Same with
// the one student has not practiced ixl notification."). The categories line now asks only about guesses nobody has
// looked at, and the Grades page can say they are right; the practice line names the student, opens their page and can
// be dismissed until a newer Quickview.
const { chromium, fs, path, exe, check, done, APP, pick } = require('./lib');
const K = '1205050-7T1A';
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1300,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const home=async()=>{ await p.evaluate(()=>{ const T=window.__tally; T.state.settings.details=true; }); await p.click('#btnHome'); await p.waitForTimeout(300);
    return p.evaluate(()=>[...document.querySelectorAll('.hatt li')].map(l=>({ t:l.textContent.replace(/\s+/g,' ').trim().replace(/\s*›$/,''), dis:!!l.querySelector('[data-dismiss]'), stu:(l.querySelector('[data-stu]')||{dataset:{}}).dataset.stu||null }))); };
  const catLine=list=>list.find(x=>/categor/i.test(x.t));
  // 1. an export with no Grade column, its categories Tally's guesses: the line says how many to check
  const n0=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; s.grades.overall=null; const g=T.gradingFor(s.prep); s.grades.assignments.forEach(a=>{ delete g.map[a.name]; delete g.how[a.name]; }); T.save(); return s.grades.assignments.length; },K);
  const L1=await home();
  check(catLine(L1) && catLine(L1).t===`1st Period · Accelerated: check ${n0} categories: the gradebook has no Grade column`,'with every category a guess, the Overview asks to check '+n0+' of them: '+(catLine(L1)||{}).t);
  // 2. the Grades page says the same, with a way to say they are right
  await p.click('.hatt li button[data-where="grades"]'); await p.waitForTimeout(400);
  const G1=await p.evaluate(()=>({ view:window.__tally.view.mode, banner:(document.querySelector('.notice.catcheck')||{}).textContent||'', btn:(document.querySelector('#catKeep')||{}).textContent||'', srcs:[...document.querySelectorAll('.gasg .catsrc')].map(x=>x.textContent.trim()) }));
  check(G1.view==='grades' && new RegExp(`^.?${n0} categories are Tally's guesses from their names: this export has no Grade column to check them against\\. Change any that are wrong under Assignments\\.`).test(G1.banner.replace(/\s+/g,' ').trim()) && G1.btn==='These are right' && G1.srcs.every(x=>x==="Tally's guess"),'the line opens Grades, which says the same and offers "These are right": '+G1.banner.replace(/\s+/g,' ').slice(0,140));
  // 3. one changed by hand: it is yours, and one fewer is left to check
  const first=await p.evaluate(()=>{ const sel=document.querySelector('.gasg select[data-cat]'); const other=[...sel.options].find(o=>!o.selected).value; sel.value=other; sel.dispatchEvent(new Event('change')); return sel.dataset.cat; }); await p.waitForTimeout(300);
  const G2=await p.evaluate(name=>({ banner:(document.querySelector('.notice.catcheck b')||{}).textContent||'', src:[...document.querySelectorAll('.gasg tr')].find(tr=>tr.querySelector(`[data-cat="${CSS.escape(name)}"]`)).querySelector('.catsrc').textContent.trim() }),first);
  check(G2.src==='Set by you' && G2.banner===`${n0-1} categories are Tally's guesses`,'a category changed by hand is "Set by you", and the count drops to '+(n0-1)+': '+G2.banner);
  // 4. "These are right": the rest are checked, the notice and the Overview line go; Undo brings them back
  await p.click('#catKeep'); await p.waitForTimeout(300);
  const G3=await p.evaluate(()=>({ banner:!!document.querySelector('.notice.catcheck'), srcs:[...document.querySelectorAll('.gasg .catsrc')].map(x=>x.textContent.trim()), toast:document.querySelector('#toast').textContent.replace(/\s+/g,' ') }));
  check(!G3.banner && G3.srcs.filter(x=>x==='Checked by you').length===n0-1 && G3.srcs.filter(x=>x==='Set by you').length===1 && /categories stay as they are in every accelerated class/.test(G3.toast),'"These are right" checks the rest ("Checked by you") and the notice goes: '+G3.toast.slice(0,90));
  const L2=await home();
  check(!catLine(L2),'…and so does the Overview line: '+L2.map(x=>x.t).join(' | ').slice(0,200));
  await p.evaluate(K=>{ const T=window.__tally; T.state.active=K; T.render(); },K);
  // 5. checked guesses stay free: a later export with a Grade column can still prove them (the hand-set one stays put)
  const fitBack=await p.evaluate(({K,first})=>{ const T=window.__tally; const s=T.state.sections[K]; const g=T.gradingFor(s.prep); const keep=JSON.stringify({ map:g.map, how:g.how });
    const victim=s.grades.assignments.find(a=>g.how[a.name]==='ok' && /quiz|assessment/i.test(a.name)); const right=g.map[victim.name]; g.map[victim.name]=right==='Assessments'?'Classwork':'Assessments';
    const gs=T.gradeAll(s,Object.fromEntries(s.grades.assignments.map(a=>[a.name, a.name===victim.name?right:g.map[a.name]]))); s.grades.overall=gs.map(r=>r&&r.rounded);   // a Grade column as Focus would print it
    T.applyCategories(s); const out={ victim:victim.name, now:g.map[victim.name], how:g.how[victim.name], right, mine:g.how[first] };
    const b=JSON.parse(keep); g.map=b.map; g.how=b.how; s.grades.overall=null; T.save(); return out; },{K,first});
  check(fitBack.now===fitBack.right && fitBack.how==='fit' && fitBack.mine==='user','a checked guess is not locked: when an export brings a Grade column, Focus\'s grades put "'+fitBack.victim+'" back in '+fitBack.right+' (proved), and the one set by hand stays set');
  // 6. a new assignment in a later export is a new guess: the line comes back for that one only
  const L3=await (async()=>{ await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const gb=s.grades; gb.assignments.push({ name:'Week 9 Exit Quiz', max:10, values:gb.students.map(()=>8), status:gb.students.map(()=>'score'), missing:0, excused:0, due:'10/23', assignedOn:'', category:'', categoryFromFile:false }); T.save(); },K); return home(); })();
  check(catLine(L3) && /: check 1 category: the gradebook has no Grade column$/.test(catLine(L3).t),'a new assignment brings the line back, for that one: '+(catLine(L3)||{}).t);
  // 7. the import's question: "Looks right" checks what it showed; "Decide later" leaves them to check
  const ask=async(btn)=>{ await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const g=T.gradingFor(s.prep); delete g.how['Week 9 Exit Quiz']; g.map['Week 9 Exit Quiz']='Assessments'; g.how['Week 9 Exit Quiz']='guess'; window.__asked=T.askCategories(s,['Week 9 Exit Quiz'],null); },K); await p.waitForTimeout(200);
    const label=await p.textContent('#askApply'); await p.click(btn); await p.waitForTimeout(150); return { label, how:await p.evaluate(K=>window.__tally.gradingFor(window.__tally.state.sections[K].prep).how['Week 9 Exit Quiz'],K) }; };
  const later=await ask('#mCancel'); const right=await ask('#askApply');
  check(later.how==='guess' && right.label==='Looks right' && right.how==='ok','at import, "Decide later" leaves the category to check and "Looks right" checks it: '+later.how+' / '+right.how);
  const L4=await home();
  check(!catLine(L4),'with it checked, no line: '+L4.map(x=>x.t).join(' | ').slice(0,160));

  // 8. IXL practice: the Quickview's idle students
  await p.evaluate(K=>{ const T=window.__tally; T.state.active=K; T.render(); },K);
  await p.setInputFiles('#file',[path.resolve('fixtures/ixl_quickview.pdf')]); await p.waitForTimeout(3000);
  const ans=JSON.parse(fs.readFileSync('fixtures/ixl_quickview.json','utf8')); const idleN=ans.students.filter(s=>s.days>=7).length;
  const pracLine=list=>list.find(x=>/practiced IXL/.test(x.t));
  const P1=await home();
  check(pracLine(P1) && new RegExp(`^1st Period · Accelerated: ${idleN} students have not practiced IXL in a week or more \\(Quickview of Oct 24\\)`).test(pracLine(P1).t) && pracLine(P1).dis,'more than three: a count, with a way to dismiss it: '+(pracLine(P1)||{}).t);
  // one student idle: the line names them and opens their page
  const one=await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const idle=s.students.filter(n=>T.practiceIdle(T.practiceOf(s,n))); idle.slice(1).forEach(n=>{ const pr=T.practiceOf(s,n); pr.last=pr.asOf; }); T.save(); const pr=T.practiceOf(s,idle[0]); return { ixl:idle[0], last:pr.last }; },K);
  const P2=await home(); const lastFmt=await p.evaluate(d=>window.__tally.fmtDate(d),one.last);
  const nice=await p.evaluate(({K,n})=>{ const T=window.__tally; const s=T.state.sections[K]; const r=T.buildRows(s).find(x=>x.ixl===s.students.indexOf(n)); return r.display; },{K,n:one.ixl});
  const niceSays=await p.evaluate(d=>window.__tally.niceName(d),nice);
  check(pracLine(P2) && pracLine(P2).t===`1st Period · Accelerated: ${niceSays} has not practiced IXL since ${lastFmt} (Quickview of Oct 24)` && pracLine(P2).stu===nice,'one student: the line names them and when they last practiced: '+(pracLine(P2)||{}).t);
  await p.click('.hatt li button[data-stu]'); await p.waitForTimeout(400);
  const prof=await p.evaluate(()=>({ mode:window.__tally.view.mode, prac:!!document.querySelector('#pPractice'), idle:!!document.querySelector('#pPractice .gcard.warn') }));
  check(prof.mode==='student' && prof.prac && prof.idle,'tapping it opens that student\'s page, at their IXL practice: '+JSON.stringify(prof));
  // two: both named; names hidden: initials
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; const all=s.students.filter(n=>T.practiceOf(s,n)); const pr=T.practiceOf(s,all.find(n=>!T.practiceIdle(T.practiceOf(s,n)))); pr.last='2026-10-01'; T.save(); },K);
  const P3=await home();
  check(pracLine(P3) && / and [A-Z][a-z]+ [A-Z][A-Za-z]+ have not practiced IXL in a week or more \(Quickview of Oct 24\)/.test(pracLine(P3).t) && !pracLine(P3).stu,'two students: both named in one line: '+(pracLine(P3)||{}).t);
  await p.evaluate(()=>{ window.__tally.state.settings.hideNames=true; }); const P4=await home();
  check(pracLine(P4) && /: [A-Z]\. [A-Z]\. and [A-Z]\. [A-Z]\. have not practiced/.test(pracLine(P4).t),'with names hidden, initials: '+(pracLine(P4)||{}).t);
  await p.evaluate(()=>{ window.__tally.state.settings.hideNames=false; });
  // 9. dismissed: gone, Undo, kept through a reload, back with a newer Quickview
  await home(); await p.click('.hatt li [data-dismiss]'); await p.waitForTimeout(300);
  const D1={ list:await p.evaluate(()=>[...document.querySelectorAll('.hatt li')].map(l=>l.textContent.replace(/\s+/g,' ')).join(' | ')), toast:await p.textContent('#toast') };
  check(!/practiced IXL/.test(D1.list) && /Dismissed until a newer Quickview/.test(D1.toast),'Dismiss takes the line away: '+D1.toast.slice(0,60));
  await p.click('#disUndo'); await p.waitForTimeout(300);
  check(/practiced IXL/.test(await p.evaluate(()=>[...document.querySelectorAll('.hatt li')].map(l=>l.textContent).join(' '))),'Undo brings it back');
  await p.click('.hatt li [data-dismiss]'); await p.waitForTimeout(300);
  const keys=await p.evaluate(()=>Object.keys(window.__tally.state.dismissed));
  await p.reload(); await p.waitForTimeout(800);
  const P5=await home();
  check(!pracLine(P5) && keys.length===1 && /^practice\|1205050-7T1A\|2026-10-24\|[0-9a-z]+$/.test(keys[0]),'dismissed stays dismissed after Tally is opened again; the key holds no name: '+keys[0]);
  await p.evaluate(K=>{ const T=window.__tally; const s=T.state.sections[K]; Object.keys(s.practice).forEach(k=>{ const pr=s.practice[k]; if (pr && pr.asOf) pr.asOf='2026-10-31'; }); T.save(); },K);
  const P6=await home();
  check(pracLine(P6) && /\(Quickview of Oct 31\)/.test(pracLine(P6).t),'a newer Quickview that finds someone idle brings the line back: '+(pracLine(P6)||{}).t);
  const cd=await p.evaluate(()=>window.__tally.cleanDismissed({ 'practice|a|2026-10-24|x':'2026-10-25', bad:5, '__proto__':'2026-10-25', 'old|1':'2025-01-01', 'junk':'yesterday' }));
  check(JSON.stringify(Object.keys(cd).sort())==='["old|1","practice|a|2026-10-24|x"]','stored dismissals are cleaned on load: '+JSON.stringify(cd));
  console.log('errors:',errs); check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
