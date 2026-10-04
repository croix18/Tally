# Mockups waiting on Croix (4 Oct 2026)

Pictures only — nothing here is in Tally yet. Both were made by rewriting the live page's DOM in a browser
(`mock.js.txt` is the script, kept for the next session; it needs a saved five-class state and the test build).

## `tally-header-mockup.png` — nine pills → three places and one action
Croix chose "Simplify the header" as the next build and asked to see it first.

- **Classes** (the Overview and everything inside a class), **Students**, **Board** (Race + Data Lab) as one segmented control.
- Search stays. **Names** stays one tap away as an eye switch — the product reviewer wanted it tucked into a menu;
  kept out because the grid gets projected and hiding names has to be instant.
- **⋯** holds Details view (a switch), Settings, Guide and Save backup (with "3 days ago").
- **Import** stays the one filled button. One row at 800 px, where today Import wraps to a second row.
- To build: `app.html` `#top`, the handlers for `#btnHome/#btnStudents/#btnLb/#btnHide/#btnDetails/#btnSettings/#btnGuide`
  in `app.js`, the Guide's wording ("Overview", "Race"), `tests/contract.js` (one-row header) and every test that clicks
  those ids — keep the ids on the new controls so the tests keep working.

## `tally-ahead-column-mockup.png` — fourteen "upcoming" columns → one "Ahead" column
Croix asked for a mockup before deciding (this is under "Croix's calls" in `ROUND6_FINDINGS.md`).

- The grid is the units up to **Working in**, then one **Ahead** column that says "2 skills · Unit 8" only for
  students who have work past the current unit.
- What goes away: the upcoming unit columns (and opening or copying a later unit without first changing Working in),
  **Just Unit N**, and the 25 % auto-assign rule.
- Cost: `unitsOf` is under every point Tally copies into Focus, so this is the riskiest change on the list (8–12 h).

Status (4 Oct): Croix approved both; both are built. The Ahead column was done in the grid only — `unitsOf` was not
restructured — so the risk noted above was avoided; see NOTES.md.
