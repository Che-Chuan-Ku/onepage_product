'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { productCategoryApi } from '@/lib/api/products'
import { CreateProductCategorySchema, type CreateProductCategoryInput } from '@/lib/types/schemas'
import type { ProductCategoryDTO } from '@/lib/types'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

function CategoryTree({ categories, depth = 0, onEdit, onDelete }: {
  categories: ProductCategoryDTO[]
  depth?: number
  onEdit: (cat: ProductCategoryDTO) => void
  onDelete: (cat: ProductCategoryDTO) => void
}) {
  return (
    <>
      {categories.map((cat) => (
        <div key={cat.id}>
          <div
            className="flex items-center justify-between py-2 px-4 border-t border-cream-100 hover:bg-cream-50"
            style={{ paddingLeft: `${16 + depth * 24}px` }}
          >
            <div className="flex items-center gap-2">
              {depth > 0 && <span className="text-olive-300">└─</span>}
              <span className="text-olive-800 font-body">{cat.name}</span>
              {cat.children.length > 0 && (
                <span className="text-xs text-olive-400">（{cat.children.length} 子分類）</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(cat); }}
                className="text-xs text-olive-500 hover:text-olive-700"
              >
                編輯
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(cat); }}
                className="text-xs text-terra-500 hover:text-terra-700"
              >
                刪除
              </button>
            </div>
          </div>
          {cat.children.length > 0 && (
            <CategoryTree categories={cat.children} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
          )}
        </div>
      ))}
    </>
  )
}

function flattenCategories(cats: ProductCategoryDTO[], depth = 0): Array<{ id: number; label: string }> {
  return cats.flatMap((c) => [
    { id: c.id, label: '　'.repeat(depth) + c.name },
    ...flattenCategories(c.children, depth + 1),
  ])
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<ProductCategoryDTO[]>([])
  const [flatCats, setFlatCats] = useState<Array<{ id: number; label: string }>>([])
  const [loading, setLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ProductCategoryDTO | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductCategoryDTO | null>(null)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateProductCategoryInput>({
    resolver: zodResolver(CreateProductCategorySchema),
  })

  const { register: editRegister, handleSubmit: editHandleSubmit, formState: { errors: editErrors }, reset: editReset, setValue } = useForm<{ name: string }>()

  const load = async () => {
    try {
      const data = await productCategoryApi.list()
      setCategories(data)
      setFlatCats(flattenCategories(data))
    } catch {
      toast.error('載入分類失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onCreateSubmit = async (data: CreateProductCategoryInput) => {
    try {
      await productCategoryApi.create(data)
      toast.success('分類建立成功')
      setIsCreateOpen(false)
      reset()
      load()
    } catch {
      toast.error('建立失敗')
    }
  }

  const onDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await productCategoryApi.delete(deleteTarget.id)
      toast.success('分類刪除成功')
      setDeleteTarget(null)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '刪除失敗')
    }
  }

  const onEditOpen = (cat: ProductCategoryDTO) => {
    setEditTarget(cat)
    setValue('name', cat.name)
  }

  const onEditSubmit = async (data: { name: string }) => {
    if (!editTarget) return
    try {
      await productCategoryApi.update(editTarget.id, data.name)
      toast.success('分類更新成功')
      setEditTarget(null)
      editReset()
      load()
    } catch {
      toast.error('更新失敗')
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-olive-900 font-semibold">商品類型管理</h1>
        <button onClick={() => setIsCreateOpen(true)} className="btn-primary text-sm">
          + 新增分類
        </button>
      </div>

      {loading ? (
        <LoadingSpinner className="py-20" />
      ) : (
        <div className="bg-white border border-cream-200">
          <div className="px-4 py-3 border-b border-cream-200 bg-olive-50">
            <span className="text-xs font-semibold text-olive-600 uppercase tracking-wider">分類名稱</span>
          </div>
          <CategoryTree categories={categories} onEdit={onEditOpen} onDelete={(cat) => setDeleteTarget(cat)} />
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); reset() }} title="新增商品分類">
        <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-4">
          <div>
            <label className="label">分類名稱 *</label>
            <input className="input-field" {...register('name')} />
            {errors.name && <p className="text-terra-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">父分類（留空為主分類）</label>
            <select className="input-field" {...register('parentId', { valueAsNumber: true })}>
              <option value="">— 主分類 —</option>
              {flatCats.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setIsCreateOpen(false); reset() }} className="btn-secondary text-sm">取消</button>
            <button type="submit" className="btn-primary text-sm">建立</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="刪除分類">
        <div className="space-y-4">
          <p className="text-olive-700">確定要刪除「{deleteTarget?.name}」嗎？此操作無法復原。</p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary text-sm">取消</button>
            <button type="button" onClick={onDeleteConfirm} className="btn-danger text-sm bg-terra-500 text-white px-4 py-2 rounded hover:bg-terra-600">刪除</button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editTarget} onClose={() => { setEditTarget(null); editReset() }} title="編輯分類名稱">
        <form onSubmit={editHandleSubmit(onEditSubmit)} className="space-y-4">
          <div>
            <label className="label">分類名稱 *</label>
            <input className="input-field" {...editRegister('name', { required: '請輸入名稱' })} />
            {editErrors.name && <p className="text-terra-500 text-xs mt-1">{editErrors.name.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setEditTarget(null); editReset() }} className="btn-secondary text-sm">取消</button>
            <button type="submit" className="btn-primary text-sm">更新</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
