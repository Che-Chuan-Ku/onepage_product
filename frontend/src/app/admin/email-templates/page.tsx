'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { emailTemplateApi } from '@/lib/api/email-templates'
import { UpdateEmailTemplateSchema, type UpdateEmailTemplateInput } from '@/lib/types/schemas'
import type { EmailTemplateDTO, EmailTemplateType } from '@/lib/types'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/auth'

const TEMPLATE_TYPE_LABEL: Record<EmailTemplateType, string> = {
  ORDER_CONFIRMED: '訂單確認通知',
  PAYMENT_SUCCESS: '付款成功通知',
  PAYMENT_FAILED: '付款失敗通知',
  SHIPPED: '出貨通知',
}

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplateDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<EmailTemplateDTO | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const { role } = useAuthStore()

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<UpdateEmailTemplateInput>({
    resolver: zodResolver(UpdateEmailTemplateSchema),
  })

  const load = async () => {
    try {
      const data = await emailTemplateApi.list()
      setTemplates(data)
    } catch {
      toast.error('載入模板失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openEdit = (template: EmailTemplateDTO) => {
    setEditTarget(template)
    setValue('subject', template.subject)
    setValue('bodyHtml', template.bodyHtml)
  }

  const onSubmit = async (data: UpdateEmailTemplateInput) => {
    if (!editTarget) return
    try {
      const updated = await emailTemplateApi.update(editTarget.id, data)
      setTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : t))
      toast.success('模板更新成功')
      setEditTarget(null)
      reset()
    } catch {
      toast.error('更新失敗')
    }
  }

  const handlePreview = async (template: EmailTemplateDTO) => {
    try {
      const html = await emailTemplateApi.preview(template.id)
      setPreviewHtml(html)
    } catch {
      toast.error('預覽失敗')
    }
  }

  if (role !== 'ADMIN') {
    return (
      <div className="p-6">
        <p className="text-terra-500">此頁面僅管理員可見</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl text-olive-900 font-semibold mb-6">Email 通知模板管理</h1>

      {loading ? (
        <LoadingSpinner className="py-20" />
      ) : (
        <div className="space-y-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white border border-cream-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display text-lg text-olive-900 font-semibold mb-1">
                    {TEMPLATE_TYPE_LABEL[t.templateType]}
                  </h2>
                  <p className="text-sm text-olive-500">主旨：{t.subject}</p>
                  <p className="text-xs text-olive-400 mt-1">
                    最後更新：{new Date(t.updatedAt).toLocaleDateString('zh-TW')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handlePreview(t)} className="btn-secondary text-xs px-3 py-1.5">
                    預覽
                  </button>
                  <button onClick={() => openEdit(t)} className="btn-primary text-xs px-3 py-1.5">
                    編輯
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <Modal isOpen={!!editTarget} onClose={() => { setEditTarget(null); reset() }} title={editTarget ? TEMPLATE_TYPE_LABEL[editTarget.templateType] : ''} maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Email 主旨 *</label>
            <input className="input-field" {...register('subject')} />
            {errors.subject && <p className="text-terra-500 text-xs mt-1">{errors.subject.message}</p>}
          </div>
          <div>
            <label className="label">Email 內容（HTML）*</label>
            <textarea rows={10} className="input-field font-mono text-xs" {...register('bodyHtml')} />
            {errors.bodyHtml && <p className="text-terra-500 text-xs mt-1">{errors.bodyHtml.message}</p>}
          </div>

          {/* REQ-032: Variables table */}
          <div className="bg-olive-50 border border-olive-200 p-4">
            <h3 className="text-sm font-semibold text-olive-800 mb-3 flex items-center gap-1">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              可用變數說明
            </h3>
            <div className="overflow-hidden border border-olive-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-olive-100">
                    <th className="text-left px-3 py-2 font-semibold text-olive-700 border-b border-olive-200">變數</th>
                    <th className="text-left px-3 py-2 font-semibold text-olive-700 border-b border-olive-200">說明</th>
                    <th className="text-center px-3 py-2 font-semibold text-olive-700 border-b border-olive-200">備註</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'customerName', label: '顧客姓名', isNew: false },
                    { key: 'orderNumber', label: '訂單編號', isNew: false },
                    { key: 'totalAmount', label: '訂單總金額', isNew: false },
                    { key: 'orderItems', label: '商品明細', isNew: false },
                    { key: 'websiteName', label: '網站名稱', isNew: true },
                    { key: 'contactInfo', label: '店家聯絡資訊', isNew: true },
                  ].map((v, i) => (
                    <tr key={v.key} className={i % 2 === 0 ? 'bg-white' : 'bg-olive-50/50'}>
                      <td className="px-3 py-2 border-b border-olive-100">
                        <code className="font-mono text-xs text-olive-700 bg-white border border-olive-200 px-1.5 py-0.5">
                          {`{{${v.key}}}`}
                        </code>
                      </td>
                      <td className="px-3 py-2 text-olive-700 border-b border-olive-100">{v.label}</td>
                      <td className="px-3 py-2 text-center border-b border-olive-100">
                        {v.isNew && (
                          <span className="bg-terra-100 text-terra-600 text-xs font-semibold px-1.5 py-0.5">新增</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setEditTarget(null); reset() }} className="btn-secondary text-sm">取消</button>
            <button type="submit" className="btn-primary text-sm">儲存</button>
          </div>
        </form>
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={!!previewHtml} onClose={() => setPreviewHtml(null)} title="模板預覽" maxWidth="max-w-2xl">
        {previewHtml && (
          <iframe
            srcDoc={previewHtml}
            className="w-full h-96 border border-cream-200"
            title="Email 預覽"
          />
        )}
      </Modal>
    </div>
  )
}
