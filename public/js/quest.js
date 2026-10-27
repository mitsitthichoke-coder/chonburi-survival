// ภารกิจหลัก "ตามหาศูนย์อพยพสัตหีบ"
import { QUEST_SPOTS, ITEMS } from './data.js';
import { LAKES } from './terrain.js';
import { inCamp } from './citygen.js';

const S = QUEST_SPOTS;
const dist = (P, x, z) => Math.hypot(P.x - x, P.z - z);
const WEAPONS = ['spear', 'stone_axe', 'machete', 'steel_axe', 'steel_spear', 'bone_spear', 'king_hammer'];
const hasWeapon = (g) => Object.keys(g.inv).some((k) => g.inv[k] > 0 && WEAPONS.includes(k.split('~')[0]));
const DEFEND_SECS = 60;

export const STEPS = [
  { id: 'radio', title: 'สัญญาณจากวิทยุ', desc: `ไปที่${S.radio.name} แล้วหยิบวิทยุสื่อสาร`, target: () => S.radio },
  { id: 'prepare', title: 'เตรียมตัวก่อนออกเดินทาง', desc: 'ต้องมีอาวุธ 1 ชิ้น (หอก/ขวาน/มีดพร้า) และน้ำต้มสุก 2 ขวด — ตักน้ำจากอ่างแล้วต้มที่กองไฟ', target: (g) => { const P = g.player.pos; const l = [...LAKES].sort((a, b) => dist(P, ...a.p) - dist(P, ...b.p))[0]; return { x: l.p[0], z: l.p[1], name: l.name }; } },
  { id: 'battery', title: 'หาแหล่งพลังงาน', desc: 'วิทยุแบตหมด! ค้นรถร้างบนถนนเพื่อหาแบตเตอรี่รถยนต์ — ตามลำแสงสีเหลืองไปที่รถ แล้วยืนข้างรถกด E', target: (g) => { const P = g.player.pos; const c = g.world.loot.filter((l) => l.kind === 'car' && !l.until).sort((a, b) => dist(P, a.x, a.z) - dist(P, b.x, b.z))[0]; return c ? { x: c.x, z: c.z, name: 'รถร้างที่ใกล้ที่สุด' } : null; } },
  { id: 'tower', title: 'ส่งสัญญาณขอความช่วยเหลือ', desc: `ไปที่${S.tower.name} ต่อแบตเตอรี่แล้วส่งสัญญาณ (เสียงจะเรียกผู้ติดเชื้อมา ต้องป้องกันเสาให้ได้ ${DEFEND_SECS} วินาที)`, target: () => S.tower },
  { id: 'kaew', title: 'ตามหา "แก้ว" อดีตทหารเรือ', desc: 'ศูนย์อพยพตอบกลับมาแล้ว! แก้วที่สัตหีบรู้รหัสเปิดประตูค่าย — ทำความรู้จักเธอจนถึงระดับ "คุ้นเคย" (เธอชอบน้ำต้มสุก)', target: (g) => { const e = g.ents.list.find((x) => x.id === 'npc_kaew'); return e ? { x: e.pos.x, z: e.pos.z, name: 'แก้ว' } : null; } },
  { id: 'gate', title: 'ศูนย์อพยพสัตหีบ', desc: `ไปที่ประตูของ${S.camp.name} แล้วใส่รหัส`, target: () => ({ x: S.camp.x, z: S.camp.z - S.camp.size / 2 - 2, name: 'ประตูค่าย' }) },
];

export class Quest {
  constructor(game) { this.g = game; this.step = 0; this.defend = 0; this.hordeT = 0; this.shownIntro = false; }
  get done() { return this.step >= STEPS.length; }
  get cur() { return STEPS[this.step]; }
  target() { return this.done ? null : this.cur.target(this.g); }

  // ขั้นภารกิจเปลี่ยนแล้ว (ระบบเศรษฐกิจ/เซิร์ฟเวอร์ยืนยันแล้ว) → แสดงเรื่องราว
  onStep(key) {
    const g = this.g;
    const M = {
      radio: '📻 วิทยุ: "...ซ่า... ถึงผู้รอดชีวิตทุกคน ศูนย์อพยพที่ฐานทัพเรือสัตหีบยังเปิดอยู่ ถ้าได้ยิน ให้ส่งสัญญาณจากเสาส่งศรีราชา... ซ่า..."',
      prepare: '🎒 พร้อมแล้ว! แต่วิทยุเงียบไป... แบตเตอรี่คงหมด',
      battery: '🔋 เจอแบตเตอรี่รถที่ยังมีไฟ! เอาไปต่อกับเสาส่งสัญญาณที่ศรีราชา',
      tower: '📡 วิทยุ: "...ได้รับสัญญาณแล้ว! ผู้รอดชีวิตที่ศรีราชา มุ่งหน้าไปสัตหีบ ตามหา \'แก้ว\' เธอรู้รหัสประตู..."',
      kaew: '🎖️ แก้ว: "เธอผ่านเสาส่งศรีราชามาได้เหรอ? เก่งมาก... รหัสประตูคือ 2-5-1-1 ไปที่ค่ายทางตะวันออกของเมืองสัตหีบนะ"',
      gate: '🎖️ แก้ว: "รหัสถูกต้อง! ยินดีต้อนรับสู่ศูนย์อพยพสัตหีบ ที่นี่ปลอดภัยจากผู้ติดเชื้อ — พักผ่อนให้เต็มที่ แล้วช่วยกันสร้างโลกใหม่นะ"',
    };
    if (key === 'transmit') {
      g.sfx.play('radio'); this.defend = DEFEND_SECS; this.hordeT = 0;
      g.ui.toast(`📡 กำลังส่งสัญญาณ... เสียงดังเรียกผู้ติดเชื้อ! ป้องกันเสาไว้ ${DEFEND_SECS} วินาที`, 'warn');
      return this.spawnHorde(6);
    }
    if (key === 'radio') g.sfx.play('radio');
    if (key === 'gate') {
      g.world.openGate(); g.sfx.play('gate');
      g.spawnPoint = { x: S.camp.x, z: S.camp.z + 4 };
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
    if (id === 'radio' && dist(P, S.radio.x + 1.6, S.radio.z) < 3) return { text: 'หยิบวิทยุสื่อสาร', act: () => this.takeRadio() };
    if (id === 'tower' && dist(P, S.tower.x + 3, S.tower.z) < 4.5 && this.defend <= 0) return { text: g.hasItem('car_battery') ? 'ต่อแบตเตอรี่แล้วส่งสัญญาณ' : 'ต้องมีแบตเตอรี่รถยนต์ก่อน', act: () => this.transmit() };
    const gate = STEPS[5].target();
    if (id === 'gate' && dist(P, gate.x, gate.z) < 4.5) return { text: 'ใส่รหัสเปิดประตูค่าย', act: () => this.openGate() };
    return null;
  }

  takeRadio() { this.g.auth.do('quest', { a: 'radio' }); }
  transmit() {
    if (!this.g.hasItem('car_battery')) return this.g.ui.toast('ต้องค้นรถร้างหาแบตเตอรี่รถยนต์ก่อน', 'warn');
    this.g.auth.do('quest', { a: 'transmit' });
  }
  spawnHorde(n) {
    const g = this.g, x = S.tower.x, z = S.tower.z;
    if (g.net.online) return g.net.send({ t: 'horde', x, z, n });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 12;
      const e = g.ents.spawnMob('zombie', x + Math.cos(a) * r, z + Math.sin(a) * r); e.alert = 30;
    }
  }
  openGate() { this.g.auth.do('quest', { a: 'gate' }); }

  onMeet(id) {
    if (this.done || this.cur.id !== 'kaew' || id !== 'npc_kaew') return;
    if (this.g.social.level(id) < 1) this.g.ui.toast('แก้ว: "ฉันยังไม่รู้จักเธอดีพอจะบอกรหัส... อยู่ด้วยกันสักพัก หรือมีน้ำสะอาดไหม?"');
  }

  update(dt) {
    const g = this.g, P = g.player.pos;
    if (!this.shownIntro && this.step === 0) { this.shownIntro = true; g.ui.chat('', '📻 มีเสียงวิทยุดังมาจากป้อมยามชายหาดบางแสน... (ดูภารกิจที่มุมซ้าย)', true); }
    if (this.done) return;
    const id = this.cur.id;
    if (id === 'prepare' && hasWeapon(g) && g.hasItem('clean_water', 2)) this.ask('prepare');
    if (id === 'tower' && this.defend > 0) {
      if (dist(P, S.tower.x, S.tower.z) < 30 && !g.dead) {
        this.defend -= dt; this.hordeT += dt;
        if (this.hordeT > 20) { this.hordeT = 0; this.spawnHorde(3); }
        if (this.defend <= 0) this.ask('tower');
      } else if (g.dead || dist(P, S.tower.x, S.tower.z) > 60) { this.defend = 0; g.ui.toast('สัญญาณขาดหาย! กลับไปที่เสาแล้วลองใหม่ (ต้องหาแบตเตอรี่ใหม่)', 'warn'); this.ask('fail'); }
    }
    if (id === 'kaew') {
      const e = g.ents.list.find((x) => x.id === 'npc_kaew');
      if (e && g.social.level('npc_kaew') >= 1 && dist(P, e.pos.x, e.pos.z) < 6) this.ask('kaew');
    }
  }

  // HUD
  trackerHTML() {
    const g = this.g;
    if (this.done) return g.inCampNow ? '<b>🏕️ ศูนย์อพยพสัตหีบ</b><br><small>เขตปลอดภัย — ผู้ติดเชื้อเข้ามาไม่ได้</small>' : '';
    const t = this.target(), P = g.player.pos;
    let nav = '';
    if (t) {
      const d = dist(P, t.x, t.z) * 50; // 1 หน่วย ≈ 50 เมตร
      const ang = Math.atan2(t.x - P.x, t.z - P.z) - (g.camYaw + Math.PI);
      nav = `<div class="qnav"><span class="qarrow" style="transform:rotate(${-ang}rad)">⬆</span> ${esc(t.name)} · ${d >= 1000 ? (d / 1000).toFixed(1) + ' กม.' : Math.round(d) + ' ม.'}</div>`;
    }
    const extra = this.cur.id === 'tower' && this.defend > 0 ? `<div class="qdef">🛡️ ป้องกันเสา: ${Math.ceil(this.defend)} วินาที</div>` : '';
    const check = this.cur.id === 'prepare' ? `<small>${hasWeapon(g) ? '✅' : '⬜'} อาวุธ · ${Math.min(2, g.inv.clean_water || 0)}/2 💧 น้ำต้มสุก</small>` : '';
    return `<small class="qn">ภารกิจ ${this.step + 1}/${STEPS.length}</small><b>${esc(this.cur.title)}</b><p>${esc(this.cur.desc)}</p>${check}${extra}${nav}`;
  }

  toJSON() { return { step: this.step }; }
  load(s) { if (!s) return; this.step = Math.min(STEPS.length, s.step || 0); this.shownIntro = true; if (this.done) this.g.world.openGate(); if (this.step === 3 && !this.g.hasItem('car_battery')) this.step = 2; }
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export { inCamp, ITEMS };
