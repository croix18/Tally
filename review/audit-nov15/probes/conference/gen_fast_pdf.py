# Edge-case score-report PDFs in the geometry of fixtures/make_fast_items_pdf.py (Total table, then category pages).
# usage: python3 gen_fast_pdf.py spec.json out.pdf   spec: {grade, pm, year, cats:[..], rows:[{name, fleid, scale, level, pct, cats:[..]}]}
import json, sys
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
spec = json.load(open(sys.argv[1])); out = sys.argv[2]; grade = spec['grade']
c = canvas.Canvas(out, pagesize=letter); W, H = letter
def wrap(name, n=22):
    if len(name) <= n: return [name]
    cut = name.rfind(' ', 0, n); cut = cut if cut > 0 else n
    return [name[:cut], name[cut:].strip()]
def title():
    y = H - 60; c.setFont('Helvetica', 11); c.drawString(72, y, f'Score, Achievement and Points Earned on Grade {grade} FAST Mathematics'); y -= 14
    c.drawString(72, y, f"({spec['pm']} {spec['year']}) of All Rosters, by Student and Reporting Category: , 2026-2027"); y -= 14
    c.setFont('Helvetica', 9); c.drawString(72, y, f"Filtered By  Rosters: All Rosters  |  Test Reasons: {spec['pm']} {spec['year']}  |"); return y - 24
def head(y, lab):
    c.setFont('Helvetica-Bold', 8); c.rect(72, y - 16, 130, 16); c.drawCentredString(137, y - 11, 'Student'); c.rect(202, y - 16, 90, 16); c.drawCentredString(247, y - 11, 'FLEID'); c.rect(292, y - 16, 260, 16); c.drawCentredString(422, y - 11, lab); return y - 16
y = head(title(), 'Total')
for r in spec['rows']:
    if y < 90: c.showPage(); y = head(H - 60, 'Total')
    lines = wrap(r['name']); h = 14 if len(lines) == 1 else 24; c.setFont('Helvetica', 8); c.rect(72, y - h, 480, h)
    for j, ln in enumerate(lines): c.drawString(78, y - 10 - j * 10 - (0 if len(lines) == 1 else 1), ln)
    m = y - 10 - (h - 14) / 2; c.drawString(206, m, r['fleid'])
    if r.get('scale') is not None: c.drawCentredString(327, m, str(r['scale']))
    if r.get('level') is not None: c.drawCentredString(427, m, f"Level {r['level']}")
    p = r.get('pct'); c.drawCentredString(512, m, 'n/a' if p is None else ('<1' if p == 0 else str(p)))
    y -= h
for k, cat in enumerate(spec['cats']):
    c.showPage(); y = head(H - 60, cat)
    for r in spec['rows']:
        if y < 90: c.showPage(); y = H - 60
        if not r.get('cats'): continue
        lines = wrap(r['name']); h = 14 if len(lines) == 1 else 24; c.setFont('Helvetica', 8); c.rect(72, y - h, 480, h)
        for j, ln in enumerate(lines): c.drawString(78, y - 10 - j * 10 - (0 if len(lines) == 1 else 1), ln)
        m = y - 10 - (h - 14) / 2; c.drawString(206, m, r['fleid']); c.drawCentredString(422, m, r['cats'][k]); y -= h
c.save()
