import * as XLSX from 'xlsx'
import { Company, Category, MonthlyEntry, LargeCategory } from './types'
import { format, parse } from 'date-fns'
import { ja } from 'date-fns/locale'

const LARGE_CATEGORIES: LargeCategory[] = ['売上内訳', '販売原価', '販管費']

interface ExportParams {
  company: Company
  yearMonth: string
  categories: Category[]
  entries: Record<string, MonthlyEntry>
}

export function exportToExcel({ company, yearMonth, categories, entries }: ExportParams) {
  const wb = XLSX.utils.book_new()

  // --- 月次シート ---
  const date = parse(yearMonth, 'yyyy-MM', new Date())
  const sheetName = format(date, 'yyyy年M月', { locale: ja })

  const rows: (string | number | null)[][] = []

  // ヘッダー
  rows.push([company.name, '', sheetName, '', '', '', ''])
  rows.push(['ステータス', '大項目', '中項目', '金額', '固定/フリー', 'メモ', ''])
  rows.push([])

  // 集計行
  const calcTotal = (largeCat: LargeCategory) =>
    categories
      .filter(c => c.large_category === largeCat)
      .reduce((sum, c) => sum + (entries[c.id]?.amount ?? 0), 0)

  const 売上 = calcTotal('売上内訳')
  const 販売原価 = calcTotal('販売原価')
  const 販管費 = calcTotal('販管費')
  const 粗利 = 売上 - 販売原価
  const 営業利益 = 粗利 - 販管費
  const 粗利率 = 売上 > 0 ? (粗利 / 売上 * 100) : 0
  const 営業利益率 = 売上 > 0 ? (営業利益 / 売上 * 100) : 0

  rows.push(['【サマリー】', '', '', '', '', '', ''])
  rows.push(['', '売上合計', '', 売上, '', '', ''])
  rows.push(['', '販売原価', '', 販売原価, '', '', ''])
  rows.push(['', '粗利', `(${粗利率.toFixed(1)}%)`, 粗利, '', '', ''])
  rows.push(['', '販管費', '', 販管費, '', '', ''])
  rows.push(['', '営業利益', `(${営業利益率.toFixed(1)}%)`, 営業利益, '', '', ''])
  rows.push([])

  // 大項目ごとの明細
  for (const largeCat of LARGE_CATEGORIES) {
    const cats = categories.filter(c => c.large_category === largeCat)
    const total = calcTotal(largeCat)

    rows.push([`【${largeCat}】`, '', '', total, '', '', ''])

    for (const cat of cats) {
      const entry = entries[cat.id]
      rows.push([
        entry?.status ?? '—',
        largeCat,
        cat.name,
        entry?.amount ?? null,
        entry?.amount_type === 'fixed' ? '固定' : 'フリー',
        entry?.note ?? '',
        '',
      ])
    }
    rows.push([])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // 列幅設定
  ws['!cols'] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 30 },
    { wch: 14 },
    { wch: 10 },
    { wch: 20 },
    { wch: 4 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // ダウンロード
  const fileName = `収支管理_${company.name}_${yearMonth}.xlsx`
  XLSX.writeFile(wb, fileName)
}
