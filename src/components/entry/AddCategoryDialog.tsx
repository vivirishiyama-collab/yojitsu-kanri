'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, LargeCategory } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  companyId: string
  largeCategory: LargeCategory
  onClose: () => void
  onAdded: (cat: Category) => void
  existingCount: number
}

export function AddCategoryDialog({ companyId, largeCategory, onClose, onAdded, existingCount }: Props) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('categories')
      .insert({
        company_id: companyId,
        large_category: largeCategory,
        name: name.trim(),
        sort_order: existingCount + 1,
      })
      .select()
      .single()

    if (error) {
      setError('追加に失敗しました。同名の項目が既に存在する可能性があります。')
      setLoading(false)
    } else {
      onAdded(data)
      onClose()
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{largeCategory} に項目を追加</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Label htmlFor="cat-name">項目名</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例：仕入原価（飲料類）"
              className="mt-1"
              autoFocus
            />
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>キャンセル</Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? '追加中...' : '追加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
