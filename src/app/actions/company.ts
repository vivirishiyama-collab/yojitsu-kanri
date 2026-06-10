'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createCompany(name: string): Promise<{ error?: string; companyId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ログインが必要です' }

  const trimmed = name.trim()
  if (!trimmed) return { error: '会社名を入力してください' }

  const slug = trimmed
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-ぁ-んァ-ヶー一-龠]/g, '')
    || `company-${Date.now()}`

  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .insert({ name: trimmed, slug: `${slug}-${Date.now()}` })
    .select()
    .single()

  if (companyErr || !company) return { error: `会社の作成に失敗しました: ${companyErr?.message}` }

  const { error: memberErr } = await supabase
    .from('company_users')
    .insert({ company_id: company.id, user_id: user.id, role: 'admin' })

  if (memberErr) return { error: 'メンバー登録に失敗しました' }

  return { companyId: company.id }
}
