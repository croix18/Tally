# Command center — calm by default, more graphs

Croix's complaint (26 Sep): opening Tally is visually noisy; hard to see anything. And the Data Lab only draws
box plots. Decisions: open to an **Overview** of all classes; **calm by default with a Details toggle**;
add the **7th-grade graph set** for students plus **teacher trend and comparison charts**.

## Overview (home)
`view.mode = 'home'`, reached from an "Overview" button in the header and on load. One card per class:
label · students · IXL % complete of assigned work with change since the previous import · Focus average
and letter counts · missing work · sliding · Focus check (✓ / N off / none) · export age. A **Needs
attention** list (roster mismatches, Focus mismatches, waiting for a pool, old exports, unproved categories)
with one line each, tap to jump. Below: **class average by import** (one line per class), **IXL work at goal
by class** (bars), **letters by class** (stacked bars). Tap a card to open that class's grid.

## Calm grid
- Notices fold into one status line ("2 need attention ▸"); tap to expand; a ✓ line when all is well.
- Class tabs show the label only; students/date move to the card and to Details.
- Bar: name · Working in · Just Unit N · Grades · ⋯ menu (Still owed, unassigned units, CSV, legend).
- Unit headers: number, title, out of N, Copy. Focus badge as a small ✓/! dot; "now"/"upcoming" as a tint.
- **Details** toggle (`settings.details`) restores the full notices, meta, badges and legend everywhere.

## Graphs
Primitives in `charts.js`, plain SVG. Colour by meaning (changed 4 Oct 2026, see NOTES.md "Chart colours"):
letter grades A green / B blue / C yellow / D orange / F red (`LETTER_COLORS`, the `--g-*` tokens); how much is
done, red → green (`QUARTER_COLORS`); a class's own plot in that class's colour (`--cc`); class-vs-class in the
validated categorical order (`#2a78d6 #eb6834 #1baf7a #eda100 #e87ba4`, always direct-labeled); teal only where
there is no class. Thin marks, `<title>` tooltips, a legend for ≥2 series, text in ink never in series colour,
and no mark that relies on colour alone (`tests/colors.js`).

Data Lab "Show as": **box plot** (existing) · **dot plot** · **histogram** (bin size chooser) · **stem-and-
leaf** · **bar graph** (how many students at each value) · **circle graph** (share of the class in
quarters of the maximum, or at goal / below / not started for a skill) · **line graph** (class average
by import date — for "All units" and gradebook data sets). Same reveal-stats, names-free, one row per class.

Teacher charts: on the Overview (above); on Grades, class average and missing-work lines across imports and
per-unit completion bars. Comparison: classes share axes everywhere; the Overview lines put every class on
one chart; the Race keeps its own ranking.
