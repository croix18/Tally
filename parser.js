// ---- Tally parser: zip + inflate + xlsx/csv -> IXL score grid ----
// Dependency-free so the tool works on locked-down school networks.

function inflateRaw(src) {
  let pos = 0, bitBuf = 0, bitCnt = 0;
  let out = new Uint8Array(Math.max(1024, src.length * 4)), outLen = 0;
  function ensure(n) {
    if (outLen + n > out.length) {
      let nb = new Uint8Array(Math.max(out.length * 2, outLen + n));
      nb.set(out.subarray(0, outLen)); out = nb;
    }
  }
  function bit() {
    if (bitCnt === 0) {
      if (pos >= src.length) throw new Error('inflate: unexpected end of data');
      bitBuf = src[pos++]; bitCnt = 8;
    }
    const b = bitBuf & 1; bitBuf >>>= 1; bitCnt--; return b;
  }
  function bits(n) { let v = 0; for (let i = 0; i < n; i++) v |= bit() << i; return v; }
  function buildTree(lengths, n) {
    const counts = new Uint16Array(16), symbols = new Uint16Array(n);
    for (let i = 0; i < n; i++) counts[lengths[i]]++;
    counts[0] = 0;
    const offs = new Uint16Array(16);
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
    for (let i = 0; i < n; i++) if (lengths[i]) symbols[offs[lengths[i]]++] = i;
    return { counts, symbols };
  }
  function decodeSym(t) {
    let sum = 0, cur = 0, len = 0;
    do { cur = 2 * cur + bit(); len++; sum += t.counts[len]; cur -= t.counts[len]; } while (cur >= 0);
    return t.symbols[sum + cur];
  }
  const LBASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const LEXT  = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const DBASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const DEXT  = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  const CLORDER = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
  let fixedLit = null, fixedDist = null;
  function fixedTrees() {
    if (!fixedLit) {
      const l = new Uint8Array(288);
      for (let i = 0; i < 144; i++) l[i] = 8;
      for (let i = 144; i < 256; i++) l[i] = 9;
      for (let i = 256; i < 280; i++) l[i] = 7;
      for (let i = 280; i < 288; i++) l[i] = 8;
      fixedLit = buildTree(l, 288);
      const d = new Uint8Array(30); d.fill(5);
      fixedDist = buildTree(d, 30);
    }
    return [fixedLit, fixedDist];
  }
  function inflateBlock(lit, dist) {
    for (;;) {
      const sym = decodeSym(lit);
      if (sym < 256) { ensure(1); out[outLen++] = sym; }
      else if (sym === 256) return;
      else {
        const li = sym - 257;
        const len = LBASE[li] + bits(LEXT[li]);
        const di = decodeSym(dist);
        const d = DBASE[di] + bits(DEXT[di]);
        ensure(len);
        for (let i = 0; i < len; i++) { out[outLen] = out[outLen - d]; outLen++; }
      }
    }
  }
  let final;
  do {
    final = bit();
    const type = bits(2);
    if (type === 0) {
      bitBuf = 0; bitCnt = 0;
      const len = src[pos] | (src[pos + 1] << 8); pos += 4;
      ensure(len); out.set(src.subarray(pos, pos + len), outLen); outLen += len; pos += len;
    } else if (type === 1) {
      const [l, d] = fixedTrees(); inflateBlock(l, d);
    } else if (type === 2) {
      const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
      const cl = new Uint8Array(19);
      for (let i = 0; i < hclen; i++) cl[CLORDER[i]] = bits(3);
      const clt = buildTree(cl, 19);
      const lengths = new Uint8Array(hlit + hdist);
      for (let i = 0; i < hlit + hdist;) {
        const sym = decodeSym(clt);
        if (sym < 16) lengths[i++] = sym;
        else if (sym === 16) { const prev = lengths[i - 1]; let r = 3 + bits(2); while (r--) lengths[i++] = prev; }
        else if (sym === 17) { let r = 3 + bits(3); while (r--) lengths[i++] = 0; }
        else { let r = 11 + bits(7); while (r--) lengths[i++] = 0; }
      }
      const lt = buildTree(lengths.subarray(0, hlit), hlit);
      const dt = buildTree(lengths.subarray(hlit), hdist);
      inflateBlock(lt, dt);
    } else throw new Error('inflate: bad block type');
  } while (!final);
  return out.subarray(0, outLen);
}

function readZip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip/xlsx file');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  if (p === 0xFFFFFFFF || count === 0xFFFF) throw new Error('ZIP64 archives are not supported (this file is unusually large)');
  const entries = {};
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Bad zip central directory');
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const loc = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
    entries[name] = { method, csize, loc };
    p += 46 + nlen + elen + clen;
  }
  return {
    names: Object.keys(entries),
    read(name) {
      const e = entries[name]; if (!e) return null;
      const nlen = dv.getUint16(e.loc + 26, true), elen = dv.getUint16(e.loc + 28, true);
      const start = e.loc + 30 + nlen + elen;
      const data = u8.subarray(start, start + e.csize);
      if (e.method === 0) return data;
      if (e.method === 8) return inflateRaw(data);
      throw new Error('Unsupported zip compression ' + e.method);
    },
    text(name) { const d = this.read(name); return d ? new TextDecoder().decode(d) : null; }
  };
}

function colIndex(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c >= 65 && c <= 90) n = n * 26 + (c - 64); else break;
  }
  return n - 1;
}
// namespace-agnostic element lookup (some writers emit <x:row>)
const tags = (el, name) => el.getElementsByTagNameNS ? el.getElementsByTagNameNS('*', name) : el.getElementsByTagName(name);

// Returns array of rows (arrays of raw cell values: numbers, strings, or null). No coercion here.
function xlsxToRows(buf) {
  const zip = readZip(buf);
  const parser = new DOMParser();
  const shared = [];
  const ss = zip.text('xl/sharedStrings.xml');
  if (ss) {
    const doc = parser.parseFromString(ss, 'application/xml');
    const sis = tags(doc, 'si');
    for (let i = 0; i < sis.length; i++) {
      const ts = tags(sis[i], 't');
      let s = ''; for (let j = 0; j < ts.length; j++) s += ts[j].textContent;
      shared.push(s);
    }
  }
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = zip.text('xl/workbook.xml'), rels = zip.text('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const wdoc = parser.parseFromString(wb, 'application/xml');
    const first = tags(wdoc, 'sheet')[0];
    const rid = first && (first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    const rdoc = parser.parseFromString(rels, 'application/xml');
    const rl = tags(rdoc, 'Relationship');
    for (let i = 0; i < rl.length; i++) if (rl[i].getAttribute('Id') === rid) {
      let t = rl[i].getAttribute('Target'); if (t.startsWith('/')) t = t.slice(1); else if (!t.startsWith('xl/')) t = 'xl/' + t;
      sheetPath = t;
    }
  }
  const sx = zip.text(sheetPath);
  if (!sx) throw new Error('Worksheet not found in file');
  const doc = parser.parseFromString(sx, 'application/xml');
  const rows = [];
  const rowEls = tags(doc, 'row');
  for (let r = 0; r < rowEls.length; r++) {
    const cells = tags(rowEls[r], 'c');
    const row = [];
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];
      const ref = cell.getAttribute('r') || '';
      const ci = ref ? colIndex(ref) : row.length;
      const t = cell.getAttribute('t');
      let v = null;
      const ve = tags(cell, 'v')[0];
      if (t === 's') { v = ve ? shared[+ve.textContent] : null; }
      else if (t === 'inlineStr') { const ts = tags(cell, 't'); v = ''; for (let j = 0; j < ts.length; j++) v += ts[j].textContent; }
      else if (t === 'str') { v = ve ? ve.textContent : null; }
      else if (t === 'b') { v = ve ? (ve.textContent === '1') : null; }
      else { const txt = ve ? ve.textContent.trim() : ''; v = txt === '' ? null : Number(txt); }
      if (typeof v === 'string' && v.trim() === '') v = null;
      while (row.length < ci) row.push(null);
      row[ci] = v;
    }
    rows.push(row);
  }
  return rows;
}

// CSV -> rows of strings (or null for empty). No numeric coercion here; parseIxlGrid decides what is a score.
function csvToRows(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.map(r => r.map(v => (v == null || String(v).trim() === '') ? null : v));
}

// A score is a number 0–100, or a string that is exactly a number (some writers store numbers as text).
function asScore(v) {
  if (typeof v === 'number') return isNaN(v) ? null : v;
  if (typeof v === 'string') { const m = v.trim().match(/^(\d{1,3})(\.\d+)?%?$/); if (m) return Number(m[1] + (m[2] || '')); }
  return null;
}
const isText = v => typeof v === 'string' && v.trim() !== '';

// Turn raw rows into an IXL score grid: { students:[names], skills:[{unit,lesson,name,id}], scores:[skill][student] }
function parseIxlGrid(rows) {
  let h = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = rows[i] || [];
    if (r.some(v => isText(v) && /skill name/i.test(v))) { h = i; break; }
  }
  if (h < 0) throw new Error('This does not look like an IXL Score Grid export (no "Skill name" header).');
  const hdr = rows[h];
  const cSkill = hdr.findIndex(v => isText(v) && /skill name/i.test(v));
  const cId = hdr.findIndex(v => isText(v) && /skill id/i.test(v));
  let cUnit = hdr.findIndex(v => isText(v) && /^unit$/i.test(v.trim())); if (cUnit < 0) cUnit = 0;
  let cLesson = hdr.findIndex(v => isText(v) && /^lesson$/i.test(v.trim())); if (cLesson < 0) cLesson = cUnit + 1 < cSkill ? cUnit + 1 : -1;
  const firstStudent = Math.max(cSkill, cId) + 1;
  const students = [];
  for (let c = firstStudent; c < hdr.length; c++) {
    const v = hdr[c];
    if (isText(v)) students.push({ col: c, name: String(v).trim() });
  }
  const skills = [], scores = [];
  let lastUnit = '', lastLesson = '';
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const name = r[cSkill];
    if (!isText(name)) continue;
    if (isText(r[cUnit])) lastUnit = String(r[cUnit]).trim();
    if (cLesson >= 0 && isText(r[cLesson])) lastLesson = String(r[cLesson]).trim();
    const sk = { unit: lastUnit || '(no unit)', lesson: lastLesson, name: String(name).trim(), id: cId >= 0 && r[cId] != null ? String(r[cId]).trim() : '' };
    const row = students.map(s => asScore(r[s.col]));
    // IXL lists a skill again when two lessons in one unit share it; it is one skill, so keep one row (best score of the two).
    const dup = sk.id ? skills.findIndex(x => x.unit === sk.unit && x.id === sk.id) : -1;
    if (dup >= 0) { scores[dup] = scores[dup].map((v, j) => v == null ? row[j] : row[j] == null ? v : Math.max(v, row[j])); continue; }
    skills.push(sk); scores.push(row);
  }
  return { students: students.map(s => s.name), skills, scores };
}

// Filename -> { date, courseNum, section, courseTag, accelerated, key, label }
function parseIxlFilename(fn) {
  const base = fn.replace(/\.[^.]+$/, '').replace(/\s\(\d+\)$/, '');
  const date = (base.match(/_(\d{4}-\d{2}-\d{2})_/) || [])[1] || null;
  const m = base.match(/_(\d{6,8})-([A-Za-z0-9]+)-(M_J-[A-Za-z0-9]+|[A-Za-z0-9_]+?)_(?:Math|Algebra|Pre)/);
  const courseNum = m ? m[1] : null, section = m ? m[2] : null, courseTag = m ? m[3].replace(/_/g, '/') : null;
  const flat = base.replace(/_/g, ' ').replace(/-/g, ' ');
  const accelerated = /\bACC\b|Accelerated|Advanced|Honors|\bAlgebra\b(?! *readiness)/i.test(flat) && !/Pre[ -]?Algebra/i.test(flat);
  const key = courseNum && section ? courseNum + '-' + section : base.replace(/_?\d{4}-\d{2}-\d{2}_?/, '_').replace(/_(This|Last)[-_ ]School[-_ ]Year_?/i, '_');   // a renamed class still keys the same week to week
  // Lake County section codes read 7T<period>A: 7T1A is 1st period. Label it the way the teacher says it.
  const pm = section && section.match(/^\d?T(\d)[A-Z]?$/i); const period = pm ? Number(pm[1]) : null;
  const ord = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
  const label = period ? `${ord(period)} Period · ${accelerated ? 'Accelerated' : 'On-level'}` : section ? section + (courseTag ? ' · ' + courseTag : '') : base.slice(0, 40);
  return { date, courseNum, section, courseTag, accelerated, key, label, period };
}

if (typeof module !== 'undefined') module.exports = { inflateRaw, readZip, xlsxToRows, csvToRows, parseIxlGrid, parseIxlFilename, asScore };
