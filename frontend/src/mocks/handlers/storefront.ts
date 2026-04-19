import { http, HttpResponse } from 'msw'
import { mockStorefrontWebsite, mockStorefrontProducts, mockOrders, mockPayment, mockWebsites, mockWebsiteProducts, mockProducts } from '../fixtures'
import type { OrderDTO, StorefrontWebsiteDTO, StorefrontProductCardDTO } from '@/lib/types'

let orders = [...mockOrders]
let nextOrderId = 10

export const storefrontHandlers = [
  http.get('/api/v1/storefront/websites/:websiteId', ({ params }) => {
    const { websiteId } = params
    const wid = Number(websiteId)

    // Primary fixture for website 1
    if (wid === 1) {
      return HttpResponse.json(mockStorefrontWebsite)
    }

    // Dynamically build for other websites
    const website = mockWebsites.find((w) => w.id === wid && w.status === 'PUBLISHED')
    if (!website) {
      return HttpResponse.json({ message: '網站不存在或未上線' }, { status: 404 })
    }

    const wps = mockWebsiteProducts.filter((wp) => wp.websiteId === wid)
    const products: StorefrontProductCardDTO[] = wps
      .flatMap((wp) => {
        const p = mockProducts.find((pr) => pr.id === wp.productId && pr.status === 'ACTIVE')
        if (!p) return []
        const card: StorefrontProductCardDTO = {
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          imageUrl: p.images[0]?.imageUrl ?? null,
          isPreorder: p.isPreorder,
          preorderDiscountPercent: p.preorderDiscountPercent,
        }
        return [card]
      })

    const storefrontWebsite: StorefrontWebsiteDTO = {
      id: website.id,
      name: website.name,
      title: website.title,
      subtitle: website.subtitle,
      bannerImageUrl: website.bannerImageUrl,
      promoImageUrl: website.promoImageUrl,
      footerTitle: website.footerTitle,
      footerSubtitle: website.footerSubtitle,
      freeShippingThreshold: website.freeShippingThreshold,
      products,
    }
    return HttpResponse.json(storefrontWebsite)
  }),

  http.get('/api/v1/storefront/websites/:websiteId/products/:productSlug', ({ params }) => {
    const { productSlug } = params
    const product = mockStorefrontProducts[productSlug as string]
    if (!product) {
      return HttpResponse.json({ message: '商品不存在或未上架至此網站' }, { status: 404 })
    }
    return HttpResponse.json(product)
  }),

  http.get('/api/v1/storefront/products/:productId/stock-check', ({ params, request }) => {
    const url = new URL(request.url)
    const quantity = Number(url.searchParams.get('quantity') ?? 1)
    const { productId } = params

    const stockMap: Record<number, number> = {
      1: 150, 2: 200, 3: 80, 4: 50, 5: 5,
    }
    const stock = stockMap[Number(productId)] ?? 0
    return HttpResponse.json({ available: stock >= quantity })
  }),

  http.post('/api/v1/storefront/shipping/calculate', async ({ request }) => {
    const body = await request.json() as { address?: string; shippingMethod: string; orderAmount?: number; websiteId: number }
    const isPickup = body.shippingMethod === 'PICKUP'

    // Check remote island
    const remoteIslandKeywords = ['澎湖', '金門', '馬祖', '綠島', '蘭嶼']
    const isRemoteIsland = remoteIslandKeywords.some((kw) => body.address?.includes(kw))

    if (isRemoteIsland) {
      return HttpResponse.json({
        shippingFee: 0,
        isRemoteIsland: true,
        freeShippingThreshold: 1500,
        message: '抱歉，目前不支援外島運送',
      })
    }

    const orderAmount = body.orderAmount ?? 0
    const freeShippingThreshold = 1500
    const shippingFee = isPickup ? 0 : orderAmount >= freeShippingThreshold ? 0 : 100

    return HttpResponse.json({
      shippingFee,
      isRemoteIsland: false,
      freeShippingThreshold,
      message: shippingFee === 0 && !isPickup ? '已達免運門檻' : null,
    })
  }),

  http.post('/api/v1/storefront/orders', async ({ request }) => {
    const body = await request.json() as {
      websiteId: number
      customerName: string
      customerPhone: string
      customerEmail: string
      shippingAddress?: string
      shippingMethod: 'DELIVERY' | 'PICKUP'
      note?: string
      taxId?: string
      items: { productId: number; quantity: number }[]
    }

    const subtotal = body.items.reduce((acc, item) => {
      const priceMap: Record<number, number> = { 1: 680, 2: 1200, 3: 450, 4: 1800, 5: 120 }
      return acc + (priceMap[item.productId] ?? 0) * item.quantity
    }, 0)

    const shippingFee = body.shippingMethod === 'PICKUP' ? 0 : subtotal >= 1500 ? 0 : 100

    const newOrder: OrderDTO = {
      id: nextOrderId++,
      orderNumber: `OP${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(nextOrderId).padStart(3, '0')}`,
      websiteId: body.websiteId,
      websiteName: '豐收農場 線上商店',
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      shippingAddress: body.shippingAddress ?? '',
      shippingMethod: body.shippingMethod,
      shippingFee,
      subtotal,
      totalAmount: subtotal + shippingFee,
      note: body.note ?? '',
      taxId: body.taxId ?? '',
      status: 'PENDING_PAYMENT',
      isPreorder: false,
      items: body.items.map((item, idx) => {
        const priceMap: Record<number, number> = { 1: 680, 2: 1200, 3: 450, 4: 1800, 5: 120 }
        const nameMap: Record<number, string> = {
          1: '頂級蜜蘋果', 2: '愛文芒果（預購）', 3: '台灣香菇乾', 4: '精選水果禮盒組合', 5: '有機香蕉',
        }
        const price = priceMap[item.productId] ?? 0
        return {
          id: nextOrderId * 10 + idx,
          productId: item.productId,
          productName: nameMap[item.productId] ?? `商品 ${item.productId}`,
          productPrice: price,
          quantity: item.quantity,
          discountAmount: 0,
          subtotal: price * item.quantity,
        }
      }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    orders.push(newOrder)
    return HttpResponse.json(newOrder, { status: 201 })
  }),

  http.post('/api/v1/storefront/orders/:orderId/payment', async ({ params, request }) => {
    const { orderId } = params
    const body = await request.json() as { paymentMethod: string }
    return HttpResponse.json({
      ...mockPayment,
      id: nextOrderId,
      orderId: Number(orderId),
      paymentMethod: body.paymentMethod,
      ecpayPaymentUrl: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5?mock=true',
    })
  }),
]
