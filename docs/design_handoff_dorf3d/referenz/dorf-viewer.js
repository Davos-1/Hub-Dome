// Nachbau des Hub-Dome 3D-Viewers (vereinfachte Modelle) mit umschaltbaren Varianten.
// Attribute: paths=ist|bogen|gerade · garden=none|hecke|zaun|kante · flowers=on|off · labels=ist|karte|kompakt|schild · count=5|7|10
let T, OrbitControls;
const libs = Promise.all([
  import('https://esm.sh/three@0.160.0'),
  import('https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js'),
]).then(([a, b]) => { T = a; OrbitControls = b.OrbitControls; });

const KIND = { rechner: '#f59e0b', quiz: '#ec4899', zusammenfassung: '#3b82f6', cheatsheet: '#10b981', tool: '#8b5cf6', visualisierung: '#06b6d4', sonstiges: '#9ca3af' };
const [R, Q, Z, C, TO, V] = ['rechner', 'quiz', 'zusammenfassung', 'cheatsheet', 'tool', 'visualisierung'];
const it = (kind, title, neu) => ({ kind, title, neu: !!neu });
const KIND_ORDER0 = ['rechner', 'quiz', 'zusammenfassung', 'cheatsheet', 'tool', 'visualisierung'];
const KIND_LABEL0 = { rechner: 'Rechner', quiz: 'Quiz', zusammenfassung: 'Zusammenfassung', cheatsheet: 'Cheatsheet', tool: 'Tool', visualisierung: 'Visualisierung' };
function T0Color(h) { const hue = h % 360, s = 38, l = 84; const k = (n) => (n + hue / 30) % 12, a = (s / 100) * Math.min(l / 100, 1 - l / 100), f = (n) => l / 100 - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); }
const MODULES = [
  { id: '6f1c2a90-bst', code: 'BST', title: 'Baustatik', color: '#f2e3c4', items: [it(R, 'Auflagerkräfte'), it(R, 'Biegemoment Einfeldträger'), it(Q, 'Statik Grundlagen'), it(Z, 'Zusammenfassung Kap. 1–4'), it(C, 'Formelblatt Statik'), it(TO, 'Querschnittswerte'), it(Q, 'Fachwerke', 1), it(V, 'Momentenlinie interaktiv', 1)] },
  { id: '0b7e44d1-hlz', code: 'HLZ', title: 'Holzbau', color: '#e9d2b4', items: [it(Z, 'Holzarten & Kennwerte'), it(C, 'Verbindungsmittel'), it(Q, 'Brandschutz Holz'), it(R, 'Balkenbemessung', 1)] },
  { id: 'c39d5e12-mat', code: 'MAT', title: 'Mathematik 2', color: '#dce5ee', items: [it(R, 'Matrizenrechner'), it(Q, 'Integrale'), it(Q, 'Ableitungen'), it(Z, 'Lineare Algebra'), it(C, 'Formelsammlung'), it(V, 'Funktionsplotter')] },
  { id: '9a0f7b33-vwl', code: 'VWL', title: 'Volkswirtschaft', color: '#efd9d1', items: [it(Z, 'Angebot & Nachfrage'), it(Q, 'Marktformen')] },
  { id: '5d2e8c74-geo', code: 'GEO', title: 'Geotechnik', color: '#e1e8d4', items: [] },
  { id: 'e8b1a065-bph', code: 'BPH', title: 'Bauphysik', color: '#f0e5cc', items: [it(R, 'U-Wert-Rechner'), it(Z, 'Wärmeschutz'), it(C, 'Feuchte & Tauwasser', 1)] },
  { id: '27c6f9a8-prj', code: 'PRJ', title: 'Projektarbeit', color: '#e4ddee', items: [it(TO, 'Projektplan', 1)] },
  { id: 'a4d3b2c1-stb', code: 'STB', title: 'Stahlbau', color: '#e3e3dc', items: [it(R, 'Knicknachweis'), it(R, 'Schraubenverbindung'), it(Z, 'Stahlsorten'), it(C, 'Profiltabellen'), it(Q, 'Stabilität')] },
  { id: '13f08e7d-eng', code: 'ENG', title: 'Englisch', color: '#f3dfcb', items: [it(Q, 'Vocabulary Unit 5'), it(Z, 'Grammar Overview')] },
  { id: 'bb92c4e0-bwl', code: 'BWL', title: 'Betriebswirtschaft', color: '#d9e7df', items: [it(Z, 'Kostenrechnung'), it(C, 'Bilanz-Kennzahlen'), it(Q, 'Marketing-Mix'), it(R, 'Break-even')] },
];

const TF = { 1: 1.1, 2: 1.5, 3: 1.9 };
const ZFP = 2.3, PATH_W = 1.5, GATE = 0.95;
const tierOf = (n) => (n >= 7 ? 3 : n >= 3 ? 2 : 1);
const r3 = (n) => Math.round(n * 1000) / 1000;
const STONE = '#b8b2a7', WHITE = '#f6f3ec', WOOD = '#7a4a2b', BRICK = '#a35a45', WARM = '#ffe2a0';
const ROOFS = ['#b4533a', '#5f7a94', '#8a6a45', '#6f8f60', '#9c5a70'];
const FONT = '"IBM Plex Sans", system-ui, sans-serif';

function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function roofFor(id) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return ROOFS[h % ROOFS.length]; }
function seeded(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const darken = (hex, f) => { const c = new T.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); };

// ---------- Geometrie-Helfer ----------
// Grundkörper werden nach Parametern zwischengespeichert (Tausende Bauteile, wenige verschiedene Masse)
const GEO_CACHE = new Map(), memo = (key, make) => { let g = GEO_CACHE.get(key); if (!g) { g = make(); g.userData.shared = true; GEO_CACHE.set(key, g); } return g; };
const box = (w, h, d) => memo(`b${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`, () => new T.BoxGeometry(w, h, d));
const cyl = (a, b, h, s = 12) => memo(`c${a.toFixed(3)}|${b.toFixed(3)}|${h.toFixed(3)}|${s}`, () => new T.CylinderGeometry(a, b, h, s));
const sph = (r, s = 10) => memo(`s${r.toFixed(3)}|${s}`, () => new T.SphereGeometry(r, s, Math.max(6, s - 4)));
function gable(w, h, d) {
  const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g;
}
function arch(r, d) { const g = new T.CylinderGeometry(r, r, d, 16, 1, false, Math.PI / 2, Math.PI); g.rotateX(Math.PI / 2); return g; }
const P = (geo, color, pos, rot, scale) => ({ geo, color, pos, rot, scale });
function merge(parts) {
  const pos = [], nor = [], col = [];
  const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), s = new T.Vector3(), nm = new T.Matrix3(), tv = new T.Vector3();
  for (const p of parts) {
    const g = p.geo.index ? p.geo.userData.ni || (p.geo.userData.ni = p.geo.toNonIndexed()) : p.geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    e.set(...(p.rot || [0, 0, 0])); q.setFromEuler(e); v.set(...(p.pos || [0, 0, 0])); s.set(...(p.scale || [1, 1, 1]));
    m.compose(v, q, s); nm.getNormalMatrix(m);
    const PA = g.attributes.position, NA = g.attributes.normal, c = new T.Color(p.color || '#ffffff'), CA = p.vc ? g.attributes.color : null;
    for (let i = 0; i < PA.count; i++) {
      tv.fromBufferAttribute(PA, i).applyMatrix4(m); pos.push(tv.x, tv.y, tv.z);
      tv.fromBufferAttribute(NA, i).applyMatrix3(nm).normalize(); nor.push(tv.x, tv.y, tv.z);
      if (CA) col.push(CA.getX(i), CA.getY(i), CA.getZ(i)); else col.push(c.r, c.g, c.b);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// ---------- Layout (Port von src/lib/layout.ts) ----------
function istSlots(count, fp) {
  const out = []; let row = 0;
  while (out.length < count) {
    const cap = 5 + row * 2, inRow = Math.min(cap, count - out.length), rad = fp + 1.3 + row * 1.3, spread = Math.PI * 0.8;
    for (let i = 0; i < inRow; i++) { const t = inRow === 1 ? 0 : i / (inRow - 1) - 0.5; out.push({ x: Math.sin(t * spread) * rad, z: Math.cos(t * spread) * rad }); }
    row++;
  }
  return out;
}
// Neu: Objekte nach Kategorie sortiert, links und rechts des Gartenwegs in Reihen (Mitte bleibt frei).
function plotFor(fp, tier, items) {
  const n = items.length, cols = n <= 2 ? 1 : n <= 4 ? 2 : 3, left = Math.ceil(n / 2), rows = Math.ceil(left / cols) || 0;
  const order = Object.keys(KIND), sorted = items.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const slots = sorted.map((item, i) => {
    const side = i < left ? -1 : 1, j = i < left ? i : i - left, row = Math.floor(j / cols), c = j % cols;
    return { item, side, row, c, x: side * (1.25 + c * 1.2), z: fp * 1.05 + 1.05 + row * 1.2 };
  });
  const houseHalf = tier === 3 ? fp * 2.15 : fp * 1.05;
  const hw = Math.max(houseHalf + 0.9, n ? 1.25 + (cols - 1) * 1.2 + 0.85 : 0, 2.3);
  const front = Math.max(fp * 1.05 + 1.8, n ? fp * 1.05 + 1.05 + (rows - 1) * 1.2 + 0.95 : 0);
  return { hw, front, back: fp * 1.05 + 1.1, slots };
}

function computeLayout(mods, gardens, tf = TF, plazaMin = ZFP + 3.9) {
  const n = mods.length;
  const plaza = Math.max(plazaMin, r3((n * 1.95) / (2 * Math.PI)));
  const two = n > 7, inner = two ? Math.ceil(n / 2) : n, outerN = n - inner;
  const info = mods.map((m) => { const tier = tierOf(m.items.length), fp = tf[tier]; return { m, tier, fp, plot: plotFor(fp, tier, m.items) }; });
  let ri, ro;
  if (!gardens) {
    ri = two ? Math.max(12, plaza + 8, 5.6 / Math.sin(Math.PI / inner)) : 12; ro = ri + 13;
  } else {
    const inI = info.filter((_, i) => !two || i % 2 === 0), outI = info.filter((_, i) => two && i % 2 === 1);
    const mx = (a, k) => Math.max(0, ...a.map((x) => x.plot[k]));
    const hwI = mx(inI, 'hw'), fI = mx(inI, 'front'), bI = mx(inI, 'back');
    for (ri = 12; ri < 90; ri += 0.25) {
      const rf = ri - fI; if (rf < plaza + 3.5) continue;
      const corr = two ? (PATH_W + 1.8) / rf : 1.0 / rf;
      if (inner < 2 || 2 * Math.atan2(hwI, rf) + corr < (2 * Math.PI) / inner) break;
    }
    if (two) {
      const hwO = mx(outI, 'hw'), fO = mx(outI, 'front');
      for (ro = ri + bI + fO + 3.5; ro < 140; ro += 0.25) { const rf = ro - fO; if (outerN < 2 || 2 * Math.atan2(hwO, rf) + 1.0 / rf < (2 * Math.PI) / outerN) break; }
    }
  }
  const houses = [{ id: 'zentrale', x: 0, z: 0, angle: 0, ring: 0, tier: 3, footprint: ZFP }];
  const place = (inf, ring, rad, th) => {
    const x = r3(rad * Math.cos(th)), z = r3(rad * Math.sin(th));
    houses.push({ id: inf.m.id, m: inf.m, x, z, angle: Math.atan2(-x, -z), ring, tier: inf.tier, footprint: inf.fp, plot: inf.plot });
  };
  const st = Math.PI / 2;
  info.forEach((inf, i) => {
    if (!two) place(inf, 1, ri, st + (2 * Math.PI * i) / n);
    else if (i % 2 === 0) place(inf, 1, ri, st + (2 * Math.PI * (i / 2)) / inner);
    else place(inf, 2, ro, st + Math.PI / inner + (2 * Math.PI * ((i - 1) / 2)) / inner);
  });
  const outer = n === 0 ? 0 : two ? ro : ri;
  const backMax = gardens ? Math.max(...info.map((x) => x.plot.back)) : 0;
  return { houses, plaza, extent: Math.max(outer + backMax, 8) + 8 };
}

// ---------- Wege ----------
function distSeg(px, pz, a, b) { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz; const t = l2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / l2)) : 0; return Math.hypot(px - (a.x + t * dx), pz - (a.z + t * dz)); }
function distPoly(x, z, pts) { let b = Infinity; for (let i = 0; i < pts.length - 1; i++) b = Math.min(b, distSeg(x, z, pts[i], pts[i + 1])); return b; }
function spread(angles, min) {
  const n = angles.length; if (n < 2) return angles.slice();
  const order = angles.map((a, i) => ({ a, i })).sort((p, q) => p.a - q.a), a = order.map((o) => o.a);
  for (let it = 0; it < 200; it++) {
    let moved = false;
    for (let k = 0; k < n; k++) {
      const nx = (k + 1) % n, na = nx === 0 ? a[0] + Math.PI * 2 : a[nx], gap = na - a[k];
      if (gap < min - 1e-6) { const p = (min - gap) / 2; a[k] -= p; if (nx === 0) a[0] += p; else a[nx] += p; moved = true; }
    }
    if (!moved) break;
  }
  const r = new Array(n); order.forEach((o, k) => (r[o.i] = a[k])); return r;
}
function shapeFn(s, t) {
  if (s === 0) return Math.sin(Math.PI * t);
  if (s === 1) return Math.sin(2 * Math.PI * t);
  if (s === 2) return -Math.sin(Math.PI * t);
  return (0.65 * Math.sin(2 * Math.PI * t) + 0.45 * Math.sin(3 * Math.PI * t + 0.8)) * Math.sin(Math.PI * t) ** 0.3;
}
// Port von computePaths (src/lib/paths.ts) – unverändert bis auf den Endpunkt (reach).
function istPaths(houses, plaza, reachFn) {
  const homes = houses.filter((h) => h.ring > 0), W = PATH_W + 0.35 + 0.05, S = 40;
  const starts = spread(homes.map((h) => Math.atan2(h.z, h.x)), W / plaza);
  const rays = homes.map((h, i) => { const l = Math.hypot(h.x, h.z), reach = reachFn(h); return { s: { x: Math.cos(starts[i]) * plaza, z: Math.sin(starts[i]) * plaza }, d: { x: h.x - (h.x / l) * reach, z: h.z - (h.z / l) * reach } }; });
  const straight = rays.map(({ s, d }) => Array.from({ length: S + 1 }, (_, k) => ({ x: s.x + (d.x - s.x) * (k / S), z: s.z + (d.z - s.z) * (k / S) })));
  return homes.map((h, i) => {
    const k = fnv(h.id), shape = k % 4, surface = (k >>> 3) % 4, sign = (k >>> 6) % 2 === 0 ? 1 : -1, wanted = 2.8 * (0.55 + ((k >>> 9) % 100) / 220);
    const { s, d } = rays[i], dx = d.x - s.x, dz = d.z - s.z, len = Math.hypot(dx, dz), nx = -dz / len, nz = dx / len;
    const allowed = straight[i].map((p) => {
      let b = Infinity;
      for (let j = 0; j < homes.length; j++) if (j !== i) b = Math.min(b, (distPoly(p.x, p.z, straight[j]) - W) / 2);
      for (const o of homes) if (o.id !== h.id) b = Math.min(b, Math.hypot(p.x - o.x, p.z - o.z) - (o.footprint * 1.9 + 0.8 + PATH_W / 2));
      return Math.max(0, b);
    });
    let sc = 1;
    for (let q = 1; q < S; q++) { const w = Math.abs(wanted * shapeFn(shape, q / S)); if (w > 1e-6) sc = Math.min(sc, allowed[q] / w); }
    const amp = wanted * Math.max(0, sc);
    return { kind: 'ist', points: straight[i].map((p, q) => { const l = sign * amp * shapeFn(shape, q / S); return { x: p.x + nx * l, z: p.z + nz * l }; }), surface };
  });
}
// Neu: Hermite-Kurve, die am Platz radial abgeht und senkrecht am Tor/an der Tür ankommt.
function newPaths(houses, plaza, mode, reachFn, startsOverride) {
  const homes = houses.filter((h) => h.ring > 0), W = PATH_W + 0.4;
  const base = homes.map((h) => Math.atan2(h.z, h.x));
  const starts = startsOverride || (mode === 'gerade' ? base : spread(base, W / plaza));
  return homes.map((h, i) => {
    const l = Math.hypot(h.x, h.z), ux = h.x / l, uz = h.z / l, reach = reachFn(h);
    const G = { x: h.x - ux * reach, z: h.z - uz * reach }, a = starts[i], r0 = plaza - 0.35;
    const S = { x: Math.cos(a) * r0, z: Math.sin(a) * r0 }, D = Math.hypot(G.x - S.x, G.z - S.z), N = Math.max(24, Math.round(D * 3));
    const pts = [];
    if (mode === 'gerade') { for (let k = 0; k <= N; k++) pts.push({ x: S.x + (G.x - S.x) * (k / N), z: S.z + (G.z - S.z) * (k / N) }); }
    else {
      const kk = D * 0.5, T0 = { x: Math.cos(a) * kk, z: Math.sin(a) * kk }, T1 = { x: ux * kk, z: uz * kk };
      const hk = fnv(h.id), sign = (hk >>> 6) % 2 ? 1 : -1, amp = (h.ring === 2 ? 0.25 : 0.45 + (((hk >>> 9) % 100) / 100) * 0.45) * sign;
      const nx = -(G.z - S.z) / D, nz = (G.x - S.x) / D;
      for (let k = 0; k <= N; k++) {
        const t = k / N, t2 = t * t, t3 = t2 * t, h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2, bow = amp * Math.sin(Math.PI * t) ** 2;
        pts.push({ x: h00 * S.x + h10 * T0.x + h01 * G.x + h11 * T1.x + nx * bow, z: h00 * S.z + h10 * T0.z + h01 * G.z + h11 * T1.z + nz * bow });
      }
    }
    return { kind: 'neu', points: pts, seed: (fnv(h.id) % 100) / 10 };
  });
}

function normals(pts) { return pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; return { x: -dz / l, z: dx / l }; }); }
function ribbon(pts, widths, y) {
  const ns = normals(pts), pos = [], nor = [];
  const tri = (a, b, c) => { const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) > 0; const [p, q, r] = up ? [a, b, c] : [a, c, b]; pos.push(...p, ...q, ...r); nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0); };
  for (let i = 0; i < pts.length - 1; i++) {
    const w0 = widths[i] / 2, w1 = widths[i + 1] / 2;
    const l0 = [pts[i].x + ns[i].x * w0, y, pts[i].z + ns[i].z * w0], r0 = [pts[i].x - ns[i].x * w0, y, pts[i].z - ns[i].z * w0];
    const l1 = [pts[i + 1].x + ns[i + 1].x * w1, y, pts[i + 1].z + ns[i + 1].z * w1], r1 = [pts[i + 1].x - ns[i + 1].x * w1, y, pts[i + 1].z - ns[i + 1].z * w1];
    tri(l0, r0, l1); tri(r0, r1, l1);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); return g;
}
function along(pts, s) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) { const dx = pts[i + 1].x - pts[i].x, dz = pts[i + 1].z - pts[i].z, l = Math.hypot(dx, dz); if (acc + l >= s) { const t = (s - acc) / l; return { x: pts[i].x + dx * t, z: pts[i].z + dz * t, angle: Math.atan2(dx, dz) }; } acc += l; }
  const a = pts[pts.length - 2], b = pts[pts.length - 1]; return { x: b.x, z: b.z, angle: Math.atan2(b.x - a.x, b.z - a.z) };
}
const plen = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) : 0), 0);
const jit = (i, s) => { const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };
const SURF = [{ main: '#d9cfb0', edge: '#b9ae8e' }, { main: '#bdb6a8', edge: '#99927f' }, { main: '#cfc8bb', edge: '#a39c8e' }, { main: '#86b86b', edge: '#7aab60' }];

function pathParts(paths) {
  const parts = [];
  paths.forEach((path, pi) => {
    const pts = path.points, total = plen(pts);
    if (path.kind === 'neu') {
      // Bogenlänge je Punkt → Einmündung am Platz verbreitert, sonst konstante Breite mit sehr leichter Schwankung
      let acc = 0; const ws = pts.map((p, i) => { if (i) acc += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); const flare = Math.max(0, 1 - acc / 1.6) ** 2; return (path.width || PATH_W) * (1 + 0.7 * flare + 0.025 * Math.sin(acc * 0.6 + path.seed)); });
      parts.push(P(ribbon(pts, ws.map((w) => w + 0.32), 0.012), path.color?.edge || '#aaa188'));
      parts.push(P(ribbon(pts, ws, 0.022), path.color?.main || '#d3cbb5'));
      return;
    }
    const surf = SURF[path.surface], ws = pts.map((_, i) => PATH_W * (0.92 + 0.16 * Math.sin(i * 0.9 + pi)));
    if (path.surface === 3) {
      parts.push(P(ribbon(pts, ws.map((w) => w * 0.7), 0.01), surf.main));
      for (let s = 0.4, k = 0; s < total - 0.3; s += 0.95 + jit(k, pi) * 0.3, k++) {
        const p = along(pts, s), side = (jit(k, pi + 3) - 0.5) * 0.5;
        parts.push(P(cyl(0.34 + jit(k, pi + 1) * 0.12, 0.38, 0.07, 9), jit(k, pi + 2) > 0.5 ? '#c4bdae' : '#b3ad9f', [p.x + Math.cos(p.angle) * side, 0.04, p.z - Math.sin(p.angle) * side], [0, jit(k, pi + 5) * 3, 0], [1, 1, 0.8 + jit(k, pi) * 0.4]));
      }
      return;
    }
    parts.push(P(ribbon(pts, ws.map((w) => w + 0.45), 0.012), surf.edge));
    parts.push(P(ribbon(pts, ws, 0.02), surf.main));
    if (path.surface === 2) for (let s = 0.7; s < total - 0.4; s += 0.85) { const p = along(pts, s); parts.push(P(box(PATH_W * 0.95, 0.012, 0.045), surf.edge, [p.x, 0.028, p.z], [0, p.angle, 0])); }
    if (path.surface === 1) for (let s = 0.5, k = 0; s < total - 0.4; s += 0.55, k++) { const p = along(pts, s), side = (k % 2 ? -1 : 1) * (PATH_W * 0.5 + 0.05) * (0.8 + jit(k, pi) * 0.3); parts.push(P(cyl(0.07, 0.09, 0.05, 6), '#8f897c', [p.x + Math.cos(p.angle) * side, 0.035, p.z - Math.sin(p.angle) * side])); }
  });
  return parts;
}

// ---------- Gebäude ----------
function frontWindow(B, G, x, y, z, w, h, shutter, flowers) {
  B.push(P(box(w + 0.14, h + 0.14, 0.1), WHITE, [x, y, z]));
  G.push(P(box(w, h, 0.12), WARM, [x, y, z]));
  B.push(P(box(0.035, h, 0.14), WHITE, [x, y, z]));
  B.push(P(box(w, 0.035, 0.14), WHITE, [x, y, z]));
  for (const s of [-1, 1]) B.push(P(box(w * 0.38, h + 0.16, 0.06), shutter, [x + s * (w / 2 + w * 0.3), y, z - 0.01]));
  B.push(P(box(w + 0.1, 0.12, 0.16), WOOD, [x, y - h / 2 - 0.12, z + 0.1]));
  if (flowers) { const fl = ['#ec4899', '#f59e0b', '#ef4444']; for (let i = 0; i < 4; i++) B.push(P(sph(0.05, 8), fl[i % 3], [x - w / 2 + 0.06 + (i * (w - 0.12)) / 3, y - h / 2 - 0.03, z + 0.1])); }
}
function hausModel(fp, tier, wall, roof, flowers, accent, chimney) {
  const B = [], G = [], w = fp * 2, d = fp * 2.1, h = fp * 1.5, base = 0.18, sh = accent || darken(roof, 0.9);
  B.push(P(box(w + 0.14, base, d + 0.14), STONE, [0, base / 2, 0]));
  B.push(P(box(w, h, d), wall, [0, base + h / 2, 0]));
  B.push(P(gable(w + 0.6, fp * 0.95, d + 0.6), roof, [0, base + h, 0]));
  B.push(P(box(0.12, 0.1, d + 0.62), darken(roof, 0.75), [0, base + h + fp * 0.95, 0]));
  const dw = fp * 0.55, dh = fp * 0.75;
  B.push(P(box(dw, dh, 0.1), accent ? darken(accent, 0.85) : WOOD, [0, base + dh / 2, d / 2 + 0.01]));
  B.push(P(arch(dw / 2, 0.1), accent ? darken(accent, 0.85) : WOOD, [0, base + dh, d / 2 + 0.01]));
  B.push(P(box(dw + 0.5, 0.1, 0.4), STONE, [0, base + 0.01, d / 2 + 0.22]));
  frontWindow(B, G, -fp * 0.66, base + h * 0.62, d / 2 + 0.03, fp * 0.36, fp * 0.42, sh, flowers);
  frontWindow(B, G, fp * 0.66, base + h * 0.62, d / 2 + 0.03, fp * 0.36, fp * 0.42, sh, flowers);
  for (const s of [-1, 1]) { B.push(P(box(0.1, fp * 0.56, fp * 0.5), WHITE, [s * (w / 2 + 0.01), base + h * 0.6, 0])); G.push(P(box(0.12, fp * 0.42, fp * 0.36), WARM, [s * (w / 2 + 0.01), base + h * 0.6, 0])); }
  if (chimney ?? tier >= 2) {
    const cx = fp * 0.55, cz = -d * 0.18, cy = base + h + fp * 0.45;
    B.push(P(box(fp * 0.3, fp * 0.9, fp * 0.3), BRICK, [cx, cy, cz]));
    B.push(P(box(fp * 0.4, 0.08, fp * 0.4), darken(BRICK, 0.8), [cx, cy + fp * 0.47, cz]));
  }
  if (tier >= 2) {
    B.push(P(box(dw + 0.9, 0.07, 0.6), darken(roof, 1.1), [0, base + dh + 0.35, d / 2 + 0.3], [0.15, 0, 0]));
    for (const s of [-1, 1]) B.push(P(cyl(0.04, 0.04, dh + 0.3, 8), WHITE, [s * (dw / 2 + 0.35), base + (dh + 0.3) / 2, d / 2 + 0.5]));
  }
  if (tier >= 3) {
    const aw = fp * 1.1, ah = h * 0.72, ad = d * 0.85, ax = w / 2 + aw / 2 - 0.05;
    B.push(P(box(aw, ah, ad), wall, [ax, base + ah / 2, -d * 0.05]));
    B.push(P(gable(ad + 0.5, fp * 0.7, aw + 0.5), roof, [ax, base + ah, -d * 0.05], [0, Math.PI / 2, 0]));
    B.push(P(box(aw + 0.1, base, ad + 0.1), STONE, [ax, base / 2, -d * 0.05]));
    G.push(P(box(fp * 0.42, fp * 0.42, 0.12), WARM, [ax, base + ah * 0.55, -d * 0.05 + ad / 2]));
    B.push(P(cyl(0.03, 0.03, fp * 1.1, 6), '#4b5563', [0, base + h + fp * 1.45, d * 0.3]));
    B.push(P(box(0.55, 0.3, 0.03), '#ef4444', [0.3, base + h + fp * 1.85, d * 0.3]));
  }
  return { B, G, top: base + h + fp * 0.95 + (tier >= 2 ? fp * 0.4 : 0) };
}
// ---------- Haustypen pro Fachbereich ----------
const cylZ = (a, b, h, sg = 12) => memo(`cz${a.toFixed(3)}|${b.toFixed(3)}|${h.toFixed(3)}|${sg}`, () => new T.CylinderGeometry(a, b, h, sg).rotateX(Math.PI / 2));
const FACH_STYLE = {
  'Tragwerk & Bau': { type: 'werkstatt', wall: '#e9dccb', roof: '#9c4a32', accent: '#b5523b' },
  'Geotechnik & Umwelt': { type: 'block', wall: '#9a6a42', roof: '#5f7a4a', accent: '#4f7d3f' },
  'Gebäude & Energie': { type: 'solar', wall: '#eef0ec', roof: '#4b5d6e', accent: '#2f7d8c' },
  'Projekt & Prozess': { type: 'atelier', wall: '#e8d6a6', roof: '#6f6355', accent: '#c08a2b' },
  'Wirtschaft & Recht': { type: 'stadt', wall: '#efe7dc', roof: '#5b4d63', accent: '#7a3b4a' },
  'Grundlagen': { type: 'haus', wall: '#e4e9ef', roof: '#5f6f86', accent: '#3f5f8a' },
  'Sprache & Kommunikation': { type: 'turm', wall: '#efe6d8', roof: '#3f7a74', accent: '#2f8a7d' },
};
const frontDoor = (B, x, z, w, h, col) => { B.push(P(box(w, h, 0.1), col, [x, 0.18 + h / 2, z])); B.push(P(box(w + 0.5, 0.1, 0.4), STONE, [x, 0.19, z + 0.2])); };
const slab = (B, w, d) => B.push(P(box(w + 0.14, 0.18, d + 0.14), STONE, [0, 0.09, 0]));
function werkstattModel(fp, tier, wall, roof, accent) {
  const B = [], G = [], w = fp * 2.3, d = fp * 2.0, h = fp * 1.15, b = 0.18; slab(B, w, d);
  B.push(P(box(w, h, d), wall, [0, b + h / 2, 0]));
  B.push(P(gable(d + 0.4, fp * 0.45, w + 0.4), roof, [0, b + h, 0], [0, Math.PI / 2, 0]));
  const dw = fp * 1.2, dh = h * 0.78; B.push(P(box(dw, dh, 0.08), '#8c8f94', [0, b + dh / 2, d / 2 + 0.02]));
  for (let i = 1; i < 6; i++) B.push(P(box(dw, 0.025, 0.1), '#6b6e73', [0, b + (dh * i) / 6, d / 2 + 0.03]));
  B.push(P(box(dw + 0.2, 0.12, 0.14), accent, [0, b + dh + 0.06, d / 2 + 0.03]));
  for (const sx of [-1, 1]) G.push(P(box(fp * 0.3, fp * 0.3, 0.1), WARM, [sx * (dw / 2 + fp * 0.35), b + h * 0.6, d / 2 + 0.02]));
  G.push(P(box(w * 0.7, 0.06, 0.3), WARM, [0, b + h + fp * 0.3, 0.15], [-0.4, 0, 0]));
  if (tier >= 2) { for (const sz of [-1, 1]) B.push(P(box(0.12, h + 0.9, 0.12), accent, [w / 2 + 0.5, (h + 0.9) / 2 + b, sz * d * 0.35])); B.push(P(box(0.12, 0.14, d * 0.7 + 0.12), accent, [w / 2 + 0.5, b + h + 0.9, 0])); }
  if (tier >= 3) { B.push(P(cyl(fp * 0.45, fp * 0.45, h * 1.8, 16), '#c9ccd0', [-w / 2 - fp * 0.4, b + h * 0.9, -d * 0.2])); B.push(P(new T.ConeGeometry(fp * 0.47, fp * 0.35, 16), '#9aa0a6', [-w / 2 - fp * 0.4, b + h * 1.8 + fp * 0.17, -d * 0.2])); }
  return { B, G, top: b + h + fp * 0.45 + (tier >= 2 ? 0.5 : 0) };
}
function blockModel(fp, tier, wall, roof, accent) {
  const B = [], G = [], w = fp * 2, d = fp * 2.0, h = fp * 1.2, b = 0.18, n = 7, lr = h / n / 2; slab(B, w, d);
  B.push(P(box(w - lr * 2, h, d - lr * 2), darken(wall, 0.85), [0, b + h / 2, 0]));
  for (let i = 0; i < n; i++) { const y = b + lr + i * lr * 2, c = i % 2 ? wall : darken(wall, 0.92); B.push(P(cylZ(lr, lr, d + 0.3, 8), c, [-w / 2 + lr, y, 0]), P(cylZ(lr, lr, d + 0.3, 8), c, [w / 2 - lr, y, 0])); const gx = cylZ(lr, lr, w + 0.3, 8); B.push(P(gx, c, [0, y + lr, d / 2 - lr], [0, Math.PI / 2, 0]), P(gx, c, [0, y + lr, -d / 2 + lr], [0, Math.PI / 2, 0])); }
  B.push(P(gable(w + 0.7, fp * 1.05, d + 0.6), roof, [0, b + h, 0]));
  frontDoor(B, 0, d / 2 + 0.03, fp * 0.55, fp * 0.8, darken(wall, 0.6));
  for (const sx of [-1, 1]) { G.push(P(box(fp * 0.34, fp * 0.34, 0.1), WARM, [sx * fp * 0.62, b + h * 0.6, d / 2 + 0.05])); B.push(P(box(fp * 0.42, 0.06, 0.12), accent, [sx * fp * 0.62, b + h * 0.6 - fp * 0.2, d / 2 + 0.08])); }
  B.push(P(box(fp * 0.4, fp * 1.6, fp * 0.4), '#9b958a', [w / 2 - fp * 0.1, b + fp * 0.8 + h * 0.35, -d * 0.2]));
  if (tier >= 2) { B.push(P(box(w + 0.6, 0.08, 1.0), WOOD, [0, b + 0.02, d / 2 + 0.55])); for (const sx of [-1, 1]) B.push(P(cyl(0.06, 0.06, h * 0.9, 6), WOOD, [sx * (w / 2 + 0.2), b + h * 0.45, d / 2 + 0.95])); B.push(P(box(w + 0.7, 0.07, 1.1), roof, [0, b + h * 0.92, d / 2 + 0.55], [0.2, 0, 0])); }
  if (tier >= 3) for (let i = 0; i < 6; i++) B.push(P(cylZ(0.12, 0.12, 0.9, 8), '#a0703f', [-w / 2 - 0.35, 0.12 + (i % 3) * 0.23 + Math.floor(i / 3) * 0.02, -d * 0.1 + Math.floor(i / 3) * 0.25]));
  return { B, G, top: b + h + fp * 1.05 + 0.2 };
}
function solarModel(fp, tier, wall, roof, accent) {
  const B = [], G = [], w = fp * 2.1, d = fp * 2.0, h = fp * 1.3, b = 0.18; slab(B, w, d);
  B.push(P(box(w, h, d), wall, [0, b + h / 2, 0]));
  B.push(P(box(w + 0.1, 0.18, d + 0.1), roof, [0, b + h + 0.09, 0]));
  G.push(P(box(w * 0.8, h * 0.32, 0.08), '#cfe8f0', [0, b + h * 0.62, d / 2 + 0.02]));
  B.push(P(box(w * 0.8 + 0.12, 0.08, 0.14), accent, [0, b + h * 0.44, d / 2 + 0.04]));
  frontDoor(B, w * 0.3, d / 2 + 0.03, fp * 0.5, fp * 0.75, accent);
  const rows = tier >= 2 ? 2 : 1;
  for (let r = 0; r < rows; r++) for (let i = 0; i < 3; i++) { const x = -w * 0.3 + i * w * 0.3, z = -d * 0.2 + r * d * 0.38; B.push(P(box(w * 0.26, 0.04, d * 0.3), '#2b3f5c', [x, b + h + 0.35, z], [-0.45, 0, 0])); B.push(P(box(0.04, 0.3, 0.04), '#8b9198', [x, b + h + 0.2, z - d * 0.1])); }
  if (tier >= 3) { B.push(P(box(w * 0.6, h * 0.7, d * 0.6), wall, [-w * 0.15, b + h + 0.18 + h * 0.35, -d * 0.15])); B.push(P(box(w * 0.62, 0.12, d * 0.62), roof, [-w * 0.15, b + h * 1.7 + 0.24, -d * 0.15])); G.push(P(box(w * 0.4, h * 0.25, 0.08), '#cfe8f0', [-w * 0.15, b + h * 1.45, -d * 0.15 + d * 0.3 + 0.02])); }
  return { B, G, top: b + h + (tier >= 3 ? h * 0.8 + 0.3 : 0.5) };
}
function stadtModel(fp, tier, wall, roof, accent) {
  const B = [], G = [], w = fp * 1.9, d = fp * 1.9, h = fp * (tier >= 2 ? 2.3 : 1.8), b = 0.18; slab(B, w, d);
  B.push(P(box(w, h, d), wall, [0, b + h / 2, 0]));
  B.push(P(box(w + 0.16, 0.12, d + 0.16), darken(wall, 0.85), [0, b + h, 0]));
  const hip = new T.ConeGeometry((w + 0.3) * 0.72, fp * 0.9, 4); B.push(P(hip, roof, [0, b + h + fp * 0.45 + 0.06, 0], [0, Math.PI / 4, 0]));
  const floors = tier >= 2 ? 2 : 1;
  for (let f = 0; f < floors + 1; f++) for (const sx of [-1, 0, 1]) { if (f === 0 && sx === 0) continue; const y = b + h * (0.2 + f * (0.7 / (floors + 0.3))); G.push(P(box(fp * 0.3, fp * 0.42, 0.1), WARM, [sx * fp * 0.6, y + fp * 0.2, d / 2 + 0.02])); B.push(P(box(fp * 0.38, 0.06, 0.14), WHITE, [sx * fp * 0.6, y - 0.02, d / 2 + 0.04])); }
  frontDoor(B, 0, d / 2 + 0.03, fp * 0.5, fp * 0.85, accent);
  for (const sx of [-1, 1]) B.push(P(cyl(0.07, 0.08, fp * 1.0, 10), WHITE, [sx * fp * 0.42, b + fp * 0.5, d / 2 + 0.35]));
  B.push(P(box(fp * 1.1, 0.1, 0.55), WHITE, [0, b + fp * 1.02, d / 2 + 0.3]));
  if (tier >= 3) { B.push(P(cyl(0.03, 0.03, 1.2, 6), '#4b5563', [w * 0.3, b + h + 0.6, d * 0.3])); B.push(P(box(0.6, 0.35, 0.03), accent, [w * 0.3 + 0.32, b + h + 1.0, d * 0.3])); }
  return { B, G, top: b + h + fp * 0.9 };
}
function atelierModel(fp, tier, wall, roof, accent) {
  const B = [], G = [], w = fp * 2.2, d = fp * 1.9, hf = fp * 1.7, hb = fp * 0.9, b = 0.18; slab(B, w, d);
  const sh = new T.Shape(); sh.moveTo(-d / 2, 0); sh.lineTo(d / 2, 0); sh.lineTo(d / 2, hf); sh.lineTo(-d / 2, hb); sh.closePath();
  const body = new T.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false }); body.translate(0, 0, -w / 2);
  B.push(P(body, wall, [0, b, 0], [0, -Math.PI / 2, 0]));
  const roofG = new T.BoxGeometry(w + 0.4, 0.1, Math.hypot(d, hf - hb) + 0.5); B.push(P(roofG, roof, [0, b + (hf + hb) / 2 + 0.06, 0], [-Math.atan2(hf - hb, d), 0, 0]));
  for (let i = 0; i < 9; i++) B.push(P(box(0.04, hb * 0.95, 0.04), darken(wall, 0.85), [-w / 2 + 0.1 + (i * (w - 0.2)) / 8, b + hb / 2, -d / 2 - 0.02]));
  G.push(P(box(w * 0.72, hf * 0.62, 0.08), '#d6ecf2', [-w * 0.1, b + hf * 0.45, d / 2 + 0.02]));
  for (let i = 0; i < 4; i++) B.push(P(box(0.05, hf * 0.62, 0.1), accent, [-w * 0.46 + (i * w * 0.72) / 3, b + hf * 0.45, d / 2 + 0.04]));
  frontDoor(B, w * 0.38, d / 2 + 0.03, fp * 0.45, fp * 0.8, accent);
  if (tier >= 2) { B.push(P(box(w * 0.5, 0.08, 1.2), WOOD, [-w * 0.1, b + 0.02, d / 2 + 0.6])); B.push(P(box(w * 0.55, 0.06, 1.0), accent, [-w * 0.1, b + hf * 0.95, d / 2 + 0.5], [0.15, 0, 0])); }
  if (tier >= 3) { B.push(P(box(fp * 0.9, hf * 0.9, fp * 1.0), wall, [w / 2 + fp * 0.45, b + hf * 0.45, -d * 0.15])); B.push(P(box(fp * 1.0, 0.1, fp * 1.1), roof, [w / 2 + fp * 0.45, b + hf * 0.9 + 0.05, -d * 0.15])); }
  return { B, G, top: b + hf + 0.4 };
}
function turmModel(fp, tier, wall, roof, accent) {
  const B = [], G = [], w = fp * 1.8, d = fp * 1.9, h = fp * 1.5, b = 0.18; slab(B, w + fp * 0.9, d);
  B.push(P(box(w, h, d), wall, [-fp * 0.3, b + h / 2, 0]));
  B.push(P(gable(w + 0.5, fp * 0.95, d + 0.5), roof, [-fp * 0.3, b + h, 0]));
  const tr = fp * 0.55, th = h * (tier >= 2 ? 2.0 : 1.6), tx = w / 2 + tr * 0.4 - fp * 0.3;
  B.push(P(cyl(tr, tr, th, 18), darken(wall, 0.95), [tx, b + th / 2, d * 0.15]));
  B.push(P(new T.ConeGeometry(tr * 1.25, fp * 1.1, 18), roof, [tx, b + th + fp * 0.55, d * 0.15]));
  for (let i = 0; i < 3; i++) G.push(P(box(0.18, fp * 0.32, 0.1), WARM, [tx, b + th * (0.3 + i * 0.25), d * 0.15 + tr]));
  frontDoor(B, -fp * 0.3, d / 2 + 0.03, fp * 0.55, fp * 0.8, accent);
  for (const sx of [-1, 1]) G.push(P(box(fp * 0.32, fp * 0.38, 0.1), WARM, [-fp * 0.3 + sx * fp * 0.55, b + h * 0.62, d / 2 + 0.02]));
  B.push(P(box(w * 0.9, 0.1, 0.12), accent, [-fp * 0.3, b + h * 0.36, d / 2 + 0.04]));
  if (tier >= 3) { B.push(P(cyl(0.025, 0.025, 0.9, 6), '#4b5563', [tx, b + th + fp * 1.1 + 0.4, d * 0.15])); B.push(P(box(0.45, 0.28, 0.02), accent, [tx + 0.24, b + th + fp * 1.1 + 0.72, d * 0.15])); }
  return { B, G, top: b + th + fp * 1.1 };
}
const TYPE_MODELS = { werkstatt: werkstattModel, block: blockModel, solar: solarModel, stadt: stadtModel, atelier: atelierModel, turm: turmModel };
function baustelle(fp) {
  const B = [], G = [], w = fp * 2, d = fp * 2.1;
  B.push(P(box(w + 0.3, 0.2, d + 0.3), '#c7c1b6', [0, 0.1, 0]));
  B.push(P(box(w, fp * 0.8, 0.2), '#d6c4a6', [0, 0.2 + fp * 0.4, -d / 2]));
  for (const s of [-1, 1]) B.push(P(box(0.2, fp * 0.5, d), '#d6c4a6', [s * w / 2, 0.2 + fp * 0.25, 0]));
  const hh = fp * 2;
  for (const x of [-1, 1]) for (const z of [-1, 0, 1]) B.push(P(cyl(0.04, 0.04, hh, 6), '#9ca3af', [x * (w / 2 + 0.35), hh / 2, z * (d / 2 + 0.1)]));
  for (const y of [fp * 0.9, fp * 1.6]) for (const x of [-1, 1]) B.push(P(box(0.4, 0.06, d + 0.4), WOOD, [x * (w / 2 + 0.35), y, 0]));
  for (const s of [-1, 1]) B.push(P(box(0.08, 0.6, 0.08), '#f8fafc', [s * 0.9, 0.3, d / 2 + 0.9]));
  B.push(P(box(1.9, 0.14, 0.05), '#f97316', [0, 0.5, d / 2 + 0.9]));
  for (let i = 0; i < 4; i++) B.push(P(box(1.4, 0.08, 0.22), '#a0703f', [w / 2 - 0.4, 0.06 + i * 0.09, d / 2 + 0.5], [0, 0.3, 0]));
  return { B, G, top: hh };
}
function rathaus(flowers) {
  const fp = ZFP, B = [], G = [], w = fp * 2.6, d = fp * 1.7, h = fp * 1.05, base = 0.25;
  B.push(P(box(w + 0.4, base, d + 0.4), STONE, [0, base / 2, 0]));
  B.push(P(box(w, h, d), '#efe6d4', [0, base + h / 2, 0]));
  B.push(P(gable(d + 0.5, fp * 0.6, w + 0.5), '#8a5a44', [0, base + h, 0], [0, Math.PI / 2, 0]));
  for (let i = 0; i < 4; i++) B.push(P(cyl(0.16, 0.18, h * 0.8, 12), WHITE, [-1.5 + i, base + h * 0.4, d / 2 + 0.7]));
  B.push(P(box(3.8, 0.2, 1.1), WHITE, [0, base + h * 0.8 + 0.1, d / 2 + 0.55]));
  B.push(P(gable(3.9, 0.7, 1.1), WHITE, [0, base + h * 0.8 + 0.2, d / 2 + 0.55]));
  B.push(P(box(4.4, 0.12, 1.6), STONE, [0, 0.06, d / 2 + 0.8]));
  B.push(P(box(0.8, 1.3, 0.1), WOOD, [0, base + 0.65, d / 2 + 0.02]));
  for (const x of [-2.4, -1.6, 1.6, 2.4]) G.push(P(box(0.4, 0.6, 0.1), WARM, [x, base + h * 0.55, d / 2 + 0.02]));
  const ty = base + h + fp * 0.8;
  B.push(P(box(1.5, fp * 1.6, 1.5), '#e6dcc6', [0, ty, -d * 0.1]));
  B.push(P(cyl(0.42, 0.42, 0.08, 20), WHITE, [0, ty + fp * 0.4, -d * 0.1 + 0.76], [Math.PI / 2, 0, 0]));
  B.push(P(new T.ConeGeometry(1.15, 1.5, 4), '#8a5a44', [0, ty + fp * 0.8 + 0.75, -d * 0.1], [0, Math.PI / 4, 0]));
  B.push(P(cyl(0.03, 0.03, 1.4, 6), '#4b5563', [0, ty + fp * 0.8 + 2.1, -d * 0.1]));
  B.push(P(box(0.7, 0.4, 0.03), '#ef4444', [0.36, ty + fp * 0.8 + 2.55, -d * 0.1]));
  return { B, G, top: ty + fp * 0.8 + 2.8 };
}
const KIND_ORDER = Object.keys(KIND);
const KIND_LABEL = { rechner: 'Rechner', quiz: 'Quiz', zusammenfassung: 'Zusammenfassung', cheatsheet: 'Cheatsheet', tool: 'Tool', visualisierung: 'Visualisierung', sonstiges: 'Sonstiges' };
const KIND_ABBR = { rechner: 'R', quiz: 'Q', zusammenfassung: 'Z', cheatsheet: 'C', tool: 'T', visualisierung: 'V', sonstiges: 'S' };
const newCount = (m) => m.items.filter((i) => i.neu).length;

function artifactParts(item, x, z) {
  const out = [P(cyl(0.26, 0.3, 0.32, 10), STONE, [x, 0.2, z]), P(box(0.44, 0.54, 0.08), KIND[item.kind], [x, 0.66, z], [-0.22, 0, 0])];
  if (item.neu) {
    out.push(P(cyl(0.015, 0.015, 0.8, 5), '#3f3f46', [x + 0.3, 0.8, z - 0.12]));
    out.push(P(box(0.3, 0.18, 0.012), '#facc15', [x + 0.45, 1.1, z - 0.12]));
  }
  return out;
}
// Beete: zusammenhängende Plätze gleicher Kategorie pro Reihe und Seite → ein Beet mit Kante in Kategoriefarbe.
function bedParts(slots) {
  const out = [], groups = {};
  for (const s of slots) (groups[s.side + '|' + s.row] ??= []).push(s);
  for (const g of Object.values(groups)) {
    g.sort((a, b) => a.c - b.c);
    let run = [g[0]];
    const flush = () => {
      const xs = run.map((s) => s.x), x0 = Math.min(...xs) - 0.56, x1 = Math.max(...xs) + 0.56, z = run[0].z, w = x1 - x0, cx = (x0 + x1) / 2, col = KIND[run[0].item.kind];
      out.push(P(box(w, 0.05, 1.08), '#7b5d45', [cx, 0.025, z]));
      out.push(P(box(w, 0.1, 0.07), col, [cx, 0.05, z - 0.54]), P(box(w, 0.1, 0.07), col, [cx, 0.05, z + 0.54]));
      out.push(P(box(0.07, 0.1, 1.08), col, [x0, 0.05, z]), P(box(0.07, 0.1, 1.08), col, [x1, 0.05, z]));
    };
    for (let i = 1; i < g.length; i++) { if (g[i].item.kind === run[0].item.kind && g[i].c === run[run.length - 1].c + 1) run.push(g[i]); else { flush(); run = [g[i]]; } }
    flush();
  }
  return out;
}
function benchParts(x, z, rot) {
  const c = Math.cos(rot), s = Math.sin(rot), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const out = [];
  const [sx, sz] = at(0, 0); out.push(P(box(1.1, 0.06, 0.36), WOOD, [sx, 0.42, sz], [0, rot, 0]));
  const [bx, bz] = at(0, -0.17); out.push(P(box(1.1, 0.3, 0.05), WOOD, [bx, 0.64, bz], [0, rot, 0]));
  for (const lx of [-0.48, 0.48]) for (const lz of [-0.13, 0.13]) { const [px, pz] = at(lx, lz); out.push(P(box(0.06, 0.42, 0.06), '#4a3424', [px, 0.21, pz])); }
  return out;
}
function treeParts(x, z) {
  return [P(cyl(0.12, 0.17, 1.5, 8), '#6b4423', [x, 0.75, z]), P(new T.IcosahedronGeometry(0.95, 1), '#5c9b4f', [x, 2.0, z], [0.3, 0.5, 0], [1, 0.9, 1]), P(new T.IcosahedronGeometry(0.6, 1), '#6aa95a', [x + 0.35, 2.55, z - 0.2])];
}

// ---------- Grundstück ----------
function edges(pl) {
  const { hw, front, back } = pl;
  return [[-hw, -back, hw, -back], [-hw, -back, -hw, front], [hw, -back, hw, front], [-hw, front, -GATE, front], [GATE, front, hw, front]];
}
// Liefert Bauteile; Heckenkugeln gehen als Instanzen in `inst` (ein InstancedMesh fürs ganze Dorf).
function fenceParts(pl, style, rnd, inst, lantern) {
  const out = [], glow = [];
  for (const [x0, z0, x1, z1] of edges(pl)) {
    const L = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if (style === 'hecke') {
      // Geschnittene Hecke: schmal (0.3 m), kniehoch, Segmente mit leicht wechselnder Höhe und hellerer Schnittkante
      const LL = L + 0.3, n = Math.max(1, Math.round(LL / 1.1)), seg = LL / n, ux = (x1 - x0) / L, uz = (z1 - z0) / L;
      for (let i = 0; i < n; i++) {
        const o = -0.15 + seg * (i + 0.5), cx = x0 + ux * o, cz = z0 + uz * o, h = 0.5 + rnd() * 0.06;
        inst.push({ pos: [cx, h / 2, cz], rot: [0, ang, 0], scale: [0.3, h, seg + 0.01], color: i % 2 ? '#3f7d42' : '#43834a' });
        inst.push({ pos: [cx, h + 0.012, cz], rot: [0, ang, 0], scale: [0.24, 0.03, seg - 0.02], color: '#5f9d57' });
      }
    } else if (style === 'zaun') {
      const n = Math.max(1, Math.round(L / 1.0));
      for (let i = 0; i <= n; i++) { const t = i / n; out.push(P(box(0.08, 0.72, 0.08), '#e9dfc9', [x0 + (x1 - x0) * t, 0.36, z0 + (z1 - z0) * t])); }
      for (const y of [0.28, 0.56]) out.push(P(box(0.04, 0.07, L), '#ddd1b6', [mx, y, mz], [0, ang, 0]));
    } else {
      const n = Math.max(1, Math.floor(L / 0.52));
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; out.push(P(box(0.24, 0.11 + rnd() * 0.03, (L / n) * 0.9), rnd() > 0.5 ? '#bdb6a9' : '#aea79a', [x0 + (x1 - x0) * t, 0.06, z0 + (z1 - z0) * t], [0, ang, 0])); }
    }
  }
  const postH = style === 'kante' ? 0.35 : style === 'hecke' ? 0.72 : 0.95, postC = style === 'zaun' ? '#e9dfc9' : '#b8b2a7';
  for (const s of [-1, 1]) {
    out.push(P(box(0.26, postH, 0.26), postC, [s * (GATE + 0.05), postH / 2, pl.front]));
    out.push(P(box(0.32, 0.06, 0.32), darken(postC, 0.85), [s * (GATE + 0.05), postH + 0.03, pl.front]));
    if (lantern) {
      out.push(P(box(0.18, 0.04, 0.18), '#3f3f46', [s * (GATE + 0.05), postH + 0.08, pl.front]), P(box(0.18, 0.04, 0.18), '#3f3f46', [s * (GATE + 0.05), postH + 0.34, pl.front]));
      glow.push(P(box(0.14, 0.22, 0.14), '#ffd479', [s * (GATE + 0.05), postH + 0.21, pl.front]));
    }
  }
  return { out, glow };
}

// ---------- Beschriftungen ----------
const countText = (n) => (n === 0 ? 'Baustelle' : n === 1 ? '1 Objekt' : n + ' Objekte');
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function mkTex(c) { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
let MEASURE = null; const measure = (font, text) => { MEASURE ??= cv(1, 1).getContext('2d'); MEASURE.font = font; return MEASURE.measureText(text).width; };
function drawIst(text, sub) {
  const H = 96, font = `600 44px system-ui, -apple-system, "Segoe UI", sans-serif`, subF = `400 38px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w1 = measure(font, text), w2 = sub ? measure(subF, `  · ${sub}`) : 0, W = Math.ceil(Math.min(w1 + w2, 900) + 56), c = cv(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.93)'; rr(ctx, 0, 0, W, H, H / 2); ctx.fill();
  ctx.textBaseline = 'middle'; ctx.fillStyle = '#18181b'; ctx.font = font; ctx.fillText(text, 28, H / 2 + 2, 900);
  if (sub) { ctx.fillStyle = 'rgba(24,24,27,0.55)'; ctx.font = subF; ctx.fillText(`  · ${sub}`, 28 + w1, H / 2 + 2); }
  return { canvas: c, center: [0.5, 0.5] };
}
function codeTag(ctx, x, y, s, label, fill, empty, fontPx) {
  ctx.fillStyle = fill; rr(ctx, x, y, s, s, s * 0.2); ctx.fill();
  if (empty) { ctx.save(); rr(ctx, x, y, s, s, s * 0.2); ctx.clip(); ctx.strokeStyle = 'rgba(194,106,24,0.35)'; ctx.lineWidth = s * 0.1; for (let k = -s; k < s * 2; k += s * 0.28) { ctx.beginPath(); ctx.moveTo(x + k, y + s); ctx.lineTo(x + k + s, y); ctx.stroke(); } ctx.restore(); }
  ctx.strokeStyle = 'rgba(28,27,25,0.16)'; ctx.lineWidth = 3; rr(ctx, x + 1.5, y + 1.5, s - 3, s - 3, s * 0.2); ctx.stroke();
  ctx.fillStyle = '#1c1b19'; ctx.font = `700 ${fontPx}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + s / 2, y + s / 2 + 2); ctx.textAlign = 'left';
}
function cardShell(title, sub, tagLabel, tagFill, empty, bar, badge) {
  const pad = 20, tag = 88, bodyH = 128, tail = 18, tf = `600 38px ${FONT}`, sf = `500 27px ${FONT}`, bf = `600 22px ${FONT}`;
  const bw = badge ? measure(bf, badge) + 22 : 0, tw = measure(tf, title), sw = measure(sf, sub) + (badge ? bw + 12 : 0);
  const textW = Math.max(tw, sw, 170), W = Math.ceil(pad + tag + 22 + textW + 28), H = bodyH + tail, c = cv(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#fffdf8'; rr(ctx, 0, 0, W, bodyH, 22); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W / 2 - 16, bodyH - 1); ctx.lineTo(W / 2, H); ctx.lineTo(W / 2 + 16, bodyH - 1); ctx.closePath(); ctx.fill();
  codeTag(ctx, pad, pad, tag, tagLabel, tagFill, empty, 30);
  const tx = pad + tag + 22;
  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#1c1b19'; ctx.font = tf; ctx.fillText(title, tx, 58);
  ctx.fillStyle = '#6d6a63'; ctx.font = sf; ctx.fillText(sub, tx, 92);
  if (badge) { const bx = tx + measure(sf, sub) + 12; ctx.fillStyle = '#fde68a'; rr(ctx, bx, 68, bw, 32, 16); ctx.fill(); ctx.fillStyle = '#78350f'; ctx.font = bf; ctx.fillText(badge, bx + 11, 92); }
  if (bar) { let x = tx; const gap = 4, keys = Object.keys(bar), total = keys.reduce((s, k) => s + bar[k], 0), unit = (textW - gap * (keys.length - 1)) / total; keys.forEach((k) => { const w = unit * bar[k]; ctx.fillStyle = KIND[k]; rr(ctx, x, 106, w, 8, 4); ctx.fill(); x += w + gap; }); }
  return { canvas: c, center: [0.5, 0] };
}
function drawCard(m) {
  const n = m.items.length, nn = newCount(m), bar = {};
  m.items.forEach((i) => (bar[i.kind] = (bar[i.kind] || 0) + 1));
  return cardShell(m.title, n ? countText(n) : 'Baustelle · noch leer', m.code, n ? m.color : '#f3d9a6', !n, n ? bar : null, nn ? nn + ' neu' : null);
}
function drawObjCard(item, m) {
  return cardShell(item.title, KIND_LABEL[item.kind] + ' · ' + m.code, KIND_ABBR[item.kind], KIND[item.kind], false, null, item.neu ? 'neu' : null);
}
function drawChip(m) {
  const H = 64, tf = `700 26px ${FONT}`, nf = `600 28px ${FONT}`, bf = `600 20px ${FONT}`, nn = newCount(m);
  const cw = measure(tf, m.code) + 28, num = String(m.items.length), nw = measure(nf, num), bw = nn ? measure(bf, '+' + nn) + 18 : 0;
  const W = Math.ceil(6 + cw + 14 + 20 + 8 + nw + (nn ? 10 + bw : 0) + 20), c = cv(W, H + 12), ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(255,253,248,0.96)'; rr(ctx, 0, 0, W, H, H / 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W / 2 - 9, H - 1); ctx.lineTo(W / 2, H + 12); ctx.lineTo(W / 2 + 9, H - 1); ctx.fill();
  ctx.fillStyle = m.items.length ? m.color : '#f3d9a6'; rr(ctx, 6, 6, cw, H - 12, (H - 12) / 2); ctx.fill();
  ctx.fillStyle = '#26241f'; ctx.font = tf; ctx.textBaseline = 'middle'; ctx.fillText(m.code, 6 + 14, H / 2 + 1);
  const ix = 6 + cw + 14; ctx.strokeStyle = '#6d6a63'; ctx.lineWidth = 3; rr(ctx, ix, 18, 18, 26, 3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ix + 5, 27); ctx.lineTo(ix + 13, 27); ctx.moveTo(ix + 5, 34); ctx.lineTo(ix + 13, 34); ctx.stroke();
  ctx.fillStyle = '#1c1b19'; ctx.font = nf; ctx.fillText(num, ix + 28, H / 2 + 1);
  if (nn) { const bx = ix + 28 + nw + 10; ctx.fillStyle = '#fde68a'; rr(ctx, bx, 16, bw, 32, 16); ctx.fill(); ctx.fillStyle = '#78350f'; ctx.font = bf; ctx.fillText('+' + nn, bx + 9, H / 2 + 1); }
  return { canvas: c, center: [0.5, 0] };
}
function drawBoard(m) {
  const W = 512, H = 256, c = cv(W, H), ctx = c.getContext('2d'), nn = newCount(m);
  ctx.fillStyle = '#8b5e3c'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(60,35,18,0.35)'; ctx.lineWidth = 3; for (const y of [64, 128, 192]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = '#5e3c22'; ctx.lineWidth = 14; ctx.strokeRect(7, 7, W - 14, H - 14);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#f3dcb4'; ctx.font = `600 34px ${FONT}`; ctx.fillText(m.code.split('').join(' '), W / 2, 70);
  ctx.fillStyle = '#fbf3e4'; ctx.font = `700 62px ${FONT}`; ctx.fillText(m.title, W / 2, 150, W - 60);
  ctx.fillStyle = '#f0d9b5'; ctx.font = `500 34px ${FONT}`; ctx.fillText((m.items.length ? countText(m.items.length) : 'Baustelle · noch leer') + (nn ? ` · ${nn} neu` : ''), W / 2, 210, W - 50);
  return { canvas: c };
}

// Ein Textur-Atlas für alle Schilder und Beschriftungen einer Szene (Regal-Packung, eine GPU-Textur).
function buildAtlas(entries) {
  const AW = entries.length > 60 ? 4096 : 2048, pad = 8; let x = pad, y = pad, rowH = 0;
  for (const e of entries) {
    const w = e.canvas.width, h = e.canvas.height;
    if (x + w + pad > AW) { x = pad; y += rowH + pad; rowH = 0; }
    e.ax = x; e.ay = y; x += w + pad; rowH = Math.max(rowH, h);
  }
  let AH = 256; while (AH < y + rowH + pad) AH *= 2;
  const atlas = cv(AW, AH), ctx = atlas.getContext('2d');
  for (const e of entries) ctx.drawImage(e.canvas, e.ax, e.ay);
  const base = mkTex(atlas);
  for (const e of entries) {
    const t = base.clone(); t.repeat.set(e.canvas.width / AW, e.canvas.height / AH); t.offset.set(e.ax / AW, 1 - (e.ay + e.canvas.height) / AH);
    e.tex = t; e.aspect = e.canvas.width / e.canvas.height;
  }
  return { base, size: [AW, AH] };
}

// ---------- Runde 3: Gelände, Wasser, Quartiere, Objektformen, Tafeln ----------
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function terrainH(x, z, ext, on) {
  if (!on) return 0;
  const r = Math.hypot(x, z), s = smooth((r - (ext + 9)) / 18);
  if (s <= 0) return 0;
  return s * (2.4 + 1.4 * Math.sin(x * 0.09 + 1.3) * Math.cos(z * 0.11 - 0.7) + 0.6 * Math.sin(x * 0.21 + z * 0.17));
}
const polar = (a, r) => ({ x: Math.cos(a) * r, z: Math.sin(a) * r });
// Port von environment.ts: Fluss als Bogen auf der Rückseite, Enden laufen aus dem Bild.
function computeRiver(ext, seed) {
  const k = fnv(seed), phase = (k % 628) / 100, pts = [], C0 = -Math.PI / 2, HS = 1.75;
  pts.push(polar(C0 - HS - 0.3, ext + 38), polar(C0 - HS - 0.12, ext + 14));
  for (let i = 0; i <= 56; i++) { const t = i / 56, a = C0 - HS + t * HS * 2, me = 1.3 * Math.sin(t * 7 + phase) + 0.5 * Math.sin(t * 15 + phase * 2); pts.push(polar(a, ext + 4.5 + me)); }
  pts.push(polar(C0 + HS + 0.12, ext + 14), polar(C0 + HS + 0.3, ext + 38));
  return { points: pts, width: 3.4 };
}
const QCOL = [{ main: '#d3c9b0', edge: '#a99f86', plaza: '#c6bca2' }, { main: '#d6c0b8', edge: '#ad968d', plaza: '#c9b1a8' }, { main: '#c2cdc6', edge: '#97a59c', plaza: '#b4c0b8' }, { main: '#d9c7a0', edge: '#b29f78', plaza: '#cdbb93' }, { main: '#c4cad0', edge: '#9aa2aa', plaza: '#b7bec5' }, { main: '#d9b8a3', edge: '#b0907b', plaza: '#cba995' }, { main: '#cad2b2', edge: '#a2ab88', plaza: '#bcc5a3' }];
const TAU = Math.PI * 2, normA = (a) => ((a % TAU) + TAU) % TAU, angDiff = (a, b) => { const d = Math.abs(normA(a) - normA(b)); return Math.min(d, TAU - d); };
// Vieleck: jeder Weg bekommt eine eigene Seite. Drehung so, dass die Summe der Abweichungen minimal ist.
function polyAssign(angles, n) {
  const order = angles.map((a, i) => ({ a: normA(a), i })).sort((p, q) => p.a - q.a); let best = null;
  for (const cand of order) {
    const used = new Set(), asg = []; let cost = 0;
    for (const o of order) { let bk = -1, bd = 1e9; for (let k = 0; k < n; k++) { if (used.has(k)) continue; const d = angDiff(o.a, cand.a + (TAU * k) / n); if (d < bd) { bd = d; bk = k; } } used.add(bk); asg[o.i] = cand.a + (TAU * bk) / n; cost += bd * bd; }
    if (!best || cost < best.cost) best = { rot: cand.a, asg, cost };
  }
  return best;
}
function plotCorners(x, z, ang, p) { const c = Math.cos(ang), s = Math.sin(ang); return [[-p.hw, -p.back], [p.hw, -p.back], [p.hw, p.front], [-p.hw, p.front]].map(([lx, lz]) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c })); }
function satOverlap(A, B, m = 0.4) {
  for (const Pg of [A, B]) for (let i = 0; i < 4; i++) {
    const a = Pg[i], b = Pg[(i + 1) % 4], l = Math.hypot(b.x - a.x, b.z - a.z), nx = -(b.z - a.z) / l, nz = (b.x - a.x) / l, pa = A.map((p) => p.x * nx + p.z * nz), pb = B.map((p) => p.x * nx + p.z * nz);
    if (Math.max(...pa) + m < Math.min(...pb) || Math.max(...pb) + m < Math.min(...pa)) return false;
  }
  return true;
}
// Anordnung der Häuser im Quartier (lokal: +x zeigt von der Zentrale weg)
function arrangeQuarter(info, mode, rp) {
  const m = info.length, hw = Math.max(...info.map((x) => x.plot.hw)), f = Math.max(...info.map((x) => x.plot.front)), b = Math.max(...info.map((x) => x.plot.back));
  const P2 = (inf, r, phi) => ({ inf, lx: Math.cos(phi) * r, lz: Math.sin(phi) * r });
  let pos = [];
  if (mode === 'rund') { const D = TAU / (m + 1), R = Math.max(rp + f + 2.4, f + (2 * hw + 1.6) / (2 * Math.sin(D / 2))); pos = info.map((inf, i) => P2(inf, R, Math.PI + (i + 1) * D)); }
  else if (mode === 'zeile') { const sp = 2 * hw + 1.8, Lr = Math.max(rp + f + 3.2, sp * (m - 1) * 0.5); pos = info.map((inf, i) => ({ inf, lx: Lr, lz: (i - (m - 1) / 2) * sp, parallel: true })); }
  else if (mode === 'doppel') {
    const mi = Math.ceil(m / 2), mo = m - mi, D = mi === 1 ? 1.0 : Math.min(1.15, (Math.PI * 1.1) / (mi - 1)), need = 2 * hw + PATH_W + 2.4;
    const R1 = Math.max(rp + f + 2.4, f + need / (2 * Math.sin(D / 2))), R2 = R1 + b + f + 2.5;
    pos = info.map((inf, i) => (i % 2 === 0 ? P2(inf, R1, (i / 2 - (mi - 1) / 2) * D) : P2(inf, R2, ((i - 1) / 2 - (mo - 1) / 2) * D + (mo === mi ? D / 2 : 0))));
  } else if (mode === 'locker') {
    const D = m === 1 ? 0 : Math.min(1.35, (Math.PI * 1.2) / (m - 1)), R = Math.max(rp + f + 2.6, m > 1 ? f + (2 * hw + 2.2) / (2 * Math.sin(D / 2)) : 0); let amt = 1;
    for (let tr = 0; tr < 6; tr++) {
      pos = info.map((inf, i) => P2(inf, R * (1 + amt * 0.2 * (jit(i, 7) - 0.5) * 2), (i - (m - 1) / 2) * D + amt * 0.22 * D * (jit(i, 11) - 0.5) * 2));
      const cs = pos.map((p) => plotCorners(p.lx, p.lz, Math.atan2(-p.lx, -p.lz), p.inf.plot));
      if (cs.every((A, i) => cs.every((B, j) => j <= i || !satOverlap(A, B)))) break; amt = tr === 4 ? 0 : amt * 0.5;
    }
  } else { const D = m === 1 ? 0 : Math.min(1.25, (Math.PI * 1.15) / (m - 1)), R = Math.max(rp + f + 2.4, m > 1 ? f + (2 * hw + 1.3) / (2 * Math.sin(D / 2)) : 0); pos = info.map((inf, i) => P2(inf, R, (i - (m - 1) / 2) * D)); }
  const Qr = Math.max(rp + 1, ...pos.map((p) => Math.hypot(Math.hypot(p.lx, p.lz) + p.inf.plot.back, p.inf.plot.hw) + 0.8));
  return { pos, Qr };
}
// Quartiere als Inseln: Gruppen um Nebenplätze, Lage zur Zentrale nach qlayout, Häuser nach qhouses.
function computeQuarters(mods, mode, tf, plaza, qhouses = 'bogen', qlayout = 'kreis', poly = false) {
  const keyOf = (m) => (mode === 'semester' ? m.sem : m.fach), groups = [];
  for (const m of mods) { let g = groups.find((x) => x.key === keyOf(m)); if (!g) groups.push((g = { key: keyOf(m), mods: [] })); g.mods.push(m); }
  if (mode === 'semester') groups.sort((a, b) => a.key - b.key);
  const k = groups.length, rpFor = (m) => Math.max(2.6, poly ? 1.3 / Math.tan(Math.PI / Math.max(5, m + 1)) : ((m + 1) * 2.4) / TAU);
  groups.forEach((g, q) => {
    g.info = g.mods.map((m) => { const tier = tierOf(m.items.length), fp = tf[tier]; return { m, tier, fp, plot: plotFor(fp, tier, m.items) }; });
    g.rp = rpFor(g.info.length); Object.assign(g, arrangeQuarter(g.info, qhouses, g.rp));
    g.name = mode === 'semester' ? g.key + '. Semester' : g.key; g.color = QCOL[q % QCOL.length];
  });
  const QrMax = Math.max(...groups.map((g) => g.Qr)), minD = (g) => plaza + g.rp + 4 + g.Qr * 0.45;
  const Dk = Math.max(...groups.map(minD), k > 1 ? (QrMax + 1.5) / Math.sin(Math.PI / k) : 0), tot = groups.reduce((s, g) => s + g.Qr, 0);
  let cum = 0;
  groups.forEach((g, q) => {
    let th, D;
    if (qlayout === 'kompakt') { th = Math.PI / 2 + (TAU * (cum + g.Qr / 2)) / tot; cum += g.Qr; D = minD(g); }
    else if (qlayout === 'faecher') { const S = k === 1 ? 0 : Math.min(Math.PI * 1.2, 1.0 * (k - 1)); th = Math.PI / 2 + (k > 1 ? (q - (k - 1) / 2) * (S / (k - 1)) : 0); D = minD(g); }
    else if (qlayout === 'versetzt') { th = Math.PI / 2 + (TAU * q) / k; D = minD(g) + (q % 2 ? g.Qr * 1.3 + 4 : 0); }
    else if (qlayout === 'fluegel') { const side = q % 2, j = Math.floor(q / 2), cnt = Math.ceil((k - side) / 2); th = (side ? 0.3 : Math.PI - 0.3) + (j - (cnt - 1) / 2) * 0.85 * (side ? 1 : -1); D = minD(g); }
    else { th = Math.PI / 2 + (TAU * q) / k; D = Dk; }
    g.c = polar(th, D);
  });
  // Überlappungen auflösen: Inseln auseinander, Hauptwege frei halten
  for (let it = 0; it < 400; it++) {
    let moved = false;
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
      const A = groups[i], B = groups[j], d = Math.hypot(A.c.x - B.c.x, A.c.z - B.c.z), need = A.Qr + B.Qr + 1.5;
      if (d < need) { const far = Math.hypot(A.c.x, A.c.z) > Math.hypot(B.c.x, B.c.z) ? A : B, l = Math.hypot(far.c.x, far.c.z); far.c.x += (far.c.x / l) * (need - d + 0.05); far.c.z += (far.c.z / l) * (need - d + 0.05); moved = true; }
    }
    for (const g of groups) { const l = Math.hypot(g.c.x, g.c.z), mn = minD(g); if (l < mn - 1e-6) { g.c.x *= mn / l; g.c.z *= mn / l; moved = true; } }
    for (const A of groups) for (const B of groups) {
      if (A === B || Math.hypot(A.c.x, A.c.z) >= Math.hypot(B.c.x, B.c.z)) continue;
      if (distSeg(A.c.x, A.c.z, { x: 0, z: 0 }, B.c) < A.Qr + 1.2) { const sgn = B.c.x * A.c.z - B.c.z * A.c.x > 0 ? -1 : 1, rot = 0.03 * sgn, cs = Math.cos(rot), sn = Math.sin(rot); B.c = { x: B.c.x * cs - B.c.z * sn, z: B.c.x * sn + B.c.z * cs }; moved = true; }
    }
    if (!moved) break;
  }
  const houses = [{ id: 'zentrale', x: 0, z: 0, angle: 0, ring: 0, tier: 3, footprint: ZFP }], quarters = [];
  groups.forEach((g) => {
    const th = Math.atan2(g.c.z, g.c.x), cs = Math.cos(th), sn = Math.sin(th);
    const qu = { name: g.name, x: g.c.x, z: g.c.z, theta: th, rp: g.rp, color: g.color, codes: g.mods.map((m) => m.code), Qr: g.Qr, houses: [] };
    quarters.push(qu);
    for (const p of g.pos) {
      const x = r3(g.c.x + p.lx * cs - p.lz * sn), z = r3(g.c.z + p.lx * sn + p.lz * cs), inf = p.inf;
      const h = { id: inf.m.id, m: inf.m, x, z, angle: p.parallel ? Math.atan2(-cs, -sn) : Math.atan2(-(x - g.c.x), -(z - g.c.z)), ring: 1, tier: inf.tier, footprint: inf.fp, plot: inf.plot, quarter: qu, phi: Math.atan2(z - g.c.z, x - g.c.x) };
      houses.push(h); qu.houses.push(h);
    }
  });
  // Wegseiten: am Hauptplatz ein Weg pro Quartier, am Nebenplatz ein Weg pro Haus plus Hauptweg
  const polys = [];
  if (poly) { const n = Math.max(5, k), pa = polyAssign(quarters.map((q) => q.theta), n); quarters.forEach((q, i) => (q.mainSide = pa.asg[i])); polys.push({ x: 0, z: 0, a: plaza, n, rot: pa.rot, used: pa.asg, gap: 3.6, main: true }); }
  for (const q of quarters) {
    const dirs = [q.theta + Math.PI, ...q.houses.map((h) => h.phi)];
    if (poly) { const n = Math.max(5, q.houses.length + 1), pa = polyAssign(dirs, n); q.entrySide = pa.asg[0]; q.houses.forEach((h, i) => (h.side = pa.asg[i + 1])); polys.push({ x: q.x, z: q.z, used: pa.asg, gap: 3.0, a: q.rp, n, rot: pa.rot, q }); }
    else { q.entrySide = q.theta + Math.PI; q.houses.forEach((h) => (h.side = h.phi)); }
    if (!poly) q.mainSide = q.theta;
  }
  const ext = Math.max(...quarters.map((q) => Math.hypot(q.x, q.z) + q.Qr)) + 6;
  return { houses, plaza, quarters, polys, extent: ext };
}
function hermite(S, dS, G, dG, amp, sign) {
  const D = Math.hypot(G.x - S.x, G.z - S.z), N = Math.max(20, Math.round(D * 3)), kk = D * 0.5, nx = -(G.z - S.z) / D, nz = (G.x - S.x) / D, pts = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N, t2 = t * t, t3 = t2 * t, h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2, bow = amp * sign * Math.sin(Math.PI * t) ** 2;
    pts.push({ x: h00 * S.x + h10 * dS.x * kk + h01 * G.x + h11 * dG.x * kk + nx * bow, z: h00 * S.z + h10 * dS.z * kk + h01 * G.z + h11 * dG.z * kk + nz * bow });
  }
  return pts;
}
function quarterPaths(L, reach) {
  const out = [], dir = (a) => ({ x: Math.cos(a), z: Math.sin(a) });
  for (const q of L.quarters) {
    const s0 = dir(q.mainSide), e0 = dir(q.entrySide);
    out.push({ kind: 'neu', width: 1.9, seed: 1, points: hermite({ x: s0.x * (L.plaza - 0.35), z: s0.z * (L.plaza - 0.35) }, s0, { x: q.x + e0.x * (q.rp - 0.35), z: q.z + e0.z * (q.rp - 0.35) }, { x: -e0.x, z: -e0.z }, 0, 1) });
  }
  for (const h of L.houses) {
    if (!h.quarter) continue;
    const q = h.quarter, sd = dir(h.side), f = { x: Math.sin(h.angle), z: Math.cos(h.angle) }, r = reach(h), sign = (fnv(h.id) >>> 6) % 2 ? 1 : -1;
    out.push({ kind: 'neu', width: PATH_W, seed: (fnv(h.id) % 100) / 10, color: q.color, points: hermite({ x: q.x + sd.x * (q.rp - 0.35), z: q.z + sd.z * (q.rp - 0.35) }, sd, { x: h.x + f.x * r, z: h.z + f.z * r }, { x: -f.x, z: -f.z }, 0.3, sign) });
  }
  return out;
}
// Vieleck-Platz: Fläche und Steinkante (ShapeGeometry liegt in XY, wird flach gedreht)
function polyShape(R, n, rot) { const s = new T.Shape(); for (let i = 0; i <= n; i++) { const b = rot + Math.PI / n + (TAU * i) / n; const x = Math.cos(b) * R, y = -Math.sin(b) * R; i ? s.lineTo(x, y) : s.moveTo(x, y); } return s; }
// Platz als Pflasterfläche: Grundton, Pflasterbänder, Fugen zu den Ecken, Randstein mit Lücken an den Wegen.
function polyPlaza(p, fill, edge) {
  const n = p.n, R = p.a / Math.cos(Math.PI / n), parts = [], tone = (f) => darken(fill, f);
  const flat = (r, y, col) => { const g = new T.ShapeGeometry(polyShape(r, n, p.rot)); g.rotateX(-Math.PI / 2); parts.push({ geo: g, color: col, pos: [0, y, 0] }); };
  const band = (r0, r1, y, col) => { const sh = polyShape(r1, n, p.rot), hole = new T.Path(); polyShape(r0, n, p.rot).getPoints().reverse().forEach((pt, i) => (i ? hole.lineTo(pt.x, pt.y) : hole.moveTo(pt.x, pt.y))); sh.holes.push(hole); const g = new T.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); parts.push({ geo: g, color: col, pos: [0, y, 0] }); };
  flat(R + 0.1, 0.004, fill);
  for (const [f0, f1] of p.main ? [[0.62, 0.65], [0.86, 0.885]] : [[0.58, 0.63]]) band(R * f0, R * f1, 0.007, tone(0.9));
  const r0 = p.main ? R * 0.62 : R * 0.2;
  for (let i = 0; i < n; i++) { const b = p.rot + Math.PI / n + (TAU * i) / n, r1 = R - 0.35, L = r1 - r0, mid = (r0 + r1) / 2; parts.push({ geo: box(0.07, 0.012, L), color: tone(0.88), pos: [Math.cos(b) * mid, 0.008, Math.sin(b) * mid], rot: [0, Math.atan2(Math.cos(b), Math.sin(b)), 0] }); }
  // Randstein pro Seite, an Wegen offen
  const side = 2 * p.a * Math.tan(Math.PI / n);
  for (let k = 0; k < n; k++) {
    const a = p.rot + (TAU * k) / n, used = (p.used || []).some((u) => angDiff(u, a) < 0.02), c = { x: Math.cos(a), z: Math.sin(a) }, t = { x: -c.z, z: c.x }, d = p.a - 0.12, rot = [0, Math.atan2(t.x, t.z), 0];
    const seg = (o0, o1) => { if (o1 - o0 < 0.3) return; const m = (o0 + o1) / 2; parts.push({ geo: box(0.28, 0.14, o1 - o0), color: edge, pos: [c.x * d + t.x * m, 0.07, c.z * d + t.z * m], rot }); };
    const half = side / 2 + 0.12;
    if (!used) seg(-half, half); else if (p.gap < side - 0.6) { seg(-half, -p.gap / 2); seg(p.gap / 2, half); }
  }
  const m = new T.Mesh(merge(parts), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })); m.position.set(p.x, 0, p.z); m.receiveShadow = true; m.castShadow = true;
  return [m];
}
// Terrasse unter der Zentrale (gleiches Vieleck, zwei Stufen)
function terraceParts(p) {
  const out = [], ex = (r, h, col) => { const g = new T.ExtrudeGeometry(polyShape(r, p.n, p.rot), { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); out.push({ geo: g, color: col }); };
  ex(5.5, 0.11, '#cfc7b4'); ex(4.95, 0.22, '#ddd5c3');
  return out;
}
function lampSpot(x, z, rot = 0) { return { x, z, rot }; }
// Weg mit Kieskörnung (Vertexfarben) und weichem Übergang ins Gras.
function resample(pts, step) {
  const out = [pts[0]]; let i = 0, acc = 0, next = step;
  while (i < pts.length - 1) {
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b.x - a.x, b.z - a.z);
    while (acc + l >= next) { const t = (next - acc) / l; out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }); next += step; }
    acc += l; i++;
  }
  out.push(pts[pts.length - 1]); return out;
}
function texRibbon(pts0, widthAt, main, edge, grass, seed) {
  const pts = resample(pts0, 0.3), ns = normals(pts), cMain = new T.Color(main), cEdge = new T.Color(edge), cGrass = new T.Color(grass), tmp = new T.Color();
  const pos = [], nor = [], col = [], uv = [], total = plen(pts); let acc = 0; const rows = [];
  pts.forEach((p, i) => {
    if (i) acc += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    const w = widthAt(acc) / 2, e = 0.16, b = 0.45 * smooth((acc - 0.4) / 1.6) * smooth((total - acc) / 0.6 + 0.0001);
    const offs = [-(w + e + b), -(w + e), -w, -w / 2, 0, w / 2, w, w + e, w + e + b], ys = [0.008, 0.014, 0.022, 0.022, 0.022, 0.022, 0.022, 0.014, 0.008];
    rows.push(offs.map((o, j) => {
      let c;
      if (j === 0 || j === 8) c = cGrass.clone();
      else if (j === 1 || j === 7) c = tmp.copy(cEdge).lerp(cGrass, 0.25).clone();
      else if (j === 2 || j === 6) c = cEdge.clone();
      else c = cMain.clone();
      return { x: p.x + ns[i].x * o, y: ys[j], z: p.z + ns[i].z * o, c, u: o / 1.4, v: acc / 1.4 };
    }));
  });
  const push = (v) => { pos.push(v.x, v.y, v.z); nor.push(0, 1, 0); col.push(v.c.r, v.c.g, v.c.b); uv.push(v.u, v.v); };
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < 8; j++) {
    const a = rows[i][j], b = rows[i][j + 1], c = rows[i + 1][j], d = rows[i + 1][j + 1];
    for (const [p, q, r] of [[a, b, c], [b, d, c]]) { const up = (q.z - p.z) * (r.x - p.x) - (q.x - p.x) * (r.z - p.z) > 0; if (up) { push(p); push(q); push(r); } else { push(p); push(r); push(q); } }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  return g;
}
// Kies-Textur: kachelbar, hell, damit die Vertexfarbe den Ton bestimmt
function gravelTexture() {
  const N = 512, c = cv(N, N), ctx = c.getContext('2d'), rnd = seeded('kies');
  ctx.fillStyle = '#f3f0e9'; ctx.fillRect(0, 0, N, N);
  const dot = (x, y, r, col) => { ctx.fillStyle = col; for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { ctx.beginPath(); ctx.ellipse(x + dx, y + dy, r, r * (0.7 + rnd() * 0.3), rnd() * 3, 0, TAU); ctx.fill(); } };
  for (let i = 0; i < 260; i++) dot(rnd() * N, rnd() * N, 10 + rnd() * 22, `rgba(${200 + rnd() * 30 | 0},${195 + rnd() * 30 | 0},${185 + rnd() * 30 | 0},0.35)`);
  for (let i = 0; i < 5200; i++) { const g = 205 + rnd() * 50 | 0; dot(rnd() * N, rnd() * N, 1.2 + rnd() * 3.2, `rgb(${g},${g - 4},${g - 10})`); }
  for (let i = 0; i < 900; i++) dot(rnd() * N, rnd() * N, 0.8 + rnd() * 1.4, 'rgba(255,255,255,0.7)');
  const t = mkTex(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t;
}
function riverParts(river) {
  const ws = river.points.map(() => river.width);
  return [P(ribbon(river.points, ws.map((w) => w + 1.6), 0.006), '#cbbf99'), P(ribbon(river.points, ws.map((w) => w + 0.5), 0.01), '#7fa9b9'), P(ribbon(river.points, ws, 0.016), '#5b9cc4')];
}
function fountainParts(x, z) {
  return [P(cyl(1.35, 1.42, 0.45, 28), STONE, [x, 0.225, z]), P(cyl(1.18, 1.18, 0.04, 28), '#5f9fc6', [x, 0.44, z]), P(cyl(0.18, 0.22, 1.0, 12), STONE, [x, 0.7, z]), P(cyl(0.55, 0.3, 0.18, 18), STONE, [x, 1.2, z]), P(cyl(0.47, 0.47, 0.03, 18), '#6aaed6', [x, 1.28, z]), P(cyl(0.035, 0.06, 0.45, 8), '#a9d3ea', [x, 1.5, z])];
}
function paletteFor(m, on) {
  if (!on) return { wall: m.color, roof: roofFor(m.id), accent: null };
  const WALLS = ['#efe7d8', '#e8dcc6', '#f3eee4', '#e3d7c3', '#ece2d0'], ROOFS2 = ['#8e5a44', '#7a6656', '#6d5b4c', '#9a6b4f', '#5f6a6c'], h = fnv(m.id);
  const c = new T.Color(m.color), hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, 0.42, 0.42);
  return { wall: WALLS[h % 5], roof: ROOFS2[(h >>> 4) % 5], accent: '#' + c.getHexString() };
}
// Objektform nach Kategorie (Pult, Tafel, Buch, Blatt, Werkzeugkiste, Staffelei).
function objParts(item, x, z, typed) {
  const k = KIND[item.kind], out = [], add = (geo, col, px, py, pz, rot, sc) => out.push(P(geo, col, [x + px, py, z + pz], rot, sc));
  const kind = typed ? item.kind : 'plain';
  if (kind === 'rechner') { add(cyl(0.05, 0.07, 0.8, 8), '#4b4f55', 0, 0.4, 0); add(box(0.34, 0.04, 0.26), '#4b4f55', 0, 0.8, 0); add(box(0.56, 0.05, 0.42), k, 0, 0.87, 0, [0.42, 0, 0]); add(box(0.4, 0.02, 0.13), '#1f2937', 0, 0.92, -0.07, [0.42, 0, 0]); for (let i = 0; i < 3; i++) add(box(0.09, 0.02, 0.07), '#f8fafc', -0.12 + i * 0.12, 0.88, 0.09, [0.42, 0, 0]); }
  else if (kind === 'quiz') { for (const s of [-1, 1]) add(box(0.05, 1.0, 0.05), WOOD, s * 0.33, 0.5, 0); add(box(0.6, 0.42, 0.04), '#2f4a3c', 0, 0.74, 0); add(box(0.68, 0.05, 0.06), k, 0, 0.97, 0); add(box(0.68, 0.05, 0.06), k, 0, 0.51, 0); add(box(0.26, 0.025, 0.05), '#f1f5f9', -0.08, 0.8, 0.01); add(box(0.36, 0.025, 0.05), '#f1f5f9', 0, 0.7, 0.01); }
  else if (kind === 'zusammenfassung') { add(cyl(0.24, 0.28, 0.5, 10), STONE, 0, 0.25, 0); add(box(0.52, 0.04, 0.36), k, 0, 0.52, 0); add(box(0.24, 0.05, 0.32), '#fbf7ee', -0.125, 0.56, 0, [0, 0, 0.12]); add(box(0.24, 0.05, 0.32), '#fbf7ee', 0.125, 0.56, 0, [0, 0, -0.12]); }
  else if (kind === 'cheatsheet') { add(cyl(0.025, 0.03, 0.85, 6), '#3f3f46', 0, 0.42, -0.04); add(box(0.4, 0.52, 0.015), '#fbf7ee', 0, 0.98, 0, [-0.22, 0, 0]); add(box(0.4, 0.1, 0.02), k, 0, 1.18, -0.05, [-0.22, 0, 0]); for (let i = 0; i < 3; i++) add(box(0.28, 0.022, 0.02), '#b8b2a7', 0, 1.02 - i * 0.1, 0.02 + i * 0.022, [-0.22, 0, 0]); }
  else if (kind === 'tool') { add(box(0.6, 0.17, 0.36), '#4a3424', 0, 0.085, 0); add(box(0.55, 0.3, 0.32), k, 0, 0.32, 0); add(box(0.56, 0.03, 0.33), darken(k, 0.7), 0, 0.42, 0); for (const s of [-1, 1]) add(box(0.04, 0.1, 0.04), '#2b2b2b', s * 0.15, 0.52, 0); add(box(0.34, 0.04, 0.05), '#2b2b2b', 0, 0.58, 0); }
  else if (kind === 'visualisierung') { for (const s of [-1, 1]) add(cyl(0.025, 0.025, 1.25, 6), WOOD, s * 0.22, 0.6, 0.04, [-0.08, 0, s * 0.1]); add(cyl(0.025, 0.025, 1.2, 6), WOOD, 0, 0.58, -0.2, [0.32, 0, 0]); add(box(0.54, 0.44, 0.03), '#fbf7ee', 0, 0.88, 0.06, [-0.08, 0, 0]); [0.12, 0.22, 0.3].forEach((hh, i) => add(box(0.08, hh, 0.02), k, -0.13 + i * 0.13, 0.7 + hh / 2, 0.085, [-0.08, 0, 0])); }
  else { add(cyl(0.26, 0.3, 0.32, 10), STONE, 0, 0.2, 0); add(box(0.44, 0.54, 0.08), k, 0, 0.66, 0, [-0.22, 0, 0]); }
  if (item.neu) { add(cyl(0.015, 0.015, 0.8, 5), '#3f3f46', 0.36, 0.9, -0.14); add(box(0.3, 0.18, 0.012), '#facc15', 0.51, 1.2, -0.14); }
  return out;
}
function drawNotice(items) {
  const W = 1024, H = 640, c = cv(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#f3ecdc'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#5e3c22'; ctx.fillRect(0, 0, W, 110);
  ctx.fillStyle = '#fbf3e4'; ctx.font = `700 54px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillText('Neu im Dorf', 40, 58);
  ctx.fillStyle = '#e8cfa7'; ctx.font = `500 28px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText('Antippen zum Hingehen', W - 40, 60); ctx.textAlign = 'left';
  items.slice(0, 5).forEach((x, i) => {
    const y = 130 + i * 100;
    if (i) { ctx.fillStyle = 'rgba(94,60,34,0.15)'; ctx.fillRect(40, y - 6, W - 80, 2); }
    ctx.fillStyle = KIND[x.item.kind]; rr(ctx, 40, y + 14, 64, 64, 12); ctx.fill();
    ctx.fillStyle = '#1c1b19'; ctx.font = `700 30px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(KIND_ABBR[x.item.kind], 72, y + 48); ctx.textAlign = 'left';
    ctx.font = `600 38px ${FONT}`; ctx.fillText(x.item.title, 128, y + 34, 640);
    ctx.fillStyle = '#6d6a63'; ctx.font = `500 28px ${FONT}`; ctx.fillText(`${KIND_LABEL[x.item.kind]} · ${x.m.title}`, 128, y + 72, 640);
    ctx.fillStyle = '#fde68a'; rr(ctx, W - 150, y + 28, 110, 40, 20); ctx.fill(); ctx.fillStyle = '#78350f'; ctx.font = `600 24px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('neu', W - 95, y + 49); ctx.textAlign = 'left';
  });
  ctx.strokeStyle = '#5e3c22'; ctx.lineWidth = 16; ctx.strokeRect(8, 8, W - 16, H - 16);
  return { canvas: c };
}
function drawConstruction() {
  const W = 512, H = 320, c = cv(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#facc15'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 44); ctx.clip(); ctx.fillStyle = '#1c1b19'; for (let x = -60; x < W + 60; x += 56) { ctx.beginPath(); ctx.moveTo(x, 44); ctx.lineTo(x + 28, 0); ctx.lineTo(x + 56, 0); ctx.lineTo(x + 28, 44); ctx.fill(); } ctx.restore();
  ctx.fillStyle = '#1c1b19'; ctx.font = `700 46px ${FONT}`; ctx.textBaseline = 'alphabetic'; ctx.fillText('Baustelle', 32, 112);
  ctx.font = `600 36px ${FONT}`; ctx.fillText('Erstes Objekt', 32, 188); ctx.fillText('hinzufügen', 32, 234);
  ctx.beginPath(); ctx.arc(W - 96, 200, 62, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#facc15'; ctx.fillRect(W - 96 - 34, 192, 68, 16); ctx.fillRect(W - 96 - 8, 166, 16, 68);
  return { canvas: c };
}
function drawQuarterBoard(q) {
  const W = 512, H = 256, c = cv(W * 2, H * 2), ctx = c.getContext('2d'); ctx.scale(2, 2);
  ctx.fillStyle = '#fbf6ea'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = q.color.edge; ctx.fillRect(0, 0, W, 26);
  ctx.textAlign = 'center'; ctx.fillStyle = '#1c1b19'; ctx.font = `700 60px ${FONT}`; ctx.fillText(q.name, W / 2, 128, W - 50);
  ctx.fillStyle = '#6d6a63'; ctx.font = `500 34px ${FONT}`; ctx.fillText(q.codes.join(' · '), W / 2, 196, W - 50);
  ctx.strokeStyle = '#5e3c22'; ctx.lineWidth = 12; ctx.strokeRect(6, 6, W - 12, H - 12);
  return { canvas: c };
}
function drawPill(text) {
  const H = 60, f = `600 30px ${FONT}`, W = Math.ceil(measure(f, text) + 44), c = cv(W, H + 10), ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(40,38,34,0.88)'; rr(ctx, 0, 0, W, H, H / 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(W / 2 - 8, H - 1); ctx.lineTo(W / 2, H + 10); ctx.lineTo(W / 2 + 8, H - 1); ctx.fill();
  ctx.fillStyle = '#fbf6ea'; ctx.font = f; ctx.textBaseline = 'middle'; ctx.fillText(text, 22, H / 2 + 1);
  return { canvas: c, center: [0.5, 0] };
}
function drawMapLabel(big, small) {
  const bf = `700 112px ${FONT}`, sf = `600 54px ${FONT}`, W = Math.ceil(Math.max(measure(bf, big), small ? measure(sf, small) : 0) + 40), H = small ? 190 : 140, c = cv(W, H), ctx = c.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.font = bf; ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255,253,248,0.95)'; ctx.strokeText(big, W / 2, 112); ctx.fillStyle = '#1c1b19'; ctx.fillText(big, W / 2, 112);
  if (small) { ctx.font = sf; ctx.lineWidth = 8; ctx.strokeText(small, W / 2, 182); ctx.fillStyle = '#3a3732'; ctx.fillText(small, W / 2, 182); }
  return { canvas: c, center: [0.5, 0.5] };
}
function smokeTexture() { const c = cv(64, 64), ctx = c.getContext('2d'), g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); return mkTex(c); }
const TIMES = {
  morgen: { sky: ['#8fb6e0', '#f2d4b8', '#f8e6d4'], sun: '#ffd2a1', si: 1.7, sp: [-0.9, 0.5, 0.7], hemi: ['#ffe9d6', '#7f9a6a', 0.85], glow: 0.7, exp: 1.0 },
  mittag: { sky: ['#6fb1ec', '#b9dcf7', '#e8f3fb'], sun: '#fff3dc', si: 2.1, sp: [0.7, 1.2, 0.9], hemi: ['#fff7ea', '#7fa56a', 1.0], glow: 0.85, exp: 1.0 },
  abend: { sky: ['#24335e', '#7a6190', '#eaa676'], sun: '#ffa765', si: 1.5, sp: [0.95, 0.38, 0.55], hemi: ['#a3a9d6', '#5a6a52', 1.05], glow: 2.6, exp: 1.08 },
};
const MODS_META = { BST: [1, 'Tragwerk & Bau'], HLZ: [2, 'Tragwerk & Bau'], MAT: [1, 'Grundlagen'], VWL: [2, 'Wirtschaft & Recht'], GEO: [3, 'Geotechnik & Umwelt'], BPH: [2, 'Gebäude & Energie'], PRJ: [4, 'Projekt & Prozess'], STB: [3, 'Tragwerk & Bau'], ENG: [1, 'Sprache & Kommunikation'], BWL: [3, 'Wirtschaft & Recht'] };
MODULES.forEach((m) => { m.sem = MODS_META[m.code][0]; m.fach = MODS_META[m.code][1]; });
const BASE_MODULES = MODULES.slice();
// Weitere Module eines Bachelor-Studiengangs (Testdaten), Inhalte deterministisch aus dem Kürzel
const EXTRA = [
  [1, 'PHY', 'Physik', 'Grundlagen'], [1, 'BMK', 'Baumaterialkunde', 'Tragwerk & Bau'], [1, 'DGE', 'Darstellende Geometrie', 'Grundlagen'], [1, 'INF', 'Informatik', 'Grundlagen'], [1, 'KOM', 'Kommunikation', 'Sprache & Kommunikation'],
  [2, 'MA3', 'Mathematik 3', 'Grundlagen'], [2, 'BS2', 'Baustatik 2', 'Tragwerk & Bau'], [2, 'CAD', 'CAD und BIM', 'Projekt & Prozess'], [2, 'EN2', 'Englisch 2', 'Sprache & Kommunikation'], [2, 'TMS', 'Technische Mechanik', 'Grundlagen'],
  [3, 'BET', 'Betonbau 1', 'Tragwerk & Bau'], [3, 'HYD', 'Hydraulik', 'Geotechnik & Umwelt'], [3, 'VER', 'Vermessung', 'Projekt & Prozess'], [3, 'STA', 'Statistik', 'Grundlagen'], [3, 'GBT', 'Gebäudetechnik', 'Gebäude & Energie'],
  [4, 'BE2', 'Betonbau 2', 'Tragwerk & Bau'], [4, 'GRU', 'Grundbau', 'Geotechnik & Umwelt'], [4, 'SWW', 'Siedlungswasserwirtschaft', 'Geotechnik & Umwelt'], [4, 'VKB', 'Verkehrsbau', 'Projekt & Prozess'], [4, 'BAB', 'Baubetrieb', 'Projekt & Prozess'], [4, 'REC', 'Baurecht', 'Wirtschaft & Recht'], [4, 'ENE', 'Energie und Bau', 'Gebäude & Energie'],
  [5, 'BRÜ', 'Brückenbau', 'Tragwerk & Bau'], [5, 'ERD', 'Erdbebeningenieurwesen', 'Tragwerk & Bau'], [5, 'TUN', 'Tunnelbau', 'Geotechnik & Umwelt'], [5, 'WAS', 'Wasserbau', 'Geotechnik & Umwelt'], [5, 'NAC', 'Nachhaltiges Bauen', 'Gebäude & Energie'], [5, 'PRM', 'Projektmanagement', 'Projekt & Prozess'], [5, 'FEM', 'FEM-Methoden', 'Tragwerk & Bau'],
  [6, 'BAT', 'Bachelorarbeit', 'Projekt & Prozess'], [6, 'BES', 'Bauen im Bestand', 'Tragwerk & Bau'], [6, 'UMW', 'Umweltrecht', 'Wirtschaft & Recht'], [6, 'IMM', 'Immobilienökonomie', 'Wirtschaft & Recht'], [6, 'VKP', 'Verkehrsplanung', 'Projekt & Prozess'], [6, 'HOL', 'Holzbau vertieft', 'Tragwerk & Bau'],
];
for (const [sem, code, title, fach] of EXTRA) {
  const h = fnv(code + title), n = h % 10 === 0 ? 0 : (h >>> 3) % 10, items = [], c = new T0Color(h);
  for (let i = 0; i < n; i++) { const kind = KIND_ORDER0[(fnv(code + i) >>> 5) % 6]; items.push(it(kind, KIND_LABEL0[kind] + ' · Woche ' + (i * 2 + 1), sem >= 5 && i === n - 1 && h % 3 === 0)); }
  MODULES.push({ id: (h >>> 0).toString(16) + '-' + code.toLowerCase(), code, title, color: c, items, sem, fach });
}
MODULES.sort((a, b) => a.sem - b.sem);

// ---------- Komponente ----------
const ATTRS = ['paths', 'garden', 'flowers', 'labels', 'count', 'filter', 'view', 'time', 'quarters', 'features', 'plaza', 'qhouses', 'qlayout', 'hud', 'qstyle'];
const SOFT = new Set(['filter', 'view', 'time', 'hud']);
class DorfViewer extends HTMLElement {
  static get observedAttributes() { return ATTRS; }
  constructor() { super(); this.opts = { paths: 'bogen', garden: 'hecke', flowers: 'off', labels: 'kompakt-schild', count: '7', filter: '', view: '3d', time: 'mittag', quarters: 'off', features: '', plaza: 'kreis', qhouses: 'bogen', qlayout: 'kreis', qstyle: 'aus' }; this.cache = new Map(); }
  attributeChangedCallback(n, _, v) { if (v == null) return; this.setOpt(n, String(v)); }
  setOpt(n, v) {
    if (this.opts[n] === v && this.world) return; this.opts[n] = v;
    if (n === 'hud') return this.applyHud();
    if (n === 'filter') this.applyFilter(); else if (n === 'view') this.applyView(true); else if (n === 'time') this.applyTime(); else this.rebuild();
  }
  has(f) { return (this.opts.features || '').split(',').includes(f); }
  connectedCallback() {
    this.style.display = 'block'; this.style.position = 'relative'; this.style.outline = 'none';
    if (!this.style.width) this.style.width = '100%'; if (!this.style.height) this.style.height = '100%';
    this.tabIndex = 0;
    libs.then(() => Promise.all(['500 27px', '600 38px', '700 30px', '600 22px', '700 112px'].map((f) => document.fonts.load(`${f} "IBM Plex Sans"`))).catch(() => {})).then(() => this.init());
  }
  disconnectedCallback() { this.dead = true; if (this.renderer) { this.renderer.setAnimationLoop(null); this.renderer.dispose(); this.ro?.disconnect(); } }
  overlay(css) { const d = document.createElement('div'); d.style.cssText = 'position:absolute;pointer-events:none;font:500 12px "IBM Plex Mono",monospace;color:#3a3732;background:rgba(255,253,248,.9);border-radius:8px;padding:6px 10px;' + css; this.appendChild(d); return d; }
  init() {
    if (this.dead || this.renderer) return;
    const r = (this.renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }));
    r.setPixelRatio(Math.min(2, devicePixelRatio)); r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap; r.toneMapping = T.ACESFilmicToneMapping; r.outputColorSpace = T.SRGBColorSpace;
    r.domElement.style.cssText = 'display:block;width:100%;height:100%;border-radius:inherit';
    this.appendChild(r.domElement);
    this.scene = new T.Scene();
    this.skyCanvas = cv(4, 256); this.scene.background = this.skyTex = mkTex(this.skyCanvas);
    this.camera = new T.PerspectiveCamera(45, 1, 0.1, 900);
    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enableDamping: true, minDistance: 5, maxPolarAngle: Math.PI / 2.15, minPolarAngle: 0.15 });
    this.pathMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    this.glowMat = new T.MeshStandardMaterial({ color: '#ffe9b8', emissive: '#ffb84d', emissiveIntensity: 0.85 });
    this.hitMat = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    this.smokeTex = smokeTexture();
    this.shared = new Set([this.pathMat, this.glowMat, this.hitMat]);
    this.ray = new T.Raycaster(); this.ptr = new T.Vector2(); this.clock = new T.Clock();
    this.hemi = new T.HemisphereLight('#fff7ea', '#7fa56a', 1.0); this.sun = new T.DirectionalLight('#fff3dc', 2.1); this.sun.castShadow = true; this.scene.add(this.hemi, this.sun, this.sun.target);
    this.crumb = document.createElement('div');
    this.crumb.style.cssText = 'position:absolute;top:12px;left:12px;display:flex;align-items:center;gap:2px;padding:4px;border-radius:9px;background:rgba(255,253,248,.94);font:500 13px "IBM Plex Sans",system-ui;box-shadow:0 1px 3px rgba(0,0,0,.15)';
    this.appendChild(this.crumb); this.nav = { level: 'dorf' };
    this.hint = this.overlay('left:12px;bottom:44px'); this.hint.textContent = '← → wählen · Enter öffnen · Esc eine Ebene zurück';
    this.stats = this.overlay('left:12px;bottom:12px');
    this.toastEl = this.overlay('left:50%;top:16px;transform:translateX(-50%);font:500 13px "IBM Plex Sans",system-ui;padding:8px 14px;background:rgba(28,27,25,.9);color:#fbf6ea;opacity:0;transition:opacity .25s');
    this.buildSearch(); this.applyHud();
    let down = null;
    r.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; HTMLElement.prototype.focus.call(this, { preventScroll: true }); this.results.style.display = 'none'; });
    r.domElement.addEventListener('pointermove', (e) => this.onHover(e));
    r.domElement.addEventListener('pointerleave', () => { this.hoverId = null; this.setObjCard(this.pinned || null); });
    r.domElement.addEventListener('pointerup', (e) => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) this.onClick(e); down = null; });
    this.addEventListener('keydown', (e) => { if (e.target.tagName !== 'INPUT') this.onKey(e); });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this); this.resize();
    this.frameN = 0;
    r.setAnimationLoop(() => this.frame());
    this.rebuild();
  }
  buildSearch() {
    const wrap = document.createElement('div'); wrap.style.cssText = 'position:absolute;top:12px;right:12px;width:260px;display:flex;flex-direction:column;gap:4px;font-family:"IBM Plex Sans",system-ui';
    const inp = (this.searchInput = document.createElement('input')); inp.placeholder = 'Haus oder Objekt suchen…';
    inp.style.cssText = 'box-sizing:border-box;width:100%;padding:8px 12px;border:1px solid rgba(28,27,25,.15);border-radius:8px;background:rgba(255,253,248,.96);font:500 13px "IBM Plex Sans",system-ui;color:#1c1b19;outline:none;box-shadow:0 1px 3px rgba(0,0,0,.1)';
    const res = (this.results = document.createElement('div')); res.style.cssText = 'display:none;flex-direction:column;background:rgba(255,253,248,.98);border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.15);overflow:hidden';
    inp.addEventListener('input', () => this.search(inp.value));
    inp.addEventListener('focus', () => inp.value && this.search(inp.value));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && this.hitsList?.[0]) this.choose(this.hitsList[0]); if (e.key === 'Escape') { inp.value = ''; res.style.display = 'none'; inp.blur(); } e.stopPropagation(); });
    wrap.append(inp, res); this.appendChild(wrap);
  }
  search(q) {
    q = q.trim().toLowerCase(); const res = this.results; res.innerHTML = '';
    if (!q) { res.style.display = 'none'; return; }
    const list = [];
    for (const h of this.homes()) {
      if ((h.m.title + ' ' + h.m.code).toLowerCase().includes(q)) list.push({ h, label: h.m.title, sub: h.m.code + ' · ' + countText(h.m.items.length), color: h.m.color });
      for (const item of h.m.items) if ((item.title + ' ' + KIND_LABEL[item.kind]).toLowerCase().includes(q)) list.push({ h, item, label: item.title, sub: KIND_LABEL[item.kind] + ' · ' + h.m.code, color: KIND[item.kind] });
    }
    this.hitsList = list.slice(0, 7);
    if (!list.length) { const d = document.createElement('div'); d.textContent = 'Keine Treffer'; d.style.cssText = 'padding:9px 12px;font-size:13px;color:#7a766d'; res.append(d); }
    for (const x of this.hitsList) {
      const d = document.createElement('button'); d.style.cssText = 'display:flex;gap:10px;align-items:center;padding:8px 12px;border:0;background:transparent;text-align:left;cursor:pointer;font-family:inherit';
      d.onmouseenter = () => (d.style.background = '#efeae0'); d.onmouseleave = () => (d.style.background = 'transparent');
      d.innerHTML = `<span style="width:12px;height:12px;border-radius:3px;flex:none;background:${x.color};box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)"></span><span style="display:flex;flex-direction:column;min-width:0"><span style="font-size:13px;font-weight:600;color:#1c1b19;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x.label}</span><span style="font-size:11.5px;color:#6d6a63">${x.sub}</span></span>`;
      d.onclick = () => this.choose(x); res.append(d);
    }
    res.style.display = 'flex';
  }
  choose(x) { this.results.style.display = 'none'; this.searchInput.blur(); this.goTo(x.h, x.item); }
  goTo(h, item) {
    this.fly(h);
    this.pinned = null; this.clearHighlight();
    if (item) { const hb = this.hits.find((m) => m.userData.art === item); if (hb) { this.pinned = hb; this.setObjCard(hb); this.highlight(hb, KIND[item.kind], 0.62); } }
    else { const hb = this.hits.find((m) => m.userData.house === h && !m.userData.art); if (hb) this.highlight(hb, '#1c1b19', h.plot ? Math.max(h.plot.hw, h.footprint * 2) : h.footprint * 2.4, true); }
  }
  highlight(obj, color, radius, ground) {
    const wp = new T.Vector3(); obj.getWorldPosition(wp);
    const m = new T.Mesh(new T.RingGeometry(radius * 0.86, radius, 48), new T.MeshBasicMaterial({ color, transparent: true, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(wp.x, 0.05, wp.z); m.renderOrder = 5; this.world.add(m); this.hl = { m, t0: this.clock.getElapsedTime() };
  }
  clearHighlight() { if (this.hl) { this.world?.remove(this.hl.m); this.hl.m.geometry.dispose(); this.hl.m.material.dispose(); this.hl = null; } }
  toast(text) { this.toastEl.textContent = text; this.toastEl.style.opacity = '1'; clearTimeout(this.toastT); this.toastT = setTimeout(() => (this.toastEl.style.opacity = '0'), 2600); }
  resize() { if (!this.renderer) return; const w = this.clientWidth || 800, h = this.clientHeight || 600; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  raycast(e, objs) { const b = this.renderer.domElement.getBoundingClientRect(); this.ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); this.ray.setFromCamera(this.ptr, this.camera); return this.ray.intersectObjects(objs, false); }
  pick(e) {
    const hits = this.raycast(e, [...(this.hits || []), ...(this.qhits || [])]); if (!hits.length) return null;
    const art = hits.find((h) => h.object.userData.art);
    if (!art && hits[0].object.userData.quarter) return { quarter: hits[0].object.userData.quarter };
    return art ? { house: art.object.userData.house, art: art.object } : { house: hits[0].object.userData.house, special: hits[0].object.userData.special };
  }
  onClick(e) {
    const special = this.raycast(e, this.specials || [])[0];
    if (special && this.opts.view === '3d') {
      const s = special.object.userData;
      if (s.notice) { const row = Math.floor((640 * (1 - special.uv.y) - 124) / 100), x = this.noticeItems[row]; if (row >= 0 && x) return this.goTo(x.h, x.item); }
      if (s.construction) return this.toast('Hier öffnet sich «Objekt hinzufügen» für ' + s.construction.m.title);
    }
    const p = this.pick(e); if (!p) return;
    if (p.quarter) return this.flyQuarter(p.quarter);
    if (p.art) this.goTo(p.house, p.art.userData.art); else this.fly(p.house);
  }
  onHover(e) {
    if (!this.hits) return; const p = this.pick(e), sp = this.opts.view === '3d' && this.raycast(e, this.specials || [])[0];
    this.renderer.domElement.style.cursor = p || sp ? 'pointer' : '';
    this.hoverId = p && p.house && p.house.ring > 0 && !p.art ? p.house.id : null;
    this.setObjCard(p && p.art ? p.art : this.pinned || null);
  }
  setObjCard(obj) {
    if (this.objCardFor === obj) return;
    this.objCardFor = obj;
    if (this.objCard) { this.world?.remove(this.objCard.sprite); this.objCard.tex.dispose(); this.objCard.mat.dispose(); this.objCard = null; }
    if (!obj || !this.world || this.opts.view !== '3d') return;
    const d = drawObjCard(obj.userData.art, obj.userData.house.m), tex = mkTex(d.canvas), mat = new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: false, toneMapped: false });
    const s = new T.Sprite(mat), wp = new T.Vector3(); obj.getWorldPosition(wp); s.position.set(wp.x, 1.6, wp.z); s.center.set(0.5, 0); s.scale.set(0.052 * (d.canvas.width / d.canvas.height), 0.052, 1); s.renderOrder = 30;
    this.world.add(s); this.objCard = { sprite: s, tex, mat };
  }
  applyHud() { if (!this.stats) return; const off = this.opts.hud === 'off'; this.stats.style.display = off ? 'none' : 'block'; this.hint.style.visibility = off ? 'hidden' : 'visible'; }
  homes() { return (this.houses || []).filter((h) => h.ring > 0); }
  setNav(nav) {
    this.nav = nav; const c = this.crumb; c.innerHTML = '';
    const seg = (label, onClick, strong) => { const b = document.createElement(onClick ? 'button' : 'span'); b.textContent = label; b.style.cssText = 'padding:5px 9px;border:0;border-radius:6px;background:transparent;font:inherit;color:' + (strong ? '#1c1b19;font-weight:600' : '#2f5d4a') + (onClick ? ';cursor:pointer' : ''); if (onClick) { b.onclick = onClick; b.onmouseenter = () => (b.style.background = '#efeae0'); b.onmouseleave = () => (b.style.background = 'transparent'); } c.append(b); };
    const sep = () => { const x = document.createElement('span'); x.textContent = '›'; x.style.color = '#a8a29e'; c.append(x); };
    seg('Dorf', nav.level === 'dorf' ? null : () => this.fly(null), nav.level === 'dorf');
    if (nav.q) { sep(); seg(nav.q.name, nav.level === 'haus' ? () => this.flyQuarter(nav.q) : null, nav.level === 'quartier'); }
    if (nav.h) { sep(); seg(nav.h.m ? nav.h.m.title : 'Zentrale', null, true); }
  }
  up() { if (this.nav.level === 'haus' && this.nav.q) this.flyQuarter(this.nav.q); else this.fly(null); }
  // Quartier wie einen Ordner öffnen: Vogelperspektive nur auf seine Häuser
  flyQuarter(q) {
    const from = { p: this.camera.position.clone(), t: this.controls.target.clone() }, u = { x: Math.cos(q.theta), z: Math.sin(q.theta) };
    let cx = q.x, cz = q.z; for (const h of q.houses) { cx += h.x; cz += h.z; } cx /= q.houses.length + 1; cz /= q.houses.length + 1;
    const R = q.Qr, to = this.opts.view === 'karte' ? { p: new T.Vector3(cx, R * 2.2 + 10, cz + 0.05), t: new T.Vector3(cx, 0, cz) } : { p: new T.Vector3(cx - u.x * (R * 1.25 + 7), R * 1.05 + 8, cz - u.z * (R * 1.25 + 7)), t: new T.Vector3(cx, 0, cz) };
    this.pinned = null; this.clearHighlight(); this.setObjCard(null); this.focusedId = null; this.kbdQ = q; this.kbdId = null;
    this.tween = { from, to, t: 0 }; this.setNav({ level: 'quartier', q });
  }
  onKey(e) {
    const homes = this.homes(); if (!homes.length) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key], quarters = this.qlist || [], nav = this.nav || { level: 'dorf' };
    const cyc = (list, cur) => { const i = list.indexOf(cur); return list[i < 0 ? (step > 0 ? 0 : list.length - 1) : (i + step + list.length) % list.length]; };
    if (step) {
      e.preventDefault();
      if (nav.level === 'dorf' && quarters.length) { this.kbdQ = cyc(quarters, this.kbdQ); return; }
      const pool = nav.q ? nav.q.houses : homes, cur = pool.find((h) => h.id === (this.focusedId ?? this.kbdId)), next = cyc(pool, cur);
      if (nav.level === 'haus') this.fly(next); else this.kbdId = next.id;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (nav.level === 'dorf' && quarters.length && this.kbdQ) return this.flyQuarter(this.kbdQ);
      const h = homes.find((x) => x.id === this.kbdId); if (h) this.fly(h);
    } else if (e.key === 'Escape') { this.kbdId = null; this.up(); }
  }
  gateDist(h) { return h.ring === 0 ? h.footprint * 2 : this.gardens ? h.plot.front : h.footprint * 1.05 + 0.4; }
  fly(h) {
    const from = { p: this.camera.position.clone(), t: this.controls.target.clone() }, map = this.opts.view === 'karte';
    let to;
    if (!h) { to = map ? this.mapPose() : this.overview(); this.pinned = null; this.clearHighlight(); this.setObjCard(null); }
    else if (map) to = { p: new T.Vector3(h.x, 30, h.z + 0.01), t: new T.Vector3(h.x, 0, h.z) };
    else {
      const dx = Math.sin(h.angle), dz = Math.cos(h.angle), gate = this.gateDist(h);
      to = { p: new T.Vector3(h.x + dx * (gate + 6.5), 3.4 + h.footprint * 0.7, h.z + dz * (gate + 6.5)), t: new T.Vector3(h.x + dx * gate * 0.45, 1.1, h.z + dz * gate * 0.45) };
    }
    this.focusedId = h ? h.id : null; if (h) this.kbdId = h.id;
    this.tween = { from, to, t: 0 }; this.setNav(h ? { level: 'haus', q: h.quarter || null, h } : { level: 'dorf' });
  }
  overview() { const e = this.extent; return { p: new T.Vector3(0, e * 1.0 + 11, e * 1.38 + 16), t: new T.Vector3(0, 0, 0) }; }
  mapPose() { return { p: new T.Vector3(0, this.extent * 1.75 + 8, 0.05), t: new T.Vector3(0, 0, 0) }; }
  applyView(animate) {
    if (!this.g3d) return;
    const map = this.opts.view === 'karte';
    this.g3d.visible = !map; this.gmap.visible = map;
    Object.assign(this.controls, map ? { enableRotate: false, minPolarAngle: 0, maxPolarAngle: 0.001 } : { enableRotate: true, minPolarAngle: 0.15, maxPolarAngle: Math.PI / 2.15 });
    this.scene.fog = map ? null : this.fog;
    this.setObjCard(null); this.pinned = null; this.clearHighlight(); this.focusedId = null; this.setNav({ level: 'dorf' });
    this.hint.style.display = map ? 'none' : 'block';
    const to = map ? this.mapPose() : this.overview();
    if (animate) this.tween = { from: { p: this.camera.position.clone(), t: this.controls.target.clone() }, to, t: 0 };
    else { this.camera.position.copy(to.p); this.controls.target.copy(to.t); }
  }
  timeKey() {
    if (this.opts.time !== 'auto') return this.opts.time;
    const hr = new Date().getHours(); return hr >= 5 && hr < 10 ? 'morgen' : hr >= 10 && hr < 18 ? 'mittag' : 'abend';
  }
  applyTime() {
    if (!this.sun || !this.extent) return;
    const t = TIMES[this.timeKey()] || TIMES.mittag, ext = this.extent, ctx = this.skyCanvas.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, t.sky[0]); g.addColorStop(0.55, t.sky[1]); g.addColorStop(1, t.sky[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256); this.skyTex.needsUpdate = true;
    this.sun.color.set(t.sun); this.sun.intensity = t.si; this.sun.position.set(t.sp[0] * ext, t.sp[1] * ext, t.sp[2] * ext);
    this.hemi.color.set(t.hemi[0]); this.hemi.groundColor.set(t.hemi[1]); this.hemi.intensity = t.hemi[2];
    this.glowMat.emissiveIntensity = t.glow; this.renderer.toneMappingExposure = t.exp;
    this.fog.color.set(t.sky[2]);
    if (this.lampLights) this.lampLights.forEach((l) => (l.intensity = this.timeKey() === 'abend' ? 6 : 0));
    this.timeLabel = this.opts.time === 'auto' ? ` · Auto: ${this.timeKey()[0].toUpperCase() + this.timeKey().slice(1)}` : '';
  }
  frame() {
    if (this.tween) { const a = this.tween; a.t = Math.min(1, a.t + 1 / 54); const k = 1 - Math.pow(1 - a.t, 3); this.camera.position.lerpVectors(a.from.p, a.to.p, k); this.controls.target.lerpVectors(a.from.t, a.to.t, k); if (a.t >= 1) this.tween = null; }
    this.controls.update();
    const time = this.clock.getElapsedTime();
    if (this.opts.view === '3d') this.updateLabels();
    for (const s of this.smoke || []) {
      const p = (time * 0.22 + s.phase) % 1; s.sprite.position.set(s.x + p * 0.9 * s.wx, s.y + p * 2.4, s.z + p * 0.9 * s.wz); const sc = 0.35 + p * 1.1; s.sprite.scale.set(sc, sc, 1); s.sprite.material.opacity = Math.sin(p * Math.PI) * 0.55;
    }
    if (this.hl) { const dt = time - this.hl.t0, s = 1 + 0.12 * Math.sin(dt * 5); this.hl.m.scale.set(s, s, s); this.hl.m.material.opacity = dt > 6 ? Math.max(0, 1 - (dt - 6)) : 0.9; if (dt > 7) this.clearHighlight(); }
    this.renderer.render(this.scene, this.camera);
    if (this.frameN++ % 30 === 0) { const i = this.renderer.info.render; this.stats.textContent = `${i.calls} Draw Calls · ${(i.triangles / 1000).toFixed(0)}k Dreiecke${this.timeLabel || ''}`; }
  }
  updateLabels() {
    if (!this.lbl) return;
    const cam = this.camera, el = this.renderer.domElement, Wd = el.clientWidth, Hd = el.clientHeight, k = 1.207 * Hd, active = this.hoverId ?? this.kbdId;
    const fadeNear = this.opts.labels.includes('schild') && this.opts.labels.includes('kompakt'), v = new T.Vector3(), list = [];
    for (const l of this.lbl) {
      const showAlt = !!l.alt && l.id === active;
      if (showAlt !== l.showingAlt) l.show(showAlt);
      const dist = cam.position.distanceTo(l.sprite.position);
      let op = l.dim;
      const nq = this.nav && this.nav.q, lq = l.quarter || (l.h && l.h.quarter) || null;
      if (nq && lq !== nq) op *= 0.3;
      if (nq && l.quarter === nq) op = 0;
      if (this.nav?.level === 'dorf' && this.homes().length > 15 && lq && !l.quarter && !showAlt && l.id !== active) op = 0;
      if (l.quarter && this.nav?.level === 'dorf' && this.kbdQ && this.kbdQ !== l.quarter) op *= 0.55;
      if ((fadeNear && !showAlt && l.alt) || (l.quarter && this.nav?.level !== 'dorf')) op *= Math.min(1, Math.max(0, (dist - 18) / 6));
      l.op = op;
      if (l.bottom && !showAlt && op > 0.02) {
        v.copy(l.sprite.position).project(cam);
        if (v.z < 1) list.push({ l, dist: l.quarter ? -1 : dist, x: ((v.x + 1) / 2) * Wd, y: ((1 - v.y) / 2) * Hd, w: l.sprite.scale.x * k, h: l.sprite.scale.y * k });
      } else l.sprite.center.y = l.cur.center[1];
    }
    list.sort((a, b) => a.dist - b.dist);
    const placed = [];
    for (const it of list) {
      // Höchstens einen Schritt nach oben ausweichen; überdeckt der Chip dann noch, wird er ausgeblendet (nähere haben Vorrang).
      let off = 0, ok = false;
      for (let n = 0; n < 2 && !ok; n++) {
        const r = { x0: it.x - it.w / 2, x1: it.x + it.w / 2, y0: it.y - it.h - off, y1: it.y - off };
        if (!placed.some((p) => r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0)) { placed.push(r); ok = true; } else if (n === 0) off = it.h * 1.06;
      }
      if (!ok) { off = 0; it.l.op = 0; }
      it.l.sprite.center.y = -off / it.h;
      if (ok && off > 0) it.l.op *= 0.85;
    }
    for (const l of this.lbl) l.mat.opacity = l.op;
  }
  clear() {
    this.setObjCard(null); this.pinned = null; this.clearHighlight();
    if (!this.world) return;
    this.world.traverse((o) => {
      if (o.geometry && !o.geometry.userData.keep && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (this.shared.has(m)) return; if (m.map && m.map !== this.smokeTex && m.map !== this.gravel) m.map.dispose(); m.dispose(); });
    });
    this.atlas?.base.dispose();
    this.scene.remove(this.world);
  }
  model(key, build) {
    let m = this.cache.get(key);
    if (!m) { const r = build(); m = { body: merge(r.B), glow: r.G.length ? merge(r.G) : null, top: r.top }; m.body.userData.keep = true; if (m.glow) m.glow.userData.keep = true; this.cache.set(key, m); }
    return m;
  }
  // Mehrere Attributänderungen im selben Frame → ein Neuaufbau
  rebuild() { if (!this.renderer || this._rb) return; this._rb = requestAnimationFrame(() => { this._rb = null; this.doRebuild(); }); }
  doRebuild() {
    if (!this.renderer) return;
    this.clear();
    const o = this.opts, F = (f) => this.has(f), mods = /^s\d$/.test(o.count) ? MODULES.filter((m) => m.sem <= +o.count[1]) : BASE_MODULES.slice(0, +o.count || 7);
    const gardens = (this.gardens = o.garden !== 'none'), quarters = o.quarters !== 'off' && gardens, flowers = o.flowers === 'on';
    const tf = F('klein') ? { 1: 1.1, 2: 1.25, 3: 1.4 } : TF, plazaMin = F('wasser') || F('anschlag') ? 9.4 : ZFP + 3.9;
    const poly = o.plaza === 'eck', L = quarters ? computeQuarters(mods, o.quarters, tf, Math.max(plazaMin, 7), o.qhouses, o.qlayout, poly) : computeLayout(mods, gardens, tf, plazaMin);
    let ringStarts = null;
    if (!quarters && poly) { const homes = L.houses.filter((h) => h.ring > 0), n = Math.max(5, homes.length), pa = polyAssign(homes.map((h) => Math.atan2(h.z, h.x)), n); ringStarts = pa.asg; L.polys = [{ x: 0, z: 0, a: L.plaza, n, rot: pa.rot, used: pa.asg, gap: 3.0, main: true }]; }
    const newSlots = gardens || o.paths !== 'ist';
    let ext = L.extent;
    const river = F('wasser') ? computeRiver(ext, 'dorf-gian') : null;
    this.houses = L.houses; this.qlist = L.quarters || []; this.kbdId = null; this.kbdQ = null; this.focusedId = null; this.extent = ext;
    this.hits = []; this.qhits = [];
    const W = (this.world = new T.Group()), base = new T.Group(), g3d = (this.g3d = new T.Group()), gmap = (this.gmap = new T.Group()); W.add(base, g3d, gmap); this.scene.add(W);
    const sun = this.sun; Object.assign(sun.shadow.camera, { near: 1, far: ext * 4, left: -(ext + 14), right: ext + 14, top: ext + 14, bottom: -(ext + 14) }); if (sun.shadow.mapSize.x !== 4096) { sun.shadow.mapSize.set(4096, 4096); sun.shadow.map?.dispose(); sun.shadow.map = null; } sun.shadow.radius = 3; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.camera.updateProjectionMatrix();
    const d0 = Math.hypot(ext + 11, ext * 1.38 + 16);
    this.fog = F('wald') ? new T.Fog('#e8f3fb', d0 + ext * 0.4, d0 + ext * 2.2) : new T.Fog('#d9ebf8', ext * 1.6, ext * 4.5);
    this.controls.maxDistance = ext * 2.4 + 30;
    const hills = F('huegel'), H = (x, z) => terrainH(x, z, ext, hills);
    // Boden: Gitter mit Höhe und Farbverlauf (Hügel) oder flache Scheiben (Ist)
    if (hills || F('wald')) {
      const size = 2 * (ext + 140), gg = new T.PlaneGeometry(size, size, 180, 180); gg.rotateX(-Math.PI / 2);
      const pa = gg.attributes.position, cols = [], cIn = new T.Color('#86bf6c'), cOut = new T.Color('#9ccc82'), cHi = new T.Color('#b4cf86'), c = new T.Color();
      for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i), y = H(x, z), r = Math.hypot(x, z); pa.setY(i, y - 0.03); c.copy(cIn).lerp(cOut, smooth((r - ext - 4) / 8)).lerp(cHi, Math.min(1, y / 5) * 0.6); cols.push(c.r, c.g, c.b); }
      gg.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); gg.computeVertexNormals();
      const gm = new T.Mesh(gg, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); gm.receiveShadow = true; base.add(gm);
    }
    const disc = (r, y, col, ring, parent = base, pos) => { const m = new T.Mesh(ring ? new T.RingGeometry(ring, r, 64) : new T.CircleGeometry(r, 64), new T.MeshStandardMaterial({ color: col })); m.rotation.x = -Math.PI / 2; m.position.set(pos?.x || 0, y, pos?.z || 0); m.receiveShadow = true; parent.add(m); return m; };
    if (!hills && !F('wald')) { disc(ext + 40, -0.03, '#9ccc82'); disc(ext + 8, -0.01, '#86bf6c'); }
    const mainPoly = (L.polys || []).find((p) => p.main);
    if (mainPoly) base.add(...polyPlaza(mainPoly, '#c9bfa2', '#a8a29e')); else { disc(L.plaza + 0.1, 0.004, '#c9bfa2'); disc(L.plaza + 0.1, 0.008, '#a8a29e', L.plaza - 0.3); }
    for (const q of L.quarters || []) { const pq = (L.polys || []).find((p) => p.q === q); if (pq) base.add(...polyPlaza(pq, q.color.plaza, q.color.edge)); else { disc(q.rp + 0.1, 0.004, q.color.plaza, null, base, q); disc(q.rp + 0.1, 0.009, q.color.edge, q.rp - 0.25, base, q); } const qh = new T.Mesh(cyl(q.rp + 0.4, q.rp + 0.4, 0.4, 16), this.hitMat); qh.position.set(q.x, 0.2, q.z); qh.userData.quarter = q; g3d.add(qh); this.qhits.push(qh); }
    if (river) { const rm = new T.Mesh(merge(riverParts(river)), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05 })); rm.receiveShadow = true; base.add(rm); }
    // Wege
    const reach = (h) => (gardens ? h.plot.front : o.paths === 'ist' ? h.footprint * 1.05 + 0.55 : h.footprint * 1.05 + 0.42);
    const paths = quarters ? quarterPaths(L, reach) : o.paths === 'ist' ? istPaths(L.houses, L.plaza, reach) : newPaths(L.houses, L.plaza, o.paths, reach, ringStarts);
    const pathPartsList = [], texGeos = [];
    for (const p of paths) {
      if (p.kind === 'neu' && F('belag')) {
        const w = p.width || PATH_W, col = p.color || { main: '#d3cbb5', edge: '#aaa188' };
        texGeos.push(texRibbon(p.points, (acc) => w * (1 + 0.7 * Math.max(0, 1 - acc / 1.6) ** 2 + 0.025 * Math.sin(acc * 0.6 + p.seed)), col.main, col.edge, '#86bf6c', p.seed));
      } else pathPartsList.push(...pathParts([p], p.color));
    }
    if (pathPartsList.length) { const pm = new T.Mesh(merge(pathPartsList), this.pathMat); pm.receiveShadow = true; base.add(pm); }
    if (texGeos.length) {
      this.gravel ??= gravelTexture();
      const cat = (k, n) => { const out = new Float32Array(texGeos.reduce((s2, g) => s2 + g.attributes[k].array.length, 0)); let o2 = 0; for (const g of texGeos) { out.set(g.attributes[k].array, o2); o2 += g.attributes[k].array.length; } return new T.BufferAttribute(out, n); };
      const tg = new T.BufferGeometry(); tg.setAttribute('position', cat('position', 3)); tg.setAttribute('normal', cat('normal', 3)); tg.setAttribute('color', cat('color', 3)); tg.setAttribute('uv', cat('uv', 2)); tg.computeBoundingSphere(); texGeos.forEach((g) => g.dispose());
      const tm = new T.Mesh(tg, new T.MeshStandardMaterial({ vertexColors: true, map: this.gravel, roughness: 0.97 })); tm.receiveShadow = true; base.add(tm);
    }
    // Umgebung der Zentrale und Strassenlaternen
    const inPlotAny = (x, z, m) => L.houses.some((h) => { if (!h.plot) return false; const dx = x - h.x, dz = z - h.z, c = Math.cos(h.angle), sn = Math.sin(h.angle), lx = dx * c - dz * sn, lz = dx * sn + dz * c; return Math.abs(lx) < h.plot.hw + m && lz > -h.plot.back - m && lz < h.plot.front + m; });
    const lamps = [], tooClose = (x, z, d) => lamps.some((l) => Math.hypot(l.x - x, l.z - z) < d), plazaDeco = [], roundTrees = [];
    this.lampLights = [];
    if (mainPoly) {
      const p = mainPoly, n = p.n, R = p.a / Math.cos(Math.PI / n), side = 2 * p.a * Math.tan(Math.PI / n);
      plazaDeco.push(...terraceParts(p));
      for (let k = 0; k < n; k++) {
        const a = p.rot + (TAU * k) / n, used = p.used.some((u) => angDiff(u, a) < 0.02), c = { x: Math.cos(a), z: Math.sin(a) }, t = { x: -c.z, z: c.x }, d = p.a - 0.75;
        if (used) for (const sg of [-1, 1]) { const o = sg * (p.gap / 2 + 0.45); lamps.push(lampSpot(c.x * d + t.x * o, c.z * d + t.z * o)); }
        else {
          const bd = p.a - 1.5; plazaDeco.push(...benchParts(c.x * bd, c.z * bd, Math.atan2(-c.x, -c.z) + Math.PI));
          for (const sg of [-1, 1]) { const o = sg * side * 0.28; lamps.push(lampSpot(c.x * d + t.x * o, c.z * d + t.z * o)); }
        }
        // Pflanzkübel mit Baum in jeder Ecke, Baumring ausserhalb
        const b = p.rot + Math.PI / n + (TAU * k) / n, pr = R - 1.25, px = Math.cos(b) * pr, pz = Math.sin(b) * pr;
        plazaDeco.push(P(cyl(0.6, 0.52, 0.5, 14), '#b9b1a0', [px, 0.25, pz]), P(cyl(0.5, 0.5, 0.04, 14), '#6b5240', [px, 0.5, pz]), P(cyl(0.07, 0.1, 1.2, 6), '#6b4423', [px, 1.1, pz]), P(new T.IcosahedronGeometry(0.75, 1), '#5c9b4f', [px, 2.0, pz], [0.4, k, 0]), P(new T.IcosahedronGeometry(0.5, 1), '#6aa95a', [px + 0.25, 2.45, pz - 0.15]));
        for (const [ang, rr] of [[b, R + 3.0], [a, p.a + 3.2]]) {
          const tx = Math.cos(ang) * rr, tz = Math.sin(ang) * rr;
          if (paths.some((q) => distPoly(tx, tz, q.points) < 2.6) || inPlotAny(tx, tz, 1) || (L.quarters || []).some((q) => Math.hypot(q.x - tx, q.z - tz) < q.rp + 2)) continue;
          roundTrees.push({ x: tx, z: tz, s: 1.0 + jit(k, ang) * 0.25 });
        }
      }
      lamps.slice(0, 10).forEach((l, i) => { if (i % 2 === 0) { const pl = new T.PointLight('#ffc173', 0, 10, 1.6); pl.position.set(l.x, 2.4, l.z); g3d.add(pl); this.lampLights.push(pl); } });
    } else {
      const lr = L.plaza - 1.1, lc = Math.max(6, Math.round((TAU * lr) / 5.5));
      for (let i = 0; i < lc; i++) { const a = (i / lc) * TAU + Math.PI / lc; lamps.push(lampSpot(Math.cos(a) * lr, Math.sin(a) * lr)); }
    }
    // Nebenplätze: Laterne an jeder zweiten Ecke
    const lr = seeded('laternen');
    for (const p of (L.polys || []).filter((x) => x.q)) { const R = p.a / Math.cos(Math.PI / p.n); let placed = 0; for (let i = 0; i < p.n; i++) { if (lr() > 0.45 && !(i === p.n - 1 && placed < 2)) continue; const b = p.rot + Math.PI / p.n + (TAU * i) / p.n, rr = R - 0.35 - lr() * 0.3; lamps.push(lampSpot(p.x + Math.cos(b) * rr, p.z + Math.sin(b) * rr)); placed++; } }
    // Entlang der Wege: alle ~9 m, abwechselnd links und rechts
    paths.forEach((pp, pi) => {
      // Abstand 6–14 m, Seite zufällig, leicht unterschiedlicher Abstand zum Wegrand, manche Stellen bleiben dunkel
      const tot = plen(pp.points), w0 = (pp.width || PATH_W) / 2;
      for (let sd = 2.5 + lr() * 5; sd < tot - 2.5; sd += 6 + lr() * 8) {
        if (lr() < 0.2) continue;
        const a = along(pp.points, sd), sg = lr() < 0.5 ? 1 : -1, w = w0 + 0.45 + lr() * 0.5, x = a.x + Math.cos(a.angle) * w * sg, z = a.z - Math.sin(a.angle) * w * sg;
        if (Math.hypot(x, z) < L.plaza + 1.5 || inPlotAny(x, z, 0.4) || tooClose(x, z, 4) || paths.some((q, qi) => qi !== pi && distPoly(x, z, q.points) < (q.width || PATH_W) / 2 + 0.3)) continue;
        lamps.push(lampSpot(x, z));
      }
    });
    if (plazaDeco.length) { const pd = new T.Mesh(merge(plazaDeco), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })); pd.castShadow = pd.receiveShadow = true; g3d.add(pd); }
    this.addLamps(g3d, lamps); this.addRoundTrees(g3d, roundTrees);
    this.lbl = []; this.houseMats = []; this.kindMats = []; this.specials = []; this.smoke = [];
    const hedge = [], atlasEntries = [], labelSpecs = [], mapSpecs = [], mm = new T.Matrix4(), q4 = new T.Quaternion(), eu = new T.Euler(), vp = new T.Vector3(), vs = new T.Vector3();
    const attachBoard = (parent, entry, w, h, pos, rot, special) => {
      atlasEntries.push(entry);
      // Holzkörper + Vorderseite als Ebene: 2 Draw Calls statt 6 (Box mit Material pro Seite)
      const board = new T.Mesh(box(w, h, 0.07), new T.MeshStandardMaterial({ color: '#7a5233', roughness: 0.9 })); board.position.set(...pos); if (rot) board.rotation.y = rot; board.castShadow = true; parent.add(board);
      const face = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ color: '#7a5233', roughness: 0.85 })); face.position.z = 0.036; board.add(face);
      if (special) { face.userData = special; this.specials.push(face); }
      entry.onReady = () => { face.material.color.set('#ffffff'); face.material.map = entry.tex; face.material.needsUpdate = true; };
    };
    const mkGroup = (parent, h) => { const g = new T.Group(); g.position.set(h.x, 0, h.z); g.rotation.y = h.angle; parent.add(g); g.updateMatrix(); return g; };
    const pal = F('palette');
    for (const h of L.houses) {
      const g = mkGroup(g3d, h), gb = mkGroup(base, h), gm = mkGroup(gmap, h), lift = h.ring === 0 && mainPoly ? (g.position.y = 0.22, g.updateMatrix(), 0) : 0, rnd = seeded(h.id + 'g'), houseMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
      this.houseMats.push({ mat: houseMat, h });
      let mdl;
      if (h.ring === 0) {
        mdl = this.model('z|' + flowers, () => rathaus(flowers));
        const mp = new T.Mesh(box(ZFP * 2.6, 0.06, ZFP * 1.7), new T.MeshStandardMaterial({ color: '#efe6d4' })); mp.position.y = 0.05; gm.add(mp);
        mapSpecs.push({ pos: new T.Vector3(0, 0.3, 0), d: drawMapLabel('Zentrale', null), hh: 2.2 });
      } else {
        const m = h.m, n = m.items.length, act = newCount(m) > 0, fs = o.qstyle !== 'aus' && FACH_STYLE[m.fach], vary = (c) => darken(c, 0.9 + ((fnv(m.id) >>> 7) % 20) / 100), pc = fs ? { wall: vary(fs.wall), roof: vary(fs.roof), accent: fs.accent } : paletteFor(m, pal), htype = fs && o.qstyle === 'typ' ? fs.type : 'haus', chim = h.tier >= 2 || (F('rauch') && act);
        mdl = this.model([htype, h.tier, h.footprint, pc.wall, pc.roof, pc.accent, flowers, chim, n === 0].join('|'), () => (n === 0 ? baustelle(h.footprint) : htype === 'haus' ? hausModel(h.footprint, h.tier, pc.wall, pc.roof, flowers, pc.accent, chim) : TYPE_MODELS[htype](h.footprint, h.tier, pc.wall, pc.roof, pc.accent)));
        const slots = newSlots ? h.plot.slots : istSlots(n, h.footprint).map((s, i) => ({ ...s, item: m.items[i] }));
        const byKind = {};
        slots.forEach((s) => (byKind[s.item.kind] ??= []).push(...objParts(s.item, s.x, s.z, F('objekte'))));
        for (const [kind, parts] of Object.entries(byKind)) {
          const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 }), me = new T.Mesh(merge(parts), mat); me.castShadow = me.receiveShadow = true; g.add(me);
          this.kindMats.push({ mat, kind, h });
        }
        slots.forEach((s) => { const hb = new T.Mesh(box(0.7, 1.2, 0.7), this.hitMat); hb.position.set(s.x, 0.6, s.z); hb.userData = { house: h, art: s.item }; g.add(hb); this.hits.push(hb); const sq = new T.Mesh(box(0.6, 0.05, 0.6), new T.MeshStandardMaterial({ color: KIND[s.item.kind] })); sq.position.set(s.x, 0.06, s.z); gm.add(sq); });
        const GB = [], GG = [];
        if (gardens) {
          const pl = h.plot, lawn = new T.Mesh(new T.PlaneGeometry(pl.hw * 2, pl.front + pl.back), new T.MeshStandardMaterial({ color: '#9fcf83' }));
          lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0.006, (pl.front - pl.back) / 2); lawn.receiveShadow = true; gb.add(lawn);
          this.houseMats.push({ mat: lawn.material, h, base: '#9fcf83' });
          const inst = [], f = fenceParts(pl, o.garden, rnd, inst, act); GB.push(...f.out); GG.push(...f.glow);
          for (const it of inst) { eu.set(...it.rot); q4.setFromEuler(eu); mm.compose(vp.set(...it.pos), q4, vs.set(...it.scale)); hedge.push({ m: new T.Matrix4().multiplyMatrices(g.matrix, mm), color: it.color }); }
          const z0 = h.footprint * 1.05 + 0.55;
          for (let z = pl.front - 0.35; z > z0 - 0.01; z -= 0.78) GB.push(P(box(1.05, 0.05, 0.56), rnd() > 0.5 ? '#d8d1c3' : '#cdc6b7', [(rnd() - 0.5) * 0.08, 0.03, z], [0, (rnd() - 0.5) * 0.12, 0]));
          GB.push(...bedParts(slots));
          const side = -(h.tier === 3 ? pl.hw - 0.95 : (h.footprint * 1.05 + pl.hw) / 2);
          if (h.tier >= 2) GB.push(...benchParts(side, h.tier === 3 ? 0.4 : -h.footprint * 0.3, Math.PI / 2));
          if (h.tier === 3) GB.push(...treeParts(side, -(pl.back - 1.0)));
          // Karte: Grundstückskante
          const frame = [[pl.hw * 2, 0.15, 0, -pl.back], [pl.hw * 2, 0.15, 0, pl.front], [0.15, pl.front + pl.back, -pl.hw, (pl.front - pl.back) / 2], [0.15, pl.front + pl.back, pl.hw, (pl.front - pl.back) / 2]];
          const fm = new T.Mesh(merge(frame.map(([w, d, x, z]) => P(box(w, 0.04, d), '#3f7d42', [x, 0.03, z]))), new T.MeshStandardMaterial({ vertexColors: true })); gm.add(fm);
        }
        if (o.labels.includes('schild') && n > 0) {
          const sx = -(GATE + 0.75), sz = (gardens ? h.plot.front : h.footprint * 1.05 + 1.3) + 0.4;
          for (const s of [-0.62, 0.62]) GB.push(P(box(0.1, 1.55, 0.1), '#5e3c22', [sx + s, 0.78, sz]));
          attachBoard(g, drawBoard(m), 1.6, 0.8, [sx, 1.12, sz + 0.06]);
        }
        if (n === 0 && F('bauschild')) {
          const sx = 1.7, sz = gardens ? h.plot.front - 1.2 : h.footprint * 1.05 + 1.6;
          for (const s of [-0.62, 0.62]) GB.push(P(box(0.08, 1.4, 0.08), '#3f3f46', [sx + s, 0.7, sz]));
          attachBoard(g, drawConstruction(), 1.5, 0.94, [sx, 1.05, sz + 0.05], 0, { construction: h });
        } else if (n === 0 && o.labels.includes('schild')) {
          const sx = -(GATE + 0.75), sz = (gardens ? h.plot.front : h.footprint * 1.05 + 1.3) + 0.4;
          for (const s of [-0.62, 0.62]) GB.push(P(box(0.1, 1.55, 0.1), '#5e3c22', [sx + s, 0.78, sz]));
          attachBoard(g, drawBoard(m), 1.6, 0.8, [sx, 1.12, sz + 0.06]);
        }
        if (GB.length) { const gmesh = new T.Mesh(merge(GB), houseMat); gmesh.castShadow = gmesh.receiveShadow = true; g.add(gmesh); }
        if (GG.length) g.add(new T.Mesh(merge(GG), this.glowMat));
        // Kaminrauch bei Aktivität der letzten Tage
        if (F('rauch') && act && n > 0 && (htype === 'haus' || htype === 'block')) {
          const fp = h.footprint, d = fp * 2.1, local = new T.Vector3(fp * 0.55, 0.18 + fp * 1.5 + fp * 0.95, -d * 0.18).applyMatrix4(g.matrix), wind = { x: 0.7, z: -0.7 };
          for (let i = 0; i < 6; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: this.smokeTex, transparent: true, depthWrite: false, color: '#f4f4f2' })); g3d.add(sp); this.smoke.push({ sprite: sp, x: local.x, y: local.y, z: local.z, wx: wind.x, wz: wind.z, phase: i / 6 }); }
        }
        // Karte: Grundriss und grosses Kürzel
        const hw2 = h.tier === 3 ? h.footprint * 3.15 : h.footprint * 2, mp = new T.Mesh(box(hw2, 0.08, h.footprint * 2.1), new T.MeshStandardMaterial({ color: n ? darken(pc.accent || m.color, 0.8) : '#e8c98f' }));
        mp.position.set(h.tier === 3 ? h.footprint * 0.575 : 0, 0.06, 0); gm.add(mp);
        mapSpecs.push({ pos: new T.Vector3(h.x, 0.4, h.z), d: drawMapLabel(m.code, m.title), hh: 2.4 });
      }
      const bm = new T.Mesh(mdl.body, houseMat); bm.castShadow = bm.receiveShadow = true; g.add(bm);
      if (mdl.glow) g.add(new T.Mesh(mdl.glow, this.glowMat));
      const fp = h.footprint, hit = new T.Mesh(box(fp * 3.2, mdl.top, fp * 3.2), this.hitMat); hit.position.y = mdl.top / 2; hit.userData.house = h; g.add(hit); this.hits.push(hit);
      const pos = new T.Vector3(h.x, mdl.top + 1, h.z);
      if (h.ring === 0) labelSpecs.push({ h, pos, base: o.labels === 'ist' ? drawIst('Gian', null) : drawPill('Gian · Zentrale'), bh: o.labels === 'ist' ? 0.05 : 0.034 });
      else if (o.labels === 'ist') labelSpecs.push({ h, pos, base: drawIst(h.m.title, String(h.m.items.length)), bh: 0.04 });
      else if (o.labels === 'karte') labelSpecs.push({ h, pos: pos.setY(mdl.top + 0.5), base: drawCard(h.m), bh: 0.062 });
      else if (o.labels.includes('kompakt')) labelSpecs.push({ h, pos: pos.setY(mdl.top + 0.5), base: drawChip(h.m), bh: 0.032, alt: drawCard(h.m), ah: 0.062 });
    }
    // Platz: Brunnen und Anschlagbrett
    const plazaParts = [];
    if (F('wasser')) { const fpos = polar(Math.PI / 2 + 0.78, mainPoly ? 7.2 : 6.4); plazaParts.push(...fountainParts(fpos.x, fpos.z)); }
    if (F('anschlag')) {
      const a = Math.PI / 2 - 0.78, bp = polar(a, mainPoly ? 7.3 : 6.6), rot = Math.atan2(Math.cos(a), Math.sin(a)), ng = new T.Group(); ng.position.set(bp.x, 0, bp.z); ng.rotation.y = rot; g3d.add(ng);
      const parts = []; for (const s of [-1.2, 1.2]) parts.push(P(box(0.14, 2.3, 0.14), '#5e3c22', [s, 1.15, 0])); parts.push(P(gable(2.9, 0.45, 0.6), '#8a5a44', [0, 2.3, 0], [0, Math.PI / 2, 0]));
      const nm = new T.Mesh(merge(parts), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })); nm.castShadow = true; ng.add(nm);
      this.noticeItems = []; for (const h of this.homes()) h.m.items.forEach((item) => item.neu && this.noticeItems.push({ h, item, m: h.m }));
      attachBoard(ng, drawNotice(this.noticeItems), 2.3, 1.44, [0, 1.38, 0.08], 0, { notice: true });
    }
    if (plazaParts.length) { const pm2 = new T.Mesh(merge(plazaParts), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })); pm2.castShadow = pm2.receiveShadow = true; g3d.add(pm2); }
    // Quartiere: Tafel am Nebenplatz und Name
    for (const q of L.quarters || []) {
      const qg = new T.Group(), u = { x: Math.cos(q.theta), z: Math.sin(q.theta) }; qg.position.set(q.x + u.x * 0.4, 0, q.z + u.z * 0.4); qg.rotation.y = Math.atan2(-u.x, -u.z); g3d.add(qg);
      const pp = []; for (const s of [-2.35, 2.35]) pp.push(P(box(0.18, 3.9, 0.18), '#5e3c22', [s, 1.95, 0])); pp.push(P(box(5.2, 0.14, 0.34), '#5e3c22', [0, 3.96, 0.04]));
      qg.add(new T.Mesh(merge(pp), new T.MeshStandardMaterial({ vertexColors: true })));
      attachBoard(qg, drawQuarterBoard(q), 4.8, 2.4, [0, 2.6, 0.14]); qg.children[qg.children.length - 1].rotation.x = -0.28;
      labelSpecs.push({ h: { id: 'q' + q.name, qref: q }, pos: new T.Vector3(q.x, 3.4, q.z), base: drawPill(q.name), bh: 0.03, quarter: q });
      mapSpecs.push({ pos: new T.Vector3(q.x, 0.5, q.z), d: drawMapLabel(q.name, null), hh: 2.0 });
    }
    for (const s of labelSpecs) { atlasEntries.push(s.base); if (s.alt) atlasEntries.push(s.alt); }
    for (const s of mapSpecs) atlasEntries.push(s.d);
    this.atlas = buildAtlas(atlasEntries);
    atlasEntries.forEach((e) => e.onReady?.());
    for (const s of labelSpecs) { const l = this.sprite(g3d, s); l.quarter = s.quarter || null; if (l.quarter) { l.sprite.userData.quarter = l.quarter; this.qhits.push(l.sprite); } this.lbl.push(l); }
    for (const s of mapSpecs) { const sp = new T.Sprite(new T.SpriteMaterial({ map: s.d.tex, transparent: true, depthTest: false, toneMapped: false })); sp.position.copy(s.pos); sp.scale.set(s.hh * s.d.aspect, s.hh, 1); sp.renderOrder = 10; gmap.add(sp); }
    if (hedge.length) {
      const im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: '#fff', roughness: 0.95 }), hedge.length), col = new T.Color();
      hedge.forEach((x, i) => { im.setMatrixAt(i, x.m); im.setColorAt(i, col.set(x.color)); }); im.castShadow = im.receiveShadow = true; g3d.add(im);
    }
    this.nature(g3d, L, paths, flowers, gardens, ext, H, river);
    if (!this.started || this.lastExt !== ext) { this.started = true; this.lastExt = ext; this.applyView(false); } else this.applyView(false);
    this.applyTime(); this.applyFilter();
  }
  addLamps(W, spots) {
    if (!spots.length) return;
    const parts = [[cyl(0.13, 0.16, 0.28, 10), '#34343a', 0.14], [cyl(0.045, 0.06, 2.3, 8), '#3f3f46', 1.43], [box(0.26, 0.05, 0.26), '#2f2f35', 2.6], [new T.ConeGeometry(0.22, 0.2, 4), '#2f2f35', 2.72]];
    const d = new T.Object3D();
    for (const [geo, col, y] of parts) {
      const im = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ color: col, roughness: 0.6 }), spots.length); im.castShadow = true;
      spots.forEach((s, i) => { d.position.set(s.x, y, s.z); d.rotation.set(0, Math.PI / 4, 0); d.scale.set(1, 1, 1); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }); W.add(im);
    }
    const gl = new T.InstancedMesh(box(0.18, 0.24, 0.18), this.glowMat, spots.length);
    spots.forEach((s, i) => { d.position.set(s.x, 2.45, s.z); d.rotation.set(0, Math.PI / 4, 0); d.updateMatrix(); gl.setMatrixAt(i, d.matrix); }); W.add(gl);
  }
  addRoundTrees(W, spots) {
    if (!spots.length) return;
    const d = new T.Object3D(), col = new T.Color(), G = ['#5c9b4f', '#4f8f47', '#68a658'];
    const mk = (geo, color, y, sc, colors) => { const im = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ color: '#fff', roughness: 0.85 }), spots.length); im.castShadow = true; spots.forEach((s, i) => { d.position.set(s.x, y * s.s, s.z); d.rotation.set(colors ? 0.3 : 0, i, 0); d.scale.set(s.s * sc[0], s.s * sc[1], s.s * sc[0]); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, col.set(colors ? colors[i % colors.length] : color)); }); W.add(im); };
    mk(cyl(0.14, 0.2, 2.0, 8), '#6b4423', 1.0, [1, 1]);
    mk(new T.IcosahedronGeometry(1.25, 1), null, 2.7, [1, 0.9], G);
    mk(new T.IcosahedronGeometry(0.8, 1), null, 3.5, [1, 1], G.slice().reverse());
  }
  sprite(W, s) {
    const mat = new T.SpriteMaterial({ map: s.base.tex, transparent: true, depthTest: false, sizeAttenuation: false, toneMapped: false });
    const sp = new T.Sprite(mat); sp.position.copy(s.pos); sp.renderOrder = 10; W.add(sp);
    const l = { id: s.h.id, h: s.h, sprite: sp, mat, alt: s.alt, dim: 1, op: 1, bottom: s.base.center[1] === 0, showingAlt: false };
    l.show = (on) => { const x = on ? s.alt : s.base, hh = on ? s.ah : s.bh; l.cur = x; l.showingAlt = on; mat.map = x.tex; mat.needsUpdate = true; sp.center.set(...x.center); sp.scale.set(hh * x.aspect, hh, 1); sp.renderOrder = on ? 20 : 10; };
    l.show(false);
    return l;
  }
  applyFilter() {
    if (!this.houseMats) return;
    const f = this.opts.filter, has = (h) => !f || !h.m || h.m.items.some((i) => i.kind === f);
    for (const { mat, h, base } of this.houseMats) mat.color.set(has(h) ? base || '#ffffff' : base ? '#8a9a82' : '#8d8d8d');
    for (const { mat, kind, h } of this.kindMats) {
      const match = f && kind === f;
      mat.color.set(!f || match ? '#ffffff' : has(h) ? '#9a9a9a' : '#7a7a7a');
      mat.emissive.set(match ? KIND[kind] : '#000000'); mat.emissiveIntensity = match ? 0.45 : 0;
    }
    for (const l of this.lbl || []) l.dim = has(l.h) ? 1 : 0.28;
  }
  nature(W, L, paths, flowers, gardens, ext, H, river) {
    const inPlot = (x, z, m) => L.houses.some((h) => { if (!h.plot) return false; const dx = x - h.x, dz = z - h.z, c = Math.cos(h.angle), s = Math.sin(h.angle), lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) < h.plot.hw + m && lz > -h.plot.back - m && lz < h.plot.front + m; });
    const scatter = (seed, count, minR, maxR, hc, pc) => {
      const rnd = seeded('dorf-gian' + seed), out = []; let guard = 0;
      while (out.length < count && guard++ < count * 40) {
        const r = minR + rnd() * (maxR - minR), a = rnd() * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
        const bl = Math.hypot(x, z) < L.plaza + 1.5 || L.houses.some((h) => Math.hypot(h.x - x, h.z - z) < h.footprint * 2 + hc) || paths.some((p) => distPoly(x, z, p.points) < pc) || (gardens && inPlot(x, z, 0.8)) || (L.quarters || []).some((q) => Math.hypot(q.x - x, q.z - z) < q.rp + 1.5) || (river && distPoly(x, z, river.points) < river.width / 2 + 1.6);
        if (!bl) out.push({ x, z, y: H(x, z), s: 0.75 + rnd() * 0.6, r: rnd() * Math.PI * 2, c: rnd() });
      }
      return out;
    };
    const inst = (geo, spots, place, colors, shadow = true) => {
      if (!spots.length) return; const m = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ color: '#fff', roughness: 0.85 }), spots.length); m.castShadow = shadow;
      const d = new T.Object3D(), col = new T.Color();
      spots.forEach((s, i) => { const p = place(s); d.position.set(s.x, p.y + s.y - 0.05, s.z); d.rotation.set(0, s.r, 0); d.scale.set(p.sx, p.sy, p.sx); d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.setColorAt(i, col.set(colors[Math.floor(s.c * colors.length) % colors.length])); });
      W.add(m);
    };
    const G = ['#4f9a58', '#3f8a4e', '#5ba861', '#468f55'];
    let trees = scatter('t', 46, 8, ext + 14, 5, 3.2);
    if (this.has('wald')) trees = trees.concat(scatter('w', 230, ext + 9, ext + 46, 5, 3.2).map((s) => ({ ...s, s: s.s * 1.25 })));
    const bushes = scatter('b', 40, 5, ext + 8, 3, 2.2), rocks = scatter('r', 18, 6, ext + 10, 3, 2);
    inst(cyl(0.12, 0.2, 1.1, 8), trees, (s) => ({ y: 0, sx: s.s, sy: s.s }), ['#6b4423', '#7a4f2a']);
    inst(new T.ConeGeometry(0.95, 1.5, 9), trees, (s) => ({ y: 0.9 * s.s, sx: s.s, sy: s.s }), G);
    inst(new T.ConeGeometry(0.68, 1.3, 9), trees, (s) => ({ y: 1.75 * s.s, sx: s.s, sy: s.s }), G);
    inst(new T.IcosahedronGeometry(0.8, 1), bushes, (s) => ({ y: 0.22 * s.s, sx: s.s * 0.6, sy: s.s * 0.5 }), ['#5aa65e', '#6cb56a', '#4d9a55']);
    inst(new T.DodecahedronGeometry(1, 0), rocks, (s) => ({ y: 0.1 * s.s, sx: s.s * 0.35, sy: s.s * 0.25 }), ['#9ca3af', '#a8a29e', '#b6b0a6']);
    if (flowers) inst(sph(0.1, 6), scatter('f', 120, 6, ext + 6, 2.4, 1.6), () => ({ y: 0.08, sx: 0.9, sy: 0.9 }), ['#f472b6', '#fbbf24', '#ffffff', '#fb7185', '#a78bfa'], false);
  }
}
for (const k of ATTRS) {
  Object.defineProperty(DorfViewer.prototype, k, { configurable: true, get() { return this.opts?.[k]; }, set(v) { if (v == null || !this.opts) return; this.setOpt(k, String(v)); } });
}
customElements.define('dorf-viewer', DorfViewer);
