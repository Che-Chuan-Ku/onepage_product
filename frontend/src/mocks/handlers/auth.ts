import { http, HttpResponse } from 'msw'
import { mockUsers } from '../fixtures'
import type { UserDTO } from '@/lib/types'

let users = [...mockUsers]
let nextUserId = mockUsers.length + 1

let loginFailCount = 0
let lockedUntil: number | null = null

export const authHandlers = [
  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string }

    // Check locked
    if (lockedUntil && Date.now() < lockedUntil) {
      return HttpResponse.json({ message: '帳號已鎖定' }, { status: 423 })
    }

    // Reset lock if expired
    if (lockedUntil && Date.now() >= lockedUntil) {
      lockedUntil = null
      loginFailCount = 0
    }

    // Validate credentials
    if (
      (body.email === 'admin@onepage.tw' && body.password === 'admin123') ||
      (body.email === 'kksjkdkk9933@gmail.com' && body.password === 'kksjdd9999')
    ) {
      loginFailCount = 0
      return HttpResponse.json({
        accessToken: 'mock-access-token-admin',
        refreshToken: 'mock-refresh-token-admin',
        role: 'ADMIN',
        userName: body.email === 'kksjkdkk9933@gmail.com' ? '管理員' : '系統管理員',
      })
    }

    if (body.email === 'user1@onepage.tw' && body.password === 'user123') {
      loginFailCount = 0
      return HttpResponse.json({
        accessToken: 'mock-access-token-user',
        refreshToken: 'mock-refresh-token-user',
        role: 'GENERAL_USER',
        userName: '一般使用者1',
      })
    }

    // Failed
    loginFailCount++
    if (loginFailCount >= 5) {
      lockedUntil = Date.now() + 30 * 60 * 1000 // 30 minutes
      loginFailCount = 0
      return HttpResponse.json({ message: '帳號已鎖定' }, { status: 423 })
    }

    return HttpResponse.json({ message: '帳號或密碼錯誤' }, { status: 401 })
  }),

  http.post('/api/v1/auth/refresh', async ({ request }) => {
    const body = await request.json() as { refreshToken: string }
    if (body.refreshToken.startsWith('mock-refresh-token')) {
      return HttpResponse.json({ accessToken: 'mock-access-token-refreshed' })
    }
    return HttpResponse.json({ message: 'Refresh Token 無效' }, { status: 401 })
  }),

  http.get('/api/v1/users', () => {
    return HttpResponse.json(users)
  }),

  http.post('/api/v1/users', async ({ request }) => {
    const body = await request.json() as { email: string; name: string; password: string; role: 'ADMIN' | 'GENERAL_USER'; sendWelcomeEmail?: boolean }
    if (users.find((u) => u.email === body.email)) {
      return HttpResponse.json({ message: '此 Email 已被使用' }, { status: 409 })
    }
    const newUser: UserDTO = {
      id: nextUserId++,
      email: body.email,
      name: body.name,
      role: body.role,
    }
    users.push(newUser)
    return HttpResponse.json(newUser, { status: 201 })
  }),

  http.put('/api/v1/users/:userId/role', async ({ params, request }) => {
    const { userId } = params
    const body = await request.json() as { role: 'ADMIN' | 'GENERAL_USER' }
    const user = users.find((u) => u.id === Number(userId))
    if (!user) {
      return HttpResponse.json({ message: '使用者不存在' }, { status: 404 })
    }
    const adminCount = users.filter((u) => u.role === 'ADMIN').length
    if (user.role === 'ADMIN' && body.role === 'GENERAL_USER' && adminCount <= 1) {
      return HttpResponse.json({ message: '不可將最後一位管理員降級' }, { status: 400 })
    }
    user.role = body.role
    return HttpResponse.json(user)
  }),
]
