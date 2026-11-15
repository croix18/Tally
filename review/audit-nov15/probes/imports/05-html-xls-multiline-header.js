// IMP-05: the html-table ".xls" reader collapses every cell's line breaks (td.textContent.replace(/\s+/g, ' ')), so a
// Focus header cell "Title / N Points / Assigned … / Due …" (the shape of every column in the real Focus export) reaches
// parseGradebook as one line: the assignment name keeps "Assigned 09/01 Due" and the due date is lost. The same
// gradebook as .csv reads correctly. Built from the repo's scrubbed Focus fixture, re-written as an HTML table.
const H = require('./h.js'); const { fs, path } = H;
const P = require(path.join(H.REPO, 'parser.js'));
const csv = fs.readFileSync(path.join(H.REPO, 'fixtures/focus_gradebook_scrubbed_q2.csv'), 'utf8');
const rows = P.csvToRows(csv);
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const html = '<html><head><meta charset="utf-8"></head><body><table>' + rows.map(r => '<tr>' + r.map(v => `<td>${esc(v)}</td>`).join('') + '</tr>').join('\n') + '</table></body></html>';
(async () => {
  const { b, p, errs } = await H.open();
  const out = await p.evaluate(async ({ csv, html }) => { const A = window.__all;
    const read = async (t, n) => { const gb = A.parseGradebook(await A.fileToRows(new File([t], n))); return { n: gb.assignments.length, names: gb.assignments.map(a => a.name), due: gb.assignments.map(a => a.due), max: gb.assignments.map(a => a.max), q: A.gbQuarter(gb) }; };
    return { csv: await read(csv, 'gb.csv'), xls: await read(html, 'gb.xls') }; }, { csv, html });
  const diffNames = out.csv.names.map((n, i) => n === out.xls.names[i] ? null : `${n} | ${out.xls.names[i]}`).filter(Boolean);
  const obs = `csv: ${out.csv.n} assignments, due ${out.csv.due.slice(0, 3).join(',')}…, quarter ${out.csv.q} · html .xls: ${out.xls.n} assignments, due ${JSON.stringify(out.xls.due.slice(0, 3))}…, quarter ${out.xls.q}; names that differ (csv | xls): ${diffNames.slice(0, 3).join(' ; ')} (${diffNames.length} of ${out.csv.n})`;
  H.report(obs, 'the same gradebook gives the same assignment names, points, due dates and quarter from .csv and from the html-table .xls',
    !diffNames.length && JSON.stringify(out.csv.due) === JSON.stringify(out.xls.due) && JSON.stringify(out.csv.max) === JSON.stringify(out.xls.max));
  H.check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); H.done();
})().catch(e => { console.error(e); process.exit(2); });
