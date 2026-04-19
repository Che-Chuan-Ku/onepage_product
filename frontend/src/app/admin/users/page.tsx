'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api/auth'
import { CreateUserSchema, type CreateUserInput } from '@/lib/types/schemas'
import type { UserDTO } from '@/lib/types'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/auth'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [roleConfirm, setRoleConfirm] = useState<{ user: UserDTO; newRole: 'ADMIN' | 'GENERAL_USER' } | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createSuccess, setCreateSuccess] = useState(false)
  const { role: currentRole } = useAuthStore()

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateUserInput>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: { role: 'GENERAL_USER', sendWelcomeEmail: true },
  })

  const load = async () => {
    try {
      const data = await authApi.listUsers()
      setUsers(data)
    } catch {
      toast.error('載入使用者失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleRoleChange = async ({ user, newRole }: { user: UserDTO; newRole: 'ADMIN' | 'GENERAL_USER' }) => {
    try {
      const updated = await authApi.updateUserRole(user.id, newRole)
      setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u))
      toast.success(`已將 ${user.name} 設定為 ${newRole === 'ADMIN' ? '管理員' : '一般使用者'}`)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      toast.error(error.response?.data?.message || '操作失敗')
    }
    setRoleConfirm(null)
  }

  const onCreateSubmit = async (data: CreateUserInput) => {
    try {
      const newUser = await authApi.createUser({
        email: data.email,
        name: data.name,
        password: data.password,
        role: data.role,
        sendWelcomeEmail: data.sendWelcomeEmail,
      })
      setUsers((prev) => [...prev, newUser])
      setCreateSuccess(true)
      setTimeout(() => {
        setCreateSuccess(false)
        setIsCreateOpen(false)
        reset()
      }, 1200)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      toast.error(error.response?.data?.message || '建立使用者失敗')
    }
  }

  if (currentRole !== 'ADMIN') {
    return (
      <div className="p-6">
        <p className="text-terra-500">此頁面僅管理員可見</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-olive-900 font-semibold">使用者管理</h1>
        <button onClick={() => { setIsCreateOpen(true); setCreateSuccess(false); reset() }} className="btn-primary text-sm">
          + 新增使用者
        </button>
      </div>

      {loading ? (
        <LoadingSpinner className="py-20" />
      ) : (
        <div className="bg-white border border-cream-200">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">姓名</th>
                <th className="table-header">Email</th>
                <th className="table-header">角色</th>
                <th className="table-header">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="table-cell font-medium">{user.name}</td>
                  <td className="table-cell text-olive-500">{user.email}</td>
                  <td className="table-cell">
                    <span className={user.role === 'ADMIN' ? 'badge-active' : 'badge-inactive'}>
                      {user.role === 'ADMIN' ? '管理員' : '一般使用者'}
                    </span>
                  </td>
                  <td className="table-cell">
                    {user.role === 'ADMIN' ? (
                      <button
                        onClick={() => setRoleConfirm({ user, newRole: 'GENERAL_USER' })}
                        className="text-xs text-terra-500 hover:text-terra-700"
                      >
                        降級為一般使用者
                      </button>
                    ) : (
                      <button
                        onClick={() => setRoleConfirm({ user, newRole: 'ADMIN' })}
                        className="text-xs text-olive-600 hover:text-olive-800"
                      >
                        升級為管理員
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!roleConfirm}
        title="變更使用者角色"
        message={`確定要將「${roleConfirm?.user.name}」設定為「${roleConfirm?.newRole === 'ADMIN' ? '管理員' : '一般使用者'}」嗎？`}
        confirmLabel="確認"
        variant={roleConfirm?.newRole === 'GENERAL_USER' ? 'danger' : 'primary'}
        onConfirm={() => roleConfirm && handleRoleChange(roleConfirm)}
        onCancel={() => setRoleConfirm(null)}
      />

      {/* Create User Modal - REQ-033 */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); reset(); setCreateSuccess(false) }}
        title="新增使用者"
        maxWidth="max-w-md"
      >
        {createSuccess ? (
          <div className="py-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 bg-olive-100 rounded-full flex items-center justify-center">
              <svg width="28" height="28" fill="none" stroke="#4A5D23" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <p className="font-semibold text-olive-800">使用者已新增成功！</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-4">
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input-field" placeholder="user@example.com" {...register('email')} />
              {errors.email && <p className="text-terra-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">姓名 *</label>
              <input className="input-field" placeholder="使用者姓名" {...register('name')} />
              {errors.name && <p className="text-terra-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">密碼 *</label>
              <input type="password" className="input-field" placeholder="至少 8 個字元" {...register('password')} />
              {errors.password && <p className="text-terra-500 text-xs mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <label className="label">角色</label>
              <select className="input-field" {...register('role')}>
                <option value="GENERAL_USER">一般使用者</option>
                <option value="ADMIN">管理員</option>
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-olive-700" {...register('sendWelcomeEmail')} />
                <div>
                  <span className="text-sm font-semibold text-olive-800">寄送歡迎 Email</span>
                  <p className="text-xs text-olive-400">系統將自動發送帳號設定通知給新使用者</p>
                </div>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setIsCreateOpen(false); reset() }} className="btn-secondary text-sm flex-1">
                取消
              </button>
              <button type="submit" className="btn-primary text-sm flex-1">
                新增使用者
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
