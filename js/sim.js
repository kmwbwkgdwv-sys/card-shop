// ===== 経営シミュレーション（ホスト側で実行・three.js 非依存） =====
import {
  PRODUCTS, PRODUCTS_LIST, FIXTURES, STAFF_ROLES, STAFF_NAMES, BOX_SIZES, DELIVERY_AREA,
  OPEN_TIME, GAME_MIN_PER_SEC, SPAWN_POINTS, PLAYER_BOUNDS, START_BAYS, START_STOCK, STAFF_HOME, STOCK_SECTIONS, bayAt, doorOpen, snapFixture,
  getWalls, zones, keepClear, expandTargets, fixtureFootprint, marketPrice, marketCost, slotCapacity, slotAccess, rackAccess, checkoutSpot, canPlace,
  STAFF_SLOTS, SPEEDS, staffK, staffSpd, staffWage, slotWage, staffSlotOpen, checkoutLimit, closeTime, xpNeed, productUnlocked, fixtureUnlocked, localToWorld, CELL, TRASH_TYPES, ORDER_MAX_BOXES, SHIPPING_FEE,
  MAX_LEVEL, boxUnits, MANAGER, XP_YEN, BUILDING, EMPTY_BOX, EMPTY_BOX_PRICE, boxProd, boxLook, isPack, isBoosterBox, cardAccess, seatSpot, unlocksAt, PLAY_FEE, PLAY_FEE_MAX,
  canOrder, hasLicense, isSpray, SPRAY_ID, staffFav, slotPositions, hasStaffLicense,
} from './data.js';
import { CARDS, CARDS_LIST, BOX_PACKS, openPack, openBox, cardValue, cardLimit, cardPrice, updateCardMarket, buybackPrice, seriesOfProduct, rarityOrder, isHit, cardRank, baseId } from './cards.js';
import { NavGrid } from './nav.js';
import { rand, randi, pick, dist, dist2, clamp } from './util.js';

export const SAVE_V = 1;
export function newStore(name) {
  const st = {
    v: SAVE_V, name: name || 'アニモンカードショップ', money: 30000, day: 1, level: 1, xp: 0, rep: 50,
    prices: {}, market: {}, marketPrev: {}, staff: [], nid: 100, phase: 'prep', time: OPEN_TIME,
    totalSales: 0, totalCustomers: 0, rev: 1, created: Date.now(), color: '#e8322b',
    today: newToday(),
    bays: Object.fromEntries(START_BAYS.map((b) => [b, 1])),
    stock: Object.fromEntries(START_STOCK.map((b) => [b, 1])),
    fixtures: initialFixtures(),
    boxes: [], reviews: [], crates: [],
    // カード：持っている枚数・図鑑（一度でも手に入れたカード）・自分で決めた値段・相場の変動
    cards: {}, dex: {}, cprices: {}, cmk: {}, cmkPrev: {}, playFee: PLAY_FEE,
    stats: { packs: 0, boxes: 0, cardsSold: 0, played: 0, sprayed: 0 },
    // ライセンス（買った商品だけ仕入れられる）・手に持っている物（パック最大5／BOX1つ／消臭スプレー1本）
    lic: {}, hand: {}, slic: {},
  };
  return st;
}
const newToday = () => ({ sales: 0, served: 0, lost: 0, orders: 0, ship: 0, xp: 0, vend: 0, recycle: 0, cardSales: 0, playSales: 0, buyback: 0, packs: 0, lic: 0, smelly: 0, cleaned: 0, smellLost: 0 });
function initialFixtures() {
  return [
    // パソコン室（入口の右）：正面の壁ぎわにパソコンの机、左右の壁にカード相場ボードと拡張ボード
    { id: 1, t: 'pc', x: 10, z: 5.4, r: 2 },
    { id: 2, t: 'fboard', x: 14.62, z: 3.5, r: 3 },
    { id: 3, t: 'xboard', x: 5.38, z: 3.5, r: 1 },
    { id: 4, t: 'recycle', x: 16.4, z: 3, r: 1 }, // 建物の右の外（搬入口から出てすぐ）
    { id: 5, t: 'checkout', x: 3, z: 3.25, r: 2 },
    { id: 6, t: 'single', x: -3, z: -3.5, r: 0, s: emptySlots('single') },
    { id: 7, t: 'single', x: -3, z: -0.75, r: 0, s: emptySlots('single') },
    { id: 8, t: 'rack', x: 12.5, z: -3.4, r: 0, lb: emptyLabels('rack') },
    { id: 10, t: 'plant', x: -4.5, z: 5.5, r: 0 },
    { id: 11, t: 'trash', x: 4.5, z: 5.5, r: 0 },
    { id: 12, t: 'opensign', x: 2.25, z: 5.25, r: 0 },
    { id: 13, t: 'dumpster', x: 12.3, z: 0.43, r: 2 },
  ];
}
export function emptySlots(t) { return (FIXTURES[t].slots || []).map(() => [null, 0]); }
export function emptyLabels(t) { return (FIXTURES[t].boxSlots || []).map(() => null); }
export function emptyCards(t) { return (FIXTURES[t].cards || []).map(() => null); }
// 売値：自分で決めた値段。決めていなければ相場どおり
export const getPrice = (store, pid) => store.prices[pid] ?? marketPrice(store, pid);
// これより高いとお客さんは買わない：相場の+20%
export const PRICE_OK = 1.2;
export const priceLimit = (store, pid) => Math.floor(marketPrice(store, pid) * PRICE_OK);

// 保存データの整合性を直す（読込時）
export function normalizeStore(st) {
  st.v ||= SAVE_V;
  st.crates ||= []; st.reviews ||= []; st.market ||= {}; st.marketPrev ||= {};
  st.bays ||= Object.fromEntries(START_BAYS.map((b) => [b, 1])); st.stock ||= Object.fromEntries(START_STOCK.map((b) => [b, 1]));
  st.prices ||= {}; st.staff ||= []; st.boxes ||= []; st.fixtures ||= [];
  st.cards ||= {}; st.dex ||= {}; st.cprices ||= {}; st.cmk ||= {}; st.cmkPrev ||= {}; st.playFee ??= PLAY_FEE;
  // ライセンス：前のセーブデータは、レベルで入荷できていた商品のライセンスを持っていることにする
  if (!st.lic) { st.lic = {}; for (const p of PRODUCTS_LIST) if (productUnlocked(p.id, st.level || 1)) st.lic[p.id] = 1; }
  for (const k of Object.keys(st.lic)) if (!PRODUCTS[k]) delete st.lic[k];
  st.hand ||= {};
  // 従業員の雇用ライセンス：前のデータで雇っていた人の枠はライセンスを持っていることにする
  if (!st.slic) { st.slic = {}; for (const s of st.staff || []) if (s.slot) st.slic[s.slot] = 1; }
  for (const [k, hd] of Object.entries(st.hand)) if (!hd || !handOk(hd)) delete st.hand[k];
  st.stats = { packs: 0, boxes: 0, cardsSold: 0, played: 0, ...(st.stats || {}) };
  st.today = { ...newToday(), ...(st.today || {}) };
  st.rev ||= 1; st.level = clamp(st.level || 1, 1, MAX_LEVEL); st.xp ||= 0;
  if (st.level >= MAX_LEVEL) st.xp = 0;
  for (const c of st.crates) if (c.loc?.t !== 'f') c.loc = crateSpot(st); // 持ったままの大きい段ボールは店の前に戻す
  if (st.phase !== 'prep' && st.phase !== 'summary') { st.phase = 'prep'; st.time = OPEN_TIME; }
  if (st.phase === 'summary') { st.phase = 'prep'; st.day++; st.time = OPEN_TIME; st.today = newToday(); }
  for (const f of st.fixtures) if (f.t === 'mboard') { f.t = 'pc'; f.z = 5.4; } // 前のマネージャーボード → パソコン
  st.fixtures = st.fixtures.filter((f) => FIXTURES[f.t]);
  for (const f of st.fixtures) {
    const def = FIXTURES[f.t];
    if (def.slots) { f.s ||= emptySlots(f.t); while (f.s.length < def.slots.length) f.s.push([null, 0]); f.s = f.s.slice(0, def.slots.length).map((x) => (Array.isArray(x) && (!x[0] || PRODUCTS[x[0]]) ? [x[0] ?? null, x[1] || 0] : [null, 0])); }
    if (def.boxSlots) { f.lb ||= emptyLabels(f.t); while (f.lb.length < def.boxSlots.length) f.lb.push(null); f.lb = f.lb.map((p) => (PRODUCTS[p] ? p : null)); }
    if (def.scent) f.sp = (Array.isArray(f.sp) ? f.sp : []).filter((u) => u > 0.001).slice(0, def.scent.cans);
    if (def.cards) { f.cs ||= emptyCards(f.t); while (f.cs.length < def.cards.length) f.cs.push(null); f.cs = f.cs.slice(0, def.cards.length).map((c) => (CARDS[c] ? c : null)); }
  }
  for (const s of st.staff) {
    // 従業員：レジと品出しのはやさを別々に持つ（前のデータは雇った枠の値にする）
    const sl = STAFF_SLOTS.find((o) => o.no === s.slot);
    if (!s.reg || !s.stk) { s.reg = sl?.reg || s.spd || 1; s.stk = sl?.stk || s.spd || 1; }
    delete s.spd; delete s.fav;
    if (!STAFF_ROLES[s.role]) s.role = 'both';
    s.wage = s.slot ? slotWage(s.slot) : staffWage(s.reg, s.stk);
  }
  for (const [k, n] of Object.entries(st.cards)) if (!CARDS[k] || !(n > 0)) delete st.cards[k]; else st.dex[baseId(k)] = 1;
  for (const k of Object.keys(st.dex)) if (!CARDS[k] || CARDS[k].flash) delete st.dex[k];
  st.boxes = st.boxes.filter((b) => PRODUCTS[b.p] || (b.p === EMPTY_BOX.id && !b.n));
  let k = 0;
  for (const b of st.boxes) if (b.loc?.t === 'h' || !b.loc) b.loc = deliverySpot(st, k++);
  return st;
}

// 設備をつくる（設置したとき）
function newFixture(st, t, x, z, r) {
  const def = FIXTURES[t];
  const f = { id: st.nid++, t, x, z, r };
  if (def.slots) f.s = emptySlots(t);
  if (def.boxSlots) f.lb = emptyLabels(t);
  if (def.cards) f.cs = emptyCards(t);
  if (def.scent) f.sp = [];
  if (def.text) { f.tx = t === 'banner' ? 'カードパック' : t === 'neon' ? 'OPEN' : t === 'hangsign' ? '新弾入荷！' : 'いらっしゃいませ'; f.c = t === 'neon' ? '#ff4fd8' : '#ffffff'; }
  return f;
}
// 大きい段ボールが届く場所（店の前の荷物置き場の横。ほかの箱と重ならない所）
export function crateSpot(st) {
  const taken = [...(st.crates || []).filter((c) => c.loc?.t === 'f').map((c) => [c.loc.x, c.loc.z, 0.75]), ...(st.boxes || []).filter((b) => b.loc?.t === 'f').map((b) => [b.loc.x, b.loc.z, 0.45])];
  const free = (x, z) => taken.every(([tx, tz, r]) => Math.abs(tx - x) > r + 0.55 || Math.abs(tz - z) > r + 0.45);
  for (const z of [11.0, 12.3, 13.6, 14.9]) for (const x of [-1.6, -3.0, -4.4, -5.8, -7.2, 8.6, 10.0, 11.4]) if (free(x, z)) return { t: 'f', x, y: 0, z, ry: 0 };
  return { t: 'f', x: -2 - Math.random() * 6, y: 0, z: 11 + Math.random() * 4, ry: 0 };
}
// 設備を置く場所：狙った所に置けないとき（壁・柱・ほかの棚に少しかかるなど）は、となりの置ける所に寄せる
export function fitPlacement(store, type, x, z, r, ignoreId, avoid = () => false) {
  const S = { store }, chk = (xx, zz) => Sim.prototype.canPlaceFixture.call(S, type, xx, zz, r, ignoreId);
  const check = chk(x, z);
  if (check === true && !avoid(x, z)) return { x, z, ok: true, why: true };
  const fp = fixtureFootprint(type, 0, 0, r), R = Math.max(1, Math.ceil((Math.max(fp.rw, fp.rd) / 2 + 0.5) * 2) / 2);
  const steps = []; for (let v = -R; v <= R + 1e-6; v += 0.5) steps.push(v);
  const cands = [];
  for (const dx of steps) for (const dz of steps) {
    if (!dx && !dz) continue;
    const [cx, cz] = snapFixture(type, x + dx, z + dz, r);
    cands.push([Math.hypot(cx - x, cz - z), cx, cz]);
  }
  cands.sort((a, b) => a[0] - b[0]);
  for (const [, cx, cz] of cands) if (!avoid(cx, cz) && chk(cx, cz) === true) return { x: cx, z: cz, ok: true, why: true };
  return { x, z, ok: false, why: check === true ? '自分と重なっています（少し離れてね）' : check };
}
function deliverySpot(st, k) {
  const A = DELIVERY_AREA, cols = Math.floor((A.maxX - A.minX) / 0.7), rows = Math.floor((A.maxZ - A.minZ) / 0.56);
  const per = cols * rows, layer = Math.floor(k / per), i = k % per;
  const j = ((k * 2654435761) >>> 0) / 4294967296;
  return { t: 'f', x: A.minX + 0.35 + (i % cols) * 0.7 + (j - 0.5) * 0.08, y: layer * 0.42, z: A.minZ + 0.3 + Math.floor(i / cols) * 0.56 + (j - 0.5) * 0.06, ry: (j - 0.5) * 0.5 };
}

// ---------- 手に持つ物（パック最大5・BOX1つ・消臭スプレー1本） ----------
export const HAND_MAX = 5;
// 消臭スプレー（手で使う）：押しているあいだシューッと出る。1本で約6.5秒（臭いお客さん3人くらい）
export const SPRAY_RATE = 0.15;  // 1秒で減るゲージ
export const SPRAY_POWER = 5;    // 1秒で減る臭い（臭い10 → 2秒ほど吹きかけると消える）
function handOk(hd) {
  if (hd.t === 'packs') return Array.isArray(hd.a) && hd.a.length > 0 && hd.a.every(isPack);
  if (hd.t === 'box') return isBoosterBox(hd.p);
  if (hd.t === 'spray') return hd.u > 0.001;
  return false;
}
export const handPid = (hd) => (!hd ? null : hd.t === 'packs' ? hd.a[hd.a.length - 1] : hd.p);
export const handCount = (hd) => (!hd ? 0 : hd.t === 'packs' ? hd.a.length : 1);
const inStore = (c) => c.z < 6 && c.x > BUILDING.minX && c.x < BUILDING.maxX;
// 臭いお客さんの出る確率（お店 Lv.2 から）
export const smellRate = (lv) => (lv >= 2 ? Math.min(0.18, 0.1 + lv * 0.002) : 0);

export function newDyn() { return { customers: [], staffRt: {}, regs: {}, deliveries: [], spawnT: 3, cid: 1, seats: {} }; }
const BUBBLE_T = 2.6;
const DELIVERY_SEC = 8;

export class Sim {
  constructor(store) {
    this.store = normalizeStore(store);
    if (!Object.keys(this.store.cmk).length) updateCardMarket(this.store);
    this.dyn = newDyn();
    this.nav = new NavGrid();
    this.nav.build(this.store);
    this.events = [];
    this.players = {}; // uid -> {x,z,name}
    this.dynRev = 0;
  }
  bump() { this.store.rev++; }
  ev(e) { this.events.push(e); }
  toast(to, msg, kind = 'info') { this.ev({ t: 'toast', to, msg, kind }); }
  err(to, msg) { this.ev({ t: 'toast', to, msg, kind: 'err' }); this.ev({ t: 'sfx', s: 'err', to }); }
  // 発注・従業員・拡張などは、パソコン室のボードの前でしかできない
  atBoard(uid) {
    if (this.requireBoard === false) return true;
    const p = this.players[uid];
    if (!p) return false;
    const m = 0.8;
    if (p.x > MANAGER.x0 - m && p.x < MANAGER.x1 + m && p.z > MANAGER.z0 - m && p.z < MANAGER.z1 + m) return true;
    return this.store.fixtures.some((f) => BOARD_TYPES.includes(f.t) && dist(p.x, p.z, f.x, f.z) < 3.2);
  }
  sfx(s, x, z) { this.ev({ t: 'sfx', s, x, z }); }
  fx(id) { return this.store.fixtures.find((f) => f.id === id); }
  box(id) { return this.store.boxes.find((b) => b.id === id); }
  heldBox(who) { return this.store.boxes.find((b) => b.loc.t === 'h' && b.loc.who === who); }
  hand(uid) { return this.store.hand?.[uid] || null; }
  setHand(uid, hd) { this.store.hand ||= {}; if (hd) this.store.hand[uid] = hd; else delete this.store.hand[uid]; }
  reg(fid) { return (this.dyn.regs[fid] ||= { q: [], op: null, belt: [], ph: 'idle', pay: null, cust: null }); }
  get level() { return this.store.level || 1; }

  // ---------- プレイヤー操作 ----------
  act(uid, a) {
    const fn = this['a_' + a.t];
    if (!fn) return;
    try { fn.call(this, uid, a); } catch (e) { console.error('action error', a, e); }
  }
  a_pick(uid, a) {
    if (this.heldBox(uid) || this.heldCrate(uid)) return this.err(uid, 'すでに箱を持っています');
    if (this.hand(uid)) return this.err(uid, '手に持っている物を棚に置くか、開封してから持とう');
    const b = this.box(a.bid);
    if (!b || b.loc.t === 'h') return;
    if (b.loc.t === 'f') { // 上に積まれた箱があれば上から取る
      const top = this.store.boxes.filter((o) => o.loc.t === 'f' && Math.abs(o.loc.x - b.loc.x) < 0.3 && Math.abs(o.loc.z - b.loc.z) < 0.3).sort((p, q) => q.loc.y - p.loc.y)[0];
      if (top && top !== b && top.loc.y > b.loc.y) return this.a_pick(uid, { bid: top.id });
    }
    b.loc = { t: 'h', who: uid }; delete b.drop;
    this.sfx('pick'); this.bump();
  }
  a_drop(uid, a) {
    const b = this.heldBox(uid);
    if (!b) return;
    const x = clamp(+a.x || 0, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX), z = clamp(+a.z || 0, PLAYER_BOUNDS.minZ, PLAYER_BOUNDS.maxZ);
    b.loc = { t: 'f', x, y: this.stackHeight(x, z, b), z, ry: +a.ry || 0 };
    this.sfx('place'); this.bump();
  }
  stackHeight(x, z, self) {
    let y = 0;
    for (const o of this.store.boxes) {
      if (o === self || o.loc.t !== 'f') continue;
      if (Math.abs(o.loc.x - x) < 0.4 && Math.abs(o.loc.z - z) < 0.35) y = Math.max(y, o.loc.y + BOX_SIZES[boxProd(boxLook(o)).bx][1]);
    }
    return Math.min(y, 2.4);
  }
  // 倉庫棚に箱を置く（プレイヤーはどの段にも置ける。ラベルのない段に置くとその商品のラベルが貼られる）
  a_rackBox(uid, a) {
    const b = this.heldBox(uid), f = this.fx(a.fid);
    if (!b || !f || !FIXTURES[f.t].boxSlots) return;
    const si = a.si | 0;
    if (si < 0 || si >= FIXTURES[f.t].boxSlots.length) return;
    if (this.store.boxes.some((o) => o.loc.t === 'r' && o.loc.fid === f.id && o.loc.si === si)) return this.err(uid, 'その場所は埋まっています');
    b.loc = { t: 'r', fid: f.id, si };
    f.lb ||= emptyLabels(f.t);
    if (!f.lb[si] && b.n > 0 && PRODUCTS[b.p]) { f.lb[si] = b.p; this.toast(uid, `🏷 この段に「${PRODUCTS[b.p].name}」のラベルを貼りました`, 'ok'); }
    this.sfx('place'); this.bump();
  }
  // 倉庫棚のラベル（従業員はラベルの商品しかその段に置かない）
  a_rackLabel(uid, a) {
    const f = this.fx(a.fid);
    if (!f || !FIXTURES[f.t].boxSlots) return;
    const si = a.si | 0; if (si < 0 || si >= FIXTURES[f.t].boxSlots.length) return;
    f.lb ||= emptyLabels(f.t);
    if (a.all) { for (let i = 0; i < f.lb.length; i++) f.lb[i] = a.pid && PRODUCTS[a.pid] ? a.pid : null; }
    else f.lb[si] = a.pid && PRODUCTS[a.pid] ? a.pid : null;
    this.sfx('place'); this.bump();
  }
  // 段ボールを開ける／閉じる（開けている間だけ棚に出し入れできる）
  a_boxOpen(uid, a) {
    const b = this.heldBox(uid) || (a.bid != null ? this.box(a.bid) : null);
    if (!b || (b.loc.t === 'h' && b.loc.who !== uid)) return;
    b.o = a.open == null ? !b.o : !!a.open;
    this.sfx(b.o ? 'boxopen' : 'boxclose'); this.bump();
  }
  a_discard(uid, a = {}) {
    const b = this.heldBox(uid);
    if (!b) return;
    if (b.n > 0) return this.err(uid, '中身が残っている箱は捨てられません');
    const f = a.fid != null ? this.fx(a.fid) : null;
    if (!f || !TRASH_TYPES.includes(f.t)) return this.err(uid, '空の段ボールはゴミ箱に捨てよう');
    this.store.boxes = this.store.boxes.filter((o) => o !== b);
    this.sfx('trash'); this.bump();
  }
  a_stock(uid, a) {
    const b = this.heldBox(uid), f = this.fx(a.fid);
    if (!b || !f || !f.s) return;
    const r = this.stockOne(b, f, a.si | 0);
    if (r === 'kind') this.err(uid, `${PRODUCTS[b.p].name}はこの棚に置けません`);
    else if (r === 'other') this.err(uid, '別の商品が置かれています');
    else if (r === 'full') this.err(uid, '棚がいっぱいです');
    else if (r === 'empty') this.err(uid, '箱が空です');
    else if (r === 'closed') this.err(uid, '段ボールを開けてから補充しよう');
  }
  stockOne(b, f, si) {
    const slot = FIXTURES[f.t].slots[si], s = f.s[si];
    if (!slot || !s) return 'bad';
    if (!b.o) return 'closed';
    if (b.n <= 0) return 'empty';
    if (s[0] && s[0] !== b.p) { if (s[1] > 0) return 'other'; }
    if (!canPlace(b.p, slot)) return 'kind';
    s[0] = b.p;
    if (s[1] >= slotCapacity(b.p, slot)) return 'full';
    s[1]++; b.n--;
    this.sfx('stock', f.x, f.z); this.bump();
    return 'ok';
  }
  a_unstock(uid, a) {
    const b = this.heldBox(uid), f = this.fx(a.fid);
    if (!b || !f || !f.s) return;
    const s = f.s[a.si | 0];
    if (!s || !s[0] || s[1] <= 0) return;
    if (!b.o) return this.err(uid, '段ボールを開けてから回収しよう');
    if (b.p !== s[0] && b.n > 0) return this.err(uid, `この箱には${PRODUCTS[b.p]?.name || '別の商品'}が入っています（1箱に1種類だけ）`);
    if (b.n >= PRODUCTS[s[0]].qty) return this.err(uid, '箱がいっぱいです');
    b.p = s[0]; s[1]--; b.n++;
    this.sfx('pick'); this.bump();
  }
  a_clearSlot(uid, a) {
    const f = this.fx(a.fid); if (!f?.s) return;
    const s = f.s[a.si | 0];
    if (s && s[1] === 0) { s[0] = null; this.bump(); }
  }
  a_price(uid, a) {
    if (!PRODUCTS[a.pid]) return;
    if (a.v == null || a.v === 'market') delete this.store.prices[a.pid];
    else this.store.prices[a.pid] = clamp(Math.round(+a.v || 0), 1, 9999999);
    this.bump();
  }
  a_priceAll(uid, a) {
    if (!this.atBoard(uid)) return this.err(uid, BOARD_ONLY);
    const k = +a.k || 1;
    for (const p of PRODUCTS_LIST) { if (!productUnlocked(p.id, this.level)) continue; if (k === 1) delete this.store.prices[p.id]; else this.store.prices[p.id] = Math.max(1, Math.round(marketPrice(this.store, p.id) * k / 10) * 10); }
    this.toast(uid, k === 1 ? '全商品を相場どおりにしました' : `全商品を相場の${Math.round(k * 100)}%にしました`, 'ok');
    this.bump();
  }
  a_order(uid, a) {
    if (!this.atBoard(uid)) return this.err(uid, BOARD_ONLY);
    const items = (a.items || []).filter(([p, n]) => n > 0 && (p === EMPTY_BOX.id || canOrder(this.store, p))).map(([p, n, half]) => [p, Math.min(ORDER_MAX_BOXES, n | 0), half && p !== EMPTY_BOX.id ? 1 : 0]);
    if (!items.length) return;
    const boxes = items.reduce((t, [, n]) => t + n, 0);
    if (boxes > ORDER_MAX_BOXES) return this.err(uid, `1回の配達は最大${ORDER_MAX_BOXES}箱までです`);
    const goods = orderCost(this.store, items), cost = goods + SHIPPING_FEE;
    if (cost > this.store.money) return this.err(uid, 'お金が足りません（送料もかかります）');
    this.store.money -= cost; this.store.today.orders += goods; this.store.today.ship = (this.store.today.ship || 0) + SHIPPING_FEE;
    this.dyn.deliveries.push({ t: DELIVERY_SEC, items });
    this.toast(null, `発注しました！${DELIVERY_SEC}秒ほどで店の前に届きます`, 'ok');
    this.sfx('cash'); this.bump();
  }
  // 従業員の雇用ライセンスを買う（レベルが届いた枠だけ。買うとその人を雇える）
  a_staffLicense(uid, a) {
    if (!this.atBoard(uid)) return this.err(uid, BOARD_ONLY);
    const st = this.store, sl = STAFF_SLOTS.find((o) => o.no === (a.slot | 0));
    if (!sl) return;
    if (hasStaffLicense(st, sl.no)) return this.err(uid, 'もうライセンスを持っています');
    if (!staffSlotOpen(this.level, sl.no)) return this.err(uid, `お店のレベル${sl.lv}になると買えます`);
    if (sl.lic > st.money) return this.err(uid, 'お金が足りません');
    st.money -= sl.lic; st.slic[sl.no] = 1; st.today.lic = (st.today.lic || 0) + sl.lic;
    this.toast(null, `🔑 従業員 No.${sl.no} の雇用ライセンスを買いました！雇えるようになりました`, 'ok');
    this.sfx('cash'); this.bump();
  }
  // ライセンスを買う（レベルが届いた商品だけ。買うと仕入れられる）
  a_license(uid, a) {
    if (!this.atBoard(uid)) return this.err(uid, BOARD_ONLY);
    const st = this.store, p = PRODUCTS[a.pid];
    if (!p || p.hidden) return;
    if (hasLicense(st, p.id)) return this.err(uid, 'もうライセンスを持っています');
    if (!productUnlocked(p.id, this.level)) return this.err(uid, `お店のレベル${p.lv}になると買えます`);
    if (p.lic > st.money) return this.err(uid, 'お金が足りません');
    st.money -= p.lic; st.lic[p.id] = 1; st.today.lic = (st.today.lic || 0) + p.lic;
    this.toast(null, `🔑「${p.name}」のライセンスを買いました！仕入れられます`, 'ok');
    this.sfx('cash'); this.bump();
  }
  // 設備を買う：店の前に大きい段ボールで届く（持って置きたい場所で開けると設置される）
  a_buy(uid, a) {
    const st = this.store, def = FIXTURES[a.ft];
    if (!def || def.fixed || !fixtureUnlocked(a.ft, this.level)) return;
    if (def.price > st.money) return this.err(uid, 'お金が足りません');
    const count = (t) => st.fixtures.filter((f) => f.t === t).length + st.crates.filter((c) => c.ft === t).length;
    if (a.ft === 'checkout' && count('checkout') >= checkoutLimit(this.level)) return this.err(uid, `レジはいま${checkoutLimit(this.level)}台までです（お店のレベルが上がると増やせます）`);
    st.money -= def.price;
    st.crates.push({ id: st.nid++, ft: a.ft, loc: crateSpot(st), drop: 1 });
    this.toast(uid, `📦 ${def.icon} ${def.name}が大きい段ボールで店の前に届きます！持って、置きたい場所で「ここに置く」`, 'ok');
    this.sfx('truck'); this.bump();
  }
  heldCrate(who) { return this.store.crates.find((c) => c.loc.t === 'h' && c.loc.who === who); }
  crate(id) { return this.store.crates.find((c) => c.id === id); }
  a_cratePick(uid, a) {
    if (this.heldBox(uid) || this.heldCrate(uid)) return this.err(uid, 'すでに箱を持っています');
    if (this.hand(uid)) return this.err(uid, '手に持っている物を棚に置くか、開封してから持とう');
    const c = this.crate(a.cid);
    if (!c || c.loc.t === 'h') return;
    c.loc = { t: 'h', who: uid }; delete c.drop;
    this.sfx('pick'); this.bump();
  }
  a_crateDrop(uid, a) {
    const c = this.heldCrate(uid);
    if (!c) return;
    const x = clamp(+a.x || 0, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX), z = clamp(+a.z || 0, PLAYER_BOUNDS.minZ, PLAYER_BOUNDS.maxZ);
    c.loc = { t: 'f', x, y: 0, z, ry: +a.ry || 0 };
    this.sfx('place'); this.bump();
  }
  a_unpack(uid, a) {
    const st = this.store, c = this.heldCrate(uid);
    if (!c) return;
    const def = FIXTURES[c.ft]; if (!def) return;
    const r = a.r & 3;
    const ok = this.canPlaceFixture(c.ft, a.x, a.z, r, null);
    if (ok !== true) return this.err(uid, ok);
    st.fixtures.push(newFixture(st, c.ft, a.x, a.z, r));
    st.crates = st.crates.filter((o) => o !== c);
    this.nav.build(st);
    this.toast(uid, `🔨 ${def.icon} ${def.name}を置きました！`, 'ok');
    this.sfx('build', a.x, a.z); this.bump();
  }
  a_crateReturn(uid, a) {
    const st = this.store, c = this.crate(a.cid);
    if (!c || (c.loc.t === 'h' && c.loc.who !== uid)) return;
    const def = FIXTURES[c.ft];
    st.crates = st.crates.filter((o) => o !== c);
    st.money += def?.price || 0;
    this.toast(uid, `↩ ${def?.name || '設備'}を返品しました（+${(def?.price || 0).toLocaleString()}円）`, 'ok');
    this.sfx('coin'); this.bump();
  }
  a_move(uid, a) {
    const f = this.fx(a.fid);
    if (!f || FIXTURES[f.t].fixed) return;
    const r = a.r & 3;
    const ok = this.canPlaceFixture(f.t, a.x, a.z, r, f.id);
    if (ok !== true) return this.err(uid, ok);
    f.x = a.x; f.z = a.z; f.r = r;
    if (this.dyn.regs[f.id]) this.resetReg(f.id, true);
    this.kickSeats(f.id);
    this.nav.build(this.store);
    this.sfx('build', a.x, a.z); this.bump();
  }
  a_sell(uid, a) {
    const f = this.fx(a.fid);
    if (!f || FIXTURES[f.t].fixed) return;
    const def = FIXTURES[f.t];
    if (f.s && f.s.some((s) => s[1] > 0)) return this.err(uid, '商品が並んでいる棚は売却できません');
    if (f.cs && f.cs.some(Boolean)) return this.err(uid, 'カードが並んでいるテーブルは売却できません（先にカードを回収してね）');
    if (this.store.boxes.some((b) => b.loc.t === 'r' && b.loc.fid === f.id)) return this.err(uid, '箱が載っている在庫棚は売却できません');
    if (def.cat === 'checkout' && this.dyn.regs[f.id]) this.resetReg(f.id, true);
    delete this.dyn.regs[f.id];
    this.kickSeats(f.id);
    this.store.fixtures = this.store.fixtures.filter((o) => o !== f);
    this.store.money += Math.floor(def.price / 2);
    this.nav.build(this.store);
    this.sfx('cash'); this.bump();
  }
  a_text(uid, a) {
    const f = this.fx(a.fid);
    if (!f || !FIXTURES[f.t].text) return;
    f.tx = String(a.v || '').slice(0, 24); if (a.c) f.c = String(a.c).slice(0, 9);
    this.bump();
  }
  a_storeName(uid, a) {
    if (!this.atBoard(uid)) return this.err(uid, BOARD_ONLY);
    this.store.name = String(a.v || '').slice(0, 16) || 'アニモンカードショップ';
    if (a.c) this.store.color = String(a.c).slice(0, 9);
    this.bump();
  }
  a_playFee(uid, a) {
    if (!this.atBoard(uid)) return this.err(uid, BOARD_ONLY);
    this.store.playFee = clamp(Math.round((+a.v || 0) / 10) * 10, 0, 3000);
    this.bump();
  }
  a_expand(uid, a) {
    if (!this.atBoard(uid)) return this.err(uid, BOARD_ONLY);
    const st = this.store, t = expandTargets(st).find((x) => x.id === a.id);
    if (!t) return;
    if (!t.can) return this.err(uid, t.kind === 'bay' ? '買ってある売り場のとなりから広げてください' : '使っている倉庫のとなりから広げてください');
    if (st.money < t.cost) return this.err(uid, 'お金が足りません');
    st.money -= t.cost;
    const before = STOCK_SECTIONS.filter((x) => doorOpen(st, x)).map((x) => x.id);
    if (t.kind === 'bay') st.bays[t.id] = 1; else st.stock[t.id] = 1;
    this.nav.build(st);
    this.toast(null, t.kind === 'bay' ? '🧱 売り場を広げました！' : '📦 倉庫を広げました！', 'ok');
    for (const x of STOCK_SECTIONS) {
      if (before.includes(x.id) || !doorOpen(st, x)) continue;
      const r = { minX: x.x0 - 1.2, maxX: x.x0 + 1.2, minZ: x.door[0] - 0.4, maxZ: x.door[1] + 0.4 };
      const blocked = st.fixtures.some((f) => { if (FIXTURES[f.t]?.air) return false; const o = fixtureFootprint(f.t, f.x, f.z, f.r); return o.minX < r.maxX && o.maxX > r.minX && o.minZ < r.maxZ && o.maxZ > r.minZ; });
      if (blocked) this.toast(uid, `🚪 ${x.name}の出入口の前に設備があります。通れるように動かしてね`, 'warn');
    }
    this.sfx('build'); this.bump();
  }
  a_recycle(uid) {
    const b = this.heldBox(uid);
    if (!b) return;
    if (b.n > 0) return this.err(uid, '空の箱だけリサイクルできます');
    const v = 80;
    this.store.boxes = this.store.boxes.filter((o) => o !== b);
    this.store.money += v; this.store.today.recycle = (this.store.today.recycle || 0) + v;
    this.toast(uid, `♻️ リサイクル +¥${v}`, 'money');
    this.sfx('cash'); this.bump();
  }
  a_open(uid) {
    const st = this.store;
    if (st.phase === 'prep') { st.phase = 'open'; this.toast(null, '🟢 看板をOPENにしました！営業スタート', 'ok'); this.sfx('bell'); }
    else if (st.phase === 'open') { st.phase = 'closing'; this.toast(null, '🔴 看板をCLOSEDに。最後のお客さんの会計をしたら1日が終わります'); this.sfx('click'); }
    this.bump();
  }
  a_nextDay(uid) {
    const st = this.store;
    if (st.phase !== 'summary') return;
    st.phase = 'prep'; st.day++; st.time = OPEN_TIME;
    st.today = newToday();
    this.updateMarket();
    updateCardMarket(st);
    for (const c of this.dyn.customers) this.returnCards(c);
    this.dyn.customers = []; this.dyn.seats = {};
    for (const fid in this.dyn.regs) this.resetReg(+fid, true);
    let up = null, down = null;
    for (const p of PRODUCTS_LIST) {
      if (!productUnlocked(p.id, this.level)) continue;
      const prev = st.marketPrev?.[p.id], now = marketPrice(st, p.id); if (!prev) continue;
      const d = (now - prev) / prev;
      if (!up || d > up[1]) up = [p.id, d];
      if (!down || d < down[1]) down = [p.id, d];
    }
    // カード相場：持っているカードでいちばん値上がりしたもの
    let cup = null;
    for (const cid of Object.keys(st.dex)) { const m0 = st.cmkPrev[cid], m1 = st.cmk[cid]; if (!m0) continue; const d = m1 / m0 - 1; if (!cup || d > cup[1]) cup = [cid, d]; }
    this.ev({ t: 'newday', day: st.day, up: up && up[1] > 0.03 ? [up[0], Math.round(up[1] * 100)] : null, down: down && down[1] < -0.03 ? [down[0], Math.round(-down[1] * 100)] : null, cup: cup && cup[1] > 0.04 ? [cup[0], Math.round(cup[1] * 100)] : null });
    this.bump();
  }
  updateMarket() {
    const st = this.store;
    st.marketPrev = {};
    for (const p of PRODUCTS_LIST) {
      const m = st.market[p.id] ?? 1;
      st.marketPrev[p.id] = marketPrice(st, p.id);
      const g = (Math.random() + Math.random() + Math.random() - 1.5) * (p.cat === 'supply' ? 0.05 : 0.08);
      st.market[p.id] = +clamp(1 + (m - 1) * 0.8 + g, 0.8, 1.3).toFixed(3);
    }
  }
  // ---------- 従業員 ----------
  a_hire(uid, a) {
    if (!this.atBoard(uid)) return this.err(uid, BOARD_ONLY);
    const st = this.store, sl = STAFF_SLOTS.find((o) => o.no === (a.slot | 0));
    if (!sl) return;
    if (!staffSlotOpen(this.level, sl.no)) return this.err(uid, `お店のレベル${sl.lv}になると雇えます`);
    if (!hasStaffLicense(st, sl.no)) return this.err(uid, `先に No.${sl.no} の雇用ライセンスを買ってください`);
    if (st.staff.some((o) => o.slot === sl.no)) return this.err(uid, 'その人はもう雇っています');
    const seed = (a.seed >>> 0) || randi(1, 1e9);
    const role = STAFF_ROLES[a.role] ? a.role : 'both';
    const s = { id: st.nid++, role, reg: sl.reg, stk: sl.stk, name: staffName(a.name) || pick(STAFF_NAMES), seed, slot: sl.no, wage: sl.wage };
    st.staff.push(s);
    this.toast(null, `${s.name}さんを雇いました！（🧾レジ：${SPEEDS[s.reg].name}・📦品出し：${SPEEDS[s.stk].name}・日給 ¥${s.wage.toLocaleString()}）`, 'ok');
    this.sfx('bell'); this.bump();
  }
  a_staffName(uid, a) {
    if (!this.atBoard(uid)) return this.err(uid, BOARD_ONLY);
    const s = this.store.staff.find((o) => o.id === a.sid), name = staffName(a.name);
    if (!s || !name || s.name === name) return;
    this.toast(null, `${s.name}さんの名前を「${name}」にしました`, 'ok');
    s.name = name; this.bump();
  }
  // 仕事を変える（両方おまかせ／レジ係／品出し係）。はやさは人ごとに、レジと品出しでちがう
  a_staffRole(uid, a) {
    if (!this.atBoard(uid)) return this.err(uid, BOARD_ONLY);
    const s = this.store.staff.find((o) => o.id === a.sid), role = STAFF_ROLES[a.role];
    if (!s || !role || s.role === a.role) return;
    this.releaseStaff(s);
    s.role = a.role;
    const msg = a.role === 'both' ? `${s.name}さんはレジと品出しの両方をおまかせにしました`
      : a.role === 'pricer' ? `${s.name}さんを値段係にしました（棚の値段をいつもギリギリ売れる値段にします）`
        : `${s.name}さんを${role.name}にしました（はやさ：${SPEEDS[a.role === 'cashier' ? s.reg : s.stk].name}）`;
    this.toast(null, msg, 'ok');
    this.bump();
  }
  releaseStaff(s) {
    const who = 's:' + s.id, rt = this.dyn.staffRt[s.id];
    const b = this.heldBox(who);
    if (b) b.loc = { t: 'f', x: rt?.x ?? STAFF_HOME[0], y: this.stackHeight(rt?.x ?? STAFF_HOME[0], rt?.z ?? STAFF_HOME[1], b), z: rt?.z ?? STAFF_HOME[1], ry: 0 };
    for (const fid in this.dyn.regs) if (this.dyn.regs[fid].op === who) this.dyn.regs[fid].op = null;
    if (rt) { rt.st = 'idle'; rt.t = 0.5; rt.path = null; rt.bid = null; rt.fid = null; rt.msg = null; rt.job = null; rt.pj = null; }
  }
  a_fire(uid, a) {
    if (!this.atBoard(uid)) return this.err(uid, BOARD_ONLY);
    const st = this.store, s = st.staff.find((o) => o.id === a.sid);
    if (!s) return;
    this.releaseStaff(s);
    st.staff = st.staff.filter((o) => o !== s);
    delete this.dyn.staffRt[s.id];
    this.bump();
  }
  // ---------- レジ ----------
  a_regEnter(uid, a) {
    const f = this.fx(a.fid);
    if (!f || f.t !== 'checkout') return;
    const r = this.reg(f.id);
    for (const fid in this.dyn.regs) if (this.dyn.regs[fid].op === uid) this.dyn.regs[fid].op = null;
    if (r.op && !String(r.op).startsWith('s:') && r.op !== uid) return this.err(uid, '他のプレイヤーが担当中です');
    if (r.op && String(r.op).startsWith('s:')) { const rt = this.dyn.staffRt[r.op.slice(2)]; if (rt) { rt.st = 'idle'; rt.t = 2; } }
    r.op = uid; this.dynRev++;
  }
  a_regLeave(uid) {
    for (const fid in this.dyn.regs) if (this.dyn.regs[fid].op === uid) this.dyn.regs[fid].op = null;
    this.dynRev++;
  }
  a_scan(uid, a) {
    const r = this.dyn.regs[a.fid];
    if (!r || r.op !== uid || r.ph !== 'scan') return;
    this.scanItem(a.fid, r, a.i | 0);
  }
  scanItem(fid, r, i) {
    const it = r.belt[i];
    if (!it || it.s) return;
    it.s = 1;
    const f = this.fx(fid);
    this.sfx('scan', f?.x, f?.z);
    if (r.belt.every((b) => b.s)) {
      const total = r.belt.reduce((s, b) => s + b.price, 0);
      const m = Math.random() < 0.55 ? 'card' : 'cash';
      r.ph = 'pay'; r.pay = { m, total, given: m === 'cash' ? cashGiven(total) : total };
    }
    this.dynRev++;
  }
  a_pay(uid, a) {
    const r = this.dyn.regs[a.fid];
    if (!r || r.op !== uid || r.ph !== 'pay') return;
    if (r.pay.m === 'cash' && (a.change | 0) !== r.pay.given - r.pay.total) return this.err(uid, `おつりが違います（${(a.change | 0).toLocaleString()}円）`);
    this.completeSale(a.fid, r, uid);
  }
  playerLeft(uid) {
    const p = this.players[uid];
    const b = this.heldBox(uid);
    if (b) b.loc = { t: 'f', x: p?.x ?? 0, y: 0, z: p?.z ?? 0, ry: 0 };
    const c = this.heldCrate(uid);
    if (c) c.loc = { t: 'f', x: p?.x ?? 0, y: 0, z: p?.z ?? 0, ry: 0 };
    for (const fid in this.dyn.regs) if (this.dyn.regs[fid].op === uid) this.dyn.regs[fid].op = null;
    delete this.players[uid];
    this.bump();
  }

  // ---------- カード：開封・陳列・値段・買取 ----------
  // 持っている段ボールから開封：パックはその場で1パック。BOXは段ボールを足元に置いて、BOXを開ける（10パックが手に出てくる）
  a_openPack(uid, a = {}) {
    const b = this.heldBox(uid);
    if (!b || b.n <= 0) return;
    // 段ボールから直接は開封できない（手に持ってから）
    if (!a.direct) return this.err(uid, '段ボールを床に置いて開け、パックやBOXを「手に持つ」てから開封しよう');
    const sid = seriesOfProduct(b.p); if (!sid) return;
    if (!b.o) return this.err(uid, '段ボールを開けてから開封しよう');
    if (isPack(b.p)) {
      b.n--;
      this.gainCards(uid, [openPack(sid)], 'pack', sid);
      this.sfx('tear'); this.bump();
      return;
    }
    if (this.hand(uid)) return this.err(uid, '手がふさがっています');
    b.n--;
    const p = this.players[uid], x = clamp(+(a.x ?? p?.x ?? 0), PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX), z = clamp(+(a.z ?? p?.z ?? 0), PLAYER_BOUNDS.minZ, PLAYER_BOUNDS.maxZ);
    b.loc = { t: 'f', x, y: this.stackHeight(x, z, b), z, ry: +a.ry || 0 };
    this.setHand(uid, { t: 'box', p: b.p });
    this.a_handBoxOpen(uid);
  }
  // 棚の枠や、開いている段ボールから手に持つ（パック最大5・BOX1つ・消臭スプレー1本）
  a_handTake(uid, a) {
    if (this.heldBox(uid) || this.heldCrate(uid)) return this.err(uid, '段ボールを持っていると手に取れません');
    let src;
    if (a.bid != null) {
      const b = this.box(a.bid);
      if (!b || b.loc.t === 'h' || b.n <= 0) return;
      if (!b.o) return this.err(uid, '段ボールを開けてから取り出そう');
      src = { pid: b.p, n: () => b.n, take: () => { b.n--; } };
    } else {
      const f = this.fx(a.fid), sl = f?.s?.[a.si | 0];
      if (!sl || !sl[0] || sl[1] <= 0) return;
      src = { pid: sl[0], n: () => sl[1], take: () => { sl[1]--; } };
    }
    const hd = this.hand(uid), pid = src.pid;
    if (isPack(pid)) {
      if (hd && hd.t !== 'packs') return this.err(uid, '手がふさがっています');
      const cur = hd ? hd.a : [];
      if (cur.length >= HAND_MAX) return this.err(uid, `パックは${HAND_MAX}パックまで持てます`);
      const want = a.all ? HAND_MAX - cur.length : 1;
      for (let i = 0; i < want && src.n() > 0; i++) { src.take(); cur.push(pid); }
      this.setHand(uid, { t: 'packs', a: cur });
    } else if (isBoosterBox(pid)) {
      if (hd) return this.err(uid, hd.t === 'box' ? 'BOXは1つしか持てません' : '手がふさがっています');
      src.take(); this.setHand(uid, { t: 'box', p: pid });
    } else if (isSpray(pid)) {
      if (hd) return this.err(uid, '手がふさがっています');
      src.take(); this.setHand(uid, { t: 'spray', p: pid, u: 1 });
    } else return this.err(uid, '手に持てるのはパック・BOX・消臭スプレーです');
    this.sfx('pick'); this.bump();
  }
  // 手に持っている物を棚の枠に置く（パックは同じ種類を1つずつ／all で全部）
  a_handPut(uid, a) {
    const hd = this.hand(uid), f = this.fx(a.fid);
    if (!hd || !f?.s) return;
    const si = a.si | 0, slot = FIXTURES[f.t].slots[si], sl = f.s[si];
    if (!slot || !sl) return;
    const pid = a.pid && hd.t === 'packs' && hd.a.includes(a.pid) ? a.pid : handPid(hd);
    if (hd.t === 'spray' && hd.u < 0.999) return this.err(uid, '使いかけのスプレーは棚に戻せません');
    if (!canPlace(pid, slot)) return this.err(uid, `${PRODUCTS[pid].name}はこの棚に置けません`);
    if (sl[0] && sl[0] !== pid && sl[1] > 0) return this.err(uid, '別の商品が並んでいます');
    const cap = slotCapacity(pid, slot);
    if (sl[0] === pid && sl[1] >= cap) return this.err(uid, '棚がいっぱいです');
    sl[0] = pid;
    if (hd.t === 'packs') {
      let n = 0; const want = a.all ? 99 : 1;
      for (let i = hd.a.length - 1; i >= 0 && n < want && sl[1] < cap; i--) if (hd.a[i] === pid) { hd.a.splice(i, 1); sl[1]++; n++; }
      if (!hd.a.length) this.setHand(uid, null);
    } else { sl[1]++; this.setHand(uid, null); }
    this.sfx('stock', f.x, f.z); this.bump();
  }
  // 手に持っている物を、開いている段ボールに戻す
  a_handBox(uid, a) {
    const hd = this.hand(uid), b = this.box(a.bid);
    if (!hd || !b || b.loc.t === 'h') return;
    if (!b.o) return this.err(uid, '段ボールを開けてから入れよう');
    const pid = handPid(hd);
    if (hd.t === 'spray' && hd.u < 0.999) return this.err(uid, '使いかけのスプレーは戻せません');
    if (b.n > 0 && b.p !== pid) return this.err(uid, 'この段ボールには別の商品が入っています');
    const cap = PRODUCTS[pid].qty;
    if (b.n >= cap) return this.err(uid, '段ボールがいっぱいです');
    b.p = pid;
    if (hd.t === 'packs') { for (let i = hd.a.length - 1; i >= 0 && b.n < cap; i--) if (hd.a[i] === pid) { hd.a.splice(i, 1); b.n++; } if (!hd.a.length) this.setHand(uid, null); }
    else { b.n++; this.setHand(uid, null); }
    this.sfx('stock'); this.bump();
  }
  // 手に持っているパックを開封（1パック／all で全部）
  a_handOpen(uid, a = {}) {
    const hd = this.hand(uid);
    if (!hd || hd.t !== 'packs') return;
    const take = a.all ? hd.a.splice(0) : [hd.a.pop()];
    if (!hd.a.length) this.setHand(uid, null);
    const packs = take.map((pid) => openPack(seriesOfProduct(pid)));
    this.gainCards(uid, packs, take.length > 1 ? 'box' : 'pack', seriesOfProduct(take[0]), { hand: 1 });
    this.sfx('tear'); this.bump();
  }
  // 手に持っているBOXを開ける → 10パックが手に出てくる（そのまま開封・途中でやめる・棚に並べる）
  a_handBoxOpen(uid) {
    const hd = this.hand(uid);
    if (!hd || hd.t !== 'box') return;
    const sid = seriesOfProduct(hd.p);
    this.setHand(uid, { t: 'packs', a: Array(BOX_PACKS).fill('pk' + sid) });
    this.store.stats.boxes++;
    this.ev({ t: 'boxopened', to: uid, s: sid, n: BOX_PACKS });
    this.sfx('boxopen'); this.bump();
  }
  // 消臭スプレー：押しているあいだ前に向かってシューッ（当たっている臭いお客さんの臭いがだんだん減る）
  a_spray(uid, a) {
    const hd = this.hand(uid);
    if (!hd || hd.t !== 'spray') return;
    const x = +a.x, z = +a.z, dir = +a.a;
    if (!isFinite(x) || !isFinite(z) || !isFinite(dir)) return;
    const dur = clamp(+a.dur || 0.15, 0.03, 0.36);
    hd.u = Math.max(0, +(hd.u - SPRAY_RATE * dur).toFixed(4));
    // 前方2.3m・左右35°くらいの範囲にいる臭いお客さん
    for (const c of this.dyn.customers) {
      if (!(c.sm > 0) || c.st === 'out') continue;
      const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz);
      if (d > 2.3 || d < 0.01) continue;
      let da = Math.atan2(dx, dz) - dir; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < 0.62 || d < 0.6) { this.deodorize(c, SPRAY_POWER * dur); if (c.sm > 0 && c.bub !== 'stink') this.bubble(c, 'stink'); }
    }
    this.ev({ t: 'spray', x, z, tx: x + Math.sin(dir) * 1.6, tz: z + Math.cos(dir) * 1.6, y: 1.25, who: uid, n: 7 });
    if (hd.u <= 0.001) { this.setHand(uid, null); this.toast(uid, '🧴 消臭スプレーが空になってなくなりました', 'info'); }
    this.bump();
  }
  deodorize(c, pot) {
    if (!(c.sm > 0)) return;
    c.sm = Math.max(0, c.sm - pot);
    if (c.sm <= 0.001) { c.sm = 0; c.cleaned = 1; this.store.stats.sprayed = (this.store.stats.sprayed || 0) + 1; this.store.today.cleaned = (this.store.today.cleaned || 0) + 1; this.bubble(c, 'fresh'); }
    this.dynRev++;
  }
  // 手に持っている消臭スプレーを捨てる（ゴミ箱で）
  a_handTrash(uid) {
    const hd = this.hand(uid);
    if (!hd || hd.t !== 'spray') return;
    this.setHand(uid, null); this.sfx('trash'); this.bump();
  }
  // オートセント（自動消臭機）に消臭スプレーをセットする（手に持ったスプレー、または開いた段ボールから1本）
  a_scentLoad(uid, a) {
    const f = this.fx(a.fid), def = f && FIXTURES[f.t];
    if (!def?.scent) return;
    f.sp ||= [];
    if (f.sp.length >= def.scent.cans) return this.err(uid, `スプレーは${def.scent.cans}本までセットできます`);
    const hd = this.hand(uid), b = this.heldBox(uid);
    if (hd?.t === 'spray') { f.sp.push(+hd.u.toFixed(3)); this.setHand(uid, null); }
    else if (b && isSpray(b.p) && b.n > 0) { if (!b.o) return this.err(uid, '段ボールを開けてからセットしよう'); b.n--; f.sp.push(1); }
    else return this.err(uid, '消臭スプレーを持ってきてセットしよう');
    this.sfx('place', f.x, f.z); this.bump();
  }
  gainCards(uid, packs, kind, sid, extra = {}) {
    const st = this.store, nw = [];
    for (const p of packs) for (const cid of p) {
      const b = baseId(cid); // 図鑑はフラッシュかどうかに関係なく、カードの種類で登録
      if (!st.dex[b] && !nw.includes(b)) nw.push(b);
      st.cards[cid] = (st.cards[cid] || 0) + 1; st.dex[b] = 1;
    }
    st.stats.packs += packs.length; st.today.packs = (st.today.packs || 0) + packs.length;
    let best = null;
    for (const p of packs) for (const cid of p) if (!best || cardRank(cid) > cardRank(best)) best = cid;
    this.ev({ t: 'pack', to: uid, kind, s: sid, packs, nw, best, who: this.players[uid]?.name || '', ...extra });
  }
  a_cardPut(uid, a) {
    const st = this.store, f = this.fx(a.fid), def = f && FIXTURES[f.t];
    if (!def?.cards) return;
    const ci = a.ci | 0; if (ci < 0 || ci >= def.cards.length) return;
    f.cs ||= emptyCards(f.t);
    if (f.cs[ci]) return this.err(uid, 'もうカードが置いてあります');
    if (!CARDS[a.cid] || !(st.cards[a.cid] > 0)) return this.err(uid, 'そのカードを持っていません');
    st.cards[a.cid]--; if (!st.cards[a.cid]) delete st.cards[a.cid];
    f.cs[ci] = a.cid;
    this.sfx('place', f.x, f.z); this.bump();
  }
  a_cardTake(uid, a) {
    const st = this.store, f = this.fx(a.fid);
    if (!f?.cs) return;
    const ci = a.ci | 0, cid = f.cs[ci];
    if (!cid) return;
    f.cs[ci] = null; st.cards[cid] = (st.cards[cid] || 0) + 1;
    this.sfx('pick', f.x, f.z); this.bump();
  }
  // ダブっているカード（1枚は手元に残す）を、高いものから空いている枠に並べる
  a_cardAuto(uid, a) {
    const st = this.store, f = this.fx(a.fid);
    if (!f?.cs) return;
    const minR = a.minR || 'N';
    const pool = [];
    for (const [cid, n] of Object.entries(st.cards)) { const c = CARDS[cid]; if (!c || rarityOrder(c.r) < rarityOrder(minR)) continue; for (let i = a.all ? 0 : 1; i < n; i++) pool.push(cid); }
    pool.sort((x, y) => cardValue(st, y) - cardValue(st, x));
    let put = 0;
    for (let i = 0; i < f.cs.length && pool.length; i++) if (!f.cs[i]) { const cid = pool.shift(); f.cs[i] = cid; st.cards[cid]--; if (!st.cards[cid]) delete st.cards[cid]; put++; }
    if (put) { this.toast(uid, `🃏 ${put}枚並べました`, 'ok'); this.sfx('place', f.x, f.z); this.bump(); }
    else this.err(uid, a.all ? '並べられるカードがありません' : '並べられるダブりカードがありません');
  }
  a_cardClear(uid, a) {
    const st = this.store, f = this.fx(a.fid);
    if (!f?.cs) return;
    let n = 0;
    f.cs = f.cs.map((cid) => { if (cid) { st.cards[cid] = (st.cards[cid] || 0) + 1; n++; } return null; });
    if (n) { this.toast(uid, `🃏 ${n}枚回収しました`, 'ok'); this.bump(); }
  }
  a_cardPrice(uid, a) {
    if (!CARDS[a.cid]) return;
    if (a.v == null || a.v === 'market') delete this.store.cprices[a.cid];
    else this.store.cprices[a.cid] = clamp(Math.round(+a.v || 0), 1, 9999999);
    this.bump();
  }
  // カード買取業者に売る（相場の12%）
  a_cardSell(uid, a) {
    const st = this.store, cid = a.cid, n = Math.min(st.cards[cid] || 0, Math.max(1, a.n | 0));
    if (!CARDS[cid] || n <= 0) return;
    const v = buybackPrice(st, cid) * n;
    st.cards[cid] -= n; if (!st.cards[cid]) delete st.cards[cid];
    st.money += v; st.today.buyback = (st.today.buyback || 0) + v;
    this.toast(uid, `💱 ${CARDS[cid].name}（${CARDS[cid].r}）×${n} を買取に出しました +¥${v.toLocaleString()}`, 'money');
    this.sfx('cash'); this.bump();
  }
  // ダブりをまとめて買取（maxR 以下のレア度。1枚は残す）
  a_sellDupes(uid, a) {
    const st = this.store, maxO = rarityOrder(a.maxR || 'R');
    let v = 0, n = 0;
    for (const [cid, k] of Object.entries(st.cards)) {
      const c = CARDS[cid]; if (!c || c.flash || rarityOrder(c.r) > maxO || k <= 1) continue; // フラッシュはまとめ売りしない
      if (a.s && c.s !== a.s) continue;
      v += buybackPrice(st, cid) * (k - 1); n += k - 1; st.cards[cid] = 1;
    }
    if (!n) return this.err(uid, '買取に出せるダブりがありません');
    st.money += v; st.today.buyback = (st.today.buyback || 0) + v;
    this.toast(uid, `💱 ダブり ${n}枚を買取に出しました +¥${v.toLocaleString()}`, 'money');
    this.sfx('cash'); this.bump();
  }

  canPlaceFixture(t, x, z, r, ignoreId) {
    const def = FIXTURES[t], st = this.store;
    const fp = fixtureFootprint(t, x, z, r);
    const eps = 0.01;
    const zs = zones(st);
    for (let cx = fp.minX + CELL / 2; cx < fp.maxX; cx += CELL) for (let cz = fp.minZ + CELL / 2; cz < fp.maxZ; cz += CELL) {
      const zone = zs.find((zn) => cx > zn.minX && cx < zn.maxX && cz > zn.minZ && cz < zn.maxZ);
      if (!zone) return '買ってある区画の中にしか置けません';
      if (zone.kind === 'office') return 'パソコン室には置けません';
      if (def.place === 'sales' && zone.kind !== 'sales') return 'これは売り場にしか置けません';
    }
    const hit = (o) => fp.minX < o.maxX - eps && fp.maxX > o.minX + eps && fp.minZ < o.maxZ - eps && fp.maxZ > o.minZ + eps;
    const walls = getWalls(st);
    if (walls.some((w) => w.type === 'pillar' && hit(w))) return '柱と重なっています';
    if (walls.some(hit)) return '壁と重なっています';
    if (!def.air && keepClear(st).some(hit)) return '入口・通路・荷受け場には置けません';
    for (const f of st.fixtures) {
      if (f.id === ignoreId) continue;
      if (!!FIXTURES[f.t]?.air !== !!def.air) continue;
      if (hit(fixtureFootprint(f.t, f.x, f.z, f.r))) return def.air ? 'ほかの吊り看板と重なっています' : '他の設備と重なっています';
    }
    if (t === 'checkout' && ignoreId == null && st.fixtures.filter((f) => f.t === 'checkout').length >= checkoutLimit(st.level || 1)) return 'レジはこれ以上置けません（レベルが上がると増やせます）';
    return true;
  }

  // ---------- 毎フレーム更新 ----------
  tick(dt) {
    dt = Math.min(dt, 0.1);
    const st = this.store, dyn = this.dyn;
    if (st.phase === 'open' || st.phase === 'closing') {
      st.time += dt * GAME_MIN_PER_SEC;
      if (st.phase === 'open' && st.time >= closeTime()) {
        st.phase = 'closing'; this.toast(null, '閉店時間です！最後のお客さんの会計をしよう', 'warn'); this.bump();
      }
      if (st.phase === 'open') this.updateSpawn(dt);
      if (st.phase === 'closing' && dyn.customers.length === 0) this.finishDay();
    }
    if (dyn.dropT > 0 && (dyn.dropT -= dt) <= 0) { for (const b of st.boxes) delete b.drop; }
    for (const d of dyn.deliveries) d.t -= dt;
    const ready = dyn.deliveries.filter((d) => d.t <= 0);
    if (ready.length) {
      dyn.deliveries = dyn.deliveries.filter((d) => d.t > 0);
      for (const d of ready) this.deliver(d.items);
    }
    for (const c of dyn.customers) this.updateCustomer(c, dt);
    this.updateSmell(dt);
    this.updateScents(dt);
    dyn.customers = dyn.customers.filter((c) => !c.gone);
    for (const s of st.staff) this.updateStaff(s, dt);
    for (const fid in dyn.regs) this.updateReg(+fid, dyn.regs[fid], dt);
  }
  deliver(items) {
    let k = this.store.boxes.filter((b) => b.loc.t === 'f' && inArea(b.loc, DELIVERY_AREA)).length;
    for (const [p, n, half] of items) for (let i = 0; i < n; i++) {
      if (!PRODUCTS[p] && p !== EMPTY_BOX.id) continue;
      const loc = deliverySpot(this.store, k++);
      loc.y = this.stackHeight(loc.x, loc.z, null);
      this.store.boxes.push({ id: this.store.nid++, p, n: PRODUCTS[p] ? boxUnits(p, half) : 0, loc, o: false, drop: 1 });
    }
    this.toast(null, '📦 店の前に段ボールが届きました！倉庫に運ぶか、そのまま補充しよう', 'ok');
    this.dyn.dropT = 6;
    this.sfx('drop'); this.bump();
  }

  // ---------- 臭いお客さん ----------
  // 臭いお客さんの近く（2.6m）にいるお客さんはイライラして、長くいると帰ってしまう
  updateSmell(dt) {
    const dyn = this.dyn;
    if ((dyn.smT = (dyn.smT || 0) - dt) > 0) return;
    const step = 0.5; dyn.smT = step;
    const smelly = dyn.customers.filter((c) => c.sm > 0 && c.st !== 'out' && inStore(c));
    for (const o of dyn.customers) {
      if (o.sm > 0 || o.st === 'out' || o.gone) continue;
      const near = smelly.length && inStore(o) && smelly.some((c) => dist2(c.x, c.z, o.x, o.z) < 2.6 * 2.6);
      if (near) {
        o.stk = (o.stk || 0) + step; o.smelt = 1;
        if (o.stk >= 1.5 && (!o.bub || o.bub === 'wait' || o.bub === 'look')) this.bubble(o, 'stink');
        o.pat -= step * 1.5;
        if (o.stk >= 10 && o.st !== 'pay') { o.why = 'smell'; this.store.today.smellLost = (this.store.today.smellLost || 0) + 1; this.leave(o, true); }
      } else if (o.stk > 0) o.stk = Math.max(0, o.stk - step * 0.5);
    }
  }
  // オートセント：範囲に臭いお客さんが入ると、セットした消臭スプレーで自動でシュッ（間隔をあけて）
  updateScents(dt) {
    const dyn = this.dyn; dyn.scd ||= {};
    for (const f of this.store.fixtures) {
      const sc = FIXTURES[f.t]?.scent; if (!sc) continue;
      if ((dyn.scd[f.id] = (dyn.scd[f.id] || 0) - dt) > 0) continue;
      if (!f.sp?.length) continue;
      let tgt = null, bd = sc.range;
      for (const c of dyn.customers) { if (!(c.sm > 0) || c.st === 'out') continue; const d = dist(c.x, c.z, f.x, f.z); if (d < bd) { bd = d; tgt = c; } }
      if (!tgt) continue;
      this.deodorize(tgt, sc.pot);
      f.sp[0] = +(f.sp[0] - sc.use).toFixed(3); if (f.sp[0] <= 0.001) f.sp.shift();
      dyn.scd[f.id] = sc.cd;
      this.ev({ t: 'spray', x: f.x, z: f.z, tx: tgt.x, tz: tgt.z, y: 1.0, fid: f.id });
      this.bump();
    }
  }

  // ---------- お客さん ----------
  updateSpawn(dt) {
    const st = this.store, dyn = this.dyn;
    dyn.spawnT -= dt;
    if (dyn.spawnT > 0) return;
    const t = st.time;
    const curve = 0.65 + 0.55 * Math.exp(-(((t - 720) / 100) ** 2)) + 0.7 * Math.exp(-(((t - 1080) / 110) ** 2));
    const f = customerFactors(st);
    dyn.spawnT = (15 / (curve * f.rep * f.lv * f.size * f.attract)) * rand(0.6, 1.4);
    const nReg = st.fixtures.filter((x) => FIXTURES[x.t].cat === 'checkout').length;
    const maxC = Math.min(this.custCap || 36, 4 + Math.floor(st.level * 0.7) + nReg * 2 + Math.floor(Object.keys(st.bays || {}).length / 4));
    if (dyn.customers.length >= maxC) return;
    this.spawnCustomer();
  }
  spawnCustomer() {
    const st = this.store;
    const [sx, sz] = pick(SPAWN_POINTS);
    const stocked = new Map();
    for (const f of st.fixtures) if (f.s) f.s.forEach((s) => { if (s[0]) stocked.set(s[0], (stocked.get(s[0]) || 0) + 1); });
    const unlocked = PRODUCTS_LIST.filter((p) => canOrder(st, p.id)).map((p) => p.id);
    const hasCards = st.fixtures.some((f) => f.cs && f.cs.some(Boolean));
    const topPack = Math.max(150, ...PRODUCTS_LIST.filter((p) => p.cat === 'pack' && canOrder(st, p.id)).map((p) => p.price));
    const hasPlay = st.fixtures.some((f) => FIXTURES[f.t].seats);
    const r = Math.random();
    const kind = hasCards && r < 0.3 ? 'collector' : hasPlay && r < 0.5 ? 'gamer' : 'shopper';
    // 欲しい商品（パックが一番人気）
    const W = { pack: 3, box: 0.9, supply: 1.1, goods: 1.0, other: 0.6 };
    const want = () => {
      const pool = stocked.size && Math.random() < 0.85 ? [...stocked.keys()] : unlocked;
      let tot = 0; for (const p of pool) tot += W[PRODUCTS[p].cat] || 1;
      let x = Math.random() * tot; for (const p of pool) { x -= W[PRODUCTS[p].cat] || 1; if (x <= 0) return p; }
      return pool[0];
    };
    const n = kind === 'shopper' ? randi(1, Math.min(5, 2 + Math.floor(st.level / 8))) : Math.random() < 0.45 ? 1 : 0;
    const list = [];
    for (let i = 0; i < n; i++) {
      const p = want(); if (!p || list.find((l) => l.p === p)) continue;
      const cat = PRODUCTS[p].cat;
      list.push({ p, q: cat === 'box' ? 1 : cat === 'pack' ? (Math.random() < 0.5 ? 1 : randi(2, 5)) : (Math.random() < 0.8 ? 1 : 2) });
    }
    const c = {
      id: this.dyn.cid++, av: randi(1, 2 ** 30), x: sx, z: sz, ry: 0, st: 'enter', path: null, pi: 0, kind,
      list, li: 0, basket: [], t: 0, pat: rand(80, 130), bub: null, bt: 0, reg: null, an: 'walk', spd: rand(1.25, 1.6), mood: 0,
      miss: [], pricey: [], cheap: [], qT: 0,
      cw: kind === 'collector' ? randi(1, 2 + Math.floor(st.level / 15)) : 0,
      // 予算：ふつうは数百〜数千円。ときどき高いレアカードを探しに来るコレクター（予算8倍）も来る
      // 予算：お店で扱っているいちばん高いパックに合わせて大きくなる（高い弾のレアカードも売れるように）。ときどきお金持ちのコレクター（予算10倍）も来る
      budget: kind === 'collector' ? Math.round(Math.exp(rand(Math.log(2 * topPack), Math.log(40 * topPack + st.level * 2000))) * (Math.random() < 0.15 ? 10 : 1)) : 0,
      wantPlay: kind === 'gamer',
      // 臭いお客さん（臭い10。消臭スプレー2回、オートセント G500 以上なら1回で消える）
      sm: Math.random() < smellRate(st.level) ? 10 : 0,
    };
    if (c.sm) st.today.smelly = (st.today.smelly || 0) + 1;
    this.dyn.customers.push(c);
    for (const f of st.fixtures) if (f.t === 'vending' && Math.random() < 0.18) { st.money += 160; st.today.vend += 160; }
    this.nextShop(c);
  }
  goto(e, x, z) {
    e.path = this.nav.findPath(e.x, e.z, x, z); e.pi = 0;
    return !!e.path;
  }
  bubble(c, k) { c.bub = k; c.bt = BUBBLE_T; }
  review(c, angry) {
    if (c.rv) return; c.rv = 1;
    const st = this.store;
    const why = [];
    let s = 4.1;
    if (angry) { s = 1; why.push(c.why || 'angry'); }
    else {
      for (const p of c.miss) { s -= 0.85; why.push(['miss', p]); }
      for (const p of c.pricey) { s -= 0.7; why.push(['pricey', p]); }
      if (!c.basket.length) s -= 0.5;
      if (c.paid) {
        if (c.qT > 75) { s -= 1.1; why.push('waitL'); } else if (c.qT > 40) { s -= 0.5; why.push('wait'); } else if (c.qT < 14) { s += 0.3; why.push('fast'); }
      }
      if (c.cheap.length) { s += 0.4; why.push(['cheap', c.cheap[0]]); }
      if (c.gotCard) { s += 0.4; why.push(['card', c.gotCard]); }
      if (c.played) { s += 0.3; why.push('play'); }
      if (c.smelt && !c.sm) { s -= 0.8; why.push('smell'); }
      if (c.cleaned) { s += 0.3; why.push('fresh'); }
      const kinds = new Set(); for (const f of st.fixtures) if (f.s) for (const x of f.s) if (x[0] && x[1] > 0) kinds.add(x[0]);
      if (kinds.size >= 12) { s += 0.3; why.push('variety'); } else if (kinds.size <= 2) { s -= 0.3; why.push('few'); }
      const mess = st.boxes.filter((b) => b.loc.t === 'f' && b.n === 0 && st.bays[bayAt(b.loc.x, b.loc.z)]).length;
      if (mess >= 3) { s -= 0.4; why.push('mess'); }
      s += Math.min(0.3, st.fixtures.filter((f) => FIXTURES[f.t]?.cat === 'deco').length * 0.04);
    }
    s = clamp(s, 1, 5);
    const stars = Math.round(s);
    st.rep = clamp(st.rep + ((s - 1) * 25 - st.rep) * 0.04, 0, 100);
    const rv = (st.today.rv ||= [0, 0, 0, 0, 0]); rv[stars - 1]++;
    if (Math.random() < (stars <= 2 ? 0.75 : stars >= 5 ? 0.5 : 0.3)) {
      const m = reviewText(stars, why);
      const r = { d: st.day, t: Math.round(st.time), s: stars, m, av: c.av };
      st.reviews = [r, ...(st.reviews || [])].slice(0, 40);
      this.ev({ t: 'review', r });
    }
  }
  nextShop(c) {
    const st = this.store;
    while (c.li < c.list.length) {
      const want = c.list[c.li];
      let best = null, bd = 1e9, anyAssigned = null;
      for (const f of st.fixtures) {
        if (!f.s) continue;
        f.s.forEach((s, si) => {
          if (s[0] !== want.p) return;
          const [ax, az] = slotAccess(f, si);
          if (!anyAssigned) anyAssigned = { f, si, ax, az };
          if (s[1] <= 0) return;
          const d = dist2(c.x, c.z, ax, az);
          if (d < bd) { bd = d; best = { f, si, ax, az }; }
        });
      }
      const tgt = best || anyAssigned;
      if (!tgt) { c.li++; c.mood -= 1; this.bubble(c, 'none'); if (c.miss.length < 3) c.miss.push(want.p); continue; }
      c.tgt = { fid: tgt.f.id, si: tgt.si };
      c.st = 'go'; c.an = 'walk';
      if (!this.goto(c, tgt.ax, tgt.az)) { c.li++; continue; }
      return;
    }
    this.afterShop(c);
  }
  // 商品を選び終わったら：シングルカードを見る → プレイテーブルで遊ぶ → レジ
  afterShop(c) {
    if (c.cw > 0 && this.goCards(c)) return;
    if (c.wantPlay && !c.played && !c.noPlay && this.goPlay(c)) return;
    this.toCheckout(c);
  }
  goCards(c) {
    const st = this.store;
    const list = st.fixtures.filter((f) => f.cs && f.cs.some(Boolean) && !(c.seenF || []).includes(f.id));
    if (!list.length) { c.cw = 0; return false; }
    list.sort((a, b) => dist2(c.x, c.z, a.x, a.z) - dist2(c.x, c.z, b.x, b.z));
    const f = Math.random() < 0.7 ? list[0] : pick(list);
    const filled = f.cs.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
    const ci = pick(filled);
    const [ax, az] = cardAccess(f, ci);
    if (!this.goto(c, ax, az)) { (c.seenF ||= []).push(f.id); return this.goCards(c); }
    c.cf = f.id; c.st = 'gocard'; c.an = 'walk';
    return true;
  }
  // 並んでいるカードから1枚えらぶ（レアほど見てしまう）。高すぎたら買わない
  chooseCard(c, f) {
    const st = this.store;
    let cand = f.cs.map((cid, i) => [cid, i]).filter(([cid]) => cid);
    if (!cand.length) return null;
    // 予算で買えるカードを中心に見る（ときどき高いカードにも目がいく）
    const ok = cand.filter(([cid]) => cardPrice(st, cid) <= c.budget);
    if (ok.length && Math.random() < 0.75) cand = ok;
    let tot = 0; const w = cand.map(([cid]) => { const v = Math.pow(cardValue(st, cid) + 20, 0.35); tot += v; return v; });
    let x = Math.random() * tot;
    for (let k = 0; k < cand.length; k++) { x -= w[k]; if (x <= 0) return cand[k]; }
    return cand[cand.length - 1];
  }
  goPlay(c) {
    const st = this.store, dyn = this.dyn;
    if (st.playFee > PLAY_FEE_MAX) { this.bubble(c, 'pricey'); c.mood -= 1; c.why2 = 'playfee'; if (c.pricey.length < 3) c.pricey.push('_play'); c.noPlay = true; return false; }
    const tables = st.fixtures.filter((f) => FIXTURES[f.t].seats);
    let best = null, bs = -1e9;
    for (const f of tables) {
      const seats = (dyn.seats[f.id] ||= FIXTURES[f.t].seats.map(() => 0));
      const used = seats.filter(Boolean).length;
      if (used >= seats.length) continue;
      const sc = (used ? 20 : 0) - dist(c.x, c.z, f.x, f.z); // 相手が座っているテーブルを優先
      if (sc > bs) { bs = sc; best = f; }
    }
    if (!best) { c.noPlay = true; return false; }
    const seats = dyn.seats[best.id], si = seats.findIndex((x) => !x);
    const [x, z] = seatSpot(best, si);
    if (!this.goto(c, x, z)) { c.noPlay = true; return false; }
    seats[si] = c.id; c.seat = [best.id, si];
    c.st = 'goplay'; c.an = 'walk';
    return true;
  }
  freeSeat(c) {
    if (!c.seat) return;
    const s = this.dyn.seats[c.seat[0]]; if (s && s[c.seat[1]] === c.id) s[c.seat[1]] = 0;
    c.seat = null;
  }
  // テーブルを動かした・売ったときは座っている人を立たせる
  kickSeats(fid) {
    const s = this.dyn.seats[fid]; if (!s) return;
    for (const cid of s) { const c = this.dyn.customers.find((o) => o.id === cid); if (c) { c.seat = null; c.played = true; this.toCheckout(c); } }
    delete this.dyn.seats[fid];
  }
  toCheckout(c) {
    const st = this.store;
    this.freeSeat(c);
    if (!c.basket.length) return this.leave(c);
    const regs = st.fixtures.filter((f) => FIXTURES[f.t].cat === 'checkout');
    if (!regs.length) { c.why = 'noreg'; return this.leave(c, true); }
    let best = null, bs = 1e9;
    for (const f of regs) {
      const r = this.reg(f.id);
      const score = r.q.length * 10 + (r.op ? 0 : 4) + dist(c.x, c.z, f.x, f.z) * 0.3;
      if (score < bs) { bs = score; best = f; }
    }
    const r = this.reg(best.id);
    r.q.push(c.id); c.reg = best.id; c.st = 'q'; c.qi = -1;
    this.updateQueuePos(c);
  }
  updateQueuePos(c) {
    const r = this.dyn.regs[c.reg], f = this.fx(c.reg);
    if (!r || !f) { c.reg = null; return this.toCheckout(c); }
    const qi = r.q.indexOf(c.id);
    if (qi !== c.qi) {
      c.qi = qi;
      const [x, z] = checkoutSpot(f, qi);
      c.an = 'walk';
      if (!this.goto(c, x, z)) { c.path = [[x, z]]; c.pi = 0; }
    }
  }
  // 買わずに帰ったお客さんが持っていたシングルカードは、なくさずに手持ちへもどす
  returnCards(c) {
    if (c.paid || c.cret) return; c.cret = true;
    const st = this.store;
    for (const b of c.basket || []) if (b.p === '_card' && b.c && CARDS[b.c]) st.cards[b.c] = (st.cards[b.c] || 0) + 1;
  }
  leave(c, angry) {
    this.freeSeat(c);
    this.returnCards(c);
    if (c.reg) { const r = this.dyn.regs[c.reg]; if (r) { r.q = r.q.filter((id) => id !== c.id); if (r.cust === c.id) this.resetReg(c.reg); } c.reg = null; }
    if (angry) { this.bubble(c, 'angry'); this.store.today.lost++; }
    if (c.st !== 'out') this.review(c, angry);
    c.st = 'out'; c.an = 'walk';
    const [sx, sz] = pick(SPAWN_POINTS);
    if (!this.goto(c, sx, sz)) c.gone = true;
  }
  updateCustomer(c, dt) {
    if (c.bt > 0) { c.bt -= dt; if (c.bt <= 0) c.bub = null; }
    if (c.holdT > 0 && (c.holdT -= dt) <= 0) c.hold = null;
    const st = this.store;
    switch (c.st) {
      case 'go': {
        if (stepPath(c, dt, c.spd)) {
          const f = this.fx(c.tgt.fid);
          if (!f) { c.li++; return this.nextShop(c); }
          const sl = FIXTURES[f.t].slots[c.tgt.si];
          const [wx, wz] = localToWorld(f, sl.x, sl.z);
          c.ry = Math.atan2(wx - c.x, wz - c.z);
          c.st = 'take'; c.t = 0.7; c.an = 'reach'; c.took = 0;
        }
        break;
      }
      case 'take': {
        c.t -= dt;
        if (c.t > 0) break;
        const f = this.fx(c.tgt.fid), want = c.list[c.li];
        const s = f?.s?.[c.tgt.si];
        if (!s || s[0] !== want.p || s[1] <= 0) {
          if (!c.took) { this.bubble(c, 'empty'); c.mood -= 1; if (c.miss.length < 3) c.miss.push(want.p); }
          c.li++; return this.nextShop(c);
        }
        if (!c.took) {
          if (getPrice(st, want.p) > priceLimit(st, want.p)) { this.bubble(c, 'pricey'); c.mood -= 1; if (c.pricey.length < 3) c.pricey.push(want.p); c.li++; return this.nextShop(c); }
          if (getPrice(st, want.p) <= marketPrice(st, want.p) * 0.85) { this.bubble(c, 'cheap'); c.cheap.push(want.p); }
        }
        s[1]--; c.took++;
        c.hold = want.p; c.holdT = 0.45;
        c.basket.push({ p: want.p, price: getPrice(st, want.p) });
        this.bump();
        if (c.took >= want.q) { c.li++; c.an = 'walk'; return this.nextShop(c); }
        c.t = 0.55;
        break;
      }
      case 'gocard': {
        if (stepPath(c, dt, c.spd)) {
          const f = this.fx(c.cf);
          if (!f?.cs) { c.cw = 0; return this.afterShop(c); }
          c.ry = Math.atan2(f.x - c.x, f.z - c.z);
          c.st = 'browse'; c.t = rand(1.6, 3.2); c.an = 'idle'; this.bubble(c, 'look');
        }
        break;
      }
      case 'browse': {
        c.t -= dt;
        if (c.t > 0) { if (c.t < 0.5) c.an = 'reach'; break; }
        const f = this.fx(c.cf);
        const ch = f?.cs ? this.chooseCard(c, f) : null;
        (c.seenF ||= []).push(c.cf);
        if (ch) {
          const [cid, ci] = ch, price = cardPrice(st, cid);
          if (price > cardLimit(st, cid)) { this.bubble(c, 'pricey'); c.mood -= 1; if (c.pricey.length < 3) c.pricey.push('c:' + cid); }
          else if (price > c.budget) { this.bubble(c, 'none'); }
          else {
            f.cs[ci] = null;
            c.basket.push({ p: '_card', c: cid, price });
            c.hold = '_card'; c.holdT = 0.6; c.gotCard = cid;
            this.bubble(c, isHit(cid) ? 'wow' : 'happy');
            this.bump();
          }
        }
        c.cw--;
        if (c.cw > 0 && f?.cs?.some(Boolean)) { c.seenF = c.seenF.filter((x) => x !== c.cf); c.st = 'browse'; c.t = rand(1.2, 2.4); c.an = 'idle'; break; }
        c.cw = Math.max(0, c.cw);
        return this.afterShop(c);
      }
      case 'goplay': {
        if (stepPath(c, dt, c.spd)) {
          const f = this.fx(c.seat?.[0]);
          if (!f) { c.noPlay = true; return this.afterShop(c); }
          c.ry = Math.atan2(f.x - c.x, f.z - c.z);
          c.st = 'play'; c.t = rand(22, 40); c.an = 'idle'; c.pt = 0; this.bubble(c, 'game');
        }
        break;
      }
      case 'play': {
        c.t -= dt; c.pt -= dt;
        if (c.pt <= 0) { c.pt = rand(1.2, 3.5); c.an = c.an === 'reach' ? 'idle' : 'reach'; if (Math.random() < 0.12) this.bubble(c, pick(['game', 'happy', 'wow'])); }
        if (c.t > 0) break;
        this.freeSeat(c);
        c.played = true; st.stats.played++;
        if (st.playFee > 0) c.basket.push({ p: '_play', price: st.playFee });
        this.bubble(c, 'happy');
        return this.afterShop(c);
      }
      case 'q': {
        this.updateQueuePos(c);
        if (c.st !== 'q') break;
        const arrived = stepPath(c, dt, c.spd);
        c.an = arrived ? 'idle' : 'walk';
        c.qT += dt;
        c.pat -= dt * (c.qi > 0 ? 0.8 : 1);
        if (c.pat <= 0) { c.why = 'waitAngry'; return this.leave(c, true); }
        if (c.pat < 25 && !c.bub) this.bubble(c, 'wait');
        const r = this.dyn.regs[c.reg];
        if (arrived && c.qi === 0 && r && r.ph === 'idle') {
          const f = this.fx(c.reg);
          c.ry = Math.atan2(...localDir(f, -1, 0));
          r.belt = c.basket.map((b) => ({ p: b.p, price: b.price, s: 0, c: b.c }));
          r.ph = 'scan'; r.cust = c.id; r.t = 0;
          c.st = 'pay'; c.an = 'idle';
          this.dynRev++;
        }
        break;
      }
      case 'pay': {
        c.qT += dt;
        c.pat -= dt * 0.6;
        if (c.pat <= 0) { c.why = 'waitAngry'; return this.leave(c, true); }
        if (c.pat < 20 && !c.bub) this.bubble(c, 'wait');
        break;
      }
      case 'out': {
        if (stepPath(c, dt, c.spd)) c.gone = true;
        break;
      }
      default: break;
    }
  }
  completeSale(fid, r, who) {
    const st = this.store;
    const c = this.dyn.customers.find((o) => o.id === r.cust);
    const total = r.pay?.total ?? r.belt.reduce((s, b) => s + b.price, 0);
    st.money += total; st.today.sales += total; st.totalSales += total; st.today.served++; st.totalCustomers++;
    const items = (st.today.items ||= {});
    for (const b of r.belt) {
      const k = b.p === '_card' ? 'c:' + b.c : b.p;
      const e = (items[k] ||= [0, 0]); e[0]++; e[1] += b.price;
      if (b.p === '_card') { st.today.cardSales += b.price; st.stats.cardsSold++; }
      if (b.p === '_play') st.today.playSales += b.price;
    }
    this.gainXp(total);
    if (c) c.paid = true;
    const f = this.fx(fid);
    this.sfx('cash', f?.x, f?.z);
    this.ev({ t: 'sale', total, who });
    r.q = r.q.filter((id) => id !== r.cust);
    r.belt = []; r.ph = 'idle'; r.pay = null; r.cust = null;
    if (c) { c.reg = null; this.bubble(c, c.mood >= 0 ? 'happy' : 'ok'); this.leave(c); }
    this.dynRev++; this.bump();
  }
  gainXp(yen) {
    const st = this.store;
    const gx = Math.max(1, Math.round(yen / XP_YEN)); st.today.xp += gx;
    if (st.level < MAX_LEVEL) st.xp += gx;
    while (st.level < MAX_LEVEL && st.xp >= xpNeed(st.level)) {
      st.xp -= xpNeed(st.level); st.level++;
      if (st.level >= MAX_LEVEL) st.xp = 0;
      this.ev({ t: 'levelup', level: st.level, max: st.level >= MAX_LEVEL, unlocks: unlocksAt(st.level) }); this.sfx('levelup');
    }
  }
  resetReg(fid, all) {
    const r = this.dyn.regs[fid];
    if (!r) return;
    r.belt = []; r.ph = 'idle'; r.pay = null; r.cust = null;
    if (all) {
      for (const cid of r.q) { const c = this.dyn.customers.find((o) => o.id === cid); if (c) { c.reg = null; c.qi = -1; this.toCheckout(c); } }
      r.q = r.q.filter((cid) => this.dyn.customers.find((o) => o.id === cid && o.reg === fid));
    }
    this.dynRev++;
  }
  updateReg(fid, r, dt) {
    const f = this.fx(fid);
    if (!f) { delete this.dyn.regs[fid]; return; }
    if (r.ph === 'idle') return;
    if (!(r.op && String(r.op).startsWith('s:'))) return;
    const opRt = this.dyn.staffRt[String(r.op).slice(2)];
    r.t = (r.t || 0) + dt * (opRt?.k || 1);
    if (r.ph === 'scan' && r.t >= 0.75) {
      r.t = 0;
      const j = r.belt.findIndex((b) => !b.s);
      if (j >= 0) this.scanItem(fid, r, j);
    } else if (r.ph === 'pay' && r.t >= 1.6) {
      r.t = 0; this.completeSale(fid, r, r.op);
    }
  }

  // ---------- 従業員AI ----------
  updateStaff(s, dt) {
    const dyn = this.dyn;
    let rt = dyn.staffRt[s.id];
    if (!rt) {
      const [x, z] = [STAFF_HOME[0] + rand(-1, 1), STAFF_HOME[1] + rand(-0.6, 0.6)];
      rt = dyn.staffRt[s.id] = { x, z, ry: 0, st: 'idle', t: rand(0.5, 2), path: null, pi: 0, an: 'idle' };
    }
    const who = 's:' + s.id;
    // いまの仕事（両方おまかせの人は、並んでいるレジに人がいなければレジへ）
    const job = this.staffJob(s, rt, who);
    // はやさ：とても遅い〜とても早い（人ごとに、レジと品出しでちがう）
    const k = rt.k = staffK(s, job);
    const spd = 1.9 * k;
    if (rt.st !== 'idle' && rt.path && rt.pi < (rt.path?.length || 0)) rt.an = 'walk';
    if (job === 'cashier') return this.staffCashier(s, rt, dt, spd, who);
    if (job === 'pricer') return this.staffPricer(s, rt, dt, spd, who);
    return this.staffStocker(s, rt, dt, spd, who);
  }
  // 値段係：棚を回って、値段を「ギリギリ売れる値段」（相場の+20%）に直す。相場は毎日変わるので、朝いちばんに全部直す
  staffPricer(s, rt, dt, spd, who) {
    const st = this.store;
    if (rt.st === 'topr') {
      if (stepPath(rt, dt, spd)) {
        rt.st = 'pricing'; rt.t = 1.1; rt.an = 'reach';
        const f = this.fx(rt.fid); if (f) rt.ry = Math.atan2(f.x - rt.x, f.z - rt.z);
      }
      return;
    }
    if (rt.st === 'pricing') {
      rt.t -= dt * Math.max(0.5, rt.k || 1);
      if (rt.t > 0) return;
      const j = rt.pj;
      if (j?.pid && PRODUCTS[j.pid]) { const v = priceLimit(st, j.pid); if (getPrice(st, j.pid) !== v) { st.prices[j.pid] = v; this.sfx('stock', rt.x, rt.z); this.bump(); } }
      if (j?.cid && CARDS[j.cid]) { const v = cardLimit(st, j.cid); if (cardPrice(st, j.cid) !== v) { st.cprices[j.cid] = v; this.sfx('stock', rt.x, rt.z); this.bump(); } }
      rt.st = 'idle'; rt.t = 0.25; rt.pj = null; rt.an = 'idle';
      return;
    }
    if (!this.staffIdle(rt, dt)) return;
    const job = this.findPriceJob(rt, s);
    if (!job) { rt.msg = null; return; }
    if (this.goto(rt, job.ax, job.az)) { rt.st = 'topr'; rt.fid = job.f.id; rt.pj = job; rt.msg = null; }
  }
  // 値段がずれている商品・カードのうち、いちばん近い所（ほかの値段係が向かっている物はのぞく）
  findPriceJob(rt, me) {
    const st = this.store, taken = new Set();
    for (const o of st.staff) { if (o === me) continue; const j = this.dyn.staffRt[o.id]?.pj; if (j) taken.add(j.key); }
    let best = null, bd = 1e9;
    const consider = (key, f, ax, az, extra) => { if (taken.has(key)) return; const d = dist2(rt.x, rt.z, ax, az); if (d < bd) { bd = d; best = { key, f, ax, az, ...extra }; } };
    for (const f of st.fixtures) {
      if (f.s) f.s.forEach((sl, si) => { const pid = sl[0]; if (!pid || !PRODUCTS[pid] || getPrice(st, pid) === priceLimit(st, pid)) return; const [ax, az] = slotAccess(f, si); consider('p:' + pid, f, ax, az, { pid }); });
      if (f.cs) f.cs.forEach((cid, ci) => { if (!cid || !CARDS[cid] || cardPrice(st, cid) === cardLimit(st, cid)) return; const [ax, az] = cardAccess(f, ci); consider('c:' + cid, f, ax, az, { cid }); });
    }
    return best;
  }
  staffJob(s, rt, who) {
    if (s.role === 'cashier' || s.role === 'stocker' || s.role === 'pricer') return s.role;
    if (rt.job === 'cashier') return 'cashier';
    if (this.heldBox(who) || (rt.st && rt.st !== 'idle')) return 'stocker'; // 品出しの途中は最後までやる
    const st = this.store;
    const need = st.fixtures.some((f) => f.t === 'checkout' && !this.reg(f.id).op && this.reg(f.id).q.length > 0
      && !st.staff.some((o) => o !== s && this.dyn.staffRt[o.id]?.st === 'toreg' && this.dyn.staffRt[o.id]?.fid === f.id));
    if (need) {
      // 手が空いている「両方」の人のうち、いちばんレジが早い人が行く
      const free = st.staff.filter((o) => o.role === 'both' && !this.heldBox('s:' + o.id) && (!this.dyn.staffRt[o.id]?.st || this.dyn.staffRt[o.id]?.st === 'idle') && this.dyn.staffRt[o.id]?.job !== 'cashier');
      const best = free.sort((a, b) => (b.reg - a.reg) || (a.stk - b.stk))[0];
      if (best && best !== s) return 'stocker';
      rt.job = 'cashier'; rt.st = 'idle'; rt.t = 0; rt.msg = null; return 'cashier';
    }
    return 'stocker';
  }
  nearestTrash(x, z) {
    let best = null, bd = 1e9;
    for (const f of this.store.fixtures) if (TRASH_TYPES.includes(f.t)) { const d = dist2(x, z, f.x, f.z); if (d < bd) { bd = d; best = f; } }
    return best;
  }
  staffIdle(rt, dt) {
    rt.an = 'idle'; rt.t -= dt * Math.max(0.6, rt.k || 1);
    if (rt.t <= 0) { rt.t = rand(1.5, 4); rt.st = 'idle'; return true; }
    return false;
  }
  staffCashier(s, rt, dt, spd, who) {
    const both = s.role === 'both';
    const mine = Object.entries(this.dyn.regs).find(([, r]) => r.op === who);
    if (mine) {
      rt.an = 'idle'; const f = this.fx(+mine[0]); if (f) rt.ry = Math.atan2(...localDir(f, 1, 0));
      // 両方おまかせの人：お客さんがいなくなってしばらくしたら品出しにもどる
      const r = mine[1];
      if (both) {
        if (r.ph === 'idle' && !r.q.length) rt.regIdle = (rt.regIdle || 0) + dt; else rt.regIdle = 0;
        if (rt.regIdle > 6) { r.op = null; rt.job = null; rt.regIdle = 0; rt.st = 'idle'; rt.t = 0.3; this.dynRev++; }
      }
      return;
    }
    if (rt.st === 'toreg') {
      const r = this.dyn.regs[rt.fid], f = this.fx(rt.fid);
      if (!f || !r || (r.op && r.op !== who)) { rt.st = 'idle'; rt.t = 0.5; if (both) rt.job = null; return; }
      if (stepPath(rt, dt, spd)) { r.op = who; rt.st = 'idle'; rt.regIdle = 0; this.dynRev++; }
      return;
    }
    if (!this.staffIdle(rt, dt)) return;
    const free = this.store.fixtures.filter((f) => f.t === 'checkout' && !this.reg(f.id).op && !this.store.staff.some((o) => o !== s && this.dyn.staffRt[o.id]?.st === 'toreg' && this.dyn.staffRt[o.id]?.fid === f.id));
    if (!free.length) { rt.msg = this.store.fixtures.some((f) => f.t === 'checkout') ? null : 'noreg'; if (both) rt.job = null; return; }
    free.sort((a, b) => this.reg(b.id).q.length - this.reg(a.id).q.length);
    const f = free[0];
    const [x, z] = checkoutSpot(f, -1);
    if (this.goto(rt, x, z)) { rt.st = 'toreg'; rt.fid = f.id; rt.msg = null; }
  }
  // 品出し係：届いた段ボールをラベルの段へしまう／値札の棚が減ったら補充／空き箱はゴミ箱へ
  staffStocker(s, rt, dt, spd, who) {
    const st = this.store;
    const held = this.heldBox(who);
    switch (rt.st) {
      case 'tobox': {
        const b = this.box(rt.bid);
        if (!b || b.loc.t === 'h') { rt.st = 'idle'; rt.t = 0.3; return; }
        if (stepPath(rt, dt, spd)) {
          b.loc = { t: 'h', who }; b.o = true; delete b.drop; this.sfx('boxopen', rt.x, rt.z); this.bump();
          const f = this.fx(rt.fid);
          if (!f) { rt.st = 'return'; return; }
          const [ax, az] = slotAccess(f, rt.si);
          rt.st = this.goto(rt, ax, az) ? 'toslot' : 'return';
        }
        return;
      }
      case 'toslot': {
        if (!held) { rt.st = 'idle'; return; }
        if (stepPath(rt, dt, spd)) { rt.st = 'stocking'; rt.t = 0.3; const f = this.fx(rt.fid); if (f) rt.ry = Math.atan2(...localDir(f, 0, -FIXTURES[f.t].slots[rt.si].side)); }
        return;
      }
      case 'stocking': {
        rt.an = 'reach'; rt.t -= dt * (rt.k || 1);
        if (rt.t > 0) return;
        rt.t = 0.32;
        const f = this.fx(rt.fid);
        const r = f && held ? this.stockOne(held, f, rt.si) : 'bad';
        if (r !== 'ok') rt.st = 'return';
        return;
      }
      case 'return': {
        if (!held) { rt.st = 'idle'; rt.t = 0.5; return; }
        if (held.n <= 0) {
          const bin = this.nearestTrash(rt.x, rt.z);
          if (bin) { const [ax, az] = trashAccess(bin); if (this.goto(rt, ax, az)) { rt.st = 'totrash'; rt.fid = bin.id; return; } }
          held.loc = { t: 'f', x: rt.x, y: this.stackHeight(rt.x, rt.z, held), z: rt.z, ry: rt.ry }; this.bump(); rt.st = 'idle'; rt.t = 0.6; rt.msg = 'trash'; return;
        }
        // 商品の入った箱は閉じて、その商品のラベルが貼ってある倉庫棚の段へ（ラベルの段にしか置かない）
        held.o = false;
        const spot = this.freeRackSlot(rt.x, rt.z, held.p);
        if (spot) {
          const [ax, az] = rackAccess(spot.f, spot.si);
          if (this.goto(rt, ax, az)) { rt.st = 'torack'; rt.fid = spot.f.id; rt.si = spot.si; rt.msg = null; return; }
        }
        // ラベルの段がない・いっぱいのときは倉庫の床に積んでおく
        const fl = this.storageFloorSpot(rt.x, rt.z, held);
        if (fl && this.goto(rt, fl[0], fl[1])) { rt.st = 'tofloor'; rt.fx2 = fl[0]; rt.fz2 = fl[1]; rt.msg = 'nolabel'; return; }
        held.loc = { t: 'f', x: rt.x, y: this.stackHeight(rt.x, rt.z, held), z: rt.z, ry: rt.ry }; this.bump(); rt.st = 'idle'; rt.msg = 'nolabel';
        return;
      }
      case 'tofloor': {
        if (!held) { rt.st = 'idle'; return; }
        if (stepPath(rt, dt, spd)) { held.loc = { t: 'f', x: rt.fx2, y: this.stackHeight(rt.fx2, rt.fz2, held), z: rt.fz2, ry: 0 }; this.sfx('place', rt.x, rt.z); this.bump(); rt.st = 'idle'; rt.t = 0.5; }
        return;
      }
      case 'toempty': {
        const b = this.box(rt.bid);
        if (!b || b.loc.t !== 'r' || b.n > 0) { rt.st = 'idle'; rt.t = 0.3; return; }
        if (stepPath(rt, dt, spd)) { b.loc = { t: 'h', who }; b.o = false; this.sfx('pick', rt.x, rt.z); this.bump(); rt.st = 'return'; }
        return;
      }
      case 'tostore': {
        const b = this.box(rt.bid);
        if (!b || b.loc.t !== 'f' || b.n <= 0) { rt.st = 'idle'; rt.t = 0.3; return; }
        if (stepPath(rt, dt, spd)) { b.loc = { t: 'h', who }; b.o = false; delete b.drop; this.sfx('pick', rt.x, rt.z); this.bump(); rt.st = 'return'; }
        return;
      }
      case 'torack': {
        if (!held) { rt.st = 'idle'; return; }
        if (stepPath(rt, dt, spd)) {
          const f = this.fx(rt.fid);
          const occupied = st.boxes.some((o) => o.loc.t === 'r' && o.loc.fid === rt.fid && o.loc.si === rt.si);
          if (occupied || !f || f.lb?.[rt.si] !== held.p) { rt.st = 'return'; return; }
          held.loc = { t: 'r', fid: rt.fid, si: rt.si }; this.sfx('place', rt.x, rt.z); this.bump(); rt.st = 'idle'; rt.t = 0.5;
        }
        return;
      }
      case 'totrash': {
        if (!held) { rt.st = 'idle'; return; }
        if (stepPath(rt, dt, spd)) { st.boxes = st.boxes.filter((o) => o !== held); this.sfx('trash', rt.x, rt.z); this.bump(); rt.st = 'idle'; rt.t = 0.5; rt.msg = null; }
        return;
      }
      default: {
        if (held) { rt.st = 'return'; return; }
        if (!this.staffIdle(rt, dt)) return;
        // 1) 値札のついた棚が減っていたら補充
        const tagged = st.fixtures.some((f) => f.s && f.s.some((x) => x[0]));
        const job = tagged ? this.findStockJob(rt, s) : null;
        if (job) {
          rt.msg = null;
          const [bx, bz] = this.boxAccess(job.b);
          if (this.goto(rt, bx, bz)) { rt.st = 'tobox'; rt.bid = job.b.id; rt.fid = job.f.id; rt.si = job.si; }
          return;
        }
        // 2) 外に届いた箱・倉庫の床の箱を、ラベルの段へしまう
        const sj = this.findStoreJob(rt, s);
        if (sj) { const [bx, bz] = this.boxAccess(sj); if (this.goto(rt, bx, bz)) { rt.st = 'tostore'; rt.bid = sj.id; rt.msg = null; return; } }
        // 3) 倉庫棚の空き箱をゴミ箱へ（棚をあける）
        const ej = this.findRackEmpty(rt, s);
        if (ej) { const [bx, bz] = this.boxAccess(ej); if (this.goto(rt, bx, bz)) { rt.st = 'toempty'; rt.bid = ej.id; rt.msg = null; return; } }
        rt.msg = this._noLabel ? 'nolabel' : !tagged ? 'notag' : this._noStock ? 'nobox' : null;
      }
    }
  }
  findRackEmpty(rt, me) {
    const st = this.store;
    if (!this.nearestTrash(rt.x, rt.z)) return null;
    const claimed = new Set(st.staff.filter((o) => o !== me).map((o) => this.dyn.staffRt[o.id]?.bid).filter(Boolean));
    let best = null, bd = 1e9;
    for (const b of st.boxes) {
      if (b.loc.t !== 'r' || b.n > 0 || b.p === EMPTY_BOX.id || claimed.has(b.id)) continue;
      const [x, z] = this.boxAccess(b), d = dist2(rt.x, rt.z, x, z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  // しまう箱：店の外（荷物置き場など）と倉庫の床にある、ラベルの段に空きがある商品の箱（売り場の床の箱には触らない）
  findStoreJob(rt, me) {
    const st = this.store;
    const claimed = new Set(st.staff.filter((o) => o !== me).map((o) => this.dyn.staffRt[o.id]?.bid).filter(Boolean));
    const zs = zones(st);
    const canStore = new Map();
    let best = null, bd = 1e9, noLabel = false;
    for (const b of st.boxes) {
      if (b.loc.t !== 'f' || b.n <= 0 || claimed.has(b.id)) continue;
      const z = zs.find((o) => b.loc.x > o.minX && b.loc.x < o.maxX && b.loc.z > o.minZ && b.loc.z < o.maxZ);
      const outside = !z && !(b.loc.x > BUILDING.minX && b.loc.x < BUILDING.maxX && b.loc.z > BUILDING.minZ && b.loc.z < BUILDING.maxZ);
      if (!(outside || z?.kind === 'storage')) continue;
      if (!canStore.has(b.p)) canStore.set(b.p, !!this.freeRackSlot(rt.x, rt.z, b.p));
      if (!canStore.get(b.p)) { if (outside) noLabel = true; continue; }
      const d = dist2(rt.x, rt.z, b.loc.x, b.loc.z);
      if (d < bd) { bd = d; best = b; }
    }
    this._noLabel = noLabel && !best;
    return best;
  }
  storageFloorSpot(x, z, held) {
    const st = this.store, zs = zones(st).filter((o) => o.kind === 'storage');
    const fps = st.fixtures.map((f) => fixtureFootprint(f.t, f.x, f.z, f.r)), clear = keepClear(st);
    const inside = (r, px, pz, m) => px > r.minX - m && px < r.maxX + m && pz > r.minZ - m && pz < r.maxZ + m;
    let best = null, bd = 1e9;
    for (const zn of zs) for (let px = zn.minX + 0.7; px <= zn.maxX - 0.7; px += 0.8) for (let pz = zn.minZ + 0.7; pz <= zn.maxZ - 0.7; pz += 0.7) {
      if (fps.some((r) => inside(r, px, pz, 0.45)) || clear.some((r) => inside(r, px, pz, 0.3))) continue;
      const h = this.stackHeight(px, pz, held);
      if (h > 1.3) continue;
      const d = dist2(x, z, px, pz) - h * 6;
      if (d < bd) { bd = d; best = [px, pz]; }
    }
    return best;
  }
  findStockJob(rt, me) {
    const st = this.store;
    const claimed = new Set(st.staff.filter((o) => o !== me).map((o) => this.dyn.staffRt[o.id]).filter((r) => r && r.st !== 'idle').map((r) => r.fid + ':' + r.si));
    const claimedBox = new Set(st.staff.filter((o) => o !== me).map((o) => this.dyn.staffRt[o.id]?.bid));
    let best = null, bs = 1e9, wanted = false;
    for (const f of st.fixtures) {
      if (!f.s) continue;
      f.s.forEach((s, si) => {
        if (!s[0] || claimed.has(f.id + ':' + si)) return;
        const cap = slotCapacity(s[0], FIXTURES[f.t].slots[si]);
        if (s[1] >= cap) return;
        wanted = true;
        for (const b of st.boxes) {
          if (b.p !== s[0] || b.n <= 0 || b.loc.t === 'h' || claimedBox.has(b.id)) continue;
          const [bx, bz] = this.boxAccess(b);
          const score = s[1] / cap * 30 + dist(rt.x, rt.z, bx, bz) + dist(bx, bz, f.x, f.z) * 0.5;
          if (score < bs) { bs = score; best = { f, si, b }; }
        }
      });
    }
    this._noStock = wanted && !best;
    return best;
  }
  boxAccess(b) {
    if (b.loc.t === 'r') { const f = this.fx(b.loc.fid); if (f) return rackAccess(f, b.loc.si); }
    return [b.loc.x, b.loc.z];
  }
  // 倉庫棚の空いている段（pid を渡すと、その商品のラベルの段だけ）
  freeRackSlot(x, z, pid) {
    let best = null, bd = 1e9;
    for (const f of this.store.fixtures) {
      const def = FIXTURES[f.t];
      if (!def.boxSlots) continue;
      def.boxSlots.forEach((_, si) => {
        if (pid && f.lb?.[si] !== pid) return;
        if (this.store.boxes.some((o) => o.loc.t === 'r' && o.loc.fid === f.id && o.loc.si === si)) return;
        if (this.store.staff.some((o) => { const r = this.dyn.staffRt[o.id]; return r && r.st === 'torack' && r.fid === f.id && r.si === si; })) return;
        const d = dist2(x, z, f.x, f.z) + si * 0.01;
        if (d < bd) { bd = d; best = { f, si }; }
      });
    }
    return best;
  }
  finishDay() {
    const st = this.store;
    const wages = st.staff.reduce((s, o) => s + (o.wage || 0), 0);
    const bills = 500 + st.fixtures.length * 60;
    st.money -= wages + bills;
    const top = Object.entries(st.today.items || {}).sort((a, b) => b[1][1] - a[1][1]).slice(0, 6);
    const T = st.today;
    const data = { top, prevProfit: st.last?.profit ?? null, day: st.day, recycle: T.recycle || 0, sales: T.sales, served: T.served, lost: T.lost, orders: T.orders, ship: T.ship || 0, wages, bills, vend: T.vend, xp: T.xp, level: st.level, rep: Math.round(st.rep), repPrev: st.last?.rep ?? null, rv: T.rv || [0, 0, 0, 0, 0], money: st.money, cardSales: T.cardSales || 0, playSales: T.playSales || 0, buyback: T.buyback || 0, packs: T.packs || 0, lic: T.lic || 0, smelly: T.smelly || 0, cleaned: T.cleaned || 0, smellLost: T.smellLost || 0 };
    data.profit = data.sales + data.vend + data.recycle + data.buyback - data.orders - data.ship - wages - bills;
    st.phase = 'summary'; st.last = data;
    for (const fid in this.dyn.regs) this.resetReg(+fid, true);
    this.dyn.seats = {};
    this.ev({ t: 'summary', data });
    this.sfx('bell'); this.bump();
  }

  // ---------- ネット同期用スナップショット ----------
  dynSnapshot() {
    const d = this.dyn;
    const regs = {};
    for (const fid in d.regs) { const r = d.regs[fid]; regs[fid] = { op: r.op, ph: r.ph, b: r.belt.map((x) => [x.p, x.s, x.price, x.c || '']), pay: r.pay, q: r.q.length, cu: r.cust }; }
    const pt = {};
    for (const fid in d.seats) if (d.seats[fid].some(Boolean)) pt[fid] = d.seats[fid].map((cid) => { const c = cid && d.customers.find((o) => o.id === cid); return c && c.st === 'play' ? 1 : 0; });
    return {
      time: this.store.time,
      c: d.customers.map((c) => [c.id, c.av, +c.x.toFixed(2), +c.z.toFixed(2), +c.ry.toFixed(2), c.an, c.bub || '', c.basket.length, c.basket.slice(0, 8).map((b) => b.p).join(','), c.hold || '', c.sm > 0 ? Math.ceil(c.sm) : 0]),
      s: this.store.staff.map((s) => { const r = d.staffRt[s.id] || {}; return [s.id, +(r.x || 0).toFixed(2), +(r.z || 0).toFixed(2), +(r.ry || 0).toFixed(2), r.an || 'idle', r.st === 'pricing' ? 'tag' : r.st === 'idle' || !r.st ? r.msg || '' : '']; }),
      r: regs, pt,
      dl: d.deliveries.length,
    };
  }
}

export function stepPath(e, dt, spd) {
  if (!e.path || e.pi >= e.path.length) return true;
  let remain = spd * dt;
  while (remain > 0 && e.pi < e.path.length) {
    const [tx, tz] = e.path[e.pi];
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
    if (d > 1e-4) e.ry = Math.atan2(dx, dz);
    if (d <= remain) { e.x = tx; e.z = tz; e.pi++; remain -= d; }
    else { e.x += dx / d * remain; e.z += dz / d * remain; remain = 0; }
  }
  e.an = e.pi >= e.path.length ? 'idle' : 'walk';
  return e.pi >= e.path.length;
}
function localDir(f, lx, lz) { const a = f.r * Math.PI / 2, c = Math.cos(a), s = Math.sin(a); return [lx * c + lz * s, -lx * s + lz * c]; }
function trashAccess(f) { const d = FIXTURES[f.t]; return localToWorld(f, 0, d.d / 2 + 0.45); }
function inArea(l, A) { return l.x >= A.minX - 0.5 && l.x <= A.maxX + 0.5 && l.z >= A.minZ - 0.5 && l.z <= A.maxZ + 0.5; }

export function cashGiven(total) {
  const r = Math.random();
  const up = (u) => Math.ceil(total / u) * u;
  let g = r < 0.3 ? up(1000) : r < 0.5 ? up(500) : r < 0.65 ? up(100) : r < 0.85 ? up(5000) : up(10000);
  if (g < total) g = up(1000);
  return g;
}
const BOARD_TYPES = ['pc', 'fboard', 'xboard'];
const staffName = (v) => String(v ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 10);
const BOARD_ONLY = '💻 パソコン室（入口の右）のパソコンの前で操作してください';
// 来店の勢い：レベル・売り場の広さ・評判・お客さんを呼ぶ設備
export function customerFactors(st) {
  const bays = Math.max(1, Object.keys(st.bays || {}).length);
  let at = 0; for (const f of st.fixtures || []) at += FIXTURES[f.t]?.attract || 0;
  return {
    lv: 1 + 0.04 * ((st.level || 1) - 1),
    size: Math.pow(bays / START_BAYS.length, 0.55),
    rep: 0.5 + (st.rep ?? 50) / 100,
    attract: 1 + Math.min(0.5, at),
  };
}
export const repStars = (rep) => 1 + clamp(rep ?? 50, 0, 100) / 25;
const RV = {
  miss: (n) => pick([`${n}が売り切れてた…`, `${n}を買いに来たのになかった`, `${n}を入荷してほしい`]),
  pricey: (n) => pick([`${n}が高すぎる！`, `${n}はほかの店のほうが安い`, `${n}の値段にびっくり`]),
  cheap: (n) => pick([`${n}が安くて助かる！`, `${n}がお買い得だった`]),
  card: (n) => pick([`${n}のカードが買えてうれしい！`, `シングルの品ぞろえがいい！${n}ゲット`, `探してた${n}があった！`]),
  play: () => pick(['対戦が楽しかった！', 'プレイテーブルで友だちと遊べた', 'また対戦しに来ます！']),
  waitL: () => pick(['レジでずっと待たされた…', 'レジが全然進まない', 'レジの人を増やしてほしい']),
  wait: () => pick(['レジでけっこう待った', 'レジがもう少し早いといいな']),
  fast: () => pick(['レジが早くて気持ちいい', 'サクッと買えた！']),
  variety: () => pick(['パックの品揃えがいい！', 'いろんな弾がそろってて楽しい']),
  few: () => pick(['棚がスカスカ…', '商品が少なすぎる']),
  mess: () => pick(['通路に段ボールが置きっぱなし', 'お店が散らかってた']),
  waitAngry: () => pick(['待たされすぎ！もう来ない', 'レジが遅すぎて帰った']),
  noreg: () => 'レジがなくて買えなかった',
  smell: () => pick(['臭いお客さんがいて落ち着かなかった', 'お店がなんだか臭い…', '臭いがきつくて帰った', '消臭してほしい…']),
  fresh: () => pick(['消臭スプレーをかけてもらってスッキリ！', 'いい香りのお店！', '店員さんが消臭してくれた']),
  angry: () => 'もう来ない！',
  5: () => pick(['また来ます！', '最高のカードショップ！', '近所にあってうれしい']), 4: () => pick(['いいお店でした', '感じのいいお店']),
  3: () => pick(['ふつうかな', 'まあまあ']), 2: () => pick(['うーん…', 'ちょっと残念']), 1: () => 'もう来ない',
};
const itemName = (k) => (String(k).startsWith('c:') ? CARDS[k.slice(2)]?.name : k === '_play' ? 'プレイ料金' : PRODUCTS[k]?.name) || '';
function reviewText(stars, why) {
  const bad = why.filter((w) => ['smell', 'miss', 'pricey', 'waitL', 'wait', 'few', 'mess', 'waitAngry', 'noreg', 'angry'].includes(Array.isArray(w) ? w[0] : w));
  const good = why.filter((w) => ['cheap', 'fast', 'variety', 'card', 'play', 'fresh'].includes(Array.isArray(w) ? w[0] : w));
  const w = stars <= 3 ? bad[0] || null : (Math.random() < 0.6 && good.length ? pick(good) : null);
  if (!w) return RV[stars]();
  const [k, p] = Array.isArray(w) ? w : [w];
  return RV[k](k === 'card' ? CARDS[p]?.name || '' : itemName(p));
}
export function orderTotal(store, items) { return items.length ? orderCost(store, items) + SHIPPING_FEE : 0; }
export function orderCost(store, items) {
  return Math.round(items.reduce((s, [p, n, half]) => s + (p === EMPTY_BOX.id ? EMPTY_BOX_PRICE : marketCost(store, p) * boxUnits(p, half)) * n, 0));
}
export { CARDS_LIST };
