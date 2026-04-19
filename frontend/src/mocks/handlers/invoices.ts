import { http, HttpResponse } from 'msw'
import { mockInvoices } from '../fixtures'
import type { InvoiceStatus } from '@/lib/types'

let invoices = [...mockInvoices]

export const invoiceHandlers = [
  http.get('/api/v1/invoices', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') as InvoiceStatus | null
    const invoiceNumber = url.searchParams.get('invoiceNumber')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const page = Number(url.searchParams.get('page') ?? 0)
    const size = Number(url.searchParams.get('size') ?? 20)

    let filtered = [...invoices]
    if (status) filtered = filtered.filter((i) => i.status === status)
    if (invoiceNumber) filtered = filtered.filter((i) => i.invoiceNumber?.includes(invoiceNumber))
    if (startDate) filtered = filtered.filter((i) => i.createdAt >= startDate)
    if (endDate) filtered = filtered.filter((i) => i.createdAt <= endDate + 'T23:59:59Z')

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

  http.post('/api/v1/invoices/:invoiceId/void', async ({ params, request }) => {
    const { invoiceId } = params
    const body = await request.json() as { reason: string }
    const invoice = invoices.find((i) => i.id === Number(invoiceId))
    if (!invoice) {
      return HttpResponse.json({ message: '發票不存在' }, { status: 404 })
    }
    if (invoice.status !== 'ISSUED') {
      return HttpResponse.json({ message: '僅已開立且同月份的發票可作廢' }, { status: 400 })
    }
    invoice.status = 'VOIDED'
    invoice.voidReason = body.reason
    invoice.updatedAt = new Date().toISOString()
    return HttpResponse.json(invoice)
  }),

  http.post('/api/v1/invoices/:invoiceId/allowance', async ({ params, request }) => {
    const { invoiceId } = params
    const body = await request.json() as { amount: number }
    const invoice = invoices.find((i) => i.id === Number(invoiceId))
    if (!invoice) {
      return HttpResponse.json({ message: '發票不存在' }, { status: 404 })
    }
    if (invoice.status !== 'ISSUED') {
      return HttpResponse.json({ message: '僅已開立發票可折讓' }, { status: 400 })
    }
    if (body.amount > invoice.amount) {
      return HttpResponse.json({ message: '折讓金額超過原始發票金額' }, { status: 400 })
    }
    invoice.status = 'ALLOWANCED'
    invoice.allowanceAmount = body.amount
    invoice.allowanceNumber = `AL${Date.now()}`
    invoice.updatedAt = new Date().toISOString()
    return HttpResponse.json(invoice)
  }),

  http.post('/api/v1/invoices/:invoiceId/sync', ({ params }) => {
    const { invoiceId } = params
    const invoice = invoices.find((i) => i.id === Number(invoiceId))
    if (!invoice) {
      return HttpResponse.json({ message: '發票不存在' }, { status: 404 })
    }
    if (invoice.status !== 'SYNCING') {
      return HttpResponse.json({ message: '僅同步中狀態的發票可手動同步' }, { status: 400 })
    }
    invoice.status = 'ISSUED'
    invoice.invoiceNumber = `AB${Date.now().toString().slice(-8)}`
    invoice.randomCode = '9999'
    invoice.invoiceDate = new Date().toISOString().slice(0, 10)
    invoice.updatedAt = new Date().toISOString()
    return HttpResponse.json(invoice)
  }),
]
