# Round 6 — engineering lead / App Review (performance, robustness, CSS architecture, build, and what each polish costs)

3–4 Oct 2026. Nothing in the repo was edited or rebuilt: I copied the sources to a scratch folder, built the shipped and the test build there (`r6e/src/`), and drove both with Playwright + Chromium and the DevTools protocol (CPU throttle, `Performance.getMetrics`, CPU profiler, CSS rule-usage tracking, screencast).
Evidence: `/tmp/claude-0/-home-claude/b89b0f3d-86a2-5e43-8a51-10fb416b8565/scratchpad/r6e/` — screenshots and PDFs named below (each one was opened and looked at), scripts (`perf1…4.js`, `prof.js`, `store.js`, `solver.js`, `css1.js`, `css2.js`, `walk1.js`, `walk2.js`, `proto1…3.js`, `digits.js`, `flash.js`, `flash2.js`), and the three suite logs (`suite-baseline.log`, `suite-mutated.log`, `suite-mutated2.log`).

**State.** The interaction lead's `state-pool5s.json` (five classes, 22/23/19/13/10 = 87 students, three earlier imports, a 24-desk room) and `state-real.json`. Croix has 91 students; scale the timings by about 1.05.

**How I stand in for the Chromebox and the tablet.** Chrome's CPU throttle at 4× and 6× on the main thread. That is an estimate, not a measurement on the device; the solver's worker is not throttled by it.

**Hours** are for one person (or one Claude session) who knows the code, including the test changes. **Risk** is the chance of a visible regression somewhere else.

**Prototypes.** Where I say a fix is cheap I built it as CSS injected with `addStyleTag` or as a patched scratch copy, and measured the result. None of that is in the repo.

---

## P0

None of my own. Every defect of P0 size in my lens is already on the other two lists. I checked their three cheapest P0-class items in the source and all three are real and small:

| their finding | where | fix | hours |
|---|---|---|---|
| Show student tells a C or B student "can't get you to a C" (interaction 2) | `students.js` 373: the fallback string is a constant | name the next letter from `base.rounded`; add one check to `tests/students-quarters.js` | 0.25 |
| `.warnline` paints over the line above (visual 1) | `app.html` 345; inline box, 2 client rects, 8 px padding on a 19.6 px line (`e24-focuscheck-1400.png`) | `display:block` + margin | 0.25 |
| Header focus ring is navy on navy; Race cannot be left by keyboard (interaction 3) | `app.html` 134: `header .pill:focus-visible` can never match because `#top` is a `<div>` (computed outline `rgb(22,33,58)`, `e25-header-focus-1400.png`); `app.js` 780 wires pointer events only, `students.js` 384 has the key handlers | `#top .pill`, `#top #search`, `#modal header button`, drop the `#lb` white ring; copy line 384 to `#lbExit` | 0.75 |

These three should land before anything else in this document is discussed.

---

## P1

### 1. Every launch on a slow device paints three different pages in the first second
- **Repro.** Shipped build over `file://`, five classes saved, 1366×768, CPU 6× (`flash.js`).
- **Saw.** `e90-load-frame2.png` (≈350 ms): the **empty landing** — "Drop your IXL Score Grid here." with only Guide and Import in the header — shown to a teacher who has five classes saved. `e90-load-frame3.png` (≈910 ms): the Overview in the **fallback font**, with the fifth class tab wrapped to a second row and Import alone on a second header row. `e90-load-frame4.png` (≈1,040 ms): the real page. Cause: `#empty` is visible in the HTML and `#app` hidden, and the browser paints before the 480 KB inline script runs; the font is `font-display:swap` and is not decoded until the script has finished (`document.fonts.status` is `loading` at DOMContentLoaded in every run).
  Timings (median of 3, `perf1.js`), five classes saved: first contentful paint 208 ms at 1×, 330–720 ms at 4–6×; DOMContentLoaded 179 / 677 / 880 ms; font ready 193 / 744 / 1,017 ms; longest task 124 / 456 / 441 ms. Layout-shift score at 4×: 0.91.
- **Apple would ship.** One paint. `<div id="empty" class="hidden">` (render() already toggles it, `app.js` 997), so the pre-script frame is just the header on paper. Then start the font early (`document.fonts.load('700 14px "DM Sans"')` in a two-line script right after the font's `<style>`) and hold the first `render()` on `document.fonts.ready` with a 300 ms cap. I patched a scratch copy with the first half plus `font-display:block` (`Tally.ship.fix.html`): the landing flash is gone (`e91-fixed-data-frame2.png`) but `block` alone leaves a frame of invisible text laid out in fallback metrics (`e91-fixed-data-frame3.png`), which is why the font has to be started early as well.
- **Cost.** 0.75 h, low risk.
- **Where.** `app.html` 550 (`#empty`), 7; `build.py` 19 (`font-display:swap`); boot in `app.js` (first `render()`).

### 2. Ctrl+P on any Tally screen prints one clipped page
- **Repro.** pool5 → 1st Period → Grades → browser Print (`walk1.js`, `proto2.js`).
- **Saw.** `e26-ctrlP-grades.pdf`: one page — header, tabs, the notice band, the summary cards, and the scatter chart cut through its top edge. The 23-student table never prints (`#gridwrap` scrollHeight 1,772 px, visible 499 px). The class grid prints one page too. The only `@media print` rule in the app page is `#show{display:none}`; `body{overflow:hidden;height:100%}` does the rest.
- **Apple would ship.** Eight lines: under `@media print`, `html,body{height:auto;overflow:visible;display:block}`, hide `#top,#tabs,#notices,#toast,#modal`, make `#app,#board,#gridwrap` `display:block;overflow:visible;height:auto`, set the sticky cells `position:static`, `break-inside:avoid` on cards and rows. Prototype: `e60-print-grades-fixed.pdf` is three pages with every student, **in DM Sans**, because the app page already carries the font.
- **This is also the answer to the print-font question** (visual 13). The five print pages are separate documents written into `window.open()` (`grades.js` 276–323, `app.js` 1360–1464, `home.js` 159–160, `seating.js` 465–468), so none of them has the embedded font; they name Georgia and Arial, which as far as I know ship with neither ChromeOS nor Android, so each device substitutes its own faces and the same report looks different from the laptop, the Chromebox and the tablet. To use DM Sans there you must copy the `@font-face` rule into each written document **and** wait for `w.document.fonts.ready` before `w.print()` — today `grades.js` 323 prints after a fixed 300 ms, which would print the fallback on the Chromebox (font ready took 744–1,017 ms above). Note `#tallyFont` cannot be copied whole: that `<style>` also holds 72 lines of Grades and Overview CSS (`app.html` 7–80).
- **Cost.** App-page print rules 1 h, low risk. One shared `PRINT_CSS` + font + `fonts.ready` for the five pop-ups 3 h, low-to-medium risk.
- **Where.** `app.html` (no print block); the five sites above.

### 3. On Show student, four type sizes written as 15–17 px all render at 14 px
- **Repro.** real → Micah Dorsey → Show student; computed styles (`walk1.js`).
- **Saw.** `e22-show-real-1400.png`. `students.js` `STU_CSS` writes `font-size:var(--t-m,16px)` for the control names (`.shL b`) and the category rows (`.shCat`), `var(--t-m,17px)` for the quickest-way steps (`.shQuick .qpath`), `var(--t-m,15px)` for `.qres` and `.iup` (the last with `!important`). A `var()` fallback applies only when the token is undefined; `--t-m` is always 14 px. All five compute to **14 px**. The screen made to be read by a student at arm's length is set two to three pixels smaller than its author wrote.
- **Apple would ship.** Literal sizes (or new tokens `--t-read:16px`, `--t-read-l:17px`) in those five rules. It should land with the visual lead's finding 3.
- **Cost.** 0.25 h, low risk (text grows; check the 800 px portrait wrap).
- **Where.** `students.js` 399, 402, 416, 435, 439.

### 4. The 548 checks cannot see the visual layer
- **Repro.** I ran the suite on an unmodified scratch copy, then on a copy of `app.html` with deliberate visual regressions (`r6e/src-mut/`, screenshots `e70-mutated-overview.png`, `e70-mutated-unit-scrolled.png`).
- **Saw.** Baseline: 19 suites, **548 passed**, 0 failed, 7 min 41 s. Mutated build — ink token magenta, page background black, grid header and name column no longer sticky, at-goal and below-goal cell colours swapped, the F chip painted teal, the whole touch-target block disabled, body text 19 px with 6 px labels, Overview cards stacked one per row, dialogs capped at 30 vh, the private backdrop fully transparent, focus rings removed, Race bars invisible, DM Sans not embedded — fourteen regressions at once: **19 suites, 548 passed, 0 failed, exit 0** (`suite-mutated2.log`, 6 min 48 s). A fifteenth mutation in the first run (toast drawn off-screen) was caught only by accident, as a 30 s click timeout on the toast's Undo button in `hardening.js`, not by an assertion (`suite-mutated.log`: 524 passed, 0 failed, one suite crashed).
  Why: across `tests/*.js` there are 3 bounding-box reads and 7 `getComputedStyle` reads; screenshots are written to a temp folder and never compared; every suite runs at one viewport; one suite sets `hasTouch`. No suite loads the shipped build, so the `window.__tally` strip is asserted by `build.py` but never checked in a browser.
- **Apple would ship.** A "layout contract" suite, about 40 assertions at four viewports (1400×900, 1366×768, 1280×800 touch, 1920×1080 touch): header is one row; first student row above a stated y; at least N rows visible; header and name column do not move after scrolling; `td.sc.pass` and `.gchip.F` resolve to their tokens; no visible text under 11 px; `document.fonts.check('14px "DM Sans"')`; focus-ring contrast ≥ 3:1 on six control types; toast and dialog inside the viewport; the private backdrop's alpha; no horizontal overflow; 44 px targets under a coarse pointer. Plus one smoke test of the shipped build (no page error, `window.__tally` undefined, zero network requests — I checked by hand: `ship.js`, all three hold).
- **Cost.** 3–4 h, no product risk. **It is the precondition for every refactor in the table below**: without it a type-scale or component change is reviewed by eye across 25 surfaces and six viewports.
- **Where.** `tests/` (new suite), `tests/run.js`.

### 5. The test build overwrites the shipped files — and the repo is in that state now
- **Repro.** `git status` in `/home/claude/Tally`; `grep -c __tally Tally.html`.
- **Saw.** `Tally.html` and `index.html` are modified against HEAD and contain `window.__tally` (HEAD's copies are byte-identical to a fresh shipped build; the working copies are byte-identical to a fresh `--test` build). `build.py --test` writes to the same two paths as the shipped build, and only `npm test` puts the shipped build back; the round-6 brief tells each reviewer to run `build.py --test` directly. A `git commit -a` from here publishes the debug handle — the whole state object, `save`, `importFiles` — to the Pages URL the tablet and Chromebox are meant to use, against `README.md` line 62 ("The shipped `Tally.html` carries no `window.__tally`") and the privacy line in `NOTES.md`.
- **Apple would ship.** `--test` writes `Tally.test.html` (git-ignored) and nothing else; `tests/lib.js` points at it; `build.py` without the flag is the only thing that can write `Tally.html` and `index.html`.
- **Cost.** 1 h, low risk (the suites name `Tally.html` literally in about 27 places; move that to one constant in `tests/lib.js`).
- **Where.** `build.py` 33–35, `tests/run.js` 14 and 35, `tests/lib.js`, `.gitignore`.

### 6. The shell problem is real, the proposed cure is wrong, and the right one is twelve lines
This is the visual lead's P0 2 and the interaction lead's P0 1. I agree with the measurements and disagree with both fixes.
- **Saw — the layout depends on constants that are not constant.** The header is 66 px when its row fits and 118–130 px when it does not; it fits from **1,383 px** wide (binary search, `perf4.js`), so it is wrapped on the Chromebox (1366) and the tablet (1280). With the fallback font it wraps at 1400 as well, and the tabs wrap at 1366 (64 → 120 px), moving the first row down 52–56 px (`e50-grid-fallbackfont-laptop.png`, `-cbox.png`). Meanwhile `.chart-stage .chartSvg{max-height:max(300px,calc(100vh - 360px))}` and `.stage svg{height:max(300px,calc(100vh - 400px))}` assume a fixed chrome: the seating chart overruns the board by 8 px (laptop), 60 (Chromebox), 78 (tablet), 55 (1024×768) and the room editor's zoom buttons sit 9, 40 and 105 px below it (`walk2.js`, `e53-room-cbox.png`, `e10-seating-after-normal-cbox.png` where Discard is cut).
- **Why "the document scrolls, `#gridwrap` keeps only horizontal scroll" does not work.** `overflow-x:auto` with `overflow-y:visible` computes to `auto/auto`, so `#gridwrap` stays the scroll container for `position:sticky`. Prototype (`proto3.js`, `e80-docscroll-xauto.png`): after scrolling the page 700 px the table header is at y −100 and the footer is off screen. Sticky survives only if the page itself scrolls sideways (`e80-docscroll-visible.png`), which makes the document 1,690 px wide and takes the header, tabs and bar off screen with it unless each is re-pinned. That is a two-to-three-day change to the one screen that is used every day, with no visual tests.
- **Apple would ship (now).** Keep the board as the scroller — sticky header, sticky name column, sticky footer, Hold to exit and the seating stage keep working — and give it a floor:
  ```css
  body{overflow-x:hidden;overflow-y:auto}
  #app{flex:1 0 auto}
  #board{flex:1 1 var(--board-min);min-height:var(--board-min)}
  :root{--board-min:min(520px,calc(100vh - 16px))}
  #lb,#show,#modal .panel{overscroll-behavior:contain}
  /* B: one-row header down to 1,071 px */
  @media (max-width:1420px){#top{gap:8px;padding:12px 18px}#top .brand small{display:none}#search{width:150px}#top .pill{padding:6px 12px}#top .pill.ghost{padding:4px 12px}}
  /* C: short windows */
  @media (max-height:800px){th.skill{height:120px}th.skill .rot{max-height:104px}}
  ```
  Measured (`proto1.js`; complete student rows visible, page scrolled to the board where it scrolls):

  | window | grid today → fixed | unit view today → fixed | page scroll needed |
  |---|---|---|---|
  | 1400×900 | 12 → 12 | 9 → 9 | none (unchanged) |
  | 1920×1080 touch | 14 → 14 | 12 → 12 | none (unchanged) |
  | 1366×768 Chromebox | 7 → 9 | 4 → 7 | none |
  | 1280×800 tablet | 6 → 7 | 4 → 7 | none |
  | 1366×640 | 4 → 9 | 1 → 7 | 128 px |
  | 1280×600 | 3 → 9 | 0 → 7 | 168 px |
  | 1024×768 | 6 → 9 | 2 → 7 | 102 px |
  | 1400×900 at 150 % | 2 → 9 | 0 → 6 | 270 px |
  | 1366×768 at 150 % | 0 → 8 | 0 → 5 | 334 px |
  | 1400×900 at 200 % | 0 → 5 | 0 → 2 | 372 px |

  ("Today" is my count of complete rows between the sticky header and footer; it runs a row or two above the other reviewers' counts and I have not reconciled the difference. The direction and the zeros agree.) `e30-unit-cboxwin-today.png` shows the unit view at 1366×640 with no student row; `e30-unit-cboxwin-ABC.png` shows seven. At 200 % everything is reachable (`e30-unit-z200-ABC.png`). No horizontal overflow at any size.
  Costs of the prototype, honestly: below about 830 px of height there are two scrollers (page, then grid); rule C truncates two-line skill names at 120 px ("Convert fractions or…"), so it needs the visual lead's eye; the seating `calc(100vh − N)` rules should become `flex:1` on `.stage` / `.chart-stage` in the same pass (4 lines), which removes the 8–105 px overruns.
- **Cost.** 1.5 h for A + B + C and the two seating rules, low risk: A alone leaves the laptop and the board pixel-identical; B shortens the laptop header by 4 px and drops the "IXL → FOCUS" tag line below 1,420 px, which is a design call. The full toolbar redesign in visual 2 is 12–16 h and medium-to-high risk; do it after finding 4's tests exist.
- **Where.** `app.html` 103–107, 115–125, 169–170, 187, 335–336, 471, 505.

---

## P2

### 7. CSS architecture: tokens for colour, nothing for space or shape, and three shipped bugs from specificity
- **Census** (`css1.js`, CSSOM of the built page; `css2.js`, rule usage). 793 style rules in five sheets (two in `app.html`, plus `CHART_CSS`, `SEAT_SVG_CSS`, `STU_CSS` appended from JS), 856 selectors, 104 of them with an id. Colour is a system: **286 of 331 colour declarations (86 %) use a `:root` token**. Nothing else is: 53 distinct font sizes (127 declarations use the five `--t-*` tokens, 95 are literals or `clamp()`s), six weights (900 ×81, 700 ×63), 16 radii, 92 distinct paddings, 21 gaps, 16 min-heights, 13 z-indexes. 19 `!important` in source across 13 rules (four are utilities: `.hidden`, `.det`, `.showMode`, class colour). 31 selectors are defined twice; the block at `app.html` 329–336 re-declares `th.unit`, `.ulink`, `.copy`, `th.skill`, `.rot` from 207–248 instead of editing them. 528 of 793 rules (67 %) matched on a mouse walk of every surface at 1400×900 — the rest are touch, media and state rules, so there is little dead CSS.
- **It is disciplined where it matters to me.** In the live DOM across 16 surfaces the only `style=""` attributes on HTML are data: `--cc` (class colour), `width`, `--w`, `left` — plus eight layout ones in Settings. Design is not in the templates.
- **The three bugs.** (a) `.gcard b em.lt` (0,2,2) beats `em.lt.F` (0,2,1): the headline F on the student page is pale teal — computed `rgb(221,244,240)` (`e21-profile-real-1400.png`; `students.js` 406–407). (b) `.lbCard.r3 .lbChip` (0,3,0) beats `.lbChip.gain` (0,2,0) on background only: turquoise text on pale turquoise, 1.62:1 (`app.html` 388–389). (c) `header .pill:focus-visible` matches nothing (`app.html` 134). A fourth leftover, `#bar.detail .pill.onbar{background:#fff}` (183), is why Copy has no button shape.
- **Duplication.** The Race and Data Lab rules exist twice — `app.html` 356–457 and `LB_CSS`/`LAB_CSS` in `app.js` 478 and 696 for the exported file. Today they agree (89 of 89 selectors identical, by script); nothing keeps them so.
- **Apple would ship.** Not a rewrite. (1) Add the missing tokens — `--s-1…6` (4, 8, 12, 16, 24, 32), `--r-1…4` (6, 10, 16, 22), `--h-ctl:32px`, `--h-touch:44px`, `--ring` — and use them in new and touched rules only. (2) Wrap low-level element selectors in `:where()` so state classes always win (`:where(.gcard b) em.lt`). (3) `build.py` splices `LB_CSS` into `app.html` from one source. (4) Move the Grades/Overview rules out of `<style id="tallyFont">`.
- **Cost.** 3 h for (1)–(4), low risk. The full design-system refactor the visual lead describes (findings 8, 14, 15: four components, three weights, seven sizes, four radii, a 4-pt grid) touches 222 font-size and 177 font-weight declarations, 92 paddings and about 180 class usages in templates (`pill` ×119, `seg` ×20, `ib` ×13, `hchip` ×10, and smaller ones): **25–35 h, high risk** until finding 4 exists.
- **Where.** `app.html` throughout; `students.js` `STU_CSS`; `app.js` 478, 696, 795; `build.py`.

### 8. Storage: 13 % of the quota today, 46–66 % by June, shared with every other local page, and no gauge
- **Measured** (`store.js`). Quota on `file://` here: **5,242,761 characters**. Today `tally.v1` is 688,984 (13 %): sections 64 %, pools 36 %. Every pool class stores its own copy of the course's `skills` array, identical to the pool's (checked: 5 of 5) — 171,772 characters, **25 % of the state**. Each weekly import adds about 43 K (five history snapshots of ~9 K and five grade snapshots of ~1.3 K). Projection: week 12 1.11 M, week 24 1.63 M, week 36 2.15 M; at the 60-snapshot cap 3.19 M. Photos are cheap: `shrinkPhoto` makes 48×60 JPEGs, about 2.7 K characters each, 0.25 M for 91 students. So about **2.4 M (46 %) at the end of the year, 3.4 M (66 %) if he imports more often than weekly**.
- **The risk is not Tally alone.** On `file://` every local HTML file shares one origin, and on Pages every `croix18.github.io/…` project shares one; the standalone seating chart (full-size photos) and his other single-file tools draw from the same 5 M. When a save fails the only signal is an 8-second toast (interaction 14). On a boot error `app.js` 140 copies the whole state to `tally.v1.broken`, doubling the footprint.
- **Save cost.** `save()` stringifies everything on every mutation (68 call sites): 5 ms now, 15 ms at week 36 on this machine, so roughly 60–90 ms per tap on the Chromebox by spring.
- **Apple would ship.** A line in Settings — "Storage: 0.7 of 5 MB · 14 imports kept" — turning coral above 80 %; drop the per-section `skills` copy for pool classes (read through the pool); a persistent "not saved" band (interaction 14). IndexedDB is the real fix and is not worth it this year.
- **Cost.** Gauge 0.5 h; de-duplicate skills 1.5 h, medium risk (migration and backup format — eight suites cover it); band 1 h.
- **Where.** `app.js` 81 (`save`), 140, 261–263 (`materialize`), 351–360 (`snapshot`); `seating.js` 615.

### 9. Rendering is one layout per view, but derived data is recomputed on every render
- **Measured** (`perf2.js`, `prof.js`). Click to painted frame, 1366×768:

  | view | 1× | 4× | 6× | script at 4× | nodes |
  |---|---|---|---|---|---|
  | Overview | 51 ms | 181 | 297 | 141 | 565 |
  | class tab → calm grid | 60 | 181 | 282 | 74 | 1,605 |
  | Details on | 65 | 232 | 233 | 96 | 1,600 |
  | Names off | 41 | 186 | 236 | 77 | 1,605 |
  | open a unit | 33 | 143 | 185 | 51 | 926 |
  | skip a cell (save + render) | 49 | 173 | 277 | 73 | 930 |
  | Grades | 38 | 113 | 169 | 60 | 576 |
  | Seating | 34 | 139 | 187 | 77 | 519 |
  | Students | 54 | **310** | **330** | 169 | 1,521 |
  | Students sort | 49 | 215 | 262 | 118 | 1,511 |
  | search keystroke | 54 | 137 | 222 | 80 | 1,007 |
  | student page | 33 | 94 | 139 | 41 | 553 |
  | Show student | 25 | 42 | 44 | 12 | 588 |
  | Race on the board (1920×1080) | — | 367 | — | 260 | 675 |
  | Data Lab graph type | — | 106–144 | — | 38–69 | ~950 |

  (The Race and Data Lab rows were timed while a test run shared the machine; treat them as upper bounds.) `LayoutCount` is 1 for every render (2 where a scroll position is restored): **no layout thrash**. The profile says where the script time goes: `fmtDate` builds a new `toLocaleDateString` formatter on every call — 8 % of Overview, 8 % of the grid, **21 % of Grades**; `renderTabs` → `sectionWarn` → `buildRows` + `parseRosterText` re-matches all five rosters on every render of every view (19–26 %); the Overview re-runs `fitCategories` (the coordinate descent) for every class each time (22 %); Students spends 39 % in `studentSummary` and 23 % in `quickestPath` for all 87 students on every sort click and keystroke.
- **Apple would ship.** One `Intl.DateTimeFormat` and a `Map` in `fmtDate` (two lines). A render-independent memo keyed on a counter that `save()` increments, for `sectionWarn`, `buildRows`, `fitCategories` and `studentSummary`. Expect Students at 4× to go from about 310 ms to under 200 and a sort to under 120.
- **Cost.** `fmtDate` 0.25 h, no risk. Memo 2 h, medium risk (a stale cache is a wrong number — invalidate in `save()` only, and add one check that a skip changes the tab's warning dot).
- **Where.** `app.js` 429, 993, 1024–1029; `grades.js` `fitCategories`; `students.js` 18–19, `studentSummary`, `quickestPath`.

### 10. Glyphs: 130 uses of 22 characters the embedded font does not have — and 73 of them are free to fix
- **Saw.** Counted in the templates: `→` ×70, `✓` ×21, `⚠` ×12, `⇥` ×3, `🔒` ×3, `≥` ×2, `▾` ×2, `⋯` ×2, `⟳` ×2 and thirteen singles. Here they resolve to DejaVu Sans and Noto Color Emoji (`CSS.getPlatformFontsForNode`; `e52-seating-why-1400.png` shows the yellow padlock beside DM Sans). Each device will pick differently.
- **The cheap part.** Upstream DM Sans 4.004 (fetched from google/fonts: 486 glyphs) **contains `→ ← ≥ ≤`**; the Google "latin" subset in the repo dropped them. Re-subsetting upstream with the current character set plus U+2190–2193 and U+2264–2265 gives a **62,580-byte** file — 144 bytes smaller than the 62,724 shipped — and fixes 73 of the 130 with no template change, including the arrow in the brand line and in every `→ 52 F` what-if.
- **The rest.** `✓` and `⚠` (33 uses) and the three emoji (`🔒 🔓 🗑`, 5 uses) deserve inline SVG; the remaining 19 uses are room-editor tool glyphs and disclosure triangles.
- **Cost.** Re-subset 0.5 h, no risk. An SVG sprite for check, warning, lock, trash 1.5 h, low risk. The full 16-icon set of visual 12 is 3–4 h because several glyphs live where SVG cannot go (`content:` in `details.qbook summary h3::before`, toast strings, the clipboard and CSV text).
- **Where.** `fonts/dm-sans-latin.woff2`; templates in `app.js`, `home.js`, `students.js`, `seating.js`.

### 11. Tabular figures: the visual lead is right about the font and wrong about the remedy
- **Verified.** The embedded file's GSUB has `calt ccmp dnom frac liga locl numr` — no `tnum`. Upstream's has `aalt calt case ccmp dnom frac liga locl numr ordn ss01–ss08 sups` — **no `tnum` either**, so "re-subset keeping it" is not available. Digit advances run 379 ("1") to 710 ("0") units at weight 900; ten 1s measure 74.2 px and ten 0s 143 px at 20/900. The eleven `font-variant-numeric:tabular-nums` declarations are dead code.
- **I built the "digits-only face".** Three static weights (500/700/900) cut from DM Sans with every digit set to the widest advance and re-centred, `unicode-range:U+30-39`: 1,176 + 1,244 + 1,184 = **3,604 bytes** (4.8 K of base64, +0.8 % of the file). It works — 142 px for both strings. It also looks wrong: equal advances are not tabular *figures*, which are drawn narrower; mechanically padded DM Sans digits read as letterspaced — "1 7 %" in the IXL column (`e40-students-digits-after.png` against `-before.png`) and a loose "4 7" at 96 px (`e41-show-digits-after.png`). Routing digits to a local font (`local("Roboto")`, `local("Segoe UI")`) aligns them but puts a different typeface inside every number.
- **Apple would ship.** Solve the two harms, not the feature. (1) The 35 px jump when a 96 px grade goes 41 → 40 (measured: "40" is 127.5 px, "41" 92.3): `display:inline-block;min-width:2ch;text-align:right` on the numeral — `1ch` is the advance of "0", the widest digit, so N ch always holds N digits. It is in my sticky prototype (`e61-show-tabL-sticky.png`). (2) Ragged columns: right-align numeric `td`/`th` in `.checkTable`; with proportional digits the units edge and the % then line up, and the worst tens-digit wobble at 14 px is 4.6 px. Delete the eleven dead declarations.
- **Cost.** 1 h, no risk. The digits font is 3 h and I would not ship how it looks.
- **Where.** `students.js` `.shGrade b`; `app.html` 188, 233–235, 305, 390, 443, 449, 475, 489, 494.

### 12. Import feedback: one real bug and a magic number, both cheaper than a new sheet
- **Saw (code).** `app.js` 330 raises "Gradebook imported — …" and 332 raises "Imported …" in the same tick whenever `ok` is non-empty — and line 324 pushes every pool class into `ok`. In Croix's setup the gradebook message, which carries "roster filled in from the gradebook", the category proof and the quarter note from `keepOutgoing` / `quarterAfterImport`, is therefore **never painted**. Line 335 delays the failure toast by a constant 5,200 ms while the success toast is given 7,000 ms when a pool was imported, so the error cuts the success short.
- **Apple would ship (now).** Build one result object and show it once, in a dialog that stays: a row per file — what it was, where it went, or why it did not — reopenable from "Last import · Oct 3" on the Overview. That is a report *after* the commit and needs no change to the state model.
- **Why not the pre-commit sheet (interaction 4) yet.** `importFiles` mutates `state` file by file with three `confirm()`s and three awaited dialogs inside the loop (`pickSection`, `askNewClass`, `askCategories`) and saves once at the end. A sheet that shows the plan before committing means splitting it into classify → plan → commit, and eight suites drive today's dialogs by selector (`[data-sec="__new__"]`, `#ncMake`, `#askSave`; `#file` appears 69 times).
- **Cost.** The report 2 h, low risk. The sheet 10–14 h, high risk, on the most data-critical path in the product.
- **Where.** `app.js` 232–336, 1757.

### 13. The solver is well built; its quality depends on the machine and it has no fallback
- **Measured** (`solver.js`). Generate at 4× main-thread throttle: 1,709 ms wall, the button shows "Thinking…" with a progress bar (`e10-seating-solving-cbox.png`), longest main-thread task 64 ms, worst frame gap 73 ms — the page stays live. It runs in a Blob worker, is aborted on leaving the view, and the UI recovers from a worker error.
- **Two observations.** The annealing is budgeted by wall clock (`budgetMs: 1500`, `Date.now()` every 1,024 iterations), so a Chromebox does four to six times fewer iterations than the laptop for the same class and can return a different, weaker fit; the seed is `Math.random()`, so it cannot be reproduced either. And when the worker cannot be constructed — I simulated the `SecurityError` some opaque origins raise — the teacher sees the raw exception: "Solver error: Failed to construct 'Worker': Script at 'blob:null/x' cannot be accessed from origin 'null'." (`e10-seating-after-noWorker-cbox.png`). I could not test the tablet's `content://` path here.
- **Apple would ship.** An iteration budget with the time limit as a ceiling; on a constructor failure, run the same source on the main thread in 30 ms slices (the worker is already a string); the message "Couldn't generate here — try Seat by hand".
- **Cost.** 1.5 h, low risk.
- **Where.** `seating.js` 144–178, 235–249.

---

## P3

### 14. Back and history
`history.length` stays 2; no `pushState`, `popstate` or `beforeunload` in the source. `pushState` with state only works on `file://` (tested: `hist.js`), and there are just 22 `view = {…}` assignments to route through one function, so interaction 11 is feasible: 5–6 h, medium risk. The risk is not the plumbing. Race and Show student are deliberately "Hold to exit"; with one history entry per view the Android Back gesture becomes an instant exit from the student's screen to the teacher's page behind it. Today Back leaves Tally altogether, which is the safe failure. If history is added, `popstate` must be refused while `lbMode` or `showMode` is on. What I would ship now: `beforeunload` while a seating chart is unsaved (0.25 h) and nothing else until Pages is on.

### 15. Responsive strategy
Six width breakpoints (700, 800, 820, 900, 1000, 1100 px), each chosen by one component; none at 1,383 px where the header actually breaks; **no height query anywhere**; 17 `clamp(px, vw, px)` sizes in Race and Lab that all top out at laptop size (visual 7). The page is not responsive to its container either, which is what the student page's 6 px chart text is about (a 760-unit viewBox in a 371 px box). Container queries are supported by every target browser and would suit `.gsec`, `.hcard` and `.shGrade`; I would add them only as those components are touched. The board ramp in visual 7 is 2–3 h and isolated to `#lb`, but do finding 7's single-sourcing of `LB_CSS` first or the export drifts.

### 16. `backdrop-filter` and the private backdrop
Privacy does not depend on blur: with `backdrop-filter` forced off, the 0.94-alpha backdrop leaves the page behind at about 1.1:1 (`e51-private-no-blur.png` — you can find "31%" if you look for it; a projector will not show it). Good. `blur(24px)` over the full window is the most expensive paint in the app on a Chromebox GPU and buys nothing the alpha does not; 0.97 alpha and no blur would be cheaper and safer. `.lbTools` uses `color-mix()`, fine on current Chrome. 0.1 h.

### 17. Repository hygiene
`index.html` is byte-identical to `Tally.html` (one git blob, so no size cost; the only hazard is finding 5). `NOTES.md` still says four files are spliced into `app.js`; `build.py` splices six. Nineteen PNGs (2.4 MB, git-ignored) sit in the repo root. The shipped page adds eight globals from `parser.js` (`parseIxlGrid`, `xlsxToRows`, …) — pure functions, harmless, but an IIFE would make the page add none. `.github-token` is a live credential in a working folder that review agents read; `NOTES.md` already says to rotate it — do that. I did not open it.

---

## Cost and risk of the other reviewers' asks

Verdicts: **cheap win** (do now) · **worth it** (schedule) · **expensive** (wait for finding 4's tests) · **wrong** (as specified) · **hides a bug** (a small real defect underneath a large ask).

### Visual lead

| # | finding | hours | risk | verdict |
|---|---|---|---|---|
| 1 | `.warnline` as a block; say the Quarters warning once | 0.25 + 0.5 | none | cheap win |
| 2 | 48 px toolbar, tabs in the header, notice as a badge, 64 px unit headers, −45° skill names | 12–16 | medium-high (99 test clicks on header ids, 48 of them `#btnSettings`, which would move into a menu; `tr.skills th{top:26px}` is hard-coded) | expensive — my finding 6 gets the Chromebox from 7/4 rows to 9/7 in 1.5 h |
| 3 | Show student: sticky result bar | 1 (CSS only; `e61-show-tabL-sticky.png`, grade stays at y 92 while the switch at y 388 is ticked) | low | cheap win |
| 3 | …real switches, stepper, 720 px column, drop the trend card | 5–7 | medium | worth it, after |
| 4 | unit headers on one baseline, no underline, one-line subtitle | 1 | low | cheap win |
| 5 | Copy as the filled button | 0.25 | none | hides a bug (`app.html` 183 leftover) |
| 6 | tabular figures by re-subsetting or a digits face | 3 | medium | wrong — upstream has no `tnum`; the digits face looks letterspaced; finding 11 does it in 1 h |
| 7 | three colour defects on Race and the circle graph | 0.5 | none | hides a bug (`.lbCard.r3 .lbChip` specificity) |
| 7 | board type ramp in `vh`, rows that fill the height | 3–4 | low-medium | worth it — the board is the public face |
| 8 | four components (navigation, segmented, switch, button) | 12–16 | high | expensive; a one-rule slice — selected is ink, not turquoise — is 0.5 h |
| 9 | F in teal on the headline | 0.1 | none | hides a bug (`.gcard b em.lt`) |
| 9 | sliding as an arrow, one coral and one amber token, calmer Needs attention | 3 | low | worth it |
| 10 | Overview: attention list above the charts, charts in period order | 0.5 | none | cheap win |
| 10 | …five-across cards with two metrics each | 3–4 | low-medium | worth it (five across without the diet gives 258 px cards that wrap worse) |
| 11 | charts drawn 1:1 from the container width | 4–6 | medium — adds layout reads and resize handling to a renderer that has none; print reuses the same SVG strings | expensive; a 380-unit variant for the two small charts is 1.5 h and reads nothing |
| 11 | what-if rows as a two-column list | 1.5 | low | worth it |
| 12 | one 16-icon SVG set | 3–4 | low-medium | re-subset first (0.5 h fixes 73 of 130), then four SVGs (1.5 h) |
| 13 | one print stylesheet in DM Sans, one-page report, "Micah Dorsey" | 3 + 0.75 | low-medium (must await `fonts.ready`) | worth it; hides a bug (finding 2) |
| 14 | three weights, seven sizes | 6–8 | high | expensive; the caps-label unification (six rules → one) is 1 h |
| 15 | radii and spacing on a system | 6–10 | high | a two-day refactor for a one-pixel win — add the tokens (0.5 h), migrate as rules are touched |
| 16 | whitespace nobody chose | 1.5 | low | worth it |
| 17 | toast position and z-order | 0.5 | low | cheap win |
| 18 | Focus check: rows of one height, the note form in place | 2–3 | medium | worth it |
| 19 | contrast fixes | 1 | none | cheap win |
| 20 | seating: move L/M/H and F into the sheet | 1 | low, but it removes the "quick toggles" asked for in round 4 | Croix's call, not a defect |
| 20 | room stage sized by the region, not `100vh − 400` | 0.5 | low | cheap win (in finding 6) |
| 21 | drop the Class column when grouped; one name format | 1 + 1.5 | low (Copy order must stay Focus order) | worth it |
| 22 | Settings as grouped rows | 3–4 | medium (48 test clicks go through Settings) | expensive for what it buys |
| 23 | unit view small parts | 1 | low | worth it |
| 24 | motion, backdrop colour | 1 | low | taste |

### Interaction lead

| # | finding | hours | risk | verdict |
|---|---|---|---|---|
| 1 | the document scrolls; `#gridwrap` keeps horizontal scroll | 16–24 | high | wrong as specified — it breaks the sticky header (`e80-docscroll-xauto.png`); the hybrid in finding 6 is 0.5 h |
| 1 | type tokens in `rem`; a `max-height` step | 0.25 + 0.25 | low | cheap win (five tokens; 95 literal sizes stay px) |
| 2 | Show student's "can't get to a C" | 0.25 | none | cheap win — the cheapest P0 on any list |
| 3 | focus ring on the header, dialog close, Race | 0.5 | none | hides a bug (dead `header` selector) |
| 3 | `#lbExit` by keyboard | 0.25 | none | cheap win |
| 3 | focus kept after a view change | 1 (focus the view's heading) or 2 (re-find by `data-k`/`data-u`/`data-name`) | low | worth it — the 1 h version covers most of the 23 |
| 4 | one import sheet for the drop | 10–14 | high | expensive; hides a bug (`app.js` 330–335) — finding 12's report is 2 h |
| 5 | Undo on grade-changing taps, Ctrl+Z | 2.5–3.5 | medium-low | worth it — see the state model below |
| 5 | skill header opens a menu | 1 | low | worth it |
| 6 | hover and pressed on every control | 1 (one rule over a selector list; it does not need the four components) | low | cheap win |
| 7 | touch targets | 2.5 | low | worth it; the name cell (0.5 h) first |
| 8 | labels, radiogroups, landmarks, title, live region | 6–7 | low, no visual change | worth it — and making `#top` a `<header>` revives the dead focus rule for free |
| 9 | drop `tabindex` and `role` from grid cells | 0.25 | low | cheap, but it reverses a round-3 fix that `tests/hardening.js` 86–87 asserts — decide once |
| 10 | Show exit: `touch-action:none`, fill behind the label, focus back | 0.5 | none | cheap win |
| 11 | one history entry per view | 5–6 | medium, with a privacy trap | not yet (finding 14); `beforeunload` 0.25 h now |
| 12 | landing that knows the course exports are in | 1 | low | worth it |
| 13 | Escape closes the innermost thing; no close-on-backdrop with edits | 1.5 | low | worth it |
| 13 | one confirm sheet for the native `confirm()` calls (13 in source) | 7–8 | medium (three are inside the import loop; the suites register 26 native-dialog handlers) | expensive |
| 14 | toast queue, persistent "not saved" band, `role="alert"`, empty the node | 2.5 | low | worth it — it is data safety |
| 15 | selection not by fill alone; `forced-colors` rules | 1.5 | low | worth it |
| 16 | room selection bar floats; stage height | 1.5 | low | worth it |
| 16 | drag a student on the chart | 4–6 | medium-high | leave — tap-tap with a consequence report already forgives |
| 17 | Data Lab: disable graph types that cannot draw; tools in one row | 2 | low | worth it |
| 18–20 | contrast, motion, small things | 2.5 | low | cheap wins |

### The state model each consolidation needs

- **Undo.** Do not write an inverse per handler (the one that exists, `app.js` 1222, is seven statements for one cell). `save()` is about to overwrite the previous serialized state; keep that string in memory as the checkpoint. Undo = parse it, run `migrate()`, close any dialog, `save()`, `render()` — the boot path, which is the path already trusted on every reload, and `migrate()` is what re-links the shared `state.skips[prep]` → `sec.excluded` references that a JSON round trip separates. Cost in memory: one 0.7–2.2 MB string. Take a checkpoint only in the four named handlers (skill skip, assigned toggle, category change, close quarter) so a multi-save operation is one step, and clear the module caches that hold state by reference (`seatWork`, `seatCandsBy`, `seatBase`).
- **Import report.** None: collect what `importFiles` already knows into one array and render it.
- **Import sheet.** A two-phase import: parse and classify every file into a plan without touching `state`, then apply the plan in one synchronous pass. That is the 10–14 h.
- **Toast queue.** A FIFO with a minimum display time; the save-failure state is a flag that already exists (`lastSaveFail`), shown as a band until the next good save.

### What I would do, in order

1. **Half a day (≈4.5 h), no design decisions needed:** the three P0 fixes above (1.25 h) · the three specificity bugs and the Copy leftover (0.5 h) · `--t-m` fallbacks (0.25 h) · the launch sequence (0.75 h) · `fmtDate` (0.25 h) · the gradebook toast (0.25 h) · Show exit `touch-action` and `#lbExit` keys (in the P0 line) · contrast and Race colour rules (1.25 h).
2. **The second half-day (≈4.5 h):** hybrid shell + header diet + short-window header + seating stage (1.5 h) · app-page print rules (1 h) · test build to its own file (1 h) · re-subset the font with the arrows (0.5 h) · numeral `min-width` and right-aligned columns (0.5 h).
3. **Day two (≈8 h):** the layout-contract suite (3–4 h) · sticky Show result bar (1 h) · undo by checkpoint (3 h).
4. **Day three (≈8 h):** import report (2 h) · toast queue and not-saved band (2.5 h) · field labels and landmarks, first half (3 h) · hover and pressed rule (1 h).

Everything marked expensive, wrong or "not yet" — about 90–120 h — waits behind step 3's suite and a decision from Croix about which of it he wants at all.

A fourth report, `round6-product.md`, appeared while I was writing. I have not costed it; where it argues for removal, removal is usually the cheapest row in these tables.

---

## Already at the bar

- **Load.** 625 KB, one file, no network request (checked on the shipped build). With five classes saved: DOMContentLoaded 179 ms at full speed, 677 ms at 4×, 880 ms at 6×; script 69 / 286 / 386 ms; heap 5.1 MB. The size is not a problem and minifying it would buy nothing a teacher can feel.
- **One layout per render.** Every view, measured: `LayoutCount` 1, style recalcs 1–3. Full `innerHTML` re-rendering is the right choice at 500–1,600 nodes.
- **No leak.** Heap 2.8 MB at start, 3.94 after 33 view switches, 4.11 after 66; DOM nodes 1,073 → 1,124 → 1,124; listeners 57 → 58 → 58 (`perf3.js`).
- **The solver** is off the main thread, bounded, abortable, and reports progress (finding 13's numbers).
- **Templates carry data, not design.** The only inline styles on 16 surfaces are `--cc`, `width`, `--w`, `left`.
- **Colour tokens.** 86 % of colour declarations resolve through `:root`; the paper-and-ink change of 26 Sep was a token edit, and it shows.
- **Privacy without blur.** The private backdrop holds at 0.94 alpha with `backdrop-filter` off.
- **Photos.** 48×60 JPEG at 0.72: about 2.7 K each, 5 % of the quota for 91 students. History capped at 60 per class. `save()` returns false and says so.
- **`build.py`.** Forty lines, standard library only, an assertion on every splice marker and on the `__tally` strip; the shipped build has no debug handle and no page error on a walk of the main path.
- **The suite's logic coverage.** 548 behaviour checks in under eight minutes, all green, and they are the reason the data-critical asks above can be costed at all. They just do not look at the screen.
- **The exported Race file's CSS** matches the app's, 89 selectors of 89.
- **`pushState` works on `file://`**, so history is available when it is wanted.

---

## My position for the crit

Both colleagues are right about what is wrong and both overprice the cure. The visual lead's evidence is sound, but four components, three weights, seven sizes and a spacing grid are 25–35 hours across 793 rules with a test suite that passed against a build with magenta ink on a black page; I will not sign that refactor until forty layout assertions exist, and those take half a day. The interaction lead's floor — correctness, reachability, the ring, the exit — is also right, and most of it is the cheapest work on either list: the false sentence to a child is fifteen minutes, the ring is a dead selector, the gradebook confirmation is one overwritten toast. Where the two of them reach for a rebuild, I measured a smaller thing that gets most of the outcome: twelve lines of CSS that take the Chromebox from seven and four visible rows to nine and seven and make 200 % zoom reachable without touching the sticky table (the document-scroll proposal breaks it — I have the screenshot); eight print rules instead of a new print pipeline; a 144-byte-smaller font that fixes more than half the missing glyphs; `min-width:2ch` instead of a digits face that looks letterspaced when you actually build it; a post-import report instead of a two-phase import; undo by keeping the string `save()` was about to overwrite. What I am adding that neither of them saw is the first second of every launch on the Chromebox (the empty landing, then the wrong font, then the page), Ctrl+P printing one clipped page, five sizes on Show student that never took effect, and the fact that the repo's own `Tally.html` is the debug build right now. Ship the first two half-days; build the visual net; then let the visual lead have the type ramp and the components one surface at a time, with the board first, because that is the screen 25 children see.

---

## Crit response (engineering)

4 Oct. Hours include tests.

### 1. Product P0/P1, costed
| # | finding | hours | risk | verdict |
|---|---|---|---|---|
| 1 | stale units in chip, list, notice | 1 | low | cheap win |
| 1 | "This week" list, card diet | 6–8 | medium | Build 2 |
| 2 | "no IXL account" as a `buildRows` status | 4–5 | medium (feeds Copy) | worth it |
| 3 | land on Overview; fix line 264 | 1.5 | low | cheap win |
| 4 | `lastBackup` date and a line | 1 | low | cheap win |
| 5 | default Working in from Focus's columns | 1.5 | medium | worth it |
| 5 | Current unit, Ahead column | 8–12 | high (`unitsOf` feeds `snapshot`) | Croix's call |
| 6 | quarter: one line, Q1 final on cards | 3 | low-medium | before 9 Oct |
| 7 | Show student: sticky bar, two cards cut | 2 | low | worth it |
| 8, 9 | Focus check split; Settings by scope | 4–6 each | medium | expensive |
| 10 | page order, one-page report | 3–4 | low | worth it |
| 11 | no Overview tabs | 3 | medium (61 test clicks) | expensive |
| 12 | four-item header | 5–7 | medium-high (99 clicks) | expensive |
| 13 | Race one line, Lab select trimmed | 3 | low | worth it |

### 2. First build, ranked
1. **Interaction 2** — 0.25 h. A false sentence to a child.
2. **Product 1, minimal** — 1 h. No tick while a unit is stale.
3. **Dead-rule bundle** (visual 1, interaction 3, specificity leftovers, engineering 3) — 2 h. One line each.
4. **Engineering 6, A + B** — 1 h. Rows back; 200 % reachable.
5. **Engineering 5 plus twelve checks from 4** — 3.5 h. Today's tree ships `window.__tally`; Build 1 needs a net.

### 3. Opposed
- **Auto-routing gradebooks, even at ≥ 90 % "once Undo covers imports"** (interaction). The checkpoint is one level and any of 68 `save()` sites overwrites it: a misroute noticed two taps later is permanent. Keep the tap.
- **`Copy` on Overview rows** (product 1). The routine says "check the roster-mismatch notice, then copy"; that notice lives on the class page (`app.js` 1052). The row should open the class at that unit.
- **"Upcoming columns and seating row toggles go" as agreed** (visual, interaction). Both are recorded decisions in NOTES; product withdrew them. Ask Croix.

### 4. Costlier, now agreed
- **Product 2, 4–5 h.** No CSS clears a dot `sectionWarn` can never clear.
- **A skill-header redesign, 3–4 h.** Rule C clips 19 of 23 names; withdrawn.
- **Show student as product 7 plus sticky, 2 h, not 1.** Sticky alone pins 37 % of the tablet (`r6p/c2-*.png`).

Also: the import result as an Overview line, not my dialog.

### 5. Agreed, and Build 1
All four sign: quarter-hour fixes first; no "Focus ✓" over a stale unit; the board stays the scroller, with a floor; import results stay on screen; contract suite before any refactor; `--test` builds to its own file.

**Build 1 — one commit, about 10 h:**
- `students.js` 372–373 (0.25)
- `.warnline` block; quarter caution once (0.5)
- header, dialog-close and Race rings; keys on `#lbExit`; `touch-action:none` on `#shExit` (0.75)
- `.gcard b em.lt`, `.lbCard.r3 .lbChip`, `#bar.detail .pill.onbar`; `--t-m` fallbacks (0.5)
- stale units in `focusChip`, `attentionItems`, the notice chain (1)
- shell A + B (1)
- import: one result line on the Overview, line 264, no timer (2.5)
- `#empty` hidden at start (0.25)
- `--test` → `Tally.test.html` (1)
- twelve contract checks, shipped-build smoke test (2.5)

**Checks:** 548 green on the new path; new checks for a 71 % and an 87 % student's sentence and a stale unit's chip; the twelve at 1400×900, 1366×768, 1280×800 touch (one-row header; rows ≥ 9 grid, ≥ 5 unit; sticky header and name column; ring ≥ 3:1; F chip coral; DM Sans applied; no horizontal overflow); shipped build without `__tally`.
