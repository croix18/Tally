#!/usr/bin/env python3
"""A stand-in for IXL's "Students Quickview" PDF (Analytics → Students Quickview → print), drawn with reportlab from the
scrubbed Score Grid in the report's shape: a header (STUDENTS, SKILL GRADES, DATE RANGE: This school year: Aug 10 -
Oct 24; STUDENTS QUICKVIEW; the totals), then one block per student: a header line with the name, "N questions",
"H hr M min" and "Practiced N days ago", then one row per skill practiced (grade and code · skill name · permanent
skill ID · questions · time · start score · current score), "See all N skills", "N Mastered  N Proficient". Blocks
flow across pages. Names come as IXL shows them: "Hayden Sutter". The answers are written beside the PDF as JSON.
  python3 fixtures/make_ixl_quickview_pdf.py fixtures/ixl_quickview.pdf
--hard draws the same students the way a browser prints an HTML table (audit, 25 Oct 2026, after "the time spent is
extremely hit or miss"): a long skill name wraps onto two lines in its cell and the other cells sit centred between
them; a time over an hour wraps too ("1 hr 23" over "min", or "1 hr" over "23 min"); a student's header is drawn again
at the top of the next page when the list runs over; one name carries an accent the Score Grid doesn't; one header
says "Practiced Oct 3"; and one header can't be read at all (no "questions"), so its rows must not join the student
above it.
  python3 fixtures/make_ixl_quickview_pdf.py fixtures/ixl_quickview_hard.pdf --hard"""
import sys, csv, random, json, pathlib, glob
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

root = pathlib.Path(__file__).parent
args = [a for a in sys.argv[1:] if not a.startswith('--')]; hard = '--hard' in sys.argv
out = args[0] if args else ('fixtures/ixl_quickview_hard.pdf' if hard else 'fixtures/ixl_quickview.pdf')
grid = glob.glob(str(root / 'ixl_7T1A_scrubbed_IXL-Score-Grid_*.csv'))[0]
rows = list(csv.reader(open(grid, encoding='utf-8-sig')))
names = rows[0][4:]
skills = [(r[0], r[2], r[3], r[4:] + [''] * len(names)) for r in rows[1:] if len(r) > 4 and r[3]]
rnd = random.Random(7)
EXTRA = [('7th (O.2)', 'Convert between percents, fractions, and decimals', '2HW'), ('8th (M.1)', 'Which x satisfies an equation?', 'BVQ'), ('7th (M.4)', 'Distance between two points', 'RUZ')]
def code(unit, k):
    g = '8th' if 'Scientific' in unit or 'Rational' in unit else '7th'
    return f'{g} ({chr(65 + (k // 9) % 20)}.{k % 9 + 1})' if k % 4 else g   # some rows carry only the grade, as the real report does
def mins(m): return '<1 min' if m < 1 else (f'{m // 60} hr {m % 60} min' if m >= 60 else f'{m} min')
students = []
for j, n in enumerate(names):
    first, last = n.split(' ', 1) if ' ' in n else (n, '')
    disp = f'{first.title()} {last.title()}'.strip()
    done = [(k, sk) for k, sk in enumerate(skills) if sk[3][j].strip() not in ('', '-')]
    rnd.shuffle(done); done = done[:8 + j % 9]
    rows_s = []
    for k, (unit, name, sid, vals) in done:
        to = int(float(vals[j].strip() or 0)); frm = 0 if rnd.random() < .8 else rnd.randint(10, max(11, to - 1)); q = rnd.randint(1, 40); m = rnd.choice([0, 1, 2, 5, 9, 13, 21, 34, 72, 83])
        rows_s.append({ 'grade': code(unit, k), 'name': name, 'id': sid, 'q': q, 'min': m, 'from': frm, 'to': to })
    if j % 5 == 0: rows_s.append({ 'grade': EXTRA[j % 3][0], 'name': EXTRA[j % 3][1], 'id': EXTRA[j % 3][2], 'q': 7, 'min': 3, 'from': 0, 'to': 10 })
    days = rnd.choice([0, 1, 2, 5, 8, 12, 20])
    students.append({ 'ixlName': n, 'display': disp, 'questions': sum(r['q'] for r in rows_s) + rnd.randint(100, 900), 'minutes': sum(r['min'] for r in rows_s) + rnd.randint(30, 400), 'days': days, 'mastered': sum(1 for r in rows_s if r['to'] >= 100), 'proficient': sum(1 for r in rows_s if 80 <= r['to'] < 100), 'rows': rows_s })

if hard:
    students[3]['display'] = students[3]['display'].replace('o', '\u00f3', 1)   # "L\u00f3gan": the Score Grid says LOGAN
    students[9]['dateHead'] = 'Oct 3'; students[9]['days'] = 21                 # "Practiced Oct 3", 21 days before Oct 24
    students[6]['unreadable'] = True                                             # a header with no "questions"
c = canvas.Canvas(out, pagesize=letter); W, H = letter
y = H - 50
c.setFont('Helvetica', 6.5); c.drawString(100, y, 'STUDENTS: M/J ACCEL MATH GR 7    SKILL GRADES: 7 - 8    DATE RANGE: This school year: Aug 10 - Oct 24'); y -= 22
c.setFont('Helvetica', 16); c.drawString(100, y, 'STUDENTS QUICKVIEW'); y -= 30
c.setFont('Helvetica', 11); c.drawString(110, y, 'This school year, your students have...'); y -= 30
c.setFont('Helvetica', 7); c.drawString(190, y, 'ANSWERED'); c.drawString(330, y, 'SPENT'); c.drawString(520, y, 'MADE PROGRESS IN'); y -= 14
c.setFont('Helvetica', 14); c.drawString(190, y, '41,005'); c.drawString(330, y, '466 hr 36 min'); c.drawString(520, y, '279'); y -= 12
c.setFont('Helvetica', 7); c.drawString(190, y, 'QUESTIONS'); c.drawString(330, y, 'LEARNING'); c.drawString(520, y, 'SKILLS'); y -= 40
c.setFont('Helvetica', 12); c.drawString(100, y, 'Students'); y -= 24
page = 1
def foot():
    c.setFont('Helvetica', 6); c.drawCentredString(W / 2, 28, f'Page {page} of 79 - www.ixl.com')
def newpage():
    global page, y
    foot(); c.showPage(); page += 1; y = H - 50
def head(st):
    c.setFont('Helvetica-Bold', 8); c.drawString(110, y, st['display'])
    c.setFont('Helvetica', 6.5)
    if not st.get('unreadable'): c.drawString(380, y, f"{st['questions']:,} questions")
    c.drawString(450, y, mins(st['minutes'])); c.drawString(510, y, f"Practiced {st['dateHead']}" if st.get('dateHead') else 'Practiced today' if st['days'] == 0 else ('Practiced yesterday' if st['days'] == 1 else f"Practiced {st['days']} days ago"))
def wrapname(name, width=34):
    if not hard or len(name) <= width: return [name]
    cut = name.rfind(' ', 0, width); cut = cut if cut > 0 else width
    return [name[:cut], name[cut:].strip()]
for st in students:
    if y < 120: newpage()
    head(st); y -= 16
    for k, r in enumerate(st['rows']):
        lines = wrapname(r['name'][:58]); t = mins(r['min']); tw = hard and r['min'] >= 60; tall = len(lines) > 1 or tw
        if y < 60 + (8 if tall else 0):
            newpage()
            if hard: head(st); y -= 16                                   # the header again at the top of the page
        mid = y - 4 if tall else y                                       # single-line cells sit centred in a two-line row
        c.setFont('Helvetica', 6); c.drawString(130, mid, r['grade'])
        for j, ln in enumerate(lines): c.drawString(185, y - 8 * j if tall else y, ln)
        ly = (y - 8 * (len(lines) - 1)) if tall else y
        c.setFont('Helvetica', 5); c.drawString(185 + c.stringWidth(lines[-1], 'Helvetica', 6) + 5, ly, r['id'])
        c.setFont('Helvetica', 6); c.drawRightString(420, mid, str(r['q']))
        if tw:
            h_, m_ = r['min'] // 60, r['min'] % 60
            if k % 2: c.drawRightString(475, y, f'{h_} hr {m_}'); c.drawRightString(475, y - 8, 'min')
            else: c.drawRightString(475, y, f'{h_} hr'); c.drawRightString(475, y - 8, f'{m_} min')
        else: c.drawRightString(475, mid, t)
        c.drawRightString(505, mid, str(r['from'])); c.line(511, mid + 2, 565, mid + 2); c.setFont('Helvetica-Bold', 6); c.drawRightString(585, mid, str(r['to']))
        y -= 18 if tall else 10
    y -= 3; c.setFont('Helvetica', 6); c.drawString(130, y, f"See all {len(st['rows'])} skills ^"); c.drawRightString(585, y, f"{st['mastered']} Mastered    {st['proficient']} Proficient"); y -= 22
foot(); c.save()
(root / (pathlib.Path(out).stem + '.json')).write_text(json.dumps({ 'asOf': '2026-10-24', 'students': students }, indent=1))
print(out, len(students), 'students', sum(len(s['rows']) for s in students), 'rows')
