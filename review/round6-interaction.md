# Round 6 — interaction and accessibility lead (feedback, forgiveness, focus, semantics, touch, zoom)

3 Oct 2026. Test build, Playwright + Chromium, driven from a scratchpad copy of `Tally.html` (byte-identical to the repo's test build; no repo file was edited).
Screenshots: `/tmp/claude-0/-home-claude/b89b0f3d-86a2-5e43-8a51-10fb416b8565/scratchpad/r6i/` (names below are in that folder; every one cited was opened and looked at). Scripts and logs (`t01…t21.js`, `walk.js`, `*.log`) are beside them.

**States.** The visual lead's two seeded states, so we are looking at the same data: *pool5* (five classes, three fabricated earlier imports, a 24-desk room) and *real* (the scrubbed 7T1A class with roster and gradebook).

**Viewports.** 1400×900 mouse · 1920×1080 touch · 1280×800 and 800×1280 touch+mobile · 1366×768 · 1024×768. Added for this lens: browser zoom 125 / 150 / 200 % (emulated as the CSS viewport a 1400×900 or 1366×768 window has at that zoom), three windowed sizes (1280×600, 1366×640, 1536×730), `forced-colors: active`, `prefers-reduced-motion: reduce`, and Chrome's CPU throttle at 4× and 6× for latency.

**Checks.** No axe on the machine, so the checks are hand-rolled in `lib.js` and run in the page: accessible name of every visible control, clickable non-controls, heading outline, landmarks, table semantics, WCAG contrast of every visible text node against its composited background, focus-ring colour against what it sits on, target size and spacing, Tab order by pressing Tab, focus position after every activation, hover and pressed style deltas, touch holds with finger drift through CDP touch events.

I did not re-report what `round6-visual.md` already has; where a finding of mine meets one of theirs it says so.

---

## P0

### 1. The page cannot scroll, so zoom or a short window removes the data — at 200 % there is nothing left
- **Repro.** pool5 → 1st Period → Unit 1 → Grades, at each size. The shell is `body{overflow:hidden}` with header, tabs, notice and bar stacked above the one scrolling region (`#gridwrap`).
- **Saw.** Height of the data region and complete student rows visible:

| window | grid | unit view | Grades | Students |
|---|---|---|---|---|
| 1400×900, 100 % | 590 px · 11 rows | 556 px · 8 rows | 499 px | 557 px |
| 1536×730 (≈ a 1080p laptop at Windows' 125 % scaling, inside the browser) | 420 px · 7 | 386 px · 4 | 329 px | 414 px |
| 1366×640 (≈ the Chromebox with the browser not full-screen) | 278 px · 3 | 244 px · **0 rows** | 187 px | 245 px |
| 1280×600 (≈ a 1080p laptop at Windows' 150 % scaling) | 238 px · 2 | 204 px · **0** | 133 px | 205 px |
| 1400×900 at 125 % zoom | 302 px · 4 | 248 px · **0** | 197 px | 258 px |
| 1400×900 at 150 % zoom | 182 px | 96 px | **31 px** | 138 px |
| 1366×768 at 150 % zoom | 94 px | **8 px** | **0 px** | 50 px |
| 1400×900 at 200 % zoom | **0 px** | — | **0 px** | **0 px** |

  `64-grades-z150.png`: the Grades page is header, tabs, notice and a three-row bar; the first card's label is cut at the bottom edge and nothing scrolls. `62-unit-cz150.png`: the unit view ends at its legend line. `61-grid-z200.png`: no table at all, and "Working in" and ⋯ have wrapped below the fold where they cannot be reached. `75-grades-w1280x600.png`: one row of cards. In the unit view the sticky header alone is 235 px, which is why a 244 px region shows no complete row. At 200 % my walker could not click Grades, Students or a unit at all.
  Text scaling has no other route: of 271 `font-size` declarations none is in `rem` (they are px, px tokens, `clamp(px,vw,px)` or `em` of a px parent), so Chrome's Font size setting changes nothing and zoom is the only lever. There is no `max-height` media query anywhere.
- **Apple would ship.** The document scrolls. Header, tabs and notice are ordinary flow and scroll away; `#bar` is `position:sticky; top:0`; the table's header sticks beneath it; `#gridwrap` keeps only horizontal scroll. Type tokens in `rem`. A `@media (max-height:700px)` step that drops the unit view's skill header from 196 px to 96 px. Acceptance: at 1366×640 the grid shows ≥ 8 rows and the unit view ≥ 5; at 200 % every control and every row is reachable by scrolling (WCAG 1.4.4, 1.4.10).
- **Concession.** The visual lead's finding 2 (one 48 px toolbar, notice as a badge, 64 px unit headers) and the product reviewer's cuts buy back most of the rows at 100 %. They do not fix zoom: a fixed shell that is 220 px instead of 415 px is still all there is at 200 %. Do the removal first, then un-fix the shell.
- **Where.** `app.html` `body` (103–107), `#app` / `#board` (169–170), `#top{flex-wrap:wrap}` (115–117), `#tabs` (142), `#notices` (160), `#bar{flex-wrap:wrap}` (171), `#gridwrap` (187), `th.skill{height:196px}` (335), `:root --t-*` (99).

### 2. Show student tells students who have a C or a B that they "can't get to a C"
- **Repro.** pool5 → Students → any student between 70 and 89 → Show student → read the line under "Your next assessment".
- **Saw.** `67-show-tabP.png`: Sage, **71 % C**, is told "One test alone can't get you to a C from here." Opening Show for every C and B student: **19 of 32** in pool5 get that sentence (71 %, 72 %, 80 %…), and 2 of 6 in the real class — one of them at **87 % B**, the other with "— turning in the missing work is the biggest help" appended. The fallback fires whenever no single test reaches the *next* letters, and always names C.
- **Apple would ship.** The sentence names the letter that is out of reach and says what is safe: "One test alone can't get you to a B from here — and even a low score keeps your C." The teacher's page already words this case as "keeps the C" / "keeps the B".
- **Where.** `students.js` `openShow` → `recompute`, the `$('#shNeed').innerHTML` fallback (372–373).
- **Why P0.** It is a false statement about a child's grade, on the one screen built to be read by that child.

### 3. Keyboard: the focus ring is invisible on the header, on every dialog's Close and across Race; focus is then thrown away; Race cannot be left
- **Repro.** Laptop, Tab from page load; Enter on things; open Race and try to leave without the trackpad.
- **Saw — ring contrast** (ring colour against what it is drawn on; WCAG 2.4.7 / 1.4.11 want 3:1):
  - Header: `3px solid #16213A` on the navy gradient `#16213A → #1F3A5F` = **1.0–1.39:1** on all eight pills (`02-focus-students-pill.png`: Students is focused; nothing shows). The rule that should whiten it is `header .pill:focus-visible`, but `#top` is a `<div>`, so it never matches.
  - Search: `outline:none`; the border goes sand → turquoise, a change of 1.58:1 (`02-focus-search.png`).
  - Every dialog's ×, the first Tab stop of every dialog: navy ring on the navy header, **1:1** (`98-focus-mclose.png`).
  - Race and Data Lab pills (Hold to exit, Show stats, Dots, Values, Outliers): `#lb .pill:focus-visible{outline-color:white}` on the cream page, **1.09:1** (`30-race-exit-focus.png`) — a leftover from a dark Race.
  - Text fields in dialogs: turquoise on white, **1.86:1** (`98-focus-input.png`). Most checkboxes, sliders and date fields fall back to the browser's 1 px ring.
  - Everything else (tabs, bar, cells, cards, chips): navy on white or paper, 14–16:1, correct.
- **Saw — focus kept or lost.** Of 31 activations I logged, **23 leave `document.activeElement` on `<body>`**: Enter on a class tab, a unit title, a student name, Grades, Race; Escape from a unit, from a student page and from the Keep Focus note; closing the Focus check, Still owed and the seating sheet; Copy; a cell or skill skip; the status line; a category change; a Students sort; Generate; Enter or Escape on a desk; deleting a desk; leaving Show student and Race. Kept: Assigned, Prev/Next, the ⋯ menu, a dragged or nudged desk, and the four dialogs whose opener has an id. `render()` restores focus by id only (round 5 #9 fixed the cases that have one). After a sort the next Tab starts again at "Find a student".
- **Saw — trap.** In Race and Data Lab, Escape does nothing (by design), and `#lbExit` listens for pointer events only: Enter held 1.8 s and Space held 1.8 s both leave the screen up. A reload reopens Race because `settings.leaderboard` is saved. The same control on Show student has key handlers and works (WCAG 2.1.2).
- **Apple would ship.** One ring token used everywhere: 3 px, offset 2 px, navy on light surfaces and white on navy (`#top .pill`, `#top #search`, `#modal header button`), turquoise never. A view change moves focus to the new view's heading (`tabindex=-1`); Escape and dialog close return it to the control that opened them — re-found by `data-k` / `data-u` / `data-name` when it has no id. `#lbExit` gets the four lines `#shExit` already has.
- **Where.** `app.html` 134–135, 123–125, 297, 306; `app.js` 778–780 (compare `students.js` 384), `render()` `focusId` (995), the dialog observer (1783–1787).
- **Why P0, candidly.** Croix with a trackpad will not meet this today. It is here because an invisible ring on the primary toolbar and a keyboard trap are ship-blockers at the bar this review was asked to apply, and each fix is a selector or four lines.

---

## P1

### 4. The result of the weekly import is delivered in one toast slot — the gradebook confirmation is never seen and a failed file gets six seconds
- **Repro.** pool5 → drop both course exports, three gradebooks and one wrong CSV together.
- **Saw.** In order: three "Which class is this gradebook?" dialogs; at 3.1 s the toast "IXL course export — … Imported 1st Period…"; at 8.2 s it is replaced by the error "random.csv: This does not look like an IXL Score Grid export" for 6 s; nothing after 14 s. "Gradebook imported — …" is raised and overwritten in the same tick, so it never paints. Afterwards no screen says which files landed where, or that one did not. With only a bad file the error is immediate; with good files it waits 5.2 s behind the success.
  `92-import-which-0.png`: the suggested class is a filled chip that looks already chosen and must be tapped again; there is no default button and Enter does nothing. Five gradebooks are five of these in a row.
- **Apple would ship.** One import sheet for the whole drop: a row per file — name, what it is, where it goes (the suggestion in a menu), ✓ or the reason it failed — and one default button, "Import 7 files" (Return). It stays up when anything failed. The Overview keeps a "Last import · Oct 3 · 7 files, 1 skipped" line that reopens it.
- **Concession.** This is the product reviewer's point: one sheet instead of five dialogs and three toasts is fewer things, not more.
- **Where.** `app.js` `importFiles` (232–336; toasts 330–335), `pickSection` (≈975–990), `toast()` (1757).

### 5. Changes that alter grades are single taps on data, and only one of them can be undone
- **Repro.** Unit view: tap a skill's column header; tap a score cell. Grades: change an assignment's category. Quarters: Close Quarter 1.
- **Saw.**
  - Skill header: skipped **for every class of the course** on one tap. `04-unit-skill-skip.png`: the toast has no Undo and lasts 3.2 s. Assigned / Not assigned is the same.
  - Score cell: skipped for that student, Undo in the toast for 6 s (`04-unit-cell-skip-toast.png`). The Undo is not near the cell in focus order, Ctrl+Z does nothing, and the cell's cursor is the arrow. In the class grid the same-looking cell *opens the unit*; in the unit view it *changes the denominator*.
  - Category select: the class average is recomputed with no message; focus goes to `<body>`.
  - Close Quarter: `51-quarters-after-close.png` — every Overview card changes, the toast is about 45 words for 7 s, no Undo; the way back is a link inside Quarters behind a native confirm.
  - That one Undo button is the only undo outside Seating.
- **Apple would ship.** Every one of these toasts carries Undo and stays 8 s (longer while hovered or focused); ⌘Z / Ctrl+Z undoes the last of them. A skill header opens a two-item menu ("Skip for every accelerated class" / "Cancel") instead of acting at once.
- **Concession.** The product reviewer's version is better for the cell: take per-student skip off the cell and put it on the student's page, so a cell never mutates. Then only the header needs the menu.
- **Where.** `app.js` `[data-x]` handler (1209), `[data-cell]` (1212–1222), `#hideUnit` (1104); `grades.js` `[data-cat]`; `quarters.js` 188; `td.sc` (no `cursor`).

### 6. Most controls do not answer the pointer: no hover on any pill, tab, segment or chip; no pressed state on segments, cells, rows or badges
- **Repro.** Laptop; move over and press each control type (computed style at rest, hovered, pressed).
- **Saw.** Of 35 control types sampled, **8** change on hover (Overview card, unit title, grid Copy, points cell via its row, skill header, score cell via its row, Students row, seating list row). None on: every header pill, Import, class tabs, bar toggles, Grades / Seating, ⋯, the status line, the Focus badge, student names, crumb, What changed, Needs-attention rows, sort and Settings segments, L/M/H, F, room tools, Race tools, Hold to exit. Pressed feedback (1 px + scale .97) exists on `.pill .chip .tab .copy .ulink` only; segments, the status line, badges, names, cells and rows have none.
  Latency: every action paints in 28–55 ms on this machine. At Chrome's 4× CPU throttle (a rough stand-in for the Chromebox and tablet) full re-renders take 105–215 ms — class tab 188, Students 213, a sort 190, a search keystroke 143, Names 207 — and at 6×, 140–400 ms. Where there is no pressed state, that is the whole wait with nothing on screen.
- **Apple would ship.** Three states on every control, from one rule set: hover = 6 % ink overlay, pressed = 12 % plus the existing scale, focus = the ring. Rows and cells get the pressed tint on `:active`.
- **Concession.** This lands for free with the visual lead's four components (their finding 8); build the states into those rather than patching 30 selectors.
- **Where.** `app.html` 112, `.pill` (126–133), `.tab` (143), `.seg button` (310), `.chip` (350), `.nstatus` (53), `.fcheck` (231), `.nmbtn` (337), `.hatt li button` (70).

### 7. Touch targets: the newest and the most consequential controls are the smallest
- **Repro.** 1280×800, 800×1280 and 1920×1080 with a coarse pointer; every visible control measured.
- **Saw.**
  - Student name in the class grid and unit view — the route to a student's page — **97×20**, ×23, in 44 px rows (`61-grid-tabL.png`).
  - Focus check skip list: 23 rows **19 px** high at a 23 px pitch; each tick changes what counts for the whole course.
  - Show student "out of" field **64×22**; teacher what-if slider **180×16**, its number field 70×30; Show sliders 36 px with the browser's default thumb.
  - Still open from round 5: status line 40, Focus badge 36, NOT IN IXL — FIX 36, crumb 38, What changed 107×32, L/M/H 43–47×38, F 40×40, seating search 40, the Lab's Show stats / Dots / Values / Outliers and **Hold to exit 102×40** on the board.
  - Meaning by tooltip only, which touch never shows: 116 elements in Seating (L, M, H, F and the standing chip), seven header pills, the lesson strip.
- **Apple would ship.** The whole name cell is the target (44 px). Skip-list rows 44 px with the label as the target. Show: a 44 px stepper for "out of", sliders with a 28 px thumb on a 44 px row. `.lbTools .pill.small{min-height:44px}` under coarse. "Low / Med / High" and "Front" as words in the row's sheet.
- **Concession.** The visual lead's cut of L/M/H/F from the seating rows removes 92 undersized targets; I would rather that than enlarge them.
- **Where.** `app.html` coarse block (514–524), `.nmbtn` (337), `.skipList label` (46), `.nextrow input` (48–49), `.lbTools .pill.small` (365), `.hdigest` (62); `students.js` `.shL input`, `.shS input` (439–440).

### 8. Semantics: unlabelled fields, segmented controls with no state, a card whose label deletes its contents
- **Saw (computed accessible names and roles).**
  - **No name:** 13 category selects in Grades; 3 weight fields; 8 priority sliders; Settings' class name, goal and roster; the Focus check's column select; Show student's "out of"; the seating sheet's two textareas. The visible `<label>` has no `for`. Five "Turn it in" switches on Show all read "Turn it in".
  - **No state:** 16 segmented or toggle groups show selection by fill only (Settings course / review units / reminder / copy mode, New-class period and course, Chart / Room, the sheet's Behavior, Plan and flags, Place by, Partners, Race / Data Lab, Both / Accelerated / On-level, Points / %, Option 1–4). Three do it properly (`aria-pressed` on Students sort, L/M/H, F). A selected desk on the chart has no state either; in the room editor it reads "Desk 6, selected".
  - **Overview card:** `aria-label="Open 1st Period · Accelerated"` on the button replaces everything in it — 31 %, 57 %, 8 missing, the letters.
  - **Tabs:** the attention dot's text ("needs attention") is `display:none`, so nobody hears it. `role="tab"` with no arrow keys and no tabpanel.
  - **Page:** no `main`, `nav` or `header`; no skip link; `<title>` never changes; Race, Data Lab and Show student have no heading for their titles; `#lb` has an `aria-label` and no role.
  - **Tables:** names are `td`, not row headers; the Grades, Students and what-if tables have no `scope`.
  - **Live:** Show student's result (`#shIfV`, `#shDelta`) is not announced; errors use the polite toast.
- **Apple would ship.** `aria-label` on each bare field ("Category for 2.03 Worksheet"; "Turn in 2.03 Worksheet"). One segmented component with `role="radiogroup"` / `aria-checked` and arrow keys. The card as an `<article>` with a heading link, numbers readable. Tabs as plain buttons with `aria-current="page"`. `header`, `nav`, `main`; the title follows the view ("1st Period · Unit 1 — Tally"). `aria-live="polite"` on the Show result.
- **Where.** `grades.js` `[data-cat]`, weights dialog; `seating.js` 339, 401–432; `app.js` `openSettings` (1599–), `renderTabs` (1029), 1171 / 1197; `home.js` `.hcard`; `students.js` 341–358; `app.html` 529–575.

### 9. The grid is 419 Tab stops, the unit view 553, and the focused cell hides under the sticky column and footer
- **Repro.** Laptop → 1st Period → Tab.
- **Saw.** Every cell is `tabindex="0" role="button"` (374 in the grid, all of which do what the column's title already does). After 45 presses focus was still in row 1 (`03-grid-laptop-focus-cell.png`). Arrow keys do nothing. `role="button"` on a `td` removes it from the table for a screen reader, and its label ("Unit 1: 8 of 23 — open") does not say whose it is. Shift+Tab back along a row: the focused cell is under the sticky name column — 112 of 118 px, then all of it. Tabbing down: rows 12–14 took focus with 32 of 38 px under the sticky footer (WCAG 2.4.11).
- **Apple would ship.** One Tab stop for the table; arrows move a single roving focus; Enter opens. `scroll-padding` on `#gridwrap` equal to the sticky header, name column and footer.
- **Concession.** Simpler and better: remove `tabindex` and `role` from the grid's cells altogether — the header button opens the unit — which takes the grid from 419 stops to 45 with no new code. Roving focus is then needed only in the unit view, if per-student skip stays there.
- **Where.** `app.js` 1171, 1179, 1197, 1212; `app.html` `#gridwrap` (187).

### 10. Show student: acting gives no feedback where you act, the exit hold breaks on a moving finger, and focus is lost on the way out
- **Saw.** After ticking the first switch by keyboard the grade card is at y −588…−405 (`20-show-laptop-toggled.png`) — the visual lead's P0 3, which I second: it is a feedback failure before it is a layout one. Added from this lens:
  - `#shExit` has `touch-action:auto` inside a scrolling page. A 1.9 s hold survives 12 px of finger drift and is cancelled at **16 px** (`pointercancel`, both axes). The Race's exit has `touch-action:none` and survives 18 px.
  - While holding, the fill is painted over the label and "Hold" washes out (`20-show-laptop-holding.png`).
  - On exit focus lands on `<body>`, not Show student.
- **Apple would ship.** The sticky result bar the visual lead specifies, with `aria-live`; each row shows its own effect beside the switch ("+5"). `touch-action:none` on the exit; the fill behind the label. Focus returns to Show student.
- **Where.** `students.js` `#shExit` CSS (430) and handlers (381–384), `closeShow` (393), `recompute` (364–374).

### 11. There is no Back
- **Repro.** Open a class → a unit → browser Back.
- **Saw.** `history.length` is 2 for the whole session; Back leaves Tally (to `about:blank` here). No `pushState`, `popstate` or `beforeunload` in the source. Escape goes back from a unit and a student page and does nothing in Grades, Seating or Students. On the tablet the system Back gesture is the habit, and README says a locally opened file there gets a throwaway storage origin — so leaving is losing. An unsaved seating arrangement survives leaving Seating (good) but is held in memory only (`seatWork`), and only the Save button says it is unsaved.
- **Apple would ship.** One history entry per view (`pushState` with state only), so Back, the Android gesture and Alt+← all mean "up one level"; Escape maps to the same function in every sub-view. `beforeunload` only while a seating chart or a dialog has unsaved input.
- **Where.** `app.js` `render()` / the `view = {…}` assignments, global `keydown` (1788–1796); `seating.js` `seatWork` (224).

### 12. After the course exports are in, the landing still says "Drop your IXL Score Grid here."
- **Repro.** Empty Tally → drop both course-wide exports.
- **Saw.** `81-pool-only-laptop.png`: same headline, same button; a three-line toast for 7 s says to import a gradebook per period. After it goes, nothing shows that two files and 91 students are held.
- **Apple would ship.** The landing becomes step 2: "Both course exports are in. Now drop each period's Focus gradebook." with a checklist — Accelerated ✓ 91 students · On-level ✓ 91 students · Gradebooks 0 of 5 — and the same button.
- **Where.** `app.js` `render()` (`#empty` shown while `state.order` is empty); `app.html` `#drop` (551–555).

---

## P2

### 13. Dialogs: Escape, Return and a click outside behave differently from one to the next
- **Saw.**
  - Escape while typing a Keep Focus note closes the whole Focus check, not the inline form (`05-focuscheck-keepform.png` is the state it was pressed in).
  - A click on the backdrop closes every dialog. Settings discards a changed goal, class name, reminder and copy mode without a word (only the roster is guarded). The data-set editor discarded a typed list of values. The seating sheet and Priorities apply as you type, so nothing is lost there — three save models with nothing to tell them apart but the button's word.
  - Return submits in the seating forms and the Keep note; it does nothing in Category weights, Settings or "Which class".
  - Native `confirm()` at 11 call sites (three import guards, copy zeros, discard roster, remove class, clear all, delete data set, apply course settings, remove gradebook, reopen quarter), beside Seating's own confirm sheet. Round 5 listed nine.
  - Opened by keyboard, the whole panel draws a 3 px ring (`05-focuscheck-laptop.png`).
- **Apple would ship.** Escape cancels the innermost thing. A dialog with edited fields does not close on an outside click. Return triggers the one filled button; destructive confirms never default. One confirm sheet, with the verb on the button.
- **Where.** `app.js` 947–1745 (`m.onclick = e => { if (e.target === m) … }`), `openSettings` `cancel` (1648), `openCustomEditor` (1737–1745), Keep form (1569), the `confirm(` calls; `quarters.js` 190.

### 14. Toasts carry more than a toast can — including "not saved"
- **Saw.** One slot, last writer wins (finding 4). Default 3.2 s; no pause on hover or focus. A failed save (`91-save-fail-toast.png`: "Could not save — this browser's storage is full… your changes stay until you close the tab") leaves after 8 s and nothing then says the app is running unsaved. Errors are announced politely. The Undo button lives inside the live region. A hidden toast is only `opacity:0`, so its last text — sometimes a student's name — stays in the document. The visual lead's 17 covers where it sits.
- **Apple would ship.** Confirmations of one line, 4 s, paused while hovered or focused; anything with an instruction or a failure goes somewhere that stays. A band under the header while the last save failed — "Not saving on this device · Save a backup" — cleared by the next good save. `role="alert"` for errors. The node is emptied when it hides.
- **Where.** `app.js` `toast()` (1757), `save()` / `lastSaveFail`, 1798; `app.html` `#toast` (460–464, 575).

### 15. Selection is carried by fill alone — in a Windows contrast theme every segmented control and every cell state disappears
- **Saw.** Selected segment `#2DD4BF` against unselected `#DDF4F0` is 1.62:1, plus 900 vs 700 weight. `90-forced-settings.png` (`forced-colors: active`): Accelerated / On-level, None / First 1 / 2 / 3, Off / 7 / 14 / 30 days and the copy mode are identical outlines; the pale buttons lose their shape. `90-forced-unit.png`: at goal, below goal and not started are the same cell and the legend is four empty boxes; pressed header pills and the active tab are indistinguishable. This is also what a washed-out projector does to pale fills.
- **Apple would ship.** A checkmark or a 2 px ink border on the selected segment; `@media (forced-colors: active)` rules that give states a border; a glyph in below-goal cells.
- **Where.** `app.html` `.seg button.on` (311), `.chip.on` (351), `td.sc.pass / .low` (253–254), `.legend i` (180–181).

### 16. Room editor: the canvas moves under the finger, the zoom controls are off screen, and the chart cannot be dragged
- **Saw.** Selecting a desk inserts the selection bar above the stage: the tapped desk moves down **65 px** on touch and 57 px on the laptop (446 → 512 on the tablet; round 4 #11, still open). `69-room-tabL.png`: the fourth row of desks, the teacher desk, the door and + / − / Fit are below the fold — zoom controls bottom at 873 in an 800 px window; 1095 of 1080 on the board with a desk selected. On the chart, seats move by tap-then-tap; the consequence preview exists on hover only, so touch commits blind (the report and Undo that follow are good).
- **Apple would ship.** The selection bar floats over the stage's top edge. Stage height from the measured region. On the chart, drag a student onto another desk with the "fixes / breaks" line following the drag.
- **Where.** `seating.js` `renderRoom` selbar (510), chart `act` / `onmouseenter` (389–393); `app.html` `.stage svg` height (505).

### 17. Data Lab on the board: a graph type that cannot draw, and a tool cluster that covers the last class
- **Saw.** `31-lab-line-laptop.png`: with Unit 1 selected, "Line graph" is on offer and gives an empty stage with "A line graph needs data over time — pick All units…", in front of the class, with no button to do it. `72-lab-tabL.png`: the tools wrap to two rows (110 px) and sit on the last class's card and the Stats line (also at 1366×768 and at 150 %). The segments have no state for a screen reader; "%" is a button named "%".
- **Apple would ship.** Graph types that cannot draw the chosen data are disabled with the reason, or the data set switches with them. Tools in one row; Dots / Values / Outliers / stats behind one "Options" control.
- **Where.** `app.js` `labMarkup` (756–763), `LAB_KINDS`; `app.html` `.lbTools` (359–367, 456).

### 18. Contrast not in the visual report
- **Saw.** Still-owed chooser captions ("safe to post or project") **3.07:1** at 12 px; the F letter in grade chips, teal on coral, **4.19:1**; "no change" chip **4.18:1**; L/M/H unselected **4.18:1**; digest tile captions **4.30:1**; the unit view's "not started" dot **1.22:1**, where it is the only mark in the cell.
- **Where.** `app.html` `.rp-actions.col .pill small` (344), `.gchip small` (31), `.delta.flat` (43), `.seg.tiny button` (484), `.dstat small` (78), `td.sc.none` (256).

---

## P3

### 19. Motion
- Reduced motion is honoured for the Race bars only. The card lift, the toast slide and two `scrollIntoView({behavior:'smooth'})` calls ignore it. There is little motion to reduce — I agree with the visual lead that a 160 ms dialog fade and a view cross-fade would help people follow where things went.
- **Where.** `app.html` 63–64, 414, 460; `app.js` 1121; `students.js` 390.

### 20. Small things
- Escape in the search field while a unit is open clears the search and also leaves the unit.
- A filtered grid does not say "1 of 22 students" (`84-search-filter-laptop.png`).
- Icon buttons named by their glyph: ⟲ ⟳ ⧉ in the room bar (title only), ⋯.
- "Make the class" is disabled with no hint until both period and course are picked.
- The drag overlay says "Drop IXL exports anywhere" on every screen, though gradebooks and backups are accepted.

---

## Already at the bar

- **One dialog manager.** Every dialog takes focus on its panel (never an input on touch), traps Tab, is named by its own heading through `aria-labelledby`, closes on Escape, and returns focus to the opener — verified for Settings, weights, Quarters and What changed.
- **The ⋯ menu.** Opens with focus on the first item, arrows move, Escape returns to ⋯, an overlay swallows the outside tap.
- **Seating's forgiveness.** `43-seating-moved-laptop.png`: "Swapped Reese Norwood and Casey Upton · fit 60 → 60 · No new issues either way", with Undo, Discard and a Save that names what it saves. The room editor has pointer-captured drag with a 10-unit snap, arrow-key nudge, Delete, R to rotate, Escape to deselect, and an Undo that restores seats (`47-room-selected-laptop.png`). Leaving Seating and returning keeps unsaved work. `41-seating-solving-laptop.png`: Generate turns into a disabled "Thinking…" with a progress bar.
- **The seating sheet saves as you type.** Notes survived a click outside and an Escape.
- **Copy.** Written to the clipboard inside the tap, a by-hand box when that fails, a "copied Oct 3" receipt in the column header, and a toast that stays 10 s when it carries something to act on (`06-copy-laptop.png`).
- **Speed.** 28–55 ms from click to paint for every navigation at full speed. No page error in any flow at any viewport.
- **Reflow sideways.** No horizontal page overflow at any of the eight sizes walked, 700 px to 1920 px wide.
- **Projection.** Entering Race clears the toast and hides names; leaving lands on the Overview with names still off; `touch-action:none` keeps the Race's hold alive under a drifting finger.
- **Charts are named.** The ten SVG charts on Overview, Grades and the student page, and the Lab's box, histogram, bar and circle graphs, carry `role="img"`, an `aria-label` and a `<title>`.
- **Touch on the main path.** Header pills, tabs, bar toggles, unit titles, Copy, grid rows (44 px) and Overview cards all reach 44 px under a coarse pointer.
- **Close Quarter** explains itself in the dialog, is reversible, and needs no second confirm.

---

## My position for the crit

The visual lead is right that Tally is under-designed where its voice meets a number; my evidence says it is under-built where it meets a hand. A fixed shell that leaves the Grades page 31 px tall at 150 % zoom, a student screen that tells an 87 % B they cannot reach a C, a toolbar whose focus ring is navy on navy, a projected mode a keyboard cannot leave, an import that never shows its own gradebook confirmation — none of these is fixed by a type ramp or tabular figures, and all of them would stop a crit at Apple before anyone discussed weights. So the order I will argue for is: correctness of what the student is told (2), reachability (1), the keyboard (3), then the things that let Croix trust what just happened — the import sheet, Undo on anything that changes a grade, a persistent "not saved" — and only then polish. I will concede wherever removal or one good component beats more states, and it often does: the visual lead's toolbar cut and four components would close most of findings 1, 6, 8 and 15 in one pass; the product reviewer's instincts beat mine on the grid (drop 374 focusable cells rather than build roving focus), on per-student skip (move it off the cell rather than add undo), on the seating row toggles and on five import dialogs becoming one sheet. What I will not trade is the scrolling shell, the ring, the exit, labels on fields and Undo on grade-changing taps: those are the floor the polish stands on.

---

## Crit response (interaction)

4 Oct. Re-checked in the build; new shots `r6i/c1-*.png`, `c2-*.png`, `c3-*.png`. Row counts are mine.

### 1. First build, ranked
1. **Interaction 2** — `students.js` 372–373. A false sentence about a child's grade on the child's own screen; fifteen minutes.
2. **Product 1** — `home.js` `attentionItems` (17–33), `focusChip` (42); `app.js` `renderNotices` (1054–1056). The home screen ticks "Focus ✓" while a unit waits to be copied; wrong feedback outranks missing feedback.
3. **Interaction 3 as engineering costed it** — `app.html` 134 (`#top .pill`, `#modal header button`, drop the `#lb` white ring); `app.js` 780 (keys on `#lbExit`). A dead selector and four lines remove the invisible ring and the trap.
4. **Engineering 6, rules A and B** — `app.html` `body`, `#app`, `#board`, `#top`. Re-run here: at 200 % no control is out of reach and the grid shows 5 rows; at 150 % on the Chromebox, 7.
5. **Engineering 12's import report** — `app.js` 330–335. The gradebook confirmation never paints today; one result list that stays is two hours.

### 2. Opposed
- **Product 3, "names match → no dialog", on today's test.** `pickSection` (`app.js` 979) calls it a match at half the names with a one-name lead. A gradebook of 12 first-period and 11 third-period names is offered as "1st Period · names match" (`c1-mixed-names-match.png`); accepting it replaces that class's gradebook, with no Undo. Auto-route only at ≥ 90 % of names with no second class above a quarter, and only once engineering's checkpoint Undo covers imports.
- **Visual 17, toast top-centre under the header** (`#toast`, `app.html` 460). Prototyped at y 98: it sits on three class tabs (2nd–4th on the laptop, 3rd–5th on the board) for as long as it shows, and Undo lands 610–685 px from the cell just tapped, against about 330 today (`c3-toast-top-undo-laptop.png`). Keep it at the bottom, clear of the footer row, never over a dialog.
- **Engineering 6, rule C** (`th.skill{height:120px}`). On the tablet it clips 19 of 23 skill names (`c2-unit-tabL-ABC.png`: "Convert between", "Solve two-step equations with" twice). Those headers are the one-tap course-wide skip, on a device with no tooltip. Without C the unit view at 200 % still has no complete row, so the header needs visual 2's redesign, not truncation.

### 3. Withdrawn or downgraded
- **Interaction 1, remedy withdrawn.** The engineer is right: `overflow-x:auto` keeps `#gridwrap` the sticky container, so document scroll loses the table header. A + B give the reachability I asked for. The finding stays P0; `rem` tokens stay.
- **Interaction 4, pre-commit sheet withdrawn.** Engineering 12's report plus product 3's auto-route (under the stricter test above) earn the same trust without a two-phase `importFiles` (232–336).
- **Interaction 11 → P3.** Engineering 14 stands: one history entry per view makes Android Back an instant exit from Show student and Race. `beforeunload` now (`seating.js` `seatWork`, 224); history later, with `popstate` refused in `lbMode` / `showMode`.

### 4. What all four would sign
- The quarter-hour fixes first: `students.js` 372–373, `.warnline` (`app.html` 345), the ring and `#lbExit`.
- "Focus ✓" only when nothing is stale (`home.js` 42).
- The board stays the scroller, with a floor and a one-row header (`#board`, `#top`).
- An import's result stays on screen (`app.js` 330–335).
- Remove before polishing: upcoming columns, seating row toggles (`.seg.tiny`, `.ft`), the notice band (`.nstatus`).
- The layout-contract suite before any component or type refactor; `--test` builds to its own file (`build.py` 33–35).
- Show student: sticky result (`.shGrade`), no trend card (`.shTrend`).
