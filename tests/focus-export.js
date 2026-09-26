// A real Focus gradebook export (scrubbed): multi-line headers with "N Points / Assigned / Due",
// cells like "16.5 - 79 % - C", NHI (missing), NG (excused), a "Grade" column and an "Average" row.
const { chromium, fs, path, exe, check, done } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve('Tally.html'));
  const buf=Array.from(fs.readFileSync('fixtures/focus_gradebook_scrubbed.csv'));
  const g=await p.evaluate(async bytes=>{ const T=window.__tally; const rows=await T.fileToRows(new File([new Uint8Array(bytes)],'Gradebook.csv')); const g=T.parseGradebook(rows,'Gradebook.csv');
    return { error:g.error, students:g.students, unread:g.unread, a:g.assignments.map(a=>({name:a.name,max:a.max,cat:a.category,due:a.due,n:a.values.filter(v=>v!=null).length,missing:a.missing,excused:a.excused,unread:a.unread,values:a.values})) }; }, buf);
  check(!g.error,'parses without error: '+(g.error||''));
  check(g.students.length===23,'23 students (Average row dropped): '+g.students.length);
  check(g.students[0]==='SUTTER, HAYDEN SKYLER' && !g.students.includes('Average'),'student names come from the Student column, not Student ID');
  check(g.a.length===13,'13 assignments (Grade column skipped): '+g.a.map(x=>x.name).join(', '));
  const by=n=>g.a.find(x=>x.name===n);
  check(by('Unit 1 Assessment') && by('Unit 1 Assessment').max===21 && by('Unit 2 IXL').max===17 && by('Unit 2 Vocabulary Quiz').max===7,'points possible read from the multi-line header');
  check(by('Unit 1 Assessment').due==='09/02' && by('Whiteboard Practice Week 9/21').due==='09/25','due dates read from the header');
  check(by('Unit 1 IXL').cat==='IXL' && by('Squares and Cubes Quiz').cat==='Quizzes' && by('Unit 1 Assessment').cat==='Assessments' && by('2.01 Worksheet').cat==='Classwork','categories guessed from names');
  check(by('Unit 1 Assessment').values[0]===16.5 && by('Unit 2 IXL').values[0]===1,'"16.5 - 79 % - C" → 16.5 points');
  const sq=by('Squares and Cubes Quiz'); check(sq.n===21 && sq.missing===1 && sq.excused===1,'NHI counted as missing, NG as excused: '+JSON.stringify([sq.n,sq.missing,sq.excused]));
  check(g.a.every(x=>x.unread===0) && g.unread===0,'no unread cells');
  check(g.a.filter(x=>x.name.startsWith('Unit')).every(x=>x.excused===1),'the all-NG student is excused on every unit assignment');
  // through the UI: import attaches to a class and Data Lab lists the assignments
  const ixl=fs.readdirSync('fixtures').filter(f=>/^f1473588.*7T1A/.test(f)).map(f=>path.resolve('fixtures',f));
  await p.setInputFiles('#file', ixl); await p.waitForTimeout(500); await p.click('#rpSkip').catch(()=>{}); await p.waitForTimeout(200);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500);
  check(await p.locator('[data-sec]').count()===1,'picker offers the imported class');
  await p.click('[data-sec]'); await p.waitForTimeout(500);
  const s=await p.evaluate(()=>{ const s=window.__tally.state.sections['1205050-7T1A']; return s.grades && { n:s.grades.assignments.length, students:s.grades.students.length }; });
  check(s && s.n===13 && s.students===23,'gradebook attached to the class: '+JSON.stringify(s));
  // a mixed drop with the gradebook listed FIRST still works: IXL grids import before gradebooks attach,
  // and the picker points at the class whose IXL names match
  const p3=await ctx.newPage(); p3.on('dialog',d=>d.accept()); await p3.goto('file://'+path.resolve('Tally.html')); await p3.evaluate(()=>{localStorage.clear(); sessionStorage.clear();}); await p3.reload(); await p3.waitForTimeout(300);
  const realIxl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p3.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv'), path.resolve('fixtures',realIxl), path.resolve('fixtures', fs.readdirSync('fixtures').find(f=>/^f1473588.*7T3A/.test(f)))]); await p3.waitForTimeout(900);
  check(await p3.locator('.picks [data-sec]').count()===2,'picker offers classes even though the gradebook was first in the drop');
  const sug=await p3.locator('.picks .chip.on'); check(await sug.count()===1 && /1st Period/.test(await sug.textContent()) && /names match/.test(await sug.textContent()),'picker suggests the class whose names match: '+(await sug.textContent().catch(()=>'')));
  await sug.click(); await p3.waitForTimeout(400);
  check(await p3.evaluate(()=>{const s=window.__tally.state.sections['1205050-7T1A']; return !!(s.grades && s.grades.assignments.length===13);}),'gradebook attached to the suggested class');
  await p3.close();
  // a class with no pasted roster gets one from the gradebook (Focus order, with IDs); a differing pasted roster gets an offer
  const p4=await ctx.newPage(); p4.on('dialog',d=>d.accept()); await p4.goto('file://'+path.resolve('Tally.html')); await p4.evaluate(()=>localStorage.clear()); await p4.reload(); await p4.waitForTimeout(300);
  await p4.setInputFiles('#file',[path.resolve('fixtures',realIxl)]); await p4.waitForTimeout(500); await p4.click('#rpSkip'); await p4.waitForTimeout(200);
  await p4.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p4.waitForTimeout(500); await p4.click('[data-sec]'); await p4.waitForTimeout(600);
  check(/roster filled in from the gradebook/.test(await p4.textContent('#toast')),'toast says the roster came from the gradebook');
  const rs=await p4.evaluate(()=>{ const T=window.__tally; const s=Object.values(T.state.sections)[0]; const rows=T.parseRosterText(s.roster); const br=T.buildRows(s); return { n:rows.length, first:rows[0].display, id:rows[0].id, ok:br.filter(r=>r.status==='ok').length }; });
  check(rs.n===23 && rs.first==='SUTTER, HAYDEN SKYLER' && rs.id==='1111860421' && rs.ok===16,'roster has the 23 gradebook students with IDs, in Focus order, matched to IXL: '+JSON.stringify(rs));
  await p4.evaluate(()=>{ const T=window.__tally; const s=Object.values(T.state.sections)[0]; s.roster=s.roster.split('\n').slice(0,20).join('\n')+'\nNEWKID, SOMEONE'; T.save(); T.render(); });
  await p4.waitForTimeout(300); const nt=await p4.textContent('#notices');
  check(/class list differs from the pasted roster/.test(nt) && /3 students in the gradebook but not on the roster/.test(nt) && /1 student on the roster but not in the gradebook/.test(nt),'differing roster → notice with counts');
  await p4.click('[data-gbroster]'); await p4.waitForTimeout(400);
  check((await p4.evaluate(()=>window.__tally.parseRosterText(Object.values(window.__tally.state.sections)[0].roster).length))===23 && !/class list differs/.test(await p4.textContent('#notices')),'"Use the gradebook\'s list" replaces the roster and clears the notice');
  await p4.close();
  check(errs.length===0,'no page errors: '+errs.join(' | '));
  await b.close(); done();
})();
