// IMP-02: an IXL class export whose student-name header cells are empty (Tally's "placeholder" class, "Student 1…N").
// parseIxlGrid folds a skill listed twice in one unit into one skill row, but the placeholder branch of importFiles
// rebuilds g.scores from every row of the file without that folding, so every skill after the repeated one reads the
// next skill's scores. Synthetic data only.
const H = require('./h.js');
// Skill S2 is listed twice (two lessons of Unit 1 share it, as the real accelerated export does once).
// Each skill's scores are distinctive: skill k -> every student scores 10*k (S2's second listing has 20s too).
const rows = [['Unit 1 Ratios', 'Lesson 1.1', 'Skill one', 'S1'], ['Unit 1 Ratios', 'Lesson 1.1', 'Skill two', 'S2'], ['Unit 1 Ratios', 'Lesson 1.2', 'Skill two', 'S2'],
  ['Unit 1 Ratios', 'Lesson 1.2', 'Skill three', 'S3'], ['Unit 1 Ratios', 'Lesson 1.3', 'Skill four', 'S4'], ['Unit 2 Rates', 'Lesson 2.1', 'Skill five', 'S5']];
const val = { S1: 10, S2: 20, S3: 30, S4: 40, S5: 90 };
const csv = 'Unit,,Skill name,Permanent Skill ID,,,\n' + rows.map(r => r.join(',') + ',' + [0, 1, 2].map(() => val[r[3]]).join(',')).join('\n') + '\n';
const NAME = 'IXL-Score-Grid_2026-11-13_This-School-Year_1205050-7T4A-M_J-GR7_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv';
(async () => {
  const { b, p, errs } = await H.open();
  const r = await H.imp(p, [{ name: NAME, text: csv }]);
  const out = await p.evaluate(() => { const s = window.__tally.state.sections['1205050-7T4A']; if (!s) return null;
    return { placeholder: s.placeholder, students: s.students, skills: s.skills.map(k => k.id), firstScoreBySkill: s.skills.map((k, i) => k.id + '=' + (s.scores[i] || [])[0]), scoreRows: s.scores.length }; });
  const ok = out && out.skills.length === out.scoreRows && out.firstScoreBySkill.every(x => { const [id, v] = x.split('='); return +v === val[id]; });
  H.report(JSON.stringify(out), 'one score row per skill, each skill carrying its own scores: S1=10,S2=20,S3=30,S4=40,S5=90', !!ok);
  H.check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); H.done();
})().catch(e => { console.error(e); process.exit(2); });
