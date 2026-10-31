// ระบบสัตว์เลี้ยง: สเตตัส เลเวล ความหายาก ความสามารถพิเศษแบบสุ่ม และชุด/อาวุธ
import { ITEMS, PET_TYPES, PET_TRAITS, PET_RARITY, PET_SLOTS, petLevel } from './data.js';

const NAMES = { dog: ['ด่าง', 'โกโก้', 'บราวนี่', 'ทองแดง', 'ข้าวเหนียว', 'บัดดี้'], cat: ['ส้มจี๊ด', 'มิว', 'ข้าวตู', 'ดำ', 'วาสนา', 'ขนมปัง'], bird: ['ขุนทอง', 'แก้ว', 'ปิ๊ก', 'ฟ้าใส'],
  deer: ['บัมบี้', 'เขางาม', 'ลมหวน'], boar: ['ตูบ', 'อ้วนพี', 'งาเหล็ก'], chicken: ['ไก่ตัน', 'ขนฟู', 'กุ๊กไก่'], duck: ['ก้าบ', 'เป็ดน้อย', 'ปากเหลือง', 'ว่ายน้ำ'], raptor: ['เร็กซ์', 'สายฟ้า', 'เขี้ยวเงิน'], trike: ['ทริกกี้', 'เขาสาม', 'ภูผา'], tiger: ['ลายพาดกลอน', 'เจ้าป่า', 'ส้มซ่า'] };
// ความสามารถที่แต่ละชนิดสุ่มได้ (ชนิดที่มีอยู่แล้วโดยกำเนิดจะไม่สุ่มซ้ำ)
const POOL = {
  dog: ['healer', 'forager', 'guardian', 'sniffer', 'alarm', 'lucky', 'medic', 'calm', 'swift', 'thief'],
  cat: ['healer', 'forager', 'fisher', 'guardian', 'sniffer', 'alarm', 'lucky', 'medic', 'calm', 'swift', 'brave', 'thief'],
  bird: ['healer', 'forager', 'fisher', 'alarm', 'lucky', 'medic', 'calm', 'swift', 'brave', 'thief'],
  deer: ['healer', 'forager', 'alarm', 'lucky', 'calm'], boar: ['forager', 'sniffer', 'alarm', 'brave', 'calm'],
  chicken: ['forager', 'lucky', 'calm', 'alarm'], duck: ['forager', 'lucky', 'calm', 'alarm'], raptor: ['sniffer', 'alarm', 'swift', 'brave', 'thief'],
  trike: ['healer', 'alarm', 'calm', 'lucky', 'brave'], tiger: ['sniffer', 'alarm', 'brave', 'thief', 'lucky'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// boost = โอกาสหายาก/ตำนานสูงขึ้น · extra = สกิลพิเศษเพิ่ม (อาชีพปศุสัตว์)
export function rollPet(type, { boost = 0, extra = 0 } = {}) {
  const W = PET_RARITY.map((x, i) => x.w * (i ? 1 + boost * (i === 1 ? 1.5 : 3) : 1));
  let r = Math.random() * W.reduce((s, x) => s + x, 0), rarity = PET_RARITY[0];
  for (let i = 0; i < PET_RARITY.length; i++) { r -= W[i]; if (r <= 0) { rarity = PET_RARITY[i]; break; } }
  const innate = PET_TYPES[type].innate, pool = [...POOL[type]].filter((t) => t !== innate), traits = innate ? [innate] : [];
  while (traits.length < rarity.traits + extra + (innate ? 1 : 0) && pool.length) traits.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  const p = {
    id: 'p' + Date.now().toString(36), type, name: pick(NAMES[type]), loyal: 60, stay: false, t: 0,
    rarity: rarity.key, mul: +(rarity.mul * (0.85 + Math.random() * 0.3)).toFixed(2), traits, xp: 0, gear: emptyGear(), timers: {},
  };
  p.hp = petStats(p).maxHp;
  return p;
}

// เติมค่าที่ขาดให้สัตว์เลี้ยงจากเซฟเวอร์ชันเก่า
export function ensurePet(p) {
  if (!p.rarity) { const n = rollPet(p.type); Object.assign(p, { rarity: n.rarity, mul: n.mul, traits: n.traits }); }
  p.gear = { ...emptyGear(), ...(p.gear || {}) }; p.timers ||= {}; p.xp ||= 0;
  // เซฟเก่า: ผ้าพันคอ/ปลอกคอหนามเคยอยู่ช่องชุด/อาวุธ → ย้ายไปช่องปลอกคอ
  if (String(p.gear.body).split('~')[0] === 'pet_bandana' && !p.gear.neck) { p.gear.neck = 'pet_bandana'; p.gear.body = null; }
  if (p.gear.weapon === 'pet_collar' && !p.gear.neck) { p.gear.neck = 'pet_collar'; p.gear.weapon = null; }
  if (p.hp === undefined) p.hp = petStats(p).maxHp;
  return p;
}

export function petStats(p) {
  const b = PET_TYPES[p.type].base, lvl = petLevel(p.xp);
  const gear = Object.values(p.gear || {}).filter((k) => k && ITEMS[k]?.petGear).map((k) => ITEMS[k].petGear);
  const sum = (f) => gear.reduce((s, x) => s + (x[f] || 0), 0);
  return {
    lvl,
    maxHp: Math.round(b.hp * p.mul * (1 + 0.1 * (lvl - 1)) + sum('hp')),
    atk: Math.round((b.atk * p.mul * (1 + 0.12 * (lvl - 1)) + sum('atk')) * 10) / 10,
    def: Math.min(0.6, sum('def')),
    luck: gear.some((x) => x.luck), carry: gear.some((x) => x.carry), alarm: gear.some((x) => x.alarm),
  };
}
export const rarityOf = (p) => PET_RARITY.find((r) => r.key === p.rarity) || PET_RARITY[0];
export const fights = (p) => p.type === 'dog' || PET_TYPES[p.type]?.fight || p.traits.includes('brave');

export function gainPetXp(g, p, n) {
  const before = petLevel(p.xp); p.xp += n;
  const after = petLevel(p.xp);
  if (after > before) { g.ui.toast(`🐾 ${p.name} เลเวลอัปเป็น Lv ${after}! แข็งแรงขึ้น`, 'level'); g.sfx.play('level'); p.hp = petStats(p).maxHp; }
}

export const emptyGear = () => Object.fromEntries(Object.keys(PET_SLOTS).map((k) => [k, null]));
// ใส่/ถอด/รักษา ผ่านระบบเศรษฐกิจ (กันโกง)
export function equipPet(g, p, item) { if (ITEMS[item]?.petGear && g.hasItem(item)) g.auth.do('petequip', { id: p.id, k: item }); }
export function unequipPet(g, p, slot) { if (p.gear[slot]) g.auth.do('petunequip', { id: p.id, slot }); }
export function healPet(g, p) {
  if (!['bandage', 'herbal_med'].some((i) => g.hasItem(i))) return g.ui.toast('ต้องมีผ้าพันแผลหรือยาสมุนไพร', 'warn');
  if (p.hp >= petStats(p).maxHp && !p.down) return g.ui.toast(`${p.name} แข็งแรงดีอยู่แล้ว`);
  g.auth.do('petheal', { id: p.id });
}

// ความสามารถพิเศษ (เรียกทุกเฟรมจาก game)
export function tickPetTraits(g, dt) {
  const P = g.player.pos;
  for (const e of g.ents.list) {
    if (e.kind !== 'pet' || e.dead) continue;
    const p = e.pet;
    if (p.down > 0) { p.down -= dt; if (p.down <= 0) { p.hp = Math.ceil(petStats(p).maxHp * 0.3); g.ui.toast(`${p.name} ฟื้นแล้ว`); } continue; }
    if (p.home) { const st0 = petStats(p); p.hp = Math.min(st0.maxHp, p.hp + dt * 0.5); continue; } // อยู่บ้าน: ฟื้นตัว
    if (p.stay || e.pos.distanceTo(P) > 25) continue;
    const st = petStats(p), T = p.timers;
    const every = (k, secs) => { T[k] = (T[k] || 0) + dt; if (T[k] >= secs) { T[k] = 0; return true; } return false; };
    const gift = (kind) => g.auth.do('petgift', { id: p.id, kind }); // ของที่ได้ทอยโดยระบบเศรษฐกิจ
    const trs = st.alarm && !p.traits.includes('alarm') ? [...p.traits, 'alarm'] : p.traits; // ปลอกคอกระดิ่ง = เตือนภัย
    for (const tr of trs) {
      if (tr === 'healer' && every(tr, 90) && g.stats.hp < g.maxHp()) { g.stats.hp = Math.min(g.maxHp(), g.stats.hp + 8); g.ui.toast(`💗 ${p.name} เลียแผลให้ (+8 พลังชีวิต)`); }
      if (tr === 'forager' && every(tr, 120)) gift('forager');
      if (tr === 'fisher' && every(tr, 150)) gift('fisher');
      if (tr === 'thief' && every(tr, 150)) gift('thief');
      if (tr === 'medic' && every(tr, 60) && g.stats.infection > 0) { g.stats.infection = Math.max(0, g.stats.infection - 6); g.ui.toast(`🧪 ${p.name} คาบสมุนไพรมาให้เคี้ยว (การติดเชื้อ -6%)`); }
      if (tr === 'alarm' && every(tr, 3)) {
        const z = g.ents.nearestOf(P, 'zombie', 25);
        if (z && (!T.warned || performance.now() - T.warned > 30000)) {
          T.warned = performance.now();
          g.sfx.play({ dog: 'bark', cat: 'meow', bird: 'chirp' }[p.type]);
          g.ui.toast(`🔔 ${p.name} ส่งเสียงเตือน: ผู้ติดเชื้อกำลังเข้าใกล้!`, 'warn');
        }
      }
    }
    if (every('xp', 60)) gainPetXp(g, p, 2);
  }
}
export function petNearbyWith(g, trait, rad = 12) {
  const P = g.player.pos;
  return g.ents.list.some((e) => e.kind === 'pet' && !e.dead && !(e.pet.down > 0) && e.pet.traits.includes(trait) && e.pos.distanceTo(P) < rad);
}
export { PET_TRAITS };
