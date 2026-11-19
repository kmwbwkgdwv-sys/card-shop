// ===== カードの画面表示：キラキラ（ホロ）・開封演出・カードの詳細 =====（three.js 非依存）
import { CARDS, SERIES_BY, RARITY, rarityOrder, cardValue, cardValuePrev, isHit, cardRank, baseId, TYPE_JA, FLASH_MULT } from './cards.js';
const rname = (cid) => { const c = CARDS[cid]; return `${c.flash ? '✨フラッシュ ' : ''}${RARITY[c.r].name}（${c.r}）「${c.name}」`; };
import { cardCanvas, cardBackCanvas, packCanvas, boxCanvas, fontsReady } from './cardart.js';

const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};
const yen = (v) => '¥' + Math.round(v || 0).toLocaleString();

// キャンバスを写す（同じ絵を何か所にも出せるように）。絵が届いたら描き直す
function copyCanvas(src, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const draw = () => { const g = c.getContext('2d'); g.clearRect(0, 0, W, H); g.drawImage(src, 0, 0, W, H); };
  draw(); return { c, draw };
}
export function faceCanvas(cid, W = 315) {
  const H = Math.round(W * 88 / 63), dpr = Math.min(2, window.devicePixelRatio || 1);
  const srcW = W * dpr > 330 ? 630 : 315;
  const src = cardCanvas(cid, srcW);
  const { c, draw } = copyCanvas(src, Math.round(W * dpr), Math.round(H * dpr));
  cardCanvas(cid, srcW, () => draw());
  c.className = 'tc-face';
  return c;
}
function backCanvas(W = 315) {
  const H = Math.round(W * 88 / 63), dpr = Math.min(2, window.devicePixelRatio || 1);
  const { c, draw } = copyCanvas(cardBackCanvas(630), Math.round(W * dpr), Math.round(H * dpr));
  fontsReady().then(draw);
  c.className = 'tc-face';
  return c;
}
// キラキラの粒（グリッター）の画像
let _glitter = null;
function glitterURL() {
  if (_glitter) return _glitter;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  let a = 12345; const r = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
  for (let i = 0; i < 900; i++) { const v = 120 + r() * 135; g.fillStyle = `rgb(${v},${v},${v})`; const s = r() < 0.08 ? 3 : r() < 0.4 ? 2 : 1; g.fillRect(r() * 256, r() * 256, s, s); }
  for (let i = 0; i < 26; i++) { const x = r() * 256, y = r() * 256, s = 3 + r() * 5; g.fillStyle = '#fff'; g.fillRect(x - s, y - 0.5, s * 2, 1); g.fillRect(x - 0.5, y - s, 1, s * 2); }
  return (_glitter = c.toDataURL());
}
// カード1枚の要素（size：px幅）。interactive：さわると傾いてキラキラが動く
export function cardEl(cid, { size = 160, interactive = false, count = null, isNew = false, onClick = null, dim = false, cls = '' } = {}) {
  const c = CARDS[cid];
  const el = h('div', { class: `tcard r-${c ? c.r : 'N'}${c?.flash ? ' flash' : ''}${interactive ? ' interactive' : ''}${dim ? ' dim' : ''} ${cls}`, style: { '--w': size + 'px' } });
  const inner = h('div', { class: 'tc-inner' });
  if (c) {
    inner.append(faceCanvas(cid, size));
    if (c.r !== 'N') inner.append(h('div', { class: 'tc-holo' }));
    if (rarityOrder(c.r) >= 3) inner.append(h('div', { class: 'tc-glitter', style: { backgroundImage: `url(${glitterURL()})` } }));
    if (c.flash) inner.append(h('div', { class: 'tc-flash', style: { backgroundImage: `url(${glitterURL()})` } }));
    inner.append(h('div', { class: 'tc-glare' }));
  } else inner.append(backCanvas(size));
  el.append(inner);
  if (count != null) el.append(h('span', { class: 'tc-count' }, '×' + count));
  if (isNew) el.append(h('span', { class: 'tc-new' }, 'NEW'));
  if (onClick) { el.addEventListener('click', (e) => { if (el._dragged) return; onClick(e); }); el.style.cursor = 'pointer'; }
  if (interactive) tilt(el, inner);
  else idleShine(el);
  return el;
}
// 指やマウスで傾ける（離すとゆっくり戻る）
function tilt(el, inner) {
  let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0, on = false, t0 = performance.now();
  const set = () => {
    cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
    el.style.setProperty('--rx', (cy * -16).toFixed(2) + 'deg'); el.style.setProperty('--ry', (cx * 20).toFixed(2) + 'deg');
    el.style.setProperty('--mx', (50 + cx * 50).toFixed(1) + '%'); el.style.setProperty('--my', (50 + cy * 50).toFixed(1) + '%');
    el.style.setProperty('--pos', (50 + cx * 40 + cy * 25).toFixed(1) + '%');
    el.style.setProperty('--o', on ? 1 : 0.55);
    if (!on) { const t = (performance.now() - t0) / 1000; tx = Math.sin(t * 0.9) * 0.35; ty = Math.cos(t * 0.7) * 0.25; }
    if (el.isConnected || performance.now() - t0 < 500) raf = requestAnimationFrame(set);
  };
  const move = (e) => { const r = el.getBoundingClientRect(); tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2)); ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2)); on = true; };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerdown', (e) => { move(e); try { el.setPointerCapture(e.pointerId); } catch (err) { /* noop */ } });
  el.addEventListener('pointerleave', () => { on = false; t0 = performance.now(); });
  el.addEventListener('pointerup', () => { on = false; t0 = performance.now(); });
  raf = requestAnimationFrame(set);
  void raf; void inner;
}
// 一覧の小さいカードは、キラキラだけゆっくり動かす（CSS アニメ）
function idleShine(el) { el.classList.add('idle'); el.style.setProperty('--d', (Math.random() * -6).toFixed(2) + 's'); }

// ---------- カードの詳細（大きく表示） ----------
export function cardDetail(store, cid, { actions = [] } = {}) {
  const c = CARDS[cid], se = SERIES_BY[c.s];
  const v = cardValue(store, cid), pv = cardValuePrev(store, cid);
  const d = pv ? (v - pv) / pv * 100 : 0;
  const big = cardEl(cid, { size: Math.min(300, Math.round(window.innerHeight * 0.62 * 63 / 88)), interactive: true });
  const info = h('div', { class: 'cd-info' },
    h('div', { class: 'cd-name' }, c.name, ' ', h('span', { class: 'rar r-' + c.r }, c.r), c.flash ? h('span', { class: 'rar flash' }, '✨フラッシュ') : null),
    h('div', { class: 'muted small' }, `${RARITY[c.r].name}${c.flash ? `・フラッシュ（箔付き・相場${FLASH_MULT}倍）` : ''}　${se.code} 第${se.id}弾「${se.name}」 No.${String(c.no).padStart(3, '0')}`),
    h('div', { class: 'cd-row' }, h('span', {}, '相場'), h('b', {}, yen(v)), pv ? h('span', { class: 'trend ' + (d > 0.5 ? 'up' : d < -0.5 ? 'down' : 'flat') }, d > 0.5 ? `▲${d.toFixed(0)}%` : d < -0.5 ? `▼${Math.abs(d).toFixed(0)}%` : '→') : null),
    h('div', { class: 'cd-row' }, h('span', {}, 'タイプ'), h('b', {}, c.types.map((t) => TYPE_JA[t]).join('・')), h('span', {}, 'HP ' + c.hp)),
    h('div', { class: 'muted small cd-desc' }, c.desc),
    h('div', { class: 'cd-acts' }, actions));
  return h('div', { class: 'card-detail' }, h('div', { class: 'cd-card' }, big), info);
}

// ---------- 開封の演出 ----------
// e：{ kind:'pack'|'box', s, packs:[[cid×5]...], nw:[新しく図鑑に入ったカード] }
export function packOpening(e, { sfx, onClose, onMore, moreLabel, onAll, allLabel } = {}) {
  const se = SERIES_BY[e.s];
  const ov = h('div', { class: 'pack-ov' });
  const stage = h('div', { class: 'po-stage' });
  const hint = h('div', { class: 'po-hint' });
  const top = h('div', { class: 'po-top' }, h('b', {}, `${se.code}「${se.name}」`), h('span', {}, e.kind === 'box' ? ' BOX開封' : ' パック開封'));
  const skip = h('button', { class: 'btn small ghost po-skip' }, 'スキップ ⏭');
  ov.append(h('div', { class: 'po-bg', style: { '--c1': se.color, '--c2': se.color2 } }), top, stage, hint, skip);
  document.body.append(ov);
  const play = (n) => { try { sfx?.(n); } catch (err) { /* noop */ } };
  const close = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 250); onClose?.(); };
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    stage.innerHTML = ''; skip.remove();
    const all = e.packs.flat();
    if (e.kind === 'pack') {
      const row = h('div', { class: 'po-result' }, all.map((cid, i) => { const el = cardEl(cid, { size: cardSize(5), interactive: true, isNew: e.nw.includes(baseId(cid)) }); el.style.animationDelay = (i * 0.06) + 's'; return el; }));
      stage.append(row);
    } else {
      const tally = { N: 0, R: 0, SR: 0, SSR: 0, HR: 0, UR: 0 };
      let fl = 0;
      for (const cid of all) { tally[CARDS[cid].r]++; if (CARDS[cid].flash) fl++; }
      const hits = all.filter(isHit).sort((a, b) => cardRank(b) - cardRank(a));
      const newOnes = [...new Set(e.nw)].filter((cid) => !isHit(cid));
      stage.append(h('div', { class: 'po-box' },
        h('div', { class: 'po-tally' }, Object.entries(tally).map(([r, n]) => h('span', { class: 'rar r-' + r }, `${r} ×${n}`)), h('span', { class: 'rar flash' }, `✨フラッシュ ×${fl}`)),
        h('div', { class: 'po-sub' }, `✨ 当たり（SR以上・フラッシュ）${hits.length}枚`),
        h('div', { class: 'po-grid hits' }, hits.map((cid) => cardEl(cid, { size: Math.round(cardSize(Math.min(8, Math.max(3, hits.length))) * (hits.length > 8 ? 0.8 : 1)), interactive: hits.length <= 12, isNew: e.nw.includes(baseId(cid)) }))),
        newOnes.length ? h('div', { class: 'po-sub' }, `🆕 図鑑に新しく登録 ${newOnes.length}枚`) : null,
        newOnes.length ? h('div', { class: 'po-grid small' }, newOnes.map((cid) => cardEl(cid, { size: 74, isNew: true }))) : null));
    }
    const best = all.reduce((b, cid) => (!b || cardRank(cid) > cardRank(b) ? cid : b), null);
    hint.textContent = `${e.nw.length ? `🆕 図鑑に${e.nw.length}種類登録！　` : ''}いちばんレア：${rname(best)}　（カードはさわると傾きます）`;
    const btns = h('div', { class: 'po-btns' });
    if (onMore) btns.append(h('button', { class: 'btn big', onclick: () => { ov.remove(); onMore(); } }, moreLabel || 'もう1パック開ける'));
    if (onAll) btns.append(h('button', { class: 'btn big alt', onclick: () => { ov.remove(); onAll(); } }, allLabel || 'まとめて開ける'));
    btns.append(h('button', { class: 'btn big ghost', onclick: close }, '閉じる'));
    ov.append(btns);
  };
  skip.onclick = finish;
  fontsReady().then(() => (e.kind === 'pack' ? packSequence() : boxSequence()));

  // 1パック：袋を破る → 1枚ずつめくる
  function packSequence() {
    const cards = e.packs[0];
    const pk = packCanvas(e.s, 300);
    const { c: pc, draw } = copyCanvas(pk, 300, 500); packCanvas(e.s, 300, draw);
    const topPart = h('div', { class: 'po-pack-top' }), botPart = h('div', { class: 'po-pack-bot' });
    const c2 = copyCanvas(pk, 300, 500); packCanvas(e.s, 300, c2.draw);
    topPart.append(pc); botPart.append(c2.c);
    const best = cards[4], br = CARDS[best].r;
    const pack = h('div', { class: 'po-pack' + (isHit(best) ? ' glow-' + (rarityOrder(br) >= 2 ? br : 'SR') : '') }, botPart, topPart);
    stage.append(pack);
    hint.textContent = 'タップしてパックを破ろう！';
    let step = 0;
    const tear = () => {
      if (step !== 0) return; step = 1;
      play('tear'); pack.classList.add('torn');
      hint.textContent = '';
      setTimeout(() => { pack.remove(); reveal(); }, 650);
    };
    pack.addEventListener('click', tear);
    ov.addEventListener('keydown', tear);
    let swipeX = null;
    pack.addEventListener('pointerdown', (ev) => { swipeX = ev.clientX; });
    pack.addEventListener('pointerup', (ev) => { if (swipeX != null && Math.abs(ev.clientX - swipeX) > 40) tear(); swipeX = null; });
    // めくる
    function reveal() {
      const pile = h('div', { class: 'po-pile' });
      const row = h('div', { class: 'po-row' });
      stage.append(row, pile);
      const els = cards.map((cid, i) => {
        const wrap = h('div', { class: 'po-flip', style: { zIndex: 10 - i } });
        const back = h('div', { class: 'po-side back' }, backCanvas(cardSize(1.6)));
        const front = h('div', { class: 'po-side front' }, cardEl(cid, { size: cardSize(1.6), isNew: e.nw.includes(baseId(cid)) }));
        wrap.append(back, front);
        pile.append(wrap);
        return wrap;
      });
      let k = 0;
      hint.textContent = 'タップして1枚ずつめくろう！（いちばんレアなカードが最後）';
      const flip = (i) => {
        const el = els[i], cid = cards[i], r = CARDS[cid].r;
        el.classList.add('open'); pile.className = 'po-pile';
        const o = rarityOrder(r);
        if (o >= 4) { play('ultra'); flash(r); } else if (o >= 2 || CARDS[cid].flash) { play('rare'); flash(o >= 2 ? r : 'FL'); } else play('flip');
        hint.textContent = `${rname(cid)}${e.nw.includes(baseId(cid)) ? '　🆕 NEW！' : ''}`;
      };
      const next = () => {
        if (done) return;
        if (k >= els.length) return finish();
        const el = els[k], cid = cards[k];
        if (!el.classList.contains('open')) return flip(k);
        // めくったカードを下の列へ → 次をめくる
        el.classList.add('away');
        const mini = cardEl(cid, { size: Math.round(cardSize(5) * 0.6), isNew: e.nw.includes(baseId(cid)) }); mini.classList.add('pop');
        row.append(mini);
        k++;
        if (k >= els.length) { setTimeout(finish, 350); return; }
        const lr = CARDS[cards[k]].r;
        if (k === els.length - 1 && isHit(cards[k])) { pile.className = 'po-pile charge c-' + (rarityOrder(lr) >= 2 ? lr : 'SR'); hint.textContent = '……！？ 最後のカードが光ってる！'; play('flip'); return; }
        flip(k);
      };
      pile.addEventListener('click', next);
      ov.tabIndex = -1; ov.focus();
      ov.addEventListener('keydown', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') next(); });
    }
  }
  // BOX：箱 → 当たりを1枚ずつ発表 → まとめ
  function boxSequence() {
    const bx = boxCanvas(e.s, 'front', 500, 300);
    const { c, draw } = copyCanvas(bx, 500, 300); boxCanvas(e.s, 'front', 500, 300, draw);
    const box = h('div', { class: 'po-boxart' }, c);
    stage.append(box);
    hint.textContent = 'タップしてBOXを開けよう！（30パック）';
    // 1枚ずつ発表するのは SSR以上と、SR以上のフラッシュ（ほかの当たりはまとめで見せる）
    const hits = e.packs.flat().filter((cid) => rarityOrder(CARDS[cid].r) >= 3 || (CARDS[cid].flash && rarityOrder(CARDS[cid].r) >= 2)).sort((a, b) => cardRank(a) - cardRank(b));
    let started = false;
    box.addEventListener('click', () => {
      if (started) return; started = true;
      play('tear'); box.classList.add('open');
      setTimeout(() => { box.remove(); showHit(0); }, 600);
    });
    function showHit(i) {
      if (done) return;
      if (i >= hits.length) return finish();
      stage.innerHTML = '';
      const cid = hits[i], r = CARDS[cid].r;
      const el = cardEl(cid, { size: cardSize(1.6), interactive: true, isNew: e.nw.includes(baseId(cid)) });
      el.classList.add('pop');
      stage.append(h('div', { class: 'po-hitno' }, `当たり ${i + 1} / ${hits.length}`), el);
      if (rarityOrder(r) >= 4) { play('ultra'); flash(r); } else { play('rare'); flash(r); }
      hint.textContent = `${rname(cid)}　タップで次へ`;
      const go = () => { stage.removeEventListener('click', go); showHit(i + 1); };
      setTimeout(() => stage.addEventListener('click', go), 250);
    }
  }
  function flash(r) {
    const f = h('div', { class: 'po-flash f-' + r });
    ov.append(f); setTimeout(() => f.remove(), 1200);
  }
  return { close };
}
// 画面の大きさに合わせたカードの幅（n枚が横に並ぶくらい）
function cardSize(n) {
  const W = window.innerWidth, H = window.innerHeight;
  const byH = (H * (n >= 5 ? 0.42 : 0.6)) * 63 / 88;
  return Math.max(64, Math.round(Math.min(byH, (W * 0.9) / Math.max(1, n) - 14, 330)));
}
export { h as hh };
