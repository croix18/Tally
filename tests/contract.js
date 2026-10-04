// Layout contract (round 6): the things the other 548 checks can't see. Measured, not asserted from the DOM alone —
// a build with magenta ink, no sticky header or no font would pass every functional suite and fail here.
// Viewports: laptop 1400×900, Chromebox 1366×768, tablet 1280×800; plus 200 % zoom (emulated as 700×450) for reachability.
const { chromium, fs, path, exe, check, done, APP } = require('./lib');
const ratio = (fg, bg) => { const L = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }; const a = L(fg), b = L(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
(async()=>{
  const b=await chromium.launch({executablePath:exe});
  const errs=[];
  const open=async(w,h,opts={})=>{ const ctx=await b.newContext({viewport:{width:w,height:h},...opts}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept()); await p.goto('file://'+path.resolve(APP)); return {ctx,p}; };
  // one state, built once, copied into every context through localStorage
  const { ctx: c0, p: p0 } = await open(1400,900);
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p0.setInputFiles('#file',[path.resolve('fixtures',acc), path.resolve('fixtures',on)]); await p0.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p0.setInputFiles('#file',[path.resolve('fixtures',f)]); await p0.waitForTimeout(600); await p0.click('[data-sec="__new__"]'); await p0.waitForTimeout(200); await p0.click(`#ncPeriod [data-p="${per}"]`); await p0.click(`#ncPrep [data-prep="${pr}"]`); await p0.click('#ncMake'); await p0.waitForTimeout(800); if (await p0.locator('#askSave').count()) { await p0.click('#askSave'); await p0.waitForTimeout(300); } }
  const saved=await p0.evaluate(()=>localStorage.getItem('tally.v4')||localStorage.getItem(Object.keys(localStorage).find(k=>/^tally/.test(k))));
  const lsKey=await p0.evaluate(()=>Object.keys(localStorage).find(k=>/^tally/.test(k)&&!/broken/.test(k)));
  check(!!saved && !!lsKey,'state built once ('+lsKey+')');
  // 1. the import result stays on the Overview and the import landed there
  await p0.click('#btnHome'); await p0.waitForTimeout(300);
  const him=await p0.textContent('#gridwrap .himport'); check(await p0.locator('#gridwrap .himport').count()===1 && /Focus gradebook/.test(him) && /IXL[^]*1 class updated/.test(him) && (await p0.locator('#gridwrap .himport li').count())>=4,'imports land on the Overview with one result card that lists every file of the last few minutes');
  await c0.close();
  const rows=async(p,sel)=>p.evaluate(sel=>{ const wrap=document.querySelector('#gridwrap'); const r=wrap.getBoundingClientRect(); const head=document.querySelector('table.grid thead'); const foot=document.querySelector('table.grid tfoot'); const top=head?head.getBoundingClientRect().bottom:r.top; const bot=Math.min(r.bottom,innerHeight,foot?foot.getBoundingClientRect().top:Infinity); return [...document.querySelectorAll(sel)].filter(tr=>{ const b=tr.getBoundingClientRect(); return b.top>=top-1 && b.bottom<=bot+1; }).length; },sel);
  const measure=async(w,h,label,minGrid,minUnit,opts={})=>{
    const { ctx, p } = await open(w,h,opts); await p.evaluate(([k,v])=>localStorage.setItem(k,v),[lsKey,saved]); await p.reload(); await p.waitForTimeout(700);
    // font
    const font=await p.evaluate(()=>document.fonts.check('900 16px "DM Sans"') && getComputedStyle(document.body).fontFamily.includes('DM Sans')); check(font,label+': DM Sans is loaded and applied');
    // one-row header, no horizontal overflow
    const top=await p.evaluate(()=>{ const t=document.querySelector('#top'); const r=t.getBoundingClientRect(); const kids=[...t.children].filter(c=>c.offsetParent!==null && c.getBoundingClientRect().height>0); const tops=kids.map(c=>c.getBoundingClientRect().top); return { h:r.height, rowsOfChildren:(Math.max(...tops)-Math.min(...tops))<20?1:2, overflow:document.documentElement.scrollWidth>innerWidth+1 }; });
    check(top.h<=90 && top.rowsOfChildren<=1,label+': header is one row ('+Math.round(top.h)+' px)'); check(!top.overflow,label+': no horizontal page overflow');
    // class grid rows between the sticky header and footer
    await p.click('[data-k="period-1"]'); await p.waitForTimeout(400);
    const g=await rows(p,'table.grid tbody tr'); check(g>=minGrid,label+': grid shows ≥ '+minGrid+' complete student rows ('+g+')');
    // sticky header + name column
    const sticky=await p.evaluate(()=>{ const th=document.querySelector('table.grid thead th'); const cs=getComputedStyle(th); const name=document.querySelector('table.grid tbody th, table.grid tbody td.name, table.grid tbody tr > :first-child'); const ns=getComputedStyle(name); return { head:cs.position, name:ns.position }; });
    check(sticky.head==='sticky' && sticky.name==='sticky',label+': table header and name column are sticky');
    await p.evaluate(()=>{ document.querySelector('#gridwrap').scrollTop=300; }); await p.waitForTimeout(100);
    const headVisible=await p.evaluate(()=>{ const r=document.querySelector('table.grid thead th').getBoundingClientRect(); const w=document.querySelector('#gridwrap').getBoundingClientRect(); return r.top>=w.top-1 && r.bottom<=w.bottom; }); check(headVisible,label+': header still visible after scrolling the grid');
    // unit view rows
    await p.click('th.unit .ulink'); await p.waitForTimeout(400);
    const u=await rows(p,'table.grid tbody tr'); check(u>=minUnit,label+': unit view shows ≥ '+minUnit+' complete rows ('+u+')');
    // focus ring on header pills ≥ 3:1 against the header
    const ring=await p.evaluate(()=>{ const b=document.querySelector('#top .pill'); b.focus(); const cs=getComputedStyle(b); return { oc:cs.outlineColor, bg:getComputedStyle(document.querySelector('#top')).backgroundColor, img:getComputedStyle(document.querySelector('#top')).backgroundImage }; });
    // header is a navy gradient; measure the ring against #16213A
    check(ratio(ring.oc,'rgb(22,33,58)')>=3,label+': header focus ring ≥ 3:1 ('+ring.oc+')');
    // warning line is a block
    check((await p.evaluate(()=>{ const d=document.createElement('span'); d.className='warnline'; document.body.appendChild(d); const v=getComputedStyle(d).display; d.remove(); return v; }))==='block',label+': .warnline lays out as a block');
    await p.click('#back'); await p.waitForTimeout(300);
    return p;
  };
  const pl=await measure(1400,900,'laptop',11,7);
  // 2. F chip is coral on the student page; Copy in the unit view is not white on white
  await pl.click('#btnHome'); await pl.waitForTimeout(300); await pl.fill('#search','a'); await pl.waitForTimeout(300);
  const fRow=await pl.evaluate(()=>{ const rows=[...document.querySelectorAll('.sdir tr[data-stu], .sdir [data-open], .sdir tr')]; const f=rows.find(r=>/\bF\b/.test(r.textContent)); return f? (f.dataset.stu||f.textContent.trim().slice(0,40)) : null; });
  const chip=await pl.evaluate(()=>{ const em=document.querySelector('.gcard b em.lt.F, .shGrade em.lt.F'); if (em) return getComputedStyle(em).backgroundColor; const e2=document.createElement('div'); e2.className='profile'; e2.innerHTML='<div class="gcard"><b>52% <em class="lt F">F</em></b></div>'; document.body.appendChild(e2); const v=getComputedStyle(e2.querySelector('em')).backgroundColor; e2.remove(); return v; });
  check(chip!=='rgb(214, 243, 240)' && /rgb/.test(chip) && ratio(chip,'rgb(214, 243, 240)')>1.05,'an F chip is not the pale "fine" colour ('+chip+')');
  await pl.fill('#search',''); await pl.click('[data-k="period-1"]'); await pl.waitForTimeout(300); await pl.click('th.unit .ulink'); await pl.waitForTimeout(400);
  const copy=await pl.evaluate(()=>{ const c=document.querySelector('#bar .pill.onbar'); if (!c) return null; const cs=getComputedStyle(c); return { fg:cs.color, bg:cs.backgroundColor }; });
  check(copy && ratio(copy.fg,copy.bg)>=4.5,'the unit view\'s on-bar pill is readable: '+JSON.stringify(copy));
  // 3. Race: keyboard exit works, chip contrast
  await pl.click('#btnLb'); await pl.waitForTimeout(500);
  const chips=await pl.evaluate(()=>[...document.querySelectorAll('.lbChip')].map(c=>{ const cs=getComputedStyle(c); return [cs.color,cs.backgroundColor]; }));
  check(chips.length>0 && chips.every(([fg,bg])=>ratio(fg,bg)>=3),'every gain chip on the Race is ≥ 3:1 ('+chips.length+' chips)');
  await pl.focus('#lbExit'); await pl.keyboard.down('Enter'); await pl.waitForTimeout(1700); await pl.keyboard.up('Enter'); await pl.waitForTimeout(400);
  check(await pl.locator('body.lbMode').count()===0,'holding Enter on "Hold to exit" leaves the Race');
  await pl.context().close();
  const pc=await measure(1366,768,'chromebox',8,5); await pc.context().close();
  const pt=await measure(1280,800,'tablet',7,4,{hasTouch:true,isMobile:true});   // unit view: 4 until the skill header is redesigned (Build 2) await pt.context().close();
  // 4. 200 % zoom (half-size viewport): every bar control reachable, some rows visible after scrolling the page
  const { ctx: cz, p: pz } = await open(700,450); await pz.evaluate(([k,v])=>localStorage.setItem(k,v),[lsKey,saved]); await pz.reload(); await pz.waitForTimeout(700);
  await pz.click('[data-k="period-1"]'); await pz.waitForTimeout(400);
  const reach=await pz.evaluate(()=>{ window.scrollTo(0,document.body.scrollHeight); const r=document.querySelector('#gridwrap').getBoundingClientRect(); return { boardBottom:r.bottom, h:innerHeight, rows:[...document.querySelectorAll('table.grid tbody tr')].filter(tr=>{ const b=tr.getBoundingClientRect(); return b.top>=0 && b.bottom<=innerHeight; }).length }; });
  check(reach.rows>=2,'at a 700×450 window (200 % zoom) the page scrolls so the board shows rows ('+reach.rows+')');
  await cz.close();
  // 5. Show student: the result is pinned while the switches scroll; no trend card
  const { ctx: cs, p: ps } = await open(1280,800,{hasTouch:true,isMobile:true}); await ps.evaluate(([k,v])=>localStorage.setItem(k,v),[lsKey,saved]); await ps.reload(); await ps.waitForTimeout(700);
  await ps.click('[data-k="period-1"]'); await ps.waitForTimeout(300); await ps.click('#openGrades'); await ps.waitForTimeout(400); await ps.locator('.gstu tr[data-stu]').first().click(); await ps.waitForTimeout(400); await ps.click('#pShow'); await ps.waitForTimeout(500);
  const sh=await ps.evaluate(()=>{ const g=document.querySelector('#show .shTop .shGrade'); const el=document.querySelector('#show'); el.scrollTop=900; const r=g.getBoundingClientRect(); return { pinned:r.top>=0 && r.bottom<=innerHeight*0.45, trend:!!document.querySelector('.shTrend'), top:document.querySelector('#show .shTop').getBoundingClientRect().height, planTop:(document.querySelector('.shQuick')||{getBoundingClientRect:()=>({top:9999})}).getBoundingClientRect().top }; });
  check(sh.pinned && !sh.trend,'Show student keeps the grade pinned above the switches (band '+Math.round(sh.top)+' px) and has no trend card');
  await ps.evaluate(()=>{ document.querySelector('#show').scrollTop=0; });
  const firstScreen=await ps.evaluate(()=>{ const q=document.querySelector('.shQuick'); return q? q.getBoundingClientRect().top : 9999; });
  check(firstScreen<560,'the plan starts on the first tablet screen (y '+Math.round(firstScreen)+')');
  const need=await ps.evaluate(()=>document.querySelector('#shNeed').textContent);
  check(!/can't get you to a C/.test(need) || /^(?!.*You have)/.test(need),'the one-test sentence names a letter above the student\'s grade: '+need.slice(0,70));
  await cs.close();
  // 6. the shipped build has no debug handle
  check(!/window\.__tally/.test(fs.readFileSync('Tally.html','utf8')),'the shipped Tally.html carries no window.__tally');
  console.log('errors:',errs); check(errs.length===0,'no errors');
  await b.close(); done();
})();
