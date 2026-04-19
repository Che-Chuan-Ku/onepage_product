import axios, { AxiosInstance, AxiosError } from 'axios'

const BASE_URL = '/api/v1'

class ApiClient {
  private instance: AxiosInstance

  constructor() {
    this.instance = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor: attach access token
    this.instance.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('accessToken')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }
      return config
    })

    // Response interceptor: handle 401 with token refresh
    this.instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as typeof error.config & { _retry?: boolean }

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          const refreshToken = localStorage.getItem('refreshToken')
          if (refreshToken) {
            try {
              const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
              localStorage.setItem('accessToken', data.accessToken)
              originalRequest.headers!.Authorization = `Bearer ${data.accessToken}`
              return this.instance(originalRequest)
            } catch {
              // Refresh failed: clear tokens and redirect to login
              localStorage.removeItem('accessToken')
              localStorage.removeItem('refreshToken')
              localStorage.removeItem('userRole')
              localStorage.removeItem('userName')
              if (typeof window !== 'undefined') {
                window.location.href = '/admin/login'
              }
            }
          } else {
            if (typeof window !== 'undefined') {
              window.location.href = '/admin/login'
            }
          }
        }

        return Promise.reject(error)
      }
    )
  }

  get(url: string, params?: Record<string, unknown>) {
    return this.instance.get(url, { params })
  }

  post(url: string, data?: unknown, config?: object) {
    return this.instance.post(url, data, config)
  }

  put(url: string, data?: unknown, config?: object) {
    return this.instance.put(url, data, config)
  }

  delete(url: string) {
    return this.instance.delete(url)
  }
}

export const apiClient = new ApiClient()
