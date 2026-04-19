'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import { AdminLayout } from '@/components/admin/AdminLayout'

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    if (!isAuthenticated && !isLoginPage) {
      router.push('/admin/login')
    }
  }, [isAuthenticated, isLoginPage, router])

  if (isLoginPage) {
    return <>{children}</>
  }

  if (!isAuthenticated) {
    return null
  }

  return <AdminLayout>{children}</AdminLayout>
}
