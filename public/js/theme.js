// ธีมของเกม: 'apocalypse' = โลกล่มสลาย (ค่าเริ่มต้น) · 'halloween' = คืนฮาโลวีน 🎃 — สลับกลับได้ตลอด จำไว้ในเครื่อง
const KEY = 'cbs_theme';
export const THEMES = { apocalypse: '🌆 โลกล่มสลาย', halloween: '🎃 ฮาโลวีน' };
let cur = 'apocalypse';
try { const v = localStorage.getItem(KEY); if (THEMES[v]) cur = v; } catch { /* storage blocked */ }
// remote = ธีมที่เซิร์ฟเวอร์/โฮสต์กำหนด (ไม่จำไว้ในเครื่อง)
const subs = [];
export const theme = () => cur;
export const isHalloween = () => cur === 'halloween';
export function setTheme(t, remote = false) {
  if (!THEMES[t] || t === cur) return;
  cur = t; if (!remote) try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  applyBodyClass(); for (const f of subs) f(t);
}
export const onTheme = (f) => subs.push(f);
export function applyBodyClass() { document.body?.classList.toggle('halloween', cur === 'halloween'); }
applyBodyClass();
