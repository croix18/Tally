// Exploration fuzz: random IXL-shaped grids written as .xlsx (shared strings, inline strings, numbers stored as text,
// stored and deflated entries, sparse rows/cols, a second sheet, a hidden first sheet), read by xlsxToRows and parseIxlGrid.
const H = require('./h.js'); const zlib = require('zlib');
let seed = +(process.env.SEED || 5); const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(files, deflate) { const parts = [], cd = []; let off = 0;
  for (const [name, str] of files) { const raw = Buffer.from(str, 'utf8'); const d = deflate === 'mix' ? rnd() < 0.5 : deflate; const data = d ? zlib.deflateRawSync(raw) : raw; const nm = Buffer.from(name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(d ? 8 : 0, 8); lh.writeUInt32LE(crc(raw), 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(d ? 8 : 0, 10); ch.writeUInt32LE(crc(raw), 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, nm, data); cd.push(ch, nm); off += 30 + nm.length + data.length; }
  const cdb = Buffer.concat(cd); const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cdb.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cdb, e]); }
const X = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const col = c => { let s = ''; c++; while (c) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
function sheetXml(grid, ss, mode) { return '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + grid.map((row, r) => `<row r="${r + 1}">` + row.map((v, c) => {
    if (v == null) return ''; const ref = col(c) + (r + 1);
    if (typeof v === 'number') return rnd() < 0.2 ? `<c r="${ref}" t="str"><v>${v}</v></c>` : `<c r="${ref}"><v>${v}</v></c>`;
    if (mode === 'inline' || rnd() < 0.2) return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${X(v)}</t></is></c>`;
    let i = ss.indexOf(v); if (i < 0) { ss.push(v); i = ss.length - 1; } return `<c r="${ref}" t="s"><v>${i}</v></c>`; }).join('') + '</row>').join('') + '</sheetData></worksheet>'; }
function build(grid, opts) { const ss = []; const s1 = sheetXml(grid, ss, opts.mode); const other = sheetXml([['Notes'], ['nothing here']], ss);
  const sheets = opts.hiddenFirst ? [['Info', 'rId2', 'state="hidden"'], ['Score Grid', 'rId1', '']] : opts.second ? [['Score Grid', 'rId1', ''], ['Info', 'rId2', '']] : [['Score Grid', 'rId1', '']];
  const wb = `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([n, id, st], i) => `<sheet name="${n}" sheetId="${i + 1}" ${st} r:id="${id}"/>`).join('')}</sheets></workbook>`;
  const rels = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="worksheet" Target="/xl/worksheets/sheet2.xml"/></Relationships>';
  const sst = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${ss.map(s => rnd() < 0.2 ? `<si><r><t>${X(s.slice(0, 2))}</t></r><r><t xml:space="preserve">${X(s.slice(2))}</t></r></si>` : `<si><t xml:space="preserve">${X(s)}</t></si>`).join('')}</sst>`;
  return zip([['xl/workbook.xml', wb], ['xl/_rels/workbook.xml.rels', rels], ['xl/sharedStrings.xml', sst], ['xl/worksheets/sheet1.xml', s1], ['xl/worksheets/sheet2.xml', other]], opts.deflate); }
const NAMES = ['AVA STONE', "SEÁN O'BRIEN", 'MARY ANN SMITH-JONES', 'JOSÉ DE LA CRUZ', 'LI <ZOE> & CO'];
function grid() { const nS = 1 + Math.floor(rnd() * 5), nK = 1 + Math.floor(rnd() * 8); const g = [['Unit', null, 'Skill name', 'Permanent Skill ID', ...NAMES.slice(0, nS)]];
  for (let k = 0; k < nK; k++) g.push([k % 3 === 0 ? 'Unit ' + (1 + Math.floor(k / 3)) + ' Ratios' : null, 'Lesson ' + k, 'Skill ' + k + (rnd() < 0.2 ? ' & "more"' : ''), 'K' + k, ...NAMES.slice(0, nS).map(() => rnd() < 0.3 ? null : Math.floor(rnd() * 101))]);
  if (rnd() < 0.3) g.splice(1, 0, []); return g; }
(async () => {
  const { b, p } = await H.open(); const N = +(process.env.N || 300); const cases = [];
  for (let t = 0; t < N; t++) { const g = grid(); const opts = { deflate: [true, false, 'mix'][t % 3], mode: t % 4 === 0 ? 'inline' : 'shared', hiddenFirst: t % 10 === 7, second: t % 10 === 3 }; cases.push({ g, opts, b64: build(g, opts).toString('base64') }); }
  const got = await p.evaluate(async cases => { const A = window.__all; return Promise.all(cases.map(async c => { try { const bin = atob(c.b64); const u8 = Uint8Array.from(bin, ch => ch.charCodeAt(0));
    const rows = await A.fileToRows(new File([u8], 'x.xlsx')); const g = (A.parseIxlGrid || window.parseIxlGrid)(rows); return { rows, g }; } catch (e) { return { err: e.message }; } })); }, cases.map(c => ({ b64: c.b64 })));
  const bad = {}; const note = (k, ex) => { bad[k] = bad[k] || { n: 0, ex }; bad[k].n++; };
  got.forEach((x, t) => { const { g, opts } = cases[t]; const tag = opts.hiddenFirst ? 'hiddenFirst' : opts.second ? 'second' : 'plain';
    if (x.err) { note(tag + ':err', x.err); return; }
    const want = g.filter(r => r.length || true).map(r => { const o = r.slice(); while (o.length && o[o.length - 1] == null) o.pop(); return o; });
    const gotR = x.rows.map(r => { const o = r.map(v => typeof v === "string" && /^\d+$/.test(v) ? +v : v); while (o.length && o[o.length - 1] == null) o.pop(); return o; });
    if (JSON.stringify(gotR) !== JSON.stringify(want)) note(tag + ':rows', { want: JSON.stringify(want).slice(0, 200), got: JSON.stringify(gotR).slice(0, 200) });
    const wantStudents = g[0].slice(4).filter(Boolean); if (JSON.stringify(x.g.students) !== JSON.stringify(wantStudents)) note(tag + ':students', x.g.students);
    const nK = g.filter((r, i) => i && r.length).length; if (x.g.skills.length !== nK) note(tag + ':skills', [x.g.skills.length, nK]); });
  console.log('cases', N, 'problems', JSON.stringify(bad).slice(0, 2000));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
