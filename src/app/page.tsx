import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import { getFiscalYearMonths, getCurrentFiscalYear } from '@/lib/fiscalYear'

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

  const firstCompany = companyParam
    ? companies?.find(c => c.id === companyParam) ?? companies?.[0]
    : companies?.[0]

  const startMonth = firstCompany?.fiscal_year_start_month ?? 1
  const currentFiscalYear = getCurrentFiscalYear(startMonth)
  const fiscalYear = yearParam ? Number(yearParam) : currentFiscalYear
  const months = getFiscalYearMonths(fiscalYear, startMonth)

  const [{ data: categories }, { data: summaryEntries }, { data: statuses }] = firstCompany
    ? await Promise.all([
        supabase.from('categories').select('*').eq('company_id', firstCompany.id).order('large_category').order('sort_order'),
        supabase.from('monthly_entries').select('*').eq('company_id', firstCompany.id).in('year_month', months),
        supabase.from('monthly_status').select('*').eq('company_id', firstCompany.id).in('year_month', months),
      ])
    : [{ data: null }, { data: null }, { data: null }]

  return (
    <DashboardClient
      key={`${firstCompany?.id ?? 'none'}-${fiscalYear}`}
      companies={companies ?? []}
      currentCompanyId={firstCompany?.id ?? ''}
      userEmail={user.email ?? ''}
      userId={user.id}
      fiscalYear={fiscalYear}
      currentFiscalYear={currentFiscalYear}
      fiscalYearStartMonth={startMonth}
      fiscalYearMonths={months}
      categories={categories ?? []}
      summaryEntries={summaryEntries ?? []}
      statuses={statuses ?? []}
    />
  )
}
