'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createCompany(name: string, fiscalYearStartMonth: number): Promise<{ error?: string; companyId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ログインが必要です' }

  const trimmed = name.trim()
  if (!trimmed) return { error: '会社名を入力してください' }
  if (!isValidMonth(fiscalYearStartMonth)) return { error: '期首月が不正です' }

  const slug = trimmed
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-ぁ-んァ-ヶー一-龠]/g, '')
    || `company-${Date.now()}`

  // IDはこちらで採番する。メンバー登録前は会社を読めない(RLS)ため、insert後の select はしない
  const companyId = crypto.randomUUID()
  const { error: companyErr } = await supabase
    .from('companies')
    .insert({ id: companyId, name: trimmed, slug: `${slug}-${Date.now()}`, fiscal_year_start_month: fiscalYearStartMonth })

  if (companyErr) return { error: `会社の作成に失敗しました: ${companyErr.message}` }

  const { error: memberErr } = await supabase
    .from('company_users')
    .insert({ company_id: companyId, user_id: user.id, role: 'admin' })

  if (memberErr) return { error: 'メンバー登録に失敗しました' }

  return { companyId }
}

function isValidMonth(m: number): boolean {
  return Number.isInteger(m) && m >= 1 && m <= 12
}

// 期首月（事業年度の開始月）を変更する。会社の管理者のみ
export async function updateFiscalYearStartMonth(companyId: string, month: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ログインが必要です' }
  if (!isValidMonth(month)) return { error: '期首月が不正です' }

  const { data: cu } = await supabase
    .from('company_users')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single()
  if (cu?.role !== 'admin') return { error: '管理者のみ変更できます' }

  // RLSで弾かれると0件更新でエラーにならないため、更新行を返させて確認する
  const { data, error } = await supabase
    .from('companies')
    .update({ fiscal_year_start_month: month })
    .eq('id', companyId)
    .select('id')
  if (error) return { error: `更新に失敗しました: ${error.message}` }
  if (!data || data.length === 0) return { error: '更新が許可されていません（DBの更新ルール未設定）' }
  return {}
}
