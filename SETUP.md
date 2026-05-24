# 収支管理システム セットアップ手順

## ① Supabase プロジェクト作成

1. https://supabase.com にアクセスしてログイン（Googleアカウント可）
2. 「New Project」をクリック
3. プロジェクト名を入力（例：`yojitsu-kanri`）
4. データベースパスワードを設定（メモしておく）
5. リージョンを「Northeast Asia (Tokyo)」に設定
6. 「Create new project」をクリック（約1分待つ）

## ② DBテーブル作成

1. Supabaseダッシュボードの左メニューから「SQL Editor」を開く
2. `supabase_schema.sql` の内容を全てコピーして貼り付け
3. 「Run」をクリック

## ③ 環境変数の設定

1. Supabaseダッシュボードの左メニューから「Settings」→「API」を開く
2. 以下の値をメモ：
   - **Project URL**（例：`https://xxxxxxxxxxxx.supabase.co`）
   - **anon/public key**（長い文字列）

3. `yojitsu-kanri` フォルダの中に `.env.local` というファイルを作成
4. 以下を貼り付けて保存：

```
NEXT_PUBLIC_SUPABASE_URL=（Project URLを貼り付け）
NEXT_PUBLIC_SUPABASE_ANON_KEY=（anon keyを貼り付け）
```

## ④ 最初のユーザー作成（管理者）

1. Supabaseダッシュボードの「Authentication」→「Users」→「Add user」
2. メールアドレスとパスワードを設定
3. 「SQL Editor」で以下を実行：

```sql
-- 会社を追加
INSERT INTO companies (name, slug) VALUES ('（会社名）', '（英数字スラッグ例：my-company）');

-- ユーザーを管理者として会社に追加
INSERT INTO company_users (company_id, user_id, role)
VALUES (
  '（上で作った会社のID）',
  '（ユーザーのID）',
  'admin'
);
```

※ IDはSupabaseダッシュボードのテーブルから確認できます

## ⑤ アプリ起動

```bash
cd yojitsu-kanri
npm run dev
```

ブラウザで http://localhost:3000 を開く

## ⑥ Vercelへのデプロイ（公開する場合）

1. https://vercel.com にログイン
2. 「New Project」→ GitHubのリポジトリを選択
3. Environment Variables に `.env.local` と同じ内容を追加
4. Deploy

---

## 操作方法

### 収支の入力
1. トップページで月を選択
2. 「入力画面へ」をクリック
3. 「+ 項目追加」から中項目を追加
4. 金額欄に数値を入力（フォーカスを外すと自動保存）

### 固定/フリー切り替え
- 🔓 フリー：毎月金額を入力する項目
- 🔒 固定：毎月同じ金額の項目（翌月コピー時に金額も引き継ぎ）

### ステータス
- ステータス列をクリックで切り替え
  - `—` → `そのまま` → `変更` → `質問・未計上` → `—`

### 翌月へコピー
- 「翌月へコピー」ボタンで今月の項目構成を翌月に複製

### Excel出力
- 「Excel出力」ボタンで .xlsx ファイルをダウンロード

### 複数会社の切り替え
- ヘッダーの会社名ドロップダウンからワンクリックで切り替え
