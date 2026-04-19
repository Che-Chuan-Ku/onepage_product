'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { storefrontApi } from '@/lib/api/storefront'
import type { StorefrontProductDTO } from '@/lib/types'
import { useCartStore } from '@/store/cart'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { StorefrontFooter } from '@/components/StorefrontFooter'

function CountdownTimer({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(endDate).getTime() - Date.now()
      if (diff <= 0) return
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }
    calculate()
    const timer = setInterval(calculate, 1000)
    return () => clearInterval(timer)
  }, [endDate])

  return (
    <div className="flex items-center gap-2 font-body">
      {[
        { v: timeLeft.days, l: '天' },
        { v: timeLeft.hours, l: '時' },
        { v: timeLeft.minutes, l: '分' },
        { v: timeLeft.seconds, l: '秒' },
      ].map(({ v, l }) => (
        <div key={l} className="text-center">
          <div className="bg-olive-900 text-white px-3 py-1.5 text-xl font-bold min-w-[2.5rem] text-center">
            {String(v).padStart(2, '0')}
          </div>
          <div className="text-xs text-olive-500 mt-0.5">{l}</div>
        </div>
      ))}
    </div>
  )
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const websiteId = Number(params.websiteId)
  const productSlug = params.productSlug as string

  const { addItem, items } = useCartStore()

  const [product, setProduct] = useState<StorefrontProductDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [currentImageIdx, setCurrentImageIdx] = useState(0)
  const [addingToCart, setAddingToCart] = useState(false)

  useEffect(() => {
    storefrontApi.getProduct(websiteId, productSlug)
      .then(setProduct)
      .catch(() => {
        toast.error('找不到此商品')
        router.push(`/project/${websiteId}`)
      })
      .finally(() => setLoading(false))
  }, [websiteId, productSlug, router])

  const handleAddToCart = useCallback(async () => {
    if (!product) return
    setAddingToCart(true)
    try {
      const stockCheck = await storefrontApi.checkStock(product.id, quantity)
      if (!stockCheck.available) {
        toast.error('庫存不足，無法加入購物車')
        return
      }
      const discountedPrice = product.isPreorder && product.preorderDiscountPercent
        ? product.price * (1 - product.preorderDiscountPercent / 100)
        : product.price

      addItem({
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        price: discountedPrice,
        quantity,
        imageUrl: product.images[0]?.imageUrl ?? null,
        isPreorder: product.isPreorder,
        websiteId,
      })
      toast.success('已加入購物車！')
    } catch {
      toast.error('加入購物車失敗')
    } finally {
      setAddingToCart(false)
    }
  }, [product, quantity, addItem, websiteId])

  if (loading) return <LoadingSpinner className="min-h-screen" />
  if (!product) return null

  const discountedPrice = product.isPreorder && product.preorderDiscountPercent
    ? product.price * (1 - product.preorderDiscountPercent / 100)
    : product.price

  return (
    <div className="min-h-screen bg-cream-100 font-body flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-cream-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/project/${websiteId}`} className="text-olive-500 hover:text-olive-700 text-sm">
            ← 返回商品集合頁
          </Link>
          <span className="text-olive-300">|</span>
          <span className="text-olive-600 text-sm">{product.name}</span>
        </div>
      </nav>

      <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-10">
        <div className="grid md:grid-cols-2 gap-10">
          {/* Images */}
          <div>
            <div className="relative aspect-square overflow-hidden bg-cream-200 mb-3">
              {product.images[currentImageIdx] ? (
                <Image
                  src={product.images[currentImageIdx].imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl">🌿</div>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto img-carousel">
                {product.images.map((img, idx) => (
                  <div
                    key={img.id}
                    onClick={() => setCurrentImageIdx(idx)}
                    className={`relative w-16 h-16 flex-shrink-0 cursor-pointer overflow-hidden border-2 ${
                      idx === currentImageIdx ? 'border-olive-700' : 'border-cream-200'
                    }`}
                  >
                    <Image src={img.imageUrl} alt={`${product.name} ${idx + 1}`} fill className="object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {product.isPreorder && (
              <div className="bg-terra-50 border border-terra-200 px-4 py-2 mb-4 text-terra-700 text-sm font-semibold">
                預購商品
              </div>
            )}
            {product.isBundle && (
              <div className="bg-olive-50 border border-olive-200 px-4 py-2 mb-4 text-olive-700 text-sm font-semibold">
                組合包商品
              </div>
            )}

            <h1 className="font-display text-3xl text-olive-900 font-bold mb-3">{product.name}</h1>

            <div className="flex items-baseline gap-3 mb-4">
              <span className="font-display text-3xl text-terra-600 font-bold">
                NT${discountedPrice.toLocaleString()}
              </span>
              {discountedPrice !== product.price && (
                <span className="text-xl text-gray-400 line-through">NT${product.price.toLocaleString()}</span>
              )}
              <span className="text-sm text-olive-500">/ {product.priceUnit === 'KG' ? '公斤' : '台斤'}</span>
            </div>

            {product.packaging && (
              <p className="text-sm text-olive-500 mb-4">包裝：{product.packaging}</p>
            )}

            {product.isPreorder && product.preorderEndDate && (
              <div className="mb-6">
                <p className="text-sm text-terra-600 font-semibold mb-2">預購倒數</p>
                <CountdownTimer endDate={product.preorderEndDate} />
                <p className="text-xs text-olive-400 mt-2">預購截止：{product.preorderEndDate}</p>
              </div>
            )}

            {product.isBundle && product.bundleItems.length > 0 && (
              <div className="mb-4 bg-olive-50 px-4 py-3">
                <p className="text-sm font-semibold text-olive-700 mb-2">組合內容</p>
                {product.bundleItems.map((item) => (
                  <div key={item.productId} className="flex justify-between text-sm text-olive-600 py-0.5">
                    <span>{item.productName}</span>
                    <span>NT${item.price.toLocaleString()}</span>
                  </div>
                ))}
                {product.bundleDiscountPercent && (
                  <p className="text-xs text-terra-500 mt-2">組合優惠折扣 {product.bundleDiscountPercent}%</p>
                )}
              </div>
            )}

            {/* Quantity */}
            <div className="flex items-center gap-4 mb-6">
              <label className="text-sm font-semibold text-olive-700">數量</label>
              <div className="flex items-center border border-olive-200">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 flex items-center justify-center text-olive-600 hover:bg-olive-50"
                >
                  −
                </button>
                <span className="w-12 h-10 flex items-center justify-center text-olive-900 font-semibold">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-10 h-10 flex items-center justify-center text-olive-600 hover:bg-olive-50"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={addingToCart}
              className="btn-primary w-full text-lg py-4 text-center"
            >
              {addingToCart ? '加入中...' : '加入購物車'}
            </button>

            <Link
              href={`/project/${websiteId}/cart`}
              className="block text-center text-sm text-olive-500 hover:text-olive-700 mt-3"
            >
              前往購物車結帳
            </Link>
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <div className="mt-10 border-t border-cream-300 pt-8">
            <h2 className="font-display text-xl text-olive-900 font-semibold mb-4">商品描述</h2>
            <p className="text-olive-700 leading-relaxed whitespace-pre-wrap">{product.description}</p>
          </div>
        )}
      </div>

      {/* OnePage Platform Footer - REQ-035 */}
      <StorefrontFooter />
    </div>
  )
}
