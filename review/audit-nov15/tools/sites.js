// Lists every date/time site in the sources with merged context windows.
const fs = require('fs'), path = require('path');
const REPO = process.argv[2]; const files = process.argv.slice(3);
const RE = /new Date|Date\.now|toISOString|getTimezoneOffset|86400000|864e5|slice\(0, ?10\)|localDayOf|todayISO|ageDays|ageText|overdue|weekOf|daysBetween|mdToISO|\baDate\b|remindDays|lastModified|toLocale|getDay\(|setDate\(|getTime\(|T12:00|setHours|getHours|\.slice\(5|getFullYear|60000|quarterOf\(|\.ends\[|Q_ENDS|\.date [<>=]|\.date\)|\.at [<>]|importedAt|exportedAt/g;
const W = +process.env.W || 170;
for (const f of files) {
  const lines = fs.readFileSync(path.join(REPO, f), 'utf8').split('\n');
  lines.forEach((ln, i) => {
    const hits = []; let m; RE.lastIndex = 0;
    while ((m = RE.exec(ln))) hits.push([m.index, m.index + m[0].length]);
    if (!hits.length) return;
    // merge windows
    const wins = [];
    for (const [a, b] of hits) { const s = Math.max(0, a - W), e = Math.min(ln.length, b + W); if (wins.length && s <= wins[wins.length - 1][1]) wins[wins.length - 1][1] = e; else wins.push([s, e]); }
    for (const [s, e] of wins) console.log(`${f}:${i + 1}@${s}  …${ln.slice(s, e)}…\n`);
  });
}
