#!/usr/bin/env python3
"""Assemble Tally.html from app.html + parser.js + app.js (no external scripts)."""
import pathlib, re
root = pathlib.Path(__file__).parent
html = (root / 'app.html').read_text()
parser = re.sub(r"^if \(typeof module.*$", '', (root / 'parser.js').read_text(), flags=re.M)
app = (root / 'app.js').read_text()
assert '/*__PARSER__*/' in html and '/*__APP__*/' in html
out = html.replace('/*__PARSER__*/', parser).replace('/*__APP__*/', app)
(root / 'Tally.html').write_text(out)
print('Tally.html', len(out), 'bytes')
