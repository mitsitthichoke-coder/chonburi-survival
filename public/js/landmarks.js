// สถานที่สำคัญประจำอำเภอ (ไม่พึ่ง three.js ใช้ร่วมกันทั้งไคลเอนต์และเซิร์ฟเวอร์)
// แต่ละแห่งสร้างอาคาร กล่องเสบียงพิเศษ (tbl → SPECIAL_LOOT) และโซนพิเศษ (เช่น ผู้ติดเชื้อทหาร)
import { heightAt, waterAt, lonToX, latToZ, hash2 } from './terrain.js';

const P = (lat, lon) => ({ x: lonToX(lon), z: latToZ(lat) });
export const LANDMARKS = [
  { key: 'mall', kind: 'mall', name: '🏬 ห้างสรรพสินค้าร้าง', town: 'chonburi', ...P(13.352, 101.005), r: 26 },
  { key: 'wicker', kind: 'market', name: '🧺 ตลาดจักสานพนัสนิคม', town: 'phanat', ...P(13.452, 101.172), r: 16 },
  { key: 'navy', kind: 'navy', name: '⚓ ฐานทัพเรือสัตหีบ (ค่ายทหารเรือ)', town: 'sattahip', ...P(12.638, 100.958), r: 42 },
  { key: 'factory', kind: 'factory', name: '🏭 นิคมโรงงานร้างพานทอง', town: 'phanthong', ...P(13.482, 101.118), r: 40 },
  { key: 'uni', kind: 'uni', name: '🎓 มหาวิทยาลัยร้างศรีราชา', town: 'sriracha', ...P(13.122, 100.925), r: 32 },
  { key: 'dam', kind: 'dam', name: '🌊 เขื่อนเกาะจันทร์', town: 'kochan', ...P(13.405, 101.378), r: 30 },
  { key: 'rubbermill', kind: 'rubbermill', name: '🌳 โรงงานแปรรูปยางพาราบ้านบึง', town: 'banbueng', ...P(13.322, 101.122), r: 22 },
  { key: 'buffalo', kind: 'buffalomarket', name: '🐃 ตลาดนัดโค-กระบือหนองใหญ่', town: 'nongyai', ...P(13.150, 101.362), r: 20 },
  { key: 'mine', kind: 'mine', name: '⛏️ เหมืองหินบ่อทอง', town: 'bothong', ...P(13.246, 101.478), r: 24 },
  { key: 'pier', kind: 'pier', name: '⚓ ท่าเรือและพระราชวังเกาะสีชัง', town: 'sichang', ...P(13.158, 100.824), r: 12 },
  { key: 'sheep', kind: 'sheepfarm', name: '🐑 สวนแกะ & สวนดอกไม้บางละมุง', town: 'banglamung', ...P(13.03, 100.965), r: 24 },
];
export const landmark = (k) => LANDMARKS.find((l) => l.key === k);
// โซนผู้ติดเชื้อทหาร: รอบฐานทัพเรือ
export const NAVY = landmark('navy');
export const inNavy = (x, z, pad = 1) => Math.hypot(x - NAVY.x, z - NAVY.z) < NAVY.r * pad;
// อ่างเก็บน้ำหลังเขื่อน (ใช้ใน terrain LAKES ด้วยพิกัดเดียวกัน)
export const DAM_LAKE = { lat: 13.418, lon: 101.378, rx: 38, rz: 18, level: 9 };

const land = (x, z) => heightAt(x, z) > 1 && !waterAt(x, z);
// สร้างอาคาร/กล่องเสบียงของทุกสถานที่ · ok(x,z,w,d) = ตรวจว่าวางได้ (ไม่ทับจุดภารกิจ)
export function buildLandmarks(ok) {
  const boxes = [], loot = [], pavilions = [], labels = [];
  const put = (x, z, w, d, h, rgb, o = {}) => {
    if (!land(x, z) || !ok(x, z, w, d)) return null;
    const y0 = Math.min(heightAt(x - w / 2, z - d / 2), heightAt(x + w / 2, z + d / 2), heightAt(x - w / 2, z + d / 2), heightAt(x + w / 2, z - d / 2), heightAt(x, z)) - 1;
    const b = { x, z, w, d, h, y0, rgb, burnt: !!o.burnt, lm: o.lm };
    boxes.push(b); return b;
  };
  const crate = (x, z, tbl, y) => { if (land(x, z) || y !== undefined) loot.push({ x: +x.toFixed(2), z: +z.toFixed(2), kind: 'crate', tbl, ...(y !== undefined ? { y: +y.toFixed(2), roof: true } : {}) }); };
  for (const L of LANDMARKS) {
    const { x, z } = L; let n = 0; const rnd = () => hash2(L.key.length * 31 + n, ++n * 7);
    labels.push({ x, z, name: L.name, y: heightAt(x, z) + 14 });
    switch (L.kind) {
      case 'mall': {
        // ห้างใหญ่ไฟไหม้บางส่วน ลานจอดรถรอบ ๆ · ของบนหลังคา + หน้าห้าง
        const b = put(x, z, 38, 24, 13, [0.72, 0.68, 0.62], { burnt: false, lm: 'mall' });
        put(x - 22, z - 4, 6, 14, 9, [0.55, 0.15, 0.15], { burnt: true, lm: 'mall' });
        if (b) for (let i = 0; i < 4; i++) crate(x - 14 + i * 9, z + (rnd() - 0.5) * 16, 'mall', b.y0 + b.h);
        for (let i = 0; i < 5; i++) crate(x - 16 + i * 8, z + 14.5, 'mall');
        break;
      }
      case 'market': {
        // แผงตลาดหลังคาสีสด เป็นที่หลบฝนได้
        for (let i = 0; i < 6; i++) {
          const px = x - 10 + (i % 3) * 10, pz = z - 5 + Math.floor(i / 3) * 10;
          if (land(px, pz) && ok(px, pz, 6, 5)) pavilions.push({ x: +px.toFixed(2), z: +pz.toFixed(2), w: 6, d: 5, y: +heightAt(px, pz).toFixed(2), hearth: false, market: i });
        }
        crate(x + 14, z, 'mall'); crate(x - 14, z + 3, 'mall');
        break;
      }
      case 'navy': {
        // ค่ายทหารเรือ: กำแพงรอบ (มีช่องทางเข้า) โรงนอน อาคารบัญชาการ โรงเก็บเครื่องบิน
        const R = 34, wallC = [0.42, 0.45, 0.38];
        for (const [wx, wz, ww, wd] of [[0, -R, R * 2, 1], [0, R, R * 2, 1], [-R, -R / 2 - 3, 1, R - 6], [-R, R / 2 + 3, 1, R - 6], [R, 0, 1, R * 2]]) put(x + wx, z + wz, ww, wd, 3.2, wallC, { lm: 'navy' });
        for (let i = 0; i < 4; i++) { const b = put(x - 18 + i * 12, z - 18, 8, 12, 5, [0.33, 0.4, 0.27], { lm: 'navy' }); if (b) crate(b.x, b.z + 7.5, 'mil'); }
        const hq = put(x + 10, z + 12, 16, 10, 9, [0.85, 0.85, 0.82], { lm: 'navy' }); if (hq) { crate(hq.x, hq.z, 'mil', hq.y0 + hq.h); crate(hq.x - 9.5, hq.z, 'mil'); }
        const hg = put(x - 14, z + 14, 18, 14, 7, [0.5, 0.52, 0.55], { lm: 'navy' }); if (hg) crate(hg.x, hg.z - 8, 'mil');
        crate(x, z, 'mil'); crate(x + 20, z - 4, 'mil');
        break;
      }
      case 'factory': {
        // โรงงานร้างหลายหลัง หลังคาสนิม ปล่องควันสูง
        for (let i = 0; i < 6; i++) {
          const fx = x - 26 + (i % 3) * 26, fz = z - 12 + Math.floor(i / 3) * 26;
          const b = put(fx, fz, 18, 14, 8 + (i % 2) * 3, i % 2 ? [0.55, 0.36, 0.25] : [0.6, 0.6, 0.58], { burnt: i === 4, lm: 'factory' });
          if (!b) continue;
          put(fx + 7, fz - 5, 1.6, 1.6, 22, [0.45, 0.32, 0.26], { lm: 'factory' });
          crate(fx, fz + 8.5, 'factory'); if (i % 2) crate(fx - 4, fz, 'factory', b.y0 + b.h);
        }
        break;
      }
      case 'uni': {
        // มหาวิทยาลัยร้าง: ตึกเรียนล้อมลานกลาง หอสมุด ห้องแล็บ
        const blds = [[-16, -12, 22, 10, 12], [16, -12, 18, 10, 15], [-16, 14, 18, 10, 10], [16, 14, 22, 10, 13], [0, 0, 10, 10, 18]];
        for (const [dx, dz, w, d, h] of blds) {
          const b = put(x + dx, z + dz, w, d, h, [0.86, 0.78, 0.62], { lm: 'uni' });
          if (!b) continue;
          crate(b.x + (dz < 0 ? 0 : 0), b.z + (dz < 0 ? d / 2 + 1.4 : -d / 2 - 1.4), 'edu'); crate(b.x, b.z, 'edu', b.y0 + b.h);
        }
        break;
      }
      case 'dam': {
        // สันเขื่อนคอนกรีตยาวกั้นอ่างเก็บน้ำ (เดินบนสันเขื่อนได้)
        const lx = lonToX(DAM_LAKE.lon), lz = latToZ(DAM_LAKE.lat), dz = lz + DAM_LAKE.rz * 1.25;
        const y0 = heightAt(lx, dz) - 1;
        boxes.push({ x: lx, z: dz, w: DAM_LAKE.rx * 1.9, d: 5, h: Math.max(4, DAM_LAKE.level + 3 - y0), y0, rgb: [0.7, 0.7, 0.68], burnt: false, lm: 'dam' });
        put(lx + DAM_LAKE.rx * 0.95 + 4, dz + 6, 8, 6, 6, [0.6, 0.62, 0.6], { lm: 'dam' });
        crate(lx + DAM_LAKE.rx * 0.95 + 4, dz + 10, 'factory');
        labels[labels.length - 1] = { x: lx, z: dz, name: L.name, y: y0 + 18 };
        break;
      }
      case 'rubbermill': {
        // โรงรีดยาง: โรงเรือนยาว ถังน้ำยาง และลานตากแผ่นยาง
        const m = put(x, z, 18, 9, 6, [0.5, 0.45, 0.38], { lm: 'rubber' }); if (m) { crate(m.x - 4, m.z + 6, 'rubber'); crate(m.x, m.z, 'rubber', m.y0 + m.h); }
        for (const [dx, dz] of [[-14, -4], [14, -4], [-14, 8], [14, 8]]) { const t = put(x + dx, z + dz, 4, 4, 5, [0.7, 0.7, 0.66], { lm: 'rubber' }); if (t) crate(t.x, t.z + 3, 'rubber'); }
        put(x, z - 14, 22, 5, 3, [0.62, 0.34, 0.2], { lm: 'rubber' });
        break;
      }
      case 'buffalomarket': {
        // คอกกลมกลางตลาดนัดสัตว์ + โรงเรือนขายของ
        const R = 14, fc = [0.5, 0.36, 0.22];
        for (const [wx, wz, ww, wd] of [[0, -R, 22, 0.4], [0, R, 22, 0.4], [-R, 0, 0.4, 22], [R, 0, 0.4, 22]]) put(x + wx, z + wz, ww, wd, 2.2, fc, { lm: 'buffalo' });
        const sh = put(x + 22, z, 10, 6, 4, [0.6, 0.5, 0.35], { lm: 'buffalo' }); if (sh) crate(sh.x, sh.z + 4, 'farm');
        const bn = put(x - 22, z + 4, 9, 7, 5, [0.55, 0.22, 0.18], { lm: 'buffalo' }); if (bn) { crate(bn.x, bn.z + 5, 'farm'); crate(bn.x, bn.z, 'farm', bn.y0 + bn.h); }
        break;
      }
      case 'mine': {
        // ขอบบ่อหินสูง + สำนักงานเหมือง + เครื่องบด
        for (const [wx, wz, ww, wd] of [[0, -16, 30, 3], [-16, 0, 3, 24], [16, 0, 3, 24]]) put(x + wx, z + wz, ww, wd, 4.5, [0.58, 0.55, 0.5], { lm: 'mine' });
        const o = put(x, z + 14, 12, 7, 5, [0.5, 0.52, 0.55], { lm: 'mine' }); if (o) { crate(o.x - 3, o.z + 5, 'mine'); crate(o.x, o.z, 'mine', o.y0 + o.h); }
        const c = put(x + 22, z + 4, 7, 7, 8, [0.45, 0.45, 0.42], { lm: 'mine', burnt: true }); if (c) crate(c.x, c.z + 5, 'mine');
        break;
      }
      case 'pier': {
        // ท่าเรือไม้ + ประภาคาร/อาคารริมน้ำ
        const p = put(x, z, 10, 6, 4, [0.78, 0.7, 0.55], { lm: 'pier' }); if (p) { crate(p.x, p.z + 4, 'sea'); crate(p.x, p.z, 'sea', p.y0 + p.h); }
        const lh = put(x + 11, z - 4, 3.5, 3.5, 12, [0.92, 0.9, 0.86], { lm: 'pier' }); if (lh) crate(lh.x, lh.z, 'sea', lh.y0 + lh.h);
        put(x - 10, z + 2, 8, 5, 3.5, [0.62, 0.4, 0.28], { lm: 'pier' });
        break;
      }
      case 'sheepfarm': {
        // รั้วไม้เตี้ยรอบสวนแกะ (มีช่องเข้า 4 ทิศ) + โรงเก็บฟาง
        const R = 20, fc = [0.55, 0.4, 0.25];
        for (const [wx, wz, ww, wd] of [[-11, -R, 18, 0.4], [11, -R, 18, 0.4], [-11, R, 18, 0.4], [11, R, 18, 0.4], [-R, -11, 0.4, 18], [-R, 11, 0.4, 18], [R, -11, 0.4, 18], [R, 11, 0.4, 18]]) put(x + wx, z + wz, ww, wd, 2.3, fc, { lm: 'sheep' });
        const barn = put(x + 8, z - 8, 8, 6, 5, [0.62, 0.2, 0.17], { lm: 'sheep' }); if (barn) crate(barn.x, barn.z + 4, 'mall');
        break;
      }
    }
  }
  return { boxes, loot, pavilions, labels };
}
