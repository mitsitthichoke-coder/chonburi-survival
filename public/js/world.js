import * as THREE from 'three';
import { WORLD, heightAt, waterAt, coastX, fbm, mulberry32, LAKES, ISLANDS, MOUNTAINS, latToZ, distToCoast } from './terrain.js';
import { TOWNS, LOOT_TABLE, QUEST_SPOTS } from './data.js';
import { getLayout, collideBoxes, roofUnder, inCamp } from './citygen.js';
import { RES_TYPES, getResources } from './resources-core.js';
import { mat, GFX } from './models.js';
import { makeStructureMesh, updateStructureMesh } from './structures3d.js';
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
      if (dx * dx + dz * dz < t.r * t.r * 0.8 && h > 0.6) { out.lerp(new THREE.Color(0.45, 0.43, 0.4), 0.7); break; }
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

  ribbon(points, width, color) {
    const verts = [], idx = [];
    for (let i = 0; i < points.length; i++) {
      const [x, z] = points[i];
      const [nx, nz] = points[Math.min(i + 1, points.length - 1)], [px, pz] = points[Math.max(i - 1, 0)];
      let dx = nx - px, dz = nz - pz; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const ox = -dz * width / 2, oz = dx * width / 2;
      verts.push(x + ox, heightAt(x + ox, z + oz) + 0.18, z + oz, x - ox, heightAt(x - ox, z - oz) + 0.18, z - oz);
      if (i > 0) { const b = i * 2; idx.push(b - 2, b - 1, b, b - 1, b + 1, b); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.receiveShadow = true; this.scene.add(m);
  }

  buildRoads() {
    this.layout = getLayout();
    this.roadPts = this.layout.roadPts;
    for (const r of this.layout.roads) this.ribbon(r.pts, r.width, r.main ? '#3a3a3c' : '#444446');
  }

  buildTowns() {
    const L = this.layout;
    this.baseBuildings = [...L.buildings, ...L.fence, L.gate];
    this.buildings = [...this.baseBuildings];
    let ci = 0; for (const l of L.loot) { this.addLoot(l.x, l.z, l.kind); if (l.kind === 'car') this.loot[this.loot.length - 1].carIdx = ci++; }
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
    crates.forEach((l, i) => { l.idx = i; M.makeTranslation(l.x, heightAt(l.x, l.z) + 0.35, l.z); l.m = M.clone(); this.lootMesh.setMatrixAt(i, M); });
    this.lootMesh.castShadow = true; this.scene.add(this.lootMesh);
    this.buildQuestSites();
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

  // สถานที่ของภารกิจหลัก
  buildQuestSites() {
    const B = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; this.scene.add(m); return m; };
    // ป้อมยามชายหาด
    const r = QUEST_SPOTS.radio, ry = heightAt(r.x, r.z);
    B(2.6, 2.4, 2.6, '#d9d2c3', r.x, ry + 1.2, r.z); B(3.2, 0.3, 3.2, '#b23a48', r.x, ry + 2.55, r.z);
    B(0.9, 0.5, 0.6, '#222', r.x + 1.6, ry + 0.9, r.z); // โต๊ะวิทยุ
    this.radioGlow = B(0.25, 0.25, 0.25, '#7cff6b', r.x + 1.6, ry + 1.3, r.z);
    // เสาส่งสัญญาณ
    const t = QUEST_SPOTS.tower, ty = heightAt(t.x, t.z);
    for (let i = 0; i < 6; i++) B(1.6 - i * 0.2, 4, 0.2, i % 2 ? '#e63946' : '#f1faee', t.x, ty + 2 + i * 4, t.z);
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(0.15, 24, 0.15, '#8d99ae', t.x + ox * 0.8, ty + 12, t.z + oz * 0.8);
    this.towerLight = B(0.5, 0.5, 0.5, '#ff4d4d', t.x, ty + 24.5, t.z);
    B(2, 1.4, 1.4, '#495057', t.x + 3, ty + 0.7, t.z); // ตู้ส่งสัญญาณ
    // ค่ายอพยพ
    const c = QUEST_SPOTS.camp, cy = heightAt(c.x, c.z);
    for (const f of this.layout.fence) B(f.w, 3, f.d, '#6c757d', f.x, cy + 1.5, f.z);
    for (let i = -2; i <= 2; i++) if (i) B(0.3, 4, 0.3, '#343a40', c.x + i * 3.5, cy + 2, c.z - c.size / 2);
    this.gateMesh = B(this.layout.gate.w, 3, 0.4, '#ffb703', this.layout.gate.x, cy + 1.5, this.layout.gate.z);
    for (let i = 0; i < 6; i++) {
      const tx = c.x - 10 + (i % 3) * 10, tz = c.z - 2 + Math.floor(i / 3) * 9;
      const tent = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.6, 4), mat(i % 2 ? '#2a9d8f' : '#e9c46a'));
      tent.position.set(tx, heightAt(tx, tz) + 1.3, tz); tent.rotation.y = Math.PI / 4; tent.castShadow = true; this.scene.add(tent);
    }
    B(0.15, 9, 0.15, '#ced4da', c.x, cy + 4.5, c.z - 8);
    this.flag = B(2.4, 1.4, 0.05, '#e63946', c.x + 1.2, cy + 8.2, c.z - 8);
    B(2.4, 0.47, 0.06, '#f1faee', c.x + 1.2, cy + 8.2, c.z - 8); B(2.4, 0.25, 0.07, '#1d3557', c.x + 1.2, cy + 8.2, c.z - 8);
  }

  openGate() {
    const g = this.layout.gate;
    const i = this.baseBuildings.indexOf(g); if (i >= 0) { this.baseBuildings.splice(i, 1); this.rebuildColliders(); }
    if (this.gateMesh) this.gateMesh.position.x += g.w;
  }

  addLoot(x, z, kind) {
    const l = { id: 'L' + this.loot.length, x, z, kind, until: 0 };
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
      palm: [[new THREE.CylinderGeometry(0.15, 0.25, 6, 5).translate(0, 3, 0), '#8d6e4a'], [new THREE.ConeGeometry(2.2, 1.0, 7).translate(0, 6.1, 0), '#4f9d3a'], [new THREE.SphereGeometry(0.35, 5, 4).translate(0.3, 5.5, 0), '#7a5c2e']],
      rock: [[new THREE.DodecahedronGeometry(0.9, 0).translate(0, 0.4, 0), '#8a8a85']],
      bush: [[new THREE.DodecahedronGeometry(0.7, 0).translate(0, 0.5, 0), '#3f7d20'], [new THREE.SphereGeometry(0.4, 4, 3).translate(0.25, 0.75, 0.3), '#5b2a86']],
      herb: [[new THREE.ConeGeometry(0.25, 0.6, 5).translate(0, 0.3, 0), '#80b918']],
      grass: [[new THREE.ConeGeometry(0.35, 0.9, 4).translate(0, 0.45, 0), '#a7c957']],
      twig: [[new THREE.CylinderGeometry(0.04, 0.05, 1.1, 4).rotateZ(Math.PI / 2).translate(0, 0.05, 0), '#8b5e34'], [new THREE.CylinderGeometry(0.03, 0.04, 0.8, 4).rotateZ(Math.PI / 2).rotateY(0.9).translate(0.1, 0.1, 0.05), '#a47148']],
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
          im.castShadow = type === 'tree' || type === 'palm' || type === 'rock';
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
  collide(pos, radius = 0.4) {
    const hit = collideBoxes(this.buildings, pos, radius);
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
  }
  updateStructure(id, patch) {
    const s = this.structures.find((x) => x.id === id); if (!s) return null;
    Object.assign(s, patch);
    const m = this.structureMeshes.get(id);
    if (m && ('x' in patch || 'z' in patch)) { m.position.x = s.x; m.position.z = s.z; m.rotation.y = s.type === 'vehicle' ? s.ry || 0 : m.rotation.y; }
    if ('open' in patch || 'x' in patch) this.rebuildColliders();
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
    const W = 324, H = 530, sx = (WORLD.maxX - WORLD.minX) / W, sz = (WORLD.maxZ - WORLD.minZ) / H;
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
    ];
  }
}
