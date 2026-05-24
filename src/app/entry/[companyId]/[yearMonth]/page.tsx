import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EntryClient } from '@/components/entry/EntryClient'
import { format, parse, subMonths } from 'date-fns'

interface Props {
  params: Promise<{ companyId: string; yearMonth: string }>
}

export default async function EntryPage({ params }: Props) {
  const { companyId, yearMonth } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 所属確認
  const { data: companyUser } = await supabase
    .from('company_users')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single()

  if (!companyUser) redirect('/')

  // 会社情報
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

  // 当月エントリーを取得
  const { data: existingEntries } = await supabase
    .from('monthly_entries')
    .select('*')
    .eq('company_id', companyId)
    .eq('year_month', yearMonth)

  let entries = existingEntries ?? []

  // 当月にデータがなければ前月から自動コピー
  if (entries.length === 0 && (categories ?? []).length > 0) {
    const prevMonth = format(subMonths(parse(yearMonth, 'yyyy-MM', new Date()), 1), 'yyyy-MM')

    const { data: prevEntries } = await supabase
      .from('monthly_entries')
      .select('*')
      .eq('company_id', companyId)
      .eq('year_month', prevMonth)

    if (prevEntries && prevEntries.length > 0) {
      const toInsert = prevEntries.map(e => ({
        company_id: companyId,
        category_id: e.category_id,
        year_month: yearMonth,
        amount: e.amount_type === 'fixed' ? e.amount : null, // 金額固定のみ金額を引き継ぎ
        amount_type: e.amount_type,
        status: null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }))

      const { data: inserted } = await supabase
        .from('monthly_entries')
        .insert(toInsert)
        .select()

      entries = inserted ?? []
    }
  }

  return (
    <EntryClient
      company={company}
      companies={companies ?? []}
      userEmail={user.email ?? ''}
      userId={user.id}
      yearMonth={yearMonth}
      categories={categories ?? []}
      entries={entries}
      userRole={companyUser.role}
    />
  )
}
