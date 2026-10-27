// เสียงทั้งหมดสังเคราะห์ด้วย Web Audio (ไม่มีไฟล์เสียง) — เสียงประกอบ + บรรยากาศ (ลม ฝน คลื่น กองไฟ จิ้งหรีด)
const PREF = 'cbs_sound', VPREF = 'cbs_vol';
// ช่องปรับระดับเสียงแยกตามประเภท (0–1) · ปรับได้จากปุ่ม 🔊 ในเกม
export const VOL_CH = [['master', '🔊 เสียงทั้งหมด'], ['fx', '💥 เสียงประกอบ (ตี เก็บของ ประดิษฐ์)'], ['zombie', '🧟 เสียงผู้ติดเชื้อ'], ['music', '🎸 ดนตรี'], ['rain', '🌧️ เสียงฝน'], ['wind', '🌬️ เสียงลม'], ['waves', '🌊 เสียงคลื่น'], ['fire', '🔥 เสียงกองไฟ'], ['crickets', '🦗 เสียงจิ้งหรีดกลางคืน'], ['engine', '🏍️ เสียงเครื่องยนต์']];
const ZOMBIE_SND = new Set(['groan', 'zdie']);

export class Sfx {
  constructor() {
    this.ctx = null; this.muted = false; this.last = {};
    try { this.muted = localStorage.getItem(PREF) === 'off'; } catch { /* storage blocked */ }
    this.vol = Object.fromEntries(VOL_CH.map(([k]) => [k, 1]));
    try { Object.assign(this.vol, JSON.parse(localStorage.getItem(VPREF) || '{}')); } catch { /* ignore */ }
  }

  // ต้องเรียกจากการคลิกของผู้เล่น (เบราว์เซอร์อนุญาตเสียงหลังการโต้ตอบเท่านั้น)
  unlock() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.7 * this.vol.master; this.master.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.startAmbience();
  }
  setMuted(m) {
    this.muted = m; try { localStorage.setItem(PREF, m ? 'off' : 'on'); } catch { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7 * this.vol.master, this.ctx.currentTime, 0.05);
  }
  setVol(k, v) {
    this.vol[k] = Math.max(0, Math.min(1, +v || 0));
    try { localStorage.setItem(VPREF, JSON.stringify(this.vol)); } catch { /* ignore */ }
    if (k === 'master' && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.7 * this.vol.master, this.ctx.currentTime, 0.05);
  }

  out(pan = 0) {
    if (!pan || !this.ctx.createStereoPanner) return this.master;
    const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(this.master); return p;
  }
  tone({ f = 440, f2 = null, type = 'sine', dur = 0.15, vol = 0.3, delay = 0, pan = 0, lp = null }) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
    node.connect(g); g.connect(this.out(pan)); o.start(t); o.stop(t + dur + 0.05);
  }
  noise({ dur = 0.1, vol = 0.3, type = 'lowpass', f = 1000, f2 = null, q = 1, delay = 0, pan = 0 }) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.out(pan));
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  play(name, { pan = 0, vol = 1 } = {}) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (now - (this.last[name] || 0) < 60) return; // กันเสียงซ้อนรัว ๆ
    this.last[name] = now;
    const ch = ZOMBIE_SND.has(name) ? this.vol.zombie : name === 'music' ? this.vol.music : 1;
    vol *= this.vol.fx * ch; if (vol <= 0.001) return;
    const v = (x) => x * vol;
    switch (name) {
      case 'swing': this.noise({ dur: 0.14, vol: v(0.18), type: 'bandpass', f: 1200, f2: 300, q: 2, pan }); break;
      case 'hit': this.noise({ dur: 0.12, vol: v(0.4), f: 500, pan }); this.tone({ f: 140, f2: 60, type: 'square', dur: 0.1, vol: v(0.15), lp: 600, pan }); break;
      case 'chop': this.tone({ f: 320, f2: 220, type: 'triangle', dur: 0.08, vol: v(0.35), pan }); this.noise({ dur: 0.05, vol: v(0.2), type: 'bandpass', f: 1800, pan }); break;
      case 'stone': this.tone({ f: 1100, f2: 600, type: 'triangle', dur: 0.06, vol: v(0.25), pan }); this.noise({ dur: 0.06, vol: v(0.2), type: 'highpass', f: 2500, pan }); break;
      case 'pickup': this.tone({ f: 660, f2: 990, dur: 0.09, vol: v(0.18) }); break;
      case 'loot': this.noise({ dur: 0.25, vol: v(0.2), type: 'bandpass', f: 900, q: 0.7 }); this.tone({ f: 523, dur: 0.08, vol: v(0.15), delay: 0.2 }); this.tone({ f: 784, dur: 0.12, vol: v(0.15), delay: 0.28 }); break;
      case 'craft': [523, 659, 784].forEach((f, i) => this.tone({ f, type: 'triangle', dur: 0.12, vol: v(0.18), delay: i * 0.07 })); this.noise({ dur: 0.08, vol: v(0.15), type: 'bandpass', f: 2000 }); break;
      case 'eat': for (let i = 0; i < 3; i++) this.noise({ dur: 0.07, vol: v(0.25), f: 1400, delay: i * 0.13 }); break;
      case 'drink': for (let i = 0; i < 3; i++) this.tone({ f: 300 + i * 40, f2: 650, dur: 0.1, vol: v(0.15), delay: i * 0.15 }); break;
      case 'hurt': this.tone({ f: 260, f2: 110, type: 'sawtooth', dur: 0.22, vol: v(0.22), lp: 1200 }); this.noise({ dur: 0.1, vol: v(0.3), f: 700 }); break;
      case 'groan': { const d = 0.7 + Math.random() * 0.5, f = 80 + Math.random() * 40; this.tone({ f, f2: f * 0.7, type: 'sawtooth', dur: d, vol: v(0.22), lp: 420, pan }); this.noise({ dur: d * 0.8, vol: v(0.06), type: 'bandpass', f: 500, q: 3, pan }); break; }
      case 'zdie': this.tone({ f: 120, f2: 40, type: 'sawtooth', dur: 0.6, vol: v(0.2), lp: 300, pan }); break;
      case 'step': this.noise({ dur: 0.05, vol: v(0.07), f: 380 + Math.random() * 120 }); break;
      case 'splash': this.noise({ dur: 0.25, vol: v(0.15), type: 'bandpass', f: 1200, f2: 400 }); break;
      case 'level': [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, type: 'triangle', dur: 0.2, vol: v(0.2), delay: i * 0.09 })); break;
      case 'love': this.tone({ f: 659, dur: 0.25, vol: v(0.15) }); this.tone({ f: 880, dur: 0.4, vol: v(0.15), delay: 0.15 }); break;
      case 'baby': [784, 988, 1175, 1568].forEach((f, i) => this.tone({ f, dur: 0.3, vol: v(0.12), delay: i * 0.12 })); break;
      case 'death': this.tone({ f: 330, f2: 55, type: 'sawtooth', dur: 1.6, vol: v(0.25), lp: 800 }); break;
      case 'bark': this.tone({ f: 520, f2: 330, type: 'square', dur: 0.08, vol: v(0.12), lp: 1500, pan }); this.tone({ f: 500, f2: 320, type: 'square', dur: 0.08, vol: v(0.12), lp: 1500, delay: 0.14, pan }); break;
      case 'meow': this.tone({ f: 650, f2: 900, dur: 0.15, vol: v(0.12), pan }); this.tone({ f: 900, f2: 560, dur: 0.2, vol: v(0.12), delay: 0.14, pan }); break;
      case 'chirp': for (let i = 0; i < 3; i++) this.tone({ f: 2400 + Math.random() * 800, f2: 3200, dur: 0.05, vol: v(0.08), delay: i * 0.08, pan }); break;
      case 'radio': this.noise({ dur: 0.7, vol: v(0.12), type: 'bandpass', f: 2200, q: 0.8 }); this.tone({ f: 1000, type: 'square', dur: 0.06, vol: v(0.08), delay: 0.7, lp: 3000 }); break;
      case 'gate': this.tone({ f: 110, f2: 90, type: 'square', dur: 0.9, vol: v(0.15), lp: 400 }); this.tone({ f: 880, dur: 0.3, vol: v(0.12), delay: 0.9 }); break;
      case 'quest': [392, 523, 659, 784].forEach((f, i) => this.tone({ f, type: 'triangle', dur: 0.25, vol: v(0.18), delay: i * 0.12 })); break;
      case 'music': [392, 494, 587, 784, 587, 494, 659, 784].forEach((f, i) => this.tone({ f, type: 'triangle', dur: 0.35, vol: v(0.12), delay: i * 0.18 })); break;
      case 'click': this.tone({ f: 1200, dur: 0.03, vol: v(0.08) }); break;
      case 'place': this.noise({ dur: 0.2, vol: v(0.25), f: 300 }); this.tone({ f: 200, dur: 0.15, type: 'triangle', vol: v(0.15) }); break;
    }
  }

  // เสียงเครื่องยนต์มอเตอร์ไซค์ (level 0 = ดับ)
  engine(level) {
    if (!this.ctx) return;
    if (!this.eng) {
      const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(this.master); o.start(); this.eng = { o, g };
    }
    const t = this.ctx.currentTime;
    this.eng.o.frequency.setTargetAtTime(45 + level * 110, t, 0.1);
    this.eng.g.gain.setTargetAtTime(this.muted || level <= 0 ? 0 : (0.05 + level * 0.06) * this.vol.engine, t, 0.15);
  }

  // ---------- บรรยากาศต่อเนื่อง ----------
  loop(type, f, q = 1) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(this.master); s.start();
    return { g, fl };
  }
  startAmbience() {
    this.amb = { wind: this.loop('lowpass', 380), rain: this.loop('bandpass', 2600, 0.6), waves: this.loop('lowpass', 520), fire: this.loop('bandpass', 900, 2) };
    // จิ้งหรีดตอนกลางคืน
    // เดิมต่อตัวปรับจังหวะเข้ากับ gain ของระดับเสียงโดยตรง ทำให้มีเสียงหวีดค้างตลอดแม้ตั้งเป็น 0
    // ตอนนี้: ตัวปรับจังหวะ (trem) แยกจากระดับเสียง (g) — g = 0 คือเงียบสนิท
    const c = this.ctx, o = c.createOscillator(), am = c.createOscillator(), amg = c.createGain(), trem = c.createGain(), g = c.createGain();
    o.frequency.value = 4300; am.frequency.value = 28; amg.gain.value = 0.5; trem.gain.value = 0.5; g.gain.value = 0;
    am.connect(amg); amg.connect(trem.gain); o.connect(trem); trem.connect(g); g.connect(this.master); o.start(); am.start();
    this.amb.crickets = { g };
  }
  // เรียกทุกเฟรม: s = {night, rain, coast(0-1), fire(bool), swim}
  ambience(s) {
    if (!this.ctx || !this.amb) return;
    const t = this.ctx.currentTime, set = (n, v) => this.amb[n].g.gain.setTargetAtTime(this.muted ? 0 : v * (this.vol[n] ?? 1), t, 0.5);
    set('wind', 0.05 + (s.night ? 0.02 : 0) + Math.sin(t * 0.3) * 0.015);
    this.amb.wind.fl.frequency.setTargetAtTime(300 + Math.sin(t * 0.17) * 120, t, 0.5);
    set('rain', s.rain ? 0.22 : 0);
    set('waves', s.coast * (0.08 + 0.06 * Math.max(0, Math.sin(t * 0.55))));
    set('fire', s.fire ? 0.035 + Math.random() * 0.05 : 0);
    set('crickets', s.night && !s.rain ? 0.006 : 0);
    if (s.fire && this.vol.fire > 0 && Math.random() < 0.08) this.noise({ dur: 0.02, vol: 0.12 * this.vol.fire, type: 'highpass', f: 3000 });
  }
}
