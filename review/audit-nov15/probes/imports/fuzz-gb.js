// Exploration fuzz: random Focus-style gradebooks written as CSV (multi-line quoted headers), tab text (.xls) and an
// HTML table (.xls); each read by fileToRows + parseGradebook in the page and compared with what was written.
const H = require('./h.js');
let seed = +(process.env.SEED || 11); const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rnd() * a.length)];
const LAST = ['SMITH', "O'BRIEN", 'DE LA CRUZ', 'NGUYEN', 'SMITH-JONES', 'GARCÍA MÁRQUEZ', 'LEE', 'VAN DER BERG', 'KIM'], FIRST = ['ANA', 'JOSÉ', 'MARY ANN', 'AL', 'LIAM', 'ZOË', 'JOHN PAUL'];
const ASSIGN = ['Unit 1 Test', 'Unit 2 Quiz', 'Whiteboard Practice Week 9/21', '2.01 Worksheet', 'Unit 3 IXL', 'Exit Ticket, Day 4', 'Notes "Check"'];
function gen() {
  const nS = 2 + Math.floor(rnd() * 8), nA = 1 + Math.floor(rnd() * 5); const used = new Set(); const studs = [];
  while (studs.length < nS) { const n = pick(LAST) + ', ' + pick(FIRST); if (used.has(n)) continue; used.add(n); studs.push({ name: n, id: String(1000000 + Math.floor(rnd() * 8999999)) }); }
  const as = []; const an = new Set(); while (as.length < nA) { const n = pick(ASSIGN); if (an.has(n)) continue; an.add(n); as.push({ name: n, max: pick([5, 10, 15, 20, 21, 100, 12.5]) }); }
  const cells = studs.map(() => as.map(a => { const r = rnd();
    if (r < 0.45) { const v = Math.round(rnd() * a.max * 2) / 2; return { cell: `${v.toFixed(1)} - ${Math.round(v / a.max * 100)} % - ${pick(['A', 'C', 'F'])}`, v, st: 'score' }; }
    if (r < 0.6) return { cell: 'NHI Not Handed In', v: null, st: 'missing' };
    if (r < 0.75) return { cell: '', v: null, st: 'blank' };
    if (r < 0.85) { const v = Math.floor(rnd() * (a.max + 1)); return { cell: String(v), v, st: 'score' }; }
    if (r < 0.9) return { cell: 'Z', v: 0, st: 'score' };
    if (r < 0.95) return { cell: 'EX', v: null, st: 'excused' };
    return { cell: 'INC', v: null, st: 'unread' }; }));
  return { studs, as, cells };
}
const hdrCell = a => `${a.name}\n \n\n \n ${a.max} Points\n \n \n\n \n Assigned 09/01\n Due 09/02`;
const q = v => '"' + String(v).replace(/"/g, '""') + '"';
function toCsv(g) { return [['Student ID', 'Local ID', 'Student', 'Grade', ...g.as.map(hdrCell)].map(q).join(','), ...g.studs.map((s, i) => [s.id, '', s.name, '80% B', ...g.cells[i].map(c => c.cell)].map(q).join(','))].join('\r\n') + '\r\n'; }
function toTab(g) { return [['Student ID', 'Local ID', 'Student', 'Grade', ...g.as.map(hdrCell)].map(v => /[\n\t"]/.test(v) ? q(v) : v).join('\t'), ...g.studs.map((s, i) => [s.id, '', s.name, '80% B', ...g.cells[i].map(c => c.cell)].join('\t'))].join('\n') + '\n'; }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function toHtml(g) { return '<html><body><table><tr>' + ['Student ID', 'Local ID', 'Student', 'Grade', ...g.as.map(hdrCell)].map(v => `<th>${esc(v).replace(/\n/g, '<br>')}</th>`).join('') + '</tr>' + g.studs.map((s, i) => '<tr>' + [s.id, '', s.name, '80% B', ...g.cells[i].map(c => c.cell)].map(v => `<td>${esc(v)}</td>`).join('') + '</tr>').join('') + '</table></body></html>'; }
(async () => {
  const { b, p } = await H.open(); const N = +(process.env.N || 300); const cases = [];
  for (let t = 0; t < N; t++) { const g = gen(); cases.push({ g, files: [{ name: 'gb.csv', text: toCsv(g) }, { name: 'gb_tab.xls', text: toTab(g) }, { name: 'gb_html.xls', text: toHtml(g) }] }); }
  const got = await p.evaluate(async cases => { const A = window.__all; const out = [];
    for (const c of cases) { const r = []; for (const f of c.files) { try { const gb = A.parseGradebook(await A.fileToRows(new File([f.text], f.name)));
      r.push(gb ? { students: gb.students, ids: gb.ids, as: gb.assignments.map(a => ({ name: a.name, max: a.max, values: a.values, status: a.status, due: a.due })) } : null); } catch (e) { r.push({ err: e.message }); } } out.push(r); }
    return out; }, cases.map(c => ({ files: c.files })));
  const bad = {}; const note = (k, ex) => { bad[k] = bad[k] || { n: 0, ex }; bad[k].n++; };
  got.forEach((r, t) => { const g = cases[t].g;
    r.forEach((x, fi) => { const fmt = ['csv', 'tab', 'html'][fi];
      if (!x || x.err) { note(fmt + ':null/err', { err: x && x.err, csv: cases[t].files[fi].text.slice(0, 300) }); return; }
      if (JSON.stringify(x.students) !== JSON.stringify(g.studs.map(s => s.name))) note(fmt + ':students', { got: x.students, want: g.studs.map(s => s.name) });
      if (JSON.stringify(x.ids) !== JSON.stringify(g.studs.map(s => s.id))) note(fmt + ':ids', x.ids);
      // columns with nothing in them are dropped by design: compare the kept ones by name
      const keep = g.as.map((a, j) => ({ a, j })).filter(({ j }) => g.cells.some(row => row[j].v != null || row[j].st === 'missing' || row[j].st === 'unread'));
      if (x.as.length !== keep.length) { note(fmt + ':nAssign', { got: x.as.map(a => a.name), want: keep.map(k => k.a.name) }); return; }
      keep.forEach(({ a, j }, k) => { const y = x.as[k];
        if (y.name !== a.name) note(fmt + ':name', { got: y.name, want: a.name });
        if (y.max !== a.max) note(fmt + ':max', { got: y.max, want: a.max, name: a.name });
        const wantV = g.cells.map(row => row[j].v), wantS = g.cells.map(row => row[j].st);
        if (JSON.stringify(y.values) !== JSON.stringify(wantV)) note(fmt + ':values', { got: y.values, want: wantV, max: a.max });
        if (JSON.stringify(y.status) !== JSON.stringify(wantS)) note(fmt + ':status', { got: y.status, want: wantS });
        if (y.due !== '09/02') note(fmt + ':due', y.due); });
    });
    if (r.every(x => x && !x.err) && (JSON.stringify(r[0]) !== JSON.stringify(r[1]) || JSON.stringify(r[0]) !== JSON.stringify(r[2]))) note('formats-disagree', null);
  });
  console.log('cases', N, 'problems', JSON.stringify(bad, null, 0).slice(0, 2500));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
