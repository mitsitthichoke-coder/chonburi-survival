// ตัวเลือกรูปลักษณ์ตัวละคร (ใช้ร่วมกันทั้งเบราว์เซอร์และเซิร์ฟเวอร์ — เซิร์ฟเวอร์ใช้ตรวจค่าที่ส่งมา)
export const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#fde7d4', '#d9a066', '#b07642', '#6b3e26', '#4a2b1a'];
export const SHIRTS = ['#2e86ab', '#d1495b', '#6a994e', '#e9c46a', '#3d405b', '#f4f1de', '#9b5de5', '#f15bb5', '#00bbf9', '#fb8500', '#1b1b1b', '#8d0801', '#2a9d8f', '#bc6c25'];
export const HAIRS = ['#1b1b1b', '#4a2c1a', '#8d5524', '#d4a373', '#c0c0c0', '#7b2cbf', '#f2e8cf', '#b5651d', '#a4161a', '#f15bb5', '#0077b6', '#2d6a4f', '#ffffff'];
export const PANTS = ['#3d405b', '#1d3557', '#222222', '#6c584c', '#a98467', '#457b9d', '#588157', '#9a8c98'];
export const HAIR_STYLES = { short: 'สั้น', buzz: 'เกรียน', spiky: 'ตั้งชี้', mohawk: 'โมฮอว์ก', afro: 'แอฟโฟร', curly: 'หยิก', sidepart: 'แสกข้าง', undercut: 'อันเดอร์คัต', mullet: 'มัลเล็ต', pixie: 'พิกซี่', bob: 'บ็อบ', long: 'ยาว', ponytail: 'หางม้า', bun: 'มวยผม', twin: 'แกะสองข้าง', braid: 'ถักเปีย', bald: 'โล้น' };
export const EYES = { normal: 'ปกติ', round: 'ตากลมโต', sleepy: 'ตาง่วง', sharp: 'ตาคม', happy: 'ตายิ้ม', wink: 'ขยิบตา' };
export const MOUTHS = { smile: 'ยิ้ม', flat: 'เฉย', grin: 'ยิ้มกว้าง', open: 'อ้าปาก', smirk: 'มุมปาก', frown: 'บึ้ง' };
export const BROWS = { none: 'ไม่มี', thin: 'บาง', thick: 'หนา', angry: 'ขมวด' };
export const EXTRAS = { none: 'ไม่มี', glasses: 'แว่นตา', sunglasses: 'แว่นกันแดด', beard: 'เครา', mustache: 'หนวด', goatee: 'เคราแพะ', freckles: 'กระ', blush: 'แก้มแดง', scar: 'แผลเป็น', bandana: 'ผ้าคาดหัว' };

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const keys = Object.keys;
export function randomLook(sex, rand = Math.random) {
  const styles = keys(HAIR_STYLES).filter((k) => k !== 'bald' || rand() < 0.3);
  const extras = keys(EXTRAS).filter((k) => sex === 'm' || !['beard', 'mustache', 'goatee'].includes(k));
  return { skin: pick(rand, SKINS), shirt: pick(rand, SHIRTS), hair: pick(rand, HAIRS), pants: pick(rand, PANTS), style: pick(rand, styles), eyes: pick(rand, keys(EYES)), mouth: pick(rand, keys(MOUTHS)), brows: pick(rand, keys(BROWS)), extra: rand() < 0.45 ? 'none' : pick(rand, extras) };
}
// ตรวจค่าที่ผู้เล่นส่งมา (กันค่าแปลก ๆ)
export function cleanLook(l) {
  const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
  const en = (o, v) => (typeof v === 'string' && Object.hasOwn(o, v) ? v : undefined);
  return { skin: hex(l?.skin, '#e0ac69'), shirt: hex(l?.shirt, '#2e86ab'), hair: hex(l?.hair, '#1b1b1b'), pants: hex(l?.pants, '#3d405b'), style: en(HAIR_STYLES, l?.style), eyes: en(EYES, l?.eyes), mouth: en(MOUTHS, l?.mouth), brows: en(BROWS, l?.brows), extra: en(EXTRAS, l?.extra) };
}

// 🎭 หน้าตา/ชุดมาตรฐานของแต่ละอาชีพ (ตามการ์ดอาชีพ) — ใช้เมื่อผู้เล่นไม่ได้ปรับแต่งหน้าตาเอง
const JL = (shirt, pants, hair, style, extra = 'none', o = {}) => ({ skin: '#f1c27d', shirt, pants, hair, style, eyes: 'normal', mouth: 'smile', brows: 'thin', extra, ...o });
export const JOB_LOOKS = {
  engineer: JL('#f4f1de', '#1d3557', '#4a2c1a', 'sidepart'), mechanic: JL('#d1495b', '#1d3557', '#4a2c1a', 'short'),
  farmer: JL('#f4f1de', '#1d3557', '#1b1b1b', 'sidepart'), fisher: JL('#e9c46a', '#6c584c', '#1b1b1b', 'short'),
  builder: JL('#d1495b', '#1d3557', '#4a2c1a', 'short', 'none', { brows: 'thick' }), hunter: JL('#6c584c', '#6c584c', '#4a2c1a', 'mullet', 'none', { eyes: 'sharp' }),
  it: JL('#1b1b1b', '#222222', '#1b1b1b', 'sidepart', 'glasses'), monk: JL('#fb8500', '#fb8500', '#1b1b1b', 'bald', 'none', { eyes: 'sleepy', mouth: 'flat' }),
  electrician: JL('#f4f1de', '#1d3557', '#1b1b1b', 'spiky'), doctor: JL('#f4f1de', '#222222', '#1b1b1b', 'sidepart', 'glasses'),
  entertainer: JL('#9b5de5', '#3d405b', '#a4161a', 'curly', 'none', { mouth: 'grin' }), athlete: JL('#d1495b', '#6c584c', '#4a2c1a', 'short', 'bandana', { brows: 'thick' }),
  livestock: JL('#6a994e', '#6c584c', '#8d5524', 'short'), ricefarmer: JL('#d1495b', '#a98467', '#4a2c1a', 'ponytail', 'freckles'),
  blacksmith: JL('#3d405b', '#222222', '#1b1b1b', 'short', 'beard', { brows: 'thick' }), chef: JL('#f4f1de', '#3d405b', '#1b1b1b', 'short'),
  developer: JL('#3d405b', '#222222', '#1b1b1b', 'buzz', 'glasses'), freelancer: JL('#2e86ab', '#3d405b', '#1b1b1b', 'short'),
};
export const jobLook = (job, sex) => { const l = { ...(JOB_LOOKS[job] || JOB_LOOKS.freelancer) }; if (sex === 'f' && ['short', 'sidepart', 'buzz', 'mullet', 'spiky', 'bald'].includes(l.style)) l.style = 'bob'; if (sex === 'f') l.extra = ['beard', 'mustache', 'goatee'].includes(l.extra) ? 'none' : l.extra; return l; };
