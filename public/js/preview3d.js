// 🧍 ตัวอย่างตัวละคร 3 มิติแบบหมุนได้ในหน้าสร้างตัวละคร (ใช้ makeHuman ตัวเดียวกับในเกม) — ถ้า WebGL ใช้ไม่ได้จะกลับไปใช้ภาพพิกเซลเดิม
import * as THREE from 'three';
import { makeHuman } from './models.js';

let R = null, ready = false;
export function initPreview3d(canvas2d) {
  try {
    const cv = document.createElement('canvas'); cv.id = 'f-preview3d'; cv.width = 160; cv.height = 200;
    cv.style.cssText = 'width:112px;height:140px;border-radius:12px;background:linear-gradient(#d8ecff,#f2f8ff);box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:grab;touch-action:none';
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setSize(160, 200, false); r.setPixelRatio(Math.min(devicePixelRatio, 2));
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 160 / 200, 0.1, 50); cam.position.set(0, 1.25, 4.6); cam.lookAt(0, 1.0, 0);
    sc.add(new THREE.HemisphereLight('#ffffff', '#9fb4c8', 1.15)); const d = new THREE.DirectionalLight('#fff4dc', 1.0); d.position.set(2, 4, 3); sc.add(d);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: '#b9c9d8', transparent: true, opacity: 0.6 })); floor.rotation.x = -Math.PI / 2; sc.add(floor);
    canvas2d.style.display = 'none'; canvas2d.parentNode.insertBefore(cv, canvas2d);
    R = { r, sc, cam, cv, mesh: null, spin: 0.6, drag: false, last: 0 };
    cv.addEventListener('pointerdown', (e) => { R.drag = true; R.px = e.clientX; cv.setPointerCapture?.(e.pointerId); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', (e) => { if (!R.drag) return; if (R.mesh) R.mesh.rotation.y += (e.clientX - R.px) * 0.015; R.px = e.clientX; });
    const up = () => { R.drag = false; cv.style.cursor = 'grab'; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    const loop = (t) => {
      requestAnimationFrame(loop);
      if (!R || cv.offsetParent === null) return; // เมนูซ่อนอยู่ ไม่ต้องเรนเดอร์
      const dt = Math.min(0.05, (t - R.last) / 1000 || 0); R.last = t;
      if (R.mesh && !R.drag) R.mesh.rotation.y += dt * R.spin;
      r.render(sc, cam);
    };
    requestAnimationFrame(loop); ready = true;
  } catch { ready = false; R = null; if (canvas2d) canvas2d.style.display = ''; }
}
export function updatePreview3d(sex, look) {
  if (!ready || !R) return;
  try {
    const old = R.mesh, ry = old ? old.rotation.y : 0.4;
    if (old) { R.sc.remove(old); old.traverse((o) => { o.geometry?.dispose?.(); }); }
    const m = makeHuman(sex, look); m.rotation.y = ry; R.sc.add(m); R.mesh = m;
  } catch { /* ตัวอย่างผิดรูป ข้ามรอบนี้ */ }
}
