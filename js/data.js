// ===== ゲームデータ定義（three.js 非依存） =====
import { SERIES } from './cards.js';
export const CELL = 0.5;
// ---------- 店舗レイアウト（原作風：5m区画を少しずつ買い足して広げる） ----------
export const BAY = 5;
export const SALES = { x0: -35, z0: 6, cols: 8, rows: 4 }; // 売り場区画 b{列}{行}  列0=左はし・列7=右はし（入口のある所）、行0=通り側（最大 40m×20m・32区画）
export const SALES_X1 = SALES.x0 + SALES.cols * BAY; // 売り場の右はし（ここから右は倉庫・パソコン室）= 5
export const BACK_Z = SALES.z0 - SALES.rows * BAY;   // 建物の奥の壁 = -14
// 右側の列：手前にパソコン室（マネージャー室）、その奥に倉庫（奥へ広げられる）
export const STRIP = { x0: SALES_X1, x1: SALES_X1 + 10 };
export const MANAGER = { x0: STRIP.x0, x1: STRIP.x1, z0: 1, z1: 6, door: [7, 8.6] }; // door：奥の壁(z0)の出入口のx
// 倉庫の区画（右の列を手前から奥へ）。door：売り場との壁(x=STRIP.x0)の出入口のz
export const STOCK_SECTIONS = [
  { id: 'sr1', name: '倉庫1', r: 1, x0: STRIP.x0, x1: STRIP.x1, z0: -4, z1: 1, door: [-2.6, -0.6] },
  // 売り場からの出入口は倉庫1の1つだけ。倉庫2・3は倉庫1から奥へつながる（出入口は増えない）
  { id: 'sr2', name: '倉庫2', r: 2, x0: STRIP.x0, x1: STRIP.x1, z0: -9, z1: -4, door: null },
  { id: 'sr3', name: '倉庫3', r: 3, x0: STRIP.x0, x1: STRIP.x1, z0: -14, z1: -9, door: null },
];
export const STOCK_COLS = 1, STOCK_ROWS = STOCK_SECTIONS.length;
export const stockAt = (c, r) => (c === 0 ? STOCK_SECTIONS.find((s) => s.r === r) : null);
export const DOCK = { x: STRIP.x1, z0: -3.6, z1: -0.4 }; // 右の壁の搬入口（倉庫1）
export const DOOR = { x: 0, z: 6, half: 1.2 };
export const BUILDING = { minX: SALES.x0, maxX: STRIP.x1, minZ: BACK_Z, maxZ: 6 };
export const STAFF_HOME = [10, -1.5]; // 従業員が出勤してくる所（倉庫1）
// 最初から使える売り場：入口のまわりの 15m×10m（6区画）。左と奥へ1区画ずつ広げられる
export const START_BAYS = ['b50', 'b51', 'b60', 'b61', 'b70', 'b71'];
export const START_STOCK = ['sr1'];
export const NAV_BOUNDS = { minX: -42, maxX: 24, minZ: -21, maxZ: 14 };
export const PLAYER_BOUNDS = { minX: -43, maxX: 27, minZ: -24, maxZ: 17 };
export const SPAWN_POINTS = [[-40, 8.2], [22, 8.2], [-40, 7.4], [22, 7.4]];
export const PLAYER_SPAWN = [0, 3.6];
export const DELIVERY_AREA = { minX: 2.2, maxX: 7.2, minZ: 10.4, maxZ: 13.0 }; // 店の前の駐車場（空から箱が降ってくる）
// 発注：1回の配達で運べるのは段ボール最大10箱、送料は1回1000円（固定）
export const ORDER_MAX_BOXES = 10;
export const SHIPPING_FEE = 1000;
export const OPEN_TIME = 8 * 60;
export const CLOSE_TIME = 22 * 60;
export const GAME_MIN_PER_SEC = 1.7;

export function bayRect(id) {
  const c = +id[1], r = +id[2];
  const x0 = SALES.x0 + c * BAY, z1 = SALES.z0 - r * BAY;
  return { id, c, r, minX: x0, maxX: x0 + BAY, minZ: z1 - BAY, maxZ: z1, kind: 'sales' };
}
export const ALL_BAYS = [];
for (let r = 0; r < SALES.rows; r++) for (let c = 0; c < SALES.cols; c++) ALL_BAYS.push('b' + c + r);
export function bayAt(x, z) {
  const c = Math.floor((x - SALES.x0) / BAY), r = Math.floor((SALES.z0 - z) / BAY);
  if (c < 0 || c >= SALES.cols || r < 0 || r >= SALES.rows) return null;
  return 'b' + c + r;
}
export function stockRect(sec) { return { id: sec.id, minX: sec.x0, maxX: sec.x1, minZ: sec.z0, maxZ: sec.z1, kind: 'storage' }; }
// 使える区画の一覧（配置判定・経路探索用）
export function zones(store) {
  const out = [];
  for (const id of ALL_BAYS) if (store.bays?.[id]) out.push(bayRect(id));
  for (const s of STOCK_SECTIONS) if (store.stock?.[s.id]) out.push(stockRect(s));
  out.push({ id: 'mgr', minX: MANAGER.x0, maxX: MANAGER.x1, minZ: MANAGER.z0, maxZ: MANAGER.z1, kind: 'office' });
  return out;
}
export function expandTargets(store) {
  const out = [];
  for (const id of ALL_BAYS) {
    if (store.bays?.[id]) continue;
    const { c, r } = bayRect(id);
    const nb = [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]].some(([a, b]) => store.bays?.['b' + a + b]);
    out.push({ id, kind: 'bay', can: nb, cost: expandCost(store, id) });
  }
  // 倉庫も今ある倉庫のとなり（手前と奥）から
  for (const s of STOCK_SECTIONS) {
    if (store.stock?.[s.id]) continue;
    const nb = STOCK_SECTIONS.some((o) => Math.abs(o.r - s.r) === 1 && store.stock?.[o.id]);
    out.push({ id: s.id, kind: 'stock', can: nb, cost: expandCost(store, s.id), name: s.name });
  }
  return out;
}
export function expandCost(store, id) {
  if (id.startsWith('b')) { const n = Math.max(0, Object.keys(store.bays || {}).length - START_BAYS.length); return Math.round(15000 * Math.pow(1.14, n) / 500) * 500; }
  const n = Math.max(0, Object.keys(store.stock || {}).length - START_STOCK.length); return Math.round(30000 * Math.pow(1.3, n) / 500) * 500;
}
// 倉庫の出入口が開いているか（倉庫と、出入口の前の売り場の両方を使っているとき）
export const doorOpen = (store, s) => !!(s.door && store?.stock?.[s.id] && store?.bays?.[bayAt(STRIP.x0 - 1, (s.door[0] + s.door[1]) / 2)]);
// 置けない場所（入口・通路・荷受け場の確保）
export function keepClear(store) {
  const k = [
    { minX: -1.7, maxX: 1.7, minZ: 4.0, maxZ: 6 }, // 入口
    { minX: MANAGER.door[0] - 0.4, maxX: MANAGER.door[1] + 0.4, minZ: MANAGER.z0 - 1.3, maxZ: MANAGER.z0 + 1.3 }, // パソコン室の出入口
  ];
  // 倉庫の出入口：開いている出入口（倉庫ととなりの売り場の両方が使える所）だけ。閉じている所は壁なので壁ぎわに置ける
  for (const s of STOCK_SECTIONS) if (doorOpen(store, s)) k.push({ minX: STRIP.x0 - 1.2, maxX: STRIP.x0 + 1.2, minZ: s.door[0] - 0.4, maxZ: s.door[1] + 0.4 });
  k.push({ minX: DOCK.x - 1.2, maxX: DOCK.x + 0.5, minZ: DOCK.z0 - 0.2, maxZ: DOCK.z1 + 0.2 }); // 搬入口
  return k;
}

// 壁（矩形の当たり判定）。type: front=ガラス正面, outer=外壁, inner=倉庫仕切り, part=未購入区画の仮壁, pillar=柱
export function getWalls(store) {
  const T = 0.12, w = [];
  const bays = store?.bays || {}, stock = store?.stock || {};
  const H = (x0, x1, z, type) => { if (x1 - x0 > 0.01) w.push({ minX: x0, maxX: x1, minZ: z - T, maxZ: z + T, type, axis: 'x' }); };
  const V = (z0, z1, x, type) => { if (z1 - z0 > 0.01) w.push({ minX: x - T, maxX: x + T, minZ: z0, maxZ: z1, type, axis: 'z' }); };
  const L = BUILDING.minX, R = BUILDING.maxX;
  // 外壁：正面（入口）・左・奥・右（搬入口）
  H(L, -DOOR.half, 6, 'front'); H(DOOR.half, R, 6, 'front');
  V(BACK_Z, 6, L, 'outer'); H(L, R, BACK_Z, 'outer');
  V(BACK_Z, DOCK.z0, R, 'outer'); V(DOCK.z1, 6, R, 'outer');
  // パソコン室の奥の壁（出入口つき）
  H(MANAGER.x0, MANAGER.door[0], MANAGER.z0, 'inner'); H(MANAGER.door[1], MANAGER.x1, MANAGER.z0, 'inner');
  // 売り場と右の列の境（倉庫の出入口は、倉庫ととなりの売り場の両方が使えるときだけ開く）
  const gaps = STOCK_SECTIONS.filter((s) => doorOpen(store, s)).map((s) => s.door).sort((a, b) => a[0] - b[0]);
  let z = BACK_Z;
  for (const [g0, g1] of gaps) { V(z, g0, STRIP.x0, 'inner'); z = g1; }
  V(z, 6, STRIP.x0, 'inner');
  // 未購入の売り場区画との仕切り
  for (const id of ALL_BAYS) {
    if (!bays[id]) continue;
    const b = bayRect(id);
    if (b.c > 0 && !bays['b' + (b.c - 1) + b.r]) V(b.minZ, b.maxZ, b.minX, 'part');
    if (b.c < SALES.cols - 1 && !bays['b' + (b.c + 1) + b.r]) V(b.minZ, b.maxZ, b.maxX, 'part'); // 右はしは倉庫との壁がある
    if (b.r < SALES.rows - 1 && !bays['b' + b.c + (b.r + 1)]) H(b.minX, b.maxX, b.minZ, 'part'); // 奥が未購入
    if (b.r > 0 && !bays['b' + b.c + (b.r - 1)]) H(b.minX, b.maxX, b.maxZ, 'part');               // 手前が未購入
  }
  // 倉庫どうしの仕切り（使える倉庫と使えない倉庫の境目）
  for (const s of STOCK_SECTIONS) {
    const back = STOCK_SECTIONS.find((o) => o.r === s.r + 1);
    if (back && !!stock[s.id] !== !!stock[back.id]) H(s.x0, s.x1, s.z0, 'part');
  }
  // 区画の境目の柱
  for (let i = 1; i < SALES.cols; i++) for (let j = 1; j < SALES.rows; j++) {
    const px = SALES.x0 + i * BAY, pz = SALES.z0 - j * BAY;
    const near = ['b' + (i - 1) + (j - 1), 'b' + i + (j - 1), 'b' + (i - 1) + j, 'b' + i + j].some((id) => bays[id]);
    if (near) w.push({ minX: px - 0.22, maxX: px + 0.22, minZ: pz - 0.22, maxZ: pz + 0.22, type: 'pillar', x: px, z: pz });
  }
  return w;
}

// ---------- 商品（カードパック・BOX・サプライ・グッズ・その他） ----------
// place: 置ける棚の種類 / size: [幅,高さ,奥行] / stack: 積み段数 / bx: 段ボールの大きさ / qty: 段ボール1箱の入り数 / lv: ライセンスが買えるようになるお店のレベル
// lic: ライセンス料（原作どおり、レベルが届いたらお金を払ってライセンスを買うと仕入れられる）/ model: 3Dモデルの種類
export const CATEGORIES = {
  pack: { name: 'パック', icon: '🎴' }, box: { name: 'BOX', icon: '🎁' }, supply: { name: 'サプライ', icon: '🧰' },
  goods: { name: 'グッズ', icon: '🧸' }, other: { name: 'その他', icon: '🧴' },
};
const P = (o) => ({ place: ['gen'], stack: 1, bx: 'm', ...o, max: o.qty });
const r500 = (v) => Math.round(v / 500) * 500;
export const PACK_QTY = 30; // 段ボール1箱にパック30個
export const BOXES_PER_CARTON = 8; // 段ボール1箱に BOX 8個
export const BOX_PREMIUM = 1.2; // BOXの相場は「10パック分」の1.2倍（BOXのまま売るほうが高く売れる）
// サプライ・グッズ（[id, 名前, カテゴリ, 仕入, 売値, 入り数, 大きさ, アイコン, 色, Lv, モデル, ブランド, 内容量, 追加]）
const GOODS = [
  ['sleeve', 'カードスリーブ（ベーシック）', 'supply', 180, 300, 24, [0.075, 0.105, 0.016], '🃏', '#3a86ff', 1, 'sleeve', 'CardGuard', '65枚入り'],
  ['deckcase', 'デッキケース（レッド）', 'supply', 360, 600, 12, [0.078, 0.102, 0.078], '🗃️', '#e63946', 2, 'deckcase', 'DeckPro', '100枚収納', { stack: 2 }],
  ['sleeveF', 'カードスリーブ（ほのお）', 'supply', 210, 350, 24, [0.075, 0.105, 0.016], '🔥', '#ff6b35', 4, 'sleeve', 'CardGuard', '65枚入り'],
  ['loader', 'カードローダー', 'supply', 120, 200, 24, [0.08, 0.11, 0.02], '🪟', '#90e0ef', 4, 'loader', 'ClearShield', '25枚入り'],
  ['deckcaseB', 'デッキケース（ブルー）', 'supply', 360, 600, 12, [0.078, 0.102, 0.078], '🗃️', '#2f6fdf', 6, 'deckcase', 'DeckPro', '100枚収納', { stack: 2 }],
  ['playmat', 'プレイマット', 'supply', 1100, 1800, 8, [0.075, 0.3, 0.075], '🧻', '#7b2cbf', 6, 'playmat', 'BattleField', '60×35cm', { bx: 'l' }],
  ['sleeveW', 'カードスリーブ（みず）', 'supply', 210, 350, 24, [0.075, 0.105, 0.016], '💧', '#1d8fe1', 7, 'sleeve', 'CardGuard', '65枚入り'],
  ['binder', 'コレクションバインダー', 'supply', 900, 1500, 6, [0.24, 0.3, 0.05], '📒', '#2a9d8f', 9, 'binder', 'CollectBook', '9ポケット×20', { bx: 'l' }],
  ['sleeveG', 'カードスリーブ（くさ）', 'supply', 210, 350, 24, [0.075, 0.105, 0.016], '🍃', '#2a9d48', 10, 'sleeve', 'CardGuard', '65枚入り'],
  ['storage', 'ストレージボックス', 'supply', 240, 400, 8, [0.1, 0.08, 0.3], '📦', '#f4a261', 11, 'storage', 'StoreMax', '400枚収納', { stack: 3 }],
  ['sleeveE', 'カードスリーブ（でんき）', 'supply', 210, 350, 24, [0.075, 0.105, 0.016], '⚡', '#f5b800', 13, 'sleeve', 'CardGuard', '65枚入り'],
  ['dice', 'ダイス＆コインセット', 'supply', 210, 350, 24, [0.07, 0.07, 0.07], '🎲', '#ef476f', 14, 'dice', 'LuckyRoll', 'ダイス2＋コイン', { stack: 2, bx: 's' }],
  ['deckcaseK', 'デッキケース（ブラック）', 'supply', 480, 800, 12, [0.078, 0.102, 0.078], '🗃️', '#2b2d35', 15, 'deckcase', 'DeckPro', '100枚収納', { stack: 2 }],
  ['file9', '9ポケットファイル', 'supply', 480, 800, 12, [0.24, 0.3, 0.03], '🗂️', '#ff8fab', 16, 'binder', 'CollectBook', '9ポケット×10', { bx: 'l' }],
  ['toploader', 'トップローダー', 'supply', 300, 500, 24, [0.08, 0.11, 0.02], '🛡️', '#c8f0ff', 19, 'loader', 'ClearShield', '10枚入り'],
  ['counter', 'ダメージカウンター', 'supply', 300, 500, 24, [0.07, 0.07, 0.07], '🔢', '#16a34a', 21, 'dice', 'LuckyRoll', 'カウンター30個', { stack: 2, bx: 's' }],
  ['playmat2', 'プレイマット（ドラゴン）', 'supply', 1800, 3000, 8, [0.075, 0.3, 0.075], '🐉', '#b91c1c', 24, 'playmat', 'BattleField', '60×35cm', { bx: 'l' }],
  ['psleeve', 'プレミアムスリーブ', 'supply', 540, 900, 24, [0.075, 0.105, 0.016], '✨', '#c9a227', 28, 'sleeve', 'CardGuard', '80枚入り', { premium: 1 }],
  ['deckcaseP', 'デッキケース（パール）', 'supply', 1200, 2000, 12, [0.078, 0.102, 0.078], '💠', '#e9e4f5', 32, 'deckcase', 'DeckPro', '100枚収納', { stack: 2 }],
  ['magloader', 'マグネットローダー', 'supply', 600, 1000, 24, [0.09, 0.12, 0.02], '🧲', '#9fb7ff', 34, 'loader', 'ClearShield', '1枚用'],
  // グッズ
  ['plush1', 'チュピのぬいぐるみ', 'goods', 900, 1500, 8, [0.15, 0.16, 0.13], '🐤', '#ffd9a0', 3, 'plush', 'ANIMON', '高さ15cm', { mon: 'chupi' }],
  ['badge', '缶バッジ（ランダム）', 'goods', 180, 300, 30, [0.06, 0.06, 0.02], '📛', '#ff5d8f', 5, 'badge', 'ANIMON', '全24種'],
  ['plush2', 'セリックのぬいぐるみ', 'goods', 900, 1500, 8, [0.15, 0.16, 0.13], '🦊', '#ff9a55', 8, 'plush', 'ANIMON', '高さ15cm', { mon: 'cat' }],
  ['keychain', 'ラバーキーホルダー', 'goods', 240, 400, 24, [0.06, 0.1, 0.02], '🔑', '#4cc9f0', 10, 'badge', 'ANIMON', '全12種'],
  ['acryl', 'アクリルスタンド', 'goods', 480, 800, 16, [0.08, 0.13, 0.05], '🪧', '#a78bfa', 12, 'acryl', 'ANIMON', '高さ12cm'],
  ['plush3', 'モコメリーのぬいぐるみ', 'goods', 1200, 2000, 8, [0.17, 0.17, 0.14], '🐑', '#f3efe6', 17, 'plush', 'ANIMON', '高さ18cm', { mon: 'sheep' }],
  ['figure', 'アニモンフィギュア', 'goods', 1500, 2500, 6, [0.11, 0.17, 0.11], '🗿', '#ffb703', 20, 'figure', 'ANIMON', '全高12cm'],
  ['poster', 'アニモンポスター', 'goods', 600, 1000, 12, [0.07, 0.3, 0.07], '🖼️', '#06d6a0', 26, 'playmat', 'ANIMON', 'B2サイズ', { bx: 'l' }],
  ['plushBig', 'ビッグぬいぐるみ（シドーテンペス）', 'goods', 4800, 8000, 4, [0.26, 0.3, 0.22], '🧸', '#7dd3fc', 38, 'plush', 'ANIMON', '高さ40cm', { mon: 'bear', bx: 'l' }],
  ['figure2', '伝説フィギュア（大）', 'goods', 7200, 12000, 4, [0.16, 0.26, 0.16], '🏆', '#d4af37', 44, 'figure', 'ANIMON', '全高25cm', { bx: 'l' }],
  // その他
  ['spray', '消臭スプレー', 'other', 300, 500, 12, [0.06, 0.17, 0.06], '🧴', '#36c08a', 2, 'spray', 'FRESH', '300mL', { stack: 1, lic: 1000 }],
  ['manga', 'マンガ『アニモン冒険記』1巻', 'other', 300, 500, 24, [0.08, 0.115, 0.018], '📚', '#ef4444', 13, 'manga', 'ANIMON COMICS', '192ページ'],
  ['boardgame', 'ボードゲーム「アニモンすごろく」', 'other', 1800, 3000, 6, [0.22, 0.06, 0.22], '🎯', '#f97316', 22, 'boardgame', 'ANIMON GAMES', '2〜4人用', { stack: 3, bx: 'l' }],
];
export const PRODUCTS_LIST = [
  // バラパック（1パック5枚入り）と BOX（10パック入り）
  ...SERIES.map((s) => P({ id: 'pk' + s.id, name: `${s.name} パック`, short: s.name, cat: 'pack', series: s.id, cost: Math.round(s.price * 0.68), price: s.price, qty: PACK_QTY,
    size: [0.074, 0.122, 0.012], icon: '🎴', color: s.color, lv: s.lv, lic: s.id === 1 ? 0 : r500(s.price * 25) })),
  ...SERIES.map((s) => P({ id: 'bx' + s.id, name: `${s.name} BOX`, short: s.name, cat: 'box', series: s.id, cost: Math.round(s.price * 10 * BOX_PREMIUM * 0.7), price: Math.round(s.price * 10 * BOX_PREMIUM), qty: BOXES_PER_CARTON,
    size: [0.15, 0.09, 0.056], stack: 3, icon: '🎁', color: s.color, lv: Math.max(2, s.boxLv), bx: 'l', lic: r500(s.price * 40) })),
  ...GOODS.map(([id, name, cat, cost, price, qty, size, icon, color, lv, model, brand, net, extra]) => P({ id, name, cat, cost, price, qty, size, icon, color, lv, model, brand, net, ...(extra || {}),
    lic: lv <= 1 ? 0 : Math.max(500, r500(cost * qty * 0.5)), ...(extra || {}) })),
];
export const SPRAY_ID = 'spray';
export const SPRAY_USES = 20; // 手で使うと1本で20回スプレーできる
// レジのベルトやお客さんのかごにだけ出る「商品」（シングルカード・プレイ料金）。発注はできない
const PSEUDO = [
  { id: '_card', name: 'シングルカード', cat: '', place: [], cost: 0, price: 0, qty: 1, max: 1, size: [0.07, 0.1, 0.004], icon: '🃏', color: '#4a6cf7', lv: 999, hidden: true },
  { id: '_play', name: 'プレイテーブル利用料', cat: '', place: [], cost: 0, price: 0, qty: 1, max: 1, size: [0.06, 0.004, 0.09], icon: '🎮', color: '#16a34a', lv: 999, hidden: true },
];
export const PRODUCTS = Object.fromEntries([...PRODUCTS_LIST, ...PSEUDO].map((p) => [p.id, p]));
export const BOX_SIZES = { s: [0.4, 0.22, 0.3], m: [0.5, 0.3, 0.36], l: [0.58, 0.38, 0.42] };
// 空の段ボール（発注で買える）。どの商品でも1種類だけ詰められる。詰めるとその商品の箱になる
export const EMPTY_BOX = { id: '_box', name: '空の段ボール', icon: '📦', bx: 'm', qty: 0, color: '#9a7448', place: [], cat: '' };
export const EMPTY_BOX_PRICE = 200;
export const boxProd = (pid) => PRODUCTS[pid] || EMPTY_BOX;
export const boxLook = (b) => (b.n > 0 && PRODUCTS[b.p] ? b.p : EMPTY_BOX.id);
export const isPack = (pid) => /^pk\d$/.test(pid || '');
export const isBoosterBox = (pid) => /^bx\d$/.test(pid || '');
export const isSpray = (pid) => pid === 'spray';

// ---------- 設備 ----------
function shelfSlots(levels, ys, w, d, h, cols, kind = 'gen', sides = [1], depth = 0.5) {
  const out = [];
  for (const side of sides) for (let l = 0; l < levels; l++) for (let c = 0; c < cols; c++) {
    const sw = w / cols;
    out.push({ x: -w / 2 + sw * (c + 0.5), y: ys[l], z: sides.length > 1 ? side * depth / 4 : 0, w: sw - 0.08, h, d, side, kind });
  }
  return out;
}
// シングルカードを並べる場所（ローカル座標）。t：傾き（0=立てる、1.2=ほぼ寝かせる）
export const CARD_W = 0.1, CARD_H = 0.14; // 見やすいよう実物の約1.6倍
function cardGrid(cols, rows, x0, dx, ys, zs, t) {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: x0 + c * dx, y: ys[r], z: zs[r], t });
  return out;
}
const F = (o) => o;
export const FIXTURES = {
  // ---- 陳列棚 ----
  single: F({ name: '片面棚', cat: 'shelf', icon: '🗄️', price: 6000, w: 2, d: 0.5, place: 'sales', lv: 1,
    slots: shelfSlots(3, [0.32, 0.8, 1.28], 2, 0.42, 0.42, 2), desc: '壁ぎわに置く基本の棚（3段×2枠）' }),
  cabinet: F({ name: '小型キャビネット', cat: 'shelf', icon: '🪟', price: 2500, w: 1, d: 0.5, place: 'sales', lv: 1,
    slots: shelfSlots(2, [0.14, 0.58], 1, 0.4, 0.38, 1), desc: 'ガラス扉の小さな棚（2枠）' }),
  metalrack: F({ name: '小型メタルラック', cat: 'shelf', icon: '🧱', price: 3000, w: 1, d: 0.5, place: 'sales', lv: 2,
    slots: shelfSlots(3, [0.14, 0.6, 1.06], 1, 0.42, 0.4, 1), desc: 'スチールのワイヤーラック（3枠）' }),
  cabinet2: F({ name: '2×2キャビネット', cat: 'shelf', icon: '🔲', price: 5000, w: 1, d: 0.5, place: 'sales', lv: 3,
    slots: shelfSlots(2, [0.14, 0.58], 1, 0.4, 0.38, 2), desc: 'ガラス扉のキャビネット（2段×2枠）' }),
  pshelf: F({ name: 'パーソナルシェルフ', cat: 'shelf', icon: '🪵', price: 1800, w: 0.5, d: 0.5, place: 'sales', lv: 5,
    slots: shelfSlots(3, [0.14, 0.56, 0.98], 0.5, 0.42, 0.36, 1), desc: 'すき間に置ける木の小さな棚（3枠）' }),
  double: F({ name: '両面棚', cat: 'shelf', icon: '🏬', price: 16000, w: 2, d: 1, place: 'sales', lv: 11,
    slots: shelfSlots(4, [0.14, 0.55, 0.96, 1.37], 2, 0.42, 0.37, 2, 'gen', [1, -1], 1), desc: '両側から取れる大きな棚（4段×2枠×両面＝16枠）' }),
  bigpshelf: F({ name: 'ビッグパーソナルシェルフ', cat: 'shelf', icon: '🪜', price: 8000, w: 1, d: 0.5, place: 'sales', lv: 23,
    slots: shelfSlots(5, [0.12, 0.5, 0.88, 1.26, 1.64], 1, 0.42, 0.34, 1), desc: '背の高い木の棚（5枠）' }),
  wide: F({ name: 'ワイドシェルフ', cat: 'shelf', icon: '🛋️', price: 30000, w: 3, d: 1, place: 'sales', lv: 30, attract: 0.06,
    slots: shelfSlots(2, [0.3, 0.72], 3, 0.42, 0.38, 3, 'gen', [1, -1], 1), desc: '腰の高さの大きな棚。見通しがよく、お客さんが増える（12枠）' }),
  // ---- シングルカード販売 ----
  cardshelf: F({ name: 'シングルカード棚', cat: 'cardsale', icon: '🪜', price: 3500, w: 1, d: 0.5, place: 'sales', lv: 1,
    cards: [...cardGrid(4, 1, -0.36, 0.24, [0.74], [0.12], 0.32), ...cardGrid(4, 1, -0.36, 0.24, [1.0], [0.02], 0.26), ...cardGrid(4, 1, -0.36, 0.24, [1.26], [-0.08], 0.2)],
    desc: 'ひな壇にシングルカードを12枚立てて売る、いちばん手軽な棚' }),
  smalldisp: F({ name: 'スモールカードディスプレイ', cat: 'cardsale', icon: '🔳', price: 7000, w: 1, d: 0.6, place: 'sales', lv: 8,
    cards: cardGrid(4, 2, -0.33, 0.22, [0.9, 0.94], [0.1, -0.08], 1.2), desc: 'ガラスのふたの小さなショーケース（8枚）' }),
  cardtower: F({ name: 'カードタワーケース', cat: 'cardsale', icon: '🗼', price: 14000, w: 1, d: 0.6, place: 'sales', lv: 15, attract: 0.02,
    cards: [0.5, 0.86, 1.22, 1.58].flatMap((y) => cardGrid(3, 1, -0.28, 0.28, [y], [0.04], 0.15)), desc: '4段の背の高いガラスタワー（12枚・お店の雰囲気アップ）' }),
  walldisp2: F({ name: '壁掛けディスプレイケース（2×4）', cat: 'cardsale', icon: '🖼️', price: 9000, w: 1.3, d: 0.3, place: 'sales', lv: 28,
    cards: cardGrid(4, 2, -0.45, 0.3, [1.17, 1.43], [-0.07, -0.07], 0), desc: '壁にかける横長の額縁ケース（8枚）' }),
  cardtable: F({ name: 'カードテーブル', cat: 'cardsale', icon: '🃏', price: 4000, w: 1.5, d: 0.75, place: 'sales', lv: 2,
    cards: cardGrid(5, 2, -0.52, 0.26, [0.86, 0.9], [0.17, -0.05], 1.15), desc: 'シングルカードを10枚並べて売るテーブル' }),
  walldisp: F({ name: '壁掛けディスプレイケース', cat: 'cardsale', icon: '🖼️', price: 5000, w: 1, d: 0.3, place: 'sales', lv: 12,
    cards: cardGrid(3, 2, -0.3, 0.3, [1.17, 1.43], [-0.07, -0.07], 0), desc: '壁にかける額縁のケース（6枚）' }),
  disptable: F({ name: 'カード展示ショーケース', cat: 'cardsale', icon: '💎', price: 12000, w: 2, d: 0.75, place: 'sales', lv: 20,
    cards: cardGrid(8, 2, -0.84, 0.24, [0.86, 0.9], [0.16, -0.06], 1.2), desc: 'ガラスの下に16枚を飾るショーケース' }),
  vintage: F({ name: 'ヴィンテージカードテーブル', cat: 'cardsale', icon: '🏛️', price: 20000, w: 1.5, d: 0.75, place: 'sales', lv: 25, attract: 0.03,
    cards: cardGrid(6, 2, -0.6, 0.24, [0.86, 0.9], [0.16, -0.06], 1.15), desc: '木目のアンティークテーブル（12枚・お店の雰囲気アップ）' }),
  bigdisp: F({ name: '大型カードディスプレイ', cat: 'cardsale', icon: '🏆', price: 50000, w: 2, d: 0.5, place: 'sales', lv: 40, attract: 0.05,
    cards: cardGrid(6, 4, -0.75, 0.3, [0.62, 0.92, 1.22, 1.52], [0.1, 0.1, 0.1, 0.1], 0.08), desc: '背の高いガラスケース（24枚・お客さんが増える）' }),
  // ---- 対戦 ----
  playtable: F({ name: 'プレイテーブル', cat: 'play', icon: '🎮', price: 3000, w: 1.5, d: 1, place: 'sales', lv: 2,
    seats: [[0, 0.82], [0, -0.82]], desc: 'お客さんがカードで対戦する（2人）。遊んだお客さんはレジでプレイ料金を払う' }),
  tourtable: F({ name: '大会用テーブル', cat: 'play', icon: '🏟️', price: 25000, w: 2.5, d: 1, place: 'sales', lv: 45, attract: 0.04,
    seats: [[-0.6, 0.82], [0.6, 0.82], [-0.6, -0.82], [0.6, -0.82]], desc: '4人で遊べる大きな対戦テーブル' }),
  // ---- レジ ----
  checkout: F({ name: 'レジカウンター', cat: 'checkout', icon: '🧾', price: 12000, w: 1, d: 2.5, place: 'sales', lv: 1,
    op: [-0.85, -0.45], cust: [0.85, -0.25], q0: 0.85, qStep: 0.8, desc: 'お客さんの会計をする' }),
  // ---- 倉庫（在庫棚にはラベルを貼れる。従業員はラベルの商品しか置かない） ----
  rack: F({ name: '倉庫棚（小）', cat: 'storage', icon: '📦', price: 6000, w: 2, d: 0.5, place: 'any', lv: 1,
    boxSlots: [0.08, 0.74, 1.4].flatMap((y) => [-0.66, 0, 0.66].map((x) => ({ x, y, z: 0 }))), desc: '段ボールを9箱置ける金属ラック。段ごとにラベルを貼れる' }),
  bigrack: F({ name: '倉庫棚（大）', cat: 'storage', icon: '🏗️', price: 12000, w: 3, d: 0.5, place: 'any', lv: 13,
    boxSlots: [0.08, 0.62, 1.16, 1.7].flatMap((y) => [-1.08, -0.36, 0.36, 1.08].map((x) => ({ x, y, z: 0 }))), desc: '16箱置ける大きなラック' }),
  trash: F({ name: 'ゴミ箱', cat: 'storage', icon: '🗑️', price: 800, w: 0.5, d: 0.5, place: 'any', lv: 1, desc: '空の段ボールを捨てられる' }),
  dumpster: F({ name: '大型ゴミ箱', cat: 'storage', icon: '🗑️', price: 3500, w: 1.5, d: 0.9, place: 'any', lv: 1, desc: '空の段ボールを捨てる大きなゴミ箱' }),
  // ---- 消臭（オートセント：消臭スプレーをセットすると、近くを通った臭いお客さんに自動でスプレー） ----
  // range：届く距離(m)　cd：スプレーの間隔(秒)　cans：セットできる本数　use：1回で使う量（1本＝1）　pot：消臭のつよさ（臭い10）
  scent1: F({ name: 'オートセント M100', cat: 'clean', icon: '🌬️', price: 5000, w: 0.5, d: 0.5, place: 'any', lv: 5,
    scent: { range: 2.1, cd: 8, cans: 2, use: 0.05, pot: 5 }, desc: '自動消臭機。スプレー間隔8秒・2本セット・1回で臭いを半分消す' }),
  scent2: F({ name: 'オートセント G500', cat: 'clean', icon: '🌀', price: 15000, w: 0.5, d: 0.5, place: 'any', lv: 18,
    scent: { range: 2.4, cd: 5, cans: 4, use: 0.1, pot: 10 }, desc: '自動消臭機。スプレー間隔5秒・4本セット・1回で臭いを消す' }),
  scent3: F({ name: 'オートセント T1000', cat: 'clean', icon: '💨', price: 40000, w: 0.5, d: 0.5, place: 'any', lv: 40,
    scent: { range: 2.8, cd: 2.5, cans: 7, use: 0.1, pot: 10 }, desc: '自動消臭機。スプレー間隔2.5秒・7本セット・広い範囲' }),
  // ---- 固定の設備 ----
  pc: F({ name: 'パソコン', cat: 'fixed', icon: '💻', price: 0, w: 1.6, d: 0.8, place: 'any', fixed: true, desc: '仕入れ・ライセンス・従業員・お店の設定' }),
  fboard: F({ name: 'カード相場ボード', cat: 'fixed', icon: '📈', price: 0, w: 2, d: 0.5, place: 'any', fixed: true, desc: 'シングルカードの相場・コレクション' }),
  xboard: F({ name: '店舗拡張ボード', cat: 'fixed', icon: '🗺️', price: 0, w: 1.5, d: 0.5, place: 'any', fixed: true, desc: '売り場・倉庫を買い足す' }),
  opensign: F({ name: '入口の看板', cat: 'fixed', icon: '🪧', price: 0, w: 0.6, d: 0.5, place: 'any', fixed: true, desc: 'OPENにすると営業スタート' }),
  recycle: F({ name: 'リサイクルボックス', cat: 'fixed', icon: '♻️', price: 0, w: 2, d: 1, place: 'any', fixed: true, desc: '空き箱を入れるとお金になる' }),
  // ---- 装飾 ----
  plant: F({ name: '観葉植物', cat: 'deco', icon: '🪴', price: 1500, w: 0.5, d: 0.5, place: 'any', lv: 1, desc: '店内に緑を' }),
  bench: F({ name: 'ベンチ', cat: 'deco', icon: '🪑', price: 3000, w: 1.5, d: 0.5, place: 'any', lv: 4, desc: 'ひと休み用' }),
  gumball: F({ name: 'ガチャマシン', cat: 'deco', icon: '🍬', price: 2500, w: 0.5, d: 0.5, place: 'any', lv: 6, desc: '子どもが喜ぶ（評判アップ）' }),
  flower: F({ name: '花壇', cat: 'deco', icon: '🌷', price: 2200, w: 1, d: 0.5, place: 'any', lv: 8, desc: 'カラフルな花' }),
  vending: F({ name: '自動販売機', cat: 'deco', icon: '🥤', price: 8000, w: 1, d: 0.5, place: 'any', lv: 10, desc: '来店客がときどきジュースを買う（小さな収入）' }),
  prize: F({ name: '大会賞品棚', cat: 'deco', icon: '🏅', price: 15000, w: 1, d: 0.5, place: 'any', lv: 35, attract: 0.03, desc: 'トロフィーと記念カードを飾る（お客さんが増える）' }),
  // ---- 看板 ----
  signstand: F({ name: 'スタンド看板', cat: 'sign', icon: '🪧', price: 2000, w: 0.5, d: 0.5, place: 'any', lv: 3, text: true, desc: '好きな文字を書ける黒板看板' }),
  banner: F({ name: '売り場案内板', cat: 'sign', icon: '🏷️', price: 1800, w: 0.5, d: 0.5, place: 'any', lv: 5, text: true, desc: 'ポールに売り場名を掲げる案内板' }),
  hangsign: F({ name: '吊り看板', cat: 'sign', icon: '🎌', price: 3000, w: 1.5, d: 0.5, place: 'any', lv: 7, text: true, air: true, desc: '天井から吊るす両面の看板。好きな文字と色にできる（下を通れて、棚の上にも吊るせる）' }),
  neon: F({ name: 'ネオン看板', cat: 'sign', icon: '💡', price: 4500, w: 1, d: 0.5, place: 'any', lv: 9, text: true, desc: '光る文字の看板' }),
};
export const FIXTURE_CATS = { shelf: '陳列棚', cardsale: 'カード販売', play: '対戦', checkout: 'レジ', storage: '倉庫', clean: '消臭', deco: '装飾', sign: '看板' };
for (const [id, f] of Object.entries(FIXTURES)) { f.id = id; (f.slots || []).forEach((s, i) => (s.key = id + i)); }

export function fixtureFootprint(fx, x, z, r) {
  const def = FIXTURES[fx];
  const rw = r % 2 ? def.d : def.w, rd = r % 2 ? def.w : def.d;
  return { minX: x - rw / 2, maxX: x + rw / 2, minZ: z - rd / 2, maxZ: z + rd / 2, rw, rd };
}
// 中心座標をグリッドに合わせる
export function snapFixture(type, x, z, r) {
  const fp = fixtureFootprint(type, 0, 0, r);
  const minX = Math.round((x - fp.rw / 2) / CELL) * CELL, minZ = Math.round((z - fp.rd / 2) / CELL) * CELL;
  return [minX + fp.rw / 2, minZ + fp.rd / 2];
}
export function localToWorld(f, lx, lz) {
  const a = f.r * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
  return [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
}
export function worldToLocal(f, wx, wz) {
  const a = -f.r * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
  const dx = wx - f.x, dz = wz - f.z;
  return [dx * c + dz * s, -dx * s + dz * c];
}
export function slotAccess(f, si) {
  const def = FIXTURES[f.t], s = def.slots[si];
  return localToWorld(f, s.x, s.side * (def.d / 2 + 0.45));
}
export function rackAccess(f, si) {
  const def = FIXTURES[f.t], s = def?.boxSlots?.[si];
  if (!s) return [f.x, f.z]; // 在庫棚でなければ設備の前
  return localToWorld(f, s.x, def.d / 2 + 0.5);
}
export function checkoutSpot(f, i) {
  const def = FIXTURES[f.t];
  if (i === -1) return localToWorld(f, def.op[0], def.op[1]);
  if (i === 0) return localToWorld(f, def.cust[0], def.cust[1]);
  return localToWorld(f, def.cust[0], def.cust[1] + def.q0 + (i - 1) * def.qStep);
}

// 棚の1スロットに並べる位置一覧。1枠に入るのは段ボール1箱ぶん（＝容量は箱の入り数）。
// 1箱ぜんぶ入れると枠いっぱいに見えるよう、列・奥行き・段を枠の大きさに合わせて広げる。
const _layoutCache = new Map();
function fitGrid(slot, size, pile, stack) {
  let [pw, ph, pd] = size, yaw = 0;
  const rot = pile || slot.kind === 'bakery';
  const gap = pile ? 1.0 : 1.04;
  const grid = (a, b) => [Math.max(1, Math.floor(slot.w / (a * gap))), Math.max(1, Math.floor(slot.d / (b * (pile ? 1 : 1.06))))];
  let [C, R] = grid(pw, pd);
  if (rot) { const [c2, r2] = grid(pd, pw); if (c2 * r2 > C * R) { [C, R] = [c2, r2]; [pw, pd] = [pd, pw]; yaw = Math.PI / 2; } }
  const Lmax = Math.max(1, Math.floor(slot.h / ph));
  return { C, R, L: Math.max(1, Math.min(stack || 1, Lmax)), Lmax, pw, ph, pd, yaw };
}
export function slotPositions(pid, slot) {
  const key = pid + '|' + slot.key;
  let out = _layoutCache.get(key);
  if (out) return out;
  const p = PRODUCTS[pid], qty = p.qty;
  const pile = slot.pile || slot.kind === 'produce' || slot.kind === 'frozen';
  const G = fitGrid(slot, p.size, pile, p.stack);
  let { C, R, L } = G;
  while (C * R * L < qty && L < G.Lmax) L++;            // 入りきらなければ段を積む
  let rows = Math.min(R, Math.ceil(qty / (C * L)));     // 手前から必要な列数だけ
  let cols = C;
  if (cols * rows * L < qty) cols = Math.ceil(qty / (rows * L)); // それでも無理なら詰めて並べる
  const gx = Math.min(slot.w / cols, Math.max(G.pw * 1.02, slot.w / cols));
  const gz = slot.d / rows;                              // 奥行き方向は枠いっぱいに広げる
  const x0 = -(cols - 1) * gx / 2;
  out = [];
  const rnd = mulberryLite(key.length * 7919 + pid.charCodeAt(0));
  // 手前の列から埋める（減ってきても前面は最後まで並んで見える）
  for (let r = 0; r < rows; r++) for (let l = 0; l < L; l++) for (let c = 0; c < cols; c++) {
    let lx = x0 + c * gx, lz = slot.d / 2 - gz / 2 - r * gz, ly = l * G.ph, yaw = G.yaw;
    if (pile) {
      lx += (rnd() - 0.5) * gx * 0.3; lz += (rnd() - 0.5) * gz * 0.3;
      yaw += (rnd() - 0.5) * (slot.kind === 'produce' || slot.pile ? 2.4 : 0.4);
      if (l % 2) { lx += gx * 0.25; ly -= G.ph * 0.1; }
    }
    if (slot.kind === 'bakery') yaw += (rnd() - 0.5) * 0.5;
    out.push([slot.x + lx, slot.y + Math.max(0, ly), slot.z + lz * slot.side, yaw + (slot.side < 0 ? Math.PI : 0)]);
  }
  if (pile) out.sort((a, b) => a[1] - b[1]);
  out = out.slice(0, qty);
  _layoutCache.set(key, out);
  return out;
}
function mulberryLite(seed) { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
export const slotCapacity = (pid, slot) => slotPositions(pid, slot).length; // ＝箱1つぶん
export const canPlace = (pid, slot) => PRODUCTS[pid].place.includes(slot.kind);

// ローカル座標の当たり位置から一番近いスロット
export function pickSlot(type, lx, ly, lz) {
  const def = FIXTURES[type];
  let best = -1, bd = 1e9;
  (def.slots || []).forEach((s, i) => {
    if (def.slots.some((o) => o.side !== s.side) && Math.sign(lz || 1) !== s.side) return;
    const cy = s.y + s.h / 2;
    const d = (lx - s.x) ** 2 * 1.0 + (ly - cy) ** 2 * 2.2 + (lz - s.z) ** 2 * 0.3;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
// 値札の位置（棚のローカル座標）。描画と「値札を狙う」判定で共通
export function tagLocal(type, sl) {
  let tx = sl.x, ty = sl.y - 0.04, tz = sl.z + sl.side * (sl.d / 2 + 0.024);
  if (type === 'freezer') { ty = 0.72; tz = 0.506; }
  if (type === 'produce') { ty = sl.y + 0.02; tz = sl.z + sl.d / 2 + 0.045; }
  if (type === 'fridge') { ty = sl.y - 0.03; tz = 0.392; }
  return [tx, ty, tz];
}
// 狙った点の近くにある値札（商品のラベルがついている枠だけ）。スマホでも狙いやすいよう少し広めに判定
export function pickTag(f, lx, ly, lz) {
  const def = FIXTURES[f.t];
  if (!def?.slots || !f.s) return -1;
  const two = def.slots.some((o) => o.side !== def.slots[0].side);
  let best = -1, bd = 1e9;
  def.slots.forEach((sl, i) => {
    if (!f.s[i]?.[0]) return;
    if (two && Math.sign(lz || 1) !== sl.side) return;
    const [tx, ty, tz] = tagLocal(f.t, sl);
    const dx = Math.abs(lx - tx), dy = Math.abs(ly - ty), dz = Math.abs(lz - tz);
    if (dx > Math.max(0.1, sl.w * 0.45) || dy > 0.065 || dz > 0.2) return;
    const dd = dx * dx + dy * dy * 4;
    if (dd < bd) { bd = dd; best = i; }
  });
  return best;
}
export function pickBoxSlot(type, lx, ly) {
  const def = FIXTURES[type];
  let best = -1, bd = 1e9;
  (def.boxSlots || []).forEach((s, i) => {
    const d = (lx - s.x) ** 2 + (ly - (s.y + 0.2)) ** 2 * 1.5;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

// シングルカードの置き場所（狙った点に一番近い枠）
export function pickCardSlot(type, lx, ly, lz) {
  const def = FIXTURES[type];
  let best = -1, bd = 1e9;
  (def.cards || []).forEach((s, i) => {
    const d = (lx - s.x) ** 2 + (ly - s.y) ** 2 * (s.t > 0.6 ? 0.4 : 1.5) + (lz - s.z) ** 2 * (s.t > 0.6 ? 1.5 : 0.3);
    if (d < bd) { bd = d; best = i; }
  });
  return bd < 0.06 ? best : -1;
}
export function cardAccess(f, ci) { const def = FIXTURES[f.t], s = def.cards[ci]; return localToWorld(f, s.x, def.d / 2 + 0.45); }
export function seatSpot(f, si) { const def = FIXTURES[f.t], [x, z] = def.seats[si]; return localToWorld(f, x, z); }

// ---------- 従業員 ----------
// 仕事は「レジ」と「品出し」。だれでもどちらもできるが、1人ひとりレジと品出しの得意さ（はやさ）がちがう
export const STAFF_ROLES = {
  both: { name: '両方（おまかせ）', icon: '🔄', desc: 'レジにお客さんが並んだらレジへ、空いている時間は品出し' },
  cashier: { name: 'レジ係', icon: '🧾', desc: '空いているレジで会計をする' },
  stocker: { name: '品出し係', icon: '📦', desc: '届いた段ボールをラベルの貼ってある倉庫棚へ運び、値札のついた棚が減ったら補充する' },
};
// はやさ（歩く速さ・仕事の速さ）と日給
export const SPEEDS = [
  null,
  { id: 1, name: 'とても遅い', icon: '🐢', k: 0.5, wage: 800 },
  { id: 2, name: '遅い', icon: '🐌', k: 0.75, wage: 1100 },
  { id: 3, name: '普通', icon: '🙂', k: 1.0, wage: 1500 },
  { id: 4, name: '早い', icon: '🏃', k: 1.45, wage: 2100 },
  { id: 5, name: 'とても早い', icon: '⚡', k: 2.0, wage: 2800 },
];
// 雇える人（No.1〜10）。reg：レジのはやさ　stk：品出しのはやさ（両方同じ人もいる）
// lic：雇用ライセンス（お店のレベルが届いたら、お金を払ってライセンスを買うと雇える）
export const STAFF_SLOTS = [
  { no: 1, lv: 5, reg: 1, stk: 1, lic: 5000 },
  { no: 2, lv: 8, reg: 2, stk: 1, lic: 8000 },
  { no: 3, lv: 12, reg: 1, stk: 3, lic: 12000 },
  { no: 4, lv: 16, reg: 3, stk: 2, lic: 16000 },
  { no: 5, lv: 20, reg: 3, stk: 3, lic: 20000 },
  { no: 6, lv: 25, reg: 2, stk: 4, lic: 25000 },
  { no: 7, lv: 30, reg: 5, stk: 2, lic: 35000 },
  { no: 8, lv: 36, reg: 4, stk: 4, lic: 40000 },
  { no: 9, lv: 43, reg: 3, stk: 5, lic: 50000 },
  { no: 10, lv: 50, reg: 5, stk: 5, lic: 60000 },
];
export const hasStaffLicense = (store, no) => !!store?.slic?.[no];
export const STAFF_MAX = STAFF_SLOTS.length;
export const staffSlotOpen = (level, no) => (level || 1) >= (STAFF_SLOTS[no - 1]?.lv ?? 999);
export const staffLimit = (level) => STAFF_SLOTS.filter((s) => (level || 1) >= s.lv).length;
// その人のその仕事のはやさ（job：'cashier'＝レジ／それ以外＝品出し）
export const staffSpd = (s, job) => (job === 'cashier' ? s.reg : s.stk) || 1;
export const staffK = (s, job) => SPEEDS[staffSpd(s, job)]?.k || 0.5;
export const WAGE_MULT = 2; // 日給は、はやさの表（SPEEDS）の2倍
export const staffWage = (reg, stk) => Math.round(((SPEEDS[reg || 1]?.wage || 800) + (SPEEDS[stk || reg || 1]?.wage || 800)) / 2 * WAGE_MULT / 100) * 100;
// 得意な仕事（同じなら null）
export const staffFav = (s) => (s.reg > s.stk ? 'cashier' : s.stk > s.reg ? 'stocker' : null);
export const TRASH_TYPES = ['trash', 'dumpster'];
export const STAFF_NAMES = ['たなか', 'すずき', 'さとう', 'やまだ', 'こばやし', 'いとう', 'わたなべ', 'なかむら', 'かとう', 'よしだ', 'まつもと', 'いのうえ', 'きむら', 'はやし', 'しみず', 'もり', 'あべ', 'いけだ', 'はしもと', 'やまもと'];

// ---------- お店のレベル（最大50） ----------
// スキルボードはなし。商品・設備・従業員・レジの台数はレベルで増える
export const MAX_LEVEL = 50;
export const XP_YEN = 50; // 売上 ¥50 につき経験値1
export function xpNeed(level) { return Math.round((180 * Math.pow(1.09, level - 1) + 120 * (level - 1)) / 10) * 10; }
export function checkoutLimit(level) { return level >= 35 ? 6 : level >= 25 ? 4 : level >= 15 ? 3 : level >= 6 ? 2 : 1; }
export const CHECKOUT_LV = [[6, 2], [15, 3], [25, 4], [35, 6]];
export function productUnlocked(pid, level) { const p = PRODUCTS[pid]; return !!p && !p.hidden && (level || 1) >= (p.lv || 1); }
// ライセンスを持っているか（レベルが届いて、ライセンスを買った商品だけ仕入れられる）
export const hasLicense = (store, pid) => !!PRODUCTS[pid] && (!PRODUCTS[pid].lic || !!store?.lic?.[pid]);
export const canOrder = (store, pid) => productUnlocked(pid, store?.level) && hasLicense(store, pid);
export function fixtureUnlocked(t, level) { const f = FIXTURES[t]; return !!f && !f.fixed && (level || 1) >= (f.lv || 1); }
// そのレベルで新しくできるようになること（レベルアップの知らせ・レベルの画面用）
export function unlocksAt(lv) {
  const out = [];
  for (const p of PRODUCTS_LIST) if (p.lv === lv && lv > 1) out.push({ k: 'prod', icon: p.cat === 'pack' ? '🎴' : p.cat === 'box' ? '🎁' : p.icon, name: `${p.name}${p.lic ? `（ライセンス ¥${p.lic.toLocaleString()}）` : ''}` });
  for (const [, f] of Object.entries(FIXTURES)) if (!f.fixed && f.lv === lv && lv > 1) out.push({ k: 'fx', icon: f.icon, name: f.name });
  for (const s of STAFF_SLOTS) if (s.lv === lv) out.push({ k: 'staff', icon: SPEEDS[Math.max(s.reg, s.stk)].icon, name: `従業員 No.${s.no} の雇用ライセンス ¥${s.lic.toLocaleString()}（🧾レジ:${SPEEDS[s.reg].name}・📦品出し:${SPEEDS[s.stk].name}）` });
  for (const [l, n] of CHECKOUT_LV) if (l === lv) out.push({ k: 'reg', icon: '🧾', name: `レジを${n}台まで置ける` });
  return out;
}
// ハーフ箱：中身が半分の箱（値段も半分。送料は同じ）
export const halfQty = (pid) => Math.ceil(PRODUCTS[pid].qty / 2);
export const boxUnits = (pid, half) => (half ? halfQty(pid) : PRODUCTS[pid].qty);
export function closeTime() { return CLOSE_TIME; }
export const PLAY_FEE = 300; // プレイテーブルの利用料（はじめ）
export const PLAY_FEE_MAX = 500; // これより高いと遊んでくれない
// 相場（日ごとに上下する）
export function marketPrice(store, pid) {
  const p = PRODUCTS[pid], m = store?.market?.[pid] ?? 1, v = p.price * m;
  if (v >= 1000) return Math.max(10, Math.round(v / 100) * 100);
  return Math.max(10, Math.round(v / 10) * 10);
}
export function marketCost(store, pid) { const p = PRODUCTS[pid]; return Math.max(1, Math.round(p.cost * (store?.market?.[pid] ?? 1))); }

export const CHAT_PRESETS = ['レジお願い！', '品出しするね', '発注しておくよ', 'OK!', 'ありがとう！', 'ナイス！', 'パック開けよう！', 'URきた！！', '開店しよう！', 'ちょっと待って'];
