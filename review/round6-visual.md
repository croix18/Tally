# Round 6 — visual design lead (typography, spacing, colour, shape, the board at 4 m)

3 Oct 2026. Test build (`python3 build.py --test`), Playwright + Chromium, driven from a scratchpad copy of `Tally.html`.
Screenshots: `/tmp/claude-0/-home-claude/b89b0f3d-86a2-5e43-8a51-10fb416b8565/scratchpad/r6v/` (file names below are in that folder; every one was opened and looked at).
All px values are `getComputedStyle` / `getBoundingClientRect` in CSS px; contrast is WCAG 2 from the `:root` tokens.

**States used.** *pool5*: both course-wide IXL exports → `focus_gradebook_pool_p1/p2` plus three synthetic gradebooks I generated in the scratchpad from the remaining pool names, so the Overview has Croix's real five classes (22/23/19/13/10 students), with three earlier imports fabricated the `tests/command-center.js` way. *real*: `ixl_7T1A_scrubbed` + roster + `focus_gradebook_scrubbed.csv` with the same fabricated history. Fixture names carry scrubber digits ("ORME78"); I did not judge those.

**Viewports.** 1400×900 mouse · 1920×1080 touch · 1280×800 and 800×1280 touch+mobile · 1366×768 · 1024×768.

**Board maths used below.** A 75″ panel is 1651 mm wide → 0.86 mm per CSS px at 1920. ISO 9241-303 asks for a cap height of at least 16′ of arc (20–22′ preferred). At 4 m that is 18.6 mm ≈ 21.6 px of cap height ≈ **31 px of DM Sans minimum, ~40 px preferred**. (An 86″ panel moves the floor to about 27 px.)

---

## P0

### 1. A highlighted sentence paints over the line above it — Focus check and Close Quarter look broken
- **Repro.** pool5 → 1st Period → tap the `Focus: points differ` badge. Also Overview → Quarters.
- **Saw.** `20-zoom-focuscheck-top.png`: the first word of the dialog, "Focus", is sliced through — only its top half shows. `41-quarters-1400.png`: the same thing five times, one per class row ("last export Oct 3 —" is cut on every row). Cause: `.warnline` is `display:inline` with `padding:8px 12px` and `border-radius:10px` on a 19.6 px line; when it wraps, the second fragment's 8 px top padding (sand `#EFECE3`) is painted over the first line's text, and the box breaks into two open-ended slabs.
- **Apple would ship.** A block callout, not an inline highlight: `display:block; margin:8px 0 0; padding:8px 12px; border-radius:10px`, on its own line under the sentence. In the Quarters table the per-row warning repeats the same 20 words five times — say it once above the table as one callout and leave the cells empty.
- **Where.** `app.html` `.warnline` (line 345); used as `<span class="warnline">` in the Focus check markup in `app.js` and `<small class="warnline">` in `quarters.js` (close-quarter table).
- **Note for the crit.** This is a one-rule fix. It is P0 only because Close Quarter is the dialog Croix opens on 9 Oct and the Focus check is step 3 of every week.

### 2. The data gets less than half the screen; on the Chromebox the unit view shows two students
- **Repro.** pool5 → 1st Period (calm grid) → open Unit 1. Repeat per viewport.
- **Saw.** Distance from the top of the window to the first student row, and complete rows visible above the sticky footer:

| viewport | grid: first row at | rows | unit view: first row at | rows |
|---|---|---|---|---|
| 1400×900 (`11-grid-workingin-1400`, `17-unit-1400`) | 415 px (46%) | 11 of 22 | 546 px (61%) | 7 |
| 1366×768 (`71-grid-cbox`, `72-unit-cbox`) | 467 px (61%) | 6 | 598 px (78%) | **2** |
| 1280×800 touch (`71-grid-tabL`, `72-unit-tabL`) | 514 px (64%) | 5 | 616 px (77%) | 2 |
| 1024×768 (`71-grid-xga`, `72-unit-xga`) | 523 px (68%) | 4 | 674 px (88%) | **1, partly under the footer** |
| 1920×1080 touch | 456 px (42%) | 12 | 526 px (49%) | 11 |

  The stack that eats it, at 1400: header card 66 + tabs 64 + notice band 52 + class bar 56 + column headers **138** (unit view: bar 91 with its legend line, lesson strip 26, rotated skill names 196). Below ~1383 px wide the header wraps and becomes 118–130 px, with **Import alone on the second row** (`72-unit-cbox.png`, `71-grid-tabL.png`): brand, search (220 px) and eight pills need about 1270 px in a row; the header's inner box is 1288 px at 1400 (18 px to spare) and 1254 px at 1366.
- **Apple would ship.** One 48 px toolbar: brand left, class tabs *in* the header as the navigation (they are the navigation), Import and a single ⋯ on the right; Guide, Details and Settings go in the ⋯. The notice becomes a count badge on the class bar that opens a popover, not a 52 px full-width band on every class every day. Unit column headers come down to 64 px: `Unit 1` (15.5/700) over `of 23` (11/500), with Copy and the Focus badge in a second sticky row only for assigned units. Skill names at −45° in a 96 px header (or two-line horizontal at 11 px grouped under the lesson strip). Target: first row at ≤ 220 px on the grid and ≤ 300 px in the unit view, i.e. 17 rows on the laptop and 11 on the Chromebox.
- **Concession.** Most of this is removal, not polish — the product reviewer is right here. Nine "upcoming" columns of grey `0/10` (`10-grid-calm-1400.png`) should simply not be in the calm grid.
- **Where.** `app.html` `#top` (115–117, `flex-wrap:wrap`), `#tabs` (142), `.nstatus` (53), `#bar` (171), `th.unit` (207–221, 330–333), `th.skill` (245–248, 335–336).

### 3. Show student: the grade and the switches cannot be on screen together
- **Repro.** real → Micah Dorsey → Show student, then tick "Turn it in" on the missing work.
- **Saw.** `32-show-laptop-full.png`: the grade card occupies y 134–317; the first control row starts at **y 930** (viewport 900). `32-show-on-tabL.png` (1280×800, all five ticked): the sticky header shows only "Micah / Start over / Hold to exit"; the 47 → 72 the student just caused is off screen. Only `.shTop` is sticky. The screen's whole job is "the grade following live", and on the tablet named for this job the student never sees it follow.
- **Also on this screen** (`32-show-laptop.png`, measured):
  - The two halves of the grade card are not on a common line: label "YOUR GRADE NOW" at y 175, "IF YOU DO THE THINGS YOU PICKED" at y 161; the two 96 px numerals sit 14 px apart vertically (`.shGrade{align-items:center}` on blocks of different height).
  - The letter chip is `font-weight:400` (an `<em>` that never got a weight) at 34 px beside a 96 px/900 numeral, in a 33×49 lozenge.
  - The right 48% of the 1100 px card is empty.
  - "Your grade at each check this quarter" is a 130 px card holding one unlabelled, axis-less line that stops at 60% of the width.
  - `Hold to exit` is the turquoise primary (32 px high) beside a 38 px `Start over`; on the Race the same control is white with a navy outline. The teacher's exit is the brightest thing on a screen made for the student.
  - "Turn it in" is a native 24 px checkbox; the number field in "Your next assessment" is an unstyled browser input (`.shL input{width:64px;font:inherit}`).
- **Apple would ship.** A sticky 88 px result bar under the name: `47% F  →  72% C  +25`, numerals 44/800 with tabular figures, both on one baseline, the delta as the only coloured element. Below it, the controls in one column at 720 px max width, each row 64 px: name 17/600, a real switch (51×31) on the right, the slider appearing in the row below. The trend card goes (it answers nothing the student asked); the "quickest way" card stays above the controls. Exit: a 44 px outlined pill, same component as the Race.
- **Where.** `students.js` `STU_CSS` (`#show .shTop`, `.shGrade`, `.shGrade em.lt`, `.shTrend`, `.shSw`, `.shL input`, `#shExit`).

---

## P1

### 4. Unit column headers: three baselines, an underline that touches the subtitle, subtitles cut mid-phrase
- **Repro.** pool5 → 1st Period, calm grid.
- **Saw.** `18-zoom-unit-headers.png`. "Unit 1" sits at y 281, "Unit 2/3" at y 308, "Unit 4+" at y 344 — the titles of one header row are on three lines because each cell is bottom-aligned and holds 5, 4 or 3 stacked items. The 3 px turquoise underline (offset 4 px, on an 18 px line box) ends 0–2 px above the subtitle's caps; on Unit 2 and 3 it touches "Rational and" / "Exponents and". Subtitles are `max-height:26.4px; overflow:hidden` with no clamp: four of the first six are cut without an ellipsis ("Solving Problems with Rational", "Solving Multi-Step Problems with", `scrollHeight` 40–53 vs 26).
- **Apple would ship.** `vertical-align:top` with a fixed slot per line so every title shares y. Drop the underline — the whole cell is the button; show it with a hover fill and a chevron. Subtitle one line, 11/500, `text-overflow:ellipsis`, full title in the unit view where there is room.
- **Where.** `app.html` `table.grid thead th{vertical-align:bottom}` (190), `th.unit .ulink .t` (211), `.s` (212, 332).

### 5. In the unit view the primary action looks like a label and a toggle looks like the primary
- **Repro.** pool5 → Unit 1.
- **Saw.** `18-zoom-unitbar.png`. `#copyUnit` is `background:#fff; border:0` on a white bar — an icon and the word "Copy" with no button shape. Next to it `Assigned` (a state toggle) is a filled navy pill and `CSV` an outlined one. Copy-into-Focus is the reason the product exists.
- **Apple would ship.** Copy as the only filled control on the bar (turquoise, 36 px, right-most). `Assigned` becomes a quiet labelled switch; CSV moves into ⋯.
- **Where.** `app.html` line 183 `#bar.detail .pill.onbar{background:var(--white);color:var(--navy)}` — a leftover from when the detail bar was navy.

### 6. There are no tabular figures in the app, and number columns are not aligned
- **Repro.** Any screen with numbers.
- **Saw.** The embedded `fonts/dm-sans-latin.woff2` has GSUB features `calt ccmp dnom frac liga locl numr` only — no `tnum` (read with fontTools). Advance widths run from 342 units ("1") to 656 ("0"). In the page, ten "1"s at 20 px/900 measure 74.2 px and ten "0"s 143 px, identically with and without `font-variant-numeric:tabular-nums`. So the eleven declarations that ask for tabular figures (`table.grid`, `.lbPct`, `.labStats b`, `.fit .n`, `.wt b`, …; eight in `app.html`, three in `app.js`) do nothing. Consequences: on Show student a grade moving 41 → 40 changes the 96 px numeral's width by about 33 px and shoves the % and the letter chip; and every numeric column in `.checkTable` is left-aligned (`21-grades-1400-full.png`: 17%, 3%, 88% ragged on the units digit; `30-students-real-1400.png` likewise).
- **Apple would ship.** Tabular figures wherever numbers stack or change, and right-aligned numeric columns with the header right-aligned over them. I did not check whether upstream DM Sans ships `tnum`; if it does, re-subset keeping it; if not, embed a digits-only face (`0–9 % / . + − ±`, a few KB) with `unicode-range` at the weights in use.
- **Where.** `fonts/dm-sans-latin.woff2`, `build.py` (font embed); `app.html` `.checkTable td/th` (233–235).

### 7. The projected board is laid out for a laptop
- **Repro.** pool5 at 1920×1080 → Race, then Data Lab (each "Show as").
- **Saw.** `51-race-prom.png`, `52-lab-*-prom.png`. Content is capped at 1500 px and top-aligned; the Race ends at y 668 of 1080 (62%), and the stem-and-leaf plot ends at y 405 with its digits spanning about 330 px of the 1920. Sizes against the 31 px floor: class name 28 · big number 48 ✓ · **"% moved up" 13.4 px at 75% opacity** (the label that says what the big number is) · chips 15 · subtitle 20 · league name 17 · "furthest along" 12.6 · Lab legend 15 · box-plot ticks 16.3 · stat labels **10** · stat values 18 · `n = 22` 14 · stem-and-leaf **15 px monospace**. Every `clamp()` here tops out at laptop size (`clamp(12px,1.2vw,15px)` hits 15 px at 1250 px wide).
- **Three colour defects on the same screens.**
  - Third-place card: the gain chip is turquoise text on pale turquoise, **1.62:1** (`.lbCard.r3 .lbChip` out-specifies `.lbChip.gain`'s navy background but not its turquoise text).
  - First-place card: the bar track is `rgba(255,255,255,.55)` on white, so the winner's bar has no track and reads as a loose stub.
  - Circle graph: the lightest slice — the largest, 55% — is `#DDF4F0` on a white card, 1.15:1, as is its legend swatch. On a washed-out projector it is gone.
  - Also: first and third place are both white cards and second is tinted, so second reads as "selected".
- **Apple would ship.** A board type ramp driven by `vh`, not `vw` with a cap: name 44, number 96, unit label 28, supporting line 28, nothing under 28. One supporting line per card instead of two chips. Rows that fill the height (`1fr` each). Stem-and-leaf at 44 px tabular DM Sans, not system monospace. Lightest ramp step no lighter than `#9ADBD2` on white (≥1.6:1 against the card, plus a 1 px ink outline on slices). Tracks `rgba(22,33,58,.10)` on every card. Place shown by the numeral, not by tinting one card.
- **Where.** `app.html` 373–412 (`.lbWrap`, `.lbCard.r1/.r2/.r3`, `.lbChip`, `.lbPct small`, line 383 track, line 388 chip), 417–455 (`.labStats span{font-size:10px}`, `.labName`, `.labLegend`), `charts.js` `CHART_CSS` (`.stem`, `#lb .chart .tl`), `chartCircle` ramp.

### 8. One pill means four things, and "selected" has five colours
- **Repro.** Compare the header, the class bar, the Students bar, Settings, Race tools and Seating.
- **Saw.** In the header (`18-zoom-top-right.png`) eight identical pills are: two views (Overview, Students), a new window (Guide), a mode (Race), two toggles (Names, Details), a dialog (Settings), an action (Import). A white fill means "current view" on Overview and "toggle is on" on Names, side by side. On the class bar `Just Unit 3` (toggle), `Grades` and `Seating` (navigation) are the same 32 px navy-outlined pill.
  Selected state by surface: white fill (header) · navy fill (class tabs, bar toggles, Race tools, Seating L/M/H) · **turquoise fill** (Students sort, Settings segments, period picker, Chart/Room, `Q1 · final`) · teal fill (Seating `F`) · pale teal with a teal border (seating options). Turquoise fill is also the primary action (Import, Make the class, Show student, Copy corrections, Generate, Hold to exit). In `30-students-real-1400.png` the "By class" sort chip is indistinguishable from a primary button.
  Control heights on a mouse: 28 (select) · 30 · 32 · 36 · 38 · 40 · 44 · 52.
- **Apple would ship.** Four components, each with one look: **navigation** (tabs, underline or filled track), **segmented control** (grey track, white thumb, one height), **switch** (for Names, Details, Assigned, Just Unit N), **button** (filled turquoise primary — one per view — and plain secondary). Turquoise is reserved for the primary action; selection is always ink on a track. Two control heights: 32 and 44.
- **Where.** `app.html` `.pill*` (126–139), `#bar .pill.toggle` (184–185), `.seg` (309–312), `.chip` (350–351), `.lbTools .seg` (362–364), `.seg.tiny`, `.ft` (484–485), `.cand` (474).

### 9. Coral does not always mean "bad", and teal sometimes sits on an F
- **Repro.** real → Students; real → Micah Dorsey; pool5 → Overview; Settings.
- **Saw.**
  - `31-zoom-profile-head.png`: the headline `47%` carries its **F in pale teal** (`rgb(221,244,240)`), the "fine" wash, while the "Now 47 F" chip 300 px lower is coral. `.gcard b em.lt` (0,2,2) out-specifies `em.lt.F` (0,2,1).
  - `30-students-real-1400.png`: "sliding" paints the whole name cell coral and adds a navy tag — on students with **97 A** and **90 A**. The loudest rows on the page are A students who lost 3 points.
  - `42-settings-bottom-1400.png`: "22 of 23 roster names matched to IXL." is a coral pill.
  - `03-overview5-1400-full.png`: Needs attention is eleven full-width bars alternating coral and teal washes; `21-grades-1400-full.png`: 18 of 23 rows carry a coral cell or chip (the pool fixture is F-heavy, but F plus sliding will do this to any struggling class).
  - Four corals are in use: `#FBDAD2` (token), `#fdeeea` (missing rows, hard-coded), `rgba(217,68,47,.25–.3)` (borders), and the danger-button outline. Two warning reds: `--bad` `#B8321F` in the page, `#D9442F` for F in charts (`charts.js` `LETTER_COLORS`). Plus an off-token amber `#B26A00` / `#FBEFD9` / `#7A4A00` in Seating.
- **Apple would ship.** Coral wash only for "needs action now" (missing work, Focus mismatch, roster mismatch). Sliding is a trend, not an alarm: a small `↓6` in `--bad` in the change column, no row wash. Letter grades get no wash at all in tables — the letter is the information; keep a 6 px dot if colour is wanted. Needs attention: white rows on hairlines with a 6 px coral or teal dot, grouped by class. One coral token and one amber token in `:root`.
- **Where.** `students.js` `STU_CSS` (`.gcard b em.lt`, `em.lt.F`, `.sasg tr.miss td`), `app.html` `.gstu tr.sliding td:first-child` (27), `.gchip.F` (31), `.report .bad` (317), `.hatt` (70), `.issue.warn`, `.fit .n.mid` (475–478).

### 10. Overview: the thing to act on is below the fold, and the cards are ragged
- **Repro.** pool5 → Overview at 1400×900.
- **Saw.** `03-overview5-1400.png` / `-full.png`.
  - `repeat(auto-fill,minmax(300px,1fr))` gives four columns at 1340 px, so five classes make 4 + 1 with three empty columns; "Needs attention" starts at **y 1001** in a 900 px window. At 1920 the five fit one row (`70-overview-prom.png`) — the laptop is the broken case.
  - The chip area is a different shape on every card: 3rd Period has Focus chip and letters on one row; the others stack three rows; the grey "Focus IXL column (Unit 1) not assigned in Tally — pick Working in" is a **two-line pill** at `border-radius:999px`.
  - "+1.2 skills/student since Sep 19" wraps to two lines at 1400 (its box is 139 px wide) while "+0 since Sep 19" beside it is one line, so the two headline numbers sit over a ragged two-line / one-line pair of captions.
  - `What changed ›` (navy fill, 11/900) is the heaviest object on the card and it is the secondary action; the card itself is the primary.
  - Bar chart "IXL work at goal by class" lists classes in Race order (1st, 3rd, 5th, 4th, 2nd), which reads as random under that title; it sits in a 524 px card that is 60% empty. The line chart's y ticks are 40/55/70/85/100.
  - With a quarter just closed (`97-overview-q1closed-1400.png`) the card shows `A 0  B 0  C 0  D 0  F 0`.
- **Apple would ship.** A fixed five-across row at ≥1280 (`repeat(5,1fr)`, 12 px gutter), two metrics per card instead of four (IXL %, Focus %), deltas as a 12 px tabular `+1.2` beside the number, one status line at the bottom ("2 to look at" as a link). Needs attention directly under the cards and above every chart, as a plain list. Letters as one 6 px stacked bar, not five chips. Charts ordered by period.
- **Concession.** This is half polish, half removal: Missing/Sliding/letters on the card duplicate the Grades screen.
- **Where.** `app.html` 61–70 (`.hcards`, `.hnums`, `.hchips`, `.hchip`, `.hdigest`, `.hatt`), `home.js`.

### 11. Student page: 6 px chart text, charts with no type scale, every what-if on two lines
- **Repro.** real → Micah Dorsey.
- **Saw.**
  - `31-zoom-profile-minicharts.png`: "Missing work" and "IXL skills at goal" are 760-unit charts squeezed to 371 px, so 12–13 px labels render at **5.9–6.3 px**.
  - Chart text has no fixed size anywhere: 5.9 px here, 12 px in the full-width charts above, ~14 px on the Overview, 16–23 px in the Lab — it is whatever `width:100%` makes it.
  - "Each category" draws Participation green, Assessments blue, Classwork orange — the class palette. Blue is "1st Period" on every other chart in the product.
  - `31-zoom-profile-whatif.png`: every row of "If missing work were turned in" is two lines because of column widths — "2.03 Worksheet Classwork · due / 09/10" with the date orphaned in teal 11/700, and "turned in for full credit / (10/10)". The total row drops its `+25` chip to a second line while the others keep theirs inline. Three caps-label styles in one card (teal h3, grey `.subh`, teal `th`).
  - Headline cards are 171/194/250/264 px wide, left-aligned, with 420 px unused to their right; "Quickest way" starts 130 px lower in the other column.
  - 800×1280 (`31-profile-real-tabP.png`): `‹ Prev` ends the first bar row and `Next ›` starts the second — the pair is split.
- **Apple would ship.** Charts drawn at 1:1 — set the viewBox from the container width so 12 px is 12 px; small multiples get fewer ticks, not smaller type. One series colour (teal) plus grey for the class average; categories told apart by direct label. What-if rows as a two-column list: name 14/600 with "Classwork · due 09/10" under it in 12/400 grey, result right-aligned `52 F  +5`. Headline as one card across the full width with four equal cells. Prev/Next as one joined control.
- **Where.** `students.js` (profile markup, `.pcols`, `.gcard.big`, `.checkTable.whatif`), `charts.js` (`.chart{width:100%}`, `.tl`, `.lbl`, series colours).

### 12. Icons come from three places
- **Repro.** Header, class bar, Focus check, Seating room editor.
- **Saw.** Three drawn SVG icons (settings, import, copy; 2.3–2.6 px stroke). Everything else is a character: `→ ⚠ ✓ ▸ ▾ ⋯ ⇥ ↶ ⟲ ⟳ ⧉ ◀ ▲ ▼ ▶ ✕`. Of those, `→ ← ▸ ▾ ⚠ ✓ ⋯ ✕ ▲ ▼` are **not in the embedded font** (checked against its cmap), so each is drawn by whatever fallback the device has — a different arrow on the laptop, the Chromebox and the Samsung tablet, including the arrow in the brand line "IXL → FOCUS" and in every `→ 52 F` what-if. Two are colour emoji: 🔒 on "Lock seat" and the legend (`65-seating-why-1400.png`), 🗑 on the room editor's delete (`63-room-selected-1400.png`). The `⚠` is a hairline outline beside 2.3 px-stroke SVGs (`18-zoom-top.png`).
- **Apple would ship.** One inline SVG set, 16 px on a 24 grid, 1.75 px stroke, `currentColor`: arrow-right, chevron-down/right, warning, check, more, undo, rotate-left/right, duplicate, trash, lock, close, nudge arrows. About sixteen symbols, under 3 KB.
- **Where.** `app.html` (header SVGs), `app.js`/`home.js`/`students.js` (glyphs in templates), `seating.js` (room `selbar`, `seatWhy`, legend), `.nstatus span`, `details.qbook summary h3::before`.

### 13. The pages that leave the room carry none of the product
- **Repro.** real → Micah Dorsey → Print report; class ⋯ → Still owed; What changed → Print; Seating → Print → Teacher copy; Guide.
- **Saw.** `80-print-student-report.pdf`: Georgia body with Arial headings, name in shout-caps Focus order ("DORSEY, MICAH FLYNN-WINTER" — the app says "Micah Dorsey"), and it runs to a **second page** for a quarter of a page of IXL skill names; the last table row reads "an A isn't reachable on one assessment · a B isn't reachable on one assessment · a C isn't reachable on one assessment". `83-print-seating-teacher.png`: the chart occupies the top-left 55% of a landscape page, desk text falls back to a system face, legend in Arial. `43-guide.png`: Arial; left column ends a third of the way down beside a full-length right column. Five print stylesheets, three families (Georgia, Arial, system), none DM Sans — which is already embedded and already passed to the Race/Lab export (`app.js` 795).
- **Apple would ship.** One print stylesheet shared by all five: DM Sans 10.5/14 body, 9 pt caps labels, 28 pt grade, hairline rules, 0.6 in margins. The student report holds to one page by listing at most six skills per unit ("…and 13 more — see IXL"). Name as "Micah Dorsey". Seating chart scaled to the printable area with 11 pt names.
- **Where.** `grades.js` `REPORT_CSS` (276–282), `app.js` Still owed (1360–1377) and Guide (1394–), `home.js` 160, `seating.js` 465.

### 14. The type system is one weight used for everything
- **Repro.** Static count over `app.html` and the CSS strings in the `.js` files, plus computed styles.
- **Saw.** `font-weight:900` appears 97 times, 700 76 times, then 800, 500, 600 and the default 400 — six weights. Black is used for 11 px caps labels, chips, tags, table numbers, names and titles alike, so nothing is emphasised (`11-grid-workingin-1400.png`: unit title, points, "CLASS AVERAGE", Copy are all 700–900). Five size tokens (11 / 12.5 / 14 / 15.5 / 18) but thirty other literal sizes (10, 12, 13, 15, 16, 20, 22, 24, 26, 28, 34 px) and seventeen `clamp()`s. The small-caps label — one role — exists as 11/900/.10em teal (`.gsec h3`), 11/900/.08em teal (`.gcard small`), 11/700/.08em teal (`.checkTable th`), 14/900/.08em teal (`#modal section h3`), 12.5/900/.06em ink (`th.stu`), 11/700/.08em grey (`.subh`). In Settings (`42-settings-1400.png`) labels, help text, section heads and file names are all teal, so the dialog is a wall of one colour; teal is documented as "accent ink: labels, links, small caps".
- **Apple would ship.** Three weights: 400 body, 600 labels and names, 800 display numerals ≥ 24 px. Seven sizes: 11, 13, 15, 17, 20, 28, 44 (the board ramp is separate). One caps label: 11/600/.06em `--ink-soft`. Body and help text in ink / ink-soft; teal only for links and the one accent per card.
- **Where.** `app.html` `:root` (`--t-*`, line 99), `h1,h2,h3{font-weight:900}` (110), `#modal section p`, `.field label` (302–304), and the label rules listed above.

---

## P2

### 15. Shape and spacing have no system
- **Saw (static count + computed).** 17 radii (999, 24, 20, 18, 16, 14, 12, 10, 9, 8, 6, 5, 4, 3, 2 px, 50%). Border widths 1, 1.5, 2, 3, 4, 5, 6, 8. Gaps 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 22, 24, 26 — no 4- or 8-pt step. 97 distinct `padding` values. Card padding: `.hcard` 14/16, `.gcard` 12/16, `.gsec` 12/16/8 (less at the bottom than the top), `#modal .body` 20/26, `.shGrade` 20/28, `.lbCard` 14/18/14/12, `.seatWhy` 10/12, `.fit` 8/12, `.dstat` 10/12. Pills holding wrapped text become lozenges: the toast at three lines (`92-newclass-picked-1400.png`), the grey Overview chip at two. The room editor's selection bar uses 36 px rounded squares (`.ib`, radius 8) next to pills.
- **Apple would ship.** Radii 6 (chips, inputs), 10 (buttons, rows), 16 (cards), 22 (sheets); full-round only for single-line capsules and dots. Spacing on 4: 4, 8, 12, 16, 24, 32. Card padding 16 everywhere, 24 in dialogs. Hairline 1 px; 2 px only for focus and selection.
- **Where.** `app.html` throughout; `:root` has `--r` only.

### 16. Whitespace that nobody chose
- **Saw.** `12-grid-justunit-1400.png`: "Just Unit 3" stretches one column across 1070 px, so each score sits ~660 px from its name. `21-grades-1400.png`: five summary cards of 150/195/235/290/225 px, left-aligned with 165 px spare; the Categories card is stretched to the scatter's height with ~200 px of nothing. `15-grid-details-1400.png`: in Details the class bar breaks into two rows with "Seating · Working in · ⋯ · Tap a unit for skill scores" stranded on the second. `01-empty-1400.png`: the landing subhead runs 1240 px wide, about 150 characters a line.
- **Apple would ship.** Single-unit table capped at 560 px with a per-row progress bar using the freed width. Summary cards on a 4- or 5-column grid of equal cells. `align-items:start` on `.gtwo`. Subhead `max-width:44em`.
- **Where.** `table.grid{min-width:100%}` (188), `.gcards` (10–11), `.gtwo` (18), `#drop p` (278).

### 17. The toast sits on top of what you are doing
- **Saw.** `11-grid-workingin-toast-1400.png`: it covers the Class-average footer for the columns it describes. `20-focuscheck-kept-1400.png`: it covers the dialog's Close button (toast `z-index:80` over modal 60). Up to three lines in a full-round pill with a 2 px turquoise border, 15/700.
- **Apple would ship.** Top-centre under the header, radius 14, 13/500, max two lines, no border, 1 px inner hairline; never over a dialog's footer.
- **Where.** `app.html` `#toast` (460–464).

### 18. Focus check: 21 identical buttons, uneven rows, the form appears somewhere else
- **Saw.** `20-focuscheck-keepform-1400.png`. Every differing row carries a pale "Keep Focus" pill, which makes those rows 43.5 px and the plain row ("QUILL, DAKOTA") 31 px. Tapping Keep Focus on row 1 opens its note form **below row 21**. The body nests three scroll areas (page behind, dialog body, 280 px tick-list). The summary line "1 match · 21 differ · 1 not matched" is 14/500 between a large teal tool block and a select.
- **Apple would ship.** Summary first, as the headline (20/700). Rows at one height (40 px); the row expands in place to show the note field and `Keep`. The skip tick-list collapsed behind "Skip 8 skills to match Focus…".
- **Where.** `app.js` Focus check markup; `app.html` `.checkTable td` (235), `.keepForm` (497), `.skipList` (46).

### 19. Text and fills below contrast
- **Saw (computed).** Dialog header subtitle (`.hsub`, ink-soft on navy) **3.24:1** at 12.5/600 (`40-digest-1400.png`, "Sep 19 → Sep 26"). "Now 47 F" chip text, ink-soft on coral, **3.78:1**. Muted Overview chip, ink-soft on `--grid`, **3.88:1** at 11/900. Danger button outline, `#FBDAD2` on white, **1.31:1** — "Remove this class" and "Clear all Tally data" are the faintest buttons in Settings (`42-settings-bottom-1400.png`). Unit view: at-goal fill 1.15:1 and below-goal fill 1.18:1 against white and ~1.04:1 against each other; the "Below goal" legend swatch has a white border and is invisible (`18-zoom-unitbar.png`). The states are carried by text colour alone, which will not survive the projector.
- **Apple would ship.** `.hsub` at `rgba(255,255,255,.7)` (≈9:1). Chips inherit ink. Destructive buttons: `--bad` text on white with a 1 px `--bad` outline. Below-goal cells get a 3 px sand-dark left rule or a dot; legend swatches get a 1 px ink-soft outline.
- **Where.** `app.html` line 296 (`.hsub`), 133 (`.pill.danger`), 181 (`.legend .ll`), 253–254 (`td.sc.pass/.low`), `students.js` `.wnow`.

### 20. Seating is the densest surface and the least resolved
- **Saw.** `66-seating-panels-1400-full.png`, `65-seating-why-1400.png`, `63-room-selected-1400.png`. Each of 23 list rows carries L/M/H and F — 92 small controls in a 380 px column. The standing number is a chip right-aligned on a second line under the name. Four options lay out 3 + 1 with the fourth full-width; Save / Undo / Discard wrap with Discard alone. Chart names render at about 9–10 px and "FRONT" at 6.9 px; desks fill the top 60% of the stage. The fit number is amber, a status colour used nowhere else; the FAST legend adds a five-step red→teal scale — a fourth palette after class colours, the letter ramp and status washes. In the room editor at 1400×900 the zoom controls are cut off by the bottom of the board (stage bottom 893 px, board bottom 868): `calc(100vh - 400px)` assumes less chrome than there is.
- **Apple would ship.** List rows 44 px: photo, name, standing right-aligned in tabular figures; L/M/H and F live in the row's sheet. Options as a 2×2 grid. Chart fitted to the stage with names at 12 px minimum. Fit number in ink with a small teal/coral dot.
- **Concession.** Removing the quick toggles from the list is better than restyling them.
- **Where.** `app.html` 467–511, `seating.js` (chart SVG font sizes, `SEAT_SVG_CSS`).

### 21. Students list: a column that repeats the group header, and two name formats
- **Saw.** `30-students-real-1400.png`: sorted by class, every row repeats "● 1st Period · Accelerated" under a group header that says the same. At 800 px (`74-students-tabP.png`) that column wraps and makes every row two lines. Names: the class grid and Grades show `SUTTER, HAYDEN SKYLER` (caps, Focus order, bold, dotted underline on every row — `93-realgrid-1400.png`); Students, the student page and Seating show `Hayden Sutter`; one title-cases a suffix as "Quinn Nash Ii". "has an A" is 11/700 teal while "1 IXL skill → B" in the same column is 12.5/400.
- **Apple would ship.** Drop Class when grouped by class. One name format everywhere ("Hayden Sutter"; "Sutter, Hayden" only where Focus order matters), 14/600, no underline — the row is the target.
- **Where.** `students.js` (directory rows, name formatter), `app.js` grid `.stuname .nm`, `.nmbtn` (337).

### 22. Settings and Quarters dialogs
- **Saw.** `42-settings-1400.png`: "Class name (what students see)" wraps to two lines and "Goal SmartScore" is one, so the two inputs in the same row start at y 178 and y 162. The Course segment stacks vertically while every other segment is horizontal. Nine sections in two unequal columns. `41-quarters-1400.png`: native date inputs with the browser's own border inside a custom 2 px bordered label — a box in a box; the primary button is cut by the dialog's bottom edge.
- **Apple would ship.** Grouped rows: label left, control right, 44 px, hairline between, group title above — one column, 560 px. Date fields borderless inside their cell.
- **Where.** `app.js` settings markup, `.row2` (308), `quarters.js`, `.quarters .qdates` in `students.js` `STU_CSS`.

### 23. Unit view small parts
- **Saw.** `18-zoom-unitbar.png`: the lesson strip truncates to "1.2 CONVE…", "1.4 SOLVIN…", "1.6 …". `18-zoom-unit-skillhead.png`: skill names clamp at two lines by `max-height`, leaving slivers of a third line visible beside "numbers and improper"; `#` sits 8 px below "STUDENT" (no matching bottom padding on `th.idx`). The breadcrumb "‹ 1ST PERIOD · ACCELERATED" (15.5/900 caps, 3 px turquoise underline) outranks the page title "Unit 1" (20/900) on Unit, Grades, Seating and the student page.
- **Apple would ship.** Lesson number only in the strip ("1.2"), full title on hover/tap. `-webkit-line-clamp:2`. Back as a 13/500 chevron link in ink-soft; title 20/700.
- **Where.** `app.html` 191, 196, 248, 336, `#bar .crumb button` (175).

---

## P3

### 24. Taste
- **Closed quarter does not look closed.** `98-grades-q1view-1400.png` is the open-quarter page with a one-line notice. A frozen record wants ink-soft numerals, no teal labels and a lock on the Q1 segment.
- **Private backdrop** is `rgba(248,242,228,.94)` — the old cream, visibly yellower than the paper `#F6F5F0` (`40-digest-1400.png`).
- **No motion.** Dialogs, view changes and the ⋯ menu appear and vanish; only the card hover, the toast and the Race bars move. A 160 ms fade/scale on dialogs and a 120 ms cross-fade between views would do.
- **Sheet chips.** The seating sheet lists 22 outlined 40 px chips twice (`67-seating-sheet-1400.png`); a search field with tokens would be quieter.

---

## Already at the bar

- **The palette itself.** Paper `#F6F5F0`, ink `#16213A`, hairline `#E6E4DC`, white cards with a 1 px hairline and a 2-layer shadow at 6% / 4%. It is warm and quiet. Teal labels on white are 5.47:1, `--bad` on coral 4.57:1, `--bad` on white 5.98:1, ink-soft on white 4.94:1.
- **Class colour.** One colour per class, verified for 1st Period (`#2a78d6`) as the 10 px tab dot, the 6 px card top, the bar and line in Overview charts, the 8 px stripe on Race and Lab rows, the group rule and dots in Students. It never appears as text.
- **The landing** (`01-empty-1400.png`). One 64 px line, one turquoise full stop, one button, one explainer card. The hierarchy is right first time.
- **New class dialog** (`92-newclass-picked-1400.png`). 560 px, one question per line, seven period chips, two course chips, primary + quiet secondary. Nothing to remove.
- **Room templates** (`62-room-templates-1400.png`). Six rows, each with a live miniature drawn from the same geometry as the room — a picture where other products would put a paragraph.
- **Histogram** (`52-lab-hist-prom.png`). Flush bars, counts on top, thin gridlines, single teal, shared axis between classes. It reads at a glance.
- **What changed** (`40-digest-1400.png`). Two sections, four tiles each (24/900 over an 11 px caption), then run-in lines with the delta as the only colour.
- **Focus column stripe** in the Focus check (`20-focuscheck-table-1400.png`): the coral wash runs down exactly the column that disagrees, and nothing else in the table is coloured.
- **Touch sizing.** At a coarse pointer 409 of 439 visible controls on the grid are ≥ 44 px; the tab's attention dot has a 2 px white ring so it reads on both the white and the navy tab.
- **Overview at 1920** (`70-overview-prom.png`): five equal cards in one row with the attention list directly beneath — the layout the laptop should also get.

---

## My position for the crit

Tally has a good palette and a real voice, and it is under-designed everywhere that voice meets a number. The evidence is not taste: the font cannot set tabular figures, chart labels render at 5.9 px, the board's key label is 13 px for a room that needs 31, one highlighted sentence paints over its neighbour in two dialogs, an F wears the "fine" colour on the student's own page, and "selected" is five different colours. Those are engineering-sized fixes — a type ramp, four components, one icon set, one print stylesheet, a digits subset — and they are worth the time because Croix looks at these numbers every day and shows two of these screens to children. I will concede the product reviewer's point wherever removal fixes the visual problem better than polish: the nine upcoming columns, the Class column, the per-row seating toggles, half of each Overview card, the notice band and three header pills should go rather than be restyled, and doing that first makes findings 2, 10, 20 and 21 mostly disappear. What I will not concede is that the remainder can ship as is: after the cuts, what is left still needs one weight scale, aligned figures, a board ramp and a sticky grade on Show student — and the P0 `.warnline` rule is a one-line change the engineer can land today.

---

## Crit response (visual)

4 Oct. Re-measured in the build; new shots `r6v/c1-eng-unit-*.png`, `r6v/c2-show-cut-*.png`. Row counts are mine.

### 1. First build, ranked
1. **Interaction 2** — `students.js` 372–373. The "can't get you to a C" fallback is false for 19 of 32 C and B students, on the child's own screen; fifteen minutes.
2. **Visual 1** — `app.html` 345 `.warnline` as a block, and the caution said once in `quarters.js` `openQuarters`. Close Quarter is opened on 9 Oct and looks broken today.
3. **Product 1** — `home.js` `attentionItems` / `focusChip` (17–33, 42), `app.js` `renderNotices` (1054–1056). The home screen says "Focus ✓" while a unit is stale; that outranks anything I measured in pixels.
4. **Engineering 6, rules A and B only** — `app.html` `body`, `#app`, `#board`, `#top`. One-row header and a floor under the board: Chromebox grid 6 → 7 rows, unit view 2 → 4, for 1.5 h.
5. **Visual 3 as the engineer prototyped it** — `students.js` `.shGrade` sticky. One hour of CSS keeps the result beside every switch.

### 2. Opposed
- **Engineering 6 as the cure, and its rule C.** With all three rules the laptop is unchanged: first row at 411 px (grid) and 542 px (unit), 11 and 7 rows — still 46 % and 60 % chrome. Rule C (`th.skill{height:120px}`) buys the Chromebox two more unit rows by cutting **19 of 23** skill names; NSH and QEB both read "Solve two-step equations with" (`c1-eng-unit-cbox.png`). Ship A + B. The 138 px `th.unit` header (visual 4) and product 5's Ahead column are still owed.
- **Product 7, "cut two cards before any sticky work".** With `.shCats`, `.shKey` and `.shTrend` hidden at 1280×800, 4 of 11 controls are on the first screen and 6 still cannot share it with the grade (`c2-show-cut-tabL.png`). Sticky first; then cut the trend card.
- **Product 10, "remove the two charts; the tiles say it".** The IXL tile says "5 of 59 · +3". Only the chart carries the class average (33.5 against 5), and the Missing tile has no history; NOTES records "trends" as the ask. Keep both as a 96×24 `.spark` inside the tile.

### 3. Withdrawn or downgraded
- **Visual 6 → P2, remedy withdrawn.** Upstream DM Sans has no `tnum`, and the engineer's digits face reads letterspaced ("1 7%", `r6e/e40-students-digits-after.png` — I looked). Engineering 11 is the fix: `min-width:2ch` on `.shGrade b`, right-aligned numeric cells in `.checkTable`, the eleven dead declarations deleted.
- **Visual 12 → P2.** Engineering 10's re-subset of `fonts/dm-sans-latin.woff2` fixes 73 of 130 glyph uses with no template change. Then four SVGs (check, warning, lock, trash), not sixteen.
- **Visual 10, and the attention-list half of 9, withdrawn.** Product 1 and 2 (`home.js` `attentionItems`: one line per cause, no dot without an action) leave about four lines; there is nothing left to restyle. The 1:1 chart renderer in visual 11 goes too.

### 4. What all four would sign
- The three quarter-hour fixes land first: the false sentence, `.warnline`, the header ring (`#top .pill:focus-visible`) with keys on `#lbExit`.
- Four rules are bugs, not design: `.gcard b em.lt`, `.lbCard.r3 .lbChip`, `header .pill:focus-visible`, `#bar.detail .pill.onbar`.
- Remove before polishing: upcoming columns become one Ahead column; the notice band becomes a count; the Class column goes when grouped by class.
- The layout-contract suite (engineering 4) comes before any type-ramp or component refactor.
- `--test` builds to its own file; until then, `python3 build.py` before any commit.
- Show student gets a sticky result and loses the trend card.
- The board gets its own type ramp, after the Race card is cut to one line (product 13).
