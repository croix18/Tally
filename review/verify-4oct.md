# Independent verification — auto-place (2ef51ca), header (7dae0fa), Ahead / Working in (d588524)

4 Oct 2026. A separate reviewer was told to break these three changes after their own tests passed (24 suites, 739
checks). Verdict as delivered: **not ready to ship as is** — the new "a course always has a Working in" rule could
change which units count in three silent ways, and the header's ⋯ menu opened off-screen when the header wraps. The
Ahead column's numbers, the auto-placement thresholds and the header on Croix's real screen sizes held up; no console
errors; rendering got faster (class grid 32 → 12 ms on the laptop).

Everything below is fixed in the commit that adds this file unless it says otherwise. Regression checks:
`tests/working-in.js` (new), and additions to `tests/header.js`, `tests/ahead.js`, `tests/auto-place.js`.

## Findings

| # | Sev | What was wrong | What it is now |
|---|---|---|---|
| 1 | P0 | On first open of an older save, start-up set Working in from Focus's latest IXL column, which could be *below* units the old 25 % rule was counting. A unit already copied to Focus dropped under Ahead with its receipt shown nowhere, and — because Working in was now "set" — a later Focus IXL column no longer moved it, so "Focus doesn't match Tally" never came back. The only notice was a toast (none at all when Tally reopened on the Board). | `defaultWorkingIn()` takes the **later** of Focus's column and the unbroken started run; a unit with a receipt past that is marked Assigned and kept; a unit Tally set (not picked) **follows Focus forward**; a picked unit never moves. The note is a line on the Overview's card (`noteWorkingIn`), not only a toast. |
| 2 | P1 | Loading a backup with `currentUnit: null` (any backup saved before a unit was picked) erased the unit: every class counted nothing until a reload. | A null in the file never replaces this device's unit, and the load calls `defaultWorkingIn()` and says what it set. |
| 3 | P1 | Header ⋯ menu opened off the left edge whenever the header wraps (< 700 px = Chromebox at 200 % zoom): Settings, Guide and Save backup unreachable. | `keepInside()` on open. One row now starts at 760 px (it did not fit at 700–720). |
| 4 | P1 | Settings "Units not assigned at the start" raised to or past Working in: nothing counted, and the selector displayed a unit that was not selected. | Working in is re-seated on a unit that counts when Settings is saved; the toast says so. |
| 5 | P1 | A later unit toggled Not assigned → Assigned → back kept an explicit `false` mark: it left Ahead and never counted when the course reached it. | Toggling back to what the course would do anyway deletes the mark. The Working-in toast names any unit in range that is marked Not assigned; the Ahead header says "N later units" when its units are not one run. |
| 6 | P2 | `#aheadMenu` copies piled up in `<body>` (search typing calls `renderGrid` directly); a file dropped with a menu open left it floating and its key listener swallowed arrow keys page-wide. | One menu open at a time (`closeOpenMenu`); `render()` closes it; `renderGrid` removes every old list. |
| 7 | P2 | The Ahead list could open too short, clipped, or entirely off-screen in Details view / small windows, and stayed put on rotate or scroll. | Placed inside the window with room to read; closes on resize or page scroll. |
| 8 | P2 | Landing scroll cut a unit column in half under the pinned names when the grid was only a little too wide (911 px: "15/23" read as "5/23"). | Lands on a column edge; the Ahead column takes up the slack. |
| 9 | P2 | Import dialog sentences that were not true: "+ New class · no class matches" highlighted under "split between A and B"; a two-student file sent to New class as "only 2 of them in a class already"; "only N in a class" counting the best class as if it were all; "placed by its names" when IDs did the matching. | Each reworded or re-routed; "placed by its students". |
| 10 | P2 | `aria-pressed="false"` beside `aria-current="page"` on Classes; menus without `role="menu"`; no Home/End; Ahead button 39 px on touch; pointer cursor on empty Ahead cells. | Fixed. **Not done:** the Details switch is not seen to move (choosing it closes the menu); after opening a unit from the Ahead list and pressing Escape, focus is on `<body>`. |
| 11 | P2 | Header at 700–760 px: Import stuck out of the bar; the search placeholder was clipped at 768. | Breakpoint 760; tighter padding to 840. |
| 12 | P2 | Stale words: landing "use **Names** off", README "a Details button in the header", "the last unit a quarter of the course has started" (it is the unbroken run), a comment typo. | Fixed. |
| 13 | P2 | The start-up call had no guard (a class with no dates would blank the page); a placeholder class got no Working in. | try/catch; placeholder classes are included. |

Not changed, by decision: two files for one class in one drop (a Q2 file then a Q1 file) still ask, and choosing the
class for the second replaces the first — the same outcome as before auto-placement.

## What the reviewer verified and need not be re-checked

- Every Ahead cell and footer matched an independent recount from raw scores for all five classes: best-score on and
  off, a course-wide skipped skill, a per-student skip, a later unit marked Assigned, an earlier one marked Not
  assigned, the unassigned toggle on, a roster student with no IXL account.
- The Race after the start-up re-snapshot: no "fresh start", movers and gain kept.
- Auto-place never put a realistic file on the wrong class without asking (exact class, lower-case names without IDs,
  duplicate names, 19 + 4 mixed, a small class with two new students; asked on 12/12 split, twin rosters, a fragment,
  a second file in one drop; a closed-quarter Q2 file placed with the Q1 archive intact).
- First run with nothing, with only gradebooks, with only one course export.
- Header: one row with no overlaps at 1920×1080, 1366×768, 1280×800, 1024×768, 911, 800×1280 and 768×1024, with five
  and seven tabs and Details on; tab order and the ⋯ menu's keyboard behaviour.
- `[hidden]{display:none!important}` hides nothing that used to show.

## Not tested by anyone

A real Android/Samsung browser, a real screen reader, printed pages beyond a text search, behaviour when storage
writes fail, and Croix's real files (he cannot share them — he has to try the weekly drop himself).
