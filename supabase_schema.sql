-- =====================================================
-- 収支管理システム Supabase スキーマ
-- =====================================================

-- 会社マスタ
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 会社ユーザー紐付け（役割: admin / member）
CREATE TABLE company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- 中項目マスタ（会社ごと・大項目ごと）
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  large_category TEXT NOT NULL CHECK (large_category IN ('売上内訳', '販売原価', '販管費')),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, large_category, name)
);

-- 月次エントリー（実際の入力データ）
CREATE TABLE monthly_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,           -- 例: '2025-04'
  amount BIGINT,                      -- 金額（NULL=未入力）
  amount_type TEXT NOT NULL DEFAULT 'free' CHECK (amount_type IN ('fixed', 'free')),
  status TEXT DEFAULT NULL,           -- 'そのまま' | '変更' | '質問・未計上' | NULL
  note TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, category_id, year_month)
);

-- =====================================================
-- RLS (Row Level Security) ポリシー
-- =====================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_entries ENABLE ROW LEVEL SECURITY;

-- 自分が所属する会社のみ参照可能
CREATE POLICY "所属会社のみ参照" ON companies
  FOR SELECT USING (
    id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "所属確認" ON company_users
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "所属会社のカテゴリ参照" ON categories
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "所属会社のエントリー参照" ON monthly_entries
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

-- adminのみ会社ユーザー管理
CREATE POLICY "admin のみ会社ユーザー追加" ON company_users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_id = company_users.company_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- =====================================================
-- サンプルデータ（初期セットアップ後に実行）
-- =====================================================

-- 会社を追加する場合（管理者がSupabaseダッシュボードから実行）
-- INSERT INTO companies (name, slug) VALUES ('会社名', 'company-slug');

-- カテゴリを追加する場合
-- INSERT INTO categories (company_id, large_category, name, sort_order) VALUES
--   ('<company_id>', '売上内訳', '小計（電子決済）', 1),
--   ('<company_id>', '売上内訳', '小計（現金）', 2),
--   ('<company_id>', '販売原価', '仕入原価（飲料類）', 1),
--   ('<company_id>', '販管費', '家賃', 1);
