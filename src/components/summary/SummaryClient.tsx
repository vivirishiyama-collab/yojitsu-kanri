'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Company, Category, MonthlyEntry, LargeCategory } from '@/lib/types'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const LARGE_CATEGORIES: LargeCategory[] = ['売上内訳', '販売原価', '販管費']

interface Props {
  company: Company
  companies: Company[]
  userEmail: string
  year: string
  categories: Category[]
  entries: MonthlyEntry[]
}

function fmt(n: number): string {
  if (n === 0) return '—'
  return n.toLocaleString()
}

function pct(n: number): string {
  return n.toFixed(1) + '%'
}

export function SummaryClient({ company, companies, userEmail, year, categories, entries }: Props) {
  const router = useRouter()
  const yearNum = parseInt(year, 10)

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)

  // 入力画面に戻る際の月：entries で一番新しい year_month、なければ現在月
  const latestMonth = entries.length > 0
    ? entries.map(e => e.year_month).sort().reverse()[0]
    : `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  // カテゴリIDごと・月ごとにentryをマップ
  const entryMap: Record<string, Record<string, number>> = {}
  entries.forEach(e => {
    if (!entryMap[e.category_id]) entryMap[e.category_id] = {}
    entryMap[e.category_id][e.year_month] = e.amount ?? 0
  })

  function calcLargeTotal(largeCat: LargeCategory, month: string): number {
    return categories
      .filter(c => c.large_category === largeCat)
      .reduce((sum, c) => sum + (entryMap[c.id]?.[month] ?? 0), 0)
  }

  // 月別集計
  const monthlySales    = months.map(m => calcLargeTotal('売上内訳', m))
  const monthlyCogs     = months.map(m => calcLargeTotal('販売原価', m))
  const monthlyOpex     = months.map(m => calcLargeTotal('販管費', m))
  const monthlyGross    = months.map((_, i) => monthlySales[i] - monthlyCogs[i])
  const monthlyOpIncome = months.map((_, i) => monthlyGross[i] - monthlyOpex[i])
  const monthlyGrossRate    = months.map((_, i) => monthlySales[i] > 0 ? monthlySales[i] > 0 ? (monthlyGross[i] / monthlySales[i] * 100) : 0 : 0)
  const monthlyOpIncomeRate = months.map((_, i) => monthlySales[i] > 0 ? (monthlyOpIncome[i] / monthlySales[i] * 100) : 0)

  // 年間合計
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  const totalSales    = sum(monthlySales)
  const totalCogs     = sum(monthlyCogs)
  const totalOpex     = sum(monthlyOpex)
  const totalGross    = totalSales - totalCogs
  const totalOpIncome = totalGross - totalOpex
  const totalGrossRate    = totalSales > 0 ? totalGross / totalSales * 100 : 0
  const totalOpIncomeRate = totalSales > 0 ? totalOpIncome / totalSales * 100 : 0

  const rows = [
    {
      label: '売上（税抜き）',
      values: monthlySales,
      total: totalSales,
      rate: null as number[] | null,
      totalRate: null as number | null,
      bold: true,
      highlight: false,
    },
    {
      label: '販売原価（税抜き）',
      values: monthlyCogs,
      total: totalCogs,
      rate: null,
      totalRate: null,
      bold: false,
      highlight: false,
    },
    {
      label: '粗利',
      values: monthlyGross,
      total: totalGross,
      rate: monthlyGrossRate,
      totalRate: totalGrossRate,
      bold: true,
      highlight: true,
    },
    {
      label: '販管費（税抜き）',
      values: monthlyOpex,
      total: totalOpex,
      rate: null,
      totalRate: null,
      bold: false,
      highlight: false,
    },
    {
      label: '営業利益',
      values: monthlyOpIncome,
      total: totalOpIncome,
      rate: monthlyOpIncomeRate,
      totalRate: totalOpIncomeRate,
      bold: true,
      highlight: true,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        companies={companies}
        currentCompany={company}
        onCompanyChange={c => router.push(`/summary/${c.id}/${year}`)}
        userEmail={userEmail}
      />

      <main className="max-w-7xl mx-auto p-4 space-y-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm px-4 py-3">
          <button
            onClick={() => router.push(`/summary/${company.id}/${yearNum - 1}`)}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800"
          >
            <ChevronLeft className="w-5 h-5" />
            {yearNum - 1}年
          </button>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-800">{year}年　年間サマリー</div>
            <div className="text-sm text-gray-500">{company.name}</div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push(`/entry/${company.id}/${latestMonth}`)}>
              入力画面に戻る
            </Button>
            <button
              onClick={() => router.push(`/summary/${company.id}/${yearNum + 1}`)}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-800"
            >
              {yearNum + 1}年
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* テーブル */}
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="table-fixed text-sm" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10" style={{ width: 140, minWidth: 140 }}>項目</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 bg-gray-100 sticky z-10 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]" style={{ width: 120, minWidth: 120, left: 140 }}>年間合計</th>
                {months.map((m, i) => (
                  <th key={m} className="text-right px-3 py-3 font-medium text-gray-600" style={{ width: 110, minWidth: 110 }}>
                    <button
                      onClick={() => router.push(`/entry/${company.id}/${m}`)}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {i + 1}月
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <React.Fragment key={rowIdx}>
                  {/* 金額行 */}
                  <tr
                    key={`val-${rowIdx}`}
                    className={`border-b ${row.highlight ? 'bg-blue-50' : 'hover:bg-gray-50'} ${rowIdx === 2 || rowIdx === 4 ? 'border-t-2 border-t-blue-200' : ''}`}
                  >
                    <td className={`px-4 py-2 sticky left-0 z-10 ${row.highlight ? 'bg-blue-50' : 'bg-white'} ${row.bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                      {row.label}
                    </td>
                    <td className={`text-right px-4 py-2 font-semibold bg-gray-100 sticky z-10 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] ${row.total < 0 ? 'text-red-600' : 'text-gray-800'}`} style={{ left: 140 }}>
                      {row.total === 0 ? <span className="text-gray-300">—</span> : row.total.toLocaleString()}
                    </td>
                    {row.values.map((v, i) => (
                      <td
                        key={i}
                        className={`text-right px-3 py-2 ${row.bold ? 'font-semibold' : ''} ${v < 0 ? 'text-red-600' : 'text-gray-800'}`}
                      >
                        {v === 0 ? <span className="text-gray-300">—</span> : v.toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  {/* 率行（粗利・営業利益のみ） */}
                  {row.rate && (
                    <tr key={`rate-${rowIdx}`} className={`border-b ${row.highlight ? 'bg-blue-50' : ''}`}>
                      <td className={`px-4 py-1 text-xs sticky left-0 z-10 ${row.highlight ? 'bg-blue-50' : 'bg-white'} text-gray-400`}>
                        　{row.label.replace('（税抜き）', '')}率
                      </td>
                      <td className={`text-right px-4 py-1 text-xs bg-gray-100 sticky z-10 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] ${(row.totalRate ?? 0) < 0 ? 'text-red-400' : 'text-gray-500'}`} style={{ left: 140 }}>
                        {totalSales === 0 ? '' : pct(row.totalRate ?? 0)}
                      </td>
                      {row.rate.map((r, i) => (
                        <td key={i} className={`text-right px-3 py-1 text-xs ${r < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          {monthlySales[i] === 0 ? '' : pct(r)}
                        </td>
                      ))}
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

      </main>
    </div>
  )
}
