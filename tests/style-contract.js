// One scale for corners, control heights and weights. Every such value in the app's own CSS is a token from the
// `tallyTokens` block; a page saved out of Tally (Race, Data Lab) carries the same block. Printed pages are plain
// black-and-white documents and keep their own literal styles.
const { chromium, fs, path, exe, check, done, tmp, pick, more, APP } = require('./lib');
(async()=>{
  const html=fs.readFileSync('app.html','utf8');
  const tokens=(html.match(/<style id="tallyTokens">([\s\S]*?)<\/style>/)||[])[1]||'';
  const defined=new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m=>m[1]));
  check(tokens.length>0 && ['--r-xs','--r-s','--r-m','--r','--r-l','--r-pill','--h-s','--h-m','--h-touch','--h-l','--w-reg','--w-med','--w-bold','--w-heavy','--w-black'].every(t=>defined.has(t)),'the token block defines the radius, height and weight scales ('+defined.size+' tokens)');
  // the app's CSS: every <style> in app.html but the tokens, and the CSS kept in JS that is injected into the app
  const blocks=[['app.html',[...html.matchAll(/<style(?![^>]*tallyTokens)[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n')]];
  for (const [f,names] of [['app.js',['LB_CSS','LAB_ONLY_CSS']],['charts.js',['CHART_CSS']],['students.js',['STU_CSS']]]) { const t=fs.readFileSync(f,'utf8'); for (const n of names) { const a=t.indexOf('const '+n+' = `'); const b=t.indexOf('`;',a); check(a>0 && b>a,f+' has '+n); blocks.push([f+':'+n,t.slice(a,b)]); } }
  const css=blocks.map(b=>b[1].replace(/@font-face\s*\{[^}]*\}/g,'')).join('\n');
  const lit=(re)=>[...css.matchAll(re)].map(m=>m[0]);
  const radii=lit(/border-radius:\s*\d+(?:\.\d+)?px/g); check(radii.length===0,'no corner radius is a bare number — all come from --r-* ('+(radii.slice(0,5).join(', ')||'none')+')');
  const weights=lit(/font-weight:\s*(?:\d{3}|bold)\b/g); check(weights.length===0,'no font weight is a bare number — all come from --w-* ('+(weights.slice(0,5).join(', ')||'none')+')');
  const heights=lit(/min-height:\s*(?:3\d|4\d|5[0-2])px/g); check(heights.length===0,'no control height (30–52 px) is a bare number — all come from --h-* ('+(heights.slice(0,5).join(', ')||'none')+')');
  // fixed-size round buttons use the same scale (width and height are not caught by the min-height rule above)
  const round=[...css.matchAll(/(#top \.ibtn|#modal header button)\{([^}]*)\}/g)].map(m=>m[2]); check(round.length>=2 && round.every(d=>!/(?:^|;)(?:width|height):\s*\d+px/.test(d)),'the round header buttons and the dialog × take their size from --h-touch');
  // not covered, on purpose: inline style="…" in templates, and printed pages
  const used=new Set([...css.matchAll(/var\((--(?:r|h|w|t)-[a-z0-9-]+|--r)\b/g)].map(m=>m[1])); const missing=[...used].filter(t=>!defined.has(t));
  check(used.size>=14 && missing.length===0,'every scale token the CSS uses is defined ('+used.size+' in use'+(missing.length?'; missing '+missing.join(', '):'')+')');
  const count=k=>[...css.matchAll(new RegExp('var\\(--'+k+'\\)','g'))].length;
  console.log('usage: '+['r-xs','r-s','r-m','r','r-l','r-pill','h-s','h-m','h-touch','h-l','w-reg','w-med','w-bold','w-heavy','w-black'].map(k=>k+' '+count(k)).join(' · '));
  // a saved Board page is a separate file: it must carry the tokens or every corner and weight in it falls back to nothing
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1366,height:768},acceptDownloads:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.resolve(APP));
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await pick(p,'[data-sec="__new__"]'); await p.waitForTimeout(200); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(700); const a=await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(300); } }
  const live=await p.evaluate(()=>{ const cs=getComputedStyle(document.documentElement); const g=n=>cs.getPropertyValue(n).trim(); const btn=getComputedStyle(document.querySelector('#btnImport')); return { pill:g('--r-pill'), touch:g('--h-touch'), black:g('--w-black'), btnR:btn.borderTopLeftRadius, btnW:btn.fontWeight }; });
  check(live.pill==='999px' && live.touch==='44px' && live.black==='900' && live.btnR==='999px' && live.btnW==='700','in the running app the tokens resolve and reach a real button: '+JSON.stringify(live));
  await more(p,'#btnSettings'); await p.waitForTimeout(300);
  for (const [btn,label,sel] of [['#saveRace','Race','.lbCard'],['#saveLab','Data Lab','.labRow']]) {
    const [dl]=await Promise.all([p.waitForEvent('download'), p.click(btn)]); const f=path.join(tmp,label.replace(' ','-')+'.html'); await dl.saveAs(f); const saved=fs.readFileSync(f,'utf8');
    const q=await ctx.newPage(); q.on('pageerror',e=>errs.push(label+': '+e.message)); await q.goto('file://'+f); await q.waitForTimeout(500);
    const r=await q.evaluate(sel=>{ const cs=getComputedStyle(document.documentElement); const el=document.querySelector(sel); const e=el?getComputedStyle(el):null; return { pill:cs.getPropertyValue('--r-pill').trim(), navy:cs.getPropertyValue('--navy').trim(), radius:e?e.borderTopLeftRadius:null, n:document.querySelectorAll(sel).length }; }, sel);
    check(/--r-pill:\s*999px/.test(saved) && r.pill==='999px' && r.navy!=='' && r.n>0 && r.radius && r.radius!=='0px','the saved '+label+' page carries the tokens and its cards are rounded: '+JSON.stringify(r));
    await q.close(); }
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); done();
})();
