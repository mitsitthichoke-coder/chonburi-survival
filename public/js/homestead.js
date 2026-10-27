// บ้าน ฟาร์ม เล้าไก่ บ่อปลา หีบเก็บของ บ้านสัตว์เลี้ยง และยานพาหนะ (ฝั่งผู้เล่น)
import { PIECES, CROPS, FEEDS, cropProgress, coopEggs, pondFish, fedLeft, FEED_MAX, FEED_MS, baseY } from './building-core.js';
import { heightAt, waterAt } from './terrain.js';
import { ITEMS , hasPerk } from './data.js';

const VEH = { bicycle: { spd: 9.5, name: 'จักรยาน', seat: 0.55 }, motorbike: { spd: 17, name: 'มอเตอร์ไซค์', seat: 0.6, fuel: 0.04 }, pickup: { spd: 21, name: 'รถกระบะดัดแปลง', seat: 0.95, fuel: 0.05 }, ev_car: { spd: 22, name: 'รถยนต์ไฟฟ้า EV', seat: 0.95, fuel: 0.045, electric: true }, ev_bike: { spd: 18, name: 'มอเตอร์ไซค์ไฟฟ้า', seat: 0.6, fuel: 0.035, electric: true }, raft: { spd: 6, name: 'แพไม้ไผ่', seat: 0.3 } };
const INTERACT = new Set(['door', 'gate', 'bed', 'storage', 'plot', 'coop', 'pond', 'pethouse', 'vehicle']);
const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export class Homestead {
  constructor(game) { this.g = game; this.rainT = 0; }

  // ---------- ส่งคำสั่งไปยังสิ่งก่อสร้าง ----------
  // คำสั่งกับสิ่งก่อสร้าง: ค่าใช้จ่าย (เมล็ด น้ำ อาหาร ของฝาก น้ำมัน) หักผ่านระบบเศรษฐกิจ
  op(s, op) { this.g.auth.sop(s, op); }
  onGive(m) {
    for (const [k, q] of Object.entries(m.items || {})) if (q > 0) this.g.addItem(k, q);
    if (m.msg) this.g.ui.toast(m.msg);
  }
  onPlaced(s) {
    const g = this.g;
    if (s.owner !== g.id) return;
    if (s.type === 'bed' || s.type === 'shelter') { g.spawnPoint = { x: s.x, z: s.z, y: s.type === 'bed' ? baseY(s) + 0.6 : undefined }; g.ui.toast('🛏️ ตั้งจุดเกิดใหม่ที่นี่แล้ว'); }
    if (s.type === 'coop') g.ui.toast('🐔 แม่ไก่ 2 ตัวย้ายเข้าเล้าแล้ว — ให้อาหาร (ข้าวโพด/ผัก/ผลไม้ป่า) แล้วจะออกไข่');
  }
  demolish(s) {
    const g = this.g;
    if (s.owner && s.owner !== g.id) return g.ui.toast('รื้อได้เฉพาะของที่ตัวเองสร้าง', 'warn');
    g.auth.sdel(s);
  }
  onNet(m) {
    const g = this.g;
    if (m.t === 'supd') { g.world.updateStructure(m.id, m.patch); g.ui.refreshPanels(); }
    else if (m.t === 'sdel') { g.world.removeStructure(m.id); for (const p of g.pets) if (p.home === m.id) p.home = null; }
    else if (m.t === 'give') this.onGive(m);
    else if (m.t === 'place') this.onPlaced(m.s);
  }

  // ---------- การโต้ตอบ (ปุ่ม E) ----------
  target() {
    const g = this.g, P = g.player.pos;
    if (g.vehicle) {
      const v = g.vehicle.s;
      return { text: `🛑 ลงจาก${VEH[v.vt].name}${VEH[v.vt]?.fuel ? ` (⛽ ${Math.round(v.fuel ?? 0)}%)` : ''}`, act: () => this.dismount() };
    }
    const s = g.world.nearestStructure(P.x, P.z, 2.6, (o) => INTERACT.has(o.type) && (o.type === 'vehicle' || Math.abs(baseY(o) - P.y) < 2.5));
    if (!s) return null;
    const now = g.now(), mine = !s.owner || s.owner === g.id;
    switch (s.type) {
      case 'door': case 'gate': return { text: `${s.open ? '🚪 ปิด' : '🚪 เปิด'}${s.type === 'gate' ? 'ประตูรั้ว' : 'ประตู'}${s.lock ? ' 🔒' : ''}${mine && !g.touch ? ' · L = ล็อก' : ''}`, act: () => this.op(s, { o: 'door' }), s };
      case 'bed': return { text: '🛏️ นอนพัก / ตั้งจุดเกิดที่นี่', act: () => this.sleep(s) };
      case 'storage': return { text: '🧰 เปิดหีบเก็บของ', act: () => g.ui.openStructure(s) };
      case 'coop': case 'pond': case 'pethouse': return { text: `${PIECES[s.type].icon} ${PIECES[s.type].name}`, act: () => g.ui.openStructure(s) };
      case 'plot': return this.plotTarget(s, now);
      case 'vehicle': {
        const V = VEH[s.vt];
        if (V?.electric && (s.fuel ?? 0) < 95) {
          // รถ EV: ชาร์จที่แผงโซล่าเซลล์ (ช่างไฟฟ้าขั้นสูงชาร์จได้ทุกที่ตอนกลางวัน)
          const solar = g.world.nearestStructure(s.x, s.z, 9, (x) => x.type === 'solar'), anywhere = hasPerk(g.auth.ch, 'electrician', 2), sun = !g.isNight() && !g.weather.rain;
          if ((solar || anywhere) && !sun) return { text: `🔋 ${V.name} ${Math.round(s.fuel ?? 0)}% — ☁️ ชาร์จได้เฉพาะตอนกลางวันที่มีแดด · กด E เพื่อขี่`, act: () => this.mount(s) };
          if (solar || anywhere) return { text: `⚡ ชาร์จ${V.name} (🔋 ${Math.round(s.fuel ?? 0)}%) ☀️`, act: () => { this.op(s, { o: 'move', x: s.x, z: s.z, ry: s.ry || 0, fuel: Math.min(100, (s.fuel ?? 0) + 30) }); g.sfx.play('radio'); } };
        }
        if (VEH[s.vt]?.fuel && !V.electric && (s.fuel ?? 0) < 80 && g.hasItem('fuel')) return { text: `⛽ เติมน้ำมัน${V.name} (${Math.round(s.fuel ?? 0)}%)`, act: () => { this.op(s, { o: 'move', x: s.x, z: s.z, ry: s.ry || 0, fuel: Math.min(100, (s.fuel ?? 0) + 50) }); g.sfx.play('drink'); } };
        if (s.driver && s.driver !== g.id) return { text: `${V.name} (มีคนขับอยู่)`, act: () => {} };
        return { text: `${ITEMS[s.vt].icon} ขี่${V.name}${VEH[s.vt]?.fuel ? ` (${V.electric ? '🔋' : '⛽'} ${Math.round(s.fuel ?? 0)}%)` : ''}`, act: () => this.mount(s) };
      }
    }
    return null;
  }
  plotTarget(s, now) {
    const g = this.g;
    if (!s.crop) {
      const seed = Object.entries(CROPS).find(([, c]) => g.hasItem(c.seed));
      if (!seed) return { text: '🌱 แปลงผักว่าง — ต้องมีเมล็ดข้าวโพด / เมล็ดผักบุ้ง / สมุนไพร', act: () => g.ui.toast('หาเมล็ดได้จากกล่องเสบียง หรือจากการเก็บเกี่ยว', 'warn') };
      const [key, c] = seed;
      return { text: `🌱 ปลูก${c.name} (ใช้${ITEMS[c.seed].name})`, act: () => this.op(s, { o: 'plant', crop: key }) };
    }
    const p = cropProgress(s, now), C = CROPS[s.crop];
    if (p >= 1) return { text: `🧺 เก็บเกี่ยว${C.name}`, act: () => this.op(s, { o: 'harvest' }) };
    if (!s.wt) {
      const w = ['dirty_water', 'clean_water'].find((k) => g.hasItem(k));
      if (g.weather.rain) return { text: `🌧️ ฝนรดน้ำให้${C.name}แล้ว (${Math.floor(p * 100)}%)`, act: () => this.op(s, { o: 'water' }) };
      if (ITEMS[g.equipped]?.tool?.water) return { text: `🚿 รดน้ำ${C.name}ด้วยบัว (${Math.floor(p * 100)}%)`, act: () => { g.atkT = 1; g.player.mesh.userData.atkStyle = 'pour'; g.sfx.play('splash'); this.op(s, { o: 'water' }); } };
      return { text: w ? `💧 รดน้ำ${C.name} (${Math.floor(p * 100)}%)` : `${C.name} ${Math.floor(p * 100)}% — ต้องมีน้ำ 1 ขวดเพื่อรดน้ำ (โตเร็วขึ้น ~3 เท่า)`, act: () => { if (w) this.op(s, { o: 'water' }); } };
    }
    const left = (1 - p) * C.grow;
    return { text: `${C.name} โตแล้ว ${Math.floor(p * 100)}% · อีก ~${mmss(left)}`, act: () => {} };
  }
  sleep(s) {
    const g = this.g;
    g.spawnPoint = { x: s.x, z: s.z, y: baseY(s) + 0.6 };
    g.stats.stamina = g.maxStamina();
    if (g.isNight() && !g.net.online) return g.sleepToMorning();
    g.ui.toast('🛏️ พักผ่อนแล้ว — บ้านหลังนี้เป็นจุดเกิดของคุณ');
  }

  // แผงข้อมูลเล้าไก่/บ่อปลา/บ้านสัตว์เลี้ยง/หีบ (เรียกจาก UI)
  panel(s) {
    const g = this.g, now = g.now(), acts = [];
    const feed = FEEDS.find((k) => g.hasItem(k));
    let info = '';
    if (s.type === 'coop') {
      const n = coopEggs(s, now), fl = fedLeft(s, now);
      info = `🥚 ไข่ในเล้า: <b>${n}</b>/8 · 🍽️ อิ่มอีก ${fl ? mmss(fl) : '— หิว (ไม่ออกไข่)'}<br><small>ไก่ออกไข่ 1 ฟองทุก 3 นาทีขณะอิ่ม</small>`;
      acts.push({ label: `🥚 เก็บไข่ (${n})`, dis: !n, run: () => this.op(s, { o: 'collect' }) });
      acts.push({ label: feed ? `🌽 ให้อาหาร (${ITEMS[feed].name})` : '🌽 ให้อาหาร (ต้องมีข้าวโพด/ผัก/ผลไม้ป่า)', dis: !feed || fl > FEED_MAX - FEED_MS, run: () => this.op(s, { o: 'feed', item: feed }) });
    } else if (s.type === 'pond') {
      const n = pondFish(s, now), fl = fedLeft(s, now);
      const fish = ['golden_fish', 'raw_fish'].find((k) => g.hasItem(k));
      info = `🐟 พันธุ์ปลาในบ่อ: <b>${s.stock || 0}</b>/6${s.gold ? ' (มีปลาทอง ×2)' : ''} · ปลาที่จับได้: <b>${n}</b>/8 · 🍽️ อิ่มอีก ${fl ? mmss(fl) : '— หิว'}<br><small>ปล่อยปลาเป็นพันธุ์ก่อน ยิ่งมากยิ่งเพิ่มเร็ว · ตกปลาในบ่อด้วยเบ็ดได้ด้วย</small>`;
      acts.push({ label: fish ? `🐟 ปล่อย${ITEMS[fish].name}ลงบ่อ` : '🐟 ปล่อยปลา (ต้องมีปลาสด)', dis: !fish || (s.stock || 0) >= 6, run: () => this.op(s, { o: 'stock', item: fish }) });
      acts.push({ label: `🎣 จับปลาในบ่อ (${n})`, dis: !n, run: () => this.op(s, { o: 'collect' }) });
      acts.push({ label: feed ? `🍞 ให้อาหารปลา (${ITEMS[feed].name})` : '🍞 ให้อาหารปลา (ต้องมีผัก/ข้าวโพด/ผลไม้ป่า)', dis: !feed || fl > FEED_MAX - FEED_MS || !(s.stock > 0), run: () => this.op(s, { o: 'feed', item: feed }) });
    } else if (s.type === 'pethouse') {
      const here = g.pets.filter((p) => p.home === s.id);
      info = `บ้านสัตว์เลี้ยงของ${s.owner === g.id ? 'คุณ' : 'เพื่อน'} · อยู่บ้าน ${here.length} ตัว<br><small>สัตว์ที่อยู่บ้านจะฟื้นพลังชีวิต ความผูกพันไม่ลด และช่วยเฝ้าบ้านจากผู้ติดเชื้อ</small>`;
      for (const p of g.pets) acts.push(p.home === s.id ? { label: `🚶 พา ${p.name} ออกมาด้วย`, run: () => { p.home = null; p.stay = false; g.ui.refreshPanels(); } } : { label: `🏠 ให้ ${p.name} อยู่บ้านนี้`, run: () => { p.home = s.id; g.ui.toast(`${p.name} จะเฝ้าบ้านหลังนี้`); g.ui.refreshPanels(); } });
    } else if (s.type === 'storage') {
      info = `หีบของ${s.owner === g.id ? 'คุณ' : 'เพื่อน'}${s.lock ? ' 🔒' : ''} — ทุกคนที่เล่นด้วยกันเห็นของในหีบเดียวกัน`;
      if (s.owner === g.id || !s.owner) acts.push({ label: s.lock ? '🔓 ปลดล็อกหีบ' : '🔒 ล็อกหีบ (ให้เฉพาะเพื่อนเปิดได้)', run: () => this.op(s, { o: 'lock' }) });
    }
    return { info, acts };
  }
  deposit(s, item, qty) { if (qty > 0 && this.g.hasItem(item, qty)) this.op(s, { o: 'store', item, qty }); }
  withdraw(s, item, qty) { this.op(s, { o: 'store', item, qty: -qty }); }
  toggleLock() {
    const g = this.g, P = g.player.pos;
    const s = g.world.nearestStructure(P.x, P.z, 2.6, (o) => ['door', 'gate', 'storage'].includes(o.type));
    if (s) this.op(s, { o: 'lock' });
  }

  // ---------- ยานพาหนะ ----------
  mount(s) {
    const g = this.g;
    if (VEH[s.vt]?.fuel && (s.fuel ?? 0) <= 0) g.ui.toast(VEH[s.vt].electric ? '🔋 แบตหมด! ไปชาร์จที่แผงโซล่าเซลล์' : '⛽ น้ำมันหมด! หาน้ำมันจากรถร้างหรือกล่องเสบียง', 'warn');
    if (s.vt === 'raft' && !waterAt(s.x, s.z)) g.ui.toast('🛶 แพต้องอยู่ในน้ำ — วางแพที่ชายหาดแล้วพายออกทะเล', 'warn');
    this.op(s, { o: 'drive', on: true });
    const mesh = g.world.structureMeshes.get(s.id);
    g.vehicle = { s, mesh, speed: 0 };
    g.player.pos.set(s.x, g.player.pos.y, s.z); g.player.ry = s.ry || 0;
    g.ui.toast(`${ITEMS[s.vt].icon} ขี่${VEH[s.vt].name} — W/S เร่ง/ถอย · A/D เลี้ยว · E ลง`);
  }
  dismount() {
    const g = this.g, v = g.vehicle; if (!v) return;
    const p = g.player, s = v.s;
    g.vehicle = null; g.sfx.engine(0);
    this.op(s, { o: 'move', x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), ry: +p.ry.toFixed(2), fuel: s.fuel });
    if (!g.net.online) s.driver = null;
    p.pos.x += Math.cos(p.ry) * 1.3; p.pos.z -= Math.sin(p.ry) * 1.3;
    p.mesh.userData.lLeg.rotation.x = p.mesh.userData.rLeg.rotation.x = 0;
  }
  drive(dt, fx, fz) {
    const g = this.g, v = g.vehicle, p = g.player, s = v.s, V = VEH[s.vt], st = g.stats;
    let top = V.spd * (hasPerk(g.auth.ch, 'mechanic', 2) && V.fuel ? 1.15 : 1);
    if (VEH[s.vt]?.fuel && (s.fuel ?? 0) <= 0) top = 0;
    if (s.vt === 'bicycle' && st.stamina <= 1) top = 3;
    const want = fz > 0 ? top : fz < 0 ? -top * 0.35 : 0;
    v.speed += (want - v.speed) * Math.min(1, dt * (s.vt === 'raft' ? 0.8 : 1.6));
    p.ry += fx * dt * (s.vt === 'raft' ? 1.2 : 2.2) * (v.speed < -0.1 ? -1 : 1) * Math.min(1, Math.abs(v.speed) / 3 + 0.3);
    const nx = p.pos.x + Math.sin(p.ry) * v.speed * dt, nz = p.pos.z + Math.cos(p.ry) * v.speed * dt;
    const h = heightAt(nx, nz), w = waterAt(nx, nz, h);
    const okTerrain = s.vt === 'raft' ? !!w && h < w.level - 0.4 : !w || h > w.level - 0.5;
    if (okTerrain) { p.pos.x = nx; p.pos.z = nz; } else v.speed *= 0.2;
    const pos = { x: p.pos.x, z: p.pos.z, y: p.pos.y };
    if (g.world.collide(pos, 0.7)) v.speed *= 0.5;
    p.pos.x = pos.x; p.pos.z = pos.z;
    const W = waterAt(p.pos.x, p.pos.z);
    p.pos.y = (s.vt === 'raft' && W ? W.level - 0.05 : heightAt(p.pos.x, p.pos.z)) + V.seat;
    p.vy = 0; p.onGround = true; p.swim = false; p.speedNow = Math.abs(v.speed);
    if (s.vt === 'bicycle' && Math.abs(v.speed) > 1) st.stamina = Math.max(0, st.stamina - 2 * dt);
    if (V.fuel) { s.fuel = Math.max(0, (s.fuel ?? 0) - Math.abs(v.speed) * dt * V.fuel * (hasPerk(g.auth.ch, 'mechanic', 1) ? 0.5 : 1) * (V.electric && hasPerk(g.auth.ch, 'electrician', 1) ? 0.6 : 1)); g.sfx.engine(Math.abs(v.speed) / V.spd); }
    s.x = p.pos.x; s.z = p.pos.z; s.ry = p.ry;
    if (v.mesh) { v.mesh.position.set(p.pos.x, p.pos.y - V.seat, p.pos.z); v.mesh.rotation.y = p.ry; v.mesh.visible = true; }
    // กล้องหมุนตามหลังยานพาหนะ
    let d = p.ry - Math.PI - g.camYaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(v.speed) > 1) g.camYaw += d * Math.min(1, dt * 1.5);
    const u = p.mesh.userData; u.lLeg.rotation.x = u.rLeg.rotation.x = -1.3;
    p.mesh.rotation.y = p.ry;
    // เดินทางไปที่เกาะ = ประสบการณ์เอาตัวรอด
    this.distT = (this.distT || 0) + Math.abs(v.speed) * dt; if (this.distT > 300) { this.distT = 0; g.gainXp('survival', 2); }
  }

  // ---------- ทุกเฟรม ----------
  tick(dt) {
    const g = this.g, P = g.player.pos;
    g.world.tickStructures(g.now(), dt, P);
    // ซ่อนยานพาหนะที่คนอื่นกำลังขับ (เห็นจากตัวผู้เล่นคนนั้นแทน)
    for (const s of g.world.structures) if (s.type === 'vehicle') {
      const m = g.world.structureMeshes.get(s.id);
      if (m) m.visible = !(s.driver && s.driver !== g.id && g.ents.remotes.has(s.driver));
      if (m && !(g.vehicle && g.vehicle.s === s) && m.visible) { const W = waterAt(s.x, s.z); m.position.y = s.vt === 'raft' && W ? W.level - 0.05 : heightAt(s.x, s.z); m.rotation.y = s.ry || 0; }
    }
    // ฝนรดน้ำแปลงผักให้
    this.rainT -= dt;
    if (this.rainT <= 0) {
      this.rainT = 8;
      if (g.weather.rain) for (const s of g.world.structures) if (s.type === 'plot' && s.crop && !s.wt && Math.hypot(s.x - P.x, s.z - P.z) < 80) this.op(s, { o: 'water', silent: true });
    }
  }
  vehicleFor(vt) { return VEH[vt]; }
}
