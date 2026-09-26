#!/usr/bin/env python3
"""Assemble the shipped single-file pages (no external scripts):
  Tally.html  = app.html + parser.js + app.js
  Scrub.html  = scrub.src.html + parser.js
`python3 build.py --test` also keeps the window.__tally debug handle that the
Playwright suites use; the default build strips it."""
import pathlib, re, sys, base64
root = pathlib.Path(__file__).parent
test = '--test' in sys.argv
parser = re.sub(r"^if \(typeof module.*$", '', (root / 'parser.js').read_text(), flags=re.M)
app = (root / 'app.js').read_text()
# DM Sans (SIL OFL, fonts/LICENSE-DM-Sans.txt) is embedded so the page makes no network request at all.
woff = base64.b64encode((root / 'fonts' / 'dm-sans-latin.woff2').read_bytes()).decode()
font = ("@font-face{font-family:'DM Sans';font-style:normal;font-weight:100 1000;font-display:swap;"
        "src:url(data:font/woff2;base64,%s) format('woff2');}" % woff)
if not test:
    app, n = re.subn(r"^window\.__tally = \{.*$", '', app, flags=re.M)
    assert n == 1, 'expected exactly one window.__tally line in app.js'
    assert '__tally' not in app, 'app.js still references window.__tally after stripping'

def build(src, out, **parts):
    html = (root / src).read_text()
    for k, v in parts.items():
        tag = '/*__%s__*/' % k
        assert tag in html, f'{src}: missing {tag}'
        html = html.replace(tag, v)
    (root / out).write_text(html)
    print(out, len(html), 'bytes', '(test build)' if test else '')

build('app.html', 'Tally.html', PARSER=parser, APP=app, FONT=font)
build('scrub.src.html', 'Scrub.html', PARSER=parser, FONT=font)
