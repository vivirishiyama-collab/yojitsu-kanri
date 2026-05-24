import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import { format } from 'date-fns'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: companyUsers } = await supabase
    .from('company_users')
    .select('company_id, role')
    .eq('user_id', user.id)

  const companyIds = companyUsers?.map(cu => cu.company_id) ?? []

  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .in('id', companyIds.length > 0 ? companyIds : ['00000000-0000-0000-0000-000000000000'])
    .order('name')

  // 最初の会社の今年の年間サマリーを並列取得
  const firstCompanyId = companyIds[0]
  const year = format(new Date(), 'yyyy')
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)

  const [{ data: categories }, { data: summaryEntries }] = firstCompanyId
    ? await Promise.all([
        supabase.from('categories').select('*').eq('company_id', firstCompanyId).order('large_category').order('sort_order'),
        supabase.from('monthly_entries').select('*').eq('company_id', firstCompanyId).in('year_month', months),
      ])
    : [{ data: null }, { data: null }]

  return (
    <DashboardClient
      companies={companies ?? []}
      userEmail={user.email ?? ''}
      userId={user.id}
      year={year}
      categories={categories ?? []}
      summaryEntries={summaryEntries ?? []}
    />
  )
}
