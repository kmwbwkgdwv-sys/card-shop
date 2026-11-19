// ===== カードの絵（Canvas 2D で描く）：表面・裏面・パック・BOX =====（three.js 非依存）
// レア度ごとの見た目（ポケカ風）
//  N   … ふつうの枠。絵の窓は無地
//  R   … 絵の窓がホロ（キラキラ）
//  SR  … フルアート（キャラがカード全体に。細かい斜めの凹凸ライン＋銀のホロ）
//  SSR … 色ちがいのキャラ×星空のスペシャルアート（銀のグリッター）
//  HR  … SSR をレインボー加工（キャラも背景も虹色）
//  UR  … SSR をゴールド加工（金の枠・金色のキャラ・金のグリッター）
import { CARDS, SERIES_BY, TYPE_COLOR, TYPE_JA, RARITY } from './cards.js';

export const DISP = '"Dela Gothic One","M PLUS Rounded 1c","Hiragino Maru Gothic ProN",sans-serif';
export const BODY = '"M PLUS Rounded 1c","Hiragino Maru Gothic ProN","Hiragino Sans","Noto Sans JP",sans-serif';
export const CARD_RATIO = 88 / 63;
let ART_BASE = 'img/mon/';
export function setArtBase(b) { ART_BASE = b; }
const TYPE_KANJI = { normal: '無', fire: '炎', water: '水', grass: '草', steel: '鋼', poison: '毒', electric: '雷', ice: '氷', fighting: '闘', ground: '地', flying: '風', psychic: '超', bug: '虫', rock: '岩', ghost: '霊', dragon: '竜', dark: '悪', fairy: '妖' };

// ---------- 色の計算 ----------
function hex2rgb(hex) { let s = String(hex || '#888').replace('#', ''); if (s.length === 3) s = s.split('').map((c) => c + c).join(''); const n = parseInt(s, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgb2hex(r, g, b) { return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); }
export function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
const lighten = (c, t) => mix(c, '#ffffff', t), darken = (c, t) => mix(c, '#000000', t);
function rgba(hex, a) { const [r, g, b] = hex2rgb(hex); return `rgba(${r},${g},${b},${a})`; }
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---------- 描画の道具 ----------
export function rr(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function fitFont(c, text, maxW, size, weight, fam) { let s = size; do { c.font = `${weight} ${s}px ${fam}`; s -= 1; } while (c.measureText(text).width > maxW && s > 6); return s + 1; }
function strokeText(c, text, x, y, fill, stroke, lw) { c.lineJoin = 'round'; c.miterLimit = 2; if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.strokeText(text, x, y); } c.fillStyle = fill; c.fillText(text, x, y); }
function wrapLines(c, text, maxW, maxLines) {
  const out = []; let line = '';
  for (const ch of String(text || '')) {
    if (c.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; if (out.length >= maxLines) break; } else line += ch;
  }
  if (out.length < maxLines && line) out.push(line);
  if (out.length === maxLines && String(text).length > out.join('').length) out[maxLines - 1] = out[maxLines - 1].slice(0, -1) + '…';
  return out;
}
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
// 4本の光の十字（キラッ）
function sparkle(c, x, y, r, col = '#ffffff', a = 1) {
  c.save(); c.globalAlpha *= a; c.fillStyle = col;
  c.beginPath();
  for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4, rad = i % 2 ? r * 0.18 : r; c.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad); }
  c.closePath(); c.fill();
  const g = c.createRadialGradient(x, y, 0, x, y, r * 0.7); g.addColorStop(0, col); g.addColorStop(1, rgba('#ffffff', 0));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 0.7, 0, Math.PI * 2); c.fill();
  c.restore();
}
// 細かい斜めのライン（SR などの凹凸加工）
function etchLines(c, x, y, w, h, gap, col, a, ang = -0.5) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = Math.max(0.6, gap * 0.28);
  const d = Math.hypot(w, h), cx = x + w / 2, cy = y + h / 2, ca = Math.cos(ang), sa = Math.sin(ang);
  c.beginPath();
  for (let t = -d; t <= d; t += gap) { c.moveTo(cx + ca * -d - sa * t, cy + sa * -d + ca * t); c.lineTo(cx + ca * d - sa * t, cy + sa * d + ca * t); }
  c.stroke(); c.restore();
}
function rays(c, cx, cy, n, r0, r1, col, a, seed) {
  const R = rng(seed); c.save(); c.globalAlpha = a; c.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const ang = i / n * Math.PI * 2 + R() * 0.08, wd = (0.012 + R() * 0.03) * Math.PI;
    c.beginPath(); c.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    c.lineTo(cx + Math.cos(ang - wd) * r1, cy + Math.sin(ang - wd) * r1); c.lineTo(cx + Math.cos(ang + wd) * r1, cy + Math.sin(ang + wd) * r1); c.closePath(); c.fill();
  }
  c.restore();
}
function bokeh(c, x, y, w, h, n, col, seed, rMax) {
  const R = rng(seed); c.save();
  for (let i = 0; i < n; i++) {
    const px = x + R() * w, py = y + R() * h, r = rMax * (0.25 + R() * 0.75);
    const g = c.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, rgba(col, 0.32 * R() + 0.08)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}
function glitter(c, x, y, w, h, n, cols, seed, size, amax = 1) {
  const R = rng(seed); c.save();
  for (let i = 0; i < n; i++) { c.globalAlpha = (0.25 + R() * 0.75) * amax; c.fillStyle = cols[Math.floor(R() * cols.length)]; const s = size * (0.4 + R()); c.fillRect(x + R() * w, y + R() * h, s, s); }
  c.restore();
}
const RAINBOW = ['#ff9ad5', '#ffb38a', '#fff08a', '#9cf5b0', '#8fd8ff', '#b9a3ff', '#ff9ad5'];
function rainbowGrad(c, x0, y0, x1, y1, cols = RAINBOW) { const g = c.createLinearGradient(x0, y0, x1, y1); cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col)); return g; }
function goldGrad(c, x0, y0, x1, y1) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  [['#8a5a00', 0], ['#e0b13a', 0.18], ['#fff4b8', 0.32], ['#c9900f', 0.5], ['#ffe27a', 0.66], ['#9a6a08', 0.82], ['#f6d36b', 1]].forEach(([col, t]) => g.addColorStop(t, col));
  return g;
}
function silverGrad(c, x0, y0, x1, y1) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  [['#9aa3ad', 0], ['#eef2f6', 0.22], ['#b8c0c9', 0.42], ['#ffffff', 0.58], ['#a9b2bc', 0.8], ['#e3e8ee', 1]].forEach(([col, t]) => g.addColorStop(t, col));
  return g;
}

// ---------- キャラの絵の読み込み ----------
const imgCache = new Map();
const waiters = new Map();
export function artReady(key) { const e = imgCache.get(key); return e && e.ok ? e.img : null; }
export function loadArt(key) {
  let e = imgCache.get(key);
  if (!e) {
    const img = new Image(); img.decoding = 'async';
    e = { img, ok: false, p: null };
    e.p = new Promise((res) => {
      img.onload = () => { e.ok = true; res(img); for (const f of waiters.get(key) || []) { try { f(); } catch (err) { /* noop */ } } waiters.delete(key); };
      img.onerror = () => { e.ok = false; res(null); };
    });
    img.src = ART_BASE + key + '.webp';
    imgCache.set(key, e);
  }
  return e.p;
}
function whenArt(key, f) { if (artReady(key)) return; (waiters.get(key) || waiters.set(key, []).get(key)).push(f); loadArt(key); }
// フォント（Canvas は読み込み前のフォントで描くと崩れるので待つ）
let _fontsP = null;
export function fontsReady() {
  return _fontsP ||= (async () => {
    try { await Promise.race([Promise.all([document.fonts.load(`40px ${DISP}`), document.fonts.load(`700 20px ${BODY}`), document.fonts.load(`900 20px ${BODY}`)]), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* noop */ }
  })();
}

// 金色・虹色に加工したキャラ（ピクセルを直接いじる。一度作ったら覚えておく）
const fxCache = new Map();
function artFx(img, kind, key) {
  const k = key + '|' + kind;
  if (fxCache.has(k)) return fxCache.get(k);
  const cv = makeCanvas(img.naturalWidth || img.width, img.naturalHeight || img.height), c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(img, 0, 0);
  try {
    const d = c.getImageData(0, 0, cv.width, cv.height), p = d.data, W = cv.width, H = cv.height;
    if (kind === 'gold') {
      // 明るさ → 金のグラデーション（暗い所は焦げ茶、明るい所は白金）
      const stops = [[0, [52, 30, 0]], [0.28, [128, 82, 6]], [0.52, [212, 156, 32]], [0.74, [250, 214, 102]], [0.9, [255, 244, 196]], [1, [255, 255, 240]]];
      const lut = new Uint8ClampedArray(256 * 3);
      for (let i = 0; i < 256; i++) {
        const t = i / 255; let j = 0; while (j < stops.length - 2 && t > stops[j + 1][0]) j++;
        const [t0, c0] = stops[j], [t1, c1] = stops[j + 1], u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
        for (let q = 0; q < 3; q++) lut[i * 3 + q] = c0[q] + (c1[q] - c0[q]) * u;
      }
      for (let i = 0; i < p.length; i += 4) {
        if (!p[i + 3]) continue;
        const l = Math.min(255, Math.round((p[i] * 0.3 + p[i + 1] * 0.55 + p[i + 2] * 0.15) * 1.08));
        p[i] = lut[l * 3]; p[i + 1] = lut[l * 3 + 1]; p[i + 2] = lut[l * 3 + 2];
      }
    } else if (kind === 'rainbow') {
      // 明るさは残して色だけ虹色に（斜めのグラデーション）
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4; if (!p[i + 3]) continue;
        const l = (p[i] * 0.3 + p[i + 1] * 0.55 + p[i + 2] * 0.15) / 255;
        const hue = ((x / W) * 0.55 + (y / H) * 0.75) % 1;
        const [r, g, b] = hsl2rgb(hue, 0.85, 0.42 + l * 0.5);
        const k = 0.72; // 元の色を少し残す
        p[i] = p[i] * (1 - k) + r * k; p[i + 1] = p[i + 1] * (1 - k) + g * k; p[i + 2] = p[i + 2] * (1 - k) + b * k;
      }
    }
    c.putImageData(d, 0, 0);
  } catch (e) { /* 読めないとき（file:// など）は元の絵のまま */ }
  fxCache.set(k, cv);
  return cv;
}
function hsl2rgb(h, s, l) {
  const f = (n) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
  return [f(0), f(8), f(4)];
}

// ---------- 小さな部品 ----------
function typeIcon(c, t, x, y, r, opts = {}) {
  const col = TYPE_COLOR[t] || '#999';
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = r * 0.35; c.shadowOffsetY = r * 0.08;
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, lighten(col, 0.55)); g.addColorStop(0.55, col); g.addColorStop(1, darken(col, 0.35));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.shadowColor = 'transparent';
  c.lineWidth = r * 0.12; c.strokeStyle = opts.ring || 'rgba(255,255,255,0.9)'; c.stroke();
  c.fillStyle = '#ffffff'; c.font = `900 ${r * 1.08}px ${BODY}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.strokeStyle = darken(col, 0.45); c.lineWidth = r * 0.16; c.lineJoin = 'round'; c.strokeText(TYPE_KANJI[t] || '?', x, y + r * 0.06);
  c.fillText(TYPE_KANJI[t] || '?', x, y + r * 0.06);
  c.restore();
}
function stageLabel(card) { return card.stage === 1 ? 'たね' : card.stage === 2 ? '1進化' : '2進化'; }
function rarityTag(c, r, x, y, s) {
  // 右下のレア度マーク
  const txt = r, w = s * (0.55 + txt.length * 0.55), h = s * 1.05;
  c.save();
  let fill;
  if (r === 'HR') fill = rainbowGrad(c, x - w, y, x, y + h);
  else if (r === 'UR') fill = goldGrad(c, x - w, y, x, y + h);
  else if (r === 'SSR') { fill = c.createLinearGradient(x - w, y, x, y + h); fill.addColorStop(0, '#d8f6ff'); fill.addColorStop(0.5, '#7ad7ff'); fill.addColorStop(1, '#e7d6ff'); }
  else if (r === 'SR') fill = silverGrad(c, x - w, y, x, y + h);
  else fill = RARITY[r].color;
  rr(c, x - w, y, w, h, h * 0.3); c.fillStyle = fill; c.fill();
  c.lineWidth = s * 0.09; c.strokeStyle = r === 'N' || r === 'R' ? 'rgba(255,255,255,0.8)' : 'rgba(40,30,60,0.55)'; c.stroke();
  c.fillStyle = r === 'N' || r === 'R' ? '#fff' : r === 'UR' ? '#4a2c00' : '#2a2340';
  c.font = `900 ${s * 0.78}px ${BODY}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(txt, x - w / 2, y + h / 2 + s * 0.04);
  c.restore();
}
function energyRow(c, cost, x, y, r) { cost.forEach((t, i) => typeIcon(c, t, x + i * r * 2.15, y, r, { ring: 'rgba(255,255,255,0.85)' })); return cost.length * r * 2.15; }
function setBadge(c, card, x, y, s, light) {
  const se = SERIES_BY[card.s], n = String(card.no).padStart(3, '0'), cnt = String(se.count).padStart(3, '0');
  c.save();
  c.font = `900 ${s}px ${BODY}`; const tw = c.measureText(se.code).width;
  rr(c, x, y, tw + s * 0.9, s * 1.35, s * 0.3); c.fillStyle = light ? 'rgba(255,255,255,0.88)' : 'rgba(20,24,34,0.85)'; c.fill();
  c.fillStyle = light ? '#20242e' : '#ffffff'; c.textBaseline = 'middle'; c.fillText(se.code, x + s * 0.45, y + s * 0.7);
  c.fillStyle = light ? 'rgba(255,255,255,0.95)' : '#20242e'; c.font = `800 ${s}px ${BODY}`;
  if (light) { c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = s * 0.22; c.lineJoin = 'round'; c.strokeText(`${n}/${cnt}`, x + tw + s * 1.3, y + s * 0.72); }
  c.fillText(`${n}/${cnt}`, x + tw + s * 1.3, y + s * 0.72);
  c.restore();
}

// ---------- カードの表 ----------
// card：CARDS の1枚。W×H のキャンバスに描く。img：キャラの絵（まだなら null）
export function drawCard(c, card, W, H, img) {
  const u = W / 630;
  const full = card.r !== 'N' && card.r !== 'R';
  const col = TYPE_COLOR[card.types[0]] || '#888', col2 = TYPE_COLOR[card.types[1]] || lighten(col, 0.35);
  const seed = hashStr(card.id);
  c.save();
  c.clearRect(0, 0, W, H);
  rr(c, 0, 0, W, H, 26 * u); c.clip();
  // ふち（銀・虹・金）
  const B = 22 * u;
  c.fillStyle = card.r === 'UR' ? goldGrad(c, 0, 0, W, H) : card.r === 'HR' ? rainbowGrad(c, 0, 0, W, H, ['#f4d0ff', '#ffe0c4', '#fff8c6', '#d0ffe0', '#cdeeff', '#e0d4ff', '#f4d0ff']) : silverGrad(c, 0, 0, W, H);
  c.fillRect(0, 0, W, H);
  if (card.r === 'UR' || card.r === 'HR' || card.r === 'SSR') glitter(c, 0, 0, W, H, 900, ['#ffffff', '#fff6d0', '#ffe9ff'], seed, 2.2 * u);
  const ix = B, iy = B, iw = W - B * 2, ih = H - B * 2;
  c.save(); rr(c, ix, iy, iw, ih, 12 * u); c.clip();
  if (!full) drawStandard(c, card, ix, iy, iw, ih, u, col, col2, img, seed);
  else drawFullArt(c, card, ix, iy, iw, ih, u, col, col2, img, seed);
  c.restore();
  // 内側のふちの細い線
  rr(c, ix, iy, iw, ih, 12 * u); c.lineWidth = 2.5 * u; c.strokeStyle = card.r === 'UR' ? 'rgba(90,55,0,0.55)' : 'rgba(30,35,50,0.35)'; c.stroke();
  if (card.flash) drawFlash(c, card, W, H, u, seed);
  c.restore();
}
// フラッシュ（箔付き）：カード全体が輝く（光の帯・箔の粒・きらめき）＋右下に FLASH の箔押し
function drawFlash(c, card, W, H, u, seed) {
  c.save();
  // ふちを虹色の箔に（小さく見ても「フラッシュ」とわかるように）
  const B = 22 * u;
  c.save();
  { const x = B, y = B, w = W - B * 2, h = H - B * 2, r = 12 * u;
    c.beginPath(); c.rect(0, 0, W, H);
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    c.clip('evenodd'); }
  c.globalCompositeOperation = 'screen'; c.globalAlpha = card.r === 'UR' || card.r === 'HR' ? 0.35 : 0.6;
  c.fillStyle = rainbowGrad(c, 0, 0, W, H, ['#ff9ad5', '#fff08a', '#9cf5b0', '#8fd8ff', '#d0a8ff', '#ff9ad5', '#fff08a', '#8fd8ff']);
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  glitter(c, 0, 0, W, H, 380, ['#ffffff', '#fff6d0'], seed + 55, 2.2 * u);
  c.restore();
  c.globalCompositeOperation = 'screen';
  const g = c.createLinearGradient(0, 0, W, H);
  [[0, 'rgba(255,255,255,0)'], [0.18, 'rgba(255,240,200,0.28)'], [0.26, 'rgba(255,255,255,0)'], [0.48, 'rgba(200,240,255,0.26)'], [0.56, 'rgba(255,255,255,0)'], [0.78, 'rgba(255,210,250,0.24)'], [0.86, 'rgba(255,255,255,0)']].forEach(([t, col]) => g.addColorStop(t, col));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'source-over';
  glitter(c, 0, 0, W, H, 760, ['#ffffff', '#fff3b0', '#ffd6f5', '#c8f0ff'], seed + 77, 2.3 * u, 0.85);
  const R = rng(seed + 99);
  for (let i = 0; i < 11; i++) sparkle(c, R() * W, R() * H, (7 + R() * 14) * u, '#ffffff', 0.5 + R() * 0.45);
  // 箔押しのマーク
  const bw = 96 * u, bh = 24 * u, bx = W - 22 * u - 18 * u - bw - 60 * u, by = H - 22 * u - 36 * u;
  rr(c, bx, by, bw, bh, bh * 0.3);
  c.fillStyle = rainbowGrad(c, bx, by, bx + bw, by + bh, ['#fff6c9', '#ffd6f5', '#c8f0ff', '#d9ffd6', '#fff6c9']); c.fill();
  c.lineWidth = 2 * u; c.strokeStyle = 'rgba(90,60,140,0.7)'; c.stroke();
  c.fillStyle = '#4a2f80'; c.font = `900 ${15 * u}px ${BODY}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('✦ FLASH', bx + bw / 2, by + bh / 2 + u);
  c.restore();
}

function drawStandard(c, card, x, y, w, h, u, col, col2, img, seed) {
  // 背景：タイプの色のグラデーション＋光の筋＋点々
  const bg = c.createLinearGradient(x, y, x + w * 0.3, y + h);
  bg.addColorStop(0, lighten(col, 0.72)); bg.addColorStop(0.45, lighten(col, 0.5)); bg.addColorStop(1, lighten(col, 0.28));
  c.fillStyle = bg; c.fillRect(x, y, w, h);
  rays(c, x + w * 0.85, y - h * 0.05, 26, 0, h * 1.4, '#ffffff', 0.13, seed);
  c.save(); c.globalAlpha = 0.09; c.fillStyle = darken(col, 0.3);
  for (let yy = y + 8 * u; yy < y + h; yy += 14 * u) for (let xx = x + ((yy / (14 * u)) % 2 ? 7 * u : 0); xx < x + w; xx += 14 * u) { c.beginPath(); c.arc(xx, yy, 1.6 * u, 0, Math.PI * 2); c.fill(); }
  c.restore();
  // 見出し：進化段階・名前・HP・タイプ
  const hx = x + 22 * u, hy = y + 50 * u;
  c.save();
  rr(c, hx - 6 * u, y + 16 * u, 88 * u, 26 * u, 13 * u); c.fillStyle = silverGrad(c, hx, 0, hx + 90 * u, 0); c.fill();
  c.lineWidth = 1.5 * u; c.strokeStyle = 'rgba(60,70,90,0.5)'; c.stroke();
  c.fillStyle = '#2b3140'; c.font = `900 ${17 * u}px ${BODY}`; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillText(stageLabel(card), hx + 38 * u, y + 30 * u);
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  fitFont(c, card.name, 270 * u, 42 * u, 400, DISP);
  strokeText(c, card.name, hx + 92 * u, hy + 6 * u, '#1d2230', 'rgba(255,255,255,0.9)', 6 * u);
  // HP
  c.textAlign = 'right';
  c.font = `400 ${44 * u}px ${DISP}`; const hpw = c.measureText(String(card.hp)).width;
  strokeText(c, String(card.hp), x + w - 58 * u, hy + 8 * u, '#1d2230', 'rgba(255,255,255,0.85)', 6 * u);
  c.font = `900 ${18 * u}px ${BODY}`; strokeText(c, 'HP', x + w - 64 * u - hpw, hy + 4 * u, '#1d2230', 'rgba(255,255,255,0.85)', 4 * u);
  c.restore();
  typeIcon(c, card.types[0], x + w - 30 * u, hy - 8 * u, 22 * u);
  // 絵の窓
  const ax = x + 26 * u, ay = y + 74 * u, aw = w - 52 * u, ah = 352 * u;
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 10 * u; c.shadowOffsetY = 4 * u;
  c.fillStyle = card.r === 'R' ? goldGrad(c, ax, ay, ax + aw, ay + ah) : silverGrad(c, ax, ay, ax + aw, ay + ah);
  c.fillRect(ax - 7 * u, ay - 7 * u, aw + 14 * u, ah + 14 * u);
  c.restore();
  c.save(); c.beginPath(); c.rect(ax, ay, aw, ah); c.clip();
  sceneBg(c, card, ax, ay, aw, ah, u, col, col2, seed);
  if (card.r === 'R') holoPattern(c, ax, ay, aw, ah, u, seed);
  drawChar(c, img, ax + aw / 2, ay + ah * 0.95, aw * 0.88, ah * 0.92, u, { shadow: true });
  if (card.r === 'R') { c.globalCompositeOperation = 'overlay'; c.fillStyle = rainbowGrad(c, ax, ay, ax + aw, ay + ah); c.globalAlpha = 0.22; c.fillRect(ax, ay, aw, ah); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
  c.restore();
  c.lineWidth = 2 * u; c.strokeStyle = 'rgba(255,255,255,0.7)'; c.strokeRect(ax, ay, aw, ah);
  // 図鑑の帯
  const by = ay + ah + 12 * u;
  c.save();
  const band = c.createLinearGradient(ax, 0, ax + aw, 0); band.addColorStop(0, rgba('#ffffff', 0)); band.addColorStop(0.15, rgba('#ffffff', 0.75)); band.addColorStop(0.85, rgba('#ffffff', 0.75)); band.addColorStop(1, rgba('#ffffff', 0));
  c.fillStyle = band; c.fillRect(ax, by, aw, 26 * u);
  c.fillStyle = '#3a4152'; c.font = `700 ${15 * u}px ${BODY}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(`No.${String(card.sp).padStart(3, '0')}　${card.types.map((t) => TYPE_JA[t]).join('・')}タイプ　${card.legend ? '伝説のアニモン' : `${card.stage}/${card.stages} 段階`}`, x + w / 2, by + 13 * u);
  c.restore();
  // 技
  let ty = by + 42 * u;
  for (const a of card.atk) { ty = attackRow(c, a, x + 24 * u, ty, w - 48 * u, u, false) + 8 * u; }
  // 弱点・抵抗力・にげる
  const wy = y + h - 132 * u;
  c.fillStyle = rgba(darken(col, 0.5), 0.25); c.fillRect(x + 20 * u, wy - 14 * u, w - 40 * u, 1.6 * u);
  weakRow(c, card, x + 26 * u, wy + 12 * u, u, '#2b3140');
  // フレーバー
  c.save();
  const fy = wy + 34 * u;
  rr(c, x + w * 0.36, fy, w * 0.6, 62 * u, 8 * u); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill(); c.lineWidth = 1.5 * u; c.strokeStyle = rgba(darken(col, 0.4), 0.45); c.stroke();
  c.fillStyle = '#3a4152'; c.font = `500 ${13.5 * u}px ${BODY}`; c.textBaseline = 'top';
  wrapLines(c, card.desc, w * 0.6 - 16 * u, 3).forEach((ln, i) => c.fillText(ln, x + w * 0.36 + 8 * u, fy + 7 * u + i * 17.5 * u));
  c.font = `700 ${12 * u}px ${BODY}`; c.fillStyle = '#4b5366'; c.fillText('Illus. ANIMON 3D', x + 24 * u, fy + 4 * u);
  c.restore();
  setBadge(c, card, x + 22 * u, y + h - 32 * u, 14 * u, false);
  rarityTag(c, card.r, x + w - 18 * u, y + h - 34 * u, 22 * u);
}
// 背景の景色（窓の中）
function sceneBg(c, card, x, y, w, h, u, col, col2, seed) {
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, lighten(col2, 0.55)); sky.addColorStop(0.62, lighten(col, 0.7)); sky.addColorStop(0.63, lighten(col, 0.42)); sky.addColorStop(1, mix(col, '#3a2a1a', 0.25));
  c.fillStyle = sky; c.fillRect(x, y, w, h);
  // 遠くの丘
  const R = rng(seed + 7);
  c.save(); c.globalAlpha = 0.35; c.fillStyle = lighten(col, 0.25);
  c.beginPath(); c.moveTo(x, y + h * 0.66);
  for (let i = 0; i <= 8; i++) c.quadraticCurveTo(x + w * (i + 0.5) / 8, y + h * (0.48 + R() * 0.12), x + w * (i + 1) / 8, y + h * (0.6 + R() * 0.05));
  c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath(); c.fill(); c.restore();
  // 光
  const g = c.createRadialGradient(x + w / 2, y + h * 0.5, 10 * u, x + w / 2, y + h * 0.5, w * 0.55);
  g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(x, y, w, h);
  bokeh(c, x, y, w, h * 0.6, 10, '#ffffff', seed, 40 * u);
}
// R：絵の窓のホロ（放射状の虹＋星）
function holoPattern(c, x, y, w, h, u, seed) {
  c.save();
  c.globalCompositeOperation = 'overlay';
  const cx = x + w * 0.5, cy = y + h * 0.45;
  for (let i = 0; i < 36; i++) {
    const a0 = i / 36 * Math.PI * 2, a1 = a0 + Math.PI / 36;
    c.fillStyle = `hsla(${(i * 37) % 360},90%,65%,0.35)`;
    c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, w, a0, a1); c.closePath(); c.fill();
  }
  c.restore();
  const R = rng(seed + 3);
  for (let i = 0; i < 26; i++) sparkle(c, x + R() * w, y + R() * h * 0.7, (4 + R() * 9) * u, '#ffffff', 0.5 + R() * 0.5);
}
// キャラを描く（下をそろえて中央）
function drawChar(c, img, cx, by, maxW, maxH, u, o = {}) {
  if (!img) {
    c.save(); c.globalAlpha = 0.25; c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(cx, by - maxH * 0.4, maxW * 0.22, maxH * 0.32, 0, 0, Math.PI * 2); c.fill(); c.restore();
    return;
  }
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s = Math.min(maxW / iw, maxH / ih), dw = iw * s, dh = ih * s;
  if (o.shadow) {
    c.save(); const g = c.createRadialGradient(cx, by - 4 * u, 2, cx, by - 4 * u, dw * 0.42);
    g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g;
    c.beginPath(); c.ellipse(cx, by - 4 * u, dw * 0.42, dw * 0.08, 0, 0, Math.PI * 2); c.fill(); c.restore();
  }
  c.save();
  if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = o.glowR || 24 * u; }
  c.drawImage(img, cx - dw / 2, by - dh, dw, dh);
  if (o.glow2) { c.shadowColor = o.glow2; c.shadowBlur = (o.glowR || 24 * u) * 0.5; c.drawImage(img, cx - dw / 2, by - dh, dw, dh); }
  c.restore();
}
function attackRow(c, a, x, y, w, u, light) {
  const ink = light ? '#ffffff' : '#1d2230', outline = light ? 'rgba(0,0,0,0.65)' : null;
  const ew = energyRow(c, a.cost, x + 14 * u, y + 20 * u, 13 * u);
  c.save();
  c.textBaseline = 'middle'; c.textAlign = 'left';
  fitFont(c, a.n, w - ew - 120 * u, 30 * u, 900, BODY);
  strokeText(c, a.n, x + ew + 18 * u, y + 21 * u, ink, outline, 5 * u);
  if (a.dmg) { c.textAlign = 'right'; c.font = `400 ${36 * u}px ${DISP}`; strokeText(c, String(a.dmg), x + w, y + 22 * u, ink, outline, 6 * u); }
  if (a.d) {
    c.textAlign = 'left'; c.font = `600 ${14 * u}px ${BODY}`;
    const ln = wrapLines(c, a.d, w - 10 * u, 1)[0] || '';
    strokeText(c, ln, x + 6 * u, y + 52 * u, light ? 'rgba(255,255,255,0.92)' : '#424a5c', outline, 3.5 * u);
  }
  c.restore();
  return y + (a.d ? 66 : 46) * u;
}
function weakRow(c, card, x, y, u, ink, light) {
  c.save(); c.textBaseline = 'middle'; c.font = `800 ${15 * u}px ${BODY}`;
  const lab = (t, xx) => strokeText(c, t, xx, y, ink, light ? 'rgba(0,0,0,0.6)' : null, 4 * u);
  lab('弱点', x);
  if (card.weak) { typeIcon(c, card.weak, x + 52 * u, y, 11 * u); lab('×2', x + 68 * u); }
  lab('抵抗力', x + 150 * u);
  if (card.res) { typeIcon(c, card.res, x + 218 * u, y, 11 * u); lab('−30', x + 234 * u); }
  lab('にげる', x + 330 * u);
  for (let i = 0; i < card.ret; i++) typeIcon(c, 'normal', x + 396 * u + i * 24 * u, y, 10 * u);
  c.restore();
}

// フルアート（SR・SSR・HR・UR）
function drawFullArt(c, card, x, y, w, h, u, col, col2, img, seed) {
  const r = card.r;
  // 背景
  if (r === 'SR') {
    const g = c.createRadialGradient(x + w / 2, y + h * 0.42, 20 * u, x + w / 2, y + h * 0.45, h * 0.8);
    g.addColorStop(0, lighten(col, 0.55)); g.addColorStop(0.4, col); g.addColorStop(1, darken(col, 0.55));
    c.fillStyle = g; c.fillRect(x, y, w, h);
    rays(c, x + w / 2, y + h * 0.42, 40, 30 * u, h, '#ffffff', 0.16, seed);
    bokeh(c, x, y, w, h, 18, lighten(col2, 0.4), seed, 60 * u);
    etchLines(c, x, y, w, h, 4.2 * u, '#ffffff', 0.13);
  } else if (r === 'SSR') {
    const g = c.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#0b1033'); g.addColorStop(0.55, '#161c48'); g.addColorStop(1, '#070a1c');
    c.fillStyle = g; c.fillRect(x, y, w, h);
    bokeh(c, x, y, w, h, 7, col, seed, 220 * u); bokeh(c, x, y, w, h, 6, '#b48cff', seed + 1, 180 * u);
    starfield(c, x, y, w, h, u, seed);
    rings(c, x + w / 2, y + h * 0.43, u, 'rgba(200,230,255,0.22)');
    etchLines(c, x, y, w, h, 5 * u, '#cfe6ff', 0.07);
  } else if (r === 'HR') {
    c.fillStyle = rainbowGrad(c, x, y, x + w, y + h); c.fillRect(x, y, w, h);
    c.globalAlpha = 0.5; c.fillStyle = rainbowGrad(c, x + w, y, x, y + h, ['#ffffff', '#ffd6f0', '#ffffff', '#d6f6ff', '#ffffff']); c.fillRect(x, y, w, h); c.globalAlpha = 1;
    rays(c, x + w / 2, y + h * 0.42, 48, 30 * u, h, '#ffffff', 0.25, seed);
    starfield(c, x, y, w, h, u, seed, '#ffffff', 0.9);
    rings(c, x + w / 2, y + h * 0.43, u, 'rgba(255,255,255,0.45)');
    etchLines(c, x, y, w, h, 4 * u, '#ffffff', 0.22);
    etchLines(c, x, y, w, h, 9 * u, '#b07cff', 0.07, 0.6);
  } else {
    c.fillStyle = goldGrad(c, x, y, x + w * 0.7, y + h); c.fillRect(x, y, w, h);
    const g = c.createRadialGradient(x + w / 2, y + h * 0.42, 10 * u, x + w / 2, y + h * 0.42, h * 0.7);
    g.addColorStop(0, 'rgba(255,250,220,0.85)'); g.addColorStop(0.5, 'rgba(255,220,120,0.15)'); g.addColorStop(1, 'rgba(90,50,0,0.35)');
    c.fillStyle = g; c.fillRect(x, y, w, h);
    rays(c, x + w / 2, y + h * 0.42, 56, 20 * u, h, '#fff7cf', 0.28, seed);
    rays(c, x + w / 2, y + h * 0.42, 56, 20 * u, h, '#6b4300', 0.12, seed + 9);
    etchLines(c, x, y, w, h, 3.6 * u, '#fff3c0', 0.25);
    etchLines(c, x, y, w, h, 3.6 * u, '#6b4300', 0.12, -0.5 + 0.02);
    glitter(c, x, y, w, h, 700, ['#ffffff', '#fff3b0', '#ffd34d'], seed, 2.6 * u);
  }
  // キャラ（大きく）
  const key = card.art;
  let art = img;
  if (img && r === 'UR') art = artFx(img, 'gold', key);
  if (img && r === 'HR') art = artFx(img, 'rainbow', key);
  const glow = r === 'SSR' ? rgba(lighten(col, 0.4), 0.95) : r === 'HR' ? 'rgba(255,255,255,0.95)' : r === 'UR' ? 'rgba(255,240,170,0.95)' : rgba('#ffffff', 0.7);
  drawChar(c, art, x + w / 2, y + h * 0.72, w * 0.98, h * 0.6, u, { glow, glowR: (r === 'SR' ? 18 : 30) * u, glow2: r === 'UR' ? 'rgba(120,70,0,0.8)' : null });
  if (r === 'UR' && art) { // 金のふちどり（エンボス）
    c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.5; c.fillStyle = goldGrad(c, x, y, x + w, y + h); c.fillRect(x, y, w, h); c.restore();
  }
  if (r === 'SSR' || r === 'HR' || r === 'UR') {
    const R = rng(seed + 11);
    for (let i = 0; i < 9; i++) sparkle(c, x + w * (0.1 + R() * 0.8), y + h * (0.12 + R() * 0.55), (8 + R() * 16) * u, r === 'UR' ? '#fffbe0' : '#ffffff', 0.85);
  }
  // 文字：上の見出し
  const light = r !== 'UR';
  const ink = light ? '#ffffff' : '#3a2400', ol = light ? (r === 'HR' ? 'rgba(80,30,120,0.75)' : 'rgba(10,14,30,0.75)') : 'rgba(255,248,210,0.9)';
  c.save();
  // 上の帯（読みやすく）
  const topG = c.createLinearGradient(0, y, 0, y + 110 * u);
  topG.addColorStop(0, light ? 'rgba(0,0,0,0.38)' : 'rgba(255,250,220,0.55)'); topG.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = topG; c.fillRect(x, y, w, 110 * u);
  rr(c, x + 16 * u, y + 16 * u, 88 * u, 26 * u, 13 * u); c.fillStyle = r === 'UR' ? goldGrad(c, x, 0, x + 100 * u, 0) : silverGrad(c, x, 0, x + 100 * u, 0); c.fill();
  c.fillStyle = '#2b3140'; c.font = `900 ${17 * u}px ${BODY}`; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillText(stageLabel(card), x + 60 * u, y + 30 * u);
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  fitFont(c, card.name, 290 * u, 44 * u, 400, DISP);
  strokeText(c, card.name, x + 116 * u, y + 58 * u, ink, ol, 7 * u);
  c.textAlign = 'right';
  c.font = `400 ${46 * u}px ${DISP}`; const hpw = c.measureText(String(card.hp)).width;
  strokeText(c, String(card.hp), x + w - 58 * u, y + 60 * u, ink, ol, 7 * u);
  c.font = `900 ${18 * u}px ${BODY}`; strokeText(c, 'HP', x + w - 64 * u - hpw, y + 54 * u, ink, ol, 5 * u);
  c.restore();
  typeIcon(c, card.types[0], x + w - 30 * u, y + 42 * u, 22 * u);
  // 下の帯：技・弱点・番号
  const bot = c.createLinearGradient(0, y + h * 0.6, 0, y + h);
  if (light) { bot.addColorStop(0, 'rgba(0,0,0,0)'); bot.addColorStop(0.35, 'rgba(0,0,0,0.38)'); bot.addColorStop(1, 'rgba(0,0,0,0.6)'); }
  else { bot.addColorStop(0, 'rgba(255,248,215,0)'); bot.addColorStop(0.35, 'rgba(255,248,215,0.55)'); bot.addColorStop(1, 'rgba(255,248,215,0.8)'); }
  c.fillStyle = bot; c.fillRect(x, y + h * 0.6, w, h * 0.4);
  let ty = y + h - 318 * u;
  for (const a of card.atk) { ty = attackRowFA(c, a, x + 24 * u, ty, w - 48 * u, u, ink, ol) + 6 * u; }
  weakRow(c, card, x + 26 * u, y + h - 84 * u, u, ink, light);
  c.save(); c.font = `700 ${12 * u}px ${BODY}`; c.textBaseline = 'middle';
  strokeText(c, 'Illus. ANIMON 3D', x + 24 * u, y + h - 56 * u, ink, ol, 3 * u); c.restore();
  setBadge(c, card, x + 22 * u, y + h - 34 * u, 14 * u, true);
  rarityTag(c, r, x + w - 18 * u, y + h - 36 * u, 24 * u);
}
function attackRowFA(c, a, x, y, w, u, ink, ol) {
  const ew = energyRow(c, a.cost, x + 14 * u, y + 20 * u, 13 * u);
  c.save(); c.textBaseline = 'middle'; c.textAlign = 'left';
  fitFont(c, a.n, w - ew - 120 * u, 30 * u, 900, BODY);
  strokeText(c, a.n, x + ew + 18 * u, y + 21 * u, ink, ol, 6 * u);
  if (a.dmg) { c.textAlign = 'right'; c.font = `400 ${38 * u}px ${DISP}`; strokeText(c, String(a.dmg), x + w, y + 22 * u, ink, ol, 7 * u); }
  if (a.d) { c.textAlign = 'left'; c.font = `700 ${14 * u}px ${BODY}`; const ln = wrapLines(c, a.d, w - 10 * u, 1)[0] || ''; strokeText(c, ln, x + 6 * u, y + 52 * u, ink, ol, 4 * u); }
  c.restore();
  return y + (a.d ? 68 : 46) * u;
}
function starfield(c, x, y, w, h, u, seed, col = '#ffffff', a = 1) {
  const R = rng(seed + 5);
  c.save();
  for (let i = 0; i < 260; i++) { c.globalAlpha = (0.2 + R() * 0.8) * a; c.fillStyle = R() < 0.15 ? '#bfe3ff' : col; const s = (0.6 + R() * 2.2) * u; c.beginPath(); c.arc(x + R() * w, y + R() * h, s, 0, Math.PI * 2); c.fill(); }
  c.restore();
  for (let i = 0; i < 14; i++) sparkle(c, x + R() * w, y + R() * h, (6 + R() * 14) * u, col, (0.5 + R() * 0.5) * a);
}
function rings(c, cx, cy, u, col) {
  c.save(); c.strokeStyle = col;
  for (let i = 0; i < 6; i++) { c.lineWidth = (i % 2 ? 1.5 : 3) * u; c.beginPath(); c.arc(cx, cy, (120 + i * 38) * u, 0, Math.PI * 2); c.stroke(); }
  c.restore();
}

// ---------- カードの裏 ----------
export function drawBack(c, W, H) {
  const u = W / 630;
  c.save(); c.clearRect(0, 0, W, H);
  rr(c, 0, 0, W, H, 26 * u); c.clip();
  c.fillStyle = '#1a2a6c'; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W / 2, H / 2, 20 * u, W / 2, H / 2, H * 0.7);
  g.addColorStop(0, '#3f6fe0'); g.addColorStop(0.5, '#1d3a9a'); g.addColorStop(1, '#0b1440');
  c.fillStyle = g; c.fillRect(18 * u, 18 * u, W - 36 * u, H - 36 * u);
  // うず
  c.save(); c.translate(W / 2, H / 2);
  for (let i = 0; i < 48; i++) { c.rotate(Math.PI * 2 / 48); c.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(120,180,255,0.07)'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(120 * u, 200 * u, 30 * u, H); c.lineTo(-10 * u, H); c.closePath(); c.fill(); }
  c.restore();
  etchLines(c, 18 * u, 18 * u, W - 36 * u, H - 36 * u, 6 * u, '#9cc3ff', 0.06);
  // 中央のエンブレム（金の八角星の中に青い円と肉球）
  const cx = W / 2, cy = H / 2, R0 = 150 * u;
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 24 * u;
  const star = (r1, r2, n, rot) => { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } c.closePath(); };
  star(R0 * 1.12, R0 * 0.78, 8, -Math.PI / 2); c.fillStyle = goldGrad(c, cx - R0, cy - R0, cx + R0, cy + R0); c.fill();
  c.shadowColor = 'transparent'; c.lineWidth = 4 * u; c.strokeStyle = '#fff3c0'; c.stroke();
  star(R0 * 0.98, R0 * 0.72, 8, -Math.PI / 2 + Math.PI / 8); c.fillStyle = 'rgba(120,70,0,0.35)'; c.fill();
  const eg = c.createRadialGradient(cx - 30 * u, cy - 40 * u, 8 * u, cx, cy, R0 * 0.68);
  eg.addColorStop(0, '#6fb6ff'); eg.addColorStop(0.6, '#2459d6'); eg.addColorStop(1, '#0e2a7a');
  c.fillStyle = eg; c.beginPath(); c.arc(cx, cy, R0 * 0.66, 0, Math.PI * 2); c.fill();
  c.lineWidth = 7 * u; c.strokeStyle = '#ffffff'; c.stroke();
  c.lineWidth = 2 * u; c.strokeStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(cx, cy, R0 * 0.56, 0, Math.PI * 2); c.stroke();
  // 肉球
  c.fillStyle = '#ffffff';
  c.beginPath(); c.ellipse(cx, cy + 18 * u, 34 * u, 28 * u, 0, 0, Math.PI * 2); c.fill();
  for (const [dx, dy, r] of [[-40, -14, 13], [-15, -40, 14], [15, -40, 14], [40, -14, 13]]) { c.beginPath(); c.ellipse(cx + dx * u, cy + dy * u, r * u, r * 1.2 * u, dx * 0.012, 0, Math.PI * 2); c.fill(); }
  sparkle(c, cx + 62 * u, cy - 62 * u, 20 * u, '#ffffff', 0.95);
  c.restore();
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `400 ${76 * u}px ${DISP}`; strokeText(c, 'ANIMON', cx, cy - 230 * u, '#ffd84a', '#1a2a6c', 14 * u);
  c.font = `900 ${30 * u}px ${BODY}`; strokeText(c, 'TRADING CARD GAME', cx, cy + 222 * u, '#ffffff', '#1a2a6c', 8 * u);
  c.restore();
  c.restore();
}

// ---------- パック・BOX ----------
function crimp(c, x, y, w, h, dir) {
  c.beginPath(); const n = Math.round(w / h * 1.6); c.moveTo(x, y + (dir > 0 ? 0 : h));
  for (let i = 0; i <= n; i++) c.lineTo(x + i / n * w, y + (i % 2 ? (dir > 0 ? h : 0) : (dir > 0 ? 0 : h)));
  c.lineTo(x + w, y + (dir > 0 ? h : 0)); c.lineTo(x + w, y + (dir > 0 ? 0 : h)); c.closePath();
}
export function drawPack(c, sid, W, H, img, img2) {
  const se = SERIES_BY[sid], u = W / 300, col = se.color, col2 = se.color2;
  c.save(); c.clearRect(0, 0, W, H);
  const cz = 22 * u; // ギザギザの高さ
  // 本体
  c.save(); c.beginPath(); c.rect(0, cz * 0.6, W, H - cz * 1.2); c.clip();
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, lighten(col, 0.25)); g.addColorStop(0.5, col); g.addColorStop(1, darken(col, 0.45));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  rays(c, W / 2, H * 0.52, 30, 10 * u, H, lighten(col2, 0.3), 0.22, sid * 99);
  bokeh(c, 0, 0, W, H, 14, col2, sid * 7, 50 * u);
  glitter(c, 0, 0, W, H, 260, ['#ffffff', lighten(col2, 0.5)], sid * 13, 1.6 * u);
  if (img2) { c.save(); c.globalAlpha = 0.55; drawChar(c, img2, W * 0.73, H * 0.62, W * 0.62, H * 0.32, u); c.restore(); }
  drawChar(c, img, W * 0.47, H * 0.76, W * 0.95, H * 0.48, u, { glow: rgba(lighten(col2, 0.5), 0.95), glowR: 16 * u });
  // 光沢の斜めの帯
  const sh = c.createLinearGradient(0, 0, W, H * 0.6); sh.addColorStop(0.3, 'rgba(255,255,255,0)'); sh.addColorStop(0.42, 'rgba(255,255,255,0.32)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)');
  c.fillStyle = sh; c.fillRect(0, 0, W, H);
  // ロゴ
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `400 ${46 * u}px ${DISP}`; strokeText(c, 'ANIMON', W / 2, 58 * u, '#ffd84a', darken(col, 0.55), 9 * u);
  c.font = `900 ${14 * u}px ${BODY}`; strokeText(c, 'TRADING CARD GAME', W / 2, 88 * u, '#ffffff', darken(col, 0.55), 4 * u);
  rr(c, W / 2 - 50 * u, 102 * u, 100 * u, 22 * u, 11 * u); c.fillStyle = 'rgba(255,255,255,0.92)'; c.fill();
  c.fillStyle = darken(col, 0.3); c.font = `900 ${13 * u}px ${BODY}`; c.fillText('拡張パック', W / 2, 113.5 * u);
  // 弾名
  const ny = H * 0.82;
  rr(c, 10 * u, ny - 34 * u, W - 20 * u, 72 * u, 14 * u); c.fillStyle = rgba(darken(col, 0.6), 0.55); c.fill();
  fitFont(c, se.name, W - 40 * u, 34 * u, 400, DISP);
  strokeText(c, se.name, W / 2, ny - 6 * u, '#ffffff', darken(col, 0.6), 7 * u);
  c.font = `900 ${13 * u}px ${BODY}`; strokeText(c, se.en, W / 2, ny + 22 * u, col2, darken(col, 0.6), 4 * u);
  // 5枚入り・弾コード
  c.save(); c.fillStyle = '#e8322b'; c.beginPath(); c.arc(W - 36 * u, 150 * u, 24 * u, 0, Math.PI * 2); c.fill(); c.lineWidth = 3 * u; c.strokeStyle = '#fff'; c.stroke();
  c.fillStyle = '#fff'; c.font = `900 ${12 * u}px ${BODY}`; c.fillText('5枚', W - 36 * u, 145 * u); c.font = `900 ${10 * u}px ${BODY}`; c.fillText('入り', W - 36 * u, 159 * u); c.restore();
  c.font = `900 ${12 * u}px ${BODY}`; c.textAlign = 'left'; strokeText(c, se.code, 14 * u, H - cz - 12 * u, '#ffffff', 'rgba(0,0,0,0.5)', 3 * u);
  c.restore();
  // ギザギザ（上下）
  c.fillStyle = silverGrad(c, 0, 0, W, 0);
  crimp(c, 0, 0, W, cz, -1); c.fill();
  crimp(c, 0, H - cz, W, cz, 1); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.12)'; for (let x0 = 0; x0 < W; x0 += 3 * u) { c.fillRect(x0, 2 * u, 1 * u, cz - 4 * u); c.fillRect(x0, H - cz + 2 * u, 1 * u, cz - 4 * u); }
  c.restore();
}
// BOX の面：front（正面・横長）/ top（ふた）/ side（側面）
export function drawBox(c, sid, face, W, H, img, img2) {
  const se = SERIES_BY[sid], u = H / 300, col = se.color, col2 = se.color2;
  c.save(); c.clearRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, lighten(col, 0.2)); g.addColorStop(0.55, col); g.addColorStop(1, darken(col, 0.5));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  rays(c, W * 0.6, H * 0.5, 36, 10 * u, W, lighten(col2, 0.3), 0.2, sid * 31);
  glitter(c, 0, 0, W, H, 300, ['#ffffff', lighten(col2, 0.5)], sid * 17, 1.6 * u);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (face === 'front' || face === 'top') {
    if (img2) { c.save(); c.globalAlpha = 0.6; drawChar(c, img2, W * 0.86, H * 0.92, W * 0.34, H * 0.7, u); c.restore(); }
    drawChar(c, img, W * 0.66, H * 0.96, W * 0.5, H * 0.92, u, { glow: rgba(lighten(col2, 0.5), 0.95), glowR: 14 * u });
    c.font = `400 ${50 * u}px ${DISP}`; strokeText(c, 'ANIMON', W * 0.25, 62 * u, '#ffd84a', darken(col, 0.55), 10 * u);
    c.font = `900 ${14 * u}px ${BODY}`; strokeText(c, 'TRADING CARD GAME', W * 0.25, 94 * u, '#ffffff', darken(col, 0.55), 4 * u);
    fitFont(c, se.name, W * 0.46, 38 * u, 400, DISP); strokeText(c, se.name, W * 0.25, 150 * u, '#ffffff', darken(col, 0.6), 8 * u);
    c.font = `900 ${14 * u}px ${BODY}`; strokeText(c, se.en, W * 0.25, 182 * u, col2, darken(col, 0.6), 4 * u);
    rr(c, W * 0.25 - 92 * u, 206 * u, 184 * u, 40 * u, 12 * u); c.fillStyle = '#e8322b'; c.fill(); c.lineWidth = 3 * u; c.strokeStyle = '#fff'; c.stroke();
    c.fillStyle = '#fff'; c.font = `900 ${19 * u}px ${BODY}`; c.fillText('BOOSTER BOX', W * 0.25, 220 * u);
    c.font = `800 ${11 * u}px ${BODY}`; c.fillText('拡張パック 30パック入り', W * 0.25, 237 * u);
  } else {
    c.font = `400 ${Math.min(W * 0.18, 34 * u)}px ${DISP}`; strokeText(c, 'ANIMON', W / 2, H * 0.3, '#ffd84a', darken(col, 0.55), 6 * u);
    fitFont(c, se.name, W * 0.9, 22 * u, 400, DISP); strokeText(c, se.name, W / 2, H * 0.6, '#ffffff', darken(col, 0.6), 5 * u);
    c.font = `900 ${12 * u}px ${BODY}`; strokeText(c, se.code + ' 30PACKS', W / 2, H * 0.82, col2, darken(col, 0.6), 3 * u);
  }
  // ふちの金色ライン
  c.lineWidth = 6 * u; c.strokeStyle = goldGrad(c, 0, 0, W, H); c.strokeRect(3 * u, 3 * u, W - 6 * u, H - 6 * u);
  c.restore();
}

// ---------- キャンバスをまとめて作る（キャッシュ・絵が届いたら描き直し） ----------
const cvCache = new Map();
// 同期版：すぐキャンバスを返す（絵がまだなら仮の絵）。絵が届いたら描き直して onReady(canvas)
export function cardCanvas(cid, W = 630, onReady) {
  const card = CARDS[cid];
  const k = cid + '|' + W;
  let e = cvCache.get(k);
  if (!e) {
    const H = Math.round(W * CARD_RATIO), cv = makeCanvas(W, H);
    e = { cv, done: false, cbs: [] };
    cvCache.set(k, e);
    const draw = () => { const img = artReady(card.art); drawCard(cv.getContext('2d'), card, W, H, img); if (img) { e.done = true; const cbs = e.cbs.splice(0); for (const f of cbs) { try { f(cv); } catch (err) { /* noop */ } } } };
    if (card) { draw(); if (!e.done) { whenArt(card.art, draw); fontsReady().then(draw); } }
  }
  if (onReady) { if (e.done) onReady(e.cv); else e.cbs.push(onReady); }
  return e.cv;
}
// 絵が届いてから描いたキャンバス（Promise）
export function cardCanvasAsync(cid, W = 630) {
  return fontsReady().then(() => loadArt(CARDS[cid]?.art)).then(() => new Promise((res) => { const cv = cardCanvas(cid, W, res); if (cvCache.get(cid + '|' + W)?.done) res(cv); }));
}
let _back = new Map();
export function cardBackCanvas(W = 630) {
  if (!_back.has(W)) { const cv = makeCanvas(W, Math.round(W * CARD_RATIO)); const d = () => drawBack(cv.getContext('2d'), cv.width, cv.height); d(); fontsReady().then(d); _back.set(W, cv); }
  return _back.get(W);
}
export function packCanvas(sid, W = 300, onReady) {
  const k = 'pack|' + sid + '|' + W;
  let e = cvCache.get(k);
  const se = SERIES_BY[sid];
  if (!e) {
    const H = Math.round(W * 5 / 3), cv = makeCanvas(W, H);
    e = { cv, done: false, cbs: [] }; cvCache.set(k, e);
    const a1 = String(se.feature), a2 = String(se.feature2);
    const draw = () => { const i1 = artReady(a1), i2 = artReady(a2); drawPack(cv.getContext('2d'), sid, W, H, i1, i2); if (i1 && i2) { e.done = true; for (const f of e.cbs.splice(0)) { try { f(cv); } catch (err) { /* noop */ } } } };
    draw(); whenArt(a1, draw); whenArt(a2, draw); fontsReady().then(draw);
  }
  if (onReady) { if (e.done) onReady(e.cv); else e.cbs.push(onReady); }
  return e.cv;
}
export function boxCanvas(sid, face, W, H, onReady) {
  const k = `box|${sid}|${face}|${W}x${H}`;
  let e = cvCache.get(k);
  const se = SERIES_BY[sid];
  if (!e) {
    const cv = makeCanvas(W, H);
    e = { cv, done: false, cbs: [] }; cvCache.set(k, e);
    const a1 = String(se.feature), a2 = String(se.feature2);
    const draw = () => { const i1 = artReady(a1), i2 = artReady(a2); drawBox(cv.getContext('2d'), sid, face, W, H, i1, i2); if (i1 && i2) { e.done = true; for (const f of e.cbs.splice(0)) { try { f(cv); } catch (err) { /* noop */ } } } };
    draw(); whenArt(a1, draw); whenArt(a2, draw); fontsReady().then(draw);
  }
  if (onReady) { if (e.done) onReady(e.cv); else e.cbs.push(onReady); }
  return e.cv;
}
export function preloadArt(keys) { for (const k of keys) loadArt(k); }
