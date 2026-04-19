'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { invoiceApi } from '@/lib/api/invoices'
import type { InvoiceDTO, InvoiceStatus } from '@/lib/types'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Pagination } from '@/components/ui/Pagination'
import { Modal } from '@/components/ui/Modal'
import { clsx } from 'clsx'

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  SYNCING: '同步中',
  ISSUED: '已開立',
  VOIDED: '已作廢',
  ALLOWANCED: '已折讓',
}

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  SYNCING: 'bg-blue-100 text-blue-700',
  ISSUED: 'bg-olive-100 text-olive-700',
  VOIDED: 'bg-gray-100 text-gray-500',
  ALLOWANCED: 'bg-yellow-100 text-yellow-700',
}

const VoidSchema = z.object({ reason: z.string().min(1, '請輸入作廢原因') })
const AllowanceSchema = z.object({ amount: z.number().min(0.01, '折讓金額必須大於0') })

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | ''>('')
  const [voidTarget, setVoidTarget] = useState<InvoiceDTO | null>(null)
  const [allowanceTarget, setAllowanceTarget] = useState<InvoiceDTO | null>(null)

  const { register: voidRegister, handleSubmit: voidHandleSubmit, formState: { errors: voidErrors }, reset: voidReset } =
    useForm({ resolver: zodResolver(VoidSchema) })
  const { register: allowanceRegister, handleSubmit: allowanceHandleSubmit, formState: { errors: allowanceErrors }, reset: allowanceReset } =
    useForm({ resolver: zodResolver(AllowanceSchema) })

  const load = async () => {
    setLoading(true)
    try {
      const data = await invoiceApi.list({ page, status: filterStatus || undefined })
      setInvoices(data.content)
      setTotalPages(data.totalPages)
    } catch {
      toast.error('載入發票失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, filterStatus])

  const handleVoid = async (data: { reason: string }) => {
    if (!voidTarget) return
    try {
      await invoiceApi.void(voidTarget.id, data.reason)
      toast.success('發票已作廢')
      setVoidTarget(null)
      voidReset()
      load()
    } catch {
      toast.error('作廢失敗')
    }
  }

  const handleAllowance = async (data: { amount: number }) => {
    if (!allowanceTarget) return
    try {
      await invoiceApi.allowance(allowanceTarget.id, data.amount)
      toast.success('發票已折讓')
      setAllowanceTarget(null)
      allowanceReset()
      load()
    } catch {
      toast.error('折讓失敗')
    }
  }

  const handleSync = async (invoice: InvoiceDTO) => {
    try {
      await invoiceApi.sync(invoice.id)
      toast.success('同步成功')
      load()
    } catch {
      toast.error('同步失敗')
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-olive-900 font-semibold">發票管理</h1>
      </div>

      <div className="flex gap-3 mb-4">
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as InvoiceStatus | ''); setPage(0) }}
          className="input-field w-auto text-sm"
        >
          <option value="">全部狀態</option>
          {(Object.keys(STATUS_LABEL) as InvoiceStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
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
                  <th className="table-header">發票號碼</th>
                  <th className="table-header">訂單編號</th>
                  <th className="table-header">金額</th>
                  <th className="table-header">類型</th>
                  <th className="table-header">狀態</th>
                  <th className="table-header">開立日期</th>
                  <th className="table-header">操作</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="table-cell font-medium">{inv.invoiceNumber || '—'}</td>
                    <td className="table-cell">{inv.orderNumber}</td>
                    <td className="table-cell">NT${inv.amount.toLocaleString()}</td>
                    <td className="table-cell">{inv.invoiceType === 'TWO_COPIES' ? '二聯式' : '三聯式'}</td>
                    <td className="table-cell">
                      <span className={clsx('px-2 py-0.5 text-xs font-medium', STATUS_BADGE[inv.status])}>
                        {STATUS_LABEL[inv.status]}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-olive-500">
                      {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('zh-TW') : '—'}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        {inv.status === 'SYNCING' && (
                          <button onClick={() => handleSync(inv)} className="text-xs text-olive-600 hover:text-olive-800">
                            同步
                          </button>
                        )}
                        {inv.status === 'ISSUED' && (
                          <>
                            <button onClick={() => setVoidTarget(inv)} className="text-xs text-terra-500 hover:text-terra-700">
                              作廢
                            </button>
                            <button onClick={() => setAllowanceTarget(inv)} className="text-xs text-olive-500 hover:text-olive-700">
                              折讓
                            </button>
                          </>
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

      {/* Void Modal */}
      <Modal isOpen={!!voidTarget} onClose={() => { setVoidTarget(null); voidReset() }} title="作廢發票">
        <form onSubmit={voidHandleSubmit(handleVoid as unknown as (data: Record<string, unknown>) => void)} className="space-y-4">
          <p className="text-sm text-olive-600">發票號碼：{voidTarget?.invoiceNumber}</p>
          <div>
            <label className="label">作廢原因 *</label>
            <input className="input-field" {...voidRegister('reason')} />
            {voidErrors.reason && <p className="text-terra-500 text-xs mt-1">{String(voidErrors.reason.message)}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setVoidTarget(null); voidReset() }} className="btn-secondary text-sm">取消</button>
            <button type="submit" className="btn-danger text-sm">作廢</button>
          </div>
        </form>
      </Modal>

      {/* Allowance Modal */}
      <Modal isOpen={!!allowanceTarget} onClose={() => { setAllowanceTarget(null); allowanceReset() }} title="折讓發票">
        <form onSubmit={allowanceHandleSubmit(handleAllowance as unknown as (data: Record<string, unknown>) => void)} className="space-y-4">
          <p className="text-sm text-olive-600">發票號碼：{allowanceTarget?.invoiceNumber}，原始金額：NT${allowanceTarget?.amount.toLocaleString()}</p>
          <div>
            <label className="label">折讓金額 *</label>
            <input type="number" step="0.01" className="input-field" {...allowanceRegister('amount', { valueAsNumber: true })} />
            {allowanceErrors.amount && <p className="text-terra-500 text-xs mt-1">{String(allowanceErrors.amount.message)}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setAllowanceTarget(null); allowanceReset() }} className="btn-secondary text-sm">取消</button>
            <button type="submit" className="btn-primary text-sm">折讓</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
