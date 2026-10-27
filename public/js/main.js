import { Game } from './game.js';
import { Net } from './net.js';
import { RoomNet } from './room-net.js';
import { Sfx } from './audio.js';
import { isTouchDevice } from './touch.js';
import { setGfx } from './models.js';
import { SKINS, SHIRTS, HAIRS, PANTS, HAIR_STYLES, EYES, MOUTHS, BROWS, EXTRAS, randomLook } from './look-core.js';
import { JOBS, ITEMS, PERK_PTS } from './data.js';

const $ = (s) => document.querySelector(s);

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
const jobInfo = () => { const J = JOBS[profile.job]; $('#f-job-info').innerHTML = `<b>${J.icon} ${J.name}</b> — ความสามารถขั้นสูง:<br>${J.perks.map(([l, t], i) => J.free ? `• ${i ? `เลเวลตัวละคร ${l}` : 'เริ่มต้น'}: ${t}` : `• สเตตัสสายนี้ ${PERK_PTS[i]} แต้ม: ${t}`).join('<br>')}${J.free ? '' : '<br>🎓 เริ่มต้นได้ 5 แต้มในสายนี้ · ทุกเลเวลได้ +1 แต้ม ลงสายอื่นได้'}${J.happyNote ? '<br>' + J.happyNote : ''}<br>🎁 ชุดเริ่มต้น: ${Object.entries(J.kit).map(([k, q]) => `${ITEMS[k].icon} ${ITEMS[k].name} ×${q}`).join(', ')}`; };
seg($('#f-job'), [], () => profile.job, (v) => { profile.job = v; jobInfo(); });
jobInfo();
seg($('#f-skin'), SKINS, () => profile.look.skin, (v) => (profile.look.skin = v), true);
seg($('#f-shirt'), SHIRTS, () => profile.look.shirt, (v) => (profile.look.shirt = v), true);
seg($('#f-pants'), PANTS, () => profile.look.pants || PANTS[0], (v) => (profile.look.pants = v), true);
seg($('#f-hair'), HAIRS, () => profile.look.hair, (v) => (profile.look.hair = v), true);
// ทรงผม หน้าตา + ภาพตัวอย่าง
const styleOf = () => (HAIR_STYLES[profile.look.style] ? profile.look.style : profile.sex === 'f' ? 'long' : 'short');
const opt = (id, table, key, def) => { $(id).innerHTML = Object.entries(table).map(([k, n]) => `<button data-v="${k}">${n}</button>`).join(''); seg($(id), [], () => (table[profile.look[key]] ? profile.look[key] : def()), (v) => (profile.look[key] = v)); };
opt('#f-style', HAIR_STYLES, 'style', styleOf);
opt('#f-eyes', EYES, 'eyes', () => 'normal');
opt('#f-brows', BROWS, 'brows', () => 'thin');
opt('#f-mouth', MOUTHS, 'mouth', () => 'smile');
opt('#f-extra', EXTRAS, 'extra', () => 'none');
// 🎲 สุ่มทุกอย่าง: ชื่อ เพศ อาชีพ มือถนัด และหน้าตา
const NAMES_M = ['ต้นกล้า', 'ภูผา', 'ธนวัฒน์', 'กิตติ', 'อาทิตย์', 'ปกรณ์', 'ชลธี', 'วายุ', 'ศรราม', 'เมฆา', 'ก้องภพ', 'ณัฐ', 'บุญมี', 'ทะเล', 'พายุ', 'เพชร'];
const NAMES_F = ['ต้นข้าว', 'ใบเตย', 'น้ำฝน', 'ดาวเหนือ', 'พลอย', 'มะลิ', 'ฟ้าใส', 'แพรวา', 'ขวัญใจ', 'จันทร์เพ็ญ', 'ปลายฟ้า', 'รุ้ง', 'ลำดวน', 'กุหลาบ', 'นภา', 'อิงดาว'];
$('#f-rand').onclick = () => {
  const R = (a) => a[Math.floor(Math.random() * a.length)];
  profile.sex = ['m', 'f', 'x'][Math.floor(Math.random() * 3)];
  profile.job = R(Object.keys(JOBS)); profile.hand = Math.random() < 0.15 ? 'l' : 'r';
  profile.look = randomLook(profile.sex);
  $('#f-name').value = R(profile.sex === 'f' ? NAMES_F : profile.sex === 'm' ? NAMES_M : [...NAMES_M, ...NAMES_F]) + (Math.random() < 0.5 ? '' : Math.floor(Math.random() * 90 + 10));
  $('#f-name').dispatchEvent(new Event('input'));
  refreshSegs(); drawPreview();
};
function drawPreview() {
  // หน้าตรงแบบพิกเซล (ไม่ต้องโหลด 3D) ให้เห็นทรงผมและสี
  const c = $('#f-preview'); if (!c) return; const x = c.getContext('2d'), L = profile.look, st = styleOf(), P = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  x.clearRect(0, 0, 96, 96); P(L.shirt, 30, 62, 36, 34); P(L.skin, 32, 22, 32, 36);
  const hc = L.hair, mc = '#7a2e2e';
  for (const ex of [41, 52]) ({ round: () => { P('#fff', ex - 2, 36, 7, 7); P('#111', ex, 38, 3, 4); }, sleepy: () => P('#111', ex - 1, 40, 6, 2), sharp: () => P('#111', ex - 1, 38, 7, 3), happy: () => { P('#111', ex - 1, 39, 2, 2); P('#111', ex + 1, 37, 2, 2); P('#111', ex + 3, 39, 2, 2); }, wink: () => (ex > 45 ? P('#111', ex - 1, 40, 6, 2) : P('#111', ex - 1, 38, 5, 5)) }[L.eyes] || (() => P('#111', ex - 1, 38, 5, 5)))();
  if (L.brows !== 'none') for (const ex of [41, 52]) P(hc, ex - 2, L.brows === 'angry' ? (ex < 45 ? 33 : 33) : 32, 8, L.brows === 'thick' ? 3 : 2);
  ({ flat: () => P(mc, 43, 50, 10, 2), grin: () => { P(mc, 40, 48, 16, 5); P('#fff', 41, 48, 14, 2); }, open: () => P('#3a1010', 45, 48, 6, 6), smirk: () => { P(mc, 44, 50, 9, 2); P(mc, 52, 48, 2, 2); }, frown: () => { P(mc, 43, 49, 10, 2); P(mc, 41, 51, 2, 2); P(mc, 53, 51, 2, 2); } }[L.mouth] || (() => { P(mc, 43, 51, 10, 2); P(mc, 41, 49, 2, 2); P(mc, 53, 49, 2, 2); }))();
  ({ glasses: () => { x.strokeStyle = '#222'; x.lineWidth = 2; x.strokeRect(37, 35, 10, 10); x.strokeRect(49, 35, 10, 10); }, sunglasses: () => P('#111', 35, 35, 26, 8), beard: () => { P(hc, 32, 50, 32, 8); P(hc, 32, 40, 4, 14); P(hc, 60, 40, 4, 14); }, mustache: () => P(hc, 41, 46, 14, 3), goatee: () => P(hc, 44, 54, 8, 5),
    freckles: () => { for (const [a, b] of [[37, 44], [40, 46], [56, 44], [59, 46]]) P('#8d5524', a, b, 2, 2); }, blush: () => { P('#f28482', 35, 44, 6, 3); P('#f28482', 55, 44, 6, 3); }, scar: () => { for (let i = 0; i < 5; i++) P('#9d4b4b', 56 + i, 33 + i * 2, 2, 2); }, bandana: () => P('#c1121f', 32, 26, 32, 4) }[L.extra] || (() => {}))();
  ({ short: () => { P(hc, 30, 16, 36, 10); }, buzz: () => P(hc, 32, 19, 32, 4), spiky: () => { P(hc, 30, 16, 36, 9); for (let i = 0; i < 5; i++) P(hc, 31 + i * 7, 8 + (i % 2) * 3, 5, 9); },
    mohawk: () => P(hc, 44, 6, 8, 18), afro: () => P(hc, 22, 4, 52, 26), bob: () => { P(hc, 30, 16, 36, 10); P(hc, 28, 22, 6, 24); P(hc, 62, 22, 6, 24); },
    long: () => { P(hc, 30, 16, 36, 10); P(hc, 26, 22, 7, 40); P(hc, 63, 22, 7, 40); }, ponytail: () => { P(hc, 30, 16, 36, 10); P(hc, 66, 24, 8, 26); },
    bun: () => { P(hc, 30, 16, 36, 10); P(hc, 40, 4, 16, 13); },
    curly: () => { for (let i = 0; i < 5; i++) P(hc, 28 + i * 8, 10 + (i % 2) * 3, 9, 12); P(hc, 28, 20, 6, 10); P(hc, 62, 20, 6, 10); }, sidepart: () => { P(hc, 30, 16, 36, 9); P(hc, 46, 22, 18, 5); P(hc, 62, 22, 4, 12); },
    undercut: () => { P(hc, 34, 12, 28, 10); P(hc, 46, 20, 16, 5); }, mullet: () => { P(hc, 30, 16, 36, 10); P(hc, 28, 28, 6, 30); P(hc, 62, 28, 6, 30); }, pixie: () => { P(hc, 30, 16, 36, 10); P(hc, 34, 24, 16, 5); },
    braid: () => { P(hc, 30, 16, 36, 10); for (let i = 0; i < 4; i++) P(hc, 64, 26 + i * 9, 8 - i, 8); }, twin: () => { P(hc, 30, 16, 36, 10); P(hc, 20, 26, 9, 22); P(hc, 67, 26, 9, 22); }, bald: () => {} })[st]?.();
}
for (const id of ['#f-skin', '#f-shirt', '#f-sex', '#f-hair', '#f-style', '#f-eyes', '#f-brows', '#f-mouth', '#f-extra']) $(id).addEventListener('click', () => { marks.forEach((m) => m()); drawPreview(); });
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
