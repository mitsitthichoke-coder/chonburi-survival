// 🏡 ฐานสำเร็จรูปประจำอำเภอ: อำเภอละ 1 ฐาน ขนาดสุ่มคงที่ (4×4 · 6×6 · 8×8 ช่อง) ซื้อด้วยเงินจิที่ป้ายราคาหน้ารั้ว
// ใช้ร่วมกันทั้งไคลเอนต์และเซิร์ฟเวอร์ (ไม่พึ่ง three.js)
import { TOWNS } from './data.js';
import { hash2, heightAt, waterAt } from './terrain.js';
import { fenceRing, prefabHouse, cellOf, cellCenter, G } from './building-core.js';
import { landNear, CAMPS } from './quest-core.js';
import { getLayout } from './citygen.js';

export const BASE_DISTRICTS = ['chonburi', 'banbueng', 'nongyai', 'banglamung', 'phanthong', 'phanat', 'sriracha', 'sichang', 'sattahip', 'bothong', 'kochan'];
export const BASE_SIZES = [4, 6, 8]; // ราคา = n × 1111 → 4444 · 6666 · 8888
export const basePrice = (n) => n * 1111;

let memo = null;
export function baseSites() {
  if (memo) return memo;
  memo = BASE_DISTRICTS.map((d, i) => {
    const t = TOWNS.find((x) => x.key === d), n = d === 'sichang' ? 4 : BASE_SIZES[Math.floor(hash2(i * 13 + 5, 77) * 3)]; // เกาะสีชังเล็ก ใช้ฐานเล็กสุด
    // ตั้งนอกเขตอาคารของเมือง ทิศคงที่ต่ออำเภอ ลองหลายทิศหาที่โล่งบนบก
    let p = null; const L = getLayout(), half = n * G / 2 + (d === 'sichang' ? 0.5 : 3); // เกาะสีชังแคบ ลดระยะเว้นขอบ
    const clear = (q) => [[0, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]].every(([dx, dz]) => { const px = q.x + dx * n * G * 0.5, pz = q.z + dz * n * G * 0.5; return heightAt(px, pz) > 1.2 && !waterAt(px, pz); })
      && !CAMPS.some((c) => Math.abs(c.x - q.x) < c.size / 2 + half && Math.abs(c.z - q.z) < c.size / 2 + half)
      && !L.boxes.some((bx) => Math.abs(bx.x - q.x) < half + bx.w / 2 && Math.abs(bx.z - q.z) < half + bx.d / 2)
      && !L.buildings.some((bx) => Math.abs(bx.x - q.x) < half + bx.w / 2 && Math.abs(bx.z - q.z) < half + bx.d / 2);
    for (let k = 0; k < 40 && !p; k++) {
      const a = hash2(i + 3, 31) * 6.283 + k * 0.785, r = t.r + 26 + n * 3 + Math.floor(k / 8) * 14, x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
      const q = landNear(x, z, i * 7 + k, 4, 40); if (clear(q)) p = q;
    }
    // เกาะเล็ก/พื้นที่แคบ: ไล่หาจุดโล่งเป็นตารางรอบเมือง
    for (let r = 0; r <= 90 && !p; r += 3) for (let a = 0; a < 6.283 && !p; a += 0.3) { const q = { x: +(t.x + Math.cos(a) * r).toFixed(2), z: +(t.z + Math.sin(a) * r).toFixed(2) }; if (clear(q)) p = q; }
    p ||= landNear(t.x + t.r + 30, t.z, i * 7, 4, 60);
    return { key: 'pf_' + d, district: d, n, price: basePrice(n), x: p.x, z: p.z };
  });
  return memo;
}

// ชิ้นส่วนทั้งหมดของฐานหนึ่งแห่ง: รั้วรอบ + ประตูเดียวทางเหนือ + บ้านหลังเล็ก 2×2 + เตียง + หีบ + หลักบ้าน + ป้ายราคา
export function baseSiteStructs(site) {
  const n = site.n, [c0, r0] = cellOf(site.x, site.z), cx0 = c0 - Math.floor((n - 1) / 2), cz0 = r0 - Math.floor((n - 1) / 2), mid = Math.floor((n - 1) / 2);
  const out = fenceRing(site.x, site.z, n, 1).map((s) => ({ ...s }));
  const house = prefabHouse(cx0 + 1, cz0 + 1, 2, 0), floor = house.find((s) => s.type === 'wall' || s.type === 'door')?.y ?? heightAt(site.x, site.z);
  out.push(...house.map((s) => ({ ...s })));
  const at = (cx, cz) => { const [x, z] = cellCenter(cx, cz); return { x: +x.toFixed(2), z: +z.toFixed(2) }; };
  out.push({ type: 'bed', ...at(cx0 + 1, cz0 + 2), y: floor, rot: 0 });
  out.push({ type: 'storage', ...at(cx0 + 2, cz0 + 2), y: floor, rot: 0 });
  const core = at(cx0 + 1, cz0 + n - 1);
  const fence = out.filter((s) => s.type === 'fence' || s.type === 'gate');
  const box = [Math.min(...fence.map((o) => o.x)), Math.min(...fence.map((o) => o.z)), Math.max(...fence.map((o) => o.x)), Math.max(...fence.map((o) => o.z))].map((v) => +v.toFixed(2));
  out.push({ type: 'basecore', ...core, ok: 1, box, name: `ฐาน${n}×${n} (ขาย)`, lv: 1, mem: {}, price: site.price, n });
  out.push({ type: 'sign', ...at(cx0 + mid, cz0 - 1), rot: 0 });
  return out.map((s, i) => ({ ...s, id: `${site.key}_${i}`, prefab: site.key, owner: null }));
}
