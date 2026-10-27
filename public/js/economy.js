// ระบบเศรษฐกิจ: กฎทุกอย่างที่ทำให้ "ได้" หรือ "เสีย" ไอเท็มและประสบการณ์
// - โหมดเซิร์ฟเวอร์สาธารณะ: รันบนเซิร์ฟเวอร์เท่านั้น ผู้เล่นส่งได้แค่ "คำขอ" (กันโกง)
// - เล่นคนเดียว / ลิงก์ claude.ai: รันชุดเดียวกันในเบราว์เซอร์
// ไม่พึ่ง three.js — env ให้ข้อมูลโลก (ตำแหน่ง กล่องเสบียง ทรัพยากร สิ่งก่อสร้าง น้ำ ฝน)
import { rollVariants, baseOf, WILD, WILD_PET_MAX, SHOPS, DAY_MS, petCap, ITEMS, RECIPES, LOOT_TABLE, PET_TYPES, NPCS, QUEST_SPOTS, BASE_SLOTS, skillLevel, wearStats, ELECTRIC, JOBS, jobOf, hasPerk, buildCost, extraSlots, canBuild, PERK_PTS, START_PTS, freePts, jobPts, xpMulOf, pickAmmo, TOWNS } from './data.js';
import { RES_TYPES } from './resources-core.js';
import { PIECES, FEEDS, CROPS, PENS, coinCost, COLOR_COST, refundFor, cageCatch, needsBase, baseAt, roleIn, roleAllows, baseCheck, HOUSE_UP, REPAIR_BASE } from './building-core.js';
import { rollPet, petStats } from './pets.js';
import { ZTIERS, rollBoss } from './zombies-core.js';
import { QUEST_BOXES, qboxLock, charLevelOf, rareBoxAt, rollRare } from './boxes-core.js';

export const LOOT_RESPAWN = 15 * 60000;
const RAW = { stone: 'pebble', fiber: 'raw_fiber', wood: 'twig' };
const FISH = {
  sea: [['raw_fish', 50], ['crab', 16], ['squid', 12], ['big_fish', 10], ['bottle', 4], ['scrap', 4], ['cloth', 3], ['golden_fish', 1]],
  fresh: [['raw_fish', 58], ['prawn', 16], ['big_fish', 10], ['seeds_veg', 4], ['bottle', 5], ['golden_fish', 2]],
  pond: [['raw_fish', 80], ['prawn', 10], ['big_fish', 8], ['golden_fish', 2]],
};
export const DROPS = {
  zombie: [['rag', 0.75], ['rag', 0.4], ['zipper', 0.22], ['kevlar', 0.05], ['cloth', 0.25], ['scrap', 0.25], ['bandage', 0.08], ['bottle', 0.1], ['copper_wire', 0.08], ['spark_plug', 0.04], ['moto_wheel', 0.02]],
  boar: [['raw_meat', 1], ['raw_meat', 1], ['raw_meat', 0.6], ['hide', 0.8]],
  deer: [['raw_meat', 1], ['raw_meat', 1], ['hide', 1], ['hide', 0.4]],
  chicken: [['raw_meat', 1], ['egg', 0.4]],
  raptor: [['raw_meat', 1], ['raw_meat', 1], ['hide', 0.8], ['dino_bone', 0.6]],
  tiger: [['raw_meat', 1], ['raw_meat', 1], ['hide', 1], ['hide', 1]],
  trike: [['raw_meat', 1], ['raw_meat', 1], ['raw_meat', 1], ['hide', 1], ['hide', 1], ['dino_bone', 1], ['dino_bone', 0.5]],
};
const PET_GIFT = { egg: [180, ['egg']], forager: [120, ['herb', 'berry', 'fiber', 'wood']], fisher: [150, ['raw_fish']], thief: [150, ['scrap', 'cloth']], meat: [180, ['raw_meat']] };
const QS = QUEST_SPOTS;

// ---------- ช่วยเหลือ ----------
const has = (ch, k, q = 1) => (ch.inv[k] || 0) >= q;
const lvl = (ch, s) => skillLevel(ch.skills[s]);
const pick = (rand, a) => a[Math.floor(rand() * a.length)];
function roll(table, rand, boost = null) {
  const total = table.reduce((s, [k, w]) => s + w * (boost && k !== 'raw_fish' ? boost : 1), 0);
  let r = rand() * total;
  for (const [k, w] of table) { r -= w * (boost && k !== 'raw_fish' ? boost : 1); if (r <= 0) return k; }
  return table[0][0];
}
// ---------- ภารกิจสุ่ม (รับได้ทีละ 1 · หมดเวลา 30 นาที) ----------
export const SQ_LIFE = 30 * 60000;
const SQ_GATHER = ['wood', 'stone', 'fiber', 'herb', 'raw_fish', 'corn', 'veg', 'coconut', 'orange', 'scrap', 'cloth', 'pineapple', 'egg'];
const SQ_CRAFT = ['bandage', 'arrow', 'campfire', 'cooked_meat', 'clean_water', 'spear', 'grilled_fish', 'herbal_med'];
export function sqText(q) {
  if (!q) return '';
  if (q.type === 'kill') return `กำจัดผู้ติดเชื้อ ${q.n} ตัว`;
  if (q.type === 'gather') return `เก็บ ${ITEMS[q.k].icon} ${ITEMS[q.k].name} ${q.n} ชิ้น มาส่ง`;
  if (q.type === 'craft') return `ประดิษฐ์ ${ITEMS[q.k].icon} ${ITEMS[q.k].name} ${q.n} ชิ้น มาส่ง`;
  if (q.type === 'visit') return `เดินทางไปสำรวจ ${q.name}`;
  return '';
}
export function sqProgress(ch, q, pos) {
  if (!q) return [0, 1];
  if (q.type === 'kill') return [Math.min(q.n, (ch.stats?.kills || 0) - q.k0), q.n];
  if (q.type === 'gather' || q.type === 'craft') return [Math.min(q.n, ch.inv[q.k] || 0), q.n];
  if (q.type === 'visit') return [pos && Math.hypot(pos.x - q.x, pos.z - q.z) < 25 ? 1 : 0, 1];
  return [0, 1];
}
export function salvageOf(k) {
  const it = ITEMS[k], b = baseOf(k); if (!it || it.quest || it.coin || it.food || it.med || it.flower || b.startsWith('seeds_')) return null;
  const r = RECIPES.find((x) => x.out === b);
  if (r) { const g = {}; for (const [i, n] of Object.entries(r.need)) { if (ITEMS[i]?.coin) continue; const v = Math.floor(n / 2); if (v) g[i] = v; } if (!Object.keys(g).length) { const [i] = Object.keys(r.need); if (i && !ITEMS[i].coin) g[i] = 1; } return Object.keys(g).length ? g : null; }
  if (it.wear) return it.wear.slot === 'off' ? { wood: 1, scrap: 1 } : { rag: 1, cloth: 1 };
  if (it.tool) return { scrap: 1, wood: 1 };
  if (it.petGear) return { rag: 1, scrap: 1 };
  return null;
}
export function rollLoot(rand) {
  const total = LOOT_TABLE.reduce((s, [, w]) => s + w, 0), out = {};
  const n = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) { let r = rand() * total; for (const [item, w] of LOOT_TABLE) { r -= w; if (r <= 0) { out[item] = (out[item] || 0) + (item === 'jicoin' ? 3 + Math.floor(rand() * 10) : 1); break; } } }
  return out;
}
// ราคาในร้าน NPC และมูลค่าของที่เอามาแลก
// ซ่อม/ประกอบรถร้างในแผนที่: รถน้ำมัน หรือ รถไฟฟ้า EV (ช่างยนต์ไม่ต้องใช้ล้อครบ 4 — ใช้ล้อเดิมได้ 2 ล้อ)
export const REPAIR_COST = {
  gas: { wheel: 4, engine: 1, steering_wheel: 1, battery_pack: 1, spark_plug: 1, fuel: 2 },
  ev: { wheel: 4, ev_motor: 1, steering_wheel: 1, ev_battery: 1 },
};
export const repairCost = (ch, ev) => { const c = { ...REPAIR_COST[ev ? 'ev' : 'gas'] }; if (hasPerk(ch, 'mechanic', 0)) c.wheel = 2; return c; };
export const shopPrice = (base, pts) => Math.ceil(base * (1 - Math.min(0.25, Math.max(0, pts) / 1000)));
export const tradeValue = (k) => (k === 'jicoin' ? 1 : (ITEMS[k]?.value || 0) * 0.8);
// เงินจิ (Ji-Coin): ได้จากการฆ่ามอนสเตอร์ ภารกิจหลัก กล่อง แผงขายของ และขายของให้ NPC
export const SELL_RATE = 0.5, SELL_DAY_CAP = 150;
export const deathCoinRate = (n) => (n <= 3 ? 0 : n <= 10 ? 0.1 : 0.2);
export const sellPrice = (k) => Math.max(1, Math.floor((ITEMS[k]?.value || 0) * SELL_RATE));
const QUEST_COINS = [0, 15, 20, 30, 40, 40, 120];
const ZCOIN = { walker: [1, 3], runner: [2, 4], toxic: [3, 6], brute: [6, 12], boss: [80, 150] };
const WCOIN = { boar: [1, 3], raptor: [5, 10], tiger: [6, 12], trike: [8, 14] };
const coinRoll = (rand, [a, b]) => a + Math.floor(rand() * (b - a + 1));
export function rollDrops(kind, rand) {
  const out = {};
  for (const [k, ch] of DROPS[kind] || []) if (rand() < ch) out[k] = (out[k] || 0) + 1;
  return out;
}
const dist = (env, ch, x, z) => { const p = env.pos(ch); return Math.hypot(p.x - x, p.z - z); };
const cool = (ch, key, secs, now) => { ch.t ||= {}; if (now - (ch.t[key] || 0) < secs * 1000) return false; ch.t[key] = now; return true; };
const lucky = (ch) => (ch.pets || []).some((p) => !p.home && !p.stay && p.traits?.includes('lucky'));

export function newChar(profile) {
  return {
    v: 1, profile, inv: { bottle: 1, canned: 1 }, wear: {}, skills: {}, pets: [], quest: { step: 0 },
    equipped: null, hotbar: ['canned', 'bottle', null, null, null, null],
    stats: { hp: 100, hunger: 80, thirst: 80, stamina: 100, infection: 0, bleeding: false, fracture: false, sick: 0, kills: 0, survived: 0 },
    pos: null, spawn: null, social: null, t: {}, boxes: {}, jobKit: null,
  };
}

// ---------- การกระทำ ----------
// แต่ละตัวคืน { err, silent, give, take, xp, fx, msg, res, loot, pet, quest, place, kills }
const A = {
  loot(ch, p, env) {
    const L = env.loot(p.id); if (!L) return { err: 'ไม่พบกล่องนี้' };
    if (dist(env, ch, L.x, L.z) > 4.5) return { err: 'อยู่ไกลเกินไป' };
    if (L.until > env.now()) return { err: 'ค้นไปแล้ว รอของใหม่อีกสักพัก', silent: true };
    if (L.kind === 'bike') {
      // จักรยานข้างถนน: ขี่ได้เลย หรือซ่อมก่อน (เศษเหล็ก 2 + ผ้าขี้ริ้ว 1) · หายไป 2 ชั่วโมงแล้วจะมีคันใหม่
      const fix = { scrap: 2, rag: 1 };
      if (L.broken) { for (const [k, q] of Object.entries(fix)) if (!has(ch, k, q)) return { err: '🚲 จักรยานคันนี้พัง ต้องซ่อม: 🔩 เศษเหล็ก 2 + 🧻 ผ้าขี้ริ้ว 1' }; }
      return { take: L.broken ? fix : null, give: { bicycle: 1 }, xp: { crafting: L.broken ? 8 : 0, survival: 3 }, loot: { id: p.id, until: env.now() + 2 * 3600000 }, msg: L.broken ? '🔧 ซ่อมจักรยานเสร็จ! ได้ 🚲 จักรยาน (วางจากกระเป๋าเพื่อขี่)' : '🚲 ได้จักรยาน! วางจากกระเป๋าเพื่อขี่', sfx: 'craft' };
    }
    const give = rollLoot(env.rand);
    if (L.kind === 'car') { delete give.canned; give.scrap = (give.scrap || 0) + 1; for (const [k, c] of [['wheel', 0.3], ['moto_wheel', 0.2], ['steering_wheel', 0.15], ['spark_plug', 0.25], ['copper_wire', 0.35], ['car_seat', 0.15], ['battery_pack', 0.12], ['engine', 0.04], ['moto_engine', 0.05]]) if (env.rand() < c) give[k] = (give[k] || 0) + 1; } // ถอดชิ้นส่วนจากรถร้าง
    if (lucky(ch) && env.rand() < 0.3) { const ex = Object.keys(rollLoot(env.rand))[0]; give[ex] = (give[ex] || 0) + 1; }
    const r = { give: rollVariants(give, env.rand), xp: { survival: 3 }, loot: { id: p.id, until: env.now() + LOOT_RESPAWN } };
    if (L.kind === 'car' && ch.quest?.step === 2) { r.give.car_battery = 1; r.quest = 3; r.questMsg = 'battery'; }
    return r;
  },

  // ซ่อมรถร้างข้างถนนให้กลายเป็นรถกระบะที่ขับได้ (รถคันนั้นหายไปจากถนนหนึ่งสัปดาห์)
  repaircar(ch, p, env) {
    const L = env.loot(p.id); if (!L || L.kind !== 'car') return { err: 'ไม่พบรถคันนี้' };
    if (dist(env, ch, L.x, L.z) > 5) return { err: 'อยู่ไกลเกินไป' };
    if (L.until > env.now() + 864e5) return { err: 'รถคันนี้ถูกซ่อมไปแล้ว' };
    const ev = !!p.ev, cost = repairCost(ch, ev);
    for (const [k, q] of Object.entries(cost)) if (!has(ch, k, q)) return { err: `ซ่อมรถต้องใช้ ${Object.entries(cost).map(([a, b]) => `${ITEMS[a].name} ${b}`).join(' + ')}` };
    if (lvl(ch, 'crafting') < 2 && !hasPerk(ch, 'mechanic', 0) && !hasPerk(ch, 'electrician', 0)) return { err: 'ต้องมีทักษะประดิษฐ์ Lv2 (หรือสเตตัสสายช่างยนต์/ช่างไฟฟ้า) จึงซ่อมรถได้' };
    return { take: cost, place: { type: 'vehicle', vt: ev ? 'ev_car' : 'pickup', x: +L.x.toFixed(2), z: +L.z.toFixed(2), ry: 0, fuel: ev ? 60 : 40 }, loot: { id: p.id, until: env.now() + 7 * 864e5 }, xp: { crafting: 30, electric: ev ? 20 : 0 }, msg: ev ? '⚡ ประกอบรถ EV สำเร็จ! ชาร์จไฟได้ที่แผงโซล่าเซลล์' : '🔧 ซ่อมรถร้างสำเร็จ! กลายเป็นรถกระบะน้ำมัน ขับได้เลย', sfx: 'craft' };
  },
  // ทอดแห: ถือแหแล้วโยนลงน้ำ ได้ปลาหลายตัวในครั้งเดียว
  castnet(ch, p, env) {
    const net = ch.equipped && has(ch, ch.equipped) && ITEMS[ch.equipped].tool?.net; if (!net) return { err: 'ต้องถือแหทอดปลา' };
    const kind = env.fishKind(+p.x, +p.z); if (!kind || dist(env, ch, +p.x, +p.z) > 7) return { err: '🕸️ ต้องทอดแหลงน้ำ (หันหน้าไปทางทะเล/อ่างเก็บน้ำ)' };
    if (!cool(ch, 'castnet', 8, env.now())) return { err: 'กำลังเก็บแห... รอสักครู่', silent: true };
    const give = {}, n = 1 + Math.floor(env.rand() * (hasPerk(ch, 'fisher', 0) ? 4 : 3));
    for (let i = 0; i < n; i++) { const it = roll(FISH[kind] || FISH.fresh, env.rand); give[it] = (give[it] || 0) + 1; }
    const broke = env.rand() < 0.08;
    return { give, take: broke ? { [ch.equipped]: 1 } : null, xp: { fishing: 4 + n * 2 }, msg: `🕸️ ทอดแหได้ปลา ${n} ตัว${broke ? ' — แหขาดแล้ว!' : ''}`, fish: Object.keys(give)[0] };
  },
  // ลงแต้มสเตตัสสายอาชีพ (+1 ต่อครั้ง)
  statup(ch, p) {
    if (!JOBS[p.job] || JOBS[p.job].free) return { err: 'ไม่รู้จักสายอาชีพนี้' };
    if (freePts(ch) <= 0) return { err: 'ไม่มีแต้มสเตตัสเหลือ (ได้เพิ่ม 1 แต้มทุกครั้งที่เลเวลตัวละครขึ้น)' };
    ch.jp = { ...jobPts(ch) }; ch.jp[p.job] = (ch.jp[p.job] || 0) + 1;
    const n = ch.jp[p.job], tier = PERK_PTS.indexOf(n);
    return { statup: true, msg: tier >= 0 ? `✨ ปลดล็อกความสามารถสาย${JOBS[p.job].name} ขั้นที่ ${tier + 1}: ${JOBS[p.job].perks[tier][1]}` : `+1 สเตตัสสาย${JOBS[p.job].icon} ${JOBS[p.job].name} (${n})` };
  },
  // แลกของกับ NPC: จ่ายด้วยของในกระเป๋า (คิดมูลค่า 80%) · สนิทกันได้ส่วนลด · จำกัดจำนวนต่อวัน
  npctrade(ch, p, env) {
    const n = NPCS.find((x) => x.id === p.npc); if (!n) return { err: 'ไม่พบผู้ค้า' };
    const row = (SHOPS[n.job] || []).find(([k]) => k === p.buy); if (!row) return { err: `${n.name}ไม่มีของนี้ให้แลก` };
    const pos = env.npcPos?.(n.id); if (!pos || dist(env, ch, pos.x, pos.z) > 7) return { err: `ต้องอยู่ใกล้${n.name}` };
    const day = Math.floor(env.now() / DAY_MS), key = n.id + ':' + row[0], T = (ch.trade ||= {})[key], used = T && T.d === day ? T.n : 0;
    if (used >= row[2]) return { err: `วันนี้${n.name}ไม่มี${ITEMS[row[0]].name}เหลือแล้ว พรุ่งนี้มาใหม่นะ` };
    const price = shopPrice(row[1], ch.social?.rels?.[n.id]?.pts || 0);
    let paid = 0; const take = {};
    if (ITEMS[row[0]].coinOnly && Object.keys(p.pay || {}).some((k) => k !== 'jicoin')) return { err: `${ITEMS[row[0]].name} ซื้อได้ด้วยเงินจิเท่านั้น` };
    for (const [k, q] of Object.entries(p.pay || {})) {
      const qq = Math.floor(+q); if (!(qq > 0)) continue;
      if (!ITEMS[k] || ITEMS[k].quest || !has(ch, k, qq)) return { err: 'ของที่จะใช้แลกไม่พอ' };
      take[k] = qq; paid += tradeValue(k) * qq;
    }
    if (paid + 1e-6 < price) return { err: `ของที่เอามาแลกมีมูลค่า ${Math.floor(paid)} ยังไม่ถึง ${price}` };
    ch.trade[key] = { d: day, n: used + 1 };
    return { take, give: { [row[0]]: 1 }, xp: { survival: 2 }, msg: `🤝 แลก ${ITEMS[row[0]].icon} ${ITEMS[row[0]].name} กับ${n.name}สำเร็จ`, traded: true };
  },

  sqnew(ch, p, env) {
    if (ch.sq && ch.sq.exp > env.now()) return { err: 'ทำภารกิจสุ่มที่รับไว้ให้เสร็จก่อน (หรือยกเลิก)' };
    const r = env.rand, kind = ['kill', 'gather', 'craft', 'visit'][Math.floor(r() * 4)], lv = charLevelOf(ch.skills);
    let q;
    if (kind === 'kill') { const n = 5 + Math.floor(r() * (6 + lv)); q = { type: 'kill', n, k0: ch.stats?.kills || 0, coin: n * 3 + 10 }; }
    else if (kind === 'gather') { const k = SQ_GATHER[Math.floor(r() * SQ_GATHER.length)], n = 3 + Math.floor(r() * 8); q = { type: 'gather', k, n, coin: Math.ceil((ITEMS[k].value || 1) * n * 1.5) + 10 }; }
    else if (kind === 'craft') { const k = SQ_CRAFT[Math.floor(r() * SQ_CRAFT.length)], n = 1 + Math.floor(r() * 3); q = { type: 'craft', k, n, coin: Math.ceil((ITEMS[k].value || 2) * n * 2) + 15 }; }
    else { const P = env.pos(ch), far = TOWNS.filter((t) => Math.hypot(t.x - P.x, t.z - P.z) > 80), t = (far.length ? far : TOWNS)[Math.floor(r() * (far.length || TOWNS.length))]; q = { type: 'visit', x: t.x, z: t.z, name: t.name, coin: 30 + Math.floor(Math.hypot(t.x - P.x, t.z - P.z) / 12) }; }
    q.exp = env.now() + SQ_LIFE; q.xp = 15 + lv * 3;
    ch.sq = q;
    return { msg: `🎲 รับภารกิจสุ่ม: ${sqText(q)} — รางวัล 🪙 ${q.coin} (ภายใน 30 นาที)`, sq: q, sfx: 'quest' };
  },
  sqdone(ch, p, env) {
    const q = ch.sq; if (!q) return { err: 'ยังไม่ได้รับภารกิจสุ่ม' };
    if (q.exp < env.now()) { ch.sq = null; return { err: '⌛ ภารกิจหมดเวลาแล้ว รับใหม่ได้เลย', sq: null }; }
    const [a, b] = sqProgress(ch, q, env.pos(ch)); if (a < b) return { err: `ยังไม่เสร็จ (${a}/${b})` };
    const take = q.type === 'gather' || q.type === 'craft' ? { [q.k]: q.n } : null;
    ch.sq = null; (ch.boxes ||= {}).sqn = (ch.boxes.sqn || 0) + 1;
    return { take, give: { jicoin: q.coin }, xp: { survival: q.xp }, msg: `✅ ภารกิจสุ่มสำเร็จ! ได้ 🪙 ${q.coin} เงินจิ (สำเร็จแล้ว ${ch.boxes.sqn} ภารกิจ)`, sq: null, sfx: 'level' };
  },
  sqdrop(ch) { if (!ch.sq) return { err: 'ไม่มีภารกิจ' }; ch.sq = null; return { msg: 'ยกเลิกภารกิจสุ่มแล้ว', sq: null }; },

  // ขายของให้ NPC รับเงินจิ (ราคาครึ่งหนึ่งของมูลค่า · NPC แต่ละคนรับซื้อได้วันละไม่เกิน SELL_DAY_CAP)
  npcsell(ch, p, env) {
    const n = NPCS.find((x) => x.id === p.npc); if (!n) return { err: 'ไม่พบผู้ค้า' };
    const pos = env.npcPos?.(n.id); if (!pos || dist(env, ch, pos.x, pos.z) > 7) return { err: `ต้องอยู่ใกล้${n.name}` };
    const k = p.k, q = Math.floor(+p.q) || 1;
    if (!ITEMS[k] || ITEMS[k].quest || k === 'jicoin' || !(q > 0) || !has(ch, k, q)) return { err: 'ของไม่พอ' };
    if (ch.equipped === k && (ch.inv[k] || 0) <= q) return { err: 'เลิกถือของชิ้นนี้ก่อนขาย' };
    const day = Math.floor(env.now() / DAY_MS), key = 'sell:' + n.id, T = (ch.trade ||= {})[key], used = T && T.d === day ? T.n : 0;
    const pay = sellPrice(k) * q;
    if (used + pay > SELL_DAY_CAP) return { err: `วันนี้${n.name}รับซื้อได้อีกแค่ 🪙 ${Math.max(0, SELL_DAY_CAP - used)} เงินจิ` };
    ch.trade[key] = { d: day, n: used + pay };
    return { take: { [k]: q }, give: { jicoin: pay }, msg: `🪙 ขาย ${ITEMS[k].icon} ${ITEMS[k].name} ×${q} ให้${n.name} ได้ ${pay} เงินจิ`, traded: true };
  },

  // กล่องภารกิจ: ต้องผ่านเงื่อนไขก่อน เปิดได้คนละครั้ง
  qbox(ch, p, env) {
    const b = QUEST_BOXES.find((x) => x.id === p.id); if (!b) return { err: 'ไม่พบกล่องนี้' };
    const B = ch.boxes ||= {};
    if (B[b.id]) return { err: 'คุณเปิดกล่องนี้ไปแล้ว' };
    if (dist(env, ch, b.x, b.z) > 4.5) return { err: 'อยู่ไกลเกินไป' };
    const lock = qboxLock(b, ch, charLevelOf(ch.skills)); if (lock) return { err: '🔒 ' + lock };
    B[b.id] = 1;
    return { give: { ...b.give, jicoin: 25 + QUEST_BOXES.indexOf(b) * 10 }, xp: { survival: 25 }, msg: `📦 เปิด${b.name}สำเร็จ! (+🪙 เงินจิ)`, boxOpen: b.id };
  },
  // กล่องหายาก: เกิดนาน ๆ ครั้ง ตำแหน่งสุ่ม ทุกคนเปิดได้คนละครั้งก่อนมันหายไป
  rare(ch, p, env) {
    const R = rareBoxAt(env.now()); if (!R || R.id !== p.id) return { err: 'กล่องหายากหายไปแล้ว...' };
    const B = ch.boxes ||= {};
    if (B[R.id]) return { err: 'คุณเปิดกล่องนี้ไปแล้ว' };
    if (dist(env, ch, R.x, R.z) > 4.5) return { err: 'อยู่ไกลเกินไป' };
    for (const k of Object.keys(B)) if (k[0] === 'R') delete B[k]; // เก็บแค่กล่องล่าสุด
    B[R.id] = 1;
    const give = rollRare(env.rand); give.jicoin = 40 + Math.floor(env.rand() * 61); if (lucky(ch)) { const ex = Object.keys(rollRare(env.rand))[0]; if (ex) give[ex] = (give[ex] || 0) + 1; }
    return { give: rollVariants(give, env.rand, 0.5), xp: { survival: 50 }, msg: '✨ เปิดกล่องหายาก! ได้ของล้ำค่า', boxOpen: R.id };
  },

  // ตี/ตัด/ทุบ ทรัพยากร (ใช้ทั้งคลิกและกด E เก็บพืชเล็ก)
  hit(ch, p, env) {
    const R = env.res(p.id); if (!R) return { err: 'ไม่พบ' };
    if (dist(env, ch, R.x, R.z) > 4.5) return { err: 'อยู่ไกลเกินไป', silent: true };
    if (!cool(ch, 'hit', 0.3, env.now())) return { silent: true, err: 'เร็วเกินไป' };
    if (env.resUntil(p.id) > env.now()) return { silent: true, err: 'หมดแล้ว' };
    const T = RES_TYPES[R.type];
    // ก้อนหินใหญ่: ต้องใช้ค้อนหิน (หรือเครื่องมือที่ทุบหินได้)
    if (R.type === 'rock' && !(ch.equipped && has(ch, ch.equipped) && ITEMS[ch.equipped].tool?.mine)) {
      const t = (ch.t ||= {}), quiet = env.now() - (t.rockWarn || 0) < 4000; t.rockWarn = env.now();
      return { err: '🪨 ก้อนหินใหญ่ต้องถือค้อนหินพื้นฐาน (ไม้ 2 + หิน 3 + เส้นใย 2) — ก้อนกรวดเล็ก ๆ เก็บด้วยมือได้', silent: quiet };
    }
    const tool = !p.hand && ch.equipped && has(ch, ch.equipped) && ITEMS[ch.equipped].tool;
    const power = (tool ? tool.gather * (hasPerk(ch, 'engineer', 1) ? 1.3 : 1) : (R.type === 'rock' ? 0.5 : 1) + wearStats(ch.wear).gather);
    const hp = (env.resHp(p.id) ?? T.hp) - power;
    if (hp > 0) { env.setResHp(p.id, hp); return { res: { id: p.id, hp } }; }
    env.setResHp(p.id, null);
    const give = {}, bonus = 1 + (lvl(ch, 'gathering') - 1) * 0.1;
    for (const [k, a, b] of T.drops) {
      const q = Math.floor((a + env.rand() * (b - a + 1)) * (env.rand() < bonus - 1 ? 2 : 1));
      if (q > 0) { const kk = !tool && RAW[k] ? RAW[k] : k; give[kk] = (give[kk] || 0) + q; }
    }
    if (R.type === 'rock' && env.rand() < 0.15) give.scrap = (give.scrap || 0) + 1;
    if (R.type === 'grass' && env.rand() < 0.12) give.seeds_veg = (give.seeds_veg || 0) + 1;
    return { give, xp: { gathering: R.type === 'tree' || R.type === 'rock' || R.type === 'orange_tree' || R.type === 'palm' ? 6 : 2 }, res: { id: p.id, until: env.now() + T.respawn * 60000 }, raw: !tool && T.drops.some(([k]) => RAW[k]) };
  },

  craft(ch, p, env) {
    const r = RECIPES[p.i]; if (!r) return { err: 'ไม่มีสูตรนี้' };
    if (r.job && !hasPerk(ch, r.job, 0)) return { err: `สูตรนี้ต้องมีสเตตัสสาย${JOBS[r.job].name}อย่างน้อย ${PERK_PTS[0]}` };
    if (lvl(ch, r.skill) < r.lvl) return { err: 'ทักษะยังไม่ถึง' };
    if (r.station === 'fire' && !env.near('campfire', env.pos(ch), 4.5)) return { err: 'ต้องอยู่ใกล้กองไฟ' };
    for (const [k, q] of Object.entries(r.need)) if (!has(ch, k, q)) return { err: 'วัตถุดิบไม่พอ' };
    const take = { ...r.need }, give = rollVariants({ [r.out]: (r.qty || 1) + (r.skill === 'cooking' && ITEMS[r.out].food && hasPerk(ch, 'chef', 1) ? 1 : 0) }, env.rand, Math.min(0.3, (lvl(ch, r.skill) - r.lvl) * 0.03));
    for (const [k, q] of Object.entries(r.need)) if (ITEMS[k].returns && !r.keepBottle) give[ITEMS[k].returns] = (give[ITEMS[k].returns] || 0) + q;
    if (hasPerk(ch, 'engineer', 2) && env.rand() < 0.25) return { give, xp: { [r.skill]: 8 + r.lvl * 4 }, sfx: 'craft', msg: '🔧 ฝีมือช่าง! ไม่เสียวัตถุดิบเลย' };
    return { take, give, xp: { [r.skill]: 8 + r.lvl * 4 }, sfx: 'craft' };
  },

  use(ch, p, env) {
    const it = ITEMS[p.k]; if (!it || !has(ch, p.k)) return { err: 'ไม่มีของชิ้นนี้' };
    if (it.food) return { take: { [p.k]: 1 }, give: it.returns ? { [it.returns]: 1 } : null, fx: { food: it.food, item: p.k }, quietGive: true };
    if (it.med) return { take: { [p.k]: 1 }, fx: { med: it.med, item: p.k }, xp: { medicine: 6 } };
    if (it.chant) { if (!cool(ch, 'chant', 30, env.now())) return { err: '🙏 สวดมนต์ได้ทุก 30 วินาที' }; return { fx: { chant: true, item: p.k }, xp: { spirit: 12 } }; }
    if (it.device?.scout) { if (!cool(ch, 'drone', 90, env.now())) return { err: '🛸 โดรนกำลังชาร์จแบต (ใช้ได้ทุก 90 วินาที)' }; return { fx: { drone: true, item: p.k }, xp: { tech: 10 } }; }
    if (it.respec) { const used = Object.values(jobPts(ch)).reduce((a, b) => a + b, 0); if (!used) return { err: 'ยังไม่ได้ลงแต้มสเตตัสเลย' }; ch.jp = {}; return { take: { [p.k]: 1 }, statup: true, msg: `🔄 ล้างแต้มสเตตัสแล้ว ได้คืน ${used} แต้ม — เปิดหน้าตัวละคร (K) เพื่อลงแต้มใหม่` }; }
    if (it.instrument) { if (!cool(ch, 'music', 20, env.now())) return { err: '🎸 พักนิ้วก่อน (เล่นได้ทุก 20 วินาที)' }; return { fx: { music: true, item: p.k }, xp: { recreation: 10 } }; }
    return { err: 'ใช้ไม่ได้' };
  },
  hold(ch, p) {
    if (p.k && (!has(ch, p.k) || !ITEMS[p.k]?.tool)) return { err: 'ไม่มีเครื่องมือนี้' };
    ch.equipped = p.k || null; return { held: true };
  },
  // ยิงอาวุธระยะไกล: ใช้กระสุน 1 นัด (ชนิดที่เลือก หรือระดับดีสุดที่มี)
  shoot(ch, p) {
    const t = ITEMS[ch.equipped]?.tool; if (!t?.ranged) return { err: 'ต้องถืออาวุธยิงไกล', silent: true };
    const k = pickAmmo(ch.inv, t.ammo, p.ammo); if (!k) return { err: 'ไม่มีกระสุน' };
    return { take: { [k]: 1 }, quietTake: true, ammo: k, xp: { combat: 1 } };
  },
  hands(ch, p) { ch.lefty = !!p.lefty; return { held: true }; },
  equip(ch, p) {
    const w = ITEMS[p.k]?.wear; if (!w || !has(ch, p.k)) return { err: 'ไม่มีเสื้อผ้าชิ้นนี้' };
    const old = ch.wear[w.slot]; ch.wear[w.slot] = p.k;
    return { take: { [p.k]: 1 }, give: old ? { [old]: 1 } : null, quietGive: true, wore: true };
  },
  unequip(ch, p) {
    const k = ch.wear[p.slot]; if (!k) return { err: 'ช่องนี้ว่าง' };
    delete ch.wear[p.slot]; return { give: { [k]: 1 }, quietGive: true, wore: true };
  },
  // ย่อยไอเท็ม: ได้วัตถุดิบคืนประมาณครึ่งหนึ่งของสูตรประดิษฐ์ (ของที่ไม่มีสูตร: เสื้อผ้า → ผ้า, เครื่องมือ → เศษเหล็ก/ไม้)
  salvage(ch, p) {
    const k = p.k, it = ITEMS[k]; if (!it || !has(ch, k)) return { err: 'ไม่มีของชิ้นนี้' };
    const give = salvageOf(k); if (!give) return { err: `${it.name} ย่อยไม่ได้` };
    const r = RECIPES.find((x) => x.out === baseOf(k)), q = Math.max(1, r?.qty || 1);
    if (!has(ch, k, q)) return { err: `ต้องมีอย่างน้อย ${q} ชิ้นเพื่อย่อย` };
    if (ch.equipped === k && (ch.inv[k] || 0) <= q) ch.equipped = null;
    if (Object.values(ch.wear || {}).includes(k) && (ch.inv[k] || 0) <= q) return { err: 'ถอดออกก่อนย่อย' };
    return { take: { [k]: q }, give, xp: { crafting: 2 }, msg: `♻️ ย่อย ${it.icon} ${it.name}${q > 1 ? ` ×${q}` : ''} ได้ ${Object.entries(give).map(([i, n]) => `${ITEMS[i].icon}${ITEMS[i].name} ×${n}`).join(', ')}`, sfx: 'craft' };
  },
  drop(ch, p) {
    const q = Math.max(1, p.q | 0); if (!has(ch, p.k, q)) return { err: 'ของไม่พอ' };
    if (ITEMS[p.k]?.quest) return { err: 'ของภารกิจทิ้งไม่ได้' };
    return { take: { [p.k]: q }, msg: `ทิ้ง ${ITEMS[p.k].name} ×${q}` };
  },

  // วางสิ่งก่อสร้าง: ชิ้นส่วนบ้าน (ใช้วัสดุ + ค้อน) หรือไอเท็มที่วางได้ (กองไฟ เพิง ยานพาหนะ)
  place(ch, p, env) {
    const s = p.s || {}; if (typeof s.x !== 'number' || typeof s.z !== 'number') return { err: 'ตำแหน่งไม่ถูกต้อง' };
    if (dist(env, ch, s.x, s.z) > 9) return { err: 'วางไกลเกินไป' };
    const clean = { x: +s.x.toFixed(2), z: +s.z.toFixed(2), y: typeof s.y === 'number' ? +s.y.toFixed(2) : undefined, rot: (s.rot | 0) & 3, ry: +(+s.ry || 0).toFixed(2), drop: s.drop };
    // คอก/แปลง/กระถาง/กล่องผึ้ง ต้องอยู่ในรั้วของฐานที่เรามีหน้าที่
    const ptype = PIECES[s.type] ? s.type : ITEMS[p.item]?.place;
    if (ptype && needsBase(ptype) && env.structs) {
      const b = baseAt(env.structs(), s.x, s.z), role = roleIn(b, env.myId);
      if (!b) return { err: '🏡 ต้องสร้างภายในรั้วของฐาน (สร้างบ้าน + รั้ว แล้ววาง "หลักบ้าน" เพื่อประกาศฐานก่อน)' };
      if (!role || !roleAllows(role === 'resident' ? null : role, { type: ptype }, ptype === 'pot' || ptype.startsWith('plot_') ? 'plant' : 'breed')) return { err: '🔒 ต้องเป็นเจ้าบ้าน/รองเจ้าบ้าน หรือผู้ดูแลสัตว์/พืชของฐานนี้' };
    }
    if (s.type === 'basecore' && (env.ownCount?.('basecore') || 0) >= 1) return { err: 'มีหลักบ้านได้คนละ 1 หลัง' };
    // กันคนอื่นมาสร้างในฐาน/ติดบ้านของเรา: ต้องเป็นสมาชิกบ้านหรือเป็นเพื่อนกับเจ้าของก่อน
    if (env.structs && ptype && ptype !== 'vehicle') {
      const ST = env.structs(), me = env.myId, b = baseAt(ST, s.x, s.z);
      if (b && b.owner !== me && !roleIn(b, me) && !env.isFriend?.(b.owner)) return { err: `🔒 ที่นี่คือฐาน "${b.name}" ของผู้เล่นอื่น — ต้องเป็นเพื่อนหรือสมาชิกบ้านก่อนจึงจะสร้างได้` };
      const near = ST.find((o) => o.owner && o.owner !== me && PIECES[o.type] && o.type !== 'vehicle' && Math.hypot(o.x - s.x, o.z - s.z) < 6);
      if (near && !env.isFriend?.(near.owner) && !(b && roleIn(b, me))) return { err: '🔒 ติดกับบ้านของผู้เล่นอื่น — ต้องแอดเพื่อนกับเจ้าของก่อนจึงจะสร้างตรงนี้ได้' };
    }
    if (PIECES[s.type]) {
      const P = PIECES[s.type];
      if (P.hidden) return { err: 'สร้างชิ้นนี้ไม่ได้แล้ว' };
      if (!canBuild(ch.inv)) return { err: 'ต้องมีค้อน (ค้อนไม้ หรือ ค้อนช่างไม้)' };
      if (lvl(ch, 'building') < P.lvl) return { err: `ต้องมีทักษะก่อสร้าง Lv${P.lvl}` };
      const cost = s.coin || P.cost.jicoin ? { jicoin: coinCost(P, ITEMS) } : buildCost(ch, P.cost);
      for (const [k, q] of Object.entries(cost)) if (!has(ch, k, q)) return { err: s.coin ? `🪙 เงินจิไม่พอ (ต้องใช้ ${cost.jicoin})` : 'วัสดุไม่พอ' };
      const pl = { ...clean, type: s.type }; if (cost.jicoin) pl.paid = cost.jicoin;
      // คอกสัตว์ใหม่มีสัตว์เริ่มต้น (เล้าไก่ = แม่ไก่โตแล้ว · คอกอื่น = ลูกสัตว์)
      const PN = PENS[s.type]; if (PN) { const now = env.now(); pl.herd = Array.from({ length: PN.start }, () => ({ b: PN.startAdult ? now - PN.adult : now })); pl.wat = now + 5 * 60000; pl.lt = now; }
      return { take: cost, place: pl, xp: { building: 4 }, sfx: 'place' };
    }
    const it = ITEMS[p.item]; if (!it?.place || !has(ch, p.item)) return { err: 'ไม่มีของชิ้นนี้' };
    const st = { ...clean, type: it.place }; if (it.place !== 'pot') delete st.y;
    if (it.vt) { st.vt = it.vt; if (['motorbike', 'pickup', 'ev_car', 'ev_bike'].includes(it.vt)) st.fuel = 60; }
    return { take: { [p.item]: 1 }, place: st, xp: { survival: 5 }, sfx: 'place' };
  },

  // น้ำ: ตักน้ำจืดใส่ขวด / รองน้ำฝน / แทงปลาด้วยหอก
  fill(ch, p, env) {
    if (!has(ch, 'bottle')) return { err: 'ต้องมีขวดเปล่า' };
    if (p.kind === 'rain') { if (!env.raining()) return { err: 'ฝนไม่ได้ตก' }; return { take: { bottle: 1 }, give: { clean_water: 1 } }; }
    if (!env.freshNear(env.pos(ch))) return { err: 'ไม่มีน้ำจืดใกล้ ๆ' };
    return { take: { bottle: 1 }, give: { dirty_water: 1 }, msg: 'ได้น้ำดิบ — ต้มที่กองไฟก่อนดื่ม' };
  },
  spearfish(ch, p, env) {
    if (!ITEMS[ch.equipped]?.tool?.fish || !has(ch, ch.equipped)) return { err: 'ต้องถือหอก' };
    if (!env.waterNear(env.pos(ch))) return { err: 'ไม่มีน้ำ' };
    if (!cool(ch, 'spear', 0.9, env.now())) return { silent: true, err: 'เร็วไป' };
    if (env.rand() < 0.35 + lvl(ch, 'gathering') * 0.03) return { give: { raw_fish: 1 }, xp: { gathering: 4 } };
    return { msg: 'ปลาหนีไปได้...' };
  },

  // ตกปลาด้วยเบ็ด: เหวี่ยง → (รอ ≥ 2.5 วินาที) → ดึง
  fcast(ch, p, env) {
    if (!ITEMS[ch.equipped]?.tool?.rod || !has(ch, ch.equipped)) return { err: 'ต้องถือเบ็ด' };
    const kind = env.fishKind(p.x, p.z);
    if (!kind || dist(env, ch, p.x, p.z) > 8) return { err: 'ไม่มีน้ำตรงนั้น' };
    ch.t ||= {}; ch.t.cast = env.now(); ch.t.castKind = kind; return { silent: true };
  },
  freel(ch, p, env) {
    const t = ch.t || {}; if (!t.cast) return { err: 'ยังไม่ได้เหวี่ยงเบ็ด' };
    const wait = env.now() - t.cast; t.cast = 0;
    if (wait < (hasPerk(ch, 'fisher', 1) ? 1500 : 2500)) return { err: 'ดึงเบ็ดเร็วเกินไป' };
    const boost = (lucky(ch) ? 1.6 : 1) * (hasPerk(ch, 'fisher', 0) ? 1.8 : 1) * (ITEMS[ch.equipped]?.tool?.lure || 1);
    const item = roll(FISH[t.castKind] || FISH.fresh, env.rand, boost > 1 ? boost : null);
    const n = hasPerk(ch, 'fisher', 2) && env.rand() < 0.3 ? 2 : 1;
    return { give: { [item]: n }, xp: { fishing: item === 'golden_fish' ? 30 : item === 'big_fish' ? 12 : 6 }, fish: item };
  },

  // สัตว์เลี้ยง
  petfeed(ch, p) {
    const pet = ch.pets.find((x) => x.id === p.id); if (!pet) return { err: 'ไม่พบสัตว์เลี้ยง' };
    const f = PET_TYPES[pet.type].foods.find((k) => has(ch, k)); if (!f) return { err: 'ไม่มีอาหารที่มันกิน' };
    pet.loyal = Math.min(100, (pet.loyal || 0) + 25); pet.hp = Math.min(petStats(pet).maxHp, (pet.hp || 0) + petStats(pet).maxHp * 0.3); pet.xp = (pet.xp || 0) + 3;
    return { take: { [f]: 1 }, petsChanged: true, msg: `${pet.name} อิ่มแล้ว 💕` };
  },
  petheal(ch, p, env) {
    const pet = ch.pets.find((x) => x.id === p.id); if (!pet) return { err: 'ไม่พบสัตว์เลี้ยง' };
    const med = ['bandage', 'herbal_med'].find((k) => has(ch, k)); if (!med) return { err: 'ต้องมีผ้าพันแผลหรือยาสมุนไพร' };
    pet.hp = petStats(pet).maxHp; pet.down = 0;
    return { take: hasPerk(ch, 'doctor', 1) && env.rand() < 0.5 ? {} : { [med]: 1 }, xp: { medicine: 6 }, petsChanged: true, msg: `🩹 รักษา ${pet.name} จนหายดีแล้ว` };
  },
  petequip(ch, p) {
    const pet = ch.pets.find((x) => x.id === p.id), g = ITEMS[p.k]?.petGear;
    if (!pet || !g || !has(ch, p.k)) return { err: 'ใส่ไม่ได้' };
    pet.gear ||= { weapon: null, body: null };
    const old = pet.gear[g.slot]; pet.gear[g.slot] = p.k;
    return { take: { [p.k]: 1 }, give: old ? { [old]: 1 } : null, quietGive: true, petsChanged: true, msg: `${pet.name} สวม ${ITEMS[p.k].name} แล้ว` };
  },
  petunequip(ch, p) {
    const pet = ch.pets.find((x) => x.id === p.id); const k = pet?.gear?.[p.slot];
    if (!k) return { err: 'ช่องนี้ว่าง' };
    pet.gear[p.slot] = null; return { give: { [k]: 1 }, quietGive: true, petsChanged: true };
  },
  petgift(ch, p, env) {
    const pet = ch.pets.find((x) => x.id === p.id); const G = PET_GIFT[p.kind];
    if (!pet || !G || pet.home || pet.stay) return { silent: true, err: 'ไม่ได้' };
    if (p.kind === 'meat' ? pet.type !== 'cat' : p.kind === 'egg' ? pet.type !== 'chicken' : !pet.traits?.includes(p.kind)) return { silent: true, err: 'ไม่มีความสามารถนี้' };
    if (!cool(ch, `pg:${pet.id}:${p.kind}`, G[0] * 0.9, env.now())) return { silent: true, err: 'ยังไม่ถึงเวลา' };
    const item = pick(env.rand, G[1]), n = baseOf(pet.gear?.body) === 'pet_bag' ? 2 : 1;
    return { give: { [item]: n }, quietGive: true, msg: { forager: `🌿 ${pet.name} หา${ITEMS[item].name}มาให้`, fisher: `🐟 ${pet.name} จับปลามาให้`, thief: `🦝 ${pet.name} แอบหยิบ${ITEMS[item].name}มาให้`, meat: `🐈 ${pet.name} คาบหนูมาให้ (ได้เนื้อดิบ)`, egg: `🥚 ${pet.name} ออกไข่ให้แล้ว` }[p.kind] };
  },
  // ลูกวัยรุ่นช่วยหาของ
  childgift(ch, p, env) {
    if (!cool(ch, `cg:${p.id}`, 108, env.now())) return { silent: true, err: 'ยังไม่ถึงเวลา' };
    const item = pick(env.rand, ['fiber', 'berry', 'wood', 'herb', 'stone']);
    return { give: { [item]: 2 }, quietGive: true, msg: `${String(p.name || 'ลูก').slice(0, 20)} หา ${ITEMS[item].name} มาให้ 2 ชิ้น` };
  },

  // สัตว์จรจัด: ให้อาหาร (โหมดเซิร์ฟเวอร์จะนับความเชื่องที่เซิร์ฟเวอร์)
  tame(ch, p, env) {
    const m = env.mob(p.id); if (!m || !PET_TYPES[m.k]) return { err: 'ไม่พบสัตว์ตัวนี้' };
    if (dist(env, ch, m.x, m.z) > 5) return { err: 'อยู่ไกลเกินไป' };
    const cap = petCap(env.ownCount?.('pethouse') || 0, env.ownCount?.('bed') || 0), mine = ch.pets.filter((x) => x.type === m.k).length;
    if (mine >= cap) return { err: env.ownCount?.('bed') ? `🐾 มี${PET_TYPES[m.k].name}ครบ ${cap} ตัวแล้ว — สร้างบ้านสัตว์เลี้ยงเพิ่ม (+2 ตัว/หลัง)` : `🐾 มี${PET_TYPES[m.k].name}ครบ ${cap} ตัวแล้ว — ต้องมีบ้าน (วางเตียง) และสร้างบ้านสัตว์เลี้ยงก่อน จึงเลี้ยงเพิ่มได้ (+2 ตัว/หลัง)` };
    const foods = PET_TYPES[m.k].foods, f = foods.find((k) => has(ch, k));
    if (!f) return { err: `${PET_TYPES[m.k].name}อยากกิน: ${foods.map((k) => ITEMS[k].name).join(' / ')}` };
    const v = env.tameAdd(p.id, ch, (34 + lvl(ch, 'survival') * 2) * (hasPerk(ch, 'hunter', 2) ? 2 : 1));
    const r = { take: { [f]: 1 }, tame: { id: p.id, v, k: m.k } };
    if (v >= 100) { const pet = rollPet(m.k); ch.pets.push(pet); r.pet = pet; r.xp = { survival: 15 }; env.tamed(p.id); }
    return r;
  },

  // ของขวัญ / รักษาคนอื่น
  gift(ch, p, env) {
    if (!has(ch, p.k) || ITEMS[p.k]?.quest) return { err: 'ไม่มีของชิ้นนี้' };
    const r = { take: { [p.k]: 1 } };
    if (NPCS.some((n) => n.id === p.to)) { if (env.rand() < 0.2) { const back = pick(env.rand, ['bandage', 'canned', 'clean_water', 'herb', 'cloth']); r.give = { [back]: 1 }; r.giveBack = back; } }
    else { if (!env.giveTo(p.to, { [p.k]: 1 }, ch)) return { err: 'ผู้รับไม่ได้ออนไลน์' }; }
    return r;
  },
  heal(ch, p, env) {
    const k = ['bandage', 'herbal_med', 'antibiotic', 'splint'].find((x) => has(ch, x));
    if (!k) return { err: 'ไม่มีผ้าพันแผลหรือยา' };
    return { take: hasPerk(ch, 'doctor', 1) && env.rand() < 0.5 ? {} : { [k]: 1 }, xp: { medicine: 10 }, healItem: k };
  },
  ring(ch) { if (!has(ch, 'ring')) return { err: 'ต้องมีแหวน' }; return { take: { ring: 1 } }; },

  // ภารกิจหลัก (ตรวจขั้นและตำแหน่งที่เซิร์ฟเวอร์)
  quest(ch, p, env) {
    const q = ch.quest ||= { step: 0 }, P = env.pos(ch), near = (s, r) => Math.hypot(P.x - s.x, P.z - s.z) < r;
    switch (p.a) {
      case 'radio': if (q.step !== 0 || !near({ x: QS.radio.x + 1.6, z: QS.radio.z }, 4.5)) return { err: 'ทำตอนนี้ไม่ได้' }; return { give: { radio: 1 }, quest: 1, questMsg: 'radio' };
      case 'prepare': if (q.step !== 1) return { silent: true, err: '-' }; if (!Object.keys(ch.inv).some((k) => ch.inv[k] > 0 && ['spear', 'stone_axe', 'machete', 'steel_axe', 'steel_spear', 'bone_spear', 'king_hammer'].includes(baseOf(k))) || !has(ch, 'clean_water', 2)) return { silent: true, err: '-' }; return { quest: 2, questMsg: 'prepare' };
      case 'transmit': if (q.step !== 3 || !near({ x: QS.tower.x + 3, z: QS.tower.z }, 6) || !has(ch, 'car_battery')) return { err: 'ต้องมีแบตเตอรี่และอยู่ที่เสาส่งสัญญาณ' }; ch.t ||= {}; ch.t.transmit = env.now(); return { take: { car_battery: 1 }, questMsg: 'transmit' };
      case 'tower': if (q.step !== 3 || !ch.t?.transmit || env.now() - ch.t.transmit < 55000 || !near(QS.tower, 35)) return { silent: true, err: '-' }; ch.t.transmit = 0; return { quest: 4, questMsg: 'tower', xp: { survival: 20 } };
      case 'fail': if (q.step === 3) { ch.t ||= {}; ch.t.transmit = 0; return { quest: 2 }; } return { silent: true };
      case 'kaew': if (q.step !== 4) return { silent: true, err: '-' }; return { quest: 5, questMsg: 'kaew' };
      case 'gate': if (q.step !== 5 || !near({ x: QS.camp.x, z: QS.camp.z - QS.camp.size / 2 - 2 }, 6)) return { err: 'ต้องอยู่ที่ประตูค่าย' }; return { give: { antibiotic: 3, machete: 1, canned: 5, clean_water: 3, bandage: 3 }, xp: { survival: 120 }, quest: 6, questMsg: 'gate' };
    }
    return { err: 'ไม่รู้จักขั้นภารกิจ' };
  },

  // ตาย: ของหายครึ่งหนึ่ง (ยกเว้นของภารกิจและเสื้อผ้าที่สวมอยู่)
  // เงินจิที่พกติดตัว: ตาย 1–3 ครั้งในวันนั้นไม่เสีย · ครั้งที่ 4–10 หาย 10% · ครั้งที่ 11+ หาย 20% (เงินในคลังบ้านปลอดภัย)
  died(ch, p, env) {
    const take = {}, day = Math.floor(env.now() / DAY_MS), S = ch.stats;
    S.dd = S.dd && S.dd.d === day ? { d: day, n: S.dd.n + 1 } : { d: day, n: 1 };
    for (const [k, q] of Object.entries(ch.inv)) { if (k === 'jicoin') continue; const lose = Math.floor(q / 2); if (lose && !ITEMS[k]?.quest) take[k] = lose; }
    const n = S.dd.n, rate = deathCoinRate(n), lost = Math.floor((ch.inv.jicoin || 0) * rate);
    if (lost) take.jicoin = lost;
    return { take, quietTake: true, msg: rate ? `💸 ตายครั้งที่ ${n} ของวันนี้ — เงินจิหาย ${lost} (${rate * 100}%) · ฝากเงินไว้ในคลังบ้านจะปลอดภัย` : `🪙 ตายครั้งที่ ${n}/3 ของวันนี้ — เงินจิยังไม่หาย`, deaths: n };
  },
};

// ---------- ค่าใช้จ่ายของคำสั่งกับสิ่งก่อสร้าง (ปลูก รดน้ำ ให้อาหาร ฝาก/ถอนหีบ เติมน้ำมัน) ----------
export function sopCost(ch, s, op, env) {
  switch (op.o) {
    case 'plant': { const C = CROPS[op.crop]; if (!C) return { err: 'ไม่รู้จักพืช' }; if (!has(ch, C.seed)) return { err: `ต้องมี${ITEMS[C.seed].name}` }; return { take: { [C.seed]: 1 }, xp: { farming: 3 } }; }
    case 'water': {
      if (op.silent || env.raining()) return {};
      if (ch.equipped && ITEMS[ch.equipped]?.tool?.water && has(ch, ch.equipped)) return { xp: { farming: 3 } }; // ถือบัวรดน้ำ = ไม่ต้องใช้น้ำขวด
      const w = ['dirty_water', 'clean_water'].find((k) => has(ch, k)); if (!w) return { err: 'ต้องมีน้ำ 1 ขวด' };
      return { take: { [w]: 1 }, give: { bottle: 1 }, xp: { farming: 2 } };
    }
    case 'feed': { const P = PENS[s.type] && (s.type !== 'coop' || s.herd) ? PENS[s.type] : null; if (!(P ? P.foods : FEEDS).includes(op.item) || !has(ch, op.item)) return { err: 'ไม่มีอาหาร' }; return { take: { [op.item]: 1 }, xp: { farming: 2 } }; }
    case 'till': if (!has(ch, 'hoe')) return { err: '⛏️ ต้องมีจอบ (ประดิษฐ์: ไม้ 2 + หิน 2)' }; return { xp: { farming: 2 } };
    case 'fert': if (!has(ch, 'manure')) return { err: 'ต้องมีปุ๋ยคอก (ได้จากคอกหมู/วัว)' }; return { take: { manure: 1 }, xp: { farming: 2 } };
    case 'drink': {
      if (op.silent && env.raining()) return {};
      if (ch.equipped && ITEMS[ch.equipped]?.tool?.water && has(ch, ch.equipped)) return { xp: { farming: 2 } };
      const w = ['dirty_water', 'clean_water'].find((k) => has(ch, k)); if (!w) return { err: 'ต้องมีน้ำ 1 ขวด หรือถือบัวรดน้ำ' };
      return { take: { [w]: 1 }, give: { bottle: 1 }, xp: { farming: 2 } };
    }
    case 'breed': { const P = PENS[s.type]; if (P?.egg) { if (!has(ch, P.egg)) return { err: `ต้องมี${ITEMS[P.egg].name} 1 ฟองเพื่อฟัก` }; return { take: { [P.egg]: 1 }, xp: { farming: 6 } }; } return { xp: { farming: 8 } }; }
    case 'butcher': return { xp: { survival: 4, farming: 4 } };
    case 'list': { const q = op.qty | 0; if (!(q > 0) || !ITEMS[op.item] || ITEMS[op.item].quest || op.item === 'jicoin' || !has(ch, op.item, q) || ch.equipped === op.item && (ch.inv[op.item] || 0) <= q) return { err: 'ของไม่พอ' }; return { take: { [op.item]: q } }; }
    case 'declare': {
      if (!env.structs) return {};
      const c = baseCheck(env.structs(), s); if (!c.ok) return { err: '🏗️ ฐานยังไม่ครบ: ' + c.missing.join(' · ') };
      if (env.structs().some((o) => o.type === 'basecore' && o.ok && o.id !== s.id && o.owner === s.owner)) return { err: 'ประกาศฐานได้คนละ 1 แห่ง' };
      return { opx: { box: c.box }, xp: { building: 30 } };
    }
    case 'contrib': {
      const need = HOUSE_UP[(s.lv || 1) + 1]; if (!need || !need[op.item]) return { err: 'ของนี้ไม่ได้อยู่ในรายการอัปเกรด' };
      const q = Math.min(op.qty | 0, need[op.item] - (s.up?.[op.item] || 0), ch.inv[op.item] || 0); if (q <= 0) return { err: 'ของไม่พอ หรือเติมครบแล้ว' };
      return { take: { [op.item]: q }, opx: { qty: q }, xp: { building: q } };
    }
    case 'color': if (!has(ch, 'jicoin', COLOR_COST)) return { err: `🪙 เปลี่ยนสีฐานใช้ ${COLOR_COST} เงินจิ` }; return { take: { jicoin: COLOR_COST } };
    case 'repair': { const c = REPAIR_BASE(s.lv || 1); for (const [k, q] of Object.entries(c)) if (!has(ch, k, q)) return { err: `ซ่อมต้องใช้ ${Object.entries(c).map(([i, n]) => `${ITEMS[i].name} ${n}`).join(' + ')}` }; return { take: c, xp: { building: 10 } }; }
    case 'bank': { const a = Math.trunc(+op.amt); if (a > 0) { if (!has(ch, 'jicoin', a)) return { err: 'เงินจิไม่พอ' }; return { take: { jicoin: a } }; } return {}; }
    case 'pitem': { const q = op.qty | 0; if (q > 0) { if (!ITEMS[op.item] || ITEMS[op.item].quest || !has(ch, op.item, q) || ch.equipped === op.item && (ch.inv[op.item] || 0) <= q) return { err: 'ของไม่พอ' }; return { take: { [op.item]: q } }; } return {}; }
    case 'buy': { const r = (s.goods || [])[op.i | 0]; if (!r) return { err: 'ไม่พบสินค้า' }; if (!has(ch, 'jicoin', r.p)) return { err: `🪙 เงินจิไม่พอ (ต้องใช้ ${r.p})` }; return { take: { jicoin: r.p } }; }
    case 'stock': if (!['raw_fish', 'golden_fish'].includes(op.item) || !has(ch, op.item)) return { err: 'ไม่มีปลา' }; return { take: { [op.item]: 1 } };
    case 'store': { const q = op.qty | 0; if (q > 0) { if (!has(ch, op.item, q) || ITEMS[op.item]?.quest) return { err: 'ของไม่พอ' }; return { take: { [op.item]: q } }; } return {}; }
    case 'bait': { if (!has(ch, op.item)) return { err: 'ไม่มีของที่จะใช้เป็นเหยื่อ' }; return { take: { [op.item]: 1 } }; }
    case 'claim': {
      // เปิดกรง: สัตว์ที่ติดมาเป็นสัตว์เลี้ยง (ตรวจจำนวนสูงสุดก่อน)
      const type = cageCatch(s, env.now()); if (!type) return { err: 'ยังไม่มีสัตว์ติดกรง' };
      if (PET_TYPES[type].wild) { if (ch.pets.filter((x) => PET_TYPES[x.type]?.wild).length >= WILD_PET_MAX) return { err: `เลี้ยงสัตว์ป่าได้ ${WILD_PET_MAX} ตัว — ปล่อยตัวเก่าก่อน (หรือรอเปิดกรงทีหลัง)` }; }
      else if (ch.pets.filter((x) => x.type === type).length >= petCap(env.ownCount?.('pethouse') || 0, env.ownCount?.('bed') || 0)) return { err: `มี${PET_TYPES[type].name}ครบจำนวนแล้ว` };
      const pet = rollPet(type); ch.pets.push(pet);
      return { pet, xp: { survival: 20 }, petsChanged: true };
    }
    case 'harvest': {
      // เกษตรกร: ผลผลิต ×2 (Lv8 ×3) และได้เมล็ดคืน
      const C = CROPS[s.crop], give = {};
      if (C && hasPerk(ch, 'farmer', 0)) { give[C.out[0]] = C.out[1] * (hasPerk(ch, 'farmer', 2) ? 2 : 1); if (hasPerk(ch, 'farmer', 1)) give[C.seed] = 1; }
      return { xp: { farming: 8 }, give };
    }
    case 'move': {
      if ((op.fuel ?? s.fuel) > (s.fuel ?? 0) + 1) {
        // รถ EV: ชาร์จที่แผงโซล่าเซลล์ (หรือช่างไฟฟ้าขั้นสูงชาร์จได้ทุกที่) ไม่ใช้น้ำมัน
        if (ELECTRIC.has(s.vt)) {
          if (!env.sunny()) return { err: '☁️ ชาร์จได้เฉพาะตอนกลางวันที่มีแดด (กลางคืนหรือฝนตกชาร์จไม่ได้)' };
          if (!env.near('solar', { x: s.x, z: s.z }, 9) && !hasPerk(ch, 'electrician', 2)) return { err: '🔆 ต้องจอดใกล้แผงโซล่าเซลล์ (ไม่เกิน 9 หน่วย) จึงจะชาร์จได้' };
          if (!cool(ch, 'charge', 4, env.now())) return { err: 'กำลังชาร์จ... รอสักครู่', silent: true };
          return { fuel: Math.min(100, (s.fuel ?? 0) + (hasPerk(ch, 'electrician', 0) ? 30 : 15)), xp: { electric: 2 } };
        }
        if (!has(ch, 'fuel')) return { err: 'ต้องมีน้ำมัน' }; return { take: { fuel: 1 }, fuel: Math.min(100, (s.fuel ?? 0) + 50) };
      }
      return { fuel: Math.min(s.fuel ?? 0, op.fuel ?? s.fuel ?? 0) };
    }
  }
  return {};
}

// ---------- ตัวขับ: ตรวจ → ใช้ผล ----------
export function applyResult(ch, r) {
  for (const [k, q] of Object.entries(r.take || {})) { ch.inv[k] = (ch.inv[k] || 0) - q; if (ch.inv[k] <= 0) { delete ch.inv[k]; if (ch.equipped === k) ch.equipped = null; } }
  for (const [k, q] of Object.entries(r.give || {})) if (ITEMS[k] && q > 0) ch.inv[k] = (ch.inv[k] || 0) + q;
  const lvUp = [];
  for (let [s, n] of Object.entries(r.xp || {})) { n *= xpMulOf(ch, s); const b = skillLevel(ch.skills[s]); ch.skills[s] = (ch.skills[s] || 0) + n; const a = skillLevel(ch.skills[s]); if (a > b) lvUp.push([s, a]); }
  if (r.quest !== undefined) ch.quest.step = r.quest;
  if (r.kills) ch.stats.kills = (ch.stats.kills || 0) + r.kills;
  r.levelUp = lvUp;
  return r;
}
export function runAction(ch, name, payload, env) {
  const fn = A[name]; if (!fn) return { err: 'คำสั่งไม่ถูกต้อง' };
  let r;
  try { r = fn(ch, payload || {}, env) || {}; } catch (e) { return { err: 'คำขอไม่ถูกต้อง' }; }
  if (r.err) return r;
  // ภารกิจหลักแต่ละขั้นให้เงินจิครั้งเดียว
  if (r.quest !== undefined && r.quest > (ch.boxes?.qc || 0) && QUEST_COINS[r.quest]) { (ch.boxes ||= {}).qc = r.quest; r.give = { ...(r.give || {}), jicoin: ((r.give || {}).jicoin || 0) + QUEST_COINS[r.quest] }; }
  if (r.place) { const s = env.place(ch, r.place); if (!s) return { err: 'วางไม่ได้' }; r.placed = s; }
  return applyResult(ch, r);
}
// ผลการฆ่า (ฝั่งเซิร์ฟเวอร์ หรือในเครื่องเมื่อเล่นคนเดียว)
export function killReward(ch, kind, rand, tier = 0) {
  const T = kind === 'zombie' ? ZTIERS[tier] || ZTIERS[0] : null;
  const give = rollDrops(kind, rand);
  // ระดับสูงดรอปมากขึ้น · บอสดรอปของพิเศษ
  if (T && T.drops > 1) for (let i = 1; i < T.drops; i++) for (const [k, q] of Object.entries(rollDrops(kind, rand))) give[k] = (give[k] || 0) + q;
  const cr = T ? ZCOIN[T.key] : WCOIN[kind]; if (cr) give.jicoin = (give.jicoin || 0) + coinRoll(rand, cr);
  if (T?.boss) for (const [k, q] of Object.entries(rollBoss(rand))) give[k] = (give[k] || 0) + q;
  if (T?.key === 'toxic' && rand() < 0.4) give.herb = (give.herb || 0) + 1;
  if (hasPerk(ch, 'hunter', 0) && kind !== 'zombie') { give.raw_meat = (give.raw_meat || 0) + 1; if (kind === 'boar' || kind === 'deer') give.hide = (give.hide || 0) + 1; }
  return applyResult(ch, { give: rollVariants(give, rand, T?.boss ? 0.7 : T?.drops > 1 ? 0.15 : 0), xp: { combat: T ? T.xp : 5 }, kills: T ? 1 : 0, boss: T?.boss ? 1 : 0, quietGive: false });
}
export function refundReward(ch, s) {
  const give = refundFor(s);
  if (hasPerk(ch, 'builder', 1) && PIECES[s.type]) for (const [k, q] of Object.entries(buildCost(ch, PIECES[s.type].cost))) give[k] = Math.max(give[k] || 0, q);
  return applyResult(ch, { give, msg: '🏠 รื้อแล้ว ได้วัสดุคืน' });
}
// ชุดเริ่มต้นของอาชีพ (ให้ครั้งเดียวต่ออาชีพ)
export function jobKit(ch) {
  const j = JOBS[ch.profile?.job] ? ch.profile.job : null; if (!j || ch.jobKit === j) return null;
  if (!ch.jp) ch.jp = JOBS[j].free ? {} : { [j]: START_PTS };
  ch.jobKit = j; return applyResult(ch, { give: { ...JOBS[j].kit }, msg: `${JOBS[j].icon} อาชีพ${JOBS[j].name}: ได้รับชุดเริ่มต้น` });
}

// ช่องกระเป๋า (ใช้กับการแสดงผลและตรวจฝั่งเซิร์ฟเวอร์)
export const maxSlots = (ch) => BASE_SLOTS + wearStats(ch.wear).carry + extraSlots(ch);
