// ===== ゲーム中のUI（HUD・発注PC・スキルボード・レジ・建築・チャット） =====
import { h, $, modal, toast, confirmBox, promptBox } from './ui.js';
import { PRODUCTS, PRODUCTS_LIST, CATEGORIES, FIXTURES, FIXTURE_CATS, STAFF_ROLES, STAFF_NAMES, SPEEDS, OFF_ROLE, staffK,
  productUnlocked, fixtureUnlocked, staffLimit, STAFF_SLOTS, STAFF_MAX, staffWage, xpNeed, closeTime, CHAT_PRESETS, SALES, STOCK_COLS, STOCK_ROWS, stockAt, expandTargets, marketPrice, marketCost, ORDER_MAX_BOXES, SHIPPING_FEE, MAX_LEVEL, halfQty, EMPTY_BOX, EMPTY_BOX_PRICE, boxProd,
  unlocksAt, checkoutLimit, PLAY_FEE_MAX, isPack, isBoosterBox } from './data.js';
import { CARDS, CARDS_LIST, SERIES, SERIES_BY, RARITY, RARITIES, CARD_RATES, FLASH_RATE, FLASH_MULT, PACK_SIZE, BOX_PACKS, cardValue, cardValuePrev, cardPrice, cardLimit, buybackPrice, BUYBACK, rarityOrder, collectionStats, displayedCount, seriesOfProduct } from './cards.js';
import { packCanvas, boxCanvas } from './cardart.js';
import { cardEl, cardDetail, packOpening } from './cardui.js';
import { getPrice, orderCost, orderTotal, priceLimit, customerFactors, repStars } from './sim.js';
import { yen, fmtTime, mulberry32, escapeText } from './util.js';

const PHASE = { prep: '準備中', open: '営業中', closing: '閉店準備', summary: '本日の結果' };

export class GameUI {
  constructor() {
    this.hud = $('#hud');
    this.hud.innerHTML = '';
    const H = this.hud;
    this.day = h('div', { class: 'hud-chip' }); this.openBtn = h('button', { class: 'hud-open' });
    this.money = h('div', { class: 'hud-chip money' });
    this.lvText = h('span'); this.lvBar = h('i');
    this.binder = h('button', { class: 'hud-chip binder', title: 'バインダー（C）' }, '📒');
    this.rep = h('button', { class: 'hud-chip rep', title: '評判と口コミを見る（Tab）' });
    this.lv = h('button', { class: 'hud-chip lv', title: 'レベルとできるようになること' }, this.lvText, h('div', { class: 'bar' }, this.lvBar));
    H.append(h('div', { class: 'hud-top' }, this.day, this.openBtn, this.money, this.lv, this.rep, this.binder));
    this.roomInfo = h('div', { class: 'room-info hidden' }); H.append(this.roomInfo);
    this.cross = h('div', { class: 'crosshair' }); H.append(this.cross);
    this.hint = h('div', { class: 'hint hidden' }); H.append(this.hint);
    this.info = h('div', { class: 'target-info hidden' }); H.append(this.info);
    this.chatLog = h('div', { class: 'chatlog' }); H.append(this.chatLog);
    this.keys = h('div', { class: 'pc-keys' }); H.append(this.keys);
    this.reg = h('div', { class: 'reg-ui hidden' }); H.append(this.reg);
    this.build = h('div', { class: 'build-ui hidden' }); H.append(this.build);
    this.deliv = h('div', { class: 'hud-chip deliv hidden' }); H.append(this.deliv);
    this._hudT = 0; this.open = null;
  }
  show(v) { this.hud.classList.toggle('hidden', !v); }
  bind(game) {
    this.g = game;
    this.openBtn.onclick = () => { const ph = game.store.phase; toast(ph === 'prep' ? '🪧 入口の看板をOPENにすると営業スタート！' : ph === 'open' ? '🪧 店じまいするときは入口の看板をCLOSEDに' : '⏳ 残りのお客さんの会計をしよう'); };
    this.lv.onclick = () => { if (!this.open) this.openLevel(); };
    this.rep.onclick = () => { if (!this.open) this.openRep(); };
    this.binder.onclick = () => { if (!this.open) this.openBinder(); };
  }
  updateHUD(dt, store, dyn, force) {
    this._hudT -= dt;
    if (this._hudT > 0 && !force) return;
    this._hudT = 0.2;
    if (!store) return;
    const t = dyn?.time ?? store.time;
    this.day.innerHTML = `📅 ${store.day}日目 <b>${fmtTime(t)}</b> <small>${PHASE[store.phase] || ''}</small>`;
    const ph = store.phase;
    this.openBtn.textContent = ph === 'prep' ? '🔴 CLOSED（準備中）' : ph === 'open' ? '🟢 OPEN 営業中' : ph === 'closing' ? '⏳ 店じまい中' : '📊 集計中';
    this.openBtn.classList.toggle('isopen', ph === 'open');
    this.openBtn.classList.toggle('pulse', ph === 'prep');
    this.money.textContent = '💴 ' + yen(store.money);
    const maxed = store.level >= MAX_LEVEL;
    this.lvText.textContent = 'Lv.' + store.level + (maxed ? ' MAX' : '');
    this.lvBar.style.width = (maxed ? 100 : Math.min(100, store.xp / xpNeed(store.level) * 100)) + '%';
    this.rep.textContent = '⭐ ' + repStars(store.rep).toFixed(1);
    const n = dyn?.dl || 0;
    this.deliv.classList.toggle('hidden', !n); this.deliv.textContent = `🚚 配送中 ×${n}`;
  }
  setRoom(text) { this.roomInfo.classList.toggle('hidden', !text); this.roomInfo.innerHTML = ''; if (text) this.roomInfo.append(...text); }
  setHint(text, info) {
    this.hint.classList.toggle('hidden', !text);
    if (this.hint._t !== text) { this.hint.textContent = text || ''; this.hint._t = text; }
    this.info.classList.toggle('hidden', !info);
    if (info && this.info._t !== info) { this.info.innerHTML = info; this.info._t = info; }
  }
  setKeys(text) { if (this.keys._t !== text) { this.keys.textContent = text; this.keys._t = text; } }
  showCross(v) { this.cross.classList.toggle('hidden', !v); }

  // ---------- 発注パソコン ----------
  openPC(tab = 'order') {
    const g = this.g;
    const cart = new Map();
    let cat = 'pack';
    const body = h('div', { class: 'pc-body' });
    const tabs = h('div', { class: 'tabs' });
    const TABS = [['order', '📦 発注'], ['staff', '🧑‍💼 従業員'], ['rep', '💬 評判'], ['store', '🏪 お店']];
    if (tab === 'price') tab = 'order';
    const total = h('b'); const orderBtn = h('button', { class: 'btn' }, '注文する');
    const draw = () => {
      const st = g.store;
      tabs.innerHTML = '';
      for (const [k, n] of TABS) tabs.append(h('button', { class: 'tab' + (k === tab ? ' on' : ''), onclick: () => { tab = k; draw(); } }, n));
      // ＋−を押して描き直してもスクロール位置がもどらないように覚えておく
      const same = body.dataset.k === tab + '|' + cat, keepB = body.scrollTop, keepG = body.querySelector('.pgrid')?.scrollTop || 0;
      body.dataset.k = tab + '|' + cat;
      body.innerHTML = ''; body.className = 'pc-body tab-' + tab;
      requestAnimationFrame(() => { if (same) { body.scrollTop = keepB; const gr = body.querySelector('.pgrid'); if (gr) gr.scrollTop = keepG; } else body.scrollTop = 0; });
      if (tab === 'order') {
        const ctabs = h('div', { class: 'tabs scroll small' });
        for (const [k, c] of Object.entries(CATEGORIES)) ctabs.append(h('button', { class: 'tab' + (k === cat ? ' on' : ''), onclick: () => { cat = k; draw(); } }, c.icon + ' ' + c.name));
        ctabs.append(h('button', { class: 'tab' + (cat === EMPTY_BOX.id ? ' on' : ''), onclick: () => { cat = EMPTY_BOX.id; draw(); } }, '📦 空き箱'));
        const grid = h('div', { class: 'pgrid' });
        const inCart = [...cart.values()].reduce((t, n) => t + n, 0), full = inCart >= ORDER_MAX_BOXES;
        const qtyRow = (key, label, price) => {
          const n = cart.get(key) || 0;
          return h('div', { class: 'qty' + (key.endsWith('|h') ? ' half' : '') }, h('span', { class: 'ql' }, label, h('small', {}, yen(price))),
            h('button', { onclick: () => { cart.set(key, Math.max(0, n - 1)); draw(); } }, '−'), h('b', {}, n),
            h('button', { class: full ? 'dim' : '', onclick: () => { if (full) { toast(`カートは最大${ORDER_MAX_BOXES}箱までです`, 'warn'); return; } cart.set(key, n + 1); draw(); } }, '＋'));
        };
        const sm = stockMap(st, g.sim?.dyn);
        if (cat === EMPTY_BOX.id) {
          // 空の段ボール：棚の商品を詰めて運ぶ（模様替え・棚の入れ替え用）
          const have = st.boxes.filter((b) => b.n <= 0).length;
          grid.append(h('div', { class: 'pcard2 emptybox' },
            h('div', { class: 'pe' }, '📦'),
            h('div', { class: 'pn' }, EMPTY_BOX.name),
            h('div', { class: 'pm' }, 'どの商品でも1種類だけ詰められる箱。棚の商品を詰めて別の棚へ運べば模様替えが楽に'),
            h('div', { class: 'pm' }, `補充で空になった箱も同じように使えます（いま空き箱 ${have}個）`),
            h('div', { class: 'qtys' }, qtyRow(EMPTY_BOX.id, '1箱', EMPTY_BOX_PRICE))));
        }
        for (const p of PRODUCTS_LIST.filter((x) => x.cat === cat)) {
          const ok = productUnlocked(p.id, st.level);
          const unitCost = marketCost(st, p.id);
          const boxCost = Math.round(unitCost * p.qty), halfCost = Math.round(unitCost * halfQty(p.id));
          const card = h('div', { class: 'pcard2' + (ok ? '' : ' locked') + (p.series ? ' pk' : '') },
            prodThumb(p),
            h('div', { class: 'pn' }, p.name),
            p.series ? h('div', { class: 'pbadge' }, `第${p.series}弾 ${SERIES_BY[p.series].theme}`) : null,
            h('div', { class: 'pm' }, `📦 1箱${p.qty}${p.cat === 'pack' ? 'パック' : '個'}（半分は${halfQty(p.id)}）`),
            h('div', { class: 'pm' }, `仕入 ${yen(marketCost(st, p.id))} / 相場 ${yen(marketPrice(st, p.id))} `, trend(st, p.id)),
            ok ? stockLine(sm, p.id) : null,
            ok ? h('div', { class: 'qtys' }, qtyRow(p.id, '1箱', boxCost), qtyRow(p.id + '|h', '半分', halfCost))
              : h('div', { class: 'lock' }, `🔒 お店 Lv.${p.lv} で入荷`));
          grid.append(card);
        }
        // カートのキー：商品ID（1箱）／商品ID|h（半分の箱）→ 注文は [商品, 箱数, ハーフ]
        const items = [...cart.entries()].filter(([, n]) => n > 0).map(([k, n]) => [k.split('|')[0], n, k.endsWith('|h') ? 1 : 0]);
        const goods = orderCost(st, items), cost = orderTotal(st, items);
        total.textContent = yen(cost);
        orderBtn.disabled = !items.length || cost > st.money;
        orderBtn.textContent = items.length ? `🚚 注文する（${inCart}箱）` : '注文する';
        orderBtn.onclick = () => { g.act({ t: 'order', items }); cart.clear(); draw(); };
        // カートの中身（タップで1箱へらす）
        const chips = h('div', { class: 'cart-chips' }, items.length ? items.map(([pid, k, half]) => h('button', { class: 'cchip', onclick: () => { const key = pid + (half ? '|h' : ''); cart.set(key, k - 1); draw(); } }, `${boxProd(pid).icon}${pid === EMPTY_BOX.id ? '空' : ''}${half ? '½' : ''}×${k}`)) : h('span', { class: 'muted small' }, '＋でカートに入れてね'));
        body.append(ctabs, grid, h('div', { class: 'cartbar' },
          h('div', { class: 'cart-l' },
            h('div', { class: 'cart-h' }, h('b', { class: 'cart-n' + (full ? ' full' : '') }, `🛒 ${inCart}/${ORDER_MAX_BOXES}箱`), items.length ? h('button', { class: 'cclear', onclick: () => { cart.clear(); draw(); } }, 'からにする') : null),
            chips),
          h('div', { class: 'cart-r' },
            h('div', { class: 'cart-sum' }, items.length ? `商品 ${yen(goods)} ＋ 送料 ${yen(SHIPPING_FEE)}` : `送料 ${yen(SHIPPING_FEE)}／回（最大${ORDER_MAX_BOXES}箱）`),
            h('div', {}, '合計', h('span', { class: 'muted small' }, '（送料込み）'), total, h('span', { class: 'muted small' }, ` ／ 所持金 ${yen(st.money)}`)),
            orderBtn)));
      } else if (tab === 'rep') {
        body.append(repPanel(st));
      } else if (tab === 'staff') {
        // 従業員 No.1〜10。お店のレベルが上がると1人ずつ雇える。はやさは5段階、得意な仕事はレジか品出し
        const wages = st.staff.reduce((t, o) => t + (o.wage || 0), 0);
        const tagged = st.fixtures.reduce((n, f) => n + (f.s ? f.s.filter((x) => x[0]).length : 0), 0);
        const labels = st.fixtures.reduce((n, f) => n + (f.lb ? f.lb.filter(Boolean).length : 0), 0);
        body.append(h('div', { class: 'wage-total' }, `💴 人件費 1日 ${yen(wages)}`, h('span', { class: 'muted small' }, `（${st.staff.length}人・閉店のときに払います）`)),
          h('p', { class: 'muted small' }, `雇える人 ${staffLimit(st.level)} / ${STAFF_MAX}人（お店 Lv.5 から1人ずつ増える）。はやさは「とても遅い〜とても早い」の5段階で、1人ひとりに得意な仕事（🧾レジ／📦品出し）があります。得意でない仕事もできますが、はやさが${Math.round(OFF_ROLE * 100)}%になります。品出し係は値札のついた棚（いま${tagged}か所）に補充し、届いた段ボールはラベルの貼ってある倉庫棚の段（いま${labels}段）にしまいます。`));
        const bar = (k) => h('span', { class: 'spdbar' }, h('i', { style: { width: Math.round(k / 2 * 100) + '%' } }));
        const r = mulberry32(st.day * 7919 + st.staff.length * 31);
        for (const sl of STAFF_SLOTS) {
          const s = st.staff.find((o) => o.slot === sl.no);
          const open = st.level >= sl.lv, sp = SPEEDS[sl.spd], fav = STAFF_ROLES[sl.role];
          const head = h('div', { class: 'slot-h' }, h('b', {}, `${sp.icon} No.${sl.no}「${sp.name}」`), h('span', { class: 'favb ' + sl.role }, `得意：${fav.icon}${fav.name}`), bar(s ? staffK(s) : sp.k));
          if (s) {
            const R = STAFF_ROLES[s.role];
            body.append(h('div', { class: 'scard' }, head,
              h('div', { class: 'row between' }, h('span', {}, `${R.icon} ${s.name}さん（${R.name}${s.role === s.fav ? '・得意！' : '・苦手'}）`,
                h('button', { class: 'btn tiny ghost', title: '名前を変える', onclick: async () => { const v = await promptBox('✏️ 従業員の名前（10文字まで）', s.name, { max: 10, placeholder: '名前' }); if (v) { g.act({ t: 'staffName', sid: s.id, name: v }); setTimeout(draw, 150); } } }, '✏️')),
                h('span', { class: 'muted small' }, `日給 ${yen(s.wage)}`),
                h('button', { class: 'btn small ghost', onclick: async () => { if (await confirmBox(`${s.name}さんを解雇しますか？（もう一度雇うこともできます）`, '解雇')) { g.act({ t: 'fire', sid: s.id }); setTimeout(draw, 150); } } }, '解雇')),
              h('div', { class: 'roles' }, Object.entries(STAFF_ROLES).map(([k, d]) => h('button', { class: 'role' + (s.role === k ? ' on' : ''), onclick: () => { g.act({ t: 'staffRole', sid: s.id, role: k }); setTimeout(draw, 150); } }, `${d.icon} ${d.name}${k === s.fav ? ' ⭐得意' : ''}`))),
              h('div', { class: 'muted small' }, R.desc)));
          } else if (open) {
            const name = (this._hireNames ||= {})[sl.no] ?? STAFF_NAMES[Math.floor(r() * STAFF_NAMES.length)], seed = Math.floor(r() * 1e9);
            const nameInp = h('input', { class: 'inp name-inp', value: name, maxlength: 10, placeholder: '名前' });
            nameInp.oninput = () => { this._hireNames[sl.no] = nameInp.value; };
            body.append(h('div', { class: 'scard free' }, head,
              h('div', { class: 'row name-row' }, h('span', { class: 'muted small' }, '✏️ 名前'), nameInp, h('span', { class: 'muted small' }, `さん（${sp.name}・${fav.name}が得意）が働きたがっています`)),
              h('div', { class: 'roles' }, h('button', { class: 'role hire', onclick: () => {
                const nm = nameInp.value.trim();
                if (!nm) { toast('名前を入れてね', 'warn'); nameInp.focus(); return; }
                delete this._hireNames[sl.no];
                g.act({ t: 'hire', name: nm, seed, slot: sl.no }); setTimeout(draw, 150);
              } }, `${fav.icon} ${fav.name}として雇う（日給${yen(staffWage(sl.spd))}）`))));
          } else {
            body.append(h('div', { class: 'scard locked' }, head, h('div', { class: 'muted small' }, `🔒 お店 Lv.${sl.lv} で雇えるようになります（日給 ${yen(staffWage(sl.spd))}）`)));
          }
        }
      } else if (tab === 'store') {
        const fee = st.playFee ?? 0;
        body.append(
          h('div', { class: 'pc-stats' }, stat('総売上', yen(st.totalSales)), stat('来店客数', st.totalCustomers + '人'), stat('評判', '⭐' + repStars(st.rep).toFixed(1)), stat('営業時間', `8:00〜${fmtTime(closeTime())}`),
            stat('開けたパック', (st.stats?.packs || 0) + '個'), stat('売れたシングル', (st.stats?.cardsSold || 0) + '枚'), stat('対戦したお客さん', (st.stats?.played || 0) + '人'), stat('レジの台数', `最大${checkoutLimit(st.level)}台`)),
          h('div', { class: 'ed-label' }, '🎮 プレイテーブルの利用料（1回）'),
          h('div', { class: 'row' },
            h('button', { class: 'btn small ghost', onclick: () => { g.act({ t: 'playFee', v: fee - 50 }); setTimeout(draw, 150); } }, '−50'),
            h('b', { class: 'fee' + (fee > PLAY_FEE_MAX ? ' bad' : '') }, yen(fee)),
            h('button', { class: 'btn small ghost', onclick: () => { g.act({ t: 'playFee', v: fee + 50 }); setTimeout(draw, 150); } }, '+50'),
            h('span', { class: 'muted small' }, `${yen(PLAY_FEE_MAX)}より高いとお客さんは遊んでくれません`)),
          h('div', { class: 'ed-label' }, '🏷 商品の値段をまとめて変える'),
          h('div', { class: 'row wrap' }, [[1, '🔄 全部 相場どおり'], [1.1, '相場の110%'], [1.2, '相場の120%（上限）'], [0.9, '相場の90%（お買い得）']].map(([k, t]) => h('button', { class: 'btn small ghost', onclick: () => { g.act({ t: 'priceAll', k }); setTimeout(draw, 150); } }, t))),
          h('div', { class: 'row' },
            h('button', { class: 'btn', onclick: async () => { const v = await promptBox('お店の名前', st.name, { max: 16 }); if (v) g.act({ t: 'storeName', v }); setTimeout(draw, 150); } }, '✏️ 店名を変える'),
          ),
          h('div', { class: 'ed-label' }, 'お店のテーマカラー'),
          h('div', { class: 'swatches' }, ['#e8322b', '#ff6b35', '#f2b705', '#2a9d8f', '#3a86ff', '#1d4ed8', '#7b2cbf', '#ff70a6', '#06d6a0', '#495057'].map((c) =>
            h('button', { class: 'sw' + (st.color === c ? ' on' : ''), style: { background: c }, onclick: () => { g.act({ t: 'storeName', v: st.name, c }); setTimeout(draw, 150); } }))));
      }
    };
    const m = modal('📋 マネージャーボード', [body], { wide: true, cls: 'pcm', onClose: () => this.closed() });
    tabs.classList.add('head-tabs'); m.el.querySelector('.modal-head').insertBefore(tabs, m.el.querySelector('.modal-head .x'));
    this.opened(m); draw();
    this._redraw = draw;
    this._live = () => { if (tab === 'order' || tab === 'rep') draw(); }; // 在庫・配送中・口コミは開いたままでも新しく
  }
  refresh() { this._redraw && this.open && this._redraw(); }
  // ---------- 評判と口コミ（どこにいても見られる） ----------
  openRep() {
    const g = this.g, body = h('div', { class: 'pc-body tab-rep' });
    const draw = () => { const keep = body.querySelector('.rv-list')?.scrollTop || 0; body.innerHTML = ''; body.append(repPanel(g.store)); const l = body.querySelector('.rv-list'); if (l) l.scrollTop = keep; };
    const m = modal('💬 評判と口コミ', [body], { wide: true, cls: 'pcm rep', onClose: () => this.closed() });
    this.opened(m); draw();
    this._redraw = draw; this._live = draw;
  }

  openPrice(pid) {
    const g = this.g, p = PRODUCTS[pid];
    const draw = () => { m.body.innerHTML = ''; m.body.append(priceRow(g, g.store, p, true, draw, true, stockMap(g.store))); };
    const m = modal(`🏷 値札：${p.icon} ${p.name}`, [], { onClose: () => this.closed() });
    this.opened(m); draw();
  }
  // 看板の文字（と色）を変える
  openText(fid) {
    const g = this.g, f = g.store.fixtures.find((o) => o.id === fid);
    if (!f) return;
    const def = FIXTURES[f.t];
    const colorable = ['hangsign', 'banner', 'neon'].includes(f.t);
    const COLORS = f.t === 'neon' ? ['#ff4fd8', '#4fd8ff', '#ffe14f', '#5dff7a', '#ff6b4f', '#b77bff', '#ffffff'] : ['#ffffff', '#e63946', '#ff7a1a', '#f2b705', '#2a9d8f', '#1d6fd1', '#6a4c93', '#2b2d42'];
    let col = f.c || COLORS[0];
    const inp = h('input', { class: 'inp', value: (f.tx || '').replace(/\n/g, '/'), maxlength: 24, placeholder: '例：本日のおすすめ' });
    const sw = h('div', { class: 'swatches' });
    const drawSw = () => { sw.innerHTML = ''; for (const c of COLORS) sw.append(h('button', { class: 'sw' + (c === col ? ' on' : ''), title: c === '#ffffff' && f.t !== 'neon' ? 'お店の色' : c, style: { background: c === '#ffffff' && f.t !== 'neon' ? (g.store.color || '#ff6b35') : c }, onclick: () => { col = c; drawSw(); } })); };
    drawSw();
    const ok = () => { g.act({ t: 'text', fid, v: inp.value.trim().replace(/\//g, '\n'), c: colorable ? col : undefined }); m.close(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
    const m = modal(`${def.icon} ${def.name}の文字`, [
      h('div', { class: 'muted small' }, '文字は24文字まで。「/」で改行できます'), inp,
      colorable ? h('div', { class: 'muted small' }, f.t === 'neon' ? '光の色' : '看板の色（左はお店の色）') : null, colorable ? sw : null,
      h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: ok }, '決定'))], { onClose: () => this.closed() });
    this.opened(m);
    setTimeout(() => inp.focus(), 60);
  }
  opened(m) { if (this.open && this.open !== m) { const o = this.open; this.open = null; try { o.close(); } catch (e) { /* noop */ } } this.open = m; this.g.setUIBlock(true); }
  closed() { this.open = null; this._redraw = null; this._live = null; this.g.setUIBlock(false); }
  // 開いている画面を新しくする（さわっている最中は待つ：ボタンが作り直されて押せなくならないように）。新しくできたら true
  live() {
    if (!this.open || !this._live) return true;
    if (!this._touchWatch) { this._touchWatch = true; const t = () => { this._touchT = performance.now(); }; for (const ev of ['pointerdown', 'pointerup', 'wheel', 'touchmove']) document.addEventListener(ev, t, { capture: true, passive: true }); }
    if (performance.now() - (this._touchT || 0) < 900) return false;
    this._live(); return true;
  }
  closeAll() { document.querySelectorAll('.cardview-ov').forEach((x) => x.remove()); if (this.open) { const o = this.open; this.open = null; o.close(); } }

  // ---------- 店舗拡張ボード ----------
  openExpand() {
    const g = this.g;
    const body = h('div');
    const draw = () => {
      const st = g.store, tg = Object.fromEntries(expandTargets(st).map((t) => [t.id, t]));
      body.innerHTML = '';
      const cell = (id, label, cls) => {
        const t = tg[id], owned = !t;
        const btn = h('button', { class: 'xcell ' + cls + (owned ? ' owned' : t.can ? ' can' : ' locked') },
          h('b', {}, label), h('span', {}, owned ? '✅ 使用中' : t.can ? `¥${t.cost.toLocaleString()}` : '🔒 となりから'));
        if (!owned && t.can) btn.onclick = async () => {
          if (await confirmBox(`${label}を ¥${t.cost.toLocaleString()} で購入しますか？`, '購入')) { g.act({ t: 'expand', id }); setTimeout(draw, 150); }
        };
        return btn;
      };
      const grid = h('div', { class: 'xgrid' });
      // 上が奥・下が入口側。左8列が売り場、右の列が倉庫（奥へ広げられる）とパソコン室
      const cols = `repeat(${SALES.cols}, 1fr) 1.7fr`;
      for (let r = SALES.rows - 1; r >= 0; r--) {
        const row = h('div', { class: 'xrow' }); row.style.gridTemplateColumns = cols;
        for (let c = 0; c < SALES.cols; c++) row.append(cell('b' + c + r, `売り場 ${String.fromCharCode(65 + c)}${SALES.rows - r}`, 'bay'));
        const s = stockAt(0, r);
        row.append(s ? cell(s.id, s.name, 'stock') : h('div', { class: 'xcell office' }, h('b', {}, '💻 パソコン室'), h('span', {}, 'ボード類')));
        grid.append(row);
      }
      const street = h('div', { class: 'xrow street' }); street.style.gridTemplateColumns = cols;
      street.append(h('div', { class: 'xstreet', style: { gridColumn: `1 / ${SALES.cols}` } }, '🚶 歩道'), h('div', { class: 'xstreet door' }, '🚪 入口'), h('div', { class: 'xstreet' }, '🚚 右に搬入口'));
      grid.append(street);
      body.append(h('p', { class: 'muted small' }, `所持金 ${'¥' + st.money.toLocaleString()}　／　売り場は左と奥へ、倉庫は奥へ、いま使っている区画のとなりから1区画ずつ広げられます（買うたびに値上がり）`), grid);
    };
    const m = modal('🗺️ 店舗拡張ボード', body, { wide: true, onClose: () => this.closed() });
    this.opened(m); draw();
    this._redraw = draw;
  }
  // ---------- レベル：いまのレベルと、これからできるようになること ----------
  openLevel() {
    const st = this.g.store, body = h('div', { class: 'lv-body' });
    const maxed = st.level >= MAX_LEVEL;
    body.append(h('div', { class: 'lv-now' }, h('b', {}, `🏪 お店 Lv.${st.level}${maxed ? ' MAX' : ''}`),
      h('div', { class: 'bar big' }, h('i', { style: { width: (maxed ? 100 : Math.min(100, st.xp / xpNeed(st.level) * 100)) + '%' } })),
      h('span', { class: 'muted small' }, maxed ? '最高レベルです！' : `次のレベルまで ${(xpNeed(st.level) - st.xp).toLocaleString()} XP（売上 ¥50 ごとに 1XP）`)));
    const list = h('div', { class: 'lv-list' });
    for (let lv = 2; lv <= MAX_LEVEL; lv++) {
      const u = unlocksAt(lv); if (!u.length) continue;
      list.append(h('div', { class: 'lv-row' + (lv <= st.level ? ' done' : lv === st.level + 1 ? ' next' : '') }, h('span', { class: 'lv-n' }, lv <= st.level ? '✅' : `Lv.${lv}`),
        h('div', { class: 'lv-u' }, u.map((x) => h('span', { class: 'chip small k-' + x.k }, x.icon + ' ' + x.name)))));
    }
    body.append(list);
    const m = modal('⭐ お店のレベル（最大50）', body, { wide: true, onClose: () => this.closed() });
    this.opened(m);
    requestAnimationFrame(() => list.querySelector('.next')?.scrollIntoView({ block: 'center' }));
  }
  // ---------- バインダー（カードのコレクション・相場） ----------
  openBinder(opts = {}) {
    const g = this.g;
    let sid = opts.sid || this._bSid || 1, mode = opts.tab || 'cards', filter = this._bFilter || 'all';
    const body = h('div', { class: 'binder' });
    const tabs = h('div', { class: 'tabs head-tabs' });
    const draw = () => {
      const st = g.store;
      this._bSid = sid; this._bFilter = filter;
      tabs.innerHTML = '';
      tabs.append(h('button', { class: 'tab' + (mode === 'cards' ? ' on' : ''), onclick: () => { mode = 'cards'; draw(); } }, '📒 コレクション'),
        h('button', { class: 'tab' + (mode === 'market' ? ' on' : ''), onclick: () => { mode = 'market'; draw(); } }, '📈 相場'),
        h('button', { class: 'tab' + (mode === 'rates' ? ' on' : ''), onclick: () => { mode = 'rates'; draw(); } }, '🎲 封入率'));
      const keep = body.querySelector('.bgrid')?.scrollTop || 0;
      body.innerHTML = '';
      const all = collectionStats(st);
      if (mode === 'rates') {
        body.append(h('div', { class: 'rates' },
          h('p', {}, `1パック${PACK_SIZE}枚入り。封入率は「1枚ごとの独立判定」で、5枚それぞれが下の確率で決まります（1BOXは${BOX_PACKS}パック＝${PACK_SIZE * BOX_PACKS}枚）。`),
          h('div', { class: 'rate-list' }, CARD_RATES.slice().reverse().map(([r, p]) => h('div', { class: 'rate-row' }, h('span', { class: 'rar r-' + r }, r), h('span', {}, RARITY[r].name), h('b', {}, p + '%'),
            h('span', { class: 'muted small' }, `1パックで約${(100 * (1 - Math.pow(1 - p / 100, PACK_SIZE))).toFixed(1)}%・1BOXに平均${(p / 100 * PACK_SIZE * BOX_PACKS).toFixed(1)}枚`))),
            h('div', { class: 'rate-row' }, h('span', { class: 'rar flash' }, '✨'), h('span', {}, 'フラッシュ（箔付き）'), h('b', {}, FLASH_RATE + '%'), h('span', { class: 'muted small' }, `どのレア度にも付く。カードが輝き、相場は${FLASH_MULT}倍`))),
          h('p', { class: 'muted small' }, 'HR（ハイパーレア）はSSRのカードをレインボーに、UR（ウルトラレア）はSSRのカードをゴールドに加工した特別なカードです。レアなカードほど高く売れます。'),
          h('p', { class: 'muted small' }, `カードの相場は毎日少しずつ変わります。シングルはカードテーブルなどに並べて売れます（相場の+20%まで）。いらないカードは買取業者に相場の${Math.round(BUYBACK * 100)}%で売れます。`)));
        return;
      }
      // 弾のタブ
      const stabs = h('div', { class: 'tabs scroll small' });
      for (const se of SERIES) { const cs = collectionStats(st, se.id); stabs.append(h('button', { class: 'tab' + (se.id === sid ? ' on' : ''), style: { '--sc': se.color }, onclick: () => { sid = se.id; draw(); } }, `${se.code} ${se.name}`, h('span', { class: 'tcount' }, ` ${cs.have}/${cs.total}`))); }
      const se = SERIES_BY[sid], cs = collectionStats(st, sid);
      const owned = Object.values(st.cards || {}).reduce((a, b) => a + b, 0);
      const head = h('div', { class: 'bhead' },
        h('div', {}, h('b', {}, `第${se.id}弾「${se.name}」`), h('span', { class: 'muted small' }, ` ${se.theme}・お店 Lv.${se.lv} から入荷`)),
        h('div', { class: 'bstat' }, `図鑑 ${cs.have}/${cs.total}`, h('span', { class: 'muted small' }, `　全体 ${all.have}/${all.total}種類・手持ち ${owned}枚`)));
      body.append(stabs, head);
      if (mode === 'cards') {
        const fl = h('div', { class: 'row wrap small' }, [['all', 'すべて'], ['have', '持っている'], ['dup', 'ダブり'], ['missing', '未入手']].map(([k, t]) => h('button', { class: 'chip btnchip' + (filter === k ? ' on' : ''), onclick: () => { filter = k; draw(); } }, t)),
          h('button', { class: 'btn tiny ghost', onclick: async () => { if (await confirmBox(`第${se.id}弾の N・R のダブり（1枚は残す）を買取業者にまとめて売りますか？（相場の${Math.round(BUYBACK * 100)}%）`, '売る')) { g.act({ t: 'sellDupes', maxR: 'R', s: sid }); setTimeout(draw, 150); } } }, '💱 N・Rのダブりを売る'));
        body.append(fl);
        const grid = h('div', { class: 'bgrid' });
        for (const c of CARDS_LIST.filter((x) => x.s === sid)) {
          const n = st.cards?.[c.id] || 0, reg = !!st.dex?.[c.id], shown = displayedCount(st, c.id);
          const nfl = st.cards?.[c.id + 'f'] || 0;
          if (filter === 'have' && !n && !nfl) continue; if (filter === 'dup' && n < 2 && nfl < 2) continue; if (filter === 'missing' && reg) continue;
          if (!reg) { grid.append(h('div', { class: 'bslot missing' }, h('div', { class: 'bq' }, '？'), h('div', { class: 'bno' }, `${String(c.no).padStart(3, '0')} ${c.r}`))); continue; }
          const el = cardEl(c.id, { size: 112, count: n, dim: !n, onClick: () => this.openCardView(c.id, draw) });
          grid.append(h('div', { class: 'bslot' }, el, h('div', { class: 'bno' }, `${yen(cardValue(st, c.id))}${shown ? ` 🃏${shown}` : ''}`)));
          // フラッシュも持っていれば、となりに並べる
          const fk = c.id + 'f', nf = st.cards?.[fk] || 0, sf = displayedCount(st, fk);
          if ((nf || sf) && filter !== 'missing' && (filter !== 'dup' || nf >= 2)) grid.append(h('div', { class: 'bslot' }, cardEl(fk, { size: 112, count: nf, dim: !nf, onClick: () => this.openCardView(fk, draw) }), h('div', { class: 'bno' }, `✨${yen(cardValue(st, fk))}${sf ? ` 🃏${sf}` : ''}`)));
        }
        if (!grid.children.length) grid.append(h('p', { class: 'muted' }, 'カードがありません。パックを開けよう！'));
        body.append(grid);
        requestAnimationFrame(() => { grid.scrollTop = keep; });
      } else {
        // 相場：この弾のカードを高い順に
        const rows = CARDS_LIST.filter((x) => x.s === sid).sort((a, b) => cardValue(st, b.id) - cardValue(st, a.id));
        const tbl = h('div', { class: 'bgrid market' }, rows.map((c) => {
          const v = cardValue(st, c.id), pv = cardValuePrev(st, c.id), d = pv ? (v - pv) / pv * 100 : 0, reg = !!st.dex?.[c.id];
          return h('div', { class: 'mrow', onclick: reg ? () => this.openCardView(c.id, draw) : null },
            h('span', { class: 'rar r-' + c.r }, c.r), h('span', { class: 'mn' }, reg ? c.name : '？？？'), h('b', {}, yen(v)),
            h('span', { class: 'trend ' + (d > 0.5 ? 'up' : d < -0.5 ? 'down' : 'flat') }, d > 0.5 ? `▲${d.toFixed(0)}%` : d < -0.5 ? `▼${Math.abs(d).toFixed(0)}%` : '→'),
            h('span', { class: 'muted small' }, `手持ち ${st.cards?.[c.id] || 0}${st.cards?.[c.id + 'f'] ? `（✨${st.cards[c.id + 'f']}）` : ''}・✨${yen(cardValue(st, c.id + 'f'))}`));
        }));
        body.append(tbl);
      }
    };
    const m = modal('📒 バインダー', [body], { wide: true, cls: 'pcm binderm', onClose: () => this.closed() });
    m.el.querySelector('.modal-head').insertBefore(tabs, m.el.querySelector('.modal-head .x'));
    this.opened(m); draw();
    this._redraw = draw;
  }
  // カード1枚を大きく見る（値段・買取）
  openCardView(cid, after) {
    const g = this.g, st = g.store, c = CARDS[cid];
    const n = st.cards?.[cid] || 0;
    const ov = h('div', { class: 'cardview-ov' });
    const close = () => { ov.remove(); after?.(); };
    const acts = [
      h('button', { class: 'btn small', onclick: () => { close(); this.openCardPrice(cid); } }, `🏷 売値 ${yen(cardPrice(st, cid))}`),
      n > 0 ? h('button', { class: 'btn small ghost', onclick: async () => { if (await confirmBox(`${c.flash ? '✨フラッシュの' : ''}${c.name}（${c.r}）を1枚、買取業者に ${yen(buybackPrice(st, cid))} で売りますか？`, '売る')) { g.act({ t: 'cardSell', cid, n: 1 }); close(); } } }, `💱 買取 ${yen(buybackPrice(st, cid))}`) : null,
      h('span', { class: 'muted small' }, `手持ち ${n}枚・並べている ${displayedCount(st, cid)}枚`),
      h('button', { class: 'btn small ghost', onclick: close }, '閉じる'),
    ];
    ov.append(cardDetail(st, cid, { actions: acts }));
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    $('#modals').append(ov);
  }
  // カードテーブルに置くカードを選ぶ
  openCardPicker(fid, ci) {
    const g = this.g;
    let sid = this._pSid || 0, sort = this._pSort || 'value';
    const body = h('div', { class: 'picker' });
    const draw = () => {
      const st = g.store;
      this._pSid = sid; this._pSort = sort;
      body.innerHTML = '';
      const tabs = h('div', { class: 'tabs scroll small' }, h('button', { class: 'tab' + (!sid ? ' on' : ''), onclick: () => { sid = 0; draw(); } }, 'すべて'),
        SERIES.map((se) => h('button', { class: 'tab' + (se.id === sid ? ' on' : ''), onclick: () => { sid = se.id; draw(); } }, se.code)),
        h('button', { class: 'tab' + (sort === 'value' ? ' on' : ''), onclick: () => { sort = sort === 'value' ? 'no' : 'value'; draw(); } }, sort === 'value' ? '💴 高い順' : '🔢 番号順'));
      const list = Object.entries(st.cards || {}).filter(([cid, n]) => n > 0 && CARDS[cid] && (!sid || CARDS[cid].s === sid)).map(([cid]) => cid);
      list.sort(sort === 'value' ? (a, b) => cardValue(st, b) - cardValue(st, a) : (a, b) => (CARDS[a].s - CARDS[b].s) || (CARDS[a].no - CARDS[b].no));
      const grid = h('div', { class: 'bgrid' }, list.length ? list.map((cid) => h('div', { class: 'bslot' },
        cardEl(cid, { size: 104, count: st.cards[cid], onClick: () => { g.act({ t: 'cardPut', fid, ci, cid }); m.close(); } }),
        h('div', { class: 'bno' }, yen(cardPrice(st, cid))))) : h('p', { class: 'muted' }, 'カードを持っていません。パックやBOXを開けてカードを手に入れよう！'));
      body.append(tabs, grid);
    };
    const m = modal('🃏 並べるカードを選ぶ', [body], { wide: true, cls: 'pcm', onClose: () => this.closed() });
    this.opened(m); draw();
  }
  // おまかせ陳列
  openAutoDisplay(fid) {
    const g = this.g, f = g.store.fixtures.find((o) => o.id === fid); if (!f) return;
    const empty = f.cs.filter((x) => !x).length;
    const m = modal('🃏 おまかせ陳列', [
      h('p', {}, `空いている枠（${empty}枠）に、持っているカードを高い順に並べます。`),
      h('div', { class: 'col' },
        h('button', { class: 'btn', onclick: () => { g.act({ t: 'cardAuto', fid }); m.close(); } }, '🔁 ダブったカードだけ並べる（1枚ずつは手元に残す）'),
        h('button', { class: 'btn ghost', onclick: () => { g.act({ t: 'cardAuto', fid, minR: 'SR' }); m.close(); } }, '✨ SR以上のダブりだけ並べる'),
        h('button', { class: 'btn ghost', onclick: () => { g.act({ t: 'cardAuto', fid, all: true }); m.close(); } }, '📦 持っているカードを全部の候補にする'),
        h('button', { class: 'btn danger ghost', onclick: () => { g.act({ t: 'cardClear', fid }); m.close(); } }, '↩ 並べたカードを全部回収する'))], { onClose: () => this.closed() });
    this.opened(m);
  }
  // シングルカードの値段
  openCardPrice(cid) {
    const g = this.g, c = CARDS[cid];
    const draw = () => {
      const st = g.store, cur = cardPrice(st, cid), mk = cardValue(st, cid), lim = cardLimit(st, cid), auto = st.cprices?.[cid] == null;
      const set = (v) => { g.act({ t: 'cardPrice', cid, v: v === 'market' ? 'market' : Math.max(1, Math.round(v)) }); setTimeout(draw, 120); };
      const step = cur >= 10000 ? 500 : cur >= 1000 ? 100 : 10;
      const mood = cur > lim ? ['🚫 高すぎて売れません', 'bad'] : cur / mk <= 0.9 ? ['😍 お買い得', 'good'] : cur / mk <= 1 ? ['🙂 ふつう（よく売れる）', 'ok'] : ['🤔 少し高め（まだ売れる）', 'warn'];
      m.body.innerHTML = '';
      m.body.append(h('div', { class: 'cprice' }, cardEl(cid, { size: 120, interactive: true }),
        h('div', { class: 'pinfo' }, h('div', { class: 'pn' }, `${c.flash ? '✨' : ''}${c.name}（${c.r}${c.flash ? '・フラッシュ' : ''}）${auto ? ' 🔄' : ''}`),
          h('div', { class: 'muted small' }, `相場 ${yen(mk)} ／ 売れる上限 ${yen(lim)} ／ 買取 ${yen(buybackPrice(st, cid))}`),
          h('div', { class: 'pmood ' + mood[1] }, mood[0] + (auto ? '（相場に自動で合わせ中）' : '')),
          h('div', { class: 'pctl' }, h('button', { onclick: () => set(cur - step) }, '−'), h('b', {}, yen(cur)), h('button', { onclick: () => set(cur + step) }, '＋')),
          h('div', { class: 'row wrap' }, h('button', { class: 'btn small' + (auto ? '' : ' ghost'), onclick: () => set('market') }, '🔄 相場に合わせる'),
            [[0.9, '−10%'], [1.1, '+10%'], [1.2, '+20%（上限）']].map(([k, t]) => h('button', { class: 'btn small ghost', onclick: () => set(Math.floor(mk * k)) }, t))))));
    };
    const m = modal('🏷 シングルの値段', [], { onClose: () => this.closed() });
    this.opened(m); draw();
  }
  // 倉庫棚のラベルを選ぶ
  openLabelPicker(fid, si) {
    const g = this.g, st = g.store, f = st.fixtures.find((o) => o.id === fid); if (!f) return;
    const cur = f.lb?.[si];
    const pick = (pid, all) => { g.act({ t: 'rackLabel', fid, si, pid, all }); m.close(); };
    const sm = stockMap(st, g.sim?.dyn);
    let allMode = false;
    const items = PRODUCTS_LIST.filter((p) => productUnlocked(p.id, st.level)).map((p) => h('button', { class: 'lbl-item' + (p.id === cur ? ' on' : ''), onclick: () => pick(p.id, allMode) },
      prodThumb(p, true), h('span', {}, p.name), h('small', { class: 'muted' }, `在庫 ${(sm.get(p.id)?.back || 0)}`)));
    const allBtn = h('button', { class: 'chip btnchip', onclick: () => { allMode = !allMode; allBtn.classList.toggle('on', allMode); } }, 'この棚の全部の段に貼る');
    const grid = h('div', { class: 'lbl-grid' }, items);
    const m = modal('🏷 倉庫棚のラベル', [h('p', { class: 'muted small' }, '品出し係は、ラベルの貼ってある段にだけその商品の段ボールを置きます。届いた段ボールを片付けてもらうには、商品ごとにラベルを貼っておこう'),
      h('div', { class: 'row' }, allBtn, cur ? h('button', { class: 'btn small ghost', onclick: () => pick(null) }, 'ラベルをはがす') : null), grid], { wide: true, onClose: () => this.closed() });
    this.opened(m);
  }
  // パック開封の演出
  showPackOpening(e) {
    const g = this.g;
    this.closeAll();
    this.packOpen = true; g.setUIBlock(true);
    const held = () => g.held();
    const canMore = () => { const b = held(); return b && b.n > 0 && seriesOfProduct(b.p) === e.s && (e.kind === 'pack' ? isPack(b.p) : isBoosterBox(b.p)); };
    packOpening(e, {
      sfx: (n) => g.app.sfx.play(n),
      onClose: () => { this.packOpen = false; g.setUIBlock(false); },
      onMore: canMore() ? () => { this.packOpen = false; g.setUIBlock(false); g.act({ t: 'openPack' }); } : null,
      moreLabel: e.kind === 'pack' ? `もう1パック開ける（のこり${(held()?.n || 0)}）` : `もう1BOX開ける（のこり${(held()?.n || 0)}）`,
    });
  }
  // ---------- ポーズ ----------
  openPause() {
    const g = this.g;
    const m = modal('⏸ メニュー', [
      h('div', { class: 'col' },
        h('button', { class: 'btn big', onclick: () => m.close() }, '▶ 再開'),
        h('button', { class: 'btn ghost', onclick: () => { m.close(); this.openBinder(); } }, '📒 バインダー（カードのコレクション）'),
        h('button', { class: 'btn ghost', onclick: () => { m.close(); this.openLevel(); } }, '⭐ レベルとできるようになること'),
        h('button', { class: 'btn ghost', onclick: () => { m.close(); this.openRep(); } }, '💬 評判と口コミ'),
        h('div', { class: 'muted small', style: { textAlign: 'center' } }, '📋 発注・従業員・🗺️ 店舗拡張は、パソコン室（入口の右）のボードの前でできます。📒 バインダー（C）と 💬 評判（Tab）はいつでも見られます'),
        h('button', { class: 'btn ghost', onclick: () => { m.close(); g.app.openSettingsInGame(); } }, '⚙️ 設定'),
        h('button', { class: 'btn ghost', onclick: () => { m.close(); g.help(); } }, '❓ 遊び方'),
        g.roomId ? h('div', { class: 'chip' }, `ルームID：${g.roomId}`) : null,
        h('button', { class: 'btn danger', onclick: async () => { m.close(); if (await confirmBox(g.mode === 'client' ? 'ルームから退出しますか？' : '保存してメニューに戻りますか？', '戻る')) g.app.endGame(); } }, g.mode === 'solo' ? '💾 保存してメニューへ' : '🚪 退出する')),
    ], { onClose: () => this.closed() });
    this.opened(m);
  }
  showSummary(d, isHost) {
    const g = this.g;
    const row = (k, v, cls) => h('div', { class: 'sum-row ' + (cls || '') }, h('span', {}, k), h('b', {}, v));
    const income = d.sales + (d.vend || 0) + (d.recycle || 0) + (d.buyback || 0), cost = d.orders + (d.ship || 0) + d.wages + d.bills;
    const mx = Math.max(1, income, cost);
    const bar = (v, cls) => h('div', { class: 'sum-bar' }, h('i', { class: cls, style: { width: Math.round(v / mx * 100) + '%' } }));
    const diff = d.prevProfit == null ? null : d.profit - d.prevProfit;
    const left = h('div', { class: 'sum-col' },
      h('div', { class: 'sum-h' }, '💰 収入'), bar(income, 'plus'),
      row('売上', '+' + yen(d.sales), 'plus'), d.cardSales ? row('　うちシングル', yen(d.cardSales), 'sub') : null, d.playSales ? row('　うちプレイ料金', yen(d.playSales), 'sub') : null,
      d.buyback ? row('カード買取', '+' + yen(d.buyback), 'plus') : null, d.vend ? row('自販機', '+' + yen(d.vend), 'plus') : null, d.recycle ? row('リサイクル', '+' + yen(d.recycle), 'plus') : null,
      h('div', { class: 'sum-h' }, '💸 支出'), bar(cost, 'minus'),
      row('仕入れ', '−' + yen(d.orders), 'minus'), d.ship ? row('送料', '−' + yen(d.ship), 'minus') : null, row('人件費', '−' + yen(d.wages), 'minus'), row('光熱費・家賃', '−' + yen(d.bills), 'minus'),
      h('div', { class: 'sum-total ' + (d.profit >= 0 ? 'plus' : 'minus') }, h('span', {}, '本日の利益'), h('b', {}, (d.profit >= 0 ? '+' : '−') + yen(Math.abs(d.profit)))),
      diff == null ? null : h('div', { class: 'muted small right' }, `前日比 ${diff >= 0 ? '▲ +' : '▼ −'}${yen(Math.abs(diff))}`),
      row('所持金', yen(d.money)));
    const nameOf = (k) => (k.startsWith('c:') ? (CARDS[k.slice(2)] ? `${CARDS[k.slice(2)].name}（${CARDS[k.slice(2)].r}）` : null) : PRODUCTS[k]?.name);
    const iconOf = (k) => (k.startsWith('c:') ? '🃏' : PRODUCTS[k]?.icon);
    const top = (d.top || []).filter(([p]) => nameOf(p));
    const right = h('div', { class: 'sum-col' },
      h('div', { class: 'sum-h' }, '🏆 よく売れた商品'),
      top.length ? h('div', { class: 'sum-top' }, top.map(([p, [n, rev]], i) => h('div', { class: 'sum-item' }, h('span', { class: 'rk' }, ['🥇', '🥈', '🥉'][i] || (i + 1) + '.'), h('span', { class: 'ic' }, iconOf(p)),
        h('span', { class: 'nm' }, nameOf(p)), h('span', { class: 'muted small' }, `${n}個`), h('b', {}, yen(rev))))) : h('p', { class: 'muted small' }, '今日は何も売れませんでした…'),
      h('div', { class: 'sum-h' }, '📈 お店の様子'),
      row('お会計したお客さん', d.served + '人'), d.packs ? row('開けたパック', d.packs + '個') : null, row('怒って帰ったお客さん', d.lost + '人', d.lost ? 'minus' : ''), row('獲得経験値', d.xp + ' XP'), row('評判', `⭐ ${repStars(d.rep).toFixed(1)}` + (d.repPrev != null ? `（${d.rep >= d.repPrev ? '▲' : '▼'}${Math.abs(repStars(d.rep) - repStars(d.repPrev)).toFixed(1)}）` : ''), d.repPrev != null && d.rep < d.repPrev ? 'minus' : ''),
      (() => { const rv = d.rv || [0, 0, 0, 0, 0], n = rv.reduce((a, b) => a + b, 0); return n ? row('今日の評価', `★${(rv.reduce((a, c, i) => a + c * (i + 1), 0) / n).toFixed(1)}（${n}人）`) : null; })(),
      row('お店のレベル', 'Lv.' + d.level + (d.level >= MAX_LEVEL ? ' MAX' : '')));
    const body = [
      h('div', { class: 'sum-big' }, `${d.day}日目 おつかれさま！`),
      h('div', { class: 'sum-grid' }, left, right),
      isHost ? h('button', { class: 'btn big', onclick: () => { m.close(); g.act({ t: 'nextDay' }); } }, `☀️ 次の日へ（${d.day + 1}日目）`) : h('p', { class: 'muted center' }, 'ホストが次の日を始めるのを待っています…'),
    ];
    const m = modal('📊 本日の収支', body, { wide: true, cls: 'summary', noClose: isHost, onClose: () => this.closed() });
    this.opened(m);
    this.summaryModal = m;
  }
  closeSummary() { if (this.summaryModal) { try { this.summaryModal.close(); } catch (e) { /* noop */ } this.summaryModal = null; } }

  // ---------- レジ ----------
  updateReg(r, fid) {
    if (!r) { this.reg.classList.add('hidden'); this._regKey = ''; this.reg.innerHTML = ''; return; }
    this.reg.classList.remove('hidden');
    const key = JSON.stringify([fid, r.ph, r.b, r.pay, r.q, this._change]);
    if (key === this._regKey) return;
    this._regKey = key;
    const g = this.g, R = this.reg;
    R.innerHTML = '';
    const scanned = r.b.filter((x) => x[1]).length, sum = r.b.filter((x) => x[1]).reduce((s, x) => s + x[2], 0);
    R.append(h('div', { class: 'reg-head' }, h('span', {}, '🧾 レジ'), h('span', { class: 'muted' }, `待ち ${Math.max(0, (r.q || 0) - (r.cu != null ? 1 : 0))}人`),
      h('button', { class: 'btn small ghost', onclick: () => g.leaveRegister() }, '離れる')));
    if (r.ph === 'idle') { R.append(h('div', { class: 'reg-msg' }, 'お客さんを待っています…')); this._change = 0; return; }
    R.append(h('div', { class: 'reg-total' }, h('span', {}, `${scanned}/${r.b.length}点`), h('b', {}, yen(sum))));
    if (r.ph === 'scan') {
      R.append(h('div', { class: 'reg-msg' }, 'ベルトの商品をタップしてスキャン！'), h('button', { class: 'btn big', onclick: () => g.scanNext() }, '📡 次をスキャン'));
      this._change = 0;
    } else if (r.ph === 'pay') {
      const p = r.pay;
      if (p.m === 'card') {
        R.append(h('div', { class: 'reg-msg' }, '💳 カード払い'), h('div', { class: 'reg-card' }, `お会計 ${yen(p.total)}`),
          h('button', { class: 'btn big', onclick: () => g.act({ t: 'pay', fid, change: 0 }) }, '決済する'));
      } else {
        const need = p.given - p.total;
        this._change ||= 0;
        const cur = h('b', { class: this._change === need ? 'ok' : '' }, yen(this._change));
        const coins = [1, 5, 10, 50, 100, 500, 1000, 5000];
        R.append(h('div', { class: 'reg-msg' }, `💴 現金 ${yen(p.given)} お預かり`),
          h('div', { class: 'reg-change' }, h('span', {}, `おつり ${yen(need)} を渡そう`), cur),
          h('div', { class: 'coins' }, coins.map((c) => h('button', { class: 'coin' + (c >= 1000 ? ' bill' : ''), onclick: () => { this._change += c; g.app.sfx.play('coin'); this._regKey = ''; this.updateReg(r, fid); } }, c >= 1000 ? `${c}円札` : `${c}`))),
          h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => { this._change = 0; this._regKey = ''; this.updateReg(r, fid); } }, 'やり直し'),
            h('button', { class: 'btn', onclick: () => { g.act({ t: 'pay', fid, change: this._change }); this._change = 0; } }, '渡す')));
      }
    }
  }
  // ---------- 建築 ----------
  showBuild(open, sel, onPick, mv = null) {
    this.build.classList.toggle('hidden', !open);
    this.build.classList.toggle('moving', !!(open && mv));
    if (!open) return;
    const st = this.g.store;
    // 設備を動かしている間は、カタログではなく小さな案内バーだけ出す
    if (mv) {
      const key = 'mv|' + mv.type;
      if (this._bKey !== key) {
        this._bKey = key;
        const def = FIXTURES[mv.type];
        const B = this.build; B.innerHTML = '';
        this._bStatus = h('div', { class: 'mv-status' });
        const press = (id) => () => this.g.input.edges.add(id);
        B.append(h('div', { class: 'mv-bar' },
          h('div', { class: 'mv-title' }, `🔧 ${def.icon} ${def.name}を移動中`),
          h('div', { class: 'muted small' }, '置きたい場所の床を見てね'),
          this._bStatus,
          h('div', { class: 'row' },
            h('button', { class: 'btn small ghost', onclick: press('alt') }, '🔄 回転'),
            h('button', { class: 'btn small', onclick: press('act') }, '✅ ここに移動'),
            h('button', { class: 'btn small ghost', onclick: press('box') }, '✖ やめる'))));
      }
      if (this._bStatus) {
        const t = mv.ok ? '🟢 ここに置けます' : '🔴 ' + (mv.why || 'ここには置けません');
        if (this._bStatus.textContent !== t) { this._bStatus.textContent = t; this._bStatus.classList.toggle('ng', !mv.ok); }
      }
      return;
    }
    const key = JSON.stringify([sel, st.money, st.level, this._bcat, this._thumbRev || 0]);
    if (key === this._bKey) return;
    this._bKey = key;
    this._bcat ||= 'shelf'; if (!FIXTURE_CATS[this._bcat]) this._bcat = 'shelf';
    const B = this.build; B.innerHTML = '';
    const tabs = h('div', { class: 'tabs scroll small' });
    for (const [k, n] of Object.entries(FIXTURE_CATS)) tabs.append(h('button', { class: 'tab' + (k === this._bcat ? ' on' : ''), onclick: () => { this._bcat = k; this._bKey = ''; this.showBuild(true, sel, onPick); } }, n));
    const items = h('div', { class: 'bitems' });
    const R = this.g.R, need = [];
    for (const [id, f] of Object.entries(FIXTURES)) {
      if (f.cat !== this._bcat || f.fixed) continue;
      const ok = fixtureUnlocked(id, st.level);
      const url = R?.thumbUrl?.(id, st.color);
      if (url === null && R?.thumbUrl && !R._thumbs?.has(id + '|' + st.color)) need.push(id);
      const slots = f.slots ? f.slots.length : 0;
      items.append(h('button', { class: 'bitem' + (sel === id ? ' on' : '') + (ok ? '' : ' locked'), title: f.desc || '', onclick: () => ok ? onPick(id) : toast(`お店 Lv.${f.lv} で買えるようになります`, 'warn') },
        url ? h('img', { class: 'bthumb', src: url, alt: f.name }) : h('span', { class: 'bi' }, f.icon),
        h('span', { class: 'bn' }, f.name), slots ? h('span', { class: 'bs' }, `${slots}枠`) : f.boxSlots ? h('span', { class: 'bs' }, `${f.boxSlots.length}箱`) : f.cards ? h('span', { class: 'bs' }, `${f.cards.length}枚`) : f.seats ? h('span', { class: 'bs' }, `${f.seats.length}人`) : null,
        h('span', { class: 'bp' }, ok ? yen(f.price) : `🔒 Lv.${f.lv}`)));
    }
    // 見た目の画像はあとから少しずつ作る（できたら差し替え）
    if (need.length) R.requestThumbs(need, st.color, () => { this._thumbRev = (this._thumbRev || 0) + 1; if (!this.build.classList.contains('hidden') && !this.build.classList.contains('moving')) this.showBuild(true, sel, onPick); });
    B.append(h('div', { class: 'build-head' }, h('b', {}, '🔨 建築モード'), h('span', { class: 'muted small' }, '設備を選んで置く／置いてある棚・レジを狙って「移動」「売却」'), h('button', { class: 'btn small ghost', onclick: () => this.g.toggleBuild(false) }, '終了')), tabs, items);
  }

  // ---------- チャット ----------
  openChat() {
    const g = this.g;
    const inp = h('input', { class: 'inp', maxlength: 60, placeholder: 'メッセージ（60文字まで）' });
    const send = (t) => { t = (t || '').trim(); if (!t) return; g.sendChat(t); inp.value = ''; m.close(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(inp.value); });
    const log = h('div', { class: 'chat-full' }, ...(this._chatHist || []).map((c) => chatLine(c)));
    const m = modal('💬 ルームチャット', [log, h('div', { class: 'presets' }, CHAT_PRESETS.map((p) => h('button', { class: 'chip btnchip', onclick: () => send(p) }, p))),
      h('div', { class: 'row' }, inp, h('button', { class: 'btn', onclick: () => send(inp.value) }, '送信'))], { onClose: () => this.closed() });
    this.opened(m);
    setTimeout(() => { log.scrollTop = 1e6; inp.focus(); }, 30);
  }
  addChat(c) {
    (this._chatHist ||= []).push(c); if (this._chatHist.length > 50) this._chatHist.shift();
    const line = chatLine(c);
    this.chatLog.append(line);
    while (this.chatLog.children.length > 5) this.chatLog.firstChild.remove();
    setTimeout(() => line.classList.add('fade'), 9000);
  }
}
function chatLine(c) { return h('div', { class: 'cline' }, h('b', {}, (c.n || '???') + '：'), document.createTextNode(String(c.m || '').slice(0, 60))); }
const stat = (k, v) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, String(v)));

// 在庫：棚に並んでいる数と、倉庫など（段ボールの中）にある数
// 商品ごとの在庫：棚に並んでいる数＋段ボールの中の数（倉庫・店の前・手に持っている箱も）。配送中の分は別に
function stockMap(st, dyn) {
  const m = new Map();
  const get = (p) => { let e = m.get(p); if (!e) { e = { shelf: 0, back: 0, boxes: 0, coming: 0 }; m.set(p, e); } return e; };
  for (const f of st.fixtures) if (f.s) for (const [p, n] of f.s) if (p && PRODUCTS[p] && n > 0) get(p).shelf += n;
  for (const b of st.boxes) if (b.n > 0 && PRODUCTS[b.p]) { const e = get(b.p); e.back += b.n; e.boxes++; }
  for (const d of dyn?.deliveries || []) for (const [p, n, half] of d.items || []) if (PRODUCTS[p]) get(p).coming += n * (half ? halfQty(p) : PRODUCTS[p].qty);
  return m;
}
// 在庫の合計はいつも全部見えるように（せまい画面では内訳のほうを省略する）
function stockLine(sm, pid) {
  const e = sm.get(pid);
  const coming = e?.coming ? h('span', { class: 'coming' }, `🚚+${e.coming}`) : null;
  if (!e || (!e.shelf && !e.back)) return h('div', { class: 'pstock none' }, h('span', { class: 'tot' }, '在庫 0'), coming);
  const det = `棚${e.shelf}・箱${e.back}${e.boxes ? `（${e.boxes}箱）` : ''}`;
  return h('div', { class: 'pstock', title: `在庫 ${e.shelf + e.back}：${det}` }, h('span', { class: 'tot' }, `在庫 ${e.shelf + e.back}`), coming, h('span', { class: 'det' }, det));
}
// 相場の上下を表示
function trend(st, pid) {
  const now = marketPrice(st, pid), prev = st.marketPrev?.[pid];
  if (!prev || prev === now) return h('span', { class: 'trend flat' }, '→');
  const d = (now - prev) / prev * 100;
  return h('span', { class: 'trend ' + (d > 0 ? 'up' : 'down') }, `${d > 0 ? '▲' : '▼'}${Math.abs(d).toFixed(0)}%`);
}
// ---------- 評判（口コミ）パネル ----------
function repPanel(st) {
  const stars = repStars(st.rep), f = customerFactors(st);
  const starBar = (v) => h('span', { class: 'stars' }, h('span', { class: 'stars-bg' }, '★★★★★'), h('span', { class: 'stars-fg', style: { width: (v / 5 * 100) + '%' } }, '★★★★★'));
  const rv = st.today?.rv || [0, 0, 0, 0, 0], n = rv.reduce((a, b) => a + b, 0), mx = Math.max(1, ...rv);
  const dist = h('div', { class: 'rv-dist' }, [5, 4, 3, 2, 1].map((s) => h('div', { class: 'rv-row' }, h('span', {}, '★' + s), h('div', { class: 'sum-bar' }, h('i', { class: s >= 4 ? 'plus' : s <= 2 ? 'minus' : '', style: { width: Math.round(rv[s - 1] / mx * 100) + '%' } })), h('b', {}, rv[s - 1]))));
  const x = (v) => '×' + v.toFixed(2).replace(/0$/, '');
  const left = h('div', { class: 'rv-col' },
    h('div', { class: 'rv-big' }, h('b', {}, stars.toFixed(1)), starBar(stars)),
    h('div', { class: 'muted small' }, `評判 ${Math.round(st.rep)}/100（お客さんの評価の平均）`),
    h('div', { class: 'sum-h' }, `📅 今日の評価 ${n ? '（' + n + '人）' : ''}`), n ? dist : h('p', { class: 'muted small' }, 'まだ評価がありません（営業するとお客さんが評価します）'),
    h('div', { class: 'sum-h' }, '🚶 お客さんの来やすさ'),
    h('div', { class: 'rv-fac' },
      h('div', {}, `⭐ 評判 ${x(f.rep)}`), h('div', {}, `🏪 お店のレベル ${x(f.lv)}`), h('div', {}, `📐 売り場の広さ ${x(f.size)}`), f.attract > 1 ? h('div', {}, `✨ お客さんを呼ぶ設備 ${x(f.attract)}`) : null,
      h('div', { class: 'rv-total' }, `合計 ${x(f.rep * f.lv * f.size * f.attract)}`)),
    h('div', { class: 'muted small' }, '評判が上がる：品切れなし・お手ごろな値段・レジが早い・品揃えが多い・シングルが買える・対戦できる・装飾。下がる：品切れ・高すぎる値段・レジ待ち・通路の空き段ボール'));
  const list = (st.reviews || []).length ? (st.reviews || []).map((r) => h('div', { class: 'rv-item' + (r.s <= 2 ? ' bad' : r.s >= 5 ? ' good' : '') },
    h('div', { class: 'rv-head' }, h('span', { class: 'rv-s' }, '★'.repeat(r.s) + '☆'.repeat(5 - r.s)), h('span', { class: 'muted small' }, `${r.d}日目 ${fmtTime(r.t)}`)),
    h('div', { class: 'rv-m' }, '「' + r.m + '」'))) : [h('p', { class: 'muted small' }, 'まだ口コミはありません')];
  const right = h('div', { class: 'rv-col' }, h('div', { class: 'sum-h' }, '💬 最近の口コミ'), h('div', { class: 'rv-list' }, list));
  return h('div', { class: 'rv-grid' }, left, right);
}
function priceRow(g, st, p, stocked, redraw, big, sm) {
  const cur = getPrice(st, p.id), mk = marketPrice(st, p.id), cost = marketCost(st, p.id), lim = priceLimit(st, p.id);
  const auto = st.prices[p.id] == null;
  const ratio = cur / mk;
  // 上限（相場の+20%）までは必ず売れる。それより高いと売れない
  const mood = cur > lim ? ['🚫 高すぎて売れません', 'bad'] : ratio <= 0.9 ? ['😍 お買い得', 'good'] : ratio <= 1.0 ? ['🙂 ふつう（よく売れる）', 'ok'] : ['🤔 少し高め（まだ売れる）', 'warn'];
  const set = (v) => { g.act({ t: 'price', pid: p.id, v: v === 'market' ? 'market' : Math.max(1, Math.round(v)) }); setTimeout(redraw, 120); };
  const step = cur >= 1000 ? 50 : 10;
  const nice = (v) => (v >= 1000 ? Math.round(v / 10) * 10 - 20 : Math.round(v / 10) * 10 - 2);
  const e = sm?.get(p.id);
  return h('div', { class: 'prow' + (big ? ' big' : '') },
    h('div', { class: 'pe' }, p.icon),
    h('div', { class: 'pinfo' }, h('div', { class: 'pn' }, p.name + (stocked ? '' : ' （未陳列）') + (auto ? ' 🔄' : '')),
      h('div', { class: 'muted small' }, `相場 ${yen(mk)} `, trend(st, p.id), ` ／ 仕入 ${yen(cost)} ／ 利益 ${yen(cur - cost)} ／ 売れる上限 ${yen(lim)}`),
      h('div', { class: 'pmood ' + mood[1] }, mood[0] + (auto ? '（相場に自動で合わせ中）' : ''), e ? h('span', { class: 'pstock inl' }, ` 在庫 ${e.shelf + e.back}（棚${e.shelf}・箱${e.back}）`) : null)),
    h('div', { class: 'pctl' },
      h('button', { onclick: () => set(cur - step) }, '−'), h('b', {}, yen(cur)), h('button', { onclick: () => set(cur + step) }, '＋')),
    big ? h('div', { class: 'row wrap' },
      h('button', { class: 'btn small ghost', onclick: () => set(nice(mk * 0.9)) }, '相場−10%'), h('button', { class: 'btn small' + (auto ? '' : ' ghost'), onclick: () => set('market') }, '🔄 相場に合わせる'),
      h('button', { class: 'btn small ghost', onclick: () => set(nice(mk * 1.1)) }, '+10%'), h('button', { class: 'btn small ghost', onclick: () => set(nice(mk * 1.2)) }, '+20%')) : null);
}
// 発注画面などの商品の絵（パック・BOXは本物の絵）
function prodThumb(p, small) {
  if (p.series) {
    const isBox = p.cat === 'box', W = isBox ? 100 : 60, H = 100 * (isBox ? 0.6 : 1);
    const c = h('canvas', { class: 'pthumb' + (isBox ? ' box' : '') + (small ? ' sm' : '') }); c.width = W * 2; c.height = H * 2;
    const draw = (src) => { const g2 = c.getContext('2d'); g2.clearRect(0, 0, c.width, c.height); g2.drawImage(src, 0, 0, c.width, c.height); };
    draw(isBox ? boxCanvas(p.series, 'front', 500, 300, draw) : packCanvas(p.series, 300, draw));
    return c;
  }
  return h('div', { class: 'pe' + (small ? ' sm' : '') }, p.icon);
}
export { escapeText };
