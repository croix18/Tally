// IXL's Students Quickview PDF (Croix, 25 Oct 2026: "I have pdfs with this data. Can you utilize it?"): effort and
// recency by skill. The fixture is drawn by fixtures/make_ixl_quickview_pdf.py from the scrubbed Score Grid, answers in JSON.
const { chromium, fs, path, exe, check, done, APP, pick } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1300,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const K='1205050-7T1A'; const ans=JSON.parse(fs.readFileSync('fixtures/ixl_quickview.json','utf8'));
  // 1. the parser against the answers
  const fx=await p.evaluate(async b64=>{ const T=window.__tally; const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); const fx=T.parseIxlQuickviewPdf(await T.pdfTextPages(u8.buffer)); return fx && { asOf:fx.asOf, range:fx.range, students:fx.students }; }, fs.readFileSync('fixtures/ixl_quickview.pdf').toString('base64'));
  check(fx && fx.asOf===ans.asOf && fx.range==='Aug 10 to Oct 24' && fx.students.length===ans.students.length,'the Quickview is recognised; the date range gives the as-of day ('+(fx&&fx.asOf)+') and every student block is found ('+(fx&&fx.students.length)+')');
  const bad=ans.students.filter((a,i)=>{ const s=fx.students[i]; if (!s || s.name!==a.display || s.questions!==a.questions || s.minutes!==a.minutes || s.days!==a.days || s.mastered!==a.mastered || s.proficient!==a.proficient || s.rows.length!==a.rows.length) return true;
    return a.rows.some((r,j)=>{ const x=s.rows[j]; return !x || x.id!==r.id || x.q!==r.q || x.min!==r.min || x.from!==r.from || x.to!==r.to || x.name!==r.name.slice(0,58).trim() || x.g!==r.grade; }); }).map(a=>a.display);
  check(bad.length===0,'every student\'s name, totals, days since practice, mastered/proficient and every skill row (grade, name, ID, questions, time, from, to) match ('+ans.students.reduce((n,s)=>n+s.rows.length,0)+' rows)'+(bad.length?': '+bad.slice(0,3).join(', '):''));
  // 2. the import, matched by IXL name
  await p.setInputFiles('#file',[path.resolve('fixtures/ixl_quickview.pdf')]); await p.waitForTimeout(3000);
  const toast=await p.textContent('#toast');
  check(/IXL Quickview \(Aug 10 to Oct 24\): 23 students matched by IXL name in 1 class/.test(toast),'the import matches every student by IXL name: '+toast.slice(0,120));
  const st=await p.evaluate(({K})=>{ const T=window.__tally; const s=T.state.sections[K]; const pr=T.practiceOf(s,s.students[0]); const k=s.skills.findIndex(sk=>sk.id==='X2L'); return { pr:pr&&{ asOf:pr.asOf, q:pr.questions, min:pr.minutes, last:pr.last, n:Object.keys(pr.skills).length }, sp:T.skillPractice(s,s.students[0],k) }; },{K});
  const a0=ans.students[0]; const lastWant=(d=>{ const x=new Date(ans.asOf+'T12:00:00'); x.setDate(x.getDate()-a0.days); return x.toISOString().slice(0,10); })();
  check(st.pr && st.pr.q===a0.questions && st.pr.min===a0.minutes && st.pr.last===lastWant && st.pr.n===a0.rows.length,'the student\'s totals and last-practiced day are kept on the class: '+JSON.stringify(st.pr));
  check(st.sp && st.sp.min===a0.rows[0].min && st.sp.q===a0.rows[0].q,'a unit skill finds its practice by permanent skill ID: '+JSON.stringify(st.sp));
  // 3. shown: the student page, the weekly report, the Overview
  const name=await p.evaluate(K=>window.__tally.state.sections[K].grades.students[0],K);
  await p.evaluate(({K,name})=>window.__tally.openProfile(K,name),{K,name}); await p.waitForTimeout(400);
  const sec=(await p.evaluate(()=>document.querySelector('#pPractice').innerText)).replace(/\s+/g,' ');
  check(/IXL practice/i.test(sec) && /375 questions/.test(sec) && /7 hr 3 min/.test(sec) && /Last practiced/i.test(sec) && await p.locator('#pPractice .prac tbody tr').count()===Math.min(12,a0.rows.length),'the student page has an IXL practice section: totals, last practiced, the skills by time: '+sec.slice(0,120));
  const [pop]=await Promise.all([ctx.waitForEvent('page'), p.click('#pPrint')]); await pop.waitForLoadState(); await pop.waitForTimeout(500);
  const line=await pop.evaluate(()=>document.querySelector('.prac')?.innerText.replace(/\s+/g,' '));
  check(!line && await pop.locator('.sk .pt').count()===0 && !/questions · \d+ hr|min\b/.test(await pop.evaluate(()=>document.querySelector('.panel.ixl')?.innerText||'')),'the weekly report carries no IXL time (Croix, 25 Oct: "Don\'t worry about putting time in the progress report")'); await pop.close();
  await p.click('#btnHome'); await p.waitForTimeout(400);
  const att=await p.evaluate(()=>[...document.querySelectorAll('.hatt li')].map(l=>l.textContent.replace(/\s+/g,' ')).join(' | '));
  const idleWant=ans.students.filter(s=>s.days>=7).length;   // a week or more before the Quickview's own date (audit, 25 Oct: from today, an old Quickview made everyone idle)
  check(idleWant>0 && new RegExp(idleWant+' students? (has|have) not practiced IXL in a week or more').test(att),'the Overview counts students who had not practiced for a week or more by the Quickview\'s date ('+idleWant+'): '+att.slice(0,160));
  const rel=await p.evaluate(()=>{ const T=window.__tally; return [T.practiceIdle({ asOf:'2026-09-03', last:'2026-09-01' }), T.practiceIdle({ asOf:'2026-09-10', last:'2026-09-01' }), T.practiceIdle({ asOf:'2026-09-10', last:'' })]; });
  check(JSON.stringify(rel)==='[false,true,false]','idle is counted to the Quickview\'s date, not to today: a September Quickview read in October does not make its students idle: '+JSON.stringify(rel));
  // 4. never on the Board; kept after a reload
  check(!/"practice"/.test(await p.evaluate(()=>JSON.stringify(window.__tally.boardFile()))),'a Board file carries no practice data');
  await p.reload(); await p.waitForTimeout(700);
  check(await p.evaluate(({K})=>{ const T=window.__tally; const s=T.state.sections[K]; return Object.keys(s.practice||{}).filter(k=>k!=='#names').length; },{K})===23,'practice data survives a reload');
  // 5. audit (25 Oct): stored compactly: four numbers per skill, a name kept once per class and only for a skill the class's export doesn't list
  const store=await p.evaluate(({K})=>{ const T=window.__tally; const s=T.state.sections[K]; const pr=s.practice; const k0=Object.keys(pr).find(k=>k!=='#names'); const one=pr[k0].skills; const ids=new Set(s.skills.map(sk=>sk.id)); const names=pr['#names']||{};
    return { arrays:Object.values(one).every(v=>Array.isArray(v)&&v.length===4), noName:Object.values(one).every(v=>!v.name), named:Object.keys(names).length, namedKnown:Object.keys(names).filter(id=>ids.has(id)).length, bytes:JSON.stringify(pr).length }; },{K});
  check(store.arrays && store.noName && store.named>0 && store.namedKnown===0,'each skill is four numbers; only skills outside the class\'s export keep a name, once for the class: '+JSON.stringify(store));
  const mig=await p.evaluate(()=>{ const T=window.__tally; const out=T.cleanPractice({ 'a b':{ asOf:'2026-10-24', questions:'12', minutes:5, last:'2026-10-20', mastered:1, proficient:0, skills:{ ABC:{ q:7, min:3, from:0, to:180, name:'Old way', g:'7th' }, XYZ:[1,null,0,50] } }, 'c d':{ skills:{ ABC:'junk' } }, '__proto__':{ skills:{} } });
    return { abc:out['a b'].skills.ABC, xyz:out['a b'].skills.XYZ, name:(out['#names']||{}).ABC, q:out['a b'].questions, junk:Object.keys(out['c d'].skills).length, proto:Object.prototype.hasOwnProperty.call(out,'__proto__') }; });
  check(JSON.stringify(mig.abc)==='[7,3,0,100]' && JSON.stringify(mig.xyz)==='[1,null,0,50]' && mig.name && mig.name[0]==='Old way' && mig.q===12 && mig.junk===0 && !mig.proto,'a save in the first format loads: numbers clamped (a score over 100 reads 100), the name moved to the class list, junk dropped: '+JSON.stringify(mig));
  // 6. audit (25 Oct): a Quickview printed from a browser: wrapped names and times, the header again on the next page,
  //    an accent the Score Grid doesn't have, "Practiced Oct 3", and a header that can't be read
  const hard=JSON.parse(fs.readFileSync('fixtures/ixl_quickview_hard.json','utf8'));
  const hx=await p.evaluate(async b64=>{ const T=window.__tally; const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); const fx=T.parseIxlQuickviewPdf(await T.pdfTextPages(u8.buffer)); return { students:fx.students, bad:fx.bad, short:fx.short }; }, fs.readFileSync('fixtures/ixl_quickview_hard.pdf').toString('base64'));
  const byN=Object.fromEntries(hx.students.map(x=>[x.name,x])); const lost=hard.students.find(a=>a.unreadable);
  const wrong=hard.students.filter(a=>!a.unreadable).filter(a=>{ const x=byN[a.display]; if (!x || x.questions!==a.questions || x.minutes!==a.minutes || x.days!==a.days || x.rows.length!==a.rows.length) return true; return a.rows.some(r=>{ const y=x.rows.find(z=>z.id===r.id); return !y || y.min!==r.min || y.q!==r.q || y.name!==r.name.slice(0,58).trim() || y.from!==r.from || y.to!==r.to; }); }).map(a=>a.display);
  const wrapped=hard.students.reduce((n,a)=>n+a.rows.filter(r=>r.name.length>34||r.min>=60).length,0);
  check(hx.students.length===hard.students.length-1 && wrong.length===0,'every readable student and every row reads right, '+wrapped+' rows with a wrapped name or time among them, one record per student though a header repeats on the next page'+(wrong.length?': '+wrong.slice(0,3).join(', '):''));
  check(byN['L\u00f3gan Easton'] && byN['Micah Dorsey'] && byN['Micah Dorsey'].days===21,'an accented name keeps its accent, and "Practiced Oct 3" is 21 days before the report\'s Oct 24');
  check(hx.bad===lost.rows.length && !hx.students.some(x=>x.rows.some(r=>lost.rows.some(l=>l.id===r.id&&l.q===r.q&&l.min===r.min&&l.to===r.to)&&!hard.students.find(a=>a.display===x.name).rows.some(q=>q.id===r.id))),'the rows under a header that can\'t be read join no one and are counted ('+hx.bad+')');
  await p.evaluate(({K,name})=>window.__tally.openProfile(K,name),{K,name}); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/ixl_quickview_hard.pdf')]); await p.waitForTimeout(3000);
  const t2=await p.textContent('#toast');
  check(/22 students matched/.test(t2) && new RegExp(lost.rows.length+' skill rows could not be read').test(t2),'the import says how many rows it could not read: '+t2.slice(0,200));
  check(await p.$('#pPractice') && await p.evaluate(()=>!!window.__tally.view.stu),'a PDF dropped on a student\'s page leaves the page open');
  const accent=await p.evaluate(({K})=>{ const T=window.__tally; const s=T.state.sections[K]; return !!T.practiceOf(s,'LOGAN EASTON'); },{K});
  check(accent,'"L\u00f3gan Easton" in the Quickview reaches LOGAN EASTON in the Score Grid');
  await p.click('#btnHome'); await p.waitForTimeout(300);
  const li=await p.evaluate(()=>(document.querySelector('.himport')||{}).textContent||'');
  check(/IXL Quickview · M\/J ACCEL MATH GR 7/.test(li) && /22 students matched in 1 class/.test(li),'the Overview\'s import lines name the Quickview and what it matched: '+li.replace(/\s+/g,' ').slice(0,200));
  // names hidden: the toast names no one
  await p.evaluate(()=>{ const T=window.__tally; T.state.settings.hideNames=true; T.save(); T.importQuickview({ asOf:'2026-10-24', range:'', course:'', bad:0, short:0, kind:'quickview', students:[{ name:'Zed Nobodyfixture', questions:1, minutes:1, days:0, mastered:0, proficient:0, seeAll:1, rows:[] }] }, 'x.pdf'); }); await p.waitForTimeout(200);
  const t3=await p.textContent('#toast'); await p.evaluate(()=>{ const T=window.__tally; T.state.settings.hideNames=false; T.save(); });
  check(/1 not in your classes/.test(t3) && !/Nobodyfixture/.test(t3),'with names hidden, the students not in a class are not named: '+t3.slice(0,140));
  console.log('errors:',errs); check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
