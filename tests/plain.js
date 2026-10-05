// The app does not describe itself. Croix, 5 Oct 2026: "remove any of the little irrelevant titles all over the place.
// There's no need to describe what a tool does inside the tool on a title." A screen shows names, numbers, dates and
// the keys needed to read a mark; how things work is in the Guide (⋯ → Guide), nowhere else. This suite walks the
// screens and fails if one of the removed captions, or a new one of the same kind, is on screen.
const { chromium, fs, path, exe, check, done, pick, more, APP } = require('./lib');
const BANNED = [/IXL → FOCUS/, /How it works/i, /\bTap a (class|unit|student|skill)\b/, /\beach (slice|bar|leaf) (is|counts)\b/, /\bone (dot|line) per (student|class)\b/,
  /Read the plots first/, /Stats are hidden/i, /Classes ranked by/, /Slide to the score/, /starts at your usual score/, /Each line below changes/, /Each cell: the grade/, /Bars show each part/,
  /Course grade = /, /isn't circular/, /belongs to the quarter/, /Generate seating, or seat by hand/, /see why they.re there/, /Drag a desk to move it/, /Per-period exports make/, /A note from Tally/, /down 3\+ or more missing/,
  /in black and white/, /places a gradebook by itself/, /comes from the course-wide/];
(async()=>{
  const b=await chromium.launch({executablePath:exe}); const ctx=await b.newContext({viewport:{width:1536,height:864}}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  const seen=[]; const look=async name=>{ const t=await p.evaluate(()=>{ const st=document.createElement('style'); st.textContent='.vh{display:none!important}'; document.head.appendChild(st); const x=document.body.innerText; st.remove(); return x; });   /* .vh is the screen-reader-only legend */ const hits=BANNED.filter(r=>r.test(t)).map(String); seen.push(name); check(hits.length===0,name+': nothing on screen describes the tool'+(hits.length?' — found '+hits.join(' '):'')); return t; };
  await p.goto('file://'+path.resolve(APP)); await p.waitForTimeout(500);
  // landing: a headline, a button, one line about where the data stays
  const land=await look('landing');
  check(/Drop your IXL and Focus exports here/.test(land) && /Choose files/.test(land) && await p.locator('#empty .how').count()===0 && await p.locator('#top .brand small').count()===0,'the landing is a headline and a button; the header is just the name');
  check((await p.evaluate(()=>document.querySelector('#empty').innerText.trim().split(/\n+/).length))<=3,'…three lines in all');
  const acc=fs.readdirSync('fixtures').find(f=>f.startsWith('course_acc')), on=fs.readdirSync('fixtures').find(f=>f.startsWith('course_on'));
  await p.setInputFiles('#file',[path.resolve('fixtures',acc)]); await p.waitForTimeout(800);
  const land2=await look('landing after one course export'); check(/Accelerated course export is in/.test(land2) && /Now drop a Focus gradebook for each period/.test(land2),'after a course export the landing still says what to drop next (that is the next step, not a description)');
  await p.setInputFiles('#file',[path.resolve('fixtures',on)]); await p.waitForTimeout(800);
  for (const [f,per,pr] of [['focus_gradebook_pool_p1.csv','1','acc'],['focus_gradebook_pool_p2.csv','2','on']]) { await p.setInputFiles('#file',[path.resolve('fixtures',f)]); await p.waitForTimeout(600); await pick(p,'[data-sec="__new__"]'); await p.waitForTimeout(200); if (per==='1') await look('new class dialog'); await p.click(`#ncPeriod [data-p="${per}"]`); await p.click(`#ncPrep [data-prep="${pr}"]`); await p.click('#ncMake'); await p.waitForTimeout(700); const a=await p.$('#askApply'); if (a) { await a.click(); await p.waitForTimeout(300); } }
  await p.click('#btnHome'); await p.waitForTimeout(400);
  const ov=await look('Overview'); check(await p.locator('#bar .legend').count()===0,'the Overview bar has no caption after its buttons');
  check(/Sliding/i.test(ov) && await p.locator('.hcard [title*="down 3 points"]').count()>0,'"Sliding" keeps its meaning as a tooltip, not as a line on every card');
  // Croix, 5 Oct, with a screenshot of a class card: "Remove the busyness of this. The whole 19 students line. The faded lines under missing work
  // and sliding. That small stuff should not be displayed on the overall screen."
  const card=await p.evaluate(()=>{ const c=document.querySelector('.hcard'); return { meta:c.querySelectorAll('.hhead small').length, subs:[...c.querySelectorAll('.hnums span')].filter(s=>s.parentElement.querySelector('b').textContent.trim()!=='—').length, reasons:[...c.querySelectorAll('.hnums span')].map(s=>s.textContent).join('; '), nums:[...c.querySelectorAll('.hnums > div')].map(d=>d.querySelector('small').textContent+' '+d.querySelector('b').textContent).join(' | '), text:c.innerText }; });
  check(card.meta===0 && card.subs===0 && !/\d+ students?\b|goal \d+|since \w+ \d+/.test(card.text),'a class card on the Overview is the class, four numbers and its chips — no "23 students · goal 60 · IXL Sep 26", no faded line under a number'+(card.reasons?' (a dash keeps its reason: '+card.reasons+')':''));
  check(card.nums.split(' | ').length===4 && /IXL work at goal \d+%/i.test(card.nums) && /Missing work \d+/i.test(card.nums) && /Sliding (\d+|—)/i.test(card.nums),'…and the four numbers are all still there: '+card.nums);
  await more(p,'#btnDetails'); await p.waitForTimeout(300);
  const cardD=await p.evaluate(()=>{ const c=document.querySelector('.hcard'); return { meta:(c.querySelector('.hhead small')||{textContent:''}).textContent, subs:c.querySelectorAll('.hnums span').length }; });
  check(/\d+ students · goal \d+/.test(cardD.meta) && cardD.subs>=3,'Details view (⋯) still shows those lines for when he wants them: "'+cardD.meta+'", '+cardD.subs+' lines under the numbers');
  await more(p,'#btnDetails'); await p.waitForTimeout(300);
  // Croix, 5 Oct: "The needs attention can be a whole collapsible thing with a notification when I need to look at it"
  const att=await p.evaluate(()=>{ const d=document.querySelector('#hAtt'); if (!d) return null; const s=d.querySelector('summary'), c=d.querySelector('.hcount'); const list=d.querySelector('.hatt'); return { open:d.open, title:s.querySelector('b').textContent, count:c.textContent, red:getComputedStyle(c).backgroundColor, rows:list.querySelectorAll(':scope > li').length, warn:list.querySelectorAll(':scope > li.warn').length, listShown:list.checkVisibility(), h:Math.round(d.getBoundingClientRect().height) }; });
  check(att && !att.open && !att.listShown && att.h<=60,'Needs attention is one closed line on the Overview ('+(att?att.h:'?')+' px)');
  check(att && att.title==='Needs attention' && Number(att.count)===att.warn && att.warn>=1 && /^rgb\(1[5-9]\d|^rgb\(2\d\d/.test(att.red),'…with a red count of what needs fixing: '+(att?att.count:'')+' ('+(att?att.red:'')+')');
  await p.click('#hAtt > summary'); await p.waitForTimeout(200);
  check(await p.locator('#hAtt[open] .hatt > li').count()===att.rows && await p.locator('#hAtt .hatt li button, #hAtt .hatt li .hgo').first().isVisible(),'a tap opens it: '+att.rows+' rows, each one a way in');
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('#btnHome'); await p.waitForTimeout(300);
  check(await p.locator('#hAtt[open]').count()===1,'it stays open while he moves around…');
  await p.reload(); await p.waitForTimeout(600); check(await p.locator('#hAtt:not([open])').count()===1,'…and is closed again the next time Tally opens');
  await p.click('#homeQuarters'); await p.waitForTimeout(300); await look('Quarters'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('[data-k="period-1"]'); await p.waitForTimeout(400); await look('class grid');
  await more(p,'#btnDetails'); await p.waitForTimeout(300); await look('class grid, Details view'); await more(p,'#btnDetails'); await p.waitForTimeout(300);
  await p.click('th.unit .ulink'); await p.waitForTimeout(400); await look('unit view');
  check(await p.locator('.ukey span').count()===4 && await p.locator('.ukey small').count()===0,'the unit view keeps its four-colour key and drops the sentence under it');
  await p.click('#back'); await p.waitForTimeout(300);
  await p.click('#moreBtn'); await p.waitForTimeout(200); const owed=p.locator('#moreMenu [data-act="owed"], #openOwed').first(); if (await owed.count()) { await owed.click(); await p.waitForTimeout(300); await look('Still owed dialog'); await p.keyboard.press('Escape'); await p.waitForTimeout(200); } else { await p.keyboard.press('Escape'); }
  await p.click('#openGrades'); await p.waitForTimeout(500); const gr=await look('Grades');
  check(await p.locator('#bar .legend').count()===0 && /Matches the Focus Grade column/.test(gr),'Grades: no caption under the bar; the proof against Focus stays (it is a result)');
  await p.locator('.gstu tr[data-stu]').first().click(); await p.waitForTimeout(500); await look('student page');
  await p.click('#pShow'); await p.waitForTimeout(500); const sh=await look('Show student');
  check(await p.locator('.shKey i').count()===1 && /now/.test(await p.textContent('.shKey')),'Show student: the dark "now" line has a one-word key in place of a sentence');
  await p.reload(); await p.waitForTimeout(600);
  await p.click('#btnStudents'); await p.waitForTimeout(500); await look('Students'); check(await p.locator('#bar .legend').count()===0,'Students: no caption on the bar');
  await p.click('#btnHome'); await p.waitForTimeout(300); await p.click('[data-k="period-1"]'); await p.waitForTimeout(300); await p.click('#openSeating'); await p.waitForTimeout(700); await look('Seating');
  check((await p.textContent('.seatHint')).trim()==='' ,'Seating: no standing instruction above the room');
  await p.click('#btnHome'); await p.waitForTimeout(300); await p.click('#btnLb'); await p.waitForTimeout(600); const race=await look('Race');
  const rs=await p.textContent('#lb .lbSub'); check(/^As of |^Counting /.test(rs) && /moved\s+up|first week|complete/i.test(race),'Race: the line under the title is the date; each card labels its own number: "'+rs+'"');
  await p.click('[data-tab="lab"]'); await p.waitForTimeout(500);
  for (const prep of ['acc','on']) { await p.click(`.lbFocus [data-prep="${prep}"]`); await p.waitForTimeout(300);
    for (const kind of ['box','dots','hist','stem','bar','circle','line']) { await p.selectOption('#labKind',kind); await p.waitForTimeout(300); await look('Data Lab, '+prep+', '+kind);
      if (kind!=='box') check(await p.locator('#lb .labLegend').count()===0 && await p.locator('#lb .labHint').count()===0,'Data Lab '+kind+' ('+prep+'): the title, the facts line, then the plots'); } }
  await p.selectOption('#labKind','stem'); await p.waitForTimeout(300); const key=await p.locator('#lb .stem + .ghint').first().textContent().catch(()=>''); check(/^Key: 1 \| 3 means 13$/.test(key.trim()),'stem-and-leaf keeps the key a stem-and-leaf plot is drawn with: "'+key.trim()+'"');
  await p.selectOption('#labKind','box'); await p.waitForTimeout(300); check(/median/.test(await p.textContent('#lb .labLegend')),'the box plot keeps its key');
  // the explanations that left the screens are in the Guide
  const src=fs.readFileSync('app.js','utf8'); const g=src.slice(src.indexOf('function openGuide'), src.indexOf('/* ---------- Receipt'));
  check(/tap the skill in the unit view/.test(g) && /Sliding<\/b> — grade down 3 points or more/.test(g) && /belongs to the quarter its Focus due date falls in/.test(g) && /missing work as zero/.test(g) && /ranked by how many students gained a skill/.test(g),'the Guide carries what the screens no longer say: skipping a skill, Sliding, quarter dates, the grade rule, the Race rule');
  check(errs.length===0,'no errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('screens checked: '+seen.length);
  await b.close(); done();
})();
