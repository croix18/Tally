# Round 6 — product lead (what it is for, fewest decisions, say no)

3–4 Oct 2026. Test build (`python3 build.py --test`), Playwright + Chromium, driven from a scratchpad copy of `Tally.html`; no repo file edited (the repo's `Tally.html` / `index.html` are the test build all three of us left — run `python3 build.py` before committing).
Screenshots: `/tmp/claude-0/-home-claude/b89b0f3d-86a2-5e43-8a51-10fb416b8565/scratchpad/r6p/` (names below are in that folder; every one cited was opened and looked at). Scripts and logs (`j1…j12.js`, `*.log`) are beside them.

**States.** *fresh*: an empty Tally, then all seven weekly files dropped at once (both course-wide IXL exports, `focus_gradebook_pool_p1/p2`, the visual lead's three synthetic gradebooks), then the same seven dropped again — the real Monday. *pool5s* and *real*: the two seeded states the other leads used, so we argue over the same data. The pool gradebooks are synthetic, so I judged the structure of the Focus check there and took numbers from *real*.
**Viewports.** 1400×900 mouse for every job; 1920×1080 touch for the board; 1280×800 and 800×1280 touch+mobile for the student-facing screens; one pass each at 1366×768 and 1024×768.
**Counts.** "Words" are visible words (text nodes, not hidden); "controls" are visible enabled buttons, fields, selects and `role=button` cells; taps were counted by the script that performed them. My runs straddled midnight: the 7-day reminder fired between them, which is why the Overview's list is 9 lines in `10-overview-tall.png` and 14 in `100-overview-oct4-tall.png`. Same state, one day apart.

## The jobs, measured

| job (NOTES "Weekly routine" + the brief) | taps | dialogs | questions asked | words to read | where it ends |
|---|---|---|---|---|---|
| Monday import, weekly (7 files) | 6 | 5 | 5, each already answered ("names match") | 235 in dialogs + a 55-word toast | 5th Period's grid |
| Monday import, first time | 21 | 10 | 15 | 410 + a 71-word toast | 5th Period's grid |
| Copy a unit into Focus | 2 per class (tab, Copy) | 0 | 0 | 22-word toast | — |
| *Which* units need copying | open each class, read column badges | — | — | — | not on the Overview |
| Check Focus agrees | 2 (Overview row → grid, badge) | 1 | 0–3 | 221 (normal) · 550–610 (points differ) | — |
| Kid at the desk | 2 from a class grid · 3 + typing from the Overview | 0 | 0 | teacher page 965 · Show 264 | the answer is the 4th card |
| Parent conference | 2 (name, Print report) | 0 | 0 | 549 on paper, 321 of them IXL skill names | 1150 px of a 1056 px page |
| Board on | 1 (Race) · 2 (Data Lab) | 0 | 0 | 150 on the Race | — |
| Close a quarter | 2 + a scroll | 1 | 30 checkboxes | 324 | a longer alert list |
| Save backup (routine step 4) | 2 + a scroll | 1 | 0 | — | nothing prompts it |
| Yearly seating, from nothing to the print dialog | 10 | 2 | 1 (template) | — | — |

Copy and Seating are already short. Everything else is longer than the job.

---

## P0

### 1. The Overview says "Focus ✓" while the week's copying is undone
- **Job.** Step 3 of the routine: "copy each unit into Focus. The Focus check badge on each unit says whether Focus agrees." This is the product's name line, IXL → Focus.
- **Repro.** *real* → Unit 2 copied Sep 28, two students have since passed more skills; Unit 1 settled the way the dialog offers (`j9.js`, `j10.js`). Open the Overview, then the class.
- **Saw.** `98-overview-focus-ok-but-stale.png`: the card's chip reads **Focus ✓** and Needs attention lists the roster and an old export — nothing about Unit 2. `97-grid-only-stale.png`: the same class's Unit 2 header reads **Focus: 2 up since copy**. With Unit 1 still off (`95-overview-stale.png`, `96-grid-stale.png`) the card says "Focus: 1 unit off" and the class status line says "2 things to look at" — Unit 2 is counted in neither, because the notice chain shows the "moved up since" line only when no other unit is off.
  So the one question the routine asks every Monday — what do I copy now — is answered by an 11 px badge inside a column header inside each class, five classes deep, and contradicted by a tick on the home screen. Meanwhile the first 900 px of the Overview (`10-overview.png`) carry 355 words: four metrics, a letter row and up to three chips per class.
- **Apple would ship.** The Overview's first screen is the routine, not a dashboard:

  > **This week** · imported Mon Oct 5, 7 files
  > **Copy to Focus** — 1st Period · Unit 2 · 2 students moved up since Sep 28 · `Copy`
  > **Copy to Focus** — 3rd Period · Unit 2 · 4 students moved up · `Copy`
  > **Check** — Accelerated · Unit 1 · Focus is out of 15, IXL counts 23 skills · `Review`
  > **Back up** — last saved Sep 28 · `Save backup`

  Each row does the thing from where it is (Copy copies; Review opens the Focus check). When the list is empty it says **"Focus is up to date."** and nothing else. The card chip is `2 to copy`, and ✓ appears only when nothing differs, is missing or has moved. Cards shrink to name, IXL % and Focus %; the four charts move under a "Trends" disclosure.
- **Where.** `home.js` `attentionItems` (17–33: pushes `off`, never `counts.stale`), `renderHome` `focusChip` (42: `off ? … : 'Focus ✓'`); `app.js` `renderNotices` (1054–1056: `if (off.length) … else if … else if (stale.length)`).
- **Why P0.** A daily surface that misleads about the product's own job.

### 2. Alerts that cannot be cleared — four of five classes wear a red dot for ever
- **Job.** Step 3: "check the roster-mismatch notice".
- **Repro.** *pool5s* → 1st Period → tap `NOT IN IXL — FIX` on Dakota Quill → **No IXL account (blank row)** (`j10b.js`).
- **Saw.** `71-fixer.png` → `99-after-no-ixl-account.png`. Before: "2 things to look at · 1 note", flag on the row. After: the same line, the same flag, no toast. The choice is stored (`aliases["QUILL, DAKOTA"] = "#none"`) but it only un-matches the row; nothing treats it as an answer, so the flag, the coral band, the tab dot and the Overview line stay. A student who is in Focus and never signs in to IXL keeps the class in alarm all year — in this state that is four classes of five.
  `100-overview-oct4-tall.png`: Needs attention is **14 lines, 167 words, 600 px tall, starting more than 1,000 px down** — under the fold of a 900 px window — for four causes and three actions: one student per class with no IXL account (×4 lines), one course-wide skill count for Unit 1 (×2), one unpicked on-level unit (×3), and two files that are eight days old (×5). Every class page carries a 52 px full-width coral band above its bar (`11-grid-p1.png`); four of five tabs carry the dot on every screen, including a student's page.
- **Apple would ship.** A dot means "something you can do today"; if nothing is, there is no dot and no band.
  - "No IXL account" is a state, not a flag: the row reads `no IXL account` in grey, the notice and dot go, and the row's menu offers "Match to an IXL account…".
  - One line per cause. Course-wide causes are said once ("Accelerated · Unit 1…"), file age once ("IXL exports are 8 days old"), in the import line, not in the list.
  - "assigned by guess" leaves the list (finding 5).
  - The band goes; the class bar shows `2 to fix` as a quiet link when there are any.
- **Where.** `app.js` `openFixer` `#unmatch` (1267) and `buildRows` (144–), which has no "known, no account" status; `renderNotices` (1036–1067); `renderTabs` (1025–); `home.js` `attentionItems`.
- **Concession.** The visual lead's finding 9 restyles these bars as white rows with a dot, and their finding 2 turns the band into a badge. Both are right and both are smaller once there are four lines instead of fourteen.

---

## P1

### 3. The Monday import asks five questions it has already answered, then lands in the wrong place
- **Repro.** *fresh*, second drop of the seven files (`j1.js`).
- **Saw.** `05-import-weekly-dialog-03.png`: "Which class is this gradebook?" with **3rd Period · Accelerated · names match** pre-filled, five times in a row — 6 taps, 235 words. `06-import-weekly-landed.png`: it ends on 5th Period's grid (the last file's class) under a 55-word toast that covers the Class-average row; "What changed" and the Overview are a tap away and nothing points to them. First time (`02-import-first-dialog-03.png`, `03-import-first-landed.png`): ten dialogs, 21 taps, and a 71-word toast that twice says "import a Focus gradebook for each period to make its class" about the five gradebooks it has just imported (the pool message is composed before the gradebooks are processed).
- **Apple would ship.** Weekly: **one tap, no dialog.** A gradebook whose names match exactly one class goes there. Ask only when no class matches or two tie. Then show the Overview with the line from finding 1 — "imported Mon Oct 5, 7 files" — which opens the per-file list ("gb_p3.csv → 3rd Period · 20 of 20 names · Change…"). First time: one sheet, five rows, a period and course picker per row, one button "Make 5 classes".
- **Against the interaction lead's finding 4.** They want one sheet with a row per file and "Import 7 files". That is one confirmation of five things the product knows; I want none. Their sheet is right as the *exception* and as the per-file record behind the import line. They are right that the result must persist somewhere — that is the import line, not a toast.
- **Where.** `app.js` `pickSection` (972–988: `best` is computed, then asked anyway), `importFiles` (307–308; 264 for the stale sentence; 328 `view = { mode: 'units' }`; 330–335 toasts).

### 4. Step 4 of the routine has no place in the product
- **Job.** "Save backup to Drive." NOTES: the laptop and tablet are separate Tallys and "the backup is the bridge"; the tablet's storage does not persist.
- **Saw.** `30-settings-from-overview.png`, `30-settings-backup.png`: **Save backup** is control 25 of 30, below the fold of a dialog titled "1st Period · Accelerated" (the body is 944 px in a 670 px box). Nothing records when a backup was last saved (`grep lastBackup` → nothing) and nothing prompts one. The Guide's "Every week or two" list has five steps and the word "backup" appears nowhere in it (`35-guide.png`).
- **Apple would ship.** The last row of "This week": **Back up — last saved Sep 28 · `Save backup`**, turning to "Backed up today" once done. One stored date.
- **Where.** `app.js` `openSettings` (1633, 1698), `openGuide` (1388–); `home.js` `renderHome`.

### 5. "Which units count" is seven mechanisms, and the default is a guess the product then complains about
- **Saw.** One question, answered by: **Working in** (class bar select), **Assigned / Not assigned** (unit bar), **Units not assigned at the start: None / First 1 / 2 / 3** (Settings), the **25 % auto-assign rule**, the **N unassigned unit** toggle (bar and ⋯), **upcoming** columns, and **Just Unit N**. The Guide spends two glossary entries and a setup step on it.
  `82-grid-onlevel-noworkingin.png`: with nothing picked, on-level offers Copy on Units 2, 3, **8 and 10**, and the Overview says so three times as "assigned by guess". `03-import-first-landed.png` is the same screen as the first thing a new user sees. The Overview chip then says "Focus IXL column (Unit 1) not assigned in Tally — pick Working in" — the product can see which units Focus has columns for and asks anyway. (Which unit it names is an artifact of the synthetic gradebook; the behaviour is not.)
  `11-grid-p1.png`: 14 of 17 columns are "upcoming". They hold 322 cells of which **5 are not zero** (5 students), and make the table 2,296 px wide in a 1,342 px view.
- **Apple would ship.** One control, named **Current unit**, one per course, pre-set to the highest unit that has a Focus IXL column (asked once in the import line when there is no gradebook). Units from the first counted one to the current one are the grid. Everything later collapses into one column, **Ahead**, showing a count only for students who have one — the stated reason for "upcoming" (see who is working ahead) kept in one column instead of fourteen. The 25 % rule, the unassigned-units toggle and "assigned by guess" go. Assigned / Not assigned moves into the unit's ⋯ as "Don't count this unit". With four columns on screen, Just Unit N has nothing left to relieve; retire it then.
- **Respecting the record.** Review units and course-wide skill skips are Croix's real needs (NOTES, Setup) and stay. "Later units stay listed as upcoming" is a recorded decision; the Ahead column keeps its purpose.
- **Where.** `app.js` `unitsOf` (185–), `renderBar` (1068–1124: `#onlyCur` 1075, `#toggleAll`, `#curUnit`, `#hideUnit`), `openSettings` `#skipFirst` (1610); `home.js` 28 and 42.

### 6. Closing a quarter promises quiet and makes the list longer
- **Job.** 9 Oct. Croix's words in NOTES: the quarter should "go dark (no alerts)".
- **Repro.** *pool5s* → Overview → Quarters → Close Quarter 1 (`j6.js`).
- **Saw.** Needs attention goes from **9 lines to 12**: five new "waiting for the first Quarter 2 gradebook" (`72-overview-after-close-pool5s-tall.png`). Every card becomes `—`, `0`, `0 students`, `—`, `needs 2 gradebooks`, `A 0 B 0 C 0 D 0 F 0`, and four still say "1 thing to look at". "Missing work 0" reads as a fact; it is an absence of data. The toast is 35 words (`62-quarter-closed.png`).
  The dialog (`32-quarters.png`): 324 words, 37 controls — four date fields, 30 unit checkboxes of which two are ticked, and the same 20-word caution on all five rows.
- **Apple would ship.** After closing: the Overview's meta reads "Quarter 2 · no gradebooks yet" once; each card shows `Quarter 1 final 57%` as its Focus number and drops Missing, Sliding and the letter row until Quarter 2 has data; no list entries. The dialog: "**Close Quarter 1?** Tally keeps every score and stops reminding you about it. You can reopen it." Then one sentence, "IXL units in Quarter 1: Accelerated 1 · On-level 1 — `Change`", the caution once, and `Close Quarter 1` / `Not yet`. Dates live behind "Quarter dates…".
- **Where.** `home.js` `attentionItems` (26), `gradeSummary` (8), card markup (45–52); `quarters.js` `openQuarters` (161–181), toast (188).
- **With the visual lead.** Their P0 1 fixes how the caution paints; saying it once removes four of the five.

### 7. A kid asks "what do I need to do" and the answer is the fourth card
- **Saw.** Show student, `23-show.png` / `23-show-tall.png`: grade card, three category bars with a 20-word explanation, a trend card holding one unlabelled line, and then "Your quickest way to a D" at y 647–875. On the tablet it is cut by the fold (`93-show-tabL.png`, card at 647–829 of 800) and the first switch is at y 884. Fifteen controls on the page; three on the laptop's first screen — Start over, Hold to exit, Show me on the sliders — and none of the switches. "Show me on the sliders" then scrolls the grade off the top (`24-show-path-applied-tabL.png`).
  Teacher page: on the laptop the plan is top right, in view (`22-student-page.png`) — good. At 800×1280 and 1024×768 the columns stack and it falls to **y 2062** and **y 1775**, under five charts and two tables (`92-student-tabP.png`).
- **Apple would ship.** Show student in this order: name; `47% F → 62% D` in one compact bar that stays put; **"Turn in these 3 worksheets and you have a D."** with the three lines and one button, `Try it`; then the switches. Delete the category bars and the trend card from this screen — neither answers the question asked. On the teacher page the plan and what-ifs come first when the columns stack.
- **With the other two.** The visual lead's P0 3 and the interaction lead's 10 want a sticky result bar. Agreed — but removing two cards (about 300 px) puts the plan and the first switches on the tablet's first screen before any sticky work, and leaves less to stick.
- **Where.** `students.js` `openShow` (345–359: `.shCats`, `.shTrend`, order), `STU_CSS` `.pcols`.

### 8. The Focus check is four jobs in one dialog
- **Saw.** `18-focuscheck.png`, `18-focuscheck-bottom.png` (*pool5s*, points differ): 610 words, 50 controls — a 23-row skill tick-list, an 18-option "This Focus column is" select, a per-student table, and 21 "Keep Focus" buttons under it. While the denominators disagree every row differs, so the table and its buttons are noise until the top is settled. On *real* the same case is 550 words / 38 controls; the ordinary weekly case (`87-real-focuscheck-1.png`) is 221 words / 7 controls and is fine — except that the column select sits above the table every week, and "Focus differs from Tally" is written on every coral row the stripe already marks.
- **Apple would ship.** Two things. **Set up Unit 1** (once): "Focus is out of 15. IXL has 23 skills. Which 8 don't count?" — the tick-list, one button, nothing else. **Focus check** (weekly): summary as the headline ("14 match · 2 differ"), only rows that differ, the reason column removed, the column mapping behind "Wrong column?". One primary: `Copy 2 corrections`.
- **Where.** `app.js` `openFocusCheck` (1533–1576).
- **With the visual lead's 18.** Same dialog; they collapse the tick-list and even the row heights. I would not show both halves at once at all.

### 9. Settings is three scopes in one dialog, opened for a class nobody chose
- **Saw.** From the Overview, Settings opens as "1st Period · Accelerated" (`30-settings-from-overview.png`) — whichever class was last active. 456 words, 30 controls, 14 labelled parts: this class (name, goal, course, roster, gradebook, remove), this course (review units, course settings file), every class (best score, reminder, copy format), the Data Lab's own data sets, two share exports, backup, clear everything. Three of them reach beyond the class in the title and say so only in the small print ("Applies to every class", "for every class of this course").
- **Apple would ship.** **Class** settings from the class's ⋯ (name, goal, course, roster, remove). **Settings** (gear): reminders, best score, copy format, backup, clear — no class in the title. Course rules live with Current unit. Share and "our own data" move to the board's Options.
- **Where.** `app.js` `openSettings` (1595–1731; markup 1598–1640).

### 10. The student page and its printout carry everything; a conference needs three things
- **Saw.** `22-student-page-tall.png`: 965 words on a 2,040 px page (3.5 screens), five charts, two tables, four what-if blocks. **321 of the words are IXL skill names.** "Missing work" and "IXL skills at goal" charts restate the two tiles above them. The retake grid is 12 cells of three numbers each, and the same what-ifs exist again as switches on Show student.
  `85-print-report-real.png`: 549 words, 321 of them skill names, 1,150 px tall at 816 px wide — longer than a Letter page (1,056 px), which is the second sheet the visual lead's PDF shows — and the last row of the table a parent reads says "an A isn't reachable on one assessment · a B isn't reachable on one assessment · a C isn't reachable on one assessment".
- **Apple would ship.** Page, first screen: grade, the plan, what-ifs. Then "Grade over the year" and "Assessments". Category, missing and IXL charts, the full assignment list and IXL by unit each behind a disclosure, closed. IXL by unit names at most three skills per unit, closest to goal first, then "and 17 more".
  Report: grade, "Quickest way to a D", then "IXL still to do: Unit 1 — 20 skills, Unit 2 — 15, Unit 3 — 19". One page. The next-assessment row reads "One test alone won't change the letter; the missing work will."
- **Respecting the record.** Croix asked for "everything about one student fast", trends, and what-ifs, and "nothing extra". Everything stays reachable; the order is the change. NOTES already lists a plain-language parent report as not built — this is that.
- **With the visual lead's 11.** They would redraw the two small charts at 1:1. I would remove them; the tiles say it.
- **Where.** `students.js` `renderProfile` (126–), `grades.js` `studentReportSection` (284–292).

### 11. The same list, twice; the same class, eight times
- **Saw.** Grades ends in a Students table (`33-grades-tall.png`): student, grade, since, missing, weakest category, IXL. The Students list (`80-students.png`) filtered to that class: student, class, grade, since, missing, IXL, quickest, closed quarters. Two lists of the same 23 children with different columns and different name formats ("PRYOR, GREER" / "Greer Pryor"). On the Overview "1st Period · Accelerated" is written eight times as text and four more in charts; the tab strip repeats the five cards directly beneath it, and with one class it is one tab above one card (`95-overview-stale.png`).
- **Apple would ship.** Grades keeps the class: average, categories, assignments. Its student table becomes "See these students ›" into the Students list filtered to the class. On the Overview the cards are the navigation and the tab strip is absent; tabs appear once you are inside a class.
- **Where.** `grades.js` `renderGrades` (205–), `students.js` `renderStudentsView` (79–), `app.js` `renderTabs`.

### 12. The header is the order things were built in
- **Saw.** `10-overview.png`: Find a student · Overview · Students · Guide · Race · Names · Details · Settings · Import — two places, a manual, a projection mode named after half of itself, two toggles, a dialog and an action, as nine equal pills. The weekly routine uses three. At 1366 px Import, the only primary, wraps alone to a second row (`90-overview-cbox.png`). Grades and Seating are reached from a class bar, Students from the header, Quarters from two bars.
- **Apple would ship.** Three places and one action: **Classes** (Overview → class → unit, with Grades and Seating inside a class), **Students**, **Board** (Race and Data Lab); **Import**. Search stays. Names moves into Board's entry and the class ⋯. Details, Settings, Guide and Backup sit behind one ⋯.
- **With the visual lead's 2 and 8.** Same toolbar, reached from the other side. I would cut to four items before building four components.
- **Where.** `app.html` `#top` (529–546), `app.js` 998–1010, 1763–1768.

### 13. The board: three statistics per class on the Race, 243 data sets in the Data Lab
- **Saw.** `40-race-board.png`: each card carries the rank, a bar, "31% complete · 397 of 1,298 skill-points · 22 students", "+1.2 skills per student since Sep 19", a "furthest along" tag and "64 % moved up" — 150 words for five classes, read from 4 m. Under "On-level": "assigned: Unit 2 – Unit 10", the guess from finding 5, in front of the class. `41-lab-board.png`: 13 controls in the bar; the data-set select holds **243 options in 21 groups**, 219 of them single skills.
- **Apple would ship.** Race card: name, bar, one number, one line — "14 of 22 moved up this week". "Furthest along" stays as the only tag. Data Lab: the select lists units, "All units", the gradebook's assignments and the class's own sets (about 25); "A single skill…" opens the rest. Dots, Values, Outliers, stats and Points / % go behind one `Options`.
- **Respecting the record.** The seven graph types are what Croix asked for and stay.
- **With the visual lead's 7.** Their board type ramp needs room; one line per card is where it comes from.
- **Where.** `app.js` Race card (455–462, chips 459–460), `labMarkup` (657–, tools 756–766).

---

## P2

### 14. First launch explains the data model before anything has happened
- **Saw.** `01-first-launch.png`: 152 words. The headline asks for "your IXL Score Grid" when the job is seven files from two systems; the subhead is 33 words about per-period exports and "the course's pool"; "How it works" covers skips and roster pasting. After one course export the page is unchanged (`75-first-one-course.png`); a colleague's first Overview is a card of four dashes with a "What changed ›" button that opens "needs two imports" twice, with a Print button (`77-first-section-overview.png`, `101-digest-first-import.png`).
- **Apple would ship.** "**Drop this week's exports.**" / "IXL Score Grids and Focus gradebooks — all of them, any order." / `Choose files`. Underneath, a three-line checklist that fills in as files land (IXL · Focus gradebooks · classes). The privacy sentence stays. "What changed" is hidden until there is a second import.
- **With the interaction lead's 12.** Same checklist. The visual lead calls this screen at the bar; the layout is, the words are not.
- **Where.** `app.html` `#drop` and `.how` (551–561); `home.js` card (52), `openDigest` (152).

### 15. Names
| now | problem | Apple would call it |
|---|---|---|
| Focus doesn't match **Tally** · columns FOCUS / TALLY | the product's name used as a data source; the teacher's question is IXL against Focus | "Focus has 17 · IXL earns 16"; columns **In Focus** / **From IXL** |
| **Keep Focus** · "kept on purpose" · "Flag again" | reads as attention; three words for one state | **Use Focus's score** · "Accepted" · **Stop accepting** |
| **Working in** | fine, but a label without a noun | **Current unit** |
| **Just Unit 3** | — | retire (finding 5); else "Unit 3 only" |
| **Race** (opens Race and Data Lab) | half the destination | **Board** |
| **Show student** | "show me the student" or "show it to the student"? | **Student View** |
| **Details** / "Calm view" | names for a density setting | "Show more" in ⋯ |
| Needs attention · "things to look at" · "notes" · "all good" | four names, one list | **To do** |
| IXL work at goal · IXL at goal · % complete · skill-points · IXL progress | five names, one number | **IXL done** |
| since the last **import** / since the last **export** (same tile row) | one event, two words | "since last week" with the date |
| pool · "assigned by guess" · "names match" | internals | never shown |
| **Place by** · **Blend** · **Keep lows apart** | "low" is also the L in L/M/H behaviour, on the same screen | **Seat by** · **Everything** · "Don't pair two students who are struggling" |
| **Fit 60** + 20-word caveat | a score that needs an apology | "Good fit" / "2 problems" |
| `A 70 · C 25 · P 5` (Grades bar) | an abbreviation as a button | **Weights** |
| **Names** (white = showing) | a state that looks like a place | **Hide names** as an action |
| IXL → FOCUS under the wordmark | a third of what it now does | drop it |

Already right: **Tally**, **Still owed**, **What changed**, **Quickest way to a D**, **Hold to exit**, **Data Lab**.

### 16. Seating asks for sixteen decisions before the first chart
- **Saw.** `58-priorities.png`: Place by (5), Partners (3), eight sliders — 172 words, 19 controls. `50-seating-empty.png`, `55-chart-generated.png`: 148 controls on the chart page, 92 of them L / M / H / F on list rows whose meaning is a tooltip; "Fit 60 — 60% less priority cost than a random seating (the fill-from-front and standing bands always cost something, so 100 isn't reachable)"; four options all "fit 60".
- **Apple would ship.** Priorities shows two choices — **Seat by** and **Partners** — and "Fine-tune…" opens the sliders. Behaviour and Front seat live on the student's sheet. Options show what differs between them, not an identical number.
- **Both leads already concede the row toggles.** The 10-tap path from nothing to a printed chart is the best flow in the product; this is trimming around it.
- **Where.** `seating.js` `openSeatWeights` (399–406), list rows (349), options and fit card (339–342).

### 17. The Guide is a 926-word glossary
- **Saw.** `35-guide.png`: 15 defined terms; the weekly list is five steps and omits the backup; "For a co-teacher" is the only part written for a first-time reader. A header pill for a page read once.
- **Apple would ship.** Less to define: after findings 5 and 15 most of the fifteen explain themselves. Keep a half-page "Every week" (with the backup in it) and "For a co-teacher", reached from ⋯.
- **Where.** `app.js` `openGuide` (1388–1465).

### 18. Toasts are written as log lines
- **Saw.** Copy (`16-grid-copied.png`): "Unit 1 copied — 23 rows in FOCUS order · FOCUS title: IXL Unit 1 · Sep 26 · /23 · 1 blank row (not in IXL)" — 22 words, and "FOCUS title:" is a suggestion written as a field. Import 55 and 71 words; close quarter 35; "Working in" 14.
- **Apple would ship.** "Copied Unit 1 — 23 rows, in Focus order." Anything longer belongs on the screen it describes (the import line, the unit's receipt).
- **With the others.** The visual lead's 17 moves the toast; the interaction lead's 14 gives it rules. Eight words need neither.
- **Where.** `app.js` `copyUnit` (1321), `importFiles` (330–335), 1114; `quarters.js` 188.

### 19. Choices that are not choices
- **Saw.** `61-reports.png`: "Everyone — 23 pages" / "Only students who owe something — 23 pages". `71-fixer.png`: 53 chips to match one student, in file order (round 5's open item). Still owed asks one of three formats every time. A category select on every assignment row in Grades although the fit has proved all of them (✓).
- **Apple would ship.** One button when the answers are the same. The fixer shows the three closest names and "Search all…". Still owed remembers the last format. Proved categories are text; "Change" appears on hover or in the row's menu.
- **Where.** `grades.js` `openStudentReports` (327–), `app.js` `openFixer` (1248–), `openStillOwed` (1326–), `grades.js` assignments table.

### 20. Details is a second grid behind a header switch
- **Saw.** `15-grid-details.png`: tabs grow to two rows, both notices open, the bar wraps to two rows, and Copy appears on every upcoming unit. It is offered twice (header pill and ⋯).
- **Apple would ship.** Keep the mode — calm-by-default with a way back was the 26 Sep decision — and keep one entry, in ⋯. Long term, each thing Details reveals should be reachable where it lives.
- **Where.** `app.html` `#btnDetails` (538); `app.js` `renderBar` (1081 `#mDetails`), 1768.

---

## P3

### 21. Instructions set as interface
- "Tap a class to open it", "Tap a student for everything: grades, trends, what-ifs", "Tap a student for their page…", "Tap a student on the chart to see why…", "Tap a unit for skill scores", and the 19-word legend on the unit bar. Six standing sentences that say a thing is tappable. Make the thing look tappable and delete them.
- "down 3+ or more missing" defines Sliding on all five cards, every day.
- **Where.** `.legend` spans in `home.js` 64, `students.js` 93, `grades.js` 203, `seating.js` 351, `app.js` 1082 and 1097; `home.js` 49 for the Sliding caption.

### 22. Small
- `Just Unit N` builds the same label in both branches of its ternary (`app.js` 1075).
- The ⋯ item is "What changed this week"; the card says "What changed ›"; the dialog "What changed".
- The page behind every import dialog on first run still reads "Drop your IXL Score Grid here." (`02-import-first-dialog-03.png`).

---

## Three things I would cut or hide

1. **Everything after the current unit** — 14 columns, the unassigned-units toggle, the 25 % rule, Assigned / Not assigned on the bar, then Just Unit N — replaced by Current unit and one Ahead column (finding 5).
2. **The Overview as dashboard** — four metrics and a letter row per card, four charts — replaced by the This-week list, with trends one tap down (findings 1, 2).
3. **The back half of Settings and the Data Lab's long tail** — copy format, share exports, course-settings files, own data sets, 219 single-skill data sets, five graph toggles — behind one disclosure each (findings 9, 13).

Runner-up: the L / M / H / F row toggles and the eight sliders (16).

## Already at the bar

- **Copy.** Two taps per class, no dialog, rows in Focus order, a receipt in the column header (`16-grid-copied.png`). This is the product and it is as short as it can be.
- **Seating's path.** Ten taps from no room to the print dialog; "No desks yet. Draw your room first — it's shared by every class." with the button in the sentence (`50-seating-empty.png`); six templates each drawn as a picture, with the desk count pre-filled from the class (`52-room-templates.png`).
- **New class** (`02-import-first-newclass-picked-1.png`). Period, course, one button; nothing to remove. My complaint in finding 3 is that it appears five times, not what it is.
- **"Quickest way to a D."** Three numbered steps in the student's own terms, the same on the page, the list ("1 missing → D"), the report and Show student. The best sentence in the product; it deserves to be first.
- **The ordinary Focus check** (`87-real-focuscheck-1.png`): "14 match · 2 differ", a coral stripe down exactly the column that disagrees.
- **What changed** (`31-digest.png`): eight numbers, five run-in lines, nothing else. It should be where the import lands.
- **Close Quarter's mechanics.** Two taps, reversible, no second confirm. The words and the aftermath are the problem, not the action.
- **Student page on the laptop** (`22-student-page.png`): the plan is top right on the first screen, with Prev / Next for back-to-back conferences.
- **The ⋯ menu** on the class bar: four items, plainly named.
- **Search** from the Overview: four letters and one tap to a student's page, with the plan already in the row — "3 missing → D" (`21-find-student.png`, `22-student-page.png`).

## My position for the crit

Tally was built to move one number from IXL into Focus and it does that in two taps; then it grew grades, students, quarters, seating, a race and a lab, and each arrived with its own pill, its own list of the same children and its own vocabulary, until the home screen shows 632 words and a tick while the week's copying sits undone in a column header. My evidence is counts, not taste: five questions on Monday that the product has already answered, fourteen alert lines for three actions, a dismissal that dismisses nothing, 322 cells to show five numbers, seven mechanisms for "which units count", a backup that is control 25 of 30, 243 data sets on the board, a quarter that "goes quiet" by adding five lines. I think most of what my colleagues found is a symptom of that surplus and gets cheaper after the cuts — the visual lead's toolbar, Overview, Seating and Students findings shrink, and the interaction lead's 419 Tab stops, undersized toggles and five import dialogs disappear rather than get states. So my order is: make the Overview the routine (1, 2, 4), stop asking what is known (3, 5), then cut. I concede where they are right and it is cheap: the `.warnline` rule, the false "can't get to a C" sentence, the focus ring and the Race's keyboard exit should land today, before anything of mine; the scrolling shell is the right fix for short windows and my cuts only postpone it; tabular figures and one print stylesheet are worth doing once the report is one page; and four components are the right way to build whatever survives. What I will not concede is polishing things that should not exist — no type ramp for fourteen attention bars, no hover state for 92 seating toggles, no sticky header to hold a grade card pushed down by two cards nobody asked for.

---

## Crit response (product)

4 Oct. New shots `r6p/c1-*.png`, `c2-*.png` (`c1.js`).

### 1. First build, ranked
1. **Interaction 2** — `students.js` 372–373. A false sentence about a child's grade on the child's own screen.
2. **Product 1** — `home.js` `attentionItems` (17–33), `focusChip` (42); `app.js` `renderNotices` (1054–1056). The home screen ticks "Focus ✓" with copying undone; three of us rank it.
3. **Visual 1** — `app.html` 345 `.warnline`; caution said once in `quarters.js` `openQuarters` (168). Close Quarter is opened on 9 Oct and looks broken.
4. **Engineering 12, rendered on the Overview** — `app.js` 330–335 (one result that stays), 328 (`view` → `home`), 264 (stale sentence). The Monday "done" moment for two hours.
5. **Engineering 6, rules A and B** — `app.html` `body`, `#app`, `#board`, `#top` (103–125, 169–170). Rows back on the Chromebox without touching the sticky table.

### 2. Opposed
- **Engineering 12's form, "a dialog that stays".** The weekly import is already five dialogs and six taps (`j1.log`, `05-import-weekly-dialog-03.png`); a result dialog makes six and seven, and still ends on 5th Period's grid (`app.js` 328). Same result object, drawn as the Overview's import line. I agree the 10–14 h pre-commit sheet should not be built.
- **Sticky `.shGrade` alone** (visual 3 as engineering prototyped it; `students.js` `STU_CSS`). `c2-show-sticky-card-tabL.png`: the first screen is unchanged — plan at y 647–880 of 800, no switch — and once scrolled the 183 px card pins 299 px (37 %) and overlaps the plan. With `.shCats`, `.shKey`, `.shTrend` hidden and 44 px numerals (`c2-show-compact-cut-tabL.png`): plan at 260–493, five rows on the first screen, 242 px pinned. Cutting alone is not enough either, as the visual lead showed. One change (`openShow` 350–351).
- **Undo, Ctrl+Z and a menu on the skill header** (interaction 5; `app.js` 1204; 3.5–4.5 h). The tap is its own inverse: a second tap restores `skips`, `assigned` and every class's `history`, `receipts` and `studentSkips` byte for byte (`c1.js`). The column hatches, the bar says "1 skipped", the toast names scope and denominator (`c1-skill-skipped.png`). Hold the toast 6 s; spend checkpoint Undo on Close Quarter and categories.

### 3. Withdrawn or downgraded
- **Product 3's auto-route, withdrawn.** NOTES' routine says "confirm with a tap", and `pickSection`'s test (`app.js` 979) accepts a half-match (interaction's `c1-mixed-names-match.png`). Kept: land on the Overview, fix line 264.
- **Product 5 → P2, Croix's call.** Just Unit N, "upcoming" columns and the 25 % rule are each recorded decisions in NOTES. Kept: default Working in from Focus's IXL columns; drop "assigned by guess" from `attentionItems` (`home.js` 28). Ahead is an offer.
- **Product 10 and 13, cuts withdrawn.** GRADES_SPEC §4.2 specifies the report's skill list (`grades.js` `studentReportSection`, 284); NOTES records "trends", and only the chart carries the class average (`students.js` `renderProfile`). My Race line "14 of 22 moved up" breaks NOTES' rule that the headline hides a 1–2 student remainder (`app.js` 445–450). Kept: one page, the hedging row, stacking order at ≤ 1024 px. Product 16's row toggles were built on request in round 4 — also his call.

### 4. What all four would sign
- Quarter-hour fixes first: `students.js` 372–373; `.warnline` (`app.html` 345); `#top .pill:focus-visible` (134) and keys on `#lbExit` (`app.js` 780).
- "Focus ✓" only when nothing is stale (`home.js` 42).
- The board stays the scroller, with a floor and a one-row header (`#board`, `#top`); rule C waits.
- An import's result stays on screen; no two-phase `importFiles` (232–336).
- Show student: sticky result, trend card gone (`.shGrade`, `.shTrend`).
- Four specificity leftovers are bugs: `.gcard b em.lt`, `.lbCard.r3 .lbChip`, `header .pill`, `#bar.detail .pill.onbar`.
- The layout-contract suite (`tests/`) before any type or component refactor; `--test` builds to its own file (`build.py` 33–35).
