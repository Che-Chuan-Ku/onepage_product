'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LoginRequestSchema, type LoginRequestInput } from '@/lib/types/schemas'
import { authApi } from '@/lib/api/auth'
import { useAuthStore } from '@/store/auth'

export default function AdminLoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequestInput>({
    resolver: zodResolver(LoginRequestSchema),
  })

  const onSubmit = async (data: LoginRequestInput) => {
    setIsLoading(true)
    try {
      const res = await authApi.login(data)
      setAuth({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        role: res.role,
        userName: res.userName,
      })
      toast.success(`歡迎回來，${res.userName}`)
      router.push('/admin/websites')
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } }
      if (error.response?.status === 423) {
        toast.error('帳號已被鎖定，請 30 分鐘後再試')
      } else {
        toast.error('帳號或密碼錯誤')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center">
      <div className="noise-overlay fixed inset-0 pointer-events-none" />
      <div className="relative bg-white w-full max-w-sm mx-4 shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-olive-900 font-bold mb-1">OnePage</h1>
          <p className="text-olive-500 font-body text-sm">後台管理系統</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input-field"
              placeholder="請輸入 Email"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-terra-500 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="label">密碼</label>
            <input
              type="password"
              className="input-field"
              placeholder="請輸入密碼"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-terra-500 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full text-center"
          >
            {isLoading ? '登入中...' : '登入'}
          </button>
        </form>

        <p className="text-center text-xs text-olive-400 font-body mt-6">
          測試帳號：admin@onepage.tw / admin123
        </p>
      </div>
    </div>
  )
}
