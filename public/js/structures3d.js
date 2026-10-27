// โมเดล 3D ของชิ้นส่วนบ้าน รั้ว ฟาร์ม เล้าไก่ บ่อปลา และยานพาหนะ
import * as THREE from 'three';
import { mat, makeAnimal, animateAnimal, makeCampfire, makeShelter, makeWatchtower } from './models.js';
import { G, WALL_H, FENCE_H, CROPS, cropProgress, coopEggs, pondFish, baseY } from './building-core.js';

const WOOD = '#a0764a', WOOD_D = '#7f5539', PLANK = '#c49a6c', ROOF = '#8d5b3a';
function box(w, h, d, c, x = 0, y = 0, z = 0, m) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || mat(c));
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
}

// แนวผนัง: สร้างในแนวแกน x แล้วหมุนตาม rot
function edgeGroup(s) { const g = new THREE.Group(); g.rotation.y = (s.rot & 1) ? Math.PI / 2 : 0; return g; }

export function makeStructureMesh(s) {
  const root = new THREE.Group();
  root.position.set(s.x, s.type === 'vehicle' ? 0 : baseY(s), s.z);
  root.userData.s = s;
  const add = (o) => (root.add(o), o);
  switch (s.type) {
    case 'campfire': add(makeCampfire()); root.userData.flame = root.children[0].userData.flame; break;
    case 'shelter': { const m = add(makeShelter()); m.rotation.y = s.ry || 0; break; }
    case 'watchtower': add(makeWatchtower()); break;
    case 'foundation': { const h = 0.5 + (s.drop || 0); add(box(G, h, G, '#8a7a66', 0, 0.5 - h / 2, 0)); } add(box(G - 0.1, 0.04, G - 0.1, PLANK, 0, 0.51, 0)); break;
    case 'wall': case 'window': case 'door': {
      const g = add(edgeGroup(s));
      if (s.type === 'wall') g.add(box(G, WALL_H, 0.3, WOOD, 0, WALL_H / 2, 0));
      else if (s.type === 'window') {
        g.add(box(G, 1, 0.3, WOOD, 0, 0.5, 0), box(G, 0.7, 0.3, WOOD, 0, WALL_H - 0.35, 0));
        g.add(box(0.9, 1.3, 0.3, WOOD, -1.05, 1.65, 0), box(0.9, 1.3, 0.3, WOOD, 1.05, 1.65, 0));
        g.add(box(1.2, 1.3, 0.05, '#9ecae1', 0, 1.65, 0, new THREE.MeshLambertMaterial({ color: '#9ecae1', transparent: true, opacity: 0.35 })));
      } else {
        g.add(box(0.9, WALL_H, 0.3, WOOD, -1.05, WALL_H / 2, 0), box(0.9, WALL_H, 0.3, WOOD, 1.05, WALL_H / 2, 0), box(1.2, 0.7, 0.3, WOOD, 0, WALL_H - 0.35, 0));
        const hinge = new THREE.Group(); hinge.position.set(-0.6, 0, 0); g.add(hinge);
        hinge.add(box(1.2, 2.3, 0.12, WOOD_D, 0.6, 1.15, 0), box(0.1, 0.1, 0.18, '#ffd166', 1.05, 1.1, 0));
        root.userData.hinge = hinge;
      }
      break;
    }
    case 'fence': case 'gate': {
      const g = add(edgeGroup(s));
      if (s.type === 'fence') {
        for (const x of [-1.4, 0, 1.4]) g.add(box(0.14, FENCE_H, 0.14, WOOD_D, x, FENCE_H / 2, 0));
        for (const y of [0.5, 1.2, FENCE_H - 0.1]) g.add(box(G, 0.12, 0.08, WOOD, 0, y, 0));
      } else {
        g.add(box(0.25, FENCE_H + 0.2, 0.25, WOOD_D, -1.35, (FENCE_H + 0.2) / 2, 0), box(0.25, FENCE_H + 0.2, 0.25, WOOD_D, 1.35, (FENCE_H + 0.2) / 2, 0));
        const hinge = new THREE.Group(); hinge.position.set(-1.2, 0, 0); g.add(hinge);
        for (const y of [0.4, 1.0, 1.6]) hinge.add(box(2.4, 0.14, 0.08, WOOD, 1.2, y, 0));
        hinge.add(box(0.1, 1.4, 0.08, WOOD, 0.3, 1.0, 0), box(0.1, 1.4, 0.08, WOOD, 2.1, 1.0, 0));
        root.userData.hinge = hinge;
      }
      break;
    }
    case 'roof': add(box(G + 0.1, 0.2, G + 0.1, ROOF, 0, 0.1, 0)); add(box(G + 0.1, 0.03, G + 0.1, '#6d4c32', 0, 0.215, 0)); break;
    case 'stairs': {
      const g = add(new THREE.Group()); g.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][s.rot & 3];
      // ขึ้นไปทาง -z ของกลุ่ม (หมุนให้ตรงกับทิศ rot)
      for (let i = 0; i < 8; i++) { const h = ((i + 1) / 8) * WALL_H; g.add(box(G - 0.4, 0.16, G / 8 + 0.02, PLANK, 0, h - 0.08, G / 2 - (i + 0.5) * (G / 8))); g.add(box(0.12, h, 0.12, WOOD_D, -(G / 2 - 0.25), h / 2, G / 2 - (i + 0.5) * (G / 8))); }
      break;
    }
    case 'bed': {
      const g = add(new THREE.Group()); g.rotation.y = (s.rot & 3) * Math.PI / 2;
      g.add(box(1.2, 0.4, 2.2, WOOD_D, 0, 0.2, 0), box(1.1, 0.18, 2.0, '#f1faee', 0, 0.48, 0.05), box(0.9, 0.14, 0.45, '#e5e5e5', 0, 0.62, -0.75), box(1.12, 0.06, 1.2, '#457b9d', 0, 0.6, 0.35));
      break;
    }
    case 'storage': { const g = add(new THREE.Group()); g.rotation.y = (s.rot & 3) * Math.PI / 2; g.add(box(1.2, 0.8, 0.8, WOOD_D, 0, 0.4, 0), box(1.25, 0.12, 0.85, WOOD, 0, 0.84, 0), box(0.16, 0.16, 0.05, '#ffd166', 0, 0.62, 0.42)); break; }
    case 'pethouse': {
      const g = add(new THREE.Group()); g.rotation.y = (s.rot & 3) * Math.PI / 2;
      g.add(box(1.6, 1.0, 1.6, '#e76f51', 0, 0.5, 0));
      const r1 = box(1.2, 0.08, 1.8, ROOF, -0.42, 1.25, 0); r1.rotation.z = 0.7; const r2 = r1.clone(); r2.position.x = 0.42; r2.rotation.z = -0.7; g.add(r1, r2);
      g.add(box(0.6, 0.65, 0.05, '#2b2d42', 0, 0.33, 0.81));
      break;
    }
    case 'plot': {
      add(box(2.7, 0.18, 2.7, '#5c4033', 0, 0.09, 0));
      for (let i = -1; i <= 1; i++) add(box(2.6, 0.06, 0.3, '#6f4e37', 0, 0.2, i * 0.85));
      root.userData.cropGroup = add(new THREE.Group());
      break;
    }
    case 'coop': {
      add(box(2.8, 0.12, 2.8, '#d4a373', 0, 0.06, 0));
      for (const [x, z, w, d] of [[0, -1.4, 2.8, 0.1], [0, 1.4, 2.8, 0.1], [-1.4, 0, 0.1, 2.8], [1.4, 0, 0.1, 2.8]]) add(box(w, 1.1, d, '#b08968', x, 0.55, z));
      add(box(1.4, 1.2, 1.2, WOOD, -0.6, 0.7, -0.7)); const r = box(1.6, 0.1, 1.5, ROOF, -0.6, 1.35, -0.7); r.rotation.z = 0.15; add(r);
      root.userData.hens = [makeAnimal('chicken'), makeAnimal('chicken')];
      root.userData.hens.forEach((h, i) => { h.position.set(0.3 + i * 0.5, 0.12, 0.4 - i * 0.6); root.add(h); });
      root.userData.eggs = add(new THREE.Group());
      break;
    }
    case 'pond': {
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add(box(0.6, 0.35, 0.6, '#8d8d86', Math.cos(a) * 1.3, 0.17, Math.sin(a) * 1.3)); }
      const w = new THREE.Mesh(new THREE.CircleGeometry(1.15, 20), new THREE.MeshPhongMaterial({ color: '#3a86a8', transparent: true, opacity: 0.85, shininess: 90 }));
      w.rotation.x = -Math.PI / 2; w.position.y = 0.22; add(w);
      root.userData.fishGroup = add(new THREE.Group());
      break;
    }
    case 'vehicle': add(makeVehicle(s.vt)); root.position.y = 0; break;
  }
  return root;
}

export function makeVehicle(vt) {
  const g = new THREE.Group();
  if (vt === 'bicycle') {
    for (const z of [-0.55, 0.55]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 6, 14), mat('#222')); w.rotation.y = Math.PI / 2; w.position.set(0, 0.35, z); g.add(w); }
    g.add(box(0.06, 0.06, 1.1, '#d62828', 0, 0.6, 0), box(0.06, 0.5, 0.06, '#d62828', 0, 0.55, -0.15), box(0.3, 0.06, 0.12, '#222', 0, 0.82, -0.2), box(0.5, 0.05, 0.05, '#adb5bd', 0, 0.95, 0.5));
  } else if (vt === 'motorbike') {
    for (const z of [-0.65, 0.65]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.12, 8, 16), mat('#1b1b1b')); w.rotation.y = Math.PI / 2; w.position.set(0, 0.36, z); g.add(w); }
    g.add(box(0.35, 0.35, 1.0, '#264653', 0, 0.62, 0), box(0.32, 0.12, 0.6, '#111', 0, 0.85, -0.15), box(0.6, 0.06, 0.06, '#adb5bd', 0, 1.0, 0.55), box(0.18, 0.18, 0.1, '#ffd166', 0, 0.85, 0.72));
  } else if (vt === 'pickup') {
    for (const x of [-0.8, 0.8]) for (const z of [-1.2, 1.2]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12), mat('#1b1b1b')); w.rotation.z = Math.PI / 2; w.position.set(x, 0.38, z); g.add(w); }
    g.add(box(1.7, 0.5, 3.6, '#bc4749', 0, 0.75, 0), box(1.6, 0.6, 1.3, '#bc4749', 0, 1.3, 0.45), box(1.5, 0.45, 0.06, '#8ecae6', 0, 1.35, 1.12));
    g.add(box(1.7, 0.4, 0.08, '#6a040f', 0, 1.15, -1.78), box(0.08, 0.4, 1.9, '#6a040f', -0.82, 1.15, -0.85), box(0.08, 0.4, 1.9, '#6a040f', 0.82, 1.15, -0.85));
    g.add(box(0.3, 0.15, 0.05, '#ffd166', -0.55, 0.85, 1.81), box(0.3, 0.15, 0.05, '#ffd166', 0.55, 0.85, 1.81), box(1.75, 0.12, 0.25, '#adb5bd', 0, 0.55, 1.85));
  } else {
    for (let i = -2; i <= 2; i++) g.add(box(0.36, 0.25, 3, i % 2 ? '#a3b18a' : '#bc9d6c', i * 0.38, 0.12, 0));
    g.add(box(0.06, 1.6, 0.06, WOOD_D, 0.6, 0.9, 1.2), box(0.06, 0.06, 1.2, WOOD_D, 0, 0.3, 0));
  }
  return g;
}

// อัปเดตภาพตามสถานะ (เปิดประตู พืชโต ไข่ ปลา) — เรียกเป็นระยะ
export function updateStructureMesh(root, now, dt) {
  const s = root.userData.s, u = root.userData;
  if (u.hinge) { const want = s.open ? -Math.PI / 2 * 0.95 : 0; u.hinge.rotation.y += (want - u.hinge.rotation.y) * Math.min(1, dt * 8); }
  if (u.cropGroup) {
    const key = s.crop ? `${s.crop}:${Math.floor(cropProgress(s, now) * 4)}` : '';
    if (u.cropKey !== key) {
      u.cropKey = key; u.cropGroup.clear();
      if (s.crop) {
        const p = cropProgress(s, now), C = CROPS[s.crop], ripe = p >= 1;
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          const h = 0.15 + p * (s.crop === 'corn' ? 1.6 : 0.6);
          const st = new THREE.Mesh(new THREE.ConeGeometry(0.12 + p * 0.15, h, 5), mat(p < 0.3 ? '#95d5b2' : '#40916c'));
          st.position.set(i * 0.8, 0.2 + h / 2, j * 0.85); u.cropGroup.add(st);
          if (ripe) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), mat(C.color)); f.position.set(i * 0.8 + 0.08, 0.25 + h * 0.75, j * 0.85); u.cropGroup.add(f); }
        }
      }
    }
    u.cropGroup.children.forEach((c) => { c.material.emissive?.setHex(0); });
  }
  if (u.hens) {
    const fed = (s.fed || 0) > now;
    u.hens.forEach((h, i) => { h.userData.t = (h.userData.t || i) + dt; h.position.x = 0.3 + i * 0.5 + Math.sin(h.userData.t * 0.7) * 0.4; h.rotation.y = Math.sin(h.userData.t * 0.5) * 2; animateAnimal(h, dt, fed ? 0.8 : 0.2); });
    const n = coopEggs(s, now);
    if (u.eggN !== n) { u.eggN = n; u.eggs.clear(); for (let i = 0; i < Math.min(n, 8); i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), mat('#fff8e7')); e.scale.y = 1.3; e.position.set(-0.9 + (i % 4) * 0.2, 0.2, -0.2 + Math.floor(i / 4) * 0.2); u.eggs.add(e); } }
  }
  if (u.fishGroup) {
    const n = Math.min(8, (s.stock || 0) + pondFish(s, now));
    if (u.fishN !== n) { u.fishN = n; u.fishGroup.clear(); for (let i = 0; i < n; i++) { const f = box(0.25, 0.06, 0.1, s.gold && i === 0 ? '#ffb703' : '#adb5bd', 0, 0.2, 0); f.userData.a = i * 0.8; u.fishGroup.add(f); } }
    u.fishGroup.children.forEach((f, i) => { f.userData.a += dt * (0.6 + i * 0.1); const r = 0.4 + (i % 3) * 0.25; f.position.x = Math.cos(f.userData.a) * r; f.position.z = Math.sin(f.userData.a) * r; f.rotation.y = -f.userData.a; });
  }
  if (u.flame) u.flame.scale.y = 0.8 + Math.random() * 0.4;
}

// เงาโปร่งแสงตอนวางของ
export function makeGhost(s, ok) {
  const m = makeStructureMesh(s);
  const gm = new THREE.MeshBasicMaterial({ color: ok ? '#52b788' : '#e63946', transparent: true, opacity: 0.45, depthWrite: false });
  m.traverse((o) => { if (o.isMesh) { o.material = gm; o.castShadow = false; } });
  return m;
}
