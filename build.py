#!/usr/bin/env python3
"""Assemble the shipped single-file pages (no external scripts):
  Tally.html  = app.html + parser.js + app.js + grades.js + charts.js + home.js + seating.js + quarters.js + students.js + conference.js
  Scrub.html  = scrub.src.html + parser.js
`python3 build.py --test` also keeps the window.__tally debug handle that the
Playwright suites use; the default build strips it."""
import pathlib, re, sys, base64
root = pathlib.Path(__file__).parent
test = '--test' in sys.argv
parser = re.sub(r"^if \(typeof module.*$", '', (root / 'parser.js').read_text(), flags=re.M)
app = (root / 'app.js').read_text()
grades = (root / 'grades.js').read_text()
assert '/*__GRADES__*/' in app and '/*__CHARTS__*/' in app
assert '/*__HOME__*/' in app and '/*__SEATING__*/' in app
assert '/*__QUARTERS__*/' in app and '/*__STUDENTS__*/' in app and '/*__CONFERENCE__*/' in app
# conference.js carries the school form's banner and footer artwork (forms/) as data URIs, so printing needs no network
conf = (root / 'conference.js').read_text()
for tag, f, mime in (('CONF_TOP', 'whms-top.jpg', 'image/jpeg'), ('CONF_FOOT', 'whms-foot.png', 'image/png')):
    assert ('/*__%s__*/' % tag) in conf
    conf = conf.replace('/*__%s__*/' % tag, 'data:%s;base64,%s' % (mime, base64.b64encode((root / 'forms' / f).read_bytes()).decode()))
app = app.replace('/*__GRADES__*/', grades).replace('/*__CHARTS__*/', (root / 'charts.js').read_text()).replace('/*__HOME__*/', (root / 'home.js').read_text()).replace('/*__SEATING__*/', (root / 'seating.js').read_text()).replace('/*__QUARTERS__*/', (root / 'quarters.js').read_text()).replace('/*__STUDENTS__*/', (root / 'students.js').read_text()).replace('/*__CONFERENCE__*/', conf)
# DM Sans (SIL OFL, fonts/LICENSE-DM-Sans.txt) is embedded so the page makes no network request at all.
woff = base64.b64encode((root / 'fonts' / 'dm-sans-latin.woff2').read_bytes()).decode()
font = ("@font-face{font-family:'DM Sans';font-style:normal;font-weight:100 1000;font-display:block;"
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

if test:   # the test build is its own file, so a test run can never leave window.__tally in the shipped pages
    build('app.html', 'Tally.test.html', PARSER=parser, APP=app, FONT=font)
    build('scrub.src.html', 'Scrub.test.html', PARSER=parser, FONT=font)
else:
    build('app.html', 'Tally.html', PARSER=parser, APP=app, FONT=font)
    (root / 'index.html').write_bytes((root / 'Tally.html').read_bytes())   # GitHub Pages serves the app at the repo root
    build('scrub.src.html', 'Scrub.html', PARSER=parser, FONT=font)
