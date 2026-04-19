import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  role: 'ADMIN' | 'GENERAL_USER' | null
  userName: string | null
  isAuthenticated: boolean
  setAuth: (data: {
    accessToken: string
    refreshToken: string
    role: 'ADMIN' | 'GENERAL_USER'
    userName: string
  }) => void
  clearAuth: () => void
  updateAccessToken: (accessToken: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      role: null,
      userName: null,
      isAuthenticated: false,

      setAuth: ({ accessToken, refreshToken, role, userName }) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', refreshToken)
          localStorage.setItem('userRole', role)
          localStorage.setItem('userName', userName)
        }
        set({ accessToken, refreshToken, role, userName, isAuthenticated: true })
      },

      clearAuth: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('userRole')
          localStorage.removeItem('userName')
        }
        set({ accessToken: null, refreshToken: null, role: null, userName: null, isAuthenticated: false })
      },

      updateAccessToken: (accessToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken)
        }
        set({ accessToken })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        role: state.role,
        userName: state.userName,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
