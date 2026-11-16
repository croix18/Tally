#!/usr/bin/env python3
"""Assemble the shipped single-file pages (no external scripts):
  Tally.html  = app.html + parser.js + vendor/seal.js + examcore.js + app.js + grades.js + charts.js + home.js + seating.js + quarters.js + students.js + conference.js + exams.js
  Scrub.html  = scrub.src.html + parser.js
`python3 build.py --test` also keeps the window.__tally debug handle that the
Playwright suites use; the default build strips it."""
import pathlib, re, sys, base64
root = pathlib.Path(__file__).parent
test = '--test' in sys.argv
check = '--check' in sys.argv   # build in memory and compare with the shipped files on disk; write nothing (tests/shipped-build.js)
mismatch = []
parser = re.sub(r"^if \(typeof module.*$", '', (root / 'parser.js').read_text(), flags=re.M)
app = (root / 'app.js').read_text()
grades = (root / 'grades.js').read_text()
assert '/*__GRADES__*/' in app and '/*__CHARTS__*/' in app
assert '/*__HOME__*/' in app and '/*__SEATING__*/' in app
assert '/*__QUARTERS__*/' in app and '/*__STUDENTS__*/' in app and '/*__CONFERENCE__*/' in app and '/*__EXAMS__*/' in app
# Tests (16 Nov 2026): Windmill's exam/seal.js, copied unchanged (vendor/seal.json records where from and its SHA-256), and
# examcore.js; both are scripts of their own on the page (window.ExamSeal, window.ExamCore); exams.js is spliced into app.js.
import hashlib, json
sealjs = (root / 'vendor' / 'seal.js').read_text(); sealmeta = json.loads((root / 'vendor' / 'seal.json').read_text())
assert hashlib.sha256((root / 'vendor' / 'seal.js').read_bytes()).hexdigest() == sealmeta['sha256'], 'vendor/seal.js is not the copy vendor/seal.json records: copy it again from Windmill unchanged'
examcore = (root / 'examcore.js').read_text()
for v in (sealjs, examcore): assert '</script' not in v.lower() and '<!--' not in v, 'a Tests script would end its <script> tag early'
# conference.js carries the school form's banner and footer artwork (forms/) as data URIs, so printing needs no network
conf = (root / 'conference.js').read_text()
for tag, f, mime in (('CONF_TOP', 'whms-top.jpg', 'image/jpeg'), ('CONF_FOOT', 'whms-foot.png', 'image/png')):
    assert ('/*__%s__*/' % tag) in conf
    conf = conf.replace('/*__%s__*/' % tag, 'data:%s;base64,%s' % (mime, base64.b64encode((root / 'forms' / f).read_bytes()).decode()))
# Sync is retired (9 Nov 2026): Tally runs only from a file on the teacher's computer and connects to nothing.
assert '/*__SYNC__*/' not in app
bench = (root / 'vendor' / 'benchmarks.json').read_text().strip(); assert '</script' not in bench.lower() and bench.startswith('{')
app = app.replace('/*__BENCHMARKS__*/{ skills: {}, labels: {} }', bench).replace('/*__GRADES__*/', grades).replace('/*__CHARTS__*/', (root / 'charts.js').read_text()).replace('/*__HOME__*/', (root / 'home.js').read_text()).replace('/*__SEATING__*/', (root / 'seating.js').read_text()).replace('/*__QUARTERS__*/', (root / 'quarters.js').read_text()).replace('/*__STUDENTS__*/', (root / 'students.js').read_text()).replace('/*__CONFERENCE__*/', conf).replace('/*__EXAMS__*/', (root / 'exams.js').read_text())
# DM Sans (SIL OFL, fonts/LICENSE-DM-Sans.txt) is embedded so the page makes no network request at all.
woff = base64.b64encode((root / 'fonts' / 'dm-sans-latin.woff2').read_bytes()).decode()
font = ("@font-face{font-family:'DM Sans';font-style:normal;font-weight:100 1000;font-display:block;"
        "src:url(data:font/woff2;base64,%s) format('woff2');}" % woff)
if not test:
    app, n = re.subn(r"^window\.__tally = \{.*$", '', app, flags=re.M)
    assert n == 1, 'expected exactly one window.__tally line in app.js'
    assert '__tally' not in app, 'app.js still references window.__tally after stripping'
else:
    # The test build also exposes every top-level function and constant of the app by name (window.__all), so a suite
    # or an audit probe (review/audit-nov15/probes) can call any engine function, not only the ones on window.__tally.
    # A getter that names something out of scope only throws when it is read. Never in the shipped build.
    names = []
    for line in app.split('\n'):
        m = re.match(r'^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)', line) or re.match(r'^(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)\s*(?:=|;|$|extends|\{)', line)
        if m and m.group(1) not in names: names.append(m.group(1))
    hook = 'window.__all = { ' + ', '.join('get %s() { return %s; }' % (x, x) for x in names) + ' };'
    app, n = re.subn(r"^(window\.__tally = \{.*)$", lambda m: m.group(1) + '\n' + hook, app, count=1, flags=re.M)
    assert n == 1, 'expected exactly one window.__tally line in app.js'

# pdf.js (vendor/, Apache-2.0) reads the FLDOE score report PDF; neither file may hold "</script", which would end its tag.
pdfjs = (root / 'vendor' / 'pdf.min.js').read_text(); pdfworker = (root / 'vendor' / 'pdf.worker.min.js').read_text()
for v in (pdfjs, pdfworker): assert '</script' not in v.lower() and '<!--' not in v, 'a vendor file would end its <script> tag early'

def build(src, out, **parts):
    html = (root / src).read_text()
    for k, v in parts.items():
        tag = '/*__%s__*/' % k
        assert tag in html, f'{src}: missing {tag}'
        html = html.replace(tag, v)
    if check:
        same = (root / out).exists() and (root / out).read_text() == html
        if not same: mismatch.append(out)
        print(out, 'is' if same else 'is NOT', 'the build of these sources')
        return
    (root / out).write_text(html)
    print(out, len(html), 'bytes', '(test build)' if test else '')

if test:   # the test build is its own file, so a test run can never leave window.__tally in the shipped pages
    # and it may also reach a stand-in for the site on this machine (tests/exam-site.js); the shipped page reaches mrshaffer.org only
    build('app.html', 'Tally.test.html', PARSER=parser, APP=app, FONT=font, PDFJS=pdfjs, PDFJS_WORKER=pdfworker, SEAL=sealjs, EXAMCORE=examcore)
    t = (root / 'Tally.test.html').read_text(); assert t.count('connect-src https://mrshaffer.org;') == 1
    (root / 'Tally.test.html').write_text(t.replace('connect-src https://mrshaffer.org;', 'connect-src https://mrshaffer.org http://127.0.0.1:*;'))
    build('scrub.src.html', 'Scrub.test.html', PARSER=parser, FONT=font)
else:
    build('app.html', 'Tally.html', PARSER=parser, APP=app, FONT=font, PDFJS=pdfjs, PDFJS_WORKER=pdfworker, SEAL=sealjs, EXAMCORE=examcore)
    if check:
        if (root / 'index.html').read_bytes() != (root / 'Tally.html').read_bytes(): mismatch.append('index.html'); print('index.html is NOT Tally.html')
        else: print('index.html is Tally.html')
    else: (root / 'index.html').write_bytes((root / 'Tally.html').read_bytes())   # GitHub Pages serves the app at the repo root
    build('scrub.src.html', 'Scrub.html', PARSER=parser, FONT=font)
    if check and mismatch: sys.exit('not the build of these sources: ' + ', '.join(mismatch) + ' (run python3 build.py)')
