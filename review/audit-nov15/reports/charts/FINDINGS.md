# CHT findings (auditor's report, condensed by the orchestrator from its final message; probes are in probes/)

### CHT-01  A histogram in bins of 1 folds the maximum into the bar below it
- Class: WRONG-NUMBER · Severity: High · Where: charts.js chartHist (line 102: nb, range()); app.js histTop (line 1381)
- Claim: auto bins are 1 for any maximum of 10 or less; bins are [lo, lo+1) with the last closed at max, so for max 10 there are bars 0-9 and the 10s are counted in "9" (label not "9-10"). "9: 9 students" = 5 at 10 + 4 at 9.
- Repro: probes/01-hist-top-bin-merged.js · Suggested fix: whole numbers and bin 1 -> nb = floor(max) + 1 (one bar per value), in chartHist and histTop.

### CHT-03  In the % view an extra-credit score is drawn past the axis and miscounted in the histogram
- Class: WRONG-NUMBER · Severity: Medium · Where: app.js labMarkup (line 1124): `if (ref0 && ref0.pct) scale = 100`
- Claim: a 110% score: whisker drawn beyond the 0-100 axis; histogram counts it in "95-100".
- Repro: probes/03-pct-extra-credit-off-axis.js · Suggested fix: scale = max(100, ceil10(max value)) as points mode already does.

### CHT-02  A circle graph's percent labels can add to 99% or 101%
- Class: WRONG-INFO · Severity: Medium · Where: charts.js chartCircle (139), chartPie (159): Math.round per slice
- Claim: 3 / 3 / 10 of 16 -> 19% + 19% + 63% = 101%; about one pie in six.
- Repro: probes/02-circle-percents-sum.js · Suggested fix: largest-remainder rounding in one shared helper; tooltips keep exact shares.

### CHT-13  The Board's "as of" is the newest class's date even when another class is stale
- Class: WRONG-INFO · Severity: Medium · Where: app.js labAsOf (1068), lbMarkup (814): .sort().pop()
- Repro: probes/13-as-of-newest-class-only.js · Suggested fix: print both dates when the earliest and latest differ.

### CHT-09  The Race calls a class with weeks of history "first week in the race" and ranks it last
- Class: WRONG-INFO · Severity: Medium · Where: app.js leaderboardData (756): baseline = dates.sort()[0]; the code comment says otherwise
- Claim: a class whose first import is after the league baseline has prev = null: with four imports and +6 skills per student it reads "first week in the race", rank last.
- Repro: probes/09-race-first-week-false.js · Suggested fix: measure it from its own first snapshot with its own "since", or print "joined after <baseline>"; fix the comment. (Croix's call.)

### CHT-06  "Our own data" with decimals or negatives is misdrawn
- Class: WRONG-NUMBER · Severity: Medium · Where: charts.js chartStem (117), chartFreq (125), chartDots (89); app.js pieParts (1046)
- Claim: stem-and-leaf of 1.2, 1.5, 2.4 ... shows rounded leaves under "Key: 1 | 3 means 13"; a dot plot's axis starts at 0 with negative dots left of it; the circle graph loses negatives (q[-1]).
- Repro: probes/06-own-data-decimals-negatives.js · Suggested fix: leaf unit from the data and a true key; axis min = min(0, data min); clamp the pie index at 0.

### CHT-12  A bar graph with a maximum of exactly 26 draws each row on its own y scale
- Class: WRONG-NUMBER · Severity: Medium · Where: app.js histTop (1381) `max <= 26`; charts.js chartFreq (125) bins when items.length > 26
- Repro: probes/12-bar-26-scale-mismatch.js · Suggested fix: one shared constant (max <= 25).

### CHT-14  Quartiles and medians are shown rounded to one decimal
- Class: WRONG-NUMBER (display) · Severity: Medium · Where: app.js fmtN (988)
- Claim: Q1 = 2.25 shown as "2.3" under the chips 2 and 2.5.
- Repro: probes/14-quartile-rounded-display.js · Suggested fix: +x.toFixed(2) for quartiles and medians.

### CHT-05  Line graphs space imports evenly, whatever the days between them
- Class: WRONG-INFO · Severity: Low · Where: charts.js chartLines (54) · Repro: probes/05-line-dates-even-spacing.js

### CHT-07  DECISION: the quartile method differs from the B.E.S.T. glossary when values tie the median
- Class: DECISION · Severity: Low · Where: app.js stats (900)
- Claim: 3, 6, 9, 9, 9, 9, 9, 9, 10, 12: Tally Q1 = Q3 = 9 (halves by position); the glossary's wording ("median of the values less than M") gives 4.5 and 11.
- Repro: probes/07-quartiles-vs-best-glossary.js

### CHT-10  DECISION: the % view uses the unit's total, not the student's own list
- Class: DECISION · Severity: Low · Where: app.js labSeries (965)
- Claim: a modified-list student with all 19 of his 19 skills at goal reads 83% (19 of 23); IXL and a test and the Race count him at 100%.
- Repro: probes/10-pct-basis-own-list.js

### CHT-15  Axis ends and ticks that do not match the data (polish)
- Class: WRONG-INFO · Severity: Low · Where: charts.js chartDots, chartHist, chartLines
- Claim: dot plot max 21 last tick 20; histogram max 25 in bins of 2 ends at 26; line ticks 0, 7.5, 15, 22.5, 30.
- Repro: probes/15-axis-ends-and-ticks.js

## Suspicions (unproven)
- labPool pools points that are out of different maximums (quarter IXL with a class an export behind; custom maximums).
- The Race has no MIN_N: a class of 1-4 shows "% moved up"; "nearly all" fires whenever rest < 3.
- Mode when every value is equally frequent lists every value.

## Cleanup and hardening
- labMarkup `versus` line: dead `${isPct ? '' : ''}`; IQRs without unit or row names. downloadLeaderboard in Both mode reads st.labDots[st.labUnit] (screen uses 'both|A|O'); its filename falls back to the UTC date. boxSVG's mean tooltip and valuesMarkup's half labels lack "%" in percent mode. leaderboardData's comment does not match its code.
