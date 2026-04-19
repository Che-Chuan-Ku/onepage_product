import { apiClient } from './client'
import type {
  StorefrontWebsiteDTO,
  StorefrontProductDTO,
  ShippingCalculateRequest,
  ShippingCalculateResponse,
  CreateOrderRequest,
  OrderDTO,
  CreatePaymentRequest,
  PaymentDTO,
} from '@/lib/types'

export const storefrontApi = {
  getWebsite: async (websiteId: number): Promise<StorefrontWebsiteDTO> => {
    const res = await apiClient.get(`/storefront/websites/${websiteId}`)
    return res.data
  },

  getProduct: async (websiteId: number, productSlug: string): Promise<StorefrontProductDTO> => {
    const res = await apiClient.get(`/storefront/websites/${websiteId}/products/${productSlug}`)
    return res.data
  },

  checkStock: async (productId: number, quantity: number): Promise<{ available: boolean }> => {
    const res = await apiClient.get(`/storefront/products/${productId}/stock-check`, { quantity })
    return res.data
  },

  calculateShipping: async (data: ShippingCalculateRequest): Promise<ShippingCalculateResponse> => {
    const res = await apiClient.post('/storefront/shipping/calculate', data)
    return res.data
  },

  createOrder: async (data: CreateOrderRequest): Promise<OrderDTO> => {
    const res = await apiClient.post('/storefront/orders', data)
    return res.data
  },

  createPayment: async (orderId: number, data: CreatePaymentRequest): Promise<PaymentDTO> => {
    const res = await apiClient.post(`/storefront/orders/${orderId}/payment`, data)
    return res.data
  },
}
