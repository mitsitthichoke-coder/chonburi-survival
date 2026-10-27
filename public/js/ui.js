import { JOBS, KILL_PERKS, hasPerk, petCap, ITEMS, RECIPES, SKILLS, skillLevel, xpForLevel, PET_TYPES, PET_TRAITS, PET_SLOTS, NPCS, WEAR_SLOTS, wearStats } from './data.js';
import { petStats, rarityOf, equipPet, unequipPet, healPet } from './pets.js';
import { PIECES } from './building-core.js';
import { ACTIONS, REL_LEVELS, relLevel, canDo } from './social-core.js';
import { WORLD, zToLat, xToLon } from './terrain.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// หมวดหมู่ไอเท็ม (ใช้กรองกระเป๋าและสูตรประดิษฐ์)
const CATS = [['all', '📦 ทั้งหมด'], ['weapon', '⚔️ อาวุธ/โล่'], ['wear', '👕 เสื้อผ้า'], ['food', '🍖 อาหาร/น้ำ'], ['med', '💊 ยา'], ['mat', '🪵 วัตถุดิบ'], ['place', '🏠 วาง/ยานพาหนะ'], ['fun', '🎸 ดนตรี'], ['pet', '🐾 สัตว์เลี้ยง'], ['quest', '📜 ภารกิจ']];
const catOf = (k) => { const it = ITEMS[k]; return it.tool || it.wear?.slot === 'off' ? 'weapon' : it.wear ? 'wear' : it.food ? 'food' : it.med ? 'med' : it.instrument ? 'fun' : it.place ? 'place' : it.petGear ? 'pet' : it.quest ? 'quest' : 'mat'; };
const pct = (v) => Math.round(v * 100);
// สเตตัสของไอเท็ม (อาวุธ เสื้อผ้า อาหาร ยา อุปกรณ์สัตว์)
export function statText(k) {
  const it = ITEMS[k]; if (!it) return '';
  const t = it.tool, w = it.wear, f = it.food, m = it.med, p = it.petGear;
  return [
    t && t.dmg && `⚔️${t.dmg}`, t && t.range && `📏${t.range}`, t && t.gather && `🪓×${t.gather}`,
    w && w.def && `🛡️-${pct(w.def)}%ดาเมจ`, w && w.block && `🔰กัน${pct(w.block)}%`, w && w.bite && `🦠-${pct(w.bite)}%`, w && w.spd && `${w.spd > 0 ? '💨+' : '🐢'}${pct(w.spd)}%`,
    w && w.stam && `⚡+${pct(w.stam)}%`, w && w.gather && `✊+${w.gather}`, w && w.carry && `🎒+${w.carry}ช่อง`,
    f && f.hunger && `🍗+${f.hunger}`, f && f.thirst && `💧+${f.thirst}`, f && f.hp && `❤️+${f.hp}`, f && f.infection && `🦠${f.infection}`, f && f.sick && `⚠️ท้องเสีย ${pct(f.sick)}%`, f && f.stress && `😌${f.stress} เครียด`, f && f.stamina && `⚡+${f.stamina}`, it.instrument && '🎶 ลดความเครียดรอบตัว', m && m.immune && `🛡️ภูมิคุ้มกัน ${m.immune / 60} นาที`,
    m && m.hp && `❤️+${m.hp}`, m && m.infection && `🦠${m.infection}`, m && m.stopBleed && '🩸ห้ามเลือด', m && m.fracture && '🦴รักษากระดูก', m && m.cureSick && '🤢หายป่วย',
    p && p.atk && `⚔️+${p.atk}`, p && p.def && `🛡️-${pct(p.def)}%`, p && p.hp && `❤️+${p.hp}`, p && p.carry && '🎒ขนของ', p && p.luck && '🍀โชค', p && p.alarm && '🔔เตือนภัย',
  ].filter(Boolean).join(' ');
}
// เครื่องหมายกล่องบนแผนที่
function boxMark(c, a, b, k, s = 1) {
  c.save(); c.translate(a, b); c.strokeStyle = '#000'; c.lineWidth = 1.5;
  if (k === 'rare') { c.rotate(Math.PI / 4); c.fillStyle = '#c77dff'; c.fillRect(-5 * s, -5 * s, 10 * s, 10 * s); c.strokeRect(-5 * s, -5 * s, 10 * s, 10 * s); }
  else { c.fillStyle = '#355070'; c.fillRect(-4 * s, -4 * s, 8 * s, 8 * s); c.strokeStyle = k === 'qopen' ? '#52b788' : '#e63946'; c.lineWidth = 2; c.strokeRect(-4 * s, -4 * s, 8 * s, 8 * s); }
  c.restore();
}
const catBar = (cur, counts, attr) => `<div class="rfilter cats">${CATS.filter(([k]) => k === 'all' || counts[k]).map(([k, n]) => `<button data-${attr}="${k}" class="${cur === k ? 'on' : ''}">${n} ${counts[k] || 0}</button>`).join('')}</div>`;

export class UI {
  constructor(game) {
    this.g = game; this.tab = 'inv'; this.open = null; this.person = null; this.hudT = 0;
    $('#game-ui').style.display = 'block';
    $('#panel').addEventListener('click', (ev) => this.onPanelClick(ev));
    this.initDrag();
    $('#panel').addEventListener('contextmenu', (ev) => {
      const st = ev.target.closest('[data-dep],[data-wd]');
      if (st && this.struct) { ev.preventDefault(); const s0 = this.g.world.structures.find((x) => x.id === this.struct.id); if (st.dataset.dep) this.g.home.deposit(this.struct, st.dataset.dep, this.g.inv[st.dataset.dep] || 0); else this.g.home.withdraw(this.struct, st.dataset.wd, s0?.items?.[st.dataset.wd] || 0); return this.refreshPanels(); }
      const el = ev.target.closest('[data-item]'); if (!el) return;
      ev.preventDefault(); this.g.pinHotbar(el.dataset.item); this.refreshPanels();
    });
    $('#chat-input').addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { const v = ev.target.value.trim(); if (v) this.g.sendChat(v); ev.target.value = ''; ev.target.blur(); this.chatting = false; }
      if (ev.key === 'Escape') { ev.target.blur(); this.chatting = false; }
    });
    $('#respawn-btn').onclick = () => this.g.respawn();
    const mute = $('#mute-btn');
    const syncMute = () => { mute.textContent = this.g.sfx.muted ? '🔇' : '🔊'; mute.setAttribute('aria-label', this.g.sfx.muted ? 'เปิดเสียง' : 'ปิดเสียง'); };
    mute.onclick = () => { this.g.sfx.unlock(); this.g.sfx.setMuted(!this.g.sfx.muted); syncMute(); };
    syncMute();
    $('#chat-input').addEventListener('blur', (e) => e.target.classList.remove('show'));
    this.mini = $('#minimap').getContext('2d');
  }

  // ---------- การแจ้งเตือน ----------
  toast(text, type = '') {
    if (type === 'love') this.g.sfx?.play(text.includes('👶') || text.includes('🧸') ? 'baby' : 'love');
    const d = document.createElement('div'); d.className = 'toast ' + type; d.textContent = text;
    $('#toasts').prepend(d); setTimeout(() => d.classList.add('fade'), 4500); setTimeout(() => d.remove(), 5200);
    while ($('#toasts').children.length > 6) $('#toasts').lastChild.remove();
  }
  chat(name, text, sys) {
    const d = document.createElement('div'); d.innerHTML = sys ? `<i>${esc(text)}</i>` : `<b>${esc(name)}:</b> ${esc(text)}`;
    $('#chat-log').append(d); $('#chat-log').scrollTop = 1e9;
    while ($('#chat-log').children.length > 60) $('#chat-log').firstChild.remove();
  }
  confirm(text, cb) {
    const d = $('#confirm'); d.style.display = 'flex'; $('#confirm-text').textContent = text;
    document.exitPointerLock?.();
    const done = (v) => { d.style.display = 'none'; cb(v); };
    $('#confirm-yes').onclick = () => done(true); $('#confirm-no').onclick = () => done(false);
  }
  flashHurt() { const v = $('#vignette'); v.style.opacity = 0.7; setTimeout(() => (v.style.opacity = 0), 180); }
  setPrompt(t) { const p = $('#prompt'); if (p._t !== t) { p._t = t; p.innerHTML = t || ''; p.style.display = t ? 'block' : 'none'; } }

  // ---------- HUD ----------
  update(dt) {
    this.hudT -= dt; if (this.hudT > 0) return; this.hudT = 0.15;
    const g = this.g, s = g.stats;
    const bar = (id, v, max = 100) => { const el = $(id); el.style.width = Math.max(0, (v / max) * 100) + '%'; };
    bar('#b-hp', s.hp, g.maxHp()); bar('#b-food', s.hunger); bar('#b-water', s.thirst); bar('#b-stam', s.stamina, g.maxStamina()); bar('#b-inf', s.infection); bar('#b-stress', s.stress || 0);
    $('#v-hp').textContent = Math.ceil(s.hp); $('#v-food').textContent = Math.ceil(s.hunger); $('#v-water').textContent = Math.ceil(s.thirst); $('#v-inf').textContent = Math.floor(s.infection) + '%'; $('#v-stress').textContent = Math.floor(s.stress || 0);
    const chips = [];
    if (s.bleeding) chips.push('<span class="chip red">🩸 เลือดออก</span>');
    if (s.fracture) chips.push('<span class="chip red">🦴 กระดูกหัก</span>');
    if (g.stance) chips.push(`<span class="chip">${g.stance === 1 ? '🧎 ย่อตัว' : '🐛 คลาน'} · ซ่อนตัว ${Math.round((1 - g.stealthMul()) * 100)}%</span>`);
    if ((s.stress || 0) >= 60) chips.push(`<span class="chip orange">${s.stress >= 85 ? '😱 เครียดหนัก' : '😰 เครียด'}</span>`);
    if (g.immuneT > 0) chips.push(`<span class="chip green">💉 ภูมิคุ้มกัน ${Math.ceil(g.immuneT)} วิ</span>`);
    if (g.wellFed > 0) chips.push(`<span class="chip">😋 อิ่มเอม</span>`);
    if (s.infection >= 1) chips.push(`<span class="chip green">🦠 ติดเชื้อ ${s.infection > 60 ? 'รุนแรง' : ''}</span>`);
    if (s.sick > 0) chips.push('<span class="chip yellow">🤢 อาหารเป็นพิษ</span>');
    if (g.social.preg[g.id]) chips.push(`<span class="chip pink">🤰 ตั้งครรภ์ ${Math.floor(Math.min(1, (Date.now() - g.social.preg[g.id].start) / g.const.PREG_MS) * 100)}%</span>`);
    if (g.social.lovedNearby()) chips.push('<span class="chip pink">💞 มีกำลังใจ</span>');
    if (g.nearFire) chips.push('<span class="chip orange">🔥 อบอุ่น</span>');
    if (g.weather.rain) chips.push('<span class="chip blue">🌧️ ฝนตก</span>');
    $('#status').innerHTML = chips.join('');
    const qh = g.quest.trackerHTML(), qel = $('#quest');
    if (qel._h !== qh) { qel._h = qh; qel.innerHTML = qh; qel.hidden = !qh; }
    const tod = g.timeOfDay(), hh = Math.floor(tod * 24), mm = Math.floor((tod * 24 - hh) * 60);
    $('#clock').innerHTML = `วันที่ <b>${g.dayNum()}</b> ของการล่มสลาย · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${g.isNight() ? '🌙' : '☀️'}<br><small>เลเวล ${g.charLevel()} · ${esc(g.areaName())} · 🎒 <span class="${g.overloaded() ? 'miss' : ''}">${g.usedSlots()}/${g.maxSlots()}</span> · ${g.net.online ? '🟢 ออนไลน์ ' + (g.ents.remotes.size + 1) + ' คน' : '⚪ ออฟไลน์'}</small>`;
    // hotbar
    $('#hotbar').innerHTML = g.hotbar.map((k, i) => {
      const it = k && ITEMS[k], q = k ? g.inv[k] || 0 : 0;
      return `<div class="slot ${k && g.equipped === k ? 'eq' : ''} ${k && !q ? 'empty' : ''}" data-slot="${i}"><span class="n">${i + 1}</span>${it ? `${it.icon}<span class="q">${q}</span>` : ''}</div>`;
    }).join('');
    this.drawMinimap();
    if (this.open === 'panel' && this.tab === 'struct') { this.structT = (this.structT || 0) + 0.15; if (this.structT > 1) { this.structT = 0; this.refreshPanels(); } }
    if (this.open === 'panel' && this.tab === 'map') this.drawBigMap();
  }

  worldToMap(x, z, W, H) { return [((x - WORLD.minX) / (WORLD.maxX - WORLD.minX)) * W, ((z - WORLD.minZ) / (WORLD.maxZ - WORLD.minZ)) * H]; }

  drawMinimap() {
    const g = this.g, c = this.mini, S = 180, P = g.player.pos, src = g.world.mapCanvas;
    const scale = 2.2; // px ต่อ px ของภาพแผนที่
    const [mx, my] = this.worldToMap(P.x, P.z, src.width, src.height);
    c.save(); c.clearRect(0, 0, S, S);
    c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 2, 0, 7); c.clip();
    c.fillStyle = '#1d4e89'; c.fillRect(0, 0, S, S);
    c.imageSmoothingEnabled = false;
    c.drawImage(src, mx - S / 2 / scale, my - S / 2 / scale, S / scale, S / scale, 0, 0, S, S);
    const toM = (x, z) => { const [a, b] = this.worldToMap(x, z, src.width, src.height); return [S / 2 + (a - mx) * scale, S / 2 + (b - my) * scale]; };
    const dot = (x, z, col, r = 3) => { const [a, b] = toM(x, z); c.fillStyle = col; c.beginPath(); c.arc(a, b, r, 0, 7); c.fill(); };
    const hasBird = g.pets.some((p) => p.type === 'bird');
    const sniff = hasBird || g.pets.some((p) => p.traits?.includes('sniffer'));
    for (const e of g.ents.list) {
      if (e.dead) continue;
      if (e.kind === 'npc') dot(e.pos.x, e.pos.z, '#ffd166');
      else if (e.kind === 'pet') dot(e.pos.x, e.pos.z, '#ffadad', 2);
      else if (e.kind === 'zombie' && hasBird) dot(e.pos.x, e.pos.z, '#e63946', 2);
    }
    if (sniff) for (const l of g.world.nearLoot(P.x, P.z, 60)) dot(l.x, l.z, '#c08552', 2);
    for (const s of g.world.structures) dot(s.x, s.z, s.type === 'shelter' ? '#f4a261' : '#ff6b35', 2.5);
    const fr = new Set((g.friends || []).map((f) => f.id));
    for (const r of g.ents.remotes.values()) { dot(r.pos.x, r.pos.z, fr.has(r.id) ? '#06d6a0' : '#4cc9f0', 3.5); if (fr.has(r.id)) { const [a, b] = toM(r.pos.x, r.pos.z); c.strokeStyle = '#06d6a0'; c.lineWidth = 1.5; c.beginPath(); c.arc(a, b, 6, 0, 7); c.stroke(); } }
    for (const [x, z, k] of g.boxUI.markers()) {
      let [a, b] = toM(x, z); const dx = a - S / 2, dy = b - S / 2, L = Math.hypot(dx, dy), R = S / 2 - 10;
      if (k !== 'rare' && L > R) continue;
      if (L > R) { a = S / 2 + dx / L * R; b = S / 2 + dy / L * R; }
      boxMark(c, a, b, k);
    }
    const qt = g.quest.target();
    if (qt) {
      let [a, b] = toM(qt.x, qt.z); const dx = a - S / 2, dy = b - S / 2, L = Math.hypot(dx, dy), R = S / 2 - 10;
      if (L > R) { a = S / 2 + dx / L * R; b = S / 2 + dy / L * R; }
      c.fillStyle = '#ffd60a'; c.strokeStyle = '#000'; c.lineWidth = 1.5; star(c, a, b, 7); c.fill(); c.stroke();
    }
    c.restore();
    c.save(); c.translate(S / 2, S / 2); c.rotate(-g.player.ry + Math.PI);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(-5, 5); c.fill(); c.restore();
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 2, 0, 7); c.stroke();
    c.fillStyle = '#fff'; c.font = 'bold 12px sans-serif'; c.fillText('N', S / 2 - 4, 14);
  }

  drawBigMap() {
    const cv = $('#bigmap'); if (!cv) return;
    const g = this.g, c = cv.getContext('2d'), W = cv.width, H = cv.height;
    c.drawImage(g.world.mapCanvas, 0, 0, W, H);
    c.font = '11px Sarabun, sans-serif'; c.textAlign = 'center';
    for (const l of g.world.labels) {
      const [x, y] = this.worldToMap(l.x, l.z, W, H);
      c.fillStyle = { town: '#fff', island: '#caf0f8', lake: '#bde0fe', mountain: '#d8f3dc' }[l.kind];
      c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 3; c.strokeText(l.name, x, y - 4); c.fillText(l.name, x, y - 4);
      c.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    const dot = (x, z, col, r) => { const [a, b] = this.worldToMap(x, z, W, H); c.fillStyle = col; c.beginPath(); c.arc(a, b, r, 0, 7); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke(); };
    for (const s of g.world.structures) dot(s.x, s.z, '#f4a261', 3);
    for (const r of g.ents.remotes.values()) dot(r.pos.x, r.pos.z, '#4cc9f0', 4);
    dot(g.player.pos.x, g.player.pos.z, '#ff006e', 5);
    const qt = g.quest.target();
    for (const [x, z, k] of g.boxUI.markers()) { const [a, b] = this.worldToMap(x, z, W, H); boxMark(c, a, b, k, 1.2); }
    for (const f of g.friends || []) if (f.online && f.x !== null) { const [a, b] = this.worldToMap(f.x, f.z, W, H); c.fillStyle = '#06d6a0'; c.beginPath(); c.arc(a, b, 5, 0, 7); c.fill(); c.font = 'bold 12px sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeText(f.name, a + 7, b + 4); c.fillText(f.name, a + 7, b + 4); }
    if (qt) { const [a, b] = this.worldToMap(qt.x, qt.z, W, H); c.fillStyle = '#ffd60a'; c.strokeStyle = '#000'; c.lineWidth = 1.5; star(c, a, b, 8); c.fill(); c.stroke(); }
  }

  // ---------- แผงเมนู ----------
  togglePanel(tab) {
    this.g.sfx?.play('click');
    if (this.open === 'panel' && this.tab === tab) return this.closeAll();
    this.closeAll(); this.tab = tab; this.open = 'panel';
    $('#panel').style.display = 'block'; document.exitPointerLock?.();
    this.refreshPanels();
  }
  closeAll() { this.open = null; this.person = null; this.struct = null; $('#panel').style.display = 'none'; }
  openStructure(s) { this.closeAll(); this.struct = s; this.tab = 'struct'; this.open = 'panel'; $('#panel').style.display = 'block'; document.exitPointerLock?.(); this.refreshPanels(); }

  buildHTML() {
    const g = this.g, lvl = skillLevel(g.skills.building), hammer = g.hasItem('hammer');
    const cats = {};
    for (const [k, p] of Object.entries(PIECES)) (cats[p.cat] ||= []).push([k, p]);
    const card = ([k, p]) => {
      const miss = Object.entries(p.cost).filter(([i, q]) => (g.inv[i] || 0) < q), lock = lvl < p.lvl;
      return `<button class="piece ${miss.length || lock || !hammer ? 'dis' : ''}" data-build="${k}"><span class="ic">${p.icon}</span><b>${esc(p.name)}</b><small>${Object.entries(p.cost).map(([i, q]) => `<span class="${(g.inv[i] || 0) >= q ? 'have' : 'miss'}">${ITEMS[i].icon}${g.inv[i] || 0}/${q}</span>`).join(' ')}${lock ? ` · 🔒 ก่อสร้าง Lv${p.lvl}` : ''}</small></button>`;
    };
    return `<p class="hint">${hammer ? '' : '<b class="miss">ต้องมี 🔨 ค้อนช่างไม้ก่อน (ประดิษฐ์ในแท็บกระเป๋า: ไม้ 3 + หิน 2)</b><br>'}สร้างบ้านทีละชิ้นบนกริด: วาง <b>ฐานราก</b> → <b>ผนัง/ประตู/หน้าต่าง</b> รอบขอบ → <b>หลังคา</b> (ขึ้นไปยืนบนหลังคาแล้ววางผนังต่อเป็นชั้นสองได้) · วาง <b>เตียง</b> เพื่อตั้งเป็นจุดเกิด
      <br>${g.touch ? '✅ วาง · ↻ หมุน · 🗑 รื้อ · ✖ ออก' : 'คลิกซ้าย = วาง · Q = หมุน · X = โหมดรื้อ · L = ล็อกประตู/หีบ · Esc = ออก'} · ทักษะก่อสร้าง Lv${lvl}</p>
      ${Object.entries(cats).map(([c, list]) => `<h4>${esc(c)}</h4><div class="pieces">${list.map(card).join('')}</div>`).join('')}
      <div class="acts"><button data-demolish="1" ${hammer ? '' : 'class="dis"'}>🗑️ โหมดรื้อ (ได้วัสดุคืนครึ่งหนึ่ง)</button></div>
      <p class="hint">🚲 จักรยาน 🏍️ มอเตอร์ไซค์ 🛶 แพ และ 🎣 เบ็ดตกปลา ประดิษฐ์ได้ในแท็บกระเป๋า · ทุกอย่างที่สร้างจะเห็นร่วมกันเมื่อเล่นออนไลน์</p>`;
  }
  structHTML() {
    const g = this.g, s = g.world.structures.find((x) => x.id === this.struct.id) || this.struct, P = PIECES[s.type];
    const { info, acts } = g.home.panel(s); this.structActs = acts;
    let html = `<h3>${P.icon} ${esc(P.name)}</h3><p>${info}</p><div class="acts">${acts.map((a, i) => `<button data-sact="${i}" ${a.dis ? 'class="dis"' : ''}>${esc(a.label)}</button>`).join('')}</div>`;
    if (s.type === 'storage') {
      const inside = Object.entries(s.items || {}).filter(([, q]) => q > 0);
      html += `<div class="cols"><div><h4>🧰 ในหีบ</h4><div class="inv">${inside.map(([k, q]) => `<div class="item" data-wd="${k}" title="คลิก = หยิบ 1 · คลิกขวา = หยิบทั้งหมด"><span class="ic">${ITEMS[k].icon}</span><span>${ITEMS[k].name}</span><b>×${q}</b></div>`).join('') || '<p class="hint">ว่าง</p>'}</div></div>
        <div><h4>🎒 กระเป๋าของคุณ</h4><div class="inv">${Object.entries(g.inv).filter(([k, q]) => q > 0 && !ITEMS[k].quest).map(([k, q]) => `<div class="item" data-dep="${k}" title="คลิก = ฝาก 1 · คลิกขวา = ฝากทั้งหมด"><span class="ic">${ITEMS[k].icon}</span><span>${ITEMS[k].name}</span><b>×${q}</b></div>`).join('')}</div></div></div>`;
    }
    return html;
  }

  refreshPanels() {
    if (this.open !== 'panel') return;
    const tabs = [['inv', '🎒 กระเป๋า & ประดิษฐ์ [Tab]'], ['build', '🔨 สร้างบ้าน [B]'], ['equip', '🛡️ อุปกรณ์ [I]'], ['char', '🧍 ตัวละคร [K]'], ['rel', '💞 ความสัมพันธ์ [R]'], ['pets', '🐾 สัตว์เลี้ยง [P]'], ['map', '🗺️ แผนที่ [M]']];
    let html = `<div class="tabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${this.tab === k ? 'on' : ''}">${n}</button>`).join('')}<button data-close="1" class="x">✕</button></div><div class="body">`;
    if (this.person) html += this.personHTML();
    else if (this.tab === 'inv') html += this.invHTML();
    else if (this.tab === 'char') html += this.charHTML();
    else if (this.tab === 'equip') html += this.equipHTML();
    else if (this.tab === 'rel') html += this.relHTML();
    else if (this.tab === 'pets') html += this.petsHTML();
    else if (this.tab === 'build') html += this.buildHTML();
    else if (this.tab === 'struct' && this.struct) html += this.structHTML();
    else if (this.tab === 'map') html += `<canvas id="bigmap" width="430" height="700"></canvas><p class="hint">🟣 คุณ · 🔵 เพื่อน · 🟠 ที่พัก/กองไฟ · 🟢 เพื่อน · ⭐ เป้าหมายภารกิจ · 🟦 กล่องภารกิจ (🔒 แดง = ยังล็อก, เขียว = เปิดได้) · 💜 กล่องหายาก — แผนที่สร้างจากพิกัดจริงของจังหวัดชลบุรี</p>`;
    $('#panel').innerHTML = html + '</div>';
    if (this.tab === 'map') this.drawBigMap();
  }

  invHTML() {
    const g = this.g;
    const all0 = Object.entries(g.inv).filter(([, q]) => q > 0);
    const icount = { all: all0.length }; for (const [k] of all0) icount[catOf(k)] = (icount[catOf(k)] || 0) + 1;
    if (this.icat && this.icat !== 'all' && !icount[this.icat]) this.icat = 'all';
    const ic = this.icat || 'all', ORD = CATS.map(([c]) => c);
    const items = all0.filter(([k]) => ic === 'all' || catOf(k) === ic).sort((a, b) => ORD.indexOf(catOf(a[0])) - ORD.indexOf(catOf(b[0])));
    const inv = items.length ? items.map(([k, q]) => {
      const it = ITEMS[k];
      const tag = it.tool ? (g.equipped === k ? 'ถืออยู่' : 'ถือ') : it.instrument ? 'เล่น' : it.food ? 'กิน' : it.med ? 'ใช้' : it.place ? 'วาง' : it.wear ? 'สวม' : it.petGear ? 'ให้สัตว์' : '';
      return `<div class="item" data-item="${k}" title="คลิก = ${tag || 'ดู'} · คลิกขวา = ใส่ช่องลัด"><span class="ic">${it.icon}</span><span>${it.name}${statText(k) ? `<small class="st">${statText(k)}</small>` : ''}</span><b>×${q}</b>${tag ? `<em>${tag}</em>` : ''}${g.hotbar.includes(k) ? '<i>📌</i>' : ''}</div>`;
    }).join('') : '<p class="hint">กระเป๋าว่างเปล่า — ลองเก็บไม้ หิน หญ้า หรือค้นกล่องเสบียงในเมือง</p>';
    const fire = g.nearFire;
    const myJob = g.profile.job;
    const all = RECIPES.map((r, i) => ({ r, i })).filter(({ r }) => !r.job || r.job === myJob).map(({ r, i }) => {
      const lvl = skillLevel(g.skills[r.skill]);
      const missing = Object.entries(r.need).filter(([k, q]) => (g.inv[k] || 0) < q);
      const lock = lvl < r.lvl, noSt = r.station === 'fire' && !fire;
      return { r, i, missing, lock, noSt, ok: !lock && !missing.length && !noSt };
    });
    const rc = this.rcat || 'all', inCat = all.filter((x) => rc === 'all' || catOf(x.r.out) === rc);
    const rcount = { all: all.length }; for (const x of all) rcount[catOf(x.r.out)] = (rcount[catOf(x.r.out)] || 0) + 1;
    const nReady = inCat.filter((x) => x.ok).length, f = this.rfilter || 'all';
    const shown = inCat.filter((x) => f === 'all' || (f === 'ready') === x.ok).sort((a, b) => b.ok - a.ok);
    const fbar = `<div class="rfilter">${[['all', `📋 ทั้งหมด ${inCat.length}`], ['ready', `✅ พร้อมคราฟท์ ${nReady}`], ['miss', `⏳ ยังไม่ครบ ${inCat.length - nReady}`]].map(([k, n]) => `<button data-rfilter="${k}" class="${f === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    const rec = (shown.length ? '' : `<p class="hint">${f === 'ready' ? 'ยังไม่มีสูตรที่วัตถุดิบครบ — ลองเก็บของเพิ่ม' : 'คราฟท์ได้ครบทุกสูตรแล้ว!'}</p>`) + shown.map(({ r, i, missing, lock, noSt, ok }) => {
      const need = Object.entries(r.need).map(([k, q]) => `<span class="${(g.inv[k] || 0) >= q ? 'have' : 'miss'}">${ITEMS[k].icon}${ITEMS[k].name} ${g.inv[k] || 0}/${q}</span>`).join(' ');
      return `<div class="recipe ${ok ? 'ready' : 'dis'}"><div><b>${ok ? '✅' : '⏳'} ${ITEMS[r.out].icon} ${r.label || ITEMS[r.out].name}</b>${r.job ? ` <span class="chip jobchip">${JOBS[r.job].icon} ขั้นสูง</span>` : ''} <small>${SKILLS[r.skill]} Lv${r.lvl}${r.station ? ' · 🔥 ใกล้กองไฟ' : ''}</small>${statText(r.out) ? `<small class="st">${statText(r.out)}</small>` : ''}<div class="need">${need}</div>${lock ? `<small class="miss">🔒 ต้องการ ${SKILLS[r.skill]} Lv${r.lvl}</small>` : noSt ? '<small class="miss">ต้องอยู่ใกล้กองไฟ</small>' : ''}</div><button data-craft="${i}" ${ok ? '' : 'disabled'}>ประดิษฐ์</button></div>`;
    }).join('');
    return `<div class="cols"><div><h3>กระเป๋า <small class="${g.overloaded() ? 'miss' : ''}">${g.usedSlots()}/${g.maxSlots()} ช่อง${g.wear.back ? ` · ${ITEMS[g.wear.back].name}` : ' · ยังไม่มีกระเป๋า'}</small> <button data-dropmode="1" class="${this.dropMode ? 'on' : ''}">${this.dropMode ? '✋ เลิกทิ้งของ' : '🗑️ ทิ้งของ'}</button></h3>${catBar(ic, icount, 'icat')}<div class="inv ${this.dropMode ? 'dropping' : ''}">${inv}</div><p class="hint">${this.dropMode ? '<b class="miss">โหมดทิ้งของ: คลิกที่ไอเท็มเพื่อทิ้งทั้งกอง</b>' : 'คลิกเพื่อใช้/ถือ/สวม · คลิกขวาเพื่อปักไว้ที่ช่องลัด 1–6'} · ของชนิดเดียวกันซ้อนได้ 30 ชิ้น/ช่อง (อาหาร/ยา 10, เครื่องมือและเสื้อผ้า 1)</p></div><div><h3>ประดิษฐ์ ${fire ? '<span class="chip orange">🔥 ใกล้กองไฟ</span>' : ''}</h3>${catBar(rc, rcount, 'rcat')}${fbar}<div class="recipes">${rec}</div></div></div>`;
  }

  jobHTML() {
    const g = this.g, J = JOBS[g.profile.job]; if (!J) return '<p class="hint">ยังไม่ได้เลือกอาชีพ (เลือกได้ที่หน้าสร้างตัวละคร)</p>';
    const L = skillLevel(g.skills[J.skill]);
    return `<div class="jobbox"><b>${J.icon} อาชีพ: ${J.name}</b> <small>ทักษะหลัก ${SKILLS[J.skill]} Lv${L} · XP ${Object.entries(J.xp).map(([k, m]) => `${SKILLS[k]} ×${m}`).join(', ')}</small>
      ${J.perks.map(([l, t], i) => `<div class="perk ${hasPerk(g.auth.ch, g.profile.job, i) ? 'on' : ''}">${hasPerk(g.auth.ch, g.profile.job, i) ? '✅' : '🔒'} <b>Lv${l}</b> ${t}</div>`).join('')}</div>`;
  }

  charHTML() {
    const g = this.g, s = g.stats;
    const sk = Object.entries(SKILLS).map(([k, n]) => {
      const xp = g.skills[k] || 0, l = skillLevel(xp), a = xpForLevel(l), b = xpForLevel(l + 1);
      return `<div class="skill"><span>${n}</span><b>Lv ${l}</b><div class="pbar"><i style="width:${((xp - a) / (b - a)) * 100}%"></i></div><small>${Math.floor(xp)}/${b} XP</small></div>`;
    }).join('');
    return `<h3>${esc(g.profile.name)} (${g.profile.sex === 'f' ? 'หญิง' : 'ชาย'}) — เลเวล ${g.charLevel()}</h3>
      <p>❤️ พลังชีวิตสูงสุด ${g.maxHp()} · ⚡ สตามิน่าสูงสุด ${g.maxStamina()} · ⚔️ ดาเมจ ×${g.dmgMul().toFixed(2)} · 🧟 กำจัดผู้ติดเชื้อ ${s.kills} ตัว · 🗓️ รอดมาแล้ว ${Math.floor(s.survived / 60)} นาที</p>
      ${this.jobHTML()}
      <div class="jobbox"><b>🧟 ความสามารถจากการกำจัดผู้ติดเชื้อ</b> <small>กำจัดแล้ว ${s.kills} ตัว · 😰 ความเครียด ${Math.floor(s.stress || 0)}/100</small>
      ${KILL_PERKS.map(([n, t]) => `<div class="perk ${s.kills >= n ? 'on' : ''}">${s.kills >= n ? '✅' : '🔒'} <b>${n} ตัว</b> ${t}${s.kills < n ? ` <small>(อีก ${n - s.kills})</small>` : ''}</div>`).join('')}</div>
      <p><button data-tab="equip">🛡️ เปิดหน้าอุปกรณ์ (ถืออาวุธ/โล่ · สวมเสื้อผ้า)</button></p>
      <div class="skills">${sk}</div>
      <p class="hint">ประสบการณ์ได้จากการกระทำ: ตัดไม้/เก็บของ → เก็บเกี่ยว · ประดิษฐ์ของ → ประดิษฐ์ · ทำอาหาร/ต้มน้ำ → ทำอาหาร · รักษาตัวเอง/เพื่อน → การแพทย์ · สู้ → การต่อสู้ · มีชีวิตรอด/สำรวจ → เอาตัวรอด<br>
      เอาตัวรอดเพิ่มพลังชีวิตและลดความหิว · การต่อสู้เพิ่มดาเมจ · เก็บเกี่ยวเพิ่มจำนวนของที่ได้ · การแพทย์เพิ่มประสิทธิภาพยา</p>`;
  }

  // หน้าอุปกรณ์: ลากของจากกระเป๋าไปใส่มือ/ตัว · ลากมือหนึ่งไปอีกมือ = สลับมือ · ลากออกไปที่กระเป๋า = เก็บ
  equipHTML() {
    const g = this.g, ws = wearStats(g.wear);
    const tdesc = (t) => [t.dmg && `⚔️ ${t.dmg}`, t.range && `📏 ${t.range}`, t.gather && `🪓 ×${t.gather}`, t.fish && '🐟 แทงปลา', t.rod && '🎣 ตกปลา'].filter(Boolean).join(' ');
    const T = g.equipped && ITEMS[g.equipped], S = g.wear.off && ITEMS[g.wear.off];
    const toolSide = g.lefty ? 'L' : 'R';
    const hand = (side) => {
      const isTool = side === toolSide, it = isTool ? T : S;
      const stat = !it ? (isTool ? '✊ มือเปล่า: ต่อยได้ · เก็บของ' : 'ว่าง — ลากโล่มาใส่') : isTool ? tdesc(it.tool) : `🛡️ กัน ${Math.round(it.wear.block * 100)}% · ลดดาเมจ ${Math.round(it.wear.def * 100)}%`;
      const un = it ? (isTool ? '<button data-hold="">เก็บ</button>' : '<button data-unwear="off">ถอด</button>') : '';
      return `<div class="hand" data-drop="${side}"><h4>${side === 'R' ? '🫱 มือขวา' : '🫲 มือซ้าย'} <small>${isTool ? 'อาวุธ/เครื่องมือ' : 'โล่'}</small></h4>
        <div class="hbig ${it ? 'dragme' : ''}" ${it ? `data-drag="hand:${side}" title="ลากไปอีกมือเพื่อสลับ · ลากลงกระเป๋าเพื่อเก็บ"` : ''}>${it ? it.icon : '✋'}</div><b>${it ? esc(it.name) : 'ว่าง'}</b><small>${stat}</small>${un}</div>`;
    };
    const rank = (k) => (ITEMS[k].tool ? 0 : ITEMS[k].wear?.slot === 'off' ? 1 : 2);
    const bag = Object.keys(g.inv).filter((k) => g.inv[k] > 0 && (ITEMS[k].tool || ITEMS[k].wear) && k !== g.equipped)
      .sort((a, b) => rank(a) - rank(b))
      .map((k) => `<div class="dchip dragme" data-drag="item:${k}" data-item="${k}" title="${esc(ITEMS[k].name)} — ลากไปใส่มือ/ตัว หรือคลิก">${ITEMS[k].icon}<small>${esc(ITEMS[k].name)}</small></div>`).join('');
    return `<div class="hands">${hand('R')}<button class="swapbtn" data-swap="1" title="สลับมือ">⇄</button>${hand('L')}</div>
    <h4>🎒 ของที่ถือ/สวมได้ <small class="hint">ลากไปวางที่มือหรือช่องเครื่องแต่งกาย · คลิก = ใช้ทันที</small></h4>
    <div class="dbag" data-drop="bag">${bag || '<small class="hint">ไม่มีอาวุธ เครื่องมือ โล่ หรือเสื้อผ้าในกระเป๋า</small>'}</div>
    <p class="hint">⚔️ ดาเมจ ×${g.dmgMul().toFixed(2)} · 🛡️ โอกาสกันการโจมตี ${Math.round(ws.block * 100)}% (กันได้ = เจ็บแค่ 25% ไม่เลือดออก ไม่ติดเชื้อ)${g.lefty ? ' · ↔️ ถนัดซ้าย (สลับมืออยู่)' : ''}</p>
    <h4>👕 เครื่องแต่งกาย</h4><div data-drop="wear">${this.wearHTML(true)}</div>`;
  }

  // ลาก-วาง ด้วย pointer (ใช้ได้ทั้งเมาส์และนิ้ว)
  initDrag() {
    const panel = $('#panel'); let d = null;
    const zone = (x, y) => document.elementFromPoint(x, y)?.closest('[data-drop]');
    panel.addEventListener('pointerdown', (ev) => {
      const el = ev.target.closest('[data-drag]'); if (!el || ev.button > 0) return;
      d = { src: el.dataset.drag, x: ev.clientX, y: ev.clientY, el, ghost: null, over: null };
    });
    addEventListener('pointermove', (ev) => {
      if (!d) return;
      if (!d.ghost) {
        if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 8) return;
        d.ghost = document.createElement('div'); d.ghost.className = 'dghost'; d.ghost.textContent = d.el.firstChild?.textContent || d.el.textContent;
        document.body.appendChild(d.ghost); panel.classList.add('dragging');
      }
      ev.preventDefault();
      d.ghost.style.left = ev.clientX + 'px'; d.ghost.style.top = ev.clientY + 'px';
      // ลากใกล้ขอบบน/ล่างของหน้าต่าง → เลื่อนให้อัตโนมัติ (จอมือถือเตี้ย)
      const R = panel.getBoundingClientRect(); if (ev.clientY < R.top + 28) panel.scrollTop -= 12; else if (ev.clientY > R.bottom - 28) panel.scrollTop += 12;
      const z = zone(ev.clientX, ev.clientY); if (z !== d.over) { d.over?.classList.remove('over'); z?.classList.add('over'); d.over = z; }
    }, { passive: false });
    const end = (ev) => {
      if (!d) return; const cur = d; d = null;
      if (!cur.ghost) return;
      cur.ghost.remove(); panel.classList.remove('dragging'); cur.over?.classList.remove('over');
      this.dragEndT = performance.now();
      const z = ev.type === 'pointerup' && zone(ev.clientX, ev.clientY);
      if (z) { this.onDrop(cur.src, z.dataset.drop); this.refreshPanels(); }
    };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
  }
  onDrop(src, dst) {
    const g = this.g, [kind, v] = src.split(':'), toolSide = g.lefty ? 'L' : 'R';
    const hands = dst === 'R' || dst === 'L';
    if (kind === 'hand') {
      if (dst === 'bag') return v === toolSide ? g.holdItem(null) : g.unequip('off');
      if (hands && dst !== v) return g.setLefty(!g.lefty);
      return;
    }
    const it = ITEMS[v]; if (!it) return;
    if (hands) {
      const isShield = it.wear?.slot === 'off';
      if (!it.tool && !isShield) return this.toast(`${it.name} ถือในมือไม่ได้ — ลากไปที่ช่องเครื่องแต่งกาย`, 'warn');
      const want = it.tool ? toolSide : toolSide === 'R' ? 'L' : 'R';
      if (dst !== want) g.setLefty(!g.lefty); // วางผิดข้าง = สลับมือให้เลย
      if (it.tool) { if (g.equipped !== v) g.holdItem(v); } else if (g.wear.off !== v) g.useItem(v);
      return;
    }
    if (dst === 'wear') { if (it.wear) g.useItem(v); else this.toast('ลากอาวุธไปใส่ที่มือ', 'warn'); }
  }

  wearHTML(noOff) {
    const g = this.g, ws = wearStats(g.wear);
    const desc = (w) => [w.def && `🛡️ ${Math.round(w.def * 100)}%`, w.bite && `🦠 -${Math.round(w.bite * 100)}%`, w.spd > 0 && `💨 +${Math.round(w.spd * 100)}%`, w.stam && `⚡ +${Math.round(w.stam * 100)}%`, w.gather && `✊ +${w.gather}`, w.carry && `🎒 +${w.carry} ช่อง`, w.block && `🛡️ กัน ${Math.round(w.block * 100)}%`, w.spd < 0 && `🐢 ${Math.round(w.spd * 100)}%`].filter(Boolean).join(' ');
    const rows = Object.entries(WEAR_SLOTS).filter(([slot]) => !(noOff && slot === 'off')).map(([slot, label]) => {
      const k = g.wear[slot], it = k && ITEMS[k];
      const opts = Object.keys(g.inv).filter((x) => g.inv[x] > 0 && ITEMS[x].wear?.slot === slot).map((x) => `<button data-item="${x}" title="${esc(desc(ITEMS[x].wear))}">${ITEMS[x].icon} สวม${esc(ITEMS[x].name)}</button>`).join('');
      return `<div class="pgear"><span class="wslot">${label}</span> ${it ? `<b>${it.icon} ${esc(it.name)}</b> <small>${desc(it.wear)}</small> <button data-unwear="${slot}">ถอด</button>` : '<small>ว่าง</small>'} ${opts}</div>`;
    }).join('');
    return `<div class="wear">${rows}</div><p class="hint">รวม: 🛡️ ลดความเสียหาย ${Math.round(ws.def * 100)}% · 🦠 ลดโอกาสติดเชื้อ ${Math.round(ws.bite * 100)}% · 💨 ความเร็ว +${Math.round(ws.spd * 100)}% · ⚡ ฟื้นสตามิน่า +${Math.round(ws.stam * 100)}% · ✊ มือเปล่าแรง +${ws.gather} · 🎒 ${g.maxSlots()} ช่อง<br>ตัดเย็บได้ในแท็บกระเป๋า ใช้ <b>เศษผ้าขาด ซิป และแผ่นเคฟลาร์</b> ที่ดรอปจากผู้ติดเชื้อ และ <b>หนังสัตว์</b> จากหมูป่า/กวาง</p>`;
  }

  relHTML() {
    const g = this.g;
    const people = [...NPCS.map((n) => ({ id: n.id, name: n.name, sex: n.sex, bio: n.bio, npc: true })), ...[...g.ents.remotes.values()].map((r) => ({ id: r.id, name: r.name, sex: r.sex, bio: 'ผู้เล่น (เพื่อนของคุณ)' }))];
    const rows = people.map((p) => {
      const r = g.social.rel(p.id), l = relLevel(r), L = REL_LEVELS[l], next = REL_LEVELS[l + 1];
      const pct = next ? Math.min(100, ((r.pts - L.min) / (next.min - L.min)) * 100) : 100;
      return `<div class="person"><div><b>${p.sex === 'f' ? '👩' : '👨'} ${esc(p.name)}</b> <span class="chip" style="background:${L.color}">${L.name}</span>${g.social.preg[p.id] ? ' 🤰' : ''}<br><small>${esc(p.bio)}${p.npc ? '' : ' · 🟢'}</small><div class="pbar"><i style="width:${pct}%;background:${L.color}"></i></div></div><small>${Math.floor(r.pts)} แต้ม</small></div>`;
    }).join('');
    const kids = g.social.children.map((c) => `<li>${c.sex === 'f' ? '👧' : '👦'} ${esc(c.name)} ${c.adopted ? '(รับเลี้ยง)' : ''} — อายุ ${Math.floor((Date.now() - c.born) / 60000)} นาที</li>`).join('');
    return this.friendsHTML() + `<h3>💞 ความสัมพันธ์</h3><p class="hint">ความผูกพันเพิ่มขึ้นเมื่อ: อยู่ใกล้กัน · พูดคุย · ให้ของขวัญ (NPC ชอบของบางอย่างเป็นพิเศษ) · ทำแผลให้ · กอด<br>ลำดับ: ไม่รู้จัก → คุ้นเคย → เพื่อน → เพื่อนสนิท → คนรัก (สารภาพรัก) → ครอบครัว (แต่งงานด้วยแหวน) — เดินไปหาแล้วกด <b>E</b> เพื่อโต้ตอบ</p>${rows}
      <h3>👨‍👩‍👧 ลูก ๆ</h3>${kids ? `<ul>${kids}</ul>` : '<p class="hint">ยังไม่มีลูก (ต้องเป็นคนรัก/ครอบครัว และอยู่ใกล้เพิงพัก)</p>'}`;
  }

  petsHTML() {
    const g = this.g;
    const gearInv = Object.keys(g.inv).filter((k) => ITEMS[k].petGear && g.inv[k] > 0);
    const list = g.pets.map((p, i) => {
      const st = petStats(p), R = rarityOf(p), nxt = (st.lvl * st.lvl) * 30, cur = ((st.lvl - 1) ** 2) * 30;
      const slot = (s, label) => {
        const it = p.gear[s];
        const opts = gearInv.filter((k) => ITEMS[k].petGear.slot === s).map((k) => `<button data-petequip="${i}:${k}" title="${esc(gearDesc(ITEMS[k].petGear))}">${ITEMS[k].icon} ใส่${esc(ITEMS[k].name)}</button>`).join('');
        return `<div class="pgear"><span>${label}:</span> ${it ? `<b>${ITEMS[it].icon} ${esc(ITEMS[it].name)}</b> <small>${esc(gearDesc(ITEMS[it].petGear))}</small> <button data-petunequip="${i}:${s}">ถอด</button>` : '<small>ว่าง</small>'} ${opts}</div>`;
      };
      return `<div class="petcard" style="border-color:${R.color}">
        <div class="pethead"><b>🐾 ${esc(p.name)}</b> <span class="chip" style="background:${R.color};color:#111">${R.name}</span> <small>${PET_TYPES[p.type].name} · Lv ${st.lvl}</small>${p.down > 0 ? ' <span class="chip red">😵 หมดสติ</span>' : ''}</div>
        <div class="petstats"><span>❤️ ${Math.ceil(p.hp)}/${st.maxHp}</span><span>⚔️ โจมตี ${st.atk}</span><span>🛡️ ลดดาเมจ ${Math.round(st.def * 100)}%</span><span>💕 ผูกพัน ${Math.floor(p.loyal)}%</span></div>
        <div class="pbar"><i style="width:${Math.min(100, ((p.xp - cur) / (nxt - cur)) * 100)}%"></i></div><small>XP ${Math.floor(p.xp)}/${nxt} · ได้จากการสู้ ให้อาหาร และเดินทางด้วยกัน</small>
        <div class="traits"><span class="trait innate" title="ความสามารถประจำชนิด">⭐ ${esc(PET_TYPES[p.type].perk)}</span>${p.traits.map((t) => `<span class="trait" title="${esc(PET_TRAITS[t].desc)}">${PET_TRAITS[t].icon} ${esc(PET_TRAITS[t].name)}<small>${esc(PET_TRAITS[t].desc)}</small></span>`).join('')}</div>
        ${Object.entries(PET_SLOTS).map(([k, label]) => slot(k, label)).join('')}
        <div class="acts"><button data-petfeed="${i}">🍖 ให้อาหาร</button><button data-petheal="${i}">🩹 รักษา</button><button data-petstay="${i}">${p.stay ? '🚶 ตามมา' : '✋ รอตรงนี้'}</button><button data-pethome="${i}">${p.home ? '🚶 พากลับจากบ้าน' : '🏡 ให้อยู่บ้านสัตว์เลี้ยง'}</button></div>${p.home ? '<small>🏡 อยู่บ้าน: ฟื้นพลังชีวิต ความผูกพันไม่ลด และช่วยเฝ้าบ้าน</small>' : ''}
      </div>`;
    }).join('');
    const env = g.auth.env(), houses = env.ownCount('pethouse'), beds = env.ownCount('bed'), cap = petCap(houses, beds);
    const capLine = `<div class="jobbox">🐾 จำนวนสูงสุด: <b>ชนิดละ ${cap} ตัว</b> — ${['dog', 'cat', 'bird'].map((t) => `${PET_TYPES[t].name} ${g.pets.filter((p) => p.type === t).length}/${cap}`).join(' · ')}<br><small>${beds ? `🏡 บ้านสัตว์เลี้ยง ${houses} หลัง (หลังละ +2 ตัว/ชนิด) — สร้างเพิ่มในเมนูสร้างบ้าน` : 'เริ่มต้นชนิดละ 3 ตัว · อยากเลี้ยงเพิ่ม: ต้องมีบ้าน (วาง 🛏️ เตียง) แล้วสร้าง 🏡 บ้านสัตว์เลี้ยง หลังละ +2 ตัว/ชนิด'} · สัตว์เลี้ยงเดินตามเป็นแถวข้างหลังคุณ</small></div>`;
    return capLine + `<p class="hint">หาสุนัข แมว หรือนกขุนทองจรจัดในเมือง แล้วกด <b>E</b> ป้อนอาหารที่มันชอบจนเชื่อง 100%<br>🐕 สุนัข: ${PET_TYPES.dog.foods.map((f) => ITEMS[f].name).join(', ')} · 🐈 แมว: ${PET_TYPES.cat.foods.map((f) => ITEMS[f].name).join(', ')} · 🐦 นก: ${PET_TYPES.bird.foods.map((f) => ITEMS[f].name).join(', ')}</p>${list || '<p class="hint">ยังไม่มีสัตว์เลี้ยง</p>'}`;
  }

  // ----- เมนูโต้ตอบกับคน -----
  openPerson(e) {
    this.closeAll(); this.person = e; this.open = 'panel'; this.tab = 'rel';
    $('#panel').style.display = 'block'; document.exitPointerLock?.(); this.refreshPanels();
  }
  friendBtn(id) {
    const g = this.g;
    if (!g.net.online) return '';
    if ((g.friends || []).some((f) => f.id === id)) return '<button class="dis" title="เป็นเพื่อนกันแล้ว">🤝 เพื่อนกันแล้ว</button>';
    if ((g.friendReqs || []).some((f) => f.id === id)) return `<button data-faccept="${esc(id)}">✅ ตอบรับเป็นเพื่อน</button>`;
    return `<button data-freq="${esc(id)}">➕ ขอเป็นเพื่อน</button>`;
  }
  friendsHTML() {
    const g = this.g, P = g.player.pos;
    if (!g.net.online) return '<h3>👥 เพื่อน</h3><p class="hint">ระบบเพื่อนใช้ได้ตอนเล่นออนไลน์ (กด "เล่นกับเพื่อน")</p>';
    const reqs = (g.friendReqs || []).map((f) => `<div class="person"><div>📨 <b>${esc(f.name)}</b> ขอเป็นเพื่อนกับคุณ</div><div><button data-faccept="${esc(f.id)}">✅ ตอบรับ</button> <button data-fdecline="${esc(f.id)}">✖ ปฏิเสธ</button></div></div>`).join('');
    const list = (g.friends || []).slice().sort((a, b) => b.online - a.online).map((f) => {
      const d = f.online && f.x !== null ? Math.hypot(f.x - P.x, f.z - P.z) * 50 : null;
      const r = g.social.rel(f.id), L = REL_LEVELS[relLevel(r)];
      return `<div class="person"><div>${f.online ? '🟢' : '⚪'} <b>${esc(f.name)}</b> <span class="chip" style="background:${L.color}">${L.name}</span><br><small>${f.online ? (d !== null ? `ห่าง ${d >= 1000 ? (d / 1000).toFixed(1) + ' กม.' : Math.round(d) + ' ม.'} · ดูจุดสีเขียวบนแผนที่` : 'ออนไลน์') : 'ออฟไลน์'}</small></div><button data-fremove="${esc(f.id)}" title="ลบเพื่อน">🗑️</button></div>`;
    }).join('');
    return `<h3>👥 เพื่อน (${(g.friends || []).length})</h3>${reqs}${list || '<p class="hint">ยังไม่มีเพื่อน — เดินไปหาผู้เล่นอื่น กด E แล้วเลือก "➕ ขอเป็นเพื่อน"</p>'}
      <p class="hint">เพื่อนกัน = ความสัมพันธ์เริ่มที่ระดับ "เพื่อน" ทันที · อยู่ใกล้กันได้แต้มความสัมพันธ์เร็วขึ้น 50% · เห็นตำแหน่งกันบนแผนที่ · ได้แจ้งเตือนเมื่อเพื่อนออนไลน์</p>`;
  }
  personHTML() {
    const g = this.g, e = this.person, r = g.social.rel(e.id), l = relLevel(r), L = REL_LEVELS[l], next = REL_LEVELS[l + 1];
    const me = g.social.person(g.id), other = g.social.person(e.id);
    const npc = e.kind === 'npc';
    const acts = Object.entries(ACTIONS).filter(([k, A]) => k !== 'gift' && !(A.npcOnly && !npc) && !(k === 'breakup' && l < 4)).map(([k, A]) => {
      const c = canDo(k, r, me, other);
      const label = k === 'follow' && e.follow ? '🛑 ให้รอที่นี่' : A.label;
      return `<button data-act="${k}" ${c.ok ? '' : 'class="dis"'} title="${esc(c.why || '')}">${label}</button>`;
    }).join('');
    const gifts = Object.entries(g.inv).filter(([, q]) => q > 0).map(([k]) => `<span class="item small" data-gift="${k}" title="ให้ ${ITEMS[k].name}">${ITEMS[k].icon}</span>`).join('');
    const pct = next ? Math.min(100, ((r.pts - L.min) / (next.min - L.min)) * 100) : 100;
    return `<button data-back="1">← กลับ</button><h3>${other.sex === 'f' ? '👩' : '👨'} ${esc(other.name)} <span class="chip" style="background:${L.color}">${L.name}</span></h3>
      <p><small>${npc ? esc(e.def.bio) + ` · ชอบ: ${ITEMS[e.def.likes].icon}?` : 'ผู้เล่นออนไลน์'}</small></p>
      <div class="pbar big"><i style="width:${pct}%;background:${L.color}"></i></div><small>${Math.floor(r.pts)} แต้ม ${next ? `→ ${next.name} ที่ ${next.min}` : ''}</small>
      <div class="acts">${acts}${npc ? '' : this.friendBtn(e.id)}</div><h4>🎁 ให้ของขวัญ</h4><div class="gifts">${gifts || '<span class="hint">ไม่มีของ</span>'}</div>
      <p class="hint">ปุ่มสีจาง = ยังทำไม่ได้ (ชี้เมาส์เพื่อดูเหตุผล) · การกระทำสำคัญต้องได้รับความยินยอมจากอีกฝ่าย</p>`;
  }

  onPanelClick(ev) {
    if (performance.now() - (this.dragEndT || 0) < 250) return; // เพิ่งลากเสร็จ ไม่นับเป็นคลิก
    const t = ev.target.closest('button,[data-item],[data-swap],[data-gift],[data-dep],[data-wd]'); if (!t) return;
    const g = this.g, d = t.dataset;
    if (d.close) return this.closeAll();
    if (d.tab) { this.person = null; this.tab = d.tab; return this.refreshPanels(); }
    if (d.back) { this.person = null; return this.refreshPanels(); }
    if (d.dropmode) { this.dropMode = !this.dropMode; return this.refreshPanels(); }
    if (d.item) { if (this.dropMode) g.dropItem(d.item, g.inv[d.item]); else g.useItem(d.item); return this.refreshPanels(); }
    if (d.hold !== undefined) { g.holdItem(d.hold || null); return this.refreshPanels(); }
    if (d.swap) { g.setLefty(!g.lefty); return this.refreshPanels(); }
    if (d.icat) { this.icat = d.icat; return this.refreshPanels(); }
    if (d.rcat) { this.rcat = d.rcat; return this.refreshPanels(); }
    if (d.freq) { g.net.send({ t: 'friend', a: 'req', to: d.freq }); return; }
    if (d.faccept) { g.net.send({ t: 'friend', a: 'accept', to: d.faccept }); return; }
    if (d.fdecline) { g.net.send({ t: 'friend', a: 'decline', to: d.fdecline }); return; }
    if (d.fremove) { const f = g.friends.find((x) => x.id === d.fremove); return this.confirm(`ลบ ${f?.name || ''} ออกจากเพื่อน?`, (ok) => ok && g.net.send({ t: 'friend', a: 'remove', to: d.fremove })); }
    if (d.rfilter) { this.rfilter = d.rfilter; return this.refreshPanels(); }
    if (d.unwear) { g.unequip(d.unwear); return this.refreshPanels(); }
    if (d.craft) { g.craft(+d.craft); return this.refreshPanels(); }
    if (d.act) { if (t.classList.contains('dis')) return this.toast(t.title, 'warn'); g.social.act(d.act, this.person.id); return this.refreshPanels(); }
    if (d.gift) { g.social.act('gift', this.person.id, { item: d.gift }); return this.refreshPanels(); }
    if (d.petfeed) { g.feedPet(+d.petfeed); return this.refreshPanels(); }
    if (d.petstay) { const p = g.pets[+d.petstay]; p.stay = !p.stay; return this.refreshPanels(); }
    if (d.petheal) { healPet(g, g.pets[+d.petheal]); return this.refreshPanels(); }
    if (d.petequip) { const [i, k] = d.petequip.split(':'); equipPet(g, g.pets[+i], k); return this.refreshPanels(); }
    if (d.petunequip) { const [i, sl] = d.petunequip.split(':'); unequipPet(g, g.pets[+i], sl); return this.refreshPanels(); }
    if (d.build) { if (t.classList.contains('dis') && !g.hasItem('hammer')) return this.toast('ต้องมี 🔨 ค้อนช่างไม้ก่อน', 'warn'); return g.builder.start(d.build); }
    if (d.demolish) { if (!g.hasItem('hammer')) return this.toast('ต้องมี 🔨 ค้อนช่างไม้ก่อน', 'warn'); return g.builder.startDemolish(); }
    if (d.sact) { const a = this.structActs?.[+d.sact]; if (a && !a.dis) a.run(); return this.refreshPanels(); }
    if (d.dep) { g.home.deposit(this.struct, d.dep, 1); return this.refreshPanels(); }
    if (d.wd) { g.home.withdraw(this.struct, d.wd, 1); return this.refreshPanels(); }
    if (d.pethome) { const p = g.pets[+d.pethome]; if (p.home) { p.home = null; this.toast(`${p.name} กลับมาตามคุณแล้ว`); } else { const P0 = g.player.pos; const h = g.world.nearestStructure(P0.x, P0.z, 5000, (s) => s.type === 'pethouse' && (!s.owner || s.owner === g.id)); if (!h) return this.toast('ต้องสร้าง 🏡 บ้านสัตว์เลี้ยงก่อน (เมนูสร้างบ้าน)', 'warn'); p.home = h.id; this.toast(`🏡 ${p.name} ไปอยู่บ้านสัตว์เลี้ยงแล้ว`); } return this.refreshPanels(); }
  }

  showFatal(text) {
    document.exitPointerLock?.();
    const d = $('#death'); d.style.display = 'flex';
    d.querySelector('h1').textContent = '⚠️ การเชื่อมต่อ'; $('#death-cause').textContent = text;
    d.querySelector('.hint').textContent = '';
    const b = $('#respawn-btn'); b.textContent = 'โหลดใหม่'; b.onclick = () => location.reload();
  }
  showDeath(cause) {
    document.exitPointerLock?.();
    $('#death').style.display = 'flex'; $('#death-cause').textContent = cause;
  }
  hideDeath() { $('#death').style.display = 'none'; }
}

export function coordText(x, z) { return `${zToLat(z).toFixed(3)}°N ${xToLon(x).toFixed(3)}°E`; }

function star(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath();
}

function gearDesc(gr) {
  return [gr.atk && `โจมตี +${gr.atk}`, gr.def && `ลดดาเมจ ${Math.round(gr.def * 100)}%`, gr.hp && `พลังชีวิต +${gr.hp}`, gr.luck && 'โชคดีขึ้น ผูกพันลดช้าลง', gr.carry && 'ของที่หามาได้ ×2', gr.alarm && 'เตือนเมื่อผู้ติดเชื้อเข้าใกล้'].filter(Boolean).join(' · ');
}
