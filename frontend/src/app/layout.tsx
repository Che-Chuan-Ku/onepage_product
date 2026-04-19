import type { Metadata } from 'next'
import './globals.css'
import { MSWProvider } from '@/components/MSWProvider'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'OnePage 電商平台',
  description: 'OnePage 一頁式電商平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body>
        <MSWProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#4A5D23',
                color: '#fff',
                fontFamily: 'Source Sans 3, sans-serif',
              },
              error: {
                style: {
                  background: '#C75B39',
                  color: '#fff',
                },
              },
            }}
          />
        </MSWProvider>
      </body>
    </html>
  )
}
