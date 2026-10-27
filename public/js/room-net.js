// เล่นออนไลน์ในหน้า Artifact บน claude.ai โดยไม่ต้องมีเซิร์ฟเวอร์
// - ตำแหน่งผู้เล่นส่งผ่าน room.presence
// - ผู้เล่นคนหนึ่งเป็น "โฮสต์" รัน WorldCore (ผู้ติดเชื้อ ความสัมพันธ์ ฯลฯ) ในเบราว์เซอร์ของตัวเอง
//   ถ้าโฮสต์ออก คนถัดไปรับช่วงต่อ และโลกถูกบันทึกไว้ใน db (world/state)
// - ข้อความอื่นส่งผ่าน room.emit หัวข้อ c2s (ถึงโฮสต์) และ s2c (จากโฮสต์)
import { WorldCore } from './server-core.js';

const CHUNK = 900; // ตัวอักษรต่อชิ้น (ภาษาไทย 3 ไบต์/ตัว ให้ต่ำกว่า 4 KiB)

export class RoomNet {
  constructor() {
    this.online = false; this.handlers = []; this.isHost = false; this.core = null;
    this.gid = null; this.hello = null; this.welcomed = false; this.hostPeer = null;
    this.parts = new Map(); this.queue = []; this.sending = false; this.ckSeq = 1;
    this.lastPresence = 0; this.pendingPresence = null; this.saving = false; this.dirty = false;
  }

  static available() { return typeof window !== 'undefined' && typeof window.claude?.use === 'function'; }

  async connect() {
    if (!RoomNet.available()) return false;
    this.room = await window.claude.use('room');
    if (!this.room) return false;
    try { this.db = await window.claude.use('db'); } catch { this.db = null; }
    const ok = await new Promise((resolve) => {
      let done = false;
      const fin = (v) => { if (!done) { done = true; resolve(v); } };
      setTimeout(() => fin(this.room.connected()), 6000);
      this.room.onConnection((c) => { if (c) fin(true); }, () => fin(false));
    });
    if (!ok) return false;
    this.room.on('c2s', (msg) => this.onC2S(msg));
    this.room.on('s2c', (msg) => this.onS2C(msg));
    this.room.onPeers((ch) => this.onPeers(ch));
    this.online = true; this.readyAt = Date.now() + 2500;
    setInterval(() => this.housekeeping(), 1000);
    addEventListener('pagehide', () => this.save(true));
    return true;
  }

  on(h) { this.handlers.push(h); }
  deliver(m) { for (const h of this.handlers) { try { h(m); } catch (e) { console.error(e); } } }

  // ---------- การส่ง (แบ่งชิ้นเมื่อข้อความใหญ่) ----------
  emitBig(topic, obj) {
    const s = JSON.stringify(obj);
    const C = /^[\x00-\x7f]*$/.test(s) ? 3500 : CHUNK; // ข้อความ ASCII ล้วน (เช่นตำแหน่งสัตว์) ส่งชิ้นใหญ่ได้
    if (s.length <= C) return this.enqueue(topic, obj);
    const ck = `${this.gid}-${this.ckSeq++}`, n = Math.ceil(s.length / C);
    for (let i = 0; i < n; i++) this.enqueue(topic, { ck, i, n, s: s.slice(i * C, (i + 1) * C) });
  }
  enqueue(topic, data) {
    this.queue.push([topic, data]);
    if (!this.sending) this.flush();
  }
  async flush() {
    this.sending = true;
    while (this.queue.length) {
      const [topic, data] = this.queue.shift();
      try { await this.room.emit(topic, data); } catch (e) { if (e?.code === 'not_permitted') this.deliver({ t: 'notice', text: 'บัญชีนี้ยังไม่มีสิทธิ์ส่งข้อมูลในห้อง (ให้เจ้าของแชร์สิทธิ์ Contributor หรือ Editor)' }); }
      if (this.queue.length > 4) await new Promise((r) => setTimeout(r, 30));
    }
    this.sending = false;
  }
  reassemble(msg) {
    const d = msg.data; if (!d) return null;
    if (d.ck === undefined) return d;
    const key = msg.peer + d.ck;
    let p = this.parts.get(key);
    if (!p) { p = { n: d.n, got: 0, arr: [], t: Date.now() }; this.parts.set(key, p); }
    if (p.arr[d.i] === undefined) { p.arr[d.i] = d.s; p.got++; }
    if (p.got < p.n) return null;
    this.parts.delete(key);
    try { return JSON.parse(p.arr.join('')); } catch { return null; }
  }

  // ---------- API เดียวกับ Net (WebSocket) ----------
  send(m) {
    if (!this.online) return;
    if (m.t === 'hello') {
      this.gid = m.id; this.hello = m;
      this.setPresence({ g: m.id, n: m.name, s: m.sex, lk: m.look, p: m.p });
      if (this.isHost) this.core.message(this.gid, m);
      return;
    }
    if (m.t === 'state') {
      this.setPresence({ g: this.gid, n: this.hello?.name, s: this.hello?.sex, lk: this.hello?.look, p: m.p, ry: m.ry, a: m.anim, hp: m.hp, eq: m.eq ?? null, pets: m.pets, v: m.v ?? null, cl: m.cl, cb: m.cb | 0, lh: m.lh | 0, st: m.st | 0, en: m.en | 0, sf: m.sf ? 1 : 0, host: this.isHost ? 1 : 0 });
      if (this.isHost) this.core.message(this.gid, m);
      return;
    }
    if (this.isHost) this.core.message(this.gid, m);
    else if (this.hostPeer) this.emitBig('c2s', { m });
  }

  setPresence(patch) {
    this.pendingPresence = { ...(this.pendingPresence || {}), ...patch };
    const now = performance.now();
    if (now - this.lastPresence < 110) return;
    this.lastPresence = now;
    const p = this.pendingPresence; this.pendingPresence = null;
    this.room.presence(p).catch(() => {});
  }

  // ---------- รับข้อความ ----------
  onC2S(msg) {
    if (!this.isHost || msg.sameTab) return;
    const d = this.reassemble(msg); if (!d || !d.m) return;
    const g = this.gidOf(msg.peer); if (!g) return;
    if (d.m.t === 'hello' && d.m.id !== g) return;
    this.core.message(g, d.m);
  }
  onS2C(msg) {
    if (msg.sameTab) return;
    if (msg.peer !== this.hostPeer) return; // เชื่อเฉพาะโฮสต์ปัจจุบัน
    const d = this.reassemble(msg); if (!d || !d.m) return;
    if (d.to === '*' ? d.ex !== this.gid : d.to === this.gid) {
      if (d.m.t === 'welcome') this.welcomed = true;
      this.deliver(d.m);
    }
  }
  // จองชื่อตัวละคร: ห้ามซ้ำกับผู้เล่นที่ออนไลน์อยู่ และกับชื่อที่เคยใช้ในโลกนี้ (เก็บใน db)
  async claimName(name, gid) {
    const key = String(name).trim().toLowerCase();
    await new Promise((r) => setTimeout(r, 1200)); // รอรายชื่อผู้เล่นในห้องมาก่อน
    for (const p of this.room.peers()) { const pr = p.presence || {}; if (pr.g && pr.g !== gid && String(pr.n || '').trim().toLowerCase() === key) return false; }
    if (!this.db) return true;
    try {
      const ref = this.db.doc('names/' + [...key].map((c) => c.codePointAt(0).toString(36)).join('-').slice(0, 200));
      const s = await ref.get();
      if (s.exists && s.data().g !== gid) return false;
      if (!s.exists) await ref.set({ g: gid, n: String(name).slice(0, 16), t: Date.now() });
    } catch { /* ไม่มีสิทธิ์ db ก็ตรวจแค่คนที่ออนไลน์ */ }
    return true;
  }
  gidOf(peer) { const p = this.room.peers().find((x) => x.peer === peer); return p?.presence?.g || null; }

  onPeers(ch) {
    for (const p of [...ch.joined, ...ch.updated]) {
      const pr = p.presence || {};
      if (p.sameTab || !pr.g || pr.g === this.gid) continue;
      const st = { t: 'state', id: pr.g, name: pr.n, sex: pr.s, look: pr.lk, p: pr.p, ry: pr.ry, anim: pr.a, hp: pr.hp, eq: pr.eq ?? null, pets: pr.pets || [], v: pr.v ?? null, cl: pr.cl, cb: pr.cb | 0, lh: pr.lh | 0, st: pr.st | 0, en: pr.en | 0 };
      if (pr.p) this.deliver(st);
      if (this.isHost) {
        if (!this.core.players.has(pr.g)) this.core.hello(pr.g, { name: pr.n, sex: pr.s, look: pr.lk, p: pr.p });
        this.core.setState(pr.g, { p: pr.p, ry: pr.ry, anim: pr.a, hp: pr.hp ?? 100, pets: pr.pets || [], safe: !!pr.sf });
      }
    }
    for (const p of ch.left) {
      const g = p.presence?.g;
      if (!g || g === this.gid) continue;
      this.deliver({ t: 'leave', id: g });
      if (this.isHost) this.core.leave(g);
    }
    this.electHost();
  }

  // โฮสต์: คนที่ประกาศตัวเป็นโฮสต์อยู่แล้ว (ถ้ามีหลายคน เลือก peer ที่น้อยที่สุด) ไม่งั้นคือ peer ที่น้อยที่สุดในเกม
  electHost() {
    if (Date.now() < this.readyAt) return;
    const inGame = this.room.peers().filter((p) => p.presence?.g);
    if (!this.gid || !inGame.some((p) => p.sameTab)) return;
    const declared = inGame.filter((p) => p.presence.host && !p.sameTab).map((p) => p.peer).sort();
    const me = inGame.find((p) => p.sameTab).peer;
    let host;
    if (declared.length) host = this.isHost && me < declared[0] ? me : declared[0];
    else host = inGame.map((p) => p.peer).sort()[0];
    if (host === this.hostPeer) return;
    this.hostPeer = host;
    if (host === me && !this.isHost) this.becomeHost();
    else if (host !== me) {
      if (this.isHost) this.stepDown();
      this.welcomed = false; this.helloT = 0;
    }
  }

  async becomeHost() {
    this.isHost = true;
    let state = null;
    if (this.db) { try { const s = await this.db.doc('world/state').get(); if (s.exists) state = s.data(); } catch { /* no db access */ } }
    const self = this;
    this.core = new WorldCore({
      state: state ? JSON.parse(JSON.stringify(state)) : null, relayState: false,
      send: (id, m) => { if (id === self.gid) queueMicrotask(() => self.deliver(m)); else self.emitBig('s2c', { to: id, m }); },
      broadcast: (m, ex) => { if (ex !== self.gid) queueMicrotask(() => self.deliver(m)); self.emitBig('s2c', { to: '*', ex: ex || null, m }); },
      onDirty: () => { self.dirty = true; },
    });
    // ลงทะเบียนตัวเองและทุกคนที่อยู่ในห้องตอนนี้ (ส่ง welcome ให้ซิงก์ใหม่)
    if (this.hello) this.core.hello(this.gid, { ...this.hello, silent: true });
    for (const p of this.room.peers()) {
      const pr = p.presence || {};
      if (p.sameTab || !pr.g || pr.g === this.gid) continue;
      this.core.players.set(pr.g, { id: pr.g, name: pr.n, sex: pr.s, look: pr.lk, p: pr.p, hp: pr.hp ?? 100, pets: [], safe: !!pr.sf });
      this.core.hello(pr.g, { name: pr.n, sex: pr.s, look: pr.lk, p: pr.p });
    }
    this.welcomed = true;
    this.setPresence({ host: 1 });
    let last = performance.now();
    this.tickTimer = setInterval(() => { const now = performance.now(); this.core.tick(Math.min(0.25, (now - last) / 1000)); last = now; }, 100);
    this.deliver({ t: 'notice', text: '🛰️ คุณเป็นโฮสต์ของโลกนี้ (คอมพิวเตอร์ของคุณคำนวณผู้ติดเชื้อให้ทุกคน)' });
  }
  stepDown() {
    this.save();
    clearInterval(this.tickTimer); this.isHost = false; this.core = null;
    this.setPresence({ host: 0 });
  }

  async save(force = false) {
    if (!this.isHost || !this.db || this.saving || (!this.dirty && !force)) return;
    this.saving = true; this.dirty = false;
    try {
      let snap = this.core.snapshot();
      if (JSON.stringify(snap).length > 240000) snap = { ...snap, res: {}, loot: {} };
      await this.db.doc('world/state').set(snap);
    } catch { this.dirty = true; }
    this.saving = false;
  }

  housekeeping() {
    if (this.pendingPresence) this.setPresence({});
    for (const [k, p] of this.parts) if (Date.now() - p.t > 15000) this.parts.delete(k);
    this.saveT = (this.saveT || 0) + 1;
    if (this.saveT >= 10) { this.saveT = 0; this.save(); }
    // ยังไม่ได้ welcome จากโฮสต์ → ส่ง hello ซ้ำ
    if (!this.isHost && this.hostPeer && this.hello && !this.welcomed) {
      this.helloT = (this.helloT || 0) - 1;
      if (this.helloT <= 0) { this.helloT = 4; this.emitBig('c2s', { m: this.hello }); }
    }
    if (!this.hostPeer && this.gid) this.electHost();
  }
}
