// ปุ่มควบคุมบนมือถือ/แท็บเล็ต: จอยสติ๊กซ้าย, ลากจอขวาเพื่อหมุนกล้อง, หยิกสองนิ้วเพื่อซูม
export const isTouchDevice = () => {
  try { if (new URLSearchParams(location.search).has('touch')) return true; } catch { /* ignore */ }
  return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches;
};

export class TouchControls {
  constructor(game) {
    this.g = game; this.move = { x: 0, y: 0 }; this.sprint = false; this.jump = false; this.attackHeld = false;
    this.stick = null; this.look = null; this.pinch = null;
    document.body.classList.add('touch');
    const el = this.el = document.createElement('div'); el.id = 'touch';
    el.innerHTML = `
      <div id="t-stick-zone"><div id="t-stick-base"><div id="t-stick-knob"></div></div></div>
      <div id="t-actions">
        <button id="t-attack" aria-label="โจมตี/เก็บของ">⚔️</button>
        <button id="t-use" aria-label="โต้ตอบ">✋</button>
        <button id="t-jump" aria-label="กระโดด">⤒</button>
        <button id="t-sprint" aria-label="วิ่ง">🏃</button>
        <button id="t-crouch" aria-label="ย่อ/คลาน">🧎</button>
      </div>
      <div id="t-menu">
        <button data-k="inv" aria-label="กระเป๋า">🎒</button><button data-k="rel" aria-label="ความสัมพันธ์">💞</button>
        <button data-k="map" aria-label="แผนที่">🗺️</button><button data-k="pets" aria-label="สัตว์เลี้ยง">🐾</button>
        <button data-k="char" aria-label="ตัวละคร">🧍</button><button data-k="build" aria-label="สร้างบ้าน">🔨</button><button data-k="chat" aria-label="แชท">💬</button>
      </div>
      <div id="t-build">
        <button data-b="ok" aria-label="วาง">✅</button><button data-b="rot" aria-label="หมุน">↻</button>
        <button data-b="del" aria-label="โหมดรื้อ">🗑️</button><button data-b="x" aria-label="ออก">✖</button>
      </div>`;
    document.getElementById('game-ui').appendChild(el);
    const $ = (id) => el.querySelector(id);
    this.base = $('#t-stick-base'); this.knob = $('#t-stick-knob');
    const press = (id, down, up) => {
      const b = $(id);
      b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); down(); }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); b.classList.remove('on'); up?.(); }, { passive: false });
      b.addEventListener('touchcancel', () => { b.classList.remove('on'); up?.(); });
    };
    press('#t-attack', () => { this.attackHeld = true; game.attack(); }, () => { this.attackHeld = false; });
    press('#t-use', () => game.interact());
    press('#t-jump', () => { this.jump = true; });
    press('#t-crouch', () => game.setStance((game.stance + 1) % 3));
    press('#t-sprint', () => { this.sprint = !this.sprint; $('#t-sprint').classList.toggle('lock', this.sprint); });
    $('#t-menu').addEventListener('click', (e) => {
      const k = e.target.closest('button')?.dataset.k; if (!k) return;
      game.sfx.play('click');
      if (k === 'chat') { game.ui.chatting = true; const i = document.getElementById('chat-input'); i.classList.add('show'); i.focus(); return; }
      game.ui.togglePanel(k);
    });
    $('#t-build').addEventListener('click', (e) => {
      const b = e.target.closest('button')?.dataset.b; if (!b) return;
      const B = game.builder;
      if (b === 'ok') B.confirm(); else if (b === 'rot') B.rotateNext(); else if (b === 'x') B.stop();
      else if (b === 'del') { if (B.demolish) B.stop(); else B.startDemolish(); }
    });
    // จอยสติ๊ก (เกิดตรงจุดที่แตะในโซนซ้าย)
    const zone = $('#t-stick-zone');
    zone.addEventListener('touchstart', (e) => {
      e.preventDefault(); const t = e.changedTouches[0];
      this.stick = { id: t.identifier, ox: t.clientX, oy: t.clientY };
      this.base.style.left = t.clientX + 'px'; this.base.style.top = t.clientY + 'px'; this.base.classList.add('on');
    }, { passive: false });
    // ลากนิ้วบนจอ = หมุนกล้อง
    const cv = game.renderer.domElement;
    cv.addEventListener('touchstart', (e) => {
      if (game.ui.open) return;
      e.preventDefault();
      for (const t of e.changedTouches) if (!this.look) this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
      if (e.touches.length === 2) { const [a, b] = e.touches; this.pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), cd: game.camDist }; }
    }, { passive: false });
    addEventListener('touchmove', (e) => this.onMove(e), { passive: false });
    addEventListener('touchend', (e) => this.onEnd(e));
    addEventListener('touchcancel', (e) => this.onEnd(e));
  }

  onMove(e) {
    for (const t of e.changedTouches) {
      if (this.stick && t.identifier === this.stick.id) {
        e.preventDefault();
        let dx = t.clientX - this.stick.ox, dy = t.clientY - this.stick.oy; const L = Math.hypot(dx, dy), R = 50;
        if (L > R) { dx = (dx / L) * R; dy = (dy / L) * R; }
        this.move.x = dx / R; this.move.y = dy / R;
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (this.look && t.identifier === this.look.id && !this.pinch) {
        e.preventDefault();
        const g = this.g;
        g.camYaw -= (t.clientX - this.look.x) * 0.007;
        g.camPitch = Math.max(-0.5, Math.min(1.2, g.camPitch + (t.clientY - this.look.y) * 0.005));
        this.look.x = t.clientX; this.look.y = t.clientY;
      }
    }
    if (this.pinch && e.touches.length === 2) {
      const [a, b] = e.touches, d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      this.g.camDist = Math.max(2.5, Math.min(18, this.pinch.cd * (this.pinch.d / d)));
    }
  }
  onEnd(e) {
    for (const t of e.changedTouches) {
      if (this.stick && t.identifier === this.stick.id) {
        this.stick = null; this.move.x = this.move.y = 0;
        this.knob.style.transform = ''; this.base.classList.remove('on');
      }
      if (this.look && t.identifier === this.look.id) this.look = null;
    }
    if (e.touches.length < 2) this.pinch = null;
  }
  consumeJump() { const j = this.jump; this.jump = false; return j; }
  update() { if (this.attackHeld) this.g.attack(); }
}
