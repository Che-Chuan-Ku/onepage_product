import { apiClient } from './client'
import type { LoginRequest, LoginResponse, TokenResponse, UserDTO, CreateUserRequest } from '@/lib/types'

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const res = await apiClient.post('/auth/login', data)
    return res.data
  },

  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    const res = await apiClient.post('/auth/refresh', { refreshToken })
    return res.data
  },

  listUsers: async (): Promise<UserDTO[]> => {
    const res = await apiClient.get('/users')
    return res.data
  },

  createUser: async (data: CreateUserRequest): Promise<UserDTO> => {
    const res = await apiClient.post('/users', data)
    return res.data
  },

  updateUserRole: async (userId: number, role: 'ADMIN' | 'GENERAL_USER'): Promise<UserDTO> => {
    const res = await apiClient.put(`/users/${userId}/role`, { role })
    return res.data
  },
}
