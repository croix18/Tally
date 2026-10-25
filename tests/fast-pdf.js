// The FLDOE score report PDF ("Score, Achievement and Points Earned on Grade N FAST Mathematics (PM1 2026-27) … by
// Student and Reporting Category"; Croix, 24 Oct 2026: "it will fill in their percentiles as well as give more in depth
// detail of the standard sections broken down. I can only get it as a pdf"). The fixtures are drawn by
// fixtures/make_fast_items_pdf.py in the report's shape, with the answers beside them in JSON.
const { chromium, fs, path, exe, check, done, APP, pick } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1300,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const K='1205050-7T1A'; const S=await p.evaluate(K=>window.__tally.state.sections[K].grades.students,K);
  const truth=JSON.parse(fs.readFileSync('fixtures/fast_items_g8.json','utf8'));

  // 1. the Focus FAST report came first with PM1 levels and scales (and the above-grade flag); the PDF adds to it
  await p.evaluate(({S})=>{ const T=window.__tally; T.importFast({ students:[{ id:'', name:S[0], grade:7, tests:[{ test:'FAST', pm:'PM1', year:'2026-27', level:9, scale:999, above:true }], info:{ L30:'Y' } }], blank:0, windows:[{ pm:'PM1', year:'2026-27' }] }, 'focus.csv'); },{S});

  // 2. the parser alone, on the grade-7 and grade-8 fixtures
  for (const g of [7,8]) {
    const buf=fs.readFileSync(`fixtures/fast_items_g${g}.pdf`); const ans=JSON.parse(fs.readFileSync(`fixtures/fast_items_g${g}.json`,'utf8'));
    const fx=await p.evaluate(async b64=>{ const T=window.__tally; const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); const pages=await T.pdfTextPages(u8.buffer); const fx=T.parseFastItemsPdf(pages); return fx && { grade:fx.grade, pm:fx.pm, year:fx.year, cats:fx.cats, students:fx.students }; }, buf.toString('base64'));
    check(fx && fx.grade===g && fx.pm==='PM1' && fx.year==='2026-27' && JSON.stringify(fx.cats)===JSON.stringify(ans.cats),`grade ${g}: the test, the window and the four reporting categories are read from the headers: `+(fx?`${fx.pm} ${fx.year} grade ${fx.grade}, ${fx.cats.length} categories`:'nothing'));
    const byId=Object.fromEntries((fx?fx.students:[]).map(s=>[s.fleid,s]));
    const bad=ans.rows.filter(r=>{ const s=byId[r.fleid]; if (!s) return true; const pct=r.pct==null?null:r.pct; const cats=ans.cats.filter((c,ci)=>!(ans.skip[ci]||[]).includes(r.fleid)); const want=Object.fromEntries(cats.map((c,i)=>[c, { 'Below the Standard':'below','At/Near the Standard':'near','Above the Standard':'above' }[r.cats[ans.cats.indexOf(c)]]]));
      return s.name!==r.name || s.scale!==r.scale || s.level!==r.level || s.pct!==pct || JSON.stringify(s.cats)!==JSON.stringify(want); }).map(r=>r.name+': '+JSON.stringify(byId[r.fleid]));
    check(fx && fx.students.length===ans.rows.length && bad.length===0,`grade ${g}: every student's name (one wrapped onto two lines), scale, level, percentile (n/a and <1 included) and category results match the answers (${ans.rows.length} students)`+(bad.length?': '+bad.slice(0,2).join(' | '):''));
  }

  // 3. dropping the PDF on Tally: matched by name, merged into the window on file, shown on the page and the report
  await p.setInputFiles('#file',[path.resolve('fixtures/fast_items_g8.pdf')]); await p.waitForTimeout(3000);
  const toast=await p.textContent('#toast');
  check(/FAST score report \(PM1 2026-27, Math Grade 8 FAST\): 23 students matched to your classes by name · percentiles and 4 reporting categories added\./.test(toast),'the import says what it matched and what it added: '+toast.slice(0,160));
  const merged=await p.evaluate(({K,S})=>{ const T=window.__tally; const s=T.state.sections[K]; const h=T.testHistory(s,S[0]).find(x=>x.pm==='PM1'); const fi=T.state.testInfo; const k=Object.keys(fi).find(k=>fi[k].FAST && fi[k].FAST.fields.FLEID); return { h, fields:k?fi[k].FAST.fields:null }; },{K,S});
  const r0=truth.rows[0];
  check(merged.h && merged.h.scale===r0.scale && merged.h.level===r0.level && merged.h.pct===r0.pct && merged.h.grade===8 && merged.h.above===true && merged.h.cats && Object.keys(merged.h.cats).length===3,'the PM1 record from the Focus report keeps its above-grade flag and gains the PDF\'s score, level, percentile, test grade and categories: '+JSON.stringify(merged.h));
  check(merged.fields && merged.fields.FLEID && merged.fields.L30==='Y','the FLEID is kept beside the Focus report\'s other columns');
  const wrapped=await p.evaluate(({K,S})=>{ const T=window.__tally; const s=T.state.sections[K]; const h=T.testHistory(s,S[2]).find(x=>x.pm==='PM1'); return h && h.pct; },{K,S});
  check(wrapped===truth.rows[2].pct,'a name that wrapped onto two lines in the PDF still reached its student: '+wrapped);
  const tg=await p.evaluate(({K,S})=>{ const T=window.__tally; const t=T.fastTargets(T.state.sections[K],S[0]); return t && t.gradeNow; },{K,S});
  check(tg===8,'the targets sit on the test the report names (grade 8)');
  await p.evaluate(({K,S})=>window.__tally.openProfile(K,S[0]),{K,S}); await p.waitForTimeout(400);
  const page=(await p.textContent('#pTests')).replace(/\s+/g,' ');
  check(/By topic PM1 2026-27/.test(page) && /Number Sense and Operations and Probability (Below|At or near|Above)/.test(page) && !/^\d\. /.test(page),'the student page lists the categories by name, numbered no more, each with its result');
  const [fr]=await Promise.all([ctx.waitForEvent('page'), p.click('#pFast')]); await fr.waitForLoadState(); await fr.waitForTimeout(500);
  const frTxt=(await fr.evaluate(()=>document.body.innerText)).replace(/\s+/g,' '); const frPages=(await fr.pdf({format:'Letter'})).toString('latin1').match(/\/Type\s*\/Page[^s]/g).length;
  check(frPages===1 && /BY TOPIC PM1/.test(frTxt) && await fr.locator('.topics td.c.on').count()===3 && /\d+(st|nd|rd|th) percentile/.test(frTxt),'the FAST report has a By topic table (one mark per category) and the percentile, still on one page');
  await fr.close();
  // 4. a second drop of the same PDF changes nothing; a PDF that is not the score report is refused in words
  const before=await p.evaluate(()=>JSON.stringify(window.__tally.state.tests));
  await p.setInputFiles('#file',[path.resolve('fixtures/fast_items_g8.pdf')]); await p.waitForTimeout(3000);
  check(await p.evaluate(()=>JSON.stringify(window.__tally.state.tests))===before,'importing the same PDF again changes nothing');
  const other=path.join(require('os').tmpdir(),'not-fast.pdf'); fs.writeFileSync(other, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>');
  await p.setInputFiles('#file',[other]); await p.waitForTimeout(2500);
  check(/not a PDF Tally reads|could not read this PDF/.test(await p.textContent('#toast')),'another PDF is refused with a reason: '+(await p.textContent('#toast')).slice(0,120));
  check(await p.evaluate(()=>JSON.stringify(window.__tally.state.tests))===before,'…and leaves the scores alone');
  console.log('errors:',errs); check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
