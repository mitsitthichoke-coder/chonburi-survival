// 🌐 ภาษาไทย / English — แปลข้อความบนหน้าจออัตโนมัติด้วยพจนานุกรม (i18n-en.js)
// ข้อความในเกมเขียนเป็นภาษาไทย เมื่อเลือกอังกฤษ ตัวแปลจะแทนที่ข้อความไทยบนหน้าเว็บ (และป้ายในฉาก 3 มิติ) ทันที
const KEY = 'cbs_lang';
const THAI = /[฀-๿][฀-๿ \w\d.,:()%/+\-×·!?~]*[฀-๿!)]|[฀-๿]+/g;
let lang = 'th';
try { if (localStorage.getItem(KEY) === 'en') lang = 'en'; } catch { /* storage blocked */ }
let dict = null, keys = null;
const cache = new Map(), subs = [], HAS_TH = /[\u0e00-\u0e7f]/;
export const getLang = () => lang;
export const onLang = (f) => subs.push(f);

async function loadDict() {
  if (dict) return;
  dict = (await import('./i18n-en.js')).default;
  keys = Object.keys(dict).filter((k) => k.length >= 3).sort((a, b) => b.length - a.length);
}
// แปลข้อความไทยหนึ่งช่วง: ตรงทั้งช่วงก่อน ไม่งั้นแทนคำ/วลีที่รู้จักจากยาวไปสั้น
function run(t) {
  const s = t.trim(); if (dict[s]) return t.replace(s, dict[s]);
  let out = s;
  for (const k of keys) if (out.includes(k)) { out = out.split(k).join(` ${dict[k]} `); if (!/[฀-๿]/.test(out)) break; }
  out = out.replace(/[\u0e00-\u0e7f]+/g, (w) => dict[w] ?? w); // คำสั้นที่เหลือ (เช่น ม. = m)
  return t.replace(s, out.replace(/\s{2,}/g, ' ').replace(/\s+([,.:;!?)])/g, '$1').replace(/\(\s+/g, '(').trim());
}
export function tr(text) {
  if (lang !== 'en' || !dict || !text || !/[฀-๿]/.test(text)) return text;
  let r = cache.get(text);
  if (r === undefined) { r = text.replace(THAI, (m) => run(m)); if (cache.size > 20000) cache.clear(); cache.set(text, r); }
  return r;
}

// ---------- แปลหน้าเว็บ (เก็บข้อความเดิมไว้เพื่อสลับกลับเป็นไทย) ----------
const orig = new WeakMap(), done = new WeakMap(), ATTRS = ['placeholder', 'title', 'aria-label'];
const skip = (n) => { const p = n.parentNode; return !p || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE' || p.nodeName === 'TEXTAREA'; };
function doText(n) {
  if (skip(n) || done.get(n) === n.data) return;
  const src = n.data; if (!/[฀-๿]/.test(src)) return;
  const out = tr(src); if (out !== src) { orig.set(n, src); n.data = out; done.set(n, out); }
}
function doAttrs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a); if (!v || !HAS_TH.test(v) || el.__trAttr?.[a] === v) continue;
    const out = tr(v); if (out === v) continue;
    (el.__thAttr ||= {})[a] = v; (el.__trAttr ||= {})[a] = out; el.setAttribute(a, out);
  }
}
function walk(root) {
  if (root.nodeType === 3) return doText(root);
  if (root.nodeType !== 1) return;
  doAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
}
let obs = null;
function startObserver() {
  if (obs) return;
  obs = new MutationObserver((list) => {
    if (lang !== 'en') return;
    for (const m of list) {
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doAttrs(m.target);
      else for (const n of m.addedNodes) walk(n);
    }
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
function restoreThai() {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) { const o = orig.get(n); if (o !== undefined && done.get(n) === n.data) { n.data = o; done.delete(n); } }
    else if (n.__thAttr) { for (const [a, v] of Object.entries(n.__thAttr)) if (n.getAttribute(a) === n.__trAttr?.[a]) n.setAttribute(a, v); n.__thAttr = null; n.__trAttr = null; }
  }
}
const syncDoc = () => { document.documentElement.lang = lang; document.title = lang === 'en' ? 'Chonburi: Day of Collapse' : 'ชลบุรี: วันล่มสลาย'; };

export async function setLang(l) {
  lang = l === 'en' ? 'en' : 'th';
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  if (lang === 'en') { await loadDict(); startObserver(); walk(document.body); } else restoreThai();
  syncDoc(); for (const f of subs) f(lang);
}
// ปุ่มสลับภาษา (ใช้ได้ทั้งหน้าเมนูและในเกม)
export function bindLangButton(btn) {
  const sync = () => { btn.textContent = lang === 'en' ? 'TH' : 'EN'; btn.title = lang === 'en' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English'; };
  btn.addEventListener('click', (ev) => { ev.stopPropagation(); setLang(lang === 'en' ? 'th' : 'en'); });
  onLang(sync); sync();
}
export const i18nReady = lang === 'en' ? setLang('en') : Promise.resolve();
