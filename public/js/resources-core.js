// ทรัพยากรธรรมชาติทั้งแผนที่ (ต้นไม้ หิน พุ่มไม้ ฯลฯ) สร้างแบบกำหนดผลได้ — ไคลเอนต์และเซิร์ฟเวอร์ได้ชุดเดียวกัน
import { WORLD, heightAt, waterAt, fbm, mulberry32, distToCoast, hash2 } from './terrain.js';
import { TOWNS, QUEST_SPOTS } from './data.js';
import { getLayout, inCamp } from './citygen.js';
import { LANDMARKS } from './landmarks.js';
import { QUEST_KEEPOUT } from './quest-core.js';

export const RES_TYPES = {
  // ล้มต้นไม้ได้ไม้ 5 ชิ้น + ผลที่เห็นบนต้น (มะพร้าว 2 ลูก · ส้ม 4 ลูก)
  tree: { name: 'ต้นไม้', hp: 5, drops: [['wood', 5, 5], ['fiber', 0, 1]], respawn: 8, r: 0.6, needTool: false },
  palm: { name: 'ต้นมะพร้าว (🥥×2)', hp: 4, drops: [['wood', 5, 5], ['coconut', 2, 2]], respawn: 6, r: 0.5 },
  orange_tree: { name: 'ต้นส้ม (🍊×4)', hp: 4, drops: [['wood', 5, 5], ['orange', 4, 4]], respawn: 7, r: 0.5 },
  pineapple: { name: 'ต้นสับปะรด', hp: 1, drops: [['pineapple', 1, 1], ['fiber', 0, 1]], respawn: 5, r: 0 },
  rock: { name: 'ก้อนหิน', hp: 5, drops: [['stone', 1, 2], ['scrap', 0, 0]], respawn: 10, r: 0.9 },
  bush: { name: 'พุ่มผลไม้ป่า', hp: 1, drops: [['berry', 2, 3], ['fiber', 1, 2]], respawn: 4, r: 0 },
  herb: { name: 'สมุนไพร (ฟ้าทะลายโจร)', hp: 1, drops: [['herb', 1, 2]], respawn: 5, r: 0 },
  grass: { name: 'หญ้าคา', hp: 1, drops: [['fiber', 2, 3]], respawn: 3, r: 0 },
  pebble: { name: 'ก้อนหินบนพื้น', hp: 1, drops: [['stone', 1, 2]], respawn: 3, r: 0 },
  twig: { name: 'กิ่งไม้แห้งบนพื้น', hp: 1, drops: [['wood', 1, 2]], respawn: 3, r: 0 },
  // พืชประจำถิ่น
  durian_tree: { name: 'ต้นทุเรียน (ล้มได้ไม้ 5 + ทุเรียน 1)', hp: 6, drops: [['wood', 5, 5], ['durian', 1, 1]], respawn: 9, r: 0.6 },
  bamboo: { name: 'กอไผ่ (ล้มได้ลำไผ่ 8)', hp: 3, drops: [['bamboo', 8, 8]], respawn: 6, r: 0.5 },
  wildflower: { name: 'ดอกไม้สวยงาม', hp: 1, drops: [['wildflower', 2, 3]], respawn: 3, r: 0 },
  // พืชเศรษฐกิจ: อ้อย · ยางพารา · ยางนา
  sugarcane: { name: 'ต้นอ้อย', hp: 1, drops: [['sugarcane', 2, 3], ['fiber', 0, 1]], respawn: 4, r: 0 },
  rubber_tree: { name: 'ต้นยางพารา (ไม้ยางพารา 4)', hp: 5, drops: [['rubber_wood', 4, 4], ['wood', 1, 2]], respawn: 8, r: 0.5 },
  yang_na: { name: 'ต้นยางนา (ไม้ 8)', hp: 8, drops: [['wood', 8, 8]], respawn: 12, r: 0.8 },
};
// อำเภอที่มีพืชเฉพาะถิ่น: [ชนิดที่จะเปลี่ยน, เปลี่ยนเป็น, สัดส่วน, รัศมี (เท่าของรัศมีเมือง)]
const REGION_FLORA = {
  bothong: [['tree', 'durian_tree', 0.6, 3.2]], nongyai: [['tree', 'durian_tree', 0.6, 3.2]],
  phanat: [['tree', 'bamboo', 0.55, 2.6], ['grass', 'bamboo', 0.2, 2.6]], banbueng: [['tree', 'bamboo', 0.35, 2.4], ['grass', 'bamboo', 0.15, 2.4]], phanthong: [['tree', 'bamboo', 0.55, 2.6], ['grass', 'bamboo', 0.2, 2.6]],
  banglamung: [['grass', 'wildflower', 0.45, 2.2], ['bush', 'wildflower', 0.5, 2.2]],
};
const FLORA_T = Object.entries(REGION_FLORA).map(([k, rules]) => ({ t: TOWNS.find((x) => x.key === k), rules }));

let cached = null;
export function getResources() { return (cached ||= generate()); }

function generate() {
  const buildings = getLayout().buildings, out = [];
  const rng = mulberry32(777);
  const step = 9;
  for (let z = WORLD.minZ; z < WORLD.maxZ; z += step) for (let x = WORLD.minX; x < WORLD.maxX; x += step) {
    const px = x + rng() * step, pz = z + rng() * step, roll = rng();
    const h = heightAt(px, pz);
    if (h < 0.7 || waterAt(px, pz, h)) continue;
    const d = distToCoast(px, pz);
    let town = false;
    for (const t of TOWNS) if ((px - t.x) ** 2 + (pz - t.z) ** 2 < t.r * t.r) { town = true; break; }
    if (buildings.some((b) => Math.abs(b.x - px) < b.w / 2 + 1 && Math.abs(b.z - pz) < b.d / 2 + 1)) continue;
    if (inCamp(px, pz, 3) || Object.values(QUEST_SPOTS).some((q) => (q.x - px) ** 2 + (q.z - pz) ** 2 < 49) || QUEST_KEEPOUT.some((q) => (q.x - px) ** 2 + (q.z - pz) ** 2 < 49)) continue;
    let type = null;
    if (d < 30) type = roll < 0.22 ? 'palm' : roll < 0.27 ? 'grass' : roll < 0.29 ? 'rock' : roll < 0.32 ? 'pebble' : null;
    else if (town) type = roll < 0.04 ? 'tree' : roll < 0.08 ? 'grass' : roll < 0.1 ? 'bush' : roll < 0.13 ? 'pebble' : roll < 0.15 ? 'twig' : null;
    else if (h > 28) type = roll < 0.3 ? 'tree' : roll < 0.42 ? 'rock' : roll < 0.47 ? 'herb' : roll < 0.5 ? 'bush' : roll < 0.56 ? 'pebble' : roll < 0.62 ? 'twig' : null;
    else {
      const forest = fbm(px * 0.01 - 4, pz * 0.01, 3) > 0.05;
      type = roll < (forest ? 0.3 : 0.08) ? 'tree' : roll < 0.36 ? 'grass' : roll < 0.4 ? 'bush' : roll < 0.42 ? 'rock' : roll < 0.445 ? 'herb' : roll < 0.475 ? 'pebble' : roll < (forest ? 0.54 : 0.5) ? 'twig' : null;
    }
    if (!type) continue;
    // ต้นไม้บางต้นเป็นต้นส้ม · หญ้าบางกอเป็นสับปะรด (ใช้ตำแหน่งสุ่มแบบคงที่ ไม่กระทบลำดับสุ่มเดิม)
    const hh = hash2(Math.floor(px * 7), Math.floor(pz * 7));
    if (type === 'tree' && !town && h <= 28 && hh < 0.14) type = 'orange_tree';
    else if (type === 'grass' && d >= 30 && hh < 0.12) type = 'pineapple';
    for (const F of FLORA_T) {
      if ((px - F.t.x) ** 2 + (pz - F.t.z) ** 2 > (F.t.r * F.rules[0][3]) ** 2) continue;
      const rule = F.rules.find(([from]) => from === type), h2 = hash2(Math.floor(px * 3) + 11, Math.floor(pz * 3) - 7);
      if (rule && h2 < rule[2]) type = rule[1];
      break;
    }
    // อ้อย (ไร่ในอำเภอเกษตร) · ยางพารา (สวนยาง) · ยางนา (ต้นใหญ่ริมถนน/ในเมือง) — ใช้ hash แยก ไม่กระทบลำดับสุ่มเดิม
    const hh2 = hash2(Math.floor(px * 5) + 3, Math.floor(pz * 5) - 5), inT = (keys, k) => keys.some((key) => { const t = TOWNS.find((x) => x.key === key); return t && (px - t.x) ** 2 + (pz - t.z) ** 2 < (t.r * k) ** 2; });
    if ((type === 'grass' || type === 'bush') && hh2 < 0.4 && inT(['phanat', 'phanthong', 'nongyai', 'bothong', 'banbueng'], 2.6)) type = 'sugarcane';
    else if (type === 'tree' && (town ? hh2 < 0.35 : hh2 < 0.04)) type = 'yang_na';
    else if (type === 'tree' && hh2 < 0.5 && inT(['bothong', 'nongyai', 'banbueng', 'sattahip'], 2.8)) type = 'rubber_tree';
    out.push({ id: out.length, type, x: px, z: pz, y: h, s: 0.75 + rng() * 0.6, ry: rng() * 6.28 });
  }
  // สวนดอกไม้สวยงามบางละมุง (แปลงดอกไม้หนาแน่นรอบสวนแกะ)
  const G = LANDMARKS.find((l) => l.kind === 'sheepfarm');
  if (G) for (let i = 0; i < 60; i++) {
    const a = rng() * Math.PI * 2, r = 6 + Math.sqrt(rng()) * 26, px = G.x + Math.cos(a) * r, pz = G.z + Math.sin(a) * r, h = heightAt(px, pz);
    if (h < 0.7 || waterAt(px, pz, h)) continue;
    out.push({ id: out.length, type: 'wildflower', x: px, z: pz, y: h, s: 0.8 + rng() * 0.5, ry: rng() * 6.28 });
  }
  return out;
}
