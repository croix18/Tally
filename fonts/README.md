# The embedded font

`dm-sans-latin.woff2` is DM Sans 4.004 (variable: `opsz` 9–40, `wght` 100–1000; SIL OFL, see `LICENSE-DM-Sans.txt`),
subset from the upstream file in google/fonts. `build.py` embeds it as base64 so the page makes no network request.

It is Google's "latin" character set **plus** `← → ↔ ≤ ≥ ≈ ≠ ∞` (U+2190, 2192, 2194, 2264, 2265, 2248, 2260, 221E),
which upstream has and the stock latin subset drops. Round 6 found 130 characters in the templates that the font
lacked — each device drew them from whatever it had. The arrows and comparison signs are now in the font; check marks,
warnings, padlocks and the room-editor tools are inline SVG (`ICO` / `ico()` in `app.js`). `tests/contract.js` fails
if any character on a main screen falls back to a device font.

DM Sans has **no tabular figures** (`tnum`), upstream either. Numeric columns are right-aligned instead; a numeral
that changes in place gets `min-width` in `ch`. Don't add `font-variant-numeric: tabular-nums` — it does nothing.

To regenerate (fontTools + brotli):

```python
from fontTools.ttLib import TTFont
from fontTools import subset
cur = TTFont('fonts/dm-sans-latin.woff2')                    # keep whatever is covered today
want = set(cur.getBestCmap()) | {0x2190, 0x2192, 0x2194, 0x2264, 0x2265, 0x2248, 0x2260, 0x221E}
o = subset.Options(); o.flavor = 'woff2'; o.hinting = False; o.desubroutinize = True
o.layout_features = ['calt', 'ccmp', 'dnom', 'frac', 'liga', 'locl', 'numr', 'kern', 'mark', 'mkmk']
f = TTFont('DMSans[opsz,wght].ttf')                          # upstream, from github.com/google/fonts/ofl/dmsans
s = subset.Subsetter(o); s.populate(unicodes=sorted(want)); s.subset(f); f.flavor = 'woff2'; f.save('fonts/dm-sans-latin.woff2')
```
