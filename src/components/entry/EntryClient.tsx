'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Company, Category, MonthlyEntry, LargeCategory, AmountType } from '@/lib/types'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format, parse, subMonths, addMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Lock, Unlock, Download, Settings, Pencil, Check, X, BarChart2, Trash2, GripVertical } from 'lucide-react'
import { AddCategoryDialog } from './AddCategoryDialog'
import { exportToExcel } from '@/lib/excel'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

const LARGE_CATEGORIES: LargeCategory[] = ['売上内訳', '販売原価', '販管費']
const TAX_RATE = 0.1 // 消費税率10%

interface Props {
  company: Company
  companies: Company[]
  userEmail: string
  userId: string
  yearMonth: string
  categories: Category[]
  entries: MonthlyEntry[]
  userRole: string
}

// 税込み → 税抜き（端数切り捨て）
function calcExcludingTax(includingTax: number): number {
  return Math.floor(includingTax / (1 + TAX_RATE))
}

// 税抜き → 税込み（端数切り捨て）
function calcIncludingTax(excludingTax: number): number {
  return Math.floor(excludingTax * (1 + TAX_RATE))
}

export function EntryClient({
  company, companies, userEmail, userId, yearMonth,
  categories: initialCategories, entries: initialEntries, userRole
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [categories, setCategories] = useState(initialCategories)

  // DBには税抜き金額（amount）のみ保存
  const [entries, setEntries] = useState<Record<string, MonthlyEntry>>(
    Object.fromEntries(initialEntries.map(e => [e.category_id, e]))
  )

  // 税込み入力欄の表示値（カテゴリID → 税込み金額文字列）
  // amount_including_tax が保存済みならそれを使用、なければ amount から逆算（既存データの互換性）
  const [taxIncludedInputs, setTaxIncludedInputs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    initialEntries.forEach(e => {
      if (e.amount_including_tax != null) {
        init[e.category_id] = String(e.amount_including_tax)
      } else if (e.amount != null) {
        init[e.category_id] = String(calcIncludingTax(e.amount))
      }
    })
    return init
  })

  // 税抜き入力欄の表示値（カテゴリID → 税抜き金額文字列）
  const [taxExcludedInputs, setTaxExcludedInputs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    initialEntries.forEach(e => {
      if (e.amount !== null) {
        init[e.category_id] = String(e.amount)
      }
    })
    return init
  })

  const [saving, setSaving] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState<LargeCategory | null>(null)
  // フォーカス中の入力欄を管理（フォーカス中は生の数字、外れたらカンマ付き表示）
  const [focusedInput, setFocusedInput] = useState<string | null>(null)

  // 項目名編集用ステート（カテゴリID → 編集中の名前）
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState<string>('')
  const editInputRef = useRef<HTMLInputElement>(null)

  // editingCatIdが変わったとき、少し遅延してフォーカス（IMEをひらがなモードのまま維持するため）
  useEffect(() => {
    if (editingCatId) {
      const timer = setTimeout(() => {
        editInputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [editingCatId])

  const startEditCat = (cat: Category) => {
    setEditingCatId(cat.id)
    setEditingCatName(cat.name)
  }

  const cancelEditCat = () => {
    setEditingCatId(null)
    setEditingCatName('')
  }

  const saveEditCat = async (catId: string) => {
    const name = editingCatName.trim()
    if (!name) return
    const { error } = await supabase
      .from('categories')
      .update({ name })
      .eq('id', catId)
    if (!error) {
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, name } : c))
    }
    setEditingCatId(null)
    setEditingCatName('')
  }

  const date = parse(yearMonth, 'yyyy-MM', new Date())
  const displayMonth = format(date, 'yyyy年M月', { locale: ja })
  const prevMonth = format(subMonths(date, 1), 'yyyy-MM')
  const nextMonth = format(addMonths(date, 1), 'yyyy-MM')

  // カンマ区切り表示用フォーマット（内部状態は数字のみ）
  function formatWithComma(raw: string): string {
    if (!raw) return ''
    const num = parseInt(raw, 10)
    if (isNaN(num)) return raw
    return num.toLocaleString()
  }

  // 全角数字→半角数字変換 + 数字以外を除去
  function toDigits(value: string): string {
    return value
      .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      .replace(/[^0-9]/g, '')
  }

  // 税抜き入力欄の変更 → 数字のみ抽出して保持（表示はカンマ付き）
  const handleExcludingTaxChange = useCallback((categoryId: string, value: string) => {
    setTaxExcludedInputs(prev => ({ ...prev, [categoryId]: toDigits(value) }))
  }, [])

  // 税込み入力欄の変更 → 数字のみ抽出して保持（表示はカンマ付き）
  const handleIncludingTaxChange = useCallback((categoryId: string, value: string) => {
    setTaxIncludedInputs(prev => ({ ...prev, [categoryId]: toDigits(value) }))
  }, [])

  // 税抜き欄からフォーカスが外れたとき：パースして税込みを自動計算 → DB保存
  const handleExcludingBlur = useCallback(async (categoryId: string) => {
    const rawStr = taxExcludedInputs[categoryId] ?? ''
    const numStr = toDigits(rawStr)
    const excludingTax = numStr === '' ? null : parseInt(numStr, 10)
    const includingTax = excludingTax !== null ? calcIncludingTax(excludingTax) : null

    setTaxExcludedInputs(prev => ({ ...prev, [categoryId]: numStr }))
    setTaxIncludedInputs(prev => ({ ...prev, [categoryId]: includingTax !== null ? String(includingTax) : '' }))

    const current = entries[categoryId]
    const updated: MonthlyEntry = {
      id: current?.id ?? '',
      company_id: company.id,
      category_id: categoryId,
      year_month: yearMonth,
      amount: excludingTax,
      amount_including_tax: includingTax,
      amount_type: current?.amount_type ?? 'free',
      status: null,
      note: current?.note ?? null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }
    setEntries(prev => ({ ...prev, [categoryId]: updated }))

    setSaving(categoryId)
    const { data, error } = await supabase
      .from('monthly_entries')
      .upsert({
        company_id: company.id,
        category_id: categoryId,
        year_month: yearMonth,
        amount: excludingTax,
        amount_including_tax: includingTax,
        amount_type: updated.amount_type,
        status: null,
        note: updated.note,
        updated_by: userId,
        updated_at: updated.updated_at,
      }, { onConflict: 'company_id,category_id,year_month' })
      .select()
      .single()
    if (!error && data) {
      setEntries(prev => ({ ...prev, [categoryId]: data }))
    }
    setSaving(null)
  }, [taxExcludedInputs, entries, company.id, yearMonth, userId, supabase])

  // 税込み欄からフォーカスが外れたとき：パースして税抜きを自動計算 → DB保存
  const handleIncludingBlur = useCallback(async (categoryId: string) => {
    const rawStr = taxIncludedInputs[categoryId] ?? ''
    const numStr = toDigits(rawStr)
    const includingTax = numStr === '' ? null : parseInt(numStr, 10)
    const excludingTax = includingTax !== null ? calcExcludingTax(includingTax) : null

    setTaxIncludedInputs(prev => ({ ...prev, [categoryId]: numStr }))
    setTaxExcludedInputs(prev => ({ ...prev, [categoryId]: excludingTax !== null ? String(excludingTax) : '' }))

    const current = entries[categoryId]
    const updated: MonthlyEntry = {
      id: current?.id ?? '',
      company_id: company.id,
      category_id: categoryId,
      year_month: yearMonth,
      amount: excludingTax,
      amount_including_tax: includingTax,
      amount_type: current?.amount_type ?? 'free',
      status: null,
      note: current?.note ?? null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }
    setEntries(prev => ({ ...prev, [categoryId]: updated }))

    setSaving(categoryId)
    const { data, error } = await supabase
      .from('monthly_entries')
      .upsert({
        company_id: company.id,
        category_id: categoryId,
        year_month: yearMonth,
        amount: excludingTax,
        amount_including_tax: includingTax,
        amount_type: updated.amount_type,
        status: null,
        note: updated.note,
        updated_by: userId,
        updated_at: updated.updated_at,
      }, { onConflict: 'company_id,category_id,year_month' })
      .select()
      .single()
    if (!error && data) {
      setEntries(prev => ({ ...prev, [categoryId]: data }))
    }
    setSaving(null)
  }, [taxIncludedInputs, entries, company.id, yearMonth, userId, supabase])

  // 固定/フリー切り替え
  const toggleAmountType = useCallback(async (categoryId: string) => {
    const current = entries[categoryId]
    const newType: AmountType = current?.amount_type === 'fixed' ? 'free' : 'fixed'
    const updated = { ...current, amount_type: newType }
    setEntries(prev => ({ ...prev, [categoryId]: updated as MonthlyEntry }))

    await supabase
      .from('monthly_entries')
      .upsert({
        company_id: company.id,
        category_id: categoryId,
        year_month: yearMonth,
        amount: current?.amount ?? null,
        amount_type: newType,
        status: null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,category_id,year_month' })
  }, [entries, company.id, yearMonth, userId, supabase])

  const handleCategoryAdded = (cat: Category) => {
    setCategories(prev => [...prev, cat])
  }

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    const largeCat = result.source.droppableId as LargeCategory
    if (result.source.index === result.destination.index) return

    // 対象の大項目内カテゴリを並び替え
    const cats = categories.filter(c => c.large_category === largeCat)
    const others = categories.filter(c => c.large_category !== largeCat)
    const reordered = [...cats]
    const [moved] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, moved)

    // sort_order を更新
    const updated = reordered.map((c, i) => ({ ...c, sort_order: i }))
    setCategories([...others, ...updated].sort((a, b) => {
      const li = LARGE_CATEGORIES.indexOf(a.large_category) - LARGE_CATEGORIES.indexOf(b.large_category)
      return li !== 0 ? li : a.sort_order - b.sort_order
    }))

    // DBに保存
    await Promise.all(
      updated.map(c =>
        supabase.from('categories').update({ sort_order: c.sort_order }).eq('id', c.id)
      )
    )
  }

  const handleDeleteCategory = async (cat: Category) => {
    if (!confirm(`「${cat.name}」を削除しますか？\n過去の入力データも全て消えます。`)) return
    const { error } = await supabase.from('categories').delete().eq('id', cat.id)
    if (!error) {
      setCategories(prev => prev.filter(c => c.id !== cat.id))
      setEntries(prev => { const next = { ...prev }; delete next[cat.id]; return next })
      setTaxExcludedInputs(prev => { const next = { ...prev }; delete next[cat.id]; return next })
      setTaxIncludedInputs(prev => { const next = { ...prev }; delete next[cat.id]; return next })
    }
  }

  // 集計（税抜き金額で計算）
  function calcTotal(largeCat: LargeCategory) {
    return categories
      .filter(c => c.large_category === largeCat)
      .reduce((sum, c) => sum + (entries[c.id]?.amount ?? 0), 0)
  }

  const 売上 = calcTotal('売上内訳')
  const 販売原価 = calcTotal('販売原価')
  const 販管費 = calcTotal('販管費')
  const 粗利 = 売上 - 販売原価
  const 営業利益 = 粗利 - 販管費
  const 粗利率 = 売上 > 0 ? (粗利 / 売上 * 100) : 0
  const 営業利益率 = 売上 > 0 ? (営業利益 / 売上 * 100) : 0

  function formatNumber(n: number | null | undefined) {
    if (n === null || n === undefined) return ''
    return n.toLocaleString()
  }

  function handleExport() {
    exportToExcel({ company, yearMonth, categories, entries })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        companies={companies}
        currentCompany={company}
        onCompanyChange={c => router.push(`/entry/${c.id}/${yearMonth}`)}
        userEmail={userEmail}
      />

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        {/* 月ナビ */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm px-4 py-3">
          <button
            onClick={() => router.push(`/entry/${company.id}/${prevMonth}`)}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800"
          >
            <ChevronLeft className="w-5 h-5" />
            {format(subMonths(date, 1), 'M月', { locale: ja })}
          </button>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-800">{displayMonth}</div>
            <div className="text-sm text-gray-500">{company.name}</div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push(`/summary/${company.id}/${yearMonth.slice(0, 4)}`)} className="flex items-center gap-1">
              <BarChart2 className="w-4 h-4" />
              年間サマリー
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="flex items-center gap-1">
              <Download className="w-4 h-4" />
              Excel出力
            </Button>
            {userRole === 'admin' && (
              <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/${company.id}`)}>
                <Settings className="w-4 h-4" />
              </Button>
            )}
            <button
              onClick={() => router.push(`/entry/${company.id}/${nextMonth}`)}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-800"
            >
              {format(addMonths(date, 1), 'M月', { locale: ja })}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* サマリー（税抜き金額で表示） */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: '売上（税抜き）', value: 売上, highlight: false },
            { label: '販売原価（税抜き）', value: 販売原価, highlight: false },
            { label: `粗利 (${粗利率.toFixed(1)}%)`, value: 粗利, highlight: 粗利 < 0 },
            { label: '販管費（税抜き）', value: 販管費, highlight: false },
            { label: `営業利益 (${営業利益率.toFixed(1)}%)`, value: 営業利益, highlight: 営業利益 < 0 },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-lg shadow-sm p-3">
              <div className="text-xs text-gray-500">{item.label}</div>
              <div className={`text-lg font-bold ${item.highlight ? 'text-red-600' : 'text-gray-800'}`}>
                ¥{formatNumber(item.value)}
              </div>
            </div>
          ))}
        </div>

        {/* 入力テーブル */}
        <DragDropContext onDragEnd={handleDragEnd}>
          {LARGE_CATEGORIES.map(largeCat => {
            const cats = categories.filter(c => c.large_category === largeCat)
            const total = calcTotal(largeCat)
            return (
              <div key={largeCat} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* ヘッダー行 */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                  <h2 className="font-semibold text-gray-700">{largeCat}</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600">合計（税抜き）: ¥{formatNumber(total)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddDialog(largeCat)}
                      className="flex items-center gap-1 text-blue-600"
                    >
                      <Plus className="w-4 h-4" />
                      項目追加
                    </Button>
                  </div>
                </div>

                {/* 列ラベル */}
                {cats.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-1 bg-gray-50 border-b text-xs text-gray-400">
                    <span className="w-4 flex-shrink-0"></span>
                    <span className="flex-1">項目名</span>
                    <span className="w-20 text-center">翌月の金額</span>
                    <span className="w-36 text-right pr-2">税抜き金額（円）</span>
                    <span className="w-36 text-right pr-2">税込み金額（円）</span>
                    <span className="w-10"></span>
                  </div>
                )}

                {cats.length === 0 ? (
                  <div className="text-center text-gray-400 py-6 text-sm">
                    項目がありません。「項目追加」から追加してください
                  </div>
                ) : (
                  <Droppable droppableId={largeCat}>
                    {provided => (
                      <div
                        className="divide-y divide-gray-100"
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {cats.map((cat, index) => {
                          const entry = entries[cat.id]
                          const isFixed = entry?.amount_type === 'fixed'
                          const isSaving = saving === cat.id
                          const excludingTaxValue = taxExcludedInputs[cat.id] ?? ''
                          const includingTaxValue = taxIncludedInputs[cat.id] ?? ''

                          return (
                            <Draggable key={cat.id} draggableId={cat.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`flex items-center gap-2 px-4 py-2 ${snapshot.isDragging ? 'bg-blue-50 shadow-md rounded' : ''}`}
                                >
                                  {/* ドラッグハンドル */}
                                  <div
                                    {...provided.dragHandleProps}
                                    className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0"
                                  >
                                    <GripVertical className="w-4 h-4" />
                                  </div>

                                  {/* 項目名（編集可能） */}
                                  {editingCatId === cat.id ? (
                                    <div className="flex-1 flex items-center gap-1">
                                      <Input
                                        ref={editInputRef}
                                        value={editingCatName}
                                        onChange={e => setEditingCatName(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') saveEditCat(cat.id)
                                          if (e.key === 'Escape') cancelEditCat()
                                        }}
                                        className="h-7 text-sm"
                                      />
                                      <button onClick={() => saveEditCat(cat.id)} className="text-green-600 hover:text-green-700">
                                        <Check className="w-4 h-4" />
                                      </button>
                                      <button onClick={cancelEditCat} className="text-gray-400 hover:text-gray-600">
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex-1 flex items-center gap-1 group">
                                      <span className="text-sm text-gray-700">{cat.name}</span>
                                      <button
                                        onClick={() => startEditCat(cat)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-gray-500"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteCategory(cat)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}

                                  {/* 金額タイプトグル */}
                                  <button
                                    onClick={() => toggleAmountType(cat.id)}
                                    title={isFixed ? 'クリックで「金額変動」に切り替え' : 'クリックで「金額固定」に切り替え'}
                                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors flex-shrink-0 w-20 justify-center ${
                                      isFixed
                                        ? 'border-blue-300 bg-blue-50 text-blue-600'
                                        : 'border-gray-200 bg-white text-gray-400 hover:border-blue-200 hover:text-blue-500'
                                    }`}
                                  >
                                    {isFixed
                                      ? <><Lock className="w-3 h-3" />金額固定</>
                                      : <><Unlock className="w-3 h-3" />金額変動</>}
                                  </button>

                                  {/* 税抜き金額入力欄 */}
                                  <div className="relative w-36 flex-shrink-0">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">税抜</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={focusedInput === `exc-${cat.id}` ? excludingTaxValue : formatWithComma(excludingTaxValue)}
                                      onChange={e => handleExcludingTaxChange(cat.id, e.target.value)}
                                      onFocus={() => setFocusedInput(`exc-${cat.id}`)}
                                      onBlur={() => { setFocusedInput(null); handleExcludingBlur(cat.id) }}
                                      className={`h-8 w-full rounded-lg border border-input px-2.5 py-1 text-sm text-right pl-9 outline-none focus:border-ring focus:ring-2 focus:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed ${isFixed ? 'bg-blue-50' : 'bg-transparent'}`}
                                      placeholder="0"
                                      disabled={isSaving}
                                    />
                                  </div>

                                  {/* 税込み金額入力欄 */}
                                  <div className="relative w-36 flex-shrink-0">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">税込</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={focusedInput === `inc-${cat.id}` ? includingTaxValue : formatWithComma(includingTaxValue)}
                                      onChange={e => handleIncludingTaxChange(cat.id, e.target.value)}
                                      onFocus={() => setFocusedInput(`inc-${cat.id}`)}
                                      onBlur={() => { setFocusedInput(null); handleIncludingBlur(cat.id) }}
                                      className={`h-8 w-full rounded-lg border border-input px-2.5 py-1 text-sm text-right pl-9 outline-none focus:border-ring focus:ring-2 focus:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed ${isFixed ? 'bg-blue-50' : 'bg-transparent'}`}
                                      placeholder="0"
                                      disabled={isSaving}
                                    />
                                  </div>

                                  {isSaving
                                    ? <span className="text-xs text-gray-400 w-10 flex-shrink-0">保存中</span>
                                    : <span className="w-10 flex-shrink-0"></span>
                                  }
                                </div>
                              )}
                            </Draggable>
                          )
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                )}
              </div>
            )
          })}
        </DragDropContext>
      </main>

      {/* カテゴリ追加ダイアログ */}
      {showAddDialog && (
        <AddCategoryDialog
          companyId={company.id}
          largeCategory={showAddDialog}
          onClose={() => setShowAddDialog(null)}
          onAdded={handleCategoryAdded}
          existingCount={categories.filter(c => c.large_category === showAddDialog).length}
        />
      )}
    </div>
  )
}
