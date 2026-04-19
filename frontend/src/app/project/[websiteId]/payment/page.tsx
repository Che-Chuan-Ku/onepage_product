'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { storefrontApi } from '@/lib/api/storefront'
import { CreatePaymentSchema, type CreatePaymentInput } from '@/lib/types/schemas'
import type { PaymentMethod, InvoiceType } from '@/lib/types'
import { StorefrontFooter } from '@/components/StorefrontFooter'

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'CREDIT_CARD', label: '信用卡', icon: '💳' },
  { value: 'LINE_PAY', label: 'LINE Pay', icon: '💚' },
  { value: 'BANK_TRANSFER', label: 'ATM 轉帳', icon: '🏦' },
]

const INVOICE_TYPES: { value: InvoiceType; label: string }[] = [
  { value: 'TWO_COPIES', label: '二聯式電子發票（個人）' },
  { value: 'THREE_COPIES', label: '三聯式電子發票（公司）' },
]

export default function PaymentPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const websiteId = Number(params.websiteId)
  const orderId = Number(searchParams.get('orderId'))

  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<CreatePaymentInput>({
    resolver: zodResolver(CreatePaymentSchema),
    defaultValues: {
      paymentMethod: 'CREDIT_CARD',
      invoiceType: 'TWO_COPIES',
    },
  })

  const invoiceType = watch('invoiceType')
  const carrierType = watch('carrierType')

  useEffect(() => {
    if (!orderId) {
      router.push(`/project/${websiteId}`)
    }
  }, [orderId, websiteId, router])

  const onSubmit = async (data: CreatePaymentInput) => {
    setSubmitting(true)
    try {
      const payment = await storefrontApi.createPayment(orderId, {
        ...data,
        carrierType: data.carrierType || undefined,
        carrierNumber: data.carrierNumber || undefined,
        buyerTaxId: data.buyerTaxId || undefined,
      })
      toast.success('正在前往付款頁面...')
      // In real scenario, redirect to ecpayPaymentUrl
      window.location.href = payment.ecpayPaymentUrl
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      toast.error(error.response?.data?.message || '建立付款失敗')
    } finally {
      setSubmitting(false)
    }
  }

  if (!orderId) return null

  return (
    <div className="min-h-screen bg-cream-100 font-body flex flex-col">
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-cream-200">
        <div className="max-w-xl mx-auto px-4 py-3">
          <span className="text-olive-900 font-display font-semibold">選擇付款方式</span>
        </div>
      </nav>

      <div className="flex-1 max-w-xl w-full mx-auto px-4 py-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Payment Method */}
          <div className="bg-white border border-cream-200 p-6">
            <h2 className="font-display text-xl text-olive-900 font-semibold mb-4">付款方式</h2>
            <div className="space-y-3">
              {PAYMENT_METHODS.map((method) => (
                <label key={method.value} className="flex items-center gap-3 cursor-pointer p-3 border border-cream-200 hover:border-olive-300 transition-colors">
                  <input
                    type="radio"
                    value={method.value}
                    {...register('paymentMethod')}
                    className="accent-olive-700"
                  />
                  <span className="text-xl">{method.icon}</span>
                  <span className="text-olive-800 font-medium">{method.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Invoice */}
          <div className="bg-white border border-cream-200 p-6">
            <h2 className="font-display text-xl text-olive-900 font-semibold mb-4">發票開立</h2>
            <div className="space-y-3 mb-4">
              {INVOICE_TYPES.map((type) => (
                <label key={type.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    value={type.value}
                    {...register('invoiceType')}
                    className="accent-olive-700"
                  />
                  <span className="text-olive-700">{type.label}</span>
                </label>
              ))}
            </div>

            {invoiceType === 'TWO_COPIES' && (
              <div>
                <label className="label">載具類型（選填）</label>
                <select className="input-field mb-3" {...register('carrierType')}>
                  <option value="">不使用載具</option>
                  <option value="MOBILE_BARCODE">手機條碼</option>
                  <option value="CITIZEN_CERTIFICATE">自然人憑證</option>
                </select>
                {carrierType && (
                  <div>
                    <label className="label">
                      {carrierType === 'MOBILE_BARCODE' ? '手機條碼（/+7碼英數）' : '自然人憑證（2碼大寫英文+14碼數字）'}
                    </label>
                    <input className="input-field" {...register('carrierNumber')} />
                  </div>
                )}
              </div>
            )}

            {invoiceType === 'THREE_COPIES' && (
              <div>
                <label className="label">買方統一編號 *</label>
                <input className="input-field" placeholder="8碼數字" {...register('buyerTaxId')} />
                {errors.buyerTaxId && <p className="text-terra-500 text-xs mt-1">{errors.buyerTaxId.message}</p>}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full text-center text-lg py-4"
          >
            {submitting ? '處理中...' : '確認付款'}
          </button>

          <p className="text-center text-xs text-olive-400">
            點擊確認付款後，將跳轉至綠界金流安全付款頁面
          </p>
        </form>
      </div>

      {/* OnePage Platform Footer - REQ-035 */}
      <StorefrontFooter />
    </div>
  )
}
