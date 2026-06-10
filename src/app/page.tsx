import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import { format } from 'date-fns'

interface Props {
  searchParams: Promise<{ company?: string; year?: string }>
}

export default async function HomePage({ searchParams }: Props) {
  const { company: companyParam, year: yearParam } = await searchParams
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

  const currentYear = format(new Date(), 'yyyy')
  const year = yearParam ?? currentYear
  const firstCompanyId = companyParam ?? companyIds[0]
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
      currentYear={currentYear}
      categories={categories ?? []}
      summaryEntries={summaryEntries ?? []}
    />
  )
}
