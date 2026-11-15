# Auditor CHT: charts, the Data Lab, the Race and the Board   (tag CHT, directory /home/claude/work/audit/charts/)

These are shown to 7th graders learning statistics. Every statistic, mark, axis and label must be right.

## Scope (read all of it)
- charts.js, all of it.
- app.js 899-1628: stats, labDatasets, labSeries, labPool, labMatch, labPickFor, labCmpFor, labMarkup, pieParts, the
  two-course comparison, "IXL and a test" (corrXs, corrYs, corrPick, labCorrMarkup), full screen; leaderboardData
  (756) and renderLeaderboard (1512); boardFile (about 2741) as far as what the Board draws from a Board save.
- grades.js: pearson and scatterSVG (you own the geometry; the grades auditor owns the pairing).

## Oracle
Your own statistics: mean, median, mode(s), range, quartiles by the method Tally uses (find where the Guide or
NOTES.md states it: the median of each half, leaving the median out when n is odd; confirm that this is the method
Florida's B.E.S.T. standards teach in grades 6-7), IQR, the 1.5 x IQR outlier rule, histogram bins, stem-and-leaf,
frequency tables, circle-graph shares, the least-squares line and r. Compare with every figure printed on every chart
form, for every kind of data set (a unit, all assigned units, the quarter's IXL, one skill, a gradebook assignment,
the course grade, the class's own data) x Points and % x each class, a whole course, one class beside the course, both
courses. Random data, including n = 5 (the minimum), all values equal, two distinct values, heavy ties, zeros,
maximums, decimals (gradebook scores such as 8.5), missing and excused scores.

## Geometry: prove each mark sits where its value says
Parse the SVG. Box plot: the box, whiskers, median and outlier marks against the axis scale. Dot plot: x positions and
stack heights equal the frequencies. Histogram: bar heights proportional to counts; the bin edges as labelled (which
end is inclusive, and does the label say so?); every value in exactly one bin; the maximum included. Stem-and-leaf:
leaves sorted, the leaf count equals n, the key true for the data shown (is "1 | 3 means 13" true in % mode, for
values of 100 or more, for decimals that were rounded: is the rounding disclosed?). Circle graph: slice angles
proportional; labels on the right slices; the percent labels: is each the correctly rounded share, and do they add to
100? (A pie reading 39 % + 9 % + 53 % = 101 % was seen on 15 Nov. Decide whether that is a defect for a class learning
circle graphs, and what the honest fix is.) Slices too small to label. Line graph: points against dates (are uneven
gaps between dates drawn as even, and does the axis say so?); the y axis range and ticks (niceMax). Bar graph: a zero
baseline. "n =" equals the number of marks. Class averages: for a whole course, the mean of the students, not the mean
of the class means: which is it, and what does the label say? The Tukey note (an IQR of 0 or 1 switches the rule
off). The percent toggle: percent of what (each student's own list?). All rows drawn to one scale.

## The Race
Ranked by the share of students who moved up since the league's shared baseline import; average gain breaks ties.
Recompute with your own code over synthetic histories: classes with different import dates, a class with no baseline,
students who joined later, a tie on both measures, the "furthest along" tag, what the screen says about each.

## Privacy on the Board
No name, ID or identifying string in the DOM, titles, aria, data attributes or file names of the Race and the Data
Lab. MIN_N = 5: a class, a pooled group or any subset below 5 is never drawn in any form (try every data set and every
chart form). On the Board, "IXL and a test" must not let a dot name a student (on Grades, teacher-only, it does).
