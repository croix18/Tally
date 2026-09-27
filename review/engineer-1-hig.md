# Engineer 1 — interface & interaction review (HIG lens), round 3

Date: 27 Sep 2026. Test build (`python3 build.py --test`). Driven with Playwright/Chromium from a scratchpad copy of
the `tests/` harness patterns. State: both course pools + `focus_gradebook_pool_p1/p2.csv` → 1st/2nd period, then
3rd (acc) and 4th/5th (on-level) cloned from them with a fabricated 19 Sep snapshot so every class had history.

Viewports: laptop 1400×900 (mouse); Promethean 1920×1080 (`hasTouch`); Samsung tablet 1280×800 and 800×1280
(`hasTouch`, `isMobile`). Every screen was screenshotted and looked at; hit-targets, overflow, focus and contrast
were measured in-page. Contrast figures below are WCAG ratios computed from the token values in `app.html`.

No page errors on any viewport in any flow. Findings are ranked most severe first.

---

## 1. Data Lab does not fit the projected panel with three classes and stats open — and the floating toolbar sits on top of the third class
**Severity: high** (this is the screen students look at)

Repro: Race → Data Lab → On-level (3 classes) → "Show stats" twice (level 2) → each "Show as".

Measured `#lb` scrollHeight vs viewport:

| kind | 1920×1080 | 1400×900 | 1280×800 |
|---|---|---|---|
| box (+dots) | 1408 | 1338 | 1425 |
| dots | 1133 | 1086 | 1201 |
| histogram | 1466 | 1391 | 1472 |
| stem-and-leaf | 1110 | 1110 | 1281 |
| bar | 1466 | 1391 | 1472 |
| circle | 1120 | 1120 | 1291 |
| line (all units) | 1080 ✓ | 900 ✓ | 810 |
| box + Values | 1663 | 1593 | 1667 |

Only the line graph fits at 1080; nothing fits at 900. Each row is 377–396 px at panel width because every plot is
a fixed 800-unit `viewBox` drawn at `width:100%; height:auto` (`.labSvg`, `.chart`), so on a wider screen the plot
gets *taller*, not just wider — the box plot's 34 px box becomes ~50 px, the axis text becomes 16 px, and the
stats strip adds ~80 px under it. At the same time `.lbTools` is `position:fixed` with no background: on the panel
it is 1403 px wide and 46 px tall and floats across the bottom of the third class's chart (see `panel-lab-box.png`,
`panel-lab-hist.png`: the "3" tick label pokes out between the select and a pill). A teacher scrolling to show the
third class has the toolbar permanently over it.

Expected: three classes with stats visible on one 1080 screen without scrolling; a toolbar that either has its own
surface or reserves space (the `padding-bottom:96px` on `.lbWrap` only helps at the very end of the scroll).

Responsible: `app.js` `labMarkup` (row template, `labStats` strip), `labPlot`/`boxSVG` (fixed `w = 800`),
`charts.js` `chartDots`/`chartHist`/`chartFreq` (`h = 200`, `w = 800`), CSS `.labSvg`, `.chart`, `.lbTools` (`app.html`
and the duplicated `LAB_CSS`/`LB_CSS` strings in `app.js`). NOTES.md already lists "Data Lab panel fit at 900" as
not built; it fails at 1080 too.

## 2. Overview line charts: direct labels collide and are clipped; the full-width chart renders at 2× scale
**Severity: high**

Repro: Overview with two gradebook imports → scroll `#gridwrap` to "Focus class average by import" and "Missing
assignments by import" (`laptop-home-charts.png`, `laptop-home-charts2.png`).

Seen: series that end at the same value get their end labels drawn on top of each other ("3rd Period · Accelerated"
printed three times in one spot, unreadable), and the rightmost label runs past the SVG edge ("2nd Period · On-level
64" cut off). The full-width chart (`.gsec` spanning both columns) is a 640×260 `viewBox` stretched to 1306 px, so
its tick labels are ~22 px and its dots 8 px while the half-width charts beside it are 11 px — two sizes of the same
chart on one screen. With my cloned classes the collision is extreme, but any two classes within ~3 % of each other
(common: 57 % vs 58 %) will overprint, and there is no collision avoidance at all.

Expected: end labels nudged apart (or a legend when they would overlap), a right margin that fits the longest label
at the rendered scale, and charts drawn at their rendered width (`w` from the container) so text stays one size.

Responsible: `charts.js` `chartLines` (label placement `X(last[0]) + 8`, fixed `r = 150`, fixed `w = 640`);
`home.js` `renderHome` (`avgLines`, `missLines` in a full-width `.gsec`); `.chart{width:100%;height:auto}`.

## 3. Tapping outside the ⋯ menu to dismiss it activates whatever is under the finger; Escape does not close it
**Severity: high** (on the panel, "outside" is usually a student's cell)

Repro (any viewport): class grid → ⋯ → tap a grid cell (I clicked at 600,700).

Seen: the menu closes *and* the cell's action fires — the unit view opened. On the panel this will be a student
score column or, in the unit view, a per-student skip. Escape with the menu open does nothing (`menu hidden after
Escape: false` on all four viewports); focus never moves into the menu on open (Tab does reach the items, but
tabbing past the last item leaves the menu open on screen).

Expected: the first tap outside a menu only dismisses it; Escape closes it and returns focus to ⋯; arrow keys move
between items.

Responsible: `app.js` `renderBar` — `document.addEventListener('click', …, { once: true })` closes the menu but
does not stop propagation or capture; the global `keydown` handler at the end of `app.js` only handles `#modal`.

## 4. Touch targets below 44 px on every teacher control that matters on the tablet and panel
**Severity: high** (the tablet and panel are touch; these are the everyday buttons)

Measured (all viewports, calm grid unless noted):

- Bar toggles `Just Unit N`, `Grades`, `Still owed`, `Assigned`, `CSV`, `Copied …`: **32 px** tall (`#bar .pill.toggle`).
- `⋯` menu button: **45×32**.
- `Working in` `<select>`: **98×28**.
- Every `Copy` in the unit headers: **79×32**.
- Focus check badge (`Focus: points differ`, `Focus ✓`): **21 px** tall (`.fcheck`).
- Roster flags `NOT IN IXL — FIX`: **24 px** tall (`.flag`, `min-height:24px`).
- Header pills (Overview, Guide, Race, Names, Details, Settings, Import): 38 px; `#search` 36 px.
- Needs-attention rows on the Overview: 34 px.
- Unit-view score cells: 48×**38**; grid `td.pts` cells 38 px tall (both are tap targets).
- Grades screen: category `<select>` 28 px, student name buttons 20 px (the row is the target, ~30 px tall).
- Category asker segments: 32 px (`.seg.small`); new-class period buttons 45×38.
- Data Lab / Race toolbar: 40 px (close, but still under).

Expected: 44 px minimum on touch surfaces (a `pointer: coarse` media query would do it without changing the laptop).

Responsible: `app.html` CSS — `.pill.small`, `#bar .pill.toggle`, `th.unit .copy` (the "compact headers" override
block at line ~325 reduces them again), `.fcheck`, `.flag`, `.curUnit select`, `.seg.small button`, `.hatt li button`,
`table.grid td{height:38px}`.

## 5. Keyboard focus is invisible on every white surface, and the grid's tappable cells are not reachable at all
**Severity: high** (accessibility; also the laptop is keyboard-first)

Repro: laptop → class grid → Tab until `Just Unit 2` (`laptop-focus-onlyCur.png`).

Seen: `.pill:focus-visible{outline:3px solid var(--white)}` — written for the dark header — applies to every `.pill`,
so the focus ring on the bar toggles, ⋯, modal buttons (`Print`, `Close`, `Apply`, `Save`) and the Data Lab toolbar
is white-on-white: measured `outline-color rgb(255,255,255)` on `#onlyCur` and `#moreBtn` with `:focus-visible` true,
and nothing visible in the screenshot. `Copy` and the unit links fall back to the browser's default 1 px auto ring.
`td.pts` (opens the unit) and `td.sc[data-cell]` (per-student skip) are plain `<td>`s with `onclick` — `tabIndex`
none — so the per-student skip and the tap-to-open-unit path have no keyboard equivalent. The `#tabs` `role=tablist`
has no arrow-key handling and marks selection with `aria-selected` on buttons that also use `.active` styling only.

Expected: a visible ring in ink on light surfaces (the `.field input:focus-visible` rule already does this in turquoise),
and buttons (or `tabindex`/`role=button` + key handling) for the cell actions.

Responsible: `app.html` `.pill:focus-visible`; `app.js` `renderGrid` (cells with `data-u`/`data-cell`).

## 6. Dialogs never take focus, don't trap it, don't restore it, and all announce as "Settings"
**Severity: medium-high**

Repro: open the student card (Grades → row) or the digest → press Tab.

Seen: `document.activeElement` stays `BODY` after open; the first Tab lands on a header button *behind* the private
backdrop (`inModal=false` on all viewports). Escape does close (good) but focus is not returned to the row/card that
opened it. `#modal` carries a static `aria-label="Settings"`, so the student card, digest, category asker, weights
editor, fixer and new-class picker are all read as "Settings" by a screen reader.

Expected: focus moved to the panel (or its first control) on open, kept inside while open, returned on close;
`aria-labelledby` pointing at each dialog's `<h2>`.

Responsible: `app.html` `#modal`; every `open*`/`ask*` function in `app.js`, `grades.js`, `home.js` (they all set
`m.innerHTML` and handlers but never `focus()`).

## 7. Opening Settings on the tablet auto-focuses the roster textarea — the on-screen keyboard pops up over half the sheet
**Severity: medium-high** (tablet)

Repro: tablet → Settings. Measured `activeElement = TEXTAREA#roster` immediately. On the Samsung this raises the
soft keyboard on a sheet that is already 1152 px tall at 800×1280 (`tabP-settings.png`), and the two-column body
stays two columns at 800 px wide (the single-column breakpoint is `max-width:760px`), giving 315/362 px columns.
The same auto-focus happens on the roster panel (`renderRosterPanel`).

Expected: no auto-focus on coarse-pointer devices; one column at ≤ 800 px.

Responsible: `app.js` `openSettings` (`rosterEl.focus()`), `renderRosterPanel` (`ta.focus()`); `@media (max-width:760px)`.

## 8. A single tap on a score cell silently changes a student's total (per-student skip)
**Severity: medium-high** (touch)

Repro: tablet → unit view → tap any score cell (`tabL-unit-touch-celltap.png`).

Seen: one tap on a 48×38 cell in a horizontally scrolling table toggles "skipped for this student" and the student's
"out of" drops (`their Unit 1 is out of 22`); the only feedback is a 4-second toast that itself covers the footer and
the bottom-right of the grid. A finger that lands while panning the table does this. There is no undo other than
finding the same cell again; the hatch pattern is the only lasting indicator.

Expected: a deliberate gesture (long-press, or a tap that opens a small confirm sheet naming the student and skill),
and a toast with an inline Undo.

Responsible: `app.js` `renderGrid` (`[data-cell]` handler); `toast` (`pointer-events:none`, no actions).

## 9. The calm grid still shows a Copy button on every upcoming unit — nine identical loud buttons
**Severity: medium**

Repro: 1st period grid, Working in Unit 2 (`laptop-grid.png`).

Seen: Units 3–9 are "upcoming · out of N" with every cell at 0, yet each header has the same turquoise-bordered
`Copy` as the current unit. In a screen whose stated goal is calm, the nine Copy buttons are the most saturated
elements on it, and copying an upcoming unit into Focus is never the intended action. The Focus badge (`Focus:
points differ`) — the one thing that *is* actionable — is a 21 px chip.

Expected: Copy only on assigned units (current and earlier) in calm mode, or behind the unit's header tap; the
Focus badge at least as prominent as Copy.

Responsible: `app.js` `renderGrid` (unit header template), CSS `th.unit .copy`.

## 10. Warning dot on class tabs is invisible (1.3:1) — the only "needs attention" signal on the tab row
**Severity: medium**

Repro: any grid with a mismatch; look at the tab row (`laptop-grid.png`, top).

Seen: `.tab.warn::after` is a 10 px dot in `--coral` (#FBDAD2, the *wash*) with a white border on a white tab —
contrast 1.31:1 against white. It reads as a rendering artefact. The old coral was the ink; the token was
repointed to the wash without updating this rule.

Expected: the dot in `--bad` (#D9442F, 4.6:1 on white), or a count.

Responsible: `app.html` `.tab.warn::after` (also `.tab .m` is hidden in calm mode so the tab carries no other cue).

## 11. Letter-grade stacked bars: white counts on the C and D segments are unreadable
**Severity: medium**

Repro: Overview → "Letter grades by class" (`laptop-home-charts2.png`).

Seen: counts are drawn in white (`.chart .inv`) on `LETTER_COLORS.C` #5FBFB5 (2.2:1) and `D` #B9E5DF (1.4:1);
the "3" on the D segment is essentially invisible. Also the F colour is the *old* coral `#FF7F6A` (2.5:1 with white).
Same white-on-yellow problem is latent for series slot 4 (`#eda100`, 2.2:1) anywhere `chartStacked` uses
`seriesColor`.

Expected: ink-coloured labels on light segments (or a ≥ 3:1 rule that flips the label colour per segment).

Responsible: `charts.js` `chartStacked` (`class="inv"`), `LETTER_COLORS`.

## 12. Projected type sizes are too small to read from seats
**Severity: medium** (panel)

Seen on 1920×1080 Data Lab: stats labels `.labStats span` **10 px**; axis ticks `.labTickTxt` **11 px** and
`.chart .tl` 11 px; circle-graph legend `.lbl` 12.5 px; `Q1 2` / `median 5` labels 12 px; stem-and-leaf hint
`.ghint` 12.5 px. On the Race, `% MOVED UP` is 0.28em of the headline (~18 px) — fine — but the assigned-units
line `.lbBasis` is 12–15 px. These are teacher-UI sizes on a screen read from 8 m.

Expected: nothing under ~18 px on `#lb`; the SVG text should be sized in the rendered coordinate space, not the
`viewBox` (see #1 — today it is only legible on the panel *because* the SVG is scaled ×1.5, which is what breaks the fit).

Responsible: `app.js` `LAB_CSS`, `charts.js` `CHART_CSS`, `lbMarkup`.

## 13. Circle graph: old palette, near-identical slices, and mislabelled ranges
**Severity: medium**

Repro: Data Lab → circle graph (unit data set; then a skill data set) (`crop-circle2.png`, `crop-circle.png`).

Seen: slice colours are hard-coded `#D8C5A0`, `#E6D5B8`, `#40E0D0`, `#127A85` — the pre-paper-and-ink turquoise
and two tans that are almost indistinguishable ("Below goal" vs "Not started" on a skill set; "Under a quarter" vs
"A quarter to half" on a unit). Colour is the only encoding besides the legend count. The range labels overlap:
for a unit out of 10 the legend says `0–2 of 10`, `3–5 of 10`, `5–7 of 10`, `8–10 of 10` — 5 appears in two buckets
and the actual bucketing (`floor(v/max*4)`) puts 5 in the third. The chart is also capped at 460 px (`.chart.circle`)
so on the panel it occupies a quarter of a 1400 px row with the rest empty.

Expected: house tokens (teal ramp like `LETTER_COLORS`, or the class colour), clearly stepped lightness, correct
integer ranges (`3–4`, `5–7`), and a size that uses the row.

Responsible: `app.js` `labPlot` (circle branch, `rng`), `charts.js` `chartCircle`, `CHART_CSS .chart.circle`.

## 14. Native `confirm()` used to choose initials vs names for the Still-owed print
**Severity: medium**

Repro: ⋯ → Still owed (print).

Seen: a browser `confirm` whose *Cancel* means "full names". On the panel this is a Chrome OS system dialog in a
different typeface, and Cancel-as-a-choice is a classic error path (Escape = full names on a projected screen).

Expected: a two-button sheet in the app ("Initials" / "Full names" / Cancel) — the `.choice` pattern already exists.

Responsible: `app.js` `openStillOwed`.

## 15. Toasts carry too much, can't be read in time, and cover the grid
**Severity: medium**

Repro: Copy a unit (`crop-toast-laptop.png`); tap a cell in the unit view.

Seen: "Unit 1 copied — 23 rows in FOCUS order · FOCUS title: IXL Unit 1 · Sep 26 · /23 · 1 blank row (not in IXL)
· 1 student o…" — six facts, one of them consequential (a blank row), in a 3.2 s pill that wraps to two lines,
has `pointer-events:none` (can't be dismissed or tapped) and sits over the footer/bottom-right cells. The
Working-in toast runs 5 s with the unit range rule in it.

Expected: one-line toasts for confirmations; consequential facts (blank rows, students left out) in a persistent
place (the receipt, or the Focus badge), and a toast that can be swiped/tapped away.

Responsible: `app.js` `copyUnit` (message), `toast` (`#toast` CSS).

## 16. Dialog headers uppercase the subtitle into the title
**Severity: low-medium**

Seen: `PRYOR, GREER 1ST PERIOD · ACCELERATED · FOCUS OF SEP 27`, `WHAT CHANGED · 1ST PERIOD · ACCELERATED SEP 19 →
SEP 26` — the `.hsub` span is meant to be secondary but `#modal header h2{text-transform:uppercase; letter-spacing:
.08em}` uppercases it too, and there is no separator between name and class. Uppercase tracking on a student name
also makes `MCDONALD`-style names harder to read.

Responsible: `app.html` `#modal header h2`, `.stucard .hsub` / `.hsub` used in `grades.js` `openStudentCard`, `home.js` `openDigest`.

## 17. Digest name lists are ambiguous because the separator is the same comma the names contain
**Severity: low-medium**

Seen (screen and print): `Sliding: PRYOR, GREER −6 → 35, UNDERHILL, ELLIS −6 → 65, ASHBY, QUINN …`. A reader has
to parse "35, UNDERHILL, ELLIS" to find the boundary.

Expected: one item per line, or a ` · ` separator, or `First Last` order in prose.

Responsible: `home.js` `digestMarkup` (`names()` joins with `', '`).

## 18. "What changed ›" is a clickable span nested inside the card button
**Severity: low-medium**

Seen: `.hchip.act[data-digest]` is a `<span>` inside `<button class="hcard">` — interactive content inside a button is
invalid and unreachable by keyboard (Tab lands on the card; Enter opens the class, never the digest). It is also styled
identically to the status chips beside it (`Focus ✓`, letter counts) except for colour, so it is not obviously a control.

Responsible: `home.js` `renderHome` (card template).

## 19. Overview scroll region clips the last card mid-way with 70 px of blank paper beneath
**Severity: low**

Seen at 1400×900 (`laptop-home.png`): the 5th card is sliced at y≈826 by `#gridwrap`'s overflow while `#board`'s
32 px bottom margin plus the body's 20 px leave empty paper under the cut. Because `body.home #board` is transparent
there is no visible container edge to explain the clip; it reads as a broken card.

Responsible: `app.html` `body.home #board` / `#gridwrap{overflow:auto}` (the clip should be the viewport edge on the
Overview, or the board should keep a visible edge).

## 20. Details-view bar wraps into two untidy rows; Just-Unit-N stretches one column across the board
**Severity: low**

Seen: with Details on, `#bar` wraps (`crop-details.png`): Working-in and ⋯ drop to a second line to the left of the
legend text, so ⋯ is no longer at the trailing edge. With Just Unit N on (`laptop-grid-justunit.png`) `table.grid
{min-width:100%}` stretches the one unit column to ~1070 px with numbers centred in it.

Responsible: `app.js` `renderBar`; `app.html` `table.grid{min-width:100%}`.

## 21. Roster flag truncates the student's name
**Severity: low**

Seen (tablet portrait): `QUILL, DAK…  NOT IN IXL — FIX` — the fixed 240 px student cell gives the flag priority over
the identifier. Responsible: `app.js` `renderGrid` `nameCell`, CSS `.stuname`/`.flag{flex:none}`.

## 22. Histogram at bin 1 draws an extra empty `10–11` bin and reads integer scores as ranges
**Severity: low**

Seen (`panel-lab-hist.png`): axis runs 0…11 for data out of 10 (`nb = ceil((max+0.0001)/bin)` adds a bin for the
maximum) and a bar labelled `2` spans 2–3, which 7th graders will read as "between 2 and 3" for integer points.
Responsible: `charts.js` `chartHist`.

---

## Visual system — paper-and-ink consistency

The redirection to warm paper, hairline cards and soft shadows is real on the Overview, grid chrome, Grades and
modals. Where it hasn't reached:

- **Bright turquoise is still the dominant hue in several places.** `.lbCard.r1{background:var(--turq)}` paints the
  entire leading Race card (the largest single surface in the app) #2DD4BF; `td.sc.pass` paints every at-goal cell
  in the unit view; `.seg button.on`/`.chip.on` (Settings has ~10 of them lit at once, `tabP-settings.png`); the
  `.pill` primary (Import, Print, Save, Apply, `#launch`); `.catbar .bar i` and `.labDot`/`.labMean`/`.chart .dot`
  data marks; `th.unit .copy` borders ×9; `.ulink .t` and `.crumb button` underlines; `.nstatus` 2 px border even in
  the all-good state; `#toast` border; `tfoot` border-top; `.labChips span.q` border; `.report li button` border;
  `.scatter .pt` fill. The notes say the bright accent is for "brand, primary buttons, active states"; data marks,
  table cells, underlines and card backgrounds are none of those.
- **Hard-coded colours that bypass the tokens:** `charts.js` circle slices `#40E0D0 #127A85 #D8C5A0 #E6D5B8`;
  `LETTER_COLORS.F` `#FF7F6A` (old coral); `.gcard .down`, `.gstu td.down`, `.ddown` use `#B3412B` instead of `--bad`;
  `table.grid tbody tr:hover td{background:#FBF8EF}`; `body.dragging #drop` `rgba(216,246,241,.6)`;
  `#modal` backdrop `rgba(23,50,77,…)` (the old navy, not `#16213A`). The export page in `downloadLeaderboard`
  re-declares the palette inline.
- **Contrast (measured):** turquoise dots/marks on white 1.9:1 and the category bar fill on its track 1.5:1 — both
  under the 3:1 non-text minimum, and these are the marks students read; warn dot 1.3:1 (#10); white on C/D/F
  segments (#11); `--bad` on the coral wash 3.3:1 for the ⚠︎ glyph (icon-sized, borderline); `--ink-soft` on
  `--paleturq` 4.3:1 for quiet cells inside the current-unit column (just under 4.5). Everything else passes:
  teal on white 5.5, teal on paleturq 4.8, ink-soft on white 4.9, navy on turquoise 8.6.
- **Colour-only meaning:** rank-1 Race card (colour is the only difference from rank 2 besides the trophy, which is
  hidden on ties); `td.pts.full` teal vs `.zero` grey (weight also differs — acceptable); circle slices (#13); the
  letter chips `D`/`F` on sand vs others on paleturq; `.gasg tr.differ` coral cell with no text cue in the row
  (there is a small "Focus disagrees" label — fine); class colour as an 8 px left border on Data Lab rows (with the
  label, fine).
- **Radii:** 13 distinct values in `app.html` (999, 50 %, 24, 20, 18, 16, 14, 12, 10, 8, 6, 5, 4, 3). Surfaces alone
  use four: `--r` 16 (cards, board, header), 20 (modal, `.lbCard`, `.labRow`, `#empty .how`), 14 (notices, `.nstatus`,
  `.more .menu`), 12 (`.dstat`, `.choice`, `.report`). One surface radius and one control radius would settle it.
- **Shadows / elevation:** warning notices carry `--shadow-2` (they float) while info/soft notices don't — a warning
  is not a raised surface; `.lbCard`/`.labRow`/`.more .menu`/`#empty .how` all use `--shadow-2` (the "hover/popover"
  shadow) at rest while the same kind of card on the Overview uses `--shadow-1`. `#launch:active{transform:
  translate(3px,4px)}` is the old hard-shadow press idiom with the hard shadow removed. No hard shadows remain.
- **Typeface in print pages:** Georgia/Arial rather than DM Sans — a deliberate print choice, but the "Still owed"
  page's `.bar` Print button is unstyled system UI; fine for a print page.
- **Two white "pressed" pills in the header mean different things:** `Overview` (a location, `aria-pressed`) and
  `Names` (a state: pressed = names showing). `aria-current="page"` for Overview would separate them; the Names
  toggle's pressed state showing *names visible* on a shared screen is the risky direction to make look "on".

---

## What is solid

- The projected lock works: Escape does nothing in `#lb`, a quick tap on the exit pill does nothing, a real 1.5 s
  touch hold (CDP touch events) exits, names are forced to initials on entry and stay hidden after exit, no
  `LAST, FIRST` string appears on the Race or Data Lab, and non-lab toasts are suppressed while projecting.
- Private backdrop on the student card and digest is genuinely opaque enough (`rgba(248,242,228,.94)` + 24 px blur);
  backdrop tap closes; × is 44 px; Escape closes every dialog.
- No horizontal page overflow on any of the four viewports on any screen; the grid's sticky index/name columns and
  sticky header/footer hold up on the tablet in both orientations; the header wraps cleanly at 800 px.
- The student print page and the digest print page are clean, one and two pages, serif body / sans headings, with
  the "if turned in →" column exactly where a parent looks. Still-owed pages break per student (`break-inside:avoid`).
- The copy flow on the touch tablet worked without the clipboard permission (execCommand path) and reported the
  blank row.
- Class colour is consistent across tabs, cards, Race, Data Lab rows and charts; the categorical palette is
  distinguishable and direct-labelled on the bar chart.
- The calm status line, ⋯ menu and Details toggle do reduce the grid to one warning line + one bar; the Just Unit N
  toggle and Working-in selector persist per course and re-render instantly.
- Tab order through header → tabs → status line → bar controls is logical; tabs themselves are 44 px.

Screenshots and harness are in `/tmp/claude-0/-home-claude/b89b0f3d-86a2-5e43-8a51-10fb416b8565/scratchpad/`
(`shots/<viewport>-<screen>.png`, `r1.js`–`r4.js`, `seed.js`).
