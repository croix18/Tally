// node tools/ctx.js <repo> <regex> [W] files... : print every match with ±W chars of context
const fs = require('fs'), path = require('path');
const REPO = process.argv[2]; const RE = new RegExp(process.argv[3], 'g'); let W = 170; let files = process.argv.slice(4);
if (/^\d+$/.test(files[0])) { W = +files[0]; files = files.slice(1); }
if (!files.length) files = ['app.js', 'grades.js', 'charts.js', 'home.js', 'seating.js', 'quarters.js', 'students.js', 'conference.js', 'parser.js'];
for (const f of files) {
  const lines = fs.readFileSync(path.join(REPO, f), 'utf8').split('\n');
  lines.forEach((ln, i) => {
    const hits = []; let m; RE.lastIndex = 0;
    while ((m = RE.exec(ln))) { hits.push([m.index, m.index + m[0].length]); if (m[0].length === 0) RE.lastIndex++; }
    if (!hits.length) return;
    const wins = [];
    for (const [a, b] of hits) { const s = Math.max(0, a - W), e = Math.min(ln.length, b + W); if (wins.length && s <= wins[wins.length - 1][1]) wins[wins.length - 1][1] = e; else wins.push([s, e]); }
    for (const [s, e] of wins) console.log(`${f}:${i + 1}@${s}  …${ln.slice(s, e)}…\n`);
  });
}
