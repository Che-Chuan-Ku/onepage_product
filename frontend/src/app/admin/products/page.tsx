'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { productApi, productCategoryApi } from '@/lib/api/products'
import { CreateProductSchema, type CreateProductInput } from '@/lib/types/schemas'
import type { ProductDTO, ProductCategoryDTO } from '@/lib/types'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Pagination } from '@/components/ui/Pagination'
import { ImageUploader, type UploadedImage } from '@/components/admin/ImageUploader'
import { clsx } from 'clsx'

function flattenCategories(cats: ProductCategoryDTO[], depth = 0): Array<{ id: number; label: string }> {
  return cats.flatMap((c) => [
    { id: c.id, label: '　'.repeat(depth) + c.name },
    ...flattenCategories(c.children, depth + 1),
  ])
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [categories, setCategories] = useState<ProductCategoryDTO[]>([])
  const [flatCats, setFlatCats] = useState<Array<{ id: number; label: string }>>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [filterStatus, setFilterStatus] = useState<'' | 'ACTIVE' | 'INACTIVE'>('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<ProductDTO | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadImages, setUploadImages] = useState<UploadedImage[]>([])
  const [imageUploadTarget, setImageUploadTarget] = useState<ProductDTO | null>(null)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [pendingImages, setPendingImages] = useState<UploadedImage[]>([])

  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<CreateProductInput>({
    resolver: zodResolver(CreateProductSchema),
    defaultValues: { isBundle: false, isPreorder: false, stockQuantity: 0 },
  })

  const isBundle = watch('isBundle')
  const isPreorder = watch('isPreorder')

  const loadProducts = async () => {
    setLoading(true)
    try {
      const data = await productApi.list({
        status: filterStatus || undefined,
        page,
        size: 20,
      })
      setProducts(data.content)
      setTotalPages(data.totalPages)
    } catch {
      toast.error('載入商品失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    productCategoryApi.list().then((cats) => {
      setCategories(cats)
      setFlatCats(flattenCategories(cats))
    })
  }, [])

  useEffect(() => { loadProducts() }, [page, filterStatus])

  const onSubmit = async (data: CreateProductInput) => {
    setSubmitting(true)
    const formData = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        if (Array.isArray(v)) {
          // For arrays (e.g., bundleProductIds), append each item separately
          v.forEach((item) => formData.append(k, String(item)))
        } else {
          formData.append(k, String(v))
        }
      }
    })
    try {
      await productApi.create(formData)
      toast.success('商品上架成功')
      setIsCreateOpen(false)
      reset()
      loadProducts()
    } catch {
      toast.error('建立商品失敗')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async (product: ProductDTO) => {
    try {
      await productApi.deactivate(product.id)
      toast.success('商品已下架')
      loadProducts()
    } catch {
      toast.error('下架失敗')
    }
    setDeactivateTarget(null)
  }

  const handleDeleteImage = async (imageId: number) => {
    if (!imageUploadTarget) return
    try {
      await productApi.deleteImage(imageUploadTarget.id, imageId)
      setImageUploadTarget({
        ...imageUploadTarget,
        images: imageUploadTarget.images.filter((img) => img.id !== imageId),
      })
      toast.success('圖片已刪除')
      loadProducts()
    } catch {
      toast.error('刪除失敗')
    }
  }

  const handleUploadImages = async () => {
    if (!imageUploadTarget || pendingImages.length === 0) return
    setUploadingImages(true)
    try {
      await productApi.uploadImages(imageUploadTarget.id, pendingImages.map((img) => img.file))
      toast.success('圖片上傳成功')
      setImageUploadTarget(null)
      setPendingImages([])
      loadProducts()
    } catch {
      toast.error('圖片上傳失敗')
    } finally {
      setUploadingImages(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-olive-900 font-semibold">商品管理</h1>
        <button onClick={() => setIsCreateOpen(true)} className="btn-primary text-sm">
          + 上架商品
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as '' | 'ACTIVE' | 'INACTIVE'); setPage(0) }}
          className="input-field w-auto text-sm"
        >
          <option value="">全部狀態</option>
          <option value="ACTIVE">已上架</option>
          <option value="INACTIVE">已下架</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner className="py-20" />
      ) : (
        <>
          <div className="bg-white border border-cream-200">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">商品名稱</th>
                  <th className="table-header">類型</th>
                  <th className="table-header">售價</th>
                  <th className="table-header">庫存</th>
                  <th className="table-header">狀態</th>
                  <th className="table-header">操作</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="table-cell">
                      <div className="font-medium text-olive-900">{p.name}</div>
                      <div className="text-xs text-olive-400 mt-0.5">
                        {p.isPreorder && <span className="badge-preorder mr-1">預購</span>}
                        {p.isBundle && <span className="badge-active mr-1">組合包</span>}
                        {p.slug}
                      </div>
                    </td>
                    <td className="table-cell text-olive-500">{p.categoryName}</td>
                    <td className="table-cell">NT${p.price.toLocaleString()}<span className="text-xs text-olive-400 ml-1">/{p.priceUnit === 'KG' ? '公斤' : '台斤'}</span></td>
                    <td className="table-cell">
                      <span className={clsx(p.stockQuantity <= 10 ? 'text-terra-500 font-semibold' : 'text-olive-700')}>
                        {p.stockQuantity}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={clsx(p.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive')}>
                        {p.status === 'ACTIVE' ? '已上架' : '已下架'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => { setImageUploadTarget(p); setPendingImages([]) }}
                          className="text-olive-500 hover:text-olive-700 text-xs"
                          title="管理圖片"
                        >
                          圖片
                        </button>
                        {p.status === 'ACTIVE' && (
                          <button
                            onClick={() => setDeactivateTarget(p)}
                            className="text-terra-500 hover:text-terra-700 text-sm"
                          >
                            下架
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); reset() }} title="上架商品" maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">商品名稱 *</label>
              <input className="input-field" {...register('name')} />
              {errors.name && <p className="text-terra-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="label">售價 *</label>
              <input type="number" step="0.01" className="input-field" {...register('price', { valueAsNumber: true })} />
              {errors.price && <p className="text-terra-500 text-xs mt-1">{errors.price.message}</p>}
            </div>

            <div>
              <label className="label">計價單位 *</label>
              <select className="input-field" {...register('priceUnit')}>
                <option value="KG">公斤</option>
                <option value="CATTY">台斤</option>
              </select>
            </div>

            <div>
              <label className="label">商品分類 *</label>
              <select className="input-field" {...register('categoryId', { valueAsNumber: true })}>
                <option value="">請選擇</option>
                {flatCats.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              {errors.categoryId && <p className="text-terra-500 text-xs mt-1">{errors.categoryId.message}</p>}
            </div>

            <div>
              <label className="label">初始庫存 *</label>
              <input type="number" className="input-field" {...register('stockQuantity', { valueAsNumber: true })} />
            </div>

            <div className="col-span-2">
              <label className="label">包裝規格</label>
              <input className="input-field" {...register('packaging')} placeholder="例：3入禮盒 / 6入禮盒" />
            </div>

            <div className="col-span-2">
              <label className="label">商品描述</label>
              <textarea rows={3} className="input-field" {...register('description')} />
            </div>

            <div className="col-span-2 flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('isBundle')} className="accent-olive-700" />
                <span className="text-sm text-olive-700">組合包</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('isPreorder')} className="accent-olive-700" />
                <span className="text-sm text-olive-700">預購商品</span>
              </label>
            </div>

            {isBundle && (
              <>
                <div className="col-span-2">
                  <label className="label">組合包折扣（%）</label>
                  <input type="number" step="0.01" className="input-field" {...register('bundleDiscountPercent', { valueAsNumber: true })} />
                </div>
                <div className="col-span-2">
                  <label className="label">選擇包含的商品 *</label>
                  <select
                    multiple
                    className="input-field h-28"
                    {...register('bundleProductIds', { valueAsNumber: true })}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {errors.bundleProductIds && <p className="text-terra-500 text-xs mt-1">{errors.bundleProductIds.message}</p>}
                  <p className="text-xs text-olive-400 mt-1">按住 Ctrl 可多選</p>
                </div>
              </>
            )}

            {isPreorder && (
              <>
                <div>
                  <label className="label">預購開始日</label>
                  <input type="date" className="input-field" {...register('preorderStartDate')} />
                </div>
                <div>
                  <label className="label">預購結束日 *</label>
                  <input type="date" className="input-field" {...register('preorderEndDate')} />
                  {errors.preorderEndDate && <p className="text-terra-500 text-xs mt-1">{errors.preorderEndDate.message}</p>}
                </div>
                <div>
                  <label className="label">預購折扣（%）</label>
                  <input type="number" step="0.01" className="input-field" {...register('preorderDiscountPercent', { valueAsNumber: true })} />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setIsCreateOpen(false); reset() }} className="btn-secondary text-sm">
              取消
            </button>
            <button type="submit" disabled={submitting} className="btn-primary text-sm">
              {submitting ? '上架中...' : '上架商品'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deactivateTarget}
        title="下架商品"
        message={`確定要下架「${deactivateTarget?.name}」嗎？下架後顧客將無法購買。`}
        confirmLabel="下架"
        variant="danger"
        onConfirm={() => deactivateTarget && handleDeactivate(deactivateTarget)}
        onCancel={() => setDeactivateTarget(null)}
      />

      {/* Image Upload Modal - REQ-026 */}
      <Modal
        isOpen={!!imageUploadTarget}
        onClose={() => { setImageUploadTarget(null); setPendingImages([]) }}
        title={`商品圖片管理 — ${imageUploadTarget?.name ?? ''}`}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          {/* Existing images */}
          {imageUploadTarget && imageUploadTarget.images.length > 0 && (
            <div>
              <p className="label mb-2">現有圖片（{imageUploadTarget.images.length} 張）</p>
              <div className="flex flex-wrap gap-2">
                {imageUploadTarget.images.map((img, idx) => (
                  <div key={img.id} className="relative w-20 h-20 border border-cream-300 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.imageUrl} alt={`圖片 ${idx + 1}`} className="w-full h-full object-cover" />
                    {idx === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-olive-700/80 text-white text-center text-xs py-0.5">主圖</div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.id)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-terra-500 text-white rounded-full text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="刪除圖片"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload new images */}
          <ImageUploader
            images={pendingImages}
            onChange={setPendingImages}
            maxImages={Math.max(0, 5 - (imageUploadTarget?.images.length ?? 0))}
          />

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setImageUploadTarget(null); setPendingImages([]) }}
              className="btn-secondary text-sm"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleUploadImages}
              disabled={uploadingImages || pendingImages.length === 0}
              className="btn-primary text-sm"
            >
              {uploadingImages ? '上傳中...' : `上傳 ${pendingImages.length} 張圖片`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
