import { newRel, relLevel, canDo, applyAction, ACTIONS, REL_LEVELS } from './social-core.js';
import { ITEMS, NPCS, PREG_MS, CHILD_MS, CHILD_NAMES } from './data.js';

const NPC_LINES = [
  ['...คุณเป็นใคร อย่าเข้ามาใกล้นักนะ', 'ระวังตัวด้วย ข้างนอกนั่นอันตราย'],
  ['เจอกันอีกแล้วนะ ยังรอดอยู่ใช่ไหม', 'ได้ยินว่าทางพัทยามีผู้ติดเชื้อเยอะมาก'],
  ['ดีใจที่เจอเธอ วันนี้หาอะไรได้บ้าง?', 'อยู่ด้วยกันปลอดภัยกว่าเยอะเลย'],
  ['ถ้าไม่มีเธอ ฉันคงไม่รอดถึงวันนี้', 'สัญญานะว่าจะไม่ทิ้งกัน'],
  ['คิดถึงจัง... กลับมาแล้วเหรอ', 'สักวันโลกจะดีขึ้น แล้วเราจะสร้างบ้านด้วยกัน'],
  ['ครอบครัวเราต้องรอดไปด้วยกัน', 'วันนี้ฉันเก็บของมาเผื่อแล้วนะ'],
];

export class Social {
  constructor(game) {
    this.g = game;
    this.rels = {};       // otherId -> rel
    this.localPreg = {};  // แม่(id) -> {partner, start}  (คู่กับ NPC)
    this.serverPreg = {};
    this.localChildren = []; this.serverChildren = [];
    this.pending = null;  // คำขอที่รอเราตอบ (ออนไลน์)
    this.bondT = 0; this.teenT = 0;
  }
  get preg() { return { ...this.localPreg, ...this.serverPreg }; }
  get children() { return [...this.localChildren, ...this.serverChildren.filter((c) => c.parents.includes(this.g.id))]; }

  rel(id) { return (this.rels[id] ||= newRel()); }
  level(id) { return relLevel(this.rels[id]); }
  isNpc(id) { return id.startsWith('npc_'); }
  person(id) {
    if (id === this.g.id) return { id, sex: this.g.profile.sex, name: this.g.profile.name, pregnant: !!this.preg[id] };
    const n = NPCS.find((x) => x.id === id);
    if (n) return { id, sex: n.sex, name: n.name, pregnant: !!this.preg[id] };
    const r = this.g.ents.remotes.get(id);
    return r ? { id, sex: r.sex, name: r.name, pregnant: !!this.preg[id] } : null;
  }
  nearShelter() { return !!this.g.world.nearStructure(this.g.player.pos.x, this.g.player.pos.z, 'shelter', 9); }

  // ทำการกระทำทางสังคม
  act(action, id, extra = {}) {
    const ui = this.g.ui, me = this.person(this.g.id), other = this.person(id);
    if (!other) return;
    const r = this.rel(id);
    const chk = canDo(action, r, me, other);
    if (!chk.ok) return ui.toast(chk.why, 'warn');
    if (ACTIONS[action].shelter && !this.nearShelter()) return ui.toast('ต้องอยู่ใกล้เพิงพัก (สร้างจากเมนูประดิษฐ์) ก่อน', 'warn');
    if (action === 'marry' && !this.g.hasItem('ring')) return ui.toast('ต้องมี "แหวนเศษเหล็ก" (ประดิษฐ์ได้ที่ระดับประดิษฐ์ 3)', 'warn');
    if (action === 'gift') {
      const { item } = extra; if (!this.g.hasItem(item) || ITEMS[item]?.quest) return;
      const liked = this.isNpc(id) && NPCS.find((n) => n.id === id).likes === item;
      const value = Math.min(20, (ITEMS[item].value || 1) * (liked ? 3 : 1));
      if (!this.isNpc(id)) {
        // เซิร์ฟเวอร์ย้ายของจากกระเป๋าจริงให้ผู้รับเอง / เล่นผ่านลิงก์: หักในเครื่องแล้วให้โฮสต์ส่งต่อ
        if (!this.g.auth.server) this.g.removeItem(item, 1);
        return this.g.net.send({ t: 'act', action, target: id, item, qty: 1, value });
      }
      const res = this.g.auth.do('gift', { to: id, k: item });
      if (res?.err) return;
      r.pts += value;
      ui.toast(liked ? `${other.name}: "ว้าว! ${ITEMS[item].name} ของที่ชอบเลย ขอบคุณมาก!" (+${value})` : `${other.name} รับ ${ITEMS[item].name} ไว้ (+${value})`);
      return this.changed(id);
    }
    if (action === 'heal') {
      const item = ['bandage', 'herbal_med', 'antibiotic', 'splint'].find((i) => this.g.hasItem(i));
      if (!item) return ui.toast('ไม่มีผ้าพันแผลหรือยา', 'warn');
      if (!this.isNpc(id)) {
        if (!this.g.auth.server) this.g.removeItem(item, 1);
        return this.g.net.send({ t: 'act', action, target: id, item });
      }
      const res = this.g.auth.do('heal'); if (res?.err) return;
      applyAction('heal', r); ui.toast(`คุณใช้ ${ITEMS[item].name} รักษา ${other.name}`);
      return this.changed(id);
    }
    if (action === 'follow') {
      const e = this.g.ents.list.find((x) => x.id === id); if (!e) return;
      e.follow = !e.follow; ui.toast(e.follow ? `${other.name} จะร่วมเดินทางกับคุณ` : `${other.name} จะรออยู่ที่นี่`);
      if (this.g.net.online) this.g.net.send({ t: 'npcfollow', idx: NPCS.findIndex((n) => n.id === id), on: e.follow });
      if (!e.follow) e.home = { x: e.pos.x, z: e.pos.z };
      return;
    }
    if (!this.isNpc(id)) return this.g.net.send({ t: 'act', action, target: id });
    // ---- NPC ----
    if (ACTIONS[action].consent) {
      const chance = { propose: r.pts >= 170 ? 0.95 : 0.7, marry: 0.95, baby: r.bond === 'family' ? 0.9 : 0.6, adopt: 0.95 }[action] ?? 0.8;
      if (Math.random() > chance) { r.pts += 1; ui.toast(`${other.name}: "ขอเวลาคิดอีกหน่อยนะ..."`); return this.changed(id); }
      if (action === 'marry') { const res = this.g.auth.do('ring'); if (res?.err) return; }
    }
    applyAction(action, r);
    const msgs = {
      talk: `${other.name}: "${NPC_LINES[relLevel(r)][Math.floor(Math.random() * 2)]}"`,
      hug: `คุณกอด ${other.name} ❤️ รู้สึกอุ่นใจขึ้น`,
      propose: `💕 ${other.name} ตอบตกลง! ตอนนี้คุณเป็นคนรักกันแล้ว`,
      marry: `💍 คุณกับ ${other.name} แต่งงานกันใต้ฟ้าที่กำลังล่มสลาย ตอนนี้เป็นครอบครัวเดียวกันแล้ว`,
      breakup: `💔 คุณกับ ${other.name} ตัดสินใจแยกทางกัน`,
    };
    if (action === 'baby') {
      const mother = me.sex === 'f' ? me.id : id;
      this.localPreg[mother] = { partner: mother === me.id ? id : me.id, start: Date.now() };
      ui.toast(mother === me.id ? `🤰 คุณตั้งครรภ์ลูกของ ${other.name}! ดูแลตัวเองให้ดี (กินมากขึ้น)` : `🤰 ${other.name} ตั้งครรภ์ลูกของคุณ!`, 'love');
    } else if (action === 'adopt') this.birth([me.id, id], true);
    else ui.toast(msgs[action] || 'ตกลง', action === 'propose' || action === 'marry' ? 'love' : '');
    if (action === 'talk') this.g.gainXp('survival', 1);
    this.changed(id);
  }

  changed(id) {
    const r = this.rel(id), lvl = relLevel(r);
    if (r._lastLvl !== undefined && lvl > r._lastLvl) this.g.ui.toast(`ความสัมพันธ์กับ ${this.person(id)?.name} เลื่อนเป็น "${REL_LEVELS[lvl].name}"`, 'love');
    r._lastLvl = lvl;
    this.g.ui.refreshPanels();
  }

  birth(parents, adopted = false) {
    const c = { id: 'c' + Date.now().toString(36), name: CHILD_NAMES[Math.floor(Math.random() * CHILD_NAMES.length)], sex: Math.random() < 0.5 ? 'm' : 'f', parents, born: Date.now(), adopted };
    this.localChildren.push(c);
    this.g.ui.toast(adopted ? `🧸 รับ "${c.name}" มาเป็นลูกแล้ว` : `👶 "${c.name}" ลืมตาดูโลกแล้ว!`, 'love');
    this.g.ents.syncChildren(this.children);
  }

  // ---- ข้อความจากเซิร์ฟเวอร์ ----
  onNet(m) {
    const ui = this.g.ui;
    if (m.t === 'rel') { const old = this.rels[m.other]; m.rel._lastLvl = old?._lastLvl; this.rels[m.other] = m.rel; this.changed(m.other); }
    if (m.t === 'preg') {
      const had = !!this.serverPreg[this.g.id]; this.serverPreg = m.preg;
      if (!had && m.preg[this.g.id]) ui.toast('🤰 คุณตั้งครรภ์แล้ว! ดูแลตัวเองดีๆ', 'love');
    }
    if (m.t === 'children') { this.serverChildren = m.children; this.g.ents.syncChildren(this.children); }
    if (m.t === 'request') {
      ui.confirm(`${m.name} ${m.label.replace(/^\S+\s/, '')} กับคุณ — ตอบตกลงไหม?`, (yes) => this.g.net.send({ t: 'respond', reqId: m.reqId, accept: yes }));
    }
  }

  tick(dt) {
    const g = this.g, P = g.player.pos;
    this.bondT += dt;
    if (this.bondT > 5) {
      this.bondT = 0;
      for (const e of g.ents.list) if (e.kind === 'npc' && !e.dead && e.pos.distanceTo(P) < 10) { this.rel(e.id).pts += 0.4; this.changed(e.id); }
    }
    for (const [mother, pr] of Object.entries(this.localPreg)) if (Date.now() - pr.start >= PREG_MS) {
      delete this.localPreg[mother]; this.birth([mother, pr.partner]);
    }
    this.teenT += dt;
    if (this.teenT > 120) {
      this.teenT = 0;
      for (const c of this.children) if (Date.now() - c.born > CHILD_MS) {
        g.auth.do('childgift', { id: c.id, name: c.name });
      }
    }
  }

  // ครอบครัว/คนรักอยู่ใกล้ = กำลังใจ
  lovedNearby() {
    const P = this.g.player.pos;
    for (const e of this.g.ents.list) if (!e.dead && ((e.kind === 'npc' && this.level(e.id) >= 4) || e.kind === 'child') && e.pos.distanceTo(P) < 12) return true;
    for (const r of this.g.ents.remotes.values()) if (this.level(r.id) >= 4 && r.pos.distanceTo(P) < 12) return true;
    return this.g.pets.some((p) => p.traits?.includes('calm') && !p.stay) && this.g.ents.list.some((e) => e.kind === 'pet' && !e.dead && e.pet.traits.includes('calm') && e.pos.distanceTo(P) < 12);
  }

  toJSON() {
    const npcRels = Object.fromEntries(Object.entries(this.rels).filter(([k]) => this.isNpc(k)));
    return { rels: npcRels, localPreg: this.localPreg, localChildren: this.localChildren };
  }
  load(s) { if (!s) return; Object.assign(this.rels, s.rels || {}); this.localPreg = s.localPreg || {}; this.localChildren = s.localChildren || []; }
}
