import * as THREE from 'three';
import { World, RES_TYPES } from './world.js';
import { Entities } from './entities.js';
import { Social } from './social.js';
import { UI, coordText } from './ui.js';
import { makeHuman, animateHuman, setHeldTool, setOutfit, GFX, setInjury, tickInjury, injuryBits, sleepPose, sitPose, ridePose, makeLabel } from './models.js';
import { heightAt, waterAt, WORLD, LAKES, ISLANDS, MOUNTAINS } from './terrain.js';
import { jobOf, freePts, jobPts, PERK_PTS, canBuild, maxHpOf, maxStamOf, extraSlots, hasPerk, killPerk, KILL_PERKS, dmgMulOf, JOBS, PET_SLOTS, WEAR_SLOTS, BASE_SLOTS, stackOf, wearStats, SKILLS, ITEMS, RECIPES, TOWNS, SPAWN_TOWN, DAY_MS, PREG_MS, BABY_MS, CHILD_MS, skillLevel, PET_TYPES, RADIO, pickAmmo, ammoDmg, meleeReach, HAPPY_EVERY, HAPPY_EVERY_FREE, happyPower, isFreelancer } from './data.js';
import { distToCoast } from './terrain.js';
import { inCamp } from './citygen.js';
import { Quest } from './quest.js';
import { inCampOf } from './quest-core.js';
import { Boxes } from './boxes.js';
import { jobKit, applyResult, repairCost } from './economy.js';
const jobOfMe = (g) => jobOf(g.ch);
import { Sfx } from './audio.js';
import { TouchControls, isTouchDevice } from './touch.js';
import { rollPet, ensurePet, petStats, gainPetXp, tickPetTraits, petNearbyWith, equipPet } from './pets.js';
import { Builder } from './building.js';
import { isHalloween, setTheme } from './theme.js';
import { weatherAt, airTemp, bodyTarget, fogName } from './weather-core.js';
import { PIECES, baseY, safeBaseAt } from './building-core.js';
import { Fishing } from './fishing.js';
import { Homestead } from './homestead.js';
import { Authority } from './authority.js';
import { hash2 } from './terrain.js';

const SAVE_KEY = 'cbs_save_v1';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Game {
  constructor(profile, net, sfx = new Sfx()) {
    this.profile = profile; this.net = net; this.id = profile.id; this.sfx = sfx;
    this.lowSpec = isTouchDevice();
    this.const = { PREG_MS, BABY_MS, CHILD_MS };
    this.startTime = Date.now() - DAY_MS * 0.05; this.timeOffset = 0;
    this.keys = {}; this.camYaw = Math.PI; this.camPitch = 0.35; this.camDist = 6;
    this.atkT = 0; this.atkCd = 0; this.safeTime = 8; this.radioT = 60; this.saveT = 15; this.netT = 0; this.xpT = 0;
    this.weather = { rain: false, snow: false, fog: 0, t: 120 };
    this.initRenderer();
    this.world = new World(this.scene);
    this.initPlayer();
    this.social = new Social(this);
    this.ents = new Entities(this);
    this.ui = new UI(this);
    this.quest = new Quest(this); this.boxes = {}; this.friends = []; this.friendReqs = []; this.boxUI = new Boxes(this);
    this.builder = new Builder(this); this.fishing = new Fishing(this); this.home = new Homestead(this); this.vehicle = null;
    this.touch = this.lowSpec ? new TouchControls(this) : null;
    this.auth = new Authority(this);
    this.lefty = this.profile.hand === 'l';
    if (!this.auth.server) { if (!this.load()) this.placeAtStart(); const k = jobKit(this.auth.ch); if (k) setTimeout(() => this.onEcon(k, null), 1500); } // โหมดเซิร์ฟเวอร์: ตัวละครโหลดจากเซิร์ฟเวอร์
    this.ents.syncChildren(this.social.children);
    for (const p of this.pets) this.ents.spawnPet(p);
    this.initInput();
    if (net.online) this.initNet();
    this.ui.chat('', `ยินดีต้อนรับสู่ชลบุรี... วันที่โลกเริ่มล่มสลาย · ${coordText(this.player.pos.x, this.player.pos.z)}`, true);
    this.ui.chat('', this.touch ? 'จอยสติ๊กซ้าย = เดิน · ลากจอ = หมุนกล้อง · ⚔️ ตี/เก็บ · ✋ โต้ตอบ · ⤒ กระโดด · 🏃 วิ่ง' : 'WASD เดิน · Shift วิ่ง · Space กระโดด · คลิกซ้าย ตี/เก็บ · E โต้ตอบ · Tab กระเป๋า · R ความสัมพันธ์ · M แผนที่ · Enter แชท', true);
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------------- เวลา/โลก ----------------
  now() { return Date.now() + this.timeOffset; }
  timeOfDay() { return (((this.now() - this.startTime) / DAY_MS) + 0.3) % 1; }
  dayNum() { return Math.floor((this.now() - this.startTime) / DAY_MS + 0.3) + 1; }
  isNight() { const t = this.timeOfDay(); return t < 0.21 || t > 0.82; }
  areaName() {
    const P = this.player.pos;
    for (const t of TOWNS) if ((t.x - P.x) ** 2 + (t.z - P.z) ** 2 < (t.r * 1.3) ** 2) return t.name;
    for (const l of LAKES) if ((l.p[0] - P.x) ** 2 + (l.p[1] - P.z) ** 2 < (l.rx * 2) ** 2) return l.name;
    for (const i of ISLANDS) if ((i.p[0] - P.x) ** 2 + (i.p[1] - P.z) ** 2 < (i.r * 1.5) ** 2) return i.name;
    for (const m of MOUNTAINS) if ((m.p[0] - P.x) ** 2 + (m.p[1] - P.z) ** 2 < m.r ** 2) return m.name;
    return waterAt(P.x, P.z) ? 'อ่าวไทย' : 'ชนบท จ.ชลบุรี';
  }

  initRenderer() {
    const q = GFX.mode, smooth = q === 'smooth', low = q === 'low';
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: 'high-performance' });
    r.setPixelRatio(low ? Math.min(devicePixelRatio, 0.85) : smooth ? Math.min(devicePixelRatio, 2) : this.lowSpec ? 1 : Math.min(devicePixelRatio, 1.5)); r.setSize(innerWidth, innerHeight);
    r.shadowMap.enabled = !low; r.shadowMap.type = THREE.PCFSoftShadowMap;
    // ละมุน: โทนสีแบบภาพยนตร์ แสงไม่แข็ง
    if (smooth) { r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15; }
    document.getElementById('canvas-wrap').appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#a8b8a0', 60, 420);
    this.camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 900);
    this.hemi = new THREE.HemisphereLight('#dfe9f3', '#5a5a40', 0.9); this.scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight('#fff2d6', 1.4);
    sun.castShadow = !low; const sm = smooth && !this.lowSpec ? 4096 : this.lowSpec ? 1024 : 2048; sun.shadow.mapSize.set(sm, sm);
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 300 });
    sun.shadow.bias = -0.0008; this.scene.add(sun, sun.target);
    this.fireLight = new THREE.PointLight('#ff9b3d', 0, 18, 1.6); this.scene.add(this.fireLight);
    // ฝน
    const N = 2500, pos = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * 60;
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(rg, new THREE.PointsMaterial({ color: '#aac', size: 0.12, transparent: true, opacity: 0.6 }));
    this.rain.visible = false; this.scene.add(this.rain);
    addEventListener('resize', () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); r.setSize(innerWidth, innerHeight); });
  }

  // ---------------- ผู้เล่น ----------------
  // ตัวละครใหม่: เกิดในอำเภอของเส้นทางภารกิจ (สุ่มตอนสร้างตัวละคร)
  placeAtStart() {
    const t = TOWNS.find((x) => x.key === this.quest.R.town) || TOWNS.find((x) => x.key === SPAWN_TOWN), R = this.quest.R.radio;
    let sx = R.x + 3, sz = R.z + 3;
    for (let i = 0; i < 60; i++) { const x = R.x + (Math.random() - 0.5) * 10, z = R.z + (Math.random() - 0.5) * 10; if (heightAt(x, z) > 1 && !waterAt(x, z) && !this.world.buildings.some((b) => Math.abs(b.x - x) < b.w / 2 + 1 && Math.abs(b.z - z) < b.d / 2 + 1)) { sx = x; sz = z; break; } }
    this.spawnPoint = { x: sx, z: sz }; this.player.pos.set(sx, heightAt(sx, sz) + 0.5, sz); this.player.vy = 0;
    this.ui.toast(`📍 คุณเริ่มต้นที่${t.name} — ภารกิจหลักจะพาไป${this.quest.camp.name}`, 'level');
  }
  initPlayer() {
    const mesh = makeHuman(this.profile.sex, this.profile.look);
    this.scene.add(mesh);
    const t = TOWNS.find((x) => x.key === SPAWN_TOWN);
    let sx = t.x + 10, sz = t.z;
    for (let i = 0; i < 50; i++) { const x = t.x + (Math.random() - 0.5) * 30, z = t.z + (Math.random() - 0.5) * 30; if (heightAt(x, z) > 1 && !this.world.buildings.some((b) => Math.abs(b.x - x) < b.w / 2 + 1 && Math.abs(b.z - z) < b.d / 2 + 1)) { sx = x; sz = z; break; } }
    this.spawnPoint = { x: sx, z: sz };
    this.player = { mesh, pos: mesh.position, vy: 0, ry: 0, onGround: true, speedNow: 0, swim: false };
    this.player.pos.set(sx, heightAt(sx, sz), sz);
    this.player.hurt = (d, o) => this.hurt(d, o);
    this.stats = { hp: 100, hunger: 80, thirst: 80, stamina: 100, infection: 0, bleeding: false, fracture: false, sick: 0, kills: 0, survived: 0, stress: 0 };
    this.stance = 0; // 0 ยืน · 1 ย่อ · 2 คลาน
    this.inv = { bottle: 1, canned: 1 }; this.hotbar = ['canned', 'bottle', null, null, null, null];
    this.equipped = null; this.lefty = false; this.skills = {}; this.pets = []; this.dead = false;
    this.wear = {}; // ช่องสวมใส่: head body legs hands socks shoes back
  }
  get ch() { return this.auth?.ch || { skills: this.skills, stats: this.stats, profile: this.profile }; }
  maxHp() { return maxHpOf(this.ch); }
  maxStamina() { return maxStamOf(this.ch) - (this.social?.preg[this.id] ? 20 : 0) + Math.floor(20 * this.happyP()); }
  happyP() { return happyPower(this.ch, this.stats.happy ?? 50); }
  dmgMul() { return dmgMulOf(this.ch) * (this.stats.stress >= 85 ? 0.85 : 1) * (this.moraleT > 0 ? 1.1 : 1); }
  // ผู้ติดเชื้อมองเห็นได้ไกลแค่ไหน (1 = ปกติ)
  stealthMul() { return (this.hideT > 0 ? 0.1 : 1) * [1, 0.6, 0.35][this.stance] * (killPerk(this.ch, 1) ? 0.9 : 1) * (String(this.wear.body).split('~')[0] === 'hunter_cloak' ? 0.85 : 1); }
  setStance(v) {
    if (this.vehicle || this.player.climb || this.player.swim) v = 0;
    if (v === this.stance) return;
    this.stance = v;
    if (v) this.ui.toast(v === 1 ? '🧎 ย่อตัว — เดินช้าลง ผู้ติดเชื้อเห็นยากขึ้น (กด Ctrl อีกครั้งเพื่อคลาน)' : '🐛 คลาน — ช้ามาก แต่ผู้ติดเชื้อแทบมองไม่เห็น (กด Ctrl เพื่อลุกขึ้น)');
  }
  charLevel() { return Object.keys(this.skills).reduce((s, k) => s + skillLevel(this.skills[k]) - 1, 0) + 1; }
  gainXp(skill, n) {
    const before = skillLevel(this.skills[skill]);
    this.skills[skill] = (this.skills[skill] || 0) + n;
    const after = skillLevel(this.skills[skill]);
    if (after > before) this.sfx.play('level');
    if (after > before) this.ui.toast(`⭐ ทักษะ "${SKILLS[skill]}" เลื่อนเป็น Lv ${after}!`, 'level');
  }

  // ---------------- ไอเท็ม ----------------
  hasItem(k, q = 1) { return (this.inv[k] || 0) >= q; }
  addItem(k, q = 1) {
    if (!ITEMS[k] || q <= 0) return;
    this.inv[k] = (this.inv[k] || 0) + q;
    const it = ITEMS[k];
    if ((it.food || it.med || it.tool || it.place) && !this.hotbar.includes(k)) { const i = this.hotbar.indexOf(null); if (i >= 0) this.hotbar[i] = k; }
    this.ui?.toast(`+${q} ${it.icon} ${it.name}`, 'item');
    this.sfx?.play('pickup');
  }
  removeItem(k, q = 1) {
    this.inv[k] = (this.inv[k] || 0) - q;
    if (this.inv[k] <= 0) { delete this.inv[k]; if (this.equipped === k) this.equipped = null; }
  }
  // ---------------- เสื้อผ้าและกระเป๋า ----------------
  equip(k) { if (ITEMS[k]?.wear && this.hasItem(k)) this.auth.do('equip', { k }); }
  unequip(slot) {
    if (!this.wear[slot]) return;
    if (slot === 'back' && this.usedSlots() + 1 > BASE_SLOTS) this.ui.toast('⚠️ ถอดกระเป๋าแล้วของเกินช่อง — จะเดินช้าลงจนกว่าจะทิ้งหรือฝากของ', 'warn');
    this.auth.do('unequip', { slot });
  }
  maxSlots() { return BASE_SLOTS + wearStats(this.wear).carry + extraSlots(this.auth.ch); }
  usedSlots() { let n = 0; for (const [k, q] of Object.entries(this.inv)) if (q > 0 && !ITEMS[k]?.quest) n += Math.ceil(q / stackOf(k)); return n; }
  overloaded() { return this.usedSlots() > this.maxSlots(); }
  dropItem(k, q) { if (this.hasItem(k, q)) this.auth.do('drop', { k, q }); }

  pinHotbar(k) {
    const i = this.hotbar.indexOf(k);
    if (i >= 0) this.hotbar[i] = null;
    else { let j = this.hotbar.indexOf(null); if (j < 0) j = 5; this.hotbar[j] = k; }
  }

  // เรียกสัตว์เลี้ยงขึ้นมาอยู่บนที่สูงด้วยกัน (หลังคา หอสังเกตการณ์)
  callPetsUp() {
    const P = this.player.pos;
    if (P.y - heightAt(P.x, P.z) < 1.2) return this.ui.toast('ตอนนี้คุณอยู่บนพื้นอยู่แล้ว — ใช้คำสั่งนี้ตอนปีนขึ้นที่สูง', 'warn');
    const fol = this.ents.list.filter((e) => e.kind === 'pet' && !e.dead && !e.pet.stay && !e.pet.home && !(e.pet.down > 0));
    if (!fol.length) return this.ui.toast('ไม่มีสัตว์เลี้ยงที่เดินตามอยู่', 'warn');
    this.petsUp = true; for (const e of fol) e.pos.set(P.x, P.y, P.z);
    this.ui.toast(`⬆️ เรียก${fol.map((e) => e.pet.name).join(', ')}ขึ้นมาอยู่ด้วยกันแล้ว`);
  }
  // ลูกธนู/กระสุนบินไปข้างหน้า (แค่ภาพ)
  fireProjectile(dir, dist, ammo) {
    const small = ammo === 'pebble' || ammo === 'steel_ball', fire = ITEMS[ammo]?.ammo?.burn;
    const m = new THREE.Mesh(new THREE.BoxGeometry(small ? 0.08 : 0.04, small ? 0.08 : 0.04, small ? 0.08 : 0.55), new THREE.MeshBasicMaterial({ color: fire ? '#ff7b00' : small ? (ammo === 'steel_ball' ? '#495057' : '#8d8d8d') : ammo?.includes('iron') || ammo?.includes('steel') || ammo?.includes('heavy') ? '#adb5bd' : '#d4a373' }));
    const P = this.player.pos; m.position.set(P.x + dir.x * 0.6, P.y + 1.45, P.z + dir.z * 0.6); m.rotation.y = Math.atan2(dir.x, dir.z); this.scene.add(m);
    const t0 = performance.now(), dur = Math.min(400, dist * 18), from = m.position.clone();
    const step = () => { const k = (performance.now() - t0) / dur; if (k >= 1) return this.scene.remove(m); m.position.copy(from).addScaledVector(dir, dist * k); m.position.y -= k * k * 0.3; requestAnimationFrame(step); };
    requestAnimationFrame(step); this.sfx.play('swing');
  }
  // มือข้างถนัด: ถืออาวุธข้างที่ถนัดได้พลัง +15% ข้างไม่ถนัด -10%
  handMul() { const dom = this.profile.hand === 'l' ? 'l' : 'r', using = this.lefty ? 'l' : 'r'; return dom === using ? 1.15 : 0.9; }
  holdItem(k) { return this.auth.do('hold', { k: k || null }); }
  setLefty(v) { return this.auth.do('hands', { lefty: !!v }); }
  // 🌡️ อุณหภูมิร่างกาย + ความเปียก: ฝน/หิมะทำให้เปียกและหนาว · หลบในศาลา/บ้าน · ใกล้กองไฟ/เตาผิง · เสื้อกันหนาว ช่วยให้อุ่น
  tickBody(dt) {
    const s = this.stats, P = this.player.pos, W = this.weather;
    if (s.temp === undefined) s.temp = 37; if (s.wet === undefined) s.wet = 0;
    const sh = this.world.shelterAt(P.x, P.z, P.y), now = this.now();
    const hearth = (this.world.pavilions || []).find((p) => p.hearth && (p.lit || 0) > now && Math.hypot(p.x - P.x, p.z - P.z) < 7);
    const fire = this.nearFire || !!hearth, inside = !!sh || this.inCampNow;
    this.shelter = sh; this.hearthNear = hearth;
    // เปียก
    let dw = -1;
    if (this.player.swim) dw = 25; else if (!inside && !this.vehicle?.s?.vt?.includes?.('car') && W.rain) dw = 4; else if (!inside && W.snow) dw = 1.5;
    if (fire) dw -= 5; else if (inside) dw -= 1.5;
    s.wet = clamp(s.wet + dw * dt, 0, 100);
    // อุณหภูมิ
    const air = airTemp(W, this.isNight(), P.y), warm = wearStats(this.wear).warm + (inside && sh?.warm ? 0.3 : 0);
    const target = bodyTarget({ air, wet: s.wet, warm, fire, shelter: inside });
    s.temp = clamp(s.temp + (target - s.temp) * Math.min(1, dt * 0.01), 32, 40); // ค่อย ๆ เปลี่ยน ไม่หนาวเร็วเกินไป
    const was = this.tempState || 'ok', st = s.temp < 35 ? 'freeze' : s.temp < 36.2 ? 'cold' : s.temp > 38.6 ? 'hot' : 'ok';
    if (st !== was) { this.tempState = st; if (st === 'cold') this.ui.toast('🥶 ตัวเริ่มหนาว — หาที่หลบ ก่อไฟ หรือใส่เสื้อกันหนาว', 'warn'); else if (st === 'freeze') this.ui.toast('🧊 หนาวจัด! พลังชีวิตลดลง รีบหาความอบอุ่นด่วน', 'warn'); else if (st === 'hot') this.ui.toast('🥵 ร้อนเกินไป กระหายน้ำเร็วขึ้น หาที่ร่มหรือดื่มน้ำ', 'warn'); }
  }
  // 😊 ความสุขเพิ่มเองตามเวลาเล่น เมื่อร่างกายปกติเท่านั้น
  tickHappy(dt) {
    const s = this.stats;
    if (s.happy === undefined) s.happy = isFreelancer(this.ch) ? 60 : 50;
    const ok = !s.bleeding && !s.fracture && !(s.sprain > 0) && (this.tempState || 'ok') === 'ok' && s.infection < 1 && !(s.sick > 0) && s.hunger > 30 && s.thirst > 30 && (s.stress || 0) < 60 && !this.dead;
    this.happyOk = ok;
    if (!ok || s.happy >= 100) return;
    s.happyT = (s.happyT || 0) + dt;
    const every = isFreelancer(this.ch) ? HAPPY_EVERY_FREE : HAPPY_EVERY;
    if (s.happyT >= every) { s.happyT -= every; s.happy = Math.min(100, s.happy + 1); this.ui.toast(`😊 ความสุข +1 (${s.happy}) — ภูมิคุ้มกันและความกระฉับกระเฉงเพิ่มขึ้น`, 'level'); }
  }
  // ปุ่ม H / ปุ่มบนจอ: สลับอุปกรณ์ที่ถือระหว่างมือซ้าย–ขวา (มือถนัดได้พลัง +15%)
  swapHands() {
    const v = !this.lefty, dom = this.profile.hand === 'l';
    this.setLefty(v);
    this.ui.toast(`${v ? '🫲 ถือมือซ้าย' : '🫱 ถือมือขวา'}${v === dom ? ' (มือถนัด +15%)' : ' (ไม่ใช่มือถนัด)'}`);
  }
  useItem(k) {
    if (!this.hasItem(k) || this.dead) return;
    const it = ITEMS[k], s = this.stats;
    if (it.tool) return this.holdItem(this.equipped === k ? null : k);
    if (it.ammo || k === 'pebble') {
      // เลือกชนิดกระสุนที่จะยิง (คลิกซ้ำ = กลับไปใช้ระดับดีสุดอัตโนมัติ)
      const grp = it.ammo?.g || 'pebble', P = (this.ammoPref ||= {});
      P[grp] = P[grp] === k ? null : k; this.ui.refreshPanels();
      return this.ui.toast(P[grp] ? `🏹 เลือกยิง ${it.icon} ${it.name} (+${it.ammo?.dmg || 0} ดาเมจ)` : '🏹 ใช้กระสุนระดับดีสุดที่มีอัตโนมัติ');
    }
    if (it.wear) return this.equip(k);
    if (it.place) return this.place(k);
    if (it.petGear) {
      // คลิกอุปกรณ์สัตว์เลี้ยงในกระเป๋า: มีตัวเดียวใส่ให้เลย มีหลายตัวเปิดเมนูให้เลือก
      if (!this.pets.length) return this.ui.toast('ยังไม่มีสัตว์เลี้ยง — ป้อนอาหารสุนัข แมว หรือนกจรจัดให้เชื่องก่อน', 'warn');
      if (this.pets.length === 1) return equipPet(this, this.pets[0], k);
      this.ui.togglePanel('pets'); return this.ui.toast(`เลือกสัตว์ที่จะใส่ ${it.name} ในเมนู 🐾`);
    }
    if (it.food || it.instrument) return this.auth.do('use', { k });
    if (it.device) return this.ui.toast(`${it.icon} ${it.name} ทำงานอัตโนมัติเมื่ออยู่ในกระเป๋า — ดูบนแผนที่มุมขวาบน`);
    if (it.med) {
      const m = it.med;
      const needed = m.immune || (m.stopBleed && s.bleeding) || (m.fracture && s.fracture) || ((m.fracture || m.stopBleed) && s.sprain > 0) || (m.infection && s.infection > 0) || (m.cureSick && s.sick > 0) || (m.hp && s.hp < this.maxHp());
      if (!needed) return this.ui.toast('ตอนนี้ยังไม่จำเป็นต้องใช้');
      return this.auth.do('use', { k });
    }
  }
  // ผลของอาหาร/ยา (เซิร์ฟเวอร์ยืนยันว่ามีของจริงแล้ว)
  applyFx(fx) {
    const s = this.stats, it = ITEMS[fx.item];
    if (fx.food) {
      const f = fx.food;
      const cm = hasPerk(this.ch, 'chef', 0) ? 1.3 : 1; // เชฟ: อาหารได้ผลดีขึ้น
      s.hunger = clamp(s.hunger + (f.hunger || 0) * cm, 0, 100); s.thirst = clamp(s.thirst + (f.thirst || 0) * cm, 0, 100);
      s.hp = clamp(s.hp + (f.hp || 0) * cm, 0, this.maxHp()); if (f.infection) s.infection = clamp(s.infection + f.infection * cm, 0, 100);
      if (f.stress) s.stress = clamp((s.stress || 0) + f.stress * cm, 0, 100);
      if (f.stamina) s.stamina = clamp(s.stamina + f.stamina, 0, this.maxStamina());
      if (f.happy) s.happy = clamp((s.happy ?? 50) + f.happy, 0, 100);
      if (hasPerk(this.ch, 'chef', 2) && (f.hunger || 0) >= 30) { this.wellFed = 120; this.ui.toast('😋 อิ่มเอม! ฟื้นพลังชีวิตต่อเนื่อง 2 นาที'); }
      this.sfx.play((f.thirst || 0) > (f.hunger || 0) ? 'drink' : 'eat');
      if (f.sick && Math.random() < f.sick * (hasPerk(this.ch, 'chef', 0) ? 0.5 : 1)) { s.sick = 60; this.ui.toast('🤢 ท้องไส้ปั่นป่วน... อาหารเป็นพิษ! (กินยาสมุนไพรหรือรอให้หาย)', 'warn'); }
      else this.ui.toast(`กิน ${it.name} แล้ว`);
    }
    if (fx.fan) {
      // พัดสาน: ลดอุณหภูมิร่างกาย (ถ้าร้อน) และคลายร้อน
      const was = s.temp ?? 37; s.temp = Math.max(36.8, was - (was > 37.4 ? 0.9 : 0.3)); s.stress = Math.max(0, (s.stress || 0) - 2);
      this.ui.toast(was > 37.4 ? `🪭 โบกพัดคลายร้อน 🌡️ ${was.toFixed(1)} → ${s.temp.toFixed(1)}°C` : '🪭 โบกพัดเย็นสบาย');
    }
    if (fx.med) {
      const m = fx.med, medMul = (1 + (skillLevel(this.skills.medicine) - 1) * 0.1) * (hasPerk(this.ch, 'doctor', 0) ? 1.5 : 1);
      if (m.immune) { this.immuneT = m.immune; this.ui.toast(`💉 ภูมิคุ้มกัน: ไม่ติดเชื้อเพิ่ม ${m.immune / 60} นาที`, 'level'); }
      if (m.stopBleed) s.bleeding = false;
      if (m.fracture) s.fracture = false;
      if ((m.fracture || m.stopBleed) && s.sprain > 0) { s.sprain = 0; this.ui.toast('🦶 พันข้อเท้าแล้ว ขาแพลงหาย'); }
      if (m.infection) s.infection = clamp(s.infection + m.infection * medMul, 0, 100);
      if (m.cureSick) s.sick = 0;
      if (m.hp) s.hp = clamp(s.hp + m.hp * medMul, 0, this.maxHp());
      this.sfx.play('craft'); this.ui.toast(`ใช้ ${it.name} แล้ว`);
    }
    if (fx.music) this.playMusic();
    if (fx.chant) this.chant();
    if (fx.drone) { this.droneT = 60; this.sfx.play('radio'); this.ui.toast('🛸 ปล่อยโดรนแล้ว! เห็นผู้ติดเชื้อ กล่อง และสัตว์รอบตัวบนแผนที่ 60 วินาที', 'level'); }
    if (it?.morale) { this.moraleT = it.morale; this.ui.toast('💪 มีกำลังใจ! ดาเมจ +10% ฟื้นสตามิน่าไวขึ้น ไม่ค่อยตื่นตระหนก', 'level'); }
  }

  // ---------------- ผลลัพธ์จากระบบเศรษฐกิจ (ในเครื่อง หรือจากเซิร์ฟเวอร์) ----------------
  onEcon(r, c) {
    if (c) this.applyCharView(c);
    if (!r) return this.ui.refreshPanels();
    if (r.err) { if (!r.silent) this.ui.toast(r.err, 'warn'); return this.ui.refreshPanels(); }
    if (r.give) for (const [k, q] of Object.entries(r.give)) {
      const it = ITEMS[k]; if (!it || q <= 0) continue;
      if ((it.food || it.med || it.tool || it.place) && !this.hotbar.includes(k)) { const i = this.hotbar.indexOf(null); if (i >= 0) this.hotbar[i] = k; }
      if (!r.quietGive) { this.ui.toast(`+${q} ${it.icon} ${it.name}`, 'item'); this.sfx.play('pickup'); }
    }
    if (r.fx) this.applyFx(r.fx);
    if (r.res) {
      if (r.res.until) this.world.setResState(r.res.id, r.res.until - this.timeOffset);
      else if (r.res.hp !== undefined) { const R = this.world.resources[r.res.id]; this.hitInfo = { text: `${RES_TYPES[R.type].name} ${'▮'.repeat(Math.max(1, Math.ceil(r.res.hp)))}`, until: performance.now() + 900 }; }
    }
    if (r.raw && !this.hintedRaw) { this.hintedRaw = true; this.ui.toast('💡 ของที่เก็บด้วยมือเปล่าเป็นวัตถุดิบดิบ — เปิดเมนูประดิษฐ์ (Tab) เพื่อแปรรูปเป็นไม้/หิน/เส้นใยก่อนใช้ (หรือใช้ขวานตัดต้นไม้เพื่อได้ไม้เลย)'); }
    if (r.loot) { this.world.setLootState(r.loot.id, r.loot.until - this.timeOffset); this.sfx.play('loot'); }
    // เล่นผ่านลิงก์: แจ้งโฮสต์ให้ทุกคนเห็นว่ากล่อง/ทรัพยากรนี้ถูกใช้แล้ว
    if (this.auth.room) { if (r.loot) this.net.send({ t: 'loot', id: r.loot.id, until: r.loot.until }); if (r.res?.until) this.net.send({ t: 'res', id: r.res.id, until: r.res.until }); }
    if (r.tame && !r.pet) { const e = this.ents.list.find((x) => !x.dead && (x.netId === r.tame.id || x.uid === r.tame.id)); if (e) e.tame = r.tame.v; this.ui.toast(`${PET_TYPES[r.tame.k].name}กินอย่างเอร็ดอร่อย (เชื่อง ${r.tame.v}%)`); }
    if (r.pet) this.onNewPet(r.pet);
    if (r.giveBack) this.ui.toast(`ได้ ${ITEMS[r.giveBack].name} ตอบแทน`);
    if (r.fish) { this.sfx.play(r.fish === 'golden_fish' ? 'level' : 'splash'); this.ui.toast(r.fish === 'golden_fish' ? '🐡 ว้าว! ได้ปลาทองหายาก (ปล่อยลงบ่อเลี้ยงปลาเพื่อให้ปลาเพิ่มเร็วขึ้น)' : `🎣 ได้ ${ITEMS[r.fish].icon} ${ITEMS[r.fish].name}!`); }
    if (r.wore) setOutfit(this.player.mesh, this.wear, ITEMS);
    if (r.petsChanged) for (const p of this.pets) { p.hp = Math.min(p.hp, petStats(p).maxHp); this.ents.refreshPetGear(p); }
    if (r.held || r.wore || r.take) setHeldTool(this.player.mesh, this.equipped, this.lefty);
    if (r.sfx) this.sfx.play(r.sfx);
    if (r.msg) this.ui.toast(r.msg);
    if (r.boxOpen) { this.sfx.play('loot'); this.boxUI.slow = 1; }
    if (r.quest !== undefined || r.questMsg) this.quest.onStep(r.questMsg);
    if (r.kills) { const k = this.stats.kills; for (const [n, t] of KILL_PERKS) if (k === n) { this.sfx.play('quest'); this.ui.toast(`🏅 กำจัดผู้ติดเชื้อครบ ${n} ตัว! ปลดล็อก: ${t}`, 'level'); } }
    if (r.levelUp?.length) this.ui.toast(`🎯 เลเวลตัวละครขึ้น! มีแต้มสเตตัสว่าง ${freePts(this.ch)} แต้ม — กด I แล้วเลือกลงสายอาชีพ`, 'level');
    for (const [s, l] of r.levelUp || []) { this.sfx.play('level'); this.ui.toast(`⭐ ทักษะ "${SKILLS[s]}" เลื่อนเป็น Lv ${l}!`, 'level'); }
    this.ui.refreshPanels();
  }
  // สถานะตัวละครจริงจากเซิร์ฟเวอร์
  applyCharView(c) {
    const swap = (obj, src) => { for (const k of Object.keys(obj)) delete obj[k]; Object.assign(obj, src || {}); };
    swap(this.inv, c.inv); swap(this.skills, c.skills);
    const wearKey = JSON.stringify(this.wear); swap(this.wear, c.wear);
    if (JSON.stringify(this.wear) !== wearKey) setOutfit(this.player.mesh, this.wear, ITEMS);
    if (this.equipped !== c.equipped || !!this.lefty !== !!c.lefty) { this.equipped = c.equipped; this.lefty = !!c.lefty; setHeldTool(this.player.mesh, this.equipped, this.lefty); }
    if (c.quest) { if ((c.quest.route || 'classic') !== this.quest.route) this.quest.setRoute(c.quest.route || 'classic'); this.quest.step = c.quest.step; if (this.quest.done) this.world.openGate(this.quest.camp.key); }
    if (c.boxes) this.boxes = c.boxes;
    if (c.jp) this.jp = c.jp;
    if (c.trade) this.trade = c.trade;
    if ('sq' in c) this.sq = c.sq;
    if (c.kills !== undefined) this.stats.kills = c.kills;
    for (const sp of c.pets || []) {
      const p = this.pets.find((x) => x.id === sp.id);
      if (!p) { const np = ensurePet({ ...sp }); this.pets.push(np); this.ents.spawnPet(np); continue; }
      const gearChanged = JSON.stringify(p.gear) !== JSON.stringify(sp.gear);
      Object.assign(p, { gear: sp.gear, traits: sp.traits, rarity: sp.rarity, mul: sp.mul, name: sp.name, loyal: Math.max(p.loyal || 0, sp.loyal || 0) });
      if (gearChanged) this.ents.refreshPetGear(p);
    }
  }
  onNewPet(p) {
    if (!this.pets.includes(p) && !this.pets.some((x) => x.id === p.id)) this.pets.push(ensurePet(p));
    const pet = this.pets.find((x) => x.id === p.id);
    if (!this.ents.list.some((e) => e.kind === 'pet' && e.pet === pet && !e.dead)) this.ents.spawnPet(pet);
    const rar = { common: '', rare: ' ✨ หายาก', legend: ' 🌟 ระดับตำนาน!' }[pet.rarity];
    this.ui.toast(`🐾 ${PET_TYPES[pet.type].name}ตัวนี้ยอมเป็นสัตว์เลี้ยงของคุณแล้ว! ตั้งชื่อว่า "${pet.name}"${rar} — ดูความสามารถพิเศษที่เมนู 🐾`, 'love');
  }

  craft(i) {
    const r = RECIPES[i];
    if (skillLevel(this.skills[r.skill]) < r.lvl) return;
    if (r.station === 'fire' && !this.nearFire) return this.ui.toast('ต้องอยู่ใกล้กองไฟ', 'warn');
    for (const [k, q] of Object.entries(r.need)) if (!this.hasItem(k, q)) return;
    this.auth.do('craft', { i });
  }

  place(k) {
    const P = this.player.pos, a = this.player.ry, it = ITEMS[k];
    const x = P.x + Math.sin(a) * 2.8, z = P.z + Math.cos(a) * 2.8;
    const wet = waterAt(x, z) || heightAt(x, z) < 0.5;
    if (it.vt === 'raft' ? !waterAt(x, z) : wet) return this.ui.toast(it.vt === 'raft' ? 'ต้องวางแพในน้ำ (หันไปทางทะเลหรืออ่างเก็บน้ำ)' : 'วางในน้ำไม่ได้', 'warn');
    this.auth.do('place', { item: k, s: { type: it.place, x: +x.toFixed(2), z: +z.toFixed(2), ry: +a.toFixed(2) } });
    if (it.place === 'shelter') this.ui.toast('⛺ สร้างเพิงพักแล้ว — ที่นี่จะเป็นจุดเกิดใหม่ของคุณ');
  }
  placeStructure(s) { this.auth.do('place', { s }); }
  demolishStructure(s) { this.home.demolish(s); }
  sleepToMorning() {
    const s = this.stats, tod = this.timeOfDay(), skip = ((1.27 - tod) % 1) * DAY_MS; this.startTime -= skip;
    s.hunger = Math.max(5, s.hunger - 15); s.thirst = Math.max(5, s.thirst - 20); s.hp = Math.min(this.maxHp(), s.hp + 30); s.stress = Math.max(0, (s.stress || 0) - 50);
    for (const e of this.ents.list) if (e.kind === 'zombie') this.ents.remove(e);
    this.ui.toast('😴 คุณหลับยาวจนถึงเช้า...');
  }

  // ---------------- ความเสียหาย ----------------
  hurt(dmg, o = {}) {
    if (this.dead || this.safeTime > 0 || this.inCampNow) return;
    this.sfx.play('hurt');
    const s = this.stats, ws = wearStats(this.wear);
    if (ws.block && Math.random() < ws.block) {
      // โล่กันไว้ได้: เจ็บนิดเดียว ไม่เลือดออก ไม่ติดเชื้อ
      s.hp -= dmg * 0.25; this.sfx.play('stone'); this.blockT = 0.3; this.ui.toast('🛡️ ยกโล่กันไว้ได้!');
      if (s.hp <= 0) this.die(`ถูก${o.src || 'บาดเจ็บ'}ทำร้ายจนเสียชีวิต`);
      return;
    }
    s.hp -= dmg * (1 - ws.def) * (petNearbyWith(this, 'guardian') ? 0.85 : 1);
    this.stopRest();
    this.ui.flashHurt();
    if (o.bleed && !s.bleeding && Math.random() < o.bleed) { s.bleeding = true; this.ui.toast('🩸 คุณเลือดออก! ใช้ผ้าพันแผลด่วน', 'warn'); }
    s.stress = Math.min(100, (s.stress || 0) + 3);
    if (this.immuneT > 0) o = { ...o, infect: 0 };
    if (o.infect && Math.random() < o.infect * (1 - ws.bite) * (killPerk(this.ch, 2) ? 0.85 : 1) * (1 - 0.35 * this.happyP())) { // ความสุข = ภูมิคุ้มกัน
      if (s.infection < 1) this.ui.toast('🦠 คุณถูกกัด... เชื้อเริ่มเข้าสู่ร่างกาย! หายาปฏิชีวนะหรือทำยาสมุนไพร', 'warn');
      s.infection = Math.max(s.infection, 5) + 5;
    }
    this.lastCause = o.src || 'บาดเจ็บ';
    if (s.hp <= 0) this.die(`ถูก${this.lastCause}ทำร้ายจนเสียชีวิต`);
  }
  die(cause) {
    if (this.dead) return;
    if (this.vehicle) this.home.dismount();
    this.fishing.cancel();
    this.dead = true; this.stats.hp = 0; this.sfx.play('death');
    this.auth.do('died');
    this.ui.showDeath(`${cause} · รอดชีวิตมาได้ถึงวันที่ ${this.dayNum()}`);
  }
  respawn() {
    const s = this.stats; this.dead = false;
    if (this.auth.server) this.net.send({ t: 'respawn' });
    Object.assign(s, { hp: this.maxHp() * 0.6, hunger: 60, thirst: 60, stamina: 60, infection: 0, bleeding: false, fracture: false, sprain: 0, sick: 0 });
    this.player.pos.set(this.spawnPoint.x, this.spawnPoint.y ?? heightAt(this.spawnPoint.x, this.spawnPoint.z) + 0.5, this.spawnPoint.z); this.player.vy = 0; this.player.climb = null;
    this.safeTime = 10; this.ui.hideDeath();
    for (const e of this.ents.list) if (e.kind === 'zombie' && e.pos.distanceTo(this.player.pos) < 40) this.ents.remove(e);
  }

  // ---------------- การโต้ตอบ ----------------
  facingPoint(d = 1.8) { const a = this.player.ry, P = this.player.pos; return { x: P.x + Math.sin(a) * d, z: P.z + Math.cos(a) * d }; }

  findTarget() {
    const P = this.player.pos;
    if (this.fishing.active) return { type: 'fish', text: this.fishing.prompt() };
    if (this.vehicle) { const h = this.home.target(); return { type: 'home', h, text: h.text }; }
    const q = this.quest.prompt();
    if (q) return { type: 'quest', q, text: `📜 ${q.text}` };
    if (this.player.climb) return { type: 'none', text: this.player.climb.dir === 'up' ? '🧗 กำลังปีน... (ถอยหลังเพื่อปล่อยมือ)' : '🧗 กำลังไต่ลง...' };
    const hs = this.home.target();
    if (hs) return { type: 'home', h: hs, text: hs.text };
    if (this.wall && !this.player.swim) return { type: 'climb', text: `🧗 ปีนขึ้นที่สูง ${this.touch ? '(⤒)' : '(Space)'}` };
    const e0 = this.ents.nearestInteractable(P, 3), e = e0 && e0.kind === 'pet' ? null : e0; // สัตว์เลี้ยงสำคัญน้อยสุด
    if (e) {
      if (e.kind === 'stray') return { type: 'stray', e, text: `ป้อนอาหาร${PET_TYPES[e.type].name} (${e.tame}%)` };
      if (e.kind === 'pet') return PET_TYPES[e.type]?.ride ? { type: 'ride', e, text: `🐃 ขี่${e.pet.name}` } : { type: 'pet', e, text: `ลูบหัว ${e.pet.name}` };
      if (e.kind === 'child') return { type: 'child', e, text: `กอด ${e.name}` };
      return { type: 'person', e, text: `คุยกับ ${e.name}` };
    }
    const bx = this.boxUI.prompt(P); if (bx) return bx;
    const l = this.world.nearLoot(P.x, P.z, 3.6).filter((x) => x.kind === 'car' || (Math.hypot(x.x - P.x, x.z - P.z) < 2.6 && (x.y === undefined || Math.abs(P.y - x.y) < 2.2)))[0]; // กล่องบนหลังคาต้องขึ้นไปค้น // รถคันยาว ค้นได้จากรอบคัน
    const sc = !l && this.world.nearSearchedCar(P.x, P.z, 3.6);
    if (sc) {
      // รถที่ค้นไปแล้ว: ซ่อมให้ขับได้ (ถ้ามีวัสดุ)
      const has = (C) => Object.entries(C).every(([k, q]) => this.hasItem(k, q)), gas = repairCost(this.ch, false), ev = repairCost(this.ch, true), useEv = has(ev) && !has(gas), C = useEv ? ev : gas, ok = has(C);
      return { type: 'quest', q: { act: () => (has(ev) && has(gas) ? this.ui.confirm('มีชิ้นส่วนครบทั้ง 2 แบบ — ประกอบเป็น ⚡ รถ EV ไหม? (กด "ไม่" = รถน้ำมัน)', (yes) => this.auth.do('repaircar', { id: sc.id, ev: yes })) : this.auth.do('repaircar', { id: sc.id, ev: useEv })) }, text: `${has(ev) && has(gas) ? '🔧⚡ ซ่อมรถ (เลือกได้: น้ำมัน หรือ EV)' : useEv ? '⚡ ประกอบเป็นรถ EV' : '🔧 ซ่อมเป็นรถน้ำมัน'} (${Object.entries(C).map(([k, q]) => `${ITEMS[k].icon}${this.inv[k] || 0}/${q}`).join(' ')})${ok ? '' : ' — ของไม่ครบ (หรือใช้ชุด EV: ล้อ มอเตอร์ไฟฟ้า พวงมาลัย แบต EV)'}` };
    }
    if (l) return { type: 'loot', l, text: l.kind === 'bike' ? (l.broken ? `🔧 ซ่อมจักรยานพัง (🔩${this.inv.scrap || 0}/2 🧻${this.inv.rag || 0}/1)` : '🚲 เก็บจักรยาน (ขี่ได้เลย)') : l.kind === 'car' ? '🚗 ค้นรถร้าง (ค้นแล้วซ่อมให้ขับได้)' : l.y !== undefined ? '🟫 ค้นกล่องเสบียงบนหลังคา' : '🟫 ค้นกล่องเสบียง (ค้นได้เลย)' };
    const sh = this.world.nearStructure(P.x, P.z, 'shelter', 3);
    if (sh) return { type: 'shelter', s: sh, text: this.isNight() && !this.net.online ? 'นอนหลับถึงเช้า' : 'พักผ่อน (ตั้งจุดเกิด)' };
    if (ITEMS[this.equipped]?.tool?.rod && this.fishing.spot()) return { type: 'cast', text: '🎣 เหวี่ยงเบ็ดตกปลา' };
    const f = this.facingPoint(1.6);
    const w = waterAt(f.x, f.z) || waterAt(P.x, P.z);
    if (w) return { type: 'water', w, text: w.fresh ? (this.hasItem('bottle') ? 'ตักน้ำใส่ขวด (น้ำดิบ)' : 'ดื่มน้ำจากอ่าง (เสี่ยง)') : ITEMS[this.equipped]?.tool?.fish ? 'แทงปลา' : 'น้ำทะเลดื่มไม่ได้' };
    const r = this.world.nearRes(P.x, P.z, 2.2).find((o) => ['bush', 'herb', 'grass', 'pebble', 'twig'].includes(o.type));
    if (r) return { type: 'res', r, text: `เก็บ${RES_TYPES[r.type].name}` };
    if (e0?.kind === 'pet') return PET_TYPES[e0.type]?.ride && !(e0.pet.down > 0) ? { type: 'ride', e: e0, text: `🐃 ขี่${e0.pet.name} (ลูบหัวด้วย)` } : { type: 'pet', e: e0, text: `ลูบหัว ${e0.pet.name}` };
    const hp = (this.world.pavilions || []).find((p) => p.hearth && Math.hypot(p.x + p.w / 2 - 0.9 - P.x, p.z - P.z) < 2.4);
    if (hp) { const left = (hp.lit || 0) - this.now(); return left > 0 ? { type: 'none', text: `🔥 เตาผิงกำลังลุก (อีก ${Math.floor(Math.ceil(left / 60000) / 60) ? Math.floor(Math.ceil(left / 60000) / 60) + ' ชม. ' : ''}${Math.ceil(left / 60000) % 60} นาที) — อุ่น ตากตัวให้แห้ง ซอมบี้/สัตว์ร้ายไม่กล้าเข้าใกล้` } : { type: 'hearth', p: hp, text: `🔥 ก่อไฟในเตาผิง ลุก 24 ชม. (ไม้ ${this.inv.wood || 0}/2)` }; }
    const dm = this.myPiece(); if (dm) return { type: 'demo', text: `${PIECES[dm.type].icon} ${PIECES[dm.type].name} · ${this.touch ? 'แตะ ✋' : 'กด E หรือ <kbd>X</kbd>'} = 🗑️ รื้อชิ้นนี้ (ได้วัสดุคืนครบ)` };
    if (this.weather.rain) return { type: 'rain', text: this.hasItem('bottle') ? 'รองน้ำฝนใส่ขวด' : 'ดื่มน้ำฝน' };
    return null;
  }
  // ธีมเกม: เปลี่ยนได้เฉพาะ ⭐ เจ้าของเซิร์ฟเวอร์ ด้วยคำสั่งแชท /theme (ไม่มีปุ่มในเกม)
  // นอนบนเตียง: ตัวละครนอนราบ ม่านมืดลง มี 💤 ลอย · ขยับตัวเพื่อลุก
  startSleep(bed, done) {
    this.sleeping = { ...bed, t: 0, done, back: { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z } };
    this.ui.toast('😴 ขึ้นนอนบนเตียง... (กดเดินเพื่อลุก)');
    if (!this.zzz) { this.zzz = makeLabel('💤 Zzz', '#caf0f8'); this.zzz.scale.set(1.6, 0.4, 1); this.scene.add(this.zzz); }
  }
  updateSleep(dt, moving) {
    const S = this.sleeping, fade = document.getElementById('sleep-fade');
    if (!S) { if (this.zzz) this.zzz.visible = false; if (fade) fade.style.opacity = 0; return false; }
    S.t += dt; const p = this.player;
    p.pos.set(S.x, S.y, S.z); p.ry = S.ry; p.vy = 0; p.speedNow = 0;
    sleepPose(p.mesh); p.mesh.rotation.y = S.ry;
    this.zzz.visible = true; this.zzz.position.set(S.x, S.y + 1.3 + Math.sin(S.t * 2) * 0.15, S.z);
    if (fade) fade.style.opacity = Math.min(0.75, S.t / 2.5);
    if (S.t > 3 && !S.fired) { S.fired = true; S.done?.(); }
    if ((moving && S.t > 0.6) || S.t > 7) { this.sleeping = null; p.pos.set(S.x + Math.sin(S.ry) * 1.4, S.y, S.z + Math.cos(S.ry) * 1.4); p.mesh.userData.inner.rotation.x = 0; p.mesh.userData.inner.position.y = 0; }
    return true;
  }
  // 🧘 นั่ง/นอนพัก (ปุ่ม Z) — ทำได้เฉพาะที่ปลอดภัย: ในฐาน ศาลา/บ้าน ข้างกองไฟ ค่ายผู้รอดชีวิต และไม่มีผู้ติดเชื้ออยู่ใกล้
  // ค่าบวกเพิ่ม (พลังชีวิต สตามิน่า ความสุข) · ค่าลบลด (ความเครียด ความเปียก ขาแพลง) · นอนพักได้ผลมากกว่านั่ง
  restSpot() {
    const P = this.player.pos, now = this.now();
    if (this.ents.list.some((e) => e.kind === 'zombie' && !e.dead && Math.hypot(e.pos.x - P.x, e.pos.z - P.z) < 18)) return null;
    if (this.inCampNow) return 'ค่ายผู้รอดชีวิต';
    if (safeBaseAt(this.ents.baseList(), P.x, P.z, now)) return 'ฐานของคุณ';
    if (this.shelter) return 'ที่หลบภัย';
    if (this.nearFire || this.hearthNear) return 'ข้างกองไฟ';
    return null;
  }
  toggleRest() {
    if (this.dead || this.vehicle || this.sleeping || this.player.swim) return;
    const R = this.resting;
    if (R?.mode === 'lie') return this.stopRest();
    const where = this.restSpot();
    if (!where) return this.ui.toast('⚠️ พักได้เฉพาะที่ปลอดภัย: ในฐาน ศาลา/บ้าน ข้างกองไฟ หรือค่ายผู้รอดชีวิต (และต้องไม่มีผู้ติดเชื้ออยู่ใกล้)', 'warn');
    this.resting = { mode: R ? 'lie' : 'sit', t: 0, ht: R?.ht || 0, x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z };
    this.ui.toast(R ? `😌 นอนพักที่${where} — ฟื้นตัวเร็วขึ้น (กด Z อีกครั้งหรือเดินเพื่อลุก)` : `🧘 นั่งพักที่${where} — ฟื้นพลัง ลดความเครียด (กด Z อีกครั้งเพื่อนอนพัก)`);
  }
  stopRest(msg) {
    if (!this.resting) return; this.resting = null;
    const u = this.player.mesh.userData; u.inner.rotation.x = 0; u.inner.position.y = 0;
    if (msg) this.ui.toast(msg, 'warn');
  }
  updateRest(dt, moving) {
    const R = this.resting; if (!R) return false;
    if (moving || this.dead) { this.stopRest(); return false; }
    R.t += dt; R.chk = (R.chk || 0) - dt;
    if (R.chk <= 0) { R.chk = 1; if (!this.restSpot()) { this.stopRest('🧟 ไม่ปลอดภัยแล้ว! ลุกขึ้นจากการพัก'); return false; } }
    const p = this.player, s = this.stats, lie = R.mode === 'lie', k = lie ? 1.8 : 1;
    p.pos.set(R.x, R.y, R.z); p.vy = 0; p.speedNow = 0;
    if (lie) sleepPose(p.mesh); else sitPose(p.mesh);
    // ค่าบวก ↑
    s.stamina = Math.min(this.maxStamina(), s.stamina + 9 * k * dt);
    if (!s.bleeding && s.infection < 50) s.hp = Math.min(this.maxHp(), s.hp + 0.45 * k * dt);
    // ค่าลบ ↓
    s.stress = Math.max(0, (s.stress || 0) - 1.2 * k * dt);
    s.wet = Math.max(0, (s.wet || 0) - 0.8 * k * dt);
    if (s.sprain > 0) s.sprain = Math.max(0, s.sprain - 1.5 * k * dt); // ขาแพลงหายเร็วขึ้น
    if (s.sick > 0) s.sick = Math.max(0, s.sick - 0.05 * k * dt);
    // ความสุข +1 ทุก 90 วิ (นั่ง) / 50 วิ (นอน)
    R.ht += dt; const every = lie ? 50 : 90;
    if (R.ht >= every && (s.happy ?? 50) < 100) { R.ht -= every; s.happy = Math.min(100, (s.happy ?? 50) + 1); this.ui.toast(`😊 พักผ่อนสบายใจ ความสุข +1 (${s.happy})`, 'level'); }
    return true;
  }
  // เตาผิงในศาลา (เวลาเป็นเวลาเซิร์ฟเวอร์) · mine = จุดเองในโหมดลิงก์ ต้องแจ้งโฮสต์
  setHearth(i, until, mine = false) {
    const p = this.world.pavilions?.[i]; if (!p) return; p.lit = until; this.ents._fireT = 0;
    if (mine && this.auth.room) this.net.send({ t: 'hearth', i, until });
  }
  // 🐃 ขี่ควายเลี้ยง: วิ่งเร็วโดยไม่เสียสตามิน่า · กด E อีกครั้ง/ลงน้ำ/ขึ้นรถ = ลง
  mountPet(e) {
    if (this.mount) return this.dismount();
    if (this.vehicle || this.dead || this.player.swim) return;
    this.stopRest(); this.mount = e; e.mounted = true; e.pet.loyal = Math.min(100, e.pet.loyal + 1);
    this.ui.toast(`🐃 ขึ้นขี่${e.pet.name}แล้ว — เดินเร็วขึ้น ไม่เหนื่อย (กด E เพื่อลง)`);
  }
  dismount(msg) {
    const e = this.mount; if (!e) return; this.mount = null; e.mounted = false;
    const u = this.player.mesh.userData; u.inner.position.y = 0; u.inner.rotation.x = 0;
    e.pos.x += 1.2; this.ui.toast(msg || `ลงจากหลัง${e.pet.name}แล้ว`);
  }
  // ลูกศรนำทาง 3 มิติ: ลอยเหนือหัว หมุนชี้ไปยังเป้าหมายภารกิจ (เปิดโดยแตะกล่องภารกิจ)
  navTarget() { return this.sq?.type === 'visit' ? { x: this.sq.x, z: this.sq.z, name: this.sq.name } : this.quest.target(); }
  updateNav(dt) {
    const t = this.navOn && !this.dead ? this.navTarget() : null;
    if (!this.navArrow) {
      const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: '#ffd60a', depthTest: false, transparent: true, opacity: 0.95 });
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 4), m); head.rotation.x = Math.PI / 2; head.position.z = 0.55;
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.6), m);
      g.add(head, tail); g.renderOrder = 20; g.children.forEach((c) => (c.renderOrder = 20)); this.scene.add(g); this.navArrow = g;
    }
    const A = this.navArrow; A.visible = !!t; if (!t) return;
    const P = this.player.pos; this.navT = (this.navT || 0) + dt;
    A.position.set(P.x, P.y + 2.6 + Math.sin(this.navT * 3) * 0.08, P.z);
    A.rotation.y = Math.atan2(t.x - P.x, t.z - P.z);
    const d = Math.hypot(t.x - P.x, t.z - P.z); A.children.forEach((c) => c.material.color.set(d < 6 ? '#52b788' : '#ffd60a'));
  }
  // ชิ้นส่วนบ้าน/รั้วของเราที่หันหน้าเข้าหา (รื้อได้ทันทีด้วย X ไม่ต้องเข้าโหมดรื้อ)
  myPiece() {
    const P = this.player.pos, f = this.facingPoint(1.4);
    return this.world.nearestStructure(f.x, f.z, 1.9, (s) => PIECES[s.type] && s.type !== 'vehicle' && (!s.owner || s.owner === this.id) && Math.abs(baseY(s) - P.y) < 3.2);
  }
  quickDemolish() {
    const s = this.myPiece(); if (!s) return false;
    this.ui.confirm(`รื้อ ${PIECES[s.type].icon} ${PIECES[s.type].name} ชิ้นนี้? (ได้วัสดุคืนครบ)`, (yes) => { if (yes) this.demolishStructure(s); });
    return true;
  }

  interact() {
    if (this.dead) return;
    const t = this.findTarget(); if (!t) return;
    if (t.type === 'demo') return this.quickDemolish();
    if (t.type === 'hearth') { const r = this.auth.do('hearth', { i: this.world.pavilions.indexOf(t.p) }); if (r?.hearth) this.setHearth(r.hearth.i, r.hearth.until, true); if (this.auth.server ? this.hasItem('wood', 2) : r && !r.err) this.sfx.play('place'); return; }
    const s = this.stats;
    switch (t.type) {
      case 'quest': return t.q.act();
      case 'fish': return this.fishing.reel();
      case 'cast': return this.fishing.cast();
      case 'home': return t.h.act();
      case 'climb': return this.startClimb();
      case 'none': return;
      case 'person': this.quest.onMeet(t.e.id); return this.ui.openPerson(t.e);
      case 'child': this.stats.stamina = this.maxStamina(); return this.ui.toast(`${t.e.name} ยิ้มให้คุณ 💕 (สตามิน่าเต็ม)`);
      case 'pet': t.e.pet.loyal = Math.min(100, t.e.pet.loyal + 1); this.sfx.play({ dog: 'bark', cat: 'meow', bird: 'chirp' }[t.e.type]); return this.ui.toast(`${t.e.pet.name} ดีใจกระดิกหาง`);
      case 'ride': return this.mountPet(t.e);
      case 'stray': return this.tameStray(t.e);
      case 'loot': {
        return this.auth.do('loot', { id: t.l.id });
      }
      case 'shelter':
        this.spawnPoint = { x: t.s.x, z: t.s.z }; s.stamina = this.maxStamina();
        if (this.isNight() && !this.net.online) return this.sleepToMorning();
        return this.ui.toast('พักผ่อนแล้ว — ตั้งจุดเกิดใหม่ที่เพิงนี้');
      case 'water':
        if (!t.w.fresh) {
          if (ITEMS[this.equipped]?.tool?.fish) return this.auth.do('spearfish');
          return this.ui.toast('น้ำทะเลเค็ม ดื่มแล้วจะยิ่งกระหาย — หาอ่างเก็บน้ำหรือมะพร้าว', 'warn');
        }
        if (this.hasItem('bottle')) this.auth.do('fill', { kind: 'fresh' });
        else { s.thirst = clamp(s.thirst + 15, 0, 100); if (Math.random() < 0.35) { s.sick = 60; this.ui.toast('🤢 น้ำไม่สะอาด ท้องเสีย!', 'warn'); } }
        return;
      case 'res': {
        this.sfx.play('pickup'); return this.auth.do('hit', { id: t.r.id, hand: true });
      }
      case 'rain':
        if (this.hasItem('bottle')) this.auth.do('fill', { kind: 'rain' }); else s.thirst = clamp(s.thirst + 8, 0, 100);
        return;
    }
  }

  tameStray(e) {
    const foods = PET_TYPES[e.type].foods; const f = foods.find((x) => this.hasItem(x));
    if (!f) return this.ui.toast(`${PET_TYPES[e.type].name}อยากกิน: ${foods.map((x) => ITEMS[x].name).join(' / ')}`, 'warn');
    this.sfx.play({ dog: 'bark', cat: 'meow', bird: 'chirp' }[e.type]);
    this.auth.do('tame', { id: e.netId ?? e.uid });
  }
  feedPet(i) {
    const p = this.pets[i]; if (!PET_TYPES[p.type].foods.some((x) => this.hasItem(x))) return this.ui.toast('ไม่มีอาหารที่มันกิน', 'warn');
    this.auth.do('petfeed', { id: p.id });
  }
  petDied(p) { this.pets = this.pets.filter((x) => x !== p); this.ui.toast(`💔 ${p.name} ถูกผู้ติดเชื้อฆ่าตาย...`, 'warn'); }
  childLeader(c) {
    const other = c.parents.find((x) => x !== this.id);
    const r = other && this.ents.remotes.get(other);
    if (r && r.sex === 'f' && this.profile.sex !== 'f') return r;
    return null;
  }

  // tool = ใช้เครื่องมือ (ได้วัตถุดิบพร้อมใช้) · มือเปล่า = ได้วัตถุดิบดิบที่ต้องแปรรูปก่อน
  // ตี/เก็บทรัพยากร: ผลจริง (ได้อะไร เท่าไร) ตัดสินโดยระบบเศรษฐกิจ
  harvest(r, hand = false) {
    this.sfx.play(r.type === 'rock' ? 'stone' : r.type === 'tree' || r.type === 'palm' || r.type === 'orange_tree' || r.type === 'durian_tree' || r.type === 'bamboo' ? 'chop' : 'pickup');
    this.auth.do('hit', { id: r.id, hand });
  }

  attack() {
    if (this.dead || this.atkCd > 0) return;
    if (this.builder.active) { this.atkCd = 0.3; return this.builder.confirm(); }
    if (this.vehicle) return;
    if (ITEMS[this.equipped]?.tool?.rod) {
      this.atkCd = 0.4;
      if (this.fishing.active) return this.fishing.reel();
      if (this.fishing.spot()) return this.fishing.cast();
    }
    const s = this.stats; if (s.stamina < 5) return;
    const tool = this.equipped && ITEMS[this.equipped].tool;
    this.atkCd = 0.55; this.atkT = 1; s.stamina -= 5; this.sfx.play('swing');
    this.player.ry = this.camYaw + Math.PI;
    const dir = new THREE.Vector3(Math.sin(this.player.ry), 0, Math.cos(this.player.ry));
    // อาวุธยิงไกล: ยิงเป้าที่อยู่ในแนวเล็งใกล้สุด ใช้กระสุน 1 นัด
    if (tool?.ranged) {
      const ammo = pickAmmo(this.inv, tool.ammo, this.ammoPref?.[tool.ammo]);
      if (!ammo) return this.ui.toast(`ไม่มี${ITEMS[tool.ammo].icon} ${ITEMS[tool.ammo].name} — ประดิษฐ์ในแท็บกระเป๋า`, 'warn');
      this.auth.do('shoot', { ammo }); this.atkCd = 0.7;
      const adm = tool.dmg + ammoDmg(ammo);
      let best = null, bd = tool.range;
      for (const e of this.ents.list) { if (e.dead || !(e.kind === 'zombie' || e.kind === 'animal')) continue; const v = e.pos.clone().sub(this.player.pos); v.y = 0; const d = v.length(); if (d < bd && v.normalize().dot(dir) > 0.93) { bd = d; best = e; } }
      this.fireProjectile(dir, best ? bd : tool.range, ammo);
      if (best) { setTimeout(() => { if (!best.dead) { this.ents.damage(best, adm * this.dmgMul() * this.handMul(), this.player.pos, null, true); this.sfx.play('hit'); } }, Math.min(400, bd * 18)); }
      return;
    }
    // แห: ทอดลงน้ำตรงหน้าเพื่อหาปลา
    if (tool?.net) {
      const P = this.player.pos; let spot = null;
      for (let d = 2; d <= 5 && !spot; d += 0.5) { const x = P.x + dir.x * d, z = P.z + dir.z * d; if (waterAt(x, z)) spot = { x: +x.toFixed(2), z: +z.toFixed(2) }; }
      if (!spot) return this.ui.toast('🕸️ หันหน้าไปทางน้ำ (ทะเล/อ่างเก็บน้ำ/บ่อ) แล้วทอดแห', 'warn');
      this.sfx.play('splash'); return this.auth.do('castnet', spot);
    }
    const dmg = (tool ? tool.dmg : 6) * this.dmgMul() * this.handMul();
    const hit = this.ents.hitInFront(this.player.pos, dir, meleeReach(tool), dmg);
    if (hit) { this.sfx.play('hit'); return; }
    const f = this.facingPoint(1.3);
    const r = this.world.nearRes(f.x, f.z, 2.0)[0];
    if (r) {
      this.harvest(r, !tool);
    } else if (ITEMS[this.equipped]?.tool?.fish && waterAt(f.x, f.z)) this.interact();
  }

  // แชท: ช่อง all/party/family/pm · คำสั่งลัด /p ปาร์ตี้ · /f ครอบครัว · /w ชื่อ ข้อความ = กระซิบ
  sendChat(text) {
    let ch = this.chatCh || 'all', to = this.chatTo || null, m;
    if ((m = text.match(/^\/(p|party)\s+(.+)/i))) { ch = 'party'; text = m[2]; }
    else if ((m = text.match(/^\/(f|fam|family)\s+(.+)/i))) { ch = 'family'; text = m[2]; }
    else if ((m = text.match(/^\/(w|pm|msg)\s+(\S+)\s+(.+)/i))) { ch = 'pm'; to = m[2]; text = m[3]; }
    else if ((m = text.match(/^\/(a|all)\s+(.+)/i))) { ch = 'all'; text = m[2]; }
    if (ch === 'pm' && !to) return this.ui.toast('กระซิบ: พิมพ์ /w ชื่อผู้เล่น ข้อความ', 'warn');
    if (this.net.online) this.net.send({ t: 'chat', text, ch, to });
    else this.ui.chat(this.profile.name, text, false, ch);
  }

  // ---------------- input ----------------
  initInput() {
    const cv = this.renderer.domElement;
    cv.tabIndex = 0;
    cv.addEventListener('click', () => { window.focus(); cv.focus(); if (!this.ui.open && !this.dead && !this.touch) { try { cv.requestPointerLock?.()?.catch?.(() => {}); } catch { /* ไม่รองรับ pointer lock */ } } });
    addEventListener('mousedown', (e) => { if (document.pointerLockElement === cv && e.button === 0) this.attack(); });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== cv) return;
      this.camYaw -= e.movementX * 0.0035; this.camPitch = clamp(this.camPitch + e.movementY * 0.003, -0.5, 1.2);
    });
    addEventListener('wheel', (e) => { if (!this.ui.open) this.camDist = clamp(this.camDist + Math.sign(e.deltaY) * 0.8, 2.5, 18); });
    addEventListener('keydown', (e) => {
      if (this.ui.chatting) return;
      // ใช้ e.code เพื่อให้ปุ่มลัดทำงานแม้แป้นพิมพ์เป็นภาษาไทย
      const k = e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.code.startsWith('Digit') ? e.code.slice(5) : e.key.toLowerCase();
      if (k === 'tab') { e.preventDefault(); this.ui.togglePanel('inv'); return; }
      if (k === 'escape') { if (this.builder.active) this.builder.stop(); this.ui.closeAll(); return; }
      if (k === 'b' && !e.repeat) { if (this.builder.active) { this.builder.stop(); return; } return this.ui.togglePanel('build'); }
      if (k === 'q' && !e.repeat && this.builder.type) return this.builder.rotateNext();
      if (k === 'x' && !e.repeat) { if (this.builder.demolish) this.builder.stop(); else if (!this.builder.active && !this.ui.open && this.quickDemolish()) return; else if (canBuild(this.inv)) this.builder.startDemolish(); return; }
      if (k === 'l' && !e.repeat && !this.ui.open) return this.home.toggleLock();
      if (k === 'enter') { this.ui.chatting = true; document.exitPointerLock?.(); document.getElementById('chat-input').focus(); e.preventDefault(); return; }
      if (k === 'r' && !e.repeat) return this.ui.togglePanel('rel');
      if (k === 'k' && !e.repeat) return this.ui.togglePanel('char');
      if (k === 'g' && !e.repeat && !this.ui.open) return this.callPetsUp();
      if (k === 'h' && !e.repeat && !this.ui.open) return this.swapHands();
      if (k === 'z' && !e.repeat && !this.ui.open) return this.toggleRest();
      if (k === 'control' && !e.repeat && !this.ui.open) { e.preventDefault(); return this.setStance((this.stance + 1) % 3); }
      if (k === 'i' && !e.repeat) return this.ui.togglePanel('equip');
      if (k === 'p' && !e.repeat) return this.ui.togglePanel('pets');
      if (k === 'm' && !e.repeat) return this.ui.togglePanel('map');
      if (k === 'c' && !e.repeat) return this.ui.togglePanel('inv');
      if (k === 'e' && !e.repeat && !this.ui.open) return this.interact();
      if (k === 'f' && !e.repeat && !this.ui.open) return this.attack();
      if (/^[1-6]$/.test(k)) { const it = this.hotbar[+k - 1]; if (it) this.useItem(it); return; }
      this.keys[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    document.getElementById('hotbar').addEventListener('click', (e) => { const s = e.target.closest('[data-slot]'); if (s) { const it = this.hotbar[+s.dataset.slot]; if (it) this.useItem(it); } });
  }

  // ---------------- network ----------------
  initNet() {
    this.net.on((m) => {
      switch (m.t) {
        case 'welcome':
          this.timeOffset = m.now - Date.now(); this.startTime = m.startTime;
          if (m.theme) setTheme(m.theme, true);
          for (const [i, until] of Object.entries(m.hearth || {})) this.setHearth(+i, until);
          for (const [id, until] of Object.entries(m.res)) if (until > m.now) this.world.setResState(+id, until - this.timeOffset);
          for (const [id, until] of Object.entries(m.loot)) if (until > m.now) this.world.setLootState(id, until - this.timeOffset);
          {
            const ids = new Set(m.structures.map((s) => s.id));
            for (const s of [...this.world.structures]) if (!ids.has(s.id)) this.world.removeStructure(s.id);
            for (const s of m.structures) { if (this.world.structureMeshes.has(s.id)) this.world.updateStructure(s.id, s); else this.world.addStructure({ ...s }); }
            for (const s of this.world.structures) if (s.type === 'vehicle' && s.driver === this.id && !this.vehicle) this.home.op(s, { o: 'move', x: s.x, z: s.z, ry: s.ry || 0, fuel: s.fuel });
          }
          for (const [id, r] of Object.entries(m.rels)) this.social.rels[id] = r;
          this.social.serverPreg = m.preg; this.social.serverChildren = m.children;
          this.ents.syncChildren(this.social.children);
          m.players.forEach((p) => this.ents.upsertRemote(p));
          const mine = m.structures.filter((s) => s.owner === this.id && s.type === 'bed').pop() || m.structures.filter((s) => s.owner === this.id && s.type === 'shelter').pop();
          if (mine) this.spawnPoint = { x: mine.x, z: mine.z, y: mine.type === 'bed' ? mine.y + 0.6 : undefined };
          break;
        case 'join': this.ents.upsertRemote(m.player); break;
        case 'leave': this.ents.removeRemote(m.id); break;
        case 'state': this.ents.upsertRemote(m); break;
        case 'chat': if (m.ch === 'pm' && m.from !== this.id) this.lastPm = m.name; this.ui.chat(m.name, m.text, m.from === 'system', m.ch, m.toName, m.from === this.id); break;
        case 'theme': setTheme(m.v, true); this.ui.toast(m.v === 'halloween' ? '🎃 เจ้าของเซิร์ฟเวอร์เปิดธีมฮาโลวีน!' : '🌆 เจ้าของเซิร์ฟเวอร์เปลี่ยนกลับเป็นธีมโลกล่มสลาย'); break;
        case 'party': this.party = m.id ? m : null; this.ui.refreshPanels(); break;
        case 'partyinv': this.sfx.play('love'); this.ui.confirm(`👥 ${m.name} ชวนคุณเข้าปาร์ตี้ ตกลงไหม?`, (ok) => { if (ok) this.net.send({ t: 'party', a: 'accept', pid: m.pid }); }); break;
        case 'res': this.world.setResState(m.id, m.until - this.timeOffset); break;
        case 'loot': this.world.setLootState(m.id, m.until - this.timeOffset); break;
        case 'place': this.world.addStructure({ ...m.s }); this.home.onPlaced(m.s); break;
        case 'supd': case 'sdel': case 'give': this.home.onNet(m); break;
        case 'ms': this.ents.syncNetFauna(m.m); break;
        case 'mdie': this.ents.netMobDied(m.id, m.by === this.id, m.k); break;
        case 'tamed': case 'tameprog': break; // ความเชื่องคิดในเครื่อง/ที่เซิร์ฟเวอร์ผ่าน econ แล้ว
        case 'notice': this.ui.toast(m.text, 'love'); break;
        case 'receive': this.inv[m.item] = (this.inv[m.item] || 0) + m.qty; this.ui.toast(`🎁 ${m.from} ให้ ${ITEMS[m.item]?.name} กับคุณ`, 'love'); break;
        case 'consume': this.removeItem(m.item, m.qty); break;
        case 'healed': {
          const it = ITEMS[m.item]; const s = this.stats;
          if (it?.med) { if (it.med.stopBleed) s.bleeding = false; if (it.med.fracture) s.fracture = false; if (it.med.infection) s.infection = clamp(s.infection + it.med.infection, 0, 100); if (it.med.cureSick) s.sick = 0; s.hp = clamp(s.hp + (it.med.hp || 0) + 5, 0, this.maxHp()); }
          this.ui.toast(`🩹 ${m.from} ทำแผลให้คุณ`, 'love'); break;
        }
        case 'zs': this.ents.syncNetZombies(m.z); break;
        case 'zdie': this.ents.netZombieDied(m.id, m.by === this.id, m.tier); break;
        case 'announce': this.onAnnounce(m); break;
        case 'friends': this.friends = m.list || []; this.friendReqs = m.reqs || []; if (this.ui.open === 'panel' && this.ui.tab === 'rel') this.ui.refreshPanels(); break;
        case 'friendmsg': this.ui.toast(m.text); break;
        case 'tradereq': this.sfx.play('click'); this.ui.confirm(`🔄 ${m.name} ขอแลกของกับคุณ ตกลงไหม?`, (ok) => this.net.send({ t: 'trade', a: ok ? 'accept' : 'decline', to: m.from })); break;
        case 'tradestate': this.tradeSt = m; this.ui.openTrade(); break;
        case 'tradeend': this.tradeSt = null; this.ui.toast(m.why); if (this.ui.tab === 'trade') this.ui.closeAll(); break;
        case 'tradedone': if (!this.auth.server) this.onEcon(applyResult(this.auth.ch, { take: m.take, give: m.give }), null); break;
        case 'friendreq':
          this.sfx.play('love'); this.ui.chat('', `📨 ${m.name} ขอเป็นเพื่อนกับคุณ (ตอบได้ในแท็บ 💞 ความสัมพันธ์)`, true);
          this.ui.confirm(`📨 ${m.name} ขอเป็นเพื่อนกับคุณ ตอบรับไหม?`, (ok) => this.net.send({ t: 'friend', a: ok ? 'accept' : 'decline', to: m.from }));
          break;
        case 'music': if (m.id !== this.id) this.onMusic(m); break;
        case 'zhit': this.hurt(m.dmg, { bleed: m.bleed, infect: m.infect, src: 'ผู้ติดเชื้อ' }); break;
        case 'econ': this.onEcon(m.r, m.c); break;
        case 'char': this.applyServerChar(m.c); break;
        case 'correct': this.player.pos.set(...m.p); this.player.vy = 0; break;
        case 'authfail': this.ui.showFatal(m.text || 'เข้าสู่ระบบไม่สำเร็จ'); break;
        case 'hearth': this.setHearth(m.i, m.until); break;
        case 'maint': this.ui.toast(m.text, 'warn'); this.ui.chat('', m.text, true); this.maintMsg = m.text; break;
        case 'disconnected':
          if (this.auth.server) { this.ui.showFatal(this.maintMsg ? '🔧 ขออภัยในความไม่สะดวก กำลังอัพเดทข้อมูล — ตัวละครของคุณถูกบันทึกไว้แล้ว กดเพื่อกลับเข้าเล่น (ถ้ายังอัปเดตอยู่ หน้าเข้าสู่ระบบจะรอให้เอง)' : 'ขาดการเชื่อมต่อกับเซิร์ฟเวอร์ — ตัวละครของคุณถูกบันทึกไว้แล้ว กดเพื่อเข้าเล่นใหม่'); break; } this.ui.toast('ขาดการเชื่อมต่อกับเซิร์ฟเวอร์ — เล่นต่อแบบออฟไลน์', 'warn'); break;
        default: this.social.onNet(m);
      }
    });
    this.net.send({ t: 'hello', id: this.id, token: this.net.token, name: this.profile.name, sex: this.profile.sex, look: this.profile.look, p: this.player.pos.toArray() });
  }

  // ---------------- save ----------------
  save() {
    if (this.auth.server) {
      // เซิร์ฟเวอร์เก็บกระเป๋า/ทักษะเอง ส่งเฉพาะค่าที่ไม่ใช่เศรษฐกิจ (เซิร์ฟเวอร์ตรวจขอบเขตอีกที)
      return this.net.send({ t: 'csave', stats: this.stats, hotbar: this.hotbar, social: this.social.toJSON(), pets: this.pets.map((p) => ({ id: p.id, hp: p.hp, xp: p.xp, loyal: p.loyal, stay: p.stay, home: p.home, down: p.down, name: p.name })) });
    }
    const d = {
      id: this.id, profile: this.profile, stats: this.stats, inv: this.inv, hotbar: this.hotbar, equipped: this.equipped, lefty: this.lefty, boxes: this.boxes, jobKit: this.jobKit, trade: this.trade, jp: this.jp, sq: this.sq || null, skills: this.skills,
      pets: this.pets, wear: this.wear, pos: this.player.pos.toArray(), spawn: this.spawnPoint, social: this.social.toJSON(), quest: this.quest.toJSON(),
    };
    if (!this.net.online) Object.assign(d, {
      startTime: this.startTime, structures: this.world.structures,
      res: Object.fromEntries(this.world.resources.filter((r) => r.until).map((r) => [r.id, r.until])),
      loot: Object.fromEntries(this.world.loot.filter((l) => l.until).map((l) => [l.id, l.until])),
    });
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch { /* storage unavailable */ }
  }
  // ตัวละครจากเซิร์ฟเวอร์ (ตอนเข้าเกม)
  applyServerChar(c) {
    this.charLoaded = true;
    Object.assign(this.stats, c.stats || {});
    if (Array.isArray(c.hotbar)) this.hotbar = c.hotbar;
    this.applyCharView(c);
    setOutfit(this.player.mesh, this.wear, ITEMS);
    if (c.pos) { this.player.pos.set(...c.pos); this.player.vy = 0; } else this.placeAtStart();
    if (c.spawn) this.spawnPoint = c.spawn;
    if (c.social) { this.social.load(c.social); this.ents.syncChildren(this.social.children); }
    if (this.stats.hp <= 0) this.respawn();
    this.ui.refreshPanels();
  }
  load() {
    let d; try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { d = null; }
    if (!d || d.id !== this.id) return false;
    Object.assign(this.stats, d.stats); this.inv = d.inv || {}; this.hotbar = d.hotbar || this.hotbar; this.skills = d.skills || {};
    this.wear = d.wear || {};
    // เซฟเก่า: เสื้อเกราะผ้าเคยใส่อัตโนมัติจากกระเป๋า → สวมให้เลย
    if (!this.wear.body && this.inv.cloth_armor) { this.removeItem('cloth_armor'); this.wear.body = 'cloth_armor'; }
    setOutfit(this.player.mesh, this.wear, ITEMS);
    this.pets = (d.pets || []).map(ensurePet); this.spawnPoint = d.spawn || this.spawnPoint; this.equipped = d.equipped; this.lefty = !!d.lefty; this.boxes = d.boxes || {}; this.jobKit = d.jobKit ?? null; this.trade = d.trade || {}; this.jp = d.jp || null; this.sq = d.sq || null; setHeldTool(this.player.mesh, this.equipped, this.lefty);
    if (d.pos) this.player.pos.fromArray(d.pos);
    this.social.load(d.social);
    this.quest.load(d.quest);
    if (!this.net.online) {
      if (d.startTime) this.startTime = d.startTime;
      (d.structures || []).forEach((s) => { s.driver = null; this.world.addStructure(s); });
      for (const [id, u] of Object.entries(d.res || {})) if (u > Date.now()) this.world.setResState(+id, u);
      for (const [id, u] of Object.entries(d.loot || {})) if (u > Date.now()) this.world.setLootState(id, u);
    }
    if (this.stats.hp <= 0) { this.dead = false; this.respawn(); }
    return true;
  }

  // ---------------- main loop ----------------
  // ระบบใดพังก็ไม่ทำให้ทั้งเกมค้าง: จับข้อผิดพลาดแยกทีละส่วน แล้วแจ้งในแชทครั้งเดียว
  safe(name, fn) {
    try { fn(); } catch (e) {
      console.error(name, e);
      this.errSeen ||= new Set();
      if (!this.errSeen.has(name)) { this.errSeen.add(name); this.ui?.chat('', `⚠️ ระบบ "${name}" ขัดข้อง: ${e.message} (แคปหน้าจอนี้ส่งให้ผู้พัฒนาได้)`, true); }
    }
  }
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const S = (n, f) => this.safe(n, f);
    if (!this.dead) { S('ผู้เล่น', () => this.updatePlayer(dt)); S('ค่าสถานะ', () => this.updateStats(dt)); }
    S('สิ่งมีชีวิต', () => this.ents.update(dt));
    S('สังคม', () => this.social.tick(dt));
    S('ภารกิจ', () => { this.quest.update(dt); this.boxUI.update(dt); });
    S('สัตว์เลี้ยง', () => tickPetTraits(this, dt));
    S('มือถือ', () => this.touch?.update());
    S('ก่อสร้าง', () => { this.builder.update(); this.fishing.update(dt); this.home.tick(dt); });
    if (this._bClass !== this.builder.active) { this._bClass = this.builder.active; document.body.classList.toggle('building', this.builder.active); }
    S('สภาพแวดล้อม', () => this.updateEnv(dt));
    S('กล้อง', () => this.updateCamera());
    this.updateNav(dt);
    S('ปุ่มโต้ตอบ', () => {
      const t = this.ui.open || this.dead ? null : this.findTarget();
      if (!this.ui.open) this.ui.setPrompt(this.builder.active ? this.builder.prompt() : this.hitInfo && this.hitInfo.until > performance.now() ? this.hitInfo.text : t ? `${this.touch ? '✋' : '<kbd>E</kbd>'} ${t.text}` : '');
    });
    S('หน้าจอ', () => this.ui.update(dt));
    S('ตัวจับเวลา', () => this.timers(dt));
    // แจ้งเมื่อหน้าเกมไม่ได้รับคีย์บอร์ด (เช่น ยังไม่ได้คลิกในกรอบเกมบน claude.ai)
    this.focusT = (this.focusT || 0) - dt;
    if (this.focusT <= 0) { this.focusT = 0.5; const nf = !this.touch && !document.hasFocus() && !this.ui.open; document.getElementById('focus-hint').hidden = !nf; }
    this.renderer.render(this.scene, this.camera);
  }

  updatePlayer(dt) {
    const p = this.player, s = this.stats, k = this.keys;
    this.atkCd -= dt; this.atkT = Math.max(0, this.atkT - dt * 3);
    let fx = 0, fz = 0;
    if (!this.ui.open && !this.ui.chatting) {
      if (k.KeyW || k.ArrowUp) fz += 1; if (k.KeyS || k.ArrowDown) fz -= 1;
      if (k.KeyA || k.ArrowLeft) fx += 1; if (k.KeyD || k.ArrowRight) fx -= 1;
      if (this.touch && Math.hypot(this.touch.move.x, this.touch.move.y) > 0.15) { fx -= this.touch.move.x; fz -= this.touch.move.y; }
    }
    const jump = (k.Space || this.touch?.consumeJump()) && !this.ui.open;
    if (this.vehicle) { animateHuman(p.mesh, dt, 0, 0); this.home.drive(dt, fx, fz); return; }
    if (this.updateSleep(dt, !!(fx || fz) || jump)) return;
    if (this.updateRest(dt, !!(fx || fz) || jump)) return;
    const moving = fx || fz;
    const w = waterAt(p.pos.x, p.pos.z);
    p.swim = !!w && p.pos.y < w.level - 0.9;
    const over = this.overloaded();
    const sprint = (k.ShiftLeft || k.ShiftRight || this.touch?.sprint) && s.stamina > 1 && moving && !p.swim && !over && !s.fracture; // ขาหักวิ่งไม่ได้
    if ((sprint || p.swim) && this.stance) this.setStance(0);
    if (this.mount && (p.swim || this.mount.dead || this.mount.pet.down > 0 || this.vehicle)) this.dismount();
    let spd = p.swim ? 2.6 : sprint ? 7.8 : 4.6;
    spd *= [1, 0.55, 0.3][this.stance] * (hasPerk(this.ch, 'athlete', 1) ? 1.1 : 1);
    if (s.fracture) spd *= 0.5; else if (s.sprain > 0) spd *= sprint ? 0.55 : 0.75; if (s.infection > 70) spd *= 0.8; if (this.social.preg[this.id]) spd *= 0.85;
    spd *= 1 + wearStats(this.wear).spd; if (over) spd *= 0.6;
    if (this.mount) spd = sprint ? 10.5 : 7; // ขี่ควาย: ขาหักก็ไปได้ ไม่เสียสตามิน่า
    if (p.climb && fz < 0 && p.climb.dir === 'up') { p.climb = null; this.ui.toast('ปล่อยมือจากกำแพง'); }
    if (moving && !p.climb) {
      const yaw = this.camYaw + Math.PI;
      const L = Math.hypot(fx, fz); fx /= L; fz /= L;
      const dx = Math.sin(yaw) * fz + Math.cos(yaw) * fx, dz = Math.cos(yaw) * fz - Math.sin(yaw) * fx;
      p.pos.x += dx * spd * dt; p.pos.z += dz * spd * dt;
      const tr = Math.atan2(dx, dz); let dr = tr - p.ry; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283;
      if (this.atkT <= 0) p.ry += dr * Math.min(1, dt * 12);
      p.speedNow = spd;
    } else p.speedNow = 0;
    if (sprint && !this.mount) s.stamina -= 14 * dt;
    if (p.swim) s.stamina -= 4 * dt;
    p.pos.x = clamp(p.pos.x, WORLD.minX + 5, WORLD.maxX - 5); p.pos.z = clamp(p.pos.z, WORLD.minZ + 5, WORLD.maxZ - 5);
    const hit = p.climb ? null : this.world.collide(p.pos, 0.4);
    if (hit && !hit.fence && !hit.gate && !p.swim) { this.wall = hit; this.wallT = 0.35; }
    this.wallT = (this.wallT || 0) - dt; if (this.wallT <= 0) this.wall = null;
    const gy = heightAt(p.pos.x, p.pos.z);
    const roof = this.world.roofAt(p.pos.x, p.pos.z, p.pos.y);
    if (p.climb) this.updateClimb(dt, w ? Math.max(gy, w.level - 1.25) : gy);
    else if (jump && this.wall && !p.swim && !this.mount) this.startClimb();
    else if (p.swim) { p.vy = 0; p.pos.y = Math.max(gy, w.level - 1.25); if (jump) p.pos.y = w.level - 0.9; }
    else {
      if (jump && this.stance) this.setStance(0);
      else if (jump && p.onGround && s.stamina > 8) { p.vy = hasPerk(this.ch, 'athlete', 1) ? 9.4 : 8; p.onGround = false; s.stamina -= 8; }
      p.vy -= 24 * dt; p.pos.y += p.vy * dt;
      let floor = w ? Math.max(gy, w.level - 1.25) : gy;
      if (roof !== null) floor = Math.max(floor, roof);
      // เดินตกขอบหลังคา → ไต่ลงเอง (ถ้าไม่ได้กระโดด)
      if (p.lastRoof !== null && p.lastRoof !== undefined && roof === null && p.vy <= 0 && p.lastRoof - floor > 2.5 && !jump) {
        p.climb = { dir: 'down' }; p.vy = 0; p.lastRoof = null;
      }
      if (p.pos.y <= floor) {
        // ตกจากที่สูงมาก = ขาหัก (วิ่งไม่ได้) · ตกไม่สูงมาก = ขาแพลง (เดินกะเผลกได้ หายเองใน 2 นาที)
        if (p.vy < -17 && !s.fracture && !hasPerk(this.ch, 'athlete', 2)) { s.fracture = true; s.sprain = 0; this.hurt(15, { src: 'ตกจากที่สูง' }); this.ui.toast('🦴 ขาหัก! วิ่งไม่ได้ — ทำเฝือกไม้เพื่อรักษา', 'warn'); }
        else if (p.vy < -12.5 && !s.fracture && !(s.sprain > 0) && !hasPerk(this.ch, 'athlete', 1)) { s.sprain = 120; this.hurt(5, { src: 'ตกจากที่สูง' }); this.ui.toast('🦶 ขาแพลง! เดินกะเผลกได้ วิ่งได้ช้า — พักสักครู่หรือพันผ้าพันแผลจะหายเร็วขึ้น', 'warn'); }
        p.pos.y = floor; p.vy = 0; p.onGround = true;
      }
      p.lastRoof = p.onGround && roof !== null && p.pos.y - roof < 0.05 ? roof : null;
    }
    if (p.speedNow > 0 && p.onGround) { this.stepT = (this.stepT || 0) + dt * p.speedNow; if (this.stepT > 2.3) { this.stepT = 0; this.sfx.play(p.swim ? 'splash' : 'step'); } }
    p.mesh.rotation.y = p.ry;
    p.mesh.userData.belly.visible = !!this.social.preg[this.id];
    setInjury(p.mesh, injuryBits(this.stats)); tickInjury(p.mesh, dt);
    animateHuman(p.mesh, dt, p.speedNow, this.atkT, p.climb ? (p.climb.dir === 'up' ? 'climb' : 'down') : ['', 'crouch', 'crawl'][this.stance] || null);
    if (this.mount) {
      const M = this.mount; M.pos.set(p.pos.x, p.pos.y, p.pos.z); M.ry = p.ry; M.mesh.position.copy(M.pos); M.mesh.rotation.y = p.ry;
      ridePose(p.mesh, dt, p.speedNow, 'animal'); p.mesh.userData.inner.position.y = 0.95;
    }
    if (this.blockT > 0 && !p.climb) { this.blockT -= dt; p.mesh.userData[this.lefty ? 'rArm' : 'lArm'].rotation.x = -1.4; }
  }

  // ---------------- ปีนป่าย ----------------
  startClimb() {
    this.stance = 0;
    const p = this.player, b = this.wall, s = this.stats;
    if (!b || p.climb || this.dead) return;
    if (s.stamina < 10) return this.ui.toast('เหนื่อยเกินกว่าจะปีน (รอสตามิน่า)', 'warn');
    const dx = p.pos.x - b.x, dz = p.pos.z - b.z;
    const alongX = (b.w / 2 + 0.4 - Math.abs(dx)) < (b.d / 2 + 0.4 - Math.abs(dz));
    p.climb = { dir: 'up', b, x: p.pos.x, z: p.pos.z, nx: alongX ? -Math.sign(dx) : 0, nz: alongX ? 0 : -Math.sign(dz) };
    p.ry = Math.atan2(p.climb.nx, p.climb.nz); p.vy = 0;
    this.sfx.play('step');
  }
  updateClimb(dt, ground) {
    const p = this.player, s = this.stats, c = p.climb;
    p.vy = 0; p.onGround = false;
    if (c.dir === 'up') {
      const top = c.b.top - 1;
      p.pos.x = c.x; p.pos.z = c.z;
      p.pos.y += (s.fracture ? 1.8 : 4) * dt; s.stamina -= 6 * dt;
      this.climbStep = (this.climbStep || 0) + dt; if (this.climbStep > 0.35) { this.climbStep = 0; this.sfx.play('step'); }
      if (p.pos.y >= top) {
        p.pos.y = top; p.pos.x += c.nx * 0.9; p.pos.z += c.nz * 0.9; p.climb = null; p.onGround = true; p.lastRoof = top;
        this.gainXp('survival', 2);
        if (!this.hintedRoof) { this.hintedRoof = true; this.ui.toast('🧗 ขึ้นมาบนที่สูงแล้ว — ผู้ติดเชื้อปีนตามไม่ได้ เดินออกจากขอบเพื่อไต่ลง (กระโดดลงจะบาดเจ็บ)'); }
      } else if (s.stamina <= 0) { p.climb = null; this.ui.toast('หมดแรง! ร่วงลงมา', 'warn'); }
    } else {
      p.pos.y -= 5 * dt;
      if (p.pos.y <= ground) { p.pos.y = ground; p.climb = null; p.onGround = true; }
    }
  }

  // ความเครียด: เพิ่มเมื่อมีผู้ติดเชื้อใกล้ กลางคืน หิว เจ็บ · ลดเมื่อพักในบ้าน/ค่าย อยู่กับเพื่อน สัตว์เลี้ยง ดนตรี
  updateStress(dt) {
    const s = this.stats, P = this.player.pos; s.stress ||= 0;
    let zn = 0; for (const e of this.ents.list) if (!e.dead && e.kind === 'zombie' && e.pos.distanceToSquared(P) < 225) zn++;
    let up = Math.min(3, zn) * 0.6 + (this.isNight() ? 0.05 : 0) + (s.hunger < 20 || s.thirst < 20 ? 0.15 : 0) + (s.infection > 30 ? 0.1 : 0) + (s.bleeding ? 0.2 : 0);
    if (hasPerk(this.ch, 'entertainer', 0)) up *= 0.6;
    if (hasPerk(this.ch, 'monk', 0)) up *= 0.5;
    if (this.moraleT > 0) up *= 0.5;
    if ([...this.ents.remotes.values()].some((r) => r.en && r.pos.distanceToSquared(P) < 144)) up *= 0.7;
    let down = 0;
    if (this.inCampNow || this.nearFire || this.world.nearStructure(P.x, P.z, 'shelter', 4) || this.world.roofOver?.(P)) down += 0.6;
    if (this.social.lovedNearby() || [...this.ents.remotes.values()].some((r) => r.pos.distanceToSquared(P) < 100)) down += 0.25;
    down += Math.min(0.3, this.ents.list.filter((e) => e.kind === 'pet' && !e.dead && e.pos.distanceToSquared(P) < 36).length * 0.1);
    if (!zn && this.player.speedNow === 0) down += 0.05;
    if (this.wellFed > 0) down += 0.3;
    const before = s.stress;
    s.stress = clamp(s.stress + (up - (zn ? 0 : down)) * dt, 0, 100);
    if (before < 85 && s.stress >= 85) this.ui.toast('😱 เครียดหนัก! ดาเมจลดลง — พักในที่ปลอดภัย กินของอร่อย หรือฟังดนตรี', 'warn');
  }
  // เล่นดนตรี (กีตาร์): ลดความเครียดตัวเองและคนรอบข้าง
  playMusic() {
    const s = this.stats, ent = hasPerk(this.ch, 'entertainer', 0), P = this.player.pos;
    const power = ent ? 40 : 15, heal = hasPerk(this.ch, 'entertainer', 2);
    this.sfx.play('music');
    this.onMusic({ p: power, heal, self: true });
    if (hasPerk(this.ch, 'entertainer', 1)) for (const pet of this.pets) pet.loyal = Math.min(100, (pet.loyal || 0) + 10);
    if (this.net.online) this.net.send({ t: 'music', x: +P.x.toFixed(1), z: +P.z.toFixed(1), p: power, heal: heal ? 1 : 0 });
    this.ui.chat('', `🎸 ${this.profile.name} เล่นดนตรี... ความเครียดของทุกคนรอบตัวลดลง`, true);
  }
  // สวดมนต์ (ลูกประคำ): ลดความตื่นตระหนก + ให้กำลังใจคนรอบตัว
  chant() {
    const s = this.stats, P = this.player.pos, monk = hasPerk(this.ch, 'monk', 0), heal = hasPerk(this.ch, 'monk', 1);
    const power = monk ? 40 : 15;
    this.sfx.play('quest');
    this.onMusic({ p: power, heal: false, self: true, mo: monk });
    if (heal) s.hp = Math.min(this.maxHp(), s.hp + 10);
    if (hasPerk(this.ch, 'monk', 2)) { this.hideT = 15; this.ui.toast('🙏 พลังเมตตา: ผู้ติดเชื้อมองไม่เห็นคุณ 15 วินาที', 'level'); }
    if (this.net.online) this.net.send({ t: 'music', x: +P.x.toFixed(1), z: +P.z.toFixed(1), p: power, heal: 0, mo: monk ? 1 : 0 });
    this.ui.chat('', `🙏 ${this.profile.name} สวดมนต์... จิตใจทุกคนรอบตัวสงบลง`, true);
  }
  onMusic(m) {
    const s = this.stats;
    if (!m.self) { if (Math.hypot(m.x - this.player.pos.x, m.z - this.player.pos.z) > 15) return; this.sfx.play('music', { vol: 0.5 }); }
    s.stress = Math.max(0, (s.stress || 0) - m.p * (m.self ? 1 : 0.75));
    if (m.heal) { s.hp = Math.min(this.maxHp(), s.hp + 15); s.stamina = this.maxStamina(); }
    if (m.mo) this.moraleT = Math.max(this.moraleT || 0, 180);
    if (!m.self) this.ui.toast(`🎶 ได้ยินเสียงดนตรี... ผ่อนคลายขึ้น${m.heal ? ' (ฟื้นพลัง)' : ''}`);
  }
  onAnnounce(m) {
    if (m.kind === 'boss') {
      const P = this.player.pos, d = Math.hypot(m.x - P.x, m.z - P.z) * 50;
      this.sfx.play('groan', { vol: 1 }); this.sfx.play('gate');
      this.ui.toast(`👑 ราชาผู้ติดเชื้อปรากฏตัว! ห่างไป ${Math.round(d)} ม. — แข็งแกร่งมากแต่ดรอปของพิเศษ`, 'warn');
      this.ui.chat('', '👑 เสียงคำรามดังก้อง... ราชาผู้ติดเชื้อออกล่าแล้ว! รวมพลังกันล้มมันเพื่อชิงของพิเศษ', true);
      this.bossAt = { x: m.x, z: m.z, t: performance.now() };
    } else if (m.kind === 'admiral') {
      this.sfx.play('groan', { vol: 1 }); this.sfx.play('gate');
      this.ui.toast('🎖️ ผู้บัญชาการผู้ติดเชื้อปรากฏตัวที่ฐานทัพเรือสัตหีบ! ล้มมันเพื่อชิงยุทธภัณฑ์และเหรียญกล้าหาญ', 'warn');
      this.ui.chat('', '⚓ สัญญาณเตือนภัยดังทั่วฐานทัพเรือ... ผู้บัญชาการผู้ติดเชื้อนำทหารออกตรวจการณ์!', true);
    } else if (m.kind === 'bossdown') this.ui.chat('', `👑 ราชาผู้ติดเชื้อถูกล้มแล้ว!`, true);
  }

  updateStats(dt) {
    const s = this.stats, preg = this.social.preg[this.id], surv = skillLevel(this.skills.survival);
    const hungerRate = 0.055 * (preg ? 1.4 : 1) * (this.player.speedNow > 6 ? 1.5 : 1) * (1 - (surv - 1) * 0.03);
    s.hunger = Math.max(0, s.hunger - hungerRate * dt * (s.sick > 0 ? 1.5 : 1) * (this.tempState === 'cold' || this.tempState === 'freeze' ? 1.3 : 1)); // หนาว = หิวเร็ว
    s.thirst = Math.max(0, s.thirst - 0.08 * dt * (this.isNight() ? 0.8 : 1.1) * (s.sick > 0 ? 2 : 1) * (this.tempState === 'hot' ? 1.6 : 1));
    if (s.sick > 0) s.sick -= dt;
    this.updateStress(dt);
    for (const k of ['moraleT', 'hideT', 'droneT']) if (this[k] > 0) this[k] -= dt;
    let regen = (this.player.speedNow > 6 ? 0 : 12) * (1 + wearStats(this.wear).stam) * (hasPerk(this.ch, 'athlete', 1) ? 1.3 : 1) * (s.stress >= 60 ? 0.7 : 1) * (this.moraleT > 0 ? 1.2 : 1);
    regen *= 1 + 0.5 * this.happyP(); // ความสุข = กระฉับกระเฉง
    if (this.tempState === 'cold' || this.tempState === 'freeze') regen *= 0.7; // หนาวสั่น
    if (s.infection > 60) regen *= 0.5;
    if (this.social.lovedNearby()) regen *= 1.5;
    if (petNearbyWith(this, 'swift', 20)) regen *= 1.25;
    if (s.hunger < 10 || s.thirst < 10) regen *= 0.5;
    if (!this.player.swim) s.stamina = Math.min(this.maxStamina(), s.stamina + regen * dt);
    s.stamina = Math.max(0, s.stamina);
    let dhp = 0;
    if (s.hunger <= 0) dhp -= 0.5; if (s.thirst <= 0) dhp -= 0.8;
    if (this.tempState === 'freeze') dhp -= 0.4; // ตัวเย็นเกิน
    if (s.sprain > 0) { s.sprain -= dt; if (s.sprain <= 0) { s.sprain = 0; this.ui.toast('🦶 ขาแพลงหายแล้ว'); } }
    if (s.bleeding) { dhp -= 0.6; if (Math.random() < 0.004 * dt * 60 * 0.1) { s.bleeding = false; this.ui.toast('เลือดหยุดไหลเองแล้ว'); } }
    if (this.immuneT > 0) this.immuneT -= dt;
    this.tickHappy(dt);
    if (s.infection > 0) { s.infection = Math.min(100, s.infection + 0.12 * dt * (hasPerk(this.ch, 'doctor', 2) ? 0.5 : 1) * (1 - 0.4 * this.happyP())); if (s.infection >= 100) dhp -= 1.2; }
    if (this.player.swim && s.stamina <= 0) dhp -= 4;
    if (dhp === 0 && s.hunger > 40 && s.thirst > 40 && s.infection < 30) dhp = (0.15 + (this.nearFire || this.inCampNow ? 0.25 : 0)) * (this.social.lovedNearby() ? 1.5 : 1);
    if (dhp > 0 && hasPerk(this.ch, 'doctor', 2)) dhp *= 2;
    if (this.wellFed > 0) { this.wellFed -= dt; if (dhp >= 0) dhp += 0.4; }
    s.hp = Math.min(this.maxHp(), s.hp + dhp * dt);
    if (s.hp <= 0) this.die(s.infection >= 100 ? 'เชื้อลุกลามจนกลายเป็นหนึ่งในพวกมัน' : s.thirst <= 0 ? 'ขาดน้ำ' : s.hunger <= 0 ? 'อดอาหาร' : s.bleeding ? 'เสียเลือดมาก' : 'จมน้ำ');
    s.survived += dt;
  }

  updateEnv(dt) {
    const tod = this.timeOfDay(), P = this.player.pos;
    const a = (tod - 0.25) * Math.PI * 2; // 06:00 = ขึ้น
    const sunY = Math.sin(a), sunX = Math.cos(a);
    const day = clamp(sunY * 2 + 0.3, 0, 1);
    this.sun.position.set(P.x + sunX * 120, P.y + Math.max(0.15, sunY) * 150, P.z + 50);
    this.sun.target.position.copy(P);
    this.sun.intensity = 1.4 * day * (this.weather.rain ? 0.5 : 1);
    this.hemi.intensity = 0.25 + 0.7 * day;
    const hw = isHalloween();
    const sky = new THREE.Color(hw ? '#170826' : '#0b1024').lerp(new THREE.Color(this.weather.rain ? '#8d99a6' : hw ? '#c99a8c' : '#9cc3d9'), hw ? day * 0.75 : day);
    if (tod > 0.72 && tod < 0.82) sky.lerp(new THREE.Color(hw ? '#ff7b00' : '#e07a5f'), (hw ? 0.5 : 0.35) * (1 - Math.abs(tod - 0.77) / 0.05));
    sky.lerp(new THREE.Color(hw ? '#5a2a6a' : '#8a8f7a'), hw ? 0.2 : 0.12); // ฝุ่นควันโลกล่มสลาย · หมอกม่วงฮาโลวีน
    this.hemi.color.set(hw ? '#e8c9ff' : '#dfe9f3'); this.hemi.groundColor.set(hw ? '#4a2a10' : '#5a5a40');
    if (hw) this.hemi.intensity = 0.32 + 0.55 * day;
    this.world.tickHalloween?.(dt, P, this.isNight());
    this.scene.background = sky; this.scene.fog.color.copy(sky);
    const W = this.weather; // near ต้องน้อยกว่า far เสมอ ไม่งั้นของใกล้ตัวจะขาวโพลนแต่ของไกลกลับชัด
    this.scene.fog.far = W.fog >= 0.7 ? 95 : W.fog >= 0.35 ? 170 : W.snow ? 230 : W.rain ? 240 : 140 + day * 300;
    this.scene.fog.near = Math.min(60, this.scene.fog.far * 0.35);
    if (W.fog > 0) this.scene.fog.color.lerp(new THREE.Color('#c9ced3').multiplyScalar(0.35 + day * 0.6), Math.min(0.55, W.fog));
    if (W.snow) { this.scene.fog.color.lerp(new THREE.Color('#e9eef3').multiplyScalar(0.3 + day * 0.7), 0.25); this.hemi.groundColor.set('#cfd8df'); }
    this.scene.background = this.scene.fog.color.clone();
    this.visT = (this.visT || 0) - dt; if (this.visT <= 0) { this.visT = 0.5; this.world.updateVisibility(P.x, P.z, this.scene.fog.far); }
    // กองไฟ
    let nearest = null, nd = 1e9;
    for (const s of this.world.structures) if (s.type === 'campfire') { const d = (s.x - P.x) ** 2 + (s.z - P.z) ** 2; if (d < nd) { nd = d; nearest = s; } }
    this.nearFire = nearest && nd < 16;
    if (nearest && nd < 60 * 60) { this.fireLight.position.set(nearest.x, heightAt(nearest.x, nearest.z) + 1.2, nearest.z); this.fireLight.intensity = (2 + Math.random() * 0.6) * (1.2 - day * 0.8); }
    else this.fireLight.intensity = 0;
    this.inCampNow = this.quest.done && inCampOf(this.quest.camp.key, P.x, P.z);
    this.sfx.ambience({ night: this.isNight(), rain: this.weather.rain, coast: clamp(1 - Math.abs(distToCoast(P.x, P.z)) / 90, 0, 1), fire: this.nearFire });
    // สภาพอากาศ
    // คำนวณจากเวลา: ทุกคนที่เล่นด้วยกันเห็นฝนตกพร้อมกัน (ช่วงละ 2.5 นาที โอกาสฝน 30%)
    // ฝน / หิมะ / หมอก (คำนวณจากเวลา ทุกคนเห็นตรงกัน)
    const wx = weatherAt(this.now()), Wp = this.weather;
    if (wx.rain !== Wp.rain && wx.rain) this.ui.toast('🌧️ ฝนเริ่มตก — หลบในศาลา/บ้านเพื่อไม่ให้เปียก · รองน้ำฝนได้ (กด E)');
    if (wx.snow && !Wp.snow) this.ui.toast('❄️ หิมะตก! อากาศหนาวจัด — ใส่เสื้อกันหนาว ก่อไฟ หรือหลบในศาลาที่มีเตาผิง', 'warn');
    if (wx.fog >= 0.7 && Wp.fog < 0.7) this.ui.toast('🌫️ หมอกลงหนา มองเห็นได้ไม่ไกล ระวังผู้ติดเชื้อ!', 'warn');
    Object.assign(Wp, wx);
    const fall = Wp.rain || Wp.snow; this.rain.visible = fall;
    if (fall) {
      const pos = this.rain.geometry.attributes.position, sp = Wp.snow ? 3.2 : 30, M = this.rain.material;
      M.color.set(Wp.snow ? '#ffffff' : '#aac'); M.size = Wp.snow ? 0.13 : 0.1; M.opacity = Wp.snow ? 0.55 : 0.45;
      for (let i = 0; i < pos.count; i++) { let y = pos.getY(i) - sp * dt; if (y < -10) y += 40; pos.setY(i, y); if (Wp.snow) pos.setX(i, pos.getX(i) + Math.sin(y + i) * dt * 0.6); }
      pos.needsUpdate = true; this.rain.position.set(P.x, P.y + 10, P.z);
    }
    this.tickBody(dt);
    // เตาผิงในศาลาที่จุดไว้
    for (const p of this.world.pavilions || []) if (p.flame) { const lit = (p.lit || 0) > this.now(); p.flame.visible = lit; if (lit) p.flame.scale.set(1, 0.8 + Math.random() * 0.5, 1); }
  }

  updateCamera() {
    const P = this.player.pos;
    const head = new THREE.Vector3(P.x, P.y + [1.7, 1.15, 0.6][this.vehicle ? 0 : this.stance], P.z);
    const off = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), Math.cos(this.camYaw) * Math.cos(this.camPitch)).multiplyScalar(this.camDist);
    const cam = head.clone().add(off);
    const gy = heightAt(cam.x, cam.z) + 0.4; if (cam.y < gy) cam.y = gy;
    this.camera.position.copy(cam); this.camera.lookAt(head);
  }

  timers(dt) {
    this.safeTime = Math.max(0, this.safeTime - dt);
    this.world._rt = (this.world._rt || 0) - dt;
    if (this.world._rt <= 0) { this.world._rt = 2; this.world.tickRespawn(Date.now()); }
    this.xpT += dt; if (this.xpT > 60) { this.xpT = 0; this.gainXp('survival', 4); for (const p of this.pets) if (!p.home) p.loyal = Math.max(0, p.loyal - (p.gear.neck === 'pet_bandana' ? 1 : 2)); }
    // แมวนำเนื้อมาให้
    for (const p of this.pets) if ((p.type === 'cat' || p.type === 'chicken') && !p.stay && !p.home) { p.t = (p.t || 0) + dt; if (p.t > 180) { p.t = 0; this.auth.do('petgift', { id: p.id, kind: p.type === 'cat' ? 'meat' : 'egg' }); } }
    this.radioT -= dt; if (this.radioT <= 0) { this.radioT = 150 + Math.random() * 120; this.ui.chat('', RADIO[Math.floor(Math.random() * RADIO.length)], true); }
    this.saveT -= dt; if (this.saveT <= 0) { this.saveT = 15; this.save(); }
    this.overT = (this.overT || 0) - dt;
    if (this.overT <= 0) { this.overT = 1; const o = this.overloaded(); if (o && !this.wasOver) this.ui.toast(`🎒 กระเป๋าเต็ม (${this.usedSlots()}/${this.maxSlots()} ช่อง) — เดินช้าลงและวิ่งไม่ได้ ทำ/สวมกระเป๋าใหญ่ขึ้น ฝากของในหีบ หรือทิ้งของ`, 'warn'); this.wasOver = o; }
    this.netT -= dt;
    // โหมดเซิร์ฟเวอร์: ยังไม่ส่งตำแหน่งจนกว่าจะได้ตัวละครจริงจากเซิร์ฟเวอร์ (กันตำแหน่งเกิดชั่วคราวไปทับ)
    if (this.net.online && this.netT <= 0 && (!this.auth.server || this.charLoaded)) {
      this.netT = 0.1;
      const petState = this.ents.list.filter((e) => e.kind === 'pet' && !e.dead).map((e) => ({ t: e.type, x: +e.pos.x.toFixed(2), y: +e.pos.y.toFixed(2), z: +e.pos.z.toFixed(2), ry: +e.ry.toFixed(2), g: Object.keys(PET_SLOTS).map((k) => e.pet.gear[k] || null) }));
      this.net.send({ t: 'state', p: this.player.pos.toArray().map((v) => +v.toFixed(2)), ry: +this.player.ry.toFixed(2), anim: this.player.speedNow, hp: Math.round(this.stats.hp), pets: petState, eq: this.equipped, lh: this.lefty ? 1 : 0, st: this.sleeping || this.resting?.mode === 'lie' ? 3 : this.resting ? 4 : this.stance, sk: +this.stealthMul().toFixed(2), en: hasPerk(this.ch, 'entertainer', 1) || hasPerk(this.ch, 'monk', 1) ? 1 : 0, ij: injuryBits(this.stats), cb: this.player.climb ? (this.player.climb.dir === 'up' ? 1 : 2) : 0, v: this.vehicle ? this.vehicle.s.vt : null, cl: Object.keys(WEAR_SLOTS).map((k) => this.wear[k] || 0), sf: this.safeTime > 0 || this.dead || this.inCampNow ? 1 : 0 });
    }
  }
}
