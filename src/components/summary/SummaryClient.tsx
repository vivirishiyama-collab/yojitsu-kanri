'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Company, Category, MonthlyEntry, MonthlyStatus, LargeCategory } from '@/lib/types'
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
  statuses: MonthlyStatus[]
}

function fmt(n: number): string {
  if (n === 0) return '—'
  return n.toLocaleString()
}

function pct(n: number): string {
  return n.toFixed(1) + '%'
}

export function SummaryClient({ company, companies, userEmail, year, categories, entries, statuses }: Props) {
  const router = useRouter()
  const yearNum = parseInt(year, 10)

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)

  // 確定済みの月（confirmed=true）のセット
  const confirmedSet = new Set(statuses.filter(s => s.confirmed).map(s => s.year_month))
  const isConfirmed = (i: number) => confirmedSet.has(months[i])

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

  // 年間合計（全月＝見込）
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  // 確定分合計（確定済みの月だけ）
  const sumC = (arr: number[]) => arr.reduce((a, b, i) => a + (isConfirmed(i) ? b : 0), 0)

  const totalSales    = sum(monthlySales)
  const totalCogs     = sum(monthlyCogs)
  const totalOpex     = sum(monthlyOpex)
  const totalGross    = totalSales - totalCogs
  const totalOpIncome = totalGross - totalOpex
  const totalGrossRate    = totalSales > 0 ? totalGross / totalSales * 100 : 0
  const totalOpIncomeRate = totalSales > 0 ? totalOpIncome / totalSales * 100 : 0

  const totalSalesC    = sumC(monthlySales)
  const totalCogsC     = sumC(monthlyCogs)
  const totalOpexC     = sumC(monthlyOpex)
  const totalGrossC    = totalSalesC - totalCogsC
  const totalOpIncomeC = totalGrossC - totalOpexC
  const totalGrossRateC    = totalSalesC > 0 ? totalGrossC / totalSalesC * 100 : 0
  const totalOpIncomeRateC = totalSalesC > 0 ? totalOpIncomeC / totalSalesC * 100 : 0

  // 先入力（未確定）の月に数字が入っているか＝確定合計と見込合計に差が出るか
  const hasTentativeData = months.some((_, i) =>
    !isConfirmed(i) && (monthlySales[i] !== 0 || monthlyCogs[i] !== 0 || monthlyOpex[i] !== 0)
  )
  const confirmedCount = months.filter((_, i) => isConfirmed(i)).length

  const rows = [
    {
      label: '売上（税抜き）',
      values: monthlySales,
      totalC: totalSalesC,
      totalFull: totalSales,
      rate: null as number[] | null,
      totalRateC: null as number | null,
      bold: true,
      highlight: false,
    },
    {
      label: '販売原価（税抜き）',
      values: monthlyCogs,
      totalC: totalCogsC,
      totalFull: totalCogs,
      rate: null,
      totalRateC: null,
      bold: false,
      highlight: false,
    },
    {
      label: '粗利',
      values: monthlyGross,
      totalC: totalGrossC,
      totalFull: totalGross,
      rate: monthlyGrossRate,
      totalRateC: totalGrossRateC,
      bold: true,
      highlight: true,
    },
    {
      label: '販管費（税抜き）',
      values: monthlyOpex,
      totalC: totalOpexC,
      totalFull: totalOpex,
      rate: null,
      totalRateC: null,
      bold: false,
      highlight: false,
    },
    {
      label: '営業利益',
      values: monthlyOpIncome,
      totalC: totalOpIncomeC,
      totalFull: totalOpIncome,
      rate: monthlyOpIncomeRate,
      totalRateC: totalOpIncomeRateC,
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

        {/* 凡例 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-white rounded-xl shadow-sm px-4 py-2.5 text-xs text-gray-500">
          <span className="font-medium text-gray-700">確定 {confirmedCount}か月分</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-white border border-gray-300"></span>確定＝合計に反映</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-amber-50 border border-amber-200"></span>先入力(見込)＝合計から除外</span>
          <span className="text-gray-400">月の確定/解除は各月の入力画面の「この月を確定」ボタンから</span>
        </div>

        {/* テーブル */}
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="table-fixed text-sm" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10" style={{ width: 140, minWidth: 140 }}>項目</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-700 bg-gray-100 sticky z-10 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]" style={{ width: 120, minWidth: 120, left: 140 }}>
                  <div className="leading-tight">確定合計</div>
                  {hasTentativeData && <div className="text-[10px] font-normal text-gray-400 leading-tight">（見込＝全月）</div>}
                </th>
                {months.map((m, i) => {
                  const conf = isConfirmed(i)
                  return (
                    <th key={m} className={`text-right px-3 py-2 font-medium ${conf ? 'text-gray-600' : 'text-amber-600 bg-amber-50/60'}`} style={{ width: 110, minWidth: 110 }}>
                      <button
                        onClick={() => router.push(`/entry/${company.id}/${m}`)}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {i + 1}月
                      </button>
                      <div className="text-[10px] font-normal leading-tight">
                        {conf
                          ? <span className="text-gray-400">確定</span>
                          : <span className="text-amber-500">先入力</span>}
                      </div>
                    </th>
                  )
                })}
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
                    <td className="text-right px-4 py-2 bg-gray-100 sticky z-10 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]" style={{ left: 140 }}>
                      <div className={`font-semibold ${row.totalC < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                        {row.totalC === 0 ? <span className="text-gray-300">—</span> : row.totalC.toLocaleString()}
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
                        <td
                          key={i}
                          className={`text-right px-3 py-2 ${row.bold ? 'font-semibold' : ''} ${!conf ? 'bg-amber-50/40' : ''} ${v < 0 ? (conf ? 'text-red-600' : 'text-red-300') : (conf ? 'text-gray-800' : 'text-gray-400')}`}
                        >
                          {v === 0 ? <span className="text-gray-300">—</span> : v.toLocaleString()}
                        </td>
                      )
                    })}
                  </tr>
                  {/* 率行（粗利・営業利益のみ） */}
                  {row.rate && (
                    <tr key={`rate-${rowIdx}`} className={`border-b ${row.highlight ? 'bg-blue-50' : ''}`}>
                      <td className={`px-4 py-1 text-xs sticky left-0 z-10 ${row.highlight ? 'bg-blue-50' : 'bg-white'} text-gray-400`}>
                        　{row.label.replace('（税抜き）', '')}率
                      </td>
                      <td className={`text-right px-4 py-1 text-xs bg-gray-100 sticky z-10 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] ${(row.totalRateC ?? 0) < 0 ? 'text-red-400' : 'text-gray-500'}`} style={{ left: 140 }}>
                        {totalSalesC === 0 ? '' : pct(row.totalRateC ?? 0)}
                      </td>
                      {row.rate.map((r, i) => {
                        const conf = isConfirmed(i)
                        return (
                          <td key={i} className={`text-right px-3 py-1 text-xs ${!conf ? 'bg-amber-50/40' : ''} ${r < 0 ? (conf ? 'text-red-400' : 'text-red-300') : (conf ? 'text-gray-500' : 'text-gray-400')}`}>
                            {monthlySales[i] === 0 ? '' : pct(r)}
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

      </main>
    </div>
  )
}
