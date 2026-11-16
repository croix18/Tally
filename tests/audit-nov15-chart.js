// Audit of 15 Nov 2026, fixer CHART: the Data Lab's charts, the Board and the Race. Each block is one finding; every
// expected number is worked out here from the data the test sets, not read back from the code under test.
// Synthetic data only (the scrubbed fixture class and copies of it).
const { chromium, fs, path, exe, check, done, pick, tmp, APP } = require('./lib');
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true, timezoneId: 'America/New_York' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));

  // ---- CHT-01: whole numbers in bins of 1 get a bar per value, so the maximum is not counted in the bar below ----
  const h1 = await p.evaluate(() => { const A = window.__all; const vals = [10, 10, 10, 9, 9, 0, 4];
    const d = new DOMParser().parseFromString(A.chartHist(vals, 10, 0, {}), 'image/svg+xml');
    return { bars: [...d.querySelectorAll('rect.bar title')].map(t => t.textContent), top: A.histTop('hist', vals, 10, 0, false) }; });
  check(h1.bars.length === 11 && h1.bars.includes('10: 3 students') && h1.bars.includes('9: 2 students'), 'CHT-01: a histogram of 0 to 10 in bins of 1 has a bar for 10 (3 students) and one for 9 (2 students)');
  check(h1.top === 3, 'CHT-01: histTop finds the same tallest bar the histogram draws (3)');

  // ---- CHT-12: a bar graph with a maximum of 26 is drawn to the scale histTop gives every row ----
  const h12 = await p.evaluate(() => { const A = window.__all; const vals = [2, 3, 3, 20];
    const d = new DOMParser().parseFromString(A.chartFreq(vals, 26, {}), 'image/svg+xml');
    const drawn = Math.max(...[...d.querySelectorAll('rect.bar title')].map(t => +/: (\d+) student/.exec(t.textContent)[1]));
    return { drawn, top: A.histTop('bar', vals, 26, 0, false), top25: A.histTop('bar', vals, 25, 0, false), bars25: new DOMParser().parseFromString(A.chartFreq(vals, 25, {}), 'image/svg+xml').querySelectorAll('rect.bar').length }; });
  check(h12.drawn === h12.top && h12.top === 3, `CHT-12: at a maximum of 26 the bar graph's tallest bar and histTop agree (drawn ${h12.drawn}, histTop ${h12.top})`);
  check(h12.bars25 === 26 && h12.top25 === 2, 'CHT-12: at a maximum of 25 it is still a bar per value, 0 to 25');

  // ---- one class from the scrubbed fixtures (accelerated, 16 counted students), for the checks that draw the Board ----
  const K = '1205050-7T1A';
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);

  // ---- CHT-03: in the % view a score over 100% widens the axis; without one the axis stays 0 to 100 ----
  const h3 = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const a = s.grades.assignments.find(a => a.max > 0 && a.values.filter(v => v != null).length >= 5);
    T.state.settings.labPct = true; T.state.settings.labBin = 0; const id = 'gb:' + a.name;
    const axis = () => { const d = new DOMParser().parseFromString(A.labMarkup('acc', id, 0, false, false, false, 'box'), 'text/html'); const svg = d.querySelector('.labRow svg.labSvg'); const t = [...svg.querySelectorAll('text.labTickTxt')];
      return { end: t[t.length - 1].textContent, endX: +t[t.length - 1].getAttribute('x'), whisk: Math.max(...[...svg.querySelectorAll('line.labWhisk')].map(l => +l.getAttribute('x2'))) }; };
    const plain = axis(); const keep = a.values.slice(); const j = a.values.findIndex(v => v != null); a.values[j] = a.max * 1.1;   // 110%
    const over = axis(); const hist = [...new DOMParser().parseFromString(A.labMarkup('acc', id, 0, false, false, false, 'hist'), 'text/html').querySelectorAll('.labRow rect.bar title')].map(t => t.textContent);
    a.values = keep; T.state.settings.labPct = false; return { plain, over, last: hist[hist.length - 1] }; }, K);
  check(h3.plain.end === '100', `CHT-03: with no score over the maximum the % axis ends at 100 (${h3.plain.end})`);
  check(h3.over.end === '110' && h3.over.whisk <= h3.over.endX + 0.5, `CHT-03: a 110% score puts the axis end at 110 and the whisker on it (${h3.over.end})`);
  check(/^10\d–110: 1 student$/.test(h3.last), `CHT-03: the histogram's 110% is in a top bar above 100, not counted in "95-100" (${h3.last})`);

  // ---- CHT-06: "Our own data" with decimals or negatives ----
  const h6 = await p.evaluate(K => { const T = window.__tally, A = window.__all; const P = h => new DOMParser().parseFromString(h, 'text/html');
    T.state.custom.push({ id: 'tdec', prep: 'acc', label: 'Minutes to school', unit: 'minutes', values: { [K]: [1.2, 1.5, 2.4, 2.8, 3.1, 3.3, 4.7, 0.8] } });
    T.state.custom.push({ id: 'tneg', prep: 'acc', label: 'Change in score', unit: 'points', values: { [K]: [-4, -1, 0, 2, 3, 5, 6, 8] } });
    T.state.custom.push({ id: 'tint', prep: 'acc', label: 'Pets', unit: 'pets', values: { [K]: [3, 5, 8, 10, 12, 21, 7, 4] } });
    T.state.settings.labPct = false;
    const stemOf = id => { const d = P(A.labMarkup('acc', id, 0, false, false, false, 'stem')); return { rows: [...d.querySelectorAll('table.stem tr')].map(r => r.querySelector('th').textContent + ' | ' + r.querySelector('td').textContent), key: (d.querySelector('.ghint') || {}).textContent || '', note: (d.querySelector('.labRow .labNotYet') || {}).textContent || '' }; };
    const dots = P(A.labMarkup('acc', 'custom:tneg', 0, false, false, false, 'dots')).querySelector('.labRow svg');
    const tl = [...dots.querySelectorAll('text.tl')]; const x0 = Math.min(...tl.map(t => +t.getAttribute('x')));
    const left = [...dots.querySelectorAll('circle.dot')].filter(c => +c.getAttribute('cx') < x0 - 0.5).length;
    const pie = [...P(A.labMarkup('acc', 'custom:tneg', 0, false, false, false, 'circle')).querySelectorAll('.labPieKey b')].reduce((a, x) => a + +x.textContent, 0);
    const out = { dec: stemOf('custom:tdec'), neg: stemOf('custom:tneg'), int: stemOf('custom:tint'), axis0: tl.map(t => +t.textContent)[0], left, pie };
    T.state.custom = T.state.custom.filter(c => !/^t(dec|neg|int)$/.test(c.id)); return out; }, K);
  check(h6.dec.rows.join(' / ') === '0 | 8 / 1 | 2 5 / 2 | 4 8 / 3 | 1 3 / 4 | 7' && h6.dec.key === 'Key: 0 | 8 means 0.8', `CHT-06: decimals: ones as stems, tenths as leaves, and a key from the data (${h6.dec.rows.join(' / ')} · ${h6.dec.key})`);
  check(!h6.neg.rows.length && /values below 0/.test(h6.neg.note), `CHT-06: a stem-and-leaf of negative values says it cannot draw them (${h6.neg.note})`);
  check(h6.int.rows.join(' / ') === '0 | 3 4 5 7 8 / 1 | 0 2 / 2 | 1' && h6.int.key === 'Key: 1 | 3 means 13', 'CHT-06: whole numbers keep tens as stems and the key "1 | 3 means 13"');
  check(h6.axis0 <= -4 && h6.left === 0, `CHT-06: the dot plot's axis starts at or below the smallest value (${h6.axis0}) and no dot is left of it`);
  check(h6.pie === 8, `CHT-06: the circle graph counts all 8 values, the negatives too (${h6.pie})`);

  // ---- CHT-15 (the parts made): the dot plot labels its maximum; line-graph ticks are whole numbers ----
  const h15 = await p.evaluate(() => { const A = window.__all; const P = x => new DOMParser().parseFromString(x, 'image/svg+xml');
    const dots = [...P(A.chartDots([12, 15, 18, 21, 21, 20, 19], 21, {})).querySelectorAll('text.tl')].map(t => t.textContent);
    const line = [...P(A.chartLines(['Sep 5', 'Sep 12'], [{ name: 'A', values: [12, 26] }], {})).querySelectorAll('text.tl')].filter(t => t.getAttribute('text-anchor') === 'end').map(t => t.textContent);
    const pct = [...P(A.chartLines(['Sep 5', 'Sep 12'], [{ name: 'A', values: [40, 60] }], { pct: true, min: 0, max: 100 })).querySelectorAll('text.tl')].filter(t => t.getAttribute('text-anchor') === 'end').map(t => t.textContent);
    return { dots, line, pct }; });
  check(h15.dots[h15.dots.length - 1] === '21' && h15.dots.includes('20'), `CHT-15: a dot plot with a maximum of 21 has a tick at 21 (${h15.dots.join(' ')})`);
  check(h15.line.join(' ') === '0 10 20 30', `CHT-15: a line graph's ticks from 0 to 30 are whole numbers (${h15.line.join(' ')})`);
  check(h15.pct.join(' ') === '0% 25% 50% 75% 100%', 'CHT-15: the percent line graph keeps 0, 25, 50, 75, 100');

  // ---- three accelerated classes: copies of the fixture class with shifted scores ----
  await p.evaluate(K => { const T = window.__tally; const base = T.state.sections[K]; base.period = 1; base.label = '1st Period · Accelerated'; base.team = '1st Period';
    for (let per = 2; per <= 3; per++) { const s = JSON.parse(JSON.stringify(base)); s.key = 'p' + per + '-acc'; s.period = per; s.label = per + (per === 2 ? 'nd' : 'rd') + ' Period · Accelerated'; s.team = s.label.replace(/ · .*/, '');
      s.scores = s.scores.map(row => Array.isArray(row) ? row.map((v, i) => v == null ? null : Math.max(0, Math.min(100, v + 9 * (((i + per) % 3) - 1)))) : row);
      T.state.sections[s.key] = s; T.state.order.push(s.key); } T.save(); }, K);

  // ---- CHT-13: the Board's "as of" gives both ends when one class is an export behind ----
  const h13 = await p.evaluate(() => { const T = window.__tally, A = window.__all; const keep = T.state.order.map(k => T.state.sections[k].date);
    T.state.order.forEach(k => { T.state.sections[k].date = k === 'p2-acc' ? '2026-10-30' : '2026-11-13'; });
    const P = h => (new DOMParser().parseFromString(h, 'text/html').querySelector('.lbSub') || {}).textContent || '';
    const out = { race: P(A.lbMarkup(A.leaderboardData(), 'acc')), lab: P(A.labMarkup('acc', 'unit:__all__', 0, false, false, false, 'box')), line: P(A.labMarkup('acc', 'unit:__all__', 0, false, false, false, 'avg')) };
    T.state.order.forEach(k => { T.state.sections[k].date = '2026-11-13'; }); out.same = P(A.labMarkup('acc', 'unit:__all__', 0, false, false, false, 'box'));
    T.state.order.forEach((k, i) => { T.state.sections[k].date = keep[i]; }); return out; });
  check(/as of Oct 30 to Nov 13$/.test(h13.race) && /as of Oct 30 to Nov 13$/.test(h13.lab) && /as of Oct 30 to Nov 13$/.test(h13.line), `CHT-13: with one class's export from Oct 30 and two from Nov 13, the Race and the Data Lab say "as of Oct 30 to Nov 13" (${h13.race} | ${h13.lab})`);
  check(/as of Nov 13$/.test(h13.same), 'CHT-13: when every class is from the same day, one date');

  // ---- CHT-09: a class that has imports but joined after the league's baseline says so ----
  const h9 = await p.evaluate(K => { const T = window.__tally, A = window.__all; const keys = [K, 'p2-acc', 'p3-acc']; const keep = keys.map(k => T.state.sections[k].history);
    const mk = (s, dates) => { const ks = A.ixlList(s).map(x => x.key); const units = T.unitsOf(s); const u = units.find(u => u.assigned);
      s.history = dates.map((date, di) => { const per = {}, pu = {}, ua = {}; units.forEach(v => { ua[v.name] = v.active.length; pu[v.name] = {}; });
        ks.forEach((k, i) => { const n = Math.min(u.active.length, 1 + di * 2 + (i % 2)); pu[u.name][k] = n; per[k] = n; }); return { date, thr: s.threshold, students: ks.length, per, pu, ua }; }); };
    const [a, b2, c] = keys.map(k => T.state.sections[k]);
    mk(a, ['2026-10-12', '2026-11-13']); mk(b2, ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-13']); mk(c, ['2026-11-13']);
    const L = A.leaderboardData().filter(r => r.prep === 'acc'); const d = new DOMParser().parseFromString(A.lbMarkup(L, 'acc'), 'text/html');
    const line = n => [...d.querySelectorAll('.lbCard')].find(cd => cd.querySelector('.lbName').textContent.trim().startsWith(n)).querySelector('.lbLine').textContent.trim();
    const out = { two: line('2nd Period'), three: line('3rd Period'), one: line('1st Period'), r2: L.find(r => r.key === 'p2-acc') };
    keys.forEach((k, i) => { T.state.sections[k].history = keep[i]; }); return { ...out, r2: { active: out.r2.active, gain: out.r2.gain } }; }, K);
  check(h9.two === 'joined the race after Oct 12', `CHT-09: a class first imported Oct 26, after the Oct 12 baseline, reads "joined the race after Oct 12" (${h9.two})`);
  check(h9.three === 'first week in the race', `CHT-09: a class with one import still reads "first week in the race" (${h9.three})`);
  check(h9.r2.active == null && h9.r2.gain == null && /since Oct 12$/.test(h9.one), 'CHT-09: the ranking rule is unchanged: the late class is not measured, the others are measured since the baseline');

  // ---- CHT-14 and HLT-03: quartiles shown exactly; tenths rounded half up ----
  const h14 = await p.evaluate(K => { const T = window.__tally, A = window.__all; const P = h => new DOMParser().parseFromString(h, 'text/html');
    const cellsOf = d => Object.fromEntries([...d.querySelectorAll('.labRow .labStats div')].map(c => [c.querySelector('span').textContent, c.querySelector('b').textContent]));
    T.state.custom.push({ id: 'tq', prep: 'acc', label: 'Tenths', unit: 'value', values: { [K]: [1.5, 2, 2.5, 3, 4, 4.5, 5, 6] } });
    T.state.custom.push({ id: 'th', prep: 'acc', label: 'Half', unit: 'value', values: { [K]: [...Array(19).fill(60), 61] } });   // 1201 / 20 = 60.05
    T.state.settings.labPct = false; T.state.settings.labAvg = true;
    const q = P(A.labMarkup('acc', 'custom:tq', 2, false, false, true, 'box')); const qc = cellsOf(q);
    const halves = [...q.querySelectorAll('.labRow .labHalf small')].map(x => x.textContent);
    const hd = P(A.labMarkup('acc', 'custom:th', 2, false, false, false, 'box')); const hc = cellsOf(hd);
    const avgSide = (hd.querySelector('.labRow .labAvg b') || {}).textContent; const meanTip = (hd.querySelector('.labRow .labMean title') || {}).textContent;
    const bars = P(A.labMarkup('acc', 'custom:th', 0, false, false, false, 'avg')).body.textContent;
    T.state.custom = T.state.custom.filter(c => !/^t[qh]$/.test(c.id)); T.state.settings.labAvg = false;
    return { qc, halves, hc, avgSide, meanTip, bars60: /60\.1/.test(bars) && !/60\.0/.test(bars), neg: [-0.05, -0.04, 0.15, 2.45, 72.35, 88.05].map(A.fmt1 || (x => x.toFixed(1))) }; }, K);
  check(h14.qc.Q1 === '2.25' && h14.qc.Q3 === '4.75' && h14.qc.median === '3.5' && h14.qc.IQR === '2.5', `CHT-14: Q1 2.25 and Q3 4.75 are shown exactly (${h14.qc.Q1}, ${h14.qc.Q3}, median ${h14.qc.median}, IQR ${h14.qc.IQR})`);
  check(h14.halves[0] === 'lower half · median = Q1 = 2.25' && h14.halves[2] === 'upper half · median = Q3 = 4.75', `CHT-14: the halves under the chips name Q1 and Q3 exactly (${h14.halves.join(' / ')})`);
  check(h14.hc.mean === '60.1' && h14.avgSide === '60.1' && h14.meanTip === 'Mean 60.1' && h14.bars60, `HLT-03: a mean of 1201/20 = 60.05 reads 60.1 in the stats table, beside the name, on the mean mark and on the class-average bar (${h14.hc.mean}, ${h14.avgSide}, ${h14.meanTip})`);
  check(h14.neg.join(' ') === '-0.1 0.0 0.2 2.5 72.4 88.1', `HLT-03: halves round up and -0.04 is 0.0, not -0.0 (${h14.neg.join(' ')})`);

  // ---- cleanup: in the % view the box plot's mean tooltip and the halves under the chips carry "%" ----
  const hp = await p.evaluate(K => { const T = window.__tally, A = window.__all; T.state.settings.labPct = true;
    const u = T.unitsOf(T.state.sections[K]).find(u => u.assigned && u.total) || T.unitsOf(T.state.sections[K]).find(u => u.total);
    const d = new DOMParser().parseFromString(A.labMarkup('acc', 'unit:' + u.name, 2, false, false, true, 'box'), 'text/html');
    const out = { tip: (d.querySelector('.labRow .labMean title') || {}).textContent || '', halves: [...d.querySelectorAll('.labRow .labHalf small')].map(x => x.textContent).filter(t => /= Q[13]/.test(t)), gap: (d.querySelector('.labRow .labHalf.mid .gap') || {}).textContent };
    T.state.settings.labPct = false; return out; }, K);
  check(/^Mean [\d.]+%$/.test(hp.tip) && hp.halves.length >= 2 && hp.halves.every(t => /%$/.test(t)) && (hp.gap == null || /%$/.test(hp.gap)), `cleanup: in the % view the mean tooltip and the Q1 and Q3 labels carry "%" (${hp.tip} · ${hp.halves.join(' / ')})`);

  // ---- CHT-02 (Croix's call): when a circle graph's rounded percents do not add to 100, one line under its key says so ----
  const h2 = await p.evaluate(K => { const T = window.__tally, A = window.__all; const keys = [K, 'p2-acc', 'p3-acc']; const s0 = T.state.sections[K]; const ub = T.state.settings.useBest; T.state.settings.useBest = false;
    const u = T.unitsOf(s0).find(u => u.active.length); const sk = A.skillKey(s0.skills[u.active[0]]); const keep = {};
    const set = (a, b) => keys.forEach(kk => { const s = T.state.sections[kk]; const k = s.skills.findIndex(x => A.skillKey(x) === sk); keep[kk] = keep[kk] || s.scores[k].slice(); T.population(s).forEach((x, j) => { s.scores[k][x.i] = j < a ? 90 : j < b ? 40 : null; }); });
    const note = () => { const d = new DOMParser().parseFromString(A.labMarkup('acc', 'skill:' + sk, 0, false, false, false, 'circle'), 'text/html'); return { n: d.querySelectorAll('.labRoundNote').length, text: (d.querySelector('.labRoundNote') || {}).textContent || '', pies: d.querySelectorAll('.labPie svg').length }; };
    set(4, 8); const even = note(); set(3, 6); const off = note();   // 4 / 4 / 8 of 16 is 25 + 25 + 50; 3 / 3 / 10 is 19 + 19 + 63 = 101
    keys.forEach(kk => { const s = T.state.sections[kk]; const k = s.skills.findIndex(x => A.skillKey(x) === sk); s.scores[k] = keep[kk]; }); T.state.settings.useBest = ub;
    const prim = [A.chartCircle([{ label: 'a', value: 3 }, { label: 'b', value: 3 }, { label: 'c', value: 10 }]), A.chartCircle([{ label: 'a', value: 4 }, { label: 'b', value: 4 }, { label: 'c', value: 8 }])].map(h => /may not add to exactly 100%/.test(h));
    return { even, off, prim }; }, K);
  check(h2.off.pies >= 1 && h2.off.n === 1 && h2.off.text === 'Percents are rounded, so they may not add to exactly 100%.', `CHT-02: pies of 3, 3 and 10 (19% + 19% + 63%) get one line under the key (${h2.off.n}: ${h2.off.text})`);
  check(h2.even.pies >= 1 && h2.even.n === 0, 'CHT-02: pies of 4, 4 and 8 (25% + 25% + 50%) get no such line');
  check(h2.prim[0] && !h2.prim[1], 'CHT-02: the single circle graph (chartCircle) carries the same line only when its percents do not add to 100');

  // ---- HLT-06 (my part): a chart's grade color rounds a percent the way the course grade does ----
  const h06 = await p.evaluate(() => { const A = window.__all; return [A.gradeFill(89.4999999999999), A.gradeFill(89.4), A.gradeFill(A.roundPct(89.4999999999999))]; });
  check(h06[0] === h06[2] && h06[0] !== h06[1], 'HLT-06: gradeFill of 89.4999999999999 is the color of a 90, as roundPct rounds it, not of an 89');

  // ---- cleanup: the Board download: its file name uses the local day, and in Both mode it reads the screen's Dots key ----
  const save = async (fn) => p.evaluate(async fn => { const T = window.__tally, A = window.__all; const got = []; const click = HTMLAnchorElement.prototype.click;
    const blobs = new Map(); const mk = URL.createObjectURL; URL.createObjectURL = o => { const u = mk.call(URL, o); blobs.set(u, o); return u; };
    HTMLAnchorElement.prototype.click = function () { got.push({ name: this.download, href: this.href }); };
    try { new Function('T', 'A', fn)(T, A); A.downloadLeaderboard(T.state.settings.lbTab === 'lab' ? 'lab' : 'race'); } finally { HTMLAnchorElement.prototype.click = click; URL.createObjectURL = mk; }
    const g = got[got.length - 1]; return { name: g.name, html: await blobs.get(g.href).text() }; }, fn);
  const RealDate = await p.evaluate(() => { window.__RealDate = Date; return true; });
  const late = await p.evaluate(() => { const R = window.__RealDate; const fixed = new R('2026-11-15T23:30:00-05:00').getTime();   // 11:30 pm in Florida is already Nov 16 in UTC
    class D extends R { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } } window.Date = D;
    const T = window.__tally; window.__keepDates = T.state.order.map(k => T.state.sections[k].date); T.state.order.forEach(k => { T.state.sections[k].date = null; }); return true; });
  const f1 = await save("T.state.settings.lbTab = 'race';");
  await p.evaluate(() => { window.Date = window.__RealDate; const T = window.__tally; T.state.order.forEach((k, i) => { T.state.sections[k].date = window.__keepDates[i]; }); });
  check(RealDate && late && f1.name === 'IXL-Race-2026-11-15.html', `cleanup: with no export dates, a Race page saved at 11:30 pm on Nov 15 is named for Nov 15, the local day (${f1.name})`);
  await p.evaluate(K => { const T = window.__tally; const s = JSON.parse(JSON.stringify(T.state.sections[K])); s.key = 'p4-on'; s.period = 4; s.prep = 'on'; s.threshold = 60; s.label = '4th Period · On-level'; s.team = '4th Period';
    T.state.sections[s.key] = s; T.state.order.push(s.key); T.save(); }, K);
  const dotsSaved = async on => save(`const st = T.state.settings; st.lbTab = 'lab'; st.labPrep = 'both'; st.labRows = 'class'; st.labKind = 'box'; st.labPct = false;
    const id = A.labDatasets('acc').list.find(d => /^unit:(?!__)/.test(d.id)).id; st.labPick = { acc: id, on: id }; st.labUnit = id; st.labDots = st.labDots || {};
    st.labDots['both|' + A.labPickFor('acc') + '|' + A.labPickFor('on')] = ${on}; st.labDots[id] = ${!on};`);
  const dOff = await dotsSaved(false), dOn = await dotsSaved(true);
  const nDots = h => (h.match(/class="labDot"/g) || []).length;
  check(nDots(dOff.html) === 0 && nDots(dOn.html) > 0, `cleanup: in Both mode the saved Data Lab page shows dots exactly when the screen's Dots button is on (off: ${nDots(dOff.html)}, on: ${nDots(dOn.html)})`);

  // ---- round 2 (counter-review of the merged fixes) ----
  const r2 = await p.evaluate(K => { const T = window.__tally, A = window.__all; const P = h => new DOMParser().parseFromString(h, 'text/html'); const k2 = 'p2-acc';
    const xs = h => [...new DOMParser().parseFromString(h, 'image/svg+xml').querySelectorAll('rect.bar')].map(r => r.getAttribute('x')).join();
    T.state.settings.labPct = false; T.state.settings.labBin = 0; T.state.settings.labAvg = false;
    T.state.custom.push({ id: 'rmix', prep: 'acc', label: 'Books', unit: 'books', values: { [K]: [0, 2, 3, 5, 6, 7, 8, 10], [k2]: [1, 2, 3.5, 4, 6, 7, 9, 10] } });
    T.state.custom.push({ id: 'rdec', prep: 'acc', label: 'Minutes', unit: 'minutes', values: { [K]: [1.2, 1.5, 2.4, 2.8, 3.1, 3.3, 4.7, 0.8], [k2]: [1, 2, 2, 3, 3, 4, 4, 4] } });
    const rows = h => [...P(h).querySelectorAll('.labRow')].filter(r => r.querySelector('svg'));
    const histX = rows(A.labMarkup('acc', 'custom:rmix', 0, false, false, false, 'hist')).map(r => [...r.querySelectorAll('rect.bar')].map(x => x.getAttribute('x')).join());
    const bar = rows(A.labMarkup('acc', 'custom:rdec', 0, false, false, false, 'bar')).map(r => [...r.querySelectorAll('rect.bar title')].map(t => t.textContent));
    const pies = [...P(A.labMarkup('acc', 'custom:rdec', 0, false, false, false, 'circle')).querySelectorAll('.labPie')].map(c => [...c.querySelectorAll('.labPieKey span')].map(x => x.getAttribute('title')));
    T.state.custom = T.state.custom.filter(c => !/^r(mix|dec)$/.test(c.id));
    const ticks = span => [...new DOMParser().parseFromString(A.chartLines(['a', 'b'], [{ name: 'M', values: [0, span - 3] }], { min: 0 }), 'image/svg+xml').querySelectorAll('text.tl')].map(t => t.textContent).filter(t => /^[\d.]+$/.test(t));
    const s0 = T.state.sections[K]; const a = s0.grades.assignments.find(a => a.max > 0 && a.values.filter(v => v != null).length >= 5); const keep = { max: a.max, values: a.values.slice() };
    a.max = 40; const j = a.values.findIndex(v => v != null); a.values[j] = 23; T.state.settings.labPct = true;
    const pct = A.labSeries('acc', 'gb:' + a.name).find(x => x.sec.key === K).values[j]; a.max = keep.max; a.values = keep.values; T.state.settings.labPct = false;
    return { direct: xs(A.chartHist([0, 3, 5, 7, 9, 10], 10, 1, {})) === xs(A.chartHist([0, 3, 5, 7.5, 9, 10], 10, 1, {})), histX, bar, pies, t: [70, 90, 110].map(ticks), pct }; }, K);
  check(r2.direct && r2.histX.length === 2 && r2.histX[0] === r2.histX[1], 'round 2, CHT-01: a row of whole numbers and a row with a half, in bins of 1, draw their bars at the same x positions');
  const cnt = r => r.reduce((a, t) => a + +/: (\d+) student/.exec(t)[1], 0);
  const inR = (lab, x, last) => { const m = /^([\d.]+)(?:–([\d.]+))?:/.exec(lab); return m[2] == null ? x === +m[1] : x >= +m[1] && (last ? x <= +m[2] : x < +m[2]); };
  const decVals = [1.2, 1.5, 2.4, 2.8, 3.1, 3.3, 4.7, 0.8];
  check(r2.bar.length === 2 && cnt(r2.bar[0]) === 8 && r2.bar[0].every((t, i, all) => decVals.filter(x => inR(t, x, i === all.length - 1)).length === +/: (\d+) student/.exec(t)[1]), `round 2, CHT-06: a bar graph of 8 decimal values counts all 8, each under a range that holds it (${r2.bar[0] && r2.bar[0].filter(t => !/: 0 /.test(t)).join(' | ')})`);
  check(r2.pies.length === 2 && JSON.stringify(r2.pies[0].map(t => t.replace(/: \d+$/, ''))) === JSON.stringify(r2.pies[1].map(t => t.replace(/: \d+$/, ''))) && r2.pies[0][1] === 'A quarter to half (1.175 to under 2.35 of 4.7): 2', `round 2, CHT-06: two classes' pies of decimals are quarters of one total, labelled by their real edges (${r2.pies[0].join(' | ')})`);
  check(r2.t.every(t => t.every(x => Number.isInteger(+x))), `round 2, CHT-15: line-graph ticks are whole numbers for spans of 70, 90 and 110 (${r2.t.map(t => t.join(',')).join(' / ')})`);
  check(r2.pct === 58, `round 2: in the % view 23 of 40 is 58%, as the grade engine rounds it (${r2.pct})`);

  check(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
