export type LargeCategory = '売上内訳' | '販売原価' | '販管費'
export type AmountType = 'fixed' | 'free'
export type EntryStatus = 'そのまま' | '変更' | '質問・未計上' | null

export interface Company {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface Category {
  id: string
  company_id: string
  large_category: LargeCategory
  name: string
  sort_order: number
  created_at: string
}

export interface MonthlyEntry {
  id: string
  company_id: string
  category_id: string
  year_month: string
  amount: number | null
  amount_type: AmountType
  status: EntryStatus
  note: string | null
  updated_by: string | null
  updated_at: string
}

export interface CompanyUser {
  id: string
  company_id: string
  user_id: string
  role: 'admin' | 'member'
}

// 表示用の結合型
export interface CategoryWithEntry extends Category {
  entry?: MonthlyEntry
}

export interface MonthlySummary {
  year_month: string
  売上合計: number
  販売原価合計: number
  粗利: number
  販管費合計: number
  営業利益: number
  粗利率: number
  営業利益率: number
}
