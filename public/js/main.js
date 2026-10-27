import { Game } from './game.js';
import { Net } from './net.js';
import { RoomNet } from './room-net.js';
import { Sfx } from './audio.js';
import { isTouchDevice } from './touch.js';
import { SKINS, HAIR_STYLES, setGfx } from './models.js';
import { JOBS, ITEMS } from './data.js';

const $ = (s) => document.querySelector(s);
const SHIRTS = ['#2e86ab', '#d1495b', '#6a994e', '#e9c46a', '#3d405b', '#f4f1de', '#9b5de5'];
const HAIRS = ['#1b1b1b', '#4a2c1a', '#8d5524', '#d4a373', '#c0c0c0', '#7b2cbf'];

let saved = null;
try { saved = JSON.parse(localStorage.getItem('cbs_save_v1'))?.profile; } catch { /* no storage */ }
const profile = saved || { id: 'u' + Math.random().toString(36).slice(2, 10), name: '', sex: 'm', look: { skin: SKINS[1], shirt: SHIRTS[0], hair: HAIRS[0] } };

$('#f-name').value = profile.name;
const marks = [];
const refreshSegs = () => { marks.forEach((m) => m()); jobInfo(); };
const seg = (el, opts, cur, set, swatch) => {
  el.innerHTML = opts.map((o) => swatch ? `<button class="sw" data-v="${o}" style="background:${o}"></button>` : '').join('') || el.innerHTML;
  const mark = () => el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === cur())); marks.push(mark);
  el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { set(b.dataset.v); mark(); } });
  mark();
};
seg($('#f-sex'), [], () => profile.sex, (v) => (profile.sex = v));
if (profile.hand !== 'l') profile.hand = 'r';
seg($('#f-hand'), [], () => profile.hand, (v) => (profile.hand = v));
// อาชีพ
if (!JOBS[profile.job]) profile.job = 'engineer';
$('#f-job').innerHTML = Object.entries(JOBS).map(([k, J]) => `<button data-v="${k}" class="job"><b>${J.icon} ${J.name}</b><small>${J.desc}</small></button>`).join('');
const jobInfo = () => { const J = JOBS[profile.job]; $('#f-job-info').innerHTML = `<b>${J.icon} ${J.name}</b> — ความสามารถขั้นสูง:<br>${J.perks.map(([l, t]) => `• ทักษะหลัก Lv${l}: ${t}`).join('<br>')}<br>🎁 ชุดเริ่มต้น: ${Object.entries(J.kit).map(([k, q]) => `${ITEMS[k].icon} ${ITEMS[k].name} ×${q}`).join(', ')}`; };
seg($('#f-job'), [], () => profile.job, (v) => { profile.job = v; jobInfo(); });
jobInfo();
seg($('#f-skin'), SKINS, () => profile.look.skin, (v) => (profile.look.skin = v), true);
seg($('#f-shirt'), SHIRTS, () => profile.look.shirt, (v) => (profile.look.shirt = v), true);
seg($('#f-hair'), HAIRS, () => profile.look.hair, (v) => { profile.look.hair = v; drawPreview(); }, true);
// ทรงผม + ภาพตัวอย่าง
const styleOf = () => (HAIR_STYLES[profile.look.style] ? profile.look.style : profile.sex === 'f' ? 'long' : 'short');
$('#f-style').innerHTML = Object.entries(HAIR_STYLES).map(([k, n]) => `<button data-v="${k}">${n}</button>`).join('');
seg($('#f-style'), [], styleOf, (v) => { profile.look.style = v; drawPreview(); });
function drawPreview() {
  // หน้าตรงแบบพิกเซล (ไม่ต้องโหลด 3D) ให้เห็นทรงผมและสี
  const c = $('#f-preview'); if (!c) return; const x = c.getContext('2d'), L = profile.look, st = styleOf(), P = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  x.clearRect(0, 0, 96, 96); P(L.shirt, 30, 62, 36, 34); P(L.skin, 32, 22, 32, 36);
  P('#111', 40, 38, 5, 5); P('#111', 51, 38, 5, 5);
  const hc = L.hair;
  ({ short: () => { P(hc, 30, 16, 36, 10); }, buzz: () => P(hc, 32, 19, 32, 4), spiky: () => { P(hc, 30, 16, 36, 9); for (let i = 0; i < 5; i++) P(hc, 31 + i * 7, 8 + (i % 2) * 3, 5, 9); },
    mohawk: () => P(hc, 44, 6, 8, 18), afro: () => P(hc, 22, 4, 52, 26), bob: () => { P(hc, 30, 16, 36, 10); P(hc, 28, 22, 6, 24); P(hc, 62, 22, 6, 24); },
    long: () => { P(hc, 30, 16, 36, 10); P(hc, 26, 22, 7, 40); P(hc, 63, 22, 7, 40); }, ponytail: () => { P(hc, 30, 16, 36, 10); P(hc, 66, 24, 8, 26); },
    bun: () => { P(hc, 30, 16, 36, 10); P(hc, 40, 4, 16, 13); }, twin: () => { P(hc, 30, 16, 36, 10); P(hc, 20, 26, 9, 22); P(hc, 67, 26, 9, 22); }, bald: () => {} })[st]();
}
for (const id of ['#f-skin', '#f-shirt', '#f-sex']) $(id).addEventListener('click', () => { marks.forEach((m) => m()); drawPreview(); });
drawPreview();

// คุณภาพกราฟิก (จำไว้ในเครื่อง)
let gfx = 'normal'; try { gfx = localStorage.getItem('cbs_gfx') || (isTouchDevice() ? 'low' : 'normal'); } catch { /* ignore */ }
seg($('#f-gfx'), [], () => gfx, (v) => { gfx = v; try { localStorage.setItem('cbs_gfx', v); } catch { /* ignore */ } });
const useRoom = RoomNet.available();
if (useRoom) { $('#server-row').hidden = true; $('#room-row').hidden = false; }
if (isTouchDevice()) $('#keys-hint').textContent = 'มือถือ: จอยสติ๊กซ้าย = เดิน · ลากจอ = หมุนกล้อง · หยิกสองนิ้ว = ซูม · ⚔️ ตี/เก็บ · ✋ โต้ตอบ · ⤒ กระโดด · 🏃 วิ่ง (แนะนำให้ถือแนวนอน)';
const sfx = new Sfx();
const sameHost = /^https?:$/.test(location.protocol) && !/claude|anthropic|usercontent/.test(location.hostname);
$('#f-server').value = sameHost ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}` : '';

// ---------- เซิร์ฟเวอร์สาธารณะ: สมัคร/เข้าสู่ระบบ แล้วสร้างตัวละครครั้งแรก ----------
let serverMode = false, account = null, token = null, roomNet = null;
const TOKEN_KEY = 'cbs_token';
const api = async (path, body) => {
  const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({ error: 'เซิร์ฟเวอร์ไม่ตอบ' }));
  if (!r.ok) throw new Error(j.error || 'ผิดพลาด');
  return j;
};
const aerr = (t) => { $('#a-err').textContent = t || ''; };
function showAccount() {
  const C = account?.char;
  $('#auth').hidden = !!account; $('#acct').hidden = !account; $('#form').style.display = account ? '' : 'none';
  if (!account) return;
  $('#acct-name').textContent = `${account.username}${account.email ? ' · ' + account.email : ''}`;
  $('#server-row').hidden = true; $('#room-row').hidden = true; $('#b-solo').style.display = 'none';
  $('#f-name-label').textContent = 'ชื่อตัวละคร (ห้ามซ้ำกับผู้เล่นคนอื่น)';
  if (C) { $('#f-name').value = C.name; profile.sex = C.sex; Object.assign(profile.look, C.look); profile.job = C.job; profile.hand = C.hand === 'l' ? 'l' : 'r'; refreshSegs(); }
  $('#b-online').textContent = C ? '▶️ เข้าเกม' : '✨ สร้างตัวละครและเข้าเกม';
  if (account.mustChange) { $('#pwbox').hidden = false; $('#p-err').textContent = 'คุณใช้รหัสผ่านชั่วคราว กรุณาตั้งรหัสผ่านใหม่'; }
}
async function initServerMode() {
  if (!sameHost || useRoom) return;
  try { const r = await fetch('/healthz'); if (!r.ok) return; } catch { return; }
  serverMode = true;
  try { token = localStorage.getItem(TOKEN_KEY); } catch { token = null; }
  if (token) { try { account = (await api('/api/me')).user; } catch { token = null; } }
  $('#auth').hidden = false; showAccount();
}
document.querySelector('#auth .atabs').addEventListener('click', (e) => {
  const a = e.target.closest('button')?.dataset.a; if (!a) return;
  document.querySelectorAll('#auth .atabs button').forEach((b) => b.classList.toggle('on', b.dataset.a === a));
  $('#a-login').hidden = a !== 'login'; $('#a-reg').hidden = a !== 'register'; aerr('');
});
const signedIn = (j) => { token = j.token; account = j.user; try { localStorage.setItem(TOKEN_KEY, token); } catch { /* no storage */ } aerr(''); showAccount(); };
$('#a-go-login').onclick = async () => { try { signedIn(await api('/api/login', { username: $('#a-user').value, password: $('#a-pass').value })); } catch (e) { aerr(e.message); } };
$('#a-go-reg').onclick = async () => {
  if ($('#r-pass').value !== $('#r-pass2').value) return aerr('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
  try { signedIn(await api('/api/register', { email: $('#r-email').value, username: $('#r-user').value, password: $('#r-pass').value })); $('#f-name').focus(); } catch (e) { aerr(e.message); }
};
$('#a-pwbtn').onclick = () => { $('#pwbox').hidden = !$('#pwbox').hidden; $('#p-err').textContent = ''; };
$('#p-cancel').onclick = () => { $('#pwbox').hidden = true; };
$('#p-go').onclick = async () => {
  const pe = (t, ok) => { $('#p-err').textContent = t; $('#p-err').style.color = ok ? '#52b788' : ''; };
  if ($('#p-new').value !== $('#p-new2').value) return pe('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
  try { const j = await api('/api/password', { old: $('#p-old').value, password: $('#p-new').value }); token = j.token; account = j.user; try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ } ['#p-old', '#p-new', '#p-new2'].forEach((s) => ($(s).value = '')); pe('✅ เปลี่ยนรหัสผ่านแล้ว (เครื่องอื่นถูกออกจากระบบ)', true); setTimeout(() => { $('#pwbox').hidden = true; }, 1500); } catch (e) { pe(e.message); }
};
$('#a-logout').onclick = async () => { try { await api('/api/logout', {}); } catch { /* ignore */ } token = null; account = null; try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } showAccount(); };
// ตรวจชื่อตัวละครซ้ำขณะพิมพ์ (โหมดเซิร์ฟเวอร์)
let nameT = 0;
$('#f-name').addEventListener('input', () => {
  if (!serverMode) return; clearTimeout(nameT);
  nameT = setTimeout(async () => { const n = $('#f-name').value.trim(); if (!n) return ($('#f-name-ok').textContent = ''); try { const r = await api('/api/name-check?name=' + encodeURIComponent(n)); $('#f-name-ok').textContent = r.ok ? '✅ ชื่อนี้ใช้ได้' : '❌ ' + r.error; } catch { /* ignore */ } }, 350);
});
initServerMode().then(async () => {
  // ปุ่มสนับสนุนผู้พัฒนา (แสดงเมื่อเจ้าของเซิร์ฟเวอร์ตั้งค่าช่องทางไว้)
  if (!serverMode) return;
  let D = null; try { D = (await api('/api/config')).donate; } catch { /* ไม่มี */ }
  if (!D) return;
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  $('#donate').hidden = false;
  $('#d-box').innerHTML = `${D.note ? `<p>${esc(D.note)}</p>` : '<p>เงินสนับสนุนใช้เป็นค่าเซิร์ฟเวอร์และพัฒนาเกมต่อ ขอบคุณมากครับ 🙏</p>'}
    ${D.promptpay ? `<p>📱 พร้อมเพย์: <b>${esc(D.promptpay)}</b> <button id="d-copy">คัดลอก</button></p>` : ''}
    ${D.url ? `<p>🌐 <a href="${esc(D.url)}" target="_blank" rel="noopener noreferrer">สนับสนุนผ่านลิงก์นี้</a></p>` : ''}
    <p class="hint">การสนับสนุนเป็นความสมัครใจ ไม่ได้ของหรือความได้เปรียบในเกม (เจ้าของอาจให้ป้าย 💖 หน้าชื่อเป็นการขอบคุณ)</p>`;
  $('#d-btn').onclick = () => { $('#d-box').hidden = !$('#d-box').hidden; };
  $('#d-box').addEventListener('click', (e) => { if (e.target.id === 'd-copy') { navigator.clipboard?.writeText(D.promptpay); e.target.textContent = 'คัดลอกแล้ว ✅'; } });
});

async function start(online) {
  const typed = $('#f-name').value.trim();
  if (serverMode) {
    if (!account) return aerr('เข้าสู่ระบบหรือสมัครก่อน');
    try { account = (await api('/api/character', { name: typed, sex: profile.sex, look: profile.look, job: profile.job, hand: profile.hand })).user; } catch (e) { $('#f-name-ok').textContent = '❌ ' + e.message; return; }
    Object.assign(profile, { id: account.id, name: account.char.name });
    online = true;
  } else profile.name = typed || (profile.sex === 'f' ? 'ผู้รอดชีวิตหญิง' : 'ผู้รอดชีวิตชาย');
  // เล่นผ่านลิงก์: ห้ามใช้ชื่อซ้ำกับผู้เล่นคนอื่นในห้อง
  if (online && useRoom) {
    $('#b-online').disabled = true; $('#f-name-ok').textContent = '⏳ กำลังตรวจชื่อ...';
    roomNet ||= new RoomNet();
    const ok = roomNet.online || await roomNet.connect();
    $('#b-online').disabled = false;
    if (ok && !(await roomNet.claimName(profile.name, profile.id))) { $('#f-name-ok').textContent = '❌ ชื่อนี้มีผู้เล่นคนอื่นใช้แล้วในโลกนี้ ลองชื่ออื่น'; return; }
    $('#f-name-ok').textContent = '';
  }
  $('#form').style.display = 'none'; $('#acct').hidden = true; $('#loading').style.display = 'block';
  sfx.unlock(); // ต้องเกิดจากการคลิก
  if (isTouchDevice()) document.documentElement.requestFullscreen?.().catch(() => {});
  const net = useRoom ? roomNet || new RoomNet() : new Net();
  if (serverMode) net.token = token;
  if (online && !net.online) {
    $('#loading-msg').textContent = useRoom ? 'กำลังเข้าห้องออนไลน์...' : 'กำลังเชื่อมต่อเซิร์ฟเวอร์...';
    const ok = useRoom ? await net.connect() : await net.connect(serverMode ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}` : $('#f-server').value.trim());
    if (!ok && serverMode) { $('#loading').innerHTML = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — <a href="">ลองใหม่</a>'; return; }
    if (!ok) $('#loading-msg').textContent = 'เชื่อมต่อไม่ได้ — เริ่มเล่นแบบออฟไลน์แทน';
  }
  await new Promise((r) => setTimeout(r, 50));
  try {
    setGfx(gfx);
    window.game = new Game(profile, net, sfx);
    $('#menu').style.display = 'none';
    window.focus(); window.game.renderer.domElement.focus();
    addEventListener('error', (e) => window.game?.ui.chat('', `⚠️ ข้อผิดพลาด: ${e.message}`, true));
    addEventListener('unhandledrejection', (e) => window.game?.ui.chat('', `⚠️ ข้อผิดพลาด: ${e.reason?.message || e.reason}`, true));
  } catch (err) {
    console.error(err);
    $('#loading').innerHTML = `เกิดข้อผิดพลาด: ${err.message}`;
  }
}
$('#b-solo').onclick = () => start(false);
$('#b-online').onclick = () => start(true);
