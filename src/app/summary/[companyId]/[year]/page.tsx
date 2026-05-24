import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SummaryClient } from '@/components/summary/SummaryClient'

interface Props {
  params: Promise<{ companyId: string; year: string }>
}

export default async function SummaryPage({ params }: Props) {
  const { companyId, year } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: companyUser } = await supabase
    .from('company_users')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single()

  if (!companyUser) redirect('/')

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single()

  if (!company) redirect('/')

  // 所属会社一覧（ヘッダー用）
  const { data: companyUsers } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', user.id)

  const companyIds = companyUsers?.map(cu => cu.company_id) ?? []
  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .in('id', companyIds.length > 0 ? companyIds : ['00000000-0000-0000-0000-000000000000'])
    .order('name')

  // カテゴリ一覧
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', companyId)
    .order('large_category')
    .order('sort_order')

  // 該当年の全月エントリーを取得（1月〜12月）
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const { data: entries } = await supabase
    .from('monthly_entries')
    .select('*')
    .eq('company_id', companyId)
    .in('year_month', months)

  return (
    <SummaryClient
      company={company}
      companies={companies ?? []}
      userEmail={user.email ?? ''}
      year={year}
      categories={categories ?? []}
      entries={entries ?? []}
    />
  )
}
