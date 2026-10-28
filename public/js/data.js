import { lonToX, latToZ } from './terrain.js';

export const DAY_MS = 36 * 60 * 1000;        // 1 วันในเกม = 36 นาทีจริง
export const PREG_MS = 20 * 60 * 1000;       // ตั้งครรภ์ 20 นาทีจริง
export const BABY_MS = 30 * 60 * 1000;       // ทารก -> เด็ก
export const CHILD_MS = 90 * 60 * 1000;      // เด็ก -> วัยรุ่น (ช่วยหาของได้)

const RAW_ITEMS = {
  wood: { name: 'ไม้', icon: '🪵', value: 1 },
  stone: { name: 'หิน', icon: '🪨', value: 1 },
  fiber: { name: 'เส้นใยพืช', icon: '🌿', value: 1 },
  herb: { name: 'สมุนไพร', icon: '🌱', value: 3 },
  pebble: { name: 'ก้อนหินดิบ', icon: '🥌', value: 1 },
  twig: { name: 'กิ่งไม้แห้ง', icon: '🥢', value: 1 },
  raw_fiber: { name: 'ต้นหญ้าดิบ', icon: '🌾', value: 1 },
  cloth: { name: 'ผ้า', icon: '🧵', value: 3 },
  scrap: { name: 'เศษเหล็ก', icon: '🔩', value: 3 },
  bottle: { name: 'ขวดเปล่า', icon: '🍶', value: 2 },
  berry: { name: 'ผลไม้ป่า', icon: '🫐', value: 2, food: { hunger: 8, thirst: 3 } },
  coconut: { name: 'มะพร้าว', icon: '🥥', value: 4, food: { hunger: 6, thirst: 22 } },
  orange: { name: 'ส้ม', icon: '🍊', value: 3, food: { hunger: 6, thirst: 12, infection: -2 } },
  pineapple: { name: 'สับปะรด', icon: '🍍', value: 4, food: { hunger: 12, thirst: 14 } },
  raw_meat: { name: 'เนื้อดิบ', icon: '🥩', value: 3, food: { hunger: 10, sick: 0.35 } },
  cooked_meat: { name: 'เนื้อย่าง', icon: '🍖', value: 6, food: { hunger: 35, hp: 6 } },
  raw_fish: { name: 'ปลาสด', icon: '🐟', value: 3, food: { hunger: 8, sick: 0.3 } },
  grilled_fish: { name: 'ปลาเผา', icon: '🍢', value: 6, food: { hunger: 30, hp: 5 } },
  canned: { name: 'อาหารกระป๋อง', icon: '🥫', value: 6, food: { hunger: 30 } },
  herbal_soup: { name: 'ต้มยำสมุนไพร', icon: '🍲', value: 12, food: { hunger: 40, thirst: 20, hp: 12, infection: -15 } },
  dirty_water: { name: 'น้ำดิบ', icon: '🫙', value: 1, food: { thirst: 25, sick: 0.4 }, returns: 'bottle' },
  clean_water: { name: 'น้ำต้มสุก', icon: '💧', value: 4, food: { thirst: 40 }, returns: 'bottle' },
  sea_water: { name: 'น้ำทะเล', icon: '🌊', value: 0, returns: 'bottle', desc: 'ดื่มไม่ได้ — กรองที่เครื่องกรองน้ำทะเลให้เป็นน้ำจืดก่อน' },
  bandage: { name: 'ผ้าพันแผล', icon: '🩹', value: 6, med: { stopBleed: true, hp: 12 } },
  splint: { name: 'เฝือกไม้', icon: '🦴', value: 6, med: { fracture: true, hp: 5 } },
  herbal_med: { name: 'ยาสมุนไพร', icon: '🧪', value: 8, med: { infection: -30, cureSick: true, hp: 5 } },
  antibiotic: { name: 'ยาปฏิชีวนะ', icon: '💊', value: 15, med: { infection: -75, cureSick: true } },
  stone_axe: { name: 'ขวานหิน', icon: '🪓', value: 8, tool: { gather: 2, dmg: 14, range: 2.6 } },
  spear: { name: 'หอกไม้', icon: '🔱', value: 8, tool: { gather: 1, dmg: 20, range: 3.4, fish: true } },
  machete: { name: 'มีดพร้า', icon: '🔪', value: 14, tool: { gather: 2.5, dmg: 30, range: 2.8 } },
  // ---- เสื้อผ้า (สวมใส่ได้ 7 ช่อง) ----
  // def = ลดความเสียหาย · bite = ลดโอกาสติดเชื้อเมื่อถูกกัด · spd = เดินเร็วขึ้น · stam = สตามิน่าฟื้นเร็วขึ้น · gather = เก็บของมือเปล่าแรงขึ้น · carry = ช่องกระเป๋าเพิ่ม
  hat_cloth: { name: 'หมวกผ้า', icon: '🧢', value: 4, wear: { slot: 'head', warm: 0.06, def: 0.03, color: '#c9a227' } },
  helmet_bike: { name: 'หมวกกันน็อก', icon: '⛑️', value: 10, wear: { slot: 'head', def: 0.08, bite: 0.05, color: '#d62828' } },
  helmet_mil: { name: 'หมวกทหาร', icon: '🪖', value: 18, wear: { slot: 'head', def: 0.12, bite: 0.1, color: '#556b2f' } },
  shirt_rag: { name: 'เสื้อผ้าปะ', icon: '👕', value: 5, wear: { slot: 'body', def: 0.04, color: '#8d99ae' } },
  cloth_armor: { name: 'เสื้อเกราะผ้าหนา', icon: '🦺', value: 12, wear: { slot: 'body', def: 0.12, bite: 0.15, color: '#6c757d' } },
  jacket_leather: { name: 'แจ็กเก็ตหนัง', icon: '🧥', value: 16, wear: { slot: 'body', warm: 0.35, def: 0.16, bite: 0.2, color: '#6f4518' } },
  vest_kevlar: { name: 'เสื้อเกราะกันกระสุน', icon: '🦺', value: 26, wear: { slot: 'body', def: 0.25, bite: 0.3, color: '#2b2d42' } },
  pants_rag: { name: 'กางเกงผ้าปะ', icon: '👖', value: 4, wear: { slot: 'legs', def: 0.03, color: '#7d8597' } },
  skirt_rag: { name: 'กระโปรงผ้าปะ', icon: '👗', value: 4, wear: { slot: 'legs', def: 0.02, spd: 0.03, color: '#b5838d', skirt: true } },
  jeans: { name: 'กางเกงยีนส์หนา', icon: '👖', value: 9, wear: { slot: 'legs', def: 0.07, bite: 0.08, color: '#1d3557' } },
  skirt_long: { name: 'กระโปรงยาวผ้าหนา', icon: '👗', value: 9, wear: { slot: 'legs', def: 0.05, bite: 0.06, spd: 0.03, color: '#6d597a', skirt: true } },
  pants_cargo: { name: 'กางเกงทหาร', icon: '👖', value: 15, wear: { slot: 'legs', def: 0.1, bite: 0.12, color: '#606c38' } },
  gloves_rag: { name: 'ถุงมือผ้า', icon: '🧤', value: 3, wear: { slot: 'hands', gather: 0.3, bite: 0.03, color: '#e9d8a6' } },
  gloves_leather: { name: 'ถุงมือหนัง', icon: '🧤', value: 9, wear: { slot: 'hands', gather: 0.6, def: 0.03, bite: 0.08, color: '#7f4f24' } },
  socks: { name: 'ถุงเท้า', icon: '🧦', value: 2, wear: { slot: 'socks', stam: 0.1, color: '#f1faee' } },
  socks_wool: { name: 'ถุงเท้าหนา', icon: '🧦', value: 5, wear: { slot: 'socks', stam: 0.2, color: '#e76f51' } },
  sandals: { name: 'รองเท้าแตะ', icon: '🩴', value: 3, wear: { slot: 'shoes', spd: 0.04, color: '#3a86ff' } },
  sneakers: { name: 'รองเท้าผ้าใบ', icon: '👟', value: 9, wear: { slot: 'shoes', spd: 0.08, stam: 0.05, color: '#f8f9fa' } },
  boots: { name: 'รองเท้าบูท', icon: '🥾', value: 14, wear: { slot: 'shoes', warm: 0.08, spd: 0.06, def: 0.05, bite: 0.08, color: '#432818' } },
  bag_cloth: { name: 'กระเป๋าผ้า Lv1', icon: '👝', value: 6, wear: { slot: 'back', carry: 8, lvl: 1, color: '#bc9d6c' } },
  bag_hiking: { name: 'กระเป๋าเป้เดินป่า Lv2', icon: '🎒', value: 14, wear: { slot: 'back', carry: 24, lvl: 2, color: '#2a9d8f' } },
  bag_military: { name: 'กระเป๋าทหาร Lv3', icon: '🎒', value: 24, wear: { slot: 'back', carry: 36, lvl: 3, color: '#4b5320' } },
  // ---- ของขั้นสูงเฉพาะอาชีพ ----
  steel_axe: { name: 'ขวานเหล็ก', icon: '🪓', value: 22, tool: { gather: 3.5, dmg: 24, range: 2.7, mine: true } },
  steel_spear: { name: 'หอกเหล็กกล้า', icon: '🔱', value: 24, tool: { gather: 1.2, dmg: 34, range: 3.8, fish: true } },
  rod_pro: { name: 'เบ็ดคาร์บอน', icon: '🎣', value: 18, tool: { gather: 1, dmg: 5, range: 2, rod: true, lure: 1.8 } },
  pickup: { name: 'รถกระบะดัดแปลง', icon: '🛻', value: 80, place: 'vehicle', vt: 'pickup' },
  hunter_cloak: { name: 'ชุดพรางนักล่า', icon: '🥷', value: 20, wear: { slot: 'body', warm: 0.3, def: 0.14, bite: 0.18, spd: 0.05, color: '#4a5e3a' } },
  jerky: { name: 'เนื้อตากแห้ง', icon: '🥓', value: 8, food: { hunger: 32, hp: 4 } },
  big_meal: { name: 'อาหารชุดใหญ่', icon: '🍱', value: 20, food: { hunger: 70, thirst: 20, hp: 25, infection: -5 } },
  fish_soup: { name: 'ต้มยำปลา', icon: '🥘', value: 12, food: { hunger: 45, thirst: 25, hp: 12, infection: -10 } },
  // ---- ของจากบอส "ราชาผู้ติดเชื้อ" ----
  king_fang: { name: 'เขี้ยวราชาผู้ติดเชื้อ', icon: '🦷', value: 40 },
  king_hammer: { name: 'ค้อนทุบราชา', icon: '🔨', value: 60, tool: { gather: 3, dmg: 48, range: 3, mine: true, hammer: true } },
  king_armor: { name: 'เกราะราชาผู้ติดเชื้อ', icon: '🥋', value: 60, wear: { slot: 'body', def: 0.3, bite: 0.35, color: '#370617' } },
  king_crown: { name: 'มงกุฎราชา', icon: '👑', value: 50, wear: { slot: 'head', def: 0.15, bite: 0.15, stam: 0.15, color: '#ffd60a' } },
  // ---- ของอาชีพใหม่ ----
  first_aid: { name: 'ชุดปฐมพยาบาล', icon: '🧰', value: 18, med: { hp: 40, stopBleed: true, fracture: true, cureSick: true } },
  antiviral: { name: 'ยาต้านไวรัส', icon: '💉', value: 30, med: { infection: -100, cureSick: true, immune: 180 } },
  calm_tea: { name: 'ชาสมุนไพรคลายเครียด', icon: '🍵', value: 6, food: { thirst: 20, stress: -25 } },
  guitar: { name: 'กีตาร์โปร่ง', icon: '🎸', value: 20, instrument: true },
  energy_drink: { name: 'เกลือแร่สูตรนักกีฬา', icon: '🧃', value: 8, food: { thirst: 30, stamina: 100 }, returns: 'bottle' },
  protein_meal: { name: 'อกไก่ต้มโปรตีน', icon: '🍗', value: 10, food: { hunger: 40, hp: 15, stamina: 30 } },
  kaprao: { name: 'ข้าวผัดกะเพรา', icon: '🍛', value: 16, food: { hunger: 60, hp: 15, stress: -10 } },
  tomyum_kung: { name: 'ต้มยำกุ้ง', icon: '🍜', value: 20, food: { hunger: 40, thirst: 30, hp: 15, infection: -20 } },
  coconut_dessert: { name: 'บัวลอยมะพร้าวอ่อน', icon: '🥣', value: 14, food: { hunger: 30, thirst: 15, stress: -30 } },
  // ---- อุปกรณ์ไอที (อาชีพ IT) — มีในกระเป๋าแล้วใช้งานได้ ----
  phone: { name: 'มือถือดัดแปลง', icon: '📱', value: 40, device: { loot: 80 } },
  zradar: { name: 'เรดาร์จับผู้ติดเชื้อ', icon: '📡', value: 60, device: { zombie: 70 } },
  drone: { name: 'โดรนสอดแนม', icon: '🛸', value: 80, device: { scout: 150 }, instrument: true },
  // ---- ของพระ (อาชีพพระ) ----
  prayer_beads: { name: 'ลูกประคำ', icon: '📿', value: 25, instrument: true, chant: true },
  amulet: { name: 'ผ้ายันต์กำลังใจ', icon: '🪬', value: 30, food: { stress: -35 }, morale: 300 },
  dino_bone: { name: 'กระดูกไดโนเสาร์', icon: '🦴', value: 15 },
  bone_spear: { name: 'หอกกระดูกไดโน', icon: '🔱', value: 30, tool: { gather: 1.2, dmg: 32, range: 3.6, fish: true } },
  // ---- อาวุธระยะประชิด ----
  club: { name: 'กระบองไม้', icon: '🏏', value: 4, tool: { gather: 1, dmg: 13, range: 2.4 } },
  nail_bat: { name: 'ไม้ตอกตะปู', icon: '🏏', value: 12, tool: { gather: 1, dmg: 24, range: 2.5 } },
  sickle: { name: 'เคียวเกี่ยวหญ้า', icon: '🌙', value: 8, tool: { gather: 2.5, dmg: 16, range: 2.3 } },
  iron_sword: { name: 'ดาบเหล็กตีมือ', icon: '🗡️', value: 30, tool: { gather: 1.5, dmg: 36, range: 2.9 } },
  // ---- อาวุธระยะไกล (ต้องมีกระสุน) ----
  slingshot: { name: 'หนังสติ๊ก', icon: '🪃', value: 6, tool: { gather: 0.5, dmg: 12, range: 14, ranged: true, ammo: 'pebble' } },
  bow: { name: 'ธนูไม้ไผ่', icon: '🏹', value: 14, tool: { gather: 0.5, dmg: 24, range: 20, ranged: true, ammo: 'arrow' } },
  crossbow: { name: 'หน้าไม้เหล็ก', icon: '🏹', value: 34, tool: { gather: 0.5, dmg: 40, range: 26, ranged: true, ammo: 'bolt' } },
  // กระสุนแต่ละระดับ: ammo.g = ใช้กับอาวุธที่ ammo ตรงกัน · ammo.dmg = ดาเมจเพิ่มจากอาวุธ · ยิงจะใช้ระดับที่เลือกไว้ (คลิกในกระเป๋า) หรือระดับดีสุดที่มี
  arrow: { name: 'ลูกธนูไม้', icon: '➶', value: 1, ammo: { g: 'arrow', dmg: 0, tier: 1 } },
  arrow_stone: { name: 'ลูกธนูหัวหิน', icon: '➶', value: 2, ammo: { g: 'arrow', dmg: 6, tier: 2 } },
  arrow_bone: { name: 'ลูกธนูหัวกระดูก', icon: '➶', value: 3, ammo: { g: 'arrow', dmg: 11, tier: 3 } },
  arrow_iron: { name: 'ลูกธนูหัวเหล็ก', icon: '➶', value: 4, ammo: { g: 'arrow', dmg: 17, tier: 4 } },
  arrow_fire: { name: 'ลูกธนูไฟ', icon: '🔥', value: 7, ammo: { g: 'arrow', dmg: 26, tier: 5, burn: true } },
  bolt: { name: 'ลูกดอกหน้าไม้', icon: '➹', value: 2, ammo: { g: 'bolt', dmg: 0, tier: 1 } },
  bolt_steel: { name: 'ลูกดอกเหล็กกล้า', icon: '➹', value: 5, ammo: { g: 'bolt', dmg: 16, tier: 2 } },
  bolt_heavy: { name: 'ลูกดอกหัวเจาะเกราะ', icon: '➹', value: 9, ammo: { g: 'bolt', dmg: 30, tier: 3 } },
  steel_ball: { name: 'ลูกเหล็กหนังสติ๊ก', icon: '⚫', value: 2, ammo: { g: 'pebble', dmg: 8, tier: 2 } },
  // ---- ชิ้นส่วนรถ (คราฟท์แล้วประกอบเป็นยานพาหนะ) ----
  wheel: { name: 'ล้อรถยนต์', icon: '🛞', value: 8 },
  engine: { name: 'เครื่องยนต์รถยนต์', icon: '⚙️', value: 30 },
  moto_wheel: { name: 'ล้อมอเตอร์ไซค์', icon: '⭕', value: 5 },
  moto_engine: { name: 'เครื่องยนต์มอเตอร์ไซค์', icon: '🔩', value: 18 },
  moto_ev_motor: { name: 'มอเตอร์ไฟฟ้ามอเตอร์ไซค์', icon: '⚡', value: 16 },
  moto_battery: { name: 'แบตเตอรี่มอเตอร์ไซค์ไฟฟ้า', icon: '🔋', value: 20 },
  chassis: { name: 'โครงรถ', icon: '🔧', value: 18 },
  car_seat: { name: 'เบาะรถ', icon: '💺', value: 8 },
  battery_pack: { name: 'แบตเตอรี่ประกอบ', icon: '🔋', value: 14 },
  raft_kit: { name: 'ชุดลำแพไม้ไผ่', icon: '🪵', value: 8 },
  steering_wheel: { name: 'พวงมาลัย', icon: '🎡', value: 8 },
  spark_plug: { name: 'หัวเทียน', icon: '🕯️', value: 6 },
  ev_battery: { name: 'แบตเตอรี่ EV', icon: '🔋', value: 40 },
  ev_motor: { name: 'มอเตอร์ไฟฟ้า', icon: '⚡', value: 30 },
  copper_wire: { name: 'สายไฟทองแดง', icon: '🧵', value: 4 },
  cage: { name: 'กรงดักสัตว์', icon: '🪤', value: 20, place: 'cage' },
  solar_panel: { name: 'แผงโซล่าเซลล์', icon: '🔆', value: 35, place: 'solar' },
  ev_car: { name: 'รถยนต์ไฟฟ้า EV', icon: '🚙', value: 120, place: 'vehicle', vt: 'ev_car' },
  ev_bike: { name: 'มอเตอร์ไซค์ไฟฟ้า', icon: '🛵', value: 70, place: 'vehicle', vt: 'ev_bike' },
  // ---- โล่ (ถือมือซ้าย) · block = โอกาสกันการโจมตีได้ (เหลือความเสียหาย 25% และไม่ติดเชื้อ) ----
  shield_wood: { name: 'โล่ไม้เล็ก', icon: '🛡️', value: 6, wear: { slot: 'off', def: 0.04, block: 0.15, size: 0.8, color: '#9c6644' } },
  shield_lid: { name: 'โล่ฝาถังเหล็ก', icon: '🛡️', value: 10, wear: { slot: 'off', def: 0.06, block: 0.22, size: 0.9, round: true, color: '#8d99ae' } },
  shield_hide: { name: 'โล่หนังสัตว์', icon: '🛡️', value: 14, wear: { slot: 'off', def: 0.08, block: 0.28, bite: 0.05, size: 1, color: '#7f4f24' } },
  shield_riot: { name: 'โล่ปราบจลาจล', icon: '🛡️', value: 28, wear: { slot: 'off', def: 0.12, block: 0.4, bite: 0.1, spd: -0.05, size: 1.5, color: '#2b2d42' } },
  // วัตถุดิบจากผู้ติดเชื้อและสัตว์
  rag: { name: 'เศษผ้าขาด (จากผู้ติดเชื้อ)', icon: '🩶', value: 1 },
  zipper: { name: 'ซิปและกระดุม', icon: '🪡', value: 3 },
  kevlar: { name: 'แผ่นเคฟลาร์ (หายาก)', icon: '🛡️', value: 10 },
  hide: { name: 'หนังสัตว์', icon: '🟫', value: 4 },
  ring: { name: 'แหวนเศษเหล็ก', icon: '💍', value: 20 },
  radio: { name: 'วิทยุสื่อสาร', icon: '📻', value: 0, quest: true },
  car_battery: { name: 'แบตเตอรี่รถยนต์', icon: '🔋', value: 0, quest: true },
  // ---- อุปกรณ์สัตว์เลี้ยง 5 ช่อง: หมวก ปลอกคอ ชุด อาวุธ รองเท้า ----
  pet_cap: { name: 'หมวกแก๊ปสัตว์', icon: '🧢', value: 4, petGear: { slot: 'head', def: 0.04, hp: 5, color: '#e63946' } },
  pet_helmet: { name: 'หมวกเหล็กสัตว์', icon: '⛑️', value: 9, petGear: { slot: 'head', def: 0.1, hp: 8, color: '#8d99ae' } },
  pet_bandana: { name: 'ผ้าพันคอนำโชค', icon: '🧣', value: 6, petGear: { slot: 'neck', luck: true, color: '#e63946' } },
  pet_collar: { name: 'ปลอกคอหนาม', icon: '⛓️', value: 8, petGear: { slot: 'neck', atk: 5, color: '#333' } },
  pet_bell: { name: 'ปลอกคอกระดิ่ง', icon: '🔔', value: 7, petGear: { slot: 'neck', alarm: true, hp: 5, color: '#ffd166' } },
  pet_vest: { name: 'เสื้อเกราะสัตว์', icon: '🦺', value: 10, petGear: { slot: 'body', def: 0.25, hp: 20, color: '#556b2f' } },
  pet_kevlar: { name: 'เกราะเคฟลาร์สัตว์', icon: '🛡️', value: 22, petGear: { slot: 'body', def: 0.4, hp: 35, color: '#2b2d42' } },
  pet_bag: { name: 'กระเป๋าสัมภาระสัตว์', icon: '🎒', value: 8, petGear: { slot: 'body', carry: true, color: '#8d6e4a' } },
  pet_claws: { name: 'เล็บ/จะงอยเหล็ก', icon: '🗡️', value: 12, petGear: { slot: 'weapon', atk: 9, color: '#ced4da' } },
  pet_fangs: { name: 'เขี้ยวเหล็ก', icon: '🦷', value: 18, petGear: { slot: 'weapon', atk: 14, color: '#adb5bd' } },
  pet_socks: { name: 'ปลอกเท้าผ้า', icon: '🧦', value: 3, petGear: { slot: 'feet', def: 0.03, hp: 5, color: '#f1faee' } },
  pet_boots: { name: 'รองเท้าหนังสัตว์', icon: '🥾', value: 9, petGear: { slot: 'feet', def: 0.06, hp: 12, color: '#6f4518' } },
  // ---- ฟาร์ม ตกปลา ยานพาหนะ ก่อสร้าง ----
  hammer: { name: 'ค้อนช่างไม้', icon: '🔨', value: 6, builds: true },
  wood_hammer: { name: 'ค้อนไม้', icon: '🪵', value: 3, builds: true, tool: { gather: 1, dmg: 7, range: 2.2, hammer: true } },
  stone_hammer: { name: 'ค้อนหินพื้นฐาน', icon: '🪨', value: 5, tool: { gather: 2.2, dmg: 12, range: 2.4, mine: true, hammer: true } },
  torch: { name: 'คบเพลิง', icon: '🔥', value: 4, tool: { gather: 0.5, dmg: 16, range: 2.4, light: true, fire: true }, wear: { slot: 'off', light: true, color: '#bc6c25' }, desc: 'ถือมือหลักเป็นอาวุธ หรือลากไปถือมือรองคู่กับดาบ (ส่องสว่าง)' },
  net: { name: 'แหทอดปลา', icon: '🕸️', value: 6, tool: { gather: 0.3, dmg: 1, range: 5, net: true } },
  watering_can: { name: 'บัวรดน้ำ', icon: '🚿', value: 6, tool: { gather: 0.5, dmg: 3, range: 2, water: true } },
  rod: { name: 'เบ็ดตกปลาพื้นฐาน', icon: '🎣', value: 6, tool: { gather: 1, dmg: 4, range: 2, rod: true } },
  seeds_corn: { name: 'เมล็ดข้าวโพด', icon: '🌰', value: 2 },
  seeds_veg: { name: 'เมล็ดผักบุ้ง', icon: '🫘', value: 2 },
  corn: { name: 'ข้าวโพด', icon: '🌽', value: 3, food: { hunger: 12, thirst: 2 } },
  grilled_corn: { name: 'ข้าวโพดปิ้ง', icon: '🌽', value: 6, food: { hunger: 28, hp: 3 } },
  veg: { name: 'ผักบุ้ง', icon: '🥬', value: 3, food: { hunger: 8, thirst: 5 } },
  stir_veg: { name: 'ผัดผักบุ้งไฟแดง', icon: '🥗', value: 10, food: { hunger: 32, thirst: 5, hp: 8 } },
  egg: { name: 'ไข่ไก่', icon: '🥚', value: 3, food: { hunger: 8, sick: 0.25 } },
  // ---------- ฟาร์ม: เมล็ดพันธุ์ ผลผลิต สัตว์ ผึ้ง ดอกไม้ ----------
  // อีเต้อ: ขุดก้อนหินใหญ่ได้ไวกว่าค้อน (rock = ตัวคูณพลังกับก้อนหิน)
  pickaxe: { name: 'อีเต้อหิน', icon: '⛏️', value: 8, tool: { gather: 1.5, dmg: 13, range: 2.4, mine: true, rock: 2 }, desc: 'ขุดก้อนหินใหญ่ได้ไว (2 ครั้งแตก)' },
  iron_pickaxe: { name: 'อีเต้อเหล็ก', icon: '⛏️', value: 22, tool: { gather: 2, dmg: 20, range: 2.5, mine: true, rock: 2.6 }, desc: 'ขุดหินใหญ่ทีเดียวแตก ได้หินเพิ่ม และเจอเศษเหล็กบ่อยขึ้น' },
  hoe: { name: 'จอบ', icon: '⛏️', value: 5, tool: { gather: 0.6, dmg: 6, range: 2.2 }, desc: 'พรวนดินแปลงผักก่อนปลูก (เก็บไว้ในกระเป๋าก็ใช้ได้)' },
  flower_pot: { name: 'กระถางดอกไม้', icon: '🪴', value: 5, place: 'pot', desc: 'วางแล้วปลูกดอกไม้สวยงาม เก็บดอกไปให้เพื่อนได้' },
  manure: { name: 'ปุ๋ยคอก', icon: '💩', value: 2, desc: 'ใส่แปลงผักให้โตเร็วขึ้น 30%' },
  seeds_tomato: { name: 'เมล็ดมะเขือเทศ', icon: '🫘', value: 2 }, seeds_chili: { name: 'เมล็ดพริก', icon: '🫘', value: 2 },
  seeds_potato: { name: 'หัวพันธุ์มันฝรั่ง', icon: '🥔', value: 3 }, seeds_cabbage: { name: 'เมล็ดกะหล่ำปลี', icon: '🫘', value: 2 },
  seeds_carrot: { name: 'เมล็ดแครอท', icon: '🫘', value: 2 }, seeds_eggplant: { name: 'เมล็ดมะเขือยาว', icon: '🫘', value: 2 },
  seeds_pumpkin: { name: 'เมล็ดฟักทอง', icon: '🫘', value: 3 }, seeds_watermelon: { name: 'เมล็ดแตงโม', icon: '🫘', value: 3 },
  seeds_rice: { name: 'เมล็ดพันธุ์ข้าว', icon: '🌾', value: 2, desc: 'ปลูกในนาข้าว (หมวดแปลงผัก)' },
  paddy: { name: 'ข้าวเปลือก', icon: '🌾', value: 2, desc: 'ได้จากการเกี่ยวข้าว · ต้องสีที่เครื่องสีข้าวก่อนจึงเป็นข้าวสาร' },
  rice_bran: { name: 'รำข้าว', icon: '🟫', value: 1, desc: 'ผลพลอยได้จากการสีข้าว ใช้เลี้ยงไก่ เป็ด หมู' },
  seeds_sunflower: { name: 'เมล็ดทานตะวัน', icon: '🌻', value: 3 }, seeds_marigold: { name: 'เมล็ดดาวเรือง', icon: '🌼', value: 3 },
  seeds_rose: { name: 'กิ่งพันธุ์กุหลาบ', icon: '🌹', value: 5 }, seeds_orchid: { name: 'หน่อกล้วยไม้', icon: '🪻', value: 6 },
  seeds_jasmine: { name: 'กิ่งพันธุ์มะลิ', icon: '🤍', value: 4 }, seeds_tulip: { name: 'หัวพันธุ์ทิวลิป', icon: '🌷', value: 6 },
  tomato: { name: 'มะเขือเทศ', icon: '🍅', value: 3, food: { hunger: 6, thirst: 8 } },
  chili: { name: 'พริก', icon: '🌶️', value: 2, food: { hunger: 1, thirst: -6, stress: -3 } },
  potato: { name: 'มันฝรั่ง', icon: '🥔', value: 3, food: { hunger: 6, sick: 0.1 } },
  baked_potato: { name: 'มันฝรั่งอบ', icon: '🥔', value: 6, food: { hunger: 22, hp: 3 } },
  cabbage: { name: 'กะหล่ำปลี', icon: '🥬', value: 3, food: { hunger: 8, thirst: 6 } },
  carrot: { name: 'แครอท', icon: '🥕', value: 3, food: { hunger: 7, thirst: 3 } },
  eggplant: { name: 'มะเขือยาว', icon: '🍆', value: 3, food: { hunger: 6, thirst: 4 } },
  pumpkin: { name: 'ฟักทอง', icon: '🎃', value: 5, food: { hunger: 10 } },
  watermelon: { name: 'แตงโม', icon: '🍉', value: 5, food: { hunger: 8, thirst: 30 } },
  rice: { name: 'ข้าวสาร', icon: '🍚', value: 3, desc: 'หุงที่กองไฟก่อนกิน' },
  cooked_rice: { name: 'ข้าวสวย', icon: '🍚', value: 6, food: { hunger: 28 } },
  duck_egg: { name: 'ไข่เป็ด', icon: '🥚', value: 4, food: { hunger: 9, sick: 0.25 } },
  milk: { name: 'นมวัวสด', icon: '🥛', value: 5, food: { hunger: 8, thirst: 20, hp: 3 } },
  pork: { name: 'เนื้อหมูดิบ', icon: '🥓', value: 5, food: { hunger: 10, sick: 0.35 } },
  beef: { name: 'เนื้อวัวดิบ', icon: '🥩', value: 6, food: { hunger: 10, sick: 0.35 } },
  grilled_pork: { name: 'หมูย่าง', icon: '🍖', value: 10, food: { hunger: 40, hp: 8 } },
  steak: { name: 'สเต็กเนื้อ', icon: '🥩', value: 12, food: { hunger: 45, hp: 10 } },
  omelet: { name: 'ไข่เจียวมะเขือเทศ', icon: '🍳', value: 10, food: { hunger: 32, hp: 5 } },
  somtam: { name: 'ส้มตำ', icon: '🥗', value: 10, food: { hunger: 25, thirst: 10, stress: -8 } },
  pumpkin_soup: { name: 'ซุปฟักทอง', icon: '🍲', value: 12, food: { hunger: 35, thirst: 15, hp: 6 } },
  beef_stew: { name: 'สตูว์เนื้อ', icon: '🍲', value: 22, food: { hunger: 65, thirst: 10, hp: 18 } },
  pad_kaprao_pork: { name: 'ข้าวกะเพราหมูไข่ดาว', icon: '🍛', value: 22, food: { hunger: 70, hp: 15, stress: -12 } },
  honey: { name: 'น้ำผึ้ง', icon: '🍯', value: 8, food: { hunger: 10, hp: 4, stress: -4 } },
  beeswax: { name: 'ไขผึ้ง', icon: '🟨', value: 4 },
  honey_orange: { name: 'น้ำส้มผสมน้ำผึ้ง', icon: '🧃', value: 12, food: { thirst: 35, hp: 6, infection: -4 }, returns: 'bottle' },
  honey_herb: { name: 'ยาสมุนไพรน้ำผึ้ง', icon: '🧪', value: 14, food: { hp: 25, infection: -12, sick: -1 } },
  honey_pork: { name: 'หมูทอดน้ำผึ้ง', icon: '🍖', value: 16, food: { hunger: 50, hp: 12, stress: -6 } },
  candle: { name: 'เทียนไขผึ้ง', icon: '🕯️', value: 8, desc: 'ของขวัญที่หอมละมุน (พระสงฆ์ชอบ)' },
  // ดอกไม้: มอบให้เพื่อน/ผู้เล่นอื่นเพื่อเพิ่มความสัมพันธ์มาก
  sunflower: { name: 'ดอกทานตะวัน', icon: '🌻', value: 6, flower: true },
  marigold: { name: 'ดอกดาวเรือง', icon: '🌼', value: 5, flower: true },
  rose: { name: 'ดอกกุหลาบ', icon: '🌹', value: 10, flower: true },
  orchid: { name: 'ดอกกล้วยไม้', icon: '🪻', value: 12, flower: true },
  jasmine: { name: 'ดอกมะลิ', icon: '🤍', value: 7, flower: true },
  tulip: { name: 'ดอกทิวลิป', icon: '🌷', value: 11, flower: true },
  bouquet: { name: 'ช่อดอกไม้', icon: '💐', value: 30, flower: true, desc: 'ของขวัญสุดพิเศษ เพิ่มความสัมพันธ์มาก' },
  garland: { name: 'พวงมาลัยมะลิ', icon: '📿', value: 20, flower: true, desc: 'มอบให้ผู้ใหญ่หรือพระสงฆ์' },
  // สัตว์มีชีวิตที่จับจากกรง (หิ้วไปปล่อยเข้าคอก)
  duck_feather: { name: 'ขนเป็ด', icon: '🪶', value: 2, desc: 'ได้จากเล้าเป็ด ใช้ตัดเย็บชุดขนเป็ดอบอุ่นเบาสบาย' },
  down_jacket: { name: 'แจ็กเก็ตขนเป็ด', icon: '🧥', value: 22, wear: { slot: 'body', warm: 0.55, def: 0.08, stam: 0.1, spd: 0.03, color: '#f1faee' }, desc: 'เบา อุ่น วิ่งได้นานขึ้น' },
  down_hat: { name: 'หมวกขนเป็ด', icon: '🪶', value: 9, wear: { slot: 'head', warm: 0.15, def: 0.03, stam: 0.04, color: '#e9ecef' } },
  down_gloves: { name: 'ถุงมือบุขนเป็ด', icon: '🧤', value: 10, wear: { slot: 'hands', warm: 0.12, gather: 0.4, stam: 0.03, color: '#dee2e6' } },
  down_socks: { name: 'ถุงเท้าขนเป็ด', icon: '🧦', value: 7, wear: { slot: 'socks', warm: 0.12, stam: 0.06, spd: 0.02, color: '#f8f9fa' } },
  feather_pillow: { name: 'หมอนขนเป็ด', icon: '🛏️', value: 12, desc: 'ของขวัญนุ่มนิ่ม เพื่อนชอบมาก' },
  arrow_feather: { name: 'ลูกธนูหางขนเป็ด', icon: '➶', value: 3, ammo: { g: 'arrow', dmg: 9, tier: 3 } },
  live_chicken: { name: 'ไก่ป่ามีชีวิต (กรงหิ้ว)', icon: '🐓', value: 8, live: 'coop', desc: 'นำไปปล่อยที่เล้าไก่ (เปิดคอกแล้วกดปล่อย)' },
  live_duck: { name: 'เป็ดมีชีวิต (กรงหิ้ว)', icon: '🦆', value: 9, live: 'duckpen', desc: 'นำไปปล่อยที่เล้าเป็ด' },
  live_boar: { name: 'หมูป่ามีชีวิต (กรงหิ้ว)', icon: '🐗', value: 14, live: 'pigpen', desc: 'นำไปปล่อยที่คอกหมู' },
  // เงินตรา
  // ⚒️ ตีบวก & ส่องออฟชั่น
  plus_stone: { name: 'เหล็กพลัส', icon: '🔹', value: 25, desc: 'ใช้ตีบวกอาวุธ/ชุด +1 ถึง +8 · ดรอปจากมอนสเตอร์และกล่อง' },
  pet_pin: { name: 'พินสูง', icon: '📌', value: 15, desc: 'ใช้ตีบวกอุปกรณ์สัตว์เลี้ยง +1 ถึง +3 · ซื้อในร้านเงินจิ' },
  super_stone: { name: 'หินซุปเปอร์', icon: '💠', value: 80, desc: 'ใช้ตีบวก +9 และ +10 · ผสมจากเหล็กพลัส 3 ก้อน' },
  shop_plus_stone: { name: 'เหล็กพลัส (ร้านค้า)', icon: '🔷', value: 10, desc: 'เหล็กพลัสจากร้านเงินจิ ใช้แทนเหล็กพลัสได้ แต่โอกาสตีบวกสำเร็จต่ำกว่า (-30%)' },
  shop_super_stone: { name: 'หินซุปเปอร์ (ร้านค้า)', icon: '🔶', value: 30, desc: 'หินซุปเปอร์จากร้านเงินจิ ใช้ตีบวก +9/+10 แต่โอกาสสำเร็จต่ำกว่า (-30%)' },
  magnifier: { name: 'แว่นขยายส่องออฟชั่น', icon: '🔍', value: 40, coinOnly: true, desc: 'ส่องอาวุธ/ชุดเพื่อเปิดออฟชั่นพิเศษ 1–3 อย่าง (ส่องใหม่ = สุ่มใหม่) · ซื้อในร้านเงินจิ' },
  name_tag: { name: 'ป้ายเปลี่ยนชื่อสัตว์เลี้ยง', icon: '🏷️', value: 30, coinOnly: true, desc: 'ตั้งชื่อสัตว์เลี้ยงใหม่ได้ 1 ครั้ง · ซื้อในร้านเงินจิ' },
  respec_potion: { name: 'ยาล้างแต้มสเตตัส', icon: '🔄', value: 250, coinOnly: true, respec: true, desc: 'คืนแต้มสเตตัสสายอาชีพทั้งหมด ให้กระจายใหม่ได้ (ซื้อด้วยเงินจิเท่านั้น)' },
  jicoin: { name: 'เงินจิ (Ji-Coin)', icon: '🪙', value: 1, coin: true, desc: 'สกุลเงินของผู้รอดชีวิต ใช้ซื้อขายกับ NPC แผงขายของ และผู้เล่นอื่น' },

  fried_egg: { name: 'ไข่เจียว', icon: '🍳', value: 8, food: { hunger: 26, hp: 5 } },
  crab: { name: 'ปูม้า', icon: '🦀', value: 6, food: { hunger: 8, sick: 0.35 } },
  steamed_crab: { name: 'ปูนึ่ง', icon: '🦀', value: 12, food: { hunger: 30, hp: 10 } },
  squid: { name: 'ปลาหมึก', icon: '🦑', value: 6, food: { hunger: 8, sick: 0.3 } },
  grilled_squid: { name: 'ปลาหมึกย่าง', icon: '🍢', value: 10, food: { hunger: 26, hp: 6 } },
  prawn: { name: 'กุ้งก้ามกราม', icon: '🦐', value: 8, food: { hunger: 8, sick: 0.3 } },
  grilled_prawn: { name: 'กุ้งเผา', icon: '🦐', value: 14, food: { hunger: 30, hp: 10 } },
  big_fish: { name: 'ปลากะพงตัวใหญ่', icon: '🐠', value: 10, food: { hunger: 15, sick: 0.3 } },
  grilled_big_fish: { name: 'ปลากะพงเผาเกลือ', icon: '🐟', value: 16, food: { hunger: 50, hp: 10 } },
  golden_fish: { name: 'ปลาทอง (หายาก)', icon: '🐡', value: 25 },
  fuel: { name: 'น้ำมันเชื้อเพลิง', icon: '⛽', value: 5 },
  bicycle: { name: 'จักรยาน', icon: '🚲', value: 20, place: 'vehicle', vt: 'bicycle' },
  motorbike: { name: 'มอเตอร์ไซค์', icon: '🏍️', value: 40, place: 'vehicle', vt: 'motorbike' },
  raft: { name: 'แพไม้ไผ่', icon: '🛶', value: 20, place: 'vehicle', vt: 'raft' },
  campfire: { name: 'กองไฟ', icon: '🔥', value: 6, place: 'campfire' },
  watchtower: { name: 'หอสังเกตการณ์', icon: '🗼', value: 25, place: 'watchtower' },
  shelter: { name: 'เพิงพัก', icon: '⛺', value: 20, place: 'shelter' },
  // ---------- ของประจำท้องถิ่น ----------
  durian: { name: 'ลูกทุเรียน', icon: '🟢', value: 12, food: { hunger: 30, hp: 6, happy: 2 }, desc: 'ราชาผลไม้จากบ่อทอง/หนองใหญ่ กินสด หรือแปรรูปเป็นทุเรียนทอด/ข้าวเหนียวทุเรียน' },
  durian_chips: { name: 'ทุเรียนทอดกรอบ', icon: '🍟', value: 16, food: { hunger: 28, hp: 8, happy: 3 } },
  durian_sticky_rice: { name: 'ข้าวเหนียวทุเรียน', icon: '🍚', value: 24, food: { hunger: 55, hp: 14, happy: 5 } },
  bamboo: { name: 'ลำไม้ไผ่', icon: '🎋', value: 1, desc: 'ตัดจากกอไผ่ (พนัสนิคม บ้านบึง พานทอง) ใช้จักสานและทำผนังไม้ไผ่' },
  wildflower: { name: 'ดอกไม้สวยงาม', icon: '🌸', value: 3, flower: true, desc: 'เก็บจากสวนดอกไม้บางละมุง ใช้คราฟท์มงกุฎดอกไม้ พวงมาลัย น้ำหอม' },
  flower_crown: { name: 'มงกุฎดอกไม้', icon: '👑', value: 14, wear: { slot: 'head', warm: 0.03, color: '#ff8fab' }, desc: 'สวมแล้วสดชื่น · มอบเป็นของขวัญได้' },
  flower_garland: { name: 'พวงมาลัยดอกไม้', icon: '💮', value: 12, flower: true, desc: 'ของขวัญที่ทุกคนชอบ' },
  perfume: { name: 'น้ำหอมดอกไม้', icon: '🧴', value: 18, food: { hunger: 0, happy: 6 }, desc: 'ฉีดแล้วอารมณ์ดี ความสุข +6' },
  wool: { name: 'ขนแกะ', icon: '🧶', value: 3, desc: 'ตัดจากแกะในคอกแกะ ใช้ทอเสื้อไหมพรมอบอุ่น' },
  wool_sweater: { name: 'เสื้อไหมพรมขนแกะ', icon: '🧥', value: 20, wear: { slot: 'body', warm: 0.5, def: 0.06, color: '#f1e3d3' } },
  wool_hat: { name: 'หมวกไหมพรม', icon: '🧶', value: 8, wear: { slot: 'head', warm: 0.18, color: '#e5989b' } },
  buffalo_milk: { name: 'นมควาย', icon: '🥛', value: 6, food: { hunger: 10, thirst: 18, hp: 4 } },
  live_buffalo: { name: 'ควายมีชีวิต (เชือกจูง)', icon: '🐃', value: 30, live: 'buffalopen', desc: 'นำไปปล่อยที่คอกควาย' },
  live_sheep: { name: 'แกะมีชีวิต (เชือกจูง)', icon: '🐑', value: 16, live: 'sheeppen', desc: 'นำไปปล่อยที่คอกแกะ' },
  // งานจักสาน (เรียนจากยายแวว ตลาดจักสานพนัสนิคม)
  wicker_basket: { name: 'ตะกร้าจักสาน', icon: '🧺', value: 12, wear: { slot: 'back', carry: 16, lvl: 1, color: '#c8a165' }, desc: 'สะพายหลัง ใส่ของได้เพิ่ม 16 ช่อง' },
  chalom: { name: 'ชะลอมใส่ของ', icon: '🧺', value: 8, wear: { slot: 'off', carry: 8, color: '#d4a373' }, desc: 'หิ้วมือซ้าย ใส่ของได้เพิ่ม 8 ช่อง' },
  hand_fan: { name: 'พัดสาน', icon: '🪭', value: 6, fan: true, desc: 'โบกลดความร้อนในร่างกาย (ใช้ได้เรื่อย ๆ ไม่หมด)' },
  // ตำราจากมหาวิทยาลัยร้างศรีราชา: อ่านแล้วได้ความรู้ (ค่าประสบการณ์ทักษะ / ปลดล็อกสูตร)
  book_med: { name: 'ตำราแพทยศาสตร์', icon: '📕', value: 20, book: { skill: 'medicine', xp: 220 }, desc: 'อ่านแล้วทักษะการแพทย์ +220 XP' },
  book_eng: { name: 'ตำราวิศวกรรม', icon: '📘', value: 20, book: { skill: 'crafting', xp: 220 }, desc: 'อ่านแล้วทักษะประดิษฐ์ +220 XP' },
  book_agri: { name: 'ตำราเกษตรศาสตร์', icon: '📗', value: 18, book: { skill: 'farming', xp: 220 }, desc: 'อ่านแล้วทักษะเพาะปลูก +220 XP' },
  book_cs: { name: 'ตำราคอมพิวเตอร์', icon: '💻', value: 22, book: { skill: 'tech', xp: 220 }, desc: 'อ่านแล้วทักษะเทคโนโลยี +220 XP' },
  book_elec: { name: 'ตำราวิศวกรรมไฟฟ้า', icon: '📙', value: 22, book: { skill: 'electric', xp: 220 }, desc: 'อ่านแล้วทักษะไฟฟ้า +220 XP' },
  book_cook: { name: 'ตำราอาหารไทย', icon: '📒', value: 16, book: { skill: 'cooking', xp: 200 }, desc: 'อ่านแล้วทักษะทำอาหาร +200 XP' },
  book_wicker: { name: 'คู่มือหัตถกรรมจักสาน', icon: '📜', value: 30, book: { skill: 'crafting', xp: 60, learn: 'wicker' }, desc: 'อ่านแล้วปลดล็อกสูตรจักสานทั้งหมด' },
  lab_kit: { name: 'ชุดอุปกรณ์แล็บ', icon: '🧪', value: 14, desc: 'วัสดุจากห้องแล็บ ใช้ทำยาขั้นสูง' },
  // ยุทธภัณฑ์ฐานทัพเรือ
  navy_uniform: { name: 'ชุดทหารเรือ', icon: '🥋', value: 26, wear: { slot: 'body', warm: 0.15, def: 0.2, bite: 0.25, color: '#1d3557' } },
  combat_boots: { name: 'รองเท้าคอมแบท', icon: '🥾', value: 18, wear: { slot: 'shoes', warm: 0.08, spd: 0.07, def: 0.07, bite: 0.12, color: '#212529' } },
  admiral_medal: { name: 'เหรียญกล้าหาญผู้บัญชาการ', icon: '🎖️', value: 80, desc: 'ได้จากการปราบผู้บัญชาการผู้ติดเชื้อ ฐานทัพเรือสัตหีบ' },
};

// ---------- ของสุ่มสเตตัส (ความหายาก) ----------
// ไอเท็มสวมใส่/เครื่องมือ/อุปกรณ์สัตว์ที่ได้จากการคราฟท์หรือดรอป อาจได้ระดับพิเศษ เก็บเป็นคีย์ "ชื่อ~ระดับเลขสุ่ม" เช่น spear~R7
// ระดับสูงขึ้น = ค่าพลังคูณเพิ่ม + โบนัสสุ่ม 1 อย่าง · คีย์เดียวกันได้ค่าเดิมเสมอ (ทุกเครื่องคำนวณตรงกัน)
export const RARITY = {
  U: { name: 'ดี', mul: 1.12, color: '#52b788' }, R: { name: 'หายาก', mul: 1.25, color: '#4cc9f0' },
  E: { name: 'มหากาพย์', mul: 1.45, color: '#c77dff' }, L: { name: 'ตำนาน', mul: 1.7, color: '#ffd60a' },
};
export const baseOf = (k) => String(k).split('~')[0];
// รหัสไอเท็มพิเศษ: "ชื่อ~[ระดับ][เลขสุ่ม][+ตีบวก][*ออฟชั่น]" เช่น sword~R7+6*d3s1 · ระดับ N = ธรรมดา
const VCODE = /^([NUREL])([0-9a-z]*)(?:\+(\d{1,2}))?(?:\*([a-z1-9]{2,6}))?$/;
export function parseKey(k) {
  const [base, code] = String(k).split('~'); const m = code ? VCODE.exec(code) : null;
  return { base, tier: m ? m[1] : 'N', seed: m ? m[2] : '', plus: m ? +(m[3] || 0) : 0, opts: m ? m[4] || '' : '' };
}
export function makeKey({ base, tier = 'N', seed = '', plus = 0, opts = '' }) {
  if (tier === 'N' && !plus && !opts) return base;
  return `${base}~${tier}${seed || (tier === 'N' ? '0' : '')}${plus ? '+' + plus : ''}${opts ? '*' + opts : ''}`;
}
export const plusOf = (k) => parseKey(k).plus;
// ⚒️ ตีบวก: อาวุธ/เครื่องมือ/ชุด +1 ถึง +10 · อุปกรณ์สัตว์เลี้ยง +1 ถึง +3
export const PLUS_MAX = 10, PET_PLUS_MAX = 3;
export const gearKind = (k) => { const it = RAW_ITEMS[baseOf(k)]; if (!it || it.quest) return null; if (it.petGear) return 'pet'; if (it.wear || (it.tool && (it.tool.dmg || it.tool.gather))) return 'gear'; return null; };
// ตัวคูณค่าพลังตามระดับตีบวก (+1–5 ทีละ 5% · +6–8 ทีละ 8% · +9–10 ทีละ 12% · สัตว์เลี้ยงทีละ 12%)
export const plusMul = (n, pet) => 1 + (pet ? n * 0.12 : Math.min(n, 5) * 0.05 + Math.max(0, Math.min(n, 8) - 5) * 0.08 + Math.max(0, n - 8) * 0.12);
// ออฟชั่นที่ส่องได้ (ตัวอักษร = ชนิด · ตัวเลข 1–5 = ความแรง)
export const OPTS = {
  tool: { d: ['dmg', 'ดาเมจ', (B, m) => +((B.tool.dmg || 6) * 0.04 * m).toFixed(2)], r: ['range', 'ระยะโจมตี', (B, m) => +(0.08 * m).toFixed(2)], g: ['gather', 'เก็บของ', (B, m) => +(0.15 * m).toFixed(2)] },
  wear: { f: ['def', 'ลดดาเมจ', (B, m) => +(0.012 * m).toFixed(3)], b: ['bite', 'กันติดเชื้อ', (B, m) => +(0.015 * m).toFixed(3)], s: ['spd', 'ความเร็ว', (B, m) => +(0.01 * m).toFixed(3)], t: ['stam', 'ฟื้นสตามิน่า', (B, m) => +(0.04 * m).toFixed(3)], w: ['warm', 'กันหนาว', (B, m) => +(0.03 * m).toFixed(3)] },
};
// โอกาสตีบวกจากระดับ L → L+1: { up, stay, down, brk } (รวม = 1)
// ชุด/อาวุธ: +1–+5 ปลอดภัย (ไม่สำเร็จ = คงเดิม) · +6–+8 คงที่/+1/-1 · +9–+10 แตกหาย/+1/-1
// อุปกรณ์สัตว์เลี้ยง: +1 ปลอดภัย · +2 คงที่/+1/-1 · +3 แตกหาย/+1/-1
export function enhanceRates(L, pet, ch) {
  let r;
  if (pet) r = L === 0 ? { up: 1 } : L === 1 ? { up: 0.55, stay: 0.3, down: 0.15 } : { up: 0.4, down: 0.35, brk: 0.25 };
  else if (L < 5) r = { up: [1, 0.95, 0.9, 0.85, 0.8][L], stay: [0, 0.05, 0.1, 0.15, 0.2][L] };
  else if (L < 8) r = { up: [0.6, 0.5, 0.4][L - 5], stay: [0.25, 0.3, 0.35][L - 5], down: [0.15, 0.2, 0.25][L - 5] };
  else r = { up: [0.35, 0.25][L - 8], down: [0.35, 0.4][L - 8], brk: [0.3, 0.35][L - 8] };
  r = { up: 0, stay: 0, down: 0, brk: 0, ...r };
  // ช่างตีเหล็ก: Lv2 สำเร็จ +8% · Lv3 +6–+8 ไม่ลดระดับ และโอกาสแตกลดครึ่ง
  if (ch && hasPerk(ch, 'blacksmith', 1) && r.up < 1) { const b = Math.min(0.08, r.down + r.brk + r.stay); r.up += b; let left = b; for (const f of ['brk', 'down', 'stay']) { const t = Math.min(left, r[f]); r[f] -= t; left -= t; } }
  if (ch && hasPerk(ch, 'blacksmith', 2)) { if (!pet && L >= 5 && L < 8) { r.stay += r.down; r.down = 0; } const h = r.brk / 2; r.brk -= h; r.down += h; }
  return r;
}
// อุปกรณ์สัตว์เลี้ยงใช้พินสูง · ชุด/อาวุธ +1–+8 ใช้เหล็กพลัส · +9–+10 ใช้หินซุปเปอร์ (shop = ของจากร้านเงินจิ)
export const enhanceStone = (L, pet, shop) => (pet ? 'pet_pin' : (shop ? 'shop_' : '') + (L >= 8 ? 'super_stone' : 'plus_stone'));
// 🔷 หินจากร้านเงินจิ: โอกาสสำเร็จลดลง 30% (ส่วนที่หายไปกลายเป็นคงเดิม/ลดระดับ/แตก ตามช่วง)
export function shopPenalty(r, L, pet) {
  const cut = r.up * 0.3; r = { ...r, up: r.up - cut };
  if ((pet && L === 0) || (!pet && L < 5)) r.stay += cut;
  else if (r.brk) { r.down += cut / 2; r.brk += cut / 2; } else { r.stay += cut / 2; r.down += cut / 2; }
  return r;
}
// ค่าจ้างช่างตีเหล็ก NPC (คนที่ไม่ใช่ช่างตีเหล็ก)
// ค่าจ้างรวมค่าวัสดุแล้ว (จ้าง NPC ไม่ต้องเตรียมหินไปเอง)
export const enhanceFee = (L, pet) => (pet ? 45 + L * 25 : 45 + L * 15 + (L >= 8 ? 180 : 0));
// 🤝 ขายของ/แลกกับผู้เล่น: ชุดและอุปกรณ์ต้องเป็นระดับหายากขึ้นไป หรือตีบวกเกิน +5 (อุปกรณ์สัตว์เลี้ยง +2 ขึ้นไป)
export function tradeable(k) {
  const kind = gearKind(k); if (!kind) return true;
  const K = parseKey(k); if ('REL'.includes(K.tier) && K.tier !== 'N') return true;
  return kind === 'pet' ? K.plus >= 2 : K.plus > 5;
}
export const TRADE_RULE = 'ชุด/อาวุธ/อุปกรณ์ต้องเป็น ★หายาก ขึ้นไป หรือตีบวก +6 ขึ้นไป (อุปกรณ์สัตว์เลี้ยง +2 ขึ้นไป) จึงจะแลก/วางขายได้';
// 🪙 ของที่ซื้อได้ในร้านเงินจิ
export const COIN_GOODS = [['shop_plus_stone', 50], ['shop_super_stone', 180], ['pet_pin', 40], ['magnifier', 80], ['name_tag', 60]];
export const PLUS_GLOW = { 6: '#4cc9f0', 7: '#52b788', 8: '#c77dff', 9: '#ff9f1c', 10: '#ffd60a' };
const SCALE = { tool: ['dmg', 'gather'], wear: ['def', 'bite', 'spd', 'stam', 'block', 'gather'], petGear: ['atk', 'def', 'hp'] };
const BONUS = {
  tool: [['dmg', 0.12, 'ดาเมจ'], ['range', 0.35, 'ระยะ'], ['gather', 0.6, 'เก็บของ']],
  wear: [['def', 0.03, 'ลดดาเมจ'], ['spd', 0.03, 'ความเร็ว'], ['stam', 0.1, 'สตามิน่า'], ['bite', 0.05, 'กันติดเชื้อ']],
  petGear: [['atk', 3, 'โจมตี'], ['def', 0.04, 'ป้องกัน'], ['hp', 8, 'พลังชีวิต']],
};
const variantCache = new Map();
function makeVariant(key) {
  if (variantCache.has(key)) return variantCache.get(key);
  const K = parseKey(key), base = K.base, B = RAW_ITEMS[base], R = RARITY[K.tier];
  if (!B || (!R && K.tier !== 'N') || !VCODE.test(key.split('~')[1] || '')) return undefined;
  const seed = parseInt(K.seed, 36) || 0, it = JSON.parse(JSON.stringify(B));
  it.base = base; it.name = B.name; it.value = B.value || 1;
  if (R) { it.rarity = K.tier; it.name = `${B.name} ★${R.name}`; it.value = Math.round((B.value || 1) * R.mul * 1.6); }
  for (const part of ['tool', 'wear', 'petGear']) {
    if (!it[part]) continue;
    if (R) {
      for (const f of SCALE[part]) if (typeof it[part][f] === 'number' && it[part][f] > 0) it[part][f] = +(it[part][f] * R.mul).toFixed(3);
      const [f, amt, label] = BONUS[part][seed % BONUS[part].length], extra = +(amt * (part === 'tool' && f === 'dmg' ? (B.tool.dmg || 6) : 1) * (1 + 'URE L'.indexOf(K.tier) * 0.5)).toFixed(3);
      it[part][f] = +((it[part][f] || 0) + extra).toFixed(3); it.bonus = `+${label}`;
    }
    // ⚒️ ตีบวก: ค่าพลังหลักคูณเพิ่มตามระดับ
    if (K.plus) { const mul = plusMul(K.plus, part === 'petGear'); for (const f of SCALE[part]) if (typeof it[part][f] === 'number' && it[part][f] > 0) it[part][f] = +(it[part][f] * mul).toFixed(3); }
    // 🔍 ออฟชั่นจากแว่นขยาย
    const O = OPTS[part];
    if (O && K.opts) { it.opts = []; for (let i = 0; i + 1 < K.opts.length; i += 2) { const d = O[K.opts[i]], m = +K.opts[i + 1]; if (!d || !(m >= 1 && m <= 5)) continue; const v = d[2](B, m); it[part][d[0]] = +((it[part][d[0]] || 0) + v).toFixed(3); it.opts.push(`${d[1]} +${d[0] === 'dmg' || d[0] === 'range' || d[0] === 'gather' ? v : Math.round(v * 100) + '%'}`); } }
  }
  if (K.plus) { it.plus = K.plus; it.name += ` +${K.plus}`; it.value = Math.round(it.value * (1 + K.plus * 0.35)); }
  if (K.opts) it.value = Math.round(it.value * 1.3);
  variantCache.set(key, it); return it;
}
export const ITEMS = new Proxy(RAW_ITEMS, {
  get: (t, k) => (typeof k === 'string' && k.includes('~') ? makeVariant(k) : t[k]),
  has: (t, k) => (typeof k === 'string' && k.includes('~') ? !!makeVariant(k) : k in t),
});
// สุ่มความหายากให้ของที่ได้ (luck = โอกาสเพิ่ม เช่น กล่องหายาก/บอส)
export function rollVariant(k, rand, luck = 0) {
  const it = RAW_ITEMS[k]; if (!it || !(it.tool || it.wear || it.petGear) || it.quest) return k;
  const r = rand() * (1 - luck);
  const tier = r < 0.01 ? 'L' : r < 0.05 ? 'E' : r < 0.15 ? 'R' : r < 0.38 ? 'U' : null;
  return tier ? `${k}~${tier}${Math.floor(rand() * 1296).toString(36)}` : k;
}
export function rollVariants(give, rand, luck = 0) {
  const out = {};
  for (const [k, q] of Object.entries(give || {})) for (let i = 0; i < q; i++) { const v = rollVariant(k, rand, luck); out[v] = (out[v] || 0) + 1; }
  return out;
}

// station: 'fire' = ต้องอยู่ใกล้กองไฟ
export const RECIPES = [
  // วัตถุดิบที่เก็บด้วยมือเปล่าต้องแปรรูปก่อนจึงใช้คราฟท์ได้
  { out: 'wood', need: { twig: 2 }, skill: 'crafting', lvl: 1, label: 'ไม้ (มัดจากกิ่งไม้แห้ง)' },
  { out: 'stone', qty: 2, need: { pebble: 3 }, skill: 'crafting', lvl: 1, label: 'หิน ×2 (ทุบแต่งจากก้อนหินดิบ)' },
  { out: 'fiber', qty: 2, need: { raw_fiber: 3 }, skill: 'crafting', lvl: 1, label: 'เส้นใยพืช ×2 (ฟั่นจากต้นหญ้าดิบ)' },
  { out: 'stone_axe', need: { wood: 3, stone: 2, fiber: 2 }, skill: 'crafting', lvl: 1 },
  { out: 'spear', need: { wood: 4, fiber: 2 }, skill: 'crafting', lvl: 1 },
  { out: 'bottle', need: { wood: 2 }, skill: 'crafting', lvl: 1, label: 'กระบอกไม้ไผ่ (ขวด)' },
  { out: 'campfire', need: { wood: 5, stone: 3 }, skill: 'crafting', lvl: 1 },
  // ฟาร์ม
  { out: 'pickaxe', need: { wood: 2, stone: 4, fiber: 2 }, skill: 'crafting', lvl: 1, label: 'อีเต้อหิน (ขุดหินใหญ่ไว ×2)' },
  { out: 'iron_pickaxe', need: { scrap: 5, wood: 2, hide: 1 }, skill: 'crafting', lvl: 3, station: 'fire', label: 'อีเต้อเหล็ก (ขุดหินใหญ่ทีเดียวแตก · ตีที่กองไฟ)' },
  { out: 'hoe', need: { wood: 2, stone: 2 }, skill: 'farming', lvl: 1, label: 'จอบ (พรวนดินแปลงผัก)' },
  { out: 'flower_pot', need: { stone: 3, fiber: 1 }, skill: 'crafting', lvl: 1, label: 'กระถางดอกไม้ (ปลูกดอกไม้สวยงาม)' },
  { out: 'cooked_rice', need: { rice: 2, clean_water: 1 }, skill: 'cooking', lvl: 1, station: 'fire', keepBottle: true },
  { out: 'baked_potato', need: { potato: 1 }, skill: 'cooking', lvl: 1, station: 'fire' },
  { out: 'grilled_pork', need: { pork: 1 }, skill: 'cooking', lvl: 1, station: 'fire' },
  { out: 'steak', need: { beef: 1 }, skill: 'cooking', lvl: 1, station: 'fire' },
  { out: 'omelet', need: { egg: 2, tomato: 1 }, skill: 'cooking', lvl: 1, station: 'fire' },
  { out: 'omelet', need: { duck_egg: 2, tomato: 1 }, skill: 'cooking', lvl: 1, station: 'fire', label: 'ไข่เจียวไข่เป็ด' },
  { out: 'somtam', need: { tomato: 1, chili: 1, carrot: 1 }, skill: 'cooking', lvl: 2 },
  { out: 'pumpkin_soup', need: { pumpkin: 1, milk: 1 }, skill: 'cooking', lvl: 2, station: 'fire' },
  { out: 'beef_stew', need: { beef: 1, potato: 1, carrot: 1, clean_water: 1 }, skill: 'cooking', lvl: 3, station: 'fire', keepBottle: true },
  { out: 'pad_kaprao_pork', need: { pork: 1, chili: 1, cooked_rice: 1, egg: 1 }, skill: 'cooking', lvl: 2, station: 'fire' },
  { out: 'honey_orange', need: { honey: 1, orange: 2, bottle: 1 }, skill: 'cooking', lvl: 1 },
  { out: 'honey_herb', need: { honey: 1, herb: 2 }, skill: 'medicine', lvl: 2 },
  { out: 'honey_pork', need: { honey: 1, pork: 1 }, skill: 'cooking', lvl: 2, station: 'fire' },
  { out: 'candle', need: { beeswax: 2, fiber: 1 }, skill: 'crafting', lvl: 1 },
  { out: 'bouquet', need: { rose: 2, jasmine: 1, fiber: 1 }, skill: 'crafting', lvl: 1, label: 'ช่อดอกไม้ (กุหลาบ+มะลิ)' },
  { out: 'bouquet', need: { tulip: 1, orchid: 1, sunflower: 1, fiber: 1 }, skill: 'crafting', lvl: 1, label: 'ช่อดอกไม้รวม' },
  { out: 'garland', need: { jasmine: 4, fiber: 1 }, skill: 'crafting', lvl: 1 },
  // เก็บเมล็ดพันธุ์จากผลผลิต
  { out: 'seeds_tomato', need: { tomato: 1 }, skill: 'farming', lvl: 1, qty: 2, label: 'แกะเมล็ดมะเขือเทศ' },
  { out: 'seeds_chili', need: { chili: 2 }, skill: 'farming', lvl: 1, qty: 2, label: 'แกะเมล็ดพริก' },
  { out: 'seeds_potato', need: { potato: 1 }, skill: 'farming', lvl: 1, qty: 1, label: 'เก็บหัวพันธุ์มันฝรั่ง' },
  { out: 'seeds_pumpkin', need: { pumpkin: 1 }, skill: 'farming', lvl: 1, qty: 3, label: 'แกะเมล็ดฟักทอง' },
  { out: 'seeds_watermelon', need: { watermelon: 1 }, skill: 'farming', lvl: 1, qty: 3, label: 'แกะเมล็ดแตงโม' },
  { out: 'seeds_sunflower', need: { sunflower: 1 }, skill: 'farming', lvl: 1, qty: 2, label: 'เก็บเมล็ดทานตะวัน' },
  { out: 'super_stone', need: { plus_stone: 3 }, skill: 'crafting', lvl: 1, label: 'หินซุปเปอร์ (ผสมเหล็กพลัส 3 ก้อน · ช่างตีเหล็ก Lv2 ใช้ 2 ก้อน)' },
  { out: 'seeds_rice', need: { paddy: 2 }, skill: 'farming', lvl: 1, qty: 2, label: 'คัดข้าวเปลือกไว้ทำพันธุ์ ×2' },
  { out: 'rice', need: { paddy: 3 }, skill: 'farming', lvl: 1, qty: 2, station: 'mill', label: 'สีข้าวเปลือกเป็นข้าวสาร ×2 (+รำข้าว) · ที่เครื่องสีข้าว' },
  { out: 'bandage', need: { cloth: 2 }, skill: 'medicine', lvl: 1 },
  { out: 'bandage', need: { fiber: 6 }, skill: 'medicine', lvl: 2, label: 'ผ้าพันแผล (ใยพืช)' },
  { out: 'clean_water', need: { dirty_water: 1 }, skill: 'cooking', lvl: 1, station: 'fire', keepBottle: true },
  { out: 'clean_water', need: { sea_water: 2, wood: 1 }, skill: 'survival', lvl: 1, station: 'desal', keepBottle: true, bottleBack: 1, label: 'กรองน้ำทะเลเป็นน้ำจืด (น้ำทะเล 2 ขวด + ไม้ 1 · ได้ขวดเปล่าคืน 1) · ที่เครื่องกรองน้ำทะเล' },
  { out: 'cooked_meat', need: { raw_meat: 1 }, skill: 'cooking', lvl: 1, station: 'fire' },
  { out: 'grilled_fish', need: { raw_fish: 1 }, skill: 'cooking', lvl: 1, station: 'fire' },
  { out: 'shelter', need: { wood: 15, fiber: 10 }, skill: 'crafting', lvl: 2 },
  { out: 'watchtower', need: { wood: 20, fiber: 8 }, skill: 'crafting', lvl: 2, label: 'หอสังเกตการณ์ (ปีนหนีผู้ติดเชื้อ)' },
  { out: 'splint', need: { wood: 2, cloth: 1 }, skill: 'medicine', lvl: 2 },
  { out: 'herbal_med', need: { herb: 3, clean_water: 1 }, skill: 'medicine', lvl: 2, station: 'fire' },
  { out: 'machete', need: { scrap: 4, wood: 2 }, skill: 'crafting', lvl: 3 },
  // ตัดเย็บเสื้อผ้า (ทักษะตัดเย็บ)
  // สูตรขั้นสูงเฉพาะอาชีพ (job)
  { out: 'steel_axe', need: { scrap: 5, wood: 2, fiber: 2 }, skill: 'crafting', lvl: 2, job: 'engineer' },
  { out: 'steel_spear', need: { scrap: 4, wood: 3, fiber: 2 }, skill: 'crafting', lvl: 3, job: 'engineer' },
  { out: 'pickup', need: { scrap: 18, fuel: 2, cloth: 4, zipper: 3 }, skill: 'crafting', lvl: 3, job: 'mechanic', label: 'รถกระบะดัดแปลง (เร็ว · ต้องเติมน้ำมัน)' },
  { out: 'big_meal', need: { corn: 2, veg: 2, cooked_meat: 1 }, skill: 'cooking', lvl: 2, job: 'farmer', station: 'fire' },
  { out: 'rod_pro', need: { scrap: 3, fiber: 4, wood: 2 }, skill: 'fishing', lvl: 2, job: 'fisher' },
  { out: 'fish_soup', need: { raw_fish: 2, herb: 1, clean_water: 1 }, skill: 'cooking', lvl: 1, job: 'fisher', station: 'fire' },
  { out: 'watchtower', need: { wood: 10, fiber: 4 }, skill: 'building', lvl: 2, job: 'builder', label: 'หอสังเกตการณ์ (สูตรช่างก่อสร้าง ราคาถูก)' },
  { out: 'hunter_cloak', need: { hide: 4, fiber: 4, zipper: 1 }, skill: 'tailoring', lvl: 2, job: 'hunter' },
  { out: 'jerky', need: { raw_meat: 2, herb: 1 }, skill: 'cooking', lvl: 1, job: 'hunter', station: 'fire', qty: 2 },
  { out: 'first_aid', need: { bandage: 2, splint: 1, herbal_med: 1 }, skill: 'medicine', lvl: 2, job: 'doctor' },
  { out: 'antiviral', need: { antibiotic: 1, herbal_med: 2, king_fang: 1 }, skill: 'medicine', lvl: 4, job: 'doctor', label: 'ยาต้านไวรัส (ต้องใช้เขี้ยวบอส)' },
  { out: 'herbal_med', need: { herb: 2 }, skill: 'medicine', lvl: 1, job: 'doctor', label: 'ยาสมุนไพร (สูตรหมอ ใช้สมุนไพรน้อยลง)' },
  { out: 'guitar', need: { wood: 6, fiber: 4, scrap: 1 }, skill: 'recreation', lvl: 1, job: 'entertainer' },
  { out: 'calm_tea', need: { herb: 2, clean_water: 1 }, skill: 'cooking', lvl: 1, job: 'entertainer', station: 'fire', keepBottle: true },
  { out: 'energy_drink', need: { clean_water: 1, coconut: 1 }, skill: 'survival', lvl: 1, job: 'athlete', keepBottle: true },
  { out: 'protein_meal', need: { raw_meat: 2, clean_water: 1 }, skill: 'cooking', lvl: 1, job: 'athlete', station: 'fire' },
  { out: 'kaprao', need: { cooked_meat: 1, herb: 1, veg: 1 }, skill: 'cooking', lvl: 1, job: 'chef', station: 'fire' },
  { out: 'tomyum_kung', need: { prawn: 2, herb: 1, clean_water: 1 }, skill: 'cooking', lvl: 2, job: 'chef', station: 'fire' },
  { out: 'coconut_dessert', need: { coconut: 2, corn: 1 }, skill: 'cooking', lvl: 2, job: 'chef', station: 'fire' },
  { out: 'big_meal', need: { corn: 1, veg: 1, cooked_meat: 1 }, skill: 'cooking', lvl: 3, job: 'chef', station: 'fire', label: 'อาหารชุดใหญ่ (สูตรเชฟ)' },
  { out: 'phone', need: { scrap: 4, zipper: 2, rag: 1 }, skill: 'tech', lvl: 1, job: 'it', label: 'มือถือดัดแปลง (เห็นกล่องเสบียงบนแผนที่)' },
  { out: 'zradar', need: { scrap: 6, zipper: 3, phone: 1 }, skill: 'tech', lvl: 2, job: 'it', label: 'เรดาร์จับผู้ติดเชื้อ (เห็นผู้ติดเชื้อบนแผนที่)' },
  { out: 'drone', need: { scrap: 8, fiber: 4, zipper: 2 }, skill: 'tech', lvl: 3, job: 'it', label: 'โดรนสอดแนม (กดใช้: ส่องทุกอย่างรอบตัว 150 หน่วย)' },
  { out: 'prayer_beads', need: { wood: 2, fiber: 3 }, skill: 'spirit', lvl: 1, job: 'monk', label: 'ลูกประคำ (สวดมนต์ให้กำลังใจทุกคนรอบตัว)' },
  { out: 'amulet', need: { rag: 2, herb: 1 }, skill: 'spirit', lvl: 1, job: 'monk', label: 'ผ้ายันต์กำลังใจ (หายตื่นตระหนก + กำลังใจ 5 นาที)' },
  { out: 'bone_spear', need: { dino_bone: 2, wood: 2, fiber: 2 }, skill: 'crafting', lvl: 2, label: 'หอกกระดูกไดโน (ดาเมจสูง)' },
  // อาวุธ
  { out: 'club', need: { wood: 3 }, skill: 'crafting', lvl: 1, label: 'กระบองไม้' },
  { out: 'nail_bat', need: { wood: 3, scrap: 3 }, skill: 'crafting', lvl: 2, label: 'ไม้ตอกตะปู' },
  { out: 'sickle', need: { scrap: 2, wood: 1 }, skill: 'crafting', lvl: 1, label: 'เคียว (เก็บพืช/หญ้าเร็ว)' },
  { out: 'iron_sword', need: { scrap: 8, hide: 1, wood: 1 }, skill: 'crafting', lvl: 4, station: 'fire', label: 'ดาบเหล็ก (ตีที่กองไฟ)' },
  { out: 'slingshot', need: { wood: 1, hide: 1, fiber: 2 }, skill: 'crafting', lvl: 1, label: 'หนังสติ๊ก (ยิงด้วยก้อนกรวด)' },
  { out: 'bow', need: { wood: 3, fiber: 5 }, skill: 'crafting', lvl: 2, label: 'ธนูไม้ไผ่ (ยิงไกล)' },
  { out: 'arrow', need: { twig: 2, fiber: 1, pebble: 1 }, skill: 'crafting', lvl: 1, qty: 5, label: 'ลูกธนู ×5' },
  { out: 'crossbow', need: { scrap: 8, wood: 3, fiber: 4, zipper: 1 }, skill: 'crafting', lvl: 4, label: 'หน้าไม้เหล็ก (ยิงแรงมาก)' },
  { out: 'bolt', need: { scrap: 1, twig: 2 }, skill: 'crafting', lvl: 3, qty: 4, label: 'ลูกดอกหน้าไม้ ×4' },
  { out: 'arrow_stone', need: { twig: 2, fiber: 1, stone: 1 }, skill: 'crafting', lvl: 1, qty: 5, label: 'ลูกธนูหัวหิน ×5 (+6 ดาเมจ)' },
  { out: 'arrow_bone', need: { twig: 2, fiber: 1, hide: 1 }, skill: 'crafting', lvl: 2, qty: 5, label: 'ลูกธนูหัวกระดูก ×5 (+11 ดาเมจ)' },
  { out: 'arrow_iron', need: { twig: 2, fiber: 1, scrap: 1 }, skill: 'crafting', lvl: 3, qty: 5, station: 'fire', label: 'ลูกธนูหัวเหล็ก ×5 (+17 ดาเมจ · ตีที่กองไฟ)' },
  { out: 'arrow_fire', need: { arrow_iron: 3, rag: 1, fuel: 1 }, skill: 'crafting', lvl: 4, qty: 3, label: 'ลูกธนูไฟ ×3 (+26 ดาเมจ · ติดไฟ)' },
  { out: 'bolt_steel', need: { scrap: 2, twig: 2 }, skill: 'crafting', lvl: 4, qty: 4, station: 'fire', label: 'ลูกดอกเหล็กกล้า ×4 (+16 ดาเมจ)' },
  { out: 'bolt_heavy', need: { bolt_steel: 2, scrap: 2, copper_wire: 1 }, skill: 'crafting', lvl: 5, qty: 2, station: 'fire', label: 'ลูกดอกหัวเจาะเกราะ ×2 (+30 ดาเมจ)' },
  { out: 'steel_ball', need: { scrap: 1 }, skill: 'crafting', lvl: 2, qty: 6, label: 'ลูกเหล็กหนังสติ๊ก ×6 (+8 ดาเมจ)' },
  // ชิ้นส่วนรถ + ประกอบยานพาหนะ
  { out: 'wheel', need: { scrap: 3, rag: 2 }, skill: 'crafting', lvl: 2, label: '🚗 ล้อรถยนต์' },
  { out: 'engine', need: { scrap: 10, zipper: 2, fuel: 1 }, skill: 'crafting', lvl: 3, label: '🚗 เครื่องยนต์รถยนต์' },
  { out: 'moto_wheel', need: { scrap: 2, rag: 1 }, skill: 'crafting', lvl: 1, label: '🏍️ ล้อมอเตอร์ไซค์' },
  { out: 'moto_engine', need: { scrap: 6, zipper: 1, fuel: 1 }, skill: 'crafting', lvl: 2, label: '🏍️ เครื่องยนต์มอเตอร์ไซค์' },
  { out: 'moto_ev_motor', need: { scrap: 5, copper_wire: 4 }, skill: 'electric', lvl: 1, job: 'electrician', label: '🛵 มอเตอร์ไฟฟ้ามอเตอร์ไซค์' },
  { out: 'moto_battery', need: { battery_pack: 2, copper_wire: 2 }, skill: 'electric', lvl: 1, job: 'electrician', label: '🛵 แบตเตอรี่มอเตอร์ไซค์ไฟฟ้า' },
  { out: 'chassis', need: { scrap: 8, wood: 4 }, skill: 'crafting', lvl: 2, label: 'โครงรถ' },
  { out: 'car_seat', need: { cloth: 2, rag: 3 }, skill: 'crafting', lvl: 1, label: 'เบาะรถ' },
  { out: 'battery_pack', need: { scrap: 3, zipper: 2 }, skill: 'crafting', lvl: 2, label: 'แบตเตอรี่ประกอบ' },
  { out: 'raft_kit', need: { wood: 6, fiber: 4 }, skill: 'crafting', lvl: 1, label: 'ชุดลำแพไม้ไผ่' },
  { out: 'bicycle', need: { moto_wheel: 2, wood: 2 }, skill: 'crafting', lvl: 2, label: '🔧 ประกอบจักรยาน (ล้อมอเตอร์ไซค์ 2 + ไม้ 2)' },
  { out: 'motorbike', need: { moto_wheel: 2, moto_engine: 1, spark_plug: 1, fuel: 1 }, skill: 'crafting', lvl: 3, label: '🔧 ประกอบมอเตอร์ไซค์น้ำมัน (ล้อมอไซค์ 2 + เครื่องยนต์มอไซค์ + หัวเทียน + น้ำมัน)' },
  { out: 'ev_bike', need: { moto_wheel: 2, moto_ev_motor: 1, moto_battery: 1 }, skill: 'crafting', lvl: 3, label: '🔧 ประกอบมอเตอร์ไซค์ไฟฟ้า (ล้อมอไซค์ 2 + มอเตอร์ไฟฟ้ามอไซค์ + แบตมอไซค์ · ไม่ใช้น้ำมัน)' },
  { out: 'steering_wheel', need: { scrap: 2, hide: 1 }, skill: 'crafting', lvl: 2, label: 'พวงมาลัย' },
  { out: 'spark_plug', need: { scrap: 2, copper_wire: 1 }, skill: 'crafting', lvl: 2, label: 'หัวเทียน' },
  { out: 'copper_wire', need: { scrap: 1, rag: 1 }, skill: 'crafting', lvl: 1, qty: 2, label: 'สายไฟทองแดง ×2' },
  { out: 'ev_battery', need: { battery_pack: 3, copper_wire: 4, zipper: 2 }, skill: 'electric', lvl: 2, job: 'electrician', label: 'แบตเตอรี่ EV (สายช่างไฟฟ้า)' },
  { out: 'ev_motor', need: { scrap: 8, copper_wire: 6, zipper: 2 }, skill: 'electric', lvl: 2, job: 'electrician', label: 'มอเตอร์ไฟฟ้า (สายช่างไฟฟ้า)' },
  { out: 'solar_panel', need: { scrap: 6, copper_wire: 4, battery_pack: 1 }, skill: 'electric', lvl: 1, job: 'electrician', label: 'แผงโซล่าเซลล์ (วางแล้วใช้ชาร์จรถ EV)' },
  { out: 'pickup', need: { wheel: 4, engine: 1, chassis: 1, steering_wheel: 1, battery_pack: 1, spark_plug: 1, fuel: 2 }, skill: 'crafting', lvl: 4, label: '🔧 ประกอบรถกระบะน้ำมัน (ล้อ 4 + เครื่องยนต์ + โครง + พวงมาลัย + แบต + หัวเทียน + น้ำมัน)' },
  { out: 'ev_car', need: { wheel: 4, ev_motor: 1, chassis: 1, steering_wheel: 1, ev_battery: 1 }, skill: 'crafting', lvl: 4, label: '🔧 ประกอบรถ EV (ล้อ 4 + มอเตอร์ไฟฟ้า + โครง + พวงมาลัย + แบต EV · ไม่ใช้น้ำมัน)' },
  { out: 'raft', need: { raft_kit: 2, fiber: 2 }, skill: 'crafting', lvl: 1, label: '🔧 ประกอบแพ (ชุดลำแพ 2)' },
  { out: 'shield_wood', need: { wood: 4, fiber: 2 }, skill: 'crafting', lvl: 1 },
  { out: 'shield_lid', need: { scrap: 4, rag: 2 }, skill: 'crafting', lvl: 2 },
  { out: 'shield_hide', need: { wood: 3, hide: 3, zipper: 1 }, skill: 'crafting', lvl: 3 },
  { out: 'shield_riot', need: { kevlar: 3, scrap: 4, zipper: 2 }, skill: 'crafting', lvl: 4 },
  { out: 'hat_cloth', need: { rag: 3 }, skill: 'tailoring', lvl: 1 },
  // ชุดขนเป็ด (ขนเป็ดจากเล้าเป็ด)
  { out: 'down_jacket', need: { duck_feather: 10, cloth: 3, zipper: 1 }, skill: 'tailoring', lvl: 2, label: 'แจ็กเก็ตขนเป็ด (สตามิน่า +10%)' },
  { out: 'down_hat', need: { duck_feather: 4, cloth: 1 }, skill: 'tailoring', lvl: 1 },
  { out: 'down_gloves', need: { duck_feather: 4, cloth: 1 }, skill: 'tailoring', lvl: 1 },
  { out: 'down_socks', need: { duck_feather: 3, rag: 1 }, skill: 'tailoring', lvl: 1 },
  { out: 'feather_pillow', need: { duck_feather: 6, cloth: 2 }, skill: 'tailoring', lvl: 1, label: 'หมอนขนเป็ด (ของขวัญ)' },
  { out: 'arrow_feather', need: { twig: 2, duck_feather: 1, pebble: 1 }, skill: 'crafting', lvl: 2, qty: 5, label: 'ลูกธนูหางขนเป็ด ×5 (+9 ดาเมจ)' },
  { out: 'shirt_rag', need: { rag: 5, fiber: 2 }, skill: 'tailoring', lvl: 1 },
  { out: 'pants_rag', need: { rag: 4 }, skill: 'tailoring', lvl: 1 },
  { out: 'skirt_rag', need: { rag: 4 }, skill: 'tailoring', lvl: 1 },
  { out: 'gloves_rag', need: { rag: 2 }, skill: 'tailoring', lvl: 1 },
  { out: 'socks', need: { rag: 2 }, skill: 'tailoring', lvl: 1 },
  { out: 'sandals', need: { rag: 1, fiber: 3 }, skill: 'tailoring', lvl: 1 },
  { out: 'bag_cloth', need: { rag: 4, fiber: 4 }, skill: 'tailoring', lvl: 1 },
  { out: 'helmet_bike', need: { scrap: 3, rag: 2, zipper: 1 }, skill: 'tailoring', lvl: 2 },
  { out: 'cloth_armor', need: { cloth: 6, fiber: 4 }, skill: 'tailoring', lvl: 2 },
  { out: 'jeans', need: { cloth: 3, rag: 3, zipper: 1 }, skill: 'tailoring', lvl: 2 },
  { out: 'skirt_long', need: { cloth: 3, rag: 3 }, skill: 'tailoring', lvl: 2 },
  { out: 'gloves_leather', need: { hide: 2, rag: 1 }, skill: 'tailoring', lvl: 2 },
  { out: 'socks_wool', need: { cloth: 2, fiber: 2 }, skill: 'tailoring', lvl: 2 },
  { out: 'sneakers', need: { rag: 3, zipper: 1, scrap: 1 }, skill: 'tailoring', lvl: 2 },
  { out: 'bag_hiking', need: { cloth: 4, rag: 4, zipper: 2 }, skill: 'tailoring', lvl: 2 },
  { out: 'jacket_leather', need: { hide: 4, rag: 2, zipper: 2 }, skill: 'tailoring', lvl: 3 },
  { out: 'pants_cargo', need: { kevlar: 1, cloth: 4, zipper: 2 }, skill: 'tailoring', lvl: 3 },
  { out: 'boots', need: { hide: 3, scrap: 2, zipper: 1 }, skill: 'tailoring', lvl: 3 },
  { out: 'helmet_mil', need: { kevlar: 2, scrap: 2 }, skill: 'tailoring', lvl: 4 },
  { out: 'vest_kevlar', need: { kevlar: 4, cloth: 3 }, skill: 'tailoring', lvl: 4 },
  { out: 'bag_military', need: { kevlar: 2, hide: 3, zipper: 3 }, skill: 'tailoring', lvl: 4 },
  { out: 'ring', need: { scrap: 3 }, skill: 'crafting', lvl: 3 },
  { out: 'herbal_soup', need: { herb: 2, raw_fish: 1, clean_water: 1 }, skill: 'cooking', lvl: 3, station: 'fire' },
  // อุปกรณ์สัตว์เลี้ยง
  { out: 'pet_cap', need: { rag: 2 }, skill: 'tailoring', lvl: 1, label: 'หมวกแก๊ปสัตว์ (🐾 หมวก)' },
  { out: 'pet_socks', need: { rag: 2 }, skill: 'tailoring', lvl: 1, label: 'ปลอกเท้าผ้า (🐾 รองเท้า)' },
  { out: 'pet_bandana', need: { cloth: 2, herb: 1 }, skill: 'tailoring', lvl: 1, label: 'ผ้าพันคอนำโชค (🐾 ปลอกคอ)' },
  { out: 'pet_bell', need: { zipper: 1, scrap: 1, rag: 1 }, skill: 'crafting', lvl: 2, label: 'ปลอกคอกระดิ่ง (🐾 ปลอกคอ)' },
  { out: 'pet_collar', need: { scrap: 2, cloth: 1 }, skill: 'crafting', lvl: 2, label: 'ปลอกคอหนาม (🐾 ปลอกคอ)' },
  { out: 'pet_helmet', need: { scrap: 2, rag: 1 }, skill: 'crafting', lvl: 2, label: 'หมวกเหล็กสัตว์ (🐾 หมวก)' },
  { out: 'pet_vest', need: { cloth: 4, scrap: 2 }, skill: 'tailoring', lvl: 2, label: 'เสื้อเกราะสัตว์ (🐾 ชุด)' },
  { out: 'pet_bag', need: { cloth: 3, fiber: 4 }, skill: 'tailoring', lvl: 2, label: 'กระเป๋าสัมภาระสัตว์ (🐾 ชุด)' },
  { out: 'pet_boots', need: { hide: 1, rag: 2 }, skill: 'tailoring', lvl: 2, label: 'รองเท้าหนังสัตว์ (🐾 รองเท้า)' },
  { out: 'pet_claws', need: { scrap: 4 }, skill: 'crafting', lvl: 3, label: 'เล็บ/จะงอยเหล็ก (🐾 อาวุธ)' },
  { out: 'pet_fangs', need: { scrap: 6, zipper: 1 }, skill: 'crafting', lvl: 4, label: 'เขี้ยวเหล็ก (🐾 อาวุธ)' },
  { out: 'pet_kevlar', need: { kevlar: 2, cloth: 2 }, skill: 'tailoring', lvl: 4, label: 'เกราะเคฟลาร์สัตว์ (🐾 ชุด)' },
  { out: 'wood_hammer', need: { wood: 3, fiber: 1 }, skill: 'crafting', lvl: 1, label: 'ค้อนไม้ (ใช้สร้างบ้านได้ — กด B)' },
  { out: 'hammer', need: { wood: 3, stone: 2 }, skill: 'crafting', lvl: 1, label: 'ค้อนช่างไม้ (สร้างบ้าน + ตีแรงกว่า)' },
  { out: 'stone_hammer', need: { wood: 2, stone: 3, fiber: 2 }, skill: 'crafting', lvl: 1, label: 'ค้อนหินพื้นฐาน (ทุบก้อนหินใหญ่)' },
  { out: 'torch', need: { wood: 1, fiber: 1, rag: 1 }, skill: 'crafting', lvl: 1, label: 'คบเพลิง (ส่องสว่าง + สู้ผู้ติดเชื้อ)' },
  { out: 'torch', need: { twig: 2, fiber: 2 }, skill: 'crafting', lvl: 1, label: 'คบเพลิง (จากกิ่งไม้)' },
  { out: 'net', need: { fiber: 8, raw_fiber: 2 }, skill: 'fishing', lvl: 1, label: 'แหทอดปลา (ถือแล้วคลิกใส่น้ำ ได้ปลาหลายตัว)' },
  { out: 'cage', need: { scrap: 6, wood: 4, fiber: 2 }, skill: 'crafting', lvl: 2, label: 'กรงดักสัตว์ (ใส่เหยื่อล่อ จับสัตว์ป่า/ไดโนเสาร์มาเลี้ยง)' },
  { out: 'rod', need: { wood: 1, fiber: 2 }, skill: 'crafting', lvl: 1, label: 'เบ็ดตกปลาพื้นฐาน' },
  { out: 'watering_can', need: { scrap: 2, bottle: 1 }, skill: 'farming', lvl: 1, label: 'บัวรดน้ำ (รดแปลงผักได้โดยไม่ต้องใช้น้ำขวด)' },
  { out: 'grilled_corn', need: { corn: 1 }, skill: 'cooking', lvl: 1, station: 'fire' },
  { out: 'fried_egg', need: { egg: 1 }, skill: 'cooking', lvl: 1, station: 'fire' },
  { out: 'stir_veg', need: { veg: 2, herb: 1 }, skill: 'cooking', lvl: 2, station: 'fire' },
  { out: 'steamed_crab', need: { crab: 1, clean_water: 1 }, skill: 'cooking', lvl: 2, station: 'fire' },
  { out: 'grilled_squid', need: { squid: 1 }, skill: 'cooking', lvl: 1, station: 'fire' },
  { out: 'grilled_prawn', need: { prawn: 1 }, skill: 'cooking', lvl: 2, station: 'fire' },
  { out: 'grilled_big_fish', need: { big_fish: 1 }, skill: 'cooking', lvl: 2, station: 'fire' },
  { out: 'raft', need: { wood: 12, fiber: 8 }, skill: 'crafting', lvl: 2, label: 'แพไม้ไผ่ (ล่องทะเลไปเกาะได้)' },
  { out: 'bicycle', need: { scrap: 6, wood: 2, cloth: 1 }, skill: 'crafting', lvl: 2, label: 'จักรยาน' },
  { out: 'antibiotic', need: { herb: 5, clean_water: 1, scrap: 1 }, skill: 'medicine', lvl: 4, station: 'fire', label: 'ยาปฏิชีวนะสกัด' },
  { out: 'antibiotic', qty: 2, need: { herb: 3, lab_kit: 1, clean_water: 1 }, skill: 'medicine', lvl: 3, label: 'ยาปฏิชีวนะ ×2 (ใช้ชุดแล็บ)' },
  // ทุเรียน
  { out: 'durian_chips', need: { durian: 1 }, skill: 'cooking', lvl: 1, station: 'fire' },
  { out: 'durian_sticky_rice', need: { durian: 1, rice: 1, coconut: 1 }, skill: 'cooking', lvl: 2, station: 'fire' },
  // ดอกไม้สวยงาม
  { out: 'flower_crown', need: { wildflower: 6, fiber: 2 }, skill: 'crafting', lvl: 1 },
  { out: 'flower_garland', need: { wildflower: 4, fiber: 1 }, skill: 'crafting', lvl: 1 },
  { out: 'perfume', need: { wildflower: 5, clean_water: 1, bottle: 1 }, skill: 'crafting', lvl: 2, keepBottle: true },
  // ขนแกะ
  { out: 'wool_sweater', need: { wool: 6, fiber: 2 }, skill: 'tailoring', lvl: 2 },
  { out: 'wool_hat', need: { wool: 3 }, skill: 'tailoring', lvl: 1 },
  { out: 'socks_wool', need: { wool: 2 }, skill: 'tailoring', lvl: 1, label: 'ถุงเท้าหนา (จากขนแกะ)' },
  // จักสาน (ต้องเรียนจากยายแวว ตลาดจักสานพนัสนิคม หรืออ่านคู่มือหัตถกรรม)
  { out: 'wicker_basket', need: { bamboo: 8, fiber: 2 }, skill: 'crafting', lvl: 1, learn: 'wicker' },
  { out: 'chalom', need: { bamboo: 5 }, skill: 'crafting', lvl: 1, learn: 'wicker' },
  { out: 'hand_fan', need: { bamboo: 3, fiber: 1 }, skill: 'crafting', lvl: 1, learn: 'wicker' },
  { out: 'raft', need: { bamboo: 16, fiber: 6 }, skill: 'crafting', lvl: 1, learn: 'wicker', label: 'แพไม้ไผ่ (จากลำไผ่)' },
];
// สูตรที่ต้องเรียนก่อน: เรียนจาก NPC หรืออ่านตำรา → เก็บใน ch.boxes['learn_<ชื่อ>']
export const LEARN = { wicker: { name: 'งานจักสาน', npc: 'npc_waew', cost: 40 }, water: { name: 'ระบบประปา', quest: true, how: 'ทำภารกิจซ่อมโรงสูบน้ำที่เขื่อนเกาะจันทร์ก่อน' } };
// 💧 ภารกิจซ่อมโรงสูบน้ำเขื่อนเกาะจันทร์: เอาของมาส่งครบ → ปลดล็อกท่อส่งน้ำและหอถังน้ำสำรอง
export const DAM_NEED = { scrap: 6, copper_wire: 4, battery_pack: 1, fuel: 2 };
export const learned = (ch, k) => !!ch?.boxes?.['learn_' + k];
export const learnHint = (k) => '🔒 ' + (LEARN[k]?.how || (k === 'wicker' ? 'ต้องเรียนงานจักสานกับยายแวว (ตลาดจักสานพนัสนิคม) ก่อน' : `ต้องเรียน${LEARN[k]?.name || ''}ก่อน`));

export const SKILLS = {
  gathering: 'เก็บเกี่ยว', crafting: 'ประดิษฐ์', cooking: 'ทำอาหาร',
  medicine: 'การแพทย์', combat: 'การต่อสู้', survival: 'เอาตัวรอด',
  building: 'ก่อสร้าง', farming: 'เพาะปลูก', fishing: 'ตกปลา', tailoring: 'ตัดเย็บ', recreation: 'สันทนาการ', tech: 'เทคโนโลยี', spirit: 'จิตใจ', electric: 'ไฟฟ้า',
};
export const skillLevel = (xp) => Math.floor(Math.sqrt((xp || 0) / 25)) + 1;
export const xpForLevel = (lvl) => (lvl - 1) * (lvl - 1) * 25;

const T = (key, name, lat, lon, r, n, tall) => ({ key, name, x: lonToX(lon), z: latToZ(lat), r, n, tall });
export const TOWNS = [
  T('chonburi', 'เมืองชลบุรี', 13.361, 100.99, 60, 34, 1.3),
  T('bangsaen', 'บางแสน', 13.283, 100.925, 45, 22, 1),
  T('sriracha', 'ศรีราชา', 13.170, 100.945, 50, 28, 1.4),
  T('laemchabang', 'ท่าเรือแหลมฉบัง', 13.083, 100.905, 55, 26, 0.7),
  T('banglamung', 'บางละมุง', 13.047, 100.935, 35, 14, 0.8),
  T('pattaya', 'พัทยา', 12.927, 100.893, 65, 44, 2.4),
  T('jomtien', 'จอมเทียน', 12.870, 100.888, 40, 22, 1.8),
  T('sattahip', 'สัตหีบ', 12.662, 100.915, 45, 20, 0.8),
  T('phanat', 'พนัสนิคม', 13.448, 101.184, 50, 26, 0.8), // อ.พนัสนิคม (เมืองเก่า ขยายใหญ่ขึ้น)
  T('banbueng', 'บ้านบึง', 13.313, 101.109, 40, 16, 0.7),
  T('khaokheow', 'สวนสัตว์เปิดเขาเขียว', 13.24, 101.03, 25, 6, 0.4),
  // อำเภออื่น ๆ ของชลบุรี (พิกัดจริงโดยประมาณ)
  T('phanthong', 'พานทอง', 13.468, 101.096, 35, 14, 0.7),
  T('kochan', 'เกาะจันทร์', 13.395, 101.330, 30, 10, 0.6),
  T('nongyai', 'หนองใหญ่', 13.158, 101.371, 30, 10, 0.6),
  T('bothong', 'บ่อทอง', 13.236, 101.488, 32, 12, 0.6),
  T('sichang', 'เกาะสีชัง', 13.152, 100.818, 14, 6, 0.5),
];
export const SPAWN_TOWN = 'bangsaen';
// ระยะตีของอาวุธระยะประชิด (วัดจากตัวผู้เล่นถึง "ผิว" ของเป้าหมาย) · มือเปล่าเอื้อมได้ใกล้สุด
export const meleeReach = (tool) => Math.min(2.8, tool?.range ? tool.range * 0.72 : 1.15);
// รัศมีลำตัวของเป้าหมาย (ตัวใหญ่ตีโดนได้จากไกลกว่า)
export const BODY_R = { elephant: 1.7, trike: 1.3, buffalo: 0.8, cow: 0.8, tiger: 0.7, raptor: 0.6, boar: 0.6, deer: 0.5, sheep: 0.45, dog: 0.35, cat: 0.25, chicken: 0.25, bird: 0.2 };
export const MELEE_MAX = 6.5; // เซิร์ฟเวอร์ยอมรับการตีระยะประชิดไม่เกินนี้ (เผื่อความหน่วงเน็ต)

// ช่องสวมใส่ และกระเป๋า
export const WEAR_SLOTS = { head: '🧢 หมวก', body: '👕 เสื้อ', legs: '👖 กางเกง/กระโปรง', hands: '🧤 ถุงมือ', socks: '🧦 ถุงเท้า', shoes: '👟 รองเท้า', back: '🎒 กระเป๋า', off: '🛡️ มือซ้าย' };
export const BASE_SLOTS = 72; // กระเป๋าตั้งต้น (เพิ่ม 50% จาก 48)
// กองไฟที่ผู้เล่นก่อ: ผู้ติดเชื้อและสัตว์นักล่าไม่กล้าเข้าใกล้ในรัศมีนี้
export const FIRE_SAFE = 8;
// เตาผิงในศาลา: จุดครั้งเดียวลุกได้ 24 ชั่วโมง และไล่ผู้ติดเชื้อ/สัตว์ร้ายรอบศาลาเหมือนกองไฟ
export const HEARTH_MS = 24 * 3600 * 1000;
export const nearFireOf = (fires, x, z, r = FIRE_SAFE) => { for (const f of fires) { const d = Math.hypot(f.x - x, f.z - z); if (d < r) return { f, d }; } return null; };
// ยานพาหนะไฟฟ้า: ชาร์จที่แผงโซล่าเซลล์เฉพาะตอนกลางวันที่มีแดด (ไม่ใช้น้ำมัน)
export const ELECTRIC = new Set(['ev_car', 'ev_bike']);
// มีค้อนที่ใช้สร้างบ้านไหม (ค้อนช่างไม้ หรือ ค้อนไม้)
export const canBuild = (inv) => Object.keys(inv || {}).some((k) => inv[k] > 0 && ITEMS[k]?.builds);

// ---------- จำนวนสัตว์เลี้ยง ----------
// เริ่มต้นชนิดละ 1 ตัว (สุนัข แมว นก) · มีบ้าน (เตียง) + บ้านสัตว์เลี้ยง ได้เพิ่ม +1 ตัว/ชนิด ต่อหลัง · สัตว์ป่าจับด้วยแหได้ 1 ตัว
// สัตว์ป่าที่จะเกิด: แถวสวนสัตว์เขาเขียวมีไดโนเสาร์หลุดออกมา (ที่อื่นพบได้ยาก)
export const pickWild = (zoo, r, town = false) => {
  const k = zoo ? (r < 0.25 ? 'raptor' : r < 0.45 ? 'trike' : r < 0.55 ? 'tiger' : r < 0.8 ? 'deer' : 'boar') : r < 0.02 ? 'raptor' : r < 0.04 ? 'trike' : r < 0.07 ? 'tiger' : r < 0.5 ? 'chicken' : r < 0.8 ? 'boar' : 'deer';
  return town && WILD[k].noTown ? 'chicken' : k; // ไดโนเสาร์/นักล่าไม่เกิดในเมือง
};
export const inTownAt = (x, z, pad = 1.15) => TOWNS.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < (t.r * pad) ** 2);
export const PET_BASE = 1, PET_PER_HOUSE = 1, WILD_PET_MAX = 1;
export const petCap = (houses, beds) => PET_BASE + (beds > 0 ? houses * PET_PER_HOUSE : 0);

// ---------- อาชีพ (เลือกตอนสร้างตัวละคร) ----------
// skill = ทักษะหลักของอาชีพ · xp = ตัวคูณประสบการณ์ · perks = [เลเวลทักษะหลักที่ปลดล็อก, คำอธิบาย]
export const JOBS = {
  engineer: { name: 'ช่างเครื่องมือ', icon: '🔧', skill: 'crafting', xp: { crafting: 1.5 }, kit: { hammer: 1, scrap: 3 }, desc: 'สร้างเครื่องมือและอาวุธขั้นสูง',
    perks: [[1, 'XP ประดิษฐ์ +50% · ปลดล็อก ขวานเหล็ก / หอกเหล็กกล้า'], [4, 'เครื่องมือเก็บของแรงขึ้น 30%'], [8, 'โอกาส 25% ได้วัตถุดิบคืนทั้งหมดเมื่อประดิษฐ์']] },
  mechanic: { name: 'ช่างยนต์', icon: '🚗', skill: 'crafting', xp: { crafting: 1.3 }, kit: { fuel: 2, scrap: 4 }, desc: 'สร้างและซ่อมยานพาหนะ',
    perks: [[1, 'ปลดล็อก รถกระบะดัดแปลง / มอเตอร์ไซค์ไม่ใช้แบตเตอรี่'], [4, 'ยานพาหนะกินน้ำมันน้อยลง 50%'], [8, 'ยานพาหนะวิ่งเร็วขึ้น 15%']] },
  farmer: { name: 'เกษตรกร', icon: '🌾', skill: 'farming', xp: { farming: 1.5, cooking: 1.2 }, kit: { seeds_corn: 4, seeds_veg: 4 }, desc: 'ปลูกพืชได้ผลผลิตมาก',
    perks: [[1, 'เก็บเกี่ยวได้ผลผลิต ×2 · ปลดล็อก อาหารชุดใหญ่'], [4, 'เก็บเกี่ยวได้เมล็ดพันธุ์คืน'], [8, 'เก็บเกี่ยวได้ผลผลิต ×3']] },
  fisher: { name: 'ชาวประมง', icon: '🎣', skill: 'fishing', xp: { fishing: 1.5 }, kit: { rod: 1 }, desc: 'ตกปลาเก่ง ได้ปลาหายากบ่อย',
    perks: [[1, 'ปลาหายากติดบ่อยขึ้น · ปลดล็อก เบ็ดคาร์บอน / ต้มยำปลา'], [4, 'ปลากินเบ็ดเร็วขึ้น 40%'], [8, 'ได้ปลา 2 ตัวในครั้งเดียว (โอกาส 30%)']] },
  builder: { name: 'ช่างก่อสร้าง', icon: '🏠', skill: 'building', xp: { building: 1.5 }, kit: { hammer: 1, wood: 6 }, desc: 'สร้างบ้านถูกและเร็ว',
    perks: [[1, 'วัสดุก่อสร้างลดลง 25% · ปลดล็อก หอสังเกตการณ์ราคาถูก'], [4, 'รื้อแล้วได้วัสดุคืนเต็ม 100%'], [8, 'วัสดุก่อสร้างลดลง 40%']] },
  hunter: { name: 'นักล่า', icon: '🏹', skill: 'combat', xp: { combat: 1.3 }, kit: { spear: 1 }, desc: 'ล่าสัตว์และสู้ผู้ติดเชื้อเก่ง',
    perks: [[1, 'ได้เนื้อ/หนังจากสัตว์เพิ่ม · ปลดล็อก ชุดพรางนักล่า / เนื้อตากแห้ง'], [4, 'ดาเมจ +20%'], [8, 'เชื่องสัตว์เร็วขึ้น ×2 และดาเมจ +35%']] },
  it: { name: 'ไอที', icon: '💻', skill: 'tech', xp: { tech: 1.5, crafting: 1.2 }, kit: { phone: 1 }, desc: 'ซ่อมและพัฒนาอุปกรณ์ เช่น มือถือ เรดาร์ โดรน',
    perks: [[1, 'ปลดล็อก มือถือดัดแปลง / เรดาร์ / โดรน'], [4, 'อุปกรณ์ทุกชิ้นตรวจจับได้ไกลขึ้น ×2'], [8, 'แฮกสัญญาณ: เห็นตำแหน่งกล่องหายากและบอสตลอด']] },
  monk: { name: 'พระ', icon: '🙏', skill: 'spirit', xp: { spirit: 1.5, medicine: 1.2 }, kit: { prayer_beads: 1 }, desc: 'เพิ่มกำลังใจ ลดความตื่นตระหนกของทุกคน',
    perks: [[1, 'ตื่นตระหนกช้าลง 50% · สวดมนต์ลดความเครียดและให้ "กำลังใจ" ทุกคนรอบตัว · ปลดล็อก ลูกประคำ / ผ้ายันต์'], [4, 'เพื่อนที่อยู่ใกล้ตื่นตระหนกช้าลง · สวดมนต์ฟื้นพลังชีวิต +10'], [8, 'พลังเมตตา: หลังสวดมนต์ ผู้ติดเชื้อมองไม่เห็นคุณ 15 วินาที']] },
  freelancer: { name: 'ฟรีแลนซ์', icon: '🧭', skill: 'survival', xp: {}, kit: { canned: 2, bandage: 1, bottle: 1 }, free: true, desc: 'ไม่ผูกสายอาชีพ เลือกเรียนรู้สายไหนก็ได้เองตามแต้มสเตตัส',
    perks: [[1, 'เริ่มต้นได้แต้มสเตตัสว่าง 7 แต้ม (อาชีพอื่นได้ 5 แต้มลงสายตัวเอง) ลงสายไหนก็ได้'], [4, 'ได้ XP ทุกทักษะเพิ่ม 10%'], [8, 'ยิ่งลงหลายสายยิ่งเก่ง: ทุกสายที่มีแต้ม 3+ ได้ XP สายนั้นเพิ่มอีก 10%']], happyNote: '😊 เก่งด้านความสุข: ความสุขเพิ่มเองทุก 15 นาที (อาชีพอื่นทุก 1 ชม.) และได้ผลดีจากความสุขมากขึ้น 25%' },
  electrician: { name: 'ช่างไฟฟ้า', icon: '🔌', skill: 'electric', xp: { electric: 1.5, crafting: 1.2 }, kit: { copper_wire: 4, battery_pack: 1 }, desc: 'สร้างแผงโซล่าเซลล์ ทำรถ EV และระบบชาร์จไฟ',
    perks: [[1, 'ปลดล็อก แผงโซล่าเซลล์ / แบตเตอรี่ EV / มอเตอร์ไฟฟ้า · ชาร์จไฟเร็วขึ้น ×2'], [4, 'รถไฟฟ้าใช้ไฟน้อยลง 40%'], [8, 'ชาร์จรถ EV ได้ทุกที่ตอนกลางวัน (แผงพกพา)']] },
  doctor: { name: 'หมอ', icon: '🩺', skill: 'medicine', xp: { medicine: 1.5 }, kit: { bandage: 3, herbal_med: 2 }, desc: 'รักษาอาการบาดเจ็บ ติดเชื้อ ป่วย',
    perks: [[1, 'ยาและการรักษาได้ผล +50% · ปลดล็อก ชุดปฐมพยาบาล / ยาสมุนไพรสูตรประหยัด'], [4, 'รักษาเพื่อน/สัตว์เลี้ยง มีโอกาส 50% ไม่เสียยา · ปลดล็อก ยาต้านไวรัส'], [8, 'เชื้อในตัวลุกลามช้าลง 50% และฟื้นพลังชีวิตเร็วขึ้น ×2']] },
  entertainer: { name: 'นักสันทนาการ', icon: '🎸', skill: 'recreation', xp: { recreation: 1.5 }, kit: { guitar: 1 }, desc: 'ลดความเครียดให้ตัวเองและเพื่อน',
    perks: [[1, 'ความเครียดเพิ่มช้าลง 40% · เล่นดนตรีได้ผลแรง · ปลดล็อก กีตาร์ / ชาคลายเครียด'], [4, 'เพื่อนที่อยู่ใกล้คุณเครียดช้าลง · ดนตรีเพิ่มความภักดีสัตว์เลี้ยง'], [8, 'ดนตรีฟื้นพลังชีวิต +15 และสตามิน่าเต็มให้ทุกคนรอบตัว']] },
  athlete: { name: 'นักกีฬา', icon: '🏃', skill: 'survival', xp: { survival: 1.4 }, kit: { energy_drink: 2 }, desc: 'แข็งแรง วิ่งไว ทนทาน แบกของได้มาก',
    perks: [[1, 'พลังชีวิต +20 · สตามิน่า +30 · กระเป๋า +8 ช่อง · ปลดล็อก เกลือแร่ / อกไก่ต้ม'], [4, 'วิ่งเร็วขึ้น 10% · กระโดดสูงขึ้น · สตามิน่าฟื้นเร็วขึ้น 30%'], [8, 'ดาเมจ +15% · ตกจากที่สูงไม่บาดเจ็บ']] },
  livestock: { name: 'ปศุสัตว์', icon: '🐄', skill: 'farming', xp: { farming: 1.3, survival: 1.2 }, kit: { corn: 4, live_chicken: 1 }, desc: 'เลี้ยงสัตว์เก่ง ค้นพบสกิลพิเศษของสัตว์',
    perks: [[1, 'เก็บผลผลิตจากคอกสัตว์ได้เพิ่ม +1 ทุกครั้ง · ทำให้สัตว์เชื่องเร็วขึ้น 50%'], [4, 'สัตว์เลี้ยงที่ได้มีโอกาสเป็นระดับหายาก/ตำนานสูงขึ้นมาก (สกิลพิเศษมากขึ้น) · ชำแหละได้เนื้อเพิ่ม'], [8, 'สัตว์เลี้ยงตัวใหม่ได้สกิลพิเศษเพิ่มอีก 1 อย่าง · ทำให้เชื่องเร็วขึ้น ×2']] },
  ricefarmer: { name: 'ชาวนา', icon: '🧑‍🌾', skill: 'farming', xp: { farming: 1.5, survival: 1.1 }, kit: { seeds_rice: 4, hoe: 1 }, desc: 'ทำนาเก่ง ปลูกข้าวได้ผลผลิตมาก สีข้าวได้ข้าวสารเพิ่ม',
    perks: [[1, 'ข้าวในนาโตเร็วขึ้น 35% · เกี่ยวข้าวได้ข้าวเปลือกเพิ่ม +2'], [4, 'สีข้าวได้ข้าวสารเพิ่ม +1 และรำข้าว ×2 ทุกครั้ง'], [8, 'ปลูกข้าวแล้วไม่ต้องรดน้ำ (นามีน้ำในตัว) · เกี่ยวข้าวได้ผลผลิต ×2']] },
  blacksmith: { name: 'ช่างตีเหล็ก', icon: '⚒️', skill: 'crafting', xp: { crafting: 1.4, combat: 1.1 }, kit: { hammer: 1, plus_stone: 3, scrap: 4 }, desc: 'ตีบวกอาวุธ ชุด และอุปกรณ์สัตว์เลี้ยงด้วยตัวเอง ไม่เสียค่าจ้าง',
    perks: [[1, 'ตีบวกเองได้ที่ ⚒️ ทั่งตีเหล็ก (ไม่ต้องจ้าง NPC) · ปลดล็อก ทั่งตีเหล็ก'], [4, 'โอกาสตีบวกสำเร็จ +8% · ผสมหินซุปเปอร์ใช้เหล็กพลัสแค่ 2 ก้อน'], [8, 'ตีบวก +6 ถึง +8 ไม่ลดระดับ · โอกาสไอเท็มแตกหายลดลงครึ่งหนึ่ง']] },
  chef: { name: 'เชฟ', icon: '👨‍🍳', skill: 'cooking', xp: { cooking: 1.5 }, kit: { cooked_meat: 2, herb: 2 }, desc: 'พัฒนาอาหาร อาหารให้ผลดีกว่าปกติ',
    perks: [[1, 'อาหารให้ผล +30% · อาหารเป็นพิษน้อยลงครึ่งหนึ่ง · ปลดล็อก กะเพรา / ต้มยำกุ้ง / บัวลอย'], [4, 'ทำอาหารได้เพิ่ม +1 จาน'], [8, 'กินแล้ว "อิ่มเอม": ฟื้นพลังชีวิตต่อเนื่อง 2 นาที และหายเครียด']] },
};
// ---------- สเตตัสสายอาชีพ ----------
// สร้างตัวละคร: สายอาชีพที่เลือกได้ 5 แต้ม · ทุกเลเวลตัวละครได้ +1 แต้ม เอาไปลงสายไหนก็ได้
// ความสามารถขั้นที่ 1/2/3 ของแต่ละสาย ปลดล็อกเมื่อสเตตัสสายนั้นถึง 3/8/14 · XP โบนัสเพิ่มตามแต้ม (เต็มที่ 5 แต้ม)
export const START_PTS = 5, PERK_PTS = [3, 8, 14];
export const jobPts = (ch) => ch?.jp || (JOBS[ch?.profile?.job] && !JOBS[ch.profile.job].free ? { [ch.profile.job]: START_PTS } : {});
export const isFreelancer = (ch) => ch?.profile?.job === 'freelancer';
// 😊 ความสุข 0–100: ยิ่งสุขยิ่งมีภูมิคุ้มกัน (ติดเชื้อยาก/ลุกลามช้า) และกระฉับกระเฉง (สตามิน่ามากขึ้น ฟื้นเร็ว)
// เพิ่มเองทุก 1 ชั่วโมงที่เล่น (ฟรีแลนซ์ทุก 15 นาที) เฉพาะตอนร่างกายปกติ — ถ้าเจ็บ/ป่วย/ติดเชื้อ/หิว/เครียด จะหยุดนับ
// กระสุนที่ใช้กับอาวุธ (ดาเมจสูงสุดก่อน) · pref = ชนิดที่ผู้เล่นเลือกไว้
export const AMMO_OF = (g) => Object.keys(RAW_ITEMS).filter((k) => RAW_ITEMS[k].ammo?.g === g || (g === 'pebble' && k === 'pebble')).sort((a, b) => (RAW_ITEMS[b].ammo?.dmg || 0) - (RAW_ITEMS[a].ammo?.dmg || 0)); // ดาเมจสูงสุดก่อน
export const ammoDmg = (k) => RAW_ITEMS[k]?.ammo?.dmg || 0;
export function pickAmmo(inv, group, pref) {
  if (pref && (inv[pref] || 0) > 0 && AMMO_OF(group).includes(pref)) return pref;
  return AMMO_OF(group).find((k) => (inv[k] || 0) > 0) || null;
}
export const HAPPY_EVERY = 3600, HAPPY_EVERY_FREE = 900;
export const happyPower = (ch, happy) => Math.min(1.25, (happy || 0) / 100 * (isFreelancer(ch) ? 1.25 : 1));
export const charLvl = (ch) => Object.keys(ch?.skills || {}).reduce((s, k) => s + skillLevel(ch.skills[k]) - 1, 0) + 1;
export const freePts = (ch) => START_PTS + (isFreelancer(ch) ? 2 : 0) + charLvl(ch) - 1 - Object.values(jobPts(ch)).reduce((a, b) => a + b, 0);
// สายหลัก = สายที่มีแต้มมากที่สุด
export const jobOf = (ch) => { let best = null, b = 0; for (const [k, v] of Object.entries(jobPts(ch))) if (JOBS[k] && v > b) { b = v; best = k; } return best; };
// มีความสามารถขั้นที่ tier (0,1,2) ของสายนี้หรือยัง
export const hasPerk = (ch, job, tier) => (jobPts(ch)[job] || 0) >= PERK_PTS[tier];
// ตัวคูณประสบการณ์ของทักษะ s จากทุกสายที่ลงแต้มไว้
export function xpMulOf(ch, s) {
  let m = 1; for (const [k, v] of Object.entries(jobPts(ch))) { const x = JOBS[k]?.xp?.[s]; if (x) m += (x - 1) * Math.min(1, v / 5) + (isFreelancer(ch) && charLvl(ch) >= 8 && v >= 3 ? 0.1 : 0); }
  return m + (isFreelancer(ch) && charLvl(ch) >= 4 ? 0.1 : 0);
}
// ตัวคูณดาเมจ (ใช้ทั้งในเครื่องและฝั่งเซิร์ฟเวอร์ตอนตรวจโกง)
export const dmgMulOf = (ch) => (1 + (skillLevel(ch.skills?.combat) - 1) * 0.08) * (hasPerk(ch, 'hunter', 2) ? 1.35 : hasPerk(ch, 'hunter', 1) ? 1.2 : 1)
  * (hasPerk(ch, 'athlete', 2) ? 1.15 : 1) * (killPerk(ch, 4) ? 1.15 : killPerk(ch, 0) ? 1.05 : 1);
// พลังชีวิต/สตามิน่าสูงสุด และช่องกระเป๋าเพิ่ม
export const maxHpOf = (ch) => 100 + (skillLevel(ch.skills?.survival) - 1) * 5 + (hasPerk(ch, 'athlete', 0) ? 20 : 0);
export const maxStamOf = (ch) => 100 + (skillLevel(ch.skills?.survival) - 1) * 4 + (hasPerk(ch, 'athlete', 0) ? 30 : 0) + (killPerk(ch, 4) ? 20 : 0);
export const extraSlots = (ch) => (hasPerk(ch, 'athlete', 0) ? 8 : 0);

// ---------- ความสามารถจากการกำจัดผู้ติดเชื้อ ----------
export const KILL_PERKS = [
  [50, '🗡️ ดาเมจ +5%'],
  [150, '🥷 ผู้ติดเชื้อมองเห็นคุณยากขึ้น 10%'],
  [300, '🛡️ ลดโอกาสติดเชื้อเมื่อถูกกัด 15%'],
  [500, '🩸 มองเห็นเลือด (พลังชีวิต) และระดับของผู้ติดเชื้อ'],
  [1000, '💀 ตำนานนักล่า: ดาเมจ +15% และสตามิน่าสูงสุด +20'],
];
export const killPerk = (ch, i) => (ch?.stats?.kills || 0) >= KILL_PERKS[i][0];
// ค่าวัสดุก่อสร้างหลังหักส่วนลดช่างก่อสร้าง
export function buildCost(ch, cost) {
  const off = hasPerk(ch, 'builder', 2) ? 0.4 : hasPerk(ch, 'builder', 0) ? 0.25 : 0;
  if (!off) return { ...cost };
  const out = {}; for (const [k, q] of Object.entries(cost)) out[k] = Math.max(1, Math.round(q * (1 - off)));
  return out;
}
// จำนวนชิ้นต่อ 1 ช่องกระเป๋า
export const stackOf = (k) => { const it = ITEMS[k]; return it.wear || it.tool || it.place || it.petGear || it.instrument || it.device ? 1 : it.food || it.med ? 10 : 30; };
export function wearStats(wear) {
  const t = { def: 0, bite: 0, spd: 0, stam: 0, gather: 0, carry: 0, block: 0, warm: 0 }; // warm = กันหนาว (0–1)
  for (const k of Object.values(wear || {})) { const w = k && ITEMS[k]?.wear; if (w) for (const f in t) t[f] += w[f] || 0; }
  t.warm = Math.min(1, t.warm); t.def = Math.min(0.6, t.def); t.bite = Math.min(0.7, t.bite); t.block = Math.min(0.5, t.block);
  return t;
}

// จุดของภารกิจหลัก "ตามหาศูนย์อพยพสัตหีบ"
export const QUEST_SPOTS = {
  radio: { name: 'ป้อมยามชายหาดบางแสน', x: lonToX(100.928), z: latToZ(13.279), keepOut: 6 },
  tower: { name: 'เสาส่งสัญญาณเขาศรีราชา', x: lonToX(100.975), z: latToZ(13.16), keepOut: 10 },
  camp: { name: 'ศูนย์อพยพ ฐานทัพเรือสัตหีบ', x: lonToX(100.945), z: latToZ(12.665), size: 36, keepOut: 26 },
};

export const LOOT_TABLE = [
  ['canned', 18], ['bottle', 14], ['clean_water', 12], ['cloth', 16], ['scrap', 16],
  ['bandage', 9], ['antibiotic', 3], ['herb', 6], ['raw_fish', 4], ['coconut', 4],
  ['seeds_corn', 7], ['seeds_veg', 7], ['seeds_tomato', 4], ['seeds_chili', 4], ['seeds_potato', 3], ['seeds_cabbage', 3], ['seeds_carrot', 3], ['seeds_eggplant', 3], ['seeds_pumpkin', 2], ['seeds_watermelon', 2], ['seeds_rice', 4], ['rice', 6], ['plus_stone', 3], ['seeds_sunflower', 3], ['seeds_marigold', 3], ['seeds_rose', 1], ['seeds_jasmine', 1], ['flower_pot', 2], ['hoe', 2], ['jicoin', 10], ['fuel', 4], ['rag', 8], ['zipper', 5], ['sneakers', 1], ['jeans', 1], ['hat_cloth', 1], ['copper_wire', 4], ['spark_plug', 2], ['moto_wheel', 1], ['battery_pack', 1],
];

// กล่องเสบียงในสถานที่พิเศษ: ห้างร้าง โรงงานร้าง มหาวิทยาลัยร้าง ฐานทัพเรือ
export const SPECIAL_LOOT = {
  mall: [['canned', 14], ['clean_water', 10], ['jeans', 6], ['sneakers', 6], ['hat_cloth', 5], ['bag_cloth', 5], ['bag_hiking', 2], ['jacket_leather', 2], ['phone', 2], ['battery_pack', 3], ['cloth', 10], ['zipper', 6], ['jicoin', 16], ['energy_drink', 4], ['guitar', 1], ['ring', 2]],
  factory: [['scrap', 22], ['copper_wire', 14], ['spark_plug', 8], ['battery_pack', 6], ['fuel', 10], ['zipper', 4], ['engine', 1], ['moto_engine', 2], ['steering_wheel', 3], ['wheel', 4], ['pickaxe', 2], ['iron_pickaxe', 1], ['hammer', 2], ['solar_panel', 1], ['jicoin', 8]],
  edu: [['book_med', 7], ['book_eng', 7], ['book_agri', 7], ['book_cs', 6], ['book_elec', 6], ['book_cook', 7], ['book_wicker', 2], ['lab_kit', 10], ['herbal_med', 6], ['bandage', 6], ['clean_water', 8], ['phone', 2], ['copper_wire', 6], ['jicoin', 10]],
  mil: [['kevlar', 8], ['vest_kevlar', 3], ['helmet_mil', 5], ['pants_cargo', 5], ['navy_uniform', 4], ['combat_boots', 4], ['bag_military', 3], ['shield_riot', 3], ['bolt_steel', 8], ['bolt_heavy', 4], ['arrow_iron', 8], ['antibiotic', 6], ['first_aid', 4], ['canned', 10], ['clean_water', 8], ['fuel', 6], ['jicoin', 14]],
};
export const NPCS = [
  { id: 'npc_mali', name: 'มะลิ', sex: 'f', town: 'bangsaen', likes: 'herb', job: 'doctor', bio: 'พยาบาลจากโรงพยาบาลชลบุรี' },
  { id: 'npc_somchai', name: 'สุนทร', sex: 'm', town: 'chonburi', likes: 'scrap', job: 'mechanic', bio: 'ช่างซ่อมรถย่านตลาดหนองมน' },
  { id: 'npc_napa', name: 'นภา', sex: 'f', town: 'pattaya', likes: 'canned', job: 'entertainer', bio: 'นักเต้นที่ติดอยู่ในพัทยา' },
  { id: 'npc_boonmee', name: 'บุญมี', sex: 'm', town: 'sriracha', likes: 'raw_fish', job: 'fisher', bio: 'ชาวประมงเกาะลอย ศรีราชา' },
  { id: 'npc_kaew', name: 'แก้ว', sex: 'f', town: 'sattahip', likes: 'clean_water', job: 'hunter', bio: 'อดีตทหารเรือสัตหีบ' },
  { id: 'npc_ton', name: 'ต้น', sex: 'm', town: 'phanat', likes: 'berry', job: 'it', bio: 'นักศึกษาวิศวะคอมพิวเตอร์ ม.บูรพา' },
  { id: 'npc_plaifah', name: 'ปลายฟ้า', sex: 'f', town: 'banbueng', likes: 'coconut', job: 'farmer', bio: 'ครูอนุบาลบ้านบึงที่ปลูกผักเลี้ยงเด็ก ๆ' },
  { id: 'npc_james', name: 'เจมส์', sex: 'm', town: 'jomtien', likes: 'cooked_meat', job: 'athlete', bio: 'นักไตรกีฬาที่กลับบ้านไม่ได้' },
  { id: 'npc_somsak', name: 'สมศักดิ์', sex: 'm', town: 'laemchabang', likes: 'scrap', job: 'engineer', bio: 'ช่างกลโรงงานท่าเรือแหลมฉบัง' },
  { id: 'npc_daeng', name: 'แดง', sex: 'f', town: 'banglamung', likes: 'wood', job: 'builder', bio: 'ผู้รับเหมาก่อสร้างหญิงแกร่งแห่งบางละมุง' },
  { id: 'npc_noi', name: 'ป้าน้อย', sex: 'f', town: 'chonburi', likes: 'veg', job: 'chef', bio: 'แม่ครัวร้านข้าวหลามหนองมน' },
  { id: 'npc_chai', name: 'ช่างชัย', sex: 'm', town: 'sriracha', likes: 'copper_wire', job: 'electrician', bio: 'ช่างไฟฟ้านิคมอุตสาหกรรมศรีราชา ติดโซล่าเซลล์เป็นอาชีพ' },
  // ผู้ติดต่อภารกิจหลักของแต่ละอำเภอ (รู้รหัสประตูค่ายกักกัน)
  { id: 'npc_somchai_sgt', name: 'จ่าสมชาย', sex: 'm', town: 'chonburi', likes: 'clean_water', job: 'hunter', bio: 'จ่าทหารบกประจำค่ายกองทัพบกชลบุรี' },
  { id: 'npc_weera', name: 'สิบเอกวีระ', sex: 'm', town: 'phanthong', likes: 'canned', job: 'hunter', bio: 'ทหารบกที่หนีออกมาจากค่ายกองทัพบก' },
  { id: 'npc_kru_ae', name: 'ครูเอ', sex: 'f', town: 'sriracha', likes: 'clean_water', job: 'athlete', bio: 'ผู้กำกับลูกเสือประจำค่ายลูกเสือศรีราชา' },
  { id: 'npc_sara', name: 'หมอซาร่า', sex: 'f', town: 'phanat', likes: 'herb', job: 'doctor', bio: 'อาสาสมัครแพทย์ประจำศูนย์ลี้ภัยต่างด้าวพนัสนิคม' },
  { id: 'npc_saengduan', name: 'ป้าแสงเดือน', sex: 'f', town: 'bothong', likes: 'clean_water', job: 'doctor', bio: 'อาสากาชาดประจำศูนย์ลี้ภัยต่างด้าวบ่อทอง' },
  { id: 'npc_winai', name: 'พี่วินัย', sex: 'm', town: 'nongyai', likes: 'fuel', job: 'mechanic', bio: 'นายท่าสถานีขนส่งจังหวัดชลบุรี' },
  { id: 'npc_prasit', name: 'อาจารย์ประสิทธิ์', sex: 'm', town: 'banbueng', likes: 'scrap', job: 'engineer', bio: 'อาจารย์แผนกช่างกลโรงเรียนเทคนิคชลบุรี' },
  { id: 'npc_waew', name: 'ยายแวว', sex: 'f', town: 'phanat', likes: 'bamboo', job: 'weaver', teach: 'wicker', bio: 'ช่างจักสานฝีมือดีแห่งตลาดจักสานพนัสนิคม สอนสานตะกร้า ชะลอม พัด และผนังไม้ไผ่' },
  { id: 'npc_boonsong', name: 'ช่างบุญส่ง', sex: 'm', town: 'phanthong', likes: 'scrap', job: 'blacksmith', bio: 'ช่างตีเหล็กจากย่านโรงงานพานทอง รับตีบวกอาวุธ ชุด และอุปกรณ์สัตว์เลี้ยง' },
  { id: 'npc_kham', name: 'ลุงคำ', sex: 'm', town: 'banbueng', likes: 'cooked_rice', job: 'ricefarmer', bio: 'ชาวนาเก่าแก่แห่งบ้านบึง รู้เรื่องการทำนาทุกขั้นตอน' },
  { id: 'npc_tham', name: 'หลวงพี่ธรรม', sex: 'm', town: 'phanat', likes: 'herb', job: 'monk', celibate: true, bio: 'พระสงฆ์วัดในพนัสนิคม คอยให้ที่พักใจผู้รอดชีวิต' },
];
// ร้านแลกของของ NPC ตามอาชีพ: [ไอเท็ม, ราคา(แต้มมูลค่า), จำนวนต่อวัน]
// จ่ายด้วยการแลกของ: ของที่เอามาแลกคิดมูลค่า 80% · ยิ่งสนิทยิ่งได้ส่วนลด (สูงสุด 25%)
export const SHOPS = {
  doctor: [['bandage', 8, 5], ['herbal_med', 10, 4], ['splint', 8, 3], ['antibiotic', 24, 2], ['first_aid', 32, 1]],
  mechanic: [['fuel', 8, 4], ['scrap', 5, 8], ['spark_plug', 7, 3], ['steering_wheel', 9, 2], ['wheel', 10, 4], ['moto_wheel', 6, 4], ['moto_engine', 22, 1], ['bicycle', 35, 1], ['motorbike', 90, 1]],
  entertainer: [['guitar', 30, 1], ['calm_tea', 8, 4], ['canned', 8, 4], ['coconut_dessert', 18, 2]],
  fisher: [['raw_fish', 4, 8], ['rod', 8, 2], ['rod_pro', 30, 1], ['big_fish', 12, 3], ['net', 14, 1]],
  hunter: [['spear', 12, 2], ['hide', 6, 4], ['raw_meat', 5, 6], ['shield_wood', 10, 2], ['hunter_cloak', 36, 1]],
  it: [['respec_potion', 250, 1], ['phone', 40, 1], ['zradar', 60, 1], ['drone', 80, 1], ['scrap', 5, 6]],
  farmer: [['seeds_corn', 3, 8], ['seeds_veg', 3, 8], ['seeds_tomato', 3, 6], ['seeds_chili', 3, 6], ['seeds_potato', 4, 6], ['seeds_cabbage', 3, 6], ['seeds_carrot', 3, 6], ['seeds_eggplant', 3, 6], ['seeds_pumpkin', 4, 4], ['seeds_watermelon', 4, 4], ['seeds_rice', 3, 6], ['seeds_sunflower', 4, 4], ['seeds_marigold', 4, 4], ['seeds_rose', 8, 2], ['seeds_orchid', 10, 2], ['seeds_jasmine', 6, 3], ['seeds_tulip', 10, 2], ['hoe', 6, 2], ['flower_pot', 6, 3], ['egg', 4, 4], ['duck_egg', 5, 3], ['duck_feather', 3, 6], ['honey', 12, 2], ['corn', 4, 6], ['veg', 4, 6]],
  athlete: [['energy_drink', 10, 3], ['protein_meal', 14, 2], ['sneakers', 14, 1], ['socks_wool', 8, 2]],
  engineer: [['pickaxe', 10, 2], ['iron_pickaxe', 30, 1], ['stone_axe', 10, 2], ['stone_hammer', 8, 2], ['hammer', 10, 2], ['steel_axe', 36, 1], ['torch', 5, 4]],
  builder: [['wood', 2, 20], ['stone', 2, 20], ['wood_hammer', 5, 2], ['hammer', 10, 1]],
  chef: [['cooked_meat', 8, 4], ['clean_water', 6, 4], ['kaprao', 20, 2], ['tomyum_kung', 25, 2], ['big_meal', 26, 1]],
  electrician: [['copper_wire', 4, 8], ['battery_pack', 14, 2], ['spark_plug', 7, 3], ['solar_panel', 45, 1], ['ev_battery', 55, 1]],
  weaver: [['bamboo', 1, 20], ['wicker_basket', 14, 1], ['chalom', 9, 2], ['hand_fan', 6, 3], ['book_wicker', 60, 1]],
  blacksmith: [['scrap', 5, 10], ['hammer', 10, 1], ['iron_pickaxe', 30, 1], ['steel_axe', 36, 1], ['shield_wood', 10, 1]],
  ricefarmer: [['seeds_rice', 3, 10], ['paddy', 3, 10], ['rice', 4, 8], ['rice_bran', 2, 10], ['hoe', 6, 2], ['cooked_rice', 7, 4]],
  monk: [['respec_potion', 250, 1], ['calm_tea', 6, 4], ['herbal_med', 10, 3], ['amulet', 30, 1], ['prayer_beads', 25, 1]],
};

export const PET_TYPES = {
  dog: { name: 'สุนัข', foods: ['raw_meat', 'cooked_meat', 'raw_fish', 'canned'], perk: 'ช่วยกัดผู้ติดเชื้อ', base: { hp: 40, atk: 9 } },
  cat: { name: 'แมว', foods: ['raw_fish', 'grilled_fish', 'canned'], perk: 'ล่าหนูนำเนื้อมาให้', base: { hp: 26, atk: 5 } },
  bird: { name: 'นกขุนทอง', foods: ['berry'], perk: 'บินสอดแนม เห็นศัตรูบนแผนที่', base: { hp: 16, atk: 3 } },
  // สัตว์ป่าที่จับมาเลี้ยงด้วยแห (เลี้ยงได้ 1 ตัว)
  deer: { name: 'กวาง', foods: ['berry', 'veg', 'corn'], perk: 'ว่องไว: คุณฟื้นสตามิน่าเร็วขึ้นเมื่ออยู่ใกล้', base: { hp: 34, atk: 4 }, wild: true, innate: 'swift' },
  boar: { name: 'หมูป่า', foods: ['corn', 'veg', 'raw_meat'], perk: 'บึกบึน: พุ่งชนผู้ติดเชื้อและช่วยรับดาเมจแทน', base: { hp: 60, atk: 10 }, wild: true, innate: 'guardian', fight: true },
  chicken: { name: 'ไก่', foods: ['corn', 'berry', 'seeds_corn'], perk: 'ออกไข่ทุก 3 นาที', base: { hp: 14, atk: 2 }, wild: true },
  raptor: { name: 'แร็พเตอร์', foods: ['raw_meat', 'raw_fish', 'cooked_meat'], perk: 'นักล่าดึกดำบรรพ์: กัดแรงมาก', base: { hp: 70, atk: 18 }, wild: true, fight: true },
  trike: { name: 'ไทรเซอราทอปส์', foods: ['veg', 'corn', 'berry', 'pineapple'], perk: 'ร่างยักษ์กินพืช: ทนมาก ช่วยชนผู้ติดเชื้อ', base: { hp: 150, atk: 14 }, wild: true, fight: true, innate: 'guardian' },
  tiger: { name: 'เสือโคร่ง', foods: ['raw_meat', 'raw_fish'], perk: 'นักล่าเงียบ: กัดแรง ว่องไว', base: { hp: 80, atk: 16 }, wild: true, fight: true, innate: 'swift' },
  buffalo: { name: 'ควาย', foods: ['fiber', 'raw_fiber', 'veg', 'corn', 'rice'], perk: 'ขี่ได้! (กด E ที่ควายของคุณ) วิ่งเร็วไม่เสียสตามิน่า', base: { hp: 120, atk: 8 }, wild: true, ride: true, innate: 'guardian' },
  sheep: { name: 'แกะ', foods: ['fiber', 'raw_fiber', 'veg', 'corn'], perk: 'ขนนุ่ม: ปลอบใจเจ้าของ', base: { hp: 30, atk: 2 }, wild: true, innate: 'calm' },
};
// สัตว์ป่าในแผนที่ (ใช้ร่วมกันทั้งเครื่องผู้เล่นและเซิร์ฟเวอร์)
// hostile = ไล่ทำร้ายผู้เล่นในระยะนี้ · angryHit = โกรธเมื่อโดนตี · net = จับด้วยแหได้
export const WILD = {
  // diet: herb = กินพืช (ไม่ทำร้ายใครก่อน) · meat = กินเนื้อ (ไล่ล่า) · omni = กินทั้งสองอย่าง (สู้กลับเมื่อโดนตี)
  // leash = รัศมีอาณาเขตจากจุดเกิด · noTown = ไม่เดินเข้าเมือง
  boar: { name: 'หมูป่า', hp: 35, flee: 6, fleeSpd: 4.5, angryHit: true, dmg: 6, diet: 'omni', leash: 70 },
  deer: { name: 'กวาง', hp: 25, flee: 12, fleeSpd: 6.5, diet: 'herb', leash: 80 },
  chicken: { name: 'ไก่ป่า', hp: 8, flee: 12, fleeSpd: 3.5, diet: 'herb', leash: 50 },
  tiger: { name: 'เสือโคร่ง', hp: 90, hostile: 18, chase: 6.5, dmg: 14, bleed: 0.3, diet: 'meat', leash: 55, noTown: true },
  raptor: { name: 'แร็พเตอร์', hp: 70, hostile: 22, chase: 6.2, dmg: 12, bleed: 0.3, dino: true, diet: 'meat', leash: 45, noTown: true },
  trike: { name: 'ไทรเซอราทอปส์', hp: 170, angryHit: true, chase: 4.2, dmg: 18, flee: 0, dino: true, diet: 'herb', leash: 45, noTown: true },
  // สัตว์ประจำถิ่น (เกิดเฉพาะบางอำเภอ ดู REGION_FAUNA)
  elephant: { name: 'ช้างป่า', hp: 400, angryHit: true, chase: 4.5, dmg: 22, flee: 0, diet: 'herb', leash: 60, noTown: true, big: true },
  buffalo: { name: 'ควาย', hp: 90, angryHit: true, chase: 4, dmg: 10, flee: 0, diet: 'herb', leash: 45 },
  sheep: { name: 'แกะ', hp: 20, flee: 9, fleeSpd: 4, diet: 'herb', leash: 30 },
};
// สัตว์ป่าเฉพาะถิ่น: อยู่ในรัศมี r (เท่าของรัศมีเมือง) ของอำเภอนั้น มีโอกาส p ที่สัตว์ที่เกิดจะเป็นชนิดนี้
export const REGION_FAUNA = [
  { town: 'bothong', k: 'elephant', p: 0.45, r: 2.6 },
  { town: 'nongyai', k: 'buffalo', p: 0.45, r: 2.4 },
  { town: 'banbueng', k: 'buffalo', p: 0.4, r: 2.2 },
  { town: 'banglamung', k: 'sheep', p: 0.6, r: 2.2 },
];

// ความสามารถพิเศษของสัตว์เลี้ยง (สุ่มตอนทำให้เชื่อง แต่ละตัวได้ไม่เหมือนกัน)
export const PET_TRAITS = {
  healer: { name: 'หมอประจำตัว', icon: '💗', desc: 'ทุก 90 วินาที ฟื้นพลังชีวิตเจ้าของ 8' },
  forager: { name: 'นักหาของ', icon: '🌿', desc: 'ทุก 2 นาที หาสมุนไพร/ผลไม้/ใยพืช/ไม้มาให้' },
  fisher: { name: 'นักจับปลา', icon: '🐟', desc: 'ทุก 150 วินาที จับปลามาให้' },
  guardian: { name: 'ผู้พิทักษ์', icon: '🛡️', desc: 'อยู่ใกล้ ๆ แล้วเจ้าของได้รับความเสียหายลดลง 15%' },
  sniffer: { name: 'จมูกไว', icon: '👃', desc: 'เห็นกล่องเสบียงใกล้ ๆ บนแผนที่ย่อ' },
  alarm: { name: 'สัญญาณเตือนภัย', icon: '🔔', desc: 'ส่งเสียงเตือนเมื่อผู้ติดเชื้อเข้าใกล้' },
  lucky: { name: 'นำโชค', icon: '🍀', desc: 'ค้นกล่องเสบียงมีโอกาส 30% ได้ของเพิ่ม' },
  medic: { name: 'นักสมุนไพร', icon: '🧪', desc: 'ทุก 60 วินาที ลดการติดเชื้อของเจ้าของ 6%' },
  calm: { name: 'ปลอบใจ', icon: '🫶', desc: 'อยู่ใกล้แล้วได้บัฟ "มีกำลังใจ" เหมือนอยู่กับครอบครัว' },
  swift: { name: 'ว่องไว', icon: '💨', desc: 'สตามิน่าของเจ้าของฟื้นเร็วขึ้น 25%' },
  brave: { name: 'ใจกล้า', icon: '🔥', desc: 'เข้าสู้กับผู้ติดเชื้อ (แม้จะเป็นแมวหรือนก)' },
  thief: { name: 'จอมแอบหยิบ', icon: '🦝', desc: 'ทุก 150 วินาที แอบหยิบเศษเหล็กหรือผ้ามาให้' },
};
export const PET_RARITY = [
  { key: 'common', name: 'ธรรมดา', color: '#ced4da', traits: 1, mul: 1, w: 68 },
  { key: 'rare', name: 'หายาก', color: '#4cc9f0', traits: 2, mul: 1.15, w: 26 },
  { key: 'legend', name: 'ตำนาน', color: '#ffd60a', traits: 3, mul: 1.3, w: 6 },
];
export const PET_SLOTS = { head: '🎩 หมวก', neck: '📿 ปลอกคอ', body: '🦺 ชุด', weapon: '🗡️ อาวุธ', feet: '🐾 รองเท้า' };
export const petLevel = (xp) => Math.min(20, Math.floor(Math.sqrt((xp || 0) / 30)) + 1);

export const CHILD_NAMES = ['น้ำหวาน', 'ต้นกล้า', 'ข้าวหอม', 'ภูผา', 'ฟ้าใส', 'ทะเล', 'ใบบัว', 'ก้องภพ', 'แสงดาว', 'ชลธี'];

export const RADIO = [
  'วิทยุ: "...ศูนย์อพยพที่ค่ายทหารเรือสัตหีบยังเปิดรับผู้รอดชีวิต..."',
  'วิทยุ: "...ห้ามดื่มน้ำจากแหล่งน้ำโดยไม่ต้มก่อน เชื้อแพร่ทางน้ำ..."',
  'วิทยุ: "...พบผู้ติดเชื้อจำนวนมากในเขตเมืองพัทยา หลีกเลี่ยงตอนกลางคืน..."',
  'วิทยุ: "...สัญญาณจากกรุงเทพฯ ขาดหายไปเป็นวันที่สามแล้ว..."',
  'วิทยุ: "...อ่างเก็บน้ำบางพระยังเป็นแหล่งน้ำจืดที่ใช้ได้..."',
  'วิทยุ: "...ถ้าใครได้ยิน... อยู่ด้วยกันไว้ อย่าอยู่คนเดียว..."',
];
