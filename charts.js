/* ---------- charts.js — plain-SVG graph primitives (spliced into app.js's closure) ----------
   Rules (see COMMAND_CENTER.md): a class's own plot wears that class's colour (--cc; the house teal where there is no
   class); class-vs-class in a fixed, validated categorical order, always direct-labeled; anything that means
   good → bad (letter grades, how much of a unit is done) wears LETTER_COLORS, green to red; thin marks; <title>
   tooltips; text in ink. */
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7', '#008300'];
const seriesColor = i => SERIES[i % SERIES.length];
// Letter grades wear the colours anyone would guess: A green, B blue, C yellow, D orange, F red (Croix, 4 Oct: "common
// sense colors… not different shades of aqua"). Red and green are the classic colour-blind trap, and in a circle graph
// any two slices can touch, so the five were chosen by search to stay apart for every pair under simulated protanopia
// and deuteranopia (worst pair ΔE 8.0 in OKLab×100; 19 with full colour vision) — and no mark relies on colour alone:
// slices and legends carry the letter. The same five are the --g-* tokens in app.html (tests/colors.js keeps them equal).
const LETTER_COLORS = { A: '#55b872', B: '#1c7abb', C: '#efd127', D: '#d88018', F: '#c51d28' };
// Which letter segments are dark enough for white text; green, yellow and orange take ink.
const LETTER_DARK = ['B', 'F'];
// Ordered bands (least → most done) on the same scale: red, orange, yellow, green.
const QUARTER_COLORS = [LETTER_COLORS.F, LETTER_COLORS.D, LETTER_COLORS.C, LETTER_COLORS.A];
// A bar that shows a percent grade wears the colour of the letter that percent earns.
const gradeFill = pct => pct == null ? 'var(--teal)' : LETTER_COLORS[letterOf(Math.round(pct))] || 'var(--teal)';
const NEUTRAL_FILL = '#C9CED8';   // "not started" and other no-data slices: a grey that still shows on a white card
// One colour per class, fixed by period when known (1st = slot 1, …) else by position, so every screen agrees.
function classColor(sec) { const i = sec && Number.isInteger(sec.period) ? sec.period - 1 : Math.max(0, state.order.indexOf(sec ? sec.key : '')); return seriesColor(i); }
const fmtV = v => v == null ? '—' : (Math.round(v * 10) / 10).toString();
const niceMax = (v, step) => { if (!(v > 0)) return step || 10; const s = step || (v > 200 ? 50 : v > 100 ? 20 : v > 40 ? 10 : v > 10 ? 5 : 1); return Math.ceil(v / s) * s; };

// Horizontal bars: items [{ label, value, max?, hint? }]. One hue; value labels on every bar (few bars, so they're the point).
function chartBars(items, o) {
  o = o || {}; const w = o.w || 640, rowH = o.rowH || 30, barH = o.barH || 16, lw = o.labelW || 150, h = items.length * rowH + 28;
  const max = o.max || niceMax(Math.max(...items.map(i => i.value || 0), 1));
  const X = v => lw + (v / max) * (w - lw - 60);
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.aria || 'bar chart')}">`;
  (o.ticks || [0, max / 2, max]).forEach(tv => { s += `<line x1="${X(tv)}" y1="6" x2="${X(tv)}" y2="${h - 22}" class="gl"/><text x="${X(tv)}" y="${h - 6}" text-anchor="middle" class="tl">${o.pct ? Math.round(tv) + '%' : fmtV(tv)}</text>`; });   /* o.ticks: round numbers when the maximum isn't one (0, 5, 10, 15, 20 for a test out of 21) */
  items.forEach((it, i) => { const y = 8 + i * rowH + (rowH - barH) / 2 - 7; const v = it.value || 0;   /* y + 3 is the bar's top, as it always was at the default sizes */
    const lab = o.fmt ? o.fmt(v) : o.pct ? Math.round(v) + '%' : fmtV(v);   /* o.fmt: the caller's own number format (the Data Lab's class averages keep one decimal) */
    s += `<text x="${lw - 10}" y="${y + barH / 2 + 7}" text-anchor="end" class="lbl">${esc(it.label)}</text><rect x="${X(0)}" y="${y + 3}" width="${Math.max(X(v) - X(0), 0)}" height="${barH}" rx="4" class="bar" style="fill:${it.color || 'var(--teal)'}"><title>${esc(it.label)}: ${lab}${it.hint ? ' · ' + esc(it.hint) : ''}</title></rect><text x="${X(v) + 6}" y="${y + barH / 2 + 7}" class="val">${lab}</text>`; });
  return s + '</svg>';
}
// Stacked horizontal bars: rows [{ label, parts: { key: value } }], keys in fixed order with colours; legend always.
function chartStacked(rows, keys, o) {
  o = o || {}; const w = o.w || 640, rowH = 30, lw = o.labelW || 150, h = rows.length * rowH + 40;
  const tot = r => keys.reduce((a, k) => a + (r.parts[k] || 0), 0); const max = o.max || Math.max(...rows.map(tot), 1);
  const X = v => lw + (v / max) * (w - lw - 20);
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.aria || 'stacked bar chart')}">`;
  rows.forEach((r, i) => { const y = 8 + i * rowH; let x = 0; s += `<text x="${lw - 10}" y="${y + 15}" text-anchor="end" class="lbl">${esc(r.label)}</text>`;
    keys.forEach((k, j) => { const v = r.parts[k] || 0; if (!v) return; s += `<rect x="${X(x) + (x ? 1 : 0)}" y="${y + 3}" width="${Math.max(X(x + v) - X(x) - (x ? 1 : 0), 0)}" height="16" rx="3" style="fill:${(o.colors || {})[k] || seriesColor(j)}" stroke="#16213A" stroke-opacity=".18" stroke-width="1"><title>${esc(r.label)}, ${esc(k)}: ${v}</title></rect>${v / max > 0.06 ? `<text x="${(X(x) + X(x + v)) / 2}" y="${y + 15}" text-anchor="middle" class="${(o.dark || []).includes(k) ? 'inv' : 'val'}">${v}</text>` : ''}`; x += v; }); });
  s += `<g class="legend">${keys.map((k, j) => `<rect x="${lw + j * 80}" y="${h - 20}" width="12" height="12" rx="3" style="fill:${(o.colors || {})[k] || seriesColor(j)}" stroke="#16213A" stroke-opacity=".25" stroke-width="1"/><text x="${lw + j * 80 + 16}" y="${h - 10}" class="tl">${esc(k)}</text>`).join('')}</g>`;
  return s + '</svg>';
}
// Line chart over labelled x steps: series [{ name, values: [y|null] }], labels [x]. Direct labels at the line ends + legend.
function chartLines(labels, series, o) {
  o = o || {}; const w = o.w || 640, h = o.h || 220, l = 44, t = 12, b = 30;
  const longest = Math.max(0, ...series.map(x => String(x.name).length)) + 6; const r = Math.max(o.labelW || 170, Math.min(w * 0.45, longest * 6.8 + 24));   // room for the longest direct label
  const ys = series.flatMap(x => x.values).filter(v => v != null); if (!ys.length) return '<div class="lbEmpty">Nothing to plot yet.</div>';
  const lo = o.min != null ? o.min : Math.max(0, Math.floor(Math.min(...ys) / 10) * 10 - 10), hi = o.max != null ? o.max : niceMax(Math.max(...ys), 10);
  const X = i => l + (labels.length > 1 ? i / (labels.length - 1) : 0.5) * (w - l - r), Y = v => h - b - (v - lo) / (hi - lo || 1) * (h - t - b);
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.aria || 'line chart')}">`;
  const ticks = 4; for (let i = 0; i <= ticks; i++) { const v = lo + (hi - lo) * i / ticks; s += `<line x1="${l}" y1="${Y(v)}" x2="${w - r}" y2="${Y(v)}" class="gl"/><text x="${l - 6}" y="${Y(v) + 4}" text-anchor="end" class="tl">${o.pct ? Math.round(v) + '%' : fmtV(v)}</text>`; }
  // Optional x labels thinned so dates don't collide; optional marks = vertical dividers before index i (quarter boundaries).
  const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor((w - l - r) / 64))));
  labels.forEach((lb, i) => { if (i % every && i !== labels.length - 1) return; s += `<text x="${X(i)}" y="${h - 8}" text-anchor="middle" class="tl">${esc(lb)}</text>`; });
  (o.marks || []).forEach(mk => { if (!(mk.i > 0 && mk.i < labels.length)) return; const x = (X(mk.i - 1) + X(mk.i)) / 2; s += `<line x1="${x}" y1="${t}" x2="${x}" y2="${h - b}" class="qmark"/><text x="${x + 4}" y="${h - b - 6}" class="tl qmarkl">${esc(mk.label)}</text>`; });
  const ends = [];
  series.forEach((sr, j) => { const c = sr.color || (series.length === 1 ? 'var(--teal)' : seriesColor(j)); let d = '', last = null, pen = false;
    sr.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' '; pen = true; last = [i, v]; });
    s += `<path d="${d}" class="ln${sr.ref ? ' ref' : ''}" style="stroke:${c}"/>`;
    sr.values.forEach((v, i) => { if (v != null) s += `<circle cx="${X(i)}" cy="${Y(v)}" r="4" style="fill:${c}"><title>${esc(sr.name)} · ${esc(labels[i])}: ${o.pct ? Math.round(v) + '%' : fmtV(v)}</title></circle>`; });
    if (last) ends.push({ x: X(last[0]), y: Y(last[1]), want: Y(last[1]), name: sr.name, v: last[1], c }); });
  // Direct labels at the line ends, nudged apart so two classes that finish close together stay readable.
  ends.sort((a, b) => a.want - b.want); const gap = 15;
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < gap) ends[i].y = ends[i - 1].y + gap;
  const over = ends.length ? ends[ends.length - 1].y - (h - b - 2) : 0; if (over > 0) { for (let i = ends.length - 1; i >= 0; i--) { ends[i].y -= over; if (i && ends[i].y - ends[i - 1].y >= gap) break; } }
  ends.forEach(e => { const lbl = esc(e.name) + ' '; const val = o.pct ? Math.round(e.v) + '%' : fmtV(e.v);
    if (Math.abs(e.y - e.want) > 2) s += `<line x1="${e.x + 5}" y1="${e.want}" x2="${w - r + 6}" y2="${e.y}" class="gl" style="stroke:${e.c};opacity:.6"/>`;
    s += `<text x="${w - r + 8}" y="${e.y + 4}" class="lbl">${lbl}<tspan class="val">${val}</tspan></text>`; });
  return s + '</svg>';
}
// The class average on a plot: a dashed line with a diamond on top — the same mark as the box plot's mean. The number
// itself is beside the class name, so the mark carries no label, only a tooltip.
const meanMark = (x, yTop, yAxis, label) => `<g class="mean"><line x1="${x.toFixed(1)}" y1="${yTop}" x2="${x.toFixed(1)}" y2="${yAxis}" class="meanLine"/><rect x="${(x - 6).toFixed(1)}" y="${yTop - 6}" width="12" height="12" transform="rotate(45 ${x.toFixed(1)} ${yTop})" class="meanDia"/><title>${esc(label)}</title></g>`;
// Dot plot on a 0..max axis; stacks dots at equal values (shrinks radius when tall).
function chartDots(values, max, o) {
  o = o || {}; const w = o.w || 800, v = values.filter(x => x != null); const counts = {}; v.forEach(x => counts[x] = (counts[x] || 0) + 1);
  const tallest = Math.max(1, ...Object.values(counts)); const r = tallest > 12 ? 4 : 6; const pad = o.mean != null ? 18 : 0; const h = Math.max(60, tallest * (r * 2 + 1) + 34) + pad;   /* dots hang from the axis, so extra height is headroom for the average's diamond */
  const X = x => 30 + x / (max || 1) * (w - 60);
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="dot plot">`;
  const step = max > 40 ? 10 : max > 10 ? 5 : 1; for (let x = 0; x <= max; x += step) s += `<line x1="${X(x)}" y1="${h - 26}" x2="${X(x)}" y2="${h - 20}" class="ax"/><text x="${X(x)}" y="${h - 6}" text-anchor="middle" class="tl">${x}</text>`;
  s += `<line x1="${X(0)}" y1="${h - 26}" x2="${X(max)}" y2="${h - 26}" class="ax"/>`;
  Object.keys(counts).map(Number).sort((a, b) => a - b).forEach(x => { for (let i = 0; i < counts[x]; i++) s += `<circle cx="${X(x)}" cy="${h - 28 - r - i * (r * 2 + 1)}" r="${r}" class="dot"><title>${x}: ${counts[x]} student${counts[x] === 1 ? '' : 's'}</title></circle>`; });
  if (o.mean != null) s += meanMark(X(o.mean), 10, h - 26, o.meanLabel || 'Average');
  return s + '</svg>';
}
// Histogram with a bin size; bars touch (histograms do), 1px surface gap for legibility.
function chartHist(values, max, bin, o) {
  o = o || {}; const pad = o.mean != null ? 16 : 0; const w = o.w || 800, h = 200 + pad, v = values.filter(x => x != null); bin = bin || (max > 40 ? 10 : max > 10 ? 5 : 1);
  // Bins are [lo, hi) with the top bin closed at max, so 100 with bins of 10 gives ten bins, not an empty 100–110.
  const nb = Math.max(1, Math.ceil(max / bin - 1e-9)); const c = new Array(nb).fill(0); v.forEach(x => c[Math.max(0, Math.min(nb - 1, Math.floor(x / bin)))]++);
  const ints = v.every(x => Number.isInteger(x)); const range = (lo, hi, last) => !ints ? `${lo}–${hi}` : bin === 1 ? `${lo}` : last ? `${lo}–${Math.max(lo, Math.round(max))}` : `${lo}–${hi - 1}`;
  const top = niceMax(Math.max(...c, 1), c.length && Math.max(...c) > 10 ? 5 : 1); const X = i => 40 + i / nb * (w - 60), Y = n => h - 30 - n / top * (h - 50 - pad);
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="histogram">`;
  for (let n = 0; n <= top; n += Math.max(1, Math.round(top / 4))) s += `<line x1="40" y1="${Y(n)}" x2="${w - 20}" y2="${Y(n)}" class="gl"/><text x="34" y="${Y(n) + 4}" text-anchor="end" class="tl">${n}</text>`;
  c.forEach((n, i) => { const lo = i * bin, hi = (i + 1) * bin, last = i === nb - 1; s += `<rect x="${X(i) + 1}" y="${Y(n)}" width="${X(i + 1) - X(i) - 2}" height="${Y(0) - Y(n)}" class="bar" style="fill:var(--cc,var(--teal))"><title>${range(lo, hi, last)}: ${n} student${n === 1 ? '' : 's'}</title></rect>${n ? `<text x="${(X(i) + X(i + 1)) / 2}" y="${Y(n) - 4}" text-anchor="middle" class="val">${n}</text>` : ''}<text x="${X(i)}" y="${h - 10}" text-anchor="middle" class="tl">${lo}</text>`; });
  s += `<text x="${X(nb)}" y="${h - 10}" text-anchor="middle" class="tl">${nb * bin}</text>`;
  if (o.mean != null) s += meanMark(X(Math.max(0, Math.min(nb, o.mean / bin))), 10, Y(0), o.meanLabel || 'Average');   /* the axis is labelled at bin edges, so a value sits at value ÷ bin */
  return s + '</svg>';
}
// Stem-and-leaf as a table: stems are always tens, leaves ones (the form students learn), so 0–23 data reads 0 | 3 5 8 / 1 | 0 2 / 2 | 1.
function chartStem(values, max) {
  const v = values.filter(x => x != null).map(x => Math.round(x)).sort((a, b) => a - b); if (!v.length) return '';
  const stems = {}; v.forEach(x => { const st = Math.floor(x / 10); (stems[st] = stems[st] || []).push(x % 10); });
  const lo = Math.min(0, Math.floor(v[0] / 10)), hi = Math.max(Math.floor(v[v.length - 1] / 10), Math.floor((max || 0) / 10)); let rows = '';
  for (let st = lo; st <= hi; st++) rows += `<tr><th>${st}</th><td>${(stems[st] || []).join(' ')}</td></tr>`;
  return `<table class="stem"><tbody>${rows}</tbody></table><p class="ghint">Key: 1 | 3 means 13</p>`;
}
// Bar graph of how many students at each value (0..max); a bar per value.
function chartFreq(values, max, o) {
  const v = values.filter(x => x != null); const counts = {}; v.forEach(x => counts[Math.round(x)] = (counts[Math.round(x)] || 0) + 1);
  const items = []; for (let x = 0; x <= max; x++) items.push({ label: String(x), value: counts[x] || 0 });
  if (items.length > 26) return chartHist(values, max, Math.ceil(max / 20), o);   // too many bars: bin them
  o = o || {}; const pad = o.mean != null ? 16 : 0; const w = o.w || 800, h = 200 + pad, top = niceMax(Math.max(...items.map(i => i.value), 1), 1); const X = i => 40 + i / items.length * (w - 60), Y = n => h - 30 - n / top * (h - 50 - pad);
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="bar graph">`;
  for (let n = 0; n <= top; n += Math.max(1, Math.round(top / 4))) s += `<line x1="40" y1="${Y(n)}" x2="${w - 20}" y2="${Y(n)}" class="gl"/><text x="34" y="${Y(n) + 4}" text-anchor="end" class="tl">${n}</text>`;
  items.forEach((it, i) => { s += `<rect x="${X(i) + 3}" y="${Y(it.value)}" width="${Math.max(X(i + 1) - X(i) - 6, 2)}" height="${Y(0) - Y(it.value)}" rx="3" class="bar" style="fill:var(--cc,var(--teal))"><title>${it.label}: ${it.value} student${it.value === 1 ? '' : 's'}</title></rect><text x="${(X(i) + X(i + 1)) / 2}" y="${h - 10}" text-anchor="middle" class="tl">${it.label}</text>`; });
  if (o.mean != null) s += meanMark(X(Math.max(0, Math.min(items.length, o.mean + 0.5))), 10, Y(0), o.meanLabel || 'Average');   /* each value's bar is centred on value + ½ */
  return s + '</svg>';
}
// Circle graph: parts [{ label, value, short? }]. Each slice is labeled outside with its share (and its letter when it
// has one), anchored away from the circle so a label never runs into the legend beside it. The graph sets its own type
// sizes and its own width (from the longest legend line), so it reads the same on the Board and on a saved page.
function chartCircle(parts, o) {
  o = o || {}; const tot = parts.reduce((a, p) => a + p.value, 0); if (!tot) return '<div class="lbEmpty">Nothing to plot yet.</div>';
  const cx = 156, cy = 108, R = 82, H = 216, lx = 316, pitch = 30; const fs = 'style="font-size:19px"', fl = 'style="font-size:21px"';
  const w = o.w || Math.max(430, Math.ceil(lx + 24 + Math.max(...parts.map(p => String(p.label).length + String(p.value).length + 1)) * 11.6 + 10));
  let a0 = -Math.PI / 2; let s = `<svg class="chart circle" viewBox="0 0 ${w} ${H}" role="img" aria-label="circle graph">`;
  parts.forEach((p, i) => { if (!p.value) return; const a1 = a0 + p.value / tot * 2 * Math.PI; const big = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    const d = p.value === tot ? `M${cx - R} ${cy}A${R} ${R} 0 1 1 ${cx + R} ${cy}A${R} ${R} 0 1 1 ${cx - R} ${cy}` : `M${cx} ${cy}L${x0} ${y0}A${R} ${R} 0 ${big} 1 ${x1} ${y1}Z`;
    s += `<path d="${d}" style="fill:${p.color || seriesColor(i)}" stroke="#fff" stroke-width="2"><title>${esc(p.label)}: ${p.value} (${Math.round(p.value / tot * 100)}%)</title></path>`;
    const am = (a0 + a1) / 2, c = Math.cos(am), sn = Math.sin(am); const side = c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle'; const out = R + (side === 'middle' ? 8 : 7);
    if (p.value / tot >= 0.06) s += `<text x="${(cx + out * c).toFixed(1)}" y="${(cy + out * sn + (side === 'middle' ? (sn > 0 ? 15 : -2) : 6 + sn * 9)).toFixed(1)}" text-anchor="${side}" class="val" ${fs}>${p.short ? esc(p.short) + ' ' : ''}${Math.round(p.value / tot * 100)}%</text>`; a0 = a1; });
  s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#16213A" stroke-opacity=".45" stroke-width="1"/>`;
  const ly = cy - parts.length * pitch / 2 + 6;   // the legend sits level with the middle of the circle
  parts.forEach((p, i) => { s += `<rect x="${lx}" y="${ly + i * pitch}" width="17" height="17" rx="4" style="fill:${p.color || seriesColor(i)}" stroke="#16213A" stroke-opacity=".45" stroke-width="1"/><text x="${lx + 25}" y="${ly + 15.5 + i * pitch}" class="lbl" ${fl}>${esc(p.label)} <tspan class="tl" ${fs}>${p.value}</tspan></text>`; });
  return s + '</svg>';
}
const CHART_CSS = `
.chart{width:100%;height:auto;display:block}.chart .gl{stroke:var(--grid);stroke-width:1}.chart .ax{stroke:var(--navy);stroke-width:1.5}
.chart .tl{font-size:12px;fill:var(--ink-soft)}.chart .lbl{font-size:13px;font-weight:var(--w-bold);fill:var(--navy)}.chart .val{font-size:12px;font-weight:var(--w-black);fill:var(--navy)}.chart .inv{font-size:12px;font-weight:var(--w-black);fill:#fff}
#lb .chart .tl{font-size:16px}#lb .chart .lbl{font-size:17px}#lb .chart .val{font-size:16px}#lb .chart .inv{font-size:16px}
.chart .qmark{stroke:var(--ink-soft);stroke-width:1;stroke-dasharray:4 4;opacity:.7}.chart .qmarkl{font-size:11px;font-weight:var(--w-bold)}.chart .ln.ref{stroke-dasharray:5 4;stroke-width:2}
.chart .ln{fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}.chart .dot{fill:var(--cc,var(--teal));stroke:#fff;stroke-width:1.5}.chart .meanLine{stroke:var(--navy);stroke-width:1.5;stroke-dasharray:3 3;opacity:.7}.chart .meanDia{fill:var(--white);stroke:var(--navy);stroke-width:2}.chart .bar{stroke:none}
.stem{border-collapse:collapse;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:15px}.stem th{text-align:right;padding:2px 10px;border-right:2px solid var(--navy);color:var(--navy)}.stem td{padding:2px 10px;letter-spacing:.15em}
.labRow.one{grid-template-columns:1fr}.chart.circle{max-width:460px;overflow:visible}#lb .chart.circle{max-width:min(62vw,1150px)}.lbWrap .stem{font-size:calc(var(--bu)*1.9)}.lbWrap .stem+.ghint{font-size:calc(var(--bu)*1.35);margin:.4em 0 .2em}
`;
// The app page gets the chart styles at boot; the standalone Race/Lab export includes CHART_CSS through LAB_CSS.
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: CHART_CSS }));
