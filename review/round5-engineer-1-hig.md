# Round 5 — Engineer 1 (HIG / interaction lens): the whole project

Scope: every surface, end to end — Overview, calm/details grid, Just Unit N, unit view, Grades, student card, digest,
Race, Data Lab (all seven graph types, Points/%, stats, values), Seating (chart, room, sheet, priorities, prints,
templates, +Row/Grid/Clear dialogs), Settings, Guide, every dialog and print page. Driven with Playwright on the test
build (`python3 build.py --test`) from a state built the `tests/command-center.js` / `tests/seating.js` way: both
course-wide exports → pool gradebooks p1/p2 → period 1 accelerated, period 2 on-level, a fabricated Sep 19 history for
both, a 24-desk Partners room with a generated and saved chart. Viewports: laptop 1400×900 (mouse); Promethean
1920×1080 (`hasTouch`); tablet 1280×800 and 800×1280 (`hasTouch`, `isMobile`). Every screenshot in my scratchpad
(`r5/<vp>-NN-*.png`) was looked at; measurements are CSS px from `getBoundingClientRect` / `getComputedStyle`;
contrast ratios are WCAG-computed from the tokens in `app.html`. No page errors or console errors on any flow, on any
viewport. Findings only, most severe first; regressions from rounds 3–4 are marked **[R4-n]**.

## Findings

### 1. The board keeps its scroll position across views — Grades, Seating and the grid open mid-page
- **Repro** (any viewport): open a class, scroll the grid a few rows → tap **Grades**. Or scroll Grades to the bottom →
  tap the class crumb → tap **Seating**.
- **Saw**: `#gridwrap.scrollTop` survives the swap of its contents. Laptop: grid scrolled 400 → Grades opens at 400
  (headline cards and Categories above the fold — `laptop-17-grades.png` shows the Assignments table with the class
  average nowhere); Grades bottom → grid opens at 454; grid → Seating opens at 229 with **Generate / Fit / Save above the
  fold** and the chart's front row hidden (`laptop-20-seating-chart.png`). Tablet: 400 / 734 / 328. Portrait: 348 on all
  three. Every Grades screenshot on the tablet portrait tour opened with its cards cut (`tabp-17-grades.png`).
- **Expected**: a new surface opens at its top (the unit view already does `wrap.scrollTop = 0`); a return to the grid
  may restore the grid's own offset, but a different view must not inherit another view's.
- **Where**: `renderBar` handlers `#openGrades`, `#openSeating`, `#back`, tab `onclick` (`renderTabs`), `#btnHome` —
  none touch `#gridwrap.scrollTop`; `renderGrid` / `renderGrades` / `renderSeating` replace `innerHTML` only.

### 2. Typing in "Find a student…" on the Overview replaces the Overview with an unlabeled grid
- **Repro**: Overview → type two letters in the header search.
- **Saw** (`probe-search-home.png`): the Overview cards and charts vanish; a bare class grid (whichever class is
  `state.active`) renders under the Overview title line, filtered to the match. `body.home` stays set (so the board has no
  card/border), the **Overview** header pill stays pressed, no class tab is active, no class name is shown anywhere.
  Clearing the field leaves you there.
- **Expected**: search on the Overview either filters cards / needs-attention lines or is hidden there; it must never
  change the view without changing the chrome.
- **Where**: `$('#search').oninput = … renderGrid()` (app.js wiring); `renderGrid` with `view.mode === 'home'` falls
  into the unit branch, `units.find(u => u.name === view.unit)` is undefined, so it resets `view = {mode:'units'}` and
  re-enters — without `render()`, so tabs, `body.home` and `#btnHome[aria-pressed]` are never updated.

### 3. In the unit view the sticky footer's Points cell is painted over by the body rows — the next hidden row's number shows through
- **Repro** (every viewport): open a unit; look at the "% of class at goal" footer's Points column (or scroll a little).
- **Saw** (`crop-unit-foot.png`, `tab-08-unit.png` bottom-left): the footer's empty `td.ptsd` shows **"2"**, then
  **"15"** — the points of whichever body row is currently under the footer — and the footer's 3 px turquoise top border
  is missing on that cell. `elementFromPoint` at the footer's Points cell returns the body row's `td.ptsd`.
- **Why**: `table.grid tfoot td{position:sticky;bottom:0;z-index:5}` has specificity (0,1,3), so it beats
  `tfoot td.ptsd{z-index:7}` (0,1,2); body `td.ptsd` is `position:sticky;left:274px;z-index:6`, so body cells stack above
  the footer's Points cell. (The `thead th.ptsd` rule spells out `table.grid thead th.ptsd` and is fine.)
- **Where**: `app.html` `tfoot td.ptsd`, `td.ptsd`, `table.grid tfoot td`.

### 4. On the tablet the unit view shows one to three student rows; the calm grid shows six
- **Repro**: 1280×800 → class → tap a unit (`tab-08-unit.png`); the calm grid (`tab-03-grid-calm.png`).
- **Saw**: unit view: header card 72 + tabs 64 + folded notice 40 (99 expanded) + bar 97 (wraps to two rows) + skill
  header **208 px** (`th.skill{height:196px}` + 26 px lesson row) leaves **one full row** with notices open, three with
  them folded, for a class of 22. Calm grid: unit header 165 px (title + "out of" + Focus badge + 44 px Copy), rows 44 →
  six rows in a 475 px region. Laptop unit view with notices open: five rows. Portrait tablet: bar 148 px + the same
  header. With Details on, the bar is 123 px on the tablet and 172 in portrait; the grid region drops to 370 px.
- **Expected**: the data region is the majority of the screen on the device Croix walks around with. Fixed 196 px
  rotated skill names and a per-column Copy button in the *calm* grid are the two costs; on touch the Copy could live in
  the unit tap / ⋯, the skill names could cap at ~120 px with a tooltip-free full name on tap, and the bar should not wrap.
- **Where**: `app.html` `th.skill{height:196px}`, `th.skill .rot{max-height:176px}`, `th.unit .copy` in calm mode,
  `#bar` flex-wrap; `renderBar` unit-mode markup (legend on a second row).

### 5. **[R4-2]** The seating chart and the room stage still don't fit their region on any viewport — including the Promethean
- **Repro**: notices folded, board scrolled to top, Seating → Chart; then Room (`*-p2-seating-top.png`, `*-p2-room-top.png`).
- **Saw**, chart SVG bottom vs `#gridwrap` bottom: laptop 924 vs 867 (legend bottom 986 → 119 px below); panel 1118 vs
  1047 (legend 1150); tablet 838 vs 767 (legend 900); on every one the teacher desk, door and legend are below the fold.
  Room stage bottom vs region: laptop 895 vs 867, panel 1100 vs 1047, tablet 820 vs 767 — the **+ / − / Fit zoom
  controls are clipped** (bottom 884 / 1089 / 809). The stage keeps `touch-action:none` and pans on a one-finger drag
  over empty space, so on the tablet a swipe on the stage cannot scroll the page to reach them (the toolbar strip and the
  side gutters are the only scrollable places).
- **Expected**: the chart and stage size to the region they have (region height minus hint/legend), as round 4's fix
  intended; "chart/stage heights follow the viewport minus chrome" under-subtracts the chrome by ~60–90 px with notices
  folded and by ~160 with them open (the notices are the variable the formula ignores).
- **Where**: `app.html` `.chart-stage .chartSvg{max-height:max(320px,calc(100vh - 300px))}`,
  `.stage svg{height:max(320px,calc(100vh - 340px))}`, `@media (max-width:1000px) .chart-stage .chartSvg{max-height:60vh}`;
  `.stage{touch-action:none}`; `bindStage` pan-on-empty.

### 6. Every re-render drops keyboard focus to `<body>`; the one-observer focus return only works for openers that have an id
- **Repro**: keyboard on the grid: Tab to a points cell → Enter (unit opens) → Escape (grid returns). Tab to a Focus
  badge → Enter → Escape. Seating: Tab to a desk → Enter. Student sheet → Escape. Change *Working in*.
- **Saw** (probe3 / probe2 / tour logs, all viewports): `document.activeElement` is `BODY` after opening a unit by
  keyboard, after Escape back to the grid, after closing the Focus check (`.fcheck` has no id and the close calls
  `render()`), after closing the receipt, after closing the student sheet (`BODY.seating`), after tapping/Entering a
  desk. The student-card close returns focus to `#gradesWeights` (the row is a `tr`, not focusable — only the name button
  inside it is). Dialogs whose openers keep an id (Settings, weights, priorities, +Row, templates, digest, fixer) return
  correctly; the seating `summary` and `.txt` inputs fall back to the 1 px UA ring instead of the house 3 px ring.
- **Expected**: a view change moves focus to the new view's first control (the crumb/heading), Escape returns to the
  control that opened the unit, dialog close returns to the opener even after a re-render (re-find by a stable
  `data-*` key, or give `.fcheck`/`.rlink`/desks ids), rows that open a card are focusable.
- **Where**: `renderGrid` `[data-u]` handler, the global `keydown` Escape branch, `openFocusCheck` / `openReceipt` close
  (`render()`), `openSeatSheet` close, the `MutationObserver` in app.js (falls back to `modalOpenerId` only),
  `seating.js` desk `act`.

### 7. Touch targets under 44 px on the panel and tablet (the round-3 rule has leftovers)
- **Saw** (tablet 1280×800 and 1920×1080, `(pointer:coarse)` active): `#nToggle` status line **40**; `.fcheck` Focus
  badge **36**; `.flag` NOT IN IXL — FIX **36**; `#bar .crumb button` ‹ class **38**; `.ulink` for one-line titles
  (Unit 12/13/15/17) **41**; `.hdigest` "What changed ›" **32**; pickSection `.chip` (+ New class / class chips) and the
  fixer's 60-odd name chips **40**; `#seatSearch`, `#shNick`, `#shLast`, `#tplN`, `+ Row` number field (`.txt`, `.mini`)
  **40**; L/M/H `.seg.tiny` **38**, `.ft` **40**; Data Lab / Race `.lbTools .pill.small` (Show stats, Dots, Values,
  Outliers, **Hold to exit**) **40** — the coarse block sets `.lbTools .pill{min-height:44px}` but
  `.lbTools .pill.small{min-height:40px}` (0,3,0) wins; `#nextMax` **30**; `#toGrades` link **20**; checkboxes: skip-list
  **13×13**, `#useBest` **13×18**, `#pmAll` **17×20**; every `<input type=range>` (card slider, eight priority sliders)
  **16 px** tall with a default thumb.
- **Expected**: 44 px under `(pointer:coarse)` for anything tapped in a lesson; checkboxes 24+ with the label as the
  target; a taller slider track/thumb on touch.
- **Where**: `app.html` coarse block (missing `.nstatus`, `.flag`/`.fcheck` set to 36, `.chip`, `.txt`, `.hdigest`,
  `#bar .crumb button`, `.check input`, `.skipList input`, `input[type=range]`), `.lbTools .pill.small`.

### 8. Data Lab: the line graph's direct label is clipped, stem-and-leaf and the box-plot ticks aren't projected-size, and the tool cluster wraps
- **Saw**: line graph (All assigned units, and the Overview trend): the label "1st Period · Accelerated 14.1" runs 8–9 px
  past the SVG's right edge on **every** viewport, so it reads "…Accelerated 14." (`laptop-36-lab-line.png`); the 200-unit
  gutter can't hold label + value at 15 px. Stem-and-leaf: the whole plot is a 75 px-tall table of **15 px monospace**
  digits with a 12.5 px key, under a 58 px title, on the screen students read from their seats
  (`laptop-36-lab-stem.png`); every other graph uses `clamp()`. Box plot axis ticks are **11 px** (`.labTickTxt`) while
  the histogram/bar/dot axes are 14; the stats caps ("MIN · Q1 · MEDIAN") are **10 px**. The floating tool cluster wraps
  to two rows at 1400 (box: 106 px; "Outliers" and "Hold to exit" orphaned on row 2, `laptop-36-lab-box.png`) and to
  three rows in portrait (120 px), with the translucent pill background drawn around the ragged shape.
- **Expected**: labels fit or ellipsize inside the plot; one type scale for the projected screen (nothing under ~16 px);
  the tool cluster collapses (a single "Options" sheet or a second fixed row) instead of wrapping.
- **Where**: `charts.js` `chartLines` (`r = o.labelW || 170`, callers pass 200 with `w:900`), `.stem{font-size:15px}`
  in `charts.js` CSS, `app.html` `.labTickTxt{font-size:11px}`, `.labStats span{font-size:10px}`, `.lbTools`.

### 9. Contrast below AA on the warning pair and the soft ink
- **Saw** (computed from `:root` tokens): `--bad` #D9442F on `--coral` #FBDAD2 = **3.33:1** — used for the ⚠︎ glyph in
  every notice and the status line, `.issue.hard` text, `.chip.apart` and `.seatStu .tags i.apart` (11–12.5 px);
  `--bad` on white = **4.36:1** for `.gstu td.down`, `.ddown` (digest "−6"), `.fit .n.bad`; `--ink-soft` on
  `--paleturq` = **4.3:1** (`.dstat small`, `.cand button small`), on `--sand` = **4.18:1** (`.seatStu .tags i`,
  `.issue` text), on `--cream` 4.53 — all at 11 px. `#B26A00` (Fit "mid") on white is 4.24 but at 34 px passes large-text.
- **Expected**: 4.5:1 for text under 18 px; a darker warning ink on the coral wash (or ink on coral, as the notices'
  body text already is), and ink-soft reserved for ≥ 14 px or paired with white.
- **Where**: `app.html` tokens; `.nstatus.warn span`, `.notice>span:first-child`, `.issue.hard`, `.chip.apart`,
  `.gstu td.down`, `.ddown`, `.dstat small`, `.seatStu .tags i`.

### 10. Grid headers: ragged titles, clipped titles, unreadable lesson headers
- **Saw**: with `vertical-align:bottom` the unit names sit on three different lines when columns carry different extras
  — "Unit 1" top 281, "Unit 2" 308, "Unit 3–9" 344 on the laptop (296/338/386 on touch) — because the Focus badge and
  "now · out of" push their own column's title up (`laptop-03-grid-calm.png`). Unit titles are cut by `max-height:2.4em`
  mid-word with no ellipsis ("Solving Multi-Step Problems with", "Solving Problems with Rational"). In the unit view the
  lesson row shows "1.1 REWRITING NU…", "1.2 CONVE…", "1.6 …" — `max-width:0` + ellipsis over 1–3 skill columns; the
  full name lives only in `title`, which touch never shows.
- **Expected**: titles aligned to one baseline (badges below, in a fixed-height slot), ellipsis on the second line, and
  lesson names readable on tap (or the lesson number only, with the name in the unit bar on tap).
- **Where**: `renderGrid` unit header markup; `app.html` `th.unit .ulink .s{max-height:2.4em}`,
  `table.grid thead tr.lessons th{max-width:0;text-overflow:ellipsis}`, `th.unit{vertical-align:bottom}`.

### 11. Dialog manners are inconsistent across the app
- **Saw**: primary action on the **right** in Settings and category weights (footer, Cancel · Save) but on the **left**
  in the student card (Print report · Close), digest (Print · Close), custom data set (Save · Cancel), +Row / Grid
  (OK · Cancel), Clear desks (Clear desks · Cancel), Focus check, receipts. `seatAsk` still says **OK** (round-4 #9 asked
  for the verb). Cancel reads "Cancel", "Close", "Done", "Not now", "Skip this file", "Keep the guesses". Settings,
  imports and Copy still use native `confirm()` **nine times** (Remove class, Clear all, remove gradebook, delete data
  set, discard roster, older export ×2, apply course settings, copy zeros) after Seating replaced its own with
  `seatConfirm`. Toasts (`z-index:80`) float over open dialogs (`z-index:60`) and aren't cleared when a non-private
  dialog opens — "CSV saved" sat on the Focus check and the Still-owed chooser (`laptop-11-focus-check.png`,
  `tab-13-still-owed.png`). Non-private backdrops (6 px blur, 45 %) leave the roster names behind Settings / Focus check
  faintly legible.
- **Expected**: one footer pattern (secondary left, primary right, verbs), one confirm component, toast hidden or moved
  while a dialog is open.
- **Where**: `openStudentCard`/`openDigest`/`openCustomEditor`/`seatAsk`/`seatConfirm` markup; `confirm(` in
  `openSettings`, `importFiles`, `copyUnit`; `toast()` / `#toast` z-index.

### 12. Guide copy is out of date and the three print pages use three typefaces
- **Saw** (`probe-guide.png`): "Data Lab — box plots of any unit…" (it has seven graph types); "Still owed — Open the
  class chip, tap Still owed" (it's behind ⋯ in the calm grid, and the guide never mentions ⋯, Details, Overview,
  What changed or Just Unit N); "Clear all Tally data" matches Settings but the drop zone says "Clear everything"; the
  guide's on-screen Print button is the browser default (`<button>` with UA styling). The guide page is Arial, the student
  reports are Georgia body + sans headings, the seating/still-owed prints are the system sans; the app is DM Sans.
- **Expected**: the guide lists today's surfaces; prints share one type family (Arial/Georgia are fine for ink but pick one).
- **Where**: `openGuide` (app.js), `printStudentReports`/`studentReportSection` (grades.js), `printSeating`, `printStillOwed`.

### 13. The class bar wraps on every device but the panel
- **Saw**: grid bar with Details on: 99 px laptop (Seating / Working in / ⋯ / legend on a second row,
  `laptop-06-grid-details.png`), 123 tablet, 172 portrait; Grades bar 89 / 96 / **174** (four rows: crumb+title, meta,
  weights pill, Categories + hint); unit bar 91 / 97 / 148 (legend on its own row); Seating bar 59 / 65 / 123 with
  "Priorities" alone on a second row in portrait. Each wrap costs the data region a row of students.
- **Expected**: the meta line and hints move into the crumb line's tooltip/Details, the legend into ⋯, and the bar stays
  one row (two in portrait).
- **Where**: `renderBar` (units/unit/grades modes), `renderGradesBar`, `renderSeatingBar`; `#bar{flex-wrap:wrap}`.

### 14. Room editor: still-open round-4 P2s and small things
- **Saw**: selecting a desk inserts the 48–56 px `.selbar` above the stage and the canvas jumps down under the finger
  (laptop 422 → 480; **[R4-11]**, listed as P2, not in the "done" list); the room toolbar has two filled-teal primaries
  ("Templates", "+ Desk") next to pale ones; desk numbers, "DOOR" and "Teacher" are 7–10 px SVG text; the Seating bar
  reads "saved Sep 27" while the working chart has unsaved swaps (only the Save button's state says so). Grid… still
  pre-fills 4 × 6 regardless of roster size. Chart names on the tablet: `.cname` 11 units → **~9.5 px** rendered
  (12 on the laptop, 18 on the panel) — **[R4-5]** partially addressed; the initials carry the chart.
- **Where**: `renderRoom` selbar, `.room .toolbar` pill classes, `SEAT_SVG_CSS`, `renderSeatingBar`.

### 15. Small text and nested `<small>`
- **Saw**: `small` inside `small` compounds to **9.17 px** — the student card's sparkline caption "Sep 19 → Sep 27"
  and the seating list's standing badge line; `.planTag` 10 px; `.labStats span` 10 px; the Race's portrait `lbPct small`
  8.4 px; `--t-xs` 11 px is used for the unit "out of" line, Focus badges, the legend, chips and hints on the tablet
  (11 px at arm's length). Toast "Undo" button is 63×29 on every device.
- **Where**: `.stuspark small`, `.seatStu .tags i.st`, `.planTag`, `.labStats span`, `.tundo`.

## What's solid
- No page or console errors on any flow or viewport; every action re-renders the board exactly once (no double
  paint or flicker on tab change, Working-in change, skips, seat moves).
- Dialog basics from round 3 hold: focus lands on the panel (not an input) on touch, Tab is trapped, Escape closes,
  the dialog is named by its heading, and openers with ids get focus back; the ⋯ menu overlay swallows the outside tap,
  arrows move between items, Escape returns to ⋯.
- Sticky headers/columns in both grids stay put on scroll (thead at 0, `.stu` at 34, `.ptsd` at 274) — only the
  footer's Points cell (finding 3) misbehaves.
- The desk-tap response is in view when the board is at its top on all four viewports (round-4 #3 fix holds); the bar
  and Print no longer go stale after Generate/Save (round-4 #7); the hover target draws; the fit doesn't collapse on
  Save (66 → 66); room `.ib` controls, chips and `summary` are 44 px on touch and every icon button has a label.
- Names off masks every surface I scanned (grid, notices, tabs, Overview, Grades, seating chart/list/sheet, toasts),
  the Race and Data Lab carry no names, and the student card / sheet / digest use the private backdrop and clear toasts.
- Header pills, tabs, class cards, unit links, cells, menu items, `.cand` buttons and the room's icon buttons are all
  44 px on touch; the header wraps cleanly to two rows in portrait; no horizontal page overflow anywhere except the grids'
  own scroll region.
- The visual system is consistent where it's applied: one radius family (16 / 20 / 999), two shadows, DM Sans
  everywhere on screen, the class colour follows the class through tabs, cards, Race and Lab rows, and the Overview,
  digest, card, Still-owed chooser and seating prints read as one product.
