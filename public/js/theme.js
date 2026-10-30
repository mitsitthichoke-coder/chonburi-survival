// ธีมของเกม: 'apocalypse' = โลกล่มสลาย (ค่าเริ่มต้น) · 'halloween' = คืนฮาโลวีน 🎃 — เซิร์ฟเวอร์เป็นคนกำหนด (เจ้าของสั่ง /theme)
export const THEMES = { apocalypse: '🌆 โลกล่มสลาย', halloween: '🎃 ฮาโลวีน', christmas: '🎄 คริสต์มาส', newyear: '🎆 ปีใหม่ 2027' };
let cur = 'apocalypse';
try { const q = new URLSearchParams(location.search).get('theme'); if (q && THEMES[q]) cur = q; } catch { /* ignore */ } // ?theme=christmas ไว้ทดลองดูธีมในเครื่อง
const subs = [];
export const theme = () => cur;
export const isHalloween = () => cur === 'halloween';
export function setTheme(t) {
  if (!THEMES[t] || t === cur) return;
  cur = t;
  applyBodyClass(); for (const f of subs) f(t);
}
export const onTheme = (f) => subs.push(f);
export function applyBodyClass() { for (const k of ['halloween', 'christmas', 'newyear']) document.body?.classList.toggle(k, cur === k); }
applyBodyClass();
