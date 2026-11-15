// Node fuzz: an independent CSV/TSV writer+reader oracle and an independent IXL-grid interpreter vs parser.js.
// Prints disagreement counts by kind and the first example of each. Not a finding probe (no exit-1 contract).
const path = require('path');
const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const P = require(path.join(REPO, 'parser.js'));
let seed = +(process.env.SEED || 7); const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rnd() * a.length)];
const CELLS = ['85', '85.0', ' 85 ', '85%', '-', 'N/A', '', '100', '0', 'a,b', 'say "hi"', 'line1\nline2', 'cr\rhere', 'tab\there', 'O\'Brien, Seán', 'DE LA CRUZ', ' lead', 'trail ', '""', '"', ',', '\r\n', 'x'];
// my reader: RFC 4180, a quote opens a quoted field only at the start of a field
function oracleRead(text, delim) {
  if (text[0] === '﻿') text = text.slice(1);
  const rows = []; let row = [], f = '', i = 0, q = false, atStart = true;
  while (i < text.length) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; } f += c; i++; continue; }
    if (c === '"' && atStart) { q = true; atStart = false; i++; continue; }
    if (c === delim) { row.push(f); f = ''; atStart = true; i++; continue; }
    if (c === '\r' || c === '\n') { row.push(f); rows.push(row); row = []; f = ''; atStart = true; i += (c === '\r' && text[i + 1] === '\n') ? 2 : 1; continue; }
    f += c; atStart = false; i++; }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows.map(r => r.map(v => v.trim() === '' ? null : (delim === '\t' ? v.trim() : v)));
}
function write(rows, delim, eol, bom, trail) {
  const enc = v => (/[",\t\r\n]/.test(v) || rnd() < 0.2) ? '"' + v.replace(/"/g, '""') + '"' : v;
  return (bom ? '﻿' : '') + rows.map(r => r.map(enc).join(delim)).join(eol) + (trail ? eol : '');
}
const kinds = {}; const note = (k, ex) => { if (!kinds[k]) kinds[k] = { n: 0, ex }; kinds[k].n++; };
for (let t = 0; t < 20000; t++) {
  const delim = pick([',', '\t']), eol = pick(['\n', '\r\n', '\r']), w = 2 + Math.floor(rnd() * 5), h = 1 + Math.floor(rnd() * 5);
  const rows = []; for (let r = 0; r < h; r++) { const rw = []; const ww = rnd() < 0.15 ? 1 + Math.floor(rnd() * w) : w; for (let c = 0; c < ww; c++) rw.push(pick(CELLS)); rows.push(rw); }
  // the first record must be a delimited record for the sniffer to have anything to go on
  rows[0] = rows[0].map((v, i) => i === 0 ? 'H' : v); if (rows[0].length < 2) rows[0].push('H2');
  const text = write(rows, delim, eol, rnd() < 0.3, rnd() < 0.5);
  const want = oracleRead(text, delim); let got; try { got = P.csvToRows(text); } catch (e) { note('throw', e.message); continue; }
  const sameDelim = JSON.stringify(P.csvToRows(text, delim)) === JSON.stringify(got);
  if (!sameDelim) { note('sniff-wrong-delim', JSON.stringify(text).slice(0, 200)); continue; }
  if (JSON.stringify(want) !== JSON.stringify(got)) note('cells-differ', { text: JSON.stringify(text).slice(0, 200), want: JSON.stringify(want).slice(0, 200), got: JSON.stringify(got).slice(0, 200) });
}
console.log('CSV:', JSON.stringify(kinds, null, 1).slice(0, 3000));
// asScore table
const AS = ['85', '85.0', ' 85 ', '85%', '-', 'N/A', '', '100', '0', '150', '999', '1000', '.5', '85.', '-5', '+5', '1e2', '０', '85 %', 85, -5, 150, NaN, Infinity, null, true];
console.log('asScore:', AS.map(v => JSON.stringify(v) + '→' + P.asScore(v)).join('  '));
