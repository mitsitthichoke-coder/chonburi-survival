// บ้าน ฟาร์ม เล้าไก่ บ่อปลา หีบเก็บของ บ้านสัตว์เลี้ยง และยานพาหนะ (ฝั่งผู้เล่น)
import { BASE_NEED, baseCheck, protectLeft, HOUSE_LV, HOUSE_UP, REPAIR_BASE, ROLES, roleIn, GAME_DAY_MS, PIECES, CROPS, FEEDS, cropProgress, coopEggs, pondFish, fedLeft, FEED_MAX, FEED_MS, baseY, cageCatch, TRAP_MS, BAIT_MEAT, BAIT_PLANT, CAGE_FARM, CAGE_FOOD, CAGE_NAME, PENS, herdOf, ageStage, STAGE_NAME, waterLeft, WATER_MAX, WATER_MS, penGoods, isPlot, isGrow, cropsFor, needsTill, hiveHoney, HONEY_CAP, flowersNear, STALL_MAX } from './building-core.js';
import { heightAt, waterAt } from './terrain.js';
import { ridePose } from './models.js';
import { ITEMS , hasPerk, PET_TYPES } from './data.js';

const VEH = { bicycle: { spd: 9.5, name: 'จักรยาน', seat: 0.55 }, motorbike: { spd: 17, name: 'มอเตอร์ไซค์', seat: 0.6, fuel: 0.04 }, pickup: { spd: 21, name: 'รถกระบะดัดแปลง', seat: 0.95, fuel: 0.05 }, ev_car: { spd: 22, name: 'รถยนต์ไฟฟ้า EV', seat: 0.95, fuel: 0.045, electric: true }, ev_bike: { spd: 18, name: 'มอเตอร์ไซค์ไฟฟ้า', seat: 0.6, fuel: 0.035, electric: true }, raft: { spd: 6, name: 'แพไม้ไผ่', seat: 0.3 } };
const INTERACT = new Set(['door', 'gate', 'bed', 'storage', 'plot', 'coop', 'duckpen', 'pigpen', 'cowpen', 'buffalopen', 'sheeppen', 'hive', 'stall', 'basecore', 'pot', 'pond', 'pethouse', 'vehicle', 'cage']);
export const pieceInfo = (s) => PIECES[s.type] || (s.type === 'pot' ? { name: 'กระถางดอกไม้', icon: '🪴' } : { name: s.type, icon: '📦' });
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
    if (PENS[s.type]) g.ui.toast(`${PIECES[s.type].icon} ${PENS[s.type].name}ย้ายเข้าคอกแล้ว — ให้อาหารและน้ำ แล้วจะให้ผลผลิตเมื่อโตเต็มวัย`);
    if (s.type === 'hive') g.ui.toast('🐝 ปลูกดอกไม้ (ทานตะวัน/ดาวเรือง หรือกระถางดอกไม้) ให้บานใกล้กล่อง ผึ้งจะมาทำรัง');
    if (isPlot(s.type)) g.ui.toast('⛏️ พรวนดินด้วยจอบก่อน แล้วค่อยปลูก');
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
    const s = g.world.nearestStructure(P.x, P.z, 2.6, (o) => (INTERACT.has(o.type) || isPlot(o.type)) && (o.type === 'vehicle' || Math.abs(baseY(o) - P.y) < 2.5));
    if (!s) return null;
    const now = g.now(), mine = !s.owner || s.owner === g.id;
    switch (s.type) {
      case 'door': case 'gate': return { text: `${s.open ? '🚪 ปิด' : '🚪 เปิด'}${s.type === 'gate' ? 'ประตูรั้ว' : 'ประตู'}${s.lock ? ' 🔒' : ''}${mine && !g.touch ? ' · L = ล็อก' : ''}`, act: () => this.op(s, { o: 'door' }), s };
      case 'bed': return { text: '🛏️ นอนพัก / ตั้งจุดเกิดที่นี่', act: () => this.sleep(s) };
      case 'storage': return { text: '🧰 เปิดหีบเก็บของ', act: () => g.ui.openStructure(s) };
      case 'coop': case 'duckpen': case 'pigpen': case 'cowpen': case 'buffalopen': case 'sheeppen': case 'hive': case 'stall': case 'basecore': case 'pond': case 'pethouse': return { text: `${PIECES[s.type].icon} ${PIECES[s.type].name}`, act: () => g.ui.openStructure(s) };
      case 'plot': case 'pot': return this.plotTarget(s, now);
      case 'cage': {
        // กรงดักสัตว์: ใส่เหยื่อ → รอ → เปิดกรงรับสัตว์เลี้ยง
        const caught = cageCatch(s, now);
        if (caught) {
          const nm = PET_TYPES[caught]?.name || CAGE_NAME[caught] || caught, pen = CAGE_FARM[caught], hasPen = pen && g.world.structures.some((o) => o.type === pen && (!o.owner || o.owner === g.id));
          return { text: `🐾 มี${nm}ติดกรง! เลือกว่าจะทำอะไร`, act: () => g.ui.choice(`🪤 ${nm}ติดกรงแล้ว — เลือก:`, [
            { label: '🐾 เลี้ยงเป็นสัตว์เลี้ยง', dis: !PET_TYPES[caught] && 'เป็นสัตว์เลี้ยงไม่ได้', run: () => this.op(s, { o: 'claim', mode: 'pet' }) },
            { label: pen ? `🏡 นำเข้า${PIECES[pen].name.split(' ')[0]}ในฟาร์ม` : '🏡 นำเข้าฟาร์ม', dis: !pen ? 'สัตว์นี้เลี้ยงในฟาร์มไม่ได้' : !hasPen && `ต้องสร้าง${PIECES[pen].name.split(' ')[0]}ก่อน`, run: () => this.op(s, { o: 'claim', mode: 'farm' }) },
            { label: CAGE_FOOD[caught] ? `🍖 แปรรูปเป็นอาหาร (${Object.entries(CAGE_FOOD[caught]).map(([k, q]) => ITEMS[k].icon + q).join(' ')})` : '🍖 แปรรูปอาหาร', dis: !CAGE_FOOD[caught] && 'สัตว์ตัวนี้แปรรูปไม่ได้', run: () => this.op(s, { o: 'claim', mode: 'food' }) },
            { label: '🌿 ปล่อยคืนป่า', run: () => this.op(s, { o: 'claim', mode: 'free' }) },
          ]) };
        }
        if (s.bait) return { text: `🪤 รอสัตว์มาติดกรง... ${Math.min(99, Math.floor(((now - s.bt) / TRAP_MS) * 100))}% (เหยื่อ: ${ITEMS[s.bait].name})`, act: () => {} };
        const bait = [...BAIT_MEAT, ...BAIT_PLANT].find((k) => g.hasItem(k));
        return { text: bait ? `🪤 ใส่เหยื่อ ${ITEMS[bait].icon} ${ITEMS[bait].name} (เนื้อ = ล่อสัตว์กินเนื้อ · พืช = ล่อสัตว์กินพืช)` : '🪤 กรงว่าง — ต้องมีเหยื่อ: เนื้อ/ปลา หรือ ผัก/ข้าวโพด/ผลไม้', act: () => { if (bait) this.op(s, { o: 'bait', item: bait }); } };
      }
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
    if (isPlot(s.type)) return this.plotTarget(s, now);
    return null;
  }
  plotTarget(s, now) {
    const g = this.g;
    const where = s.type === 'pot' ? 'กระถาง' : 'แปลง';
    if (!s.crop) {
      const ok = cropsFor(s.type), names = ok.map((k) => CROPS[k].name).join('/');
      if (needsTill(s) && !s.tl) return g.hasItem('hoe') ? { text: `⛏️ พรวนดิน${PIECES[s.type].name}ก่อนปลูก`, act: () => { g.atkT = 1; g.player.mesh.userData.atkStyle = 'smash'; this.op(s, { o: 'till' }); } } : { text: `⛏️ ${PIECES[s.type].name} — ต้องพรวนดินด้วยจอบก่อน (ประดิษฐ์: ไม้ 2 + หิน 2)`, act: () => g.ui.toast('ประดิษฐ์จอบได้ในแท็บกระเป๋า/สร้างบ้าน', 'warn') };
      const seed = ok.find((k) => g.hasItem(CROPS[k].seed));
      if (!seed) return { text: `🌱 ${where}ว่าง — ต้องมีเมล็ด/กิ่งพันธุ์ (${names.length > 40 ? names.slice(0, 40) + '…' : names})`, act: () => g.ui.toast('ซื้อเมล็ดได้ที่ร้านเกษตรกร (ปลายฟ้า บ้านบึง) หรือค้นกล่องเสบียง', 'warn') };
      const c = CROPS[seed];
      return { text: `🌱 ปลูก${c.name} (ใช้${ITEMS[c.seed].name})`, act: () => this.op(s, { o: 'plant', crop: seed }) };
    }
    const p = cropProgress(s, now), C = CROPS[s.crop];
    if (p >= 1) return { text: `🧺 เก็บ${C.flower ? 'ดอก' : 'เกี่ยว'}${C.name}`, act: () => this.op(s, { o: 'harvest' }) };
    if (s.wt && isPlot(s.type) && !s.lo && g.hasItem('hoe')) return { text: `⛏️ พรวนดินรอบต้น${C.name} (ผลผลิต +1) · ${Math.floor(p * 100)}%`, act: () => { g.atkT = 1; g.player.mesh.userData.atkStyle = 'smash'; this.op(s, { o: 'till' }); } };
    if (s.wt && !s.fb && g.hasItem('manure')) return { text: `💩 ใส่ปุ๋ยคอกให้${C.name} (โตเร็วขึ้น) · ${Math.floor(p * 100)}%`, act: () => this.op(s, { o: 'fert' }) };
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
    if (g.sleeping) return;
    // ขึ้นไปนอนบนเตียง (อนิเมชั่นนอน + จอค่อย ๆ มืด) แล้วค่อยพัก / ข้ามไปเช้า
    g.startSleep({ x: s.x, z: s.z, y: baseY(s) + 0.55, ry: (s.rot & 3) * Math.PI / 2 }, () => {
      g.spawnPoint = { x: s.x, z: s.z, y: baseY(s) + 0.6 };
      g.stats.stamina = g.maxStamina();
      if (g.isNight() && !g.net.online) return g.sleepToMorning();
      g.ui.toast('🛏️ พักผ่อนแล้ว — บ้านหลังนี้เป็นจุดเกิดของคุณ');
    });
  }

  // แผงข้อมูลเล้าไก่/บ่อปลา/บ้านสัตว์เลี้ยง/หีบ (เรียกจาก UI)
  panel(s) {
    const g = this.g, now = g.now(), acts = [];
    const feed = FEEDS.find((k) => g.hasItem(k));
    let info = '';
    const P = PENS[s.type];
    if (P && (s.type !== 'coop' || s.herd || s.wat !== undefined)) {
      // คอกสัตว์: อาหาร น้ำ อายุ ผลผลิต
      const herd = herdOf(s, now), fl = fedLeft(s, now), wl = waterLeft(s, now), n = penGoods(s, now);
      const pf = P.foods.find((k) => g.hasItem(k)), water = ITEMS[g.equipped]?.tool?.water ? 'can' : ['dirty_water', 'clean_water'].find((k) => g.hasItem(k));
      const ageTxt = herd.map((a, i) => { const st = ageStage(P, a, now), m = a.b < 0 ? '' : ` ${Math.floor((now - a.b) / 60000)} นาที`; return `${PIECES[s.type].icon}${i + 1}: ${STAGE_NAME[st]}${m}`; }).join(' · ') || 'ไม่มีสัตว์ในคอก';
      info = `${ageTxt}<br>🍽️ อาหาร: ${fl ? mmss(fl) : '<b class="miss">หิว</b>'} · 💧 น้ำ: ${wl ? mmss(wl) : '<b class="miss">กระหายน้ำ</b>'} · 🧺 ผลผลิต: <b>${n}</b>/${P.cap} ${ITEMS[P.prod[0]].icon}${P.extra ? ` + ${ITEMS[P.extra[0]].icon}${ITEMS[P.extra[0]].name}` : ''}
        <br><small>ให้ผลผลิตเมื่อ "อิ่ม + มีน้ำ" และโตเต็มวัย (ลูก ${Math.round(P.adult / 60000)} นาที → โต · แก่หลัง ${Math.round(P.old / 60000)} นาที ผลผลิตลดครึ่ง · อายุขัย ${Math.round(P.life / 60000)} นาที) · อาหาร: ${P.foods.map((k) => ITEMS[k].icon).join('')}</small>`;
      acts.push({ label: `🧺 เก็บผลผลิต (${n})`, dis: !n, run: () => this.op(s, { o: 'collect' }) });
      const live = Object.keys(g.inv).find((k) => g.inv[k] > 0 && ITEMS[k]?.live === s.type);
      if (live) acts.push({ label: `🐾 ปล่อย${ITEMS[live].name.split(' ')[0]}เข้าคอก`, dis: herd.length >= P.max, run: () => this.op(s, { o: 'addlive', item: live }) });
      acts.push({ label: pf ? `🍽️ ให้อาหาร (${ITEMS[pf].name})` : `🍽️ ให้อาหาร (ต้องมี ${P.foods.slice(0, 4).map((k) => ITEMS[k].name).join('/')})`, dis: !pf || fl > FEED_MAX - FEED_MS, run: () => this.op(s, { o: 'feed', item: pf }) });
      acts.push({ label: water ? `💧 ให้น้ำ${water === 'can' ? ' (บัวรดน้ำ)' : ` (${ITEMS[water].name})`}` : '💧 ให้น้ำ (ต้องมีน้ำ 1 ขวด หรือถือบัวรดน้ำ)', dis: !water || wl > WATER_MAX - WATER_MS, run: () => this.op(s, { o: 'drink' }) });
      acts.push(P.egg ? { label: `🐣 ฟักไข่ (ใช้${ITEMS[P.egg].name} · ${herd.length}/${P.max})`, dis: !g.hasItem(P.egg) || herd.length >= P.max, run: () => this.op(s, { o: 'breed' }) } : { label: `🍼 ผสมพันธุ์ (ต้องมีตัวโต 2 ตัว · ${herd.length}/${P.max})`, dis: herd.length >= P.max, run: () => this.op(s, { o: 'breed' }) });
      acts.push({ label: `🔪 ชำแหละ 1 ตัว (ได้${ITEMS[P.meat[0]].name} ×${P.meat[1]})`, dis: !herd.some((a) => ageStage(P, a, now) !== 'baby'), run: () => { if (confirm(`ชำแหละ${P.name} 1 ตัว?`)) this.op(s, { o: 'butcher' }); } });
      return { info, acts };
    }
    if (s.type === 'hive') {
      const fl = flowersNear(g.world.structures, s, now), n = hiveHoney(s, now);
      info = s.bees ? `🐝 มีผึ้งทำรังแล้ว · ดอกไม้บานรอบ ๆ: <b>${fl}</b> · 🍯 น้ำผึ้ง: <b>${n}</b>/${HONEY_CAP}<br><small>ดอกไม้ยิ่งมาก ผึ้งยิ่งทำน้ำผึ้งเร็ว (ปลูกในรัศมี 12 หน่วย) · เก็บได้ทั้งน้ำผึ้งและไขผึ้ง เอาไปคราฟท์ยา อาหาร เทียน</small>`
        : `ยังไม่มีผึ้ง · ดอกไม้บานรอบ ๆ: <b>${fl}</b><br><small>ปลูกทานตะวัน/ดาวเรืองในแปลง หรือดอกไม้ในกระถาง ให้บานเกินครึ่งใกล้กล่องนี้ ผึ้งจะบินมาทำรัง</small>`;
      acts.push({ label: s.bees ? '🔄 ตรวจรังผึ้ง' : '🐝 เรียกผึ้ง (ต้องมีดอกไม้บานใกล้ ๆ)', run: () => this.op(s, { o: 'bees' }) });
      acts.push({ label: `🍯 เก็บน้ำผึ้ง (${n})`, dis: !n, run: () => this.op(s, { o: 'collect' }) });
      return { info, acts };
    }
    if (s.type === 'basecore') {
      const role = roleIn(s, g.id);
      if (!s.ok) {
        const c = baseCheck(g.world.structures, s);
        info = `หลักบ้านยังไม่ได้ประกาศเป็นฐาน<br>ต้องมี (รอบหลักบ้าน 30 หน่วย): ${Object.values(BASE_NEED).map(([n, name]) => `${name} ${n}`).join(' · ')}<br>${c.ok ? '<b class="have">✅ ครบแล้ว ประกาศฐานได้เลย</b>' : `<b class="miss">ยังขาด: ${c.missing.join(' · ')}</b>`}<br><small>หลังประกาศฐาน: มาร์คบนแผนที่ · คอกสัตว์/แปลงผัก/กระถาง/กล่องผึ้ง/บ่อปลา สร้างได้เฉพาะในรั้ว · รั้วและบ้านกันผู้ติดเชื้อ 60 วัน</small>`;
        if (s.owner === g.id) acts.push({ label: '🏡 ประกาศเป็นฐาน', dis: !c.ok, run: () => { const name = prompt('ตั้งชื่อฐาน', `บ้านของ${g.profile.name}`); if (name !== null) this.op(s, { o: 'declare', name }); } });
        return { info, acts };
      }
      const L = HOUSE_LV[s.lv || 1], pl = protectLeft(s, now), boss = role === 'owner' || role === 'deputy';
      info = `🏡 <b>${s.name}</b> · ระดับบ้าน <b>${s.lv || 1}</b>/5 · หน้าที่ของคุณ: ${role ? ROLES[role] : 'ไม่ใช่สมาชิก'}
        <br>🛡️ กันผู้ติดเชื้อ: ${pl ? `<b class="have">เหลือ ${(pl / GAME_DAY_MS).toFixed(1)} วันในเกม</b>` : '<b class="miss">หมดแล้ว — ซ่อมแซมเพื่อเริ่มนับใหม่</b>'}
        ${role ? `<br>🏦 คลังส่วนรวม: <b>${s.bank || 0}</b>/${L.bank} · 🔐 คลังส่วนตัวของคุณ: <b>${s.pv?.[g.id] || 0}</b>/${L.pv} · 🪙 ในกระเป๋า ${g.inv.jicoin || 0}` : ''}
        <br><small>เงินในคลังไม่หายเมื่อตาย (เงินที่พกติดตัว: ตายครั้งที่ 4–10 ของวันหาย 10% · ครั้งที่ 11+ หาย 20%)</small>`;
      if (!role) return { info, acts };
      const ask = (t, max) => { const v = Math.floor(+prompt(t, String(max))); return v > 0 ? Math.min(v, max) : 0; };
      acts.push({ label: '🏦 ฝากเข้าคลังส่วนรวม', dis: !g.inv.jicoin, run: () => { const a = ask('ฝากเงินจิเข้าคลังส่วนรวมกี่เหรียญ?', g.inv.jicoin || 0); if (a) this.op(s, { o: 'bank', amt: a }); } });
      if (boss) acts.push({ label: '🏦 ถอนจากคลังส่วนรวม', dis: !s.bank, run: () => { const a = ask('ถอนกี่เหรียญ?', s.bank || 0); if (a) this.op(s, { o: 'bank', amt: -a }); } });
      acts.push({ label: '🔐 ฝากเข้าคลังส่วนตัว', dis: !g.inv.jicoin, run: () => { const a = ask('ฝากเงินจิเข้าคลังส่วนตัวกี่เหรียญ?', g.inv.jicoin || 0); if (a) this.op(s, { o: 'bank', amt: a, priv: 1 }); } });
      acts.push({ label: '🔐 ถอนจากคลังส่วนตัว', dis: !s.pv?.[g.id], run: () => { const a = ask('ถอนกี่เหรียญ?', s.pv?.[g.id] || 0); if (a) this.op(s, { o: 'bank', amt: -a, priv: 1 }); } });
      if (boss) { const rc = REPAIR_BASE(s.lv || 1); acts.push({ label: `🔧 ซ่อมแซมรั้วและบ้าน (${Object.entries(rc).map(([k, q]) => `${ITEMS[k].icon}${q}`).join(' ')}) — นับ 60 วันใหม่`, run: () => this.op(s, { o: 'repair' }) }); }
      if (role !== 'owner') acts.push({ label: '🚪 ออกจากบ้านนี้', run: () => { if (confirm('ออกจากบ้านนี้?')) this.op(s, { o: 'leave' }); } });
      return { info, acts };
    }
    if (s.type === 'stall') {
      const mine = !s.owner || s.owner === g.id;
      info = `${mine ? 'แผงของคุณ' : 'แผงของผู้เล่นอื่น'} · สินค้า ${(s.goods || []).length}/${STALL_MAX} รายการ${mine ? ` · 🪙 เงินในแผง: <b>${s.cash || 0}</b>` : ''}<br><small>${mine ? 'เลือกของในกระเป๋าด้านล่างเพื่อวางขาย (ตั้งราคาเป็นเงินจิ) · ผู้เล่นอื่นซื้อได้แม้คุณไม่อยู่' : `คุณมี 🪙 ${g.inv.jicoin || 0} เงินจิ`}</small>`;
      (s.goods || []).forEach((r, i) => acts.push(mine ? { label: `↩️ เก็บคืน ${ITEMS[r.k].icon} ${ITEMS[r.k].name} ×${r.q} (🪙${r.p})`, run: () => this.op(s, { o: 'unlist', i }) } : { label: `🛒 ซื้อ ${ITEMS[r.k].icon} ${ITEMS[r.k].name} (เหลือ ${r.q}) — 🪙 ${r.p}`, dis: (g.inv.jicoin || 0) < r.p, run: () => this.op(s, { o: 'buy', i, item: r.k, price: r.p }) }));
      if (mine) acts.push({ label: `🪙 เก็บเงินจิจากแผง (${s.cash || 0})`, dis: !s.cash, run: () => this.op(s, { o: 'cashout' }) });
      return { info, acts };
    }
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
      info += '<br><small>🐟 ปลาไม่ต้องให้น้ำ — แค่ให้อาหาร</small>';
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
    ridePose(p.mesh, dt, v.speed, s.vt);
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
    // ผึ้ง: ตรวจกล่องผึ้งของเราเป็นระยะ (ผึ้งมาทำรังเมื่อมีดอกไม้บาน)
    if ((this.beeT = (this.beeT || 0) - dt) <= 0) {
      this.beeT = 20;
      for (const s of g.world.structures) if (s.type === 'hive' && s.owner === g.id && Math.hypot(s.x - P.x, s.z - P.z) < 80) { const fl = flowersNear(g.world.structures, s, g.now()); if ((!s.bees && fl) || (s.bees && fl !== (s.fl || 0))) this.op(s, { o: 'bees', silent: true }); }
    }
    // ฝนรดน้ำแปลงผักให้
    this.rainT -= dt;
    if (this.rainT <= 0) {
      this.rainT = 8;
      if (g.weather.rain) for (const s of g.world.structures) {
        if (Math.hypot(s.x - P.x, s.z - P.z) >= 80) continue;
        if (isGrow(s.type) && s.crop && !s.wt) this.op(s, { o: 'water', silent: true });
        else if (PENS[s.type] && s.owner === g.id && s.herd && waterLeft(s, g.now()) < WATER_MS) this.op(s, { o: 'drink', silent: true }); // ฝนเติมรางน้ำให้
      }
    }
  }
  vehicleFor(vt) { return VEH[vt]; }
}
