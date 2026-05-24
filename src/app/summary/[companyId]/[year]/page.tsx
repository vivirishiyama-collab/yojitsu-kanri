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

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)

  // 並列取得
  const [
    { data: companyUser },
    { data: company },
    { data: companyUsers },
    { data: categories },
    { data: entries },
  ] = await Promise.all([
    supabase.from('company_users').select('role').eq('company_id', companyId).eq('user_id', user.id).single(),
    supabase.from('companies').select('*').eq('id', companyId).single(),
    supabase.from('company_users').select('company_id').eq('user_id', user.id),
    supabase.from('categories').select('*').eq('company_id', companyId).order('large_category').order('sort_order'),
    supabase.from('monthly_entries').select('*').eq('company_id', companyId).in('year_month', months),
  ])

  if (!companyUser) redirect('/')
  if (!company) redirect('/')

  const companyIds = companyUsers?.map(cu => cu.company_id) ?? []
  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .in('id', companyIds.length > 0 ? companyIds : ['00000000-0000-0000-0000-000000000000'])
    .order('name')

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
