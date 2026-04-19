'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { clsx } from 'clsx'

const navItems = [
  { href: '/admin/products', label: '商品管理', icon: '🛍️' },
  { href: '/admin/categories', label: '商品類型', icon: '📂' },
  { href: '/admin/websites', label: '網站管理', icon: '🌐', adminOnly: true },
  { href: '/admin/orders', label: '訂單管理', icon: '📋' },
  { href: '/admin/invoices', label: '發票管理', icon: '🧾', adminOnly: true },
  { href: '/admin/inventory', label: '庫存管理', icon: '📦' },
  { href: '/admin/users', label: '使用者管理', icon: '👤', adminOnly: true },
  { href: '/admin/email-templates', label: 'Email 通知模板', icon: '✉️', adminOnly: true },
]

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { userName, role, clearAuth } = useAuthStore()

  const handleLogout = () => {
    clearAuth()
    router.push('/admin/login')
  }

  const visibleNav = navItems.filter((item) => !item.adminOnly || role === 'ADMIN')

  return (
    <div className="min-h-screen flex bg-cream-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-cream-200 flex flex-col">
        <div className="px-4 py-5 border-b border-cream-200">
          <h1 className="font-display text-xl text-olive-900 font-bold">OnePage</h1>
          <p className="text-xs text-olive-500 font-body mt-0.5">後台管理系統</p>
        </div>

        <nav className="flex-1 py-4">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'admin-sidebar-link',
                pathname.startsWith(item.href) && 'active'
              )}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-cream-200">
          <div className="text-xs text-olive-500 font-body mb-2">
            <span className="font-medium text-olive-700">{userName}</span>
            <br />
            {role === 'ADMIN' ? '管理員' : '一般使用者'}
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-terra-500 hover:text-terra-700 font-body"
          >
            登出
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
