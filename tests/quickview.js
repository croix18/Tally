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
  const idleWant=ans.students.filter(s=>{ const x=new Date(ans.asOf+'T12:00:00'); x.setDate(x.getDate()-s.days); return (Date.now()-x.getTime())/864e5>=7; }).length;
  check(idleWant===0 ? !/not practiced IXL/.test(att) : new RegExp(idleWant+' students? (has|have) not practiced IXL in a week or more').test(att),'the Overview counts students who have not practiced in a week or more ('+idleWant+')');
  // 4. never on the Board; kept after a reload
  check(!/"practice"/.test(await p.evaluate(()=>JSON.stringify(window.__tally.boardFile()))),'a Board file carries no practice data');
  await p.reload(); await p.waitForTimeout(700);
  check(await p.evaluate(({K})=>{ const T=window.__tally; const s=T.state.sections[K]; return Object.keys(s.practice||{}).length; },{K})===23,'practice data survives a reload');
  console.log('errors:',errs); check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
