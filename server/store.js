// ที่เก็บข้อมูลแบบไฟล์ JSON (เขียนแบบปลอดภัย: เขียนไฟล์ชั่วคราวแล้วค่อยเปลี่ยนชื่อ)
// DATA_DIR ควรชี้ไปที่ดิสก์ถาวร เช่น /var/data บน Render
import fs from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(path.join(dir, 'chars'), { recursive: true });
    this.users = this.read('users.json', { byName: {}, users: {} });
    this.sessions = this.read('sessions.json', {});
    this.pending = new Map();
  }
  file(name) { return path.join(this.dir, name); }
  read(name, def) { try { return JSON.parse(fs.readFileSync(this.file(name), 'utf8')); } catch { return def; } }
  write(name, obj) {
    const f = this.file(name), tmp = f + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj));
    fs.renameSync(tmp, f);
  }
  // เขียนแบบหน่วงเวลา รวมหลายครั้งเป็นครั้งเดียว
  later(name, getter, ms = 2000) {
    if (this.pending.has(name)) return;
    this.pending.set(name, setTimeout(() => { this.pending.delete(name); try { this.write(name, getter()); } catch (e) { console.error('save', name, e.message); } }, ms));
  }
  flush(name, obj) { clearTimeout(this.pending.get(name)); this.pending.delete(name); this.write(name, obj); }
  saveUsers() { this.later('users.json', () => this.users); }
  saveSessions() { this.later('sessions.json', () => this.sessions); }
  getWorld() { return this.read('world.json', null); }
  saveWorld(w) { this.write('world.json', w); }
  getChar(id) { return this.read(path.join('chars', safe(id) + '.json'), null); }
  saveChar(id, ch) {
    const { t, lastPos, teleportOk, chatT, warn, ...keep } = ch; // ไม่บันทึกค่าชั่วคราว
    this.write(path.join('chars', safe(id) + '.json'), keep);
  }
}
const safe = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '');
