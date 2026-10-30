import * as THREE from 'three';
import { tr, onLang } from './i18n.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(k);
}
// คุณภาพกราฟิก: low (ประหยัด) · normal (ปกติ) · smooth (ละมุน: ขอบมน แสงนุ่ม)
export const GFX = { mode: 'normal' };
export function setGfx(mode) { GFX.mode = ['low', 'normal', 'smooth'].includes(mode) ? mode : 'normal'; }
// กล่องขอบมน: ดันจุดยอดที่มุม/ขอบให้โค้ง แล้วตั้งค่าแนวตั้งฉากให้แสงไล่เฉดนุ่ม
const geoCache = new Map();
function roundedBox(w, h, d) {
  const k = `${w},${h},${d}`; if (geoCache.has(k)) return geoCache.get(k);
  const r = Math.min(w, h, d) * 0.28, g = new THREE.BoxGeometry(w, h, d, 3, 3, 3);
  const p = g.attributes.position, nrm = g.attributes.normal, v = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-ix, Math.min(ix, v.x)), Math.max(-iy, Math.min(iy, v.y)), Math.max(-iz, Math.min(iz, v.z)));
    n.subVectors(v, c); if (n.lengthSq() < 1e-9) n.fromBufferAttribute(nrm, i); n.normalize();
    v.copy(c).addScaledVector(n, r); p.setXYZ(i, v.x, v.y, v.z); nrm.setXYZ(i, n.x, n.y, n.z);
  }
  geoCache.set(k, g); return g;
}
const box = (w, h, d, color, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(GFX.mode === 'smooth' ? roundedBox(w, h, d) : new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z); m.castShadow = true; return m;
};
const limb = (w, h, d, color, x, y, z) => {
  // ขาหรือแขนที่หมุนรอบข้อต่อด้านบน
  const g = new THREE.Group(); g.position.set(x, y, z);
  const m = box(w, h, d, color, 0, -h / 2, 0); g.add(m); return g;
};

import { SKINS, HAIR_STYLES } from './look-core.js';
export { SKINS, HAIR_STYLES };

// ตัวละครมนุษย์ low-poly  look = {skin, shirt, pants, hair}
// ทรงผม (เลือกได้ตอนสร้างตัวละคร)
function addHair(head, style, sex, c) {
  if (!HAIR_STYLES[style]) style = sex === 'f' ? 'long' : 'short';
  const H = (w, h, d, x, y, z) => head.add(box(w, h, d, c, x, y, z));
  const cap = () => H(0.36, 0.1, 0.36, 0, 0.32, 0);
  switch (style) {
    case 'short': cap(); H(0.36, 0.14, 0.08, 0, 0.22, -0.15); break;
    case 'buzz': H(0.35, 0.04, 0.35, 0, 0.31, 0); H(0.35, 0.1, 0.04, 0, 0.24, -0.16); break;
    case 'spiky': cap(); H(0.36, 0.14, 0.08, 0, 0.22, -0.15); for (const [x, z] of [[-0.1, -0.08], [0.1, -0.08], [0, 0.06], [-0.1, 0.1], [0.1, 0.1]]) { const s = box(0.08, 0.16, 0.08, c, x, 0.42, z); s.rotation.set(z * 2, 0, -x * 3); head.add(s); } break;
    case 'mohawk': H(0.1, 0.2, 0.38, 0, 0.38, 0); H(0.1, 0.16, 0.06, 0, 0.22, -0.17); break;
    case 'afro': H(0.5, 0.34, 0.48, 0, 0.36, -0.03); H(0.44, 0.24, 0.12, 0, 0.18, -0.17); break;
    case 'bob': cap(); H(0.37, 0.28, 0.1, 0, 0.14, -0.15); for (const x of [-0.18, 0.18]) H(0.05, 0.26, 0.32, x, 0.15, -0.01); break;
    case 'long': cap(); H(0.36, 0.5, 0.1, 0, 0.02, -0.16); for (const x of [-0.18, 0.18]) H(0.05, 0.36, 0.3, x, 0.08, -0.02); break;
    case 'ponytail': cap(); H(0.36, 0.2, 0.1, 0, 0.2, -0.16); H(0.12, 0.36, 0.12, 0, 0.0, -0.26); break;
    case 'bun': cap(); H(0.36, 0.2, 0.1, 0, 0.2, -0.16); H(0.2, 0.18, 0.2, 0, 0.42, -0.1); break;
    case 'twin': cap(); H(0.36, 0.18, 0.1, 0, 0.2, -0.16); for (const x of [-0.22, 0.22]) H(0.1, 0.32, 0.1, x, 0.06, -0.1); break;
    case 'curly': for (const [x, z] of [[-0.12, -0.1], [0, -0.1], [0.12, -0.1], [-0.12, 0.04], [0, 0.04], [0.12, 0.04], [-0.12, 0.14], [0.12, 0.14]]) H(0.14, 0.14, 0.14, x, 0.33, z); H(0.38, 0.16, 0.12, 0, 0.2, -0.16); break;
    case 'sidepart': cap(); H(0.36, 0.14, 0.08, 0, 0.22, -0.15); H(0.22, 0.08, 0.1, 0.08, 0.32, 0.15); H(0.05, 0.16, 0.3, 0.18, 0.22, 0); break;
    case 'undercut': H(0.3, 0.12, 0.34, 0, 0.36, 0.01); H(0.36, 0.04, 0.36, 0, 0.3, 0); H(0.2, 0.06, 0.12, 0.06, 0.4, 0.14); break;
    case 'mullet': cap(); H(0.36, 0.42, 0.1, 0, 0.06, -0.16); H(0.3, 0.08, 0.06, 0, 0.3, 0.16); break;
    case 'pixie': cap(); H(0.36, 0.16, 0.08, 0, 0.22, -0.15); H(0.24, 0.08, 0.06, -0.06, 0.28, 0.17); break;
    case 'braid': cap(); H(0.36, 0.2, 0.1, 0, 0.2, -0.16); for (let i = 0; i < 4; i++) H(0.11 - i * 0.01, 0.12, 0.11 - i * 0.01, 0, 0.04 - i * 0.12, -0.24); break;
    case 'bald': break;
  }
}
// หน้าตา: ตา ปาก คิ้ว และของเสริม (แว่น/เครา/กระ ฯลฯ)
function addFace(head, L, eyeC, hair, skin) {
  const F = (w, h, c, x, y, z = 0.175) => { const m = box(w, h, 0.02, c, x, y, z); head.add(m); return m; };
  const eyes = L.eyes || 'normal';
  for (const sx of [-1, 1]) {
    const x = 0.08 * sx;
    if (eyes === 'round') { F(0.08, 0.08, '#fff', x, 0.15); F(0.04, 0.05, eyeC, x, 0.15, 0.188); }
    else if (eyes === 'sleepy') F(0.07, 0.025, eyeC, x, 0.14);
    else if (eyes === 'sharp') { const m = F(0.08, 0.035, eyeC, x, 0.15); m.rotation.z = 0.25 * sx; }
    else if (eyes === 'happy') { const a = F(0.04, 0.02, eyeC, x - 0.015, 0.15); a.rotation.z = 0.6; const b = F(0.04, 0.02, eyeC, x + 0.015, 0.15); b.rotation.z = -0.6; }
    else if (eyes === 'wink' && sx > 0) F(0.07, 0.02, eyeC, x, 0.145);
    else F(0.06, 0.05, eyeC, x, 0.15);
  }
  const bc = new THREE.Color(hair).multiplyScalar(0.8).getStyle();
  const br = L.brows || 'thin';
  if (br !== 'none') for (const sx of [-1, 1]) { const m = F(0.08, br === 'thick' ? 0.035 : 0.018, bc, 0.08 * sx, 0.215); if (br === 'angry') m.rotation.z = -0.35 * sx; }
  const mc = '#7a2e2e';
  ({ smile: () => { F(0.1, 0.022, mc, 0, 0.03); F(0.025, 0.02, mc, -0.055, 0.045); F(0.025, 0.02, mc, 0.055, 0.045); },
    flat: () => F(0.09, 0.02, mc, 0, 0.035), grin: () => { F(0.14, 0.05, mc, 0, 0.035); F(0.12, 0.018, '#fff', 0, 0.05, 0.188); },
    open: () => F(0.06, 0.06, '#3a1010', 0, 0.03), smirk: () => { const m = F(0.09, 0.02, mc, 0.02, 0.035); m.rotation.z = 0.25; },
    frown: () => { F(0.1, 0.022, mc, 0, 0.04); F(0.025, 0.02, mc, -0.055, 0.025); F(0.025, 0.02, mc, 0.055, 0.025); } })[L.mouth || 'smile']?.();
  switch (L.extra) {
    case 'glasses': for (const sx of [-1, 1]) { F(0.11, 0.015, '#222', 0.08 * sx, 0.2, 0.19); F(0.11, 0.015, '#222', 0.08 * sx, 0.1, 0.19); F(0.015, 0.1, '#222', 0.08 * sx + 0.05 * sx, 0.15, 0.19); F(0.015, 0.1, '#222', 0.08 * sx - 0.05 * sx, 0.15, 0.19); } break;
    case 'sunglasses': F(0.3, 0.07, '#111', 0, 0.155, 0.19); break;
    case 'beard': head.add(box(0.36, 0.14, 0.06, bc, 0, -0.01, 0.16)); for (const sx of [-1, 1]) head.add(box(0.04, 0.2, 0.3, bc, 0.17 * sx, 0.03, 0)); break;
    case 'mustache': F(0.14, 0.03, bc, 0, 0.065, 0.19); break;
    case 'goatee': F(0.08, 0.07, bc, 0, -0.01, 0.18); break;
    case 'freckles': for (const [x, y] of [[-0.11, 0.1], [-0.07, 0.09], [-0.09, 0.075], [0.11, 0.1], [0.07, 0.09], [0.09, 0.075]]) F(0.015, 0.015, '#8d5524', x, y, 0.18); break;
    case 'blush': for (const sx of [-1, 1]) F(0.06, 0.03, '#f28482', 0.11 * sx, 0.09, 0.18); break;
    case 'scar': { const m = F(0.02, 0.12, '#9d4b4b', 0.1, 0.14, 0.19); m.rotation.z = 0.4; break; }
    case 'bandana': head.add(box(0.37, 0.07, 0.37, '#c1121f', 0, 0.24, 0)); head.add(box(0.06, 0.14, 0.04, '#c1121f', 0.05, 0.18, -0.19)); break;
  }
  void skin;
}
export function makeHuman(sex = 'm', look = {}, kind = 'human') {
  const skin = kind === 'zombie' ? '#7d9a6a' : look.skin || SKINS[0];
  const shirt = look.shirt || (sex === 'f' ? '#d1495b' : '#2e86ab');
  const pants = look.pants || '#3d405b';
  const hair = look.hair || '#1b1b1b';
  const s = kind === 'child' ? 0.55 : kind === 'baby' ? 0.32 : 1;
  const g = new THREE.Group();
  const inner = new THREE.Group(); inner.scale.setScalar(s); g.add(inner);
  const shoulder = sex === 'f' ? 0.5 : sex === 'x' ? 0.55 : 0.6;
  const body = box(shoulder, 0.7, 0.3, shirt, 0, 1.25, 0); inner.add(body);
  if (sex === 'f') inner.add(box(0.56, 0.22, 0.34, shirt, 0, 0.98, 0));
  const head = new THREE.Group(); head.position.set(0, 1.62, 0); inner.add(head);
  head.add(box(0.34, 0.36, 0.34, skin, 0, 0.12, 0));
  addHair(head, kind === 'zombie' ? (sex === 'f' ? 'long' : 'short') : look.style, sex, hair);
  // ตา
  addFace(head, kind === 'zombie' ? {} : look, kind === 'zombie' ? '#e63946' : '#111', hair, skin);
  // ตัวละครหันหน้าไปทาง +z: มือขวาของตัวละครอยู่ฝั่ง -x · มือซ้ายอยู่ฝั่ง +x
  const lArm = limb(0.14, 0.62, 0.14, shirt, shoulder / 2 + 0.08, 1.58, 0);
  const rArm = limb(0.14, 0.62, 0.14, shirt, -shoulder / 2 - 0.08, 1.58, 0);
  lArm.children[0].add(box(0.12, 0.14, 0.12, skin, 0, -0.34, 0));
  rArm.children[0].add(box(0.12, 0.14, 0.12, skin, 0, -0.34, 0));
  const lLeg = limb(0.18, 0.9, 0.2, pants, 0.13, 0.9, 0);
  const rLeg = limb(0.18, 0.9, 0.2, pants, -0.13, 0.9, 0);
  inner.add(lArm, rArm, lLeg, rLeg);
  if (kind === 'zombie') { lArm.rotation.x = -1.3; rArm.rotation.x = -1.4; body.material = mat('#5b5b4a'); }
  // จุดถือเครื่องมือ
  const hand = new THREE.Group(); hand.position.set(0, -0.6, 0.05); rArm.add(hand);
  const lHand = new THREE.Group(); lHand.position.set(0, -0.6, 0.05); lArm.add(lHand);
  // ท้อง (แสดงเมื่อตั้งครรภ์)
  const belly = box(0.42, 0.34, 0.2, shirt, 0, 1.08, 0.18); belly.visible = false; inner.add(belly);
  g.userData = { lArm, rArm, lLeg, rLeg, head, hand, lHand, lefty: false, belly, body, inner, sex, kind, phase: Math.random() * 6 };
  return g;
}

// อาการบาดเจ็บบนตัวละคร (แบบน่ารัก ไม่น่ากลัว เหมาะกับเด็ก): ij = บิต 1 เลือดออก · 2 ขาหัก · 4 ติดเชื้อ
// เลือดออก = พลาสเตอร์สีชมพูที่แก้ม/แขน · ขาหัก = เฝือกสีขาวมีสติกเกอร์ดาว + เดินกะเผลก · ติดเชื้อ = หน้าเขียวอ่อน ๆ + ฟองสบู่สีเขียว
export function setInjury(g, ij = 0) {
  const u = g.userData; if (u.ijKey === ij) return; u.ijKey = ij;
  for (const o of u.ijParts || []) o.parent?.remove(o);
  const parts = u.ijParts = [];
  const put = (parent, o) => { parent.add(o); parts.push(o); return o; };
  if (ij & 1) {
    // พลาสเตอร์ลายกากบาท
    const pl = (parent, x, y, z, rz) => { const a = put(parent, box(0.12, 0.05, 0.02, '#ffc8dd', x, y, z)); a.rotation.z = rz; const b = put(parent, box(0.12, 0.05, 0.02, '#ffc8dd', x, y, z + 0.002)); b.rotation.z = -rz; };
    pl(u.head, 0.1, 0.06, 0.18, 0.6); pl(u.rArm.children[0], 0, -0.2, 0.075, 0.6);
  }
  if (ij & 2) {
    put(u.lLeg.children[0], box(0.22, 0.42, 0.24, '#f8f9fa', 0, -0.2, 0));
    put(u.lLeg.children[0], box(0.08, 0.08, 0.02, '#ffd60a', 0, -0.15, 0.125)); put(u.lLeg.children[0], box(0.06, 0.06, 0.02, '#4cc9f0', 0.04, -0.3, 0.125));
  }
  if (ij & 8) {
    // ขาแพลง: ผ้าพันข้อเท้าสีครีม
    put(u.rLeg.children[0], box(0.21, 0.16, 0.23, '#f2e8cf', 0, -0.36, 0)); put(u.rLeg.children[0], box(0.22, 0.03, 0.24, '#e9c46a', 0, -0.33, 0));
  }
  if (ij & 4) {
    const bub = new THREE.Group(); bub.position.set(0, 0.5, 0);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05 + i * 0.015, 8, 6), new THREE.MeshBasicMaterial({ color: '#b7e4c7', transparent: true, opacity: 0.8 })); b.userData.a = i * 2.1; bub.add(b); }
    put(u.head, bub); u.bubbles = bub;
    put(u.head, box(0.345, 0.12, 0.02, '#b7e4c7', 0, 0.06, 0.172)).material = new THREE.MeshBasicMaterial({ color: '#95d5b2', transparent: true, opacity: 0.45 });
  } else u.bubbles = null;
  u.limp = !!(ij & 10);
}
export function tickInjury(g, dt) {
  const u = g.userData;
  if (u.bubbles) for (const b of u.bubbles.children) { b.userData.a += dt * 1.5; const t = b.userData.a % 3; b.position.set(Math.sin(b.userData.a * 2) * 0.15, t * 0.15, Math.cos(b.userData.a) * 0.1); b.material.opacity = 0.8 - t * 0.25; }
  if (u.limp) u.inner.rotation.z = Math.sin(performance.now() / 160) * 0.05;
  else if (u.inner) u.inner.rotation.z = 0;
}
export const injuryBits = (s) => (s.bleeding ? 1 : 0) | (s.fracture ? 2 : 0) | (s.infection >= 15 ? 4 : 0) | (!s.fracture && s.sprain > 0 ? 8 : 0);

// เสื้อผ้าที่สวม: ซ้อนกล่องสีบนส่วนต่าง ๆ ของตัว (wear = {head, body, legs, hands, socks, shoes, back} → key ของไอเท็ม)
export function setOutfit(g, wear, ITEMS) {
  setFairies(g, Math.max(0, ...Object.values(wear || {}).map(plusLv))); // 🧚 นางฟ้าตามระดับตีบวกของชุดที่สูงที่สุด
  wear = Object.fromEntries(Object.entries(wear || {}).map(([s, k]) => [s, k ? String(k).split('~')[0] : k])); // ของสุ่มสเตตัสหน้าตาเหมือนของปกติ
  const u = g.userData;
  for (const o of u.outfit || []) o.parent?.remove(o);
  const out = u.outfit = []; u.shield = null;
  const put = (parent, o) => { parent.add(o); out.push(o); return o; };
  const W = (slot) => wear?.[slot] && ITEMS[wear[slot]]?.wear;
  const sw = u.sex === 'f' ? 0.5 : u.sex === 'x' ? 0.55 : 0.6;
  const h = W('head');
  if (h) {
    if (wear.head === 'hat_cloth') { put(u.head, box(0.38, 0.12, 0.38, h.color, 0, 0.33, 0)); put(u.head, box(0.38, 0.04, 0.18, h.color, 0, 0.27, 0.24)); }
    else { put(u.head, box(0.42, 0.24, 0.42, h.color, 0, 0.3, -0.01)); put(u.head, box(0.44, 0.06, 0.44, h.color, 0, 0.2, 0)); }
  }
  const b = W('body');
  if (b) {
    put(u.inner, box(sw + 0.04, 0.72, 0.34, b.color, 0, 1.25, 0));
    for (const a of [u.lArm, u.rArm]) put(a, box(0.16, 0.36, 0.16, b.color, 0, -0.17, 0));
    if (wear.body === 'vest_kevlar' || wear.body === 'cloth_armor') put(u.inner, box(sw * 0.8, 0.4, 0.36, '#495057', 0, 1.32, 0.01));
  }
  const l = W('legs');
  if (l) {
    if (l.skirt) put(u.inner, box(0.56, wear.legs === 'skirt_long' ? 0.7 : 0.42, 0.34, l.color, 0, wear.legs === 'skirt_long' ? 0.6 : 0.75, 0));
    else for (const a of [u.lLeg, u.rLeg]) put(a, box(0.2, 0.9, 0.22, l.color, 0, -0.45, 0));
  }
  const hd = W('hands'); if (hd) for (const a of [u.lArm, u.rArm]) put(a, box(0.14, 0.16, 0.14, hd.color, 0, -0.6, 0));
  const so = W('socks'); if (so) for (const a of [u.lLeg, u.rLeg]) put(a, box(0.2, 0.12, 0.22, so.color, 0, -0.8, 0));
  const sh = W('shoes'); if (sh) for (const a of [u.lLeg, u.rLeg]) put(a, box(0.21, wear.shoes === 'boots' ? 0.24 : 0.1, 0.3, sh.color, 0, wear.shoes === 'boots' ? -0.82 : -0.88, 0.04));
  const of = W('off');
  u.offFlame = null; u.offLight = null;
  if (of && wear.off === 'torch') {
    // คบเพลิงในมือรอง (คู่กับอาวุธมือหลัก) — ส่องสว่างรอบตัว
    const t = TOOL_MESH.torch(), grp = new THREE.Group(); grp.position.set(0, -0.6, 0.05); grp.userData.torch = true; grp.add(t);
    if (GFX.mode !== 'low') { const L = new THREE.PointLight('#ffa94d', 2.2, 16, 1.5); L.position.y = 0.7; t.add(L); u.offLight = L; }
    u.offFlame = t.userData.flame || null;
    put(u.lArm, grp); u.shield = grp; placeShield(u);
  } else if (of) {
    // โล่บนแขนซ้าย หันออกด้านนอก
    const s = of.size || 1, sh = new THREE.Group(); sh.position.set(0.13, -0.42, 0.06);
    if (of.round) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 0.05, 14), new THREE.MeshLambertMaterial({ color: of.color })); m.rotation.z = Math.PI / 2; sh.add(m); }
    else sh.add(box(0.05, 0.55 * s, 0.42 * Math.min(s, 1.15), of.color, 0, 0, 0));
    sh.add(box(0.07, 0.1, 0.1, '#ced4da', -0.03, 0, 0));
    if (wear.off === 'shield_riot') sh.add(box(0.055, 0.12, 0.3, '#90e0ef', -0.005, 0.28 * s, 0));
    put(u.lArm, sh); u.shield = sh; placeShield(u);
  }
  const bk = W('back');
  if (bk) { const s = 0.7 + bk.lvl * 0.15; put(u.inner, box(0.42 * s, 0.5 * s, 0.22 * s, bk.color, 0, 1.25, -0.27)); if (bk.lvl > 1) put(u.inner, box(0.36 * s, 0.12, 0.26 * s, '#333', 0, 1.25 + 0.27 * s, -0.27)); }
}

// ท่าปั่นจักรยาน: ขาปั่นสลับตามความเร็ว · แขนจับแฮนด์ · ตัวโน้มไปข้างหน้า (ยานพาหนะอื่น = นั่งเฉย ๆ มือจับ)
export function ridePose(g, dt, speed, vt) {
  const u = g.userData; u.ride = (u.ride || 0) + dt * Math.min(14, Math.abs(speed) * 1.1);
  if (vt === 'bicycle') {
    const a = Math.sin(u.ride) * 0.55;
    u.lLeg.rotation.x = -1.05 + a; u.rLeg.rotation.x = -1.05 - a;
    u.lArm.rotation.x = u.rArm.rotation.x = -1.15; u.inner.rotation.x = 0.28;
  } else if (vt === 'raft') {
    u.lLeg.rotation.x = u.rLeg.rotation.x = -1.3; const a = Math.sin(u.ride * 0.6) * 0.6; u.lArm.rotation.x = -0.9 + a; u.rArm.rotation.x = -0.9 - a;
  } else { u.lLeg.rotation.x = u.rLeg.rotation.x = -1.3; u.lArm.rotation.x = u.rArm.rotation.x = -1.0; u.inner.rotation.x = 0.12; }
}
// ท่านั่งพัก: นั่งพับขาบนพื้น มือวางบนเข่า
export function sitPose(g) { const u = g.userData; u.inner.rotation.x = 0; u.inner.position.y = -0.55; u.inner.position.z = 0; u.lLeg.rotation.x = u.rLeg.rotation.x = -1.45; u.lArm.rotation.x = u.rArm.rotation.x = -0.55; u.head.rotation.x = 0.1; }
// ท่านอนบนเตียง (fit = นอนบนเตียงจริง: ย่อสัดส่วนเล็กน้อยและจัดกึ่งกลางให้พอดีเตียงยาว 2.2 ม. ไม่ให้ตัวยื่นออกนอกเตียง)
export function sleepPose(g, fit = false) {
  const u = g.userData; if (u.baseS === undefined) u.baseS = u.inner.scale.x;
  const k = fit ? 0.86 : 1; u.inner.scale.setScalar(u.baseS * k);
  u.inner.rotation.x = -Math.PI / 2; u.inner.position.y = 0.35;
  u.inner.position.z = fit ? (1.98 * u.baseS * k) / 2 - 0.05 : 0.9; // ปลายเท้า = +z · หัวไปทางหมอน (-z)
  u.lLeg.rotation.x = u.rLeg.rotation.x = 0; u.lArm.rotation.x = u.rArm.rotation.x = 0.15; u.head.rotation.x = 0;
}
// ✨ ระดับตีบวกจากรหัสไอเท็ม (ชื่อ~R7+6*d3 → 6)
const plusLv = (k) => +((/\+(\d{1,2})/.exec(String(k || '').split('~')[1] || '') || [])[1] || 0);
const GLOW_C = { 6: '#4cc9f0', 7: '#52b788', 8: '#c77dff', 9: '#ff9f1c', 10: '#ffd60a' };
// อาวุธ +6 ขึ้นไปเรืองแสง (ยิ่งสูงยิ่งสว่าง) · +8 มีออร่ารอบอาวุธ · +10 มีกระแสไฟฟ้าวิ่งรอบอาวุธ
function applyGlow(m, lv, u) {
  u.glow = null; if (lv < 6) return;
  const c = new THREE.Color(GLOW_C[Math.min(10, lv)]), mats = [], auras = [];
  const meshes = []; m.traverse((o) => { if (o.isMesh && !o.userData.noGlow && o.material && !o.material.isMeshBasicMaterial) meshes.push(o); });
  for (const o of meshes) {
    o.material = o.material.clone(); o.material.emissive = c.clone(); o.material.emissiveIntensity = 0.25 + (lv - 6) * 0.15; mats.push(o.material);
    if (lv >= 8) { const a = new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })); a.scale.setScalar(1.35); a.userData.noGlow = true; o.add(a); auras.push(a); }
  }
  let arcs = null, box = null;
  if (lv >= 10) {
    box = new THREE.Box3(); for (const o of meshes) { if (o.parent !== m) continue; o.geometry.computeBoundingBox(); o.updateMatrix(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrix)); }
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.05, 0, -0.05), new THREE.Vector3(0.05, 0.8, 0.05));
    arcs = [0, 1, 2].map(() => { const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 9 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: '#d0f4ff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); ln.frustumCulled = false; m.add(ln); return ln; });
  }
  u.glow = { mats, auras, arcs, box, lv, t: 0, at: 0 };
}
function tickGlow(u, dt) {
  const G = u.glow; if (!G) return; G.t += dt;
  const base = 0.25 + (G.lv - 6) * 0.15, k = 0.75 + Math.sin(G.t * (G.lv >= 9 ? 5 : 3)) * 0.25;
  for (const mt of G.mats) mt.emissiveIntensity = base * k + (G.lv >= 10 ? Math.random() * 0.3 : 0);
  for (const a of G.auras) a.material.opacity = 0.14 + k * 0.12;
  if (G.arcs && (G.at -= dt) <= 0) {
    // ⚡ สุ่มเส้นฟ้าผ่าหยัก ๆ ตามความยาวอาวุธ ทุก 0.06 วินาที
    G.at = 0.06; const b = G.box, sz = b.getSize(new THREE.Vector3()), ax = sz.x > sz.y && sz.x > sz.z ? 'x' : sz.z > sz.y ? 'z' : 'y';
    for (const ln of G.arcs) {
      const pos = ln.geometry.attributes.position, j = Math.max(0.04, Math.min(sz.x, sz.y, sz.z) * 0.9 + 0.05);
      for (let i = 0; i < pos.count; i++) {
        const t = i / (pos.count - 1), p = new THREE.Vector3(b.min.x + Math.random() * sz.x, b.min.y + Math.random() * sz.y, b.min.z + Math.random() * sz.z);
        p[ax] = b.min[ax] + t * sz[ax]; for (const o of ['x', 'y', 'z']) if (o !== ax) p[o] = (b.min[o] + b.max[o]) / 2 + (Math.random() - 0.5) * j * 2.2;
        pos.setXYZ(i, p.x, p.y, p.z);
      }
      pos.needsUpdate = true; ln.visible = Math.random() > 0.15; ln.material.opacity = 0.6 + Math.random() * 0.4;
    }
  }
}
// 🧚 นางฟ้าตัวน้อยบินตามผู้ที่สวมชุด +6 ขึ้นไป (ยิ่งตีบวกสูงยิ่งสวย: ปีกใหญ่ขึ้น มีประกาย รัศมี และเพิ่มจำนวน)
const FAIRY_C = { 6: ['#ffafcc'], 7: ['#b9fbc0'], 8: ['#cdb4db', '#a2d2ff'], 9: ['#ffd166', '#ffafcc'], 10: ['#ff99c8', '#a0e7e5', '#fcf6bd'] };
function makeFairy(lv, col) {
  const f = new THREE.Group(), glowM = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 0.12, 8), new THREE.MeshBasicMaterial({ color: col })); f.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe8d6' })); head.position.y = 0.09; f.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: lv >= 9 ? '#ffd166' : '#f4a261' })); hair.position.y = 0.095; f.add(hair);
  const wsz = 0.085 + (lv - 6) * 0.014, wings = [];
  for (const sx of [-1, 1]) for (const [h, s] of [[0.03, 1], [-0.03, 0.7]]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.02, h, -0.02); f.add(piv);
    const w = new THREE.Mesh(new THREE.CircleGeometry(wsz * s, 12), glowM(lv >= 10 ? ['#ff99c8', '#a0e7e5', '#fcf6bd', '#cdb4db'][wings.length % 4] : col, 0.42)); w.scale.set(0.6, 1, 1); w.position.x = sx * wsz * s * 0.55; w.rotation.y = sx * 0.3; piv.add(w); piv.userData.sx = sx; wings.push(piv);
  }
  const aura = new THREE.Mesh(new THREE.SphereGeometry(0.06 + (lv - 6) * 0.008, 10, 8), glowM(col, 0.12)); f.add(aura);
  if (lv >= 9) { const halo = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 18), glowM('#fff3b0', 0.9)); halo.rotation.x = Math.PI / 2; halo.position.y = 0.15; f.add(halo); }
  if (lv >= 7) { const wand = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), glowM('#ffffff', 0.95)); wand.position.set(0.07, 0.02, 0.05); f.add(wand); }
  f.userData = { wings, aura };
  return f;
}
function setFairies(g, lv) {
  const u = g.userData; if ((u.fairyLv || 0) === lv) return;
  if (u.fairies) { g.remove(u.fairies); u.fairies = null; }
  u.fairyLv = lv; if (lv < 6) return;
  const grp = new THREE.Group(), cols = FAIRY_C[Math.min(10, lv)], list = cols.map((c) => { const f = makeFairy(lv, c); grp.add(f); return f; });
  // ประกายระยิบระยับ (+7 ขึ้นไป · +10 เยอะเป็นพิเศษ)
  let sparks = null;
  if (lv >= 7) { const n = lv >= 10 ? 26 : lv >= 9 ? 16 : 8, geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3)); sparks = new THREE.Points(geo, new THREE.PointsMaterial({ color: lv >= 10 ? '#fff3b0' : cols[0], size: 0.05, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); sparks.frustumCulled = false; sparks.userData.life = Array.from({ length: n }, () => Math.random()); grp.add(sparks); }
  g.add(grp); u.fairies = grp; u.fairyList = list; u.fairySparks = sparks; u.fairyT = Math.random() * 6;
}
function tickFairies(u, dt) {
  if (!u.fairies) return; u.fairyT += dt; const T = u.fairyT, n = u.fairyList.length;
  u.fairyList.forEach((f, i) => {
    const a = T * (1.1 + i * 0.15) + (i * Math.PI * 2) / n, r = 0.75 + Math.sin(T * 0.7 + i) * 0.12;
    f.position.set(Math.cos(a) * r, 1.85 + Math.sin(T * 2.2 + i * 1.7) * 0.15, Math.sin(a) * r); f.rotation.y = -a;
    for (const w of f.userData.wings) w.rotation.y = w.userData.sx * (0.25 + Math.abs(Math.sin(T * 18 + i)) * 0.9);
    f.userData.aura.material.opacity = 0.06 + Math.abs(Math.sin(T * 3 + i)) * 0.08;
  });
  const S = u.fairySparks;
  if (S) {
    const pos = S.geometry.attributes.position, L = S.userData.life;
    for (let i = 0; i < pos.count; i++) {
      L[i] -= dt * 0.8; const f = u.fairyList[i % n].position;
      if (L[i] <= 0) { L[i] = 1; pos.setXYZ(i, f.x + (Math.random() - 0.5) * 0.15, f.y + (Math.random() - 0.5) * 0.15, f.z + (Math.random() - 0.5) * 0.15); }
      else pos.setY(i, pos.getY(i) - dt * 0.25);
    }
    pos.needsUpdate = true; S.material.opacity = 0.6 + Math.sin(T * 6) * 0.3;
  }
}

export function animateHuman(g, dt, speed, attacking = 0, mode = null) {
  const u = g.userData;
  tickGlow(u, dt); tickFairies(u, dt);
  if (u.flame) { const f = 0.85 + Math.random() * 0.3; u.flame.scale.set(f, 0.8 + Math.random() * 0.5, f); if (u.torchLight) u.torchLight.intensity = 1.8 + Math.random() * 0.8; }
  if (u.offFlame) { const f = 0.85 + Math.random() * 0.3; u.offFlame.scale.set(f, 0.8 + Math.random() * 0.5, f); if (u.offLight) u.offLight.intensity = 1.8 + Math.random() * 0.8; }
  if (mode === 'climb' || mode === 'down') {
    // ท่าปีน: มือเอื้อมขึ้นสลับซ้ายขวา ขาถีบกำแพงสลับกัน ตัวเอนเข้าหากำแพง
    u.phase += dt * (mode === 'climb' ? 7 : 9);
    const a = Math.sin(u.phase);
    u.lArm.rotation.x = -2.7 + a * 0.45; u.rArm.rotation.x = -2.7 - a * 0.45;
    u.lArm.rotation.z = -0.15; u.rArm.rotation.z = 0.15;
    u.lLeg.rotation.x = -0.7 - Math.max(0, -a) * 0.6; u.rLeg.rotation.x = -0.7 - Math.max(0, a) * 0.6;
    u.inner.rotation.x = 0.18; u.head.rotation.x = -0.35; u.inner.position.y = 0; u.inner.position.z = 0;
    return;
  }
  if (mode === 'crouch' || mode === 'crawl') {
    u.phase += dt * (2 + speed * 2.5);
    const a = Math.sin(u.phase) * Math.min(1, speed);
    u.lArm.rotation.z = 0; u.rArm.rotation.z = 0;
    if (mode === 'crouch') {
      // ย่อตัว: ลดตัวลง เอนไปข้างหน้า ขางอ
      u.inner.position.y = -0.38; u.inner.rotation.x = 0.35; u.head.rotation.x = -0.3;
      u.lLeg.rotation.x = -0.9 + a * 0.4; u.rLeg.rotation.x = -0.9 - a * 0.4;
      u.lArm.rotation.x = -0.7 - a * 0.3; u.rArm.rotation.x = attacking > 0 ? -2.4 + (1 - attacking) * 2.6 : -0.7 + a * 0.3;
    } else {
      // คลาน: นอนคว่ำ มือเอื้อมสลับ ขาถีบสลับ
      u.inner.position.y = 0.28; u.inner.rotation.x = 1.42; u.head.rotation.x = -1.2;
      u.lArm.rotation.x = -2.6 + a * 0.6; u.rArm.rotation.x = -2.6 - a * 0.6;
      u.lLeg.rotation.x = a * 0.35; u.rLeg.rotation.x = -a * 0.35;
    }
    return;
  }
  u.lArm.rotation.z = 0; u.rArm.rotation.z = 0; u.inner.rotation.x = 0; u.head.rotation.x = 0; u.inner.position.y = 0; u.inner.position.z = 0;
  u.phase += dt * (2 + speed * 1.6);
  const sw = Math.min(1, speed / 4) * 0.8;
  const a = Math.sin(u.phase) * sw;
  u.lLeg.rotation.x = a; u.rLeg.rotation.x = -a;
  if (u.kind === 'zombie') { u.lArm.rotation.x = -1.3 + a * 0.2; u.rArm.rotation.x = -1.4 - a * 0.2; u.head.rotation.z = Math.sin(u.phase * 0.3) * 0.3; }
  else {
    // แขนที่ถืออาวุธเป็นแขนที่ใช้ (สลับมือได้) · ท่าต่างกันตามชนิดอุปกรณ์
    const [wpn, off] = u.lefty ? [u.lArm, u.rArm] : [u.rArm, u.lArm];
    const H = u.lefty ? u.lHand : u.hand, side = u.lefty ? -1 : 1;
    off.rotation.x = u.lefty ? a * 0.8 : -a * 0.8; wpn.rotation.z = 0; u.inner.rotation.y = 0; if (H) H.position.z = 0.05;
    if (attacking > 0) {
      const t = 1 - attacking, k = Math.sin(t * Math.PI); // 0→1→0
      switch (u.atkStyle || ATK_STYLE[String(u.tool || '').split('~')[0]] || (u.tool ? 'slash' : 'punch')) {
        case 'thrust': // หอก: ดึงกลับแล้วแทงไปข้างหน้าตรง ๆ
          wpn.rotation.x = -1.5; if (H) H.position.z = 0.05 + (t < 0.3 ? -0.25 * (t / 0.3) : 0.7 * k); u.inner.rotation.x = 0.18 * k; break;
        case 'slash': // มีด/ขวาน: เงื้อแล้วฟันเฉียงจากบนลงล่าง บิดตัวตาม
          wpn.rotation.x = -2.6 + t * 2.4; wpn.rotation.z = side * (0.9 - t * 1.6); u.inner.rotation.y = side * (0.35 - t * 0.7); break;
        case 'smash': // ค้อน: ยกสูงเหนือหัวแล้วทุบลงแรง ๆ พร้อมย่อตัว
          wpn.rotation.x = t < 0.4 ? -3.1 * (t / 0.4) : -3.1 + ((t - 0.4) / 0.6) * 3.3; u.inner.rotation.x = t > 0.4 ? 0.25 * k : 0; break;
        case 'flick': // เบ็ด: ตวัดจากหลังไปข้างหน้าเร็ว ๆ
          wpn.rotation.x = t < 0.35 ? -2.9 : -2.9 + ((t - 0.35) / 0.65) * 1.9; break;
        case 'throw': // แห: เหวี่ยงจากข้างลำตัวออกไปข้างหน้า
          wpn.rotation.x = -1.2 - k * 0.8; wpn.rotation.z = side * (1.2 - t * 1.6); u.inner.rotation.y = side * (0.4 - t * 0.8); break;
        case 'shoot': // ธนู/หน้าไม้/หนังสติ๊ก: ยกเล็งไปข้างหน้า แขนอีกข้างง้าง
          wpn.rotation.x = -1.55; off.rotation.x = -1.4 - 0.3 * k; break;
        case 'pour': // บัวรดน้ำ: ยื่นแขนไปข้างหน้าแล้วเอียงลง
          wpn.rotation.x = -1.2 - k * 0.2; wpn.rotation.z = side * 0.5 * k; break;
        default: // หมัด: ชกตรง
          wpn.rotation.x = -1.6 * k - 0.2; if (H) H.position.z = 0.05 + 0.35 * k;
      }
    } else { wpn.rotation.x = u.lefty ? -a * 0.8 : a * 0.8; u.atkStyle = null; }
  }
}

// ท่าโจมตี/ใช้งานตามชนิดอุปกรณ์
const ATK_STYLE = { pickaxe: 'smash', iron_pickaxe: 'smash', club: 'smash', nail_bat: 'smash', sickle: 'slash', iron_sword: 'slash', slingshot: 'shoot', bow: 'shoot', crossbow: 'shoot', spear: 'thrust', steel_spear: 'thrust', bone_spear: 'thrust', machete: 'slash', stone_axe: 'slash', steel_axe: 'slash', torch: 'slash',
  hammer: 'smash', wood_hammer: 'smash', stone_hammer: 'smash', king_hammer: 'smash', rod: 'flick', rod_pro: 'flick', net: 'throw', watering_can: 'pour' };
const TOOL_MESH = {
  stone_axe: () => { const g = new THREE.Group(); g.add(box(0.06, 0.7, 0.06, '#7f5539', 0, -0.2, 0.1)); g.add(box(0.08, 0.18, 0.22, '#8a8a8a', 0, -0.5, 0.2)); g.rotation.x = Math.PI / 2; return g; },
  spear: () => { const g = new THREE.Group(); g.add(box(0.05, 1.8, 0.05, '#9c6644', 0, 0, 0)); g.add(box(0.08, 0.25, 0.08, '#cccccc', 0, 0.95, 0)); g.rotation.x = Math.PI / 2; return g; },
  machete: () => { const g = new THREE.Group(); g.add(box(0.06, 0.18, 0.06, '#222', 0, 0, 0)); g.add(box(0.03, 0.6, 0.1, '#c0c0c0', 0, 0.38, 0)); g.rotation.x = Math.PI / 2; return g; },
  steel_axe: () => { const g = new THREE.Group(); g.add(box(0.06, 0.8, 0.06, '#5c4033', 0, -0.2, 0.1)); g.add(box(0.06, 0.22, 0.3, '#adb5bd', 0, -0.55, 0.22)); g.rotation.x = Math.PI / 2; return g; },
  steel_spear: () => { const g = new THREE.Group(); g.add(box(0.05, 2, 0.05, '#495057', 0, 0, 0)); g.add(box(0.07, 0.35, 0.1, '#e9ecef', 0, 1.1, 0)); g.rotation.x = Math.PI / 2; return g; },
  // ค้อน: ด้าม + หัวค้อน
  hammer: () => hammerMesh('#9c6644', '#6c757d', 0.16), wood_hammer: () => hammerMesh('#b08968', '#7f5539', 0.18), stone_hammer: () => hammerMesh('#7f5539', '#8d8d8d', 0.22),
  king_hammer: () => hammerMesh('#370617', '#ffd60a', 0.34),
  // เบ็ด: คันยาว + สาย
  rod: () => rodMesh('#c9a227'), rod_pro: () => rodMesh('#1d3557'),
  net: () => { const g = new THREE.Group(); g.add(box(0.04, 0.6, 0.04, '#9c6644', 0, 0, 0)); const n = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#e9d8a6', wireframe: true })); n.position.y = 0.4; n.rotation.x = Math.PI; g.add(n); g.rotation.x = Math.PI / 2; return g; },
  // คบเพลิง: ไม้ + ผ้าพัน + เปลวไฟ (แสงจริงตั้งใน setHeldTool)
  pickaxe: () => pickMesh('#8d6e4a', '#8a8a85'),
  iron_pickaxe: () => pickMesh('#5c3d2e', '#adb5bd'),
  torch: () => {
    const g = new THREE.Group(); g.add(box(0.06, 0.6, 0.06, '#7f5539', 0, 0.1, 0)); g.add(box(0.1, 0.12, 0.1, '#6c584c', 0, 0.42, 0));
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 6), new THREE.MeshBasicMaterial({ color: '#ffb703' })); fl.position.y = 0.6; g.add(fl);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), new THREE.MeshBasicMaterial({ color: '#fff3b0' })); core.position.y = 0.56; g.add(core);
    g.userData.flame = fl; g.rotation.x = 0.4; return g;
  },
  club: () => clubMesh('#9c6644', false), nail_bat: () => clubMesh('#b08968', true),
  sickle: () => { const g = new THREE.Group(); g.add(box(0.05, 0.35, 0.05, '#7f5539', 0, 0, 0)); const b = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 4, 10, Math.PI), mat('#ced4da')); b.position.set(0, 0.3, 0.1); b.rotation.y = Math.PI / 2; g.add(b); g.rotation.x = Math.PI / 2; return g; },
  iron_sword: () => { const g = new THREE.Group(); g.add(box(0.06, 0.2, 0.06, '#432818', 0, 0, 0)); g.add(box(0.22, 0.04, 0.06, '#adb5bd', 0, 0.12, 0)); g.add(box(0.05, 0.85, 0.02, '#e9ecef', 0, 0.56, 0)); g.rotation.x = Math.PI / 2; return g; },
  slingshot: () => { const g = new THREE.Group(); g.add(box(0.04, 0.25, 0.04, '#7f5539', 0, 0, 0)); g.add(box(0.04, 0.16, 0.04, '#7f5539', -0.06, 0.18, 0), box(0.04, 0.16, 0.04, '#7f5539', 0.06, 0.18, 0)); g.rotation.x = 0.4; return g; },
  bow: () => { const g = new THREE.Group(); const arc = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 4, 14, Math.PI), mat('#bc6c25')); arc.rotation.y = Math.PI / 2; arc.rotation.x = Math.PI / 2; g.add(arc); g.add(box(0.01, 0.01, 1.0, '#eeeeee', 0, 0, 0)); g.rotation.z = Math.PI / 2; return g; },
  crossbow: () => { const g = new THREE.Group(); g.add(box(0.08, 0.08, 0.7, '#495057', 0, 0, 0.2)); g.add(box(0.7, 0.05, 0.06, '#343a40', 0, 0.02, 0.45)); return g; },
  watering_can: () => { const g = new THREE.Group(); g.add(box(0.22, 0.22, 0.3, '#2a9d8f', 0, -0.05, 0.12)); const sp = box(0.05, 0.05, 0.32, '#2a9d8f', 0, 0.02, 0.38); sp.rotation.x = -0.5; g.add(sp); g.add(box(0.04, 0.16, 0.04, '#264653', 0, 0.12, 0)); return g; },
  guitar: () => { const g = new THREE.Group(); g.add(box(0.28, 0.34, 0.08, '#bc6c25', 0, -0.1, 0)); g.add(box(0.06, 0.5, 0.04, '#6f4518', 0, 0.3, 0)); return g; },
};
function pickMesh(handle, head) { const g = new THREE.Group(); g.add(box(0.05, 0.75, 0.05, handle, 0, 0.1, 0)); const h = box(0.7, 0.08, 0.08, head, 0, 0.46, 0); g.add(h); for (const sx of [-1, 1]) { const tip = box(0.14, 0.06, 0.06, head, sx * 0.4, 0.42, 0); tip.rotation.z = sx * -0.5; g.add(tip); } g.rotation.x = Math.PI / 2; return g; }
function clubMesh(c, nails) { const g = new THREE.Group(); g.add(box(0.06, 0.4, 0.06, c, 0, -0.05, 0)); g.add(box(0.12, 0.5, 0.12, c, 0, 0.38, 0)); if (nails) for (let i = 0; i < 6; i++) g.add(box(0.16, 0.02, 0.02, '#adb5bd', 0, 0.2 + i * 0.07, 0)); g.rotation.x = Math.PI / 2; return g; }
function hammerMesh(handle, head, size) { const g = new THREE.Group(); g.add(box(0.05, 0.55, 0.05, handle, 0, -0.1, 0.08)); g.add(box(size * 0.8, size, size * 1.6, head, 0, -0.42, 0.14)); g.rotation.x = Math.PI / 2; return g; }
function rodMesh(c) { const g = new THREE.Group(); g.add(box(0.035, 1.6, 0.035, c, 0, 0.6, 0)); g.add(box(0.01, 0.6, 0.01, '#eeeeee', 0, 1.1, 0.25)); g.rotation.x = Math.PI / 2.6; return g; }
// lefty = สลับมือ: อาวุธอยู่มือซ้าย โล่อยู่มือขวา
export function setHeldTool(g, tool, lefty) {
  const u = g.userData; lefty = lefty === undefined ? !!u.lefty : !!lefty;
  if (u.tool === tool && !!u.lefty === lefty && u.toolSet) return;
  u.toolSet = true; u.hand.clear(); u.lHand?.clear(); u.tool = tool;
  if (!!u.lefty !== lefty) { u.lefty = lefty; placeShield(u); }
  const base = String(tool || '').split('~')[0], hand = lefty && u.lHand ? u.lHand : u.hand;
  if (TOOL_MESH[base]) {
    const m = TOOL_MESH[base](); hand.add(m);
    // คบเพลิงส่องสว่างรอบตัว
    if (base === 'torch' && GFX.mode !== 'low') { const L = new THREE.PointLight('#ffa94d', 2.2, 16, 1.5); L.position.y = 0.7; m.add(L); u.torchLight = L; } else u.torchLight = null;
    u.flame = m.userData.flame || null;
    applyGlow(m, plusLv(tool), u);
  } else { u.torchLight = null; u.flame = null; u.glow = null; }
}
function placeShield(u) {
  if (!u.shield) return;
  // โล่อยู่ด้านนอกของแขน (แขนซ้าย = +x · แขนขวา = -x) · คบเพลิงมือรองอยู่ในมือ
  (u.lefty ? u.rArm : u.lArm).add(u.shield); u.shield.position.x = u.shield.userData.torch ? 0 : u.lefty ? -0.13 : 0.13;
}

export function makeAnimal(type) {
  const g = new THREE.Group();
  const legs = [];
  const addLegs = (c, w, h, sx, sz) => {
    for (const [x, z] of [[-sx, sz], [sx, sz], [-sx, -sz], [sx, -sz]]) { const l = limb(w, h, w, c, x, h, z); legs.push(l); g.add(l); }
  };
  if (type === 'boar') {
    g.add(box(0.7, 0.6, 1.2, '#5e3b28', 0, 0.75, 0)); g.add(box(0.5, 0.45, 0.4, '#4a2e1f', 0, 0.75, 0.75));
    g.add(box(0.06, 0.06, 0.2, '#eee', -0.15, 0.62, 0.95)); g.add(box(0.06, 0.06, 0.2, '#eee', 0.15, 0.62, 0.95));
    addLegs('#3b2518', 0.16, 0.45, 0.22, 0.4);
  } else if (type === 'deer') {
    g.add(box(0.5, 0.55, 1.2, '#a0703c', 0, 1.1, 0)); g.add(box(0.3, 0.35, 0.4, '#a0703c', 0, 1.55, 0.65));
    g.add(box(0.05, 0.4, 0.05, '#6b4c2a', -0.1, 1.9, 0.6)); g.add(box(0.05, 0.4, 0.05, '#6b4c2a', 0.1, 1.9, 0.6));
    addLegs('#7a5530', 0.1, 0.85, 0.18, 0.45);
  } else if (type === 'chicken') {
    g.add(box(0.3, 0.3, 0.4, '#f5f5f5', 0, 0.35, 0)); g.add(box(0.18, 0.2, 0.18, '#f5f5f5', 0, 0.6, 0.18));
    g.add(box(0.06, 0.1, 0.12, '#e63946', 0, 0.75, 0.18)); g.add(box(0.06, 0.05, 0.1, '#f4a261', 0, 0.58, 0.3));
    addLegs('#f4a261', 0.04, 0.2, 0.06, 0.0);
  } else if (type === 'dog') {
    g.add(box(0.35, 0.35, 0.8, '#c9a227', 0, 0.55, 0)); g.add(box(0.3, 0.3, 0.32, '#c9a227', 0, 0.8, 0.5));
    g.add(box(0.2, 0.14, 0.18, '#a07d16', 0, 0.74, 0.72)); g.add(box(0.08, 0.14, 0.06, '#7a5e10', -0.1, 1.0, 0.45)); g.add(box(0.08, 0.14, 0.06, '#7a5e10', 0.1, 1.0, 0.45));
    const tail = box(0.07, 0.07, 0.35, '#c9a227', 0, 0.7, -0.5); tail.rotation.x = 0.6; g.add(tail);
    addLegs('#a07d16', 0.1, 0.38, 0.12, 0.28);
  } else if (type === 'cat') {
    g.add(box(0.22, 0.22, 0.5, '#555', 0, 0.35, 0)); g.add(box(0.22, 0.2, 0.2, '#555', 0, 0.5, 0.3));
    g.add(box(0.05, 0.08, 0.04, '#444', -0.07, 0.64, 0.3)); g.add(box(0.05, 0.08, 0.04, '#444', 0.07, 0.64, 0.3));
    const tail = box(0.05, 0.05, 0.4, '#555', 0, 0.55, -0.35); tail.rotation.x = -0.8; g.add(tail);
    addLegs('#444', 0.07, 0.25, 0.07, 0.17);
  } else if (type === 'raptor') {
    // แร็พเตอร์: เดินสองขา หางยาว กรงเล็บ
    const c = '#6a994e', d = '#386641';
    g.add(box(0.5, 0.55, 1.1, c, 0, 1.05, 0)); g.add(box(0.36, 0.36, 0.6, c, 0, 1.45, 0.65)); g.add(box(0.3, 0.12, 0.4, '#f2e8cf', 0, 1.32, 0.85));
    g.add(box(0.06, 0.06, 0.06, '#ffd60a', -0.13, 1.55, 0.85), box(0.06, 0.06, 0.06, '#ffd60a', 0.13, 1.55, 0.85));
    const tail = box(0.22, 0.22, 1.3, d, 0, 1.15, -1.1); tail.rotation.x = -0.15; g.add(tail);
    for (let i = 0; i < 4; i++) g.add(box(0.06, 0.16, 0.12, '#bc4749', 0, 1.36, 0.3 - i * 0.28));
    g.add(box(0.08, 0.3, 0.08, d, -0.22, 0.95, 0.45), box(0.08, 0.3, 0.08, d, 0.22, 0.95, 0.45));
    for (const x of [-0.18, 0.18]) { const l = limb(0.16, 0.8, 0.2, d, x, 0.8, -0.1); legs.push(l); g.add(l); }
  } else if (type === 'tiger') {
    // เสือโคร่ง: สีส้ม ลายดำ
    const c = '#f77f00', d = '#1b1b1b';
    g.add(box(0.6, 0.55, 1.4, c, 0, 0.85, 0)); g.add(box(0.5, 0.45, 0.45, c, 0, 1.05, 0.85)); g.add(box(0.3, 0.2, 0.2, '#fefae0', 0, 0.95, 1.1));
    for (let i = 0; i < 5; i++) g.add(box(0.62, 0.56, 0.06, d, 0, 0.86, -0.55 + i * 0.27));
    g.add(box(0.1, 0.12, 0.08, c, -0.16, 1.32, 0.8), box(0.1, 0.12, 0.08, c, 0.16, 1.32, 0.8));
    const tail = box(0.1, 0.1, 0.8, c, 0, 1.0, -1.05); tail.rotation.x = -0.4; g.add(tail);
    addLegs(c, 0.16, 0.6, 0.22, 0.5);
  } else if (type === 'trike') {
    // ไทรเซอราทอปส์: ตัวใหญ่ สี่ขา แผงคอ สามเขา
    const c = '#9c6644', d = '#7f5539';
    g.add(box(1.4, 1.2, 2.4, c, 0, 1.4, 0)); g.add(box(0.9, 0.8, 0.9, c, 0, 1.4, 1.55));
    g.add(box(1.6, 1.2, 0.12, '#bc6c25', 0, 1.9, 1.15));
    g.add(box(0.1, 0.1, 0.7, '#f2e8cf', -0.3, 1.85, 1.95), box(0.1, 0.1, 0.7, '#f2e8cf', 0.3, 1.85, 1.95), box(0.09, 0.09, 0.4, '#f2e8cf', 0, 1.45, 2.1));
    const tail = box(0.4, 0.4, 1.1, d, 0, 1.2, -1.6); tail.rotation.x = 0.3; g.add(tail);
    addLegs(d, 0.36, 0.9, 0.5, 0.8);
  } else if (type === 'duck') {
    g.add(box(0.3, 0.26, 0.45, '#f8f9fa', 0, 0.3, 0)); g.add(box(0.18, 0.2, 0.18, '#f8f9fa', 0, 0.55, 0.2));
    g.add(box(0.14, 0.05, 0.16, '#f4a261', 0, 0.52, 0.34)); g.add(box(0.04, 0.04, 0.02, '#111', -0.06, 0.6, 0.29), box(0.04, 0.04, 0.02, '#111', 0.06, 0.6, 0.29));
    addLegs('#f4a261', 0.05, 0.16, 0.07, 0.0);
  } else if (type === 'pig') {
    g.add(box(0.6, 0.5, 0.9, '#ffafcc', 0, 0.55, 0)); g.add(box(0.42, 0.4, 0.32, '#ffafcc', 0, 0.62, 0.55));
    g.add(box(0.22, 0.16, 0.08, '#ff8fab', 0, 0.56, 0.74)); g.add(box(0.1, 0.1, 0.05, '#ff8fab', -0.13, 0.86, 0.5), box(0.1, 0.1, 0.05, '#ff8fab', 0.13, 0.86, 0.5));
    addLegs('#ff8fab', 0.13, 0.3, 0.2, 0.3);
  } else if (type === 'cow') {
    g.add(box(0.75, 0.7, 1.4, '#f8f9fa', 0, 1.0, 0)); for (const [x, z] of [[0.2, 0.2], [-0.25, -0.35], [0.3, -0.45]]) g.add(box(0.36, 0.5, 0.3, '#222', x, 1.02, z));
    g.add(box(0.45, 0.45, 0.5, '#f8f9fa', 0, 1.2, 0.85)); g.add(box(0.36, 0.2, 0.12, '#ffc8dd', 0, 1.05, 1.12));
    g.add(box(0.06, 0.18, 0.06, '#e9d8a6', -0.18, 1.5, 0.8), box(0.06, 0.18, 0.06, '#e9d8a6', 0.18, 1.5, 0.8));
    g.add(box(0.2, 0.12, 0.2, '#ffc8dd', 0, 0.62, -0.2));
    addLegs('#e9ecef', 0.16, 0.65, 0.25, 0.5);
  } else if (type === 'elephant') {
    // ช้างป่า: ตัวใหญ่สีเทา หูใหญ่ งวง งา
    const c = '#8d8d8d', d = '#6c6c6c';
    g.add(box(1.6, 1.5, 2.6, c, 0, 2.2, 0)); g.add(box(1.1, 1.1, 1.0, c, 0, 2.6, 1.6));
    g.add(box(0.12, 1.0, 0.9, d, -0.65, 2.6, 1.35), box(0.12, 1.0, 0.9, d, 0.65, 2.6, 1.35));
    const trunk = box(0.3, 1.4, 0.3, d, 0, 1.75, 2.15); trunk.rotation.x = 0.15; g.add(trunk);
    g.add(box(0.1, 0.1, 0.6, '#f8f9fa', -0.3, 2.05, 2.25), box(0.1, 0.1, 0.6, '#f8f9fa', 0.3, 2.05, 2.25));
    g.add(box(0.1, 0.8, 0.1, d, 0, 2.1, -1.35));
    addLegs(d, 0.45, 1.45, 0.5, 0.85);
  } else if (type === 'buffalo') {
    // ควาย: สีเทาเข้ม เขาโค้งใหญ่
    const c = '#3d3d3d', d = '#2b2b2b';
    g.add(box(0.85, 0.8, 1.6, c, 0, 1.05, 0)); g.add(box(0.5, 0.5, 0.55, c, 0, 1.15, 0.95)); g.add(box(0.36, 0.22, 0.14, '#555', 0, 1.0, 1.25));
    for (const sx of [-1, 1]) { const h = box(0.5, 0.1, 0.12, '#cdbb99', sx * 0.45, 1.45, 0.85); h.rotation.z = sx * -0.5; g.add(h); }
    const tail = box(0.06, 0.6, 0.06, d, 0, 1.0, -0.85); tail.rotation.x = 0.25; g.add(tail);
    addLegs(d, 0.18, 0.7, 0.28, 0.55);
  } else if (type === 'sheep') {
    // แกะ: ขนฟูสีขาว หน้าดำ
    g.add(box(0.6, 0.55, 0.85, '#f5f0e6', 0, 0.7, 0)); g.add(box(0.66, 0.2, 0.9, '#ebe4d6', 0, 0.98, 0));
    g.add(box(0.28, 0.3, 0.3, '#2b2b2b', 0, 0.85, 0.55)); g.add(box(0.12, 0.06, 0.1, '#2b2b2b', -0.18, 0.92, 0.5), box(0.12, 0.06, 0.1, '#2b2b2b', 0.18, 0.92, 0.5));
    addLegs('#2b2b2b', 0.09, 0.42, 0.18, 0.28);
  } else if (type === 'bird') {
    g.add(box(0.16, 0.16, 0.28, '#1d1d1d', 0, 0.15, 0)); g.add(box(0.06, 0.05, 0.1, '#f4d35e', 0, 0.18, 0.18));
    const wl = box(0.3, 0.03, 0.16, '#222', -0.2, 0.2, 0), wr = box(0.3, 0.03, 0.16, '#222', 0.2, 0.2, 0);
    g.add(wl, wr); g.userData.wings = [wl, wr];
  }
  g.userData.legs = legs; g.userData.phase = Math.random() * 6;
  return g;
}
// อุปกรณ์สัตว์เลี้ยง 5 ช่อง (กล่องเล็ก ๆ ติดบนตัว) — สีมาจาก ITEMS[k].petGear.color
// [กว้าง สูง ยาวลำตัว, y ลำตัว, y คอ, z คอ, y หัว, z หัว, ขนาดหัว, ตำแหน่งขา [x,z]]
const PET_BODY = {
  dog: [0.35, 0.35, 0.8, 0.55, 0.78, 0.36, 0.95, 0.5, 0.32, [0.12, 0.28]],
  cat: [0.22, 0.22, 0.5, 0.35, 0.5, 0.2, 0.62, 0.3, 0.22, [0.07, 0.17]],
  bird: [0.16, 0.16, 0.28, 0.15, 0.2, 0.1, 0.25, 0.14, 0.16, null],
  deer: [0.5, 0.55, 1.2, 1.1, 1.35, 0.5, 1.55, 0.65, 0.3, [0.18, 0.45]],
  boar: [0.7, 0.6, 1.2, 0.75, 0.85, 0.55, 0.85, 0.75, 0.45, [0.22, 0.4]],
  chicken: [0.3, 0.3, 0.4, 0.35, 0.5, 0.15, 0.6, 0.18, 0.18, [0.06, 0.0]],
  duck: [0.3, 0.3, 0.45, 0.33, 0.48, 0.18, 0.58, 0.2, 0.18, [0.06, 0.0]],
  raptor: [0.5, 0.55, 1.1, 1.05, 1.3, 0.4, 1.45, 0.65, 0.36, [0.18, -0.1]],
  trike: [1.4, 1.2, 2.4, 1.4, 1.6, 1.15, 1.8, 1.55, 0.9, [0.5, 0.8]],
  tiger: [0.6, 0.55, 1.4, 0.85, 1.0, 0.65, 1.15, 0.85, 0.5, [0.22, 0.5]],
  buffalo: [0.85, 0.8, 1.6, 1.05, 1.15, 0.75, 1.15, 0.95, 0.5, [0.28, 0.55]],
  sheep: [0.6, 0.55, 0.85, 0.7, 0.85, 0.4, 0.85, 0.55, 0.3, [0.18, 0.28]],
};
export function setPetGear(g, type, gear, ITEMS) {
  if (g.userData.gear) g.remove(g.userData.gear);
  const grp = new THREE.Group(); g.add(grp); g.userData.gear = grp;
  const [w, h, d, y, ny, nz, hy, hz, hs, legs] = PET_BODY[type];
  const col = (k, def) => ITEMS?.[k]?.petGear?.color || def;
  const G = Object.fromEntries(Object.entries(gear || {}).map(([s, k]) => [s, k ? String(k).split('~')[0] : k]));
  if (G.head) { grp.add(box(hs * 1.1, hs * (G.head === 'pet_helmet' ? 0.45 : 0.3), hs * 1.1, col(G.head, '#e63946'), 0, hy + hs * 0.25, hz - 0.02)); if (G.head === 'pet_cap') grp.add(box(hs * 0.9, 0.03, hs * 0.5, col(G.head), 0, hy + hs * 0.1, hz + hs * 0.6)); }
  if (G.neck) { grp.add(box(w * 0.95, h * 0.2, w * 0.7, col(G.neck, '#e63946'), 0, ny, nz)); if (G.neck === 'pet_collar') for (const sx of [-1, 1]) grp.add(box(0.05, 0.05, 0.08, '#adb5bd', sx * w * 0.48, ny, nz)); if (G.neck === 'pet_bell') grp.add(box(0.07, 0.07, 0.07, '#ffd166', 0, ny - h * 0.15, nz + w * 0.35)); }
  if (G.body) {
    if (G.body === 'pet_bag') grp.add(box(w + 0.16, h * 0.45, d * 0.35, col(G.body), 0, y + h * 0.35, -d * 0.1));
    else { grp.add(box(w + 0.06, h * 0.7, d * 0.7, col(G.body, '#556b2f'), 0, y + 0.02, 0)); if (G.body === 'pet_kevlar') grp.add(box(w + 0.08, h * 0.3, d * 0.4, '#495057', 0, y + h * 0.3, 0)); }
  }
  if (G.weapon) for (const sx of [-1, 1]) grp.add(box(0.05, 0.04, 0.12, col(G.weapon, '#ced4da'), sx * w * 0.3, legs ? 0.04 : y, legs ? d * 0.45 : nz + 0.12));
  if (G.feet && legs) for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) grp.add(box(0.09, 0.06, 0.11, col(G.feet, '#f1faee'), lx * legs[0], 0.03, lz * legs[1]));
}

export function animateAnimal(g, dt, speed) {
  const u = g.userData; u.phase += dt * (3 + speed * 2);
  u.legs.forEach((l, i) => { l.rotation.x = Math.sin(u.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * Math.min(0.7, speed * 0.2); });
  if (u.wings) { const f = Math.sin(u.phase * 3) * 0.7; u.wings[0].rotation.z = f; u.wings[1].rotation.z = -f; }
}

export function makeCampfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const l = box(0.12, 0.12, 0.9, '#5c3d2e', 0, 0.1, 0); l.rotation.y = (i / 5) * Math.PI; g.add(l);
  }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.add(box(0.2, 0.15, 0.2, '#777', Math.cos(a) * 0.55, 0.07, Math.sin(a) * 0.55)); }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 6), new THREE.MeshBasicMaterial({ color: '#ff9f1c', transparent: true, opacity: 0.9 }));
  flame.position.y = 0.5; g.add(flame);
  const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6), new THREE.MeshBasicMaterial({ color: '#ffe066' }));
  flame2.position.y = 0.4; g.add(flame2);
  g.userData.flame = flame;
  return g;
}
export function makeShelter() {
  const g = new THREE.Group();
  const roofM = mat('#a68a64');
  const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 3.2), roofM); l.position.set(-0.85, 1.05, 0); l.rotation.z = -0.62; l.castShadow = true;
  const r = l.clone(); r.position.x = 0.85; r.rotation.z = 0.62;
  g.add(l, r);
  g.add(box(0.12, 2.2, 0.12, '#6b4f2c', 0, 1.1, 1.5), box(0.12, 2.2, 0.12, '#6b4f2c', 0, 1.1, -1.5));
  g.add(box(0.9, 0.15, 1.9, '#d9c7a1', 0, 0.08, 0));
  return g;
}

export const WATCHTOWER_H = 4.5;
// หอสังเกตการณ์ไม้: เสา 4 ต้น พื้นยกสูง บันได และราวกันตก
export function makeWatchtower() {
  const g = new THREE.Group(), H = WATCHTOWER_H;
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) g.add(box(0.2, H + 1.2, 0.2, '#6b4f2c', x, (H + 1.2) / 2, z));
  g.add(box(2.7, 0.2, 2.7, '#a68a64', 0, H, 0));
  for (const [x, z, w, d] of [[0, -1.3, 2.7, 0.08], [0, 1.3, 2.7, 0.08], [-1.3, 0, 0.08, 2.7]]) g.add(box(w, 0.08, d, '#7f5539', x, H + 0.9, z));
  for (let y = 0.4; y < H; y += 0.55) g.add(box(0.08, 0.06, 0.9, '#7f5539', 1.42, y, 0)); // ขั้นบันได
  g.add(box(0.08, H, 0.08, '#6b4f2c', 1.42, H / 2, -0.45), box(0.08, H, 0.08, '#6b4f2c', 1.42, H / 2, 0.45));
  return g;
}

// ป้ายทุกอันจำข้อความเดิมไว้ เปลี่ยนภาษาแล้ววาดใหม่ได้
const labels = new Set();
onLang(() => { for (const r of labels) { const s = r.deref(); if (!s) labels.delete(r); else if (s.userData.raw) s.userData.set(...s.userData.raw); } });
export function makeLabel(text, color = '#fff') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  sp.scale.set(2.4, 0.6, 1); sp.renderOrder = 10;
  sp.userData.set = (t0, col = color) => {
    const t = tr(t0); if (!sp.userData.raw) labels.add(new WeakRef(sp)); sp.userData.raw = [t0, col];
    const x = c.getContext('2d'); x.clearRect(0, 0, 256, 64);
    x.font = 'bold 26px Sarabun, Tahoma, sans-serif'; x.textAlign = 'center';
    x.fillStyle = 'rgba(0,0,0,.55)'; const w = Math.min(250, x.measureText(t).width + 18); x.fillRect(128 - w / 2, 12, w, 40);
    x.fillStyle = col; x.fillText(t, 128, 42); sp.material.map.needsUpdate = true;
  };
  sp.userData.set(text, color);
  return sp;
}
