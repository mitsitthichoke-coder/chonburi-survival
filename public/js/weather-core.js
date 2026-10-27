// สภาพอากาศ (คำนวณจากเวลา ทุกเครื่องเห็นเหมือนกัน · ช่วงละ 2.5 นาที)
// rain = ฝน (โอกาส 30%) · snow = หิมะ (8% ของช่วงที่ไม่มีฝน) · fog = หมอก 0 (ไม่มี) / บาง / หนา
import { hash2 } from './terrain.js';
export const WX_SLOT = 150000;
export function weatherAt(now) {
  const s = Math.floor(now / WX_SLOT), rain = hash2(s, 77) < 0.3, snow = !rain && hash2(s, 91) < 0.08;
  const fr = hash2(s, 55), fog = fr < 0.12 ? 0.85 : fr < 0.3 ? 0.45 : rain ? 0.2 : 0; // 0.85 หนา · 0.45 บาง
  return { rain, snow, fog };
}
export const fogName = (f) => (f >= 0.7 ? 'หมอกลงหนา' : f >= 0.35 ? 'หมอกบาง' : '');
// อุณหภูมิอากาศ (°C) ตามเวลา/สภาพอากาศ — ชลบุรีปกติร้อน กลางคืนเย็นลง
export function airTemp(w, night, height = 0) { return (night ? 25 : 32) - (w.rain ? 5 : 0) - (w.snow ? 22 : 0) - (w.fog >= 0.7 ? 3 : 0) - Math.max(0, height - 20) * 0.12; }
// อุณหภูมิร่างกายที่จะเข้าหา (37 = ปกติ)
export function bodyTarget({ air, wet, warm, fire, shelter }) {
  const feel = air + warm * 12 + (fire ? 14 : 0) + (shelter ? 6 : 0) - wet * 0.12;
  return Math.max(33, Math.min(39.6, 37 + (feel - 26) * 0.11));
}
