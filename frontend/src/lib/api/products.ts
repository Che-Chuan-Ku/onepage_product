import { apiClient } from './client'
import type {
  ProductDTO,
  ProductCategoryDTO,
  CreateProductCategoryRequest,
  PagedProducts,
  PaginationParams,
} from '@/lib/types'

export const productCategoryApi = {
  list: async (): Promise<ProductCategoryDTO[]> => {
    const res = await apiClient.get('/product-categories')
    return res.data
  },

  create: async (data: CreateProductCategoryRequest): Promise<ProductCategoryDTO> => {
    const res = await apiClient.post('/product-categories', data)
    return res.data
  },

  update: async (categoryId: number, name: string): Promise<ProductCategoryDTO> => {
    const res = await apiClient.put(`/product-categories/${categoryId}`, { name })
    return res.data
  },

  delete: async (categoryId: number): Promise<void> => {
    await apiClient.delete(`/product-categories/${categoryId}`)
  },
}

export const productApi = {
  list: async (
    params?: { status?: 'ACTIVE' | 'INACTIVE'; categoryId?: number } & PaginationParams
  ): Promise<PagedProducts> => {
    const res = await apiClient.get('/products', params as Record<string, unknown>)
    return res.data
  },

  get: async (productId: number): Promise<ProductDTO> => {
    const res = await apiClient.get(`/products/${productId}`)
    return res.data
  },

  create: async (formData: FormData): Promise<ProductDTO> => {
    const res = await apiClient.post('/products', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  update: async (productId: number, formData: FormData): Promise<ProductDTO> => {
    const res = await apiClient.put(`/products/${productId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  deactivate: async (productId: number): Promise<ProductDTO> => {
    const res = await apiClient.post(`/products/${productId}/deactivate`)
    return res.data
  },

  uploadImages: async (productId: number, files: File[]): Promise<ProductDTO> => {
    const formData = new FormData()
    files.forEach((file) => formData.append('images', file))
    const res = await apiClient.post(`/products/${productId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}
