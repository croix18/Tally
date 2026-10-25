#!/usr/bin/env python3
"""A stand-in for IXL's "Students Quickview" PDF (Analytics → Students Quickview → print), drawn with reportlab from the
scrubbed Score Grid in the report's shape: a header (STUDENTS, SKILL GRADES, DATE RANGE: This school year: Aug 10 -
Oct 24; STUDENTS QUICKVIEW; the totals), then one block per student: a header line with the name, "N questions",
"H hr M min" and "Practiced N days ago", then one row per skill practiced (grade and code · skill name · permanent
skill ID · questions · time · start score · current score), "See all N skills", "N Mastered  N Proficient". Blocks
flow across pages. Names come as IXL shows them: "Hayden Sutter". The answers are written beside the PDF as JSON.
  python3 fixtures/make_ixl_quickview_pdf.py fixtures/ixl_quickview.pdf"""
import sys, csv, random, json, pathlib, glob
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

root = pathlib.Path(__file__).parent
out = sys.argv[1] if len(sys.argv) > 1 else 'fixtures/ixl_quickview.pdf'
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
for st in students:
    if y < 120: newpage()
    c.setFont('Helvetica-Bold', 8); c.drawString(110, y, st['display'])
    c.setFont('Helvetica', 6.5); c.drawString(380, y, f"{st['questions']:,} questions"); c.drawString(450, y, mins(st['minutes'])); c.drawString(510, y, 'Practiced today' if st['days'] == 0 else ('Practiced yesterday' if st['days'] == 1 else f"Practiced {st['days']} days ago"))
    y -= 16
    for r in st['rows']:
        if y < 60: newpage()
        c.setFont('Helvetica', 6); c.drawString(130, y, r['grade']); c.drawString(185, y, r['name'][:58]); c.setFont('Helvetica', 5); c.drawString(185 + c.stringWidth(r['name'][:58], 'Helvetica', 6) + 5, y, r['id'])
        c.setFont('Helvetica', 6); c.drawRightString(420, y, str(r['q'])); c.drawRightString(475, y, mins(r['min'])); c.drawRightString(505, y, str(r['from'])); c.line(511, y + 2, 565, y + 2); c.setFont('Helvetica-Bold', 6); c.drawRightString(585, y, str(r['to']))
        y -= 10
    y -= 3; c.setFont('Helvetica', 6); c.drawString(130, y, f"See all {len(st['rows'])} skills ^"); c.drawRightString(585, y, f"{st['mastered']} Mastered    {st['proficient']} Proficient"); y -= 22
foot(); c.save()
(root / (pathlib.Path(out).stem + '.json')).write_text(json.dumps({ 'asOf': '2026-10-24', 'students': students }, indent=1))
print(out, len(students), 'students', sum(len(s['rows']) for s in students), 'rows')
