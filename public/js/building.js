// โหมดก่อสร้าง: เลือกชิ้นส่วน → เห็นเงา (เขียว=วางได้ แดง=วางไม่ได้) → คลิกวาง · Q หมุน · X รื้อ
import { PIECES, coinCost, G, WALL_H, cellOf, cellCenter, slotPos, slotKey, baseY, refundFor } from './building-core.js';
import { makeGhost } from './structures3d.js';
import { heightAt, waterAt } from './terrain.js';
import { skillLevel, ITEMS, buildCost, canBuild, learnHint } from './data.js';

const GROUND_ONLY = new Set(['foundation', 'plot', 'coop', 'duckpen', 'pigpen', 'cowpen', 'buffalopen', 'sheeppen', 'pond']);

export class Builder {
  constructor(game) { this.g = game; this.type = null; this.rot = 0; this.ghost = null; this.ghostKey = ''; this.demolish = false; this.cand = null; this.target = null; }
  get active() { return !!this.type || this.demolish; }

  start(type, coin = false) {
    const g = this.g; this.coin = coin;
    if (!canBuild(g.inv)) return g.ui.toast('ต้องมีค้อนก่อน — 🪵 ค้อนไม้ (ไม้ 3 + เส้นใย 1) หรือ 🔨 ค้อนช่างไม้', 'warn');
    if (skillLevel(g.skills.building) < PIECES[type].lvl) return g.ui.toast(`ต้องมีทักษะก่อสร้าง Lv${PIECES[type].lvl}`, 'warn');
    if (PIECES[type].learn && !g.boxes?.['learn_' + PIECES[type].learn]) return g.ui.toast(learnHint(PIECES[type].learn), 'warn');
    this.stop(); this.type = type; g.ui.closeAll();
    g.ui.toast(`🔨 ${PIECES[type].name}: ${g.touch ? '✅ วาง · ↻ หมุน · ✖ ออก' : 'คลิกซ้าย = วาง · Q = หมุน · X = โหมดรื้อ · Esc = ออก'}`);
  }
  startDemolish() { this.stop(); this.demolish = true; this.g.ui.closeAll(); this.g.ui.toast('🗑️ โหมดรื้อ: เล็งไปที่สิ่งที่คุณสร้างแล้วคลิก/กด ✅ เพื่อรื้อ (ได้วัสดุคืนครบ)'); }
  stop() { if (this.ghost) this.g.scene.remove(this.ghost); this.ghost = null; this.ghostKey = ''; this.type = null; this.demolish = false; this.cand = null; this.target = null; }
  rotateNext() { this.rot = (this.rot + 1) & 3; this.ghostKey = ''; }

  aim(dist) {
    const g = this.g, a = g.camYaw + Math.PI, P = g.player.pos;
    return { x: P.x + Math.sin(a) * dist, z: P.z + Math.cos(a) * dist };
  }

  // ระดับพื้นที่ใช้ได้ในช่องนี้: พื้นดิน ฐานราก หลังคา(พื้นชั้นบน)
  levels(cx, cz) {
    const W = this.g.world, [x, z] = cellCenter(cx, cz);
    const hs = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([dx, dz]) => heightAt(x + dx * G / 2, z + dz * G / 2));
    const ground = Math.max(...hs), drop = ground - Math.min(...hs);
    const out = [{ y: ground, kind: 'ground', drop }];
    for (const s of W.structures) {
      if (Math.abs(s.x - x) > 0.1 || Math.abs(s.z - z) > 0.1) continue;
      if (s.type === 'foundation') out.push({ y: baseY(s) + 0.5, kind: 'floor' });
      if (s.type === 'roof' || s.type === 'balcony') out.push({ y: baseY(s) + 0.2, kind: 'floor' });
    }
    return out.sort((a, b) => a.y - b.y);
  }

  candidate() {
    const g = this.g, P = g.player.pos, type = this.type, def = PIECES[type];
    const A = this.aim(def.snap === 'edge' ? 2.6 : 3.4);
    let [cx, cz] = cellOf(A.x, A.z);
    let rot = this.rot;
    if (def.snap === 'edge') {
      // เลือกขอบช่องที่ใกล้จุดเล็งที่สุด
      const [mx, mz] = cellCenter(cx, cz), dx = A.x - mx, dz = A.z - mz;
      rot = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 2 : 0);
    }
    const lv = this.levels(cx, cz);
    const usable = lv.filter((l) => l.y <= P.y + 1.2);
    const level = usable[usable.length - 1] || lv[0];
    const pos = slotPos(type, cx, cz, rot);
    let y = level.y, why = '';
    if (type === 'roof' || type === 'slope') y = level.y + WALL_H - (level.kind === 'floor' ? 0 : 0);
    if ((GROUND_ONLY.has(type) || type.startsWith('plot_')) && level.kind !== 'ground') why = 'ต้องวางบนพื้นดิน';
    if (def.snap === 'edge' && level.kind === 'ground') y = Math.min(heightAt(pos.x - (rot & 1 ? 0 : 1.4), pos.z - (rot & 1 ? 1.4 : 0)), heightAt(pos.x + (rot & 1 ? 0 : 1.4), pos.z + (rot & 1 ? 1.4 : 0)));
    const W = g.world;
    let sd;
    if (type === 'walllamp') {
      // โคมติดผนัง: ต้องเล็งที่ผนัง/หน้าต่าง/ประตูที่มีอยู่ · ติดฝั่งที่ผู้เล่นยืนอยู่
      const wl = W.structures.filter((o) => ['wall', 'window', 'door', 'bamboo_wall'].includes(o.type) && Math.abs(o.x - pos.x) < 0.1 && Math.abs(o.z - pos.z) < 0.1).sort((a, b) => Math.abs(baseY(a) - P.y) - Math.abs(baseY(b) - P.y))[0];
      if (wl) { y = baseY(wl); rot = wl.rot; sd = (rot & 1 ? P.x - pos.x : P.z - pos.z) >= 0 ? 1 : -1; } else why = 'ต้องเล็งไปที่ผนังบ้าน (ติดได้ทั้งด้านในและด้านนอก)';
    }
    if (type === 'balcony') {
      // ระเบียง: ต่อจากหลังคา/พื้นชั้นบนที่อยู่ติดกัน ระดับเดียวกับพื้นชั้นบน · ด้านที่ติดบ้านไม่มีราว
      const [bx, bz] = cellCenter(cx, cz), DD = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      let hit = null; for (let r = 0; r < 4 && !hit; r++) { const nx = bx + DD[r][0] * G, nz = bz + DD[r][1] * G, o = W.structures.find((q) => (q.type === 'roof' || q.type === 'balcony') && Math.abs(q.x - nx) < 0.1 && Math.abs(q.z - nz) < 0.1); if (o) hit = { o, r }; }
      if (hit) { y = baseY(hit.o); rot = hit.r; } else why = 'ระเบียงต้องต่อจากหลังคา/พื้นชั้นบนที่อยู่ช่องติดกัน';
      if (!why && W.structures.some((q) => (q.type === 'roof' || q.type === 'balcony') && Math.abs(q.x - bx) < 0.1 && Math.abs(q.z - bz) < 0.1)) why = 'มีพื้นชั้นบนอยู่ตรงนี้แล้ว';
    }
    const s = { type, x: pos.x, z: pos.z, y: +y.toFixed(2), rot, drop: type === 'foundation' ? +(level.drop + 0.3).toFixed(2) : undefined, sd };
    if (!why && (heightAt(pos.x, pos.z) < 0.4 || waterAt(pos.x, pos.z)) && level.kind === 'ground') why = 'วางในน้ำไม่ได้';
    if (!why && W.baseBuildings.some((b) => Math.abs(b.x - pos.x) < b.w / 2 + 0.6 && Math.abs(b.z - pos.z) < b.d / 2 + 0.6)) why = 'ติดอาคารเดิม';
    const key = slotKey(s);
    if (!why && W.structures.some((o) => PIECES[o.type] && slotKey(o) === key)) why = 'มีชิ้นส่วนอยู่ตรงนี้แล้ว';
    if (!why && (type === 'roof' || type === 'slope') && level.kind === 'ground' && !W.structures.some((o) => ['wall', 'window', 'door'].includes(o.type) && Math.hypot(o.x - pos.x, o.z - pos.z) < 1.7)) why = 'หลังคาต้องมีผนังรองรับอย่างน้อย 1 ด้าน';
    if (!why && Math.abs(y - P.y) > (type === 'balcony' ? 5.5 : 4.5)) why = 'อยู่สูง/ต่ำเกินไป';
    // ซื้อด้วยเงินจิ = ไม่ต้องมีวัสดุ ใช้แค่เงินจิ
    const cost = this.coin || def.cost.jicoin ? { jicoin: coinCost(def, ITEMS) } : buildCost(g.auth.ch, def.cost);
    const missing = Object.entries(cost).filter(([k, q]) => !g.hasItem(k, q));
    if (!why && missing.length) why = 'วัสดุไม่พอ: ' + missing.map(([k, q]) => `${ITEMS[k].name} ${g.inv[k] || 0}/${q}`).join(', ');
    return { s, ok: !why, why };
  }

  update() {
    const g = this.g;
    if (this.demolish) {
      const A = this.aim(2.6);
      this.target = g.world.nearestStructure(A.x, A.z, 2.2, (s) => !s.owner || s.owner === g.id);
      return;
    }
    if (!this.type) return;
    const c = this.cand = this.candidate();
    const key = slotKey(c.s) + c.ok + c.s.rot + c.s.y;
    if (key !== this.ghostKey) {
      if (this.ghost) g.scene.remove(this.ghost);
      this.ghost = makeGhost(c.s, c.ok); g.scene.add(this.ghost); this.ghostKey = key;
    }
  }

  prompt() {
    const kb = !this.g.touch;
    if (this.demolish) return this.target ? `🗑️ รื้อ ${PIECES[this.target.type]?.name || ITEMS[this.target.vt]?.name || this.target.type} ${kb ? '(คลิก)' : '(✅)'}` : `🗑️ โหมดรื้อ — เล็งไปที่สิ่งที่คุณสร้าง ${kb ? '· Esc ออก' : ''}`;
    if (!this.cand) return '';
    const d = PIECES[this.type];
    return `🔨 ${d.icon} ${d.name} · ${this.coin || d.cost.jicoin ? `🪙${coinCost(d, ITEMS)}` : Object.entries(buildCost(this.g.auth.ch, d.cost)).map(([k, q]) => `${ITEMS[k].icon}${q}`).join(' ')} — ${this.cand.ok ? (kb ? 'คลิก=วาง · Q=หมุน · X=รื้อ · Esc=ออก' : '✅ วาง · ↻ หมุน') : '❌ ' + this.cand.why}`;
  }

  // คลิก/✅
  confirm() {
    const g = this.g;
    if (this.demolish) {
      const t = this.target; if (!t) return;
      if (g.vehicle && g.vehicle.s.id === t.id) return g.ui.toast('ลงจากยานพาหนะก่อน', 'warn');
      g.demolishStructure(t); this.target = null; return;
    }
    const c = this.cand || this.candidate();
    if (!c.ok) return g.ui.toast(c.why, 'warn');
    g.placeStructure({ ...c.s, coin: this.coin ? 1 : undefined }); // ระบบเศรษฐกิจหักวัสดุ (หรือเงินจิ) และให้ประสบการณ์ก่อสร้าง
    this.ghostKey = '';
  }
}
export { refundFor };
