'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { inventoryApi } from '@/lib/api/inventory'
import { UpdateInventorySchema, UpdateLowStockThresholdSchema } from '@/lib/types/schemas'
import type { InventoryDTO } from '@/lib/types'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Modal } from '@/components/ui/Modal'
import { clsx } from 'clsx'

export default function AdminInventoryPage() {
  const [inventory, setInventory] = useState<InventoryDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [stockTarget, setStockTarget] = useState<InventoryDTO | null>(null)
  const [thresholdTarget, setThresholdTarget] = useState<InventoryDTO | null>(null)

  const {
    register: stockRegister, handleSubmit: stockHandleSubmit,
    formState: { errors: stockErrors }, reset: stockReset, setValue: stockSetValue,
  } = useForm({ resolver: zodResolver(UpdateInventorySchema) })

  const {
    register: thresholdRegister, handleSubmit: thresholdHandleSubmit,
    formState: { errors: thresholdErrors }, reset: thresholdReset, setValue: thresholdSetValue,
  } = useForm({ resolver: zodResolver(UpdateLowStockThresholdSchema) })

  const load = async () => {
    try {
      const data = await inventoryApi.list()
      setInventory(data)
    } catch {
      toast.error('載入庫存失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openStock = (item: InventoryDTO) => {
    setStockTarget(item)
    stockSetValue('stockQuantity', item.stockQuantity)
  }

  const openThreshold = (item: InventoryDTO) => {
    setThresholdTarget(item)
    thresholdSetValue('threshold', item.lowStockThreshold)
  }

  const handleUpdateStock = async (data: { stockQuantity: number }) => {
    if (!stockTarget) return
    try {
      const updated = await inventoryApi.update(stockTarget.productId, data.stockQuantity)
      setInventory((prev) => prev.map((i) => i.productId === updated.productId ? updated : i))
      toast.success('庫存更新成功')
      setStockTarget(null)
      stockReset()
    } catch {
      toast.error('更新失敗')
    }
  }

  const handleUpdateThreshold = async (data: { threshold: number }) => {
    if (!thresholdTarget) return
    try {
      const updated = await inventoryApi.updateThreshold(thresholdTarget.productId, data.threshold)
      setInventory((prev) => prev.map((i) => i.productId === updated.productId ? updated : i))
      toast.success('門檻更新成功')
      setThresholdTarget(null)
      thresholdReset()
    } catch {
      toast.error('更新失敗')
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-olive-900 font-semibold">庫存管理</h1>
        {inventory.some((i) => i.isLowStock) && (
          <div className="flex items-center gap-2 bg-terra-50 border border-terra-200 px-3 py-1.5 text-sm text-terra-700">
            ⚠️ 有商品庫存偏低
          </div>
        )}
      </div>

      {loading ? (
        <LoadingSpinner className="py-20" />
      ) : (
        <div className="bg-white border border-cream-200">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">商品名稱</th>
                <th className="table-header">庫存數量</th>
                <th className="table-header">低庫存門檻</th>
                <th className="table-header">狀態</th>
                <th className="table-header">操作</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.productId} className={clsx(item.isLowStock && 'bg-terra-50')}>
                  <td className="table-cell font-medium">{item.productName}</td>
                  <td className="table-cell">
                    <span className={clsx(item.isLowStock ? 'text-terra-600 font-bold' : 'text-olive-800')}>
                      {item.stockQuantity}
                    </span>
                  </td>
                  <td className="table-cell text-olive-500">{item.lowStockThreshold}</td>
                  <td className="table-cell">
                    {item.isLowStock ? (
                      <span className="bg-terra-100 text-terra-700 px-2 py-0.5 text-xs font-medium">庫存偏低</span>
                    ) : (
                      <span className="badge-active">正常</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-3">
                      <button onClick={() => openStock(item)} className="text-xs text-olive-600 hover:text-olive-800 underline">
                        編輯庫存
                      </button>
                      <button onClick={() => openThreshold(item)} className="text-xs text-olive-500 hover:text-olive-700 underline">
                        設定門檻
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stock Modal */}
      <Modal isOpen={!!stockTarget} onClose={() => { setStockTarget(null); stockReset() }} title="編輯庫存數量">
        <form onSubmit={stockHandleSubmit(handleUpdateStock as (data: Record<string, unknown>) => void)} className="space-y-4">
          <p className="text-sm text-olive-600">{stockTarget?.productName}</p>
          <div>
            <label className="label">庫存數量 *</label>
            <input type="number" className="input-field" {...stockRegister('stockQuantity', { valueAsNumber: true })} />
            {stockErrors.stockQuantity && <p className="text-terra-500 text-xs mt-1">{String(stockErrors.stockQuantity.message)}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setStockTarget(null); stockReset() }} className="btn-secondary text-sm">取消</button>
            <button type="submit" className="btn-primary text-sm">更新</button>
          </div>
        </form>
      </Modal>

      {/* Threshold Modal */}
      <Modal isOpen={!!thresholdTarget} onClose={() => { setThresholdTarget(null); thresholdReset() }} title="設定低庫存門檻">
        <form onSubmit={thresholdHandleSubmit(handleUpdateThreshold as (data: Record<string, unknown>) => void)} className="space-y-4">
          <p className="text-sm text-olive-600">{thresholdTarget?.productName}</p>
          <div>
            <label className="label">低庫存門檻 *</label>
            <input type="number" className="input-field" {...thresholdRegister('threshold', { valueAsNumber: true })} />
            {thresholdErrors.threshold && <p className="text-terra-500 text-xs mt-1">{String(thresholdErrors.threshold.message)}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setThresholdTarget(null); thresholdReset() }} className="btn-secondary text-sm">取消</button>
            <button type="submit" className="btn-primary text-sm">設定</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
