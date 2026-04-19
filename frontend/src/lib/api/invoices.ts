import { apiClient } from './client'
import type { InvoiceDTO, PagedInvoices, InvoiceStatus, PaginationParams } from '@/lib/types'

export interface InvoiceListParams extends PaginationParams {
  websiteId?: number
  invoiceNumber?: string
  startDate?: string
  endDate?: string
  status?: InvoiceStatus
}

export const invoiceApi = {
  list: async (params?: InvoiceListParams): Promise<PagedInvoices> => {
    const res = await apiClient.get('/invoices', params as Record<string, unknown>)
    return res.data
  },

  void: async (invoiceId: number, reason: string): Promise<InvoiceDTO> => {
    const res = await apiClient.post(`/invoices/${invoiceId}/void`, { reason })
    return res.data
  },

  allowance: async (invoiceId: number, amount: number): Promise<InvoiceDTO> => {
    const res = await apiClient.post(`/invoices/${invoiceId}/allowance`, { amount })
    return res.data
  },

  sync: async (invoiceId: number): Promise<InvoiceDTO> => {
    const res = await apiClient.post(`/invoices/${invoiceId}/sync`)
    return res.data
  },
}
