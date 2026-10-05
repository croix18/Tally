// Chart colours mean what anyone would guess, and the Board's heading reads like a heading.
//   · letter grades: A green, B blue, C yellow, D orange, F red — one set, the same in charts, chips and tokens
//   · the five stay apart for colour-blind readers (same maths as the palette validator used to choose them), and no
//     mark relies on colour alone: slices and segments carry the letter or the number
//   · a class's own plot wears that class's colour; class against class uses the class colours
//   · the Board heading is a title and one ordinary line of facts — no "Data Lab · … · … · …" chain
const { chromium, fs, path, exe, check, done, pick, APP } = require('./lib');
const hex = h => [0, 2, 4].map(i => parseInt(h.replace('#', '').slice(i, i + 2), 16) / 255);
const lin = h => hex(h).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const oklab = ([r, g, b]) => { const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b); return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]; };
// Machado, Oliveira & Fernandes (2009), severity 1.0, on linear RGB
const CVD = { protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]], deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]] };
const sim = (h, k) => { const v = lin(h); return k ? CVD[k].map(row => Math.max(0, Math.min(1, row[0] * v[0] + row[1] * v[1] + row[2] * v[2]))) : v; };
const dE = (a, b, k) => { const x = oklab(sim(a, k)), y = oklab(sim(b, k)); return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const hue = h => { const [r, g, b] = hex(h); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; };
const rgb = h => 'rgb(' + hex(h).map(c => Math.round(c * 255)).join(', ') + ')';
(async()=>{
  // ---- 1. the palette itself -------------------------------------------------------------------------------
  const charts=fs.readFileSync('charts.js','utf8'), html=fs.readFileSync('app.html','utf8');
  const m=charts.match(/const LETTER_COLORS = \{([^}]*)\}/); const L={}; if (m) [...m[1].matchAll(/([A-F]):\s*'(#[0-9a-fA-F]{6})'/g)].forEach(x=>L[x[1]]=x[2].toLowerCase());
  check(Object.keys(L).join('')==='ABCDF','charts.js defines one colour per letter: '+JSON.stringify(L));
  const tok=k=>((html.match(new RegExp('--g-'+k.toLowerCase()+':\\s*(#[0-9a-fA-F]{6})'))||[])[1]||'').toLowerCase();
  check(['A','B','C','D','F'].every(k=>tok(k)===L[k]),'the --g-* tokens in app.html are the same five colours');
  const fam={ A:h=>h>=90&&h<=165, B:h=>h>=190&&h<=250, C:h=>h>=45&&h<=65, D:h=>h>=20&&h<45, F:h=>h>=345||h<=12 };
  check(['A','B','C','D','F'].every(k=>fam[k](hue(L[k]))),'A is green, B blue, C yellow, D orange, F red: '+['A','B','C','D','F'].map(k=>k+' '+Math.round(hue(L[k]))+'°').join(', '));
  let worst=[1e9,''], worstN=[1e9,'']; const ks=['A','B','C','D','F'];
  for (let i=0;i<5;i++) for (let j=i+1;j<5;j++) { for (const k of ['protan','deutan']) { const d=dE(L[ks[i]],L[ks[j]],k); if (d<worst[0]) worst=[d,ks[i]+'–'+ks[j]+' '+k]; } const d=dE(L[ks[i]],L[ks[j]]); if (d<worstN[0]) worstN=[d,ks[i]+'–'+ks[j]]; }
  check(worst[0]>=7.9,'every pair of grade colours stays apart with red-green colour blindness (worst '+worst[1]+' ΔE '+worst[0].toFixed(1)+', target 8)');
  check(worstN[0]>=15,'…and with full colour vision (worst '+worstN[1]+' ΔE '+worstN[0].toFixed(1)+')');
  check(!/GRADE_COLORS/.test(charts+fs.readFileSync('app.js','utf8')+fs.readFileSync('home.js','utf8')+fs.readFileSync('students.js','utf8')+fs.readFileSync('grades.js','utf8')),'no leftover reference to the old teal grade ramp');
  // ---- 2. in the running app ---------------------------------------------------------------------------------
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1536,height:864}}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await pick(p,'[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(700); const a=await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(300); } }
  await p.click('#btnHome'); await p.waitForTimeout(400);
  // Overview: letter chips and the stacked letter bars
  const ov=await p.evaluate(()=>{ const cs=getComputedStyle(document.documentElement); const tokv=k=>cs.getPropertyValue('--g-'+k).trim().toLowerCase();
    const chips=[...document.querySelectorAll('.hcard .letters i')].slice(0,5).map(i=>({k:(i.className.match(/\b[A-F]\b/)||[''])[0], bg:getComputedStyle(i).backgroundColor, t:i.textContent.trim()}));
    const svg=[...document.querySelectorAll('svg.chart')].find(s=>/letter grades/.test(s.getAttribute('aria-label')||''));
    const legend=svg?[...svg.querySelectorAll('.legend rect')].map((r,i)=>({fill:getComputedStyle(r).fill, t:svg.querySelectorAll('.legend text')[i].textContent})):[];
    const segs=svg?[...svg.querySelectorAll(':scope > rect')].map(r=>({fill:getComputedStyle(r).fill, title:r.querySelector('title').textContent, stroke:r.getAttribute('stroke')})):[];
    return { tok:['a','b','c','d','f'].map(tokv), chips, legend, segs }; });
  check(ov.tok.join()===ks.map(k=>L[k]).join(),'the tokens resolve in the page: '+ov.tok.join(' '));
  check(ov.legend.length===5 && ov.legend.every((l,i)=>l.t===ks[i] && l.fill===rgb(L[ks[i]])),'Overview "Letter grades by class": the legend is A green … F red');
  check(ov.segs.length>0 && ov.segs.every(s=>{ const k=(s.title.match(/, ([A-F]):/)||[])[1]; return k && s.fill===rgb(L[k]) && s.stroke; }),'…and every segment wears its letter\'s colour, with a hairline so yellow shows on white ('+ov.segs.length+' segments)');
  const washes=new Set(ov.chips.map(c=>c.bg)); check(ov.chips.length===5 && washes.size===5 && ov.chips.every(c=>/^[A-F]\s*\d+$/.test(c.t)),'the class card\'s five letter chips are five different tints, each with its letter and count: '+ov.chips.map(c=>c.t).join(' '));
  const chipHue=await p.evaluate(()=>[...document.querySelectorAll('.hcard .letters i')].slice(0,5).map(i=>{ const [r,g,b]=getComputedStyle(i).backgroundColor.match(/\d+/g).map(Number).map(v=>v/255); const mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn; const x=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4; return Math.round((x*60+360)%360); }));
  check(chipHue[0]>90&&chipHue[0]<170 && (chipHue[4]<25||chipHue[4]>340) && chipHue[1]>190&&chipHue[1]<250,'chip tints follow the same rule — A greenish, B bluish, F reddish ('+chipHue.join('°, ')+'°)');
  // Board → Data Lab, a Focus assessment as a circle graph
  await p.click('#btnLb'); await p.waitForTimeout(600); await p.click('[data-tab="lab"]'); await p.waitForTimeout(500);
  const gbId=await p.evaluate(()=>{ const o=[...document.querySelectorAll('#labUnit option')].find(o=>o.value.startsWith('gb:')); return o?o.value:null; });
  check(!!gbId,'the Data Lab offers a Focus assignment: '+gbId);
  await p.selectOption('#labUnit',gbId); await p.waitForTimeout(300); await p.selectOption('#labKind','circle'); await p.waitForTimeout(400);
  const head=await p.evaluate(()=>{ const h=document.querySelector('#lb .lbHead'); const t=h&&h.querySelector('h1.lbTitle'), s=h&&h.querySelector('.lbSub'); const note=document.querySelector('#lb .lgNote');
    return { title:t?t.textContent:'', sub:s?s.textContent:'', note:note?note.textContent:'', h1s:document.querySelectorAll('#lb h1').length, tSize:t?parseFloat(getComputedStyle(t).fontSize):0, sSize:s?parseFloat(getComputedStyle(s).fontSize):0, tSpace:t?getComputedStyle(t).letterSpacing:'', tCase:t?getComputedStyle(t).textTransform:'' }; });
  check(head.h1s===1 && head.title===gbId.slice(3),'the Board heading is one <h1> that names what is shown: "'+head.title+'"');
  check(/^[A-Z][^·—]*, [^·—]*$/.test(head.sub) && /classes, /.test(head.sub) && /as of /.test(head.sub),'under it, one ordinary line — who, what is measured, as of when: "'+head.sub+'"');
  check(!/Data Lab|·|—| - /.test(head.title+head.sub) ,'no "Data Lab · … · …" chain and no dashes in the heading');
  check(head.tSize>=head.sSize*1.6 && head.tSpace==='normal' && head.tCase==='none','the title is clearly the bigger of the two, in plain sentence case with normal spacing ('+head.tSize+' vs '+head.sSize+' px)');
  check(head.note==='' && await p.locator('#lb .labLegend').count()===0,'no line above the plots saying what a circle graph is');
  const pie=await p.evaluate(()=>[...document.querySelectorAll('#lb svg.chart.circle')].map(svg=>{ const paths=[...svg.querySelectorAll('path')].map(x=>({fill:getComputedStyle(x).fill, t:x.querySelector('title').textContent})); const labels=[...svg.querySelectorAll('text.val')].map(t=>{ const r=t.getBoundingClientRect(); return {t:t.textContent, l:r.left, r:r.right, top:r.top, b:r.bottom}; }); const leg=[...svg.querySelectorAll('rect')].map(r=>{ const q=r.getBoundingClientRect(); return {l:q.left, r:q.right, top:q.top, b:q.bottom, fill:getComputedStyle(r).fill}; }); const legT=[...svg.querySelectorAll('text.lbl')].map(t=>t.textContent.trim()); const box=svg.getBoundingClientRect(); return { paths, labels, leg, legT, l:box.left, r:box.right }; }));
  check(pie.length>=1 && pie.every(g=>g.paths.length>0 && g.paths.every(s=>{ const k=s.t[0]; return L[k] && s.fill===rgb(L[k]); })),'circle graph of a Focus assignment: every slice wears its letter\'s colour ('+pie.length+' graph'+(pie.length===1?'':'s')+')');
  check(pie.every(g=>g.labels.length>0 && g.labels.every(l=>/^[A-F] \d+%$/.test(l.t))),'…and is labelled with the letter and its share, so it does not rest on colour: '+pie[0].labels.map(l=>l.t).join(', '));
  check(pie.every(g=>g.leg.length===5 && g.legT.every((t,i)=>t[0]===ks[i]) && g.leg.every((r,i)=>r.fill===rgb(L[ks[i]]))),'the legend lists A to F with counts in the same colours');
  const hit=(a,b)=>a.l<b.r-0.5 && b.l<a.r-0.5 && a.top<b.b-0.5 && b.top<a.b-0.5;
  check(pie.every(g=>g.labels.every(l=>g.leg.every(r=>!hit(l,r)) && l.l>=g.l-1) && g.labels.every((a,i)=>g.labels.every((c,j)=>i>=j||!hit(a,c)))),'no slice label runs into the legend, off the graph, or into another label');
  // a unit's points as a circle graph: red → green for least → most done
  const unitId=await p.evaluate(()=>{ const o=[...document.querySelectorAll('#labUnit option')].find(o=>/^unit:(?!__)/.test(o.value)); return o?o.value:null; });
  if (unitId) { await p.selectOption('#labUnit',unitId); await p.waitForTimeout(400);
    const bands=await p.evaluate(()=>{ const svg=document.querySelector('#lb svg.chart.circle'); return svg?[...svg.querySelectorAll('rect')].map(r=>getComputedStyle(r).fill):[]; });
    check(bands.length===4 && bands[0]===rgb(L.F) && bands[3]===rgb(L.A) && new Set(bands).size===4,'a unit\'s circle graph runs red (under a quarter) to green (three quarters or more): '+bands.join(' → ')); }
  // a class's own plot wears the class colour
  await p.selectOption('#labKind','hist'); await p.waitForTimeout(400);
  const own=await p.evaluate(()=>[...document.querySelectorAll('#lb .labRow')].map(r=>{ const cc=r.style.getPropertyValue('--cc').trim(); const bar=r.querySelector('svg .bar'); const probe=document.createElement('i'); probe.style.color=cc; document.body.appendChild(probe); const want=getComputedStyle(probe).color; probe.remove(); return { want, got:bar?getComputedStyle(bar).fill:null }; }));
  check(own.length>0 && own.every(o=>o.got===o.want),'a histogram\'s bars are the colour of the class they belong to ('+own.map(o=>o.got).join(' / ')+')');
  await p.selectOption('#labKind','box'); await p.waitForTimeout(400);
  const hint=await p.evaluate(()=>{ const h=document.querySelector('#lb .labHint'); const lg=document.querySelector('#lb .lgNote'); return (h?h.textContent:'')+' | '+(lg?lg.textContent:''); });
  check(!/—/.test(hint) && /Whiskers run from the minimum to the maximum\./.test(hint),'the box plot keeps its key (a key is not a description), in sentences without dashes: '+hint.slice(0,110));
  // Race heading
  await p.click('[data-tab="race"]'); await p.waitForTimeout(500);
  const race=await p.evaluate(()=>({ t:document.querySelector('#lb h1.lbTitle').textContent, s:(document.querySelector('#lb .lbSub')||{textContent:''}).textContent, basis:[...document.querySelectorAll('#lb .lbBasis')].map(e=>e.textContent).join(' | ') }));
  check(race.t==='Race' && /^(Counting [^,]+, as|As) of \w+ \d+$/.test(race.s) && !/assigned:/.test(race.basis),'the Race heading follows the same pattern: "'+race.t+'" / "'+race.s+'"'+(race.basis?' / '+race.basis:''));
  // Grades: a class's scatter is its colour; a student's category bars are the colour of the letter they earn
  await p.locator('#lbExit').dispatchEvent('pointerdown'); await p.waitForTimeout(1200);
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('#openGrades'); await p.waitForTimeout(500);
  const onGrades=await p.evaluate(()=>{ const sc=document.querySelector('svg.scatter'); const pt=sc&&sc.querySelector('.pt'); const probe=document.createElement('i'); probe.style.color=sc?sc.style.getPropertyValue('--cc'):''; document.body.appendChild(probe); const want=getComputedStyle(probe).color; probe.remove(); return { has:!!sc, got:pt?getComputedStyle(pt).fill:null, want, cc:sc?sc.style.getPropertyValue('--cc'):'' }; });
  if (onGrades.has) check(onGrades.got===onGrades.want && /^#/.test(onGrades.cc),'the Grades scatter plot wears its class\'s colour ('+onGrades.cc+')');
  else console.log('note: no scatter in this fixture (needs 8 students with both) '+JSON.stringify(onGrades));
  const row=p.locator('.gstu tr[data-stu]').first(); if (await row.count()) { await row.click(); await p.waitForTimeout(500);
    const bars=await p.evaluate(()=>[...document.querySelectorAll('.catline .catbar')].map(c=>{ const i=c.querySelector('.bar i'); const pct=parseFloat(c.querySelector('b').textContent); return { pct, fill:getComputedStyle(i).backgroundColor }; }).filter(x=>!isNaN(x.pct)));
    const letter=v=>v>=90?'A':v>=80?'B':v>=70?'C':v>=60?'D':'F';
    check(bars.length>0 && bars.every(x=>x.fill===rgb(L[letter(Math.round(x.pct))])),'on a student\'s page each category bar is the colour of the letter that percent earns: '+bars.map(x=>x.pct+'% '+letter(Math.round(x.pct))).join(', ')); }
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
