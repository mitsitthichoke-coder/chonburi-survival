// ตัวกลางเรื่องไอเท็ม: ทุกการได้/เสียของผ่านที่นี่
// - เซิร์ฟเวอร์สาธารณะ (Node): ส่งคำขอ แล้วเซิร์ฟเวอร์ตอบผลพร้อมกระเป๋าจริงกลับมา (กันโกง)
// - เล่นคนเดียว / ลิงก์ claude.ai: ใช้กฎชุดเดียวกันจาก economy.js ในเครื่อง
import { runAction, applyResult, sopCost, killReward, refundReward } from './economy.js';
import { applyOp, flowersNear, accessFor, canDemolish } from './building-core.js';
import { waterAt } from './terrain.js';
import { Net } from './net.js';

const ring = (P, r) => { const out = [[P.x, P.z]]; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; out.push([P.x + Math.cos(a) * r, P.z + Math.sin(a) * r]); } return out; };

export class Authority {
  constructor(game) {
    this.g = game;
    this.server = game.net instanceof Net && game.net.online;
    this.room = game.net.online && !this.server;
    const g = game;
    this.ch = {
      get inv() { return g.inv; }, get wear() { return g.wear; }, get skills() { return g.skills; }, get pets() { return g.pets; },
      get equipped() { return g.equipped; }, set equipped(v) { g.equipped = v; },
      get lefty() { return g.lefty; }, set lefty(v) { g.lefty = v; },
      get profile() { return g.profile; }, get jp() { return g.jp; }, set jp(v) { g.jp = v; }, get social() { return { rels: g.social.rels }; }, get trade() { return g.trade || (g.trade = {}); }, set trade(v) { g.trade = v; }, get jobKit() { return g.jobKit; }, set jobKit(v) { g.jobKit = v; },
      get boxes() { return g.boxes || (g.boxes = {}); }, set boxes(v) { g.boxes = v; },
      get quest() { return g.quest; }, get stats() { return g.stats; }, t: {},
    };
  }

  env() {
    const g = this.g, W = g.world;
    const ent = (id) => g.ents.list.find((e) => !e.dead && (e.netId === id || e.uid === id));
    return {
      now: () => g.now(), rand: Math.random,
      npcPos: (nid) => { const e = g.ents.list.find((x) => !x.dead && x.id === nid); return e ? { x: e.pos.x, z: e.pos.z } : null; },
      structs: () => W.structures, myId: g.id,
      ownCount: (type) => W.structures.filter((s) => s.type === type && (!s.owner || s.owner === g.id)).length,
      pos: () => g.player.pos,
      loot: (id) => { const L = W.loot[+String(id).slice(1)]; return L && { x: L.x, z: L.z, kind: L.kind, until: L.until ? L.until + g.timeOffset : 0 }; },
      res: (id) => W.resources[id] || null,
      resUntil: (id) => (W.resources[id]?.until ? W.resources[id].until + g.timeOffset : 0),
      resHp: (id) => W.resources[id]?.hpLeft, setResHp: (id, v) => { const r = W.resources[id]; if (r) r.hpLeft = v === null ? undefined : v; },
      near: (type, P, rad) => W.nearStructure(P.x, P.z, type, rad),
      raining: () => g.weather.rain,
      sunny: () => !g.isNight() && !g.weather.rain,
      freshNear: (P) => !!W.nearestStructure(P.x, P.z, 3.5, (s) => s.type === 'pond') || ring(P, 3).some(([x, z]) => waterAt(x, z)?.fresh),
      waterNear: (P) => ring(P, 3.5).some(([x, z]) => waterAt(x, z)),
      fishKind: (x, z) => (W.nearestStructure(x, z, 1.8, (s) => s.type === 'pond') ? 'pond' : (() => { const w = waterAt(x, z); return w ? (w.fresh ? 'fresh' : 'sea') : null; })()),
      wild: (id) => { const e = ent(id); return e && e.kind === 'animal' ? { k: e.type, x: e.pos.x, z: e.pos.z, hp: e.hp, maxHp: e.maxHp } : null; },
      mob: (id) => { const e = ent(id); return e && e.kind === 'stray' ? { k: e.type, x: e.pos.x, z: e.pos.z } : null; },
      tameAdd: (id, ch, amt) => { const e = ent(id); e.tame = Math.min(100, (e.tame || 0) + amt); return e.tame; },
      tamed: (id) => { const e = ent(id); if (!e) return; if (e.netId) g.net.send({ t: 'mfeed', id: e.netId, amt: 100 }); g.ents.remove(e); },
      giveTo: () => true, // เล่นกับเพื่อนผ่านลิงก์: โฮสต์ส่งของให้ผู้รับเอง
      place: (ch, s) => {
        if (this.room) { g.net.send({ t: 'place', s }); return s; }
        const st = { ...s, id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 999), owner: g.id };
        if (st.y === undefined) delete st.y;
        W.addStructure(st); g.home.onPlaced(st); return st;
      },
    };
  }

  // คำขอทั่วไป
  do(a, p = {}) {
    const g = this.g;
    if (this.server) { g.net.send({ t: 'do', a, p }); return; }
    const r = runAction(this.ch, a, p, this.env());
    g.onEcon(r, null);
    return r;
  }

  // คำสั่งกับสิ่งก่อสร้างที่อาจมีค่าใช้จ่าย
  sop(s, op) {
    const g = this.g;
    if (this.server) return g.net.send({ t: 'sop', id: s.id, op });
    const env = this.env(), cost = sopCost(this.ch, s, op, env);
    if (cost.err) { if (!op.silent) g.ui.toast(cost.err, 'warn'); return; }
    const op2 = { ...op }; if (op.o === 'move') op2.fuel = cost.fuel; if (cost.opx) Object.assign(op2, cost.opx);
    if (this.room) {
      // เล่นผ่านลิงก์: โลกอยู่ที่โฮสต์ ค่าใช้จ่ายหักในเครื่อง (โฮสต์คืนของให้ถ้าทำไม่สำเร็จ)
      applyResult(this.ch, { take: cost.take, give: cost.give, xp: cost.xp });
      g.net.send({ t: 'sop', id: s.id, op: op2, refund: cost.take });
      g.ui.refreshPanels(); return;
    }
    const r = applyOp(s, op2, { now: g.now(), by: g.id, canAccess: true, role: accessFor(g.world.structures, s, g.id, true), flowers: s.type === 'hive' ? flowersNear(g.world.structures, s, g.now()) : 0 });
    if (r.err) { if (!op.silent) g.ui.toast(r.err, 'warn'); return; }
    g.world.updateStructure(s.id, r.patch);
    const give = { ...(cost.give || {}) }; for (const [k, q] of Object.entries(r.give || {})) give[k] = (give[k] || 0) + q;
    g.onEcon(applyResult(this.ch, { take: cost.take, give, xp: cost.xp, pet: cost.pet, msg: op.silent ? null : r.msg }), null);
  }

  sdel(s) {
    const g = this.g;
    const why = canDemolish(s, g.id); if (why) return g.ui.toast(why, 'warn');
    if (this.server || this.room) return g.net.send({ t: 'sdel', id: s.id });
    g.world.removeStructure(s.id);
    g.onEcon(refundReward(this.ch, s), null);
  }

  // ฆ่าได้ของ: ในโหมดเซิร์ฟเวอร์ เซิร์ฟเวอร์ทอยเอง
  kill(kind, tier = 0) { if (this.server) return; this.g.onEcon(killReward(this.ch, kind, Math.random, tier), null); }
}
