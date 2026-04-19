'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { websiteApi } from '@/lib/api/websites'
import { productApi } from '@/lib/api/products'
import type { WebsiteDTO, WebsiteProductDTO, ProductDTO } from '@/lib/types'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export default function WebsiteProductsPage() {
  const params = useParams()
  const websiteId = Number(params.websiteId)

  const [website, setWebsite] = useState<WebsiteDTO | null>(null)
  const [websiteProducts, setWebsiteProducts] = useState<WebsiteProductDTO[]>([])
  const [allProducts, setAllProducts] = useState<ProductDTO[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [publishAts, setPublishAts] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [ws, wps, prods] = await Promise.all([
          websiteApi.get(websiteId),
          websiteApi.listProducts(websiteId),
          productApi.list({ status: 'ACTIVE', size: 100 }),
        ])
        setWebsite(ws)
        setWebsiteProducts(wps)
        setAllProducts(prods.content)
        const ids = new Set(wps.map((wp) => wp.productId))
        setSelectedIds(ids)
        const ats: Record<number, string> = {}
        wps.forEach((wp) => {
          ats[wp.productId] = wp.publishAt.slice(0, 16)
        })
        setPublishAts(ats)
      } catch {
        toast.error('載入失敗')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [websiteId])

  const toggleProduct = (productId: number) => {
    const newIds = new Set(selectedIds)
    if (newIds.has(productId)) {
      newIds.delete(productId)
    } else {
      newIds.add(productId)
      if (!publishAts[productId]) {
        setPublishAts((prev) => ({ ...prev, [productId]: new Date().toISOString().slice(0, 16) }))
      }
    }
    setSelectedIds(newIds)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const inputs = Array.from(selectedIds).map((id) => ({
        productId: id,
        publishAt: publishAts[id] ? new Date(publishAts[id]).toISOString() : new Date().toISOString(),
      }))
      await websiteApi.updateProducts(websiteId, inputs)
      toast.success('上架商品已更新')
    } catch {
      toast.error('更新失敗')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner className="py-20" />

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-olive-900 font-semibold">網站上架商品</h1>
          <p className="text-olive-500 text-sm mt-1">{website?.name}</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
          {saving ? '儲存中...' : '儲存變更'}
        </button>
      </div>

      <div className="bg-white border border-cream-200">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header w-10">選取</th>
              <th className="table-header">商品名稱</th>
              <th className="table-header">類型</th>
              <th className="table-header">售價</th>
              <th className="table-header">上架時間</th>
            </tr>
          </thead>
          <tbody>
            {allProducts.map((p) => (
              <tr key={p.id}>
                <td className="table-cell">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleProduct(p.id)}
                    className="w-4 h-4 accent-olive-700"
                  />
                </td>
                <td className="table-cell font-medium">{p.name}</td>
                <td className="table-cell text-olive-500">{p.categoryName}</td>
                <td className="table-cell">NT${p.price.toLocaleString()}</td>
                <td className="table-cell">
                  {selectedIds.has(p.id) && (
                    <input
                      type="datetime-local"
                      value={publishAts[p.id] ?? ''}
                      onChange={(e) => setPublishAts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="input-field text-xs py-1"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
