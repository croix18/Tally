/* ---------- seating.js — room layout, seating charts and the solver (spliced into app.js's closure) ----------
   Ported from Croix's standalone Seating Chart v8 (SEATING_SPEC.md). One room (`state.room`) shared by every class;
   each class keeps its saved chart (`sec.seating`) and per-student seating info (`sec.seatInfo[display]`: nickname,
   behavior, flags, plan, keep-apart / seat-near, notes, and — from the v8 backup — photo and FAST scores).
   Students are the class roster rows (Focus names), so a chart survives re-imports; a student's "standing" for
   placement blends the FAST percentile with their live Focus grade and IXL completion (class percentile ranks). */
const DESK = 70, SEAT_HARD = 1000, PARTNER_D = DESK + 18, NEIGHBOR_D = DESK * 2.2;
const seatUid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
const snap10 = v => Math.round(v / 10) * 10;
const titleCase = s => String(s || '').toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (m, p, c) => p + c.toUpperCase()).replace(/\bMc([a-z])/g, (m, c) => 'Mc' + c.toUpperCase()).replace(/\bO'([a-z])/g, (m, c) => "O'" + c.toUpperCase());
const PHOTO_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const cleanId = id => { const t = String(id == null ? '' : id).replace(/[^\w-]/g, '').slice(0, 24); return t || seatUid(); };
const numOr = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
// Every seatInfo record is coerced on load, restore and import: nothing but plain strings, small numbers and a
// bounded JPEG/PNG data URL ever reaches the page (values are also escaped where they are rendered).
function cleanSeatInfo(i) {
  i = i && typeof i === 'object' ? i : {}; const str = v => typeof v === 'string' ? v.slice(0, 2000) : ''; const arr = v => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 200) : [];
  const level = Number.isInteger(+i.level) && +i.level >= 1 && +i.level <= 5 ? +i.level : null;
  return { gone: typeof i.gone === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(i.gone) ? i.gone : undefined, nick: str(i.nick).slice(0, 40), shownLast: str(i.shownLast).slice(0, 40), behavior: ['low', 'medium', 'high'].includes(i.behavior) ? i.behavior : 'low', front: !!i.front, nearTeacher: !!i.nearTeacher, plan: ['', 'ESE', '504', 'ESE+504'].includes(i.plan) ? i.plan : '', accom: str(i.accom), apart: arr(i.apart), together: arr(i.together), notes: str(i.notes), photo: typeof i.photo === 'string' && i.photo.length <= 20000 && PHOTO_RE.test(i.photo) ? i.photo : null, level, pct: i.pct == null ? null : numOr(i.pct, null, 0, 100), scale: i.scale == null ? null : numOr(i.scale, null, 0, 2000) };
}
function freshRoom() { return { w: 900, h: 600, front: 'top', desks: [], teacher: { x: 740, y: 500, w: 130, h: 64 }, door: { x: 20, y: 560 } }; }
function roomOK() {
  const r = state.room; if (!r || typeof r !== 'object' || !Array.isArray(r.desks)) { state.room = freshRoom(); return state.room; }
  r.w = Math.max(400, +r.w || 900); r.h = Math.max(300, +r.h || 600); r.front = ['top', 'right', 'bottom', 'left'].includes(r.front) ? r.front : 'top';
  const seen = new Set(); r.desks = r.desks.filter(d => d && typeof d === 'object').map(d => { let id = cleanId(d.id); while (seen.has(id)) id = seatUid(); seen.add(id); return { id, x: numOr(d.x, 0, 0, 5000), y: numOr(d.y, 0, 0, 5000), r: numOr(d.r, 0, -360, 360) }; });
  r.teacher = r.teacher && typeof r.teacher === 'object' ? { x: numOr(r.teacher.x, 0, 0, 5000), y: numOr(r.teacher.y, 0, 0, 5000), w: numOr(r.teacher.w, 130, 20, 600), h: numOr(r.teacher.h, 64, 20, 600) } : null;
  r.name = typeof r.name === 'string' ? r.name.slice(0, 24) : '';
  r.door = r.door && typeof r.door === 'object' ? { x: numOr(r.door.x, 0, 0, 5000), y: numOr(r.door.y, 0, 0, 5000) } : null;
  const w = state.seatWeights; if (w && typeof w === 'object') for (const k in w) w[k] = numOr(w[k], SEAT_FACTORS.find(f => f.k === k) ? SEAT_FACTORS.find(f => f.k === k).def : 0, 0, 10);
  return r;
}
const SEAT_FACTORS = [
  { k: 'behavior', label: 'Separate talkers', desc: 'Keep high-behavior students away from each other', def: 8 },
  { k: 'fast', label: 'Standing placement', desc: 'Lower standing (FAST, Focus grade, IXL) pulled toward the front — a band, not a strict ranking', def: 6 },
  { k: 'mix', label: 'Partner pairing', desc: 'How partners are matched by standing — see Partners above', def: 3 },
  { k: 'front', label: 'Front-seat flag', desc: 'Students marked "Front seat" sit in the front third', def: 9 },
  { k: 'teacher', label: 'Near-teacher flag', desc: 'Students marked "Near teacher" sit closest to your desk', def: 7 },
  { k: 'together', label: 'Seat-near preferences', desc: 'Honor "seat near" links', def: 5 },
  { k: 'fresh', label: 'New partners', desc: 'Avoid repeating partners from the saved chart', def: 3 },
  { k: 'fill', label: 'Fill from the front', desc: 'Leave empty desks at the back of the room', def: 2 },
];
function seatW(k) { const w = state.seatWeights || {}; const f = SEAT_FACTORS.find(f => f.k === k); return w[k] == null ? f.def : numOr(w[k], f.def, 0, 10); }

/* ---- students of a class, for seating ---- */
function seatInfoOf(sec, display) { sec.seatInfo = sec.seatInfo || {}; return sec.seatInfo[display] = sec.seatInfo[display] || cleanSeatInfo(null); }
function splitDisplay(display) { const m = String(display).match(/^([^,]+),\s*(.*)$/); if (m) { const p = m[2].trim().split(/\s+/); return { last: m[1].trim(), first: p[0] || '', middle: p.slice(1).join(' ') }; } const t = String(display).trim().split(/\s+/); return { first: t[0] || '', last: t.slice(1).join(' '), middle: '' }; }
const rankPct = (vals, v) => { const xs = vals.filter(x => x != null); if (v == null || xs.length < 2) return null; const below = xs.filter(x => x < v).length, eq = xs.filter(x => x === v).length; return Math.round((below + eq / 2) / xs.length * 100); };
// Roster rows (Focus names) → seating students, with live standing: the mean of the FAST percentile and the class
// percentile ranks of the Focus grade and IXL completion, whichever of the three exist.
// What "standing" is built from: the blend (default), or one source on its own. FAST is a state percentile; the others are class percentile ranks.
const SEAT_BASES = [['blend', 'Blend', 'FAST percentile + Focus grade rank + IXL rank, whichever exist'], ['fast', 'FAST only', 'the FAST PM3 percentile from the Seating Chart backup'], ['grade', 'Focus grade', 'rank in the class by current course grade'], ['tests', 'Assessments', 'rank by average on tests and quizzes — IXL columns left out'], ['ixl', 'IXL progress', 'rank by share of assigned IXL skills at goal']];
// How the "Partner pairing" weight is spent: keep two lows apart (default), pair high with low (tutor pairs), or like with like.
const SEAT_PAIRS = [['mix', 'Keep lows apart', 'two low-standing students are not made partners'], ['tutor', 'Tutor pairs', 'partners far apart in standing — a stronger student beside one who needs help'], ['similar', 'Similar level', 'partners close in standing, so groups work at one pace']];
const seatPairs = () => SEAT_PAIRS.some(b => b[0] === state.seatPairs) ? state.seatPairs : 'mix';
// Partner cost in [0,1] for a pair, by mode: mix → 1 only when both are low; tutor → 1 when identical, 0 at ≥50 apart; similar → the reverse.
function pairCost(a, b) { const m = seatPairs(); if (m === 'mix') return lowStanding(a) && lowStanding(b) ? 1 : 0; const diff = Math.abs(standingOf(a) - standingOf(b)); return m === 'tutor' ? Math.max(0, 1 - diff / 50) : Math.min(1, diff / 50); }
const seatBasis = () => SEAT_BASES.some(b => b[0] === state.seatBasis) ? state.seatBasis : 'blend';
function seatStudents(sec) {
  const rows = buildRows(sec).filter(r => r.status !== 'ixlOnly'); const gb = sec.grades; const gbIdx = gb ? new Map(gb.students.map((n, i) => [n, i])) : null;
  const testsBy = gb ? new Map(ixlVsTests(sec).map(x => [x.i, x.tests])) : null; const basis = seatBasis();
  const units = unitsOf(sec).filter(u => u.assigned && u.total); const t = sec.threshold;
  const base = rows.map(r => { const info = seatInfoOf(sec, r.display); const gi = gbIdx && gbIdx.has(r.display) ? gbIdx.get(r.display) : null; const g = gi != null ? computeGrade(sec, gi) : null;
    let ixl = null; if (r.ixl != null && units.length) { let d = 0, p = 0; units.forEach(u => { p += totalFor(sec, u, r.ixl); d += points(sec, u, r.ixl); }); ixl = p ? d / p * 100 : null; }
    return { ...splitDisplay(r.display), id: r.display, display: r.display, sid: r.id || '', ixl: r.ixl, gi, grade: g ? g.pct : null, tests: gi != null && testsBy ? (testsBy.get(gi) ?? null) : null, ixlPct: ixl, info }; });
  const grades = base.map(s => s.grade), ixls = base.map(s => s.ixlPct), tests = base.map(s => s.tests);
  return base.map(s => { const i = s.info; const gr = rankPct(grades, s.grade), ir = rankPct(ixls, s.ixlPct), tr = rankPct(tests, s.tests);
    const parts = basis === 'fast' ? [i.pct] : basis === 'grade' ? [gr] : basis === 'tests' ? [tr] : basis === 'ixl' ? [ir] : [i.pct, gr, ir];
    const have = parts.filter(v => v != null); const standing = have.length ? Math.round(have.reduce((a, b) => a + b, 0) / have.length) : null;
    return { ...s, nick: i.nick || '', shownLast: i.shownLast || '', behavior: i.behavior || 'low', front: !!i.front, nearTeacher: !!i.nearTeacher, plan: i.plan || '', accom: i.accom || '', apart: (i.apart || []).slice(), together: (i.together || []).slice(), notes: i.notes || '', photo: i.photo || null, level: i.level || null, pct: i.pct, standing, gradeRank: gr, ixlRank: ir, testsRank: tr }; });
}
let seatPlain = false;   // set while printing: the teacher asked for the page, so names and photos print
const seatHidden = () => state.settings.hideNames && !seatPlain;
const seatParts = s => ({ first: s.nick || titleCase(s.first), last: s.shownLast || titleCase(s.last) });
const seatName = s => { if (seatHidden()) return mask(s.display); const p = seatParts(s); return `${p.first} ${p.last}`.trim(); };
const seatShort = s => { if (seatHidden()) return mask(s.display); const { first: f, last: l } = seatParts(s); let t = `${f} ${l[0] || ''}.`; if (t.length > 13) t = f.slice(0, 11) + '…'; return t; };
const standingOf = s => s.standing == null ? 50 : s.standing;
const lowStanding = s => standingOf(s) < 25 || s.level === 1;
const allowedDepth = s => { const p = standingOf(s); return p < 25 ? 0.5 : p < 50 ? 0.75 : 1; };
// Standing is relative to the class: the FAST state percentile averaged with the class percentile ranks of the Focus grade and IXL completion.
const standingText = s => { const b = seatBasis(); const bits = [];
  if (s.pct != null && (b === 'blend' || b === 'fast')) bits.push(`FAST ${s.pct}th pct${s.level ? ' (L' + s.level + ')' : ''}`);
  if (s.grade != null && (b === 'blend' || b === 'grade')) bits.push(`Focus ${Math.round(s.grade)}% (rank ${s.gradeRank} in class)`);
  if (s.tests != null && b === 'tests') bits.push(`assessments ${Math.round(s.tests)}% (rank ${s.testsRank} in class)`);
  if (s.ixlPct != null && (b === 'blend' || b === 'ixl')) bits.push(`IXL ${Math.round(s.ixlPct)}% (rank ${s.ixlRank})`);
  const name = SEAT_BASES.find(x => x[0] === b)[1];
  return bits.length ? bits.join(' · ') + ` → standing ${standingOf(s)}` : `no ${b === 'blend' ? 'scores' : name + ' data'} yet — treated as mid-level`; };

/* ---- geometry ---- */
function deskNumbers() {
  const L = roomOK(), f = L.front; const depth = d => f === 'top' ? d.y : f === 'bottom' ? L.h - d.y : f === 'left' ? d.x : L.w - d.x; const across = d => f === 'top' ? d.x : f === 'bottom' ? L.w - d.x : f === 'left' ? L.h - d.y : d.y;
  const ds = [...L.desks].sort((a, b) => depth(a) - depth(b)); let row = 0, rowStart = null; const rowOf = {};
  for (const d of ds) { if (rowStart === null || depth(d) - rowStart > DESK * 0.6) { row++; rowStart = depth(d); } rowOf[d.id] = row; }
  ds.sort((a, b) => rowOf[a.id] - rowOf[b.id] || across(a) - across(b)); const m = {}; ds.forEach((d, i) => m[d.id] = i + 1); return m;
}
function geometry() {
  const L = roomOK(), f = L.front, ds = L.desks; const c = d => ({ x: d.x + DESK / 2, y: d.y + DESK / 2 });
  const depthRaw = d => { const p = c(d); return f === 'top' ? p.y : f === 'bottom' ? L.h - p.y : f === 'left' ? p.x : L.w - p.x; };
  const dr = ds.map(depthRaw), mn = Math.min(...dr), mx = Math.max(...dr); const depth = ds.map((d, i) => mx > mn ? (dr[i] - mn) / (mx - mn) : 0);
  let tdist = ds.map(() => 0.5);
  if (L.teacher) { const t = { x: L.teacher.x + L.teacher.w / 2, y: L.teacher.y + L.teacher.h / 2 }; const raw = ds.map(d => { const p = c(d); return Math.hypot(p.x - t.x, p.y - t.y); }); const a = Math.min(...raw), b = Math.max(...raw); tdist = raw.map(r => b > a ? (r - a) / (b - a) : 0); }
  const n = ds.length, rel = [];
  for (let i = 0; i < n; i++) { rel.push(new Uint8Array(n)); for (let j = 0; j < n; j++) { if (i === j) continue; const a = c(ds[i]), b = c(ds[j]); const dist = Math.hypot(a.x - b.x, a.y - b.y); rel[i][j] = dist <= PARTNER_D ? 2 : dist <= NEIGHBOR_D ? 1 : 0; } }
  return { ds, depth, tdist, rel, nums: deskNumbers() };
}
function rowIndex(G) {
  const L = roomOK(), f = L.front; const dr = G.ds.map(d => { const cx = d.x + DESK / 2, cy = d.y + DESK / 2; return f === 'top' ? cy : f === 'bottom' ? L.h - cy : f === 'left' ? cx : L.w - cx; });
  const of = {}; const idx = [...G.ds.keys()].sort((a, b) => dr[a] - dr[b]); let r = 0, st = null; for (const i of idx) { if (st === null || dr[i] - st > DESK * 0.6) { r++; st = dr[i]; } of[i] = r; }
  return { of, count: r };
}

/* ---- model + scoring ---- */
// withFresh: penalise partners from the saved chart — only when GENERATING a new one (scoring the saved chart against itself would zero its own fit).
function buildModel(sec, stu, G, withFresh) {
  const n = stu.length, m = G.ds.length; const U = [], P = [], hard = []; const prevPartners = new Set(); const saved = sec.seating;
  if (withFresh && saved && seatW('fresh') > 0) { const inv = {}; for (const [d, sid] of Object.entries(saved.seats || {})) inv[sid] = d; const di = {}; G.ds.forEach((d, i) => di[d.id] = i);
    for (const a of stu) for (const b of stu) { if (a.id >= b.id) continue; const da = di[inv[a.id]], db = di[inv[b.id]]; if (da != null && db != null && G.rel[da][db] === 2) prevPartners.add(a.id + '|' + b.id); } }
  for (let i = 0; i < n; i++) { const s = stu[i]; U.push(new Float64Array(m));
    for (let d = 0; d < m; d++) { let u = 0; const dep = G.depth[d]; if (s.front) u += seatW('front') * dep * 2; if (s.nearTeacher) u += seatW('teacher') * G.tdist[d] * 2; const over = dep - allowedDepth(s); if (over > 0) u += seatW('fast') * over * 3; u += seatW('fill') * dep * 0.5; U[i][d] = u; } }
  for (let i = 0; i < n; i++) { P.push([]); for (let j = 0; j < n; j++) { if (j <= i) { P[i].push(j < i ? P[j][i] : null); continue; }
    const a = stu[i], b = stu[j]; let none = 0, nb = 0, pt = 0; const ha = a.behavior === 'high', hb = b.behavior === 'high', ma = a.behavior === 'medium', mb = b.behavior === 'medium';
    if (ha && hb) { pt += seatW('behavior') * 1.0; nb += seatW('behavior') * 0.5; } else if ((ha && mb) || (hb && ma)) { pt += seatW('behavior') * 0.45; nb += seatW('behavior') * 0.15; } else if (ma && mb) { pt += seatW('behavior') * 0.15; }
    { const pc = pairCost(a, b); if (pc > 0) { pt += seatW('mix') * pc; if (seatPairs() === 'mix') nb += seatW('mix') * 0.3; } }
    if (a.together.includes(b.id)) { none += seatW('together') * 1.0; nb += seatW('together') * 0.4; }
    if (prevPartners.has(a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id)) pt += seatW('fresh') * 1.0;
    if (a.apart.includes(b.id)) hard.push([i, j]);
    P[i].push([none, nb, pt]); } }
  return { U, P, hard, n, m };
}
function totalScore(M, G, asg) { let t = 0, h = 0; for (let i = 0; i < M.n; i++) { t += M.U[i][asg[i]]; for (let j = i + 1; j < M.n; j++) t += M.P[i][j][G.rel[asg[i]][asg[j]]]; } for (const [i, j] of M.hard) if (G.rel[asg[i]][asg[j]] > 0) h++; return { soft: t, hard: h, total: t + h * SEAT_HARD }; }
const shuffleArr = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = 0 | Math.random() * (i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
function randomAsg(M, rnd) { const a = [...Array(M.m).keys()]; const r = rnd || Math.random; for (let i = a.length - 1; i > 0; i--) { const j = 0 | r() * (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, M.n); }
const seededRnd = seed => { let x = (seed >>> 0) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1e6) / 1e6; }; };
let seatBase = { key: '', v: 0 };
function seatBaseline(sec, M, G) { if (!M.m || !M.n || M.n > M.m) return 0; const key = sec.key + '|' + seatBasis() + '|' + seatPairs() + '|' + JSON.stringify(state.seatWeights || {}) + '|' + M.n + '|' + M.m; if (seatBase.key === key) return seatBase.v; const rnd = seededRnd(M.n * 7919 + M.m * 104729 + 17); let b = 0; for (let k = 0; k < 40; k++) b += totalScore(M, G, randomAsg(M, rnd)).soft; b /= 40; seatBase = { key, v: b }; return b; }   // the same 40 random seatings every time, so the fit is stable between renders
function seatsFromAsg(asg, stu, G) { const seats = {}; asg.forEach((d, i) => seats[G.ds[d].id] = stu[i].id); return seats; }
function asgFromSeats(seats, stu, G) { const di = {}; G.ds.forEach((d, i) => di[d.id] = i); const at = {}; for (const [d, sid] of Object.entries(seats)) if (di[d] != null) at[sid] = di[d]; return stu.map(s => at[s.id] ?? -1); }
function scoreSeats(sec, seats, stu, G, M) {
  const asg = asgFromSeats(seats, stu, G); let t = 0, h = 0;
  for (let i = 0; i < M.n; i++) { if (asg[i] < 0) continue; t += M.U[i][asg[i]]; for (let j = i + 1; j < M.n; j++) { if (asg[j] < 0) continue; t += M.P[i][j][G.rel[asg[i]][asg[j]]]; } }
  for (const [i, j] of M.hard) if (asg[i] >= 0 && asg[j] >= 0 && G.rel[asg[i]][asg[j]] > 0) h++;
  const b = seatBaseline(sec, M, G); const fit = h ? 0 : Math.min(100, b > 0 ? Math.round(100 * Math.max(0, 1 - t / b)) : (M.m && M.n ? 100 : 0));
  return { fit, soft: t, hard: h };
}
const SEAT_WORKER = `
onmessage=function(e){
  const{U,P,hard,rel,n,m,restarts,budgetMs,seed,fixed}=e.data;const fx=fixed||[];const isFixed=i=>fx[i]>=0;
  let rs=seed>>>0||1;const rnd=()=>{rs^=rs<<13;rs^=rs>>>17;rs^=rs<<5;return((rs>>>0)%1e6)/1e6;};
  const HARD=1000;const hardSet=new Set(hard.map(([i,j])=>i*4096+j));const isHard=(i,j)=>hardSet.has(i<j?i*4096+j:j*4096+i);
  function pen(i,j,di,dj){const r=rel[di][dj];let v=P[i][j][r];if(r>0&&isHard(i,j))v+=HARD;return v;}
  function total(asg){let t=0;for(let i=0;i<n;i++){t+=U[i][asg[i]];for(let j=i+1;j<n;j++)t+=pen(i,j,asg[i],asg[j]);}return t;}
  function deltaMove(asg,i,d2){const d1=asg[i];let dl=U[i][d2]-U[i][d1];for(let j=0;j<n;j++){if(j===i)continue;dl+=pen(i,j,d2,asg[j])-pen(i,j,d1,asg[j]);}return dl;}
  function deltaSwap(asg,i,j){const di=asg[i],dj=asg[j];let dl=U[i][dj]-U[i][di]+U[j][di]-U[j][dj];for(let k=0;k<n;k++){if(k===i||k===j)continue;dl+=pen(i,k,dj,asg[k])-pen(i,k,di,asg[k])+pen(j,k,di,asg[k])-pen(j,k,dj,asg[k]);}return dl;}
  const results=[];
  for(let r=0;r<restarts;r++){
    const used=new Set(fx.filter(d=>d>=0));const desks=[...Array(m).keys()].filter(d=>!used.has(d));for(let i=desks.length-1;i>0;i--){const j=0|rnd()*(i+1);[desks[i],desks[j]]=[desks[j],desks[i]];}
    const asg=new Array(n);let k=0;for(let i=0;i<n;i++)asg[i]=isFixed(i)?fx[i]:desks[k++];const free=desks.slice(k);
    let cur=total(asg),best=cur,bestAsg=asg.slice();
    let sum=0,cnt=0;for(let k=0;k<200;k++){const i=0|rnd()*n,j=0|rnd()*n;if(i!==j){sum+=Math.abs(deltaSwap(asg,i,j));cnt++;}}
    let T=Math.max(0.5,(sum/Math.max(1,cnt))*0.8);const Tend=0.02;const perRestart=budgetMs/restarts;const start=Date.now();let it=0;
    while(true){it++;
      if((it&1023)===0){const el=Date.now()-start;if(el>perRestart)break;const frac=el/perRestart;T=Math.max(Tend,T*Math.pow(Tend/T,1/Math.max(1,(1-frac)*100)));}
      if(free.length&&rnd()<0.25){const i=0|rnd()*n;if(isFixed(i))continue;const fi=0|rnd()*free.length,d2=free[fi];const dl=deltaMove(asg,i,d2);if(dl<=0||rnd()<Math.exp(-dl/T)){free[fi]=asg[i];asg[i]=d2;cur+=dl;}}
      else{const i=0|rnd()*n,j=0|rnd()*n;if(i===j||isFixed(i)||isFixed(j))continue;const dl=deltaSwap(asg,i,j);if(dl<=0||rnd()<Math.exp(-dl/T)){const t=asg[i];asg[i]=asg[j];asg[j]=t;cur+=dl;}}
      if(cur<best-1e-9){best=cur;bestAsg=asg.slice();}}
    let improved=true;while(improved){improved=false;for(let i=0;i<n;i++){if(isFixed(i))continue;for(let j=i+1;j<n;j++){if(isFixed(j))continue;const dl=deltaSwap(bestAsg,i,j);if(dl<-1e-9){const t=bestAsg[i];bestAsg[i]=bestAsg[j];bestAsg[j]=t;best+=dl;improved=true;}}
      for(const d2 of [...Array(m).keys()].filter(d=>!bestAsg.includes(d))){const dl=deltaMove(bestAsg,i,d2);if(dl<-1e-9){bestAsg[i]=d2;best+=dl;improved=true;}}}}
    results.push({asg:bestAsg,total:best});postMessage({progress:(r+1)/restarts});}
  postMessage({done:true,results});
};`;
let seatWorker = null;
function runSolver(M, G, opts) {
  return new Promise((res, rej) => {
    if (seatWorker) { seatWorker.terminate(); seatWorker = null; }
    const w = new Worker(URL.createObjectURL(new Blob([SEAT_WORKER], { type: 'text/javascript' }))); seatWorker = w;
    w.onmessage = e => { if (e.data.progress != null && opts.onProgress) opts.onProgress(e.data.progress); if (e.data.done) { res(e.data.results); w.terminate(); seatWorker = null; } };
    w.onerror = e => { rej(new Error(e.message)); w.terminate(); seatWorker = null; };
    w.postMessage({ U: M.U.map(a => Array.from(a)), P: M.P.map(r => r.map(x => x || [0, 0, 0])), hard: M.hard, rel: G.rel.map(r => Array.from(r)), n: M.n, m: M.m, restarts: opts.restarts || 4, budgetMs: opts.budgetMs || 1200, seed: (Math.random() * 1e9) | 0, fixed: opts.fixed || [] });
  });
}
/* ---- issues and explanations ---- */
function explainSeats(seats, stu, G) {
  const di = {}; G.ds.forEach((d, i) => di[d.id] = i); const at = {}; for (const [d, sid] of Object.entries(seats)) at[sid] = di[d];
  const issues = []; const nm = seatName; const seen = new Set();
  for (const a of stu) { const da = at[a.id]; if (da == null) { issues.push({ t: 'hard', msg: `${nm(a)} has no seat` }); continue; }
    for (const b of stu) { if (a.id >= b.id) continue; const db = at[b.id]; if (db == null) continue; const r = G.rel[da][db]; if (!r) continue; const key = a.id + '|' + b.id; if (seen.has(key)) continue; seen.add(key);
      const where = r === 2 ? 'partners' : 'neighbors';
      if (a.apart.includes(b.id)) issues.push({ t: 'hard', msg: `${nm(a)} & ${nm(b)} are ${where} — keep-apart rule` });
      else if (seatW('behavior') && a.behavior === 'high' && b.behavior === 'high') issues.push({ t: 'warn', msg: `${nm(a)} & ${nm(b)} are ${where} — both high behavior` });
      else if (seatW('behavior') && r === 2 && ((a.behavior === 'high' && b.behavior === 'medium') || (b.behavior === 'high' && a.behavior === 'medium'))) issues.push({ t: 'info', msg: `${nm(a)} & ${nm(b)} partners — high + medium behavior` });
      if (seatW('mix') && r === 2) { const m = seatPairs(); const diff = Math.abs(standingOf(a) - standingOf(b));
        if (m === 'mix' && lowStanding(a) && lowStanding(b)) issues.push({ t: 'warn', msg: `${nm(a)} & ${nm(b)} partners — both low standing` });
        else if (m === 'tutor' && diff < 15) issues.push({ t: 'info', msg: `${nm(a)} & ${nm(b)} partners — similar standing (${standingOf(a)} / ${standingOf(b)}), not a tutor pair` });
        else if (m === 'similar' && diff > 50) issues.push({ t: 'info', msg: `${nm(a)} & ${nm(b)} partners — far apart in standing (${standingOf(a)} / ${standingOf(b)})` }); } }
    if (seatW('together')) for (const tid of a.together) { const b = stu.find(s => s.id === tid); if (!b || a.id > b.id) continue; const db = at[b.id]; if (db != null && !G.rel[da][db]) issues.push({ t: 'info', msg: `${nm(a)} & ${nm(b)} wanted near each other — not near` }); }
    const dep = G.depth[da];
    if (seatW('front') && a.front && dep > 0.34) issues.push({ t: 'warn', msg: `${nm(a)} needs a front seat — sitting ${dep > 0.67 ? 'in the back' : 'mid-room'}` });
    if (seatW('teacher') && a.nearTeacher && G.tdist[da] > 0.4) issues.push({ t: 'warn', msg: `${nm(a)} should be near the teacher desk — isn't` });
    if (seatW('fast') && !a.front && dep > allowedDepth(a) + 0.05) issues.push({ t: 'info', msg: `${nm(a)} (standing ${standingOf(a)}) is further back than the band suggests` }); }
  const order = { hard: 0, warn: 1, info: 2 }; issues.sort((x, y) => order[x.t] - order[y.t]); return issues;
}
function whyHere(sec, work, sid, deskId, stu, G) {
  const s = stu.find(x => x.id === sid); if (!s) return []; const di = {}; G.ds.forEach((d, i) => di[d.id] = i); const d = di[deskId]; if (d == null) return [];
  const at = {}; for (const [dk, id] of Object.entries(work.seats)) if (di[dk] != null) at[id] = di[dk];
  const lines = []; const rows = rowIndex(G); const dep = G.depth[d];
  lines.push({ ok: true, msg: `Row ${rows.of[d]} of ${rows.count} · desk ${G.nums[deskId]}` });
  if (s.standing != null) { const band = allowedDepth(s); const okb = dep <= band + 0.05; lines.push({ ok: okb, msg: `${standingText(s)} → ${band <= 0.5 ? 'front half' : band <= 0.75 ? 'front three-quarters' : 'anywhere'}${okb ? ' ✓' : ' — sitting further back'}` }); }
  else lines.push({ ok: true, msg: 'No scores yet — treated as mid-level' });
  if (s.front) lines.push({ ok: dep <= 0.34, msg: `Front-seat flag${dep <= 0.34 ? ' ✓' : ' — not in the front third'}` });
  if (s.nearTeacher) lines.push({ ok: G.tdist[d] <= 0.4, msg: `Near-teacher flag${G.tdist[d] <= 0.4 ? ' ✓' : ' — far from your desk'}` });
  if (s.plan && !seatHidden()) lines.push({ ok: true, msg: `${s.plan}${s.accom ? ': ' + s.accom : ''}`, plan: true });
  const partners = [], neighbors = [];
  for (const o of stu) { if (o.id === s.id || at[o.id] == null) continue; const r = G.rel[d][at[o.id]]; if (r === 2) partners.push(o); else if (r === 1) neighbors.push(o); }
  const tag = o => `${seatName(o)}${o.behavior === 'high' ? ' (H)' : o.behavior === 'medium' ? ' (M)' : ''}${o.standing != null ? ' · ' + o.standing : ''}`;
  lines.push({ ok: !partners.some(o => s.apart.includes(o.id) || (o.behavior === 'high' && s.behavior === 'high')), msg: partners.length ? `Partner${partners.length > 1 ? 's' : ''}: ${partners.map(tag).join(', ')}` : 'No partner (empty desk beside)' });
  if (partners.length && seatW('mix')) { const m = seatPairs(); const worst = Math.max(...partners.map(o => pairCost(s, o))); lines.push({ ok: worst < 0.5, msg: m === 'tutor' ? `Tutor pairs: standing ${standingOf(s)} with ${partners.map(o => standingOf(o)).join(', ')}${worst < 0.5 ? ' ✓' : ' — too close to be a tutor pair'}` : m === 'similar' ? `Similar level: standing ${standingOf(s)} with ${partners.map(o => standingOf(o)).join(', ')}${worst < 0.5 ? ' ✓' : ' — far apart'}` : `Lows apart${worst ? ' — two low-standing partners' : ' ✓'}` }); }
  if (neighbors.length) lines.push({ ok: !neighbors.some(o => s.apart.includes(o.id) || (o.behavior === 'high' && s.behavior === 'high')), msg: `Nearby: ${neighbors.map(tag).join(', ')}` });
  for (const tid of s.apart) { const o = stu.find(x => x.id === tid); if (!o) continue; const r = at[o.id] == null ? 0 : G.rel[d][at[o.id]]; lines.push({ ok: r === 0, msg: `Keep apart from ${seatName(o)}${r ? ' — TOO CLOSE' : ' ✓'}` }); }
  for (const tid of s.together) { const o = stu.find(x => x.id === tid); if (!o) continue; const r = at[o.id] == null ? 0 : G.rel[d][at[o.id]]; lines.push({ ok: r > 0, msg: `Wants to sit near ${seatName(o)}${r ? ' ✓' : ' — not near'}` }); }
  if (s.behavior === 'high') lines.push({ ok: true, msg: 'High behavior — the solver keeps other H students away' });
  if (s.notes && !seatHidden()) lines.push({ ok: true, msg: 'Note: ' + s.notes });
  return lines;
}
/* ---- working chart per class (unsaved edits live here until Save) ---- */
const seatWork = {};   // sec.key → { seats, locks, source, dirty, undo, candIdx }
const seatCandsBy = {};   // sec.key → generated options (the panel of one class never shows another's)
let seatQuery = '', seatSolving = false, seatGenId = 0, seatUiKey = null, seatSel = null, seatHover = null, seatLast = null, seatPending = null, roomSel = null, roomView = null;
function seatAbort() { if (seatWorker) { seatWorker.terminate(); seatWorker = null; } seatSolving = false; seatGenId++; }
// Selection, hover, last move and pending reseat belong to one class; switching classes clears them.
function seatUiFor(sec) { if (seatUiKey !== sec.key) { seatUiKey = sec.key; seatSel = null; seatHover = null; seatLast = null; seatPending = null; } }
// Seats held by someone no longer on the roster are freed (a withdrawn or renamed student must not block a desk).
function pruneSeats(w, stu) { const ok = new Set(stu.map(x => x.id)); const desks = new Set(roomOK().desks.map(d => d.id)); let n = 0; for (const d of Object.keys(w.seats)) { if (!desks.has(d)) { delete w.seats[d]; continue; } if (!ok.has(w.seats[d])) { delete w.seats[d]; n++; } } for (const k of Object.keys(w.locks || {})) if (!ok.has(k)) delete w.locks[k]; return n; }
const roomUndo = [];
function workFor(sec) { if (seatWork[sec.key]) return seatWork[sec.key]; const sv = sec.seating; if (sv && sv.seats) seatWork[sec.key] = { seats: JSON.parse(JSON.stringify(sv.seats)), locks: { ...(sv.locks || {}) }, source: 'saved', dirty: false, undo: [] }; return seatWork[sec.key] || null; }
function setWork(sec, seats, source) { const prev = seatWork[sec.key]; seatWork[sec.key] = { seats: JSON.parse(JSON.stringify(seats)), locks: { ...((prev && prev.locks) || (sec.seating && sec.seating.locks) || {}) }, source, dirty: false, undo: [] }; seatSel = null; seatLast = null; return seatWork[sec.key]; }
async function seatGenerate(sec) {
  const stu = seatStudents(sec); const G = geometry(); if (!stu.length || stu.length > G.ds.length) return;
  seatSolving = true; seatCandsBy[sec.key] = []; seatSel = null; const myGen = ++seatGenId; renderSeating(sec);
  try {
    const M = buildModel(sec, stu, G, true); const fixed = stu.map(() => -1); const w = workFor(sec);
    if (w) { const di = {}; G.ds.forEach((d, i) => di[d.id] = i); for (const [d, sid] of Object.entries(w.seats)) { const i = stu.findIndex(s => s.id === sid); if (i >= 0 && w.locks[sid] && di[d] != null) fixed[i] = di[d]; } }
    const res = await runSolver(M, G, { fixed, restarts: 5, budgetMs: 1500, onProgress: p => { const b = $('#seatBar'); if (b) b.style.width = Math.round(p * 100) + '%'; } });
    if (myGen !== seatGenId) return;   // aborted (the teacher left the view) or superseded
    res.sort((a, b) => a.total - b.total); const out = [], seenKeys = []; const Ms = buildModel(sec, stu, G, false);
    for (const r of res) { const key = r.asg.join(','); if (seenKeys.includes(key)) continue; const dup = out.some(o => o.asg.filter((d, i) => d === r.asg[i]).length >= r.asg.length * 0.85); if (dup && out.length) continue; seenKeys.push(key); const seats = seatsFromAsg(r.asg, stu, G); out.push({ asg: r.asg, seats, ...scoreSeats(sec, seats, stu, G, Ms) }); if (out.length >= 4) break; }
    seatCandsBy[sec.key] = out; if (out.length) { const nw = setWork(sec, out[0].seats, 'cand'); nw.candIdx = 0; }
  } catch (e) { console.error(e); if (myGen === seatGenId) toast('Solver error: ' + e.message, true); }
  if (myGen !== seatGenId) return;
  seatSolving = false; if (view.mode === 'seating' && state.active === sec.key && view.sub !== 'room') render();
}
function seatMove(sec, w, fromDesk, toDesk, preview) {
  const seats = preview ? JSON.parse(JSON.stringify(w.seats)) : w.seats; const a = seats[fromDesk], b = seats[toDesk]; if (!a && !b) return null;
  if (!preview) { if ((a && w.locks[a]) || (b && w.locks[b])) { toast('That seat is locked — unlock it to move.', true); return null; } }
  const stu = seatStudents(sec), G = geometry(), M = buildModel(sec, stu, G);
  const before = { issues: explainSeats(seats, stu, G), ...scoreSeats(sec, seats, stu, G, M) };
  if (!preview) { w.undo.push(JSON.stringify(seats)); if (w.undo.length > 50) w.undo.shift(); }
  if (a && b) { seats[fromDesk] = b; seats[toDesk] = a; } else if (a) { seats[toDesk] = a; delete seats[fromDesk]; } else { seats[fromDesk] = b; delete seats[toDesk]; }
  const after = { issues: explainSeats(seats, stu, G), ...scoreSeats(sec, seats, stu, G, M) };
  if (!preview) w.dirty = true;
  const bm = new Set(before.issues.map(i => i.t + i.msg)), am = new Set(after.issues.map(i => i.t + i.msg));
  return { a, b, fitBefore: before.fit, fitAfter: after.fit, hardBefore: before.hard, hardAfter: after.hard, added: after.issues.filter(i => !bm.has(i.t + i.msg)), removed: before.issues.filter(i => !am.has(i.t + i.msg)) };
}
function deltaHTML(r) {
  const d = r.fitAfter - r.fitBefore, dh = r.hardAfter - r.hardBefore;
  let h = `<span class="${d > 0 ? 'dup' : d < 0 ? 'ddown' : ''}">fit ${r.fitBefore} → ${r.fitAfter}</span>`;
  if (dh > 0) h += ` <span class="ddown">+${dh} hard rule broken</span>`; else if (dh < 0) h += ` <span class="dup">${-dh} hard rule fixed</span>`;
  if (!r.added.length && !r.removed.length) return h + `<div class="ghint">No new issues either way.</div>`;
  h += `<div class="seatIssues">`; r.added.forEach(i => { h += `<div class="issue ${i.t}">⚠ ${esc(i.msg)}</div>`; }); r.removed.forEach(i => { h += `<div class="issue fixed">✓ Fixed: ${esc(i.msg)}</div>`; }); return h + `</div>`;
}
/* ---- the chart SVG (screen and print) ---- */
const SEAT_LV = ['', '#D9442F', '#E38A2B', '#B59A23', '#1F8F93', '#0F5F6B'];   // FAST level 1 → 5
const BEH_COLOR = '#16213A';   // high-behavior badge: an ink square with an H, so it can't be confused with a level dot
function svgChart(sec, seats, stu, G, mode, w) {
  // mode: 'screen' | 'teacher' | 'safe' (student/sub copy: photos and names only)
  const L = roomOK(), T = 14, f = L.front; const print = mode !== 'screen'; const safe = mode === 'safe'; const H = !print && seatHidden();
  let h = `<svg viewBox="-2 -2 ${L.w + 4} ${L.h + 4}" class="chartSvg" role="img" aria-label="seating chart">`;
  h += `<rect x="0" y="0" width="${L.w}" height="${L.h}" fill="${print ? '#fff' : '#FBFAF6'}" stroke="#C9C5B8" stroke-width="2" rx="6"/>`;
  const fb = f === 'top' ? [0, 0, L.w, T] : f === 'bottom' ? [0, L.h - T, L.w, T] : f === 'left' ? [0, 0, T, L.h] : [L.w - T, 0, T, L.h];
  h += `<rect class="front" x="${fb[0]}" y="${fb[1]}" width="${fb[2]}" height="${fb[3]}"/>`;
  const ft = f === 'top' ? `x="${L.w / 2}" y="${T - 3}"` : f === 'bottom' ? `x="${L.w / 2}" y="${L.h - 3}"` : f === 'left' ? `x="${T - 3}" y="${L.h / 2}" transform="rotate(-90 ${T - 3} ${L.h / 2})"` : `x="${L.w - 3}" y="${L.h / 2}" transform="rotate(90 ${L.w - 3} ${L.h / 2})"`;
  h += `<text class="front-t" ${ft} text-anchor="middle">FRONT</text>`;
  if (L.teacher) { const t = L.teacher; h += `<g transform="translate(${t.x},${t.y})"><rect class="tdesk" width="${t.w}" height="${t.h}" rx="8"/><text class="tdesk-t" x="${t.w / 2}" y="${t.h / 2 + 4}" text-anchor="middle">Teacher</text></g>`; }
  if (L.door) { const d = L.door; h += `<g transform="translate(${d.x},${d.y})"><rect class="door" width="44" height="14" rx="3"/><text class="door-t" x="22" y="11" text-anchor="middle">DOOR</text></g>`; }
  const byId = {}; stu.forEach(s => byId[s.id] = s); const locks = (!print && w && w.locks) || {};
  G.ds.forEach(d => {
    const sid = seats[d.id], s = sid ? byId[sid] : null; const isSel = !print && seatSel === d.id, isHov = !print && seatHover && seatHover.deskId === d.id;
    h += `<g class="cdesk" data-desk="${esc(d.id)}" tabindex="${print ? -1 : 0}" role="button" aria-label="Desk ${G.nums[d.id]}${s ? ': ' + esc(seatName(s)) : ' (empty)'}" transform="translate(${d.x},${d.y}) rotate(${d.r || 0} ${DESK / 2} ${DESK / 2})">`;
    h += `<rect class="cdesk-r${s ? '' : ' empty'}${isSel ? ' sel' : ''}${seatSel && !print && !isSel ? ' target' : ''}" width="${DESK}" height="${DESK}" rx="8"/>`;
    if (s) {
      const cid = 'c' + d.id + (print ? 'p' : ''); const showPhoto = s.photo && !H; const initials = ((s.first[0] || '') + (s.last[0] || '')).toUpperCase();
      if (safe) { const ph = DESK - 27; h += `<clipPath id="${cid}"><rect x="3" y="3" width="${DESK - 6}" height="${ph}" rx="6"/></clipPath>`;
        if (showPhoto) h += `<image href="${s.photo}" x="3" y="3" width="${DESK - 6}" height="${ph}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${cid})"/>`; else h += `<rect x="3" y="3" width="${DESK - 6}" height="${ph}" rx="6" fill="#E9EEF5"/>`;
        const pp = seatParts(s); const fn = H ? mask(s.display) : pp.first, ln = H ? '' : pp.last;
        h += `<text class="cname" x="${DESK / 2}" y="${DESK - 13}" text-anchor="middle" style="font-size:${fn.length > 9 ? 7 : 8.5}px">${esc(fn)}</text><text class="cname" x="${DESK / 2}" y="${DESK - 4}" text-anchor="middle" style="font-size:${ln.length > 10 ? 6.5 : 7.5}px;font-weight:500">${esc(ln)}</text></g>`; return; }
      h += `<clipPath id="${cid}"><rect x="3" y="3" width="${DESK - 6}" height="${DESK - 22}" rx="6"/></clipPath>`;
      if (showPhoto) h += `<image href="${s.photo}" x="3" y="3" width="${DESK - 6}" height="${DESK - 22}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${cid})"/>`;
      else h += `<rect x="3" y="3" width="${DESK - 6}" height="${DESK - 22}" rx="6" fill="#E9EEF5"/><text x="${DESK / 2}" y="${DESK / 2 - 5}" text-anchor="middle" font-size="16" font-weight="700" fill="#16213A">${esc(initials)}</text>`;
      const nm = seatShort(s); const fs = nm.length <= 9 ? 11 : nm.length <= 12 ? 10 : 9;
      h += `<text class="cname" x="${DESK / 2}" y="${DESK - 5}" text-anchor="middle" style="font-size:${fs}px">${esc(nm)}</text>`;
      if (s.level && !H) h += `<circle cx="${DESK - 8}" cy="8" r="5" fill="${SEAT_LV[s.level]}" stroke="#fff" stroke-width="1.5"><title>FAST level ${s.level}</title></circle>`;
      if (s.behavior === 'high' && !H) h += `<rect x="3" y="3" width="11" height="11" rx="2.5" fill="${BEH_COLOR}"/><text x="8.5" y="11.5" text-anchor="middle" font-size="8" font-weight="800" fill="#fff">H</text>`;
      if (s.plan && !H) { const lab = s.plan === 'ESE+504' ? 'E/5' : s.plan; const pw = lab.length * 6 + 6; h += `<rect x="${(DESK - pw) / 2}" y="${DESK - 36}" width="${pw}" height="11" rx="3" fill="#16213A"/><text x="${DESK / 2}" y="${DESK - 27.5}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#fff">${esc(lab)}</text>`; }
      if (locks[sid]) h += `<text x="${DESK - 3}" y="${DESK - 22}" text-anchor="end" font-size="10">🔒</text>`;
    } else h += `<text class="cnum" x="${DESK / 2}" y="${DESK / 2 + 3}" text-anchor="middle">${G.nums[d.id] || ''}</text>`;
    if (isHov) h += `<rect width="${DESK}" height="${DESK}" rx="8" fill="rgba(45,212,191,.25)" stroke="#0F766E" stroke-width="2"/>`;
    h += `</g>`;
  });
  return h + `</svg>`;
}
const SEAT_SVG_CSS = `.chartSvg{width:100%;height:auto;display:block;font-family:'DM Sans',system-ui,sans-serif}.chartSvg .front{fill:#0F766E}.chartSvg .front-t{font-size:9px;font-weight:800;fill:#fff;letter-spacing:.2em}.chartSvg .tdesk{fill:#DDF4F0;stroke:#0F766E;stroke-width:1.5}.chartSvg .tdesk-t{font-size:10px;font-weight:700;fill:#0F766E}.chartSvg .door{fill:#E6E4DC;stroke:#66708A}.chartSvg .door-t{font-size:7px;font-weight:800;fill:#66708A;letter-spacing:.1em}.chartSvg .cdesk-r{fill:#fff;stroke:#16213A;stroke-width:1.5}.chartSvg .cdesk-r.empty{fill:#F6F5F0;stroke:#C9C5B8;stroke-dasharray:3 2}.chartSvg .cdesk-r.sel{stroke:#0F766E;stroke-width:3.5;fill:#DDF4F0}.chartSvg .cdesk-r.target{stroke:#2DD4BF;stroke-dasharray:3 3}.chartSvg .cdesk-r.hov{fill:#DDF4F0;stroke:#0F766E;stroke-width:2.5;stroke-dasharray:none}.chartSvg .cname{font-size:9.5px;font-weight:700;fill:#16213A}.chartSvg .cnum{font-size:12px;font-weight:700;fill:#A9AEBB}.chartSvg .cdesk:focus-visible{outline:none}.chartSvg .cdesk:focus-visible .cdesk-r{stroke:#0F766E;stroke-width:3}`;
/* ---- Seating view ---- */
function renderSeatingBar(s) {
  const room = roomOK(); const sub = view.sub === 'room' ? 'room' : 'chart';
  return `<div class="crumb"><button id="back">‹ ${esc(s.label)}</button><h2>Seating</h2></div><span class="meta">${sub === 'room' ? `${plural(room.desks.length, 'desk')} · one room for every class` : (s.seating ? `saved ${esc(fmtDate((s.seating.savedAt || '').slice(0, 10)))}` : 'no saved chart yet')}</span>
    <div class="spacer"></div>
    <div class="seg small" id="seatSub"><button data-sub="chart" class="${sub === 'chart' ? 'on' : ''}">Chart</button><button data-sub="room" class="${sub === 'room' ? 'on' : ''}">Room</button></div>
    ${sub === 'chart' ? `<button class="pill toggle" id="seatPrint" ${workFor(s) ? '' : 'disabled'}>Print</button><button class="pill toggle" id="seatWeights" title="What the solver weighs">Priorities</button>` : ''}`;
}
function renderSeating(s) {
  const wrap = $('#gridwrap'); wrap.innerHTML = ''; roomOK(); seatUiFor(s); renderBar();
  if (view.sub === 'room') return renderRoom(s);
  const stu = seatStudents(s), G = geometry(), nd = G.ds.length; const H = seatHidden();
  if (s.seating && s.seating.seats) { const tmp = { seats: s.seating.seats, locks: s.seating.locks || {} }; const freed = pruneSeats(tmp, stu); if (freed) { save(); toast(`${plural(freed, 'seat')} freed — ${freed === 1 ? 'that student is' : 'those students are'} no longer on the roster.`, false, 5000); } }
  const w = workFor(s); if (w) pruneSeats(w, stu);
  // Seating info for students no longer on the roster: stamped the day they vanish, kept 45 days (transfers come back), then dropped.
  const onRoster = new Set(stu.map(x => x.id)); const today = new Date().toISOString().slice(0, 10); const departed = []; let changed = false;
  for (const k of Object.keys(s.seatInfo || {})) { const i = s.seatInfo[k]; if (onRoster.has(k)) { if (i.gone) { delete i.gone; changed = true; } continue; } if (!i.gone) { i.gone = today; changed = true; } if (ageDays(i.gone) > 45) { delete s.seatInfo[k]; changed = true; continue; } departed.push({ id: k, gone: i.gone, photo: i.photo }); }
  if (changed) save();
  const seatCands = seatCandsBy[s.key] || [];
  let side = '';
  if (!nd) side += `<div class="notice"><span>⚠︎</span><span><b>No desks yet.</b> Draw your room first — it's shared by every class.</span><button data-sub="room">Room</button></div>`;
  else if (stu.length > nd) side += `<div class="notice"><span>⚠︎</span><span>${stu.length} students but only ${nd} desks — add desks in Room.</span><button data-sub="room">Room</button></div>`;
  if (!stu.length) side += `<div class="notice info"><span>ⓘ</span><span>No students on this class's roster yet.</span></div>`;
  const nLocks = w ? Object.keys(w.locks).filter(k => Object.values(w.seats).includes(k)).length : 0;
  const can = stu.length && nd && stu.length <= nd && !seatSolving;
  if (w) side += `<div id="seatMove">${movePanelHTML(s, w, stu, G)}</div>`;
  side += `<button class="pill big" id="seatGen" ${can ? '' : 'disabled'}>${seatSolving ? 'Thinking…' : (w ? 'Generate new options' : 'Generate seating')}${nLocks ? ` (keeping ${nLocks} locked)` : ''}</button>`;
  if (!w && nd && stu.length && !seatSolving) side += `<button class="pill pale" id="seatHand">Seat by hand</button>`;
  if (seatSolving) side += `<div class="prog"><i id="seatBar"></i></div>`;
  if (seatCands.length) side += `<div class="cand">` + seatCands.map((c, i) => `<button class="${w && w.candIdx === i && w.source === 'cand' ? 'on' : ''}" data-cand="${i}">Option ${i + 1}<small>fit ${c.fit}${c.hard ? ' · ' + c.hard + ' hard' : ''}</small></button>`).join('') + `</div>`;
  if (w) {
    const M = buildModel(s, stu, G); const sc = scoreSeats(s, w.seats, stu, G, M); const iss = explainSeats(w.seats, stu, G);
    side += `<div class="fit"><div class="n ${sc.hard ? 'bad' : sc.fit >= 85 ? 'good' : sc.fit >= 60 ? 'mid' : 'bad'}">${sc.fit}</div><div><b>Fit</b>${w.dirty ? ' <span class="hchip">edited</span>' : w.source === 'saved' ? ' <span class="hchip ok">saved</span>' : ''}<div class="ghint">${sc.hard ? `<b class="ddown">${sc.hard} hard rule${sc.hard > 1 ? 's' : ''} broken</b> — fit is 0 until they're fixed` : `${sc.fit}% less priority cost than a random seating (the fill-from-front and standing bands always cost something, so 100 isn't reachable)`}</div></div></div>`;
    side += `<div class="rp-actions"><button class="pill" id="seatSave" ${w.dirty || w.source === 'cand' ? '' : 'disabled'}>Save${w.source === 'saved' ? ' changes' : ' as this class’s chart'}</button><button class="pill pale" id="seatUndo" ${w.undo.length ? '' : 'disabled'}>Undo</button>${w.dirty || w.source === 'cand' ? `<button class="pill pale" id="seatRevert">${s.seating ? 'Back to saved' : 'Discard'}</button>` : ''}${s.seating && !w.dirty && w.source === 'saved' ? `<button class="pill pale danger small" id="seatClear">Clear saved</button>` : ''}</div>`;
    side += `<details ${iss.length && iss.length <= 6 ? 'open' : ''}><summary>${iss.length ? plural(iss.length, 'issue') : 'No issues'}${iss.some(x => x.t === 'hard') ? ` · <b class="ddown">${iss.filter(x => x.t === 'hard').length} hard</b>` : ''}</summary><div class="seatIssues">${iss.length ? iss.map(x => `<div class="issue ${x.t}">${esc(x.msg)}</div>`).join('') : '<div class="issue info">Every priority is satisfied.</div>'}</div></details>`;
    const unseated = stu.filter(x => !Object.values(w.seats).includes(x.id));
    if (unseated.length) side += `<div class="notice"><span>⚠︎</span><span><b>Not seated${stu.length > nd ? ` (${stu.length - nd} more students than desks)` : ''}:</b> ${unseated.map(x => `<button class="chip ${seatPending === x.id ? 'on' : ''}" data-unseated="${stu.indexOf(x)}">${esc(seatName(x))}</button>`).join(' ')}</span></div>`;
  }
  const noScore = stu.filter(x => x.standing == null).length;
  side += `<h3 class="seatH">Students <small>${stu.length}</small></h3>${stu.length > 8 ? `<input class="txt seatSearch" id="seatSearch" placeholder="Find a student…" aria-label="Find a student" autocomplete="off">` : ''}${noScore ? `<p class="ghint">${plural(noScore, 'student')} with no scores yet — treated as mid-level for placement.</p>` : ''}<div class="seatList">${stu.map((x, i) => `<div class="seatStu" data-n="${esc(norm(x.display + ' ' + seatName(x)))}"><button class="seatOpen" data-sheet="${i}" aria-label="Edit ${esc(seatName(x))}"><span class="ph">${x.photo && !H ? `<img src="${x.photo}" alt="">` : esc(((x.first[0] || '') + (x.last[0] || '')).toUpperCase())}</span><span class="col"><span class="nm">${esc(seatName(x))}</span><span class="tags">${x.standing != null ? `<i class="st" title="${esc(standingText(x))}">${x.standing}</i>` : ''}${H ? '' : `${x.plan ? `<i class="plan">${esc(x.plan)}</i>` : ''}${x.nearTeacher ? '<i>Near</i>' : ''}${x.apart.length ? `<i class="apart">${x.apart.length} apart</i>` : ''}${x.together.length ? `<i class="near">${x.together.length} near</i>` : ''}`}</span></span></button>${H ? '' : `<span class="quick"><span class="seg tiny" role="group" aria-label="Behavior">${['low', 'medium', 'high'].map(b => `<button data-qb="${i}|${b}" class="${x.behavior === b ? (b === 'high' ? 'on hot' : 'on') : ''}" aria-pressed="${x.behavior === b}" title="${b} behavior">${b[0].toUpperCase()}</button>`).join('')}</span><button class="ft ${x.front ? 'on' : ''}" data-qf="${i}" aria-pressed="${!!x.front}" title="Needs a front seat">F</button></span>`}</div>`).join('')}</div>`;
  if (departed.length) side += `<details class="departed"><summary>Not on the roster <small>${departed.length}</small></summary><p class="ghint">Kept 45 days in case they return, then forgotten. Photos, flags and notes go with them.</p>${departed.map((d, i) => `<div class="seatStu gone"><span class="ph">${d.photo && !H ? `<img src="${d.photo}" alt="">` : '·'}</span><span class="nm">${esc(H ? mask(d.id) : d.id)}</span><span class="tags"><i>since ${esc(fmtDate(d.gone))}</i></span><button class="pill pale small" data-forget="${i}">Forget</button></div>`).join('')}<button class="pill pale small" id="forgetAll">Forget all ${departed.length}</button></details>`;
  const hint = w ? (seatSel ? '<b>Tap another desk</b> to swap or move · tap the same desk to cancel' : seatPending ? '<b>Tap an empty desk</b> to seat them' : 'Tap a student on the chart to see why they\u2019re there, lock them, or move them') : (nd ? 'Generate seating, or seat by hand; tap a student in the list to set flags first.' : '');
  wrap.innerHTML = `<div class="seat"><aside class="seatSide">${side}</aside><section class="seatMain"><p class="ghint seatHint">${hint}</p><div class="chart-stage">${svgChart(s, w ? w.seats : {}, stu, G, 'screen', w)}</div><div class="seatLegend">${H ? '<span>Names off — initials only</span>' : `<span><b class="planTag">H</b> high behavior</span><span>FAST level ${[1, 2, 3, 4, 5].map(l => `<i style="background:${SEAT_LV[l]}"></i>${l}`).join(' ')}</span><span><b class="planTag">ESE</b>/<b class="planTag">504</b> plan</span>`}<span>🔒 locked</span><span>partners: <b>${esc(SEAT_PAIRS.find(b => b[0] === seatPairs())[1])}</b></span><span>number = standing by <b>${esc(SEAT_BASES.find(b => b[0] === seatBasis())[1])}</b>${seatBasis() === 'blend' ? ' (FAST · Focus · IXL, relative to the class)' : ' (relative to the class)'}</span></div></section></div>`;
  bindSeating(s, wrap, w, stu, G, departed);
}
function movePanelHTML(s, w, stu, G) {
  let h = '';
  if (seatSel && w) { const sid = w.seats[seatSel], x = stu.find(z => z.id === sid);
    if (x) { const lines = whyHere(s, w, sid, seatSel, stu, G); const H = state.settings.hideNames;
      h += `<div class="seatWhy"><div class="who">${x.photo && !H ? `<img class="ph" src="${x.photo}" alt="">` : ''}<div><b>${esc(seatName(x))}</b><div class="ghint">${esc(H ? '' : x.display)}${x.level ? ' · L' + x.level : ''}${x.standing != null ? ' · standing ' + x.standing : ''}</div></div></div>
        <div class="rp-actions"><button class="pill small ${w.locks[sid] ? '' : 'pale'}" data-lock="${stu.indexOf(x)}">${w.locks[sid] ? '🔒 Locked' : '🔓 Lock seat'}</button><button class="pill pale small" data-unseat="${esc(seatSel)}" ${w.locks[sid] ? 'disabled' : ''}>Unseat</button><button class="pill pale small" data-sheet="${stu.indexOf(x)}">Edit</button></div>
        ${lines.map(l => `<div class="issue ${l.plan ? 'plan' : l.ok ? 'info' : 'warn'}">${esc(l.msg)}</div>`).join('')}
        ${seatHover && seatHover.rep ? `<div class="ifhere"><b>If dropped here:</b> ${deltaHTML(seatHover.rep)}</div>` : ''}</div>`; } }
  const nm = id => { const x = stu.find(z => z.id === id); return x ? seatName(x) : (seatHidden() ? mask(id) : id); };
  if (seatLast && !seatSel) h += `<div class="seatWhy"><b>${esc(seatLast.a && seatLast.b ? `Swapped ${nm(seatLast.a)} and ${nm(seatLast.b)}` : `Moved ${nm(seatLast.a || seatLast.b)} to an empty desk`)}</b> ${deltaHTML(seatLast)}</div>`;
  return h;
}
function bindSeating(s, wrap, w, stu, G, departed) {
  wrap.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { view.sub = b.dataset.sub; render(); });
  const gen = $('#seatGen'); if (gen) gen.onclick = () => seatGenerate(s);
  const seatCands = seatCandsBy[s.key] || [];
  wrap.querySelectorAll('[data-cand]').forEach(b => b.onclick = () => { const i = +b.dataset.cand; if (!seatCands[i]) return; const nw = setWork(s, seatCands[i].seats, 'cand'); nw.candIdx = i; renderSeating(s); });
  const hand = $('#seatHand'); if (hand) hand.onclick = () => { setWork(s, {}, 'hand'); renderSeating(s); };
  const sv = $('#seatSave'); if (sv) sv.onclick = () => { s.seating = { seats: JSON.parse(JSON.stringify(w.seats)), locks: { ...w.locks }, savedAt: new Date().toISOString() }; w.dirty = false; w.source = 'saved'; w.undo = []; seatLast = null; seatCandsBy[s.key] = []; const ok = save(); render(); if (ok) toast(`Seating chart saved for ${esc(s.label)}.`, false); };
  const un = $('#seatUndo'); if (un) un.onclick = () => { if (!w.undo.length) return; w.seats = JSON.parse(w.undo.pop()); w.dirty = true; seatLast = null; seatSel = null; renderSeating(s); };
  const rv = $('#seatRevert'); if (rv) rv.onclick = () => { seatCandsBy[s.key] = []; delete seatWork[s.key]; renderSeating(s); };
  const cl = $('#seatClear'); if (cl) cl.onclick = () => seatConfirm('Clear the saved chart?', `${esc(s.label)}'s saved seating chart will be removed. Locks go too.`, 'Clear it', () => { delete s.seating; delete seatWork[s.key]; seatCandsBy[s.key] = []; save(); render(); });
  wrap.querySelectorAll('[data-sheet]').forEach(b => b.onclick = () => { const x = stu[+b.dataset.sheet]; if (x) openSeatSheet(s, x.id); });
  const q = $('#seatSearch'); if (q) { q.value = seatQuery; const filt = () => { const t = norm(q.value); wrap.querySelectorAll('.seatStu[data-n]').forEach(el => { el.hidden = !!t && !el.dataset.n.includes(t); }); }; filt(); q.oninput = () => { seatQuery = q.value; filt(); }; }
  const touch = () => { seatBase = { key: '', v: 0 }; save(); const sc = wrap.querySelector('.seatList') ? wrap.querySelector('.seatList').scrollTop : 0; renderSeating(s); const sl = $('#gridwrap').querySelector('.seatList'); if (sl) sl.scrollTop = sc; };
  wrap.querySelectorAll('[data-qb]').forEach(b => b.onclick = () => { const [i, beh] = b.dataset.qb.split('|'); const x = stu[+i]; if (!x) return; seatInfoOf(s, x.id).behavior = beh; touch(); });
  wrap.querySelectorAll('[data-forget]').forEach(b => b.onclick = () => { const d = departed[+b.dataset.forget]; if (!d) return; delete s.seatInfo[d.id]; save(); renderSeating(s); });
  const fa = $('#forgetAll'); if (fa) fa.onclick = () => { departed.forEach(d => delete s.seatInfo[d.id]); save(); renderSeating(s); };
  wrap.querySelectorAll('[data-qf]').forEach(b => b.onclick = () => { const x = stu[+b.dataset.qf]; if (!x) return; const info = seatInfoOf(s, x.id); info.front = !info.front; touch(); });
  wrap.querySelectorAll('[data-lock]').forEach(b => b.onclick = () => { const x = stu[+b.dataset.lock]; if (!x) return; const sid = x.id; if (w.locks[sid]) delete w.locks[sid]; else w.locks[sid] = true; w.dirty = true; renderSeating(s); });
  wrap.querySelectorAll('[data-unseat]').forEach(b => b.onclick = () => { const d = b.dataset.unseat; const sid = w.seats[d]; if (!sid || w.locks[sid]) return; w.undo.push(JSON.stringify(w.seats)); delete w.seats[d]; w.dirty = true; seatSel = null; seatLast = null; renderSeating(s); });
  wrap.querySelectorAll('[data-unseated]').forEach(b => b.onclick = () => { const x = stu[+b.dataset.unseated]; if (!x) return; seatPending = seatPending === x.id ? null : x.id; seatSel = null; renderSeating(s); });
  wrap.querySelectorAll('.cdesk').forEach(g => {
    const id = g.dataset.desk;
    const act = () => { if (!w) { if (!stu.length) return; return; } if (seatPending) { if (!w.seats[id]) { w.undo.push(JSON.stringify(w.seats)); for (const d of Object.keys(w.seats)) if (w.seats[d] === seatPending) delete w.seats[d]; w.seats[id] = seatPending; w.dirty = true; } seatPending = null; renderSeating(s); return; }
      const sid = w.seats[id]; if (seatSel == null) { if (sid) { seatSel = id; seatHover = null; renderSeating(s); } return; } if (seatSel === id) { seatSel = null; seatHover = null; renderSeating(s); return; }
      const rep = seatMove(s, w, seatSel, id, false); if (rep) { seatLast = rep; seatSel = null; seatHover = null; } renderSeating(s); };
    g.onclick = act; g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } };
    const rect = g.querySelector('.cdesk-r');
    g.onmouseenter = () => { if (!w || seatSel == null || seatSel === id) return; seatHover = { deskId: id, rep: seatMove(s, w, seatSel, id, true) }; if (rect) rect.classList.add('hov'); const mp = $('#seatMove'); if (mp) mp.innerHTML = movePanelHTML(s, w, stu, G); };
    g.onmouseleave = () => { if (rect) rect.classList.remove('hov'); if (seatHover) { seatHover = null; const mp = $('#seatMove'); if (mp) mp.innerHTML = movePanelHTML(s, w, stu, G); } };
  });
}
/* ---- priorities (weights) ---- */
function openSeatWeights(sec) {
  const m = $('#modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="panel narrow"><header><h2>Seating priorities</h2><button id="mClose" aria-label="Close">×</button></header><div class="body one">
    <div class="field"><label>Place by <small>(what "standing" means — lower standing is pulled toward the front and kept from pairing up)</small></label><div class="seg small wrap" id="seatBasisSeg">${SEAT_BASES.map(b => `<button data-basis="${b[0]}" class="${seatBasis() === b[0] ? 'on' : ''}" title="${esc(b[2])}">${b[1]}</button>`).join('')}</div><p class="ghint" id="basisHint">${esc(SEAT_BASES.find(b => b[0] === seatBasis())[2])}</p></div>
    <div class="field"><label>Partners <small>(how the "Partner pairing" weight below is spent)</small></label><div class="seg small wrap" id="seatPairsSeg">${SEAT_PAIRS.map(b => `<button data-pairs="${b[0]}" class="${seatPairs() === b[0] ? 'on' : ''}" title="${esc(b[2])}">${b[1]}</button>`).join('')}</div><p class="ghint" id="pairsHint">${esc(SEAT_PAIRS.find(b => b[0] === seatPairs())[2])}</p></div>
    <p class="ghint">Keep-apart links are always hard rules. Changes apply the next time you generate.</p>
    ${SEAT_FACTORS.map(f => `<div class="wt"><label>${esc(f.label)}<small>${esc(f.desc)}</small></label><input type="range" min="0" max="10" step="1" value="${seatW(f.k)}" data-w="${f.k}"><b>${seatW(f.k)}</b></div>`).join('')}
    <div class="rp-actions"><button class="pill" id="mCancel">Done</button><button class="pill pale" id="wReset">Reset to defaults</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; save(); render(); };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.querySelectorAll('[data-w]').forEach(r => r.oninput = () => { state.seatWeights = state.seatWeights || {}; state.seatWeights[r.dataset.w] = +r.value; r.nextElementSibling.textContent = r.value; });
  m.querySelectorAll('[data-basis]').forEach(b => b.onclick = () => { state.seatBasis = b.dataset.basis; seatBase = { key: '', v: 0 }; m.querySelectorAll('[data-basis]').forEach(z => z.classList.toggle('on', z === b)); $('#basisHint').textContent = SEAT_BASES.find(x => x[0] === b.dataset.basis)[2]; });
  m.querySelectorAll('[data-pairs]').forEach(b => b.onclick = () => { state.seatPairs = b.dataset.pairs; seatBase = { key: '', v: 0 }; m.querySelectorAll('[data-pairs]').forEach(z => z.classList.toggle('on', z === b)); $('#pairsHint').textContent = SEAT_PAIRS.find(x => x[0] === b.dataset.pairs)[2]; });
  $('#wReset').onclick = () => { state.seatWeights = {}; state.seatBasis = 'blend'; state.seatPairs = 'mix'; close(); openSeatWeights(sec); };
}
/* ---- student sheet ---- */
function openSeatSheet(sec, display) {
  const stu = seatStudents(sec); const x = stu.find(z => z.id === display); if (!x) return; const info = seatInfoOf(sec, display); const H = state.settings.hideNames;
  const others = stu.filter(z => z.id !== display);
  const m = $('#modal'); m.classList.remove('hidden'); m.classList.add('private'); $('#toast').classList.remove('show');
  const list = (field, cls) => others.length ? `<div class="picks">${others.map(o => `<button class="chip rel ${(info[field] || []).includes(o.id) ? cls : ''}" data-rel="${field}|${stu.indexOf(o)}">${esc(seatName(o))}</button>`).join('')}</div>` : '<p class="ghint">No other students.</p>';
  m.innerHTML = `<div class="panel"><header><h2>${esc(seatName(x))} <span class="hsub">${esc(sec.label)} · seating</span></h2><button id="mClose" aria-label="Close">×</button></header><div class="body one stucard">
    <div class="who">${x.photo && !H ? `<img class="ph big" src="${x.photo}" alt="">` : ''}<div><div class="ghint">${esc(H ? '' : x.display)}</div><div><b>Standing:</b> ${esc(standingText(x))}${x.gi != null ? ` · <button class="linkbtn" id="toGrades">Grades card</button>` : ''}</div></div></div>
    ${H ? '<p class="warnline">Names are hidden — nickname, plan, accommodations and notes are not shown or editable until Names is on.</p>' : `<div class="field"><label>Shown as <small>(how the name reads on the chart and prints — Focus has “${esc(x.display)}”)</small></label><div class="two"><input id="shNick" class="txt" value="${esc(info.nick || '')}" placeholder="${esc(titleCase(x.first))}" aria-label="First name shown"><input id="shLast" class="txt" value="${esc(info.shownLast || '')}" placeholder="${esc(titleCase(x.last))}" aria-label="Last name shown"></div></div>`}
    <div class="field"><label>Behavior / talkativeness</label><div class="seg small" id="shBeh">${['low', 'medium', 'high'].map(b => `<button data-beh="${b}" class="${info.behavior === b ? (b === 'high' ? 'on hot' : 'on') : ''}">${b[0].toUpperCase() + b.slice(1)}</button>`).join('')}</div></div>
    <div class="field"><label>Seating flags</label><div class="rp-actions"><button class="pill small ${info.front ? '' : 'pale'}" data-flag="front">${info.front ? '✓ ' : ''}Front seat</button><button class="pill small ${info.nearTeacher ? '' : 'pale'}" data-flag="nearTeacher">${info.nearTeacher ? '✓ ' : ''}Near teacher</button></div></div>
    ${H ? '' : `<div class="field"><label>ESE / 504 plan</label><div class="seg small" id="shPlan">${[['', 'None'], ['ESE', 'ESE (IEP)'], ['504', '504'], ['ESE+504', 'Both']].map(([v, l]) => `<button data-plan="${v}" class="${(info.plan || '') === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <textarea id="shAccom" class="txt" rows="2" style="min-height:64px;height:64px" placeholder="Plan accommodations to keep in view (preferential seating, away from the door, checks for understanding…)">${esc(info.accom || '')}</textarea></div>`}
    <div class="field"><label>Keep apart from <small>(hard rule)</small></label>${list('apart', 'apart')}</div>
    <div class="field"><label>Seat near <small>(preference)</small></label>${list('together', 'near')}</div>
    ${H ? '' : `<div class="field"><label>Notes</label><textarea id="shNotes" class="txt" rows="2" style="min-height:64px;height:64px" placeholder="Vision, hearing, anything the chart should respect…">${esc(info.notes || '')}</textarea></div>`}
    <div class="rp-actions"><button class="pill" id="mCancel">Done</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; save(); seatBase = { key: '', v: 0 }; render(); };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  const nk = $('#shNick'); if (nk) nk.onchange = e => { info.nick = e.target.value.trim().slice(0, 40); }; const sl = $('#shLast'); if (sl) sl.onchange = e => { info.shownLast = e.target.value.trim().slice(0, 40); };
  const ac = $('#shAccom'); if (ac) ac.onchange = e => { info.accom = e.target.value.slice(0, 2000); }; const nt = $('#shNotes'); if (nt) nt.onchange = e => { info.notes = e.target.value.slice(0, 2000); };
  m.querySelectorAll('[data-beh]').forEach(b => b.onclick = () => { info.behavior = b.dataset.beh; m.querySelectorAll('[data-beh]').forEach(z => { z.classList.toggle('on', z === b); z.classList.toggle('hot', z === b && b.dataset.beh === 'high'); }); });
  m.querySelectorAll('[data-flag]').forEach(b => b.onclick = () => { info[b.dataset.flag] = !info[b.dataset.flag]; b.classList.toggle('pale', !info[b.dataset.flag]); b.textContent = (info[b.dataset.flag] ? '✓ ' : '') + (b.dataset.flag === 'front' ? 'Front seat' : 'Near teacher'); });
  m.querySelectorAll('[data-plan]').forEach(b => b.onclick = () => { info.plan = b.dataset.plan; m.querySelectorAll('[data-plan]').forEach(z => z.classList.toggle('on', z === b)); });
  m.querySelectorAll('[data-rel]').forEach(b => b.onclick = () => { const [field, idx] = b.dataset.rel.split('|'); const o = stu[+idx]; if (!o) return; const tid = o.id; const other = seatInfoOf(sec, tid); const on = (info[field] || []).includes(tid);
    info[field] = on ? info[field].filter(z => z !== tid) : [...(info[field] || []), tid]; other[field] = on ? (other[field] || []).filter(z => z !== display) : [...new Set([...(other[field] || []), display])];
    const oppo = field === 'apart' ? 'together' : 'apart'; if (!on) { info[oppo] = (info[oppo] || []).filter(z => z !== tid); other[oppo] = (other[oppo] || []).filter(z => z !== display); }
    b.classList.toggle(field === 'apart' ? 'apart' : 'near', !on); if (!on) { const ob = m.querySelector(`[data-rel="${oppo}|${idx}"]`); if (ob) ob.classList.remove(oppo === 'apart' ? 'apart' : 'near'); } });
  const tg = $('#toGrades'); if (tg) tg.onclick = () => { m.classList.add('hidden'); m.classList.remove('private'); m.innerHTML = ''; save(); openStudentCard(sec, x.gi); };
}
/* ---- print ---- */
function openSeatPrint(sec) {
  const w = workFor(sec); if (!w) return; const others = state.order.map(k => state.sections[k]).filter(x => x.key !== sec.key && x.seating).length;
  const m = $('#modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="panel narrow"><header><h2>Print seating chart</h2><button id="mClose" aria-label="Close">×</button></header><div class="body one">
    <div class="rp-actions col"><button class="pill" data-pm="teacher">Teacher copy <small>photos, names, FAST level and behavior markers, plan tags</small></button><button class="pill pale" data-pm="safe">Student / sub copy <small>photos and full names only — safe to project or leave for a sub</small></button></div>
    <label class="chk"><input type="checkbox" id="pmAll" ${others ? '' : 'disabled'}> Every class with a saved chart, one page each${others ? ` (${others + 1} pages)` : ' — no other class has a saved chart'}</label></div></div>`;
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.querySelectorAll('[data-pm]').forEach(b => b.onclick = () => { const all = $('#pmAll').checked; close(); printSeating(sec, b.dataset.pm, all); });
}
function printSeating(sec, mode, all) {
  const G = geometry(); const safe = mode === 'safe'; seatPlain = true;   // the teacher asked for the page: full names and photos, whatever the Names toggle says
  const legend = safe ? '' : `<p class="lg"><b>H</b> high behavior · FAST level ${[1, 2, 3, 4, 5].map(l => `<i style="background:${SEAT_LV[l]}"></i>${l}`).join(' ')} · <b>ESE</b>/<b>504</b> plan · desk number = empty desk</p>`;
  const course = s => s.prep === 'acc' ? 'Accelerated 7th Grade Math (MA.7 + MA.8)' : '7th Grade Math (MA.7)';
  const page = (s, seats) => { const stu = seatStudents(s); const L = roomOK(); return `<section class="pp"><h1>${esc(s.label)}${safe ? '' : ' — seating chart'}</h1><p>${esc(course(s))}${L.name ? ' · Room ' + esc(L.name) : ''} · ${new Date().toLocaleDateString()} · ${Object.keys(seats).length} students${safe ? '' : ' · teacher copy'}</p>${legend}${svgChart(s, seats, stu, G, safe ? 'safe' : 'teacher', null)}</section>`; };
  let body = '';
  try {
    if (all) { for (const k of state.order) { const s = state.sections[k]; const seats = s.key === sec.key ? workFor(sec).seats : (s.seating && s.seating.seats); if (seats) body += page(s, seats); } }
    else body += page(sec, workFor(sec).seats);
  } finally { seatPlain = false; }
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Seating — ${esc(sec.label)}</title><style>@page{size:landscape;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;margin:16px}h1{font-size:18pt;margin:0 0 2px}p{font-size:10pt;color:#555;margin:0 0 8px}.pp{break-after:page;page-break-after:always}.pp:last-child{break-after:auto;page-break-after:auto}.pp svg{width:100%;height:auto;max-height:160mm}.lg{font-size:9pt;color:#333}.lg i{display:inline-block;width:9px;height:9px;border-radius:50%;vertical-align:-1px;margin:0 2px 0 4px}.lg b{background:#16213A;color:#fff;padding:0 4px;border-radius:3px;font-size:8pt}.bar{position:fixed;top:0;right:0;padding:8px;background:#fff}.bar button{font:inherit;padding:6px 14px}@media print{.bar{display:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}${SEAT_SVG_CSS}</style></head><body><div class="bar"><button onclick="window.print()">Print</button></div>${body}</body></html>`;
  const win = window.open('', '_blank');
  if (!win) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = `Seating_${sec.label.replace(/[^\w-]+/g, '_')}.html`; a.click(); toast('Pop-ups are blocked, so the page was saved as a file instead.', false, 5000); return; }
  win.document.open(); win.document.write(html); win.document.close();
}
/* ---- room editor ---- */
const ROOM_TEMPLATES = [
  { k: 'rows', name: 'Straight rows', desc: 'Classic rows, every desk on its own', build: (n, per = 6) => { const G = 24, R = 40, out = []; for (let i = 0; i < n; i++) { const r = Math.floor(i / per), c = i % per; const inRow = Math.min(per, n - r * per); const off = (per - inRow) * (DESK + G) / 2; out.push({ x: off + c * (DESK + G), y: r * (DESK + R), r: 0 }); } return out; } },
  { k: 'pairs', name: 'Partners', desc: 'Desks pushed together in twos, three pairs per row', build: (n, pairsPer = 3) => { const PG = 30, R = 40, out = []; const pairs = Math.ceil(n / 2); for (let i = 0; i < n; i++) { const pr = Math.floor(i / 2), side = i % 2; const row = Math.floor(pr / pairsPer), col = pr % pairsPer; const pairsInRow = Math.min(pairsPer, pairs - row * pairsPer); const off = (pairsPer - pairsInRow) * (2 * DESK + PG) / 2; out.push({ x: off + col * (2 * DESK + PG) + side * DESK, y: row * (DESK + R), r: 0 }); } return out; } },
  { k: 'pods', name: 'Groups of 4', desc: '2×2 pods, three pods across', build: (n, per = 3) => { const PG = 44, out = []; const pods = Math.ceil(n / 4); for (let i = 0; i < n; i++) { const pod = Math.floor(i / 4), k = i % 4; const row = Math.floor(pod / per), col = pod % per; const podsInRow = Math.min(per, pods - row * per); const off = (per - podsInRow) * (2 * DESK + PG) / 2; out.push({ x: off + col * (2 * DESK + PG) + (k % 2) * DESK, y: row * (2 * DESK + PG) + Math.floor(k / 2) * DESK, r: 0 }); } return out; } },
  { k: 'trios', name: 'Groups of 3', desc: 'Three desks side by side, four groups across', build: (n, per = 4) => { const GG = 32, R = 40, out = []; const groups = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const g = Math.floor(i / 3), k = i % 3; const row = Math.floor(g / per), col = g % per; const inRow = Math.min(per, groups - row * per); const off = (per - inRow) * (3 * DESK + GG) / 2; out.push({ x: off + col * (3 * DESK + GG) + k * DESK, y: row * (DESK + R), r: 0 }); } return out; } },
  { k: 'ushape', name: 'Horseshoe', desc: 'A U open toward the front, everyone facing in', build: n => { const G = 8, out = []; const s = Math.max(2, Math.round(n * 0.27)), b = n - 2 * s; const backW = b * (DESK + G) - G; const W = backW + 2 * (DESK + 40); const H = s * (DESK + G) + DESK + 40; for (let i = 0; i < s; i++) out.push({ x: 0, y: i * (DESK + G), r: 90 }); for (let i = 0; i < b; i++) out.push({ x: DESK + 40 + i * (DESK + G), y: H - DESK, r: 0 }); for (let i = 0; i < s; i++) out.push({ x: W - DESK, y: i * (DESK + G), r: -90 }); return out; } },
  { k: 'chevron', name: 'Chevron rows', desc: 'Two angled halves pointing at the board, aisle down the middle', build: (n, per = 3) => { const G = 10, R = 44, A = 90, out = []; const rowCap = per * 2; for (let i = 0; i < n; i++) { const row = Math.floor(i / rowCap), k = i % rowCap; const inRow = Math.min(rowCap, n - row * rowCap); const leftN = Math.ceil(inRow / 2); const left = k < leftN; const c = left ? k : k - leftN; const blockW = per * (DESK + G); const x = left ? (per - leftN + c) * (DESK + G) : blockW + A + c * (DESK + G); const stagger = left ? (leftN - 1 - c) * 14 : c * 14; out.push({ x, y: row * (DESK + R) + stagger, r: left ? 12 : -12 }); } return out; } },
];
function roomPush() {
  const seats = {}; for (const k of state.order) { const sec = state.sections[k]; seats[k] = { saved: sec.seating ? JSON.parse(JSON.stringify(sec.seating)) : null, work: seatWork[k] ? JSON.parse(JSON.stringify(seatWork[k])) : null }; }
  roomUndo.push(JSON.stringify({ room: state.room, seats })); if (roomUndo.length > 30) roomUndo.shift();
}
function roomUndoPop() {
  const snap = JSON.parse(roomUndo.pop()); if (!snap.room) { state.room = snap; return; }   // (older shape: the room alone)
  state.room = snap.room; for (const k in snap.seats) { const sec = state.sections[k]; if (!sec) continue; const e = snap.seats[k]; if (e.saved) sec.seating = e.saved; else delete sec.seating; if (e.work) seatWork[k] = e.work; else delete seatWork[k]; }
}
function roomDropDesks(keep) { for (const k of state.order) { const s = state.sections[k]; if (s.seating && s.seating.seats) for (const d of Object.keys(s.seating.seats)) if (!keep.has(d)) delete s.seating.seats[d]; if (seatWork[k]) for (const d of Object.keys(seatWork[k].seats)) if (!keep.has(d)) delete seatWork[k].seats[d]; } }
function svgRoom() {
  const L = roomOK(), nums = deskNumbers();
  let h = `<svg viewBox="-6 -6 ${L.w + 12} ${L.h + 12}" id="roomSvg" class="chartSvg" preserveAspectRatio="xMidYMid meet">`;
  h += `<rect x="0" y="0" width="${L.w}" height="${L.h}" fill="#FBFAF6" stroke="#C9C5B8" stroke-width="2" rx="6"/><defs><pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="15" cy="15" r="1.1" fill="#DDD9CE"/></pattern></defs><rect x="0" y="0" width="${L.w}" height="${L.h}" fill="url(#grid)" pointer-events="none"/>`;
  const f = L.front, T = 14; const fb = f === 'top' ? [0, 0, L.w, T] : f === 'bottom' ? [0, L.h - T, L.w, T] : f === 'left' ? [0, 0, T, L.h] : [L.w - T, 0, T, L.h];
  h += `<rect class="front" x="${fb[0]}" y="${fb[1]}" width="${fb[2]}" height="${fb[3]}" pointer-events="none"/>`;
  const ft = f === 'top' ? `x="${L.w / 2}" y="${T - 3}"` : f === 'bottom' ? `x="${L.w / 2}" y="${L.h - 3}"` : f === 'left' ? `x="${T - 3}" y="${L.h / 2}" transform="rotate(-90 ${T - 3} ${L.h / 2})"` : `x="${L.w - 3}" y="${L.h / 2}" transform="rotate(90 ${L.w - 3} ${L.h / 2})"`;
  h += `<text class="front-t" ${ft} text-anchor="middle" pointer-events="none">FRONT</text>`;
  if (L.teacher) { const t = L.teacher; h += `<g class="g-teacher${roomSel && roomSel.type === 'teacher' ? ' sel' : ''}" data-type="teacher" tabindex="0" role="button" aria-label="Teacher desk" transform="translate(${t.x},${t.y})"><rect class="tdesk" width="${t.w}" height="${t.h}" rx="8"/><text class="tdesk-t" x="${t.w / 2}" y="${t.h / 2 + 4}" text-anchor="middle">Teacher</text></g>`; }
  if (L.door) { const d = L.door; h += `<g class="g-door${roomSel && roomSel.type === 'door' ? ' sel' : ''}" data-type="door" tabindex="0" role="button" aria-label="Door" transform="translate(${d.x},${d.y})"><rect class="door" width="44" height="14" rx="3"/><text class="door-t" x="22" y="11" text-anchor="middle">DOOR</text></g>`; }
  for (const d of L.desks) h += `<g class="g-desk${roomSel && roomSel.type === 'desk' && roomSel.id === d.id ? ' sel' : ''}" data-type="desk" data-id="${esc(d.id)}" tabindex="0" role="button" aria-label="Desk ${nums[d.id]}${roomSel && roomSel.id === d.id ? ', selected' : ''}" transform="translate(${d.x},${d.y}) rotate(${d.r || 0} ${DESK / 2} ${DESK / 2})"><rect class="cdesk-r${roomSel && roomSel.id === d.id ? ' sel' : ''}" width="${DESK}" height="${DESK}" rx="8"/><rect x="6" y="${DESK - 10}" width="${DESK - 12}" height="4" rx="2" fill="#DDD9CE"/><text class="cnum" x="${DESK / 2}" y="${DESK / 2 + 4}" text-anchor="middle">${nums[d.id]}</text></g>`;
  return h + `</svg>`;
}
function renderRoom(s) {
  const L = roomOK(); const wrap = $('#gridwrap'); renderBar();
  let h = `<div class="room"><div class="toolbar"><button class="pill small" id="rmTpl">Templates</button><button class="pill small" id="rmDesk">+ Desk</button><button class="pill small pale" id="rmRow">+ Row…</button><button class="pill small pale" id="rmGrid">Grid…</button>
    <label class="curUnit">Front <select id="rmFront">${['top', 'right', 'bottom', 'left'].map(f => `<option value="${f}" ${L.front === f ? 'selected' : ''}>${f[0].toUpperCase() + f.slice(1)}</option>`).join('')}</select></label>
    <label class="curUnit">Size <input class="mini" type="number" id="rmW" step="50" min="400" value="${L.w}" aria-label="Room width"> × <input class="mini" type="number" id="rmH" step="50" min="300" value="${L.h}" aria-label="Room height"></label>
    <label class="curUnit">Room <input class="mini wide" type="text" id="rmName" maxlength="24" placeholder="e.g. WHM07 100" value="${esc(L.name || '')}" aria-label="Room name (printed on charts)"></label>
    ${L.teacher ? '' : '<button class="pill small pale" id="rmTeacher">+ Teacher desk</button>'}${L.door ? '' : '<button class="pill small pale" id="rmDoor">+ Door</button>'}
    <span class="spacer"></span><button class="pill small pale" id="rmUndo" ${roomUndo.length ? '' : 'disabled'}>↶ Undo</button><button class="pill small pale danger" id="rmClear" ${L.desks.length ? '' : 'disabled'}>Clear desks</button></div>`;
  if (roomSel) { const isDesk = roomSel.type === 'desk';
    h += `<div class="selbar"><b>${isDesk ? 'Desk ' + (deskNumbers()[roomSel.id] || '') : roomSel.type === 'teacher' ? 'Teacher desk' : 'Door'}</b>${isDesk ? '<button class="ib" data-rot="-15" title="Rotate left">⟲</button><button class="ib" data-rot="15" title="Rotate right">⟳</button><button class="ib" id="rmDup" title="Duplicate">⧉</button>' : roomSel.type === 'teacher' ? '<button class="ib" data-rot="90">⟳ 90°</button>' : ''}<span class="nudge"><button class="ib" data-nudge="-10,0" aria-label="Nudge left" title="Nudge left (←)">◀</button><button class="ib" data-nudge="0,-10" aria-label="Nudge up" title="Nudge up (↑)">▲</button><button class="ib" data-nudge="0,10" aria-label="Nudge down" title="Nudge down (↓)">▼</button><button class="ib" data-nudge="10,0" aria-label="Nudge right" title="Nudge right (→)">▶</button></span><span class="spacer"></span><button class="ib danger" id="rmDel" aria-label="Delete" title="Delete (Delete key)">🗑</button><button class="ib" id="rmDesel" aria-label="Deselect" title="Deselect (Esc)">✕</button></div>`; }
  h += `<div class="stage" id="stage">${svgRoom()}<div class="zoomctl"><button class="ib" data-zoom="0.7" aria-label="Zoom in" title="Zoom in">+</button><button class="ib" data-zoom="1.4" aria-label="Zoom out" title="Zoom out">−</button><button class="ib" id="rmFit" aria-label="Fit the room in view" title="Fit room">Fit</button></div></div>
    <p class="ghint">Drag a desk to move it, drag empty space to pan, pinch or + / − to zoom; select a desk and use the arrows to nudge it one grid step. Keyboard: Tab to a desk, Enter selects, arrow keys nudge, R rotates, Delete removes, Esc deselects. Desks are numbered from the front, left to right. Saved charts follow desks when you move them; deleting a desk unseats whoever is in it in every class.</p></div>`;
  wrap.innerHTML = h; bindRoom(s, wrap);
}
function bindRoom(s, wrap) {
  const L = state.room; const rr = () => { save(); renderRoom(s); };
  $('#rmTpl').onclick = () => openRoomTemplates(s);
  $('#rmDesk').onclick = () => { roomPush(); const p = roomFreeSpot(); const d = { id: seatUid(), x: p.x, y: p.y, r: 0 }; L.desks.push(d); roomSel = { type: 'desk', id: d.id }; rr(); };
  $('#rmRow').onclick = () => seatAsk('Add a row', [['n', 'Desks in the row', 6, 1, 20]], v => { roomPush(); const gap = 10, n = v.n; const rowW = n * DESK + (n - 1) * gap; const x0 = Math.max(20, snap10((L.w - rowW) / 2)); let y = 40; while (y < L.h - DESK && L.desks.some(d => Math.abs(d.y - y) < DESK + gap)) y += DESK + 40; for (let i = 0; i < n; i++) L.desks.push({ id: seatUid(), x: x0 + i * (DESK + gap), y: snap10(y), r: 0 }); roomSel = null; rr(); });
  $('#rmGrid').onclick = () => seatAsk('Add a grid', [['r', 'Rows (front to back)', 4, 1, 12], ['c', 'Desks per row', 6, 1, 16], ['pairs', 'Group desks in pairs', true], ['replace', 'Remove the desks already there (unseats everyone in every class)', false]], v => { roomPush(); const gap = v.pairs ? 0 : 12, pairGap = 28; const c = v.c, r = v.r; const rowW = v.pairs ? c * DESK + Math.floor((c - 1) / 2) * pairGap : c * DESK + (c - 1) * gap; const x0 = Math.max(20, snap10((L.w - rowW) / 2)); const totalH = r * DESK + (r - 1) * 40; const y0 = Math.max(30, snap10((L.h - totalH) / 2)); const fresh = []; for (let i = 0; i < r; i++) { let x = x0; for (let j = 0; j < c; j++) { fresh.push({ id: seatUid(), x: snap10(x), y: snap10(y0 + i * (DESK + 40)), r: 0 }); x += DESK + (v.pairs ? (j % 2 === 0 ? 0 : pairGap) : gap); } } if (v.replace) { let unseated = 0; for (const k of state.order) { const sec = state.sections[k]; if (sec.seating && sec.seating.seats) unseated += Object.keys(sec.seating.seats).length; } L.desks = fresh; roomDropDesks(new Set(fresh.map(d => d.id))); if (unseated) setTimeout(() => toast(`${plural(unseated, 'student')} unseated with the old desks. Undo brings them back.`, false, 6000), 300); } else L.desks.push(...fresh); roomSel = null; rr(); });
  $('#rmFront').onchange = e => { roomPush(); L.front = e.target.value; rr(); };
  $('#rmName').onchange = e => { L.name = e.target.value.trim().slice(0, 24); save(); };
  $('#rmW').onchange = e => { roomPush(); L.w = Math.max(400, +e.target.value || 900); roomView = null; rr(); }; $('#rmH').onchange = e => { roomPush(); L.h = Math.max(300, +e.target.value || 600); roomView = null; rr(); };
  const rt = $('#rmTeacher'); if (rt) rt.onclick = () => { roomPush(); L.teacher = { x: Math.max(0, L.w - 150), y: Math.max(0, L.h - 90), w: 130, h: 64 }; rr(); };
  const rd = $('#rmDoor'); if (rd) rd.onclick = () => { roomPush(); L.door = { x: 20, y: Math.max(0, L.h - 40) }; rr(); };
  $('#rmUndo').onclick = () => { if (!roomUndo.length) return; roomUndoPop(); roomSel = null; rr(); };
  $('#rmClear').onclick = () => seatConfirm('Clear every desk?', 'Saved seating for every class will be cleared too. Undo in the room editor brings the desks back, not the seats.', 'Clear desks', () => { roomPush(); L.desks = []; roomDropDesks(new Set()); roomSel = null; rr(); });
  const selObj = () => roomSel ? (roomSel.type === 'desk' ? L.desks.find(d => d.id === roomSel.id) : L[roomSel.type]) : null;
  wrap.querySelectorAll('[data-rot]').forEach(b => b.onclick = () => { roomPush(); const o = selObj(); if (!o) return; if (roomSel.type === 'desk') o.r = ((o.r || 0) + +b.dataset.rot + 360) % 360; else [o.w, o.h] = [o.h, o.w]; rr(); });
  wrap.querySelectorAll('[data-nudge]').forEach(b => b.onclick = () => { const o = selObj(); if (!o) return; roomPush(); const [dx, dy] = b.dataset.nudge.split(',').map(Number); const w = roomSel.type === 'desk' ? DESK : roomSel.type === 'teacher' ? o.w : 44, hh = roomSel.type === 'desk' ? DESK : roomSel.type === 'teacher' ? o.h : 14; o.x = Math.max(0, Math.min(L.w - w, o.x + dx)); o.y = Math.max(0, Math.min(L.h - hh, o.y + dy)); rr(); });
  const dup = $('#rmDup'); if (dup) dup.onclick = () => { const d = selObj(); if (!d) return; roomPush(); const n = { id: seatUid(), x: Math.min(L.w - DESK, d.x + DESK + 10), y: d.y, r: d.r }; L.desks.push(n); roomSel = { type: 'desk', id: n.id }; rr(); };
  const del = $('#rmDel'); if (del) del.onclick = () => { roomPush(); if (roomSel.type === 'desk') { L.desks = L.desks.filter(d => d.id !== roomSel.id); roomDropDesks(new Set(L.desks.map(d => d.id))); } else L[roomSel.type] = null; roomSel = null; rr(); };
  const ds = $('#rmDesel'); if (ds) ds.onclick = () => { roomSel = null; renderRoom(s); };
  wrap.querySelectorAll('[data-zoom]').forEach(b => b.onclick = () => roomZoom(+b.dataset.zoom));
  $('#rmFit').onclick = () => { roomFit(); roomApplyView(); };
  bindStage(s);
}
function roomFreeSpot() { const L = state.room; const taken = (x, y) => L.desks.some(d => Math.abs(d.x - x) < DESK && Math.abs(d.y - y) < DESK) || (L.teacher && Math.abs(L.teacher.x - x) < L.teacher.w && Math.abs(L.teacher.y - y) < L.teacher.h); for (let y = 30; y < L.h - DESK; y += DESK + 20) for (let x = 30; x < L.w - DESK; x += DESK + 20) if (!taken(x, y)) return { x, y }; return { x: 30, y: 30 }; }
const svgPt = (svg, e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
function roomFit() { const L = state.room; const svg = $('#roomSvg'); let W = L.w + 12, H = L.h + 12; const r = svg && svg.getBoundingClientRect(); if (r && r.width && r.height) { const a = r.width / r.height; if (W / H > a) H = W / a; else W = H * a; } roomView = { x: -6 - (W - (L.w + 12)) / 2, y: -6 - (H - (L.h + 12)) / 2, w: W, h: H }; }
function roomApplyView() { const svg = $('#roomSvg'); if (!svg || !roomView) return; svg.setAttribute('viewBox', `${roomView.x} ${roomView.y} ${roomView.w} ${roomView.h}`); }
function roomClamp() { const L = state.room; const m = Math.max(roomView.w, roomView.h) * 0.5; roomView.x = Math.max(-m, Math.min(L.w + m - roomView.w, roomView.x)); roomView.y = Math.max(-m, Math.min(L.h + m - roomView.h, roomView.y)); }
function roomZoom(f, cx, cy) { const L = state.room; if (!roomView) roomFit(); if (cx == null) { cx = roomView.x + roomView.w / 2; cy = roomView.y + roomView.h / 2; } const nw = Math.max(150, Math.min((L.w + 12) * 3, roomView.w * f)), nh = roomView.h * (nw / roomView.w); roomView = { x: cx - (cx - roomView.x) * (nw / roomView.w), y: cy - (cy - roomView.y) * (nh / roomView.h), w: nw, h: nh }; roomClamp(); roomApplyView(); }
function bindStage(s) {
  const svg = $('#roomSvg'); if (!svg) return; const L = state.room; const wrap = $('#gridwrap'); if (!roomView) roomFit(); roomApplyView();
  let drag = null, pinch = null, pan = null; const ptrs = new Map();
  svg.addEventListener('pointerdown', e => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); svg.setPointerCapture(e.pointerId);
    if (ptrs.size === 2) { drag = null; pan = null; const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), view: { ...roomView }, mid: svgPt(svg, { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }) }; return; }
    const g = e.target.closest('g[data-type]'); if (!g) { pan = { sx: e.clientX, sy: e.clientY, vx: roomView.x, vy: roomView.y, moved: false }; return; }
    const type = g.dataset.type, id = g.dataset.id; const obj = type === 'desk' ? L.desks.find(d => d.id === id) : L[type]; const p = svgPt(svg, e);
    drag = { type, id, obj, ox: p.x - obj.x, oy: p.y - obj.y, moved: false, g }; e.preventDefault();
  });
  svg.addEventListener('pointermove', e => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const f = pinch.d / Math.max(1, d); const nw = Math.max(150, Math.min((L.w + 12) * 3, pinch.view.w * f)), nh = pinch.view.h * (nw / pinch.view.w); roomView = { x: pinch.mid.x - (pinch.mid.x - pinch.view.x) * (nw / pinch.view.w), y: pinch.mid.y - (pinch.mid.y - pinch.view.y) * (nh / pinch.view.h), w: nw, h: nh }; roomClamp(); roomApplyView(); return; }
    if (pan) { const rect = svg.getBoundingClientRect(); const k = roomView.w / rect.width; const dx = (e.clientX - pan.sx) * k, dy = (e.clientY - pan.sy) * k; if (Math.abs(e.clientX - pan.sx) + Math.abs(e.clientY - pan.sy) > 4) pan.moved = true; roomView.x = pan.vx - dx; roomView.y = pan.vy - dy; roomClamp(); roomApplyView(); return; }
    if (!drag) return; const p = svgPt(svg, e); const nx = snap10(p.x - drag.ox), ny = snap10(p.y - drag.oy);
    if (nx !== drag.obj.x || ny !== drag.obj.y) { if (!drag.moved) { roomPush(); drag.moved = true; } const w = drag.type === 'desk' ? DESK : drag.type === 'teacher' ? drag.obj.w : 44, hh = drag.type === 'desk' ? DESK : drag.type === 'teacher' ? drag.obj.h : 14; drag.obj.x = Math.max(0, Math.min(L.w - w, nx)); drag.obj.y = Math.max(0, Math.min(L.h - hh, ny)); const r = drag.type === 'desk' ? ` rotate(${drag.obj.r || 0} ${DESK / 2} ${DESK / 2})` : ''; drag.g.setAttribute('transform', `translate(${drag.obj.x},${drag.obj.y})${r}`); }
  });
  const up = e => { ptrs.delete(e.pointerId); if (pinch) { if (ptrs.size < 2) pinch = null; return; } if (pan) { const moved = pan.moved; pan = null; if (!moved && roomSel) { roomSel = null; renderRoom(s); } return; } if (!drag) return; const d = drag; drag = null; roomSel = { type: d.type, id: d.id }; save(); renderRoom(s); };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  svg.addEventListener('keydown', e => {
    const g = e.target.closest && e.target.closest('g[data-type]'); const nudge = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
    if ((e.key === 'Enter' || e.key === ' ') && g) { e.preventDefault(); roomSel = { type: g.dataset.type, id: g.dataset.id }; renderRoom(s); return; }
    if (!roomSel) return;
    const obj = roomSel.type === 'desk' ? L.desks.find(d => d.id === roomSel.id) : L[roomSel.type]; if (!obj) return;
    if (nudge) { e.preventDefault(); roomPush(); const w = roomSel.type === 'desk' ? DESK : roomSel.type === 'teacher' ? obj.w : 44, hh = roomSel.type === 'desk' ? DESK : roomSel.type === 'teacher' ? obj.h : 14; obj.x = Math.max(0, Math.min(L.w - w, obj.x + nudge[0])); obj.y = Math.max(0, Math.min(L.h - hh, obj.y + nudge[1])); save(); renderRoom(s); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); const del = $('#rmDel'); if (del) del.click(); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); const rb = wrap.querySelector('[data-rot="15"], [data-rot="90"]'); if (rb) rb.click(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); roomSel = null; renderRoom(s); }
  });
  if (roomSel && document.activeElement && (document.activeElement === document.body || document.activeElement.closest('#stage'))) { const g = svg.querySelector(roomSel.type === 'desk' ? `g[data-id="${CSS.escape(roomSel.id)}"]` : `g[data-type="${roomSel.type}"]`); if (g) g.focus({ preventScroll: true }); }
  svg.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); const p = svgPt(svg, e); roomZoom(e.deltaY > 0 ? 1.15 : 0.87, p.x, p.y); }, { passive: false });
}
function openRoomTemplates(s) {
  const L = state.room; const n0 = Math.max(L.desks.length, seatStudents(s).length, 2);
  const prev = (t, n) => { const ds = t.build(n); let mx = 0, my = 0; ds.forEach(d => { mx = Math.max(mx, d.x + DESK); my = Math.max(my, d.y + DESK); }); return `<svg viewBox="-2 -2 ${mx + 4} ${my + 4}" class="tplPrev" preserveAspectRatio="xMidYMid meet">${ds.map(d => `<rect x="${d.x}" y="${d.y}" width="${DESK}" height="${DESK}" rx="10" fill="#fff" stroke="#16213A" stroke-width="6" transform="rotate(${d.r || 0} ${d.x + DESK / 2} ${d.y + DESK / 2})"/>`).join('')}</svg>`; };
  const m = $('#modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="panel narrow"><header><h2>Room templates</h2><button id="mClose" aria-label="Close">×</button></header><div class="body one"><p class="ghint">Replaces the desks in the room. Students in saved charts stay seated by desk number.</p><div class="field"><label>Desks</label><input type="number" id="tplN" min="2" max="60" value="${n0}" style="width:90px"></div>
    <div class="tpls" id="tplList">${ROOM_TEMPLATES.map(t => `<button class="tpl" data-tpl="${t.k}">${prev(t, n0)}<span><b>${t.name}</b><small>${t.desc}</small></span></button>`).join('')}</div></div></div>`;
  $('#tplN').oninput = () => { const n = Math.max(2, Math.min(60, parseInt($('#tplN').value) || n0)); m.querySelectorAll('[data-tpl]').forEach(b => { const t = ROOM_TEMPLATES.find(x => x.k === b.dataset.tpl); b.querySelector('.tplPrev').outerHTML = prev(t, n); }); };
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => { const t = ROOM_TEMPLATES.find(x => x.k === b.dataset.tpl); const n = Math.max(2, Math.min(60, parseInt($('#tplN').value) || 22)); roomPush();
    const ds = t.build(n); let mx = 0, my = 0; ds.forEach(d => { mx = Math.max(mx, d.x + DESK); my = Math.max(my, d.y + DESK); }); const M = 60; L.w = Math.max(900, snap10(mx + 2 * M)); L.h = Math.max(600, snap10(my + M + 120)); const x0 = snap10((L.w - mx) / 2), y0 = 40;
    const oldNums = deskNumbers(); const oldIds = [...L.desks].sort((a, b) => oldNums[a.id] - oldNums[b.id]).map(d => d.id); const before = L.desks.length;
    L.desks = ds.map(d => ({ id: seatUid(), x: snap10(x0 + d.x), y: snap10(y0 + d.y), r: d.r || 0 }));
    const newNums = deskNumbers(); const byNum = [...L.desks].sort((a, b) => newNums[a.id] - newNums[b.id]); byNum.forEach((d, i) => { if (oldIds[i]) d.id = oldIds[i]; });
    const keep = new Set(L.desks.map(d => d.id)); let unseated = 0; for (const k of state.order) { const sec = state.sections[k]; if (sec.seating && sec.seating.seats) unseated += Object.keys(sec.seating.seats).filter(d => !keep.has(d)).length; } roomDropDesks(keep);
    if (unseated) setTimeout(() => toast(`${plural(unseated, 'student')} unseated — the new layout has fewer desks than before (${n} vs ${before}). Undo in the room editor brings them back.`, false, 7000), 400);
    if (L.teacher) { L.teacher.x = snap10(L.w - L.teacher.w - 30); L.teacher.y = snap10(L.h - L.teacher.h - 30); } if (L.door) { L.door.x = 20; L.door.y = snap10(L.h - 40); }
    roomView = null; roomSel = null; close(); save(); renderRoom(s); toast(`${t.name}: ${plural(n, 'desk')}.`, false); });
}
// A small form in #modal instead of prompt()/confirm(): fields [key, label, default, min?, max?] (number) or [key, label, bool].
function seatAsk(title, fields, ok) {
  const m = $('#modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="panel narrow"><header><h2>${esc(title)}</h2><button id="mClose" aria-label="Close">×</button></header><div class="body one">${fields.map(f => typeof f[2] === 'boolean' ? `<label class="chk"><input type="checkbox" data-f="${f[0]}" ${f[2] ? 'checked' : ''}> ${esc(f[1])}</label>` : `<div class="field"><label>${esc(f[1])}</label><input type="number" data-f="${f[0]}" value="${f[2]}" min="${f[3]}" max="${f[4]}" style="width:110px"></div>`).join('')}<div class="rp-actions"><button class="pill" id="askOk">OK</button><button class="pill pale" id="mCancel">Cancel</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  $('#askOk').onclick = () => { const v = {}; fields.forEach(f => { const el = m.querySelector(`[data-f="${f[0]}"]`); v[f[0]] = typeof f[2] === 'boolean' ? el.checked : Math.max(f[3], Math.min(f[4], parseInt(el.value, 10) || f[2])); }); close(); ok(v); };
  const first = m.querySelector('input[type=number]'); if (first && !coarse()) { first.focus(); first.select(); }
  m.querySelectorAll('input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#askOk').click(); } });
}
// Yes/no with a named action — for the few destructive things (never confirm()).
function seatConfirm(title, text, verb, ok) {
  const m = $('#modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="panel narrow"><header><h2>${esc(title)}</h2><button id="mClose" aria-label="Close">×</button></header><div class="body one"><p>${text}</p><div class="rp-actions"><button class="pill danger" id="cfOk">${esc(verb)}</button><button class="pill pale" id="mCancel">Cancel</button></div></div></div>`;
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; };
  m._cancel = close; $('#mClose').onclick = close; $('#mCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  $('#cfOk').onclick = () => { close(); ok(); };
}
/* ---- import of the standalone Seating Chart's JSON backup (photos, FAST scores, flags, room, saved charts) ---- */
const looksLikeSeatingBackup = o => o && typeof o === 'object' && Array.isArray(o.periods) && Array.isArray(o.students) && o.layout && typeof o.layout === 'object';
function shrinkPhoto(dataUrl) {   // 48×60 JPEG (~2 KB) so 91 photos fit comfortably beside everything else in localStorage
  return new Promise(res => { const img = new Image(); img.onload = () => { try { const c = document.createElement('canvas'); c.width = 48; c.height = 60; const x = c.getContext('2d'); const k = Math.max(48 / img.width, 60 / img.height); const w = img.width * k, h = img.height * k; x.drawImage(img, (48 - w) / 2, (60 - h) / 2, w, h); res(c.toDataURL('image/jpeg', 0.72)); } catch (e) { res(null); } }; img.onerror = () => res(null); img.src = dataUrl; });
}
function seatingTargetFor(per) {
  // a v8 period → the Tally class: same section code (per-section IXL files), else the pool class of that period number
  const sid = String(per.sectionId || ''); if (sid && state.sections[sid]) return state.sections[sid];
  const mm = String(per.name || '').match(/(\d+)/) || sid.match(/7T(\d)/); const num = mm ? Number(mm[1]) : null;
  if (num != null) { const s = state.order.map(k => state.sections[k]).find(x => x.period === num || (x.key.includes('7T' + num) && !x.pool)); if (s) return s; }
  return null;
}
async function importSeatingBackup(obj) {
  const out = { matched: 0, unmatched: [], classes: 0, room: false, charts: 0 };
  obj.students = obj.students.filter(st => st && typeof st === 'object' && typeof st.raw === 'string'); obj.periods = obj.periods.filter(per => per && typeof per === 'object');
  const byPer = {}; obj.students.forEach(st => { (byPer[st.periodId] = byPer[st.periodId] || []).push(st); });
  const idMap = {};   // v8 student id → [sec.key, display]
  for (const per of obj.periods) {
    const sec = seatingTargetFor(per); if (!sec) { (byPer[per.id] || []).forEach(st => out.unmatched.push(st.raw)); continue; }
    const rows = buildRows(sec).filter(r => r.status !== 'ixlOnly'); const byNorm = new Map(rows.map(r => [norm(r.display), r.display])); let hit = 0;
    for (const st of byPer[per.id] || []) {
      const disp = byNorm.get(norm(st.raw)) || byNorm.get(norm(`${st.last}, ${st.first}`)); if (!disp) { out.unmatched.push(st.raw); continue; }
      const info = seatInfoOf(sec, disp); const inc = cleanSeatInfo(st);
      // FAST scores and photos are what the backup is for — they overwrite. Teacher-entered fields only fill in where Tally has nothing yet.
      info.level = inc.level; info.pct = inc.pct; info.scale = inc.scale;
      if (!info.nick) info.nick = inc.nick; if (info.behavior === 'low') info.behavior = inc.behavior; info.front = info.front || inc.front; info.nearTeacher = info.nearTeacher || inc.nearTeacher; if (!info.plan) info.plan = inc.plan; if (!info.accom) info.accom = inc.accom; if (!info.notes) info.notes = inc.notes;
      if (typeof st.photo === 'string' && /^data:image\//.test(st.photo)) { const ph = await shrinkPhoto(st.photo); if (ph) info.photo = ph; }
      idMap[st.id] = [sec.key, disp]; hit++;
    }
    if (hit) { out.classes++; out.matched += hit; }
  }
  const merge = (a, b) => [...new Set([...(a || []), ...b])];
  for (const st of obj.students) { const me = idMap[st.id]; if (!me) continue; const info = seatInfoOf(state.sections[me[0]], me[1]); const ap = (Array.isArray(st.apart) ? st.apart : []).map(id => idMap[id]).filter(x => x && x[0] === me[0]).map(x => x[1]); const tg = (Array.isArray(st.together) ? st.together : []).map(id => idMap[id]).filter(x => x && x[0] === me[0]).map(x => x[1]); info.apart = merge(info.apart, ap); info.together = merge(info.together, tg).filter(n => !info.apart.includes(n)); }
  const room = roomOK(); const L = obj.layout;
  if (!room.desks.length && Array.isArray(L.desks) && L.desks.length) { state.room = { w: L.w, h: L.h, front: L.front, desks: L.desks.map(d => ({ id: d && d.id, x: d && d.x, y: d && d.y, r: d && d.r })), teacher: L.teacher || null, door: L.door || null }; roomOK(); out.room = true; }
  const deskIds = new Set(state.room.desks.map(d => d.id));
  for (const per of obj.periods) { const c = (obj.charts || {})[per.id]; const sec = seatingTargetFor(per); if (!c || !c.seats || !sec || sec.seating) continue; const seats = {}; for (const [d0, sid] of Object.entries(c.seats)) { const d = cleanId(d0); const me = idMap[sid]; if (me && me[0] === sec.key && deskIds.has(d)) seats[d] = me[1]; } if (Object.keys(seats).length) { sec.seating = { seats, locks: {}, savedAt: c.savedAt || new Date().toISOString() }; out.charts++; } }
  if (obj.weights && typeof obj.weights === 'object') { state.seatWeights = state.seatWeights || {}; SEAT_FACTORS.forEach(f => { if (obj.weights[f.k] != null) state.seatWeights[f.k] = numOr(obj.weights[f.k], f.def, 0, 10); }); }
  seatBase = { key: '', v: 0 }; return out;
}

document.head.appendChild(Object.assign(document.createElement('style'), { textContent: SEAT_SVG_CSS }));
