import { http, HttpResponse } from 'msw'
import { mockOrders, mockWebsites, mockUsers } from '../fixtures'
import { getRoleFromRequest, getEmailFromRequest } from '../rbac'
import type { OrderDTO, OrderStatus } from '@/lib/types'

let orders = [...mockOrders]

export const orderHandlers = [
  http.get('/api/v1/orders', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') as OrderStatus | null
    const orderNumber = url.searchParams.get('orderNumber')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const websiteId = url.searchParams.get('websiteId')
    const page = Number(url.searchParams.get('page') ?? 0)
    const size = Number(url.searchParams.get('size') ?? 20)

    let filtered = [...orders]
    const role = getRoleFromRequest(request)
    if (role === 'GENERAL_USER') {
      const email = getEmailFromRequest(request)
      const user = mockUsers.find((u) => u.email === email)
      if (user) {
        const ownedWebsiteIds = mockWebsites
          .filter((w) => w.ownerUserId === user.id)
          .map((w) => w.id)
        filtered = filtered.filter((o) => ownedWebsiteIds.includes(o.websiteId))
      } else {
        filtered = []
      }
    }
    if (status) filtered = filtered.filter((o) => o.status === status)
    if (orderNumber) filtered = filtered.filter((o) => o.orderNumber.includes(orderNumber))
    if (websiteId) filtered = filtered.filter((o) => o.websiteId === Number(websiteId))
    if (startDate) filtered = filtered.filter((o) => o.createdAt >= startDate)
    if (endDate) filtered = filtered.filter((o) => o.createdAt <= endDate + 'T23:59:59Z')

    const start = page * size
    const content = filtered.slice(start, start + size)

    return HttpResponse.json({
      content,
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / size),
      page,
      size,
    })
  }),

  http.get('/api/v1/orders/export', ({ request }) => {
    const url = new URL(request.url)
    // Build minimal CSV
    const header = 'orderNumber,customerName,totalAmount,status,createdAt\n'
    const rows = orders
      .map((o) => `${o.orderNumber},${o.customerName},${o.totalAmount},${o.status},${o.createdAt}`)
      .join('\n')
    const csv = '\uFEFF' + header + rows // UTF-8 BOM

    return new HttpResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="orders.csv"',
      },
    })
  }),

  http.post('/api/v1/orders/:orderId/ship', ({ params }) => {
    const { orderId } = params
    const order = orders.find((o) => o.id === Number(orderId))
    if (!order) {
      return HttpResponse.json({ message: '訂單不存在' }, { status: 404 })
    }
    if (order.status !== 'PAID') {
      return HttpResponse.json({ message: '僅已付款訂單可標註出貨' }, { status: 400 })
    }
    order.status = 'SHIPPED'
    order.updatedAt = new Date().toISOString()
    return HttpResponse.json(order)
  }),

  http.post('/api/v1/orders/:orderId/return', ({ params }) => {
    const { orderId } = params
    const order = orders.find((o) => o.id === Number(orderId))
    if (!order) {
      return HttpResponse.json({ message: '訂單不存在' }, { status: 404 })
    }
    if (order.status !== 'PAID' && order.status !== 'SHIPPED') {
      return HttpResponse.json({ message: '僅已付款訂單可標註退貨' }, { status: 400 })
    }
    order.status = 'RETURNED'
    order.updatedAt = new Date().toISOString()
    return HttpResponse.json(order)
  }),
]
