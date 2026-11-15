#!/bin/bash
# make_audit_copy.sh <tally repo> <new dir> : a copy of Tally with the audit-only hook window.__all (every top-level
# function and constant by name) in its TEST build, so the probes in ../probes can call any engine function.
# The hook never goes into the repo or the shipped build. Probes: TALLY_REPO=<new dir> node probes/<auditor>/NN-*.js
set -e; SRC=$1; DST=$2; mkdir -p "$DST"; (cd "$SRC" && tar --exclude=.git --exclude=node_modules --exclude=.github-token --exclude='*.test.html' -cf - .) | (cd "$DST" && tar xf -)
ln -sfn "$(cd "$SRC" && pwd)/node_modules" "$DST/node_modules"; cd "$DST"
python3 - <<'PY'
import re, pathlib
names = []
for f in ['app.js','grades.js','charts.js','home.js','seating.js','quarters.js','students.js','conference.js']:
    for line in pathlib.Path(f).read_text().split('\n'):
        m = re.match(r'^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)', line) or re.match(r'^(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)\s*(?:=|;|$|extends|\{)', line)
        if m and m.group(1) not in names: names.append(m.group(1))
p = pathlib.Path('app.js'); lines = p.read_text().split('\n'); i = next(k for k, l in enumerate(lines) if l.startswith('window.__tally = {'))
# a getter that names something out of scope only throws when read, so every name is safe to list
lines.insert(i + 1, 'window.__all = { ' + ', '.join('get %s() { return %s; }' % (n, n) for n in names) + ' };')
p.write_text('\n'.join(lines)); print(len(names), 'names exposed')
PY
python3 build.py --test
