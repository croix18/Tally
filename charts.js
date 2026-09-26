/* ---------- charts.js — plain-SVG graph primitives (spliced into app.js's closure) ----------
   Rules (see COMMAND_CENTER.md): single series in the house teal; class-vs-class in a fixed, validated categorical
   order, always direct-labeled; thin marks; <title> tooltips; text in ink; status colours never used for series. */
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7', '#008300'];
const seriesColor = i => SERIES[i % SERIES.length];
// Letter grades are ordered, so they get one hue light→dark (A darkest) with F in the coral status colour.
const LETTER_COLORS = { A: '#0F5F6B', B: '#1F8F93', C: '#5FBFB5', D: '#B9E5DF', F: '#FF7F6A' };
// One colour per class, fixed by period when known (1st = slot 1, …) else by position, so every screen agrees.
function classColor(sec) { const i = sec && Number.isInteger(sec.period) ? sec.period - 1 : Math.max(0, state.order.indexOf(sec ? sec.key : '')); return seriesColor(i); }
const fmtV = v => v == null ? '—' : (Math.round(v * 10) / 10).toString();
const niceMax = (v, step) => { if (!(v > 0)) return step || 10; const s = step || (v > 200 ? 50 : v > 100 ? 20 : v > 40 ? 10 : v > 10 ? 5 : 1); return Math.ceil(v / s) * s; };

// Horizontal bars: items [{ label, value, max?, hint? }]. One hue; value labels on every bar (few bars, so they're the point).
function chartBars(items, o) {
  o = o || {}; const w = o.w || 640, rowH = 30, lw = o.labelW || 150, h = items.length * rowH + 28;
  const max = o.max || niceMax(Math.max(...items.map(i => i.value || 0), 1));
  const X = v => lw + (v / max) * (w - lw - 60);
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.aria || 'bar chart')}">`;
  [0, 0.5, 1].forEach(f => { s += `<line x1="${X(max * f)}" y1="6" x2="${X(max * f)}" y2="${h - 22}" class="gl"/><text x="${X(max * f)}" y="${h - 6}" text-anchor="middle" class="tl">${o.pct ? Math.round(max * f) + '%' : fmtV(max * f)}</text>`; });
  items.forEach((it, i) => { const y = 8 + i * rowH; const v = it.value || 0;
    s += `<text x="${lw - 10}" y="${y + 15}" text-anchor="end" class="lbl">${esc(it.label)}</text><rect x="${X(0)}" y="${y + 3}" width="${Math.max(X(v) - X(0), 0)}" height="16" rx="4" class="bar" style="fill:${it.color || 'var(--teal)'}"><title>${esc(it.label)}: ${o.pct ? Math.round(v) + '%' : fmtV(v)}${it.hint ? ' · ' + esc(it.hint) : ''}</title></rect><text x="${X(v) + 6}" y="${y + 15}" class="val">${o.pct ? Math.round(v) + '%' : fmtV(v)}</text>`; });
  return s + '</svg>';
}
// Stacked horizontal bars: rows [{ label, parts: { key: value } }], keys in fixed order with colours; legend always.
function chartStacked(rows, keys, o) {
  o = o || {}; const w = o.w || 640, rowH = 30, lw = o.labelW || 150, h = rows.length * rowH + 40;
  const tot = r => keys.reduce((a, k) => a + (r.parts[k] || 0), 0); const max = o.max || Math.max(...rows.map(tot), 1);
  const X = v => lw + (v / max) * (w - lw - 20);
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.aria || 'stacked bar chart')}">`;
  rows.forEach((r, i) => { const y = 8 + i * rowH; let x = 0; s += `<text x="${lw - 10}" y="${y + 15}" text-anchor="end" class="lbl">${esc(r.label)}</text>`;
    keys.forEach((k, j) => { const v = r.parts[k] || 0; if (!v) return; s += `<rect x="${X(x) + (x ? 1 : 0)}" y="${y + 3}" width="${Math.max(X(x + v) - X(x) - (x ? 1 : 0), 0)}" height="16" rx="3" style="fill:${(o.colors || {})[k] || seriesColor(j)}"><title>${esc(r.label)} · ${esc(k)}: ${v}</title></rect>${v / max > 0.06 ? `<text x="${(X(x) + X(x + v)) / 2}" y="${y + 15}" text-anchor="middle" class="inv">${v}</text>` : ''}`; x += v; }); });
  s += `<g class="legend">${keys.map((k, j) => `<rect x="${lw + j * 80}" y="${h - 20}" width="12" height="12" rx="3" style="fill:${(o.colors || {})[k] || seriesColor(j)}"/><text x="${lw + j * 80 + 16}" y="${h - 10}" class="tl">${esc(k)}</text>`).join('')}</g>`;
  return s + '</svg>';
}
// Line chart over labelled x steps: series [{ name, values: [y|null] }], labels [x]. Direct labels at the line ends + legend.
function chartLines(labels, series, o) {
  o = o || {}; const w = o.w || 640, h = o.h || 220, l = 44, r = 150, t = 12, b = 30;
  const ys = series.flatMap(x => x.values).filter(v => v != null); if (!ys.length) return '<div class="lbEmpty">Nothing to plot yet.</div>';
  const lo = o.min != null ? o.min : Math.max(0, Math.floor(Math.min(...ys) / 10) * 10 - 10), hi = o.max != null ? o.max : niceMax(Math.max(...ys), 10);
  const X = i => l + (labels.length > 1 ? i / (labels.length - 1) : 0.5) * (w - l - r), Y = v => h - b - (v - lo) / (hi - lo || 1) * (h - t - b);
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.aria || 'line chart')}">`;
  const ticks = 4; for (let i = 0; i <= ticks; i++) { const v = lo + (hi - lo) * i / ticks; s += `<line x1="${l}" y1="${Y(v)}" x2="${w - r}" y2="${Y(v)}" class="gl"/><text x="${l - 6}" y="${Y(v) + 4}" text-anchor="end" class="tl">${o.pct ? Math.round(v) + '%' : fmtV(v)}</text>`; }
  labels.forEach((lb, i) => { s += `<text x="${X(i)}" y="${h - 8}" text-anchor="middle" class="tl">${esc(lb)}</text>`; });
  series.forEach((sr, j) => { const c = sr.color || (series.length === 1 ? 'var(--teal)' : seriesColor(j)); let d = '', last = null, pen = false;
    sr.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' '; pen = true; last = [i, v]; });
    s += `<path d="${d}" class="ln" style="stroke:${c}"/>`;
    sr.values.forEach((v, i) => { if (v != null) s += `<circle cx="${X(i)}" cy="${Y(v)}" r="4" style="fill:${c}"><title>${esc(sr.name)} · ${esc(labels[i])}: ${o.pct ? Math.round(v) + '%' : fmtV(v)}</title></circle>`; });
    if (last) s += `<text x="${X(last[0]) + 8}" y="${Y(last[1]) + 4}" class="lbl">${esc(sr.name)} <tspan class="val">${o.pct ? Math.round(last[1]) + '%' : fmtV(last[1])}</tspan></text>`; });
  return s + '</svg>';
}
// Dot plot on a 0..max axis; stacks dots at equal values (shrinks radius when tall).
function chartDots(values, max, o) {
  o = o || {}; const w = o.w || 800, v = values.filter(x => x != null); const counts = {}; v.forEach(x => counts[x] = (counts[x] || 0) + 1);
  const tallest = Math.max(1, ...Object.values(counts)); const r = tallest > 12 ? 4 : 6; const h = Math.max(60, tallest * (r * 2 + 1) + 34);
  const X = x => 30 + x / (max || 1) * (w - 60);
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="dot plot">`;
  const step = max > 40 ? 10 : max > 10 ? 5 : 1; for (let x = 0; x <= max; x += step) s += `<line x1="${X(x)}" y1="${h - 26}" x2="${X(x)}" y2="${h - 20}" class="ax"/><text x="${X(x)}" y="${h - 6}" text-anchor="middle" class="tl">${x}</text>`;
  s += `<line x1="${X(0)}" y1="${h - 26}" x2="${X(max)}" y2="${h - 26}" class="ax"/>`;
  Object.keys(counts).map(Number).sort((a, b) => a - b).forEach(x => { for (let i = 0; i < counts[x]; i++) s += `<circle cx="${X(x)}" cy="${h - 28 - r - i * (r * 2 + 1)}" r="${r}" class="dot"><title>${x}: ${counts[x]} student${counts[x] === 1 ? '' : 's'}</title></circle>`; });
  return s + '</svg>';
}
// Histogram with a bin size; bars touch (histograms do), 1px surface gap for legibility.
function chartHist(values, max, bin, o) {
  o = o || {}; const w = o.w || 800, h = 200, v = values.filter(x => x != null); bin = bin || (max > 40 ? 10 : max > 10 ? 5 : 1);
  const nb = Math.max(1, Math.ceil((max + 0.0001) / bin)); const c = new Array(nb).fill(0); v.forEach(x => c[Math.min(nb - 1, Math.floor(x / bin))]++);
  const top = niceMax(Math.max(...c, 1), c.length && Math.max(...c) > 10 ? 5 : 1); const X = i => 40 + i / nb * (w - 60), Y = n => h - 30 - n / top * (h - 50);
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="histogram">`;
  for (let n = 0; n <= top; n += Math.max(1, Math.round(top / 4))) s += `<line x1="40" y1="${Y(n)}" x2="${w - 20}" y2="${Y(n)}" class="gl"/><text x="34" y="${Y(n) + 4}" text-anchor="end" class="tl">${n}</text>`;
  c.forEach((n, i) => { const lo = i * bin, hi = Math.min(max, (i + 1) * bin); s += `<rect x="${X(i) + 1}" y="${Y(n)}" width="${X(i + 1) - X(i) - 2}" height="${Y(0) - Y(n)}" class="bar" style="fill:var(--teal)"><title>${lo}–${hi}: ${n} student${n === 1 ? '' : 's'}</title></rect>${n ? `<text x="${(X(i) + X(i + 1)) / 2}" y="${Y(n) - 4}" text-anchor="middle" class="val">${n}</text>` : ''}<text x="${X(i)}" y="${h - 10}" text-anchor="middle" class="tl">${lo}</text>`; });
  s += `<text x="${X(nb)}" y="${h - 10}" text-anchor="middle" class="tl">${Math.max(max, nb * bin)}</text>`;
  return s + '</svg>';
}
// Stem-and-leaf as a table (stems of 10 for 0–100 data, of 1 for small ranges).
function chartStem(values, max) {
  const v = values.filter(x => x != null).map(x => Math.round(x)).sort((a, b) => a - b); if (!v.length) return '';
  const unit = max > 30 ? 10 : 1; const stems = {}; v.forEach(x => { const st = Math.floor(x / unit); (stems[st] = stems[st] || []).push(unit === 10 ? x % 10 : x); });
  const lo = Math.floor(v[0] / unit), hi = Math.floor(v[v.length - 1] / unit); let rows = '';
  for (let st = lo; st <= hi; st++) rows += `<tr><th>${unit === 10 ? st : st}</th><td>${(stems[st] || []).map(l => unit === 10 ? l : '•').join(' ')}</td></tr>`;
  return `<table class="stem"><tbody>${rows}</tbody></table><p class="ghint">${unit === 10 ? 'Stem = tens, leaf = ones: 6 | 3 5 means 63 and 65.' : 'Stem = the value, each • is one student.'}</p>`;
}
// Bar graph of how many students at each value (0..max); a bar per value.
function chartFreq(values, max, o) {
  const v = values.filter(x => x != null); const counts = {}; v.forEach(x => counts[Math.round(x)] = (counts[Math.round(x)] || 0) + 1);
  const items = []; for (let x = 0; x <= max; x++) items.push({ label: String(x), value: counts[x] || 0 });
  if (items.length > 26) return chartHist(values, max, Math.ceil(max / 20), o);   // too many bars: bin them
  const w = (o && o.w) || 800, h = 200, top = niceMax(Math.max(...items.map(i => i.value), 1), 1); const X = i => 40 + i / items.length * (w - 60), Y = n => h - 30 - n / top * (h - 50);
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="bar graph">`;
  for (let n = 0; n <= top; n += Math.max(1, Math.round(top / 4))) s += `<line x1="40" y1="${Y(n)}" x2="${w - 20}" y2="${Y(n)}" class="gl"/><text x="34" y="${Y(n) + 4}" text-anchor="end" class="tl">${n}</text>`;
  items.forEach((it, i) => { s += `<rect x="${X(i) + 3}" y="${Y(it.value)}" width="${Math.max(X(i + 1) - X(i) - 6, 2)}" height="${Y(0) - Y(it.value)}" rx="3" class="bar" style="fill:var(--teal)"><title>${it.label}: ${it.value} student${it.value === 1 ? '' : 's'}</title></rect><text x="${(X(i) + X(i + 1)) / 2}" y="${h - 10}" text-anchor="middle" class="tl">${it.label}</text>`; });
  return s + '</svg>';
}
// Circle graph: parts [{ label, value }]; percentages direct-labeled outside, legend beside.
function chartCircle(parts, o) {
  o = o || {}; const tot = parts.reduce((a, p) => a + p.value, 0); if (!tot) return '<div class="lbEmpty">Nothing to plot yet.</div>';
  const cx = 130, cy = 110, R = 84; let a0 = -Math.PI / 2; let s = `<svg class="chart circle" viewBox="0 0 ${o.w || 560} 220" role="img" aria-label="circle graph">`;
  parts.forEach((p, i) => { if (!p.value) return; const a1 = a0 + p.value / tot * 2 * Math.PI; const big = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    const d = p.value === tot ? `M${cx - R} ${cy}A${R} ${R} 0 1 1 ${cx + R} ${cy}A${R} ${R} 0 1 1 ${cx - R} ${cy}` : `M${cx} ${cy}L${x0} ${y0}A${R} ${R} 0 ${big} 1 ${x1} ${y1}Z`;
    s += `<path d="${d}" style="fill:${p.color || seriesColor(i)}" stroke="#fff" stroke-width="2"><title>${esc(p.label)}: ${p.value} (${Math.round(p.value / tot * 100)}%)</title></path>`;
    const am = (a0 + a1) / 2; if (p.value / tot >= 0.06) s += `<text x="${cx + (R + 18) * Math.cos(am)}" y="${cy + (R + 18) * Math.sin(am) + 4}" text-anchor="middle" class="val">${Math.round(p.value / tot * 100)}%</text>`; a0 = a1; });
  parts.forEach((p, i) => { s += `<rect x="260" y="${40 + i * 26}" width="14" height="14" rx="3" style="fill:${p.color || seriesColor(i)}"/><text x="280" y="${52 + i * 26}" class="lbl">${esc(p.label)} <tspan class="tl">${p.value}</tspan></text>`; });
  return s + '</svg>';
}
const CHART_CSS = `
.chart{width:100%;height:auto;display:block}.chart .gl{stroke:var(--grid);stroke-width:1}.chart .ax{stroke:var(--navy);stroke-width:1.5}
.chart .tl{font-size:11px;fill:var(--ink-soft)}.chart .lbl{font-size:12.5px;font-weight:700;fill:var(--navy)}.chart .val{font-size:11.5px;font-weight:900;fill:var(--navy)}.chart .inv{font-size:11px;font-weight:900;fill:#fff}
.chart .ln{fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}.chart .dot{fill:var(--teal);stroke:#fff;stroke-width:1.5}.chart .bar{stroke:none}
.stem{border-collapse:collapse;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:15px}.stem th{text-align:right;padding:2px 10px;border-right:2px solid var(--navy);color:var(--navy)}.stem td{padding:2px 10px;letter-spacing:.15em}
.labRow.one{grid-template-columns:1fr}.chart.circle{max-width:460px}
`;
// The app page gets the chart styles at boot; the standalone Race/Lab export includes CHART_CSS through LAB_CSS.
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: CHART_CSS }));
