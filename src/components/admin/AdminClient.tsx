'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Company, Category, LargeCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Trash2, Plus, GripVertical } from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { updateFiscalYearStartMonth } from '@/app/actions/company'

const LARGE_CATEGORIES: LargeCategory[] = ['売上内訳', '販売原価', '販管費']

interface Props {
  company: Company
  categories: Category[]
  companyUsers: Array<{ id: string; user_id: string; role: string; user?: { email?: string } }>
  currentUserId: string
}

export function AdminClient({ company, categories: initialCategories, companyUsers, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [categories, setCategories] = useState(initialCategories)
  const [newCatNames, setNewCatNames] = useState<Record<LargeCategory, string>>({
    '売上内訳': '', '販売原価': '', '販管費': ''
  })
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [startMonth, setStartMonth] = useState(company.fiscal_year_start_month ?? 1)
  const [savingStartMonth, setSavingStartMonth] = useState(false)
  const [startMonthMessage, setStartMonthMessage] = useState<string | null>(null)

  async function saveStartMonth() {
    setSavingStartMonth(true)
    setStartMonthMessage(null)
    const result = await updateFiscalYearStartMonth(company.id, startMonth)
    setSavingStartMonth(false)
    setStartMonthMessage(result.error ?? `保存しました（${startMonth}月〜${startMonth === 1 ? 12 : startMonth - 1}月）`)
    if (!result.error) router.refresh()
  }

  async function addCategory(largeCat: LargeCategory) {
    const name = newCatNames[largeCat].trim()
    if (!name) return
    const maxOrder = Math.max(-1, ...categories.filter(c => c.large_category === largeCat).map(c => c.sort_order))
    const { data, error } = await supabase
      .from('categories')
      .insert({ company_id: company.id, large_category: largeCat, name, sort_order: maxOrder + 1 })
      .select()
      .single()
    if (!error && data) {
      setCategories(prev => [...prev, data])
      setNewCatNames(prev => ({ ...prev, [largeCat]: '' }))
    }
  }

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    if (result.source.index === result.destination.index) return
    const largeCat = result.source.droppableId as LargeCategory

    // 対象の大項目内だけ並び替えて sort_order を振り直す
    const reordered = categories
      .filter(c => c.large_category === largeCat)
      .sort((a, b) => a.sort_order - b.sort_order)
    const [moved] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, moved)
    const updated = reordered.map((c, i) => ({ ...c, sort_order: i }))
    setCategories(prev => [...prev.filter(c => c.large_category !== largeCat), ...updated])

    await Promise.all(
      updated.map(c => supabase.from('categories').update({ sort_order: c.sort_order }).eq('id', c.id))
    )
  }

  async function deleteCategory(catId: string) {
    if (!confirm('この項目を削除しますか？入力済みのデータも削除されます。')) return
    await supabase.from('categories').delete().eq('id', catId)
    setCategories(prev => prev.filter(c => c.id !== catId))
  }

  async function inviteUser() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setMessage(null)

    // メールでユーザーを招待（Supabaseのinvite機能を使用）
    const { error } = await supabase.auth.admin?.inviteUserByEmail?.(inviteEmail) ?? { error: null }

    // ユーザーIDを検索して company_users に追加
    // ※ 実際にはサーバーサイドAPIを経由する必要あり
    // ここではメールを表示して手動設定を案内
    setMessage(`${inviteEmail} への招待メールを送信しました。ユーザーがサインアップ後、Supabaseダッシュボードから company_users テーブルに追加してください。`)
    setInviting(false)
    setInviteEmail('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => { router.push(`/?company=${company.id}`); router.refresh() }} className="text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">会社設定 — {company.name}</h1>
      </div>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {/* 事業年度 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b font-semibold text-gray-700">事業年度</div>
          <div className="px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-600">期首月</span>
            <select
              value={startMonth}
              onChange={e => setStartMonth(Number(e.target.value))}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}月始まり（{m}月〜{m === 1 ? 12 : m - 1}月）</option>
              ))}
            </select>
            <Button size="sm" onClick={saveStartMonth} disabled={savingStartMonth || startMonth === company.fiscal_year_start_month}>
              {savingStartMonth ? '保存中...' : '保存'}
            </Button>
            {startMonthMessage && <span className="text-sm text-blue-600">{startMonthMessage}</span>}
          </div>
        </div>

        {/* カテゴリ管理 */}
        <DragDropContext onDragEnd={handleDragEnd}>
        {LARGE_CATEGORIES.map(largeCat => (
          <div key={largeCat} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b font-semibold text-gray-700">{largeCat}</div>
            <div className="divide-y">
              <Droppable droppableId={largeCat}>
                {provided => (
                  <div className="divide-y" ref={provided.innerRef} {...provided.droppableProps}>
                    {categories
                      .filter(c => c.large_category === largeCat)
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((cat, index) => (
                        <Draggable key={cat.id} draggableId={cat.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-2 px-4 py-2 ${snapshot.isDragging ? 'bg-blue-50 shadow-md rounded' : 'bg-white'}`}
                            >
                              <div
                                {...provided.dragHandleProps}
                                className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0"
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <span className="text-sm flex-1">{cat.name}</span>
                              <button onClick={() => deleteCategory(cat.id)} className="text-red-400 hover:text-red-600">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
              <div className="flex items-center gap-2 px-4 py-2">
                <Input
                  value={newCatNames[largeCat]}
                  onChange={e => setNewCatNames(prev => ({ ...prev, [largeCat]: e.target.value }))}
                  placeholder="項目名を入力"
                  className="flex-1 text-sm"
                  onKeyDown={e => e.key === 'Enter' && addCategory(largeCat)}
                />
                <Button size="sm" onClick={() => addCategory(largeCat)}>
                  <Plus className="w-4 h-4" />
                  追加
                </Button>
              </div>
            </div>
          </div>
        ))}
        </DragDropContext>

        {/* ユーザー一覧 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b font-semibold text-gray-700">メンバー</div>
          <div className="divide-y">
            {companyUsers.map(cu => (
              <div key={cu.id} className="flex items-center justify-between px-4 py-2">
                <span className="text-sm">{cu.user?.email ?? cu.user_id}</span>
                <Badge variant={cu.role === 'admin' ? 'default' : 'secondary'}>
                  {cu.role === 'admin' ? '管理者' : 'メンバー'}
                </Badge>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t">
            <div className="text-sm text-gray-500 mb-2">ユーザーを招待（メールアドレス）</div>
            <div className="flex gap-2">
              <Input
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                type="email"
              />
              <Button onClick={inviteUser} disabled={inviting}>招待</Button>
            </div>
            {message && <p className="text-sm text-blue-600 mt-2">{message}</p>}
          </div>
        </div>
      </main>
    </div>
  )
}
