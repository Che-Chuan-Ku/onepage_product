'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { orderApi } from '@/lib/api/orders'
import type { OrderDTO, OrderStatus } from '@/lib/types'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Pagination } from '@/components/ui/Pagination'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { clsx } from 'clsx'

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '待付款',
  PROCESSING_PAYMENT: '付款處理中',
  PAID: '已付款',
  SHIPPED: '已出貨',
  RETURNED: '已退貨',
  PAYMENT_FAILED: '付款失敗',
}

const STATUS_BADGE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-700',
  PROCESSING_PAYMENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-olive-100 text-olive-700',
  SHIPPED: 'bg-green-100 text-green-700',
  RETURNED: 'bg-gray-100 text-gray-600',
  PAYMENT_FAILED: 'bg-red-100 text-red-600',
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [filterStatus, setFilterStatus] = useState<OrderStatus | ''>('')
  const [filterOrderNumber, setFilterOrderNumber] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<OrderDTO | null>(null)
  const [actionConfirm, setActionConfirm] = useState<{ type: 'ship' | 'return'; order: OrderDTO } | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await orderApi.list({
        page,
        status: filterStatus || undefined,
        orderNumber: filterOrderNumber || undefined,
      })
      setOrders(data.content)
      setTotalPages(data.totalPages)
    } catch {
      toast.error('載入訂單失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, filterStatus, filterOrderNumber])

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await orderApi.exportCsv({
        status: filterStatus || undefined,
        orderNumber: filterOrderNumber || undefined,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'orders.csv'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV 匯出成功')
    } catch {
      toast.error('匯出失敗')
    } finally {
      setExporting(false)
    }
  }

  const handleShip = async (order: OrderDTO) => {
    try {
      await orderApi.markShipped(order.id)
      toast.success('已標註出貨')
      load()
    } catch {
      toast.error('操作失敗')
    }
    setActionConfirm(null)
  }

  const handleReturn = async (order: OrderDTO) => {
    try {
      await orderApi.markReturned(order.id)
      toast.success('已標註退貨')
      load()
    } catch {
      toast.error('操作失敗')
    }
    setActionConfirm(null)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-olive-900 font-semibold">訂單管理</h1>
        <button onClick={handleExport} disabled={exporting} className="btn-secondary text-sm">
          {exporting ? '匯出中...' : '匯出 CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="搜尋訂單編號..."
          value={filterOrderNumber}
          onChange={(e) => { setFilterOrderNumber(e.target.value); setPage(0) }}
          className="input-field w-48 text-sm"
        />
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as OrderStatus | ''); setPage(0) }}
          className="input-field w-auto text-sm"
        >
          <option value="">全部狀態</option>
          {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
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
                  <th className="table-header">訂單編號</th>
                  <th className="table-header">顧客</th>
                  <th className="table-header">金額</th>
                  <th className="table-header">配送</th>
                  <th className="table-header">狀態</th>
                  <th className="table-header">日期</th>
                  <th className="table-header">操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="table-cell">
                      <button
                        onClick={() => setSelectedOrder(o)}
                        className="text-olive-700 underline font-medium hover:text-olive-900"
                      >
                        {o.orderNumber}
                      </button>
                    </td>
                    <td className="table-cell">
                      <div>{o.customerName}</div>
                      <div className="text-xs text-olive-400">{o.customerPhone}</div>
                    </td>
                    <td className="table-cell">NT${o.totalAmount.toLocaleString()}</td>
                    <td className="table-cell">{o.shippingMethod === 'DELIVERY' ? '宅配' : '自取'}</td>
                    <td className="table-cell">
                      <span className={clsx('px-2 py-0.5 text-xs font-medium', STATUS_BADGE[o.status])}>
                        {STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-olive-500">
                      {new Date(o.createdAt).toLocaleDateString('zh-TW')}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        {o.status === 'PAID' && (
                          <button
                            onClick={() => setActionConfirm({ type: 'ship', order: o })}
                            className="text-xs btn-primary px-2 py-1"
                          >
                            出貨
                          </button>
                        )}
                        {(o.status === 'PAID' || o.status === 'SHIPPED') && (
                          <button
                            onClick={() => setActionConfirm({ type: 'return', order: o })}
                            className="text-xs text-terra-500 hover:text-terra-700"
                          >
                            退貨
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

      {/* Order Detail Modal */}
      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`訂單詳情：${selectedOrder?.orderNumber}`} maxWidth="max-w-2xl">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-olive-500">顧客姓名</p>
                <p className="font-medium">{selectedOrder.customerName}</p>
              </div>
              <div>
                <p className="text-olive-500">聯絡電話</p>
                <p className="font-medium">{selectedOrder.customerPhone}</p>
              </div>
              <div>
                <p className="text-olive-500">Email</p>
                <p className="font-medium">{selectedOrder.customerEmail}</p>
              </div>
              <div>
                <p className="text-olive-500">配送方式</p>
                <p className="font-medium">{selectedOrder.shippingMethod === 'DELIVERY' ? '宅配' : '自取'}</p>
              </div>
              {selectedOrder.shippingAddress && (
                <div className="col-span-2">
                  <p className="text-olive-500">配送地址</p>
                  <p className="font-medium">{selectedOrder.shippingAddress}</p>
                </div>
              )}
              {selectedOrder.note && (
                <div className="col-span-2">
                  <p className="text-olive-500">備註</p>
                  <p className="font-medium">{selectedOrder.note}</p>
                </div>
              )}
            </div>

            <div className="border-t border-cream-200 pt-4">
              <p className="text-sm font-semibold text-olive-700 mb-2">訂單明細</p>
              {selectedOrder.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm py-1">
                  <span>{item.productName} × {item.quantity}</span>
                  <span>NT${item.subtotal.toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t border-cream-200 mt-2 pt-2 space-y-1 text-sm">
                <div className="flex justify-between text-olive-500">
                  <span>小計</span>
                  <span>NT${selectedOrder.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-olive-500">
                  <span>運費</span>
                  <span>NT${selectedOrder.shippingFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-olive-900 text-base">
                  <span>合計</span>
                  <span>NT${selectedOrder.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!actionConfirm}
        title={actionConfirm?.type === 'ship' ? '標註出貨' : '標註退貨'}
        message={
          actionConfirm?.type === 'ship'
            ? `確定要將訂單 ${actionConfirm?.order.orderNumber} 標註為已出貨嗎？`
            : `確定要將訂單 ${actionConfirm?.order.orderNumber} 標註為已退貨嗎？`
        }
        confirmLabel={actionConfirm?.type === 'ship' ? '出貨' : '退貨'}
        variant={actionConfirm?.type === 'return' ? 'danger' : 'primary'}
        onConfirm={() => {
          if (actionConfirm?.type === 'ship') handleShip(actionConfirm.order)
          else if (actionConfirm?.type === 'return') handleReturn(actionConfirm.order)
        }}
        onCancel={() => setActionConfirm(null)}
      />
    </div>
  )
}
