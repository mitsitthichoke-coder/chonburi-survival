import * as THREE from 'three';
import { makeHuman, animateHuman, makeAnimal, animateAnimal, makeLabel, setHeldTool, setPetGear, setOutfit, SKINS, setInjury, tickInjury, ridePose, sleepPose } from './models.js';
import { ITEMS, WEAR_SLOTS, PET_SLOTS } from './data.js';
import { makeVehicle } from './structures3d.js';
import { NPCS as NPC_LIST } from './data.js';
import { heightAt, waterAt } from './terrain.js';
import { TOWNS, NPCS, PET_TYPES } from './data.js';
import { relName, relColor } from './social-core.js';
import { inCamp } from './citygen.js';
import { petStats, rarityOf, fights, gainPetXp } from './pets.js';
import { ZTIERS, BOSS, BOSS_EVERY, BOSS_CHANCE, pickTier, zombieHp } from './zombies-core.js';
import { killPerk, WILD, pickWild, inTownAt, FIRE_SAFE, nearFireOf } from './data.js';
import { safeBaseAt } from './building-core.js';

const ANIMALS = {
  zombie: { hp: 40, speed: 1.6, chase: 3.0, drops: [['rag', 0.75], ['rag', 0.4], ['zipper', 0.22], ['kevlar', 0.05], ['cloth', 0.25], ['scrap', 0.25], ['bandage', 0.08], ['bottle', 0.1]] },
  boar: { hp: 35, speed: 1.4, flee: 4.5, drops: [['raw_meat', 1], ['raw_meat', 1], ['raw_meat', 0.6], ['hide', 0.8]], hostileWhenHit: true },
  deer: { hp: 25, speed: 1.2, flee: 6.5, drops: [['raw_meat', 1], ['raw_meat', 1], ['hide', 1], ['hide', 0.4]] },
  chicken: { hp: 8, speed: 0.8, flee: 3.5, drops: [['raw_meat', 1]] },
  raptor: { hp: 70, speed: 2.2, flee: 0, drops: [] }, tiger: { hp: 90, speed: 1.8, flee: 0, drops: [] }, trike: { hp: 170, speed: 1.0, flee: 0, drops: [] },
  dog: { hp: 30, speed: 1.4, stray: true }, cat: { hp: 20, speed: 1.0, stray: true }, bird: { hp: 10, speed: 1.8, stray: true, fly: true },
};
const tmp = new THREE.Vector3();
// หน้าตาผู้ติดเชื้อตามระดับ
function zombieMesh(T) {
  const m = makeHuman(Math.random() < 0.5 ? 'm' : 'f', { shirt: T.color, pants: '#2f2f2f', hair: '#333' }, 'zombie');
  m.scale.setScalar(T.scale);
  if (T.key === 'toxic') m.userData.inner.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: '#70e000', transparent: true, opacity: 0.18, depthWrite: false })).translateY(1.2));
  if (T.boss) {
    const crown = new THREE.Group(), gold = new THREE.MeshLambertMaterial({ color: '#ffd60a' });
    crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.1, 10), gold));
    for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), gold); const a = (i / 5) * Math.PI * 2; sp.position.set(Math.cos(a) * 0.2, 0.12, Math.sin(a) * 0.2); crown.add(sp); }
    crown.position.y = 0.33; m.userData.head.add(crown);
  }
  return m;
}

export class Entities {
  constructor(game) {
    this.g = game; this.scene = game.scene;
    this.list = []; this.remotes = new Map(); this.spawnT = 0;
    for (const n of NPCS) this.spawnNPC(n);
  }

  add(e) { e.uid = (this.uidSeq = (this.uidSeq || 0) + 1); this.scene.add(e.mesh); this.list.push(e); return e; }
  remove(e) { this.scene.remove(e.mesh); e.dead = true; }

  base(kind, type, mesh, x, z) {
    const y = heightAt(x, z);
    mesh.position.set(x, y, z);
    return { kind, type, mesh, pos: mesh.position, ry: Math.random() * 6.28, speed: 0, hp: 1, maxHp: 1, t: 0, wander: null, atkCd: 0 };
  }

  spawnNPC(n) {
    const town = TOWNS.find((t) => t.key === n.town);
    const look = { skin: SKINS[(n.id.length * 7) % SKINS.length], shirt: ['#6a994e', '#bc4749', '#386641', '#e9c46a', '#264653', '#e76f51'][n.id.length % 6], hair: n.sex === 'f' ? '#2b1d14' : '#111' };
    const { x, z } = this.findLand(town.x, town.z, 12);
    const e = this.base('npc', 'human', makeHuman(n.sex, look), x, z);
    Object.assign(e, { id: n.id, def: n, sex: n.sex, name: n.name, home: { x: town.x, z: town.z }, hp: 100, maxHp: 100, follow: false });
    e.label = makeLabel(n.name); e.label.position.y = 2.3; e.mesh.add(e.label);
    this.add(e);
  }

  findLand(cx, cz, rad) {
    for (let i = 0; i < 40; i++) {
      const x = cx + (Math.random() - 0.5) * rad * 2, z = cz + (Math.random() - 0.5) * rad * 2;
      const h = heightAt(x, z);
      if (h > 0.8 && !waterAt(x, z, h) && !this.g.world.buildings.some((b) => Math.abs(b.x - x) < b.w / 2 + 1 && Math.abs(b.z - z) < b.d / 2 + 1)) return { x, z };
    }
    return { x: cx, z: cz };
  }

  spawnMob(type, x, z, tier) {
    if (type === 'zombie') tier ??= pickTier(Math.random, this.g.dayNum());
    const T = type === 'zombie' ? ZTIERS[tier] || ZTIERS[0] : null;
    const mesh = T ? zombieMesh(T) : makeAnimal(type);
    const e = this.base(type === 'zombie' ? 'zombie' : ANIMALS[type].stray ? 'stray' : 'animal', type, mesh, x, z);
    e.hp = e.maxHp = T ? zombieHp(tier, this.g.dayNum()) : ANIMALS[type].hp;
    if (T) { e.tier = tier; e.T = T; if (T.boss) { e.label = makeLabel(T.name, '#ff4d6d'); e.label.position.y = 2.5; e.label.scale.set(3.2, 0.8, 1); e.mesh.add(e.label); } }
    if (e.kind === 'stray') { e.tame = 0; e.label = makeLabel(PET_TYPES[type].name + 'จรจัด', '#ffd166'); e.label.position.y = type === 'bird' ? 0.8 : 1.4; e.mesh.add(e.label); }
    return this.add(e);
  }

  spawnPet(p) {
    const e = this.base('pet', p.type, makeAnimal(p.type), this.g.player.pos.x + 2, this.g.player.pos.z + 2);
    const st = petStats(p);
    Object.assign(e, { pet: p, hp: p.hp, maxHp: st.maxHp });
    setPetGear(e.mesh, p.type, p.gear, ITEMS);
    e.label = makeLabel('🐾 ' + p.name, rarityOf(p).color); e.label.position.y = p.type === 'bird' ? 0.8 : 1.4; e.mesh.add(e.label);
    return this.add(e);
  }

  refreshPetGear(p) {
    const e = this.list.find((x) => x.kind === 'pet' && x.pet === p && !x.dead);
    if (e) setPetGear(e.mesh, p.type, p.gear, ITEMS);
  }

  syncChildren(children) {
    const have = new Set(this.list.filter((e) => e.kind === 'child' && !e.dead).map((e) => e.child.id));
    for (const c of children) if (!have.has(c.id)) {
      const e = this.base('child', 'human', makeHuman(c.sex, { shirt: '#ffafcc', skin: SKINS[c.name.length % SKINS.length] }, 'child'), this.g.player.pos.x + 1, this.g.player.pos.z + 1);
      Object.assign(e, { child: c, id: c.id, name: c.name, stage: '' });
      e.label = makeLabel(c.name, '#ffc8dd'); e.label.position.y = 1.6; e.mesh.add(e.label);
      this.add(e);
    }
  }

  // ----- ผู้เล่นคนอื่น (ออนไลน์) -----
  upsertRemote(p) {
    let r = this.remotes.get(p.id);
    if (!r) {
      const mesh = makeHuman(p.sex, p.look || {});
      r = { kind: 'remote', id: p.id, name: p.name, sex: p.sex, mesh, pos: mesh.position, target: new THREE.Vector3(), ry: 0, speed: 0, petMeshes: [] };
      r.label = makeLabel(p.name); r.label.position.y = 2.3; mesh.add(r.label);
      this.scene.add(mesh); this.remotes.set(p.id, r);
      if (p.p) mesh.position.set(...p.p);
    }
    if (p.p) r.target.set(...p.p);
    if (p.ry !== undefined) r.tRy = p.ry;
    if (p.anim !== undefined) r.speed = p.anim;
    if (p.cb !== undefined) r.climb = p.cb;
    if (p.st !== undefined) r.stance = p.st;
    if (p.en !== undefined) r.en = p.en;
    if (p.ij !== undefined) setInjury(r.mesh, p.ij | 0);
    if (p.hp !== undefined) r.hp = p.hp;
    if (p.eq !== undefined || p.lh !== undefined) setHeldTool(r.mesh, p.eq !== undefined ? p.eq : r.mesh.userData.tool, p.lh !== undefined ? !!p.lh : undefined);
    if (p.pets) {
      while (r.petMeshes.length > p.pets.length) this.scene.remove(r.petMeshes.pop());
      p.pets.forEach((pp, i) => {
        if (!r.petMeshes[i] || r.petMeshes[i].userData.type !== pp.t) {
          if (r.petMeshes[i]) this.scene.remove(r.petMeshes[i]);
          const m = makeAnimal(pp.t); m.userData.type = pp.t; this.scene.add(m); r.petMeshes[i] = m;
        }
        r.petMeshes[i].userData.target = pp;
        const gk = (pp.g || []).join(',');
        if (r.petMeshes[i].userData.gk !== gk) { r.petMeshes[i].userData.gk = gk; setPetGear(r.petMeshes[i], pp.t, Object.fromEntries(Object.keys(PET_SLOTS).map((k, j) => [k, pp.g?.[j] || null])), ITEMS); }
      });
    }
    // เสื้อผ้าของเพื่อน
    if (p.cl) { const key = p.cl.join(','); if (r.clKey !== key) { r.clKey = key; const w = {}; Object.keys(WEAR_SLOTS).forEach((s, i) => { if (p.cl[i]) w[s] = p.cl[i]; }); setOutfit(r.mesh, w, ITEMS); } }
    // ยานพาหนะที่เพื่อนกำลังขับ
    if (p.v !== undefined && r.vt !== p.v) {
      if (r.vmesh) this.scene.remove(r.vmesh);
      r.vt = p.v; r.vmesh = p.v ? makeVehicle(p.v) : null;
      if (r.vmesh) this.scene.add(r.vmesh);
    }
    return r;
  }
  removeRemote(id) {
    const r = this.remotes.get(id); if (!r) return;
    this.scene.remove(r.mesh); r.petMeshes.forEach((m) => this.scene.remove(m)); if (r.vmesh) this.scene.remove(r.vmesh); this.remotes.delete(id);
  }

  // ----- ผู้ติดเชื้อจากเซิร์ฟเวอร์ (โหมดออนไลน์) -----
  syncNetZombies(list) {
    this.netZ ||= new Map();
    const seen = new Set();
    for (const [id, x, z, ry, spd, tier = 0, hp = 100] of list) {
      seen.add(id);
      let e = this.netZ.get(id);
      if (!e || e.dead) { e = this.spawnMob('zombie', x, z, tier); e.netId = id; e.ry = ry; this.netZ.set(id, e); }
      e.target = { x, z, ry, spd }; e.hp = (hp / 100) * e.maxHp;
    }
    for (const [id, e] of this.netZ) if (!seen.has(id)) { if (!e.dead) this.remove(e); this.netZ.delete(id); }
  }
  // ----- สัตว์ป่า สัตว์จรจัด NPC จากเซิร์ฟเวอร์ -----
  syncNetFauna(flat) {
    const K = ['boar', 'deer', 'chicken', 'dog', 'cat', 'bird', 'npc', 'raptor', 'trike', 'tiger'];
    this.netF ||= new Map();
    const seen = new Set();
    for (let i = 0; i + 5 < flat.length; i += 6) {
      const [id, k, x10, z10, ry100, s10] = flat.slice(i, i + 6);
      const t = { x: x10 / 10, z: z10 / 10, ry: ry100 / 100, spd: s10 / 10 };
      if (K[k] === 'npc') {
        const def = NPC_LIST[id]; const e = def && this.list.find((x) => x.id === def.id);
        if (e) { if (!e.netTarget) { e.pos.x = t.x; e.pos.z = t.z; } e.netTarget = t; }
        continue;
      }
      seen.add(id);
      let e = this.netF.get(id);
      if (!e || e.dead) { e = this.spawnMob(K[k], t.x, t.z); e.netId = id; e.ry = t.ry; this.netF.set(id, e); }
      e.target = t;
    }
    for (const [id, e] of this.netF) if (!seen.has(id)) { if (!e.dead) this.remove(e); this.netF.delete(id); }
  }
  netMobDied(id, mine, k) {
    const e = this.netF?.get(id); if (!e) return;
    this.netF.delete(id); this.remove(e);
    if (mine) this.g.auth.kill(k); // โหมดเซิร์ฟเวอร์: เซิร์ฟเวอร์ให้ของเอง
  }
  setTameProgress(id, v) {
    const e = this.netF?.get(id); if (!e) return;
    e.tame = v; this.g.ui.toast(`${PET_TYPES[e.type].name}กินอย่างเอร็ดอร่อย (เชื่องกับคุณ ${v}%)`);
  }
  // ขยับตามตำแหน่งจากเซิร์ฟเวอร์แบบนุ่มนวล
  netLerp(e, dt, fly = false) {
    const t = e.netTarget || e.target; if (!t) return;
    const dx = t.x - e.pos.x, dz = t.z - e.pos.z;
    if (dx * dx + dz * dz > 400) { e.pos.x = t.x; e.pos.z = t.z; }
    else { e.pos.x += dx * Math.min(1, dt * 8); e.pos.z += dz * Math.min(1, dt * 8); }
    let dr = t.ry - e.ry; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; e.ry += dr * Math.min(1, dt * 8);
    const w = waterAt(e.pos.x, e.pos.z), gy = heightAt(e.pos.x, e.pos.z);
    e.pos.y = fly ? Math.max(gy, w ? w.level : gy) + 1.2 + Math.sin(e.t * 2) * 0.3 : w ? Math.max(gy, w.level - 1.2) : gy;
    e.speed = t.spd;
  }
  netZombieDied(id, mine, tier) {
    const e = this.netZ?.get(id); if (!e) return;
    this.netZ.delete(id); this.remove(e); this.g.sfx.play('zdie');
    if (mine) {
      if (e.lastPet) gainPetXp(this.g, e.lastPet, 15);
      this.g.auth.kill('zombie', tier ?? e.tier ?? 0);
    }
  }
  pan(pos) {
    const g = this.g, rel = Math.atan2(pos.x - g.player.pos.x, pos.z - g.player.pos.z) - (g.camYaw + Math.PI);
    return -Math.sin(rel);
  }

  // ----- การโจมตีของผู้เล่น -----
  hitInFront(pos, dir, range, dmg) {
    let best = null, bd = 1e9;
    for (const e of this.list) {
      if (e.dead || e.kind === 'npc' || e.kind === 'pet' || e.kind === 'child') continue;
      tmp.subVectors(e.pos, pos); tmp.y = 0; const d = tmp.length();
      if (d > range + 0.4) continue;
      tmp.normalize(); if (tmp.dot(dir) < 0.35) continue;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) this.damage(best, dmg, pos);
    return best;
  }

  damage(e, dmg, from, byPet = null) {
    if (byPet) e.lastPet = byPet;
    if (e.netId) { e.hurt = 0.25; this.g.net.send({ t: 'zdmg', id: e.netId, dmg, pet: byPet?.id }); return; }
    e.hp -= dmg; e.hurt = 0.25; e.alert = 8;
    if (ANIMALS[e.type]?.hostileWhenHit || WILD[e.type]?.angryHit || WILD[e.type]?.hostile) e.angry = 12;
    if (e.kind === 'stray') e.tame = Math.max(0, e.tame - 30);
    if (e.hp <= 0) {
      this.remove(e);
      if (e.kind === 'zombie') { this.g.sfx.play('zdie'); if (e.lastPet) gainPetXp(this.g, e.lastPet, 15); }
      if (e.kind === 'zombie' || e.kind === 'animal') this.g.auth.kill(e.type, e.tier || 0);
      if (e.T?.boss) { this.g.ui.chat('', `👑 ${this.g.profile.name} ล้มราชาผู้ติดเชื้อได้แล้ว!`, true); this.g.sfx.play('level'); }
    }
  }

  nearestInteractable(pos, rad = 3) {
    let best = null, bd = rad * rad;
    for (const e of this.list) {
      if (e.dead || !(e.kind === 'npc' || e.kind === 'stray' || e.kind === 'pet' || e.kind === 'child')) continue;
      const d = e.pos.distanceToSquared(pos);
      if (d < bd) { bd = d; best = e; }
    }
    for (const r of this.remotes.values()) { const d = r.pos.distanceToSquared(pos); if (d < bd) { bd = d; best = r; } }
    return best;
  }

  moveOnGround(e, dx, dz, dt) {
    const nx = e.pos.x + dx * dt, nz = e.pos.z + dz * dt;
    const h = heightAt(nx, nz);
    if (e.kind !== 'zombie' && waterAt(nx, nz, h) && e.type !== 'bird') { e.wander = null; return false; }
    e.pos.x = nx; e.pos.z = nz;
    if (e.type !== 'bird') this.g.world.collide(e.pos, 0.35);
    const w = waterAt(e.pos.x, e.pos.z);
    const gy = heightAt(e.pos.x, e.pos.z);
    e.pos.y = e.type === 'bird' ? Math.max(gy, w ? w.level : gy) + 1.2 + Math.sin(e.t * 2) * 0.3 : w ? Math.max(gy, w.level - 1.2) : gy;
    return true;
  }

  steer(e, tx, tz, spd, dt, away = false) {
    let dx = tx - e.pos.x, dz = tz - e.pos.z; const L = Math.hypot(dx, dz) || 1;
    if (away) { dx = -dx; dz = -dz; }
    dx /= L; dz /= L;
    const tRy = Math.atan2(dx, dz);
    let dr = tRy - e.ry; while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2;
    e.ry += dr * Math.min(1, dt * 8);
    this.moveOnGround(e, dx * spd, dz * spd, dt);
    e.speed = spd;
    return L;
  }

  wanderAround(e, cx, cz, rad, spd, dt) {
    if (!e.wander || e.t > e.wander.until) {
      if (Math.random() < 0.35) e.wander = { x: e.pos.x, z: e.pos.z, until: e.t + 2 + Math.random() * 3 };
      else e.wander = { x: cx + (Math.random() - 0.5) * rad * 2, z: cz + (Math.random() - 0.5) * rad * 2, until: e.t + 4 + Math.random() * 6 };
    }
    const d = Math.hypot(e.wander.x - e.pos.x, e.wander.z - e.pos.z);
    if (d > 0.6) this.steer(e, e.wander.x, e.wander.z, spd, dt); else e.speed = 0;
  }

  nearestOf(pos, kind, rad) {
    let best = null, bd = rad * rad;
    for (const e of this.list) if (!e.dead && e.kind === kind) { const d = e.pos.distanceToSquared(pos); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  // กองไฟของผู้เล่น (อัปเดตทุก 1 วินาที)
  baseList() { const now = performance.now(); if (!this._bases || now - this._baseT > 2000) { this._baseT = now; this._bases = this.g.world.structures.filter((s) => s.type === 'basecore' && s.ok); } return this._bases; }
  fireList() { const now = performance.now(); if (!this._fires || now - this._fireT > 1000) { this._fireT = now; this._fires = this.g.world.structures.filter((s) => s.type === 'campfire'); } return this._fires; }
  spawnBoss() {
    if (this.list.some((e) => !e.dead && e.T?.boss)) return null;
    const P = this.g.player.pos;
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 30, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r, h = heightAt(x, z);
      if (h > 0.8 && !waterAt(x, z, h) && !inCamp(x, z, 4)) { const e = this.spawnMob('zombie', x, z, BOSS); this.g.onAnnounce({ kind: 'boss', x, z }); return e; }
    }
    return null;
  }
  // ป้ายพลังชีวิต: บอสแสดงเสมอ · ตัวอื่นแสดงเมื่อกำจัดครบ 500 ตัว
  zombieLabel(e, dP, dt) {
    const show = e.T?.boss || (killPerk(this.g.auth.ch, 3) && dP < 28);
    if (!show) { if (e.label) e.label.visible = false; return; }
    if (!e.label) { e.label = makeLabel(''); e.label.position.y = 2.3; e.mesh.add(e.label); }
    e.label.visible = true;
    if ((e.labelT = (e.labelT || 0) - dt) > 0) return;
    e.labelT = 0.3;
    const pct = Math.max(0, e.hp / e.maxHp), bars = Math.max(1, Math.round(pct * 10));
    e.label.userData.set(`${e.T.name} ${'▮'.repeat(bars)}${'▯'.repeat(10 - bars)}`, pct > 0.5 ? '#ff4d6d' : pct > 0.2 ? '#ff9f1c' : '#ffd166');
  }

  spawnTick() {
    const P = this.g.player.pos, night = this.g.isNight();
    let zc = 0, ac = 0, sc = 0;
    for (const e of this.list) {
      if (e.dead || e.kind === 'npc' || e.kind === 'pet' || e.kind === 'child') continue;
      if (e.netId) { if (e.kind === 'zombie') zc++; continue; }
      const d = e.pos.distanceTo(P);
      if (d > 190) { this.remove(e); continue; }
      if (e.kind === 'zombie') zc++; else if (e.kind === 'animal') ac++; else if (e.kind === 'stray') sc++;
    }
    const town = TOWNS.find((t) => (t.x - P.x) ** 2 + (t.z - P.z) ** 2 < (t.r * 1.6) ** 2);
    const day = this.g.dayNum();
    const zWant = Math.min(30, Math.floor((town ? 7 : 2) * (night ? 2.4 : 0.55) + day * (night ? 0.8 : 0.3))); // กลางวันน้อย กลางคืนเยอะ
    const spawnAt = (minD, maxD) => {
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2, r = minD + Math.random() * (maxD - minD);
        const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r, h = heightAt(x, z);
        if (h > 0.8 && !waterAt(x, z, h) && !inCamp(x, z, 4)) return { x, z };
      }
      return null;
    };
    if (!this.g.net.online && zc < zWant && this.g.safeTime <= 0 && !this.g.inCampNow) { const s = spawnAt(45, 90); if (s) this.spawnMob('zombie', s.x, s.z); }
    // บอส (เล่นคนเดียว): นาน ๆ ครั้ง
    if (!this.g.net.online) {
      this.bossT = (this.bossT ?? BOSS_EVERY * 0.5) - 1000;
      if (this.bossT <= 0) { this.bossT = BOSS_EVERY; if (Math.random() < BOSS_CHANCE && this.g.safeTime <= 0 && !this.g.inCampNow) this.spawnBoss(); }
    }
    if (this.g.net.online) { this.list = this.list.filter((e) => !e.dead); return; }
    if (ac < (town ? 2 : 7)) {
      const s = spawnAt(35, 100);
      if (s) {
        const kk = TOWNS.find((t) => t.key === 'khaokheow');
        const nearZoo = (kk.x - s.x) ** 2 + (kk.z - s.z) ** 2 < 150 * 150;
        const r = Math.random();
        this.spawnMob(pickWild(nearZoo, r, inTownAt(s.x, s.z, 1.4)), s.x, s.z);
      }
    }
    if (town && sc < 3) { const s = spawnAt(20, 50); if (s) this.spawnMob(['dog', 'cat', 'bird'][Math.floor(Math.random() * 3)], s.x, s.z); }
    this.list = this.list.filter((e) => !e.dead);
  }

  update(dt) {
    const g = this.g, P = g.player.pos, night = g.isNight();
    this.spawnT -= dt; if (this.spawnT <= 0) { this.spawnT = 1; this.spawnTick(); }
    const pets = this.list.filter((e) => e.kind === 'pet' && !e.dead);
    for (const e of this.list) {
      if (e.dead) continue;
      e.t += dt; e.atkCd -= dt; if (e.hurt) e.hurt = Math.max(0, e.hurt - dt);
      const dP = e.pos.distanceTo(P);
      if (e.kind === 'npc' && dP > 220 && !e.follow) continue;
      const A = ANIMALS[e.type] || {};
      switch (e.kind) {
        case 'zombie': {
          if (dP < 30 && Math.random() < dt * 0.22) g.sfx.play('groan', { pan: this.pan(e.pos), vol: Math.max(0.15, 1 - dP / 30) });
          this.zombieLabel(e, dP, dt);
          if (e.netId) {
            const t = e.target;
            if (t) {
              const dx = t.x - e.pos.x, dz = t.z - e.pos.z;
              if (dx * dx + dz * dz > 400) { e.pos.x = t.x; e.pos.z = t.z; }
              else { e.pos.x += dx * Math.min(1, dt * 8); e.pos.z += dz * Math.min(1, dt * 8); }
              let dr = t.ry - e.ry; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; e.ry += dr * Math.min(1, dt * 8);
              const w = waterAt(e.pos.x, e.pos.z), gy = heightAt(e.pos.x, e.pos.z);
              e.pos.y = w ? Math.max(gy, w.level - 1.2) : gy; e.speed = t.spd;
            }
            animateHuman(e.mesh, dt, e.speed);
            break;
          }
          // เป้าหมาย: ผู้เล่น หรือ สัตว์เลี้ยง/NPC ที่ใกล้กว่า
          const T = e.T || ZTIERS[0], see = (night ? 40 : 24) * (T.boss ? 1.5 : 1);
          // กลัวกองไฟของผู้เล่น: ถอยออก ไม่ไล่ใครที่ยืนข้างกองไฟ
          const fires = this.fireList(), fire = !T.boss && nearFireOf(fires, e.pos.x, e.pos.z, FIRE_SAFE + 2);
          if (fire) { this.steer(e, fire.f.x, fire.f.z, 2.5, dt, true); animateHuman(e.mesh, dt, e.speed); break; }
          // ฐานที่ยังป้องกันอยู่: ผู้ติดเชื้อเข้าไม่ได้ และไม่ไล่คนที่อยู่ในฐาน
          const bases = this.baseList(), now = g.now(), sb = safeBaseAt(bases, e.pos.x, e.pos.z, now, 1);
          if (sb) { this.steer(e, (sb.box[0] + sb.box[2]) / 2, (sb.box[1] + sb.box[3]) / 2, 3, dt, true); animateHuman(e.mesh, dt, e.speed); break; }
          const playerSafe = (!T.boss && nearFireOf(fires, P.x, P.z)) || !!safeBaseAt(bases, P.x, P.z, now);
          let tgt = null, td = see;
          if (e.ignoreP > 0) e.ignoreP -= dt;
          // ย่อ/คลาน: มองเห็นผู้เล่นได้ใกล้ลง (ยกเว้นตัวที่ตื่นตัวอยู่แล้ว)
          if (dP < see * (e.alert > 0 ? 1 : g.stealthMul()) && !g.dead && !(e.ignoreP > 0) && !playerSafe) { tgt = { pos: P, player: true }; td = dP; }
          for (const o of this.list) if (!o.dead && (o.kind === 'pet' || o.kind === 'npc') && o.type !== 'bird' && !(o.pet?.down > 0)) { const d = o.pos.distanceTo(e.pos); if (d < Math.min(td, 14)) { tgt = o; td = d; } }
          if (e.alert > 0) { e.alert -= dt; if (!tgt && dP < 60 && !(e.ignoreP > 0) && !playerSafe) tgt = { pos: P, player: true }; }
          if (tgt) {
            const d = this.steer(e, tgt.pos.x, tgt.pos.z, (night ? A.chase * 1.25 : A.chase) * T.spd, dt);
            // ผู้ติดเชื้อปีนไม่ได้: ถ้าเป้าหมายอยู่สูงกว่า 2.2 จะวนอยู่ข้างล่าง แล้วเลิกสนใจหลัง 15 วินาที
            const reach = !tgt.player || P.y - e.pos.y < 2.2;
            if (!reach && d < 14) { e.stuck = (e.stuck || 0) + dt; if (e.stuck > 15) { e.stuck = 0; e.ignoreP = 25; e.alert = 0; } }
            if (d < 1.1 + 0.4 * T.scale && e.atkCd <= 0 && reach) {
              e.atkCd = T.boss ? 1.6 : 1.3;
              if (tgt.player) g.player.hurt((7 + g.dayNum() * 0.3) * T.dmg, { bleed: 0.22, infect: T.infect, src: T.name, tier: e.tier });
              else if (tgt.kind === 'pet') { const p = tgt.pet; p.hp -= 6 * (1 - petStats(p).def); if (p.hp <= 0) { p.hp = 0; p.down = 45; g.ui.toast(`😵 ${p.name} บาดเจ็บหมดสติ! (ฟื้นเองใน 45 วินาที หรือใช้ผ้าพันแผลรักษา)`, 'warn'); } }
              else { tgt.hp -= 6; if (tgt.hp <= 0) { tgt.hp = tgt.maxHp; g.ui.toast(`${tgt.name} บาดเจ็บหนักแต่หนีรอดไปได้`); } }
            }
          } else this.wanderAround(e, e.pos.x, e.pos.z, 8, A.speed * Math.min(1, T.spd), dt);
          animateHuman(e.mesh, dt, e.speed);
          break;
        }
        case 'animal': {
          if (e.netId) { this.netLerp(e, dt); animateAnimal(e.mesh, dt, e.speed); break; }
          const W = WILD[e.type] || {}, H = e.home || (e.home = { x: e.pos.x, z: e.pos.z });
          // อาณาเขต: ไดโนเสาร์/นักล่าไม่เข้าเมือง และไม่ออกห่างถิ่นเกิดเกิน leash
          if ((W.noTown && inTownAt(e.pos.x, e.pos.z)) || (W.leash && Math.hypot(e.pos.x - H.x, e.pos.z - H.z) > W.leash)) { e.angry = 0; e.alert = 0; this.steer(e, H.x, H.z, W.chase || 3, dt); animateAnimal(e.mesh, dt, e.speed); break; }
          if (e.angry > 0 && W.noTown && inTownAt(P.x, P.z)) e.angry = 0;
          // ไดโนเสาร์กินเนื้อ: ไล่ล่าผู้เล่นที่เข้าใกล้ (ย่อ/คลานช่วยให้รอด)
          if (W.hostile && dP < W.hostile * g.stealthMul() && !g.dead && g.safeTime <= 0 && !(e.angry > 0) && !nearFireOf(this.fireList(), P.x, P.z)) e.angry = 6;
          if (e.angry > 0 && W.hostile && nearFireOf(this.fireList(), e.pos.x, e.pos.z, FIRE_SAFE + 2)) e.angry = 0;
          if (e.angry > 0 && dP < 40) {
            e.angry -= dt;
            const d = this.steer(e, P.x, P.z, W.chase || 4.2, dt);
            if (d < (W.dino ? 2.2 : 1.6) && e.atkCd <= 0 && P.y - e.pos.y < 2.2) { e.atkCd = 1.5; g.player.hurt(W.dmg || 6, { bleed: W.bleed || 0.15, src: W.name || 'สัตว์ป่า' }); }
          } else if ((W.flee ?? 10) && (dP < (W.flee ?? 10) || e.alert > 0)) {
            if (e.alert > 0) e.alert -= dt;
            this.steer(e, P.x, P.z, W.fleeSpd || A.flee, dt, true);
          } else this.wanderAround(e, e.pos.x, e.pos.z, 10, A.speed, dt);
          animateAnimal(e.mesh, dt, e.speed);
          break;
        }
        case 'stray': {
          if (e.netId) { this.netLerp(e, dt, e.type === 'bird'); e.label.userData.set(`${PET_TYPES[e.type].name}จรจัด ${e.tame ? `(เชื่อง ${e.tame}%)` : ''}`, '#ffd166'); animateAnimal(e.mesh, dt, e.speed); break; }
          if (dP < 4 && e.tame < 100) { e.speed = 0; e.ry = Math.atan2(P.x - e.pos.x, P.z - e.pos.z); }
          else this.wanderAround(e, e.pos.x, e.pos.z, 8, A.speed, dt);
          e.label.userData.set(`${PET_TYPES[e.type].name}จรจัด ${e.tame ? `(เชื่อง ${e.tame}%)` : ''}`, '#ffd166');
          animateAnimal(e.mesh, dt, e.speed);
          break;
        }
        case 'pet': {
          const p = e.pet;
          e.labelT = (e.labelT || 0) - dt;
          if (e.labelT <= 0) { e.labelT = 0.5; const st = petStats(p); e.label.userData.set(`${p.down > 0 ? '😵' : '🐾'} ${p.name} Lv${st.lvl} ❤${Math.ceil(p.hp)}/${st.maxHp}`, rarityOf(p).color); }
          e.mesh.rotation.z = p.down > 0 ? 1.4 : 0; e.mesh.rotation.x = 0;
          const home = p.home && g.world.structures.find((s) => s.id === p.home);
          if (p.home && !home) p.home = null;
          if (home && !(p.down > 0)) {
            // อยู่บ้าน: เดินเล่นรอบบ้านสัตว์เลี้ยง และช่วยไล่ผู้ติดเชื้อที่เข้ามาใกล้
            const z = fights(p) && this.nearestOf(e.pos, 'zombie', 10);
            if (Math.hypot(home.x - e.pos.x, home.z - e.pos.z) > 40) e.pos.set(home.x + 1.5, heightAt(home.x + 1.5, home.z), home.z);
            if (z) { const d = this.steer(e, z.pos.x, z.pos.z, 4.5, dt); if (d < 1.4 && e.atkCd <= 0) { e.atkCd = 1; e.lunge = 0.4; this.damage(z, petStats(p).atk, e.pos, p); } }
            else this.wanderAround(e, home.x, home.z, 3.5, 1, dt);
          } else if (p.stay || p.down > 0) { e.speed = 0; }
          else {
            let tgt = null;
            if (fights(p)) { tgt = this.nearestOf(e.pos, 'zombie', 12); }
            if (tgt) {
              const d = this.steer(e, tgt.pos.x, tgt.pos.z, 4.5, dt);
              if (d < 1.4 && e.atkCd <= 0) { e.atkCd = 1; e.lunge = 0.4; this.damage(tgt, petStats(p).atk, e.pos, p); g.sfx.play({ dog: 'bark', cat: 'meow', bird: 'chirp' }[p.type], { pan: this.pan(e.pos), vol: 0.6 }); }
            } else {
              // เดินเป็นแถวอยู่ข้างหลังผู้เล่น แถวละ 3 ตัว จะได้ไม่บังของที่จะเก็บ
              const fol = pets.filter((x) => !x.pet.home && !x.pet.stay && !(x.pet.down > 0)), k = Math.max(0, fol.indexOf(e));
              const row = Math.floor(k / 3), inRow = Math.min(3, fol.length - row * 3), col = (k % 3) - (inRow - 1) / 2;
              const up = g.petsUp, back = up ? 0.9 + row * 0.6 : 2.6 + row * 1.4, side = col * (up ? 0.6 : 1.4), ry = g.player.ry;
              const fx = P.x - Math.sin(ry) * back + Math.cos(ry) * side, fz = P.z - Math.cos(ry) * back - Math.sin(ry) * side;
              const d = Math.hypot(fx - e.pos.x, fz - e.pos.z);
              if (d > 60) { e.pos.set(fx, heightAt(fx, fz), fz); }
              if (up) {
                // อยู่บนที่สูงกับผู้เล่น: ยืนตามหลังบนหลังคา/หอ ไม่ตกลงพื้น
                if (P.y - heightAt(P.x, P.z) < 1.2) g.petsUp = false;
                else { e.pos.x += (fx - e.pos.x) * Math.min(1, dt * 6); e.pos.z += (fz - e.pos.z) * Math.min(1, dt * 6); e.pos.y = P.y + (e.type === 'bird' ? 1 : 0); e.speed = d > 0.3 ? 2 : 0; }
              } else if (d > 1) this.steer(e, fx, fz, Math.min(g.player.speedNow + 1.5, d * 1.5 + 1), dt); else e.speed = 0;
            }
          }
          if (e.type === 'bird' && !g.petsUp) this.moveOnGround(e, 0, 0, dt);
          animateAnimal(e.mesh, dt, e.speed);
          // ท่าต่อสู้: สุนัขพุ่งงับ · แมวยืนตะปบ · นกโฉบจิก
          if (e.lunge > 0) {
            e.lunge -= dt; const t = 1 - Math.max(0, e.lunge) / 0.4, sw = Math.sin(t * Math.PI);
            const fx = Math.sin(e.ry), fz = Math.cos(e.ry);
            if (e.type === 'dog') { e.mesh.rotation.x = 0.35 * sw; e.pos.x += fx * sw * 0.08; e.pos.z += fz * sw * 0.08; e.pos.y += sw * 0.3; }
            else if (e.type === 'cat') { e.mesh.rotation.x = -0.6 * sw; e.mesh.rotation.z = Math.sin(t * Math.PI * 4) * 0.25 * sw; e.pos.y += sw * 0.15; }
            else { e.mesh.rotation.x = 0.8 * sw; e.pos.y -= sw * 0.9; e.pos.x += fx * sw * 0.06; e.pos.z += fz * sw * 0.06; }
            const legs = e.mesh.userData.legs; if (legs?.length) { legs[0].rotation.x = legs[1].rotation.x = -1.1 * sw; }
          }
          break;
        }
        case 'npc': {
          if (g.net.online && e.netTarget) {
            this.netLerp(e, dt);
            e.label.userData.set(`${e.name} · ${relName(g.social.rel(e.id))}${g.social.preg[e.id] ? ' 🤰' : ''}`, relColor(g.social.rel(e.id)));
            e.mesh.userData.belly.visible = !!g.social.preg[e.id];
            animateHuman(e.mesh, dt, e.speed);
            break;
          }
          const z = this.nearestOf(e.pos, 'zombie', 10);
          const lvl = g.social.level(e.id);
          if (z && lvl >= 4) {
            const d = this.steer(e, z.pos.x, z.pos.z, 3.5, dt);
            if (d < 1.5 && e.atkCd <= 0) { e.atkCd = 1.1; this.damage(z, 8, e.pos); }
            e.attacking = e.atkCd > 0.8 ? (e.atkCd - 0.8) / 0.3 : 0;
          } else if (z) this.steer(e, z.pos.x, z.pos.z, 3.8, dt, true);
          else if (e.follow) {
            const d = Math.hypot(P.x - e.pos.x, P.z - e.pos.z);
            if (d > 70) { const s = this.findLand(P.x, P.z, 3); e.pos.set(s.x, heightAt(s.x, s.z), s.z); }
            if (d > 3) this.steer(e, P.x, P.z, Math.min(g.player.speedNow + 0.8, 7), dt); else { e.speed = 0; e.ry = Math.atan2(P.x - e.pos.x, P.z - e.pos.z); }
          } else if (dP < 5) { e.speed = 0; e.ry = Math.atan2(P.x - e.pos.x, P.z - e.pos.z); }
          else this.wanderAround(e, e.home.x, e.home.z, 20, 1.2, dt);
          const preg = g.social.preg[e.id];
          e.mesh.userData.belly.visible = !!preg;
          e.label.userData.set(`${e.name} · ${relName(g.social.rel(e.id))}${preg ? ' 🤰' : ''}`, relColor(g.social.rel(e.id)));
          animateHuman(e.mesh, dt, e.speed, e.attacking || 0);
          break;
        }
        case 'child': {
          const c = e.child, age = Date.now() - c.born;
          const stage = age < g.const.BABY_MS ? 'baby' : age < g.const.CHILD_MS ? 'child' : 'teen';
          if (stage !== e.stage) {
            const old = e.mesh; const nm = makeHuman(c.sex, { shirt: '#ffafcc', skin: SKINS[c.name.length % SKINS.length] }, stage === 'baby' ? 'baby' : 'child');
            if (stage === 'teen') nm.children[0].scale.setScalar(0.8);
            nm.position.copy(old.position); nm.add(e.label); this.scene.remove(old); this.scene.add(nm);
            e.mesh = nm; e.pos = nm.position; e.stage = stage;
            e.label.position.y = stage === 'baby' ? 1.0 : 1.8;
          }
          const leader = g.childLeader(c);
          const lp = leader ? leader.pos : P;
          const off = 1.6 + (this.list.indexOf(e) % 3) * 0.6;
          const fx = lp.x - Math.sin((leader?.ry ?? g.player.ry)) * off, fz = lp.z - Math.cos((leader?.ry ?? g.player.ry)) * off;
          const d = Math.hypot(fx - e.pos.x, fz - e.pos.z);
          if (d > 50) e.pos.set(fx, heightAt(fx, fz), fz);
          if (d > 0.8) this.steer(e, fx, fz, Math.min(8, d * 2), dt); else e.speed = 0;
          if (stage === 'baby') e.pos.y = (leader ? leader.pos.y : P.y) + 0.9; // อุ้มไว้
          e.label.userData.set(`${c.name} (${stage === 'baby' ? 'ทารก' : stage === 'child' ? 'เด็ก' : 'วัยรุ่น'})`, '#ffc8dd');
          animateHuman(e.mesh, dt, e.speed);
          break;
        }
      }
      e.mesh.rotation.y = e.ry;
      if (e.hurt > 0) e.mesh.position.y += 0.05;
    }
    // ผู้เล่นคนอื่น
    for (const r of this.remotes.values()) {
      const d = r.target.distanceTo(r.pos);
      if (d > 30) r.pos.copy(r.target); else r.pos.lerp(r.target, Math.min(1, dt * 10));
      if (r.tRy !== undefined) { let dr = r.tRy - r.ry; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; r.ry += dr * Math.min(1, dt * 10); }
      r.mesh.rotation.y = r.ry;
      tickInjury(r.mesh, dt); animateHuman(r.mesh, dt, r.vmesh ? 0 : r.speed, 0, r.climb === 1 ? 'climb' : r.climb === 2 ? 'down' : ['', 'crouch', 'crawl'][r.stance] || null);
      if (r.vmesh) { r.vmesh.position.set(r.pos.x, r.pos.y - 0.55, r.pos.z); r.vmesh.rotation.y = r.ry; ridePose(r.mesh, dt, r.speed || 0, r.vt); }
      if (r.stance === 3) sleepPose(r.mesh);
      const pg = g.social.preg[r.id]; r.mesh.userData.belly.visible = !!pg;
      r.label.userData.set(`${r.name} · ${relName(g.social.rel(r.id))}${pg ? ' 🤰' : ''}`, relColor(g.social.rel(r.id)));
      for (const m of r.petMeshes) { const t = m.userData.target; if (!t) continue; const nx = m.position.x + (t.x - m.position.x) * Math.min(1, dt * 6), nz = m.position.z + (t.z - m.position.z) * Math.min(1, dt * 6); const sp = Math.hypot(nx - m.position.x, nz - m.position.z) / dt; m.position.set(nx, t.y, nz); m.rotation.y = t.ry || 0; animateAnimal(m, dt, sp); }
    }
  }
}
