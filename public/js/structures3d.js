// โมเดล 3D ของชิ้นส่วนบ้าน รั้ว ฟาร์ม เล้าไก่ บ่อปลา และยานพาหนะ
import * as THREE from 'three';
import { makeLabel, mat, makeAnimal, animateAnimal, makeCampfire, makeShelter, makeWatchtower } from './models.js';
import { heightAt } from './terrain.js';
import { G, WALL_H, FENCE_H, fenceH, CROPS, cropProgress, coopEggs, pondFish, baseY, cageCatch, PENS, herdOf, ageStage, penGoods, isPlot, hiveHoney, plotCrop } from './building-core.js';

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
  switch (isPlot(s.type) ? 'plot' : s.type) {
    case 'campfire': add(makeCampfire()); root.userData.flame = root.children[0].userData.flame; break;
    case 'shelter': { const m = add(makeShelter()); m.rotation.y = s.ry || 0; break; }
    case 'watchtower': add(makeWatchtower()); break;
    case 'cage': {
      // กรงดักสัตว์: โครงเหล็ก + ซี่กรง + จานเหยื่อ (มีสัตว์ติดแล้วจะเห็นอยู่ข้างใน)
      const g = add(new THREE.Group()); g.rotation.y = s.ry || 0;
      g.add(box(2.2, 0.1, 2.2, '#495057', 0, 0.05, 0), box(2.2, 0.1, 2.2, '#495057', 0, 1.8, 0));
      for (let i = 0; i < 6; i++) { const t = -1.05 + i * 0.42; g.add(box(0.05, 1.75, 0.05, '#adb5bd', t, 0.9, -1.05), box(0.05, 1.75, 0.05, '#adb5bd', t, 0.9, 1.05), box(0.05, 1.75, 0.05, '#adb5bd', -1.05, 0.9, t), box(0.05, 1.75, 0.05, '#adb5bd', 1.05, 0.9, t)); }
      root.userData.baitDish = g.add(box(0.4, 0.06, 0.4, '#8d6e4a', 0, 0.13, 0)) && g.children[g.children.length - 1];
      root.userData.cageGroup = g;
      break;
    }
    case 'solar': {
      // แผงโซล่าเซลล์: เสา + แผงเอียงรับแดด + กล่องอินเวอร์เตอร์
      const g = add(new THREE.Group()); g.rotation.y = s.ry || 0;
      g.add(box(0.12, 1.2, 0.12, '#6c757d', -0.8, 0.6, 0), box(0.12, 1.2, 0.12, '#6c757d', 0.8, 0.6, 0));
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 1.4), new THREE.MeshPhongMaterial({ color: '#1d3557', shininess: 120, specular: '#8ecae6' }));
      panel.position.y = 1.3; panel.rotation.x = -0.5; g.add(panel);
      for (let i = -1; i <= 1; i++) { const l = box(0.02, 0.07, 1.38, '#adb5bd', i * 0.55, 1.3, 0); l.rotation.x = -0.5; g.add(l); }
      g.add(box(0.4, 0.5, 0.25, '#e9ecef', 0, 0.3, 0.5), box(0.1, 0.06, 0.02, '#52b788', 0, 0.45, 0.63));
      break;
    }
    case 'foundation': { const h = 0.5 + (s.drop || 0); add(box(G, h, G, '#8a7a66', 0, 0.5 - h / 2, 0)); } add(box(G - 0.1, 0.04, G - 0.1, PLANK, 0, 0.51, 0)); break;
    case 'wall': case 'window': case 'door': case 'bamboo_wall': {
      const g = add(edgeGroup(s));
      if (s.type === 'wall') g.add(box(G, WALL_H, 0.3, WOOD, 0, WALL_H / 2, 0));
      else if (s.type === 'bamboo_wall') { for (let i = 0; i < 10; i++) g.add(box(0.28, WALL_H, 0.26, i % 2 ? '#b5a35a' : '#c9b76c', -G / 2 + 0.15 + i * 0.3, WALL_H / 2, 0)); g.add(box(G, 0.1, 0.32, '#8a7a3a', 0, 0.6, 0), box(G, 0.1, 0.32, '#8a7a3a', 0, WALL_H - 0.5, 0)); }
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
      const T = s.tier || 0, H = fenceH(s), IRON = '#6c757d', IRON_D = '#495057';
      if (s.type === 'fence') {
        if (T === 2) {
          // รั้วเหล็ก: เสาเหล็ก + ซี่ลูกกรงถี่ + ปลายแหลม
          for (const x of [-1.4, 0, 1.4]) g.add(box(0.16, H, 0.16, IRON_D, x, H / 2, 0));
          for (const y of [0.25, H - 0.15]) g.add(box(G, 0.1, 0.1, IRON, 0, y, 0));
          for (let i = 0; i < 11; i++) { const x = -1.35 + i * 0.27; g.add(box(0.05, H, 0.05, IRON, x, H / 2, 0)); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), mat('#adb5bd')); tip.position.set(x, H + 0.1, 0); g.add(tip); }
        } else {
          for (const x of [-1.4, 0, 1.4]) g.add(box(T ? 0.2 : 0.14, H, T ? 0.2 : 0.14, WOOD_D, x, H / 2, 0));
          if (T === 1) { for (let i = 0; i < 9; i++) g.add(box(0.3, H - 0.2, 0.06, i % 2 ? WOOD : PLANK, -1.32 + i * 0.33, (H - 0.2) / 2 + 0.1, 0.06)); g.add(box(G, 0.14, 0.1, WOOD_D, 0, 0.6, -0.04), box(G, 0.14, 0.1, WOOD_D, 0, H - 0.4, -0.04)); }
          else for (const y of [0.5, 1.2, FENCE_H - 0.1]) g.add(box(G, 0.12, 0.08, WOOD, 0, y, 0));
        }
      } else {
        const pc = T === 2 ? IRON_D : WOOD_D, bc = T === 2 ? IRON : WOOD;
        g.add(box(0.25, H + 0.2, 0.25, pc, -1.35, (H + 0.2) / 2, 0), box(0.25, H + 0.2, 0.25, pc, 1.35, (H + 0.2) / 2, 0));
        const hinge = new THREE.Group(); hinge.position.set(-1.2, 0, 0); g.add(hinge);
        for (const y of T ? [0.4, H / 2, H - 0.3] : [0.4, 1.0, 1.6]) hinge.add(box(2.4, 0.14, 0.08, bc, 1.2, y, 0));
        hinge.add(box(0.1, H - 0.5, 0.08, bc, 0.3, H / 2, 0), box(0.1, H - 0.5, 0.08, bc, 2.1, H / 2, 0));
        if (T) for (let i = 0; i < 7; i++) hinge.add(box(T === 2 ? 0.05 : 0.25, H - 0.6, 0.05, T === 2 ? IRON : PLANK, 0.3 + i * 0.3, H / 2, 0.03));
        root.userData.hinge = hinge;
      }
      break;
    }
    case 'walllamp': {
      // 🏮 โคมไฟฟืนติดผนัง: ขายึดเหล็ก + ตะเกียงกรอบไม้ + เปลวไฟ (แสงจริงสว่างเฉพาะโคมที่ใกล้ผู้เล่น)
      const g = add(edgeGroup(s)), side = s.sd > 0 ? 1 : -1;
      g.add(box(0.5, 0.36, 0.12, WOOD_D, 0, 2.0, side * 0.2), box(0.06, 0.06, 0.32, '#343a40', 0, 2.3, side * 0.33));
      g.add(box(0.26, 0.04, 0.26, '#343a40', 0, 1.88, side * 0.42), box(0.26, 0.04, 0.26, '#343a40', 0, 2.24, side * 0.42));
      for (const [x, z] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) g.add(box(0.03, 0.36, 0.03, '#343a40', x, 2.06, side * 0.42 + z));
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), new THREE.MeshBasicMaterial({ color: '#ffb347' })); fl.position.set(0, 2.02, side * 0.42); g.add(fl);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.35 })); glass.position.set(0, 2.06, side * 0.42); g.add(glass);
      root.userData.flame = fl; root.userData.lampAt = side;
      break;
    }
    case 'balcony': {
      // 🌅 ระเบียง: พื้นไม้ยื่นออกจากบ้าน + ราวกันตก 3 ด้าน + เสาค้ำลงถึงพื้นดิน
      add(box(G, 0.2, G, PLANK, 0, 0.1, 0)); add(box(G + 0.02, 0.03, G + 0.02, WOOD_D, 0, 0.215, 0));
      const DD = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      for (let r = 0; r < 4; r++) {
        if (r === (s.rot & 3)) continue;
        const [dx, dz] = DD[r], cx = dx * (G / 2 - 0.05), cz = dz * (G / 2 - 0.05);
        add(box(dx ? 0.1 : G, 0.08, dx ? G : 0.1, WOOD, cx, 1.25, cz));
        for (let i = 0; i < 7; i++) { const t = -G / 2 + 0.2 + i * ((G - 0.4) / 6); add(box(0.06, 1.05, 0.06, WOOD_D, dx ? cx : t, 0.72, dx ? t : cz)); }
      }
      const y0 = baseY(s);
      for (const [x, z] of [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]]) {
        const h = y0 - heightAt(s.x + x, s.z + z); if (h > 0.3) add(box(0.18, h, 0.18, WOOD_D, x, -h / 2, z));
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
    case 'chair': { const g = add(new THREE.Group()); g.rotation.y = (s.rot & 3) * Math.PI / 2; for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) g.add(box(0.07, 0.48, 0.07, WOOD_D, x, 0.24, z)); g.add(box(0.62, 0.07, 0.62, WOOD, 0, 0.5, 0), box(0.62, 0.6, 0.07, WOOD, 0, 0.83, -0.28)); break; }
    case 'storage': { const g = add(new THREE.Group()); g.rotation.y = (s.rot & 3) * Math.PI / 2; g.add(box(1.2, 0.8, 0.8, WOOD_D, 0, 0.4, 0), box(1.25, 0.12, 0.85, WOOD, 0, 0.84, 0), box(0.16, 0.16, 0.05, '#ffd166', 0, 0.62, 0.42)); break; }
    case 'pethouse': {
      const g = add(new THREE.Group()); g.rotation.y = (s.rot & 3) * Math.PI / 2;
      g.add(box(1.6, 1.0, 1.6, '#e76f51', 0, 0.5, 0));
      const r1 = box(1.2, 0.08, 1.8, ROOF, -0.42, 1.25, 0); r1.rotation.z = 0.7; const r2 = r1.clone(); r2.position.x = 0.42; r2.rotation.z = -0.7; g.add(r1, r2);
      g.add(box(0.6, 0.65, 0.05, '#2b2d42', 0, 0.33, 0.81));
      break;
    }
    case 'plot': {
      if (s.type === 'plot_rice') {
        // นาข้าว: คันนาดินรอบ ๆ + น้ำขังในแปลง
        add(box(2.8, 0.14, 2.8, '#5c4033', 0, 0.07, 0));
        for (const [x, z, w, d] of [[0, -1.32, 2.8, 0.16], [0, 1.32, 2.8, 0.16], [-1.32, 0, 0.16, 2.8], [1.32, 0, 0.16, 2.8]]) add(box(w, 0.28, d, '#7f5539', x, 0.14, z));
        add(box(2.48, 0.04, 2.48, '#5fa8d3', 0, 0.18, 0, new THREE.MeshPhongMaterial({ color: '#5fa8d3', transparent: true, opacity: 0.75, shininess: 90 })));
      } else {
      add(box(2.7, 0.18, 2.7, '#5c4033', 0, 0.09, 0));
      for (let i = -1; i <= 1; i++) add(box(2.6, 0.06, 0.3, '#6f4e37', 0, 0.2, i * 0.85));
      }
      root.userData.cropGroup = add(new THREE.Group());
      // ป้ายชนิดพืช (แปลงแยกชนิด)
      const ck = plotCrop(s.type);
      if (ck) { add(box(0.06, 0.7, 0.06, WOOD_D, 1.25, 0.35, 1.25)); add(box(0.4, 0.3, 0.04, CROPS[ck].color, 1.25, 0.75, 1.25)); }
      break;
    }
    case 'ricemill': {
      // เครื่องสีข้าว: ฐานไม้ + ถังกรวยใส่ข้าวเปลือก + มอเตอร์ + ล้อสายพาน + รางข้าวสาร
      const g = add(new THREE.Group()); g.rotation.y = (s.rot & 3) * Math.PI / 2;
      g.add(box(1.6, 0.7, 1.1, WOOD_D, 0, 0.35, 0), box(1.5, 0.08, 1.0, WOOD, 0, 0.74, 0));
      const hop = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.14, 0.6, 4), mat('#8d99ae')); hop.position.set(-0.3, 1.2, 0); hop.rotation.y = Math.PI / 4; hop.castShadow = true; g.add(hop);
      g.add(box(0.5, 0.4, 0.45, '#495057', 0.4, 0.98, 0));
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 14), mat('#adb5bd')); wh.rotation.x = Math.PI / 2; wh.position.set(0.4, 1.0, 0.3); g.add(wh); root.userData.spin = wh;
      g.add(box(0.2, 0.12, 0.5, '#ced4da', -0.3, 0.8, 0.7), box(0.36, 0.2, 0.36, '#e9d8a6', -0.3, 0.1, 0.85));
      break;
    }
    case 'pot': {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.45, 10), mat('#bc6c25')); pot.position.y = 0.22; pot.castShadow = true; add(pot);
      add(box(0.5, 0.04, 0.5, '#5c4033', 0, 0.44, 0)).scale.set(0.9, 1, 0.9);
      root.userData.cropGroup = add(new THREE.Group()); root.userData.potted = true;
      break;
    }
    case 'duckpen': case 'pigpen': case 'cowpen': case 'buffalopen': case 'sheeppen': {
      const P = PENS[s.type], ground = { duckpen: '#a3b18a', pigpen: '#6f4e37', cowpen: '#8a9a5b', buffalopen: '#5c4a32', sheeppen: '#95b46a' }[s.type];
      add(box(2.8, 0.1, 2.8, ground, 0, 0.05, 0));
      for (const [x, z, w, d] of [[0, -1.4, 2.8, 0.1], [0, 1.4, 2.8, 0.1], [-1.4, 0, 0.1, 2.8], [1.4, 0, 0.1, 2.8]]) { add(box(w, 0.08, d, WOOD, x, 0.85, z)); add(box(w, 0.08, d, WOOD, x, 0.45, z)); }
      for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4], [0, -1.4], [0, 1.4]]) add(box(0.12, 1.05, 0.12, WOOD_D, x, 0.52, z));
      if (s.type === 'duckpen') { const w = new THREE.Mesh(new THREE.CircleGeometry(0.7, 14), new THREE.MeshPhongMaterial({ color: '#4ea8de', shininess: 80 })); w.rotation.x = -Math.PI / 2; w.position.set(0.6, 0.12, 0.6); add(w); }
      // รางอาหาร + รางน้ำ
      add(box(1.0, 0.2, 0.3, WOOD_D, -0.7, 0.15, -1.1)); root.userData.trough = add(box(0.9, 0.06, 0.22, '#e9c46a', -0.7, 0.26, -1.1));
      add(box(0.8, 0.2, 0.3, '#6c757d', 0.7, 0.15, -1.1)); root.userData.waterBox = add(box(0.7, 0.06, 0.22, '#4ea8de', 0.7, 0.26, -1.1));
      root.userData.penAnimal = P.animal; root.userData.penGroup = add(new THREE.Group()); root.userData.goods = add(new THREE.Group());
      break;
    }
    case 'hive': {
      add(box(0.12, 0.5, 0.12, WOOD_D, -0.25, 0.25, -0.25)); add(box(0.12, 0.5, 0.12, WOOD_D, 0.25, 0.25, -0.25)); add(box(0.12, 0.5, 0.12, WOOD_D, -0.25, 0.25, 0.25)); add(box(0.12, 0.5, 0.12, WOOD_D, 0.25, 0.25, 0.25));
      for (let i = 0; i < 3; i++) add(box(0.7, 0.18, 0.6, i % 2 ? '#f4d35e' : '#e9c46a', 0, 0.6 + i * 0.19, 0));
      add(box(0.8, 0.06, 0.7, ROOF, 0, 1.2, 0)); add(box(0.2, 0.04, 0.04, '#222', 0, 0.55, 0.31));
      root.userData.bees = add(new THREE.Group());
      for (let i = 0; i < 6; i++) { const b = box(0.07, 0.05, 0.09, i % 2 ? '#ffd60a' : '#222', 0, 1, 0); b.castShadow = false; b.userData.a = i * 1.1; root.userData.bees.add(b); }
      root.userData.honey = add(box(0.15, 0.2, 0.15, '#f4a261', 0.45, 0.1, 0.3));
      break;
    }
    case 'sign': {
      const g = add(new THREE.Group()); g.rotation.y = (s.rot & 3) * Math.PI / 2;
      g.add(box(0.14, 2.2, 0.14, WOOD_D, -0.9, 1.1, 0), box(0.14, 2.2, 0.14, WOOD_D, 0.9, 1.1, 0), box(2.1, 0.8, 0.1, PLANK, 0, 1.8, 0));
      const lb = makeLabel('ฐาน', '#ffd166'); lb.position.y = 2.7; lb.scale.set(3.2, 0.8, 1); root.add(lb); root.userData.signLabel = lb;
      break;
    }
    case 'basecore': {
      add(box(0.9, 1.2, 0.8, '#495057', 0, 0.6, 0)); add(box(0.95, 0.1, 0.85, '#ffd166', 0, 1.25, 0)); add(box(0.3, 0.3, 0.05, '#adb5bd', 0, 0.7, 0.42));
      const fl = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: '#ffd60a' })); fl.position.y = 1.7; add(fl); root.userData.coreGem = fl;
      break;
    }
    case 'stall': {
      const g = add(new THREE.Group()); g.rotation.y = (s.rot & 3) * Math.PI / 2;
      g.add(box(2.2, 0.9, 0.9, WOOD, 0, 0.45, 0), box(2.3, 0.06, 1.0, PLANK, 0, 0.92, 0));
      for (const x of [-1.05, 1.05]) g.add(box(0.08, 2.2, 0.08, WOOD_D, x, 1.1, -0.4));
      for (let i = 0; i < 6; i++) g.add(box(0.4, 0.05, 1.2, i % 2 ? '#e63946' : '#f1faee', -1.0 + i * 0.4, 2.25, -0.1));
      g.add(box(1.2, 0.35, 0.05, '#ffd60a', 0, 1.9, 0.5));
      const sg = new THREE.Group(); g.add(sg); root.userData.stallGoods = sg;
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
  } else if (vt === 'ev_bike') {
    // มอเตอร์ไซค์ไฟฟ้า: ทรงสกู๊ตเตอร์ สีฟ้า ไฟ LED
    for (const z of [-0.6, 0.6]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 16), mat('#1b1b1b')); w.rotation.y = Math.PI / 2; w.position.set(0, 0.32, z); g.add(w); }
    g.add(box(0.32, 0.2, 1.0, '#4cc9f0', 0, 0.5, 0), box(0.3, 0.12, 0.55, '#111', 0, 0.72, -0.2), box(0.3, 0.55, 0.12, '#4cc9f0', 0, 0.75, 0.45));
    g.add(box(0.55, 0.05, 0.05, '#adb5bd', 0, 1.05, 0.5), box(0.2, 0.08, 0.06, '#caf0f8', 0, 0.9, 0.53), box(0.1, 0.18, 0.02, '#ffd60a', 0.17, 0.5, 0.1));
  } else if (vt === 'ev_car') {
    // รถ EV: ทรงเตี้ยมน สีขาวฟ้า มีสัญลักษณ์สายฟ้า
    for (const x of [-0.8, 0.8]) for (const z of [-1.25, 1.25]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14), mat('#1b1b1b')); w.rotation.z = Math.PI / 2; w.position.set(x, 0.36, z); g.add(w); }
    g.add(box(1.7, 0.5, 3.8, '#f1faee', 0, 0.65, 0), box(1.56, 0.5, 2.1, '#a8dadc', 0, 1.15, -0.1), box(1.6, 0.4, 1.9, '#1d3557', 0, 1.17, -0.1));
    g.add(box(1.2, 0.06, 0.05, '#4cc9f0', 0, 0.72, 1.91), box(0.25, 0.35, 0.03, '#ffd60a', 0.86, 0.75, 0.3), box(1.6, 0.08, 0.05, '#e63946', 0, 0.75, -1.91));
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
  if (u.cageGroup) {
    const caught = cageCatch(s, now);
    if ((u.caught || null) !== caught) { if (u.caughtMesh) u.cageGroup.remove(u.caughtMesh); u.caught = caught; u.caughtMesh = null; if (caught) { const m = makeAnimal(caught); const big = caught === 'trike' ? 0.5 : caught === 'buffalo' ? 0.6 : caught === 'raptor' || caught === 'tiger' ? 0.7 : 1; m.scale.setScalar(big); u.cageGroup.add(m); u.caughtMesh = m; } }
    if (u.caughtMesh) animateAnimal(u.caughtMesh, dt, 0.5);
    if (u.baitDish) u.baitDish.material = mat(s.bait ? '#c1121f' : '#8d6e4a');
  }
  if (u.hinge) { const want = s.open ? -Math.PI / 2 * 0.95 : 0; u.hinge.rotation.y += (want - u.hinge.rotation.y) * Math.min(1, dt * 8); }
  if (u.cropGroup) {
    const key = s.crop ? `${s.crop}:${Math.floor(cropProgress(s, now) * 4)}` : '';
    if (u.cropKey !== key) {
      u.cropKey = key; u.cropGroup.clear();
      if (s.crop) {
        const p = cropProgress(s, now), C = CROPS[s.crop], ripe = p >= 1;
        const spots = u.potted ? [[0, 0]] : [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => [i * 0.8, j * 0.85]));
        const y0 = u.potted ? 0.45 : 0.2, tall = s.crop === 'corn' || s.crop === 'sunflower' ? 1.6 : s.crop === 'rice' ? 0.9 : C.low ? 0.35 : 0.6;
        for (const [x, z] of spots) {
          const h = 0.15 + p * tall;
          const st = new THREE.Mesh(C.low ? new THREE.SphereGeometry(0.1 + p * 0.22, 6, 4) : new THREE.ConeGeometry(0.12 + p * 0.15, h, 5), mat(p < 0.3 ? '#95d5b2' : s.crop === 'rice' && ripe ? '#e9c46a' : '#40916c'));
          st.position.set(x, y0 + (C.low ? 0.08 : h / 2), z); if (C.low) st.scale.y = 0.6; u.cropGroup.add(st);
          // ดอกไม้บานตั้งแต่ครึ่งทาง · ผลไม้เห็นเมื่อสุก
          if (ripe || (C.flower && p >= 0.5)) {
            const big = C.low ? 0.2 : C.flower ? (s.crop === 'sunflower' ? 0.22 : 0.14) : 0.12;
            const f = new THREE.Mesh(C.flower ? new THREE.CylinderGeometry(big, big, 0.05, 8) : new THREE.SphereGeometry(big, 6, 4), mat(C.color));
            if (C.flower) { f.rotation.x = 0.4; const c = new THREE.Mesh(new THREE.SphereGeometry(big * 0.35, 5, 4), mat(s.crop === 'sunflower' ? '#6b4226' : '#ffd60a')); c.position.set(x, y0 + h + 0.03, z + 0.03); u.cropGroup.add(c); }
            f.position.set(x + (C.flower ? 0 : 0.08), C.low ? y0 + 0.12 : y0 + (C.flower ? h : h * 0.75), z); u.cropGroup.add(f);
          }
        }
      }
    }
    u.cropGroup.children.forEach((c) => { c.material.emissive?.setHex(0); });
  }
  if (u.penGroup) {
    const P = PENS[s.type], herd = herdOf(s, now), key = herd.map((a) => ageStage(P, a, now)).join(',');
    if (u.herdKey !== key) {
      u.herdKey = key; u.penGroup.clear();
      herd.forEach((a, i) => { const m = makeAnimal(u.penAnimal); m.scale.setScalar(ageStage(P, a, now) === 'baby' ? 0.55 : 1); m.position.set(-0.6 + (i % 2) * 1.1, 0.1, 0.1 + Math.floor(i / 2) * 0.7); m.userData.t = i * 2; u.penGroup.add(m); });
    }
    const fed = (s.fed || 0) > now, wet = (s.wat || 0) > now;
    u.trough.visible = fed; u.waterBox.visible = wet;
    u.penGroup.children.forEach((m, i) => { m.userData.t += dt; m.position.x = -0.6 + (i % 2) * 1.1 + Math.sin(m.userData.t * 0.4) * 0.3; m.rotation.y = Math.sin(m.userData.t * 0.3) * 2.5; animateAnimal(m, dt, fed && wet ? 0.6 : 0.15); });
    const n = penGoods(s, now);
    if (u.goodN !== n) { u.goodN = n; u.goods.clear(); const c = { egg: '#fff8e7', duck_egg: '#e8f0e8', milk: '#ffffff', buffalo_milk: '#fdfcf5', wool: '#f5f0e6', manure: '#5c4033' }[P.prod[0]] || '#ddd'; for (let i = 0; i < Math.min(n, 8); i++) { const e = P.prod[0] === 'milk' || P.prod[0] === 'buffalo_milk' ? box(0.14, 0.22, 0.14, c) : new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), mat(c)); e.position.set(1.0 - (i % 4) * 0.18, 0.18, 1.0 - Math.floor(i / 4) * 0.2); u.goods.add(e); } }
  }
  if (u.bees) {
    u.bees.visible = !!s.bees;
    if (s.bees) u.bees.children.forEach((b) => { b.userData.a += dt * 2.5; b.position.set(Math.cos(b.userData.a) * 0.6, 1.0 + Math.sin(b.userData.a * 1.7) * 0.3, Math.sin(b.userData.a * 1.3) * 0.6); });
    u.honey.visible = hiveHoney(s, now) > 0;
  }
  if (u.stallGoods) {
    const key = (s.goods || []).map((r) => r.k).join(',');
    if (u.goodsKey !== key) { u.goodsKey = key; u.stallGoods.clear(); (s.goods || []).slice(0, 8).forEach((r, i) => u.stallGoods.add(box(0.2, 0.2, 0.2, ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#9b5de5'][i % 5], -0.9 + i * 0.25, 1.05, 0.1))); }
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
  if (u.coreGem) { u.coreGem.rotation.y += dt * 1.5; u.coreGem.material.color.set(s.ok ? '#52b788' : '#ffd60a'); }
  if (u.flame) u.flame.scale.y = 0.8 + Math.random() * 0.4;
}

// เงาโปร่งแสงตอนวางของ
export function makeGhost(s, ok) {
  const m = makeStructureMesh(s);
  const gm = new THREE.MeshBasicMaterial({ color: ok ? '#52b788' : '#e63946', transparent: true, opacity: 0.45, depthWrite: false });
  m.traverse((o) => { if (o.isMesh) { o.material = gm; o.castShadow = false; } });
  return m;
}
