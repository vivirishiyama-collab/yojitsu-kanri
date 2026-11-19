-- =====================================================
-- companies の「ログインユーザーなら全社参照可(true)」ポリシーを削除
-- 目的: 他社の会社名が見えないようにする（所属会社のみ参照 だけを残す）
-- 前提: createCompany が insert 後に select しない版がデプロイ済みであること
-- 実行場所: Supabase(nhycvvutnbyzzgdewytz) > SQL Editor
-- =====================================================

DROP POLICY IF EXISTS "authenticated users can select companies" ON companies;

SELECT tablename, policyname, cmd, qual
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'companies';
