// ภารกิจหลัก "ตามหาศูนย์อพยพสัตหีบ"
import { QUEST_SPOTS, ITEMS, NPCS, TOWNS } from './data.js';
import { LAKES } from './terrain.js';
import { inCamp } from './citygen.js';
import { ROUTES, routeOf, campOf, campGate, inCampOf, pickRoute } from './quest-core.js';

const S = QUEST_SPOTS;
const dist = (P, x, z) => Math.hypot(P.x - x, P.z - z);
const WEAPONS = ['spear', 'stone_axe', 'machete', 'steel_axe', 'steel_spear', 'bone_spear', 'king_hammer'];
const hasWeapon = (g) => Object.keys(g.inv).some((k) => g.inv[k] > 0 && WEAPONS.includes(k.split('~')[0]));
const DEFEND_SECS = 60;

// ขั้นภารกิจของเส้นทาง R (ข้อความต่างกันตามอำเภอที่เกิด)
const contactNpc = (R) => NPCS.find((n) => n.id === R.contact) || {};
export function stepsOf(R) {
  const C = campOf(R.camp), N = contactNpc(R), nm = N.name || 'ผู้ติดต่อ';
  return [
    { id: 'radio', title: 'สัญญาณจากวิทยุ', desc: `ไปที่${R.radio.name} แล้วหยิบวิทยุสื่อสาร`, target: () => R.radio },
    { id: 'prepare', title: 'เตรียมตัวก่อนออกเดินทาง', desc: 'ต้องมีอาวุธ 1 ชิ้น (หอก/ขวาน/มีดพร้า) และน้ำต้มสุก 2 ขวด — ตักน้ำจากอ่างแล้วต้มที่กองไฟ', target: (g) => { const P = g.player.pos; const l = [...LAKES].sort((a, b) => dist(P, ...a.p) - dist(P, ...b.p))[0]; return { x: l.p[0], z: l.p[1], name: l.name }; } },
    { id: 'battery', title: 'หาแหล่งพลังงาน', desc: 'วิทยุแบตหมด! ค้นรถร้างบนถนนเพื่อหาแบตเตอรี่รถยนต์ — ตามลำแสงสีเหลืองไปที่รถ แล้วยืนข้างรถกด E', target: (g) => { const P = g.player.pos; const c = g.world.loot.filter((l) => l.kind === 'car' && !l.until).sort((a, b) => dist(P, a.x, a.z) - dist(P, b.x, b.z))[0]; return c ? { x: c.x, z: c.z, name: 'รถร้างที่ใกล้ที่สุด' } : null; } },
    { id: 'tower', title: 'ส่งสัญญาณขอความช่วยเหลือ', desc: `ไปที่${R.tower.name} ต่อแบตเตอรี่แล้วส่งสัญญาณ (เสียงจะเรียกผู้ติดเชื้อมา ต้องป้องกันเสาให้ได้ ${DEFEND_SECS} วินาที)`, target: () => R.tower },
    { id: 'kaew', title: `ตามหา "${nm}"`, desc: `${C.name}ตอบกลับมาแล้ว! ${nm} (${N.bio || ''}) รู้รหัสเปิดประตูค่าย — ทำความรู้จักจนถึงระดับ "คุ้นเคย" (ชอบ${ITEMS[N.likes]?.name || 'น้ำต้มสุก'})`, target: (g) => { const e = g.ents.list.find((x) => x.id === R.contact); return e ? { x: e.pos.x, z: e.pos.z, name: nm } : null; } },
    { id: 'gate', title: C.name, desc: `ไปที่ประตูของ${C.name} แล้วใส่รหัส`, target: () => ({ ...campGate(C), name: 'ประตูค่าย' }) },
  ];
}
export const STEPS = stepsOf(ROUTES.classic);

export class Quest {
  constructor(game) { this.g = game; this.step = 0; this.defend = 0; this.hordeT = 0; this.shownIntro = false; this.setRoute(pickRoute()); }
  // เส้นทางภารกิจ (อำเภอที่เกิด) — ตัวละครเก่าที่ไม่มีเส้นทาง = classic
  setRoute(k) { this.route = ROUTES[k] ? k : 'classic'; this.R = routeOf(this); this.steps = stepsOf(this.R); this.camp = campOf(this.R.camp); }
  get done() { return this.step >= this.steps.length; }
  get cur() { return this.steps[this.step]; }
  target() { return this.done ? null : this.cur.target(this.g); }

  // ขั้นภารกิจเปลี่ยนแล้ว (ระบบเศรษฐกิจ/เซิร์ฟเวอร์ยืนยันแล้ว) → แสดงเรื่องราว
  onStep(key) {
    const g = this.g, R = this.R, C = this.camp, nm = contactNpc(R).name || 'ผู้ติดต่อ';
    const M = {
      radio: `📻 วิทยุ: "...ซ่า... ถึงผู้รอดชีวิตทุกคน ${C.name}ยังเปิดรับผู้รอดชีวิต ถ้าได้ยิน ให้ส่งสัญญาณจาก${R.tower.name}... ซ่า..."`,
      prepare: '🎒 พร้อมแล้ว! แต่วิทยุเงียบไป... แบตเตอรี่คงหมด',
      battery: `🔋 เจอแบตเตอรี่รถที่ยังมีไฟ! เอาไปต่อกับ${R.tower.name}`,
      tower: `📡 วิทยุ: "...ได้รับสัญญาณแล้ว! ตามหา '${nm}' เขารู้รหัสประตู${C.name}..."`,
      kaew: `🎖️ ${nm}: "เธอส่งสัญญาณจาก${R.tower.name}มาได้เหรอ? เก่งมาก... รหัสประตูคือ ${R.code} ไปที่${C.name}นะ"`,
      gate: `🎖️ ${nm}: "รหัสถูกต้อง! ยินดีต้อนรับสู่${C.name} ที่นี่ปลอดภัยจากผู้ติดเชื้อ — พักผ่อนให้เต็มที่ แล้วช่วยกันสร้างโลกใหม่นะ"`,
    };
    if (key === 'transmit') {
      g.sfx.play('radio'); this.defend = DEFEND_SECS; this.hordeT = 0;
      g.ui.toast(`📡 กำลังส่งสัญญาณ... เสียงดังเรียกผู้ติดเชื้อ! ป้องกันเสาไว้ ${DEFEND_SECS} วินาที`, 'warn');
      return this.spawnHorde(6);
    }
    if (key === 'radio') g.sfx.play('radio');
    if (key === 'gate') {
      g.world.openGate(C.key); g.sfx.play('gate');
      g.spawnPoint = { x: C.x, z: C.z + 4 };
      if (g.net.online) g.net.send({ t: 'announce', kind: 'quest' });
      g.ui.toast('✅ ภารกิจหลักสำเร็จ! ค่ายอพยพเป็นเขตปลอดภัยและจุดเกิดใหม่ของคุณแล้ว', 'level');
    }
    if (!M[key]) return;
    g.sfx.play('quest'); g.ui.chat('', M[key], true);
    if (!this.done) g.ui.toast(`📜 ภารกิจใหม่: ${this.cur.title}`, 'level');
    g.save();
  }
  ask(a) { const now = performance.now(); if (now - (this.askT?.[a] || 0) < 2500) return; (this.askT ||= {})[a] = now; this.g.auth.do('quest', { a }); }

  // จุดที่กด E ได้
  prompt() {
    const g = this.g, P = g.player.pos;
    if (this.done) return null;
    const id = this.cur.id;
    const R = this.R;
    if (id === 'radio' && dist(P, R.radio.x + 1.6, R.radio.z) < 3) return { text: 'หยิบวิทยุสื่อสาร', act: () => this.takeRadio() };
    if (id === 'tower' && dist(P, R.tower.x + 3, R.tower.z) < 4.5 && this.defend <= 0) return { text: g.hasItem('car_battery') ? 'ต่อแบตเตอรี่แล้วส่งสัญญาณ' : 'ต้องมีแบตเตอรี่รถยนต์ก่อน', act: () => this.transmit() };
    const gate = this.steps[5].target();
    if (id === 'gate' && dist(P, gate.x, gate.z) < 4.5) return { text: 'ใส่รหัสเปิดประตูค่าย', act: () => this.openGate() };
    return null;
  }

  takeRadio() { this.g.auth.do('quest', { a: 'radio' }); }
  transmit() {
    if (!this.g.hasItem('car_battery')) return this.g.ui.toast('ต้องค้นรถร้างหาแบตเตอรี่รถยนต์ก่อน', 'warn');
    this.g.auth.do('quest', { a: 'transmit' });
  }
  spawnHorde(n) {
    const g = this.g, x = this.R.tower.x, z = this.R.tower.z;
    if (g.net.online) return g.net.send({ t: 'horde', x, z, n });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 12;
      const e = g.ents.spawnMob('zombie', x + Math.cos(a) * r, z + Math.sin(a) * r); e.alert = 30;
    }
  }
  openGate() { this.g.auth.do('quest', { a: 'gate' }); }

  onMeet(id) {
    if (this.done || this.cur.id !== 'kaew' || id !== this.R.contact) return;
    if (this.g.social.level(id) < 1) this.g.ui.toast(`${contactNpc(this.R).name}: "ฉันยังไม่รู้จักเธอดีพอจะบอกรหัส... อยู่ด้วยกันสักพัก หรือมีของที่ฉันชอบไหม?"`);
  }

  update(dt) {
    const g = this.g, P = g.player.pos;
    if (!this.shownIntro && this.step === 0) { this.shownIntro = true; g.ui.chat('', `📻 มีเสียงวิทยุดังมาจาก${this.R.radio.name}... (ดูภารกิจที่มุมซ้าย)`, true); }
    if (this.done) return;
    const id = this.cur.id;
    if (id === 'prepare' && hasWeapon(g) && g.hasItem('clean_water', 2)) this.ask('prepare');
    if (id === 'tower' && this.defend > 0) {
      const T = this.R.tower;
      if (dist(P, T.x, T.z) < 30 && !g.dead) {
        this.defend -= dt; this.hordeT += dt;
        if (this.hordeT > 20) { this.hordeT = 0; this.spawnHorde(3); }
        if (this.defend <= 0) this.ask('tower');
      } else if (g.dead || dist(P, T.x, T.z) > 60) { this.defend = 0; g.ui.toast('สัญญาณขาดหาย! กลับไปที่เสาแล้วลองใหม่ (ต้องหาแบตเตอรี่ใหม่)', 'warn'); this.ask('fail'); }
    }
    if (id === 'kaew') {
      const c = this.R.contact, e = g.ents.list.find((x) => x.id === c);
      if (e && g.social.level(c) >= 1 && dist(P, e.pos.x, e.pos.z) < 6) this.ask('kaew');
    }
  }

  // HUD
  trackerHTML() {
    const g = this.g;
    if (this.done) return g.inCampNow ? `<b>🏕️ ${esc(this.camp.name)}</b><br><small>เขตปลอดภัย — ผู้ติดเชื้อเข้ามาไม่ได้</small>` : '';
    const t = this.target(), P = g.player.pos;
    let nav = '';
    if (t) {
      const d = dist(P, t.x, t.z) * 50; // 1 หน่วย ≈ 50 เมตร
      const ang = Math.atan2(t.x - P.x, t.z - P.z) - (g.camYaw + Math.PI);
      nav = `<div class="qnav"><span class="qarrow" style="transform:rotate(${-ang}rad)">⬆</span> ${esc(t.name)} · ${d >= 1000 ? (d / 1000).toFixed(1) + ' กม.' : Math.round(d) + ' ม.'}</div>`;
    }
    const extra = this.cur.id === 'tower' && this.defend > 0 ? `<div class="qdef">🛡️ ป้องกันเสา: ${Math.ceil(this.defend)} วินาที</div>` : '';
    const check = this.cur.id === 'prepare' ? `<small>${hasWeapon(g) ? '✅' : '⬜'} อาวุธ · ${Math.min(2, g.inv.clean_water || 0)}/2 💧 น้ำต้มสุก</small>` : '';
    return `<small class="qn">ภารกิจ ${this.step + 1}/${this.steps.length} · 📍 ${esc(TOWNS.find((t) => t.key === this.R.town)?.name || '')}</small><b>${esc(this.cur.title)}</b><p>${esc(this.cur.desc)}</p>${check}${extra}${nav}`;
  }

  toJSON() { return { step: this.step, route: this.route }; }
  // เส้นทางมาจากเซฟ/เซิร์ฟเวอร์ · เซฟเก่าที่ไม่มีเส้นทาง = classic (บางแสน → สัตหีบ)
  load(s) { if (!s) return; this.setRoute(s.route || 'classic'); this.step = Math.min(this.steps.length, s.step || 0); this.shownIntro = true; if (this.done) this.g.world.openGate(this.camp.key); if (this.step === 3 && !this.g.hasItem('car_battery')) this.step = 2; }
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export { inCamp, ITEMS };
