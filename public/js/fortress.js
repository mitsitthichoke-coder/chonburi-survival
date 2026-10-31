// 🏰 ป้อมกิลด์: เรือนจำ 3 แห่ง (เมืองชลบุรี · บ้านบึง · พัทยา) แต่ละแห่งต่างกัน — กิลด์ที่ยึดได้ครอบครองทั้งหมด
// พัฒนาระบบ 💧 น้ำ / ⚡ ไฟ ได้ 3 ระดับด้วยกองทุนกิลด์ · สมาชิกใช้สิ่งอำนวยความสะดวกและร้านค้าได้ (ใช้ร่วมกันทั้งไคลเอนต์/เซิร์ฟเวอร์)
import { TOWNS } from './data.js';
import { landNear } from './quest-core.js';

export const FORT_UP_COST = [0, 800, 2000, 5000]; // กองทุนที่ใช้ขึ้นระดับ 1..3 ของน้ำ/ไฟ
const DEFS = [
  { key: 'chonburi', town: 'chonburi', dx: -48, dz: 40, name: 'เรือนจำกลางชลบุรี', icon: '⛓️', theme: 'ป้อมคลังเสบียงและสถานพยาบาล', cost: 6000, lvReq: 3,
    fac: [{ id: 'water', n: '💧 ก๊อกน้ำสะอาด', sys: 'water', lv: 1, fx: { thirst: 100 } }, { id: 'clinic', n: '🏥 สถานพยาบาล', sys: 'power', lv: 1, fx: { hp: 70, stopBleed: 1 } }, { id: 'bunk', n: '🛏️ เรือนนอน', sys: 'power', lv: 2, fx: { stamina: 100, stress: -30 } }],
    shop: [['bandage', 20, 0], ['canned', 25, 0], ['energy_drink', 30, 1], ['antibiotic', 90, 2], ['concrete', 60, 2], ['scrap', 8, 0]] },
  { key: 'banbueng', town: 'banbueng', dx: 50, dz: 36, name: 'ทัณฑสถานบ้านบึง', icon: '🌾', theme: 'ฟาร์มและโรงงานของกิลด์', cost: 5000, lvReq: 3,
    fac: [{ id: 'water', n: '💧 บ่อน้ำประปา', sys: 'water', lv: 1, fx: { thirst: 100 } }, { id: 'kitchen', n: '🍲 โรงครัวกลาง', sys: 'power', lv: 1, fx: { hunger: 60, thirst: 30 } }, { id: 'bunk', n: '🛏️ เรือนนอน', sys: 'power', lv: 2, fx: { stamina: 100, stress: -30 } }],
    shop: [['seeds_veg', 15, 0], ['seeds_rice', 15, 0], ['rice', 12, 0], ['plus_stone', 55, 1], ['concrete', 55, 1], ['shop_super_stone', 190, 3]] },
  { key: 'pattaya', town: 'banglamung', dx: 44, dz: -30, name: 'เรือนจำพัทยา', icon: '🏖️', theme: 'ศูนย์การค้าและรีสอร์ตริมทะเล', cost: 9000, lvReq: 4,
    fac: [{ id: 'water', n: '💧 น้ำดื่มรีสอร์ต', sys: 'water', lv: 1, fx: { thirst: 100 } }, { id: 'spa', n: '💆 สปา', sys: 'power', lv: 2, fx: { hp: 40, stress: -60 } }, { id: 'bunk', n: '🛏️ ห้องพักหรู', sys: 'power', lv: 3, fx: { stamina: 100, hp: 100, stress: -50 } }],
    shop: [['energy_drink', 28, 0], ['canned', 22, 0], ['bandage', 18, 0], ['antibiotic', 80, 1], ['magnifier', 85, 2], ['shop_super_stone', 175, 3], ['name_tag', 55, 3]] },
];
let memo = null;
export function forts() {
  if (memo) return memo;
  return (memo = DEFS.map((d, i) => { const t = TOWNS.find((x) => x.key === d.town), p = landNear(t.x + d.dx, t.z + d.dz, 900 + i * 17, 4, 30); return { ...d, x: p.x, z: p.z, r: 32 }; }));
}
export const fortOf = (k) => forts().find((f) => f.key === k);
export const fortAt = (x, z, pad = 0) => forts().find((f) => Math.hypot(f.x - x, f.z - z) < f.r + pad);
