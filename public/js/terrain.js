// ภูมิประเทศจังหวัดชลบุรี (ย่อส่วน 1 หน่วย ≈ 50 เมตร) สร้างจากพิกัดจริง lat/lon
// ทิศเหนือ = -z, ทิศตะวันออก = +x, อ่าวไทยอยู่ทางตะวันตก

// ขยายไปทางตะวันออกให้ครอบคลุมอำเภอบ่อทอง หนองใหญ่ เกาะจันทร์ (ลองจิจูดถึง ~101.55)
export const WORLD = { minX: -648, maxX: 1180, minZ: -1072, maxZ: 1050 };
export const lonToX = (lon) => (lon - 100.70) * 2160 - 648;
export const latToZ = (lat) => (13.075 - lat) * 2212;
export const xToLon = (x) => (x + 648) / 2160 + 100.70;
export const zToLat = (z) => 13.075 - z / 2212;

// แนวชายฝั่ง (lat, lon) จากเหนือลงใต้
const COAST = [
  [13.56, 100.93], [13.45, 100.95], [13.38, 100.975], [13.33, 100.925], [13.28, 100.905],
  [13.22, 100.925], [13.17, 100.925], [13.12, 100.905], [13.07, 100.88], [13.0, 100.895],
  [12.95, 100.875], [12.88, 100.865], [12.8, 100.895], [12.72, 100.905], [12.67, 100.88], [12.6, 100.93],
].map(([la, lo]) => [latToZ(la), lonToX(lo)]);

// ---------- noise ----------
export function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
export function fbm(x, y, oct = 4) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += vnoise(x * f, y * f) * amp; f *= 2.03; amp *= 0.5; }
  return s;
}
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export function coastX(z) {
  let x = COAST[COAST.length - 1][1];
  if (z <= COAST[0][0]) x = COAST[0][1];
  else for (let i = 1; i < COAST.length; i++) {
    if (z <= COAST[i][0]) {
      const [z0, x0] = COAST[i - 1], [z1, x1] = COAST[i];
      x = x0 + (x1 - x0) * ((z - z0) / (z1 - z0));
      break;
    }
  }
  return x + fbm(z * 0.015, 3.7, 3) * 8;
}

// ภูเขา: เขาเขียว, เขาชีจรรย์, เทือกเขาตะวันออก ฯลฯ
const P = (lat, lon) => [lonToX(lon), latToZ(lat)];
export const MOUNTAINS = [
  { name: 'เขาเขียว', p: P(13.215, 101.055), r: 70, h: 75 },
  { name: 'เขาบ่อทอง', p: P(13.30, 101.26), r: 120, h: 45 },
  { name: 'เขาศรีราชา', p: P(13.13, 101.08), r: 90, h: 38 },
  { name: 'เขาไม้แก้ว', p: P(12.85, 101.05), r: 90, h: 42 },
  { name: 'เขาอ่างฤาไน (บ่อทอง)', p: P(13.10, 101.50), r: 110, h: 58 },
  { name: 'เขาหนองใหญ่', p: P(13.03, 101.30), r: 90, h: 46 },
  { name: 'เขาชีจรรย์', p: P(12.765, 100.957), r: 30, h: 30 },
  { name: 'เขาพระตำหนัก', p: P(12.92, 100.87), r: 14, h: 18 },
];
export const ISLANDS = [
  { name: 'เกาะสีชัง', p: P(13.155, 100.815), r: 28, h: 18 },
  { name: 'เกาะล้าน', p: P(12.917, 100.778), r: 34, h: 22 },
  { name: 'เกาะสาก', p: P(12.94, 100.75), r: 10, h: 8 },
  { name: 'เกาะคราม', p: P(12.70, 100.80), r: 26, h: 16 },
  { name: 'เกาะไผ่', p: P(12.93, 100.69), r: 12, h: 10 },
];
// แหล่งน้ำจืด (อ่างเก็บน้ำจริงในชลบุรี)
export const LAKES = [
  { name: 'อ่างเก็บน้ำบางพระ', p: P(13.205, 100.99), rx: 42, rz: 26, level: 6.5 },
  { name: 'อ่างเก็บน้ำหนองค้อ', p: P(13.105, 101.03), rx: 22, rz: 16, level: 8 },
  { name: 'อ่างเก็บน้ำมาบประชัน', p: P(12.965, 101.0), rx: 22, rz: 14, level: 7 },
  { name: 'หนองน้ำพนัสนิคม', p: P(13.43, 101.15), rx: 14, rz: 10, level: 7 },
  { name: 'อ่างเก็บน้ำบ้านบึง', p: P(13.285, 101.15), rx: 18, rz: 12, level: 7.5 },
  { name: 'อ่างเก็บน้ำหนองกลางดง', p: P(13.17, 101.30), rx: 20, rz: 14, level: 9 },
];

function baseHeight(x, z) {
  const d = x - coastX(z);
  let h;
  if (d < 0) h = Math.max(-16, -1.2 + d * 0.09);
  else {
    h = 0.5 + Math.min(d, 14) * 0.08;
    if (d > 14) h += (d - 14) * 0.022 + (fbm(x * 0.006, z * 0.006) * 0.5 + 0.5) * 9 * smooth(14, 90, d);
  }
  for (const m of MOUNTAINS) {
    const dx = x - m.p[0], dz = z - m.p[1];
    const q = (dx * dx + dz * dz) / (m.r * m.r);
    if (q < 6) h += m.h * Math.exp(-q * 1.6) * (0.75 + 0.35 * fbm(x * 0.03, z * 0.03));
  }
  for (const i of ISLANDS) {
    const dx = x - i.p[0], dz = z - i.p[1];
    const q = (dx * dx + dz * dz) / (i.r * i.r);
    if (q < 4) h = Math.max(h, i.h * Math.exp(-q * 1.8) * (0.8 + 0.3 * fbm(x * 0.05, z * 0.05)) - 3 + (q < 1 ? 0 : 0));
  }
  return h;
}

export function heightAt(x, z) {
  let h = baseHeight(x, z);
  for (const l of LAKES) {
    const dx = (x - l.p[0]) / l.rx, dz = (z - l.p[1]) / l.rz;
    const e = Math.sqrt(dx * dx + dz * dz);
    if (e < 1.8) {
      const rim = Math.max(h, l.level + 1.2);
      h = h + (rim - h) * smooth(1.8, 1.2, e);
      if (e < 1.15) h = (l.level - 3.5) + (h - (l.level - 3.5)) * smooth(0.55, 1.15, e);
    }
  }
  return h;
}

// คืนค่าแหล่งน้ำ ณ ตำแหน่ง: {level, fresh, name}
export function waterAt(x, z, h = heightAt(x, z)) {
  for (const l of LAKES) {
    const dx = (x - l.p[0]) / l.rx, dz = (z - l.p[1]) / l.rz;
    if (dx * dx + dz * dz < 1.4 && h < l.level) return { level: l.level, fresh: true, name: l.name };
  }
  if (h < 0) return { level: 0, fresh: false, name: 'อ่าวไทย' };
  return null;
}
export const distToCoast = (x, z) => x - coastX(z);
