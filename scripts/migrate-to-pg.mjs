// ย้ายข้อมูลเดิมในโฟลเดอร์ไฟล์ (DATA_DIR) เข้า PostgreSQL/Neon — รันครั้งเดียวก่อนเปลี่ยนไปใช้ DATABASE_URL
// ใช้:  DATABASE_URL='postgresql://...' DATA_DIR=./data node scripts/migrate-to-pg.mjs
// (ใส่ DATABASE_URL ในเครื่องของคุณเท่านั้น ห้ามใส่ลงโค้ด/GitHub/แชท)
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL, dir = process.env.DATA_DIR || './data';
if (!url) { console.error('ต้องตั้ง DATABASE_URL'); process.exit(1); }
const pool = new pg.Pool({ connectionString: url, max: 2, ssl: /@(localhost|127\.0\.0\.1)[:/]|sslmode=disable/.test(url) ? false : true });
await pool.query('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v JSONB NOT NULL, updated TIMESTAMPTZ NOT NULL DEFAULT now())');
const put = async (k, file) => { const v = JSON.parse(fs.readFileSync(file, 'utf8')); await pool.query('INSERT INTO kv (k, v) VALUES ($1, $2::jsonb) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated = now()', [k, JSON.stringify(v)]); return true; };
let n = 0;
for (const f of ['users.json', 'sessions.json', 'world.json']) if (fs.existsSync(path.join(dir, f))) { await put(f, path.join(dir, f)); n++; console.log('✓', f); }
const cd = path.join(dir, 'chars');
if (fs.existsSync(cd)) for (const f of fs.readdirSync(cd)) if (f.endsWith('.json')) { await put('chars/' + f, path.join(cd, f)); n++; }
console.log(`ย้ายเสร็จ ${n} แถว`);
await pool.end();
