// แสดงผลกล่องภารกิจ 🔒 และกล่องหายาก ✨ (กติกาอยู่ใน boxes-core.js / economy.js)
import * as THREE from 'three';
import { QUEST_BOXES, qboxLock, rareBoxAt, charLevelOf } from './boxes-core.js';
import { heightAt } from './terrain.js';
import { mat } from './models.js';

const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); m.castShadow = true; return m; };

function questBoxMesh() {
  const g = new THREE.Group();
  g.add(box(1.1, 0.75, 0.8, '#355070', 0, 0.38, 0));
  g.add(box(1.14, 0.1, 0.84, '#e9c46a', 0, 0.76, 0));
  for (const x of [-0.45, 0.45]) g.add(box(0.08, 0.78, 0.84, '#e9c46a', x, 0.38, 0));
  const lock = new THREE.Group(); lock.position.set(0, 0.45, 0.42);
  lock.add(box(0.22, 0.2, 0.06, '#adb5bd', 0, 0, 0));
  lock.add(box(0.05, 0.14, 0.04, '#adb5bd', -0.07, 0.15, 0), box(0.05, 0.14, 0.04, '#adb5bd', 0.07, 0.15, 0), box(0.19, 0.04, 0.04, '#adb5bd', 0, 0.22, 0));
  g.add(lock); g.userData.lock = lock;
  // ป้ายเหนือกล่อง: สีบอกสถานะ (แดง = ล็อก · เขียว = เปิดได้)
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: '#e63946' }));
  gem.position.y = 1.5; g.add(gem); g.userData.gem = gem;
  return g;
}
function rareBoxMesh() {
  const g = new THREE.Group();
  const glow = new THREE.MeshBasicMaterial({ color: '#c77dff' });
  g.add(box(0.9, 0.7, 0.9, '#5a189a', 0, 0.35, 0));
  const lid = box(0.96, 0.14, 0.96, '#ffd60a', 0, 0.74, 0); g.add(lid);
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.92), glow); core.position.y = 0.35; g.add(core);
  // ลำแสงพุ่งขึ้นฟ้า มองเห็นจากระยะไกล
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 60, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#c77dff', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 30; g.add(beam); g.userData.beam = beam;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 24), glow); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; g.add(ring); g.userData.ring = ring;
  return g;
}

export class Boxes {
  constructor(game) {
    this.g = game; this.t = 0; this.rare = null; this.announced = '';
    this.q = QUEST_BOXES.map((b) => {
      const m = questBoxMesh(); m.position.set(b.x, heightAt(b.x, b.z), b.z); m.rotation.y = (b.x * 7) % 6.28; game.scene.add(m);
      return { b, m };
    });
    this.rareMesh = rareBoxMesh(); this.rareMesh.visible = false; game.scene.add(this.rareMesh);
    // ลำแสงสีเหลืองชี้รถที่ต้องค้นในภารกิจ "หาแหล่งพลังงาน"
    const bm = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 40, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd60a', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
    bm.position.y = 20; this.beacon = new THREE.Group(); this.beacon.add(bm);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), new THREE.MeshBasicMaterial({ color: '#ffd60a' })); arrow.rotation.x = Math.PI; arrow.position.y = 3.2; this.beacon.add(arrow); this.beacon.userData.arrow = arrow;
    this.beacon.visible = false; game.scene.add(this.beacon);
  }
  get opened() { return this.g.boxes || (this.g.boxes = {}); }
  lockOf(b) { const g = this.g; return qboxLock(b, { quest: g.quest, stats: g.stats }, charLevelOf(g.skills)); }

  update(dt) {
    const g = this.g; this.t += dt;
    const R = this.rareMesh;
    if (R.visible) { R.rotation.y += dt * 0.8; R.userData.ring.scale.setScalar(1 + Math.sin(this.t * 3) * 0.15); R.userData.beam.material.opacity = 0.22 + Math.sin(this.t * 2) * 0.08; }
    for (const { m } of this.q) if (m.visible) { m.userData.gem.rotation.y += dt * 2; m.userData.gem.position.y = 1.5 + Math.sin(this.t * 2) * 0.1; }
    const qt = g.quest.done ? null : g.quest.cur.id === 'battery' ? g.quest.target() : null;
    this.beacon.visible = !!qt;
    if (qt) { this.beacon.position.set(qt.x, heightAt(qt.x, qt.z), qt.z); this.beacon.userData.arrow.position.y = 3.2 + Math.sin(this.t * 3) * 0.3; this.beacon.userData.arrow.rotation.y += dt * 2; }
    if ((this.slow = (this.slow || 0) + dt) < 1) return;
    this.slow = 0;
    // กล่องภารกิจ: ซ่อนเมื่อเปิดแล้ว · เปลี่ยนสีป้ายเมื่อปลดล็อก
    for (const { b, m } of this.q) {
      m.visible = !this.opened[b.id];
      const free = !this.lockOf(b);
      m.userData.gem.material.color.set(free ? '#52b788' : '#e63946'); m.userData.lock.visible = !free;
    }
    // กล่องหายาก
    const rb = rareBoxAt(g.now());
    this.rare = rb && !this.opened[rb.id] ? rb : null;
    R.visible = !!this.rare;
    if (this.rare) {
      R.position.set(rb.x, heightAt(rb.x, rb.z), rb.z);
      if (this.announced !== rb.id) {
        this.announced = rb.id; g.sfx.play('quest');
        const P = g.player.pos, d = Math.hypot(rb.x - P.x, rb.z - P.z) * 50;
        g.ui.toast(`✨ กล่องหายากปรากฏขึ้น! ห่างไป ${d >= 1000 ? (d / 1000).toFixed(1) + ' กม.' : Math.round(d) + ' ม.'} — ดูจุดสีม่วงบนแผนที่ (หายไปใน ${Math.ceil((rb.until - g.now()) / 60000)} นาที)`, 'level');
        g.ui.chat('', '✨ มีแสงสีม่วงพุ่งขึ้นฟ้า... กล่องหายากที่มีของล้ำค่าปรากฏขึ้นที่ไหนสักแห่งในชลบุรี!', true);
      }
    }
  }

  // ปุ่ม E
  prompt(P) {
    const g = this.g;
    if (this.rare && Math.hypot(this.rare.x - P.x, this.rare.z - P.z) < 2.8) {
      const id = this.rare.id;
      return { type: 'quest', q: { act: () => g.auth.do('rare', { id }) }, text: `✨ เปิดกล่องหายาก (เหลือ ${Math.ceil((this.rare.until - g.now()) / 60000)} นาที)` };
    }
    for (const { b, m } of this.q) {
      if (!m.visible || Math.hypot(b.x - P.x, b.z - P.z) > 2.8) continue;
      const lock = this.lockOf(b);
      return { type: 'quest', q: { act: () => (lock ? g.ui.toast(`🔒 ${b.name}: ${lock}`, 'warn') : g.auth.do('qbox', { id: b.id })) }, text: lock ? `🔒 ${b.name} — ${lock}` : `📦 เปิด${b.name}` };
    }
    return null;
  }

  // จุดบนแผนที่: [x, z, ชนิด]
  markers() {
    const out = this.q.filter(({ m }) => m.visible).map(({ b }) => [b.x, b.z, this.lockOf(b) ? 'qlock' : 'qopen']);
    if (this.rare) out.push([this.rare.x, this.rare.z, 'rare']);
    return out;
  }
}
