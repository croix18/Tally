// Shared preamble for every suite: browser path, check(), done(), and a cwd of the repo root
// so 'Tally.html' and 'fixtures/…' resolve the same whether a suite is run alone or via run.js.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const os = require('os');
process.chdir(path.resolve(__dirname, '..'));
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium'
  : require('child_process').execSync('ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome 2>/dev/null | head -1').toString().trim() || undefined;
// A Focus gradebook is dated by the file's own time on disk (when Focus wrote it), so the fixtures are "written now":
// a suite run on any day sees today's gradebook, as a teacher importing a fresh export does.
{ const now = new Date(); for (const f of fs.readdirSync('fixtures')) { try { fs.utimesSync(path.join('fixtures', f), now, now); } catch (e) {} } }
let fails = 0, passes = 0;
const check = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (c) passes++; else fails++; };
const done = () => { console.log(fails ? `\n${fails} FAILED (${passes} passed)` : `\nALL PASS (${passes})`); process.exitCode = fails ? 1 : 0; };
// Scratch directory for files a suite writes (scrub output, screenshots): never inside fixtures/.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tally-test-'));
// A suite that needs a fixture the repo doesn't ship (scrubbed real exports) calls this first.
const need = (...files) => { const missing = files.filter(f => !fs.existsSync(path.join('fixtures', f))); if (missing.length) { console.log('SKIP missing fixtures: ' + missing.join(', ')); process.exitCode = 0; process.exit(); } };
// Suites written when every unit counted: turn off "first N units aren't assigned" right after the page loads.
const unskip = p => p.evaluate(() => { const T = window.__tally; T.state.settings.skipFirst = { acc: 0, on: 0 }; T.state.settings.details = true; T.save(); });   // also the dense (Details) view these suites were written against
const dense = p => p.evaluate(() => { const T = window.__tally; T.state.settings.details = true; T.save(); T.render(); });
// The suites drive the test build (keeps window.__tally); the shipped Tally.html / index.html are never touched by a test run.
const APP = 'Tally.test.html', SCRUB = 'Scrub.test.html';
// "Which class is this gradebook?" only opens when Tally can't place the file by its names: click the choice if it is asked.
// A file whose students are in no class opens "New class" instead; "It belongs to a class I already have" leads to the list.
const pick = async (p, sel = '[data-sec]') => { if (!/__new__/.test(sel)) { const e = await p.$('#ncExisting'); if (e) { await e.click(); await p.waitForTimeout(200); } } const d = await p.$(sel); if (d) await d.click(); return !!d; };
// The Board's toggles (stats, average, dots, values, outliers, points/%, bins, by course) sit behind Options: open it first.
global.lbOpt = async (p, sel) => { try { const vis = await p.evaluate(sel => { const el = document.querySelector(sel); if (!el) return true; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel); if (!vis && await p.$('#lbOpts')) { await p.click('#lbOpts'); await p.waitForTimeout(120); } } catch (e) {} };
// Settings is four tabs (Class · Course · Tally · Files): bring the tab that holds a control to the front before using it.
global.seeTab = async (p, sel) => { try { const tab = await p.evaluate(sel => { const el = document.querySelector(sel); const s = el && el.closest('section.stab'); return s ? s.dataset.stab : null; }, sel); if (tab) { await p.click(`#stabs [data-stab="${tab}"]`); await p.waitForTimeout(80); } } catch (e) {} };
// Settings, Guide and Details view live in the header's ⋯ menu: open it, then choose.
const more = async (p, sel) => { await p.click('#btnMore'); await p.click(sel); };
// The Full save from Settings, parsed (the only file that carries everything since 21 Oct 2026). Leaves Settings open.
const fullSave = async p => { if (!(await p.$('#modal:not(.hidden) #exportFull'))) { await more(p, '#btnSettings'); await p.waitForTimeout(250); } await seeTab(p, '#exportFull'); const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exportFull')]); const f = path.join(tmp, 'full-' + Date.now() + '.json'); await dl.saveAs(f); return { file: f, json: JSON.parse(fs.readFileSync(f, 'utf8')), name: dl.suggestedFilename() }; };
// The settings-only backup Tally wrote until 21 Oct 2026, rebuilt from a Full save's state with the same fields, so the
// loader those old files still go through stays tested.
const legacyOf = st => { const s = st.settings || {}; const out = { tally: 4, exported: '2026-10-01T12:00:00.000Z', settings: { copyMode: s.copyMode, useBest: s.useBest, remindDays: s.remindDays, skipFirst: s.skipFirst, skipFirstV2: true, currentUnit: s.currentUnit, curUnitTouched: s.curUnitTouched }, assigned: st.assigned, custom: st.custom, grading: st.grading, room: st.room, seatWeights: st.seatWeights, seatBasis: st.seatBasis, seatPairs: st.seatPairs, quarters: st.quarters, sections: {} };
  for (const k of st.order || Object.keys(st.sections)) { const x = st.sections[k]; out.sections[k] = { label: x.label, prep: x.prep, studentSkips: x.studentSkips, threshold: x.threshold, roster: x.roster, rosterAt: x.rosterAt, skipRoster: x.skipRoster, excluded: x.excluded, ignored: x.ignored, aliases: x.aliases, hiddenUnits: x.hiddenUnits, history: x.history, gradeHistory: x.gradeHistory || [], seating: x.seating || null, seatInfo: x.seatInfo || {}, qArchive: x.qArchive || {}, overrides: x.overrides || {} }; }
  return out; };
module.exports = { fullSave, legacyOf, chromium, fs, path, exe, check, done, tmp, need, unskip, dense, pick, more, APP, SCRUB };
