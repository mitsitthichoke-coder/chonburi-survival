// ธีมของเกม: 'apocalypse' = โลกล่มสลาย (ค่าเริ่มต้น) · 'halloween' = คืนฮาโลวีน 🎃 — เซิร์ฟเวอร์เป็นคนกำหนด (เจ้าของสั่ง /theme)
export const THEMES = { apocalypse: '🌆 โลกล่มสลาย', halloween: '🎃 ฮาโลวีน' };
let cur = 'apocalypse';
const subs = [];
export const theme = () => cur;
export const isHalloween = () => cur === 'halloween';
export function setTheme(t) {
  if (!THEMES[t] || t === cur) return;
  cur = t;
  applyBodyClass(); for (const f of subs) f(t);
}
export const onTheme = (f) => subs.push(f);
export function applyBodyClass() { document.body?.classList.toggle('halloween', cur === 'halloween'); }
applyBodyClass();
