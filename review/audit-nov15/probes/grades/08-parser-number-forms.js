// GRD-08 (Low): number forms the gradebook reader does not take. A CSV cell is text, so
//  - a Grade column of bare numbers ("79", no "%") is not read at all: overall becomes null, so nothing is proved and the
//    screen says the export "has no Grade column";
//  - ".5" (a half point written without the 0) is kept as a text code, left out, and offered in Decide as
//    "Counts as a zero / Left out of the grade" (both wrong: it is half a point);
//  - "1,000"-style thousands are a text code too (only matters for a 1000-point column).
const path = require('path'); const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
(async () => { const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage(); await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const T = window.__tally;
    const csv = 'Student,Grade,"Quiz\n10 Points"\n"Doe, Jane",79,.5\n"Roe, Rick",88,8\n"Poe, Pat",91,9.5\n';
    const P = window.csvToRows || (window.__all && window.__all.csvToRows); const grid = P(csv);
    const gb = T.parseGradebook(grid); const a = gb.assignments[0];
    return { overall: gb.overall, quiz: { max: a.max, values: a.values, status: a.status, codes: a.codes || null } }; });
  console.log('OBSERVED:', JSON.stringify(r));
  console.log('EXPECTED: overall [79,88,91]; Quiz values [0.5,8,9.5], all "score"');
  check(JSON.stringify(r.overall) === '[79,88,91]', 'a Grade column of bare numbers is read');
  check(r.quiz.values[0] === 0.5 && r.quiz.status[0] === 'score', '".5" is half a point');
  await b.close(); done(); })().catch(e => { console.error(e); process.exit(2); });
