import * as THREE from 'three';
import { WORLD, heightAt, waterAt, coastX, fbm, mulberry32, LAKES, ISLANDS, MOUNTAINS, latToZ, distToCoast } from './terrain.js';
import { TOWNS, LOOT_TABLE, QUEST_SPOTS } from './data.js';
import { getLayout, collideBoxes, roofUnder, inCamp } from './citygen.js';
import { RES_TYPES, getResources } from './resources-core.js';
import { mat, GFX, makeLabel } from './models.js';
import { LANDMARKS, DAM_PUMP } from './landmarks.js';
import { ROUTES, CAMPS, WATER_TOWERS } from './quest-core.js';
import { makeStructureMesh, updateStructureMesh, makeVehicle, makeWaterTower } from './structures3d.js';
import { TINTABLE, baseAt } from './building-core.js';
import { isHalloween, onTheme } from './theme.js';
import { mat as tintMat } from './models.js';
import { collidersFor } from './building-core.js';

export { RES_TYPES };

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const CELL = 16;
const CHUNK = 160;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.resources = []; this.resGrid = new Map(); this.resMesh = {};
    this.loot = []; this.lootGrid = new Map();
    this.buildings = []; // AABB colliders
    this.structures = []; this.structureMeshes = new Map();
    this.buildTerrain();
    this.buildWater();
    this.buildRoads();
    this.buildTowns();
    this.buildResources();
    this.buildMinimap();
    this.buildHalloween(); onTheme(() => this.applyTheme()); this.applyTheme();
  }

  colorAt(x, z, h, out) {
    const d = distToCoast(x, z);
    const n = fbm(x * 0.05, z * 0.05, 2);
    if (h < 0.2) out.setRGB(0.76 + n * 0.05, 0.7, 0.52);
    else if (h < 2.2 && d < 18) out.setRGB(0.89, 0.83, 0.63);
    else if (h > 45) out.setRGB(0.42 + n * 0.05, 0.43, 0.36);
    else {
      const dry = Math.max(0, fbm(x * 0.01 + 9, z * 0.01, 3));
      out.setRGB(0.33 + dry * 0.35 + n * 0.04, 0.5 + dry * 0.08 + n * 0.05, 0.2 + dry * 0.08);
      if (h > 22) out.multiplyScalar(0.78);
    }
    for (const t of TOWNS) {
      const dx = x - t.x, dz = z - t.z;
      if (dx * dx + dz * dz < t.r * t.r * 0.8 && h > 0.6) { out.lerp(new THREE.Color(0.33, 0.31, 0.27), 0.7); break; }
    }
    return out;
  }

  buildTerrain() {
    const w = WORLD.maxX - WORLD.minX, d = WORLD.maxZ - WORLD.minZ;
    const seg = GFX.mode === 'smooth' ? 4 : GFX.mode === 'low' ? 8 : 6; // ละมุน = พื้นละเอียดขึ้น
    const geo = new THREE.PlaneGeometry(w, d, Math.round(w / seg), Math.round(d / seg));
    geo.rotateX(-Math.PI / 2);
    geo.translate((WORLD.minX + WORLD.maxX) / 2, 0, (WORLD.minZ + WORLD.maxZ) / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h);
      this.colorAt(x, z, h, c);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    this.terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
  }

  buildWater() {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshPhongMaterial({ color: '#2a6f97', transparent: true, opacity: 0.82, shininess: 80 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = 0; this.scene.add(sea); this.sea = sea;
    for (const l of LAKES) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshPhongMaterial({ color: '#3a86a8', transparent: true, opacity: 0.85, shininess: 90 }));
      m.rotation.x = -Math.PI / 2; m.scale.set(l.rx * 1.25, l.rz * 1.25, 1); m.position.set(l.p[0], l.level, l.p[1]);
      this.scene.add(m);
    }
  }

  ribbon(points, width, color, emissive = '#000000', lift = 0.18) {
    const verts = [], idx = [];
    for (let i = 0; i < points.length; i++) {
      const [x, z] = points[i];
      const [nx, nz] = points[Math.min(i + 1, points.length - 1)], [px, pz] = points[Math.max(i - 1, 0)];
      let dx = nx - px, dz = nz - pz; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const ox = -dz * width / 2, oz = dx * width / 2;
      verts.push(x + ox, heightAt(x + ox, z + oz) + lift, z + oz, x - ox, heightAt(x - ox, z - oz) + lift, z - oz);
      if (i > 0) { const b = i * 2; idx.push(b - 2, b - 1, b, b - 1, b + 1, b); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, emissive, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.receiveShadow = true; this.scene.add(m);
  }

  buildRoads() {
    this.layout = getLayout();
    this.roadPts = this.layout.roadPts;
    // ถนนสีเทาอ่อน + เรืองแสงเล็กน้อย ให้เห็นชัดตอนกลางคืน · ถนนสายหลักมีเส้นกลางถนนสีเหลือง
    for (const r of this.layout.roads) {
      this.ribbon(r.pts, r.width, r.main ? '#8d9196' : '#9ea2a6', r.main ? '#23262a' : '#272a2e');
      if (r.main) this.ribbon(r.pts, 0.3, '#e9c46a', '#5c4a14', 0.2);
    }
  }

  buildTowns() {
    const L = this.layout;
    this.baseBuildings = [...L.buildings, ...L.fence, ...Object.values(L.gates)];
    // 🗼 ขาหอถังน้ำของแผนที่ชนได้
    for (const w of WATER_TOWERS) { const y = heightAt(w.x, w.z); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.baseBuildings.push({ x: w.x + dx * 1.8, z: w.z + dz * 1.8, w: 0.3, d: 0.3, top: y + 11 }); }
    this.buildings = [...this.baseBuildings];
    let ci = 0; for (const l of L.loot) { this.addLoot(l.x, l.z, l.kind, l); if (l.kind === 'car') this.loot[this.loot.length - 1].carIdx = ci++; }
    const boxes = L.boxes.map((b) => ({ ...b, color: new THREE.Color(...b.rgb) }));
    const cars = L.cars.map((c) => ({ ...c, color: new THREE.Color().setHSL(c.hue, 0.4, 0.35) }));
    // อาคาร (instanced)
    const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), boxes.length);
    const M = new THREE.Matrix4();
    boxes.forEach((b, i) => {
      M.compose(new THREE.Vector3(b.x, b.y0 + b.h / 2, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
      bm.setMatrixAt(i, M); bm.setColorAt(i, b.burnt ? b.color.clone().multiplyScalar(0.45) : b.color);
    });
    bm.castShadow = true; bm.receiveShadow = true; this.scene.add(bm);
    // หน้าต่าง (แถบมืด)
    const wins = [];
    boxes.forEach((b) => { for (let y = b.y0 + 3; y < b.y0 + b.h - 1; y += 3) wins.push({ ...b, y }); });
    const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat('#1d2430'), wins.length);
    wins.forEach((b, i) => { M.compose(new THREE.Vector3(b.x, b.y, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w + 0.06, 0.9, b.d + 0.06)); wm.setMatrixAt(i, M); });
    this.scene.add(wm);
    this.buildCars(cars);
    // กล่องเสบียง
    const crates = this.loot.filter((l) => l.kind === 'crate');
    this.lootMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), mat('#8c6a3f'), crates.length);
    crates.forEach((l, i) => { l.idx = i; M.makeTranslation(l.x, (l.y ?? heightAt(l.x, l.z)) + 0.35, l.z); l.m = M.clone(); this.lootMesh.setMatrixAt(i, M); });
    this.lootMesh.castShadow = true; this.scene.add(this.lootMesh);
    // จักรยานข้างถนน (คันที่พังล้มตะแคง สีสนิม)
    for (const l of this.loot.filter((x) => x.kind === 'bike')) {
      const m = makeVehicle('bicycle'); m.position.set(l.x, heightAt(l.x, l.z) + (l.broken ? 0.12 : 0), l.z); m.rotation.y = l.ry || 0;
      if (l.broken) { m.rotation.z = 1.35; m.traverse((o) => { if (o.isMesh) o.material = mat('#' + new THREE.Color(o.material.color).lerp(new THREE.Color('#8d5524'), 0.6).getHexString()); }); }
      this.scene.add(m); l.mesh = m;
    }
    this.buildQuestSites();
    this.buildPavilions();
    // ป้ายชื่อสถานที่สำคัญลอยเหนือพื้นที่ (มองเห็นจากไกล)
    for (const L of this.layout.labels || []) { const s = makeLabel(L.name, '#ffd166'); s.position.set(L.x, L.y, L.z); s.scale.set(14, 3.5, 1); this.scene.add(s); }
  }
  // ศาลาที่พัก: เสา 4 ต้น หลังคาจั่ว ม้านั่ง · ศาลาแรกของเมืองมีเตาผิงให้ความอบอุ่น
  buildPavilions() {
    this.pavilions = this.layout.pavilions || [];
    for (const p of this.pavilions) {
      const g = new THREE.Group(), H = 3.2; g.position.set(p.x, p.y, p.z);
      const add = (geo, c, x, y, z) => { const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
      add(new THREE.BoxGeometry(p.w, 0.2, p.d), '#a68a64', 0, 0.1, 0);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.25, H, 0.25), '#6f4518', sx * (p.w / 2 - 0.3), H / 2, sz * (p.d / 2 - 0.3));
      const roof = p.market !== undefined ? ['#e63946', '#2a9d8f', '#f4a261', '#e9c46a', '#9b5de5', '#4cc9f0'][p.market % 6] : '#9d0208';
      const r1 = add(new THREE.BoxGeometry(p.w + 0.6, 0.15, p.d / 2 + 0.6), roof, 0, H + 0.45, -p.d / 4); r1.rotation.x = 0.42;
      const r2 = add(new THREE.BoxGeometry(p.w + 0.6, 0.15, p.d / 2 + 0.6), roof, 0, H + 0.45, p.d / 4); r2.rotation.x = -0.42;
      // แผงตลาดจักสาน: ตะกร้า/ชะลอมวางขายบนโต๊ะ
      if (p.market !== undefined) { add(new THREE.BoxGeometry(p.w - 1.6, 0.8, 1.0), '#8b5e34', 0, 0.4, 0); for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.28, 0.2, 0.35, 8), i % 2 ? '#c8a165' : '#d4a373', -1.5 + i, 1.0, 0); }
      add(new THREE.BoxGeometry(p.w - 1.2, 0.12, 0.5), '#8b5e34', 0, 0.55, -p.d / 2 + 0.7); add(new THREE.BoxGeometry(p.w - 1.2, 0.12, 0.5), '#8b5e34', 0, 0.55, p.d / 2 - 0.7);
      add(new THREE.BoxGeometry(1.6, 0.35, 0.05), '#ffd166', 0, H - 0.2, p.d / 2 - 0.1);
      // เตาผิง + ปล่องไฟทะลุหลังคา (ก่อไฟได้เลย ไม่ต้องคราฟท์กองไฟ)
      if (p.hearth) {
        // ศาลาเตาผิงแบบแข็งแรง: ฐานหิน เสาหินก่อ ผนังอิฐครึ่งความสูงด้านหลัง/ข้าง คานไม้หนา ป้ายบอก
        add(new THREE.BoxGeometry(p.w + 0.8, 0.45, p.d + 0.8), '#7d8597', 0, 0.12, 0);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { add(new THREE.BoxGeometry(0.55, H + 0.1, 0.55), '#8d99ae', sx * (p.w / 2 - 0.3), (H + 0.1) / 2, sz * (p.d / 2 - 0.3)); add(new THREE.BoxGeometry(0.7, 0.25, 0.7), '#6c757d', sx * (p.w / 2 - 0.3), 0.3, sz * (p.d / 2 - 0.3)); }
        add(new THREE.BoxGeometry(p.w - 0.6, 1.3, 0.35), '#a4553a', 0, 0.85, -p.d / 2 + 0.3);
        add(new THREE.BoxGeometry(0.35, 1.3, p.d - 2.4), '#a4553a', -p.w / 2 + 0.3, 0.85, -0.6);
        for (const z of [-p.d / 2 + 0.3, p.d / 2 - 0.3]) add(new THREE.BoxGeometry(p.w + 0.2, 0.3, 0.3), '#5c3d1e', 0, H, z);
        add(new THREE.BoxGeometry(2.2, 0.4, 0.06), '#2b9348', 0, H - 0.55, p.d / 2 - 0.25);
        add(new THREE.BoxGeometry(0.75, H + 2.2, 0.75), '#9c4a32', p.w / 2 - 0.9, (H + 2.2) / 2, 0); add(new THREE.BoxGeometry(0.95, 0.25, 0.95), '#6c757d', p.w / 2 - 0.9, H + 2.25, 0);
      }
      if (p.hearth) { add(new THREE.BoxGeometry(0.5, H + 1.6, 0.5), '#7f5539', p.w / 2 - 0.9, (H + 1.6) / 2, 0); add(new THREE.BoxGeometry(1.1, 0.9, 1.0), '#6c757d', p.w / 2 - 0.9, 0.45, 0); add(new THREE.BoxGeometry(0.6, 0.45, 0.05), '#1b1b1b', p.w / 2 - 0.9, 0.4, 0.51); add(new THREE.BoxGeometry(0.9, 0.5, 0.9), '#6c757d', 0, -10, 0); const f = add(new THREE.ConeGeometry(0.22, 0.45, 6), '#ff7b00', p.w / 2 - 0.9, 0.35, 0.45); f.material = new THREE.MeshBasicMaterial({ color: '#ff9e00' }); p.flame = f; }
      this.scene.add(g); p.mesh = g;
    }
  }
  // ยืนอยู่ใต้หลังคา (ศาลา หลังคาบ้านที่สร้าง เพิงพัก) = หลบฝน/หิมะได้
  shelterAt(x, z, y) {
    for (const p of this.pavilions || []) if (Math.abs(x - p.x) < p.w / 2 && Math.abs(z - p.z) < p.d / 2 && y < p.y + 3) return { kind: 'pav', warm: p.hearth, p };
    for (const s of this.structures) {
      if (s.type === 'roof' && Math.abs(x - s.x) < 1.6 && Math.abs(z - s.z) < 1.6 && (s.y ?? heightAt(s.x, s.z)) > y + 0.5) return { kind: 'house' };
      if (s.type === 'shelter' && Math.hypot(x - s.x, z - s.z) < 2) return { kind: 'shelter' };
    }
    return null;
  }

  // รถร้างแบบละเอียด: ตัวถัง ห้องโดยสาร กระจก ล้อ ไฟหน้า/ท้าย กันชน (แยกชิ้นแบบ instanced)
  buildCars(cars) {
    const M = new THREE.Matrix4(), P = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const base = cars.map((c) => { e.set(0, c.ry, (c.hue - 0.5) * 0.08); return new THREE.Matrix4().compose(new THREE.Vector3(c.x, heightAt(c.x, c.z), c.z), q.clone().setFromEuler(e), new THREE.Vector3(1, 1, 1)); });
    const wheel = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12); wheel.rotateZ(Math.PI / 2);
    const parts = [
      { geo: new THREE.BoxGeometry(1.86, 0.62, 4.3), y: 0.62, z: 0, color: 'car' },                     // ตัวถัง
      { geo: new THREE.BoxGeometry(1.7, 0.6, 2.1), y: 1.22, z: -0.25, color: 'cab' },                  // ห้องโดยสาร
      { geo: new THREE.BoxGeometry(1.74, 0.42, 1.9), y: 1.24, z: -0.25, color: '#1b263b', glass: true }, // กระจกรอบคัน
      { geo: new THREE.BoxGeometry(1.9, 0.18, 0.18), y: 0.42, z: 2.18, color: '#adb5bd' },              // กันชนหน้า
      { geo: new THREE.BoxGeometry(1.9, 0.18, 0.18), y: 0.42, z: -2.18, color: '#adb5bd' },             // กันชนหลัง
      { geo: new THREE.BoxGeometry(0.34, 0.16, 0.06), x: -0.62, y: 0.72, z: 2.16, color: '#fff3b0', basic: true }, // ไฟหน้า
      { geo: new THREE.BoxGeometry(0.34, 0.16, 0.06), x: 0.62, y: 0.72, z: 2.16, color: '#fff3b0', basic: true },
      { geo: new THREE.BoxGeometry(0.3, 0.14, 0.06), x: -0.64, y: 0.74, z: -2.16, color: '#d00000', basic: true }, // ไฟท้าย
      { geo: new THREE.BoxGeometry(0.3, 0.14, 0.06), x: 0.64, y: 0.74, z: -2.16, color: '#d00000', basic: true },
      { geo: new THREE.BoxGeometry(1.2, 0.08, 0.05), y: 0.55, z: 2.17, color: '#343a40' },              // กระจังหน้า
      ...[[-0.9, 1.35], [0.9, 1.35], [-0.9, -1.35], [0.9, -1.35]].map(([x, z]) => ({ geo: wheel, x, y: 0.36, z, color: '#161616' })),
    ];
    this.carMeshes = [];
    for (const pt of parts) {
      const m = pt.basic ? new THREE.MeshBasicMaterial({ color: pt.color }) : pt.glass ? new THREE.MeshPhongMaterial({ color: pt.color, shininess: 90, specular: '#8ecae6' }) : new THREE.MeshLambertMaterial({ color: pt.color.startsWith('#') ? pt.color : '#ffffff' });
      const im = new THREE.InstancedMesh(pt.geo, m, cars.length);
      P.makeTranslation(pt.x || 0, pt.y, pt.z || 0);
      cars.forEach((c, i) => {
        im.setMatrixAt(i, M.multiplyMatrices(base[i], P));
        if (pt.color === 'car') im.setColorAt(i, c.color); else if (pt.color === 'cab') im.setColorAt(i, c.color.clone().multiplyScalar(0.8));
      });
      im.castShadow = !pt.basic; im.receiveShadow = true; this.scene.add(im); this.carMeshes.push(im);
    }
  }

  // สถานที่ของภารกิจหลัก: ป้อมวิทยุ + เสาส่งสัญญาณของทุกเส้นทาง และค่ายกักกันทุกแห่ง
  buildQuestSites() {
    const B = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; this.scene.add(m); return m; };
    this.radioGlows = {}; this.towerLights = {}; this.gateMeshes = {};
    const seen = new Set();
    for (const R of Object.values(ROUTES)) {
      const r = R.radio, rk = `${Math.round(r.x)},${Math.round(r.z)}`;
      if (!seen.has(rk)) {
        seen.add(rk); const ry = heightAt(r.x, r.z);
        B(2.6, 2.4, 2.6, '#d9d2c3', r.x, ry + 1.2, r.z); B(3.2, 0.3, 3.2, '#b23a48', r.x, ry + 2.55, r.z);
        B(0.9, 0.5, 0.6, '#222', r.x + 1.6, ry + 0.9, r.z); // โต๊ะวิทยุ
        this.radioGlows[rk] = B(0.25, 0.25, 0.25, '#7cff6b', r.x + 1.6, ry + 1.3, r.z);
      }
      const t = R.tower, tk = `${Math.round(t.x)},${Math.round(t.z)}`;
      if (seen.has(tk)) continue; seen.add(tk);
      const ty = heightAt(t.x, t.z);
      for (let i = 0; i < 6; i++) B(1.6 - i * 0.2, 4, 0.2, i % 2 ? '#e63946' : '#f1faee', t.x, ty + 2 + i * 4, t.z);
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(0.15, 24, 0.15, '#8d99ae', t.x + ox * 0.8, ty + 12, t.z + oz * 0.8);
      this.towerLights[tk] = B(0.5, 0.5, 0.5, '#ff4d4d', t.x, ty + 24.5, t.z);
      B(2, 1.4, 1.4, '#495057', t.x + 3, ty + 0.7, t.z); // ตู้ส่งสัญญาณ
    }
    // 🗼 หอถังน้ำสำรองประจำอำเภอ + 💧 ป้ายโรงสูบน้ำเขื่อนเกาะจันทร์ (ภารกิจระบบน้ำ)
    for (const w of WATER_TOWERS) {
      const m = makeWaterTower(true); m.position.set(w.x, heightAt(w.x, w.z), w.z); this.scene.add(m);
      const lb = makeLabel(`🗼 ${w.name}`, '#74c0fc'); lb.position.set(w.x, heightAt(w.x, w.z) + 17, w.z); lb.scale.set(9, 2.2, 1); this.scene.add(lb);
    }
    { const y = heightAt(DAM_PUMP.x, DAM_PUMP.z); B(0.15, 2.2, 0.15, '#495057', DAM_PUMP.x, y + 1.1, DAM_PUMP.z); B(1.6, 0.9, 0.08, '#1c7ed6', DAM_PUMP.x, y + 2.1, DAM_PUMP.z); this.damValve = B(0.5, 0.5, 0.5, '#ffd166', DAM_PUMP.x + 1.2, y + 0.4, DAM_PUMP.z);
      const lb = makeLabel(`💧 ${DAM_PUMP.name} (ภารกิจระบบน้ำ)`, '#74c0fc'); lb.position.set(DAM_PUMP.x, y + 4, DAM_PUMP.z); lb.scale.set(10, 2.5, 1); this.scene.add(lb); }
    this.radioGlow = Object.values(this.radioGlows)[0]; this.towerLight = Object.values(this.towerLights)[0];
    // ค่ายกักกัน: รั้วสูง ประตูเหลือง เต็นท์ เสาธง ป้ายชื่อ
    for (const c of CAMPS) {
      const cy = heightAt(c.x, c.z);
      for (const f of this.layout.fence.filter((f) => f.camp === c.key)) B(f.w, 3, f.d, '#6c757d', f.x, cy + 1.5, f.z);
      for (let i = -2; i <= 2; i++) if (i) B(0.3, 4, 0.3, '#343a40', c.x + i * 3.5, cy + 2, c.z - c.size / 2);
      const g = this.layout.gates[c.key];
      this.gateMeshes[c.key] = B(g.w, 3, 0.4, '#ffb703', g.x, cy + 1.5, g.z);
      const n = c.size >= 34 ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const tx = c.x - c.size * 0.28 + (i % 3) * c.size * 0.28, tz = c.z - 2 + Math.floor(i / 3) * 9;
        const tent = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.6, 4), mat(i % 2 ? '#2a9d8f' : '#e9c46a'));
        tent.position.set(tx, heightAt(tx, tz) + 1.3, tz); tent.rotation.y = Math.PI / 4; tent.castShadow = true; this.scene.add(tent);
      }
      // ธงเขตปลอดภัย: พื้นขาว ขอบส้มอบอุ่น กากบาทสีเขียว (ปฐมพยาบาล/ที่พักพิง)
      B(0.15, 9, 0.15, '#ced4da', c.x, cy + 4.5, c.z - 8);
      B(2.6, 1.6, 0.05, '#f4a261', c.x + 1.3, cy + 8.2, c.z - 8); B(2.36, 1.36, 0.06, '#fffaf0', c.x + 1.3, cy + 8.2, c.z - 8);
      B(0.95, 0.3, 0.07, '#2a9d8f', c.x + 1.3, cy + 8.2, c.z - 8); B(0.3, 0.95, 0.07, '#2a9d8f', c.x + 1.3, cy + 8.2, c.z - 8);
      const lb = makeLabel(c.name, '#90e0ef'); lb.position.set(c.x, cy + 12, c.z); lb.scale.set(14, 3.5, 1); this.scene.add(lb);
    }
  }

  // เปิดประตูค่ายของเส้นทางเรา (เมื่อทำภารกิจหลักจบ)
  openGate(key = 'navy') {
    const g = this.layout.gates[key]; if (!g || g.opened) return; g.opened = true;
    const i = this.baseBuildings.indexOf(g); if (i >= 0) { this.baseBuildings.splice(i, 1); this.rebuildColliders(); }
    if (this.gateMeshes?.[key]) this.gateMeshes[key].position.x += g.w;
  }

  // ---------- ธีมฮาโลวีน: ฟักทองแกะสลักเรืองแสงตามเมือง + ค้างคาวบินรอบตัว ----------
  buildHalloween() {
    const g = new THREE.Group(), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const spots = this.loot.filter((l) => l.kind === 'crate' && l.y === undefined).concat(this.loot.filter((l) => l.kind === 'car')).slice(0, 220);
    const n = spots.length * 2;
    const body = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 10, 7).scale(1, 0.8, 1), new THREE.MeshLambertMaterial({ color: '#ff7b00', emissive: '#7a2a00' }), n);
    const face = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: '#ffd166' }), n * 2);
    const stem = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 0.16, 5), new THREE.MeshLambertMaterial({ color: '#386641' }), n);
    let i = 0, f = 0;
    for (const l of spots) for (let k = 0; k < 2; k++) {
      const a = (l.x * 7 + l.z * 3 + k * 2.3) % 6.28, x = l.x + Math.cos(a) * (1.6 + k), z = l.z + Math.sin(a) * (1.6 + k), y = heightAt(x, z) + 0.32, ry = -a + Math.PI / 2;
      e.set(0, ry, 0); q.setFromEuler(e);
      M.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); body.setMatrixAt(i, M);
      M.compose(new THREE.Vector3(x, y + 0.36, z), q, new THREE.Vector3(1, 1, 1)); stem.setMatrixAt(i, M);
      // ตา 2 ข้าง + ปากยิ้ม (หันออกด้านนอก)
      const fx = Math.sin(ry) * 0.4, fz = Math.cos(ry) * 0.4;
      M.compose(new THREE.Vector3(x + fx, y + 0.08, z + fz), q, new THREE.Vector3(0.9, 1, 1)); face.setMatrixAt(f++, M);
      M.compose(new THREE.Vector3(x + fx, y - 0.1, z + fz), q, new THREE.Vector3(1.2, 0.8, 1)); face.setMatrixAt(f++, M);
      i++;
    }
    g.add(body, face, stem);
    // ค้างคาว
    this.bats = [];
    for (let b = 0; b < 10; b++) {
      const bat = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: '#120818', side: THREE.DoubleSide });
      bat.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.2), m));
      const wl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.18), m); wl.position.x = -0.24; const wr = wl.clone(); wr.position.x = 0.24; bat.add(wl, wr);
      bat.userData = { wl, wr, a: b * 0.63, r: 6 + (b % 4) * 3, h: 5 + (b % 3) * 2, s: 0.6 + (b % 5) * 0.15 };
      g.add(bat); this.bats.push(bat);
    }
    g.visible = false; this.scene.add(g); this.halloween = g;
  }
  applyTheme() { if (this.halloween) this.halloween.visible = isHalloween(); }
  tickHalloween(dt, P, night) {
    if (!this.halloween?.visible) return;
    for (const b of this.bats) {
      const u = b.userData; u.a += dt * u.s; b.visible = night || u.r < 9;
      b.position.set(P.x + Math.cos(u.a) * u.r, P.y + u.h + Math.sin(u.a * 3) * 0.6, P.z + Math.sin(u.a) * u.r);
      b.rotation.y = -u.a; const fl = Math.sin(u.a * 30) * 0.7; u.wl.rotation.z = fl; u.wr.rotation.z = -fl;
    }
  }
  addLoot(x, z, kind, src = {}) {
    const l = { id: 'L' + this.loot.length, x, z, kind, until: 0, y: src.y, broken: src.broken, ry: src.ry, tbl: src.tbl };
    this.loot.push(l);
    const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    if (!this.lootGrid.has(k)) this.lootGrid.set(k, []);
    this.lootGrid.get(k).push(l);
  }

  rollLoot(rng = Math.random) {
    const total = LOOT_TABLE.reduce((s, [, w]) => s + w, 0);
    const out = {}; const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      let r = rng() * total;
      for (const [item, w] of LOOT_TABLE) { r -= w; if (r <= 0) { out[item] = (out[item] || 0) + 1; break; } }
    }
    return out;
  }

  setLootState(id, until) {
    const l = this.loot[+id.slice(1)]; if (!l) return;
    l.until = until;
    if (l.idx !== undefined) { this.lootMesh.setMatrixAt(l.idx, until > Date.now() ? ZERO : l.m); this.lootMesh.instanceMatrix.needsUpdate = true; }
    if (l.mesh) l.mesh.visible = !(until > Date.now());
    // รถที่ถูกซ่อมไปแล้ว: ซ่อนรถร้างคันนั้น (กลายเป็นรถกระบะที่ขับได้แทน)
    if (l.carIdx !== undefined && this.carMeshes) { const gone = until > Date.now() + 864e5; for (const im of this.carMeshes) { if (!im.userData.base) im.userData.base = []; if (!im.userData.base[l.carIdx]) { const M = new THREE.Matrix4(); im.getMatrixAt(l.carIdx, M); im.userData.base[l.carIdx] = M; } im.setMatrixAt(l.carIdx, gone ? ZERO : im.userData.base[l.carIdx]); im.instanceMatrix.needsUpdate = true; } }
  }

  buildResources() {
    const list = {}; // chunk -> type -> resources
    for (const base of getResources()) {
      const r = { ...base, hp: RES_TYPES[base.type].hp, until: 0 };
      const px = r.x, pz = r.z;
      const ck = `${Math.floor(px / CHUNK)},${Math.floor(pz / CHUNK)}`;
      r.chunk = ck; ((list[ck] ||= {})[r.type] ||= []); r.idx = list[ck][r.type].length; list[ck][r.type].push(r);
      this.resources.push(r);
      const k = `${Math.floor(px / CELL)},${Math.floor(pz / CELL)}`;
      if (!this.resGrid.has(k)) this.resGrid.set(k, []);
      this.resGrid.get(k).push(r);
    }
    const parts = {
      tree: [[new THREE.CylinderGeometry(0.2, 0.3, 3, 5).translate(0, 1.5, 0), '#6b4f2c'], [new THREE.ConeGeometry(1.6, 3.6, 6).translate(0, 4.2, 0), '#2d6a4f'], [new THREE.ConeGeometry(1.2, 2.6, 6).translate(0, 5.6, 0), '#40916c']],
      // มะพร้าว 2 ลูกใต้ทางมะพร้าว (ตรงกับที่ได้เมื่อล้มต้น)
      palm: [[new THREE.CylinderGeometry(0.15, 0.25, 6, 5).translate(0, 3, 0), '#8d6e4a'], [new THREE.ConeGeometry(2.2, 1.0, 7).translate(0, 6.1, 0), '#4f9d3a'], [new THREE.SphereGeometry(0.3, 7, 5).translate(0.32, 5.45, 0.05), '#6b4226'], [new THREE.SphereGeometry(0.3, 7, 5).translate(-0.2, 5.4, 0.28), '#7a5c2e']],
      rock: [[new THREE.DodecahedronGeometry(0.9, 0).translate(0, 0.4, 0), '#8a8a85']],
      bush: [[new THREE.DodecahedronGeometry(0.7, 0).translate(0, 0.5, 0), '#3f7d20'], [new THREE.SphereGeometry(0.4, 4, 3).translate(0.25, 0.75, 0.3), '#5b2a86']],
      herb: [[new THREE.ConeGeometry(0.25, 0.6, 5).translate(0, 0.3, 0), '#80b918']],
      grass: [[new THREE.ConeGeometry(0.35, 0.9, 4).translate(0, 0.45, 0), '#a7c957']],
      twig: [[new THREE.CylinderGeometry(0.04, 0.05, 1.1, 4).rotateZ(Math.PI / 2).translate(0, 0.05, 0), '#8b5e34'], [new THREE.CylinderGeometry(0.03, 0.04, 0.8, 4).rotateZ(Math.PI / 2).rotateY(0.9).translate(0.1, 0.1, 0.05), '#a47148']],
      // ส้ม 4 ลูกรอบพุ่ม (ตรงกับที่ได้)
      orange_tree: [[new THREE.CylinderGeometry(0.16, 0.24, 2.2, 5).translate(0, 1.1, 0), '#6b4f2c'], [new THREE.IcosahedronGeometry(1.5, 0).translate(0, 3.1, 0), '#2d6a4f'], ...[[1.05, 2.8, 0.55], [-0.85, 3.3, -0.75], [0.25, 2.45, -1.15], [-0.5, 2.6, 1.05]].map(([x, y, z]) => [new THREE.SphereGeometry(0.24, 7, 5).translate(x, y, z), '#f77f00'])],
      // สับปะรด: กอใบแหลมรอบโคน · ผลทรงรีสีเหลืองทองมีลายตาสีน้ำตาล · จุกใบตั้งชี้บนหัว
      pineapple: [
        ...[0, 1, 2, 3, 4, 5, 6].map((i) => [new THREE.ConeGeometry(0.09, 0.9, 4).translate(0, 0.45, 0).rotateZ(0.75).rotateY((i / 7) * Math.PI * 2), i % 2 ? '#2d6a4f' : '#40916c']),
        [new THREE.SphereGeometry(0.23, 8, 7).scale(1, 1.45, 1).translate(0, 0.62, 0), '#d4a017'],
        ...[0.5, 0.64, 0.78].map((y, j) => [new THREE.TorusGeometry(0.2 - (j === 2 ? 0.05 : 0), 0.022, 4, 10).rotateX(Math.PI / 2).translate(0, y, 0), '#8a5a12']),
        ...[0, 1, 2, 3, 4].map((i) => [new THREE.ConeGeometry(0.05, 0.38, 4).translate(0, 0.19, 0).rotateZ(i ? 0.35 : 0).rotateY((i / 5) * Math.PI * 2).translate(0, 0.92, 0), '#52b788']),
      ],
      // ต้นทุเรียน: ทรงพุ่มสูง ลูกทุเรียนหนามสีเขียว 1 ลูก (ตรงกับที่ได้)
      durian_tree: [[new THREE.CylinderGeometry(0.22, 0.32, 3.4, 6).translate(0, 1.7, 0), '#5a4026'], [new THREE.IcosahedronGeometry(1.7, 0).scale(1, 1.25, 1).translate(0, 4.2, 0), '#386641'], [new THREE.IcosahedronGeometry(0.36, 0).translate(0.95, 3.0, 0.4), '#9ab03a'], [new THREE.ConeGeometry(0.08, 0.2, 4).translate(0.95, 3.38, 0.4), '#6a7d1f']],
      // กอไผ่: ลำเขียวหลายลำ ใบเรียวด้านบน
      bamboo: [...[[0, 0], [0.35, 0.2], [-0.3, 0.25], [0.15, -0.35], [-0.2, -0.25]].map(([x, z], i) => [new THREE.CylinderGeometry(0.07, 0.09, 6 - i * 0.5, 5).translate(x, 3 - i * 0.25, z), i % 2 ? '#7aa33a' : '#93b84a']), [new THREE.ConeGeometry(1.1, 2.4, 6).translate(0, 5.6, 0), '#6a994e']],
      // ดอกไม้สวยงาม: ก้านเขียว ดอกสีชมพู/เหลือง/ม่วง
      wildflower: [[new THREE.ConeGeometry(0.2, 0.5, 4).translate(0, 0.25, 0), '#52b788'], [new THREE.SphereGeometry(0.13, 6, 4).translate(0, 0.55, 0), '#ff8fab'], [new THREE.SphereGeometry(0.11, 6, 4).translate(0.18, 0.45, 0.1), '#ffd166'], [new THREE.SphereGeometry(0.1, 6, 4).translate(-0.15, 0.48, -0.08), '#c77dff']],
      pebble: [[new THREE.DodecahedronGeometry(0.22, 0).translate(0, 0.08, 0), '#9a9a92'], [new THREE.DodecahedronGeometry(0.14, 0).translate(0.3, 0.05, 0.15), '#7d7d76']],
    };
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
    this.chunks = [];
    for (const [ck, types] of Object.entries(list)) {
      const group = new THREE.Group(); const [cx, cz] = ck.split(',').map(Number);
      group.userData.center = new THREE.Vector2((cx + 0.5) * CHUNK, (cz + 0.5) * CHUNK);
      this.resMesh[ck] = {};
      for (const [type, arr] of Object.entries(types)) {
        this.resMesh[ck][type] = parts[type].map(([g, c]) => {
          const im = new THREE.InstancedMesh(g, mat(c), arr.length);
          im.castShadow = type === 'tree' || type === 'palm' || type === 'rock' || type === 'orange_tree' || type === 'durian_tree' || type === 'bamboo';
          arr.forEach((r, i) => {
            Q.setFromEuler(new THREE.Euler(0, r.ry, 0)); S.setScalar(r.s);
            M.compose(new THREE.Vector3(r.x, r.y - 0.1, r.z), Q, S); im.setMatrixAt(i, M);
          });
          im.computeBoundingSphere(); group.add(im); return im;
        });
      }
      this.scene.add(group); this.chunks.push(group);
    }
  }

  // ซ่อนกลุ่มต้นไม้ที่อยู่ไกลเกินหมอก
  updateVisibility(x, z, far) {
    const f2 = (far + CHUNK * 0.75) ** 2;
    for (const g of this.chunks) { const c = g.userData.center; g.visible = (c.x - x) ** 2 + (c.y - z) ** 2 < f2; }
  }

  setResState(id, until) {
    const r = this.resources[id]; if (!r) return;
    r.until = until; if (until <= Date.now()) r.hp = RES_TYPES[r.type].hp;
    const M = new THREE.Matrix4();
    for (const im of this.resMesh[r.chunk][r.type]) {
      if (until > Date.now()) im.setMatrixAt(r.idx, ZERO);
      else { M.compose(new THREE.Vector3(r.x, r.y - 0.1, r.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r.ry, 0)), new THREE.Vector3().setScalar(r.s)); im.setMatrixAt(r.idx, M); }
      im.instanceMatrix.needsUpdate = true;
    }
  }

  // ฟื้นทรัพยากร/เสบียงที่ถึงเวลา
  tickRespawn(now) {
    for (const r of this.resources) if (r.until && r.until <= now) { r.until = 0; this.setResState(r.id, 0); }
    for (const l of this.loot) if (l.until && l.until <= now) { l.until = 0; this.setLootState(l.id, 0); }
  }

  near(grid, x, z, rad, filter) {
    const out = [];
    const c0 = Math.floor((x - rad) / CELL), c1 = Math.floor((x + rad) / CELL);
    const d0 = Math.floor((z - rad) / CELL), d1 = Math.floor((z + rad) / CELL);
    for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) {
      const a = grid.get(`${cx},${cz}`); if (!a) continue;
      for (const o of a) { const dd = (o.x - x) ** 2 + (o.z - z) ** 2; if (dd < rad * rad && (!filter || filter(o))) out.push([o, dd]); }
    }
    return out.sort((a, b) => a[1] - b[1]).map((a) => a[0]);
  }
  nearRes(x, z, rad) { return this.near(this.resGrid, x, z, rad, (r) => !r.until); }
  nearLoot(x, z, rad) { return this.near(this.lootGrid, x, z, rad, (l) => !l.until); }
  // รถร้างที่ค้นไปแล้วแต่ยังไม่ถูกซ่อม (ซ่อมให้ขับได้)
  nearSearchedCar(x, z, rad) { const now = Date.now(); return this.near(this.lootGrid, x, z, rad, (l) => l.kind === 'car' && l.until > now && l.until < now + 864e5)[0] || null; }

  // ชนกับอาคาร ต้นไม้ หิน
  collide(pos, radius = 0.4, from = null) {
    const hit = collideBoxes(this.buildings, pos, radius, from);
    for (const r of this.near(this.resGrid, pos.x, pos.z, 3, (o) => !o.until && RES_TYPES[o.type].r)) {
      const rr = RES_TYPES[r.type].r * r.s + radius;
      const dx = pos.x - r.x, dz = pos.z - r.z, L = Math.hypot(dx, dz);
      if (L < rr && L > 0.001) { pos.x = r.x + dx / L * rr; pos.z = r.z + dz / L * rr; }
    }
    return hit;
  }
  roofAt(x, z, y) { return roofUnder(this.buildings, x, z, y); }
  // ความสูงพื้นรวมหลังคาอาคาร (ไม่มีการปีนตึก ใช้พื้นดินอย่างเดียว)
  groundAt(x, z) { return heightAt(x, z); }

  addStructure(s) {
    if (this.structureMeshes.has(s.id)) return;
    const m = makeStructureMesh(s);
    this.scene.add(m); this.structureMeshes.set(s.id, m); this.structures.push(s);
    this.rebuildColliders();
    if (s.type === 'basecore') this.retintAll(); else if (TINTABLE.has(s.type)) this.retint(s);
  }
  // สีฐาน: ชิ้นส่วนบ้าน/รั้วในรั้วของฐานเปลี่ยนสีตามที่เจ้าบ้านเลือก · ป้ายแสดงชื่อฐาน
  retint(s) {
    const m = this.structureMeshes.get(s.id); if (!m) return;
    const b = baseAt(this.structures, s.x, s.z), col = b?.col;
    if (m.userData.signLabel) m.userData.signLabel.userData.set(b ? `🏡 ${b.name}` : 'ป้ายชื่อฐาน (วางในรั้วของฐาน)', '#ffd166');
    if ((m.userData.tint || null) === (col || null)) return;
    m.userData.tint = col || null;
    m.traverse((o) => {
      if (!o.isMesh || o.isSprite || !o.material?.color) return;
      o.userData.c0 ||= '#' + o.material.color.getHexString();
      if (!col) { o.material = tintMat(o.userData.c0); return; }
      const c = new THREE.Color(o.userData.c0).lerp(new THREE.Color(col), 0.65); o.material = tintMat('#' + c.getHexString());
    });
  }
  retintAll() { for (const s of this.structures) if (TINTABLE.has(s.type)) this.retint(s); }
  updateStructure(id, patch) {
    const s = this.structures.find((x) => x.id === id); if (!s) return null;
    Object.assign(s, patch);
    const m = this.structureMeshes.get(id);
    if (m && ('x' in patch || 'z' in patch)) { m.position.x = s.x; m.position.z = s.z; m.rotation.y = s.type === 'vehicle' ? s.ry || 0 : m.rotation.y; }
    if ('tier' in patch && m) { this.scene.remove(m); const nm = makeStructureMesh(s); this.scene.add(nm); this.structureMeshes.set(id, nm); if (TINTABLE.has(s.type)) this.retint(s); }
    if ('open' in patch || 'x' in patch || 'tier' in patch) this.rebuildColliders();
    if (s.type === 'basecore' && ('col' in patch || 'ok' in patch || 'name' in patch || 'box' in patch)) this.retintAll();
    return s;
  }
  removeStructure(id) {
    const i = this.structures.findIndex((x) => x.id === id); if (i < 0) return;
    this.structures.splice(i, 1);
    const m = this.structureMeshes.get(id); if (m) this.scene.remove(m);
    this.structureMeshes.delete(id); this.rebuildColliders();
  }
  rebuildColliders() { this.buildings = [...this.baseBuildings, ...this.structures.flatMap(collidersFor)]; }
  tickStructures(now, dt, P) {
    for (const m of this.structureMeshes.values()) {
      if (Math.abs(m.position.x - P.x) > 120 || Math.abs(m.position.z - P.z) > 120) continue;
      updateStructureMesh(m, now, dt);
    }
  }
  nearStructure(x, z, type, rad) {
    return this.structures.find((s) => s.type === type && (s.x - x) ** 2 + (s.z - z) ** 2 < rad * rad);
  }
  nearestStructure(x, z, rad, filter) {
    let best = null, bd = rad * rad;
    for (const s of this.structures) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd && (!filter || filter(s))) { bd = d; best = s; } }
    return best;
  }

  buildMinimap() {
    const H = 530, W = Math.round(H * (WORLD.maxX - WORLD.minX) / (WORLD.maxZ - WORLD.minZ)), sx = (WORLD.maxX - WORLD.minX) / W, sz = (WORLD.maxZ - WORLD.minZ) / H;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); const img = x.createImageData(W, H); const col = new THREE.Color();
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const wx = WORLD.minX + i * sx, wz = WORLD.minZ + j * sz, h = heightAt(wx, wz);
      const w = waterAt(wx, wz, h);
      if (w) col.set(w.fresh ? '#4ea8de' : '#1d4e89'); else this.colorAt(wx, wz, h, col);
      const k = (j * W + i) * 4; img.data[k] = col.r * 255; img.data[k + 1] = col.g * 255; img.data[k + 2] = col.b * 255; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    x.fillStyle = 'rgba(40,40,40,.8)';
    for (const [rx, rz] of this.roadPts) x.fillRect((rx - WORLD.minX) / sx, (rz - WORLD.minZ) / sz, 1.2, 1.2);
    this.mapCanvas = c; this.mapScale = { sx, sz };
    this.labels = [
      ...TOWNS.map((t) => ({ name: t.name, x: t.x, z: t.z, kind: 'town' })),
      ...ISLANDS.map((i) => ({ name: i.name, x: i.p[0], z: i.p[1], kind: 'island' })),
      ...LAKES.map((l) => ({ name: l.name, x: l.p[0], z: l.p[1], kind: 'lake' })),
      ...MOUNTAINS.slice(0, 1).map((m) => ({ name: m.name, x: m.p[0], z: m.p[1], kind: 'mountain' })),
      ...LANDMARKS.map((l) => ({ name: l.name, x: l.x, z: l.z, kind: 'poi' })),
    ];
  }
}
