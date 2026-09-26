const { chromium } = require('playwright'); const fs=require('fs'); const path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : require('child_process').execSync('ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome | head -1').toString().trim()}); const ctx=await b.newContext({viewport:{width:1400,height:900}});
  await ctx.grantPermissions(['clipboard-read','clipboard-write']);
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  await p.goto('file://'+path.resolve('Tally.html'));
  await p.screenshot({path:'shot0.png'});
  const files=fs.readdirSync('fixtures').filter(f=>f.endsWith('.xlsx')).map(f=>path.resolve('fixtures',f));
  await p.setInputFiles('#file', files);
  await p.waitForTimeout(800);
  const st=await p.evaluate(()=>{const s=window.__tally.state; return {order:s.order, active:s.active, secs:Object.values(s.sections).map(x=>({label:x.label,acc:x.accelerated,students:x.students.length,skills:x.skills.length,date:x.date}))};});
  console.log(JSON.stringify(st,null,1));
  await p.screenshot({path:'shot1.png'});
  // roster paste for active (7T1A ACC should be active? order sorted; active = last imported)
  await p.click('[data-k="1205050-7T1A"]');
  await p.click('#btnSettings'); await p.fill('#roster', fs.readFileSync('fixtures/roster.txt','utf8'));
  await p.waitForTimeout(200); console.log('report:', await p.textContent('#matchReport'));
  await p.screenshot({path:'shot2.png'});
  await p.click('#mSave'); await p.waitForTimeout(300);
  await p.screenshot({path:'shot3.png'});
  const rows=await p.evaluate(()=>window.__tally.buildRows(window.__tally.state.sections['1205050-7T1A']).map(r=>[r.display,r.sub,r.status]));
  console.log(rows);
  // copy unit 1
  await p.click('th.unit .copy'); await p.waitForTimeout(300);
  console.log('toast:', await p.textContent('#toast'));
  const clip=await p.evaluate(()=>navigator.clipboard.readText()); console.log('CLIP:\n'+clip);
  // open unit 1 detail
  await p.click('th.unit .ulink'); await p.waitForTimeout(300);
  await p.screenshot({path:'shot4.png'});
  await p.fill('#search','de la'); await p.waitForTimeout(200); await p.screenshot({path:'shot5.png'});
  // reload persistence
  await p.reload(); await p.waitForTimeout(500);
  console.log('after reload sections:', await p.evaluate(()=>window.__tally.state.order));
  console.log('errors:', errs);
  await b.close();
})();
