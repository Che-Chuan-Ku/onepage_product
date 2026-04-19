'use client'

import { useEffect, useState } from 'react'

export function MSWProvider({ children }: { children: React.ReactNode }) {
  const [mswReady, setMswReady] = useState(false)

  useEffect(() => {
    const init = async () => {
      if (
        process.env.NEXT_PUBLIC_MOCK_ENABLED === 'true' &&
        typeof window !== 'undefined'
      ) {
        const { worker } = await import('@/mocks/browser')
        await worker.start({
          onUnhandledRequest: 'bypass',
          serviceWorker: {
            url: '/mockServiceWorker.js',
          },
        })
      }
      setMswReady(true)
    }
    init()
  }, [])

  if (!mswReady) {
    return null
  }

  return <>{children}</>
}
