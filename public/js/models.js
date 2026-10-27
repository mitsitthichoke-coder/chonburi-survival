import * as THREE from 'three';

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

export const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

// ตัวละครมนุษย์ low-poly  look = {skin, shirt, pants, hair}
// ทรงผม (เลือกได้ตอนสร้างตัวละคร)
export const HAIR_STYLES = { short: 'สั้น', buzz: 'เกรียน', spiky: 'ตั้งชี้', mohawk: 'โมฮอว์ก', afro: 'แอฟโฟร', bob: 'บ็อบ', long: 'ยาว', ponytail: 'หางม้า', bun: 'มวยผม', twin: 'แกะสองข้าง', bald: 'โล้น' };
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
    case 'bald': break;
  }
}
export function makeHuman(sex = 'm', look = {}, kind = 'human') {
  const skin = kind === 'zombie' ? '#7d9a6a' : look.skin || SKINS[0];
  const shirt = look.shirt || (sex === 'f' ? '#d1495b' : '#2e86ab');
  const pants = look.pants || '#3d405b';
  const hair = look.hair || '#1b1b1b';
  const s = kind === 'child' ? 0.55 : kind === 'baby' ? 0.32 : 1;
  const g = new THREE.Group();
  const inner = new THREE.Group(); inner.scale.setScalar(s); g.add(inner);
  const shoulder = sex === 'f' ? 0.5 : 0.6;
  const body = box(shoulder, 0.7, 0.3, shirt, 0, 1.25, 0); inner.add(body);
  if (sex === 'f') inner.add(box(0.56, 0.22, 0.34, shirt, 0, 0.98, 0));
  const head = new THREE.Group(); head.position.set(0, 1.62, 0); inner.add(head);
  head.add(box(0.34, 0.36, 0.34, skin, 0, 0.12, 0));
  addHair(head, kind === 'zombie' ? (sex === 'f' ? 'long' : 'short') : look.style, sex, hair);
  // ตา
  const eyeC = kind === 'zombie' ? '#e63946' : '#111';
  head.add(box(0.06, 0.05, 0.02, eyeC, -0.08, 0.15, 0.175));
  head.add(box(0.06, 0.05, 0.02, eyeC, 0.08, 0.15, 0.175));
  const lArm = limb(0.14, 0.62, 0.14, shirt, -shoulder / 2 - 0.08, 1.58, 0);
  const rArm = limb(0.14, 0.62, 0.14, shirt, shoulder / 2 + 0.08, 1.58, 0);
  lArm.children[0].add(box(0.12, 0.14, 0.12, skin, 0, -0.34, 0));
  rArm.children[0].add(box(0.12, 0.14, 0.12, skin, 0, -0.34, 0));
  const lLeg = limb(0.18, 0.9, 0.2, pants, -0.13, 0.9, 0);
  const rLeg = limb(0.18, 0.9, 0.2, pants, 0.13, 0.9, 0);
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

// เสื้อผ้าที่สวม: ซ้อนกล่องสีบนส่วนต่าง ๆ ของตัว (wear = {head, body, legs, hands, socks, shoes, back} → key ของไอเท็ม)
export function setOutfit(g, wear, ITEMS) {
  const u = g.userData;
  for (const o of u.outfit || []) o.parent?.remove(o);
  const out = u.outfit = []; u.shield = null;
  const put = (parent, o) => { parent.add(o); out.push(o); return o; };
  const W = (slot) => wear?.[slot] && ITEMS[wear[slot]]?.wear;
  const sw = u.sex === 'f' ? 0.5 : 0.6;
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
  if (of) {
    // โล่บนแขนซ้าย หันออกด้านนอก
    const s = of.size || 1, sh = new THREE.Group(); sh.position.set(-0.13, -0.42, 0.06);
    if (of.round) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 0.05, 14), new THREE.MeshLambertMaterial({ color: of.color })); m.rotation.z = Math.PI / 2; sh.add(m); }
    else sh.add(box(0.05, 0.55 * s, 0.42 * Math.min(s, 1.15), of.color, 0, 0, 0));
    sh.add(box(0.07, 0.1, 0.1, '#ced4da', -0.03, 0, 0));
    if (wear.off === 'shield_riot') sh.add(box(0.055, 0.12, 0.3, '#90e0ef', -0.005, 0.28 * s, 0));
    put(u.lArm, sh); u.shield = sh; placeShield(u);
  }
  const bk = W('back');
  if (bk) { const s = 0.7 + bk.lvl * 0.15; put(u.inner, box(0.42 * s, 0.5 * s, 0.22 * s, bk.color, 0, 1.25, -0.27)); if (bk.lvl > 1) put(u.inner, box(0.36 * s, 0.12, 0.26 * s, '#333', 0, 1.25 + 0.27 * s, -0.27)); }
}

export function animateHuman(g, dt, speed, attacking = 0, mode = null) {
  const u = g.userData;
  if (mode === 'climb' || mode === 'down') {
    // ท่าปีน: มือเอื้อมขึ้นสลับซ้ายขวา ขาถีบกำแพงสลับกัน ตัวเอนเข้าหากำแพง
    u.phase += dt * (mode === 'climb' ? 7 : 9);
    const a = Math.sin(u.phase);
    u.lArm.rotation.x = -2.7 + a * 0.45; u.rArm.rotation.x = -2.7 - a * 0.45;
    u.lArm.rotation.z = -0.15; u.rArm.rotation.z = 0.15;
    u.lLeg.rotation.x = -0.7 - Math.max(0, -a) * 0.6; u.rLeg.rotation.x = -0.7 - Math.max(0, a) * 0.6;
    u.inner.rotation.x = 0.18; u.head.rotation.x = -0.35; u.inner.position.y = 0;
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
  u.lArm.rotation.z = 0; u.rArm.rotation.z = 0; u.inner.rotation.x = 0; u.head.rotation.x = 0; u.inner.position.y = 0;
  u.phase += dt * (2 + speed * 1.6);
  const sw = Math.min(1, speed / 4) * 0.8;
  const a = Math.sin(u.phase) * sw;
  u.lLeg.rotation.x = a; u.rLeg.rotation.x = -a;
  if (u.kind === 'zombie') { u.lArm.rotation.x = -1.3 + a * 0.2; u.rArm.rotation.x = -1.4 - a * 0.2; u.head.rotation.z = Math.sin(u.phase * 0.3) * 0.3; }
  else {
    // แขนที่ถืออาวุธเป็นแขนที่ฟัน (สลับมือได้)
    const [wpn, off] = u.lefty ? [u.lArm, u.rArm] : [u.rArm, u.lArm];
    off.rotation.x = u.lefty ? a * 0.8 : -a * 0.8;
    wpn.rotation.x = attacking > 0 ? -2.4 + (1 - attacking) * 2.6 : (u.lefty ? -a * 0.8 : a * 0.8);
  }
}

const TOOL_MESH = {
  stone_axe: () => { const g = new THREE.Group(); g.add(box(0.06, 0.7, 0.06, '#7f5539', 0, -0.2, 0.1)); g.add(box(0.08, 0.18, 0.22, '#8a8a8a', 0, -0.5, 0.2)); g.rotation.x = Math.PI / 2; return g; },
  spear: () => { const g = new THREE.Group(); g.add(box(0.05, 1.8, 0.05, '#9c6644', 0, 0, 0)); g.add(box(0.08, 0.25, 0.08, '#cccccc', 0, 0.95, 0)); g.rotation.x = Math.PI / 2; return g; },
  machete: () => { const g = new THREE.Group(); g.add(box(0.06, 0.18, 0.06, '#222', 0, 0, 0)); g.add(box(0.03, 0.6, 0.1, '#c0c0c0', 0, 0.38, 0)); g.rotation.x = Math.PI / 2; return g; },
};
// lefty = สลับมือ: อาวุธอยู่มือซ้าย โล่อยู่มือขวา
export function setHeldTool(g, tool, lefty) {
  const u = g.userData; lefty = lefty === undefined ? !!u.lefty : !!lefty;
  if (u.tool === tool && !!u.lefty === lefty && u.toolSet) return;
  u.toolSet = true; u.hand.clear(); u.lHand?.clear(); u.tool = tool;
  if (!!u.lefty !== lefty) { u.lefty = lefty; placeShield(u); }
  if (TOOL_MESH[tool]) (lefty && u.lHand ? u.lHand : u.hand).add(TOOL_MESH[tool]());
}
function placeShield(u) {
  if (!u.shield) return;
  (u.lefty ? u.rArm : u.lArm).add(u.shield); u.shield.position.x = u.lefty ? 0.13 : -0.13;
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
};
export function setPetGear(g, type, gear, ITEMS) {
  if (g.userData.gear) g.remove(g.userData.gear);
  const grp = new THREE.Group(); g.add(grp); g.userData.gear = grp;
  const [w, h, d, y, ny, nz, hy, hz, hs, legs] = PET_BODY[type];
  const col = (k, def) => ITEMS?.[k]?.petGear?.color || def;
  const G = gear || {};
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

export function makeLabel(text, color = '#fff') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  sp.scale.set(2.4, 0.6, 1); sp.renderOrder = 10;
  sp.userData.set = (t, col = color) => {
    const x = c.getContext('2d'); x.clearRect(0, 0, 256, 64);
    x.font = 'bold 26px Sarabun, Tahoma, sans-serif'; x.textAlign = 'center';
    x.fillStyle = 'rgba(0,0,0,.55)'; const w = Math.min(250, x.measureText(t).width + 18); x.fillRect(128 - w / 2, 12, w, 40);
    x.fillStyle = col; x.fillText(t, 128, 42); sp.material.map.needsUpdate = true;
  };
  sp.userData.set(text, color);
  return sp;
}
