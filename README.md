# ヒストリカル・トレード

いつの相場かわからない過去の1年で、日米欧の株と暗号資産を売買して腕を競う投資ゲームです。

- 日経225・S&P500・EURO STOXX 50 の構成銘柄、主要な暗号資産、各指数の連動 ETF（約790銘柄）
- 価格は「円換算 → 開始日の終値=100 の指数」で表示し、ランク戦では終了まで実日付・実価格を出さない
- 翌営業日の始値で約定（指値は値幅で判定）、手数料・スプレッド・為替手数料、年内損益通算の税、配当
- 全銘柄を均等に買い持ちしたベンチマークとの差（%ポイント）がスコア。月間シーズンの平均でランキング
- ランク戦の放棄は「その時点の成績」と「-20pt」の低い方で確定（放棄で得をしない）
- 練習モードは期間を選べて、実日付・実価格も表示できる（ランキング対象外）

ルールの全文はアプリの `/rules` にあります。

## 技術構成

Next.js 16（App Router）/ TypeScript / Postgres + Drizzle / Auth.js（Google・GitHub）/ lightweight-charts / Vitest / Playwright

```
src/lib/engine/   純粋TSのゲームエンジン（DB非依存・ユニットテストの中心）
src/lib/game/     サーバー側：シナリオの作成・進行・注文・終了処理と、クライアント向けの表示データ
src/app/api/      Route Handlers（入力は zod で検証）
src/config/game.ts  初期資金・コスト・税率などの設定
scripts/import/   市場データの取り込み（DataProvider で差し替え可能）
```

公平性のため、シナリオの状態と未来の価格はすべてサーバーが持ちます。クライアントには「k 日目」と指数だけを返し、
実日付・実価格・指数化の基準値は `isRevealed`（ランク戦の終了後、または練習モードで表示を選んだとき）のときだけ付けます。

## ローカルで動かす

```bash
npm install
cp .env.example .env.local   # DATABASE_URL などを設定
cp .env.local .env           # スクリプト（drizzle-kit・取り込み）も同じ設定を読む
npm run db:migrate

# 指数構成銘柄の一覧（universe.json はコミット済み。構成変更時だけ再生成）
npm run import:universe

# 市場データの取り込み（全銘柄で数十分・約400万行。再実行すると差分だけ更新）
npm run import:data
npm run import:data -- --symbols AAPL,7203.T,BTC-USD   # 一部だけ

npm run dev
```

OAuth を設定しなくても、`.env.local` に `AUTH_DEV_LOGIN=1` を入れると名前だけで入れるテストログインが使えます
（Vercel 上では常に無効）。

## テスト

```bash
npm run lint && npm run typecheck && npm test
PW_CHROMIUM=/path/to/chromium npm run test:e2e   # 開発サーバーを自動で起動。データ取り込み済みのDBが必要
```

E2E はランク戦を最初から最後まで通し、終了前の API レスポンスに実日付や基準値が含まれないことも確認します。

## 既知の制約

- **データのライセンス**：取り込みは Yahoo Finance（非公式 API）で、再配布はできません。開発・身内公開専用です。
  一般公開の前に、再配布可能な有料データ源の `DataProvider` を `scripts/import/providers/` に追加して切り替えてください。
- **PER・PBR**：過去時点の決算データを無料で取れないため、テーブルと表示だけ用意してあり、現在は「—」になります。
  `DataProvider.fetchFundamentals` を実装したデータ源に切り替えると埋まります（決算発表日より前の数字は出しません）。
- **生存者バイアス**：銘柄は現在の指数構成銘柄です。`index_memberships` は期間（from/to）を持てるので、
  当時の構成銘柄を出せるデータ源に切り替えたときに移行できます。
- **DB 容量**：全銘柄 2005年〜で約430MB。Neon の無料枠（0.5GB）にはほぼ収まりません。有料プランにするか、
  `--from` で取り込み開始年を遅らせてください。
- 先物（証拠金・レバレッジ・ショート）は第2段階です。`AssetKind` に `future` を用意してあります。
