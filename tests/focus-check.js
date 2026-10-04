// Focus check against a real class (scrubbed): IXL export of 2026-09-26, the Focus roster, and the Focus
// gradebook whose "Unit 1 IXL" (15 pts) and "Unit 2 IXL" (17 pts) columns must map back to the IXL units.
// Seven roster names are scrubber artifacts (the scrubber gave IXL and Focus different fake names) and stay unmatched.
const { chromium, fs, path, exe, check, done, tmp, unskip, APP, pick } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1400,height:900}}); await ctx.grantPermissions(['clipboard-read','clipboard-write']); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP)); await unskip(p);
  const ixl=fs.readdirSync('fixtures').find(f=>f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file',[path.resolve('fixtures',ixl)]); await p.waitForTimeout(600);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt','utf8')); await p.click('#rpSave'); await p.waitForTimeout(400);
  await p.setInputFiles('#file',[path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(500);
  const rc=await p.evaluate(()=>window.__tally.reconcile(Object.values(window.__tally.state.sections)[0]).map(c=>({unit:c.unit.short,a:c.assignment.name,max:c.assignment.max,total:c.unit.total,maxOK:c.maxOK,counts:c.counts})));
  console.log(JSON.stringify(rc));
  check(rc.length===2 && rc.map(c=>c.unit+'←'+c.a).join('|')==='Unit 2←Unit 2 IXL|Unit 1←Unit 1 IXL','both Focus IXL columns auto-mapped to their units');
  check(rc.find(c=>c.unit==='Unit 2').maxOK===true && rc.find(c=>c.unit==='Unit 1').maxOK===false,'Unit 2 points agree (17); Unit 1 flagged (Focus 15 vs 23 skills)');
  const u2=rc.find(c=>c.unit==='Unit 2'); check(u2.counts.match+u2.counts.differ+u2.counts.missing+u2.counts.stale+u2.counts.unmatched===23,'every gradebook row accounted for');
  check(await p.locator('.fcheck').count()===2,'two unit headers carry a Focus badge');
  check(/Focus doesn't match Tally/.test(await p.textContent('#notices')),'summary notice flags the mismatch');
  await p.click('.fcheck[data-fc="Unit 2 Rational and Irrational Numbers"]'); await p.waitForTimeout(300);
  const txt=await p.textContent('#modal');
  check(/Focus check · Unit 2/.test(txt) && /17 points/.test(txt) && /out of 17/.test(txt),'check panel shows the pairing');
  const rows=await p.locator('.checkTable tbody tr').count(); check(rows===u2.counts.differ+u2.counts.missing+u2.counts.stale+u2.counts.unmatched,'panel lists only the students needing attention: '+rows);
  // the weekly check: the count is the headline, the column mapping is folded away, one filled button
  const wk=await p.evaluate(()=>{ const m=document.querySelector('#modal'); const lead=m.querySelector('.checkSummary.lead'); const vis=el=>!!(el && el.checkVisibility()); return { lead:lead?lead.textContent.replace(/\s+/g,' ').trim():'', first:m.querySelector('.body').firstElementChild===lead, map:vis(m.querySelector('#gbMap')), fold:(m.querySelector('.fcmap summary')||{}).textContent, pick:!!m.querySelector('[data-sk]'), primary:[...m.querySelectorAll('.rp-actions .pill')].filter(b=>!b.classList.contains('pale')).map(b=>b.textContent.trim()).join('|'), words:[...m.querySelectorAll('.checkTable tbody tr.differ td:nth-child(4)')].filter(td=>{ const c=td.cloneNode(true); c.querySelectorAll('.vh').forEach(x=>x.remove()); return c.textContent.trim()!==''; }).length }; });
  check(wk.first && new RegExp('^'+u2.counts.match+' match').test(wk.lead),'the weekly check opens on the count: '+wk.lead);
  check(!wk.map && /Wrong column\?/.test(wk.fold) && !wk.pick,'"which Focus column is this" is folded behind "Wrong column?" and there is no skill tick-list');
  check(rows ? new RegExp('^Copy \\d+ corrections?$').test(wk.primary) : wk.primary==='','one filled button, and it says how many: '+wk.primary);
  check(wk.words===0,'a coral row does not also spell out "Focus differs from Tally"');
  await p.screenshot({path:path.join(tmp,'shot23.png')});
  if (rows) { await p.click('#copyFix'); await p.waitForTimeout(300); const clip=await p.evaluate(()=>navigator.clipboard.readText()); check(clip.split('\n').every(l=>/\t\d+$/.test(l)),'corrections copy is name ⇥ Tally points'); }
  // skip-to-match suggestion: Unit 1 has 23 skills vs 15 Focus points → offer the 8 least-touched skills, apply, points now agree
  await p.click('#mCancel'); await p.waitForTimeout(300);
  await p.click('.fcheck[data-fc="Unit 1 Equations and Inequalities"]'); await p.waitForTimeout(300);
  const su=await p.evaluate(()=>{ const m=document.querySelector('#modal'); const vis=el=>!!(el && el.checkVisibility()); return { title:m.querySelector('header h2').textContent, table:vis(m.querySelector('.checkTable')), map:vis(m.querySelector('#gbMap')), keep:[...m.querySelectorAll('[data-keep]')].filter(vis).length, primary:[...m.querySelectorAll('.pill')].filter(b=>vis(b) && !b.classList.contains('pale')).map(b=>b.textContent.trim()).join('|'), folds:[...m.querySelectorAll('details.fold > summary')].map(s=>s.textContent.replace(/\s+/g,' ').trim()).join(' | ') }; });
  check(su.title==='Set up Unit 1 for Focus' && !su.table && su.keep===0 && !su.map && su.primary==='Skip the ticked skills','when the points don\'t agree the dialog is only the setup question — no student table, no "Keep Focus" buttons, one filled button: '+su.title);
  check(/Student by student/.test(su.folds) && /Wrong column\?/.test(su.folds),'the student rows and the column mapping are one tap away, folded: '+su.folds);
  const sugg=await p.textContent('#modal'); check(/Focus's "Unit 1 IXL" is out of 15\./.test(sugg) && /Tally counts 23 skills in Unit 1/.test(sugg) && /Which 8 don't count\?/.test(sugg) && await p.locator('[data-sk]:checked').count()===8 && await p.locator('[data-sk]').count()===23 && /matches Focus/.test(await p.textContent('#skipCount')),'panel lists all 23 skills with the 8 least-touched pre-ticked and a live count');
  await p.locator('[data-sk]:checked').first().uncheck(); await p.waitForTimeout(100); check(/out of 16/.test(await p.textContent('#skipCount')) && /Focus: 15/.test(await p.textContent('#skipCount')),'unticking one updates the count');
  await p.locator('[data-sk]:not(:checked)').first().check(); await p.waitForTimeout(100);
  await p.click('#skipCand'); await p.waitForTimeout(400);
  const u1=await p.evaluate(()=>{const T=window.__tally; const c=T.reconcile(Object.values(T.state.sections)[0]).find(c=>c.unit.short==='Unit 1'); return {maxOK:c.maxOK,total:c.unit.total,counts:c.counts};});
  console.log(JSON.stringify(u1));
  check(u1.maxOK===true && u1.total===15,'after applying, Tally counts 15 for Unit 1 and the points warning clears');
  check(!/don't count\?/.test(await p.textContent('#modal')) && (await p.textContent('#modal header h2'))==='Focus check · Unit 1' && await p.locator('[data-sk]').count()===0,'once the points agree the same dialog is the weekly check');
  await p.screenshot({path:path.join(tmp,'shot24.png')});
  // remap: mark the Unit 1 column as "not an IXL unit" → badge disappears
  await p.click('.fcmap > summary'); await p.waitForTimeout(150); await p.selectOption('#gbMap',''); await p.waitForTimeout(400);
  check(await p.locator('.fcheck').count()===1,'a column can be unmapped');
  // stale detection: copy Unit 2 now (receipt), then simulate a student's later gain by lowering focus… use receipt path: set focus value to tally then bump tally? Simulate by editing receipt
  const ui=await p.evaluate(()=>window.__tally.unitsOf(Object.values(window.__tally.state.sections)[0]).findIndex(u=>u.short==='Unit 2')); await p.click(`.copy[data-c="${ui}"]`); await p.waitForTimeout(300);
  const st=await p.evaluate(()=>{const T=window.__tally; const s=Object.values(T.state.sections)[0]; const u=T.unitsOf(s).find(u=>u.short==='Unit 2'); const rc=s.receipts[u.name]; const a=s.grades.assignments.find(a=>a.name==='Unit 2 IXL'); const rows=T.gbRows(s);
    // make Focus equal what was copied for everyone (as if pasted), then pretend one student gained 2 skills by recording a lower receipt for them
    rows.forEach((r,i)=>{ const rr=rc.rows.find(x=>x[0]===r.display); if(rr&&rr[1]!=null) a.values[i]=rr[1]; });
    const first=rows.findIndex(r=>r.ixl!=null); a.values[first]=Math.max(0,a.values[first]-2); const rr=rc.rows.find(x=>x[0]===rows[first].display); rr[1]=a.values[first];
    return T.reconcile(s).find(c=>c.unit.short==='Unit 2').counts;});
  console.log(JSON.stringify(st));
  check(st.stale===1 && st.differ===0,'a student who gained since the copy reads as "up since copy", not as an error');
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
