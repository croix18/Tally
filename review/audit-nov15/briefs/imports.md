# Auditor IMP: reading files and placing them   (tag IMP, directory /home/claude/work/audit/imports/)

Garbage in, wrong grade out. And a file on the wrong class is the worst bug Tally ever had (22 Oct).

## Scope (read all of it)
- parser.js, all of it (it is `require`-able in node: fuzz it there, no browser needed).
- app.js "names" (168-231): uniqueNames, ixlList, parseRosterText, name keys and matching, mask. "import" (484-710):
  importFiles, how a file's kind is decided, how a gradebook finds its class, defaultWorkingIn. "file sniffing"
  (1629-1771): fileToRows, the html-table .xls, tab text, binary .xls, pdfTextPages, parseGradebook (1675).
  "course-wide IXL pools" (1772-1921): materialize, matchSection, poolRows, carving a class out of a pool.
- conference.js: matchPerson, importFast, importFastItems (the placing; the FAST math is the conference auditor's).
- tests/gradebook-import.js, gradebook-reading.js, pool.js, period-twin.js, real-class.js, focus-export.js,
  fixtures gb_*.csv / .xls. NOTES.md: grep "place themselves", pool, carve, roster, alias.

## Oracle
Your own CSV / TSV reader and your own IXL-grid interpreter in node. Generate files and compare with parser.js:
quoted fields holding commas, new lines and doubled quotes; a BOM; CRLF and bare CR; trailing delimiters; blank lines;
ragged rows; duplicate header names; a header that is not the first row; tabs, commas, semicolons; cells such as
"85", "85.0", " 85 ", "85%", "-", "N/A", empty; numeric versus text cells in xlsx (shared strings, inline strings,
dates stored as numbers); 300 skills x 35 students; names with accents, apostrophes, hyphens, suffixes, "DE LA CRUZ",
two middle names; names that differ only by case, spacing or an accent; the same student twice; the xlsx reader on
stored and deflated entries, several sheets (which one is read?), a hidden sheet. parseIxlFilename: date forms,
section codes, a "(1)" copy, a renamed file, missing parts. asScore: what counts as a score.

## Placement: prove it
- Which class a file lands on: by section code; by names and IDs for a gradebook; how many names must match; two
  classes that share names (a student who changed periods); an empty class; a new class; the same file twice; an
  older file after a newer one.
- **Order independence**: his weekly routine is "drop all seven files in any order". Take the two course exports and
  the gradebook fixtures and import them in every order (and all at once). The final state must be identical every
  time. Any difference is a finding.
- Pasted rosters: "LAST, FIRST MIDDLE", aliases with "=", blank lines, tabs, a name twice.
- A class's own export versus the course-wide pool: the same grid and the same points either way.
- What each wrong-file message says, and whether it is true (a seating backup, a FAST report, an unrelated csv, an
  empty file, an image renamed .csv, a 30 MB file).
