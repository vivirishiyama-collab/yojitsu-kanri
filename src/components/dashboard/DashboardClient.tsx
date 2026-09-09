'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Company, Category, MonthlyEntry, MonthlyStatus, LargeCategory } from '@/lib/types'
import { Header } from '@/components/layout/Header'

interface Props {
  companies: Company[]
  currentCompanyId: string
  userEmail: string
  userId: string
  fiscalYear: number
  currentFiscalYear: number
  fiscalYearStartMonth: number
  fiscalYearMonths: string[]
  categories: Category[]
  summaryEntries: MonthlyEntry[]
  statuses: MonthlyStatus[]
}

export function DashboardClient({
  companies, currentCompanyId, userEmail, userId, fiscalYear, currentFiscalYear,
  fiscalYearStartMonth, fiscalYearMonths, categories, summaryEntries, statuses
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [currentCompany, setCurrentCompany] = useState<Company | null>(
    companies.find(c => c.id === currentCompanyId) ?? (companies.length > 0 ? companies[0] : null)
  )

  // 確定済みの月（year_month の集合）。ダッシュボードから直接切り替え可能にするため state で保持
  const [confirmedMonths, setConfirmedMonths] = useState<Set<string>>(
    new Set(statuses.filter(s => s.confirmed).map(s => s.year_month))
  )
  const [savingMonth, setSavingMonth] = useState<string | null>(null)

  // 月の確定/解除を切り替え（monthly_status に保存）
  async function toggleConfirmed(ym: string) {
    if (!currentCompany) return
    const next = !confirmedMonths.has(ym)
    setConfirmedMonths(prev => {
      const s = new Set(prev)
      if (next) s.add(ym); else s.delete(ym)
      return s
    })
    setSavingMonth(ym)
    await supabase
      .from('monthly_status')
      .upsert({
        company_id: currentCompany.id,
        year_month: ym,
        confirmed: next,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,year_month' })
    setSavingMonth(null)
  }

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

  const isConfirmed = (i: number) => confirmedMonths.has(fiscalYearMonths[i])

  const monthlySales    = fiscalYearMonths.map(m => calcLargeTotal('売上内訳', m))
  const monthlyCogs     = fiscalYearMonths.map(m => calcLargeTotal('販売原価', m))
  const monthlyOpex     = fiscalYearMonths.map(m => calcLargeTotal('販管費', m))
  const monthlyGross    = fiscalYearMonths.map((_, i) => monthlySales[i] - monthlyCogs[i])
  const monthlyOpIncome = fiscalYearMonths.map((_, i) => monthlyGross[i] - monthlyOpex[i])

  // 全月合計（＝見込）と確定分だけの合計
  const sum  = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  const sumC = (arr: number[]) => arr.reduce((a, b, i) => a + (isConfirmed(i) ? b : 0), 0)

  const totalSales      = sum(monthlySales)
  const totalGross      = sum(monthlyGross)
  const totalOpIncome   = sum(monthlyOpIncome)
  const totalOpex       = sum(monthlyOpex)
  const totalCogs       = sum(monthlyCogs)

  const totalSalesC     = sumC(monthlySales)
  const totalGrossC     = sumC(monthlyGross)
  const totalOpIncomeC  = sumC(monthlyOpIncome)
  const totalOpexC      = sumC(monthlyOpex)
  const totalCogsC      = sumC(monthlyCogs)
  const totalGrossRateC    = totalSalesC > 0 ? totalGrossC / totalSalesC * 100 : 0
  const totalOpIncomeRateC = totalSalesC > 0 ? totalOpIncomeC / totalSalesC * 100 : 0
  const monthlyGrossRate    = fiscalYearMonths.map((_, i) => monthlySales[i] > 0 ? monthlyGross[i] / monthlySales[i] * 100 : 0)
  const monthlyOpIncomeRate = fiscalYearMonths.map((_, i) => monthlySales[i] > 0 ? monthlyOpIncome[i] / monthlySales[i] * 100 : 0)

  const summaryRows = [
    { label: '売上',    values: monthlySales,    totalC: totalSalesC,    totalFull: totalSales,    bold: true,  rateValues: null as number[] | null, totalRateC: null as number | null },
    { label: '販売原価', values: monthlyCogs,    totalC: totalCogsC,     totalFull: totalCogs,     bold: false, rateValues: null, totalRateC: null },
    { label: '粗利',    values: monthlyGross,    totalC: totalGrossC,    totalFull: totalGross,    bold: true,  rateValues: monthlyGrossRate,    totalRateC: totalGrossRateC },
    { label: '販管費',  values: monthlyOpex,     totalC: totalOpexC,     totalFull: totalOpex,     bold: false, rateValues: null, totalRateC: null },
    { label: '営業利益', values: monthlyOpIncome, totalC: totalOpIncomeC, totalFull: totalOpIncome, bold: true,  rateValues: monthlyOpIncomeRate, totalRateC: totalOpIncomeRateC },
  ]

  const hasSummaryData = totalSales > 0 || totalCogs > 0 || totalOpex > 0
  // 先入力（未確定）の月に数字が入っているか＝確定合計と見込合計に差が出るか
  const hasTentativeData = fiscalYearMonths.some((_, i) =>
    !isConfirmed(i) && (monthlySales[i] !== 0 || monthlyCogs[i] !== 0 || monthlyOpex[i] !== 0)
  )
  const confirmedCount = fiscalYearMonths.filter((_, i) => isConfirmed(i)).length
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
                    const conf = confirmedMonths.has(ym)
                    return (
                      <div
                        key={ym}
                        className={`rounded-lg border p-3 transition-colors ${
                          isCurrentMonth ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                        }`}
                      >
                        <button
                          onClick={() => router.push(`/entry/${currentCompany.id}/${ym}`)}
                          className="block w-full text-left hover:opacity-70 transition-opacity"
                        >
                          <div className="text-xs text-gray-500">{y}年</div>
                          <div className={`text-lg font-bold ${isCurrentMonth ? 'text-blue-600' : 'text-gray-800'}`}>
                            {parseInt(m)}月
                            {isCurrentMonth && <span className="text-xs font-normal ml-1">今月</span>}
                          </div>
                        </button>
                        <button
                          onClick={() => toggleConfirmed(ym)}
                          disabled={savingMonth === ym}
                          title={conf ? 'クリックで確定を解除（先入力に戻す）' : 'クリックでこの月を確定（年間サマリーの確定合計に反映）'}
                          className={`mt-2 w-full text-xs rounded border px-2 py-1 transition-colors disabled:opacity-50 ${
                            conf
                              ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                              : 'border-amber-300 bg-white text-amber-600 hover:bg-amber-50'
                          }`}
                        >
                          {conf ? '● 確定済み' : '○ 先入力'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* 年間サマリー */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-700">{fiscalYear}年度　年間サマリー</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">確定 {confirmedCount}か月分</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-white border border-gray-300"></span>確定＝合計に反映</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-amber-50 border border-amber-200"></span>先入力(見込)＝合計から除外</span>
                  <span className="text-gray-400">月の確定は各月の入力画面の「この月を確定」ボタンから</span>
                </div>
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
                        <th className="text-right px-4 py-2 text-gray-700 font-semibold bg-gray-100 sticky z-10 border-r border-gray-200" style={{ width: 110, minWidth: 110, left: 100 }}>
                          <div className="leading-tight">確定合計</div>
                          {hasTentativeData && <div className="text-[10px] font-normal text-gray-400 leading-tight">（見込＝全月）</div>}
                        </th>
                        {fiscalYearMonths.map((m, i) => {
                          const conf = isConfirmed(i)
                          return (
                            <th key={m} className={`text-right px-3 py-2 font-medium ${conf ? 'text-gray-500' : 'text-amber-600 bg-amber-50/60'}`} style={{ width: 90, minWidth: 90 }}>
                              <button onClick={() => router.push(`/entry/${currentCompany.id}/${m}`)} className="hover:text-blue-600 hover:underline">
                                {parseInt(m.split('-')[1])}月
                              </button>
                              <div className="text-[10px] font-normal leading-tight">
                                {conf ? <span className="text-gray-400">確定</span> : <span className="text-amber-500">先入力</span>}
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((row, ri) => (
                        <React.Fragment key={ri}>
                          <tr className={`border-b ${row.bold && ri > 0 ? 'border-t-2 border-t-blue-100' : ''} ${row.bold ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                            <td className={`px-4 py-2 sticky left-0 z-10 ${row.bold ? 'bg-blue-50 font-semibold text-gray-800' : 'bg-white text-gray-600'}`}>{row.label}</td>
                            <td className="text-right px-4 py-2 bg-gray-100 sticky z-10 border-r border-gray-200" style={{ left: 100 }}>
                              <div className={`font-semibold ${row.totalC < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                {row.totalC === 0 ? <span className="text-gray-300 font-normal">—</span> : row.totalC.toLocaleString()}
                              </div>
                              {hasTentativeData && (
                                <div className={`text-[10px] font-normal leading-tight ${row.totalFull < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                  見込 {row.totalFull === 0 ? '—' : row.totalFull.toLocaleString()}
                                </div>
                              )}
                            </td>
                            {row.values.map((v, i) => {
                              const conf = isConfirmed(i)
                              return (
                                <td key={i} className={`text-right px-3 py-2 ${row.bold ? 'font-semibold' : ''} ${!conf ? 'bg-amber-50/40' : ''} ${v < 0 ? (conf ? 'text-red-600' : 'text-red-300') : (conf ? 'text-gray-800' : 'text-gray-400')}`}>
                                  {v === 0 ? <span className="text-gray-200">—</span> : v.toLocaleString()}
                                </td>
                              )
                            })}
                          </tr>
                          {row.rateValues && (
                            <tr className="border-b bg-blue-50">
                              <td className="px-4 py-1 text-xs text-gray-400 sticky left-0 z-10 bg-blue-50">　{row.label}率</td>
                              <td className="text-right px-4 py-1 text-xs text-gray-500 bg-gray-100 sticky z-10 border-r border-gray-200" style={{ left: 100 }}>
                                {totalSalesC === 0 ? '' : `${(row.totalRateC ?? 0).toFixed(1)}%`}
                              </td>
                              {row.rateValues.map((r, i) => {
                                const conf = isConfirmed(i)
                                return (
                                  <td key={i} className={`text-right px-3 py-1 text-xs ${!conf ? 'bg-amber-50/40' : ''} ${r < 0 ? (conf ? 'text-red-400' : 'text-red-300') : (conf ? 'text-gray-500' : 'text-gray-400')}`}>
                                    {monthlySales[i] === 0 ? '' : `${r.toFixed(1)}%`}
                                  </td>
                                )
                              })}
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
