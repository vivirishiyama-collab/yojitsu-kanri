-- =====================================================
-- メモの固定/変動フラグ（note_type）を追加するマイグレーション
-- 実行場所: Supabase ダッシュボード > SQL Editor
-- 目的: メモを「固定」にすると、翌月へメモが自動コピーされる
--       （金額の amount_type と同じ仕組みをメモにも適用）
-- =====================================================

ALTER TABLE monthly_entries
  ADD COLUMN IF NOT EXISTS note_type TEXT NOT NULL DEFAULT 'free'
  CHECK (note_type IN ('fixed', 'free'));
