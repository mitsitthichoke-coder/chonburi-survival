// ระบบความสัมพันธ์ (ใช้ร่วมกันทั้งฝั่งเซิร์ฟเวอร์และไคลเอนต์)
export const REL_LEVELS = [
  { key: 'stranger', name: 'ไม่รู้จัก', min: 0, color: '#9aa3ad' },
  { key: 'acquaint', name: 'คุ้นเคย', min: 20, color: '#8ecae6' },
  { key: 'friend', name: 'เพื่อน', min: 60, color: '#90be6d' },
  { key: 'close', name: 'เพื่อนสนิท', min: 120, color: '#f9c74f' },
  { key: 'lover', name: 'คนรัก', min: 150, color: '#f28482' },
  { key: 'family', name: 'ครอบครัว', min: 250, color: '#c77dff' },
];

export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const newRel = () => ({ pts: 0, bond: 'none', cd: {} });

export function relLevel(r) {
  if (!r) return 0;
  if (r.bond === 'family') return 5;
  if (r.bond === 'lover') return 4;
  let l = 0;
  for (let i = 0; i <= 3; i++) if (r.pts >= REL_LEVELS[i].min) l = i;
  return l;
}
export const relName = (r) => REL_LEVELS[relLevel(r)].name;
export const relColor = (r) => REL_LEVELS[relLevel(r)].color;

// แต้มความสัมพันธ์จากของขวัญ: ดอกไม้ได้มากเป็นพิเศษ (ช่อดอกไม้/พวงมาลัยสูงสุด)
export const giftValue = (it, liked) => !it ? 2 : it.flower ? Math.min(40, Math.max(12, it.value * 2) * (liked ? 1.5 : 1)) : Math.min(20, (it.value || 1) * (liked ? 3 : 1));
// การกระทำที่ทำกับอีกฝ่ายได้
export const ACTIONS = {
  talk: { label: '💬 พูดคุย', minLvl: 0, pts: 2, cd: 30 },
  gift: { label: '🎁 ให้ของขวัญ', minLvl: 0 },
  heal: { label: '🩹 ทำแผลให้', minLvl: 0, pts: 8 },
  hug: { label: '🤗 กอด', minLvl: 2, pts: 4, cd: 60 },
  follow: { label: '🚶 ชวนร่วมทาง', minLvl: 2, npcOnly: true },
  propose: { label: '💕 สารภาพรัก/ขอเป็นแฟน', minLvl: 3, minPts: 150, consent: true },
  marry: { label: '💍 ขอแต่งงาน (ใช้แหวน)', minLvl: 4, minPts: 250, consent: true, item: 'ring' },
  baby: { label: '👶 วางแผนมีลูก', minLvl: 4, consent: true, shelter: true, opposite: true },
  adopt: { label: '🧸 รับเลี้ยงเด็กกำพร้า', minLvl: 5, consent: true, shelter: true },
  breakup: { label: '💔 เลิกรา', minLvl: 4 },
};

// a, b = {id, sex, pregnant}
export function canDo(action, r, a, b, now = Date.now()) {
  const A = ACTIONS[action];
  if (!A) return { ok: false, why: 'ไม่รู้จักคำสั่ง' };
  const lvl = relLevel(r);
  if (lvl < A.minLvl) return { ok: false, why: `ต้องมีความสัมพันธ์ระดับ "${REL_LEVELS[A.minLvl].name}" ก่อน` };
  if (A.minPts && r.pts < A.minPts) return { ok: false, why: `ความผูกพันยังไม่พอ (${Math.floor(r.pts)}/${A.minPts})` };
  if (A.cd && r.cd && r.cd[action] && now - r.cd[action] < A.cd * 1000) return { ok: false, why: 'เพิ่งทำไปเมื่อสักครู่ รอก่อนนะ' };
  if ((a.celibate || b.celibate) && ['hug', 'propose', 'marry', 'baby'].includes(action)) return { ok: false, why: 'พระสงฆ์ไม่ยุ่งเกี่ยวเรื่องทางโลก 🙏' };
  if (action === 'propose' && r.bond !== 'none') return { ok: false, why: 'เป็นคนรักกันอยู่แล้ว' };
  if (action === 'marry' && r.bond !== 'lover') return { ok: false, why: 'ต้องเป็นคนรักกันก่อน' };
  if (A.opposite) {
    if (a.sex === b.sex || a.sex === 'x' || b.sex === 'x') return { ok: false, why: 'การตั้งครรภ์ต้องเป็นคู่ชาย–หญิง (ลองรับเลี้ยงเด็กกำพร้าแทนได้เมื่อเป็นครอบครัว)' };
    if (a.pregnant || b.pregnant) return { ok: false, why: 'มีคนกำลังตั้งครรภ์อยู่แล้ว' };
  }
  return { ok: true };
}

// ผลของการกระทำ (หลังอีกฝ่ายยินยอมแล้ว ถ้าต้องขอความยินยอม)
export function applyAction(action, r, now = Date.now()) {
  const A = ACTIONS[action];
  r.cd = r.cd || {};
  if (A.cd) r.cd[action] = now;
  if (A.pts) r.pts += A.pts;
  if (action === 'propose') { r.bond = 'lover'; r.pts = Math.max(r.pts, 150); }
  if (action === 'marry') { r.bond = 'family'; r.pts = Math.max(r.pts, 250); }
  if (action === 'breakup') { r.bond = 'none'; r.pts = Math.min(r.pts, 60); }
  return r;
}
