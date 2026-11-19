// カードの弾（シリーズ）定義。8弾でアニモン全250種が入る（進化の系統ごとに弾を分ける）
// レア度：たね（進化前）→N、途中の進化→R、最終進化・1体だけの種類のうち強い順に SSR4・SR4、残りは R
import fs from 'fs';
const L = JSON.parse(fs.readFileSync(new URL('./species.json', import.meta.url), 'utf8'));
const PACKS = JSON.parse(fs.readFileSync(new URL('./packs_lines.json', import.meta.url), 'utf8'));
const BASE = [
  { id: 1, code: 'AM1', name: 'スタートダッシュ', en: 'START DASH', theme: 'はじまりの草原', color: '#2fa84f', color2: '#ffd23f', price: 150, lv: 1, boxLv: 1, ssr: [3, 6, 9, 17] },
  { id: 2, code: 'AM2', name: 'フォレストエコー', en: 'FOREST ECHO', theme: 'こもれびの森', color: '#1f7a3a', color2: '#b6e36b', price: 160, lv: 3, boxLv: 4, ssr: [58, 61, 49, 56] },
  { id: 3, code: 'AM3', name: 'アクアブルーム', en: 'AQUA BLOOM', theme: '湖と海', color: '#1d6fd1', color2: '#7fe3ff', price: 180, lv: 7, boxLv: 8 },
  { id: 4, code: 'AM4', name: 'サンドストーム', en: 'SAND STORM', theme: '砂漠と王墓', color: '#c9822b', color2: '#ffe08a', price: 200, lv: 12, boxLv: 13, ssr: [103, 104, 248, 98] },
  { id: 5, code: 'AM5', name: 'ロックバスター', en: 'ROCK BUSTER', theme: '渓谷と流れ星', color: '#7a5a3a', color2: '#e6c48a', price: 220, lv: 18, boxLv: 19, ssr: [107, 237, 208, 114] },
  { id: 6, code: 'AM6', name: 'フロストクラウン', en: 'FROST CROWN', theme: '氷山と天空の高原', color: '#3a9fd8', color2: '#e6f8ff', price: 250, lv: 25, boxLv: 26, ssr: [138, 163, 141, 167] },
  { id: 7, code: 'AM7', name: 'ボルケーノハート', en: 'VOLCANO HEART', theme: '火山とドラゴン', color: '#d9361f', color2: '#ffb347', price: 280, lv: 33, boxLv: 34, ssr: [199, 174, 249, 247] },
  { id: 8, code: 'AM8', name: 'セイクリッドスカイ', en: 'SACRED SKY', theme: '聖域と深淵', color: '#6a4cd0', color2: '#ffd6f5', price: 320, lv: 42, boxLv: 43 },
];
const byLine = new Map();
for (const s of L) { if (!byLine.has(s.line)) byLine.set(s.line, []); byLine.get(s.line).push(s); }
export const SERIES = BASE.map((b) => {
  const sp = PACKS[b.id].flatMap((l) => byLine.get(l));
  const fin = sp.filter((s) => s.stage === s.stages).sort((a, c) => (c.legend - a.legend) || (c.bst - a.bst));
  const SSR = b.ssr || fin.slice(0, 4).map((s) => s.id), SR = fin.filter((s) => !SSR.includes(s.id)).slice(0, 4).map((s) => s.id);
  const N = sp.filter((s) => s.stage === 1 && s.stages > 1).map((s) => s.id);
  const R = sp.filter((s) => !SSR.includes(s.id) && !SR.includes(s.id) && !N.includes(s.id)).map((s) => s.id);
  for (const id of SSR) if (!sp.some((s) => s.id === id)) throw new Error('SSR not in pack ' + id);
  const { ssr, ...rest } = b;
  return { ...rest, N, R, SR, SSR, UR: SSR.slice(0, 2) };
});
