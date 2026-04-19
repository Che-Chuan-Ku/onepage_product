import { apiClient } from './client'
import type { WebsiteDTO, WebsiteProductDTO, WebsiteProductInput } from '@/lib/types'

export const websiteApi = {
  list: async (): Promise<WebsiteDTO[]> => {
    const res = await apiClient.get('/websites')
    return res.data
  },

  get: async (websiteId: number): Promise<WebsiteDTO> => {
    const res = await apiClient.get(`/websites/${websiteId}`)
    return res.data
  },

  create: async (formData: FormData): Promise<WebsiteDTO> => {
    const res = await apiClient.post('/websites', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  update: async (websiteId: number, formData: FormData): Promise<WebsiteDTO> => {
    const res = await apiClient.put(`/websites/${websiteId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  publish: async (websiteId: number): Promise<WebsiteDTO> => {
    const res = await apiClient.post(`/websites/${websiteId}/publish`)
    return res.data
  },

  unpublish: async (websiteId: number): Promise<WebsiteDTO> => {
    const res = await apiClient.post(`/websites/${websiteId}/unpublish`)
    return res.data
  },

  republish: async (websiteId: number): Promise<WebsiteDTO> => {
    const res = await apiClient.post(`/websites/${websiteId}/republish`)
    return res.data
  },

  listProducts: async (websiteId: number): Promise<WebsiteProductDTO[]> => {
    const res = await apiClient.get(`/websites/${websiteId}/products`)
    return res.data
  },

  updateProducts: async (
    websiteId: number,
    products: WebsiteProductInput[]
  ): Promise<WebsiteProductDTO[]> => {
    const res = await apiClient.put(`/websites/${websiteId}/products`, products)
    return res.data
  },
}
