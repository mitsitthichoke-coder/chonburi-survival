// ระบบเศรษฐกิจ: กฎทุกอย่างที่ทำให้ "ได้" หรือ "เสีย" ไอเท็มและประสบการณ์
// - โหมดเซิร์ฟเวอร์สาธารณะ: รันบนเซิร์ฟเวอร์เท่านั้น ผู้เล่นส่งได้แค่ "คำขอ" (กันโกง)
// - เล่นคนเดียว / ลิงก์ claude.ai: รันชุดเดียวกันในเบราว์เซอร์
// ไม่พึ่ง three.js — env ให้ข้อมูลโลก (ตำแหน่ง กล่องเสบียง ทรัพยากร สิ่งก่อสร้าง น้ำ ฝน)
import { rollVariants, baseOf, WILD, WILD_PET_MAX, SHOPS, DAY_MS, petCap, ITEMS, RECIPES, LOOT_TABLE, PET_TYPES, NPCS, QUEST_SPOTS, BASE_SLOTS, skillLevel, wearStats, JOBS, jobOf, hasPerk, buildCost, extraSlots, canBuild, PERK_PTS, START_PTS, freePts, jobPts, xpMulOf } from './data.js';
import { RES_TYPES } from './resources-core.js';
import { PIECES, FEEDS, CROPS, refundFor } from './building-core.js';
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
  zombie: [['rag', 0.75], ['rag', 0.4], ['zipper', 0.22], ['kevlar', 0.05], ['cloth', 0.25], ['scrap', 0.25], ['bandage', 0.08], ['bottle', 0.1]],
  boar: [['raw_meat', 1], ['raw_meat', 1], ['raw_meat', 0.6], ['hide', 0.8]],
  deer: [['raw_meat', 1], ['raw_meat', 1], ['hide', 1], ['hide', 0.4]],
  chicken: [['raw_meat', 1], ['egg', 0.4]],
  raptor: [['raw_meat', 1], ['raw_meat', 1], ['hide', 0.8], ['dino_bone', 0.6]],
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
export function rollLoot(rand) {
  const total = LOOT_TABLE.reduce((s, [, w]) => s + w, 0), out = {};
  const n = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) { let r = rand() * total; for (const [item, w] of LOOT_TABLE) { r -= w; if (r <= 0) { out[item] = (out[item] || 0) + 1; break; } } }
  return out;
}
// ราคาในร้าน NPC และมูลค่าของที่เอามาแลก
export const REPAIR_COST = { normal: { scrap: 10, fuel: 2, zipper: 2 }, mechanic: { scrap: 5, fuel: 1 } };
export const shopPrice = (base, pts) => Math.ceil(base * (1 - Math.min(0.25, Math.max(0, pts) / 1000)));
export const tradeValue = (k) => (ITEMS[k]?.value || 0) * 0.8;
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
    const give = rollLoot(env.rand);
    if (L.kind === 'car') { delete give.canned; give.scrap = (give.scrap || 0) + 1; for (const [k, c] of [['wheel', 0.3], ['car_seat', 0.15], ['battery_pack', 0.1], ['engine', 0.04]]) if (env.rand() < c) give[k] = (give[k] || 0) + 1; } // ถอดชิ้นส่วนจากรถร้าง
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
    const cost = hasPerk(ch, 'mechanic', 0) ? REPAIR_COST.mechanic : REPAIR_COST.normal;
    for (const [k, q] of Object.entries(cost)) if (!has(ch, k, q)) return { err: `ซ่อมรถต้องใช้ ${Object.entries(cost).map(([a, b]) => `${ITEMS[a].name} ${b}`).join(' + ')}` };
    if (lvl(ch, 'crafting') < 2 && !hasPerk(ch, 'mechanic', 0)) return { err: 'ต้องมีทักษะประดิษฐ์ Lv2 (หรือสเตตัสสายช่างยนต์) จึงซ่อมรถได้' };
    return { take: cost, place: { type: 'vehicle', vt: 'pickup', x: +L.x.toFixed(2), z: +L.z.toFixed(2), ry: 0, fuel: 40 }, loot: { id: p.id, until: env.now() + 7 * 864e5 }, xp: { crafting: 30 }, msg: '🔧 ซ่อมรถร้างสำเร็จ! กลายเป็นรถกระบะ ขับได้เลย (เติมน้ำมันเพิ่มได้)', sfx: 'craft' };
  },
  // จับสัตว์ป่าด้วยแห: ยิ่งสัตว์บาดเจ็บยิ่งจับง่าย · เลี้ยงสัตว์ป่าได้ 1 ตัว
  capture(ch, p, env) {
    const net = ch.equipped && has(ch, ch.equipped) && ITEMS[ch.equipped].tool?.net; if (!net) return { err: 'ต้องถือแหจับสัตว์' };
    const m = env.wild?.(p.id); if (!m) return { err: 'ไม่พบสัตว์ตัวนี้' };
    const W = WILD[m.k]; if (!W?.net || !PET_TYPES[m.k]) return { err: `${W?.name || 'สัตว์ตัวนี้'}ตัวใหญ่เกินกว่าจะจับด้วยแห` };
    if (dist(env, ch, m.x, m.z) > 5.5) return { err: 'อยู่ไกลเกินไป เข้าไปใกล้อีก' };
    if (ch.pets.filter((x) => PET_TYPES[x.type]?.wild).length >= WILD_PET_MAX) return { err: `เลี้ยงสัตว์ป่าได้ ${WILD_PET_MAX} ตัวเท่านั้น` };
    if (!cool(ch, 'net', 1.2, env.now())) return { silent: true, err: '-' };
    const chance = 0.2 + 0.65 * (1 - Math.max(0, m.hp) / m.maxHp);
    if (env.rand() > chance) return env.rand() < 0.3 ? { take: { [ch.equipped]: 1 }, msg: `🕸️ ${W.name}ดิ้นหลุด แหขาด! (ทำให้มันอ่อนแรงก่อนจะจับง่ายขึ้น)` } : { msg: `🕸️ ${W.name}ดิ้นหลุด! ลองใหม่ (โอกาส ${Math.round(chance * 100)}%)` };
    const pet = rollPet(m.k); ch.pets.push(pet); env.tamed(p.id);
    return { take: { [ch.equipped]: 1 }, pet, xp: { survival: 25 }, msg: `🕸️ จับ${W.name}ได้แล้ว! ตั้งชื่อว่า ${pet.name}` };
  },
  // ยิงอาวุธระยะไกล: ใช้กระสุน 1 นัด (ดาเมจคำนวณแบบเดียวกับการตี)
  shoot(ch, p, env) {
    const t = ch.equipped && has(ch, ch.equipped) && ITEMS[ch.equipped].tool; if (!t?.ranged) return { err: 'ต้องถืออาวุธยิงไกล' };
    if (!cool(ch, 'shoot', 0.6, env.now())) return { silent: true, err: '-' };
    if (!has(ch, t.ammo)) return { err: `ไม่มี${ITEMS[t.ammo].name}` };
    return { take: { [t.ammo]: 1 }, quietTake: true, shot: true };
  },
  // ลงแต้มสเตตัสสายอาชีพ (+1 ต่อครั้ง)
  statup(ch, p) {
    if (!JOBS[p.job]) return { err: 'ไม่รู้จักสายอาชีพนี้' };
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
    for (const [k, q] of Object.entries(p.pay || {})) {
      const qq = Math.floor(+q); if (!(qq > 0)) continue;
      if (!ITEMS[k] || ITEMS[k].quest || !has(ch, k, qq)) return { err: 'ของที่จะใช้แลกไม่พอ' };
      take[k] = qq; paid += tradeValue(k) * qq;
    }
    if (paid + 1e-6 < price) return { err: `ของที่เอามาแลกมีมูลค่า ${Math.floor(paid)} ยังไม่ถึง ${price}` };
    ch.trade[key] = { d: day, n: used + 1 };
    return { take, give: { [row[0]]: 1 }, xp: { survival: 2 }, msg: `🤝 แลก ${ITEMS[row[0]].icon} ${ITEMS[row[0]].name} กับ${n.name}สำเร็จ`, traded: true };
  },

  // กล่องภารกิจ: ต้องผ่านเงื่อนไขก่อน เปิดได้คนละครั้ง
  qbox(ch, p, env) {
    const b = QUEST_BOXES.find((x) => x.id === p.id); if (!b) return { err: 'ไม่พบกล่องนี้' };
    const B = ch.boxes ||= {};
    if (B[b.id]) return { err: 'คุณเปิดกล่องนี้ไปแล้ว' };
    if (dist(env, ch, b.x, b.z) > 4.5) return { err: 'อยู่ไกลเกินไป' };
    const lock = qboxLock(b, ch, charLevelOf(ch.skills)); if (lock) return { err: '🔒 ' + lock };
    B[b.id] = 1;
    return { give: { ...b.give }, xp: { survival: 25 }, msg: `📦 เปิด${b.name}สำเร็จ!`, boxOpen: b.id };
  },
  // กล่องหายาก: เกิดนาน ๆ ครั้ง ตำแหน่งสุ่ม ทุกคนเปิดได้คนละครั้งก่อนมันหายไป
  rare(ch, p, env) {
    const R = rareBoxAt(env.now()); if (!R || R.id !== p.id) return { err: 'กล่องหายากหายไปแล้ว...' };
    const B = ch.boxes ||= {};
    if (B[R.id]) return { err: 'คุณเปิดกล่องนี้ไปแล้ว' };
    if (dist(env, ch, R.x, R.z) > 4.5) return { err: 'อยู่ไกลเกินไป' };
    for (const k of Object.keys(B)) if (k[0] === 'R') delete B[k]; // เก็บแค่กล่องล่าสุด
    B[R.id] = 1;
    const give = rollRare(env.rand); if (lucky(ch)) { const ex = Object.keys(rollRare(env.rand))[0]; if (ex) give[ex] = (give[ex] || 0) + 1; }
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
    return { give, xp: { gathering: R.type === 'tree' || R.type === 'rock' ? 6 : 2 }, res: { id: p.id, until: env.now() + T.respawn * 60000 }, raw: !tool && T.drops.some(([k]) => RAW[k]) };
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
    if (it.instrument) { if (!cool(ch, 'music', 20, env.now())) return { err: '🎸 พักนิ้วก่อน (เล่นได้ทุก 20 วินาที)' }; return { fx: { music: true, item: p.k }, xp: { recreation: 10 } }; }
    return { err: 'ใช้ไม่ได้' };
  },
  hold(ch, p) {
    if (p.k && (!has(ch, p.k) || !ITEMS[p.k]?.tool)) return { err: 'ไม่มีเครื่องมือนี้' };
    ch.equipped = p.k || null; return { held: true };
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
    if (PIECES[s.type]) {
      const P = PIECES[s.type];
      if (!canBuild(ch.inv)) return { err: 'ต้องมีค้อน (ค้อนไม้ หรือ ค้อนช่างไม้)' };
      if (lvl(ch, 'building') < P.lvl) return { err: `ต้องมีทักษะก่อสร้าง Lv${P.lvl}` };
      const cost = buildCost(ch, P.cost);
      for (const [k, q] of Object.entries(cost)) if (!has(ch, k, q)) return { err: 'วัสดุไม่พอ' };
      return { take: cost, place: { ...clean, type: s.type }, xp: { building: 4 }, sfx: 'place' };
    }
    const it = ITEMS[p.item]; if (!it?.place || !has(ch, p.item)) return { err: 'ไม่มีของชิ้นนี้' };
    const st = { ...clean, type: it.place }; delete st.y;
    if (it.vt) { st.vt = it.vt; if (it.vt === 'motorbike' || it.vt === 'pickup') st.fuel = 60; }
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
  died(ch) {
    const take = {};
    for (const [k, q] of Object.entries(ch.inv)) { const lose = Math.floor(q / 2); if (lose && !ITEMS[k]?.quest) take[k] = lose; }
    return { take, quietTake: true };
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
    case 'feed': if (!FEEDS.includes(op.item) || !has(ch, op.item)) return { err: 'ไม่มีอาหาร' }; return { take: { [op.item]: 1 }, xp: { farming: 2 } };
    case 'stock': if (!['raw_fish', 'golden_fish'].includes(op.item) || !has(ch, op.item)) return { err: 'ไม่มีปลา' }; return { take: { [op.item]: 1 } };
    case 'store': { const q = op.qty | 0; if (q > 0) { if (!has(ch, op.item, q) || ITEMS[op.item]?.quest) return { err: 'ของไม่พอ' }; return { take: { [op.item]: q } }; } return {}; }
    case 'harvest': {
      // เกษตรกร: ผลผลิต ×2 (Lv8 ×3) และได้เมล็ดคืน
      const C = CROPS[s.crop], give = {};
      if (C && hasPerk(ch, 'farmer', 0)) { give[C.out[0]] = C.out[1] * (hasPerk(ch, 'farmer', 2) ? 2 : 1); if (hasPerk(ch, 'farmer', 1)) give[C.seed] = 1; }
      return { xp: { farming: 8 }, give };
    }
    case 'move': { if ((op.fuel ?? s.fuel) > (s.fuel ?? 0) + 1) { if (!has(ch, 'fuel')) return { err: 'ต้องมีน้ำมัน' }; return { take: { fuel: 1 }, fuel: Math.min(100, (s.fuel ?? 0) + 50) }; } return { fuel: Math.min(s.fuel ?? 0, op.fuel ?? s.fuel ?? 0) }; }
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
  if (r.place) { const s = env.place(ch, r.place); if (!s) return { err: 'วางไม่ได้' }; r.placed = s; }
  return applyResult(ch, r);
}
// ผลการฆ่า (ฝั่งเซิร์ฟเวอร์ หรือในเครื่องเมื่อเล่นคนเดียว)
export function killReward(ch, kind, rand, tier = 0) {
  const T = kind === 'zombie' ? ZTIERS[tier] || ZTIERS[0] : null;
  const give = rollDrops(kind, rand);
  // ระดับสูงดรอปมากขึ้น · บอสดรอปของพิเศษ
  if (T && T.drops > 1) for (let i = 1; i < T.drops; i++) for (const [k, q] of Object.entries(rollDrops(kind, rand))) give[k] = (give[k] || 0) + q;
  if (T?.boss) for (const [k, q] of Object.entries(rollBoss(rand))) give[k] = (give[k] || 0) + q;
  if (T?.key === 'toxic' && rand() < 0.4) give.herb = (give.herb || 0) + 1;
  if (hasPerk(ch, 'hunter', 0) && kind !== 'zombie') { give.raw_meat = (give.raw_meat || 0) + 1; if (kind === 'boar' || kind === 'deer') give.hide = (give.hide || 0) + 1; }
  return applyResult(ch, { give: rollVariants(give, rand, T?.boss ? 0.7 : T?.drops > 1 ? 0.15 : 0), xp: { combat: T ? T.xp : 5 }, kills: T ? 1 : 0, boss: T?.boss ? 1 : 0, quietGive: false });
}
export function refundReward(ch, s) {
  const give = refundFor(s);
  if (hasPerk(ch, 'builder', 1) && PIECES[s.type]) for (const [k, q] of Object.entries(buildCost(ch, PIECES[s.type].cost))) give[k] = Math.max(give[k] || 0, q);
  return applyResult(ch, { give, msg: hasPerk(ch, 'builder', 1) ? '🏠 รื้อแล้ว ได้วัสดุคืนเต็ม' : 'รื้อแล้ว ได้วัสดุคืนครึ่งหนึ่ง' });
}
// ชุดเริ่มต้นของอาชีพ (ให้ครั้งเดียวต่ออาชีพ)
export function jobKit(ch) {
  const j = JOBS[ch.profile?.job] ? ch.profile.job : null; if (!j || ch.jobKit === j) return null;
  if (!ch.jp) ch.jp = { [j]: START_PTS };
  ch.jobKit = j; return applyResult(ch, { give: { ...JOBS[j].kit }, msg: `${JOBS[j].icon} อาชีพ${JOBS[j].name}: ได้รับชุดเริ่มต้น` });
}

// ช่องกระเป๋า (ใช้กับการแสดงผลและตรวจฝั่งเซิร์ฟเวอร์)
export const maxSlots = (ch) => BASE_SLOTS + wearStats(ch.wear).carry + extraSlots(ch);
