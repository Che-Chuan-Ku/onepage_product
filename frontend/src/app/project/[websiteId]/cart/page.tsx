'use client'

import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useCartStore } from '@/store/cart'
import { StorefrontFooter } from '@/components/StorefrontFooter'

export default function CartPage() {
  const params = useParams()
  const router = useRouter()
  const websiteId = Number(params.websiteId)
  const { items, updateQuantity, removeItem, subtotal, clearCart } = useCartStore()

  const total = subtotal()
  const freeShippingThreshold = 1500
  const needMore = freeShippingThreshold - total

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-cream-100 font-body flex flex-col">
        <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-cream-200">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link href={`/project/${websiteId}`} className="text-olive-500 hover:text-olive-700 text-sm">
              ← 繼續購物
            </Link>
          </div>
        </nav>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-6xl mb-4">🛒</p>
          <p className="text-olive-600 text-lg mb-2">購物車是空的</p>
          <Link href={`/project/${websiteId}`} className="btn-primary mt-4 text-sm">
            開始選購
          </Link>
        </div>
        <StorefrontFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-100 font-body flex flex-col">
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-cream-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/project/${websiteId}`} className="text-olive-500 hover:text-olive-700 text-sm">
            ← 繼續購物
          </Link>
          <span className="text-olive-900 font-display font-semibold">購物車</span>
        </div>
      </nav>

      <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        {/* Free shipping progress */}
        {needMore > 0 ? (
          <div className="bg-olive-50 border border-olive-200 px-4 py-3 mb-6 text-sm text-olive-700">
            再消費 <strong>NT${needMore.toLocaleString()}</strong> 即可享免運費
          </div>
        ) : (
          <div className="bg-olive-100 border border-olive-300 px-4 py-3 mb-6 text-sm text-olive-800 font-semibold">
            已達免運門檻 ✓
          </div>
        )}

        {/* Items */}
        <div className="space-y-4 mb-6">
          {items.map((item) => (
            <div key={item.productId} className="bg-white border border-cream-200 p-4 flex items-center gap-4">
              <div className="relative w-16 h-16 flex-shrink-0 bg-cream-200">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🌿</div>
                )}
              </div>
              <div className="flex-1">
                <p className="font-display font-semibold text-olive-900">{item.productName}</p>
                <p className="text-sm text-terra-600 font-body">NT${item.price.toLocaleString()}</p>
                {item.isPreorder && <span className="badge-preorder text-xs">預購</span>}
              </div>
              <div className="flex items-center border border-olive-200">
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  className="w-8 h-8 flex items-center justify-center text-olive-600 hover:bg-olive-50 text-sm"
                >
                  −
                </button>
                <span className="w-10 h-8 flex items-center justify-center text-olive-900 text-sm font-semibold">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  className="w-8 h-8 flex items-center justify-center text-olive-600 hover:bg-olive-50 text-sm"
                >
                  +
                </button>
              </div>
              <div className="text-right min-w-[80px]">
                <p className="font-semibold text-olive-900">NT${(item.price * item.quantity).toLocaleString()}</p>
              </div>
              <button
                onClick={() => removeItem(item.productId)}
                className="text-olive-300 hover:text-terra-500 text-lg ml-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-white border border-cream-200 p-6">
          <div className="flex justify-between text-olive-700 mb-2">
            <span>小計</span>
            <span>NT${total.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-olive-400 text-sm mb-4">
            <span>運費（結帳時計算）</span>
            <span>—</span>
          </div>
          <div className="border-t border-cream-200 pt-4 flex justify-between font-display text-xl font-bold text-olive-900">
            <span>合計</span>
            <span>NT${total.toLocaleString()}</span>
          </div>

          <button
            onClick={() => router.push(`/project/${websiteId}/checkout`)}
            className="btn-primary w-full mt-6 text-center text-lg py-4"
          >
            前往結帳
          </button>

          <button
            onClick={clearCart}
            className="w-full text-center text-xs text-olive-400 hover:text-terra-500 mt-3"
          >
            清空購物車
          </button>
        </div>
      </div>

      {/* OnePage Platform Footer - REQ-035 */}
      <StorefrontFooter />
    </div>
  )
}
