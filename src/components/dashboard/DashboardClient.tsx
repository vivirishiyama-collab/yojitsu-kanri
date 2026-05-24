'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Company } from '@/lib/types'
import { Header } from '@/components/layout/Header'
import { format, subMonths, addMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'

interface Props {
  companies: Company[]
  userEmail: string
  userId: string
}

export function DashboardClient({ companies, userEmail }: Props) {
  const router = useRouter()
  const [currentCompany, setCurrentCompany] = useState<Company | null>(
    companies.length > 0 ? companies[0] : null
  )
  const [currentDate, setCurrentDate] = useState(new Date())

  const yearMonth = format(currentDate, 'yyyy-MM')
  const displayMonth = format(currentDate, 'yyyy年M月', { locale: ja })

  function goPrev() {
    setCurrentDate(d => subMonths(d, 1))
  }
  function goNext() {
    setCurrentDate(d => addMonths(d, 1))
  }
  function goToEntry() {
    if (!currentCompany) return
    router.push(`/entry/${currentCompany.id}/${yearMonth}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        companies={companies}
        currentCompany={currentCompany}
        onCompanyChange={setCurrentCompany}
        userEmail={userEmail}
      />

      <main className="max-w-3xl mx-auto p-6">
        {!currentCompany ? (
          <div className="text-center text-gray-500 py-20">
            <p className="text-lg">所属する会社がありません</p>
            <p className="text-sm mt-2">管理者に会社への招待を依頼してください</p>
          </div>
        ) : (
          <div className="space-y-6">
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

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">クイックアクセス</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[-2, -1, 0, 1, 2, 3].map(offset => {
                  const d = addMonths(new Date(), offset)
                  const ym = format(d, 'yyyy-MM')
                  const label = format(d, 'M月', { locale: ja })
                  const isCurrentMonth = offset === 0
                  return (
                    <button
                      key={ym}
                      onClick={() => router.push(`/entry/${currentCompany.id}/${ym}`)}
                      className={`rounded-lg border p-3 text-left transition-colors hover:bg-blue-50 hover:border-blue-300 ${
                        isCurrentMonth ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="text-xs text-gray-500">{format(d, 'yyyy年', { locale: ja })}</div>
                      <div className={`text-lg font-bold ${isCurrentMonth ? 'text-blue-600' : 'text-gray-800'}`}>
                        {label}
                        {isCurrentMonth && <span className="text-xs font-normal ml-1">今月</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
