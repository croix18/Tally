// CON-01: two students with one name. The student page's quarter book, Show student and the conference form find the
// student's gradebook row by norm(name) (studentBooks), which strips the "(ID …0421)" mark, so the second of the pair
// gets the first one's grade. Also: findStudent's IXL fallback gives the second the first's IXL row.
const H = require('./h.js'); const fs = require('fs'); const path = require('path');
(async () => { const { b, p, errs } = await H.open();
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  // the scrubbed Q1 gradebook with a second "SUTTER, HAYDEN SKYLER" (another student's row and ID, renamed)
  const rows = H.gbRead('fixtures/focus_gradebook_scrubbed.csv'); const t = rows.findIndex(r => r[2] === 'TOLLIVER, PARKER'); rows[t][2] = 'SUTTER, HAYDEN SKYLER';
  await H.importGb(p, H.gbWrite(rows, 'twin.csv'));
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    const two = gb.students.map((n, i) => ({ n, i })).filter(x => /SUTTER/.test(x.n)); const out = [];
    for (const x of two) { const own = A.computeGrade(T.openSec(s), x.i).rounded;
      T.openProfile(K, x.n); const tile = document.querySelector('.profile .gcard.big b').innerText.replace(/\s+/g, ''); const head = document.querySelector('.qbook h3').innerText;
      document.querySelector('#pShow').click(); const show = (/(\d+)%/.exec(document.querySelector('#show').innerText.split(/YOUR GRADE NOW/i)[1] || '') || [])[1]; A.closeShow();
      T.openProfile(K, x.n); document.querySelector('#pConf').click(); const conf = (/Quarter \d: (\d+)%/.exec(document.querySelector('#modal').innerText) || [])[1]; document.querySelector('#mClose').click();
      const ixlList = A.findStudent(s, x.n).ixl; const ixlRow = T.gbRows(s)[x.i].ixl;
      out.push({ name: x.n, own, tile, head: head.replace(/\s+/g, ' '), show: +show, conf: +conf, ixlShown: ixlList, ixlOwnRow: ixlRow }); }
    return out; }, H.K);
  for (const x of o) { console.log('OBSERVED:', JSON.stringify(x)); console.log('EXPECTED:', `${x.name}: page tile, quarter heading, Show student and conference all ${x.own}%; IXL row ${x.ixlOwnRow}`);
    H.check(+x.tile.replace(/\D.*$/, '') === x.own, 'tile is the student\'s own grade');
    H.check(new RegExp('· ' + x.own + '% ', 'i').test(x.head), 'quarter heading is the student\'s own grade: ' + x.head);
    H.check(x.show === x.own, 'Show student is the student\'s own grade (' + x.show + ')');
    H.check(x.conf === x.own, 'conference form is the student\'s own grade (' + x.conf + ')');
    H.check(x.ixlShown === x.ixlOwnRow, 'IXL shown is the student\'s own IXL row (' + x.ixlShown + ' vs ' + x.ixlOwnRow + ')'); }
  H.check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
