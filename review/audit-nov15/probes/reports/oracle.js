// RPT oracle: every printed weekly report's figures vs an independent recount, on the fixture class and N randomized variants.
// usage: node probes/oracle.js [trials] [seed] [q2]
const H = require('./h.js');
const TRIALS = Number(process.argv[2] || 40), SEED = Number(process.argv[3] || 1), Q2 = process.argv[4] === 'q2';
(async () => { const { b, p, errs, K } = await H.open({ q2: Q2 || process.argv[4] === 'closed', closeQ1: process.argv[4] === 'closed' });
  const res = await p.evaluate(({ K, TRIALS, SEED }) => { const T = window.__tally, A = window.__all; const base = JSON.stringify(T.state.sections[K]); const baseSet = JSON.stringify(T.state.settings);
    let seed = SEED; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let z = Math.imul(seed ^ seed >>> 15, 1 | seed); z = z + Math.imul(z ^ z >>> 7, 61 | z) ^ z; return ((z ^ z >>> 14) >>> 0) / 4294967296; }; const ri = n => Math.floor(rnd() * n);
    const bad = []; const stats = { reports: 0, units: 0, skills: 0, missing: 0, owesChecks: 0, trials: 0 };
    const myEff = (s, k, si) => { const cur = s.scores[k][si]; if (!T.state.settings.useBest || !s.best) return cur; const row = s.best[A.skillKey(s.skills[k])]; const bv = row ? row[A.ixlKeyAt(s, si)] : undefined; return bv == null ? cur : cur == null ? bv : Math.max(cur, bv); };
    for (let t = 0; t <= TRIALS; t++) {
      T.state.sections[K] = JSON.parse(base); T.state.settings = JSON.parse(baseSet); const s = T.state.sections[K]; s._keys = null;
      if (t > 0) { // randomize
        s.threshold = [60, 67, 70, 80, 100][ri(5)]; T.state.settings.useBest = rnd() < 0.6;
        const near = () => s.threshold + [-1, 0, 1, -15, -16, -14][ri(6)];
        s.scores.forEach(row => row.forEach((v, j) => { const x = rnd(); row[j] = x < 0.25 ? null : x < 0.45 ? Math.max(0, Math.min(100, near())) : x < 0.5 ? 0 : ri(101); }));
        s.best = {}; s.skills.forEach((sk, k) => { const row = s.best[A.skillKey(sk)] = {}; s.students.forEach((_, si) => { if (rnd() < 0.3) row[A.ixlKeyAt(s, si)] = ri(101); }); });
        s.studentSkips = {}; s.students.forEach((_, si) => { if (rnd() < 0.2) { const o = {}; s.skills.forEach(sk => { if (rnd() < 0.3) o[A.skillKey(sk)] = true; }); s.studentSkips[A.ixlKeyAt(s, si)] = o; } });
        s.grades.assignments.forEach(a => { a.status = a.status || []; a.values = a.values || []; s.grades.students.forEach((_, i) => { const x = rnd(); if (x < 0.15) { a.status[i] = 'missing'; a.values[i] = 0; } else if (x < 0.22) { a.status[i] = 'excused'; a.values[i] = null; } else { a.status[i] = 'score'; a.values[i] = rnd() < 0.3 ? a.max : ri((a.max || 10) + 1); } }); a.missing = a.status.filter(z => z === 'missing').length; });
      }
      stats.trials++; T.save();
      const og = A.openSec(s); const gb = og.grades; const rows = A.gbRows(s); const thr = s.threshold;
      const units = T.unitsOf(s).filter(u => u.assigned && u.total && !A.unitClosed(og, u));
      const ownReports = [];
      gb.students.forEach((name, i) => { const row = rows[i]; let html; try { html = A.studentReportSection(s, i, row); } catch (e) { bad.push({ t, i, what: 'throw', e: e.message }); return; }
        stats.reports++; const d = new DOMParser().parseFromString(html, 'text/html'); const ix = row && row.ixl != null ? row.ixl : null;
        const fail = (what, obs, exp, ctx) => bad.push({ t, i, what, obs, exp, ctx });
        // identity
        const h1 = d.querySelector('h1').textContent; if (h1 !== name) fail('name', h1, name);
        // big grade
        const g = A.computeGrade(og, i); const big = d.querySelector('.big').textContent; const expBig = g && g.rounded != null ? `${g.rounded}%${g.letter}` : '—'; if (big !== expBig) fail('big', big, expBig);
        // missing (oracle: every NHI in the open quarter, less an IXL column whose unit is all at goal by my count)
        const myPts = (u, si) => A.activeFor(s, u, si).filter(k => { const v = myEff(s, k, si); return v != null && v >= thr; }).length;
        const nhi = gb.assignments.filter(a => a.status && a.status[i] === 'missing');
        const owed = nhi.filter(a => { if (!/\bixl\b/i.test(a.name) || ix == null || !(a.max > 0)) return true; const m = a.name.match(/\bunit\s*(\d+)\b/i); const u = m && T.unitsOf(s).find(x => x.short === 'Unit ' + m[1]); return !(u && myPts(u, ix) >= a.max); });
        stats.missing += owed.length;
        const tile = d.querySelectorAll('.board > div')[0].querySelector('b').textContent; const expTile = owed.length ? String(owed.length) : 'None'; if (tile !== expTile) fail('missingTile', tile, expTile);
        const backNames = [...d.querySelectorAll('.missT tbody tr:not(.done) td:nth-child(2) > b')].map(x => x.textContent).sort(); const expNames = owed.map(a => a.name).sort(); if (JSON.stringify(backNames) !== JSON.stringify(expNames)) fail('missingBack', backNames, expNames);
        const unitOfCol = a => { const m = a.name.match(/\bunit\s*(\d+)\b/i); return m && T.unitsOf(s).find(x => x.short === 'Unit ' + m[1]); };
        const hs = d.querySelector('.panel.miss .ph .hs'); if (owed.length) { const pts = owed.reduce((n, a) => { let to = 0; if (/\bixl\b/i.test(a.name) && ix != null) { const u = unitOfCol(a); if (u) to = Math.min(a.max, myPts(u, ix)); } return n + Math.max(0, a.max - to); }, 0); const ptsTxt = hs ? hs.textContent : ''; const nTxt = `${owed.length} assignment${owed.length === 1 ? '' : 's'} · ${pts} point${pts === 1 ? '' : 's'}`; if (ptsTxt !== nTxt) fail('missHead', ptsTxt, nTxt); }
        { const sm = (d.body.textContent.match(/Still missing: (.*?)\. /) || [])[1]; if (sm != null) { stats.sm = (stats.sm || 0) + 1; const m = sm.match(/ and (\d+) more$/); const n = m ? sm.replace(/ and \d+ more$/, '').split(', ').length + Number(m[1]) : owed.filter(a => sm.includes(a.name)).length; if (n !== owed.length) fail('stillMissing', sm, owed.length); } }
        { const tots = [...d.querySelectorAll('.tot')].map(x => x.textContent); const work = tots.find(x => /missing assignments|Both|turned in|made up/.test(x) && !/IXL finished/.test(x)); const cells = [...d.querySelectorAll('.missT tbody tr:not(.done) td.r b')].map(x => x.textContent.match(/^\d+%/)[0]); if (work && cells.length) { stats.tot = (stats.tot || 0) + 1; const w = (work.match(/→ (\d+%)/) || [])[1]; if (w !== cells[cells.length - 1]) fail('totalVsBack', work, cells[cells.length - 1]); } }
        // IXL by unit
        let atSum = 0, skSum = 0, owedSum = 0;
        if (ix != null) { const ud = [...d.querySelectorAll('.panel.ixl .u')]; if (ud.length !== units.length) fail('unitCount', ud.length, units.length);
          units.forEach((u, n) => { stats.units++; const own = A.activeFor(s, u, ix); const at = own.filter(k => { const v = myEff(s, k, ix); return v != null && v >= thr; }); atSum += at.length; skSum += own.length;
            const ow = own.filter(k => !at.includes(k)); owedSum += ow.length; const exp = [...ow.filter(k => myEff(s, k, ix) != null).sort((x, y) => myEff(s, y, ix) - myEff(s, x, ix)), ...ow.filter(k => myEff(s, k, ix) == null)].map(k => `${s.skills[k].name}=${myEff(s, k, ix) == null ? 0 : myEff(s, k, ix)}`);
            const el = ud[n]; if (!el) return; const hb = el.querySelector('.uh > b').textContent; if (hb !== `${at.length} / ${own.length}`) fail('unitHead ' + u.short, hb, `${at.length} / ${own.length}`);
            const got = [...el.querySelectorAll('.sk')].map(x => `${x.querySelector('.nm > span').childNodes[0].textContent.trim()}=${x.querySelector('b').textContent.replace(/[()]/g, '')}`); stats.skills += got.length;
            const gs = got.map(x => x.split('=')[1]).join(','), es = exp.map(x => x.split('=')[1]).join(','); if (JSON.stringify(got.slice().sort()) !== JSON.stringify(exp.slice().sort()) || gs !== es) fail('unitSkills ' + u.short, got.slice(0, 4), exp.slice(0, 4));
            if (!ow.length && !el.querySelector('.done')) fail('unitDone ' + u.short, 'no done line', 'All N skills at goal'); });
          const it = d.querySelectorAll('.board > div')[1].querySelector('b').textContent; if (it !== `${atSum} / ${skSum}`) fail('ixlTile', it, `${atSum} / ${skSum}`);
          // the sentence "N IXL skills in Units .. are still below goal"
          const txt = d.body.textContent; const said = [...txt.matchAll(/(\w+ )(\d+) (?:IXL )?skills? in Units? /g)].filter(m => !/(finish|Finish|Pass) $/.test(m[1])).map(m => Number(m[2])); if (said.some(v => v !== owedSum)) fail('ixlStill', said, owedSum, (txt.match(new RegExp('.{0,160}\\b' + said.find(v => v !== owedSum) + ' (IXL )?skills? in Units? .{0,60}')) || [''])[0]);
          const start = [...d.querySelectorAll('.start .si')].map(x => Number(x.querySelector('em').textContent.split(' ')[0])); const nearExp = units.flatMap(u => A.activeFor(s, u, ix).map(k => myEff(s, k, ix))).filter(v => v != null && v > 0 && v < thr && thr - v <= 15).sort((a, b) => b - a).slice(0, 3).map(v => thr - v);
          if (JSON.stringify(start) !== JSON.stringify(nearExp)) fail('startHere', start, nearExp);
        }
        // assessments table
        const as = gb.assignments.filter(a => A.catIn(og, a) === 'Assessments' && a.max > 0 && a.status && (a.status[i] === 'score' || a.status[i] === 'missing'));
        const tq = [...d.querySelectorAll('.tq tr')].map(r => [...r.children].map(c => c.textContent).join('|')); const tqE = as.map(a => a.status[i] === 'missing' ? `${a.name}|not handed in|0%` : `${a.name}|${A.fmtN(a.values[i])}/${A.fmtN(a.max)}|${Math.round(a.values[i] / a.max * 100)}%`);
        if (JSON.stringify(tq) !== JSON.stringify(tqE)) fail('assessTable', tq.slice(0, 3), tqE.slice(0, 3));
        // the cumulative "Grade after, in this order": the last row must be the grade with every missing assignment (not IXL) turned in, from the pending-IXL baseline
        if (/every assessment at full marks/.test(d.body.textContent)) { stats.full = (stats.full || 0) + 1; const below = as.filter(a => a.status[i] === 'missing' || Number(a.values[i]) < a.max); if (!as.length || below.length) fail('fullMarks', as.length ? below.map(a => a.name + ' ' + a.values[i] + '/' + a.max) : 'no assessments graded', 'every Assessments item at full marks', (d.querySelector('.panel.main') || {}).textContent); }
        ownReports.push({ i, owes: owed.length > 0 || owedSum > 0 });
        const course = d.querySelector('.course').textContent; const qn = T.liveQuarter(s); if (!course.includes('Quarter ' + qn)) fail('quarter', course, qn);
        if (/undefined|NaN|Infinity|null%|\[object/.test(d.body.textContent)) fail('junk', (d.body.textContent.match(/.{30}(undefined|NaN|Infinity|null%|\[object).{20}/) || [''])[0], 'no junk');
      });
      // the Reports page's "Owe work" count = reports that show owed work or owed IXL
      try { T.state.active = K; A.openPrintMenu(s, false); const n = Number((document.querySelector('[data-who="owes"] small') || {}).textContent); const e = ownReports.filter(x => x.owes).length; stats.owesChecks++; if (n !== e) bad.push({ t, what: 'owesCount', obs: n, exp: e, who: ownReports.filter(x => x.owes).map(x => x.i).join(',') }); } catch (e) { bad.push({ t, what: 'reportsPage throw', e: e.message }); }
    }
    T.state.sections[K] = JSON.parse(base); T.state.settings = JSON.parse(baseSet);
    const by = {}; bad.forEach(x => { const k = x.what.split(' ')[0]; by[k] = (by[k] || 0) + 1; });
    return { stats, by, first: bad.slice(0, 12) }; }, { K, TRIALS, SEED });
  console.log(JSON.stringify(res, null, 0).slice(0, 4000)); console.log('errs', errs.slice(0, 3)); await b.close(); })().catch(e => { console.error(e); process.exit(2); });
