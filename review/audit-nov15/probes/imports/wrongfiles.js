// Exploration: what each odd file does (message, or what it reads as). Synthetic.
const H = require('./h.js'); const zlib = require('zlib');
const grid = 'Unit,,Skill name,Permanent Skill ID,"JOSÉ GARCÍA","ANA PEÑA"\n"Unit 1 Ratios","Lesson 1.1","Skill one",S1Q,80,90\n';
const POOL = 'IXL-Score-Grid_2026-11-13_This-School-Year_1205050-7T4A-M_J-GR7_Math-Nation-FL-B.E.S.T.-7th-Grade_Math';
const u16 = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(grid.replace(/,/g, '\t'), 'utf16le')]);
const latin1 = Buffer.from(grid, 'latin1');
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.from(Array.from({ length: 3000 }, (_, i) => (i * 37) % 256))]);
(async () => {
  const { b, p } = await H.open();
  const cases = [['empty.csv', ''], ['photo.csv', png.toString('base64'), 1], ['other.csv', 'a,b\n1,2\n3,4\n'], ['u16_' + POOL + '.txt', u16.toString('base64'), 1], ['latin1.csv', latin1.toString('base64'), 1],
    ['semi.csv', grid.replace(/,/g, ';')], ['oneline.csv', 'Student,Score\n'], ['notes.json', '{"a":1}'], ['cut.json', '{"tally":'], ['gb_one.csv', 'Student,Student ID,Quiz (10 pts)\n"Doe, Jane",123,8\n']];
  for (const [n, t, bin] of cases) { await p.evaluate(() => { localStorage.clear(); }); await p.reload();
    const r = await H.imp(p, [bin ? { name: n, b64: t } : { name: n, text: t }]);
    const extra = await p.evaluate(() => { const st = window.__tally.state; const k = st.order[0]; const s = k && st.sections[k]; return s ? { key: k, students: s.students } : null; });
    console.log(n.slice(0, 30).padEnd(30), '|', JSON.stringify(r.last && r.last.fails), '|', JSON.stringify(extra), '|', (await p.textContent('#toast')).slice(0, 200)); }
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
