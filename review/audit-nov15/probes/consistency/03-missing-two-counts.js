// CON-03: one student, two "missing" counts. An NHI in an IXL column whose skills are all at goal counts as missing on
// the Students list, the student page tile, Grades and the Overview, and does not on the weekly report, the conference
// form and the retake line (owedWork / retakeStatus). The Students list shows both in one row: "Missing 3" · "2 missing".
const H = require('./h.js');
(async () => { const { b, p, errs } = await H.open(); await H.scenarioA(p); await H.importGb(p, 'fixtures/focus_gradebook_scrubbed_q2.csv');
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const os = T.openSec(s); const rows = T.gbRows(s); const out = [];
    os.grades.students.forEach((n, i) => { const nhi = os.grades.assignments.filter(a => a.status[i] === 'missing'); const ow = A.owedWork(s, os, i, rows[i].ixl); if (ow.earned.length) out.push({ n, i, nhi: nhi.map(a => a.name), earned: ow.earned.map(a => a.name) }); });
    const x = out[0]; if (!x) return null;
    document.querySelector('#openStudents').click(); const tr = [...document.querySelectorAll('tr[data-open]')].find(t => t.dataset.name === x.n); const td = [...tr.children];
    x.list = { missing: tr.querySelector('[data-l="Missing"]').innerText.trim(), retake: td[td.length - 2].innerText.trim() };
    T.openProfile(K, x.n); x.tile = [...document.querySelectorAll('.profile .gcard')].find(c => /Missing now/i.test(c.innerText)).innerText.replace(/\s+/g, ' ');
    x.retakeTile = document.querySelector('#pRetake').innerText.replace(/\s+/g, ' ');
    const d = new DOMParser().parseFromString('<body>' + A.studentReportSection(s, x.i, rows[x.i]) + '</body>', 'text/html'); x.report = [...d.querySelectorAll('.board>div')].map(e => e.textContent.replace(/\s+/g, ' ')).find(t => /Missing/.test(t));
    document.querySelector('#pConf').click(); x.conf = (/Missing: \d+/.exec(document.querySelector('#modal').innerText) || [''])[0]; return x; }, H.K);
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: one count of missing work for this student on every surface (Students list, page tile, report, conference, retake line)');
  const n = s => +(/(\d+)/.exec(s || '0') || [0, 0])[1];
  const counts = { list: n(o.list.missing), tile: n(o.tile), listRetake: n(o.list.retake), report: n(o.report), conf: n(o.conf) };
  console.log('counts', JSON.stringify(counts));
  H.check(new Set(Object.values(counts)).size === 1, 'every surface gives the same missing count');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
