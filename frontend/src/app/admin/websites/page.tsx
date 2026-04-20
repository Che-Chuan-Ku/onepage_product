'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { websiteApi } from '@/lib/api/websites'
import { CreateWebsiteSchema, UpdateWebsiteSchema, type CreateWebsiteInput, type UpdateWebsiteInput } from '@/lib/types/schemas'
import type { WebsiteDTO } from '@/lib/types'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { clsx } from 'clsx'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已上線',
  OFFLINE: '已下線',
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-draft',
  PUBLISHED: 'badge-published',
  OFFLINE: 'badge-offline',
}

export default function AdminWebsitesPage() {
  const [websites, setWebsites] = useState<WebsiteDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<WebsiteDTO | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'publish' | 'unpublish' | 'republish'
    website: WebsiteDTO
  } | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [promoFile, setPromoFile] = useState<File | null>(null)
  const [editBannerFile, setEditBannerFile] = useState<File | null>(null)
  const [editPromoFile, setEditPromoFile] = useState<File | null>(null)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateWebsiteInput>({
    resolver: zodResolver(CreateWebsiteSchema),
    defaultValues: { freeShippingThreshold: 1500 },
  })

  const editForm = useForm<UpdateWebsiteInput>({
    resolver: zodResolver(UpdateWebsiteSchema),
  })

  const load = async () => {
    try {
      const data = await websiteApi.list()
      setWebsites(data)
    } catch {
      toast.error('載入網站清單失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onSubmit = async (data: CreateWebsiteInput) => {
    const formData = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== '') formData.append(k, String(v))
    })
    if (bannerFile) formData.append('bannerImage', bannerFile)
    if (promoFile) formData.append('promoImage', promoFile)
    try {
      await websiteApi.create(formData)
      toast.success('網站建立成功')
      setIsCreateOpen(false)
      reset()
      setBannerFile(null)
      setPromoFile(null)
      load()
    } catch {
      toast.error('建立網站失敗')
    }
  }

  const handlePublish = async (website: WebsiteDTO) => {
    try {
      await websiteApi.publish(website.id)
      toast.success('網站已上線')
      load()
    } catch {
      toast.error('操作失敗')
    }
    setConfirmAction(null)
  }

  const handleUnpublish = async (website: WebsiteDTO) => {
    try {
      await websiteApi.unpublish(website.id)
      toast.success('網站已下線')
      load()
    } catch {
      toast.error('操作失敗')
    }
    setConfirmAction(null)
  }

  const handleRepublish = async (website: WebsiteDTO) => {
    try {
      await websiteApi.republish(website.id)
      toast.success('網站已重新上線')
      load()
    } catch {
      toast.error('操作失敗')
    }
    setConfirmAction(null)
  }

  const openEdit = (website: WebsiteDTO) => {
    setEditTarget(website)
    setEditBannerFile(null)
    setEditPromoFile(null)
    editForm.reset({
      name: website.name,
      title: website.title ?? '',
      subtitle: website.subtitle ?? '',
      browserTitle: website.browserTitle ?? '',
      subscriptionPlan: website.subscriptionPlan,
      freeShippingThreshold: website.freeShippingThreshold,
      footerTitle: website.footerTitle ?? '',
      footerSubtitle: website.footerSubtitle ?? '',
    })
  }

  const onEditSubmit = async (data: UpdateWebsiteInput) => {
    if (!editTarget) return
    const formData = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined) formData.append(k, String(v ?? ''))
    })
    if (editBannerFile) formData.append('bannerImage', editBannerFile)
    if (editPromoFile) formData.append('promoImage', editPromoFile)
    try {
      await websiteApi.update(editTarget.id, formData)
      toast.success('網站設定已更新')
      setEditTarget(null)
      setEditBannerFile(null)
      setEditPromoFile(null)
      load()
    } catch {
      toast.error('更新失敗')
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-olive-900 font-semibold">網站管理</h1>
        <button onClick={() => setIsCreateOpen(true)} className="btn-primary text-sm">
          + 建立網站
        </button>
      </div>

      {loading ? (
        <LoadingSpinner className="py-20" />
      ) : (
        <div className="grid gap-4">
          {websites.map((w) => (
            <div key={w.id} className="bg-white border border-cream-200 p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-display text-lg text-olive-900 font-semibold">{w.name}</h2>
                  <span className={clsx(STATUS_BADGE[w.status])}>{STATUS_LABEL[w.status]}</span>
                </div>
                <p className="text-sm text-olive-500 font-body">
                  方案：{w.subscriptionPlan || '—'} ｜
                  免運門檻：NT${w.freeShippingThreshold.toLocaleString()} ｜
                  前台：
                  <Link href={w.storefrontUrl} target="_blank" className="text-olive-600 underline">
                    {w.storefrontUrl}
                  </Link>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/websites/${w.id}/products`}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  上架商品
                </Link>
                <button
                  onClick={() => openEdit(w)}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  設定
                </button>
                {w.status === 'DRAFT' && (
                  <button
                    onClick={() => setConfirmAction({ type: 'publish', website: w })}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    啟用
                  </button>
                )}
                {w.status === 'PUBLISHED' && (
                  <button
                    onClick={() => setConfirmAction({ type: 'unpublish', website: w })}
                    className="btn-danger text-xs"
                  >
                    停用
                  </button>
                )}
                {w.status === 'OFFLINE' && (
                  <button
                    onClick={() => setConfirmAction({ type: 'republish', website: w })}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    重新上線
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); reset() }} title="建立網站">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">網站名稱 *</label>
            <input className="input-field" {...register('name')} />
            {errors.name && <p className="text-terra-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">網站標題 *</label>
            <input className="input-field" placeholder="集合頁大標題" {...register('title')} />
            {errors.title && <p className="text-terra-500 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="label">訂閱方案</label>
            <input className="input-field" {...register('subscriptionPlan')} />
          </div>
          <div>
            <label className="label">免運門檻（NT$）</label>
            <input type="number" className="input-field" {...register('freeShippingThreshold', { valueAsNumber: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">上架開始時間</label>
              <input type="datetime-local" className="input-field" {...register('publishStartAt')} />
            </div>
            <div>
              <label className="label">上架結束時間</label>
              <input type="datetime-local" className="input-field" {...register('publishEndAt')} />
            </div>
          </div>
          <div className="border-t border-cream-200 pt-3">
            <p className="text-sm font-semibold text-olive-700 mb-3">圖片設定</p>
            <div className="space-y-3">
              <div>
                <label className="label">Banner 主視覺圖片（建議 1200×400px）</label>
                {bannerFile && <p className="text-xs text-olive-500 mb-1">已選擇：{bannerFile.name}</p>}
                <input
                  type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-olive-600 file:mr-3 file:py-1.5 file:px-3 file:border-0 file:text-sm file:bg-cream-100 file:text-olive-700 hover:file:bg-cream-200 cursor-pointer"
                />
              </div>
              <div>
                <label className="label">宣傳文案圖片（選填，建議 1200×300px）</label>
                {promoFile && <p className="text-xs text-olive-500 mb-1">已選擇：{promoFile.name}</p>}
                <input
                  type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setPromoFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-olive-600 file:mr-3 file:py-1.5 file:px-3 file:border-0 file:text-sm file:bg-cream-100 file:text-olive-700 hover:file:bg-cream-200 cursor-pointer"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setIsCreateOpen(false); reset(); setBannerFile(null); setPromoFile(null) }} className="btn-secondary text-sm">
              取消
            </button>
            <button type="submit" className="btn-primary text-sm">建立</button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal - REQ-029 */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="網站設定" maxWidth="max-w-2xl">
        <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">網站名稱 *</label>
              <input className="input-field" {...editForm.register('name')} />
              {editForm.formState.errors.name && <p className="text-terra-500 text-xs mt-1">{editForm.formState.errors.name.message}</p>}
            </div>
            <div>
              <label className="label">頁面標題</label>
              <input className="input-field" placeholder="集合頁大標題" {...editForm.register('title')} />
            </div>
            <div>
              <label className="label">頁面副標題</label>
              <input className="input-field" placeholder="集合頁副標" {...editForm.register('subtitle')} />
            </div>
            <div>
              <label className="label">瀏覽器標籤標題</label>
              <input className="input-field" placeholder="&lt;title&gt; 標籤內容" {...editForm.register('browserTitle')} />
            </div>
            <div>
              <label className="label">訂閱方案</label>
              <input className="input-field" {...editForm.register('subscriptionPlan')} />
            </div>
            <div>
              <label className="label">免運門檻（NT$）</label>
              <input type="number" className="input-field" {...editForm.register('freeShippingThreshold', { valueAsNumber: true })} />
            </div>
            <div className="col-span-2 border-t border-cream-200 pt-4">
              <p className="text-sm font-semibold text-olive-700 mb-3">圖片設定</p>
              <div className="space-y-3">
                <div>
                  <label className="label">Banner 主視覺圖片（建議 1200×400px）</label>
                  {editTarget?.bannerImageUrl && !editBannerFile && (
                    <img src={editTarget.bannerImageUrl} alt="banner" className="mb-2 h-16 w-full object-cover rounded" />
                  )}
                  {editBannerFile && <p className="text-xs text-olive-500 mb-1">已選擇：{editBannerFile.name}</p>}
                  <input
                    type="file" accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setEditBannerFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-olive-600 file:mr-3 file:py-1.5 file:px-3 file:border-0 file:text-sm file:bg-cream-100 file:text-olive-700 hover:file:bg-cream-200 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="label">宣傳文案圖片（選填，建議 1200×300px）</label>
                  {editTarget?.promoImageUrl && !editPromoFile && (
                    <img src={editTarget.promoImageUrl} alt="promo" className="mb-2 h-12 w-full object-cover rounded" />
                  )}
                  {editPromoFile && <p className="text-xs text-olive-500 mb-1">已選擇：{editPromoFile.name}</p>}
                  <input
                    type="file" accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setEditPromoFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-olive-600 file:mr-3 file:py-1.5 file:px-3 file:border-0 file:text-sm file:bg-cream-100 file:text-olive-700 hover:file:bg-cream-200 cursor-pointer"
                  />
                </div>
              </div>
            </div>
            <div className="col-span-2 border-t border-cream-200 pt-4">
              <p className="text-sm font-semibold text-olive-700 mb-3">Footer 設定</p>
            </div>
            <div>
              <label className="label">Footer 標題</label>
              <input className="input-field" placeholder="店家名稱" {...editForm.register('footerTitle')} />
            </div>
            <div className="col-span-2">
              <label className="label">Footer 副標題</label>
              <textarea rows={2} className="input-field" placeholder="聯絡資訊、地址等" {...editForm.register('footerSubtitle')} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditTarget(null)} className="btn-secondary text-sm">取消</button>
            <button type="submit" className="btn-primary text-sm">儲存</button>
          </div>
        </form>
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        title={
          confirmAction?.type === 'publish' ? '啟用網站'
            : confirmAction?.type === 'republish' ? '重新上線'
            : '停用網站'
        }
        message={
          confirmAction?.type === 'publish'
            ? `確定要將「${confirmAction?.website.name}」上線嗎？`
            : confirmAction?.type === 'republish'
            ? `確定要將「${confirmAction?.website.name}」重新上線嗎？`
            : `確定要將「${confirmAction?.website.name}」下線嗎？`
        }
        confirmLabel={
          confirmAction?.type === 'publish' ? '啟用'
            : confirmAction?.type === 'republish' ? '重新上線'
            : '停用'
        }
        variant={confirmAction?.type === 'unpublish' ? 'danger' : 'primary'}
        onConfirm={() => {
          if (confirmAction?.type === 'publish') handlePublish(confirmAction.website)
          else if (confirmAction?.type === 'unpublish') handleUnpublish(confirmAction.website!)
          else if (confirmAction?.type === 'republish') handleRepublish(confirmAction.website!)
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
