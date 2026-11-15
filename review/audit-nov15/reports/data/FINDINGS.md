# DAT findings (auditor's report, condensed by the orchestrator; probe NN in probes/ matches DAT-NN; setup in probes/dat-lib.js)

### DAT-02  Printing while the PIN screen is up prints Tally unblurred, names and grades included
- Class: PRIVACY · Severity: High · Where: app.html's print rule hides #veil and sets filter:none; the veil's key handler does not block Ctrl+P when a PIN is set
- Suggested fix: keep the veil in print (or print blank) and swallow Ctrl+P.

### DAT-06  A full school year does not fit in browser storage, so every save fails
- Class: DATA-LOSS · Severity: High (confidence Medium) · Claim: 6 classes x 30 students x 300 skills, 40 import days, four quarters, 36 gradebook imports built with the app's own writers = 5,466,463 characters; this Chromium accepts about 5,078,000. Largest per class: history 338 KB, best scores 220 KB, grade history 199 KB. The toast's advice (remove a gradebook or photos) does not touch those. A lighter year came to 3.5 M (67 %).

### DAT-05  DECISION: "Forgot the PIN?" accepts any Full save as proof, and every Full save sits in this laptop's Downloads
- Class: DECISION · Severity: High

### DAT-01  Another tab's save wipes an unsaved edit in a field that is not focused
- Class: DATA-LOSS · Severity: Medium · Where: typingNow (app.js 279) only checks the focused field and fields inside #modal
- Claim: paste a roster into Settings, click the Goal box, and any save in another tab clears the pasted roster. Suggested fix: also count changed fields in #gridwrap.

### DAT-04  A file dropped on the PIN screen is imported
- Class: PRIVACY · Severity: Medium · Where: the document drop handler only checks the Board and Show modes · Suggested fix: ignore drops while veiled.

### DAT-08  Opening an old-style backup on a Tally in use overwrites newer work
- Class: DATA-LOSS · Severity: Medium · Claim: the dialog says "Nothing here is removed", but the goal, Focus-check overrides, seating notes, FAST levels and the seating chart revert to the backup's copies.

### DAT-09  "Clear all Tally data" is undone by a second open Tally tab
- Class: PRIVACY · Severity: Medium · Claim: that tab ignores the removal, and any click in it writes everything back.

### DAT-03  A reload resets the "five wrong tries wait 30 seconds" lockout
- Class: FRAGILE · Severity: Low · Suggested fix: keep the lock time in its own storage key.

### DAT-07  Scrub.html can give two real students the same pseudonym
- Class: WRONG-INFO · Severity: Low · Claim: fakeToken shares one `used` set across first and last names and reuses names after about 100; with 300 students 3 to 9 fake first names stood for two real names.

## Cleanup and hardening
- Two toasts insert unescaped student names when a report fails (grades.js 970, conference.js 453). cleanGB drops `percent` and `unread` from kept quarters. migrate (line 161) picks the default goal from s.accelerated, not s.prep. The student page crashes on a null score cell with status "score" (hand-edited file only). The course-setup import uses Object.assign with the file's `assigned` object (own __proto__ key). The Seating Chart backup importer builds idMap as a plain object and stores savedAt unchecked. The Scrub log writes file names unescaped.

## Suspicions (unproven)
- merge3 keeps this tab's whole array when both tabs add to one student's list. Scrub may leave a name in an HTML export that encodes it with entities. A one-frame flash of the page before the PIN screen on reload.
