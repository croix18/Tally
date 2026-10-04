const { chromium, fs, path, exe, check, done, tmp, need, APP, SCRUB } = require('./lib');
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext(); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.resolve(SCRUB));
  // name shapes preserved
  const shapes=await p.evaluate(()=>{const S=window.__scrub.scrubName; return ['Olivia De La Cruz','De La Cruz, Olivia M','Ben Taylor Jr.','Taylor, Ben Jr.',"Seán O'Brien","Smith-Jones, Mary Ann",'JOSE GARCIA','Ava Nguyen','Nguyen, Ava'].map(n=>[n,S(n)]);});
  console.log(JSON.stringify(shapes));
  const shape=s=>s.replace(/[A-Za-zÀ-ɏ]+/g,'w');
  check(shapes.every(([a,b])=>shape(a)===shape(b)),'punctuation/word shape preserved');
  check(shapes.every(([a,b])=>a!==b),'every name changed');
  check(/De La /.test(shapes[0][1]) && /Jr\./.test(shapes[2][1]) && /'/.test(shapes[4][1]) && /-/.test(shapes[5][1]),'particles, suffixes, apostrophes, hyphens kept');
  const av=shapes.find(x=>x[0]==='Ava Nguyen')[1].split(' '), na=shapes.find(x=>x[0]==='Nguyen, Ava')[1].split(', ');
  check(av[0]===na[1] && av[1]===na[0],'same student → same fake in both name orders: '+av.join(' ')+' / '+na.join(', '));
  const c1=shapes[0][1].split(' ').pop(), c2=shapes[1][1].split(',')[0].split(' ').pop(); check(c1===c2,'multi-word surname consistent across orders: '+c1+' / '+c2);
  check(shapes[2][1].split(' ')[1]===shapes[3][1].split(',')[0],'suffix name consistent across orders');
  check(/O'/.test(shapes[4][1]),"O'Brien keeps its O'");
  check(shapes.find(x=>x[0]==='JOSE GARCIA')[1]===shapes.find(x=>x[0]==='JOSE GARCIA')[1].toUpperCase(),'capitalization pattern kept');
  // scrub the IXL xlsx fixture and the messy gradebook; then confirm Tally reads them identically (numbers) with no original names
  const ixl=fs.readdirSync('fixtures').find(f=>/^f1473588.*7T1A/.test(f));
  const outs=[];
  for (const f of ['fixtures/'+ixl,'fixtures/gb_messy.csv','fixtures/gb_messy.xls']) { const [dl]=await Promise.all([p.waitForEvent('download'), p.setInputFiles('#file', path.resolve(f))]); const dst=path.join(tmp, 'scrubbed_'+path.basename(f)); fs.copyFileSync(await dl.path(), dst); outs.push(dst); await p.waitForTimeout(200); }
  const log=await p.textContent('#log'); check(/IXL Score Grid/.test(log) && (log.match(/Gradebook/g)||[]).length===2,'both file kinds detected');
  const gbTxt=fs.readFileSync(outs[1],'utf8'); check(!/De La Cruz, Olivia|O'Brien, Seán|Smith-Jones, Mary Ann|Taylor, Ben Jr|1000234|olivia\.delacruz/.test(gbTxt) &&   /* full originals, since a random fake surname can legitimately be "Taylor" */ /Unit 1 Test 100 pts 09\/12/.test(gbTxt) && /17\/20/.test(gbTxt) && /@example\.org/.test(gbTxt),'gradebook CSV: names, IDs, emails replaced; everything else intact');
  const htmlTxt=fs.readFileSync(outs[2],'utf8'); check(!/Olivia|Brien/.test(htmlTxt) && /<table>/.test(htmlTxt) && /Jr\./.test(htmlTxt),'HTML-as-xls scrubbed in place');
  // Tally round trip
  const t=await ctx.newPage(); await t.goto('file://'+path.resolve(APP)); t.on('dialog',d=>d.accept());
  await t.setInputFiles('#file',[path.resolve('fixtures/'+ixl)]); await t.waitForTimeout(500);
  const orig=await t.evaluate(()=>{const s=window.__tally.state.sections['1205050-7T1A']; return {students:s.students.slice(), sum:s.scores.flat().reduce((a,b)=>a+(b||0),0), n:s.skills.length};});
  await t.evaluate(()=>localStorage.clear()); await t.reload(); await t.waitForTimeout(300);
  await t.setInputFiles('#file',[outs[0]]); await t.waitForTimeout(600);
  const scr=await t.evaluate(()=>{const s=window.__tally.state.sections['1205050-7T1A']; return {students:s.students.slice(), sum:s.scores.flat().reduce((a,b)=>a+(b||0),0), n:s.skills.length};});
  check(scr.sum===orig.sum && scr.n===orig.n && scr.students.length===orig.students.length,'scrubbed xlsx: identical scores and structure');
  check(scr.students.every((s,i)=>s!==orig.students[i] && s.split(' ').length===orig.students[i].split(' ').length),'scrubbed xlsx: every name different, same word count');
  await t.click('[data-k="1205050-7T1A"]'); await t.waitForTimeout(150); await t.click('#rpSkip'); await t.waitForTimeout(150);
  await t.setInputFiles('#file',[outs[2]]); await t.waitForTimeout(400); await t.click('[data-sec="1205050-7T1A"]'); await t.waitForTimeout(300);
  const g=await t.evaluate(()=>window.__tally.state.sections['1205050-7T1A'].grades.assignments.map(a=>[a.name,a.max,a.values]));
  check(g.length===2 && g[0][0]==='Unit 1 Test' && g[0][1]===100 && JSON.stringify(g[1][2])==='[17,0,19,null]','Tally imports the scrubbed HTML gradebook correctly');
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
