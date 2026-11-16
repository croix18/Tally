pdf.js 3.11.174 (Mozilla, Apache-2.0: LICENSE-pdfjs.txt), from the pdfjs-dist npm package, unmodified.
pdf.min.js runs on the page; pdf.worker.min.js is embedded as inert text and started as a blob worker when a PDF is
dropped on Tally (the FLDOE score report). Nothing is fetched from the network.

seal.js — Windmill's practice/kit/exam/seal.js (croix18/Windmill, branch exam), the lock on a test's record: the site seals,
Tally opens. Copied unchanged; seal.json records the Windmill commit and the file's SHA-256, and build.py and
tests/exam-core.js both refuse a copy that differs. It runs on the page as window.ExamSeal (Web Crypto and the browser's
own deflate; no library). fixtures/seal_vector.json is the record Windmill locked on 16 Nov 2026 with keys made for it.
