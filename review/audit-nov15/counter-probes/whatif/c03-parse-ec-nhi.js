// Does a real-format Focus export with an NHI on a "0 Points" column reach state as max 0 + status 'missing'?
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/counter-whatif/repo';
const lib = require(path.join(REPO, 'tests/lib.js')); const { chromium, exe, APP } = lib;
(async () => { const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage();
  await p.goto('file://' + path.resolve(APP));
  const r = await p.evaluate(() => { const T = window.__tally, A = window.__all; const parse = T.parseGradebook || A.parseGradebook;
    const hdr = ['Student ID','Local ID','Student','Grade','Quiz A\n 10 Points\n Due 09/25','Puzzle EC\n 0 Points\n Due 09/24'];
    const rows = [hdr, ['100001','','DOE, JANE','80% B','8 - 80 % - B','NHI Not Handed In'], ['100002','','ROE, RICK','90% A','9 - 90 % - A','2 - 0 % - F']];
    const g = parse(rows); const a = g.assignments.find(x => /Puzzle/.test(x.name)); return a ? { max: a.max, status: a.status, values: a.values } : { none: g.assignments.map(x => x.name) }; });
  console.log(JSON.stringify(r)); await b.close(); })();
