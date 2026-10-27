// ผังเมือง ถนน และจุดภารกิจ แบบไม่พึ่ง three.js — ใช้ร่วมกันทั้งไคลเอนต์และเซิร์ฟเวอร์
// (เซิร์ฟเวอร์ใช้กำแพงอาคารเพื่อไม่ให้ผู้ติดเชื้อเดินทะลุตึก)
import { heightAt, waterAt, coastX, latToZ, mulberry32 } from './terrain.js';
import { TOWNS, QUEST_SPOTS } from './data.js';
import { rampHeight } from './building-core.js';

let cached = null;
export function getLayout() { return (cached ||= buildLayout()); }

function buildLayout() {
  const roads = [];
  const suk = [];
  for (let z = latToZ(13.45); z < latToZ(12.64); z += 4) {
    let x = coastX(z) + 30;
    while (waterAt(x, z) || heightAt(x, z) < 0.8) x += 4;
    suk.push([x, z]);
  }
  roads.push({ pts: suk, width: 6, main: true });
  const T = Object.fromEntries(TOWNS.map((t) => [t.key, [t.x, t.z]]));
  const line = (pts) => {
    const out = [];
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1], [x1, z1] = pts[i]; const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 4);
      for (let k = 0; k <= n; k++) out.push([x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n]);
    }
    roads.push({ pts: out, width: 4.5 });
  };
  line([T.chonburi, T.phanat]);
  line([T.chonburi, T.banbueng]);
  line([T.sriracha, [40, -230], T.banbueng]);
  line([T.pattaya, [T.pattaya[0] + 120, T.pattaya[1] - 20]]);
  line([T.banbueng, T.khaokheow]);
  const roadPts = roads.flatMap((r) => r.pts);

  // พื้นที่ห้ามสร้างตึก: จุดภารกิจและค่ายอพยพ
  const keepOut = Object.values(QUEST_SPOTS).map((s) => ({ x: s.x, z: s.z, r: s.keepOut || 8 }));
  const blocked = (x, z, w, d) => keepOut.some((k) => Math.abs(k.x - x) < w / 2 + k.r && Math.abs(k.z - z) < d / 2 + k.r);

  const rng = mulberry32(1234);
  const boxes = [], buildings = [], loot = [], cars = [];
  for (const t of TOWNS) {
    let placed = 0, tries = 0;
    while (placed < t.n && tries++ < t.n * 30) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * t.r;
      const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
      const w = 5 + rng() * 9, d = 5 + rng() * 9;
      let ok = true;
      for (const [cx, cz] of [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x - w / 2, z + d / 2], [x + w / 2, z + d / 2]])
        if (heightAt(cx, cz) < 0.9 || waterAt(cx, cz)) ok = false;
      if (!ok) continue;
      if (buildings.some((b) => Math.abs(b.x - x) < (b.w + w) / 2 + 3 && Math.abs(b.z - z) < (b.d + d) / 2 + 3)) continue;
      if (roadPts.some(([rx, rz]) => Math.abs(rx - x) < w / 2 + 4 && Math.abs(rz - z) < d / 2 + 4)) continue;
      if (blocked(x, z, w, d)) continue;
      const h = (3.5 + rng() * rng() * 22) * t.tall;
      const y0 = Math.min(heightAt(x - w / 2, z - d / 2), heightAt(x + w / 2, z + d / 2), heightAt(x, z)) - 1;
      const g = 0.35 + rng() * 0.35;
      boxes.push({ x, z, w, d, h, y0, rgb: [g + 0.05, g, g - 0.03 + rng() * 0.06], burnt: rng() < 0.25 });
      buildings.push({ x, z, w, d, top: y0 + h + 1 });
      placed++;
      const nl = rng() < 0.75 ? 1 + (rng() < 0.3) : 0;
      for (let k = 0; k < nl; k++) {
        const side = rng() * 4 | 0; const off = 1.2;
        const lx = side < 2 ? x + (side ? 1 : -1) * (w / 2 + off) : x + (rng() - 0.5) * w;
        const lz = side >= 2 ? z + (side === 2 ? 1 : -1) * (d / 2 + off) : z + (rng() - 0.5) * d;
        loot.push({ x: lx, z: lz, kind: 'crate' });
      }
    }
  }
  for (let i = 0; i < roadPts.length; i++) if (rng() < 0.03) {
    const [x, z] = roadPts[i]; const ox = (rng() - 0.5) * 3;
    cars.push({ x: x + ox, z, ry: rng() * Math.PI, hue: rng() });
    loot.push({ x: x + ox, z, kind: 'car' });
  }

  // ค่ายอพยพสัตหีบ: รั้วสี่ด้าน + ประตูทางทิศเหนือ
  const c = QUEST_SPOTS.camp, half = c.size / 2, th = 0.6, top = heightAt(c.x, c.z) + 4;
  const gateW = 6;
  const fence = [
    { x: c.x, z: c.z + half, w: c.size, d: th }, // ใต้
    { x: c.x - half, z: c.z, w: th, d: c.size }, // ตะวันตก
    { x: c.x + half, z: c.z, w: th, d: c.size }, // ตะวันออก
    { x: c.x - (half + gateW / 2) / 2, z: c.z - half, w: half - gateW / 2, d: th }, // เหนือ ซ้ายประตู
    { x: c.x + (half + gateW / 2) / 2, z: c.z - half, w: half - gateW / 2, d: th }, // เหนือ ขวาประตู
  ].map((f) => ({ ...f, top: top + 6, fence: true }));
  const gate = { x: c.x, z: c.z - half, w: gateW, d: th, top: top + 6, gate: true };
  return { roads, roadPts, boxes, buildings, loot, cars, fence, gate };
}

// ดันวัตถุออกจากกล่องชน (อาคาร/รั้ว)
// คืนค่ากล่องที่ชน (ใช้ตรวจว่ากำลังชิดกำแพงที่ปีนได้หรือไม่)
// b.top - 1 = ระดับหลังคา: ถ้ายืนอยู่บนหลังคาแล้วจะไม่ถูกดันออก
export function collideBoxes(list, pos, radius = 0.4) {
  let hit = null;
  for (const b of list) {
    if (b.noCollide) continue;
    if (Math.abs(pos.x - b.x) > b.w / 2 + 3 || Math.abs(pos.z - b.z) > b.d / 2 + 3) continue;
    if (pos.y !== undefined) {
      if (pos.y > b.top - (b.step ? 1.75 : 1.35)) continue; // ยืนอยู่ด้านบนแล้ว (ฐานรากเตี้ยก้าวขึ้นได้)
      if (b.bottom !== undefined && pos.y + 1.7 < b.bottom) continue; // ลอดใต้หลังคา/คานประตู
    }
    const hx = b.w / 2 + radius, hz = b.d / 2 + radius;
    const dx = pos.x - b.x, dz = pos.z - b.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      if (hx - Math.abs(dx) < hz - Math.abs(dz)) pos.x = b.x + Math.sign(dx || 1) * hx; else pos.z = b.z + Math.sign(dz || 1) * hz;
      hit = b;
    }
  }
  return hit;
}

// ระดับพื้นผิวใต้ตำแหน่งนี้ (หลังคา ฐานราก บันได) ถ้ายืนอยู่บนนั้น ไม่งั้น null
export function roofUnder(list, x, z, y) {
  let best = null;
  for (const b of list) {
    if (b.fence || b.gate) continue;
    if (Math.abs(x - b.x) > b.w / 2 + 0.05 || Math.abs(z - b.z) > b.d / 2 + 0.05) continue;
    const roof = b.ramp ? rampHeight(b, x, z) : b.top - 1;
    const reach = b.ramp ? 0.9 : b.step ? 0.75 : 0.6;
    if (y >= roof - reach && (best === null || roof > best)) best = roof;
  }
  return best;
}

export function inCamp(x, z, pad = 0) {
  const c = QUEST_SPOTS.camp, h = c.size / 2 + pad;
  return Math.abs(x - c.x) < h && Math.abs(z - c.z) < h;
}
