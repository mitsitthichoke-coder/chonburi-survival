// หน้าต่างคู่มือเกม (ใช้ทั้งหน้าเมนูและในเกม)
import { guideSections, mdToHtml } from './guide.js';
let cur = 'start';
export function openGuide(sec) {
  const S = guideSections(), m = document.getElementById('guide-modal'); if (!m) return;
  if (sec) cur = sec;
  const draw = () => {
    document.getElementById('guide-nav').innerHTML = S.map((s) => `<button data-g="${s.id}" class="${s.id === cur ? 'on' : ''}">${s.title}</button>`).join('');
    const s = S.find((x) => x.id === cur) || S[0];
    const b = document.getElementById('guide-body'); b.innerHTML = `<h3>${s.title}</h3>` + mdToHtml(s.md); b.scrollTop = 0;
  };
  draw(); m.hidden = false; document.exitPointerLock?.();
  document.getElementById('guide-nav').onclick = (e) => { const g = e.target.closest('[data-g]')?.dataset.g; if (g) { cur = g; draw(); } };
  document.getElementById('guide-close').onclick = () => { m.hidden = true; };
  m.onclick = (e) => { if (e.target === m) m.hidden = true; };
  ['keydown', 'pointerdown', 'mousedown', 'wheel', 'touchstart'].forEach((t) => m.addEventListener(t, (ev) => { ev.stopPropagation(); if (t === 'keydown' && ev.key === 'Escape') m.hidden = true; }));
}
