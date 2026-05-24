'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Company } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, LogOut, Building2 } from 'lucide-react'

interface HeaderProps {
  companies: Company[]
  currentCompany: Company | null
  onCompanyChange: (company: Company) => void
  userEmail?: string
}

export function Header({ companies, currentCompany, onCompanyChange, userEmail }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => router.push('/')}>収支管理</h1>

        {companies.length > 0 && (
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
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
  )
}
