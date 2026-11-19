-- =====================================================
-- ① 管理画面から期首月(fiscal_year_start_month)を変更できるようにする
-- ② company_users の INSERT ポリシーの穴を塞ぐ
--    （旧ポリシーは自己参照で条件が常に真になり、
--      どこか1社の admin なら任意の会社に自分を追加できた）
-- 実行場所: Supabase ダッシュボード > SQL Editor（全文をそのまま Run）
-- =====================================================

-- 期首月の列（既にあれば何もしない）
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS fiscal_year_start_month INT NOT NULL DEFAULT 1
  CHECK (fiscal_year_start_month BETWEEN 1 AND 12);

-- RLS の中で company_users を参照すると再帰するため、判定は SECURITY DEFINER 関数で行う
CREATE OR REPLACE FUNCTION public.is_company_admin(cid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_users
    WHERE company_id = cid AND user_id = auth.uid() AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.company_has_members(cid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM company_users WHERE company_id = cid)
$$;

-- ① 会社情報の更新は、その会社の admin のみ
DROP POLICY IF EXISTS "admin のみ会社情報更新" ON companies;
CREATE POLICY "admin のみ会社情報更新" ON companies
  FOR UPDATE USING (public.is_company_admin(id))
  WITH CHECK (public.is_company_admin(id));

-- ② メンバー追加: 追加先の会社の admin か、
--    メンバーがまだ0人の会社(=作成直後)に自分を最初の admin として登録する場合のみ
DROP POLICY IF EXISTS "admin のみ会社ユーザー追加" ON company_users;
CREATE POLICY "admin のみ会社ユーザー追加" ON company_users
  FOR INSERT WITH CHECK (
    public.is_company_admin(company_id)
    OR (user_id = auth.uid() AND NOT public.company_has_members(company_id))
  );

-- 確認用: 現在の全ポリシー一覧（この結果を Claude に貼る）
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public'
ORDER BY tablename, cmd;
