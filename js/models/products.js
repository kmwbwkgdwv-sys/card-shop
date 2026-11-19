// ===== 商品の3Dモデル（カードパック・BOX・サプライ） =====
import * as THREE from 'three';
import { PRODUCTS, CARD_W, CARD_H } from '../data.js';
import { labelTexture, canvasTex, toTex } from '../textures.js';
import { packCanvas, boxCanvas, cardBackCanvas, cardCanvas } from '../cardart.js';
import { SERIES_BY, CARDS, rarityOrder } from '../cards.js';
import { mat, T, box, rbox, cyl, sph, plane, torus, bakeParts, vcolor } from './geo.js';

const L = (p, v) => mat(0xffffff, { map: labelTexture(p, v), r: 0.45 });
const C = (c, o = {}) => mat(c, { r: 0.5, ...o });
// キャンバスのテクスチャ（あとから絵が届いたら更新）
const texCache = new Map();
function liveTex(key, make) {
  if (texCache.has(key)) return texCache.get(key);
  let t = null;
  const cv = make(() => { if (t) t.needsUpdate = true; });
  t = toTex(cv);
  texCache.set(key, t);
  return t;
}
const matCache = new Map();
function foilMat(key, map, o = {}) {
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ map, roughness: o.r ?? 0.32, metalness: o.m ?? 0.25, alphaTest: o.at ?? 0, side: o.side ?? THREE.FrontSide }));
  return matCache.get(key);
}
// ふっくらしたパックの袋（中央がふくらみ、上下のギザギザ部分は平ら）
function pillow(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d, 10, 12, 1), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2), y = pos.getY(i) / (h / 2), z = pos.getZ(i);
    const k = (1 - x * x * 0.55) * (Math.abs(y) > 0.86 ? 0.08 : 1 - Math.pow(Math.abs(y) / 0.86, 8) * 0.6);
    pos.setZ(i, z * Math.max(0.06, k));
  }
  g.computeVertexNormals();
  return T(g, 0, h / 2, 0);
}
function decal(parts, m, w, h, y, z, both = true) {
  parts.push({ g: T(plane(w, h), 0, y, z + 0.0015), m });
  if (both) parts.push({ g: T(plane(w, h), 0, y, -z - 0.0015, 0, Math.PI), m });
}

const B = {};
// ---- パック ----
for (let s = 1; s <= 8; s++) {
  B['pk' + s] = (p, P) => {
    const [w, h, d] = p.size;
    const t = liveTex('pack' + s, (upd) => packCanvas(s, 256, upd));
    P.push({ g: pillow(w, h, d), m: foilMat('pack' + s, t, { r: 0.28, m: 0.35, at: 0.5 }) });
  };
  // ---- BOX（30パック入り）：正面・ふた・側面に絵 ----
  B['bx' + s] = (p, P) => {
    const [w, h, d] = p.size;
    const se = SERIES_BY[s];
    const front = liveTex('boxF' + s, (upd) => boxCanvas(s, 'front', 500, 300, upd));
    const top = liveTex('boxT' + s, (upd) => boxCanvas(s, 'top', 500, 300, upd));
    const side = liveTex('boxS' + s, (upd) => boxCanvas(s, 'side', 200, 300, upd));
    P.push({ g: box(w - 0.002, h - 0.002, d - 0.002), m: C(se.color, { r: 0.4 }) });
    const fm = foilMat('boxF' + s, front), tm = foilMat('boxT' + s, top), sm = foilMat('boxS' + s, side);
    P.push({ g: T(plane(w, h), 0, h / 2, d / 2), m: fm });
    P.push({ g: T(plane(w, h), 0, h / 2, -d / 2, 0, Math.PI), m: fm });
    P.push({ g: T(plane(w, d), 0, h, 0, -Math.PI / 2), m: tm });
    P.push({ g: T(plane(d, h), w / 2, h / 2, 0, 0, Math.PI / 2), m: sm });
    P.push({ g: T(plane(d, h), -w / 2, h / 2, 0, 0, -Math.PI / 2), m: sm });
    // シュリンク（透明フィルム）
    P.push({ g: box(w + 0.003, h + 0.003, d + 0.003), m: mat(0xffffff, { r: 0.05, m: 0.1, t: true, op: 0.1 }) });
  };
}
Object.assign(B, {
  // スリーブ：細長い箱パッケージ（中にスリーブの束）
  sleeve: (p, P) => sleeveBox(p, P, !!p.premium),
  psleeve: (p, P) => sleeveBox(p, P, true),
  deckcase: (p, P) => {
    const [w, h, d] = p.size;
    P.push({ g: rbox(w, h * 0.78, d, 0.008), m: C(p.color, { r: 0.35 }) });
    P.push({ g: T(rbox(w * 1.02, h * 0.26, d * 1.02, 0.008), 0, h * 0.74), m: C(0x22262e, { r: 0.35 }) });
    P.push({ g: T(plane(w * 0.86, h * 0.5), 0, h * 0.38, d / 2 + 0.002), m: L(p, 'front') });
  },
  loader: (p, P) => {
    const [w, h, d] = p.size;
    P.push({ g: box(w, h, d), m: mat(0xeaf6ff, { r: 0.05, m: 0.1, t: true, op: 0.45 }) });
    P.push({ g: T(box(w * 0.94, h * 0.9, d * 0.6), 0, 0.005), m: mat(0xffffff, { r: 0.1, t: true, op: 0.35 }) });
    P.push({ g: T(box(w + 0.002, h * 0.3, d + 0.002), 0, h * 0.35), m: L(p, 'front') });
  },
  playmat: (p, P) => {
    const [w, h] = p.size, r = w / 2;
    P.push({ g: cyl(r, r, h, 18), m: C(p.color, { r: 0.6 }) });
    P.push({ g: T(cyl(r * 1.01, r * 1.01, h * 0.42, 18, true), 0, h * 0.3), m: L(p, 'wrap') });
    P.push({ g: T(cyl(r * 0.45, r * 0.45, 0.004, 12), 0, h), m: C(0x15151a) });
  },
  binder: (p, P) => {
    const [w, h, d] = p.size;
    P.push({ g: rbox(w, h, d, 0.01), m: C(p.color, { r: 0.55 }) });
    P.push({ g: T(box(0.03, h * 0.98, d * 1.02), -w / 2 + 0.012, 0.003), m: C(0x1f2933, { r: 0.4 }) });
    const t = liveTex('binderArt', () => cardBackCanvas(160));
    P.push({ g: T(plane(w * 0.62, h * 0.62), 0.02, h * 0.55, d / 2 + 0.002), m: foilMat('binderArt', t) });
    P.push({ g: T(plane(w * 0.62, h * 0.62), 0.02, h * 0.55, -d / 2 - 0.002, 0, Math.PI), m: foilMat('binderArt', t) });
    P.push({ g: T(plane(w * 0.8, h * 0.14), 0.02, h * 0.14, d / 2 + 0.002), m: L(p, 'front') });
  },
  storage: (p, P) => {
    const [w, h, d] = p.size;
    P.push({ g: box(w, h, d), m: C(0xf4f1ea, { r: 0.8 }) });
    P.push({ g: T(box(w * 1.03, h * 0.35, d * 1.01), 0, h * 0.66), m: C(0xece6d8, { r: 0.8 }) });
    P.push({ g: T(plane(w * 0.9, h * 0.8), 0, h / 2, d / 2 + 0.006), m: L(p, 'front') });
  },
  dice: (p, P) => {
    const [w, h, d] = p.size;
    P.push({ g: rbox(w, h * 0.45, d, 0.006), m: C(0x1f2933, { r: 0.4 }) });
    P.push({ g: T(box(w, h * 0.55, d), 0, h * 0.45), m: mat(0xffffff, { r: 0.05, t: true, op: 0.25 }) });
    P.push({ g: T(new THREE.IcosahedronGeometry(0.017), -0.015, h * 0.45 + 0.018, 0), m: C(p.color, { r: 0.25 }) });
    P.push({ g: T(new THREE.IcosahedronGeometry(0.014), 0.017, h * 0.45 + 0.015, 0.01), m: C(0x3a86ff, { r: 0.25 }) });
    P.push({ g: T(cyl(0.012, 0.012, 0.004, 14), 0.012, h * 0.45, -0.018), m: C(0xd4af37, { r: 0.3, m: 0.7 }) });
    P.push({ g: T(plane(w * 0.9, h * 0.36), 0, h * 0.22, d / 2 + 0.002), m: L(p, 'front') });
  },
  // フィギュア：窓あきの箱の中にアニモン
  figure: (p, P) => {
    const [w, h, d] = p.size;
    P.push({ g: T(box(w, h, 0.004), 0, 0, -d / 2 + 0.002), m: C(p.color, { r: 0.5 }) });
    for (const sx of [-1, 1]) P.push({ g: T(box(0.004, h, d), sx * (w / 2 - 0.002), 0, 0), m: C(p.color, { r: 0.5 }) });
    P.push({ g: box(w, 0.012, d), m: C(p.color, { r: 0.5 }) });
    P.push({ g: T(box(w, 0.03, d), 0, h - 0.03), m: L(p, 'front') });
    P.push({ g: T(plane(w - 0.01, h - 0.045), 0, (h - 0.03) / 2, d / 2), m: mat(0xffffff, { r: 0.05, t: true, op: 0.18 }) });
    const art = p.art || (p.id === 'figure2' ? '8-030' : '1-014');
    const ct = liveTex('fig' + art, (upd) => cardCanvas(art, 128, upd));
    P.push({ g: T(plane(w * 0.75, h * 0.62), 0, 0.015 + h * 0.31, 0), m: foilMat('fig' + art, ct, { at: 0.5 }) });
  },
  // ぬいぐるみ：ころんとした体と頭、耳・目・ほっぺ（アニモンごとに形を少し変える）
  plush: (p, P) => {
    const [w, h, d] = p.size, mon = p.mon || 'chupi';
    const fur = C(p.color, { r: 0.97 }), belly = C(0xfff7ea, { r: 0.97 }), eye = C(0x1d1d24, { r: 0.25 }), blush = C(0xff9fb2, { r: 0.9 });
    const R = Math.min(w, d) * 0.5;
    if (mon === 'round') { // クッション：平たい丸に顔
      P.push({ g: T(sph(R, 18, 12), 0, h * 0.5, 0, 0, 0, 0, 1, (h * 0.5) / R, 1), m: fur });
      for (const sx of [-1, 1]) {
        P.push({ g: T(sph(R * 0.08, 8, 6), sx * R * 0.3, h * 0.62, R * 0.86, 0, 0, 0, 1, 1.2, 0.4), m: eye });
        P.push({ g: T(sph(R * 0.1, 8, 6), sx * R * 0.5, h * 0.48, R * 0.8, 0, 0, 0, 1, 0.6, 0.3), m: blush });
      }
      return;
    }
    P.push({ g: T(sph(R * 0.86, 16, 12), 0, R * 0.8, 0, 0, 0, 0, 1, 0.92, 0.9), m: fur });
    P.push({ g: T(sph(R * 0.5, 12, 10), 0, R * 0.7, R * 0.42, 0, 0, 0, 1, 1.05, 0.5), m: belly });
    const hy = R * 1.55, hr = R * 0.72;
    P.push({ g: T(sph(hr, 16, 12), 0, hy, R * 0.05), m: fur });
    for (const sx of [-1, 1]) {
      P.push({ g: T(sph(hr * 0.13, 8, 6), sx * hr * 0.36, hy + hr * 0.08, R * 0.05 + hr * 0.9, 0, 0, 0, 1, 1.2, 0.5), m: eye });
      P.push({ g: T(sph(hr * 0.14, 8, 6), sx * hr * 0.6, hy - hr * 0.22, R * 0.05 + hr * 0.75, 0, 0, 0, 1, 0.6, 0.4), m: blush });
      P.push({ g: T(sph(R * 0.22, 8, 6), sx * R * 0.55, R * 0.18, R * 0.35, 0, 0, 0, 1, 0.7, 1.2), m: fur }); // 足
      P.push({ g: T(sph(R * 0.2, 8, 6), sx * R * 0.82, R * 0.85, R * 0.15, 0, 0, sx * 0.6, 1, 1.5, 0.9), m: fur }); // 手
      if (mon === 'cat' || mon === 'bear') P.push({ g: T(cone(hr * 0.36, hr * (mon === 'cat' ? 0.6 : 0.3), 10), sx * hr * 0.55, hy + hr * 0.62, 0, 0, 0, sx * -0.35), m: fur });
      if (mon === 'sheep') P.push({ g: T(torus(hr * 0.22, hr * 0.08, 6, 12), sx * hr * 0.85, hy + hr * 0.3, 0, 0, Math.PI / 2), m: C(0x8a5a3a, { r: 0.6 }) });
    }
    if (mon === 'chupi') { P.push({ g: T(cone(hr * 0.22, hr * 0.4, 8), 0, hy - hr * 0.12, R * 0.05 + hr * 0.92, Math.PI / 2), m: C(0xffa53a, { r: 0.6 }) }); P.push({ g: T(sph(hr * 0.35, 8, 6), 0, hy + hr * 0.95, 0, 0, 0, 0, 0.5, 1.2, 0.8), m: fur }); }
    if (mon === 'sheep') P.push({ g: T(sph(hr * 0.75, 12, 8), 0, hy + hr * 0.55, -hr * 0.1, 0, 0, 0, 1.1, 0.55, 1), m: C(0xffffff, { r: 1 }) });
    if (mon === 'frog') for (const sx of [-1, 1]) { P.push({ g: T(sph(hr * 0.32, 10, 8), sx * hr * 0.42, hy + hr * 0.7, R * 0.1), m: fur }); P.push({ g: T(sph(hr * 0.16, 8, 6), sx * hr * 0.42, hy + hr * 0.78, R * 0.1 + hr * 0.26), m: eye }); }
    if (mon === 'dragon') {
      for (const sx of [-1, 1]) { P.push({ g: T(cone(hr * 0.12, hr * 0.5, 8), sx * hr * 0.35, hy + hr * 0.75, 0, -0.3, 0, sx * -0.25), m: C(0xfff3c4, { r: 0.6 }) }); P.push({ g: T(sph(R * 0.38, 10, 6), sx * R * 0.65, R * 1.15, -R * 0.45, 0, 0, sx * 0.5, 1.2, 0.2, 0.8), m: C(0xffc145, { r: 0.8 }) }); }
      P.push({ g: T(cone(R * 0.22, R * 0.9, 10), 0, R * 0.4, -R * 0.75, -1.3), m: fur });
    }

    // タグ
    P.push({ g: T(box(0.03, 0.04, 0.003), R * 0.7, R * 0.4, R * 0.6, 0, 0.5), m: L(p, 'front') });
  },
  // 缶バッジ・キーホルダー：台紙に付いたグッズ
  badge: (p, P) => {
    const [w, h, d] = p.size;
    P.push({ g: T(box(w, h, 0.004), 0, 0, 0), m: L(p, 'front') });
    const t = liveTex('badge' + p.id, (upd) => cardCanvas(p.art || (p.id === 'badge' ? '1-028' : '2-030'), 128, upd));
    P.push({ g: T(cyl(w * 0.36, w * 0.36, 0.008, 20), 0, h * 0.42, 0.006, Math.PI / 2), m: foilMat('badgeM' + p.id, t, { r: 0.2, m: 0.3 }) });
    P.push({ g: T(new THREE.CylinderGeometry(w * 0.38, w * 0.38, d * 0.5, 20, 1, true), 0, h * 0.42, 0.006, Math.PI / 2), m: mat(0xffffff, { r: 0.05, t: true, op: 0.3 }) });
  },
  // アクリルスタンド：透明な板にキャラの絵、下に台座
  acryl: (p, P) => {
    const [w, h, d] = p.size;
    P.push({ g: T(rbox(w, 0.012, d, 0.006), 0, 0, 0), m: mat(0xeaf6ff, { r: 0.05, t: true, op: 0.5 }) });
    const t = liveTex('acryl', (upd) => cardCanvas('3-031', 160, upd));
    P.push({ g: T(plane(w * 0.9, h * 0.9), 0, 0.012 + h * 0.45, 0), m: foilMat('acrylM', t, { at: 0.5, side: THREE.DoubleSide }) });
    P.push({ g: T(box(w * 0.96, h * 0.95, 0.004), 0, 0.01, 0.003), m: mat(0xffffff, { r: 0.05, t: true, op: 0.18 }) });
  },
  // 消臭スプレー：缶とノズル
  spray: (p, P) => {
    const [w, h] = p.size, r = w / 2;
    P.push({ g: cyl(r, r, h * 0.8, 18), m: C(0xf4f7f6, { r: 0.25, m: 0.6 }) });
    P.push({ g: T(cyl(r * 1.01, r * 1.01, h * 0.55, 18, true), 0, h * 0.1), m: L(p, 'wrap') });
    P.push({ g: T(cyl(r * 0.8, r, h * 0.06, 16), 0, h * 0.8), m: C(0xdfe5e3, { r: 0.2, m: 0.7 }) });
    P.push({ g: T(cyl(r * 0.55, r * 0.6, h * 0.12, 14), 0, h * 0.86), m: C(p.color, { r: 0.4 }) });
    P.push({ g: T(box(r * 0.3, h * 0.04, r * 0.5), 0, h * 0.94, r * 0.25), m: C(0xffffff, { r: 0.4 }) });
  },
  // マンガ：表紙の絵
  manga: (p, P) => {
    const [w, h, d] = p.size;
    P.push({ g: box(w, h, d), m: C(0xf4efe3, { r: 0.9 }) });
    const art = p.art || '7-029';
    const t = liveTex('manga' + art, (upd) => cardCanvas(art, 128, upd));
    P.push({ g: T(plane(w * 0.98, h * 0.98), 0, h / 2, d / 2 + 0.001), m: foilMat('mangaM' + art, t) });
    P.push({ g: T(plane(w * 0.98, h * 0.22), 0, h * 0.86, d / 2 + 0.0015), m: L(p, 'front') });
    P.push({ g: T(plane(d, h), -w / 2 - 0.001, h / 2, 0, 0, -Math.PI / 2), m: C(p.color, { r: 0.5 }) });
  },
  // マグカップ：白いカップに色の帯と取っ手
  mug: (p, P) => {
    const [w, h] = p.size, r = w * 0.4;
    P.push({ g: cyl(r, r * 0.92, h, 20), m: C(0xfafafa, { r: 0.25 }) });
    P.push({ g: T(cyl(r * 1.01, r * 0.95, h * 0.5, 20, true), 0, h * 0.22), m: L(p, 'wrap') });
    P.push({ g: T(torus(h * 0.25, h * 0.05, 8, 14, Math.PI), r * 1.02, h * 0.5, 0, 0, 0, -Math.PI / 2), m: C(0xfafafa, { r: 0.25 }) });
    P.push({ g: T(cyl(r * 0.88, r * 0.88, 0.004, 18), 0, h - 0.006), m: C(0x5a3a22, { r: 0.3 }) });
  },
  // デッキ（スターター・デラックス）：カードの絵が見える箱
  deckbox: (p, P) => {
    const [w, h, d] = p.size, art = p.art || '1-031';
    P.push({ g: box(w, h, d), m: C(p.color, { r: 0.4, m: 0.2 }) });
    const t = liveTex('deck' + art, (upd) => cardCanvas(art, 128, upd));
    P.push({ g: T(plane(w * 0.7, h * 0.7), 0, h * 0.42, d / 2 + 0.001), m: foilMat('deckM' + art, t) });
    P.push({ g: T(plane(w * 0.96, h * 0.18), 0, h * 0.88, d / 2 + 0.0015), m: L(p, 'front') });
    P.push({ g: T(box(w * 1.02, h * 0.04, d * 1.02), 0, h * 0.04), m: C(0xd4af37, { r: 0.3, m: 0.7 }) });
  },
  // ボードゲーム：平たい箱（ふたに絵）
  boardgame: (p, P) => {
    const [w, h, d] = p.size;
    P.push({ g: box(w, h, d), m: C(p.color, { r: 0.5 }) });
    P.push({ g: T(plane(w * 0.96, d * 0.96), 0, h + 0.001, 0, -Math.PI / 2), m: L(p, 'front') });
    P.push({ g: T(plane(w * 0.96, h * 0.9), 0, h / 2, d / 2 + 0.001), m: L(p, 'front') });
  },
  // レジのベルト・かごの中のシングルカード（スリーブに入ったカード）
  _card: (p, P) => {
    const [w, h, d] = p.size;
    const t = liveTex('cardback', () => cardBackCanvas(128));
    P.push({ g: T(plane(w, h), 0, d, 0, -Math.PI / 2), m: foilMat('cardback', t, { at: 0.5 }) });
    P.push({ g: box(w * 1.05, d * 0.8, h * 1.03), m: mat(0xeaf6ff, { r: 0.05, t: true, op: 0.3 }) });
  },
  _play: (p, P) => {
    const [w, h, d] = p.size;
    P.push({ g: box(w, h, d), m: C(0xfff3c4, { r: 0.6 }) });
    P.push({ g: T(plane(w * 0.9, d * 0.9), 0, h + 0.0005, 0, -Math.PI / 2), m: mat(0xffffff, { map: canvasTex(64, 96, (c, W, H) => { c.fillStyle = '#16a34a'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.font = '900 22px sans-serif'; c.textAlign = 'center'; c.fillText('PLAY', W / 2, H / 2 + 8); }), r: 0.6 }) });
  },
});
function sleeveBox(p, P, premium) {
  const [w, h, d] = p.size;
  P.push({ g: box(w, h, d), m: C(premium ? 0x1b1b22 : 0xf2f4f7, { r: 0.4 }) });
  P.push({ g: T(box(w * 0.9, h * 0.92, d * 0.4), 0, 0.004, d * 0.36), m: C(p.color, { r: 0.3, m: premium ? 0.6 : 0.1 }) });
  decal(P, L(p, 'tall'), w * 0.96, h * 0.9, h * 0.5, d / 2);
}

const modelCache = new Map();
// 商品モデル：マテリアル別に結合したパーツ配列
export function productParts(pid) {
  if (modelCache.has(pid)) return modelCache.get(pid);
  const p = PRODUCTS[pid];
  let parts = [], baked;
  const fallback = (pp, P) => P.push({ g: box(...pp.size), m: C(pp.color) });
  try { (B[pid] || B[p.model] || fallback)(p, parts); baked = bakeParts(parts); }
  catch (e) { console.warn('商品モデル失敗', pid, e); parts = []; fallback(p, parts); baked = bakeParts(parts); }
  modelCache.set(pid, baked);
  return baked;
}
export function productMesh(pid, scale = 1) {
  const g = new THREE.Group();
  for (const { g: geo, m } of productParts(pid)) { const o = new THREE.Mesh(geo, m); o.castShadow = true; g.add(o); }
  g.scale.setScalar(scale);
  g.userData.pid = pid;
  return g;
}
// 3Dで並べるシングルカード（表の絵）
const cardMatCache = new Map();
export function cardMaterial(cid) {
  if (cardMatCache.has(cid)) return cardMatCache.get(cid);
  const t = liveTex('card|' + cid, (upd) => cardCanvas(cid, 256, upd));
  // フラッシュ（箔付き）は自分で光る。レアほど少しツヤを強く
  const c = CARDS[cid], ro = c ? rarityOrder(c.r) : 0;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: Math.max(0.12, 0.34 - ro * 0.04), metalness: 0.15 + ro * 0.04, alphaTest: 0.5 });
  if (c?.flash) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = t; m.emissiveIntensity = 0.38; }
  cardMatCache.set(cid, m);
  return m;
}
let _cardGeo = null;
export function cardGeometry() { return _cardGeo ||= new THREE.PlaneGeometry(CARD_W, CARD_H); }
void sph; void torus; void vcolor;
