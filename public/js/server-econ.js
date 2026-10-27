// โหมดเซิร์ฟเวอร์สาธารณะ: ตัวละครเก็บที่เซิร์ฟเวอร์ และทุกการได้/เสียไอเท็มผ่านกฎของ economy.js (กันโกง)
// ติดตั้งลงบน WorldCore ด้วย installEconomy(core) — ใช้เฉพาะ server.js (Node)
import { runAction, applyResult, sopCost, killReward, refundReward, maxSlots } from './economy.js';
import { getLayout } from './citygen.js';
import { getResources } from './resources-core.js';
import { applyOp, collidersFor } from './building-core.js';
import { heightAt, waterAt, hash2 } from './terrain.js';
import { ITEMS, WEAR_SLOTS, skillLevel, wearStats, NPCS, dmgMulOf, maxHpOf, WILD } from './data.js';
import { relLevel, canDo, applyAction, ACTIONS } from './social-core.js';
import { petStats } from './pets.js';

const BAD = ['ควย', 'เหี้ย', 'สัส', 'เย็ด', 'หี', 'แตด', 'fuck', 'shit', 'bitch', 'cunt', 'nigger'];
export const cleanText = (t) => { let s = String(t || '').replace(/[\u0000-\u001f\u200b-\u200f\u2028-\u202e]/g, '').slice(0, 200); for (const w of BAD) s = s.split(w).join('*'.repeat(w.length)); return s; };
const MAX_SPEED = 13, MAX_VEHICLE = 26;

export function installEconomy(core) {
  core.economy = true;
  core.chars = new Map();     // id -> character (ข้อมูลจริงอยู่ที่นี่)
  core.resHp = new Map();
  core.resList = getResources();
  core.lootList = getLayout().loot;

  core.attachChar = function (id, ch) { this.chars.set(id, ch); ch.t = {}; ch.lastPos = ch.pos ? { x: ch.pos[0], y: ch.pos[1], z: ch.pos[2], t: Date.now() } : null; ch.teleportOk = true; };
  core.detachChar = function (id) { const ch = this.chars.get(id); this.chars.delete(id); return ch; };

  core.env = function (id) {
    const self = this, me = () => this.players.get(id);
    return {
      now: () => Date.now(), rand: Math.random,
      wild: (fid) => { const f = self.fauna.get(+fid); return f && WILD[f.k] ? { k: f.k, x: f.x, z: f.z, hp: f.hp, maxHp: WILD[f.k].hp } : null; },
      npcPos: (nid) => { const i = NPCS.findIndex((n) => n.id === nid), f = self.fauna.get(100000 + i); return f ? { x: f.x, z: f.z } : null; },
      ownCount: (type) => self.db.structures.filter((s) => s.type === type && s.owner === id).length,
      pos: () => { const p = me()?.p || [0, 0, 0]; return { x: p[0], y: p[1], z: p[2] }; },
      loot: (lid) => { const i = +String(lid).slice(1), L = self.lootList[i]; return L ? { ...L, until: self.db.loot[lid] || 0 } : null; },
      res: (rid) => self.resList[rid] || null,
      resUntil: (rid) => self.db.res[rid] || 0,
      resHp: (rid) => self.resHp.get(rid), setResHp: (rid, v) => (v === null ? self.resHp.delete(rid) : self.resHp.set(rid, v)),
      near: (type, P, rad) => self.db.structures.find((s) => s.type === type && Math.hypot(s.x - P.x, s.z - P.z) < rad),
      raining: () => hash2(Math.floor(Date.now() / 150000), 77) < 0.3,
      freshNear: (P) => !!self.db.structures.find((s) => s.type === 'pond' && Math.hypot(s.x - P.x, s.z - P.z) < 3.5) || ring(P, 3).some(([x, z]) => waterAt(x, z)?.fresh),
      waterNear: (P) => ring(P, 3.5).some(([x, z]) => waterAt(x, z)),
      fishKind: (x, z) => (self.db.structures.find((s) => s.type === 'pond' && Math.hypot(s.x - x, s.z - z) < 1.8) ? 'pond' : (() => { const w = waterAt(x, z); return w ? (w.fresh ? 'fresh' : 'sea') : null; })()),
      mob: (mid) => { const f = self.fauna.get(mid); return f && { k: f.k, x: f.x, z: f.z }; },
      tameAdd: (mid, ch, amt) => { const f = self.fauna.get(mid); f.tame[id] = Math.min(100, (f.tame[id] || 0) + amt); return f.tame[id]; },
      tamed: (mid) => self.fauna.delete(mid),
      giveTo: (to, items) => { const tc = self.chars.get(to); if (!tc) return false; applyResult(tc, { give: items }); self.sendEcon(to, { give: items, quietGive: false }); return true; },
      place: (ch, s) => {
        const st = { ...s, owner: id, id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 999) };
        if (st.y === undefined) delete st.y;
        self.db.structures.push(st); self.rebuildWalls(); self.broadcast({ t: 'place', s: st }); self.dirty();
        return st;
      },
    };
  };

  // ส่งผลลัพธ์ + สถานะกระเป๋าจริงกลับไปให้ผู้เล่น
  core.charView = function (ch) { return { inv: ch.inv, wear: ch.wear, skills: ch.skills, equipped: ch.equipped, lefty: !!ch.lefty, boxes: ch.boxes || {}, trade: ch.trade || {}, jp: ch.jp || null, quest: ch.quest, pets: ch.pets, kills: ch.stats?.kills || 0 }; };
  core.sendEcon = function (id, r) {
    const ch = this.chars.get(id); if (!ch) return;
    const slim = r && { err: r.err, silent: r.silent, msg: r.msg, give: r.give, take: r.quietTake ? null : r.take, quietGive: r.quietGive, fx: r.fx, res: r.res, loot: r.loot, pet: r.pet, tame: r.tame, quest: r.quest, questMsg: r.questMsg, levelUp: r.levelUp, fish: r.fish, raw: r.raw, giveBack: r.giveBack, sfx: r.sfx, placed: r.placed?.id, wore: r.wore, held: r.held, seq: r.seq };
    this.send(id, { t: 'econ', r: slim, c: this.charView(ch) });
    this.dirty();
  };

  const baseMessage = core.message.bind(core);
  core.message = function (id, m) {
    if (m.t === 'hello') return baseMessage(id, m);
    const me = this.players.get(id), ch = this.chars.get(id);
    if (!me || !ch) return;
    switch (m.t) {
      case 'do': { // คำขอทางเศรษฐกิจ
        const r = runAction(ch, String(m.a), m.p, this.env(id)); r.seq = m.seq;
        if (!r.err) {
          if (r.loot) { this.db.loot[r.loot.id] = r.loot.until; this.broadcast({ t: 'loot', id: r.loot.id, until: r.loot.until }, id); }
          if (r.res?.until) { this.db.res[r.res.id] = r.res.until; this.broadcast({ t: 'res', id: r.res.id, until: r.res.until }, id); }
          if (m.a === 'died') { ch.teleportOk = true; }
        }
        return this.sendEcon(id, r);
      }
      case 'csave': return this.mergeSave(id, ch, m);
      case 'respawn': ch.teleportOk = true; return;
      case 'setspawn': {
        const s = this.db.structures.find((x) => x.id === m.id && (x.type === 'bed' || x.type === 'shelter'));
        if (s && (!s.owner || s.owner === id || relLevel(this.getRel(id, s.owner)) >= 4)) ch.spawn = { x: s.x, z: s.z, y: s.y !== undefined ? s.y + 0.6 : undefined };
        return;
      }
      case 'state': {
        // กันวาร์ป: ความเร็วแนวนอนต้องไม่เกินที่เป็นไปได้
        const p = m.p; if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite)) return;
        const now = Date.now(), L = ch.lastPos;
        if (L && !ch.teleportOk) {
          const dt = Math.min(5, (now - L.t) / 1000), d = Math.hypot(p[0] - L.x, p[2] - L.z);
          if (d > (m.v ? MAX_VEHICLE : MAX_SPEED) * dt + 3) { this.send(id, { t: 'correct', p: [L.x, L.y, L.z] }); ch.warn = (ch.warn || 0) + 1; return; }
        }
        ch.teleportOk = false; ch.lastPos = { x: p[0], y: p[1], z: p[2], t: now }; ch.pos = p;
        m.hp = Math.min(m.hp, maxHpOf(ch));
        // สวมเสื้อผ้าได้เฉพาะที่มีจริง / ถือได้เฉพาะเครื่องมือที่มีจริง
        m.cl = Object.keys(WEAR_SLOTS).map((k) => ch.wear[k] || 0);
        m.eq = ch.equipped && ch.inv[ch.equipped] ? ch.equipped : null; m.lh = ch.lefty ? 1 : 0;
        return baseMessage(id, m);
      }
      case 'chat': {
        if (ch.muted) return this.send(id, { t: 'notice', text: 'คุณถูกปิดแชทชั่วคราว' });
        const now = Date.now(); ch.chatT = (ch.chatT || []).filter((t) => now - t < 10000);
        if (ch.chatT.length >= 6) return this.send(id, { t: 'notice', text: 'พิมพ์เร็วเกินไป รอสักครู่' });
        ch.chatT.push(now);
        const text = cleanText(m.text).trim(); if (!text) return;
        if (text.startsWith('/') && this.onCommand) return this.onCommand(id, text);
        return baseMessage(id, { t: 'chat', text });
      }
      // ข้อความแบบเก่าที่เชื่อไคลเอนต์ — ปิดในโหมดนี้
      case 'res': case 'loot': case 'place': case 'mfeed': case 'give': return;
      case 'sop': return this.econSop(id, ch, m);
      case 'sdel': {
        const i = this.db.structures.findIndex((x) => x.id === m.id); if (i < 0) return;
        const st = this.db.structures[i];
        if (st.owner && st.owner !== id) return this.send(id, { t: 'notice', text: 'รื้อได้เฉพาะของที่ตัวเองสร้าง' });
        const P = me.p; if (Math.hypot(P[0] - st.x, P[2] - st.z) > 10) return this.send(id, { t: 'notice', text: 'อยู่ไกลเกินไป' });
        this.db.structures.splice(i, 1); this.rebuildWalls(); this.broadcast({ t: 'sdel', id: m.id });
        return this.sendEcon(id, refundReward(ch, st));
      }
      case 'zdmg': case 'mdmg': {
        // กันตีแรง/ตีเร็ว/ตีไกลเกินจริง
        const now = Date.now();
        const tgt = this.zombies.get(m.id) || this.fauna.get(m.id); if (!tgt) return;
        let cap, reach;
        if (m.pet) {
          const pet = ch.pets.find((x) => x.id === m.pet); if (!pet) return;
          if (now - (ch.t['pet:' + pet.id] || 0) < 700) return; ch.t['pet:' + pet.id] = now;
          cap = petStats(pet).atk * 1.3; reach = 60;
        } else {
          if (now - (ch.t.atk || 0) < 350) return; ch.t.atk = now;
          const tool = ch.equipped && ch.inv[ch.equipped] ? ITEMS[ch.equipped].tool : null;
          cap = (tool ? tool.dmg : 6) * dmgMulOf(ch) * 1.3; reach = (tool ? tool.range : 2) + 3;
        }
        if (Math.hypot(me.p[0] - tgt.x, me.p[2] - tgt.z) > reach) return;
        m.dmg = Math.min(cap, Math.max(0, +m.dmg || 0));
        return baseMessage(id, m);
      }
      case 'act': return this.econSocial(id, ch, me, m);
      case 'respond': {
        const q = this.requests.get(m.reqId);
        if (q && q.action === 'marry' && m.accept) {
          const fc = this.chars.get(q.from);
          if (!fc || !fc.inv.ring) { this.requests.delete(m.reqId); return this.send(q.from, { t: 'notice', text: 'ต้องมีแหวนในกระเป๋าตอนอีกฝ่ายตอบตกลง' }); }
          applyResult(fc, { take: { ring: 1 } }); this.sendEcon(q.from, {});
        }
        return baseMessage(id, m);
      }
    }
    return baseMessage(id, m);
  };

  // ค่าใช้จ่ายของคำสั่งสิ่งก่อสร้างหักจากกระเป๋าจริง
  core.econSop = function (id, ch, m) {
    const s = this.db.structures.find((x) => x.id === m.id); if (!s || !m.op) return;
    const me = this.players.get(id), P = me.p;
    if (Math.hypot(P[0] - s.x, P[2] - s.z) > (m.op.o === 'move' ? 40 : m.op.o === 'water' && m.op.silent ? 90 : 6)) return this.send(id, { t: 'notice', text: 'อยู่ไกลเกินไป' });
    const cost = sopCost(ch, s, m.op, this.env(id));
    if (cost.err) { if (!m.op.silent) this.send(id, { t: 'notice', text: cost.err }); return; }
    const op = { ...m.op }; if (op.o === 'move') op.fuel = cost.fuel;
    const canAccess = !s.owner || s.owner === id || relLevel(this.getRel(id, s.owner)) >= 2;
    const r = applyOp(s, op, { now: Date.now(), by: id, canAccess });
    if (r.err) { if (!m.op.silent) this.send(id, { t: 'notice', text: r.err }); return; }
    Object.assign(s, r.patch);
    if ('open' in r.patch || 'x' in r.patch) this.rebuildWalls();
    this.broadcast({ t: 'supd', id: s.id, patch: r.patch });
    const give = { ...(cost.give || {}) }; for (const [k, q] of Object.entries(r.give || {})) give[k] = (give[k] || 0) + q;
    this.sendEcon(id, applyResult(ch, { take: cost.take, give, xp: cost.xp, msg: m.op.silent ? null : r.msg, quietTake: true }));
  };

  // ของขวัญ/รักษาระหว่างผู้เล่นต้องมีของจริง
  // แลกของระหว่างผู้เล่น: ตรวจว่ามีของจริง และสลับของที่เซิร์ฟเวอร์
  core.canOffer = function (id, items) {
    const ch = this.chars.get(id); if (!ch) return false;
    return Object.entries(items || {}).every(([k, q]) => ITEMS[k] && !ITEMS[k].quest && (ch.inv[k] || 0) >= q && ch.equipped !== k);
  };
  core.tradeApply = function (id, take, give) {
    const ch = this.chars.get(id); if (!ch) return;
    this.sendEcon(id, applyResult(ch, { take, give, msg: '🤝 แลกของสำเร็จ' }));
  };
  core.econSocial = function (id, ch, me, m) {
    const target = this.players.get(m.target);
    if (!target || !ACTIONS[m.action]) return;
    const rel = this.getRel(id, target.id);
    const chk = canDo(m.action, rel, this.person(id), this.person(target.id));
    if (!chk.ok) return this.send(id, { t: 'notice', text: chk.why });
    if (m.action === 'gift') {
      const r = runAction(ch, 'gift', { to: target.id, k: m.item }, this.env(id));
      if (r.err) return this.sendEcon(id, r);
      rel.pts += Math.min(20, ITEMS[m.item]?.value || 2);
      this.send(target.id, { t: 'notice', text: `🎁 ${me.name} ให้ ${ITEMS[m.item].name} กับคุณ` });
      this.relMsg(id, target.id); this.sendEcon(id, { ...r, quietTake: false }); return;
    }
    if (m.action === 'heal') {
      const r = runAction(ch, 'heal', {}, this.env(id));
      if (r.err) return this.sendEcon(id, r);
      applyAction('heal', rel);
      this.send(target.id, { t: 'healed', item: r.healItem, from: me.name });
      this.relMsg(id, target.id); this.sendEcon(id, r); return;
    }
    if (m.action === 'marry' && !ch.inv.ring) return this.send(id, { t: 'notice', text: 'ต้องมี "แหวนเศษเหล็ก"' });
    return this.act(me, m);
  };

  // บันทึกค่าที่ไม่ใช่เศรษฐกิจ (ค่าสถานะ ช่องลัด ความสัมพันธ์กับ NPC) — ตรวจขอบเขตก่อน
  core.mergeSave = function (id, ch, m) {
    const S = m.stats || {}, st = ch.stats, maxHp = 100 + (skillLevel(ch.skills.survival) - 1) * 5;
    const num = (v, a, b, d) => (Number.isFinite(+v) ? Math.max(a, Math.min(b, +v)) : d);
    Object.assign(st, { hp: num(S.hp, 0, maxHp, st.hp), hunger: num(S.hunger, 0, 100, st.hunger), thirst: num(S.thirst, 0, 100, st.thirst), stamina: num(S.stamina, 0, 300, st.stamina), infection: num(S.infection, 0, 100, st.infection), bleeding: !!S.bleeding, fracture: !!S.fracture, sick: num(S.sick, 0, 120, 0), survived: Math.max(st.survived || 0, num(S.survived, 0, 1e9, 0)) });
    if (Array.isArray(m.hotbar)) ch.hotbar = m.hotbar.slice(0, 6).map((k) => (ITEMS[k] ? k : null));
    for (const pp of m.pets || []) {
      const p = ch.pets.find((x) => x.id === pp.id); if (!p) continue;
      const st2 = petStats(p);
      p.hp = num(pp.hp, 0, st2.maxHp, p.hp); p.loyal = num(pp.loyal, 0, 100, p.loyal);
      if (Number.isFinite(+pp.xp)) p.xp = Math.min(+pp.xp, (p.xp || 0) + 120); // XP สัตว์เพิ่มได้จำกัดต่อรอบบันทึก
      p.stay = !!pp.stay; p.down = num(pp.down, 0, 60, 0);
      p.home = pp.home && this.db.structures.some((s) => s.id === pp.home && s.type === 'pethouse') ? pp.home : null;
      if (typeof pp.name === 'string') p.name = cleanText(pp.name).slice(0, 16) || p.name;
    }
    if (m.social && JSON.stringify(m.social).length < 20000) {
      // ความสัมพันธ์กับ NPC เก็บได้ แต่ห้ามแก้ของคนอื่น
      const rels = {}; for (const [k, v] of Object.entries(m.social.rels || {})) if (NPCS.some((n) => n.id === k)) rels[k] = v;
      ch.social = { rels, localPreg: m.social.localPreg || {}, localChildren: (m.social.localChildren || []).slice(0, 12) };
    }
    this.dirty();
  };

  // ฆ่าได้ของ (ทอยที่เซิร์ฟเวอร์ ให้คนที่ตีครั้งสุดท้าย)
  const baseZ = core.damageZombie.bind(core), baseF = core.damageFauna.bind(core);
  core.damageZombie = function (zid, dmg, by) {
    const zb = this.zombies.get(zid), had = !!zb, tierOf = zb?.tier | 0; baseZ(zid, dmg, by);
    if (had && !this.zombies.has(zid)) { const ch = this.chars.get(by); if (ch) this.sendEcon(by, killReward(ch, 'zombie', Math.random, tierOf)); }
  };
  core.damageFauna = function (fid, dmg, by) {
    const f = this.fauna.get(fid), had = !!f; baseF(fid, dmg, by);
    if (had && !this.fauna.has(fid) && WILD[f.k]) { const ch = this.chars.get(by); if (ch) this.sendEcon(by, killReward(ch, f.k, Math.random)); }
  };

  // ประสบการณ์เอาตัวรอด: ทุก 1 นาทีที่ออนไลน์
  const baseSlow = core.slowTick.bind(core);
  core.slowTick = function () {
    baseSlow();
    const now = Date.now();
    for (const [id, ch] of this.chars) { ch.t.surv ||= now; if (now - ch.t.surv >= 60000) { ch.t.surv = now; this.sendEcon(id, applyResult(ch, { xp: { survival: 4 }, quietGive: true })); } }
  };

  // ตอน hello: ส่งตัวละครจากเซิร์ฟเวอร์
  const baseHello = core.hello.bind(core);
  core.hello = function (id, m) {
    const ch = this.chars.get(id);
    if (ch?.pos) m.p = ch.pos;
    baseHello(id, m);
    if (ch) this.send(id, { t: 'char', c: { ...this.charView(ch), stats: ch.stats, hotbar: ch.hotbar, pos: ch.pos, spawn: ch.spawn, social: ch.social, profile: ch.profile, slots: maxSlots(ch) } });
  };
  return core;
}

function ring(P, r) { const out = [[P.x, P.z]]; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; out.push([P.x + Math.cos(a) * r, P.z + Math.sin(a) * r]); } return out; }
