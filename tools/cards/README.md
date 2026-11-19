# カードデータとイラストの作り方（開発用）

ゲームを遊ぶだけならこのフォルダは不要です（`js/carddata.js` と `img/mon/*.webp` は作成ずみ）。
アニモンの図鑑を変えたときなどに、カードを作り直すための道具です。Node.js 18 以降と、イラスト作成には Playwright（Chrome）が必要です。

| ファイル | 内容 |
|---|---|
| `dump_species.mjs` | アニモンの図鑑データ（`js/data/species.js`）を `species.json` に書き出す |
| `packs_lines.json` | どの進化系統をどの弾に入れるか（8弾で全250種） |
| `series.mjs` | 弾の名前・色・値段・解放レベルと、レア度の割り当て（たね→N、途中の進化→R、強い最終進化→SR/SSR） |
| `gen_cards.mjs` | `js/carddata.js` を作る（HP・技・弱点・相場など） |
| `make_jobs.mjs` / `render.mjs` / `portrait.html` | アニモンの3Dモデルをヘッドレス Chrome で撮影（ふつうの絵と、SSR用の色ちがいの絵） |
| `convert.py` | 撮影した PNG の余白を切って WebP に変換（Pillow） |

```bash
node dump_species.mjs <アニモンのフォルダ> species.json
node gen_cards.mjs <アニモンのフォルダ> ../../js/carddata.js
node make_jobs.mjs ../../img/mon          # まだない絵だけ撮影リストに入れる
python3 -m http.server 8765 --directory <アニモンとportrait.htmlを置いたフォルダ> &
node render.mjs 8765 jobs_all.json ./out
python3 convert.py ./out ../../img/mon
```
