// ที่เก็บข้อมูลบน PostgreSQL (เช่น Neon) — เปิดใช้เมื่อมี env DATABASE_URL เท่านั้น ไม่มี = ใช้ไฟล์ JSON เหมือนเดิม
// ใส่ DATABASE_URL ในหน้า Environment ของ Render เท่านั้น ห้ามเขียนลงโค้ด/GitHub
// หลักการ: โหลดทุกอย่างเข้าหน่วยความจำตอนเริ่ม (ผู้เล่นไม่กี่สิบคน เล็กมาก) แล้วเขียนกลับ Postgres แบบ write-behind เฉพาะแถวที่เปลี่ยน
import { Store } from './store.js';
import pg from 'pg';

export class PgStore extends Store {
  static async open(dir, url) {
    const s = new PgStore(dir);
    // เชื่อมต่อด้วย TLS และตรวจใบรับรองตามปกติ (ยกเว้นเครื่องตัวเองตอนทดสอบ)
    s.pool = new pg.Pool({ connectionString: url, max: 3, ssl: /@(localhost|127\.0\.0\.1)[:/]|sslmode=disable/.test(url) ? false : true, idleTimeoutMillis: 30000 });
    await s.pool.query('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v JSONB NOT NULL, updated TIMESTAMPTZ NOT NULL DEFAULT now())');
    const { rows } = await s.pool.query('SELECT k, v FROM kv');
    s.cache = new Map(rows.map((r) => [r.k, r.v]));
    s.sent = new Map(rows.map((r) => [r.k, JSON.stringify(r.v)]));
    s.users = s.cache.get('users.json') || { byName: {}, users: {} };
    s.sessions = s.cache.get('sessions.json') || {};
    s.queue = new Map(); s.flushing = null;
    console.log(`🗄️ PostgreSQL ตัวเก็บข้อมูลพร้อมแล้ว (${rows.length} แถว)`);
    return s;
  }
  key(name) { return String(name).replace(/\\/g, '/'); }
  read(name, def) { return this.cache ? (this.cache.has(this.key(name)) ? JSON.parse(JSON.stringify(this.cache.get(this.key(name)))) : def) : def; }
  write(name, obj) {
    const k = this.key(name), j = JSON.stringify(obj); if (!this.cache) return;
    this.cache.set(k, JSON.parse(j));
    if (this.sent.get(k) === j) return; // ไม่เปลี่ยน ไม่ต้องเขียน
    this.queue.set(k, j); this.kick();
  }
  kick() { if (this.flushing || this.closed) return; this.flushing = this.pump().finally(() => { this.flushing = null; if (this.queue.size) this.kick(); }); }
  async pump() {
    await new Promise((r) => setTimeout(r, 800)); // รวมหลายครั้งเป็นรอบเดียว
    const batch = [...this.queue]; this.queue.clear();
    for (const [k, j] of batch) {
      try { await this.pool.query('INSERT INTO kv (k, v, updated) VALUES ($1, $2::jsonb, now()) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated = now()', [k, j]); this.sent.set(k, j); }
      catch (e) { console.error('pg save', k, e.message); if (!this.queue.has(k)) this.queue.set(k, j); }
    }
  }
  // รอให้เขียนครบก่อนปิดเซิร์ฟเวอร์ (SIGTERM)
  async drain() { for (let i = 0; i < 20 && (this.queue.size || this.flushing); i++) { if (this.flushing) await this.flushing; else this.kick(); } this.closed = true; try { await this.pool.end(); } catch { /* ปิดแล้ว */ } }
}
