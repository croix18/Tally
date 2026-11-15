// CHT-03: in percent mode the Data Lab's axis is fixed at 0–100%, so an extra-credit score (over the maximum) is drawn
// past the end of the axis on a box plot and counted in the "90–100" bar of a histogram. In points mode the same data
// widens the axis (labMarkup: `series.some(x => x.st.max > x.max)`), so only the % toggle is wrong.
// Synthetic: one student in the fixture class gets 23 of 21 on the Unit 1 Assessment.
const { open, path } = require('./_setup');
const { check, done } = require(path.join(process.env.TALLY_REPO || path.resolve(__dirname, '../repo'), 'tests/lib.js'));
(async () => {
  const { b, p, errs, K } = await open();
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    const a = s.grades.assignments.find(a => a.name === 'Unit 1 Assessment'); const j = a.values.findIndex(v => v != null); a.values[j] = 23;   // 110% (23/21 = 109.5)
    T.state.settings.labPct = true; T.state.settings.labBin = 0;
    const P = h => new DOMParser().parseFromString(h, 'text/html');
    const box = P(A.labMarkup('acc', 'gb:Unit 1 Assessment', 1, false, false, false, 'box'));
    const svg = box.querySelector('.labRow svg.labSvg'); const ticks = [...svg.querySelectorAll('text.labTickTxt')]; const axisEnd = +ticks[ticks.length - 1].getAttribute('x');
    const wh = [...svg.querySelectorAll('line.labWhisk')]; const whiskEnd = Math.max(...wh.map(l => +l.getAttribute('x2')));
    const statMax = [...box.querySelectorAll('.labStats div')].find(d => d.querySelector('span').textContent === 'max').querySelector('b').textContent;
    const hist = P(A.labMarkup('acc', 'gb:Unit 1 Assessment', 0, false, false, false, 'hist'));
    const titles = [...hist.querySelectorAll('.labRow rect.bar title')].map(t => t.textContent); const top = titles.pop();
    const vals = A.labSeries('acc', 'gb:Unit 1 Assessment')[0].values.filter(v => v != null); const m = /^(\d+)–(\d+): (\d+)/.exec(top); const in90 = vals.filter(v => v >= +m[1] && v <= +m[2]).length; const shown = +m[3];
    return { shown, axisEndLabel: ticks[ticks.length - 1].textContent, axisEnd, whiskEnd, statMax, top, in90, over: vals.filter(v => v > 100) }; }, K);
  console.log('OBSERVED: box plot axis ends at', out.axisEndLabel + '% (x=' + out.axisEnd.toFixed(1) + '), the max whisker is drawn at x=' + out.whiskEnd.toFixed(1), '(stats: max', out.statMax + '); histogram top bar "' + out.top + '" though only', out.in90, 'scores are in that range (and', out.over.join(','), 'is over 100)');
  console.log('EXPECTED: the axis reaches the largest value (as points mode and IXL and a test already do), and no bar labelled 90–100 counts a 110');
  check(out.whiskEnd <= out.axisEnd + 0.5, 'the box plot stays on its axis');
  check(out.shown === out.in90, 'the top bar counts only the scores inside the range it states');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
