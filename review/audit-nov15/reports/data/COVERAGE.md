# DAT coverage (condensed)
Verified: round trip of every student-linked record through reload and Full save; all 13 clean* functions keep every valid field and are idempotent; a Board save with 152 planted tokens leaks none and opens showing only the Board; merge3 on 4,000 random trees; 400 single-point mutations of a Full save cause no crash; no prototype pollution; an HTML payload in every imported string stays inert on every screen and print.
Not covered: edge cases of the Seating Chart backup import; the old-backup quarter merge; the tablet; real Focus HTML encodings.
