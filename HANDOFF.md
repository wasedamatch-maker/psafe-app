# 引き継ぎ書（HANDOFF）

心理的安全性トラッカーの運用を引き継ぐ人のための資料です。プログラミング未経験でも読めるように書いています。

---

## 1. これは何か

大学の授業（4クラス × 各4班）で、班メンバー同士の「心理的安全性」を毎週（水曜）記録し、
**個人の生の値は本人にしか見せず、班・クラスには「ばらつき」だけを見せる** Webアプリ。

- 学生用の入力画面：`/`（トップ）
- 運営用の管理画面：`/admin`（パスワード不要）
- 体験用のダミー画面：`/demo`（本番データに影響しない、操作感を試す用）

---

## 2. 3つのサービスの関係（重要）

このアプリは3つの外部サービスで成り立っています。1つでも欠けると動きません。

```
   [GitHub]  ──コードを保存──►  [Vercel]  ──公開──►  本番サイト
   ソースコード                自動デプロイ          psafe-app.vercel.app
                                    │
                                    │ 接続鍵(.env)
                                    ▼
                               [Supabase]
                               データベース（学生の記録）
```

| サービス | 役割 | 現在の場所 |
|---|---|---|
| **GitHub** | ソースコードの保管 | `github.com/wasedamatch-maker/psafe-app` |
| **Vercel** | サイトの公開・自動デプロイ | `psafe-app.vercel.app` |
| **Supabase** | データベース（記録の保存） | Supabaseダッシュボード上のプロジェクト |

- GitHub に `git push` すると、Vercel が自動でビルドして本番に反映（1〜2分）。
- Vercel は Supabase の URL と anon キーを**環境変数**として持っている（`.env.example` 参照）。

---

## 3. 環境変数（接続鍵）

必要なのは2つだけ。どちらも**公開して安全な**キーです（`.env.example` に名前だけ記載）。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

取得場所：Supabase → Project Settings → API。
**★ `service_role` キーは絶対に GitHub / コードに入れないこと。** このアプリは使っていません。

---

## 4. データベースの中身（Supabase）

- テーブル：`classes`（クラス4）/ `teams`（班16）/ `participants`（匿名ユーザ）/ `responses`（記録）
- `responses.scores` は長さ7の整数配列（各 -50〜50、0=中央）。個人メモ `memo` は本人しか読めない（RLS）。
- 集計は **SECURITY DEFINER 関数**経由のみ。生データを返す経路は作らない設計。

DBを一から作り直す場合は、Supabase の SQL Editor で**この順に**実行：

1. `db/schema.sql` … テーブル・RLS・学生向け集計関数・初期データ（クラス4×班4）
2. `db/admin_functions.sql` … 管理画面(/admin)用のRPC関数6つ
   - ★ `admin_reset_semester` の中の `CHANGE_ME_RESET_PASSWORD` を必ず自分のパスワードに変更する

---

## 5. よくある運用作業

- **クラス名・班名の変更**：`/admin` 画面から編集できる。
- **学期のリセット**（記録を全消去）：`/admin` のリセット欄でパスワードを入力。パスワードは `db/admin_functions.sql` の `admin_reset_semester` に設定されている値。
- **コードを直したい**：ローカルで直して `git push` → Vercel が自動反映。手順は README.md 参照。

---

## 6. ★ 譲渡チェックリスト（新アカウントへ完全譲渡する手順）

> 譲渡・招待は本人ログインが必要な Web 操作です。上から順に。

### 📌 現在の進捗（ここから再開）
- **方針**：全部を新GitHubアカウントへ完全譲渡。運用者は未定。
- **決定事項**：Supabase は **既存プロジェクトをそのまま渡す**（データそのまま・鍵そのまま・Vercel環境変数の変更不要）。
- **完了済み（Part A / リポジトリ準備）**：`db/schema.sql` `db/admin_functions.sql` `.env.example` `HANDOFF.md` `README.md` を追加・コミット済み（commit `d9a76d3`、現リポジトリにpush済み）。
- **未完了（Part B / 要Web操作）**：GitHub譲渡・Vercel再連携・Supabaseメンバー招待は未着手。
- **再開に必要な入力**：**新しいGitHubアカウントのユーザー名**（まだ未確定）。
- **次の一手**：ユーザー名が決まったら下の (1) GitHub譲渡 から順に実施。譲渡後、ローカルのリモートURL付け替え（`git remote set-url origin ...`）をアシスタントに依頼する。


### (1) GitHub リポジトリの譲渡
- [ ] `github.com/wasedamatch-maker/psafe-app` → **Settings** → 一番下 **Danger Zone**
- [ ] **Transfer ownership** → 新しいアカウントのユーザー名を入力して実行
- [ ] 新アカウント側で届いた招待を **Accept**（承認）
- [ ] 譲渡後のURL：`github.com/<新アカウント>/psafe-app`
- [ ] ローカルのリモートを付け替え：
      `git remote set-url origin https://github.com/<新アカウント>/psafe-app.git`

### (2) Vercel の再連携
- [ ] 新オーナーが**新しいGitHubアカウント**で Vercel にログイン
- [ ] **Import Project** で `psafe-app` を取り込む
- [ ] 環境変数2つを設定（`.env.example` の通り）
- [ ] Deploy して本番URLが表示されるか確認
- [ ] 旧Vercelプロジェクトは、新デプロイ確認後に削除

### (3) Supabase の引き継ぎ（推奨：既存プロジェクトをそのまま渡す）
- [ ] Supabase Dashboard → Organization → **Members** → 新アカウントを **Owner** で招待
- [ ] 利点：学生の既存データがそのまま残り、鍵も変わらない＝Vercel環境変数の変更不要
- [ ] （代替）まっさらな新プロジェクトにする場合：新規作成 → `db/schema.sql` → `db/admin_functions.sql` を実行 → 新URL/anon鍵を Vercel 環境変数に貼り替え（※データは移らない）

### (4) 動作確認
- [ ] 本番の `/`（学生入力）・`/admin`（管理）・`/demo`（体験）が開く
- [ ] `/admin` の「提出状況」「偏り」テーブルにデータが出る（＝RPC関数が存在する証拠）
