import { apiClient } from './client'
import type { OrderDTO, PagedOrders, PaginationParams, OrderStatus } from '@/lib/types'

export interface OrderListParams extends PaginationParams {
  websiteId?: number
  orderNumber?: string
  startDate?: string
  endDate?: string
  status?: OrderStatus
}

export const orderApi = {
  list: async (params?: OrderListParams): Promise<PagedOrders> => {
    const res = await apiClient.get('/orders', params as Record<string, unknown>)
    return res.data
  },

  exportCsv: async (params?: Omit<OrderListParams, 'page' | 'size'>): Promise<Blob> => {
    const res = await apiClient.get('/orders/export', {
      ...params,
      responseType: 'blob',
    } as Record<string, unknown>)
    return res.data
  },

  markShipped: async (orderId: number): Promise<OrderDTO> => {
    const res = await apiClient.post(`/orders/${orderId}/ship`)
    return res.data
  },

  markReturned: async (orderId: number): Promise<OrderDTO> => {
    const res = await apiClient.post(`/orders/${orderId}/return`)
    return res.data
  },
}
