import { apiClient } from './client'

export const systemApi = {
  getServerTime: async (): Promise<{ serverTime: string }> => {
    const res = await apiClient.get('/system/time')
    return res.data
  },
}
