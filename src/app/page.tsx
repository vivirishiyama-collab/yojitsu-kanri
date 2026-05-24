import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

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

  return (
    <DashboardClient
      companies={companies ?? []}
      userEmail={user.email ?? ''}
      userId={user.id}
    />
  )
}
