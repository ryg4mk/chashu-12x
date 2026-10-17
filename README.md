# チャーシューメン、チャーシュー12倍

GitHub Pages で動く、HTML/CSS/JavaScript だけの無料ブラウザゲームです。外部ライブラリ、画像素材、通信、ビルドは不要です。

## 遊び方

1. 「ゲームスタート」を押します。
2. 左右に動くチャーシューを見て、画面をタップ／クリック／スペースキーで落とします。
3. ラーメンの上に積み、12枚以上を目指します。3回はみ出すと終了です。
4. 最高記録はブラウザ内（localStorage）に保存されます。

## GitHub Pages 公開

1. `index.html`, `style.css`, `game.js` をリポジトリ直下に置きます。
2. GitHub の `Settings` → `Pages` → `Build and deployment` で `Deploy from a branch` を選択します。
3. `main` / `/(root)` を選んで保存します。
4. 公開ページ: https://ryg4mk.github.io/chashu-12x/

## 主なファイル

- `index.html`: UI
- `style.css`: スマホ対応レイアウト
- `game.js`: Canvas 描画・判定・記録保存

MIT License. 商用利用・改変可。詳細は LICENSE を参照してください。
