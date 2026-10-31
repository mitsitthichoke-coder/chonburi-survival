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
  // (บอสประจำอำเภอแต่ละแห่งต่อท้ายลิสต์ด้านล่าง) (เกิดกลางเมืองเมื่อมีผู้เล่นเข้าใกล้ · ล้มแล้วอำเภอถูกปลดแอก ได้บัฟชั่วคราว) — ต่อท้ายลิสต์เท่านั้น เพราะรหัสระดับส่งผ่านเครือข่ายเป็นลำดับ
  { key: 'boss', name: '👑 ราชาผู้ติดเชื้อ', hp: 16, spd: 1.08, dmg: 3, infect: 0.3, scale: 2.2, color: '#370617', w: 0, day: 0, xp: 300, drops: 4, boss: true },
];

// 🛡️ บอสประจำอำเภอ: หน้าตา/ความสามารถ/ของดรอป/บัฟปลดแอก ต่างกันตามจุดเด่นของแต่ละอำเภอ
// ต่อท้ายเรียงตามลำดับนี้เท่านั้น (รหัสระดับส่งผ่านเครือข่ายเป็นลำดับ — ห้ามสลับ/แทรก)
// armor = ตัวคูณดาเมจที่รับ · regen = ฟื้นเลือด %/วินาที · summon = เรียกลูกน้องครั้งละกี่ตัวทุก 25 วินาที · rage = เร็วขึ้นเมื่อเลือดต่ำ
// buff: food = หิว/กระหายช้าลง 20% · stam = พลังกายฟื้นไว +20% · regen = ฟื้นเลือดช้า ๆ · warm = อบอุ่น/แห้งเหมือนอยู่ข้างกองไฟ
// 11 อำเภอของชลบุรี · พื้นที่ย่อยเป็นส่วนหนึ่งของอำเภอแม่: บางแสน→เมืองชลบุรี · แหลมฉบัง/เขาเขียว→ศรีราชา · พัทยา/จอมเทียน→บางละมุง
export const DISTRICT_OF = { bangsaen: 'chonburi', laemchabang: 'sriracha', khaokheow: 'sriracha', pattaya: 'banglamung', jomtien: 'banglamung' };
export const districtOf = (townKey) => DISTRICT_OF[townKey] || townKey;
export const DISTRICT_NAME = { chonburi: 'เมืองชลบุรี', banbueng: 'บ้านบึง', nongyai: 'หนองใหญ่', banglamung: 'บางละมุง', phanthong: 'พานทอง', phanat: 'พนัสนิคม', sriracha: 'ศรีราชา', sichang: 'เกาะสีชัง', sattahip: 'สัตหีบ', bothong: 'บ่อทอง', kochan: 'เกาะจันทร์' };
export const DISTRICT_BOSSES = [
  { town: 'chonburi', name: '🏛️ เจ้าเมืองชลบุรีทมิฬ', desc: 'ศาลากลาง ตลาด และหาดบางแสน', hp: 10, spd: 1.2, dmg: 2.3, infect: 0.2, scale: 1.8, color: '#6d597a', summon: 2, rage: 1.25, drops: { canned: 4, clean_water: 3, bandage: 3, raw_fish: 3 }, buff: 'food', buffText: 'ตลาดสดชลบุรีและหาดบางแสนกลับมาคึกคัก' },
  { town: 'banbueng', name: '🌳 พญายางทมิฬบ้านบึง', desc: 'สวนยางและไร่อ้อย', hp: 10, spd: 1.0, dmg: 2.2, infect: 0.5, scale: 1.8, color: '#52796f', summon: 2, drops: { rubber_sheet: 5, rubber_wood: 8, latex: 6 }, buff: 'regen', buffText: 'สวนยางร่มรื่นบ้านบึง' },
  { town: 'nongyai', name: '🐃 จอมควายป่าหนองใหญ่', desc: 'ทุ่งหญ้าและฝูงควาย', hp: 12, spd: 1.2, dmg: 3.4, infect: 0.2, scale: 2.0, color: '#6b705c', rage: 1.3, drops: { hide: 6, raw_meat: 6, beef: 3 }, buff: 'regen', buffText: 'ทุ่งหญ้าหนองใหญ่อุดม' },
  { town: 'banglamung', name: '🐑 จอมคนเลี้ยงแกะบางละมุงทมิฬ', desc: 'สวนแกะ วัดญาณฯ และไร่สับปะรด', hp: 11, spd: 1.05, dmg: 2.4, infect: 0.2, scale: 1.9, color: '#b5c99a', summon: 3, regen: 0.006, drops: { cloth: 6, raw_meat: 3, herb: 4, jicoin: 30 }, buff: 'regen', buffText: 'ทุ่งแกะบางละมุงสงบร่มเย็น' },
  { town: 'phanthong', name: '⚔️ จอมขุนศึกพานทอง', desc: 'ค่ายทหารบกและทุ่งนา', hp: 11, spd: 1.1, dmg: 3.0, infect: 0.2, scale: 1.9, color: '#5f0f40', rage: 1.25, drops: { scrap: 6, bandage: 4, antibiotic: 2 }, buff: 'regen', buffText: 'ค่ายทหารบกพานทองคุ้มกัน' },
  { town: 'phanat', name: '🏯 เจ้าเมืองเก่าพนัสทมิฬ', desc: 'เมืองโบราณและตลาดเก่า', hp: 12, spd: 0.95, dmg: 2.4, infect: 0.2, scale: 1.9, color: '#9c6644', armor: 0.8, regen: 0.006, drops: { sugarcane: 6, rice: 5, wood: 10 }, buff: 'food', buffText: 'ตลาดโบราณพนัสนิคมคึกคัก' },
  { town: 'sriracha', name: '🐊 จอมจระเข้ศรีราชา', desc: 'ฟาร์มจระเข้ ท่าเรือแหลมฉบัง และสวนสัตว์เขาเขียว', hp: 13, spd: 1.05, dmg: 3.0, infect: 0.2, scale: 2.0, color: '#386641', armor: 0.6, drops: { hide: 4, raw_meat: 4, scrap: 6, copper_wire: 3 }, buff: 'food', buffText: 'ซอสอาหารทะเลศรีราชาและท่าเรือคึกคัก' },
  { town: 'sichang', name: '🧭 กัปตันเกาะสีชังทมิฬ', desc: 'เกาะและท่าเรือทะเล', hp: 8, spd: 1.15, dmg: 2.2, infect: 0.2, scale: 1.7, color: '#00b4d8', rage: 1.3, drops: { raw_fish: 6, clean_water: 3, cloth: 3 }, buff: 'stam', buffText: 'ลมทะเลเกาะสีชังพัดสบาย' },
  { town: 'sattahip', name: '⚓ พลเรือเอกสัตหีบทมิฬ', desc: 'ฐานทัพเรือ', hp: 13, spd: 1.05, dmg: 3.0, infect: 0.25, scale: 2.0, color: '#1d3557', armor: 0.65, drops: { antibiotic: 3, kevlar: 1, canned: 5 }, buff: 'regen', buffText: 'ฐานทัพเรือฟื้นระเบียบ' },
  { town: 'bothong', name: '⛏️ พญาเหมืองบ่อทองทมิฬ', desc: 'เหมืองและสวนยาง', hp: 11, spd: 1.0, dmg: 2.6, infect: 0.45, scale: 1.9, color: '#bc6c25', summon: 2, armor: 0.8, drops: { rubber_sheet: 4, scrap: 6, stone: 8 }, buff: 'warm', buffText: 'เตาหลอมเหมืองบ่อทองอุ่นไอ' },
  { town: 'kochan', name: '🌊 ผู้พิทักษ์เขื่อนเกาะจันทร์', desc: 'เขื่อนและอ่างเก็บน้ำ', hp: 12, spd: 0.95, dmg: 2.2, infect: 0.2, scale: 1.9, color: '#277da1', armor: 0.7, regen: 0.008, drops: { clean_water: 6, raw_fish: 5, copper_wire: 3 }, buff: 'food', buffText: 'น้ำจากเขื่อนไหลกลับมา' },
];
for (const b of DISTRICT_BOSSES) ZTIERS.push({ key: 'wl_' + b.town, w: 0, day: 0, xp: 220 + Math.round(b.hp * 10), boss: true, warlord: true, ...b, drops: 3, bossDrops: b.drops });

// 🗺️ บอสพื้นที่ (ไม่ใช่บอสประจำอำเภอ): ผู้คุมพื้นที่ย่อยที่มีชื่อเสียง เกิดเมื่อมีผู้เล่นเข้าใกล้ ไม่ปลดแอกอำเภอ แต่ให้ของรางวัลของพื้นที่นั้น
export const AREA_BOSSES = [
  { town: 'bangsaen', name: '🏖️ ราชาหาดบางแสน', hp: 8, spd: 1.35, dmg: 2.0, infect: 0.18, scale: 1.7, color: '#e07a5f', rage: 1.3, drops: { raw_fish: 5, coconut: 4, cloth: 3 } },
  { town: 'laemchabang', name: '🚢 นายท่าตู้คอนเทนเนอร์แหลมฉบัง', hp: 14, spd: 0.85, dmg: 2.6, infect: 0.2, scale: 2.1, color: '#355070', armor: 0.55, drops: { scrap: 10, copper_wire: 4, fuel: 3 } },
  { town: 'khaokheow', name: '🦁 ราชสีห์สวนสัตว์เขาเขียว', hp: 9, spd: 1.45, dmg: 3.0, infect: 0.2, scale: 1.8, color: '#e09f3e', rage: 1.4, drops: { hide: 5, raw_meat: 6, herb: 3 } },
  { town: 'pattaya', name: '💃 ราชินีราตรีพัทยา', hp: 9, spd: 1.4, dmg: 2.4, infect: 0.25, scale: 1.7, color: '#f72585', rage: 1.35, drops: { jicoin: 40, bandage: 4, canned: 3 } },
  { town: 'jomtien', name: '🌅 ผู้เฝ้าหาดจอมเทียน', hp: 10, spd: 1.0, dmg: 2.0, infect: 0.2, scale: 1.8, color: '#4cc9f0', regen: 0.012, drops: { clean_water: 5, raw_fish: 4, bandage: 4 } },
];
for (const b of AREA_BOSSES) ZTIERS.push({ key: 'ab_' + b.town, w: 0, day: 0, xp: 150 + Math.round(b.hp * 10), boss: true, area: true, ...b, drops: 3, bossDrops: b.drops });
export const ZT = Object.fromEntries(ZTIERS.map((t, i) => [t.key, i]));
export const AREA_OF = Object.fromEntries(AREA_BOSSES.map((b) => [b.town, ZT['ab_' + b.town]]));
export const WARLORD_OF = Object.fromEntries(DISTRICT_BOSSES.map((b) => [b.town, ZT['wl_' + b.town]])), BOSS = ZT.boss, SOLDIER = ZT.soldier, ADMIRAL = ZT.admiral;
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
