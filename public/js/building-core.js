// กฎของการก่อสร้าง ฟาร์ม เล้าไก่ บ่อปลา หีบเก็บของ และยานพาหนะ (ไม่พึ่ง three.js)
// ใช้ร่วมกันทั้งเซิร์ฟเวอร์ (server-core.js) และไคลเอนต์ เพื่อให้ทุกคนเห็นผลเหมือนกัน
import { heightAt } from './terrain.js';

export const G = 3;        // ขนาดช่องกริด (1 ช่อง = 3 หน่วย ≈ 150 ม. ในสเกลแผนที่ แต่ในเกมคือห้องขนาดพอดีตัว)
export const WALL_H = 3;   // ความสูงผนัง
export const FENCE_H = 1.8;

// snap: 'cell' = กลางช่อง, 'edge' = ขอบช่อง (ผนัง/รั้ว) · lvl = ทักษะก่อสร้างที่ต้องมี
export const PIECES = {
  foundation: { name: 'ฐานรากไม้', icon: '🟫', cost: { wood: 4, stone: 2 }, snap: 'cell', cat: 'โครงบ้าน', lvl: 1 },
  wall: { name: 'ผนังไม้', icon: '🧱', cost: { wood: 4 }, snap: 'edge', cat: 'โครงบ้าน', lvl: 1 },
  window: { name: 'ผนังหน้าต่าง', icon: '🪟', cost: { wood: 3, fiber: 1 }, snap: 'edge', cat: 'โครงบ้าน', lvl: 1 },
  door: { name: 'ผนังประตู', icon: '🚪', cost: { wood: 5, scrap: 1 }, snap: 'edge', cat: 'โครงบ้าน', lvl: 1 },
  roof: { name: 'หลังคา / พื้นชั้นบน', icon: '🏠', cost: { wood: 3, fiber: 2 }, snap: 'cell', cat: 'โครงบ้าน', lvl: 1 },
  stairs: { name: 'บันไดขึ้นชั้นบน', icon: '🪜', cost: { wood: 4 }, snap: 'cell', cat: 'โครงบ้าน', lvl: 2 },
  fence: { name: 'รั้วไม้', icon: '🪵', cost: { wood: 2, fiber: 1 }, snap: 'edge', cat: 'รั้ว', lvl: 1 },
  gate: { name: 'ประตูรั้ว', icon: '⛩️', cost: { wood: 3 }, snap: 'edge', cat: 'รั้ว', lvl: 1 },
  bed: { name: 'เตียงนอน (จุดเกิด)', icon: '🛏️', cost: { wood: 3, cloth: 3 }, snap: 'cell', cat: 'ของในบ้าน', lvl: 1 },
  storage: { name: 'หีบเก็บของ (ใช้ร่วมกันได้)', icon: '🧰', cost: { wood: 6 }, snap: 'cell', cat: 'ของในบ้าน', lvl: 1 },
  pethouse: { name: 'บ้านสัตว์เลี้ยง', icon: '🏡', cost: { wood: 6, cloth: 2 }, snap: 'cell', cat: 'ของในบ้าน', lvl: 1 },
  plot: { name: 'แปลงผัก', icon: '🌱', cost: { wood: 2, fiber: 2 }, snap: 'cell', cat: 'ฟาร์ม', lvl: 1 },
  coop: { name: 'เล้าไก่ (มีแม่ไก่ 2 ตัว)', icon: '🐔', cost: { wood: 8, fiber: 4, berry: 3 }, snap: 'cell', cat: 'ฟาร์ม', lvl: 2 },
  pond: { name: 'บ่อเลี้ยงปลา', icon: '🐟', cost: { stone: 6, wood: 2 }, snap: 'cell', cat: 'ฟาร์ม', lvl: 2 },
};
export const isPiece = (type) => !!PIECES[type];

export const CROPS = {
  corn: { name: 'ข้าวโพด', seed: 'seeds_corn', grow: 6 * 60000, out: ['corn', 3], seedBack: [1, 2], color: '#e9c46a' },
  veg: { name: 'ผักบุ้ง', seed: 'seeds_veg', grow: 4 * 60000, out: ['veg', 3], seedBack: [1, 2], color: '#52b788' },
  herb: { name: 'ฟ้าทะลายโจร', seed: 'herb', grow: 5 * 60000, out: ['herb', 3], seedBack: [0, 0], color: '#80b918' },
};
export const DRY_RATE = 0.35;              // โตช้าลงถ้าไม่ได้รดน้ำ
export const EGG_MS = 3 * 60000;
export const POND_MS = 6 * 60000;
export const FEED_MS = 8 * 60000, FEED_MAX = 40 * 60000;
export const FEEDS = ['corn', 'veg', 'berry', 'seeds_corn', 'seeds_veg'];

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 0=เหนือ 1=ตะวันออก 2=ใต้ 3=ตะวันตก
export const cellOf = (x, z) => [Math.floor(x / G), Math.floor(z / G)];
export const cellCenter = (cx, cz) => [(cx + 0.5) * G, (cz + 0.5) * G];
// ตำแหน่งของชิ้นส่วนบนกริด
export function slotPos(type, cx, cz, rot) {
  const [x, z] = cellCenter(cx, cz);
  if (PIECES[type]?.snap !== 'edge') return { x, z };
  const [dx, dz] = DIRS[rot & 3];
  return { x: x + dx * G / 2, z: z + dz * G / 2 };
}
export const slotKey = (s) => `${PIECES[s.type]?.snap === 'edge' ? 'e' : s.type === 'roof' ? 'r' : s.type === 'foundation' ? 'f' : 'c'}:${Math.round(s.x * 10)}:${Math.round(s.z * 10)}:${Math.round(s.y || 0)}`;
export const baseY = (s) => (s.y !== undefined ? s.y : heightAt(s.x, s.z));

// กล่องชนของสิ่งก่อสร้าง: {x,z,w,d,top,bottom?,step?,ramp?,noCollide?}  (top - 1 = ระดับพื้นผิวด้านบน)
export function collidersFor(s) {
  const y = baseY(s), out = [], sid = s.id;
  const along = (s.rot & 1) === 0; // ผนังวางแนวแกน x
  const edge = (len, thick, h, off = 0, bottom) => {
    const [ax, az] = along ? [off, 0] : [0, off];
    out.push({ x: s.x + ax, z: s.z + az, w: along ? len : thick, d: along ? thick : len, top: y + h + 1, bottom, sid });
  };
  switch (s.type) {
    case 'foundation': out.push({ x: s.x, z: s.z, w: G, d: G, top: y + 0.5 + 1, step: true, sid }); break;
    case 'wall': case 'window': edge(G, 0.3, WALL_H, 0, y); break;
    case 'door': edge(0.9, 0.3, WALL_H, -1.05, y); edge(0.9, 0.3, WALL_H, 1.05, y); edge(1.2, 0.3, WALL_H, 0, y + 2.3); if (!s.open) edge(1.2, 0.3, 2.3, 0, y); break;
    case 'fence': edge(G, 0.2, FENCE_H, 0, y); break;
    case 'gate': edge(0.3, 0.2, FENCE_H, -1.35, y); edge(0.3, 0.2, FENCE_H, 1.35, y); if (!s.open) edge(2.4, 0.2, FENCE_H, 0, y); break;
    case 'roof': out.push({ x: s.x, z: s.z, w: G, d: G, top: y + 0.2 + 1, bottom: y, sid }); break;
    case 'stairs': out.push({ x: s.x, z: s.z, w: G, d: G, ramp: true, noCollide: true, base: y, rise: WALL_H, dir: s.rot & 3, top: y + WALL_H + 1, sid }); break;
    case 'storage': out.push({ x: s.x, z: s.z, w: 1.2, d: 0.8, top: y + 0.9 + 1, sid }); break;
    case 'pethouse': out.push({ x: s.x, z: s.z, w: 1.6, d: 1.6, top: y + 1.4 + 1, sid }); break;
    case 'coop': out.push({ x: s.x, z: s.z, w: 2.8, d: 2.8, top: y + 2 + 1, sid }); break;
    case 'watchtower': out.push({ x: s.x, z: s.z, w: 2.6, d: 2.6, top: y + 4.5 + 1, tower: true, sid }); break;
  }
  return out;
}

// ความสูงพื้นของทางลาด (บันได) ที่ตำแหน่ง x,z
export function rampHeight(b, x, z) {
  let t;
  switch (b.dir) {
    case 0: t = (b.z + G / 2 - z) / G; break;
    case 1: t = (x - (b.x - G / 2)) / G; break;
    case 2: t = (z - (b.z - G / 2)) / G; break;
    default: t = (b.x + G / 2 - x) / G;
  }
  return b.base + Math.max(0, Math.min(1, t)) * b.rise;
}

// ---------- ฟาร์ม ----------
export function cropProgress(s, now) {
  if (!s.crop) return 0;
  const C = CROPS[s.crop]; if (!C) return 0;
  const dry = s.wt ? s.wt - s.pt : now - s.pt, wet = s.wt ? now - s.wt : 0;
  return Math.min(1, (dry * DRY_RATE + wet) / C.grow);
}
const overlap = (a0, a1, b1) => Math.max(0, Math.min(a1, b1) - a0);
function settle(s, now, period, cap, key) {
  const fedMs = overlap(s.lt || now, now, s.fed || 0);
  const made = Math.floor(fedMs / period);
  return { [key]: Math.min(cap, (s[key] || 0) + made), lt: now };
}
export function coopEggs(s, now) { return settle(s, now, EGG_MS, 8, 'eggs').eggs; }
export function pondPeriod(s) { return POND_MS / Math.max(1, Math.min(4, s.stock || 0)) / (s.gold ? 2 : 1); }
export function pondFish(s, now) { return (s.stock || 0) < 1 ? s.fish || 0 : settle(s, now, pondPeriod(s), 8, 'fish').fish; }
export const fedLeft = (s, now) => Math.max(0, (s.fed || 0) - now);

// ใช้กับสิ่งก่อสร้าง 1 ครั้ง — คืน {patch, give, err, msg}
// ctx = {now, by, canAccess, rand}
// ผู้เรียกต้องหักของที่ผู้เล่นใช้ (เมล็ด อาหาร ของฝาก) ก่อนส่งมา
export function applyOp(s, op, ctx) {
  const now = ctx.now, rand = ctx.rand || Math.random;
  switch (op.o) {
    case 'door':
      if (s.lock && !ctx.canAccess) return { err: '🔒 ประตูนี้ล็อกไว้ (เปิดได้เฉพาะเจ้าของและเพื่อนของเจ้าของ)' };
      return { patch: { open: !s.open } };
    case 'lock':
      if (s.owner && s.owner !== ctx.by) return { err: 'ล็อก/ปลดล็อกได้เฉพาะเจ้าของ' };
      return { patch: { lock: !s.lock }, msg: !s.lock ? '🔒 ล็อกแล้ว — เข้าได้เฉพาะคุณและเพื่อนระดับ "เพื่อน" ขึ้นไป' : '🔓 ปลดล็อกแล้ว' };
    case 'plant':
      if (s.crop) return { err: 'แปลงนี้ปลูกอยู่แล้ว' };
      if (!CROPS[op.crop]) return { err: 'ไม่รู้จักพืชนี้' };
      return { patch: { crop: op.crop, pt: now, wt: null }, msg: `🌱 ปลูก${CROPS[op.crop].name}แล้ว รดน้ำเพื่อให้โตเร็วขึ้น` };
    case 'water':
      if (!s.crop || s.wt) return { err: 'ไม่ต้องรดน้ำตอนนี้' };
      return { patch: { wt: now }, msg: '💧 รดน้ำแล้ว' };
    case 'harvest': {
      if (!s.crop || cropProgress(s, now) < 1) return { err: 'ยังไม่สุก' };
      const C = CROPS[s.crop], give = { [C.out[0]]: C.out[1] };
      const sb = C.seedBack[0] + Math.floor(rand() * (C.seedBack[1] - C.seedBack[0] + 1));
      if (sb) give[C.seed] = (give[C.seed] || 0) + sb;
      return { patch: { crop: null, pt: null, wt: null }, give, msg: `🧺 เก็บเกี่ยว${C.name}แล้ว` };
    }
    case 'feed': {
      const st = s.type === 'coop' ? settle(s, now, EGG_MS, 8, 'eggs') : (s.stock || 0) >= 1 ? settle(s, now, pondPeriod(s), 8, 'fish') : { lt: now };
      if (fedLeft(s, now) > FEED_MAX - FEED_MS) return { err: 'ยังอิ่มอยู่' };
      return { patch: { ...st, fed: Math.max(now, s.fed || 0) + FEED_MS }, msg: s.type === 'coop' ? '🐔 ให้อาหารไก่แล้ว' : '🐟 ให้อาหารปลาแล้ว' };
    }
    case 'collect': {
      if (s.type === 'coop') {
        const n = coopEggs(s, now);
        if (!n) return { err: 'ยังไม่มีไข่ (ต้องให้อาหารไก่ก่อน)' };
        return { patch: { eggs: 0, lt: now }, give: { egg: n }, msg: `🥚 เก็บไข่ได้ ${n} ฟอง` };
      }
      const n = pondFish(s, now);
      if (!n) return { err: 'ยังไม่มีปลาให้จับ (ต้องปล่อยปลาและให้อาหาร)' };
      return { patch: { fish: 0, lt: now }, give: { raw_fish: n }, msg: `🐟 จับปลาจากบ่อได้ ${n} ตัว` };
    }
    case 'stock': {
      if ((s.stock || 0) >= 6) return { err: 'บ่อเต็มแล้ว' };
      const st = (s.stock || 0) >= 1 ? settle(s, now, pondPeriod(s), 8, 'fish') : { lt: now };
      return { patch: { ...st, stock: (s.stock || 0) + 1, gold: s.gold || op.item === 'golden_fish' }, msg: op.item === 'golden_fish' ? '🐡 ปล่อยปลาทองลงบ่อ ปลาจะเพิ่มเร็วขึ้น 2 เท่า!' : '🐟 ปล่อยปลาลงบ่อแล้ว' };
    }
    case 'store': {
      const items = { ...(s.items || {}) }, q = op.qty | 0;
      if (!q) return { err: 'จำนวนไม่ถูกต้อง' };
      if (q < 0) {
        if ((items[op.item] || 0) < -q) return { err: 'ของในหีบไม่พอ' };
        if (s.lock && !ctx.canAccess) return { err: '🔒 หีบนี้ล็อกไว้' };
        items[op.item] += q; if (!items[op.item]) delete items[op.item];
        return { patch: { items }, give: { [op.item]: -q } };
      }
      items[op.item] = (items[op.item] || 0) + q;
      return { patch: { items } };
    }
    case 'move':
      return { patch: { x: +op.x, z: +op.z, ry: +op.ry || 0, fuel: op.fuel ?? s.fuel, driver: null } };
    case 'drive':
      if (s.driver && s.driver !== ctx.by && now - (s.dt || 0) < 15000) return { err: 'มีคนขับอยู่แล้ว' };
      return { patch: { driver: op.on ? ctx.by : null, dt: now } };
    case 'pethome':
      return { patch: {} };
  }
  return { err: 'ทำไม่ได้' };
}

// ค่าคืนเมื่อรื้อ (ครึ่งหนึ่งของวัสดุ + ของในหีบ)
export function refundFor(s) {
  const give = {};
  for (const [k, q] of Object.entries(PIECES[s.type]?.cost || {})) { const r = Math.floor(q / 2); if (r) give[k] = r; }
  for (const [k, q] of Object.entries(s.items || {})) give[k] = (give[k] || 0) + q;
  if (s.type === 'vehicle') give[s.vt] = 1;
  return give;
}
