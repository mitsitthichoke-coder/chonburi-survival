// กล่อง 3 แบบ: 🟫 กล่องเสบียง (ค้นได้เลย · อยู่ใน economy.loot) · 🔒 กล่องภารกิจ (ทำเงื่อนไขก่อน เปิดได้ครั้งเดียว) · ✨ กล่องหายาก (นาน ๆ เกิด สุ่มตำแหน่ง)
// ไฟล์นี้ไม่มี three.js — ใช้ร่วมกันทั้งเบราว์เซอร์และเซิร์ฟเวอร์ ทุกเครื่องคำนวณตำแหน่ง/เวลาได้ตรงกัน
import { TOWNS, ITEMS, skillLevel } from './data.js';
import { heightAt, waterAt, hash2, WORLD } from './terrain.js';

const town = (k) => TOWNS.find((t) => t.key === k);
// หาจุดบนบกใกล้ (x,z) แบบคงที่
function landNear(x, z, seed, rad = 14) {
  for (let i = 0; i < 40; i++) {
    const a = hash2(seed, i) * Math.PI * 2, r = rad * (0.4 + hash2(i, seed) * 0.6);
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (heightAt(px, pz) > 1 && !waterAt(px, pz)) return { x: +px.toFixed(2), z: +pz.toFixed(2) };
  }
  return { x, z };
}

// ---------- กล่องภารกิจ ----------
// need: { step } = ภารกิจหลักผ่านขั้นนั้นแล้ว · { kills } = กำจัดผู้ติดเชื้อครบ · { level } = เลเวลตัวละคร
export const QUEST_BOXES = [
  { id: 'qb_bangsaen', town: 'bangsaen', name: 'กล่องเสบียงหน่วยกู้ภัย', need: { step: 1 }, desc: 'หยิบวิทยุสื่อสารที่ป้อมยามชายหาดก่อน', give: { bandage: 3, clean_water: 2, shield_wood: 1, canned: 2 } },
  { id: 'qb_chonburi', town: 'chonburi', name: 'ตู้นิรภัยโรงพยาบาล', need: { kills: 15 }, desc: 'กำจัดผู้ติดเชื้อให้ครบ 15 ตัว', give: { antibiotic: 2, herbal_med: 2, bandage: 2 } },
  { id: 'qb_sriracha', town: 'sriracha', name: 'กล่องอุปกรณ์ช่างเสาส่ง', need: { step: 4 }, desc: 'ส่งสัญญาณจากเสาส่งศรีราชาให้สำเร็จ', give: { scrap: 8, zipper: 4, machete: 1, fuel: 3 } },
  { id: 'qb_pattaya', town: 'pattaya', name: 'ล็อกเกอร์ตำรวจท่องเที่ยว', need: { kills: 40 }, desc: 'กำจัดผู้ติดเชื้อให้ครบ 40 ตัว', give: { helmet_bike: 1, gloves_leather: 1, shield_lid: 1, kevlar: 1 } },
  { id: 'qb_banbueng', town: 'banbueng', name: 'คลังเสบียงชุมชน', need: { level: 8 }, desc: 'เลเวลตัวละครถึง 8', give: { seeds_corn: 6, seeds_veg: 6, canned: 4, bag_hiking: 1 } },
  { id: 'qb_sattahip', town: 'sattahip', name: 'หีบยุทธภัณฑ์ทหารเรือ', need: { step: 6 }, desc: 'เข้าศูนย์อพยพสัตหีบให้สำเร็จ (จบภารกิจหลัก)', give: { helmet_mil: 1, pants_cargo: 1, kevlar: 3, antibiotic: 2 } },
].map((b, i) => { const t = town(b.town); return { ...b, ...landNear(t.x, t.z, 900 + i, t.r * 0.5) }; });

export const charLevelOf = (skills) => Object.keys(skills || {}).reduce((s, k) => s + skillLevel(skills[k]) - 1, 0) + 1;
// เงื่อนไขของกล่องภารกิจ: คืน null = เปิดได้ หรือข้อความที่ยังขาด
export function qboxLock(b, ch, lvl) {
  const n = b.need;
  if (n.step !== undefined && (ch.quest?.step || 0) < n.step) return b.desc;
  if (n.kills !== undefined && (ch.stats?.kills || 0) < n.kills) return `${b.desc} (ตอนนี้ ${ch.stats?.kills || 0}/${n.kills})`;
  if (n.level !== undefined && lvl < n.level) return `${b.desc} (ตอนนี้ Lv${lvl})`;
  return null;
}

// ---------- กล่องหายาก ----------
export const RARE_PERIOD = 40 * 60000; // ทุก ๆ 40 นาทีมีโอกาสเกิด 1 กล่อง
export const RARE_LIFE = 10 * 60000;   // อยู่ได้ 10 นาที
const RARE_CHANCE = 0.6;
export const RARE_TABLE = [
  ['plus_stone', 14], ['super_stone', 3],
  ['kevlar', 14], ['antibiotic', 14], ['vest_kevlar', 5], ['helmet_mil', 6], ['bag_military', 5], ['pants_cargo', 6], ['shield_riot', 5],
  ['pet_fangs', 6], ['pet_kevlar', 5], ['boots', 7], ['jacket_leather', 6], ['ring', 6], ['golden_fish', 4], ['fuel', 8], ['motorbike', 2],
];
// กล่องหายากของช่วงเวลา now (หรือ null) — ทุกเครื่องได้คำตอบเดียวกัน
export function rareBoxAt(now) {
  const slot = Math.floor(now / RARE_PERIOD);
  for (const s of [slot, slot - 1]) {
    if (hash2(s, 4242) > RARE_CHANCE) continue;
    const from = s * RARE_PERIOD + Math.floor(hash2(s, 77) * (RARE_PERIOD - RARE_LIFE) * 0.5);
    if (now < from || now > from + RARE_LIFE) continue;
    // ครึ่งหนึ่งเกิดใกล้เมือง ครึ่งหนึ่งเกิดในป่า/ทุ่งที่ไหนก็ได้
    let x, z;
    for (let i = 0; i < 60; i++) {
      if (hash2(s, 5) < 0.5) { const t = TOWNS[Math.floor(hash2(s, 9 + i) * TOWNS.length)]; const a = hash2(s, 30 + i) * 6.283, r = t.r * (0.6 + hash2(s, 60 + i) * 1.4); x = t.x + Math.cos(a) * r; z = t.z + Math.sin(a) * r; }
      else { x = WORLD.minX + 40 + hash2(s, 100 + i) * (WORLD.maxX - WORLD.minX - 80); z = WORLD.minZ + 40 + hash2(s, 200 + i) * (WORLD.maxZ - WORLD.minZ - 80); }
      if (heightAt(x, z) > 1.2 && !waterAt(x, z)) return { id: 'R' + s, slot: s, x: +x.toFixed(2), z: +z.toFixed(2), from, until: from + RARE_LIFE };
    }
  }
  return null;
}
export function rollRare(rand) {
  const total = RARE_TABLE.reduce((s, [, w]) => s + w, 0), out = {};
  const n = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) { let r = rand() * total; for (const [k, w] of RARE_TABLE) { r -= w; if (r <= 0) { if (ITEMS[k]) out[k] = (out[k] || 0) + 1; break; } } }
  return out;
}
