// ระบบตกปลา: เหวี่ยงเบ็ด → รอปลากิน → กดให้ทันตอนทุ่นจม
import * as THREE from 'three';
import { heightAt, waterAt } from './terrain.js';
import { skillLevel, ITEMS, hasPerk } from './data.js';
import { petNearbyWith } from './pets.js';

const TABLE = {
  sea: [['raw_fish', 50], ['crab', 16], ['squid', 12], ['big_fish', 10], ['bottle', 4], ['scrap', 4], ['cloth', 3], ['golden_fish', 1]],
  fresh: [['raw_fish', 58], ['prawn', 16], ['big_fish', 10], ['seeds_veg', 4], ['bottle', 5], ['golden_fish', 2]],
  pond: [['raw_fish', 80], ['prawn', 10], ['big_fish', 8], ['golden_fish', 2]],
};

export class Fishing {
  constructor(game) {
    this.g = game; this.state = null;
    this.bob = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshLambertMaterial({ color: '#e63946' }));
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshLambertMaterial({ color: '#ffffff' })); w.position.y = 0.1;
    this.bob.add(b, w); this.bob.visible = false; game.scene.add(this.bob);
    this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#dddddd' }));
    this.line.visible = false; game.scene.add(this.line);
  }

  // มีน้ำให้ตกปลาตรงหน้าหรือไม่: {x,z,level,kind}
  spot() {
    const g = this.g, a = g.camYaw + Math.PI, P = g.player.pos;
    for (const d of [4.5, 3.5, 2.5, 5.5]) {
      const x = P.x + Math.sin(a) * d, z = P.z + Math.cos(a) * d;
      const pond = g.world.nearestStructure(x, z, 1.3, (s) => s.type === 'pond');
      if (pond) return { x: pond.x, z: pond.z, level: (pond.y ?? heightAt(pond.x, pond.z)) + 0.22, kind: 'pond', pond };
      const w = waterAt(x, z);
      if (w) return { x, z, level: w.level, kind: w.fresh ? 'fresh' : 'sea' };
    }
    return null;
  }
  get active() { return !!this.state; }

  cast() {
    const g = this.g, sp = this.spot();
    if (!sp) return g.ui.toast('หันหน้าไปทางน้ำก่อน (ทะเล อ่างเก็บน้ำ หรือบ่อปลา)', 'warn');
    const lvl = skillLevel(g.skills.fishing);
    const wait = Math.max(hasPerk(g.auth.ch, 'fisher', 1) ? 1.8 : 2.8, (4 + Math.random() * 8) * Math.max(0.4, 1 - (lvl - 1) * 0.05) * (hasPerk(g.auth.ch, 'fisher', 1) ? 0.6 : 1));
    g.auth.do('fcast', { x: +sp.x.toFixed(2), z: +sp.z.toFixed(2) });
    this.state = { phase: 'wait', t: 0, biteAt: wait, sp, from: g.player.pos.clone(), window: 1.3 + lvl * 0.08 };
    this.bob.position.set(sp.x, sp.level + 0.05, sp.z); this.bob.visible = true; this.line.visible = true;
    g.player.ry = g.camYaw + Math.PI; g.atkT = 1;
    g.sfx.play('swing'); setTimeout(() => g.sfx.play('splash'), 350);
  }
  cancel(msg) { this.state = null; this.bob.visible = false; this.line.visible = false; if (msg) this.g.ui.toast(msg); }

  // E/คลิกระหว่างตกปลา
  reel() {
    const g = this.g, st = this.state; if (!st) return;
    if (st.phase !== 'bite') return this.cancel('ดึงเบ็ดขึ้นเร็วไป ยังไม่มีปลากิน');
    // ได้ปลาอะไร ทอยโดยระบบเศรษฐกิจ (เซิร์ฟเวอร์) — ผลแสดงผ่าน onEcon
    g.auth.do('freel');
    this.cancel();
  }

  update(dt) {
    const g = this.g, st = this.state; if (!st) return;
    if (!ITEMS[g.equipped]?.tool?.rod || g.dead || g.vehicle || g.player.pos.distanceTo(st.from) > 1.5) return this.cancel('เก็บเบ็ดแล้ว');
    st.t += dt;
    const hand = g.player.pos.clone(); hand.y += 1.6; hand.x += Math.sin(g.player.ry) * 0.9; hand.z += Math.cos(g.player.ry) * 0.9;
    const bob = this.bob.position;
    if (st.phase === 'wait') {
      bob.y = st.sp.level + 0.05 + Math.sin(st.t * 3) * 0.03;
      if (st.t >= st.biteAt) { st.phase = 'bite'; st.t = 0; g.sfx.play('splash'); g.ui.toast('❗ ปลากินเบ็ด! ' + (g.touch ? 'แตะ ✋ เร็ว!' : 'กด E หรือคลิกเร็ว!'), 'warn'); }
    } else {
      bob.y = st.sp.level - 0.15 + Math.sin(st.t * 25) * 0.06;
      if (st.t > st.window) this.cancel('ปลาหลุดไปแล้ว... ลองใหม่');
    }
    const pos = this.line.geometry.attributes.position;
    pos.setXYZ(0, hand.x, hand.y, hand.z); pos.setXYZ(1, bob.x, bob.y + 0.1, bob.z); pos.needsUpdate = true;
  }
  prompt() {
    const st = this.state; if (!st) return null;
    return st.phase === 'bite' ? '❗ ปลากินเบ็ด! ดึงเลย!' : '🎣 รอปลากินเบ็ด... (กดอีกครั้งเพื่อเก็บเบ็ด)';
  }
}
