// ธีมของเกม: 'apocalypse' = โลกล่มสลาย (ค่าเริ่มต้น) · 'halloween' = คืนฮาโลวีน 🎃 — สลับกลับได้ตลอด จำไว้ในเครื่อง
const KEY = 'cbs_theme';
export const THEMES = { apocalypse: '🌆 โลกล่มสลาย', halloween: '🎃 ฮาโลวีน' };
let cur = 'apocalypse';
try { const v = localStorage.getItem(KEY); if (THEMES[v]) cur = v; } catch { /* storage blocked */ }
const subs = [];
export const theme = () => cur;
export const isHalloween = () => cur === 'halloween';
export function setTheme(t) {
  if (!THEMES[t] || t === cur) return;
  cur = t; try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  applyBodyClass(); for (const f of subs) f(t);
}
export const onTheme = (f) => subs.push(f);
export function applyBodyClass() { document.body?.classList.toggle('halloween', cur === 'halloween'); }
applyBodyClass();
