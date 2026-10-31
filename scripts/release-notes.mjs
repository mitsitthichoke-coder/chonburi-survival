// สร้างไฟล์สรุปการอัปเดต docs/updates/<เวอร์ชัน>.txt จาก CHANGELOG ใน public/js/version.js
//   node scripts/release-notes.mjs          → สร้างของเวอร์ชันล่าสุด
//   node scripts/release-notes.mjs --all    → สร้างทุกเวอร์ชันในระบบนับใหม่
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CHANGELOG } from '../public/js/version.js';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'updates');
fs.mkdirSync(dir, { recursive: true });
const list = process.argv.includes('--all') ? CHANGELOG.filter((c) => !c.legacy) : [CHANGELOG.find((c) => !c.legacy)];
for (const c of list) {
  const txt = [`ชลบุรี: วันล่มสลาย — อัปเดต v${c.v}`, `วันที่ ${c.date}`, '', c.add?.length ? 'เพิ่มใหม่' : '', ...(c.add || []).map((t) => `  • ${t}`), '', c.fix?.length ? 'แก้ไข / ปรับปรุง' : '', ...(c.fix || []).map((t) => `  • ${t}`), ''].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
  fs.writeFileSync(path.join(dir, `${c.v}.txt`), txt);
  console.log('เขียน', `docs/updates/${c.v}.txt`);
}
