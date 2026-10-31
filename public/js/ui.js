import { tr } from './i18n.js';
import { SELF_PENALTY, shopPenalty, gearKind, parseKey, enhanceRates, enhanceStone, enhanceFee, PLUS_MAX, PET_PLUS_MAX, COIN_GOODS, tradeable, TRADE_RULE, PLUS_GLOW, TOWNS, RARITY, WILD_PET_MAX, jobPts, freePts, jobOf, PERK_PTS, SHOPS, DAY_MS, canBuild, JOBS, KILL_PERKS, hasPerk, petCap, ITEMS, RECIPES, SKILLS, skillLevel, xpForLevel, PET_TYPES, PET_TRAITS, PET_SLOTS, NPCS, WEAR_SLOTS, wearStats, LEARN } from './data.js';
import { petStats, rarityOf, equipPet, unequipPet, healPet } from './pets.js';
import { PIECES, coinCost, COLOR_COST, BASE_COLORS, basesOf, HOUSE_UP, ROLES, roleIn, HOUSE_LV, fenceRingPrice, RING_MIN, RING_MAX, prefabPrice, cellOf } from './building-core.js';
import { pieceInfo } from './homestead.js';
import { shopPrice, tradeValue, sellPrice, SELL_DAY_CAP, salvageOf, sqText, sqProgress, SQ_DAILY } from './economy.js';
import { ACTIONS, REL_LEVELS, relLevel, canDo } from './social-core.js';
import { WORLD, zToLat, xToLon } from './terrain.js';
import { WATER_TOWERS } from './quest-core.js';
import { VOL_CH } from './audio.js';
import { openGuide } from './guide-ui.js';
import { fogName } from './weather-core.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// หมวดหมู่ไอเท็ม (ใช้กรองกระเป๋าและสูตรประดิษฐ์)
const CATS = [['all', '📦 ทั้งหมด'], ['surv', '🏕️ อุปกรณ์ดำรงชีพ'], ['weapon', '⚔️ อาวุธ/โล่'], ['wear', '👕 เสื้อผ้า'], ['food', '🍖 อาหาร/น้ำ'], ['med', '💊 ยา'], ['mat', '🪵 วัตถุดิบ'], ['place', '🏠 วาง/ยานพาหนะ'], ['fun', '🎸 ดนตรี/อุปกรณ์'], ['pet', '🐾 สัตว์เลี้ยง'], ['farm', '🌱 เมล็ด/ดอกไม้'], ['quest', '📜 ภารกิจ']];
// อุปกรณ์ดำรงชีพ: เครื่องมือหาอยู่หากิน ก่อไฟ ที่พัก ภาชนะ (ไม่ใช่อาวุธต่อสู้หลัก)
const SURVIVAL = new Set(['pickaxe', 'iron_pickaxe', 'stone_axe', 'steel_axe', 'stone_hammer', 'wood_hammer', 'hammer', 'hoe', 'sickle', 'rod', 'rod_pro', 'net', 'watering_can', 'torch', 'bottle', 'campfire', 'shelter', 'watchtower', 'cage', 'flower_pot', 'raft']);
// สถานีประดิษฐ์: 🔥 กองไฟ · ⚙️ เครื่องสีข้าว
const STATION_TXT = { fire: '🔥 ใกล้กองไฟ', mill: '⚙️ ใกล้เครื่องสีข้าว', desal: '🧂 ใกล้เครื่องกรองน้ำทะเล' };
const STATION_PIECE = { mill: 'ricemill', desal: 'desal' };
const stationOk = (g, r, fire) => !r.station || (r.station === 'fire' ? fire : !!g.world.nearStructure(g.player.pos.x, g.player.pos.z, STATION_PIECE[r.station], 4.5));
const catOf = (k) => { const it = ITEMS[k]; return SURVIVAL.has(String(k).split('~')[0]) ? 'surv' : k.startsWith('seeds_') || it.flower ? 'farm' : it.coin ? 'mat' : it.tool || it.wear?.slot === 'off' ? 'weapon' : it.wear ? 'wear' : it.food ? 'food' : it.med ? 'med' : it.instrument || it.device ? 'fun' : it.place ? 'place' : it.petGear ? 'pet' : it.quest ? 'quest' : 'mat'; };
const pct = (v) => Math.round(v * 100);
// สเตตัสของไอเท็ม (อาวุธ เสื้อผ้า อาหาร ยา อุปกรณ์สัตว์)
export function statText(k) {
  const it = ITEMS[k]; if (!it) return '';
  const t = it.tool, w = it.wear, f = it.food, m = it.med, p = it.petGear;
  return [
    it.opts?.length && `🔍 ${it.opts.join(' · ')}`,
    it.ammo && `🏹+${it.ammo.dmg} ดาเมจ (ระดับ ${it.ammo.tier})`, it.ammo?.burn && '🔥ติดไฟ', t && t.dmg && `⚔️${t.dmg}`, t && t.range && `📏${t.range}`, t && t.gather && `🪓×${t.gather}`, t && t.rock && `⛏️หิน×${t.rock}`,
    w && w.def && `🛡️-${pct(w.def)}%ดาเมจ`, w && w.block && `🔰กัน${pct(w.block)}%`, w && w.bite && `🦠-${pct(w.bite)}%`, w && w.spd && `${w.spd > 0 ? '💨+' : '🐢'}${pct(w.spd)}%`,
    w && w.stam && `⚡+${pct(w.stam)}%`, w && w.gather && `✊+${w.gather}`, w && w.carry && `🎒+${w.carry}ช่อง`,
    f && f.hunger && `🍗+${f.hunger}`, f && f.thirst && `💧+${f.thirst}`, f && f.hp && `❤️+${f.hp}`, f && f.infection && `🦠${f.infection}`, f && f.sick && `⚠️ท้องเสีย ${pct(f.sick)}%`, f && f.stress && `😌${f.stress} เครียด`, f && f.stamina && `⚡+${f.stamina}`, it.instrument && !it.chant && !it.device && '🎶 ลดความเครียดรอบตัว', it.chant && '🙏 สวดมนต์: ลดตื่นตระหนก + กำลังใจ', it.device?.loot && `📍 เห็นกล่องเสบียงบนแผนที่ ${it.device.loot}`, it.device?.zombie && `🧟 เห็นผู้ติดเชื้อบนแผนที่ ${it.device.zombie}`, it.device?.scout && '🛸 ส่องรอบตัว 60 วิ', it.morale && '💪 กำลังใจ 5 นาที', m && m.immune && `🛡️ภูมิคุ้มกัน ${m.immune / 60} นาที`,
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

// ซูมแผนที่จากปุ่ม (รอบจุดกึ่งกลางมุมมอง)
const zoomBtn = (ui, f) => { const V = ui.mapView, z0 = ui.mapZoom || 1, z1 = Math.min(12, Math.max(1, z0 * f)); if (V) ui.mapCenter = { x: V.vx + V.vw / 2, z: V.vz + V.vh / 2 }; ui.mapZoom = z1; if (z1 === 1) ui.mapCenter = null; };
export class UI {
  constructor(game) {
    this.g = game; this.tab = 'inv'; this.open = null; this.person = null; this.hudT = 0;
    $('#game-ui').style.display = 'block';
    $('#panel').addEventListener('click', (ev) => this.onPanelClick(ev));
    // คลิกที่แถบสเตตัสเพื่อดูคำอธิบาย
    document.querySelectorAll('#hud .stat[data-stat]').forEach((el) => el.addEventListener('click', (ev) => { ev.stopPropagation(); this.showStatHelp(el.dataset.stat); }));
    addEventListener('click', () => { const h = $('#stat-help'); if (h) h.style.display = 'none'; this.statHelp = null; });
    this.initDrag();
    // ค้นหาสูตรประดิษฐ์: พิมพ์แล้วกรองทันที (คงเคอร์เซอร์ไว้ในช่อง)
    $('#panel').addEventListener('input', (ev) => {
      if (ev.target.id !== 'craft-q') return;
      this.craftQ = ev.target.value; const pos = ev.target.selectionStart;
      this.refreshPanels(); const el = $('#craft-q'); if (el) { el.focus(); el.setSelectionRange(pos, pos); }
    });
    $('#panel').addEventListener('input', (ev) => { if (ev.target.id === 'st-q' && +ev.target.value > 0) this.stQty = Math.max(1, +ev.target.value | 0); });
    $('#panel').addEventListener('keydown', (ev) => { if (ev.target.id === 'craft-q' || ev.target.matches?.('input')) ev.stopPropagation(); }); // พิมพ์ตัวเลขในช่องจำนวนไม่ไปกดปุ่มลัด
    $('#panel').addEventListener('contextmenu', (ev) => {
      const pv = ev.target.closest('[data-pdep],[data-pwd]');
      if (pv && this.struct) { ev.preventDefault(); const s0 = this.g.world.structures.find((x) => x.id === this.struct.id) || this.struct; if (pv.dataset.pdep) this.g.home.op(s0, { o: 'pitem', item: pv.dataset.pdep, qty: this.g.inv[pv.dataset.pdep] || 0 }); else this.g.home.op(s0, { o: 'pitem', item: pv.dataset.pwd, qty: -(s0.pi?.[this.g.id]?.[pv.dataset.pwd] || 0) }); return this.refreshPanels(); }
      const st = ev.target.closest('[data-dep],[data-wd]');
      if (st && this.struct) { ev.preventDefault(); const s0 = this.g.world.structures.find((x) => x.id === this.struct.id); if (st.dataset.dep) this.g.home.deposit(this.struct, st.dataset.dep, this.g.inv[st.dataset.dep] || 0); else this.g.home.withdraw(this.struct, st.dataset.wd, s0?.items?.[st.dataset.wd] || 0); return this.refreshPanels(); }
      const el = ev.target.closest('[data-item]'); if (!el) return;
      ev.preventDefault(); this.itemMenu(el.dataset.item, ev.clientX, ev.clientY);
    });
    $('#chat-input').addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { const v = ev.target.value.trim(); if (v) this.g.sendChat(v); ev.target.value = ''; ev.target.blur(); this.chatting = false; }
      if (ev.key === 'Escape') { ev.target.blur(); this.chatting = false; }
    });
    $('#respawn-btn').onclick = () => this.g.respawn();
    $('#sidequest').addEventListener('click', (ev) => { ev.stopPropagation(); const a = ev.target.dataset.sq; if (a) this.g.auth.do('sq' + a); });
    // ปุ่มเลือกช่องแชท: ทุกคน → ปาร์ตี้ → ครอบครัว → กระซิบ (ถามชื่อ)
    $('#chat-ch').addEventListener('click', (ev) => {
      ev.stopPropagation(); const g = this.g, order = ['all', 'party', 'family', 'pm'];
      let c = order[(order.indexOf(g.chatCh || 'all') + 1) % order.length];
      if (c === 'pm') { const n = prompt('กระซิบถึงใคร? (พิมพ์ชื่อผู้เล่น)', g.lastPm || g.chatTo || ''); if (n) g.chatTo = n.trim(); else c = 'all'; }
      g.chatCh = c; ev.target.textContent = { all: '📢 ทุกคน', party: '👥 ปาร์ตี้', family: '🏠 ครอบครัว', pm: `🤫 ${g.chatTo}` }[c];
    });
    // ปุ่ม ⛶ ขยาย/ย่อเต็มหน้าจอ — iPhone ไม่รองรับ Fullscreen API จึงแนะนำให้เพิ่มลงหน้าจอโฮม
    const fb = $('#fs-btn'), d = document, root = d.documentElement;
    const fsEl = () => d.fullscreenElement || d.webkitFullscreenElement;
    const syncF = () => { fb.textContent = fsEl() ? '🗗' : '⛶'; fb.title = fsEl() ? 'ออกจากเต็มหน้าจอ' : 'ขยายเต็มหน้าจอ'; };
    fb.onclick = (ev) => {
      ev.stopPropagation();
      if (fsEl()) { (d.exitFullscreen || d.webkitExitFullscreen)?.call(d); return; }
      const req = root.requestFullscreen || root.webkitRequestFullscreen;
      const ios = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
      const iosHint = () => this.toast(!ios ? '⛶ เบราว์เซอร์นี้ไม่ยอมให้เต็มจอจากในหน้า ลองกด F11 หรือเปิดเกมในแท็บใหม่' : navigator.standalone ? '📱 กำลังเล่นแบบเต็มจอจากหน้าจอโฮมอยู่แล้ว' : '📱 iPhone: กดปุ่มแชร์ ⬆️ ใน Safari → "เพิ่มไปยังหน้าจอโฮม" แล้วเปิดเกมจากไอคอน จะได้เต็มจอ', 'warn');
      if (!req) return iosHint();
      try { req.call(root, { navigationUI: 'hide' })?.catch?.(() => {}); } catch {}
      setTimeout(() => { if (!fsEl()) iosHint(); }, 900);
    };
    d.addEventListener('fullscreenchange', syncF); d.addEventListener('webkitfullscreenchange', syncF); syncF();
    $('#hand-btn').onclick = (ev) => { ev.stopPropagation(); this.g.swapHands(); };
    // แตะกล่องภารกิจ = เปิด/ปิดลูกศรนำทาง 3 มิติเหนือหัวตัวละคร
    $('#quest').addEventListener('click', (ev) => { ev.stopPropagation(); this.g.navOn = !this.g.navOn; this.toast(this.g.navOn ? '🧭 เปิดลูกศรนำทางไปยังเป้าหมายภารกิจ' : '🧭 ปิดลูกศรนำทาง'); });
    const mute = $('#mute-btn');
    const syncMute = () => { mute.textContent = this.g.sfx.muted ? '🔇' : '🔊'; mute.setAttribute('aria-label', this.g.sfx.muted ? 'เปิดเสียง' : 'ปิดเสียง'); };
    // ปุ่ม 🔊: เปิดแผงปรับระดับเสียง (ฝน ลม คลื่น กองไฟ ผู้ติดเชื้อ ดนตรี ฯลฯ)
    const sp = $('#sound-panel'), sfx = this.g.sfx;
    const drawSound = () => { sp.innerHTML = `<div class="sp-head"><b>🔊 ปรับระดับเสียง</b><button data-sclose="1">✕</button></div>
      <label class="sp-mute"><input type="checkbox" id="sp-mute" ${sfx.muted ? 'checked' : ''}> 🔇 ปิดเสียงทั้งหมด</label>
      ${VOL_CH.map(([k, n]) => `<label class="sp-row"><span>${n}</span><input type="range" min="0" max="100" step="5" data-vol="${k}" value="${Math.round(sfx.vol[k] * 100)}"><em>${Math.round(sfx.vol[k] * 100)}%</em></label>`).join('')}
      <p class="hint">ตั้งค่าจำไว้ในเครื่องนี้</p>`; };
    mute.onclick = (ev) => { ev.stopPropagation(); sfx.unlock(); sp.hidden = !sp.hidden; if (!sp.hidden) drawSound(); };
    sp.addEventListener('input', (ev) => { const k = ev.target.dataset.vol; if (k) { sfx.setVol(k, ev.target.value / 100); ev.target.nextElementSibling.textContent = ev.target.value + '%'; } });
    // 🗺️ ซูม/เลื่อนแผนที่ใหญ่: ล้อเมาส์ · ลากเมาส์/นิ้ว · หยิกสองนิ้ว
    const P = $('#panel'), mapEv = (ev) => ev.target?.id === 'bigmap';
    const zoomAt = (f, cx, cy) => {
      const V = this.mapView; if (!V) return; const cv = $('#bigmap'), r = cv.getBoundingClientRect();
      const wx = V.vx + ((cx - r.left) / r.width) * V.vw, wz = V.vz + ((cy - r.top) / r.height) * V.vh;
      const z0 = this.mapZoom || 1, z1 = Math.min(12, Math.max(1, z0 * f)); if (z1 === z0) return;
      const C = this.mapCenter || { x: this.g.player.pos.x, z: this.g.player.pos.z };
      this.mapZoom = z1; this.mapCenter = { x: wx + (C.x - wx) * (z0 / z1), z: wz + (C.z - wz) * (z0 / z1) };
      const h = P.querySelector('.mapbar .hint'); if (h) h.textContent = `ซูม ×${z1.toFixed(1)} · หมุนล้อเมาส์/หยิกสองนิ้วเพื่อซูม · ลากเพื่อเลื่อน`;
      this.drawBigMap();
    };
    P.addEventListener('wheel', (ev) => { if (!mapEv(ev)) return; ev.preventDefault(); zoomAt(ev.deltaY < 0 ? 1.25 : 0.8, ev.clientX, ev.clientY); }, { passive: false });
    let drag = null, pinch = null;
    const pan = (dx, dy) => { const V = this.mapView, cv = $('#bigmap'); if (!V || !cv) return; const r = cv.getBoundingClientRect(), C = this.mapCenter || { x: V.vx + V.vw / 2, z: V.vz + V.vh / 2 }; this.mapCenter = { x: C.x - (dx / r.width) * V.vw, z: C.z - (dy / r.height) * V.vh }; this.drawBigMap(); };
    P.addEventListener('mousedown', (ev) => { if (mapEv(ev)) { drag = { x: ev.clientX, y: ev.clientY }; ev.preventDefault(); } });
    addEventListener('mousemove', (ev) => { if (!drag) return; pan(ev.clientX - drag.x, ev.clientY - drag.y); drag = { x: ev.clientX, y: ev.clientY }; });
    addEventListener('mouseup', () => { drag = null; });
    P.addEventListener('touchstart', (ev) => { if (!mapEv(ev)) return; const t = ev.touches; if (t.length === 2) { pinch = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); drag = null; } else drag = { x: t[0].clientX, y: t[0].clientY }; }, { passive: true });
    P.addEventListener('touchmove', (ev) => {
      if (!mapEv(ev)) return; const t = ev.touches; ev.preventDefault();
      if (t.length === 2 && pinch) { const d = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); zoomAt(d / pinch, (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2); pinch = d; }
      else if (drag && t.length === 1) { pan(t[0].clientX - drag.x, t[0].clientY - drag.y); drag = { x: t[0].clientX, y: t[0].clientY }; }
    }, { passive: false });
    P.addEventListener('touchend', () => { pinch = null; drag = null; });
    $('#panel').addEventListener('change', (ev) => { const id = ev.target.id; if (id === 'ring-n') this.ringN = +ev.target.value; else if (id === 'ring-g') this.ringG = +ev.target.value; else if (id === 'pf-n') this.pfN = +ev.target.value; else if (id === 'st-q') { this.stQty = Math.max(1, +ev.target.value | 0); return; } else return; this.refreshPanels(); });
    sp.addEventListener('change', (ev) => { if (ev.target.id === 'sp-mute') { sfx.setMuted(ev.target.checked); syncMute(); } });
    sp.addEventListener('click', (ev) => { ev.stopPropagation(); if (ev.target.dataset.sclose) sp.hidden = true; });
    ['keydown', 'pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach((t) => sp.addEventListener(t, (ev) => ev.stopPropagation()));
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
  chat(name, text, sys, ch = 'all', toName, mine) {
    const d = document.createElement('div'), tag = { party: '[👥 ปาร์ตี้] ', family: '[🏠 ครอบครัว] ', pm: mine ? `[🤫 ถึง ${toName || ''}] ` : '[🤫 กระซิบ] ' }[ch] || '';
    if (ch !== 'all') d.className = 'c-' + ch;
    d.innerHTML = sys ? `<i>${esc(text)}</i>` : `${esc(tag)}<b>${esc(name)}:</b> ${esc(text)}`;
    $('#chat-log').append(d); $('#chat-log').scrollTop = 1e9;
    while ($('#chat-log').children.length > 60) $('#chat-log').firstChild.remove();
  }
  confirm(text, cb) {
    const d = $('#confirm'); d.style.display = 'flex'; $('#confirm-text').textContent = text;
    document.exitPointerLock?.();
    const done = (v) => { d.style.display = 'none'; cb(v); };
    $('#confirm-yes').onclick = () => done(true); $('#confirm-no').onclick = () => done(false);
  }
  showStatHelp(k) {
    const g = this.g, s = g.stats, h = $('#stat-help');
    if (this.statHelp === k) { h.style.display = 'none'; this.statHelp = null; return; }
    this.statHelp = k;
    const H = {
      hp: ['❤️ พลังชีวิต', `${Math.ceil(s.hp)}/${g.maxHp()}`, 'หมดแล้วตาย · ลดเมื่อถูกตี หิว/กระหายจนหมด เลือดออก หรือติดเชื้อเต็ม · ฟื้นเองช้า ๆ เมื่ออิ่มและไม่ติดเชื้อ (ใกล้กองไฟฟื้นเร็วขึ้น) · ใช้ผ้าพันแผล/ยาเพื่อฟื้นทันที'],
      food: ['🍗 ความอิ่ม', `${Math.ceil(s.hunger)}/100`, 'ลดลงตามเวลา (วิ่งแล้วลดเร็ว) · ถ้าหมดจะเสียพลังชีวิต · กินอาหาร (อาหารปรุงสุกดีกว่าดิบ) · เชฟทำให้อาหารได้ผลมากขึ้น'],
      water: ['💧 ความกระหาย', `${Math.ceil(s.thirst)}/100`, 'ลดลงตามเวลา (กลางวันร้อนลดเร็ว) · ถ้าหมดเสียพลังชีวิตเร็ว · ดื่มน้ำต้มสุก/มะพร้าว · น้ำดิบเสี่ยงท้องเสีย ให้ต้มที่กองไฟก่อน'],
      stam: ['⚡ สตามิน่า', `${Math.ceil(s.stamina)}/${g.maxStamina()}`, 'ใช้ตอนวิ่ง กระโดด ตี และว่ายน้ำ · ฟื้นเมื่อหยุดวิ่ง · ฟื้นช้าลงเมื่อหิว ติดเชื้อหนัก หรือเครียด · ฟื้นเร็วขึ้นเมื่อใส่ถุงเท้า อยู่ใกล้คนรัก หรือมีกำลังใจ'],
      inf: ['🦠 การติดเชื้อ', `${Math.floor(s.infection)}%`, 'เพิ่มเมื่อถูกผู้ติดเชื้อกัด แล้วลุกลามเองเรื่อย ๆ · เกิน 60% สตามิน่าฟื้นช้า เกิน 70% เดินช้า · ถึง 100% จะเสียพลังชีวิตจนตาย · รักษาด้วยยาสมุนไพร ยาปฏิชีวนะ หรือยาต้านไวรัส'],
      happy: ['😊 ความสุข', `${Math.floor(s.happy ?? 50)}/100 · ภูมิคุ้มกัน +${Math.round(35 * g.happyP())}% · สตามิน่า +${Math.floor(20 * g.happyP())}`, `ยิ่งสุขมาก ยิ่งติดเชื้อยากและเชื้อลุกลามช้า ยิ่งกระฉับกระเฉง (สตามิน่าสูงสุดเพิ่ม ฟื้นเร็วขึ้น) · เพิ่มเองทุก ${g.ch.profile?.job === 'freelancer' ? '15 นาที (🧭 ฟรีแลนซ์เก่งด้านนี้ ได้ผลดีขึ้น 25%)' : '1 ชั่วโมง'} ที่เล่น · ${g.happyOk === false ? '⏸ ตอนนี้หยุดนับ เพราะร่างกายผิดปกติ (' + [s.bleeding && 'เลือดออก', s.fracture && 'ขาหัก', s.sprain > 0 && 'ขาแพลง', s.infection >= 1 && 'ติดเชื้อ', s.sick > 0 && 'ป่วย', s.hunger <= 30 && 'หิว', s.thirst <= 30 && 'กระหายน้ำ', (s.stress || 0) >= 60 && 'เครียด'].filter(Boolean).join(' ') + ')' : 'จะไม่เพิ่มถ้าเลือดออก ขาหัก/แพลง ติดเชื้อ ป่วย หิว กระหาย หรือเครียด'} · อีก ${Math.max(0, Math.ceil(((g.ch.profile?.job === 'freelancer' ? 900 : 3600) - (s.happyT || 0)) / 60))} นาทีจะเพิ่ม 1 แต้ม`],
      stress: ['😰 ความเครียด/ตื่นตระหนก', `${Math.floor(s.stress || 0)}/100`, 'เพิ่มเมื่อมีผู้ติดเชื้อใกล้ กลางคืน หิว เจ็บ · 60+ สตามิน่าฟื้นช้า · 85+ ดาเมจลด · ลดได้ด้วยการพักในที่พัก/ใกล้กองไฟ อยู่กับเพื่อนหรือสัตว์เลี้ยง ฟังดนตรี สวดมนต์ หรือกินของอร่อย'],
    }[k];
    if (!H) return;
    h.innerHTML = `<b>${H[0]}</b> — ${H[1]}<br><small>${H[2]}</small><br><small class="hint">คลิกอีกครั้งเพื่อปิด (ปิดเองใน 10 วินาที)</small>`; h.style.display = 'block'; this.layoutHud(); clearTimeout(this.helpT); this.helpT = setTimeout(() => { h.style.display = 'none'; }, 10000);
  }
  flashHurt() { const v = $('#vignette'); v.style.opacity = 0.7; setTimeout(() => (v.style.opacity = 0), 180); }
  setPrompt(t) { const p = $('#prompt'); if (p._t !== t) { p._t = t; p.innerHTML = t || ''; p.style.display = t ? 'block' : 'none'; } }

  // ---------- HUD ----------
  // จัดกล่องด้านซ้ายไม่ให้ซ้อนกัน: ภารกิจอยู่ใต้แผงสถานะเสมอ · คำอธิบายค่าสถานะอยู่ใต้ป้ายสถานะ
  layoutHud() {
    const hud = $('#hud').getBoundingClientRect(), lc = $('#leftcol'), st = $('#status').getBoundingClientRect(), h = $('#stat-help');
    const top = Math.round(hud.bottom + 8); if (lc._top !== top) { lc._top = top; lc.style.top = top + 'px'; }
    if (h.style.display === 'block') { h.style.left = Math.round(st.left) + 'px'; h.style.top = Math.round((st.height ? st.bottom : hud.top) + 6) + 'px'; }
  }
  update(dt) {
    this.hudT -= dt; if (this.hudT > 0) return; this.hudT = 0.15;
    this.layoutHud();
    const g = this.g, s = g.stats;
    // ⚠️ ใกล้ตาย: พลังชีวิตต่ำกว่า 25% → ขอบจอกระพริบแดง + เตือนครั้งเดียว
    const low = !g.dead && s.hp > 0 && s.hp < Math.max(15, g.maxHp() * 0.25);
    if (low !== this.lowHp) {
      this.lowHp = low; $('#vignette').classList.toggle('danger', low);
      if (low) { this.toast('⚠️ พลังชีวิตใกล้หมด! รีบหนี รักษาแผล กินอาหาร หรือหาที่ปลอดภัย', 'warn'); g.sfx?.play('hurt'); }
    }
    const bar = (id, v, max = 100) => { const el = $(id); el.style.width = Math.max(0, (v / max) * 100) + '%'; };
    bar('#b-hp', s.hp, g.maxHp()); bar('#b-food', s.hunger); bar('#b-water', s.thirst); bar('#b-stam', s.stamina, g.maxStamina()); bar('#b-inf', s.infection); bar('#b-stress', s.stress || 0);
    $('#v-hp').textContent = Math.ceil(s.hp); $('#v-food').textContent = Math.ceil(s.hunger); $('#v-water').textContent = Math.ceil(s.thirst); $('#v-inf').textContent = Math.floor(s.infection) + '%'; $('#v-stress').textContent = Math.floor(s.stress || 0);
    $('#v-coin').textContent = g.inv.jicoin || 0;
    bar('#b-happy', s.happy ?? 50); $('#v-happy').textContent = `${Math.floor(s.happy ?? 50)}${g.happyOk === false ? ' ⏸' : ''}`;
    $('#hand-btn').textContent = `${g.lefty ? '🫲 มือซ้าย' : '🫱 มือขวา'}${g.lefty === (g.profile.hand === 'l') ? ' ⭐' : ''} ↔`;
    const chips = [];
    if (s.bleeding) chips.push('<span class="chip red">🩸 เลือดออก</span>');
    if (s.fracture) chips.push('<span class="chip red">🦴 ขาหัก (วิ่งไม่ได้)</span>');
    else if (s.sprain > 0) chips.push(`<span class="chip orange">🦶 ขาแพลง ${Math.ceil(s.sprain)} วิ</span>`);
    if (g.stance) chips.push(`<span class="chip">${g.stance === 1 ? '🧎 ย่อตัว' : '🐛 คลาน'} · ซ่อนตัว ${Math.round((1 - g.stealthMul()) * 100)}%</span>`);
    if ((s.stress || 0) >= 60) chips.push(`<span class="chip orange">${s.stress >= 85 ? '😱 เครียดหนัก' : '😰 เครียด'}</span>`);
    if (g.immuneT > 0) chips.push(`<span class="chip green">💉 ภูมิคุ้มกัน ${Math.ceil(g.immuneT)} วิ</span>`);
    if (g.wellFed > 0) chips.push(`<span class="chip">😋 อิ่มเอม</span>`);
    if (g.moraleT > 0) chips.push(`<span class="chip green">💪 กำลังใจ ${Math.ceil(g.moraleT)} วิ</span>`);
    if (g.hideT > 0) chips.push(`<span class="chip">🙏 พลังเมตตา ${Math.ceil(g.hideT)} วิ</span>`);
    if (g.droneT > 0) chips.push(`<span class="chip">🛸 โดรน ${Math.ceil(g.droneT)} วิ</span>`);
    if (s.infection >= 1) chips.push(`<span class="chip green">🦠 ติดเชื้อ ${s.infection > 60 ? 'รุนแรง' : ''}</span>`);
    if (s.sick > 0) chips.push('<span class="chip yellow">🤢 อาหารเป็นพิษ</span>');
    if (g.social.preg[g.id]) chips.push(`<span class="chip pink">🤰 ตั้งครรภ์ ${Math.floor(Math.min(1, (Date.now() - g.social.preg[g.id].start) / g.const.PREG_MS) * 100)}%</span>`);
    if (g.social.lovedNearby()) chips.push('<span class="chip pink">💞 มีกำลังใจ</span>');
    if (g.nearFire) chips.push('<span class="chip orange">🔥 อบอุ่น</span>');
    if (g.weather.rain) chips.push('<span class="chip blue">🌧️ ฝนตก</span>');
    if (g.weather.snow) chips.push('<span class="chip blue">❄️ หิมะตก</span>');
    if (g.weather.fog >= 0.35) chips.push(`<span class="chip">🌫️ ${fogName(g.weather.fog)}</span>`);
    const tp = s.temp ?? 37; chips.push(`<span class="chip ${tp < 36.2 ? 'blue' : tp > 38.6 ? 'orange' : ''}">${tp < 35 ? '🧊' : tp < 36.2 ? '🥶' : tp > 38.6 ? '🥵' : '🌡️'} ${tp.toFixed(1)}°C</span>`);
    if ((s.wet || 0) >= 20) chips.push(`<span class="chip blue">💧 เปียก ${Math.round(s.wet)}%</span>`);
    if (g.shelter || g.inCampNow) chips.push(`<span class="chip green">🏠 ${g.shelter?.kind === 'pav' ? 'ในศาลา' : 'ในที่พัก'}${g.hearthNear ? ' · 🔥 เตาผิง' : ''}</span>`);
    $('#status').innerHTML = chips.join('');
    const qh = g.quest.trackerHTML(), qel = $('#quest');
    this.drawSideQuest(); this.drawPartyHud();
    const qh2 = qh + (qh ? `<div class="qtoggle">${g.navOn ? '🧭 ลูกศรนำทาง: เปิด (แตะเพื่อปิด)' : '🧭 แตะเพื่อเปิดลูกศรนำทาง'}</div>` : '');
    if (qel._h !== qh2) { qel._h = qh2; qel.innerHTML = qh2; qel.hidden = !qh; }
    const tod = g.timeOfDay(), hh = Math.floor(tod * 24), mm = Math.floor((tod * 24 - hh) * 60);
    $('#clock').innerHTML = `วันที่ <b>${g.dayNum()}</b> ของการล่มสลาย · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${g.isNight() ? '🌙' : '☀️'}<br><small>เลเวล ${g.charLevel()} · ${esc(g.areaName())} · 🎒 <span class="${g.overloaded() ? 'miss' : ''}">${g.usedSlots()}/${g.maxSlots()}</span> · ${g.net.online ? '🟢 ออนไลน์ ' + (g.ents.remotes.size + 1) + ' คน' : '⚪ ออฟไลน์'}</small>`;
    // hotbar (ของที่หมดแล้วเอาออกจากช่องลัดอัตโนมัติ)
    for (let i = 0; i < g.hotbar.length; i++) { const k = g.hotbar[i]; if (k && !(g.inv[k] > 0) && g.equipped !== k) g.hotbar[i] = null; }
    $('#hotbar').innerHTML = g.hotbar.map((k, i) => {
      const it = k && ITEMS[k], q = k ? g.inv[k] || 0 : 0;
      return `<div class="slot ${k && g.equipped === k ? 'eq' : ''} ${k && !q ? 'empty' : ''}" data-slot="${i}" data-drop="hb:${i}"><span class="n">${i + 1}</span>${it ? `${it.icon}<span class="q">${q}</span>` : ''}</div>`;
    }).join('');
    this.drawMinimap();
    if (this.open === 'panel' && this.tab === 'struct') { this.structT = (this.structT || 0) + 0.15; if (this.structT > 1 && document.activeElement?.tagName !== 'INPUT') { this.structT = 0; this.refreshPanels(); } }
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
    // อุปกรณ์ไอที: มือถือ = เห็นกล่องเสบียง · เรดาร์ = เห็นผู้ติดเชื้อ · โดรน = เห็นทุกอย่าง (IT Lv4 ระยะ ×2)
    const rng = (hasPerk(g.ch, 'it', 1) ? 2 : 1), drone = g.droneT > 0;
    const lootR = Math.max(sniff ? 60 : 0, g.hasItem('phone') ? ITEMS.phone.device.loot * rng : 0, drone ? 150 * rng : 0);
    if (lootR) for (const l of g.world.nearLoot(P.x, P.z, lootR)) dot(l.x, l.z, '#c08552', 2);
    const zr = Math.max(g.hasItem('zradar') ? ITEMS.zradar.device.zombie * rng : 0, drone ? 150 * rng : 0);
    if (zr) for (const e of g.ents.list) if (!e.dead && e.kind === 'zombie' && e.pos.distanceTo(P) < zr) dot(e.pos.x, e.pos.z, e.T?.boss ? '#ff006e' : '#e63946', e.T?.boss ? 4 : 2);
    if (drone) for (const e of g.ents.list) if (!e.dead && (e.kind === 'animal' || e.kind === 'stray') && e.pos.distanceTo(P) < 150 * rng) dot(e.pos.x, e.pos.z, '#80ed99', 2);
    if (hasPerk(g.ch, 'it', 2) && g.bossAt) { let [a, b] = toM(g.bossAt.x, g.bossAt.z); const dx = a - S / 2, dy = b - S / 2, L = Math.hypot(dx, dy), R = S / 2 - 10; if (L > R) { a = S / 2 + dx / L * R; b = S / 2 + dy / L * R; } c.font = '14px sans-serif'; c.fillText('👑', a - 7, b + 5); }
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
    const g = this.g, c = cv.getContext('2d'), W = cv.width, H = cv.height, src = g.world.mapCanvas;
    // ซูม/เลื่อนแผนที่: Z = เท่าซูม · มุมมองตามศูนย์กลาง (ค่าเริ่มต้น = ตำแหน่งผู้เล่น)
    const Z = this.mapZoom || 1, WW = WORLD.maxX - WORLD.minX, WH = WORLD.maxZ - WORLD.minZ, vw = WW / Z, vh = WH / Z;
    const C = this.mapCenter || { x: g.player.pos.x, z: g.player.pos.z };
    const vx = Math.min(Math.max(C.x - vw / 2, WORLD.minX), WORLD.maxX - vw), vz = Math.min(Math.max(C.z - vh / 2, WORLD.minZ), WORLD.maxZ - vh);
    this.mapView = { vx, vz, vw, vh, W, H };
    const toMap = (x, z) => [((x - vx) / vw) * W, ((z - vz) / vh) * H];
    c.fillStyle = '#0b3d66'; c.fillRect(0, 0, W, H);
    c.drawImage(src, ((vx - WORLD.minX) / WW) * src.width, ((vz - WORLD.minZ) / WH) * src.height, (vw / WW) * src.width, (vh / WH) * src.height, 0, 0, W, H);
    c.font = `${Math.round(11 + Math.min(6, (Z - 1) * 1.5))}px Sarabun, sans-serif`; c.textAlign = 'center';
    for (const l of g.world.labels) {
      const [x, y] = toMap(l.x, l.z, W, H);
      c.fillStyle = { town: '#fff', island: '#caf0f8', lake: '#bde0fe', mountain: '#d8f3dc', poi: '#ffd166' }[l.kind];
      c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 3; const nm = tr(l.name); c.strokeText(nm, x, y - 4); c.fillText(nm, x, y - 4);
      c.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    const dot = (x, z, col, r) => { const [a, b] = toMap(x, z, W, H); c.fillStyle = col; c.beginPath(); c.arc(a, b, r, 0, 7); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke(); };
    for (const s of g.world.structures) dot(s.x, s.z, '#f4a261', 3);
    // 🗼 หอถังน้ำ
    for (const w of WATER_TOWERS) dot(w.x, w.z, '#4dabf7', 4);
    for (const r of g.ents.remotes.values()) dot(r.pos.x, r.pos.z, g.party?.members?.some((m) => m.id === r.id) ? '#00f5d4' : '#4cc9f0', g.party?.members?.some((m) => m.id === r.id) ? 6 : 4);
    dot(g.player.pos.x, g.player.pos.z, '#ff006e', 5);
    const qt = g.quest.target();
    for (const [x, z, k] of g.boxUI.markers()) { const [a, b] = toMap(x, z, W, H); boxMark(c, a, b, k, 1.2); }
    // ฐานของเรา/ที่เราเป็นสมาชิก
    for (const b of basesOf(g.world.structures, g.id)) { const [a, y] = toMap(b.x, b.z, W, H); c.font = '16px sans-serif'; c.fillText('🏡', a, y + 6); c.font = 'bold 12px Sarabun, sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeText(b.name, a, y - 10); c.fillText(b.name, a, y - 10); }
    for (const f of g.friends || []) if (f.online && f.x !== null) { const [a, b] = toMap(f.x, f.z, W, H); c.fillStyle = '#06d6a0'; c.beginPath(); c.arc(a, b, 5, 0, 7); c.fill(); c.font = 'bold 12px sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeText(f.name, a + 7, b + 4); c.fillText(f.name, a + 7, b + 4); }
    if (qt) { const [a, b] = toMap(qt.x, qt.z, W, H); c.fillStyle = '#ffd60a'; c.strokeStyle = '#000'; c.lineWidth = 1.5; star(c, a, b, 8); c.fill(); c.stroke(); }
  }

  // ---------- แผงเมนู ----------
  // จำนวนต่อคลิกเวลาฝาก/ถอนของ (แบ่งของที่ซ้อนกันหรือเงินจิเป็นส่วน ๆ)
  qtyBar() {
    const q = this.stQty || 1;
    return `<div class="seg qbar">จำนวนต่อคลิก: ${[1, 5, 10, 50].map((n) => `<button data-stq="${n}" class="${q === n ? 'on' : ''}">${n}</button>`).join('')}<button data-stq="all" class="${q === 'all' ? 'on' : ''}">ทั้งหมด</button> <input type="number" class="qty" id="st-q" min="1" max="99999" value="${q === 'all' ? '' : q}" placeholder="กำหนดเอง"> <small class="hint">คลิก = ตามจำนวนนี้ · คลิกขวา = ทั้งหมด</small></div>`;
  }
  stAmt(have) { const q = this.stQty || 1; return Math.max(0, q === 'all' ? have : Math.min(have, q)); }
  openForge() { if (!(this.open === 'panel' && this.tab === 'forge')) { this.closeAll(); this.person = null; this.tab = 'forge'; this.open = 'panel'; $('#panel').style.display = 'block'; document.exitPointerLock?.(); } this.refreshPanels(); }
  // ⚒️ หน้าตีบวก + ส่องออฟชั่น
  forgeHTML() {
    const g = this.g, P = g.player.pos, smith = hasPerk(g.ch, 'blacksmith', 0), anvilAny = g.world.nearStructure(P.x, P.z, 'anvil', 6), anvil = smith && anvilAny, friendOk = !smith && anvilAny && g.auth.server;
    const npc = NPCS.find((n) => n.job === 'blacksmith'), ne = g.ents.list.find((e) => e.kind === 'npc' && e.def?.id === npc?.id), viaNpc = !anvil && ne && Math.hypot(ne.pos.x - P.x, ne.pos.z - P.z) <= 7;
    const where = friendOk ? '⚒️ ข้างทั่งตีเหล็ก — ถ้ามีเพื่อนช่างตีเหล็กยืนอยู่ใกล้ (6 ม.) เพื่อนจะตีให้ด้วยฝีมือของเพื่อน (ไม่เสียค่าจ้าง)' : anvil ? '⚒️ ตีบวกเองที่ทั่งตีเหล็ก (ไม่เสียค่าจ้าง' + (hasPerk(g.ch, 'blacksmith', 1) ? ' · โอกาสสำเร็จ +8%' : '') + ')' : viaNpc ? `🧑‍🏭 จ้าง${npc.name}ตีบวก — จ่ายค่าจ้างเป็นเงินจิอย่างเดียว ไม่ต้องเตรียมหินไป` : `🔨 ตีบวกเอง (ทำได้ทุกที่ ใช้หินของคุณ) — <span class="miss">โอกาสสำเร็จต่ำกว่าจ้าง NPC ${Math.round(SELF_PENALTY * 100)}%</span> · ได้โอกาสดีกว่า: จ้าง${npc?.name} ที่${TOWNS.find((t) => t.key === npc?.town)?.name || ''} (เตรียมไปแค่ไอเท็ม จ่ายค่าตี+ค่าหินเป็นเงินจิ)${smith ? ' หรือใช้ทั่งตีเหล็กของคุณ' : ' หรือให้ช่างตีเหล็กตีให้ที่ทั่ง'}`;
    const can = true, selfMode = !anvil && !viaNpc, pc = (v) => Math.round(v * 100) + '%';
    const rows = Object.entries(g.inv).filter(([k, q]) => q > 0 && gearKind(k)).map(([k]) => {
      const it = ITEMS[k], pet = gearKind(k) === 'pet', L = parseKey(k).plus, max = pet ? PET_PLUS_MAX : PLUS_MAX, st = enhanceStone(L, pet), sst = enhanceStone(L, pet, true), fee = viaNpc ? enhanceFee(L, pet) : 0, R0 = enhanceRates(L, pet, anvil ? g.ch : null), R = selfMode ? shopPenalty(R0, L, pet, SELF_PENALTY) : R0, RS = shopPenalty(R, L, pet), showS = !viaNpc && !pet;
      const held = g.equipped === k && (g.inv[k] || 0) <= 1, base = can && L < max && !held && (g.inv.jicoin || 0) >= fee, okE = base && (viaNpc || (g.inv[st] || 0) > 0), okS = base && showS && (g.inv[sst] || 0) > 0;
      const rate = L >= max ? `<b>ตีบวกสูงสุดแล้ว (+${max})</b>` : `+${L} → +${L + 1}: ✅ ${pc(R.up)}${R.stay ? ` · ➖ คงเดิม ${pc(R.stay)}` : ''}${R.down ? ` · 📉 -1 ${pc(R.down)}` : ''}${R.brk ? ` · <span class="miss">💥 แตกหาย ${pc(R.brk)}</span>` : ''}`;
      return `<div class="recipe ${okE ? 'ready' : ''}"><div><b style="${L >= 6 ? `color:${PLUS_GLOW[Math.min(10, L)]}` : it.rarity ? `color:${RARITY[it.rarity].color}` : ''}">${it.icon} ${esc(it.name)}</b> <small>${pet ? '🐾 อุปกรณ์สัตว์เลี้ยง' : ''}</small>${statText(k) ? `<small class="st">${statText(k)}</small>` : ''}<div class="need">${rate}${L < max ? (viaNpc ? ` · 🪙 ค่าจ้าง ${fee} (รวมค่าวัสดุ ไม่ต้องใช้หิน)` : ` · ใช้ ${ITEMS[st].icon}${ITEMS[st].name} (มี ${g.inv[st] || 0})`) : ''}${held ? ' · <span class="miss">เลิกถือก่อน</span>' : ''}</div></div>
        <button data-enh="${k}" ${okE ? '' : 'disabled'}>⚒️ ตีบวก</button>${showS && (g.inv[sst] || 0) > 0 && L < max ? `<button data-enhs="${k}" ${okS ? '' : 'disabled'} title="ใช้${ITEMS[sst].name}: สำเร็จ ${pc(RS.up)}${RS.stay ? ' · คงเดิม ' + pc(RS.stay) : ''}${RS.down ? ' · -1 ' + pc(RS.down) : ''}${RS.brk ? ' · แตก ' + pc(RS.brk) : ''}">${ITEMS[sst].icon} ใช้หินร้านค้า ${pc(RS.up)} (${g.inv[sst]})</button>` : ''}${pet ? '' : `<button data-ident="${k}" ${(g.inv.magnifier || 0) > 0 && !held ? '' : 'disabled'} title="ใช้แว่นขยาย 1 อัน สุ่มออฟชั่น 1–3 อย่าง">🔍 ส่อง (${g.inv.magnifier || 0})</button>`}</div>`;
    }).join('');
    return `<p>${where}</p><p>มี 🔹 เหล็กพลัส <b>${g.inv.plus_stone || 0}</b> · 💠 หินซุปเปอร์ <b>${g.inv.super_stone || 0}</b> · 🔷 เหล็กพลัสร้านค้า <b>${g.inv.shop_plus_stone || 0}</b> · 🔶 หินซุปเปอร์ร้านค้า <b>${g.inv.shop_super_stone || 0}</b> · 📌 พินสูง <b>${g.inv.pet_pin || 0}</b> · 🔍 แว่นขยาย <b>${g.inv.magnifier || 0}</b> · 🪙 ${g.inv.jicoin || 0}</p>
      <div class="recipes">${rows || '<p class="hint">ไม่มีอาวุธ/ชุด/อุปกรณ์สัตว์เลี้ยงในกระเป๋า (ถอดของที่สวมอยู่ออกก่อนจึงจะตีบวกได้)</p>'}</div>
      <p class="hint">ชุด/อาวุธ +1–+5 ปลอดภัย (ไม่สำเร็จ = คงเดิม) · +6–+8 คงเดิม/+1/-1 · +9–+10 ใช้หินซุปเปอร์ อาจแตกหาย/+1/-1 · อุปกรณ์สัตว์เลี้ยง +1 ปลอดภัย · +2 คงเดิม/+1/-1 · +3 อาจแตกหาย<br>✨ +6 ขึ้นไป: อาวุธเรืองแสง (+10 มีกระแสไฟฟ้า) · ชุดมีนางฟ้าตัวน้อยบินตาม (ยิ่งบวกสูงยิ่งสวย) · 🔍 แว่นขยายซื้อได้ที่ร้านเงินจิ<br>🔷 หินจากร้านเงินจิ: โอกาสสำเร็จต่ำกว่าหินที่ดรอป 30% · จ้างช่างบุญส่ง หรือให้เพื่อนช่างตีเหล็กตีให้ด้วยหินปกติ ได้โอกาสดีกว่า</p>`;
  }
  openTrade() { if (!(this.open === 'panel' && this.tab === 'trade')) { this.closeAll(); this.tab = 'trade'; this.open = 'panel'; $('#panel').style.display = 'block'; document.exitPointerLock?.(); } this.refreshPanels(); }
  // หน้าต่างแลกของกับผู้เล่น
  tradeHTML() {
    const g = this.g, T = g.tradeSt; if (!T) return '<p class="hint">ไม่ได้แลกของกับใครอยู่</p>';
    const list = (o, own) => Object.entries(o || {}).map(([k, q]) => `<span class="item small" ${own ? `data-toff="${k}" title="คลิกเพื่อเอาออก"` : ''}>${ITEMS[k]?.icon || '❔'}<b>×${q}</b></span>`).join('') || '<span class="hint">ยังไม่มี</span>';
    const mine = Object.entries(g.inv).filter(([k, q]) => q > (T.mine?.[k] || 0) && !ITEMS[k].quest && k !== g.equipped && tradeable(k)).map(([k, q]) => `<span class="item small" data-tadd="${k}" title="${esc(ITEMS[k].name)} (มี ${q})">${ITEMS[k].icon}<b>${q - (T.mine?.[k] || 0)}</b></span>`).join('');
    return `<h3>🔄 แลกของกับ ${esc(T.name)}</h3>
      <div class="cols"><div><h4>ของที่คุณให้ ${T.okMine ? '✅' : ''}</h4><div class="gifts">${list(T.mine, true)}</div></div><div><h4>ของที่คุณได้ ${T.okTheirs ? '✅' : ''}</h4><div class="gifts">${list(T.theirs)}</div></div></div>
      <div class="acts"><button data-tok="1" class="${T.okMine ? 'on' : ''}">${T.okMine ? '⏳ รออีกฝ่ายยืนยัน' : '✅ ยืนยันการแลก'}</button><button data-tcancel="1">✖ ยกเลิก</button></div>
      <h4>🎒 กระเป๋าของคุณ (คลิกเพื่อใส่ของที่จะให้)</h4><div class="gifts">${mine || '<span class="hint">ไม่มีของ</span>'}</div>
      <p class="hint">🚫 ${TRADE_RULE}</p>
      <p class="hint">ถ้ามีใครแก้ของที่เสนอ ทั้งสองฝ่ายต้องกดยืนยันใหม่ · ของจะสลับกันพร้อมกันเมื่อยืนยันครบทั้งคู่</p>`;
  }
  togglePanel(tab) {
    this.g.sfx?.play('click');
    if (this.open === 'panel' && this.tab === tab) return this.closeAll();
    this.closeAll(); this.tab = tab; this.open = 'panel';
    $('#panel').style.display = 'block'; document.exitPointerLock?.();
    this.refreshPanels();
  }
  closeAll() { this.dropMode = false; this.salvMode = false; this.open = null; this.person = null; this.struct = null; $('#panel').style.display = 'none'; }
  openStructure(s) { this.closeAll(); this.struct = s; this.tab = 'struct'; this.open = 'panel'; $('#panel').style.display = 'block'; document.exitPointerLock?.(); this.refreshPanels(); }

  buildHTML() {
    const g = this.g, lvl = skillLevel(g.skills.building), hammer = canBuild(g.inv);
    const cats = {};
    for (const [k, p] of Object.entries(PIECES)) if (!p.hidden) (cats[p.cat] ||= []).push([k, p]);
    const card = ([k, p]) => {
      const miss = Object.entries(p.cost).filter(([i, q]) => (g.inv[i] || 0) < q), lock = lvl < p.lvl;
      const cc = coinCost(p, ITEMS), coinOnly = !!p.cost.jicoin || p.noCoin;
      return `<div class="pwrap"><button class="piece ${miss.length || lock || !hammer ? 'dis' : ''}" data-build="${k}"><span class="ic">${p.icon}</span><b>${esc(p.name)}</b><small>${Object.entries(p.cost).map(([i, q]) => `<span class="${(g.inv[i] || 0) >= q ? 'have' : 'miss'}">${ITEMS[i].icon}${g.inv[i] || 0}/${q}</span>`).join(' ')}${lock ? ` · 🔒 ก่อสร้าง Lv${p.lvl}` : ''}</small></button>${coinOnly ? '' : `<button class="coinbuy ${(g.inv.jicoin || 0) >= cc && !lock && hammer ? '' : 'dis'}" data-cbuild="${k}" title="ซื้อด้วยเงินจิแทนวัสดุ">🪙 ${cc}</button>`}</div>`;
    };
    return `<p class="hint">${hammer ? '' : '<b class="miss">ต้องมีค้อนก่อน — ประดิษฐ์ 🪵 ค้อนไม้ ได้จากรายการด้านล่างของหน้านี้</b><br>'}สร้างบ้านทีละชิ้นบนกริด: วาง <b>ฐานราก</b> → <b>ผนัง/ประตู/หน้าต่าง</b> รอบขอบ → <b>หลังคา</b> (ขึ้นไปยืนบนหลังคาแล้ววางผนังต่อเป็นชั้นสองได้) · วาง <b>เตียง</b> เพื่อตั้งเป็นจุดเกิด
      <br>${g.touch ? '✅ วาง · ↻ หมุน · 🗑 รื้อ · ✖ ออก' : 'คลิกซ้าย = วาง · Q = หมุน · X = โหมดรื้อ · L = ล็อกประตู/หีบ · Esc = ออก'} · ทักษะก่อสร้าง Lv${lvl}</p>
      ${Object.entries(cats).map(([c, list]) => `<h4>${esc(c)}</h4><div class="pieces">${list.map(card).join('')}</div>`).join('')}
      <div class="acts"><button data-demolish="1" ${hammer ? '' : 'class="dis"'}>🗑️ โหมดรื้อ (ได้วัสดุคืนครบ)</button></div>
      ${this.buildCraftHTML()}
      <p class="hint">🚲 จักรยาน 🏍️ มอเตอร์ไซค์ 🛶 แพ และ 🎣 เบ็ดตกปลา ประดิษฐ์ได้ในแท็บกระเป๋า · ทุกอย่างที่สร้างจะเห็นร่วมกันเมื่อเล่นออนไลน์</p>`;
  }
  // ร้านซื้อส่วนประกอบฐานด้วยเงินจิ + เปลี่ยนสี/ชื่อฐาน
  baseShopHTML() {
    const g = this.g, coins = g.inv.jicoin || 0, lvl = skillLevel(g.skills.building), hammer = canBuild(g.inv);
    const CATS2 = ['โครงบ้าน', 'รั้ว', 'ฐาน', 'ของในบ้าน', 'ระบบน้ำ'];
    const groups = CATS2.map((c) => [c, Object.entries(PIECES).filter(([, p]) => p.cat === c && !p.hidden && !p.noCoin)]);
    const card = ([k, p]) => { const cc = coinCost(p, ITEMS), ok = coins >= cc && lvl >= p.lvl && hammer; return `<button class="piece ${ok ? '' : 'dis'}" data-cbuild="${k}"><span class="ic">${p.icon}</span><b>${esc(p.name)}</b><small><span class="${coins >= cc ? 'have' : 'miss'}">🪙 ${cc}</span>${lvl < p.lvl ? ` · 🔒 ก่อสร้าง Lv${p.lvl}` : ''}</small></button>`; };
    const mine = basesOf(g.world.structures, g.id).filter((b) => ['owner', 'deputy'].includes(roleIn(b, g.id)));
    const colors = mine.map((b) => `<h4>🎨 สีฐาน "${esc(b.name)}" <small>(เปลี่ยนครั้งละ 🪙 ${COLOR_COST} · ผนัง พื้น หลังคา รั้ว ประตู และป้ายในรั้วเปลี่ยนสีตาม)</small></h4>
      <div class="seg">${BASE_COLORS.map((c) => `<button class="sw ${b.col === c ? 'on' : ''}" data-bcol="${b.id}" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>
      <p><button data-bname="${b.id}">🪧 เปลี่ยนชื่อฐาน (ฟรี)</button></p>`).join('');
    return `<p>🪙 คุณมี <b>${coins}</b> เงินจิ · ซื้อชิ้นส่วนฐานด้วยเงินจิได้โดยไม่ต้องหาวัสดุ (ยังต้องมีค้อน${hammer ? ' ✅' : ' ❌'}) — กดเลือกแล้ววางเหมือนสร้างปกติ · รื้อแล้วได้เงินจิคืน</p>
      ${groups.map(([c, list]) => `<h4>${esc(c)}</h4><div class="pieces">${list.map(card).join('')}</div>`).join('')}
      <h4>🪵 ล้อมรั้วสำเร็จรูป <small>(ล้อมรอบตัวคุณทันที · ไม่ต้องวางทีละชิ้น · ข้ามช่องที่มีรั้วอยู่แล้ว)</small></h4>
      <div class="ringbox">ขนาด <select id="ring-n">${Array.from({ length: RING_MAX - RING_MIN + 1 }, (_, i) => i + RING_MIN).map((n) => `<option value="${n}" ${n === (this.ringN || 6) ? 'selected' : ''}>${n}×${n} ช่อง (${n * 3}×${n * 3} ม.ในเกม)</option>`).join('')}</select>
        ประตูเข้าออก <select id="ring-g">${[1, 2, 3, 4].map((k) => `<option value="${k}" ${k === (this.ringG || 1) ? 'selected' : ''}>${k} ทาง</option>`).join('')}</select>
        <b class="${coins >= fenceRingPrice(this.ringN || 6, this.ringG || 1, ITEMS) ? 'have' : 'miss'}">🪙 ${fenceRingPrice(this.ringN || 6, this.ringG || 1, ITEMS)}</b>
        <button data-ring="1" ${hammer && coins >= fenceRingPrice(this.ringN || 6, this.ringG || 1, ITEMS) ? '' : 'disabled'}>ล้อมรั้วตรงนี้</button></div>
      <h4>🛒 ของพิเศษ</h4><div class="recipes">${COIN_GOODS.map(([k, c]) => `<div class="recipe ${coins >= c ? 'ready' : 'dis'}"><div><b>${ITEMS[k].icon} ${esc(ITEMS[k].name)}</b> <small>มี ${g.inv[k] || 0}</small><small class="st">${esc(ITEMS[k].desc || '')}</small></div><input type="number" class="qty" id="cq-${k}" min="1" max="99" value="1" title="จำนวน"><button data-coinbuy="${k}" ${coins >= c ? '' : 'disabled'}>🪙 ${c}/ชิ้น</button></div>`).join('')}</div>
      <h4>🏠 บ้านน็อคดาวน์สำเร็จรูป <small>(ตั้งทั้งหลังทันที: ฐานราก ผนัง ประตู หน้าต่าง หลังคา · ประตูหันมาทางคุณ)</small></h4>
      <div class="ringbox">ขนาด <select id="pf-n">${[1, 2, 3].map((n) => `<option value="${n}" ${n === (this.pfN || 1) ? 'selected' : ''}>${n}×${n} ช่อง (${n * n} ห้อง)</option>`).join('')}</select>
        <b class="${coins >= prefabPrice(this.pfN || 1, ITEMS) ? 'have' : 'miss'}">🪙 ${prefabPrice(this.pfN || 1, ITEMS)}</b>
        <button data-prefab="1" ${coins >= prefabPrice(this.pfN || 1, ITEMS) ? '' : 'disabled'}>ตั้งบ้านตรงหน้า</button></div>
      <p class="hint">หันหน้าไปยังที่โล่งแล้วกด — บ้านจะตั้งห่างไปข้างหน้า · ไม่ต้องมีค้อน · รื้อแล้วได้เงินจิคืน · ต่อเติมผนัง/ชั้นบน/ระเบียงเองได้ภายหลัง</p>
      <p class="hint">ราคาเพิ่มตามขนาดพื้นที่และจำนวนประตู · ยืนตรงกลางพื้นที่ที่ต้องการแล้วกด · รั้วล้อมครบทุกด้าน = ซอมบี้ไม่เกิดในรั้ว · รื้อแล้วได้เงินจิคืน</p>
      ${colors || '<p class="hint">🎨 เปลี่ยนสี/ชื่อฐานได้หลังประกาศฐานแล้ว (วาง 🏦 หลักบ้าน → ประกาศเป็นฐาน)</p>'}
      <p class="hint">หาเงินจิได้จาก: กำจัดผู้ติดเชื้อ/สัตว์ร้าย · ภารกิจหลัก · กล่องเสบียง/กล่องภารกิจ/กล่องหายาก · ขายของให้ NPC · แผงขายของหน้าบ้าน · แลกกับผู้เล่น</p>`;
  }
  // ประดิษฐ์ค้อน วัสดุ และของที่ใช้สร้างบ้านได้จากหน้าสร้างบ้านเลย
  buildCraftHTML() {
    const g = this.g, fire = g.nearFire, used = new Set(Object.values(PIECES).flatMap((p) => Object.keys(p.cost)));
    const rows = RECIPES.map((r, i) => ({ r, i })).filter(({ r }) => (ITEMS[r.out].builds || ITEMS[r.out].place || used.has(r.out)) && (!r.job || hasPerk(g.ch, r.job, 0)) && (!(this.craftQ || '').trim() || [r.label, ITEMS[r.out].name, ...Object.keys(r.need).map((k) => ITEMS[k].name)].some((t) => String(t || '').toLowerCase().includes(this.craftQ.trim().toLowerCase())))).map(({ r, i }) => {
      const lock = skillLevel(g.skills[r.skill]) < r.lvl, noSt = !stationOk(g, r, fire), miss = Object.entries(r.need).filter(([k, q]) => (g.inv[k] || 0) < q), ok = !lock && !noSt && !miss.length;
      return `<button class="piece ${ok ? '' : 'dis'}" data-craft="${i}" title="${lock ? `ต้องการ ${SKILLS[r.skill]} Lv${r.lvl}` : noSt ? 'ต้องอยู่' + STATION_TXT[r.station] : ''}"><span class="ic">${ITEMS[r.out].icon}</span><b>${esc(r.label || ITEMS[r.out].name)}${r.qty > 1 ? ' ×' + r.qty : ''}</b><small>${Object.entries(r.need).map(([k, q]) => `<span class="${(g.inv[k] || 0) >= q ? 'have' : 'miss'}">${ITEMS[k].icon}${g.inv[k] || 0}/${q}</span>`).join(' ')}</small></button>`;
    }).join('');
    return `<h4>🧰 ประดิษฐ์ค้อน วัสดุ และของใช้ก่อสร้าง (ไม่ต้องสลับแท็บ)</h4><input id="craft-q" class="craft-q" type="search" placeholder="🔍 ค้นหาสูตร เช่น ค้อน, รั้ว, ไม้" value="${esc(this.craftQ || '')}" autocomplete="off"><div class="pieces">${rows}</div>`;
  }
  structHTML() {
    const g = this.g, s = g.world.structures.find((x) => x.id === this.struct.id) || this.struct, P = pieceInfo(s);
    const { info, acts } = g.home.panel(s); this.structActs = acts;
    let html = `<h3>${P.icon} ${esc(P.name)}</h3><p>${info}</p><div class="acts">${acts.map((a, i) => `<button data-sact="${i}" ${a.dis ? 'class="dis"' : ''}>${esc(a.label)}</button>`).join('')}</div>`;
    if (s.type === 'stall' && (!s.owner || s.owner === g.id)) {
      html += `<h4>🎒 เลือกของที่จะวางขาย (คลิก = ตั้งราคาและจำนวน)</h4><p class="hint">🚫 ${TRADE_RULE}</p><div class="gifts">${Object.entries(g.inv).filter(([k, q]) => q > 0 && !ITEMS[k].quest && k !== 'jicoin' && tradeable(k)).map(([k, q]) => `<span class="item small" data-slist="${k}" title="${esc(ITEMS[k].name)} · มี ${q} · มูลค่าประมาณ ${ITEMS[k].value || 1}">${ITEMS[k].icon}<b>${q}</b></span>`).join('') || '<span class="hint">ไม่มีของ</span>'}</div>`;
    }
    if (s.type === 'basecore' && s.ok && roleIn(s, g.id)) {
      const role = roleIn(s, g.id), boss = role === 'owner' || role === 'deputy', need = HOUSE_UP[(s.lv || 1) + 1], L = HOUSE_LV[s.lv || 1], mine = s.pi?.[g.id] || {};
      if (need) html += `<h4>⬆️ อัปเกรดเป็นระดับ ${(s.lv || 1) + 1} — เติมของให้ครบรายการ (คลิกเพื่อเติม)</h4><div class="gifts">${Object.entries(need).map(([k, n]) => { const have = s.up?.[k] || 0; return `<span class="item small ${have >= n ? '' : 'dis'}" data-bup="${k}" title="${esc(ITEMS[k].name)} ${have}/${n} · คุณมี ${g.inv[k] || 0}">${ITEMS[k].icon}<b>${have}/${n}</b></span>`; }).join('')}</div>`;
      html += this.qtyBar() + `<div class="cols"><div><h4>🔐 คลังของส่วนตัว (${Object.keys(mine).length}/${L.ps} ช่อง · เห็นเฉพาะคุณ)</h4><div class="inv">${Object.entries(mine).map(([k, q]) => `<div class="item" data-pwd="${k}" title="คลิก = หยิบตามจำนวนที่เลือก · คลิกขวา = ทั้งหมด"><span class="ic">${ITEMS[k].icon}</span><span>${ITEMS[k].name}</span><b>×${q}</b></div>`).join('') || '<p class="hint">ว่าง</p>'}</div></div>
        <div><h4>🎒 กระเป๋า → ฝากเข้าคลังส่วนตัว</h4><div class="inv">${Object.entries(g.inv).filter(([k, q]) => q > 0 && !ITEMS[k].quest && k !== 'jicoin').map(([k, q]) => `<div class="item" data-pdep="${k}" title="คลิก = ฝากตามจำนวนที่เลือก · คลิกขวา = ทั้งหมด"><span class="ic">${ITEMS[k].icon}</span><span>${ITEMS[k].name}</span><b>×${q}</b></div>`).join('')}</div></div></div>
        <p class="hint">🧰 คลังส่วนรวมของบ้าน = หีบเก็บของที่วางในรั้ว (สมาชิกทุกคนเปิดได้) · คลังส่วนตัวอยู่ที่หลักบ้านนี้</p>`;
      const mem = Object.entries(s.mem || {});
      html += `<h4>👥 สมาชิกบ้าน (${mem.length + 1}/12)</h4><div class="recipes"><div class="recipe"><div><b>${ROLES.owner}</b> ${s.owner === g.id ? 'คุณ' : 'เจ้าของ'}</div></div>${mem.map(([id, m]) => `<div class="recipe"><div><b>${esc(m.n)}</b> <small>${ROLES[m.r]}</small></div>${boss && (role === 'owner' || m.r !== 'deputy') ? Object.keys(ROLES).filter((r) => r !== 'owner' && (role === 'owner' || r !== 'deputy')).map((r) => `<button data-hrole="${esc(id)}" data-r="${r}" ${m.r === r ? 'disabled' : ''}>${ROLES[r].split(' ')[0]}</button>`).join('') + `<button data-hrole="${esc(id)}" data-r="">✖</button>` : ''}</div>`).join('')}</div>`;
      if (boss) {
        const cands = [...g.ents.remotes.values()].map((r) => [r.id, r.name]).concat((g.friends || []).map((f) => [f.id, f.name])).filter(([id], i, a) => id !== s.owner && !s.mem?.[id] && a.findIndex((x) => x[0] === id) === i);
        html += `<p><b>➕ เพิ่มสมาชิก:</b> ${cands.map(([id, n]) => `<button data-hadd="${esc(id)}" data-n="${esc(n)}">${esc(n)}</button>`).join(' ') || '<span class="hint">ไม่มีผู้เล่น/เพื่อนออนไลน์ใกล้ ๆ</span>'}</p>`;
      }
    }
    if (s.type === 'storage') {
      const inside = Object.entries(s.items || {}).filter(([, q]) => q > 0);
      html += this.qtyBar() + `<div class="cols"><div><h4>🧰 ในหีบ</h4><div class="inv">${inside.map(([k, q]) => `<div class="item" data-wd="${k}" title="คลิก = หยิบตามจำนวนที่เลือก · คลิกขวา = หยิบทั้งหมด"><span class="ic">${ITEMS[k].icon}</span><span>${ITEMS[k].name}</span><b>×${q}</b></div>`).join('') || '<p class="hint">ว่าง</p>'}</div></div>
        <div><h4>🎒 กระเป๋าของคุณ</h4><div class="inv">${Object.entries(g.inv).filter(([k, q]) => q > 0 && !ITEMS[k].quest).map(([k, q]) => `<div class="item" data-dep="${k}" title="คลิก = ฝากตามจำนวนที่เลือก · คลิกขวา = ฝากทั้งหมด"><span class="ic">${ITEMS[k].icon}</span><span>${ITEMS[k].name}</span><b>×${q}</b></div>`).join('')}</div></div></div>`;
    }
    return html;
  }

  refreshPanels() {
    if (this.open !== 'panel') return;
    const tabs = [['inv', '🎒 กระเป๋า & ประดิษฐ์ [Tab]'], ['build', '🔨 สร้างบ้าน [B]'], ['bshop', '🪙 ร้านเงินจิ'], ['equip', '🛡️ อุปกรณ์ [I]'], ['char', '🧍 ตัวละคร [K]'], ['rel', '💞 ความสัมพันธ์ [R]'], ['pets', '🐾 สัตว์เลี้ยง [P]'], ['map', '🗺️ แผนที่ [M]'], ['quest', '📜 ภารกิจ [Q]'], ['guide', '📖 คู่มือ']];
    if (this.tab === 'forge') tabs.splice(1, 0, ['forge', '⚒️ ตีบวก']);
    let html = `<div class="tabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${this.tab === k ? 'on' : ''}">${n}</button>`).join('')}<button data-close="1" class="x">✕</button></div><div class="body">`;
    if (this.person) html += this.personHTML();
    else if (this.tab === 'inv') html += this.invHTML();
    else if (this.tab === 'char') html += this.charHTML();
    else if (this.tab === 'equip') html += this.equipHTML();
    else if (this.tab === 'rel') html += this.relHTML();
    else if (this.tab === 'quest') html += this.questHTML();
    else if (this.tab === 'pets') html += this.petsHTML();
    else if (this.tab === 'build') html += this.buildHTML();
    else if (this.tab === 'bshop') html += this.baseShopHTML();
    else if (this.tab === 'forge') html += this.forgeHTML();
    else if (this.tab === 'struct' && this.struct) html += this.structHTML();
    else if (this.tab === 'trade') html += this.tradeHTML();
    else if (this.tab === 'map') html += `<div class="mapbar"><button data-mz="1">➕ ซูมเข้า</button><button data-mz="-1">➖ ซูมออก</button><button data-mz="0">📍 กลับมาที่ฉัน</button><span class="hint">ซูม ×${(this.mapZoom || 1).toFixed(1)} · หมุนล้อเมาส์/หยิกสองนิ้วเพื่อซูม · ลากเพื่อเลื่อน</span></div><canvas id="bigmap" width="${Math.round(700 * (WORLD.maxX - WORLD.minX) / (WORLD.maxZ - WORLD.minZ))}" height="700" style="max-width:100%;height:auto"></canvas><p class="hint">🟣 คุณ · 🔵 เพื่อน · 🟠 ที่พัก/กองไฟ · 🟢 เพื่อน · ⭐ เป้าหมายภารกิจ · 🟦 กล่องภารกิจ (🔒 แดง = ยังล็อก, เขียว = เปิดได้) · 💜 กล่องหายาก — แผนที่สร้างจากพิกัดจริงของจังหวัดชลบุรี</p>`;
    $('#panel').innerHTML = html + '</div>';
    if (this.tab === 'map') this.drawBigMap();
  }

  // 📜 หน้าภารกิจ (กด Q): ภารกิจหลัก + ภารกิจสุ่ม
  questHTML() {
    const g = this.g, q = g.sq, qh = g.quest.trackerHTML();
    let h = `<h4>📜 ภารกิจหลัก</h4><div class="hint">${qh || '<small>ทำภารกิจหลักจบแล้ว — ค่ายกักกันเป็นเขตปลอดภัยของคุณ</small>'}</div><h4>🎲 ภารกิจสุ่ม</h4>`;
    const day = Math.floor(g.now() / 86400000), done = g.boxes?.sqd === day ? g.boxes.sqc || 0 : 0;
    h += `<p><small>วันนี้ทำสำเร็จแล้ว ${done}/${SQ_DAILY} ครั้ง</small></p>`;
    if (!q || q.exp < g.now()) h += '<button data-sqt="1">🟢 ง่าย</button> <button data-sqt="2">🟡 ปานกลาง (รางวัล ×2)</button> <button data-sqt="3">🔴 ยาก (รางวัล ×3.5)</button>';
    else {
      const [a, b] = sqProgress(g.ch, q, g.player.pos), left = Math.max(0, Math.ceil((q.exp - g.now()) / 60000));
      h += `<p><small>เหลือ ${left} นาที · รางวัล 🪙 ${q.coin}</small><br><b>${esc(sqText(q))}</b> <small>(${a}/${b})</small></p><button data-sq="done" ${a >= b ? '' : 'disabled'}>✅ ส่งภารกิจ</button> <button data-sq="drop">✖ ยกเลิก</button>`;
    }
    return h;
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
      const tag = it.ammo ? (g.ammoPref?.[it.ammo.g] === k ? 'เลือกอยู่' : 'เลือกยิง') : it.tool ? (g.equipped === k ? 'ถืออยู่' : 'ถือ') : it.instrument ? 'เล่น' : it.food ? 'กิน' : it.med || it.box ? 'ใช้' : it.place ? 'วาง' : it.wear ? 'สวม' : it.petGear ? 'ให้สัตว์' : '';
      return `<div class="item" data-item="${k}" data-drag="item:${k}" title="คลิก = ${tag || 'ดู'} · ลากไปวางที่ช่องลัด 1–6 · คลิกขวา = เมนู (ปักช่องลัด / ♻️ ย่อย)"><span class="ic">${it.icon}</span><span ${it.plus >= 6 ? `style="color:${PLUS_GLOW[Math.min(10, it.plus)]};text-shadow:0 0 6px ${PLUS_GLOW[Math.min(10, it.plus)]}"` : it.rarity ? `style="color:${RARITY[it.rarity].color}"` : ''}>${it.name}${it.bonus ? ` <small>(${it.bonus})</small>` : ''}${statText(k) ? `<small class="st">${statText(k)}</small>` : ''}</span><b>×${q}</b>${tag ? `<em>${tag}</em>` : ''}${g.hotbar.includes(k) ? '<i>📌</i>' : ''}</div>`;
    }).join('') : '<p class="hint">กระเป๋าว่างเปล่า — ลองเก็บไม้ หิน หญ้า หรือค้นกล่องเสบียงในเมือง</p>';
    const fire = g.nearFire;
    const myJob = g.profile.job;
    const all = RECIPES.map((r, i) => ({ r, i })).filter(({ r }) => !r.job || hasPerk(g.ch, r.job, 0)).map(({ r, i }) => {
      const lvl = skillLevel(g.skills[r.skill]);
      const missing = Object.entries(r.need).filter(([k, q]) => (g.inv[k] || 0) < q);
      const lock = lvl < r.lvl || (r.learn && !g.boxes?.['learn_' + r.learn]), noSt = !stationOk(g, r, fire);
      return { r, i, missing, lock, noSt, ok: !lock && !missing.length && !noSt };
    });
    const rc = this.rcat || 'all', inCat = all.filter((x) => rc === 'all' || catOf(x.r.out) === rc);
    const rcount = { all: all.length }; for (const x of all) rcount[catOf(x.r.out)] = (rcount[catOf(x.r.out)] || 0) + 1;
    const nReady = inCat.filter((x) => x.ok).length, f = this.rfilter || 'all';
    const q = (this.craftQ || '').trim().toLowerCase(), hit = (x) => !q || [x.r.label, ITEMS[x.r.out].name, x.r.out, ...Object.keys(x.r.need).map((k) => ITEMS[k].name)].some((t) => String(t || '').toLowerCase().includes(q));
    const shown = inCat.filter((x) => (f === 'all' || (f === 'ready') === x.ok) && hit(x)).sort((a, b) => b.ok - a.ok);
    const fbar = `<div class="rfilter">${[['all', `📋 ทั้งหมด ${inCat.length}`], ['ready', `✅ พร้อมคราฟท์ ${nReady}`], ['miss', `⏳ ยังไม่ครบ ${inCat.length - nReady}`]].map(([k, n]) => `<button data-rfilter="${k}" class="${f === k ? 'on' : ''}">${n}</button>`).join('')}</div><input id="craft-q" class="craft-q" type="search" placeholder="🔍 ค้นหาสูตร เช่น ลูกธนู, ดาบ, ไม้" value="${esc(this.craftQ || '')}" autocomplete="off">`;
    const rec = (shown.length ? '' : `<p class="hint">${q ? `ไม่พบสูตรที่ตรงกับ "${esc(q)}"` : f === 'ready' ? 'ยังไม่มีสูตรที่วัตถุดิบครบ — ลองเก็บของเพิ่ม' : 'คราฟท์ได้ครบทุกสูตรแล้ว!'}</p>`) + shown.map(({ r, i, missing, lock, noSt, ok }) => {
      const need = Object.entries(r.need).map(([k, q]) => `<span class="${(g.inv[k] || 0) >= q ? 'have' : 'miss'}">${ITEMS[k].icon}${ITEMS[k].name} ${g.inv[k] || 0}/${q}</span>`).join(' ');
      return `<div class="recipe ${ok ? 'ready' : 'dis'}"><div><b>${ok ? '✅' : '⏳'} ${ITEMS[r.out].icon} ${r.label || ITEMS[r.out].name}</b>${r.job ? ` <span class="chip jobchip">${JOBS[r.job].icon} ขั้นสูง</span>` : ''} <small>${SKILLS[r.skill]} Lv${r.lvl}${r.station ? ' · ' + STATION_TXT[r.station] : ''}</small>${statText(r.out) ? `<small class="st">${statText(r.out)}</small>` : ''}<div class="need">${need}</div>${lock && r.learn && !g.boxes?.['learn_' + r.learn] ? '<small class="miss">🔒 ต้องเรียนงานจักสานกับยายแวว (ตลาดจักสานพนัสนิคม) หรืออ่านคู่มือหัตถกรรมจักสาน</small>' : lock ? `<small class="miss">🔒 ต้องการ ${SKILLS[r.skill]} Lv${r.lvl}</small>` : noSt ? `<small class="miss">ต้องอยู่${STATION_TXT[r.station]}</small>` : ''}</div><button data-craft="${i}" ${ok ? '' : 'disabled'}>ประดิษฐ์</button></div>`;
    }).join('');
    return `<div class="cols"><div><h3>กระเป๋า <small class="${g.overloaded() ? 'miss' : ''}">${g.usedSlots()}/${g.maxSlots()} ช่อง${g.wear.back ? ` · ${ITEMS[g.wear.back].name}` : ' · ยังไม่มีกระเป๋า'}</small> <button data-dropmode="1" class="${this.dropMode ? 'on' : ''}">${this.dropMode ? '✋ เลิกทิ้งของ' : '🗑️ ทิ้งของ'}</button> <button data-salvmode="1" class="${this.salvMode ? 'on' : ''}">${this.salvMode ? '✋ เลิกย่อย' : '♻️ ย่อยของ'}</button></h3>${catBar(ic, icount, 'icat')}<div class="inv ${this.dropMode ? 'dropping' : ''}">${inv}</div><p class="hint">${this.dropMode ? '<b class="miss">โหมดทิ้งของ: คลิกที่ไอเท็มเพื่อทิ้งทั้งกอง</b>' : this.salvMode ? '<b class="miss">♻️ โหมดย่อย: คลิกที่ไอเท็มเพื่อย่อยเป็นวัตถุดิบ</b>' : 'คลิกเพื่อใช้/ถือ/สวม · ลากไปวางที่ช่องลัด 1–6 · คลิกขวา = เมนู (ปักช่องลัด / ♻️ ย่อยเป็นวัตถุดิบ)'} · ของชนิดเดียวกันซ้อนได้ 30 ชิ้น/ช่อง (อาหาร/ยา 10, เครื่องมือและเสื้อผ้า 1)</p></div><div><h3>ประดิษฐ์ ${fire ? '<span class="chip orange">🔥 ใกล้กองไฟ</span>' : ''}</h3>${catBar(rc, rcount, 'rcat')}${fbar}<div class="recipes">${rec}</div></div></div>`;
  }

  // สเตตัสสายอาชีพ: ลงแต้มได้เอง ความสามารถปลดล็อกตามแต้มของแต่ละสาย
  jobHTML() {
    const g = this.g, P = jobPts(g.ch), free = freePts(g.ch), main = jobOf(g.ch);
    const rows = Object.entries(JOBS).filter(([, J]) => !J.free).sort(([a], [b]) => (P[b] || 0) - (P[a] || 0)).map(([k, J]) => {
      const n = P[k] || 0, nextT = PERK_PTS.find((t) => t > n);
      const tiers = J.perks.map(([, t], i) => `<div class="perk ${n >= PERK_PTS[i] ? 'on' : ''}">${n >= PERK_PTS[i] ? '✅' : '🔒'} <b>${PERK_PTS[i]} แต้ม</b> ${t}</div>`).join('');
      return `<details class="jobrow" ${k === main ? 'open' : ''}><summary><span>${J.icon} <b>${J.name}</b>${k === main ? ' <small class="chip">สายหลัก</small>' : ''}</span><span class="jpts">${'●'.repeat(Math.min(n, 14))}<b>${n}</b></span><button data-statup="${k}" ${free > 0 ? '' : 'disabled'} title="ลง 1 แต้ม">＋</button></summary><small>${J.desc}${nextT ? ` · อีก ${nextT - n} แต้มปลดล็อกขั้นถัดไป` : ' · ปลดล็อกครบแล้ว'}</small>${tiers}</details>`;
    }).join('');
    return `<div class="jobbox"><b>🎓 สเตตัสสายอาชีพ</b>${g.profile.job === 'freelancer' ? ' <span class="chip">🧭 ฟรีแลนซ์</span>' : ''} <small>เลเวลตัวละคร ${g.charLevel()} · แต้มว่าง <b class="${free ? 'have' : ''}">${free}</b> (ได้ 1 แต้มทุกเลเวล)</small>
      <p class="hint">ลงแต้มสายไหนก็ได้ ไม่ต้องตรงกับอาชีพที่เลือกตอนสร้างตัวละคร · สายที่มีแต้มมากสุดคือสายหลัก · ความสามารถ/สูตรพิเศษปลดล็อกที่ ${PERK_PTS.join(' / ')} แต้ม · XP โบนัสของสายเพิ่มตามแต้ม</p>${rows}</div>`;
  }

  charHTML() {
    const g = this.g, s = g.stats;
    const sk = Object.entries(SKILLS).map(([k, n]) => {
      const xp = g.skills[k] || 0, l = skillLevel(xp), a = xpForLevel(l), b = xpForLevel(l + 1);
      return `<div class="skill"><span>${n}</span><b>Lv ${l}</b><div class="pbar"><i style="width:${((xp - a) / (b - a)) * 100}%"></i></div><small>${Math.floor(xp)}/${b} XP</small></div>`;
    }).join('');
    return `<h3>${esc(g.profile.name)} (${g.profile.sex === 'f' ? 'หญิง' : g.profile.sex === 'x' ? 'ไม่ระบุเพศ' : 'ชาย'}) — เลเวล ${g.charLevel()}</h3>
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
    const tdesc = (t) => [t.dmg && `⚔️ ${t.dmg}`, t.range && `📏 ${t.range}`, t.gather && `🪓 ×${t.gather}`, t.fish && '🐟 แทงปลา', t.rod && '🎣 ตกปลา', t.rock && `⛏️ ขุดหิน ×${t.rock}`].filter(Boolean).join(' ');
    const T = g.equipped && ITEMS[g.equipped], S = g.wear.off && ITEMS[g.wear.off];
    const toolSide = g.lefty ? 'L' : 'R';
    const dom = g.profile.hand === 'l' ? 'L' : 'R';
    const hand = (side) => {
      const isTool = side === toolSide, it = isTool ? T : S;
      const stat = !it ? (isTool ? '✊ มือเปล่า: ต่อยได้ · เก็บของ' : 'ว่าง — ลากโล่หรือคบเพลิงมาใส่') : isTool ? tdesc(it.tool) : it.wear.light ? '🔥 ส่องสว่างรอบตัว (มือรอง)' : `🛡️ กัน ${Math.round((it.wear.block || 0) * 100)}% · ลดดาเมจ ${Math.round((it.wear.def || 0) * 100)}%`;
      const un = it ? (isTool ? '<button data-hold="">เก็บ</button>' : '<button data-unwear="off">ถอด</button>') : '';
      return `<div class="hand" data-drop="${side}"><h4>${side === 'R' ? '🫱 มือขวา' : '🫲 มือซ้าย'} <small>${isTool ? 'อาวุธ/เครื่องมือ' : 'โล่/คบเพลิง'}${side === dom ? ' · ⭐ ถนัด' : ''}</small></h4>
        <div class="hbig ${it ? 'dragme' : ''}" ${it ? `data-drag="hand:${side}" title="ลากไปอีกมือเพื่อสลับ · ลากลงกระเป๋าเพื่อเก็บ"` : ''}>${it ? it.icon : '✋'}</div><b>${it ? esc(it.name) : 'ว่าง'}</b><small>${stat}</small>${un}</div>`;
    };
    const rank = (k) => (ITEMS[k].tool ? 0 : ITEMS[k].wear?.slot === 'off' ? 1 : 2);
    const bag = Object.keys(g.inv).filter((k) => g.inv[k] > 0 && (ITEMS[k].tool || ITEMS[k].wear) && k !== g.equipped)
      .sort((a, b) => rank(a) - rank(b))
      .map((k) => `<div class="dchip dragme" data-drag="item:${k}" data-item="${k}" title="${esc(ITEMS[k].name)} — ลากไปใส่มือ/ตัว หรือคลิก">${ITEMS[k].icon}<small>${esc(ITEMS[k].name)}</small></div>`).join('');
    // มือซ้ายอยู่ฝั่งซ้ายของจอ มือขวาอยู่ฝั่งขวา (ตรงกับตัวละครเมื่อมองจากด้านหลัง)
    return `<div class="hands">${hand('L')}<button class="swapbtn" data-swap="1" title="สลับมือ">⇄</button>${hand('R')}</div>
    <h4>🎒 ของที่ถือ/สวมได้ <small class="hint">ลากไปวางที่มือหรือช่องเครื่องแต่งกาย · คลิก = ใช้ทันที</small></h4>
    <div class="dbag" data-drop="bag">${bag || '<small class="hint">ไม่มีอาวุธ เครื่องมือ โล่ หรือเสื้อผ้าในกระเป๋า</small>'}</div>
    <p class="hint">⚔️ ดาเมจ ×${g.dmgMul().toFixed(2)} · 🛡️ โอกาสกันการโจมตี ${Math.round(ws.block * 100)}% (กันได้ = เจ็บแค่ 25% ไม่เลือดออก ไม่ติดเชื้อ)${g.lefty ? ' · ↔️ ถนัดซ้าย (สลับมืออยู่)' : ''}</p>
    <h4>👕 เครื่องแต่งกาย</h4><div data-drop="wear">${this.wearHTML(true)}</div>
    <h4>📊 สเตตัสตัวละคร</h4><div class="statgrid">${[
      ['❤️ พลังชีวิตสูงสุด', g.maxHp()], ['⚡ สตามิน่าสูงสุด', g.maxStamina()], ['⚔️ ดาเมจ', '×' + (g.dmgMul() * g.handMul()).toFixed(2) + (g.handMul() > 1 ? ' (มือถนัด)' : ' (มือไม่ถนัด)')],
      ['🛡️ ลดดาเมจ', Math.round(ws.def * 100) + '%'], ['🔰 กันการโจมตี', Math.round(ws.block * 100) + '%'], ['🦠 ลดติดเชื้อ', Math.round(ws.bite * 100) + '%'],
      ['💨 ความเร็ว', '+' + Math.round(ws.spd * 100) + '%'], ['🥷 ซ่อนตัว', Math.round((1 - g.stealthMul()) * 100) + '%'], ['🎒 กระเป๋า', g.usedSlots() + '/' + g.maxSlots()],
      ['🧟 กำจัดแล้ว', g.stats.kills + ' ตัว'], ['🎯 เลเวล', g.charLevel()], ['🫱 มือถนัด', g.profile.hand === 'l' ? 'ซ้าย' : 'ขวา'],
    ].map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>
    ${this.jobHTML()}`;
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
        document.body.appendChild(d.ghost); panel.classList.add('dragging'); document.body.classList.add('dragging');
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
      cur.ghost.remove(); panel.classList.remove('dragging'); document.body.classList.remove('dragging'); cur.over?.classList.remove('over');
      this.dragEndT = performance.now();
      const z = ev.type === 'pointerup' && zone(ev.clientX, ev.clientY);
      if (z) { this.onDrop(cur.src, z.dataset.drop); this.refreshPanels(); }
    };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
  }
  // 🎲 ภารกิจสุ่ม (แสดงใต้ภารกิจหลัก)
  drawSideQuest() {
    const g = this.g, q = g.sq, el = $('#sidequest'); if (!el) return;
    let h;
    if (!q || q.exp < g.now()) h = '<button data-sq="new">🎲 รับภารกิจสุ่ม (ได้เงินจิ)</button>';
    else {
      const [a, b] = sqProgress(g.ch, q, g.player.pos), left = Math.max(0, Math.ceil((q.exp - g.now()) / 60000));
      h = `<small class="qn">🎲 ภารกิจสุ่ม · เหลือ ${left} นาที · รางวัล 🪙 ${q.coin}</small><b>${esc(sqText(q))}</b> <small>(${a}/${b})</small><div class="sqb"><button data-sq="done" ${a >= b ? '' : 'disabled'}>✅ ส่งภารกิจ</button><button data-sq="drop">✖ ยกเลิก</button>${q.type === 'visit' ? '<small>แตะกล่องภารกิจหลักเพื่อเปิดลูกศรนำทาง</small>' : ''}</div>`;
    }
    if (el._h !== h) { el._h = h; el.innerHTML = h; }
  }
  // หน้าต่างให้เลือกหลายตัวเลือก (opts: {label, run, dis: false | ข้อความเหตุผล})
  choice(title, opts) {
    const m = $('#ctx-menu'); document.exitPointerLock?.();
    m.innerHTML = `<b>${esc(title)}</b>${opts.map((o, i) => `<button data-ci="${i}" ${o.dis ? 'disabled' : ''}>${esc(o.label)}${o.dis ? `<br><small>${esc(o.dis)}</small>` : ''}</button>`).join('')}<button data-ci="x">✖ ยกเลิก</button>`;
    m.hidden = false; m.style.left = Math.max(8, innerWidth / 2 - 130) + 'px'; m.style.top = Math.max(8, innerHeight / 2 - 120) + 'px';
    m.onclick = (ev) => { ev.stopPropagation(); const b = ev.target.closest('[data-ci]'); if (!b) return; m.hidden = true; const o = opts[+b.dataset.ci]; if (o && !o.dis) o.run(); };
  }
  // เมนูคลิกขวาที่ไอเท็มในกระเป๋า
  itemMenu(k, x, y) {
    const g = this.g, it = ITEMS[k], m = $('#ctx-menu'), sv = salvageOf(k), pinned = g.hotbar.includes(k);
    m.innerHTML = `<b>${it.icon} ${esc(it.name)}</b><button data-cm="use">▶️ ใช้ / ถือ / สวม</button>${it.tool && it.wear?.slot === 'off' ? '<button data-cm="off">🫲 ถือมือรอง (คู่กับอาวุธมือหลัก)</button>' : ''}<small class="hint">📌 วางที่ช่องลัดหมายเลข:</small><div class="hbpick">${g.hotbar.map((h, i) => `<button data-cm="hb" data-i="${i}" class="${h === k ? 'on' : ''}" title="${h ? esc(ITEMS[h]?.name || '') : 'ว่าง'}"><b>${i + 1}</b>${h && h !== k ? `<small>${ITEMS[h]?.icon || ''}</small>` : ''}</button>`).join('')}</div>${pinned ? '<button data-cm="pin">✖️ เอาออกจากช่องลัด</button>' : ''}${gearKind(k) ? '<button data-cm="forge">⚒️ ตีบวก...</button>' : ''}${gearKind(k) === 'gear' && (g.inv.magnifier || 0) > 0 ? `<button data-cm="ident">🔍 ส่องออฟชั่น (แว่นขยาย ${g.inv.magnifier})</button>` : ''}${sv ? `<button data-cm="salvage">♻️ ย่อย → ${Object.entries(sv).map(([i, n]) => `${ITEMS[i].icon}${n}`).join(' ')}</button>` : '<button disabled>♻️ ย่อยไม่ได้</button>'}${it.quest ? '' : '<button data-cm="drop">🗑️ ทิ้ง 1 ชิ้น</button>'}`;
    m.hidden = false; m.style.left = Math.min(x, innerWidth - 230) + 'px'; m.style.top = Math.max(4, Math.min(y, innerHeight - m.offsetHeight - 8)) + 'px';
    m.onclick = (ev) => {
      ev.stopPropagation(); const bt = ev.target.closest('[data-cm]'), a = bt?.dataset.cm; if (!a) return; m.hidden = true;
      if (a === 'hb') { this.onDrop('item:' + k, 'hb:' + bt.dataset.i); return this.refreshPanels(); }
      if (a === 'forge') return this.openForge();
      if (a === 'ident') { g.auth.do('identify', { k }); return setTimeout(() => this.refreshPanels(), 350); }
      if (a === 'use') g.useItem(k); else if (a === 'off') g.equip(k); else if (a === 'pin') g.pinHotbar(k); else if (a === 'salvage') g.auth.do('salvage', { k }); else if (a === 'drop') g.dropItem(k, 1);
      this.refreshPanels();
    };
    const close = (ev) => { if (!m.contains(ev.target)) { m.hidden = true; removeEventListener('pointerdown', close, true); } };
    setTimeout(() => addEventListener('pointerdown', close, true), 0);
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
    if (dst.startsWith('hb:')) { const i = +dst.slice(3), j = g.hotbar.indexOf(v); if (j >= 0) g.hotbar[j] = g.hotbar[i] ?? null; g.hotbar[i] = v; this.toast(`📌 ${it.icon} ${it.name} → ช่องลัด ${i + 1}`); return; }
    if (hands) {
      const isShield = it.wear?.slot === 'off';
      // คบเพลิง: วางที่มือรอง = ถือมือรอง (คู่กับดาบ) · วางที่มือหลัก = ถือเป็นอาวุธ
      if (it.tool && isShield && dst !== toolSide) { if (g.wear.off !== v) g.equip(v); return; }
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
      return `<div class="person"><div><b>${p.sex === 'f' ? '👩' : p.sex === 'x' ? '🧑' : '👨'} ${esc(p.name)}</b> <span class="chip" style="background:${L.color}">${L.name}</span>${g.social.preg[p.id] ? ' 🤰' : ''}<br><small>${esc(p.bio)}${p.npc ? '' : ' · 🟢'}</small><div class="pbar"><i style="width:${pct}%;background:${L.color}"></i></div></div><small>${Math.floor(r.pts)} แต้ม</small></div>`;
    }).join('');
    const kids = g.social.children.map((c) => `<li>${c.sex === 'f' ? '👧' : '👦'} ${esc(c.name)} ${c.adopted ? '(รับเลี้ยง)' : ''} — อายุ ${Math.floor((Date.now() - c.born) / 60000)} นาที</li>`).join('');
    return this.partyHTML() + this.friendsHTML() + `<h3>💞 ความสัมพันธ์</h3><p class="hint">ความผูกพันเพิ่มขึ้นเมื่อ: อยู่ใกล้กัน · พูดคุย · ให้ของขวัญ (NPC ชอบของบางอย่างเป็นพิเศษ) · ทำแผลให้ · กอด<br>ลำดับ: ไม่รู้จัก → คุ้นเคย → เพื่อน → เพื่อนสนิท → คนรัก (สารภาพรัก) → ครอบครัว (แต่งงานด้วยแหวน) — เดินไปหาแล้วกด <b>E</b> เพื่อโต้ตอบ</p>${rows}
      <h3>👨‍👩‍👧 ลูก ๆ</h3>${kids ? `<ul>${kids}</ul>` : '<p class="hint">ยังไม่มีลูก (ต้องเป็นคนรัก/ครอบครัว และอยู่ใกล้เพิงพัก)</p>'}`;
  }

  partyHTML() {
    const g = this.g, P = g.party;
    if (!g.net.online) return '';
    if (!P) return '<h3>👥 ปาร์ตี้</h3><p class="hint">ยังไม่มีปาร์ตี้ — เดินไปหาผู้เล่นแล้วกด E → "👥 ชวนเข้าปาร์ตี้" (สูงสุด 6 คน) · คุยในปาร์ตี้: กดปุ่มช่องแชทเป็น 👥 หรือพิมพ์ /p ข้อความ</p>';
    const lead = P.leader === g.id;
    return `<h3>👥 ปาร์ตี้ (${P.members.length}/6)</h3><div class="recipes">${P.members.map((m) => `<div class="recipe"><div><b>${m.id === P.leader ? '👑 ' : ''}${esc(m.name)}</b>${m.id === g.id ? ' <small>(คุณ)</small>' : ''}</div>${lead && m.id !== g.id ? `<button data-pkick="${esc(m.id)}">นำออก</button>` : ''}</div>`).join('')}</div><p><button data-pleave="1">🚪 ออกจากปาร์ตี้</button> <span class="hint">เห็นเลือดเพื่อนในปาร์ตี้มุมซ้าย · ตำแหน่งบนแผนที่ (สีฟ้า)</span></p>`;
  }
  drawPartyHud() {
    const g = this.g, P = g.party, el = $('#party-hud'); if (!el) return;
    if (!P || P.members.length < 2) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<b>👥 ปาร์ตี้</b>' + P.members.filter((m) => m.id !== g.id).map((m) => { const r = g.ents.remotes.get(m.id), hp = r ? Math.max(0, Math.min(100, r.hp ?? 100)) : 0, d = r ? Math.round(r.pos.distanceTo(g.player.pos) * 50) : null; return `<div class="pm"><span>${esc(m.name)}</span><small>${d === null ? 'ไกล' : d >= 1000 ? (d / 1000).toFixed(1) + 'กม.' : d + 'ม.'}</small></div><div class="hpb"><i style="width:${hp}%"></i></div>`; }).join('');
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
        <div class="pethead"><b>🐾 ${esc(p.name)}</b> <button data-prename="${p.id}" title="ใช้ป้ายเปลี่ยนชื่อ 1 ชิ้น (ซื้อในร้านเงินจิ)" ${(g.inv.name_tag || 0) > 0 ? '' : 'disabled'}>🏷️ เปลี่ยนชื่อ (${g.inv.name_tag || 0})</button> <span class="chip" style="background:${R.color};color:#111">${R.name}</span> <small>${PET_TYPES[p.type].name} · Lv ${st.lvl}</small>${p.down > 0 ? ' <span class="chip red">😵 หมดสติ</span>' : ''}</div>
        <div class="petstats"><span>❤️ ${Math.ceil(p.hp)}/${st.maxHp}</span><span>⚔️ โจมตี ${st.atk}</span><span>🛡️ ลดดาเมจ ${Math.round(st.def * 100)}%</span><span>💕 ผูกพัน ${Math.floor(p.loyal)}%</span></div>
        <div class="pbar"><i style="width:${Math.min(100, ((p.xp - cur) / (nxt - cur)) * 100)}%"></i></div><small>XP ${Math.floor(p.xp)}/${nxt} · ได้จากการสู้ ให้อาหาร และเดินทางด้วยกัน</small>
        <div class="traits"><span class="trait innate" title="ความสามารถประจำชนิด">⭐ ${esc(PET_TYPES[p.type].perk)}</span>${p.traits.map((t) => `<span class="trait" title="${esc(PET_TRAITS[t].desc)}">${PET_TRAITS[t].icon} ${esc(PET_TRAITS[t].name)}<small>${esc(PET_TRAITS[t].desc)}</small></span>`).join('')}</div>
        ${Object.entries(PET_SLOTS).map(([k, label]) => slot(k, label)).join('')}
        <div class="acts"><button data-petfeed="${i}">🍖 ให้อาหาร</button><button data-petheal="${i}">🩹 รักษา</button><button data-petstay="${i}">${p.stay ? '🚶 ตามมา' : '✋ รอตรงนี้'}</button><button data-pethome="${i}">${p.home ? '🚶 พากลับจากบ้าน' : '🏡 ให้อยู่บ้านสัตว์เลี้ยง'}</button></div>${p.home ? '<small>🏡 อยู่บ้าน: ฟื้นพลังชีวิต ความผูกพันไม่ลด และช่วยเฝ้าบ้าน</small>' : ''}
      </div>`;
    }).join('');
    const env = g.auth.env(), houses = env.ownCount('pethouse'), beds = env.ownCount('bed'), cap = petCap(houses, beds);
    const wildN = g.pets.filter((p) => PET_TYPES[p.type]?.wild).length;
    const capLine = `<div class="jobbox">🐾 จำนวนสูงสุด: <b>ชนิดละ ${cap} ตัว</b> — ${['dog', 'cat', 'bird'].map((t) => `${PET_TYPES[t].name} ${g.pets.filter((p) => p.type === t).length}/${cap}`).join(' · ')} · 🦌 สัตว์ป่า ${wildN}/${WILD_PET_MAX}
      <br><small>${beds ? `🏡 บ้านสัตว์เลี้ยง ${houses} หลัง (หลังละ +1 ตัว/ชนิด)` : 'อยากเลี้ยงเพิ่ม: ต้องมีบ้าน (วาง 🛏️ เตียง) แล้วสร้าง 🏡 บ้านสัตว์เลี้ยง หลังละ +1 ตัว/ชนิด'} · จับสัตว์ป่า/ไดโนเสาร์ด้วย 🪤 กรงดักสัตว์: วางกรง ใส่เหยื่อ (เนื้อ = สัตว์กินเนื้อ · พืช = สัตว์กินพืช) รอ 3 นาทีแล้วเปิดกรง · ใกล้สวนสัตว์เขาเขียวมีโอกาสได้ไดโนเสาร์/เสือ</small>
      <div><button data-petsup="1">⬆️ เรียกสัตว์เลี้ยงขึ้นมาบนที่สูง [G]</button></div></div>`;
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
  // ร้านแลกของของ NPC: เลือกของในกระเป๋าใส่ "ตะกร้าแลก" แล้วกดแลกของที่ต้องการ
  shopHTML(n, r) {
    const g = this.g, B = (this.basket ||= {}), day = Math.floor(g.now() / DAY_MS);
    for (const k of Object.keys(B)) if (!(g.inv[k] >= B[k])) delete B[k];
    const total = Object.entries(B).reduce((s, [k, q]) => s + tradeValue(k) * q, 0), disc = Math.round(Math.min(0.25, Math.max(0, r.pts) / 1000) * 100);
    const rows = SHOPS[n.job].map(([k, base, per]) => {
      const T = g.trade?.[n.id + ':' + k], left = per - (T && T.d === day ? T.n : 0), price = shopPrice(base, r.pts), ok = left > 0 && total >= price && !ITEMS[k].coinOnly;
      const cp = Math.ceil(price), cok = left > 0 && (g.inv.jicoin || 0) >= cp;
      return `<div class="recipe ${ok || cok ? 'ready' : 'dis'}"><div><b>${ITEMS[k].icon} ${esc(ITEMS[k].name)}</b> <small>ราคา ${price}${disc ? ` (ลด ${disc}%)` : ''} · เหลือวันนี้ ${Math.max(0, left)}/${per}</small>${statText(k) ? `<small class="st">${statText(k)}</small>` : ''}</div><button data-tbuy="${k}" ${ok ? '' : 'disabled'}>แลก</button><input type="number" class="qty" id="nq-${k}" min="1" max="${Math.max(1, left)}" value="1" title="จำนวนที่จะซื้อด้วยเงินจิ"><button data-cbuy="${k}" data-cp="${cp}" ${cok ? '' : 'disabled'}>🪙 ${cp}/ชิ้น</button></div>`;
    }).join('');
    const mine = Object.entries(g.inv).filter(([k, q]) => q > 0 && ITEMS[k].value && !ITEMS[k].quest && k !== g.equipped).map(([k, q]) => `<span class="item small" data-tpay="${k}" title="${esc(ITEMS[k].name)} มูลค่า ${tradeValue(k).toFixed(1)} · มี ${q}">${ITEMS[k].icon}<b>${q - (B[k] || 0)}</b></span>`).join('');
    const bask = Object.entries(B).map(([k, q]) => `<span class="item small" data-tunpay="${k}" title="คลิกเพื่อเอาออก">${ITEMS[k].icon}<b>×${q}</b></span>`).join('');
    const T = n.teach && LEARN[n.teach], knows = T && g.boxes?.['learn_' + n.teach];
    const teach = T ? `<h4>🎓 เรียน${T.name}กับ${esc(n.name)}</h4><p>${knows ? '✅ คุณเรียนวิชานี้แล้ว — เปิดหน้าประดิษฐ์ (ค้นหา "จักสาน" หรือ "ไผ่") และหน้าสร้าง (ผนังไม้ไผ่)' : `สอนสานตะกร้า ชะลอม พัด แพไม้ไผ่ และผนังไม้ไผ่ ค่าเรียน 🪙 ${T.cost} <button data-learn="${n.teach}" ${(g.inv.jicoin || 0) >= T.cost ? '' : 'disabled'}>เรียนเลย</button>`}</p>` : '';
    const forge = n.job === 'blacksmith' ? `<h4>⚒️ จ้าง${esc(n.name)}ตีบวก</h4><p>ตีบวกอาวุธ ชุด และอุปกรณ์สัตว์เลี้ยง (จ่ายค่าจ้างเป็นเงินจิ + ใช้เหล็กพลัส/หินซุปเปอร์ของคุณ) <button data-forge="1">⚒️ เปิดหน้าตีบวก</button></p>` : '';
    return `${teach}${forge}<h4>🛒 แลกของกับ${esc(n.name)} <small>(ยิ่งสนิทยิ่งได้ส่วนลด สูงสุด 25%)</small></h4>
      <div class="recipes">${rows}</div>
      <p><b>ตะกร้าแลก:</b> มูลค่ารวม <b>${Math.floor(total)}</b> ${bask || '<span class="hint">คลิกของในกระเป๋าด้านล่างเพื่อใส่ตะกร้า</span>'} ${bask ? '<button data-tclear="1">ล้าง</button>' : ''}</p>
      <div class="gifts">${mine || '<span class="hint">ไม่มีของที่ใช้แลกได้</span>'}</div>
      <h4>🪙 ขายของให้${esc(n.name)} รับเงินจิ <small>(ได้ครึ่งหนึ่งของมูลค่า · รับซื้อวันละไม่เกิน ${SELL_DAY_CAP} · คุณมี 🪙 ${g.inv.jicoin || 0})</small></h4>
      <div class="gifts">${Object.entries(g.inv).filter(([k, q]) => q > 0 && ITEMS[k].value && !ITEMS[k].quest && k !== 'jicoin' && k !== g.equipped).map(([k, q]) => `<span class="item small" data-sell="${k}" title="ขาย ${esc(ITEMS[k].name)} 1 ชิ้น ได้ ${sellPrice(k)} เงินจิ · มี ${q}">${ITEMS[k].icon}<b>${sellPrice(k)}</b></span>`).join('') || '<span class="hint">ไม่มีของที่ขายได้</span>'}</div>`;
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
    return `<button data-back="1">← กลับ</button><h3>${other.sex === 'f' ? '👩' : other.sex === 'x' ? '🧑' : '👨'} ${esc(other.name)} <span class="chip" style="background:${L.color}">${L.name}</span></h3>
      <p><small>${npc ? esc(e.def.bio) + ` · ${JOBS[e.def.job]?.icon || ''} อาชีพ${JOBS[e.def.job]?.name || ''} · ชอบ: ${ITEMS[e.def.likes].icon}?` : 'ผู้เล่นออนไลน์'}</small></p>
      <div class="pbar big"><i style="width:${pct}%;background:${L.color}"></i></div><small>${Math.floor(r.pts)} แต้ม ${next ? `→ ${next.name} ที่ ${next.min}` : ''}</small>
      <div class="acts">${acts}${npc ? '' : this.friendBtn(e.id) + `<button data-treq="${esc(e.id)}">🔄 แลกของ</button><button data-pinv="${esc(e.id)}">👥 ชวนเข้าปาร์ตี้</button><button data-pmto="${esc(other.name)}">🤫 กระซิบ</button>`}</div><h4>🎁 ให้ของขวัญ</h4><div class="gifts">${gifts || '<span class="hint">ไม่มีของ</span>'}</div>
      ${npc && SHOPS[e.def.job] ? this.shopHTML(e.def, r) : ''}
      <p class="hint">ปุ่มสีจาง = ยังทำไม่ได้ (ชี้เมาส์เพื่อดูเหตุผล) · การกระทำสำคัญต้องได้รับความยินยอมจากอีกฝ่าย</p>`;
  }

  onPanelClick(ev) {
    if (performance.now() - (this.dragEndT || 0) < 250) return; // เพิ่งลากเสร็จ ไม่นับเป็นคลิก
    const t = ev.target.closest('button,[data-item],[data-swap],[data-gift],[data-dep],[data-wd],[data-tadd],[data-toff],[data-tpay],[data-tunpay],[data-sell],[data-slist],[data-bup],[data-pwd],[data-pdep]'); if (!t) return;
    const g = this.g, d = t.dataset;
    if (d.close) return this.closeAll();
    if (d.tab === 'guide') { openGuide(); return; }
    if (d.tab) { this.person = null; this.tab = d.tab; return this.refreshPanels(); }
    if (d.sq) { g.auth.do('sq' + d.sq); return this.refreshPanels(); }
    if (d.sqt) { g.auth.do('sqnew', { tier: +d.sqt }); return this.refreshPanels(); }
    if (d.back) { this.person = null; return this.refreshPanels(); }
    if (d.dropmode) { this.dropMode = !this.dropMode; this.salvMode = false; return this.refreshPanels(); }
    if (d.salvmode) { this.salvMode = !this.salvMode; this.dropMode = false; return this.refreshPanels(); }
    if (d.item) { if (this.dropMode) g.dropItem(d.item, g.inv[d.item]); else if (this.salvMode) g.auth.do('salvage', { k: d.item }); else g.useItem(d.item); return this.refreshPanels(); }
    if (d.hold !== undefined) { g.holdItem(d.hold || null); return this.refreshPanels(); }
    if (d.swap) { g.setLefty(!g.lefty); return this.refreshPanels(); }
    if (d.icat) { this.icat = d.icat; return this.refreshPanels(); }
    if (d.rcat) { this.rcat = d.rcat; return this.refreshPanels(); }
    if (d.freq) { g.net.send({ t: 'friend', a: 'req', to: d.freq }); return; }
    if (d.faccept) { g.net.send({ t: 'friend', a: 'accept', to: d.faccept }); return; }
    if (d.fdecline) { g.net.send({ t: 'friend', a: 'decline', to: d.fdecline }); return; }
    if (d.fremove) { const f = g.friends.find((x) => x.id === d.fremove); return this.confirm(`ลบ ${f?.name || ''} ออกจากเพื่อน?`, (ok) => ok && g.net.send({ t: 'friend', a: 'remove', to: d.fremove })); }
    if (d.tpay) { const B = (this.basket ||= {}); if ((B[d.tpay] || 0) < (g.inv[d.tpay] || 0)) B[d.tpay] = (B[d.tpay] || 0) + 1; return this.refreshPanels(); }
    if (d.tunpay) { const B = this.basket || {}; if (--B[d.tunpay] <= 0) delete B[d.tunpay]; return this.refreshPanels(); }
    if (d.tclear) { this.basket = {}; return this.refreshPanels(); }
    if (d.cbuy) { const q = Math.max(1, Math.min(99, +($('#nq-' + CSS.escape(d.cbuy))?.value || 1) | 0)); g.auth.do('npctrade', { npc: this.person.id, buy: d.cbuy, pay: { jicoin: +d.cp * q }, q }); return setTimeout(() => this.refreshPanels(), 300); }
    if (d.bup) { const s = this.struct, need = HOUSE_UP[(s.lv || 1) + 1]?.[d.bup] || 0, q = Math.min(g.inv[d.bup] || 0, need - (s.up?.[d.bup] || 0)); if (q > 0) g.home.op(s, { o: 'contrib', item: d.bup, qty: q }); return this.refreshPanels(); }
    if (d.stq) { this.stQty = d.stq === 'all' ? 'all' : +d.stq; return this.refreshPanels(); }
    if (d.pwd) { const have = this.struct.pi?.[g.id]?.[d.pwd] || 1; g.home.op(this.struct, { o: 'pitem', item: d.pwd, qty: -(ev.button === 2 ? have : this.stAmt(have)) }); return this.refreshPanels(); }
    if (d.pdep) { const q = ev.button === 2 ? g.inv[d.pdep] : this.stAmt(g.inv[d.pdep] || 0); if (g.hasItem(d.pdep, q)) g.home.op(this.struct, { o: 'pitem', item: d.pdep, qty: q }); return this.refreshPanels(); }
    if (d.hadd) { const r = prompt(`ตั้ง ${d.n} เป็นหน้าที่อะไร?\nพิมพ์: deputy = รองเจ้าบ้าน · animal = ผู้ดูแลสัตว์ · plant = ผู้ดูแลพืช · resident = ผู้อาศัย`, 'resident'); if (r && ROLES[r.trim()]) g.home.op(this.struct, { o: 'member', id: d.hadd, name: d.n, role: r.trim() }); return this.refreshPanels(); }
    if (d.hrole !== undefined) { g.home.op(this.struct, { o: 'member', id: d.hrole, role: d.r || null }); return this.refreshPanels(); }
    if (d.slist) {
      const s = this.struct, k = d.slist, have = g.inv[k] || 0;
      const price = Math.floor(+prompt(`ราคาขาย ${ITEMS[k].name} ชิ้นละกี่เงินจิ? (มูลค่าประมาณ ${ITEMS[k].value || 1})`, String(Math.max(1, ITEMS[k].value || 1))));
      if (!(price >= 1)) return;
      const qty = Math.min(have, Math.floor(+prompt(`วางขายกี่ชิ้น? (มี ${have})`, '1')) || 0);
      if (qty > 0) g.home.op(s, { o: 'list', item: k, qty, price });
      return this.refreshPanels();
    }
    if (d.learn) { g.auth.do('learn', { k: d.learn }); setTimeout(() => this.refreshPanels(), 300); return; }
    if (d.sell) { g.auth.do('npcsell', { npc: this.person.id, k: d.sell, q: 1 }); return this.refreshPanels(); }
    if (d.tbuy) { const r = g.auth.do('npctrade', { npc: this.person.id, buy: d.tbuy, pay: { ...this.basket } }); if (!g.auth.server && r && !r.err) this.basket = {}; else if (g.auth.server) this.basket = {}; return this.refreshPanels(); }
    if (d.statup) { g.auth.do('statup', { job: d.statup }); return this.refreshPanels(); }
    if (d.petsup) { g.callPetsUp(); return; }
    if (d.treq) { g.net.send({ t: 'trade', a: 'req', to: d.treq }); return; }
    if (d.pinv) { if (!g.net.online) return this.toast('ปาร์ตี้ใช้ได้เมื่อเล่นออนไลน์', 'warn'); g.net.send({ t: 'party', a: 'invite', to: d.pinv }); return; }
    if (d.pkick) { g.net.send({ t: 'party', a: 'kick', to: d.pkick }); return; }
    if (d.pleave) { g.net.send({ t: 'party', a: 'leave' }); return; }
    if (d.pmto) { g.chatCh = 'pm'; g.chatTo = d.pmto; $('#chat-ch').textContent = `🤫 ${d.pmto}`; this.closeAll(); this.chatting = true; const i = $('#chat-input'); i.classList.add('show'); i.focus(); return; }
    if (d.tadd || d.toff) { const o = { ...(g.tradeSt?.mine || {}) }; if (d.tadd) o[d.tadd] = (o[d.tadd] || 0) + 1; else if (--o[d.toff] <= 0) delete o[d.toff]; g.net.send({ t: 'trade', a: 'offer', items: o }); return; }
    if (d.tok) { g.net.send({ t: 'trade', a: 'ok' }); return; }
    if (d.tcancel) { g.net.send({ t: 'trade', a: 'cancel' }); return; }
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
    if (d.bcol) { const b = g.world.structures.find((x) => x.id === d.bcol); if (b) g.home.op(b, { o: 'color', c: d.c }); return this.refreshPanels(); }
    if (d.mz !== undefined) { const k = +d.mz; if (!k) { this.mapZoom = 1; this.mapCenter = null; } else { const cv = $('#bigmap'), r = cv.getBoundingClientRect(); zoomBtn(this, k > 0 ? 1.6 : 1 / 1.6, r); } return this.refreshPanels(); }
    if (d.forge) return this.openForge();
    if (d.enhs) { g.auth.do('enhance', { k: d.enhs, shop: 1 }); setTimeout(() => this.refreshPanels(), 350); return; }
    if (d.enh) { g.auth.do('enhance', { k: d.enh }); setTimeout(() => this.refreshPanels(), 350); return; }
    if (d.ident) { g.auth.do('identify', { k: d.ident }); setTimeout(() => this.refreshPanels(), 350); return; }
    if (d.coinbuy) { g.auth.do('cbuy', { k: d.coinbuy, q: Math.max(1, Math.min(99, +($('#cq-' + CSS.escape(d.coinbuy))?.value || 1) | 0)) }); setTimeout(() => this.refreshPanels(), 350); return; }
    if (d.prename) { const p = g.pets.find((x) => x.id === d.prename); const n = p && prompt(`ชื่อใหม่ของ ${p.name} (ไม่เกิน 16 ตัวอักษร · ใช้ป้ายเปลี่ยนชื่อ 1 ชิ้น)`, p.name); if (n && n.trim()) g.auth.do('renamepet', { id: p.id, name: n.trim() }); setTimeout(() => this.refreshPanels(), 350); return; }
    if (d.prefab) {
      // ตั้งบ้านข้างหน้าผู้เล่น: ช่องมุมบนซ้าย + ประตูหันกลับมาหาผู้เล่น
      const P = g.player.pos, n = this.pfN || 1, a = g.camYaw + Math.PI, vx = Math.sin(a), vz = Math.cos(a), dist = n * 1.5 + 3;
      const [cx, cz] = cellOf(P.x + vx * dist, P.z + vz * dist), cx0 = cx - Math.floor((n - 1) / 2), cz0 = cz - Math.floor((n - 1) / 2);
      const door = Math.abs(vx) > Math.abs(vz) ? (vx > 0 ? 3 : 1) : (vz > 0 ? 0 : 2);
      g.auth.do('prefab', { n, cx: cx0, cz: cz0, door }); setTimeout(() => this.refreshPanels(), 400); return;
    }
    if (d.ring) { const P = g.player.pos; g.auth.do('fencering', { n: this.ringN || 6, gates: this.ringG || 1, x: P.x, z: P.z }); setTimeout(() => this.refreshPanels(), 400); return; }
    if (d.bname) { const b = g.world.structures.find((x) => x.id === d.bname); const n = b && prompt('ชื่อฐานใหม่', b.name); if (n) g.home.op(b, { o: 'rename', name: n }); return this.refreshPanels(); }
    if (d.cbuild) { if (!canBuild(g.inv)) return this.toast('ต้องมีค้อนก่อน', 'warn'); return g.builder.start(d.cbuild, true); }
    if (d.build) { if (t.classList.contains('dis') && !canBuild(g.inv)) return this.toast('ต้องมีค้อนก่อน (🪵 ค้อนไม้ หรือ 🔨 ค้อนช่างไม้)', 'warn'); return g.builder.start(d.build); }
    if (d.demolish) { if (!canBuild(g.inv)) return this.toast('ต้องมีค้อนก่อน (🪵 ค้อนไม้ หรือ 🔨 ค้อนช่างไม้)', 'warn'); return g.builder.startDemolish(); }
    if (d.sact) { const a = this.structActs?.[+d.sact]; if (a && !a.dis) a.run(); return this.refreshPanels(); }
    if (d.dep) { g.home.deposit(this.struct, d.dep, this.stAmt(g.inv[d.dep] || 0)); return this.refreshPanels(); }
    if (d.wd) { const s0 = g.world.structures.find((x) => x.id === this.struct.id) || this.struct; g.home.withdraw(this.struct, d.wd, this.stAmt(s0.items?.[d.wd] || 0)); return this.refreshPanels(); }
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
