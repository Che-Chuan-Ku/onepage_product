import { apiClient } from './client'
import type { InventoryDTO } from '@/lib/types'

export const inventoryApi = {
  list: async (): Promise<InventoryDTO[]> => {
    const res = await apiClient.get('/inventory')
    return res.data
  },

  update: async (productId: number, stockQuantity: number): Promise<InventoryDTO> => {
    const res = await apiClient.put(`/inventory/${productId}`, { stockQuantity })
    return res.data
  },

  updateThreshold: async (productId: number, threshold: number): Promise<InventoryDTO> => {
    const res = await apiClient.put(`/inventory/${productId}/threshold`, { threshold })
    return res.data
  },
}
