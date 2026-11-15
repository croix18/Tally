// CON-10: Quarter 1 closed while Tally's grade differs from Focus's Grade column for some students (here an undecided
// text grade, "Late"). The kept final is Focus's column; the Q1 book on the same student page, the Grades Q1 tab and the
// Q1 class average are recomputed by Tally. One quarter, two final grades for the same student.
const H = require('./h.js');
(async () => { const { b, p, errs } = await H.open(); await H.scenarioA(p);
  const rows = H.gbRead('fixtures/focus_gradebook_scrubbed.csv'); const r = rows.findIndex(x => x[2] === 'INGRAM, SHILOH PHOENIX'); rows[r][7] = 'NHI Not Handed In';   // the cell now says NHI while the export's Grade column still has the grade Focus computed before
  await H.importGb(p, H.gbWrite(rows, 'q1-late.csv')); await H.importGb(p, 'fixtures/focus_gradebook_scrubbed_q2.csv'); await H.closeQ(p, 1);
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const a = s.qArchive[1]; const name = 'INGRAM, SHILOH PHOENIX'; const i = a.gb.students.indexOf(name);
    T.openProfile(K, name); const tiles = [...document.querySelectorAll('.profile .gcard')].map(c => c.innerText.replace(/\s+/g, ' ')); const fin = tiles.find(t => /Quarter 1 final/i.test(t));
    const head = [...document.querySelectorAll('.qbook h3')].map(h => h.innerText.replace(/\s+/g, ' ')).find(h => /Quarter 1/i.test(h));
    document.querySelector('#pConf').click(); const conf = document.querySelector('#modal').innerText.replace(/\s+/g, ' '); document.querySelector('#mClose').click();
    document.querySelector('#openGrades').click(); const q1 = document.querySelector('[data-gq="1"]'); if (q1) q1.click(); const avgCard = [...document.querySelectorAll('.grades .gcard')].map(c => c.innerText.replace(/\s+/g, ' ')).find(t => /class average/i.test(t)); const row = [...document.querySelectorAll('table.gstu tr[data-stu]')].find(tr => +tr.dataset.stu === i); const meanFinal = a.final.filter(v => v != null).reduce((x, y) => x + y, 0) / a.final.filter(v => v != null).length;
    return { gradesQ1Avg: avgCard, gradesQ1Row: row ? row.children[1].innerText.replace(/\s+/g, '') : null, meanOfKeptFinals: Math.round(meanFinal * 10) / 10, kept: a.final[i], finalTile: fin, q1Book: head, focusCol: a.gb.overall ? a.gb.overall[i] : null }; }, H.K);
  console.log('OBSERVED:', JSON.stringify(o));
  const t = +(/(\d+)%/.exec(o.finalTile || '') || [])[1], h = +(/· (\d+)% /.exec(o.q1Book || '') || [])[1];
  console.log('EXPECTED: one Quarter 1 grade for this student on one page (tile', t, 'vs book', h + ')');
  H.check(t === h, 'the Q1 final tile and the Q1 book agree');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
