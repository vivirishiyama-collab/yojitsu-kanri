'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Company, Category, MonthlyEntry, LargeCategory } from '@/lib/types'
import { Header } from '@/components/layout/Header'
import { format, subMonths, addMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'

const LARGE_CATEGORIES: LargeCategory[] = ['売上内訳', '販売原価', '販管費']

interface Props {
  companies: Company[]
  userEmail: string
  userId: string
  year: string
  categories: Category[]
  summaryEntries: MonthlyEntry[]
}

export function DashboardClient({ companies, userEmail, year, categories, summaryEntries }: Props) {
  const router = useRouter()
  const [currentCompany, setCurrentCompany] = useState<Company | null>(
    companies.length > 0 ? companies[0] : null
  )
  const [currentDate, setCurrentDate] = useState(new Date())

  const yearMonth = format(currentDate, 'yyyy-MM')
  const displayMonth = format(currentDate, 'yyyy年M月', { locale: ja })

  function goPrev() { setCurrentDate(d => subMonths(d, 1)) }
  function goNext() { setCurrentDate(d => addMonths(d, 1)) }
  function goToEntry() {
    if (!currentCompany) return
    router.push(`/entry/${currentCompany.id}/${yearMonth}`)
  }

  // 年間サマリー計算
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const entryMap: Record<string, Record<string, number>> = {}
  summaryEntries.forEach(e => {
    if (!entryMap[e.category_id]) entryMap[e.category_id] = {}
    entryMap[e.category_id][e.year_month] = e.amount ?? 0
  })

  function calcLargeTotal(largeCat: LargeCategory, month: string): number {
    return categories
      .filter(c => c.large_category === largeCat)
      .reduce((sum, c) => sum + (entryMap[c.id]?.[month] ?? 0), 0)
  }

  const monthlySales  = months.map(m => calcLargeTotal('売上内訳', m))
  const monthlyCogs   = months.map(m => calcLargeTotal('販売原価', m))
  const monthlyOpex   = months.map(m => calcLargeTotal('販管費', m))
  const monthlyGross  = months.map((_, i) => monthlySales[i] - monthlyCogs[i])
  const monthlyOpIncome = months.map((_, i) => monthlyGross[i] - monthlyOpex[i])
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  const totalSales    = sum(monthlySales)
  const totalGross    = sum(monthlyGross)
  const totalOpIncome = sum(monthlyOpIncome)
  const totalOpex     = sum(monthlyOpex)
  const totalCogs     = sum(monthlyCogs)
  const totalGrossRate    = totalSales > 0 ? totalGross / totalSales * 100 : 0
  const totalOpIncomeRate = totalSales > 0 ? totalOpIncome / totalSales * 100 : 0

  const monthlyGrossRate    = months.map((_, i) => monthlySales[i] > 0 ? monthlyGross[i] / monthlySales[i] * 100 : 0)
  const monthlyOpIncomeRate = months.map((_, i) => monthlySales[i] > 0 ? monthlyOpIncome[i] / monthlySales[i] * 100 : 0)

  const summaryRows = [
    { label: '売上',    values: monthlySales,    total: totalSales,    bold: true,  neg: false,                  rateValues: null as number[] | null, totalRate: null as number | null },
    { label: '販売原価', values: monthlyCogs,    total: totalCogs,     bold: false, neg: false,                  rateValues: null, totalRate: null },
    { label: '粗利',    values: monthlyGross,    total: totalGross,    bold: true,  neg: totalGross < 0,         rateValues: monthlyGrossRate,    totalRate: totalGrossRate },
    { label: '販管費',  values: monthlyOpex,     total: totalOpex,     bold: false, neg: false,                  rateValues: null, totalRate: null },
    { label: '営業利益', values: monthlyOpIncome, total: totalOpIncome, bold: true,  neg: totalOpIncome < 0,     rateValues: monthlyOpIncomeRate, totalRate: totalOpIncomeRate },
  ]

  const hasSummaryData = totalSales > 0 || totalCogs > 0 || totalOpex > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        companies={companies}
        currentCompany={currentCompany}
        onCompanyChange={c => {
          setCurrentCompany(c)
          router.push(`/?company=${c.id}`)
        }}
        userEmail={userEmail}
      />

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {!currentCompany ? (
          <div className="text-center text-gray-500 py-20">
            <p className="text-lg">所属する会社がありません</p>
          </div>
        ) : (
          <>
            {/* 月選択 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">月を選択して入力へ</h2>
              <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={goPrev}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-2xl font-bold text-gray-800 w-40 text-center">{displayMonth}</span>
                <Button variant="outline" size="icon" onClick={goNext}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button onClick={goToEntry} className="ml-4 flex items-center gap-2">
                  入力画面へ
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* 年間サマリー */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-700">{year}年　年間サマリー</h2>
                <button
                  onClick={() => router.push(`/summary/${currentCompany.id}/${year}`)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  詳細を見る →
                </button>
              </div>

              {!hasSummaryData ? (
                <div className="text-center text-gray-400 py-10 text-sm">
                  まだ{year}年のデータがありません
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="text-sm w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-4 py-2 text-gray-600 font-semibold sticky left-0 bg-gray-50 z-10" style={{ width: 100, minWidth: 100 }}>項目</th>
                        <th className="text-right px-4 py-2 text-gray-700 font-semibold bg-gray-100 sticky z-10 border-r border-gray-200" style={{ width: 110, minWidth: 110, left: 100 }}>年間合計</th>
                        {months.map((m, i) => (
                          <th key={m} className="text-right px-3 py-2 text-gray-500 font-medium" style={{ width: 90, minWidth: 90 }}>
                            <button onClick={() => router.push(`/entry/${currentCompany.id}/${m}`)} className="hover:text-blue-600 hover:underline">
                              {i + 1}月
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((row, ri) => (
                        <React.Fragment key={ri}>
                          <tr className={`border-b ${row.bold && ri > 0 ? 'border-t-2 border-t-blue-100' : ''} ${row.bold ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}>
                            <td className={`px-4 py-2 sticky left-0 z-10 ${row.bold ? 'bg-blue-50/30 font-semibold text-gray-800' : 'bg-white text-gray-600'}`}>{row.label}</td>
                            <td className={`text-right px-4 py-2 font-semibold bg-gray-100 sticky z-10 border-r border-gray-200 ${row.neg ? 'text-red-600' : 'text-gray-800'}`} style={{ left: 100 }}>
                              {row.total === 0 ? <span className="text-gray-300 font-normal">—</span> : row.total.toLocaleString()}
                            </td>
                            {row.values.map((v, i) => (
                              <td key={i} className={`text-right px-3 py-2 ${row.bold ? 'font-semibold' : ''} ${v < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                {v === 0 ? <span className="text-gray-200">—</span> : v.toLocaleString()}
                              </td>
                            ))}
                          </tr>
                          {row.rateValues && (
                            <tr className="border-b bg-blue-50/20">
                              <td className="px-4 py-1 text-xs text-gray-400 sticky left-0 z-10 bg-blue-50/20">　{row.label}率</td>
                              <td className="text-right px-4 py-1 text-xs text-gray-500 bg-gray-100 sticky z-10 border-r border-gray-200" style={{ left: 100 }}>
                                {totalSales === 0 ? '' : `${(row.totalRate ?? 0).toFixed(1)}%`}
                              </td>
                              {row.rateValues.map((r, i) => (
                                <td key={i} className={`text-right px-3 py-1 text-xs ${r < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                  {monthlySales[i] === 0 ? '' : `${r.toFixed(1)}%`}
                                </td>
                              ))}
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
