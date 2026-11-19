// ===== カード（アニモンカードゲーム）：レア度・封入率・開封・相場 =====（three.js 非依存）
import { SERIES, CARDS_LIST, TYPE_JA, TYPE_COLOR } from './carddata.js';
export { SERIES, CARDS_LIST, TYPE_JA, TYPE_COLOR };

// フラッシュ（箔付き）：どのレア度にも5%で付く。カードが輝き、相場は2.5倍。カードID の後ろに f をつけて区別する（例 1-001f）
export const FLASH_RATE = 5, FLASH_MULT = 2.5; // フラッシュは2.5倍（1つ上のレア度より高くはならない）
export const CARDS = Object.fromEntries(CARDS_LIST.flatMap((c) => [[c.id, c], [c.id + 'f', { ...c, id: c.id + 'f', base: c.id, flash: true, v: c.v * FLASH_MULT }]]));
export const baseId = (k) => CARDS[k]?.base || k;
export const isFlash = (k) => !!CARDS[k]?.flash;
export const SERIES_BY = Object.fromEntries(SERIES.map((s) => [s.id, s]));
export const RARITIES = ['N', 'R', 'SR', 'SSR', 'HR', 'UR'];
// レア度：ポケカ風の見た目の段階（N=ノーマル／R=ホロ／SR=フルアート／SSR=色ちがいスペシャル／HR=レインボー／UR=ゴールド）
export const RARITY = {
  N: { name: 'ノーマル', mark: '●', color: '#8b95a5', glow: null, order: 0 },
  R: { name: 'レア', mark: '◆', color: '#4aa3ff', glow: '#9fd2ff', order: 1 },
  SR: { name: 'スーパーレア', mark: '★', color: '#c0c8d4', glow: '#e8f2ff', order: 2 },
  SSR: { name: 'スペシャルスーパーレア', mark: '★★', color: '#7ad7ff', glow: '#bff0ff', order: 3 },
  HR: { name: 'ハイパーレア', mark: '★★★', color: 'rainbow', glow: '#ff9bf2', order: 4 },
  UR: { name: 'ウルトラレア', mark: '★★★', color: '#f2c14e', glow: '#ffe08a', order: 5 },
};
export const rarityOrder = (r) => RARITY[r]?.order ?? 0;
export const isHit = (cid) => rarityOrder(CARDS[cid]?.r) >= 2 || isFlash(cid); // SR以上・フラッシュは「当たり」
// 並べるとき・演出の順番用の強さ（フラッシュは同じレア度の中で上）
export const cardRank = (cid) => rarityOrder(CARDS[cid]?.r) * 2 + (isFlash(cid) ? 1 : 0);

// 1パック5枚。封入率は「1枚ごとの独立判定」（%）
export const PACK_SIZE = 5;
export const BOX_PACKS = 10; // 1BOX＝10パック
export const CARD_RATES = [['N', 80.0], ['R', 14.0], ['SR', 4.0], ['SSR', 1.5], ['HR', 0.4], ['UR', 0.1]]; // レアほど出にくく（合計100%）

const _bySR = new Map();
export function seriesCards(sid, r) {
  const k = sid + '|' + (r || '');
  if (!_bySR.has(k)) _bySR.set(k, CARDS_LIST.filter((c) => c.s === sid && (!r || c.r === r)).map((c) => c.id));
  return _bySR.get(k);
}
const pickOf = (arr, rnd) => arr[Math.floor(rnd() * arr.length) % arr.length];
export function rollRarity(rnd = Math.random) {
  let x = rnd() * 100;
  for (const [r, p] of CARD_RATES) { if (x < p) return r; x -= p; }
  return 'N';
}
// 1枚引く：レア度 → その弾のそのレア度のカード → 5%でフラッシュ
export function drawCard(sid, rnd = Math.random) {
  const cid = pickOf(seriesCards(sid, rollRarity(rnd)), rnd);
  return rnd() * 100 < FLASH_RATE ? cid + 'f' : cid;
}
// 1パック開ける → カード×5（めくる順：弱い → 強い。いちばんレアなカードが最後）
export function openPack(sid, rnd = Math.random) {
  const out = [];
  for (let i = 0; i < PACK_SIZE; i++) out.push(drawCard(sid, rnd));
  return out.sort((a, b) => cardRank(a) - cardRank(b));
}
// 1BOX（30パック）開ける
export function openBox(sid, rnd = Math.random) {
  const packs = [];
  for (let i = 0; i < BOX_PACKS; i++) packs.push(openPack(sid, rnd));
  return packs;
}

// ---------- カードの相場 ----------
// 相場 = 基準価格 × その日の変動（store.cmk）。値段の端数をそろえる
export function roundYen(v) {
  if (v >= 10000) return Math.round(v / 500) * 500;
  if (v >= 1000) return Math.round(v / 100) * 100;
  if (v >= 100) return Math.round(v / 10) * 10;
  return Math.max(10, Math.round(v / 5) * 5);
}
// フラッシュは元のカードの相場 × FLASH_MULT
// 毎日の相場のゆれ（レア度の順番が入れかわらない幅にとどめる）
export const CMK_MIN = 0.9, CMK_MAX = 1.12;
const cmkOf = (m) => Math.min(CMK_MAX, Math.max(CMK_MIN, m ?? 1));
// フラッシュ全体の相場（対戦イベント「キラキラヘブン」で上がる。1.00〜1.10）
const FLASH_MK_MAX = 1.1;
const fmkOf = (m) => Math.min(FLASH_MK_MAX, Math.max(1, m ?? 1));
export function cardValue(store, cid) { const c = CARDS[cid]; if (!c) return 0; if (c.flash) return roundYen(FLASH_MULT * fmkOf(store?.cmk?._flash) * cardValue(store, c.base)); return roundYen(c.v * cmkOf(store?.cmk?.[cid])); }
export function cardValuePrev(store, cid) { const c = CARDS[cid]; if (!c) return null; if (c.flash) { const b = cardValuePrev(store, c.base); return b == null ? null : roundYen(FLASH_MULT * fmkOf(store?.cmkPrev?._flash ?? store?.cmk?._flash) * b); } const m = store?.cmkPrev?.[cid]; return m == null ? null : roundYen(c.v * cmkOf(m)); }
// 対戦イベントの条件を文字にする（例：「炎タイプ」「SR」「AM1・AM2」「フラッシュ」）
export function fmtTargetText(d) {
  if (!d) return '';
  if (d.r) return d.r.join('・');
  if (d.t) return typeJA(d.t) + 'タイプ';
  if (d.s) return d.s.map((n) => SERIES_BY[n]?.code || 'AM' + n).join('・');
  if (d.flash) return 'フラッシュ';
  return '';
}
// 対戦イベントの条件にカードが当てはまるか（{r:[レア度]}, {t:タイプ}, {s:[弾]}）
export function fmtMatch(c, d) {
  if (!d || !c) return false;
  if (d.r) return d.r.includes(c.r);
  if (d.t) return (c.types || []).includes(d.t);
  if (d.s) return d.s.includes(c.s);
  return false;
}
export const CARD_OK = 1.2; // 相場の+20%までなら買ってもらえる
export const cardLimit = (store, cid) => Math.floor(cardValue(store, cid) * CARD_OK);
export const cardPrice = (store, cid) => store?.cprices?.[cid] ?? cardValue(store, cid);
export const BUYBACK = 0.12; // 業者買取は相場の12%（まとめて開けて売るだけでは、もうからない）
export const buybackPrice = (store, cid) => Math.max(1, Math.floor(cardValue(store, cid) * BUYBACK));
// 毎日の相場変動（平均へゆっくり戻るランダムウォーク）。レアほど大きく動く
// ef: 前の日に開いた対戦イベントの影響 { up, down }（当てはまるカードの相場が上がる／下がる）
export const FMT_PUSH = 0.04;
export function updateCardMarket(store, rnd = Math.random, ef = null) {
  store.cmk ||= {}; store.cmkPrev = {};
  for (const c of CARDS_LIST) {
    const m = store.cmk[c.id] ?? 1;
    store.cmkPrev[c.id] = m;
    const vol = [0.02, 0.025, 0.03, 0.035, 0.04, 0.045][rarityOrder(c.r)];
    let g = (rnd() + rnd() + rnd() - 1.5) * vol;
    if (ef) { if (fmtMatch(c, ef.up)) g += FMT_PUSH; else if (fmtMatch(c, ef.down)) g -= FMT_PUSH; }
    store.cmk[c.id] = +Math.min(CMK_MAX, Math.max(CMK_MIN, 1 + (cmkOf(m) - 1) * 0.8 + g)).toFixed(3);
  }
  const fm = store.cmk._flash ?? 1; store.cmkPrev._flash = fm;
  store.cmk._flash = +fmkOf(1 + (fmkOf(fm) - 1) * 0.7 + (ef?.up?.flash ? 0.035 : 0)).toFixed(3);
}
// コレクション
export function ownedCount(store, cid) { return store?.cards?.[cid] || 0; }
export function collectionStats(store, sid) {
  const list = sid ? CARDS_LIST.filter((c) => c.s === sid) : CARDS_LIST;
  let have = 0, total = 0;
  for (const c of list) { total++; if (store?.dex?.[c.id]) have++; }
  return { have, total };
}
export function displayedCount(store, cid) {
  let n = 0;
  for (const f of store?.fixtures || []) if (f.cs) for (const x of f.cs) if (x === cid) n++;
  return n;
}
export const cardLabel = (cid) => { const c = CARDS[cid]; return c ? `${c.flash ? '✨' : ''}${c.name}（${c.r}${c.flash ? '・フラッシュ' : ''}）` : '???'; };
export const seriesOfProduct = (pid) => { const m = /^(pk|bx)(\d)$/.exec(pid || ''); return m ? +m[2] : 0; };
export const typeJA = (t) => TYPE_JA[t] || t;
