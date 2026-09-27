# Round 4 — Engineer 1 (HIG / interaction lens): the Seating surface

Scope: room editor, chart, student sheet, print, the Seating bar. Driven with Playwright (test build, `tests/seating.js`
setup: two course exports + two pool gradebooks → period 1 acc / period 2 on → Seating; a 24-desk Partners room; a few
flags/plans/links set on `sec.seatInfo`). Viewports: 1400×900 mouse; 1920×1080, 1280×800 and 800×1280 with
`hasTouch`. Screenshots in my scratchpad (`r4/*.png`), looked at, not just measured. Compared with the standalone v8
tool where noted. Findings only; ranked most severe first. Measurements are CSS px from `getBoundingClientRect`.

## Findings

### 1. Saving a chart collapses its own Fit (79 → 14) — the just-saved chart is scored against itself
- **Repro**: Chart → Generate → note Fit (I saw 78/79, amber) → Save as this class's chart.
- **Saw**: the Fit tile re-renders as **14–24 in red** with the "saved" chip, on the very chart the teacher just accepted. The
  number then drifts by a few points on every render (random baseline). Bar says "saved Sep 27". Regenerating shows 75.
- **Expected**: Fit doesn't change on Save; a saved chart is not "worse than the one I was looking at a second ago".
- **Why**: `buildModel` (seating.js) reads `sec.seating` as the *previous* chart and adds the `fresh` ("new partners")
  penalty for every pair that were partners in it. After Save, `sec.seating` *is* the working chart, so every partner pair is
  penalised, and `scoreSeats` reports the drop. The intent (avoid repeating partners next time) only makes sense while
  generating, not while scoring the chart being displayed. As shipped, the most prominent number on the surface lies
  right after the most important action. (The teacher's first reaction will be to Undo/Clear.)

### 2. On the tablet the chart and the room editor never fit the screen, and the stage owns every touch
- **Repro**: 1280×800 (and 1400×900) → Seating → Chart; then Room.
- **Saw**: Chart: `#gridwrap` is 475 px tall (292→767) but the SVG is 518 px + hint + legend; no scroll position shows the
  whole chart; the back row, teacher desk and legend are below the fold on open. Room: the stage is 562 px tall in a
  475 px wrapper (bottom at 920 in an 800 px viewport) — row 4, the teacher desk, the door and the **+ / − / Fit zoom
  controls (bottom 909) are off-screen**. The stage has `touch-action:none` and its pointer handler turns any single-finger
  drag on empty space into a pan, so a swipe on the stage can't scroll the page; the only way down is to swipe on the
  toolbar or the hint. Laptop 1400×900 is the same story (stage 333→965 in a wrapper that ends at 867; zoom at 954).
  1920×1080 is the only viewport where everything fits. 800×1280 (portrait): the chart sits **~1.7 screens below** the
  sidebar (SVG bottom at 2542 px); "Seating" opens on buttons and a 23-row student list with no chart in sight.
- **Expected**: the chart and the room stage size to the space they actually have (wrapper height minus hint/legend, or
  the classic "fit in view" of a canvas tool), so the whole room is on screen at every supported size; zoom controls and
  the back row are reachable; on portrait the chart comes before the list or the columns swap.
- **Where**: `app.html` `.chart-stage .chartSvg{max-height:min(74vh,720px)}` and `.stage svg{height:min(70vh,640px)}`
  measure the viewport, not the region; `.seat{grid-template-columns:380px 1fr}` + `@media (max-width:1000px)` single
  column puts `.seatSide` first; `bindStage` pan-on-empty-space + `touch-action:none`.

### 3. Tapping a desk shows nothing where you tapped — the explanation lands in the left column, often off-screen
- **Repro**: 1280×800 → Chart → tap an occupied desk. Also 800×1280.
- **Saw**: the desk gets a teal ring; the "why here" card with Lock/Unseat/Edit renders in `.seatSide` **below** Generate,
  the options, the Fit tile and the actions — top 526, bottom 825 in an 800 px viewport (not in view); on portrait it is
  687 px *above* the viewport (the tap scrolled to the chart, the answer went to the sidebar). Same for the "Swapped A and
  B · fit 78 → 78" consequence card and "If dropped here". On the laptop it is just in view (508–794) but cut at the bottom.
- **Expected**: the response to a tap appears near the tap (a popover/sheet anchored to the desk, or the panel pinned at
  the top of the side column, above the static Generate/options block), so the hand doesn't have to leave the chart.
  v8 rendered the move panel directly above the chart in a single column.
- **Where**: `renderSeating` builds `side` in fixed order (gen → cand → fit → actions → `#seatMove` → issues → list);
  `movePanelHTML`.

### 4. Room-editor controls are under the 44 px touch minimum and give the keyboard nothing
- **Repro**: touch viewports → Room → select a desk; look at the selection bar and zoom controls. Keyboard: Tab around.
- **Saw** (all three touch viewports): every `.ib` — rotate ⟲ ⟳, duplicate ⧉, nudge ◀ ▲ ▼ ▶, delete 🗑, deselect ✕, and
  zoom + − Fit — is **36×36**. Also under 44 on touch: `.notice button` "Room" 32 px, `.mini` room-size inputs 32 px,
  `.chip.rel` keep-apart / seat-near chips 40 px, `.cand` buttons are 44 but the `summary` "N issues" disclosure row is a
  20 px strip, and the standing badge `.st` (21 px) carries its explanation only in a `title` tooltip, which touch never
  shows. The nudge arrows and ✕ have no `title`/`aria-label` (rotate/duplicate/delete have titles only). Desks in the room
  SVG are not focusable (`g-desk` has no tabindex), the SVG is `tabindex=-1`, and Delete/arrow keys do nothing to a
  selected desk — the room editor is mouse/touch-only. Chart desks *are* focusable (`tabindex=0`, Enter/Space work).
- **Expected**: 44 px targets under `(pointer:coarse)` like the rest of Tally (round 3 did this for pills/segments — the
  `.ib`, `.chip`, `.mini`, `.notice button` and `summary` were left out of the media query); labels on every icon button;
  arrow-key nudge and Delete on a selected desk at minimum.
- **Where**: `app.html` `.ib{min-width:36px;min-height:36px}`, `.chip{min-height:40px}`, `.notice button{min-height:32px}`,
  the `@media (hover:none),(pointer:coarse)` block; `renderRoom` selbar markup; `bindStage`.

### 5. Names on the chart are 8.5 SVG units — 7–9 px on the tablet, ~10 px on the projected panel, ~6.5 pt on paper
- **Repro**: any viewport, generated chart; print teacher copy.
- **Saw**: `.chartSvg .cname{font-size:8.5px}` in a 900-unit viewBox → rendered glyph boxes of 9 px (tablet), 11 px
  (laptop), 13 px (1920 panel, seen from the back of a classroom). The initials are the only legible thing. Sub-copy last
  names are 7.5 → 6.5 units. Printed on Letter landscape (`18-print-teacher.pdf`, rasterised) the names are ≈6.5 pt and the
  sub copy's "Bartholomew-Jonath" first name spills past the desk edge. The 🔒 glyph is 10 units; the plan tag 7.5.
- **Expected**: ≥11 pt-equivalent for anything a sub or a teacher at the board must read; on a 70-unit desk that means
  dropping the initials (or shrinking them) so the name can be 12–13 units, or letting the desk grow on print; truncate
  with an ellipsis or wrap rather than overflow.
- **Where**: `SEAT_SVG_CSS`, `svgChart` (font sizes hard-coded per mode), `seatShort`.

### 6. Two identical orange dots mean two different things
- **Repro**: a student with FAST level 2 and a high-behavior student on the same chart; look at the legend.
- **Saw**: the high-behavior dot is `#E38A2B` (top-left) and `SEAT_LV[2]` is also `#E38A2B` (top-right). Same colour, same
  size, same radius; only position differs, and a rotated desk swaps the corners. The legend shows both as the same orange
  swatch. v8 used gold `#C9A227` for behaviour and `#D08A2B` for L2 — distinct if not by much.
- **Expected**: one hue family for FAST levels (the teal ramp already used for grades) and an unrelated marker (shape or
  the coral/ink warning pair) for behaviour; the print teacher copy needs a key on the page (v8 printed `legendHTML()`;
  the port's teacher copy has none).
- **Where**: `SEAT_LV`, `svgChart` behaviour circle, `printSeating` (no legend), `.seatLegend`.

### 7. The bar goes stale: "0 desks" after a template, "24 desks" after + Desk, Print disabled after generating
- **Repro**: Room → Templates → Partners 24: bar meta still "0 desks · one room for every class". + Desk → still "24 desks"
  (state has 25). Chart → Generate: `Print` stays disabled until you Save or leave and come back.
- **Saw**: as above (screenshots 04/05; `hig3.js` log).
- **Expected**: the bar reflects the room and the working chart — `Print` should be usable on an unsaved working chart,
  which is what `printSeating` prints anyway.
- **Where**: `renderRoom`/`rr()` and `renderSeating` only rebuild `#gridwrap`; `renderSeatingBar` runs only from `render()`.
  `seatGenerate` never re-renders the bar.

### 8. The hover "target" highlight on the chart never draws
- **Repro**: laptop → select a seated desk → hover another desk.
- **Saw**: `.ifhere` ("If dropped here") appears in the side panel, but no desk gets the teal wash: `svgChart` paints the
  `isHov` rect only during a full `renderSeating`, and `onmouseenter` only replaces `#seatMove` innerHTML
  (`hovRect:false` in the DOM). All non-selected desks — including the locked one that can't be a target — get the same
  dashed "target" outline, so nothing on the chart tells you which desk you're about to drop on.
- **Expected**: the hovered desk highlights (that's what the `isHov` code intends), locked desks don't advertise as targets.
- **Where**: `bindSeating` mouseenter/mouseleave, `svgChart` `isHov`/`target` classes.

### 9. Dialogs: no field focus, Enter does nothing, OK/Cancel instead of verbs, and two destructive defaults
- **Repro**: Room → + Row… / Grid… / Clear desks / Templates.
- **Saw**: `seatAsk` opens with focus on the panel (right on the tablet — but on the laptop too, so you click into the
  field, type, press Enter… and nothing happens; there's no `<form>`/Enter handler). Buttons read **OK / Cancel**. Grid…
  pre-checks **"Remove the desks already there"** whenever desks exist, which also drops every class's saved seats
  (`roomDropDesks`) with no mention in the dialog. "Clear every desk?" is a checkbox "Saved seating for every class will
  be cleared too" that is pre-checked and, if unticked, makes OK silently do nothing — a checkbox standing in for a
  confirm. Templates: previews are built once at open for the current count and **don't follow the Desks field**; the
  default when the room is empty is 22 while the class has 23 students (one ends up "Not seated" after Generate).
  Template previews of wide layouts (Groups of 3, Horseshoe) are unreadable in a 100×68 box. Escape/× on `seatAsk`
  is fine; the one-observer focus return works.
- **Expected**: focus the first field on non-coarse pointers (Tally already does this for the roster textarea via
  `coarse()`), Enter submits, buttons name the action ("Add row", "Add grid", "Clear desks"), destructive options default
  off and say what they cost, previews re-render on input, the default desk count is the largest roster.
- **Where**: `seatAsk`, `bindRoom` `#rmGrid` / `#rmClear`, `openRoomTemplates`.

### 10. Student sheet: fields don't wear the house style, and it leaks a first name with Names off
- **Repro**: Chart → tap a student in the list; toggle Names.
- **Saw**: `#shNick` is a bare `<input>` (no `type=text`) so it misses `.field input[type=text]` — browser-default inset
  border, 0 radius, no focus ring, stretched to the full 940 px panel for a first name. The accommodations and notes
  textareas inherit `.field textarea`'s **monospace** font (meant for roster paste). The "Standing" line and the "Goes by"
  label have no gap; the empty `.ghint` above it leaves a blank line when names are hidden. `.seg button.on.hot` has no
  rule, so "High" looks like any other selected segment. With **Names off** the header masks to "G. P." but the Goes-by
  placeholder still says "Greer" and any nick/notes/accommodation text stays readable. The "Done" button is below 44
  relation chips (two lists of 22), so most closes will be via ×, which is fine, but the sheet has no visible "saves
  automatically" cue.
- **Expected**: house inputs (2 px hairline, 10 px radius, teal focus ring, natural width), DM Sans in prose fields,
  masking that covers placeholder and free text, a working "hot" state.
- **Where**: `openSeatSheet` markup; `app.html` `.field input[type=text]`, `.field textarea`.

### 11. Layout shifts and nested scrolling
- **Saw**: selecting a desk in Room inserts the `.selbar` above the stage and pushes the whole canvas down 58 px (top
  333→391); deselecting pulls it back up — the thing you're pointing at moves under your finger. On the laptop the
  Students list is a 44 vh scroll region inside the scrolling `#gridwrap` (scroll-within-scroll; the list is cut mid-row).
  The four "Option" buttons wrap 3 + 1 with the fourth stretched full width (flex:1, min-width 110 in a 380 px column),
  and all four read "fit 78" with nothing that says how they differ. At 800 px the bar wraps so "Priorities" sits alone
  on a second row.
- **Expected**: reserve the selection bar's height (or overlay it on the stage), one scroll region, a 2×2 option grid.
- **Where**: `renderRoom`, `.seatList{max-height:44vh}`, `.cand button{flex:1;min-width:110px}`.

### 12. Priorities dialog uses default blue range sliders
- **Saw**: eight `<input type=range>` in system blue on a teal/ink page; thumbs ~16 px on touch. Checkboxes elsewhere
  set `accent-color:var(--teal)`.
- **Where**: `openSeatWeights`, `.wt` (no `accent-color`, no coarse-pointer sizing).

### 13. Smaller things
- Escape doesn't clear a chart selection or the pending "tap an empty desk" state (only unit mode is handled in the
  document keydown); after Enter/Space on a desk the re-render drops focus to `<body>`, so a keyboard user loses their
  place on every selection.
- Tapping an occupied desk while a "Not seated" student is pending silently cancels the pending state (`act()` in
  `bindSeating`) — no toast, the chip just goes back to normal.
- After a move is refused because the selected student is locked, the selection stays and every other desk keeps its
  dashed target outline; the toast is the only cue.
- "Row 1 of 4 · desk 3": occupied desks never show their number on the chart, so "desk 3" can't be found by eye.
- Fit tile says nothing when the only hard issue is "has no seat" (issues list shows "1 hard", Fit stays 78 amber) —
  `explainSeats` counts it, `scoreSeats` doesn't.
- The hint says "pinch or + / − to zoom" but on the laptop the wheel needs Ctrl/⌘ (correct behaviour, undocumented).
- Room editor desk numbers are `#A9AEBB` at 12 units (≈9 px on the tablet) — low contrast, small.
- Print pages fall back to Arial (the embedded DM Sans isn't carried into the popup) and the sub copy without photos
  prints a large grey placeholder in every desk that dominates the name.
- The toast (`#toast`) sits above `#modal` and overlapped the last template card at 1400×900.

## What's solid
- The interaction model itself: tap → why-here → tap to swap with before/after fit and added/fixed issues is clear and
  matches v8; Undo/Back to saved/Clear are all in the right places and disabled when they should be.
- Touch on the stage works: single-finger drag moves a desk with grid snap (verified 210,40 → 300,100), two-finger pinch
  zooms about the midpoint, pan on empty space, Ctrl-wheel zoom, and plain wheel scrolls the page rather than hijacking it.
- Desk ids are stable through templates; the saved chart followed the room.
- The dialog manners from round 3 carry over: focus goes to the panel (no keyboard pop on the tablet), Tab is trapped,
  Escape and × close, focus returns to the opener; the student sheet gets the private backdrop and dismisses toasts.
- Chart desks are real buttons for the keyboard (`tabindex=0`, `role=button`, `aria-label` "Desk 3: Sage Cobb",
  Enter/Space activate, visible focus ring in teal).
- No `prompt()`/`confirm()` anywhere; every ask is a house dialog. No page errors in any run.
- Paper-and-ink tokens are used consistently on the chart (teal front strip, ink hairlines, paleturq selection) and the
  student list rows/tags read as one system with the Grades surface.
- Names off masks the chart, the list, the why-here card and hides photos (the sheet placeholder/notes are the gap).
