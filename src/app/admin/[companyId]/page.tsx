import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminClient } from '@/components/admin/AdminClient'

interface Props {
  params: Promise<{ companyId: string }>
}

export default async function AdminPage({ params }: Props) {
  const { companyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // adminのみアクセス可
  const { data: companyUser } = await supabase
    .from('company_users')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single()

  if (!companyUser || companyUser.role !== 'admin') redirect('/')

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', companyId)
    .order('large_category')
    .order('sort_order')

  const { data: companyUsers } = await supabase
    .from('company_users')
    .select('id, user_id, role')
    .eq('company_id', companyId)

  return (
    <AdminClient
      company={company!}
      categories={categories ?? []}
      companyUsers={(companyUsers ?? []) as Array<{ id: string; user_id: string; role: string }>}
      currentUserId={user.id}
    />
  )
}
