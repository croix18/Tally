// Counter-review: a Board save reopened on a clean Tally draws the same charts (whole markup), Race included,
// with classes on different export days, a joined-late class, and a class under 5 students.
const path = require('path'); const fs = require('fs');
const { open } = require(path.join(process.env.TALLY_REPO, 'review/audit-nov15/probes/charts/_setup.js'));
const { check, done, APP } = require(path.join(process.env.TALLY_REPO, 'tests/lib.js'));
(async () => {
  const { b, p, errs } = await open({ classes: 3 });
  await p.evaluate(() => { const T = window.__tally; const [k1, k2, k3] = T.state.order;
    T.state.sections[k2].date = '2026-10-30';
    T.state.custom.push({ id: 'own', prep: 'acc', label: 'Minutes', unit: 'minutes', values: { [k1]: [1.2, 1.5, 2.4, 2.8, 3.1, 3.3, 4.7, 0.8], [k2]: [1, 2, 3], [k3]: [0, 2, 3.5, 4, 6, 7, 9, 10] } });
    T.save(); });
  const kinds = ['box', 'dots', 'hist', 'stem', 'bar', 'circle', 'line', 'avg'];
  const render = pg => pg.evaluate(kinds => { const A = window.__all, st = window.__tally.state.settings; const o = {};
    A.labDatasets('acc').list.filter(d => !/^skill:/.test(d.id)).forEach(d => kinds.forEach(k => ['class', 'pool'].forEach(c => [false, true].forEach(pc => { st.labCmp = { acc: c }; st.labPct = pc; o[d.id + ' ' + k + ' ' + c + ' ' + pc] = A.labMarkup('acc', d.id, 2, true, true, true, k); }))));
    st.labPct = false; o.race = A.lbMarkup(A.leaderboardData(), 'acc'); return o; }, kinds);
  const before = await render(p);
  const cfg = await p.evaluate(() => window.__all.boardFile());
  const file = path.join(require('os').tmpdir(), 'rev-board-' + process.pid + '.json'); fs.writeFileSync(file, JSON.stringify(cfg));
  const q = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, timezoneId: 'America/New_York' })).newPage(); const errs2 = []; q.on('pageerror', e => errs2.push(e.message)); q.on('dialog', d => d.accept());
  await q.goto('file://' + path.resolve(APP)); await q.setInputFiles('#file', [file]); await q.waitForTimeout(1200);
  const after = await render(q);
  const norm = h => (h || '').replace(/\s+/g, ' ');
  const diff = Object.keys(before).filter(k => norm(before[k]) !== norm(after[k]));
  const firstDiff = k => { const a = norm(before[k]), c = norm(after[k]); let i = 0; while (i < a.length && a[i] === c[i]) i++; return k + ' @' + i + ': ' + a.slice(Math.max(0, i - 60), i + 80) + ' ||| ' + c.slice(Math.max(0, i - 60), i + 80); };
  // a class of 3 must never be drawn: its values 1,2,3 as dots/bars would point at students
  const thin = Object.keys(after).filter(k => k.startsWith('custom:own') && /2nd Period/.test(after[k])).map(k => [k, /2nd Period[^]*?(Not enough students|labNotYet)/.test(after[k])]);
  const asof = (/<p class="lbSub">(.*?)<\/p>/.exec(after['unit:__all__ box class false']) || [])[1];
  console.log(JSON.stringify({ n: Object.keys(before).length, diff: diff.length, ex: diff.slice(0, 3).map(firstDiff), asof, raceSub: (/<p class="lbSub">(.*?)<\/p>/.exec(after.race) || [])[1], thinBad: thin.filter(t => !t[1]).map(t => t[0]).slice(0,6), thinSample: (after["custom:own dots class false"]||"").replace(/<svg[^]*?<\/svg>/g,"[svg]").slice(0,1500) }, null, 1));
  check(diff.length === 0, 'every chart the Board draws from the save is the same markup as in Tally');
  check(/Oct 30 to /.test(asof || ''), 'the Board save keeps both ends of "as of"');
  check(!errs.length && !errs2.length, 'no page errors ' + errs.concat(errs2).join('|').slice(0, 300));
  fs.unlinkSync(file); await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
