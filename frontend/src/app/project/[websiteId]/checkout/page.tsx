'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { storefrontApi } from '@/lib/api/storefront'
import { CreateOrderSchema, type CreateOrderInput } from '@/lib/types/schemas'
import { useCartStore } from '@/store/cart'
import type { ShippingCalculateResponse } from '@/lib/types'
import { StorefrontFooter } from '@/components/StorefrontFooter'

export default function CheckoutPage() {
  const params = useParams()
  const router = useRouter()
  const websiteId = Number(params.websiteId)

  const { items, subtotal, clearCart } = useCartStore()
  const [shippingInfo, setShippingInfo] = useState<ShippingCalculateResponse | null>(null)
  const [calculatingShipping, setCalculatingShipping] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register, handleSubmit, watch, formState: { errors }, setValue,
  } = useForm<CreateOrderInput>({
    resolver: zodResolver(CreateOrderSchema),
    defaultValues: {
      websiteId,
      shippingMethod: 'DELIVERY',
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    },
  })

  const shippingMethod = watch('shippingMethod')
  const shippingAddress = watch('shippingAddress')
  const total = subtotal()

  // Redirect if cart empty
  useEffect(() => {
    if (items.length === 0) {
      router.push(`/project/${websiteId}`)
    }
  }, [items, websiteId, router])

  // Calculate shipping when method/address changes
  useEffect(() => {
    const calc = async () => {
      if (shippingMethod === 'PICKUP') {
        setShippingInfo({
          shippingFee: 0,
          isRemoteIsland: false,
          freeShippingThreshold: 1500,
          message: null,
        })
        return
      }
      if (!shippingAddress) return
      setCalculatingShipping(true)
      try {
        const result = await storefrontApi.calculateShipping({
          websiteId,
          address: shippingAddress,
          shippingMethod,
          orderAmount: total,
        })
        setShippingInfo(result)
      } catch {
        // ignore
      } finally {
        setCalculatingShipping(false)
      }
    }
    calc()
  }, [shippingMethod, shippingAddress, websiteId, total])

  const onSubmit = async (data: CreateOrderInput) => {
    if (shippingInfo?.isRemoteIsland) {
      toast.error('抱歉，目前不支援外島運送')
      return
    }
    setSubmitting(true)
    try {
      const order = await storefrontApi.createOrder({
        ...data,
        taxId: data.taxId || undefined,
      })
      clearCart()
      router.push(`/project/${websiteId}/payment?orderId=${order.id}`)
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } }
      if (error.response?.status === 409) {
        toast.error('庫存不足，請調整購物車後重試')
      } else {
        toast.error(error.response?.data?.message || '建立訂單失敗')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const shippingFee = shippingInfo?.shippingFee ?? (total >= 1500 ? 0 : 100)
  const finalTotal = total + shippingFee

  return (
    <div className="min-h-screen bg-cream-100 font-body flex flex-col">
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-cream-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/project/${websiteId}/cart`} className="text-olive-500 hover:text-olive-700 text-sm">
            ← 返回購物車
          </Link>
          <span className="text-olive-900 font-display font-semibold">填寫訂購資訊</span>
        </div>
      </nav>

      <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white border border-cream-200 p-6">
            <h2 className="font-display text-xl text-olive-900 font-semibold mb-4">訂購人資訊</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">姓名 *</label>
                <input className="input-field" {...register('customerName')} />
                {errors.customerName && <p className="text-terra-500 text-xs mt-1">{errors.customerName.message}</p>}
              </div>
              <div>
                <label className="label">電話 *</label>
                <input type="tel" className="input-field" {...register('customerPhone')} />
                {errors.customerPhone && <p className="text-terra-500 text-xs mt-1">{errors.customerPhone.message}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="label">Email *</label>
                <input type="email" className="input-field" {...register('customerEmail')} />
                {errors.customerEmail && <p className="text-terra-500 text-xs mt-1">{errors.customerEmail.message}</p>}
              </div>
              <div>
                <label className="label">統一編號（選填）</label>
                <input className="input-field" placeholder="8碼數字" {...register('taxId')} />
                {errors.taxId && <p className="text-terra-500 text-xs mt-1">{errors.taxId.message}</p>}
              </div>
            </div>
          </div>

          {/* Shipping */}
          <div className="bg-white border border-cream-200 p-6">
            <h2 className="font-display text-xl text-olive-900 font-semibold mb-4">配送資訊</h2>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="DELIVERY" {...register('shippingMethod')} className="accent-olive-700" />
                <span className="text-olive-700">宅配到府</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="PICKUP" {...register('shippingMethod')} className="accent-olive-700" />
                <span className="text-olive-700">自取</span>
              </label>
            </div>

            {shippingMethod === 'DELIVERY' && (
              <div>
                <label className="label">配送地址 *</label>
                <input className="input-field" placeholder="請輸入完整地址（縣市+區+路+號）" {...register('shippingAddress')} />
                {errors.shippingAddress && <p className="text-terra-500 text-xs mt-1">{errors.shippingAddress.message}</p>}
                {shippingInfo?.isRemoteIsland && (
                  <p className="text-terra-500 text-sm mt-2 font-semibold">
                    ⚠️ {shippingInfo.message}
                  </p>
                )}
                {calculatingShipping && <p className="text-olive-400 text-xs mt-1">計算運費中...</p>}
              </div>
            )}

            {/* Shipping fee summary */}
            {shippingInfo && !calculatingShipping && (
              <div className="mt-3 text-sm text-olive-600 bg-olive-50 px-3 py-2">
                運費：NT${shippingInfo.shippingFee.toLocaleString()}
                {shippingInfo.message && <span className="ml-2 text-olive-500">（{shippingInfo.message}）</span>}
              </div>
            )}
          </div>

          {/* Note */}
          <div className="bg-white border border-cream-200 p-6">
            <h2 className="font-display text-xl text-olive-900 font-semibold mb-4">備註</h2>
            <textarea rows={3} className="input-field" placeholder="如有特殊需求請填寫..." {...register('note')} />
          </div>

          {/* Order Summary */}
          <div className="bg-white border border-cream-200 p-6">
            <h2 className="font-display text-xl text-olive-900 font-semibold mb-4">訂單確認</h2>
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between text-sm text-olive-700 py-1">
                <span>{item.productName} × {item.quantity}</span>
                <span>NT${(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t border-cream-200 mt-3 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-olive-500">
                <span>商品小計</span>
                <span>NT${total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-olive-500">
                <span>運費</span>
                <span>NT${shippingFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-display text-xl font-bold text-olive-900 pt-2">
                <span>訂單總計</span>
                <span>NT${finalTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || (shippingInfo?.isRemoteIsland ?? false)}
            className="btn-primary w-full text-center text-lg py-4"
          >
            {submitting ? '建立訂單中...' : '確認下單，前往付款'}
          </button>
        </form>
      </div>

      {/* OnePage Platform Footer - REQ-035 */}
      <StorefrontFooter />
    </div>
  )
}
