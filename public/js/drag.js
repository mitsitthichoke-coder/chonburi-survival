// ลากย้ายหน้าต่างเมนู (จับที่แถบหัวข้อ) · จำตำแหน่งไว้ · ดับเบิลคลิกแถบหัวข้อ = รีเซ็ตกลับกลางจอ
const SPECS = [
  { id: 'panel', handle: '.tabs', key: 'jc_win_panel', mark: (el) => el },
  { id: 'guide-modal', handle: '.ghead', key: 'jc_win_guide', mark: (el) => el.querySelector('.gbox') },
];
const mobile = () => matchMedia('(max-width: 700px)').matches;
const load = (k) => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch { return null; } };
const save = (k, v) => { try { v ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.removeItem(k); } catch { /* ไม่เป็นไร */ } };

function apply(sp, d) {
  const root = document.getElementById(sp.id), el = root && sp.mark(root); if (!el) return;
  if (d && !mobile()) { el.style.setProperty('--dx', d.x + 'px'); el.style.setProperty('--dy', d.y + 'px'); root.setAttribute('data-moved', '1'); }
  else { el.style.removeProperty('--dx'); el.style.removeProperty('--dy'); root.removeAttribute('data-moved'); }
}
function clamp(sp, d) { // ไม่ให้หัวข้อหลุดออกนอกจอ
  const lim = Math.max(120, innerWidth / 2 - 60), limY = Math.max(120, innerHeight / 2 - 30);
  return { x: Math.max(-lim * 2 + 60, Math.min(lim * 2 - 60, d.x)), y: Math.max(-limY * 2 + 30, Math.min(limY * 2 - 30, d.y)) };
}

export function initDrag() {
  for (const sp of SPECS) {
    const root = document.getElementById(sp.id); if (!root) continue;
    let pos = load(sp.key); apply(sp, pos);
    root.addEventListener('pointerdown', (e) => {
      const h = e.target.closest(sp.handle); if (!h || !root.contains(h) || e.target.closest('button,input,select,textarea,a') || mobile()) return;
      const sx = e.clientX, sy = e.clientY, ox = pos?.x || 0, oy = pos?.y || 0; h.setPointerCapture?.(e.pointerId);
      const mv = (m) => { pos = clamp(sp, { x: ox + m.clientX - sx, y: oy + m.clientY - sy }); apply(sp, pos); };
      const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); save(sp.key, pos); };
      h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    });
    root.addEventListener('dblclick', (e) => { const h = e.target.closest(sp.handle); if (!h || e.target.closest('button,input,select')) return; pos = null; apply(sp, null); save(sp.key, null); });
  }
}
