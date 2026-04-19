/**
 * MSW RBAC 工具（REQ-034）
 * 從 Authorization Bearer JWT 解碼 role，供 GET handlers 做資料過濾。
 * MSW 環境使用 atob 解碼，不做簽名驗證（僅 mock 用途）。
 */

export type JwtRole = 'ADMIN' | 'GENERAL_USER'

interface JwtPayload {
  sub: string
  role: JwtRole
  type: string
  iat: number
  exp: number
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload)) as JwtPayload
  } catch {
    return null
  }
}

/**
 * 從 Request Authorization header 取得 role。
 * 無 token 或解碼失敗時，預設回傳 'GENERAL_USER'（最小權限原則）。
 */
export function getRoleFromRequest(request: Request): JwtRole {
  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return 'GENERAL_USER'
  const payload = decodeJwtPayload(token)
  return payload?.role ?? 'GENERAL_USER'
}

/**
 * 從 Request Authorization header 取得 user email（作為 owner 識別）。
 */
export function getEmailFromRequest(request: Request): string | null {
  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const payload = decodeJwtPayload(token)
  return payload?.sub ?? null
}
