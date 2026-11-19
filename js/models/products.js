// ===== 商品の3Dモデル（カードパック・BOX・サプライ） =====
import * as THREE from 'three';
import { PRODUCTS, CARD_W, CARD_H } from '../data.js';
import { labelTexture, canvasTex, toTex } from '../textures.js';
import { packCanvas, boxCanvas, cardBackCanvas, cardCanvas, mix } from '../cardart.js';
import { productFace, faceAspect, DICE_COL } from '../prodart.js';
import { SERIES_BY, CARDS, rarityOrder } from '../cards.js';
import { mat, T, box, rbox, cyl, sph, plane, torus, cone, bakeParts, vcolor } from './geo.js';

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
// ---- グッズ：お店の画面のアイコンと同じ絵（prodart.js）を面に貼る ----
// 面のテクスチャ（2Dの絵から切り出し／専用に描いた面）
function faceTex(pid, face, W = 128, aspect) {
  const a = aspect ?? faceAspect(pid, face), H = Math.max(8, Math.round(W * a));
  return liveTex(`face|${pid}|${face}|${W}`, (upd) => productFace(pid, face, W, H, () => upd()));
}
const faceMat = (pid, face, o = {}) => foilMat(`fm|${pid}|${face}|${o.W || 128}`, faceTex(pid, face, o.W || 128, o.aspect), { r: o.r ?? 0.5, m: o.m ?? 0.04, at: o.at ?? 0, side: o.side });
const lite = (c, t) => mix(c, '#ffffff', t), dark = (c, t) => mix(c, '#000000', t);
// 上の面（水平の板）：先に寝かせてから回す
const flat = (w, d, x, y, z, ry = 0) => T(T(plane(w, d), 0, 0, 0, -Math.PI / 2), x, y, z, 0, ry);
// 箱の上の面の色・本体の色（2Dの絵と同じ）
const deckBody = (p) => (p.id === 'deckcaseL' ? '#7a4a2a' : p.id === 'deckcaseP' ? '#efeaff' : p.id === 'deckEX' ? '#2b2350' : p.color);
Object.assign(B, {
  // スリーブ：パッケージの表と裏に絵
  sleeve: (p, P) => sleeveBox(p, P),
  psleeve: (p, P) => sleeveBox(p, P),
  // デッキケース：箱の正面に絵、ふたは明るい色
  deckcase: (p, P) => {
    const [w, h, d] = p.size, c = deckBody(p);
    P.push({ g: box(w, h, d), m: C(c, { r: 0.35 }) });
    P.push({ g: flat(w, d, 0, h + 0.0008, 0), m: C(lite(c, 0.22), { r: 0.35 }) });
    decal(P, faceMat(p.id, 'front'), w * 0.995, h * 0.995, h / 2, d / 2);
  },
  // ローダー類：透明なケースの中にカード（鑑定ケースはラベル、マグネットは黒いふち）
  loader: (p, P) => {
    const [w, h, d] = p.size, cb = foilMat('cardback', liveTex('cardback', () => cardBackCanvas(128)), { at: 0.5 });
    const grade = p.id === 'gradecase', ch = grade ? h * 0.66 : h * 0.78, cy = grade ? h * 0.36 : h * 0.47;
    P.push({ g: T(plane(w * 0.78, ch), 0, cy, 0.001), m: cb });
    P.push({ g: T(plane(w * 0.78, ch), 0, cy, -0.001, 0, Math.PI), m: cb });
    P.push({ g: box(w, h, d), m: mat(0xeaf6ff, { r: 0.05, m: 0.1, t: true, op: 0.35 }) });
    if (p.id === 'magloader') {
      const k = C(0x1c1e28, { r: 0.4 }), t = 0.011;
      P.push({ g: box(w, t, d * 1.04), m: k }); P.push({ g: T(box(w, t, d * 1.04), 0, h - t), m: k });
      for (const sx of [-1, 1]) P.push({ g: T(box(t, h, d * 1.04), sx * (w / 2 - t / 2), 0), m: k });
    }
    if (grade) P.push({ g: T(plane(w * 0.9, w * 0.9 * 0.34), 0, h - w * 0.2, d / 2 + 0.001), m: faceMat(p.id, 'label', { aspect: 0.34 }) });
    if (p.id === 'toploader') P.push({ g: T(box(w * 0.9, 0.002, d * 1.01), 0, h - 0.006), m: C(0x3c506e, { r: 0.3 }) });
  },
  // プレイマット：丸めたマットに、マットの絵の帯／ポスター：丸めた筒に、ポスターの絵
  playmat: (p, P) => {
    const [w, h] = p.size, r = w / 2;
    P.push({ g: cyl(r, r, h, 20), m: C(p.id === 'poster' ? '#f4f4f0' : p.color, { r: 0.6 }) });
    P.push({ g: T(cyl(r * 0.45, r * 0.45, 0.004, 12), 0, h), m: C(0x15151a) });
    if (p.id === 'poster') {
      const tl = Math.PI, a = faceAspect(p.id, 'front'), bh = Math.min(h * 0.8, tl * r * 1.012 * a);
      P.push({ g: T(cyl(r * 1.012, r * 1.012, bh, 24, true, -tl / 2, tl), 0, (h - bh) / 2), m: faceMat(p.id, 'front') });
      return;
    }
    const bh = Math.min(h * 0.6, 2 * Math.PI * r * 1.012 * 0.42);
    P.push({ g: T(cyl(r * 1.012, r * 1.012, bh, 28, true), 0, (h - bh) / 2), m: faceMat(p.id, 'mat', { aspect: 0.42, W: 256 }) });
  },
  // バインダー・9ポケットファイル：表紙の絵
  binder: (p, P) => {
    const [w, h, d] = p.size, c = p.id === 'binderL' ? '#6b3f22' : p.color;
    P.push({ g: rbox(w, h, d, 0.008), m: C(c, { r: 0.55 }) });
    decal(P, faceMat(p.id, 'front'), w * 0.99, h * 0.99, h / 2, d / 2 + 0.0005);
  },
  // ストレージボックス：箱の正面にラベル、上からカードがのぞく
  storage: (p, P) => {
    const [w, h, d] = p.size, cs = [0xe8eef5, 0xffd84a, 0xc9d3de, 0xff8a65, 0x4fc3f7, 0xb388ff];
    P.push({ g: box(w, h, d), m: C(p.color, { r: 0.7 }) });
    for (let i = 0; i < 6; i++) P.push({ g: T(box(w * 0.82, 0.016, 0.003), 0, h - 0.008 + (i % 3) * 0.003, -d / 2 + 0.03 + i * (d - 0.06) / 5), m: C(cs[i], { r: 0.5 }) });
    decal(P, faceMat(p.id, 'front'), w * 0.99, h * 0.99, h / 2, d / 2);
  },
  // サイコロ（2つ＋コイン）／ダメージカウンター（コマの山）
  dice: (p, P) => {
    if (p.id === 'counter') {
      for (const [x, z, vs] of [[-0.016, 0.008, [10, 10]], [0.018, -0.004, [50, 100]]]) {
        vs.forEach((v, i) => P.push({ g: T(cyl(0.014, 0.014, 0.004, 20), x, i * 0.0042, z), m: C({ 10: 0xe53935, 50: 0x1e88e5, 100: 0xfbc02d }[v], { r: 0.4 }) }));
        P.push({ g: flat(0.028, 0.028, x, vs.length * 0.0042 + 0.0005, z), m: faceMat(p.id, 'tok' + vs[vs.length - 1], { at: 0.5, aspect: 1 }) });
      }
      return;
    }
    const die = (cx, cz, s, yaw, k, faces) => {
      P.push({ g: T(box(s, s, s), cx, 0, cz, 0, yaw), m: C(DICE_COL(p, k), { r: 0.3, m: p.id === 'dicegold' ? 0.6 : 0 }) });
      const o = s / 2 + 0.0006, sn = Math.sin(yaw), cs = Math.cos(yaw);
      P.push({ g: T(plane(s * 0.98, s * 0.98), cx + sn * o, s / 2, cz + cs * o, 0, yaw), m: faceMat(p.id, `pip${k}${faces[0]}`, { aspect: 1, W: 64 }) });
      P.push({ g: T(plane(s * 0.98, s * 0.98), cx + cs * o, s / 2, cz - sn * o, 0, yaw + Math.PI / 2), m: faceMat(p.id, `pip${k}${faces[1]}`, { aspect: 1, W: 64 }) });
      P.push({ g: T(plane(s * 0.98, s * 0.98), cx - cs * o, s / 2, cz + sn * o, 0, yaw - Math.PI / 2), m: faceMat(p.id, `pip${k}${faces[2]}`, { aspect: 1, W: 64 }) });
      P.push({ g: flat(s * 0.98, s * 0.98, cx, s + 0.0006, cz, yaw), m: faceMat(p.id, `pip${k}${faces[3]}`, { aspect: 1, W: 64 }) });
    };
    die(-0.014, 0.006, 0.032, 0.55, 'a', [3, 4, 2, 1]);
    die(0.02, -0.01, 0.026, -0.35, 'b', [5, 6, 3, 1]);
    if (p.id !== 'dicegold') P.push({ g: T(cyl(0.011, 0.011, 0.003, 18), 0.022, 0, 0.022), m: C(0xe0b33c, { r: 0.3, m: 0.7 }) });
  },
  // フィギュア：台座の上にアニモン／ミニフィギュア：カプセル3つ
  figure: (p, P) => {
    const [w, h] = p.size;
    if (p.id === 'figure3') {
      const r = 0.018, clear = mat(0xeaf6ff, { r: 0.05, m: 0.1, t: true, op: 0.35 });
      [[-0.018, r, 0.008, 0xff8a65], [0.018, r, 0.008, 0x4fc3f7], [0, r * 2.7, -0.004, 0x9ccc65]].forEach(([x, y, z, col], i) => {
        P.push({ g: T(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), x, y, z), m: C(col, { r: 0.35 }) });
        P.push({ g: T(plane(r * 1.5, r * 1.5), x, y + r * 0.1, z), m: faceMat(p.id, 'art' + i, { at: 0.5, aspect: 1, side: THREE.DoubleSide }) });
        P.push({ g: T(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), x, y, z), m: clear });
      });
      return;
    }
    const R = w * 0.42, gold = p.id === 'figure4', bc = gold ? 0xd9a521 : p.id === 'figure2' ? 0x2b2f36 : 0x3a3f45;
    P.push({ g: cyl(R, R * 1.05, 0.016, 28), m: C(bc, { r: 0.35, m: gold ? 0.7 : 0.2 }) });
    P.push({ g: T(cyl(R * 0.97, R * 0.97, 0.002, 28), 0, 0.016), m: C(gold ? 0xf2cf62 : 0x55606a, { r: 0.3, m: gold ? 0.7 : 0.2 }) });
    const ah = h - 0.02, aw = w * 0.98;
    P.push({ g: T(plane(aw, ah), 0, 0.018 + ah / 2, 0), m: faceMat(p.id, 'art0', { at: 0.5, aspect: ah / aw, W: 256, side: THREE.DoubleSide }) });
    if (p.id === 'figure2') P.push({ g: T(plane(R * 0.9, R * 0.9 * 0.25), 0, 0.008, R * 1.05 + 0.001), m: faceMat(p.id, 'legend', { aspect: 0.25, W: 128 }) });
  },
  // ぬいぐるみ：アニモンの絵を前に、うしろに同じ形の板を何枚も重ねて厚みを出す／クッション：だ円のクッションに絵
  plush: (p, P) => {
    const [w, h, d] = p.size;
    if (p.id === 'cushion') {
      const R = w / 2 * 0.98, cy = h / 2, k = 0.85;
      P.push({ g: T(new THREE.CylinderGeometry(R, R, d * 0.7, 32), 0, cy, 0, Math.PI / 2, 0, 0, 1, 1, k), m: C(p.color, { r: 0.95 }) });
      P.push({ g: T(new THREE.TorusGeometry(R * 0.94, d * 0.3, 10, 32), 0, cy, 0, 0, 0, 0, 1, k, 1), m: C(p.color, { r: 0.95 }) });
      const pw = 2 * R * 82 / 80, ph = pw * 70 / 82;
      P.push({ g: T(plane(pw, ph), 0, cy, d * 0.35 + 0.0015), m: faceMat(p.id, 'front', { at: 0.5, W: 256 }) });
      return;
    }
    const a = h / w, zf = d * 0.3, zb = -d * 0.3, N = 7;
    const sil = faceMat(p.id, `sil0:${dark(p.color, 0.1)}`, { at: 0.5, aspect: a, W: 128, r: 0.95, side: THREE.DoubleSide });
    P.push({ g: T(plane(w, h), 0, h / 2, zf), m: faceMat(p.id, 'art0', { at: 0.5, aspect: a, W: 256, r: 0.9 }) });
    P.push({ g: T(plane(w, h), 0, h / 2, zb, 0, Math.PI), m: sil });
    for (let i = 1; i <= N; i++) { const t = i / (N + 1), sc = 0.9 + 0.1 * Math.sin(Math.PI * t); P.push({ g: T(plane(w * sc, h * sc), 0, (h * sc) / 2, zb + (zf - zb) * t), m: sil }); }
    // タグ
    P.push({ g: T(plane(w * 0.13, w * 0.13 * 1.25), w * 0.3, h * 0.16, zf + 0.001), m: faceMat(p.id, 'tag', { at: 0.5, aspect: 1.25, W: 64 }) });
  },
  // 缶バッジ（台紙に3つ）／キーホルダー（ゴム・アクリル）／ウエハース（ふくろ）
  badge: (p, P) => {
    const [w, h, d] = p.size;
    if (p.id === 'snack') { P.push({ g: pillow(w, h, d), m: faceMat(p.id, 'front', { at: 0.5, r: 0.3, m: 0.25 }) }); return; }
    if (p.id === 'badge') {
      P.push({ g: T(box(w, h, 0.003), 0, 0, -0.002), m: C(0xf7f7fb, { r: 0.7 }) });
      [[50, 38, 22], [30, 62, 19], [70, 62, 19]].forEach(([x, y, r100], i) => {
        const r = (r100 / 100) * w, bx = (x / 100 - 0.5) * w, by = (1 - y / 100) * h;
        P.push({ g: T(new THREE.CylinderGeometry(r, r, 0.006, 24), bx, by, 0.003, Math.PI / 2), m: C(0xc9cfd6, { r: 0.3, m: 0.6 }) });
        P.push({ g: T(plane(r * 2, r * 2), bx, by, 0.0062 + i * 0.0004), m: faceMat(p.id, 'badge' + i, { at: 0.5, aspect: 1, r: 0.25, m: 0.2 }) });
      });
      return;
    }
    // キーホルダー：上にリングとくさり
    const metal = C(0xb9c0c8, { r: 0.25, m: 0.8 }), top = p.id === 'acryl2' ? h * 0.66 : h * 0.7;
    P.push({ g: T(torus(0.008, 0.0015, 8, 18), 0, h - 0.009, 0), m: metal });
    for (let i = 0; i < 3; i++) P.push({ g: T(torus(0.0022, 0.0007, 6, 10), 0, top + 0.004 + i * 0.0045, 0, 0, i % 2 ? Math.PI / 2 : 0), m: metal });
    if (p.id === 'acryl2') {
      P.push({ g: rbox(w * 0.9, top, 0.006, 0.006), m: mat(0xeaf6ff, { r: 0.05, m: 0.1, t: true, op: 0.4 }) });
      P.push({ g: T(plane(w * 0.82, top * 0.9), 0, top * 0.5, 0), m: faceMat(p.id, 'art0', { at: 0.5, aspect: (top * 0.9) / (w * 0.82), side: THREE.DoubleSide }) });
      return;
    }
    const white = faceMat(p.id, 'sil0:#ffffff', { at: 0.5, aspect: top / w, r: 0.6 });
    P.push({ g: T(plane(w, top), 0, top / 2, 0.002), m: faceMat(p.id, 'line0', { at: 0.5, aspect: top / w, r: 0.6 }) });
    P.push({ g: T(plane(w, top), 0, top / 2, 0), m: white });
    P.push({ g: T(plane(w, top), 0, top / 2, -0.002, 0, Math.PI), m: white });
  },
  // アクリルスタンド：ふちどりしたアニモンの板と、だ円の台座
  acryl: (p, P) => {
    const [w, h, d] = p.size;
    P.push({ g: T(cyl(w * 0.45, w * 0.45, 0.008, 28), 0, 0, 0, 0, 0, 0, 1, 1, Math.min(1, d / w)), m: mat(0xeaf6ff, { r: 0.05, t: true, op: 0.55 }) });
    const ah = h - 0.01;
    P.push({ g: T(plane(w, ah), 0, 0.008 + ah / 2, 0), m: faceMat(p.id, 'acr0', { at: 0.5, aspect: ah / w, W: 256, r: 0.15, m: 0.1, side: THREE.DoubleSide }) });
  },
  // 消臭スプレー：缶に緑のラベル
  spray: (p, P) => {
    const [w, h] = p.size, r = w / 2, bh = h * 0.55;
    P.push({ g: cyl(r, r, h * 0.8, 18), m: C(0xf4f7f6, { r: 0.25, m: 0.6 }) });
    P.push({ g: T(cyl(r * 1.01, r * 1.01, bh, 24, true), 0, h * 0.1), m: faceMat(p.id, 'spray', { aspect: bh / (2 * Math.PI * r * 1.01), W: 256 }) });
    P.push({ g: T(cyl(r * 0.8, r, h * 0.06, 16), 0, h * 0.8), m: C(0xdfe5e3, { r: 0.2, m: 0.7 }) });
    P.push({ g: T(cyl(r * 0.55, r * 0.6, h * 0.12, 14), 0, h * 0.86), m: C(0xffffff, { r: 0.4 }) });
    P.push({ g: T(box(r * 0.3, h * 0.04, r * 0.5), 0, h * 0.94, r * 0.25), m: C(p.color, { r: 0.4 }) });
  },
  // マンガ・ガイドブック：表紙の絵
  manga: (p, P) => {
    const [w, h, d] = p.size;
    P.push({ g: box(w, h, d), m: C(0xf4efe3, { r: 0.9 }) });
    P.push({ g: T(plane(w * 0.99, h * 0.99), 0, h / 2, d / 2 + 0.001), m: faceMat(p.id, 'front') });
    P.push({ g: T(plane(w * 0.99, h * 0.99), 0, h / 2, -d / 2 - 0.001, 0, Math.PI), m: C(p.color, { r: 0.5 }) });
    P.push({ g: T(plane(d, h), -w / 2 - 0.001, h / 2, 0, 0, -Math.PI / 2), m: C(dark(p.color, 0.1), { r: 0.5 }) });
  },
  // マグカップ：白いカップに、アニモンの絵と色の帯
  mug: (p, P) => {
    const [w, h] = p.size, r = w * 0.4;
    P.push({ g: cyl(r, r * 0.92, h, 20), m: C(0xfafafa, { r: 0.25 }) });
    P.push({ g: T(cyl(r * 1.004, r * 0.924, h * 0.96, 28, true), 0, h * 0.02), m: faceMat(p.id, 'mug', { aspect: (h * 0.96) / (2 * Math.PI * r), W: 320, r: 0.25 }) });
    P.push({ g: T(torus(h * 0.25, h * 0.05, 8, 14, Math.PI), r * 1.02, h * 0.5, 0, 0, 0, -Math.PI / 2), m: C(0xfafafa, { r: 0.25 }) });
    P.push({ g: T(cyl(r * 0.88, r * 0.88, 0.004, 18), 0, h - 0.006), m: C(0x5a3a22, { r: 0.3 }) });
  },
  // デッキ（スターター・デラックス）：箱の正面に絵
  deckbox: (p, P) => {
    const [w, h, d] = p.size, c = deckBody(p);
    P.push({ g: box(w, h, d), m: C(c, { r: 0.4, m: 0.1 }) });
    P.push({ g: flat(w, d, 0, h + 0.0008, 0), m: C(lite(c, 0.22), { r: 0.4 }) });
    decal(P, faceMat(p.id, 'front'), w * 0.995, h * 0.995, h / 2, d / 2);
  },
  // ボードゲーム：平たい箱（ふたに絵、正面にタイトルの帯）／Tシャツ：シャツの形の板
  boardgame: (p, P) => {
    const [w, h, d] = p.size;
    if (p.id === 'tshirt') {
      const fm = faceMat(p.id, 'front', { at: 0.5, W: 256, r: 0.9 });
      P.push({ g: T(plane(w, w * faceAspect(p.id, 'front')), 0, (w * faceAspect(p.id, 'front')) / 2, d * 0.3), m: fm });
      P.push({ g: T(plane(w, w * faceAspect(p.id, 'front')), 0, (w * faceAspect(p.id, 'front')) / 2, 0), m: fm });
      P.push({ g: T(plane(w, w * faceAspect(p.id, 'front')), 0, (w * faceAspect(p.id, 'front')) / 2, -d * 0.3, 0, Math.PI), m: fm });
      return;
    }
    P.push({ g: box(w, h, d), m: C(p.color, { r: 0.5 }) });
    const tw = w * 0.98, td = Math.min(d * 0.98, tw * faceAspect(p.id, 'front'));
    P.push({ g: flat(tw, td, 0, h + 0.001, 0), m: faceMat(p.id, 'front', { W: 256 }) });
    P.push({ g: T(plane(w * 0.98, h * 0.9), 0, h / 2, d / 2 + 0.001), m: faceMat(p.id, 'band', { W: 256 }) });
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
function sleeveBox(p, P) {
  const [w, h, d] = p.size, c = p.id === 'psleeve' ? '#2a2350' : p.id === 'innersleeve' ? '#e6edf5' : p.color;
  P.push({ g: box(w, h, d), m: C(c, { r: 0.4 }) });
  decal(P, faceMat(p.id, 'front'), w * 0.995, h * 0.995, h / 2, d / 2);
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
