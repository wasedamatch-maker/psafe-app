# 心理的安全性トラッカー（psafe-app）

大学の授業（4クラス × 各4班）で、班メンバー同士の「心理的安全性」を毎週記録する Web アプリ。
個人の生の値は本人にしか見せず、班・クラスには「ばらつき」だけを集計して見せる設計。

- 技術：Next.js（App Router）+ TypeScript + Supabase
- 公開：Vercel（GitHub連携で自動デプロイ）

## 画面

| パス | 用途 |
|---|---|
| `/` | 学生用の入力画面 |
| `/admin` | 運営用の管理画面（パスワード不要） |
| `/demo` | 体験用ダミー画面（本番データに影響しない） |

## セットアップ（ローカルで動かす）

```bash
# 1. コードを取得
git clone https://github.com/<アカウント>/psafe-app.git
cd psafe-app

# 2. 依存関係をインストール
npm install

# 3. 接続鍵を設定
cp .env.example .env.local
#   → .env.local を開いて Supabase の URL と anon キーを入れる
#   （Supabase → Project Settings → API から取得）

# 4. 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 を開く。

## 環境変数

`.env.example` を参照。必要なのは以下2つ（どちらも公開して安全な anon キー）：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> ⚠️ `service_role` キーは絶対にコード / Git に入れないこと。このアプリでは使いません。

## データベース

Supabase のSQL Editor で、この順に実行するとDBを再現できます：

1. `db/schema.sql` … テーブル・RLS・学生向け集計関数・初期データ
2. `db/admin_functions.sql` … 管理画面用のRPC関数（実行前に `admin_reset_semester` のパスワードを変更）

## デプロイ

`main` ブランチに `git push` すると Vercel が自動でビルド・公開します（1〜2分）。

## 引き継ぎ

運用を引き継ぐ場合は **[HANDOFF.md](./HANDOFF.md)** を参照（GitHub / Vercel / Supabase の譲渡手順つき）。
