// กฎของการก่อสร้าง ฟาร์ม เล้าไก่ บ่อปลา หีบเก็บของ และยานพาหนะ (ไม่พึ่ง three.js)
// ใช้ร่วมกันทั้งเซิร์ฟเวอร์ (server-core.js) และไคลเอนต์ เพื่อให้ทุกคนเห็นผลเหมือนกัน
import { heightAt, hash2 } from './terrain.js';

// ---------- กรงดักสัตว์ ----------
// ใส่เหยื่อแล้วรอ TRAP_MS จะมีสัตว์ติดกรง: เหยื่อเนื้อได้สัตว์กินเนื้อ · เหยื่อพืชได้สัตว์กินพืช · ใกล้สวนสัตว์เขาเขียวได้ไดโนเสาร์/เสือ
export const TRAP_MS = 3 * 60000;
export const BAIT_MEAT = ['raw_meat', 'cooked_meat', 'raw_fish', 'pork', 'beef'], BAIT_PLANT = ['veg', 'corn', 'berry', 'pineapple', 'orange', 'seeds_corn', 'carrot', 'cabbage', 'tomato', 'watermelon'];
const ZOO = { x: (101.03 - 100.70) * 2160 - 648, z: (13.075 - 13.24) * 2212 }; // สวนสัตว์เปิดเขาเขียว
// สัตว์ที่ติดกรง: เลือกได้ว่าจะ 🐾 เลี้ยงเป็นสัตว์เลี้ยง · 🏡 นำเข้าคอกในฟาร์ม (ต้องมีคอกชนิดนั้น) · 🍖 แปรรูปเป็นอาหาร · 🌿 ปล่อยคืนป่า
export const CAGE_FARM = { chicken: 'coop', duck: 'duckpen', boar: 'pigpen', buffalo: 'buffalopen', sheep: 'sheeppen' };
export const CAGE_FOOD = { chicken: { raw_meat: 1 }, duck: { raw_meat: 2, duck_feather: 3 }, boar: { raw_meat: 3, hide: 1 }, deer: { raw_meat: 3, hide: 2 }, raptor: { raw_meat: 4, hide: 2 }, trike: { raw_meat: 6, hide: 3 }, tiger: { raw_meat: 4, hide: 3 }, buffalo: { raw_meat: 5, hide: 2 }, sheep: { raw_meat: 2, wool: 2 } };
export const CAGE_NAME = { duck: 'เป็ด' };
// พื้นที่ที่กรงจับสัตว์เฉพาะถิ่นได้ (เหยื่อพืช): ควาย = หนองใหญ่/บ้านบึง · แกะ = บางละมุง
const CAGE_REGION = [[101.371, 13.158, 'buffalo'], [101.109, 13.313, 'buffalo'], [100.935, 13.047, 'sheep']].map(([lo, la, k]) => ({ x: (lo - 100.70) * 2160 - 648, z: (13.075 - la) * 2212, k }));
export function cageCatch(s, now) {
  if (!s.bait || !s.bt || now - s.bt < TRAP_MS) return null;
  const zoo = Math.hypot(s.x - ZOO.x, s.z - ZOO.z) < 150, meat = BAIT_MEAT.includes(s.bait);
  const reg = !meat && CAGE_REGION.find((r) => Math.hypot(s.x - r.x, s.z - r.z) < 110);
  const list = meat ? (zoo ? ['raptor', 'tiger', 'raptor', 'dog'] : ['dog', 'cat', 'boar', 'cat']) : reg ? [reg.k, reg.k, 'chicken', reg.k, 'duck'] : (zoo ? ['trike', 'deer', 'trike', 'chicken'] : ['deer', 'chicken', 'boar', 'duck', 'chicken', 'duck']);
  return list[Math.floor(hash2(Math.floor(s.bt / 1000), s.id.length * 977) * list.length)];
}

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
  balcony: { name: 'ระเบียงชั้นบน (ต่อจากหลังคา/พื้นชั้นบน)', icon: '🌅', cost: { wood: 5, fiber: 1 }, snap: 'cell', cat: 'โครงบ้าน', lvl: 2 },
  fence: { name: 'รั้วไม้', icon: '🪵', cost: { wood: 2, fiber: 1 }, snap: 'edge', cat: 'รั้ว', lvl: 1 },
  gate: { name: 'ประตูรั้ว', icon: '⛩️', cost: { wood: 3 }, snap: 'edge', cat: 'รั้ว', lvl: 1 },
  bed: { name: 'เตียงนอน (จุดเกิด)', icon: '🛏️', cost: { wood: 3, cloth: 3 }, snap: 'cell', cat: 'ของในบ้าน', lvl: 1 },
  walllamp: { name: 'โคมไฟฟืนติดผนัง (เล็งที่ผนัง)', icon: '🏮', cost: { wood: 2, stone: 1, scrap: 1 }, snap: 'edge', cat: 'ของในบ้าน', lvl: 1 },
  anvil: { name: 'ทั่งตีเหล็ก (ช่างตีเหล็กใช้ตีบวก)', icon: '⚒️', cost: { stone: 6, scrap: 6, wood: 2 }, snap: 'cell', cat: 'ของในบ้าน', lvl: 1 },
  chair: { name: 'เก้าอี้ไม้ (นั่งพักผ่อน)', icon: '🪑', cost: { wood: 3 }, snap: 'cell', cat: 'ของในบ้าน', lvl: 1 },
  storage: { name: 'หีบเก็บของ (ใช้ร่วมกันได้)', icon: '🧰', cost: { wood: 6 }, snap: 'cell', cat: 'ของในบ้าน', lvl: 1 },
  pethouse: { name: 'บ้านสัตว์เลี้ยง', icon: '🏡', cost: { wood: 6, cloth: 2 }, snap: 'cell', cat: 'ของในบ้าน', lvl: 1 },
  plot: { name: 'แปลงผักรวม (แบบเก่า)', icon: '🌱', cost: { wood: 2, fiber: 2 }, snap: 'cell', cat: 'แปลงผัก', lvl: 1, hidden: true },
  coop: { name: 'เล้าไก่ (มีแม่ไก่ 2 ตัว)', icon: '🐔', cost: { wood: 8, fiber: 4, berry: 3 }, snap: 'cell', cat: 'ฟาร์ม', lvl: 2 },
  duckpen: { name: 'เล้าเป็ด + อ่างน้ำ (ลูกเป็ด 2 ตัว · ไข่เป็ด + ขนเป็ด)', icon: '🦆', cost: { wood: 8, fiber: 4, stone: 2 }, snap: 'cell', cat: 'ฟาร์ม', lvl: 1 },
  pigpen: { name: 'คอกหมู (ลูกหมู 2 ตัว)', icon: '🐷', cost: { wood: 10, stone: 4, veg: 2 }, snap: 'cell', cat: 'ฟาร์ม', lvl: 2 },
  cowpen: { name: 'คอกวัว (ลูกวัว 1 ตัว)', icon: '🐄', cost: { wood: 14, stone: 4, fiber: 6 }, snap: 'cell', cat: 'ฟาร์ม', lvl: 3 },
  buffalopen: { name: 'คอกควาย (จับควายจากหนองใหญ่/บ้านบึงมาปล่อย · รีดนมควาย)', icon: '🐃', cost: { wood: 14, stone: 4, fiber: 6 }, snap: 'cell', cat: 'ฟาร์ม', lvl: 2 },
  sheeppen: { name: 'คอกแกะ (จับแกะจากสวนแกะบางละมุงมาปล่อย · ตัดขนแกะ)', icon: '🐑', cost: { wood: 10, fiber: 6 }, snap: 'cell', cat: 'ฟาร์ม', lvl: 1 },
  bamboo_wall: { name: 'ผนังไม้ไผ่ (บ้านแบบง่าย · ต้องเรียนจักสาน)', icon: '🎋', cost: { bamboo: 6 }, snap: 'edge', cat: 'โครงบ้าน', lvl: 1, learn: 'wicker' },
  ricemill: { name: 'เครื่องสีข้าว (สีข้าวเปลือกเป็นข้าวสาร)', icon: '⚙️', cost: { wood: 8, stone: 6, scrap: 3 }, snap: 'cell', cat: 'ฟาร์ม', lvl: 1 },
  pond: { name: 'บ่อเลี้ยงปลา', icon: '🐟', cost: { stone: 6, wood: 2 }, snap: 'cell', cat: 'ฟาร์ม', lvl: 2 },
  hive: { name: 'กล่องเลี้ยงผึ้ง (ปลูกดอกไม้ใกล้ ๆ เพื่อล่อผึ้ง)', icon: '🐝', cost: { wood: 6, fiber: 2 }, snap: 'cell', cat: 'ฟาร์ม', lvl: 2 },
  stall: { name: 'แผงขายของหน้าบ้าน (ขายเป็นเงินจิ)', icon: '🏪', cost: { wood: 8, cloth: 2 }, snap: 'cell', cat: 'ของในบ้าน', lvl: 1 },
  sign: { name: 'ป้ายชื่อฐาน (ซื้อด้วยเงินจิ)', icon: '🪧', cost: { jicoin: 30 }, snap: 'cell', cat: 'ฐาน', lvl: 1 },
  basecore: { name: 'หลักบ้าน · คลังเงิน & ทะเบียนบ้าน (ประกาศฐาน)', icon: '🏦', cost: { wood: 10, stone: 8, scrap: 4 }, snap: 'cell', cat: 'ฐาน', lvl: 1 },
};
export const isPiece = (type) => !!PIECES[type];
// ซื้อชิ้นส่วนด้วยเงินจิแทนวัสดุ (ราคา ≈ มูลค่าวัสดุ × 1.2)
export const coinCost = (P, ITEMS) => (P.cost.jicoin ? P.cost.jicoin : Math.max(5, Math.ceil(Object.entries(P.cost).reduce((t, [k, q]) => t + (ITEMS[k]?.value || 1) * q, 0) * 2)));
export const BASE_COLORS = ['#a0764a', '#6c584c', '#e76f51', '#e9c46a', '#2a9d8f', '#264653', '#8ecae6', '#f1faee', '#9b5de5', '#d62828', '#588157', '#adb5bd'];
export const COLOR_COST = 50;
export const TINTABLE = new Set(['foundation', 'wall', 'bamboo_wall', 'window', 'door', 'roof', 'stairs', 'fence', 'gate', 'sign']);

export const CROPS = {
  corn: { name: 'ข้าวโพด', seed: 'seeds_corn', grow: 6 * 60000, out: ['corn', 3], seedBack: [1, 2], color: '#e9c46a' },
  veg: { name: 'ผักบุ้ง', seed: 'seeds_veg', grow: 4 * 60000, out: ['veg', 3], seedBack: [1, 2], color: '#52b788' },
  herb: { name: 'ฟ้าทะลายโจร', seed: 'herb', grow: 5 * 60000, out: ['herb', 3], seedBack: [0, 0], color: '#80b918' },
  tomato: { name: 'มะเขือเทศ', seed: 'seeds_tomato', grow: 5 * 60000, out: ['tomato', 3], seedBack: [1, 2], color: '#e63946' },
  chili: { name: 'พริก', seed: 'seeds_chili', grow: 4 * 60000, out: ['chili', 4], seedBack: [1, 2], color: '#d00000' },
  potato: { name: 'มันฝรั่ง', seed: 'seeds_potato', grow: 6 * 60000, out: ['potato', 3], seedBack: [1, 1], color: '#c9a66b', low: true },
  cabbage: { name: 'กะหล่ำปลี', seed: 'seeds_cabbage', grow: 6 * 60000, out: ['cabbage', 2], seedBack: [1, 2], color: '#95d5b2', low: true },
  carrot: { name: 'แครอท', seed: 'seeds_carrot', grow: 5 * 60000, out: ['carrot', 3], seedBack: [1, 2], color: '#f77f00', low: true },
  eggplant: { name: 'มะเขือยาว', seed: 'seeds_eggplant', grow: 5 * 60000, out: ['eggplant', 3], seedBack: [1, 2], color: '#7209b7' },
  pumpkin: { name: 'ฟักทอง', seed: 'seeds_pumpkin', grow: 8 * 60000, out: ['pumpkin', 2], seedBack: [1, 3], color: '#e76f51', low: true },
  watermelon: { name: 'แตงโม', seed: 'seeds_watermelon', grow: 8 * 60000, out: ['watermelon', 2], seedBack: [1, 3], color: '#2d6a4f', low: true },
  rice: { name: 'ข้าว', seed: 'seeds_rice', grow: 7 * 60000, out: ['paddy', 4], seedBack: [0, 1], color: '#e9d8a6' }, // ได้ข้าวเปลือก ต้องสีก่อน
  // ดอกไม้: ปลูกในแปลงหรือกระถางเพื่อล่อผึ้ง · ดอกไม้สวยงาม (pot) ปลูกได้เฉพาะในกระถาง เก็บไปให้เพื่อนได้
  sunflower: { name: 'ทานตะวัน', seed: 'seeds_sunflower', grow: 5 * 60000, out: ['sunflower', 2], seedBack: [1, 2], color: '#ffd60a', flower: true },
  marigold: { name: 'ดาวเรือง', seed: 'seeds_marigold', grow: 4 * 60000, out: ['marigold', 3], seedBack: [1, 2], color: '#ff9f1c', flower: true },
  rose: { name: 'กุหลาบ', seed: 'seeds_rose', grow: 6 * 60000, out: ['rose', 1], seedBack: [1, 1], color: '#e5383b', flower: true, pot: true },
  orchid: { name: 'กล้วยไม้', seed: 'seeds_orchid', grow: 8 * 60000, out: ['orchid', 1], seedBack: [0, 1], color: '#c77dff', flower: true, pot: true },
  jasmine: { name: 'มะลิ', seed: 'seeds_jasmine', grow: 5 * 60000, out: ['jasmine', 2], seedBack: [1, 1], color: '#ffffff', flower: true, pot: true },
  tulip: { name: 'ทิวลิป', seed: 'seeds_tulip', grow: 6 * 60000, out: ['tulip', 1], seedBack: [1, 1], color: '#ff5d8f', flower: true, pot: true },
};
// แปลงผักแยกชนิด: 1 แปลง = 1 พืช (สร้างจากเมนูก่อสร้าง หมวด "แปลงผัก")
for (const [k, C] of Object.entries(CROPS)) if (!C.pot) PIECES['plot_' + k] = { name: k === 'rice' ? 'นาข้าว (ปลูกข้าว · ได้ข้าวเปลือก)' : `แปลง${C.name}`, icon: C.flower ? '🌼' : '🌱', cost: { wood: 2, fiber: 2 }, snap: 'cell', cat: C.flower ? 'แปลงดอกไม้' : 'แปลงผัก', lvl: 1, crop: k };
export const isPlot = (t) => t === 'plot' || String(t).startsWith('plot_');
export const isGrow = (t) => isPlot(t) || t === 'pot';
export const plotCrop = (t) => PIECES[t]?.crop || null; // null = ปลูกได้หลายอย่าง
export const cropsFor = (t) => Object.keys(CROPS).filter((k) => t === 'pot' ? CROPS[k].flower : t === 'plot' ? !CROPS[k].pot : PIECES[t]?.crop === k);
export const needsTill = (s) => isPlot(s.type) && s.type !== 'plot';

// ---------- คอกสัตว์ ----------
// อายุ: ลูก (ยังไม่ให้ผลผลิต) → โตเต็มวัย → แก่ (ผลผลิตครึ่งเดียว) → ตายตามอายุ
// ให้ผลผลิตเฉพาะตอนที่ "อิ่ม" และ "มีน้ำ" พร้อมกัน (ปลาในบ่อแค่ให้อาหาร)
const M = 60000;
export const PENS = {
  coop: { animal: 'chicken', name: 'ไก่', foods: ['corn', 'seeds_corn', 'seeds_veg', 'seeds_rice', 'rice', 'rice_bran', 'paddy', 'veg', 'berry'], prod: ['egg', 1], period: 3 * M, cap: 8, adult: 8 * M, old: 120 * M, life: 180 * M, max: 4, meat: ['raw_meat', 1], start: 2, startAdult: true, egg: 'egg' },
  duckpen: { animal: 'duck', name: 'เป็ด', foods: ['corn', 'seeds_corn', 'seeds_rice', 'rice', 'rice_bran', 'paddy', 'veg', 'raw_fish'], prod: ['duck_egg', 1], period: 4 * M, cap: 8, adult: 10 * M, old: 130 * M, life: 190 * M, max: 4, meat: ['raw_meat', 2], meat2: ['duck_feather', 3], start: 2, egg: 'duck_egg', extra: ['duck_feather', 1] },
  pigpen: { animal: 'pig', name: 'หมู', foods: ['veg', 'corn', 'potato', 'cabbage', 'pumpkin', 'carrot', 'berry', 'watermelon', 'rice_bran'], prod: ['manure', 1], period: 5 * M, cap: 6, adult: 15 * M, old: 150 * M, life: 220 * M, max: 3, meat: ['pork', 4], start: 2 },
  cowpen: { animal: 'cow', name: 'วัว', foods: ['fiber', 'raw_fiber', 'corn', 'cabbage', 'veg', 'rice', 'carrot'], prod: ['milk', 1], period: 5 * M, cap: 6, adult: 20 * M, old: 180 * M, life: 260 * M, max: 2, meat: ['beef', 5], start: 1, extra: ['manure', 1] },
  buffalopen: { animal: 'buffalo', name: 'ควาย', foods: ['fiber', 'raw_fiber', 'corn', 'veg', 'rice', 'cabbage'], prod: ['buffalo_milk', 1], period: 5 * M, cap: 6, adult: 18 * M, old: 200 * M, life: 280 * M, max: 2, meat: ['raw_meat', 5], start: 0, extra: ['manure', 1] },
  sheeppen: { animal: 'sheep', name: 'แกะ', foods: ['fiber', 'raw_fiber', 'corn', 'veg', 'cabbage', 'carrot'], prod: ['wool', 2], period: 6 * M, cap: 8, adult: 12 * M, old: 160 * M, life: 230 * M, max: 4, meat: ['raw_meat', 2], start: 0 },
};
export const WATER_MS = 10 * M, WATER_MAX = 40 * M, BREED_CD = 10 * M;
// ฝูงสัตว์ปัจจุบัน (ตัดตัวที่หมดอายุออก) · b = เวลาเกิด · b < 0 = เล้าไก่รุ่นเก่า (โตตลอด)
export const herdOf = (s, now) => {
  const P = PENS[s.type]; if (!P) return [];
  const h = s.herd || Array.from({ length: P.start }, () => ({ b: -1 }));
  return h.filter((a) => a.b < 0 || now - a.b < P.life);
};
export const ageStage = (P, a, now) => (a.b < 0 ? 'adult' : now - a.b < P.adult ? 'baby' : now - a.b < P.old ? 'adult' : 'old');
export const STAGE_NAME = { baby: 'ลูก', adult: 'โตเต็มวัย', old: 'แก่' };
function workers(s, now) { const P = PENS[s.type]; return herdOf(s, now).reduce((n, a) => n + ({ baby: 0, adult: 1, old: 0.5 }[ageStage(P, a, now)]), 0); }
export const waterLeft = (s, now) => Math.max(0, (s.wat || 0) - now);
function settlePen(s, now) {
  const P = PENS[s.type], wat = s.type === 'coop' && s.wat === undefined && !s.herd ? s.fed : s.wat; // เล้าไก่เก่า: ไม่ต้องให้น้ำ
  const until = Math.min(s.fed || 0, wat || 0), ms = overlap(s.lt || now, now, until);
  const made = Math.floor((ms * workers(s, now)) / P.period + (s.pr || 0));
  return { eggs: Math.min(P.cap, (s.eggs || 0) + made), pr: 0, lt: now, herd: herdOf(s, now) };
}
export const penGoods = (s, now) => settlePen(s, now).eggs;

// ---------- ผึ้ง ----------
// มีดอกไม้บานใกล้กล่องผึ้ง (ไม่เกิน 12 หน่วย) ผึ้งจะมาทำรัง · ดอกไม้ยิ่งมากน้ำผึ้งยิ่งเร็ว
export const HONEY_MS = 4 * M, HONEY_CAP = 6, BEE_R = 12;
export const flowersNear = (structs, s, now) => structs.filter((o) => isGrow(o.type) && o.crop && CROPS[o.crop]?.flower && cropProgress(o, now) >= 0.5 && Math.hypot(o.x - s.x, o.z - s.z) <= BEE_R).length;
const honeyPeriod = (fl) => HONEY_MS / (1 + Math.min(6, fl - 1) * 0.3);
export function hiveHoney(s, now) { if (!s.bees || !s.fl) return s.hn || 0; return Math.min(HONEY_CAP, (s.hn || 0) + Math.floor((now - (s.lt || now)) / honeyPeriod(s.fl))); }

// ---------- แผงขายของ ----------
export const STALL_MAX = 8;
export const DRY_RATE = 0.35;              // โตช้าลงถ้าไม่ได้รดน้ำ
export const EGG_MS = 3 * 60000;
export const POND_MS = 6 * 60000;
export const FEED_MS = 8 * 60000, FEED_MAX = 40 * 60000;
export const FEEDS = ['corn', 'veg', 'berry', 'seeds_corn', 'seeds_veg'];

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 0=เหนือ 1=ตะวันออก 2=ใต้ 3=ตะวันตก
export const cellOf = (x, z) => [Math.floor(x / G), Math.floor(z / G)];
export const cellCenter = (cx, cz) => [(cx + 0.5) * G, (cz + 0.5) * G];
// 🪵 ล้อมรั้วสำเร็จรูปด้วยเงินจิ: สี่เหลี่ยม n×n ช่อง (2–20) มีประตูรั้ว 1–4 ทาง (กลางด้านเหนือ ใต้ ตะวันออก ตะวันตก)
export const RING_MIN = 2, RING_MAX = 20;
// 🛠️ ระดับรั้ว: เพิ่มวัสดุเพื่อให้รั้วสูงและแข็งแรงขึ้น
export const FENCE_TIERS = [
  { name: 'รั้วไม้', h: FENCE_H, cost: {} },
  { name: 'รั้วไม้เสริมแข็งแรง', h: 2.2, cost: { wood: 3 } },
  { name: 'รั้วเหล็ก', h: 2.6, cost: { scrap: 4, stone: 1 } },
];
export const fenceH = (s) => FENCE_TIERS[s.tier || 0]?.h || FENCE_H;
// 🏠 บ้านน็อคดาวน์ (ซื้อด้วยเงินจิ): ฐานราก + ผนังรอบ (ประตู 1 · หน้าต่างด้านอื่น) + หลังคา ขนาด n×n ช่อง
// door = ทิศของประตู (0=เหนือ 1=ตะวันออก 2=ใต้ 3=ตะวันตก) · ทุกช่องใช้ระดับพื้นเดียวกัน
export const PREFAB_MIN = 1, PREFAB_MAX = 3;
export function prefabHouse(cx0, cz0, n, door) {
  let top = -1e9; const lows = {};
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const [x, z] = cellCenter(cx0 + i, cz0 + j), hs = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([dx, dz]) => heightAt(x + dx * G / 2, z + dz * G / 2));
    top = Math.max(top, ...hs); lows[i + ':' + j] = Math.min(...hs);
  }
  const floor = +(top + 0.5).toFixed(2), out = [], mid = Math.floor((n - 1) / 2);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const [x, z] = cellCenter(cx0 + i, cz0 + j);
    out.push({ type: 'foundation', x, z, y: +top.toFixed(2), rot: 0, drop: +(top - lows[i + ':' + j] + 0.3).toFixed(2) });
    out.push({ type: 'roof', x, z, y: +(floor + WALL_H).toFixed(2), rot: 0 });
  }
  for (let k = 0; k < n; k++) for (const [rot, cx, cz] of [[0, cx0 + k, cz0], [2, cx0 + k, cz0 + n - 1], [1, cx0 + n - 1, cz0 + k], [3, cx0, cz0 + k]]) {
    const p = slotPos('wall', cx, cz, rot), type = rot === door && k === mid ? 'door' : k === mid ? 'window' : 'wall';
    out.push({ type, x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: floor, rot });
  }
  return out;
}
export const prefabPrice = (n, ITEMS) => Math.round(prefabHouse(0, 0, n, 2).reduce((t, s) => t + coinCost(PIECES[s.type], ITEMS), 0) * 1 + 40 * n);
export function fenceRingPrice(n, gates, ITEMS) {
  const f = coinCost(PIECES.fence, ITEMS), gt = coinCost(PIECES.gate, ITEMS);
  return (4 * n - gates) * f + gates * (gt + 15) + n * n * 2; // ค่ารั้วรอบ + ประตู + ค่าปรับพื้นที่ตามขนาด
}
export function fenceRing(px, pz, n, gates) {
  const [c0, r0] = cellOf(px, pz), cx0 = c0 - Math.floor((n - 1) / 2), cz0 = r0 - Math.floor((n - 1) / 2), mid = Math.floor((n - 1) / 2);
  const out = [], gateAt = new Set(['0:' + mid, '2:' + mid, '1:' + mid, '3:' + mid].slice(0, gates));
  for (let i = 0; i < n; i++) for (const [rot, cx, cz] of [[0, cx0 + i, cz0], [2, cx0 + i, cz0 + n - 1], [1, cx0 + n - 1, cz0 + i], [3, cx0, cz0 + i]]) {
    const p = slotPos('fence', cx, cz, rot), al = rot & 1;
    const y = Math.min(heightAt(p.x - (al ? 0 : 1.4), p.z - (al ? 1.4 : 0)), heightAt(p.x + (al ? 0 : 1.4), p.z + (al ? 1.4 : 0)));
    out.push({ type: gateAt.has(rot + ':' + i) ? 'gate' : 'fence', x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: +y.toFixed(2), rot });
  }
  return out;
}
// ตำแหน่งของชิ้นส่วนบนกริด
export function slotPos(type, cx, cz, rot) {
  const [x, z] = cellCenter(cx, cz);
  if (PIECES[type]?.snap !== 'edge') return { x, z };
  const [dx, dz] = DIRS[rot & 3];
  return { x: x + dx * G / 2, z: z + dz * G / 2 };
}
export const slotKey = (s) => `${s.type === 'walllamp' ? 'l' + (s.sd > 0 ? '+' : '-') : PIECES[s.type]?.snap === 'edge' ? 'e' : s.type === 'roof' ? 'r' : s.type === 'foundation' ? 'f' : 'c'}:${Math.round(s.x * 10)}:${Math.round(s.z * 10)}:${Math.round(s.y || 0)}`;
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
    case 'wall': case 'window': case 'bamboo_wall': edge(G, 0.3, WALL_H, 0, y); break;
    case 'door': edge(0.9, 0.3, WALL_H, -1.05, y); edge(0.9, 0.3, WALL_H, 1.05, y); edge(1.2, 0.3, WALL_H, 0, y + 2.3); if (!s.open) edge(1.2, 0.3, 2.3, 0, y); break;
    case 'fence': edge(G, 0.2, fenceH(s), 0, y); break;
    case 'gate': { const h = fenceH(s); edge(0.3, 0.2, h, -1.35, y); edge(0.3, 0.2, h, 1.35, y); if (!s.open) edge(2.4, 0.2, h, 0, y); break; }
    case 'balcony': {
      // พื้นระเบียง + ราวกันตก 3 ด้าน (ด้านที่ติดบ้านเปิดโล่ง)
      out.push({ x: s.x, z: s.z, w: G, d: G, top: y + 0.2 + 1, bottom: y, sid });
      for (let r = 0; r < 4; r++) if (r !== (s.rot & 3)) { const [dx, dz] = DIRS[r]; out.push({ x: s.x + dx * (G / 2 - 0.05), z: s.z + dz * (G / 2 - 0.05), w: dx ? 0.12 : G, d: dx ? G : 0.12, top: y + 0.2 + 1.1 + 1, bottom: y, sid }); }
      break;
    }
    case 'roof': out.push({ x: s.x, z: s.z, w: G, d: G, top: y + 0.2 + 1, bottom: y, sid }); break;
    case 'stairs': out.push({ x: s.x, z: s.z, w: G, d: G, ramp: true, noCollide: true, base: y, rise: WALL_H, dir: s.rot & 3, top: y + WALL_H + 1, sid }); break;
    case 'storage': out.push({ x: s.x, z: s.z, w: 1.2, d: 0.8, top: y + 0.9 + 1, sid }); break;
    case 'cage': out.push({ x: s.x, z: s.z, w: 2.2, d: 2.2, top: y + 1.8 + 1, sid }); break;
    case 'pethouse': out.push({ x: s.x, z: s.z, w: 1.6, d: 1.6, top: y + 1.4 + 1, sid }); break;
    case 'coop': case 'duckpen': case 'pigpen': case 'cowpen': case 'buffalopen': case 'sheeppen': out.push({ x: s.x, z: s.z, w: 2.8, d: 2.8, top: y + 1.1 + 1, sid }); break;
    case 'hive': out.push({ x: s.x, z: s.z, w: 0.8, d: 0.8, top: y + 1.1 + 1, sid }); break;
    case 'stall': out.push({ x: s.x, z: s.z, w: 2.2, d: 1, top: y + 1 + 1, sid }); break;
    case 'basecore': out.push({ x: s.x, z: s.z, w: 1, d: 1, top: y + 1.4 + 1, sid }); break;
    case 'anvil': out.push({ x: s.x, z: s.z, w: 1.0, d: 0.6, top: y + 0.9 + 1, sid }); break;
    case 'ricemill': out.push({ x: s.x, z: s.z, w: 1.6, d: 1.2, top: y + 1.6 + 1, sid }); break;
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
  return Math.min(1, (dry * DRY_RATE + wet + (s.fb || 0) + (s.hs || 0) * C.grow) / C.grow); // hs = โตไวจากฝีมือชาวนา
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
  if (s.type === 'basecore') { const r = baseOp(s, op, ctx); if (r) return r; }
  if (ctx.role !== undefined && !roleAllows(ctx.role, s, op.o)) return { err: '🔒 เฉพาะเจ้าบ้าน/ผู้มีหน้าที่ดูแล (ผู้ดูแลสัตว์/ผู้ดูแลพืช) เท่านั้น' };
  switch (op.o) {
    case 'bait':
      if (s.type !== 'cage') return { err: 'ใส่เหยื่อได้เฉพาะกรงดักสัตว์' };
      if (s.bait) return { err: 'มีเหยื่ออยู่ในกรงแล้ว' };
      if (![...BAIT_MEAT, ...BAIT_PLANT].includes(op.item)) return { err: 'ใช้เป็นเหยื่อไม่ได้' };
      return { patch: { bait: op.item, bt: now }, msg: '🪤 วางเหยื่อแล้ว รอสัตว์มาติดกรงประมาณ 3 นาที' };
    case 'claim':
      if (s.type !== 'cage' || !cageCatch(s, now)) return { err: 'ยังไม่มีสัตว์ติดกรง' };
      return { patch: { bait: null, bt: null }, msg: { farm: '🏡 ใส่กรงหิ้วแล้ว — นำไปปล่อยที่คอกในฟาร์ม', food: '🍖 แปรรูปเป็นอาหารแล้ว', free: '🌿 ปล่อยสัตว์คืนป่าแล้ว' }[op.mode] || '🐾 เปิดกรงแล้ว' };
    case 'addlive': {
      // ปล่อยสัตว์ที่จับจากกรงเข้าคอก (เป็นตัวโตเต็มวัย)
      const P = PENS[s.type]; if (!P) return { err: 'ปล่อยได้เฉพาะในคอกสัตว์' };
      const st = settlePen(s, now); if (st.herd.length >= P.max) return { err: `คอกนี้เต็มแล้ว (${P.max} ตัว)` };
      return { patch: { ...st, herd: [...st.herd, { b: now - P.adult }] }, msg: `🐾 ปล่อย${P.name}เข้าคอกแล้ว` };
    }
    case 'door':
      if (s.lock && !ctx.canAccess) return { err: '🔒 ประตูนี้ล็อกไว้ (เปิดได้เฉพาะเจ้าของและเพื่อนของเจ้าของ)' };
      return { patch: { open: !s.open } };
    case 'upfence': {
      // อัปเกรดรั้ว/ประตูรั้ว: ไม้ → ไม้เสริม → เหล็ก (สูงขึ้น แข็งแรงขึ้น)
      if (s.type !== 'fence' && s.type !== 'gate') return { err: 'อัปเกรดได้เฉพาะรั้วและประตูรั้ว' };
      if (s.owner && s.owner !== ctx.by && !['owner', 'deputy'].includes(ctx.role)) return { err: '🔒 อัปเกรดได้เฉพาะเจ้าของ/รองเจ้าบ้าน' };
      const t = (s.tier || 0) + 1; if (!FENCE_TIERS[t]) return { err: 'รั้วนี้เป็นรั้วเหล็กแล้ว (ระดับสูงสุด)' };
      return { patch: { tier: t }, msg: `🛠️ อัปเกรดเป็น${FENCE_TIERS[t].name}แล้ว` };
    }
    case 'lock':
      if (s.owner && s.owner !== ctx.by) return { err: 'ล็อก/ปลดล็อกได้เฉพาะเจ้าของ' };
      return { patch: { lock: !s.lock }, msg: !s.lock ? '🔒 ล็อกแล้ว — เข้าได้เฉพาะคุณและเพื่อนระดับ "เพื่อน" ขึ้นไป' : '🔓 ปลดล็อกแล้ว' };
    case 'till':
      // พรวนดิน: ก่อนปลูก (จำเป็น) และระหว่างโต 1 ครั้ง (ผลผลิต +1)
      if (!isPlot(s.type)) return { err: 'พรวนดินได้เฉพาะแปลงผัก' };
      if (!s.crop) { if (s.tl) return { err: 'พรวนดินไว้แล้ว ปลูกได้เลย' }; return { patch: { tl: 1 }, msg: '⛏️ พรวนดินแล้ว พร้อมปลูก' }; }
      if (s.lo) return { err: 'พรวนดินรอบนี้ไปแล้ว' };
      if (cropProgress(s, now) >= 1) return { err: 'สุกแล้ว เก็บเกี่ยวได้เลย' };
      return { patch: { lo: 1 }, msg: '⛏️ พรวนดินรอบต้น ผลผลิตจะเพิ่มขึ้น' };
    case 'plant':
      if (!isGrow(s.type)) return { err: 'ปลูกตรงนี้ไม่ได้' };
      if (s.crop) return { err: 'แปลงนี้ปลูกอยู่แล้ว' };
      if (!CROPS[op.crop]) return { err: 'ไม่รู้จักพืชนี้' };
      if (!cropsFor(s.type).includes(op.crop)) return { err: s.type === 'pot' ? 'กระถางปลูกได้เฉพาะดอกไม้' : `แปลงนี้ปลูกได้เฉพาะ${cropsFor(s.type).map((k) => CROPS[k].name).join('/')}` };
      if (needsTill(s) && !s.tl) return { err: '⛏️ ต้องพรวนดินด้วยจอบก่อนปลูก' };
      return { patch: { crop: op.crop, pt: now, wt: op.wet ? now : null, fb: 0, lo: 0, hs: Math.min(0.5, +op.hs || 0) }, msg: `🌱 ปลูก${CROPS[op.crop].name}แล้ว รดน้ำเพื่อให้โตเร็วขึ้น` };
    case 'water':
      if (!s.crop || s.wt) return { err: 'ไม่ต้องรดน้ำตอนนี้' };
      return { patch: { wt: now }, msg: '💧 รดน้ำแล้ว' };
    case 'fert': {
      // ปุ๋ยคอก: เร่งโต 30%
      if (!s.crop || cropProgress(s, now) >= 1) return { err: 'ใส่ปุ๋ยได้ตอนพืชกำลังโต' };
      if ((s.fb || 0) > 0) return { err: 'ใส่ปุ๋ยรอบนี้ไปแล้ว' };
      return { patch: { fb: CROPS[s.crop].grow * 0.3 }, msg: '💩 ใส่ปุ๋ยคอกแล้ว พืชโตเร็วขึ้น' };
    }
    case 'harvest': {
      if (!s.crop || cropProgress(s, now) < 1) return { err: 'ยังไม่สุก' };
      const C = CROPS[s.crop], give = { [C.out[0]]: C.out[1] + (s.lo ? 1 : 0) + (plotCrop(s.type) ? 1 : 0) };
      const sb = C.seedBack[0] + Math.floor(rand() * (C.seedBack[1] - C.seedBack[0] + 1));
      if (sb) give[C.seed] = (give[C.seed] || 0) + sb;
      return { patch: { crop: null, pt: null, wt: null, fb: 0, lo: 0, tl: 0 }, give, msg: `🧺 เก็บเกี่ยว${C.name}แล้ว${needsTill(s) ? ' (พรวนดินใหม่ก่อนปลูกรอบหน้า)' : ''}` };
    }
    case 'drink': {
      // ให้น้ำสัตว์ในคอก
      if (!PENS[s.type]) return { err: 'ให้น้ำได้เฉพาะคอกสัตว์' };
      if (waterLeft(s, now) > WATER_MAX - WATER_MS) return { err: 'รางน้ำยังเต็มอยู่' };
      const st = settlePen(s, now);
      return { patch: { ...st, wat: Math.max(now, s.wat || 0) + WATER_MS }, msg: op.silent ? null : `💧 เติมน้ำให้${PENS[s.type].name}แล้ว` };
    }
    case 'breed': {
      // เพิ่มสัตว์: สัตว์ปีกใช้ไข่ฟัก · หมู/วัวต้องมีตัวโต 2 ตัวที่อิ่มและมีน้ำ
      const P = PENS[s.type]; if (!P) return { err: 'ทำไม่ได้' };
      const herd = herdOf(s, now);
      if (herd.length >= P.max) return { err: `คอกนี้เลี้ยง${P.name}ได้สูงสุด ${P.max} ตัว` };
      if (!P.egg) {
        if (herd.filter((a) => ageStage(P, a, now) === 'adult').length < 2) return { err: `ต้องมี${P.name}โตเต็มวัย 2 ตัวขึ้นไป` };
        if ((s.fed || 0) < now || (s.wat || 0) < now) return { err: `ต้องให้อาหารและน้ำ${P.name}ก่อน` };
        if (now - (s.bd || 0) < BREED_CD) return { err: `เพิ่งมีลูกไป รออีก ${Math.ceil((BREED_CD - (now - s.bd)) / 60000)} นาที` };
      }
      const st = settlePen(s, now);
      return { patch: { ...st, herd: [...st.herd, { b: now }], bd: now }, msg: P.egg ? `🐣 ฟักไข่แล้ว ได้ลูก${P.name} 1 ตัว` : `🍼 มีลูก${P.name}เกิดใหม่ 1 ตัว!` };
    }
    case 'butcher': {
      const P = PENS[s.type]; if (!P) return { err: 'ทำไม่ได้' };
      const st = settlePen(s, now), i = st.herd.findIndex((a) => ageStage(P, a, now) !== 'baby');
      if (i < 0) return { err: `ยังไม่มี${P.name}ที่โตพอ` };
      const herd = st.herd.filter((_, j) => j !== i);
      const give = { [P.meat[0]]: P.meat[1] }; if (P.meat2) give[P.meat2[0]] = P.meat2[1];
      return { patch: { ...st, herd }, give, msg: `🔪 ได้${P.meat[1]} ชิ้นจาก${P.name}${P.meat2 ? ' + ขน' : ''}` };
    }
    case 'bees': {
      // ตรวจผึ้ง (เรียกเป็นระยะ): ctx.flowers = จำนวนดอกไม้บานรอบกล่อง
      if (s.type !== 'hive') return { err: 'ทำไม่ได้' };
      const fl = ctx.flowers | 0;
      if (!s.bees) return fl > 0 ? { patch: { bees: now, lt: now, hn: 0, fl }, msg: '🐝 ผึ้งบินมาทำรังในกล่องแล้ว!' } : { err: '🌼 ยังไม่มีผึ้ง — ปลูกดอกไม้ให้บานใกล้กล่อง (ไม่เกิน 12 หน่วย)' };
      if (fl === (s.fl || 0)) return { patch: {} };
      return { patch: { hn: hiveHoney(s, now), lt: now, fl } };
    }
    case 'feed': {
      if (PENS[s.type] && s.type !== 'coop' || (s.type === 'coop' && s.herd)) {
        const P = PENS[s.type];
        if (!P.foods.includes(op.item)) return { err: `${P.name}ไม่กินอันนี้` };
        if (fedLeft(s, now) > FEED_MAX - FEED_MS) return { err: 'ยังอิ่มอยู่' };
        return { patch: { ...settlePen(s, now), fed: Math.max(now, s.fed || 0) + FEED_MS }, msg: `🍽️ ให้อาหาร${P.name}แล้ว` };
      }
      const st = s.type === 'coop' ? settle(s, now, EGG_MS, 8, 'eggs') : (s.stock || 0) >= 1 ? settle(s, now, pondPeriod(s), 8, 'fish') : { lt: now };
      if (fedLeft(s, now) > FEED_MAX - FEED_MS) return { err: 'ยังอิ่มอยู่' };
      return { patch: { ...st, fed: Math.max(now, s.fed || 0) + FEED_MS }, msg: s.type === 'coop' ? '🐔 ให้อาหารไก่แล้ว' : '🐟 ให้อาหารปลาแล้ว' };
    }
    case 'collect': {
      if (s.type === 'hive') {
        const n = hiveHoney(s, now); if (!n) return { err: s.bees ? 'ยังไม่มีน้ำผึ้ง รอผึ้งทำงานก่อน' : 'ยังไม่มีผึ้งมาทำรัง' };
        const give = { honey: n }; if (n >= 2) give.beeswax = Math.floor(n / 2);
        return { patch: { hn: 0, lt: now }, give, msg: `🍯 เก็บน้ำผึ้งได้ ${n} ขวด` };
      }
      if (PENS[s.type] && (s.type !== 'coop' || s.herd || s.wat !== undefined)) {
        const P = PENS[s.type], st = settlePen(s, now), n = st.eggs;
        if (!n) return { err: `ยังไม่มีผลผลิต (ต้องมี${P.name}โตเต็มวัย ให้อาหารและน้ำ)` };
        const give = { [P.prod[0]]: n * P.prod[1] }; if (P.extra) give[P.extra[0]] = Math.ceil(n / 2) * P.extra[1];
        return { patch: { ...st, eggs: 0 }, give, msg: `🧺 เก็บ${n * P.prod[1]} ชิ้นจากคอก${P.name}` };
      }
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
    // แผงขายของ: เจ้าของวางของ + ตั้งราคา (เงินจิ) · คนอื่นซื้อ · เงินเก็บในแผงจนเจ้าของมาเก็บ
    case 'list': {
      if (s.type !== 'stall') return { err: 'ทำไม่ได้' };
      if (s.owner && s.owner !== ctx.by) return { err: 'วางขายได้เฉพาะเจ้าของแผง' };
      const goods = [...(s.goods || [])], q = op.qty | 0, price = Math.floor(+op.price);
      if (!(q > 0) || !(price >= 1 && price <= 99999)) return { err: 'จำนวนหรือราคาไม่ถูกต้อง' };
      const row = goods.find((r) => r.k === op.item && r.p === price);
      if (row) row.q += q; else { if (goods.length >= STALL_MAX) return { err: `แผงวางของได้ ${STALL_MAX} รายการ` }; goods.push({ k: op.item, q, p: price }); }
      return { patch: { goods: goods.map((r) => ({ ...r })) }, msg: '🏪 วางขายแล้ว' };
    }
    case 'unlist': {
      if (s.owner && s.owner !== ctx.by) return { err: 'เก็บของได้เฉพาะเจ้าของแผง' };
      const goods = (s.goods || []).map((r) => ({ ...r })), i = op.i | 0; if (!goods[i]) return { err: 'ไม่พบสินค้า' };
      const [r] = goods.splice(i, 1);
      return { patch: { goods }, give: { [r.k]: r.q } };
    }
    case 'buy': {
      const goods = (s.goods || []).map((r) => ({ ...r })), i = op.i | 0, r = goods[i];
      if (!r || r.k !== op.item || r.p !== op.price) return { err: 'สินค้าเปลี่ยนไปแล้ว ลองใหม่' };
      if (s.owner === ctx.by) return { err: 'ซื้อของจากแผงตัวเองไม่ได้' };
      r.q -= 1; if (r.q <= 0) goods.splice(i, 1);
      return { patch: { goods, cash: (s.cash || 0) + r.p }, give: { [r.k]: 1 }, msg: `🛒 ซื้อแล้ว (จ่าย 🪙 ${r.p} เงินจิ)` };
    }
    case 'cashout': {
      if (s.owner && s.owner !== ctx.by) return { err: 'เก็บเงินได้เฉพาะเจ้าของแผง' };
      if (!s.cash) return { err: 'ยังไม่มีเงินในแผง' };
      return { patch: { cash: 0 }, give: { jicoin: s.cash }, msg: `🪙 เก็บเงินจิจากแผงได้ ${s.cash}` };
    }
  }
  return { err: 'ทำไม่ได้' };
}

// ค่าคืนเมื่อรื้อ (ครึ่งหนึ่งของวัสดุ + ของในหีบ)
export function refundFor(s) {
  const give = {};
  if (s.paid) give.jicoin = s.paid; // ซื้อด้วยเงินจิ = ได้เงินคืน
  else for (const [k, q] of Object.entries(PIECES[s.type]?.cost || {})) give[k] = q; // รื้อแล้วได้วัสดุคืนครบ
  for (let t = 1; t <= (s.tier || 0); t++) for (const [k, q] of Object.entries(FENCE_TIERS[t].cost)) give[k] = (give[k] || 0) + q; // วัสดุที่ใช้อัปเกรดรั้ว
  for (const [k, q] of Object.entries(s.items || {})) give[k] = (give[k] || 0) + q;
  if (s.type === 'vehicle') give[s.vt] = 1;
  for (const r of s.goods || []) give[r.k] = (give[r.k] || 0) + r.q;
  if (s.cash) give.jicoin = (give.jicoin || 0) + s.cash;
  if (s.type === 'pot') give.flower_pot = 1;
  if (s.type === 'basecore') { if (s.bank) give.jicoin = (give.jicoin || 0) + s.bank; for (const v of Object.values(s.pv || {})) give.jicoin = (give.jicoin || 0) + v; for (const m of Object.values(s.pi || {})) for (const [k, q] of Object.entries(m || {})) give[k] = (give[k] || 0) + q; for (const [k, q] of Object.entries(s.up || {})) give[k] = (give[k] || 0) + q; }
  return give;
}

// ---------- ฐาน (บ้าน + รั้ว) ----------
// ต้องมีบ้าน (พื้น ผนัง ประตู หลังคา เตียง) และรั้ว + ประตูรั้วล้อมรอบ จึงประกาศเป็นฐานได้ · ฐานมีคลังเงิน/คลังส่วนตัว สมาชิก 12 คน
// คอกสัตว์ แปลงผัก กระถาง กล่องผึ้ง บ่อปลา ต้องสร้างในรั้วของฐานเท่านั้น
// รั้วและบ้านกันผู้ติดเชื้อได้ 60 วันในเกมหลังประกาศฐาน · อัปเกรดระดับหรือซ่อมแซม = นับใหม่
export const BASE_R = 30;
export const BASE_NEED = { foundation: [2, 'พื้น (ฐานราก)'], wall: [3, 'ผนัง/หน้าต่าง'], door: [1, 'ประตู'], roof: [1, 'หลังคา'], bed: [1, 'เตียง'], fence: [6, 'รั้ว'], gate: [1, 'ประตูรั้ว'] };
export const HOUSE_MAX = 12;
export const ROLES = { owner: '👑 เจ้าบ้าน', deputy: '🎖️ รองเจ้าบ้าน', animal: '🐄 ผู้ดูแลสัตว์', plant: '🌱 ผู้ดูแลพืช', resident: '🏠 ผู้อาศัย' };
// ระดับบ้าน: คลังเงินส่วนรวม / คลังเงินส่วนตัว (ต่อคน) / ช่องเก็บของส่วนตัว (ต่อคน)
export const HOUSE_LV = [null, { bank: 500, pv: 300, ps: 6 }, { bank: 1500, pv: 800, ps: 10 }, { bank: 4000, pv: 2000, ps: 14 }, { bank: 10000, pv: 5000, ps: 20 }, { bank: 25000, pv: 12000, ps: 28 }];
// ของที่ต้องเติมเพื่ออัปเกรดเป็นระดับถัดไป (เพิ่มขึ้นตามระดับ)
export const HOUSE_UP = [null, null, { wood: 40, stone: 30, fiber: 20 }, { wood: 80, stone: 60, scrap: 20, cloth: 10 }, { wood: 140, stone: 110, scrap: 45, cloth: 25, copper_wire: 10 }, { wood: 220, stone: 180, scrap: 80, cloth: 40, copper_wire: 25, jicoin: 2000 }];
export const REPAIR_BASE = (lv) => ({ wood: 10 * lv, stone: 8 * lv });
export const PROTECT_DAYS = 60, GAME_DAY_MS = 36 * 60000;
export const protectLeft = (b, now) => (b?.ok ? Math.max(0, (b.prot || 0) + PROTECT_DAYS * GAME_DAY_MS - now) : 0);
const FARM_TYPES = new Set(['coop', 'duckpen', 'pigpen', 'cowpen', 'buffalopen', 'sheeppen', 'pond', 'hive', 'pot']);
export const needsBase = (t) => FARM_TYPES.has(t) || String(t).startsWith('plot_');
export const inBox = (b, x, z, pad = 0) => !!b && x > b[0] - pad && x < b[2] + pad && z > b[1] - pad && z < b[3] + pad;
export const baseAt = (structs, x, z) => structs.find((s) => s.type === 'basecore' && s.ok && inBox(s.box, x, z));
export const roleIn = (b, id) => (!b ? null : b.owner === id ? 'owner' : b.mem?.[id]?.r || null);
export const basesOf = (structs, id) => structs.filter((s) => s.type === 'basecore' && s.ok && roleIn(s, id));
// ตรวจองค์ประกอบของฐานรอบหลักบ้าน
export function baseCheck(structs, core) {
  const mine = structs.filter((o) => o.owner === core.owner && Math.hypot(o.x - core.x, o.z - core.z) <= BASE_R);
  const cnt = (t) => mine.filter((o) => o.type === t || (t === 'wall' && (o.type === 'window' || o.type === 'bamboo_wall'))).length;
  const missing = Object.entries(BASE_NEED).filter(([t, [n]]) => cnt(t) < n).map(([t, [n, name]]) => `${name} ${cnt(t)}/${n}`);
  const fence = mine.filter((o) => o.type === 'fence' || o.type === 'gate');
  let box = null;
  if (fence.length) {
    box = [Math.min(...fence.map((o) => o.x)), Math.min(...fence.map((o) => o.z)), Math.max(...fence.map((o) => o.x)), Math.max(...fence.map((o) => o.z))].map((v) => +v.toFixed(2));
    if (box[2] - box[0] < G * 2 || box[3] - box[1] < G * 2) missing.push('รั้วต้องล้อมพื้นที่อย่างน้อย 2×2 ช่อง');
    const house = mine.filter((o) => ['foundation', 'bed', 'door'].includes(o.type));
    if (house.some((o) => !inBox(box, o.x, o.z, 0.01))) missing.push('ตัวบ้านต้องอยู่ภายในรั้ว');
  }
  return { ok: !missing.length, missing, box };
}
// สิทธิ์ของผู้กระทำต่อสิ่งก่อสร้าง: owner / deputy / animal / plant / resident / friend / null
export function accessFor(structs, s, by, friendOk) {
  if (!s.owner || s.owner === by) return 'owner';
  const b = baseAt(structs, s.x, s.z), r = b && b.owner === s.owner ? roleIn(b, by) : null;
  return r || (friendOk ? 'friend' : null);
}
const ANIMAL_T = new Set(['coop', 'duckpen', 'pigpen', 'cowpen', 'buffalopen', 'sheeppen', 'pond', 'hive']);
// คำสั่งที่ "เอาของออก" ต้องเป็นผู้มีหน้าที่
export function roleAllows(role, s, o) {
  if (!['harvest', 'collect', 'butcher', 'breed', 'till', 'plant', 'fert', 'stock'].includes(o)) return true;
  if (role === 'owner' || role === 'deputy' || role === 'friend') return true;
  if (role === 'animal') return ANIMAL_T.has(s.type);
  if (role === 'plant') return isGrow(s.type) || s.type === 'hive';
  return false;
}
export function canDemolish(s, by) {
  if (s.type === 'basecore' && Object.entries(s.pv || {}).some(([id, v]) => id !== by && v > 0)) return 'ยังมีเงินในคลังส่วนตัวของสมาชิกคนอื่น — ให้ถอนออกก่อน';
  if (s.type === 'basecore' && Object.entries(s.pi || {}).some(([id, v]) => id !== by && Object.keys(v || {}).length)) return 'ยังมีของในคลังส่วนตัวของสมาชิกคนอื่น — ให้ถอนออกก่อน';
  return null;
}
// คำสั่งของหลักบ้าน (เรียกจาก applyOp)
function baseOp(s, op, ctx) {
  const now = ctx.now, by = ctx.by, role = roleIn(s, by), boss = role === 'owner' || role === 'deputy', L = HOUSE_LV[s.lv || 1];
  switch (op.o) {
    case 'declare':
      if (s.owner && s.owner !== by) return { err: 'ประกาศฐานได้เฉพาะเจ้าของ' };
      if (!op.box) return { err: 'ยังสร้างไม่ครบ' };
      return { patch: { ok: 1, box: op.box, name: String(op.name || 'บ้านของฉัน').slice(0, 20), lv: s.lv || 1, prot: now, mem: s.mem || {} }, msg: '🏡 ประกาศเป็นฐานแล้ว! มาร์คบนแผนที่ · รั้วและบ้านกันผู้ติดเชื้อได้ 60 วัน' };
    case 'contrib': {
      if (!s.ok) return { err: 'ประกาศฐานก่อน' };
      if (!role) return { err: 'เฉพาะสมาชิกบ้าน' };
      const lv = s.lv || 1, need = HOUSE_UP[lv + 1]; if (!need) return { err: 'บ้านระดับสูงสุดแล้ว' };
      const up = { ...(s.up || {}) }, k = op.item, q = op.qty | 0;
      if (!need[k] || q <= 0) return { err: 'ของนี้ไม่ได้อยู่ในรายการอัปเกรด' };
      up[k] = (up[k] || 0) + q;
      if (Object.entries(need).every(([i, n]) => (up[i] || 0) >= n)) return { patch: { lv: lv + 1, up: {}, prot: now }, msg: `⬆️ บ้านอัปเกรดเป็นระดับ ${lv + 1}! คลังใหญ่ขึ้น · การป้องกันผู้ติดเชื้อนับใหม่ 60 วัน` };
      return { patch: { up }, msg: `🧱 เติม ${q} ชิ้นเข้ารายการอัปเกรด` };
    }
    case 'color':
      if (!s.ok) return { err: 'ประกาศฐานก่อน' };
      if (!boss) return { err: 'เปลี่ยนสีได้เฉพาะเจ้าบ้าน/รองเจ้าบ้าน' };
      if (!BASE_COLORS.includes(op.c)) return { err: 'สีไม่ถูกต้อง' };
      return { patch: { col: op.c }, msg: '🎨 เปลี่ยนสีฐานแล้ว' };
    case 'rename':
      if (!s.ok || !boss) return { err: 'เปลี่ยนชื่อได้เฉพาะเจ้าบ้าน/รองเจ้าบ้าน' };
      return { patch: { name: String(op.name || '').slice(0, 20) || s.name }, msg: '🪧 เปลี่ยนชื่อฐานแล้ว' };
    case 'repair':
      if (!s.ok) return { err: 'ประกาศฐานก่อน' };
      if (!boss) return { err: 'ซ่อมได้เฉพาะเจ้าบ้าน/รองเจ้าบ้าน' };
      return { patch: { prot: now }, msg: '🔧 ซ่อมแซมรั้วและบ้านแล้ว · การป้องกันผู้ติดเชื้อนับใหม่ 60 วัน' };
    case 'bank': {
      // amt > 0 ฝาก · amt < 0 ถอน · priv = คลังส่วนตัว
      if (!s.ok || !role) return { err: 'เฉพาะสมาชิกบ้าน' };
      const a = Math.trunc(+op.amt); if (!a) return { err: 'จำนวนไม่ถูกต้อง' };
      if (op.priv) {
        const pv = { ...(s.pv || {}) }, cur = pv[by] || 0;
        if (a > 0 && cur + a > L.pv) return { err: `คลังส่วนตัวเต็ม (สูงสุด ${L.pv} ที่ระดับบ้าน ${s.lv || 1})` };
        if (a < 0 && cur < -a) return { err: 'เงินในคลังส่วนตัวไม่พอ' };
        pv[by] = cur + a; if (!pv[by]) delete pv[by];
        return { patch: { pv }, give: a < 0 ? { jicoin: -a } : null, msg: a > 0 ? `🔐 ฝากเงินจิ ${a} เข้าคลังส่วนตัว` : `🔐 ถอนเงินจิ ${-a} จากคลังส่วนตัว` };
      }
      const cur = s.bank || 0;
      if (a > 0 && cur + a > L.bank) return { err: `คลังส่วนรวมเต็ม (สูงสุด ${L.bank} ที่ระดับบ้าน ${s.lv || 1})` };
      if (a < 0 && !boss) return { err: 'ถอนคลังส่วนรวมได้เฉพาะเจ้าบ้าน/รองเจ้าบ้าน' };
      if (a < 0 && cur < -a) return { err: 'เงินในคลังส่วนรวมไม่พอ' };
      return { patch: { bank: cur + a }, give: a < 0 ? { jicoin: -a } : null, msg: a > 0 ? `🏦 ฝากเงินจิ ${a} เข้าคลังส่วนรวม` : `🏦 ถอนเงินจิ ${-a} จากคลังส่วนรวม` };
    }
    case 'pitem': {
      if (!s.ok || !role) return { err: 'เฉพาะสมาชิกบ้าน' };
      const pi = { ...(s.pi || {}) }, mine = { ...(pi[by] || {}) }, q = op.qty | 0;
      if (!q) return { err: 'จำนวนไม่ถูกต้อง' };
      if (q > 0 && !mine[op.item] && Object.keys(mine).length >= L.ps) return { err: `คลังของส่วนตัวเต็ม (${L.ps} ช่อง)` };
      if (q < 0 && (mine[op.item] || 0) < -q) return { err: 'ของไม่พอ' };
      mine[op.item] = (mine[op.item] || 0) + q; if (!mine[op.item]) delete mine[op.item];
      pi[by] = mine;
      return { patch: { pi }, give: q < 0 ? { [op.item]: -q } : null };
    }
    case 'member': {
      if (!s.ok) return { err: 'ประกาศฐานก่อน' };
      if (!boss) return { err: 'จัดการสมาชิกได้เฉพาะเจ้าบ้าน/รองเจ้าบ้าน' };
      const id = String(op.id || ''), mem = { ...(s.mem || {}) };
      if (!id || id === s.owner) return { err: 'เปลี่ยนหน้าที่เจ้าบ้านไม่ได้' };
      if (role === 'deputy' && (op.role === 'deputy' || mem[id]?.r === 'deputy')) return { err: 'รองเจ้าบ้านแต่งตั้ง/ปลดรองเจ้าบ้านไม่ได้' };
      if (!op.role) { delete mem[id]; return { patch: { mem }, msg: '👋 นำสมาชิกออกจากบ้านแล้ว' }; }
      if (!ROLES[op.role] || op.role === 'owner') return { err: 'หน้าที่ไม่ถูกต้อง' };
      if (!mem[id] && Object.keys(mem).length + 1 >= HOUSE_MAX) return { err: `บ้านหนึ่งหลังมีสมาชิกได้ไม่เกิน ${HOUSE_MAX} คน` };
      mem[id] = { n: String(op.name || mem[id]?.n || 'ผู้เล่น').slice(0, 20), r: op.role };
      return { patch: { mem }, msg: `🏠 ตั้ง ${mem[id].n} เป็น${ROLES[op.role]}` };
    }
    case 'leave': {
      if (role === 'owner' || !role) return { err: 'ทำไม่ได้' };
      const mem = { ...(s.mem || {}) }; delete mem[by];
      return { patch: { mem }, msg: '🚪 ออกจากบ้านแล้ว' };
    }
  }
  return null;
}
// รั้วล้อมครบทุกด้านไหม: ไล่จุดตามขอบกรอบรั้วทุก G/2 แล้วต้องมีรั้ว/ประตูรั้วอยู่ใกล้ทุกจุด
export function fenceClosed(structs, b) {
  if (!b?.box) return false;
  const f = structs.filter((o) => (o.type === 'fence' || o.type === 'gate') && inBox(b.box, o.x, o.z, G));
  const near = (x, z) => f.some((o) => Math.abs(o.x - x) <= G * 0.6 && Math.abs(o.z - z) <= G * 0.6);
  const [x0, z0, x1, z1] = b.box, st = G / 2;
  for (let x = x0; x <= x1 + 0.01; x += st) if (!near(x, z0) || !near(x, z1)) return false;
  for (let z = z0; z <= z1 + 0.01; z += st) if (!near(x0, z) || !near(x1, z)) return false;
  return true;
}
// ฐานที่ยังอยู่ในช่วงป้องกัน ณ จุด x,z (pad = ขยายขอบ)
export const safeBaseAt = (bases, x, z, now, pad = 0) => bases.find((b) => protectLeft(b, now) > 0 && inBox(b.box, x, z, pad));
