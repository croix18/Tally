#!/usr/bin/env python3
"""A stand-in for the FLDOE / Cambium "Score, Achievement and Points Earned on Grade N FAST Mathematics (PM1 2026-27)
of All Rosters, by Student and Reporting Category" PDF, drawn with reportlab from the scrubbed roster, in the same
shape: page 1 is the Total table (Student · FLEID · Scale Score · Achievement Level · Percentile Rank) with the State /
District / School / My Students summary rows above the students; each later page is one reporting category (Student ·
FLEID · Performance) whose rows read Below / At/Near / Above the Standard. Long names wrap onto two lines. The tables
split across pages with their header repeated, as the real report's do.
  python3 fixtures/make_fast_items_pdf.py 7 fixtures/fast_items_g7.pdf
  python3 fixtures/make_fast_items_pdf.py 8 fixtures/fast_items_g8.pdf"""
import sys, random, re, pathlib
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

grade = int(sys.argv[1]) if len(sys.argv) > 1 else 7
out = sys.argv[2] if len(sys.argv) > 2 else f'fixtures/fast_items_g{grade}.pdf'
root = pathlib.Path(__file__).parent
names = [l.split(' = ')[0].strip() for l in (root / 'focus_roster_scrubbed.txt').read_text().splitlines() if ',' in l]
names = [re.sub(r'\s+\d+$', '', n) for n in names][:23]
CATS = { 7: ['1. Number Sense and Operations and Algebraic Reasoning', '2. Proportional Reasoning and Relationships', '3. Geometric Reasoning', '4. Data Analysis and Probability'],
         8: ['1. Number Sense and Operations and Probability', '2. Algebraic Reasoning', '3. Linear Relationships, Data Analysis and Functions', '4. Geometric Reasoning'] }[grade]
PERF = ['Below the Standard', 'At/Near the Standard', 'Above the Standard']
rnd = random.Random(grade)
rows = []
for i, n in enumerate(names):
    scale = rnd.randint(190, 262) if grade == 7 else rnd.randint(200, 270)
    cuts = { 7: [175, 223, 235, 247, 258], 8: [183, 227, 244, 254, 263] }[grade]
    level = sum(1 for c in cuts if scale >= c)
    pct = max(1, min(99, int((scale - cuts[0]) / (288 - cuts[0]) * 130) - 10))
    rows.append({ 'name': n, 'fleid': 'FL%012d' % (100000000000 + i * 7919), 'scale': scale, 'level': level, 'pct': pct if i != 4 else None,
                  'cats': [rnd.choice(PERF) for _ in CATS] })
rows[2]['name'] = rows[2]['name'] + ' DE LA FUENTE-WASHINGTON'   # a name that wraps onto two lines
rows[6]['pct'] = 0   # reads "<1" in some reports; here 0
skip_in_cat = { 1: {rows[5]['fleid']}, 3: {rows[0]['fleid'], rows[9]['fleid']} }   # students the category table leaves out

c = canvas.Canvas(out, pagesize=letter)
W, H = letter
def header(c, y, cols, title):
    c.setFont('Helvetica-Bold', 8)
    x = 72
    for w, t in cols:
        c.rect(x, y - 16, w, 16); c.drawCentredString(x + w / 2, y - 11, t); x += w
    return y - 16
def wrap(name, width_chars=22):
    if len(name) <= width_chars: return [name]
    cut = name.rfind(' ', 0, width_chars); cut = cut if cut > 0 else width_chars
    return [name[:cut], name[cut:].strip()]

# ---- page 1: the Total table
y = H - 60
c.setFont('Helvetica', 11); c.drawString(72, y, f'Score, Achievement and Points Earned on Grade {grade} FAST Mathematics'); y -= 14
c.drawString(72, y, '(PM1 2026-27) of All Rosters, by Student and Reporting Category: , 2026-2027'); y -= 14
c.setFont('Helvetica', 9); c.drawString(72, y, 'Filtered By  Rosters: All Rosters  |  Test Reasons: PM1 2026-27  |'); y -= 24
cols = [(130, 'Student'), (90, 'FLEID'), (70, 'Scale Score'), (110, 'Achievement Level'), (80, 'Percentile Rank')]
def total_header(y):
    c.setFont('Helvetica-Bold', 8); c.rect(72, y - 16, 130, 16); c.drawCentredString(137, y - 11, 'Student'); c.rect(202, y - 16, 90, 16); c.drawCentredString(247, y - 11, 'FLEID'); c.rect(292, y - 16, 260, 16); c.drawCentredString(422, y - 11, 'Total'); y -= 16
    return header(c, y, cols, '')
y = total_header(y)
c.setFont('Helvetica', 8)
for lab, sc, pcts in [('State', 222, '46%  30%  17%  5%  1%'), ('District', 220, '52%  32%  13%  3%  <0.5%'), ('School', 220, '54%  37%  8%  1%'), ('My Students', 221, '49%  39%  10%  2%')]:
    c.rect(72, y - 36, 480, 36); c.drawString(78, y - 21, lab); c.drawCentredString(327, y - 21, str(sc)); c.drawString(372, y - 14, 'Percent'); c.drawString(372, y - 26, 'Count'); c.drawString(410, y - 14, pcts); c.drawString(410, y - 26, '5387  3562  2008  579  17'); c.drawCentredString(512, y - 21, 'n/a'); y -= 36
for i, r in enumerate(rows):
    if y < 90:
        c.showPage(); y = H - 60; y = total_header(y); c.setFont('Helvetica', 8)
    lines = wrap(r['name']); h = 14 if len(lines) == 1 else 24
    c.setFont('Helvetica', 8); c.rect(72, y - h, 480, h)
    for j, ln in enumerate(lines): c.drawString(78, y - 10 - j * 10 - (0 if len(lines) == 1 else 1), ln)
    c.drawString(206, y - 10 - (h - 14) / 2, r['fleid']); c.drawCentredString(327, y - 10 - (h - 14) / 2, str(r['scale'])); c.drawCentredString(427, y - 10 - (h - 14) / 2, f"Level {r['level']}")
    c.drawCentredString(512, y - 10 - (h - 14) / 2, 'n/a' if r['pct'] is None else ('<1' if r['pct'] == 0 else str(r['pct'])))
    y -= h
c.setFont('Helvetica', 7); c.drawString(72, 40, 'Page 1'); c.drawRightString(W - 72, 40, 'Copyright © 2026 Cambium Assessment, Inc. All rights reserved.')

# ---- one page per category (a long one spills onto a second page with the header repeated)
page = 1
for ci, cat in enumerate(CATS):
    c.showPage(); page += 1; y = H - 60
    def cat_header(y):
        c.setFont('Helvetica-Bold', 8); c.rect(72, y - 16, 130, 16); c.drawCentredString(137, y - 11, 'Student'); c.rect(202, y - 16, 90, 16); c.drawCentredString(247, y - 11, 'FLEID'); c.rect(292, y - 16, 260, 16); c.drawCentredString(422, y - 11, cat); y -= 16
        c.rect(72, y - 14, 130, 14); c.rect(202, y - 14, 90, 14); c.rect(292, y - 14, 260, 14); c.setFont('Helvetica', 8); c.drawCentredString(422, y - 10, 'Performance'); return y - 14
    y = cat_header(y)
    c.setFont('Helvetica', 8)
    for lab, pcts in [('State', '31%   57%   12%'), ('District', '32%   61%   7%'), ('School', '35%   65%   1%'), ('My Students', '31%   67%   2%')]:
        c.rect(72, y - 40, 480, 40); c.drawString(78, y - 23, lab); c.drawString(372, y - 16, 'Percent'); c.drawString(372, y - 28, 'Count'); c.drawString(420, y - 16, pcts); c.drawString(420, y - 28, '36268   66801   14014'); y -= 40
    for i, r in enumerate(rows):
        if r['fleid'] in skip_in_cat.get(ci, set()): continue
        if y < 90 or (ci == 0 and i == 17):   # split the first category's table like the real report (second table starts with its header)
            c.setFont('Helvetica', 7); c.drawString(72, 40, f'Page {page}'); c.showPage(); page += 1; y = H - 60; y = cat_header(y); c.setFont('Helvetica', 8)
        lines = wrap(r['name']); h = 14 if len(lines) == 1 else 24
        c.setFont('Helvetica', 8); c.rect(72, y - h, 480, h)
        for j, ln in enumerate(lines): c.drawString(78, y - 10 - j * 10 - (0 if len(lines) == 1 else 1), ln)
        c.drawString(206, y - 10 - (h - 14) / 2, r['fleid']); c.drawCentredString(422, y - 10 - (h - 14) / 2, r['cats'][ci])
        y -= h
    c.setFont('Helvetica', 7); c.drawString(72, 40, f'Page {page}'); c.drawRightString(W - 72, 40, 'Copyright © 2026 Cambium Assessment, Inc. All rights reserved.')
c.save()
import json; (root / (pathlib.Path(out).stem + '.json')).write_text(json.dumps({ 'grade': grade, 'cats': CATS, 'rows': rows, 'skip': { str(k): sorted(v) for k, v in skip_in_cat.items() } }, indent=1))
print(out, len(rows), 'students')
