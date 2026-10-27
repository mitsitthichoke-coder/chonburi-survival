// ตรรกะฝั่งเซิร์ฟเวอร์ที่ใช้ร่วมกัน: รันได้ทั้งบน Node (server.js) และในเบราว์เซอร์ของผู้เล่นที่เป็นโฮสต์ (room-net.js)
// ดูแล: ผู้เล่น, ทรัพยากร/เสบียง, สิ่งก่อสร้าง, ความสัมพันธ์, การตั้งครรภ์, ลูก และผู้ติดเชื้อ (AI ฝั่งเซิร์ฟเวอร์)
import { pairKey, newRel, canDo, applyAction, ACTIONS, relName } from './social-core.js';
import { PREG_MS, CHILD_NAMES, DAY_MS, TOWNS, NPCS, WILD, pickWild, inTownAt, FIRE_SAFE, nearFireOf, ITEMS, REGION_FAUNA, BODY_R, MELEE_MAX, HEARTH_MS } from './data.js';
import { relLevel, giftValue } from './social-core.js';
import { applyOp, collidersFor, refundFor, flowersNear, accessFor, canDemolish, safeBaseAt, fenceClosed, inBox } from './building-core.js';
import { heightAt, waterAt } from './terrain.js';
import { getLayout, collideBoxes, inCamp } from './citygen.js';
import { ZTIERS, BOSS, BOSS_EVERY, BOSS_CHANCE, pickTier, zombieHp, SOLDIER, ADMIRAL, ADMIRAL_EVERY } from './zombies-core.js';
import { NAVY, inNavy, landmark } from './landmarks.js';
const SHEEP_FARM = landmark('sheep');

export const emptyState = () => ({ startTime: Date.now(), res: {}, loot: {}, structures: [], rels: {}, preg: {}, children: [], profiles: {}, friends: {}, freq: {} });

export class WorldCore {
  // send(id, msg) ส่งถึงผู้เล่นคนเดียว · broadcast(msg, exceptId) ส่งถึงทุกคน
  // relayState=false เมื่อการส่งตำแหน่งผู้เล่นทำผ่านช่องทางอื่น (presence ของ room)
  constructor({ state, send, broadcast, relayState = true, onDirty = () => {}, allowTheme = null }) {
    this.db = { ...emptyState(), ...(state || {}) }; this.allowTheme = allowTheme;
    this.send = send; this.broadcast = broadcast; this.relayState = relayState; this.onDirty = onDirty;
    this.players = new Map(); this.requests = new Map(); this.reqSeq = 1;
    this.zombies = new Map(); this.zseq = 1;
    const L = getLayout(); this.baseWalls = [...L.buildings, ...L.fence, ...Object.values(L.gates)];
    this.rebuildWalls();
    this.tSpawn = 0; this.tZs = 0; this.tSlow = 0; this.tMs = 0; this.tBoss = BOSS_EVERY * 0.5;
    // สัตว์ป่า สัตว์จรจัด และ NPC — คำนวณที่นี่เพื่อให้ทุกคนเห็นตัวเดียวกัน
    this.fauna = new Map(); this.fseq = 500000;
    NPCS.forEach((n, i) => {
      const t = TOWNS.find((x) => x.key === n.town);
      let x = t.x, z = t.z;
      for (let k = 0; k < 40; k++) { const a = t.x + (Math.random() - 0.5) * 24, b = t.z + (Math.random() - 0.5) * 24; if (this.validSpot(a, b)) { x = a; z = b; break; } }
      this.fauna.set(100000 + i, { id: 100000 + i, k: 'npc', idx: i, x, z, home: { x: t.x, z: t.z }, ry: 0, spd: 0, t: 0, hp: 1e9 });
    });
  }

  dirty() { this.onDirty(); }
  pub(p) { return { id: p.id, name: p.name, sex: p.sex, look: p.look, p: p.p, ry: p.ry, anim: p.anim, hp: p.hp, pets: p.pets }; }
  // ---------- แลกของระหว่างผู้เล่น ----------
  // ขอแลก → อีกฝ่ายตอบรับ → ใส่ของเสนอทั้งสองฝ่าย → กดยืนยันครบทั้งคู่ → สลับของพร้อมกัน (ถ้าแก้ของ ต้องยืนยันใหม่)
  tradeOf(id) { for (const t of (this.trades ||= new Map()).values()) if (t.a === id || t.b === id) return t; return null; }
  tradeSend(t) { for (const [me, them] of [[t.a, t.b], [t.b, t.a]]) this.send(me, { t: 'tradestate', id: t.id, with: them, name: this.players.get(them)?.name || '?', mine: t.offer[me], theirs: t.offer[them], okMine: !!t.ok[me], okTheirs: !!t.ok[them] }); }
  tradeEnd(t, why) { this.trades.delete(t.id); for (const p of [t.a, t.b]) this.send(p, { t: 'tradeend', why }); }
  canOffer() { return true; }          // เซิร์ฟเวอร์สาธารณะตรวจของจริงใน server-econ
  tradeApply(id, take, give) { this.send(id, { t: 'tradedone', take, give }); } // เล่นผ่านลิงก์: แต่ละเครื่องปรับกระเป๋าเอง
  tradeMsg(id, m) {
    const me = this.players.get(id); this.trades ||= new Map();
    const say = (who, text) => this.send(who, { t: 'friendmsg', text });
    let t = this.tradeOf(id);
    switch (m.a) {
      case 'req': {
        const o = this.players.get(String(m.to)); if (!o || o.id === id) return;
        if (t || this.tradeOf(o.id)) return say(id, 'มีคนกำลังแลกของอยู่ ลองใหม่ภายหลัง');
        if (Math.hypot(o.p[0] - me.p[0], o.p[2] - me.p[2]) > 12) return say(id, 'ต้องอยู่ใกล้กัน (ไม่เกิน ~600 ม.) จึงจะแลกของได้');
        (this.tradeReq ||= new Map()).set(o.id + '|' + id, Date.now());
        this.send(o.id, { t: 'tradereq', from: id, name: me.name }); return say(id, `📨 ส่งคำขอแลกของถึง ${o.name} แล้ว`);
      }
      case 'accept': {
        const from = String(m.to), k = id + '|' + from, at = this.tradeReq?.get(k); if (!at || Date.now() - at > 60000) return say(id, 'คำขอหมดอายุแล้ว');
        this.tradeReq.delete(k); if (t || this.tradeOf(from) || !this.players.get(from)) return;
        t = { id: 'tr' + (this.reqSeq++), a: from, b: id, offer: { [from]: {}, [id]: {} }, ok: {} }; this.trades.set(t.id, t); return this.tradeSend(t);
      }
      case 'decline': { this.tradeReq?.delete(id + '|' + m.to); return say(String(m.to), `${me.name} ไม่สะดวกแลกของตอนนี้`); }
      case 'offer': {
        if (!t) return;
        const items = {}; for (const [k, q] of Object.entries(m.items || {}).slice(0, 12)) { const n = Math.floor(+q); if (n > 0 && n < 10000) items[String(k).slice(0, 40)] = n; }
        if (!this.canOffer(id, items)) return say(id, 'ของที่เสนอไม่ครบตามที่มีในกระเป๋า');
        t.offer[id] = items; t.ok = {}; return this.tradeSend(t);
      }
      case 'ok': {
        if (!t) return; t.ok[id] = true;
        if (!(t.ok[t.a] && t.ok[t.b])) return this.tradeSend(t);
        if (!this.canOffer(t.a, t.offer[t.a]) || !this.canOffer(t.b, t.offer[t.b])) return this.tradeEnd(t, 'ของของอีกฝ่ายไม่ครบ ยกเลิกการแลก');
        const A = t.offer[t.a], Bo = t.offer[t.b];
        this.tradeApply(t.a, A, Bo); this.tradeApply(t.b, Bo, A);
        return this.tradeEnd(t, '🤝 แลกของสำเร็จ!');
      }
      case 'cancel': if (t) this.tradeEnd(t, `${me.name} ยกเลิกการแลกของ`); return;
    }
  }
  // ---------- ระบบเพื่อน ----------
  friendIds(id) { const out = []; for (const k of Object.keys(this.db.friends ||= {})) { const [a, b] = k.split('|'); if (a === id) out.push(b); else if (b === id) out.push(a); } return out; }
  isFriend(a, b) { return !!this.db.friends?.[pairKey(a, b)]; }
  sendFriends(id) {
    if (!this.players.has(id)) return;
    const list = this.friendIds(id).map((f) => { const p = this.players.get(f); return { id: f, name: p?.name || this.db.profiles[f]?.name || '?', online: !!p, x: p?.p ? Math.round(p.p[0]) : null, z: p?.p ? Math.round(p.p[2]) : null }; });
    const reqs = Object.keys(this.db.freq?.[id] || {}).map((f) => ({ id: f, name: this.db.profiles[f]?.name || '?' }));
    this.send(id, { t: 'friends', list, reqs });
  }
  // ธีมทั้งเซิร์ฟเวอร์ (เปลี่ยนได้เฉพาะแอดมิน/เจ้าของ/โฮสต์)
  setThemeAll(v) {
    if (!['apocalypse', 'halloween'].includes(v)) return false;
    this.db.theme = v; this.broadcast({ t: 'theme', v }); this.dirty(); return true;
  }
  // ---------- แชทแยกช่อง: all ทุกคน · party ปาร์ตี้ · family ครอบครัว · pm กระซิบส่วนตัว ----------
  chatMsg(id, me, m) {
    const text = String(m.text || '').slice(0, 200), ch = ['party', 'family', 'pm'].includes(m.ch) ? m.ch : 'all';
    const out = { t: 'chat', from: id, name: me.name, text, ch };
    if (ch === 'all') return this.broadcast(out);
    if (ch === 'party') { const P = this.partyOf(id); if (!P) return this.send(id, { t: 'notice', text: 'ยังไม่ได้อยู่ในปาร์ตี้ — ชวนเพื่อนจากหน้าผู้เล่น (👥 ชวนเข้าปาร์ตี้)' }); for (const pid of P.members) this.send(pid, out); return; }
    if (ch === 'family') {
      const fam = [...this.players.keys()].filter((o) => o === id || this.getRel(id, o)?.bond === 'family');
      if (fam.length < 2) return this.send(id, { t: 'notice', text: 'ยังไม่มีครอบครัวที่ออนไลน์ (แต่งงานกันก่อนจึงเป็นครอบครัว)' });
      for (const o of fam) this.send(o, out); return;
    }
    // กระซิบ: ระบุ id หรือชื่อผู้รับ
    const to = this.players.has(m.to) ? m.to : [...this.players.values()].find((p) => p.name === m.to)?.id;
    if (!to) return this.send(id, { t: 'notice', text: `ไม่พบผู้เล่น "${m.to || ''}" ที่ออนไลน์` });
    this.send(to, { ...out, toName: this.players.get(to).name }); if (to !== id) this.send(id, { ...out, toName: this.players.get(to).name });
  }
  // ---------- ปาร์ตี้ (สูงสุด 6 คน) ----------
  partyOf(id) { const pid = (this.partyIdx ||= new Map()).get(id); return pid ? this.parties.get(pid) : null; }
  partySync(P) {
    const st = P ? { t: 'party', id: P.id, leader: P.leader, members: [...P.members].map((i) => ({ id: i, name: this.players.get(i)?.name || '?' })) } : null;
    if (P) for (const i of P.members) this.send(i, st);
  }
  partyMsg(id, m) {
    this.parties ||= new Map(); this.partyIdx ||= new Map();
    const me = this.players.get(id); if (!me) return;
    const say = (who, text) => this.send(who, { t: 'notice', text });
    let P = this.partyOf(id);
    switch (m.a) {
      case 'invite': {
        const to = String(m.to || ''), other = this.players.get(to); if (!other || to === id) return;
        if (this.partyOf(to)) return say(id, `${other.name} อยู่ในปาร์ตี้อื่นแล้ว`);
        if (!P) { P = { id: 'P' + Date.now().toString(36) + id.slice(-3), leader: id, members: new Set([id]), inv: new Set() }; this.parties.set(P.id, P); this.partyIdx.set(id, P.id); this.partySync(P); }
        if (P.members.size >= 6) return say(id, 'ปาร์ตี้เต็มแล้ว (6 คน)');
        P.inv.add(to); this.send(to, { t: 'partyinv', from: id, name: me.name, pid: P.id }); return say(id, `📨 ชวน ${other.name} เข้าปาร์ตี้แล้ว`);
      }
      case 'accept': {
        const Q = this.parties.get(m.pid); if (!Q || !Q.inv.has(id)) return say(id, 'คำชวนหมดอายุแล้ว');
        if (P) this.partyMsg(id, { a: 'leave' });
        if (Q.members.size >= 6) return say(id, 'ปาร์ตี้เต็มแล้ว');
        Q.inv.delete(id); Q.members.add(id); this.partyIdx.set(id, Q.id); this.partySync(Q);
        for (const i of Q.members) say(i, `👥 ${me.name} เข้าร่วมปาร์ตี้`); return;
      }
      case 'kick': if (!P || P.leader !== id || !P.members.has(m.to) || m.to === id) return; say(m.to, '👋 คุณถูกนำออกจากปาร์ตี้'); return this.partyMsg(m.to, { a: 'leave', quiet: true });
      case 'leave': {
        if (!P) return;
        P.members.delete(id); this.partyIdx.delete(id); this.send(id, { t: 'party', id: null });
        if (P.members.size <= 1) { for (const i of P.members) { this.partyIdx.delete(i); this.send(i, { t: 'party', id: null }); say(i, '👥 ปาร์ตี้ถูกยุบ (เหลือคนเดียว)'); } this.parties.delete(P.id); return; }
        if (P.leader === id) P.leader = [...P.members][0];
        this.partySync(P); if (!m.quiet) for (const i of P.members) say(i, `👋 ${me.name} ออกจากปาร์ตี้`); return;
      }
    }
  }
  friendMsg(id, m) {
    const me = this.players.get(id), to = String(m.to || ''), F = (this.db.freq ||= {}), say = (who, text) => this.send(who, { t: 'friendmsg', text });
    const other = this.players.get(to)?.name || this.db.profiles[to]?.name;
    if (!other || to === id) return;
    switch (m.a) {
      case 'req': {
        if (this.isFriend(id, to)) return say(id, `คุณกับ ${other} เป็นเพื่อนกันอยู่แล้ว`);
        if (F[id]?.[to]) return this.friendMsg(id, { a: 'accept', to }); // อีกฝ่ายขอมาก่อนแล้ว = ตกลงเลย
        if (Object.keys(F[to] || {}).length >= 30) return say(id, 'อีกฝ่ายมีคำขอค้างอยู่มากเกินไป');
        (F[to] ||= {})[id] = Date.now();
        this.send(to, { t: 'friendreq', from: id, name: me.name }); this.sendFriends(to);
        say(id, `📨 ส่งคำขอเป็นเพื่อนถึง ${other} แล้ว`); break;
      }
      case 'accept': {
        if (!F[id]?.[to]) return;
        delete F[id][to]; if (F[to]) delete F[to][id];
        this.db.friends[pairKey(id, to)] = Date.now();
        const r = this.getRel(id, to); r.pts = Math.max(r.pts, 60); // เป็นเพื่อนกัน = ความสัมพันธ์อย่างน้อยระดับ "เพื่อน"
        this.relMsg(id, to); this.sendFriends(id); this.sendFriends(to);
        say(to, `🤝 ${me.name} ตอบรับเป็นเพื่อนแล้ว!`); say(id, `🤝 คุณกับ ${other} เป็นเพื่อนกันแล้ว!`); break;
      }
      case 'decline': if (F[id]?.[to]) { delete F[id][to]; this.sendFriends(id); say(to, `${me.name} ยังไม่ตอบรับคำขอเป็นเพื่อน`); } break;
      case 'remove': if (this.isFriend(id, to)) { delete this.db.friends[pairKey(id, to)]; this.sendFriends(id); this.sendFriends(to); say(id, `ลบ ${other} ออกจากรายชื่อเพื่อนแล้ว`); } break;
      default: return;
    }
    this.dirty();
  }
  getRel(a, b) { return (this.db.rels[pairKey(a, b)] ||= newRel()); }
  relMsg(a, b) { const r = this.getRel(a, b); this.send(a, { t: 'rel', other: b, rel: r }); this.send(b, { t: 'rel', other: a, rel: r }); }
  person(id) { const p = this.players.get(id) || this.db.profiles[id]; return p && { id, sex: p.sex, name: p.name, pregnant: !!this.db.preg[id] }; }
  timeOfDay() { return (((Date.now() - this.db.startTime) / DAY_MS) + 0.3) % 1; }
  isNight() { const t = this.timeOfDay(); return t < 0.21 || t > 0.82; }
  dayNum() { return Math.floor((Date.now() - this.db.startTime) / DAY_MS + 0.3) + 1; }

  // ---------- ผู้เล่นเข้า/ออก ----------
  hello(id, m) {
    const me = { id, name: String(m.name || 'ผู้รอดชีวิต').slice(0, 20), sex: ['m', 'f', 'x'].includes(m.sex) ? m.sex : 'm', look: m.look, p: m.p || [0, 0, 0], ry: 0, anim: 0, hp: 100, pets: [], safe: true };
    const known = this.players.has(id);
    this.players.set(id, me);
    this.db.profiles[id] = { name: me.name, sex: me.sex };
    const rels = {};
    for (const [k, r] of Object.entries(this.db.rels)) { const [a, b] = k.split('|'); if (a === id) rels[b] = r; else if (b === id) rels[a] = r; }
    this.send(id, {
      t: 'welcome', now: Date.now(), startTime: this.db.startTime, res: this.db.res, loot: this.db.loot, hearth: this.db.hearth || {}, structures: this.db.structures,
      rels, preg: this.db.preg, children: this.db.children, profiles: this.db.profiles, theme: this.db.theme || 'apocalypse',
      players: this.relayState ? [...this.players.values()].filter((p) => p.id !== id).map((p) => this.pub(p)) : [],
    });
    this.sendFriends(id);
    for (const f of this.friendIds(id)) { this.sendFriends(f); if (!known && this.players.has(f)) this.send(f, { t: 'friendmsg', text: `🟢 เพื่อนของคุณ ${me.name} ออนไลน์แล้ว` }); }
    if (!known && !m.silent) {
      if (this.relayState) this.broadcast({ t: 'join', player: this.pub(me) }, id);
      this.broadcast({ t: 'chat', from: 'system', name: '📻', text: `${me.name} เข้ามาในพื้นที่` }, id);
    }
    this.dirty();
  }
  leave(id) {
    if (!this.players.has(id)) return;
    this.partyMsg(id, { a: 'leave' }); this.players.delete(id);
    { const t = this.tradeOf?.(id); if (t) this.tradeEnd(t, 'อีกฝ่ายออกจากเกม ยกเลิกการแลกของ'); }
    for (const f of this.friendIds(id)) this.sendFriends(f);
    if (this.relayState) this.broadcast({ t: 'leave', id });
  }
  // ใช้กับ room: อัปเดตตำแหน่งจาก presence โดยไม่ต้องส่งต่อ
  setState(id, s) { const p = this.players.get(id); if (p) Object.assign(p, s); }

  // ---------- ข้อความจากผู้เล่น ----------
  message(id, m) {
    if (m.t === 'hello') return this.hello(id, m);
    const me = this.players.get(id);
    if (!me) return;
    const db = this.db;
    switch (m.t) {
      case 'state':
        Object.assign(me, { p: m.p, ry: m.ry, anim: m.anim, hp: m.hp, pets: m.pets || [], safe: !!m.sf, sk: Math.min(1, Math.max(0.3, +m.sk || 1)) });
        if (this.relayState) this.broadcast({ t: 'state', id, p: m.p, ry: m.ry, anim: m.anim, hp: m.hp, pets: me.pets, eq: m.eq, cb: m.cb | 0, lh: m.lh | 0, st: m.st | 0, en: m.en | 0, ij: m.ij | 0, v: m.v ?? null, cl: m.cl }, id);
        break;
      case 'chat': return this.chatMsg(id, me, m);
      case 'hearth': { // เล่นผ่านลิงก์: ผู้เล่นจุดเตาผิงแล้วแจ้งโฮสต์ (โหมดเซิร์ฟเวอร์ถูกกันไว้ใน server-econ)
        const P = getLayout().pavilions[m.i | 0]; if (!P?.hearth) return;
        const until = Math.min(Date.now() + HEARTH_MS + 60000, +m.until || 0); (db.hearth ||= {})[m.i | 0] = until; this._fireSpotsT = 0;
        this.broadcast({ t: 'hearth', i: m.i | 0, until }); break;
      }
      case 'theme': if (this.allowTheme?.(id)) this.setThemeAll(m.v); else this.send(id, { t: 'notice', text: 'เปลี่ยนธีมได้เฉพาะ ⭐ เจ้าของเซิร์ฟเวอร์' }); break;
      case 'party': return this.partyMsg(id, m);
      case 'announce':
        if (m.kind === 'quest') this.broadcast({ t: 'chat', from: 'system', name: '📻', text: `📻 ${me.name} ติดต่อศูนย์อพยพสัตหีบสำเร็จ! ประตูค่ายเปิดรับผู้รอดชีวิตแล้ว` });
        break;
      case 'res': db.res[m.id] = m.until; this.broadcast({ t: 'res', id: m.id, until: m.until }, id); this.dirty(); break;
      case 'loot': db.loot[m.id] = m.until; this.broadcast({ t: 'loot', id: m.id, until: m.until }, id); this.dirty(); break;
      case 'place': {
        const s = { ...m.s, owner: id, id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 999) };
        db.structures.push(s); this.rebuildWalls(); this.broadcast({ t: 'place', s }); this.dirty(); break;
      }
      case 'sop': this.structureOp(me, m); break;
      case 'sdel': {
        const i = db.structures.findIndex((x) => x.id === m.id); if (i < 0) return;
        const st = db.structures[i];
        if (st.owner && st.owner !== id) return this.send(id, { t: 'notice', text: 'รื้อได้เฉพาะของที่ตัวเองสร้าง' });
        const why = canDemolish(st, id); if (why) return this.send(id, { t: 'notice', text: why });
        db.structures.splice(i, 1); this.rebuildWalls();
        this.broadcast({ t: 'sdel', id: m.id });
        this.send(id, { t: 'give', items: refundFor(st), msg: 'รื้อแล้ว ได้วัสดุคืน' });
        this.dirty(); break;
      }
      case 'zdmg': case 'mdmg': {
        // ตีระยะประชิดต้องอยู่ใกล้เป้าหมายจริง (สัตว์เลี้ยง/อาวุธยิงไกลตีได้ไกลกว่า)
        const t = this.zombies.get(m.id) || this.fauna.get(m.id), pp = me.p;
        if (t && pp) { const d = Math.hypot(t.x - pp[0], t.z - pp[2]) - (BODY_R[t.k] || 0.4); if (d > (m.pet ? 45 : m.r ? 60 : MELEE_MAX)) return; }
        if (this.zombies.has(m.id)) this.damageZombie(m.id, Math.min(60, Math.max(0, +m.dmg || 0)), id);
        else this.damageFauna(m.id, Math.min(60, Math.max(0, +m.dmg || 0)), id);
        break;
      }
      case 'mfeed': {
        const f = this.fauna.get(m.id); if (!f || !['dog', 'cat', 'bird'].includes(f.k)) return;
        f.tame[id] = Math.min(100, (f.tame[id] || 0) + Math.min(50, +m.amt || 0));
        if (f.tame[id] >= 100) { this.fauna.delete(f.id); this.send(id, { t: 'tamed', k: f.k }); }
        else this.send(id, { t: 'tameprog', id: f.id, v: f.tame[id] });
        break;
      }
      case 'npcfollow': { const f = this.fauna.get(100000 + (m.idx | 0)); if (f) { f.follow = m.on ? id : null; if (!m.on) f.home = { x: f.x, z: f.z }; } break; }
      case 'music': this.broadcast({ t: 'music', id, x: +m.x || 0, z: +m.z || 0, p: Math.min(40, Math.max(0, +m.p || 0)), heal: m.heal ? 1 : 0, mo: m.mo ? 1 : 0 }, id); break;
      case 'friend': return this.friendMsg(id, m);
      case 'trade': return this.tradeMsg(id, m);
      case 'horde': this.horde(m.x, m.z, Math.min(8, m.n | 0), id); break;
      case 'act': this.act(me, m); break;
      case 'respond': this.respond(me, m); break;
    }
  }

  act(me, m) {
    const target = this.players.get(m.target);
    if (!target || !ACTIONS[m.action]) return;
    const r = this.getRel(me.id, target.id);
    const chk = canDo(m.action, r, this.person(me.id), this.person(target.id));
    if (!chk.ok) return this.send(me.id, { t: 'notice', text: chk.why });
    if (m.action === 'gift') {
      r.pts += Math.min(giftValue(ITEMS[m.item]), m.value || 2);
      this.send(target.id, { t: 'receive', item: m.item, qty: m.qty || 1, from: me.name });
      this.relMsg(me.id, target.id); this.dirty(); return;
    }
    if (m.action === 'heal') {
      applyAction('heal', r);
      this.send(target.id, { t: 'healed', item: m.item, from: me.name });
      this.relMsg(me.id, target.id); this.dirty(); return;
    }
    if (ACTIONS[m.action].consent) {
      const reqId = this.reqSeq++;
      this.requests.set(reqId, { from: me.id, to: target.id, action: m.action, t: Date.now() });
      this.send(target.id, { t: 'request', reqId, from: me.id, name: me.name, action: m.action, label: ACTIONS[m.action].label });
      this.send(me.id, { t: 'notice', text: `ส่งคำขอถึง ${target.name} แล้ว รอการตอบรับ...` });
      return;
    }
    this.doAction(m.action, me.id, target.id);
    if (m.action === 'hug') this.send(target.id, { t: 'notice', text: `🤗 ${me.name} กอดคุณ` });
    if (m.action === 'talk') this.send(target.id, { t: 'notice', text: `💬 ${me.name} ชวนคุณคุย` });
  }

  respond(me, m) {
    const q = this.requests.get(m.reqId);
    if (!q || q.to !== me.id) return;
    this.requests.delete(m.reqId);
    if (Date.now() - q.t > 60000) return this.send(me.id, { t: 'notice', text: 'คำขอหมดอายุแล้ว' });
    if (!m.accept) return this.send(q.from, { t: 'notice', text: `${me.name} ปฏิเสธอย่างสุภาพ...` });
    const chk = canDo(q.action, this.getRel(q.from, q.to), this.person(q.from), this.person(q.to));
    if (!chk.ok) return this.send(q.from, { t: 'notice', text: chk.why });
    if (q.action === 'marry') this.send(q.from, { t: 'consume', item: 'ring', qty: 1 });
    this.doAction(q.action, q.from, q.to);
  }

  doAction(action, a, b) {
    const r = this.getRel(a, b);
    applyAction(action, r);
    const A = this.person(a), B = this.person(b);
    if (action === 'baby') {
      const mother = A.sex === 'f' ? a : b;
      this.db.preg[mother] = { partner: mother === a ? b : a, start: Date.now() };
      this.broadcast({ t: 'preg', preg: this.db.preg });
      this.send(a, { t: 'notice', text: `💗 ${B.name} กับคุณกำลังจะมีลูกด้วยกัน!` });
      this.send(b, { t: 'notice', text: `💗 ${A.name} กับคุณกำลังจะมีลูกด้วยกัน!` });
    } else if (action === 'adopt') this.birth([a, b], true);
    else if (action === 'propose' || action === 'marry') {
      this.broadcast({ t: 'chat', from: 'system', name: '📻', text: `${A.name} และ ${B.name} ตอนนี้เป็น "${relName(r)}" กันแล้ว` });
    }
    this.relMsg(a, b);
    this.dirty();
  }

  birth(parents, adopted = false) {
    const child = {
      id: 'c' + Date.now().toString(36), name: CHILD_NAMES[Math.floor(Math.random() * CHILD_NAMES.length)],
      sex: Math.random() < 0.5 ? 'm' : 'f', parents, born: Date.now(), adopted,
    };
    this.db.children.push(child);
    this.broadcast({ t: 'children', children: this.db.children });
    for (const id of parents) this.send(id, { t: 'notice', text: adopted ? `🧸 รับ "${child.name}" มาเป็นลูกแล้ว` : `👶 ยินดีด้วย! "${child.name}" ลืมตาดูโลกแล้ว` });
    this.dirty();
  }

  // ---------- สิ่งก่อสร้าง ----------
  rebuildWalls() { this.walls = [...this.baseWalls, ...this.db.structures.flatMap(collidersFor)]; }
  structureOp(me, m) {
    const s = this.db.structures.find((x) => x.id === m.id); if (!s || !m.op) return;
    const fr = !s.owner || s.owner === me.id || relLevel(this.getRel(me.id, s.owner)) >= 2, role = accessFor(this.db.structures, s, me.id, fr), canAccess = fr || !!role;
    const r = applyOp(s, m.op, { now: Date.now(), by: me.id, canAccess, role, flowers: s.type === 'hive' ? flowersNear(this.db.structures, s, Date.now()) : 0 });
    if (r.err) { if (!m.op.silent) this.send(me.id, { t: 'notice', text: r.err }); if (m.refund) this.send(me.id, { t: 'give', items: m.refund }); return; }
    Object.assign(s, r.patch);
    if ('open' in r.patch || 'x' in r.patch) this.rebuildWalls();
    this.broadcast({ t: 'supd', id: s.id, patch: r.patch });
    if (r.give || (r.msg && !m.op.silent)) this.send(me.id, { t: 'give', items: r.give || {}, msg: m.op.silent ? null : r.msg });
    this.dirty();
  }

  // ---------- สัตว์ป่า / สัตว์จรจัด / NPC ----------
  spawnFauna(k, x, z) {
    const hp = WILD[k]?.hp ?? { dog: 30, cat: 20, bird: 10 }[k];
    const f = { id: this.fseq++, k, x, z, ry: Math.random() * 6.28, spd: 0, hp, t: 0, tame: {}, angry: 0, home: { x, z } };
    this.fauna.set(f.id, f); return f;
  }
  damageFauna(fid, dmg, by) {
    const f = this.fauna.get(fid); if (!f || f.k === 'npc') return;
    f.hp -= dmg; f.alert = 8;
    if (WILD[f.k]?.angryHit || WILD[f.k]?.hostile) { f.angry = 12; f.angryId = by; }
    if (f.hp <= 0) { this.fauna.delete(fid); this.broadcast({ t: 'mdie', id: fid, by, k: f.k }); }
  }
  moveMob(m, tx, tz, spd, dt, away = false, canSwim = false) {
    let dx = tx - m.x, dz = tz - m.z; const L = Math.hypot(dx, dz) || 1;
    if (away) { dx = -dx; dz = -dz; }
    const want = Math.atan2(dx, dz); let dr = want - m.ry;
    while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2;
    m.ry += dr * Math.min(1, dt * 8);
    const nx = m.x + (dx / L) * spd * dt, nz = m.z + (dz / L) * spd * dt;
    const h = heightAt(nx, nz);
    if (!canSwim && (h < 0.6 || waterAt(nx, nz, h))) { m.wander = null; m.spd = 0; return L; }
    const pos = { x: nx, z: nz, y: h }; collideBoxes(this.walls, pos, 0.35);
    m.x = pos.x; m.z = pos.z; m.spd = spd;
    return L;
  }
  wander(m, cx, cz, rad, spd, dt, canSwim) {
    if (!m.wander || m.t > m.wander.until) m.wander = Math.random() < 0.35 ? { x: m.x, z: m.z, until: m.t + 2 + Math.random() * 3 } : { x: cx + (Math.random() - 0.5) * rad * 2, z: cz + (Math.random() - 0.5) * rad * 2, until: m.t + 4 + Math.random() * 6 };
    if (Math.hypot(m.wander.x - m.x, m.wander.z - m.z) > 0.6) this.moveMob(m, m.wander.x, m.wander.z, spd, dt, false, canSwim); else m.spd = 0;
  }
  tickFauna(dt) {
    const alive = [...this.players.values()].filter((p) => p.p);
    const nearest = (m, rad) => { let best = null, bd = rad; for (const p of alive) { const d = Math.hypot(p.p[0] - m.x, p.p[2] - m.z); if (d < bd) { bd = d; best = p; } } return [best, bd]; };
    for (const m of this.fauna.values()) {
      m.t += dt; m.cd = (m.cd || 0) - dt;
      const [P, dP] = nearest(m, 250);
      if (!P) { m.spd = 0; continue; } // ไม่มีใครอยู่ใกล้ ไม่ต้องคำนวณ
      if (m.k === 'npc') {
        let z = null, zd = 10;
        for (const zb of this.zombies.values()) { const d = Math.hypot(zb.x - m.x, zb.z - m.z); if (d < zd) { zd = d; z = zb; } }
        const F = m.follow && this.players.get(m.follow);
        if (z) this.moveMob(m, z.x, z.z, 3.8, dt, true);
        else if (F && F.p) {
          const d = Math.hypot(F.p[0] - m.x, F.p[2] - m.z);
          if (d > 70) { m.x = F.p[0] + 2; m.z = F.p[2] + 2; }
          else if (d > 3) this.moveMob(m, F.p[0], F.p[2], Math.min(7, 2 + d * 0.5), dt); else { m.spd = 0; m.ry = Math.atan2(F.p[0] - m.x, F.p[2] - m.z); }
        } else if (dP < 5) { m.spd = 0; m.ry = Math.atan2(P.p[0] - m.x, P.p[2] - m.z); }
        else this.wander(m, m.home.x, m.home.z, 20, 1.2, dt);
        continue;
      }
      if (['dog', 'cat', 'bird'].includes(m.k)) {
        if (dP < 4) { m.spd = 0; m.ry = Math.atan2(P.p[0] - m.x, P.p[2] - m.z); }
        else this.wander(m, m.x, m.z, 8, m.k === 'bird' ? 1.8 : 1.2, dt, m.k === 'bird');
        continue;
      }
      // สัตว์ป่า · ไดโนเสาร์กินเนื้อไล่ล่าผู้เล่นที่เข้าใกล้
      const W = WILD[m.k] || {}, H = m.home || (m.home = { x: m.x, z: m.z });
      // อาณาเขต: ไดโนเสาร์/นักล่าไม่เข้าเมือง · ทุกตัวไม่ออกห่างถิ่นเกิน leash
      if (W.noTown && inTownAt(m.x, m.z)) { m.angry = 0; this.moveMob(m, H.x, H.z, 4, dt); continue; }
      if (m.angry > 0 && W.noTown && P && inTownAt(P.p[0], P.p[2])) m.angry = 0;
      if (W.leash && Math.hypot(m.x - H.x, m.z - H.z) > W.leash) { m.angry = 0; m.alert = 0; this.moveMob(m, H.x, H.z, W.chase || 3, dt); continue; }
      if (!m._ft || m.t - m._ft > 1) { m._ft = m.t; this._fires = this.fireSpots(); }
      if (W.hostile && dP < W.hostile && !P.safe && !(m.angry > 0) && !nearFireOf(this._fires, P.p[0], P.p[2])) { m.angry = 6; m.angryId = P.id; }
      if (m.angry > 0 && W.hostile && nearFireOf(this._fires, m.x, m.z, FIRE_SAFE + 2)) m.angry = 0; // นักล่ากลัวไฟ
      if (m.angry > 0) {
        m.angry -= dt;
        const T = this.players.get(m.angryId);
        if (T && T.p) {
          const d = this.moveMob(m, T.p[0], T.p[2], W.chase || 4.2, dt);
          if (d < (W.dino ? 2.2 : 1.6) && m.cd <= 0 && !T.safe && (T.p[1] ?? 0) - heightAt(m.x, m.z) < 2.2) { m.cd = 1.5; this.send(T.id, { t: 'zhit', dmg: W.dmg || 6, bleed: W.bleed || 0.15, infect: 0, src: W.name || 'สัตว์ป่า' }); }
          continue;
        }
      }
      const flee = W.flee ?? 10, fleeSpd = W.fleeSpd || 4;
      if ((flee && dP < flee) || (m.alert > 0 && flee)) { if (m.alert > 0) m.alert -= dt; this.moveMob(m, P.p[0], P.p[2], fleeSpd, dt, true); }
      else this.wander(m, H.x, H.z, Math.min(25, (W.leash || 40) * 0.5), m.k === 'chicken' ? 0.8 : 1.3, dt);
    }
  }
  spawnFaunaTick() {
    const alive = [...this.players.values()].filter((p) => p.p);
    for (const m of this.fauna.values()) if (m.k !== 'npc' && !alive.some((p) => Math.hypot(p.p[0] - m.x, p.p[2] - m.z) < 190)) this.fauna.delete(m.id);
    if (this.fauna.size > 70) return;
    const kk = TOWNS.find((t) => t.key === 'khaokheow');
    for (const p of alive) {
      const [px, , pz] = p.p;
      const town = TOWNS.find((t) => (t.x - px) ** 2 + (t.z - pz) ** 2 < (t.r * 1.6) ** 2);
      let an = 0, st = 0;
      for (const m of this.fauna.values()) { if (Math.hypot(m.x - px, m.z - pz) > 140) continue; if (WILD[m.k]) an++; else if (m.k !== 'npc') st++; }
      const spot = (a0, a1) => { for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, r = a0 + Math.random() * (a1 - a0), x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r; if (this.validSpot(x, z)) return [x, z]; } return null; };
      if (an < (town ? 2 : 7)) {
        const s = spot(35, 100);
        if (s) {
          const zoo = (kk.x - s[0]) ** 2 + (kk.z - s[1]) ** 2 < 150 * 150, r = Math.random();
          // สัตว์เฉพาะถิ่น: ช้างป่าบ่อทอง · ควายหนองใหญ่/บ้านบึง · แกะบางละมุง (ในสวนแกะเกิดถี่กว่า)
          const reg = REGION_FAUNA.find((f) => { const t = TOWNS.find((x) => x.key === f.town); return (t.x - s[0]) ** 2 + (t.z - s[1]) ** 2 < (t.r * f.r) ** 2; });
          const k = reg && Math.random() < reg.p ? reg.k : pickWild(zoo, r, inTownAt(s[0], s[1], 1.4));
          if (!(WILD[k].noTown && inTownAt(s[0], s[1], 1.4))) this.spawnFauna(k, ...s);
        }
      }
      const sf = SHEEP_FARM; if (Math.hypot(sf.x - px, sf.z - pz) < 120 && [...this.fauna.values()].filter((m) => m.k === 'sheep' && Math.hypot(m.x - sf.x, m.z - sf.z) < 30).length < 5) {
        const a = Math.random() * 6.28, rr = Math.random() * 15, x = sf.x + Math.cos(a) * rr, z = sf.z + Math.sin(a) * rr; if (this.validSpot(x, z)) this.spawnFauna('sheep', x, z);
      }
      if (town && st < 3) { const s = spot(20, 50); if (s) this.spawnFauna(['dog', 'cat', 'bird'][Math.floor(Math.random() * 3)], ...s); }
    }
  }

  // ---------- ผู้ติดเชื้อ ----------
  spawnZombie(x, z, alertId = null, tier = pickTier(Math.random, this.dayNum())) {
    const hp = zombieHp(tier, this.dayNum());
    const zb = { id: this.zseq++, x, z, ry: Math.random() * 6.28, spd: 0, hp, maxHp: hp, cd: 0, wander: null, t: 0, alert: alertId ? 15 : 0, alertId, tier };
    this.zombies.set(zb.id, zb); return zb;
  }
  // บอส: เกิดนาน ๆ ครั้ง ใกล้ผู้เล่นคนหนึ่ง (ครั้งละ 1 ตัวทั้งโลก)
  spawnBoss(nearId = null) {
    if ([...this.zombies.values()].some((z) => z.tier === BOSS)) return null;
    const alive = [...this.players.values()].filter((p) => p.p && p.hp > 0 && !p.safe);
    const p = (nearId && this.players.get(nearId)) || alive[Math.floor(Math.random() * alive.length)]; if (!p?.p) return null;
    for (let k = 0; k < 20; k++) {
      const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 30, x = p.p[0] + Math.cos(a) * r, z = p.p[2] + Math.sin(a) * r;
      if (this.validSpot(x, z)) { const zb = this.spawnZombie(x, z, null, BOSS); this.broadcast({ t: 'announce', kind: 'boss', x, z }); return zb; }
    }
    return null;
  }
  // จุดไฟที่ไล่ผู้ติดเชื้อ/สัตว์ร้าย: กองไฟที่ผู้เล่นก่อ + เตาผิงในศาลาที่ยังลุกอยู่ (แคช 2 วินาที)
  fireSpots() {
    const now = Date.now();
    if (!this._fireSpots || now - (this._fireSpotsT || 0) > 2000) {
      const pav = getLayout().pavilions, H = this.db.hearth || {};
      this._fireSpotsT = now; this._fireSpots = [...this.db.structures.filter((s) => s.type === 'campfire'), ...Object.keys(H).filter((i) => H[i] > now && pav[i]).map((i) => ({ x: pav[i].x, z: pav[i].z, hearth: true }))];
    }
    return this._fireSpots;
  }
  // ฐานที่รั้วล้อมครบทุกด้าน (แคชไว้ 3 วินาที) — ห้ามมีอะไรเกิดข้างใน
  closedBases() {
    const now = Date.now();
    if (!this._cb || now - this._cbT > 3000) { const S = this.db.structures; this._cbT = now; this._cb = S.filter((s) => s.type === 'basecore' && s.ok && fenceClosed(S, s)); }
    return this._cb;
  }
  validSpot(x, z) {
    const h = heightAt(x, z);
    if (h < 0.8 || waterAt(x, z, h) || inCamp(x, z, 4)) return false;
    if (this.closedBases().some((b) => inBox(b.box, x, z, 1))) return false;
    if (nearFireOf(this.fireSpots(), x, z, FIRE_SAFE + 4)) return false; // ไม่เกิดใกล้กองไฟ/เตาผิงที่ลุกอยู่
    return !this.walls.some((b) => Math.abs(b.x - x) < b.w / 2 + 1 && Math.abs(b.z - z) < b.d / 2 + 1);
  }
  damageZombie(zid, dmg, by) {
    const zb = this.zombies.get(zid); if (!zb) return;
    zb.hp -= dmg; zb.alert = 10; zb.alertId = by;
    if (zb.hp <= 0) { this.zombies.delete(zid); this.broadcast({ t: 'zdie', id: zid, by, tier: zb.tier | 0 }); if (zb.tier === BOSS) this.broadcast({ t: 'announce', kind: 'bossdown', by }); }
  }
  horde(x, z, n, by) {
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 8; k++) {
        const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 14;
        const zx = x + Math.cos(a) * r, zz = z + Math.sin(a) * r;
        if (this.validSpot(zx, zz)) { this.spawnZombie(zx, zz, by); break; }
      }
    }
  }

  tickZombies(dt) {
    const night = this.isNight(), day = this.dayNum();
    const alive = [...this.players.values()].filter((p) => p.hp > 0 && p.p);
    const fires = this.fireSpots(), bases = this.db.structures.filter((s) => s.type === 'basecore' && s.ok), now = Date.now();
    for (const zb of this.zombies.values()) {
      // รั้วและบ้านของฐาน (ช่วงป้องกัน 60 วัน) กันผู้ติดเชื้อ: ถ้าหลุดเข้ามาให้ถอยออกไป
      const sb = safeBaseAt(bases, zb.x, zb.z, now, 1);
      if (sb) { const cx = (sb.box[0] + sb.box[2]) / 2, cz = (sb.box[1] + sb.box[3]) / 2, dx = zb.x - cx || 0.1, dz = zb.z - cz, L = Math.hypot(dx, dz) || 1; zb.x += (dx / L) * 3 * dt; zb.z += (dz / L) * 3 * dt; zb.ry = Math.atan2(dx, dz); zb.spd = 3; continue; }
      zb.t += dt; zb.cd -= dt;
      // กลัวกองไฟ: ถ้าอยู่ใกล้กองไฟให้ถอยออกไป ไม่ไล่ใคร
      const fire = nearFireOf(fires, zb.x, zb.z, FIRE_SAFE + 2);
      if (fire && !ZTIERS[zb.tier | 0].boss) { const dx = zb.x - fire.f.x, dz = zb.z - fire.f.z, L = Math.hypot(dx, dz) || 1; zb.x += (dx / L) * 2.5 * dt; zb.z += (dz / L) * 2.5 * dt; zb.ry = Math.atan2(dx, dz); zb.spd = 2.5; continue; }
      const T = ZTIERS[zb.tier | 0], see = (night ? 40 : 24) * (T.boss ? 1.5 : 1);
      let tgt = null, td = see;
      zb.ignore ||= {};
      for (const p of alive) {
        if (zb.ignore[p.id] > zb.t) continue;
        const d = Math.hypot(p.p[0] - zb.x, p.p[2] - zb.z);
        // ย่อ/คลาน = มองเห็นได้ใกล้ลง (sk) ยกเว้นตัวที่ตื่นตัวอยู่แล้ว
        if (d < Math.min(td, see * (zb.alert > 0 && zb.alertId === p.id ? 1 : p.sk || 1)) && !inCamp(p.p[0], p.p[2], 1) && !(nearFireOf(fires, p.p[0], p.p[2]) && !T.boss) && !safeBaseAt(bases, p.p[0], p.p[2], now)) { tgt = p; td = d; }
      }
      if (!tgt && zb.alert > 0) { zb.alert -= dt; tgt = this.players.get(zb.alertId) || null; if (tgt && zb.ignore[tgt.id] > zb.t) tgt = null; if (tgt) td = Math.hypot(tgt.p[0] - zb.x, tgt.p[2] - zb.z); if (td > 70) tgt = null; }
      let tx, tz, spd;
      if (tgt) { tx = tgt.p[0]; tz = tgt.p[2]; spd = (night ? 3.75 : 3.0) * T.spd; }
      else {
        if (!zb.wander || zb.t > zb.wander.until) zb.wander = Math.random() < 0.35 ? { x: zb.x, z: zb.z, until: zb.t + 3 } : { x: zb.x + (Math.random() - 0.5) * 16, z: zb.z + (Math.random() - 0.5) * 16, until: zb.t + 6 };
        tx = zb.wander.x; tz = zb.wander.z; spd = 1.6 * Math.min(1, T.spd);
      }
      const dx = tx - zb.x, dz = tz - zb.z, L = Math.hypot(dx, dz);
      if (L > (tgt ? 1.2 : 0.6)) {
        const want = Math.atan2(dx, dz); let dr = want - zb.ry;
        while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2;
        zb.ry += dr * Math.min(1, dt * 8);
        const nx = zb.x + (dx / L) * spd * dt, nz = zb.z + (dz / L) * spd * dt;
        const hz = heightAt(nx, nz);
        if (hz > -1.5) { const pos = { x: nx, z: nz, y: hz }; collideBoxes(this.walls, pos, 0.35 * T.scale); zb.x = pos.x; zb.z = pos.z; zb.spd = spd; }
        else { zb.wander = null; zb.spd = 0; }
      } else zb.spd = 0;
      // ผู้ติดเชื้อปีนไม่ได้: ผู้เล่นที่อยู่บนที่สูงโจมตีไม่ถึง ถ้าวนอยู่ข้างล่างนาน 15 วินาทีจะเลิกสนใจ 25 วินาที
      const reach = tgt && (tgt.p[1] ?? 0) - heightAt(zb.x, zb.z) < 2.2;
      if (tgt && !reach && td < 14) { zb.stuck = (zb.stuck || 0) + dt; if (zb.stuck > 15) { zb.stuck = 0; zb.ignore[tgt.id] = zb.t + 25; zb.alert = 0; } }
      if (tgt && reach && td < 1.2 + 0.4 * T.scale && zb.cd <= 0 && !tgt.safe) {
        zb.cd = T.boss ? 1.6 : 1.3;
        this.send(tgt.id, { t: 'zhit', dmg: (7 + day * 0.3) * T.dmg, bleed: 0.22, infect: T.infect, tier: zb.tier | 0 });
      }
    }
  }

  spawnTick() {
    const alive = [...this.players.values()].filter((p) => p.p);
    // ลบตัวที่ไกลจากผู้เล่นทุกคน
    for (const zb of this.zombies.values()) {
      if (!alive.some((p) => Math.hypot(p.p[0] - zb.x, p.p[2] - zb.z) < 190)) this.zombies.delete(zb.id);
    }
    if (this.zombies.size >= 90) return;
    const night = this.isNight(), day = this.dayNum();
    for (const p of alive) {
      if (p.safe || p.hp <= 0) continue;
      const [px, , pz] = p.p;
      let near = 0;
      for (const zb of this.zombies.values()) if (Math.hypot(zb.x - px, zb.z - pz) < 140) near++;
      const town = TOWNS.find((t) => (t.x - px) ** 2 + (t.z - pz) ** 2 < (t.r * 1.6) ** 2);
      const want = Math.min(30, Math.floor((town ? 7 : 2) * (night ? 2.4 : 0.55) + day * (night ? 0.8 : 0.3))); // กลางวันน้อย กลางคืนเยอะ
      if (near >= want) continue;
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2, r = 45 + Math.random() * 45;
        const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
        if (this.validSpot(x, z)) { this.spawnZombie(x, z, null, inNavy(x, z, 1.4) && Math.random() < 0.8 ? SOLDIER : undefined); break; }
      }
    }
    // ฐานทัพเรือสัตหีบ: มีทหารผู้ติดเชื้อเฝ้าตลอด + ผู้บัญชาการ (บอส) เมื่อมีผู้เล่นบุกเข้าไป
    const inBase = alive.filter((p) => inNavy(p.p[0], p.p[2], 1.6));
    if (inBase.length) {
      let sold = 0, adm = null; for (const zb of this.zombies.values()) { if (zb.tier === SOLDIER && inNavy(zb.x, zb.z, 1.5)) sold++; if (zb.tier === ADMIRAL) adm = zb; }
      for (let i = 0; i < 2 && sold < 10; i++) { const a = Math.random() * 6.28, r = Math.random() * NAVY.r, x = NAVY.x + Math.cos(a) * r, z = NAVY.z + Math.sin(a) * r; if (this.validSpot(x, z) && !alive.some((p) => Math.hypot(p.p[0] - x, p.p[2] - z) < 14)) { this.spawnZombie(x, z, null, SOLDIER); sold++; } }
      if (!adm && Date.now() - (this.admiralT || 0) > ADMIRAL_EVERY) {
        for (let k = 0; k < 10; k++) { const x = NAVY.x + 10 + (Math.random() - 0.5) * 8, z = NAVY.z + 4 + (Math.random() - 0.5) * 6; if (this.validSpot(x, z)) { this.admiralT = Date.now(); this.spawnZombie(x, z, null, ADMIRAL); this.broadcast({ t: 'announce', kind: 'admiral', x, z }); break; } }
      }
    }
  }

  slowTick() {
    const list = [...this.players.values()];
    for (const p of list) if (this.friendIds(p.id).length) this.sendFriends(p.id); // อัปเดตตำแหน่ง/สถานะเพื่อน
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (!a.p || !b.p) continue;
      const dx = a.p[0] - b.p[0], dz = a.p[2] - b.p[2];
      if (dx * dx + dz * dz < 144) { this.getRel(a.id, b.id).pts += this.isFriend(a.id, b.id) ? 0.75 : 0.5; this.relMsg(a.id, b.id); this.dirty(); }
    }
    for (const [mother, pr] of Object.entries(this.db.preg)) {
      if (Date.now() - pr.start >= PREG_MS) {
        delete this.db.preg[mother];
        this.broadcast({ t: 'preg', preg: this.db.preg });
        this.birth([mother, pr.partner]);
      }
    }
  }

  // เรียกทุก ~0.1 วินาที
  tick(dt) {
    this.tickZombies(dt);
    this.tickFauna(dt);
    this.tSpawn -= dt; if (this.tSpawn <= 0) { this.tSpawn = 1; this.spawnTick(); this.spawnFaunaTick(); }
    this.tMs -= dt;
    if (this.tMs <= 0) {
      this.tMs = 0.25;
      const K = { boar: 0, deer: 1, chicken: 2, dog: 3, cat: 4, bird: 5, npc: 6, raptor: 7, trike: 8, tiger: 9 };
      const m = [];
      for (const f of this.fauna.values()) m.push(f.k === 'npc' ? f.idx : f.id, K[f.k], Math.round(f.x * 10), Math.round(f.z * 10), Math.round(f.ry * 100), Math.round(f.spd * 10));
      this.broadcast({ t: 'ms', m });
    }
    this.tZs -= dt;
    if (this.tZs <= 0) {
      this.tZs = 0.16;
      const z = [...this.zombies.values()].map((zb) => [zb.id, Math.round(zb.x * 10) / 10, Math.round(zb.z * 10) / 10, Math.round(zb.ry * 100) / 100, Math.round(zb.spd * 10) / 10, zb.tier | 0, Math.max(1, Math.round((zb.hp / zb.maxHp) * 100))]);
      if (z.length || this._hadZ) this.broadcast({ t: 'zs', z });
      this._hadZ = z.length > 0;
    }
    this.tSlow -= dt; if (this.tSlow <= 0) { this.tSlow = 5; this.slowTick(); }
    this.tBoss -= dt * 1000; if (this.tBoss <= 0) { this.tBoss = BOSS_EVERY; if (Math.random() < BOSS_CHANCE) this.spawnBoss(); }
  }

  // ข้อมูลสำหรับบันทึก (ตัดของที่ฟื้นแล้วออก)
  snapshot() {
    const now = Date.now(), d = this.db;
    const live = (o) => Object.fromEntries(Object.entries(o).filter(([, u]) => u > now));
    return { ...d, res: live(d.res), loot: live(d.loot) };
  }
}
