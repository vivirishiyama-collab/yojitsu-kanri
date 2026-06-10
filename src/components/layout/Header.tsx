'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Company } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, LogOut, Building2, Plus } from 'lucide-react'
import { createCompany } from '@/app/actions/company'

interface HeaderProps {
  companies: Company[]
  currentCompany: Company | null
  onCompanyChange: (company: Company) => void
  userEmail?: string
}

export function Header({ companies, currentCompany, onCompanyChange, userEmail }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleAddCompany() {
    if (!newCompanyName.trim()) return
    setAdding(true)
    setAddError('')
    const result = await createCompany(newCompanyName)
    setAdding(false)
    if (result.error) {
      setAddError(result.error)
      return
    }
    setShowAddDialog(false)
    setNewCompanyName('')
    router.refresh()
    if (result.companyId) router.push(`/?company=${result.companyId}`)
  }

  return (
    <>
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/')} className="flex items-center gap-1.5 text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors px-2 py-1 rounded-md hover:bg-blue-50">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          収支管理
        </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors">
              <Building2 className="w-4 h-4" />
              {currentCompany?.name ?? '会社を選択'}
              <ChevronDown className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {companies.map(company => (
                <DropdownMenuItem
                  key={company.id}
                  onClick={() => onCompanyChange(company)}
                  className={currentCompany?.id === company.id ? 'bg-blue-50 text-blue-700 font-medium' : ''}
                >
                  {company.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => { setShowAddDialog(true); setAddError('') }} className="text-blue-600 font-medium">
                <Plus className="w-4 h-4 mr-1" />会社を追加
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>

      <div className="flex items-center gap-3">
        {userEmail && (
          <span className="text-sm text-gray-500 hidden sm:inline">{userEmail}</span>
        )}
        <Button variant="ghost" size="sm" onClick={handleLogout} className="flex items-center gap-1">
          <LogOut className="w-4 h-4" />
          ログアウト
        </Button>
      </div>
    </header>

      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddDialog(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-800 mb-4">会社を追加</h2>
            <input
              type="text"
              value={newCompanyName}
              onChange={e => setNewCompanyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCompany()}
              placeholder="会社名を入力"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mb-2"
              autoFocus
            />
            {addError && <p className="text-xs text-red-500 mb-2">{addError}</p>}
            <div className="flex gap-2 justify-end mt-3">
              <button onClick={() => setShowAddDialog(false)} className="px-4 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">キャンセル</button>
              <button onClick={handleAddCompany} disabled={adding || !newCompanyName.trim()} className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {adding ? '作成中...' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
