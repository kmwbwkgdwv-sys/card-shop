// カードのマスターデータを作る（アニモンの図鑑データから）
// usage: node gen_cards.mjs <animon_root> <out.js>
import { SERIES } from './series.mjs';
import fs from 'fs';
const root = process.argv[2], out = process.argv[3];
const S = await import(root + '/js/data/species.js');
const M = await import(root + '/js/data/moves.js');
const T = await import(root + '/js/data/types.js');

const r10 = (v) => Math.max(10, Math.round(v / 10) * 10);
// カードの技：威力のある技を選ぶ（レア度が高いほど強い技）
function pickMoves(sp, rar) {
  const list = sp.moves.map((m) => M.MOVES[m.id]).filter((m) => m && m.power > 0);
  const status = sp.moves.map((m) => M.MOVES[m.id]).filter((m) => m && !(m.power > 0));
  const byPow = [...list].sort((a, b) => a.power - b.power);
  const out = [];
  const strong = byPow[byPow.length - 1], mid = byPow[Math.floor(byPow.length * 0.4)];
  const hi = { N: 0.75, R: 0.9, SR: 1.05, SSR: 1.2 }[rar];
  const mk = (m, k) => {
    const dmg = r10(m.power * k * hi);
    const n = dmg <= 30 ? 1 : dmg <= 60 ? 2 : dmg <= 110 ? 3 : dmg <= 170 ? 4 : 5;
    const prim = sp.types[0];
    const cost = [];
    for (let i = 0; i < n; i++) cost.push(i < Math.ceil(n * 0.6) ? (m.type === 'normal' ? 'normal' : m.type) : 'normal');
    return { n: m.name, t: m.type, cost, dmg, d: m.desc ? m.desc.slice(0, 34) : '' };
  };
  if (rar === 'N' && status.length && Math.random() < 0) out.push({ n: status[0].name, t: status[0].type, cost: [sp.types[0]], dmg: 0, d: status[0].desc });
  if (mid && mid !== strong && rar !== 'N') out.push(mk(mid, 0.8));
  else if (mid && mid !== strong) out.push(mk(mid, 0.7));
  if (strong) out.push(mk(strong, 1));
  return out.slice(0, 2);
}
function weakness(types) {
  let best = null, bv = 1;
  for (const t of T.TYPES) { const v = T.typeEff(t, types); if (v > bv) { bv = v; best = t; } }
  return best;
}
function resist(types) {
  for (const t of T.TYPES) { const v = T.typeEff(t, types); if (v > 0 && v < 1) return t; }
  return null;
}
const RAR_V = { N: 5, R: 15, SR: 80, SSR: 300, HR: 1200, UR: 5000 };
const cards = [];
const used = new Set();
for (const s of SERIES) {
  const mult = s.price / 150;
  let no = 0;
  const add = (spId, rar, art) => {
    const sp = S.SPECIES[spId];
    if (!sp) throw new Error('no species ' + spId);
    no++;
    const base = sp.base;
    const boost = { N: 0, R: 10, SR: 40, SSR: 80, HR: 80, UR: 80 }[rar];
    const hp = r10(base.hp * 0.7 + sp.bst * 0.18 + boost + (sp.stage - 1) * 10 + (sp.legend ? 30 : 0));
    const mrar = rar === 'HR' || rar === 'UR' ? 'SSR' : rar;
    const atk = pickMoves(sp, mrar);
    // 人気（伝説・最終進化は高め、同じレア度の中で少しずつ違う）
    const pop = (sp.legend ? 1.5 : 1) * (sp.stage === sp.stages ? 1.15 : 1) * (0.85 + ((spId * 37 + no * 11) % 31) / 100);
    const step = RAR_V[rar] >= 1000 ? 100 : RAR_V[rar] >= 100 ? 10 : 5;
    const v = Math.max(5, Math.round(RAR_V[rar] * mult * pop / step) * step);
    const retreat = Math.min(4, Math.max(0, Math.round((base.hp + base.def) / 60) - 1 - (sp.plan === 'bird' || sp.plan === 'bug' ? 1 : 0)));
    cards.push({
      id: `${s.id}-${String(no).padStart(3, '0')}`, s: s.id, no, r: rar, sp: spId, name: sp.name, types: sp.types, stage: sp.stage, stages: sp.stages,
      legend: sp.legend || undefined, hp, atk, weak: weakness(sp.types), res: resist(sp.types) || undefined, ret: retreat,
      desc: sp.desc, art: rar === 'SSR' || rar === 'HR' || rar === 'UR' ? spId + 's' : String(spId), v,
    });
    used.add(spId);
  };
  for (const id of s.N) add(id, 'N');
  for (const id of s.R) add(id, 'R');
  for (const id of s.SR) add(id, 'SR');
  for (const id of s.SSR) add(id, 'SSR');
  for (const id of s.SSR) add(id, 'HR');
  for (const id of s.UR) add(id, 'UR');
}
const typeJA = T.TYPE_JA, typeColor = T.TYPE_COLOR;
const series = SERIES.map(({ N, R, SR, SSR, UR, ...o }) => ({ ...o, feature: SSR[0], feature2: SSR[1], count: N.length + R.length + SR.length + SSR.length }));
const js = `// ===== カードのマスターデータ（tools/gen_cards.mjs で アニモン図鑑から自動生成） =====
// キャラクター・技・説明文は「アニマルモンスター（アニモン）」のデータを使っています
export const TYPE_JA = ${JSON.stringify(typeJA)};
export const TYPE_COLOR = ${JSON.stringify(typeColor)};
export const SERIES = ${JSON.stringify(series, null, 0).replace(/\},\{/g, '},\n  {')};
export const CARDS_LIST = ${JSON.stringify(cards).replace(/\},\{"id"/g, '},\n  {"id"')};
`;
fs.writeFileSync(out, js);
console.log('cards', cards.length, 'species', used.size, 'bytes', js.length);
const ex = cards.filter((c) => c.s === 1);
for (const c of ex.slice(0,3)) console.log(c.id, c.r, c.name, c.hp, c.v, c.atk.map((a) => a.n + ':' + a.dmg + '[' + a.cost.length + ']').join(' / '), 'weak', c.weak, 'ret', c.ret);
for (const c of cards.filter((c) => c.s === 8 && c.r !== 'N' && c.r !== 'R')) console.log(c.id, c.r, c.name, c.hp, c.v);
