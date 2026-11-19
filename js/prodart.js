// ===== 商品の絵（パック・BOX以外のグッズ。お店の画面のアイコン用） =====
// 絵文字だと分かりにくいので、Canvas でその商品の形を描く。ぬいぐるみ・フィギュアなどはアニモンの絵を使う。
// 100×100 の座標で描いて、好きな大きさに縮める。
import { CARDS_LIST } from './cards.js';
import { PRODUCTS } from './data.js';
import { artReady, loadArt, cardBackCanvas, fontsReady, rr, mix, DISP, BODY } from './cardart.js';

const L = (c, t) => mix(c, '#ffffff', t), D = (c, t) => mix(c, '#000000', t);
const monArt = (name) => CARDS_LIST.find((c) => c.name === name)?.art || null;
// 商品ごとのアニモン（名前）
const MON = {
  plush1: 'チュピ', plush2: 'セリック', plush3: 'モコメリー', plush4: 'ケロッタ', plush5: 'ドラコンロード', plushBig: 'シドーテンペス', cushion: 'チュピ',
  figure: 'セリック', figure2: 'エンテイオウ', figure4: 'スカイドラゴン', acryl: 'セリック', acryl2: 'ケロッタ', keychain: 'チュピ', snack: 'セリック',
  mug: 'チュピ', tshirt: 'セリック', poster: 'ドラコンロード', playmat2: 'ドラコンロード', playmatW: 'ケロッタ',
  manga: 'セリック', manga2: 'ケロッタ', manga3: 'ドラコ', guidebook: 'ナルメクシア', boardgame: 'チュピ', boardgame2: 'スカイドラゴン',
  starter: 'セリック', starter2: 'ケロッタ', deckEX: 'エンテイオウ', binder: 'チュピ',
  sleeveF: 'セリック', sleeveW: 'ケロッタ', sleeveG: 'モーラ', sleeveE: 'ピコネズ', sleeveP: 'スフィネコ', sleeveD: 'ドラコ',
};
const MULTI = { figure3: ['チュピ', 'ケロッタ', 'セリック'], badge: ['チュピ', 'セリック', 'ケロッタ'] };
const keysOf = (pid) => (MULTI[pid] || (MON[pid] ? [MON[pid]] : [])).map(monArt).filter(Boolean);

// ---------- 描画の道具（100×100 の座標） ----------
function shadow(g, cx, cy, rx, ry = rx * 0.2) {
  g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill(); g.restore();
}
function lin(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([c, t]) => gr.addColorStop(t, c)); return gr; }
// 画像を枠の中に収める（下ぞろえ。mid で中央）
function pic(g, im, x, y, w, h, mid) {
  if (!im) return false;
  const k = Math.min(w / im.width, h / im.height), dw = im.width * k, dh = im.height * k;
  g.drawImage(im, x + (w - dw) / 2, mid ? y + (h - dh) / 2 : y + h - dh, dw, dh);
  return true;
}
function txt(g, s, x, y, size, color, o = {}) {
  g.save();
  const fam = o.f || DISP, wt = o.w || 900;
  g.font = `${wt} ${size}px ${fam}`;
  if (o.max) { const m = g.measureText(s).width; if (m > o.max) g.font = `${wt} ${size * o.max / m}px ${fam}`; }
  g.textAlign = o.a || 'center'; g.textBaseline = 'middle';
  if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.sw || size * 0.28; g.strokeStyle = o.stroke; g.strokeText(s, x, y); }
  g.fillStyle = color; g.fillText(s, x, y);
  g.restore();
}
function gloss(g, x, y, w, h, a = 0.35) {
  g.save(); rr(g, x, y, w, h, 4); g.clip();
  g.fillStyle = lin(g, x, y, x + w, y + h, [['rgba(255,255,255,0)', 0.25], [`rgba(255,255,255,${a})`, 0.38], ['rgba(255,255,255,0)', 0.5]]);
  g.fillRect(x, y, w, h); g.restore();
}
function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
// 箱（ななめ上から見た形）：正面・右の側面・上のふた
function box3(g, x, y, w, h, dx, dy, col, o = {}) {
  poly(g, [[x + w, y], [x + w + dx, y - dy], [x + w + dx, y + h - dy], [x + w, y + h]]); g.fillStyle = o.side || D(col, 0.28); g.fill();
  poly(g, [[x, y], [x + dx, y - dy], [x + w + dx, y - dy], [x + w, y]]); g.fillStyle = o.top || L(col, 0.22); g.fill();
  g.fillStyle = o.front || lin(g, x, y, x, y + h, [[L(col, 0.08), 0], [D(col, 0.08), 1]]); g.fillRect(x, y, w, h);
  if (o.edge !== false) { g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 0.6; g.strokeRect(x, y, w, h); }
}
// 白いふちどり（ゴムのキーホルダー・アクスタ用）
const _sil = new Map();
function silhouette(im, color) {
  const k = im.src + color; if (_sil.has(k)) return _sil.get(k);
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  _sil.set(k, c); return c;
}
function outlined(g, im, x, y, w, h, color = '#ffffff', t = 2.2) {
  if (!im) return;
  const s = silhouette(im, color);
  for (let a = 0; a < 16; a++) pic(g, s, x + Math.cos(a / 16 * 6.283) * t, y + Math.sin(a / 16 * 6.283) * t, w, h, true);
  pic(g, im, x, y, w, h, true);
}
function cardBack(g, x, y, w, h) {
  const cb = cardBackCanvas(160);
  g.save(); rr(g, x, y, w, h, w * 0.08); g.clip(); g.drawImage(cb, x, y, w, h); g.restore();
}
function sparkle(g, x, y, r, col = '#fff') {
  g.save(); g.fillStyle = col; g.beginPath();
  g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r);
  g.fill(); g.restore();
}
const RAINBOW = ['#ff5f6d', '#ffc371', '#fff36b', '#6bff9e', '#5fd4ff', '#a17bff'];

// ---------- 商品の種類ごとの絵 ----------
const DRAW = {
  sleeve(g, p, A) {
    const c = p.color, premium = p.id === 'psleeve', holo = p.id === 'sleeveH', inner = p.id === 'innersleeve';
    shadow(g, 50, 93, 30);
    rr(g, 22, 8, 56, 84, 5);
    g.fillStyle = inner ? 'rgba(235,242,250,0.95)' : holo ? lin(g, 22, 8, 78, 92, RAINBOW.map((x, i) => [x, i / 5])) : premium ? lin(g, 0, 8, 0, 92, [['#2a2350', 0], ['#141128', 1]]) : lin(g, 0, 8, 0, 92, [[L(c, 0.2), 0], [D(c, 0.18), 1]]);
    g.fill();
    if (premium) { rr(g, 23.5, 9.5, 53, 81, 4); g.strokeStyle = '#e8c35a'; g.lineWidth = 1.6; g.stroke(); }
    // 上の帯
    g.save(); rr(g, 22, 8, 56, 84, 5); g.clip(); g.fillStyle = inner ? '#8aa0b8' : premium ? '#e8c35a' : D(c, 0.38); g.fillRect(22, 8, 56, 15); g.restore();
    txt(g, 'ANIMON', 50, 13.5, 7, premium ? '#2a2350' : '#fff', { max: 46 });
    txt(g, inner ? 'INNER SLEEVES' : 'CARD SLEEVES', 50, 19.5, 3.6, premium ? '#2a2350' : '#fff', { f: BODY, max: 46 });
    // 窓：中のスリーブ（カードの裏）が見える
    for (let i = 2; i >= 0; i--) { rr(g, 31 + i * 1.6, 27 + i * 1.2, 38, 50, 3); g.fillStyle = i ? 'rgba(255,255,255,0.55)' : '#fff'; g.fill(); }
    g.save(); rr(g, 32, 28, 36, 48, 2.5); g.clip();
    if (inner) { cardBack(g, 33, 29, 34, 46); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(32, 28, 36, 48); }
    else {
      g.fillStyle = holo ? lin(g, 32, 28, 68, 76, RAINBOW.map((x, i) => [x, i / 5])) : premium ? lin(g, 32, 28, 68, 76, [['#3d3470', 0], ['#7a62d9', 1]]) : lin(g, 32, 28, 68, 76, [[L(c, 0.3), 0], [c, 1]]);
      g.fillRect(32, 28, 36, 48);
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 2; for (let k = -40; k < 60; k += 7) { g.beginPath(); g.moveTo(32 + k, 28); g.lineTo(32 + k + 48, 76); g.stroke(); }
      if (A[0]) { g.beginPath(); g.arc(50, 52, 15, 0, 7); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill(); pic(g, A[0], 37, 39, 26, 26, true); }
      else { g.beginPath(); g.arc(50, 52, 11, 0, 7); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fill(); txt(g, premium ? '★' : 'A', 50, 52.5, 13, '#fff'); }
    }
    g.restore();
    // 枚数のシール
    g.beginPath(); g.arc(68, 80, 9, 0, 7); g.fillStyle = '#ffd84a'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke();
    txt(g, String(p.net || '60枚').replace(/[^0-9]/g, '') || '60', 68, 78.5, 6.5, '#7a4a00');
    txt(g, '枚入', 68, 84, 3.2, '#7a4a00', { f: BODY });
    gloss(g, 22, 8, 56, 84);
  },
  deckcase(g, p) {
    const pearl = p.id === 'deckcaseP', leather = p.id === 'deckcaseL', c = leather ? '#7a4a2a' : p.color;
    shadow(g, 50, 90, 32);
    const front = pearl ? lin(g, 22, 34, 66, 88, [['#fdfcff', 0], ['#e6dcff', 0.4], ['#d9f3ff', 0.7], ['#fff1f6', 1]]) : undefined;
    box3(g, 22, 34, 46, 54, 14, 12, c, { front, top: pearl ? '#f3efff' : undefined, side: pearl ? '#cfc4ea' : undefined });
    // ふた（マグネットの帯）
    g.fillStyle = pearl ? 'rgba(170,150,220,0.35)' : D(c, 0.16); g.fillRect(22, 34, 46, 13);
    g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(22, 47); g.lineTo(68, 47); g.stroke();
    g.beginPath(); g.arc(45, 47, 2.4, 0, 7); g.fillStyle = pearl ? '#b8a6e8' : '#d9dde3'; g.fill();
    if (leather) { g.setLineDash([2, 1.6]); g.strokeStyle = '#e8c38a'; g.lineWidth = 0.8; g.strokeRect(25, 37, 40, 48); g.setLineDash([]); }
    // ロゴ
    g.beginPath(); g.arc(45, 66, 10, 0, 7); g.fillStyle = leather ? '#e8c35a' : 'rgba(255,255,255,0.88)'; g.fill();
    txt(g, 'A', 45, 66.5, 12, leather ? '#5a3418' : pearl ? '#8a73d8' : c);
    txt(g, 'DECK CASE', 45, 81, 4.2, pearl ? '#8a73d8' : '#ffffff', { f: BODY, max: 40 });
    gloss(g, 22, 34, 46, 54, 0.28);
  },
  loader(g, p) {
    const kind = p.id;
    shadow(g, 50, 92, 28);
    if (kind === 'loader') {
      for (let i = 2; i >= 0; i--) { const x = 30 + i * 5, y = 14 + i * 4; cardBack(g, x + 4, y + 4, 28, 40); rr(g, x, y, 36, 48, 3); g.fillStyle = 'rgba(210,232,255,0.35)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.4; g.stroke(); gloss(g, x, y, 36, 48, 0.5); }
      return;
    }
    if (kind === 'gradecase') {
      rr(g, 26, 8, 48, 82, 4); g.fillStyle = 'rgba(214,232,250,0.55)'; g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 1.6; g.stroke();
      rr(g, 29, 11, 42, 15, 2); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#d33'; g.lineWidth = 0.8; g.stroke();
      txt(g, 'GEM MINT', 42, 16, 4.6, '#c62828', { max: 22 }); txt(g, '10', 63, 18.5, 9, '#c62828');
      txt(g, 'ANIMON CARD', 42, 22, 3, '#444', { f: BODY, max: 22 });
      cardBack(g, 33, 30, 34, 52);
      gloss(g, 26, 8, 48, 82, 0.5);
      return;
    }
    const mag = kind === 'magloader';
    cardBack(g, 33, 20, 34, 50);
    rr(g, 27, 13, 46, 64, mag ? 6 : 3);
    if (mag) { g.lineWidth = 6; g.strokeStyle = 'rgba(28,30,40,0.92)'; g.stroke(); g.fillStyle = 'rgba(210,232,255,0.22)'; g.fill(); }
    else { g.fillStyle = 'rgba(210,232,255,0.35)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.6; g.stroke(); g.fillStyle = 'rgba(60,80,110,0.5)'; g.fillRect(30, 15, 40, 1.2); }
    gloss(g, 27, 13, 46, 64, 0.55);
    if (mag) txt(g, 'MAGNET', 50, 84, 5, '#3a3f45');
  },
  playmat(g, p, A) {
    const c = p.color;
    if (p.id === 'poster') {
      shadow(g, 50, 93, 26);
      rr(g, 22, 8, 56, 82, 1.5); g.fillStyle = '#fff'; g.fill();
      g.save(); rr(g, 25, 11, 50, 76, 1); g.clip(); g.fillStyle = lin(g, 0, 11, 0, 87, [[L(c, 0.35), 0], [c, 1]]); g.fillRect(25, 11, 50, 76);
      for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(30 + (i * 37) % 44, 18 + (i * 23) % 50, 3 + (i % 3), 0, 7); g.fill(); }
      pic(g, A[0], 26, 24, 48, 52, true); g.restore();
      txt(g, 'ANIMON', 50, 81, 8, '#fff', { stroke: D(c, 0.3) });
      for (const x of [26, 74]) { g.beginPath(); g.arc(x, 12, 2.2, 0, 7); g.fillStyle = '#e53935'; g.fill(); }
      return;
    }
    shadow(g, 50, 86, 44, 8);
    const q = [[12, 36], [88, 36], [97, 78], [3, 78]];
    g.save(); poly(g, q); g.clip();
    if (p.id === 'playmatS') {
      g.fillStyle = lin(g, 0, 36, 0, 78, [['#1a1440', 0], ['#3a2a7a', 1]]); g.fillRect(0, 30, 100, 50);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + (i % 5) * 0.12})`; g.fillRect((i * 37) % 100, 36 + (i * 53) % 42, 0.9, 0.9); }
      sparkle(g, 70, 48, 5, '#fff6c8'); sparkle(g, 30, 62, 3.5, '#fff6c8');
    } else {
      g.fillStyle = lin(g, 0, 36, 0, 78, [[L(c, 0.25), 0], [D(c, 0.12), 1]]); g.fillRect(0, 30, 100, 50);
      if (p.id === 'playmatW') { g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.4; for (let y = 44; y < 80; y += 7) { g.beginPath(); for (let x = 0; x <= 100; x += 4) g.lineTo(x, y + Math.sin(x / 6 + y) * 1.6); g.stroke(); } }
    }
    if (A[0]) pic(g, A[0], 30, 36, 40, 42, true);
    else { // ふつうのプレイマット：カードを置く場所の線
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.9;
      for (let i = 0; i < 5; i++) { const x = 18 + i * 14 + (i - 2) * 0.8; g.strokeRect(x, 58, 10, 13); }
      g.strokeRect(42, 42, 14, 12);
    }
    g.restore();
    poly(g, q); g.strokeStyle = D(c, 0.35); g.lineWidth = 1.6; g.stroke();
    // 丸めたマット（奥）
    g.fillStyle = lin(g, 0, 26, 0, 36, [[L(c, 0.3), 0], [D(c, 0.25), 1]]); rr(g, 14, 27, 72, 10, 5); g.fill();
    g.beginPath(); g.ellipse(84, 32, 2.6, 5, 0, 0, 7); g.fillStyle = D(c, 0.4); g.fill();
  },
  binder(g, p, A) {
    const c = p.id === 'binderL' ? '#6b3f22' : p.color;
    if (p.id === 'file9') {
      shadow(g, 50, 92, 36);
      rr(g, 14, 10, 72, 80, 3); g.fillStyle = lin(g, 0, 10, 0, 90, [[L(c, 0.2), 0], [c, 1]]); g.fill();
      rr(g, 18, 14, 64, 72, 2); g.fillStyle = 'rgba(255,255,255,0.92)'; g.fill();
      const cols = ['#e8eef5', '#ffd84a', '#c9d3de', '#b388ff', '#e8eef5', '#ff8a65', '#c9d3de', '#4fc3f7', '#e8eef5'];
      for (let i = 0; i < 9; i++) { const x = 21 + (i % 3) * 20.5, y = 17 + Math.floor(i / 3) * 22.5; if (i % 2) cardBack(g, x, y, 17, 20); else { rr(g, x, y, 17, 20, 1.5); g.fillStyle = cols[i]; g.fill(); } rr(g, x - 0.8, y - 0.8, 18.6, 21.6, 1.8); g.strokeStyle = 'rgba(120,140,170,0.45)'; g.lineWidth = 0.6; g.stroke(); }
      gloss(g, 18, 14, 64, 72, 0.4);
      return;
    }
    shadow(g, 50, 92, 32);
    rr(g, 24, 10, 54, 80, 4); g.fillStyle = lin(g, 24, 0, 78, 0, [[D(c, 0.1), 0], [L(c, 0.12), 0.5], [c, 1]]); g.fill();
    rr(g, 18, 10, 12, 80, 3); g.fillStyle = D(c, 0.28); g.fill();
    for (const y of [24, 50, 76]) { g.beginPath(); g.arc(24, y, 2.4, 0, 7); g.fillStyle = '#d9dde3'; g.fill(); g.strokeStyle = '#8a9099'; g.lineWidth = 0.7; g.stroke(); }
    if (p.id === 'binderL') {
      g.setLineDash([2, 1.6]); g.strokeStyle = '#e8c38a'; g.lineWidth = 0.8; rr(g, 33, 14, 41, 72, 3); g.stroke(); g.setLineDash([]);
      txt(g, 'A', 53, 46, 22, '#e8c35a'); txt(g, 'COLLECTION', 53, 68, 5, '#e8c35a', { max: 36 });
    } else {
      g.beginPath(); g.arc(53, 44, 16, 0, 7); g.fillStyle = '#fff'; g.fill();
      if (!pic(g, A[0], 39, 30, 28, 28, true)) txt(g, '📒', 53, 45, 18, '#000');
      rr(g, 34, 66, 38, 10, 3); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fill(); txt(g, 'COLLECTION', 53, 71.2, 5, D(c, 0.3), { max: 34 });
    }
    gloss(g, 24, 10, 54, 80, 0.25);
  },
  storage(g, p) {
    const big = p.id === 'storageL', c = p.color, w = big ? 62 : 46, x = big ? 14 : 22;
    shadow(g, 50, 90, big ? 42 : 32);
    // 中のカード（上からのぞく）
    const cs = ['#e8eef5', '#ffd84a', '#c9d3de', '#ff8a65', '#4fc3f7', '#e8eef5', '#b388ff'];
    for (let i = 0; i < (big ? 9 : 6); i++) { rr(g, x + 3 + i * (w - 8) / (big ? 9 : 6), 30 - (i % 3) * 2, 6, 16, 1); g.fillStyle = cs[i % cs.length]; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 0.4; g.stroke(); }
    box3(g, x, 40, w, 46, 12, 10, c, { top: 'rgba(0,0,0,0)' });
    poly(g, [[x, 40], [x + 12, 30], [x + w + 12, 30], [x + w, 40]]); g.strokeStyle = D(c, 0.3); g.lineWidth = 0.8; g.stroke();
    if (big) { g.strokeStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.moveTo(x + w / 2, 40); g.lineTo(x + w / 2, 86); g.stroke(); }
    rr(g, x + 6, 56, w - 12, 16, 3); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fill();
    txt(g, 'CARD STORAGE', x + w / 2, 62, 5, D(c, 0.35), { max: w - 16 }); txt(g, big ? '2000枚' : '800枚', x + w / 2, 68.5, 4, '#555', { f: BODY });
  },
  dice(g, p) {
    if (p.id === 'counter') {
      shadow(g, 50, 84, 36);
      const tk = [['10', '#e53935', 30, 62], ['50', '#1e88e5', 54, 66], ['100', '#fbc02d', 72, 54], ['10', '#e53935', 42, 44]];
      for (const [n, col, x, y] of tk) { g.beginPath(); g.ellipse(x, y + 3, 13, 9, 0, 0, 7); g.fillStyle = D(col, 0.3); g.fill(); g.beginPath(); g.ellipse(x, y, 13, 9, 0, 0, 7); g.fillStyle = col; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.9; g.stroke(); txt(g, n, x, y + 0.5, n.length > 2 ? 6.5 : 8, '#fff'); }
      return;
    }
    const gold = p.id === 'dicegold';
    shadow(g, 50, 86, 40);
    const cube = (cx, cy, s, col, pipCol) => {
      const top = [[cx, cy - s], [cx + s * 0.95, cy - s * 0.5], [cx, cy], [cx - s * 0.95, cy - s * 0.5]];
      poly(g, top); g.fillStyle = L(col, 0.25); g.fill();
      poly(g, [[cx - s * 0.95, cy - s * 0.5], [cx, cy], [cx, cy + s * 1.05], [cx - s * 0.95, cy + s * 0.55]]); g.fillStyle = col; g.fill();
      poly(g, [[cx + s * 0.95, cy - s * 0.5], [cx, cy], [cx, cy + s * 1.05], [cx + s * 0.95, cy + s * 0.55]]); g.fillStyle = D(col, 0.2); g.fill();
      const dot = (x, y, r = s * 0.12) => { g.beginPath(); g.ellipse(x, y, r, r * 0.65, 0, 0, 7); g.fillStyle = pipCol; g.fill(); };
      dot(cx, cy - s * 0.5, s * 0.16);
      dot(cx - s * 0.68, cy - s * 0.1); dot(cx - s * 0.48, cy + s * 0.25); dot(cx - s * 0.28, cy + s * 0.6);
      dot(cx + s * 0.3, cy - s * 0.05); dot(cx + s * 0.65, cy + s * 0.1); dot(cx + s * 0.3, cy + s * 0.55); dot(cx + s * 0.65, cy + s * 0.7);
    };
    cube(36, 52, 16, gold ? '#e0b33c' : p.color || '#e53935', gold ? '#6b4a00' : '#fff');
    cube(64, 60, 13, gold ? '#f2cf62' : '#f5f5f5', gold ? '#6b4a00' : '#222');
    if (!gold) { g.beginPath(); g.ellipse(76, 34, 10, 10, 0, 0, 7); g.fillStyle = '#e0b33c'; g.fill(); g.strokeStyle = '#b58a1e'; g.lineWidth = 1.2; g.stroke(); txt(g, 'A', 76, 34.5, 10, '#8a6410'); }
    else { sparkle(g, 76, 30, 6); sparkle(g, 22, 34, 4); }
  },
  figure(g, p, A) {
    const big = p.id === 'figure2', ur = p.id === 'figure4', mini = p.id === 'figure3';
    if (mini) {
      shadow(g, 50, 88, 36);
      const caps = [[30, 62, '#ff8a65'], [70, 62, '#4fc3f7'], [50, 46, '#9ccc65']];
      caps.forEach(([x, y, col], i) => {
        g.beginPath(); g.arc(x, y, 17, 0, 7); g.fillStyle = 'rgba(230,240,255,0.55)'; g.fill();
        g.save(); g.beginPath(); g.arc(x, y, 17, 0, 7); g.clip(); g.fillStyle = col; g.fillRect(x - 17, y, 34, 17); pic(g, A[i], x - 12, y - 14, 24, 24, true); g.restore();
        g.beginPath(); g.arc(x, y, 17, 0, 7); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.4; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(x - 6, y - 8, 4, 2.5, -0.6, 0, 7); g.fill();
      });
      txt(g, '？', 50, 84, 12, '#fff', { stroke: '#7a5cff' });
      return;
    }
    const baseW = big ? 34 : 28, by = 84;
    shadow(g, 50, by + 4, baseW + 6);
    if (ur) { const gr = g.createRadialGradient(50, 46, 4, 50, 46, 44); gr.addColorStop(0, 'rgba(255,220,110,0.75)'); gr.addColorStop(1, 'rgba(255,220,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 100, 100); }
    // 台座
    const bc = ur ? '#d9a521' : big ? '#2b2f36' : '#3a3f45';
    g.beginPath(); g.ellipse(50, by, baseW, baseW * 0.25, 0, 0, 7); g.fillStyle = D(bc, 0.25); g.fill();
    g.fillStyle = bc; g.fillRect(50 - baseW, by - 6, baseW * 2, 6);
    g.beginPath(); g.ellipse(50, by - 6, baseW, baseW * 0.25, 0, 0, 7); g.fillStyle = ur ? '#f2cf62' : L(bc, 0.2); g.fill();
    if (big) { rr(g, 40, by - 5, 20, 4, 1); g.fillStyle = '#e8c35a'; g.fill(); txt(g, 'LEGEND', 50, by - 3, 2.8, '#3a2a00'); }
    pic(g, A[0], 50 - (big ? 40 : 32), big ? 8 : 18, big ? 80 : 64, by - (big ? 14 : 24) - (big ? 0 : 0));
    if (ur) { sparkle(g, 22, 24, 6); sparkle(g, 80, 30, 4.5); sparkle(g, 74, 64, 3.5); txt(g, 'UR', 18, by - 10, 9, '#fff', { stroke: '#b58a1e' }); }
  },
  badge(g, p, A) {
    if (p.id === 'snack') {
      shadow(g, 50, 90, 34);
      const c = p.color || '#ffcf6b';
      g.beginPath(); g.moveTo(14, 22); for (let x = 14; x <= 86; x += 4) g.lineTo(x, x % 8 ? 18 : 22); g.lineTo(86, 78); for (let x = 86; x >= 14; x -= 4) g.lineTo(x, x % 8 ? 82 : 78); g.closePath();
      g.fillStyle = lin(g, 0, 18, 0, 82, [[L(c, 0.25), 0], [c, 0.6], [D(c, 0.15), 1]]); g.fill();
      pic(g, A[0], 48, 26, 36, 46, true);
      txt(g, 'アニモン', 32, 34, 8, '#fff', { stroke: D(c, 0.4), max: 34 }); txt(g, 'ウエハース', 32, 46, 7, '#7a3b00', { max: 34 });
      rr(g, 18, 56, 28, 12, 3); g.fillStyle = '#e53935'; g.fill(); txt(g, 'カード1枚入り', 32, 62, 4, '#fff', { f: BODY, max: 26 });
      gloss(g, 14, 18, 72, 64, 0.3);
      return;
    }
    if (p.id === 'keychain' || p.id === 'acryl2') {
      const acr = p.id === 'acryl2';
      shadow(g, 52, 92, 26);
      g.strokeStyle = '#b9c0c8'; g.lineWidth = 2.6; g.beginPath(); g.arc(50, 14, 7, 0, 7); g.stroke();
      g.lineWidth = 1.6; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(50, 23 + i * 4, 1.6, 2.4, 0, 0, 7); g.stroke(); }
      if (acr) { rr(g, 24, 34, 54, 56, 10); g.fillStyle = 'rgba(220,236,255,0.45)'; g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 1.6; g.stroke(); pic(g, A[0], 28, 38, 46, 48, true); gloss(g, 24, 34, 54, 56, 0.55); }
      else outlined(g, A[0], 22, 34, 58, 56, '#ffffff', 2.6);
      return;
    }
    // 缶バッジ（ランダム：3つ）
    const one = (cx, cy, r, im, col) => {
      g.beginPath(); g.arc(cx, cy + 1.6, r, 0, 7); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fill();
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = '#c9cfd6'; g.fill();
      g.save(); g.beginPath(); g.arc(cx, cy, r - 1.4, 0, 7); g.clip(); g.fillStyle = lin(g, 0, cy - r, 0, cy + r, [[L(col, 0.35), 0], [col, 1]]); g.fillRect(cx - r, cy - r, r * 2, r * 2); pic(g, im, cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6, true);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(cx - r * 0.35, cy - r * 0.45, r * 0.45, r * 0.25, -0.5, 0, 7); g.fill(); g.restore();
    };
    shadow(g, 50, 90, 38);
    one(30, 62, 19, A[1], '#ff8a65'); one(70, 62, 19, A[2], '#4fc3f7'); one(50, 38, 22, A[0], '#ffd84a');
  },
  plush(g, p, A) {
    if (p.id === 'cushion') {
      shadow(g, 50, 90, 38);
      g.beginPath(); g.ellipse(50, 54, 40, 34, 0, 0, 7); g.fillStyle = lin(g, 0, 20, 0, 88, [[L(p.color, 0.35), 0], [p.color, 1]]); g.fill();
      g.setLineDash([2.2, 1.8]); g.strokeStyle = D(p.color, 0.25); g.lineWidth = 1; g.beginPath(); g.ellipse(50, 54, 36, 30, 0, 0, 7); g.stroke(); g.setLineDash([]);
      pic(g, A[0], 26, 30, 48, 48, true);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(36, 34, 12, 6, -0.4, 0, 7); g.fill();
      return;
    }
    shadow(g, 50, 92, 32);
    pic(g, A[0], 10, 6, 80, 86);
    // ぬいぐるみのタグ
    g.save(); g.translate(74, 70); g.rotate(0.25);
    rr(g, -6, -3, 13, 16, 2); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#e0e0e0'; g.lineWidth = 0.5; g.stroke();
    g.fillStyle = '#e53935'; g.beginPath(); g.moveTo(0.5, 7); g.bezierCurveTo(-5, 3, -2, -1.5, 0.5, 1.5); g.bezierCurveTo(3, -1.5, 6, 3, 0.5, 7); g.fill();
    txt(g, 'ANIMON', 0.5, 10.5, 2.2, '#e53935');
    g.restore();
  },
  mug(g, p, A) {
    shadow(g, 48, 90, 32);
    g.lineWidth = 6; g.strokeStyle = '#e9edf2'; g.beginPath(); g.ellipse(70, 56, 10, 13, 0, -1.4, 1.4); g.stroke();
    g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,0.12)'; g.stroke();
    rr(g, 22, 28, 48, 58, 7); g.fillStyle = lin(g, 22, 0, 70, 0, [['#dfe4ea', 0], ['#ffffff', 0.35], ['#e3e8ee', 1]]); g.fill();
    g.beginPath(); g.ellipse(46, 29, 24, 5, 0, 0, 7); g.fillStyle = '#f7f9fb'; g.fill(); g.beginPath(); g.ellipse(46, 29.5, 21, 3.8, 0, 0, 7); g.fillStyle = '#6b3d1e'; g.fill();
    g.save(); rr(g, 22, 34, 48, 52, 7); g.clip(); g.fillStyle = p.color || '#ffd84a'; g.fillRect(22, 70, 48, 16); pic(g, A[0], 30, 38, 32, 34, true); g.restore();
    txt(g, 'ANIMON', 46, 79, 5, '#fff');
  },
  boardgame(g, p, A) {
    if (p.id === 'tshirt') {
      shadow(g, 50, 92, 34);
      const c = p.color || '#ffffff';
      poly(g, [[34, 12], [42, 16], [58, 16], [66, 12], [88, 26], [80, 40], [72, 36], [72, 88], [28, 88], [28, 36], [20, 40], [12, 26]]);
      g.fillStyle = lin(g, 0, 12, 0, 88, [[L(c, 0.15), 0], [D(c, 0.08), 1]]); g.fill(); g.strokeStyle = D(c, 0.2); g.lineWidth = 0.9; g.stroke();
      g.beginPath(); g.ellipse(50, 15, 8, 4, 0, 0, Math.PI); g.strokeStyle = D(c, 0.25); g.lineWidth = 1.6; g.stroke();
      pic(g, A[0], 34, 32, 32, 34, true); txt(g, 'ANIMON', 50, 72, 6, D(c, 0.5));
      return;
    }
    const c = p.color;
    shadow(g, 52, 88, 40);
    box3(g, 12, 34, 66, 48, 14, 12, c, { edge: false });
    g.save(); g.beginPath(); g.rect(12, 34, 66, 48); g.clip();
    g.fillStyle = lin(g, 0, 34, 0, 82, [[L(c, 0.3), 0], [c, 1]]); g.fillRect(12, 34, 66, 48);
    pic(g, A[0], 44, 38, 34, 42, true);
    g.restore();
    const t = p.id === 'boardgame2' ? 'アニモン大冒険' : 'アニモンすごろく';
    txt(g, t, 30, 48, 7, '#fff', { stroke: D(c, 0.45), max: 34 });
    txt(g, 'BOARD GAME', 30, 58, 4.2, '#fff', { f: BODY, max: 30 });
    if (p.id === 'boardgame') { g.fillStyle = '#fff'; rr(g, 20, 64, 10, 10, 2); g.fill(); g.fillStyle = '#e53935'; g.beginPath(); g.arc(25, 69, 1.6, 0, 7); g.fill(); }
  },
  acryl(g, p, A) {
    shadow(g, 50, 90, 30);
    g.beginPath(); g.ellipse(50, 86, 24, 5, 0, 0, 7); g.fillStyle = 'rgba(214,232,250,0.8)'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke();
    rr(g, 47, 78, 6, 8, 1); g.fillStyle = 'rgba(214,232,250,0.9)'; g.fill();
    outlined(g, A[0], 18, 8, 64, 72, 'rgba(235,245,255,0.95)', 3);
    g.save(); g.globalAlpha = 0.5; gloss(g, 18, 8, 64, 72, 0.6); g.restore();
  },
  deckbox(g, p, A) {
    const ex = p.id === 'deckEX', c = ex ? '#2b2350' : p.color;
    shadow(g, 50, 90, 30);
    box3(g, 26, 18, 40, 70, 12, 10, c, { front: ex ? lin(g, 26, 18, 66, 88, [['#3d3470', 0], ['#1b1638', 1]]) : undefined });
    g.save(); g.beginPath(); g.rect(26, 18, 40, 70); g.clip();
    g.fillStyle = ex ? 'rgba(232,195,90,0.25)' : 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(46, 54, 22, 0, 7); g.fill();
    pic(g, A[0], 27, 34, 38, 40, true); g.restore();
    rr(g, 28, 21, 36, 11, 2); g.fillStyle = ex ? '#e8c35a' : '#fff'; g.fill();
    txt(g, ex ? 'DELUXE' : 'STARTER', 46, 25, 5.5, ex ? '#2b2350' : D(c, 0.35), { max: 32 }); txt(g, 'DECK', 46, 30, 3.6, ex ? '#2b2350' : D(c, 0.35), { f: BODY });
    txt(g, '60枚', 46, 82, 5, '#fff', { stroke: 'rgba(0,0,0,0.35)' });
    if (ex) { rr(g, 26, 18, 40, 70, 0); g.strokeStyle = '#e8c35a'; g.lineWidth = 1.4; g.stroke(); sparkle(g, 62, 40, 4, '#ffe9a8'); }
    gloss(g, 26, 18, 40, 70, 0.25);
  },
  manga(g, p, A) {
    const c = p.color, guide = p.id === 'guidebook';
    shadow(g, 50, 92, 30);
    g.fillStyle = '#f2efe6'; rr(g, 28, 11, 48, 80, 2); g.fill();
    rr(g, 25, 9, 48, 80, 2); g.fillStyle = lin(g, 0, 9, 0, 89, [[L(c, 0.3), 0], [c, 1]]); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(25, 9, 3, 80);
    g.save(); rr(g, 25, 9, 48, 80, 2); g.clip(); pic(g, A[0], 26, 34, 46, 52, true); g.restore();
    if (guide) { txt(g, 'アニモン', 49, 18, 8, '#fff', { stroke: D(c, 0.45), max: 42 }); txt(g, '公式ガイドブック', 49, 28, 5.5, D(c, 0.5), { max: 42 }); }
    else {
      txt(g, 'アニモン', 49, 17, 8.5, '#fff', { stroke: D(c, 0.45), max: 42 }); txt(g, '冒険記', 49, 27, 7, '#ffd84a', { stroke: D(c, 0.45), max: 40 });
      const n = (p.name.match(/(\d+)巻/) || [])[1] || '1';
      g.beginPath(); g.arc(66, 80, 6, 0, 7); g.fillStyle = '#fff'; g.fill(); txt(g, n, 66, 80.5, 8, D(c, 0.4));
    }
  },
  spray(g, p) {
    shadow(g, 50, 92, 22);
    rr(g, 36, 24, 28, 66, 6); g.fillStyle = lin(g, 36, 0, 64, 0, [['#b9c2cc', 0], ['#ffffff', 0.35], ['#c9d1d9', 1]]); g.fill();
    g.save(); rr(g, 36, 24, 28, 66, 6); g.clip(); g.fillStyle = lin(g, 0, 40, 0, 76, [['#36c08a', 0], ['#1f8f63', 1]]); g.fillRect(36, 40, 28, 36); g.restore();
    txt(g, 'FRESH', 50, 52, 5.6, '#fff'); txt(g, '🌿', 50, 63, 9, '#000'); txt(g, '消臭', 50, 72, 4.4, '#fff', { f: BODY });
    rr(g, 39, 12, 22, 14, 3); g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = '#cfd6dd'; g.lineWidth = 0.8; g.stroke();
    rr(g, 46, 7, 8, 6, 1.5); g.fillStyle = '#36c08a'; g.fill();
    g.fillStyle = 'rgba(54,192,138,0.35)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(60 + i * 3, 9 + Math.sin(i) * 3, 0.8 + (i % 3) * 0.5, 0, 7); g.fill(); }
  },
};

// ---------- まとめ ----------
const cache = new Map();
export const hasProductArt = (pid) => { const p = PRODUCTS[pid]; return !!(p && !p.series && DRAW[p.model]); };
// pid の絵のキャンバス（W×W・背景は透明）。絵が届いたら描き直して onReady を呼ぶ
export function productCanvas(pid, W = 160, onReady) {
  const p = PRODUCTS[pid]; if (!p) return null;
  const k = pid + '|' + W;
  let e = cache.get(k);
  if (!e) {
    const cv = document.createElement('canvas'); cv.width = cv.height = W;
    e = { cv, done: false, cbs: [] }; cache.set(k, e);
    const keys = keysOf(pid);
    const draw = () => {
      const A = keys.map((x) => artReady(x));
      const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, W); g.scale(W / 100, W / 100);
      try { (DRAW[p.model] || fallback)(g, p, A); } catch (err) { fallback(g, p); }
      if (fontsOk && A.every(Boolean) && !e.done) { e.done = true; for (const f of e.cbs.splice(0)) { try { f(cv); } catch (er) { /* noop */ } } }
    };
    let fontsOk = false;
    draw();
    for (const x of keys) loadArt(x).then(draw);
    fontsReady().then(() => { fontsOk = true; draw(); });
  }
  if (onReady) { if (e.done) onReady(e.cv); else e.cbs.push(onReady); }
  return e.cv;
}
function fallback(g, p) { txt(g, p.icon || '📦', 50, 52, 60, '#000'); }
