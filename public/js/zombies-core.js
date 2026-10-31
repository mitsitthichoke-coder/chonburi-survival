// ระดับผู้ติดเชื้อ + บอส (ใช้ร่วมกันทั้งเบราว์เซอร์และเซิร์ฟเวอร์)
// hp/spd/dmg = ตัวคูณจากผู้ติดเชื้อธรรมดา · w = น้ำหนักการสุ่ม · day = วันที่เริ่มพบ
export const ZTIERS = [
  { key: 'walker', name: 'ผู้ติดเชื้อ', hp: 1, spd: 1, dmg: 1, infect: 0.16, scale: 1, color: '#4a4e4d', w: 62, day: 0, xp: 12, drops: 1 },
  { key: 'runner', name: 'ผู้ติดเชื้อวิ่งเร็ว', hp: 0.7, spd: 1.45, dmg: 0.8, infect: 0.16, scale: 0.95, color: '#9d0208', w: 18, day: 0, xp: 15, drops: 1 },
  { key: 'toxic', name: 'ผู้ติดเชื้อพิษ', hp: 1.3, spd: 1, dmg: 1, infect: 0.45, scale: 1.05, color: '#6a994e', w: 10, day: 1, xp: 20, drops: 1.3 },
  { key: 'brute', name: 'ผู้ติดเชื้อร่างยักษ์', hp: 3.2, spd: 0.8, dmg: 1.9, infect: 0.2, scale: 1.4, color: '#3d405b', w: 8, day: 1, xp: 35, drops: 2 },
  // ทหารผู้ติดเชื้อ: พบเฉพาะในฐานทัพเรือสัตหีบ (w = 0 ไม่สุ่มเกิดที่อื่น) · ใส่หมวกเหล็ก ทนกว่า ตีแรงกว่า
  { key: 'soldier', name: 'ทหารผู้ติดเชื้อ', hp: 2.2, spd: 1.12, dmg: 1.5, infect: 0.2, scale: 1.08, color: '#4b5320', w: 0, day: 0, xp: 30, drops: 1.6, mil: true, loot: 'mil' },
  { key: 'admiral', name: '🎖️ ผู้บัญชาการผู้ติดเชื้อ', hp: 22, spd: 1.1, dmg: 3.4, infect: 0.3, scale: 2.1, color: '#1d3557', w: 0, day: 0, xp: 400, drops: 4, boss: true, mil: true, loot: 'mil' },
  // บอสประจำอำเภอ (เกิดกลางเมืองเมื่อมีผู้เล่นเข้าใกล้ · ล้มแล้วอำเภอถูกปลดแอก ได้บัฟชั่วคราว) — ต่อท้ายลิสต์เท่านั้น เพราะรหัสระดับส่งผ่านเครือข่ายเป็นลำดับ
  { key: 'boss', name: '👑 ราชาผู้ติดเชื้อ', hp: 16, spd: 1.08, dmg: 3, infect: 0.3, scale: 2.2, color: '#370617', w: 0, day: 0, xp: 300, drops: 4, boss: true },
  { key: 'warlord', name: '🛡️ จอมทมิฬประจำอำเภอ', hp: 9, spd: 1.02, dmg: 2.4, infect: 0.25, scale: 1.8, color: '#5a189a', w: 0, day: 0, xp: 220, drops: 3, boss: true, warlord: true },
];
export const ZT = Object.fromEntries(ZTIERS.map((t, i) => [t.key, i]));
export const WARLORD = ZT.warlord, BOSS = ZT.boss, SOLDIER = ZT.soldier, ADMIRAL = ZT.admiral;
export const ADMIRAL_EVERY = 10 * 60000; // ผู้บัญชาการเกิดใหม่ได้ทุก ~10 นาที (เมื่อมีผู้เล่นอยู่ในฐานทัพ)
export const ADMIRAL_DROPS = { admiral_medal: 1, navy_uniform: 1 };
// บอสประจำอำเภอ: เกิดใหม่หลังถูกล้ม 40 นาที · อำเภอที่ปลดแอกแล้วได้บัฟ 60 นาที
export const WARLORD_RESPAWN = 40 * 60000, LIBERATE_MS = 60 * 60000;
export const BOSS_EVERY = 15 * 60000;  // ทุก ~15 นาทีมีโอกาสเกิดบอส
export const BOSS_CHANCE = 0.5;

export function pickTier(rand, day) {
  const list = ZTIERS.filter((t) => !t.boss && day >= t.day);
  let r = rand() * list.reduce((s, t) => s + t.w, 0);
  for (const t of list) { r -= t.w; if (r <= 0) return ZT[t.key]; }
  return 0;
}
// ค่าพลังชีวิตตามระดับ + วัน
export const zombieHp = (tier, day) => 40 * (1 + day * 0.05) * ZTIERS[tier].hp;

// ของที่บอสดรอป (การันตี 1 ชิ้นพิเศษ + ของหายาก)
export const BOSS_DROPS = [['king_hammer', 3], ['king_armor', 3], ['king_crown', 2], ['kevlar', 6], ['antibiotic', 6], ['shield_riot', 3], ['bag_military', 3], ['antiviral', 4]];
export function rollBoss(rand) {
  const out = { king_fang: 1 };
  const total = BOSS_DROPS.reduce((s, [, w]) => s + w, 0);
  for (let i = 0; i < 3; i++) { let r = rand() * total; for (const [k, w] of BOSS_DROPS) { r -= w; if (r <= 0) { out[k] = (out[k] || 0) + 1; break; } } }
  return out;
}
