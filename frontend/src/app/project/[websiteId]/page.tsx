'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { storefrontApi } from '@/lib/api/storefront'
import type { StorefrontWebsiteDTO, StorefrontProductCardDTO } from '@/lib/types'
import { useCartStore } from '@/store/cart'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { StorefrontFooter } from '@/components/StorefrontFooter'
import { clsx } from 'clsx'

function ProductCard({ product, websiteId, index }: { product: StorefrontProductCardDTO; websiteId: number; index: number }) {
  const discountedPrice = product.isPreorder && product.preorderDiscountPercent
    ? product.price * (1 - product.preorderDiscountPercent / 100)
    : null

  return (
    <Link
      href={`/project/${websiteId}/product/${product.slug}`}
      className="card-hover cursor-pointer bg-white overflow-hidden border border-cream-300 slide-up block"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className="relative aspect-square overflow-hidden bg-cream-200">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-700 hover:scale-110"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-olive-200">
            <span className="text-5xl">🌿</span>
          </div>
        )}
        {product.isPreorder && (
          <div className="absolute top-3 left-0 bg-terra-500 text-white px-4 py-1 text-sm font-body font-semibold tracking-wider">
            預購中
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-display text-lg text-olive-900 font-semibold mb-2 leading-tight">{product.name}</h3>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl text-terra-600 font-bold">
            NT${(discountedPrice ?? product.price).toLocaleString()}
          </span>
          {discountedPrice && (
            <span className="text-sm text-gray-400 line-through font-body">NT${product.price.toLocaleString()}</span>
          )}
        </div>
        {product.isPreorder && product.preorderDiscountPercent && (
          <p className="text-xs text-terra-500 font-body mt-1">
            預購享 {product.preorderDiscountPercent}% off
          </p>
        )}
      </div>
    </Link>
  )
}

export default function StorefrontPage() {
  const params = useParams()
  const websiteId = Number(params.websiteId)
  const { totalItems } = useCartStore()

  const [site, setSite] = useState<StorefrontWebsiteDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    storefrontApi.getWebsite(websiteId)
      .then(setSite)
      .catch(() => setError('網站不存在或尚未上線'))
      .finally(() => setLoading(false))
  }, [websiteId])

  if (loading) return <LoadingSpinner className="min-h-screen" />
  if (error || !site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-100">
        <div className="text-center">
          <p className="text-2xl text-olive-400 mb-4">🌿</p>
          <p className="text-olive-600">{error || '找不到此網站'}</p>
        </div>
      </div>
    )
  }

  const cartCount = totalItems()

  return (
    <div className="min-h-screen bg-cream-100 font-body">
      {/* Sticky Nav */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-cream-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-display text-xl text-olive-900 font-bold">{site.name}</h1>
          <Link href={`/project/${websiteId}/cart`} className="relative">
            <span className="text-olive-700 text-sm font-semibold">購物車</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-4 bg-terra-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </nav>

      {/* Banner */}
      {site.bannerImageUrl && (
        <div className="relative h-64 md:h-96 w-full overflow-hidden">
          <Image src={site.bannerImageUrl} alt={`${site.name} banner`} fill className="object-cover" priority />
          <div className="absolute inset-0 bg-olive-900/20" />
        </div>
      )}

      {/* Promo */}
      {site.promoImageUrl && (
        <div className="relative h-40 md:h-56 w-full overflow-hidden">
          <Image src={site.promoImageUrl} alt="宣傳圖" fill className="object-cover" />
        </div>
      )}

      {/* Shipping notice */}
      <div className="bg-olive-50 text-center py-2 text-sm text-olive-600">
        消費滿 NT${site.freeShippingThreshold.toLocaleString()} 免運費
      </div>

      {/* Products */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Title/Subtitle - REQ-029 */}
        {site.title && (
          <h2 className="font-display text-3xl text-olive-900 font-semibold mb-2 text-center">{site.title}</h2>
        )}
        {site.subtitle && (
          <p className="text-center text-olive-500 mb-8">{site.subtitle}</p>
        )}
        {!site.title && (
          <h2 className="font-display text-3xl text-olive-900 font-semibold mb-8 text-center">精選商品</h2>
        )}
        {site.products.length === 0 ? (
          <div className="text-center py-20 text-olive-400">
            <p className="text-5xl mb-4">🌿</p>
            <p>目前暫無上架商品</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {site.products.map((product, idx) => (
              <ProductCard key={product.id} product={product} websiteId={websiteId} index={idx} />
            ))}
          </div>
        )}
      </div>

      {/* Store Footer - REQ-029 */}
      {(site.footerTitle || site.footerSubtitle) && (
        <footer className="bg-olive-800 text-cream-200 py-12">
          <div className="max-w-6xl mx-auto px-4 text-center">
            {site.footerTitle && (
              <p className="font-display text-xl text-white mb-2">{site.footerTitle}</p>
            )}
            {site.footerSubtitle && (
              <p className="text-sm text-olive-300 whitespace-pre-line">{site.footerSubtitle}</p>
            )}
          </div>
        </footer>
      )}

      {/* OnePage Platform Footer - REQ-035 */}
      <StorefrontFooter />
    </div>
  )
}
