'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Company, Category, MonthlyEntry, LargeCategory } from '@/lib/types'
import { Header } from '@/components/layout/Header'

interface Props {
  companies: Company[]
  userEmail: string
  userId: string
  fiscalYear: number
  currentFiscalYear: number
  fiscalYearStartMonth: number
  fiscalYearMonths: string[]
  categories: Category[]
  summaryEntries: MonthlyEntry[]
}

export function DashboardClient({
  companies, userEmail, fiscalYear, currentFiscalYear,
  fiscalYearStartMonth, fiscalYearMonths, categories, summaryEntries
}: Props) {
  const router = useRouter()
  const [currentCompany, setCurrentCompany] = useState<Company | null>(
    companies.length > 0 ? companies[0] : null
  )

  const yearTabs = [currentFiscalYear - 1, currentFiscalYear]

  // 年間サマリー計算
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

  const monthlySales    = fiscalYearMonths.map(m => calcLargeTotal('売上内訳', m))
  const monthlyCogs     = fiscalYearMonths.map(m => calcLargeTotal('販売原価', m))
  const monthlyOpex     = fiscalYearMonths.map(m => calcLargeTotal('販管費', m))
  const monthlyGross    = fiscalYearMonths.map((_, i) => monthlySales[i] - monthlyCogs[i])
  const monthlyOpIncome = fiscalYearMonths.map((_, i) => monthlyGross[i] - monthlyOpex[i])
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  const totalSales      = sum(monthlySales)
  const totalGross      = sum(monthlyGross)
  const totalOpIncome   = sum(monthlyOpIncome)
  const totalOpex       = sum(monthlyOpex)
  const totalCogs       = sum(monthlyCogs)
  const totalGrossRate      = totalSales > 0 ? totalGross / totalSales * 100 : 0
  const totalOpIncomeRate   = totalSales > 0 ? totalOpIncome / totalSales * 100 : 0
  const monthlyGrossRate    = fiscalYearMonths.map((_, i) => monthlySales[i] > 0 ? monthlyGross[i] / monthlySales[i] * 100 : 0)
  const monthlyOpIncomeRate = fiscalYearMonths.map((_, i) => monthlySales[i] > 0 ? monthlyOpIncome[i] / monthlySales[i] * 100 : 0)

  const summaryRows = [
    { label: '売上',    values: monthlySales,    total: totalSales,    bold: true,  neg: false,               rateValues: null as number[] | null, totalRate: null as number | null },
    { label: '販売原価', values: monthlyCogs,    total: totalCogs,     bold: false, neg: false,               rateValues: null, totalRate: null },
    { label: '粗利',    values: monthlyGross,    total: totalGross,    bold: true,  neg: totalGross < 0,      rateValues: monthlyGrossRate,    totalRate: totalGrossRate },
    { label: '販管費',  values: monthlyOpex,     total: totalOpex,     bold: false, neg: false,               rateValues: null, totalRate: null },
    { label: '営業利益', values: monthlyOpIncome, total: totalOpIncome, bold: true, neg: totalOpIncome < 0,   rateValues: monthlyOpIncomeRate, totalRate: totalOpIncomeRate },
  ]

  const hasSummaryData = totalSales > 0 || totalCogs > 0 || totalOpex > 0
  const currentYM = new Date().toISOString().slice(0, 7)

  // 月カード：事業年度の月を上段6・下段6に分割
  const firstRow  = fiscalYearMonths.slice(0, 6)
  const secondRow = fiscalYearMonths.slice(6, 12)

  function navigateWithFiscalYear(companyId: string, fy: number) {
    router.push(`/?company=${companyId}&year=${fy}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        companies={companies}
        currentCompany={currentCompany}
        onCompanyChange={c => {
          setCurrentCompany(c)
          navigateWithFiscalYear(c.id, fiscalYear)
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
            {/* 年度タブ */}
            <div className="flex gap-2">
              {yearTabs.map(fy => (
                <button
                  key={fy}
                  onClick={() => navigateWithFiscalYear(currentCompany.id, fy)}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                    fy === fiscalYear
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {fy}年度
                </button>
              ))}
            </div>

            {/* 月カード */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">月を選んで入力へ</h2>
              {[firstRow, secondRow].map((row, ri) => (
                <div key={ri} className="grid grid-cols-6 gap-3 mb-3 last:mb-0">
                  {row.map(ym => {
                    const [y, m] = ym.split('-')
                    const isCurrentMonth = ym === currentYM
                    return (
                      <button
                        key={ym}
                        onClick={() => router.push(`/entry/${currentCompany.id}/${ym}`)}
                        className={`rounded-lg border p-3 text-left transition-colors hover:bg-blue-50 hover:border-blue-300 ${
                          isCurrentMonth ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="text-xs text-gray-500">{y}年</div>
                        <div className={`text-lg font-bold ${isCurrentMonth ? 'text-blue-600' : 'text-gray-800'}`}>
                          {parseInt(m)}月
                          {isCurrentMonth && <span className="text-xs font-normal ml-1">今月</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* 年間サマリー */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-700">{fiscalYear}年度　年間サマリー</h2>
              </div>

              {!hasSummaryData ? (
                <div className="text-center text-gray-400 py-10 text-sm">
                  まだ{fiscalYear}年度のデータがありません
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="text-sm w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-4 py-2 text-gray-600 font-semibold sticky left-0 bg-gray-50 z-10" style={{ width: 100, minWidth: 100 }}>項目</th>
                        <th className="text-right px-4 py-2 text-gray-700 font-semibold bg-gray-100 sticky z-10 border-r border-gray-200" style={{ width: 110, minWidth: 110, left: 100 }}>年間合計</th>
                        {fiscalYearMonths.map(m => (
                          <th key={m} className="text-right px-3 py-2 text-gray-500 font-medium" style={{ width: 90, minWidth: 90 }}>
                            <button onClick={() => router.push(`/entry/${currentCompany.id}/${m}`)} className="hover:text-blue-600 hover:underline">
                              {parseInt(m.split('-')[1])}月
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((row, ri) => (
                        <React.Fragment key={ri}>
                          <tr className={`border-b ${row.bold && ri > 0 ? 'border-t-2 border-t-blue-100' : ''} ${row.bold ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                            <td className={`px-4 py-2 sticky left-0 z-10 ${row.bold ? 'bg-blue-50 font-semibold text-gray-800' : 'bg-white text-gray-600'}`}>{row.label}</td>
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
                            <tr className="border-b bg-blue-50">
                              <td className="px-4 py-1 text-xs text-gray-400 sticky left-0 z-10 bg-blue-50">　{row.label}率</td>
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
