# Auditor DAT: keeping the data, saves, two tabs, privacy and safety   (tag DAT, directory /home/claude/work/audit/data/)

## Scope (read all of it)
- app.js 1-167 (constants, the state's shape, load, adopt, migrate, stateForSave, save), 232-433 (storage that does
  not keep, autosave, the leave guard, the cross-tab code and merge3, the privacy screen and PIN), 2704-3029 (Full
  save, Board save, loading Tally files, old backups, Seating Chart backups), the finder (3093 on), toast.
- Every `clean*` whitelist function in every file (cleanGB, cleanCats, cleanArchive, cleanNotes, cleanPractice,
  cleanFamily, cleanTests, cleanTestInfo, cleanConfForms, cleanTestDates, cleanDismissed and any other).
- scrub.src.html (the scrubber he uses to make test files from real exports).
- tests/saving.js, migration-and-history.js, hardening.js, privacy-screen.js, scrub.js, board-file.js, plain.js,
  review-nov14.js.

## Properties to prove
1. **Nothing is quietly dropped** (the bug class of 22 Oct). List every field the code ever writes on the state, a
   class, a gradebook, an assignment, a student-linked record and settings (grep the writes). Build a state with every
   one of them populated (drive the real features where you can). Then: Full save, load on an empty Tally: deep-equal?
   Save, reload (through migrate): deep-equal? Each clean*: idempotent, and does it keep every valid field? merge3
   with no concurrent change: unchanged? Any field written somewhere but missing from a whitelist or a save is a
   finding.
2. **Board save**: plant a unique token in every student-linked field (names, IDs, notes, family, FAST columns,
   roster, seating, conference text, file names). Write the Board save and search its text for every token. Load it on
   a clean Tally: the Board and nothing else.
3. **Odd and hostile input**: truncated JSON; a wrong or future version; numbers as strings; NaN, null or an object
   where an array is expected; `__proto__` and `constructor` keys; a 50 MB file.
4. **Storage limits**: what happens when localStorage refuses a save (fill it and see): what is lost, what is said,
   and is it true? Then measure a real year: six classes x 30 students x 300 skills, 40 import days of history, four
   quarters of gradebooks, notes and reports: how many bytes against the browser's limit? (The 14 Nov review never
   measured this.)
5. **Two tabs**: merge3 by property test: merge3(b, x, b) = x; merge3(b, b, y) = y; merge3(b, x, x) = x; arrays,
   deletions, both sides editing one field; no lost update; typing preserved.
6. **The privacy screen and PIN**: while veiled, can anything be read or operated (keyboard shortcuts, the finder,
   printing, dropping a file, the page title, the accessibility tree, the Board's hold-to-exit)? How is the PIN kept;
   does the lockout survive a reload; what does the forgotten-PIN path accept, and what proves the file is his own?
   (That any local page can read localStorage was judged on 14 Nov: do not re-report.)
7. **Scrub.html**: after scrubbing, does any fragment of a real name or ID remain anywhere (headers, other sheets, the
   file name, quoted forms)? Is the pseudonym the same for one student across the IXL file, the gradebook and the
   roster (it must be, or scrubbed fixtures stop matching), and can two students collide?
8. **Escaping**: every place an imported string reaches innerHTML or a template in the code added since 25 Oct (the
   privacy screen, Remove a print, the scatter popup, "See why", Decide, the quarter pie, the finder). Try
   `<img src=x onerror=...>` and `"><svg onload=...>` as a name, an assignment title, a skill name, a note, a file
   name.
