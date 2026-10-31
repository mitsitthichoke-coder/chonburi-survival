// เส้นทางภารกิจหลักตามอำเภอที่เกิด (ใช้ร่วมกันทั้งเบราว์เซอร์และเซิร์ฟเวอร์)
// ทุกเส้นทางมี 6 ขั้นเหมือนกัน: หยิบวิทยุ → เตรียมตัว → หาแบตเตอรี่ → ส่งสัญญาณที่เสา → พบผู้ติดต่อ → เข้าค่ายกักกัน
// เริ่มและจบในอำเภอที่เกิด · 'classic' = เส้นทางเดิม (บางแสน → ศรีราชา → สัตหีบ) สำหรับตัวละครเก่า
import { heightAt, waterAt, lonToX, latToZ, hash2 } from './terrain.js';
import { TOWNS, QUEST_SPOTS } from './data.js';

const town = (k) => TOWNS.find((t) => t.key === k);
const P = (lat, lon) => ({ x: lonToX(lon), z: latToZ(lat) });
const land = (x, z) => heightAt(x, z) > 1.2 && !waterAt(x, z);
// จุดบนบกใกล้ (x,z) แบบคงที่
export function landNear(x, z, seed, r0 = 4, r1 = 18) {
  if (land(x, z)) return { x: +x.toFixed(2), z: +z.toFixed(2) };
  for (let i = 0; i < 60; i++) { const a = hash2(seed, i) * 6.283, r = r0 + hash2(i, seed) * (r1 - r0), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (land(px, pz)) return { x: +px.toFixed(2), z: +pz.toFixed(2) }; }
  return { x, z };
}
// เสาส่งสัญญาณ: จุดที่สูงที่สุดในวงแหวนรอบเมือง
function hillNear(t, seed, r0 = 45, r1 = 110) {
  let best = null, bh = -1;
  for (let i = 0; i < 160; i++) {
    const a = hash2(seed, i + 7) * 6.283, r = r0 + hash2(i + 3, seed) * (r1 - r0), x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r, h = heightAt(x, z);
    if (land(x, z) && h > bh) { bh = h; best = { x: +x.toFixed(2), z: +z.toFixed(2) }; }
  }
  return best;
}

// ค่ายกักกัน (เขตปลอดภัยปลายทาง) — ล้อมรั้ว ประตูทางทิศเหนือ เปิดด้วยรหัสจากผู้ติดต่อ
const CAMP_DEFS = [
  { key: 'navy', name: 'ค่ายกักกัน ในค่ายทหารเรือสัตหีบ', ...QUEST_SPOTS.camp },
  { key: 'army', name: 'ค่ายกักกัน ในค่ายกองทัพบก (ชลบุรี–พานทอง)', ...P(13.418, 101.045), size: 32 },
  { key: 'scout', name: 'ค่ายกักกัน ในค่ายลูกเสือศรีราชา', ...P(13.196, 100.948), size: 28 },
  { key: 'refugee_phanat', name: 'ค่ายกักกัน ในศูนย์ลี้ภัยต่างด้าวพนัสนิคม', ...P(13.472, 101.214), size: 30 },
  { key: 'refugee_bothong', name: 'ค่ายกักกัน ในศูนย์ลี้ภัยต่างด้าวบ่อทอง', ...P(13.262, 101.452), size: 30 },
  { key: 'transport', name: 'ค่ายกักกัน ในสถานีขนส่งจังหวัดชลบุรี (หนองใหญ่)', ...P(13.168, 101.342), size: 30 },
  { key: 'tech', name: 'ค่ายกักกัน ในโรงเรียนเทคนิคชลบุรี (บ้านบึง)', ...P(13.298, 101.079), size: 30 },
];
export const CAMPS = CAMP_DEFS.map((c) => ({ ...c, ...landNear(c.x, c.z, c.key.length * 13, 3, 30), size: (c.size || 30) + 14 })); // ขยายค่ายให้กว้างขึ้น
export const campOf = (k) => CAMPS.find((c) => c.key === k) || CAMPS[0];
export const inAnyCamp = (x, z, pad = 0) => CAMPS.some((c) => Math.abs(x - c.x) < c.size / 2 + pad && Math.abs(z - c.z) < c.size / 2 + pad);
export const inCampOf = (k, x, z, pad = 0) => { const c = campOf(k); return Math.abs(x - c.x) < c.size / 2 + pad && Math.abs(z - c.z) < c.size / 2 + pad; };
export const campGate = (c) => ({ x: c.x, z: c.z - c.size / 2 - 2 });

// เส้นทางของแต่ละอำเภอที่สุ่มเกิดได้ (เกาะจันทร์ไม่สุ่มเกิด)
const R = (key, townKey, camp, contact, code, radioName, towerName, seed) => {
  const t = town(townKey);
  return { key, town: townKey, camp, contact, code, radio: { ...landNear(t.x + 6, t.z + 4, seed), name: radioName }, tower: { ...(hillNear(t, seed) || landNear(t.x + 40, t.z, seed)), name: towerName } };
};
export const ROUTES = {
  classic: { key: 'classic', town: 'bangsaen', camp: 'navy', contact: 'npc_kaew', code: '2-5-1-1', radio: QUEST_SPOTS.radio, tower: QUEST_SPOTS.tower },
  sattahip: R('sattahip', 'sattahip', 'navy', 'npc_kaew', '2-5-1-1', 'ป้อมยามท่าเรือสัตหีบ', 'เสาส่งสัญญาณเขาสัตหีบ', 31),
  chonburi: R('chonburi', 'chonburi', 'army', 'npc_somchai_sgt', '4-1-7-3', 'ป้อมตำรวจหน้าศาลากลางชลบุรี', 'เสาส่งสัญญาณเขาบางพระ', 37),
  phanthong: R('phanthong', 'phanthong', 'army', 'npc_weera', '4-1-7-3', 'ป้อมยามตลาดพานทอง', 'เสาส่งสัญญาณทุ่งพานทอง', 41),
  sriracha: R('sriracha', 'sriracha', 'scout', 'npc_kru_ae', '9-0-2-5', 'ป้อมยามท่าเรือเกาะลอย', 'เสาส่งสัญญาณเนินศรีราชา', 43),
  phanat: R('phanat', 'phanat', 'refugee_phanat', 'npc_sara', '6-6-0-8', 'ป้อมยามวัดหลวงพนัสนิคม', 'เสาส่งสัญญาณทุ่งพนัสนิคม', 47),
  bothong: R('bothong', 'bothong', 'refugee_bothong', 'npc_saengduan', '3-8-3-1', 'ป้อมยามตลาดบ่อทอง', 'เสาส่งสัญญาณเขาบ่อทอง', 53),
  nongyai: R('nongyai', 'nongyai', 'transport', 'npc_winai', '7-2-4-9', 'ป้อมยามสี่แยกหนองใหญ่', 'เสาส่งสัญญาณเขาหนองใหญ่', 59),
  banbueng: R('banbueng', 'banbueng', 'tech', 'npc_prasit', '5-5-1-0', 'ป้อมยามตลาดบ้านบึง', 'เสาส่งสัญญาณเขาบ้านบึง', 61),
};
export const START_ROUTES = ['sattahip', 'chonburi', 'phanthong', 'sriracha', 'phanat', 'bothong', 'nongyai', 'banbueng'];
export const routeOf = (q) => ROUTES[q?.route] || ROUTES.classic;
export const pickRoute = (rand = Math.random) => START_ROUTES[Math.floor(rand() * START_ROUTES.length)];
// 🗼 หอถังน้ำสำรองประจำอำเภอ (มีอยู่ถาวรในแผนที่ตั้งแต่เริ่มเกม) — ต้นน้ำของท่อส่งน้ำ · ตักน้ำดิบได้
export const WATER_TOWERS = TOWNS.filter((t) => t.key !== 'sichang').map((t, i) => {
  const a = hash2(i + 91, 17) * 6.283, r = t.r * (0.55 + hash2(17, i + 91) * 0.3), p = landNear(t.x + Math.cos(a) * r, t.z + Math.sin(a) * r, 300 + i, 4, 30);
  return { id: 'wt_' + t.key, town: t.key, name: `หอถังน้ำ${t.name}`, ...p };
});
// จุดที่ห้ามมีตึกทับ (ป้อมวิทยุ เสาส่ง ค่าย)
export const QUEST_KEEPOUT = [
  ...Object.values(ROUTES).flatMap((r) => [{ x: r.radio.x, z: r.radio.z, r: 6 }, { x: r.tower.x, z: r.tower.z, r: 10 }]),
  ...CAMPS.map((c) => ({ x: c.x, z: c.z, r: c.size / 2 + 8 })),
  ...WATER_TOWERS.map((w) => ({ x: w.x, z: w.z, r: 7 })),
];

// 🏕️ NPC อาศัยอยู่ในค่ายกักกันที่ใกล้เมืองเดิมที่สุด (ยืนชิดรั้วด้านประตู ให้คนข้างนอกคุย/ซื้อขายได้) · ผู้ติดต่อเควสเริ่มต้น (แก้ว) อยู่ข้างนอกในเมือง
export function npcCampSpot(npcs, i) {
  const n = npcs[i]; if (!n || Object.values(ROUTES).some((r) => r.contact === n.id)) return null;
  const t = town(n.town), near = (m) => { let b = CAMPS[0], bd = 1e9; for (const c of CAMPS) { const d = Math.hypot(c.x - m.x, c.z - m.z); if (d < bd) { bd = d; b = c; } } return b; };
  const c = near(t), mates = npcs.map((m, j) => [m, j]).filter(([m]) => !Object.values(ROUTES).some((r) => r.contact === m.id) && near(town(m.town)) === c), k = mates.findIndex(([, j]) => j === i);
  return { camp: c.key, x: +(c.x + (k - (mates.length - 1) / 2) * 4).toFixed(2), z: +(c.z - c.size / 2 + 2.2).toFixed(2) };
}
