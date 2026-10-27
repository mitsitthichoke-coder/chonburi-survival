// เซิร์ฟเวอร์เกมออนไลน์สาธารณะ: เสิร์ฟไฟล์เกม + บัญชีผู้เล่น + WebSocket
// - บัญชี: สมัคร/ล็อกอินด้วยชื่อผู้ใช้และรหัสผ่าน (scrypt) โทเคนอายุ 30 วัน
// - ตัวละครเก็บที่เซิร์ฟเวอร์ (DATA_DIR/chars) และไอเท็มทุกชิ้นผ่านกฎของ economy.js (กันโกง)
// - แอดมิน: ตั้ง ADMIN_USERS=ชื่อ1,ชื่อ2 แล้วพิมพ์ /help ในแชท
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { WorldCore } from './public/js/server-core.js';
import { JOBS } from './public/js/data.js';
import { installEconomy, cleanText } from './public/js/server-econ.js';
import { newChar, jobKit } from './public/js/economy.js';
import { Store } from './server/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS) || 40;
const ADMINS = new Set((process.env.ADMIN_USERS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
const TOKEN_DAYS = 30;

const store = new Store(DATA_DIR);

// ---------- โลก ----------
const sockets = new Map(); // uid -> ws
const sendWs = (ws, m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
let worldDirty = false;
const core = installEconomy(new WorldCore({
  state: store.getWorld(),
  send: (id, m) => sendWs(sockets.get(id), m),
  broadcast: (m, except) => { const s = JSON.stringify(m); for (const [id, ws] of sockets) if (id !== except && ws.readyState === 1) ws.send(s); },
  onDirty: () => { worldDirty = true; },
}));
setInterval(() => {
  if (worldDirty) { worldDirty = false; try { store.saveWorld(core.snapshot()); } catch (e) { console.error('world save', e.message); } }
  for (const [id, ch] of core.chars) try { store.saveChar(id, ch); } catch (e) { console.error('char save', e.message); }
}, 20000);
let last = Date.now();
setInterval(() => { const now = Date.now(); core.tick(Math.min(0.25, (now - last) / 1000)); last = now; }, 100);

// ---------- บัญชี ----------
const U = store.users;
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const tokenHash = (t) => crypto.createHash('sha256').update(t).digest('hex');
// เจ้าของเซิร์ฟเวอร์ = คนแรกที่สมัคร หรือชื่อใน ADMIN_USERS · มีสิทธิ์ตั้ง/ถอดแอดมิน
const isOwner = (u) => !!u && (u.owner || ADMINS.has(u.username.toLowerCase()));
const isAdmin = (u) => !!u && (u.admin || isOwner(u));
const cleanJob = (j) => (JOBS[j] ? j : 'engineer');
const publicUser = (u) => ({ id: u.id, username: u.username, email: u.email ? u.email.replace(/^(.).*(@.*)$/, '$1***$2') : null, char: u.char || null, admin: isAdmin(u) });
U.byEmail ||= {}; U.byChar ||= {};
// บัญชีเก่า (ก่อนมีระบบตัวละครแยก): ใช้ชื่อผู้ใช้เป็นชื่อตัวละครถ้ายังว่าง
for (const u of Object.values(U.users)) if (!u.char && u.look) { const k = u.username.toLowerCase(); if (!U.byChar[k]) { u.char = { name: u.username, sex: u.sex, look: u.look, job: cleanJob(u.job) }; U.byChar[k] = u.id; } }
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const nameTaken = (name, uid) => { const o = U.byChar[String(name).toLowerCase()]; return !!o && o !== uid; };
function newSession(uid) {
  const token = crypto.randomBytes(32).toString('base64url');
  store.sessions[tokenHash(token)] = { uid, exp: Date.now() + TOKEN_DAYS * 864e5 };
  store.saveSessions();
  return token;
}
function userByToken(token) {
  if (!token || typeof token !== 'string') return null;
  const s = store.sessions[tokenHash(token)];
  if (!s || s.exp < Date.now()) return null;
  return U.users[s.uid] || null;
}
const NAME_RE = /^[\p{L}\p{M}\p{N}_]{3,16}$/u;
const BADNAME = (n) => cleanText(n) !== n;
function cleanLook(l) {
  const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
  const STYLES = ['short', 'buzz', 'spiky', 'mohawk', 'afro', 'bob', 'long', 'ponytail', 'bun', 'twin', 'bald'];
  return { skin: hex(l?.skin, '#e0ac69'), shirt: hex(l?.shirt, '#2e86ab'), hair: hex(l?.hair, '#1b1b1b'), style: STYLES.includes(l?.style) ? l.style : undefined };
}

// จำกัดจำนวนครั้งต่อ IP
const buckets = new Map();
function limited(key, max, windowMs) {
  const now = Date.now(), b = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  b.push(now); buckets.set(key, b);
  return b.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (!b.some((t) => now - t < 3600e3)) buckets.delete(k); }, 600e3);
const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

async function api(req, res, route) {
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
  const ip = ipOf(req);
  let body = {};
  if (req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 8192) return json(413, { error: 'ข้อมูลใหญ่เกินไป' }); }
    try { body = JSON.parse(raw || '{}'); } catch { return json(400, { error: 'ข้อมูลไม่ถูกต้อง' }); }
  }
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (route === '/api/register' && req.method === 'POST') {
    if (limited('reg:' + ip, 5, 3600e3)) return json(429, { error: 'สมัครบ่อยเกินไป ลองใหม่ภายหลัง' });
    const username = String(body.username || '').trim(), password = String(body.password || ''), email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) return json(400, { error: 'กรุณาใส่อีเมลให้ถูกต้อง' });
    if (U.byEmail[email]) return json(409, { error: 'อีเมลนี้ถูกใช้สมัครแล้ว' });
    if (!NAME_RE.test(username)) return json(400, { error: 'ชื่อผู้ใช้ต้องยาว 3–16 ตัว ใช้ได้เฉพาะตัวอักษร ตัวเลข และ _' });
    if (BADNAME(username)) return json(400, { error: 'ชื่อนี้ใช้ไม่ได้' });
    if (password.length < 6 || password.length > 72) return json(400, { error: 'รหัสผ่านต้องยาว 6–72 ตัวอักษร' });
    const key = username.toLowerCase();
    if (U.byName[key]) return json(409, { error: 'ชื่อผู้ใช้นี้มีคนใช้แล้ว' });
    const id = 'u' + crypto.randomBytes(8).toString('hex'), salt = crypto.randomBytes(16).toString('hex');
    // ไม่ได้ตั้ง ADMIN_USERS: คนแรกที่สมัครเป็นแอดมินอัตโนมัติ
    const first = !ADMINS.size && !Object.values(U.users).some((x) => x.admin);
    U.users[id] = { id, username, email, salt, hash: hashPw(password, salt), created: Date.now(), char: null, admin: first || undefined, owner: first || undefined };
    U.byName[key] = id; U.byEmail[email] = id; store.saveUsers();
    return json(200, { token: newSession(id), user: publicUser(U.users[id]) });
  }
  if (route === '/api/login' && req.method === 'POST') {
    if (limited('login:' + ip, 20, 600e3)) return json(429, { error: 'ลองเข้าสู่ระบบบ่อยเกินไป รอ 10 นาที' });
    const who = String(body.username || '').trim().toLowerCase(), id = U.byName[who] || U.byEmail[who], u = id && U.users[id];
    const ok = u && crypto.timingSafeEqual(Buffer.from(hashPw(String(body.password || ''), u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
    if (!ok) return json(401, { error: 'ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง' });
    if (u.banned) return json(403, { error: 'บัญชีนี้ถูกระงับ' });
    return json(200, { token: newSession(u.id), user: publicUser(u) });
  }
  if (route === '/api/me') { const u = userByToken(bearer); return u ? json(200, { user: publicUser(u) }) : json(401, { error: 'ยังไม่ได้เข้าสู่ระบบ' }); }
  if (route === '/api/logout' && req.method === 'POST') { delete store.sessions[tokenHash(bearer)]; store.saveSessions(); return json(200, { ok: true }); }
  // ตรวจว่าชื่อตัวละครว่างไหม
  if (route === '/api/name-check') {
    if (limited('nc:' + ip, 60, 60e3)) return json(429, { error: 'ช้าลงหน่อย' });
    const u = userByToken(bearer), name = String(new URL(req.url, 'http://x').searchParams.get('name') || '').trim();
    if (!NAME_RE.test(name) || BADNAME(name)) return json(200, { ok: false, error: 'ชื่อตัวละครต้องยาว 3–16 ตัว ใช้ได้เฉพาะตัวอักษร ตัวเลข และ _' });
    return json(200, nameTaken(name, u?.id) ? { ok: false, error: 'ชื่อตัวละครนี้มีคนใช้แล้ว' } : { ok: true });
  }
  // สร้างตัวละครครั้งแรก (หรือแก้หน้าตา/อาชีพภายหลัง — ชื่อเปลี่ยนได้ถ้ายังว่าง)
  if (route === '/api/character' && req.method === 'POST') {
    const u = userByToken(bearer); if (!u) return json(401, { error: 'ยังไม่ได้เข้าสู่ระบบ' });
    const name = String(body.name || '').trim();
    if (!NAME_RE.test(name)) return json(400, { error: 'ชื่อตัวละครต้องยาว 3–16 ตัว ใช้ได้เฉพาะตัวอักษร ตัวเลข และ _' });
    if (BADNAME(name)) return json(400, { error: 'ชื่อนี้ใช้ไม่ได้' });
    if (nameTaken(name, u.id)) return json(409, { error: 'ชื่อตัวละครนี้มีคนใช้แล้ว ลองชื่ออื่น' });
    if (sockets.has(u.id)) return json(409, { error: 'ออกจากเกมก่อนแก้ไขตัวละคร' });
    if (u.char) delete U.byChar[u.char.name.toLowerCase()];
    u.char = { name, sex: body.sex === 'f' ? 'f' : 'm', look: cleanLook(body.look), job: cleanJob(body.job) };
    U.byChar[name.toLowerCase()] = u.id; store.saveUsers();
    return json(200, { user: publicUser(u) });
  }
  return json(404, { error: 'ไม่พบ' });
}

// ---------- คำสั่งแอดมินในแชท ----------
core.onCommand = (id, text) => {
  const u = U.users[id], [cmd, ...rest] = text.slice(1).split(/\s+/), arg = rest.join(' ');
  const say = (t) => core.send(id, { t: 'chat', from: 'system', name: '🛠️', text: t });
  const find = (name) => { const k = String(name).toLowerCase(), tid = U.byChar[k] || U.byName[k]; return tid && U.users[tid]; };
  if (cmd === 'players') return say(`ออนไลน์ ${core.players.size} คน: ${[...core.players.values()].map((p) => p.name).join(', ')}`);
  if (cmd === 'help') return say(isAdmin(u) ? (isOwner(u) ? '⭐ เจ้าของ: /admin ชื่อ (ตั้งแอดมิน) · /unadmin ชื่อ (ถอดแอดมิน) · ' : '') + 'คำสั่ง: /players · /admins · /kick ชื่อ · /ban ชื่อ · /unban ชื่อ · /mute ชื่อ · /unmute ชื่อ · /say ข้อความ' : 'คำสั่ง: /players');
  if (!isAdmin(u)) return say('คำสั่งนี้สำหรับแอดมินเท่านั้น');
  const label = (x) => `${x.char?.name || x.username} (ผู้ใช้: ${x.username})`;
  if (cmd === 'admins') return say('👑 แอดมิน: ' + Object.values(U.users).filter(isAdmin).map((x) => label(x) + (isOwner(x) ? ' ⭐เจ้าของ' : '')).join(', '));
  if ((cmd === 'admin' || cmd === 'unadmin') && !isOwner(u)) return say('ตั้ง/ถอดแอดมินได้เฉพาะ ⭐ เจ้าของเซิร์ฟเวอร์');
  const t = cmd === 'say' ? null : find(arg);
  if (cmd !== 'say' && !t) return say('ไม่พบผู้เล่นชื่อนี้');
  if (['kick', 'ban', 'mute'].includes(cmd) && isOwner(t) && !isOwner(u)) return say('ทำกับเจ้าของเซิร์ฟเวอร์ไม่ได้');
  switch (cmd) {
    case 'kick': sockets.get(t.id)?.close(4000, 'kicked'); return say(`เตะ ${t.username} ออกแล้ว`);
    case 'ban': t.banned = true; store.saveUsers(); for (const [k, s] of Object.entries(store.sessions)) if (s.uid === t.id) delete store.sessions[k]; store.saveSessions(); sockets.get(t.id)?.close(4001, 'banned'); return say(`แบน ${t.username} แล้ว`);
    case 'unban': t.banned = false; store.saveUsers(); return say(`ปลดแบน ${t.username} แล้ว`);
    case 'mute': { const c = core.chars.get(t.id); if (c) c.muted = true; t.muted = true; store.saveUsers(); return say(`ปิดแชท ${t.username} แล้ว`); }
    case 'unmute': { const c = core.chars.get(t.id); if (c) c.muted = false; t.muted = false; store.saveUsers(); return say(`เปิดแชท ${t.username} แล้ว`); }
    case 'admin':
      if (isAdmin(t)) return say(`${label(t)} เป็นแอดมินอยู่แล้ว`);
      t.admin = true; store.saveUsers();
      core.send(t.id, { t: 'chat', from: 'system', name: '👑', text: 'คุณได้รับสิทธิ์แอดมินแล้ว พิมพ์ /help เพื่อดูคำสั่ง' });
      return say(`👑 ตั้ง ${label(t)} เป็นแอดมินแล้ว`);
    case 'unadmin':
      if (isOwner(t)) return say('ถอดเจ้าของเซิร์ฟเวอร์ไม่ได้');
      if (!t.admin) return say(`${label(t)} ไม่ได้เป็นแอดมิน`);
      t.admin = false; store.saveUsers();
      core.send(t.id, { t: 'chat', from: 'system', name: '🛠️', text: 'สิทธิ์แอดมินของคุณถูกถอนแล้ว' });
      return say(`ถอดสิทธิ์แอดมินของ ${label(t)} แล้ว`);
    case 'say': return core.broadcast({ t: 'chat', from: 'system', name: '📢 ประกาศ', text: cleanText(arg) });
  }
  return say('ไม่รู้จักคำสั่ง พิมพ์ /help');
};

// ---------- ไฟล์เกม ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url.startsWith('/api/')) return api(req, res, url).catch((e) => { console.error(e); res.writeHead(500); res.end(); });
  if (url === '/healthz') { res.writeHead(200); return res.end('ok'); }
  const file = path.normalize(path.join(PUBLIC, url === '/' ? 'index.html' : url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=300' });
    res.end(buf);
  });
});

// ---------- เรียลไทม์ ----------
const wss = new WebSocketServer({ server, maxPayload: 32 * 1024 });
wss.on('connection', (ws, req) => {
  let id = null, tokens = 60, lastRefill = Date.now(), dropped = 0;
  const ip = ipOf(req);
  if (limited('ws:' + ip, 30, 60e3)) return ws.close(4002, 'too many connections');
  ws.on('message', (raw) => {
    // จำกัดความถี่: ~30 ข้อความ/วินาที
    const now = Date.now(); tokens = Math.min(60, tokens + ((now - lastRefill) / 1000) * 30); lastRefill = now;
    if (tokens < 1) { if (++dropped > 300) ws.close(4003, 'flood'); return; }
    tokens -= 1;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (!id) {
      if (m.t !== 'hello') return;
      const u = userByToken(m.token);
      if (!u) { sendWs(ws, { t: 'authfail', text: 'กรุณาเข้าสู่ระบบใหม่' }); return ws.close(4004, 'auth'); }
      if (u.banned) { sendWs(ws, { t: 'authfail', text: 'บัญชีนี้ถูกระงับ' }); return ws.close(4001, 'banned'); }
      if (!sockets.has(u.id) && sockets.size >= MAX_PLAYERS) { sendWs(ws, { t: 'authfail', text: `เซิร์ฟเวอร์เต็ม (${MAX_PLAYERS} คน) ลองใหม่ภายหลัง` }); return ws.close(4005, 'full'); }
      if (!u.char) { sendWs(ws, { t: 'authfail', text: 'สร้างตัวละครก่อนเข้าเกม' }); return ws.close(4007, 'nochar'); }
      id = u.id;
      const old = sockets.get(id);
      if (old && old !== ws) { core.leave(id); const oc = core.detachChar(id); if (oc) store.saveChar(id, oc); old.close(4006, 'logged in elsewhere'); }
      sockets.set(id, ws);
      const C = u.char, ch = store.getChar(id) || newChar({ ...C });
      ch.profile = { name: C.name, sex: C.sex, look: C.look, job: C.job }; jobKit(ch); ch.muted = !!u.muted;
      core.attachChar(id, ch);
      core.message(id, { t: 'hello', name: C.name, sex: C.sex, look: C.look, p: ch.pos });
      return;
    }
    core.message(id, m);
  });
  ws.on('close', () => {
    if (id && sockets.get(id) === ws) {
      sockets.delete(id); core.leave(id);
      const ch = core.detachChar(id); if (ch) try { store.saveChar(id, ch); } catch (e) { console.error(e.message); }
    }
  });
});

const shutdown = () => {
  try { store.saveWorld(core.snapshot()); for (const [id, ch] of core.chars) store.saveChar(id, ch); store.flush('users.json', store.users); store.flush('sessions.json', store.sessions); } catch (e) { console.error(e); }
  process.exit(0);
};
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
server.listen(PORT, () => console.log(`🌏 Chonburi Survival online server: http://localhost:${PORT}  (data: ${DATA_DIR}, max ${MAX_PLAYERS} players)`));
