-- =====================================================
-- 月次の「確定/先入力(見込)」フラグを保存するテーブルを追加
-- 実行場所: Supabase ダッシュボード > SQL Editor
-- 目的: 年間サマリーで、確定済みの月だけの合計（確定分合計）を表示し、
--       まだ確定していない先入力の月と区別できるようにする
-- =====================================================

CREATE TABLE IF NOT EXISTS monthly_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,               -- 例: '2026-08'
  confirmed BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE=確定済み / FALSE=先入力(見込)
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, year_month)
);

ALTER TABLE monthly_status ENABLE ROW LEVEL SECURITY;

-- 所属会社のみ参照・更新可（他テーブルと同じ方針）
CREATE POLICY "所属会社の月次ステータス" ON monthly_status
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );
